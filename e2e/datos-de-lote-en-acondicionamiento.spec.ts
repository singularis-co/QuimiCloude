/**
 * E2E de los datos de lote en el acondicionamiento: un solo formulario por pedido.
 *
 * Recorre, con los roles REALES del seed, un pedido `EN_ACONDICIONAMIENTO` del acondicionador 1 con
 * dos líneas de presentaciones distintas y sus dos lotes de producción:
 *
 * - el detalle muestra «Datos de lote» con un solo juego de campos, vacío y sin aviso de lotes
 *   distintos, «Terminar» deshabilitado y el aviso de las 2 líneas que faltan;
 * - guardar con un vencimiento de hoy se rechaza con `batch_expiry_not_future`;
 * - guardar con un día de producción de mañana se rechaza con `batch_production_date_future`;
 * - guardar el código del lote de otra producción de la presentación de la línea 1 se rechaza con
 *   `batch_duplicate_lot`;
 * - tras cada rechazo, el error sale en `role="alert"`, el campo culpable lleva `aria-invalid`, lo
 *   escrito se conserva y ningún lote cambia en la base;
 * - guardar el código de un envase de la empresa (otro producto) se acepta, y los dos lotes del
 *   pedido quedan con el mismo código, vencimiento y día de producción;
 * - «Terminar» se habilita, confirma y aterriza en «Por acondicionar» con el aviso;
 * - el Administrador sembrado abre en `/inventario` los lotes del producto terminado y ve el lote
 *   escrito y su vencimiento.
 *
 * EL PEDIDO SE SIEMBRA DIRECTAMENTE con `prisma`, ya `EN_ACONDICIONAMIENTO`, con su reparto, sus dos
 * productos terminados, sus dos lotes y sus asientos `production` (uno por línea): lo que deja
 * Terminar el empaque, cuyo recorrido cubre `e2e/producto-terminado.spec.ts`. Además se siembran un
 * lote de otra producción del producto de la línea 1 (misma presentación) y un envase de la misma
 * empresa, los dos con un código conocido.
 *
 * «Hoy» y «mañana» son fechas civiles UTC, como las compara el caso de uso.
 *
 * AISLAMIENTO: prefijo propio `qc219_e2e_` + `RUN_ID` por proceso de worker, empresa efímera
 * -`companies_name_unique` es GLOBAL- y limpieza de huérfanos por prefijo Y POR EDAD, porque
 * Chromium y WebKit corren a la vez sobre la misma base.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';

import {
  CONDITIONING_BATCH_DATA_DIVERGENT_TESTID,
  CONDITIONING_BATCH_DATA_ERROR_TESTID,
  CONDITIONING_BATCH_DATA_SECTION_TESTID,
  CONDITIONING_BATCH_DATA_SUBMIT_TESTID,
  CONDITIONING_BATCH_DATA_TEXTS,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-batch-data-form';
import {
  CONDITIONING_ACTIONS_TEXTS,
  CONDITIONING_FINISH_BUTTON_TESTID,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-actions';
import {
  CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID,
  CONDITIONING_ORDER_SCREEN_TESTID,
  CONDITIONING_ORDER_SCREEN_TEXTS,
  CONDITIONING_ORDER_STATUS_TESTID,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen';
import { CONDITIONING_WAIT_SECONDS } from '@/app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-wait';
import { FINISH_CONDITIONING_DIALOG_TESTID } from '@/app/(private)/asignacion/acondicionamiento/[id]/components/finish-conditioning-dialog';
import { VIEW_PARAM } from '@/app/(private)/asignacion/components/assignment-view-params';
import { orderDistributionFullText } from '@/app/(private)/asignacion/components/order-distribution-full';
import {
  CONDITIONED_ORDER_NOTICE_TESTID,
  conditionedOrderNoticeText,
} from '@/app/(private)/asignacion/components/order-outcome-notice';
import { COUNTDOWN_GATED_BUTTON_TESTID } from '@/components/shared/countdown-gated-button';
import { errorMessage, type ErrorCode } from '@/lib/modules/errores';
import {
  DOCUMENT_TYPE_CC,
  normalizeCompanyName,
  ROLE_ACONDICIONAMIENTO,
  ROLE_ADMINISTRADOR,
  ROLE_EMPACADOR,
} from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizePresentationName, normalizeProductName, PRODUCT_TYPES } from '@/lib/modules/inventario';
import { formatOrderNumber } from '@/lib/modules/pedidos';
import { normalizeRecipeName } from '@/lib/modules/recetas';
import { prisma } from '@/lib/shared/db/prisma';
import {
  ASSIGNED_ORDERS_ROUTE,
  CONDITIONED_ORDER_PARAM,
  INVENTORY_ROUTE,
  conditioningOrderRoute,
} from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { seedPackaging } from './helpers/packaging';
import { exactProductNameCellText, productRowByNameAndPresentation } from './helpers/product-name-cell';
import { openRowActionsMenuItem } from './helpers/row-actions-menu';

/** Prefijo con el que este spec marca TODO lo que crea. Nada fuera de él se toca. */
const FIXTURE_PREFIX = 'qc219_e2e_';

