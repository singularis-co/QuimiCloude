/**
 * E2E de un pedido de varias recetas por la pantalla de Pedidos: alta de dos recetas con precio,
 * detalle con avance y totales, cancelar una receta y anadir otra con «Editar».
 *
 * Un unico `test()`: cada paso es la precondicion del siguiente.
 *
 * Lo apartado y lo liberado se leen de la base, receta a receta y lote a lote. Cada receta usa su
 * propio insumo, y las tres comparten el envase: asi un apartado o una liberacion que se colase a
 * otra receta salta a la vista en el lote compartido.
 *
 * DATOS: el patron de la suite. Todo lleva el prefijo `qt314_e2e_` y el `RUN_ID` del worker, la
 * limpieza de huerfanos borra por prefijo Y POR EDAD, y `afterAll` borra siempre, en el orden de
 * las FK. La empresa, el usuario, los insumos, el envase y las recetas se siembran por Prisma; el
 * pedido se crea, se cancela en parte y se edita por la pantalla.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizePresentationName, normalizeProductName } from '@/lib/modules/inventario';
import { normalizeRecipeName } from '@/lib/modules/recetas';
import { prisma } from '@/lib/shared/db/prisma';
import { formatMoneyDisplay } from '@/lib/shared/ui/decimal-display';
import { ORDERS_ROUTE } from '@/lib/shared/routes';

import { deleteOrdersWithLines } from './helpers/delete-orders';
import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import {
  addOrderLine,
  cancelOrderLine,
  closeWithEscape,
  openCreateOrderPanel,
  openEditOrderPanel,
  openOrderDetail,
  orderRow,
  ORDER_DETAIL_LINE_TESTID,
  ORDER_DETAIL_SUMMARY_TESTID,
  ORDER_LINES_EDIT_TESTID,
  ORDER_LINES_READ_ONLY_TESTID,
  ORDER_LINES_TOTAL_TESTID,
  panelLine,
  panelLines,
  saveOrder,
} from './helpers/order-form';
import { seedPackaging } from './helpers/packaging';

const FIXTURE_PREFIX = 'qt314_e2e_';

const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit pueden correr a la vez, y puede haber otro worktree corriendo su propio E2E. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;

/** Nunca la empresa de instalacion: `companies_name_unique` es GLOBAL. */
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const PRESENTATION_NAME = `${SHARED_TOKEN}_bidon`;
const PACKAGING_NAME = `${SHARED_TOKEN}_envase`;
const PACKAGING_LOT = `${SHARED_TOKEN}_le`;

type RecipeKey = 'a' | 'b' | 'c';

/** Una receta por insumo; los envases de contenido 1 cubren la cantidad entera, sin sobrante. */
const RECIPES: Readonly<Record<RecipeKey, { readonly quantity: string; readonly salePrice: string }>> = {
  a: { quantity: '10', salePrice: '100' },
  b: { quantity: '20', salePrice: '250.5' },
  c: { quantity: '5', salePrice: '40' },
};

const INSUMO_STOCK = '50';
const INSUMO_UNIT_COST = '2.0000';
const PACKAGING_STOCK = '100';
const PACKAGING_UNIT_COST = '0.5000';
const PRESENTATION_CONTENT = '1';
const CANCEL_REASON = `${SHARED_TOKEN} el cliente ya no la quiere`;

const recipeName = (key: RecipeKey): string => `${SHARED_TOKEN}_receta_${key}`;
const insumoName = (key: RecipeKey): string => `${SHARED_TOKEN}_insumo_${key}`;

const adminUser = {
  username: `${SHARED_TOKEN}_admin`,
  password: `Qt314-Admin-${RUN_ID.slice(0, 12)}`,
} as const;

let companyId: string | null = null;
let unitId: string | null = null;
let presentationId: string | null = null;
let packagingId: string | null = null;
let packagingBatchId: string | null = null;
const recipeIds = new Map<RecipeKey, string>();
const insumoBatchIds = new Map<RecipeKey, string>();

/** Lo que una receta del pedido tiene apartado, neto, por lote: `reserve` menos lo que lo resuelve. */
async function netReservedOf(orderLineId: string): Promise<Record<string, string>> {
  const rows = await prisma.reservationMovement.findMany({
    where: { orderLineId },
    select: { batchId: true, kind: true, quantity: true },
  });
  const net = new Map<string, number>();
  for (const row of rows) {
    const sign = row.kind === 'reserve' ? 1 : -1;
    net.set(lotName(row.batchId), (net.get(lotName(row.batchId)) ?? 0) + sign * Number(row.quantity));
  }
  return Object.fromEntries([...net.entries()].sort().map(([lot, qty]) => [lot, qty.toFixed(4)]));
}

