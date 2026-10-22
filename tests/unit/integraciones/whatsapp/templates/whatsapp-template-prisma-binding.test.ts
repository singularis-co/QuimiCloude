// Lectura de una fila de `whatsapp_template_variables` a su relacion, sin base. Que el CHECK
// `one_target` impida la fila sin destino lo prueba `whatsapp-variable-keys-migration.int.test.ts`.
import { describe, expect, it } from 'vitest'

import { toBinding } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-template-prisma'

const TEMPLATE_ID = '35233d07-2df9-4818-9c61-70a9873b286e'
const KEY_ID = '6f1c2a90-1d1e-4c3b-9a55-0b7d2f3e4a11'

describe('toBinding: cada fila de relacion apunta a una constante o a una variable propia', () => {
  it('R93 — una fila con constante es una relacion de sistema', () => {
    expect(toBinding({ templateId: TEMPLATE_ID, slot: 'body.1', variableKeyId: null, systemKey: 'cliente.nombre' })).toEqual({
      slot: 'body.1',
      kind: 'system',
      systemKey: 'cliente.nombre',
    })
  })

  it('R93 — una fila con variable propia es una relacion de empresa', () => {
    expect(toBinding({ templateId: TEMPLATE_ID, slot: 'header', variableKeyId: KEY_ID, systemKey: null })).toEqual({
      slot: 'header',
      kind: 'company',
      variableKeyId: KEY_ID,
    })
  })

  it('R93 — una fila sin destino (imposible por el CHECK) lanza en vez de inventar una clave vacia', () => {
    expect(() => toBinding({ templateId: TEMPLATE_ID, slot: 'body.2', variableKeyId: null, systemKey: null })).toThrow(
      /body\.2.*sin destino|no tiene destino/,
    )
  })
})
