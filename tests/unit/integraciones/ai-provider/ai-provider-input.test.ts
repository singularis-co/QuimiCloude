import { describe, expect, it } from 'vitest'

import { aiProviderKeyInputSchema } from '@/lib/modules/integraciones/domain/ai-provider-input'

describe('aiProviderKeyInputSchema', () => {
  it('R18: acepta los cuatro proveedores del catalogo y recorta la key', () => {
    for (const provider of ['ANTHROPIC', 'GOOGLE', 'OPENAI', 'OPENROUTER']) {
      expect(aiProviderKeyInputSchema.parse({ provider, apiKey: '  sk-1  ' })).toEqual({
        provider,
        apiKey: 'sk-1',
      })
    }
  })

  it('R18: rechaza un proveedor fuera del catalogo, en minusculas o ausente', () => {
    for (const provider of ['MISTRAL', 'anthropic', '', undefined, null, 1]) {
      expect(aiProviderKeyInputSchema.safeParse({ provider, apiKey: 'sk-1' }).success, String(provider)).toBe(false)
    }
  })

  it('R18: rechaza una key vacia o en blanco tras recortar', () => {
    for (const apiKey of ['', '   ', '\n\t', undefined, null]) {
      expect(aiProviderKeyInputSchema.safeParse({ provider: 'OPENAI', apiKey }).success).toBe(false)
    }
  })

  it('R18: admite 1024 caracteres y rechaza 1025', () => {
    expect(aiProviderKeyInputSchema.safeParse({ provider: 'OPENAI', apiKey: 'k'.repeat(1024) }).success).toBe(
      true,
    )
    expect(aiProviderKeyInputSchema.safeParse({ provider: 'OPENAI', apiKey: 'k'.repeat(1025) }).success).toBe(
      false,
    )
  })
})
