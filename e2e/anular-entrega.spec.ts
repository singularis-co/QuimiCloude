/**
 * E2E de la anulacion de una entrega desde la lista «Entregas» del menu de fila de Pedidos.
 *
 * EL RECORRIDO del Administrador va en un solo `test()`: cada paso es la precondicion del
 * siguiente y partirlo obligaria a resembrar lo que dejo el anterior.
 *   1. abre «Entregas» desde el menu de la fila del pedido `ENTREGADO`;
 *   2. pulsa «Anular», desmarca una presentacion y confirma sin motivo: aparece el aviso y en
 *      Postgres no cambia nada;
 *   3. escribe el motivo y confirma; en Postgres el lote de la presentacion anulada recupera su
 *      existencia, hay un asiento `delivery_void`, la fila de `order_delivery_voids` lleva el motivo,
 *      la entrega y sus asientos siguen intactos y el pedido vuelve a `TERMINADO`;
 *   4. la lista pinta la presentacion anulada con su motivo y la fila del pedido pasa a «Terminado»;
 *   5. «Entregar» vuelve a ofrecer esa presentacion como pendiente.
 * Un segundo `test()` entra con un usuario que consulta pedidos pero no puede anular entregas:
 * abre «Entregas» y no ve «Anular».
 *
 * QUE APORTA SOBRE UNIT E INTEGRACION: la lista, el dialogo y la Server Action de verdad, contra un
 * navegador real y Postgres. Chromium y WebKit: WebKit es el motor de iOS y la regla
 * multiplataforma pide ejercitarlo.
 *
 * DATOS, mismo patron que `e2e/entregar-producto-terminado.spec.ts`:
 *  - todo lo que este archivo crea lleva el prefijo `qc224_e2e_` y dentro el `RUN_ID` del worker;
 *  - una empresa efimera propia, asi que la lista de pedidos solo ve lo de este worker;
 *  - la limpieza defensiva de huerfanos borra por prefijo Y POR EDAD, para no llevarse lo que otra
 *    ejecucion viva acaba de crear;
 *  - `afterAll` borra SIEMPRE, aunque un paso reviente, por los identificadores de ESTE worker y en
 *    el orden que imponen las FK.
 *
 * SEMBRADO POR PRISMA todo lo previo a la anulacion: empresa, Administrador, un rol sintetico que
 * solo consulta pedidos y su usuario, un cliente, una unidad del catalogo arrancador (nunca creada
 * ni borrada aqui), dos presentaciones con contenido, la receta, un producto terminado por
 * presentacion con su lote, y el pedido `ENTREGADO` con una entrega de las dos presentaciones, cada
 * una desde su lote, con sus asientos `delivery` y la existencia de los lotes ya rebajada.
 *
 * LOS `data-testid` VAN COMO CONSTANTES LOCALES y no importados de los componentes: sus modulos
 * son de cliente y arrastrarian React al proceso del runner.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { normalizeCustomerText } from '@/lib/modules/clientes';
import { DOCUMENT_TYPE_CC, ROLE_ADMINISTRADOR, normalizeCompanyName } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizePresentationName, normalizeProductName } from '@/lib/modules/inventario';
import { normalizeRecipeName } from '@/lib/modules/recetas';
import { prisma } from '@/lib/shared/db/prisma';
import { ORDERS_ROUTE } from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { openOrderRowMenu, orderMenuTrigger } from './helpers/order-distribution';

/** Prefijo con el que este spec marca TODO lo que crea. Nada fuera de el se toca. */
const FIXTURE_PREFIX = 'qc224_e2e_';

/** Identificador unico de este proceso de worker. */
const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit corren a la vez: la limpieza defensiva no puede borrar por prefijo a secas. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;

/** Nunca la empresa de instalacion: `companies_name_unique` es GLOBAL. */
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const READ_ONLY_ROLE_NAME = `${SHARED_TOKEN}_rol_consulta`;
const READ_ONLY_PERMISSION = 'pedidos.consultar';
const RECIPE_NAME = `${SHARED_TOKEN}_receta`;
const PRESENTATION_ONE_NAME = `${SHARED_TOKEN}_botella_1`;
const PRESENTATION_TWO_NAME = `${SHARED_TOKEN}_garrafa_2`;
const FINISHED_ONE_NAME = `${SHARED_TOKEN}_terminado_1`;
const FINISHED_TWO_NAME = `${SHARED_TOKEN}_terminado_2`;
const LOT_ONE = `${SHARED_TOKEN}_lote_1`;
const LOT_TWO = `${SHARED_TOKEN}_lote_2`;

