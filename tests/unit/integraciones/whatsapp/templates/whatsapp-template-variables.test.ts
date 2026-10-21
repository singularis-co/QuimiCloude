import { describe, expect, it } from 'vitest'

import { contentOf } from '@/lib/modules/integraciones/domain/whatsapp-template-components'
import type { WhatsappTemplateContent } from '@/lib/modules/integraciones/domain/whatsapp-template-draft'
import {
  componentsChanged,
  mappingStatusOf,
  showKeys,
  variableSlotsOf,
  type TemplateSlot,
  type TemplateVariableBinding,
} from '@/lib/modules/integraciones/domain/whatsapp-template-variables'

function content(overrides: Partial<WhatsappTemplateContent> = {}): WhatsappTemplateContent {
  return { header: null, body: { text: 'Hola', examples: [] }, footer: null, buttons: [], ...overrides }
}

const system = (slot: TemplateSlot, systemKey: string): TemplateVariableBinding => ({ slot, kind: 'system', systemKey })
const company = (slot: TemplateSlot, variableKeyId: string): TemplateVariableBinding => ({
  slot,
  kind: 'company',
  variableKeyId,
})

const conVariables = [
  { type: 'HEADER', format: 'TEXT', text: 'Hola {{1}}', example: { header_text: ['Ana'] } },
  { type: 'BODY', text: 'Tu pedido {{1}} de {{2}}', example: { body_text: [['42', 'Ana']] } },
  {
    type: 'BUTTONS',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Ok' },
      { type: 'PHONE_NUMBER', text: 'Llamar', phone_number: '+573001112233' },
      { type: 'URL', text: 'Ver', url: 'https://x.co/p/{{1}}', example: ['https://x.co/p/42'] },
    ],
  },
]

const noRelacionable = [
  { type: 'HEADER', format: 'IMAGE', example: { header_handle: ['h'] } },
  { type: 'BODY', text: 'Hola' },
]

describe('variableSlotsOf', () => {
  it('R64: header con variable, numeros distintos del body en orden y boton URL por su posicion (2)', () => {
    expect(variableSlotsOf(contentOf(conVariables))).toEqual(['header', 'body.1', 'body.2', 'button.2'])
  })

  it('R64: un numero repetido en el body es un solo hueco, y el orden es el numerico', () => {
    expect(variableSlotsOf(content({ body: { text: '{{2}} y {{1}} y {{2}}', examples: [] } }))).toEqual([
      'body.1',
      'body.2',
    ])
  })

  it('R64: header sin variable y URL sin variable no dan huecos', () => {
    const sinHuecos = content({
      header: { text: 'Aviso', example: null },
      buttons: [{ type: 'URL', text: 'Ver', url: 'https://x.co/p', example: null }],
    })
    expect(variableSlotsOf(sinHuecos)).toEqual([])
  })

  it('R64: una plantilla no relacionable no tiene huecos (null)', () => {
    expect(variableSlotsOf(null)).toBeNull()
    expect(variableSlotsOf(contentOf(noRelacionable))).toBeNull()
  })

  it('R95 P21: una variable con nombre ({{first_name}}) hace la plantilla no relacionable', () => {
    const conNombre = [{ type: 'BODY', text: 'Hola {{first_name}}, pedido {{1}}' }]
    expect(contentOf(conNombre)).not.toBeNull()
    expect(variableSlotsOf(contentOf(conNombre))).toBeNull()
    expect(mappingStatusOf(conNombre, [])).toBe('UNMAPPED')
    expect(mappingStatusOf(conNombre, [system('body.1', 'cliente.nombre')])).toBe('UNMAPPED')
  })

  it.each([
    ['header', content({ header: { text: 'Hola {{first_name}}', example: null } })],
    ['footer', content({ footer: 'Pie {{x}}' })],
    ['URL', content({ buttons: [{ type: 'URL', text: 'Ver', url: 'https://x.co/{{codigo}}', example: null }] })],
    ['texto de boton', content({ buttons: [{ type: 'QUICK_REPLY', text: 'Si {{x}}' }] })],
    ['{{0}}', content({ body: { text: 'Hola {{0}}', examples: [] } })],
  ])('R95: una marca que no es {{n}} con n >= 1 (%s) hace la plantilla no relacionable', (_caso, value) => {
    expect(variableSlotsOf(value)).toBeNull()
  })
})

