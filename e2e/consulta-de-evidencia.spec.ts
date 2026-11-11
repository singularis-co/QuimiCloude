/**
 * E2E de la consulta de evidencia por paso (QC-271, TI: R27 y R28; QT-316, R19 y R20).
 *
 * Tres casos, tres `test()`. Ninguno escribe en la base: todos leen el mismo fixture.
 *   - R27, Administrador: el recorrido del pedido pinta las fotos de fabricacion bajo la ULTIMA
 *     anotacion de su paso -que se repite- y las de envasado en la tarjeta «Envasado»; despues, la
 *     ficha del producto terminado de ese pedido muestra en Lotes el boton con el total y su
 *     dialogo, los grupos «Fabricacion» y «Envasado».
 *   - R28, Operador (sin `pedidos.consultar`): la misma ficha, en Lotes, sin la columna «Evidencia»
 *     y sin ninguna foto; el navegador no pide nada al almacenamiento.
 *   - R19 (QT-316), Administrador: un pedido de DOS recetas, cada una con su producto terminado y
 *     su lote. La ficha del producto A cuenta solo las fotos de su receta y su dialogo las muestra
 *     en «Fabricacion», «Envasado» y «Acondicionamiento» (R20), con la receta A en el titulo; la
 *     ficha del producto B, sin fotos en su receta, muestra «—».
 *
 * FIXTURE, sembrado por Prisma con los mismos pasos que `e2e/recorrido-ejecucion.spec.ts` (empresa,
 * roles REALES del seed, anotaciones) y `e2e/detalle-de-producto-terminado.spec.ts` (presentacion,
 * producto terminado, lote, pedido `TERMINADO` y el asiento `production` que ata el lote al pedido):
 * - anotaciones START 1, ADVANCE 2, GO_BACK 1, ADVANCE 2, FINISH 2: el paso 2 se repite y su ultima
 *   anotacion es la quinta;
 * - dos fotos de fabricacion en el paso 2 y una de envasado en el paso 1, como filas de
 *   `order_step_evidence`.
 * - (QT-316) un segundo pedido `TERMINADO` con dos lineas (recetas A y B), un producto terminado y
 *   un lote por receta, y el asiento `production` de cada lote atado a SU linea; fotos de
 *   fabricacion, envasado y acondicionamiento solo en la linea A.
 *
 * ALMACENAMIENTO: el doble en memoria (`EVIDENCE_E2E_DOUBLES`, en `playwright.config.ts`) firma las
 * lecturas bajo `https://evidencias-e2e.invalid`, que no resuelve; este spec intercepta ese origen
 * con `page.route` y sirve un PNG, como `e2e/ejecucion-receta.spec.ts`.
 *
 * AISLAMIENTO: prefijo propio `qc271_e2e_` + `RUN_ID` por proceso de worker, empresa efimera y
 * limpieza de huerfanos por prefijo Y POR EDAD, porque Chromium y WebKit corren a la vez sobre la
 * misma base. `afterAll` borra solo por los identificadores de este worker. Las filas de QT-316
 * (lineas, recetas, productos, lotes, asientos y fotos) son de la misma empresa efimera: las borra
 * `deleteCompanyData`, en el orden de sus FK, igual en `afterAll` que en la limpieza de huerfanos.
 *
 * LOS `data-testid` Y LOS TEXTOS VAN COMO CONSTANTES LOCALES y no importados de los componentes:
 * sus modulos son de cliente y arrastrarian React al proceso del runner.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { DOCUMENT_TYPE_CC, ROLE_ADMINISTRADOR, ROLE_OPERADOR, normalizeCompanyName } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizePresentationName, normalizeProductName } from '@/lib/modules/inventario';
import { formatOrderNumber } from '@/lib/modules/pedidos';
import { normalizeRecipeName } from '@/lib/modules/recetas';
import { prisma } from '@/lib/shared/db/prisma';
import { executionTraceRoute, finishedProductDetailRoute } from '@/lib/shared/routes';

import { enableAllAddons } from './helpers/addons';
import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { ensureOnlyLine, createOrderWithLine } from '../tests/helpers/only-order-line';

/** Prefijo con el que este spec marca TODO lo que crea. Nada fuera de el se toca. */
const FIXTURE_PREFIX = 'qc271_e2e_';

/** Identificador unico de este proceso de worker. */
const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit corren a la vez: la limpieza defensiva no puede borrar por prefijo a secas. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;

/** Nunca la empresa de instalacion: `companies_name_unique` es GLOBAL. */
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const RECIPE_NAME = `${SHARED_TOKEN}_receta`;
const PRESENTATION_NAME = `${SHARED_TOKEN}_botella`;
const FINISHED_NAME = `${SHARED_TOKEN}_terminado`;
const LOT = `${SHARED_TOKEN}_lote`;

