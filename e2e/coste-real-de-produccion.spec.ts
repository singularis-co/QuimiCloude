/**
 * E2E del coste real de producción.
 *
 * Recorrido, en un solo `test()` porque cada paso es la precondición del siguiente:
 *   1. El Administrador da de alta por la pantalla un pedido de 6 l en 6 envases de 1 l. Su
 *      ingrediente tiene dos lotes de coste distinto, cada uno con menos existencia de la que el
 *      pedido acaba pidiendo, así que el consumo toma de los dos.
 *   2. El Operador lo comienza.
 *   3. El Administrador sube la cantidad a 8 l en `EN_CURSO`: el bloque de coste no recotiza, y el
 *      estimado guardado y el del listado siguen siendo los del alta.
 *   4. El Operador lo finaliza (consume el ingrediente) y el Empacador lo comienza y lo termina con
 *      7 envases en vez de 6 (Conteo físico).
 *   5. El listado muestra «Costo estimado» y «Costo real» contiguos; el real es la suma ponderada de
 *      los asientos de consumo que guardó la base, calculada aquí con enteros.
 *   6. La tab «Costo de producción» del producto terminado muestra el coste unitario del lote igual
 *      al real dividido entre lo envasado.
 *
 * Con `E2E_SCREENSHOTS_DIR` en el entorno, el proyecto chromium guarda capturas del listado en
 * escritorio y en teléfono en esa carpeta.
 *
 * AISLAMIENTO: prefijo `qc305_e2e_` + `RUN_ID` por worker, empresa efímera y limpieza de huérfanos
 * por prefijo Y POR EDAD, porque Chromium y WebKit pueden correr a la vez sobre la misma base.
 */
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Prisma } from '@prisma/client';

import {
  PACKING_FINISH_BADGE_TESTID,
  PACKING_FINISH_DIALOG_TEXTS,
  PACKING_FINISH_GATE_TESTID,
  PACKING_FINISH_INCREASE_TESTID,
  PACKING_FINISH_LINE_TESTID,
  PACKING_FINISH_REASON_OPTION_TESTID,
  PACKING_FINISH_REASON_TESTID,
} from '@/app/(private)/asignacion/empaque/[id]/components/packing-finish-dialog';
import { finishedProductTabHref } from '@/app/(private)/inventario/producto-terminado/[id]/components/finished-product-params';
import { formatOrderAmount } from '@/app/(private)/pedidos/components/order-amount';
import {
  DOCUMENT_TYPE_CC,
  normalizeCompanyName,
  ROLE_ADMINISTRADOR,
  ROLE_EMPACADOR,
  ROLE_OPERADOR,
} from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import {
  normalizePresentationName,
  normalizeProductName,
  PRODUCT_TYPES,
  productionCostTotal,
} from '@/lib/modules/inventario';
import { formatOrderNumber } from '@/lib/modules/pedidos';
import { normalizeRecipeName, type RecipeStepDocument } from '@/lib/modules/recetas';
import { prisma } from '@/lib/shared/db/prisma';
import {
  ASSIGNED_ORDERS_ROUTE,
  DELIVERED_ORDER_PARAM,
  ORDERS_ROUTE,
  PACKED_ORDER_PARAM,
  assignedOrderRoute,
  packingOrderRoute,
} from '@/lib/shared/routes';
import { exactDecimalTitle, formatMoneyDisplay, trimDecimal } from '@/lib/shared/ui/decimal-display';

import {
  clickAndConfirm,
  enterAndStartAssignedOrder,
  ORDER_EXECUTION_FINISH_CONFIRM_TESTID,
  PACKING_ORDER_START_CONFIRM_TESTID,
} from './helpers/confirm-dialog';
import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import {
  addPackagingLine,
  DISTRIBUTION_AVAILABLE_TESTID,
  openOrderRowMenu,
  orderMenuTrigger,
  submitOrderWithLeftover,
} from './helpers/order-distribution';
import { seedPackaging } from './helpers/packaging';

const FIXTURE_PREFIX = 'qc305_e2e_';

const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit corren a la vez: la limpieza defensiva no puede borrar por prefijo a secas. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;

/** Nunca la empresa de instalación: `companies_name_unique` es GLOBAL. */
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const RECIPE_NAME = `${SHARED_TOKEN}_receta`;
const INGREDIENT_NAME = `${SHARED_TOKEN}_ingrediente`;
const PRESENTATION_NAME = `${SHARED_TOKEN}_1l`;
const PACKAGING_NAME = `${SHARED_TOKEN}_garrafa`;

