/**
 * E2E del rediseño de las pantallas del operario: ejecución, empaque y acondicionamiento de un
 * pedido, y su tablero `/asignacion`.
 *
 * Solo estilo computado, medidas y estado del DOM, sin capturas: jsdom no aplica `:has()`, no
 * compila la hoja de Tailwind ni resuelve las consultas de contenedor, así que el marco sin barra
 * lateral, las columnas, las tarjetas y el anillo que se vacía solo existen en un navegador real.
 *
 * Ningún caso confirma un diálogo: se abren y se cierran, así que los pedidos sembrados no cambian
 * de estado y los casos pueden correr en cualquier orden y en paralelo.
 *
 * FIXTURE (sembrado por Prisma): una empresa efímera por worker con un Operador, un Empacador y un
 * acondicionador (roles reales del seed: sus permisos deciden qué ve cada uno) y un pedido en cada
 * estado que abre una pantalla o un diálogo. Prefijo propio y `RUN_ID` por worker; limpieza de
 * huérfanos por prefijo y por edad, y la de `afterAll` solo por los identificadores de este worker.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Prisma } from '@prisma/client';

import {
  DOCUMENT_TYPE_CC,
  normalizeCompanyName,
  ROLE_ACONDICIONAMIENTO,
  ROLE_EMPACADOR,
  ROLE_OPERADOR,
} from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizeProductName } from '@/lib/modules/inventario';
import { formatOrderNumber } from '@/lib/modules/pedidos';
import { normalizeRecipeName, type RecipeStepDocument } from '@/lib/modules/recetas';
import { prisma } from '@/lib/shared/db/prisma';
import {
  ASSIGNED_ORDERS_ROUTE,
  CONDITIONED_ORDER_PARAM,
  assignedOrderRoute,
  conditioningOrderRoute,
  packingOrderRoute,
} from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import {
  DESKTOP,
  EDGE_TOLERANCE_PX,
  MIN_FOOTER_BUTTON_PX,
  OPERATOR_FOOTER,
  OPERATOR_HEADER,
  PHONE,
  box,
  clickUntilVisible,
  deleteCompanyData,
  expectTarget,
  gridTracks,
  openScreen,
  rectsOverlap,
  waitForAnimationsToSettle,
  waitForScreenEnterToSettle,
  type Rect,
} from './helpers/operario';

const FIXTURE_PREFIX = 'qc265_e2e_';
const RUN_ID = randomUUID().replace(/-/g, '');
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;
const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const RECIPE_NAME = `${SHARED_TOKEN}_receta`;

type Credentials = { readonly username: string; readonly password: string };

function credentials(suffix: string, label: string): Credentials {
  return {
    username: `${SHARED_TOKEN}_${suffix}`,
    password: `Qc265-${label}-${RUN_ID.slice(0, 12)}`,
  };
}

const operatorUser = credentials('operador', 'Operador');
const packerUser = credentials('empacador', 'Empacador');
const conditionerUser = credentials('acond', 'Acond');
const ALL_USERS = [operatorUser, packerUser, conditionerUser];

const LAST_NAMES_BY_USERNAME: Readonly<Record<string, string>> = {
  [operatorUser.username]: 'Operador',
  [packerUser.username]: 'Empacador',
  [conditionerUser.username]: 'Acondiciona',
};
const firstNames = `Qc265${RUN_ID.slice(0, 8)}`;

const ORDER_QUANTITY = '3.0';
/** Alta y aleatoria: no choca con la serie del otro navegador en la misma base. */
const BASE_SEQUENCE = 700_000 + Math.floor(Math.random() * 90_000);

/** Un único paso con una casilla: Finalizar queda a la vista en el primer paso. */
const RECIPE_STEPS: readonly RecipeStepDocument[] = [
  {
    blocks: [
      {
        kind: 'checklist',
        items: [{ spans: [{ text: `${SHARED_TOKEN}_verificar` }] }],
      },
    ],
  },
];

/**
 * QC-269: receta «muchos materiales». Con 24 líneas el panel lateral es más alto que el lector más
 * su reserva, que es cuando su final quedaba bajo el pie fijo.
 */
const MANY_LINES = 24;
const MANY_RECIPE_NAME = `${SHARED_TOKEN}_receta_muchos`;
/** 23 × 4,00 + 8,00 = 100,00. */
const MANY_LINE_PERCENTAGE = '4.00';
const MANY_LAST_LINE_PERCENTAGE = '8.00';
/** Más de 20 caracteres: sin `break-words` se sale de la caja del nombre y pisa al porcentaje. */
const LONG_WORD = 'Polihidroxietilcelulosaestabilizada';

function manyLineProductName(index: number): string {
  const head = index === 0 ? LONG_WORD : 'Lauril éter sulfato de sodio';
  return `${head} grado industrial de alta pureza ${index + 1}`;
}

/** QC-269: receta «paso largo». Un solo paso con 30 casillas, más alto que la ventana. */
const LONG_STEP_ITEMS = 30;
const LONG_STEP_RECIPE_NAME = `${SHARED_TOKEN}_receta_paso_largo`;
const LONG_STEP_PRODUCT_NAME = `${SHARED_TOKEN}_producto_paso_largo`;
const LONG_RECIPE_STEPS: readonly RecipeStepDocument[] = [
  {
    blocks: [
      {
        kind: 'checklist',
        items: Array.from({ length: LONG_STEP_ITEMS }, (_, itemIndex) => ({
          spans: [{ text: `${SHARED_TOKEN}_comprobar ${itemIndex + 1}` }],
        })),
      },
    ],
  },
];
const LAST_LONG_STEP_ITEM = `step-reader-item-0-${LONG_STEP_ITEMS - 1}`;

const TABLET = { width: 820, height: 1180 } as const;
const PANEL_TRACK = '320px';
const OPERATOR_SCROLL = '[data-slot="operator-scroll"]';
const CENTER_TOLERANCE_PX = 2;
const CONDITIONING_WAIT_MS = 5_000;

/** Copias locales: los módulos que los exportan son de cliente y arrastrarían React al runner. */
const TESTIDS = {
  asignacionTitle: 'asignacion-title',
  privateContent: 'private-content',
  privateHeader: 'private-header',
  privateNotFound: 'private-not-found',
  themeToggle: 'theme-toggle-trigger',
  executionScreen: 'order-execution-screen',
  executionActions: 'order-execution-actions',
  executionMaterials: 'order-execution-materials',
  executionMaterialsFab: 'order-execution-materials-fab',
  materialsSidePanel: 'operator-side-panel-materials',
  sidePanelBody: 'operator-side-panel-body',
  stepChecklistItem: 'step-reader-item-0-0',
  stepFinish: 'step-reader-finish',
  packingScreen: 'packing-order-screen',
  packingBack: 'packing-order-back-link',
  packingColumn: 'packing-order-sections',
  packingPackagesFab: 'packing-order-packages-fab',
  packingStart: 'packing-order-start-button',
  packingFinish: 'packing-order-finish-button',
  conditioningScreen: 'conditioning-order-screen',
  conditioningBack: 'conditioning-order-back-link',
  conditioningColumn: 'conditioning-order-sections',
  conditioningPackagesFab: 'conditioning-order-packages-fab',
  conditioningTeamFab: 'conditioning-order-team-fab',
  conditioningStart: 'conditioning-start-button',
  conditioningFinish: 'conditioning-finish-button',
  conditioningSection: 'conditioning-orders-list-section',
  conditionedNotice: 'conditioned-order-notice',
  conditionedNoticeClose: 'conditioned-order-notice-close',
  assignedEnter: 'assigned-order-enter',
  rowActions: 'assignment-row-actions',
  rowEnter: 'assignment-row-enter',
  cards: 'data-table-cards',
  countdownButton: 'countdown-gated-button',
  countdownRing: 'countdown-ring',
  assignedEnterReason: 'assigned-order-enter-reason',
  executionLine: 'order-execution-line',
  // Literal como el resto de TESTIDS; el unit de `order-execution-lines` fija el valor de la
  // constante, así que una deriva la detecta Vitest.
  executionLineName: 'order-execution-line-name',
  executionLinePercentage: 'order-execution-line-percentage',
  executionLineQuantity: 'order-execution-line-quantity',
} as const;

