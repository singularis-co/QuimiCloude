/**
 * E2E del acondicionamiento en el recorrido de ejecución.
 *
 * Recorre, con los roles REALES del seed, el flujo completo de un pedido «Por acondicionar»:
 *
 * 1. el Administrador de acondicionamiento lo comienza con un equipo de dos personas: una marcada
 *    suelta y otra que entra por un grupo de trabajo;
 * 2. guarda los datos de lote de las dos líneas y después los corrige;
 * 3. lo termina.
 *
 * Después el Administrador, en su propio contexto, abre el dashboard y comprueba:
 *
 * - el total de la fila, sin sufijo (todas las fases cerradas);
 * - que el miembro del equipo que no firma ninguna anotación no es opción del filtro y que
 *   filtrar por él encuentra el pedido;
 * - en el detalle, las tres anotaciones nuevas en orden cronológico tras las de producción y
 *   empaque;
 * - que la foto del primer guardado conserva el lote original tras la corrección;
 * - las tres tarjetas de duración.
 *
 * EL PEDIDO SE SIEMBRA DIRECTAMENTE con `prisma`, ya «Por acondicionar», con su reparto, sus dos
 * productos terminados, sus dos lotes, sus asientos `production` y las anotaciones de producción y
 * empaque que dejan Arrancar…Finalizar y Comenzar/Terminar empaque (los recorridos que las escriben
 * los cubren `e2e/ejecucion-receta.spec.ts` y `e2e/empaque.spec.ts`). Esas anotaciones las firma una
 * tercera persona, para que ningún miembro del equipo firme nada.
 *
 * AISLAMIENTO: prefijo propio `qc283_e2e_` + `RUN_ID` por proceso de worker, empresa efímera
 * -`companies_name_unique` es GLOBAL- y limpieza de huérfanos por prefijo Y POR EDAD, porque
 * Chromium y WebKit corren a la vez sobre la misma base.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';

import {
  CONDITIONING_BATCH_DATA_LINE_TESTID,
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
  CONDITIONING_TEAM_GROUP_TESTID,
  CONDITIONING_TEAM_PERSON_TESTID,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-team-picker';
import { CONDITIONING_WAIT_SECONDS } from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-wait';
import { FINISH_CONDITIONING_DIALOG_TESTID } from '@/app/(private)/asignacion/acondicionamiento/[id]/components/finish-conditioning-dialog';
import { START_CONDITIONING_DIALOG_TESTID } from '@/app/(private)/asignacion/acondicionamiento/[id]/components/start-conditioning-dialog';
import { VIEW_PARAM } from '@/app/(private)/asignacion/components/assignment-view-params';
import { TRACE_ACTIONS_LABEL_PREFIX } from '@/app/(private)/dashboard/components/execution-trace-columns';
import {
  CONDITIONING_TEXTS,
  EXECUTION_ACTION_LABELS,
  PHASE_DURATION_LABELS,
  formatElapsed,
  formatElapsedMinutes,
  formatSnapshotDate,
} from '@/app/(private)/dashboard/components/execution-trace-format';
import { PERSON_PARAM } from '@/app/(private)/dashboard/components/execution-trace-list-params';
import { COUNTDOWN_GATED_BUTTON_TESTID } from '@/components/shared/countdown-gated-button';
import type { ExecutionAction, ExecutionPhase } from '@/lib/modules/asignaciones';
import {
  buildDisplayName,
  DOCUMENT_TYPE_CC,
  normalizeCompanyName,
  normalizeWorkGroupName,
  ROLE_ACONDICIONAMIENTO,
  ROLE_ADMINISTRADOR,
  ROLE_OPERADOR,
} from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizePresentationName, normalizeProductName, PRODUCT_TYPES } from '@/lib/modules/inventario';
import { formatOrderNumber } from '@/lib/modules/pedidos';
import { normalizeRecipeName } from '@/lib/modules/recetas';
import { prisma } from '@/lib/shared/db/prisma';
import { getInitials } from '@/lib/shared/ui/initials';
import {
  ASSIGNED_ORDERS_ROUTE,
  CONDITIONED_ORDER_PARAM,
  DASHBOARD_ROUTE,
  conditioningOrderRoute,
  executionTraceRoute,
} from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { openRowActionsMenuItem } from './helpers/row-actions-menu';

/** Prefijo con el que este spec marca TODO lo que crea. Nada fuera de él se toca. */
const FIXTURE_PREFIX = 'qc283_e2e_';

/** Identificador único de este proceso de worker. */
const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit corren a la vez: la limpieza defensiva no puede borrar por prefijo a secas. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;

