/**
 * E2E de un pedido de UNA receta por la pantalla actual, con el pedido ya guardado en lineas: alta
 * por Pedidos, abrir y finalizar como Operador, empacar como Empacador, y comprobar que lo apartado,
 * lo consumido y el lote de producto terminado son los de siempre.
 *
 * Un unico `test()`: cada paso es la precondicion del siguiente.
 *
 * LOS ASERTOS SE LEEN DE LA BASE, lote a lote. El insumo tiene dos lotes -uno viejo que no alcanza
 * solo y uno nuevo- para que el reparto entre lotes (el mas antiguo primero) quede a la vista: con un
 * solo lote, un apartado que ignorase el orden saldria igual de verde.
 *
 * DATOS: el mismo patron de la suite. Todo lleva el prefijo `qt313_e2e_` y el `RUN_ID` del worker,
 * la limpieza de huerfanos borra por prefijo Y POR EDAD, y `afterAll` borra siempre, en el orden de
 * las FK. La empresa, los usuarios, el insumo con sus lotes, el envase y la receta se siembran por
 * Prisma; el pedido se crea, se abre, se finaliza y se empaca por la pantalla.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Prisma } from '@prisma/client';

import {
  normalizeCompanyName,
  ROLE_ADMINISTRADOR,
  ROLE_EMPACADOR,
  ROLE_OPERADOR,
} from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizePresentationName, normalizeProductName } from '@/lib/modules/inventario';
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

import {
  clickAndConfirm,
  enterAndStartAssignedOrder,
  ORDER_EXECUTION_FINISH_CONFIRM_TESTID,
  PACKING_ORDER_FINISH_CONFIRM_TESTID,
  PACKING_ORDER_START_CONFIRM_TESTID,
} from './helpers/confirm-dialog';
import { deleteOrdersWithLines } from './helpers/delete-orders';
import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { addPackagingLine } from './helpers/order-distribution';
import {
  applyOrderLine,
  chooseLineUnit,
  chooseRecipe,
  openAddOrderLine,
  openCreateOrderPanel,
  panelLines,
  saveOrder,
} from './helpers/order-form';
import { batchStock, seedPackaging } from './helpers/packaging';

const FIXTURE_PREFIX = 'qt313_e2e_';

const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit pueden correr a la vez, y puede haber otro worktree corriendo su propio E2E. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;

/** Nunca la empresa de instalacion: `companies_name_unique` es GLOBAL. */
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const PRODUCT_NAME = `${SHARED_TOKEN}_insumo`;
const PRESENTATION_NAME = `${SHARED_TOKEN}_bidon`;
const RECIPE_NAME = `${SHARED_TOKEN}_receta`;
const PACKAGING_NAME = `${SHARED_TOKEN}_envase`;
const PACKAGING_LOT = `${SHARED_TOKEN}_lote_envase`;

/** El lote viejo no alcanza solo: el apartado lo agota y completa con el nuevo. */
const OLD_LOT = { lot: `${SHARED_TOKEN}_lote_a`, stock: '30', unitCost: '10.0000', purchaseDate: '2026-01-01' } as const;
const NEW_LOT = { lot: `${SHARED_TOKEN}_lote_b`, stock: '100', unitCost: '12.0000', purchaseDate: '2026-02-01' } as const;

const PACKAGING_STOCK = '100';
const PACKAGING_UNIT_COST = '0.5000';

/** 50 envases de contenido 1: sin sobrante, Guardar no pregunta. */
const ORDER_QUANTITY = '50';
const ORDER_PACKAGES = '50';
const PRESENTATION_CONTENT = '1';

/** 30 del lote viejo a 10, 20 del nuevo a 12 y 50 envases a 0.5. */
const EXPECTED_ACTUAL_COST = '565.0000';
/** El coste real entre los 50 litros del lote de producto terminado. */
const EXPECTED_FINISHED_UNIT_COST = '11.3000';

const RECIPE_STEPS: readonly RecipeStepDocument[] = [
  {
    blocks: [
      {
        kind: 'checklist',
        items: [{ spans: [{ text: `${SHARED_TOKEN}_verificar_reactor` }] }],
      },
    ],
  },
];

const ASIGNACION_TITLE_TESTID = 'asignacion-title';
const EXECUTION_TITLE_TESTID = 'order-execution-title';
const STEP_CHECKLIST_ITEM_TESTID = 'step-reader-item-0-0';
const STEP_FINISH_TESTID = 'step-reader-finish';

type Credentials = { readonly username: string; readonly password: string };

