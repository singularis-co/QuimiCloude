/**
 * E2E del rediseño del dashboard, del recorrido de un pedido y del 404 privado.
 *
 * Solo estilo computado, medidas y estado del DOM, sin capturas: jsdom no compila la hoja de
 * Tailwind ni resuelve las consultas de contenedor, así que las tarjetas, las animaciones y las
 * medidas solo existen en un navegador real. Corre en chromium y en webkit (`playwright.config.ts`).
 *
 * FIXTURE (sembrado por Prisma, como `e2e/recorrido-ejecucion.spec.ts`): una empresa efímera con un
 * Administrador (rol real del seed, con `dashboard.consultar`), un pedido con varias anotaciones y
 * un retroceder, y otro con dos. Prefijo propio y `RUN_ID` por worker; limpieza de huérfanos por
 * prefijo y por edad, y la de `afterAll` solo por los identificadores de este worker.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Prisma } from '@prisma/client';

import {
  TRACE_ACTIONS_LABEL_PREFIX,
  TRACE_LINK_TEXT,
  TRACE_MENU_TITLE_PREFIX,
} from '@/app/(private)/dashboard/components/execution-trace-columns';
import { EXECUTION_TRACE_TABLE_TEXTS } from '@/app/(private)/dashboard/components/execution-trace-table';
import { ROLE_ADMINISTRADOR, normalizeCompanyName } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { formatOrderNumber } from '@/lib/modules/pedidos';
import { normalizeRecipeName } from '@/lib/modules/recetas';
import { prisma } from '@/lib/shared/db/prisma';
import { DASHBOARD_ROUTE, executionTraceRoute } from '@/lib/shared/routes';

import { enableAllAddons } from './helpers/addons';
import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';

const FIXTURE_PREFIX = 'qc261_e2e_';
const RUN_ID = randomUUID().replace(/-/g, '');
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;
const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const RECIPE_NAME = `${SHARED_TOKEN}_receta`;

const adminUser = {
  username: `${SHARED_TOKEN}_admin`,
  password: `Qc261-Admin-${RUN_ID.slice(0, 12)}`,
  firstNames: `Qc261A${RUN_ID.slice(0, 6)}`,
  lastNames: 'Administrador',
} as const;

const ORDER_QUANTITY = '3.0';
/** Alta y aleatoria: no choca con la serie del otro navegador en la misma base. */
const BASE_SEQUENCE = 800_000 + Math.floor(Math.random() * 90_000);
const ENTRY_SPACING_MS = 60 * 1000;

type EntryAction = 'START' | 'ADVANCE' | 'GO_BACK' | 'FINISH';
type EntrySpec = { readonly action: EntryAction; readonly step: number };

const ENTRIES_A: readonly EntrySpec[] = [
  { action: 'START', step: 1 },
  { action: 'ADVANCE', step: 2 },
  { action: 'GO_BACK', step: 1 },
  { action: 'ADVANCE', step: 2 },
  { action: 'FINISH', step: 2 },
];

const ENTRIES_B: readonly EntrySpec[] = [
  { action: 'START', step: 1 },
  { action: 'ADVANCE', step: 2 },
];

const WIDTHS = [390, 820, 1440] as const;
const VIEWPORT_HEIGHT = 900;
const MIN_TARGET_PX = 44;
const MIN_MENU_ITEM_PX = 48;
const MIN_FONT_PX = 16;
const STEP_STAGGER_MS = 40;
const CENTER_TOLERANCE_PX = 2;

const ENTER_ANIMATION = 'screen-enter';
const CLOSE_LABEL = 'Cerrar';

type SeededOrder = { readonly id: string; readonly numberText: string };

let companyId: string | null = null;
let orderA: SeededOrder | null = null;
let orderB: SeededOrder | null = null;

async function seedOrder(params: {
  readonly companyId: string;
  readonly recipeId: string;
  readonly unitId: string;
  readonly sequence: number;
  readonly status: 'EN_CURSO' | 'POR_EMPACAR';
}): Promise<SeededOrder> {
  // El CHECK `orders_order_year_matches_created_at` ata el año a `created_at`.
  const year = new Date().getUTCFullYear();
  const order = await prisma.order.create({
    data: {
      companyId: params.companyId,
      orderYear: year,
      orderSequence: params.sequence,
      recipeId: params.recipeId,
      quantity: ORDER_QUANTITY,
      unitId: params.unitId,
      status: params.status,
    },
    select: { id: true },
  });
  return { id: order.id, numberText: formatOrderNumber({ year, sequence: params.sequence }) };
}

