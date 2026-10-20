import { describe, expect, it } from 'vitest'

import {
  TEMPLATE_LIMITS,
  validateWhatsappTemplateDraft,
  type WhatsappTemplateIssue,
} from '@/lib/modules/integraciones/domain/whatsapp-template-draft'
import {
  isWhatsappTemplateLanguage,
  WHATSAPP_TEMPLATE_LANGUAGES,
} from '@/lib/modules/integraciones/domain/whatsapp-template-languages'
import { statusOf } from '@/lib/modules/integraciones/domain/whatsapp-template'

type Button =
  | { type: 'QUICK_REPLY'; text: string }
  | { type: 'URL'; text: string; url: string; example: string | null }
  | { type: 'PHONE_NUMBER'; text: string; phoneNumber: string }

function draft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'pedido_listo',
    language: 'es',
    category: 'UTILITY',
    header: null,
    body: { text: 'Hola, tu pedido esta listo.', examples: [] },
    footer: null,
    buttons: [],
    ...overrides,
  }
}

function issues(input: unknown): WhatsappTemplateIssue[] {
  const result = validateWhatsappTemplateDraft(input)
  return result.ok ? [] : [...result.issues]
}

function codesAt(input: unknown, field: string): string[] {
  return issues(input)
    .filter((issue) => issue.field === field)
    .map((issue) => issue.code)
}

const quick = (text = 'Gracias'): Button => ({ type: 'QUICK_REPLY', text })
const url = (u = 'https://ejemplo.test/p', example: string | null = null): Button => ({
  type: 'URL',
  text: 'Ver',
  url: u,
  example,
})
const phone = (phoneNumber = '+573000000000'): Button => ({ type: 'PHONE_NUMBER', text: 'Llamar', phoneNumber })

