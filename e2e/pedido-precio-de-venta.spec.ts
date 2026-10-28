/**
 * E2E del precio de venta del pedido: alta con precio desde la pantalla, el precio en su columna
 * de la tabla y precargado al reabrir el pedido para editarlo.
 *
 * DATOS: empresa, usuario, receta y unidad son efimeros, con el prefijo `qc307_e2e_` y el `RUN_ID`
 * del worker, y se borran en `afterAll` por los ids y nombres de ESTE worker: Chromium y WebKit
 * comparten base.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import { normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizeRecipeName } from '@/lib/modules/recetas';
import { normalizeUnitName } from '@/lib/modules/unidades';
import { prisma } from '@/lib/shared/db/prisma';
import { ORDERS_ROUTE } from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand, type Credentials } from './helpers/landing';
import {
  openOrderRowMenu,
  orderMenuTrigger,
  submitOrderWithLeftover,
} from './helpers/order-distribution';

const FIXTURE_PREFIX = 'qc307_e2e_';

const RUN_ID = randomUUID().replace(/-/g, '');

/** Una hora deja fuera cualquier ejecucion viva y dentro cualquier resto de una anterior. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const SHARED_TOKEN = `${FIXTURE_PREFIX}${RUN_ID}`;

const COMPANY_NAME = `${SHARED_TOKEN}_empresa`;
const RECIPE_NAME = `${SHARED_TOKEN}_receta`;
const UNIT_NAME = `${SHARED_TOKEN}_unidad`;
const ORDER_QUANTITY = '3';

const SALE_PRICE_TYPED = '1250.5';
const SALE_PRICE_DISPLAYED = '$1,250.50';
const SALE_PRICE_STORED = '1250.5';

const adminUser: Credentials = {
  username: `${SHARED_TOKEN}_admin`,
  password: `Qc307-Admin-${RUN_ID.slice(0, 12)}`,
};

const LIST_PAGE_SIZE = '25';
const LIST_SORT = 'createdAt:desc';

const ORDERS_TITLE = 'pedidos-title';
const CREATE_OPEN = 'order-create-open';
const ORDER_FORM = 'order-form';
const RECIPE_PICKER = 'recipe-picker';
const RECIPE_PICKER_OPTION = 'recipe-picker-option';
const RECIPE_PICKER_VALUE = 'recipe-picker-value';
const UNIT_SELECT = 'presentation-unit-select';
const UNIT_OPTION = 'presentation-unit-option';
const QUANTITY_FIELD = 'order-field-quantity';
const SALE_PRICE_FIELD = 'order-field-salePrice';
const SALE_PRICE_CELL = 'order-sale-price';
const EDIT_ACTION = 'order-action-edit';

let companyId: string | null = null;
let adminId: string | null = null;
let recipeId: string | null = null;
let unitId: string | null = null;

function required<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`falta ${what}: fallo el beforeAll`);
  return value;
}

function ordersUrl(): string {
  const query = new URLSearchParams({ pageSize: LIST_PAGE_SIZE, sort: LIST_SORT });
  return `${ORDERS_ROUTE}?${query.toString()}`;
}

function orderRow(page: Page, orderId: string) {
  return page.locator(`[data-testid="data-table-row-${orderId}"]`);
}

test.beforeAll(async () => {
  const adminRole = await prisma.role.findUnique({
    where: { name: ROLE_ADMINISTRADOR },
    select: { id: true },
  });
  if (!adminRole) {
    throw new Error(
      `falta el rol "${ROLE_ADMINISTRADOR}": siembra la base con \`pnpm run db:seed\` antes de ` +
        'correr `pnpm run e2e`.',
    );
  }

  // Huerfanos de una ejecucion interrumpida, por prefijo y edad. El orden lo imponen las FK.
  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  const orphanCompanyIds = (
    await prisma.company.findMany({
      where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
      select: { id: true },
    })
  ).map((company) => company.id);
  if (orphanCompanyIds.length > 0) {
    const inCompanies = { companyId: { in: orphanCompanyIds } };
    await prisma.reservationMovement.deleteMany({ where: inCompanies });
    await prisma.inventoryMovement.deleteMany({ where: inCompanies });
    await prisma.orderAssignment.deleteMany({ where: inCompanies });
    await prisma.orderPresentationLine.deleteMany({ where: inCompanies });
    await prisma.order.deleteMany({ where: inCompanies });
    await prisma.recipe.deleteMany({ where: inCompanies });
    await prisma.unit.deleteMany({ where: inCompanies });
  }
  await prisma.user.deleteMany({
    where: { username: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
  });
  if (orphanCompanyIds.length > 0) {
    await prisma.company.deleteMany({ where: { id: { in: orphanCompanyIds } } });
  }

  companyId = (
    await prisma.company.create({
      data: { name: COMPANY_NAME, nameNormalized: normalizeCompanyName(COMPANY_NAME) },
      select: { id: true },
    })
  ).id;

  adminId = (
    await createFixtureUser({
      data: {
        firstNames: `Qc307${RUN_ID.slice(0, 8)}`,
        lastNames: 'Precio',
        birthDate: new Date('1990-01-01'),
        email: `${adminUser.username}@example.test`,
        phone: '+573000000000',
        documentTypeCode: 'CC',
        documentNumber: adminUser.username,
        username: adminUser.username,
        passwordHash: await createPasswordHash(adminUser.password),
        roleId: adminRole.id,
        companyId,
        accountStatus: 'active',
      },
      select: { id: true },
    })
  ).id;

  recipeId = (
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

  unitId = (
    await prisma.unit.create({
      data: { name: UNIT_NAME, nameNormalized: normalizeUnitName(UNIT_NAME), companyId },
      select: { id: true },
    })
  ).id;
});

test.afterAll(async () => {
  // Por los ids y nombres de ESTE worker. Cada paso corre aunque falle el anterior y el primer
  // fallo se relanza al final.
  const inCompany = { companyId: companyId ?? '00000000-0000-0000-0000-000000000000' };
  const pasos: ReadonlyArray<() => Promise<unknown>> = [
    () => prisma.reservationMovement.deleteMany({ where: inCompany }),
    () => prisma.inventoryMovement.deleteMany({ where: inCompany }),
    () => prisma.orderAssignment.deleteMany({ where: inCompany }),
    () => prisma.orderPresentationLine.deleteMany({ where: inCompany }),
    () => prisma.order.deleteMany({ where: inCompany }),
    () => prisma.recipe.deleteMany({ where: { name: RECIPE_NAME } }),
    () => prisma.unit.deleteMany({ where: { name: UNIT_NAME } }),
    () => prisma.user.deleteMany({ where: { username: adminUser.username } }),
    () => prisma.company.deleteMany({ where: { name: COMPANY_NAME } }),
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

// El primer `goto` compila la ruta bajo demanda en `next dev` y bcrypt tarda a proposito.
test.setTimeout(240_000);

test.describe('precio de venta del pedido', () => {
  test('QC-307 R22 — registra un pedido con precio, lo ve en la columna y precargado al editarlo', async ({
    page,
  }) => {
    await loginAndLand(page, adminUser);
    await page.goto(ordersUrl());
    await expect(page.getByTestId(ORDERS_TITLE)).toBeVisible({ timeout: 60_000 });

    await page.getByTestId(CREATE_OPEN).first().click();
    const form = page.getByTestId(ORDER_FORM);
    await expect(form).toBeVisible({ timeout: 60_000 });

    const recipePicker = page.getByTestId(RECIPE_PICKER);
    await recipePicker.click();
    await recipePicker.fill(RECIPE_NAME);
    const recipeOption = page.getByTestId(RECIPE_PICKER_OPTION).filter({ hasText: RECIPE_NAME });
    await expect(recipeOption).toHaveCount(1, { timeout: 60_000 });
    await recipeOption.click();
    await expect(page.getByTestId(RECIPE_PICKER_VALUE)).toHaveValue(required(recipeId, 'la receta'));

    await page.getByTestId(QUANTITY_FIELD).fill(ORDER_QUANTITY);
    await form.getByTestId(UNIT_SELECT).click();
    await page.locator(`[data-testid="${UNIT_OPTION}"][data-value="${unitId}"]`).click();

    await form.getByTestId(SALE_PRICE_FIELD).fill(SALE_PRICE_TYPED);
    // Sin reparto toda la cantidad queda sin envasar: Guardar pregunta antes.
    await submitOrderWithLeftover(page, form);
    await expect(form).toHaveCount(0, { timeout: 60_000 });

    const created = await prisma.order.findMany({
      where: { companyId: required(companyId, 'la empresa') },
      select: { id: true, salePrice: true },
    });
    expect(created, 'el alta deja exactamente un pedido nuevo').toHaveLength(1);
    const createdOrder = created[0]!;
    expect(createdOrder.salePrice?.toString(), 'el alta guarda el precio escrito').toBe(
      SALE_PRICE_STORED,
    );

    await expect(orderRow(page, createdOrder.id).getByTestId(SALE_PRICE_CELL)).toHaveText(
      SALE_PRICE_DISPLAYED,
      { timeout: 60_000 },
    );

    await (await openOrderRowMenu(page, orderMenuTrigger(page, createdOrder.id), EDIT_ACTION)).click();
    const editForm = page.getByTestId(ORDER_FORM);
    await expect(editForm).toBeVisible({ timeout: 60_000 });
    await expect(editForm.getByTestId(SALE_PRICE_FIELD)).toHaveValue(SALE_PRICE_TYPED);
  });
});
