// Esquemas de entrada del cliente (`design.md > 6.3`). Cubre R14-R18: nada sin validar cruza
// hacia el dominio, y el blanco se convierte en ausencia antes de llegar al puerto.

import { describe, expect, it, vi } from 'vitest'

import { phoneIssueReason } from '@/lib/modules/clientes/domain/customer-input'

import {
  CUSTOMER_ADDRESS_MAX_LENGTH,
  CUSTOMER_CITY_MAX_LENGTH,
  CUSTOMER_EMAIL_MAX_LENGTH,
  CUSTOMER_FIRST_NAMES_MAX_LENGTH,
  CUSTOMER_LAST_NAMES_MAX_LENGTH,
  CUSTOMER_PHONE_MAX_LENGTH,
  createCustomerSchema,
  updateCustomerSchema,
} from '@/lib/modules/clientes/domain/customer-input'

const VALIDO = {
  firstNames: 'Maria',
  lastNames: 'Perez',
  city: 'Bogota',
  phoneCountry: 'CO',
  phoneNumber: '3001112233',
  email: 'maria@example.com',
  address: 'Calle 1 # 2-3',
}

const ESQUEMAS = [
  ['createCustomerSchema', createCustomerSchema],
  ['updateCustomerSchema', updateCustomerSchema],
] as const

describe('esquemas de entrada del cliente', () => {
  it('R14 — rechaza nombres, apellidos o ciudad ausentes, vacios o en blanco, y recorta los validos', () => {
    for (const [nombre, schema] of ESQUEMAS) {
      for (const campo of ['firstNames', 'lastNames', 'city'] as const) {
        for (const valor of [undefined, null, '', '   ', '\t\n']) {
          expect(
            schema.safeParse({ ...VALIDO, [campo]: valor }).success,
            `${nombre}: ${campo}=${JSON.stringify(valor)} debe rechazarse`,
          ).toBe(false)
        }
      }

      const parsed = schema.parse({
        ...VALIDO,
        firstNames: '  Maria  ',
        lastNames: '  Perez  ',
        city: '  Bogota  ',
      })
      expect(parsed.firstNames).toBe('Maria')
      expect(parsed.lastNames).toBe('Perez')
      expect(parsed.city).toBe('Bogota')
    }
  })

  it('R15 — acepta cualquier combinacion de opcionales ausentes y convierte el blanco en ausencia', () => {
    const AUSENCIAS = [undefined, null, '', '   ', '	']
    for (const [nombre, schema] of ESQUEMAS) {
      for (const phoneNumber of AUSENCIAS) {
        for (const email of AUSENCIAS) {
          for (const address of AUSENCIAS) {
            const parsed = schema.safeParse({ ...VALIDO, phoneNumber, email, address })
            expect(parsed.success, `${nombre} debe aceptar los tres opcionales ausentes`).toBe(true)
            if (parsed.success) {
              expect(parsed.data.phone).toBeNull()
              expect(parsed.data.email).toBeNull()
              expect(parsed.data.address).toBeNull()
            }
          }
        }
      }

      // Con contenido, se recorta.
      const conContenido = schema.parse({
        ...VALIDO,
        email: '  maria@example.com  ',
        address: '  Calle 1  ',
      })
      expect(conContenido.email).toBe('maria@example.com')
      expect(conContenido.address).toBe('Calle 1')
    }
  })

  it('R16 — acepta cada dato en su largo maximo y rechaza uno mas', () => {
    expect(CUSTOMER_FIRST_NAMES_MAX_LENGTH).toBe(80)
    expect(CUSTOMER_LAST_NAMES_MAX_LENGTH).toBe(80)
    expect(CUSTOMER_CITY_MAX_LENGTH).toBe(80)
    expect(CUSTOMER_PHONE_MAX_LENGTH).toBe(40)
    expect(CUSTOMER_EMAIL_MAX_LENGTH).toBe(160)
    expect(CUSTOMER_ADDRESS_MAX_LENGTH).toBe(200)

    const casos = [
      ['firstNames', CUSTOMER_FIRST_NAMES_MAX_LENGTH],
      ['lastNames', CUSTOMER_LAST_NAMES_MAX_LENGTH],
      ['city', CUSTOMER_CITY_MAX_LENGTH],
      ['email', CUSTOMER_EMAIL_MAX_LENGTH],
      ['address', CUSTOMER_ADDRESS_MAX_LENGTH],
    ] as const

    for (const [nombre, schema] of ESQUEMAS) {
      for (const [campo, maximo] of casos) {
        expect(
          schema.safeParse({ ...VALIDO, [campo]: 'a'.repeat(maximo) }).success,
          `${nombre}: ${campo} de largo ${maximo} debe aceptarse`,
        ).toBe(true)
        expect(
          schema.safeParse({ ...VALIDO, [campo]: 'a'.repeat(maximo + 1) }).success,
          `${nombre}: ${campo} de largo ${maximo + 1} debe rechazarse`,
        ).toBe(false)
      }
    }
  })

  it('R17 — acepta como correo cualquier texto dentro del largo', () => {
    for (const [nombre, schema] of ESQUEMAS) {
      expect(
        schema.safeParse({ ...VALIDO, email: 'no-es-un-correo' }).success,
        `${nombre} no debe imponer formato al correo`,
      ).toBe(true)
    }
  })

  it('R18 — las claves ajenas a los seis datos no salen del esquema', () => {
    const repositorio = vi.fn()

    function crear(input: unknown): boolean {
      const parsed = createCustomerSchema.safeParse(input)
      if (!parsed.success) return false
      repositorio(parsed.data)
      return true
    }

    expect(
      crear({
        ...VALIDO,
        companyId: 'ajena',
        createdBy: 'alguien',
        deletedAt: new Date().toISOString(),
        nit: '900123456-7',
      }),
    ).toBe(true)
    expect(Object.keys(repositorio.mock.calls[0]?.[0] as object).sort()).toEqual([
      'address',
      'city',
      'email',
      'firstNames',
      'lastNames',
      'phone',
      'phoneCountry',
      'phoneE164',
      'phoneIssue',
    ])

    for (const input of [{}, null, 'Maria Perez', { firstNames: 'Maria' }]) {
      expect(crear(input), `debe rechazar ${JSON.stringify(input)}`).toBe(false)
    }
  })
})

