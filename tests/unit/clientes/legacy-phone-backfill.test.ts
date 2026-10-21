// El relleno de los telefonos antiguos: `planLegacyPhoneBackfill` (puro) y el caso de uso
// `createBackfillLegacyPhones` con sus puertos simulados. Sin base de datos.

import { describe, expect, it, vi } from 'vitest'

import {
  createBackfillLegacyPhones,
  planLegacyPhoneBackfill,
  type LegacyPhonePlan,
  type LegacyPhoneRow,
} from '@/lib/modules/clientes'

function fila(id: string, phone: string, phoneCountry: 'CO' | 'MX' | null = null): LegacyPhoneRow {
  return { id, phone, phoneCountry }
}

describe('planLegacyPhoneBackfill', () => {
  it('R24 — un numero valido para el pais de la empresa sale con su pais y su phone_e164 en digitos', () => {
    const plan = planLegacyPhoneBackfill([fila('a', '300 123 4567'), fila('b', '(310) 765-4321')], 'CO')
    expect(plan).toEqual([
      { id: 'a', phoneCountry: 'CO', phoneE164: '573001234567', phoneIssue: null },
      { id: 'b', phoneCountry: 'CO', phoneE164: '573107654321', phoneIssue: null },
    ])
  })

  it('R24 — un texto con + de otro pais se queda con el pais del numero, no con el de la empresa', () => {
    const plan = planLegacyPhoneBackfill([fila('a', '+593 99 123 4567')], 'CO')
    expect(plan).toEqual([{ id: 'a', phoneCountry: 'EC', phoneE164: '593991234567', phoneIssue: null }])
  })

  it('R24 — el pais por defecto es el que se le pasa (la empresa o CO)', () => {
    const plan = planLegacyPhoneBackfill([fila('a', '55 1234 5678')], 'MX')
    expect(plan[0]).toMatchObject({ phoneCountry: 'MX', phoneIssue: null })
    expect(plan[0]?.phoneE164?.startsWith('52')).toBe(true)
  })

  it('R25 — lo que no se puede interpretar queda sin phone_e164, con el pais usado y invalid_format', () => {
    const plan = planLegacyPhoneBackfill(
      [fila('a', 'llamar a la tarde'), fila('b', '300 12'), fila('c', '')],
      'CO',
    )
    expect(plan).toEqual([
      { id: 'a', phoneCountry: 'CO', phoneE164: null, phoneIssue: 'invalid_format' },
      { id: 'b', phoneCountry: 'CO', phoneE164: null, phoneIssue: 'invalid_format' },
      { id: 'c', phoneCountry: 'CO', phoneE164: null, phoneIssue: 'invalid_format' },
    ])
  })

  it('R13 — varias filas con el mismo numero salen TODAS con su phone_e164, sin duplicate', () => {
    const plan = planLegacyPhoneBackfill(
      [fila('z-viejo', '300 123 4567'), fila('a-nuevo', '+57 300 123 4567'), fila('m-medio', '3001234567')],
      'CO',
    )
    expect(plan).toEqual([
      { id: 'z-viejo', phoneCountry: 'CO', phoneE164: '573001234567', phoneIssue: null },
      { id: 'a-nuevo', phoneCountry: 'CO', phoneE164: '573001234567', phoneIssue: null },
      { id: 'm-medio', phoneCountry: 'CO', phoneE164: '573001234567', phoneIssue: null },
    ])
  })

  it('R13 — ningun resultado sale con phone_issue duplicate', () => {
    const filas = [fila('a', '300 123 4567'), fila('b', '300 123 4567'), fila('c', 'x'), fila('d', '310 765 4321', 'CO')]
    for (const o of planLegacyPhoneBackfill(filas, 'CO')) expect([null, 'invalid_format']).toContain(o.phoneIssue)
  })

  it('R49 — una fila con su propio pais se lee con el suyo, no con el de la empresa', () => {
    const plan = planLegacyPhoneBackfill([fila('a', '55 1234 5678', 'MX'), fila('b', '300 123 4567', null)], 'CO')
    expect(plan[0]).toMatchObject({ id: 'a', phoneCountry: 'MX', phoneIssue: null })
    expect(plan[0]?.phoneE164?.startsWith('52')).toBe(true)
    expect(plan[1]).toEqual({ id: 'b', phoneCountry: 'CO', phoneE164: '573001234567', phoneIssue: null })
  })

  it('R49 — una fila con pais propio cuyo texto ya no es valido sale invalid_format con ese pais', () => {
    const plan = planLegacyPhoneBackfill([fila('a', '300 12', 'MX')], 'CO')
    expect(plan).toEqual([{ id: 'a', phoneCountry: 'MX', phoneE164: null, phoneIssue: 'invalid_format' }])
  })

  it('R27 — sin filas devuelve una lista vacia y el resultado no depende del orden de entrada', () => {
    expect(planLegacyPhoneBackfill([], 'CO')).toEqual([])
    const filas = [fila('a', '300 123 4567'), fila('b', '55 1234 5678', 'MX'), fila('c', 'x')]
    const ida = planLegacyPhoneBackfill(filas, 'CO')
    const vuelta = planLegacyPhoneBackfill([...filas].reverse(), 'CO')
    const porId = (lista: typeof ida) => [...lista].sort((x, y) => x.id.localeCompare(y.id))
    expect(porId(vuelta)).toEqual(porId(ida))
  })
})

