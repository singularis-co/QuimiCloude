import { describe, expect, it } from 'vitest'

import {
  toAiProviderConnectionView,
  type AiProviderConnectionRecord,
  type AiProviderEntry,
} from '@/lib/modules/integraciones/domain/ai-provider'

const API_KEY_ENC = 'v1:key-cifrada'

const ENTRY: AiProviderEntry = {
  code: 'GOOGLE',
  name: 'Gemini',
  recipeModel: 'modelo-receta',
  catalogModel: 'modelo-catalogo',
}

function record(overrides: Partial<AiProviderConnectionRecord> = {}): AiProviderConnectionRecord {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    companyId: '00000000-0000-4000-8000-0000000000aa',
    provider: 'GOOGLE',
    apiKeyEnc: API_KEY_ENC,
    status: 'ERROR',
    lastError: 'Error con tu proveedor: la key fue rechazada. Revísala y vuelve a probar.',
    lastErrorAt: new Date('2026-10-13T11:00:00.000Z'),
    lastCheckedAt: new Date('2026-10-13T10:00:00.000Z'),
    keyUpdatedAt: new Date('2026-10-12T09:00:00.000Z'),
    ...overrides,
  }
}

describe('toAiProviderConnectionView', () => {
  it('R8: la vista tiene exactamente los campos publicos, sin key, cifrado, id ni empresa', () => {
    expect(Object.keys(toAiProviderConnectionView(record(), ENTRY)).sort()).toEqual(
      [
        'catalogModel',
        'keyUpdatedAt',
        'lastCheckedAt',
        'lastError',
        'lastErrorAt',
        'provider',
        'providerName',
        'recipeModel',
        'status',
      ].sort(),
    )
  })

  it('R8: la vista serializada no contiene el valor cifrado ni ninguna clave apiKey*', () => {
    const json = JSON.stringify(toAiProviderConnectionView(record(), ENTRY))
    expect(json).not.toContain(API_KEY_ENC)
    expect(json).not.toMatch(/apiKey|Enc"|companyId/)
  })

  it('R8: un campo extra en la fila no aparece en la vista', () => {
    const conExtra = { ...record(), apiKey: 'sk-en-claro', futuro: 'x' } as AiProviderConnectionRecord
    const json = JSON.stringify(toAiProviderConnectionView(conExtra, ENTRY))
    expect(json).not.toContain('sk-en-claro')
    expect(json).not.toContain('futuro')
  })

  it('toma nombre y modelos del catalogo y pasa las fechas a ISO', () => {
    expect(toAiProviderConnectionView(record(), ENTRY)).toEqual({
      provider: 'GOOGLE',
      providerName: 'Gemini',
      recipeModel: 'modelo-receta',
      catalogModel: 'modelo-catalogo',
      status: 'ERROR',
      lastError: 'Error con tu proveedor: la key fue rechazada. Revísala y vuelve a probar.',
      lastErrorAt: '2026-10-13T11:00:00.000Z',
      lastCheckedAt: '2026-10-13T10:00:00.000Z',
      keyUpdatedAt: '2026-10-12T09:00:00.000Z',
    })
  })

  it('las fechas ausentes salen como null', () => {
    const view = toAiProviderConnectionView(
      record({ status: 'ACTIVE', lastError: null, lastErrorAt: null, lastCheckedAt: null }),
      ENTRY,
    )
    expect(view).toMatchObject({ status: 'ACTIVE', lastError: null, lastErrorAt: null, lastCheckedAt: null })
  })
})
