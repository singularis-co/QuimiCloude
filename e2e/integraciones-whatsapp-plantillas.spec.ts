/**
 * E2E de las plantillas y las variables de WhatsApp en `/integraciones/whatsapp` (QC-243).
 *
 * Que aporta sobre unit e integracion:
 * - **El alta servida de verdad**: el panel envia el borrador con la Server Action de QC-242, el doble
 *   `canned` de Graph (`INTEGRATIONS_E2E_DOUBLES` de `playwright.config.ts`) la acepta y la fila
 *   queda «Pendiente».
 * - **La aprobacion por el webhook real** (R61, `design.md > 9`): un `POST` a
 *   `whatsappWebhookPath(connectionId)` con `message_template_status_update`, firmado con el App
 *   Secret que este mismo E2E escribio al crear la conexion, y el `metaTemplateId` leido de la base.
 * - **Una variable propia creada en la pestaña Variables y usada en el alta** por el menu «Insertar
 *   variable»: la relacion queda guardada contra esa variable.
 * - **El telefono** (390 px, tactil): el alta a pantalla completa con sus pestañas (R38) y el motivo
 *   de una rechazada como texto en la tarjeta (R13, `design.md > 8`).
 * - Corre en Chromium y en WebKit (proyectos de `playwright.config.ts`).
 *
 * DATOS: el USUARIO Administrador (rol real del seed) y la EMPRESA de cada worker son efimeros, con
 * el prefijo `qc243_e2e_` y el `RUN_ID` del proceso. Cada caso parte de una empresa sin conexion,
 * sin plantillas y sin variables propias: lo borra antes, asi no depende del orden ni de un
 * reintento. La limpieza va de hijas a madres: relaciones, plantillas, variables, conexion,
 * usuarios (`created_by`) y empresa.
 *
 * Los selectores son los `data-testid` propios de la ruta (`WHATSAPP_*`), filtrados por visibles:
 * la lista pinta la tabla y la tarjeta y solo una se ve en cada ancho.
 *
 * ENTRADA: siempre por `loginAndLand`.
 */
