// Dobles de los puertos de la conexion de WhatsApp para los tests de los casos de uso.
// El cifrador guarda el texto en claro FUERA del valor cifrado: asi un test puede afirmar que el
// valor que llega a la base no lo contiene, y que descifrar exige el mismo contexto que cifrar.

import { vi } from 'vitest'

import { phoneMatchesWaId, type CustomerCatalog, type CustomerRef } from '@/lib/modules/clientes'
import type { PeopleDirectory } from '@/lib/modules/identity'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'
import {
  SecretUnreadableError,
  WhatsappTemplateNameTakenError,
  WhatsappVariableKeyTakenError,
} from '@/lib/modules/integraciones/domain/errors'
import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'
import type { SecretContext } from '@/lib/modules/integraciones/domain/secret-context'
import type { TemplateSyncPlan } from '@/lib/modules/integraciones/domain/template-sync-plan'
import type { WhatsappConnectionRecord } from '@/lib/modules/integraciones/domain/whatsapp-connection'
import type { ContactLink } from '@/lib/modules/integraciones/domain/whatsapp-contact-link'
import type {
  TemplateWebhookUpdate,
  WhatsappTemplateRecord,
} from '@/lib/modules/integraciones/domain/whatsapp-template'
import { sameComponents } from '@/lib/modules/integraciones/domain/whatsapp-template-components'
import type {
  OutboundContact,
  OutboundMessageRecord,
} from '@/lib/modules/integraciones/domain/whatsapp-outbound-message'
import type { WhatsappVariableKeyRecord } from '@/lib/modules/integraciones/domain/whatsapp-variable-key'
import type { CustomerPhoneLinks } from '@/lib/modules/integraciones/ports/customer-phone-links'
import type { CustomerPhoneOwners } from '@/lib/modules/integraciones/ports/customer-phone-owners'
import type { IntegrationsSwitch } from '@/lib/modules/integraciones/ports/integrations-switch'
import type { RandomSource } from '@/lib/modules/integraciones/ports/random-source'
import type { SecretCipher } from '@/lib/modules/integraciones/ports/secret-cipher'
import type { SecretDigest } from '@/lib/modules/integraciones/ports/secret-digest'
import type {
  NewWhatsappConnectionRow,
  WhatsappConnectionPatch,
  WhatsappConnectionRepository,
} from '@/lib/modules/integraciones/ports/whatsapp-connection-repository'
import type { GraphProbeResult, WhatsappGraphClient } from '@/lib/modules/integraciones/ports/whatsapp-graph-client'
import type {
  WhatsappContactBlock,
  WhatsappContactLinkRow,
  WhatsappContactRepository,
} from '@/lib/modules/integraciones/ports/whatsapp-contact-repository'
import type {
  WhatsappContactTransactionScope,
  WhatsappContactUnitOfWork,
} from '@/lib/modules/integraciones/ports/whatsapp-contact-unit-of-work'
import type {
  NewCreatedTemplateRow,
  TemplateSyncRow,
  WhatsappTemplateRepository,
} from '@/lib/modules/integraciones/ports/whatsapp-template-repository'
import type {
  ChatMessageRow,
  ConversationContactRow,
  ConversationRow,
  WhatsappConversationRepository,
} from '@/lib/modules/integraciones/ports/whatsapp-conversation-repository'
import type { WhatsappOutboxRepository } from '@/lib/modules/integraciones/ports/whatsapp-outbox-repository'
import type { WhatsappSendLog } from '@/lib/modules/integraciones/ports/whatsapp-send-log'
import type { WhatsappVariableKeyRepository } from '@/lib/modules/integraciones/ports/whatsapp-variable-key-repository'
import type { WhatsappWebhookDirectory } from '@/lib/modules/integraciones/ports/whatsapp-webhook-directory'

export const COMPANY_ID = '00000000-0000-4000-8000-0000000000aa'
export const OTHER_COMPANY_ID = '00000000-0000-4000-8000-0000000000bb'
export const CONNECTION_ID = '00000000-0000-4000-8000-000000000001'
export const NEW_CONNECTION_ID = '00000000-0000-4000-8000-000000000002'
export const ACTOR_ID = '00000000-0000-4000-8000-0000000000cc'
export const NOW = new Date('2026-10-09T12:00:00.000Z')

export const ACCESS_TOKEN = 'EAAG-token-en-claro'
export const APP_SECRET = 'app-secret-en-claro'

export const GOOD_PROBE: GraphProbeResult = {
  ok: true,
  phone: { displayPhoneNumber: '+57 300 1234567', verifiedName: 'Empresa Verificada' },
}

export function admin(overrides: Partial<Actor> = {}): Actor {
  return { id: ACTOR_ID, companyId: COMPANY_ID, permissions: ['integraciones.modificar'], ...overrides }
}

export function validCreateInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    displayName: 'Ventas',
    wabaId: '2345678901',
    phoneNumberId: '3456789012',
    accessToken: ACCESS_TOKEN,
    appSecret: APP_SECRET,
    ...overrides,
  }
}

export function makeCipher() {
  const vault = new Map<string, { plaintext: string; context: SecretContext }>()
  let counter = 0
  const encrypt = vi.fn(async (plaintext: string, context: SecretContext) => {
    counter += 1
    const stored = `v1:cifrado-${counter}`
    vault.set(stored, { plaintext, context: { ...context } })
    return stored
  })
  const decrypt = vi.fn(async (stored: string, context: SecretContext) => {
    const entry = vault.get(stored)
    if (
      entry === undefined ||
      entry.context.companyId !== context.companyId ||
      entry.context.recordId !== context.recordId ||
      entry.context.field !== context.field
    ) {
      throw new SecretUnreadableError('doble: no autentica')
    }
    return entry.plaintext
  })
  /** Guarda un secreto como si lo hubiera cifrado un alta anterior. */
  function seed(plaintext: string, context: SecretContext): string {
    counter += 1
    const stored = `v1:sembrado-${counter}`
    vault.set(stored, { plaintext, context })
    return stored
  }
  const cipher: SecretCipher = { encrypt, decrypt }
  return { cipher, encrypt, decrypt, seed }
}

export function makeDigest(): SecretDigest {
  const digestOf = (secret: string) => `resumen(${secret.length}):${[...secret].reverse().join('')}`
  return { digestOf: vi.fn(digestOf), matches: vi.fn((secret, stored) => digestOf(secret) === stored) }
}

