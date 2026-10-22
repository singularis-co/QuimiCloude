/**
 * E2E de la pestaña Módulos del detalle de empresa: el Maestro prende y apaga un añadido desde la
 * pantalla y el menú del Administrador de esa empresa lo sigue en su siguiente petición, sin volver
 * a entrar.
 *
 * Un solo caso: el apagado parte de lo que dejó el prendido. Cada ejecución crea su empresa con su
 * Administrador, así que Chromium y WebKit no se pisan aunque corran a la vez sobre la misma base.
 * El Maestro es el sembrado: la empresa vacía es única del Maestro, y uno efímero no vale.
 *
 * Los dos usuarios van en contextos de navegador distintos, que es lo que garantiza dos frascos de
 * cookies y dos sesiones abiertas a la vez.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { ADDONS, type Addon, normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { prisma } from '@/lib/shared/db/prisma';
import { maestroCompanyRoute } from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand, type Credentials } from './helpers/landing';
import { deleteFixtureCompanies, maestroCredentials } from './helpers/maestro';

const FIXTURE_PREFIX = 'qc278_e2e_';

/** Chromium y WebKit comparten base: una hora deja fuera cualquier ejecución viva. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const TOAST = '[data-sonner-toast]';

const T = {
  inventoryNav: 'nav-inventario',
  suppliersNav: 'nav-proveedores',
  addons: 'company-addons',
  suppliersStatus: 'company-addon-proveedores-status',
  offDialog: 'company-addon-off-dialog',
  offConfirm: 'company-addon-off-confirm',
} as const;

const SUPPLIERS = 'Proveedores';

let token = '';
let companyId: string | null = null;
let admin: Credentials = { username: '', password: '' };

/** Deja prendidos exactamente `addons`, con una excepción por cada uno de los cinco. */
async function setAddons(addons: readonly Addon[]): Promise<void> {
  if (!companyId) throw new Error('el fixture no existe: fallo el beforeAll');
  const id = companyId;
  await prisma.$transaction(
    ADDONS.map((addonKey) => {
      const enabled = addons.includes(addonKey);
      return prisma.companyAddonOverride.upsert({
        where: { companyId_addonKey: { companyId: id, addonKey } },
        create: { companyId: id, addonKey, enabled },
        update: { enabled },
      });
    }),
  );
}

async function expectToast(page: Page, text: string): Promise<void> {
  await expect(page.locator(TOAST).filter({ hasText: text }).first()).toBeVisible({ timeout: 60_000 });
}

/** Recarga sin volver a entrar y espera al menú servido, con el positivo de Inventario. */
async function reloadMenu(page: Page): Promise<void> {
  await page.reload();
  await expect(page.getByTestId(T.inventoryNav)).toBeVisible({ timeout: 60_000 });
}

test.beforeAll(async () => {
  const role = await prisma.role.findUnique({
    where: { name: ROLE_ADMINISTRADOR },
    select: { id: true },
  });
  if (!role) {
    throw new Error(
      `falta el rol "${ROLE_ADMINISTRADOR}": siembra la base con \`pnpm run db:seed\` antes del E2E.`,
    );
  }

  await deleteFixtureCompanies(FIXTURE_PREFIX, new Date(Date.now() - ORPHAN_MIN_AGE_MS));

  // En el hook y no a nivel de módulo: un worker que reinicia vuelve a pasar por aquí.
  const runId = randomUUID().replace(/-/g, '');
  token = `${FIXTURE_PREFIX}${runId}`;
  admin = { username: `${token}_admin`, password: `Qc278-Admin-${runId.slice(0, 12)}` };

  const companyName = `${token}_c`;
  const company = await prisma.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  });
  companyId = company.id;

  await createFixtureUser({
    data: {
      firstNames: `Qc278${runId.slice(0, 8)}`,
      lastNames: 'Modulos',
      birthDate: new Date('1990-01-01'),
      email: `${admin.username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: 'CC',
      documentNumber: admin.username,
      username: admin.username,
      passwordHash: await createPasswordHash(admin.password),
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  });

  await setAddons([]);
});

test.afterAll(async () => {
  try {
    if (token) await deleteFixtureCompanies(token);
  } finally {
    await prisma.$disconnect();
  }
});

// `next dev` compila cada ruta en su primer `goto` y bcrypt tarda a propósito.
test.setTimeout(240_000);

test('R25: el Maestro prende y apaga Proveedores y el menú del Administrador lo sigue', async ({
  page,
  browser,
}) => {
  if (!companyId) throw new Error('el fixture no existe: fallo el beforeAll');

  const adminContext = await browser.newContext();
  try {
    const adminPage = await adminContext.newPage();
    await loginAndLand(adminPage, admin);
    await expect(adminPage.getByTestId(T.inventoryNav)).toBeVisible({ timeout: 60_000 });
    await expect(adminPage.getByTestId(T.suppliersNav)).toHaveCount(0);

    await loginAndLand(page, maestroCredentials());
    await page.goto(maestroCompanyRoute(companyId, 'modulos'));
    await expect(page.getByTestId(T.addons)).toBeVisible({ timeout: 60_000 });

    await page.getByRole('switch', { name: `Prender ${SUPPLIERS}` }).click();
    await expectToast(page, `${SUPPLIERS} prendido.`);
    await expect(page.getByTestId(T.suppliersStatus)).toHaveText('Prendido');

    await reloadMenu(adminPage);
    await expect(adminPage.getByTestId(T.suppliersNav)).toBeVisible({ timeout: 60_000 });

    await page.getByRole('switch', { name: `Apagar ${SUPPLIERS}` }).click();
    const dialog = page.getByTestId(T.offDialog);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`¿Apagar ${SUPPLIERS}?`);
    await page.getByTestId(T.offConfirm).click();
    await expectToast(page, `${SUPPLIERS} apagado.`);
    await expect(page.getByTestId(T.suppliersStatus)).toHaveText('Apagado');

    await reloadMenu(adminPage);
    await expect(adminPage.getByTestId(T.suppliersNav)).toHaveCount(0);
  } finally {
    await adminContext.close();
  }
});
