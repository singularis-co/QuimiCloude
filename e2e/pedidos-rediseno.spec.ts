/**
 * E2E del rediseño de `/pedidos`: barra de filtros, menú de fila, tabla, tarjetas, diálogos y paneles
 * medidos en un navegador real a 1440, 820 y 390 px.
 *
 * Solo medidas y estado del DOM, sin capturas: jsdom no resuelve las consultas de contenedor que
 * pasan la lista de tabla a tarjetas a 760 px, ni compila la hoja de Tailwind, así que el ancho de
 * la barra, la columna fijada y el centrado de los diálogos solo existen aquí.
 *
 * Ningún caso confirma nada: los diálogos y paneles se abren, se miden y se cierran con su botón de
 * volver o cancelar, y «Material insuficiente» (el aviso por receta del panel, QT-314) se cierra con
 * «Revisar receta» antes de escribir el pedido.
 * Los pedidos sembrados no cambian, así que los casos corren en cualquier orden y en paralelo.
 *
 * FIXTURE (sembrado por Prisma): una empresa efímera por worker con un Administrador, un insumo con
 * un lote de 500, una receta que lo usa al 100 %, una presentación en litros, un cliente y tres
 * pedidos: PENDIENTE (con cliente: editar, cancelar, eliminar y cliente), POR_EMPACAR (reparto y
 * unidad) y TERMINADO (entregar). La lista se abre filtrada por la receta del worker. Prefijo propio
 * y `RUN_ID` por worker; limpieza de huérfanos por prefijo y edad, y la de `afterAll` por la empresa
 * de este worker.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { normalizeCustomerText } from '@/lib/modules/clientes';
import { DOCUMENT_TYPE_CC, normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizePresentationName, normalizeProductName } from '@/lib/modules/inventario';
import { formatOrderNumber } from '@/lib/modules/pedidos';
import { normalizeRecipeName } from '@/lib/modules/recetas';
import { prisma } from '@/lib/shared/db/prisma';
import { ORDERS_ROUTE } from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand, type Credentials } from './helpers/landing';
import {
  addOrderLine,
  ORDER_FORM_LINES_ERROR_TESTID,
  ORDER_FORM_REVIEW_LINE_TESTID,
  ORDER_FORM_SAVE_BLOCKED_TESTID,
  ORDER_LINE_PICKER_DIALOG_TESTID,
  pickOrderLine,
} from './helpers/order-form';
import { ensureOnlyLine, createOrderWithLine, type SingleLineOrderData } from '../tests/helpers/only-order-line';

const FIXTURE_PREFIX = 'qc262_e2e_';
const RUN_ID = randomUUID().replace(/-/g, '');
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;
const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
/**
 * Con espacios, como un nombre real: una sola palabra de 50 caracteres no cabe en la tarjeta de
 * 390 px y desborda el documento (anotado en `progress/impl_QC-262.md > Tanda 6`). El `RUN_ID`
 * basta para que el buscador solo case con los pedidos de este worker.
 */
const RECIPE_NAME = `Receta ${RUN_ID.slice(0, 12)} pedidos`;
const PRODUCT_NAME = `${SHARED_TOKEN}_insumo`;
const PRESENTATION_NAME = `${SHARED_TOKEN}_presentacion`;
const BATCH_LOT = `${SHARED_TOKEN}_lote`;

const adminUser: Credentials = {
  username: `${SHARED_TOKEN}_admin`,
  password: `Qc262-Admin-${RUN_ID.slice(0, 12)}`,
};

/** El lote no cubre el alta de 1500: es lo que abre «Material insuficiente». */
const BATCH_STOCK = '500.0000';
const BLOCKING_QUANTITY = '1500';
const ORDER_QUANTITY = '3';
const PRESENTATION_CONTENT = '1';
/** Alta y aleatoria: no choca con la serie del otro navegador en la misma base. */
const BASE_SEQUENCE = 800_000 + Math.floor(Math.random() * 90_000);

const PHONE = { width: 390, height: 844 } as const;
const TABLET = { width: 820, height: 1180 } as const;
const DESKTOP = { width: 1440, height: 900 } as const;
const MIN_TARGET_PX = 44;
const MIN_MENU_ITEM_PX = 48;
const CENTER_TOLERANCE_PX = 2;
const EDGE_TOLERANCE_PX = 1;

