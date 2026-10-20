/**
 * E2E de la campana de avisos: el primer evento (fin de una tanda de PDFs de fórmula) llega sin
 * recargar y lleva a fórmulas; ningún aviso cruza de empresa ni de rol; el panel carga el
 * historial al hacer scroll con el observador real del navegador; la campana es núcleo (sin permiso
 * ni añadido en la base); y no hay página `/notificaciones` ni ítem en el menú. En Chromium y en
 * WebKit.
 *
 * SIN RED. El `webServer` de `playwright.config.ts` arranca con los dobles de `documentos`
 * (lector enlatado y cola en línea), como `e2e/formula-desde-pdf.spec.ts`. Lo único que sale del
 * navegador es el `PUT` de la subida, interceptado más abajo.
 *
 * DATOS: todo lleva el prefijo `qc137_e2e_` con el `RUN_ID` del worker. El `afterAll` borra por
 * los ids y nombres exactos de este worker aunque un caso reviente. Los avisos de rol y la docena
 * para el scroll se siembran con `e2e/helpers/notifications.ts`.
 *
 * Los casos van en serie: comparten la empresa A y el conteo de la campana de su Administrador.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Browser, type Page } from '@playwright/test';

import { normalizeCompanyName, ROLE_ADMINISTRADOR, ROLE_OPERADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { prisma } from '@/lib/shared/db/prisma';
import { FORMULAS_ROUTE } from '@/lib/shared/routes';

import { enableAllAddons } from './helpers/addons';
import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { deleteCompanyNotifications, seedNotifications } from './helpers/notifications';

const FIXTURE_PREFIX = 'qc137_e2e_';

const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit corren a la vez: solo es huérfano lo que lleva más de una hora. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const E2E_AI_PROVIDER_KEY_ENC = 'v1:e2e-sin-descifrar';
const STORAGE_ORIGIN = 'https://documentos-e2e.invalid';
const PDF_MIME_TYPE = 'application/pdf';
const pdfBytes = Buffer.from('%PDF-1.4\n%%EOF\n', 'ascii');

/** La consulta del resumen va cada 30 s; con la tanda en cola, el aviso llega en menos de dos. */
const BELL_UPDATE_TIMEOUT_MS = 90_000;

const NOTIFICATIONS_PERMISSION = 'notificaciones.consultar';
const NOTIFICATIONS_ADDON = 'notificaciones';

const PANEL_EMPTY = 'No tienes notificaciones.';
const PANEL_END = 'No hay más avisos. Se conservan 90 días.';
const FORMULA_BATCH_TITLE = 'Tanda de PDFs procesada';

type Credentials = { readonly username: string; readonly password: string };

const credentials = (kind: string): Credentials => ({
  username: `${FIXTURE_PREFIX}${kind}_${RUN_ID}`,
  password: `Qc137-${kind}-${RUN_ID.slice(0, 12)}`,
});

const adminA = credentials('admin_a');
const operatorA = credentials('operador_a');
const readerA = credentials('lector_a');
const adminB = credentials('admin_b');
const ALL_USERS = [adminA, operatorA, readerA, adminB];

const companyAName = `${FIXTURE_PREFIX}empresa_a_${RUN_ID}`;
const companyBName = `${FIXTURE_PREFIX}empresa_b_${RUN_ID}`;
const fileName = `${FIXTURE_PREFIX}formula_${RUN_ID}.pdf`;
const roleNoticeTitle = `${FIXTURE_PREFIX}aviso_rol_${RUN_ID}`;
const scrollTitle = (n: number) => `${FIXTURE_PREFIX}historial_${String(n).padStart(2, '0')}_${RUN_ID}`;
const SCROLL_NOTICES = 12;

let companyAId: string | null = null;
let companyBId: string | null = null;
let readerAId: string | null = null;

async function roleId(name: string): Promise<string> {
  const role = await prisma.role.findUnique({ where: { name }, select: { id: true } });
  if (!role) {
    throw new Error(`falta el rol "${name}": este E2E no lo crea. Siembra la base con db:seed.`);
  }
  return role.id;
}

