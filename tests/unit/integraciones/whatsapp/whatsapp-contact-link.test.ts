import { describe, expect, it } from 'vitest'

import {
  resolveContactLink,
  sameContactLink,
  type ContactLink,
} from '@/lib/modules/integraciones/domain/whatsapp-contact-link'

import { ACTOR_ID, CUSTOMER_ID, OTHER_CUSTOMER_ID, THIRD_CUSTOMER_ID } from './whatsapp-doubles'

const SIN_CLIENTE: ContactLink = { customerId: null, linkedBy: null }
const AUTOMATICO: ContactLink = { customerId: CUSTOMER_ID, linkedBy: null }
const MANUAL: ContactLink = { customerId: CUSTOMER_ID, linkedBy: ACTOR_ID }

describe('la regla de vinculo de un contacto', () => {
  it('R15, R22: un contacto sin cliente cuyo numero tiene un solo dueno queda vinculado a el, como automatico', () => {
    expect(resolveContactLink(SIN_CLIENTE, [CUSTOMER_ID])).toEqual({ customerId: CUSTOMER_ID, linkedBy: null })
  })

  it('R16: un contacto sin cliente cuyo numero no tiene dueno se queda sin cliente', () => {
    expect(resolveContactLink(SIN_CLIENTE, [])).toEqual(SIN_CLIENTE)
  })

  it('R16: un contacto sin cliente cuyo numero tiene varios duenos se queda sin cliente', () => {
    expect(resolveContactLink(SIN_CLIENTE, [CUSTOMER_ID, OTHER_CUSTOMER_ID])).toEqual(SIN_CLIENTE)
  })

  it('R15: un vinculo automatico cuyo cliente sigue siendo el unico dueno no cambia', () => {
    expect(resolveContactLink(AUTOMATICO, [CUSTOMER_ID])).toEqual(AUTOMATICO)
  })

  it('R18, R24: un vinculo automatico se pierde cuando el numero pasa a tener varios duenos', () => {
    expect(resolveContactLink(AUTOMATICO, [CUSTOMER_ID, OTHER_CUSTOMER_ID])).toEqual(SIN_CLIENTE)
  })

  it('R18, R24: un vinculo manual se conserva, con quien lo eligio, mientras su cliente siga siendo dueno aunque haya otros', () => {
    expect(resolveContactLink(MANUAL, [OTHER_CUSTOMER_ID, CUSTOMER_ID, THIRD_CUSTOMER_ID])).toEqual(MANUAL)
  })

  it('R18: un vinculo manual cuyo cliente es el unico dueno no se convierte en automatico', () => {
    expect(resolveContactLink(MANUAL, [CUSTOMER_ID])).toEqual(MANUAL)
  })

  it('R23: un vinculo manual cuyo cliente deja de ser dueno pasa al unico dueno que queda, como automatico', () => {
    expect(resolveContactLink(MANUAL, [OTHER_CUSTOMER_ID])).toEqual({ customerId: OTHER_CUSTOMER_ID, linkedBy: null })
  })

  it('R23: un vinculo manual cuyo cliente deja de ser dueno queda sin cliente si quedan varios duenos o ninguno', () => {
    expect(resolveContactLink(MANUAL, [OTHER_CUSTOMER_ID, THIRD_CUSTOMER_ID])).toEqual(SIN_CLIENTE)
    expect(resolveContactLink(MANUAL, [])).toEqual(SIN_CLIENTE)
  })

  it('R23: un vinculo automatico cuyo cliente deja de ser dueno pasa al unico dueno que queda', () => {
    expect(resolveContactLink(AUTOMATICO, [OTHER_CUSTOMER_ID])).toEqual({ customerId: OTHER_CUSTOMER_ID, linkedBy: null })
  })

  it('R17: un cliente dado de baja no esta entre los duenos, asi que hasta su vinculo manual cae', () => {
    const duenosSinElDadoDeBaja: readonly string[] = []
    expect(resolveContactLink(MANUAL, duenosSinElDadoDeBaja)).toEqual(SIN_CLIENTE)
  })

  it('compara dos vinculos por cliente y por quien lo eligio', () => {
    expect(sameContactLink(MANUAL, { ...MANUAL })).toBe(true)
    expect(sameContactLink(MANUAL, AUTOMATICO)).toBe(false)
    expect(sameContactLink(AUTOMATICO, SIN_CLIENTE)).toBe(false)
  })
})
