/**
 * E2E del rediseño de `/inventario` y `/inventario/importar`: cajas, estilos calculados y estado
 * del DOM en un navegador real, sin capturas. jsdom no compila la hoja de Tailwind ni resuelve
 * las consultas de contenedor, así que las tarjetas, la alineación de las cifras, el tono de
 * advertencia y el centrado de los diálogos solo existen aquí. Corre en chromium y en webkit
 * (`playwright.config.ts`), a 1440 × 900, 820 × 1180 y 390 × 844.
 *
 * Las celdas de la lista, del panel «Lotes» y del historial salen dos veces (fila y tarjeta, una
 * de las dos oculta según el ancho): todo se acota a `data-table-row-<id>` o a
 * `data-table-card-<id>`.
 *
 * FIXTURE (Prisma, como `e2e/ajuste-de-inventario.spec.ts`): una empresa efímera por worker con
 * sus añadidos prendidos, un Administrador y dos productos en kilogramo. «alerta» tiene un lote
 * y la alerta por encima de la existencia; «varios» tiene dos lotes, uno que vence en diez días.
 * Ningún caso de la lista escribe en la base: solo el de la importación, que crea en la misma
 * empresa productos con otro prefijo. Limpieza de huérfanos por prefijo y edad; la de `afterAll`,
 * solo por la empresa de este worker.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  CONFIRM_BUTTON_TESTID,
  DIALOG_CANCEL_TESTID,
  DIALOG_SUBMIT_TESTID,
  GUIDE_TESTID,
  IMPORT_SCREEN_TESTID,
  IMPORT_STEPS_TESTID,
  MISSING_CREATE_TESTID,
  MISSING_PRESENTATION_TESTID,
  MISSING_UNIT_TESTID,
  PREVIEW_SUMMARY_TESTID,
  PREVIEW_TABLE_TESTID,
  PRESENTATION_DIALOG_TESTID,
  RESTART_TESTID,
  RESULT_TABLE_TESTID,
  RESULT_TESTID,
  REVIEW_BUTTON_TESTID,
  ROW_STATUS_TESTID,
  UNIT_DIALOG_TESTID,
  UPLOAD_INPUT_TESTID,
  importStepTestId,
} from '@/app/(private)/inventario/importar/components/import-texts';
import { normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizeProductName } from '@/lib/modules/inventario';
import { normalizeUnitName } from '@/lib/modules/unidades';
import { prisma } from '@/lib/shared/db/prisma';
import { INVENTORY_IMPORT_ROUTE, INVENTORY_ROUTE } from '@/lib/shared/routes';

import { enableAllAddons } from './helpers/addons';
import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { batchActionsTrigger, openRowActionsMenuItem } from './helpers/row-actions-menu';

const FIXTURE_PREFIX = 'qc263_e2e_';
// Corto: los nombres salen en tarjetas de 390 px y un nombre sin espacios no se parte.
const RUN_ID = randomUUID().replace(/-/g, '').slice(0, 10);
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;
const TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;
const COMPANY_NAME = `${TOKEN}_empresa`;
const LIST_PREFIX = `${TOKEN}_pd`;
const IMPORT_PREFIX = `${TOKEN}_im`;

const adminUser = {
  username: `${TOKEN}_admin`,
  password: `Qc263-Admin-${RUN_ID}`,
} as const;

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180 },
  phone: { width: 390, height: 844 },
} as const;
const WIDTHS = [VIEWPORTS.desktop, VIEWPORTS.tablet, VIEWPORTS.phone] as const;

const MIN_TARGET_PX = 44;
const MIN_MENU_ITEM_PX = 48;
const CENTER_TOLERANCE_PX = 2;
const EDGE_TOLERANCE_PX = 1.5;
const SHEET_MAX_PX = 900;
const HISTORY_MAX_PX = 1000;
const HISTORY_MIN_GUTTER_PX = 16;
const EXPIRING_IN_DAYS = 10;

// Textos de la pantalla escritos a mano: si cambian, este recorrido tiene que enterarse.
const TAB_NAMES = ['Todos', 'Producto', 'Máquina', 'Envase', 'Producto terminado'] as const;
const MENU_ITEMS = ['Lotes', 'Historial', 'Ajustar existencia', 'Editar', 'Borrar'] as const;
const BATCH_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['lot', 'Lote'],
  ['quantity', 'Cantidad'],
  ['purchaseDate', 'Fecha de compra'],
  ['expiryDate', 'Vencimiento'],
  ['reserved', 'Apartado'],
  ['available', 'Disponible'],
];
const HISTORY_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['kind', 'Tipo'],
  ['quantity', 'Cantidad'],
  ['previousStock', 'Existencia anterior'],
  ['countedStock', 'Total contado'],
  ['reason', 'Motivo'],
  ['order', 'Pedido'],
  ['author', 'Autor'],
  ['date', 'Fecha'],
];
const BELOW_ALERT_LABEL = 'Por debajo de la alerta de cantidad';
const MISSING_REASON = 'Elige un motivo.';
const UNIT_CREATED = 'Unidad creada.';
const EMPTY = '—';

type SeededBatch = { readonly id: string; readonly lot: string; readonly openingId: string };
type SeededProduct = {
  readonly id: string;
  readonly name: string;
  readonly batches: readonly SeededBatch[];
};

let companyId: string | null = null;
let alertProduct: SeededProduct | null = null;
let multiProduct: SeededProduct | null = null;

function seeded(): { readonly alert: SeededProduct; readonly multi: SeededProduct } {
  if (alertProduct === null || multiProduct === null) {
    throw new Error('el fixture no existe: falló el beforeAll');
  }
  return { alert: alertProduct, multi: multiProduct };
}

function firstBatch(product: SeededProduct): SeededBatch {
  const [batch] = product.batches;
  if (batch === undefined) throw new Error(`${product.name} no tiene lotes`);
  return batch;
}

function isoDay(offsetDays: number): Date {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() + offsetDays);
  return day;
}

async function seedProduct(params: {
  readonly ownerCompanyId: string;
  readonly adminId: string;
  readonly unitId: string;
  readonly tag: string;
  readonly qtyAlert: string;
  readonly batches: ReadonlyArray<{ readonly stock: string; readonly cost: string; readonly expiry: Date | null }>;
}): Promise<SeededProduct> {
  const name = `${LIST_PREFIX}_${params.tag}`;
  const total = params.batches.reduce((sum, batch) => sum + Number(batch.stock), 0);
  const product = await prisma.product.create({
    data: {
      name,
      nameNormalized: normalizeProductName(name),
      qtyAlert: params.qtyAlert,
      unitId: params.unitId,
      stock: String(total),
      companyId: params.ownerCompanyId,
    },
    select: { id: true },
  });

  const purchaseDate = new Date('2026-09-01T00:00:00Z');
  const batches: SeededBatch[] = [];
  for (const [index, spec] of params.batches.entries()) {
    const lot = `L-${params.tag}-${index + 1}`;
    const batch = await prisma.productBatch.create({
      data: {
        productId: product.id,
        presentationId: null,
        companyId: params.ownerCompanyId,
        stock: spec.stock,
        unitCost: spec.cost,
        lot,
        purchaseDate,
        expiryDate: spec.expiry,
        createdBy: params.adminId,
      },
      select: { id: true },
    });
    const opening = await prisma.inventoryMovement.create({
      data: {
        batchId: batch.id,
        kind: 'opening',
        quantity: spec.stock,
        reason: null,
        companyId: params.ownerCompanyId,
        createdBy: params.adminId,
        createdAt: purchaseDate,
      },
      select: { id: true },
    });
    batches.push({ id: batch.id, lot, openingId: opening.id });
  }
  return { id: product.id, name, batches };
}

/** En el orden de las FK `Restrict`. */
async function deleteCompanyData(companyIds: readonly string[]): Promise<void> {
  if (companyIds.length === 0) return;
  const where = { companyId: { in: [...companyIds] } };
  await prisma.inventoryMovement.deleteMany({ where });
  await prisma.productBatch.deleteMany({ where });
  await prisma.product.deleteMany({ where });
  await prisma.presentation.deleteMany({ where });
  await prisma.unit.deleteMany({ where });
  await prisma.inventoryImport.deleteMany({ where });
  await prisma.user.deleteMany({ where });
  await prisma.company.deleteMany({ where: { id: { in: [...companyIds] } } });
}