describe('mappingStatusOf', () => {
  it('R65: relacionable sin huecos es MAPPED', () => {
    expect(mappingStatusOf([{ type: 'BODY', text: 'Hola' }], [])).toBe('MAPPED')
  })

  it('R65: todos los huecos relacionados (constante y propia) es MAPPED', () => {
    const bindings = [
      system('header', 'cliente.nombre'),
      system('body.1', 'pedido.numero'),
      company('body.2', 'k-1'),
      company('button.2', 'k-2'),
    ]
    expect(mappingStatusOf(conVariables, bindings)).toBe('MAPPED')
  })

  it('R65: un hueco sin relacion es UNMAPPED', () => {
    const bindings = [system('header', 'cliente.nombre'), system('body.1', 'pedido.numero'), company('button.2', 'k-2')]
    expect(mappingStatusOf(conVariables, bindings)).toBe('UNMAPPED')
  })

  it('R65: una relacion a un hueco que no existe no cuenta', () => {
    expect(mappingStatusOf([{ type: 'BODY', text: 'Hola {{1}}' }], [system('body.2', 'cliente.nombre')])).toBe('UNMAPPED')
  })

  it('R65: no relacionable sin variables es UNMAPPED', () => {
    expect(mappingStatusOf(noRelacionable, [])).toBe('UNMAPPED')
    expect(mappingStatusOf('no es una lista', [])).toBe('UNMAPPED')
  })
})

describe('componentsChanged', () => {
  const base = [
    { type: 'BODY', text: 'Hola {{1}}', example: { body_text: [['Ana']] } },
    { type: 'FOOTER', text: 'Pie' },
    { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Ok' }] },
  ]

  it.each([
    ['body', [{ ...base[0], text: 'Adios {{1}}' }, base[1], base[2]]],
    ['footer', [base[0], { type: 'FOOTER', text: 'Otro pie' }, base[2]]],
    ['ejemplo', [{ ...base[0], example: { body_text: [['Luis']] } }, base[1], base[2]]],
    ['boton', [base[0], base[1], { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Si' }] }]],
    ['header nuevo', [{ type: 'HEADER', format: 'TEXT', text: 'Hola' }, ...base]],
  ])('R71: cambia %s ⇒ si', (_caso, after) => {
    expect(componentsChanged(base, after)).toBe(true)
  })

  it('R71: el mismo contenido con otra forma de JSON (orden, claves de mas) ⇒ no', () => {
    const otraForma = [
      { text: 'Hola {{1}}', type: 'BODY', example: { body_text: [['Ana']] }, id: 'x' },
      { type: 'FOOTER', text: 'Pie', extra: true },
      { buttons: [{ text: 'Ok', type: 'QUICK_REPLY' }], type: 'BUTTONS' },
    ]
    expect(componentsChanged(base, otraForma)).toBe(false)
  })

  it('R71: con un lado no relacionable compara el JSON', () => {
    expect(componentsChanged(noRelacionable, [...noRelacionable])).toBe(false)
    expect(componentsChanged(noRelacionable, base)).toBe(true)
    expect(componentsChanged(noRelacionable, [noRelacionable[0], { type: 'BODY', text: 'Otro' }])).toBe(true)
  })
})

describe('showKeys', () => {
  it('R81: Hola {{1}} con body.1 = cliente.nombre ⇒ Hola {{cliente.nombre}} (E16), sin tocar los ejemplos', () => {
    const shown = showKeys(content({ body: { text: 'Hola {{1}}', examples: ['Nombre del cliente'] } }), new Map([['body.1', 'cliente.nombre']]))
    expect(shown.body).toEqual({ text: 'Hola {{cliente.nombre}}', examples: ['Nombre del cliente'] })
  })

  it('R81: un hueco sin relacion queda con {{n}}; header y URL relacionados muestran su clave', () => {
    const original = contentOf(conVariables)
    if (original === null) throw new Error('contenido de prueba no relacionable')
    const shown = showKeys(
      original,
      new Map<TemplateSlot, string>([
        ['header', 'cliente.nombre'],
        ['body.2', 'empresa.nombre'],
        ['button.2', 'cuenta_numero'],
      ]),
    )
    expect(shown).toEqual({
      header: { text: 'Hola {{cliente.nombre}}', example: 'Ana' },
      body: { text: 'Tu pedido {{1}} de {{empresa.nombre}}', examples: ['42', 'Ana'] },
      footer: null,
      buttons: [
        { type: 'QUICK_REPLY', text: 'Ok' },
        { type: 'PHONE_NUMBER', text: 'Llamar', phoneNumber: '+573001112233' },
        { type: 'URL', text: 'Ver', url: 'https://x.co/p/{{cuenta_numero}}', example: 'https://x.co/p/42' },
      ],
    })
  })
})
