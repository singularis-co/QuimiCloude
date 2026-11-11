/**
 * E2E de un pedido de DOS recetas por planta de punta a punta (QT-315 R33): cada receta avanza por
 * su lado y la otra no cambia de estado.
 *
 * 1. El Administrador da de alta el pedido por Pedidos, con dos recetas.
 * 2. El Operador fabrica la primera; la segunda sigue `PENDIENTE`.
 * 3. El Operador fabrica la segunda.
 * 4. El Empacador empaca y el Administrador de acondicionamiento acondiciona la primera; el
 *    Dashboard muestra la fila del pedido con «+1 más» y «1 de 2».
 * 5. Lo mismo con la segunda; el Dashboard pasa a «2 de 2».
 * 6. El Recorrido del pedido tiene dos secciones, una por receta, en su orden de alta.
 *
 * Un unico `test()`: cada paso es la precondicion del siguiente. Tras cada paso se lee el estado de
 * las dos recetas de la base.
 *
 * DATOS: el patron de la suite. Todo lleva el prefijo `qt315_e2e_` y el `RUN_ID` del worker, la
 * limpieza de huerfanos borra por prefijo Y POR EDAD, y `afterAll` borra siempre, en el orden de las
 * FK. La empresa, los usuarios, los insumos, el envase y las recetas se siembran por Prisma; el
 * pedido se crea, se fabrica, se empaca y se acondiciona por la pantalla.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Prisma } from '@prisma/client';

import {
  CONDITIONING_BATCH_DATA_SECTION_TESTID,
  CONDITIONING_BATCH_DATA_SUBMIT_TESTID,
  CONDITIONING_BATCH_DATA_TEXTS,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-batch-data-form';
import {
  CONDITIONING_FINISH_BUTTON_TESTID,
  CONDITIONING_START_BUTTON_TESTID,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-actions';
import {
  CONDITIONING_ORDER_SCREEN_TESTID,
  CONDITIONING_ORDER_STATUS_TESTID,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen';
import { CONDITIONING_TEAM_PERSON_TESTID } from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-team-picker';
import { CONDITIONING_WAIT_SECONDS } from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-wait';
import { FINISH_CONDITIONING_DIALOG_TESTID } from '@/app/(private)/asignacion/acondicionamiento/[id]/components/finish-conditioning-dialog';
import { START_CONDITIONING_DIALOG_TESTID } from '@/app/(private)/asignacion/acondicionamiento/[id]/components/start-conditioning-dialog';
import {
  PACKING_ORDER_FINISH_BUTTON_TESTID,
  PACKING_ORDER_START_BUTTON_TESTID,
} from '@/app/(private)/asignacion/empaque/[id]/components/packing-order-screen';
import {
  OTHER_RECIPE_TESTID,
  RECIPE_HEADER_EYEBROW_TESTID,
} from '@/app/(private)/asignacion/components/recipe-header';
import { recipeOfOrderText } from '@/app/(private)/asignacion/components/recipe-of-order-label';
import { EXECUTION_TRACE_RECIPE_SECTION_TESTID } from '@/app/(private)/dashboard/recorrido/[id]/components/execution-trace-recipe-section';
import { COUNTDOWN_GATED_BUTTON_TESTID } from '@/components/shared/countdown-gated-button';
import { ORDER_PROGRESS_TESTID, ORDER_PROGRESS_TEXTS } from '@/components/shared/order-progress';
import { RECIPES_FIRST_MORE_TEXTS } from '@/components/shared/recipes-first-more';
import {
  normalizeCompanyName,
  ROLE_ACONDICIONAMIENTO,
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
  CONDITIONED_ORDER_PARAM,
  DASHBOARD_ROUTE,
  MANUFACTURED_ORDER_PARAM,
  ORDERS_ROUTE,
  PACKED_ORDER_PARAM,
  assignedOrderRoute,
  conditioningOrderRoute,
  executionTraceRoute,
  packingOrderRoute,
} from '@/lib/shared/routes';

import { enableAllAddons } from './helpers/addons';
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
import { deleteCompanyNotifications } from './helpers/notifications';
import { addOrderLine, openCreateOrderPanel, panelLines, saveOrder } from './helpers/order-form';
import { seedPackaging } from './helpers/packaging';
import { pathOf } from './helpers/recipe-route';

const FIXTURE_PREFIX = 'qt315_e2e_';

const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit pueden correr a la vez, y puede haber otro worktree corriendo su propio E2E. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;

/** Nunca la empresa de instalacion: `companies_name_unique` es GLOBAL. */
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const PRESENTATION_NAME = `${SHARED_TOKEN}_bidon`;
const PACKAGING_NAME = `${SHARED_TOKEN}_envase`;
const PACKAGING_LOT = `${SHARED_TOKEN}_le`;