/** Identificador único de este proceso de worker. */
const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit corren a la vez: la limpieza defensiva no puede borrar por prefijo a secas. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;

/** Nunca la empresa de instalación: `companies_name_unique` es GLOBAL. */
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const RECIPE_NAME = `${SHARED_TOKEN}_receta`;

/** Las dos líneas del reparto, cada una con su presentación y su lote de producción. */
const PRESENTATION_1_NAME = `${SHARED_TOKEN}_pres1`;
const PRESENTATION_2_NAME = `${SHARED_TOKEN}_pres2`;
const PRESENTATION_CONTENT = '1';
const LINE_1_PACKAGES = 2;
const LINE_2_PACKAGES = 3;
const ORDER_QUANTITY = String(LINE_1_PACKAGES + LINE_2_PACKAGES);
const FINISHED_UNIT_COST = '1.0000';
/** Los lotes automáticos que dejó Terminar el empaque: la serie numérica de la empresa. */
const PROVISIONAL_LOT_1 = '1001';
const PROVISIONAL_LOT_2 = '1002';

/** Un lote de otra producción del producto de la línea 1: misma presentación, choca. */
const PREVIOUS_PRODUCTION_LOT = `${SHARED_TOKEN}_previo`;
const PREVIOUS_PRODUCTION_STOCK = 1;

/** El lote de un envase de la empresa: otro producto, no choca. */
const PACKAGING_NAME = `${SHARED_TOKEN}_envase`;
const PACKAGING_LOT = `${SHARED_TOKEN}_envlote`;

/** El día civil UTC desplazado `days`, como lo compara el caso de uso (D16). */
function utcDay(days: number): string {
  const instant = new Date();
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}

type Credentials = { readonly username: string; readonly password: string };

function credentials(suffix: string, label: string): Credentials {
  return {
    username: `${SHARED_TOKEN}_${suffix}`,
    password: `Qc219-${label}-${RUN_ID.slice(0, 12)}`,
  };
}

/** Acondiciona el pedido y escribe sus datos de lote. */
const conditioner1User = credentials('acond1', 'Acond1');
/** Mira los lotes en `/inventario` al final. */
const adminUser = credentials('admin', 'Admin');
/** Solo firma el empaque (`packed_by`): no entra. */
const empacadorUser = credentials('empacador', 'Empacador');

const ALL_USERS = [conditioner1User, adminUser, empacadorUser];

const firstNames = `Qc219${RUN_ID.slice(0, 8)}`;

/**
 * Posición de la serie de este fixture. Alta y aleatoria para no chocar con
 * `orders_company_year_sequence_key` ni con el worker del otro navegador.
 */
const ORDER_SEQUENCE = 900_000 + Math.floor(Math.random() * 90_000);

/** `/inventario`, su pestaña de producto terminado y el panel de lotes. */
const INVENTORY_TITLE_TESTID = 'inventario-title';
const INVENTORY_PAGE_SIZE = '25';
const INVENTORY_SEARCH_PARAM = 'q';
const INVENTORY_PAGE_SIZE_PARAM = 'pageSize';
const FINISHED_PRODUCT_TAB_NAME = 'Producto terminado';
const TABLE_ROW_TESTID_PREFIX = 'data-table-row-';
const NAME_CELL_TESTID = 'data-table-cell-name';
const ORDER_GROUP_NAME_TESTID = 'finished-stock-name';
const ORDER_GROUP_NUMBER_TESTID = 'finished-stock-order-number';
const ORDER_GROUP_TOGGLE_TESTID = 'finished-stock-toggle';
const BATCHES_OPEN_TESTID = 'product-batches-open';
const PRODUCT_ROW_ACTIONS_TESTID = 'product-row-actions';
const BATCHES_SHEET_TESTID = 'product-batches-sheet';
const BATCH_LOT_TESTID = 'product-batch-lot';
const BATCH_EXPIRY_TESTID = 'product-batch-expiry-date';

