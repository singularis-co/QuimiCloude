/**
 * E2E del proveedor IA de una empresa en `/integraciones/proveedor-ia` y del bloqueo de «Subir PDFs»
 * en «Fórmulas» mientras la empresa no tiene conexion: boton deshabilitado con un globo que enlaza
 * a la pantalla.
 *
 * Que aporta sobre unit e integracion:
 * - **El corte del flujo de subida con la base real**: sin fila en `ai_provider_connections` la
 *   pagina de «Fórmulas» pinta el boton deshabilitado con el globo; con fila, el boton se habilita.
 * - **El doble de la prueba cableado por la variable de `playwright.config.ts`**: una key con el
 *   prefijo marcado la rechaza; cualquier otra la acepta, sin red.
 * - **Que la key no vuelve**: tras guardar y recargar no esta ni en la pagina ni en el HTML servido,
 *   y la columna cifrada no la contiene.
 * - **Los permisos reales**: el Administrador del seed configura; un rol que sube PDF pero no tiene
 *   `integraciones.modificar` ve el mismo enlace y recibe 404 en la pantalla.
 * - Corre en Chromium y en WebKit (proyectos de `playwright.config.ts`).
 *
 * DATOS: la EMPRESA de cada worker, sus USUARIOS y el ROL sin permiso de integraciones son efimeros,
 * con el prefijo `qc275_e2e_` y el `RUN_ID` del proceso. Una empresa tiene como mucho una conexion:
 * cada caso borra antes la de su empresa, asi no depende del orden ni de un reintento. La limpieza
 * borra la conexion antes que los usuarios (`created_by`) y estos antes que el rol y la empresa.
 *
 * ENTRADA: siempre por `loginAndLand`.
 */
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { CANNED_INVALID_KEY_PREFIX } from '@/lib/modules/integraciones/adapters/driven/ai/ai-provider-probe-canned';
import { probeFailureMessage } from '@/lib/modules/integraciones/domain/ai-provider-failure';
import { prisma } from '@/lib/shared/db/prisma';
import { AI_PROVIDER_INTEGRATION_ROUTE, FORMULAS_ROUTE } from '@/lib/shared/routes';

import { enableAllAddons } from './helpers/addons';
import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';

const FIXTURE_PREFIX = 'qc275_e2e_';
const COMPANY_NAME_PREFIX = `${FIXTURE_PREFIX}empresa_`;
const ROLE_NAME_PREFIX = `${FIXTURE_PREFIX}rol_`;
const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit corren a la vez: lo huerfano se borra por edad, nunca por prefijo a secas. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

/** Sube PDF y abre «Fórmulas», pero no configura integraciones. */
const UPLOADER_PERMISSIONS = ['recetas.consultar', 'documentos.modificar'] as const;

const VALID_KEY = `qc275-e2e-valida-${RUN_ID}`;
const INVALID_KEY = `${CANNED_INVALID_KEY_PREFIX}_${RUN_ID}`;

/** `data-testid` de las pantallas (constantes locales: sus modulos son de cliente). */
const TESTIDS = {
  integrationTitle: 'integration-title',
  form: 'ai-provider-form',
  picker: 'ai-provider-picker',
  option: (code: string) => `ai-provider-option-${code}`,
  keyField: 'ai-provider-key',
  formResult: 'ai-provider-form-result',
  formTest: 'ai-provider-form-test',
  formSave: 'ai-provider-form-save',
  card: 'ai-provider-card',
  cardStatus: 'ai-provider-card-status',
  formHelp: 'ai-provider-form-help',
  modelSection: 'ai-provider-card-model',
  modelTrigger: 'ai-model-select-trigger',
  modelOption: 'ai-model-select-option',
  modelHelp: 'ai-model-select-help',
  cardDisconnect: 'ai-provider-card-disconnect',
  disconnectDialog: 'ai-provider-disconnect-dialog',
  disconnectConfirm: 'ai-provider-disconnect-confirm',
  recipesTitle: 'recipes-title',
  uploadOpen: 'document-upload-open',
  lockedTrigger: 'ai-provider-required-tooltip-trigger',
  lockedTooltip: 'ai-provider-required-tooltip',
  lockedLink: 'ai-provider-required-tooltip-link',
} as const;