describe('createBackfillLegacyPhones', () => {
  function puertos(paises: Record<string, 'CO' | 'MX' | null>) {
    const vistos: { companyId: string; resultado: ReturnType<LegacyPhonePlan> }[] = []
    const filasPorEmpresa: Record<string, LegacyPhoneRow[]> = {
      'empresa-mx': [fila('a', '55 1234 5678')],
      'empresa-sin-pais': [fila('b', '300 123 4567'), fila('c', 'nada')],
    }
    const legacyPhones = {
      processCompany: vi.fn(async (plan: LegacyPhonePlan, scope: { readonly companyId: string }) => {
        const resultado = plan(filasPorEmpresa[scope.companyId] ?? [])
        vistos.push({ companyId: scope.companyId, resultado })
        return {
          converted: resultado.filter((o) => o.phoneIssue === null).length,
          invalid: resultado.filter((o) => o.phoneIssue === 'invalid_format').length,
          reconverted: 0,
        }
      }),
    }
    const companyCountryOf = vi.fn(async (companyId: string) => paises[companyId] ?? null)
    return { legacyPhones, companyCountryOf, vistos }
  }

  it('R24 — usa el pais de cada empresa y CO cuando la empresa no tiene, una empresa por llamada al puerto', async () => {
    const { legacyPhones, companyCountryOf, vistos } = puertos({ 'empresa-mx': 'MX', 'empresa-sin-pais': null })
    const backfill = createBackfillLegacyPhones({
      listCompanyIds: async () => ['empresa-mx', 'empresa-sin-pais'],
      legacyPhones,
      companyCountryOf,
    })

    const resumen = await backfill()

    expect(legacyPhones.processCompany).toHaveBeenCalledTimes(2)
    expect(legacyPhones.processCompany.mock.calls.map((c) => c[1])).toEqual([
      { companyId: 'empresa-mx' },
      { companyId: 'empresa-sin-pais' },
    ])
    expect(vistos[0]?.resultado[0]).toMatchObject({ phoneCountry: 'MX', phoneIssue: null })
    expect(vistos[1]?.resultado).toEqual([
      { id: 'b', phoneCountry: 'CO', phoneE164: '573001234567', phoneIssue: null },
      { id: 'c', phoneCountry: 'CO', phoneE164: null, phoneIssue: 'invalid_format' },
    ])
    expect(resumen).toEqual({ companies: 2, converted: 2, invalid: 1, reconverted: 0 })
  })

  it('R24 — el caso de uso solo procesa las empresas que da listCompanyIds', async () => {
    // `empresa-sin-pais` tiene filas pendientes, pero no esta en la lista (una empresa desactivada).
    const { legacyPhones, companyCountryOf, vistos } = puertos({ 'empresa-mx': 'MX', 'empresa-sin-pais': null })
    const listCompanyIds = vi.fn(async () => ['empresa-mx'])
    const backfill = createBackfillLegacyPhones({ listCompanyIds, legacyPhones, companyCountryOf })

    const resumen = await backfill()

    expect(listCompanyIds).toHaveBeenCalledTimes(1)
    expect(legacyPhones.processCompany.mock.calls.map((c) => c[1])).toEqual([{ companyId: 'empresa-mx' }])
    expect(companyCountryOf.mock.calls.map((c) => c[0])).toEqual(['empresa-mx'])
    expect(vistos.map((v) => v.companyId)).toEqual(['empresa-mx'])
    expect(resumen).toEqual({ companies: 1, converted: 1, invalid: 0, reconverted: 0 })
  })

  it('R27 — sin empresas termina sin error y con el resumen a cero', async () => {
    const { legacyPhones, companyCountryOf } = puertos({})
    const backfill = createBackfillLegacyPhones({ listCompanyIds: async () => [], legacyPhones, companyCountryOf })
    await expect(backfill()).resolves.toEqual({ companies: 0, converted: 0, invalid: 0, reconverted: 0 })
    expect(legacyPhones.processCompany).not.toHaveBeenCalled()
  })

  it('R49 — suma los reconvertidos que devuelve el puerto de cada empresa', async () => {
    const processCompany = vi
      .fn()
      .mockResolvedValueOnce({ converted: 1, invalid: 0, reconverted: 2 })
      .mockResolvedValueOnce({ converted: 0, invalid: 1, reconverted: 3 })
    const backfill = createBackfillLegacyPhones({
      listCompanyIds: async () => ['empresa-1', 'empresa-2'],
      legacyPhones: { processCompany },
      companyCountryOf: async () => 'CO',
    })
    await expect(backfill()).resolves.toEqual({ companies: 2, converted: 1, invalid: 1, reconverted: 5 })
  })

  it('R28 — un fallo de una empresa se propaga: el build tiene que fallar', async () => {
    const backfill = createBackfillLegacyPhones({
      listCompanyIds: async () => ['empresa-1'],
      legacyPhones: { processCompany: vi.fn().mockRejectedValue(new Error('conexion cerrada')) },
      companyCountryOf: async () => 'CO',
    })
    await expect(backfill()).rejects.toThrow('conexion cerrada')
  })
})