async function seedEntries(
  ownerCompanyId: string,
  orderId: string,
  userId: string,
  entries: readonly EntrySpec[],
): Promise<void> {
  const start = Date.now() - (entries.length + 1) * ENTRY_SPACING_MS;
  await prisma.orderExecutionEntry.createMany({
    data: entries.map((entry, index) => ({
      companyId: ownerCompanyId,
      orderId,
      userId,
      action: entry.action,
      stepPosition: entry.step,
      occurredAt: new Date(start + index * ENTRY_SPACING_MS),
    })),
  });
}

/** En el orden que imponen las FK RESTRICT. */
async function deleteCompanyData(companyIds: readonly string[]): Promise<void> {
  if (companyIds.length === 0) return;
  const ids = [...companyIds];
  await prisma.orderExecutionEntry.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.orderAssignment.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.orderPresentationLine.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.order.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.recipe.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.user.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.company.deleteMany({ where: { id: { in: ids } } });
}

test.beforeAll(async () => {
  const adminRole = await prisma.role.findUnique({
    where: { name: ROLE_ADMINISTRADOR },
    select: { id: true },
  });
  if (!adminRole) {
    throw new Error(
      `falta el rol "${ROLE_ADMINISTRADOR}": este E2E no lo crea porque sus permisos son el dato ` +
        'bajo prueba. Siembra la base con `pnpm run db:seed` antes.',
    );
  }

  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  const orphans = await prisma.company.findMany({
    where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
    select: { id: true },
  });
  await deleteCompanyData(orphans.map((company) => company.id));

  companyId = (
    await prisma.company.create({
      data: { name: COMPANY_NAME, nameNormalized: normalizeCompanyName(COMPANY_NAME) },
      select: { id: true },
    })
  ).id;
  await enableAllAddons(companyId);

  const adminId = (
    await createFixtureUser({
      data: {
        firstNames: adminUser.firstNames,
        lastNames: adminUser.lastNames,
        birthDate: new Date('1990-01-01'),
        email: `${adminUser.username}@example.test`,
        phone: '+573000000000',
        documentTypeCode: 'CC',
        documentNumber: adminUser.username,
        username: adminUser.username,
        passwordHash: await createPasswordHash(adminUser.password),
        roleId: adminRole.id,
        companyId,
        accountStatus: 'active',
      },
      select: { id: true },
    })
  ).id;

  const unit = await prisma.unit.findFirstOrThrow({
    where: { nameNormalized: 'litro', companyId: null },
    select: { id: true },
  });
  const recipeId = (
    await prisma.recipe.create({
      data: {
        name: RECIPE_NAME,
        nameNormalized: normalizeRecipeName(RECIPE_NAME),
        createdBy: adminId,
        companyId,
        steps: [] as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
  ).id;

  const base = { companyId, recipeId, unitId: unit.id };
  orderA = await seedOrder({ ...base, sequence: BASE_SEQUENCE, status: 'POR_EMPACAR' });
  orderB = await seedOrder({ ...base, sequence: BASE_SEQUENCE + 1, status: 'EN_CURSO' });
  await seedEntries(companyId, orderA.id, adminId, ENTRIES_A);
  await seedEntries(companyId, orderB.id, adminId, ENTRIES_B);
});

test.afterAll(async () => {
  // Solo por los identificadores de ESTE worker: el otro navegador sigue corriendo.
  let fallo: unknown;
  try {
    await deleteCompanyData(companyId === null ? [] : [companyId]);
  } catch (error) {
    fallo = error;
  }
  await prisma.$disconnect();
  if (fallo !== undefined) throw fallo;
});

// El primer `goto` compila la ruta en `next dev`, y bcrypt tarda a propósito.
test.setTimeout(180_000);

function requireOrderA(): SeededOrder {
  if (!orderA || !orderB) throw new Error('el fixture no existe: falló el beforeAll');
  return orderA;
}

async function openDashboard(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await loginAndLand(page, adminUser);
  await page.goto(DASHBOARD_ROUTE);
  await expect(page.getByTestId('dashboard-title')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('data-table')).toBeVisible({ timeout: 60_000 });
}

async function openTrace(page: Page, order: SeededOrder): Promise<void> {
  const response = await page.goto(executionTraceRoute(order.id));
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId('execution-trace-title')).toContainText(order.numberText, {
    timeout: 60_000,
  });
}

function steps(page: Page): Locator {
  return page.getByTestId('execution-trace-timeline').locator('li[data-testid="execution-trace-step"]');
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found, 'el elemento no tiene caja').not.toBeNull();
  return found as NonNullable<typeof found>;
}

/**
 * Espera a que terminen las animaciones del elemento y de sus descendientes. El `Dialog` entra con
 * `zoom-in-96` (escala 0,96 → 1): medido a media animación, un ítem de 48 px da ~47.
 */
async function waitForAnimationsToSettle(locator: Locator): Promise<void> {
  await expect
    .poll(() =>
      locator.evaluate(
        (el) => el.getAnimations({ subtree: true }).filter((anim) => anim.playState === 'running').length,
      ),
    )
    .toBe(0);
}

async function expectTarget(locator: Locator, label: string, min = MIN_TARGET_PX): Promise<void> {
  await expect(locator).toBeVisible();
  const found = await box(locator);
  expect(found.width, label).toBeGreaterThanOrEqual(min);
  expect(found.height, label).toBeGreaterThanOrEqual(min);
}

async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, label).toBeLessThanOrEqual(clientWidth);
}

