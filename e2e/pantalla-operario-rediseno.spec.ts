/**
 * E2E del rediseño de las tres pantallas de ejecución del operario: marco de alto fijo con scroll
 * interno, columna lateral en escritorio y botones flotantes con panel en tablet y teléfono.
 *
 * Solo en navegador: jsdom no aplica container queries ni calcula scroll, posiciones ni
 * `position`. Se mide a 1440 × 900, 834 × 1112 y 390 × 844.
 *
 * Ningún caso confirma un diálogo ni cambia de paso, así que los pedidos sembrados no cambian de
 * estado y los casos pueden correr en cualquier orden y en paralelo.
 *
 * FIXTURE (sembrado por Prisma): una empresa efímera por worker con un Operador, un Empacador y un
 * acondicionador (roles reales del seed) y un pedido por pantalla. Prefijo propio y `RUN_ID` por
 * worker; limpieza de huérfanos por prefijo y por edad, y la de `afterAll` solo por la empresa de
 * este worker.
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
import { assignedOrderRoute, conditioningOrderRoute, packingOrderRoute } from '@/lib/shared/routes';

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
  gridTracks,
  openScreen,
  waitForAnimationsToSettle,
  waitForScreenEnterToSettle,
  type Rect,
} from './helpers/operario';

const FIXTURE_PREFIX = 'qc291_e2e_';
const RUN_ID = randomUUID().replace(/-/g, '');
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;
const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;

type Credentials = { readonly username: string; readonly password: string };

function credentials(suffix: string, label: string): Credentials {
  return {
    username: `${SHARED_TOKEN}_${suffix}`,
    password: `Qc291-${label}-${RUN_ID.slice(0, 12)}`,
  };
}

const operatorUser = credentials('operador', 'Operador');
const packerUser = credentials('empacador', 'Empacador');
const conditionerUser = credentials('acond', 'Acond');
const ALL_USERS = [operatorUser, packerUser, conditionerUser];
const firstNames = `Qc291${RUN_ID.slice(0, 8)}`;

const ORDER_QUANTITY = '3.0';
/** Alta y aleatoria: no choca con la serie de otro worker ni de otro spec en la misma base. */
const BASE_SEQUENCE = 800_000 + Math.floor(Math.random() * 90_000);

/** Un solo paso con 30 casillas: más alto que la ventana en los tres anchos. */
const LONG_STEP_ITEMS = 30;
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
const LAST_STEP_ITEM = `step-reader-item-0-${LONG_STEP_ITEMS - 1}`;

/** 24 materiales: el panel no cabe en la ventana y tiene que hacer scroll dentro (R31). */
const MANY_LINES = 24;
/** 23 × 4,00 + 8,00 = 100,00. */
const MANY_LINE_PERCENTAGE = '4.00';
const MANY_LAST_LINE_PERCENTAGE = '8.00';

const TABLET = { width: 834, height: 1112 } as const;
const VIEWPORTS = [
  { name: '1440 × 900', size: DESKTOP },
  { name: '834 × 1112', size: TABLET },
  { name: '390 × 844', size: PHONE },
] as const;

const SIDE_TRACK = '320px';
const MIN_FAB_PX = 56;
const PANEL_MARGIN_PX = 16;
/** Unidad hermana del litro en el catálogo del sistema: la ofrece el selector de cada material. */
const ALTERNATIVE_UNIT_LABEL = 'ml';

/** Copias locales: los módulos que los exportan son de cliente y arrastrarían React al runner. */
const TESTIDS = {
  executionScreen: 'order-execution-screen',
  executionColumn: 'order-execution-materials',
  executionStart: 'order-execution-start-button',
  materialsFab: 'order-execution-materials-fab',
  materialsPanel: 'operator-side-panel-materials',
  panelClose: 'operator-side-panel-close',
  panelBody: 'operator-side-panel-body',
  fabs: 'operator-side-panels-fabs',
  executionLine: 'order-execution-line',
  lineUnitSelect: 'order-execution-line-unit-select',
  lineUnit: 'order-execution-line-unit',
  lineUnitOption: 'order-execution-line-unit-option',
  stepProgress: 'step-reader-progress',
  stepPosition: 'step-reader-position',
  stepFinish: 'step-reader-finish',
  packingScreen: 'packing-order-screen',
  packingColumn: 'packing-order-sections',
  packingStart: 'packing-order-start-button',
  packingPackagesFab: 'packing-order-packages-fab',
  conditioningScreen: 'conditioning-order-screen',
  conditioningColumn: 'conditioning-order-sections',
  conditioningFinish: 'conditioning-finish-button',
  conditioningPackagesFab: 'conditioning-order-packages-fab',
  conditioningTeamFab: 'conditioning-order-team-fab',
} as const;