/** QT-316: el pedido de dos recetas. Cada receta, su producto terminado y su lote. */
const RECIPE_A_NAME = `${SHARED_TOKEN}_receta_a`;
const RECIPE_B_NAME = `${SHARED_TOKEN}_receta_b`;
const FINISHED_A_NAME = `${SHARED_TOKEN}_terminado_a`;
const FINISHED_B_NAME = `${SHARED_TOKEN}_terminado_b`;
const LOT_A = `${SHARED_TOKEN}_lote_a`;
const LOT_B = `${SHARED_TOKEN}_lote_b`;

type Credentials = { readonly username: string; readonly password: string };

/** Ve el recorrido (`dashboard.consultar`) y la columna «Evidencia» (`pedidos.consultar`). */
const adminUser: Credentials = {
  username: `${SHARED_TOKEN}_admin`,
  password: `Qc271-Admin-${RUN_ID.slice(0, 12)}`,
};

/** Con `inventario.consultar` y sin `pedidos.consultar`: el actor de R28. */
const operatorUser: Credentials = {
  username: `${SHARED_TOKEN}_operador`,
  password: `Qc271-Operador-${RUN_ID.slice(0, 12)}`,
};

/** Contenido 1: los envases del lote son su existencia. */
const CONTENT = '1.0000';
const LINE_PACKAGES = 10;
const BATCH_STOCK = '10.0000';

/** El ano sale del reloj: el CHECK `orders_order_year_matches_created_at` lo ata a `created_at`. */
const ORDER_YEAR = new Date().getUTCFullYear();
const ORDER_SEQUENCE = 960_000 + Math.floor(Math.random() * 30_000);
const ORDER_NUMBER_TEXT = formatOrderNumber({ year: ORDER_YEAR, sequence: ORDER_SEQUENCE });
const FINISHED_AT = new Date(Date.now() - 6 * 60 * 60 * 1000);

/** Anotaciones en el pasado reciente, separadas un minuto: el orden cronologico no es ambiguo. */
const ENTRY_SPACING_MS = 60 * 1000;

type EntryAction = 'START' | 'ADVANCE' | 'GO_BACK' | 'FINISH';

/** El paso 2 se repite: lo anotan la segunda, la cuarta y la quinta (la ultima). */
const ENTRIES: readonly { readonly action: EntryAction; readonly step: number }[] = [
  { action: 'START', step: 1 },
  { action: 'ADVANCE', step: 2 },
  { action: 'GO_BACK', step: 1 },
  { action: 'ADVANCE', step: 2 },
  { action: 'FINISH', step: 2 },
];

/** Paso repetido con fotos de fabricacion, y el indice de su ultima anotacion. */
const MANUFACTURING_STEP = 2;
const MANUFACTURING_PHOTOS = 2;
const LAST_MANUFACTURING_ENTRY_INDEX = 4;

const PACKING_STEP = 1;
const PACKING_PHOTOS = 1;

const TOTAL_PHOTOS = MANUFACTURING_PHOTOS + PACKING_PHOTOS;

/** QT-316: el segundo pedido es otro numero de la misma empresa (la unicidad es por empresa). */
const TWO_RECIPES_ORDER_SEQUENCE = ORDER_SEQUENCE + 1;
const TWO_RECIPES_ORDER_NUMBER_TEXT = formatOrderNumber({
  year: ORDER_YEAR,
  sequence: TWO_RECIPES_ORDER_SEQUENCE,
});

/** QT-316: las fotos de la receta A, una fase por grupo del dialogo. La receta B no tiene ninguna. */
const A_MANUFACTURING_STEP = 1;
const A_MANUFACTURING_PHOTOS = 1;
const A_PACKING_STEP = 1;
const A_PACKING_PHOTOS = 2;
const A_CONDITIONING_STEP = 2;
const A_CONDITIONING_PHOTOS = 1;
const A_TOTAL_PHOTOS = A_MANUFACTURING_PHOTOS + A_PACKING_PHOTOS + A_CONDITIONING_PHOTOS;

/** El mismo origen que firma `evidence-storage-memory.ts`. No resuelve: sin interceptar, falla. */
const EVIDENCE_STORAGE_ORIGIN = 'https://evidencias-e2e.invalid';

/** PNG de 1 x 1 pixel. */
const EVIDENCE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/** `data-testid` del recorrido. */
const TRACE_TITLE_TESTID = 'execution-trace-title';
const TRACE_STEP_TESTID = 'execution-trace-step';
const TRACE_STEP_EVIDENCE_TESTID = 'trace-step-evidence';
const TRACE_PACKING_TESTID = 'trace-packing-evidence';
const TRACE_PACKING_COUNT_TESTID = 'trace-packing-evidence-count';

