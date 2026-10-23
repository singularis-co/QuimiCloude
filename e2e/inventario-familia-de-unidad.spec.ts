/**
 * E2E del alta de un insumo sobre un homonimo de la misma familia de unidad (QC-203 R30): con
 * «Glicerina» en l en el inventario, un alta de «Glicerina» con 500 ml avisa de la conversion
 * antes de guardar, y al guardar el lote entra en el producto en l convertido a 0,5 l, sin crear
 * otro «Glicerina» en ml.
 *
 * DATOS: el usuario y la empresa llevan el prefijo `qc203_e2e_` y el `RUN_ID` del worker. El
 * producto se llama «Glicerina» a secas: los homonimos se buscan por empresa, y la empresa es
 * propia de la corrida. La limpieza borra por esa empresa. Los huerfanos se barren por prefijo y
 * edad para no llevarse lo que el otro proyecto (Chromium/WebKit) acaba de crear.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizeProductName } from '@/lib/modules/inventario';
import { normalizeUnitName } from '@/lib/modules/unidades';
import { prisma } from '@/lib/shared/db/prisma';
import { INVENTORY_ROUTE } from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';
import { exactProductNameCellText } from './helpers/product-name-cell';

const FIXTURE_PREFIX = 'qc203_e2e_';
const RUN_ID = randomUUID().replace(/-/g, '');
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;
const LIST_PAGE_SIZE = '25';
/** El valor del selector de unidad sin el glifo de la flecha, que tambien vive en el disparador. */
const SELECT_VALUE = '[data-slot="select-value"]';
const INVENTORY_SEARCH_PARAM = 'q';

type Credentials = { readonly username: string; readonly password: string };
type SystemUnitFixture = { readonly id: string; readonly label: string };

const adminUser: Credentials = {
  username: `${FIXTURE_PREFIX}admin_${RUN_ID}`,
  password: `Qc203-Admin-${RUN_ID.slice(0, 12)}`,
};
const companyName = `${FIXTURE_PREFIX}empresa_${RUN_ID}`;
const productName = 'Glicerina';
const seededLot = `QC203-E2E-${RUN_ID.slice(0, 12)}`;

/** Existencia sembrada en l, y lo que se escribe en el alta en ml. */
const SEEDED_STOCK = '2.0000';
const SEEDED_STOCK_SHOWN = '2';
const NEW_STOCK_ML = '500';
const NEW_STOCK_SHOWN = '2.5';
const NEW_BATCH_STOCK_STORED = '0.5000';
const NEW_UNIT_COST_ML = '0.02';
const QTY_ALERT = '1';

let companyId: string | null = null;
let litroUnit: SystemUnitFixture | null = null;
let mililitroUnit: SystemUnitFixture | null = null;

function fixture<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`${what} no existe: fallo el beforeAll`);
  return value;
}

async function findSystemUnit(name: string): Promise<SystemUnitFixture> {
  const row = await prisma.unit.findFirst({
    where: { companyId: null, nameNormalized: normalizeUnitName(name) },
    select: { id: true, symbol: true, name: true },
  });
  if (row === null) {
    throw new Error(
      `falta la unidad de sistema "${name}": aplica las migraciones (\`pnpm run db:migrate\`) ` +
        'antes de correr `pnpm run e2e`.',
    );
  }
  return { id: row.id, label: row.symbol ?? row.name };
}

/** La lista filtrada por el nombre del producto: una sola pagina, sin depender del orden. */
async function abrirInventarioFiltrado(page: Page): Promise<void> {
  const query = new URLSearchParams({
    pageSize: LIST_PAGE_SIZE,
    [INVENTORY_SEARCH_PARAM]: productName,
  });
  await page.goto(`${INVENTORY_ROUTE}?${query.toString()}`);
  await expect(page.getByTestId('inventario-title')).toBeVisible({ timeout: 60_000 });
}

function filaDelProducto(page: Page): Locator {
  return page
    .getByTestId('data-table-cell-name')
    .filter({ hasText: exactProductNameCellText(productName) })
    .locator('xpath=ancestor::tr[1]');
}

