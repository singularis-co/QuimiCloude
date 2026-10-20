import { describe, expect, it, vi } from 'vitest'

import { UnauthorizedError, ValidationError, WhatsappContactNotFoundError } from '@/lib/modules/integraciones/domain/errors'
import { createUnlinkWhatsappContact } from '@/lib/modules/integraciones/domain/unlink-whatsapp-contact'

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

const NUMERO = '573001234567'
const SCOPE = { companyId: COMPANY_ID }
const MANUAL = { customerId: CUSTOMER_ID, linkedBy: ACTOR_ID }

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
  contacts: readonly ContactDoubleRow[] = [contactRow({ waId: NUMERO, link: MANUAL })],
  options: { removed?: readonly string[]; phones?: Record<string, Record<string, readonly string[]>> } = {},
) {
  const repo = makeContactRepository(contacts)
  const owners = makeOwners(options.phones ?? { [COMPANY_ID]: {} })
  const links = makeCustomerPhoneLinks({ remove: { numbers: options.removed ?? [NUMERO] } })
  const uow = makeContactUnitOfWork({ contacts: repo.contacts, customerPhones: links.customerPhones, owners: owners.owners })
  const unlink = createUnlinkWhatsappContact({ unitOfWork: uow.unitOfWork, now: () => NOW })
  return { repo, owners, links, uow, unlink }
}

function entradaVigilada() {
  const leida = vi.fn()
  const input = new Proxy(
    { contactId: CONTACT_ID },
    {
      get(target, key, receiver) {
        leida(key)
        return Reflect.get(target, key, receiver) as unknown
      },
    },
  )
  return { input, leida }
}

describe('desvincular un contacto de WhatsApp', () => {
  describe('autorizacion', () => {
    it('R43: sin clientes.modificar responde unauthorized antes de leer la entrada y sin tocar ningun puerto', async () => {
      const { uow, links, unlink } = setup()
      const { input, leida } = entradaVigilada()

      await expect(unlink(input, vinculador({ permissions: [] }))).rejects.toBeInstanceOf(UnauthorizedError)
      await expect(unlink(input, undefined)).rejects.toMatchObject({ code: 'unauthorized' })

      expect(leida).not.toHaveBeenCalled()
      expect(uow.run).not.toHaveBeenCalled()
      expect(links.removeWaId).not.toHaveBeenCalled()
    })

    it('R44: con el anadido integraciones apagado responde lo mismo que sin permiso y no toca nada', async () => {
      const { uow, unlink } = setup()
      const { input, leida } = entradaVigilada()

      await expect(unlink(input, vinculador({ addons: ['documentos'] }))).rejects.toBeInstanceOf(UnauthorizedError)

      expect(leida).not.toHaveBeenCalled()
      expect(uow.run).not.toHaveBeenCalled()
    })
  })

  describe('entrada (zod)', () => {
    it('R32: un contactId sin forma de uuid responde whatsapp_contact_not_found sin abrir la unidad de trabajo', async () => {
      const { uow, unlink } = setup()

      await expect(unlink({ contactId: 'abc' }, vinculador())).rejects.toBeInstanceOf(WhatsappContactNotFoundError)
      await expect(unlink({}, vinculador())).rejects.toMatchObject({ code: 'whatsapp_contact_not_found' })
      expect(uow.run).not.toHaveBeenCalled()
    })

    it('una entrada que no es un objeto responde invalid_input', async () => {
      const { uow, unlink } = setup()

      await expect(unlink(7, vinculador())).rejects.toBeInstanceOf(ValidationError)
      expect(uow.run).not.toHaveBeenCalled()
    })
  })

  it('R34: quita del cliente los telefonos del numero, quita el vinculo y recalcula, en una sola unidad de trabajo', async () => {
    const { repo, links, uow, unlink } = setup()

    await unlink({ contactId: CONTACT_ID }, vinculador())

    expect(uow.run).toHaveBeenCalledTimes(1)
    expect(links.removeWaId).toHaveBeenCalledWith(CUSTOMER_ID, NUMERO, ACTOR_ID, NOW, COMPANY_ID)
    expect(repo.setLink).toHaveBeenCalledWith(CONTACT_ID, { customerId: null, linkedBy: null }, SCOPE)
    expect(repo.findByWaIds).toHaveBeenCalledWith(expect.arrayContaining([NUMERO]), SCOPE)
    expect(repo.row(CONTACT_ID)?.link).toEqual({ customerId: null, linkedBy: null })
  })

  it('R34: si el numero tiene otro dueno unico, la regla pasa el contacto a el como automatico', async () => {
    const { repo, unlink } = setup(undefined, { phones: { [COMPANY_ID]: { [OTHER_CUSTOMER_ID]: [NUMERO] } } })

    await unlink({ contactId: CONTACT_ID }, vinculador())

    expect(repo.row(CONTACT_ID)?.link).toEqual({ customerId: OTHER_CUSTOMER_ID, linkedBy: null })
  })

  it('R34: los demas contactos del numero tambien se desvinculan de ese cliente', async () => {
    const { repo, unlink } = setup([
      contactRow({ waId: NUMERO, link: MANUAL }),
      contactRow({ id: OTHER_CONTACT_ID, waId: NUMERO, link: { customerId: CUSTOMER_ID, linkedBy: null } }),
    ])

    await unlink({ contactId: CONTACT_ID }, vinculador())

    expect(repo.row(OTHER_CONTACT_ID)?.link).toEqual({ customerId: null, linkedBy: null })
  })

  it('R36: un contacto sin cliente no cambia nada y responde exito', async () => {
    const { repo, links, unlink } = setup([contactRow({ waId: NUMERO })])

    await expect(unlink({ contactId: CONTACT_ID }, vinculador())).resolves.toBeUndefined()

    expect(links.removeWaId).not.toHaveBeenCalled()
    expect(repo.setLink).not.toHaveBeenCalled()
    expect(repo.findByWaIds).not.toHaveBeenCalled()
  })

  it('R32, R45: un contacto inexistente y uno de otra empresa responden igual, whatsapp_contact_not_found, sin tocar los telefonos', async () => {
    const { links, unlink } = setup([contactRow({ waId: NUMERO, companyId: OTHER_COMPANY_ID, link: MANUAL })])

    await expect(unlink({ contactId: CONTACT_ID }, vinculador())).rejects.toBeInstanceOf(WhatsappContactNotFoundError)
    await expect(unlink({ contactId: OTHER_CONTACT_ID }, vinculador())).rejects.toBeInstanceOf(
      WhatsappContactNotFoundError,
    )
    expect(links.removeWaId).not.toHaveBeenCalled()
  })
})