/** Nunca la empresa de instalación: `companies_name_unique` es GLOBAL. */
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const RECIPE_NAME = `${SHARED_TOKEN}_receta`;
const WORK_GROUP_NAME = `${SHARED_TOKEN}_grupo`;

/** Las dos líneas del reparto, cada una con su presentación y su lote de producción. */
const PRESENTATION_1_NAME = `${SHARED_TOKEN}_pres1`;
const PRESENTATION_2_NAME = `${SHARED_TOKEN}_pres2`;
const PRESENTATION_CONTENT = '1';
const LINE_1_PACKAGES = 2;
const LINE_2_PACKAGES = 3;
const ORDER_QUANTITY = String(LINE_1_PACKAGES + LINE_2_PACKAGES);
const FINISHED_UNIT_COST = '1.0000';

/** Los lotes del primer guardado y los de la corrección. */
const ORIGINAL_LOT_1 = `A1-${RUN_ID.slice(0, 12)}`;
const ORIGINAL_LOT_2 = `A2-${RUN_ID.slice(0, 12)}`;
const CORRECTED_LOT_1 = `B1-${RUN_ID.slice(0, 12)}`;
const CORRECTED_LOT_2 = `B2-${RUN_ID.slice(0, 12)}`;

/**
 * Las anotaciones sembradas de producción y empaque: diez minutos cada fase, sin pausas, para que
 * sus duraciones sean exactas. Terminan antes de que el recorrido comience el acondicionamiento.
 */
const MINUTE_MS = 60 * 1000;
const PRODUCTION_MS = 10 * MINUTE_MS;
const PACKING_MS = 10 * MINUTE_MS;

type Credentials = { readonly username: string; readonly password: string };

type SeedUser = Credentials & { readonly lastNames: string };

const firstNames = `Qc283${RUN_ID.slice(0, 8)}`;

function seedUser(suffix: string, label: string, lastNames: string): SeedUser {
  return {
    username: `${SHARED_TOKEN}_${suffix}`,
    password: `Qc283-${label}-${RUN_ID.slice(0, 12)}`,
    lastNames,
  };
}

/** Supervisor: comienza, guarda, corrige y termina. Firma las tres anotaciones nuevas. */
const conditionerUser = seedUser('acond', 'Acond', 'Supervisa');
/** Abre el dashboard al final (`dashboard.consultar`). Firma solo el pedido señuelo. */
const adminUser = seedUser('admin', 'Admin', 'Administra');
/** Firma la producción y el empaque del pedido: no está en el equipo. */
const producerUser = seedUser('produce', 'Produce', 'Produce');
/** Miembro del equipo marcado suelto. No firma nada. */
const directMemberUser = seedUser('directo', 'Directo', 'Directo');
/** Miembro del equipo que entra por el grupo. No firma nada: es el del filtro. */
const groupMemberUser = seedUser('grupo', 'Grupo', 'Engrupo');

const ALL_USERS = [conditionerUser, adminUser, producerUser, directMemberUser, groupMemberUser];

function displayNameOf(user: SeedUser): string {
  return buildDisplayName(firstNames, user.lastNames, user.username);
}

/**
 * Posición de la serie de este fixture. Alta y aleatoria para no chocar con
 * `orders_company_year_sequence_key` ni con el worker del otro navegador.
 */
const ORDER_SEQUENCE = 900_000 + Math.floor(Math.random() * 90_000);
const DECOY_SEQUENCE = ORDER_SEQUENCE + 1;

const TABLE_ROW_TESTID_PREFIX = 'data-table-row-';
const DASHBOARD_TITLE_TESTID = 'dashboard-title';
const TRACE_TITLE_TESTID = 'execution-trace-title';
const TRACE_LINK_TESTID = 'execution-trace-link';
const TRACE_STEP_TESTID = 'execution-trace-step';
const TRACE_DURATION_TESTID = 'execution-trace-duration';

/** Nombre visible del filtro de personas: la etiqueta de su columna (`execution-trace-columns`). */
const PERSON_FILTER_LABEL = 'Personas';
const ANNOTATIONS_LIST_NAME = 'Anotaciones';

/** El orden cronológico esperado del detalle: producción y empaque sembrados, y las tres nuevas. */
const EXPECTED_ACTIONS: readonly ExecutionAction[] = [
  'start',
  'finish',
  'pack_start',
  'pack_finish',
  'conditioning_start',
  'conditioning_batch_save',
  'conditioning_batch_save',
  'conditioning_finish',
];

