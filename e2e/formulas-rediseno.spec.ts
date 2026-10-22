/**
 * E2E del rediseño de Fórmulas (QC-264): cabecera, tabla, menú de fila, tarjetas, formulario con
 * «Versiones» al lado o debajo, pie fijo, vista previa, diálogos y revisión de importación medidos
 * en un navegador real a 1440 × 900, 820 × 1180 y 390 × 844, en Chromium y WebKit.
 *
 * Solo medidas y estado del DOM, sin capturas: jsdom no resuelve las consultas de contenedor que
 * pasan la tabla a tarjetas ni compila la hoja de Tailwind, así que el orden de la cabecera, la
 * columna lateral, el pie fijo y el tamaño de los diálogos solo existen aquí. Tampoco hace el envío
 * implícito de un formulario cuyo botón vive fuera de él (`form={id}`): «Enter guarda» va aquí.
 *
 * Casi nada se confirma: los diálogos se abren, se miden y se cierran con su botón de cancelar o
 * cerrar. Lo único que escribe es «Enter guarda», sobre una receta propia de ese caso, y la subida
 * del PDF, que deja su documento sin confirmar. Los casos corren en cualquier orden.
 *
 * FIXTURE (sembrado por Prisma): una empresa efímera por worker con los añadidos prendidos, un
 * Administrador y una conexión de proveedor IA (sin ella «Subir PDFs» sale deshabilitado y no se
 * abre); dos insumos; la receta «base» con dos pasos -el primero con una lista de verificación de
 * dos elementos- y dos versiones, «Copia» (suma 100 %) y «En revisión» (suma 90 %, por revisar); y
 * la receta «teclado», sin versiones, para «Enter guarda». Prefijo propio y `RUN_ID` por worker;
 * limpieza de huérfanos por prefijo y edad, y la de `afterAll` por la empresa de este worker.
 *
 * SIN RED: la subida del PDF usa los dobles de `documentos` que enciende `playwright.config.ts`, y
 * el `PUT` al enlace firmado se intercepta (mismo patrón que `e2e/formula-desde-pdf.spec.ts`).
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page, type Request } from '@playwright/test';

import { DOCUMENT_TYPE_CC, normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizeProductName } from '@/lib/modules/inventario';
import { normalizeRecipeName } from '@/lib/modules/recetas';
import { prisma } from '@/lib/shared/db/prisma';
import { FORMULAS_ROUTE, recipeEditRoute, recipeVersionRoute } from '@/lib/shared/routes';

import { enableAllAddons } from './helpers/addons';
import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand, type Credentials } from './helpers/landing';

const FIXTURE_PREFIX = 'qc264_e2e_';
const RUN_ID = randomUUID().replace(/-/g, '');
/** Chromium y WebKit corren a la vez, y puede haber otro worktree corriendo su propio E2E. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;
const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;
/** Nunca la empresa de instalación: `companies_name_unique` es GLOBAL. */
const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
/**
 * Con espacios, como un nombre real: una sola palabra larga no cabe en la tarjeta de 390 px. El
 * trozo del `RUN_ID` basta para que el buscador solo case con las recetas de este worker.
 */
const SEARCH_TOKEN = RUN_ID.slice(0, 12);
const BASE_NAME = `Fórmula ${SEARCH_TOKEN} base`;
const ENTER_NAME = `Fórmula ${SEARCH_TOKEN} teclado`;
const COPY_NAME = 'Copia';
const REVIEW_NAME = 'En revisión';

const adminUser: Credentials = {
  username: `${SHARED_TOKEN}_admin`,
  password: `Qc264-Admin-${RUN_ID.slice(0, 12)}`,
};

/** Valor de la columna cifrada de la conexión sembrada; nunca se descifra (dobles encendidos). */
const E2E_AI_PROVIDER_KEY_ENC = 'v1:e2e-sin-descifrar';
/** El origen al que los dobles de almacenamiento firman sus subidas. */
const STORAGE_ORIGIN = 'https://documentos-e2e.invalid';
const PDF_MIME_TYPE = 'application/pdf';
/** Bytes que sube el navegador. El `PUT` está interceptado: da igual qué contienen. */
const pdfBytes = Buffer.from('%PDF-1.4\n%%EOF\n', 'ascii');
const PDF_FILE_NAME = `${SHARED_TOKEN}_formula.pdf`;

const PHONE = { width: 390, height: 844 } as const;
const TABLET = { width: 820, height: 1180 } as const;
const DESKTOP = { width: 1440, height: 900 } as const;
const MIN_TARGET_PX = 44;
const MIN_MENU_ITEM_PX = 48;
const MIN_ASIDE_PX = 300;
const PREVIEW_MAX_WIDTH_PX = 920;
const PREVIEW_MAX_HEIGHT_PX = 900;
const PREVIEW_VIEWPORT_MARGIN_PX = 64;
const CENTER_TOLERANCE_PX = 2;
const EDGE_TOLERANCE_PX = 1;

/** Las seis columnas de la tabla, en su orden (R2). */
const COLUMN_IDS = ['image', 'name', 'stepCount', 'createdAt', 'updatedAt', 'actions'] as const;
/** Las cifras que van al final de la celda, con el rótulo que su tarjeta pinta delante. */
const NUMERIC_COLUMNS = [
  { id: 'stepCount', label: 'Pasos' },
  { id: 'createdAt', label: 'Creado' },
  { id: 'updatedAt', label: 'Actualizado' },
] as const;