let companyId: string | null = null;

type SeededLine = {
  readonly batchId: string;
  readonly productId: string;
  readonly productName: string;
  readonly presentationId: string;
  readonly presentationName: string;
  readonly label: string;
  readonly provisionalLot: string;
};

type Seeded = {
  readonly orderId: string;
  readonly numberText: string;
  readonly lines: readonly [SeededLine, SeededLine];
  readonly previousProductionBatchId: string;
};
let fixture: Seeded | null = null;

/** El aviso del `<Toaster />` de sonner que monta el layout privado. */
const TOAST_SELECTOR = '[data-sonner-toast]';

/** Igualdad EXACTA de texto: un correlativo no puede casar con un prefijo suyo. */
function exactText(value: string): RegExp {
  return new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
}

function seeded(): Seeded {
  if (fixture === null) throw new Error('el fixture no existe: falló el beforeAll');
  return fixture;
}

async function createUser(user: Credentials, roleId: string, lastNames: string): Promise<string> {
  if (!companyId) throw new Error('la empresa del fixture no existe: falló el beforeAll');

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
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    // Comenzar, guardar datos de lote y Terminar anotan en el registro de ejecucion.
    () => prisma.orderExecutionEntry.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.orderConditioningTeamMember.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.inventoryMovement.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.productBatch.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.product.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.orderPresentationLine.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.order.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.recipe.deleteMany({ where: { companyId: { in: ids } } }),
    () => prisma.presentation.deleteMany({ where: { companyId: { in: ids } } }),
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

/** Lo que la base tiene de los lotes del pedido: ninguno de los rechazos puede haberlo tocado. */
async function storedBatches(batchIds: readonly string[]) {
  const rows = await prisma.productBatch.findMany({
    where: { id: { in: [...batchIds] } },
    select: { id: true, lot: true, expiryDate: true, productionDate: true, stock: true },
  });
  return batchIds.map((id) => {
    const row = rows.find((candidate) => candidate.id === id);
    if (row === undefined) throw new Error(`el lote ${id} desapareció`);
    return {
      lot: row.lot,
      expiryDate: row.expiryDate === null ? null : row.expiryDate.toISOString().slice(0, 10),
      productionDate: row.productionDate === null ? null : row.productionDate.toISOString().slice(0, 10),
      stock: row.stock.toString(),
    };
  });
}

type BatchInput = { readonly lot: string; readonly expiryDate: string; readonly productionDate: string };

type FieldName = keyof BatchInput;

const FIELD_NAMES: readonly FieldName[] = ['lot', 'expiryDate', 'productionDate'];

/** Los tres campos, por su etiqueta: si la etiqueta no está asociada, no se encuentran. */
function fields(section: Locator): Record<FieldName, Locator> {
  return {
    lot: section.getByLabel(CONDITIONING_BATCH_DATA_TEXTS.lot, { exact: true }),
    expiryDate: section.getByLabel(CONDITIONING_BATCH_DATA_TEXTS.expiryDate, { exact: true }),
    productionDate: section.getByLabel(CONDITIONING_BATCH_DATA_TEXTS.productionDate, { exact: true }),
  };
}

/**
 * Espera a que React haya hidratado el formulario: el nodo lleva sus props de React. Sin esto, en
 * WebKit lo tecleado antes de hidratar se pierde (el campo controlado vuelve a su valor), el
 * `required` frena el envío y no llega ninguna respuesta.
 */
async function waitForFormHydration(section: Locator): Promise<void> {
  const submit = section.getByTestId(CONDITIONING_BATCH_DATA_SUBMIT_TESTID);
  await expect
    .poll(() => submit.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps$'))), {
      timeout: 60_000,
    })
    .toBe(true);
}

async function fillForm(section: Locator, input: BatchInput): Promise<void> {
  const located = fields(section);
  for (const name of FIELD_NAMES) await located[name].fill(input[name]);
  await expectFormValues(section, input);
}

async function expectFormValues(section: Locator, input: BatchInput): Promise<void> {
  const located = fields(section);
  for (const name of FIELD_NAMES) await expect(located[name]).toHaveValue(input[name]);
}