const TAB_TESTIDS = {
  porAcondicionar: 'assignment-view-tab-por_acondicionar',
  acondicionados: 'assignment-view-tab-acondicionados',
  entregados: 'assignment-view-tab-acondicionados_entregados',
} as const;

const SIDEBAR = '[data-slot="sidebar"]';
const TAB_COUNT = '[data-slot="url-tabs-count"]';
const RING_PROGRESS = '[data-slot="countdown-ring-progress"]';
const TABLE_ROWS = '[data-testid^="data-table-row-"]';

type SeededOrder = { readonly id: string; readonly numberText: string };
type SeededOrders = {
  /** PENDIENTE del Operador: «Entrar» pide comenzar. */
  readonly execPending: SeededOrder;
  /** EN_CURSO del Operador: la pantalla de ejecución. */
  readonly execRunning: SeededOrder;
  readonly packTodo: SeededOrder;
  /** EN_EMPAQUE del Empacador, sin pasos de envasado: «Terminar» abre su confirmación. */
  readonly packRunning: SeededOrder;
  readonly condTodo: SeededOrder;
  /** EN_ACONDICIONAMIENTO del acondicionador, con equipo y sin reparto: «Terminar» habilitado. */
  readonly condRunning: SeededOrder;
  /** TERMINADO del acondicionador: el único de «Acondicionados». */
  readonly condDone: SeededOrder;
  /** QC-269: EN_CURSO del Operador con la receta «muchos materiales». */
  readonly execMany: SeededOrder;
  /** QC-269: EN_CURSO del Operador con la receta «paso largo». */
  readonly execLongStep: SeededOrder;
  /** QC-269: BLOQUEADO del Operador: «Entrar» deshabilitado con su aviso. */
  readonly execBlocked: SeededOrder;
};

let companyId: string | null = null;
let orders: SeededOrders | null = null;

function seeded(): SeededOrders {
  if (orders === null) throw new Error('el fixture no existe: falló el beforeAll');
  return orders;
}

