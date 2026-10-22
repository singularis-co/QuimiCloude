// La orquestacion de los telefonos de un cliente (`domain/customer-phone-links.ts`) contra un doble
// en memoria de `CustomerPhoneRepository`. Que la base respete los indices y el ambito lo cubre
// `customer-phone-numbers.int.test.ts`.

import { describe, expect, it } from 'vitest'

import {
  addWaIdToCustomer,
  createCustomerPhoneLinks,
  removeWaIdFromCustomer,
  syncMainPhone,
} from '@/lib/modules/clientes/domain/customer-phone-links'
import { formatPhoneInternational } from '@/lib/modules/clientes/domain/customer-phone'

import type { CustomerPhoneColumns } from '@/lib/modules/clientes/domain/customer-view'
import type { CustomerPhoneLink, CustomerPhoneRepository } from '@/lib/modules/clientes/ports/customer-phone-repository'

const CUSTOMER = '22222222-2222-4222-8222-222222222222'
const ACTOR = '11111111-1111-4111-8111-111111111111'
const SCOPE = { companyId: '99999999-9999-4999-8999-999999999999' }
const NOW = new Date('2026-10-20T12:00:00.000Z')

const CO_A = '573001234567'
const CO_B = '573109876543'
const CO_C = '573157654321'
const MX_CORTO = '525512345678'
const MX_CON_UNO = '5215512345678'

type Llamada = readonly [string, ...unknown[]]

/** Doble con estado: los vinculos vivos del cliente y el registro de cada escritura. */
function telefonos(inicial: readonly { readonly e164: string; readonly main: boolean }[] = [], vivo = true) {
  let seq = 0
  const links: CustomerPhoneLink[] = inicial.map((l) => ({ linkId: `l${String((seq += 1))}`, ...l }))
  const llamadas: Llamada[] = []
  const espejo: { valor: CustomerPhoneColumns | null | undefined } = { valor: undefined }

  const repo: CustomerPhoneRepository = {
    isAlive: async (...args) => {
      llamadas.push(['isAlive', ...args])
      return vivo
    },
    listAliveLinks: async () => links.map((l) => ({ ...l })),
    addLink: async (customerId, e164, main, now, scope) => {
      llamadas.push(['addLink', customerId, e164, main, now, scope])
      links.push({ linkId: `l${String((seq += 1))}`, e164, main })
    },
    removeLinks: async (linkIds, now, scope) => {
      llamadas.push(['removeLinks', [...linkIds], now, scope])
      for (const id of linkIds) links.splice(links.findIndex((l) => l.linkId === id), 1)
    },
    setMain: async (linkId, main, now, scope) => {
      llamadas.push(['setMain', linkId, main, now, scope])
      const i = links.findIndex((l) => l.linkId === linkId)
      const link = links[i]
      if (link !== undefined) links[i] = { ...link, main }
    },
    writeMainMirror: async (customerId, mirror, actorId, now, scope) => {
      llamadas.push(['writeMainMirror', customerId, mirror, actorId, now, scope])
      espejo.valor = mirror
    },
    findAliveOwners: async (...args) => {
      llamadas.push(['findAliveOwners', ...args])
      return [CUSTOMER]
    },
  }

  const escrituras = (): readonly string[] => llamadas.map(([n]) => n).filter((n) => n !== 'isAlive' && n !== 'findAliveOwners')
  const estado = () => links.map(({ e164, main }) => ({ e164, main }))
  return { repo, llamadas, escrituras, estado, espejo, links }
}

