/**
 * QC-288 R56 — E2E de la entrega sin pedido desde la ficha del producto terminado, de su anulacion
 * por cliente y de sus lecturas.
 *
 * EL RECORRIDO del Administrador va en un solo `test()`: cada paso es la precondicion del
 * siguiente y partirlo obligaria a resembrar lo que dejo el anterior.
 *   1. en la ficha del producto con excedente, «Entregar» de la cabecera abre el sheet;
 *   2. con mas envases que el excedente entre los dos clientes, «Entregar» queda deshabilitado;
 *   3. dos clientes que comparten un lote, con nota: en Postgres una sola entrega sin pedido con su
 *      producto y su nota, sus lineas por cliente, un asiento `direct_delivery` por lote con la
 *      suma, la existencia de cada lote y ningun pedido cambiado;
 *   4. el tab Entregas pinta cada fila con «Sin pedido» y la nota; «Anular» de la fila anula solo la
 *      parte del primer cliente: en Postgres el lote recupera solo lo anulado y el otro cliente
 *      conserva la suya;
 *   5. el historial del lote compartido, desde el menu de la fila del listado, muestra «Entrega sin
 *      pedido» con los dos clientes y la anulacion con el primero.
 * Un segundo `test()` comprueba que un producto sin excedente no tiene «Entregar» ni en la cabecera
 * de su ficha ni en el menu de su fila del listado, y que el producto con excedente si lo tiene en
 * el menu, despues de «Lotes».
 *
 * EXCEDENTE DEL FIXTURE. Las dos presentaciones tienen contenido 1. Un pedido `TERMINADO` de la
 * misma receta espera 4 envases de la presentacion del producto con excedente y 3 de la del otro.
 *  - Con excedente: lote 1 con 10 envases y lote 2 con 5 -> 15 en stock, 4 esperando, 11 libres.
 *  - Sin excedente: un lote con 3 envases y 3 esperando -> 0 libres.
 *
 * DATOS, mismo patron que `e2e/entrega-a-varios-clientes.spec.ts`:
 *  - todo lo que este archivo crea lleva el prefijo `qc288_e2e_` y dentro el `RUN_ID` del worker;
 *  - una empresa efimera propia, asi que el listado y la busqueda de cliente solo ven lo de este
 *    worker;
 *  - la limpieza defensiva de huerfanos borra por prefijo Y POR EDAD;
 *  - `afterAll` borra SIEMPRE, aunque un paso reviente, por los identificadores de ESTE worker y en
 *    el orden que imponen las FK.
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
import { INVENTORY_ROUTE, finishedProductDetailRoute } from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { batchActionsTrigger, openRowActionsMenuItem } from './helpers/row-actions-menu';

/** Prefijo con el que este spec marca TODO lo que crea. Nada fuera de el se toca. */
const FIXTURE_PREFIX = 'qc288_e2e_';

/** Identificador unico de este proceso de worker. */
const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit corren a la vez: la limpieza defensiva no puede borrar por prefijo a secas. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;

/** Nunca la empresa de instalacion: `companies_name_unique` es GLOBAL. */
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const RECIPE_NAME = `${SHARED_TOKEN}_receta`;
const PRESENTATION_SURPLUS_NAME = `${SHARED_TOKEN}_botella`;
const PRESENTATION_NO_SURPLUS_NAME = `${SHARED_TOKEN}_garrafa`;
const SURPLUS_PRODUCT_NAME = `${SHARED_TOKEN}_con_excedente`;
const NO_SURPLUS_PRODUCT_NAME = `${SHARED_TOKEN}_sin_excedente`;
const LOT_ONE = `${SHARED_TOKEN}_lote_1`;
const LOT_TWO = `${SHARED_TOKEN}_lote_2`;
const LOT_NO_SURPLUS = `${SHARED_TOKEN}_lote_3`;

type Credentials = { readonly username: string; readonly password: string };

const adminUser: Credentials = {
  username: `${SHARED_TOKEN}_admin`,
  password: `Qc288-Admin-${RUN_ID.slice(0, 12)}`,
};

/** Los nombres llevan el `RUN_ID` para que la busqueda no case con los de otro worker. */
type CustomerFixture = { readonly firstNames: string; readonly lastNames: string };
const CUSTOMER_A: CustomerFixture = { firstNames: `Ana ${RUN_ID.slice(0, 10)}`, lastNames: 'Primera' };
const CUSTOMER_B: CustomerFixture = { firstNames: `Bea ${RUN_ID.slice(0, 10)}`, lastNames: 'Segunda' };

