/**
 * E2E de una empresa sin añadidos y de lo que pasa al prenderlos con la sesión abierta.
 *
 * Los interruptores se ponen con Prisma y no con la acción del Maestro: esa operación tiene sus
 * propios tests, y lo que este nivel aporta es que la sesión real los relee en cada petición.
 *
 * Los casos comparten empresa y corren en orden en un mismo worker; cada uno fija sus añadidos al
 * empezar, así que no dependen de lo que dejó el anterior.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Page, type Response } from '@playwright/test';

import { type Addon, normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { prisma } from '@/lib/shared/db/prisma';
import {
  AI_PROVIDER_INTEGRATION_ROUTE,
  DASHBOARD_ROUTE,
  FORMULAS_ROUTE,
  HOME_ROUTE,
  INVENTORY_IMPORT_ROUTE,
  INVENTORY_ROUTE,
  LOGIN_ROUTE,
  SUPPLIERS_ROUTE,
} from '@/lib/shared/routes';

import { enableAllAddons } from './helpers/addons';
import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';

const FIXTURE_PREFIX = 'qc277_e2e_';

/** Chromium y WebKit comparten base: una hora deja fuera cualquier ejecución viva. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const ADDON_NAV_TESTIDS = ['nav-dashboard', 'nav-proveedores', 'nav-integraciones'] as const;
const IMPORT_LINK = 'inventory-import-link';
const BRAND_LINK = 'private-brand-link';
const PRIVATE_NAV = 'private-nav';
const LOGOUT = 'private-logout';
const NOT_FOUND = 'private-not-found';
const INVENTORY_NAV = 'nav-inventario';
const RECIPES_TITLE = 'recipes-title';
const UPLOAD_OPEN = 'document-upload-open';

const ADDON_ROUTES = [
  DASHBOARD_ROUTE,
  SUPPLIERS_ROUTE,
  INVENTORY_IMPORT_ROUTE,
  AI_PROVIDER_INTEGRATION_ROUTE,
] as const;

let token = '';
let companyId: string | null = null;
let adminUsername = '';
let adminPassword = '';

async function setAddons(addons: readonly Addon[]): Promise<void> {
  if (!companyId) throw new Error('el fixture no existe: fallo el beforeAll');
  await prisma.company.update({ where: { id: companyId }, data: { addons: [...addons] } });
}

/** El logo apunta a `/inicio`, y lo que cuenta es dónde acaba quien lo pulsa. */
async function expectBrandLeadsTo(page: Page, destination: string): Promise<void> {
  const brand = page.getByTestId(BRAND_LINK);
  await expect(brand).toHaveAttribute('href', HOME_ROUTE);
  await brand.click();
  await page.waitForURL((url) => url.pathname === destination, { timeout: 60_000 });
}

/** Las rutas por las que pasó una navegación, de la primera petición a la respuesta final. */
function redirectChain(response: Response | null): string[] {
  const paths: string[] = [];
  let request = response?.request() ?? null;
  while (request) {
    paths.unshift(new URL(request.url()).pathname);
    request = request.redirectedFrom();
  }
  return paths;
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

  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  await prisma.user.deleteMany({
    where: { username: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
  });
  await prisma.company.deleteMany({
    where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
  });

  // En el hook y no a nivel de módulo: un worker que reinicia vuelve a pasar por aquí.
  const runId = randomUUID().replace(/-/g, '');
  token = `${FIXTURE_PREFIX}${runId}`;
  adminUsername = `${token}_admin`;
  adminPassword = `Qc277-Admin-${runId.slice(0, 12)}`;

  const companyName = `${token}_c`;
  const company = await prisma.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true, addons: true },
  });
  if (company.addons.length !== 0) {
    throw new Error('una empresa nueva debe nacer sin añadidos');
  }
  companyId = company.id;

  await createFixtureUser({
    data: {
      firstNames: `Qc277${runId.slice(0, 8)}`,
      lastNames: 'Modulos',
      birthDate: new Date('1990-01-01'),
      email: `${adminUsername}@example.test`,
      phone: '+573000000000',
      documentTypeCode: 'CC',
      documentNumber: adminUsername,
      username: adminUsername,
      passwordHash: await createPasswordHash(adminPassword),
      roleId: role.id,
      companyId: company.id,
      accountStatus: 'active',
    },
    select: { id: true },
  });
});

test.afterAll(async () => {
  let primerFallo: unknown;
  if (token) {
    for (const paso of [
      () => prisma.user.deleteMany({ where: { username: { startsWith: token } } }),
      () => prisma.company.deleteMany({ where: { name: { startsWith: token } } }),
    ]) {
      try {
        await paso();
      } catch (error) {
        primerFallo ??= error;
      }
    }
  }
  await prisma.$disconnect();
  if (primerFallo !== undefined) throw primerFallo;
});