/** Los dos lotes del ingrediente: 4 + 6 l, ninguno cubre por sí solo los 8 l del pedido editado. */
const LOT_A = { suffix: 'a', stock: '4.0000', unitCost: '10.0000', purchaseDate: '2026-01-01T00:00:00Z' };
const LOT_B = { suffix: 'b', stock: '6.0000', unitCost: '20.0000', purchaseDate: '2026-02-01T00:00:00Z' };
const INGREDIENT_STOCK = '10.0000';

const PACKAGING_STOCK = '10';
const PACKAGING_UNIT_COST = '0.5000';

/** Alta: 6 l en 6 envases de 1 l. En `EN_CURSO` pasa a 8 l y Terminar cuenta 7 envases. */
const ORDER_QUANTITY = '6';
const EDITED_QUANTITY = '8';
const PLANNED_PACKAGES = 6;
const PACKED_PACKAGES = 7;

const RECIPE_STEPS: readonly RecipeStepDocument[] = [
  { blocks: [{ kind: 'checklist', items: [{ spans: [{ text: `${SHARED_TOKEN}_verificar` }] }] }] },
];

const ORDERS_TITLE_TESTID = 'pedidos-title';
const ORDER_CREATE_OPEN_TESTID = 'order-create-open';
const ORDER_ACTION_EDIT_TESTID = 'order-action-edit';
const ORDER_FORM_TESTID = 'order-form';
const ORDER_FORM_SUBMIT_TESTID = 'order-form-submit';
const ORDER_QUANTITY_FIELD_TESTID = 'order-field-quantity';
const ORDER_COST_QUOTE_VALUE_TESTID = 'order-cost-quote-value';
const ORDER_COST_QUOTE_QUOTING_TESTID = 'order-cost-quote-quoting';
const RECIPE_PICKER_TESTID = 'recipe-picker';
const RECIPE_PICKER_OPTION_TESTID = 'recipe-picker-option';
const RECIPE_PICKER_VALUE_TESTID = 'recipe-picker-value';
const UNIT_SELECT_TESTID = 'presentation-unit-select';
const UNIT_OPTION_TESTID = 'presentation-unit-option';

const ESTIMATED_COST_COLUMN_ID = 'productionCost';
const ACTUAL_COST_COLUMN_ID = 'actualCost';
const ESTIMATED_COST_TESTID = 'order-production-cost';
const ACTUAL_COST_TESTID = 'order-actual-cost';
const MISSING_ACTUAL_COST_TESTID = `order-missing-${ACTUAL_COST_COLUMN_ID}`;
const ESTIMATED_COST_LABEL = 'Costo estimado';
const ACTUAL_COST_LABEL = 'Costo real';
const TABLE_ROW_TESTID_PREFIX = 'data-table-row-';
const TABLE_HEAD_TESTID_PREFIX = 'data-table-head-';
const TABLE_CELL_TESTID_PREFIX = 'data-table-cell-';

const ASIGNACION_TITLE_TESTID = 'asignacion-title';
const ASSIGNED_ORDER_ENTER_TESTID = 'assigned-order-enter';
const ORDER_NUMBER_CELL_TESTID = 'data-table-cell-orderNumber';
const EXECUTION_TITLE_TESTID = 'order-execution-title';
const STEP_CHECKLIST_ITEM_TESTID = 'step-reader-item-0-0';
const STEP_FINISH_TESTID = 'step-reader-finish';
const PACKING_SCREEN_TESTID = 'packing-order-screen';
const PACKING_FINISH_BUTTON_TESTID = 'packing-order-finish-button';
const PACKING_FINISH_DIALOG_TESTID = 'packing-order-finish-dialog';
const PACKING_FINISH_CONFIRM_TESTID = 'packing-order-finish-confirm';
const PACKED_NOTICE_TESTID = 'packed-order-notice';

const COSTS_TAB_TESTID = 'finished-product-costo';
const COST_UNIT_TESTID = 'finished-product-cost-unit';
const COST_TOTAL_TESTID = 'finished-product-cost-total';

/** Teléfono: por debajo de 760 px de contenedor el listado pasa a tarjetas. */
const PHONE_VIEWPORT = { width: 390, height: 844 };

type Credentials = { readonly username: string; readonly password: string };

function credentials(suffix: string, label: string): Credentials {
  return {
    username: `${SHARED_TOKEN}_${suffix}`,
    password: `Qc305-${label}-${RUN_ID.slice(0, 12)}`,
  };
}