/** Chromium y WebKit serializan los tiempos en segundos; se normaliza a milisegundos. */
function toMs(value: string): number {
  const amount = Number.parseFloat(value);
  return value.trim().endsWith('ms') ? amount : Math.round(amount * 1000);
}

test.describe('R8 — la lista en tarjetas a 390 px', () => {
  test('R8 — a 390 px cada pedido es una tarjeta; «Acciones» abre el menú centrado, al cerrarlo el foco vuelve al disparador y «Ver recorrido» lleva al detalle', async ({
    page,
  }) => {
    const a = requireOrderA();
    await openDashboard(page, 390);

    await expect(page.getByTestId('data-table-cards')).toBeVisible();
    await expect(page.locator('[data-testid^="data-table-row-"]').filter({ visible: true })).toHaveCount(0);

    const cardA = page.getByTestId(`data-table-card-${a.id}`);
    await expect(cardA).toBeVisible();
    await expect(cardA).toContainText(a.numberText);

    const trigger = cardA.getByRole('button', { name: `${TRACE_ACTIONS_LABEL_PREFIX}${a.numberText}` });
    await expect(trigger).toBeVisible();
    expect((await box(trigger)).height).toBeGreaterThanOrEqual(MIN_TARGET_PX);

    const dialog = page.getByRole('dialog');
    // En WebKit un clic antes de hidratar se pierde sin error: se repite hasta que el menú abre.
    await expect(async () => {
      if ((await dialog.count()) === 0) await trigger.click();
      await expect(dialog).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });

    await expect(dialog).toHaveAccessibleName(`${TRACE_MENU_TITLE_PREFIX}${a.numberText}`);
    const close = dialog.getByRole('button', { name: CLOSE_LABEL, exact: true });
    await expect(close).toBeVisible();
    const item = dialog.getByRole('link', { name: TRACE_LINK_TEXT, exact: true });
    await expect(item).toBeVisible();
    // Las medidas dentro del diálogo, con la animación de entrada ya terminada.
    await waitForAnimationsToSettle(dialog);
    expect((await box(item)).height).toBeGreaterThanOrEqual(MIN_MENU_ITEM_PX);

    const viewport = page.viewportSize() as NonNullable<ReturnType<Page['viewportSize']>>;
    await expect
      .poll(async () => {
        const found = await box(dialog);
        const horizontal = Math.abs(found.x - (viewport.width - (found.x + found.width)));
        const vertical = Math.abs(found.y - (viewport.height - (found.y + found.height)));
        return Math.max(horizontal, vertical);
      })
      .toBeLessThanOrEqual(CENTER_TOLERANCE_PX);

    await close.click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await expect(async () => {
      if ((await dialog.count()) === 0) await trigger.click();
      await expect(dialog).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    await dialog.getByRole('link', { name: TRACE_LINK_TEXT, exact: true }).click();
    await page.waitForURL((url) => url.pathname === executionTraceRoute(a.id), { timeout: 60_000 });
    await expect(page.getByTestId('execution-trace-title')).toContainText(a.numberText, {
      timeout: 60_000,
    });
  });
});

test.describe('R16 — entrada de las anotaciones', () => {
  test('R16 — las anotaciones entran con screen-enter una sola vez, escalonadas 40 ms por posición', async ({
    page,
  }) => {
    const a = requireOrderA();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openDashboard(page, 1440);
    await openTrace(page, a);

    await expect(steps(page)).toHaveCount(ENTRIES_A.length);
    const entering = await steps(page).evaluateAll((items) =>
      items.map((item) => {
        const style = window.getComputedStyle(item);
        return {
          name: style.animationName,
          delay: style.animationDelay,
          iterations: style.animationIterationCount,
        };
      }),
    );

    const delays = entering.map((step) => toMs(step.delay));
    expect(delays).toEqual(ENTRIES_A.map((_, index) => index * STEP_STAGGER_MS));
    for (const step of entering) {
      expect(step.name).toBe(ENTER_ANIMATION);
      expect(step.iterations).toBe('1');
    }
  });

  test('R16 — con movimiento reducido las anotaciones salen sin animación ni desplazamiento', async ({
    page,
  }) => {
    const a = requireOrderA();
    // Antes de navegar, para que la consulta de medios ya esté resuelta en el primer pintado.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openDashboard(page, 1440);
    await openTrace(page, a);

    await expect(steps(page)).toHaveCount(ENTRIES_A.length);
    const still = await steps(page).evaluateAll((items) =>
      items.map((item) => {
        const style = window.getComputedStyle(item);
        return {
          name: style.animationName,
          transform: style.transform,
          opacity: style.opacity,
          running: item.getAnimations().length,
        };
      }),
    );
    for (const step of still) {
      expect(step).toEqual({ name: 'none', transform: 'none', opacity: '1', running: 0 });
    }
  });
});

for (const width of WIDTHS) {
  test.describe(`R20 — a ${width} px`, () => {
    test(`R20 — a ${width} px el dashboard, el recorrido y el 404 privado no desbordan en horizontal, sus controles miden 44 px y el buscador tiene 16 px de letra`, async ({
      page,
    }) => {
      const a = requireOrderA();
      await openDashboard(page, width);

      await expectNoHorizontalScroll(page, `dashboard a ${width} px`);

      const search = page.getByRole('searchbox', { name: EXECUTION_TRACE_TABLE_TEXTS.search });
      await expect(search).toBeVisible();
      const fontSize = await search.evaluate((element) =>
        Number.parseFloat(window.getComputedStyle(element).fontSize),
      );
      expect(fontSize).toBeGreaterThanOrEqual(MIN_FONT_PX);

      const triggers = page.getByTestId('execution-trace-actions').filter({ visible: true });
      await expect(triggers).toHaveCount(2);
      for (const trigger of await triggers.all()) {
        await expectTarget(trigger, `disparador de acciones a ${width} px`);
      }
      await expectTarget(
        page.getByTestId('execution-trace-cancelled-only'),
        `casilla «Solo cancelados» a ${width} px`,
      );

      await openTrace(page, a);
      await expect(steps(page)).toHaveCount(ENTRIES_A.length);
      await expectNoHorizontalScroll(page, `recorrido a ${width} px`);
      await expectTarget(page.getByTestId('execution-trace-back'), `«Volver» a ${width} px`);

      const missing = await page.goto(executionTraceRoute(randomUUID()));
      expect(missing?.status()).toBe(404);
      await expect(page.getByTestId('private-not-found')).toBeVisible({ timeout: 60_000 });
      await expectNoHorizontalScroll(page, `404 privado a ${width} px`);
    });
  });
}
