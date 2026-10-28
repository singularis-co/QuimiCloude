/**
 * E2E de la pantalla de Contactos con chat de WhatsApp en `/clientes/contactos` (QC-246, T19).
 *
 * Que aporta sobre unit e integracion:
 * - **El recorrido servido de verdad**: un mensaje entrante llega por el webhook real, firmado con
 *   el App Secret que este mismo E2E escribio al crear la conexion, y la pantalla, ya abierta, lo
 *   integra con su consulta periodica de 8 s (R42), sin recargar: primero en la lista y despues, con
 *   el chat abierto, en el chat.
 * - **Responder un texto** (R32) con el doble `canned` de Graph (`INTEGRATIONS_E2E_DOUBLES` de
 *   `playwright.config.ts`): «Enviando» al instante, «Enviado» al volver la accion, y «Entregado»
 *   (R19) cuando llega el `status` `delivered` por el webhook.
 * - **El permiso** (R1, R45): sin `whatsapp.consultar` la ruta responde 404 y Clientes no ofrece
 *   «Abrir chat».
 * - **Desde Clientes** (R45, R46): «Abrir chat» lleva a `?cliente=<id>` con el chat de ese cliente
 *   abierto, o vacio y con la ventana cerrada si no tiene conversacion.
 * - **El telefono** (360 × 844, tactil): lista ↔ chat con «Volver a conversaciones» y con «Atrás»
 *   del navegador (R6), y sin scroll horizontal (R7) en la lista, en el chat con cada tipo de
 *   mensaje (imagen, sticker, ubicacion, reaccion y fallido), en las burbujas de plantillas, en el
 *   detalle del pedido, en el dialogo «Enviar plantilla» y en el visor de imagen. Se mide el
 *   documento y tambien cada contenedor con `overflow` propio: un desborde dentro de uno de ellos
 *   no llega al `documentElement`.
 * - Corre en Chromium y en WebKit (proyectos de `playwright.config.ts`).
 *
 * VINCULO CON EL CLIENTE: el webhook vincula el contacto al cliente cuyo telefono E.164 casa con el
 * `wa_id` (QC-239/QC-245, R15 de `whatsapp-webhook-route.int.test.ts`). Ese vinculo vive en
 * `phone_numbers` y `customer_phone_numbers`, que escribe el caso de uso del alta: por eso el
 * cliente se crea con `clientes.createCustomer` de `@/lib/composition` y no con un `prisma.create`.
 *
 * DATOS: el USUARIO Administrador (rol real del seed) y DOS EMPRESAS por worker son efimeros, con el
 * prefijo `qc246_e2e_` y el `RUN_ID` del proceso: una con todos los añadidos y otra sin ninguno (sin
 * el de integraciones su Administrador no recibe `whatsapp.consultar`). Cada caso parte de una
 * empresa sin conexion de WhatsApp: la borra antes, asi no depende del orden ni de un reintento. La
 * limpieza va de hijas a madres: mensajes, contactos, plantillas, conexion, pedidos (lineas,
 * pedidos, recetas y presentaciones), vinculos de telefono, numeros, clientes, usuarios y empresas.
 *
 * Los textos y los `data-testid` salen de `contact-texts.ts` (modulo de textos, no de cliente) y de
 * `customer-chat-link.tsx`; ningun literal suelto donde hay constante exportada.
 *
 * ENTRADA: siempre por `loginAndLand`.
 */