const adminUser = credentials('admin', 'Admin');
const operatorUser = credentials('operador', 'Operador');
const empacadorUser = credentials('empacador', 'Empacador');
const ALL_USERS = [adminUser, operatorUser, empacadorUser];

type Fixture = {
  readonly companyId: string;
  readonly recipeId: string;
  readonly litroUnitId: string;
  readonly presentationId: string;
  readonly packaging: { readonly productId: string; readonly batchId: string; readonly name: string };
  readonly lotIds: readonly [string, string];
  readonly operatorId: string;
};
let fixture: Fixture | null = null;

function seeded(): Fixture {
  if (fixture === null) throw new Error('el fixture no existe: falló el beforeAll');
  return fixture;
}

function exactText(value: string): RegExp {
  return new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
}

// --- Aritmética decimal exacta sobre cadenas de 4 decimales, sin coma flotante.

const SCALE = BigInt(4);
const TEN = BigInt(10);
const FACTOR = TEN ** SCALE;
const TWO = BigInt(2);
const ONE = BigInt(1);

/** `"123.4500"` → `1234500n`. Solo positivos con exactamente 4 decimales, como `toFixed(4)`. */
function scaled(value: string): bigint {
  const match = /^(\d+)\.(\d{4})$/.exec(value);
  if (match === null) throw new Error(`no es un decimal positivo de 4 decimales: ${value}`);
  return BigInt(`${match[1]}${match[2]}`);
}

function unscaled(value: bigint): string {
  return `${value / FACTOR}.${(value % FACTOR).toString().padStart(Number(SCALE), '0')}`;
}

function divideHalfUp(dividend: bigint, divisor: bigint): bigint {
  const quotient = dividend / divisor;
  return (dividend % divisor) * TWO >= divisor ? quotient + ONE : quotient;
}

/** Σ cantidad × coste, exacta, redondeada una sola vez a 4 decimales mitad arriba. */
function weightedSum(lots: readonly { readonly quantity: string; readonly unitCost: string }[]): string {
  const exact = lots.reduce((total, lot) => total + scaled(lot.quantity) * scaled(lot.unitCost), BigInt(0));
  return unscaled(divideHalfUp(exact, FACTOR));
}

function divideCost(total: string, quantity: string): string {
  return unscaled(divideHalfUp(scaled(total) * FACTOR, scaled(quantity)));
}

// --- Base.

async function createUser(companyId: string, user: Credentials, roleId: string, lastNames: string): Promise<string> {
  const created = await createFixtureUser({
    data: {
      firstNames: `Qc305${RUN_ID.slice(0, 8)}`,
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
      accountStatus: 'active',
    },
    select: { id: true },
  });
  return created.id;
}

/** En el orden que imponen las FK RESTRICT; cada paso corre aunque falle el anterior. */
async function deleteCompanyData(companyIds: readonly string[]): Promise<unknown> {
  if (companyIds.length === 0) return undefined;
  const where = { companyId: { in: [...companyIds] } };
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    () => prisma.orderAssignment.deleteMany({ where }),
    () => prisma.reservationMovement.deleteMany({ where }),
    () => prisma.inventoryMovement.deleteMany({ where }),
    () => prisma.orderPresentationLine.deleteMany({ where }),
    () => prisma.orderExecutionEntry.deleteMany({ where }),
    () => prisma.order.deleteMany({ where }),
    () => prisma.productBatch.deleteMany({ where }),
    () => prisma.product.deleteMany({ where: { ...where, type: PRODUCT_TYPES.FINISHED_PRODUCT } }),
    () => prisma.recipe.deleteMany({ where }),
    () => prisma.product.deleteMany({ where }),
    () => prisma.presentation.deleteMany({ where }),
    () => prisma.user.deleteMany({ where }),
    () => prisma.company.deleteMany({ where: { id: { in: [...companyIds] } } }),
  ];
  let primerFallo: unknown;
  for (const paso of pasos) {
    try {
      await paso();
    } catch (error) {
      primerFallo ??= error;
    }
  }
  return primerFallo;
}

/** Los importes del pedido como texto de 4 decimales: `NULL` no se confunde con `'0.0000'`. */
async function savedCosts(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true, ingredientsCost: true, actualCost: true },
  });
  return {
    status: order.status,
    estimated: order.ingredientsCost?.toFixed(4) ?? null,
    actual: order.actualCost?.toFixed(4) ?? null,
  };
}