test.beforeAll(async () => {
  const role = await prisma.role.findUnique({ where: { name: ROLE_ADMINISTRADOR }, select: { id: true } });
  if (role === null) {
    throw new Error(
      `falta el rol "${ROLE_ADMINISTRADOR}": siembra la base con \`pnpm run db:seed\` antes.`,
    );
  }

  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  const orphans = await prisma.company.findMany({
    where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
    select: { id: true },
  });
  await deleteCompanyData(orphans.map((company) => company.id));

  const ownCompanyId = (
    await prisma.company.create({
      data: { name: COMPANY_NAME, nameNormalized: normalizeCompanyName(COMPANY_NAME) },
      select: { id: true },
    })
  ).id;
  companyId = ownCompanyId;
  await enableAllAddons(ownCompanyId);

  const adminId = (
    await createFixtureUser({
      data: {
        firstNames: `Qc263${RUN_ID.slice(0, 6)}`,
        lastNames: 'Inventario',
        birthDate: new Date('1990-01-01'),
        email: `${adminUser.username}@example.test`,
        phone: '+573000000000',
        documentTypeCode: 'CC',
        documentNumber: adminUser.username,
        username: adminUser.username,
        passwordHash: await createPasswordHash(adminUser.password),
        roleId: role.id,
        companyId: ownCompanyId,
        accountStatus: 'active',
      },
      select: { id: true },
    })
  ).id;

  const kilogram = await prisma.unit.findFirst({
    where: { companyId: null, nameNormalized: normalizeUnitName('kilogramo') },
    select: { id: true },
  });
  if (kilogram === null) {
    throw new Error('falta la unidad de sistema "kilogramo": aplica las migraciones antes.');
  }

  const base = { ownerCompanyId: ownCompanyId, adminId, unitId: kilogram.id };
  alertProduct = await seedProduct({
    ...base,
    tag: 'alerta',
    qtyAlert: '5',
    batches: [{ stock: '1', cost: '2.5000', expiry: null }],
  });
  multiProduct = await seedProduct({
    ...base,
    tag: 'varios',
    qtyAlert: '2',
    batches: [
      { stock: '12', cost: '3.5000', expiry: isoDay(EXPIRING_IN_DAYS) },
      { stock: '8', cost: '4.0000', expiry: null },
    ],
  });
});

test.afterAll(async () => {
  let failure: unknown;
  try {
    await deleteCompanyData(companyId === null ? [] : [companyId]);
  } catch (error) {
    failure = error;
  }
  await prisma.$disconnect();
  if (failure !== undefined) throw failure;
});

// El primer `goto` compila la ruta en `next dev`, y bcrypt tarda a propósito.
test.setTimeout(240_000);

// --- Localizadores y medidas ---

function listUrl(type?: string): string {
  const query = new URLSearchParams({ pageSize: '25', q: LIST_PREFIX });
  if (type !== undefined) query.set('type', type);
  return `${INVENTORY_ROUTE}?${query.toString()}`;
}

async function openInventory(
  page: Page,
  viewport: { readonly width: number; readonly height: number },
  type?: string,
): Promise<void> {
  await page.setViewportSize(viewport);
  await loginAndLand(page, adminUser);
  await page.goto(listUrl(type));
  await expect(page.getByTestId('inventario-title')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('data-table').first()).toBeVisible({ timeout: 60_000 });
}

function productRow(page: Page, product: SeededProduct): Locator {
  return page.getByTestId(`data-table-row-${product.id}`);
}

function productCard(page: Page, product: SeededProduct): Locator {
  return page.getByTestId(`data-table-card-${product.id}`);
}

function subRowId(product: SeededProduct, batch: SeededBatch): string {
  return `${product.id}--batch-${batch.id}`;
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found, 'el elemento no tiene caja').not.toBeNull();
  return found as NonNullable<typeof found>;
}

async function waitForAnimationsToSettle(locator: Locator): Promise<void> {
  await expect
    .poll(() =>
      locator.evaluate(
        (el) => el.getAnimations({ subtree: true }).filter((anim) => anim.playState === 'running').length,
      ),
    )
    .toBe(0);
}

async function expectMinHeight(locator: Locator, min: number, label: string): Promise<void> {
  await expect(locator, label).toBeVisible();
  expect((await box(locator)).height, label).toBeGreaterThanOrEqual(min);
}

async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      { message: label },
    )
    .toBeLessThanOrEqual(0);
}

