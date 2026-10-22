/**
 * E2E de la ficha de un producto terminado.
 *
 * EL RECORRIDO del Administrador va en un solo `test()`: cada paso es la precondicion del
 * siguiente y partirlo obligaria a resembrar lo que dejo el anterior.
 *   1. entrega parte del producto terminado de un pedido `TERMINADO` desde el menu de su fila;
 *   2. abre la ficha desde el enlace de la presentacion en la fila de /pedidos;
 *   3. en Lotes ve el lote con su pedido; en Entradas, la produccion; en Salidas, la entrega; en
 *      Entregas, el cliente, el pedido, la presentacion, el lote y los envases;
 *   4. vuelve a /inventario y abre la misma ficha desde la pestana de producto terminado.
 * Un segundo `test()` entra con un usuario sin `inventario.consultar` y la ficha le responde 404.
 *
 * ENMIENDA 2026-10-15 (QC-282): el sheet «Entregar» va por bloques de cliente; con un solo bloque el
 * selector de cliente y el campo del lote siguen siendo unicos en el panel, asi que la entrega del
 * paso 1 no cambia. El cliente de la entrega vive ahora en sus lineas, y el tab Entregas -que lo lee
 * de ellas- gana la columna «Presentación» (QC-282 R43), que el paso 3d afirma. Este spec no siembra
 * entregas por Prisma: no hay SQL que mover. Las aserciones previas se conservan.
 *
 * QUE APORTA SOBRE UNIT E INTEGRACION: los dos puntos de llegada, los tabs por URL y la lectura de
 * los asientos que deja una entrega de verdad, contra un navegador real y Postgres. Chromium y
 * WebKit: WebKit es el motor de iOS y la regla multiplataforma pide ejercitarlo.
 *
 * DATOS, mismo patron que `e2e/entregar-producto-terminado.spec.ts`:
 *  - todo lo que este archivo crea lleva el prefijo `qc225_e2e_` y dentro el `RUN_ID` del worker;
 *  - una empresa efimera propia, asi que las listas solo ven lo de este worker;
 *  - la limpieza defensiva de huerfanos borra por prefijo Y POR EDAD, para no llevarse lo que otra
 *    ejecucion viva acaba de crear;
 *  - `afterAll` borra SIEMPRE, aunque un paso reviente, por los identificadores de ESTE worker y en
 *    el orden que imponen las FK.
 *
 * SEMBRADO POR PRISMA todo lo previo a la entrega: empresa, Administrador, un rol efimero sin
 * permisos y su usuario, un cliente, una unidad del catalogo arrancador (nunca creada ni borrada
 * aqui), una presentacion con contenido, la receta, el producto terminado con su lote, el pedido
 * `TERMINADO` y el asiento `production` que ata el lote a la linea del pedido, como lo deja
 * Terminar.
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
import { formatOrderNumber } from '@/lib/modules/pedidos';
import { normalizeRecipeName } from '@/lib/modules/recetas';
import { prisma } from '@/lib/shared/db/prisma';
import { INVENTORY_ROUTE, ORDERS_ROUTE, finishedProductDetailRoute } from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { openOrderRowMenu, orderMenuTrigger } from './helpers/order-distribution';

/** Prefijo con el que este spec marca TODO lo que crea. Nada fuera de el se toca. */
const FIXTURE_PREFIX = 'qc225_e2e_';

/** Identificador unico de este proceso de worker. */
const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit pueden correr a la vez: la limpieza defensiva no borra por prefijo a secas. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;

/** Nunca la empresa de instalacion: `companies_name_unique` es GLOBAL. */
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const RECIPE_NAME = `${SHARED_TOKEN}_receta`;
const PRESENTATION_NAME = `${SHARED_TOKEN}_botella`;
const FINISHED_NAME = `${SHARED_TOKEN}_terminado`;
const LOT = `${SHARED_TOKEN}_lote`;
const NO_PERMISSIONS_ROLE_NAME = `${SHARED_TOKEN}_rol_sin_permisos`;

type Credentials = { readonly username: string; readonly password: string };

