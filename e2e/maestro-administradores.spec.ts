/**
 * E2E de QC-166 R45: los Administradores de las empresas, gestionados por el Maestro desde la
 * pantalla.
 *
 * Un solo caso y no varios: cada paso parte de lo que dejó el anterior (el Administrador que se
 * edita, al que se reenvía el enlace y que se da de baja es el que se dio de alta), y el último
 * paso afirma sobre lo que queda. La empresa y su primer Administrador se siembran con nombres
 * propios de la ejecución, así que Chromium y WebKit no se pisan aunque corran a la vez sobre la
 * misma base; la lista se abre filtrada por esa empresa (`?empresa=`), que es el estado de la
 * propia lista.
 *
 * El aviso del alta y el del reenvío se aceptan en sus dos variantes (correo enviado o no): el
 * transporte de correo del servidor de E2E no lo controla el spec (design.md > 10).
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  ADMINISTRATOR_CREATE_TEXTS,
  ADMINISTRATOR_DELETE_TEXTS,
  ADMINISTRATOR_EDIT_TEXTS,
  ADMINISTRATOR_RESEND_TEXTS,
  administratorDisplayName,
} from '@/app/(private)/maestro/administradores/components/administrator-labels';
import { normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { prisma } from '@/lib/shared/db/prisma';
import { MAESTRO_ADMINISTRATORS_ROUTE } from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { deleteFixtureCompanies, maestroCredentials } from './helpers/maestro';
import { openRowActionsMenuItem } from './helpers/row-actions-menu';

const FIXTURE_PREFIX = 'qc166_adm_';

/** Chromium y WebKit comparten base: una hora deja fuera cualquier ejecución viva. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const COMPANY_PARAM = 'empresa';

const TOAST = '[data-sonner-toast]';

const T = {
  table: 'administrator-table',
  skeleton: 'administrator-list-skeleton',
  username: 'administrator-username',
  email: 'administrator-email',
  name: 'administrator-name',
  status: 'administrator-status',
  actions: 'administrator-actions',
  createOpen: 'administrator-create-open',
  sheet: 'administrator-sheet',
  form: 'administrator-form',
  submit: 'administrator-submit',
  companySelect: 'administrator-company',
  companyFixed: 'administrator-company-fixed',
  resendDialog: 'administrator-resend-dialog',
  resendConfirm: 'administrator-resend-confirm',
  deleteDialog: 'administrator-delete-dialog',
  deleteConfirm: 'administrator-delete-confirm',
  deleteDismiss: 'administrator-delete-dismiss',
  deleteLast: 'administrator-delete-last',
  content: 'private-content',
} as const;

const ITEM = {
  edit: 'administrator-action-edit',
  resend: 'administrator-action-resend',
  delete: 'administrator-action-delete',
} as const;

let token = '';
let runId = '';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** La fila del Administrador por su usuario, con el usuario exacto. */
function administratorRow(page: Page, username: string): Locator {
  return page.getByTestId(T.content).getByRole('row').filter({
    has: page.getByTestId(T.username).getByText(username, { exact: true }),
  });
}

/**
 * La lista ya servida. Dentro de `private-content` y sin `aria-busy`: mientras React cambia el
 * esqueleto por la lista, la copia que llega por streaming vive un instante fuera del contenido.
 */
async function openList(page: Page, companyId: string): Promise<void> {
  await page.goto(`${MAESTRO_ADMINISTRATORS_ROUTE}?${new URLSearchParams({ [COMPANY_PARAM]: companyId })}`);
  await expect(
    page.getByTestId(T.content).locator(`[data-testid="${T.table}"][aria-busy="false"]`),
  ).toHaveCount(1, { timeout: 60_000 });
  // Sin esqueleto: una fila ausente tiene que serlo de la lista servida, no del «cargando».
  await expect(page.getByTestId(T.skeleton)).toHaveCount(0, { timeout: 60_000 });
}

/** Un aviso con alguno de esos textos. */
async function expectToast(page: Page, texts: readonly string[]): Promise<void> {
  const pattern = new RegExp(texts.map(escapeRegExp).join('|'));
  await expect(page.locator(TOAST).filter({ hasText: pattern }).first()).toBeVisible({
    timeout: 60_000,
  });
}