/** `data-testid` de la ficha. */
const FINISHED_PRODUCT_NAME_TESTID = 'finished-product-name';
const TABLE_ROW_TESTID_PREFIX = 'data-table-row-';
const BATCH_ROW_TESTID = 'finished-product-batch-row';
const BATCH_ORDER_TESTID = 'finished-product-batch-order';
const EVIDENCE_HEAD_TESTID = 'data-table-head-evidence';
const EVIDENCE_CELL_TESTID = 'finished-product-batch-evidence';
const EVIDENCE_BUTTON_TESTID = 'batch-evidence-button';
const EVIDENCE_DIALOG_TESTID = 'batch-evidence-dialog';
const DIALOG_MANUFACTURING_TESTID = 'batch-evidence-manufacturing';
const DIALOG_PACKING_TESTID = 'batch-evidence-packing';
const DIALOG_CONDITIONING_TESTID = 'batch-evidence-conditioning';

/** `EMPTY_MARK` de `lib/shared/ui/empty-mark.ts`: la celda de un lote sin fotos. */
const EMPTY_MARK = '—';

/** `data-testid` de cada grupo de `StepEvidence`. */
const STEP_EVIDENCE_GRID_TESTID = 'step-evidence-grid';

/** Textos visibles (los de `STEP_EVIDENCE_TEXTS`, `PACKING_EVIDENCE_TEXTS` y `BATCH_EVIDENCE_TEXTS`). */
const ANNOTATIONS_LIST_NAME = 'Anotaciones';
const PACKING_CARD_NAME = 'Envasado';
const MANUFACTURING_SECTION_NAME = 'Fabricación';
const PACKING_SECTION_NAME = 'Envasado';
const CONDITIONING_SECTION_NAME = 'Acondicionamiento';
/** El titulo del dialogo con la receta del lote (QT-316 R7). */
const recipeDialogTitle = (lot: string, orderNumber: string, recipe: string): string =>
  `Evidencia · Lote ${lot} · Pedido ${orderNumber} · ${recipe}`;
const photoLabel = (n: number, step: number): string => `Foto ${n} del paso ${step}`;
const groupLabel = (phase: string, step: number): string => `Evidencia de ${phase}, paso ${step}`;
const photosText = (n: number): string => (n === 1 ? '1 foto' : `${n} fotos`);
const ANY_PHOTO_BUTTON = /^Foto \d+ del paso \d+$/;

let companyId: string | null = null;
let adminUserId: string | null = null;
let orderId: string | null = null;
let productId: string | null = null;
let productAId: string | null = null;
let productBId: string | null = null;

function required<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`falta ${what}: fallo el beforeAll`);
  return value;
}

/** Igualdad EXACTA de texto: un nombre no puede casar con el prefijo de otro. */
function exactText(value: string): RegExp {
  return new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
}

/**
 * Atiende el origen del doble: cada `GET` de una lectura firmada recibe el PNG. Devuelve cuantas
 * peticiones llegaron, para afirmar que el Operador no pide ninguna.
 */
async function interceptEvidenceStorage(page: Page): Promise<{ requests: () => number }> {
  let requests = 0;
  await page.route(`${EVIDENCE_STORAGE_ORIGIN}/**`, async (route) => {
    requests += 1;
    await route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'image/png' },
      body: EVIDENCE_PNG,
    });
  });
  return { requests: () => requests };
}

/** En WebKit el refresco que deja una accion anterior puede interrumpir la navegacion. */
async function gotoSettled(page: Page, url: string): Promise<void> {
  await expect(async () => {
    await page.goto(url);
  }).toPass({ timeout: 60_000 });
}

/** Abre la ficha, cambia a Lotes por su enlace y espera la fila del lote. */
async function openBatchesTab(
  page: Page,
  product: string,
  finishedName: string = FINISHED_NAME,
  lot: string = LOT,
): Promise<Locator> {
  await gotoSettled(page, finishedProductDetailRoute(product));
  await expect(page.getByTestId(FINISHED_PRODUCT_NAME_TESTID)).toHaveText(exactText(finishedName), {
    timeout: 60_000,
  });
  await page.getByTestId('finished-product-tab-lotes').click();
  await page.waitForFunction(
    () => new URL(window.location.href).searchParams.get('tab') === 'lotes',
    undefined,
    { timeout: 60_000 },
  );
  const table = page.getByTestId('finished-product-lotes');
  const rows = table.locator(`[data-testid^="${TABLE_ROW_TESTID_PREFIX}"]`);
  await expect(rows).toHaveCount(1, { timeout: 60_000 });
  await expect(rows.getByTestId(BATCH_ROW_TESTID)).toHaveText(exactText(lot));
  return table;
}