/** Copias locales: los módulos que los exportan son de cliente y arrastrarían React al runner. */
const TESTIDS = {
  title: 'recipes-title',
  createOpen: 'recipe-create-open',
  uploadOpen: 'document-upload-open',
  uploadDialog: 'document-upload-dialog',
  uploadInput: 'document-upload-input',
  uploadSubmit: 'document-upload-submit',
  uploadRowStatus: 'document-upload-row-status-0',
  uploadRowReview: 'document-upload-row-review-0',
  cards: 'data-table-cards',
  rowActions: 'recipe-row-actions',
  edit: 'recipe-edit-open',
  delete: 'recipe-delete-open',
  deleteDialog: 'delete-recipe-dialog',
  deleteCancel: 'delete-recipe-cancel',
  form: 'recipe-form',
  nameField: 'recipe-field-name',
  versions: 'recipe-versions',
  versionRow: 'recipe-version-row',
  versionUnderReview: 'recipe-version-under-review',
  versionLink: 'recipe-version-link',
  footer: 'recipe-form-footer',
  previewOpen: 'recipe-form-preview-open',
  preview: 'recipe-form-preview',
  previewClose: 'recipe-form-preview-close',
  cancel: 'recipe-form-cancel',
  submit: 'recipe-form-submit',
  propagateDialog: 'propagate-versions-dialog',
  propagateTitle: 'propagate-versions-title',
  propagateCount: 'propagate-versions-count',
  propagateCancel: 'propagate-versions-cancel',
  versionForm: 'recipe-version-form',
  importReview: 'formula-import-review',
  readerPosition: 'step-reader-position',
  readerProgress: 'step-reader-progress',
  readerBlocked: 'step-reader-blocked-reason',
  readerActions: 'step-reader-actions',
  readerPrevious: 'step-reader-previous',
  readerNext: 'step-reader-next',
} as const;

/** Primer paso: un párrafo y una lista de verificación de dos elementos; segundo, un párrafo. */
const SEEDED_STEPS = [
  {
    blocks: [
      { kind: 'paragraph', spans: [{ text: 'Prepara el área de trabajo.' }] },
      {
        kind: 'checklist',
        items: [{ spans: [{ text: 'Guantes puestos' }] }, { spans: [{ text: 'Gafas puestas' }] }],
      },
    ],
  },
  { blocks: [{ kind: 'paragraph', spans: [{ text: 'Mezcla los insumos durante diez minutos.' }] }] },
] as const;

type Seed = {
  readonly baseId: string;
  readonly enterId: string;
  readonly copyId: string;
  readonly reviewId: string;
};

let companyId: string | null = null;
let seed: Seed | null = null;

function seeded(): Seed {
  if (seed === null) throw new Error('el fixture no existe: falló el beforeAll');
  return seed;
}

function listUrl(): string {
  const query = new URLSearchParams({ pageSize: '25', q: SEARCH_TOKEN });
  return `${FORMULAS_ROUTE}?${query.toString()}`;
}

/** En el orden que imponen las FK RESTRICT; cada paso corre aunque falle el anterior. */
async function deleteCompanyData(companyIds: readonly string[]): Promise<unknown> {
  if (companyIds.length === 0) return undefined;
  const inCompanies = { companyId: { in: [...companyIds] } };
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    () => prisma.documentFile.deleteMany({ where: inCompanies }),
    () => prisma.documentBatch.deleteMany({ where: inCompanies }),
    // Antes que el usuario (`created_by`) y que la empresa: las dos FK son RESTRICT.
    () => prisma.aiProviderConnection.deleteMany({ where: inCompanies }),
    // Las versiones cuelgan de la original con `ON DELETE RESTRICT`: van antes.
    () => prisma.recipe.deleteMany({ where: { ...inCompanies, parentRecipeId: { not: null } } }),
    () => prisma.recipe.deleteMany({ where: inCompanies }),
    () => prisma.product.deleteMany({ where: inCompanies }),
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
  // La lectura de PDF y las integraciones: sin ellas no hay «Subir PDFs» (QC-277 R15).
  await enableAllAddons(company);

  const adminId = (
    await createFixtureUser({
      data: {
        firstNames: `Qc264${RUN_ID.slice(0, 8)}`,
        lastNames: 'Formulas',
        birthDate: new Date('1990-01-01'),
        email: `${adminUser.username}@example.test`,
        phone: '+573000000000',
        documentTypeCode: DOCUMENT_TYPE_CC,
        documentNumber: adminUser.username,
        username: adminUser.username,
        passwordHash: await createPasswordHash(adminUser.password),
        roleId: adminRole.id,
        companyId: company,
        accountStatus: 'active',
      },
      select: { id: true },
    })
  ).id;

  await prisma.aiProviderConnection.create({
    data: {
      id: randomUUID(),
      companyId: company,
      provider: 'ANTHROPIC',
      apiKeyEnc: E2E_AI_PROVIDER_KEY_ENC,
      status: 'ACTIVE',
      keyUpdatedAt: new Date(),
      createdById: adminId,
      updatedById: adminId,
    },
  });

  const unit = await prisma.unit.findFirstOrThrow({
    where: { nameNormalized: 'litro', companyId: null },
    select: { id: true },
  });
  const createProduct = async (key: string) => {
    const name = `${SHARED_TOKEN}_insumo_${key}`;
    return (
      await prisma.product.create({
        data: { name, nameNormalized: normalizeProductName(name), unitId: unit.id, companyId: company },
        select: { id: true },
      })
    ).id;
  };
  const productA = await createProduct('a');
  const productB = await createProduct('b');

  const createRecipe = async (data: {
    readonly name: string;
    readonly lines: readonly { readonly productId: string; readonly percentage: string }[];
    readonly steps?: unknown;
    readonly parentRecipeId?: string;
  }) =>
    (
      await prisma.recipe.create({
        data: {
          name: data.name,
          nameNormalized: normalizeRecipeName(data.name),
          createdBy: adminId,
          companyId: company,
          parentRecipeId: data.parentRecipeId ?? null,
          ...(data.steps === undefined ? {} : { steps: data.steps as object }),
          lines: { create: [...data.lines] },
        },
        select: { id: true },
      })
    ).id;

  const baseId = await createRecipe({
    name: BASE_NAME,
    steps: SEEDED_STEPS,
    lines: [
      { productId: productA, percentage: '60.00' },
      { productId: productB, percentage: '40.00' },
    ],
  });
  const copyId = await createRecipe({
    name: COPY_NAME,
    parentRecipeId: baseId,
    lines: [
      { productId: productA, percentage: '60.00' },
      { productId: productB, percentage: '40.00' },
    ],
  });
  // Suma 90 %: es lo que la deja «por revisar».
  const reviewId = await createRecipe({
    name: REVIEW_NAME,
    parentRecipeId: baseId,
    lines: [
      { productId: productA, percentage: '60.00' },
      { productId: productB, percentage: '30.00' },
    ],
  });
  const enterId = await createRecipe({
    name: ENTER_NAME,
    lines: [{ productId: productA, percentage: '100.00' }],
  });

  seed = { baseId, enterId, copyId, reviewId };
});