const OPERATOR_SCROLL = '[data-slot="operator-scroll"]';

type SeededOrder = { readonly id: string; readonly numberText: string };
type SeededOrders = {
  /** PENDIENTE del Operador: pie con «Comenzar la fabricación». */
  readonly execPending: SeededOrder;
  /** EN_CURSO del Operador con el paso largo y un material en litros. */
  readonly execLongStep: SeededOrder;
  /** EN_CURSO del Operador con 24 materiales. */
  readonly execMany: SeededOrder;
  /** POR_EMPACAR: pie con «Comenzar el empaque» y la sección Envases. */
  readonly packTodo: SeededOrder;
  /** EN_ACONDICIONAMIENTO del acondicionador, con equipo: Envases y Equipo. */
  readonly condRunning: SeededOrder;
};

let companyId: string | null = null;
let orders: SeededOrders | null = null;

function seeded(): SeededOrders {
  if (orders === null) throw new Error('el fixture no existe: falló el beforeAll');
  return orders;
}

async function createUser(user: Credentials, lastNames: string, roleId: string): Promise<string> {
  if (!companyId) throw new Error('la empresa del fixture no existe: falló el beforeAll');
  const created = await createFixtureUser({
    data: {
      firstNames,
      lastNames,
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

  const operatorId = await createUser(operatorUser, 'Operador', roles.get(ROLE_OPERADOR)!);
  const packerId = await createUser(packerUser, 'Empacador', roles.get(ROLE_EMPACADOR)!);
  const conditionerId = await createUser(conditionerUser, 'Acondiciona', roles.get(ROLE_ACONDICIONAMIENTO)!);

  const unit = await prisma.unit.findFirstOrThrow({
    where: { nameNormalized: 'litro', companyId: null },
    select: { id: true },
  });

  const manyProductIds = Array.from({ length: MANY_LINES }, () => randomUUID());
  const longStepProductId = randomUUID();
  await prisma.product.createMany({
    data: [
      ...manyProductIds.map((id, index) => ({ id, name: `${SHARED_TOKEN}_material ${index + 1}` })),
      { id: longStepProductId, name: `${SHARED_TOKEN}_producto_paso_largo` },
    ].map((product) => ({
      ...product,
      nameNormalized: normalizeProductName(product.name),
      unitId: unit.id,
      companyId: companyId!,
    })),
  });

  async function seedRecipe(
    suffix: string,
    lines: ReadonlyArray<{ readonly productId: string; readonly percentage: string }>,
  ): Promise<string> {
    const name = `${SHARED_TOKEN}_${suffix}`;
    const recipe = await prisma.recipe.create({
      data: {
        name,
        nameNormalized: normalizeRecipeName(name),
        createdBy: operatorId,
        companyId: companyId!,
        steps: LONG_RECIPE_STEPS as unknown as Prisma.InputJsonValue,
        lines: { create: [...lines] },
      },
      select: { id: true },
    });
    return recipe.id;
  }
  // Las líneas por `INSERT` directo: no pasan por el servicio, así que la suma de 100 % no la
  // valida nadie.
  const longStepRecipeId = await seedRecipe('receta_paso_largo', [
    { productId: longStepProductId, percentage: '100.00' },
  ]);
  const manyRecipeId = await seedRecipe(
    'receta_muchos',
    manyProductIds.map((productId, index) => ({
      productId,
      percentage: index === MANY_LINES - 1 ? MANY_LAST_LINE_PERCENTAGE : MANY_LINE_PERCENTAGE,
    })),
  );

  // El CHECK `orders_order_year_matches_created_at` ata el año a `created_at`; los de `packed_by`
  // y `conditioned_by` piden quién empacó y quién acondiciona según el estado.
  const year = new Date().getUTCFullYear();
  async function seedOrder(
    offset: number,
    data: {
      readonly status: NonNullable<Prisma.OrderUncheckedCreateInput['status']>;
      readonly recipeId: string;
      readonly packedBy?: string;
      readonly conditionedBy?: string;
    },
  ): Promise<SeededOrder> {
    const sequence = BASE_SEQUENCE + offset;
    const order = await prisma.order.create({
      data: {
        companyId: companyId!,
        orderYear: year,
        orderSequence: sequence,
        recipeId: data.recipeId,
        quantity: ORDER_QUANTITY,
        unitId: unit.id,
        status: data.status,
        packedBy: data.packedBy ?? null,
        conditionedBy: data.conditionedBy ?? null,
      },
      select: { id: true },
    });
    return { id: order.id, numberText: formatOrderNumber({ year, sequence }) };
  }

  const seededOrders: SeededOrders = {
    execPending: await seedOrder(0, { status: 'PENDIENTE', recipeId: longStepRecipeId }),
    execLongStep: await seedOrder(1, { status: 'EN_CURSO', recipeId: longStepRecipeId }),
    execMany: await seedOrder(2, { status: 'EN_CURSO', recipeId: manyRecipeId }),
    packTodo: await seedOrder(3, { status: 'POR_EMPACAR', recipeId: longStepRecipeId }),
    condRunning: await seedOrder(4, {
      status: 'EN_ACONDICIONAMIENTO',
      recipeId: longStepRecipeId,
      packedBy: packerId,
      conditionedBy: conditionerId,
    }),
  };

  await prisma.orderAssignment.createMany({
    data: [seededOrders.execPending, seededOrders.execLongStep, seededOrders.execMany].map((order) => ({
      orderId: order.id,
      userId: operatorId,
      companyId: companyId!,
    })),
  });
  await prisma.orderConditioningTeamMember.create({
    data: { orderId: seededOrders.condRunning.id, userId: conditionerId, companyId, position: 0 },
  });

  orders = seededOrders;
});

test.afterAll(async () => {
  const primerFallo = companyId === null ? undefined : await deleteCompanyData([companyId]);
  await prisma.user
    .deleteMany({ where: { username: { in: ALL_USERS.map((user) => user.username) } } })
    .catch(() => undefined);
  await prisma.$disconnect();
  if (primerFallo !== undefined) throw primerFallo;
});

// El primer `goto` compila la ruta en `next dev`, y bcrypt tarda a propósito.
test.setTimeout(240_000);

type FrameMeasure = {
  readonly header: Rect;
  readonly footer: Rect;
  readonly scrollTop: number;
  readonly scrollGap: number;
  readonly scrollable: boolean;
  readonly documentScrollTop: number;
  readonly documentOverflow: number;
  readonly progress: Rect | null;
  readonly position: Rect | null;
  readonly lastItem: Rect | null;
};

/** Cabecera, pie, zona con scroll y documento, medidos en la misma ida al navegador. */
async function measureFrame(page: Page, scrollToEnd: boolean): Promise<FrameMeasure> {
  return page.evaluate(
    ({ header, footer, scroll, toEnd, progress, position, lastItem }) => {
      const rectOf = (node: Element | null) => {
        if (node === null) return null;
        const found = node.getBoundingClientRect();
        return { x: found.x, y: found.y, width: found.width, height: found.height };
      };
      const rect = (selector: string) => rectOf(document.querySelector(selector))!;
      const byTestId = (id: string) => rectOf(document.querySelector(`[data-testid="${id}"]`));
      const zone = document.querySelector(scroll) as HTMLElement;
      if (toEnd) zone.scrollTop = zone.scrollHeight;
      // Un intento de desplazar el documento: si algo lo permitiera, se notaría en `scrollTop`.
      window.scrollTo(0, document.documentElement.scrollHeight);
      const root = document.scrollingElement as HTMLElement;
      return {
        header: rect(header),
        footer: rect(footer),
        scrollTop: zone.scrollTop,
        scrollGap: zone.scrollHeight - (zone.scrollTop + zone.clientHeight),
        scrollable: zone.scrollHeight > zone.clientHeight,
        documentScrollTop: root.scrollTop,
        documentOverflow: root.scrollHeight - root.clientHeight,
        progress: byTestId(progress),
        position: byTestId(position),
        lastItem: byTestId(lastItem),
      };
    },
    {
      header: OPERATOR_HEADER,
      footer: OPERATOR_FOOTER,
      scroll: OPERATOR_SCROLL,
      toEnd: scrollToEnd,
      progress: TESTIDS.stepProgress,
      position: TESTIDS.stepPosition,
      lastItem: LAST_STEP_ITEM,
    },
  );
}

function expectSameRect(actual: Rect, expected: Rect, label: string): void {
  expect(Math.abs(actual.y - expected.y), `${label}: y`).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
  expect(Math.abs(actual.height - expected.height), `${label}: alto`).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
}

/** Abre la pantalla de ejecución con el contenido desplazado hasta el final de la zona central. */
async function openScrolledToEnd(page: Page, url: string): Promise<{ readonly before: FrameMeasure; readonly after: FrameMeasure }> {
  await openScreen(page, url, TESTIDS.executionScreen);
  await waitForScreenEnterToSettle(page);
  await expect(page.getByTestId(LAST_STEP_ITEM)).toBeAttached();
  // La barra llega por portal tras hidratar: el HTML del servidor no la trae.
  await expect(page.locator(OPERATOR_HEADER).getByTestId(TESTIDS.stepProgress)).toBeVisible({ timeout: 60_000 });
  let measured: { before: FrameMeasure; after: FrameMeasure } | null = null;
  // Hasta hidratar, la pantalla puede devolver el scroll arriba entre una medida y la siguiente.
  await expect(async () => {
    const before = await measureFrame(page, false);
    const after = await measureFrame(page, true);
    expect(after.scrollable, 'la zona central tiene más contenido que alto').toBe(true);
    expect(after.scrollGap, 'la zona central llega a su final').toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    measured = { before, after };
  }).toPass({ timeout: 30_000 });
  return measured!;
}

async function openPanel(fab: Locator, panel: Locator): Promise<void> {
  await clickUntilVisible(fab, panel);
  await waitForAnimationsToSettle(panel);
  await expect(fab).toHaveAttribute('aria-expanded', 'true');
}

async function expectClosedWithFocusOnFab(fab: Locator, panel: Locator, label: string): Promise<void> {
  await expect(panel, `${label}: el panel se cierra`).toHaveCount(0);
  await expect(fab, `${label}: aria-expanded vuelve a false`).toHaveAttribute('aria-expanded', 'false');
  await expect(fab, `${label}: el foco vuelve al botón flotante`).toBeFocused();
}

type ScreenCase = {
  readonly name: string;
  readonly user: Credentials;
  readonly url: (seededOrders: SeededOrders) => string;
  readonly screen: string;
  readonly column: string;
  readonly fabs: readonly string[];
  readonly footerButtons: readonly string[];
};

const SCREENS: readonly ScreenCase[] = [
  {
    name: 'la fabricación',
    user: operatorUser,
    url: (seededOrders) => assignedOrderRoute(seededOrders.execLongStep.id),
    screen: TESTIDS.executionScreen,
    column: TESTIDS.executionColumn,
    fabs: [TESTIDS.materialsFab],
    footerButtons: [TESTIDS.stepFinish],
  },
  {
    name: 'el empaque',
    user: packerUser,
    url: (seededOrders) => packingOrderRoute(seededOrders.packTodo.id),
    screen: TESTIDS.packingScreen,
    column: TESTIDS.packingColumn,
    fabs: [TESTIDS.packingPackagesFab],
    footerButtons: [TESTIDS.packingStart],
  },
  {
    name: 'el acondicionamiento',
    user: conditionerUser,
    url: (seededOrders) => conditioningOrderRoute(seededOrders.condRunning.id),
    screen: TESTIDS.conditioningScreen,
    column: TESTIDS.conditioningColumn,
    fabs: [TESTIDS.conditioningPackagesFab, TESTIDS.conditioningTeamFab],
    footerButtons: [TESTIDS.conditioningFinish],
  },
];

test.describe('R1, R6 — el marco con el contenido al final', () => {
  test('R1, R6 — con el paso desplazado hasta el final, cabecera y pie no se mueven, el documento no se desplaza y la barra y «Paso N de M» siguen a la vista', async ({
    page,
  }) => {
    const { execLongStep } = seeded();
    await page.setViewportSize(DESKTOP);
    await loginAndLand(page, operatorUser);

    for (const size of VIEWPORTS) {
      await page.setViewportSize(size.size);
      const { before, after } = await openScrolledToEnd(page, assignedOrderRoute(execLongStep.id));
      const label = size.name;

      // R1
      expect(after.scrollTop, `R1 ${label}: la zona central se ha desplazado`).toBeGreaterThan(0);
      expectSameRect(after.header, before.header, `R1 ${label}: la cabecera no se mueve`);
      expectSameRect(after.footer, before.footer, `R1 ${label}: el pie no se mueve`);
      expect(Math.abs(after.header.y), `R1 ${label}: la cabecera arriba`).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      expect(
        Math.abs(after.footer.y + after.footer.height - size.size.height),
        `R1 ${label}: el pie abajo`,
      ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
      expect(after.documentScrollTop, `R1 ${label}: document.scrollingElement no se desplaza`).toBe(0);
      expect(after.documentOverflow, `R1 ${label}: el documento no tiene nada que desplazar`).toBeLessThanOrEqual(0);

      // R6: medido en la misma ida al navegador que el scroll hasta el final.
      const headerBottom = after.header.y + after.header.height;
      const lastItem = after.lastItem!;
      expect(after.lastItem, `R6 ${label}: el último elemento del paso existe`).not.toBeNull();
      expect(lastItem.y, `R6 ${label}: el final del paso asoma bajo la cabecera`).toBeGreaterThanOrEqual(
        headerBottom - EDGE_TOLERANCE_PX,
      );
      expect(lastItem.y + lastItem.height, `R6 ${label}: el final del paso queda sobre el pie`).toBeLessThanOrEqual(
        after.footer.y + EDGE_TOLERANCE_PX,
      );
      for (const [what, found] of [
        ['la barra', after.progress],
        ['«Paso N de M»', after.position],
      ] as const) {
        expect(found, `R6 ${label}: ${what} existe`).not.toBeNull();
        expect(found!.width * found!.height, `R6 ${label}: ${what} tiene tamaño`).toBeGreaterThan(0);
        expect(found!.y, `R6 ${label}: ${what} dentro de la ventana`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
        expect(found!.y + found!.height, `R6 ${label}: ${what} dentro de la cabecera`).toBeLessThanOrEqual(
          headerBottom + EDGE_TOLERANCE_PX,
        );
      }
      const position = page.locator(OPERATOR_HEADER).getByTestId(TESTIDS.stepPosition);
      await expect(position, `R6 ${label}: «Paso N de M» a la vista`).toBeInViewport();
      await expect(position).toHaveText('Paso 1 de 1');
      await expect(position).toHaveAttribute('aria-live', 'polite');
    }
  });
});

test.describe('R11 — botones del pie y márgenes seguros', () => {
  for (const screenCase of SCREENS) {
    test(`R11 — en ${screenCase.name}, los botones del pie miden al menos ${MIN_FOOTER_BUTTON_PX} px y cabecera y pie reservan safe-area`, async ({
      page,
    }) => {
      await page.setViewportSize(DESKTOP);
      await loginAndLand(page, screenCase.user);

      for (const size of VIEWPORTS) {
        await page.setViewportSize(size.size);
        await openScreen(page, screenCase.url(seeded()), screenCase.screen);
        await waitForScreenEnterToSettle(page);
        const footer = page.locator(OPERATOR_FOOTER);
        for (const buttonTestId of screenCase.footerButtons) {
          const button = footer.getByTestId(buttonTestId);
          await expect(button, `R11 ${size.name}: ${buttonTestId} va en el pie`).toBeVisible();
          const found = await box(button);
          expect(found.height, `R11 ${size.name}: ${buttonTestId} alto`).toBeGreaterThanOrEqual(MIN_FOOTER_BUTTON_PX);
        }
        const classes = await page.evaluate(
          ({ header, footerSelector }) => ({
            header: document.querySelector(header)!.className,
            footer: document.querySelector(footerSelector)!.className,
          }),
          { header: OPERATOR_HEADER, footerSelector: OPERATOR_FOOTER },
        );
        expect(classes.header, `R11 ${size.name}: la cabecera reserva el margen seguro de arriba`).toContain(
          'env(safe-area-inset-top)',
        );
        expect(classes.footer, `R11 ${size.name}: el pie reserva el margen seguro de abajo`).toContain(
          'env(safe-area-inset-bottom)',
        );
      }
    });
  }

  test('R11 — sin comenzar, «Comenzar la fabricación» mide al menos el mínimo del pie en los tres anchos', async ({
    page,
  }) => {
    const { execPending } = seeded();
    await page.setViewportSize(DESKTOP);
    await loginAndLand(page, operatorUser);
    for (const size of VIEWPORTS) {
      await page.setViewportSize(size.size);
      await openScreen(page, assignedOrderRoute(execPending.id), TESTIDS.executionScreen);
      const start = page.locator(OPERATOR_FOOTER).getByTestId(TESTIDS.executionStart);
      await expect(start).toBeVisible();
      expect((await box(start)).height, `R11 ${size.name}: alto`).toBeGreaterThanOrEqual(MIN_FOOTER_BUTTON_PX);
    }
  });
});

test.describe('R19 — dos columnas a 1440 px', () => {
  for (const screenCase of SCREENS) {
    test(`R19 — en ${screenCase.name}, a 1440 × 900 la rejilla tiene dos pistas y la primera mide ${SIDE_TRACK}`, async ({
      page,
    }) => {
      await page.setViewportSize(DESKTOP);
      await loginAndLand(page, screenCase.user);
      await openScreen(page, screenCase.url(seeded()), screenCase.screen);
      const column = page.getByTestId(screenCase.column);
      await expect(column).toBeVisible();
      const tracks = await gridTracks(column);
      expect(tracks, 'R19: dos pistas').toHaveLength(2);
      expect(tracks[0], `R19: la columna lateral mide ${SIDE_TRACK}`).toBe(SIDE_TRACK);
      for (const fab of screenCase.fabs) {
        await expect(page.getByTestId(fab), `R19: ${fab} no se ve con la columna`).toBeHidden();
      }
    });
  }
});

test.describe('R27 — botones flotantes a 834 px', () => {
  for (const screenCase of SCREENS) {
    test(`R27 — en ${screenCase.name}, a 834 × 1112 la columna no se ve y cada botón flotante mide al menos ${MIN_FAB_PX} × ${MIN_FAB_PX} px`, async ({
      page,
    }) => {
      await page.setViewportSize(TABLET);
      await loginAndLand(page, screenCase.user);
      await openScreen(page, screenCase.url(seeded()), screenCase.screen);
      await waitForScreenEnterToSettle(page);
      await expect(page.getByTestId(screenCase.column), 'R27: la columna lateral no se ve').toBeHidden();
      const footer = await box(page.locator(OPERATOR_FOOTER));
      for (const fabTestId of screenCase.fabs) {
        const fab = page.getByTestId(fabTestId);
        await expect(fab, `R27: ${fabTestId} se ve`).toBeVisible();
        const found = await box(fab);
        expect(found.width, `R27: ${fabTestId} ancho`).toBeGreaterThanOrEqual(MIN_FAB_PX);
        expect(found.height, `R27: ${fabTestId} alto`).toBeGreaterThanOrEqual(MIN_FAB_PX);
        expect(found.y + found.height, `R27: ${fabTestId} por encima del pie`).toBeLessThanOrEqual(
          footer.y + EDGE_TOLERANCE_PX,
        );
        expect(found.x + found.width, `R27: ${fabTestId} a la derecha`).toBeGreaterThan(TABLET.width / 2);
      }
    });
  }
});

test.describe('R28, R29 — el panel abre y cierra', () => {
  test('R28, R29 — a 834 × 1112 el panel de materiales abre con su botón y cierra con X, con un toque fuera y con Escape, devolviendo el foco al botón', async ({
    page,
  }) => {
    const { execLongStep } = seeded();
    await page.setViewportSize(TABLET);
    await loginAndLand(page, operatorUser);
    await openScreen(page, assignedOrderRoute(execLongStep.id), TESTIDS.executionScreen);
    await waitForScreenEnterToSettle(page);

    const fab = page.getByTestId(TESTIDS.materialsFab);
    const panel = page.getByTestId(TESTIDS.materialsPanel);
    await expect(fab).toHaveAttribute('aria-expanded', 'false');

    // R28: abre su sección, con cabecera, título y un «Cerrar» de 44 × 44.
    await openPanel(fab, panel);
    await expect(panel.getByRole('heading', { name: /Materiales/ })).toBeVisible();
    const close = panel.getByTestId(TESTIDS.panelClose);
    await expect(close).toHaveAccessibleName('Cerrar');
    const closeBox = await box(close);
    expect(closeBox.width, 'R28: «Cerrar» ancho').toBeGreaterThanOrEqual(44);
    expect(closeBox.height, 'R28: «Cerrar» alto').toBeGreaterThanOrEqual(44);

    // R29: con X.
    await close.click();
    await expectClosedWithFocusOnFab(fab, panel, 'R29 con X');

    // R29: con un toque fuera del panel, arriba a la izquierda.
    await openPanel(fab, panel);
    const panelBox = await box(panel);
    const outside = { x: 8, y: 8 };
    expect(
      outside.x < panelBox.x || outside.y < panelBox.y,
      'R29: el punto del toque queda fuera del panel',
    ).toBe(true);
    await page.mouse.click(outside.x, outside.y);
    await expectClosedWithFocusOnFab(fab, panel, 'R29 con toque fuera');

    // R29: con Escape.
    await openPanel(fab, panel);
    await page.keyboard.press('Escape');
    await expectClosedWithFocusOnFab(fab, panel, 'R29 con Escape');
  });
});

test.describe('R30 — el panel en teléfono', () => {
  test('R30 — a 390 × 844 el panel abierto ocupa el ancho menos 16 px por lado y los botones flotantes no se ven', async ({
    page,
  }) => {
    const { execLongStep } = seeded();
    await page.setViewportSize(PHONE);
    await loginAndLand(page, operatorUser);
    await openScreen(page, assignedOrderRoute(execLongStep.id), TESTIDS.executionScreen);
    await waitForScreenEnterToSettle(page);

    const fabs = page.getByTestId(TESTIDS.fabs);
    await expect(fabs, 'R30: con el panel cerrado los botones se ven').toBeVisible();
    const panel = page.getByTestId(TESTIDS.materialsPanel);
    await openPanel(page.getByTestId(TESTIDS.materialsFab), panel);

    const found = await box(panel);
    expect(
      Math.abs(found.width - (PHONE.width - 2 * PANEL_MARGIN_PX)),
      'R30: el panel mide el ancho de la ventana menos 32 px',
    ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    expect(Math.abs(found.x - PANEL_MARGIN_PX), 'R30: 16 px a la izquierda').toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    await expect(fabs, 'R30: con el panel abierto los botones no se ven').toBeHidden();

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(fabs, 'R30: al cerrar, los botones vuelven').toBeVisible();
  });
});

test.describe('R31 — el final del panel es alcanzable', () => {
  for (const size of [TABLET, PHONE]) {
    test(`R31 — a ${size.width} × ${size.height}, con 24 materiales el panel hace scroll dentro y su último material queda a la vista y por encima del pie`, async ({
      page,
    }) => {
      const { execMany } = seeded();
      await page.setViewportSize(size);
      await loginAndLand(page, operatorUser);
      await openScreen(page, assignedOrderRoute(execMany.id), TESTIDS.executionScreen);
      await waitForScreenEnterToSettle(page);

      const panel = page.getByTestId(TESTIDS.materialsPanel);
      await openPanel(page.getByTestId(TESTIDS.materialsFab), panel);
      const panelBody = panel.getByTestId(TESTIDS.panelBody);
      const lastLine = panelBody.getByTestId(`${TESTIDS.executionLine}-${MANY_LINES - 1}`);
      await expect(lastLine).toBeAttached();

      const scroll = await panelBody.evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowY: window.getComputedStyle(el).overflowY,
      }));
      expect(scroll.scrollHeight, 'R31: el contenido no cabe y el cuerpo del panel lo recorta').toBeGreaterThan(
        scroll.clientHeight,
      );
      expect(scroll.overflowY, 'R31: el cuerpo del panel hace scroll').toMatch(/^(auto|scroll)$/);

      await lastLine.scrollIntoViewIfNeeded();
      await expect(lastLine, 'R31: el último material queda a la vista').toBeInViewport();
      const [lineBox, bodyBox, footerBox] = await Promise.all([
        box(lastLine),
        box(panelBody),
        box(page.locator(OPERATOR_FOOTER)),
      ]);
      expect(lineBox.y + lineBox.height, 'R31: el último material dentro del panel').toBeLessThanOrEqual(
        bodyBox.y + bodyBox.height + EDGE_TOLERANCE_PX,
      );
      // «Tapado» es que otra capa quede encima: el panel va en su portal, por encima del pie.
      const topmostIsPanel = await lastLine.evaluate((el) => {
        const found = el.getBoundingClientRect();
        const hit = document.elementFromPoint(found.x + found.width / 2, found.y + found.height / 2);
        return hit !== null && el.closest('[role="dialog"]')?.contains(hit) === true;
      });
      expect(topmostIsPanel, 'R31: el último material no queda tapado por el pie ni por otra capa').toBe(true);
      expect(lineBox.y + lineBox.height, 'R31: el último material queda por encima del pie').toBeLessThanOrEqual(
        footerBox.y + EDGE_TOLERANCE_PX,
      );
      const documentScrollTop = await page.evaluate(() => (document.scrollingElement as HTMLElement).scrollTop);
      expect(documentScrollTop, 'R31: el scroll es del panel, no del documento').toBe(0);
    });
  }
});

test.describe('R22 — la unidad elegida en el panel', () => {
  test('R22 — a 834 × 1112 la unidad elegida en el panel sigue al cerrarlo y reabrirlo, y en la columna al pasar a 1440 px', async ({
    page,
  }) => {
    const { execLongStep } = seeded();
    await page.setViewportSize(TABLET);
    await loginAndLand(page, operatorUser);
    await openScreen(page, assignedOrderRoute(execLongStep.id), TESTIDS.executionScreen);
    await waitForScreenEnterToSettle(page);

    const fab = page.getByTestId(TESTIDS.materialsFab);
    const panel = page.getByTestId(TESTIDS.materialsPanel);
    await openPanel(fab, panel);

    const unitInPanel = panel.getByTestId(`${TESTIDS.lineUnit}-0`);
    await expect(unitInPanel).not.toHaveText(ALTERNATIVE_UNIT_LABEL);
    const option = page.getByTestId(TESTIDS.lineUnitOption).filter({ hasText: new RegExp(`^${ALTERNATIVE_UNIT_LABEL}$`) });
    await clickUntilVisible(panel.getByTestId(`${TESTIDS.lineUnitSelect}-0`), option);
    await option.click();
    await expect(unitInPanel, 'R22: el panel muestra la unidad elegida').toHaveText(ALTERNATIVE_UNIT_LABEL);
    await expect(option).toBeHidden();

    await panel.getByTestId(TESTIDS.panelClose).click();
    await expect(panel).toHaveCount(0);
    await openPanel(fab, panel);
    await expect(
      panel.getByTestId(`${TESTIDS.lineUnit}-0`),
      'R22: al reabrir el panel la unidad sigue siendo la elegida',
    ).toHaveText(ALTERNATIVE_UNIT_LABEL);

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await page.setViewportSize(DESKTOP);
    const column = page.getByTestId(TESTIDS.executionColumn);
    await expect(column).toBeVisible();
    await expect(
      column.getByTestId(`${TESTIDS.lineUnit}-0`),
      'R22: al pasar a la columna la unidad sigue siendo la elegida',
    ).toHaveText(ALTERNATIVE_UNIT_LABEL);
  });
});
