/**
 * E2E de los pasos de acondicionamiento (R39): el Administrador crea por el formulario una formula
 * con un paso del operador, uno de envasado y dos de acondicionamiento, el primero con «Asignación
 * requerida»; el Operario la ejecuta y el Empacador la empaca sin ver ningun paso de
 * acondicionamiento; el acondicionador pulsa «Acondicionar» con equipo, elige un responsable en el
 * primer paso, avanza, recarga y retoma en el segundo, completa los pasos, guarda los datos de lote y
 * termina; y el recorrido muestra el responsable del paso.
 *
 * UN SOLO `test()`: cada fase es la precondicion de la siguiente sobre el MISMO pedido. El pedido
 * recorre el camino real desde PENDIENTE: Terminar el empaque deja los lotes que «Datos de lote»
 * escribe.
 *
 * AISLAMIENTO: prefijo propio `qc299_e2e_` + `RUN_ID` por worker, empresa efimera y limpieza de
 * huerfanos por prefijo Y POR EDAD, porque Chromium y WebKit corren a la vez sobre la misma base.
 *
 * Los roles son los REALES del seed, nunca un fixture: sus permisos son el dato bajo prueba.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  CONDITIONING_BATCH_DATA_LOCKED_TESTID,
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
import {
  CONDITIONING_STEP_RESPONSIBLE_TESTID,
  CONDITIONING_STEP_RESPONSIBLES_COUNT_TESTID,
  CONDITIONING_STEP_RESPONSIBLES_TESTID,
  CONDITIONING_STEP_RESPONSIBLES_TEXTS,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-step-responsibles-picker';
import {
  CONDITIONING_STEPS_DONE_TESTID,
  CONDITIONING_STEPS_PANEL_TESTID,
  CONDITIONING_STEPS_RESUMED_TESTID,
  CONDITIONING_STEPS_TEXTS,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-steps-panel';
import { CONDITIONING_TEAM_PERSON_TESTID } from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-team-picker';
import { CONDITIONING_WAIT_SECONDS } from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-wait';
import { FINISH_CONDITIONING_DIALOG_TESTID } from '@/app/(private)/asignacion/acondicionamiento/[id]/components/finish-conditioning-dialog';
import { START_CONDITIONING_DIALOG_TESTID } from '@/app/(private)/asignacion/acondicionamiento/[id]/components/start-conditioning-dialog';
import { VIEW_PARAM } from '@/app/(private)/asignacion/components/assignment-view-params';
import {
  CONDITIONED_ORDER_NOTICE_TESTID,
  conditionedOrderNoticeText,
} from '@/app/(private)/asignacion/components/order-outcome-notice';
import { EXECUTION_ACTION_LABELS } from '@/app/(private)/dashboard/components/execution-trace-format';
import { COUNTDOWN_GATED_BUTTON_TESTID } from '@/components/shared/countdown-gated-button';
import {
  buildDisplayName,
  DOCUMENT_TYPE_CC,
  normalizeCompanyName,
  normalizeWorkGroupName,
  ROLE_ACONDICIONAMIENTO,
  ROLE_ADMINISTRADOR,
  ROLE_EMPACADOR,
  ROLE_OPERADOR,
} from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizePresentationName, normalizeProductName } from '@/lib/modules/inventario';
import { formatOrderNumber } from '@/lib/modules/pedidos';
import { prisma } from '@/lib/shared/db/prisma';
import {
  ASSIGNED_ORDERS_ROUTE,
  CONDITIONED_ORDER_PARAM,
  DELIVERED_ORDER_PARAM,
  FORMULAS_ROUTE,
  NEW_RECIPE_ROUTE,
  PACKED_ORDER_PARAM,
  assignedOrderRoute,
  conditioningOrderRoute,
  executionTraceRoute,
  packingOrderRoute,
} from '@/lib/shared/routes';

import {
  clickAndConfirm,
  enterAndStartAssignedOrder,
  ORDER_EXECUTION_FINISH_CONFIRM_TESTID,
  PACKING_ORDER_FINISH_CONFIRM_TESTID,
  PACKING_ORDER_START_CONFIRM_TESTID,
} from './helpers/confirm-dialog';
import { enableAllAddons } from './helpers/addons';
import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { seedPackaging } from './helpers/packaging';

const FIXTURE_PREFIX = 'qc299_e2e_';
const RUN_ID = randomUUID().replace(/-/g, '');
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;
const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;
const SHORT_ID = RUN_ID.slice(0, 8);

const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const RECIPE_NAME = `${SHARED_TOKEN}_receta`;
const WORK_GROUP_NAME = `${SHARED_TOKEN}_turno`;
const PRODUCT_NAME = `${SHARED_TOKEN}_producto`;
const PRESENTATION_NAME = `${SHARED_TOKEN}_presentacion`;
const BATCH_LOT = `${SHARED_TOKEN}_lote`;
const PACKAGING_NAME = `${SHARED_TOKEN}_envase`;
const PACKAGING_LOT = `${SHARED_TOKEN}_lote_envase`;
/** El lote que escribe «Datos de lote»: ningun otro lote de la empresa lo lleva. */
const FINAL_LOT = `qc299-${SHORT_ID}-final`;
const PACKAGING_STOCK = '10';
const PACKAGING_UNIT_COST = '0.5000';
const BATCH_STOCK = '100.0000';
const UNIT_COST = '10.0000';
const ORDER_QUANTITY = '3.0';
const PRESENTATION_CONTENT = '1';
const BASE_SEQUENCE = 900_000 + Math.floor(Math.random() * 90_000);

