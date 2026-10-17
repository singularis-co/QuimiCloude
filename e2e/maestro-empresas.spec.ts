/**
 * E2E de QC-166 R44: el ciclo de vida de una empresa hecho por el Maestro desde la pantalla.
 *
 * Un solo caso y no varios: cada paso parte de lo que dejó el anterior (la empresa que se edita es
 * la que se dio de alta, la que se reactiva es la que se dio de baja), y el Historial del final
 * afirma sobre todos. La empresa nace por la pantalla con un nombre propio de la ejecución, así que
 * Chromium y WebKit no se pisan aunque corran a la vez sobre la misma base.
 *
 * La búsqueda y el filtro «De baja» se ponen por la dirección (`?q=`, `?estado=de-baja`), que es el
 * estado de la propia lista: así el caso no depende de los controles de la tabla compartida, que
 * tienen sus propias pruebas.
 *
 * El usuario que pierde la sesión se siembra con `createFixtureUser` en la empresa creada por el
 * caso (design.md > 10). El toast del alta se acepta en sus dos variantes (correo enviado o no):
 * el transporte de correo del servidor de E2E no lo controla el spec.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  COMPANY_CREATE_TEXTS,
  COMPANY_DELETE_TEXTS,
  COMPANY_FIELD_LABELS,
  COMPANY_REACTIVATE_TEXTS,
  COMPANY_EDIT_TEXTS,
  COMPANY_STATUS_LABELS,
  companyCountryLabel,
} from '@/app/(private)/maestro/empresas/components/company-labels';
import { ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { prisma } from '@/lib/shared/db/prisma';
import { LOGIN_ROUTE, MAESTRO_COMPANIES_ROUTE, maestroCompanyRoute } from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { deleteFixtureCompanies, maestroCredentials } from './helpers/maestro';
import { openRowActionsMenuItem } from './helpers/row-actions-menu';

const FIXTURE_PREFIX = 'qc166_emp_';

/** Chromium y WebKit comparten base: una hora deja fuera cualquier ejecución viva. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

/** El país que se elige al editar; la empresa nace sin país. */
const NEW_COUNTRY = 'CO';

const TOAST = '[data-sonner-toast]';

const T = {
  table: 'company-table',
  nameLink: 'company-name-link',
  country: 'company-country',
  status: 'company-status',
  actions: 'company-actions',
  createOpen: 'company-create-open',
  createSheet: 'company-create-sheet',
  createSubmit: 'company-create-submit',
  editSheet: 'company-edit-sheet',
  editSubmit: 'company-edit-submit',
  editCountry: 'company-edit-country',
  deleteDialog: 'company-delete-dialog',
  deleteImpact: 'company-delete-impact',
  deleteConfirmation: 'company-delete-confirmation',
  deleteConfirmationError: 'company-delete-confirmation-error',
  deleteConfirm: 'company-delete-confirm',
  reactivateDialog: 'company-reactivate-dialog',
  reactivateConfirm: 'company-reactivate-confirm',
  historyEvent: 'company-history-event',
  privateNav: 'private-nav',
  content: 'private-content',
  skeleton: 'company-list-skeleton',
} as const;

let token = '';
let runId = '';

function listHref(query: Record<string, string>): string {
  return `${MAESTRO_COMPANIES_ROUTE}?${new URLSearchParams(query).toString()}`;
}

/** La fila de la empresa por su enlace de nombre, con el nombre exacto. */
function companyRow(page: Page, name: string): Locator {
  return page.getByTestId(T.content).getByRole('row').filter({
    has: page.getByTestId(T.nameLink).getByText(name, { exact: true }),
  });
}

/**
 * La lista ya servida. Dentro de `private-content` y sin `aria-busy`: mientras React cambia el
 * esqueleto por la lista, la copia que llega por streaming vive un instante fuera del contenido.
 */
async function openList(page: Page, query: Record<string, string>): Promise<void> {
  await page.goto(listHref(query));
  await expect(
    page.getByTestId(T.content).locator(`[data-testid="${T.table}"][aria-busy="false"]`),
  ).toHaveCount(1, { timeout: 60_000 });
  // Sin esqueleto: una fila ausente tiene que serlo de la lista servida, no del «cargando».
  await expect(page.getByTestId(T.skeleton)).toHaveCount(0, { timeout: 60_000 });
}