// `next dev` compila cada ruta en su primer `goto` y bcrypt tarda a propósito.
test.setTimeout(240_000);

test.describe('módulos por empresa', () => {
  test.describe.configure({ mode: 'default' });

  test('sin añadidos: aterriza en Inventario, el menú no trae dashboard, proveedores ni integraciones, no hay botón de importar y el logo lleva a Inventario (R36, R12, R18, R20)', async ({
    page,
  }) => {
    await setAddons([]);

    const destination = await loginAndLand(page, { username: adminUsername, password: adminPassword });
    expect(destination).toBe(INVENTORY_ROUTE);

    // Positivo sobre el mismo menú: sin él, un menú vacío daría el mismo verde.
    await expect(page.getByTestId(INVENTORY_NAV)).toBeVisible({ timeout: 60_000 });
    for (const testId of ADDON_NAV_TESTIDS) {
      await expect(page.getByTestId(testId), `${testId} no debe salir sin su añadido`).toHaveCount(0);
    }
    await expect(page.getByTestId(IMPORT_LINK)).toHaveCount(0);

    await page.goto(FORMULAS_ROUTE);
    await expect(page.getByTestId(RECIPES_TITLE)).toBeVisible({ timeout: 60_000 });
    await expectBrandLeadsTo(page, INVENTORY_ROUTE);
  });

  test('sin añadidos: cada pantalla de un añadido pedida por URL da el 404 privado, con menú y cerrar sesión (R36, R13)', async ({
    page,
  }) => {
    await setAddons([]);
    await loginAndLand(page, { username: adminUsername, password: adminPassword });

    for (const route of ADDON_ROUTES) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} sin su añadido`).toBe(404);
      await expect(page.getByTestId(NOT_FOUND)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId(PRIVATE_NAV)).toBeVisible();
      await expect(page.getByTestId(LOGOUT)).toBeVisible();
    }
  });

  test('sin añadidos: entrar al login con sesión pasa por /inicio y acaba en Inventario (R36, R19)', async ({
    page,
  }) => {
    await setAddons([]);
    await loginAndLand(page, { username: adminUsername, password: adminPassword });

    const response = await page.goto(LOGIN_ROUTE);
    await page.waitForURL((url) => url.pathname === INVENTORY_ROUTE, { timeout: 60_000 });
    expect(redirectChain(response)).toEqual([LOGIN_ROUTE, HOME_ROUTE, INVENTORY_ROUTE]);
  });

  test('al prender los cinco añadidos con la sesión abierta, la siguiente petición trae los enlaces, el botón de importar, el dashboard y el logo al dashboard sin volver a entrar (R36, R9, R18)', async ({
    page,
  }) => {
    await setAddons([]);
    await loginAndLand(page, { username: adminUsername, password: adminPassword });
    await expect(page.getByTestId('nav-dashboard')).toHaveCount(0);

    if (!companyId) throw new Error('el fixture no existe: fallo el beforeAll');
    await enableAllAddons(companyId);
    await page.reload();

    for (const testId of ADDON_NAV_TESTIDS) {
      await expect(page.getByTestId(testId), `${testId} con su añadido`).toBeVisible({
        timeout: 60_000,
      });
    }
    await expect(page.getByTestId(IMPORT_LINK)).toBeVisible();

    const dashboard = await page.goto(DASHBOARD_ROUTE);
    expect(dashboard?.status()).toBe(200);
    await expect(page.getByTestId(PRIVATE_NAV)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId(NOT_FOUND)).toHaveCount(0);

    await page.goto(FORMULAS_ROUTE);
    await expect(page.getByTestId(RECIPES_TITLE)).toBeVisible({ timeout: 60_000 });
    await expectBrandLeadsTo(page, DASHBOARD_ROUTE);
  });

  test('con la lectura de PDF prendida e integraciones apagado, Fórmulas no ofrece «Subir PDF»; con los dos, sí (R4, R9)', async ({
    page,
  }) => {
    await setAddons(['lectura_pdf']);
    await loginAndLand(page, { username: adminUsername, password: adminPassword });

    await page.goto(FORMULAS_ROUTE);
    await expect(page.getByTestId(RECIPES_TITLE)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId(UPLOAD_OPEN)).toHaveCount(0);

    // Positivo en la misma pantalla: sin él, un botón que nunca saliera daría el mismo verde.
    await setAddons(['lectura_pdf', 'integraciones']);
    await page.reload();
    await expect(page.getByTestId(RECIPES_TITLE)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId(UPLOAD_OPEN)).toHaveCount(1, { timeout: 60_000 });
  });
});
