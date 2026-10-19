/**
 * QC-282 R47 — E2E de la entrega de un pedido a varios clientes, de su anulacion por cliente y
 * presentacion y de sus lecturas.
 *
 * EL RECORRIDO del Administrador va en un solo `test()`: cada paso es la precondicion del
 * siguiente y partirlo obligaria a resembrar lo que dejo el anterior.
 *   1. abre «Entregar» desde el menu de la fila del pedido `TERMINADO`: un solo bloque, «Cliente 1»,
 *      con el cliente del pedido (R4);
 *   2. «Añadir cliente» abre «Cliente 2» (R8); elige en el el MISMO cliente que el bloque 1, escribe
 *      envases y pulsa «Entregar»: el bloque 2 avisa «Este cliente ya está en la entrega.» y en
 *      Postgres no hay ninguna entrega (R17);
 *   3. cambia el bloque 2 al otro cliente; los dos clientes comparten el lote de la presentacion 1 y
 *      el segundo lleva ademas la presentacion 2; el resumen marca las dos «Completa» y confirma. En
 *      Postgres: una sola entrega, sus lineas por cliente, un asiento `delivery` por lote con la suma
 *      de los dos clientes, la existencia de cada lote y el pedido `ENTREGADO` con su cliente de
 *      siempre (R25, R26, R27);
 *   4. «Entregas» pinta la entrega con dos clientes y un subbloque por cliente (R33);
 *   5. «Anular» abre el dialogo SIN NADA MARCADO (R36); la casilla de grupo pasa a mixto con un solo
 *      par marcado de un cliente que tiene dos (R37); se anula solo la presentacion 1 del primer
 *      cliente. En Postgres: la anulacion lleva solo esa linea, el otro cliente conserva la suya, el
 *      lote recupera SOLO lo anulado y el pedido vuelve a `TERMINADO` (R41, R42);
 *   6. la lista marca «Anulada» en el subbloque del primer cliente y no en el del segundo (R34);
 *   7. el tab Entregas del producto de la presentacion 1 muestra una fila por cliente con la columna
 *      «Presentación» (R43).
 *
 * QUE APORTA SOBRE UNIT E INTEGRACION: el sheet por bloques, el dialogo agrupado por cliente, las
 * dos Server Actions y las dos lecturas de verdad, contra un navegador real y Postgres. Chromium y
 * WebKit: WebKit es el motor de iOS y la regla multiplataforma pide ejercitarlo.
 *
 * DATOS, mismo patron que `e2e/entregar-producto-terminado.spec.ts`:
 *  - todo lo que este archivo crea lleva el prefijo `qc282_e2e_` y dentro el `RUN_ID` del worker;
 *  - una empresa efimera propia, asi que la busqueda de cliente y la lista de pedidos solo ven lo de
 *    este worker;
 *  - la limpieza defensiva de huerfanos borra por prefijo Y POR EDAD, para no llevarse lo que otra
 *    ejecucion viva acaba de crear;
 *  - `afterAll` borra SIEMPRE, aunque un paso reviente, por los identificadores de ESTE worker y en
 *    el orden que imponen las FK.
 *
 * SEMBRADO POR PRISMA todo lo previo a la entrega: empresa, Administrador, dos clientes, una unidad
 * del catalogo arrancador (nunca creada ni borrada aqui), dos presentaciones con contenido, la
 * receta, un producto terminado por presentacion con su lote y el pedido `TERMINADO` repartido en
 * las dos presentaciones.
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
import { ORDERS_ROUTE, finishedProductDetailRoute } from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { openOrderRowMenu, orderMenuTrigger } from './helpers/order-distribution';

/** Prefijo con el que este spec marca TODO lo que crea. Nada fuera de el se toca. */
const FIXTURE_PREFIX = 'qc282_e2e_';

/** Identificador unico de este proceso de worker. */
const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit corren a la vez: la limpieza defensiva no puede borrar por prefijo a secas. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;

/** Nunca la empresa de instalacion: `companies_name_unique` es GLOBAL. */
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
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
  password: `Qc282-Admin-${RUN_ID.slice(0, 12)}`,
};

/** Los nombres llevan el `RUN_ID` para que la busqueda no case con los de otro worker, y ninguna
 *  etiqueta es prefijo de la otra. */
type CustomerFixture = { readonly firstNames: string; readonly lastNames: string };
const CUSTOMER_A: CustomerFixture = { firstNames: `Ana ${RUN_ID.slice(0, 10)}`, lastNames: 'Primera' };
const CUSTOMER_B: CustomerFixture = { firstNames: `Bea ${RUN_ID.slice(0, 10)}`, lastNames: 'Segunda' };