/** Un aviso con alguno de esos textos. */
async function expectToast(page: Page, texts: readonly string[]): Promise<void> {
  const pattern = new RegExp(texts.map((text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
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

// Alta, edición, baja, reactivación e historial en un mismo caso, con dos sesiones y bcrypt.
test.setTimeout(300_000);

test('el Maestro da de alta, edita el país, da de baja, reactiva y ve el Historial; la sesión de la empresa dada de baja se corta (R44)', async ({
  page,
  browser,
}) => {
  const companyName = `${token}_c`;
  const admin = {
    firstNames: `Qc166${runId.slice(0, 8)}`,
    lastNames: 'Empresas',
    email: `${token}_adm@example.test`,
    documentNumber: `${token}_doc`,
    username: `${token}_adm`,
  };

  await loginAndLand(page, maestroCredentials());

  // --- 1. Alta con su Administrador inicial, y la empresa en la lista.
  await openList(page, { q: token });
  await expect(companyRow(page, companyName)).toHaveCount(0);

  const createSheet = page.getByTestId(T.createSheet);
  await expect(async () => {
    if ((await createSheet.count()) === 0) await page.getByTestId(T.createOpen).click();
    await expect(createSheet).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });

  await page.getByTestId('company-create-name').fill(companyName);
  await page.getByTestId('company-create-tax-id').fill(`${runId}-tax`);
  await page.getByTestId('company-create-admin-first-names').fill(admin.firstNames);
  await page.getByTestId('company-create-admin-last-names').fill(admin.lastNames);
  await pickBirthDate(page, 'company-create-admin-birth-date');
  await page.getByTestId('company-create-admin-email').fill(admin.email);
  // El servidor exige el teléfono y el número de documento (reglas del alta de usuario).
  await page.getByTestId('company-create-admin-phone').fill('+573000000000');
  await page.getByTestId('company-create-admin-document-number').fill(admin.documentNumber);
  await page.getByTestId('company-create-admin-username').fill(admin.username);
  await page.getByTestId(T.createSubmit).click();

  await expect(createSheet).toHaveCount(0, { timeout: 60_000 });
  await expectToast(page, [COMPANY_CREATE_TEXTS.success, COMPANY_CREATE_TEXTS.mailFailed]);

  const row = companyRow(page, companyName);
  await expect(row).toHaveCount(1, { timeout: 60_000 });
  await expect(row.getByTestId(T.country)).toHaveText(companyCountryLabel(null));
  await expect(row.getByTestId(T.status)).toHaveAttribute('data-status', 'active');

  const company = await prisma.company.findFirstOrThrow({
    where: { name: companyName },
    select: { id: true },
  });

  // --- 2. Edición: cambia el país y el listado enseña el nuevo en la columna País.
  const editItem = await openRowActionsMenuItem(page, row.getByTestId(T.actions), 'company-action-edit');
  await editItem.click();
  const editSheet = page.getByTestId(T.editSheet);
  await expect(editSheet).toBeVisible({ timeout: 60_000 });
  await expect(editSheet.getByText(COMPANY_EDIT_TEXTS.description(companyName))).toBeVisible({
    timeout: 60_000,
  });

  const countryOption = page.getByTestId(`${T.editCountry}-option-${NEW_COUNTRY}`);
  await expect(async () => {
    if ((await countryOption.count()) === 0) await page.getByTestId(T.editCountry).click();
    await expect(page.getByTestId(`${T.editCountry}-list`)).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole('combobox', { name: 'Buscar país por nombre o prefijo' }).fill('Colombia');
  await countryOption.click();
  await expect(page.getByTestId(T.editCountry)).toContainText('Colombia');
  await page.getByTestId(T.editSubmit).click();

  await expect(editSheet).toHaveCount(0, { timeout: 60_000 });
  await expectToast(page, [COMPANY_EDIT_TEXTS.success]);
  await expect(row.getByTestId(T.country)).toHaveText(companyCountryLabel(NEW_COUNTRY), {
    timeout: 60_000,
  });

  // --- 3. Un usuario con la sesión abierta en esa empresa, antes de la baja.
  const role = await prisma.role.findUnique({
    where: { name: ROLE_ADMINISTRADOR },
    select: { id: true },
  });
  if (!role) throw new Error(`falta el rol "${ROLE_ADMINISTRADOR}": siembra la base con \`pnpm run db:seed\`.`);
  const victim = { username: `${token}_vic`, password: `Qc166-Vic-${runId}` };
  await createFixtureUser({
    data: {
      firstNames: `Qc166${runId.slice(0, 8)}`,
      lastNames: 'Sesion',
      birthDate: new Date('1990-01-01'),
      email: `${victim.username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: 'CC',
      documentNumber: victim.username,
      username: victim.username,
      passwordHash: await createPasswordHash(victim.password),
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  });

  const victimContext = await browser.newContext();
  try {
    const victimPage = await victimContext.newPage();
    await loginAndLand(victimPage, victim);
    await expect(victimPage.getByTestId(T.privateNav)).toBeVisible({ timeout: 60_000 });

    // --- 4. Baja: con un nombre que no coincide, el error y la empresa sigue viva.
    const deleteItem = await openRowActionsMenuItem(page, row.getByTestId(T.actions), 'company-action-delete');
    await deleteItem.click();
    const deleteDialog = page.getByTestId(T.deleteDialog);
    await expect(deleteDialog).toBeVisible({ timeout: 60_000 });
    await expect(deleteDialog).toContainText(COMPANY_DELETE_TEXTS.title(companyName));
    await expect(page.getByTestId(T.deleteImpact)).toBeVisible({ timeout: 60_000 });

    await page.getByTestId(T.deleteConfirmation).fill(`${companyName}_otra`);
    await page.getByTestId(T.deleteConfirm).click();
    await expect(page.getByTestId(T.deleteConfirmationError)).toBeVisible({ timeout: 60_000 });
    await expect(deleteDialog).toBeVisible();
    const stillLive = await prisma.company.findUniqueOrThrow({
      where: { id: company.id },
      select: { deletedAt: true },
    });
    expect(stillLive.deletedAt, 'un nombre que no coincide no da de baja').toBeNull();

    // --- 5. Con el nombre correcto se da de baja: fuera de la lista sin filtro, dentro con «De baja».
    await page.getByTestId(T.deleteConfirmation).fill(companyName);
    await page.getByTestId(T.deleteConfirm).click();
    await expect(deleteDialog).toHaveCount(0, { timeout: 60_000 });
    await expectToast(page, [COMPANY_DELETE_TEXTS.success]);
    await expect(row).toHaveCount(0, { timeout: 60_000 });

    await openList(page, { q: token });
    await expect(companyRow(page, companyName)).toHaveCount(0);

    await openList(page, { q: token, estado: 'de-baja' });
    const deletedRow = companyRow(page, companyName);
    await expect(deletedRow).toHaveCount(1, { timeout: 60_000 });
    await expect(deletedRow.getByTestId(T.status)).toHaveAttribute('data-status', 'deleted');
    await expect(deletedRow.getByTestId(T.status)).toContainText(COMPANY_STATUS_LABELS.deleted);

    // --- 6. La sesión abierta en la empresa dada de baja se corta en su siguiente petición.
    await victimPage.reload();
    await victimPage.waitForURL((url) => url.pathname === LOGIN_ROUTE, { timeout: 60_000 });
    await expect(victimPage.getByTestId(T.privateNav)).toHaveCount(0);
  } finally {
    await victimContext.close();
  }

  // --- 7. Reactivación desde la lista «De baja»: vuelve a la lista sin filtro, activa.
  const deletedRow = companyRow(page, companyName);
  const reactivateItem = await openRowActionsMenuItem(
    page,
    deletedRow.getByTestId(T.actions),
    'company-action-reactivate',
  );
  await reactivateItem.click();
  const reactivateDialog = page.getByTestId(T.reactivateDialog);
  await expect(reactivateDialog).toBeVisible({ timeout: 60_000 });
  await expect(reactivateDialog).toContainText(COMPANY_REACTIVATE_TEXTS.title(companyName));
  await page.getByTestId(T.reactivateConfirm).click();
  await expect(reactivateDialog).toHaveCount(0, { timeout: 60_000 });
  await expectToast(page, [COMPANY_REACTIVATE_TEXTS.success]);
  // El refresco de la lista ya llegó (sale de «De baja») antes de navegar: si no, en WebKit el
  // `goto` siguiente choca con él.
  await expect(deletedRow).toHaveCount(0, { timeout: 60_000 });

  await openList(page, { q: token });
  const reactivatedRow = companyRow(page, companyName);
  await expect(reactivatedRow).toHaveCount(1, { timeout: 60_000 });
  await expect(reactivatedRow.getByTestId(T.status)).toHaveAttribute('data-status', 'active');

  // --- 8. Historial: el alta, la edición que nombra «País», la baja y la reactivación.
  await page.goto(maestroCompanyRoute(company.id, 'historial'));
  const events = page.getByTestId(T.content).getByTestId(T.historyEvent);
  await expect(events.first()).toBeVisible({ timeout: 60_000 });
  await expect(events.and(page.locator('[data-kind="company.created"]'))).toHaveCount(1);
  await expect(events.and(page.locator('[data-kind="company.deleted"]'))).toHaveCount(1);
  await expect(events.and(page.locator('[data-kind="company.reactivated"]'))).toHaveCount(1);
  const updated = events.and(page.locator('[data-kind="company.updated"]'));
  await expect(updated).toHaveCount(1);
  await expect(updated).toContainText(COMPANY_FIELD_LABELS.country);
});