describe('syncMainPhone — el principal del formulario', () => {
  it('R10 — cambiar el numero deja el anterior como secundario y el nuevo como principal, y devuelve solo el nuevo', async () => {
    const t = telefonos([{ e164: CO_A, main: true }])

    const numeros = await syncMainPhone(t.repo, CUSTOMER, CO_B, NOW, SCOPE)

    expect(numeros).toEqual([CO_B])
    expect(t.estado()).toEqual([
      { e164: CO_A, main: false },
      { e164: CO_B, main: true },
    ])
    expect(t.escrituras()).toEqual(['setMain', 'addLink'])
    expect(t.llamadas[0]).toEqual(['setMain', 'l1', false, NOW, SCOPE])
  })

  it('R10 — si el numero nuevo ya era un secundario, se promueve tras degradar el principal y no devuelve ningun numero', async () => {
    const t = telefonos([
      { e164: CO_A, main: true },
      { e164: CO_B, main: false },
    ])

    const numeros = await syncMainPhone(t.repo, CUSTOMER, CO_B, NOW, SCOPE)

    expect(numeros).toEqual([])
    expect(t.llamadas).toEqual([
      ['setMain', 'l1', false, NOW, SCOPE],
      ['setMain', 'l2', true, NOW, SCOPE],
    ])
    expect(t.estado()).toEqual([
      { e164: CO_A, main: false },
      { e164: CO_B, main: true },
    ])
  })

  it('R10 — un cliente sin principal que recibe numero solo crea el principal', async () => {
    const t = telefonos([{ e164: CO_C, main: false }])

    expect(await syncMainPhone(t.repo, CUSTOMER, CO_A, NOW, SCOPE)).toEqual([CO_A])
    expect(t.llamadas).toEqual([['addLink', CUSTOMER, CO_A, true, NOW, SCOPE]])
  })

  it('R11 — vaciar el numero quita el principal (borrado logico por el puerto) y devuelve ese numero; los secundarios se quedan', async () => {
    const t = telefonos([
      { e164: CO_A, main: true },
      { e164: CO_B, main: false },
    ])

    const numeros = await syncMainPhone(t.repo, CUSTOMER, null, NOW, SCOPE)

    expect(numeros).toEqual([CO_A])
    expect(t.llamadas).toEqual([['removeLinks', ['l1'], NOW, SCOPE]])
    expect(t.estado()).toEqual([{ e164: CO_B, main: false }])
  })

  it('R11 — vaciar el numero de un cliente sin principal (telefono antiguo o sin telefono) no cambia ningun vinculo', async () => {
    const t = telefonos([{ e164: CO_B, main: false }])

    expect(await syncMainPhone(t.repo, CUSTOMER, null, NOW, SCOPE)).toEqual([])
    expect(t.escrituras()).toEqual([])
  })

  it('R12 — guardar el mismo numero no cambia ningun vinculo', async () => {
    const t = telefonos([
      { e164: CO_A, main: true },
      { e164: CO_B, main: false },
    ])

    expect(await syncMainPhone(t.repo, CUSTOMER, CO_A, NOW, SCOPE)).toEqual([])
    expect(t.escrituras()).toEqual([])
  })
})

describe('addWaIdToCustomer — vincular anade el numero al cliente', () => {
  it('R27, R28 — sin principal, el numero entra como principal y el cliente muestra ese telefono con su pais', async () => {
    const t = telefonos()

    const r = await addWaIdToCustomer(t.repo, { customerId: CUSTOMER, waId: CO_A, actorId: ACTOR, now: NOW }, SCOPE)

    expect(r).toEqual({ numbers: [CO_A] })
    expect(t.estado()).toEqual([{ e164: CO_A, main: true }])
    expect(t.espejo.valor).toEqual({
      phone: formatPhoneInternational(CO_A),
      phoneCountry: 'CO',
      phoneE164: CO_A,
      phoneIssue: null,
    })
    expect(t.llamadas.find(([n]) => n === 'writeMainMirror')).toEqual([
      'writeMainMirror',
      CUSTOMER,
      t.espejo.valor,
      ACTOR,
      NOW,
      SCOPE,
    ])
  })

  it('R27 — con principal, el numero entra como secundario y no se toca lo que el cliente muestra', async () => {
    const t = telefonos([{ e164: CO_B, main: true }])

    const r = await addWaIdToCustomer(t.repo, { customerId: CUSTOMER, waId: CO_A, actorId: ACTOR, now: NOW }, SCOPE)

    expect(r).toEqual({ numbers: [CO_A] })
    expect(t.estado()).toEqual([
      { e164: CO_B, main: true },
      { e164: CO_A, main: false },
    ])
    expect(t.escrituras()).toEqual(['addLink'])
  })

  it('R29 — si el cliente ya tiene un telefono que coincide (variante de Mexico), no anade otro ni cambia el principal', async () => {
    const t = telefonos([
      { e164: CO_B, main: true },
      { e164: MX_CORTO, main: false },
    ])

    const r = await addWaIdToCustomer(t.repo, { customerId: CUSTOMER, waId: MX_CON_UNO, actorId: ACTOR, now: NOW }, SCOPE)

    expect(r).toEqual({ numbers: [] })
    expect(t.escrituras()).toEqual([])
  })

  it('R30 — un wa_id que no es telefono valido en ninguna variante se rechaza sin escribir nada', async () => {
    const t = telefonos()

    const r = await addWaIdToCustomer(t.repo, { customerId: CUSTOMER, waId: '1234', actorId: ACTOR, now: NOW }, SCOPE)

    expect(r).toBe('invalid_number')
    expect(t.escrituras()).toEqual([])
  })

  it('R31 — un cliente que no esta vivo en la empresa responde customer_not_found sin leer sus telefonos ni escribir', async () => {
    const t = telefonos([], false)
    let leidos = 0
    const repo: CustomerPhoneRepository = {
      ...t.repo,
      listAliveLinks: async (...args) => {
        leidos += 1
        return t.repo.listAliveLinks(...args)
      },
    }

    const r = await addWaIdToCustomer(repo, { customerId: CUSTOMER, waId: CO_A, actorId: ACTOR, now: NOW }, SCOPE)

    expect(r).toBe('customer_not_found')
    expect(leidos).toBe(0)
    expect(t.escrituras()).toEqual([])
    expect(t.llamadas).toEqual([['isAlive', CUSTOMER, SCOPE]])
  })
})