export function makeRandom(tokens: string[] = ['verify-token-1', 'verify-token-2']): RandomSource & {
  newId: ReturnType<typeof vi.fn>
  newVerifyToken: ReturnType<typeof vi.fn>
} {
  const queue = [...tokens]
  return {
    newId: vi.fn(() => NEW_CONNECTION_ID),
    newVerifyToken: vi.fn(() => queue.shift() ?? 'verify-token-sobrante'),
  }
}

export const CREATED_META_TEMPLATE_ID = '1234567890123456'
export const SENT_WAMID = 'wamid.HBgMNTczMDAxMjM0NTY3FQIAERgS'

export function makeGraph(result: GraphProbeResult = GOOD_PROBE) {
  const fetchPhoneNumber = vi.fn<WhatsappGraphClient['fetchPhoneNumber']>(async () => result)
  const createTemplate = vi.fn<WhatsappGraphClient['createTemplate']>(async () => ({
    ok: true,
    id: CREATED_META_TEMPLATE_ID,
    status: 'PENDING',
    category: null,
  }))
  const listTemplatesPage = vi.fn<WhatsappGraphClient['listTemplatesPage']>(async () => ({
    ok: true,
    items: [],
    next: null,
  }))
  const deleteTemplate = vi.fn<WhatsappGraphClient['deleteTemplate']>(async () => ({ ok: true }))
  const sendMessage = vi.fn<WhatsappGraphClient['sendMessage']>(async () => ({ ok: true, wamid: SENT_WAMID }))
  const graph: WhatsappGraphClient = { fetchPhoneNumber, createTemplate, listTemplatesPage, deleteTemplate, sendMessage }
  return { graph, fetchPhoneNumber, createTemplate, listTemplatesPage, deleteTemplate, sendMessage }
}

/** Repositorio en memoria que respeta el ambito: una fila de otra empresa o borrada no se ve. */
export function makeRepository(initial: (WhatsappConnectionRecord & { deleted?: boolean })[] = []) {
  const rows = new Map(initial.map((row) => [row.id, { ...row }]))
  const visible = (row: WhatsappConnectionRecord & { deleted?: boolean }, scope: IntegracionesScope) =>
    row.companyId === scope.companyId && row.deleted !== true
  const strip = (row: WhatsappConnectionRecord & { deleted?: boolean }): WhatsappConnectionRecord => {
    const record = { ...row }
    delete record.deleted
    return record
  }

  const findLive = vi.fn(async (scope: IntegracionesScope) => {
    const row = [...rows.values()].find((candidate) => visible(candidate, scope))
    return row === undefined ? null : strip(row)
  })
  const findLiveById = vi.fn(async (id: string, scope: IntegracionesScope) => {
    const row = rows.get(id)
    return row === undefined || !visible(row, scope) ? null : strip(row)
  })
  const create = vi.fn(async (row: NewWhatsappConnectionRow, scope: IntegracionesScope) => {
    const record: WhatsappConnectionRecord = {
      id: row.id,
      companyId: scope.companyId,
      origin: row.origin,
      displayName: row.displayName,
      wabaId: row.wabaId,
      phoneNumberId: row.phoneNumberId,
      displayPhoneNumber: row.displayPhoneNumber,
      verifiedName: row.verifiedName,
      accessTokenEnc: row.accessTokenEnc,
      appSecretEnc: row.appSecretEnc,
      verifyTokenHash: row.verifyTokenHash,
      status: row.status,
      lastError: row.lastError,
      lastCheckedAt: row.lastCheckedAt,
      lastWebhookAt: null,
      templatesSyncedAt: null,
    }
    rows.set(record.id, { ...record })
    return record
  })
  const update = vi.fn(async (id: string, patch: WhatsappConnectionPatch, scope: IntegracionesScope) => {
    const row = rows.get(id)
    if (row === undefined || !visible(row, scope)) return null
    const next = { ...row, ...patch, lastWebhookAt: patch.lastWebhookAt === undefined ? row.lastWebhookAt : patch.lastWebhookAt }
    rows.set(id, next)
    return strip(next)
  })
  /** Igual que los dos `UPDATE` condicionados del adaptador: una conexion apagada no cambia. */
  const recordWebhookHandshake = vi.fn(async (id: string, at: Date, scope: IntegracionesScope) => {
    const row = rows.get(id)
    if (row === undefined || !visible(row, scope) || row.status === 'DISABLED') return
    rows.set(id, { ...row, lastWebhookAt: at, status: row.status === 'PENDING' ? 'ACTIVE' : row.status })
  })

  const connections: WhatsappConnectionRepository = { findLive, findLiveById, create, update, recordWebhookHandshake }
  return {
    connections,
    findLive,
    findLiveById,
    create,
    update,
    recordWebhookHandshake,
    row: (id: string) => {
      const row = rows.get(id)
      return row === undefined ? undefined : strip(row)
    },
  }
}

/** Una conexion guardada con sus dos secretos cifrados en su contexto real. */
export function storedConnection(
  seed: (plaintext: string, context: SecretContext) => string,
  overrides: Partial<WhatsappConnectionRecord> = {},
): WhatsappConnectionRecord {
  const id = overrides.id ?? CONNECTION_ID
  const companyId = overrides.companyId ?? COMPANY_ID
  return {
    id,
    companyId,
    origin: 'MANUAL',
    displayName: 'Ventas',
    wabaId: '2345678901',
    phoneNumberId: '3456789012',
    displayPhoneNumber: '+57 300 0000000',
    verifiedName: 'Nombre Anterior',
    accessTokenEnc: seed(ACCESS_TOKEN, { companyId, recordId: id, field: 'access_token' }),
    appSecretEnc: seed(APP_SECRET, { companyId, recordId: id, field: 'app_secret' }),
    verifyTokenHash: 'resumen-anterior',
    status: 'PENDING',
    lastError: null,
    lastCheckedAt: new Date('2026-10-01T00:00:00.000Z'),
    lastWebhookAt: null,
    templatesSyncedAt: null,
    ...overrides,
  }
}

/** Resolutor de empresa del webhook: `companies` dice de que empresa es cada id de conexion. */
export function makeWebhookDirectory(companies: Record<string, string> = { [CONNECTION_ID]: COMPANY_ID }) {
  const companyOfConnection = vi.fn<WhatsappWebhookDirectory['companyOfConnection']>(
    async (connectionId) => companies[connectionId] ?? null,
  )
  const directory: WhatsappWebhookDirectory = { companyOfConnection }
  return { directory, companyOfConnection }
}

