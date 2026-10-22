import { describe, expect, it, vi } from 'vitest'

import {
  LinkedCustomerNotFoundError,
  UnauthorizedError,
  ValidationError,
  WhatsappContactNotFoundError,
  WhatsappContactNumberInvalidError,
} from '@/lib/modules/integraciones/domain/errors'
import { createLinkWhatsappContact } from '@/lib/modules/integraciones/domain/link-whatsapp-contact'

import {
  ACTOR_ID,
  COMPANY_ID,
  CONTACT_ID,
  CUSTOMER_ID,
  NOW,
  OTHER_COMPANY_ID,
  OTHER_CONTACT_ID,
  OTHER_CUSTOMER_ID,
  contactRow,
  makeContactRepository,
  makeContactUnitOfWork,
  makeCustomerPhoneLinks,
  makeOwners,
  type ContactDoubleRow,
} from './whatsapp-doubles'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'
import type { CustomerPhoneLinks } from '@/lib/modules/integraciones/ports/customer-phone-links'

const NUMERO = '573001234567'
const SCOPE = { companyId: COMPANY_ID }

function vinculador(overrides: Partial<Actor> = {}): Actor {
  return {
    id: ACTOR_ID,
    companyId: COMPANY_ID,
    permissions: ['clientes.modificar'],
    addons: ['integraciones'],
    ...overrides,
  }
}

function setup(
  contacts: readonly ContactDoubleRow[] = [contactRow({ waId: NUMERO })],
  options: {
    add?: Awaited<ReturnType<CustomerPhoneLinks['addWaId']>>
    phones?: Record<string, Record<string, readonly string[]>>
  } = {},
) {
  const repo = makeContactRepository(contacts)
  const owners = makeOwners(options.phones ?? { [COMPANY_ID]: { [CUSTOMER_ID]: [NUMERO] } })
  const links = makeCustomerPhoneLinks({ add: options.add ?? { numbers: [NUMERO] } })
  const uow = makeContactUnitOfWork({ contacts: repo.contacts, customerPhones: links.customerPhones, owners: owners.owners })
  const link = createLinkWhatsappContact({ unitOfWork: uow.unitOfWork, now: () => NOW })
  return { repo, owners, links, uow, link }
}

/** Una entrada que anota si alguien la leyo. */
function entradaVigilada() {
  const leida = vi.fn()
  const input = new Proxy(
    { contactId: CONTACT_ID, customerId: CUSTOMER_ID },
    {
      get(target, key, receiver) {
        leida(key)
        return Reflect.get(target, key, receiver) as unknown
      },
    },
  )
  return { input, leida }
}