/** Copias locales: los módulos que los exportan son de cliente y arrastrarían React al runner. */
const TESTIDS = {
  title: 'pedidos-title',
  createOpen: 'order-create-open',
  filters: 'data-table-filters',
  search: 'data-table-search',
  customerFilter: 'order-customer-filter',
  chips: 'data-table-chips',
  cards: 'data-table-cards',
  rowActions: 'order-row-actions',
  edit: 'order-action-edit',
  cancel: 'order-action-cancel',
  delete: 'order-action-delete',
  customer: 'order-action-customer',
  distribution: 'order-action-distribution',
  deliver: 'order-action-deliver',
  deliveries: 'order-action-deliveries',
  cancelDialog: 'cancel-order-dialog',
  cancelDismiss: 'cancel-order-dismiss',
  cancelConfirm: 'cancel-order-confirm',
  deleteDialog: 'delete-order-dialog',
  deleteDismiss: 'delete-order-dismiss',
  deleteConfirm: 'delete-order-confirm',
  customerDialog: 'order-customer-dialog',
  customerDismiss: 'order-customer-dialog-dismiss',
  customerRemove: 'order-customer-dialog-remove',
  customerSubmit: 'order-customer-dialog-submit',
  distributionDialog: 'order-distribution-dialog',
  distributionDismiss: 'order-distribution-dialog-dismiss',
  distributionSubmit: 'order-distribution-dialog-submit',
  blockedDialog: 'blocked-order-dialog',
  blockedDismiss: 'blocked-order-dismiss',
  blockedConfirm: 'blocked-order-confirm',
  orderSheet: 'order-sheet',
  orderForm: 'order-form',
  orderSubmit: 'order-form-submit',
  orderCancel: 'order-form-cancel',
  deliverySheet: 'order-delivery-sheet',
  deliverySubmit: 'order-delivery-submit',
  deliveryCancel: 'order-delivery-cancel',
  recipePicker: 'recipe-picker',
  recipePickerOption: 'recipe-picker-option',
  recipePickerValue: 'recipe-picker-value',
  quantity: 'order-field-quantity',
  unitSelect: 'presentation-unit-select',
  unitOption: 'presentation-unit-option',
} as const;

/**
 * Las quince columnas de la lista, en su orden (el de `order-columns.tsx`).
 * R16 nacio con doce; despues sale «Cantidad» (2026-10-16), entra «Por entregar» delante de
 * «Presentación» y entran «Costo estimado» y «Costo real», contiguas y en ese orden (QC-305 R19).
 * QC-307 añade «Precio de venta» delante de los costes. QT-314 quita «Presentación» (el reparto es
 * de cada receta) y añade «Avance» tras «Fórmula» (R21, R24).
 */
const COLUMN_IDS = [
  'orderNumber',
  'status',
  'priority',
  'recipeName',
  'progress',
  'customer',
  'pendingDelivery',
  'createdAt',
  'cancellationReason',
  'coverage',
  'responsibles',
  'salePrice',
  'productionCost',
  'actualCost',
  'actions',
] as const;

type SeededOrder = { readonly id: string; readonly numberText: string };
type SeededOrders = {
  readonly pending: SeededOrder;
  readonly toPack: SeededOrder;
  readonly finished: SeededOrder;
};

let companyId: string | null = null;
let recipeId: string | null = null;
let unitId: string | null = null;
let orders: SeededOrders | null = null;

function seeded(): SeededOrders {
  if (orders === null) throw new Error('el fixture no existe: falló el beforeAll');
  return orders;
}

function ordersUrl(): string {
  const query = new URLSearchParams({ pageSize: '25', q: RECIPE_NAME });
  return `${ORDERS_ROUTE}?${query.toString()}`;
}