/** Interruptor del anadido `integraciones`, prendido por defecto. */
export function makeIntegrationsSwitch(on = true) {
  const isOn = vi.fn<IntegrationsSwitch['isOn']>(async () => on)
  const integrations: IntegrationsSwitch = { isOn }
  return { integrations, isOn }
}

export const CONTACT_ID = '00000000-0000-4000-8000-0000000000d1'
export const OTHER_CONTACT_ID = '00000000-0000-4000-8000-0000000000d2'
export const CUSTOMER_ID = '00000000-0000-4000-8000-0000000000e1'
export const OTHER_CUSTOMER_ID = '00000000-0000-4000-8000-0000000000e2'
export const THIRD_CUSTOMER_ID = '00000000-0000-4000-8000-0000000000e3'

export type ContactDoubleRow = {
  readonly id: string
  readonly companyId: string
  readonly waId: string
  readonly link: ContactLink
  readonly blocked: WhatsappContactBlock | null
}

export function contactRow(overrides: Partial<ContactDoubleRow> = {}): ContactDoubleRow {
  return {
    id: CONTACT_ID,
    companyId: COMPANY_ID,
    waId: '573001234567',
    link: { customerId: null, linkedBy: null },
    blocked: null,
    ...overrides,
  }
}

export const TEMPLATE_ID = '00000000-0000-4000-8000-000000000101'

/** Una plantilla guardada de la conexion por defecto. */
export function storedTemplate(overrides: Partial<WhatsappTemplateRecord> = {}): WhatsappTemplateRecord {
  return {
    id: TEMPLATE_ID,
    companyId: COMPANY_ID,
    connectionId: CONNECTION_ID,
    metaTemplateId: '9001',
    name: 'bienvenida',
    language: 'es',
    category: 'UTILITY',
    components: [{ type: 'BODY', text: 'Hola' }],
    status: 'APPROVED',
    statusRaw: null,
    rejectedReason: null,
    lastSyncedAt: new Date('2026-10-01T00:00:00.000Z'),
    createdById: ACTOR_ID,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    deletedAt: null,
    mappingStatus: 'MAPPED',
    enabled: true,
    variables: [],
    ...overrides,
  }
}

/** Contactos en memoria que respetan el ambito: uno de otra empresa no se ve ni se escribe. */
export function makeContactRepository(initial: readonly ContactDoubleRow[] = []) {
  const rows = new Map(initial.map((row) => [row.id, { ...row }]))
  const visible = (row: ContactDoubleRow | undefined, scope: IntegracionesScope): row is ContactDoubleRow =>
    row !== undefined && row.companyId === scope.companyId
  const toLinkRow = (row: ContactDoubleRow): WhatsappContactLinkRow => ({ id: row.id, waId: row.waId, link: row.link })

  const findById = vi.fn<WhatsappContactRepository['findById']>(async (id, scope) => {
    const row = rows.get(id)
    return visible(row, scope) ? toLinkRow(row) : null
  })
  const findByWaIds = vi.fn<WhatsappContactRepository['findByWaIds']>(async (waIds, scope) =>
    [...rows.values()].filter((row) => visible(row, scope) && waIds.includes(row.waId)).map(toLinkRow),
  )
  const setLink = vi.fn<WhatsappContactRepository['setLink']>(async (id, link, scope) => {
    const row = rows.get(id)
    if (visible(row, scope)) rows.set(id, { ...row, link })
  })
  const setBlocked = vi.fn<WhatsappContactRepository['setBlocked']>(async (id, blocked, scope) => {
    const row = rows.get(id)
    if (!visible(row, scope)) return 'not_found'
    if (blocked === null || row.blocked === null) rows.set(id, { ...row, blocked })
    return 'ok'
  })

  const contacts: WhatsappContactRepository = { findById, findByWaIds, setLink, setBlocked }
  return { contacts, findById, findByWaIds, setLink, setBlocked, row: (id: string) => rows.get(id) }
}

/**
 * Duenos de numeros con la regla real de coincidencia: `phones` dice que numeros vivos tiene cada
 * cliente vivo, por empresa. Un cliente dado de baja o un vinculo quitado simplemente no esta.
 */
export function makeOwners(phones: Record<string, Record<string, readonly string[]>> = {}) {
  const ownersOf = vi.fn<CustomerPhoneOwners['ownersOf']>(async (waId, companyId) =>
    Object.entries(phones[companyId] ?? {})
      .filter(([, numbers]) => numbers.some((number) => phoneMatchesWaId(number, waId)))
      .map(([customerId]) => customerId),
  )
  const owners: CustomerPhoneOwners = { ownersOf }
  return { owners, ownersOf }
}

/** Telefonos de cliente: devuelve lo que el test fije y anota cada llamada. */
export function makeCustomerPhoneLinks(
  results: {
    add?: Awaited<ReturnType<CustomerPhoneLinks['addWaId']>>
    remove?: Awaited<ReturnType<CustomerPhoneLinks['removeWaId']>>
    mainPhone?: Awaited<ReturnType<CustomerPhoneLinks['mainPhoneOf']>>
    alive?: boolean
  } = {},
) {
  const addWaId = vi.fn<CustomerPhoneLinks['addWaId']>(async () => results.add ?? { numbers: [] })
  const removeWaId = vi.fn<CustomerPhoneLinks['removeWaId']>(async () => results.remove ?? { numbers: [] })
  const mainPhoneOf = vi.fn<CustomerPhoneLinks['mainPhoneOf']>(async () => results.mainPhone ?? 'no_phone')
  const isCustomerAlive = vi.fn<CustomerPhoneLinks['isCustomerAlive']>(async () => results.alive ?? true)
  const customerPhones: CustomerPhoneLinks = { addWaId, removeWaId, mainPhoneOf, isCustomerAlive }
  return { customerPhones, addWaId, removeWaId, mainPhoneOf, isCustomerAlive }
}

/** Registro del fallo de un envío: anota cada aviso sin escribir en la consola. */
export function makeSendLog() {
  const sendFailed = vi.fn<WhatsappSendLog['sendFailed']>()
  const sendLog: WhatsappSendLog = { sendFailed }
  return { sendLog, sendFailed }
}

/** Unidad de trabajo sin base: corre el trabajo con los puertos dados y cuenta las aperturas. */
export function makeContactUnitOfWork(scope: WhatsappContactTransactionScope) {
  const run = vi.fn((work: (s: WhatsappContactTransactionScope) => Promise<unknown>) => work(scope))
  const unitOfWork: WhatsappContactUnitOfWork = {
    run: <T,>(work: (s: WhatsappContactTransactionScope) => Promise<T>) => run(work) as Promise<T>,
  }
  return { unitOfWork, run }
}

