import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { toMetaComponents } from '@/lib/modules/integraciones/domain/whatsapp-template-components'
import type { WhatsappTemplateIssue } from '@/lib/modules/integraciones/domain/whatsapp-template-draft'
import {
  validateKeyedTemplateDraft,
  type DictionaryEntry,
} from '@/lib/modules/integraciones/domain/whatsapp-template-keyed-draft'
import { showKeys, type TemplateSlot } from '@/lib/modules/integraciones/domain/whatsapp-template-variables'

const domainDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', 'lib', 'modules', 'integraciones', 'domain')

const dictionary: readonly DictionaryEntry[] = [{ id: 'k-cuenta', key: 'cuenta_numero', label: 'Número de cuenta' }]

// Las etiquetas de las constantes las manda el front con el borrador.
const constantLabels = { 'cliente.nombre': 'Nombre del cliente', 'pedido.numero': 'Número de pedido' }

function draft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'pedido_listo',
    language: 'es',
    category: 'UTILITY',
    header: null,
    body: { text: 'Hola, tu pedido esta listo.' },
    footer: null,
    buttons: [],
    constantLabels,
    ...overrides,
  }
}

function issues(input: unknown): WhatsappTemplateIssue[] {
  const result = validateKeyedTemplateDraft(input, dictionary)
  return result.ok ? [] : [...result.issues]
}

function codesAt(input: unknown, field: string): string[] {
  return issues(input)
    .filter((issue) => issue.field === field)
    .map((issue) => issue.code)
}

function ok(input: unknown) {
  const result = validateKeyedTemplateDraft(input, dictionary)
  if (!result.ok) throw new Error(`se esperaba valido: ${JSON.stringify(result.issues)}`)
  return result
}

describe('validateKeyedTemplateDraft: marcas', () => {
  it.each([
    ['{{1}}', 'Hola {{1}}'],
    ['{{Nombre}}', 'Hola {{Nombre}}'],
    ['{{ nombre }}', 'Hola {{ nombre }}'],
    ['{{}}', 'Hola {{}}'],
  ])('R91: %s en el body es invalid_variable', (_caso, text) => {
    expect(codesAt(draft({ body: { text } }), 'body.text')).toEqual(['invalid_variable'])
  })

  it.each([
    ['tres segmentos', 'Hola {{cliente.direccion.ciudad}}'],
    ['segmento vacio', 'Hola {{cliente.}}'],
    ['segmento de 41', `Hola {{cliente.a${'b'.repeat(40)}}}`],
  ])('R91: una marca que no es una clave de R88 (%s) es invalid_variable', (_caso, text) => {
    expect(codesAt(draft({ body: { text } }), 'body.text')).toEqual(['invalid_variable'])
  })

  it('R91 P19: una propia desconocida es unknown_key en su campo', () => {
    expect(codesAt(draft({ body: { text: 'Hola {{apodo}}' } }), 'body.text')).toEqual(['unknown_key'])
    expect(codesAt(draft({ header: { text: 'Hola {{apodo}}' } }), 'header.text')).toEqual(['unknown_key'])
    const url = draft({ buttons: [{ type: 'QUICK_REPLY', text: 'Ok' }, { type: 'URL', text: 'Ver', url: 'https://x.co/{{apodo}}' }] })
    expect(issues(url)).toEqual([expect.objectContaining({ field: 'buttons.1.url', code: 'unknown_key' })])
  })

  it('R91: una clave de 41 caracteres es invalid_variable aunque tenga la forma', () => {
    expect(codesAt(draft({ body: { text: `Hola {{a${'b'.repeat(40)}}}` } }), 'body.text')).toEqual(['invalid_variable'])
  })

  it('R91: una constante y una propia valen', () => {
    expect(validateKeyedTemplateDraft(draft({ body: { text: 'Hola {{cliente.nombre}}, cuenta {{cuenta_numero}}' } }), dictionary).ok).toBe(true)
  })

  it('R87 R91: una constante se acepta por su forma, sin consultar ningun catalogo', () => {
    const result = validateKeyedTemplateDraft(
      draft({ body: { text: 'Envio {{envio.guia}}' }, constantLabels: { 'envio.guia': 'Número de guía' } }),
      [],
    )
    expect(result.ok && result.bindings).toEqual([{ slot: 'body.1', kind: 'system', systemKey: 'envio.guia' }])
  })

  it('R91: el diccionario es el que se pasa: sin la propia, su clave es desconocida', () => {
    const result = validateKeyedTemplateDraft(draft({ body: { text: 'Cuenta {{cuenta_numero}}' } }), [])
    expect(result.ok ? [] : result.issues.map((i) => i.code)).toEqual(['unknown_key'])
  })

  it('R92 P20: una constante sin etiqueta, o con la etiqueta vacia, es example_missing en su campo', () => {
    expect(codesAt(draft({ body: { text: 'Hola {{cliente.nombre}}' }, constantLabels: {} }), 'body.text')).toEqual([
      'example_missing',
    ])
    expect(codesAt(draft({ body: { text: 'Hola {{cliente.nombre}}' }, constantLabels: undefined }), 'body.text')).toEqual([
      'example_missing',
    ])
    const vacia = draft({
      buttons: [{ type: 'URL', text: 'Ver', url: 'https://x.co/{{cliente.nombre}}' }],
      constantLabels: { 'cliente.nombre': '  ' },
    })
    expect(issues(vacia)).toEqual([expect.objectContaining({ field: 'buttons.0.url', code: 'example_missing' })])
  })

  it('R92: la etiqueta de una propia sale del diccionario aunque la peticion traiga otra', () => {
    const result = ok(draft({ body: { text: 'Cuenta {{cuenta_numero}}' }, constantLabels: { cuenta_numero: 'Otra' } }))
    expect(result.draft.body.examples).toEqual(['Número de cuenta'])
  })

  it('R91: una marca mal cerrada la sigue rechazando la regla de Meta', () => {
    expect(codesAt(draft({ body: { text: 'Hola {{nombre' } }), 'body.text')).toEqual(['invalid_variable'])
  })
})