/** El diálogo entero dentro de la ventana y centrado en ella, ya sin la animación de entrada. */
async function expectCenteredAndWhole(page: Page, dialog: Locator, label: string): Promise<void> {
  await expect(dialog, label).toBeVisible({ timeout: 60_000 });
  await waitForAnimationsToSettle(dialog);
  const viewport = page.viewportSize() as NonNullable<ReturnType<Page['viewportSize']>>;
  const found = await box(dialog);
  expect(found.x, `${label}: borde izquierdo`).toBeGreaterThanOrEqual(0);
  expect(found.y, `${label}: borde superior`).toBeGreaterThanOrEqual(0);
  expect(found.x + found.width, `${label}: borde derecho`).toBeLessThanOrEqual(viewport.width);
  expect(found.y + found.height, `${label}: borde inferior`).toBeLessThanOrEqual(viewport.height);
  const horizontal = Math.abs(found.x - (viewport.width - (found.x + found.width)));
  const vertical = Math.abs(found.y - (viewport.height - (found.y + found.height)));
  expect(horizontal, `${label}: centrado en horizontal`).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
  expect(vertical, `${label}: centrado en vertical`).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
}

/** Cada botón visible del diálogo mide al menos 44 px de alto. */
async function expectDialogButtons(dialog: Locator, label: string): Promise<void> {
  const buttons = dialog.getByRole('button').filter({ visible: true });
  const count = await buttons.count();
  expect(count, `${label}: tiene botones`).toBeGreaterThan(0);
  for (const button of await buttons.all()) {
    const name = (await button.getAttribute('aria-label')) ?? (await button.innerText());
    await expectMinHeight(button, MIN_TARGET_PX, `${label}: botón «${name.trim()}»`);
  }
}

/**
 * Color calculado del elemento y el de dos tokens resueltos en su mismo sitio del árbol (un
 * `span` sonda junto a él): así se compara color con color sin depender de cómo serializa cada
 * navegador el `oklch` del tema.
 */
async function colorAgainstTokens(locator: Locator) {
  return locator.evaluate((el) => {
    const probe = (token: string) => {
      const span = document.createElement('span');
      span.style.color = `var(${token})`;
      (el.parentElement ?? document.body).appendChild(span);
      const color = getComputedStyle(span).color;
      span.remove();
      return color;
    };
    return {
      color: getComputedStyle(el).color,
      warning: probe('--warning-text'),
      destructive: probe('--destructive'),
    };
  });
}

async function expectWarningTone(locator: Locator, label: string): Promise<void> {
  const tones = await colorAgainstTokens(locator);
  expect(tones.color, `${label}: tono de advertencia`).toBe(tones.warning);
  expect(tones.color, `${label}: no es el tono de error`).not.toBe(tones.destructive);
}

async function textAlign(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).textAlign);
}