type TemplateRows = Map<string, WhatsappTemplateRecord>

function ofScope(row: WhatsappTemplateRecord, scope: IntegracionesScope): boolean {
  return row.companyId === scope.companyId
}

function isLive(row: WhatsappTemplateRecord, scope: IntegracionesScope): boolean {
  return ofScope(row, scope) && row.deletedAt === null
}

function byNameLanguageId(a: WhatsappTemplateRecord, b: WhatsappTemplateRecord): number {
  return a.name.localeCompare(b.name) || a.language.localeCompare(b.language) || a.id.localeCompare(b.id)
}

function toSyncRow(row: WhatsappTemplateRecord): TemplateSyncRow {
  return {
    id: row.id,
    metaTemplateId: row.metaTemplateId,
    name: row.name,
    language: row.language,
    category: row.category,
    status: row.status,
    statusRaw: row.statusRaw,
    rejectedReason: row.rejectedReason,
    components: row.components,
    deletedAt: row.deletedAt,
    mappingStatus: row.mappingStatus,
    enabled: row.enabled,
  }
}

/** La carrera del alta: si la sincronizacion ya inserto ese id de Meta, gana su fila y solo se pone el creador. */
function insertCreatedInto(
  rows: TemplateRows,
  newId: () => string,
  now: () => Date,
  row: NewCreatedTemplateRow,
  connectionId: string,
  scope: IntegracionesScope,
): { record: WhatsappTemplateRecord; inserted: boolean } {
  const existing = [...rows.values()].find(
    (candidate) => candidate.connectionId === connectionId && candidate.metaTemplateId === row.metaTemplateId,
  )
  if (existing !== undefined) {
    if (!ofScope(existing, scope)) throw new Error('doble: la conexion no es de la empresa del ambito')
    const kept = { ...existing, createdById: existing.createdById ?? row.createdById }
    rows.set(kept.id, kept)
    return { record: { ...kept }, inserted: false }
  }
  const taken = [...rows.values()].some(
    (candidate) =>
      candidate.deletedAt === null &&
      candidate.connectionId === connectionId &&
      candidate.name === row.name &&
      candidate.language === row.language,
  )
  if (taken) throw new WhatsappTemplateNameTakenError('doble: otra viva con el mismo nombre e idioma')
  const record: WhatsappTemplateRecord = {
    id: newId(),
    companyId: scope.companyId,
    connectionId,
    metaTemplateId: row.metaTemplateId,
    name: row.name,
    language: row.language,
    category: row.category,
    components: row.components,
    status: row.status,
    statusRaw: null,
    rejectedReason: null,
    lastSyncedAt: row.lastSyncedAt,
    createdById: row.createdById,
    createdAt: now(),
    deletedAt: null,
    mappingStatus: row.mappingStatus,
    enabled: row.enabled,
    variables: row.variables,
  }
  rows.set(record.id, record)
  return { record: { ...record }, inserted: true }
}

/** Como el adaptador: solo escribe si sigue viva y con los componentes leidos. */
function isUnchanged(rows: TemplateRows, id: string, expectedComponents: unknown, scope: IntegracionesScope): boolean {
  const row = rows.get(id)
  return row !== undefined && isLive(row, scope) && sameComponents(row.components, expectedComponents)
}

/** Mismo orden que el adaptador: borrados (no los creados desde `startedAt`), cambios, altas. */
function applySyncTo(
  rows: TemplateRows,
  newId: () => string,
  connectionId: string,
  plan: TemplateSyncPlan,
  startedAt: Date,
  at: Date,
  scope: IntegracionesScope,
): void {
  for (const id of plan.deletes) {
    const row = rows.get(id)
    if (row === undefined || !isLive(row, scope) || row.connectionId !== connectionId) continue
    if (row.createdAt.getTime() >= startedAt.getTime()) continue
    rows.set(id, { ...row, deletedAt: at, lastSyncedAt: at, enabled: false, variables: [] })
  }
  for (const update of plan.updates) {
    const row = rows.get(update.id)
    if (row === undefined || !ofScope(row, scope) || row.connectionId !== connectionId) continue
    if (!update.changed && !update.resetVariables) {
      rows.set(update.id, { ...row, lastSyncedAt: at })
      continue
    }
    const reset = update.resetVariables
      ? { mappingStatus: update.mappingStatusAfterReset, enabled: update.enabledAfterReset, variables: [] }
      : {}
    rows.set(update.id, { ...row, ...update.template, ...reset, deletedAt: null, lastSyncedAt: at })
  }
  for (const { template, mappingStatus, enabled } of plan.inserts) {
    const id = newId()
    rows.set(id, {
      id,
      companyId: scope.companyId,
      connectionId,
      ...template,
      lastSyncedAt: at,
      createdById: null,
      createdAt: at,
      deletedAt: null,
      mappingStatus,
      enabled,
      variables: [],
    })
  }
}

function applyWebhookUpdatesTo(
  rows: TemplateRows,
  connectionId: string,
  updates: readonly TemplateWebhookUpdate[],
  scope: IntegracionesScope,
): { unknown: number } {
  let unknown = 0
  for (const update of updates) {
    const row = [...rows.values()].find(
      (candidate) =>
        isLive(candidate, scope) &&
        candidate.connectionId === connectionId &&
        candidate.metaTemplateId === update.metaTemplateId,
    )
    if (row === undefined) {
      unknown += 1
      continue
    }
    rows.set(
      row.id,
      update.kind === 'status'
        ? { ...row, status: update.status, statusRaw: update.statusRaw, rejectedReason: update.rejectedReason }
        : { ...row, category: update.category },
    )
  }
  return { unknown }
}

/**
 * Repositorio de plantillas en memoria con las reglas del adaptador: ambito de empresa, unico de
 * vivas por nombre e idioma, la carrera del alta y lo creado desde `startedAt` no se borra.
 */