async function createUser(user: Credentials, roleId: string, company: string): Promise<string> {
  const created = await createFixtureUser({
    data: {
      firstNames: `Qc262${RUN_ID.slice(0, 8)}`,
      lastNames: 'Pedidos',
      birthDate: new Date('1990-01-01'),
      email: `${user.username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: user.username,
      username: user.username,
      passwordHash: await createPasswordHash(user.password),
      roleId,
      companyId: company,
      accountStatus: 'active',
    },
    select: { id: true },
  });
  return created.id;
}

/** En el orden que imponen las FK RESTRICT; cada paso corre aunque falle el anterior. */
async function deleteCompanyData(companyIds: readonly string[]): Promise<unknown> {
  if (companyIds.length === 0) return undefined;
  const inCompanies = { companyId: { in: [...companyIds] } };
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    () => prisma.reservationMovement.deleteMany({ where: inCompanies }),
    () => prisma.inventoryMovement.deleteMany({ where: inCompanies }),
    () => prisma.orderAssignment.deleteMany({ where: inCompanies }),
    () => prisma.orderPresentationLine.deleteMany({ where: inCompanies }),
    () => prisma.orderLine.deleteMany({ where: inCompanies }),
    () => prisma.order.deleteMany({ where: inCompanies }),
    () => prisma.recipeLine.deleteMany({ where: { recipe: inCompanies } }),
    () => prisma.recipe.deleteMany({ where: inCompanies }),
    () => prisma.productBatch.deleteMany({ where: inCompanies }),
    () => prisma.product.deleteMany({ where: inCompanies }),
    () => prisma.presentation.deleteMany({ where: inCompanies }),
    () => prisma.customer.deleteMany({ where: inCompanies }),
    () => prisma.user.deleteMany({ where: inCompanies }),
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

test.beforeAll(async () => {
  const adminRole = await prisma.role.findUnique({ where: { name: ROLE_ADMINISTRADOR }, select: { id: true } });
  if (!adminRole) {
    throw new Error(`falta el rol "${ROLE_ADMINISTRADOR}": siembra la base con \`pnpm run db:seed\`.`);
  }

  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  const orphanCompanyIds = (
    await prisma.company.findMany({
      where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
      select: { id: true },
    })
  ).map((company) => company.id);
  await deleteCompanyData(orphanCompanyIds);

  const company = (
    await prisma.company.create({
      data: { name: COMPANY_NAME, nameNormalized: normalizeCompanyName(COMPANY_NAME) },
      select: { id: true },
    })
  ).id;
  companyId = company;
  const adminId = await createUser(adminUser, adminRole.id, company);

  const unit = await prisma.unit.findFirstOrThrow({
    where: { nameNormalized: 'litro', companyId: null },
    select: { id: true },
  });
  unitId = unit.id;

  // `products.unit_id` va antes que el lote: el disparador que valida el lote lo exige.
  const productId = (
    await prisma.product.create({
      data: {
        name: PRODUCT_NAME,
        nameNormalized: normalizeProductName(PRODUCT_NAME),
        unitId: unit.id,
        stock: BATCH_STOCK,
        companyId: company,
      },
      select: { id: true },
    })
  ).id;
  const presentationId = (
    await prisma.presentation.create({
      data: {
        name: PRESENTATION_NAME,
        nameNormalized: normalizePresentationName(PRESENTATION_NAME),
        unitId: unit.id,
        content: PRESENTATION_CONTENT,
        companyId: company,
      },
      select: { id: true },
    })
  ).id;
  const purchaseDate = new Date('2026-01-01T00:00:00Z');
  const batch = await prisma.productBatch.create({
    data: {
      productId,
      presentationId,
      companyId: company,
      stock: BATCH_STOCK,
      unitCost: '10.0000',
      lot: BATCH_LOT,
      purchaseDate,
      createdBy: adminId,
    },
    select: { id: true },
  });
  await prisma.inventoryMovement.create({
    data: {
      batchId: batch.id,
      kind: 'opening',
      quantity: BATCH_STOCK,
      reason: null,
      companyId: company,
      createdBy: adminId,
      createdAt: purchaseDate,
    },
  });

  recipeId = (
    await prisma.recipe.create({
      data: {
        name: RECIPE_NAME,
        nameNormalized: normalizeRecipeName(RECIPE_NAME),
        createdBy: adminId,
        companyId: company,
        lines: { create: [{ productId, percentage: '100.00' }] },
      },
      select: { id: true },
    })
  ).id;

  const city = 'Bogota';
  const customerFirstNames = `Ana ${RUN_ID.slice(0, 10)}`;
  const customerLastNames = 'Cliente';
  const customerId = (
    await prisma.customer.create({
      data: {
        firstNames: customerFirstNames,
        lastNames: customerLastNames,
        city,
        firstNamesNormalized: normalizeCustomerText(customerFirstNames),
        lastNamesNormalized: normalizeCustomerText(customerLastNames),
        cityNormalized: normalizeCustomerText(city),
        companyId: company,
      },
      select: { id: true },
    })
  ).id;

  const year = new Date().getUTCFullYear();
  const seed = async (
    offset: number,
    data: Omit<SingleLineOrderData, 'companyId' | 'orderYear' | 'orderSequence'>,
  ): Promise<SeededOrder> => {
    const sequence = BASE_SEQUENCE + offset;
    const created = await createOrderWithLine(prisma, {
      companyId: company,
      orderYear: year,
      orderSequence: sequence,
      ...data,
    });
    return { id: created.id, numberText: formatOrderNumber({ year, sequence }) };
  };

  const recipe = recipeId;
  orders = {
    pending: await seed(1, {
      recipeId: recipe,
      quantity: ORDER_QUANTITY,
      status: 'PENDIENTE',
      unitId: unit.id,
      customerId,
      createdBy: adminId,
    }),
    toPack: await seed(2, {
      recipeId: recipe,
      quantity: ORDER_QUANTITY,
      status: 'POR_EMPACAR',
      unitId: unit.id,
      createdBy: adminId,
    }),
    // `TERMINADO` exige fecha de terminado, quien empacó y quien acondicionó.
    finished: await seed(3, {
      recipeId: recipe,
      quantity: ORDER_QUANTITY,
      status: 'TERMINADO',
      finishedAt: new Date(),
      packedBy: adminId,
      conditionedBy: adminId,
      unitId: unit.id,
      customerId,
      createdBy: adminId,
    }),
  };
  await prisma.orderPresentationLine.create({
    data: {
      orderId: orders.finished.id,
      orderLineId: await ensureOnlyLine(prisma, orders.finished.id),
      companyId: company,
      presentationId,
      packages: Number(ORDER_QUANTITY),
      presentationContent: PRESENTATION_CONTENT,
    },
  });
});