type RecipeKey = 'a' | 'b';
const RECIPE_KEYS: readonly RecipeKey[] = ['a', 'b'];

/** Una receta por insumo; los envases de contenido 1 cubren la cantidad entera, sin sobrante. */
const QUANTITIES: Readonly<Record<RecipeKey, string>> = { a: '10', b: '20' };

const INSUMO_STOCK = '50';
const INSUMO_UNIT_COST = '2.0000';
const PACKAGING_STOCK = '100';
const PACKAGING_UNIT_COST = '0.5000';
const PRESENTATION_CONTENT = '1';

const recipeName = (key: RecipeKey): string => `${SHARED_TOKEN}_receta_${key}`;
const insumoName = (key: RecipeKey): string => `${SHARED_TOKEN}_insumo_${key}`;

/** Un paso con un unico punto de control: Finalizar exige marcarlo. */
const recipeSteps = (key: RecipeKey): readonly RecipeStepDocument[] => [
  { blocks: [{ kind: 'checklist', items: [{ spans: [{ text: `${SHARED_TOKEN}_verificar_${key}` }] }] }] },
];

const EXECUTION_TITLE_TESTID = 'order-execution-title';
const STEP_CHECKLIST_ITEM_TESTID = 'step-reader-item-0-0';
const STEP_FINISH_TESTID = 'step-reader-finish';
const ASIGNACION_TITLE_TESTID = 'asignacion-title';
const ENTER_TESTID = 'assigned-order-enter';

type Credentials = { readonly username: string; readonly password: string };

function credentials(suffix: string, label: string): Credentials {
  return { username: `${SHARED_TOKEN}_${suffix}`, password: `Qt315-${label}-${RUN_ID.slice(0, 12)}` };
}

const adminUser = credentials('admin', 'Admin');
/** Sin `pedidos.consultar`: solo asi `/asignacion` muestra «Mis asignados», con «Entrar». */
const operatorUser = credentials('operador', 'Operador');
const empacadorUser = credentials('empacador', 'Empacador');
const conditionerUser = credentials('acond', 'Acond');

let companyId: string | null = null;
let unitId: string | null = null;
let presentationId: string | null = null;
let packagingId: string | null = null;
let operatorUserId: string | null = null;
const recipeIds = new Map<RecipeKey, string>();