async function kindsOf(orderLineId: string): Promise<readonly string[]> {
  const rows = await prisma.reservationMovement.findMany({ where: { orderLineId }, select: { kind: true } });
  return [...new Set(rows.map((row) => row.kind))].sort();
}

function lotName(batchId: string): string {
  if (batchId === packagingBatchId) return 'envase';
  for (const [key, id] of insumoBatchIds) if (id === batchId) return `insumo_${key}`;
  return batchId;
}

function money(value: string): string {
  return formatMoneyDisplay(value);
}

async function seedInsumo(key: RecipeKey, createdBy: string): Promise<string> {
  const product = await prisma.product.create({
    data: {
      name: insumoName(key),
      nameNormalized: normalizeProductName(insumoName(key)),
      unitId: unitId!,
      stock: INSUMO_STOCK,
      companyId: companyId!,
    },
    select: { id: true },
  });
  const purchaseDate = new Date('2026-01-01T00:00:00Z');
  const batch = await prisma.productBatch.create({
    data: {
      productId: product.id,
      presentationId: presentationId!,
      companyId: companyId!,
      stock: INSUMO_STOCK,
      unitCost: INSUMO_UNIT_COST,
      lot: `${SHARED_TOKEN}_l${key}`,
      purchaseDate,
      createdBy,
    },
    select: { id: true },
  });
  await prisma.inventoryMovement.create({
    data: { batchId: batch.id, kind: 'opening', quantity: INSUMO_STOCK, reason: null, companyId: companyId!, createdBy, createdAt: purchaseDate },
  });
  insumoBatchIds.set(key, batch.id);

  const recipe = await prisma.recipe.create({
    data: {
      name: recipeName(key),
      nameNormalized: normalizeRecipeName(recipeName(key)),
      createdBy,
      companyId: companyId!,
      lines: { create: [{ productId: product.id, percentage: '100.00' }] },
    },
    select: { id: true },
  });
  return recipe.id;
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

  const role = await prisma.role.findUnique({ where: { name: ROLE_ADMINISTRADOR }, select: { id: true } });
  if (!role) {
    throw new Error(`falta el rol "${ROLE_ADMINISTRADOR}": siembra la base con \`pnpm run db:seed\` antes de correr \`pnpm run e2e\`.`);
  }

  companyId = (
    await prisma.company.create({
      data: { name: COMPANY_NAME, nameNormalized: normalizeCompanyName(COMPANY_NAME) },
      select: { id: true },
    })
  ).id;

  const adminUserId = (
    await createFixtureUser({
      data: {
        firstNames: `Qt314${RUN_ID.slice(0, 8)}`,
        lastNames: 'VariasRecetas',
        birthDate: new Date('1990-01-01'),
        email: `${adminUser.username}@example.test`,
        phone: '+573000000000',
        documentTypeCode: 'CC',
        documentNumber: adminUser.username,
        username: adminUser.username,
        passwordHash: await createPasswordHash(adminUser.password),
        roleId: role.id,
        companyId,
        accountStatus: 'active',
      },
      select: { id: true },
    })
  ).id;

  // Una de las unidades del catalogo arrancador, nunca creada ni borrada por este archivo.
  unitId = (
    await prisma.unit.findFirstOrThrow({ where: { nameNormalized: 'litro', companyId: null }, select: { id: true } })
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

  for (const key of ['a', 'b', 'c'] as const) recipeIds.set(key, await seedInsumo(key, adminUserId));
});

