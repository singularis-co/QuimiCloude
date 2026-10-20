/**
 * E2E de QC-166 R43: a dónde entra el Maestro, qué menú ve, qué le responde el ERP, qué le
 * responde su área a un usuario de empresa y que cierra sesión como cualquiera.
 *
 * El Maestro es el de `SEED_MAESTRO_*` (design.md > 10). El usuario de empresa se siembra aquí, en
 * una empresa propia del caso, con `createFixtureUser`.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { prisma } from '@/lib/shared/db/prisma';
import { NAV_SECTION_PLATFORM } from '@/lib/shared/navigation/private-nav';
import { INVENTORY_ROUTE, LOGIN_ROUTE, MAESTRO_COMPANIES_ROUTE } from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand, type Credentials } from './helpers/landing';
import { deleteFixtureCompanies, maestroCredentials } from './helpers/maestro';

const FIXTURE_PREFIX = 'qc166_acc_';

/** Chromium y WebKit comparten base: una hora deja fuera cualquier ejecución viva. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const PRIVATE_NAV = 'private-nav';
const NAV_SECTION = 'private-nav-section';
const NOT_FOUND = 'private-not-found';
const LOGOUT = 'private-logout';
const COMPANIES_TITLE = 'maestro-empresas-title';
const MAESTRO_NAV_TESTIDS = ['nav-administradores', 'nav-empresas'] as const;

let token = '';
let companyUser: Credentials = { username: '', password: '' };

/** Los `data-testid` de los enlaces del menú (`nav-*`, sin sus contadores). */
async function navLinkTestIds(page: Page): Promise<string[]> {
  const ids = await page
    .getByTestId(PRIVATE_NAV)
    .locator('[data-testid^="nav-"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid') ?? ''));
  return [...new Set(ids.filter((id) => !id.endsWith('-badge')))].sort();
}

/**
 * Cierra sesión por teclado y comprueba que volver atrás no devuelve a la zona privada. Por
 * teclado y no con `click()`: el overlay de `next dev` intercepta el puntero en WebKit
 * (`e2e/permisos.spec.ts`, bloque «POR QUE POR TECLADO»).
 */
async function logoutLikeAnyone(page: Page): Promise<void> {
  const logout = page.getByTestId(LOGOUT);
  await expect(logout).toBeVisible({ timeout: 60_000 });
  await logout.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => url.pathname === LOGIN_ROUTE, { timeout: 60_000 });

  await page.goBack();
  await page.waitForURL((url) => url.pathname === LOGIN_ROUTE, { timeout: 60_000 });
  await expect(page.getByTestId(PRIVATE_NAV)).toHaveCount(0);
  await expect(page.getByTestId(LOGOUT)).toHaveCount(0);
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
  const runId = randomUUID().replace(/-/g, '').slice(0, 12);
  token = `${FIXTURE_PREFIX}${runId}`;
  const username = `${token}_admin`;
  companyUser = { username, password: `Qc166-Acc-${runId}` };

  const companyName = `${token}_c`;
  const company = await prisma.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  });

  await createFixtureUser({
    data: {
      firstNames: `Qc166${runId.slice(0, 8)}`,
      lastNames: 'Acceso',
      birthDate: new Date('1990-01-01'),
      email: `${username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: 'CC',
      documentNumber: username,
      username,
      passwordHash: await createPasswordHash(companyUser.password),
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  });
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

test.describe('acceso del Maestro (QC-166 R43)', () => {
  test('el login del Maestro aterriza en Empresas con solo «Plataforma» en el menú (R43, R4, R2)', async ({
    page,
  }) => {
    const destination = await loginAndLand(page, maestroCredentials());
    expect(destination).toBe(MAESTRO_COMPANIES_ROUTE);

    await expect(page.getByTestId(COMPANIES_TITLE)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId(NAV_SECTION)).toHaveText([NAV_SECTION_PLATFORM]);
    for (const testId of MAESTRO_NAV_TESTIDS) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }
    expect(await navLinkTestIds(page)).toEqual([...MAESTRO_NAV_TESTIDS]);
  });

  test('una pantalla del ERP le responde al Maestro el 404 de la zona privada (R43, R1)', async ({
    page,
  }) => {
    await loginAndLand(page, maestroCredentials());

    const response = await page.goto(INVENTORY_ROUTE);
    expect(response?.status(), `${INVENTORY_ROUTE} para el Maestro`).toBe(404);
    await expect(page.getByTestId(NOT_FOUND)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId(PRIVATE_NAV)).toBeVisible();
    await expect(page.getByTestId(NAV_SECTION)).toHaveText([NAV_SECTION_PLATFORM]);
  });

  test('un usuario de empresa recibe el 404 en Empresas y no ve «Plataforma» (R43, R1, R3)', async ({
    page,
  }) => {
    await loginAndLand(page, companyUser);

    // Positivo sobre el mismo menú: sin él, un menú vacío daría el mismo verde.
    await expect(page.getByTestId('nav-inventario')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId(NAV_SECTION).filter({ hasText: NAV_SECTION_PLATFORM })).toHaveCount(0);
    for (const testId of MAESTRO_NAV_TESTIDS) {
      await expect(page.getByTestId(testId)).toHaveCount(0);
    }

    const response = await page.goto(MAESTRO_COMPANIES_ROUTE);
    expect(response?.status(), `${MAESTRO_COMPANIES_ROUTE} para un usuario de empresa`).toBe(404);
    await expect(page.getByTestId(NOT_FOUND)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId(COMPANIES_TITLE)).toHaveCount(0);
    await expect(page.getByTestId(NAV_SECTION).filter({ hasText: NAV_SECTION_PLATFORM })).toHaveCount(0);
  });

  test('el Maestro cierra sesión como cualquiera (R43)', async ({ page }) => {
    await loginAndLand(page, maestroCredentials());
    await expect(page.getByTestId(COMPANIES_TITLE)).toBeVisible({ timeout: 60_000 });

    await logoutLikeAnyone(page);
  });
});