/**
 * Un grupo de consulta con `count` fotos del paso `step`, todas cargadas: cada casilla es su boton
 * «Foto n del paso N» y la cuadricula ya no esta ocupada.
 */
async function expectLoadedPhotos(scope: Locator, step: number, count: number): Promise<void> {
  for (let n = 1; n <= count; n += 1) {
    await expect(scope.getByRole('button', { name: photoLabel(n, step), exact: true })).toBeVisible({
      timeout: 60_000,
    });
  }
  await expect(scope.getByRole('button', { name: ANY_PHOTO_BUTTON })).toHaveCount(count);
  await expect(scope.getByTestId(STEP_EVIDENCE_GRID_TESTID)).not.toHaveAttribute('aria-busy', 'true', {
    timeout: 60_000,
  });
  const images = scope.locator('img');
  await expect(images).toHaveCount(count);
  for (let index = 0; index < count; index += 1) {
    await expect
      .poll(() => images.nth(index).evaluate((img) => (img as HTMLImageElement).naturalWidth), {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);
  }
}

async function createUser(user: Credentials, roleId: string, ownerCompanyId: string): Promise<string> {
  const created = await createFixtureUser({
    data: {
      firstNames: `Qc271${RUN_ID.slice(0, 8)}`,
      lastNames: 'Evidencia',
      birthDate: new Date('1990-01-01'),
      email: `${user.username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: user.username,
      username: user.username,
      passwordHash: await createPasswordHash(user.password),
      roleId,
      companyId: ownerCompanyId,
      // Explicito: la columna es `@default(pending)` y ese estado no entra por el login.
      accountStatus: 'active',
    },
    select: { id: true },
  });
  return created.id;
}

/** Borra en el orden de las FK todo lo que cuelga de esas empresas, y las empresas. */
async function deleteCompanyData(companyIds: readonly string[]): Promise<void> {
  if (companyIds.length === 0) return;
  const inCompanies = { companyId: { in: [...companyIds] } };
  await prisma.orderStepEvidence.deleteMany({ where: inCompanies });
  await prisma.inventoryMovement.deleteMany({ where: inCompanies });
  await prisma.orderExecutionEntry.deleteMany({ where: inCompanies });
  await prisma.orderAssignment.deleteMany({ where: inCompanies });
  await prisma.orderPresentationLine.deleteMany({ where: inCompanies });
  await prisma.orderLine.deleteMany({ where: inCompanies });
  await prisma.order.deleteMany({ where: inCompanies });
  await prisma.productBatch.deleteMany({ where: inCompanies });
  // El producto terminado (`products.recipe_id`) restringe el borrado de la receta.
  await prisma.product.deleteMany({ where: inCompanies });
  await prisma.recipe.deleteMany({ where: inCompanies });
  await prisma.presentation.deleteMany({ where: inCompanies });
  await prisma.user.deleteMany({ where: inCompanies });
  await prisma.company.deleteMany({ where: { id: { in: [...companyIds] } } });
}

test.beforeAll(async () => {
  // Los roles nunca se crean aqui: sus permisos son el dato bajo prueba de R27 y R28.
  const [adminRole, operatorRole] = await Promise.all([
    prisma.role.findUnique({ where: { name: ROLE_ADMINISTRADOR }, select: { id: true } }),
    prisma.role.findUnique({ where: { name: ROLE_OPERADOR }, select: { id: true } }),
  ]);
  if (!adminRole || !operatorRole) {
    throw new Error(
      `faltan los roles "${ROLE_ADMINISTRADOR}" / "${ROLE_OPERADOR}": este E2E no los crea porque ` +
        'sus permisos son el dato bajo prueba. Siembra la base con `pnpm run db:seed` antes.',
    );
  }

  // LIMPIEZA DEFENSIVA DE HUERFANOS: solo empresas de este prefijo con mas de una hora.
  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  const orphanCompanies = await prisma.company.findMany({
    where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
    select: { id: true },
  });
  await deleteCompanyData(orphanCompanies.map((company) => company.id));

  const company = (
    await prisma.company.create({
      data: { name: COMPANY_NAME, nameNormalized: normalizeCompanyName(COMPANY_NAME) },
      select: { id: true },
    })
  ).id;
  companyId = company;
  // QC-277: una empresa nace sin añadidos; sin `dashboard` el recorrido responde 404.
  await enableAllAddons(company);

  const admin = await createUser(adminUser, adminRole.id, company);
  adminUserId = admin;
  const operator = await createUser(operatorUser, operatorRole.id, company);

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
      companyId: company,
    },
    select: { id: true },
  });

  const recipeId = (
    await prisma.recipe.create({
      data: {
        name: RECIPE_NAME,
        nameNormalized: normalizeRecipeName(RECIPE_NAME),
        createdBy: admin,
        companyId: company,
      },
      select: { id: true },
    })
  ).id;

  const product = (
    await prisma.product.create({
      data: {
        name: FINISHED_NAME,
        nameNormalized: normalizeProductName(FINISHED_NAME),
        type: 'FINISHED_PRODUCT',
        unitId: unit.id,
        stock: BATCH_STOCK,
        recipeId,
        presentationId: presentation.id,
        companyId: company,
      },
      select: { id: true },
    })
  ).id;
  productId = product;

  const batchId = (
    await prisma.productBatch.create({
      data: {
        productId: product,
        presentationId: presentation.id,
        stock: BATCH_STOCK,
        unitCost: '1.0000',
        packageContent: CONTENT,
        lot: LOT,
        purchaseDate: new Date('2026-09-01T00:00:00Z'),
        companyId: company,
        createdBy: admin,
      },
      select: { id: true },
    })
  ).id;

  // `TERMINADO` exige fecha de terminado, quien empaco y quien acondiciono.
  const order = await createOrderWithLine(prisma, {
      companyId: company,
      orderYear: ORDER_YEAR,
      orderSequence: ORDER_SEQUENCE,
      recipeId,
      quantity: BATCH_STOCK,
      status: 'TERMINADO',
      finishedAt: FINISHED_AT,
      packedBy: admin,
      conditionedBy: admin,
      unitId: unit.id,
      createdBy: admin,
    });
  orderId = order.id;
  const orderLineId = await ensureOnlyLine(prisma, order.id);
  const line = await prisma.orderPresentationLine.create({
    data: {
      orderId: order.id,
      orderLineId,
      companyId: company,
      presentationId: presentation.id,
      packages: LINE_PACKAGES,
      presentationContent: CONTENT,
    },
    select: { id: true },
  });

  // El asiento con el que Terminar ata el lote a la linea del pedido: de el sale el pedido del lote.
  await prisma.inventoryMovement.create({
    data: {
      batchId,
      kind: 'production',
      quantity: BATCH_STOCK,
      reason: null,
      orderId: order.id,
      orderLineId,
      orderPresentationLineId: line.id,
      companyId: company,
      createdBy: admin,
    },
  });

  const start = Date.now() - (ENTRIES.length + 1) * ENTRY_SPACING_MS;
  await prisma.orderExecutionEntry.createMany({
    data: ENTRIES.map((entry, index) => ({
      companyId: company,
      orderId: order.id,
      orderLineId,
      userId: index % 2 === 0 ? operator : admin,
      action: entry.action,
      stepPosition: entry.step,
      occurredAt: new Date(start + index * ENTRY_SPACING_MS),
    })),
  });

  // Las fotos guardadas: la ruta cumple el CHECK `<empresa>/<pedido>/<nombre>` del bucket.
  const evidenceRow = (phase: 'MANUFACTURING' | 'PACKING', stepPosition: number, slot: number) => ({
    companyId: company,
    orderId: order.id,
    orderLineId,
    phase,
    stepPosition,
    slot,
    path: `${company}/${order.id}/${randomUUID()}`,
    contentType: 'image/png',
    sizeBytes: EVIDENCE_PNG.length,
    uploadedBy: operator,
  });
  await prisma.orderStepEvidence.createMany({
    data: [
      ...Array.from({ length: MANUFACTURING_PHOTOS }, (_, index) =>
        evidenceRow('MANUFACTURING', MANUFACTURING_STEP, index + 1),
      ),
      ...Array.from({ length: PACKING_PHOTOS }, (_, index) => evidenceRow('PACKING', PACKING_STEP, index + 1)),
    ],
  });

  // QT-316 R19: el pedido de dos recetas. Todo cuelga de la misma empresa efimera, asi que
  // `deleteCompanyData` (afterAll y huerfanos) lo borra con lo de QC-271.
  const createRecipe = async (name: string): Promise<string> =>
    (
      await prisma.recipe.create({
        data: { name, nameNormalized: normalizeRecipeName(name), createdBy: admin, companyId: company },
        select: { id: true },
      })
    ).id;
  const recipeAId = await createRecipe(RECIPE_A_NAME);
  const recipeBId = await createRecipe(RECIPE_B_NAME);

  const createFinished = async (name: string, recipe: string): Promise<string> =>
    (
      await prisma.product.create({
        data: {
          name,
          nameNormalized: normalizeProductName(name),
          type: 'FINISHED_PRODUCT',
          unitId: unit.id,
          stock: BATCH_STOCK,
          recipeId: recipe,
          presentationId: presentation.id,
          companyId: company,
        },
        select: { id: true },
      })
    ).id;
  productAId = await createFinished(FINISHED_A_NAME, recipeAId);
  productBId = await createFinished(FINISHED_B_NAME, recipeBId);

  const createBatch = async (product: string, lot: string): Promise<string> =>
    (
      await prisma.productBatch.create({
        data: {
          productId: product,
          presentationId: presentation.id,
          stock: BATCH_STOCK,
          unitCost: '1.0000',
          packageContent: CONTENT,
          lot,
          purchaseDate: new Date('2026-09-01T00:00:00Z'),
          companyId: company,
          createdBy: admin,
        },
        select: { id: true },
      })
    ).id;
  const batchAId = await createBatch(productAId, LOT_A);
  const batchBId = await createBatch(productBId, LOT_B);

  // La linea A nace con el pedido (position 0); la B se escribe aparte con lo mismo de su etapa.
  const twoRecipesOrder = await createOrderWithLine(prisma, {
    companyId: company,
    orderYear: ORDER_YEAR,
    orderSequence: TWO_RECIPES_ORDER_SEQUENCE,
    recipeId: recipeAId,
    quantity: BATCH_STOCK,
    status: 'TERMINADO',
    finishedAt: FINISHED_AT,
    packedBy: admin,
    conditionedBy: admin,
    unitId: unit.id,
    createdBy: admin,
  });
  const lineAId = twoRecipesOrder.lineId;
  const lineBId = (
    await prisma.orderLine.create({
      data: {
        orderId: twoRecipesOrder.id,
        companyId: company,
        position: 1,
        recipeId: recipeBId,
        originalRecipeId: recipeBId,
        quantity: BATCH_STOCK,
        unitId: unit.id,
        status: 'TERMINADO',
        finishedAt: FINISHED_AT,
        packedBy: admin,
        conditionedBy: admin,
        createdBy: admin,
      },
      select: { id: true },
    })
  ).id;

  // Cada lote, atado por su asiento `production` a SU linea: de ahi sale la receta del lote.
  for (const [lineId, batch] of [
    [lineAId, batchAId],
    [lineBId, batchBId],
  ] as const) {
    const presentationLine = await prisma.orderPresentationLine.create({
      data: {
        orderId: twoRecipesOrder.id,
        orderLineId: lineId,
        companyId: company,
        presentationId: presentation.id,
        packages: LINE_PACKAGES,
        presentationContent: CONTENT,
      },
      select: { id: true },
    });
    await prisma.inventoryMovement.create({
      data: {
        batchId: batch,
        kind: 'production',
        quantity: BATCH_STOCK,
        reason: null,
        orderId: twoRecipesOrder.id,
        orderLineId: lineId,
        orderPresentationLineId: presentationLine.id,
        companyId: company,
        createdBy: admin,
      },
    });
  }

  // Fotos solo en la linea A, de las tres fases.
  const lineARow = (phase: 'MANUFACTURING' | 'PACKING' | 'CONDITIONING', stepPosition: number, slot: number) => ({
    companyId: company,
    orderId: twoRecipesOrder.id,
    orderLineId: lineAId,
    phase,
    stepPosition,
    slot,
    path: `${company}/${twoRecipesOrder.id}/${randomUUID()}`,
    contentType: 'image/png',
    sizeBytes: EVIDENCE_PNG.length,
    uploadedBy: operator,
  });
  await prisma.orderStepEvidence.createMany({
    data: [
      ...Array.from({ length: A_MANUFACTURING_PHOTOS }, (_, index) =>
        lineARow('MANUFACTURING', A_MANUFACTURING_STEP, index + 1),
      ),
      ...Array.from({ length: A_PACKING_PHOTOS }, (_, index) => lineARow('PACKING', A_PACKING_STEP, index + 1)),
      ...Array.from({ length: A_CONDITIONING_PHOTOS }, (_, index) =>
        lineARow('CONDITIONING', A_CONDITIONING_STEP, index + 1),
      ),
    ],
  });
});

test.afterAll(async () => {
  // Por los identificadores de ESTE worker, nunca por `FIXTURE_PREFIX`: el otro proyecto
  // (Chromium/WebKit) sigue corriendo.
  let fallo: unknown;
  try {
    await deleteCompanyData(companyId === null ? [] : [companyId]);
  } catch (error) {
    fallo = error;
  }
  await prisma.$disconnect();
  if (fallo !== undefined) throw fallo;
});

// El primer `goto` hace que `next dev` compile la ruta bajo demanda, y bcrypt tarda a proposito.
test.setTimeout(240_000);

test.describe('consulta de evidencia por paso', () => {
  test('R27 - el Administrador ve las fotos de fabricacion bajo la ultima anotacion de su paso y las de envasado en su tarjeta, y en Lotes de la ficha el total y el dialogo con Fabricacion y Envasado', async ({
    page,
  }) => {
    const order = required(orderId, 'el pedido');
    const product = required(productId, 'el producto terminado');
    required(adminUserId, 'el Administrador');

    const storage = await interceptEvidenceStorage(page);
    await loginAndLand(page, adminUser);

    // 1. El recorrido del pedido.
    await gotoSettled(page, executionTraceRoute(order));
    await expect(page.getByTestId(TRACE_TITLE_TESTID)).toContainText(ORDER_NUMBER_TEXT, { timeout: 60_000 });

    const steps = page.getByRole('list', { name: ANNOTATIONS_LIST_NAME }).getByTestId(TRACE_STEP_TESTID);
    await expect(steps).toHaveCount(ENTRIES.length);

    // 2a. Fabricacion: solo bajo la ULTIMA anotacion del paso repetido, ninguna en las anteriores.
    const placed = steps.nth(LAST_MANUFACTURING_ENTRY_INDEX).getByTestId(TRACE_STEP_EVIDENCE_TESTID);
    await expect(placed).toHaveCount(1, { timeout: 60_000 });
    const manufacturingGroup = placed.getByRole('group', {
      name: groupLabel('fabricación', MANUFACTURING_STEP),
      exact: true,
    });
    await expect(manufacturingGroup).toBeVisible();
    await expectLoadedPhotos(manufacturingGroup, MANUFACTURING_STEP, MANUFACTURING_PHOTOS);
    await expect(page.getByTestId(TRACE_STEP_EVIDENCE_TESTID)).toHaveCount(1);

    // 2b. Envasado: su propia tarjeta, con el total y el grupo del paso 1.
    const packingCard = page.getByTestId(TRACE_PACKING_TESTID);
    await expect(packingCard).toBeVisible();
    await expect(page.getByRole('region', { name: PACKING_CARD_NAME, exact: true })).toBeVisible();
    await expect(packingCard.getByTestId(TRACE_PACKING_COUNT_TESTID)).toHaveText(String(PACKING_PHOTOS));
    const packingGroup = packingCard.getByRole('group', { name: groupLabel('envasado', PACKING_STEP), exact: true });
    await expect(packingGroup).toBeVisible();
    await expectLoadedPhotos(packingGroup, PACKING_STEP, PACKING_PHOTOS);

    // 3. La ficha del producto terminado del pedido: Lotes con el boton y el total.
    const table = await openBatchesTab(page, product);
    await expect(table.getByTestId(EVIDENCE_HEAD_TESTID)).toBeVisible();
    const button = table.getByTestId(EVIDENCE_BUTTON_TESTID);
    await expect(button).toHaveCount(1, { timeout: 60_000 });
    await expect(button).toHaveText(exactText(photosText(TOTAL_PHOTOS)));
    await expect(button).toHaveAccessibleName(`Ver evidencia del lote ${LOT}: ${photosText(TOTAL_PHOTOS)}`);

    // 4. El dialogo: grupos «Fabricacion» y «Envasado», con sus fotos.
    await button.click();
    const dialog = page.getByTestId(EVIDENCE_DIALOG_TESTID);
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await expect(dialog).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
    await expect(dialog).toContainText(ORDER_NUMBER_TEXT);

    const manufacturingSection = dialog.getByTestId(DIALOG_MANUFACTURING_TESTID);
    await expect(manufacturingSection.getByRole('heading', { name: new RegExp(`^${MANUFACTURING_SECTION_NAME}`) })).toBeVisible();
    await expect(manufacturingSection.getByTestId(`${DIALOG_MANUFACTURING_TESTID}-count`)).toHaveText(
      String(MANUFACTURING_PHOTOS),
    );
    await expectLoadedPhotos(manufacturingSection, MANUFACTURING_STEP, MANUFACTURING_PHOTOS);

    const packingSection = dialog.getByTestId(DIALOG_PACKING_TESTID);
    await expect(packingSection.getByRole('heading', { name: new RegExp(`^${PACKING_SECTION_NAME}`) })).toBeVisible();
    await expect(packingSection.getByTestId(`${DIALOG_PACKING_TESTID}-count`)).toHaveText(String(PACKING_PHOTOS));
    await expectLoadedPhotos(packingSection, PACKING_STEP, PACKING_PHOTOS);

    expect(storage.requests(), 'las miniaturas se sirven desde el origen del doble').toBeGreaterThan(0);
  });

  test('R28 - el Operador abre la misma ficha y en Lotes no ve la columna «Evidencia» ni ninguna foto', async ({
    page,
  }) => {
    const product = required(productId, 'el producto terminado');

    const storage = await interceptEvidenceStorage(page);
    await loginAndLand(page, operatorUser);

    const table = await openBatchesTab(page, product);
    await expect(table.getByTestId(EVIDENCE_HEAD_TESTID)).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Evidencia' })).toHaveCount(0);
    await expect(page.getByTestId(EVIDENCE_CELL_TESTID)).toHaveCount(0);
    await expect(page.getByTestId(EVIDENCE_BUTTON_TESTID)).toHaveCount(0);
    await expect(page.getByRole('button', { name: ANY_PHOTO_BUTTON })).toHaveCount(0);
    await expect(page.locator(`img[src^="${EVIDENCE_STORAGE_ORIGIN}"]`)).toHaveCount(0);
    expect(storage.requests(), 'sin pedidos.consultar el navegador no pide ninguna foto').toBe(0);
  });

  test('R19 - pedido de dos recetas: el lote de la receta A cuenta y muestra solo sus fotos, en Fabricacion, Envasado y Acondicionamiento, con la receta en el titulo; el de la receta B muestra «—»', async ({
    page,
  }) => {
    const productA = required(productAId, 'el producto terminado A');
    const productB = required(productBId, 'el producto terminado B');

    const storage = await interceptEvidenceStorage(page);
    await loginAndLand(page, adminUser);

    // 1. Ficha del producto A: la celda cuenta solo las fotos de la receta A.
    const tableA = await openBatchesTab(page, productA, FINISHED_A_NAME, LOT_A);
    await expect(tableA.getByTestId(EVIDENCE_HEAD_TESTID)).toBeVisible();
    const button = tableA.getByTestId(EVIDENCE_BUTTON_TESTID);
    await expect(button).toHaveCount(1, { timeout: 60_000 });
    await expect(button).toHaveText(exactText(photosText(A_TOTAL_PHOTOS)));
    await expect(button).toHaveAccessibleName(`Ver evidencia del lote ${LOT_A}: ${photosText(A_TOTAL_PHOTOS)}`);

    // 2. El dialogo: la receta A en el titulo y sus fotos en los tres grupos (R20).
    await button.click();
    const dialog = page.getByTestId(EVIDENCE_DIALOG_TESTID);
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await expect(dialog).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
    await expect(
      page.getByRole('dialog', {
        name: recipeDialogTitle(LOT_A, TWO_RECIPES_ORDER_NUMBER_TEXT, RECIPE_A_NAME),
        exact: true,
      }),
    ).toBeVisible();

    const sections = [
      {
        testId: DIALOG_MANUFACTURING_TESTID,
        name: MANUFACTURING_SECTION_NAME,
        step: A_MANUFACTURING_STEP,
        photos: A_MANUFACTURING_PHOTOS,
      },
      { testId: DIALOG_PACKING_TESTID, name: PACKING_SECTION_NAME, step: A_PACKING_STEP, photos: A_PACKING_PHOTOS },
      {
        testId: DIALOG_CONDITIONING_TESTID,
        name: CONDITIONING_SECTION_NAME,
        step: A_CONDITIONING_STEP,
        photos: A_CONDITIONING_PHOTOS,
      },
    ] as const;
    for (const section of sections) {
      const scope = dialog.getByTestId(section.testId);
      await expect(scope.getByRole('heading', { name: new RegExp(`^${section.name}`) })).toBeVisible();
      await expect(scope.getByTestId(`${section.testId}-count`)).toHaveText(String(section.photos));
      await expectLoadedPhotos(scope, section.step, section.photos);
    }

    // Solo las fotos de la receta A: la suma de los grupos es el conteo de la celda, y no hay mas.
    await expect(dialog.getByRole('button', { name: ANY_PHOTO_BUTTON })).toHaveCount(A_TOTAL_PHOTOS);
    await expect(dialog.locator('img')).toHaveCount(A_TOTAL_PHOTOS);
    expect(storage.requests(), 'las miniaturas se sirven desde el origen del doble').toBeGreaterThan(0);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0, { timeout: 30_000 });

    // 3. Ficha del producto B: su receta no tiene fotos, la celda muestra «—» y no hay boton.
    const tableB = await openBatchesTab(page, productB, FINISHED_B_NAME, LOT_B);
    await expect(tableB.getByTestId(EVIDENCE_HEAD_TESTID)).toBeVisible();
    // El lote B es del MISMO pedido que el A: el «—» no es un lote sin pedido.
    await expect(tableB.getByTestId(BATCH_ORDER_TESTID)).toHaveText(exactText(TWO_RECIPES_ORDER_NUMBER_TEXT));
    await expect(tableB.getByTestId(EVIDENCE_CELL_TESTID)).toHaveText(exactText(EMPTY_MARK), { timeout: 60_000 });
    await expect(tableB.getByTestId(EVIDENCE_BUTTON_TESTID)).toHaveCount(0);
  });
});