function customerLabel(customer: CustomerFixture): string {
  return `${customer.firstNames} ${customer.lastNames}`;
}

/**
 * Cantidades del fixture. Presentacion 1 con contenido 1 y presentacion 2 con contenido 2. El
 * pedido pide 4 envases de la 1 y 2 de la 2.
 *  - Cliente A: 3 envases de la 1, del lote 1.
 *  - Cliente B: 1 envase de la 1, del MISMO lote 1, y 2 envases de la 2, del lote 2.
 * Las dos presentaciones quedan completas: el pedido pasa a `ENTREGADO`.
 */
const CONTENT_ONE = '1.0000';
const CONTENT_TWO = '2.0000';
const LINE_ONE_PACKAGES = 4;
const LINE_TWO_PACKAGES = 2;
/** 10 envases de 1. */
const STOCK_ONE = '10.0000';
/** 5 envases de 2. */
const STOCK_TWO = '10.0000';

const A_ONE_PACKAGES = '3';
const B_ONE_PACKAGES = '1';
const B_TWO_PACKAGES = '2';

/** Un asiento por lote con la suma de los dos clientes: 3 + 1 envases de 1 y 2 envases de 2. */
const DELIVERY_ONE_QUANTITY = '-4.0000';
const DELIVERY_TWO_QUANTITY = '-4.0000';
const STOCK_ONE_AFTER_DELIVERY = '6.0000';
const STOCK_TWO_AFTER_DELIVERY = '6.0000';
/** La anulacion del par (A, presentacion 1) devuelve SOLO los 3 envases de A. */
const VOID_ONE_QUANTITY = '3.0000';
const STOCK_ONE_AFTER_VOID = '9.0000';

const VOID_REASON = `Devuelta por la primera ${RUN_ID.slice(0, 8)}`;

/** El ano sale del reloj: el CHECK `orders_order_year_matches_created_at` lo ata a `created_at`. */
const ORDER_SEQUENCE = 840_000 + Math.floor(Math.random() * 80_000);
const FINISHED_AT = new Date(Date.now() - 6 * 60 * 60 * 1000);

/** Textos visibles que el recorrido afirma. */
const BLOCK_ONE_TITLE = 'Cliente 1';
const BLOCK_TWO_TITLE = 'Cliente 2';
const DUPLICATE_CUSTOMER_TEXT = 'Este cliente ya está en la entrega.';
const PRESENTATION_HEADER = 'Presentación';

/** `data-testid` de la pantalla de Pedidos. */
const ORDERS_TITLE_TESTID = 'pedidos-title';
const ORDER_ACTION_DELIVER_TESTID = 'order-action-deliver';
const ORDER_ACTION_DELIVERIES_TESTID = 'order-action-deliveries';

/** `data-testid` del sheet «Entregar». */
const DELIVERY_SHEET_TESTID = 'order-delivery-sheet';
const DELIVERY_SUBMIT_TESTID = 'order-delivery-submit';
const DELIVERY_ERROR_TESTID = 'order-delivery-error';
const DELIVERY_REJECTED_TESTID = 'order-delivery-rejected';
const DELIVERY_BLOCK_TESTID = 'order-delivery-block';
const DELIVERY_BLOCK_REMOVE_TESTID = 'order-delivery-block-remove';
const DELIVERY_BLOCK_ERROR_TESTID = 'order-delivery-block-error';
const DELIVERY_ADD_CUSTOMER_TESTID = 'order-delivery-add-customer';
const DELIVERY_SUMMARY_LINE_TESTID = 'order-delivery-summary-line';
const DELIVERY_LINE_COMPLETE_TESTID = 'order-delivery-line-complete';
const DELIVERY_BATCH_TESTID = 'order-delivery-batch';
const DELIVERY_BATCH_PACKAGES_TESTID = 'order-delivery-batch-packages';
const CUSTOMER_PICKER_TESTID = 'order-customer-picker';
const CUSTOMER_PICKER_OPTION_TESTID = 'order-customer-picker-option';