const PHASES: readonly ExecutionPhase[] = ['production', 'packing', 'conditioning'];

let companyId: string | null = null;

type SeededLine = { readonly batchId: string; readonly presentationName: string };

type Seeded = {
  readonly orderId: string;
  readonly numberText: string;
  readonly decoyOrderId: string;
  readonly directMemberId: string;
  readonly groupMemberId: string;
  readonly workGroupId: string;
  readonly lines: readonly [SeededLine, SeededLine];
};
let fixture: Seeded | null = null;

/** Igualdad EXACTA de texto: un correlativo no puede casar con un prefijo suyo. */
function exactText(value: string): RegExp {
  return new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
}

function seeded(): Seeded {
  if (fixture === null) throw new Error('el fixture no existe: falló el beforeAll');
  return fixture;
}

/** El día civil UTC desplazado `days`, como lo compara el caso de uso. */
function utcDay(days: number): string {
  const instant = new Date();
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

async function createUser(user: SeedUser, roleId: string): Promise<string> {
  if (!companyId) throw new Error('la empresa del fixture no existe: falló el beforeAll');

  const created = await createFixtureUser({
    data: {
      firstNames,
      lastNames: user.lastNames,
      birthDate: new Date('1990-01-01'),
      email: `${user.username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: user.username,
      username: user.username,
      passwordHash: await createPasswordHash(user.password),
      roleId,
      companyId,
      // Explícito: la columna es `@default(pending)` y ese estado no entra por el login.
      accountStatus: 'active',
    },
    select: { id: true },
  });

  return created.id;
}

/** Borra lo de unas empresas del fixture, en el orden que imponen las FK RESTRICT. */
async function deleteCompanyData(companyIds: readonly string[]): Promise<unknown> {
  const ids = [...companyIds];
  // El registro, el equipo y los miembros de grupo no declaran `@relation`: sus FK compuestas van
  // a mano en la migración, así que se borran explícitamente antes que pedidos, grupos y personas.
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    () => prisma.orderExecutionEntry.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.orderConditioningTeamMember.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.inventoryMovement.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.productBatch.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.product.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.orderPresentationLine.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.order.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.recipe.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.presentation.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.workGroupMember.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.workGroup.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.user.deleteMany({ where: { companyId: { in: ids } } }),
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

type LineInput = { readonly lot: string; readonly expiryDate: string; readonly productionDate: string };

function lineBlock(section: Locator, batchId: string): Locator {
  return section.locator(`[data-testid="${CONDITIONING_BATCH_DATA_LINE_TESTID}"][data-batch-id="${batchId}"]`);
}

/** Los tres campos se localizan por su etiqueta visible. */
async function fillLine(block: Locator, input: LineInput): Promise<void> {
  const lot = block.getByLabel(CONDITIONING_BATCH_DATA_TEXTS.lot, { exact: true });
  const expiryDate = block.getByLabel(CONDITIONING_BATCH_DATA_TEXTS.expiryDate, { exact: true });
  const productionDate = block.getByLabel(CONDITIONING_BATCH_DATA_TEXTS.productionDate, { exact: true });
  await lot.fill(input.lot);
  await expiryDate.fill(input.expiryDate);
  await productionDate.fill(input.productionDate);
  await expect(lot).toHaveValue(input.lot);
  await expect(expiryDate).toHaveValue(input.expiryDate);
  await expect(productionDate).toHaveValue(input.productionDate);
}

async function conditioningEntries(orderId: string) {
  return prisma.orderExecutionEntry.findMany({
    where: {
      orderId,
      action: { in: ['CONDITIONING_START', 'CONDITIONING_BATCH_SAVE', 'CONDITIONING_FINISH'] },
    },
    orderBy: { occurredAt: 'asc' },
    select: { action: true, userId: true, occurredAt: true },
  });
}

/** Guarda el formulario y espera a que el registro tenga `expectedSaves` guardados anotados. */
async function saveBatchData(section: Locator, orderId: string, expectedSaves: number): Promise<void> {
  await section.getByTestId(CONDITIONING_BATCH_DATA_SUBMIT_TESTID).click();
  await expect
    .poll(
      async () =>
        (await conditioningEntries(orderId)).filter((entry) => entry.action === 'CONDITIONING_BATCH_SAVE').length,
      { timeout: 60_000 },
    )
    .toBe(expectedSaves);
}

/**
 * Las líneas de un guardado tal como se ven: la tabla en contenedores anchos o una tarjeta por línea
 * en los estrechos. Solo una de las dos variantes es visible.
 */
function visibleBatchLines(step: Locator): Locator {
  return step.locator(
    '[data-testid="execution-trace-batch-line"]:visible, [data-testid="execution-trace-batch-card"]:visible',
  );
}

async function expectSnapshot(
  step: Locator,
  expected: ReadonlyArray<{ readonly line: SeededLine; readonly input: LineInput }>,
): Promise<void> {
  await expect(step.getByTestId('execution-trace-batch-count')).toHaveText(
    exactText(`${expected.length} ${CONDITIONING_TEXTS.presentationMany}`),
  );
  await expect(step.getByText(CONDITIONING_TEXTS.snapshotNotice, { exact: true })).toBeVisible();
  const lines = visibleBatchLines(step);
  await expect(lines).toHaveCount(expected.length);
  for (const [index, { line, input }] of expected.entries()) {
    const shown = lines.nth(index);
    await expect(shown).toContainText(input.lot);
    await expect(shown).toContainText(line.presentationName);
    await expect(shown).toContainText(formatSnapshotDate(input.expiryDate));
    await expect(shown).toContainText(formatSnapshotDate(input.productionDate));
  }
}

/** En WebKit el refresco que deja una acción anterior puede interrumpir la navegación. */
async function gotoSettled(page: Page, url: string): Promise<void> {
  await expect(async () => {
    await page.goto(url);
  }).toPass({ timeout: 60_000 });
}

test.beforeAll(async () => {
  // Los roles nunca se crean aquí: `roles.name` es único y sus permisos son el dato bajo prueba.
  const roles = new Map<string, string>();
  for (const roleName of [ROLE_ACONDICIONAMIENTO, ROLE_ADMINISTRADOR, ROLE_OPERADOR]) {
    const role = await prisma.role.findUnique({ where: { name: roleName }, select: { id: true } });
    if (!role) {
      throw new Error(
        `falta el rol "${roleName}": este E2E no lo crea porque sus permisos son el dato bajo ` +
          'prueba. Siembra la base con `pnpm run db:seed` antes de correr `pnpm run e2e`.',
      );
    }
    roles.set(roleName, role.id);
  }

  // LIMPIEZA DEFENSIVA DE HUÉRFANOS, solo de empresas de este prefijo con más de una hora.
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

  await createUser(conditionerUser, roles.get(ROLE_ACONDICIONAMIENTO)!);
  const adminId = await createUser(adminUser, roles.get(ROLE_ADMINISTRADOR)!);
  const producerId = await createUser(producerUser, roles.get(ROLE_OPERADOR)!);
  const directMemberId = await createUser(directMemberUser, roles.get(ROLE_OPERADOR)!);
  const groupMemberId = await createUser(groupMemberUser, roles.get(ROLE_OPERADOR)!);

  // El grupo aporta una sola persona: el miembro que entra por grupo.
  const workGroupId = (
    await prisma.workGroup.create({
      data: {
        name: WORK_GROUP_NAME,
        nameNormalized: normalizeWorkGroupName(WORK_GROUP_NAME),
        companyId,
      },
      select: { id: true },
    })
  ).id;
  await prisma.workGroupMember.create({ data: { workGroupId, userId: groupMemberId, companyId } });

  // La unidad NO se crea: es una de las del catálogo arrancador.
  const unit = await prisma.unit.findFirstOrThrow({
    where: { nameNormalized: 'litro', companyId: null },
    select: { id: true },
  });

  async function createPresentation(name: string): Promise<string> {
    const presentation = await prisma.presentation.create({
      data: {
        name,
        nameNormalized: normalizePresentationName(name),
        unitId: unit.id,
        content: PRESENTATION_CONTENT,
        companyId: companyId!,
      },
      select: { id: true },
    });
    return presentation.id;
  }

  const presentation1Id = await createPresentation(PRESENTATION_1_NAME);
  const presentation2Id = await createPresentation(PRESENTATION_2_NAME);

  const recipeId = (
    await prisma.recipe.create({
      data: {
        name: RECIPE_NAME,
        nameNormalized: normalizeRecipeName(RECIPE_NAME),
        createdBy: adminId,
        companyId,
      },
      select: { id: true },
    })
  ).id;

  // Cumple los CHECK de `orders`: «Por acondicionar» lleva `packed_by` y aún no `conditioned_by`.
  const year = new Date().getUTCFullYear();
  const order = await prisma.order.create({
    data: {
      companyId,
      orderYear: year,
      orderSequence: ORDER_SEQUENCE,
      recipeId,
      quantity: ORDER_QUANTITY,
      unitId: unit.id,
      status: 'POR_ACONDICIONAR',
      packedBy: producerId,
      conditionedBy: null,
      finishedAt: null,
    },
    select: { id: true },
  });

  // El señuelo: otro pedido de la empresa que firma solo el Administrador. Filtrar por el miembro
  // del equipo no debe encontrarlo.
  const decoy = await prisma.order.create({
    data: {
      companyId,
      orderYear: year,
      orderSequence: DECOY_SEQUENCE,
      recipeId,
      quantity: ORDER_QUANTITY,
      unitId: unit.id,
      status: 'EN_CURSO',
    },
    select: { id: true },
  });

  // Producción y empaque, firmados por el productor, terminados hace un rato.
  const productionStart = Date.now() - 60 * MINUTE_MS;
  const packingStart = productionStart + PRODUCTION_MS + 5 * MINUTE_MS;
  await prisma.orderExecutionEntry.createMany({
    data: [
      { action: 'START' as const, stepPosition: 1, at: productionStart },
      { action: 'FINISH' as const, stepPosition: 1, at: productionStart + PRODUCTION_MS },
      { action: 'PACK_START' as const, stepPosition: null, at: packingStart },
      { action: 'PACK_FINISH' as const, stepPosition: null, at: packingStart + PACKING_MS },
    ].map((entry) => ({
      companyId: companyId!,
      orderId: order.id,
      userId: producerId,
      action: entry.action,
      stepPosition: entry.stepPosition,
      occurredAt: new Date(entry.at),
    })),
  });
  await prisma.orderExecutionEntry.create({
    data: {
      companyId,
      orderId: decoy.id,
      userId: adminId,
      action: 'START',
      stepPosition: 1,
      occurredAt: new Date(productionStart),
    },
  });

  /**
   * Una línea del reparto y lo que deja Terminar el empaque por ella: el producto terminado, su lote
   * automático sin vencimiento ni día de producción y el asiento `production` que los enlaza.
   */
  const lineCreatedAt = Date.now();
  async function seedLine(
    offset: number,
    presentationId: string,
    presentationName: string,
    packages: number,
    provisionalLot: string,
  ): Promise<SeededLine> {
    const line = await prisma.orderPresentationLine.create({
      data: {
        orderId: order.id,
        companyId: companyId!,
        presentationId,
        packages,
        presentationContent: PRESENTATION_CONTENT,
        // Dos inserciones con `createdAt` explícito: los bloques se pintan en orden de alta.
        createdAt: new Date(lineCreatedAt + offset * 1_000),
      },
      select: { id: true },
    });

    const productName = `${RECIPE_NAME} · ${presentationName}`;
    const stock = String(packages * Number(PRESENTATION_CONTENT));
    const product = await prisma.product.create({
      data: {
        name: productName,
        nameNormalized: normalizeProductName(productName),
        type: PRODUCT_TYPES.FINISHED_PRODUCT,
        unitId: unit.id,
        stock,
        recipeId,
        presentationId,
        companyId: companyId!,
      },
      select: { id: true },
    });
    const now = new Date();
    const batch = await prisma.productBatch.create({
      data: {
        productId: product.id,
        presentationId,
        companyId: companyId!,
        stock,
        unitCost: FINISHED_UNIT_COST,
        lot: provisionalLot,
        purchaseDate: new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`),
        packageContent: PRESENTATION_CONTENT,
        createdBy: producerId,
      },
      select: { id: true },
    });
    await prisma.inventoryMovement.create({
      data: {
        batchId: batch.id,
        kind: 'production',
        quantity: stock,
        reason: null,
        orderId: order.id,
        orderPresentationLineId: line.id,
        companyId: companyId!,
        createdBy: producerId,
      },
    });

    return { batchId: batch.id, presentationName };
  }

  const line1 = await seedLine(0, presentation1Id, PRESENTATION_1_NAME, LINE_1_PACKAGES, '1001');
  const line2 = await seedLine(1, presentation2Id, PRESENTATION_2_NAME, LINE_2_PACKAGES, '1002');

  fixture = {
    orderId: order.id,
    numberText: formatOrderNumber({ year, sequence: ORDER_SEQUENCE }),
    decoyOrderId: decoy.id,
    directMemberId,
    groupMemberId,
    workGroupId,
    lines: [line1, line2],
  };
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