const adminUser: Credentials = {
  username: `${SHARED_TOKEN}_admin`,
  password: `Qc225-Admin-${RUN_ID.slice(0, 12)}`,
};
/** Sin `inventario.consultar`: el actor del camino negativo. */
const noAccessUser: Credentials = {
  username: `${SHARED_TOKEN}_sinacceso`,
  password: `Qc225-SinAcceso-${RUN_ID.slice(0, 12)}`,
};

/** El nombre lleva el `RUN_ID` para no casar con el cliente de otro worker. */
const CUSTOMER = { firstNames: `Ana ${RUN_ID.slice(0, 10)}`, lastNames: 'Ficha' } as const;
const CUSTOMER_LABEL = `${CUSTOMER.firstNames} ${CUSTOMER.lastNames}`;

/** Contenido 1: los envases del lote son su existencia. */
const CONTENT = '1.0000';
const LINE_PACKAGES = 10;
const BATCH_STOCK = '10.0000';
/** Entrega parcial: el pedido sigue `TERMINADO` y el enlace de /pedidos sigue vivo. */
const DELIVERED_PACKAGES = '3';

/** El ano sale del reloj: el CHECK `orders_order_year_matches_created_at` lo ata a `created_at`. */
const ORDER_YEAR = new Date().getUTCFullYear();
const ORDER_SEQUENCE = 950_000 + Math.floor(Math.random() * 40_000);
const ORDER_NUMBER_TEXT = formatOrderNumber({ year: ORDER_YEAR, sequence: ORDER_SEQUENCE });
const FINISHED_AT = new Date(Date.now() - 6 * 60 * 60 * 1000);

/** Etiquetas visibles de la ficha. */
const PRODUCTION_LABEL = 'Producción';
const DELIVERY_LABEL = 'Entrega a cliente';
const FINISHED_TAB_LABEL = 'Producto terminado';

/** `data-testid` de Pedidos y del panel de entrega. */
const ORDERS_TITLE_TESTID = 'pedidos-title';
const DATA_TABLE_TESTID = 'data-table';
const TABLE_ROW_TESTID_PREFIX = 'data-table-row-';
const ORDER_ACTION_DELIVER_TESTID = 'order-action-deliver';
const DELIVERY_SHEET_TESTID = 'order-delivery-sheet';
const DELIVERY_BATCH_TESTID = 'order-delivery-batch';
const DELIVERY_BATCH_PACKAGES_TESTID = 'order-delivery-batch-packages';
const DELIVERY_SUBMIT_TESTID = 'order-delivery-submit';
const DELIVERY_ERROR_TESTID = 'order-delivery-error';
const CUSTOMER_PICKER_TESTID = 'order-customer-picker';
const ORDER_PRODUCED_PRODUCT_LINK_TESTID = 'order-produced-product-link';

/** `data-testid` de Inventario. */
const INVENTORY_TITLE_TESTID = 'inventario-title';
const FINISHED_STOCK_NAME_TESTID = 'finished-stock-name';
const FINISHED_STOCK_TOGGLE_TESTID = 'finished-stock-toggle';
const FINISHED_STOCK_LINE_LINK_TESTID = 'finished-stock-line-link';

/** `data-testid` de la ficha. */
const FINISHED_PRODUCT_NAME_TESTID = 'finished-product-name';
const BATCH_ROW_TESTID = 'finished-product-batch-row';
const BATCH_ORDER_TESTID = 'finished-product-batch-order';
const MOVEMENT_ROW_TESTID = 'finished-product-movement-row';
const MOVEMENT_ORIGIN_TESTID = 'finished-product-movement-origin';
const MOVEMENT_LOT_TESTID = 'finished-product-movement-lot';
const MOVEMENT_ORDER_TESTID = 'finished-product-movement-order';
const DELIVERY_ROW_TESTID = 'finished-product-delivery-row';
const DELIVERY_CUSTOMER_TESTID = 'finished-product-delivery-customer';
const DELIVERY_ORDER_TESTID = 'finished-product-delivery-order';
const DELIVERY_PRESENTATION_TESTID = 'finished-product-delivery-presentation';
const DELIVERY_LOT_TESTID = 'finished-product-delivery-lot';
const DELIVERY_PACKAGES_TESTID = 'finished-product-delivery-packages';
const PRIVATE_NOT_FOUND_TESTID = 'private-not-found';