/** `data-testid` de la lista «Entregas» y del dialogo de anular. */
const DELIVERIES_SHEET_TESTID = 'order-deliveries-sheet';
const DELIVERY_ENTRY_TESTID = 'order-delivery-entry';
const DELIVERY_ENTRY_CUSTOMERS_TESTID = 'order-delivery-entry-customers';
const DELIVERY_ENTRY_CUSTOMER_TESTID = 'order-delivery-entry-customer';
const DELIVERY_ENTRY_PRESENTATION_TESTID = 'order-delivery-entry-presentation';
const DELIVERY_ENTRY_BATCH_TESTID = 'order-delivery-entry-batch';
const DELIVERY_ENTRY_VOIDED_TESTID = 'order-delivery-entry-voided';
const DELIVERY_VOID_TESTID = 'order-delivery-void';
const VOID_DIALOG_TESTID = 'delivery-void-dialog';
const VOID_GROUP_TOGGLE_TESTID = 'delivery-void-group-toggle';
const VOID_PRESENTATION_TESTID = 'delivery-void-presentation';
const VOID_REASON_TESTID = 'delivery-void-reason';
const VOID_CONFIRM_TESTID = 'delivery-void-confirm';
const VOID_ERROR_TESTID = 'delivery-void-error';
const VOID_REJECTED_TESTID = 'delivery-void-rejected';

/** `data-testid` del tab Entregas de la ficha del producto terminado. */
const FINISHED_PRODUCT_NAME_TESTID = 'finished-product-name';
const FINISHED_DELIVERIES_TESTID = 'finished-product-entregas';
const FINISHED_DELIVERY_ROW_TESTID = 'finished-product-delivery-row';
const FINISHED_DELIVERY_CUSTOMER_TESTID = 'finished-product-delivery-customer';
const FINISHED_DELIVERY_PRESENTATION_TESTID = 'finished-product-delivery-presentation';
const FINISHED_DELIVERY_LOT_TESTID = 'finished-product-delivery-lot';
const FINISHED_DELIVERY_PACKAGES_TESTID = 'finished-product-delivery-packages';

let companyId: string | null = null;
let adminUserId: string | null = null;
let recipeId: string | null = null;
let orderId: string | null = null;
let customerAId: string | null = null;
let customerBId: string | null = null;
let lineOneId: string | null = null;
let lineTwoId: string | null = null;
let productOneId: string | null = null;
let batchOneId: string | null = null;
let batchTwoId: string | null = null;

function required<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`falta ${what}: fallo el beforeAll`);
  return value;
}

/** Igualdad EXACTA de texto: un nombre no puede casar con el prefijo de otro. */
function exactText(value: string): RegExp {
  return new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
}

/** URL de Pedidos, SIEMPRE derivada de `ORDERS_ROUTE`. */
function ordersUrl(): string {
  const query = new URLSearchParams({ pageSize: '25', sort: 'createdAt:desc' });
  return `${ORDERS_ROUTE}?${query.toString()}`;
}

/** En WebKit el refresco que deja una accion anterior puede interrumpir la navegacion. */
async function gotoSettled(page: Page, url: string): Promise<void> {
  await expect(async () => {
    await page.goto(url);
  }).toPass({ timeout: 60_000 });
}

async function gotoOrders(page: Page, id: string): Promise<void> {
  await gotoSettled(page, ordersUrl());
  await expect(page.getByTestId(ORDERS_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });
  await expect(orderMenuTrigger(page, id)).toHaveCount(1, { timeout: 60_000 });
}

/** El bloque de cliente en esa posicion (0 = «Cliente 1»). */
function block(sheet: Locator, index: number): Locator {
  return sheet.locator(`[data-testid="${DELIVERY_BLOCK_TESTID}"][data-block-index="${index}"]`);
}

function blockCustomerInput(scope: Locator): Locator {
  return scope.getByTestId(CUSTOMER_PICKER_TESTID).getByRole('combobox');
}

function blockBatchPackages(scope: Locator, batchId: string): Locator {
  return scope
    .locator(`[data-testid="${DELIVERY_BATCH_TESTID}"][data-batch-id="${batchId}"]`)
    .getByTestId(DELIVERY_BATCH_PACKAGES_TESTID);
}

function summaryLine(sheet: Locator, presentationLineId: string): Locator {
  return sheet.locator(
    `[data-testid="${DELIVERY_SUMMARY_LINE_TESTID}"][data-presentation-line-id="${presentationLineId}"]`,
  );
}

function entryCustomer(sheet: Locator, id: string): Locator {
  return sheet.locator(`[data-testid="${DELIVERY_ENTRY_CUSTOMER_TESTID}"][data-customer-id="${id}"]`);
}