/** Lo que el pedido consumió de cada lote, neto y en positivo, con el coste unitario del lote. */
async function consumedLots(orderId: string) {
  const { companyId } = seeded();
  const sums = await prisma.inventoryMovement.groupBy({
    by: ['batchId'],
    where: { companyId, orderId, kind: 'consumption' },
    _sum: { quantity: true },
  });
  const batches = await prisma.productBatch.findMany({
    where: { companyId, id: { in: sums.map((row) => row.batchId) } },
    select: { id: true, unitCost: true },
  });
  return sums.map((row) => {
    const batch = batches.find((candidate) => candidate.id === row.batchId);
    const quantity = row._sum.quantity?.negated();
    if (batch?.unitCost == null || quantity === undefined) {
      throw new Error(`el lote ${row.batchId} no tiene coste o cantidad consumida`);
    }
    return { batchId: row.batchId, quantity: quantity.toFixed(4), unitCost: batch.unitCost.toFixed(4) };
  });
}

// --- Pantalla.

async function switchUser(page: Page, user: Credentials): Promise<void> {
  await page.goto('about:blank');
  await page.context().clearCookies();
  await loginAndLand(page, user);
}

async function openOrders(page: Page): Promise<void> {
  // En WebKit el `router.refresh()` de un guardado anterior puede interrumpir la navegación.
  await expect(async () => {
    await page.goto(ORDERS_ROUTE);
  }).toPass({ timeout: 60_000 });
  await expect(page.getByTestId(ORDERS_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });
}

function orderRow(page: Page, orderId: string): Locator {
  return page.getByTestId(`${TABLE_ROW_TESTID_PREFIX}${orderId}`);
}

function assignedRowByNumber(page: Page, numberText: string): Locator {
  return page
    .locator(`[data-testid^="${TABLE_ROW_TESTID_PREFIX}"]`)
    .filter({ has: page.getByTestId(ORDER_NUMBER_CELL_TESTID).filter({ hasText: exactText(numberText) }) });
}

/** Los `data-testid` de las cabeceras o de las celdas de una fila, en el orden en que se pintan. */
async function columnOrder(scope: Locator, prefix: string): Promise<string[]> {
  return scope
    .locator(`[data-testid^="${prefix}"]`)
    .evaluateAll((nodes, start) =>
      nodes
        .map((node) => node.getAttribute('data-testid') ?? '')
        .filter((id) => /^[A-Za-z]+$/.test(id.slice(start.length)))
        .map((id) => id.slice(start.length)),
      prefix,
    );
}

async function expectAmountCell(cell: Locator, value: string): Promise<void> {
  await expect(cell).toHaveText(exactText(formatMoneyDisplay(value)), { timeout: 60_000 });
  const title = exactDecimalTitle(value);
  if (title === undefined) await expect(cell).not.toHaveAttribute('title');
  else await expect(cell).toHaveAttribute('title', title);
}