import { createHmac, randomInt, randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import {
  CUSTOMER_CHAT_LINK_TESTID,
  CUSTOMER_CHAT_UNAVAILABLE_TESTID,
  customerChatHref,
} from '@/app/(private)/clientes/components/customer-chat-link';
import { CUSTOMERS_TITLE_TESTID } from '@/app/(private)/clientes/components/customer-labels';
import {
  CHAT_COMPOSER_TESTID,
  CHAT_COMPOSER_TEXT,
  CHAT_DELIVERY_LABELS,
  CHAT_EMPTY_TESTID,
  CHAT_HEADER_TESTID,
  CHAT_HEADER_TEXT,
  CHAT_IMAGE_TEXT,
  CHAT_IMAGE_VIEWER_TESTID,
  CHAT_LOCATION_TEXT,
  CHAT_MESSAGE_LIST_TESTID,
  CHAT_MESSAGE_TESTID,
  CHAT_MESSAGE_TEXT,
  CHAT_ORDER_DETAIL_TESTID,
  CHAT_PANEL_TESTID,
  CHAT_TEMPLATE_CHIPS_TESTID,
  CHAT_WINDOW_BADGE_TESTID,
  CHAT_WINDOW_TEXT,
  CONTACTS_CHAT_PANE_TESTID,
  CONTACTS_SCREEN_TESTID,
  CONVERSATION_ITEM_TESTID,
  CONVERSATION_LIST_TESTID,
  CONVERSATIONS_EMPTY_TESTID,
  CUSTOMER_CONTACTS_TITLE_TESTID,
  SEND_TEMPLATE_DIALOG_TESTID,
} from '@/app/(private)/clientes/contactos/components/contact-texts';
import { clientes } from '@/lib/composition';
import { normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
import { normalizePresentationName } from '@/lib/modules/inventario';
import { normalizeRecipeName } from '@/lib/modules/recetas';
import { prisma } from '@/lib/shared/db/prisma';
import {
  CUSTOMER_CONTACTS_ROUTE,
  CUSTOMERS_ROUTE,
  WHATSAPP_INTEGRATION_ROUTE,
  whatsappWebhookPath,
} from '@/lib/shared/routes';

import { enableAllAddons } from './helpers/addons';
import { createFixtureUser } from './helpers/fixture-user';
import { loginAndLand } from './helpers/landing';

const USERNAME_PREFIX = 'qc246_e2e_';
const COMPANY_NAME_PREFIX = 'qc246_e2e_empresa_';
const RUN_ID = randomUUID().replace(/-/g, '');

/** Chromium y WebKit corren a la vez: lo huerfano se borra por edad, nunca por prefijo a secas. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

/** El App Secret que el E2E escribe al crear la conexion y con el que firma el webhook. */
const APP_SECRET = `secret-e2e-${RUN_ID}`;

const FIELD_TESTIDS = {
  displayName: 'whatsapp-field-display-name',
  wabaId: 'whatsapp-field-waba-id',
  phoneNumberId: 'whatsapp-field-phone-number-id',
  accessToken: 'whatsapp-field-access-token',
  appSecret: 'whatsapp-field-app-secret',
} as const;

/** El 404 de la zona privada (`app/(private)/not-found.tsx`): el testid no se exporta alli. */
const NOT_FOUND_TESTID = 'private-not-found';

const SIGNATURE_HEADER = 'x-hub-signature-256';

/** R7 se prueba a 360 px de ancho, tactil. */
const PHONE_VIEWPORT = { width: 360, height: 844 } as const;

/**
 * La consulta periodica es de 8 s (R42, nunca mas de 10 s entre consultas): dos turnos y el
 * arranque en frio de `next dev` caben de sobra.
 */
const POLL_TIMEOUT_MS = 30_000;

/** Lo que se retiene el envio del texto para poder ver el saliente «Enviando» (R32). */
const SEND_DELAY_MS = 3_000;

/** La reaccion del cliente al saliente: el pulgar arriba. */
const REACTION_EMOJI = '\u{1F44D}';

let companyId: string | null = null;
let companyWithoutAddonsId: string | null = null;
let administradorRoleId: string | null = null;

type Credentials = { readonly id: string; readonly username: string; readonly password: string };

async function createAdministrador(suffix: string, company: string): Promise<Credentials> {
  if (!administradorRoleId) throw new Error('el rol Administrador no se resolvio: fallo el beforeAll');

  const username = `${USERNAME_PREFIX}${RUN_ID}_${suffix}`;
  /** Contrasena conocida del usuario de prueba. Solo vive aqui; nunca se escribe en consola. */
  const password = `Qc246-E2E-${RUN_ID.slice(0, 12)}`;

  const user = await createFixtureUser({
    data: {
      firstNames: `Qc246${RUN_ID.slice(0, 8)}${suffix}`,
      lastNames: 'Contactos',
      birthDate: new Date('1990-01-01'),
      email: `${username}@example.test`,
      phone: '+573000000000',
      documentTypeCode: 'CC',
      documentNumber: `qc246${RUN_ID}${suffix}`,
      username,
      passwordHash: await createPasswordHash(password),
      roleId: administradorRoleId,
      companyId: company,
      accountStatus: 'active',
    },
    select: { id: true },
  });

  return { id: user.id, username, password };
}

/** Borra todo lo de WhatsApp de esas empresas, de hijas a madres. */
async function deleteWhatsappData(companyIds: readonly string[]): Promise<void> {
  const where = { companyId: { in: [...companyIds] } };
  await prisma.whatsappMessage.deleteMany({ where });
  await prisma.whatsappContact.deleteMany({ where });
  await prisma.whatsappTemplateVariable.deleteMany({ where });
  await prisma.whatsappTemplate.deleteMany({ where });
  await prisma.whatsappVariableKey.deleteMany({ where });
  await prisma.whatsappConnection.deleteMany({ where });
}

/** Pedidos y lo que cuelga de ellos, en el orden que imponen las FK RESTRICT. Antes de los clientes. */
async function deleteOrderData(companyIds: readonly string[]): Promise<void> {
  const where = { companyId: { in: [...companyIds] } };
  await prisma.orderPresentationLine.deleteMany({ where });
  await prisma.order.deleteMany({ where });
  await prisma.recipe.deleteMany({ where });
  await prisma.presentation.deleteMany({ where });
}

/** Clientes y sus telefonos, de hijas a madres. Despues de `deleteWhatsappData` y `deleteOrderData`. */
async function deleteCustomerData(companyIds: readonly string[]): Promise<void> {
  const where = { companyId: { in: [...companyIds] } };
  await prisma.customerPhoneNumber.deleteMany({ where });
  await prisma.phoneNumber.deleteMany({ where });
  await prisma.customer.deleteMany({ where });
}

async function createCompany(name: string): Promise<string> {
  const company = await prisma.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  });
  return company.id;
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
  await deleteOrderData(orphanCompanyIds);
  await deleteCustomerData(orphanCompanyIds);
  await prisma.user.deleteMany({
    where: { username: { startsWith: USERNAME_PREFIX }, createdAt: { lt: orphanCutoff } },
  });
  await prisma.company.deleteMany({ where: { id: { in: orphanCompanyIds } } });

  companyId = await createCompany(`${COMPANY_NAME_PREFIX}${RUN_ID}`);
  await enableAllAddons(companyId);
  // Sin ningun añadido: sin el de integraciones no hay `whatsapp.consultar` (`company-addons.ts`).
  companyWithoutAddonsId = await createCompany(`${COMPANY_NAME_PREFIX}sin_${RUN_ID}`);
});