/** Elige el primer día del mes que abre el calendario: cualquier fecha pasada sirve. */
async function pickBirthDate(page: Page, triggerTestId: string): Promise<void> {
  const trigger = page.getByTestId(triggerTestId);
  const day = page.locator('button[data-day]').filter({ hasText: /^1$/ }).first();
  await expect(async () => {
    if ((await day.count()) === 0) await trigger.click();
    await expect(day).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await day.click();
  await expect(page.getByTestId(`${triggerTestId}-value`)).not.toHaveValue('');
  await page.keyboard.press('Escape');
}

test.beforeAll(async () => {
  await deleteFixtureCompanies(FIXTURE_PREFIX, new Date(Date.now() - ORPHAN_MIN_AGE_MS));
  // En el hook y no a nivel de módulo: un worker que reinicia vuelve a pasar por aquí.
  runId = randomUUID().replace(/-/g, '').slice(0, 12);
  token = `${FIXTURE_PREFIX}${runId}`;
});

test.afterAll(async () => {
  try {
    if (token) await deleteFixtureCompanies(token);
  } finally {
    await prisma.$disconnect();
  }
});

// Alta, edición, reenvío y dos bajas en un mismo caso, con bcrypt al sembrar.
test.setTimeout(300_000);

test('el Maestro da de alta un Administrador eligiendo empresa, lo edita, le reenvía el enlace, no puede dar de baja al último y da de baja al que no lo es (R45)', async ({
  page,
}) => {
  const companyName = `${token}_c`;

  // --- 0. La empresa con un primer Administrador activo, sembrados por la base.
  const role = await prisma.role.findUnique({
    where: { name: ROLE_ADMINISTRADOR },
    select: { id: true },
  });
  if (!role) throw new Error(`falta el rol "${ROLE_ADMINISTRADOR}": siembra la base con \`pnpm run db:seed\`.`);
  const company = await prisma.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  });
  const first = {
    firstNames: `Qc166${runId.slice(0, 8)}`,
    lastNames: 'Primero',
    username: `${token}_uno`,
  };
  const seeded = await createFixtureUser({
    data: {
      firstNames: first.firstNames,
      lastNames: first.lastNames,
      birthDate: new Date('1990-01-01'),
      email: `${first.username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: 'CC',
      documentNumber: first.username,
      username: first.username,
      passwordHash: await createPasswordHash(`Qc166-Uno-${runId}`),
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  });

  const admin = {
    firstNames: `Qc166${runId.slice(0, 8)}`,
    lastNames: 'Nuevo',
    editedLastNames: 'Editado',
    email: `${token}_dos@example.test`,
    documentNumber: `${token}_doc`,
    username: `${token}_dos`,
  };

  await loginAndLand(page, maestroCredentials());
  await openList(page, company.id);
  await expect(administratorRow(page, first.username)).toHaveCount(1, { timeout: 60_000 });
  await expect(administratorRow(page, admin.username)).toHaveCount(0);

  // --- 1. Alta eligiendo la empresa en el panel; la fila llega «Pendiente».
  const sheet = page.getByTestId(T.sheet);
  // Acotado al formulario: las celdas de la lista repiten `administrator-email` y `-username`.
  const form = page.getByTestId(T.form);
  await expect(async () => {
    if ((await sheet.count()) === 0) await page.getByTestId(T.createOpen).click();
    await expect(sheet).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });

  const companyOption = page.getByRole('option', { name: companyName, exact: true });
  await expect(async () => {
    if ((await companyOption.count()) === 0) await page.getByTestId(T.companySelect).click();
    await expect(companyOption).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await companyOption.click();
  await expect(page.getByTestId(T.companySelect)).toContainText(companyName);

  await form.getByTestId('administrator-first-names').fill(admin.firstNames);
  await form.getByTestId('administrator-last-names').fill(admin.lastNames);
  await pickBirthDate(page, 'administrator-birth-date');
  await form.getByTestId('administrator-email').fill(admin.email);
  // El servidor exige el teléfono y el número de documento (reglas del alta de usuario).
  await form.getByTestId('administrator-phone').fill('+573000000000');
  await form.getByTestId('administrator-document-number').fill(admin.documentNumber);
  await form.getByTestId('administrator-username').fill(admin.username);
  await page.getByTestId(T.submit).click();

  await expect(sheet).toHaveCount(0, { timeout: 60_000 });
  await expectToast(page, [ADMINISTRATOR_CREATE_TEXTS.success, ADMINISTRATOR_CREATE_TEXTS.mailFailed]);

  const row = administratorRow(page, admin.username);
  await expect(row).toHaveCount(1, { timeout: 60_000 });
  await expect(row.getByTestId(T.email)).toHaveText(admin.email);
  await expect(row.getByTestId(T.status)).toHaveAttribute('data-status', 'pending');

  const created = await prisma.user.findFirstOrThrow({
    where: { username: admin.username },
    select: { id: true, companyId: true },
  });
  expect(created.companyId, 'el Administrador nace en la empresa elegida').toBe(company.id);

  // --- 2. Edición: la empresa no se puede cambiar; el apellido nuevo se ve en la lista.
  const editItem = await openRowActionsMenuItem(page, row.getByTestId(T.actions), ITEM.edit);
  await editItem.click();
  await expect(sheet).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(T.companyFixed)).toContainText(companyName, { timeout: 60_000 });
  const lastNames = form.getByTestId('administrator-last-names');
  await expect(lastNames).toHaveValue(admin.lastNames, { timeout: 60_000 });
  await lastNames.fill(admin.editedLastNames);
  await page.getByTestId(T.submit).click();

  await expect(sheet).toHaveCount(0, { timeout: 60_000 });
  await expectToast(page, [ADMINISTRATOR_EDIT_TEXTS.success]);
  const editedName = administratorDisplayName({
    firstNames: admin.firstNames,
    lastNames: admin.editedLastNames,
  });
  // Con `toContainText`: la celda lleva delante las iniciales del avatar.
  await expect(row.getByTestId(T.name)).toContainText(editedName, { timeout: 60_000 });

  // --- 3. Reenvío del enlace: solo en la fila pendiente; el aviso nombra a la persona.
  const firstRow = administratorRow(page, first.username);
  await expect(firstRow.getByTestId(T.status)).toHaveAttribute('data-status', 'active');
  await openRowActionsMenuItem(page, firstRow.getByTestId(T.actions), ITEM.edit);
  await expect(page.getByRole('menu').getByTestId(ITEM.resend)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0, { timeout: 60_000 });

  const resendItem = await openRowActionsMenuItem(page, row.getByTestId(T.actions), ITEM.resend);
  await resendItem.click();
  const resendDialog = page.getByTestId(T.resendDialog);
  await expect(resendDialog).toBeVisible({ timeout: 60_000 });
  await expect(resendDialog).toContainText(ADMINISTRATOR_RESEND_TEXTS.title(editedName));
  await expect(resendDialog).toContainText(admin.email);
  await page.getByTestId(T.resendConfirm).click();
  await expect(resendDialog).toHaveCount(0, { timeout: 60_000 });
  await expectToast(page, [
    ADMINISTRATOR_RESEND_TEXTS.sent(editedName),
    ADMINISTRATOR_RESEND_TEXTS.mailFailed(editedName),
  ]);

  // --- 4. Baja del que no es el último: sale de la lista.
  const deleteItem = await openRowActionsMenuItem(page, row.getByTestId(T.actions), ITEM.delete);
  await deleteItem.click();
  const deleteDialog = page.getByTestId(T.deleteDialog);
  await expect(deleteDialog).toBeVisible({ timeout: 60_000 });
  await expect(deleteDialog).toContainText(ADMINISTRATOR_DELETE_TEXTS.title(editedName));
  await expect(page.getByTestId(T.deleteLast)).toHaveCount(0);
  await expect(page.getByTestId(T.deleteConfirm)).toBeEnabled();
  await page.getByTestId(T.deleteConfirm).click();
  await expect(deleteDialog).toHaveCount(0, { timeout: 60_000 });
  await expectToast(page, [ADMINISTRATOR_DELETE_TEXTS.success]);
  await expect(row).toHaveCount(0, { timeout: 60_000 });

  const deleted = await prisma.user.findUniqueOrThrow({
    where: { id: created.id },
    select: { deletedAt: true },
  });
  expect(deleted.deletedAt, 'la baja deja la cuenta dada de baja').not.toBeNull();

  // --- 5. El que queda es el último: la baja está deshabilitada y lo explica.
  const lastDeleteItem = await openRowActionsMenuItem(page, firstRow.getByTestId(T.actions), ITEM.delete);
  await lastDeleteItem.click();
  await expect(deleteDialog).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(T.deleteLast)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(T.deleteLast)).toContainText(ADMINISTRATOR_DELETE_TEXTS.lastMessage);
  await expect(page.getByTestId(T.deleteConfirm)).toBeDisabled();
  await page.getByTestId(T.deleteDismiss).click();
  await expect(deleteDialog).toHaveCount(0, { timeout: 60_000 });
  await expect(firstRow).toHaveCount(1);

  const survivor = await prisma.user.findUniqueOrThrow({
    where: { id: seeded.id },
    select: { deletedAt: true },
  });
  expect(survivor.deletedAt, 'el último Administrador sigue vivo').toBeNull();
});
