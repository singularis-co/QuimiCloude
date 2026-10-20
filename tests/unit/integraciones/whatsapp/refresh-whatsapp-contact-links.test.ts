import { describe, expect, it } from 'vitest'

import { createRefreshWhatsappContactLinks } from '@/lib/modules/integraciones/domain/refresh-whatsapp-contact-links'

import {
  ACTOR_ID,
  COMPANY_ID,
  CONTACT_ID,
  CUSTOMER_ID,
  OTHER_COMPANY_ID,
  OTHER_CONTACT_ID,
  OTHER_CUSTOMER_ID,
  contactRow,
  makeContactRepository,
  makeOwners,
  type ContactDoubleRow,
} from './whatsapp-doubles'

const NUMERO = '573001234567'
const OTRO_NUMERO = '573109876543'
const SCOPE = { companyId: COMPANY_ID }

function setup(contacts: readonly ContactDoubleRow[], phones: Record<string, Record<string, readonly string[]>>) {
  const repo = makeContactRepository(contacts)
  const owners = makeOwners(phones)
  const refresh = createRefreshWhatsappContactLinks({ contacts: repo.contacts, owners: owners.owners })
  return { repo, owners, refresh }
}

describe('recalcular los vinculos de los contactos tras un cambio de telefonos', () => {
  it('R25: sin numeros anadidos ni quitados no lee ni modifica ningun contacto', async () => {
    const { repo, owners, refresh } = setup([contactRow({ waId: NUMERO })], {
      [COMPANY_ID]: { [CUSTOMER_ID]: [NUMERO] },
    })

    await refresh([], SCOPE)

    expect(repo.findByWaIds).not.toHaveBeenCalled()
    expect(owners.ownersOf).not.toHaveBeenCalled()
    expect(repo.setLink).not.toHaveBeenCalled()
    expect(repo.row(CONTACT_ID)?.link).toEqual({ customerId: null, linkedBy: null })
  })

  it('R21, R22: un contacto sin cliente cuyo numero pasa a tener un unico dueno queda vinculado a el como automatico', async () => {
    const { repo, refresh } = setup([contactRow({ waId: NUMERO })], {
      [COMPANY_ID]: { [CUSTOMER_ID]: [NUMERO] },
    })

    await refresh([NUMERO], SCOPE)

    expect(repo.row(CONTACT_ID)?.link).toEqual({ customerId: CUSTOMER_ID, linkedBy: null })
    expect(repo.setLink).toHaveBeenCalledWith(CONTACT_ID, { customerId: CUSTOMER_ID, linkedBy: null }, SCOPE)
  })

  it('R21: busca los contactos por todas las variantes del numero cambiado (Mexico con y sin el 1)', async () => {
    const { repo, refresh } = setup([contactRow({ waId: '5215512345678' })], {
      [COMPANY_ID]: { [CUSTOMER_ID]: ['525512345678'] },
    })

    await refresh(['525512345678'], SCOPE)

    const [buscados] = repo.findByWaIds.mock.calls[0] ?? []
    expect(buscados).toEqual(expect.arrayContaining(['525512345678', '5215512345678']))
    expect(repo.row(CONTACT_ID)?.link).toEqual({ customerId: CUSTOMER_ID, linkedBy: null })
  })

  it('R21: solo toca los contactos cuyo numero coincide con alguno de los cambiados', async () => {
    const { repo, owners, refresh } = setup(
      [contactRow({ waId: NUMERO }), contactRow({ id: OTHER_CONTACT_ID, waId: OTRO_NUMERO })],
      { [COMPANY_ID]: { [CUSTOMER_ID]: [NUMERO, OTRO_NUMERO] } },
    )

    await refresh([NUMERO], SCOPE)

    expect(owners.ownersOf).toHaveBeenCalledTimes(1)
    expect(repo.row(OTHER_CONTACT_ID)?.link).toEqual({ customerId: null, linkedBy: null })
  })

  it('R23: al quitar un numero de un cliente, su contacto con vinculo manual pasa al unico dueno que queda, como automatico', async () => {
    const { repo, refresh } = setup(
      [contactRow({ waId: NUMERO, link: { customerId: CUSTOMER_ID, linkedBy: ACTOR_ID } })],
      { [COMPANY_ID]: { [OTHER_CUSTOMER_ID]: [NUMERO] } },
    )

    await refresh([NUMERO], SCOPE)

    expect(repo.row(CONTACT_ID)?.link).toEqual({ customerId: OTHER_CUSTOMER_ID, linkedBy: null })
  })

  it('R23: al quitar el numero de su unico dueno, los contactos de ese numero quedan sin cliente, manual o automatico', async () => {
    const { repo, refresh } = setup(
      [
        contactRow({ waId: NUMERO, link: { customerId: CUSTOMER_ID, linkedBy: ACTOR_ID } }),
        contactRow({ id: OTHER_CONTACT_ID, waId: NUMERO, link: { customerId: CUSTOMER_ID, linkedBy: null } }),
      ],
      { [COMPANY_ID]: {} },
    )

    await refresh([NUMERO], SCOPE)

    expect(repo.row(CONTACT_ID)?.link).toEqual({ customerId: null, linkedBy: null })
    expect(repo.row(OTHER_CONTACT_ID)?.link).toEqual({ customerId: null, linkedBy: null })
  })

  it('R24: cuando otro cliente anade el numero, el contacto con vinculo automatico queda sin cliente y el manual se conserva', async () => {
    const { repo, refresh } = setup(
      [
        contactRow({ waId: NUMERO, link: { customerId: CUSTOMER_ID, linkedBy: null } }),
        contactRow({ id: OTHER_CONTACT_ID, waId: NUMERO, link: { customerId: CUSTOMER_ID, linkedBy: ACTOR_ID } }),
      ],
      { [COMPANY_ID]: { [CUSTOMER_ID]: [NUMERO], [OTHER_CUSTOMER_ID]: [NUMERO] } },
    )

    await refresh([NUMERO], SCOPE)

    expect(repo.row(CONTACT_ID)?.link).toEqual({ customerId: null, linkedBy: null })
    expect(repo.row(OTHER_CONTACT_ID)?.link).toEqual({ customerId: CUSTOMER_ID, linkedBy: ACTOR_ID })
    expect(repo.setLink).toHaveBeenCalledTimes(1)
  })

  it('R21: un contacto cuyo vinculo ya es el que da la regla no se escribe', async () => {
    const { repo, refresh } = setup([contactRow({ waId: NUMERO, link: { customerId: CUSTOMER_ID, linkedBy: null } })], {
      [COMPANY_ID]: { [CUSTOMER_ID]: [NUMERO] },
    })

    await refresh([NUMERO], SCOPE)

    expect(repo.setLink).not.toHaveBeenCalled()
  })

  it('R21: los duenos se piden con la empresa del ambito y un contacto de otra empresa no se toca', async () => {
    const { repo, owners, refresh } = setup(
      [contactRow({ waId: NUMERO }), contactRow({ id: OTHER_CONTACT_ID, companyId: OTHER_COMPANY_ID, waId: NUMERO })],
      { [COMPANY_ID]: { [CUSTOMER_ID]: [NUMERO] }, [OTHER_COMPANY_ID]: { [OTHER_CUSTOMER_ID]: [NUMERO] } },
    )

    await refresh([NUMERO], SCOPE)

    expect(owners.ownersOf.mock.calls.map(([, companyId]) => companyId)).toEqual([COMPANY_ID])
    expect(repo.row(CONTACT_ID)?.link).toEqual({ customerId: CUSTOMER_ID, linkedBy: null })
    expect(repo.row(OTHER_CONTACT_ID)?.link).toEqual({ customerId: null, linkedBy: null })
  })
})
