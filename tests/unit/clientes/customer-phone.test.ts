import { parsePhoneNumberFromString as parseMin } from 'libphonenumber-js/min'
import { describe, expect, it } from 'vitest'

import {
  countryFromInternationalInput,
  describeCustomerPhone,
  formatPhoneInternational,
  formatPhoneNational,
  parseCustomerPhone,
  parseCustomerPhoneText,
  parseWaIdPhone,
  phoneMatchesWaId,
} from '@/lib/modules/clientes'

// Los metadatos de libphonenumber-js formatean los moviles de Colombia como `300 1234567`
// (bloque de 7), no como `300 123 4567`. Los tests fijan la salida real de la libreria.
const CO_INTERNACIONAL = '+57 300 1234567'
const CO_NACIONAL = '300 1234567'

describe('parseCustomerPhone', () => {
  it('R11 — CO + 300 123 4567 da CO, 573001234567 y el formato internacional', () => {
    expect(parseCustomerPhone('CO', '300 123 4567')).toEqual({
      kind: 'ok',
      phoneCountry: 'CO',
      phoneE164: '573001234567',
      phone: CO_INTERNACIONAL,
    })
  })

  it('R11 — el mismo numero escrito con +57 da el mismo resultado', () => {
    expect(parseCustomerPhone('CO', '+57 300 123 4567')).toEqual(parseCustomerPhone('CO', '3001234567'))
  })

  it('R9 — CO + 300 12 es invalid_number', () => {
    expect(parseCustomerPhone('CO', '300 12')).toEqual({ kind: 'invalid_number' })
  })

  it('R9 — longitud correcta pero digitos no validos para el pais es invalid_number (por eso max)', () => {
    // Con `min` pasa, porque solo mira la longitud: es lo que justifica `max`.
    expect(parseMin('600 123 4567', 'CO')?.isValid()).toBe(true)
    expect(parseCustomerPhone('CO', '600 123 4567')).toEqual({ kind: 'invalid_number' })
  })

  it('R9 — texto que no es un numero es invalid_number', () => {
    expect(parseCustomerPhone('CO', 'llamar a la oficina')).toEqual({ kind: 'invalid_number' })
  })

  it('R9 — un numero con + de otro pais es invalid_number: el servidor no cambia el pais', () => {
    expect(parseCustomerPhone('CO', '+593 99 123 4567')).toEqual({ kind: 'invalid_number' })
  })

  it('R8 — numero sin pais es country_required', () => {
    expect(parseCustomerPhone('', '300 123 4567')).toEqual({ kind: 'country_required' })
    expect(parseCustomerPhone(null, '300 123 4567')).toEqual({ kind: 'country_required' })
    expect(parseCustomerPhone(undefined, '300 123 4567')).toEqual({ kind: 'country_required' })
  })

  it('R10 — numero en blanco es none, sea cual sea el pais', () => {
    for (const blanco of ['', '   ', '\t', null, undefined]) {
      expect(parseCustomerPhone('CO', blanco)).toEqual({ kind: 'none' })
      expect(parseCustomerPhone('', blanco)).toEqual({ kind: 'none' })
      expect(parseCustomerPhone('ZZ', blanco)).toEqual({ kind: 'none' })
    }
  })

  it('R15 — un codigo fuera de la lista de libphonenumber-js es invalid_country', () => {
    expect(parseCustomerPhone('ZZ', '300 123 4567')).toEqual({ kind: 'invalid_country' })
    expect(parseCustomerPhone('co', '300 123 4567')).toEqual({ kind: 'invalid_country' })
    expect(parseCustomerPhone('COL', '300 123 4567')).toEqual({ kind: 'invalid_country' })
  })
})

describe('parseCustomerPhoneText (texto libre antiguo)', () => {
  it('R24 — interpreta el texto con el pais por defecto', () => {
    expect(parseCustomerPhoneText('300 123 4567', 'CO')).toEqual({
      kind: 'ok',
      phoneCountry: 'CO',
      phoneE164: '573001234567',
    })
  })

  it('R24 — si el texto trae +, manda el pais del numero', () => {
    expect(parseCustomerPhoneText('+593 99 123 4567', 'CO')).toEqual({
      kind: 'ok',
      phoneCountry: 'EC',
      phoneE164: '593991234567',
    })
  })

  it('R25 — un texto que no es un numero valido es invalid', () => {
    expect(parseCustomerPhoneText('ext. 402 (oficina)', 'CO')).toEqual({ kind: 'invalid' })
    expect(parseCustomerPhoneText('300 12', 'CO')).toEqual({ kind: 'invalid' })
  })
})

describe('formato', () => {
  it('R4, R6 — formatPhoneNational da el formato nacional del pais', () => {
    expect(formatPhoneNational('573001234567', 'CO')).toBe(CO_NACIONAL)
    expect(formatPhoneNational('593991234567', 'EC')).toBe('099 123 4567')
  })

  it('R29 — formatPhoneInternational da el formato internacional', () => {
    expect(formatPhoneInternational('573001234567')).toBe(CO_INTERNACIONAL)
    expect(formatPhoneInternational('593991234567')).toBe('+593 99 123 4567')
  })
})