const adminUser: Credentials = {
  username: `${SHARED_TOKEN}_admin`,
  password: `Qt313-Admin-${RUN_ID.slice(0, 12)}`,
};

/** Sin `pedidos.consultar`: solo asi `/asignacion` muestra «Mis asignados», con «Entrar». */
const operatorUser: Credentials = {
  username: `${SHARED_TOKEN}_operador`,
  password: `Qt313-Operador-${RUN_ID.slice(0, 12)}`,
};

const empacadorUser: Credentials = {
  username: `${SHARED_TOKEN}_empacador`,
  password: `Qt313-Empacador-${RUN_ID.slice(0, 12)}`,
};

let companyId: string | null = null;
let unitId: string | null = null;
let productId: string | null = null;
let oldBatchId: string | null = null;
let newBatchId: string | null = null;
let recipeId: string | null = null;
let presentationId: string | null = null;
let packagingId: string | null = null;
let packagingBatchId: string | null = null;
let operatorUserId: string | null = null;
let empacadorUserId: string | null = null;

function exactText(value: string): RegExp {
  return new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
}

function rowByNumber(page: Page, numberText: string): Locator {
  return page
    .locator('[data-testid^="data-table-row-"]')
    .filter({
      has: page.getByTestId('data-table-cell-orderNumber').filter({ hasText: exactText(numberText) }),
    });
}

/** En WebKit el refresco que deja un guardado anterior puede interrumpir la navegacion. */
async function gotoSettled(page: Page, url: string): Promise<void> {
  await expect(async () => {
    await page.goto(url);
  }).toPass({ timeout: 60_000 });
}

async function switchUser(page: Page, user: Credentials): Promise<void> {
  // Documento neutro antes de borrar cookies: la pagina anterior podria navegar a /login sola.
  await page.goto('about:blank');
  await page.context().clearCookies();
  await loginAndLand(page, user);
}

async function createUser(user: Credentials, roleId: string): Promise<string> {
  if (!companyId) throw new Error('la empresa del fixture no existe: fallo el beforeAll');

  const created = await createFixtureUser({
    data: {
      firstNames: `Qt313${RUN_ID.slice(0, 8)}`,
      lastNames: 'VariasRecetas',
      birthDate: new Date('1990-01-01'),
      email: `${user.username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: 'CC',
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

async function seedBatch(lot: typeof OLD_LOT | typeof NEW_LOT, createdBy: string): Promise<string> {
  const purchaseDate = new Date(`${lot.purchaseDate}T00:00:00Z`);
  const batch = await prisma.productBatch.create({
    data: {
      productId: productId!,
      presentationId: presentationId!,
      companyId: companyId!,
      stock: lot.stock,
      unitCost: lot.unitCost,
      lot: lot.lot,
      purchaseDate,
      createdBy,
    },
    select: { id: true },
  });
  await prisma.inventoryMovement.create({
    data: { batchId: batch.id, kind: 'opening', quantity: lot.stock, reason: null, companyId: companyId!, createdBy, createdAt: purchaseDate },
  });
  return batch.id;
}

/** Los asientos de reserva de la linea, por lote y tipo, con la cantidad en texto de 4 decimales. */
async function reservationsOf(orderLineId: string): Promise<readonly (readonly [string, string, string])[]> {
  const rows = await prisma.reservationMovement.findMany({
    where: { orderLineId },
    select: { batchId: true, kind: true, quantity: true },
  });
  return rows
    .map((row) => [row.batchId, row.kind, row.quantity.toFixed(4)] as const)
    .sort((a, b) => `${a[1]}${a[0]}`.localeCompare(`${b[1]}${b[0]}`));
}

function lotName(batchId: string): string {
  if (batchId === oldBatchId) return 'viejo';
  if (batchId === newBatchId) return 'nuevo';
  return batchId === packagingBatchId ? 'envase' : batchId;
}

test.beforeAll(async () => {
  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  const orphanCompanyIds = (
    await prisma.company.findMany({
      where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
      select: { id: true },
    })
  ).map((company) => company.id);
  if (orphanCompanyIds.length > 0) await dropCompanies(orphanCompanyIds);
  await prisma.user.deleteMany({
    where: { username: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
  });

  const roleId = async (name: string): Promise<string> => {
    const role = await prisma.role.findUnique({ where: { name }, select: { id: true } });
    if (!role) {
      throw new Error(`falta el rol "${name}": siembra la base con \`pnpm run db:seed\` antes de correr \`pnpm run e2e\`.`);
    }
    return role.id;
  };

  companyId = (
    await prisma.company.create({
      data: { name: COMPANY_NAME, nameNormalized: normalizeCompanyName(COMPANY_NAME) },
      select: { id: true },
    })
  ).id;

  const adminUserId = await createUser(adminUser, await roleId(ROLE_ADMINISTRADOR));
  operatorUserId = await createUser(operatorUser, await roleId(ROLE_OPERADOR));
  empacadorUserId = await createUser(empacadorUser, await roleId(ROLE_EMPACADOR));

  // Una de las unidades del catalogo arrancador, nunca creada ni borrada por este archivo.
  unitId = (
    await prisma.unit.findFirstOrThrow({ where: { nameNormalized: 'litro', companyId: null }, select: { id: true } })
  ).id;

  // `products.unit_id` se fija a mano: el disparador del lote exige que el producto ya tenga unidad.
  productId = (
    await prisma.product.create({
      data: {
        name: PRODUCT_NAME,
        nameNormalized: normalizeProductName(PRODUCT_NAME),
        unitId,
        stock: '130',
        companyId,
      },
      select: { id: true },
    })
  ).id;

  presentationId = (
    await prisma.presentation.create({
      data: {
        name: PRESENTATION_NAME,
        nameNormalized: normalizePresentationName(PRESENTATION_NAME),
        unitId,
        content: PRESENTATION_CONTENT,
        companyId,
      },
      select: { id: true },
    })
  ).id;

  oldBatchId = await seedBatch(OLD_LOT, adminUserId);
  newBatchId = await seedBatch(NEW_LOT, adminUserId);

  const packaging = await seedPackaging({
    companyId,
    name: PACKAGING_NAME,
    presentationId,
    stock: PACKAGING_STOCK,
    unitCost: PACKAGING_UNIT_COST,
    lot: PACKAGING_LOT,
    createdBy: adminUserId,
  });
  packagingId = packaging.productId;
  packagingBatchId = packaging.batchId;

  recipeId = (
    await prisma.recipe.create({
      data: {
        name: RECIPE_NAME,
        nameNormalized: normalizeRecipeName(RECIPE_NAME),
        createdBy: adminUserId,
        companyId,
        steps: RECIPE_STEPS as unknown as Prisma.InputJsonValue,
        lines: { create: [{ productId, percentage: '100.00' }] },
      },
      select: { id: true },
    })
  ).id;
});