async function borrarDatosDeEmpresas(companyIds: readonly string[]): Promise<void> {
  if (companyIds.length === 0) return;
  const where = { companyId: { in: [...companyIds] } };
  // Orden de las FK `Restrict`: asientos -> lotes -> productos.
  await prisma.inventoryMovement.deleteMany({ where });
  await prisma.productBatch.deleteMany({ where });
  await prisma.product.deleteMany({ where });
}

test.beforeAll(async () => {
  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  const orphanCompanyIds = (
    await prisma.company.findMany({
      where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
      select: { id: true },
    })
  ).map((company) => company.id);
  await borrarDatosDeEmpresas(orphanCompanyIds);
  await prisma.user.deleteMany({
    where: {
      username: { startsWith: FIXTURE_PREFIX },
      OR: [{ createdAt: { lt: orphanCutoff } }, { companyId: { in: orphanCompanyIds } }],
    },
  });
  if (orphanCompanyIds.length > 0) {
    await prisma.company.deleteMany({ where: { id: { in: orphanCompanyIds } } });
  }

  const ownCompanyId = (
    await prisma.company.create({
      data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
      select: { id: true },
    })
  ).id;
  companyId = ownCompanyId;

  const role = await prisma.role.findUnique({
    where: { name: ROLE_ADMINISTRADOR },
    select: { id: true },
  });
  if (role === null) {
    throw new Error(
      `falta el rol "${ROLE_ADMINISTRADOR}": siembra la base con \`pnpm run db:seed\` antes de ` +
        'correr `pnpm run e2e`.',
    );
  }
  const adminId = (
    await createFixtureUser({
      data: {
        firstNames: `Qc203${RUN_ID.slice(0, 8)}`,
        lastNames: 'Familia',
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

  const litro = await findSystemUnit('litro');
  litroUnit = litro;
  mililitroUnit = await findSystemUnit('mililitro');

  // «Glicerina» en l con un lote de existencia conocida: el homonimo al que va el alta.
  const productId = (
    await prisma.product.create({
      data: {
        name: productName,
        nameNormalized: normalizeProductName(productName),
        unitId: litro.id,
        stock: SEEDED_STOCK,
        qtyAlert: QTY_ALERT,
        companyId: ownCompanyId,
      },
      select: { id: true },
    })
  ).id;
  const purchaseDate = new Date('2026-01-01T00:00:00Z');
  const batchId = (
    await prisma.productBatch.create({
      data: {
        productId,
        presentationId: null,
        companyId: ownCompanyId,
        stock: SEEDED_STOCK,
        unitCost: '20.0000',
        lot: seededLot,
        purchaseDate,
        createdBy: adminId,
      },
      select: { id: true },
    })
  ).id;
  await prisma.inventoryMovement.create({
    data: {
      batchId,
      kind: 'opening',
      quantity: SEEDED_STOCK,
      reason: null,
      companyId: ownCompanyId,
      createdBy: adminId,
      createdAt: purchaseDate,
    },
  });
});

test.afterAll(async () => {
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    () => borrarDatosDeEmpresas(companyId === null ? [] : [companyId]),
    () => prisma.user.deleteMany({ where: { username: adminUser.username } }),
    () => prisma.company.deleteMany({ where: { name: companyName } }),
  ];

  let primerFallo: unknown;
  for (const paso of pasos) {
    try {
      await paso();
    } catch (error) {
      primerFallo ??= error;
    }
  }

  await prisma.$disconnect();

  if (primerFallo !== undefined) throw primerFallo;
});

// El primer `goto` compila la ruta bajo demanda y bcrypt es lento a proposito.
test.setTimeout(240_000);

test.describe('alta de insumo sobre un homonimo de la misma familia de unidad', () => {
  test('R30 alta de Glicerina 500 ml sobre Glicerina en l avisa, guarda y la existencia sube 0,5 l', async ({
    page,
  }) => {
    const l = fixture(litroUnit, 'la unidad litro');
    const ml = fixture(mililitroUnit, 'la unidad mililitro');
    const ownCompanyId = fixture(companyId, 'la empresa del fixture');

    await loginAndLand(page, adminUser);

    // --- 1. Antes: «Glicerina» en l con la existencia sembrada.
    await abrirInventarioFiltrado(page);
    await expect(filaDelProducto(page)).toHaveCount(1, { timeout: 60_000 });
    await expect(filaDelProducto(page).getByTestId('product-stock')).toHaveText(
      `${SEEDED_STOCK_SHOWN} ${l.label}`,
      { timeout: 60_000 },
    );

    // --- 2. «Nuevo producto»: nombre, unidad ml y existencia 500.
    await page.getByTestId('product-create-open').first().click();
    await expect(page.getByTestId('product-sheet')).toBeVisible({ timeout: 60_000 });

    const nameField = page.getByTestId('product-field-name');
    await nameField.click();
    await nameField.fill(productName);
    const nameOption = page.getByTestId('product-name-option').filter({ hasText: productName });
    await expect(nameOption.first()).toBeVisible({ timeout: 60_000 });
    await nameOption.first().click();
    await expect(page.getByTestId('product-name-value')).toHaveValue(productName, {
      timeout: 60_000,
    });

    const unitSelect = page.getByTestId('presentation-unit-select');
    await unitSelect.click();
    await page.locator(`[data-testid="presentation-unit-option"][data-value="${ml.id}"]`).click();
    await expect(unitSelect.locator(SELECT_VALUE)).toHaveText(ml.label, { timeout: 60_000 });

    await page.getByTestId('product-field-stock').fill(NEW_STOCK_ML);
    await page.getByTestId('product-field-qtyAlert').fill(QTY_ALERT);
    await page.getByTestId('product-field-unitCost').fill(NEW_UNIT_COST_ML);

    // --- 3. El aviso, antes de guardar: va a «Glicerina» en l y 500 ml son 0,5 l.
    const notice = page.getByTestId('supply-conversion-notice');
    await expect(notice).toBeVisible({ timeout: 60_000 });
    await expect(notice).toContainText(`Ya existe ${productName} en ${l.label}`);
    await expect(page.getByTestId('supply-conversion-notice-stock')).toHaveText(
      `${NEW_STOCK_ML} ${ml.label} = 0,5 ${l.label}`,
    );

    // --- 4. Guardar: la existencia del MISMO producto sube 0,5 l, sin otro «Glicerina».
    await page.getByTestId('product-form-submit').click();
    await expect(page.getByTestId('product-sheet')).toHaveCount(0, { timeout: 60_000 });
    await expect(filaDelProducto(page).getByTestId('product-stock')).toHaveText(
      `${NEW_STOCK_SHOWN} ${l.label}`,
      { timeout: 60_000 },
    );

    await abrirInventarioFiltrado(page);
    await expect(filaDelProducto(page)).toHaveCount(1, { timeout: 60_000 });
    await expect(filaDelProducto(page).getByTestId('product-stock')).toHaveText(
      `${NEW_STOCK_SHOWN} ${l.label}`,
      { timeout: 60_000 },
    );

    // --- 5. Contra Postgres: un solo producto vivo, en l, y su nuevo lote con 0.5000.
    const products = await prisma.product.findMany({
      where: { companyId: ownCompanyId, name: productName, deletedAt: null },
      select: { id: true, unitId: true },
    });
    expect(products, 'el alta en ml no puede crear otro producto').toHaveLength(1);
    const [glicerina] = products;
    expect(glicerina?.unitId, 'el producto sigue en l').toBe(l.id);

    const newBatches = await prisma.productBatch.findMany({
      where: { productId: glicerina?.id, lot: { not: seededLot } },
      select: { stock: true },
    });
    expect(newBatches, 'el alta deja un lote nuevo en el producto en l').toHaveLength(1);
    expect(newBatches[0]?.stock.toFixed(4), 'el lote se guarda convertido a l').toBe(
      NEW_BATCH_STOCK_STORED,
    );
  });
});