test.beforeAll(async () => {
  const roles = new Map<string, string>();
  for (const roleName of [ROLE_ADMINISTRADOR, ROLE_OPERADOR, ROLE_EMPACADOR]) {
    const role = await prisma.role.findUnique({ where: { name: roleName }, select: { id: true } });
    if (!role) {
      throw new Error(
        `falta el rol "${roleName}": sus permisos son el dato bajo prueba. Siembra la base con ` +
          '`pnpm run db:seed` antes de correr `pnpm run e2e`.',
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

  const companyId = (
    await prisma.company.create({
      data: { name: COMPANY_NAME, nameNormalized: normalizeCompanyName(COMPANY_NAME) },
      select: { id: true },
    })
  ).id;

  const adminId = await createUser(companyId, adminUser, roles.get(ROLE_ADMINISTRADOR)!, 'Administra');
  const operatorId = await createUser(companyId, operatorUser, roles.get(ROLE_OPERADOR)!, 'Opera');
  await createUser(companyId, empacadorUser, roles.get(ROLE_EMPACADOR)!, 'Empaca');

  const litro = await prisma.unit.findFirstOrThrow({
    where: { nameNormalized: 'litro', companyId: null },
    select: { id: true },
  });

  const presentationId = (
    await prisma.presentation.create({
      data: {
        name: PRESENTATION_NAME,
        nameNormalized: normalizePresentationName(PRESENTATION_NAME),
        unitId: litro.id,
        content: '1',
        companyId,
      },
      select: { id: true },
    })
  ).id;

  const packaging = await seedPackaging({
    companyId,
    name: PACKAGING_NAME,
    presentationId,
    stock: PACKAGING_STOCK,
    unitCost: PACKAGING_UNIT_COST,
    lot: `${RUN_ID.slice(0, 16)}_garrafa`,
    createdBy: adminId,
  });

  // `products.unit_id` a mano: el disparador del lote exige que el producto ya tenga unidad.
  const ingredientId = (
    await prisma.product.create({
      data: {
        name: INGREDIENT_NAME,
        nameNormalized: normalizeProductName(INGREDIENT_NAME),
        unitId: litro.id,
        stock: INGREDIENT_STOCK,
        companyId,
      },
      select: { id: true },
    })
  ).id;

  const lotIds: string[] = [];
  for (const lot of [LOT_A, LOT_B]) {
    const purchaseDate = new Date(lot.purchaseDate);
    const batchId = (
      await prisma.productBatch.create({
        data: {
          productId: ingredientId,
          presentationId,
          companyId,
          stock: lot.stock,
          unitCost: lot.unitCost,
          lot: `${RUN_ID.slice(0, 16)}_${lot.suffix}`,
          purchaseDate,
          createdBy: adminId,
        },
        select: { id: true },
      })
    ).id;
    await prisma.inventoryMovement.create({
      data: {
        batchId,
        kind: 'opening',
        quantity: lot.stock,
        reason: null,
        companyId,
        createdBy: adminId,
        createdAt: purchaseDate,
      },
    });
    lotIds.push(batchId);
  }

  const recipeId = (
    await prisma.recipe.create({
      data: {
        name: RECIPE_NAME,
        nameNormalized: normalizeRecipeName(RECIPE_NAME),
        createdBy: adminId,
        companyId,
        steps: RECIPE_STEPS as unknown as Prisma.InputJsonValue,
        lines: { create: [{ productId: ingredientId, percentage: '100.00' }] },
      },
      select: { id: true },
    })
  ).id;

  fixture = {
    companyId,
    recipeId,
    litroUnitId: litro.id,
    presentationId,
    packaging: { ...packaging, name: PACKAGING_NAME },
    lotIds: [lotIds[0]!, lotIds[1]!],
    operatorId,
  };
});

test.afterAll(async () => {
  const primerFallo = fixture === null ? undefined : await deleteCompanyData([fixture.companyId]);
  await prisma.user
    .deleteMany({ where: { username: { in: ALL_USERS.map((user) => user.username) } } })
    .catch(() => undefined);
  await prisma.$disconnect();
  if (primerFallo !== undefined) throw primerFallo;
});

// Seis inicios de sesión con bcrypt y cada ruta compilada bajo demanda por `next dev`.
test.setTimeout(600_000);

test.describe('coste real de producción', () => {
  test('R26, R1, R12, R16, R19, R21, R22 - el ingrediente se consume de dos lotes, el estimado no cambia al editar en EN_CURSO, Terminar con 7 envases en vez de 6 guarda el real ponderado de los asientos, el listado lo muestra junto al estimado y el lote de producto terminado cuesta real ÷ envasado', async ({
    page,
  }, testInfo) => {
    const { companyId, recipeId, litroUnitId, presentationId, packaging, lotIds, operatorId } = seeded();

    // --- 1. Alta por la pantalla: 6 l en 6 envases de 1 l.
    await loginAndLand(page, adminUser);
    await openOrders(page);
    await page.getByTestId(ORDER_CREATE_OPEN_TESTID).first().click();
    const form = page.getByTestId(ORDER_FORM_TESTID);
    await expect(form).toBeVisible({ timeout: 60_000 });

    const recipePicker = form.getByTestId(RECIPE_PICKER_TESTID);
    await recipePicker.click();
    await recipePicker.fill(RECIPE_NAME);
    const recipeOption = page.getByTestId(RECIPE_PICKER_OPTION_TESTID).filter({ hasText: RECIPE_NAME });
    await expect(recipeOption).toHaveCount(1, { timeout: 60_000 });
    await recipeOption.click();
    await expect(form.getByTestId(RECIPE_PICKER_VALUE_TESTID)).toHaveValue(recipeId);

    await form.getByTestId(ORDER_QUANTITY_FIELD_TESTID).fill(ORDER_QUANTITY);
    await form.getByTestId(UNIT_SELECT_TESTID).click();
    await page.locator(`[data-testid="${UNIT_OPTION_TESTID}"][data-value="${litroUnitId}"]`).click();
    await expect(form.getByTestId(DISTRIBUTION_AVAILABLE_TESTID)).toBeVisible({ timeout: 60_000 });
    await addPackagingLine(page, form, packaging, String(PLANNED_PACKAGES));
    await expect(form.getByTestId(DISTRIBUTION_AVAILABLE_TESTID)).toHaveAttribute('data-state', 'ready', {
      timeout: 60_000,
    });
    await expect(page.getByTestId(ORDER_COST_QUOTE_VALUE_TESTID)).toHaveText(/\d/, { timeout: 60_000 });

    await form.getByTestId(ORDER_FORM_SUBMIT_TESTID).click();
    await expect(page.getByTestId(ORDER_FORM_TESTID)).toHaveCount(0, { timeout: 60_000 });

    const order = await prisma.order.findFirstOrThrow({
      where: { companyId, recipeId, deletedAt: null },
      select: { id: true, orderYear: true, orderSequence: true },
    });
    const numberText = formatOrderNumber({ year: order.orderYear, sequence: order.orderSequence });
    const created = await savedCosts(order.id);
    expect(created.status).toBe('PENDIENTE');
    expect(created.estimated, 'el alta guarda el estimado').not.toBeNull();
    expect(created.actual, 'sin Terminar no hay coste real').toBeNull();
    const estimated = created.estimated!;

    // --- 2. El Operador lo comienza.
    await prisma.orderAssignment.create({ data: { orderId: order.id, userId: operatorId, companyId } });
    await switchUser(page, operatorUser);
    await page.goto(ASSIGNED_ORDERS_ROUTE);
    await expect(page.getByTestId(ASIGNACION_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });
    const assignedRow = assignedRowByNumber(page, numberText);
    await expect(assignedRow).toHaveCount(1, { timeout: 60_000 });
    await enterAndStartAssignedOrder(page, assignedRow.getByTestId(ASSIGNED_ORDER_ENTER_TESTID));
    expect((await savedCosts(order.id)).status).toBe('EN_CURSO');

    // --- 3. En `EN_CURSO` la cantidad pasa a 8 l y el estimado no se mueve.
    await switchUser(page, adminUser);
    await openOrders(page);
    await (await openOrderRowMenu(page, orderMenuTrigger(page, order.id), ORDER_ACTION_EDIT_TESTID)).click();
    const editForm = page.getByTestId(ORDER_FORM_TESTID);
    await expect(editForm).toBeVisible({ timeout: 60_000 });
    const quote = page.getByTestId(ORDER_COST_QUOTE_VALUE_TESTID);
    await expect(quote).toHaveText(exactText(formatOrderAmount(estimated)), { timeout: 60_000 });

    await editForm.getByTestId(ORDER_QUANTITY_FIELD_TESTID).fill(EDITED_QUANTITY);
    await expect(page.getByTestId(ORDER_COST_QUOTE_QUOTING_TESTID)).toHaveCount(0);
    await expect(quote).toHaveText(exactText(formatOrderAmount(estimated)));

    // 8 l repartidos en 6 envases de 1 l dejan 2 l sin envasar: Guardar pregunta antes.
    await submitOrderWithLeftover(page, editForm);
    await expect(page.getByTestId(ORDER_FORM_TESTID)).toHaveCount(0, { timeout: 60_000 });

    const edited = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { quantity: true } });
    expect(edited.quantity.toFixed(4)).toBe(`${EDITED_QUANTITY}.0000`);
    expect(await savedCosts(order.id)).toEqual({ status: 'EN_CURSO', estimated, actual: null });

    await openOrders(page);
    const editedRow = orderRow(page, order.id);
    await expectAmountCell(editedRow.getByTestId(ESTIMATED_COST_TESTID), estimated);
    await expect(editedRow.getByTestId(MISSING_ACTUAL_COST_TESTID)).toBeVisible();

    // --- 4. El Operador finaliza: consume los 8 l del ingrediente.
    await switchUser(page, operatorUser);
    await page.goto(assignedOrderRoute(order.id));
    await expect(page.getByTestId(EXECUTION_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });
    // Un clic antes de hidratar se pierde sin error: se repite hasta que la casilla quede marcada.
    const checklistItem = page.getByTestId(STEP_CHECKLIST_ITEM_TESTID);
    await expect(async () => {
      if (!(await checklistItem.isChecked())) await checklistItem.click();
      await expect(checklistItem).toBeChecked({ timeout: 2_000 });
    }).toPass({ timeout: 60_000 });
    await clickAndConfirm(page, page.getByTestId(STEP_FINISH_TESTID), ORDER_EXECUTION_FINISH_CONFIRM_TESTID);
    await page.waitForURL(
      (url) => url.pathname === ASSIGNED_ORDERS_ROUTE && url.searchParams.has(DELIVERED_ORDER_PARAM),
      { timeout: 60_000 },
    );
    expect((await savedCosts(order.id)).status).toBe('POR_EMPACAR');

    // El ingrediente salió de sus dos lotes, de coste distinto.
    const ingredientLots = (await consumedLots(order.id)).filter((lot) => lotIds.includes(lot.batchId));
    expect(ingredientLots.map((lot) => lot.batchId).sort()).toEqual([...lotIds].sort());
    expect(new Set(ingredientLots.map((lot) => lot.unitCost)).size).toBe(2);

    // --- 5. El Empacador comienza y termina con 7 envases en vez de 6.
    await switchUser(page, empacadorUser);
    await page.goto(packingOrderRoute(order.id));
    await expect(page.getByTestId(PACKING_SCREEN_TESTID)).toBeVisible({ timeout: 60_000 });
    await clickAndConfirm(page, page.getByTestId('packing-order-start-button'), PACKING_ORDER_START_CONFIRM_TESTID);
    const finishButton = page.getByTestId(PACKING_FINISH_BUTTON_TESTID);
    await expect(finishButton).toBeVisible({ timeout: 60_000 });
    const dialog = page.getByTestId(PACKING_FINISH_DIALOG_TESTID);
    await expect(async () => {
      if ((await dialog.count()) === 0) await finishButton.click();
      await expect(dialog).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });

    const line = await prisma.orderPresentationLine.findFirstOrThrow({
      where: { orderId: order.id },
      select: { id: true },
    });
    const dialogLine = dialog.locator(`[data-testid="${PACKING_FINISH_LINE_TESTID}"][data-line-id="${line.id}"]`);
    await dialogLine.getByTestId(PACKING_FINISH_INCREASE_TESTID).click();
    await expect(dialogLine.getByTestId(PACKING_FINISH_BADGE_TESTID)).toHaveText(exactText('+1'));
    await dialogLine.getByTestId(PACKING_FINISH_REASON_TESTID).click();
    const conteoFisico = PACKING_FINISH_DIALOG_TEXTS.reasons.conteo_fisico;
    await page
      .getByTestId(PACKING_FINISH_REASON_OPTION_TESTID)
      .filter({ visible: true, hasText: exactText(conteoFisico) })
      .click();
    await expect(dialogLine.getByTestId(PACKING_FINISH_REASON_TESTID)).toContainText(conteoFisico);
    await expect(dialog.getByTestId(PACKING_FINISH_GATE_TESTID)).toHaveText(exactText(''));
    await dialog.getByTestId(PACKING_FINISH_CONFIRM_TESTID).click();
    await page.waitForURL(
      (url) => url.pathname === ASSIGNED_ORDERS_ROUTE && url.searchParams.get(PACKED_ORDER_PARAM) !== null,
      { timeout: 60_000 },
    );
    await expect(page.getByTestId(PACKED_NOTICE_TESTID)).toContainText(numberText, { timeout: 60_000 });

    const packedLine = await prisma.orderPresentationLine.findUniqueOrThrow({
      where: { id: line.id },
      select: { packages: true, packedPackages: true },
    });
    expect(packedLine).toEqual({ packages: PLANNED_PACKAGES, packedPackages: PACKED_PACKAGES });

    // El real es Σ cantidad × coste de TODOS los asientos de consumo (ingrediente y envases).
    const lots = await consumedLots(order.id);
    expect(lots.map((lot) => lot.batchId)).toContain(packaging.batchId);
    expect(lots.find((lot) => lot.batchId === packaging.batchId)?.quantity).toBe(`${PACKED_PACKAGES}.0000`);
    const expectedActual = weightedSum(lots);
    const finished = await savedCosts(order.id);
    expect(finished.status).toBe('POR_ACONDICIONAR');
    expect(finished.actual).toBe(expectedActual);
    expect(finished.estimated, 'R6, R12: Terminar tampoco toca el estimado').toBe(estimated);
    expect(finished.actual).not.toBe(finished.estimated);

    // --- 6. El listado, «Costo estimado» y «Costo real» contiguos y en ese orden.
    await switchUser(page, adminUser);
    await openOrders(page);
    const row = orderRow(page, order.id);
    await expect(row).toBeVisible({ timeout: 60_000 });

    const headers = await columnOrder(page.locator('thead'), TABLE_HEAD_TESTID_PREFIX);
    const estimatedHeader = headers.indexOf(ESTIMATED_COST_COLUMN_ID);
    expect(estimatedHeader).toBeGreaterThanOrEqual(0);
    expect(headers[estimatedHeader + 1]).toBe(ACTUAL_COST_COLUMN_ID);
    await expect(page.getByTestId(`${TABLE_HEAD_TESTID_PREFIX}${ESTIMATED_COST_COLUMN_ID}`)).toContainText(
      ESTIMATED_COST_LABEL,
    );
    await expect(page.getByTestId(`${TABLE_HEAD_TESTID_PREFIX}${ACTUAL_COST_COLUMN_ID}`)).toContainText(
      ACTUAL_COST_LABEL,
    );

    const cells = await columnOrder(row, TABLE_CELL_TESTID_PREFIX);
    expect(cells[cells.indexOf(ESTIMATED_COST_COLUMN_ID) + 1]).toBe(ACTUAL_COST_COLUMN_ID);
    await expectAmountCell(row.getByTestId(ESTIMATED_COST_TESTID), estimated);
    await expectAmountCell(row.getByTestId(ACTUAL_COST_TESTID), expectedActual);

    const screenshotsDir = process.env.E2E_SCREENSHOTS_DIR;
    const desktopViewport = page.viewportSize();
    if (screenshotsDir !== undefined && testInfo.project.name === 'chromium') {
      await row.getByTestId(ACTUAL_COST_TESTID).scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(screenshotsDir, 'escritorio.png') });
    }

    // La tarjeta de telefono lleva los dos costes rotulados.
    await page.setViewportSize(PHONE_VIEWPORT);
    await openOrders(page);
    const card = page.getByTestId(`data-table-card-${order.id}`);
    await expect(card).toBeVisible({ timeout: 60_000 });
    const cardEstimated = card.getByTestId(`data-table-card-field-${ESTIMATED_COST_COLUMN_ID}`);
    const cardActual = card.getByTestId(`data-table-card-field-${ACTUAL_COST_COLUMN_ID}`);
    await expect(cardEstimated).toContainText(ESTIMATED_COST_LABEL);
    await expect(cardActual).toContainText(ACTUAL_COST_LABEL);
    await expectAmountCell(cardEstimated.getByTestId(ESTIMATED_COST_TESTID), estimated);
    await expectAmountCell(cardActual.getByTestId(ACTUAL_COST_TESTID), expectedActual);
    if (screenshotsDir !== undefined && testInfo.project.name === 'chromium') {
      await page.screenshot({ path: join(screenshotsDir, 'telefono.png'), fullPage: true });
    }
    if (desktopViewport !== null) await page.setViewportSize(desktopViewport);

    // --- 7. El lote de producto terminado cuesta real ÷ envasado (7 l).
    const batch = await prisma.productBatch.findFirstOrThrow({
      where: {
        companyId,
        presentationId,
        product: { type: PRODUCT_TYPES.FINISHED_PRODUCT },
        movements: { some: { kind: 'production', orderId: order.id } },
      },
      select: { id: true, productId: true, stock: true, unitCost: true },
    });
    const packedQuantity = batch.stock.toFixed(4);
    expect(packedQuantity).toBe(`${PACKED_PACKAGES}.0000`);
    const expectedUnitCost = divideCost(expectedActual, packedQuantity);
    expect(batch.unitCost?.toFixed(4)).toBe(expectedUnitCost);

    const costRow = page
      .getByTestId(COSTS_TAB_TESTID)
      .locator(`[data-testid="${TABLE_ROW_TESTID_PREFIX}${batch.id}"]`);
    await expect(async () => {
      await page.goto(finishedProductTabHref(batch.productId, 'costo'));
      await expect(costRow).toBeVisible({ timeout: 20_000 });
    }).toPass({ timeout: 120_000 });
    await expect(costRow.getByTestId(COST_UNIT_TESTID)).toHaveText(exactText(trimDecimal(expectedUnitCost)));
    await expect(costRow.getByTestId(COST_TOTAL_TESTID)).toHaveText(
      exactText(trimDecimal(productionCostTotal(expectedUnitCost, packedQuantity))),
    );
  });
});