describe('validateKeyedTemplateDraft: traduccion', () => {
  it('R67 R92 E16: Hola {{cliente.nombre}} ⇒ Hola {{1}} con ejemplo «Nombre del cliente» y body.1 = cliente.nombre', () => {
    const result = ok(draft({ body: { text: 'Hola {{cliente.nombre}}' } }))
    expect(result.draft.body).toEqual({ text: 'Hola {{1}}', examples: ['Nombre del cliente'] })
    expect(result.bindings).toEqual([{ slot: 'body.1', kind: 'system', systemKey: 'cliente.nombre' }])
    expect(toMetaComponents(result.draft)).toEqual([
      { type: 'BODY', text: 'Hola {{1}}', example: { body_text: [['Nombre del cliente']] } },
    ])
  })

  it('R67 R81 E16: el ejemplo canonico vuelve como Hola {{cliente.nombre}} al mostrar las claves', () => {
    const result = ok(draft({ body: { text: 'Hola {{cliente.nombre}}' } }))
    const keyBySlot = new Map<TemplateSlot, string>(
      result.bindings.map((b) => [b.slot, b.kind === 'system' ? b.systemKey : b.variableKeyId]),
    )
    expect(showKeys(result.draft, keyBySlot).body.text).toBe('Hola {{cliente.nombre}}')
  })

  it('R67: cada clave distinta recibe el siguiente numero por primera aparicion; la repetida, el mismo', () => {
    const result = ok(draft({ body: { text: 'Hola {{cliente.nombre}}, tu pedido {{pedido.numero}}. Gracias {{cliente.nombre}}' } }))
    expect(result.draft.body).toEqual({
      text: 'Hola {{1}}, tu pedido {{2}}. Gracias {{1}}',
      examples: ['Nombre del cliente', 'Número de pedido'],
    })
    expect(result.bindings).toEqual([
      { slot: 'body.1', kind: 'system', systemKey: 'cliente.nombre' },
      { slot: 'body.2', kind: 'system', systemKey: 'pedido.numero' },
    ])
  })

  it('R67: cada componente se numera por separado; la URL lleva la etiqueta sustituida como ejemplo', () => {
    const result = ok(
      draft({
        header: { text: 'Cuenta {{cuenta_numero}}' },
        body: { text: 'Hola {{cliente.nombre}}, cuenta {{cuenta_numero}}' },
        buttons: [
          { type: 'QUICK_REPLY', text: 'Ok' },
          { type: 'URL', text: 'Ver', url: 'https://x.co/c/{{cuenta_numero}}' },
        ],
      }),
    )
    expect(result.draft.header).toEqual({ text: 'Cuenta {{1}}', example: 'Número de cuenta' })
    expect(result.draft.body).toEqual({
      text: 'Hola {{1}}, cuenta {{2}}',
      examples: ['Nombre del cliente', 'Número de cuenta'],
    })
    expect(result.draft.buttons[1]).toEqual({
      type: 'URL',
      text: 'Ver',
      url: 'https://x.co/c/{{1}}',
      example: 'https://x.co/c/Número de cuenta',
    })
    expect(result.bindings).toEqual([
      { slot: 'header', kind: 'company', variableKeyId: 'k-cuenta' },
      { slot: 'body.1', kind: 'system', systemKey: 'cliente.nombre' },
      { slot: 'body.2', kind: 'company', variableKeyId: 'k-cuenta' },
      { slot: 'button.1', kind: 'company', variableKeyId: 'k-cuenta' },
    ])
  })

  it('R67 E15: los ejemplos que traiga el borrador se ignoran', () => {
    const result = ok(
      draft({
        header: { text: 'Hola {{cliente.nombre}}', example: 'Ana' },
        body: { text: 'Pedido {{pedido.numero}}', examples: ['42', 'sobra'] },
        buttons: [{ type: 'URL', text: 'Ver', url: 'https://x.co/{{cliente.nombre}}', example: 'https://x.co/ana' }],
      }),
    )
    expect(result.draft.header?.example).toBe('Nombre del cliente')
    expect(result.draft.body.examples).toEqual(['Número de pedido'])
    expect(result.draft.buttons[0]).toMatchObject({ example: 'https://x.co/Nombre del cliente' })
  })

  it('R67 E15: una etiqueta de 60 caracteres como ejemplo de header no da problema', () => {
    const larga: DictionaryEntry = { id: 'k-larga', key: 'larga', label: 'e'.repeat(60) }
    const result = validateKeyedTemplateDraft(draft({ header: { text: 'Hola {{larga}}' } }), [...dictionary, larga])
    expect(result.ok).toBe(true)
  })

  it('R67: un ejemplo de URL que no seria valido para la regla de Meta no se rechaza en la app', () => {
    const rara: DictionaryEntry = { id: 'k-rara', key: 'rara', label: 'x'.repeat(2000) }
    const result = validateKeyedTemplateDraft(
      draft({ buttons: [{ type: 'URL', text: 'Ver', url: 'https://x.co/{{rara}}' }] }),
      [...dictionary, rara],
    )
    expect(result.ok).toBe(true)
  })

  it('R67: el largo se mide sobre el texto traducido y el mensaje lo dice', () => {
    // `{{cliente.nombre}}` (18) pasa a `{{1}}` (5): 1019 + 18 en pantalla son 1024 al traducir.
    const cabe = `${'a'.repeat(1019)}{{cliente.nombre}}`
    expect(codesAt(draft({ body: { text: cabe } }), 'body.text')).toEqual([])
    const noCabe = `${'a'.repeat(1020)}{{cliente.nombre}}`
    const [problema] = issues(draft({ body: { text: noCabe } }))
    expect(problema).toEqual({
      field: 'body.text',
      code: 'too_long',
      message: 'El cuerpo admite como mucho 1024 caracteres una vez numeradas las variables.',
    })
  })

  it('R67: los problemas de la regla de Meta salen en el campo del borrador con claves', () => {
    const result = validateKeyedTemplateDraft(
      draft({
        header: { text: '{{cliente.nombre}} {{pedido.numero}}' },
        footer: 'Pie {{cliente.nombre}}',
        buttons: [{ type: 'URL', text: 'Ver', url: 'https://x.co/{{cliente.nombre}}/fin' }],
      }),
      dictionary,
    )
    expect(result.ok ? [] : result.issues.map((i) => [i.field, i.code])).toEqual([
      ['header.text', 'invalid_variable'],
      ['footer', 'not_allowed'],
      ['buttons.0.url', 'invalid_variable'],
    ])
  })

  it('R67: sin variables no hay relaciones y el borrador pasa igual', () => {
    const result = ok(draft())
    expect(result.bindings).toEqual([])
    expect(result.draft).toEqual({
      name: 'pedido_listo',
      language: 'es',
      category: 'UTILITY',
      header: null,
      body: { text: 'Hola, tu pedido esta listo.', examples: [] },
      footer: null,
      buttons: [],
    })
  })

  it('R67: categoria e idioma invalidos se siguen rechazando', () => {
    expect(codesAt(draft({ category: 'AUTHENTICATION' }), 'category')).toEqual(['not_allowed'])
    expect(codesAt(draft({ language: 'xx' }), 'language')).toEqual(['not_allowed'])
  })

  it('R67: una entrada sin la forma del borrador falla sin lanzar', () => {
    expect(validateKeyedTemplateDraft(null, dictionary).ok).toBe(false)
    expect(codesAt(draft({ buttons: [{ type: 'OTP', text: 'x' }] }), 'buttons.0.type')).toEqual(['not_allowed'])
  })
})

describe('validateKeyedTemplateDraft: forma del archivo', () => {
  it('R6: el validador con claves solo importa zod y domain/', () => {
    const source = readFileSync(join(domainDir, 'whatsapp-template-keyed-draft.ts'), 'utf8')
    const specifiers = [...source.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1] as string)
    expect(specifiers.length).toBeGreaterThan(0)
    for (const specifier of specifiers) {
      expect(specifier === 'zod' || specifier.startsWith('./'), specifier).toBe(true)
    }
  })
})
