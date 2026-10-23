import { describe, expect, it } from 'vitest'

import {
  modelInUse,
  toAiProviderConnectionView,
  type AiProviderConnectionRecord,
  type AiProviderEntry,
} from '@/lib/modules/integraciones/domain/ai-provider'

const API_KEY_ENC = 'v1:key-cifrada'

const ENTRY: AiProviderEntry = {
  code: 'GOOGLE',
  name: 'Gemini',
  models: [
    { modelId: 'modelo-alto', isDefault: false },
    { modelId: 'modelo-recomendado', isDefault: true },
    { modelId: 'modelo-bajo', isDefault: false },
  ],
  defaultModel: 'modelo-recomendado',
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
    model: null,
    unavailableModel: null,
    ...overrides,
  }
}

describe('toAiProviderConnectionView', () => {
  it('R13: la vista tiene exactamente los campos publicos, sin key, cifrado, id ni empresa', () => {
    expect(Object.keys(toAiProviderConnectionView(record(), ENTRY)).sort()).toEqual(
      [
        'keyUpdatedAt',
        'lastCheckedAt',
        'lastError',
        'lastErrorAt',
        'modelInUse',
        'modelIsDefault',
        'modelOptions',
        'modelUnavailable',
        'provider',
        'providerName',
        'status',
      ].sort(),
    )
  })

  it('R13: la vista serializada no contiene el valor cifrado ni ninguna clave apiKey*', () => {
    const json = JSON.stringify(toAiProviderConnectionView(record(), ENTRY))
    expect(json).not.toContain(API_KEY_ENC)
    expect(json).not.toMatch(/apiKey|Enc"|companyId/)
  })

  it('R13: un campo extra en la fila o en una opcion no aparece en la vista', () => {
    const conExtra = { ...record(), apiKey: 'sk-en-claro', futuro: 'x' } as AiProviderConnectionRecord
    const entryConExtra = {
      ...ENTRY,
      models: ENTRY.models.map((option) => ({ ...option, secreto: 'y' })),
    } as AiProviderEntry
    const json = JSON.stringify(toAiProviderConnectionView(conExtra, entryConExtra))
    expect(json).not.toContain('sk-en-claro')
    expect(json).not.toContain('futuro')
    expect(json).not.toContain('secreto')
  })

  it('R17, R26, R27: sin eleccion, el modelo en uso es el predeterminado y las opciones van en el orden del catalogo', () => {
    expect(toAiProviderConnectionView(record(), ENTRY)).toEqual({
      provider: 'GOOGLE',
      providerName: 'Gemini',
      modelInUse: 'modelo-recomendado',
      modelIsDefault: true,
      modelUnavailable: false,
      modelOptions: [
        { modelId: 'modelo-alto', isDefault: false },
        { modelId: 'modelo-recomendado', isDefault: true },
        { modelId: 'modelo-bajo', isDefault: false },
      ],
      status: 'ERROR',
      lastError: 'Error con tu proveedor: la key fue rechazada. Revísala y vuelve a probar.',
      lastErrorAt: '2026-10-13T11:00:00.000Z',
      lastCheckedAt: '2026-10-13T10:00:00.000Z',
      keyUpdatedAt: '2026-10-12T09:00:00.000Z',
    })
  })

  it('R27: con eleccion, el modelo en uso es la eleccion y no es el predeterminado', () => {
    const view = toAiProviderConnectionView(record({ model: 'modelo-alto' }), ENTRY)
    expect(view).toMatchObject({ modelInUse: 'modelo-alto', modelIsDefault: false, modelUnavailable: false })
  })

  it('R28: si el modelo en uso es el marcado, la vista lo dice y las opciones no lo traen', () => {
    const view = toAiProviderConnectionView(record({ model: 'modelo-alto', unavailableModel: 'modelo-alto' }), ENTRY)
    expect(view.modelInUse).toBe('modelo-alto')
    expect(view.modelUnavailable).toBe(true)
    expect(view.modelOptions.map((option) => option.modelId)).toEqual(['modelo-recomendado', 'modelo-bajo'])
  })

  it('R28: el predeterminado marcado tambien sale como no disponible y fuera de las opciones', () => {
    const view = toAiProviderConnectionView(record({ unavailableModel: 'modelo-recomendado' }), ENTRY)
    expect(view).toMatchObject({ modelInUse: 'modelo-recomendado', modelIsDefault: true, modelUnavailable: true })
    expect(view.modelOptions.map((option) => option.modelId)).toEqual(['modelo-alto', 'modelo-bajo'])
  })

  it('R17: si el marcado ya no es el modelo en uso (cambio el predeterminado), la marca no aplica', () => {
    const view = toAiProviderConnectionView(record({ unavailableModel: 'modelo-bajo' }), ENTRY)
    expect(view.modelUnavailable).toBe(false)
    expect(view.modelInUse).toBe('modelo-recomendado')
  })

  it('las fechas ausentes salen como null', () => {
    const view = toAiProviderConnectionView(
      record({ status: 'ACTIVE', lastError: null, lastErrorAt: null, lastCheckedAt: null }),
      ENTRY,
    )
    expect(view).toMatchObject({ status: 'ACTIVE', lastError: null, lastErrorAt: null, lastCheckedAt: null })
  })
})

describe('modelInUse', () => {
  it('R17: sin eleccion devuelve el predeterminado leido de la entrada que recibe', () => {
    expect(modelInUse({ model: null }, ENTRY)).toBe('modelo-recomendado')
    expect(modelInUse({ model: null }, { ...ENTRY, defaultModel: 'modelo-bajo' })).toBe('modelo-bajo')
  })

  it('R16: con eleccion devuelve la eleccion', () => {
    expect(modelInUse({ model: 'modelo-bajo' }, ENTRY)).toBe('modelo-bajo')
  })

  it('una eleccion que no esta en el catalogo es un dato imposible y lanza', () => {
    expect(() => modelInUse({ model: 'otro' }, ENTRY)).toThrow(/no trae el modelo elegido otro/)
  })
})
