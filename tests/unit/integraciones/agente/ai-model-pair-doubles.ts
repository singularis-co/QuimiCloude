// Dobles de los pares de modelos de la plataforma (QT-304) para los tests de sus casos de uso.

import { vi } from 'vitest'

import type { PlatformActor } from '@/lib/modules/identity'
import type { AiModelPair, AiModelPairChoice, AiModelRole } from '@/lib/modules/integraciones/domain/ai-model-pair'
import type { AiProviderCode } from '@/lib/modules/integraciones/domain/ai-provider'
import type { AiModelPairRepository } from '@/lib/modules/integraciones/ports/ai-model-pair-repository'

export const MAESTRO_ID = '00000000-0000-4000-8000-0000000000dd'
export const SEEDED_AT = new Date('2026-10-31T12:00:00.000Z')
export const SAVED_AT = new Date('2026-11-01T09:30:00.000Z')

/** El Maestro no tiene empresa: el `PlatformActor` no la lleva. */
export function maestro(permissions: readonly string[] = ['modelos_ia.consultar', 'modelos_ia.modificar']): PlatformActor {
  return { id: MAESTRO_ID, permissions }
}

export function pair(
  provider: AiProviderCode,
  role: AiModelRole,
  primaryModelId: string,
  fallbackModelId: string,
): AiModelPair {
  return { provider, role, primaryModelId, fallbackModelId, updatedBy: null, updatedAt: SEEDED_AT }
}

/** Repositorio en memoria con la clave `(provider, role)`; `save` reemplaza y pone autor y hora. */
export function makePairs(initial: readonly AiModelPair[] = []) {
  const rows = new Map(initial.map((row) => [`${row.provider}:${row.role}`, { ...row }]))
  const list = vi.fn(async () => [...rows.values()].map((row) => ({ ...row })))
  const get = vi.fn(async (provider: AiProviderCode, role: AiModelRole) => {
    const row = rows.get(`${provider}:${role}`)
    return row === undefined ? null : { ...row }
  })
  const save = vi.fn(async (choice: AiModelPairChoice, actorId: string) => {
    const row: AiModelPair = { ...choice, updatedBy: actorId, updatedAt: SAVED_AT }
    rows.set(`${choice.provider}:${choice.role}`, row)
    return { ...row }
  })
  const pairs: AiModelPairRepository = { list, get, save }
  return { pairs, list, get, save, rows: () => [...rows.values()].map((row) => ({ ...row })) }
}
