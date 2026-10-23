// Dobles de los puertos de la conexion del proveedor IA para los tests de los casos de uso.
// El cifrador guarda el texto en claro FUERA del valor cifrado: asi un test puede afirmar que el
// valor que llega a la base no contiene la key, y que descifrar exige el mismo contexto que cifrar.

import { vi } from 'vitest'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'
import type {
  AiProviderCode,
  AiProviderConnectionRecord,
  AiProviderEntry,
} from '@/lib/modules/integraciones/domain/ai-provider'
import type {
  AiProviderFailureKind,
  AiProviderProbeResult,
} from '@/lib/modules/integraciones/domain/ai-provider-failure'
import { SecretUnreadableError } from '@/lib/modules/integraciones/domain/errors'
import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'
import type { SecretContext } from '@/lib/modules/integraciones/domain/secret-context'
import type { AiProviderCatalog } from '@/lib/modules/integraciones/ports/ai-provider-catalog'
import type {
  AiProviderConnectionPatch,
  AiProviderConnectionRepository,
  NewAiProviderConnectionRow,
} from '@/lib/modules/integraciones/ports/ai-provider-connection-repository'
import type { AiProviderProbe } from '@/lib/modules/integraciones/ports/ai-provider-probe'
import type { RandomSource } from '@/lib/modules/integraciones/ports/random-source'
import type { SecretCipher } from '@/lib/modules/integraciones/ports/secret-cipher'

export const COMPANY_ID = '00000000-0000-4000-8000-0000000000aa'
export const OTHER_COMPANY_ID = '00000000-0000-4000-8000-0000000000bb'
export const CONNECTION_ID = '00000000-0000-4000-8000-000000000001'
export const NEW_CONNECTION_ID = '00000000-0000-4000-8000-000000000002'
export const ACTOR_ID = '00000000-0000-4000-8000-0000000000cc'
export const NOW = new Date('2026-10-13T12:00:00.000Z')
export const EARLIER = new Date('2026-10-01T00:00:00.000Z')

export const API_KEY = 'sk-key-en-claro-de-la-empresa'
export const OLD_API_KEY = 'sk-key-anterior'

/** Tres modelos por proveedor: el predeterminado va en medio para que no coincida con el primero. */
function entry(code: AiProviderCode, name: string, suffix: string): AiProviderEntry {
  return {
    code,
    name,
    models: [
      { modelId: `modelo-alto-${suffix}`, isDefault: false },
      { modelId: `modelo-recomendado-${suffix}`, isDefault: true },
      { modelId: `modelo-bajo-${suffix}`, isDefault: false },
    ],
    defaultModel: `modelo-recomendado-${suffix}`,
  }
}

export const CATALOG: readonly AiProviderEntry[] = [
  entry('ANTHROPIC', 'Claude', 'a'),
  entry('GOOGLE', 'Gemini', 'g'),
  entry('OPENAI', 'OpenAI', 'o'),
  entry('OPENROUTER', 'OpenRouter', 'r'),
]

export const GOOD_PROBE: AiProviderProbeResult = { ok: true, elapsedMs: 1234 }
export const REJECTED_PROBE: AiProviderProbeResult = {
  ok: false,
  failure: { kind: 'rejected_key', httpStatus: 401, model: null },
}

export function admin(overrides: Partial<Actor> = {}): Actor {
  return { id: ACTOR_ID, companyId: COMPANY_ID, permissions: ['integraciones.modificar'], ...overrides }
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
  function seed(plaintext: string, context: SecretContext): string {
    counter += 1
    const stored = `v1:sembrado-${counter}`
    vault.set(stored, { plaintext, context })
    return stored
  }
  const cipher: SecretCipher = { encrypt, decrypt }
  return { cipher, encrypt, decrypt, seed, plaintextOf: (stored: string) => vault.get(stored)?.plaintext }
}

/** Catalogo en memoria; `entries` es mutable para que un test cambie un modelo entre dos llamadas. */
export function makeCatalog(entries: AiProviderEntry[] = [...CATALOG]) {
  const list = vi.fn(async () => [...entries])
  const get = vi.fn(async (code: AiProviderCode) => entries.find((entry) => entry.code === code) ?? null)
  const catalog: AiProviderCatalog = { list, get }
  return { catalog, list, get, entries }
}

