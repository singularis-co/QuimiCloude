import { describe, expect, it } from 'vitest'

import { WhatsappTemplateNotSendableError } from '@/lib/modules/integraciones/domain/errors'
import type { WhatsappTemplateRecord } from '@/lib/modules/integraciones/domain/whatsapp-template'
import {
  buildTemplateMessage,
  isSendable,
  type OwnVariableValue,
} from '@/lib/modules/integraciones/domain/whatsapp-template-message'
import type { TemplateVariableBinding } from '@/lib/modules/integraciones/domain/whatsapp-template-variables'

const ACCOUNT_KEY_ID = '00000000-0000-4000-8000-0000000000f1'
const PROMO_KEY_ID = '00000000-0000-4000-8000-0000000000f2'

const FULL_COMPONENTS = [
  { type: 'HEADER', format: 'TEXT', text: 'Hola {{1}}' },
  { type: 'BODY', text: 'Estimado {{1}}, su cuenta {{2}} vence el {{3}}. Gracias {{1}}.' },
  { type: 'FOOTER', text: 'Equipo de cobranza' },
  {
    type: 'BUTTONS',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Listo' },
      { type: 'URL', text: 'Pagar', url: 'https://pagos.example.com/{{1}}' },
    ],
  },
]

const FULL_BINDINGS: TemplateVariableBinding[] = [
  { slot: 'header', kind: 'system', systemKey: 'cliente.nombre' },
  { slot: 'body.1', kind: 'system', systemKey: 'cliente.nombre' },
  { slot: 'body.2', kind: 'company', variableKeyId: ACCOUNT_KEY_ID },
  { slot: 'body.3', kind: 'system', systemKey: 'cuenta.vencimiento' },
  { slot: 'button.1', kind: 'company', variableKeyId: PROMO_KEY_ID },
]

function template(overrides: Partial<WhatsappTemplateRecord> = {}): WhatsappTemplateRecord {
  return {
    id: '00000000-0000-4000-8000-0000000000a1',
    companyId: '00000000-0000-4000-8000-0000000000aa',
    connectionId: '00000000-0000-4000-8000-000000000001',
    metaTemplateId: '1234567890',
    name: 'aviso_vencimiento',
    language: 'es_MX',
    category: 'UTILITY',
    components: FULL_COMPONENTS,
    status: 'APPROVED',
    statusRaw: null,
    rejectedReason: null,
    lastSyncedAt: null,
    createdById: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    deletedAt: null,
    mappingStatus: 'MAPPED',
    enabled: true,
    variables: FULL_BINDINGS,
    ...overrides,
  }
}

const OWN_VALUES = new Map<string, OwnVariableValue>([
  [ACCOUNT_KEY_ID, { key: 'cuenta_numero', value: 'C-0042' }],
  [PROMO_KEY_ID, { key: 'codigo_pago', value: 'abc123' }],
])

const CONSTANTS = { 'cliente.nombre': 'Ana', 'cuenta.vencimiento': '30/10' }
const LABELS = { 'cliente.nombre': 'Nombre del cliente', 'cuenta.vencimiento': 'Fecha de vencimiento' }

function built(result: ReturnType<typeof buildTemplateMessage>) {
  if (!result.ok) throw new Error(`se esperaba un mensaje y faltan ${JSON.stringify(result.missing)}`)
  return result.message
}