export function makeTemplateRepository(initial: WhatsappTemplateRecord[] = [], now: () => Date = () => NOW) {
  const rows: TemplateRows = new Map(initial.map((row) => [row.id, { ...row }]))
  const syncedAt = new Map<string, Date>()
  let counter = 0
  const newId = () => {
    counter += 1
    return `00000000-0000-4000-8000-${String(900000000000 + counter)}`
  }

  const listLive = vi.fn<WhatsappTemplateRepository['listLive']>(async (connectionId, filter, scope) =>
    [...rows.values()]
      .filter(
        (row) =>
          isLive(row, scope) && row.connectionId === connectionId && (!filter.onlyApproved || row.status === 'APPROVED'),
      )
      .sort(byNameLanguageId)
      .map((row) => ({ ...row })),
  )
  const findLiveById = vi.fn<WhatsappTemplateRepository['findLiveById']>(async (id, scope) => {
    const row = rows.get(id)
    return row === undefined || !isLive(row, scope) ? null : { ...row }
  })
  const findLiveByNameAndLanguage = vi.fn<WhatsappTemplateRepository['findLiveByNameAndLanguage']>(
    async (connectionId, name, language, scope) => {
      const row = [...rows.values()].find(
        (candidate) =>
          isLive(candidate, scope) &&
          candidate.connectionId === connectionId &&
          candidate.name === name &&
          candidate.language === language,
      )
      return row === undefined ? null : { ...row }
    },
  )
  const insertCreated = vi.fn<WhatsappTemplateRepository['insertCreated']>(async (row, connectionId, scope) =>
    insertCreatedInto(rows, newId, now, row, connectionId, scope),
  )
  const markDeleted = vi.fn<WhatsappTemplateRepository['markDeleted']>(async (id, at, scope) => {
    const row = rows.get(id)
    if (row === undefined || !isLive(row, scope)) return false
    rows.set(id, { ...row, deletedAt: at, enabled: false, variables: [] })
    return true
  })
  const replaceVariables = vi.fn<WhatsappTemplateRepository['replaceVariables']>(
    async (id, bindings, mapping, expectedComponents, scope) => {
      const row = rows.get(id)
      if (row === undefined || !isUnchanged(rows, id, expectedComponents, scope)) return false
      rows.set(id, { ...row, variables: [...bindings], mappingStatus: mapping.mappingStatus, enabled: mapping.enabled })
      return true
    },
  )
  const setEnabled = vi.fn<WhatsappTemplateRepository['setEnabled']>(async (id, enabled, expectedComponents, scope) => {
    const row = rows.get(id)
    if (row === undefined || !isUnchanged(rows, id, expectedComponents, scope)) return false
    rows.set(id, { ...row, enabled })
    return true
  })
  const listForSync = vi.fn<WhatsappTemplateRepository['listForSync']>(async (connectionId, scope) =>
    [...rows.values()].filter((row) => ofScope(row, scope) && row.connectionId === connectionId).map(toSyncRow),
  )
  const applySync = vi.fn<WhatsappTemplateRepository['applySync']>(
    async (connectionId, plan, startedAt, at, scope) => {
      applySyncTo(rows, newId, connectionId, plan, startedAt, at, scope)
      syncedAt.set(connectionId, at)
    },
  )
  const applyWebhookUpdates = vi.fn<WhatsappTemplateRepository['applyWebhookUpdates']>(
    async (connectionId, updates, scope) => applyWebhookUpdatesTo(rows, connectionId, updates, scope),
  )

  const templates: WhatsappTemplateRepository = {
    listLive,
    findLiveById,
    findLiveByNameAndLanguage,
    insertCreated,
    replaceVariables,
    setEnabled,
    markDeleted,
    listForSync,
    applySync,
    applyWebhookUpdates,
  }
  return {
    templates,
    listLive,
    findLiveById,
    findLiveByNameAndLanguage,
    insertCreated,
    replaceVariables,
    setEnabled,
    markDeleted,
    listForSync,
    applySync,
    applyWebhookUpdates,
    /** La hora que `applySync` anoto en la conexion. */
    syncedAtOf: (connectionId: string) => syncedAt.get(connectionId),
    row: (id: string) => {
      const row = rows.get(id)
      return row === undefined ? undefined : { ...row }
    },
    all: () => [...rows.values()].map((row) => ({ ...row })),
  }
}

/** Una variable propia guardada de la empresa por defecto. */
export function storedVariableKey(overrides: Partial<WhatsappVariableKeyRecord> = {}): WhatsappVariableKeyRecord {
  return {
    id: '00000000-0000-4000-8000-000000000201',
    companyId: COMPANY_ID,
    key: 'cuenta_numero',
    label: 'Numero de cuenta',
    value: '123-456',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  }
}

/**
 * Variables propias en memoria con las reglas del adaptador: ambito de empresa, clave unica por
 * empresa, orden por clave y el uso por plantillas vivas que da `usage`. Cambiar la clave o borrar
 * una en uso devuelve `in_use`.
 */
export function makeVariableKeyRepository(
  initial: WhatsappVariableKeyRecord[] = [],
  usage: (id: string) => number = () => 0,
  now: () => Date = () => NOW,
) {
  const rows = new Map(initial.map((row) => [row.id, { ...row }]))
  let counter = 0
  const newId = () => {
    counter += 1
    return `00000000-0000-4000-8000-${String(800000000000 + counter)}`
  }
  const ofCompany = (scope: IntegracionesScope) =>
    [...rows.values()].filter((row) => row.companyId === scope.companyId).sort((a, b) => a.key.localeCompare(b.key))
  const keyTaken = (key: string, exceptId: string | null, scope: IntegracionesScope) =>
    ofCompany(scope).some((row) => row.key === key && row.id !== exceptId)

  const listAll = vi.fn<WhatsappVariableKeyRepository['listAll']>(async (scope) => ofCompany(scope).map((row) => ({ ...row })))
  const listWithUsage = vi.fn<WhatsappVariableKeyRepository['listWithUsage']>(async (scope) =>
    ofCompany(scope).map((row) => ({ ...row, usedBy: usage(row.id) })),
  )
  const findByKeys = vi.fn<WhatsappVariableKeyRepository['findByKeys']>(async (keys, scope) =>
    ofCompany(scope)
      .filter((row) => keys.includes(row.key))
      .map((row) => ({ ...row })),
  )
  const create = vi.fn<WhatsappVariableKeyRepository['create']>(async (input, scope) => {
    if (keyTaken(input.key, null, scope)) throw new WhatsappVariableKeyTakenError('doble: otra con la misma clave')
    const record: WhatsappVariableKeyRecord = { id: newId(), companyId: scope.companyId, ...input, createdAt: now() }
    rows.set(record.id, record)
    return { ...record }
  })
  const update = vi.fn<WhatsappVariableKeyRepository['update']>(async (id, input, scope) => {
    const row = rows.get(id)
    if (row === undefined || row.companyId !== scope.companyId) return { kind: 'not_found' }
    if (row.key !== input.key && usage(id) > 0) return { kind: 'in_use' }
    if (keyTaken(input.key, id, scope)) throw new WhatsappVariableKeyTakenError('doble: otra con la misma clave')
    const record = { ...row, ...input }
    rows.set(id, record)
    return { kind: 'updated', record: { ...record } }
  })
  const remove = vi.fn<WhatsappVariableKeyRepository['delete']>(async (id, scope) => {
    const row = rows.get(id)
    if (row === undefined || row.companyId !== scope.companyId) return 'not_found'
    if (usage(id) > 0) return 'in_use'
    rows.delete(id)
    return 'deleted'
  })

  const variableKeys: WhatsappVariableKeyRepository = { listAll, listWithUsage, findByKeys, create, update, delete: remove }
  return {
    variableKeys,
    listAll,
    listWithUsage,
    findByKeys,
    create,
    update,
    delete: remove,
    row: (id: string) => {
      const row = rows.get(id)
      return row === undefined ? undefined : { ...row }
    },
    all: () => [...rows.values()].map((row) => ({ ...row })),
  }
}