test.afterAll(async () => {
  const primerFallo = await deleteCompanyData(companyId === null ? [] : [companyId]);
  await prisma.$disconnect();
  if (primerFallo !== undefined) throw primerFallo;
});

// El primer `goto` compila la ruta en `next dev`, y bcrypt tarda a propósito.
test.setTimeout(240_000);

type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;
type Viewport = { readonly width: number; readonly height: number };

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  expect(found, 'el elemento no tiene caja').not.toBeNull();
  return found as Box;
}

function viewportOf(page: Page): Viewport {
  return page.viewportSize() as Viewport;
}

async function expectTarget(locator: Locator, label: string, minHeight = MIN_TARGET_PX): Promise<Box> {
  await expect(locator, label).toBeVisible();
  const found = await box(locator);
  expect(found.width, `${label}: ancho`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  expect(found.height, `${label}: alto`).toBeGreaterThanOrEqual(minHeight);
  return found;
}

/** Medido a media animación, el diálogo aún escala. */
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

/** `soft`: el caso sigue midiendo lo demás y el rojo se informa al final. */
async function expectNoHorizontalScroll(page: Page, label: string, soft = false): Promise<void> {
  await (soft ? expect.configure({ soft: true }) : expect)
    .poll(
      () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      { message: `${label}: el documento no desborda en horizontal` },
    )
    .toBeLessThanOrEqual(0);
}

/** El diálogo entero dentro de la ventana, ya sin la animación de entrada. */
async function expectWhole(page: Page, dialog: Locator, label: string): Promise<Box> {
  await expect(dialog, label).toBeVisible({ timeout: 60_000 });
  await waitForAnimationsToSettle(dialog);
  const viewport = viewportOf(page);
  const found = await box(dialog);
  expect(found.x, `${label}: borde izquierdo`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
  expect(found.y, `${label}: borde superior`).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
  expect(found.x + found.width, `${label}: borde derecho`).toBeLessThanOrEqual(viewport.width + EDGE_TOLERANCE_PX);
  expect(found.y + found.height, `${label}: borde inferior`).toBeLessThanOrEqual(
    viewport.height + EDGE_TOLERANCE_PX,
  );
  return found;
}

async function expectCenteredAndWhole(page: Page, dialog: Locator, label: string): Promise<Box> {
  const found = await expectWhole(page, dialog, label);
  const viewport = viewportOf(page);
  const horizontal = Math.abs(found.x - (viewport.width - (found.x + found.width)));
  const vertical = Math.abs(found.y - (viewport.height - (found.y + found.height)));
  expect(horizontal, `${label}: centrado en horizontal`).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
  expect(vertical, `${label}: centrado en vertical`).toBeLessThanOrEqual(CENTER_TOLERANCE_PX);
  return found;
}

/**
 * Cada botón visible del diálogo mide al menos 44 px de alto y de ancho. El `<input type="file">`
 * tiene rol de botón pero es `sr-only`: el objetivo táctil es la zona que lo abre, no él.
 */
async function expectDialogButtons(dialog: Locator, label: string): Promise<void> {
  const buttons = dialog.getByRole('button').filter({ visible: true });
  expect(await buttons.count(), `${label}: tiene botones`).toBeGreaterThan(0);
  for (const button of await buttons.all()) {
    if (await button.evaluate((el) => el.matches('input[type="file"]'))) continue;
    const name = ((await button.getAttribute('aria-label')) ?? (await button.innerText())).trim();
    await expectTarget(button, `${label}: botón «${name}»`);
  }
}

/** Lo que pinta el menú abierto, en orden: el nombre de cada ítem o `---` por separador. */
async function menuSequence(menu: Locator): Promise<string[]> {
  return menu.evaluate((root) =>
    Array.from(root.querySelectorAll('[role="menuitem"], [role="separator"]'), (node) =>
      node.getAttribute('role') === 'separator' ? '---' : (node.textContent ?? '').trim(),
    ),
  );
}

async function textAlign(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).textAlign);
}