type Credentials = { readonly username: string; readonly password: string };

const adminUser: Credentials = {
  username: `${SHARED_TOKEN}_admin`,
  password: `Qc224-Admin-${RUN_ID.slice(0, 12)}`,
};
/** Consulta pedidos pero no puede anular entregas: control negativo de la accion. */
const readOnlyUser: Credentials = {
  username: `${SHARED_TOKEN}_consulta`,
  password: `Qc224-Cons-${RUN_ID.slice(0, 12)}`,
};

const CUSTOMER_FIRST_NAMES = `Ana ${RUN_ID.slice(0, 10)}`;
const CUSTOMER_LAST_NAMES = 'Anulacion';

/**
 * Cantidades del fixture. Presentacion 1 con contenido 1 y presentacion 2 con contenido 2. El
 * pedido pide 3 envases de la 1 y 2 de la 2, y la entrega los lleva todos: por eso esta
 * `ENTREGADO`.
 */
const CONTENT_ONE = '1.0000';
const CONTENT_TWO = '2.0000';
const LINE_ONE_PACKAGES = 3;
const LINE_TWO_PACKAGES = 2;
/** 3 envases de 1 entregados. */
const DELIVERED_ONE_QUANTITY = '3.0000';
/** 2 envases de 2 entregados. */
const DELIVERED_TWO_QUANTITY = '4.0000';
/** Lo que queda en cada lote tras la entrega: 1 envase de 1 y 1 envase de 2. */
const STOCK_ONE_AFTER_DELIVERY = '1.0000';
const STOCK_TWO_AFTER_DELIVERY = '2.0000';
/** El lote 2 recupera lo entregado de su presentacion. */
const STOCK_TWO_AFTER_VOID = '6.0000';

const VOID_REASON = `Devuelta por el cliente ${RUN_ID.slice(0, 8)}`;

/** El ano sale del reloj: el CHECK `orders_order_year_matches_created_at` lo ata a `created_at`. */
const ORDER_SEQUENCE = 880_000 + Math.floor(Math.random() * 80_000);
const FINISHED_AT = new Date(Date.now() - 6 * 60 * 60 * 1000);
const DELIVERED_AT = new Date(Date.now() - 2 * 60 * 60 * 1000);

/** `data-testid` de la pantalla de Pedidos, de la lista de entregas, del dialogo y del panel de entrega. */
const ORDERS_TITLE_TESTID = 'pedidos-title';
const DATA_TABLE_TESTID = 'data-table';
const TABLE_ROW_TESTID_PREFIX = 'data-table-row-';
const ORDER_STATUS_TESTID = 'order-status';
const ORDER_ACTION_DELIVERIES_TESTID = 'order-action-deliveries';
const ORDER_ACTION_DELIVER_TESTID = 'order-action-deliver';
const DELIVERIES_SHEET_TESTID = 'order-deliveries-sheet';
const DELIVERY_ENTRY_TESTID = 'order-delivery-entry';
const DELIVERY_ENTRY_PRESENTATION_TESTID = 'order-delivery-entry-presentation';
const DELIVERY_ENTRY_VOIDED_TESTID = 'order-delivery-entry-voided';
const DELIVERY_ENTRY_VOID_REASON_TESTID = 'order-delivery-entry-void-reason';
const DELIVERY_VOID_TESTID = 'order-delivery-void';
const VOID_DIALOG_TESTID = 'delivery-void-dialog';
const VOID_PRESENTATION_TESTID = 'delivery-void-presentation';
const VOID_REASON_TESTID = 'delivery-void-reason';
const VOID_REASON_ERROR_TESTID = 'delivery-void-reason-error';
const VOID_CONFIRM_TESTID = 'delivery-void-confirm';
const VOID_ERROR_TESTID = 'delivery-void-error';
const VOID_REJECTED_TESTID = 'delivery-void-rejected';
const DELIVERY_SHEET_TESTID = 'order-delivery-sheet';
const DELIVERY_SUBMIT_TESTID = 'order-delivery-submit';
const DELIVERY_LINE_TESTID = 'order-delivery-line';
const DELIVERY_LINE_COMPLETE_TESTID = 'order-delivery-line-complete';
const DELIVERY_BATCH_TESTID = 'order-delivery-batch';
const DELIVERY_BATCH_PACKAGES_TESTID = 'order-delivery-batch-packages';

