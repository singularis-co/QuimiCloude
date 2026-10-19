import { describe, expect, it } from 'vitest'

import { phoneMatchesWaId } from '@/lib/modules/clientes'

describe('phoneMatchesWaId', () => {
  it('R18 — la misma cadena de digitos coincide', () => {
    expect(phoneMatchesWaId('573001234567', '573001234567')).toBe(true)
    expect(phoneMatchesWaId('14155552671', '14155552671')).toBe(true)
  })

  it('R19 — Mexico: 52 + 10 digitos frente a 521 + los mismos 10, en los dos sentidos', () => {
    expect(phoneMatchesWaId('525512345678', '5215512345678')).toBe(true)
    expect(phoneMatchesWaId('5215512345678', '525512345678')).toBe(true)
  })

  it('R20 — Argentina: 54 + 10 digitos frente a 549 + los mismos 10, en los dos sentidos', () => {
    expect(phoneMatchesWaId('541123456789', '5491123456789')).toBe(true)
    expect(phoneMatchesWaId('5491123456789', '541123456789')).toBe(true)
  })

  it('R21 — Brasil: 55 + area + 8 digitos frente a 55 + area + 9 + los mismos 8, en los dos sentidos', () => {
    expect(phoneMatchesWaId('551187654321', '5511987654321')).toBe(true)
    expect(phoneMatchesWaId('5511987654321', '551187654321')).toBe(true)
  })

  it('R22 — numeros distintos no coinciden', () => {
    expect(phoneMatchesWaId('573001234567', '573001234568')).toBe(false)
    expect(phoneMatchesWaId('525512345678', '5215512345679')).toBe(false)
    expect(phoneMatchesWaId('551187654321', '5521987654321')).toBe(false)
  })

  it('R22 — una entrada vacia o con algo que no es un digito no coincide', () => {
    expect(phoneMatchesWaId('', '')).toBe(false)
    expect(phoneMatchesWaId('', '573001234567')).toBe(false)
    expect(phoneMatchesWaId('573001234567', '')).toBe(false)
    expect(phoneMatchesWaId('+573001234567', '573001234567')).toBe(false)
    expect(phoneMatchesWaId('57 300 123 4567', '573001234567')).toBe(false)
    expect(phoneMatchesWaId('573001234567', '57300123456a')).toBe(false)
  })

  it('R22 — las variantes no se aplican a otro pais: 57 frente a 571, y 55 sin el 9 en la posicion 5', () => {
    expect(phoneMatchesWaId('573001234567', '5713001234567')).toBe(false)
    expect(phoneMatchesWaId('5713001234567', '573001234567')).toBe(false)
    expect(phoneMatchesWaId('551187654321', '5511887654321')).toBe(false)
    expect(phoneMatchesWaId('5511887654321', '551187654321')).toBe(false)
  })
})