/** La cabecera y la celda alineadas al final, con la misma x final (mismo patrón que inventario). */
async function expectRightAligned(head: Locator, cell: Locator, label: string): Promise<void> {
  expect(await textAlign(head), `${label}: cabecera`).toMatch(/^(right|end)$/);
  expect(await textAlign(cell), `${label}: celda`).toMatch(/^(right|end)$/);
  const headContent = await box(head.locator(':scope > div').first());
  // La cifra es texto suelto de la celda: se mide su nodo de texto, fuera del rótulo de tarjeta
  // (que en la tabla no tiene caja) y del divisor absoluto de 1 px.
  const cellTextRight = await cell.evaluate((el) => {
    let right: number | null = null;
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim() === '') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      right = Math.max(right ?? rect.right, rect.right);
    }
    return right;
  });
  expect(cellTextRight, `${label}: la celda tiene cifra`).not.toBeNull();
  expect(
    Math.abs(headContent.x + headContent.width - (cellTextRight as number)),
    `${label}: misma x final`,
  ).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
}

/** ¿Algún nodo de la celda pinta cifras tabulares? `font-variant-numeric` se hereda. */
async function hasTabularNumbers(cell: Locator): Promise<boolean> {
  return cell.evaluate((el) =>
    [el, ...Array.from(el.querySelectorAll('*'))].some((node) =>
      getComputedStyle(node).fontVariantNumeric.includes('tabular-nums'),
    ),
  );
}

/** Cuántas líneas ocupa el texto del elemento: las cajas de sus nodos de texto, por su `top`. */
async function textLineCount(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const tops: number[] = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if ((node.textContent ?? '').trim() === '') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width > 0) tops.push(rect.top);
      }
    }
    const lines: number[] = [];
    for (const top of tops) {
      if (!lines.some((line) => Math.abs(line - top) <= 2)) lines.push(top);
    }
    return lines.length;
  });
}

async function openList(page: Page, viewport: Viewport): Promise<void> {
  await page.setViewportSize(viewport);
  await loginAndLand(page, adminUser);
  const response = await page.goto(listUrl());
  expect(response?.status(), '/produccion/formulas debe responder 200').toBe(200);
  await expect(page.getByTestId(TESTIDS.title)).toBeVisible({ timeout: 60_000 });
  await expect(row(page, seeded().baseId)).toHaveCount(1, { timeout: 60_000 });
}

async function openEdit(page: Page, viewport: Viewport, recipeId = seeded().baseId): Promise<void> {
  await page.setViewportSize(viewport);
  await loginAndLand(page, adminUser);
  const response = await page.goto(recipeEditRoute(recipeId));
  expect(response?.status(), 'la ficha de la receta debe responder 200').toBe(200);
  await expect(page.getByTestId(TESTIDS.form)).toBeVisible({ timeout: 60_000 });
}

function row(page: Page, id: string): Locator {
  return page.getByTestId(`data-table-row-${id}`);
}

function card(page: Page, id: string): Locator {
  return page.getByTestId(`data-table-card-${id}`);
}

function versionRow(page: Page, name: string): Locator {
  return page
    .getByTestId(TESTIDS.versions)
    .getByTestId(TESTIDS.versionRow)
    .filter({ has: page.getByRole('link', { name: `Abrir la versión ${name}`, exact: true }) });
}

/** Abre «Acciones» de la tarjeta: el diálogo centrado que se titula con el nombre de la receta. */
async function openCardMenu(page: Page, recipeId: string, name: string): Promise<Locator> {
  const menu = page.getByRole('dialog', { name, exact: true });
  await clickUntilVisible(card(page, recipeId).getByTestId(TESTIDS.rowActions), menu);
  return menu;
}

/**
 * Abre la vista previa; abrirla también prueba que el formulario ya hidrató.
 *
 * POR TECLADO Y NO CON EL RATÓN: a 390 px el indicador del overlay de desarrollo de `next dev`
 * (`<nextjs-portal>`, abajo a la izquierda) tapa «Vista previa», que es justo lo que va pegado a la
 * izquierda del pie, y Playwright nunca deja llegar el clic. Es un artefacto del entorno, no de la
 * pantalla (mismo caso que `e2e/permisos.spec.ts`); contra un build de producción el ratón llegaría.
 * No se usa `{ force: true }`: taparía la comprobación en vez de rodearla.
 */