let companyId: string | null = null;
let adminUserId: string | null = null;
let recipeId: string | null = null;
let orderId: string | null = null;
let deliveryId: string | null = null;
let lineOneId: string | null = null;
let lineTwoId: string | null = null;
let batchOneId: string | null = null;
let batchTwoId: string | null = null;
let productTwoId: string | null = null;

function required<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`falta ${what}: fallo el beforeAll`);
  return value;
}

/** URL de Pedidos, SIEMPRE derivada de `ORDERS_ROUTE`. */
function ordersUrl(): string {
  const query = new URLSearchParams({ pageSize: '25', sort: 'createdAt:desc' });
  return `${ORDERS_ROUTE}?${query.toString()}`;
}

function orderRow(page: Page, id: string): Locator {
  return page.locator(`[data-testid="${TABLE_ROW_TESTID_PREFIX}${id}"]`);
}

function entryPresentation(sheet: Locator, presentationLineId: string): Locator {
  return sheet.locator(
    `[data-testid="${DELIVERY_ENTRY_PRESENTATION_TESTID}"][data-presentation-line-id="${presentationLineId}"]`,
  );
}

function voidCheckbox(dialog: Locator, presentationLineId: string): Locator {
  return dialog.locator(
    `[data-testid="${VOID_PRESENTATION_TESTID}"][data-presentation-line-id="${presentationLineId}"]`,
  );
}

function deliveryLine(sheet: Locator, presentationLineId: string): Locator {
  return sheet.locator(
    `[data-testid="${DELIVERY_LINE_TESTID}"][data-presentation-line-id="${presentationLineId}"]`,
  );
}