/** Textos del tablero que el recorrido afirma. */
const TEXTS = {
  notConfigured: 'Sin configurar',
  connected: 'Conectado',
  testOk: 'Conexión correcta · el modelo en uso responde',
  helpModel: 'Después de conectar podrás elegir el modelo.',
  recommended: 'Recomendado',
  helpRecommended: 'Se usa el modelo recomendado de Gemini.',
  helpChosen: 'Elegido por tu empresa.',
  modelSaved: 'Modelo guardado',
  saved: 'Proveedor IA conectado',
  disconnected: 'Proveedor IA desconectado',
  lockedMessage: 'Para leer PDF, conecta el proveedor IA de tu empresa',
  enrollProvider: 'Inscribir proveedor',
} as const;

const REJECTED_KEY_MESSAGE = probeFailureMessage({
  kind: 'rejected_key',
  httpStatus: null,
  model: null,
});

let companyId: string | null = null;
let administradorRoleId: string | null = null;
let uploaderRoleId: string | null = null;

async function createUser(
  roleId: string | null,
  suffix: string,
): Promise<{ id: string; username: string; password: string }> {
  if (!roleId) throw new Error('el rol del fixture no se resolvio: fallo el beforeAll');
  if (!companyId) throw new Error('la empresa del fixture no existe: fallo el beforeAll');

  const username = `${FIXTURE_PREFIX}${RUN_ID}_${suffix}`;
  /** Contrasena conocida del usuario de prueba. Solo vive aqui; nunca se escribe en consola. */
  const password = `Qc275-E2E-${RUN_ID.slice(0, 12)}`;

  const user = await createFixtureUser({
    data: {
      firstNames: `Qc275${RUN_ID.slice(0, 8)}${suffix}`,
      lastNames: 'ProveedorIA',
      birthDate: new Date('1990-01-01'),
      email: `${username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: 'CC',
      documentNumber: `qc275${RUN_ID}${suffix}`,
      username,
      passwordHash: await createPasswordHash(password),
      roleId,
      companyId,
      accountStatus: 'active',
    },
    select: { id: true },
  });

  return { id: user.id, username, password };
}

/** El recomendado de Gemini y otro modelo suyo, leidos del catalogo sembrado. */
async function recommendedGeminiModel(): Promise<string> {
  const model = await prisma.aiModel.findFirstOrThrow({
    where: { provider: 'GOOGLE', isDefault: true },
    select: { modelId: true },
  });
  return model.modelId;
}

async function otherGeminiModel(): Promise<string> {
  const model = await prisma.aiModel.findFirstOrThrow({
    where: { provider: 'GOOGLE', isDefault: false },
    orderBy: { sortOrder: 'asc' },
    select: { modelId: true },
  });
  return model.modelId;
}

test.beforeAll(async () => {
  const role = await prisma.role.findUnique({
    where: { name: ROLE_ADMINISTRADOR },
    select: { id: true },
  });
  if (!role) throw new Error(`el rol '${ROLE_ADMINISTRADOR}' no existe: correr el seed antes de este E2E`);
  administradorRoleId = role.id;

  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  const orphanCompanyIds = (
    await prisma.company.findMany({
      where: { name: { startsWith: COMPANY_NAME_PREFIX }, createdAt: { lt: orphanCutoff } },
      select: { id: true },
    })
  ).map((company) => company.id);
  const orphanRoleIds = (
    await prisma.role.findMany({
      where: { name: { startsWith: ROLE_NAME_PREFIX }, createdAt: { lt: orphanCutoff } },
      select: { id: true },
    })
  ).map((orphan) => orphan.id);

  await prisma.aiProviderConnection.deleteMany({ where: { companyId: { in: orphanCompanyIds } } });
  await prisma.user.deleteMany({
    where: {
      username: { startsWith: FIXTURE_PREFIX },
      OR: [{ createdAt: { lt: orphanCutoff } }, { roleId: { in: orphanRoleIds } }],
    },
  });
  if (orphanRoleIds.length > 0) {
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: orphanRoleIds } } });
    await prisma.role.deleteMany({ where: { id: { in: orphanRoleIds } } });
  }
  await prisma.company.deleteMany({ where: { id: { in: orphanCompanyIds } } });

  const companyName = `${COMPANY_NAME_PREFIX}${RUN_ID}`;
  const company = await prisma.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  });
  companyId = company.id;
  await enableAllAddons(companyId);

  const uploaderRole = await prisma.role.create({
    data: {
      name: `${ROLE_NAME_PREFIX}${RUN_ID}`,
      description: 'Rol efimero del E2E del proveedor IA (QC-275). Se borra en afterAll.',
      permissions: { create: UPLOADER_PERMISSIONS.map((permissionCode) => ({ permissionCode })) },
    },
    select: { id: true },
  });
  uploaderRoleId = uploaderRole.id;
});

test.afterAll(async () => {
  try {
    if (companyId) await prisma.aiProviderConnection.deleteMany({ where: { companyId } });
  } finally {
    try {
      await prisma.user.deleteMany({ where: { username: { startsWith: `${FIXTURE_PREFIX}${RUN_ID}` } } });
    } finally {
      try {
        if (uploaderRoleId) {
          await prisma.rolePermission.deleteMany({ where: { roleId: uploaderRoleId } });
          await prisma.role.deleteMany({ where: { id: uploaderRoleId } });
        }
      } finally {
        try {
          await prisma.company.deleteMany({ where: { name: `${COMPANY_NAME_PREFIX}${RUN_ID}` } });
        } finally {
          await prisma.$disconnect();
        }
      }
    }
  }
});

// `next dev` compila cada ruta bajo demanda y bcrypt con coste 10 tarda a proposito.
test.setTimeout(180_000);

test.describe('el proveedor IA de la empresa', () => {
  test('R37, R30, R13, R16, R34, R17, R31, R8, R33, R20: «Subir PDFs» bloqueado en Fórmulas, key rechazada sin guardar, prueba y alta con el doble, la key fuera del HTML y desconectar', async ({
    page,
  }) => {
    if (!companyId) throw new Error('la empresa del fixture no existe: fallo el beforeAll');
    const fixtureCompanyId = companyId;
    await prisma.aiProviderConnection.deleteMany({ where: { companyId: fixtureCompanyId } });

    const credentials = await createUser(administradorRoleId, 'admin');
    await loginAndLand(page, credentials);

    const form = page.getByTestId(TESTIDS.form);
    const keyField = page.getByTestId(TESTIDS.keyField);
    const formResult = page.getByTestId(TESTIDS.formResult);

    await test.step('R37: sin conexion, Fórmulas pinta «Subir PDFs» deshabilitado con el globo «Inscribir proveedor»', async () => {
      await page.goto(FORMULAS_ROUTE);
      await expect(page.getByTestId(TESTIDS.recipesTitle)).toBeVisible({ timeout: 60_000 });

      await expect(page.getByTestId(TESTIDS.uploadOpen)).toBeDisabled();
      await page.getByTestId(TESTIDS.lockedTrigger).hover();
      await expect(page.getByTestId(TESTIDS.lockedTooltip)).toContainText(TEXTS.lockedMessage);
      await expect(page.getByTestId(TESTIDS.lockedLink)).toHaveText(TEXTS.enrollProvider);
    });

    await test.step('R30: el enlace lleva a la pantalla, «Sin configurar» y los cuatro proveedores', async () => {
      await page.getByTestId(TESTIDS.lockedLink).click();
      await page.waitForURL((url) => url.pathname === AI_PROVIDER_INTEGRATION_ROUTE, { timeout: 60_000 });

      await expect(form).toBeVisible({ timeout: 60_000 });
      await expect(form.getByText(TEXTS.notConfigured)).toBeVisible();
      await expect(page.getByTestId(TESTIDS.picker).getByRole('radio')).toHaveCount(4);
      await expect(page.getByTestId(TESTIDS.card)).toHaveCount(0);
      await expect(page.getByTestId(TESTIDS.formSave)).toBeDisabled();
      await expect(page.getByTestId(TESTIDS.formTest)).toBeDisabled();
    });

    await test.step('R16, R34, QT-291 R30: con Gemini la ayuda dice que el modelo se elige despues; una key rechazada, «Guardar y conectar» muestra el rechazo y no guarda nada', async () => {
      await page.getByTestId(TESTIDS.option('GOOGLE')).click();
      await expect(page.getByTestId(TESTIDS.option('GOOGLE'))).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId(TESTIDS.formHelp)).toContainText(TEXTS.helpModel);
      await expect(page.getByTestId(TESTIDS.formHelp)).not.toContainText(/gemini-/i);

      await keyField.fill(INVALID_KEY);
      await page.getByTestId(TESTIDS.formSave).click();

      await expect(formResult).toContainText(REJECTED_KEY_MESSAGE, { timeout: 60_000 });
      await expect(keyField).toHaveValue('');
      expect(
        await prisma.aiProviderConnection.count({ where: { companyId: fixtureCompanyId } }),
        'una prueba fallida al guardar no puede dejar fila',
      ).toBe(0);

      await page.reload();
      await expect(form).toBeVisible({ timeout: 60_000 });
      await expect(form.getByText(TEXTS.notConfigured)).toBeVisible();
      await expect(page.getByTestId(TESTIDS.card)).toHaveCount(0);
    });

    await test.step('R13, R34, QT-291 R20: «Probar conexión» con una key valida responde «Conexión correcta · el modelo en uso responde» sin escribir nada', async () => {
      await page.getByTestId(TESTIDS.option('GOOGLE')).click();
      await keyField.fill(VALID_KEY);
      await page.getByTestId(TESTIDS.formTest).click();

      await expect(formResult).toContainText(TEXTS.testOk, { timeout: 60_000 });
      await expect(keyField).toHaveValue(VALID_KEY);
      expect(
        await prisma.aiProviderConnection.count({ where: { companyId: fixtureCompanyId } }),
        'probar una key no guarda nada',
      ).toBe(0);
    });

    await test.step('R17, R31, R34, QT-291 R26, R27: «Guardar y conectar» deja la conexion «Conectado» con el recomendado de Gemini en la sección «Modelo»', async () => {
      const recommended = await recommendedGeminiModel();

      await page.getByTestId(TESTIDS.option('GOOGLE')).click();
      await keyField.fill(VALID_KEY);
      await page.getByTestId(TESTIDS.formSave).click();

      const card = page.getByTestId(TESTIDS.card);
      await expect(card).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(TEXTS.saved).first()).toBeVisible();
      await expect(card).toHaveAttribute('data-status', 'ACTIVE');
      await expect(page.getByTestId(TESTIDS.cardStatus)).toHaveText(TEXTS.connected);
      await expect(page.getByTestId(TESTIDS.modelSection)).toBeVisible();
      await expect(page.getByTestId(TESTIDS.modelTrigger)).toContainText(recommended);
      await expect(page.getByTestId(TESTIDS.modelTrigger)).toContainText(TEXTS.recommended);
      await expect(form).toHaveCount(0);

      const row = await prisma.aiProviderConnection.findUnique({
        where: { companyId: fixtureCompanyId },
        select: {
          provider: true,
          status: true,
          apiKeyEnc: true,
          lastCheckedAt: true,
          createdById: true,
          model: true,
        },
      });
      expect(row, 'el alta valida tiene que dejar la fila de la empresa').not.toBeNull();
      if (!row) return;
      expect(row.provider).toBe('GOOGLE');
      expect(row.model, 'sin eleccion de la empresa se usa el recomendado').toBeNull();
      expect(row.status).toBe('ACTIVE');
      expect(row.lastCheckedAt).not.toBeNull();
      expect(row.createdById).toBe(credentials.id);
      expect(row.apiKeyEnc).toMatch(/^v\d+:/);
      expect(row.apiKeyEnc).not.toContain(VALID_KEY);
    });

    await test.step('R8: tras recargar, la key no esta ni en la pagina ni en el HTML servido', async () => {
      const response = await page.reload();
      const servedHtml = (await response?.text()) ?? '';

      await expect(page.getByTestId(TESTIDS.card)).toBeVisible({ timeout: 60_000 });
      expect(servedHtml.length).toBeGreaterThan(0);
      expect(servedHtml.includes(VALID_KEY), 'el HTML servido no puede llevar la key').toBe(false);
      expect((await page.content()).includes(VALID_KEY)).toBe(false);
    });

    await test.step('R37: con conexion, Fórmulas pinta «Subir PDFs» habilitado y sin globo', async () => {
      await page.goto(FORMULAS_ROUTE);
      await expect(page.getByTestId(TESTIDS.recipesTitle)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId(TESTIDS.uploadOpen)).toBeEnabled({ timeout: 60_000 });
      await expect(page.getByTestId(TESTIDS.lockedTrigger)).toHaveCount(0);
    });

    await test.step('R33, R20, R34: «Desconectar», tras confirmar, vuelve a «Sin configurar» y borra la fila', async () => {
      await page.goto(AI_PROVIDER_INTEGRATION_ROUTE);
      await expect(page.getByTestId(TESTIDS.card)).toBeVisible({ timeout: 60_000 });

      await page.getByTestId(TESTIDS.cardDisconnect).click();
      await expect(page.getByTestId(TESTIDS.disconnectDialog)).toBeVisible();
      await page.getByTestId(TESTIDS.disconnectConfirm).click();

      await expect(form).toBeVisible({ timeout: 60_000 });
      await expect(form.getByText(TEXTS.notConfigured)).toBeVisible();
      await expect(page.getByText(TEXTS.disconnected).first()).toBeVisible();
      await expect(page.getByTestId(TESTIDS.card)).toHaveCount(0);
      expect(
        await prisma.aiProviderConnection.count({ where: { companyId: fixtureCompanyId } }),
        'desconectar borra la fila',
      ).toBe(0);
    });
  });

  test('QT-291 R26, R27, R29, R32, R9: con Gemini conectado, elegir otro modelo en el selector lo guarda sin otro boton y tras recargar dice «Elegido por tu empresa.»', async ({
    page,
  }) => {
    if (!companyId) throw new Error('la empresa del fixture no existe: fallo el beforeAll');
    const fixtureCompanyId = companyId;
    await prisma.aiProviderConnection.deleteMany({ where: { companyId: fixtureCompanyId } });

    const recommended = await recommendedGeminiModel();
    const chosen = await otherGeminiModel();
    const credentials = await createUser(administradorRoleId, 'modelo');
    await loginAndLand(page, credentials);

    await page.goto(AI_PROVIDER_INTEGRATION_ROUTE);
    await expect(page.getByTestId(TESTIDS.form)).toBeVisible({ timeout: 60_000 });
    await page.getByTestId(TESTIDS.option('GOOGLE')).click();
    await page.getByTestId(TESTIDS.keyField).fill(VALID_KEY);
    await page.getByTestId(TESTIDS.formSave).click();

    const trigger = page.getByTestId(TESTIDS.modelTrigger);
    await expect(page.getByTestId(TESTIDS.card)).toBeVisible({ timeout: 60_000 });

    await test.step('QT-291 R27: sin eleccion, el selector muestra el recomendado con «Recomendado»', async () => {
      await expect(trigger).toContainText(recommended);
      await expect(trigger).toContainText(TEXTS.recommended);
      await expect(page.getByTestId(TESTIDS.modelHelp)).toHaveText(TEXTS.helpRecommended);
    });

    await test.step('QT-291 R29, R32, R9: elegir otra opcion consulta, guarda y muestra «Modelo guardado»', async () => {
      await trigger.click();
      await page.locator(`[data-testid="${TESTIDS.modelOption}"][data-value="${chosen}"]`).click();

      await expect(page.getByText(TEXTS.modelSaved).first()).toBeVisible({ timeout: 60_000 });
      await expect(trigger).toContainText(chosen);
      const row = await prisma.aiProviderConnection.findUnique({
        where: { companyId: fixtureCompanyId },
        select: { model: true, status: true },
      });
      expect(row?.model).toBe(chosen);
      expect(row?.status).toBe('ACTIVE');
    });

    await test.step('QT-291 R27: tras recargar, el elegido sale con «Elegido por tu empresa.» y sin «Recomendado»', async () => {
      await page.reload();
      await expect(trigger).toBeVisible({ timeout: 60_000 });
      await expect(trigger).toContainText(chosen);
      await expect(trigger).not.toContainText(TEXTS.recommended);
      await expect(page.getByTestId(TESTIDS.modelHelp)).toHaveText(TEXTS.helpChosen);
    });
  });

  test('R37, R3: quien sube PDF sin `integraciones.modificar` ve el enlace «Inscribir proveedor» igual y la pantalla le responde 404', async ({
    page,
  }) => {
    if (!companyId) throw new Error('la empresa del fixture no existe: fallo el beforeAll');
    await prisma.aiProviderConnection.deleteMany({ where: { companyId } });

    const credentials = await createUser(uploaderRoleId, 'subida');
    await loginAndLand(page, credentials);

    await page.goto(FORMULAS_ROUTE);
    await expect(page.getByTestId(TESTIDS.recipesTitle)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId(TESTIDS.uploadOpen)).toBeDisabled();
    await page.getByTestId(TESTIDS.lockedTrigger).focus();
    await expect(page.getByTestId(TESTIDS.lockedTooltip)).toContainText(TEXTS.lockedMessage);
    await expect(page.getByTestId(TESTIDS.lockedLink)).toHaveAttribute('href', AI_PROVIDER_INTEGRATION_ROUTE);

    const response = await page.goto(AI_PROVIDER_INTEGRATION_ROUTE);
    expect(response?.status(), 'sin el permiso la pantalla responde 404').toBe(404);
    await expect(page.getByTestId(TESTIDS.form)).toHaveCount(0);
  });
});