export type OutboxContactRow = OutboundContact & {
  readonly companyId: string
  readonly connectionId: string
  readonly lastMessageAt: Date | null
}

export type OutboxMessageRow = OutboundMessageRecord & {
  readonly companyId: string
  readonly wamid: string | null
  readonly attempts: number
}

/** Un contacto de la conexion por defecto, vinculado a `CUSTOMER_ID` y con la ventana abierta. */
export function outboxContact(overrides: Partial<OutboxContactRow> = {}): OutboxContactRow {
  return {
    id: CONTACT_ID,
    companyId: COMPANY_ID,
    connectionId: CONNECTION_ID,
    waId: '573001234567',
    customerId: CUSTOMER_ID,
    customerLinkedBy: null,
    blockedAt: null,
    lastInboundAt: new Date(NOW.getTime() - 60 * 60 * 1000),
    lastMessageAt: null,
    ...overrides,
  }
}

export const FAILED_MESSAGE_ID = '00000000-0000-4000-8000-000000000301'

/** Un saliente fallido de texto, del actor, al contacto por defecto. */
export function outboxMessage(overrides: Partial<OutboxMessageRow> = {}): OutboxMessageRow {
  return {
    id: FAILED_MESSAGE_ID,
    companyId: COMPANY_ID,
    connectionId: CONNECTION_ID,
    contactId: CONTACT_ID,
    sentById: ACTOR_ID,
    type: 'TEXT',
    body: 'Hola, su pedido salio hoy',
    templateName: null,
    templateLanguage: null,
    payload: {},
    status: 'FAILED',
    direction: 'OUT',
    origin: 'USER',
    errorCode: '131026',
    errorReason: 'Meta no acepto el mensaje (codigo 131026). Intenta de nuevo o revisa la conexion.',
    createdAt: new Date('2026-10-08T12:00:00.000Z'),
    wamid: null,
    attempts: 1,
    ...overrides,
  }
}

/**
 * Contactos y mensajes salientes en memoria con las reglas del adaptador: ambito de empresa, la
 * conexion en las lecturas de contacto, `markSent`/`markFailed` solo desde `SENDING` y
 * `touchContact` que no retrocede.
 */
export function makeOutbox(
  initial: { contacts?: readonly OutboxContactRow[]; messages?: readonly OutboxMessageRow[] } = {},
  now: () => Date = () => NOW,
) {
  const contacts = new Map((initial.contacts ?? []).map((row) => [row.id, { ...row }]))
  const messages = new Map((initial.messages ?? []).map((row) => [row.id, { ...row }]))
  let counter = 0
  const newId = (prefix: number) => {
    counter += 1
    return `00000000-0000-4000-8000-${String(prefix + counter)}`
  }
  const toContact = (row: OutboxContactRow): OutboundContact => ({
    id: row.id,
    waId: row.waId,
    customerId: row.customerId,
    customerLinkedBy: row.customerLinkedBy,
    blockedAt: row.blockedAt,
    lastInboundAt: row.lastInboundAt,
  })
  const toRecord = (row: OutboxMessageRow): OutboundMessageRecord => ({
    id: row.id,
    connectionId: row.connectionId,
    contactId: row.contactId,
    sentById: row.sentById,
    type: row.type,
    body: row.body,
    templateName: row.templateName,
    templateLanguage: row.templateLanguage,
    payload: { ...row.payload },
    status: row.status,
    direction: row.direction,
    origin: row.origin,
    errorCode: row.errorCode,
    errorReason: row.errorReason,
    createdAt: row.createdAt,
  })
  const contactOf = (id: string, scope: IntegracionesScope) => {
    const row = contacts.get(id)
    return row !== undefined && row.companyId === scope.companyId ? row : undefined
  }
  const messageOf = (id: string, scope: IntegracionesScope) => {
    const row = messages.get(id)
    return row !== undefined && row.companyId === scope.companyId ? row : undefined
  }

  const findContact = vi.fn<WhatsappOutboxRepository['findContact']>(async (id, connectionId, scope) => {
    const row = contactOf(id, scope)
    return row === undefined || row.connectionId !== connectionId ? null : toContact(row)
  })
  const findContactsByWaIds = vi.fn<WhatsappOutboxRepository['findContactsByWaIds']>(async (connectionId, waIds, scope) =>
    [...contacts.values()]
      .filter((row) => row.companyId === scope.companyId && row.connectionId === connectionId && waIds.includes(row.waId))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(toContact),
  )
  const ensureContact = vi.fn<WhatsappOutboxRepository['ensureContact']>(async (connectionId, waId, scope) => {
    const existing = [...contacts.values()].find((row) => row.connectionId === connectionId && row.waId === waId)
    if (existing !== undefined) {
      if (existing.companyId !== scope.companyId) throw new Error('doble: el contacto es de otra empresa')
      return toContact(existing)
    }
    const row: OutboxContactRow = {
      id: newId(700000000000),
      companyId: scope.companyId,
      connectionId,
      waId,
      customerId: null,
      customerLinkedBy: null,
      blockedAt: null,
      lastInboundAt: null,
      lastMessageAt: null,
    }
    contacts.set(row.id, row)
    return toContact(row)
  })
  const linkContact = vi.fn<WhatsappOutboxRepository['linkContact']>(async (id, link, scope) => {
    const row = contactOf(id, scope)
    if (row !== undefined) contacts.set(id, { ...row, customerId: link.customerId, customerLinkedBy: link.linkedBy })
  })
  const insertSending = vi.fn<WhatsappOutboxRepository['insertSending']>(async (input, scope) => {
    const row: OutboxMessageRow = {
      ...input,
      payload: { ...input.payload },
      id: newId(600000000000),
      companyId: scope.companyId,
      status: 'SENDING',
      direction: 'OUT',
      origin: 'USER',
      errorCode: null,
      errorReason: null,
      createdAt: now(),
      wamid: null,
      attempts: 1,
    }
    messages.set(row.id, row)
    return toRecord(row)
  })
  const markSent = vi.fn<WhatsappOutboxRepository['markSent']>(async (id, wamid, scope) => {
    const row = messageOf(id, scope)
    if (row === undefined || row.status !== 'SENDING') return null
    const next: OutboxMessageRow = { ...row, status: 'SENT', wamid }
    messages.set(id, next)
    return toRecord(next)
  })
  const markFailed = vi.fn<WhatsappOutboxRepository['markFailed']>(async (id, errorCode, errorReason, scope) => {
    const row = messageOf(id, scope)
    if (row === undefined || row.status !== 'SENDING') return null
    const next: OutboxMessageRow = { ...row, status: 'FAILED', errorCode, errorReason }
    messages.set(id, next)
    return toRecord(next)
  })
  const findOutbound = vi.fn<WhatsappOutboxRepository['findOutbound']>(async (id, scope) => {
    const row = messageOf(id, scope)
    return row === undefined ? null : toRecord(row)
  })
  const touchContact = vi.fn<WhatsappOutboxRepository['touchContact']>(async (id, at, scope) => {
    const row = contactOf(id, scope)
    if (row === undefined) return
    if (row.lastMessageAt === null || row.lastMessageAt < at) contacts.set(id, { ...row, lastMessageAt: at })
  })

  const outbox: WhatsappOutboxRepository = {
    findContact,
    findContactsByWaIds,
    ensureContact,
    linkContact,
    insertSending,
    markSent,
    markFailed,
    findOutbound,
    touchContact,
  }
  return {
    outbox,
    findContact,
    findContactsByWaIds,
    ensureContact,
    linkContact,
    insertSending,
    markSent,
    markFailed,
    findOutbound,
    touchContact,
    contact: (id: string) => {
      const row = contacts.get(id)
      return row === undefined ? undefined : { ...row }
    },
    message: (id: string) => {
      const row = messages.get(id)
      return row === undefined ? undefined : { ...row }
    },
    allContacts: () => [...contacts.values()].map((row) => ({ ...row })),
    allMessages: () => [...messages.values()].map((row) => ({ ...row })),
  }
}