function customerLabel(customer: CustomerFixture): string {
  return `${customer.firstNames} ${customer.lastNames}`;
}

const CONTENT = '1.0000';
const STOCK_ONE = '10.0000';
const STOCK_TWO = '5.0000';
const STOCK_NO_SURPLUS = '3.0000';
const SURPLUS_PRODUCT_STOCK = '15.0000';
const WAITING_SURPLUS_PACKAGES = 4;
const WAITING_NO_SURPLUS_PACKAGES = 3;

/** Lo que se escribe para pasarse: 10 + 5 = 15 envases con 11 libres. */
const OVER_A_ONE = '10';
const OVER_B_TWO = '5';

/**
 * Lo que se entrega: A lleva 3 del lote 1; B lleva 2 del MISMO lote 1 y 4 del lote 2. 9 de 11.
 */
const A_ONE_PACKAGES = '3';
const B_ONE_PACKAGES = '2';
const B_TWO_PACKAGES = '4';
const DELIVERY_ONE_QUANTITY = '-5.0000';
const DELIVERY_TWO_QUANTITY = '-4.0000';
const STOCK_ONE_AFTER_DELIVERY = '5.0000';
const STOCK_TWO_AFTER_DELIVERY = '1.0000';
/** La anulacion de A devuelve SOLO sus 3 envases al lote 1. */
const VOID_ONE_QUANTITY = '3.0000';
const STOCK_ONE_AFTER_VOID = '8.0000';

const DELIVERY_NOTE = `Venta de mostrador ${RUN_ID.slice(0, 8)}`;
const VOID_REASON = `Devuelta por la primera ${RUN_ID.slice(0, 8)}`;

/** El ano sale del reloj: el CHECK `orders_order_year_matches_created_at` lo ata a `created_at`. */
const ORDER_SEQUENCE = 920_000 + Math.floor(Math.random() * 70_000);
const FINISHED_AT = new Date(Date.now() - 6 * 60 * 60 * 1000);

/** Textos visibles que el recorrido afirma. */
const DIRECT_DELIVERY_TEXT = 'Sin pedido';
const DIRECT_DELIVERY_KIND_TEXT = 'Entrega sin pedido';
const DIRECT_DELIVERY_VOID_KIND_TEXT = 'Anulación de entrega sin pedido';
const DELIVER_MENU_TEXT = 'Entregar';
const BATCHES_MENU_TEXT = 'Lotes';

/** `data-testid` de la ficha del producto terminado. */
const FINISHED_PRODUCT_NAME_TESTID = 'finished-product-name';
const FINISHED_TAB_DELIVERIES_TESTID = 'finished-product-tab-entregas';
const FINISHED_DELIVERIES_TESTID = 'finished-product-entregas';
const FINISHED_DELIVERY_ROW_TESTID = 'finished-product-delivery-row';
const FINISHED_DELIVERY_CUSTOMER_TESTID = 'finished-product-delivery-customer';
const FINISHED_DELIVERY_LOT_TESTID = 'finished-product-delivery-lot';
const FINISHED_DELIVERY_PACKAGES_TESTID = 'finished-product-delivery-packages';
const FINISHED_DELIVERY_DIRECT_TESTID = 'finished-product-delivery-direct';
const FINISHED_DELIVERY_NOTE_TESTID = 'finished-product-delivery-note';
const FINISHED_DELIVERY_ACTIONS_TESTID = 'finished-product-delivery-actions';
const FINISHED_DELIVERY_VOID_ITEM_TESTID = 'finished-product-delivery-direct-void';

/** `data-testid` del sheet «Entregar sin pedido». */
const DIRECT_OPEN_TESTID = 'direct-delivery-open';
const DIRECT_SHEET_TESTID = 'direct-delivery-sheet';
const DIRECT_SURPLUS_TESTID = 'direct-delivery-surplus';
const DIRECT_NOTE_TESTID = 'direct-delivery-note';
const DIRECT_OVER_SURPLUS_TESTID = 'direct-delivery-over-surplus';
const DIRECT_SUBMIT_TESTID = 'direct-delivery-submit';
const DIRECT_ERROR_TESTID = 'direct-delivery-error';
const DIRECT_REJECTED_TESTID = 'direct-delivery-rejected';
const DELIVERY_BLOCK_TESTID = 'order-delivery-block';
const DELIVERY_ADD_CUSTOMER_TESTID = 'order-delivery-add-customer';
const DELIVERY_BATCH_TESTID = 'order-delivery-batch';
const DELIVERY_BATCH_PACKAGES_TESTID = 'order-delivery-batch-packages';
const CUSTOMER_PICKER_TESTID = 'order-customer-picker';
const CUSTOMER_PICKER_OPTION_TESTID = 'order-customer-picker-option';