async function createUser(user: Credentials, role: string, companyId: string): Promise<string> {
  const created = await createFixtureUser({
    data: {
      firstNames: `Qc137${RUN_ID.slice(0, 8)}`,
      lastNames: 'Avisos',
      birthDate: new Date('1990-01-01'),
      email: `${user.username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: 'CC',
      documentNumber: user.username,
      username: user.username,
      passwordHash: await createPasswordHash(user.password),
      roleId: await roleId(role),
      companyId,
    },
    select: { id: true },
  });
  return created.id;
}

async function createCompany(name: string): Promise<string> {
  const company = await prisma.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  });
  await enableAllAddons(company.id);
  return company.id;
}

test.beforeAll(async () => {
  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  const orphanCompanyIds = (
    await prisma.company.findMany({
      where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
      select: { id: true },
    })
  ).map((company) => company.id);
  if (orphanCompanyIds.length > 0) {
    await deleteCompanyNotifications(orphanCompanyIds);
    await prisma.documentFile.deleteMany({ where: { companyId: { in: orphanCompanyIds } } });
    await prisma.documentBatch.deleteMany({ where: { companyId: { in: orphanCompanyIds } } });
    await prisma.aiProviderConnection.deleteMany({ where: { companyId: { in: orphanCompanyIds } } });
    await prisma.recipe.deleteMany({ where: { companyId: { in: orphanCompanyIds } } });
    await prisma.product.deleteMany({ where: { companyId: { in: orphanCompanyIds } } });
  }
  await prisma.user.deleteMany({
    where: { username: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
  });
  if (orphanCompanyIds.length > 0) {
    await prisma.company.deleteMany({ where: { id: { in: orphanCompanyIds } } });
  }

  companyAId = await createCompany(companyAName);
  companyBId = await createCompany(companyBName);

  const adminAId = await createUser(adminA, ROLE_ADMINISTRADOR, companyAId);
  await createUser(operatorA, ROLE_OPERADOR, companyAId);
  readerAId = await createUser(readerA, ROLE_OPERADOR, companyAId);
  await createUser(adminB, ROLE_ADMINISTRADOR, companyBId);

  // Sin conexión la subida no se abre. Con el lector enlatado la key no se descifra nunca.
  await prisma.aiProviderConnection.create({
    data: {
      id: randomUUID(),
      companyId: companyAId,
      provider: 'ANTHROPIC',
      apiKeyEnc: E2E_AI_PROVIDER_KEY_ENC,
      status: 'ACTIVE',
      keyUpdatedAt: new Date(),
      createdById: adminAId,
      updatedById: adminAId,
    },
  });
});

test.afterAll(async () => {
  const companyIds = [companyAId, companyBId].filter((id): id is string => id !== null);
  try {
    await deleteCompanyNotifications(companyIds);
    if (companyIds.length > 0) {
      await prisma.documentFile.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.documentBatch.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.aiProviderConnection.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.recipe.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.product.deleteMany({ where: { companyId: { in: companyIds } } });
    }
  } finally {
    try {
      await prisma.user.deleteMany({ where: { username: { in: ALL_USERS.map((u) => u.username) } } });
    } finally {
      try {
        await prisma.company.deleteMany({ where: { name: { in: [companyAName, companyBName] } } });
      } finally {
        await prisma.$disconnect();
      }
    }
  }
});

test.setTimeout(240_000);
test.describe.configure({ mode: 'serial' });

async function interceptSignedUploads(page: Page): Promise<{ count(): number }> {
  let intercepted = 0;
  await page.route(`${STORAGE_ORIGIN}/**`, async (route) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'PUT, OPTIONS',
      'access-control-allow-headers': 'content-type',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    intercepted += 1;
    await route.fulfill({ status: 200, headers, body: '' });
  });
  return { count: () => intercepted };
}

/** Cada usuario en su propio contexto: sin cookies compartidas entre sesiones. */
async function signedIn(browser: Browser, user: Credentials): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAndLand(page, user);
  return page;
}

const bell = (page: Page) => page.getByTestId('private-header').getByTestId('notification-bell');
const panel = (page: Page) => page.getByTestId('notification-panel');
const panelRows = (page: Page) => panel(page).getByRole('link');

async function openPanel(page: Page): Promise<void> {
  await expect(bell(page)).toBeVisible({ timeout: 60_000 });
  await bell(page).click();
  await expect(panel(page)).toBeVisible({ timeout: 30_000 });
  await expect(panel(page).getByTestId('notification-skeletons')).toHaveCount(0, { timeout: 30_000 });
}

async function rowTitles(page: Page): Promise<string[]> {
  const labels = await panelRows(page).evaluateAll((rows) =>
    rows.map((row) => row.getAttribute('aria-label') ?? ''),
  );
  return labels.map((label) => label.split('. ')[0] ?? '');
}

test.describe('notificaciones', () => {
  test('1. el Administrador de A sube un PDF de fórmula y, sin recargar, su campana muestra 1 y el aviso lleva a fórmulas (R13, R24, R46, R49)', async ({
    page,
  }) => {
    const uploads = await interceptSignedUploads(page);
    await loginAndLand(page, adminA);

    await page.goto(FORMULAS_ROUTE);
    await expect(bell(page)).toHaveAccessibleName('Notificaciones, ninguna sin leer', { timeout: 60_000 });

    await expect(page.getByTestId('document-upload-open')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('document-upload-open').click();
    await expect(page.getByTestId('document-upload-dialog')).toBeVisible({ timeout: 60_000 });
    await page
      .getByTestId('document-upload-input')
      .setInputFiles([{ name: fileName, mimeType: PDF_MIME_TYPE, buffer: pdfBytes }]);
    await expect(page.getByTestId('document-upload-row-name-0')).toHaveText(fileName);
    await page.getByTestId('document-upload-submit').click();
    await expect(page.getByTestId('document-upload-row-status-0')).toHaveAttribute('data-status', 'done', {
      timeout: 120_000,
    });
    expect(uploads.count(), 'el PDF sube sus bytes desde el navegador').toBe(1);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('document-upload-dialog')).toHaveCount(0, { timeout: 30_000 });

    // Sin recargar: lo trae la consulta periódica.
    await expect(bell(page)).toHaveAccessibleName('Notificaciones, 1 sin leer', {
      timeout: BELL_UPDATE_TIMEOUT_MS,
    });
    await expect(bell(page).getByTestId('unread-count-badge')).toHaveText('1');

    await openPanel(page);
    await expect(panelRows(page)).toHaveCount(1);
    const row = panelRows(page).first();
    await expect(row).toHaveAccessibleName(new RegExp(`^${FORMULA_BATCH_TITLE}\\.`));
    await expect(row).toContainText('Ver fórmulas');
    await expect(row).toHaveAttribute('href', FORMULAS_ROUTE);

    await row.click();
    await page.waitForURL((url) => url.pathname === FORMULAS_ROUTE, { timeout: 60_000 });
    await expect(panel(page)).toHaveCount(0);
    await expect(bell(page)).toHaveAccessibleName('Notificaciones, ninguna sin leer', { timeout: 30_000 });

    const stored = await prisma.notification.findMany({
      where: { companyId: companyAId as string },
      select: { title: true, targetKind: true, recipientUserId: true },
    });
    expect(stored).toEqual([
      expect.objectContaining({ title: FORMULA_BATCH_TITLE, targetKind: 'formulas' }),
    ]);
  });

  test('2. el Administrador de B no ve en su panel el aviso de A (R13)', async ({ browser }) => {
    expect(
      await prisma.notification.count({ where: { companyId: companyAId as string, title: FORMULA_BATCH_TITLE } }),
      'el aviso de A existe: si no, este caso no afirma nada',
    ).toBe(1);

    const page = await signedIn(browser, adminB);
    await expect(bell(page)).toHaveAccessibleName('Notificaciones, ninguna sin leer', { timeout: 60_000 });
    await openPanel(page);
    await expect(panel(page).getByText(PANEL_EMPTY)).toBeVisible();
    await expect(panelRows(page)).toHaveCount(0);
    await expect(panel(page).getByText(FORMULA_BATCH_TITLE)).toHaveCount(0);
    await page.context().close();
  });

  test('3. un aviso al rol Administrador de A lo ve el Administrador de A y no el Operador de A (R13)', async ({
    browser,
  }) => {
    await seedNotifications([
      {
        companyId: companyAId as string,
        title: roleNoticeTitle,
        dedupeKey: `${FIXTURE_PREFIX}rol_${RUN_ID}`,
        createdAt: new Date(),
        recipient: { role: ROLE_ADMINISTRADOR },
      },
    ]);

    const operator = await signedIn(browser, operatorA);
    await openPanel(operator);
    await expect(operator.getByText(PANEL_EMPTY)).toBeVisible();
    await expect(panel(operator).getByText(roleNoticeTitle)).toHaveCount(0);
    await expect(bell(operator)).toHaveAccessibleName('Notificaciones, ninguna sin leer');
    await operator.context().close();

    const admin = await signedIn(browser, adminA);
    await expect(bell(admin)).toHaveAccessibleName('Notificaciones, 1 sin leer', { timeout: 60_000 });
    await openPanel(admin);
    expect(await rowTitles(admin)).toContain(roleNoticeTitle);
    await admin.context().close();
  });

  test('4. con 12 avisos el panel abre con 10 y, al hacer scroll hasta el final, trae los 2 restantes sin repetir (R25, R27)', async ({
    browser,
  }) => {
    const base = Date.now() - 60 * 60 * 1000;
    await seedNotifications(
      Array.from({ length: SCROLL_NOTICES }, (_, i) => ({
        companyId: companyAId as string,
        title: scrollTitle(i + 1),
        dedupeKey: `${FIXTURE_PREFIX}historial_${i + 1}_${RUN_ID}`,
        createdAt: new Date(base + (i + 1) * 60_000),
        recipient: { userId: readerAId as string },
      })),
    );

    const page = await signedIn(browser, readerA);
    await openPanel(page);
    await expect(panelRows(page)).toHaveCount(10);
    expect(await rowTitles(page)).toEqual(
      Array.from({ length: 10 }, (_, i) => scrollTitle(SCROLL_NOTICES - i)),
    );
    await expect(panel(page).getByText(PANEL_END)).toHaveCount(0);

    await page.getByTestId('notification-scroll-area').evaluate((area) => {
      area.scrollTop = area.scrollHeight;
    });

    await expect(panelRows(page)).toHaveCount(SCROLL_NOTICES, { timeout: 30_000 });
    await expect(panel(page).getByText(PANEL_END)).toBeVisible({ timeout: 30_000 });
    const titles = await rowTitles(page);
    expect(titles).toEqual(Array.from({ length: SCROLL_NOTICES }, (_, i) => scrollTitle(SCROLL_NOTICES - i)));
    expect(new Set(titles).size).toBe(SCROLL_NOTICES);
    await page.context().close();
  });

  test('5. sin permiso ni añadido de notificaciones en la base, el Operador de A ve la campana y abre el panel (R19)', async ({
    browser,
  }) => {
    expect(await prisma.permission.count({ where: { code: NOTIFICATIONS_PERMISSION } })).toBe(0);
    expect(await prisma.rolePermission.count({ where: { permissionCode: NOTIFICATIONS_PERMISSION } })).toBe(0);
    expect(await prisma.addon.count({ where: { key: NOTIFICATIONS_ADDON } })).toBe(0);
    expect(await prisma.companyAddonOverride.count({ where: { addonKey: NOTIFICATIONS_ADDON } })).toBe(0);

    const page = await signedIn(browser, operatorA);
    await expect(bell(page)).toHaveAccessibleName('Notificaciones, ninguna sin leer', { timeout: 60_000 });
    await openPanel(page);
    await expect(panel(page).getByRole('heading', { name: 'Notificaciones' })).toBeVisible();
    await expect(panel(page).getByText(PANEL_EMPTY)).toBeVisible();
    await page.context().close();
  });

  test('6. /notificaciones responde 404 y el menú lateral no tiene «Notificaciones» (R24)', async ({ browser }) => {
    const page = await signedIn(browser, adminA);
    const sidebar = page.locator('[data-slot="sidebar"]');
    await expect(sidebar.first()).toBeAttached({ timeout: 60_000 });
    await expect(sidebar.getByText('Notificaciones', { exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: /notificaciones/i })).toHaveCount(0);

    const missing = await page.goto('/notificaciones');
    expect(missing?.status()).toBe(404);
    await page.context().close();
  });
});