describe('vincular un contacto de WhatsApp con un cliente', () => {
  describe('autorizacion', () => {
    it('R43: sin clientes.modificar responde unauthorized antes de leer la entrada y sin tocar ningun puerto', async () => {
      const { uow, links, repo, link } = setup()
      const { input, leida } = entradaVigilada()

      await expect(link(input, vinculador({ permissions: ['integraciones.modificar'] }))).rejects.toBeInstanceOf(
        UnauthorizedError,
      )

      expect(leida).not.toHaveBeenCalled()
      expect(uow.run).not.toHaveBeenCalled()
      expect(repo.findById).not.toHaveBeenCalled()
      expect(links.addWaId).not.toHaveBeenCalled()
    })

    it('R43: sin actor o con un actor sin empresa responde unauthorized', async () => {
      const { uow, link } = setup()

      await expect(link({ contactId: CONTACT_ID, customerId: CUSTOMER_ID }, null)).rejects.toMatchObject({
        code: 'unauthorized',
      })
      await expect(
        link({ contactId: CONTACT_ID, customerId: CUSTOMER_ID }, vinculador({ companyId: '' })),
      ).rejects.toMatchObject({ code: 'unauthorized' })
      expect(uow.run).not.toHaveBeenCalled()
    })

    it('R44: con el anadido integraciones apagado responde lo mismo que sin permiso y no toca nada', async () => {
      const { uow, link } = setup()
      const { input, leida } = entradaVigilada()

      const sinAnadido = link(input, vinculador({ addons: [] }))
      await expect(sinAnadido).rejects.toBeInstanceOf(UnauthorizedError)
      await expect(link(input, vinculador({ addons: undefined }))).rejects.toMatchObject({ code: 'unauthorized' })

      expect(leida).not.toHaveBeenCalled()
      expect(uow.run).not.toHaveBeenCalled()
    })
  })

  describe('entrada (zod)', () => {
    it('R32: un contactId sin forma de uuid responde whatsapp_contact_not_found sin abrir la unidad de trabajo', async () => {
      const { uow, link } = setup()

      await expect(link({ contactId: 'no-es-uuid', customerId: CUSTOMER_ID }, vinculador())).rejects.toBeInstanceOf(
        WhatsappContactNotFoundError,
      )
      expect(uow.run).not.toHaveBeenCalled()
    })

    it('R31: un customerId sin forma de uuid, o ausente, responde customer_not_found sin abrir la unidad de trabajo', async () => {
      const { uow, link } = setup()

      await expect(link({ contactId: CONTACT_ID, customerId: '42' }, vinculador())).rejects.toBeInstanceOf(
        LinkedCustomerNotFoundError,
      )
      await expect(link({ contactId: CONTACT_ID }, vinculador())).rejects.toMatchObject({ code: 'customer_not_found' })
      expect(uow.run).not.toHaveBeenCalled()
    })

    it('una entrada que no es un objeto responde invalid_input', async () => {
      const { uow, link } = setup()

      await expect(link(null, vinculador())).rejects.toBeInstanceOf(ValidationError)
      await expect(link('contacto', vinculador())).rejects.toMatchObject({ code: 'invalid_input' })
      expect(uow.run).not.toHaveBeenCalled()
    })
  })

  it('R26: deja el contacto con el cliente como vinculo manual y guarda que usuario lo eligio', async () => {
    const { repo, links, uow, link } = setup()

    await link({ contactId: CONTACT_ID, customerId: CUSTOMER_ID }, vinculador())

    expect(uow.run).toHaveBeenCalledTimes(1)
    expect(links.addWaId).toHaveBeenCalledWith(CUSTOMER_ID, NUMERO, ACTOR_ID, NOW, COMPANY_ID)
    expect(repo.setLink).toHaveBeenCalledWith(CONTACT_ID, { customerId: CUSTOMER_ID, linkedBy: ACTOR_ID }, SCOPE)
    expect(repo.row(CONTACT_ID)?.link).toEqual({ customerId: CUSTOMER_ID, linkedBy: ACTOR_ID })
  })

  it('R26: un contacto con vinculo automatico a otro cliente pasa a manual con el elegido', async () => {
    const { repo, link } = setup([contactRow({ waId: NUMERO, link: { customerId: OTHER_CUSTOMER_ID, linkedBy: null } })], {
      phones: { [COMPANY_ID]: { [CUSTOMER_ID]: [NUMERO], [OTHER_CUSTOMER_ID]: [NUMERO] } },
    })

    await link({ contactId: CONTACT_ID, customerId: CUSTOMER_ID }, vinculador())

    expect(repo.row(CONTACT_ID)?.link).toEqual({ customerId: CUSTOMER_ID, linkedBy: ACTOR_ID })
  })

  it('R33: recalcula con los numeros anadidos dentro de la misma unidad de trabajo: el vinculado se conserva y otro automatico del mismo numero queda sin cliente', async () => {
    const { repo, owners, link } = setup(
      [
        contactRow({ waId: NUMERO }),
        contactRow({ id: OTHER_CONTACT_ID, waId: NUMERO, link: { customerId: OTHER_CUSTOMER_ID, linkedBy: null } }),
      ],
      { phones: { [COMPANY_ID]: { [CUSTOMER_ID]: [NUMERO], [OTHER_CUSTOMER_ID]: [NUMERO] } } },
    )

    await link({ contactId: CONTACT_ID, customerId: CUSTOMER_ID }, vinculador())

    expect(repo.findByWaIds).toHaveBeenCalledWith(expect.arrayContaining([NUMERO]), SCOPE)
    expect(owners.ownersOf).toHaveBeenCalled()
    expect(repo.row(CONTACT_ID)?.link).toEqual({ customerId: CUSTOMER_ID, linkedBy: ACTOR_ID })
    expect(repo.row(OTHER_CONTACT_ID)?.link).toEqual({ customerId: null, linkedBy: null })
  })

  it('R29: si el cliente ya tenia el numero, no se recalcula ningun otro contacto', async () => {
    const { repo, link } = setup([contactRow({ waId: NUMERO })], { add: { numbers: [] } })

    await link({ contactId: CONTACT_ID, customerId: CUSTOMER_ID }, vinculador())

    expect(repo.findByWaIds).not.toHaveBeenCalled()
    expect(repo.row(CONTACT_ID)?.link).toEqual({ customerId: CUSTOMER_ID, linkedBy: ACTOR_ID })
  })

  it('R30: si el numero del contacto no es un telefono valido rechaza con whatsapp_contact_number_invalid y no vincula', async () => {
    const { repo, link } = setup([contactRow({ waId: '12' })], { add: 'invalid_number' })

    await expect(link({ contactId: CONTACT_ID, customerId: CUSTOMER_ID }, vinculador())).rejects.toBeInstanceOf(
      WhatsappContactNumberInvalidError,
    )
    expect(repo.setLink).not.toHaveBeenCalled()
    expect(repo.row(CONTACT_ID)?.link).toEqual({ customerId: null, linkedBy: null })
  })

  it('R31: si el cliente no existe, esta dado de baja o es de otra empresa responde customer_not_found y no vincula', async () => {
    const { repo, link } = setup([contactRow({ waId: NUMERO })], { add: 'customer_not_found' })

    const error = await link({ contactId: CONTACT_ID, customerId: OTHER_CUSTOMER_ID }, vinculador()).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(LinkedCustomerNotFoundError)
    expect(error).toMatchObject({ code: 'customer_not_found' })
    expect(repo.setLink).not.toHaveBeenCalled()
  })

  it('R32, R45: un contacto inexistente y uno de otra empresa responden igual, whatsapp_contact_not_found, sin tocar los telefonos', async () => {
    const { links, link } = setup([contactRow({ waId: NUMERO, companyId: OTHER_COMPANY_ID })])

    const deOtraEmpresa = await link({ contactId: CONTACT_ID, customerId: CUSTOMER_ID }, vinculador()).catch(
      (e: unknown) => e,
    )
    const inexistente = await link({ contactId: OTHER_CONTACT_ID, customerId: CUSTOMER_ID }, vinculador()).catch(
      (e: unknown) => e,
    )

    expect(deOtraEmpresa).toBeInstanceOf(WhatsappContactNotFoundError)
    expect(inexistente).toBeInstanceOf(WhatsappContactNotFoundError)
    expect((deOtraEmpresa as Error).message).toBe((inexistente as Error).message)
    expect(links.addWaId).not.toHaveBeenCalled()
  })
})
