import { describe, expect, it, vi } from 'vitest'

import { UnauthorizedError, ValidationError, WhatsappContactNotFoundError } from '@/lib/modules/integraciones/domain/errors'
import { createSetWhatsappContactBlocked } from '@/lib/modules/integraciones/domain/set-whatsapp-contact-blocked'

import {
  ACTOR_ID,
  COMPANY_ID,
  CONTACT_ID,
  CUSTOMER_ID,
  NOW,
  OTHER_COMPANY_ID,
  OTHER_CONTACT_ID,
  contactRow,
  makeContactRepository,
  type ContactDoubleRow,
} from './whatsapp-doubles'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'

const SCOPE = { companyId: COMPANY_ID }
const ANTES = new Date('2026-10-01T08:00:00.000Z')
const OTRO_USUARIO = '00000000-0000-4000-8000-0000000000c9'

function vinculador(overrides: Partial<Actor> = {}): Actor {
  return {
    id: ACTOR_ID,
    companyId: COMPANY_ID,
    permissions: ['clientes.modificar'],
    addons: ['integraciones'],
    ...overrides,
  }
}

function setup(contacts: readonly ContactDoubleRow[] = [contactRow()]) {
  const repo = makeContactRepository(contacts)
  const setBlocked = createSetWhatsappContactBlocked({ contacts: repo.contacts, now: () => NOW })
  return { repo, setBlocked }
}

function entradaVigilada(blocked: boolean) {
  const leida = vi.fn()
  const input = new Proxy(
    { contactId: CONTACT_ID, blocked },
    {
      get(target, key, receiver) {
        leida(key)
        return Reflect.get(target, key, receiver) as unknown
      },
    },
  )
  return { input, leida }
}

describe('bloquear y desbloquear un contacto de WhatsApp', () => {
  describe('autorizacion', () => {
    it.each([true, false])(
      'R43: sin clientes.modificar responde unauthorized antes de leer la entrada y sin tocar el contacto (blocked=%s)',
      async (blocked) => {
        const { repo, setBlocked } = setup()
        const { input, leida } = entradaVigilada(blocked)

        await expect(setBlocked(input, vinculador({ permissions: ['clientes.ver'] }))).rejects.toBeInstanceOf(
          UnauthorizedError,
        )
        await expect(setBlocked(input, null)).rejects.toMatchObject({ code: 'unauthorized' })

        expect(leida).not.toHaveBeenCalled()
        expect(repo.setBlocked).not.toHaveBeenCalled()
      },
    )

    it.each([true, false])(
      'R44: con el anadido integraciones apagado responde lo mismo que sin permiso (blocked=%s)',
      async (blocked) => {
        const { repo, setBlocked } = setup()
        const { input, leida } = entradaVigilada(blocked)

        await expect(setBlocked(input, vinculador({ addons: undefined }))).rejects.toBeInstanceOf(UnauthorizedError)

        expect(leida).not.toHaveBeenCalled()
        expect(repo.setBlocked).not.toHaveBeenCalled()
      },
    )
  })

  describe('entrada (zod)', () => {
    it('R32: un contactId sin forma de uuid responde whatsapp_contact_not_found sin tocar el contacto', async () => {
      const { repo, setBlocked } = setup()

      await expect(setBlocked({ contactId: 'x', blocked: true }, vinculador())).rejects.toBeInstanceOf(
        WhatsappContactNotFoundError,
      )
      expect(repo.setBlocked).not.toHaveBeenCalled()
    })

    it('un blocked que no es booleano, o una entrada que no es un objeto, responde invalid_input', async () => {
      const { repo, setBlocked } = setup()

      await expect(setBlocked({ contactId: CONTACT_ID, blocked: 'true' }, vinculador())).rejects.toBeInstanceOf(
        ValidationError,
      )
      await expect(setBlocked({ contactId: CONTACT_ID }, vinculador())).rejects.toMatchObject({ code: 'invalid_input' })
      await expect(setBlocked(undefined, vinculador())).rejects.toMatchObject({ code: 'invalid_input' })
      expect(repo.setBlocked).not.toHaveBeenCalled()
    })
  })

  it('R37: bloquear marca el contacto con la fecha y el usuario', async () => {
    const { repo, setBlocked } = setup()

    await setBlocked({ contactId: CONTACT_ID, blocked: true }, vinculador())

    expect(repo.setBlocked).toHaveBeenCalledWith(CONTACT_ID, { at: NOW, by: ACTOR_ID }, SCOPE)
    expect(repo.row(CONTACT_ID)?.blocked).toEqual({ at: NOW, by: ACTOR_ID })
  })

  it('R37: bloquear un contacto ya bloqueado responde exito y conserva la marca original', async () => {
    const original = { at: ANTES, by: OTRO_USUARIO }
    const { repo, setBlocked } = setup([contactRow({ blocked: original })])

    await expect(setBlocked({ contactId: CONTACT_ID, blocked: true }, vinculador())).resolves.toBeUndefined()

    expect(repo.row(CONTACT_ID)?.blocked).toEqual(original)
  })

  it('R38: desbloquear quita la marca', async () => {
    const { repo, setBlocked } = setup([contactRow({ blocked: { at: ANTES, by: OTRO_USUARIO } })])

    await setBlocked({ contactId: CONTACT_ID, blocked: false }, vinculador())

    expect(repo.setBlocked).toHaveBeenCalledWith(CONTACT_ID, null, SCOPE)
    expect(repo.row(CONTACT_ID)?.blocked).toBeNull()
  })

  it('R38: desbloquear un contacto no bloqueado responde exito y no cambia nada', async () => {
    const { repo, setBlocked } = setup()

    await expect(setBlocked({ contactId: CONTACT_ID, blocked: false }, vinculador())).resolves.toBeUndefined()

    expect(repo.row(CONTACT_ID)?.blocked).toBeNull()
  })

  it('R42: bloquear y desbloquear no tocan el vinculo del contacto', async () => {
    const link = { customerId: CUSTOMER_ID, linkedBy: ACTOR_ID }
    const { repo, setBlocked } = setup([contactRow({ link })])

    await setBlocked({ contactId: CONTACT_ID, blocked: true }, vinculador())
    await setBlocked({ contactId: CONTACT_ID, blocked: false }, vinculador())

    expect(repo.setLink).not.toHaveBeenCalled()
    expect(repo.row(CONTACT_ID)?.link).toEqual(link)
  })

  it.each([true, false])(
    'R32, R45: un contacto inexistente y uno de otra empresa responden whatsapp_contact_not_found (blocked=%s)',
    async (blocked) => {
      const { repo, setBlocked } = setup([contactRow({ companyId: OTHER_COMPANY_ID })])

      await expect(setBlocked({ contactId: CONTACT_ID, blocked }, vinculador())).rejects.toBeInstanceOf(
        WhatsappContactNotFoundError,
      )
      await expect(setBlocked({ contactId: OTHER_CONTACT_ID, blocked }, vinculador())).rejects.toBeInstanceOf(
        WhatsappContactNotFoundError,
      )
      expect(repo.row(CONTACT_ID)?.blocked).toBeNull()
    },
  )
})