async function openPreview(page: Page): Promise<Locator> {
  const preview = page.getByTestId(TESTIDS.preview);
  const trigger = page.getByTestId(TESTIDS.previewOpen);
  await expect(async () => {
    if (!(await preview.isVisible())) {
      await trigger.focus();
      await trigger.press('Enter');
    }
    await expect(preview).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await waitForAnimationsToSettle(preview);
  return preview;
}

async function closePreview(page: Page): Promise<void> {
  await page.getByTestId(TESTIDS.previewClose).click();
  await expect(page.getByTestId(TESTIDS.preview)).toHaveCount(0);
}

/** «Guardar» con versiones vivas no guarda: abre el diálogo de propagar. */
async function openPropagate(page: Page): Promise<Locator> {
  const dialog = page.getByTestId(TESTIDS.propagateDialog);
  await clickUntilVisible(page.getByTestId(TESTIDS.submit), dialog);
  return dialog;
}

async function cancelPropagate(page: Page): Promise<void> {
  await page.getByTestId(TESTIDS.propagateCancel).click();
  await expect(page.getByTestId(TESTIDS.propagateDialog)).toHaveCount(0);
}

/** Instala la intercepción del `PUT` al enlace firmado y devuelve el contador vivo. */
async function interceptSignedUploads(page: Page): Promise<{ count(): number }> {
  let intercepted = 0;
  await page.route(`${STORAGE_ORIGIN}/**`, async (route) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'PUT, OPTIONS',
      'access-control-allow-headers': 'content-type',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    intercepted += 1;
    await route.fulfill({ status: 200, headers, body: '' });
  });
  return { count: () => intercepted };
}

test.describe('Fórmulas rediseñado', () => {
  test('a 1440 × 900: «Subir PDFs» antes de «Nueva fórmula», seis columnas con las cifras al final y menú con separador y «Borrar» destructivo (R1, R2, R3)', async ({
    page,
  }) => {
    await openList(page, DESKTOP);
    const { baseId } = seeded();

    // R1: un único `h1`, «Fórmulas», y las dos acciones en orden.
    const headings = page.locator('h1');
    await expect(headings).toHaveCount(1);
    await expect(headings).toHaveText('Fórmulas');
    await expect(page.getByTestId(TESTIDS.title)).toHaveText('Fórmulas');
    const upload = page.getByTestId(TESTIDS.uploadOpen);
    const create = page.getByTestId(TESTIDS.createOpen);
    await expect(upload).toHaveCount(1);
    await expect(create).toHaveCount(1);
    const uploadBox = await expectTarget(upload, '«Subir PDFs»');
    const createBox = await expectTarget(create, '«Nueva fórmula»');
    expect(uploadBox.x + uploadBox.width, '«Subir PDFs» va antes que «Nueva fórmula»').toBeLessThanOrEqual(
      createBox.x,
    );
    expect(
      await upload.evaluate((el, other) => {
        const target = document.querySelector(`[data-testid="${other}"]`);
        return target !== null && (el.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      }, TESTIDS.createOpen),
      '«Subir PDFs» precede a «Nueva fórmula» en el DOM',
    ).toBe(true);

    // R2: tabla visible, tarjetas ocultas y las seis columnas en su orden.
    await expect(row(page, baseId)).toBeVisible();
    await expect(card(page, baseId)).toBeHidden();
    const headIds = await page
      .locator('thead th[data-testid^="data-table-head-"]')
      .evaluateAll((cells) =>
        cells
          .filter((cell) => cell.getClientRects().length > 0)
          .map((cell) => (cell.getAttribute('data-testid') ?? '').replace('data-table-head-', '')),
      );
    expect(headIds).toEqual([...COLUMN_IDS]);
    for (const { id } of NUMERIC_COLUMNS) {
      const head = page.getByTestId(`data-table-head-${id}`);
      const cell = row(page, baseId).getByTestId(`data-table-cell-${id}`);
      await expectRightAligned(head, cell, id);
      expect(await hasTabularNumbers(cell), `${id}: cifras tabulares`).toBe(true);
    }
    await expect(row(page, baseId).getByTestId('data-table-cell-stepCount')).toContainText('2');
    await expectNoHorizontalScroll(page, '1440');

    // R3: el disparador con su nombre y su id; «Editar», separador y «Borrar» destructivo.
    const trigger = row(page, baseId).getByTestId(TESTIDS.rowActions);
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-label', `Acciones de ${BASE_NAME}`);
    await expect(trigger).toHaveAttribute('data-recipe-id', baseId);
    const dropdown = page.getByRole('menu');
    await clickUntilVisible(trigger, dropdown);
    expect(await menuSequence(dropdown)).toEqual(['Editar', '---', 'Borrar']);
    await expect(dropdown.getByTestId(TESTIDS.edit)).toHaveAttribute('href', recipeEditRoute(baseId));
    await expect(dropdown.getByTestId(TESTIDS.edit)).not.toHaveAttribute('data-variant', 'destructive');
    await expect(dropdown.getByTestId(TESTIDS.delete)).toHaveAttribute('data-variant', 'destructive');
    await page.keyboard.press('Escape');
    await expect(dropdown).toHaveCount(0);
  });

  test('a 1440 × 900: «Versiones» a la derecha, pie fijo visible, «Por revisar» en una línea, vista previa centrada y propagar en plural (R13, R15, R22, R23, R27, R30)', async ({
    page,
  }) => {
    await openEdit(page, DESKTOP);
    const { baseId, copyId, reviewId } = seeded();

    // R15: el pie se ve sin desplazar, con «Vista previa» a la izquierda y «Cancelar» y «Guardar»
    // a la derecha, todos de 44 px.
    const footer = page.getByTestId(TESTIDS.footer);
    const footerBox = await box(footer);
    expect(footerBox.y, 'el pie empieza dentro de la ventana').toBeGreaterThanOrEqual(0);
    expect(footerBox.y + footerBox.height, 'el pie se ve sin desplazar').toBeLessThanOrEqual(
      DESKTOP.height + EDGE_TOLERANCE_PX,
    );
    const previewOpen = await expectTarget(footer.getByTestId(TESTIDS.previewOpen), '«Vista previa»');
    const cancel = await expectTarget(footer.getByTestId(TESTIDS.cancel), '«Cancelar»');
    const submit = await expectTarget(footer.getByTestId(TESTIDS.submit), '«Guardar»');
    expect(previewOpen.x + previewOpen.width, '«Vista previa» a la izquierda').toBeLessThan(
      footerBox.x + footerBox.width / 2,
    );
    expect(cancel.x, '«Cancelar» a la derecha').toBeGreaterThan(footerBox.x + footerBox.width / 2);
    expect(submit.x, '«Guardar» tras «Cancelar»').toBeGreaterThanOrEqual(cancel.x + cancel.width);

    // R13: «Versiones» a la derecha del formulario, en una columna de al menos 300 px.
    const form = await box(page.getByTestId(TESTIDS.form));
    const versions = page.getByTestId(TESTIDS.versions);
    const versionsBox = await box(versions);
    expect(versionsBox.x, '«Versiones» a la derecha del formulario').toBeGreaterThanOrEqual(form.x + form.width);
    expect(versionsBox.width, '«Versiones» mide al menos 300 px').toBeGreaterThanOrEqual(MIN_ASIDE_PX);
    expect(versionsBox.y, '«Versiones» arranca a la altura del formulario').toBeLessThan(form.y + form.height);

    // R30: una fila por versión, nombre en una línea con `title`, «Por revisar» solo en la que lo
    // está y en una línea, y «Abrir» con su nombre accesible y su destino.
    await expect(versions.getByTestId(TESTIDS.versionRow)).toHaveCount(2);
    for (const [name, id] of [
      [COPY_NAME, copyId],
      [REVIEW_NAME, reviewId],
    ] as const) {
      const versionLine = versionRow(page, name);
      await expect(versionLine).toHaveCount(1);
      const nameCell = versionLine.locator(`[title="${name}"]`);
      await expect(nameCell).toHaveText(name);
      expect(await textLineCount(nameCell), `${name}: nombre en una línea`).toBe(1);
      const link = versionLine.getByTestId(TESTIDS.versionLink);
      await expect(link).toHaveAccessibleName(`Abrir la versión ${name}`);
      await expect(link).toHaveAttribute('href', recipeVersionRoute(baseId, id));
    }
    await expect(versionRow(page, COPY_NAME).getByTestId(TESTIDS.versionUnderReview)).toHaveCount(0);
    const badge = versionRow(page, REVIEW_NAME).getByTestId(TESTIDS.versionUnderReview);
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Por revisar');
    expect(await textLineCount(badge), '«Por revisar» en una línea').toBe(1);

    // R22, R23: la vista previa centrada, de hasta 920 × 900 y sin pasar de la ventana menos 64 px,
    // con «Paso 1 de 2», un tramo por paso, el motivo de bloqueo y su pie visible.
    const preview = await openPreview(page);
    const previewBox = await expectCenteredAndWhole(page, preview, 'vista previa');
    expect(previewBox.width, 'vista previa: ancho').toBeLessThanOrEqual(PREVIEW_MAX_WIDTH_PX + EDGE_TOLERANCE_PX);
    expect(previewBox.height, 'vista previa: alto').toBeLessThanOrEqual(PREVIEW_MAX_HEIGHT_PX + EDGE_TOLERANCE_PX);
    expect(previewBox.height, 'vista previa: la ventana menos 64 px').toBeLessThanOrEqual(
      DESKTOP.height - PREVIEW_VIEWPORT_MARGIN_PX + EDGE_TOLERANCE_PX,
    );
    await expect(preview.getByTestId(TESTIDS.readerPosition)).toHaveText('Paso 1 de 2');
    const progress = preview.getByTestId(TESTIDS.readerProgress);
    await expect(progress.getByRole('listitem')).toHaveCount(2);
    await expect(preview.getByTestId('step-reader-progress-segment-0')).toHaveAttribute('data-state', 'current');
    await expect(preview.getByTestId('step-reader-progress-segment-1')).toHaveAttribute('data-state', 'pending');
    await expect(preview.getByTestId(TESTIDS.readerBlocked)).toContainText(
      'Marca los 2 elementos pendientes para continuar.',
    );
    const actions = await box(preview.getByTestId(TESTIDS.readerActions));
    expect(actions.y + actions.height, 'el pie del diálogo cabe en el diálogo').toBeLessThanOrEqual(
      previewBox.y + previewBox.height + EDGE_TOLERANCE_PX,
    );
    const previous = await expectTarget(preview.getByTestId(TESTIDS.readerPrevious), '«Anterior»');
    const next = await expectTarget(preview.getByTestId(TESTIDS.readerNext), '«Siguiente»');
    expect(next.x, '«Siguiente» tras «Anterior»').toBeGreaterThanOrEqual(previous.x + previous.width);
    expect(previous.x, 'los botones del pie van a la derecha').toBeGreaterThan(actions.x + actions.width / 2);
    await closePreview(page);

    // R27: con dos versiones, el título en plural y el número en monoespaciada. Se cancela.
    const propagate = await openPropagate(page);
    await expect(propagate.getByTestId(TESTIDS.propagateTitle)).toHaveText('2 versiones parten de esta receta');
    const count = propagate.getByTestId(TESTIDS.propagateCount);
    await expect(count).toHaveText('2');
    expect(await count.evaluate((el) => getComputedStyle(el).fontFamily), 'número en monoespaciada').toMatch(
      /mono/i,
    );
    await cancelPropagate(page);
  });

  test('a 1440 × 900: Enter en un campo de texto guarda la receta una sola vez con «Guardar» fuera del formulario (R15)', async ({
    page,
  }) => {
    const { enterId } = seeded();
    const before = await prisma.recipe.findUniqueOrThrow({ where: { id: enterId }, select: { name: true } });
    const renamed = `${before.name} 2`;
    await openEdit(page, DESKTOP, enterId);

    // «Guardar» vive en el pie, fuera del `<form>`, y se asocia con `form`.
    const submit = page.getByTestId(TESTIDS.submit);
    const formId = await page.getByTestId(TESTIDS.form).getAttribute('id');
    expect(formId, 'el formulario tiene id').not.toBeNull();
    await expect(submit).toHaveAttribute('form', formId as string);
    expect(
      await submit.evaluate((el) => el.closest('form') === null),
      '«Guardar» está fuera del <form>',
    ).toBe(true);

    // Abrir y cerrar la vista previa prueba que React ya hidrató: un Enter antes enviaría el
    // formulario nativo, sin `onSubmit`.
    await openPreview(page);
    await closePreview(page);

    const nameField = page.getByTestId(TESTIDS.nameField);
    await nameField.click();
    await nameField.press('End');
    await nameField.pressSequentially(' 2', { delay: 20 });
    await expect(nameField).toHaveValue(renamed);
    await expect(submit).toBeEnabled();

    // Se cuentan las Server Actions a partir de aquí: la del guardado y ninguna más.
    const actionPosts: Request[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.headers()['next-action'] !== undefined) {
        actionPosts.push(request);
      }
    });

    await nameField.press('Enter');
    await page.waitForURL((url) => url.pathname === FORMULAS_ROUTE, { timeout: 60_000 });
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'Receta actualizada.' });
    await expect(toast).toHaveCount(1, { timeout: 30_000 });

    await expect
      .poll(async () => (await prisma.recipe.findUniqueOrThrow({ where: { id: enterId } })).name, {
        timeout: 30_000,
      })
      .toBe(renamed);
    expect(actionPosts, 'Enter envía el formulario una sola vez').toHaveLength(1);
    await expect(toast).toHaveCount(1);
  });

  test('a 820 × 1180: «Versiones» debajo del formulario y antes del pie, y el listado en tarjetas (R5, R13)', async ({
    page,
  }) => {
    await openList(page, TABLET);
    const { baseId } = seeded();

    // R5: tarjeta con la miniatura y el nombre arriba, las tres cifras con su rótulo y «Acciones».
    await expect(page.getByTestId(TESTIDS.cards)).toBeVisible();
    const baseCard = card(page, baseId);
    await expect(baseCard).toBeVisible();
    await expect(row(page, baseId)).toBeHidden();
    const image = await box(baseCard.getByTestId('data-table-card-field-image'));
    const title = baseCard.getByTestId('data-table-card-field-name');
    await expect(title).toHaveText(BASE_NAME);
    expect(image.y, 'la miniatura va arriba').toBeLessThan((await box(title)).y);
    for (const { id, label } of NUMERIC_COLUMNS) {
      const field = baseCard.getByTestId(`data-table-card-field-${id}`);
      await expect(field.locator('[data-card-label]'), `rótulo de ${id}`).toBeVisible();
      await expect(field.locator('[data-card-label]'), `rótulo de ${id}`).toHaveText(label);
    }
    await expectTarget(baseCard.getByTestId(TESTIDS.rowActions), '«Acciones» de la tarjeta');
    await expectNoHorizontalScroll(page, '820 listado');

    // R13: con menos de 880 px, «Versiones» debajo del formulario y antes del pie.
    const response = await page.goto(recipeEditRoute(baseId));
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId(TESTIDS.form)).toBeVisible({ timeout: 60_000 });
    const form = await box(page.getByTestId(TESTIDS.form));
    const versions = page.getByTestId(TESTIDS.versions);
    const versionsBox = await box(versions);
    expect(versionsBox.y, '«Versiones» debajo del formulario').toBeGreaterThanOrEqual(form.y + form.height);
    expect(Math.abs(versionsBox.x - form.x), '«Versiones» alineada con el formulario').toBeLessThanOrEqual(
      EDGE_TOLERANCE_PX,
    );
    expect(
      await versions.evaluate((el, footerTestId) => {
        const footer = document.querySelector(`[data-testid="${footerTestId}"]`);
        return footer !== null && (el.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      }, TESTIDS.footer),
      '«Versiones» va antes que el pie',
    ).toBe(true);
    await expectNoHorizontalScroll(page, '820 formulario');
  });

  test('a 390 × 844: tarjetas con «Acciones» de 44 px, menú centrado con ítems de 48 px, y borrar y subir enteros (R5, R47)', async ({
    page,
  }) => {
    await openList(page, PHONE);
    const { baseId } = seeded();

    await expect(page.getByTestId(TESTIDS.cards)).toBeVisible();
    await expect(card(page, baseId)).toBeVisible();
    await expect(row(page, baseId)).toBeHidden();
    await expectNoHorizontalScroll(page, '390 listado');

    const trigger = card(page, baseId).getByTestId(TESTIDS.rowActions);
    await expectTarget(trigger, '«Acciones» de la tarjeta');
    await expect(trigger).toHaveAttribute('data-recipe-id', baseId);
    const menu = await openCardMenu(page, baseId, BASE_NAME);
    await expectCenteredAndWhole(page, menu, `menú de ${BASE_NAME}`);
    for (const testId of [TESTIDS.edit, TESTIDS.delete]) {
      await expectTarget(menu.getByTestId(testId), `ítem ${testId}`, MIN_MENU_ITEM_PX);
    }

    // R47: «Borrar» desde la tarjeta abre el diálogo entero, con botones de 44 px. Se cancela.
    const deleteDialog = page.getByTestId(TESTIDS.deleteDialog);
    await expect(async () => {
      if (await deleteDialog.isVisible()) return;
      const opened = await openCardMenu(page, baseId, BASE_NAME);
      await opened.getByTestId(TESTIDS.delete).click();
      await expect(deleteDialog).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    await expectWhole(page, deleteDialog, 'borrar receta');
    await expectDialogButtons(deleteDialog, 'borrar receta');
    await deleteDialog.getByTestId(TESTIDS.deleteCancel).click();
    await expect(deleteDialog).toHaveCount(0);
    await expect(card(page, baseId)).toBeVisible();

    // R47: «Subir PDFs» abre su diálogo entero, con botones de 44 px.
    const uploadDialog = page.getByTestId(TESTIDS.uploadDialog);
    await clickUntilVisible(page.getByTestId(TESTIDS.uploadOpen), uploadDialog);
    await expectWhole(page, uploadDialog, 'subir PDFs');
    await expectDialogButtons(uploadDialog, 'subir PDFs');
    await uploadDialog.getByTestId('document-upload-close').click();
    await expect(uploadDialog).toBeHidden();
  });

  test('a 390 × 844: formulario y versión sin desborde, pie con botones de 44 px, vista previa a pantalla completa y propagar entero (R15, R20, R23, R47)', async ({
    page,
  }) => {
    await openEdit(page, PHONE);
    const { baseId, reviewId } = seeded();

    // R20: el formulario no desborda en horizontal. Suave: el resto del caso sigue midiendo.
    await expectNoHorizontalScroll(page, '390 formulario', true);

    // R15: el pie se ve sin desplazar, con sus tres botones de 44 px dentro de la ventana.
    const footer = page.getByTestId(TESTIDS.footer);
    for (const testId of [TESTIDS.previewOpen, TESTIDS.cancel, TESTIDS.submit]) {
      const target = await expectTarget(footer.getByTestId(testId), `pie: ${testId}`);
      expect(target.x, `${testId}: dentro por la izquierda`).toBeGreaterThanOrEqual(0);
      expect(target.x + target.width, `${testId}: dentro por la derecha`).toBeLessThanOrEqual(PHONE.width);
      expect(target.y + target.height, `${testId}: visible sin desplazar`).toBeLessThanOrEqual(PHONE.height);
    }

    // R23: la vista previa ocupa la pantalla visible entera, con «Anterior» y «Siguiente» dentro.
    const preview = await openPreview(page);
    const previewBox = await box(preview);
    expect(Math.abs(previewBox.x), 'vista previa: pegada a la izquierda').toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    expect(Math.abs(previewBox.y), 'vista previa: pegada arriba').toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    expect(Math.abs(previewBox.width - PHONE.width), 'vista previa: todo el ancho').toBeLessThanOrEqual(
      EDGE_TOLERANCE_PX,
    );
    expect(Math.abs(previewBox.height - PHONE.height), 'vista previa: todo el alto').toBeLessThanOrEqual(
      EDGE_TOLERANCE_PX,
    );
    expect(
      await preview.evaluate((el) => Number.parseFloat(getComputedStyle(el).borderTopLeftRadius)),
      'vista previa: sin radio',
    ).toBe(0);
    for (const testId of [TESTIDS.readerPrevious, TESTIDS.readerNext]) {
      const target = await expectTarget(preview.getByTestId(testId), `vista previa: ${testId}`);
      expect(target.y, `${testId}: dentro`).toBeGreaterThanOrEqual(previewBox.y);
      expect(target.x + target.width, `${testId}: dentro por la derecha`).toBeLessThanOrEqual(PHONE.width);
      expect(target.y + target.height, `${testId}: visible`).toBeLessThanOrEqual(PHONE.height);
    }
    await closePreview(page);

    // R47: el diálogo de propagar queda entero, con botones de 44 px. Se cancela.
    const propagate = await openPropagate(page);
    await expectWhole(page, propagate, 'propagar');
    await expectDialogButtons(propagate, 'propagar');
    await cancelPropagate(page);

    // R20: la página de una versión tampoco desborda.
    const response = await page.goto(recipeVersionRoute(baseId, reviewId));
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId(TESTIDS.versionForm)).toBeVisible({ timeout: 60_000 });
    await expectNoHorizontalScroll(page, '390 versión');
  });

  test('a 390 × 844: la revisión de un PDF de fórmula no desborda en horizontal (R20)', async ({ page }) => {
    const uploads = await interceptSignedUploads(page);
    await openList(page, PHONE);

    const uploadDialog = page.getByTestId(TESTIDS.uploadDialog);
    await clickUntilVisible(page.getByTestId(TESTIDS.uploadOpen), uploadDialog);
    await uploadDialog
      .getByTestId(TESTIDS.uploadInput)
      .setInputFiles([{ name: PDF_FILE_NAME, mimeType: PDF_MIME_TYPE, buffer: pdfBytes }]);
    await uploadDialog.getByTestId(TESTIDS.uploadSubmit).click();
    await expect(uploadDialog.getByTestId(TESTIDS.uploadRowStatus)).toHaveAttribute('data-status', 'done', {
      timeout: 120_000,
    });
    expect(uploads.count(), 'el PDF sube sus bytes desde el navegador').toBe(1);

    await uploadDialog.getByTestId(TESTIDS.uploadRowReview).click();
    await page.waitForURL((url) => url.pathname.includes('/importar/'), { timeout: 60_000 });
    await expect(page.getByTestId(TESTIDS.importReview)).toBeVisible({ timeout: 60_000 });
    await expectNoHorizontalScroll(page, '390 revisión');
  });
});
