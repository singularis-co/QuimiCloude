// Dobles de los puertos de la conexion de WhatsApp para los tests de los casos de uso.
// El cifrador guarda el texto en claro FUERA del valor cifrado: asi un test puede afirmar que el
// valor que llega a la base no lo contiene, y que descifrar exige el mismo contexto que cifrar.

import { vi } from 'vitest'

import { phoneMatchesWaId } from '@/lib/modules/clientes'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'
import { SecretUnreadableError } from '@/lib/modules/integraciones/domain/errors'
import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'
import type { SecretContext } from '@/lib/modules/integraciones/domain/secret-context'
import type { WhatsappConnectionRecord } from '@/lib/modules/integraciones/domain/whatsapp-connection'
import type { ContactLink } from '@/lib/modules/integraciones/domain/whatsapp-contact-link'
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

export function makeGraph(result: GraphProbeResult = GOOD_PROBE) {
  const fetchPhoneNumber = vi.fn<WhatsappGraphClient['fetchPhoneNumber']>(async () => result)
  const graph: WhatsappGraphClient = { fetchPhoneNumber }
  return { graph, fetchPhoneNumber }
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
  } = {},
) {
  const addWaId = vi.fn<CustomerPhoneLinks['addWaId']>(async () => results.add ?? { numbers: [] })
  const removeWaId = vi.fn<CustomerPhoneLinks['removeWaId']>(async () => results.remove ?? { numbers: [] })
  const customerPhones: CustomerPhoneLinks = { addWaId, removeWaId }
  return { customerPhones, addWaId, removeWaId }
}

/** Unidad de trabajo sin base: corre el trabajo con los puertos dados y cuenta las aperturas. */
export function makeContactUnitOfWork(scope: WhatsappContactTransactionScope) {
  const run = vi.fn((work: (s: WhatsappContactTransactionScope) => Promise<unknown>) => work(scope))
  const unitOfWork: WhatsappContactUnitOfWork = {
    run: <T,>(work: (s: WhatsappContactTransactionScope) => Promise<T>) => run(work) as Promise<T>,
  }
  return { unitOfWork, run }
}