/** `data-testid` del dialogo de anular la entrega sin pedido. */
const VOID_DIALOG_TESTID = 'direct-delivery-void-dialog';
const VOID_CUSTOMER_TESTID = 'direct-delivery-void-customer';
const VOID_REASON_TESTID = 'direct-delivery-void-reason';
const VOID_CONFIRM_TESTID = 'direct-delivery-void-confirm';
const VOID_ERROR_TESTID = 'direct-delivery-void-error';
const VOID_REJECTED_TESTID = 'direct-delivery-void-rejected';

/** `data-testid` del listado de inventario, del panel de lotes y del historial. */
const INVENTORY_TITLE_TESTID = 'inventario-title';
const TABLE_ROW_TESTID_PREFIX = 'data-table-row-';
const FINISHED_STOCK_NAME_TESTID = 'finished-stock-name';
const FINISHED_STOCK_TOGGLE_TESTID = 'finished-stock-toggle';
const PRODUCT_ROW_ACTIONS_TESTID = 'product-row-actions';
const PRODUCT_ACTION_BATCHES_TESTID = 'product-batches-open';
const PRODUCT_ACTION_DIRECT_DELIVERY_TESTID = 'product-action-direct-delivery';
const BATCHES_SHEET_TESTID = 'product-batches-sheet';
const BATCH_HISTORY_ITEM_TESTID = 'batch-history-trigger';
const BATCH_HISTORY_DIALOG_TESTID = 'batch-history-dialog';
const BATCH_HISTORY_LIST_TESTID = 'batch-history-list';
const BATCH_HISTORY_KIND_TESTID = 'batch-history-entry-kind';
const BATCH_HISTORY_CUSTOMERS_TESTID = 'batch-history-entry-customers';

let companyId: string | null = null;
let adminUserId: string | null = null;
let recipeId: string | null = null;
let orderId: string | null = null;
let customerAId: string | null = null;
let customerBId: string | null = null;
let surplusProductId: string | null = null;
let noSurplusProductId: string | null = null;
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

/** En WebKit el refresco que deja una accion anterior puede interrumpir la navegacion. */
async function gotoSettled(page: Page, url: string): Promise<void> {
  await expect(async () => {
    await page.goto(url);
  }).toPass({ timeout: 60_000 });
}

async function gotoProduct(page: Page, productId: string, productName: string): Promise<void> {
  await gotoSettled(page, finishedProductDetailRoute(productId));
  await expect(page.getByTestId(FINISHED_PRODUCT_NAME_TESTID)).toHaveText(exactText(productName), {
    timeout: 60_000,
  });
}

/** Pestaña «Producto terminado» del listado, filtrada por el token de este worker. */
async function gotoFinishedStock(page: Page): Promise<void> {
  const query = new URLSearchParams({ type: 'FINISHED_PRODUCT', q: SHARED_TOKEN, pageSize: '25' });
  await gotoSettled(page, `${INVENTORY_ROUTE}?${query.toString()}`);
  await expect(page.getByTestId(INVENTORY_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });
}

/** Despliega la fila «Sin pedido» del producto y devuelve el disparador del menu de su linea. */
async function productLineMenuTrigger(page: Page, productId: string, productName: string): Promise<Locator> {
  const groupRow = page
    .locator(`[data-testid^="${TABLE_ROW_TESTID_PREFIX}"]`)
    .filter({ has: page.getByTestId(FINISHED_STOCK_NAME_TESTID).filter({ hasText: exactText(productName) }) });
  await expect(groupRow).toHaveCount(1, { timeout: 60_000 });
  const toggle = groupRow.getByTestId(FINISHED_STOCK_TOGGLE_TESTID);
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  const trigger = page.locator(
    `[data-testid^="${TABLE_ROW_TESTID_PREFIX}"] [data-testid="${PRODUCT_ROW_ACTIONS_TESTID}"][data-product-id="${productId}"]`,
  );
  await expect(trigger).toHaveCount(1, { timeout: 60_000 });
  return trigger;
}

