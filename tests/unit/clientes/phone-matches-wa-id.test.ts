import { describe, expect, it } from 'vitest'

import { phoneMatchesWaId, waIdCandidates } from '@/lib/modules/clientes'

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

// Muestra de numeros de MX, AR, BR, CO y US, en sus dos formas cuando las tienen.
const SAMPLE = [
  '525512345678',
  '5215512345678',
  '523312345678',
  '541123456789',
  '5491123456789',
  '551187654321',
  '5511987654321',
  '5511887654321',
  '573001234567',
  '5713001234567',
  '14155552671',
  '12025550123',
] as const

/**
 * Todo numero de 7 a 15 digitos que difiere de `digits` en a lo sumo un digito anadido o quitado.
 * `phoneMatchesWaId` solo quita o pone un digito, asi que cualquier numero que coincida esta aqui:
 * comprobar el vecindario entero es comprobar la propiedad para todos.
 */
function neighbourhood(digits: string): readonly string[] {
  const found = new Set<string>([digits])
  for (let i = 0; i <= digits.length; i += 1) {
    if (i < digits.length) found.add(digits.slice(0, i) + digits.slice(i + 1))
    for (let d = 0; d <= 9; d += 1) found.add(digits.slice(0, i) + String(d) + digits.slice(i))
  }
  return [...found].filter((x) => x.length >= 7 && x.length <= 15)
}

describe('QC-239 waIdCandidates', () => {
  it('QC-239 R19 — propiedad: todo candidato coincide con el numero', () => {
    for (const digits of SAMPLE) {
      const candidates = waIdCandidates(digits)
      expect(candidates).toContain(digits)
      for (const candidate of candidates) expect(phoneMatchesWaId(candidate, digits), `${candidate} ~ ${digits}`).toBe(true)
    }
  })

  it('QC-239 R19 — propiedad: todo numero de 7 a 15 digitos que coincide esta entre los candidatos', () => {
    for (const digits of SAMPLE) {
      const candidates = new Set(waIdCandidates(digits))
      for (const x of neighbourhood(digits)) {
        if (phoneMatchesWaId(x, digits)) expect(candidates.has(x), `${x} ~ ${digits}`).toBe(true)
      }
      // Los candidatos de una forma tambien coinciden con la otra: el vecindario de cada uno.
      for (const candidate of candidates) {
        for (const x of neighbourhood(candidate)) {
          if (phoneMatchesWaId(x, digits)) expect(candidates.has(x), `${x} ~ ${digits}`).toBe(true)
        }
      }
    }
  })

  it('QC-239 R19 — Mexico, Argentina y Brasil dan sus dos formas; Colombia y EE. UU., solo la suya', () => {
    expect([...waIdCandidates('5215512345678')].sort()).toEqual(['525512345678', '5215512345678'].sort())
    expect([...waIdCandidates('525512345678')].sort()).toEqual(['525512345678', '5215512345678'].sort())
    expect([...waIdCandidates('541123456789')].sort()).toEqual(['541123456789', '5491123456789'].sort())
    expect([...waIdCandidates('5511987654321')].sort()).toEqual(['551187654321', '5511987654321'].sort())
    expect(waIdCandidates('573001234567')).toEqual(['573001234567'])
    expect(waIdCandidates('14155552671')).toEqual(['14155552671'])
  })

  it('QC-239 R19 — sin repetidos, y el numero mismo va primero', () => {
    for (const digits of SAMPLE) {
      const candidates = waIdCandidates(digits)
      expect(candidates[0]).toBe(digits)
      expect(new Set(candidates).size).toBe(candidates.length)
    }
  })

  it('QC-239 R19 — una entrada vacia o con algo que no es un digito no da candidatos', () => {
    expect(waIdCandidates('')).toEqual([])
    expect(waIdCandidates('+525512345678')).toEqual([])
    expect(waIdCandidates('52 55 1234 5678')).toEqual([])
  })
})