describe('validateWhatsappTemplateDraft', () => {
  it('R6: un borrador completo y valido da ok con el borrador campo a campo, sin claves ajenas', () => {
    const input = draft({
      header: { text: 'Pedido {{1}}', example: 'A-102' },
      body: { text: 'Hola {{1}}, tu pedido {{2}} esta listo.', examples: ['Ana', 'A-102'] },
      footer: 'QuimiCloud',
      buttons: [quick(), url('https://ejemplo.test/p/{{1}}', 'https://ejemplo.test/p/A-102'), phone()],
      extra: 'no viaja',
    })
    const result = validateWhatsappTemplateDraft(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft).toEqual({
      name: 'pedido_listo',
      language: 'es',
      category: 'UTILITY',
      header: { text: 'Pedido {{1}}', example: 'A-102' },
      body: { text: 'Hola {{1}}, tu pedido {{2}} esta listo.', examples: ['Ana', 'A-102'] },
      footer: 'QuimiCloud',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Gracias' },
        { type: 'URL', text: 'Ver', url: 'https://ejemplo.test/p/{{1}}', example: 'https://ejemplo.test/p/A-102' },
        { type: 'PHONE_NUMBER', text: 'Llamar', phoneNumber: '+573000000000' },
      ],
    })
  })

  it('R6: cada problema trae campo, codigo estable y mensaje en espanol', () => {
    const [issue] = issues(draft({ name: '' }))
    expect(issue).toEqual({ field: 'name', code: 'required', message: expect.stringMatching(/obligatorio/) })
  })

  it('R6: una entrada sin la forma de borrador da problemas, no lanza', () => {
    expect(validateWhatsappTemplateDraft(null).ok).toBe(false)
    expect(validateWhatsappTemplateDraft('x').ok).toBe(false)
    expect(codesAt(draft({ body: undefined }), 'body')).toEqual(['required'])
    expect(codesAt(draft({ buttons: [{ type: 'OTP', text: 'x' }] }), 'buttons.0.type')).toEqual(['not_allowed'])
  })

  it('R6: los largos se miden en puntos de codigo: un emoji cuenta uno', () => {
    expect(issues(draft({ footer: '😀'.repeat(60) }))).toEqual([])
    expect(codesAt(draft({ footer: '😀'.repeat(61) }), 'footer')).toEqual(['too_long'])
  })

  describe('R7: nombre', () => {
    it('R7: 512 caracteres validos pasan; 513 no', () => {
      expect(TEMPLATE_LIMITS.nameMaxLength).toBe(512)
      expect(codesAt(draft({ name: 'a'.repeat(512) }), 'name')).toEqual([])
      expect(codesAt(draft({ name: 'a'.repeat(513) }), 'name')).toEqual(['too_long'])
    })

    it('R7: un caracter pasa; vacio o solo espacios es obligatorio', () => {
      expect(codesAt(draft({ name: 'a' }), 'name')).toEqual([])
      expect(codesAt(draft({ name: '' }), 'name')).toEqual(['required'])
      expect(codesAt(draft({ name: '   ' }), 'name')).toEqual(['required'])
    })

    it('R7: mayusculas, guion, espacio o acento son caracteres no validos', () => {
      for (const name of ['Pedido', 'pedido-listo', 'pedido listo', 'pedído']) {
        expect(codesAt(draft({ name }), 'name')).toEqual(['invalid_chars'])
      }
      expect(codesAt(draft({ name: 'pedido_2_listo' }), 'name')).toEqual([])
    })
  })

  describe('R8: idioma', () => {
    it('R8: la lista tiene los 111 codigos vigentes de Meta, sin repetidos', () => {
      expect(WHATSAPP_TEMPLATE_LANGUAGES).toHaveLength(111)
      expect(new Set(WHATSAPP_TEMPLATE_LANGUAGES).size).toBe(111)
      for (const code of ['es', 'en_US', 'pt_BR', 'es_CO', 'en_AU', 'prs_AF', 'si_LK', 'zu']) {
        expect(isWhatsappTemplateLanguage(code)).toBe(true)
      }
    })

    it('R8: un idioma de la lista pasa; uno de fuera, otro formato o vacio no', () => {
      expect(codesAt(draft({ language: 'es_MX' }), 'language')).toEqual([])
      expect(codesAt(draft({ language: 'xx' }), 'language')).toEqual(['not_allowed'])
      expect(codesAt(draft({ language: 'en-US' }), 'language')).toEqual(['not_allowed'])
      expect(codesAt(draft({ language: 'ES' }), 'language')).toEqual(['not_allowed'])
      expect(codesAt(draft({ language: '' }), 'language')).toEqual(['required'])
    })
  })

  describe('R9: categoria', () => {
    it('R9: MARKETING y UTILITY pasan; AUTHENTICATION y otra no', () => {
      expect(codesAt(draft({ category: 'MARKETING' }), 'category')).toEqual([])
      expect(codesAt(draft({ category: 'UTILITY' }), 'category')).toEqual([])
      expect(codesAt(draft({ category: 'AUTHENTICATION' }), 'category')).toEqual(['not_allowed'])
      expect(codesAt(draft({ category: 'marketing' }), 'category')).toEqual(['not_allowed'])
    })
  })

  describe('R10: cuerpo', () => {
    const body = (text: string, examples: string[] = []) => draft({ body: { text, examples } })

    it('R10: 1024 caracteres pasan; 1025 no; vacio o solo espacios es obligatorio', () => {
      expect(TEMPLATE_LIMITS.bodyMaxLength).toBe(1024)
      expect(codesAt(body('a'.repeat(1024)), 'body.text')).toEqual([])
      expect(codesAt(body('a'.repeat(1025)), 'body.text')).toEqual(['too_long'])
      expect(codesAt(body(''), 'body.text')).toEqual(['required'])
      expect(codesAt(body('  \n '), 'body.text')).toEqual(['required'])
    })

    it('R10: una marca que no es {{entero >= 1}} es una variable invalida', () => {
      for (const text of ['Hola {{0}}', 'Hola {{nombre}}', 'Hola {{ 1 }}', 'Hola {{01}}', 'Hola {{1}', 'Hola }}1{{']) {
        expect(codesAt(body(text, ['x']), 'body.text')).toEqual(['invalid_variable'])
      }
    })

    it('R10: las variables deben ser 1..n; con hueco o sin el 1 no pasa; repetir una vale', () => {
      expect(codesAt(body('{{1}} {{3}}', ['a', 'b']), 'body.text')).toEqual(['variables_not_sequential'])
      expect(codesAt(body('{{2}}', ['a']), 'body.text')).toEqual(['variables_not_sequential'])
      expect(issues(body('{{2}} y {{1}}', ['a', 'b']))).toEqual([])
      expect(issues(body('{{1}} y otra vez {{1}}', ['a']))).toEqual([])
    })

    it('R10: un ejemplo no vacio por variable; faltar, sobrar o vacio no pasa', () => {
      expect(issues(body('{{1}} {{2}}', ['a', 'b']))).toEqual([])
      expect(codesAt(body('{{1}} {{2}}', ['a']), 'body.examples')).toEqual(['example_missing'])
      expect(codesAt(body('{{1}}', ['a', 'b']), 'body.examples')).toEqual(['example_extra'])
      expect(codesAt(body('Sin variables', ['a']), 'body.examples')).toEqual(['example_extra'])
      expect(codesAt(body('{{1}} {{2}}', ['a', ' ']), 'body.examples.1')).toEqual(['example_missing'])
    })

    it('R10: un texto con U+0000 no pasa (la base no lo guarda)', () => {
      expect(codesAt(body('Hola\u0000'), 'body.text')).toEqual(['invalid_chars'])
    })
  })

  describe('R11: encabezado', () => {
    const header = (text: string, example: string | null = null) => draft({ header: { text, example } })

    it('R11: sin encabezado pasa', () => {
      expect(issues(draft({ header: null }))).toEqual([])
      expect(issues(draft({ header: undefined }))).toEqual([])
    })

    it('R11: 60 caracteres pasan; 61 no; vacio es obligatorio', () => {
      expect(TEMPLATE_LIMITS.headerMaxLength).toBe(60)
      expect(codesAt(header('a'.repeat(60)), 'header.text')).toEqual([])
      expect(codesAt(header('a'.repeat(61)), 'header.text')).toEqual(['too_long'])
      expect(codesAt(header(' '), 'header.text')).toEqual(['required'])
    })

    it('R11: como mucho una variable y solo {{1}}', () => {
      expect(issues(header('Pedido {{1}}', 'A-1'))).toEqual([])
      expect(codesAt(header('{{1}} {{2}}', 'a'), 'header.text')).toEqual(['invalid_variable'])
      expect(codesAt(header('{{1}} {{1}}', 'a'), 'header.text')).toEqual(['invalid_variable'])
      expect(codesAt(header('Pedido {{2}}', 'a'), 'header.text')).toEqual(['invalid_variable'])
    })

    it('R11: con variable el ejemplo es obligatorio; sin variable no lleva ejemplo', () => {
      expect(codesAt(header('Pedido {{1}}', null), 'header.example')).toEqual(['example_missing'])
      expect(codesAt(header('Pedido {{1}}', ''), 'header.example')).toEqual(['example_missing'])
      expect(codesAt(header('Pedido', 'A-1'), 'header.example')).toEqual(['example_extra'])
      expect(issues(header('Pedido', null))).toEqual([])
    })
  })

  describe('R12: pie', () => {
    it('R12: 60 caracteres pasan; 61 no; vacio es obligatorio; sin variables', () => {
      expect(TEMPLATE_LIMITS.footerMaxLength).toBe(60)
      expect(codesAt(draft({ footer: 'a'.repeat(60) }), 'footer')).toEqual([])
      expect(codesAt(draft({ footer: 'a'.repeat(61) }), 'footer')).toEqual(['too_long'])
      expect(codesAt(draft({ footer: '' }), 'footer')).toEqual(['required'])
      expect(codesAt(draft({ footer: 'Hola {{1}}' }), 'footer')).toEqual(['not_allowed'])
    })
  })

  describe('R13: botones', () => {
    const buttons = (list: Button[]) => draft({ buttons: list })

    it('R13: texto del boton de 25 pasa; 26 no; vacio es obligatorio; sin variables', () => {
      expect(TEMPLATE_LIMITS.buttonTextMaxLength).toBe(25)
      expect(codesAt(buttons([quick('a'.repeat(25))]), 'buttons.0.text')).toEqual([])
      expect(codesAt(buttons([quick('a'.repeat(26))]), 'buttons.0.text')).toEqual(['too_long'])
      expect(codesAt(buttons([quick(' ')]), 'buttons.0.text')).toEqual(['required'])
      expect(codesAt(buttons([quick('Ver {{1}}')]), 'buttons.0.text')).toEqual(['not_allowed'])
    })

    it('R13: 10 botones pasan; 11 no', () => {
      expect(TEMPLATE_LIMITS.maxButtons).toBe(10)
      expect(codesAt(buttons(Array.from({ length: 10 }, () => quick())), 'buttons')).toEqual([])
      expect(codesAt(buttons(Array.from({ length: 11 }, () => quick())), 'buttons')).toEqual(['too_many_buttons'])
    })

    it('R13: 2 botones de URL pasan; 3 no', () => {
      expect(TEMPLATE_LIMITS.maxUrlButtons).toBe(2)
      expect(codesAt(buttons([url(), url()]), 'buttons')).toEqual([])
      expect(codesAt(buttons([url(), url(), url()]), 'buttons')).toEqual(['too_many_buttons'])
    })

    it('R13: 1 boton de telefono pasa; 2 no', () => {
      expect(TEMPLATE_LIMITS.maxPhoneButtons).toBe(1)
      expect(codesAt(buttons([phone()]), 'buttons')).toEqual([])
      expect(codesAt(buttons([phone(), phone()]), 'buttons')).toEqual(['too_many_buttons'])
    })

    it('R13: las respuestas rapidas todas antes o todas despues; intercaladas no', () => {
      expect(codesAt(buttons([quick(), quick(), url(), phone()]), 'buttons')).toEqual([])
      expect(codesAt(buttons([url(), phone(), quick(), quick()]), 'buttons')).toEqual([])
      expect(codesAt(buttons([quick(), url(), quick()]), 'buttons')).toEqual(['buttons_not_grouped'])
      expect(codesAt(buttons([url(), quick(), phone()]), 'buttons')).toEqual(['buttons_not_grouped'])
    })

    it('R13: URL de 2000 caracteres pasa; 2001 no', () => {
      expect(TEMPLATE_LIMITS.urlMaxLength).toBe(2000)
      const prefix = 'https://ejemplo.test/'
      const at2000 = prefix + 'a'.repeat(2000 - prefix.length)
      expect(codesAt(buttons([url(at2000)]), 'buttons.0.url')).toEqual([])
      expect(codesAt(buttons([url(at2000 + 'a')]), 'buttons.0.url')).toEqual(['too_long'])
    })

    it('R13: la URL debe ser https://', () => {
      expect(codesAt(buttons([url('http://ejemplo.test')]), 'buttons.0.url')).toEqual(['invalid_url'])
      expect(codesAt(buttons([url('ejemplo.test')]), 'buttons.0.url')).toEqual(['invalid_url'])
      expect(codesAt(buttons([url('https://')]), 'buttons.0.url')).toEqual(['invalid_url'])
      expect(codesAt(buttons([url('')]), 'buttons.0.url')).toEqual(['required'])
    })

    it('R13: como mucho un {{1}} y solo al final de la URL', () => {
      const ok = url('https://ejemplo.test/p/{{1}}', 'https://ejemplo.test/p/A-1')
      expect(issues(buttons([ok]))).toEqual([])
      for (const u of ['https://ejemplo.test/{{1}}/x', 'https://ejemplo.test/{{2}}', 'https://ejemplo.test/{{1}}{{1}}']) {
        expect(codesAt(buttons([url(u, 'https://ejemplo.test/a')]), 'buttons.0.url')).toEqual(['invalid_variable'])
      }
    })

    it('R13: con variable el ejemplo es una URL https://; sin variable no lleva ejemplo', () => {
      const withVar = 'https://ejemplo.test/p/{{1}}'
      expect(codesAt(buttons([url(withVar, null)]), 'buttons.0.example')).toEqual(['example_missing'])
      expect(codesAt(buttons([url(withVar, 'http://ejemplo.test/p/1')]), 'buttons.0.example')).toEqual(['invalid_url'])
      expect(codesAt(buttons([url(withVar, 'A-1')]), 'buttons.0.example')).toEqual(['invalid_url'])
      expect(codesAt(buttons([url('https://ejemplo.test', 'https://ejemplo.test')]), 'buttons.0.example')).toEqual([
        'example_extra',
      ])
    })

    it('R13: telefono con + y de 8 a 15 digitos; 7 o 16 no', () => {
      expect(codesAt(buttons([phone('+12345678')]), 'buttons.0.phoneNumber')).toEqual([])
      expect(codesAt(buttons([phone('+123456789012345')]), 'buttons.0.phoneNumber')).toEqual([])
      expect(codesAt(buttons([phone('+1234567')]), 'buttons.0.phoneNumber')).toEqual(['invalid_phone'])
      expect(codesAt(buttons([phone('+1234567890123456')]), 'buttons.0.phoneNumber')).toEqual(['invalid_phone'])
      expect(codesAt(buttons([phone('573000000000')]), 'buttons.0.phoneNumber')).toEqual(['invalid_phone'])
      expect(codesAt(buttons([phone('+0123456789')]), 'buttons.0.phoneNumber')).toEqual(['invalid_phone'])
    })
  })
})

describe('statusOf', () => {
  it('R4: los cinco estados conocidos van sin valor crudo', () => {
    for (const raw of ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED']) {
      expect(statusOf(raw)).toEqual({ status: raw, statusRaw: null })
    }
  })

  it('R4: otro estado, o uno conocido en minusculas, es OTHER con su valor crudo recortado a 100', () => {
    expect(statusOf('IN_APPEAL')).toEqual({ status: 'OTHER', statusRaw: 'IN_APPEAL' })
    expect(statusOf('approved')).toEqual({ status: 'OTHER', statusRaw: 'approved' })
    expect(statusOf('X'.repeat(150)).statusRaw).toBe('X'.repeat(100))
  })
})
