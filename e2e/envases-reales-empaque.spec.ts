/**
 * E2E de los envases reales al terminar el empaque.
 *
 * Cada caso siembra su propio pedido `EN_EMPAQUE` del Empacador, con su reparto, sus envases y lo
 * que el pedido tiene apartado de ellos, y el Empacador lo termina por la pantalla con el diálogo
 * de conteo real:
 *
 *   1. Una línea con 1 envase menos (Rotura) y otra con 1 más (Conteo físico): una libera lo que
 *      sobra y la otra consume del libre; los lotes llevan `real × contenido` y el coste del pedido
 *      se reparte sobre lo envasado de verdad. La tab «Reparto» lo muestra.
 *   2. Una línea en 0: no nace su lote, su envase se libera entero y el acondicionamiento no la
 *      cuenta como línea sin datos de lote. La tab «Reparto» la marca «Sin lote».
 *   3. Un envase de más sin stock libre: el diálogo lo dice y no deja Terminar.
 *
 * El pedido se siembra ya `EN_EMPAQUE`: el recorrido de Finalizar y Comenzar lo cubren
 * `e2e/empaque.spec.ts` y `e2e/envases-del-pedido.spec.ts`. Los asertos de estado se leen de la base.
 *
 * AISLAMIENTO: prefijo `qc281_e2e_` + `RUN_ID` por worker, empresa efímera y limpieza de huérfanos
 * por prefijo Y POR EDAD, porque Chromium y WebKit pueden correr a la vez sobre la misma base.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID,
  CONDITIONING_ORDER_DISTRIBUTION_TESTID,
  CONDITIONING_ORDER_SCREEN_TESTID,
  CONDITIONING_ORDER_SCREEN_TEXTS,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen';
import { CONDITIONING_FINISH_BUTTON_TESTID } from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-actions';
import {
  PACKING_FINISH_BADGE_TESTID,
  PACKING_FINISH_COUNT_TESTID,
  PACKING_FINISH_DIALOG_TEXTS,
  PACKING_FINISH_GATE_TESTID,
  PACKING_FINISH_HELP_TESTID,
  PACKING_FINISH_INCREASE_TESTID,
  PACKING_FINISH_LINE_ERROR_TESTID,
  PACKING_FINISH_LINE_TESTID,
  PACKING_FINISH_REASON_OPTION_TESTID,
  PACKING_FINISH_REASON_TESTID,
} from '@/app/(private)/asignacion/empaque/[id]/components/packing-finish-dialog';
import { finishedProductTabHref } from '@/app/(private)/inventario/producto-terminado/[id]/components/finished-product-params';
import {
  DOCUMENT_TYPE_CC,
  normalizeCompanyName,
  ROLE_ACONDICIONAMIENTO,
  ROLE_ADMINISTRADOR,
  ROLE_EMPACADOR,
} from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import {
  deriveUnitCost,
  normalizePresentationName,
  normalizeProductName,
  PRODUCT_TYPES,
} from '@/lib/modules/inventario';
import { formatOrderNumber, type PackingDifferenceReason } from '@/lib/modules/pedidos';
import { normalizeRecipeName } from '@/lib/modules/recetas';
import { prisma } from '@/lib/shared/db/prisma';
import {
  ASSIGNED_ORDERS_ROUTE,
  PACKED_ORDER_PARAM,
  conditioningOrderRoute,
  packingOrderRoute,
} from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { batchStock, netReservedInBatch, seedPackaging } from './helpers/packaging';

const FIXTURE_PREFIX = 'qc281_e2e_';

const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit corren a la vez: la limpieza defensiva no puede borrar por prefijo a secas. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;

/** Nunca la empresa de instalación: `companies_name_unique` es GLOBAL. */
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const RECIPE_NAME = `${SHARED_TOKEN}_receta`;

/** Alta y aleatoria: no choca con `orders_company_year_sequence_key` ni con el otro navegador. */
const BASE_SEQUENCE = 900_000 + Math.floor(Math.random() * 90_000);