export type ConversationDoubleContact = ConversationContactRow & {
  readonly companyId: string
  readonly connectionId: string
  readonly lastReadAt: Date | null
}

export type ConversationDoubleMessage = ChatMessageRow & {
  readonly companyId: string
  readonly contactId: string
}

export function conversationContact(overrides: Partial<ConversationDoubleContact> = {}): ConversationDoubleContact {
  return {
    id: CONTACT_ID,
    companyId: COMPANY_ID,
    connectionId: CONNECTION_ID,
    waId: '5215512345678',
    customerId: CUSTOMER_ID,
    blockedAt: null,
    lastInboundAt: null,
    lastReadAt: null,
    ...overrides,
  }
}

export function conversationMessage(overrides: Partial<ConversationDoubleMessage> = {}): ConversationDoubleMessage {
  return {
    id: '00000000-0000-4000-8000-000000000401',
    companyId: COMPANY_ID,
    contactId: CONTACT_ID,
    direction: 'IN',
    type: 'TEXT',
    body: 'Hola',
    payload: {},
    status: 'RECEIVED',
    errorCode: null,
    errorReason: null,
    origin: null,
    sentById: null,
    templateName: null,
    at: new Date('2026-10-09T10:00:00.000Z'),
    ...overrides,
  }
}

const newestFirst = (a: ConversationDoubleMessage, b: ConversationDoubleMessage) =>
  b.at.getTime() - a.at.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)

/**
 * Conversaciones en memoria con las reglas del adaptador: ámbito de empresa, conexión, hora del
 * mensaje, orden `(hora, id)` y una marca de lectura que nunca retrocede.
 */