async function createUser(user: Credentials, roleId: string): Promise<string> {
  if (!companyId) throw new Error('la empresa del fixture no existe: falló el beforeAll');
  const created = await createFixtureUser({
    data: {
      firstNames,
      lastNames: LAST_NAMES_BY_USERNAME[user.username] ?? 'Fixture',
      birthDate: new Date('1990-01-01'),
      email: `${user.username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: user.username,
      username: user.username,
      passwordHash: await createPasswordHash(user.password),
      roleId,
      companyId,
      // Explícito: la columna es `@default(pending)` y ese estado no entra por el login.
      accountStatus: 'active',
    },
    select: { id: true },
  });
  return created.id;
}

test.beforeAll(async () => {
  const roles = new Map<string, string>();
  for (const roleName of [ROLE_OPERADOR, ROLE_EMPACADOR, ROLE_ACONDICIONAMIENTO]) {
    const role = await prisma.role.findUnique({ where: { name: roleName }, select: { id: true } });
    if (!role) {
      throw new Error(
        `falta el rol "${roleName}": este E2E no lo crea porque sus permisos son el dato bajo ` +
          'prueba. Siembra la base con `pnpm run db:seed` antes.',
      );
    }
    roles.set(roleName, role.id);
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

  const operatorId = await createUser(operatorUser, roles.get(ROLE_OPERADOR)!);
  const packerId = await createUser(packerUser, roles.get(ROLE_EMPACADOR)!);
  const conditionerId = await createUser(conditionerUser, roles.get(ROLE_ACONDICIONAMIENTO)!);

  const unit = await prisma.unit.findFirstOrThrow({
    where: { nameNormalized: 'litro', companyId: null },
    select: { id: true },
  });
  const recipeId = (
    await prisma.recipe.create({
      data: {
        name: RECIPE_NAME,
        nameNormalized: normalizeRecipeName(RECIPE_NAME),
        createdBy: operatorId,
        companyId,
        steps: RECIPE_STEPS as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
  ).id;

  // QC-269: los materiales de las dos recetas nuevas. Con la unidad del pedido, para que cada
  // fila pinte su cantidad. Los `id` se fijan aquí porque `createMany` no los devuelve.
  const manyProductIds = Array.from({ length: MANY_LINES }, () => randomUUID());
  const longStepProductId = randomUUID();
  await prisma.product.createMany({
    data: [
      ...manyProductIds.map((id, index) => ({ id, name: manyLineProductName(index) })),
      { id: longStepProductId, name: LONG_STEP_PRODUCT_NAME },
    ].map((product) => ({
      ...product,
      nameNormalized: normalizeProductName(product.name),
      unitId: unit.id,
      companyId: companyId!,
    })),
  });
  // Las líneas por `INSERT` directo, como `e2e/ejecucion-receta.spec.ts`: no pasan por el
  // servicio, así que la suma de 100 % no la valida nadie.
  const manyRecipeId = (
    await prisma.recipe.create({
      data: {
        name: MANY_RECIPE_NAME,
        nameNormalized: normalizeRecipeName(MANY_RECIPE_NAME),
        createdBy: operatorId,
        companyId,
        steps: RECIPE_STEPS as unknown as Prisma.InputJsonValue,
        lines: {
          create: manyProductIds.map((productId, index) => ({
            productId,
            percentage: index === MANY_LINES - 1 ? MANY_LAST_LINE_PERCENTAGE : MANY_LINE_PERCENTAGE,
          })),
        },
      },
      select: { id: true },
    })
  ).id;
  const longStepRecipeId = (
    await prisma.recipe.create({
      data: {
        name: LONG_STEP_RECIPE_NAME,
        nameNormalized: normalizeRecipeName(LONG_STEP_RECIPE_NAME),
        createdBy: operatorId,
        companyId,
        steps: LONG_RECIPE_STEPS as unknown as Prisma.InputJsonValue,
        lines: { create: [{ productId: longStepProductId, percentage: '100.00' }] },
      },
      select: { id: true },
    })
  ).id;

  // El CHECK `orders_order_year_matches_created_at` ata el año a `created_at`; los de `packed_by`
  // y `conditioned_by` piden quién empacó y quién acondiciona según el estado.
  const year = new Date().getUTCFullYear();
  async function seedOrder(
    offset: number,
    data: {
      readonly status: NonNullable<Prisma.OrderUncheckedCreateInput['status']>;
      readonly packedBy?: string;
      readonly conditionedBy?: string;
      readonly finishedAt?: Date;
      readonly recipeId?: string;
    },
  ): Promise<SeededOrder> {
    const sequence = BASE_SEQUENCE + offset;
    const order = await prisma.order.create({
      data: {
        companyId: companyId!,
        orderYear: year,
        orderSequence: sequence,
        recipeId: data.recipeId ?? recipeId,
        quantity: ORDER_QUANTITY,
        unitId: unit.id,
        status: data.status,
        packedBy: data.packedBy ?? null,
        conditionedBy: data.conditionedBy ?? null,
        finishedAt: data.finishedAt ?? null,
      },
      select: { id: true },
    });
    return { id: order.id, numberText: formatOrderNumber({ year, sequence }) };
  }

  const finishedAt = new Date();
  const seededOrders: SeededOrders = {
    execPending: await seedOrder(0, { status: 'PENDIENTE' }),
    execRunning: await seedOrder(1, { status: 'EN_CURSO' }),
    packTodo: await seedOrder(2, { status: 'POR_EMPACAR' }),
    packRunning: await seedOrder(3, { status: 'EN_EMPAQUE', packedBy: packerId }),
    condTodo: await seedOrder(4, { status: 'POR_ACONDICIONAR', packedBy: packerId }),
    condRunning: await seedOrder(5, {
      status: 'EN_ACONDICIONAMIENTO',
      packedBy: packerId,
      conditionedBy: conditionerId,
    }),
    condDone: await seedOrder(6, {
      status: 'TERMINADO',
      packedBy: packerId,
      conditionedBy: conditionerId,
      finishedAt,
    }),
    execMany: await seedOrder(7, { status: 'EN_CURSO', recipeId: manyRecipeId }),
    execLongStep: await seedOrder(8, { status: 'EN_CURSO', recipeId: longStepRecipeId }),
    // El CHECK de `conditioned_by` admite BLOQUEADO sin él.
    execBlocked: await seedOrder(9, { status: 'BLOQUEADO' }),
  };

  await prisma.orderAssignment.createMany({
    data: [
      seededOrders.execPending,
      seededOrders.execRunning,
      seededOrders.execMany,
      seededOrders.execLongStep,
      seededOrders.execBlocked,
    ].map((order) => ({
      orderId: order.id,
      userId: operatorId,
      companyId: companyId!,
    })),
  });
  await prisma.orderConditioningTeamMember.create({
    data: {
      orderId: seededOrders.condRunning.id,
      userId: conditionerId,
      companyId,
      position: 0,
    },
  });

  orders = seededOrders;
});

test.afterAll(async () => {
  // Solo la empresa de ESTE worker: el otro navegador sigue corriendo.
  const primerFallo = companyId === null ? undefined : await deleteCompanyData([companyId]);
  await prisma.user
    .deleteMany({ where: { username: { in: ALL_USERS.map((user) => user.username) } } })
    .catch(() => undefined);
  await prisma.$disconnect();
  if (primerFallo !== undefined) throw primerFallo;
});

// El primer `goto` compila la ruta en `next dev`, y bcrypt tarda a propósito.
test.setTimeout(180_000);

/** El conjunto de pestañas va en `Suspense`: mientras llega el contador conviven dos copias. */
function viewTab(page: Page, testId: string): Locator {
  return page.getByTestId(testId).filter({ visible: true });
}

function visibleSidebar(page: Page): Locator {
  return page.locator(SIDEBAR).filter({ visible: true });
}

async function expectCenteredAndWhole(page: Page, dialog: Locator, label: string): Promise<void> {
  await waitForAnimationsToSettle(dialog);
  const viewport = page.viewportSize() as NonNullable<ReturnType<Page['viewportSize']>>;
  const found = await box(dialog);
  expect(found.x, `${label}: borde izquierdo`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
  expect(found.y, `${label}: borde superior`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
  expect(found.x + found.width, `${label}: borde derecho`).toBeLessThanOrEqual(viewport.width + EDGE_TOLERANCE_PX);
  expect(found.y + found.height, `${label}: borde inferior`).toBeLessThanOrEqual(
    viewport.height + EDGE_TOLERANCE_PX,
  );
  const horizontal = Math.abs(found.x - (viewport.width - (found.x + found.width)));
  const vertical = Math.abs(found.y - (viewport.height - (found.y + found.height)));
  expect(horizontal, `${label}: centrado en horizontal`).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
  expect(vertical, `${label}: centrado en vertical`).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
}

type DialogCheck = {
  readonly label: string;
  readonly dialog: string;
  readonly dismiss: string;
  readonly confirm: string;
};

/** Diálogo entero, centrado y con botones de 44 px; se cierra sin confirmar. */
async function expectOperatorDialog(page: Page, check: DialogCheck): Promise<void> {
  const dialog = page.getByTestId(check.dialog);
  await expectCenteredAndWhole(page, dialog, check.label);
  await expectTarget(dialog.getByTestId(check.dismiss), `${check.label}: cancelar`);
  await expectTarget(dialog.getByTestId(check.confirm), `${check.label}: confirmar`);
  await dialog.getByTestId(check.dismiss).click();
  await expect(dialog).toHaveCount(0);
}

type ScreenCase = {
  readonly name: string;
  readonly user: Credentials;
  readonly url: (orders: SeededOrders) => string;
  /** Quién pide qué para recibir el 404 de la pantalla, el de hoy. */
  readonly notFound: { readonly user: Credentials; readonly url: (orders: SeededOrders) => string };
  readonly screen: string;
};

const SCREENS: readonly ScreenCase[] = [
  {
    name: 'la ejecución',
    user: operatorUser,
    url: (seededOrders) => assignedOrderRoute(seededOrders.execRunning.id),
    // Un pedido que no existe pinta el error dentro de la pantalla; el 404 es el de quien no tiene
    // `asignaciones.ejecutar`.
    notFound: { user: packerUser, url: (seededOrders) => assignedOrderRoute(seededOrders.execRunning.id) },
    screen: TESTIDS.executionScreen,
  },
  {
    name: 'el empaque',
    user: packerUser,
    url: (seededOrders) => packingOrderRoute(seededOrders.packTodo.id),
    notFound: { user: packerUser, url: () => packingOrderRoute(randomUUID()) },
    screen: TESTIDS.packingScreen,
  },
  {
    name: 'el acondicionamiento',
    user: conditionerUser,
    url: (seededOrders) => conditioningOrderRoute(seededOrders.condRunning.id),
    notFound: { user: conditionerUser, url: () => conditioningOrderRoute(randomUUID()) },
    screen: TESTIDS.conditioningScreen,
  },
];

for (const screenCase of SCREENS) {
  test.describe(`R1, R5, R6 — ${screenCase.name}`, () => {
    test(`R1, R5, R6 — ${screenCase.name} se pinta sin barra lateral ni cabecera privada y a todo el ancho; su 404 y /asignacion las conservan`, async ({
      page,
    }) => {
      const seededOrders = seeded();
      await page.setViewportSize(DESKTOP);
      await loginAndLand(page, screenCase.user);

      await page.goto(ASSIGNED_ORDERS_ROUTE);
      await expect(page.getByTestId(TESTIDS.asignacionTitle)).toBeVisible({ timeout: 60_000 });
      await expect(visibleSidebar(page)).toHaveCount(1);
      await expect(page.getByTestId(TESTIDS.privateHeader)).toBeVisible();
      expect((await box(page.getByTestId(TESTIDS.privateContent))).x).toBeGreaterThan(0);

      await openScreen(page, screenCase.url(seededOrders), screenCase.screen);
      await expect(visibleSidebar(page)).toHaveCount(0);
      await expect(page.getByTestId(TESTIDS.privateHeader)).toBeHidden();
      const content = await box(page.getByTestId(TESTIDS.privateContent));
      expect(content.x).toBe(0);
      expect(content.width).toBeGreaterThanOrEqual(DESKTOP.width - EDGE_TOLERANCE_PX);

      if (screenCase.notFound.user !== screenCase.user) {
        await page.context().clearCookies();
        await loginAndLand(page, screenCase.notFound.user);
      }
      const missing = await page.goto(screenCase.notFound.url(seededOrders));
      expect(missing?.status()).toBe(404);
      await expect(page.getByTestId(TESTIDS.privateNotFound)).toBeVisible({ timeout: 60_000 });
      await expect(visibleSidebar(page)).toHaveCount(1);
      await expect(page.getByTestId(TESTIDS.privateHeader)).toBeVisible();
      expect((await box(page.getByTestId(TESTIDS.privateContent))).x).toBeGreaterThan(0);
    });
  });
}

type FrameCase = ScreenCase & {
  /** Los controles de la cabecera y del cuerpo que deben medir 44 × 44. */
  readonly controls: readonly string[];
  /** Los que no deben estar: con el pedido comenzado por el actor, la cabecera no lleva la vuelta. */
  readonly absent?: readonly string[];
};

// Los pedidos de `SCREENS`: la ejecución y el acondicionamiento, comenzados por el actor; el
// empaque, sin comenzar.
const FRAMES: readonly FrameCase[] = [
  {
    ...SCREENS[0]!,
    controls: [TESTIDS.themeToggle, TESTIDS.executionActions, TESTIDS.executionMaterialsFab],
  },
  {
    ...SCREENS[1]!,
    controls: [TESTIDS.themeToggle, TESTIDS.packingBack, TESTIDS.packingPackagesFab],
  },
  {
    ...SCREENS[2]!,
    controls: [TESTIDS.themeToggle, TESTIDS.conditioningPackagesFab, TESTIDS.conditioningTeamFab],
    absent: [TESTIDS.conditioningBack],
  },
];

for (const frame of FRAMES) {
  test.describe(`R2, R3 — ${frame.name} a 390 × 844`, () => {
    test(`R2, R3 — a 390 × 844 ${frame.name} tiene la cabecera pegada arriba con un único h1 y «Cambiar tema», el pie abajo, fuera de la zona con scroll, con botones de 52 px y controles de 44 × 44`, async ({
      page,
    }) => {
      const seededOrders = seeded();
      await page.setViewportSize(PHONE);
      await loginAndLand(page, frame.user);
      const screen = await openScreen(page, frame.url(seededOrders), frame.screen);
      await waitForScreenEnterToSettle(page);

      const header = screen.locator(OPERATOR_HEADER);
      await expect(header).toBeVisible();
      expect(await header.evaluate((el) => window.getComputedStyle(el).position)).toBe('sticky');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(header.locator('h1')).toHaveCount(1);
      await expect(header.getByTestId(TESTIDS.themeToggle)).toBeVisible();

      const footer = screen.locator(OPERATOR_FOOTER);
      await expect(footer).toBeVisible();
      // El pie ya no es `fixed`: es la última fila del marco, fuera de la zona que se desplaza.
      const zone = screen.locator(OPERATOR_SCROLL);
      expect(await zone.evaluate((el) => window.getComputedStyle(el).overflowY)).toMatch(/^(auto|scroll)$/);
      expect(
        await footer.evaluate((el, selector) => el.closest(selector) === null, OPERATOR_SCROLL),
        'el pie no está dentro de la zona con scroll',
      ).toBe(true);

      await zone.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      expect(
        await page.evaluate(() => (document.scrollingElement as HTMLElement).scrollTop),
        'el documento no se desplaza',
      ).toBe(0);
      await expect
        .poll(async () => Math.abs((await box(header)).y))
        .toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      const footerBox = await box(footer);
      expect(Math.abs(footerBox.y + footerBox.height - PHONE.height)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);

      const footerButtons = footer.locator('button').filter({ visible: true });
      expect(await footerButtons.count()).toBeGreaterThan(0);
      for (const button of await footerButtons.all()) {
        await expectTarget(button, `botón del pie de ${frame.name}`, MIN_FOOTER_BUTTON_PX);
      }
      for (const control of frame.controls) {
        await expectTarget(screen.getByTestId(control), `${control} en ${frame.name}`);
      }
      for (const control of frame.absent ?? []) {
        await expect(screen.getByTestId(control), `${control} no está en ${frame.name}`).toHaveCount(0);
      }
    });
  });
}

type ColumnsCase = ScreenCase & {
  /** La columna lateral de la pantalla: su rejilla es la que pasa de dos pistas a una. */
  readonly anchor: (screen: Locator) => Locator;
};

const COLUMNS: readonly ColumnsCase[] = [
  {
    ...SCREENS[0]!,
    anchor: (screen) => screen.getByTestId(TESTIDS.executionMaterials),
  },
  {
    ...SCREENS[1]!,
    anchor: (screen) => screen.getByTestId(TESTIDS.packingColumn),
  },
  {
    ...SCREENS[2]!,
    anchor: (screen) => screen.getByTestId(TESTIDS.conditioningColumn),
  },
];

for (const columns of COLUMNS) {
  test.describe(`R4 — ${columns.name}`, () => {
    test(`R4 — ${columns.name} pinta dos columnas a 1440 px y una sola a 820 px`, async ({ page }) => {
      const seededOrders = seeded();
      await page.setViewportSize(DESKTOP);
      await loginAndLand(page, columns.user);
      const screen = await openScreen(page, columns.url(seededOrders), columns.screen);
      const anchor = columns.anchor(screen);
      await expect(anchor).toBeVisible();

      await expect.poll(async () => (await gridTracks(anchor)).length).toBe(2);
      expect((await gridTracks(anchor))[0]).toBe(PANEL_TRACK);
      // La columna lateral va a la izquierda y el contenido del pedido, a su derecha.
      const contentBox = await anchor.evaluate((el) => {
        const sibling = el.nextElementSibling;
        if (sibling === null) return null;
        const found = sibling.getBoundingClientRect();
        return { x: found.x, y: found.y, width: found.width, height: found.height };
      });
      expect(contentBox, 'hay contenido junto a la columna').not.toBeNull();
      const columnBox = await box(anchor);
      expect(Math.abs(columnBox.y - contentBox!.y), 'columna y contenido lado a lado').toBeLessThanOrEqual(
        EDGE_TOLERANCE_PX,
      );
      expect(contentBox!.x).toBeGreaterThan(columnBox.x + columnBox.width - EDGE_TOLERANCE_PX);

      await page.setViewportSize(TABLET);
      await expect.poll(async () => (await gridTracks(anchor)).length).toBe(1);
    });
  });
}

test.describe('R9 — contadores de las pestañas', () => {
  test('R9 — cada pestaña del acondicionador muestra junto a su etiqueta el total de su vista', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await loginAndLand(page, conditionerUser);
    await page.goto(ASSIGNED_ORDERS_ROUTE);
    await expect(page.getByTestId(TESTIDS.asignacionTitle)).toBeVisible({ timeout: 60_000 });

    const expected: ReadonlyArray<readonly [string, string, string]> = [
      [TAB_TESTIDS.porAcondicionar, 'Por acondicionar', '2'],
      [TAB_TESTIDS.acondicionados, 'Acondicionados', '1'],
      [TAB_TESTIDS.entregados, 'Entregados', '0'],
    ];
    for (const [testId, label, count] of expected) {
      const tab = viewTab(page, testId);
      await expect(tab.locator(TAB_COUNT)).toHaveText(count, { timeout: 60_000 });
      await expect(tab).toContainText(label);
    }
  });
});

test.describe('R15 — cerrar un aviso', () => {
  test('R15 — «Cerrar» de 44 × 44 oculta el aviso de acondicionado sin navegar ni recargar la lista', async ({
    page,
  }) => {
    const { condDone } = seeded();
    await page.setViewportSize(DESKTOP);
    await loginAndLand(page, conditionerUser);
    const query = new URLSearchParams({ vista: 'por_acondicionar', [CONDITIONED_ORDER_PARAM]: condDone.numberText });
    await page.goto(`${ASSIGNED_ORDERS_ROUTE}?${query.toString()}`);

    const notice = page.getByTestId(TESTIDS.conditionedNotice);
    await expect(notice).toBeVisible({ timeout: 60_000 });
    await expect(notice).toContainText(condDone.numberText);
    await expect(page.getByTestId(TESTIDS.conditioningSection)).toBeVisible({ timeout: 60_000 });

    const close = notice.getByTestId(TESTIDS.conditionedNoticeClose);
    await expect(close).toHaveAccessibleName('Cerrar');
    await expectTarget(close, '«Cerrar» del aviso');

    const urlBefore = page.url();
    await page.evaluate(() => {
      (window as unknown as { __sinRecarga?: boolean }).__sinRecarga = true;
    });
    await expect(async () => {
      if ((await notice.count()) > 0) await close.click();
      await expect(notice).toHaveCount(0, { timeout: 5_000 });
    }).toPass({ timeout: 60_000 });

    expect(page.url()).toBe(urlBefore);
    expect(
      await page.evaluate(() => (window as unknown as { __sinRecarga?: boolean }).__sinRecarga),
      'la página no se recargó',
    ).toBe(true);
    await expect(page.getByTestId(TESTIDS.conditioningSection)).toBeVisible();
  });
});

test.describe('R21 — tarjetas a 390 × 844', () => {
  test('R21 — en «Mis asignados» cada pedido es una tarjeta con número, estado y receta, y «Entrar» mide 44 px', async ({
    page,
  }) => {
    const { execPending } = seeded();
    await page.setViewportSize(PHONE);
    await loginAndLand(page, operatorUser);
    await page.goto(ASSIGNED_ORDERS_ROUTE);
    await expect(page.getByTestId(TESTIDS.asignacionTitle)).toBeVisible({ timeout: 60_000 });

    await expect(page.getByTestId(TESTIDS.cards)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(TABLE_ROWS).filter({ visible: true })).toHaveCount(0);

    const card = page.getByTestId(`data-table-card-${execPending.id}`);
    await expect(card).toBeVisible();
    await expect(card).toContainText(execPending.numberText);
    await expect(card).toContainText(RECIPE_NAME);
    await expect(card.getByTestId('data-table-card-field-status')).toBeVisible();
    await expectTarget(card.getByTestId(TESTIDS.assignedEnter), '«Entrar» de la tarjeta');
  });

  test('R21 — en «Por acondicionar» la tarjeta lleva «Acciones», que abre el menú centrado con «Entrar»', async ({
    page,
  }) => {
    const { condTodo } = seeded();
    await page.setViewportSize(PHONE);
    await loginAndLand(page, conditionerUser);
    await expect(page.getByTestId(TESTIDS.conditioningSection)).toBeVisible({ timeout: 60_000 });

    await expect(page.getByTestId(TESTIDS.cards)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(TABLE_ROWS).filter({ visible: true })).toHaveCount(0);

    const card = page.getByTestId(`data-table-card-${condTodo.id}`);
    await expect(card).toBeVisible();
    await expect(card).toContainText(condTodo.numberText);
    await expect(card).toContainText(RECIPE_NAME);
    await expect(card.getByTestId('data-table-card-field-status')).toBeVisible();

    const trigger = card.getByTestId(TESTIDS.rowActions);
    await expect(trigger).toContainText('Acciones');
    await expectTarget(trigger, '«Acciones» de la tarjeta');

    const dialog = page.getByRole('dialog');
    await clickUntilVisible(trigger, dialog);
    await expect(dialog.getByTestId(TESTIDS.rowEnter)).toBeVisible();
    await expectCenteredAndWhole(page, dialog, 'menú de la tarjeta');

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
});

test.describe('R41 — diálogos del operario a 390 × 844', () => {
  test('R41 — comenzar el pedido, cancelarlo y terminarlo abren diálogos enteros y centrados con botones de 44 px', async ({
    page,
  }) => {
    const { execPending, execRunning } = seeded();
    await page.setViewportSize(PHONE);
    await loginAndLand(page, operatorUser);
    await page.goto(ASSIGNED_ORDERS_ROUTE);

    // «Entrar» ya no pide nada: «Comenzar» vive en el pie de la pantalla del pedido pendiente.
    const pendingScreen = await openScreen(page, assignedOrderRoute(execPending.id), TESTIDS.executionScreen);
    await clickUntilVisible(
      pendingScreen.getByTestId('order-execution-start-button'),
      page.getByTestId('order-execution-start-dialog'),
    );
    await expectOperatorDialog(page, {
      label: '¿Comenzar el pedido?',
      dialog: 'order-execution-start-dialog',
      dismiss: 'order-execution-start-dialog-cancel',
      confirm: 'order-execution-start-confirm',
    });

    const screen = await openScreen(page, assignedOrderRoute(execRunning.id), TESTIDS.executionScreen);
    // En WebKit el menú ⋯ puede rehacerse al hidratar y desmontar el ítem entre abrirlo y pulsarlo:
    // se repite todo (abrir el menú si hace falta y elegir el ítem) hasta ver el diálogo, como en
    // `e2e/registro-ejecucion.spec.ts`.
    const actions = screen.getByTestId(TESTIDS.executionActions);
    const cancelItem = page.getByTestId('order-cancel-trigger');
    const cancelDialog = page.getByTestId('order-cancel-dialog');
    await expect(async () => {
      if ((await cancelDialog.count()) === 0) {
        if (!(await cancelItem.isVisible())) await actions.click({ timeout: 5_000 });
        await expect(cancelItem).toBeVisible({ timeout: 5_000 });
        await cancelItem.click({ timeout: 5_000 });
      }
      await expect(cancelDialog).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    await expectOperatorDialog(page, {
      label: 'cancelar el pedido',
      dialog: 'order-cancel-dialog',
      dismiss: 'order-cancel-dismiss',
      confirm: 'order-cancel-confirm',
    });

    await page.getByTestId(TESTIDS.stepChecklistItem).click();
    await clickUntilVisible(page.getByTestId(TESTIDS.stepFinish), page.getByTestId('order-execution-finish-dialog'));
    await expectOperatorDialog(page, {
      label: '¿Terminar el pedido?',
      dialog: 'order-execution-finish-dialog',
      dismiss: 'order-execution-finish-dialog-cancel',
      confirm: 'order-execution-finish-confirm',
    });
  });

  test('R41 — comenzar y terminar el empaque abren diálogos enteros y centrados con botones de 44 px', async ({
    page,
  }) => {
    const { packTodo, packRunning } = seeded();
    await page.setViewportSize(PHONE);
    await loginAndLand(page, packerUser);

    await openScreen(page, packingOrderRoute(packTodo.id), TESTIDS.packingScreen);
    await clickUntilVisible(page.getByTestId(TESTIDS.packingStart), page.getByTestId('packing-order-start-dialog'));
    await expectOperatorDialog(page, {
      label: '¿Comenzar el empaque?',
      dialog: 'packing-order-start-dialog',
      dismiss: 'packing-order-start-dialog-cancel',
      confirm: 'packing-order-start-confirm',
    });

    await openScreen(page, packingOrderRoute(packRunning.id), TESTIDS.packingScreen);
    await clickUntilVisible(page.getByTestId(TESTIDS.packingFinish), page.getByTestId('packing-order-finish-dialog'));
    await expectOperatorDialog(page, {
      label: '¿Terminar el empaque?',
      dialog: 'packing-order-finish-dialog',
      dismiss: 'packing-order-finish-dialog-cancel',
      confirm: 'packing-order-finish-confirm',
    });
  });

  test('R41 — acondicionar y terminar el acondicionamiento abren diálogos enteros y centrados con botones de 44 px', async ({
    page,
  }) => {
    const { condTodo, condRunning } = seeded();
    await page.setViewportSize(PHONE);
    await loginAndLand(page, conditionerUser);

    await openScreen(page, conditioningOrderRoute(condTodo.id), TESTIDS.conditioningScreen);
    await clickUntilVisible(
      page.getByTestId(TESTIDS.conditioningStart),
      page.getByTestId('start-conditioning-dialog'),
    );
    await expectOperatorDialog(page, {
      label: 'acondicionar el pedido',
      dialog: 'start-conditioning-dialog',
      dismiss: 'start-conditioning-cancel',
      confirm: TESTIDS.countdownButton,
    });

    await openScreen(page, conditioningOrderRoute(condRunning.id), TESTIDS.conditioningScreen);
    await clickUntilVisible(
      page.getByTestId(TESTIDS.conditioningFinish),
      page.getByTestId('finish-conditioning-dialog'),
    );
    await expectOperatorDialog(page, {
      label: 'terminar el acondicionamiento',
      dialog: 'finish-conditioning-dialog',
      dismiss: 'finish-conditioning-cancel',
      confirm: TESTIDS.countdownButton,
    });
  });
});

test.describe('R37 — el anillo del botón con espera', () => {
  test('R37 — mientras espera, el botón pinta un anillo oculto a lectores que se vacía; al acabar, anillo y cuenta desaparecen y el botón se habilita', async ({
    page,
  }) => {
    const { condRunning } = seeded();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize(DESKTOP);
    await loginAndLand(page, conditionerUser);

    await openScreen(page, conditioningOrderRoute(condRunning.id), TESTIDS.conditioningScreen);
    const dialog = page.getByTestId('finish-conditioning-dialog');
    await clickUntilVisible(page.getByTestId(TESTIDS.conditioningFinish), dialog);

    const button = dialog.getByTestId(TESTIDS.countdownButton);
    const ring = button.getByTestId(TESTIDS.countdownRing);
    await expect(button).toBeDisabled();
    await expect(ring).toBeVisible();
    await expect(ring).toHaveAttribute('aria-hidden', 'true');

    const progress = ring.locator(RING_PROGRESS);
    const offset = () =>
      progress.evaluate((el) => Number.parseFloat(window.getComputedStyle(el).strokeDashoffset));
    const total = await progress.evaluate((el) => Number.parseFloat(el.getAttribute('stroke-dasharray') ?? '0'));
    expect(total).toBeGreaterThan(0);

    await expect.poll(offset).toBeGreaterThan(0);
    const early = await offset();
    expect(early).toBeLessThan(total);
    await expect.poll(offset).toBeGreaterThan(early);

    await expect(ring).toHaveCount(0, { timeout: CONDITIONING_WAIT_MS * 3 });
    await expect(button).toBeEnabled();
    await expect(button).toHaveText('Terminar');
  });
});

// ---------------------------------------------------------------------------------------------
// QC-269 — defectos de layout del operario tras QC-265.
// ---------------------------------------------------------------------------------------------

/** Cuánto esperar a que la página deje de moverse (hidratación, entrada de pantalla). */
const SETTLE_TIMEOUT_MS = 30_000;

/**
 * Desplaza la zona central del marco hasta el final y mide, en la misma ida al navegador, el pie
 * del marco y los elementos pedidos por `data-testid`. Todo junto porque, hasta que termina de
 * hidratar, la pantalla puede devolver el desplazamiento arriba entre un paso y el siguiente.
 */
async function measureAtEnd(
  page: Page,
  testIds: readonly string[],
): Promise<{
  readonly gap: number;
  readonly documentScrollTop: number;
  readonly footer: Rect | null;
  readonly targets: ReadonlyArray<Rect | null>;
}> {
  return page.evaluate(
    ({ footer, scroll, ids }) => {
      const rect = (node: Element | null) => {
        if (node === null) return null;
        const found = node.getBoundingClientRect();
        return { x: found.x, y: found.y, width: found.width, height: found.height };
      };
      const zone = document.querySelector(scroll) as HTMLElement;
      zone.scrollTop = zone.scrollHeight;
      window.scrollTo(0, document.documentElement.scrollHeight);
      return {
        gap: zone.scrollHeight - (zone.scrollTop + zone.clientHeight),
        documentScrollTop: (document.scrollingElement as HTMLElement).scrollTop,
        footer: rect(document.querySelector(footer)),
        targets: ids.map((id) => rect(document.querySelector(`[data-testid="${id}"]`))),
      };
    },
    { footer: OPERATOR_FOOTER, scroll: OPERATOR_SCROLL, ids: [...testIds] },
  );
}

/**
 * Con la zona central desplazada hasta el final, el pie del marco queda pegado al borde inferior
 * de la ventana (R6), el documento no se desplaza y cada elemento pedido termina por encima del
 * pie (R4, R5). Se reintenta mientras corre la entrada de pantalla: con ella el pie se mide
 * desplazado.
 */
async function expectWholeAboveFooter(
  page: Page,
  label: string,
  targets: ReadonlyArray<{ readonly testId: string; readonly what: string }>,
): Promise<void> {
  const viewport = page.viewportSize() as NonNullable<ReturnType<Page['viewportSize']>>;
  await expect(async () => {
    await waitForScreenEnterToSettle(page);
    const measured = await measureAtEnd(
      page,
      targets.map((target) => target.testId),
    );
    expect(measured.gap, `${label}: la zona central llega a su final`).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    expect(measured.documentScrollTop, `R6 ${label}: el documento no se desplaza`).toBe(0);
    expect(measured.footer, `${label}: hay pie fijo`).not.toBeNull();
    const footer = measured.footer!;
    expect(
      Math.abs(footer.y + footer.height - viewport.height),
      `R6 ${label}: el pie fijo pegado al borde inferior de la ventana`,
    ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    for (const [index, target] of targets.entries()) {
      const found = measured.targets[index];
      expect(found, `${label}: ${target.what} existe`).not.toBeNull();
      expect(found!.y + found!.height, `${label}: ${target.what} por encima del pie fijo`).toBeLessThanOrEqual(
        footer.y + EDGE_TOLERANCE_PX,
      );
    }
  }).toPass({ timeout: SETTLE_TIMEOUT_MS });
}

/**
 * El panel flotante va en su portal, por encima del pie: desplazado su contenido hasta el final,
 * el último material queda entero por encima del pie y ni él ni el borde inferior del panel quedan
 * debajo de otra capa (R4). El documento no se desplaza (R6).
 */
async function expectSidePanelEndShown(
  page: Page,
  label: string,
  sidePanel: Locator,
  lastLine: Locator,
): Promise<void> {
  await lastLine.scrollIntoViewIfNeeded();
  await expect(lastLine, `R4 ${label}: el último material a la vista`).toBeInViewport();
  const [lineBox, footerBox] = await Promise.all([box(lastLine), box(page.locator(OPERATOR_FOOTER))]);
  expect(lineBox.y + lineBox.height, `R4 ${label}: el último material por encima del pie`).toBeLessThanOrEqual(
    footerBox.y + EDGE_TOLERANCE_PX,
  );
  const onTop = await sidePanel.evaluate(
    (panel, line) => {
      const inPanel = (x: number, y: number) => {
        const hit = document.elementFromPoint(x, y);
        return hit !== null && panel.contains(hit);
      };
      const panelRect = panel.getBoundingClientRect();
      const lineRect = line!.getBoundingClientRect();
      return {
        line: inPanel(lineRect.x + lineRect.width / 2, lineRect.y + lineRect.height / 2),
        edge: inPanel(panelRect.x + panelRect.width / 2, panelRect.bottom - 2),
      };
    },
    await lastLine.elementHandle(),
  );
  expect(onTop.line, `R4 ${label}: el último material no queda tapado`).toBe(true);
  expect(onTop.edge, `R4 ${label}: el borde inferior del panel no queda tapado`).toBe(true);
  const documentScrollTop = await page.evaluate(() => (document.scrollingElement as HTMLElement).scrollTop);
  expect(documentScrollTop, `R6 ${label}: el documento no se desplaza`).toBe(0);
}

const OPERATOR_WIDTHS = [
  { name: '1440 × 900', size: DESKTOP },
  { name: '390 × 844', size: PHONE },
] as const;

test.describe('QC-269 R1, R2, R3 — «Entrar» en «Mis asignados»', () => {
  test('R1, R2, R3 — «Entrar» alineado en sus tres estados', async ({ page }) => {
    const { execPending, execRunning, execBlocked } = seeded();
    const threeStates = [
      { label: 'PENDIENTE', order: execPending, hasReason: false },
      { label: 'EN_CURSO', order: execRunning, hasReason: true },
      { label: 'BLOQUEADO', order: execBlocked, hasReason: true },
    ] as const;

    await page.setViewportSize(DESKTOP);
    await loginAndLand(page, operatorUser);
    await page.goto(ASSIGNED_ORDERS_ROUTE);
    await expect(page.getByTestId(TESTIDS.asignacionTitle)).toBeVisible({ timeout: 60_000 });

    // R1, R2: en la tabla, los tres botones y sus avisos comparten el borde derecho.
    const rightEdges: Array<{ readonly enter: number; readonly reason: number | null }> = [];
    for (const state of threeStates) {
      const row = page.getByTestId(`data-table-row-${state.order.id}`);
      await expect(row, `fila ${state.label}`).toBeVisible({ timeout: 60_000 });
      const enterBox = await box(row.getByTestId(TESTIDS.assignedEnter));
      const reasonBox = state.hasReason ? await box(row.getByTestId(TESTIDS.assignedEnterReason)) : null;
      rightEdges.push({
        enter: enterBox.x + enterBox.width,
        reason: reasonBox === null ? null : reasonBox.x + reasonBox.width,
      });
    }
    for (const [index, edge] of rightEdges.entries()) {
      expect(
        Math.abs(edge.enter - rightEdges[0]!.enter),
        `R1: el borde derecho de «Entrar» en ${threeStates[index]!.label} es el de PENDIENTE`,
      ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    }
    for (const [index, edge] of rightEdges.entries()) {
      if (edge.reason === null) continue;
      expect(
        Math.abs(edge.reason - edge.enter),
        `R2: el aviso de ${threeStates[index]!.label} termina en el borde de su «Entrar»`,
      ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    }

    // R3: en las tarjetas, los tres botones comparten el borde izquierdo.
    await page.setViewportSize(PHONE);
    await expect(page.getByTestId(TESTIDS.cards)).toBeVisible({ timeout: 60_000 });
    const leftEdges: number[] = [];
    for (const state of threeStates) {
      const card = page.getByTestId(`data-table-card-${state.order.id}`);
      await expect(card, `tarjeta ${state.label}`).toBeVisible();
      leftEdges.push((await box(card.getByTestId(TESTIDS.assignedEnter))).x);
    }
    for (const [index, edge] of leftEdges.entries()) {
      expect(
        Math.abs(edge - leftEdges[0]!),
        `R3: el borde izquierdo de «Entrar» en ${threeStates[index]!.label} es el de PENDIENTE`,
      ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    }
  });
});

type LineRects = {
  readonly index: number;
  readonly row: Rect;
  readonly nameBox: Rect;
  /** La caja del texto pintado: si una palabra se sale de su caja, esta la cubre. */
  readonly nameText: Rect;
  readonly percentage: Rect | null;
  readonly quantity: Rect | null;
  /** El grupo de cifras (porcentaje y cantidad), hermano del nombre en la fila. */
  readonly figures: Rect | null;
  /** Ancho de contenido de la fila (sin padding horizontal): la fila es el contenedor flex. */
  readonly rowInnerWidth: number;
};

test.describe('QC-269 R4, R6, R9, R10 — ejecución con muchos materiales', () => {
  test('R4, R6, R9, R10 — panel con muchos materiales', async ({ page }) => {
    const { execMany } = seeded();
    await page.setViewportSize(DESKTOP);
    await loginAndLand(page, operatorUser);

    let wrappedRows = 0;
    for (const width of OPERATOR_WIDTHS) {
      await page.setViewportSize(width.size);
      const screen = await openScreen(page, assignedOrderRoute(execMany.id), TESTIDS.executionScreen);
      await waitForScreenEnterToSettle(page);

      // Con dos columnas los materiales van en la columna; a 390 px, en el panel que abre su botón
      // flotante.
      const inColumn = width.size === DESKTOP;
      const sidePanel = page.getByTestId(TESTIDS.materialsSidePanel);
      if (!inColumn) {
        await clickUntilVisible(page.getByTestId(TESTIDS.executionMaterialsFab), sidePanel);
        await waitForAnimationsToSettle(sidePanel);
      }
      const panel = inColumn
        ? screen.getByTestId(TESTIDS.executionMaterials)
        : sidePanel.getByTestId(TESTIDS.sidePanelBody);
      await expect(panel.locator(`li[data-testid^="${TESTIDS.executionLine}-"]`)).toHaveCount(MANY_LINES);
      const lastLine = panel.getByTestId(`${TESTIDS.executionLine}-${MANY_LINES - 1}`);
      await expect(lastLine).toBeAttached();

      const panelScroll = await panel.evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowY: window.getComputedStyle(el).overflowY,
      }));
      if (inColumn) {
        // R6: la columna no tiene desplazamiento propio; crece con su contenido.
        expect(panelScroll.scrollHeight, `R6 ${width.name}: el panel no recorta su contenido`).toBe(
          panelScroll.clientHeight,
        );
        expect(panelScroll.overflowY, `R6 ${width.name}: el panel no es un área desplazable`).not.toMatch(
          /^(auto|scroll)$/,
        );
      } else {
        // R6: lo que no cabe en el panel flotante se alcanza con su propio scroll, no con el del
        // documento.
        expect(panelScroll.overflowY, `R6 ${width.name}: el panel flotante hace scroll`).toMatch(
          /^(auto|scroll)$/,
        );
      }

      // R9, R10: las medidas de todas las filas en una sola ida al navegador.
      const lines = await panel.evaluate(
        (el, ids): LineRects[] => {
          const rect = (node: Element | null) => {
            if (node === null) return null;
            const found = node.getBoundingClientRect();
            return { x: found.x, y: found.y, width: found.width, height: found.height };
          };
          const result: LineRects[] = [];
          for (let index = 0; index < ids.count; index += 1) {
            const row = el.querySelector(`[data-testid="${ids.line}-${index}"]`);
            const name = el.querySelector(`[data-testid="${ids.name}-${index}"]`);
            if (row === null || name === null) continue;
            const range = document.createRange();
            range.selectNodeContents(name);
            const text = range.getBoundingClientRect();
            result.push({
              index,
              row: rect(row)!,
              nameBox: rect(name)!,
              nameText: { x: text.x, y: text.y, width: text.width, height: text.height },
              percentage: rect(el.querySelector(`[data-testid="${ids.percentage}-${index}"]`)),
              quantity: rect(el.querySelector(`[data-testid="${ids.quantity}-${index}"]`)),
              figures: rect(name.nextElementSibling),
              rowInnerWidth:
                row.clientWidth -
                parseFloat(window.getComputedStyle(row).paddingLeft) -
                parseFloat(window.getComputedStyle(row).paddingRight),
            });
          }
          return result;
        },
        {
          count: MANY_LINES,
          line: TESTIDS.executionLine,
          name: TESTIDS.executionLineName,
          percentage: TESTIDS.executionLinePercentage,
          quantity: TESTIDS.executionLineQuantity,
        },
      );
      expect(lines, `${width.name}: cada fila tiene su nombre`).toHaveLength(MANY_LINES);
      for (const line of lines) {
        const label = `${width.name}, material ${line.index}`;
        expect(line.percentage, `${label}: tiene porcentaje`).not.toBeNull();
        expect(line.quantity, `${label}: tiene cantidad`).not.toBeNull();
        for (const name of [line.nameBox, line.nameText]) {
          expect(rectsOverlap(name, line.percentage!), `R9 ${label}: el nombre no pisa al porcentaje`).toBe(
            false,
          );
          expect(rectsOverlap(name, line.quantity!), `R9 ${label}: el nombre no pisa a la cantidad`).toBe(false);
        }
        expect(
          line.nameBox.width,
          `R10 ${label}: el nombre mide al menos 12 rem o la fila entera`,
        ).toBeGreaterThanOrEqual(Math.min(192, line.row.width) - EDGE_TOLERANCE_PX);
        expect(line.figures, `${label}: tiene grupo de cifras`).not.toBeNull();
        const figuresWrapped =
          line.figures!.y >= line.nameBox.y + line.nameBox.height - EDGE_TOLERANCE_PX;
        if (figuresWrapped) {
          wrappedRows += 1;
          expect(
            Math.abs(line.nameBox.width - line.rowInnerWidth),
            `R10 ${label}: con las cifras debajo, el nombre ocupa toda la fila`,
          ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
        }
      }

      // R4, R6: el último material y el borde inferior del panel quedan por encima del pie.
      if (inColumn) {
        await expectWholeAboveFooter(page, width.name, [
          { testId: `${TESTIDS.executionLine}-${MANY_LINES - 1}`, what: 'R4 el último material' },
          { testId: TESTIDS.executionMaterials, what: 'R4 el borde inferior del panel' },
        ]);
      } else {
        await expectSidePanelEndShown(page, width.name, sidePanel, lastLine);
      }
    }
    // Sin esto, la comprobación de las cifras debajo podría no ejercitarse nunca.
    expect(wrappedRows, 'R10: en algún ancho las cifras bajan bajo el nombre').toBeGreaterThan(0);
  });
});

test.describe('QC-269 R5 — ejecución con un paso largo', () => {
  test('R5 — paso largo', async ({ page }) => {
    const { execLongStep } = seeded();
    await page.setViewportSize(DESKTOP);
    await loginAndLand(page, operatorUser);

    for (const width of OPERATOR_WIDTHS) {
      await page.setViewportSize(width.size);
      const screen = await openScreen(page, assignedOrderRoute(execLongStep.id), TESTIDS.executionScreen);
      await waitForScreenEnterToSettle(page);

      await expect(screen.getByTestId(LAST_LONG_STEP_ITEM)).toBeAttached();
      await expectWholeAboveFooter(page, width.name, [
        { testId: LAST_LONG_STEP_ITEM, what: 'R5 el último elemento del paso' },
      ]);
    }
  });
});