/** Los dos lotes del pedido y el de la otra producción: ningún rechazo puede tocarlos. */
function watchedBatchIds(): string[] {
  const { lines, previousProductionBatchId } = seeded();
  return [...lines.map((line) => line.batchId), previousProductionBatchId];
}

/**
 * Guarda y espera el rechazo `code`: el mensaje del catálogo en la región `role="alert"`, solo el
 * campo culpable con `aria-invalid`, lo escrito intacto y ningún lote cambiado en la base.
 */
async function saveAndExpectRejection(
  page: Page,
  section: Locator,
  code: ErrorCode,
  culprit: FieldName,
  written: BatchInput,
): Promise<void> {
  const before = await storedBatches(watchedBatchIds());

  await section.getByTestId(CONDITIONING_BATCH_DATA_SUBMIT_TESTID).click();

  const alert = section.getByTestId(CONDITIONING_BATCH_DATA_ERROR_TESTID);
  await expect(alert).toHaveAttribute('data-code', code, { timeout: 60_000 });
  await expect(alert).toHaveAttribute('role', 'alert');
  await expect(section.getByRole('alert')).toContainText(errorMessage(code));
  await expect(
    page.locator(TOAST_SELECTOR).filter({ hasText: CONDITIONING_BATCH_DATA_TEXTS.saved }),
  ).toHaveCount(0);

  const located = fields(section);
  for (const name of FIELD_NAMES) {
    if (name === culprit) {
      await expect(located[name]).toHaveAttribute('aria-invalid', 'true');
    } else {
      await expect(located[name]).not.toHaveAttribute('aria-invalid', 'true');
    }
  }
  await expectFormValues(section, written);

  // El pedido sigue sin datos: ni en la pantalla ni en la base.
  await expect(page.getByTestId(CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID)).toHaveText(
    exactText(CONDITIONING_ORDER_SCREEN_TEXTS.batchDataMissing(2)),
  );
  await expect(page.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID)).toBeDisabled();
  const after = await storedBatches(watchedBatchIds());
  expect(after).toEqual(before);
  for (const batch of after) expect(batch.productionDate).toBeNull();
}

function inventoryUrl(search: string): string {
  const query = new URLSearchParams({
    [INVENTORY_PAGE_SIZE_PARAM]: INVENTORY_PAGE_SIZE,
    [INVENTORY_SEARCH_PARAM]: search,
  });
  return `${INVENTORY_ROUTE}?${query.toString()}`;
}

/** En WebKit el refresco que deja un guardado anterior puede interrumpir la navegación. */
async function gotoSettled(page: Page, url: string): Promise<void> {
  await expect(async () => {
    await page.goto(url);
  }).toPass({ timeout: 60_000 });
}

/**
 * El Administrador, en su propio contexto, abre en `/inventario` el panel de lotes de cada
 * producto terminado del pedido `numberText` y ve el lote escrito y su vencimiento.
 */