function entryPresentation(scope: Locator, presentationLineId: string): Locator {
  return scope.locator(
    `[data-testid="${DELIVERY_ENTRY_PRESENTATION_TESTID}"][data-presentation-line-id="${presentationLineId}"]`,
  );
}

function voidGroupToggle(dialog: Locator, id: string): Locator {
  return dialog.locator(`[data-testid="${VOID_GROUP_TOGGLE_TESTID}"][data-customer-id="${id}"]`);
}

function voidPair(dialog: Locator, id: string, presentationLineId: string): Locator {
  return dialog.locator(
    `[data-testid="${VOID_PRESENTATION_TESTID}"][data-customer-id="${id}"][data-presentation-line-id="${presentationLineId}"]`,
  );
}

/** Abre «Entregar» desde el menu de la fila y espera a que el panel pinte su primer bloque. */
async function openDeliverySheet(page: Page, id: string): Promise<Locator> {
  await (await openOrderRowMenu(page, orderMenuTrigger(page, id), ORDER_ACTION_DELIVER_TESTID)).click();
  const sheet = page.getByTestId(DELIVERY_SHEET_TESTID);
  await expect(sheet).toBeVisible({ timeout: 60_000 });
  await expect(sheet.getByTestId(DELIVERY_SUBMIT_TESTID)).toBeVisible({ timeout: 60_000 });
  await expect(block(sheet, 0)).toBeVisible({ timeout: 60_000 });
  return sheet;
}

/** Vacia el selector de cliente del bloque, escribe la etiqueta y elige esa opcion. */
async function chooseCustomer(page: Page, scope: Locator, label: string): Promise<void> {
  const input = blockCustomerInput(scope);
  await input.click();
  await input.fill('');
  await input.fill(label);
  const option = page.getByTestId(CUSTOMER_PICKER_OPTION_TESTID).filter({ hasText: label });
  await expect(option).toHaveCount(1, { timeout: 60_000 });
  await option.click();
  await expect(input).toHaveValue(label);
}