/** Ningun texto es subcadena de otro: cada «no aparece» mide un paso concreto. */
const OPERATOR_STEP_TEXT = `Operador mezcla en reactor ${SHORT_ID}`;
const PACKING_STEP_TEXT = `Envasado llenar bidones ${SHORT_ID}`;
const CONDITIONING_STEP_1_TEXT = `Acondicionar revisar etiquetas ${SHORT_ID}`;
const CONDITIONING_STEP_2_TEXT = `Acondicionar paletizar cajas ${SHORT_ID}`;
const CONDITIONING_TEXTS = [
  CONDITIONING_STEP_1_TEXT,
  CONDITIONING_STEP_2_TEXT,
  CONDITIONING_STEPS_TEXTS.title,
] as const;

type Credentials = { readonly username: string; readonly password: string };

function credentials(suffix: string, label: string): Credentials {
  return {
    username: `${SHARED_TOKEN}_${suffix}`,
    password: `Qc299-${label}-${RUN_ID.slice(0, 12)}`,
  };
}

const adminUser = credentials('admin', 'Admin');
const operatorUser = credentials('operador', 'Operador');
const empacadorUser = credentials('empacador', 'Empacador');
const conditionerUser = credentials('acond', 'Acond');

const ALL_USERS = [adminUser, operatorUser, empacadorUser, conditionerUser];

const LAST_NAMES_BY_USERNAME: Readonly<Record<string, string>> = {
  [adminUser.username]: 'Administra',
  [operatorUser.username]: 'Operador',
  [empacadorUser.username]: 'Empacador',
  [conditionerUser.username]: 'Acondiciona',
};
const firstNames = `Qc299${SHORT_ID}`;

function displayNameOf(user: Credentials): string {
  return buildDisplayName(firstNames, LAST_NAMES_BY_USERNAME[user.username]!, user.username);
}

const ASIGNACION_TITLE_TESTID = 'asignacion-title';
const ORDER_NUMBER_CELL_TESTID = 'data-table-cell-orderNumber';
const TABLE_ROW_TESTID_PREFIX = 'data-table-row-';
const ENTER_TESTID = 'assigned-order-enter';
const EXECUTION_TITLE_TESTID = 'order-execution-title';
const STEP_DOCUMENT_TESTID = 'step-reader-document';
const STEP_POSITION_TESTID = 'step-reader-position';
const STEP_BLOCKED_REASON_TESTID = 'step-reader-blocked-reason';
const STEP_NEXT_TESTID = 'step-reader-next';
const STEP_FINISH_TESTID = 'step-reader-finish';
const PACKING_ORDERS_SECTION_TESTID = 'packing-orders-list-section';
const ROW_ACTIONS_TESTID = 'assignment-row-actions';
const ROW_ENTER_TESTID = 'assignment-row-enter';
const PACKING_ORDER_SCREEN_TESTID = 'packing-order-screen';
const PACKING_ORDER_STEPS_TESTID = 'packing-order-steps';
const PACKING_ORDER_START_BUTTON_TESTID = 'packing-order-start-button';
const TRACE_TITLE_TESTID = 'execution-trace-title';
const TRACE_TIMELINE_TESTID = 'execution-trace-timeline';
const TRACE_STEP_TESTID = 'execution-trace-step';

/** El aviso del `<Toaster />` de sonner que monta el layout privado. */
const TOAST_SELECTOR = '[data-sonner-toast]';

/** La espera minima por paso del paso a paso. */
const STEP_WAIT_MS = 5_000;

let companyId: string | null = null;
let productId: string | null = null;
let presentationId: string | null = null;
let packagingProductId: string | null = null;
let operatorUserId: string | null = null;
let empacadorUserId: string | null = null;
let workGroupId: string | null = null;

function exactText(value: string): RegExp {
  return new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
}

function rowByNumber(page: Page, numberText: string): Locator {
  return page.locator(`[data-testid^="${TABLE_ROW_TESTID_PREFIX}"]`).filter({
    has: page.getByTestId(ORDER_NUMBER_CELL_TESTID).filter({ hasText: exactText(numberText) }),
  });
}