async function expectAdminSeesBatchData(
  browser: Browser,
  numberText: string,
  expected: ReadonlyArray<{ readonly line: SeededLine; readonly input: BatchInput }>,
): Promise<void> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await loginAndLand(page, adminUser);

    for (const { line, input } of expected) {
      await gotoSettled(page, inventoryUrl(SHARED_TOKEN));
      await expect(page.getByTestId(INVENTORY_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });

      await page.getByRole('tab', { name: FINISHED_PRODUCT_TAB_NAME }).click();
      await page.waitForFunction(
        (finished) => new URL(window.location.href).searchParams.get('type') === finished,
        PRODUCT_TYPES.FINISHED_PRODUCT,
        { timeout: 60_000 },
      );

      // La pestaña lista pedidos: los productos aparecen al desplegar el del pedido. El grupo se
      // identifica por su número de pedido, no por el nombre: el lote de la otra producción (sin
      // asiento de pedido) pinta su propio grupo «Sin pedido» con el mismo nombre de receta.
      const orderNumber = page
        .getByTestId(ORDER_GROUP_NUMBER_TESTID)
        .filter({ hasText: exactText(numberText) });
      const groupRow = page
        .locator(`[data-testid^="${TABLE_ROW_TESTID_PREFIX}"]`)
        .filter({ has: orderNumber });
      await expect(groupRow).toHaveCount(1, { timeout: 60_000 });
      await expect(groupRow.getByTestId(ORDER_GROUP_NAME_TESTID)).toHaveText(exactText(RECIPE_NAME));
      const toggle = groupRow.getByTestId(ORDER_GROUP_TOGGLE_TESTID);
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');

      // La fila del producto de la línea cuelga del grupo del pedido: su testid es el del grupo
      // seguido del producto. La celda de nombre pinta la receta sin la presentacion: la fila la
      // distingue su columna.
      const groupRowTestId = await groupRow.getAttribute('data-testid');
      if (groupRowTestId === null) throw new Error('la fila del pedido no tiene data-testid');
      const nameCell = page
        .getByTestId(NAME_CELL_TESTID)
        .filter({ hasText: exactProductNameCellText(RECIPE_NAME) });
      // «Lotes» vive en el menu de acciones de la fila desde QC-232 (c2d4d46f), igual que en los
      // otros specs que abren el panel de lotes.
      const productRow = productRowByNameAndPresentation(page, nameCell, line.presentationName).and(
        page.getByTestId(`${groupRowTestId}--${line.productId}`),
      );
      await expect(productRow).toHaveCount(1, { timeout: 60_000 });
      await (
        await openRowActionsMenuItem(
          page,
          productRow.getByTestId(PRODUCT_ROW_ACTIONS_TESTID),
          BATCHES_OPEN_TESTID,
        )
      ).click();

      const sheet = page.getByTestId(BATCHES_SHEET_TESTID);
      await expect(sheet).toBeVisible({ timeout: 60_000 });
      const batch = sheet.getByTestId(`product-batch-${line.batchId}`);
      await expect(batch).toBeVisible({ timeout: 60_000 });
      await expect(batch.getByTestId(BATCH_LOT_TESTID)).toHaveText(exactText(input.lot));
      await expect(batch.getByTestId(BATCH_EXPIRY_TESTID)).toHaveText(exactText(input.expiryDate));
    }
  } finally {
    await context.close();
  }
}