/**
 * El Administrador, en su propio contexto, revisa el dashboard: el total de la fila, el filtro por
 * el miembro del equipo que no firma y el detalle del recorrido.
 */
async function expectAdminSeesTrace(
  browser: Browser,
  expected: {
    readonly conditioningMs: number;
    readonly original: ReadonlyArray<{ readonly line: SeededLine; readonly input: LineInput }>;
    readonly corrected: ReadonlyArray<{ readonly line: SeededLine; readonly input: LineInput }>;
  },
): Promise<void> {
  const { orderId, numberText, decoyOrderId, groupMemberId } = seeded();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await loginAndLand(page, adminUser);
    await gotoSettled(page, DASHBOARD_ROUTE);
    await expect(page.getByTestId(DASHBOARD_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });

    const row = page.getByTestId(`${TABLE_ROW_TESTID_PREFIX}${orderId}`);
    const decoyRow = page.getByTestId(`${TABLE_ROW_TESTID_PREFIX}${decoyOrderId}`);
    await expect(row).toHaveCount(1, { timeout: 60_000 });
    await expect(decoyRow).toHaveCount(1);

    await test.step('R26 - el total de la fila suma las tres fases, sin sufijo', async () => {
      const total = row.getByTestId(TRACE_DURATION_TESTID);
      await expect(total).toHaveAttribute('data-kind', 'closed');
      await expect(total).toHaveText(
        exactText(formatElapsedMinutes(PRODUCTION_MS + PACKING_MS + expected.conditioningMs)),
      );
    });

    await test.step('R30 R31 - filtrar por el miembro del equipo que no firma encuentra el pedido', async () => {
      await page.getByRole('button', { name: PERSON_FILTER_LABEL, exact: true }).click();
      await expect(page.getByRole('menuitemcheckbox', { name: displayNameOf(conditionerUser) })).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByRole('menuitemcheckbox', { name: displayNameOf(groupMemberUser) })).toHaveCount(0);
      await page.keyboard.press('Escape');

      await gotoSettled(page, `${DASHBOARD_ROUTE}?${new URLSearchParams({ [PERSON_PARAM]: groupMemberId })}`);
      await expect(page.getByTestId(DASHBOARD_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });
      await expect(row).toHaveCount(1, { timeout: 60_000 });
      await expect(decoyRow).toHaveCount(0);
    });

    // --- Abre el recorrido desde el menú de la fila.
    const trigger = row.getByRole('button', { name: `${TRACE_ACTIONS_LABEL_PREFIX}${numberText}` });
    await (await openRowActionsMenuItem(page, trigger, TRACE_LINK_TESTID)).click();
    await page.waitForURL((url) => url.pathname === executionTraceRoute(orderId), { timeout: 60_000 });
    await expect(page.getByTestId(TRACE_TITLE_TESTID)).toContainText(numberText, { timeout: 60_000 });

    const steps = page.getByRole('list', { name: ANNOTATIONS_LIST_NAME }).getByTestId(TRACE_STEP_TESTID);
    await expect(steps).toHaveCount(EXPECTED_ACTIONS.length);
    const actions = await steps.evaluateAll((items) => items.map((item) => item.getAttribute('data-action')));
    expect(actions).toEqual([...EXPECTED_ACTIONS]);

    const startStep = steps.nth(4);
    const firstSave = steps.nth(5);
    const correction = steps.nth(6);
    const finishStep = steps.nth(7);

    await test.step('R12 R13 - Comenzar muestra al supervisor y al equipo con su grupo', async () => {
      await expect(startStep.getByTestId('execution-trace-step-action')).toHaveText(
        exactText(EXECUTION_ACTION_LABELS.conditioning_start),
      );
      await expect(startStep.getByTestId('execution-trace-supervisor')).toContainText(CONDITIONING_TEXTS.supervisor);
      await expect(startStep.getByTestId('execution-trace-supervisor')).toContainText(displayNameOf(conditionerUser));
      const teamLabel = `${CONDITIONING_TEXTS.teamPrefix}2`;
      await expect(startStep.getByText(teamLabel, { exact: true })).toBeVisible();
      const members = startStep.getByRole('list', { name: teamLabel }).getByRole('listitem');
      await expect(members).toHaveCount(2);
      await expect(members.nth(0)).toContainText(displayNameOf(directMemberUser));
      await expect(members.nth(0).getByTestId('execution-trace-team-group')).toHaveCount(0);
      await expect(members.nth(1)).toContainText(displayNameOf(groupMemberUser));
      await expect(members.nth(1).getByTestId('execution-trace-team-group')).toContainText(WORK_GROUP_NAME);
    });

    await test.step('R5 R15 - la foto del primer guardado conserva el lote original', async () => {
      for (const save of [firstSave, correction]) {
        await expect(save.getByTestId('execution-trace-step-action')).toHaveText(
          exactText(EXECUTION_ACTION_LABELS.conditioning_batch_save),
        );
        await expect(save).toContainText(CONDITIONING_TEXTS.savedBy);
        await expect(save).toContainText(displayNameOf(conditionerUser));
      }
      await expectSnapshot(firstSave, expected.original);
      for (const { input } of expected.corrected) {
        await expect(visibleBatchLines(firstSave).filter({ hasText: input.lot })).toHaveCount(0);
      }
      await expectSnapshot(correction, expected.corrected);
      for (const { input } of expected.original) {
        await expect(visibleBatchLines(correction).filter({ hasText: input.lot })).toHaveCount(0);
      }
    });

    await test.step('R17 - Terminar muestra solo quién terminó', async () => {
      await expect(finishStep.getByTestId('execution-trace-step-action')).toHaveText(
        exactText(EXECUTION_ACTION_LABELS.conditioning_finish),
      );
      // El span de la persona lleva dentro el avatar (`aria-hidden`), cuyas iniciales forman parte
      // de su texto: se comprueban por separado y el span entero es «iniciales + nombre».
      const finisher = displayNameOf(conditionerUser);
      const finisherPerson = finishStep.getByTestId('execution-trace-step-person');
      await expect(finisherPerson.getByTestId('execution-trace-step-avatar')).toHaveText(
        exactText(getInitials(finisher)),
      );
      await expect(finisherPerson).toHaveText(exactText(`${getInitials(finisher)}${finisher}`));
      await expect(finishStep.getByTestId('execution-trace-team')).toHaveCount(0);
      await expect(finishStep.getByTestId('execution-trace-batch-save')).toHaveCount(0);
    });

    await test.step('R25 - las tres tarjetas de duración', async () => {
      const cards = page.getByTestId(TRACE_DURATION_TESTID);
      await expect(cards).toHaveCount(PHASES.length);
      const expectedMs: Readonly<Record<ExecutionPhase, number>> = {
        production: PRODUCTION_MS,
        packing: PACKING_MS,
        conditioning: expected.conditioningMs,
      };
      for (const [index, phase] of PHASES.entries()) {
        const card = cards.nth(index);
        await expect(card).toHaveAttribute('data-phase', phase);
        await expect(card).toHaveAttribute('data-kind', 'closed');
        await expect(card.getByText(PHASE_DURATION_LABELS[phase], { exact: true })).toBeVisible();
        await expect(card).toContainText(formatElapsed(expectedMs[phase]));
        await expect(card.getByTestId('execution-trace-phase-open')).toHaveCount(0);
        await expect(card.getByTestId('execution-trace-phase-unclosed')).toHaveCount(0);
      }
    });
  } finally {
    await context.close();
  }
}