describe('telefono en el esquema de entrada', () => {
  function razonDe(schema: (typeof ESQUEMAS)[number][1], input: unknown): string | null {
    const parsed = schema.safeParse(input)
    expect(parsed.success).toBe(false)
    return parsed.success ? null : phoneIssueReason(parsed.error)
  }

  it('R11 — un numero valido sale con pais, e164, formato internacional y sin aviso', () => {
    for (const [, schema] of ESQUEMAS) {
      const parsed = schema.parse({ ...VALIDO, phoneCountry: 'CO', phoneNumber: '300 123 4567' })
      expect(parsed).toMatchObject({
        phone: '+57 300 1234567',
        phoneCountry: 'CO',
        phoneE164: '573001234567',
        phoneIssue: null,
      })
    }
  })

  it('R10 — numero vacio o en blanco: los cuatro campos nulos, sea cual sea el pais', () => {
    for (const [, schema] of ESQUEMAS) {
      for (const phoneCountry of ['CO', '', 'ZZ', undefined]) {
        for (const phoneNumber of ['', '   ', undefined, null]) {
          expect(schema.parse({ ...VALIDO, phoneCountry, phoneNumber })).toMatchObject({
            phone: null,
            phoneCountry: null,
            phoneE164: null,
            phoneIssue: null,
          })
        }
      }
    }
  })

  it('R8 — numero sin pais: issue en phoneCountry con reason country_required', () => {
    for (const [, schema] of ESQUEMAS) {
      const parsed = schema.safeParse({ ...VALIDO, phoneCountry: '', phoneNumber: '300 123 4567' })
      expect(parsed.success).toBe(false)
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(['phoneCountry'])
      expect(razonDe(schema, { ...VALIDO, phoneCountry: '', phoneNumber: '300 123 4567' })).toBe(
        'country_required',
      )
    }
  })

  it('R9 — numero no valido para el pais: issue en phoneNumber con reason invalid_number', () => {
    for (const [, schema] of ESQUEMAS) {
      const parsed = schema.safeParse({ ...VALIDO, phoneCountry: 'CO', phoneNumber: '300 12' })
      expect(parsed.success).toBe(false)
      if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(['phoneNumber'])
      expect(razonDe(schema, { ...VALIDO, phoneCountry: 'CO', phoneNumber: '600 123 4567' })).toBe(
        'invalid_number',
      )
    }
  })

  it('R15 — un pais fuera de la lista: issue en phoneCountry con reason invalid_country', () => {
    for (const [, schema] of ESQUEMAS) {
      expect(razonDe(schema, { ...VALIDO, phoneCountry: 'ZZ', phoneNumber: '300 123 4567' })).toBe(
        'invalid_country',
      )
      // Mas de dos caracteres no llega a la lista: es un fallo de forma, sin razon de telefono.
      expect(razonDe(schema, { ...VALIDO, phoneCountry: 'COL', phoneNumber: '300 123 4567' })).toBeNull()
    }
  })

  it('R9 — el numero tiene el mismo largo maximo que el telefono de siempre', () => {
    for (const [, schema] of ESQUEMAS) {
      expect(
        schema.safeParse({ ...VALIDO, phoneNumber: '3'.repeat(CUSTOMER_PHONE_MAX_LENGTH + 1) }).success,
      ).toBe(false)
    }
  })
})