describe('countryFromInternationalInput', () => {
  it('R7 — +593 99 123 4567 da EC', () => {
    expect(countryFromInternationalInput('+593 99 123 4567')).toBe('EC')
  })

  it('R7 — un prefijo que no identifica un unico pais da null', () => {
    expect(countryFromInternationalInput('+1')).toBeNull()
  })

  it('R7 — sin + da null', () => {
    expect(countryFromInternationalInput('3001234567')).toBeNull()
    expect(countryFromInternationalInput('')).toBeNull()
  })
})

describe('describeCustomerPhone', () => {
  it('R29 — con phoneE164, el numero internacional', () => {
    expect(
      describeCustomerPhone({ phone: CO_INTERNACIONAL, phoneE164: '573001234567', phoneIssue: null }),
    ).toEqual({ kind: 'international', text: CO_INTERNACIONAL })
  })

  it('R30 — con phoneIssue, el texto antiguo y la etiqueta corta', () => {
    expect(
      describeCustomerPhone({ phone: '300 12', phoneE164: null, phoneIssue: 'invalid_format' }),
    ).toEqual({ kind: 'issue', legacyPhone: '300 12', issue: 'invalid_format', label: 'Sin formato válido' })
    expect(
      describeCustomerPhone({ phone: '300 123 4567', phoneE164: null, phoneIssue: 'duplicate' }),
    ).toEqual({ kind: 'issue', legacyPhone: '300 123 4567', issue: 'duplicate', label: 'Duplicado: revisar' })
  })

  it('R36 — pendiente de relleno (phone sin phoneE164 ni phoneIssue): el texto antiguo, sin etiqueta', () => {
    expect(describeCustomerPhone({ phone: '300 123 4567', phoneE164: null, phoneIssue: null })).toEqual({
      kind: 'legacy',
      legacyPhone: '300 123 4567',
    })
  })

  it('R29 — sin telefono, none', () => {
    expect(describeCustomerPhone({ phone: null, phoneE164: null, phoneIssue: null })).toEqual({ kind: 'none' })
  })
})

// Los ejemplos se contrastaron con libphonenumber-js 1.13.15 (metadatos `max`): el movil de Mexico
// con el `1` y el de Brasil sin el noveno digito no son validos; su otra forma si.
describe('QC-239 parseWaIdPhone', () => {
  it('QC-239 R30 — Mexico con el 1: se queda la forma sin el 1, que es la valida, con su pais', () => {
    expect(parseWaIdPhone('5215512345678')).toEqual({ e164: '525512345678', country: 'MX' })
  })

  it('QC-239 R30 — Mexico sin el 1: el mismo numero', () => {
    expect(parseWaIdPhone('525512345678')).toEqual({ e164: '525512345678', country: 'MX' })
  })

  it('QC-239 R30 — Argentina, Brasil, Colombia y EE. UU.: el numero tal cual cuando ya es valido', () => {
    expect(parseWaIdPhone('5491123456789')).toEqual({ e164: '5491123456789', country: 'AR' })
    expect(parseWaIdPhone('5511987654321')).toEqual({ e164: '5511987654321', country: 'BR' })
    expect(parseWaIdPhone('573001234567')).toEqual({ e164: '573001234567', country: 'CO' })
    expect(parseWaIdPhone('14155552671')).toEqual({ e164: '14155552671', country: 'US' })
  })

  it('QC-239 R30 — Brasil sin el noveno digito: se queda la forma con el 9', () => {
    expect(parseWaIdPhone('551187654321')).toEqual({ e164: '5511987654321', country: 'BR' })
  })

  it('QC-239 R30, R19 — el numero devuelto sigue coincidiendo con el wa_id', () => {
    for (const waId of ['5215512345678', '525512345678', '5491123456789', '551187654321', '573001234567']) {
      const parsed = parseWaIdPhone(waId)
      expect(parsed, waId).not.toBeNull()
      expect(phoneMatchesWaId(parsed?.e164 ?? '', waId), waId).toBe(true)
    }
  })

  it('QC-239 R30 — un wa_id que no es valido en ninguna de sus variantes da null', () => {
    expect(parseWaIdPhone('999123456789')).toBeNull()
    expect(parseWaIdPhone('543511234567')).toBeNull()
    expect(parseWaIdPhone('5493511234567')).toBeNull()
  })

  it('QC-239 R30 — un wa_id vacio o con algo que no es un digito da null', () => {
    expect(parseWaIdPhone('')).toBeNull()
    expect(parseWaIdPhone('+573001234567')).toBeNull()
    expect(parseWaIdPhone('57 300 123 4567')).toBeNull()
  })
})