/** El bloque de cliente en esa posicion (0 = «Cliente 1»). */
function block(sheet: Locator, index: number): Locator {
  return sheet.locator(`[data-testid="${DELIVERY_BLOCK_TESTID}"][data-block-index="${index}"]`);
}

function blockBatchPackages(scope: Locator, batchId: string): Locator {
  return scope
    .locator(`[data-testid="${DELIVERY_BATCH_TESTID}"][data-batch-id="${batchId}"]`)
    .getByTestId(DELIVERY_BATCH_PACKAGES_TESTID);
}

/** Vacia el selector de cliente del bloque, escribe la etiqueta y elige esa opcion. */
async function chooseCustomer(page: Page, scope: Locator, label: string): Promise<void> {
  const input = scope.getByTestId(CUSTOMER_PICKER_TESTID).getByRole('combobox');
  await input.click();
  await input.fill('');
  await input.fill(label);
  const option = page.getByTestId(CUSTOMER_PICKER_OPTION_TESTID).filter({ hasText: label });
  await expect(option).toHaveCount(1, { timeout: 60_000 });
  await option.click();
  await expect(input).toHaveValue(label);
}

/** Pulsa «Entregar» de la cabecera. En WebKit un clic antes de hidratar se pierde: se repite. */
async function openDirectDeliverySheet(page: Page): Promise<Locator> {
  const trigger = page.getByTestId(DIRECT_OPEN_TESTID);
  const sheet = page.getByTestId(DIRECT_SHEET_TESTID);
  await expect(async () => {
    if ((await sheet.count()) === 0) await trigger.click();
    await expect(sheet).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await expect(sheet.getByTestId(DIRECT_SURPLUS_TESTID)).toBeVisible({ timeout: 60_000 });
  await expect(block(sheet, 0)).toBeVisible({ timeout: 60_000 });
  return sheet;
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
}): Promise<string> {
  const created = await prisma.productBatch.create({
    data: {
      productId: params.productId,
      presentationId: params.presentationId,
      stock: params.stock,
      unitCost: '1.0000',
      packageContent: CONTENT,
      lot: params.lot,
      purchaseDate: new Date('2026-09-01T00:00:00Z'),
      companyId: required(companyId, 'la empresa'),
      createdBy: adminUserId,
    },
    select: { id: true },
  });
  return created.id;
}

/** Lo que no debe cambiar del pedido que espera envases. */
async function orderSnapshot(id: string): Promise<unknown> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id },
    select: {
      status: true,
      updatedAt: true,
      customerId: true,
      presentationLines: {
        select: { id: true, packages: true, packedPackages: true },
        orderBy: { id: 'asc' },
      },
    },
  });
  return { ...order, updatedAt: order.updatedAt.toISOString() };
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
  // La entrega sin pedido apunta al producto: va antes que el.
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
        firstNames: `Qc288${RUN_ID.slice(0, 8)}`,
        lastNames: 'SinPedido',
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

  const [presentationSurplus, presentationNoSurplus] = await Promise.all(
    [PRESENTATION_SURPLUS_NAME, PRESENTATION_NO_SURPLUS_NAME].map((name) =>
      prisma.presentation.create({
        data: {
          name,
          nameNormalized: normalizePresentationName(name),
          unitId: unit.id,
          content: CONTENT,
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
  surplusProductId = await createFinishedProduct({
    name: SURPLUS_PRODUCT_NAME,
    unitId: unit.id,
    presentationId: presentationSurplus.id,
    stock: SURPLUS_PRODUCT_STOCK,
  });
  noSurplusProductId = await createFinishedProduct({
    name: NO_SURPLUS_PRODUCT_NAME,
    unitId: unit.id,
    presentationId: presentationNoSurplus.id,
    stock: STOCK_NO_SURPLUS,
  });

  batchOneId = await createFinishedBatch({
    productId: surplusProductId,
    presentationId: presentationSurplus.id,
    lot: LOT_ONE,
    stock: STOCK_ONE,
  });
  batchTwoId = await createFinishedBatch({
    productId: surplusProductId,
    presentationId: presentationSurplus.id,
    lot: LOT_TWO,
    stock: STOCK_TWO,
  });
  await createFinishedBatch({
    productId: noSurplusProductId,
    presentationId: presentationNoSurplus.id,
    lot: LOT_NO_SURPLUS,
    stock: STOCK_NO_SURPLUS,
  });

  // El pedido que espera envases: `TERMINADO` exige fecha de terminado, quien empaco y quien acondiciono.
  const order = await prisma.order.create({
    data: {
      companyId,
      orderYear: new Date().getUTCFullYear(),
      orderSequence: ORDER_SEQUENCE,
      recipeId,
      quantity: '7.0000',
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
            presentationId: presentationSurplus.id,
            packages: WAITING_SURPLUS_PACKAGES,
            presentationContent: CONTENT,
          },
          {
            companyId,
            presentationId: presentationNoSurplus.id,
            packages: WAITING_NO_SURPLUS_PACKAGES,
            presentationContent: CONTENT,
          },
        ],
      },
    },
    select: { id: true },
  });
  orderId = order.id;
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

test.describe('entrega sin pedido', () => {
  test('R56: entrega sin pedido a dos clientes que comparten un lote con nota, tope del excedente, tab Entregas con «Sin pedido», anulacion de un cliente e historial del lote', async ({
    page,
  }) => {
    const productId = required(surplusProductId, 'el producto con excedente');
    const id = required(orderId, 'el pedido');
    const customerA = required(customerAId, 'el cliente A');
    const customerB = required(customerBId, 'el cliente B');
    const batchOne = required(batchOneId, 'el lote 1');
    const batchTwo = required(batchTwoId, 'el lote 2');
    const labelA = customerLabel(CUSTOMER_A);
    const labelB = customerLabel(CUSTOMER_B);
    const orderBefore = await orderSnapshot(id);

    await loginAndLand(page, adminUser);
    await gotoProduct(page, productId, SURPLUS_PRODUCT_NAME);

    // 1. «Entregar» de la cabecera abre el sheet con un bloque y el excedente.
    const sheet = await openDirectDeliverySheet(page);
    await expect(sheet.getByTestId(DIRECT_SURPLUS_TESTID).locator('[data-field="surplus"]')).toContainText('11');
    await sheet.getByTestId(DELIVERY_ADD_CUSTOMER_TESTID).click();
    await expect(sheet.getByTestId(DELIVERY_BLOCK_TESTID)).toHaveCount(2);
    const first = block(sheet, 0);
    const second = block(sheet, 1);
    await chooseCustomer(page, first, labelA);
    await chooseCustomer(page, second, labelB);

    // 2. Mas envases que el excedente entre los dos clientes: «Entregar» deshabilitado.
    const submit = sheet.getByTestId(DIRECT_SUBMIT_TESTID);
    await blockBatchPackages(first, batchOne).fill(OVER_A_ONE);
    await blockBatchPackages(second, batchTwo).fill(OVER_B_TWO);
    await expect(sheet.getByTestId(DIRECT_OVER_SURPLUS_TESTID)).toBeVisible();
    await expect(submit).toBeDisabled();

    // 3. Dos clientes que comparten el lote 1, con nota: se entrega.
    await blockBatchPackages(first, batchOne).fill(A_ONE_PACKAGES);
    await blockBatchPackages(second, batchOne).fill(B_ONE_PACKAGES);
    await blockBatchPackages(second, batchTwo).fill(B_TWO_PACKAGES);
    await sheet.getByTestId(DIRECT_NOTE_TESTID).fill(DELIVERY_NOTE);
    await expect(sheet.getByTestId(DIRECT_OVER_SURPLUS_TESTID)).toHaveCount(0);
    await expect(submit).toBeEnabled();

    await submit.click();
    await expect(sheet, 'el sheet deberia cerrarse al aplicar la entrega').toHaveCount(0, { timeout: 60_000 }).catch(
      async (error: unknown) => {
        const notices = [
          ...(await sheet.getByTestId(DIRECT_ERROR_TESTID).allTextContents()),
          ...(await sheet.getByTestId(DIRECT_REJECTED_TESTID).allTextContents()),
        ];
        throw new Error(`la entrega no se aplico; avisos: ${JSON.stringify(notices)}`, { cause: error });
      },
    );

    await expect
      .poll(() => prisma.orderDelivery.count({ where: { productId } }), { timeout: 30_000 })
      .toBe(1);
    const delivery = await prisma.orderDelivery.findFirstOrThrow({
      where: { productId },
      select: {
        id: true,
        orderId: true,
        note: true,
        lines: {
          select: { customerId: true, orderPresentationLineId: true, batchId: true, packages: true, quantity: true },
        },
      },
    });
    expect(delivery.orderId, 'una entrega sin pedido').toBeNull();
    expect(delivery.note, 'con su nota').toBe(DELIVERY_NOTE);
    const lineKey = (line: { customerId: string; batchId: string }) => `${line.customerId}:${line.batchId}`;
    expect(
      delivery.lines
        .map((line) => ({ ...line, quantity: line.quantity.toFixed(4) }))
        .sort((a, b) => lineKey(a).localeCompare(lineKey(b))),
      'sus lineas por cliente y lote',
    ).toEqual(
      [
        { customerId: customerA, orderPresentationLineId: null, batchId: batchOne, packages: 3, quantity: '3.0000' },
        { customerId: customerB, orderPresentationLineId: null, batchId: batchOne, packages: 2, quantity: '2.0000' },
        { customerId: customerB, orderPresentationLineId: null, batchId: batchTwo, packages: 4, quantity: '4.0000' },
      ].sort((a, b) => lineKey(a).localeCompare(lineKey(b))),
    );

    const deliveryMovements = await prisma.inventoryMovement.findMany({
      where: { orderDeliveryId: delivery.id },
      select: { id: true, batchId: true, kind: true, quantity: true, orderId: true },
    });
    expect(deliveryMovements, 'un asiento por lote, no por cliente').toHaveLength(2);
    const movementByBatch = new Map(deliveryMovements.map((movement) => [movement.batchId, movement]));
    expect(movementByBatch.get(batchOne)?.kind).toBe('direct_delivery');
    expect(movementByBatch.get(batchOne)?.quantity.toFixed(4), 'el lote compartido suma los dos clientes').toBe(
      DELIVERY_ONE_QUANTITY,
    );
    expect(movementByBatch.get(batchOne)?.orderId).toBeNull();
    expect(movementByBatch.get(batchTwo)?.kind).toBe('direct_delivery');
    expect(movementByBatch.get(batchTwo)?.quantity.toFixed(4)).toBe(DELIVERY_TWO_QUANTITY);
    const deliveryMovementOne = required(movementByBatch.get(batchOne)?.id ?? null, 'el asiento del lote 1');

    const batchesAfterDelivery = await prisma.productBatch.findMany({
      where: { id: { in: [batchOne, batchTwo] } },
      select: { id: true, stock: true },
    });
    const stockAfterDelivery = new Map(batchesAfterDelivery.map((batch) => [batch.id, batch.stock.toFixed(4)]));
    expect(stockAfterDelivery.get(batchOne)).toBe(STOCK_ONE_AFTER_DELIVERY);
    expect(stockAfterDelivery.get(batchTwo)).toBe(STOCK_TWO_AFTER_DELIVERY);

    expect(await orderSnapshot(id), 'ningun pedido cambio').toEqual(orderBefore);
    expect(
      await prisma.orderDelivery.count({ where: { companyId: required(companyId, 'la empresa'), orderId: { not: null } } }),
      'ninguna entrega de pedido',
    ).toBe(0);

    // 4. Tab Entregas: una fila por cliente y lote, con «Sin pedido» y la nota.
    await gotoProduct(page, productId, SURPLUS_PRODUCT_NAME);
    await page.getByTestId(FINISHED_TAB_DELIVERIES_TESTID).click();
    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get('tab') === 'entregas',
      undefined,
      { timeout: 60_000 },
    );
    const deliveriesTab = page.getByTestId(FINISHED_DELIVERIES_TESTID);
    const rows = deliveriesTab.locator('tr').filter({ has: page.getByTestId(FINISHED_DELIVERY_ROW_TESTID) });
    await expect(rows).toHaveCount(3, { timeout: 60_000 });
    for (const row of await rows.all()) {
      await expect(row.getByTestId(FINISHED_DELIVERY_DIRECT_TESTID)).toHaveText(exactText(DIRECT_DELIVERY_TEXT));
      await expect(row.getByTestId(FINISHED_DELIVERY_NOTE_TESTID)).toHaveText(exactText(DELIVERY_NOTE));
    }
    const rowA = rows.filter({ has: page.getByTestId(FINISHED_DELIVERY_CUSTOMER_TESTID).filter({ hasText: labelA }) });
    const rowsB = rows.filter({ has: page.getByTestId(FINISHED_DELIVERY_CUSTOMER_TESTID).filter({ hasText: labelB }) });
    await expect(rowA).toHaveCount(1);
    await expect(rowsB).toHaveCount(2);
    await expect(rowA.getByTestId(FINISHED_DELIVERY_LOT_TESTID)).toHaveText(exactText(LOT_ONE));
    await expect(rowA.getByTestId(FINISHED_DELIVERY_PACKAGES_TESTID)).toHaveText(exactText(A_ONE_PACKAGES));

    // «Anular» del menu de la fila: solo la parte de A.
    await (
      await openRowActionsMenuItem(page, rowA.getByTestId(FINISHED_DELIVERY_ACTIONS_TESTID), FINISHED_DELIVERY_VOID_ITEM_TESTID)
    ).click();
    const dialog = page.getByTestId(VOID_DIALOG_TESTID);
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    const voidA = dialog.locator(`[data-testid="${VOID_CUSTOMER_TESTID}"][data-customer-id="${customerA}"]`);
    const voidB = dialog.locator(`[data-testid="${VOID_CUSTOMER_TESTID}"][data-customer-id="${customerB}"]`);
    await expect(voidA).toBeVisible({ timeout: 60_000 });
    await expect(voidB).toBeVisible();
    await voidA.click();
    await expect(voidA).toBeChecked();
    await expect(voidB).not.toBeChecked();
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
        lines: { select: { deliveryLine: { select: { customerId: true, batchId: true } } } },
      },
    });
    expect(voidRow.reason).toBe(VOID_REASON);
    expect(
      voidRow.lines.map((line) => line.deliveryLine),
      'la anulacion lleva solo la linea del primer cliente',
    ).toEqual([{ customerId: customerA, batchId: batchOne }]);

    const linesOfB = await prisma.orderDeliveryLine.findMany({
      where: { deliveryId: delivery.id, customerId: customerB },
      select: { voidLine: { select: { id: true } } },
    });
    expect(linesOfB).toHaveLength(2);
    expect(
      linesOfB.every((line) => line.voidLine === null),
      'el otro cliente conserva la suya',
    ).toBe(true);

    const voidMovements = await prisma.inventoryMovement.findMany({
      where: { orderDeliveryVoidId: voidRow.id },
      select: { id: true, batchId: true, kind: true, quantity: true },
    });
    expect(voidMovements).toEqual([expect.objectContaining({ batchId: batchOne, kind: 'direct_delivery_void' })]);
    expect(voidMovements[0]?.quantity.toFixed(4), 'el lote recupera solo lo anulado').toBe(VOID_ONE_QUANTITY);
    const voidMovementOne = required(voidMovements[0]?.id ?? null, 'el asiento de la anulacion');

    const batchesAfterVoid = await prisma.productBatch.findMany({
      where: { id: { in: [batchOne, batchTwo] } },
      select: { id: true, stock: true },
    });
    const stockAfterVoid = new Map(batchesAfterVoid.map((batch) => [batch.id, batch.stock.toFixed(4)]));
    expect(stockAfterVoid.get(batchOne), 'el lote compartido recupera solo los envases de A').toBe(
      STOCK_ONE_AFTER_VOID,
    );
    expect(stockAfterVoid.get(batchTwo), 'el lote solo de B no se toca').toBe(STOCK_TWO_AFTER_DELIVERY);
    expect(await orderSnapshot(id), 'la anulacion tampoco toca el pedido').toEqual(orderBefore);

    await expect(rowA.getByTestId(FINISHED_DELIVERY_ROW_TESTID)).toHaveAttribute('data-voided', 'true', {
      timeout: 60_000,
    });
    for (const row of await rowsB.all()) {
      await expect(row.getByTestId(FINISHED_DELIVERY_ROW_TESTID)).toHaveAttribute('data-voided', 'false');
    }

    // 5. Historial del lote compartido: «Entrega sin pedido» con los dos clientes.
    await gotoFinishedStock(page);
    const trigger = await productLineMenuTrigger(page, productId, SURPLUS_PRODUCT_NAME);
    await (await openRowActionsMenuItem(page, trigger, PRODUCT_ACTION_BATCHES_TESTID)).click();
    const panel = page.getByTestId(BATCHES_SHEET_TESTID);
    await expect(panel).toBeVisible({ timeout: 60_000 });
    const batchRow = panel.getByTestId(`${TABLE_ROW_TESTID_PREFIX}${batchOne}`);
    await expect(batchRow).toBeVisible({ timeout: 60_000 });
    await (await openRowActionsMenuItem(page, batchActionsTrigger(batchRow), BATCH_HISTORY_ITEM_TESTID)).click();
    const history = page.getByTestId(BATCH_HISTORY_DIALOG_TESTID);
    await expect(history).toBeVisible({ timeout: 60_000 });
    const list = history.getByTestId(BATCH_HISTORY_LIST_TESTID);
    await expect(list).toBeVisible({ timeout: 60_000 });

    const deliveryEntry = list.getByTestId(`${TABLE_ROW_TESTID_PREFIX}direct_delivery-${deliveryMovementOne}`);
    await expect(deliveryEntry).toBeVisible({ timeout: 60_000 });
    await expect(deliveryEntry.getByTestId(BATCH_HISTORY_KIND_TESTID)).toHaveText(exactText(DIRECT_DELIVERY_KIND_TEXT));
    await expect(deliveryEntry.getByTestId(BATCH_HISTORY_CUSTOMERS_TESTID)).toHaveText(
      exactText(`${labelA}, ${labelB}`),
    );

    const voidEntry = list.getByTestId(`${TABLE_ROW_TESTID_PREFIX}direct_delivery_void-${voidMovementOne}`);
    await expect(voidEntry).toBeVisible();
    await expect(voidEntry.getByTestId(BATCH_HISTORY_KIND_TESTID)).toHaveText(
      exactText(DIRECT_DELIVERY_VOID_KIND_TEXT),
    );
    await expect(voidEntry.getByTestId(BATCH_HISTORY_CUSTOMERS_TESTID)).toHaveText(exactText(labelA));
  });

  test('R56: un producto sin excedente no tiene «Entregar» ni en la cabecera de su ficha ni en el menu de su fila; el que tiene excedente lo ofrece despues de «Lotes»', async ({
    page,
  }) => {
    const productId = required(surplusProductId, 'el producto con excedente');
    const noSurplusId = required(noSurplusProductId, 'el producto sin excedente');

    await loginAndLand(page, adminUser);

    // La cabecera: el producto con excedente lo tiene, el otro no.
    await gotoProduct(page, productId, SURPLUS_PRODUCT_NAME);
    await expect(page.getByTestId(DIRECT_OPEN_TESTID)).toBeVisible();
    await gotoProduct(page, noSurplusId, NO_SURPLUS_PRODUCT_NAME);
    await expect(page.getByTestId(DIRECT_OPEN_TESTID)).toHaveCount(0);

    // El menu de la fila del listado.
    await gotoFinishedStock(page);
    const surplusTrigger = await productLineMenuTrigger(page, productId, SURPLUS_PRODUCT_NAME);
    await openRowActionsMenuItem(page, surplusTrigger, PRODUCT_ACTION_BATCHES_TESTID);
    const menu = page.getByRole('menu');
    await expect(menu.getByTestId(PRODUCT_ACTION_DIRECT_DELIVERY_TESTID)).toBeVisible();
    const items = await menu.getByRole('menuitem').allInnerTexts();
    const batchesIndex = items.findIndex((text) => text.trim() === BATCHES_MENU_TEXT);
    expect(batchesIndex, '«Lotes» esta en el menu').toBeGreaterThanOrEqual(0);
    expect(items[batchesIndex + 1]?.trim(), '«Entregar» va despues de «Lotes»').toBe(DELIVER_MENU_TEXT);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);

    const noSurplusTrigger = await productLineMenuTrigger(page, noSurplusId, NO_SURPLUS_PRODUCT_NAME);
    await openRowActionsMenuItem(page, noSurplusTrigger, PRODUCT_ACTION_BATCHES_TESTID);
    await expect(page.getByRole('menu').getByTestId(PRODUCT_ACTION_BATCHES_TESTID)).toBeVisible();
    await expect(page.getByRole('menu').getByTestId(PRODUCT_ACTION_DIRECT_DELIVERY_TESTID)).toHaveCount(0);
  });
});
