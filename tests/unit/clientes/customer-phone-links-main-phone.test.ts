// El telefono principal y la vida del cliente que `clientes` ofrece a `integraciones` para enviar
// mensajes, contra un doble en memoria de `CustomerPhoneRepository`. Que la base filtre por empresa
// y por baja lo cubre `customer-phone-numbers.int.test.ts`.

import { describe, expect, it } from 'vitest'

import {
  createCustomerPhoneLinks,
  mainPhoneOfCustomer,
} from '@/lib/modules/clientes/domain/customer-phone-links'

import type { CustomerPhoneLink, CustomerPhoneRepository } from '@/lib/modules/clientes/ports/customer-phone-repository'

const CUSTOMER = '22222222-2222-4222-8222-222222222222'
const COMPANY = '99999999-9999-4999-8999-999999999999'
const SCOPE = { companyId: COMPANY }

const CO_A = '573001234567'
const CO_B = '573109876543'

/** Solo lectura: cualquier escritura del doble falla el test. */
function telefonos(links: readonly Omit<CustomerPhoneLink, 'linkId'>[], vivo = true) {
  const scopes: unknown[] = []
  const prohibido = () => {
    throw new Error('mainPhoneOf/isCustomerAlive no escriben')
  }
  const repo: CustomerPhoneRepository = {
    isAlive: async (_customerId, scope) => {
      scopes.push(scope)
      return vivo
    },
    listAliveLinks: async (_customerId, scope) => {
      scopes.push(scope)
      return links.map((l, i) => ({ linkId: `l${String(i)}`, ...l }))
    },
    addLink: prohibido,
    removeLinks: prohibido,
    setMain: prohibido,
    writeMainMirror: prohibido,
    findAliveOwners: prohibido,
  }
  return { repo, scopes }
}

describe('mainPhoneOfCustomer — el destino de un envio por cliente', () => {
  it('R6, R8: cliente vivo con principal ⇒ { e164 } del principal, no de un secundario', async () => {
    const t = telefonos([
      { e164: CO_B, main: false },
      { e164: CO_A, main: true },
    ])
    expect(await mainPhoneOfCustomer(t.repo, CUSTOMER, SCOPE)).toEqual({ e164: CO_A })
  })

  it('R7: cliente vivo sin ningun telefono ⇒ no_phone', async () => {
    const t = telefonos([])
    expect(await mainPhoneOfCustomer(t.repo, CUSTOMER, SCOPE)).toBe('no_phone')
  })

  it('R7: cliente vivo con solo secundarios (principal quitado o telefono antiguo sin vinculo) ⇒ no_phone', async () => {
    const t = telefonos([{ e164: CO_B, main: false }])
    expect(await mainPhoneOfCustomer(t.repo, CUSTOMER, SCOPE)).toBe('no_phone')
  })

  it('R6: cliente dado de baja, inexistente o de otra empresa (el puerto no lo ve vivo) ⇒ customer_not_found', async () => {
    const t = telefonos([{ e164: CO_A, main: true }], false)
    expect(await mainPhoneOfCustomer(t.repo, CUSTOMER, SCOPE)).toBe('customer_not_found')
  })
})

describe('createCustomerPhoneLinks — mainPhoneOf e isCustomerAlive para otros modulos', () => {
  it('R6: mainPhoneOf pasa la empresa como el ambito de clientes', async () => {
    const t = telefonos([{ e164: CO_A, main: true }])
    const servicio = createCustomerPhoneLinks({ phones: t.repo })

    expect(await servicio.mainPhoneOf(CUSTOMER, COMPANY)).toEqual({ e164: CO_A })
    expect(t.scopes.length).toBeGreaterThan(0)
    for (const scope of t.scopes) expect(scope).toEqual(SCOPE)
  })

  it('R6: mainPhoneOf de un cliente que el puerto no ve vivo ⇒ customer_not_found', async () => {
    const servicio = createCustomerPhoneLinks({ phones: telefonos([], false).repo })
    expect(await servicio.mainPhoneOf(CUSTOMER, COMPANY)).toBe('customer_not_found')
  })

  it('R5: isCustomerAlive responde lo que el puerto dice del cliente en esa empresa', async () => {
    const vivo = telefonos([])
    const muerto = telefonos([], false)

    expect(await createCustomerPhoneLinks({ phones: vivo.repo }).isCustomerAlive(CUSTOMER, COMPANY)).toBe(true)
    expect(await createCustomerPhoneLinks({ phones: muerto.repo }).isCustomerAlive(CUSTOMER, COMPANY)).toBe(false)
    expect(vivo.scopes).toEqual([SCOPE])
  })
})