test.beforeAll(async () => {
  // Los roles nunca se crean aquí: `roles.name` es único y sus permisos son el dato bajo prueba.
  const roles = new Map<string, string>();
  for (const roleName of [ROLE_ACONDICIONAMIENTO, ROLE_ADMINISTRADOR, ROLE_EMPACADOR]) {
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

  const conditioner1Id = await createUser(conditioner1User, roles.get(ROLE_ACONDICIONAMIENTO)!, 'Acondiuno');
  const adminId = await createUser(adminUser, roles.get(ROLE_ADMINISTRADOR)!, 'Administra');
  const empacadorId = await createUser(empacadorUser, roles.get(ROLE_EMPACADOR)!, 'Empacador');

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

  // Otro producto de la empresa, con un lote cuyo código se conoce: no choca.
  await seedPackaging({
    companyId,
    name: PACKAGING_NAME,
    presentationId: presentation1Id,
    stock: '10',
    unitCost: '0.5000',
    lot: PACKAGING_LOT,
    createdBy: adminId,
  });

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

  // Cumple los CHECK de `orders`: `EN_ACONDICIONAMIENTO` lleva `packed_by` y `conditioned_by`.
  const year = new Date().getUTCFullYear();
  const order = await prisma.order.create({
    data: {
      companyId,
      orderYear: year,
      orderSequence: ORDER_SEQUENCE,
      recipeId,
      quantity: ORDER_QUANTITY,
      unitId: unit.id,
      status: 'EN_ACONDICIONAMIENTO',
      packedBy: empacadorId,
      conditionedBy: conditioner1Id,
      finishedAt: null,
    },
    select: { id: true },
  });

  /**
   * Una línea del reparto y lo que deja Terminar el empaque por ella: el producto terminado
   * `receta · presentación`, su lote con el lote automático y sin vencimiento ni día de producción,
   * y el asiento `production` que enlaza la línea con el lote.
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
        createdBy: empacadorId,
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
        createdBy: empacadorId,
      },
    });

    return {
      batchId: batch.id,
      productId: product.id,
      productName,
      presentationId,
      presentationName,
      label: orderDistributionFullText([{ presentationId, presentationName, packagingName: null, packages }]),
      provisionalLot,
    };
  }

  const line1 = await seedLine(0, presentation1Id, PRESENTATION_1_NAME, LINE_1_PACKAGES, PROVISIONAL_LOT_1);
  const line2 = await seedLine(1, presentation2Id, PRESENTATION_2_NAME, LINE_2_PACKAGES, PROVISIONAL_LOT_2);

  // Otra producción de la presentación de la línea 1: otro lote del mismo producto terminado, sin
  // asiento de este pedido. La existencia del producto acompaña a la del lote.
  const previousProduction = await prisma.productBatch.create({
    data: {
      productId: line1.productId,
      presentationId: line1.presentationId,
      companyId,
      stock: String(PREVIOUS_PRODUCTION_STOCK),
      unitCost: FINISHED_UNIT_COST,
      lot: PREVIOUS_PRODUCTION_LOT,
      purchaseDate: new Date('2026-01-01T00:00:00Z'),
      packageContent: PRESENTATION_CONTENT,
      createdBy: empacadorId,
    },
    select: { id: true },
  });
  await prisma.product.update({
    where: { id: line1.productId },
    data: { stock: { increment: PREVIOUS_PRODUCTION_STOCK } },
  });

  fixture = {
    orderId: order.id,
    numberText: formatOrderNumber({ year, sequence: ORDER_SEQUENCE }),
    lines: [line1, line2],
    previousProductionBatchId: previousProduction.id,
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

// El primer `goto` hace que `next dev` compile cada ruta bajo demanda, bcrypt tarda a propósito, y
// el modal de Terminar espera sus segundos reales.
test.setTimeout(300_000);

test.describe('datos de lote en el acondicionamiento: un formulario por pedido', () => {
  test('R30 R26 - un solo formulario vacío, los rechazos no escriben nada, el lote de otra producción de la misma presentación choca, el de un envase no, las dos líneas quedan iguales, termina, y el Administrador lo ve en /inventario', async ({
    page,
    browser,
  }) => {
    const { orderId, numberText, lines } = seeded();
    const [line1, line2] = lines;

    const today = utcDay(0);
    const tomorrow = utcDay(1);
    const nextYear = utcDay(365);

    // --- 1. Entra y abre el detalle de su pedido.
    await loginAndLand(page, conditioner1User);
    await page.goto(conditioningOrderRoute(orderId));
    const screen = page.getByTestId(CONDITIONING_ORDER_SCREEN_TESTID);
    await expect(screen).toBeVisible({ timeout: 60_000 });
    await expect(screen.getByTestId(CONDITIONING_ORDER_STATUS_TESTID)).toHaveAttribute(
      'data-status',
      'EN_ACONDICIONAMIENTO',
    );

    // --- 2. «Datos de lote» con un solo juego de campos, vacío y sin aviso de lotes distintos;
    //        «Terminar» deshabilitado con el aviso de las 2 líneas.
    const section = screen.getByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID);
    await expect(section).toBeVisible();
    await expect(section.getByRole('heading', { name: CONDITIONING_BATCH_DATA_TEXTS.title })).toBeVisible();
    for (const label of [
      CONDITIONING_BATCH_DATA_TEXTS.lot,
      CONDITIONING_BATCH_DATA_TEXTS.expiryDate,
      CONDITIONING_BATCH_DATA_TEXTS.productionDate,
    ]) {
      await expect(section.getByLabel(label, { exact: true })).toHaveCount(1);
    }
    await expect(section.locator('fieldset')).toHaveCount(0);
    await expect(section.getByTestId(CONDITIONING_BATCH_DATA_DIVERGENT_TESTID)).toHaveCount(0);
    await expectFormValues(section, { lot: '', expiryDate: '', productionDate: '' });
    await expect(fields(section).expiryDate).toHaveAttribute('type', 'date');
    await expect(fields(section).productionDate).toHaveAttribute('type', 'date');
    await expect(section.getByRole('button')).toHaveCount(1);
    await expect(section.getByTestId(CONDITIONING_BATCH_DATA_SUBMIT_TESTID)).toHaveText(
      exactText(CONDITIONING_BATCH_DATA_TEXTS.submit),
    );

    const missing = screen.getByTestId(CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID);
    await expect(missing).toHaveText(exactText(CONDITIONING_ORDER_SCREEN_TEXTS.batchDataMissing(2)));
    const finishButton = screen.getByTestId(CONDITIONING_FINISH_BUTTON_TESTID);
    await expect(finishButton).toHaveText(exactText(CONDITIONING_ACTIONS_TEXTS.finish));
    await expect(finishButton).toBeDisabled();
    await expect(finishButton).toHaveAttribute('aria-describedby', (await missing.getAttribute('id'))!);

    await waitForFormHydration(section);

    const valid: BatchInput = { lot: PACKAGING_LOT, expiryDate: nextYear, productionDate: today };

    // --- 3. Vencimiento de hoy: `batch_expiry_not_future`.
    await test.step('R30 - un vencimiento de hoy se rechaza y no escribe nada', async () => {
      const expiryToday: BatchInput = { ...valid, expiryDate: today };
      await fillForm(section, expiryToday);
      await saveAndExpectRejection(page, section, 'batch_expiry_not_future', 'expiryDate', expiryToday);
    });

    // --- 4. Día de producción de mañana: `batch_production_date_future`.
    await test.step('R30 - un día de producción de mañana se rechaza y no escribe nada', async () => {
      const productionTomorrow: BatchInput = { ...valid, productionDate: tomorrow };
      await fillForm(section, productionTomorrow);
      await saveAndExpectRejection(
        page,
        section,
        'batch_production_date_future',
        'productionDate',
        productionTomorrow,
      );
    });

    // --- 5. El código de otra producción de la presentación de la línea 1: `batch_duplicate_lot`.
    await test.step('R30 - el lote de otra producción de la misma presentación se rechaza y no escribe nada', async () => {
      const clashing: BatchInput = { ...valid, lot: PREVIOUS_PRODUCTION_LOT };
      await fillForm(section, clashing);
      await saveAndExpectRejection(page, section, 'batch_duplicate_lot', 'lot', clashing);
    });

    // --- 6. El código de un envase de la empresa (otro producto) se acepta: los dos lotes del pedido
    //        quedan iguales, desaparece el aviso y «Terminar» se habilita.
    await test.step('R30 R26 - el lote de un envase se acepta y las dos líneas quedan con los mismos datos', async () => {
      await fillForm(section, valid);
      await section.getByTestId(CONDITIONING_BATCH_DATA_SUBMIT_TESTID).click();
      // El éxito se avisa con un toast del `<Toaster />` del layout privado.
      const savedToast = page.locator(TOAST_SELECTOR).filter({ hasText: CONDITIONING_BATCH_DATA_TEXTS.saved });
      await expect(savedToast).toHaveCount(1, { timeout: 60_000 });
      await expect(savedToast).toBeVisible();
      await expect(section.getByTestId(CONDITIONING_BATCH_DATA_ERROR_TESTID)).toHaveCount(0);
      await expect(screen.getByTestId(CONDITIONING_ORDER_BATCH_DATA_MISSING_TESTID)).toHaveCount(0, {
        timeout: 60_000,
      });
      await expect(finishButton).toBeEnabled({ timeout: 60_000 });
      await expectFormValues(section, valid);

      expect(await storedBatches(watchedBatchIds())).toEqual([
        { lot: PACKAGING_LOT, expiryDate: nextYear, productionDate: today, stock: String(LINE_1_PACKAGES) },
        { lot: PACKAGING_LOT, expiryDate: nextYear, productionDate: today, stock: String(LINE_2_PACKAGES) },
        {
          lot: PREVIOUS_PRODUCTION_LOT,
          expiryDate: null,
          productionDate: null,
          stock: String(PREVIOUS_PRODUCTION_STOCK),
        },
      ]);
    });

    // --- 7. «Terminar» abre la confirmación con su espera, confirma y aterriza con el aviso.
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
        url.searchParams.get(CONDITIONED_ORDER_PARAM) === numberText,
      { timeout: 60_000 },
    );
    await expect(page.getByTestId(CONDITIONED_ORDER_NOTICE_TESTID)).toHaveText(
      exactText(conditionedOrderNoticeText(numberText)),
      { timeout: 60_000 },
    );

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true, finishedAt: true },
    });
    expect(stored.status).toBe('TERMINADO');
    expect(stored.finishedAt).not.toBeNull();

    // --- 8. El Administrador ve en `/inventario` el mismo lote y vencimiento en los dos productos.
    await test.step('R30 - el Administrador ve el mismo lote y vencimiento en los dos productos', async () => {
      await expectAdminSeesBatchData(browser, numberText, [
        { line: line1, input: valid },
        { line: line2, input: valid },
      ]);
    });
  });
});