type DetailListTab = 'lotes' | 'entradas' | 'salidas' | 'entregas';

let companyId: string | null = null;
let adminUserId: string | null = null;
let recipeId: string | null = null;
let orderId: string | null = null;
let productId: string | null = null;
let batchId: string | null = null;

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

function orderRow(page: Page, id: string): Locator {
  return page.locator(`[data-testid="${TABLE_ROW_TESTID_PREFIX}${id}"]`);
}

/** Las filas de la tabla de un tab de la ficha, dentro de su contenedor. */
function tabRows(page: Page, tab: DetailListTab): Locator {
  return page
    .getByTestId(`finished-product-${tab}`)
    .locator(`[data-testid^="${TABLE_ROW_TESTID_PREFIX}"]`);
}

/** En WebKit el refresco que deja una accion anterior puede interrumpir la navegacion. */
async function gotoSettled(page: Page, url: string): Promise<void> {
  await expect(async () => {
    await page.goto(url);
  }).toPass({ timeout: 60_000 });
}

async function gotoOrders(page: Page): Promise<void> {
  await gotoSettled(page, ordersUrl());
  await expect(page.getByTestId(ORDERS_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(DATA_TABLE_TESTID)).toBeVisible({ timeout: 60_000 });
}

/** Abre «Entregar» desde el menu de la fila, escribe los envases del lote y confirma. */
async function deliverPart(page: Page, id: string, batch: string, packages: string): Promise<void> {
  await expect(orderRow(page, id)).toHaveCount(1, { timeout: 60_000 });
  await (await openOrderRowMenu(page, orderMenuTrigger(page, id), ORDER_ACTION_DELIVER_TESTID)).click();
  const sheet = page.getByTestId(DELIVERY_SHEET_TESTID);
  await expect(sheet).toBeVisible({ timeout: 60_000 });
  await expect(sheet.getByTestId(DELIVERY_SUBMIT_TESTID)).toBeVisible({ timeout: 60_000 });
  // El panel parte del cliente del pedido.
  await expect(sheet.getByTestId(CUSTOMER_PICKER_TESTID).getByRole('combobox')).toHaveValue(CUSTOMER_LABEL);

  await sheet
    .locator(`[data-testid="${DELIVERY_BATCH_TESTID}"][data-batch-id="${batch}"]`)
    .getByTestId(DELIVERY_BATCH_PACKAGES_TESTID)
    .fill(packages);
  await sheet.getByTestId(DELIVERY_SUBMIT_TESTID).click();
  await expect(sheet, 'el panel deberia cerrarse al aplicar la entrega').toHaveCount(0, { timeout: 60_000 }).catch(
    async (error: unknown) => {
      const notices = await sheet.getByTestId(DELIVERY_ERROR_TESTID).allTextContents();
      throw new Error(`la entrega no se aplico; avisos: ${JSON.stringify(notices)}`, { cause: error });
    },
  );
}

/** Espera la cabecera de la ficha del producto y su direccion. */
async function expectDetailOf(page: Page, id: string): Promise<void> {
  await expect(page.getByTestId(FINISHED_PRODUCT_NAME_TESTID)).toHaveText(exactText(FINISHED_NAME), {
    timeout: 60_000,
  });
  expect(new URL(page.url()).pathname).toBe(finishedProductDetailRoute(id));
}

/** Cambia de tab por su enlace y espera a que su tabla pinte una fila. */
async function openTab(page: Page, tab: DetailListTab): Promise<Locator> {
  await page.getByTestId(`finished-product-tab-${tab}`).click();
  await page.waitForFunction(
    (expected) => new URL(window.location.href).searchParams.get('tab') === expected,
    tab,
    { timeout: 60_000 },
  );
  const rows = tabRows(page, tab);
  await expect(rows).toHaveCount(1, { timeout: 60_000 });
  return rows;
}

async function createUser(user: Credentials, roleId: string): Promise<string> {
  const created = await createFixtureUser({
    data: {
      firstNames: `Qc225${RUN_ID.slice(0, 8)}`,
      lastNames: 'Ficha',
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

/** Borra en el orden de las FK todo lo que cuelga de esas empresas. */
async function deleteCompanyRows(companyIds: readonly string[]): Promise<void> {
  const inCompanies = { companyId: { in: [...companyIds] } };
  await prisma.reservationMovement.deleteMany({ where: inCompanies });
  await prisma.inventoryMovement.deleteMany({ where: inCompanies });
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
  await prisma.role.deleteMany({
    where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
  });
  if (orphanCompanyIds.length > 0) {
    await prisma.company.deleteMany({ where: { id: { in: orphanCompanyIds } } });
  }

  companyId = (
    await prisma.company.create({
      data: { name: COMPANY_NAME, nameNormalized: normalizeCompanyName(COMPANY_NAME) },
      select: { id: true },
    })
  ).id;

  const adminRole = await prisma.role.findUnique({ where: { name: ROLE_ADMINISTRADOR }, select: { id: true } });
  if (!adminRole) {
    throw new Error(
      `falta el rol "${ROLE_ADMINISTRADOR}": sus permisos son el dato bajo prueba. Siembra la base con ` +
        '`pnpm run db:seed` antes de correr `pnpm run e2e`.',
    );
  }
  adminUserId = await createUser(adminUser, adminRole.id);

  // Rol efimero SIN ningun permiso: todos los roles sembrados salvo el Empacador, el Maestro y el
  // de acondicionamiento traen `inventario.consultar`, y este no depende de lo que traigan.
  const noPermissionsRole = await prisma.role.create({
    data: {
      name: NO_PERMISSIONS_ROLE_NAME,
      description: 'Rol efimero sin permisos del E2E de la ficha de producto terminado. Se borra en afterAll.',
    },
    select: { id: true },
  });
  await createUser(noAccessUser, noPermissionsRole.id);

  const city = 'Bogota';
  const customer = await prisma.customer.create({
    data: {
      firstNames: CUSTOMER.firstNames,
      lastNames: CUSTOMER.lastNames,
      city,
      firstNamesNormalized: normalizeCustomerText(CUSTOMER.firstNames),
      lastNamesNormalized: normalizeCustomerText(CUSTOMER.lastNames),
      cityNormalized: normalizeCustomerText(city),
      companyId,
      createdBy: adminUserId,
    },
    select: { id: true },
  });

  // Una de las unidades del catalogo arrancador, nunca creada ni borrada por este archivo.
  const unit = await prisma.unit.findFirstOrThrow({
    where: { nameNormalized: 'litro', companyId: null },
    select: { id: true },
  });

  const presentation = await prisma.presentation.create({
    data: {
      name: PRESENTATION_NAME,
      nameNormalized: normalizePresentationName(PRESENTATION_NAME),
      unitId: unit.id,
      content: CONTENT,
      companyId,
    },
    select: { id: true },
  });

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
  productId = (
    await prisma.product.create({
      data: {
        name: FINISHED_NAME,
        nameNormalized: normalizeProductName(FINISHED_NAME),
        type: 'FINISHED_PRODUCT',
        unitId: unit.id,
        stock: BATCH_STOCK,
        recipeId,
        presentationId: presentation.id,
        companyId,
      },
      select: { id: true },
    })
  ).id;

  batchId = (
    await prisma.productBatch.create({
      data: {
        productId,
        presentationId: presentation.id,
        stock: BATCH_STOCK,
        unitCost: '1.0000',
        packageContent: CONTENT,
        lot: LOT,
        purchaseDate: new Date('2026-09-01T00:00:00Z'),
        companyId,
        createdBy: adminUserId,
      },
      select: { id: true },
    })
  ).id;

  // `TERMINADO` exige fecha de terminado, quien empaco y quien acondiciono.
  const order = await prisma.order.create({
    data: {
      companyId,
      orderYear: ORDER_YEAR,
      orderSequence: ORDER_SEQUENCE,
      recipeId,
      quantity: BATCH_STOCK,
      status: 'TERMINADO',
      finishedAt: FINISHED_AT,
      packedBy: adminUserId,
      conditionedBy: adminUserId,
      unitId: unit.id,
      customerId: customer.id,
      createdBy: adminUserId,
      presentationLines: {
        create: [
          {
            companyId,
            presentationId: presentation.id,
            packages: LINE_PACKAGES,
            presentationContent: CONTENT,
          },
        ],
      },
    },
    select: { id: true, presentationLines: { select: { id: true } } },
  });
  orderId = order.id;
  const [line] = order.presentationLines;
  if (line === undefined) throw new Error('el pedido nacio sin su linea de reparto');

  // El asiento con el que Terminar ata el lote a la linea del pedido: de el salen el pedido de
  // origen del lote, la entrada de produccion y el enlace de /pedidos.
  await prisma.inventoryMovement.create({
    data: {
      batchId,
      kind: 'production',
      quantity: BATCH_STOCK,
      reason: null,
      orderId,
      orderPresentationLineId: line.id,
      companyId,
      createdBy: adminUserId,
    },
  });
});

test.afterAll(async () => {
  // Por los identificadores de ESTE worker, nunca por el prefijo a secas: el otro proyecto
  // (Chromium/WebKit) puede seguir corriendo. Cada paso corre aunque falle el anterior.
  const scopedCompanyId = companyId;
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    () => (scopedCompanyId ? deleteCompanyRows([scopedCompanyId]) : Promise.resolve()),
    () =>
      prisma.user.deleteMany({
        where: { username: { in: [adminUser.username, noAccessUser.username] } },
      }),
    () => prisma.role.deleteMany({ where: { name: NO_PERMISSIONS_ROLE_NAME } }),
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

test.describe('ficha de producto terminado', () => {
  test('R31, R27, R26: tras una entrega parcial, la ficha abierta desde /pedidos y desde /inventario muestra lote, produccion, salida y entrega', async ({
    page,
  }) => {
    const order = required(orderId, 'el pedido');
    const product = required(productId, 'el producto terminado');
    const batch = required(batchId, 'el lote');

    await loginAndLand(page, adminUser);
    await gotoOrders(page);

    // 1. Entrega parcial desde el menu de la fila.
    await deliverPart(page, order, batch, DELIVERED_PACKAGES);
    await expect
      .poll(() => prisma.orderDelivery.count({ where: { orderId: order } }), { timeout: 30_000 })
      .toBe(1);

    // 2. La presentacion del pedido enlaza a la ficha de su producto.
    await gotoOrders(page);
    const producedLink = orderRow(page, order).getByTestId(ORDER_PRODUCED_PRODUCT_LINK_TESTID);
    await expect(producedLink).toHaveCount(1, { timeout: 60_000 });
    await expect(producedLink).toHaveAttribute('href', finishedProductDetailRoute(product));
    await producedLink.click();
    await expectDetailOf(page, product);

    // 3a. Lotes: el lote con su pedido de origen.
    const batchRows = await openTab(page, 'lotes');
    await expect(batchRows.getByTestId(BATCH_ROW_TESTID)).toHaveText(exactText(LOT));
    await expect(batchRows.getByTestId(BATCH_ROW_TESTID)).toHaveAttribute('data-batch-id', batch);
    await expect(batchRows.getByTestId(BATCH_ORDER_TESTID)).toHaveText(exactText(ORDER_NUMBER_TEXT));

    // 3b. Entradas: la produccion del pedido.
    const entryRows = await openTab(page, 'entradas');
    await expect(entryRows.getByTestId(MOVEMENT_ROW_TESTID)).toHaveAttribute('data-kind', 'production');
    await expect(entryRows.getByTestId(MOVEMENT_ORIGIN_TESTID)).toHaveText(exactText(PRODUCTION_LABEL));
    await expect(entryRows.getByTestId(MOVEMENT_LOT_TESTID)).toHaveText(exactText(LOT));
    await expect(entryRows.getByTestId(MOVEMENT_ORDER_TESTID)).toHaveText(exactText(ORDER_NUMBER_TEXT));

    // 3c. Salidas: la entrega.
    const exitRows = await openTab(page, 'salidas');
    await expect(exitRows.getByTestId(MOVEMENT_ROW_TESTID)).toHaveAttribute('data-kind', 'delivery');
    await expect(exitRows.getByTestId(MOVEMENT_ORIGIN_TESTID)).toHaveText(exactText(DELIVERY_LABEL));
    await expect(exitRows.getByTestId(MOVEMENT_LOT_TESTID)).toHaveText(exactText(LOT));
    await expect(exitRows.getByTestId(MOVEMENT_ORDER_TESTID)).toHaveText(exactText(ORDER_NUMBER_TEXT));

    // 3d. Entregas: cliente, pedido, presentacion (2026-10-15, QC-282 R43), lote y envases.
    const deliveryRows = await openTab(page, 'entregas');
    await expect(deliveryRows.getByTestId(DELIVERY_ROW_TESTID)).toHaveAttribute('data-voided', 'false');
    await expect(deliveryRows.getByTestId(DELIVERY_CUSTOMER_TESTID)).toHaveText(exactText(CUSTOMER_LABEL));
    await expect(deliveryRows.getByTestId(DELIVERY_ORDER_TESTID)).toHaveText(exactText(ORDER_NUMBER_TEXT));
    await expect(deliveryRows.getByTestId(DELIVERY_PRESENTATION_TESTID)).toHaveText(exactText(PRESENTATION_NAME));
    await expect(deliveryRows.getByTestId(DELIVERY_LOT_TESTID)).toHaveText(exactText(LOT));
    await expect(deliveryRows.getByTestId(DELIVERY_PACKAGES_TESTID)).toHaveText(exactText(DELIVERED_PACKAGES));

    // 4. La misma ficha desde la pestana de producto terminado de Inventario.
    await gotoSettled(page, INVENTORY_ROUTE);
    await expect(page.getByTestId(INVENTORY_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });
    await page.getByRole('tab', { name: FINISHED_TAB_LABEL }).click();
    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get('type') === 'FINISHED_PRODUCT',
      undefined,
      { timeout: 60_000 },
    );

    // La pestana lista pedidos: el producto aparece al desplegar el de la receta.
    // Se busca en las FILAS de la tabla: la lista pinta cada fila tambien como tarjeta (oculta en
    // una pantalla ancha, QC-263) y la tarjeta repite la celda «Nombre» con los mismos testids.
    const tableRows = page.locator(`[data-testid^="${TABLE_ROW_TESTID_PREFIX}"]`);
    const groupName = page.getByTestId(FINISHED_STOCK_NAME_TESTID).filter({ hasText: exactText(RECIPE_NAME) });
    const groupRow = tableRows.filter({ has: groupName });
    await expect(groupRow).toHaveCount(1, { timeout: 60_000 });
    const toggle = groupRow.getByTestId(FINISHED_STOCK_TOGGLE_TESTID);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const lineLink = tableRows
      .getByTestId(FINISHED_STOCK_LINE_LINK_TESTID)
      .filter({ hasText: exactText(FINISHED_NAME) });
    await expect(lineLink).toHaveCount(1, { timeout: 60_000 });
    await expect(lineLink).toHaveAttribute('href', finishedProductDetailRoute(product));
    await lineLink.click();
    await expectDetailOf(page, product);
  });

  test('R31, R1: un usuario sin inventario.consultar que abre la ficha recibe el 404', async ({ page }) => {
    const product = required(productId, 'el producto terminado');

    await loginAndLand(page, noAccessUser);
    await gotoSettled(page, finishedProductDetailRoute(product));
    // El ancla positiva evita afirmar la ausencia sobre una pagina que aun no pinto.
    await expect(page.getByTestId(PRIVATE_NOT_FOUND_TESTID)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId(FINISHED_PRODUCT_NAME_TESTID)).toHaveCount(0);
    await expect(page.getByText(FINISHED_NAME)).toHaveCount(0);
  });
});