import { createHmac, randomInt, randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  WHATSAPP_TAB_CONNECTION_TESTID,
  WHATSAPP_TAB_TEMPLATES_TESTID,
  WHATSAPP_TAB_VARIABLES_TESTID,
  WHATSAPP_TEMPLATES_TAB_PANEL_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-integration-tabs';
import { WA_BUBBLE_BODY_TESTID, WA_BUBBLE_TESTID } from '@/app/(private)/integraciones/whatsapp/components/wa-bubble';
import {
  WHATSAPP_TEMPLATE_CONFIRM_SUBMIT_TESTID,
  WHATSAPP_TEMPLATE_FORM_BODY_TESTID,
  WHATSAPP_TEMPLATE_FORM_NAME_TESTID,
  WHATSAPP_TEMPLATE_FORM_SHEET_TESTID,
  WHATSAPP_TEMPLATE_FORM_SUBMIT_TESTID,
  WHATSAPP_TEMPLATE_FORM_TAB_TESTID,
  WHATSAPP_TEMPLATE_FORM_TABS_TESTID,
  WHATSAPP_TEMPLATE_FORM_USED_ITEM_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-form-sheet';
import { statusBadgeOf } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-rules';
import {
  WHATSAPP_TEMPLATE_REASON_BUTTON_TESTID,
  WHATSAPP_TEMPLATE_REASON_TEXT_TESTID,
  WHATSAPP_TEMPLATE_STATUS_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-status';
import { WHATSAPP_TEMPLATE_NAME_TESTID } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-table';
import {
  WHATSAPP_VARIABLE_MENU_ITEM_TESTID,
  WHATSAPP_VARIABLE_MENU_TRIGGER_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-variable-menu';
import {
  WHATSAPP_TEMPLATES_EMPTY_NEW_TESTID,
  WHATSAPP_TEMPLATES_PANEL_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-templates-panel';
import {
  WHATSAPP_VARIABLE_KEY_TESTID,
  WHATSAPP_VARIABLE_LABEL_TESTID,
  WHATSAPP_VARIABLE_SAVE_TESTID,
  WHATSAPP_VARIABLE_SHEET_TESTID,
  WHATSAPP_VARIABLE_VALUE_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-variable-form-sheet';
import {
  WHATSAPP_NEW_VARIABLE_EMPTY_TESTID,
  WHATSAPP_VARIABLES_PANEL_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-variables-panel';
import { normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { prisma } from '@/lib/shared/db/prisma';
import { WHATSAPP_INTEGRATION_ROUTE, whatsappWebhookPath } from '@/lib/shared/routes';

import { enableAllAddons } from './helpers/addons';
import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';

const USERNAME_PREFIX = 'qc243_e2e_';
const COMPANY_NAME_PREFIX = 'qc243_e2e_empresa_';
const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit corren a la vez: lo huerfano se borra por edad, nunca por prefijo a secas. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

/**
 * Una WABA por conexion: los avisos de plantillas llevan su id en `entry.id`. Tiene que ser propia
 * de cada caso porque el doble `canned` guarda en memoria del servidor las plantillas creadas por
 * WABA, y el alta de la conexion las importa: con una WABA compartida, el caso siguiente (o el otro
 * navegador) arrancaria con la plantilla del anterior.
 */
function newWabaId(): string {
  return `${Date.now()}${randomInt(100_000, 1_000_000)}`;
}

/** El App Secret que el E2E escribe al crear la conexion y con el que firma el webhook. */
const APP_SECRET = `secret-e2e-${RUN_ID}`;

const FIELD_TESTIDS = {
  displayName: 'whatsapp-field-display-name',
  wabaId: 'whatsapp-field-waba-id',
  phoneNumberId: 'whatsapp-field-phone-number-id',
  accessToken: 'whatsapp-field-access-token',
  appSecret: 'whatsapp-field-app-secret',
} as const;

const SIGNATURE_HEADER = 'x-hub-signature-256';
const TEMPLATE_STATUS_FIELD = 'message_template_status_update';

/** La variable propia que se crea en la pestaña Variables: la clave sale de la etiqueta (R51). */
const OWN_VARIABLE = { label: 'Número de cuenta', key: 'numero_de_cuenta', value: '001-2345' } as const;

/** Un motivo de rechazo de Meta tal cual llega en el aviso. */
const REJECTED_REASON = 'INVALID_FORMAT';

/** Teléfono de `docs/architecture.md > Componentes`: 390 px y tactil. */
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

let companyId: string | null = null;
let administradorRoleId: string | null = null;

async function createAdministrador(
  suffix: string,
): Promise<{ id: string; username: string; password: string }> {
  if (!administradorRoleId) throw new Error('el rol Administrador no se resolvio: fallo el beforeAll');
  if (!companyId) throw new Error('la empresa del fixture no existe: fallo el beforeAll');

  const username = `${USERNAME_PREFIX}${RUN_ID}_${suffix}`;
  /** Contrasena conocida del usuario de prueba. Solo vive aqui; nunca se escribe en consola. */
  const password = `Qc243-E2E-${RUN_ID.slice(0, 12)}`;

  const user = await createFixtureUser({
    data: {
      firstNames: `Qc243${RUN_ID.slice(0, 8)}${suffix}`,
      lastNames: 'Plantillas',
      birthDate: new Date('1990-01-01'),
      email: `${username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: 'CC',
      documentNumber: `qc243${RUN_ID}${suffix}`,
      username,
      passwordHash: await createPasswordHash(password),
      roleId: administradorRoleId,
      companyId,
      accountStatus: 'active',
    },
    select: { id: true },
  });

  return { id: user.id, username, password };
}

/** Borra todo lo de WhatsApp de esas empresas, de hijas a madres. */
async function deleteWhatsappData(companyIds: readonly string[]): Promise<void> {
  const where = { companyId: { in: [...companyIds] } };
  await prisma.whatsappTemplateVariable.deleteMany({ where });
  await prisma.whatsappTemplate.deleteMany({ where });
  await prisma.whatsappVariableKey.deleteMany({ where });
  await prisma.whatsappConnection.deleteMany({ where });
}

test.beforeAll(async () => {
  const role = await prisma.role.findUnique({
    where: { name: ROLE_ADMINISTRADOR },
    select: { id: true },
  });
  if (!role) throw new Error(`el rol '${ROLE_ADMINISTRADOR}' no existe: correr el seed antes de este E2E`);
  administradorRoleId = role.id;

  const orphanCutoff = new Date(Date.now() - ORPHAN_MIN_AGE_MS);
  const orphanCompanies = await prisma.company.findMany({
    where: { name: { startsWith: COMPANY_NAME_PREFIX }, createdAt: { lt: orphanCutoff } },
    select: { id: true },
  });
  const orphanCompanyIds = orphanCompanies.map((company) => company.id);
  await deleteWhatsappData(orphanCompanyIds);
  await prisma.user.deleteMany({
    where: { username: { startsWith: USERNAME_PREFIX }, createdAt: { lt: orphanCutoff } },
  });
  await prisma.company.deleteMany({ where: { id: { in: orphanCompanyIds } } });

  const companyName = `${COMPANY_NAME_PREFIX}${RUN_ID}`;
  const company = await prisma.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  });
  companyId = company.id;
  await enableAllAddons(companyId);
});

test.afterAll(async () => {
  try {
    if (companyId) await deleteWhatsappData([companyId]);
    await prisma.user.deleteMany({
      where: { username: { startsWith: `${USERNAME_PREFIX}${RUN_ID}` } },
    });
    await prisma.company.deleteMany({ where: { name: `${COMPANY_NAME_PREFIX}${RUN_ID}` } });
  } finally {
    await prisma.$disconnect();
  }
});

// `next dev` compila cada ruta bajo demanda y bcrypt con coste 10 tarda a proposito.
test.setTimeout(240_000);

function fixtureCompanyId(): string {
  if (!companyId) throw new Error('la empresa del fixture no existe: fallo el beforeAll');
  return companyId;
}

type FixtureConnection = { readonly connectionId: string; readonly wabaId: string };

/**
 * Crea la conexion desde la pantalla, como el Administrador, y devuelve su id y su WABA. El
 * `phone_number_id` es unico entre las conexiones vivas: cada caso usa el suyo.
 */
async function createConnectionFromScreen(page: Page, suffix: 'alta' | 'movil'): Promise<FixtureConnection> {
  const wabaId = newWabaId();
  const company = fixtureCompanyId();
  await deleteWhatsappData([company]);

  await page.goto(WHATSAPP_INTEGRATION_ROUTE);
  const form = page.getByTestId('whatsapp-connection-form');
  await expect(form).toBeVisible({ timeout: 60_000 });

  await page.getByTestId(FIELD_TESTIDS.displayName).fill(`WhatsApp ${RUN_ID.slice(0, 8)}`);
  await page.getByTestId(FIELD_TESTIDS.wabaId).fill(wabaId);
  await page.getByTestId(FIELD_TESTIDS.phoneNumberId).fill(`qc243${RUN_ID}${suffix}`);
  await page.getByTestId(FIELD_TESTIDS.accessToken).fill(`token-e2e-${RUN_ID}`);
  await page.getByTestId(FIELD_TESTIDS.appSecret).fill(APP_SECRET);
  await page.getByTestId('whatsapp-connection-form-submit').click();

  await expect(page.getByTestId('whatsapp-connection-card')).toBeVisible({ timeout: 60_000 });

  const row = await prisma.whatsappConnection.findFirstOrThrow({
    where: { companyId: company, deletedAt: null },
    select: { id: true },
  });
  return { connectionId: row.id, wabaId };
}

/** Activa una pestaña; en WebKit un clic antes de hidratar se pierde sin error, asi que se repite. */
async function openTab(page: Page, tabTestId: string): Promise<void> {
  const tab = page.getByTestId(tabTestId);
  await expect(tab).toBeEnabled({ timeout: 60_000 });
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
}

/** «Volver a entrar en Plantillas»: salir a Conexión y entrar otra vez, que pide la lista nueva. */
async function reenterTemplates(page: Page): Promise<void> {
  await openTab(page, WHATSAPP_TAB_CONNECTION_TESTID);
  await openTab(page, WHATSAPP_TAB_TEMPLATES_TESTID);
  await expect(page.getByTestId(WHATSAPP_TEMPLATES_PANEL_TESTID)).toBeVisible({ timeout: 60_000 });
}

/** El estado visible de la unica plantilla de la lista: en la tabla o en la tarjeta segun el ancho. */
function visibleStatus(page: Page) {
  return page
    .getByTestId(WHATSAPP_TEMPLATES_TAB_PANEL_TESTID)
    .getByTestId(WHATSAPP_TEMPLATE_STATUS_TESTID)
    .filter({ visible: true });
}

/** El `POST` que Meta mandaria al cambiar el estado de la plantilla, firmado con el App Secret. */
async function postTemplateStatus(
  request: APIRequestContext,
  input: {
    readonly connection: FixtureConnection;
    readonly metaTemplateId: string;
    readonly name: string;
    readonly event: 'APPROVED' | 'REJECTED';
    readonly reason: string;
  },
): Promise<number> {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: input.connection.wabaId,
        changes: [
          {
            field: TEMPLATE_STATUS_FIELD,
            value: {
              event: input.event,
              message_template_id: Number(input.metaTemplateId),
              message_template_name: input.name,
              message_template_language: 'es',
              reason: input.reason,
            },
          },
        ],
      },
    ],
  };
  const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`;
  const response = await request.post(whatsappWebhookPath(input.connection.connectionId), {
    data: rawBody,
    headers: { 'content-type': 'application/json', [SIGNATURE_HEADER]: signature },
  });
  return response.status();
}

/** Abre «Nueva plantilla» desde la lista vacia y espera el panel. */
async function openNewTemplate(page: Page) {
  const newButton = page.getByTestId(WHATSAPP_TEMPLATES_EMPTY_NEW_TESTID);
  const sheet = page.getByTestId(WHATSAPP_TEMPLATE_FORM_SHEET_TESTID);
  await expect(newButton).toBeVisible({ timeout: 60_000 });
  await expect(async () => {
    if ((await sheet.count()) === 0) await newButton.click();
    await expect(sheet).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  return sheet;
}

/** «Enviar a revisión» y «Enviar» en la confirmacion; espera a que el panel se cierre. */
async function submitTemplate(page: Page): Promise<void> {
  const submit = page.getByTestId(WHATSAPP_TEMPLATE_FORM_SUBMIT_TESTID);
  await expect(submit).toBeEnabled();
  await submit.click();
  await page.getByTestId(WHATSAPP_TEMPLATE_CONFIRM_SUBMIT_TESTID).click();
  await expect(page.getByTestId(WHATSAPP_TEMPLATE_FORM_SHEET_TESTID)).toHaveCount(0, { timeout: 60_000 });
}

async function templateRowByName(name: string) {
  return prisma.whatsappTemplate.findFirstOrThrow({
    where: { companyId: fixtureCompanyId(), name, deletedAt: null },
    select: { id: true, metaTemplateId: true, status: true, rejectedReason: true, createdById: true },
  });
}

const PENDING_LABEL = statusBadgeOf({ status: 'PENDING', statusRaw: null }).label;
const APPROVED_LABEL = statusBadgeOf({ status: 'APPROVED', statusRaw: null }).label;
const REJECTED_LABEL = statusBadgeOf({ status: 'REJECTED', statusRaw: null }).label;

test.describe('las plantillas de WhatsApp de la empresa', () => {
  test('R61, R50, R54, R27, R34: variable propia nueva, alta que la usa → «Pendiente», aprobacion por el webhook firmado → «Aprobada»', async ({
    page,
  }) => {
    const credentials = await createAdministrador('alta');
    await loginAndLand(page, credentials);
    const connection = await createConnectionFromScreen(page, 'alta');
    const templateName = `qc243_${RUN_ID.slice(0, 10)}`;

    await test.step('R50, R54: la variable propia se crea en la pestaña Variables con la clave que sale de la etiqueta', async () => {
      await openTab(page, WHATSAPP_TAB_VARIABLES_TESTID);
      await expect(page.getByTestId(WHATSAPP_VARIABLES_PANEL_TESTID)).toBeVisible({ timeout: 60_000 });
      await page.getByTestId(WHATSAPP_NEW_VARIABLE_EMPTY_TESTID).click();

      const sheet = page.getByTestId(WHATSAPP_VARIABLE_SHEET_TESTID);
      await expect(sheet).toBeVisible();
      await page.getByTestId(WHATSAPP_VARIABLE_LABEL_TESTID).fill(OWN_VARIABLE.label);
      await expect(page.getByTestId(WHATSAPP_VARIABLE_KEY_TESTID)).toHaveValue(OWN_VARIABLE.key);
      await page.getByTestId(WHATSAPP_VARIABLE_VALUE_TESTID).fill(OWN_VARIABLE.value);
      await page.getByTestId(WHATSAPP_VARIABLE_SAVE_TESTID).click();
      await expect(sheet).toHaveCount(0, { timeout: 60_000 });

      const row = await prisma.whatsappVariableKey.findFirst({
        where: { companyId: fixtureCompanyId(), key: OWN_VARIABLE.key },
        select: { label: true, value: true },
      });
      expect(row).toEqual({ label: OWN_VARIABLE.label, value: OWN_VARIABLE.value });
    });

    await test.step('R27, R34: el alta usa una constante y la variable propia del menu «Insertar variable» y queda «Pendiente»', async () => {
      await openTab(page, WHATSAPP_TAB_TEMPLATES_TESTID);
      const sheet = await openNewTemplate(page);
      await expect(sheet).toHaveAttribute('data-layout', 'columns');

      await page.getByTestId(WHATSAPP_TEMPLATE_FORM_NAME_TESTID).fill(templateName);
      // El cursor queda al final del texto: ahi entra la variable elegida en el menu.
      await page.getByTestId(WHATSAPP_TEMPLATE_FORM_BODY_TESTID).fill('Hola {{nombre_del_cliente}}, tu cuenta es ');
      await page.getByTestId(WHATSAPP_VARIABLE_MENU_TRIGGER_TESTID).click();
      await page.getByTestId(WHATSAPP_VARIABLE_MENU_ITEM_TESTID(OWN_VARIABLE.key)).click();

      await expect(page.getByTestId(WHATSAPP_TEMPLATE_FORM_BODY_TESTID)).toHaveValue(
        `Hola {{nombre_del_cliente}}, tu cuenta es {{${OWN_VARIABLE.key}}}`,
      );
      await expect(page.getByTestId(WHATSAPP_TEMPLATE_FORM_USED_ITEM_TESTID)).toHaveCount(2);
      // La vista previa pinta el valor de la propia (G7).
      await expect(sheet.getByTestId(WA_BUBBLE_BODY_TESTID)).toContainText(OWN_VARIABLE.value);

      await submitTemplate(page);

      await expect(
        page.getByTestId(WHATSAPP_TEMPLATE_NAME_TESTID).filter({ visible: true }),
      ).toHaveText(templateName, { timeout: 60_000 });
      await expect(visibleStatus(page)).toHaveText(PENDING_LABEL);

      const row = await templateRowByName(templateName);
      expect(row.status).toBe('PENDING');
      expect(row.createdById).toBe(credentials.id);
      const ownVariable = await prisma.whatsappVariableKey.findFirstOrThrow({
        where: { companyId: fixtureCompanyId(), key: OWN_VARIABLE.key },
        select: { id: true },
      });
      const bindings = await prisma.whatsappTemplateVariable.findMany({
        where: { templateId: row.id },
        select: { variableKeyId: true, systemKey: true },
      });
      expect(bindings.map((binding) => binding.variableKeyId), 'el hueco de la propia queda relacionado con ella').toContain(
        ownVariable.id,
      );
    });

    await test.step('R61: el aviso APPROVED firmado al webhook de la conexion y volver a entrar en Plantillas la deja «Aprobada»', async () => {
      const row = await templateRowByName(templateName);
      const status = await postTemplateStatus(page.request, {
        connection,
        metaTemplateId: row.metaTemplateId,
        name: templateName,
        event: 'APPROVED',
        reason: 'NONE',
      });
      expect(status).toBe(200);
      expect((await templateRowByName(templateName)).status).toBe('APPROVED');

      await reenterTemplates(page);
      await expect(visibleStatus(page)).toHaveText(APPROVED_LABEL, { timeout: 60_000 });
    });
  });

  test.describe('en el telefono', () => {
    test.use({ viewport: PHONE_VIEWPORT, hasTouch: true });

    test('R38, R13: el alta se abre a pantalla completa con «Formulario | Vista previa» y el motivo de una rechazada se lee como texto en la tarjeta', async ({
      page,
    }) => {
      const credentials = await createAdministrador('movil');
      await loginAndLand(page, credentials);
      const connection = await createConnectionFromScreen(page, 'movil');
      const templateName = `qc243_movil_${RUN_ID.slice(0, 8)}`;
      const body = 'Tu pedido {{numero_de_pedido}} esta listo.';

      await test.step('R38: el alta ocupa la pantalla y separa formulario y vista previa en pestañas', async () => {
        await openTab(page, WHATSAPP_TAB_TEMPLATES_TESTID);
        const sheet = await openNewTemplate(page);
        await expect(sheet).toHaveAttribute('data-layout', 'tabs');
        const box = await sheet.boundingBox();
        expect(box?.width, 'el alta ocupa el ancho entero del telefono').toBeGreaterThanOrEqual(PHONE_VIEWPORT.width - 1);

        await expect(page.getByTestId(WHATSAPP_TEMPLATE_FORM_TABS_TESTID)).toBeVisible();
        const formTab = page.getByTestId(WHATSAPP_TEMPLATE_FORM_TAB_TESTID('form'));
        const previewTab = page.getByTestId(WHATSAPP_TEMPLATE_FORM_TAB_TESTID('preview'));
        await expect(formTab).toHaveAttribute('aria-selected', 'true');

        await page.getByTestId(WHATSAPP_TEMPLATE_FORM_NAME_TESTID).fill(templateName);
        await page.getByTestId(WHATSAPP_TEMPLATE_FORM_BODY_TESTID).fill(body);

        await previewTab.tap();
        await expect(previewTab).toHaveAttribute('aria-selected', 'true');
        await expect(sheet.getByTestId(WA_BUBBLE_TESTID)).toBeVisible();
        await expect(page.getByTestId(WHATSAPP_TEMPLATE_FORM_BODY_TESTID)).toBeHidden();

        await formTab.tap();
        await expect(page.getByTestId(WHATSAPP_TEMPLATE_FORM_BODY_TESTID)).toHaveValue(body);

        await submitTemplate(page);
        await expect(visibleStatus(page)).toHaveText(PENDING_LABEL, { timeout: 60_000 });
      });

      await test.step('R13: rechazada por Meta, la tarjeta muestra el motivo como texto y no depende del globo', async () => {
        const row = await templateRowByName(templateName);
        const status = await postTemplateStatus(page.request, {
          connection,
          metaTemplateId: row.metaTemplateId,
          name: templateName,
          event: 'REJECTED',
          reason: REJECTED_REASON,
        });
        expect(status).toBe(200);
        expect(await templateRowByName(templateName)).toMatchObject({
          status: 'REJECTED',
          rejectedReason: REJECTED_REASON,
        });

        await reenterTemplates(page);
        await expect(visibleStatus(page)).toHaveText(REJECTED_LABEL, { timeout: 60_000 });
        const reason = page.getByTestId(WHATSAPP_TEMPLATE_REASON_TEXT_TESTID).filter({ visible: true });
        await expect(reason).toHaveCount(1);
        await expect(reason).toContainText(REJECTED_REASON);
        // El «!» con globo es de la tabla; en la tarjeta no se ve.
        await expect(page.getByTestId(WHATSAPP_TEMPLATE_REASON_BUTTON_TESTID).filter({ visible: true })).toHaveCount(0);
      });
    });
  });
});