/** La x final del contenido de la cabecera y la de la cifra de la celda. */
async function expectRightAligned(head: Locator, cell: Locator, label: string): Promise<void> {
  expect(await textAlign(head), `${label}: cabecera`).toMatch(/^(right|end)$/);
  expect(await textAlign(cell), `${label}: celda`).toMatch(/^(right|end)$/);
  const headContent = await box(head.locator(':scope > div').first());
  const cellContent = await box(cell.locator(':scope > span').first());
  expect(
    Math.abs(headContent.x + headContent.width - (cellContent.x + cellContent.width)),
    `${label}: misma x final`,
  ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
}

/** Pulsa un disparador hasta que su diálogo abre: en WebKit un clic antes de hidratar se pierde. */
async function openDialogFrom(trigger: Locator, dialog: Locator): Promise<void> {
  await expect(async () => {
    if ((await dialog.count()) === 0) await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
}

/** Menú centrado de una tarjeta: el diálogo se llama como su título. */
async function openCenteredMenu(page: Page, trigger: Locator, title: string): Promise<Locator> {
  const menu = page.getByRole('dialog', { name: title, exact: true });
  await openDialogFrom(trigger, menu);
  return menu;
}

async function expandBatches(toggle: Locator): Promise<void> {
  await expect(async () => {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
}

function sheet(page: Page): Locator {
  return page.getByTestId('product-batches-sheet');
}

function historyDialog(page: Page): Locator {
  return page.getByTestId('batch-history-dialog');
}

// --- /inventario a 1440 ---

test.describe('/inventario a 1440 px', () => {
  test('R1, R3, R6, R7, R9, R14 — cabecera, pestañas enlace, cifras a la derecha, aviso ámbar y menú con separador', async ({
    page,
  }) => {
    const { alert, multi } = seeded();
    await openInventory(page, VIEWPORTS.desktop);

    // R1: un único h1 y las dos acciones, «Importar» antes que «Nuevo producto».
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inventario');
    const importLink = page.getByTestId('inventory-import-link');
    const create = page.getByTestId('product-create-open');
    await expect(importLink).toBeVisible();
    await expect(importLink).toHaveAttribute('href', INVENTORY_IMPORT_ROUTE);
    await expect(importLink).toHaveText('Importar');
    await expect(importLink.locator('svg')).toHaveCount(1);
    await expect(create).toBeVisible();
    expect((await box(importLink)).x).toBeLessThan((await box(create)).x);

    // R3: cinco pestañas, cada una un enlace real, la vigente seleccionada.
    const tabList = page.getByRole('tablist', { name: 'Filtrar por tipo de producto' });
    await expect(tabList).toBeVisible();
    const tabs = tabList.getByRole('tab');
    await expect(tabs).toHaveText([...TAB_NAMES]);
    for (const tab of await tabs.all()) {
      expect(await tab.evaluate((el) => el.tagName)).toBe('A');
    }
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
    for (const index of [1, 2, 3, 4]) {
      await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'false');
    }
    const productHref = new URL((await tabs.nth(1).getAttribute('href')) ?? '', 'http://x');
    expect(productHref.pathname).toBe(INVENTORY_ROUTE);
    expect(productHref.searchParams.get('type')).toBe('PRODUCT');
    expect(productHref.searchParams.get('q')).toBe(LIST_PREFIX);
    const allHref = new URL((await tabs.nth(0).getAttribute('href')) ?? '', 'http://x');
    expect(allHref.searchParams.get('type')).toBeNull();

    // R6: las cifras a la derecha, en cifras tabulares, con la misma x final que su cabecera.
    const row = productRow(page, multi);
    await expect(row).toBeVisible({ timeout: 60_000 });
    for (const columnId of ['stock', 'averageUnitCost', 'qtyAlert', 'reserved', 'available']) {
      const cell = row.getByTestId(`data-table-cell-${columnId}`);
      await expectRightAligned(page.getByTestId(`data-table-head-${columnId}`), cell, columnId);
      expect(await cell.evaluate((el) => getComputedStyle(el).fontVariantNumeric)).toContain(
        'tabular-nums',
      );
    }
    for (const columnId of ['type', 'presentationName']) {
      expect(await textAlign(page.getByTestId(`data-table-head-${columnId}`)), columnId).toMatch(
        /^(left|start)$/,
      );
      expect(await textAlign(row.getByTestId(`data-table-cell-${columnId}`)), columnId).toMatch(
        /^(left|start)$/,
      );
    }
    const available = row.getByTestId('data-table-cell-available').locator(':scope > span').first();
    expect(
      Number(await available.evaluate((el) => getComputedStyle(el).fontWeight)),
      '«Disponible» en negrita',
    ).toBeGreaterThanOrEqual(600);

    // R7: la existencia en alarma en ámbar, con icono oculto y el aviso como title y texto oculto.
    const alertStock = productRow(page, alert).getByTestId('product-stock');
    await expect(alertStock).toHaveAttribute('data-alert', 'true');
    await expectWarningTone(alertStock, 'existencia en alarma');
    await expect(alertStock.locator('svg[aria-hidden="true"]')).toHaveCount(1);
    await expect(alertStock.locator(`[title="${BELOW_ALERT_LABEL}"]`)).toHaveCount(1);
    await expect(alertStock.locator('.sr-only')).toHaveText(BELOW_ALERT_LABEL);
    await expect(productRow(page, multi).getByTestId('product-stock')).not.toHaveAttribute(
      'data-alert',
      'true',
    );

    // R9, R14: los cinco ítems en orden, una línea antes de «Borrar» y «Borrar» destructivo.
    await openRowActionsMenuItem(page, row.getByTestId('product-row-actions'), 'product-batches-open');
    const menu = page.getByRole('menu');
    const items = menu.getByRole('menuitem');
    await expect(items).toHaveText([...MENU_ITEMS]);
    for (const testId of [
      'product-batches-open',
      'product-history-open',
      'product-adjust-open',
      'product-edit-open',
      'product-delete-open',
    ]) {
      await expect(menu.getByTestId(testId)).toHaveCount(1);
    }
    const separator = menu.getByRole('separator');
    await expect(separator).toHaveCount(1);
    const separatorY = (await box(separator)).y;
    expect(separatorY).toBeGreaterThan((await box(menu.getByTestId('product-edit-open'))).y);
    expect(separatorY).toBeLessThan((await box(menu.getByTestId('product-delete-open'))).y);
    const remove = menu.getByTestId('product-delete-open');
    await expect(remove).toHaveAttribute('data-variant', 'destructive');
    const removeTones = await colorAgainstTokens(remove);
    expect(removeTones.color, '«Borrar» en el tono destructivo').toBe(removeTones.destructive);
  });

  test('R47, R48, R6, R12 — los lotes desplegados pintan sub-filas sin menú, «Costo» a la derecha y el vencimiento cercano en ámbar', async ({
    page,
  }) => {
    const { multi } = seeded();
    const [expiring, plain] = multi.batches;
    if (expiring === undefined || plain === undefined) throw new Error('faltan los lotes de «varios»');
    await openInventory(page, VIEWPORTS.desktop);

    const row = productRow(page, multi);
    // R48: el nombre del producto con un lote por vencer, en ámbar.
    const name = row.getByTestId('product-name');
    await expect(name).toHaveAttribute('data-expiring', 'true', { timeout: 60_000 });
    await expectWarningTone(name, 'nombre del producto por vencer');

    await expandBatches(row.getByTestId('product-batches-toggle'));
    const expiringRow = page.getByTestId(`data-table-row-${subRowId(multi, expiring)}`);
    const plainRow = page.getByTestId(`data-table-row-${subRowId(multi, plain)}`);
    await expect(expiringRow).toBeVisible({ timeout: 60_000 });
    await expect(plainRow).toBeVisible();

    // R47: cada sub-fila con su lote; R12: sin menú ni «Acciones».
    await expect(expiringRow.getByTestId('product-batch-row-lot')).toHaveText(expiring.lot);
    await expect(plainRow.getByTestId('product-batch-row-lot')).toHaveText(plain.lot);
    for (const subRow of [expiringRow, plainRow]) {
      await expect(subRow.getByTestId('product-row-actions')).toHaveCount(0);
      await expect(subRow.getByRole('button', { name: /Acciones/ })).toHaveCount(0);
    }

    // R6: «Costo» de la sub-fila a la derecha, con la misma x final que su cabecera.
    await expectRightAligned(
      page.getByTestId('data-table-head-averageUnitCost'),
      expiringRow.getByTestId('data-table-cell-averageUnitCost'),
      'costo de la sub-fila',
    );
    await expect(expiringRow.getByTestId('product-batch-row-cost')).toHaveText('3.5');

    // R48: la fecha del lote que vence en diez días, en ámbar y con su relativo.
    const expiry = expiringRow.getByTestId('product-batch-row-expiry-date');
    await expect(expiry).toHaveAttribute('data-expiring', 'true');
    await expect(expiry).not.toHaveAttribute('data-expired', 'true');
    await expect(expiringRow.getByTestId('product-batch-row-expiry-relative')).toBeVisible();
    await expect(expiringRow.getByTestId('product-batch-row-expired')).toHaveCount(0);
    await expectWarningTone(expiry, 'vencimiento cercano');
    await expect(plainRow.getByTestId('product-batch-row-expiry-date')).not.toHaveAttribute(
      'data-expiring',
      'true',
    );
  });

  test('R11, R15, R20, R21, R23, R25, R52 — «Historial» abre el lote único o «Lotes»; panel con tabla de 900 px; historial con tabla que al cerrarse deja el panel; motivo exigido bajo el campo', async ({
    page,
  }) => {
    const { alert, multi } = seeded();
    await openInventory(page, VIEWPORTS.desktop);

    // R11: con un solo lote, «Historial» abre el historial de ese lote, sin pasar por «Lotes».
    const alertBatch = firstBatch(alert);
    await (
      await openRowActionsMenuItem(
        page,
        productRow(page, alert).getByTestId('product-row-actions'),
        'product-history-open',
      )
    ).click();
    await expect(historyDialog(page)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('batch-history-lot')).toHaveText(alertBatch.lot);
    await expect(sheet(page)).toHaveCount(0);
    // R52: hasta 1000 px.
    await waitForAnimationsToSettle(historyDialog(page));
    expect((await box(historyDialog(page))).width).toBeLessThanOrEqual(HISTORY_MAX_PX);
    await page.keyboard.press('Escape');
    await expect(historyDialog(page)).toHaveCount(0);

    // R11: con dos lotes, «Historial» abre «Lotes» para elegir.
    await (
      await openRowActionsMenuItem(
        page,
        productRow(page, multi).getByTestId('product-row-actions'),
        'product-history-open',
      )
    ).click();
    const panel = sheet(page);
    await expect(panel).toBeVisible({ timeout: 60_000 });
    await expect(historyDialog(page)).toHaveCount(0);

    // R20: el panel mide hasta 900 px.
    await waitForAnimationsToSettle(panel);
    const panelBox = await box(panel);
    expect(panelBox.width).toBeLessThanOrEqual(SHEET_MAX_PX + 0.5);
    expect(panelBox.width).toBeGreaterThan(SHEET_MAX_PX - 2);

    // R15: «Lotes» encima del título y una tabla con sus columnas, las cifras a la derecha.
    const label = panel.getByTestId('product-batches-label');
    await expect(label).toHaveText('Lotes');
    const title = panel.getByRole('heading', { name: new RegExp(`^${multi.name}`) });
    await expect(title).toBeVisible();
    const labelBox = await box(label);
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual((await box(title)).y + 0.5);
    for (const [columnId, columnLabel] of BATCH_COLUMNS) {
      await expect(panel.getByTestId(`data-table-head-${columnId}`)).toContainText(columnLabel);
    }
    const [expiring] = multi.batches;
    if (expiring === undefined) throw new Error('faltan los lotes de «varios»');
    const batchRow = panel.getByTestId(`data-table-row-${expiring.id}`);
    await expect(batchRow).toBeVisible({ timeout: 60_000 });
    await expect(batchRow.getByTestId('product-batch-lot')).toHaveText(expiring.lot);
    for (const columnId of ['quantity', 'reserved', 'available']) {
      expect(await textAlign(batchRow.getByTestId(`data-table-cell-${columnId}`)), columnId).toMatch(
        /^(right|end)$/,
      );
    }
    // R48 en el panel: la fecha por vencer en ámbar.
    const panelExpiry = batchRow.getByTestId('product-batch-expiry-date');
    await expect(panelExpiry).toHaveAttribute('data-expiring', 'true');
    await expectWarningTone(panelExpiry, 'vencimiento del panel');

    // R21: el historial del lote en una tabla con sus ocho columnas.
    await (
      await openRowActionsMenuItem(page, batchActionsTrigger(batchRow), 'batch-history-trigger')
    ).click();
    const history = historyDialog(page);
    await expect(history).toBeVisible({ timeout: 60_000 });
    await expect(history.getByRole('heading', { name: `Historial del lote ${expiring.lot}` })).toBeVisible();
    await expect(page.getByTestId('batch-history-lot')).toHaveText(expiring.lot);
    const list = history.getByTestId('batch-history-list');
    await expect(list).toBeVisible({ timeout: 60_000 });
    for (const [columnId, columnLabel] of HISTORY_COLUMNS) {
      await expect(list.getByTestId(`data-table-head-${columnId}`)).toContainText(columnLabel);
    }
    const entry = list.getByTestId(`data-table-row-opening-${expiring.openingId}`);
    await expect(entry).toBeVisible();
    await expect(entry.getByTestId('data-table-cell-reason')).toHaveText(EMPTY);
    await expect(entry.getByTestId('data-table-cell-order')).toHaveText(EMPTY);
    await expect(list.getByTestId(`data-table-card-opening-${expiring.openingId}`)).toBeHidden();

    // R23: cerrar el historial deja el panel abierto.
    await history.getByRole('button', { name: 'Close' }).click();
    await expect(history).toHaveCount(0);
    await expect(panel).toBeVisible();

    // R25: «Ajustar» con diferencia y sin motivo pinta el aviso debajo de «Motivo».
    await (await openRowActionsMenuItem(page, batchActionsTrigger(batchRow), 'adjust-batch-open')).click();
    const adjust = page.getByTestId('adjust-batch-dialog');
    await expect(adjust).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('adjust-batch-counted').fill('7');
    await expect(page.getByTestId('adjust-batch-difference')).toBeVisible();
    await page.getByTestId('adjust-batch-confirm').click();
    const reasonError = page.getByTestId('adjust-batch-reason-error');
    await expect(reasonError).toHaveText(MISSING_REASON);
    await expect(reasonError.locator('svg')).toHaveCount(1);
    const reason = page.getByTestId('adjust-batch-reason');
    await expect(reason).toHaveAttribute('aria-invalid', 'true');
    const errorId = await reasonError.getAttribute('id');
    expect(errorId).toBeTruthy();
    expect((await reason.getAttribute('aria-describedby'))?.split(' ')).toContain(errorId);
    const reasonBox = await box(reason);
    expect((await box(reasonError)).y).toBeGreaterThanOrEqual(reasonBox.y + reasonBox.height - 0.5);

    // R23: cancelar el ajuste también deja el panel abierto.
    await page.getByTestId('adjust-batch-cancel').click();
    await expect(adjust).toHaveCount(0);
    await expect(panel).toBeVisible();
  });
});

// --- /inventario a 820 ---

test.describe('/inventario a 820 px', () => {
  test('R13, R5, R52 — la lista en tarjetas, las pestañas en una línea sin desbordar y el historial con 16 px a cada lado', async ({
    page,
  }) => {
    const { alert, multi } = seeded();
    await openInventory(page, VIEWPORTS.tablet);

    // R13: tarjetas, no filas.
    await expect(page.getByTestId('data-table-cards').first()).toBeVisible();
    await expect(productRow(page, multi)).toBeHidden();
    const card = productCard(page, multi);
    await expect(card).toBeVisible();
    await expect(card.getByTestId('product-name')).toHaveText(multi.name);
    await expect(card.getByTestId('product-batches-toggle')).toBeVisible();
    await expect(card.getByTestId('product-type')).toBeVisible();
    for (const columnId of ['presentationName', 'stock', 'averageUnitCost', 'qtyAlert', 'available']) {
      await expect(card.getByTestId(`data-table-card-field-${columnId}`), columnId).toBeVisible();
    }
    await expect(productCard(page, alert).getByTestId('product-stock')).toHaveAttribute('data-alert', 'true');

    // R5: las pestañas en una sola línea, sin salirse de la página.
    const tabList = page.getByRole('tablist', { name: 'Filtrar por tipo de producto' });
    const tabTops = await tabList.getByRole('tab').evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    expect(new Set(tabTops).size, 'las pestañas no saltan de línea').toBe(1);
    const tabListBox = await box(tabList);
    expect(tabListBox.x + tabListBox.width).toBeLessThanOrEqual(VIEWPORTS.tablet.width);
    await expectNoHorizontalScroll(page, '/inventario a 820 px');

    // R52: el historial deja al menos 16 px a cada lado de la ventana.
    const menu = await openCenteredMenu(page, productCard(page, alert).getByTestId('product-row-actions'), alert.name);
    await menu.getByTestId('product-history-open').click();
    const history = historyDialog(page);
    await expect(history).toBeVisible({ timeout: 60_000 });
    await waitForAnimationsToSettle(history);
    const historyBox = await box(history);
    expect(historyBox.width).toBeLessThanOrEqual(HISTORY_MAX_PX);
    expect(historyBox.x, 'margen izquierdo').toBeGreaterThanOrEqual(HISTORY_MIN_GUTTER_PX - 0.5);
    expect(
      VIEWPORTS.tablet.width - (historyBox.x + historyBox.width),
      'margen derecho',
    ).toBeGreaterThanOrEqual(HISTORY_MIN_GUTTER_PX - 0.5);
  });
});

// --- /inventario a 390 ---

test.describe('/inventario a 390 px', () => {
  test('R2, R13, R14, R42, R47, R5 — acciones de cabecera a todo el ancho, tarjeta con «Acciones» de 44 px, menú centrado con ítems de 48 px y sub-filas en tarjeta sin «Acciones»', async ({
    page,
  }) => {
    const { multi } = seeded();
    await openInventory(page, VIEWPORTS.phone);

    // R2: las dos acciones reparten el ancho de la cabecera y miden 44 px.
    const importLink = page.getByTestId('inventory-import-link');
    const create = page.getByTestId('product-create-open');
    await expectMinHeight(importLink, MIN_TARGET_PX, '«Importar»');
    await expectMinHeight(create, MIN_TARGET_PX, '«Nuevo producto»');
    const importBox = await box(importLink);
    const createBox = await box(create);
    const actionsBox = await box(importLink.locator('xpath=..'));
    expect(Math.abs(importBox.y - createBox.y), 'en la misma línea').toBeLessThanOrEqual(1);
    expect(Math.abs(importBox.x - actionsBox.x)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    expect(
      Math.abs(createBox.x + createBox.width - (actionsBox.x + actionsBox.width)),
    ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    expect(Math.abs(importBox.width - createBox.width), 'mismo ancho').toBeLessThanOrEqual(2);
    expect(actionsBox.width, 'la fila de acciones ocupa el ancho de la cabecera').toBeGreaterThan(
      VIEWPORTS.phone.width - 64,
    );

    // R5: las pestañas se desplazan dentro de su lista, en una línea, sin desbordar la página.
    const tabList = page.getByRole('tablist', { name: 'Filtrar por tipo de producto' });
    const tabTops = await tabList.getByRole('tab').evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    expect(new Set(tabTops).size, 'las pestañas no saltan de línea').toBe(1);
    const scroll = await tabList.evaluate((el) => ({
      overflowX: getComputedStyle(el).overflowX,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scroll.overflowX).toBe('auto');
    expect(scroll.scrollWidth, 'a 390 px no caben: se desplazan').toBeGreaterThan(scroll.clientWidth);
    await expectNoHorizontalScroll(page, '/inventario a 390 px');

    // R13: «Acciones» de 44 px abre el menú centrado con el nombre como título e ítems de 48 px.
    const card = productCard(page, multi);
    await expect(card).toBeVisible();
    const trigger = card.getByTestId('product-row-actions');
    await expect(trigger).toHaveText('Acciones');
    await expectMinHeight(trigger, MIN_TARGET_PX, '«Acciones» de la tarjeta');
    const menu = await openCenteredMenu(page, trigger, multi.name);
    await expectCenteredAndWhole(page, menu, 'menú centrado');
    for (const testId of [
      'product-batches-open',
      'product-history-open',
      'product-adjust-open',
      'product-edit-open',
      'product-delete-open',
    ]) {
      await expectMinHeight(menu.getByTestId(testId), MIN_MENU_ITEM_PX, testId);
    }
    // R14 en el diálogo centrado: una línea antes de «Borrar».
    const separator = menu.getByRole('separator');
    await expect(separator).toHaveCount(1);
    const separatorY = (await box(separator)).y;
    expect(separatorY).toBeGreaterThan((await box(menu.getByTestId('product-edit-open'))).y);
    expect(separatorY).toBeLessThan((await box(menu.getByTestId('product-delete-open'))).y);
    await expectDialogButtons(menu, 'menú centrado');
    await menu.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(menu).toHaveCount(0);

    // R47: las sub-filas, tarjetas propias justo debajo de la del producto, sin imagen ni «Acciones».
    await expandBatches(card.getByTestId('product-batches-toggle'));
    for (const batch of multi.batches) {
      await expect(page.getByTestId(`data-table-card-${subRowId(multi, batch)}`)).toBeVisible({
        timeout: 60_000,
      });
    }
    const ids = await page
      .getByTestId('data-table-cards')
      .first()
      .locator(':scope > li')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
    const at = ids.indexOf(`data-table-card-${multi.id}`);
    expect(at).toBeGreaterThanOrEqual(0);
    // El orden de los lotes es el de la lectura; lo que se afirma es que van seguidos tras el producto.
    expect(ids.slice(at + 1, at + 1 + multi.batches.length).sort()).toEqual(
      multi.batches.map((batch) => `data-table-card-${subRowId(multi, batch)}`).sort(),
    );
    for (const batch of multi.batches) {
      const subCard = page.getByTestId(`data-table-card-${subRowId(multi, batch)}`);
      await expect(subCard).toBeVisible();
      await expect(subCard.getByTestId('product-batch-row-lot')).toHaveText(batch.lot);
      await expect(subCard.getByRole('button', { name: /Acciones/ })).toHaveCount(0);
      await expect(subCard.locator('img')).toHaveCount(0);
      await expect(subCard.getByTestId('product-image')).toHaveCount(0);
    }
    await expectNoHorizontalScroll(page, '/inventario a 390 px con lotes desplegados');
  });

  test('R19, R23, R42 — lotes e historial en tarjetas; historial, ajuste y borrado enteros y centrados con botones de 44 px', async ({
    page,
  }) => {
    const { multi } = seeded();
    const batch = firstBatch(multi);
    await openInventory(page, VIEWPORTS.phone);

    const card = productCard(page, multi);
    const productMenu = await openCenteredMenu(page, card.getByTestId('product-row-actions'), multi.name);
    await productMenu.getByTestId('product-batches-open').click();
    const panel = sheet(page);
    await expect(panel).toBeVisible({ timeout: 60_000 });
    await waitForAnimationsToSettle(panel);
    // R20: a 390 px el panel ocupa todo el ancho.
    expect(Math.round((await box(panel)).width)).toBe(VIEWPORTS.phone.width);

    // R19: cada lote, una tarjeta con sus cifras y «Acciones» de 44 px.
    const batchCard = panel.getByTestId(`data-table-card-${batch.id}`);
    await expect(batchCard).toBeVisible({ timeout: 60_000 });
    await expect(panel.getByTestId(`data-table-row-${batch.id}`)).toBeHidden();
    await expect(batchCard.getByTestId('product-batch-lot')).toHaveText(batch.lot);
    for (const columnId of ['quantity', 'reserved', 'available', 'purchaseDate', 'expiryDate']) {
      await expect(batchCard.getByTestId(`data-table-card-field-${columnId}`), columnId).toBeVisible();
    }
    const batchTrigger = batchActionsTrigger(batchCard);
    await expectMinHeight(batchTrigger, MIN_TARGET_PX, '«Acciones» del lote');

    // R23 y R42: el historial, en tarjetas, entero y centrado.
    let batchMenu = await openCenteredMenu(page, batchTrigger, batch.lot);
    await expectCenteredAndWhole(page, batchMenu, 'menú del lote');
    await batchMenu.getByTestId('batch-history-trigger').click();
    const history = historyDialog(page);
    await expectCenteredAndWhole(page, history, 'historial');
    const list = history.getByTestId('batch-history-list');
    await expect(list.getByTestId(`data-table-card-opening-${batch.openingId}`)).toBeVisible({
      timeout: 60_000,
    });
    await expect(list.getByTestId(`data-table-row-opening-${batch.openingId}`)).toBeHidden();
    await expectDialogButtons(history, 'historial');
    await history.getByRole('button', { name: 'Close' }).click();
    await expect(history).toHaveCount(0);
    await expect(panel).toBeVisible();

    // R42: el ajuste, entero y centrado, con botones de 44 px.
    batchMenu = await openCenteredMenu(page, batchTrigger, batch.lot);
    await batchMenu.getByTestId('adjust-batch-open').click();
    const adjust = page.getByTestId('adjust-batch-dialog');
    await expectCenteredAndWhole(page, adjust, 'ajuste');
    await expectDialogButtons(adjust, 'ajuste');
    await page.getByTestId('adjust-batch-cancel').click();
    await expect(adjust).toHaveCount(0);
    await expect(panel).toBeVisible();

    // R42: el borrado, entero y centrado, con botones de 44 px.
    await panel.getByRole('button', { name: 'Close' }).click();
    await expect(panel).toHaveCount(0);
    const menuAgain = await openCenteredMenu(page, card.getByTestId('product-row-actions'), multi.name);
    await menuAgain.getByTestId('product-delete-open').click();
    const remove = page.getByRole('alertdialog');
    await expectCenteredAndWhole(page, remove, 'borrado');
    await expectDialogButtons(remove, 'borrado');
    await remove.getByRole('button', { name: 'Cancelar' }).click();
    await expect(remove).toHaveCount(0);
  });
});

// --- Desbordamiento a los tres anchos ---

test.describe('R43 — /inventario sin desbordamiento horizontal', () => {
  test('R43 — a 1440, 820 y 390 px «Todos» y «Producto terminado» no desbordan la página', async ({ page }) => {
    await openInventory(page, VIEWPORTS.desktop);
    for (const type of [undefined, 'FINISHED_PRODUCT']) {
      await page.goto(listUrl(type));
      await expect(page.getByTestId('inventario-title')).toBeVisible({ timeout: 60_000 });
      for (const viewport of WIDTHS) {
        await page.setViewportSize(viewport);
        await expectNoHorizontalScroll(page, `${type ?? 'Todos'} a ${viewport.width} px`);
      }
      await page.setViewportSize(VIEWPORTS.desktop);
    }
  });
});

// --- Importación ---

const CSV_HEADER =
  'Tipo;Nombre;Unidad;Presentación;Fórmula;Cantidad;Costo unitario;Lote;Fecha de compra;Fecha de vencimiento;Alerta de cantidad';
const IMPORT_FILE_NAME = 'inventario-rediseno.csv';
const MISSING_UNIT = `${IMPORT_PREFIX}_tambor`;
const MISSING_PRESENTATION = `${IMPORT_PREFIX}_frasco`;
const IMPORT_ROW = { created: 2, missingUnit: 3, missingPresentation: 4 } as const;

function importCsv(): Buffer {
  const lines = [
    CSV_HEADER,
    `Insumo;${IMPORT_PREFIX}_nuevo;kilogramo;;;5;2;${IMPORT_PREFIX}_L1;;;1`,
    `Insumo;${IMPORT_PREFIX}_tambor;${MISSING_UNIT};;;4;1;${IMPORT_PREFIX}_L2;;;1`,
    `Envase;${IMPORT_PREFIX}_envase;;${MISSING_PRESENTATION};;3;1;${IMPORT_PREFIX}_L3;;;1`,
  ];
  return Buffer.from(`﻿${lines.join('\n')}\n`, 'utf8');
}

async function expectCurrentStep(page: Page, step: 1 | 2 | 3): Promise<void> {
  const steps = page.getByTestId(IMPORT_STEPS_TESTID);
  await expect(steps.getByTestId(importStepTestId(step))).toHaveAttribute('aria-current', 'step', {
    timeout: 60_000,
  });
  await expect(steps.locator('[aria-current="step"]')).toHaveCount(1);
}

/** R43 y R49 en el paso a la vista, a los tres anchos; termina en el ancho de partida. */
async function expectStepLayout(page: Page, step: number): Promise<void> {
  const start = page.viewportSize() as NonNullable<ReturnType<Page['viewportSize']>>;
  for (const viewport of WIDTHS) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalScroll(page, `paso ${step} a ${viewport.width} px`);
    const screen = await box(page.getByTestId(IMPORT_SCREEN_TESTID));
    const guide = page.getByTestId(GUIDE_TESTID);
    await expect(guide).toBeVisible();
    expect((await box(guide)).y, `guía debajo en el paso ${step} a ${viewport.width} px`).toBeGreaterThanOrEqual(
      screen.y + screen.height - 0.5,
    );
    await expect(page.getByTestId(IMPORT_STEPS_TESTID).getByTestId(GUIDE_TESTID)).toHaveCount(0);
  }
  await page.setViewportSize(start);
}

async function expectRowStatus(table: Locator, rowNumber: number, status: string, tone: string): Promise<void> {
  const badge = table.getByTestId(`data-table-row-${rowNumber}`).getByTestId(ROW_STATUS_TESTID);
  await expect(badge, `estado de la fila ${rowNumber}`).toHaveAttribute('data-status', status, {
    timeout: 60_000,
  });
  await expect(badge, `tono de la fila ${rowNumber}`).toHaveAttribute('data-tone', tone);
}

test.describe('importar inventario', () => {
  test('R31, R32, R33, R38, R28, R42, R43, R49 — los pasos 1 → 2 → 3 → 1, estados con tono, «Unidad creada.» una vez, diálogos centrados y sin desbordar', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    await loginAndLand(page, adminUser);
    await page.goto(INVENTORY_IMPORT_ROUTE);
    await expect(page.getByTestId(REVIEW_BUTTON_TESTID)).toBeVisible({ timeout: 60_000 });

    // R31: lista ordenada «Pasos», numerada, sin controles.
    const steps = page.getByRole('list', { name: 'Pasos' });
    await expect(steps).toBeVisible();
    expect(await steps.evaluate((el) => el.tagName)).toBe('OL');
    await expect(steps.locator(':scope > li')).toHaveCount(3);
    await expect(steps.locator(':scope > li [data-slot="import-step-number"]')).toHaveText(['1', '2', '3']);
    await expect(steps.locator(':scope > li')).toContainText([
      'Elegir archivo',
      'Vista previa',
      'Importación terminada',
    ]);
    await expect(steps.locator('button, a, input, [tabindex]')).toHaveCount(0);

    // R32: paso 1 sin archivo.
    await expectCurrentStep(page, 1);

    // R33: a 390 px la barra no cabe y se desplaza en una línea, dentro de la página.
    const stepTops = await steps.locator(':scope > li').evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    expect(new Set(stepTops).size, 'los pasos no saltan de línea').toBe(1);
    const stepsScroll = await steps.evaluate((el) => ({
      overflowX: getComputedStyle(el).overflowX,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      right: el.getBoundingClientRect().right,
    }));
    expect(stepsScroll.overflowX).toBe('auto');
    expect(stepsScroll.scrollWidth, 'a 390 px no caben: se desplazan').toBeGreaterThan(
      stepsScroll.clientWidth,
    );
    expect(stepsScroll.right).toBeLessThanOrEqual(VIEWPORTS.phone.width);
    await expectStepLayout(page, 1);

    // R32: paso 2 con la vista previa.
    await page
      .getByTestId(UPLOAD_INPUT_TESTID)
      .setInputFiles([{ name: IMPORT_FILE_NAME, mimeType: 'text/csv', buffer: importCsv() }]);
    await page.getByTestId(REVIEW_BUTTON_TESTID).click();
    await expect(page.getByTestId(PREVIEW_SUMMARY_TESTID)).toBeVisible({ timeout: 60_000 });
    await expectCurrentStep(page, 2);

    // R38: «Crear» en success, «Error» en danger.
    const preview = page.getByTestId(PREVIEW_TABLE_TESTID);
    await expectRowStatus(preview, IMPORT_ROW.created, 'create', 'success');
    await expectRowStatus(preview, IMPORT_ROW.missingUnit, 'error', 'danger');
    await expectRowStatus(preview, IMPORT_ROW.missingPresentation, 'error', 'danger');
    await expectStepLayout(page, 2);

    // R42: «Nueva presentación», entera y centrada a 390 px; se cancela.
    const missingPresentation = page.getByTestId(MISSING_PRESENTATION_TESTID);
    await expect(missingPresentation).toHaveCount(1);
    await openDialogFrom(
      missingPresentation.getByTestId(MISSING_CREATE_TESTID),
      page.getByTestId(PRESENTATION_DIALOG_TESTID),
    );
    const presentationDialog = page.getByTestId(PRESENTATION_DIALOG_TESTID);
    await expectCenteredAndWhole(page, presentationDialog, 'nueva presentación');
    await expectMinHeight(presentationDialog.getByTestId(DIALOG_SUBMIT_TESTID), MIN_TARGET_PX, 'crear presentación');
    await expectMinHeight(presentationDialog.getByTestId(DIALOG_CANCEL_TESTID), MIN_TARGET_PX, 'cancelar presentación');
    await presentationDialog.getByTestId(DIALOG_CANCEL_TESTID).click();
    await expect(presentationDialog).toHaveCount(0);

    // R42 y R28: «Nueva unidad», entera y centrada; al crearla, «Unidad creada.» una sola vez.
    const missingUnit = page.getByTestId(MISSING_UNIT_TESTID);
    await expect(missingUnit).toHaveCount(1);
    const unitDialog = page.getByTestId(UNIT_DIALOG_TESTID);
    await openDialogFrom(missingUnit.getByTestId(MISSING_CREATE_TESTID), unitDialog);
    await expectCenteredAndWhole(page, unitDialog, 'nueva unidad');
    await expectMinHeight(unitDialog.getByTestId(DIALOG_SUBMIT_TESTID), MIN_TARGET_PX, 'crear unidad');
    await expectMinHeight(unitDialog.getByTestId(DIALOG_CANCEL_TESTID), MIN_TARGET_PX, 'cancelar unidad');
    await unitDialog.getByTestId(DIALOG_SUBMIT_TESTID).click();
    await expect(unitDialog).toHaveCount(0, { timeout: 60_000 });
    const unitToasts = page.locator('[data-sonner-toast]').filter({ hasText: UNIT_CREATED });
    await expect(unitToasts).toHaveCount(1, { timeout: 60_000 });
    await expect(page.getByTestId(MISSING_UNIT_TESTID)).toHaveCount(0, { timeout: 60_000 });
    await expectRowStatus(preview, IMPORT_ROW.missingUnit, 'create', 'success');
    await expectCurrentStep(page, 2);
    await expect(unitToasts).toHaveCount(1);

    // R32: paso 3 con la importación hecha.
    await page.getByTestId(CONFIRM_BUTTON_TESTID).click();
    const result = page.getByTestId(RESULT_TESTID);
    await expect(result).toBeVisible({ timeout: 120_000 });
    await expectCurrentStep(page, 3);
    const resultTable = result.getByTestId(RESULT_TABLE_TESTID);
    await expectRowStatus(resultTable, IMPORT_ROW.created, 'created', 'success');
    await expectRowStatus(resultTable, IMPORT_ROW.missingPresentation, 'error', 'danger');
    await expectStepLayout(page, 3);

    // R32: «Importar otro archivo» vuelve al 1.
    await page.getByTestId(RESTART_TESTID).click();
    await expectCurrentStep(page, 1);
    await expect(page.getByTestId(GUIDE_TESTID)).toBeVisible();
  });
});