describe('removeWaIdFromCustomer — desvincular quita el numero del cliente', () => {
  it('R34 — quita todos los telefonos que coinciden con el contacto, variantes incluidas, y devuelve sus numeros', async () => {
    const t = telefonos([
      { e164: CO_B, main: true },
      { e164: MX_CORTO, main: false },
      { e164: MX_CON_UNO, main: false },
    ])

    const r = await removeWaIdFromCustomer(t.repo, { customerId: CUSTOMER, waId: MX_CON_UNO, actorId: ACTOR, now: NOW }, SCOPE)

    expect(r).toEqual({ numbers: [MX_CORTO, MX_CON_UNO] })
    expect(t.llamadas).toEqual([['removeLinks', ['l2', 'l3'], NOW, SCOPE]])
    expect(t.estado()).toEqual([{ e164: CO_B, main: true }])
  })

  it('R35 — si el telefono quitado era el principal, el cliente queda sin principal ni telefono mostrado y ningun secundario se promueve', async () => {
    const t = telefonos([
      { e164: CO_A, main: true },
      { e164: CO_B, main: false },
    ])

    const r = await removeWaIdFromCustomer(t.repo, { customerId: CUSTOMER, waId: CO_A, actorId: ACTOR, now: NOW }, SCOPE)

    expect(r).toEqual({ numbers: [CO_A] })
    expect(t.estado()).toEqual([{ e164: CO_B, main: false }])
    expect(t.escrituras()).toEqual(['removeLinks', 'writeMainMirror'])
    expect(t.llamadas[1]).toEqual(['writeMainMirror', CUSTOMER, null, ACTOR, NOW, SCOPE])
  })

  it('R34 — sin ningun telefono que coincida no escribe nada', async () => {
    const t = telefonos([{ e164: CO_B, main: true }])

    const r = await removeWaIdFromCustomer(t.repo, { customerId: CUSTOMER, waId: CO_A, actorId: ACTOR, now: NOW }, SCOPE)

    expect(r).toEqual({ numbers: [] })
    expect(t.escrituras()).toEqual([])
  })
})

describe('createCustomerPhoneLinks — el servicio para otros modulos', () => {
  it('R45 — la empresa que recibe como cadena llega al puerto como el ambito de clientes', async () => {
    const t = telefonos()
    const servicio = createCustomerPhoneLinks({ phones: t.repo })

    await servicio.addWaId(CUSTOMER, CO_A, ACTOR, NOW, SCOPE.companyId)
    await servicio.removeWaId(CUSTOMER, CO_A, ACTOR, NOW, SCOPE.companyId)
    expect(await servicio.ownersOf(CO_A, SCOPE.companyId)).toEqual([CUSTOMER])

    for (const llamada of t.llamadas) expect(llamada[llamada.length - 1]).toEqual(SCOPE)
  })
})