const ORDER_QUANTITY = '10';
const PACKAGING_UNIT_COST = 0.5;

const PACKING_SCREEN_TESTID = 'packing-order-screen';
const PACKING_FINISH_BUTTON_TESTID = 'packing-order-finish-button';
const PACKING_FINISH_DIALOG_TESTID = 'packing-order-finish-dialog';
const PACKING_FINISH_CONFIRM_TESTID = 'packing-order-finish-confirm';
const PACKING_FINISH_CANCEL_TESTID = `${PACKING_FINISH_DIALOG_TESTID}-cancel`;
const PACKED_NOTICE_TESTID = 'packed-order-notice';

const REPARTO_TESTID = 'finished-product-reparto';
const TABLE_ROW_TESTID_PREFIX = 'data-table-row-';
const DISTRIBUTION_PLAN_TESTID = 'finished-product-distribution-plan';
const DISTRIBUTION_PACKED_TESTID = 'finished-product-distribution-packed';
const DISTRIBUTION_DIFFERENCE_TESTID = 'finished-product-distribution-difference';
const DISTRIBUTION_REASON_TESTID = 'finished-product-distribution-reason';
const DISTRIBUTION_REASON_NOTE_TESTID = 'finished-product-distribution-reason-note';
const WITHOUT_BATCH_LABEL = 'Sin lote';
const MINUS_SIGN = '−';

const TEXTS = PACKING_FINISH_DIALOG_TEXTS;

type Credentials = { readonly username: string; readonly password: string };

function credentials(suffix: string, label: string): Credentials {
  return {
    username: `${SHARED_TOKEN}_${suffix}`,
    password: `Qc281-${label}-${RUN_ID.slice(0, 12)}`,
  };
}

const empacadorUser = credentials('empacador', 'Empacador');
const conditionerUser = credentials('acond', 'Acond');
const adminUser = credentials('admin', 'Admin');
const ALL_USERS = [empacadorUser, conditionerUser, adminUser];

const firstNames = `Qc281${RUN_ID.slice(0, 8)}`;

type Fixture = {
  readonly companyId: string;
  readonly recipeId: string;
  readonly unitId: string;
  readonly packerId: string;
  readonly conditionerId: string;
};
let fixture: Fixture | null = null;

function seeded(): Fixture {
  if (fixture === null) throw new Error('el fixture no existe: falló el beforeAll');
  return fixture;
}

function exactText(value: string): RegExp {
  return new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
}