/** En WebKit el refresco que deja una accion anterior puede interrumpir la navegacion. */
async function gotoOrders(page: Page): Promise<void> {
  await expect(async () => {
    await page.goto(ordersUrl());
  }).toPass({ timeout: 60_000 });
  await expect(page.getByTestId(ORDERS_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(DATA_TABLE_TESTID)).toBeVisible({ timeout: 60_000 });
}

/** Abre «Entregas» desde el menu de la fila y espera a que la lista pinte la entrega. */
async function openDeliveriesSheet(page: Page, id: string, entryId: string): Promise<Locator> {
  await expect(orderRow(page, id)).toHaveCount(1, { timeout: 60_000 });
  await (await openOrderRowMenu(page, orderMenuTrigger(page, id), ORDER_ACTION_DELIVERIES_TESTID)).click();
  const sheet = page.getByTestId(DELIVERIES_SHEET_TESTID);
  await expect(sheet).toBeVisible({ timeout: 60_000 });
  await expect(
    sheet.locator(`[data-testid="${DELIVERY_ENTRY_TESTID}"][data-delivery-id="${entryId}"]`),
  ).toBeVisible({ timeout: 60_000 });
  return sheet;
}

/** Pulsa «Anular» de la entrega. En WebKit un clic antes de hidratar se pierde: se repite. */
async function openVoidDialog(page: Page, sheet: Locator): Promise<Locator> {
  const trigger = sheet.getByTestId(DELIVERY_VOID_TESTID);
  const dialog = page.getByTestId(VOID_DIALOG_TESTID);
  await expect(async () => {
    if ((await dialog.count()) === 0) await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  return dialog;
}

/** Lo que una anulacion escribiria: si no cambia, no se envio nada. */
async function voidFootprint(id: string, entryId: string) {
  const [voids, voidLines, movements, batches] = await Promise.all([
    prisma.orderDeliveryVoid.count({ where: { deliveryId: entryId } }),
    prisma.orderDeliveryVoidLine.count({ where: { deliveryId: entryId } }),
    prisma.inventoryMovement.count({ where: { orderId: id } }),
    prisma.productBatch.findMany({
      where: { id: { in: [required(batchOneId, 'el lote 1'), required(batchTwoId, 'el lote 2')] } },
      select: { id: true, stock: true },
      orderBy: { id: 'asc' },
    }),
  ]);
  const order = await prisma.order.findUniqueOrThrow({ where: { id }, select: { status: true } });
  return {
    voids,
    voidLines,
    movements,
    stocks: batches.map((batch) => `${batch.id}:${batch.stock.toFixed(4)}`),
    status: order.status,
  };
}

async function createUser(user: Credentials, roleId: string): Promise<string> {
  const created = await createFixtureUser({
    data: {
      firstNames: `Qc224${RUN_ID.slice(0, 8)}`,
      lastNames: 'Anulacion',
      birthDate: new Date('1990-01-01'),
      email: `${user.username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: user.username,
      username: user.username,
      passwordHash: await createPasswordHash(user.password),
      roleId,
      companyId: required(companyId, 'la empresa'),
      // Explicito: la columna es `@default(pending)` y ese estado no entra por el login.
      accountStatus: 'active',
    },
    select: { id: true },
  });
  return created.id;
}

async function createFinishedProduct(params: {
  name: string;
  unitId: string;
  presentationId: string;
  stock: string;
}): Promise<string> {
  const created = await prisma.product.create({
    data: {
      name: params.name,
      nameNormalized: normalizeProductName(params.name),
      type: 'FINISHED_PRODUCT',
      unitId: params.unitId,
      stock: params.stock,
      recipeId: required(recipeId, 'la receta'),
      presentationId: params.presentationId,
      companyId: required(companyId, 'la empresa'),
    },
    select: { id: true },
  });
  return created.id;
}

async function createFinishedBatch(params: {
  productId: string;
  presentationId: string;
  lot: string;
  stock: string;
  packageContent: string;
}): Promise<string> {
  const created = await prisma.productBatch.create({
    data: {
      productId: params.productId,
      presentationId: params.presentationId,
      stock: params.stock,
      unitCost: '1.0000',
      packageContent: params.packageContent,
      lot: params.lot,
      purchaseDate: new Date('2026-09-01T00:00:00Z'),
      companyId: required(companyId, 'la empresa'),
      createdBy: adminUserId,
    },
    select: { id: true },
  });
  return created.id;
}

/** Borra en el orden de las FK todo lo que cuelga de esas empresas. */
async function deleteCompanyRows(companyIds: readonly string[]): Promise<void> {
  const inCompanies = { companyId: { in: [...companyIds] } };
  await prisma.reservationMovement.deleteMany({ where: inCompanies });
  // El asiento de anulacion apunta a la anulacion: va antes que ella.
  await prisma.inventoryMovement.deleteMany({ where: inCompanies });
  await prisma.orderDeliveryVoidLine.deleteMany({ where: inCompanies });
  await prisma.orderDeliveryVoid.deleteMany({ where: inCompanies });
  await prisma.orderDeliveryLine.deleteMany({ where: inCompanies });
  await prisma.orderDelivery.deleteMany({ where: inCompanies });
  await prisma.orderAssignment.deleteMany({ where: inCompanies });
  await prisma.orderPresentationLine.deleteMany({ where: inCompanies });
  await prisma.orderExecutionEntry.deleteMany({ where: inCompanies });
  await prisma.order.deleteMany({ where: inCompanies });
  await prisma.productBatch.deleteMany({ where: inCompanies });
  // El producto terminado (`products.recipe_id`) restringe el borrado de la receta.
  await prisma.product.deleteMany({ where: inCompanies });
  await prisma.recipe.deleteMany({ where: inCompanies });
  await prisma.presentation.deleteMany({ where: inCompanies });
  await prisma.customer.deleteMany({ where: inCompanies });
}

test.beforeAll(async () => {
  // LIMPIEZA DEFENSIVA DE HUERFANOS, por prefijo y por edad.
  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  const orphanCompanies = await prisma.company.findMany({
    where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
    select: { id: true },
  });
  const orphanCompanyIds = orphanCompanies.map((company) => company.id);
  if (orphanCompanyIds.length > 0) await deleteCompanyRows(orphanCompanyIds);
  await prisma.user.deleteMany({
    where: { username: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
  });
  const orphanRoles = { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } };
  await prisma.rolePermission.deleteMany({ where: { role: orphanRoles } });
  await prisma.role.deleteMany({ where: orphanRoles });
  if (orphanCompanyIds.length > 0) {
    await prisma.company.deleteMany({ where: { id: { in: orphanCompanyIds } } });
  }

  const adminRole = await prisma.role.findUnique({ where: { name: ROLE_ADMINISTRADOR }, select: { id: true } });
  if (!adminRole) {
    throw new Error(
      `falta el rol "${ROLE_ADMINISTRADOR}": sus permisos son el dato bajo prueba. Siembra la base con ` +
        '`pnpm run db:seed` antes de correr `pnpm run e2e`.',
    );
  }

  companyId = (
    await prisma.company.create({
      data: { name: COMPANY_NAME, nameNormalized: normalizeCompanyName(COMPANY_NAME) },
      select: { id: true },
    })
  ).id;

  const readOnlyRole = await prisma.role.create({
    data: {
      name: READ_ONLY_ROLE_NAME,
      description: 'Rol efimero del E2E de anular entrega: solo consulta pedidos. Se borra en afterAll.',
      permissions: { create: [{ permissionCode: READ_ONLY_PERMISSION }] },
    },
    select: { id: true },
  });

  adminUserId = await createUser(adminUser, adminRole.id);
  // En la misma empresa: asi la ausencia de «Anular» no puede venir de mirar otra empresa.
  await createUser(readOnlyUser, readOnlyRole.id);

  const city = 'Bogota';
  const customerId = (
    await prisma.customer.create({
      data: {
        firstNames: CUSTOMER_FIRST_NAMES,
        lastNames: CUSTOMER_LAST_NAMES,
        city,
        firstNamesNormalized: normalizeCustomerText(CUSTOMER_FIRST_NAMES),
        lastNamesNormalized: normalizeCustomerText(CUSTOMER_LAST_NAMES),
        cityNormalized: normalizeCustomerText(city),
        companyId,
        createdBy: adminUserId,
      },
      select: { id: true },
    })
  ).id;

  // Una de las unidades del catalogo arrancador, nunca creada ni borrada por este archivo.
  const unit = await prisma.unit.findFirstOrThrow({
    where: { nameNormalized: 'litro', companyId: null },
    select: { id: true },
  });

  const [presentationOne, presentationTwo] = await Promise.all(
    [
      { name: PRESENTATION_ONE_NAME, content: CONTENT_ONE },
      { name: PRESENTATION_TWO_NAME, content: CONTENT_TWO },
    ].map((presentation) =>
      prisma.presentation.create({
        data: {
          name: presentation.name,
          nameNormalized: normalizePresentationName(presentation.name),
          unitId: unit.id,
          content: presentation.content,
          companyId: required(companyId, 'la empresa'),
        },
        select: { id: true },
      }),
    ),
  );

  recipeId = (
    await prisma.recipe.create({
      data: {
        name: RECIPE_NAME,
        nameNormalized: normalizeRecipeName(RECIPE_NAME),
        createdBy: adminUserId,
        companyId,
      },
      select: { id: true },
    })
  ).id;

  // El producto guarda la suma de sus lotes, ya con la entrega descontada.
  const productOneId = await createFinishedProduct({
    name: FINISHED_ONE_NAME,
    unitId: unit.id,
    presentationId: presentationOne.id,
    stock: STOCK_ONE_AFTER_DELIVERY,
  });
  productTwoId = await createFinishedProduct({
    name: FINISHED_TWO_NAME,
    unitId: unit.id,
    presentationId: presentationTwo.id,
    stock: STOCK_TWO_AFTER_DELIVERY,
  });

  batchOneId = await createFinishedBatch({
    productId: productOneId,
    presentationId: presentationOne.id,
    lot: LOT_ONE,
    stock: STOCK_ONE_AFTER_DELIVERY,
    packageContent: CONTENT_ONE,
  });
  batchTwoId = await createFinishedBatch({
    productId: productTwoId,
    presentationId: presentationTwo.id,
    lot: LOT_TWO,
    stock: STOCK_TWO_AFTER_DELIVERY,
    packageContent: CONTENT_TWO,
  });

  // `ENTREGADO` con fecha de terminado: al anular vuelve a `TERMINADO`, que la exige.
  orderId = (
    await prisma.order.create({
      data: {
        companyId,
        orderYear: new Date().getUTCFullYear(),
        orderSequence: ORDER_SEQUENCE,
        recipeId,
        quantity: '7.0000',
        status: 'ENTREGADO',
        finishedAt: FINISHED_AT,
        packedBy: adminUserId,
        conditionedBy: adminUserId,
        unitId: unit.id,
        customerId,
        createdBy: adminUserId,
      },
      select: { id: true },
    })
  ).id;

  lineOneId = (
    await prisma.orderPresentationLine.create({
      data: {
        orderId,
        companyId,
        presentationId: presentationOne.id,
        packages: LINE_ONE_PACKAGES,
        presentationContent: CONTENT_ONE,
      },
      select: { id: true },
    })
  ).id;
  lineTwoId = (
    await prisma.orderPresentationLine.create({
      data: {
        orderId,
        companyId,
        presentationId: presentationTwo.id,
        packages: LINE_TWO_PACKAGES,
        presentationContent: CONTENT_TWO,
      },
      select: { id: true },
    })
  ).id;

  deliveryId = (
    await prisma.orderDelivery.create({
      data: {
        companyId,
        orderId,
        customerId,
        deliveryKey: randomUUID(),
        createdBy: adminUserId,
        createdAt: DELIVERED_AT,
      },
      select: { id: true },
    })
  ).id;

  await prisma.orderDeliveryLine.createMany({
    data: [
      {
        companyId,
        deliveryId,
        orderPresentationLineId: lineOneId,
        batchId: batchOneId,
        packages: LINE_ONE_PACKAGES,
        quantity: DELIVERED_ONE_QUANTITY,
      },
      {
        companyId,
        deliveryId,
        orderPresentationLineId: lineTwoId,
        batchId: batchTwoId,
        packages: LINE_TWO_PACKAGES,
        quantity: DELIVERED_TWO_QUANTITY,
      },
    ],
  });

  await prisma.inventoryMovement.createMany({
    data: [
      { batchId: batchOneId, quantity: `-${DELIVERED_ONE_QUANTITY}` },
      { batchId: batchTwoId, quantity: `-${DELIVERED_TWO_QUANTITY}` },
    ].map((movement) => ({
      batchId: movement.batchId,
      kind: 'delivery' as const,
      quantity: movement.quantity,
      orderId: required(orderId, 'el pedido'),
      orderDeliveryId: required(deliveryId, 'la entrega'),
      companyId: required(companyId, 'la empresa'),
      createdBy: adminUserId,
      createdAt: DELIVERED_AT,
    })),
  });
});

test.afterAll(async () => {
  // Por los identificadores de ESTE worker, nunca por el prefijo a secas: el otro proyecto
  // (Chromium/WebKit) sigue corriendo. Cada paso corre aunque falle el anterior.
  const scopedCompanyId = companyId;
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    () => (scopedCompanyId ? deleteCompanyRows([scopedCompanyId]) : Promise.resolve()),
    () =>
      prisma.user.deleteMany({
        where: { username: { in: [adminUser.username, readOnlyUser.username] } },
      }),
    () => prisma.rolePermission.deleteMany({ where: { role: { name: READ_ONLY_ROLE_NAME } } }),
    () => prisma.role.deleteMany({ where: { name: READ_ONLY_ROLE_NAME } }),
    () => prisma.company.deleteMany({ where: { name: COMPANY_NAME } }),
  ];

  let primerFallo: unknown;
  for (const paso of pasos) {
    try {
      await paso();
    } catch (error) {
      primerFallo ??= error;
    }
  }

  await prisma.$disconnect();

  if (primerFallo !== undefined) throw primerFallo;
});

// El primer `goto` hace que `next dev` compile la ruta bajo demanda, y bcrypt tarda a proposito.
test.setTimeout(240_000);

test.describe('anular una entrega de un pedido', () => {
  test('el motivo vacio no envia nada y la anulacion con motivo devuelve el lote, reabre el pedido y deja la presentacion pendiente (R36)', async ({
    page,
  }) => {
    const id = required(orderId, 'el pedido');
    const entryId = required(deliveryId, 'la entrega');
    const one = required(lineOneId, 'la linea 1');
    const two = required(lineTwoId, 'la linea 2');
    const batchOne = required(batchOneId, 'el lote 1');
    const batchTwo = required(batchTwoId, 'el lote 2');

    const deliveryBefore = await prisma.orderDelivery.findUniqueOrThrow({
      where: { id: entryId },
      select: {
        customerId: true,
        createdBy: true,
        createdAt: true,
        lines: {
          select: { id: true, batchId: true, packages: true, quantity: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    const deliveryMovementsBefore = await prisma.inventoryMovement.findMany({
      where: { orderDeliveryId: entryId },
      select: { id: true, batchId: true, kind: true, quantity: true },
      orderBy: { id: 'asc' },
    });

    await loginAndLand(page, adminUser);
    await gotoOrders(page);
    await expect(orderRow(page, id).getByTestId(ORDER_STATUS_TESTID)).toHaveAttribute('data-status', 'ENTREGADO');

    // 1. «Entregas» desde la fila.
    let sheet = await openDeliveriesSheet(page, id, entryId);
    await expect(entryPresentation(sheet, one).getByTestId(DELIVERY_ENTRY_VOIDED_TESTID)).toHaveCount(0);
    await expect(entryPresentation(sheet, two).getByTestId(DELIVERY_ENTRY_VOIDED_TESTID)).toHaveCount(0);

    // 2. «Anular», desmarcar la presentacion 1 y confirmar sin motivo.
    const before = await voidFootprint(id, entryId);
    const dialog = await openVoidDialog(page, sheet);
    await expect(voidCheckbox(dialog, one)).toBeChecked();
    await expect(voidCheckbox(dialog, two)).toBeChecked();
    await voidCheckbox(dialog, one).click();
    await expect(voidCheckbox(dialog, one)).not.toBeChecked();

    await dialog.getByTestId(VOID_CONFIRM_TESTID).click();
    await expect(dialog.getByTestId(VOID_REASON_ERROR_TESTID)).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toBeVisible();
    expect(await voidFootprint(id, entryId), 'sin motivo no se escribe nada').toEqual(before);

    // 3. Con motivo, la anulacion se aplica.
    await dialog.getByTestId(VOID_REASON_TESTID).fill(VOID_REASON);
    await dialog.getByTestId(VOID_CONFIRM_TESTID).click();
    await expect(dialog, 'el dialogo deberia cerrarse al aplicar la anulacion').toHaveCount(0, { timeout: 60_000 }).catch(
      async (error: unknown) => {
        const notices = [
          ...(await dialog.getByTestId(VOID_ERROR_TESTID).allTextContents()),
          ...(await dialog.getByTestId(VOID_REJECTED_TESTID).allTextContents()),
        ];
        throw new Error(`la anulacion no se aplico; avisos: ${JSON.stringify(notices)}`, { cause: error });
      },
    );

    await expect
      .poll(() => prisma.orderDeliveryVoid.count({ where: { deliveryId: entryId } }), { timeout: 30_000 })
      .toBe(1);

    const voidRow = await prisma.orderDeliveryVoid.findFirstOrThrow({
      where: { deliveryId: entryId },
      select: {
        id: true,
        reason: true,
        createdBy: true,
        lines: { select: { deliveryLine: { select: { orderPresentationLineId: true, batchId: true } } } },
      },
    });
    expect(voidRow.reason, 'la anulacion lleva el motivo').toBe(VOID_REASON);
    expect(voidRow.createdBy).toBe(adminUserId);
    expect(voidRow.lines.map((line) => line.deliveryLine)).toEqual([
      { orderPresentationLineId: two, batchId: batchTwo },
    ]);

    const voidMovements = await prisma.inventoryMovement.findMany({
      where: { orderDeliveryVoidId: voidRow.id },
      select: { batchId: true, kind: true, quantity: true, orderId: true },
    });
    expect(voidMovements).toHaveLength(1);
    expect(voidMovements[0]?.kind).toBe('delivery_void');
    expect(voidMovements[0]?.batchId).toBe(batchTwo);
    expect(voidMovements[0]?.quantity.toFixed(4)).toBe(DELIVERED_TWO_QUANTITY);
    expect(voidMovements[0]?.orderId).toBe(id);

    const batchesAfter = await prisma.productBatch.findMany({
      where: { id: { in: [batchOne, batchTwo] } },
      select: { id: true, stock: true },
    });
    const stockAfter = new Map(batchesAfter.map((batch) => [batch.id, batch.stock.toFixed(4)]));
    expect(stockAfter.get(batchTwo), 'el lote de la presentacion anulada recupera lo entregado').toBe(
      STOCK_TWO_AFTER_VOID,
    );
    expect(stockAfter.get(batchOne), 'el lote de la presentacion no anulada no se toca').toBe(
      STOCK_ONE_AFTER_DELIVERY,
    );
    const productTwo = await prisma.product.findUniqueOrThrow({
      where: { id: required(productTwoId, 'el producto 2') },
      select: { stock: true },
    });
    expect(productTwo.stock.toFixed(4), 'el producto suma de nuevo sus lotes').toBe(STOCK_TWO_AFTER_VOID);

    const deliveryAfter = await prisma.orderDelivery.findUniqueOrThrow({
      where: { id: entryId },
      select: {
        customerId: true,
        createdBy: true,
        createdAt: true,
        lines: {
          select: { id: true, batchId: true, packages: true, quantity: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    expect(deliveryAfter, 'la entrega queda intacta').toEqual(deliveryBefore);
    const deliveryMovementsAfter = await prisma.inventoryMovement.findMany({
      where: { orderDeliveryId: entryId },
      select: { id: true, batchId: true, kind: true, quantity: true },
      orderBy: { id: 'asc' },
    });
    expect(deliveryMovementsAfter, 'los asientos de la entrega quedan intactos').toEqual(deliveryMovementsBefore);

    const orderAfter = await prisma.order.findUniqueOrThrow({ where: { id }, select: { status: true } });
    expect(orderAfter.status, 'con una presentacion pendiente el pedido vuelve a terminado').toBe('TERMINADO');

    // 4. La lista pinta la presentacion anulada con su motivo; la fila, «Terminado».
    await expect(entryPresentation(sheet, two).getByTestId(DELIVERY_ENTRY_VOIDED_TESTID)).toBeVisible({
      timeout: 60_000,
    });
    await expect(entryPresentation(sheet, two).getByTestId(DELIVERY_ENTRY_VOID_REASON_TESTID)).toHaveText(
      VOID_REASON,
    );
    await expect(entryPresentation(sheet, one).getByTestId(DELIVERY_ENTRY_VOIDED_TESTID)).toHaveCount(0);
    await expect(orderRow(page, id).getByTestId(ORDER_STATUS_TESTID)).toHaveAttribute('data-status', 'TERMINADO', {
      timeout: 60_000,
    });

    // 5. «Entregar» vuelve a ofrecer la presentacion anulada como pendiente.
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0, { timeout: 30_000 });
    await (await openOrderRowMenu(page, orderMenuTrigger(page, id), ORDER_ACTION_DELIVER_TESTID)).click();
    sheet = page.getByTestId(DELIVERY_SHEET_TESTID);
    await expect(sheet).toBeVisible({ timeout: 60_000 });
    await expect(sheet.getByTestId(DELIVERY_SUBMIT_TESTID)).toBeVisible({ timeout: 60_000 });
    await expect(deliveryLine(sheet, one).getByTestId(DELIVERY_LINE_COMPLETE_TESTID)).toBeVisible();
    await expect(deliveryLine(sheet, two).getByTestId(DELIVERY_LINE_COMPLETE_TESTID)).toHaveCount(0);
    await expect(
      deliveryLine(sheet, two)
        .locator(`[data-testid="${DELIVERY_BATCH_TESTID}"][data-batch-id="${batchTwo}"]`)
        .getByTestId(DELIVERY_BATCH_PACKAGES_TESTID),
    ).toBeVisible();
  });

  test('un usuario sin permiso de anular entregas abre «Entregas» y no ve «Anular» (R36)', async ({ page }) => {
    const id = required(orderId, 'el pedido');
    const entryId = required(deliveryId, 'la entrega');

    await loginAndLand(page, readOnlyUser);
    await gotoOrders(page);

    // El ancla positiva: la lista ya pinto la entrega. Corra antes o despues del otro caso, la
    // presentacion 1 sigue sin anular y el pedido admite la anulacion: solo falta el permiso.
    const sheet = await openDeliveriesSheet(page, id, entryId);
    await expect(entryPresentation(sheet, required(lineOneId, 'la linea 1'))).toBeVisible();
    await expect(sheet.getByTestId(DELIVERY_VOID_TESTID)).toHaveCount(0);
    await expect(page.getByTestId(VOID_DIALOG_TESTID)).toHaveCount(0);
  });
});