/** Borra todo lo de las empresas dadas, en el orden de las FK. Sigue aunque un paso falle. */
async function dropCompanies(ids: readonly string[]): Promise<void> {
  const where = { companyId: { in: [...ids] } };
  const recipeIds = (await prisma.recipe.findMany({ where, select: { id: true } })).map((recipe) => recipe.id);
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    () => prisma.reservationMovement.deleteMany({ where }),
    () => prisma.inventoryMovement.deleteMany({ where }),
    () => prisma.orderAssignment.deleteMany({ where }),
    () => prisma.orderExecutionEntry.deleteMany({ where }),
    () => prisma.orderPresentationLine.deleteMany({ where }),
    () => deleteOrdersWithLines({ where }),
    () => prisma.productBatch.deleteMany({ where }),
    // El producto terminado (`products.recipe_id`) restringe el borrado de la receta, y la receta
    // (`recipe_lines.product_id`) el del insumo.
    () => prisma.product.deleteMany({ where: { recipeId: { in: recipeIds } } }),
    () => prisma.recipe.deleteMany({ where }),
    () => prisma.product.deleteMany({ where }),
    () => prisma.presentation.deleteMany({ where }),
    () => prisma.user.deleteMany({ where }),
    () => prisma.company.deleteMany({ where: { id: { in: [...ids] } } }),
  ];
  let primerFallo: unknown;
  for (const paso of pasos) {
    try {
      await paso();
    } catch (error) {
      primerFallo ??= error;
    }
  }
  if (primerFallo !== undefined) throw primerFallo;
}

test.afterAll(async () => {
  try {
    if (companyId) await dropCompanies([companyId]);
  } finally {
    await prisma.$disconnect();
  }
});

// El primer `goto` hace que `next dev` compile la ruta bajo demanda, y bcrypt tarda a proposito.
test.setTimeout(300_000);

