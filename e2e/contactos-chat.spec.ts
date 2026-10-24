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
 * - **El telefono** (390 × 844, tactil): lista ↔ chat con «Volver a conversaciones» y con «Atrás»
 *   del navegador (R6), sin scroll horizontal en ninguno de los dos (R7).
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
 * limpieza va de hijas a madres: mensajes, contactos, plantillas, conexion, vinculos de telefono,
 * numeros, clientes, usuarios y empresas.
 *
 * Los textos y los `data-testid` salen de `contact-texts.ts` (modulo de textos, no de cliente) y de
 * `customer-chat-link.tsx`; ningun literal suelto donde hay constante exportada.
 *
 * ENTRADA: siempre por `loginAndLand`.
 */
import { createHmac, randomInt, randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

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
  CHAT_MESSAGE_TESTID,
  CHAT_PANEL_TESTID,
  CHAT_WINDOW_BADGE_TESTID,
  CHAT_WINDOW_TEXT,
  CONTACTS_CHAT_PANE_TESTID,
  CONTACTS_SCREEN_TESTID,
  CONVERSATION_ITEM_TESTID,
  CONVERSATION_LIST_TESTID,
  CONVERSATIONS_EMPTY_TESTID,
  CUSTOMER_CONTACTS_TITLE_TESTID,
} from '@/app/(private)/clientes/contactos/components/contact-texts';
import { clientes } from '@/lib/composition';
import { normalizeCompanyName, ROLE_ADMINISTRADOR } from '@/lib/modules/identity';
import { createPasswordHash } from '@/lib/modules/identity/adapters/driven/security/password-hash';
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

/** Teléfono de `docs/architecture.md > Componentes`: 390 px y tactil. */
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

/**
 * La consulta periodica es de 8 s (R42, nunca mas de 10 s entre consultas): dos turnos y el
 * arranque en frio de `next dev` caben de sobra.
 */
const POLL_TIMEOUT_MS = 30_000;

/** Lo que se retiene el envio del texto para poder ver el saliente «Enviando» (R32). */
const SEND_DELAY_MS = 3_000;

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

/** Clientes y sus telefonos, de hijas a madres. Despues de `deleteWhatsappData`. */
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

/** Un texto entrante del cliente: con su hora real, la ventana de 24 h queda abierta. */
async function postInboundText(
  request: APIRequestContext,
  connection: FixtureConnection,
  customer: FixtureCustomer,
  body: string,
): Promise<void> {
  const status = await postSignedWebhook(request, connection, {
    contacts: [{ wa_id: customer.waId, profile: { name: customer.firstNames } }],
    messages: [
      { from: customer.waId, id: newInboundWamid(), timestamp: nowInSeconds(), type: 'text', text: { body } },
    ],
  });
  expect(status, 'el webhook firmado tiene que aceptar el mensaje').toBe(200);
}

/** El aviso de estado de un saliente, por su `wamid`. */
async function postOutboundStatus(
  request: APIRequestContext,
  connection: FixtureConnection,
  customer: FixtureCustomer,
  wamid: string,
  metaStatus: 'delivered',
): Promise<void> {
  const status = await postSignedWebhook(request, connection, {
    statuses: [{ id: wamid, status: metaStatus, timestamp: nowInSeconds(), recipient_id: customer.waId }],
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

async function hasNoHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
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

    test('R6, R7: a 390 × 844 se ve la lista o el chat, se vuelve con «Volver a conversaciones» y con «Atrás», sin scroll horizontal', async ({
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
        expect(await hasNoHorizontalScroll(page), 'la lista no produce scroll horizontal').toBe(true);
      });

      await test.step('R6, R7: al tocar la conversacion se ve solo el chat, sin scroll horizontal', async () => {
        await openConversation(page, contactId, 'tap');
        await expect(chatPane).toBeVisible();
        await expect(list).toBeHidden();
        await expect(messageBubble(page, 'in', inbound)).toBeVisible();
        expect(await hasNoHorizontalScroll(page), 'el chat no produce scroll horizontal').toBe(true);
      });

      await test.step('R6: «Volver a conversaciones» vuelve a la lista', async () => {
        await expect(backButton).toHaveCount(1);
        await backButton.tap();
        await expect(list).toBeVisible();
        await expect(chatPane).toBeHidden();
        expect(await hasNoHorizontalScroll(page)).toBe(true);
      });

      await test.step('R6: «Atrás» del navegador desde el chat tambien vuelve a la lista', async () => {
        await openConversation(page, contactId, 'tap');
        await expect(list).toBeHidden();
        await page.goBack();
        await expect(list).toBeVisible();
        await expect(chatPane).toBeHidden();
        expect(await hasNoHorizontalScroll(page)).toBe(true);
      });
    });
  });
});
