/**
 * E2E del teléfono de cliente con país: alta con el país de la empresa, lo que queda en la base,
 * el duplicado, la empresa sin país, los avisos de los migrados en la lista y el campo en teléfono.
 *
 * Cada worker crea DOS empresas efímeras: una con país `CO` y otra sin país. Un administrador en
 * cada una. Los clientes se aíslan por `companyId`.
 *
 * Los textos esperados salen del dominio o del catálogo de errores, nunca escritos a mano:
 *  - el formato internacional, de `formatPhoneInternational`. El literal depende de los metadatos
 *    de `libphonenumber-js` (hoy `+57 300 1234567`, no el `+57 300 123 4567` del spec); cuál es el
 *    correcto está pendiente de decisión del humano;
 *  - la etiqueta corta de un migrado, de `describeCustomerPhone`;
 *  - los errores del servidor, de `errorMessage`.
 *
 * Los `data-testid` van como constantes locales: los módulos de la ruta son de cliente y este
 * archivo corre en Node (mismo criterio que `e2e/clientes.spec.ts`).
 *
 * SE CORRE con `pnpm exec playwright test e2e/clientes-telefono.spec.ts --project=chromium
 * --project=webkit`. Necesita la base sembrada (`pnpm run db:seed`) y las migraciones al día.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

import {
  describeCustomerPhone,
  formatPhoneInternational,
  normalizeCustomerText,
} from '@/lib/modules/clientes';
import { errorMessage } from '@/lib/modules/errores';
import { DOCUMENT_TYPE_CC, ROLE_ADMINISTRADOR, normalizeCompanyName } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { prisma } from '@/lib/shared/db/prisma';
import { CUSTOMERS_ROUTE } from '@/lib/shared/routes';

import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';

const FIXTURE_PREFIX = 'qc236_e2e_';
const RUN_ID = randomUUID().replace(/-/g, '');
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

const TITLE_TESTID = 'clientes-title';
const CREATE_OPEN_TESTID = 'customer-create-open';
const SHEET_TESTID = 'customer-sheet';
const FORM_TESTID = 'customer-form';
const FORM_SUBMIT_TESTID = 'customer-form-submit';
const FIELD_FIRST_NAMES_TESTID = 'customer-field-first-names';
const FIELD_LAST_NAMES_TESTID = 'customer-field-last-names';
const FIELD_CITY_TESTID = 'customer-field-city';
const FIELD_PHONE_COUNTRY_TESTID = 'customer-field-phone-country';
const FIELD_PHONE_NUMBER_TESTID = 'customer-field-phone-number';
const ERROR_PHONE_COUNTRY_TESTID = 'customer-error-phone-country';
const ERROR_PHONE_NUMBER_TESTID = 'customer-error-phone-number';
const PHONE_CELL_TESTID = 'data-table-cell-phone';

/** Nombre del selector de país del campo, tal como lo declara el campo (rótulo oculto). */
const PHONE_COUNTRY_LABEL = 'País del teléfono';

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

const COMPANY_COUNTRY = 'CO';
const TYPED_NUMBER = '300 123 4567';
const EXPECTED_E164 = '573001234567';
/** Demasiado corto para Colombia con los metadatos `max`. */
const INVALID_NUMBER = '300 12';

type Credentials = { readonly username: string; readonly password: string };

const adminWithCountry: Credentials = {
  username: `${FIXTURE_PREFIX}admin_co_${RUN_ID}`,
  password: `Qc236-Co-${RUN_ID.slice(0, 12)}`,
};

const adminWithoutCountry: Credentials = {
  username: `${FIXTURE_PREFIX}admin_sin_${RUN_ID}`,
  password: `Qc236-Sin-${RUN_ID.slice(0, 12)}`,
};

const companyWithCountryName = `${FIXTURE_PREFIX}empresa_co_${RUN_ID}`;
const companyWithoutCountryName = `${FIXTURE_PREFIX}empresa_sin_${RUN_ID}`;