test.describe('pedido con varias recetas: una receta por la pantalla actual', () => {
  test('QT-313 R46 - alta, abrir y finalizar como operador y empacar: apartado, consumo y lote de producto terminado iguales a hoy, lote a lote', async ({
    page,
  }) => {
    expect(recipeId, 'el fixture no existe: fallo el beforeAll').not.toBeNull();
    if (recipeId === null || oldBatchId === null || newBatchId === null) return;

    // --- 1. Alta por la pantalla de Pedidos: una receta, todo en un solo envase.
    await loginAndLand(page, adminUser);
    await gotoSettled(page, `${ORDERS_ROUTE}?pageSize=25`);
    await expect(page.getByTestId('pedidos-title')).toBeVisible({ timeout: 60_000 });
    // QT-314: el panel lleva la tabla de recetas; la receta se escribe en su sub-panel.
    const orderForm = await openCreateOrderPanel(page);
    const lineSheet = await openAddOrderLine(page, orderForm);

    // La receta, tomada del selector con busqueda; `chooseRecipe` comprueba el id elegido.
    await chooseRecipe(page, lineSheet, { id: recipeId, name: RECIPE_NAME });

    await lineSheet.getByTestId('order-field-quantity').fill(ORDER_QUANTITY);
    await chooseLineUnit(page, lineSheet, unitId ?? '');
    await addPackagingLine(page, lineSheet, { productId: packagingId ?? '', name: PACKAGING_NAME }, ORDER_PACKAGES);
    await expect(lineSheet.getByTestId('order-distribution-field').getByTestId('order-distribution-available')).toHaveAttribute(
      'data-state',
      'ready',
      { timeout: 60_000 },
    );
    await applyOrderLine(page, lineSheet);
    await expect(panelLines(orderForm)).toHaveCount(1);
    await saveOrder(page, orderForm);

    const order = await prisma.order.findFirstOrThrow({
      where: { companyId: companyId!, deletedAt: null },
      select: { id: true, orderYear: true, orderSequence: true, status: true },
    });
    const orderNumber = formatOrderNumber({ year: order.orderYear, sequence: order.orderSequence });
    await expect(rowByNumber(page, orderNumber)).toBeVisible({ timeout: 60_000 });

    // El alta deja una sola linea, con la receta y la cantidad del formulario.
    const lines = await prisma.orderLine.findMany({
      where: { orderId: order.id },
      select: { id: true, recipeId: true, quantity: true, unitId: true, status: true, position: true },
    });
    expect(lines).toHaveLength(1);
    const [line] = lines;
    if (line === undefined) return;
    expect([line.recipeId, line.quantity.toFixed(4), line.unitId, line.status]).toEqual([recipeId, '50.0000', unitId, 'PENDIENTE']);
    expect(order.status).toBe('PENDIENTE');

    // Apartado: el lote viejo entero (30), el resto del nuevo (20) y los 50 envases, todo a nombre
    // de la linea.
    const reserved = await reservationsOf(line.id);
    expect(reserved.filter(([, kind]) => kind === 'reserve').map(([batch, , qty]) => [lotName(batch), qty]).sort()).toEqual([
      ['envase', '50.0000'],
      ['nuevo', '20.0000'],
      ['viejo', '30.0000'],
    ]);
    expect(reserved.every(([, kind]) => kind === 'reserve')).toBe(true);

    // --- 2. El Operador abre y finaliza el pedido por la planta.
    await prisma.orderAssignment.create({ data: { orderId: order.id, userId: operatorUserId!, companyId: companyId! } });
    await switchUser(page, operatorUser);
    await page.goto(ASSIGNED_ORDERS_ROUTE);
    await expect(page.getByTestId(ASIGNACION_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });
    const assignedRow = rowByNumber(page, orderNumber);
    await expect(assignedRow).toHaveCount(1, { timeout: 60_000 });
    await enterAndStartAssignedOrder(page, assignedRow.getByTestId('assigned-order-enter'));
    await page.waitForURL((url) => url.pathname === assignedOrderRoute(order.id), { timeout: 60_000 });
    await expect(page.getByTestId(EXECUTION_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });

    expect((await prisma.orderLine.findUniqueOrThrow({ where: { id: line.id }, select: { status: true } })).status).toBe('EN_CURSO');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } })).status).toBe('EN_CURSO');

    await page.getByTestId(STEP_CHECKLIST_ITEM_TESTID).click();
    await clickAndConfirm(page, page.getByTestId(STEP_FINISH_TESTID), ORDER_EXECUTION_FINISH_CONFIRM_TESTID);
    await page.waitForURL(
      (url) => url.pathname === ASSIGNED_ORDERS_ROUTE && url.searchParams.has(DELIVERED_ORDER_PARAM),
      { timeout: 60_000 },
    );

    const afterFinish = await prisma.orderLine.findUniqueOrThrow({ where: { id: line.id }, select: { status: true, reservedAt: true } });
    expect([afterFinish.status, afterFinish.reservedAt]).toEqual(['POR_EMPACAR', null]);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } })).status).toBe('POR_EMPACAR');

    // Consumo: lo apartado de cada lote se resuelve como consumido y sale del lote, con la linea.
    const consumed = (await reservationsOf(line.id)).filter(([, kind]) => kind === 'consume');
    expect(consumed.map(([batch, , qty]) => [lotName(batch), qty]).sort()).toEqual([
      ['nuevo', '20.0000'],
      ['viejo', '30.0000'],
    ]);
    const consumptions = await prisma.inventoryMovement.findMany({
      where: { orderId: order.id, kind: 'consumption', batch: { productId: productId! } },
      select: { batchId: true, quantity: true, orderLineId: true },
    });
    expect(consumptions.map((row) => [lotName(row.batchId), row.quantity.toFixed(4), row.orderLineId]).sort()).toEqual([
      ['nuevo', '-20.0000', line.id],
      ['viejo', '-30.0000', line.id],
    ]);
    expect(await batchStock(oldBatchId)).toBe(0);
    expect(await batchStock(newBatchId)).toBe(80);
    expect(
      await prisma.product.count({ where: { companyId: companyId!, type: 'FINISHED_PRODUCT', recipeId } }),
      'Finalizar no da de alta producto terminado',
    ).toBe(0);

    // --- 3. El Empacador comienza y termina: Terminar da de alta el lote de producto terminado.
    await switchUser(page, empacadorUser);
    await page.goto(packingOrderRoute(order.id));
    await expect(page.getByTestId('packing-order-screen')).toBeVisible({ timeout: 60_000 });
    await clickAndConfirm(page, page.getByTestId('packing-order-start-button'), PACKING_ORDER_START_CONFIRM_TESTID);
    await expect(page.getByTestId('packing-order-finish-button')).toBeVisible({ timeout: 60_000 });
    await clickAndConfirm(page, page.getByTestId('packing-order-finish-button'), PACKING_ORDER_FINISH_CONFIRM_TESTID);
    await page.waitForURL(
      (url) => url.pathname === ASSIGNED_ORDERS_ROUTE && url.searchParams.has(PACKED_ORDER_PARAM),
      { timeout: 60_000 },
    );

    const packed = await prisma.orderLine.findUniqueOrThrow({
      where: { id: line.id },
      select: { status: true, packedBy: true, actualCost: true },
    });
    expect([packed.status, packed.packedBy, packed.actualCost?.toFixed(4)]).toEqual([
      'POR_ACONDICIONAR',
      empacadorUserId,
      EXPECTED_ACTUAL_COST,
    ]);
    expect(await batchStock(packagingBatchId!)).toBe(Number(PACKAGING_STOCK) - Number(ORDER_PACKAGES));
    // Empacado, a la linea no le queda nada apartado en ningun lote.
    const net = new Map<string, number>();
    for (const [batch, kind, qty] of await reservationsOf(line.id)) {
      net.set(lotName(batch), (net.get(lotName(batch)) ?? 0) + (kind === 'reserve' ? 1 : -1) * Number(qty));
    }
    expect([...net.entries()].sort()).toEqual([
      ['envase', 0],
      ['nuevo', 0],
      ['viejo', 0],
    ]);

    const finished = await prisma.product.findFirstOrThrow({
      where: { companyId: companyId!, type: 'FINISHED_PRODUCT', recipeId, presentationId: presentationId! },
      select: { id: true, name: true },
    });
    expect(finished.name).toBe(`${RECIPE_NAME} · ${PRESENTATION_NAME}`);
    const finishedBatches = await prisma.productBatch.findMany({
      where: { productId: finished.id },
      select: { id: true, stock: true, unitCost: true },
    });
    expect(finishedBatches.map((batch) => [batch.stock.toFixed(4), batch.unitCost?.toFixed(4) ?? null])).toEqual([
      ['50.0000', EXPECTED_FINISHED_UNIT_COST],
    ]);
    const production = await prisma.inventoryMovement.findMany({
      where: { orderId: order.id, kind: 'production' },
      select: { batchId: true, quantity: true, orderLineId: true },
    });
    expect(production.map((row) => [row.batchId, row.quantity.toFixed(4), row.orderLineId])).toEqual([
      [finishedBatches[0]?.id, '50.0000', line.id],
    ]);
  });
});