async function createUser(user: Credentials, roleId: string): Promise<string> {
  if (!companyId) throw new Error('la empresa del fixture no existe: fallo el beforeAll');
  const created = await createFixtureUser({
    data: {
      firstNames: `Qt315${RUN_ID.slice(0, 8)}`,
      lastNames: 'PlantaVariasRecetas',
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

async function seedRecipe(key: RecipeKey, createdBy: string): Promise<string> {
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
  const recipe = await prisma.recipe.create({
    data: {
      name: recipeName(key),
      nameNormalized: normalizeRecipeName(recipeName(key)),
      createdBy,
      companyId: companyId!,
      steps: recipeSteps(key) as unknown as Prisma.InputJsonValue,
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

  // Los roles nunca se crean aqui: `roles.name` es unico y sus permisos son el dato bajo prueba.
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
  // El Dashboard es un anadido: la empresa nace sin ninguno.
  await enableAllAddons(companyId);

  const adminUserId = await createUser(adminUser, await roleId(ROLE_ADMINISTRADOR));
  operatorUserId = await createUser(operatorUser, await roleId(ROLE_OPERADOR));
  await createUser(empacadorUser, await roleId(ROLE_EMPACADOR));
  await createUser(conditionerUser, await roleId(ROLE_ACONDICIONAMIENTO));

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

  packagingId = (
    await seedPackaging({
      companyId,
      name: PACKAGING_NAME,
      presentationId,
      stock: PACKAGING_STOCK,
      unitCost: PACKAGING_UNIT_COST,
      lot: PACKAGING_LOT,
      createdBy: adminUserId,
    })
  ).productId;

  for (const key of RECIPE_KEYS) recipeIds.set(key, await seedRecipe(key, adminUserId));
});

/** Borra todo lo de las empresas dadas, en el orden de las FK. Sigue aunque un paso falle. */
async function dropCompanies(ids: readonly string[]): Promise<void> {
  const where = { companyId: { in: [...ids] } };
  const recipeIdsOf = (await prisma.recipe.findMany({ where, select: { id: true } })).map((recipe) => recipe.id);
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    () => deleteCompanyNotifications(ids),
    () => prisma.orderExecutionEntry.deleteMany({ where }),
    () => prisma.orderConditioningTeamMember.deleteMany({ where }),
    () => prisma.reservationMovement.deleteMany({ where }),
    () => prisma.inventoryMovement.deleteMany({ where }),
    () => prisma.orderAssignment.deleteMany({ where }),
    () => prisma.orderPresentationLine.deleteMany({ where }),
    () => deleteOrdersWithLines({ where }),
    () => prisma.productBatch.deleteMany({ where }),
    // El producto terminado (`products.recipe_id`) restringe el borrado de la receta, y la receta
    // (`recipe_lines.product_id`) el del insumo.
    () => prisma.product.deleteMany({ where: { recipeId: { in: recipeIdsOf } } }),
    () => prisma.recipe.deleteMany({ where }),
    () => prisma.product.deleteMany({ where }),
    () => prisma.presentation.deleteMany({ where }),
    () => prisma.user.deleteMany({ where }),
    () => prisma.companyAddonOverride.deleteMany({ where }),
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

/** En WebKit el refresco que deja una accion anterior puede interrumpir la navegacion. */
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

/**
 * Espera a que React haya hidratado el nodo: lleva sus props de React. Sin esto, en WebKit un clic
 * o lo tecleado antes de hidratar se pierde sin error.
 */
async function waitForHydration(target: Locator): Promise<void> {
  await expect
    .poll(() => target.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps$'))), {
      timeout: 60_000,
    })
    .toBe(true);
}

type Line = { readonly key: RecipeKey; readonly id: string; readonly position: number };

/** El estado de las dos recetas, en su orden de alta. */
async function lineStatuses(lines: readonly Line[]): Promise<readonly string[]> {
  const rows = await prisma.orderLine.findMany({
    where: { id: { in: lines.map((line) => line.id) } },
    select: { id: true, status: true },
  });
  return lines.map((line) => rows.find((row) => row.id === line.id)?.status ?? 'FALTA');
}

/** El dia civil UTC desplazado `days`, como lo compara el caso de uso. */
function utcDay(days: number): string {
  const instant = new Date();
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

/** El Operador entra a la receta desde «Mis asignados», la comienza y la finaliza. */
async function manufacture(page: Page, orderId: string, line: Line, otherStatus: string): Promise<void> {
  await gotoSettled(page, ASSIGNED_ORDERS_ROUTE);
  await expect(page.getByTestId(ASIGNACION_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });
  // Una fila por receta: se entra por la de esta linea.
  const row = page.getByTestId(`data-table-row-${line.id}`);
  await expect(row).toBeVisible({ timeout: 60_000 });
  await enterAndStartAssignedOrder(page, row.getByTestId(ENTER_TESTID));
  await page.waitForURL((url) => url.pathname === pathOf(assignedOrderRoute(orderId, line.id)), { timeout: 60_000 });
  await expect(page.getByTestId(EXECUTION_TITLE_TESTID)).toHaveText(recipeName(line.key), { timeout: 60_000 });

  // R7: la cabecera dice que receta del pedido es; R8: la otra receta, con su estado.
  await expect(page.getByTestId(RECIPE_HEADER_EYEBROW_TESTID)).toContainText(
    recipeOfOrderText({ position: line.position, count: 2 }),
  );
  await expect(page.getByTestId(OTHER_RECIPE_TESTID)).toHaveAttribute('data-status', otherStatus);

  await page.getByTestId(STEP_CHECKLIST_ITEM_TESTID).click();
  await clickAndConfirm(page, page.getByTestId(STEP_FINISH_TESTID), ORDER_EXECUTION_FINISH_CONFIRM_TESTID);
  await page.waitForURL(
    (url) => url.pathname === ASSIGNED_ORDERS_ROUTE && url.searchParams.has(MANUFACTURED_ORDER_PARAM),
    { timeout: 60_000 },
  );
}

/** El Empacador comienza y termina el empaque de la receta. */
async function pack(page: Page, orderId: string, line: Line): Promise<void> {
  await gotoSettled(page, packingOrderRoute(orderId, line.id));
  await expect(page.getByTestId('packing-order-screen')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(RECIPE_HEADER_EYEBROW_TESTID)).toContainText(
    recipeOfOrderText({ position: line.position, count: 2 }),
  );
  await clickAndConfirm(page, page.getByTestId(PACKING_ORDER_START_BUTTON_TESTID), PACKING_ORDER_START_CONFIRM_TESTID);
  await expect(page.getByTestId(PACKING_ORDER_FINISH_BUTTON_TESTID)).toBeVisible({ timeout: 60_000 });
  await clickAndConfirm(page, page.getByTestId(PACKING_ORDER_FINISH_BUTTON_TESTID), PACKING_ORDER_FINISH_CONFIRM_TESTID);
  await page.waitForURL(
    (url) => url.pathname === ASSIGNED_ORDERS_ROUTE && url.searchParams.has(PACKED_ORDER_PARAM),
    { timeout: 60_000 },
  );
}

/** El acondicionador comienza con el Operador de equipo, guarda los datos de lote y termina. */
async function condition(page: Page, orderId: string, line: Line): Promise<void> {
  await gotoSettled(page, conditioningOrderRoute(orderId, line.id));
  const screen = page.getByTestId(CONDITIONING_ORDER_SCREEN_TESTID);
  await expect(screen).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(RECIPE_HEADER_EYEBROW_TESTID)).toContainText(
    recipeOfOrderText({ position: line.position, count: 2 }),
  );
  await expect(screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID)).toHaveAttribute('data-status', 'POR_ACONDICIONAR');

  const startButton = screen.getByTestId(CONDITIONING_START_BUTTON_TESTID);
  await waitForHydration(startButton);
  await startButton.click();
  const startDialog = page.getByTestId(START_CONDITIONING_DIALOG_TESTID);
  await expect(startDialog).toBeVisible({ timeout: 60_000 });
  const person = startDialog.locator(`[data-testid="${CONDITIONING_TEAM_PERSON_TESTID}"][data-user-id="${operatorUserId}"]`);
  await person.click();
  await expect(person).toHaveAttribute('aria-checked', 'true');
  const startConfirm = startDialog.getByTestId(COUNTDOWN_GATED_BUTTON_TESTID);
  await expect(startConfirm).toBeEnabled({ timeout: (CONDITIONING_WAIT_SECONDS + 10) * 1_000 });
  await startConfirm.click();
  await expect(startDialog).toHaveCount(0, { timeout: 60_000 });
  await expect(screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID)).toHaveAttribute(
    'data-status',
    'EN_ACONDICIONAMIENTO',
    { timeout: 60_000 },
  );

  const section = screen.getByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID);
  await expect(section).toBeVisible({ timeout: 60_000 });
  await waitForHydration(section.getByTestId(CONDITIONING_BATCH_DATA_SUBMIT_TESTID));
  const lot = section.getByLabel(CONDITIONING_BATCH_DATA_TEXTS.lot, { exact: true });
  const expiryDate = section.getByLabel(CONDITIONING_BATCH_DATA_TEXTS.expiryDate, { exact: true });
  const productionDate = section.getByLabel(CONDITIONING_BATCH_DATA_TEXTS.productionDate, { exact: true });
  await lot.fill(`L${line.key.toUpperCase()}-${RUN_ID.slice(0, 10)}`);
  await expiryDate.fill(utcDay(365));
  await productionDate.fill(utcDay(0));
  await expect(lot).toHaveValue(`L${line.key.toUpperCase()}-${RUN_ID.slice(0, 10)}`);
  await section.getByTestId(CONDITIONING_BATCH_DATA_SUBMIT_TESTID).click();
  await expect
    .poll(
      () => prisma.orderExecutionEntry.count({ where: { orderLineId: line.id, action: 'CONDITIONING_BATCH_SAVE' } }),
      { timeout: 60_000 },
    )
    .toBe(1);

  const finishButton = screen.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID);
  await expect(finishButton).toBeEnabled({ timeout: 60_000 });
  await finishButton.click();
  const finishDialog = page.getByTestId(FINISH_CONDITIONING_DIALOG_TESTID);
  await expect(finishDialog).toBeVisible({ timeout: 60_000 });
  const finishConfirm = finishDialog.getByTestId(COUNTDOWN_GATED_BUTTON_TESTID);
  await expect(finishConfirm).toBeEnabled({ timeout: (CONDITIONING_WAIT_SECONDS + 10) * 1_000 });
  await finishConfirm.click();
  await page.waitForURL(
    (url) => url.pathname === ASSIGNED_ORDERS_ROUTE && url.searchParams.has(CONDITIONED_ORDER_PARAM),
    { timeout: 60_000 },
  );
}

/** La fila del pedido en el Dashboard, dentro de su contenido (la `data-table` sale duplicada). */
async function dashboardRow(page: Page, orderId: string): Promise<Locator> {
  await gotoSettled(page, DASHBOARD_ROUTE);
  await expect(page.getByTestId('dashboard-title')).toBeVisible({ timeout: 60_000 });
  const content = page.getByTestId('dashboard-content');
  await expect(content.getByTestId('data-table')).toBeVisible({ timeout: 60_000 });
  const row = content.getByTestId(`data-table-row-${orderId}`);
  await expect(row).toBeVisible({ timeout: 60_000 });
  return row;
}

// El primer `goto` hace que `next dev` compile cada ruta bajo demanda, bcrypt tarda a proposito y
// cada acondicionamiento espera la cuenta atras de sus dos dialogos.
test.setTimeout(600_000);

test.describe('planta con varias recetas: un pedido de dos recetas de punta a punta', () => {
  test('QT-315 R33 R7 R8 R21 R25 - alta de dos recetas, se fabrica, empaca y acondiciona cada una por su lado sin mover la otra; el Dashboard pasa de «1 de 2» a «2 de 2» con «+1 más» y el Recorrido tiene dos secciones', async ({
    page,
  }) => {
    expect(recipeIds.size, 'el fixture no existe: fallo el beforeAll').toBe(2);
    if (companyId === null || unitId === null || packagingId === null || operatorUserId === null) return;

    // --- 1. Alta de un pedido de dos recetas por la pantalla de Pedidos.
    await loginAndLand(page, adminUser);
    await gotoSettled(page, `${ORDERS_ROUTE}?pageSize=25`);
    await expect(page.getByTestId('pedidos-title')).toBeVisible({ timeout: 60_000 });
    const form = await openCreateOrderPanel(page);
    for (const key of RECIPE_KEYS) {
      await addOrderLine(page, form, {
        recipe: { id: recipeIds.get(key)!, name: recipeName(key) },
        quantity: QUANTITIES[key],
        unitId,
        packaging: { choice: { productId: packagingId, name: PACKAGING_NAME }, packages: QUANTITIES[key] },
      });
    }
    await expect(panelLines(form)).toHaveCount(2);
    await saveOrder(page, form);

    const order = await expect
      .poll(() => prisma.order.count({ where: { companyId: companyId!, deletedAt: null } }), { timeout: 60_000 })
      .toBe(1)
      .then(() =>
        prisma.order.findFirstOrThrow({
          where: { companyId: companyId!, deletedAt: null },
          select: { id: true, orderYear: true, orderSequence: true },
        }),
      );
    const orderNumber = formatOrderNumber({ year: order.orderYear, sequence: order.orderSequence });
    const stored = await prisma.orderLine.findMany({
      where: { orderId: order.id, deletedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true, recipeId: true },
    });
    expect(stored.map((line) => line.recipeId)).toEqual([recipeIds.get('a'), recipeIds.get('b')]);
    const lines: readonly Line[] = stored.map((line, index) => ({ key: RECIPE_KEYS[index]!, id: line.id, position: index + 1 }));
    const [lineA, lineB] = lines as readonly [Line, Line];
    expect(await lineStatuses(lines)).toEqual(['PENDIENTE', 'PENDIENTE']);

    // --- 2. El Operador fabrica la primera; la segunda sigue PENDIENTE.
    await prisma.orderAssignment.create({ data: { orderId: order.id, userId: operatorUserId, companyId } });
    await switchUser(page, operatorUser);
    await manufacture(page, order.id, lineA, 'PENDIENTE');
    expect(await lineStatuses(lines)).toEqual(['POR_EMPACAR', 'PENDIENTE']);

    // --- 3. Fabrica la segunda; la primera sigue por empacar.
    await manufacture(page, order.id, lineB, 'POR_EMPACAR');
    expect(await lineStatuses(lines)).toEqual(['POR_EMPACAR', 'POR_EMPACAR']);

    // --- 4. La primera se empaca y se acondiciona; la segunda no se mueve.
    await switchUser(page, empacadorUser);
    await pack(page, order.id, lineA);
    expect(await lineStatuses(lines)).toEqual(['POR_ACONDICIONAR', 'POR_EMPACAR']);

    await switchUser(page, conditionerUser);
    await condition(page, order.id, lineA);
    expect(await lineStatuses(lines)).toEqual(['TERMINADO', 'POR_EMPACAR']);

    // --- 5. Dashboard (R21): una fila por pedido, la primera receta «+1 más» y «1 de 2».
    await switchUser(page, adminUser);
    let row = await dashboardRow(page, order.id);
    await expect(row.getByTestId('execution-trace-formula')).toHaveText(recipeName('a'));
    await expect(row.getByTestId('execution-trace-more-recipes')).toHaveText(RECIPES_FIRST_MORE_TEXTS.more(1));
    await expect(row.getByTestId(ORDER_PROGRESS_TESTID)).toContainText(ORDER_PROGRESS_TEXTS.short(1, 2));
    await expect(row.getByTestId(ORDER_PROGRESS_TESTID)).toHaveAttribute('data-finished', '1');

    // --- 6. La segunda se empaca y se acondiciona; la primera sigue terminada.
    await switchUser(page, empacadorUser);
    await pack(page, order.id, lineB);
    expect(await lineStatuses(lines)).toEqual(['TERMINADO', 'POR_ACONDICIONAR']);

    await switchUser(page, conditionerUser);
    await condition(page, order.id, lineB);
    expect(await lineStatuses(lines)).toEqual(['TERMINADO', 'TERMINADO']);

    // --- 7. Dashboard: «2 de 2», todavia con «+1 más».
    await switchUser(page, adminUser);
    row = await dashboardRow(page, order.id);
    await expect(row.getByTestId('execution-trace-more-recipes')).toHaveText(RECIPES_FIRST_MORE_TEXTS.more(1));
    await expect(row.getByTestId(ORDER_PROGRESS_TESTID)).toContainText(ORDER_PROGRESS_TEXTS.short(2, 2));
    await expect(row.getByTestId(ORDER_PROGRESS_TESTID)).toHaveAttribute('data-finished', '2');

    // --- 8. Recorrido (R25): resumen «2 de 2 terminadas» y una seccion por receta, en orden de alta.
    const response = await page.goto(executionTraceRoute(order.id));
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId('execution-trace-title')).toContainText(orderNumber, { timeout: 60_000 });
    await expect(page.getByTestId('execution-trace-summary').getByTestId(ORDER_PROGRESS_TESTID)).toContainText(
      ORDER_PROGRESS_TEXTS.long(2, 2),
    );
    const sections = page.getByTestId(EXECUTION_TRACE_RECIPE_SECTION_TESTID);
    await expect(sections).toHaveCount(2);
    for (const [index, line] of lines.entries()) {
      const section = sections.nth(index);
      await expect(section).toHaveAttribute('data-line-id', line.id);
      await expect(section).toHaveAttribute('data-status', 'TERMINADO');
      await expect(section.getByTestId('execution-trace-recipe-name')).toHaveText(recipeName(line.key));
    }
  });
});