let companyWithCountryId: string | null = null;
let companyWithoutCountryId: string | null = null;

async function createAdmin(user: Credentials, companyId: string): Promise<void> {
  const role = await prisma.role.findUnique({
    where: { name: ROLE_ADMINISTRADOR },
    select: { id: true },
  });
  if (!role) {
    throw new Error(
      `falta el rol "${ROLE_ADMINISTRADOR}": siembra la base con \`pnpm run db:seed\` antes de correr este E2E.`,
    );
  }
  await createFixtureUser({
    data: {
      firstNames: `Qc236${RUN_ID.slice(0, 8)}`,
      lastNames: 'Telefono',
      birthDate: new Date('1990-01-01'),
      email: `${user.username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: user.username,
      username: user.username,
      passwordHash: await createPasswordHash(user.password),
      roleId: role.id,
      companyId,
    },
    select: { id: true },
  });
}

function requireId(id: string | null): string {
  if (id === null) throw new Error('la empresa del fixture no existe: falló el beforeAll');
  return id;
}

/** Nombres únicos por caso, para localizar la fila y la fila de la base sin ambigüedad. */
function customerNames(tag: string) {
  return {
    firstNames: `${FIXTURE_PREFIX}${tag}`,
    lastNames: `Telefono${tag}${RUN_ID.slice(0, 10)}`,
    city: `Cali${tag}`,
  };
}

async function seedCustomer(
  companyId: string,
  tag: string,
  phone: { phone: string; phoneCountry: string; phoneIssue: 'invalid_format' | 'duplicate' },
): Promise<string> {
  const names = customerNames(tag);
  const created = await prisma.customer.create({
    data: {
      ...names,
      firstNamesNormalized: normalizeCustomerText(names.firstNames),
      lastNamesNormalized: normalizeCustomerText(names.lastNames),
      cityNormalized: normalizeCustomerText(names.city),
      companyId,
      ...phone,
    },
    select: { id: true },
  });
  return created.id;
}

async function openCustomers(page: Page): Promise<void> {
  await page.goto(CUSTOMERS_ROUTE);
  await expect(page.getByTestId(TITLE_TESTID)).toBeVisible({ timeout: 60_000 });
}

async function openCreateSheet(page: Page): Promise<void> {
  await page.getByTestId(CREATE_OPEN_TESTID).first().click();
  await expect(page.getByTestId(SHEET_TESTID)).toBeVisible({ timeout: 60_000 });
}

async function fillRequired(page: Page, tag: string): Promise<ReturnType<typeof customerNames>> {
  const names = customerNames(tag);
  await page.getByTestId(FIELD_FIRST_NAMES_TESTID).fill(names.firstNames);
  await page.getByTestId(FIELD_LAST_NAMES_TESTID).fill(names.lastNames);
  await page.getByTestId(FIELD_CITY_TESTID).fill(names.city);
  return names;
}

function hiddenPhoneCountry(page: Page) {
  return page.getByTestId(FORM_TESTID).locator('input[type="hidden"][name="phoneCountry"]');
}

test.beforeAll(async () => {
  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  await prisma.customer.deleteMany({
    where: { firstNames: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
  });
  await prisma.user.deleteMany({
    where: { username: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
  });
  await prisma.company.deleteMany({
    where: { name: { startsWith: FIXTURE_PREFIX }, createdAt: { lt: orphanCutoff } },
  });

  companyWithCountryId = (
    await prisma.company.create({
      data: {
        name: companyWithCountryName,
        nameNormalized: normalizeCompanyName(companyWithCountryName),
        country: COMPANY_COUNTRY,
      },
      select: { id: true },
    })
  ).id;
  companyWithoutCountryId = (
    await prisma.company.create({
      data: {
        name: companyWithoutCountryName,
        nameNormalized: normalizeCompanyName(companyWithoutCountryName),
      },
      select: { id: true },
    })
  ).id;

  await createAdmin(adminWithCountry, companyWithCountryId);
  await createAdmin(adminWithoutCountry, companyWithoutCountryId);
});

test.afterAll(async () => {
  const companyIds = [companyWithCountryId, companyWithoutCountryId].filter(
    (id): id is string => id !== null,
  );
  try {
    await prisma.customer.deleteMany({ where: { companyId: { in: companyIds } } });
  } finally {
    try {
      await prisma.user.deleteMany({
        where: { username: { in: [adminWithCountry.username, adminWithoutCountry.username] } },
      });
    } finally {
      try {
        await prisma.company.deleteMany({
          where: { name: { in: [companyWithCountryName, companyWithoutCountryName] } },
        });
      } finally {
        await prisma.$disconnect();
      }
    }
  }
});

test.setTimeout(180_000);

test.describe('teléfono de cliente con código de país', () => {
  test('R2, R11, R29, R12 — empresa con CO: el alta abre con Colombia, guarda CO y 573001234567, la lista lo muestra internacional y la misma alta otra vez da duplicado bajo el número', async ({
    page,
  }) => {
    const companyId = requireId(companyWithCountryId);
    // Un reintento del mismo worker no debe tropezar con el alta del intento anterior.
    await prisma.customer.deleteMany({ where: { companyId, phoneE164: EXPECTED_E164 } });

    await loginAndLand(page, adminWithCountry);
    await openCustomers(page);
    await openCreateSheet(page);

    // R2: el país de la empresa viene marcado.
    await expect(hiddenPhoneCountry(page)).toHaveValue(COMPANY_COUNTRY);

    const names = await fillRequired(page, `alta${RUN_ID.slice(0, 6)}`);
    await page.getByTestId(FIELD_PHONE_NUMBER_TESTID).fill(TYPED_NUMBER);
    await page.getByTestId(FORM_SUBMIT_TESTID).click();
    await expect(page.getByTestId(SHEET_TESTID)).toHaveCount(0, { timeout: 60_000 });

    // R11: lo que queda en la base.
    const created = await prisma.customer.findFirstOrThrow({
      where: { companyId, lastNames: names.lastNames },
      select: { id: true, phoneCountry: true, phoneE164: true, phoneIssue: true },
    });
    expect(created.phoneCountry).toBe(COMPANY_COUNTRY);
    expect(created.phoneE164).toBe(EXPECTED_E164);
    expect(created.phoneIssue).toBeNull();

    // R29: la lista lo muestra en formato internacional.
    await expect(
      page.getByTestId(`data-table-row-${created.id}`).getByTestId(PHONE_CELL_TESTID),
    ).toHaveText(formatPhoneInternational(EXPECTED_E164), { timeout: 60_000 });

    // R12: la misma alta otra vez se rechaza bajo el número y el panel sigue abierto.
    await openCreateSheet(page);
    await fillRequired(page, `dup${RUN_ID.slice(0, 6)}`);
    await page.getByTestId(FIELD_PHONE_NUMBER_TESTID).fill(TYPED_NUMBER);
    await page.getByTestId(FORM_SUBMIT_TESTID).click();

    await expect(page.getByTestId(ERROR_PHONE_NUMBER_TESTID)).toHaveText(
      errorMessage('customer_duplicate_phone'),
      { timeout: 60_000 },
    );
    await expect(page.getByTestId(SHEET_TESTID)).toBeVisible();
    expect(await prisma.customer.count({ where: { companyId, phoneE164: EXPECTED_E164 } })).toBe(1);
  });

  test('R9 — un número no válido para Colombia se marca en el campo y no se guarda', async ({
    page,
  }) => {
    const companyId = requireId(companyWithCountryId);
    await loginAndLand(page, adminWithCountry);
    await openCustomers(page);
    await openCreateSheet(page);

    const names = await fillRequired(page, `inv${RUN_ID.slice(0, 6)}`);
    const number = page.getByTestId(FIELD_PHONE_NUMBER_TESTID);
    await number.fill(INVALID_NUMBER);
    await number.blur();

    await expect(page.getByTestId(ERROR_PHONE_NUMBER_TESTID)).toBeVisible({ timeout: 60_000 });
    await expect(number).toHaveAttribute('aria-invalid', 'true');

    await page.getByTestId(FORM_SUBMIT_TESTID).click();
    await expect(page.getByTestId(SHEET_TESTID)).toBeVisible();
    expect(await prisma.customer.count({ where: { companyId, lastNames: names.lastNames } })).toBe(0);
  });

  test('R3, R8 — empresa sin país: el alta abre sin país y un número sin país da el error en el país', async ({
    page,
  }) => {
    const companyId = requireId(companyWithoutCountryId);
    await loginAndLand(page, adminWithoutCountry);
    await openCustomers(page);
    await openCreateSheet(page);

    // R3: ningún país marcado.
    await expect(hiddenPhoneCountry(page)).toHaveValue('');

    const names = await fillRequired(page, `sin${RUN_ID.slice(0, 6)}`);
    await page.getByTestId(FIELD_PHONE_NUMBER_TESTID).fill(TYPED_NUMBER);
    await page.getByTestId(FORM_SUBMIT_TESTID).click();

    // R8: el error va en el país, enlazado al disparador.
    const countryError = page.getByTestId(ERROR_PHONE_COUNTRY_TESTID);
    await expect(countryError).toHaveText(errorMessage('customer_phone_country_required'), {
      timeout: 60_000,
    });
    await expect(page.getByTestId(FIELD_PHONE_COUNTRY_TESTID)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId(SHEET_TESTID)).toBeVisible();
    expect(await prisma.customer.count({ where: { companyId, lastNames: names.lastNames } })).toBe(0);
  });

  test('R30 — los clientes sembrados con phone_issue muestran su teléfono antiguo y la etiqueta corta en la lista', async ({
    page,
  }) => {
    const companyId = requireId(companyWithCountryId);
    const migrated = [
      { phone: 'ext 204 oficina', phoneCountry: COMPANY_COUNTRY, phoneIssue: 'invalid_format' },
      { phone: '300 765 4321', phoneCountry: COMPANY_COUNTRY, phoneIssue: 'duplicate' },
    ] as const;
    const seeded = await Promise.all(
      migrated.map(async (phone, index) => ({
        id: await seedCustomer(companyId, `mig${index}${RUN_ID.slice(0, 6)}`, phone),
        phone,
      })),
    );

    await loginAndLand(page, adminWithCountry);
    await openCustomers(page);

    for (const { id, phone } of seeded) {
      const description = describeCustomerPhone({ ...phone, phoneE164: null });
      if (description.kind !== 'issue') throw new Error('el cliente sembrado debe tener aviso');
      const issue = page.getByTestId(`customer-phone-issue-${id}`);
      await expect(issue).toBeVisible({ timeout: 60_000 });
      await expect(issue).toContainText(phone.phone);
      await expect(issue.locator('[data-tone="waiting"]')).toHaveText(description.label);
    }
  });

  test('R33 — a 390 px el disparador dice CO +57 y la hoja se titula «País del teléfono»', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE_VIEWPORT);
    await loginAndLand(page, adminWithCountry);
    await openCustomers(page);
    await openCreateSheet(page);

    const trigger = page.getByTestId(FIELD_PHONE_COUNTRY_TESTID);
    await expect(trigger).toHaveText(/CO\s*\+57/, { timeout: 60_000 });
    await expect(trigger).toHaveAccessibleName(new RegExp(`^${PHONE_COUNTRY_LABEL}: Colombia$`));

    await trigger.click();
    await expect(page.getByRole('dialog', { name: PHONE_COUNTRY_LABEL })).toBeVisible({
      timeout: 60_000,
    });
  });
});