/** Abre «Entregas» desde el menu de la fila y espera a que la lista pinte la entrega. */
async function openDeliveriesSheet(page: Page, id: string, entryId: string): Promise<Locator> {
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

async function createCustomer(customer: CustomerFixture): Promise<string> {
  const city = 'Bogota';
  const created = await prisma.customer.create({
    data: {
      firstNames: customer.firstNames,
      lastNames: customer.lastNames,
      city,
      firstNamesNormalized: normalizeCustomerText(customer.firstNames),
      lastNamesNormalized: normalizeCustomerText(customer.lastNames),
      cityNormalized: normalizeCustomerText(city),
      companyId: required(companyId, 'la empresa'),
      createdBy: adminUserId,
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

  adminUserId = (
    await createFixtureUser({
      data: {
        firstNames: `Qc282${RUN_ID.slice(0, 8)}`,
        lastNames: 'Entrega',
        birthDate: new Date('1990-01-01'),
        email: `${adminUser.username}@example.test`,
        phone: '+573000000000',
        documentTypeCode: DOCUMENT_TYPE_CC,
        documentNumber: adminUser.username,
        username: adminUser.username,
        passwordHash: await createPasswordHash(adminUser.password),
        roleId: adminRole.id,
        companyId,
        // Explicito: la columna es `@default(pending)` y ese estado no entra por el login.
        accountStatus: 'active',
      },
      select: { id: true },
    })
  ).id;

  customerAId = await createCustomer(CUSTOMER_A);
  customerBId = await createCustomer(CUSTOMER_B);

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

  // El producto guarda la suma de sus lotes, igual que la recalcula la salida.
  productOneId = await createFinishedProduct({
    name: FINISHED_ONE_NAME,
    unitId: unit.id,
    presentationId: presentationOne.id,
    stock: STOCK_ONE,
  });
  const productTwoId = await createFinishedProduct({
    name: FINISHED_TWO_NAME,
    unitId: unit.id,
    presentationId: presentationTwo.id,
    stock: STOCK_TWO,
  });

  batchOneId = await createFinishedBatch({
    productId: productOneId,
    presentationId: presentationOne.id,
    lot: LOT_ONE,
    stock: STOCK_ONE,
    packageContent: CONTENT_ONE,
  });
  batchTwoId = await createFinishedBatch({
    productId: productTwoId,
    presentationId: presentationTwo.id,
    lot: LOT_TWO,
    stock: STOCK_TWO,
    packageContent: CONTENT_TWO,
  });

  // `TERMINADO` exige fecha de terminado, quien empaco y quien acondiciono.
  const order = await prisma.order.create({
    data: {
      companyId,
      orderYear: new Date().getUTCFullYear(),
      orderSequence: ORDER_SEQUENCE,
      recipeId,
      quantity: '8.0000',
      status: 'TERMINADO',
      finishedAt: FINISHED_AT,
      packedBy: adminUserId,
      conditionedBy: adminUserId,
      unitId: unit.id,
      customerId: customerAId,
      createdBy: adminUserId,
      presentationLines: {
        create: [
          {
            companyId,
            presentationId: presentationOne.id,
            packages: LINE_ONE_PACKAGES,
            presentationContent: CONTENT_ONE,
          },
          {
            companyId,
            presentationId: presentationTwo.id,
            packages: LINE_TWO_PACKAGES,
            presentationContent: CONTENT_TWO,
          },
        ],
      },
    },
    select: { id: true, presentationLines: { select: { id: true, presentationId: true } } },
  });
  orderId = order.id;
  lineOneId = order.presentationLines.find((line) => line.presentationId === presentationOne.id)?.id ?? null;
  lineTwoId = order.presentationLines.find((line) => line.presentationId === presentationTwo.id)?.id ?? null;
});

test.afterAll(async () => {
  // Por los identificadores de ESTE worker, nunca por el prefijo a secas: el otro proyecto
  // (Chromium/WebKit) sigue corriendo. Cada paso corre aunque falle el anterior.
  const scopedCompanyId = companyId;
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    () => (scopedCompanyId ? deleteCompanyRows([scopedCompanyId]) : Promise.resolve()),
    () => prisma.user.deleteMany({ where: { username: adminUser.username } }),
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
test.setTimeout(300_000);

test.describe('entrega a varios clientes', () => {
  test('R47: entrega a dos clientes que comparten un lote, cliente repetido que no envia nada, anulacion de una sola presentacion de un cliente y lecturas por cliente', async ({
    page,
  }) => {
    const id = required(orderId, 'el pedido');
    const customerA = required(customerAId, 'el cliente A');
    const customerB = required(customerBId, 'el cliente B');
    const one = required(lineOneId, 'la linea 1');
    const two = required(lineTwoId, 'la linea 2');
    const batchOne = required(batchOneId, 'el lote 1');
    const batchTwo = required(batchTwoId, 'el lote 2');
    const labelA = customerLabel(CUSTOMER_A);
    const labelB = customerLabel(CUSTOMER_B);

    await loginAndLand(page, adminUser);
    await gotoOrders(page, id);

    // 1. Un solo bloque, «Cliente 1», con el cliente del pedido; sin «Quitar».
    const sheet = await openDeliverySheet(page, id);
    await expect(sheet.getByTestId(DELIVERY_BLOCK_TESTID)).toHaveCount(1);
    await expect(block(sheet, 0).getByRole('heading', { name: BLOCK_ONE_TITLE })).toBeVisible();
    await expect(blockCustomerInput(block(sheet, 0))).toHaveValue(labelA);
    await expect(sheet.getByTestId(DELIVERY_BLOCK_REMOVE_TESTID)).toHaveCount(0);

    // 2. «Añadir cliente» y el MISMO cliente en el bloque 2: el envio se para en el sheet.
    await sheet.getByTestId(DELIVERY_ADD_CUSTOMER_TESTID).click();
    await expect(sheet.getByTestId(DELIVERY_BLOCK_TESTID)).toHaveCount(2);
    const first = block(sheet, 0);
    const second = block(sheet, 1);
    await expect(second.getByRole('heading', { name: BLOCK_TWO_TITLE })).toBeVisible();
    await expect(blockCustomerInput(second)).toHaveValue('');
    await expect(sheet.getByTestId(DELIVERY_BLOCK_REMOVE_TESTID)).toHaveCount(2);

    await chooseCustomer(page, second, labelA);
    await blockBatchPackages(first, batchOne).fill(A_ONE_PACKAGES);
    await blockBatchPackages(second, batchOne).fill(B_ONE_PACKAGES);
    await blockBatchPackages(second, batchTwo).fill(B_TWO_PACKAGES);

    await sheet.getByTestId(DELIVERY_SUBMIT_TESTID).click();
    await expect(second.getByTestId(DELIVERY_BLOCK_ERROR_TESTID)).toHaveText(exactText(DUPLICATE_CUSTOMER_TEXT), {
      timeout: 30_000,
    });
    await expect(first.getByTestId(DELIVERY_BLOCK_ERROR_TESTID)).toHaveCount(0);
    await expect(sheet).toBeVisible();
    expect(
      await prisma.orderDelivery.count({ where: { orderId: id } }),
      'con el cliente repetido no se envia nada',
    ).toBe(0);

    // 3. El otro cliente en el bloque 2: el aviso se va, el resumen marca las dos completas y se entrega.
    await chooseCustomer(page, second, labelB);
    await expect(second.getByTestId(DELIVERY_BLOCK_ERROR_TESTID)).toHaveCount(0);
    await expect(summaryLine(sheet, one).getByTestId(DELIVERY_LINE_COMPLETE_TESTID)).toBeVisible();
    await expect(summaryLine(sheet, two).getByTestId(DELIVERY_LINE_COMPLETE_TESTID)).toBeVisible();

    await sheet.getByTestId(DELIVERY_SUBMIT_TESTID).click();
    await expect(sheet, 'el panel deberia cerrarse al aplicar la entrega').toHaveCount(0, { timeout: 60_000 }).catch(
      async (error: unknown) => {
        const notices = [
          ...(await sheet.getByTestId(DELIVERY_ERROR_TESTID).allTextContents()),
          ...(await sheet.getByTestId(DELIVERY_REJECTED_TESTID).allTextContents()),
        ];
        throw new Error(`la entrega no se aplico; avisos: ${JSON.stringify(notices)}`, { cause: error });
      },
    );

    await expect
      .poll(() => prisma.orderDelivery.count({ where: { orderId: id } }), { timeout: 30_000 })
      .toBe(1);
    const delivery = await prisma.orderDelivery.findFirstOrThrow({
      where: { orderId: id },
      select: {
        id: true,
        lines: { select: { customerId: true, orderPresentationLineId: true, batchId: true, packages: true, quantity: true } },
      },
    });
    const lineKey = (line: { customerId: string; batchId: string }) => `${line.customerId}:${line.batchId}`;
    expect(
      delivery.lines
        .map((line) => ({ ...line, quantity: line.quantity.toFixed(4) }))
        .sort((a, b) => lineKey(a).localeCompare(lineKey(b))),
      'una sola entrega con sus lineas por cliente y lote',
    ).toEqual(
      [
        { customerId: customerA, orderPresentationLineId: one, batchId: batchOne, packages: 3, quantity: '3.0000' },
        { customerId: customerB, orderPresentationLineId: one, batchId: batchOne, packages: 1, quantity: '1.0000' },
        { customerId: customerB, orderPresentationLineId: two, batchId: batchTwo, packages: 2, quantity: '4.0000' },
      ].sort((a, b) => lineKey(a).localeCompare(lineKey(b))),
    );

    const deliveryMovements = await prisma.inventoryMovement.findMany({
      where: { orderDeliveryId: delivery.id },
      select: { batchId: true, kind: true, quantity: true, orderId: true },
    });
    expect(deliveryMovements, 'un asiento por lote, no por cliente').toHaveLength(2);
    const movementByBatch = new Map(deliveryMovements.map((movement) => [movement.batchId, movement]));
    expect(movementByBatch.get(batchOne)?.kind).toBe('delivery');
    expect(movementByBatch.get(batchOne)?.quantity.toFixed(4), 'el lote compartido suma los dos clientes').toBe(
      DELIVERY_ONE_QUANTITY,
    );
    expect(movementByBatch.get(batchOne)?.orderId).toBe(id);
    expect(movementByBatch.get(batchTwo)?.kind).toBe('delivery');
    expect(movementByBatch.get(batchTwo)?.quantity.toFixed(4)).toBe(DELIVERY_TWO_QUANTITY);

    const batchesAfterDelivery = await prisma.productBatch.findMany({
      where: { id: { in: [batchOne, batchTwo] } },
      select: { id: true, stock: true },
    });
    const stockAfterDelivery = new Map(batchesAfterDelivery.map((batch) => [batch.id, batch.stock.toFixed(4)]));
    expect(stockAfterDelivery.get(batchOne)).toBe(STOCK_ONE_AFTER_DELIVERY);
    expect(stockAfterDelivery.get(batchTwo)).toBe(STOCK_TWO_AFTER_DELIVERY);

    const orderAfterDelivery = await prisma.order.findUniqueOrThrow({
      where: { id },
      select: { status: true, customerId: true },
    });
    expect(orderAfterDelivery.status, 'sin envases pendientes el pedido queda entregado').toBe('ENTREGADO');
    expect(orderAfterDelivery.customerId, 'el pedido conserva su cliente').toBe(customerA);

    // 4. «Entregas»: la entrega con dos clientes y un subbloque por cliente.
    await gotoOrders(page, id);
    const list = await openDeliveriesSheet(page, id, delivery.id);
    await expect(list.getByTestId(DELIVERY_ENTRY_CUSTOMERS_TESTID)).toHaveText(exactText('2'));
    await expect(list.getByTestId(DELIVERY_ENTRY_CUSTOMER_TESTID)).toHaveCount(2);
    const sectionA = entryCustomer(list, customerA);
    const sectionB = entryCustomer(list, customerB);
    await expect(sectionA).toHaveAttribute('aria-label', labelA);
    await expect(sectionB).toHaveAttribute('aria-label', labelB);
    await expect(sectionA.getByTestId(DELIVERY_ENTRY_PRESENTATION_TESTID)).toHaveCount(1);
    await expect(entryPresentation(sectionA, one).getByTestId(DELIVERY_ENTRY_BATCH_TESTID)).toHaveAttribute(
      'data-batch-id',
      batchOne,
    );
    await expect(sectionB.getByTestId(DELIVERY_ENTRY_PRESENTATION_TESTID)).toHaveCount(2);
    await expect(entryPresentation(sectionB, one).getByTestId(DELIVERY_ENTRY_BATCH_TESTID)).toHaveAttribute(
      'data-batch-id',
      batchOne,
    );
    await expect(entryPresentation(sectionB, two).getByTestId(DELIVERY_ENTRY_BATCH_TESTID)).toHaveAttribute(
      'data-batch-id',
      batchTwo,
    );
    await expect(list.getByTestId(DELIVERY_ENTRY_VOIDED_TESTID)).toHaveCount(0);

    // 5. El dialogo abre sin nada marcado; mixto con un solo par de B; se anula solo (A, presentacion 1).
    const dialog = await openVoidDialog(page, list);
    await expect(dialog.getByTestId(VOID_PRESENTATION_TESTID)).toHaveCount(3);
    for (const checkbox of await dialog.getByTestId(VOID_PRESENTATION_TESTID).all()) {
      await expect(checkbox).not.toBeChecked();
    }
    await expect(voidGroupToggle(dialog, customerA)).not.toBeChecked();
    await expect(voidGroupToggle(dialog, customerB)).not.toBeChecked();

    await voidPair(dialog, customerB, one).click();
    await expect(voidPair(dialog, customerB, one)).toBeChecked();
    await expect(voidGroupToggle(dialog, customerB)).toHaveAttribute('aria-checked', 'mixed');
    await voidPair(dialog, customerB, one).click();
    await expect(voidPair(dialog, customerB, one)).not.toBeChecked();
    await expect(voidGroupToggle(dialog, customerB)).not.toBeChecked();

    await voidPair(dialog, customerA, one).click();
    await expect(voidPair(dialog, customerA, one)).toBeChecked();
    await expect(voidGroupToggle(dialog, customerA)).toBeChecked();

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
      .poll(() => prisma.orderDeliveryVoid.count({ where: { deliveryId: delivery.id } }), { timeout: 30_000 })
      .toBe(1);
    const voidRow = await prisma.orderDeliveryVoid.findFirstOrThrow({
      where: { deliveryId: delivery.id },
      select: {
        id: true,
        reason: true,
        lines: {
          select: { deliveryLine: { select: { customerId: true, orderPresentationLineId: true, batchId: true } } },
        },
      },
    });
    expect(voidRow.reason).toBe(VOID_REASON);
    expect(
      voidRow.lines.map((line) => line.deliveryLine),
      'la anulacion lleva solo la linea del par marcado',
    ).toEqual([{ customerId: customerA, orderPresentationLineId: one, batchId: batchOne }]);

    const linesOfB = await prisma.orderDeliveryLine.findMany({
      where: { deliveryId: delivery.id, customerId: customerB },
      select: { voidLine: { select: { id: true } } },
    });
    expect(linesOfB).toHaveLength(2);
    expect(
      linesOfB.every((line) => line.voidLine === null),
      'el otro cliente conserva su presentacion 1 y su presentacion 2',
    ).toBe(true);

    const voidMovements = await prisma.inventoryMovement.findMany({
      where: { orderDeliveryVoidId: voidRow.id },
      select: { batchId: true, kind: true, quantity: true },
    });
    expect(voidMovements).toEqual([
      expect.objectContaining({ batchId: batchOne, kind: 'delivery_void' }),
    ]);
    expect(voidMovements[0]?.quantity.toFixed(4), 'el lote recupera solo lo anulado').toBe(VOID_ONE_QUANTITY);

    const batchesAfterVoid = await prisma.productBatch.findMany({
      where: { id: { in: [batchOne, batchTwo] } },
      select: { id: true, stock: true },
    });
    const stockAfterVoid = new Map(batchesAfterVoid.map((batch) => [batch.id, batch.stock.toFixed(4)]));
    expect(stockAfterVoid.get(batchOne), 'el lote compartido recupera solo los envases de A').toBe(
      STOCK_ONE_AFTER_VOID,
    );
    expect(stockAfterVoid.get(batchTwo), 'el lote de la presentacion 2 no se toca').toBe(STOCK_TWO_AFTER_DELIVERY);

    const orderAfterVoid = await prisma.order.findUniqueOrThrow({ where: { id }, select: { status: true } });
    expect(orderAfterVoid.status, 'con una presentacion pendiente el pedido vuelve a terminado').toBe('TERMINADO');

    // 6. La lista marca «Anulada» en el subbloque de A y no en el de B.
    await expect(entryPresentation(sectionA, one).getByTestId(DELIVERY_ENTRY_VOIDED_TESTID)).toBeVisible({
      timeout: 60_000,
    });
    await expect(entryPresentation(sectionB, one).getByTestId(DELIVERY_ENTRY_VOIDED_TESTID)).toHaveCount(0);
    await expect(entryPresentation(sectionB, two).getByTestId(DELIVERY_ENTRY_VOIDED_TESTID)).toHaveCount(0);

    // 7. Tab Entregas del producto de la presentacion 1: una fila por cliente, con «Presentación».
    const productOne = required(productOneId, 'el producto 1');
    await gotoSettled(page, finishedProductDetailRoute(productOne));
    await expect(page.getByTestId(FINISHED_PRODUCT_NAME_TESTID)).toHaveText(exactText(FINISHED_ONE_NAME), {
      timeout: 60_000,
    });
    await page.getByTestId('finished-product-tab-entregas').click();
    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get('tab') === 'entregas',
      undefined,
      { timeout: 60_000 },
    );
    const deliveriesTab = page.getByTestId(FINISHED_DELIVERIES_TESTID);
    await expect(deliveriesTab.getByRole('columnheader', { name: PRESENTATION_HEADER })).toBeVisible({
      timeout: 60_000,
    });
    const rows = deliveriesTab.locator('tr').filter({ has: page.getByTestId(FINISHED_DELIVERY_ROW_TESTID) });
    await expect(rows).toHaveCount(2, { timeout: 60_000 });

    const rowA = rows.filter({ has: page.getByTestId(FINISHED_DELIVERY_CUSTOMER_TESTID).filter({ hasText: labelA }) });
    const rowB = rows.filter({ has: page.getByTestId(FINISHED_DELIVERY_CUSTOMER_TESTID).filter({ hasText: labelB }) });
    await expect(rowA).toHaveCount(1);
    await expect(rowB).toHaveCount(1);
    await expect(rowA.getByTestId(FINISHED_DELIVERY_PRESENTATION_TESTID)).toHaveText(exactText(PRESENTATION_ONE_NAME));
    await expect(rowB.getByTestId(FINISHED_DELIVERY_PRESENTATION_TESTID)).toHaveText(exactText(PRESENTATION_ONE_NAME));
    await expect(rowA.getByTestId(FINISHED_DELIVERY_LOT_TESTID)).toHaveText(exactText(LOT_ONE));
    await expect(rowB.getByTestId(FINISHED_DELIVERY_LOT_TESTID)).toHaveText(exactText(LOT_ONE));
    await expect(rowA.getByTestId(FINISHED_DELIVERY_PACKAGES_TESTID)).toHaveText(exactText(A_ONE_PACKAGES));
    await expect(rowB.getByTestId(FINISHED_DELIVERY_PACKAGES_TESTID)).toHaveText(exactText(B_ONE_PACKAGES));
    await expect(rowA.getByTestId(FINISHED_DELIVERY_ROW_TESTID)).toHaveAttribute('data-voided', 'true');
    await expect(rowB.getByTestId(FINISHED_DELIVERY_ROW_TESTID)).toHaveAttribute('data-voided', 'false');
  });
});
