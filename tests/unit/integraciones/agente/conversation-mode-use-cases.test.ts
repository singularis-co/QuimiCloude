// Pasar a humano, devolver al agente y consultar el modo contra el doble en memoria de los
// contactos (respeta el ámbito de empresa). Las comprobaciones de «no toca el puerto» miran las
// llamadas registradas por el doble.

import { describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'
import { UnauthorizedError, WhatsappContactNotFoundError } from '@/lib/modules/integraciones/domain/errors'
import { createGetWhatsappConversationMode } from '@/lib/modules/integraciones/domain/get-whatsapp-conversation-mode'
import { createHandOffWhatsappConversation } from '@/lib/modules/integraciones/domain/hand-off-whatsapp-conversation'
import { createReturnWhatsappConversationToAgent } from '@/lib/modules/integraciones/domain/return-whatsapp-conversation-to-agent'

import {
  ACTOR_ID,
  COMPANY_ID,
  CONTACT_ID,
  NOW,
  OTHER_COMPANY_ID,
  OTHER_CONTACT_ID,
  contactRow,
  makeContactRepository,
  type ContactModeDouble,
} from '../whatsapp/whatsapp-doubles'

const OPERA: Actor = {
  id: ACTOR_ID,
  companyId: COMPANY_ID,
  permissions: ['whatsapp.enviar'],
  addons: ['integraciones', 'agente_ia_whatsapp'],
}

const CONSULTA: Actor = {
  id: ACTOR_ID,
  companyId: COMPANY_ID,
  permissions: ['whatsapp.consultar'],
  addons: ['integraciones', 'agente_ia_whatsapp'],
}

const ANTES = new Date('2026-10-01T09:00:00.000Z')
const OTRO_USUARIO = '00000000-0000-4000-8000-0000000000ee'

const EN_HUMANO: ContactModeDouble = {
  mode: 'HUMAN',
  reason: 'LOW_CONFIDENCE',
  changedAt: ANTES,
  changedBy: null,
  lastMessageAt: ANTES,
}

const EN_AGENTE_A_MANO: ContactModeDouble = {
  mode: 'AGENT',
  reason: 'MANUAL',
  changedAt: ANTES,
  changedBy: OTRO_USUARIO,
  lastMessageAt: ANTES,
}

function escenario(conversation?: ContactModeDouble) {
  const repo = makeContactRepository([
    contactRow(conversation === undefined ? {} : { conversation }),
    contactRow({ id: OTHER_CONTACT_ID, companyId: OTHER_COMPANY_ID, waId: '573009999999' }),
  ])
  const deps = { contacts: repo.contacts, now: () => NOW }
  return {
    ...repo,
    handOff: createHandOffWhatsappConversation(deps),
    giveBack: createReturnWhatsappConversationToAgent(deps),
    getMode: createGetWhatsappConversationMode(deps),
  }
}

type Cambio = 'handOff' | 'giveBack'
const CAMBIOS: ReadonlyArray<[string, Cambio]> = [
  ['pasar a humano', 'handOff'],
  ['devolver al agente', 'giveBack'],
]

describe('pasar a humano', () => {
  it('R22, R20 — una conversación en AGENT queda en HUMAN con motivo MANUAL, la fecha actual y el usuario', async () => {
    const s = escenario()
    await s.handOff({ contactId: CONTACT_ID }, OPERA)
    expect(s.setMode).toHaveBeenCalledWith(
      CONTACT_ID,
      { mode: 'HUMAN', reason: 'MANUAL', at: NOW, by: ACTOR_ID },
      { companyId: COMPANY_ID },
    )
    expect(s.row(CONTACT_ID)?.conversation).toEqual({
      mode: 'HUMAN',
      reason: 'MANUAL',
      changedAt: NOW,
      changedBy: ACTOR_ID,
      lastMessageAt: null,
    })
  })

  it('R22 — una conversación devuelta antes al agente también pasa a HUMAN', async () => {
    const s = escenario(EN_AGENTE_A_MANO)
    await s.handOff({ contactId: CONTACT_ID }, OPERA)
    expect(s.row(CONTACT_ID)?.conversation).toMatchObject({ mode: 'HUMAN', reason: 'MANUAL', changedAt: NOW, changedBy: ACTOR_ID })
  })

  it('R23 — ya en HUMAN no falla y no reescribe modo, motivo, fecha ni usuario', async () => {
    const s = escenario(EN_HUMANO)
    await expect(s.handOff({ contactId: CONTACT_ID }, OPERA)).resolves.toBeUndefined()
    expect(s.setMode).not.toHaveBeenCalled()
    expect(s.row(CONTACT_ID)?.conversation).toEqual(EN_HUMANO)
  })
})

describe('devolver al agente', () => {
  it('R24, R20 — una conversación en HUMAN queda en AGENT con motivo MANUAL, la fecha actual y el usuario', async () => {
    const s = escenario(EN_HUMANO)
    await s.giveBack({ contactId: CONTACT_ID }, OPERA)
    expect(s.setMode).toHaveBeenCalledWith(
      CONTACT_ID,
      { mode: 'AGENT', reason: 'MANUAL', at: NOW, by: ACTOR_ID },
      { companyId: COMPANY_ID },
    )
    expect(s.row(CONTACT_ID)?.conversation).toEqual({
      mode: 'AGENT',
      reason: 'MANUAL',
      changedAt: NOW,
      changedBy: ACTOR_ID,
      lastMessageAt: ANTES,
    })
  })

  it('R25 — ya en AGENT (nunca cambió) no falla y no escribe', async () => {
    const s = escenario()
    await expect(s.giveBack({ contactId: CONTACT_ID }, OPERA)).resolves.toBeUndefined()
    expect(s.setMode).not.toHaveBeenCalled()
    expect(s.row(CONTACT_ID)?.conversation).toBeUndefined()
  })

  it('R25 — ya en AGENT por un cambio anterior conserva motivo, fecha y usuario de ese cambio', async () => {
    const s = escenario(EN_AGENTE_A_MANO)
    await expect(s.giveBack({ contactId: CONTACT_ID }, OPERA)).resolves.toBeUndefined()
    expect(s.setMode).not.toHaveBeenCalled()
    expect(s.row(CONTACT_ID)?.conversation).toEqual(EN_AGENTE_A_MANO)
  })
})

const CON_TODO = { permissions: ['whatsapp.enviar'], addons: ['integraciones', 'agente_ia_whatsapp'] }

const SIN_ACCESO_PARA_CAMBIAR: ReadonlyArray<[string, Actor | null | undefined]> = [
  ['sin actor', null],
  ['actor indefinido', undefined],
  ['sin empresa', { id: ACTOR_ID, companyId: '', ...CON_TODO }],
  ['sin whatsapp.enviar', { id: ACTOR_ID, companyId: COMPANY_ID, ...CON_TODO, permissions: [] }],
  ['solo con whatsapp.consultar', { id: ACTOR_ID, companyId: COMPANY_ID, ...CON_TODO, permissions: ['whatsapp.consultar'] }],
  [
    'solo con los permisos de configuración del agente',
    { id: ACTOR_ID, companyId: COMPANY_ID, ...CON_TODO, permissions: ['agente_ia.consultar', 'agente_ia.modificar'] },
  ],
  ['sin el añadido del agente', { id: ACTOR_ID, companyId: COMPANY_ID, ...CON_TODO, addons: ['integraciones'] }],
  ['sin la lista de añadidos', { id: ACTOR_ID, companyId: COMPANY_ID, permissions: ['whatsapp.enviar'] }],
]

describe('autorización del cambio de modo', () => {
  for (const [operacion, cambio] of CAMBIOS) {
    for (const [quien, actor] of SIN_ACCESO_PARA_CAMBIAR) {
      it(`R26 — ${operacion} ${quien}: rechaza con unauthorized sin llamar al puerto`, async () => {
        const s = escenario(cambio === 'giveBack' ? EN_HUMANO : undefined)
        const promesa = s[cambio]({ contactId: CONTACT_ID }, actor)
        await expect(promesa).rejects.toBeInstanceOf(UnauthorizedError)
        await expect(promesa).rejects.toMatchObject({ code: 'unauthorized' })
        expect(s.findMode).not.toHaveBeenCalled()
        expect(s.setMode).not.toHaveBeenCalled()
      })
    }

    it(`R26 — ${operacion}: el permiso se comprueba antes que la entrada`, async () => {
      const s = escenario()
      await expect(s[cambio]({ contactId: 'no-es-uuid' }, null)).rejects.toBeInstanceOf(UnauthorizedError)
    })
  }
})

describe('contacto no encontrado', () => {
  const PEDIDOS: ReadonlyArray<[string, unknown]> = [
    ['un id sin forma de uuid', { contactId: 'no-es-uuid' }],
    ['un id que no existe', { contactId: '00000000-0000-4000-8000-0000000000ff' }],
    ['un contacto de otra empresa', { contactId: OTHER_CONTACT_ID }],
    ['sin id', {}],
  ]

  for (const [operacion, cambio] of CAMBIOS) {
    for (const [que, entrada] of PEDIDOS) {
      it(`R27 — ${operacion} con ${que}: whatsapp_contact_not_found y no escribe`, async () => {
        const s = escenario()
        const promesa = s[cambio](entrada, OPERA)
        await expect(promesa).rejects.toBeInstanceOf(WhatsappContactNotFoundError)
        await expect(promesa).rejects.toMatchObject({ code: 'whatsapp_contact_not_found' })
        expect(s.setMode).not.toHaveBeenCalled()
        expect(s.row(OTHER_CONTACT_ID)?.conversation).toBeUndefined()
      })
    }
  }

  for (const [que, entrada] of PEDIDOS) {
    it(`R27 — consultar el modo con ${que}: whatsapp_contact_not_found`, async () => {
      const s = escenario()
      await expect(s.getMode(entrada, CONSULTA)).rejects.toMatchObject({ code: 'whatsapp_contact_not_found' })
    })
  }

  it('R27 — el contacto de otra empresa se pide con el ámbito del actor, nunca con el de la entrada', async () => {
    const s = escenario()
    await expect(s.handOff({ contactId: OTHER_CONTACT_ID, companyId: OTHER_COMPANY_ID }, OPERA)).rejects.toBeInstanceOf(
      WhatsappContactNotFoundError,
    )
    expect(s.findMode).toHaveBeenCalledWith(OTHER_CONTACT_ID, { companyId: COMPANY_ID })
  })

  it('R27 — si el contacto desaparece entre la lectura y la escritura, responde no encontrado', async () => {
    const s = escenario()
    s.setMode.mockResolvedValueOnce('not_found')
    await expect(s.handOff({ contactId: CONTACT_ID }, OPERA)).rejects.toBeInstanceOf(WhatsappContactNotFoundError)
  })

  it('R23 — si otro cambio gana la carrera entre la lectura y la escritura, no falla', async () => {
    const s = escenario()
    s.setMode.mockResolvedValueOnce('unchanged')
    await expect(s.handOff({ contactId: CONTACT_ID }, OPERA)).resolves.toBeUndefined()
  })
})

describe('consultar el modo', () => {
  it('R28 — una conversación que nunca cambió devuelve AGENT con motivo y fecha vacíos', async () => {
    const s = escenario()
    expect(await s.getMode({ contactId: CONTACT_ID }, CONSULTA)).toEqual({ mode: 'AGENT', reason: null, changedAt: null })
    expect(s.findMode).toHaveBeenCalledWith(CONTACT_ID, { companyId: COMPANY_ID })
  })

  it('R28 — devuelve el modo, el motivo y la fecha del último cambio, sin el autor ni el último mensaje', async () => {
    const s = escenario(EN_HUMANO)
    expect(await s.getMode({ contactId: CONTACT_ID }, CONSULTA)).toEqual({
      mode: 'HUMAN',
      reason: 'LOW_CONFIDENCE',
      changedAt: ANTES,
    })
  })

  it('R28 — tras pasar a humano, la consulta devuelve el cambio', async () => {
    const s = escenario()
    await s.handOff({ contactId: CONTACT_ID }, OPERA)
    expect(await s.getMode({ contactId: CONTACT_ID }, CONSULTA)).toEqual({ mode: 'HUMAN', reason: 'MANUAL', changedAt: NOW })
  })

  const SIN_ACCESO_PARA_CONSULTAR: ReadonlyArray<[string, Actor | null | undefined]> = [
    ['sin actor', null],
    ['sin empresa', { ...CONSULTA, companyId: '' }],
    ['sin whatsapp.consultar', { ...CONSULTA, permissions: [] }],
    ['solo con agente_ia.consultar', { ...CONSULTA, permissions: ['agente_ia.consultar'] }],
    ['sin el añadido del agente', { ...CONSULTA, addons: ['integraciones'] }],
  ]

  for (const [quien, actor] of SIN_ACCESO_PARA_CONSULTAR) {
    it(`R28 — ${quien}: rechaza con unauthorized sin leer`, async () => {
      const s = escenario()
      await expect(s.getMode({ contactId: CONTACT_ID }, actor)).rejects.toMatchObject({ code: 'unauthorized' })
      expect(s.findMode).not.toHaveBeenCalled()
    })
  }

  it('R28 — con whatsapp.enviar pero sin whatsapp.consultar no se consulta: son permisos distintos', async () => {
    const s = escenario()
    await expect(s.getMode({ contactId: CONTACT_ID }, OPERA)).rejects.toBeInstanceOf(UnauthorizedError)
  })
})