export function makeConversationRepository(
  initialContacts: readonly ConversationDoubleContact[] = [],
  initialMessages: readonly ConversationDoubleMessage[] = [],
) {
  const contacts = new Map(initialContacts.map((row) => [row.id, { ...row }]))
  const messages = initialMessages.map((row) => ({ ...row }))

  const contactOf = (id: string, connectionId: string, scope: IntegracionesScope) => {
    const row = contacts.get(id)
    return row !== undefined && row.companyId === scope.companyId && row.connectionId === connectionId ? row : null
  }
  const messagesOf = (contactId: string, scope: IntegracionesScope) =>
    messages.filter((row) => row.contactId === contactId && row.companyId === scope.companyId).sort(newestFirst)
  const unreadOf = (contact: ConversationDoubleContact, scope: IntegracionesScope) =>
    messagesOf(contact.id, scope).filter(
      (row) => row.direction === 'IN' && (contact.lastReadAt === null || row.at > contact.lastReadAt),
    ).length
  const contactRow = (row: ConversationDoubleContact): ConversationContactRow => ({
    id: row.id,
    waId: row.waId,
    customerId: row.customerId,
    blockedAt: row.blockedAt,
    lastInboundAt: row.lastInboundAt,
  })
  const conversationsOf = (connectionId: string, scope: IntegracionesScope) =>
    [...contacts.values()].filter(
      (row) =>
        row.companyId === scope.companyId &&
        row.connectionId === connectionId &&
        messagesOf(row.id, scope).length > 0,
    )

  const listLinkedCustomerIds = vi.fn<WhatsappConversationRepository['listLinkedCustomerIds']>(
    async (connectionId, scope) => [
      ...new Set(
        conversationsOf(connectionId, scope).flatMap((row) => (row.customerId === null ? [] : [row.customerId])),
      ),
    ],
  )
  const listPage = vi.fn<WhatsappConversationRepository['listPage']>(async (query, scope) => {
    const matching = conversationsOf(query.connectionId, scope)
      .filter((row) => row.customerId !== null && query.customerIds.includes(row.customerId))
      .filter((row) =>
        query.blocked === 'all' ? true : query.blocked === 'blocked' ? row.blockedAt !== null : row.blockedAt === null,
      )
      .filter((row) => {
        if (query.search === null) return true
        const byName = row.customerId !== null && query.search.nameMatchIds.includes(row.customerId)
        const byDigits = query.search.digits !== '' && row.waId.includes(query.search.digits)
        return byName || byDigits
      })
      .map((row): ConversationRow => {
        const last = messagesOf(row.id, scope)[0]
        return {
          ...contactRow(row),
          unreadCount: unreadOf(row, scope),
          lastMessage: {
            direction: last.direction,
            type: last.type,
            body: last.body,
            status: last.status,
            at: last.at,
          },
        }
      })
      .sort(
        (a, b) =>
          (b.lastMessage?.at.getTime() ?? 0) - (a.lastMessage?.at.getTime() ?? 0) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      )
    return { rows: matching.slice(query.offset, query.offset + query.limit), total: matching.length }
  })
  const findContact = vi.fn<WhatsappConversationRepository['findContact']>(async (id, connectionId, scope) => {
    const row = contactOf(id, connectionId, scope)
    return row === null ? null : contactRow(row)
  })
  const findLatestContactOfCustomer = vi.fn<WhatsappConversationRepository['findLatestContactOfCustomer']>(
    async (customerId, connectionId, scope) => {
      const latest = conversationsOf(connectionId, scope)
        .filter((row) => row.customerId === customerId)
        .sort((a, b) => newestFirst(messagesOf(a.id, scope)[0], messagesOf(b.id, scope)[0]))[0]
      return latest === undefined ? null : contactRow(latest)
    },
  )
  const listMessages = vi.fn<WhatsappConversationRepository['listMessages']>(
    async (contactId, connectionId, page, scope) => {
      if (contactOf(contactId, connectionId, scope) === null) return []
      const all = messagesOf(contactId, scope)
      let start = 0
      if (page.before !== null) {
        const index = all.findIndex((row) => row.id === page.before)
        if (index === -1) return 'cursor_not_found'
        start = index + 1
      }
      return all.slice(start, start + page.limit).map(
        (row): ChatMessageRow => ({
          id: row.id,
          direction: row.direction,
          type: row.type,
          body: row.body,
          payload: row.payload,
          status: row.status,
          errorCode: row.errorCode,
          errorReason: row.errorReason,
          origin: row.origin,
          sentById: row.sentById,
          templateName: row.templateName,
          at: row.at,
        }),
      )
    },
  )
  const countUnread = vi.fn<WhatsappConversationRepository['countUnread']>(async (contactId, scope) => {
    const row = contacts.get(contactId)
    return row === undefined || row.companyId !== scope.companyId ? 0 : unreadOf(row, scope)
  })
  const advanceLastRead = vi.fn<WhatsappConversationRepository['advanceLastRead']>(
    async (contactId, upToMessageId, scope) => {
      const row = contacts.get(contactId)
      if (row === undefined || row.companyId !== scope.companyId) return 'ok'
      const own = messagesOf(contactId, scope)
      const target = upToMessageId === null ? own[0] : own.find((message) => message.id === upToMessageId)
      if (target === undefined) return upToMessageId === null ? 'ok' : 'message_not_found'
      if (row.lastReadAt === null || target.at > row.lastReadAt) contacts.set(contactId, { ...row, lastReadAt: target.at })
      return 'ok'
    },
  )

  const conversations: WhatsappConversationRepository = {
    listLinkedCustomerIds,
    listPage,
    findContact,
    findLatestContactOfCustomer,
    listMessages,
    countUnread,
    advanceLastRead,
  }
  const spies = {
    listLinkedCustomerIds,
    listPage,
    findContact,
    findLatestContactOfCustomer,
    listMessages,
    countUnread,
    advanceLastRead,
  }
  return {
    conversations,
    ...spies,
    allSpies: () => Object.values(spies),
    contact: (id: string) => {
      const row = contacts.get(id)
      return row === undefined ? undefined : { ...row }
    },
  }
}

export function customerRef(overrides: Partial<CustomerRef> = {}): CustomerRef {
  return { id: CUSTOMER_ID, firstNames: 'Laura', lastNames: 'Gómez', isDeleted: false, ...overrides }
}

/** Catálogo de clientes por empresa. La búsqueda por nombre es un subcadena sin mayúsculas: basta aquí. */
export function makeCustomerCatalog(byCompany: Record<string, readonly CustomerRef[]> = { [COMPANY_ID]: [customerRef()] }) {
  const of = (companyId: string) => byCompany[companyId] ?? []
  const findRefsIncludingDeleted = vi.fn<CustomerCatalog['findRefsIncludingDeleted']>(async (ids, companyId) =>
    of(companyId).filter((ref) => ids.includes(ref.id)),
  )
  const findAliveRefById = vi.fn<CustomerCatalog['findAliveRefById']>(
    async (id, companyId) => of(companyId).find((ref) => ref.id === id && !ref.isDeleted) ?? null,
  )
  const searchRefs = vi.fn<CustomerCatalog['searchRefs']>(async () => ({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  }))
  const findAliveIdsMatchingName = vi.fn<CustomerCatalog['findAliveIdsMatchingName']>(async (search, ids, companyId) =>
    of(companyId)
      .filter(
        (ref) =>
          !ref.isDeleted &&
          ids.includes(ref.id) &&
          `${ref.firstNames} ${ref.lastNames}`.toLowerCase().includes(search.toLowerCase()),
      )
      .map((ref) => ref.id),
  )
  const customers: CustomerCatalog = { findRefsIncludingDeleted, findAliveRefById, searchRefs, findAliveIdsMatchingName }
  return { customers, findRefsIncludingDeleted, findAliveRefById, searchRefs, findAliveIdsMatchingName }
}

/** Directorio de personas de la empresa: `names` es id → nombre mostrable, incluidas las dadas de baja. */
export function makePeopleDirectory(names: Record<string, string> = {}) {
  const findRefsIncludingDeletedInCompany = vi.fn<PeopleDirectory['findRefsIncludingDeletedInCompany']>(
    async (companyId, ids) =>
      companyId !== COMPANY_ID
        ? []
        : ids.flatMap((id) =>
            names[id] === undefined
              ? []
              : [{ id, displayName: names[id], isActive: false, permissions: [], roleName: 'Administrador' }],
          ),
  )
  return { people: { findRefsIncludingDeletedInCompany }, findRefsIncludingDeletedInCompany }
}
