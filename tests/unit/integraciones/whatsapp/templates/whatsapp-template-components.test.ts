import { describe, expect, it } from 'vitest'

import { contentOf, toMetaComponents } from '@/lib/modules/integraciones/domain/whatsapp-template-components'
import type { WhatsappTemplateContent } from '@/lib/modules/integraciones/domain/whatsapp-template-draft'

const FULL: WhatsappTemplateContent = {
  header: { text: 'Pedido {{1}}', example: 'A-102' },
  body: { text: 'Hola {{1}}, tu pedido {{2}} está listo.', examples: ['Ana', 'A-102'] },
  footer: 'QuimiCloud',
  buttons: [
    { type: 'QUICK_REPLY', text: 'Gracias' },
    { type: 'URL', text: 'Ver pedido', url: 'https://ejemplo.test/p/{{1}}', example: 'https://ejemplo.test/p/A-102' },
    { type: 'PHONE_NUMBER', text: 'Llamar', phoneNumber: '+573000000000' },
  ],
}

const MINIMAL: WhatsappTemplateContent = {
  header: null,
  body: { text: 'Tu pedido está listo.', examples: [] },
  footer: null,
  buttons: [],
}

describe('toMetaComponents', () => {
  it('R16: arma los componentes en la forma de la Cloud API', () => {
    expect(toMetaComponents(FULL)).toEqual([
      { type: 'HEADER', format: 'TEXT', text: 'Pedido {{1}}', example: { header_text: ['A-102'] } },
      { type: 'BODY', text: 'Hola {{1}}, tu pedido {{2}} está listo.', example: { body_text: [['Ana', 'A-102']] } },
      { type: 'FOOTER', text: 'QuimiCloud' },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Gracias' },
          { type: 'URL', text: 'Ver pedido', url: 'https://ejemplo.test/p/{{1}}', example: ['https://ejemplo.test/p/A-102'] },
          { type: 'PHONE_NUMBER', text: 'Llamar', phone_number: '+573000000000' },
        ],
      },
    ])
  })

  it('R16: sin variables no hay example; sin header, footer ni botones no aparecen', () => {
    expect(toMetaComponents(MINIMAL)).toEqual([{ type: 'BODY', text: 'Tu pedido está listo.' }])
    const urlWithoutVariable = toMetaComponents({
      ...MINIMAL,
      header: { text: 'Hola', example: null },
      buttons: [{ type: 'URL', text: 'Ver', url: 'https://ejemplo.test', example: null }],
    })
    expect(urlWithoutVariable[0]).toEqual({ type: 'HEADER', format: 'TEXT', text: 'Hola' })
    expect(urlWithoutVariable[2]).toEqual({
      type: 'BUTTONS',
      buttons: [{ type: 'URL', text: 'Ver', url: 'https://ejemplo.test' }],
    })
  })
})

describe('contentOf', () => {
  it('R46: ida y vuelta: contentOf(toMetaComponents(c)) reproduce el contenido', () => {
    expect(contentOf(toMetaComponents(FULL))).toEqual(FULL)
    expect(contentOf(toMetaComponents(MINIMAL))).toEqual(MINIMAL)
  })

  it('R46: lee los componentes con las claves en otro orden y con campos de mas', () => {
    const fromMeta = [
      { text: 'Hola {{1}}', type: 'BODY', example: { body_text: [['Ana']] } },
      { buttons: [{ text: 'Si', type: 'QUICK_REPLY', extra: true }], type: 'BUTTONS' },
    ]
    expect(contentOf(fromMeta)).toEqual({
      header: null,
      body: { text: 'Hola {{1}}', examples: ['Ana'] },
      footer: null,
      buttons: [{ type: 'QUICK_REPLY', text: 'Si' }],
    })
  })

  it('R96: el ejemplo del boton URL como texto o como lista da el mismo contenido', () => {
    const withExample = (example: unknown) => [
      { type: 'BODY', text: 'x' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Ver', url: 'https://ejemplo.test/p/{{1}}', example }] },
    ]
    const asText = contentOf(withExample('https://ejemplo.test/p/A-102'))
    const asList = contentOf(withExample(['https://ejemplo.test/p/A-102']))
    expect(asText).not.toBeNull()
    expect(asText).toEqual(asList)
    expect(asText?.buttons[0]).toEqual({
      type: 'URL',
      text: 'Ver',
      url: 'https://ejemplo.test/p/{{1}}',
      example: 'https://ejemplo.test/p/A-102',
    })
    expect(contentOf(withExample(['https://ejemplo.test/p/A-102', 'https://ejemplo.test/p/B-7']))).toEqual(asText)
    expect(contentOf(withExample(42))).toBeNull()
  })

  it('R46: un header con archivo da null', () => {
    for (const format of ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION']) {
      expect(contentOf([{ type: 'HEADER', format }, { type: 'BODY', text: 'x' }])).toBeNull()
    }
  })

  it('R46: un boton de otro tipo (OTP, COPY_CODE, FLOW) da null', () => {
    for (const type of ['OTP', 'COPY_CODE', 'FLOW', 'CATALOG']) {
      expect(contentOf([{ type: 'BODY', text: 'x' }, { type: 'BUTTONS', buttons: [{ type, text: 'x' }] }])).toBeNull()
    }
  })

  it('R46: un componente de otro tipo, sin body, repetido o con forma que no casa da null', () => {
    expect(contentOf([{ type: 'BODY', text: 'x' }, { type: 'CAROUSEL', cards: [] }])).toBeNull()
    expect(contentOf([{ type: 'FOOTER', text: 'x' }])).toBeNull()
    expect(contentOf([{ type: 'BODY', text: 'x' }, { type: 'BODY', text: 'y' }])).toBeNull()
    expect(contentOf([{ type: 'BODY' }])).toBeNull()
    expect(contentOf('no es un arreglo')).toBeNull()
    expect(contentOf(null)).toBeNull()
  })
})