test.afterAll(async () => {
  try {
    const companyIds = [companyId, companyWithoutAddonsId].filter((id): id is string => id !== null);
    await deleteWhatsappData(companyIds);
    await deleteOrderData(companyIds);
    await deleteCustomerData(companyIds);
    await prisma.user.deleteMany({
      where: { username: { startsWith: `${USERNAME_PREFIX}${RUN_ID}` } },
    });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
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

function fixtureCompanyWithoutAddonsId(): string {
  if (!companyWithoutAddonsId) throw new Error('la empresa sin añadidos no existe: fallo el beforeAll');
  return companyWithoutAddonsId;
}

/** Una WABA por conexion, como en `integraciones-whatsapp-plantillas.spec.ts`. */
function newWabaId(): string {
  return `${Date.now()}${randomInt(100_000, 1_000_000)}`;
}

/** Un movil colombiano irrepetible entre corridas: su `wa_id` y su `phone_e164` son el mismo. */
function newColombianMobile(): string {
  return `57300${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
}

type FixtureConnection = { readonly connectionId: string; readonly phoneNumberId: string };

type FixtureCustomer = { readonly id: string; readonly firstNames: string; readonly waId: string };

/**
 * Crea la conexion desde la pantalla, como el Administrador, y la activa con la verificacion del
 * webhook (`GET` con el verify token revelado): sin `ACTIVE` no se envia nada (R32).
 */
async function createActiveConnection(page: Page, suffix: string): Promise<FixtureConnection> {
  const company = fixtureCompanyId();
  await deleteWhatsappData([company]);
  const phoneNumberId = `qc246${RUN_ID}${suffix}`;

  await page.goto(WHATSAPP_INTEGRATION_ROUTE);
  const form = page.getByTestId('whatsapp-connection-form');
  await expect(form).toBeVisible({ timeout: 60_000 });

  await page.getByTestId(FIELD_TESTIDS.displayName).fill(`WhatsApp ${RUN_ID.slice(0, 8)}`);
  await page.getByTestId(FIELD_TESTIDS.wabaId).fill(newWabaId());
  await page.getByTestId(FIELD_TESTIDS.phoneNumberId).fill(phoneNumberId);
  await page.getByTestId(FIELD_TESTIDS.accessToken).fill(`token-e2e-${RUN_ID}`);
  await page.getByTestId(FIELD_TESTIDS.appSecret).fill(APP_SECRET);
  await page.getByTestId('whatsapp-connection-form-submit').click();

  await expect(page.getByTestId('whatsapp-connection-card')).toBeVisible({ timeout: 60_000 });
  const verifyToken = await page.getByTestId('whatsapp-verify-token').inputValue();
  expect(verifyToken.length, 'el alta tiene que revelar el verify token').toBeGreaterThan(0);

  const row = await prisma.whatsappConnection.findFirstOrThrow({
    where: { companyId: company, deletedAt: null },
    select: { id: true },
  });

  const challenge = `challenge-${RUN_ID.slice(0, 8)}`;
  const handshake = await page.request.get(whatsappWebhookPath(row.id), {
    params: { 'hub.mode': 'subscribe', 'hub.verify_token': verifyToken, 'hub.challenge': challenge },
  });
  expect(handshake.status(), 'la verificacion del webhook tiene que aceptar el verify token').toBe(200);
  expect(await handshake.text()).toBe(challenge);
  const activated = await prisma.whatsappConnection.findUniqueOrThrow({
    where: { id: row.id },
    select: { status: true },
  });
  expect(activated.status).toBe('ACTIVE');

  return { connectionId: row.id, phoneNumberId };
}

/** Un cliente con movil valido, dado de alta por el caso de uso: deja su numero listo para vincular. */
async function createCustomerWithPhone(admin: Credentials, company: string, tag: string): Promise<FixtureCustomer> {
  const waId = newColombianMobile();
  const firstNames = `Qc246${tag}${RUN_ID.slice(0, 6)}`;
  const { id } = await clientes.createCustomer(
    {
      firstNames,
      lastNames: `Chat${RUN_ID.slice(0, 10)}`,
      city: 'Bogota',
      phoneCountry: 'CO',
      phoneNumber: waId.slice(2),
      email: null,
      address: null,
    },
    { id: admin.id, companyId: company, permissions: ['clientes.modificar'] },
  );
  return { id, firstNames, waId };
}

let wamidCounter = 0;

function newInboundWamid(): string {
  wamidCounter += 1;
  return `wamid.qc246.${RUN_ID}.${String(wamidCounter)}`;
}

/** El `POST` que Meta mandaria, firmado con el App Secret de la conexion. */
async function postSignedWebhook(
  request: APIRequestContext,
  connection: FixtureConnection,
  value: Record<string, unknown>,
): Promise<number> {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: newWabaId(),
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550009999', phone_number_id: connection.phoneNumberId },
              ...value,
            },
          },
        ],
      },
    ],
  };
  const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = `sha256=${createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')}`;
  const response = await request.post(whatsappWebhookPath(connection.connectionId), {
    data: rawBody,
    headers: { 'content-type': 'application/json', [SIGNATURE_HEADER]: signature },
  });
  return response.status();
}

function nowInSeconds(): string {
  return String(Math.floor(Date.now() / 1000));
}

/** Hace `hours` horas: un entrante con esa hora deja la ventana de 24 h cerrada si pasa de 24. */
function hoursAgoInSeconds(hours: number): string {
  return String(Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000));
}

/**
 * Un entrante del cliente de cualquier tipo: `content` lleva `type` y su objeto (`{ type: 'image',
 * image: {...} }`). Devuelve su `wamid`.
 */
async function postInboundMessage(
  request: APIRequestContext,
  connection: FixtureConnection,
  customer: FixtureCustomer,
  content: Record<string, unknown>,
  timestamp: string = nowInSeconds(),
): Promise<string> {
  const wamid = newInboundWamid();
  const status = await postSignedWebhook(request, connection, {
    contacts: [{ wa_id: customer.waId, profile: { name: customer.firstNames } }],
    messages: [{ from: customer.waId, id: wamid, timestamp, ...content }],
  });
  expect(status, 'el webhook firmado tiene que aceptar el mensaje').toBe(200);
  return wamid;
}

/** Un texto entrante del cliente: con su hora real, la ventana de 24 h queda abierta. */
async function postInboundText(
  request: APIRequestContext,
  connection: FixtureConnection,
  customer: FixtureCustomer,
  body: string,
  timestamp?: string,
): Promise<string> {
  return postInboundMessage(request, connection, customer, { type: 'text', text: { body } }, timestamp);
}

/** El aviso de estado de un saliente, por su `wamid`; `failed` lleva el error que manda Meta. */
async function postOutboundStatus(
  request: APIRequestContext,
  connection: FixtureConnection,
  customer: FixtureCustomer,
  wamid: string,
  metaStatus: 'delivered' | 'failed',
  errors?: readonly Record<string, unknown>[],
): Promise<void> {
  const status = await postSignedWebhook(request, connection, {
    statuses: [
      {
        id: wamid,
        status: metaStatus,
        timestamp: nowInSeconds(),
        recipient_id: customer.waId,
        ...(errors === undefined ? {} : { errors }),
      },
    ],
  });
  expect(status, 'el webhook firmado tiene que aceptar el estado').toBe(200);
}

async function linkedContactId(connection: FixtureConnection, customer: FixtureCustomer): Promise<string> {
  const contact = await prisma.whatsappContact.findUniqueOrThrow({
    where: { connectionId_waId: { connectionId: connection.connectionId, waId: customer.waId } },
    select: { id: true, customerId: true },
  });
  expect(contact.customerId, 'el contacto queda vinculado al cliente de ese telefono').toBe(customer.id);
  return contact.id;
}

async function openContacts(page: Page): Promise<void> {
  await page.goto(CUSTOMER_CONTACTS_ROUTE);
  await expect(page.getByTestId(CONTACTS_SCREEN_TESTID)).toBeVisible({ timeout: 60_000 });
}

function conversationItem(page: Page, contactId: string) {
  return page.locator(`[data-testid="${CONVERSATION_ITEM_TESTID}"][data-contact-id="${contactId}"]`);
}

function messageBubble(page: Page, side: 'in' | 'out', text: string) {
  return page.locator(`[data-testid="${CHAT_MESSAGE_TESTID}"][data-side="${side}"]`).filter({ hasText: text });
}

/** Abre una conversacion de la lista; un clic antes de hidratar se pierde sin error, asi que se repite. */
async function openConversation(page: Page, contactId: string, how: 'click' | 'tap'): Promise<void> {
  const item = conversationItem(page, contactId);
  await expect(item).toBeVisible({ timeout: POLL_TIMEOUT_MS });
  await expect(async () => {
    if (how === 'tap') await item.tap();
    else await item.click();
    await expect(page.getByTestId(CHAT_HEADER_TESTID)).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
}

/**
 * Los contenedores con `overflow` propio (la pantalla, la lista de mensajes, el dialogo) se tragan
 * el desborde de lo que llevan dentro y el documento no lo ve: por eso se mide cada uno.
 */
const R7_CONTAINER_TESTIDS = [
  CONTACTS_SCREEN_TESTID,
  CONVERSATION_LIST_TESTID,
  CONTACTS_CHAT_PANE_TESTID,
  CHAT_PANEL_TESTID,
  CHAT_HEADER_TESTID,
  CHAT_ORDER_DETAIL_TESTID,
  CHAT_MESSAGE_LIST_TESTID,
  CHAT_EMPTY_TESTID,
  CHAT_COMPOSER_TESTID,
  CHAT_TEMPLATE_CHIPS_TESTID,
  SEND_TEMPLATE_DIALOG_TESTID,
  CHAT_IMAGE_VIEWER_TESTID,
] as const;

/** Lo que desborda en horizontal: el documento y cada contenedor visible. Vacio = sin scroll horizontal. */
async function horizontalOverflows(page: Page): Promise<string[]> {
  return page.evaluate((testIds) => {
    const offenders: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth) offenders.push(`documento ${root.scrollWidth} > ${root.clientWidth}`);
    for (const testId of testIds) {
      for (const element of document.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)) {
        // Oculto (`display: none`, como la lista con el chat abierto en el telefono): no se ve.
        if (element.clientWidth === 0) continue;
        if (element.scrollWidth > element.clientWidth) {
          offenders.push(`${testId} ${element.scrollWidth} > ${element.clientWidth}`);
        }
      }
    }
    return offenders;
  }, R7_CONTAINER_TESTIDS);
}

async function expectNoHorizontalScroll(page: Page, where: string): Promise<void> {
  expect(await horizontalOverflows(page), `${where} no produce scroll horizontal`).toEqual([]);
}

/** Un toque antes de hidratar se pierde sin error: se repite hasta que aparece lo que abre. */
async function tapUntilVisible(target: Locator, opened: Locator): Promise<void> {
  await expect(target).toBeVisible({ timeout: 60_000 });
  await expect(async () => {
    await target.tap();
    await expect(opened).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
}

/**
 * Una plantilla que el chat puede ofrecer: aprobada, mapeada y activada. Sin variables, para que su
 * texto quede completo sin contexto. Se siembra antes de abrir la pantalla: la lista de plantillas
 * se lee al cargar la pagina.
 */
async function seedSendableTemplate(connection: FixtureConnection, name: string, text: string): Promise<void> {
  await prisma.whatsappTemplate.create({
    data: {
      companyId: fixtureCompanyId(),
      connectionId: connection.connectionId,
      metaTemplateId: `${Date.now()}${randomInt(100_000, 1_000_000)}`,
      name,
      language: 'es',
      category: 'UTILITY',
      components: [{ type: 'BODY', text }],
      status: 'APPROVED',
      mappingStatus: 'MAPPED',
      enabled: true,
    },
  });
}

/**
 * Un pedido en curso (`PENDIENTE`) del cliente, con una linea de envases: es lo que pinta el detalle
 * del pedido de la cabecera. Borra antes los pedidos de la empresa: el numero (año, secuencia) y los
 * nombres de receta y presentacion son unicos por empresa, y asi un reintento no choca.
 */
async function seedOpenOrder(
  customer: FixtureCustomer,
  names: { readonly recipe: string; readonly presentation: string },
): Promise<void> {
  const company = fixtureCompanyId();
  await deleteOrderData([company]);
  const unit = await prisma.unit.findFirstOrThrow({
    where: { nameNormalized: 'litro', companyId: null },
    select: { id: true },
  });
  const recipe = await prisma.recipe.create({
    data: { name: names.recipe, nameNormalized: normalizeRecipeName(names.recipe), companyId: company },
    select: { id: true },
  });
  const presentation = await prisma.presentation.create({
    data: {
      name: names.presentation,
      nameNormalized: normalizePresentationName(names.presentation),
      unitId: unit.id,
      content: 1,
      companyId: company,
    },
    select: { id: true },
  });
  // El CHECK `orders_order_year_matches_created_at` ata el año a `created_at`.
  const order = await prisma.order.create({
    data: {
      companyId: company,
      orderYear: new Date().getUTCFullYear(),
      orderSequence: 1,
      recipeId: recipe.id,
      quantity: 12,
      unitId: unit.id,
      customerId: customer.id,
    },
    select: { id: true },
  });
  await prisma.orderPresentationLine.create({
    data: { orderId: order.id, companyId: company, presentationId: presentation.id, packages: 12, presentationContent: 1 },
  });
}

test.describe('el chat de WhatsApp de Contactos', () => {
  test('R42, R32, R19: el entrante firmado aparece en la lista y en el chat sin recargar, la respuesta pasa por «Enviando» y «Enviado» y el status delivered la deja «Entregado»', async ({
    page,
  }) => {
    const admin = await createAdministrador('chat', fixtureCompanyId());
    await loginAndLand(page, admin);
    const connection = await createActiveConnection(page, 'chat');
    const customer = await createCustomerWithPhone(admin, fixtureCompanyId(), 'Chat');
    const firstInbound = `Hola, ¿tienen stock? ${RUN_ID.slice(0, 6)}`;
    const secondInbound = `¿Y para mañana? ${RUN_ID.slice(0, 6)}`;
    const reply = `Sí, mañana se lo enviamos ${RUN_ID.slice(0, 6)}`;
    let contactId = '';

    await test.step('R42: con la pantalla abierta y vacia, el entrante aparece en la lista sin recargar', async () => {
      await openContacts(page);
      await expect(page.getByTestId(CONVERSATIONS_EMPTY_TESTID)).toBeVisible();

      await postInboundText(page.request, connection, customer, firstInbound);
      contactId = await linkedContactId(connection, customer);

      const item = conversationItem(page, contactId);
      await expect(item).toBeVisible({ timeout: POLL_TIMEOUT_MS });
      await expect(item).toContainText(customer.firstNames);
      await expect(item).toContainText(firstInbound);
    });

    await test.step('R42: con el chat abierto, el entrante siguiente aparece en el chat sin recargar y sin duplicar', async () => {
      await openConversation(page, contactId, 'click');
      await expect(page.getByTestId(CHAT_HEADER_TESTID)).toContainText(customer.firstNames);
      await expect(messageBubble(page, 'in', firstInbound)).toHaveCount(1);

      await postInboundText(page.request, connection, customer, secondInbound);
      await expect(messageBubble(page, 'in', secondInbound)).toHaveCount(1, { timeout: POLL_TIMEOUT_MS });
      await expect(messageBubble(page, 'in', firstInbound)).toHaveCount(1);
    });

    await test.step('R32: el texto se ve al instante como «Enviando», la caja se vacia y al volver la accion queda «Enviado»', async () => {
      // Se retiene SOLO la Server Action que lleva este texto: la consulta periodica sigue igual.
      await page.route(
        (url) => url.pathname === CUSTOMER_CONTACTS_ROUTE,
        async (route) => {
          const request = route.request();
          if (request.method() === 'POST' && (request.postData() ?? '').includes(reply)) {
            await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
          }
          await route.continue();
        },
      );

      const composer = page.getByTestId(CHAT_COMPOSER_TESTID);
      const box = composer.getByPlaceholder(CHAT_COMPOSER_TEXT.placeholder);
      await expect(box).toBeEnabled();
      await box.fill(reply);
      await composer.getByRole('button', { name: CHAT_COMPOSER_TEXT.send, exact: true }).click();

      const outgoing = messageBubble(page, 'out', reply);
      await expect(outgoing).toHaveCount(1);
      await expect(outgoing).toHaveAttribute('data-delivery', 'sending');
      await expect(outgoing.getByRole('img', { name: CHAT_DELIVERY_LABELS.sending })).toBeVisible();
      await expect(box).toHaveValue('');

      await expect(outgoing).toHaveAttribute('data-delivery', 'sent', { timeout: 60_000 });
      await expect(outgoing.getByRole('img', { name: CHAT_DELIVERY_LABELS.sent })).toBeVisible();
      await page.unrouteAll({ behavior: 'wait' });

      const row = await prisma.whatsappMessage.findFirstOrThrow({
        where: { contactId, direction: 'OUT', body: reply },
        select: { status: true, sentById: true },
      });
      expect(row).toEqual({ status: 'SENT', sentById: admin.id });
    });

    await test.step('R19: el status delivered firmado al webhook pasa el saliente a «Entregado» sin recargar', async () => {
      const row = await prisma.whatsappMessage.findFirstOrThrow({
        where: { contactId, direction: 'OUT', body: reply },
        select: { wamid: true },
      });
      if (row.wamid === null) throw new Error('el saliente enviado tiene que guardar su wamid');
      await postOutboundStatus(page.request, connection, customer, row.wamid, 'delivered');

      const outgoing = messageBubble(page, 'out', reply);
      await expect(outgoing).toHaveAttribute('data-delivery', 'delivered', { timeout: POLL_TIMEOUT_MS });
      await expect(outgoing.getByRole('img', { name: CHAT_DELIVERY_LABELS.delivered })).toBeVisible();
      await expect(outgoing, 'la consulta periodica no duplica el saliente').toHaveCount(1);
    });
  });

  test('R1, R45: sin `whatsapp.consultar` (empresa sin el añadido de integraciones) la ruta responde 404 y Clientes no ofrece «Abrir chat»', async ({
    page,
  }) => {
    const company = fixtureCompanyWithoutAddonsId();
    const admin = await createAdministrador('sinpermiso', company);
    const customer = await createCustomerWithPhone(admin, company, 'Sin');
    await loginAndLand(page, admin);

    await test.step('R1: con sesion y sin el permiso, 404 dentro del layout privado y sin la pantalla', async () => {
      const response = await page.goto(CUSTOMER_CONTACTS_ROUTE);
      expect(response?.status(), 'sin `whatsapp.consultar` la ruta responde 404').toBe(404);
      await expect(page.getByTestId(NOT_FOUND_TESTID)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId(CUSTOMER_CONTACTS_TITLE_TESTID)).toHaveCount(0);
      await expect(page.getByTestId(CONTACTS_SCREEN_TESTID)).toHaveCount(0);
    });

    await test.step('R1: con `?cliente=` tampoco se abre nada', async () => {
      const response = await page.goto(customerChatHref(customer.id));
      expect(response?.status()).toBe(404);
      await expect(page.getByTestId(CHAT_PANEL_TESTID)).toHaveCount(0);
    });

    await test.step('R45: la lista de Clientes muestra al cliente sin «Abrir chat» ni «Sin teléfono válido»', async () => {
      await page.goto(CUSTOMERS_ROUTE);
      await expect(page.getByTestId(CUSTOMERS_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(customer.firstNames).filter({ visible: true }).first()).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByTestId(`${CUSTOMER_CHAT_LINK_TESTID}-${customer.id}`)).toHaveCount(0);
      await expect(page.getByTestId(`${CUSTOMER_CHAT_UNAVAILABLE_TESTID}-${customer.id}`)).toHaveCount(0);
    });
  });

  test('R45, R46: «Abrir chat» desde Clientes lleva a `?cliente=<id>` con el chat del cliente abierto, o vacio y con la ventana cerrada si no tiene conversacion', async ({
    page,
  }) => {
    const admin = await createAdministrador('clientes', fixtureCompanyId());
    await loginAndLand(page, admin);
    const connection = await createActiveConnection(page, 'clientes');
    const withChat = await createCustomerWithPhone(admin, fixtureCompanyId(), 'Con');
    const withoutChat = await createCustomerWithPhone(admin, fixtureCompanyId(), 'Nuevo');
    const inbound = `Buenas tardes ${RUN_ID.slice(0, 6)}`;
    await postInboundText(page.request, connection, withChat, inbound);
    const contactId = await linkedContactId(connection, withChat);

    async function openChatFromCustomers(customer: FixtureCustomer): Promise<void> {
      await page.goto(CUSTOMERS_ROUTE);
      await expect(page.getByTestId(CUSTOMERS_TITLE_TESTID)).toBeVisible({ timeout: 60_000 });
      const link = page.getByTestId(`${CUSTOMER_CHAT_LINK_TESTID}-${customer.id}`).filter({ visible: true });
      await expect(link).toHaveCount(1, { timeout: 60_000 });
      await expect(link).toHaveAttribute('href', customerChatHref(customer.id));
      await link.click();
      await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === customerChatHref(customer.id), {
        timeout: 60_000,
      });
      await expect(page.getByTestId(CHAT_HEADER_TESTID)).toContainText(customer.firstNames, { timeout: 60_000 });
    }

    await test.step('R45, R46: el cliente con conversacion abre su chat, con el entrante y la conversacion marcada en la lista', async () => {
      await openChatFromCustomers(withChat);
      await expect(messageBubble(page, 'in', inbound)).toHaveCount(1);
      await expect(conversationItem(page, contactId)).toHaveAttribute('aria-current', 'true');
    });

    await test.step('R45, R46: el cliente sin conversacion abre un chat vacio con la ventana cerrada', async () => {
      await openChatFromCustomers(withoutChat);
      await expect(page.getByTestId(CHAT_EMPTY_TESTID)).toBeVisible();
      await expect(page.getByTestId(CHAT_WINDOW_BADGE_TESTID)).toHaveText(CHAT_WINDOW_TEXT.closed);
    });
  });

  test.describe('en el telefono', () => {
    test.use({ viewport: PHONE_VIEWPORT, hasTouch: true });

    test('R6, R7: a 360 × 844 se ve la lista o el chat, se vuelve con «Volver a conversaciones» y con «Atrás», sin scroll horizontal', async ({
      page,
    }) => {
      const admin = await createAdministrador('movil', fixtureCompanyId());
      await loginAndLand(page, admin);
      const connection = await createActiveConnection(page, 'movil');
      const customer = await createCustomerWithPhone(admin, fixtureCompanyId(), 'Movil');
      const inbound = `Un mensaje bastante largo para ver que la burbuja baja de linea y no desborda el ancho del telefono ${RUN_ID}`;
      await postInboundText(page.request, connection, customer, inbound);
      const contactId = await linkedContactId(connection, customer);

      const list = page.getByTestId(CONVERSATION_LIST_TESTID);
      const chatPane = page.getByTestId(CONTACTS_CHAT_PANE_TESTID);
      const backButton = page.getByRole('button', { name: CHAT_HEADER_TEXT.back }).filter({ visible: true });

      await test.step('R6, R7: al entrar solo se ve la lista, sin scroll horizontal', async () => {
        await openContacts(page);
        await expect(list).toBeVisible();
        await expect(chatPane).toBeHidden();
        await expectNoHorizontalScroll(page, 'la lista');
      });

      await test.step('R6, R7: al tocar la conversacion se ve solo el chat, sin scroll horizontal', async () => {
        await openConversation(page, contactId, 'tap');
        await expect(chatPane).toBeVisible();
        await expect(list).toBeHidden();
        await expect(messageBubble(page, 'in', inbound)).toBeVisible();
        await expectNoHorizontalScroll(page, 'el chat');
      });

      await test.step('R6: «Volver a conversaciones» vuelve a la lista', async () => {
        await expect(backButton).toHaveCount(1);
        await backButton.tap();
        await expect(list).toBeVisible();
        await expect(chatPane).toBeHidden();
        await expectNoHorizontalScroll(page, 'la lista');
      });

      await test.step('R6: «Atrás» del navegador desde el chat tambien vuelve a la lista', async () => {
        await openConversation(page, contactId, 'tap');
        await expect(list).toBeHidden();
        await page.goBack();
        await expect(list).toBeVisible();
        await expect(chatPane).toBeHidden();
        await expectNoHorizontalScroll(page, 'la lista');
      });
    });

    test('R7: a 360 px no hay scroll horizontal con las burbujas de plantillas, el detalle del pedido, el dialogo «Enviar plantilla», cada tipo de mensaje y el visor de imagen', async ({
      page,
    }) => {
      // Tres clientes, dos envios por la UI y el visor: no cabe en el tope comun del archivo.
      test.setTimeout(480_000);
      const admin = await createAdministrador('movil7', fixtureCompanyId());
      await loginAndLand(page, admin);
      const connection = await createActiveConnection(page, 'movil7');

      // Palabras largas sin espacios: si una pieza no corta la linea, es la que desborda.
      const longWord = `sinespaciosparaverquecortalalinea${RUN_ID}`;
      const templateName = `aviso_de_pedido_listo_para_recoger_en_la_planta_${RUN_ID.slice(0, 12)}`;
      await seedSendableTemplate(
        connection,
        templateName,
        `Hola, su pedido ya esta listo para recoger en la planta. Referencia ${longWord}.`,
      );

      const withoutChat = await createCustomerWithPhone(admin, fixtureCompanyId(), 'Plantilla');
      const closedWindow = await createCustomerWithPhone(admin, fixtureCompanyId(), 'Cerrada');
      const everyType = await createCustomerWithPhone(admin, fixtureCompanyId(), 'Tipos');

      await seedOpenOrder(closedWindow, {
        recipe: `Detergente multiusos concentrado ${longWord}`,
        presentation: `Garrafa de cinco litros con tapa ${longWord}`,
      });
      // Hace 25 h: el cliente tiene conversacion pero la ventana de 24 h ya se cerro.
      await postInboundText(page.request, connection, closedWindow, `Gracias ${RUN_ID.slice(0, 6)}`, hoursAgoInSeconds(25));
      await linkedContactId(connection, closedWindow);

      const imageCaption = `Foto del envase roto ${longWord}`;
      const locationName = `Bodega principal ${longWord}`;
      await postInboundText(page.request, connection, everyType, `Le paso los datos ${RUN_ID.slice(0, 6)}`);
      await postInboundMessage(page.request, connection, everyType, {
        type: 'image',
        image: { id: `media-image-${RUN_ID}`, mime_type: 'image/jpeg', caption: imageCaption },
      });
      await postInboundMessage(page.request, connection, everyType, {
        type: 'sticker',
        sticker: { id: `media-sticker-${RUN_ID}`, mime_type: 'image/webp' },
      });
      await postInboundMessage(page.request, connection, everyType, {
        type: 'location',
        location: { latitude: 4.711, longitude: -74.0721, name: locationName, address: `Calle 26 # 68-35 ${longWord}` },
      });
      await linkedContactId(connection, everyType);

      const chatPane = page.getByTestId(CONTACTS_CHAT_PANE_TESTID);

      async function openCustomerChat(customer: FixtureCustomer): Promise<void> {
        await page.goto(customerChatHref(customer.id));
        await expect(page.getByTestId(CHAT_HEADER_TESTID)).toContainText(customer.firstNames, { timeout: 60_000 });
        await expect(chatPane).toBeVisible();
      }

      await test.step('R7: el chat sin mensajes con las burbujas de plantillas, sin scroll horizontal', async () => {
        await openCustomerChat(withoutChat);
        await expect(page.getByTestId(CHAT_EMPTY_TESTID)).toBeVisible();
        await expect(page.getByTestId(CHAT_WINDOW_BADGE_TESTID)).toHaveText(CHAT_WINDOW_TEXT.closed);
        const chip = page.getByTestId(CHAT_TEMPLATE_CHIPS_TESTID).getByRole('button', { name: templateName });
        await expect(chip).toBeVisible();
        await expectNoHorizontalScroll(page, 'las burbujas de plantillas');

        // Con la burbuja marcada, el texto de la plantilla rellena la caja.
        await expect(async () => {
          await chip.tap();
          await expect(chip).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
        }).toPass({ timeout: 60_000 });
        await expect(page.getByTestId(CHAT_COMPOSER_TESTID).getByRole('textbox')).toHaveValue(new RegExp(longWord));
        await expectNoHorizontalScroll(page, 'la burbuja de plantilla marcada');
      });

      await test.step('R7: el detalle del pedido desplegado, sin scroll horizontal', async () => {
        await openCustomerChat(closedWindow);
        await expect(page.getByTestId(CHAT_WINDOW_BADGE_TESTID)).toHaveText(CHAT_WINDOW_TEXT.closed);
        const detail = page.getByTestId(CHAT_ORDER_DETAIL_TESTID);
        await tapUntilVisible(page.getByRole('button', { name: CHAT_HEADER_TEXT.orderDetailsToggle }), detail);
        await expect(detail).toContainText(longWord);
        await expectNoHorizontalScroll(page, 'el detalle del pedido');
      });

      await test.step('R7: el dialogo «Enviar plantilla», sin scroll horizontal', async () => {
        const dialog = page.getByTestId(SEND_TEMPLATE_DIALOG_TESTID);
        await tapUntilVisible(
          page.getByTestId(CHAT_COMPOSER_TESTID).getByRole('button', { name: CHAT_COMPOSER_TEXT.sendTemplate, exact: true }),
          dialog,
        );
        await expect(dialog).toContainText(longWord);
        await expectNoHorizontalScroll(page, 'el dialogo «Enviar plantilla»');
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
      });

      await test.step('R7: el chat con imagen, sticker, ubicacion, reaccion y fallido, sin scroll horizontal', async () => {
        await openCustomerChat(everyType);
        const composer = page.getByTestId(CHAT_COMPOSER_TESTID);
        const box = composer.getByPlaceholder(CHAT_COMPOSER_TEXT.placeholder);

        const sendButton = composer.getByRole('button', { name: CHAT_COMPOSER_TEXT.send, exact: true });

        // El chat se abre con `page.goto`: la cabecera llega pintada por el servidor antes de
        // hidratar, y un `fill` antes de hidratar deja el texto sin llegar al estado (el boton
        // sigue deshabilitado). Se repite hasta que «Enviar» se habilita.
        async function sendAndWaitSent(text: string): Promise<string> {
          await expect(box).toBeEnabled({ timeout: 60_000 });
          await expect(async () => {
            await box.fill('');
            await box.fill(text);
            await expect(sendButton).toBeEnabled({ timeout: 5_000 });
          }).toPass({ timeout: 60_000 });
          await sendButton.tap();
          await expect(messageBubble(page, 'out', text)).toHaveAttribute('data-delivery', 'sent', { timeout: 60_000 });
          const row = await prisma.whatsappMessage.findFirstOrThrow({
            where: { companyId: fixtureCompanyId(), direction: 'OUT', body: text },
            select: { wamid: true },
          });
          if (row.wamid === null) throw new Error('el saliente enviado tiene que guardar su wamid');
          return row.wamid;
        }

        const reacted = `Recibido, lo revisamos ${RUN_ID.slice(0, 6)}`;
        const reactedWamid = await sendAndWaitSent(reacted);
        await postInboundMessage(page.request, connection, everyType, {
          type: 'reaction',
          reaction: { message_id: reactedWamid, emoji: REACTION_EMOJI },
        });

        // La palabra larga va en el propio texto del fallido: el motivo que pinta la burbuja sale
        // del codigo de Meta (131026), no de `error_data.details`, asi que ahi no se veria.
        const failedText = `Le enviamos la factura ${longWord}`;
        const failedWamid = await sendAndWaitSent(failedText);
        await postOutboundStatus(page.request, connection, everyType, failedWamid, 'failed', [
          { code: 131026, title: 'Message undeliverable', error_data: { details: 'Destinatario no disponible' } },
        ]);

        await expect(page.getByRole('button', { name: CHAT_IMAGE_TEXT.open })).toBeVisible();
        await expect(page.getByTestId(CHAT_MESSAGE_LIST_TESTID)).toContainText(imageCaption);
        await expect(page.getByRole('img', { name: CHAT_IMAGE_TEXT.stickerAlt, exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: new RegExp(CHAT_LOCATION_TEXT.openMap) })).toContainText(locationName);
        await expect(
          messageBubble(page, 'out', reacted).getByRole('img', { name: CHAT_MESSAGE_TEXT.reaction(REACTION_EMOJI) }),
        ).toBeVisible({ timeout: POLL_TIMEOUT_MS });
        const failed = messageBubble(page, 'out', failedText);
        await expect(failed).toHaveAttribute('data-delivery', 'failed', { timeout: POLL_TIMEOUT_MS });
        await expect(failed).toContainText(longWord);
        await expectNoHorizontalScroll(page, 'el chat con cada tipo de mensaje');
      });

      await test.step('R7: el visor de imagen abierto, sin scroll horizontal', async () => {
        const viewer = page.getByTestId(CHAT_IMAGE_VIEWER_TESTID);
        await tapUntilVisible(page.getByRole('button', { name: CHAT_IMAGE_TEXT.open }), viewer);
        await expect(viewer).toContainText(imageCaption);
        await expectNoHorizontalScroll(page, 'el visor de imagen');
        await viewer.getByRole('button', { name: CHAT_IMAGE_TEXT.close }).tap();
        await expect(viewer).toBeHidden();
      });
    });
  });
});