test.afterAll(async () => {
  const primerFallo = await deleteCompanyData(companyId === null ? [] : [companyId]);
  await prisma.$disconnect();
  if (primerFallo !== undefined) throw primerFallo;
});

// El primer `goto` compila la ruta en `next dev`, y bcrypt tarda a propósito.
test.setTimeout(240_000);

type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  expect(found, 'el elemento no tiene caja').not.toBeNull();
  return found as Box;
}

function toHundredthPx(value: number): number {
  return Math.round(value * 100) / 100;
}

async function expectTarget(locator: Locator, label: string, minHeight = MIN_TARGET_PX): Promise<Box> {
  await expect(locator, label).toBeVisible();
  const found = await box(locator);
  // El motor devuelve la caja con error de coma flotante (43.99996... para un alto de 44 px): se
  // redondea a la centesima de pixel antes de comparar, sin tocar el umbral.
  expect(toHundredthPx(found.width), `${label}: ancho`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  expect(toHundredthPx(found.height), `${label}: alto`).toBeGreaterThanOrEqual(minHeight);
  return found;
}

/** Medido a media animación, el diálogo aún escala y el panel aún se desliza. */
async function waitForAnimationsToSettle(locator: Locator): Promise<void> {
  await expect
    .poll(() =>
      locator.evaluate(
        (el) => el.getAnimations({ subtree: true }).filter((anim) => anim.playState === 'running').length,
      ),
    )
    .toBe(0);
}

/** En WebKit un clic antes de hidratar se pierde sin error: se repite hasta que aparece lo esperado. */
async function clickUntilVisible(trigger: Locator, target: Locator): Promise<void> {
  await expect(async () => {
    if (!(await target.isVisible())) await trigger.click();
    await expect(target).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
}

async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${label}: el documento no desborda en horizontal`).toBeLessThanOrEqual(clientWidth);
}

async function expectCenteredAndWhole(page: Page, dialog: Locator, label: string): Promise<Box> {
  await expect(dialog, label).toBeVisible({ timeout: 60_000 });
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
  return found;
}

/** El panel ocupa la pantalla visible entera y su pie queda por encima del borde inferior. */
async function expectFullScreenPanel(
  page: Page,
  panel: Locator,
  footerButtons: readonly Locator[],
  label: string,
): Promise<void> {
  await expect(panel, label).toBeVisible({ timeout: 60_000 });
  await waitForAnimationsToSettle(panel);
  const viewport = page.viewportSize() as NonNullable<ReturnType<Page['viewportSize']>>;
  const found = await box(panel);
  expect(Math.abs(found.x), `${label}: pegado a la izquierda`).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
  expect(Math.abs(found.y), `${label}: pegado arriba`).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
  expect(Math.abs(found.width - viewport.width), `${label}: todo el ancho`).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
  expect(Math.abs(found.height - viewport.height), `${label}: todo el alto`).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
  for (const [index, button] of footerButtons.entries()) {
    const target = await expectTarget(button, `${label}: botón ${index + 1} del pie`);
    expect(target.y, `${label}: botón ${index + 1} del pie dentro`).toBeGreaterThanOrEqual(0);
    expect(target.y + target.height, `${label}: botón ${index + 1} del pie visible`).toBeLessThanOrEqual(
      viewport.height,
    );
  }
}

async function openOrders(page: Page, viewport: { readonly width: number; readonly height: number }) {
  await page.setViewportSize(viewport);
  await loginAndLand(page, adminUser);
  const response = await page.goto(ordersUrl());
  expect(response?.status(), '/pedidos debe responder 200').toBe(200);
  await expect(page.getByTestId(TESTIDS.title)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(`data-table-row-${seeded().pending.id}`)).toHaveCount(1, { timeout: 60_000 });
}

function card(page: Page, order: SeededOrder): Locator {
  return page.getByTestId(`data-table-card-${order.id}`);
}

function row(page: Page, order: SeededOrder): Locator {
  return page.getByTestId(`data-table-row-${order.id}`);
}

/** Abre «Acciones» de la tarjeta: el diálogo centrado titulado «Pedido <n>». */
async function openCardMenu(page: Page, order: SeededOrder): Promise<Locator> {
  const menu = page.getByRole('dialog', { name: `Pedido ${order.numberText}`, exact: true });
  await clickUntilVisible(card(page, order).getByTestId(TESTIDS.rowActions), menu);
  return menu;
}

/** Elige un ítem del menú de la tarjeta y espera a que aparezca lo que abre. */
async function openFromCard(page: Page, order: SeededOrder, itemTestId: string, target: Locator): Promise<void> {
  await expect(async () => {
    if (await target.isVisible()) return;
    const menu = await openCardMenu(page, order);
    await menu.getByTestId(itemTestId).click();
    await expect(target).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
}

/** Lo que pinta el menú abierto, en orden: el nombre de cada ítem o `---` por separador. */
async function menuSequence(menu: Locator): Promise<string[]> {
  return menu.evaluate((root) =>
    Array.from(root.querySelectorAll('[role="menuitem"], [role="separator"]'), (node) =>
      node.getAttribute('role') === 'separator' ? '---' : (node.textContent ?? '').trim(),
    ),
  );
}

/** QT-314 R25: los ítems de cada bloque con rótulo van dentro de su grupo, nombrado por el rótulo. */
async function expectMenuGroups(
  menu: Locator,
  lineItems: readonly string[],
  wholeOrderItems: readonly string[],
): Promise<void> {
  for (const [name, items] of [
    ['Por receta', lineItems],
    ['Pedido entero', wholeOrderItems],
  ] as const) {
    const group = menu.getByRole('group', { name, exact: true });
    await expect(group, `grupo «${name}»`).toHaveCount(1);
    for (const testId of items) await expect(group.getByTestId(testId), `${testId} en «${name}»`).toHaveCount(1);
  }
}

/** El id de la única receta de un pedido sembrado. */
async function onlyLineId(order: SeededOrder): Promise<string> {
  return (await prisma.orderLine.findFirstOrThrow({ where: { orderId: order.id }, select: { id: true } })).id;
}

/**
 * QT-314: una acción «Por receta» desde «Acciones» de la tarjeta abre antes el selector de receta,
 * centrado y entero; se elige la receta y se espera a lo que abre.
 */
async function openLineActionFromCard(
  page: Page,
  order: SeededOrder,
  itemTestId: string,
  target: Locator,
): Promise<void> {
  const picker = page.getByTestId(ORDER_LINE_PICKER_DIALOG_TESTID);
  await openFromCard(page, order, itemTestId, picker);
  await expectCenteredAndWhole(page, picker, `Selector de receta de ${itemTestId}`);
  await pickOrderLine(page, await onlyLineId(order));
  await expect(target).toBeVisible({ timeout: 60_000 });
}

test.describe('Pedidos rediseñado', () => {
  test('a 1440 px: una sola barra en orden, menú por grupos con separador y destructivos, y quince columnas con el número fijado (R2, R11, R14, R16, QC-305 R19)', async ({
    page,
  }) => {
    await openOrders(page, DESKTOP);
    const { toPack, finished } = seeded();

    // R2: una sola barra, con buscador, cliente y chips en ese orden de izquierda a derecha.
    const bars = page.getByTestId(TESTIDS.filters);
    await expect(bars).toHaveCount(1);
    const bar = bars.first();
    for (const testId of [TESTIDS.search, TESTIDS.customerFilter, TESTIDS.chips]) {
      await expect(page.getByTestId(testId), `${testId}: uno solo en la página`).toHaveCount(1);
      await expect(bar.getByTestId(testId), `${testId}: dentro de la barra`).toBeVisible();
    }
    const search = await box(bar.getByTestId(TESTIDS.search));
    const customer = await box(bar.getByTestId(TESTIDS.customerFilter));
    const chips = bar.getByTestId(TESTIDS.chips);
    expect(customer.x, 'el cliente va tras el buscador').toBeGreaterThanOrEqual(search.x + search.width);
    expect((await box(chips)).x, 'los chips van tras el cliente').toBeGreaterThanOrEqual(customer.x + customer.width);
    const chipLabels = await chips.evaluate((el) => Array.from(el.children, (chip) => (chip.textContent ?? '').trim()));
    expect(chipLabels).toHaveLength(3);
    expect(chipLabels[0]).toContain('Estado');
    expect(chipLabels[1]).toContain('Prioridad');
    expect(chipLabels[2]).toContain('Fecha de solicitud');

    // R16: tabla visible, tarjetas ocultas, las columnas de hoy (quince) en su orden y el número fijado a la izquierda.
    await expect(row(page, toPack)).toBeVisible();
    await expect(card(page, toPack)).toBeHidden();
    const headIds = await page
      .locator('thead th[data-testid^="data-table-head-"]')
      .evaluateAll((cells) => cells.map((cell) => (cell.getAttribute('data-testid') ?? '').replace('data-table-head-', '')));
    expect(headIds).toEqual([...COLUMN_IDS]);
    const numberHead = page.getByTestId('data-table-head-orderNumber');
    await expect(numberHead).toHaveAttribute('data-pinned', 'left');
    expect(await numberHead.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
    const numberCell = row(page, toPack).getByTestId('data-table-cell-orderNumber');
    await expect(numberCell).toHaveAttribute('data-pinned', 'left');
    await expectNoHorizontalScroll(page, '1440');

    // Si la tabla desborda, desborda dentro de su caja y el número no se mueve al desplazarla.
    const container = page.locator('[data-slot="table-container"]').filter({ visible: true });
    await expect(container).toHaveCount(1);
    const overflow = await container.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowX: getComputedStyle(el).overflowX,
    }));
    expect(overflow.overflowX).toBe('auto');
    if (overflow.scrollWidth > overflow.clientWidth) {
      const before = await box(numberCell);
      await container.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      await expect.poll(async () => (await box(numberCell)).x).toBeCloseTo(before.x, 0);
      await expectNoHorizontalScroll(page, '1440 con la tabla desplazada');
    }

    // R11, R14: el menú del pedido por empacar y el del terminado, con su orden, separador y destructivos.
    // QT-314 R25: tres bloques; los de una receta bajo «Por receta» y los del pedido entero bajo
    // «Pedido entero», cada uno tras su separador.
    const dropdown = page.getByRole('menu');
    await clickUntilVisible(row(page, toPack).getByTestId(TESTIDS.rowActions), dropdown);
    expect(await menuSequence(dropdown)).toEqual([
      'Ver detalle',
      'Editar',
      'Responsables',
      'Cliente',
      '---',
      'Reparto y unidad…',
      '---',
      'Cancelar pedido',
      'Eliminar',
    ]);
    await expectMenuGroups(dropdown, [TESTIDS.distribution], [TESTIDS.cancel, TESTIDS.delete]);
    for (const testId of [TESTIDS.cancel, TESTIDS.delete]) {
      await expect(dropdown.getByTestId(testId)).toHaveAttribute('data-variant', 'destructive');
    }
    for (const testId of [TESTIDS.edit, TESTIDS.customer, TESTIDS.distribution]) {
      await expect(dropdown.getByTestId(testId)).not.toHaveAttribute('data-variant', 'destructive');
    }
    await page.keyboard.press('Escape');
    await expect(dropdown).toHaveCount(0);

    await clickUntilVisible(row(page, finished).getByTestId(TESTIDS.rowActions), dropdown);
    expect(await menuSequence(dropdown)).toEqual([
      'Ver detalle',
      'Editar',
      'Responsables',
      'Cliente',
      '---',
      'Entregar…',
      'Entregas…',
      '---',
      'Cancelar pedido',
      'Eliminar',
    ]);
    await expectMenuGroups(dropdown, [TESTIDS.deliver, TESTIDS.deliveries], [TESTIDS.cancel, TESTIDS.delete]);
    await expect(dropdown.getByTestId(TESTIDS.deliver)).not.toHaveAttribute('data-variant', 'destructive');
    await page.keyboard.press('Escape');
    await expect(dropdown).toHaveCount(0);
  });

  test('a 820 px: la lista se pinta en tarjetas (R15)', async ({ page }) => {
    await openOrders(page, TABLET);
    const { pending, toPack, finished } = seeded();

    await expect(page.getByTestId(TESTIDS.cards)).toBeVisible();
    for (const order of [pending, toPack, finished]) {
      await expect(card(page, order)).toBeVisible();
      await expect(row(page, order)).toBeHidden();
      await expectTarget(card(page, order).getByTestId(TESTIDS.rowActions), `tarjeta ${order.numberText}: Acciones`);
    }
    await expectNoHorizontalScroll(page, '820');
  });

  test('a 390 px: la barra no desborda y «Acciones» abre el menú centrado con ítems de 48 px (R3, R15)', async ({
    page,
  }) => {
    await openOrders(page, PHONE);
    const { pending, toPack } = seeded();

    // R3: buscador a todo el ancho de la barra; cliente y chips debajo; nada se sale.
    const bar = page.getByTestId(TESTIDS.filters);
    const barBox = await box(bar);
    expect(barBox.x).toBeGreaterThanOrEqual(0);
    expect(barBox.x + barBox.width).toBeLessThanOrEqual(PHONE.width);
    const search = await box(bar.getByTestId(TESTIDS.search));
    expect(Math.abs(search.width - barBox.width), 'el buscador ocupa todo el ancho de la barra').toBeLessThanOrEqual(
      EDGE_TOLERANCE_PX,
    );
    for (const testId of [TESTIDS.customerFilter, TESTIDS.chips]) {
      const found = await box(bar.getByTestId(testId));
      expect(found.y, `${testId}: debajo del buscador`).toBeGreaterThanOrEqual(search.y + search.height);
      expect(found.x, `${testId}: dentro por la izquierda`).toBeGreaterThanOrEqual(barBox.x - EDGE_TOLERANCE_PX);
      expect(found.x + found.width, `${testId}: dentro por la derecha`).toBeLessThanOrEqual(
        barBox.x + barBox.width + EDGE_TOLERANCE_PX,
      );
    }
    await expectNoHorizontalScroll(page, '390');

    // R15: tarjetas, sin filas a la vista.
    await expect(page.getByTestId(TESTIDS.cards)).toBeVisible();
    await expect(card(page, pending)).toBeVisible();
    await expect(row(page, pending)).toBeHidden();

    const trigger = card(page, toPack).getByTestId(TESTIDS.rowActions);
    await expectTarget(trigger, '«Acciones» de la tarjeta');
    await expect(trigger).toHaveAttribute('data-order-id', toPack.id);
    const menu = await openCardMenu(page, toPack);
    await expectCenteredAndWhole(page, menu, `Pedido ${toPack.numberText}`);
    for (const testId of [TESTIDS.edit, TESTIDS.customer, TESTIDS.distribution, TESTIDS.cancel, TESTIDS.delete]) {
      await expectTarget(menu.getByTestId(testId), `ítem ${testId}`, MIN_MENU_ITEM_PX);
    }
    // QT-314 R25: un separador delante de «Por receta» y otro delante de «Pedido entero».
    await expect(menu.getByRole('separator')).toHaveCount(2);
    await expectMenuGroups(menu, [TESTIDS.distribution], [TESTIDS.cancel, TESTIDS.delete]);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
  });

  test('a 390 px: «Cancelar el pedido», «Eliminar el pedido», «Cliente» y «Reparto y unidad» quedan enteros y centrados con botones de 44 px (R18)', async ({
    page,
  }) => {
    await openOrders(page, PHONE);
    const { pending, toPack } = seeded();

    const checks = [
      {
        label: 'Cancelar el pedido',
        order: pending,
        item: TESTIDS.cancel,
        dialog: TESTIDS.cancelDialog,
        buttons: [TESTIDS.cancelDismiss, TESTIDS.cancelConfirm],
        dismiss: TESTIDS.cancelDismiss,
      },
      {
        label: 'Eliminar el pedido',
        order: pending,
        item: TESTIDS.delete,
        dialog: TESTIDS.deleteDialog,
        buttons: [TESTIDS.deleteDismiss, TESTIDS.deleteConfirm],
        dismiss: TESTIDS.deleteDismiss,
      },
      {
        label: 'Cliente',
        order: pending,
        item: TESTIDS.customer,
        dialog: TESTIDS.customerDialog,
        buttons: [TESTIDS.customerRemove, TESTIDS.customerDismiss, TESTIDS.customerSubmit],
        dismiss: TESTIDS.customerDismiss,
      },
      {
        label: 'Reparto y unidad',
        order: toPack,
        item: TESTIDS.distribution,
        dialog: TESTIDS.distributionDialog,
        buttons: [TESTIDS.distributionDismiss, TESTIDS.distributionSubmit],
        dismiss: TESTIDS.distributionDismiss,
      },
    ] as const;

    for (const check of checks) {
      const dialog = page.getByTestId(check.dialog);
      if (check.item === TESTIDS.distribution) await openLineActionFromCard(page, check.order, check.item, dialog);
      else await openFromCard(page, check.order, check.item, dialog);
      await expectCenteredAndWhole(page, dialog, check.label);
      for (const button of check.buttons) {
        await expectTarget(dialog.getByTestId(button), `${check.label}: ${button}`);
      }
      await dialog.getByTestId(check.dismiss).click();
      await expect(dialog).toBeHidden({ timeout: 60_000 });
    }
  });

  test('a 390 px: «Material insuficiente» queda entero con botones de 44 px y «Revisar receta» no escribe nada (R18, QT-314 R17)', async ({
    page,
  }) => {
    await openOrders(page, PHONE);
    const recipe = recipeId;
    const unit = unitId;
    if (recipe === null || unit === null) throw new Error('el fixture no existe: falló el beforeAll');
    const before = await prisma.order.count({ where: { lines: { some: { recipeId: recipe } }}});

    const form = page.getByTestId(TESTIDS.orderForm);
    await clickUntilVisible(page.getByTestId(TESTIDS.createOpen).filter({ visible: true }), form);
    // QT-314: la receta se escribe en su sub-panel (selector con búsqueda, cantidad y unidad). Sin
    // reparto toda la cantidad queda sin envasar: «Aplicar» pregunta antes de volver al panel.
    await addOrderLine(
      page,
      form,
      { recipe: { id: recipe, name: RECIPE_NAME }, quantity: BLOCKING_QUANTITY, unitId: unit },
      { leftover: true },
    );
    await form.getByTestId(TESTIDS.orderSubmit).click();

    // QT-314 R17: «Material insuficiente» ya no es un diálogo aparte sino el aviso por receta del
    // panel, con «Revisar receta» (antes «Volver») y «Guardar bloqueada». Se mide que queda entero
    // dentro de la pantalla de 390 px y que sus dos botones miden 44 px.
    const notice = form.getByTestId(ORDER_FORM_LINES_ERROR_TESTID);
    await expect(notice, 'Material insuficiente').toBeVisible({ timeout: 60_000 });
    await notice.scrollIntoViewIfNeeded();
    await waitForAnimationsToSettle(notice);
    const noticeBox = await box(notice);
    expect(noticeBox.x, 'Material insuficiente: borde izquierdo').toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
    expect(noticeBox.x + noticeBox.width, 'Material insuficiente: borde derecho').toBeLessThanOrEqual(
      PHONE.width + EDGE_TOLERANCE_PX,
    );
    const review = notice.getByTestId(ORDER_FORM_REVIEW_LINE_TESTID);
    await expectTarget(review, 'Material insuficiente: Revisar receta');
    await expectTarget(notice.getByTestId(ORDER_FORM_SAVE_BLOCKED_TESTID), 'Material insuficiente: Guardar bloqueada');
    await review.click();
    await expect(notice).toBeHidden({ timeout: 60_000 });
    expect(await prisma.order.count({ where: { lines: { some: { recipeId: recipe } }}}), 'sin confirmar no se escribe el pedido').toBe(
      before,
    );
  });

  test('a 390 px: los paneles de alta, edición y entrega ocupan toda la pantalla con el pie visible (R19)', async ({
    page,
  }) => {
    await openOrders(page, PHONE);
    const { pending, finished } = seeded();
    const sheet = page.getByTestId(TESTIDS.orderSheet);
    const footer = [page.getByTestId(TESTIDS.orderCancel), page.getByTestId(TESTIDS.orderSubmit)];

    await clickUntilVisible(page.getByTestId(TESTIDS.createOpen).filter({ visible: true }), sheet);
    await expectFullScreenPanel(page, sheet, footer, 'Nuevo pedido');
    await page.getByTestId(TESTIDS.orderCancel).click();
    await expect(sheet).toBeHidden({ timeout: 60_000 });

    await openFromCard(page, pending, TESTIDS.edit, sheet);
    await expectFullScreenPanel(page, sheet, footer, 'Editar pedido');
    await page.getByTestId(TESTIDS.orderCancel).click();
    await expect(sheet).toBeHidden({ timeout: 60_000 });

    const delivery = page.getByTestId(TESTIDS.deliverySheet);
    await openLineActionFromCard(page, finished, TESTIDS.deliver, delivery);
    await expect(delivery.getByTestId(TESTIDS.deliverySubmit)).toBeVisible({ timeout: 60_000 });
    await expectFullScreenPanel(
      page,
      delivery,
      [delivery.getByTestId(TESTIDS.deliveryCancel), delivery.getByTestId(TESTIDS.deliverySubmit)],
      `Entregar pedido ${finished.numberText}`,
    );
    await delivery.getByTestId(TESTIDS.deliveryCancel).click();
    await expect(delivery).toBeHidden({ timeout: 60_000 });
  });
});