async function createUser(companyId: string, user: Credentials, roleId: string, lastNames: string): Promise<string> {
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
    () => prisma.orderConditioningTeamMember.deleteMany({ where }),
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

type LineSpec = {
  readonly key: string;
  readonly content: string;
  readonly plan: number;
  readonly packagingStock: number;
};

type SeededLine = {
  readonly id: string;
  readonly presentationId: string;
  readonly packagingName: string;
  readonly packagingBatchId: string;
  readonly plan: number;
  readonly content: string;
};

type SeededOrder = {
  readonly id: string;
  readonly numberText: string;
  readonly lines: readonly SeededLine[];
};

/**
 * Un pedido `EN_EMPAQUE` del Empacador con una línea por `specs`: cada una con su presentación en
 * litros, su envase sembrado y el plan apartado de ese envase, como lo deja Comenzar.
 */
async function seedPackingOrder(
  offset: number,
  ingredientsCost: string,
  specs: readonly LineSpec[],
): Promise<SeededOrder> {
  const { companyId, recipeId, unitId, packerId } = seeded();
  const year = new Date().getUTCFullYear();
  const sequence = BASE_SEQUENCE + offset;
  const order = await prisma.order.create({
    data: {
      companyId,
      orderYear: year,
      orderSequence: sequence,
      recipeId,
      quantity: ORDER_QUANTITY,
      unitId,
      status: 'EN_EMPAQUE',
      packedBy: packerId,
      ingredientsCost,
      packagingCost: (specs.reduce((total, spec) => total + spec.plan, 0) * PACKAGING_UNIT_COST).toFixed(4),
    },
    select: { id: true },
  });

  const createdAt = Date.now();
  const lines: SeededLine[] = [];
  for (const [index, spec] of specs.entries()) {
    const presentationName = `${SHARED_TOKEN}_${spec.key}_pres`;
    const packagingName = `${SHARED_TOKEN}_${spec.key}_envase`;
    const presentation = await prisma.presentation.create({
      data: {
        name: presentationName,
        nameNormalized: normalizePresentationName(presentationName),
        unitId,
        content: spec.content,
        companyId,
      },
      select: { id: true },
    });
    const packaging = await seedPackaging({
      companyId,
      name: packagingName,
      presentationId: presentation.id,
      stock: String(spec.packagingStock),
      unitCost: PACKAGING_UNIT_COST.toFixed(4),
      lot: `${RUN_ID.slice(0, 16)}_${spec.key}`,
      createdBy: packerId,
    });
    const line = await prisma.orderPresentationLine.create({
      data: {
        orderId: order.id,
        companyId,
        presentationId: presentation.id,
        packages: spec.plan,
        presentationContent: spec.content,
        packagingProductId: packaging.productId,
        createdAt: new Date(createdAt + index * 1_000),
      },
      select: { id: true },
    });
    await prisma.reservationMovement.create({
      data: {
        companyId,
        orderId: order.id,
        batchId: packaging.batchId,
        kind: 'reserve',
        quantity: String(spec.plan),
        createdBy: packerId,
      },
    });
    lines.push({
      id: line.id,
      presentationId: presentation.id,
      packagingName,
      packagingBatchId: packaging.batchId,
      plan: spec.plan,
      content: spec.content,
    });
  }

  return { id: order.id, numberText: formatOrderNumber({ year, sequence }), lines };
}

async function switchUser(page: Page, user: Credentials): Promise<void> {
  await page.goto('about:blank');
  await page.context().clearCookies();
  await loginAndLand(page, user);
}

/** En WebKit un clic antes de hidratar se pierde sin error: se repite hasta que el diálogo aparece. */
async function openFinishDialog(page: Page, orderId: string): Promise<Locator> {
  await page.goto(packingOrderRoute(orderId));
  await expect(page.getByTestId(PACKING_SCREEN_TESTID)).toBeVisible({ timeout: 60_000 });
  const trigger = page.getByTestId(PACKING_FINISH_BUTTON_TESTID);
  const dialog = page.getByTestId(PACKING_FINISH_DIALOG_TESTID);
  await expect(async () => {
    if ((await dialog.count()) === 0) await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  return dialog;
}

function dialogLine(dialog: Locator, lineId: string): Locator {
  return dialog.locator(`[data-testid="${PACKING_FINISH_LINE_TESTID}"][data-line-id="${lineId}"]`);
}

async function chooseReason(page: Page, line: Locator, reason: PackingDifferenceReason): Promise<void> {
  await line.getByTestId(PACKING_FINISH_REASON_TESTID).click();
  // La lista de otra línea ya cerrada sigue en el DOM, oculta.
  await page
    .getByTestId(PACKING_FINISH_REASON_OPTION_TESTID)
    .filter({ visible: true, hasText: exactText(TEXTS.reasons[reason]) })
    .click();
  await expect(line.getByTestId(PACKING_FINISH_REASON_TESTID)).toContainText(TEXTS.reasons[reason]);
}

async function confirmFinish(page: Page, dialog: Locator, numberText: string): Promise<void> {
  await expect(dialog.getByTestId(PACKING_FINISH_GATE_TESTID)).toHaveText(exactText(''));
  await dialog.getByTestId(PACKING_FINISH_CONFIRM_TESTID).click();
  await page.waitForURL(
    (url) =>
      url.pathname === ASSIGNED_ORDERS_ROUTE && url.searchParams.get(PACKED_ORDER_PARAM) !== null,
    { timeout: 60_000 },
  );
  await expect(page.getByTestId(PACKED_NOTICE_TESTID)).toContainText(numberText, { timeout: 60_000 });
}

async function finishedBatchOf(orderId: string, presentationId: string) {
  return prisma.productBatch.findFirst({
    where: {
      companyId: seeded().companyId,
      presentationId,
      product: { type: PRODUCT_TYPES.FINISHED_PRODUCT },
      movements: { some: { kind: 'production', orderId } },
    },
    select: { stock: true, unitCost: true, packageContent: true, productId: true },
  });
}

/**
 * La fila de una línea del reparto en la tab «Reparto» del producto terminado. Se recarga hasta
 * verla: con dos workers, `next dev` puede servir la primera compilación de la ruta a medias.
 */
async function distributionRow(page: Page, productId: string, lineId: string): Promise<Locator> {
  const row = page
    .getByTestId(REPARTO_TESTID)
    .locator(`[data-testid="${TABLE_ROW_TESTID_PREFIX}${lineId}"]`);
  await expect(async () => {
    await page.goto(finishedProductTabHref(productId, 'reparto'));
    await expect(row).toBeVisible({ timeout: 20_000 });
  }).toPass({ timeout: 120_000 });
  return row;
}

test.beforeAll(async () => {
  const roles = new Map<string, string>();
  for (const roleName of [ROLE_EMPACADOR, ROLE_ACONDICIONAMIENTO, ROLE_ADMINISTRADOR]) {
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

  const packerId = await createUser(companyId, empacadorUser, roles.get(ROLE_EMPACADOR)!, 'Empacador');
  const conditionerId = await createUser(companyId, conditionerUser, roles.get(ROLE_ACONDICIONAMIENTO)!, 'Acondiciona');
  await createUser(companyId, adminUser, roles.get(ROLE_ADMINISTRADOR)!, 'Administra');

  const unit = await prisma.unit.findFirstOrThrow({
    where: { nameNormalized: 'litro', companyId: null },
    select: { id: true },
  });
  const recipeId = (
    await prisma.recipe.create({
      data: {
        name: RECIPE_NAME,
        nameNormalized: normalizeRecipeName(RECIPE_NAME),
        createdBy: packerId,
        companyId,
      },
      select: { id: true },
    })
  ).id;

  fixture = { companyId, recipeId, unitId: unit.id, packerId, conditionerId };
});

test.afterAll(async () => {
  const primerFallo = fixture === null ? undefined : await deleteCompanyData([fixture.companyId]);
  await prisma.user
    .deleteMany({ where: { username: { in: ALL_USERS.map((user) => user.username) } } })
    .catch(() => undefined);
  await prisma.$disconnect();
  if (primerFallo !== undefined) throw primerFallo;
});

// El primer `goto` hace que `next dev` compile cada ruta bajo demanda y bcrypt tarda a propósito.
test.setTimeout(300_000);

test.describe('envases reales al terminar el empaque', () => {
  test('R17, R18, R20, R21, R26, R27 - una línea con 1 envase menos (Rotura) libera lo apartado de más, otra con 1 más (Conteo físico) consume del libre, los lotes llevan real × contenido con el coste repartido sobre lo real, y «Reparto» muestra −1 y +1 con su motivo', async ({
    page,
  }) => {
    // Plan: 4 × 1 l + 6 × 0,5 l = 7 l. Real: 3 × 1 l + 7 × 0,5 l = 6,5 l.
    const cost = '70.0000';
    const order = await seedPackingOrder(0, cost, [
      { key: 'menos', content: '1', plan: 4, packagingStock: 10 },
      { key: 'mas', content: '0.5', plan: 6, packagingStock: 10 },
    ]);
    const [less, more] = order.lines as [SeededLine, SeededLine];

    await loginAndLand(page, empacadorUser);
    const dialog = await openFinishDialog(page, order.id);

    const lessRow = dialogLine(dialog, less.id);
    await expect(lessRow.getByTestId(PACKING_FINISH_COUNT_TESTID)).toHaveValue(String(less.plan));
    await lessRow.getByTestId(PACKING_FINISH_COUNT_TESTID).fill(String(less.plan - 1));
    await expect(lessRow.getByTestId(PACKING_FINISH_BADGE_TESTID)).toHaveText(exactText(`${MINUS_SIGN}1`));
    await chooseReason(page, lessRow, 'rotura');
    await expect(lessRow.getByTestId(PACKING_FINISH_HELP_TESTID)).toHaveText(exactText(TEXTS.releaseHelp(1)));

    const moreRow = dialogLine(dialog, more.id);
    await expect(moreRow.getByTestId(PACKING_FINISH_COUNT_TESTID)).toHaveValue(String(more.plan));
    await moreRow.getByTestId(PACKING_FINISH_INCREASE_TESTID).click();
    await expect(moreRow.getByTestId(PACKING_FINISH_BADGE_TESTID)).toHaveText(exactText('+1'));
    await chooseReason(page, moreRow, 'conteo_fisico');
    // Libre del envase: 10 de existencia − 6 apartados por este pedido.
    await expect(moreRow.getByTestId(PACKING_FINISH_HELP_TESTID)).toHaveText(exactText(TEXTS.takeHelp(1, 4)));

    await confirmFinish(page, dialog, order.numberText);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
    expect(after.status).toBe('POR_ACONDICIONAR');

    const savedLines = await prisma.orderPresentationLine.findMany({
      where: { orderId: order.id },
      select: { id: true, packages: true, packedPackages: true, packedReason: true },
    });
    expect(savedLines.find((line) => line.id === less.id)).toMatchObject({
      packages: 4,
      packedPackages: 3,
      packedReason: 'rotura',
    });
    expect(savedLines.find((line) => line.id === more.id)).toMatchObject({
      packages: 6,
      packedPackages: 7,
      packedReason: 'conteo_fisico',
    });

    expect(await batchStock(less.packagingBatchId)).toBe(10 - 3);
    expect(await netReservedInBatch(order.id, less.packagingBatchId)).toBe(0);
    const released = await prisma.reservationMovement.findMany({
      where: { orderId: order.id, batchId: less.packagingBatchId, kind: 'release' },
      select: { quantity: true },
    });
    expect(released.reduce((total, movement) => total + Number(movement.quantity), 0)).toBe(1);

    expect(await batchStock(more.packagingBatchId)).toBe(10 - 7);
    expect(await netReservedInBatch(order.id, more.packagingBatchId)).toBe(0);

    // El coste se divide entre lo envasado de verdad (6,5 l), no entre el plan (7 l).
    const expectedUnitCost = deriveUnitCost(cost, '6.5');
    expect(expectedUnitCost).not.toBeNull();
    expect(expectedUnitCost).not.toBe(deriveUnitCost(cost, '7'));
    const lessBatch = await finishedBatchOf(order.id, less.presentationId);
    const moreBatch = await finishedBatchOf(order.id, more.presentationId);
    expect(lessBatch, 'nace el lote de la línea con menos').not.toBeNull();
    expect(moreBatch, 'nace el lote de la línea con más').not.toBeNull();
    expect(lessBatch!.stock.equals('3')).toBe(true);
    expect(moreBatch!.stock.equals('3.5')).toBe(true);
    expect(lessBatch!.unitCost?.toFixed(4)).toBe(expectedUnitCost);
    expect(moreBatch!.unitCost?.toFixed(4)).toBe(expectedUnitCost);
    const lotsValue = lessBatch!.stock.mul(lessBatch!.unitCost!).add(moreBatch!.stock.mul(moreBatch!.unitCost!));
    expect(Math.abs(lotsValue.toNumber() - Number(cost))).toBeLessThan(0.01);

    await switchUser(page, adminUser);
    const lessDistribution = await distributionRow(page, lessBatch!.productId, less.id);
    await expect(lessDistribution.getByTestId(DISTRIBUTION_PLAN_TESTID)).toHaveText(exactText('4'));
    await expect(lessDistribution.getByTestId(DISTRIBUTION_PACKED_TESTID)).toHaveText(exactText('3'));
    await expect(lessDistribution.getByTestId(DISTRIBUTION_DIFFERENCE_TESTID)).toHaveText(exactText(`${MINUS_SIGN}1`));
    await expect(lessDistribution.getByTestId(DISTRIBUTION_REASON_TESTID)).toHaveText(exactText(TEXTS.reasons.rotura));

    const moreDistribution = await distributionRow(page, moreBatch!.productId, more.id);
    await expect(moreDistribution.getByTestId(DISTRIBUTION_PLAN_TESTID)).toHaveText(exactText('6'));
    await expect(moreDistribution.getByTestId(DISTRIBUTION_PACKED_TESTID)).toHaveText(exactText('7'));
    await expect(moreDistribution.getByTestId(DISTRIBUTION_DIFFERENCE_TESTID)).toHaveText(exactText('+1'));
    await expect(moreDistribution.getByTestId(DISTRIBUTION_REASON_TESTID)).toHaveText(
      exactText(TEXTS.reasons.conteo_fisico),
    );
  });

  test('R19, R20, R21, R23, R26, R27 - una línea en 0 no da de alta lote y libera su envase, el acondicionamiento no la cuenta como línea sin datos de lote, y «Reparto» la marca «Sin lote»', async ({
    page,
  }) => {
    const { companyId, recipeId, unitId, conditionerId } = seeded();
    // Plan: 2 × 1 l + 3 × 1 l = 5 l. Real: 0 + 3 × 1 l = 3 l.
    const cost = '50.0000';
    const order = await seedPackingOrder(1, cost, [
      { key: 'cero', content: '1', plan: 2, packagingStock: 5 },
      { key: 'igual', content: '1', plan: 3, packagingStock: 5 },
    ]);
    const [zero, same] = order.lines as [SeededLine, SeededLine];

    // La línea en 0 no crea el producto terminado: lo deja uno anterior de la misma combinación.
    const zeroProductName = `${RECIPE_NAME} · ${SHARED_TOKEN}_cero_pres`;
    const zeroProduct = await prisma.product.create({
      data: {
        name: zeroProductName,
        nameNormalized: normalizeProductName(zeroProductName),
        type: PRODUCT_TYPES.FINISHED_PRODUCT,
        unitId,
        stock: '0',
        recipeId,
        presentationId: zero.presentationId,
        companyId,
      },
      select: { id: true },
    });

    await loginAndLand(page, empacadorUser);
    const dialog = await openFinishDialog(page, order.id);
    const zeroRow = dialogLine(dialog, zero.id);
    await zeroRow.getByTestId(PACKING_FINISH_COUNT_TESTID).fill('0');
    await expect(zeroRow.getByTestId(PACKING_FINISH_BADGE_TESTID)).toHaveText(exactText(`${MINUS_SIGN}2`));
    await chooseReason(page, zeroRow, 'merma');
    await expect(zeroRow.getByTestId(PACKING_FINISH_HELP_TESTID)).toHaveText(exactText(TEXTS.zeroHelp(2)));
    await confirmFinish(page, dialog, order.numberText);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
    expect(after.status).toBe('POR_ACONDICIONAR');

    expect(await finishedBatchOf(order.id, zero.presentationId)).toBeNull();
    expect(await batchStock(zero.packagingBatchId)).toBe(5);
    expect(await netReservedInBatch(order.id, zero.packagingBatchId)).toBe(0);
    expect(await batchStock(same.packagingBatchId)).toBe(5 - 3);

    const sameBatch = await finishedBatchOf(order.id, same.presentationId);
    expect(sameBatch).not.toBeNull();
    expect(sameBatch!.stock.equals('3')).toBe(true);
    expect(sameBatch!.unitCost?.toFixed(4)).toBe(deriveUnitCost(cost, '3'));

    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'EN_ACONDICIONAMIENTO', conditionedBy: conditionerId },
    });
    await switchUser(page, conditionerUser);
    await page.goto(conditioningOrderRoute(order.id));
    const screen = page.getByTestId(CONDITIONING_ORDER_SCREEN_TESTID);
    await expect(screen).toBeVisible({ timeout: 60_000 });
    await expect(screen.getByTestId(CONDITIONING_ORDER_DISTRIBUTION_TESTID)).toContainText(
      `0 × ${zero.packagingName}`,
    );
    await expect(screen.getByTestId(CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID)).toHaveText(
      exactText(CONDITIONING_ORDER_SCREEN_TEXTS.batchDataMissing(1)),
    );

    const nextYear = new Date();
    nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1);
    await prisma.productBatch.updateMany({
      where: { companyId, presentationId: same.presentationId, product: { type: PRODUCT_TYPES.FINISHED_PRODUCT } },
      data: {
        lot: `${RUN_ID.slice(0, 16)}_real`,
        expiryDate: new Date(`${nextYear.toISOString().slice(0, 10)}T00:00:00Z`),
        productionDate: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`),
      },
    });
    await page.reload();
    await expect(screen).toBeVisible({ timeout: 60_000 });
    await expect(screen.getByTestId(CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID)).toHaveCount(0, {
      timeout: 60_000,
    });
    await expect(screen.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toBeEnabled({ timeout: 60_000 });

    await switchUser(page, adminUser);
    const zeroDistribution = await distributionRow(page, zeroProduct.id, zero.id);
    await expect(zeroDistribution.getByTestId(DISTRIBUTION_PACKED_TESTID)).toHaveText(exactText('0'));
    await expect(zeroDistribution.getByTestId(DISTRIBUTION_DIFFERENCE_TESTID)).toHaveText(exactText(`${MINUS_SIGN}2`));
    await expect(zeroDistribution.getByTestId(DISTRIBUTION_REASON_TESTID)).toContainText(TEXTS.reasons.merma);
    await expect(zeroDistribution.getByTestId(DISTRIBUTION_REASON_NOTE_TESTID)).toHaveText(
      exactText(WITHOUT_BATCH_LABEL),
    );
  });

  test('R9 - un envase de más sin stock libre del envase muestra «No alcanza el stock del envase…» y deja Terminar deshabilitado', async ({
    page,
  }) => {
    // Existencia 2, las 2 apartadas por este pedido: no queda ninguna libre.
    const order = await seedPackingOrder(2, '20.0000', [{ key: 'sinlibre', content: '1', plan: 2, packagingStock: 2 }]);
    const [line] = order.lines as [SeededLine];

    await loginAndLand(page, empacadorUser);
    const dialog = await openFinishDialog(page, order.id);
    const row = dialogLine(dialog, line.id);
    await row.getByTestId(PACKING_FINISH_INCREASE_TESTID).click();

    await expect(row.getByTestId(PACKING_FINISH_LINE_ERROR_TESTID)).toHaveText(
      exactText(TEXTS.stock(1, line.packagingName, 0)),
    );
    await expect(dialog.getByTestId(PACKING_FINISH_GATE_TESTID)).toHaveText(exactText(TEXTS.blocked));
    await expect(dialog.getByTestId(PACKING_FINISH_CONFIRM_TESTID)).toBeDisabled();

    await dialog.getByTestId(PACKING_FINISH_CANCEL_TESTID).click();
    await expect(dialog).toHaveCount(0, { timeout: 60_000 });

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
    expect(after.status).toBe('EN_EMPAQUE');
    const saved = await prisma.orderPresentationLine.findUniqueOrThrow({
      where: { id: line.id },
      select: { packedPackages: true },
    });
    expect(saved.packedPackages).toBeNull();
    expect(await batchStock(line.packagingBatchId)).toBe(2);
    expect(await netReservedInBatch(order.id, line.packagingBatchId)).toBe(2);
  });
});