describe('buildTemplateMessage', () => {
  it('R21: arma header, body en el orden de n y el botón URL con su índice', () => {
    const message = built(buildTemplateMessage(template(), OWN_VALUES, CONSTANTS, LABELS))
    expect(message.name).toBe('aviso_vencimiento')
    expect(message.language).toBe('es_MX')
    expect(message.components).toEqual([
      { type: 'header', parameters: [{ type: 'text', text: 'Ana' }] },
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Ana' },
          { type: 'text', text: 'C-0042' },
          { type: 'text', text: '30/10' },
        ],
      },
      { type: 'button', sub_type: 'url', index: '1', parameters: [{ type: 'text', text: 'abc123' }] },
    ])
  })

  it('R21: un hueco repetido en el body da un solo parámetro', () => {
    const message = built(buildTemplateMessage(template(), OWN_VALUES, CONSTANTS, LABELS))
    const body = message.components.find((c) => (c as { type: string }).type === 'body') as {
      parameters: unknown[]
    }
    expect(body.parameters).toHaveLength(3)
  })

  it('R21: una plantilla sin huecos no lleva componentes', () => {
    const plain = template({ components: [{ type: 'BODY', text: 'Gracias por su compra.' }], variables: [] })
    const message = built(buildTemplateMessage(plain, new Map(), {}, {}))
    expect(message.components).toEqual([])
    expect(message.body).toBe('Gracias por su compra.')
    expect(message.values).toEqual({})
  })

  it('R22: la variable propia usa su valor guardado e ignora el que manda el front', () => {
    const constants = { ...CONSTANTS, cuenta_numero: 'DEL-FRONT', codigo_pago: 'DEL-FRONT' }
    const message = built(buildTemplateMessage(template(), OWN_VALUES, constants, LABELS))
    expect(JSON.stringify(message.components)).not.toContain('DEL-FRONT')
    expect(message.body).not.toContain('DEL-FRONT')
    expect(message.values).toMatchObject({ cuenta_numero: 'C-0042', codigo_pago: 'abc123' })
  })

  it('R23: la constante usa el valor del front tal cual, sin recortar', () => {
    const constants = { ...CONSTANTS, 'cliente.nombre': ' Ana María ' }
    const message = built(buildTemplateMessage(template(), OWN_VALUES, constants, LABELS))
    expect(message.components[0]).toEqual({ type: 'header', parameters: [{ type: 'text', text: ' Ana María ' }] })
    expect(message.values['cliente.nombre']).toBe(' Ana María ')
  })

  it('R24: una constante que falta se devuelve con su clave y su etiqueta', () => {
    const result = buildTemplateMessage(template(), OWN_VALUES, { 'cliente.nombre': 'Ana' }, LABELS)
    expect(result).toEqual({ ok: false, missing: [{ key: 'cuenta.vencimiento', label: 'Fecha de vencimiento' }] })
  })

  it('R24: sin etiqueta del front la faltante se nombra con su clave', () => {
    const result = buildTemplateMessage(template(), OWN_VALUES, {}, { 'cliente.nombre': '  ' })
    expect(result).toEqual({
      ok: false,
      missing: [
        { key: 'cliente.nombre', label: 'cliente.nombre' },
        { key: 'cuenta.vencimiento', label: 'cuenta.vencimiento' },
      ],
    })
  })

  it('R24: una constante vacía o con solo espacios cuenta como faltante', () => {
    const result = buildTemplateMessage(
      template(),
      OWN_VALUES,
      { 'cliente.nombre': '', 'cuenta.vencimiento': ' \n ' },
      LABELS,
    )
    expect(result).toEqual({
      ok: false,
      missing: [
        { key: 'cliente.nombre', label: 'Nombre del cliente' },
        { key: 'cuenta.vencimiento', label: 'Fecha de vencimiento' },
      ],
    })
  })

  it('R24: una clave usada en varios huecos se nombra una sola vez, en el orden de hueco', () => {
    const result = buildTemplateMessage(template(), OWN_VALUES, {}, LABELS)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.missing.map((m) => m.key)).toEqual(['cliente.nombre', 'cuenta.vencimiento'])
  })

  it('R25: el texto final une header, body y footer con una línea en blanco, sin botones', () => {
    const message = built(buildTemplateMessage(template(), OWN_VALUES, CONSTANTS, LABELS))
    expect(message.body).toBe(
      'Hola Ana\n\nEstimado Ana, su cuenta C-0042 vence el 30/10. Gracias Ana.\n\nEquipo de cobranza',
    )
  })

  it('R25: un valor con $& o $1 queda literal en el texto final', () => {
    const constants = { 'cliente.nombre': '$& y $1', 'cuenta.vencimiento': "$'" }
    const message = built(buildTemplateMessage(template(), OWN_VALUES, constants, LABELS))
    expect(message.body).toBe(
      "Hola $& y $1\n\nEstimado $& y $1, su cuenta C-0042 vence el $'. Gracias $& y $1.\n\nEquipo de cobranza",
    )
  })

  it('R28: values guarda el valor usado por clave, constantes con punto y propias por su clave', () => {
    const message = built(buildTemplateMessage(template(), OWN_VALUES, { ...CONSTANTS, 'otra.clave': 'x' }, LABELS))
    expect(message.values).toEqual({
      'cliente.nombre': 'Ana',
      cuenta_numero: 'C-0042',
      'cuenta.vencimiento': '30/10',
      codigo_pago: 'abc123',
    })
  })

  it('R20: un hueco sin relación no se envía y responde no enviable', () => {
    const unbound = template({ variables: FULL_BINDINGS.filter((b) => b.slot !== 'body.3') })
    expect(() => buildTemplateMessage(unbound, OWN_VALUES, CONSTANTS, LABELS)).toThrow(
      WhatsappTemplateNotSendableError,
    )
  })

  it('R20: una propia relacionada que ya no existe responde no enviable', () => {
    const own = new Map([...OWN_VALUES].filter(([id]) => id !== PROMO_KEY_ID))
    expect(() => buildTemplateMessage(template(), own, CONSTANTS, LABELS)).toThrow(WhatsappTemplateNotSendableError)
  })

  it('R20: un contenido no relacionable responde no enviable', () => {
    const named = template({ components: [{ type: 'BODY', text: 'Hola {{first_name}}' }], variables: [] })
    expect(() => buildTemplateMessage(named, new Map(), {}, {})).toThrow(WhatsappTemplateNotSendableError)
    const unknown = template({ components: [{ type: 'CAROUSEL' }], variables: [] })
    expect(() => buildTemplateMessage(unknown, new Map(), {}, {})).toThrow(WhatsappTemplateNotSendableError)
  })
})

describe('isSendable', () => {
  it('R20: habilitada, relacionada y aprobada es enviable', () => {
    expect(isSendable(template())).toBe(true)
  })

  it.each([
    ['deshabilitada', { enabled: false }],
    ['sin relacionar', { mappingStatus: 'UNMAPPED' as const }],
    ['pendiente en Meta', { status: 'PENDING' as const }],
    ['pausada en Meta', { status: 'PAUSED' as const }],
    ['con estado desconocido', { status: 'OTHER' as const }],
    ['eliminada', { deletedAt: new Date('2026-10-02T00:00:00.000Z') }],
  ])('R20: %s no es enviable', (_name, overrides) => {
    expect(isSendable(template(overrides))).toBe(false)
  })
})