/** Borra todo lo de las empresas dadas, en el orden de las FK. Sigue aunque un paso falle. */
async function dropCompanies(ids: readonly string[]): Promise<void> {
  const where = { companyId: { in: [...ids] } };
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    () => prisma.reservationMovement.deleteMany({ where }),
    () => prisma.inventoryMovement.deleteMany({ where }),
    () => prisma.orderAssignment.deleteMany({ where }),
    () => prisma.orderPresentationLine.deleteMany({ where }),
    () => deleteOrdersWithLines({ where }),
    () => prisma.productBatch.deleteMany({ where }),
    // La receta (`recipe_lines.product_id`) restringe el borrado del insumo.
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

/** En WebKit el refresco que deja un guardado anterior puede interrumpir la navegacion. */
async function gotoOrders(page: Page): Promise<void> {
  await expect(async () => {
    await page.goto(`${ORDERS_ROUTE}?pageSize=25`);
  }).toPass({ timeout: 60_000 });
  await expect(page.getByTestId('pedidos-title')).toBeVisible({ timeout: 60_000 });
}

function lineInput(key: RecipeKey) {
  return {
    recipe: { id: recipeIds.get(key)!, name: recipeName(key) },
    quantity: RECIPES[key].quantity,
    unitId: unitId!,
    packaging: { choice: { productId: packagingId!, name: PACKAGING_NAME }, packages: RECIPES[key].quantity },
    salePrice: RECIPES[key].salePrice,
  };
}

// El primer `goto` hace que `next dev` compile la ruta bajo demanda, y bcrypt tarda a proposito.
test.setTimeout(300_000);

test.describe('pedidos con varias recetas: alta, detalle, cancelar una receta y anadir otra', () => {
  test('R48 R7 R18 R21 R22 R28 R10 - dos recetas con precio, detalle con avance y totales, cancelar una libera su material y deja de sumar, y Editar anade otra', async ({
    page,
  }) => {
    expect(recipeIds.size, 'el fixture no existe: fallo el beforeAll').toBe(3);
    if (companyId === null || unitId === null) return;

    // --- 1. Alta de dos recetas con precio (R7).
    await loginAndLand(page, adminUser);
    await gotoOrders(page);
    const form = await openCreateOrderPanel(page);
    await addOrderLine(page, form, lineInput('a'));
    await addOrderLine(page, form, lineInput('b'));
    await expect(panelLines(form).nth(0)).toContainText(recipeName('a'));
    await expect(panelLines(form).nth(1)).toContainText(recipeName('b'));
    await expect(form.getByTestId(ORDER_LINES_TOTAL_TESTID)).toHaveText(money('350.5'));
    await saveOrder(page, form);
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Pedido creado.' })).toBeVisible({ timeout: 60_000 });

    const order = await prisma.order.findFirstOrThrow({
      where: { companyId, deletedAt: null },
      select: { id: true, status: true },
    });
    const lines = await prisma.orderLine.findMany({
      where: { orderId: order.id, deletedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true, recipeId: true, quantity: true, unitId: true, salePrice: true, status: true },
    });
    expect(lines.map((line) => [line.recipeId, line.quantity.toFixed(4), line.unitId, line.salePrice?.toFixed(4), line.status])).toEqual([
      [recipeIds.get('a'), '10.0000', unitId, '100.0000', 'PENDIENTE'],
      [recipeIds.get('b'), '20.0000', unitId, '250.5000', 'PENDIENTE'],
    ]);
    const [lineA, lineB] = lines;
    if (lineA === undefined || lineB === undefined) return;

    // Lo apartado al crear, receta a receta: su insumo y sus envases, nada de la otra.
    expect(await netReservedOf(lineA.id)).toEqual({ envase: '10.0000', insumo_a: '10.0000' });
    expect(await netReservedOf(lineB.id)).toEqual({ envase: '20.0000', insumo_b: '20.0000' });

    // --- 2. Listado: una fila, primera receta y «+1 más», avance 0 de 2, totales (R21, R22).
    const row = orderRow(page, order.id);
    await expect(row).toBeVisible({ timeout: 60_000 });
    await expect(row.getByTestId('order-recipes-first')).toHaveText(recipeName('a'));
    await expect(row.getByTestId('order-recipes-more')).toHaveText('+1 más');
    await expect(row.getByTestId('order-progress')).toHaveAttribute('data-total', '2');
    await expect(row.getByTestId('order-progress')).toHaveAttribute('data-finished', '0');
    await expect(row.getByTestId('order-sale-price')).toHaveText(money('350.5'));
    await expect(row.getByTestId('order-row-without-price')).toHaveCount(0);

    // --- 3. Detalle: avance y totales, una tarjeta por receta (R18).
    let detail = await openOrderDetail(page, order.id);
    const summary = detail.getByTestId(ORDER_DETAIL_SUMMARY_TESTID);
    await expect(summary.getByTestId('order-progress')).toContainText('0 de 2 terminadas');
    await expect(summary).toContainText(money('350.5'));
    await expect(detail.getByTestId(ORDER_DETAIL_LINE_TESTID)).toHaveCount(2);
    await expect(detail.locator(`[data-testid="${ORDER_DETAIL_LINE_TESTID}"][data-line-id="${lineA.id}"]`)).toContainText(money('100'));
    await expect(detail.locator(`[data-testid="${ORDER_DETAIL_LINE_TESTID}"][data-line-id="${lineB.id}"]`)).toContainText(money('250.5'));
    await closeWithEscape(page, detail);

    // --- 4. Cancelar la receta B con motivo (R28): solo ella, y su material queda libre.
    await cancelOrderLine(page, order.id, lineB.id, CANCEL_REASON);
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Receta cancelada.' })).toBeVisible({ timeout: 60_000 });

    const afterCancel = await prisma.orderLine.findMany({
      where: { orderId: order.id, deletedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true, status: true, cancellationReason: true },
    });
    expect(afterCancel.map((line) => [line.id, line.status, line.cancellationReason])).toEqual([
      [lineA.id, 'PENDIENTE', null],
      [lineB.id, 'CANCELADO', CANCEL_REASON],
    ]);
    expect(await netReservedOf(lineB.id)).toEqual({ envase: '0.0000', insumo_b: '0.0000' });
    expect(await kindsOf(lineB.id)).toContain('release');
    expect(await netReservedOf(lineA.id)).toEqual({ envase: '10.0000', insumo_a: '10.0000' });

    // Deja de sumar: el avance cuenta solo la activa y el total es el de A.
    await expect(row.getByTestId('order-progress')).toHaveAttribute('data-total', '1', { timeout: 60_000 });
    await expect(row.getByTestId('order-sale-price')).toHaveText(money('100'));
    detail = await openOrderDetail(page, order.id);
    await expect(detail.getByTestId(ORDER_DETAIL_SUMMARY_TESTID).getByTestId('order-progress')).toContainText('0 de 1 terminadas');
    await expect(detail.getByTestId(ORDER_DETAIL_SUMMARY_TESTID)).toContainText(money('100'));
    await expect(detail.locator(`[data-testid="${ORDER_DETAIL_LINE_TESTID}"][data-line-id="${lineB.id}"]`)).toContainText(
      `Motivo de cancelación: ${CANCEL_REASON}`,
    );
    await closeWithEscape(page, detail);

    // --- 5. Editar: B sale en solo lectura y se anade C (R10, R7).
    const editForm = await openEditOrderPanel(page, order.id);
    const cancelledRow = panelLine(editForm, recipeName('b'));
    await expect(cancelledRow.getByTestId(ORDER_LINES_READ_ONLY_TESTID)).toBeVisible();
    await expect(cancelledRow.getByTestId(ORDER_LINES_EDIT_TESTID)).toHaveCount(0);
    await expect(editForm.getByTestId(ORDER_LINES_TOTAL_TESTID)).toHaveText(money('100'));
    await addOrderLine(page, editForm, lineInput('c'));
    await expect(editForm.getByTestId(ORDER_LINES_TOTAL_TESTID)).toHaveText(money('140'));
    await saveOrder(page, editForm);
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Pedido actualizado.' })).toBeVisible({ timeout: 60_000 });

    const afterEdit = await prisma.orderLine.findMany({
      where: { orderId: order.id, deletedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true, recipeId: true, status: true, salePrice: true },
    });
    expect(afterEdit.map((line) => [line.recipeId, line.status, line.salePrice?.toFixed(4)])).toEqual([
      [recipeIds.get('a'), 'PENDIENTE', '100.0000'],
      [recipeIds.get('b'), 'CANCELADO', '250.5000'],
      [recipeIds.get('c'), 'PENDIENTE', '40.0000'],
    ]);
    const lineC = afterEdit[2];
    if (lineC === undefined) return;
    expect([afterEdit[0]?.id, afterEdit[1]?.id]).toEqual([lineA.id, lineB.id]);
    expect(await netReservedOf(lineC.id)).toEqual({ envase: '5.0000', insumo_c: '5.0000' });
    expect(await netReservedOf(lineA.id)).toEqual({ envase: '10.0000', insumo_a: '10.0000' });
    expect(await netReservedOf(lineB.id)).toEqual({ envase: '0.0000', insumo_b: '0.0000' });

    await expect(row.getByTestId('order-recipes-more')).toHaveText('+2 más', { timeout: 60_000 });
    await expect(row.getByTestId('order-progress')).toHaveAttribute('data-total', '2');
    await expect(row.getByTestId('order-sale-price')).toHaveText(money('140'));
  });
});