// El primer `goto` hace que `next dev` compile cada ruta bajo demanda, bcrypt tarda a propósito, y
// los dos modales esperan sus segundos reales.
test.setTimeout(300_000);

test.describe('acondicionamiento en el recorrido (R36)', () => {
  test('R36 - el supervisor comienza con un equipo de dos (uno por grupo), guarda y corrige los datos de lote y termina; el Administrador ve en el dashboard el total sin sufijo, encuentra el pedido filtrando por el miembro que no firma, y en el detalle las tres anotaciones nuevas, la foto original del primer guardado y las tres duraciones', async ({
    page,
    browser,
  }) => {
    const { orderId, numberText, directMemberId, groupMemberId, workGroupId, lines } = seeded();
    const [line1, line2] = lines;

    // --- 1. Comenzar con un equipo de dos: uno suelto y otro por el grupo.
    await loginAndLand(page, conditionerUser);
    await gotoSettled(page, conditioningOrderRoute(orderId));
    const screen = page.getByTestId(CONDITIONING_ORDER_SCREEN_TESTID);
    await expect(screen).toBeVisible({ timeout: 60_000 });
    await expect(screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID)).toHaveAttribute(
      'data-status',
      'POR_ACONDICIONAR',
    );

    const startButton = screen.getByTestId(CONDITIONING_START_BUTTON_TESTID);
    await waitForHydration(startButton);
    await startButton.click();
    const startDialog = page.getByTestId(START_CONDITIONING_DIALOG_TESTID);
    await expect(startDialog).toBeVisible({ timeout: 60_000 });

    const personCheckbox = startDialog.locator(
      `[data-testid="${CONDITIONING_TEAM_PERSON_TESTID}"][data-user-id="${directMemberId}"]`,
    );
    const groupCheckbox = startDialog.locator(
      `[data-testid="${CONDITIONING_TEAM_GROUP_TESTID}"][data-work-group-id="${workGroupId}"]`,
    );
    await personCheckbox.click();
    await expect(personCheckbox).toHaveAttribute('aria-checked', 'true');
    await groupCheckbox.click();
    await expect(groupCheckbox).toHaveAttribute('aria-checked', 'true');

    const startConfirm = startDialog.getByTestId(COUNTDOWN_GATED_BUTTON_TESTID);
    await expect(startConfirm).toBeEnabled({ timeout: (CONDITIONING_WAIT_SECONDS + 10) * 1_000 });
    await startConfirm.click();
    await expect(startDialog).toHaveCount(0, { timeout: 60_000 });
    await expect(screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID)).toHaveAttribute(
      'data-status',
      'EN_ACONDICIONAMIENTO',
      { timeout: 60_000 },
    );

    const storedTeam = await prisma.orderConditioningTeamMember.findMany({
      where: { orderId },
      orderBy: { position: 'asc' },
      select: { userId: true, workGroupId: true },
    });
    expect(storedTeam).toEqual([
      { userId: directMemberId, workGroupId: null },
      { userId: groupMemberId, workGroupId },
    ]);

    // --- 2. Guarda las dos líneas y después las corrige.
    const section = screen.getByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID);
    await expect(section).toBeVisible({ timeout: 60_000 });
    await waitForHydration(section.getByTestId(CONDITIONING_BATCH_DATA_SUBMIT_TESTID));

    const today = utcDay(0);
    const nextYear = utcDay(365);
    const yesterday = utcDay(-1);
    const original1: LineInput = { lot: ORIGINAL_LOT_1, expiryDate: nextYear, productionDate: today };
    const original2: LineInput = { lot: ORIGINAL_LOT_2, expiryDate: nextYear, productionDate: today };
    const corrected1: LineInput = { lot: CORRECTED_LOT_1, expiryDate: utcDay(400), productionDate: yesterday };
    const corrected2: LineInput = { lot: CORRECTED_LOT_2, expiryDate: utcDay(400), productionDate: yesterday };

    await fillLine(lineBlock(section, line1.batchId), original1);
    await fillLine(lineBlock(section, line2.batchId), original2);
    await saveBatchData(section, orderId, 1);

    await fillLine(lineBlock(section, line1.batchId), corrected1);
    await fillLine(lineBlock(section, line2.batchId), corrected2);
    await saveBatchData(section, orderId, 2);

    // --- 3. Termina.
    const finishButton = screen.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID);
    await expect(finishButton).toBeEnabled({ timeout: 60_000 });
    await finishButton.click();
    const finishDialog = page.getByTestId(FINISH_CONDITIONING_DIALOG_TESTID);
    await expect(finishDialog).toBeVisible({ timeout: 60_000 });
    const finishConfirm = finishDialog.getByTestId(COUNTDOWN_GATED_BUTTON_TESTID);
    await expect(finishConfirm).toBeEnabled({ timeout: (CONDITIONING_WAIT_SECONDS + 10) * 1_000 });
    await finishConfirm.click();
    await page.waitForURL(
      (url) =>
        url.pathname === ASSIGNED_ORDERS_ROUTE &&
        url.searchParams.get(VIEW_PARAM) === 'por_acondicionar' &&
        url.searchParams.get(CONDITIONED_ORDER_PARAM) === numberText,
      { timeout: 60_000 },
    );

    // El registro tiene las tres anotaciones nuevas (cuatro filas), firmadas por el supervisor.
    const entries = await conditioningEntries(orderId);
    expect(entries.map((entry) => entry.action)).toEqual([
      'CONDITIONING_START',
      'CONDITIONING_BATCH_SAVE',
      'CONDITIONING_BATCH_SAVE',
      'CONDITIONING_FINISH',
    ]);
    expect(new Set(entries.map((entry) => entry.userId)).size).toBe(1);
    const conditioningMs = entries.at(-1)!.occurredAt.getTime() - entries[0]!.occurredAt.getTime();

    // --- 4. El Administrador lo revisa en el dashboard.
    await expectAdminSeesTrace(browser, {
      conditioningMs,
      original: [
        { line: line1, input: original1 },
        { line: line2, input: original2 },
      ],
      corrected: [
        { line: line1, input: corrected1 },
        { line: line2, input: corrected2 },
      ],
    });
  });
});