/** Un fallo de la sonda por cada tipo; el de modelo no disponible nombra el modelo dado. */
export function failedProbe(kind: AiProviderFailureKind, model = 'modelo-alto-g'): AiProviderProbeResult {
  const httpStatus = { rejected_key: 401, quota: 429, model_unavailable: 404, unreachable: null, unexpected: 500 }[kind]
  return kind === 'model_unavailable'
    ? { ok: false, failure: { kind, httpStatus, model } }
    : { ok: false, failure: { kind, httpStatus, model: null } }
}

export function makeProbe(result: AiProviderProbeResult = GOOD_PROBE) {
  const probe = vi.fn<AiProviderProbe['probe']>(async () => result)
  return { probe: { probe } satisfies AiProviderProbe, call: probe }
}

export function makeRandom(): RandomSource & { newId: ReturnType<typeof vi.fn> } {
  return { newId: vi.fn(() => NEW_CONNECTION_ID), newVerifyToken: vi.fn(() => 'no-se-usa') }
}

/** Repositorio en memoria que respeta el ambito: una fila de otra empresa no se ve. */
export function makeRepository(initial: AiProviderConnectionRecord[] = []) {
  const rows = new Map(initial.map((row) => [row.id, { ...row }]))
  const visible = (row: AiProviderConnectionRecord, scope: IntegracionesScope) => row.companyId === scope.companyId

  const find = vi.fn(async (scope: IntegracionesScope) => {
    const row = [...rows.values()].find((candidate) => visible(candidate, scope))
    return row === undefined ? null : { ...row }
  })
  const create = vi.fn(async (row: NewAiProviderConnectionRow, scope: IntegracionesScope) => {
    const record: AiProviderConnectionRecord = {
      id: row.id,
      companyId: scope.companyId,
      provider: row.provider,
      apiKeyEnc: row.apiKeyEnc,
      status: row.status,
      lastError: row.lastError,
      lastErrorAt: row.lastErrorAt,
      lastCheckedAt: row.lastCheckedAt,
      keyUpdatedAt: row.keyUpdatedAt,
      model: row.model ?? null,
      unavailableModel: row.unavailableModel ?? null,
    }
    rows.set(record.id, { ...record })
    return record
  })
  const update = vi.fn(async (id: string, patch: AiProviderConnectionPatch, scope: IntegracionesScope) => {
    const row = rows.get(id)
    if (row === undefined || !visible(row, scope)) return null
    const next: AiProviderConnectionRecord = { ...row, ...stripUndefined(patch) }
    rows.set(id, next)
    return { ...next }
  })
  const remove = vi.fn(async (scope: IntegracionesScope) => {
    for (const [id, row] of rows) if (visible(row, scope)) rows.delete(id)
  })

  const connections: AiProviderConnectionRepository = { find, create, update, delete: remove }
  return {
    connections,
    find,
    create,
    update,
    remove,
    rows: () => [...rows.values()].map((row) => ({ ...row })),
    /** Mete una fila sin pasar por el puerto: la que otro guardado escribio a la vez. */
    insert: (record: AiProviderConnectionRecord) => {
      rows.set(record.id, { ...record })
    },
    row: (id: string) => {
      const row = rows.get(id)
      return row === undefined ? undefined : { ...row }
    },
  }
}

function stripUndefined(patch: AiProviderConnectionPatch): Partial<AiProviderConnectionRecord> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
}

/** Una conexion guardada con su key cifrada en su contexto real. */
export function storedConnection(
  seed: (plaintext: string, context: SecretContext) => string,
  overrides: Partial<AiProviderConnectionRecord> = {},
): AiProviderConnectionRecord {
  const id = overrides.id ?? CONNECTION_ID
  const companyId = overrides.companyId ?? COMPANY_ID
  return {
    id,
    companyId,
    provider: 'GOOGLE',
    apiKeyEnc: seed(OLD_API_KEY, { companyId, recordId: id, field: 'api_key' }),
    status: 'ACTIVE',
    lastError: null,
    lastErrorAt: null,
    lastCheckedAt: EARLIER,
    keyUpdatedAt: EARLIER,
    model: null,
    unavailableModel: null,
    ...overrides,
  }
}
