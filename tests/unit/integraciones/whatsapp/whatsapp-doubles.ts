// Dobles de los puertos de la conexion de WhatsApp para los tests de los casos de uso.
// El cifrador guarda el texto en claro FUERA del valor cifrado: asi un test puede afirmar que el
// valor que llega a la base no lo contiene, y que descifrar exige el mismo contexto que cifrar.

import { vi } from 'vitest'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'
import { SecretUnreadableError, WhatsappTemplateNameTakenError } from '@/lib/modules/integraciones/domain/errors'
import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'
import type { SecretContext } from '@/lib/modules/integraciones/domain/secret-context'
import type { TemplateSyncPlan } from '@/lib/modules/integraciones/domain/template-sync-plan'
import type { WhatsappConnectionRecord } from '@/lib/modules/integraciones/domain/whatsapp-connection'
import type {
  TemplateWebhookUpdate,
  WhatsappTemplateRecord,
} from '@/lib/modules/integraciones/domain/whatsapp-template'
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
  NewCreatedTemplateRow,
  TemplateSyncRow,
  WhatsappTemplateRepository,
} from '@/lib/modules/integraciones/ports/whatsapp-template-repository'
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
  const graph: WhatsappGraphClient = { fetchPhoneNumber, createTemplate, listTemplatesPage, deleteTemplate }
  return { graph, fetchPhoneNumber, createTemplate, listTemplatesPage, deleteTemplate }
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
    ...overrides,
  }
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
): WhatsappTemplateRecord {
  const existing = [...rows.values()].find(
    (candidate) => candidate.connectionId === connectionId && candidate.metaTemplateId === row.metaTemplateId,
  )
  if (existing !== undefined) {
    if (!ofScope(existing, scope)) throw new Error('doble: la conexion no es de la empresa del ambito')
    const kept = { ...existing, createdById: existing.createdById ?? row.createdById }
    rows.set(kept.id, kept)
    return { ...kept }
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
  }
  rows.set(record.id, record)
  return { ...record }
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
    rows.set(id, { ...row, deletedAt: at, lastSyncedAt: at })
  }
  for (const { id, template, changed } of plan.updates) {
    const row = rows.get(id)
    if (row === undefined || !ofScope(row, scope) || row.connectionId !== connectionId) continue
    rows.set(id, changed ? { ...row, ...template, deletedAt: null, lastSyncedAt: at } : { ...row, lastSyncedAt: at })
  }
  for (const template of plan.inserts) {
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
    rows.set(id, { ...row, deletedAt: at })
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