function packingRowByNumber(page: Page, numberText: string): Locator {
  return page
    .getByTestId(PACKING_ORDERS_SECTION_TESTID)
    .locator(`[data-testid^="${TABLE_ROW_TESTID_PREFIX}"]`)
    .filter({
      has: page.getByTestId(ORDER_NUMBER_CELL_TESTID).filter({ hasText: exactText(numberText) }),
    });
}

async function orderStatus(id: string): Promise<string> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id }, select: { status: true } });
  return order.status;
}

async function expectNoneOf(page: Page, texts: readonly string[]): Promise<void> {
  for (const text of texts) {
    await expect(page.getByText(text)).toHaveCount(0);
  }
}

async function createUser(user: Credentials, roleId: string): Promise<string> {
  if (!companyId) throw new Error('la empresa del fixture no existe: fallo el beforeAll');

  const created = await createFixtureUser({
    data: {
      firstNames,
      lastNames: LAST_NAMES_BY_USERNAME[user.username] ?? 'Fixture',
      birthDate: new Date('1990-01-01'),
      email: `${user.username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: user.username,
      username: user.username,
      passwordHash: await createPasswordHash(user.password),
      roleId,
      companyId,
      // La columna es `@default(pending)` y ese estado no entra por el login.
      accountStatus: 'active',
    },
    select: { id: true },
  });

  return created.id;
}

/** Borra lo de unas empresas del fixture, en el orden que imponen las FK RESTRICT. */
async function deleteCompanyData(companyIds: readonly string[]): Promise<unknown> {
  const ids = [...companyIds];
  const scope = { companyId: { in: ids } };
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    () => prisma.reservationMovement.deleteMany({ where: scope }),
    () => prisma.inventoryMovement.deleteMany({ where: scope }),
    () => prisma.orderAssignment.deleteMany({ where: scope }),
    () => prisma.orderExecutionEntry.deleteMany({ where: scope }),
    () => prisma.orderConditioningTeamMember.deleteMany({ where: scope }),
    () => prisma.orderPresentationLine.deleteMany({ where: scope }),
    () => prisma.order.deleteMany({ where: scope }),
    () => prisma.productBatch.deleteMany({ where: scope }),
    async () => {
      const recipes = await prisma.recipe.findMany({ where: scope, select: { id: true } });
      const recipeIds = recipes.map((recipe) => recipe.id);
      if (recipeIds.length === 0) return;
      await prisma.product.deleteMany({ where: { recipeId: { in: recipeIds } } });
    },
    () => prisma.recipe.deleteMany({ where: scope }),
    () => prisma.product.deleteMany({ where: scope }),
    () => prisma.presentation.deleteMany({ where: scope }),
    () => prisma.workGroupMember.deleteMany({ where: scope }),
    () => prisma.workGroup.deleteMany({ where: scope }),
    () => prisma.user.deleteMany({ where: scope }),
    () => prisma.company.deleteMany({ where: { id: { in: ids } } }),
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

/** El selector de producto busca en el servidor y pagina al llegar al final del scroll. */
async function selectProductByName(page: Page, testId: string, name: string): Promise<void> {
  const campo = page.getByTestId(testId);
  await campo.click();

  const option = page.getByTestId(`${testId}-option`).filter({ hasText: name });
  const popup = page.getByTestId(`${testId}-popup`);

  if ((await option.count()) === 0) {
    await campo.fill(name);
  }

  try {
    await option.first().waitFor({ state: 'visible', timeout: 30_000 });
  } catch {
    for (let intento = 0; intento < 10 && (await option.count()) === 0; intento += 1) {
      await popup.evaluate((lista) => {
        lista.scrollTop = lista.scrollHeight;
      });
      await page.waitForTimeout(500);
    }
    if ((await option.count()) === 0) {
      throw new Error(`producto "${name}" no aparecio en el selector`);
    }
  }

  await option.first().click();
}

/** WebKit hidrata tarde y la hidratacion repinta el campo vacio: se reintenta hasta que el valor queda. */
async function fillControlled(locator: Locator, value: string): Promise<void> {
  await expect
    .poll(
      async () => {
        await locator.fill(value);
        return locator.inputValue();
      },
      { timeout: 60_000 },
    )
    .toBe(value);
}

async function typeInEditor(page: Page, editable: Locator, text: string): Promise<void> {
  await expect(editable).toBeVisible({ timeout: 60_000 });
  await editable.click();
  await expect(editable).toBeFocused({ timeout: 60_000 });
  await page.keyboard.type(text);
}

/** El dia civil UTC desplazado `days`, como lo compara el caso de uso. */
function utcDay(days: number): string {
  const instant = new Date();
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

/**
 * Espera a que React haya hidratado el formulario: el nodo lleva sus props de React. Sin esto, en
 * WebKit lo tecleado antes de hidratar se pierde.
 */
async function waitForHydration(locator: Locator): Promise<void> {
  await expect
    .poll(() => locator.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps$'))), {
      timeout: 60_000,
    })
    .toBe(true);
}

test.beforeAll(async () => {
  const roles = new Map<string, string>();
  for (const roleName of [ROLE_OPERADOR, ROLE_EMPACADOR, ROLE_ADMINISTRADOR, ROLE_ACONDICIONAMIENTO]) {
    const role = await prisma.role.findUnique({ where: { name: roleName }, select: { id: true } });
    if (!role) {
      throw new Error(
        `falta el rol "${roleName}": este E2E no lo crea porque sus permisos son el dato bajo ` +
          'prueba. Siembra la base con `pnpm run db:seed` antes de correr `pnpm run e2e`.',
      );
    }
    roles.set(roleName, role.id);
  }

  // LIMPIEZA DEFENSIVA DE HUERFANOS, solo de empresas de este prefijo con mas de una hora.
  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  const orphanCompanies = await prisma.company.findMany({
    where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
    select: { id: true },
  });
  if (orphanCompanies.length > 0) {
    await deleteCompanyData(orphanCompanies.map((company) => company.id));
  }

  companyId = (
    await prisma.company.create({
      data: { name: COMPANY_NAME, nameNormalized: normalizeCompanyName(COMPANY_NAME) },
      select: { id: true },
    })
  ).id;
  // Sin add-ons el Administrador no tiene `dashboard.consultar` y el recorrido da 404.
  await enableAllAddons(companyId);

  await createUser(adminUser, roles.get(ROLE_ADMINISTRADOR)!);
  operatorUserId = await createUser(operatorUser, roles.get(ROLE_OPERADOR)!);
  empacadorUserId = await createUser(empacadorUser, roles.get(ROLE_EMPACADOR)!);
  await createUser(conditionerUser, roles.get(ROLE_ACONDICIONAMIENTO)!);

  const unit = await prisma.unit.findFirstOrThrow({
    where: { nameNormalized: 'litro', companyId: null },
    select: { id: true },
  });

  // `product_batches_check_unit` rechaza el lote si el producto no tiene ya unidad.
  productId = (
    await prisma.product.create({
      data: {
        name: PRODUCT_NAME,
        nameNormalized: normalizeProductName(PRODUCT_NAME),
        unitId: unit.id,
        stock: BATCH_STOCK,
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
        unitId: unit.id,
        content: PRESENTATION_CONTENT,
        companyId,
      },
      select: { id: true },
    })
  ).id;

  await prisma.productBatch.create({
    data: {
      productId,
      presentationId,
      companyId,
      stock: BATCH_STOCK,
      unitCost: UNIT_COST,
      lot: BATCH_LOT,
      purchaseDate: new Date('2026-01-01T00:00:00Z'),
      createdBy: operatorUserId,
    },
    select: { id: true },
  });

  const packaging = await seedPackaging({
    companyId,
    name: PACKAGING_NAME,
    presentationId,
    stock: PACKAGING_STOCK,
    unitCost: PACKAGING_UNIT_COST,
    lot: PACKAGING_LOT,
    createdBy: operatorUserId,
  });
  packagingProductId = packaging.productId;

  // El equipo del Operario: Finalizar asigna al Empacador.
  workGroupId = (
    await prisma.workGroup.create({
      data: {
        name: WORK_GROUP_NAME,
        nameNormalized: normalizeWorkGroupName(WORK_GROUP_NAME),
        companyId,
      },
      select: { id: true },
    })
  ).id;
  await prisma.workGroupMember.createMany({
    data: [
      { workGroupId, userId: operatorUserId, companyId },
      { workGroupId, userId: empacadorUserId, companyId },
    ],
  });
});

test.afterAll(async () => {
  // Solo la empresa de ESTE worker, nunca por `FIXTURE_PREFIX`: el otro proyecto sigue corriendo.
  const primerFallo = companyId === null ? undefined : await deleteCompanyData([companyId]);
  await prisma.user
    .deleteMany({ where: { username: { in: ALL_USERS.map((user) => user.username) } } })
    .catch(() => undefined);
  await prisma.$disconnect();
  if (primerFallo !== undefined) throw primerFallo;
});

// `next dev` compila cada ruta en el primer `goto`, bcrypt tarda a proposito y hay varias esperas
// reales de 5 s (pasos y modales).
test.setTimeout(420_000);

test.describe('pasos de acondicionamiento de punta a punta (R39)', () => {
  test('R39: el Administrador crea la formula con pasos de acondicionamiento y uno con Asignación requerida, el operador y el empacador no los ven, el acondicionador los recorre con un responsable, recarga y retoma, completa, guarda los datos de lote y termina, y el recorrido muestra el responsable', async ({
    page,
  }) => {
    expect(companyId, 'el fixture no existe: fallo el beforeAll').not.toBeNull();
    if (
      companyId === null ||
      productId === null ||
      presentationId === null ||
      packagingProductId === null ||
      operatorUserId === null ||
      empacadorUserId === null ||
      workGroupId === null
    ) {
      return;
    }

    // --- 1. El Administrador crea la formula por el formulario.
    await loginAndLand(page, adminUser);
    await page.goto(NEW_RECIPE_ROUTE);
    await expect(page.getByTestId('recipe-form')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('recipe-conditioning-steps-field')).toBeVisible({ timeout: 60_000 });

    // El editor solo se monta en el cliente: verlo acredita que React ya hidrato.
    const operatorEditable = page.getByTestId('recipe-step-text-0');
    await expect(operatorEditable).toBeVisible({ timeout: 60_000 });

    await fillControlled(page.getByTestId('recipe-field-name'), RECIPE_NAME);
    await selectProductByName(page, 'recipe-line-product-0', PRODUCT_NAME);
    await fillControlled(page.getByTestId('recipe-line-percentage-0'), '100');

    await typeInEditor(page, operatorEditable, OPERATOR_STEP_TEXT);
    await typeInEditor(page, page.getByTestId('recipe-packing-step-text-0'), PACKING_STEP_TEXT);

    // Primer paso de acondicionamiento, con «Asignación requerida».
    await typeInEditor(page, page.getByTestId('recipe-conditioning-step-text-0'), CONDITIONING_STEP_1_TEXT);
    const assignmentSwitch = page.getByTestId('recipe-conditioning-step-text-0-assignment');
    await expect(assignmentSwitch).toHaveAttribute('aria-checked', 'false');
    await assignmentSwitch.click();
    await expect(assignmentSwitch).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('recipe-conditioning-step-text-0-assignment-help')).toBeVisible();

    // Segundo paso de acondicionamiento: solo texto.
    await page.getByTestId('recipe-conditioning-step-add-0').click();
    await typeInEditor(page, page.getByTestId('recipe-conditioning-step-text-1'), CONDITIONING_STEP_2_TEXT);
    await expect(page.getByTestId('recipe-conditioning-step-text-1-assignment')).toHaveAttribute(
      'aria-checked',
      'false',
    );

    await page.getByTestId('recipe-form-submit').click();
    await page.waitForURL((url) => url.pathname === FORMULAS_ROUTE, { timeout: 60_000 });

    const saved = await prisma.recipe.findFirst({
      where: { name: RECIPE_NAME, deletedAt: null },
      select: { id: true, steps: true, packingSteps: true, conditioningSteps: true },
    });
    expect(saved, 'la receta deberia existir en la base tras guardar').not.toBeNull();
    if (!saved) return;
    expect(Array.isArray(saved.steps) ? saved.steps.length : -1).toBe(1);
    expect(Array.isArray(saved.packingSteps) ? saved.packingSteps.length : -1).toBe(1);
    const conditioningSteps = Array.isArray(saved.conditioningSteps) ? saved.conditioningSteps : [];
    expect(conditioningSteps).toHaveLength(2);
    expect((conditioningSteps[0] as { requiresAssignment?: unknown }).requiresAssignment).toBe(true);
    expect((conditioningSteps[1] as { requiresAssignment?: unknown }).requiresAssignment).toBeUndefined();

    // --- 2. El pedido de esa formula, asignado al Operario por el equipo que tambien trae al
    // Empacador.
    const year = new Date().getUTCFullYear();
    const unit = await prisma.unit.findFirstOrThrow({
      where: { nameNormalized: 'litro', companyId: null },
      select: { id: true },
    });
    const order = await prisma.order.create({
      data: {
        companyId,
        orderYear: year,
        orderSequence: BASE_SEQUENCE,
        recipeId: saved.id,
        quantity: ORDER_QUANTITY,
        unitId: unit.id,
        presentationLines: {
          create: [
            {
              companyId,
              presentationId,
              packages: Math.floor(Number(ORDER_QUANTITY) / Number(PRESENTATION_CONTENT)),
              presentationContent: PRESENTATION_CONTENT,
              packagingProductId,
            },
          ],
        },
        // PENDIENTE: solo asi Entrar pide la confirmacion de comenzar.
        status: 'PENDIENTE',
      },
      select: { id: true },
    });
    const orderId = order.id;
    const orderNumber = formatOrderNumber({ year, sequence: BASE_SEQUENCE });
    await prisma.orderAssignment.create({
      data: {
        orderId,
        userId: operatorUserId,
        companyId,
        workGroupId,
        workGroupName: WORK_GROUP_NAME,
      },
    });

    // --- 3. El Operario ejecuta el pedido: ve su paso y ninguno de acondicionamiento.
    await test.step('R39 - el operador no ve ningun paso de acondicionamiento', async () => {
      await page.context().clearCookies();
      await loginAndLand(page, operatorUser);
      await page.goto(ASSIGNED_ORDERS_ROUTE);
      await expect(page.getByTestId(ASIGNACION_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });

      const assignedRow = rowByNumber(page, orderNumber);
      await expect(assignedRow).toHaveCount(1, { timeout: 60_000 });
      await enterAndStartAssignedOrder(page, assignedRow.getByTestId(ENTER_TESTID));
      await page.waitForURL((url) => url.pathname === assignedOrderRoute(orderId), {
        timeout: 60_000,
      });
      await expect(page.getByTestId(EXECUTION_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });

      await expect(page.getByTestId(STEP_DOCUMENT_TESTID)).toContainText(OPERATOR_STEP_TEXT, {
        timeout: 60_000,
      });
      await expect(page.getByTestId(STEP_POSITION_TESTID)).toHaveText('Paso 1 de 1');
      await expectNoneOf(page, CONDITIONING_TEXTS);

      await clickAndConfirm(page, page.getByTestId(STEP_FINISH_TESTID), ORDER_EXECUTION_FINISH_CONFIRM_TESTID);
      await page.waitForURL(
        (url) => url.pathname === ASSIGNED_ORDERS_ROUTE && url.searchParams.has(DELIVERED_ORDER_PARAM),
        { timeout: 60_000 },
      );
      expect(await orderStatus(orderId)).toBe('POR_EMPACAR');
    });

    // --- 4. El Empacador lo empaca: ve su paso de envasado y ninguno de acondicionamiento.
    await test.step('R39 - el empacador no ve ningun paso de acondicionamiento', async () => {
      await page.context().clearCookies();
      await loginAndLand(page, empacadorUser);
      await page.goto(`${ASSIGNED_ORDERS_ROUTE}?${VIEW_PARAM}=por_empacar`);
      await expect(page.getByTestId(PACKING_ORDERS_SECTION_TESTID)).toBeVisible({ timeout: 60_000 });

      const packingRow = packingRowByNumber(page, orderNumber);
      await expect(packingRow).toHaveCount(1, { timeout: 60_000 });
      await packingRow.getByTestId(ROW_ACTIONS_TESTID).click();
      await page.getByTestId(ROW_ENTER_TESTID).click();
      await page.waitForURL((url) => url.pathname === packingOrderRoute(orderId), {
        timeout: 60_000,
      });
      await expect(page.getByTestId(PACKING_ORDER_SCREEN_TESTID)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId(PACKING_ORDER_START_BUTTON_TESTID)).toBeVisible({ timeout: 60_000 });
      await expectNoneOf(page, CONDITIONING_TEXTS);

      await clickAndConfirm(
        page,
        page.getByTestId(PACKING_ORDER_START_BUTTON_TESTID),
        PACKING_ORDER_START_CONFIRM_TESTID,
      );
      const steps = page.getByTestId(PACKING_ORDER_STEPS_TESTID);
      await expect(steps).toBeVisible({ timeout: 60_000 });
      await expect(steps.getByTestId(STEP_POSITION_TESTID)).toHaveText('Paso 1 de 1');
      await expect(steps.getByTestId(STEP_DOCUMENT_TESTID)).toContainText(PACKING_STEP_TEXT);
      await expectNoneOf(page, CONDITIONING_TEXTS);

      const finish = steps.getByTestId(STEP_FINISH_TESTID);
      await expect(finish).toBeEnabled({ timeout: STEP_WAIT_MS + 30_000 });
      await clickAndConfirm(page, finish, PACKING_ORDER_FINISH_CONFIRM_TESTID);
      await page.waitForURL(
        (url) => url.pathname === ASSIGNED_ORDERS_ROUTE && url.searchParams.has(PACKED_ORDER_PARAM),
        { timeout: 60_000 },
      );
      expect(await orderStatus(orderId)).toBe('POR_ACONDICIONAR');
    });

    // --- 5. El acondicionador pulsa «Acondicionar» con el Operador en el equipo.
    await page.context().clearCookies();
    await loginAndLand(page, conditionerUser);
    await page.goto(conditioningOrderRoute(orderId));
    const screen = page.getByTestId(CONDITIONING_ORDER_SCREEN_TESTID);
    await expect(screen).toBeVisible({ timeout: 60_000 });
    await expect(screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID)).toHaveAttribute(
      'data-status',
      'POR_ACONDICIONAR',
    );
    // Antes de comenzar no hay paso a paso.
    await expect(page.getByTestId(CONDITIONING_STEPS_PANEL_TESTID)).toHaveCount(0);
    await expectNoneOf(page, CONDITIONING_TEXTS);

    const startButton = screen.getByTestId(CONDITIONING_START_BUTTON_TESTID);
    const startDialog = page.getByTestId(START_CONDITIONING_DIALOG_TESTID);
    await expect(async () => {
      if ((await startDialog.count()) === 0) await startButton.click();
      await expect(startDialog).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });

    const teamPerson = startDialog.locator(
      `[data-testid="${CONDITIONING_TEAM_PERSON_TESTID}"][data-user-id="${operatorUserId}"]`,
    );
    await teamPerson.click();
    await expect(teamPerson).toHaveAttribute('aria-checked', 'true');
    const startConfirm = startDialog.getByTestId(COUNTDOWN_GATED_BUTTON_TESTID);
    await expect(startConfirm).toBeEnabled({ timeout: (CONDITIONING_WAIT_SECONDS + 10) * 1_000 });
    await startConfirm.click();
    await expect(startDialog).toHaveCount(0, { timeout: 60_000 });
    await expect(screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID)).toHaveAttribute(
      'data-status',
      'EN_ACONDICIONAMIENTO',
      { timeout: 60_000 },
    );

    // --- 6. El primer paso: pide responsable; sin elegirlo no se avanza.
    const panel = page.getByTestId(CONDITIONING_STEPS_PANEL_TESTID);
    await expect(panel).toBeVisible({ timeout: 60_000 });
    await expect(panel.getByTestId(STEP_POSITION_TESTID)).toHaveText('Paso 1 de 2');
    await expect(panel.getByTestId(STEP_DOCUMENT_TESTID)).toContainText(CONDITIONING_STEP_1_TEXT);
    await expect(page.getByText(CONDITIONING_STEP_2_TEXT)).toHaveCount(0);
    // La pantalla de acondicionamiento no muestra pasos del operador ni de envasado.
    await expectNoneOf(page, [OPERATOR_STEP_TEXT, PACKING_STEP_TEXT]);
    await expect(page.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toHaveCount(0);
    await expect(page.getByTestId(CONDITIONING_BATCH_DATA_LOCKED_TESTID)).toHaveText(
      exactText(CONDITIONING_BATCH_DATA_TEXTS.locked),
    );

    const picker = panel.getByTestId(CONDITIONING_STEP_RESPONSIBLES_TESTID);
    await expect(picker).toBeVisible();
    await expect(picker.getByTestId(CONDITIONING_STEP_RESPONSIBLES_COUNT_TESTID)).toHaveText(
      exactText(CONDITIONING_STEP_RESPONSIBLES_TEXTS.none),
    );
    const operatorChip = picker.locator(
      `[data-testid="${CONDITIONING_STEP_RESPONSIBLE_TESTID}"][data-user-id="${operatorUserId}"]`,
    );
    await expect(operatorChip).toContainText(displayNameOf(operatorUser));
    await expect(picker.getByTestId(CONDITIONING_STEP_RESPONSIBLE_TESTID).filter({
      hasText: CONDITIONING_STEP_RESPONSIBLES_TEXTS.self,
    })).toContainText(displayNameOf(conditionerUser));

    const next = panel.getByTestId(STEP_NEXT_TESTID);
    await expect(next).toBeDisabled();
    await expect(panel.getByTestId(STEP_BLOCKED_REASON_TESTID)).toHaveText(
      exactText(CONDITIONING_STEPS_TEXTS.missingResponsible),
      { timeout: STEP_WAIT_MS + 30_000 },
    );
    await expect(next).toBeDisabled();

    // --- 7. Elige al Operador y avanza: el servidor guarda el paso 1 con su responsable.
    await operatorChip.click();
    await expect(operatorChip).toHaveAttribute('aria-pressed', 'true');
    await expect(picker.getByTestId(CONDITIONING_STEP_RESPONSIBLES_COUNT_TESTID)).toHaveText(
      exactText(CONDITIONING_STEP_RESPONSIBLES_TEXTS.count(1)),
    );
    // El boton exige la espera de R20 ademas de los checks: el plazo por defecto (5 s) no basta.
    await expect(next).toBeEnabled({ timeout: STEP_WAIT_MS + 30_000 });
    await next.click();
    await expect(panel.getByTestId(STEP_POSITION_TESTID)).toHaveText('Paso 2 de 2');
    await expect(panel.getByTestId(STEP_DOCUMENT_TESTID)).toContainText(CONDITIONING_STEP_2_TEXT);

    await expect
      .poll(
        async () =>
          prisma.orderExecutionEntry.findMany({
            where: { orderId, action: 'CONDITIONING_STEP_ADVANCE' },
            select: { stepPosition: true, responsibleUserIds: true },
          }),
        { timeout: 60_000 },
      )
      .toEqual([{ stepPosition: 1, responsibleUserIds: [operatorUserId] }]);

    // --- 8. Recarga: retoma en el paso 2 con el aviso, y la tarjeta sigue bloqueada.
    await page.reload();
    await expect(screen).toBeVisible({ timeout: 60_000 });
    await expect(panel).toBeVisible({ timeout: 60_000 });
    await expect(panel.getByTestId(CONDITIONING_STEPS_RESUMED_TESTID)).toContainText(
      CONDITIONING_STEPS_TEXTS.resumedTitle,
    );
    await expect(panel.getByTestId(STEP_POSITION_TESTID)).toHaveText('Paso 2 de 2');
    await expect(panel.getByTestId(STEP_DOCUMENT_TESTID)).toContainText(CONDITIONING_STEP_2_TEXT);
    await expect(page.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toHaveCount(0);
    await expect(page.getByTestId(CONDITIONING_BATCH_DATA_LOCKED_TESTID)).toBeVisible();

    // --- 9. «Completar pasos» en el ultimo paso, tras su espera.
    const complete = panel.getByTestId(STEP_FINISH_TESTID);
    await expect(complete).toHaveText(new RegExp(`^\\s*${CONDITIONING_STEPS_TEXTS.complete}`));
    await expect(complete).toBeEnabled({ timeout: STEP_WAIT_MS + 30_000 });
    await waitForHydration(complete);
    await complete.click();
    await expect(panel.getByTestId(CONDITIONING_STEPS_DONE_TESTID)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId(CONDITIONING_BATCH_DATA_LOCKED_TESTID)).toHaveCount(0, {
      timeout: 60_000,
    });

    // --- 10. Guarda los datos de lote.
    const section = screen.getByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID);
    const submit = section.getByTestId(CONDITIONING_BATCH_DATA_SUBMIT_TESTID);
    await expect(submit).toBeEnabled({ timeout: 60_000 });
    await waitForHydration(submit);
    await section.getByLabel(CONDITIONING_BATCH_DATA_TEXTS.lot, { exact: true }).fill(FINAL_LOT);
    await section.getByLabel(CONDITIONING_BATCH_DATA_TEXTS.expiryDate, { exact: true }).fill(utcDay(365));
    await section.getByLabel(CONDITIONING_BATCH_DATA_TEXTS.productionDate, { exact: true }).fill(utcDay(0));
    await submit.click();
    await expect(
      page.locator(TOAST_SELECTOR).filter({ hasText: CONDITIONING_BATCH_DATA_TEXTS.saved }),
    ).toHaveCount(1, { timeout: 60_000 });

    // --- 11. «Terminar» con su confirmacion: aterriza en «Por acondicionar» con el aviso.
    const finishButton = screen.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID);
    await expect(finishButton).toBeEnabled({ timeout: 60_000 });
    await finishButton.click();
    const finishDialog = page.getByTestId(FINISH_CONDITIONING_DIALOG_TESTID);
    await expect(finishDialog).toBeVisible({ timeout: 60_000 });
    const confirm = finishDialog.getByTestId(COUNTDOWN_GATED_BUTTON_TESTID);
    await expect(confirm).toBeEnabled({ timeout: (CONDITIONING_WAIT_SECONDS + 10) * 1_000 });
    await confirm.click();

    await page.waitForURL(
      (url) =>
        url.pathname === ASSIGNED_ORDERS_ROUTE &&
        url.searchParams.get(VIEW_PARAM) === 'por_acondicionar' &&
        url.searchParams.get(CONDITIONED_ORDER_PARAM) === orderNumber,
      { timeout: 60_000 },
    );
    await expect(page.getByTestId(CONDITIONED_ORDER_NOTICE_TESTID)).toHaveText(
      exactText(conditionedOrderNoticeText(orderNumber)),
      { timeout: 60_000 },
    );
    expect(await orderStatus(orderId)).toBe('TERMINADO');

    // --- 12. El Administrador abre el recorrido: «Avanzar» del paso 1 con el Operador como
    // responsable, y «Completar pasos» del paso 2 sin linea de responsables.
    await test.step('R39 - el recorrido muestra el responsable del paso', async () => {
      await page.context().clearCookies();
      await loginAndLand(page, adminUser);
      await page.goto(executionTraceRoute(orderId));
      await expect(page.getByTestId(TRACE_TITLE_TESTID)).toContainText(orderNumber, { timeout: 60_000 });

      const steps = page.getByTestId(TRACE_TIMELINE_TESTID).getByTestId(TRACE_STEP_TESTID);
      const advance = steps.and(page.locator('[data-action="conditioning_step_advance"]'));
      await expect(advance).toHaveCount(1, { timeout: 60_000 });
      await expect(advance.getByTestId('execution-trace-step-action')).toHaveText(
        exactText(EXECUTION_ACTION_LABELS.conditioning_step_advance),
      );
      await expect(advance.getByTestId('execution-trace-step-position')).toHaveText(exactText('Paso 1'));
      const responsibles = advance.getByTestId('execution-trace-responsible');
      await expect(responsibles).toHaveCount(1);
      await expect(responsibles).toContainText(displayNameOf(operatorUser));

      const completeStep = steps.and(page.locator('[data-action="conditioning_steps_complete"]'));
      await expect(completeStep).toHaveCount(1);
      await expect(completeStep.getByTestId('execution-trace-step-position')).toHaveText(exactText('Paso 2'));
      await expect(completeStep.getByTestId('execution-trace-responsibles')).toHaveCount(0);
    });
  });
});
