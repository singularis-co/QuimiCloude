// Las Server Actions de configuración del agente y del modo de la conversación contra dobles de `@/lib/composition`: se prueba el
// borde (actor con añadidos, una sola lectura de sesión, entrada que baja tal cual, `success` o
// `ErrorState` del catálogo y ninguna revalidación), nunca el dominio ni la sesión reales.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getWhatsappAgentSettingsAction,
  getWhatsappConversationModeAction,
  handOffWhatsappConversationAction,
  returnWhatsappConversationToAgentAction,
  saveWhatsappAgentSettingsAction,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-agent-actions'
import { errorMessage } from '@/lib/modules/errores'
import {
  UnauthorizedError,
  ValidationError,
  WHATSAPP_AGENT_DEFAULTS,
  WhatsappContactNotFoundError,
} from '@/lib/modules/integraciones'

const {
  getSettingsMock,
  saveSettingsMock,
  handOffMock,
  giveBackMock,
  getModeMock,
  getSessionUserMock,
  getSessionContextMock,
  revalidatePathMock,
  readRequestIdHeaderMock,
} = vi.hoisted(() => ({
  getSettingsMock: vi.fn(),
  saveSettingsMock: vi.fn(),
  handOffMock: vi.fn(),
  giveBackMock: vi.fn(),
  getModeMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  getSessionContextMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  readRequestIdHeaderMock: vi.fn(async () => '7c9e6679-7425-40de-944b-e07fc1f90ae7'),
}))

// Se dobla para poder afirmar que NADIE la llama, aunque el módulo no la importe.
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

vi.mock('@/lib/composition', () => ({
  observabilidad: { readRequestIdHeader: readRequestIdHeaderMock },
  identity: { getSessionUser: getSessionUserMock, getSessionContext: getSessionContextMock },
  integraciones: {
    getWhatsappAgentSettings: getSettingsMock,
    saveWhatsappAgentSettings: saveSettingsMock,
    handOffWhatsappConversation: handOffMock,
    returnWhatsappConversationToAgent: giveBackMock,
    getWhatsappConversationMode: getModeMock,
  },
}))

const REQUEST_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const COMPANY_ID = '22222222-2222-4222-8222-222222222222'

const SESSION_USER = {
  id: 'user-admin-1',
  username: 'ana.perez',
  displayName: 'Ana Perez',
  roleName: 'Administrador',
  permissions: ['agente_ia.consultar', 'agente_ia.modificar', 'whatsapp.consultar', 'whatsapp.enviar'],
  addons: ['integraciones', 'agente_ia_whatsapp'],
}

const ACTOR = {
  id: SESSION_USER.id,
  companyId: COMPANY_ID,
  permissions: SESSION_USER.permissions,
  addons: SESSION_USER.addons,
}

const ENTRADA = {
  enabled: true,
  confidenceThreshold: 0.7,
  dailyReplyLimit: 200,
  contactHourlyReplyLimit: 10,
  inactivityHours: 8,
  handoffMessage: 'Te paso con alguien.',
  greetingMessage: 'Hola, soy {nombre}.',
  assistantName: 'Ana',
}

const CONTACT_ID = '7a2f1b40-3c5d-4e69-9a18-0d4b6f2e8c31'
const CHANGED_AT = new Date('2026-10-30T09:00:00.000Z')

const ACTIONS = {
  get: () => getWhatsappAgentSettingsAction(),
  save: () => saveWhatsappAgentSettingsAction(ENTRADA),
  handOff: () => handOffWhatsappConversationAction({ contactId: CONTACT_ID }),
  giveBack: () => returnWhatsappConversationToAgentAction({ contactId: CONTACT_ID }),
  getMode: () => getWhatsappConversationModeAction({ contactId: CONTACT_ID }),
} as const

const USE_CASE_OF = {
  get: getSettingsMock,
  save: saveSettingsMock,
  handOff: handOffMock,
  giveBack: giveBackMock,
  getMode: getModeMock,
} as const

const MODE_ACTIONS = ['handOff', 'giveBack', 'getMode'] as const

beforeEach(() => {
  vi.clearAllMocks()
  getSessionUserMock.mockResolvedValue(SESSION_USER)
  getSessionContextMock.mockResolvedValue({ companyId: COMPANY_ID })
  getSettingsMock.mockResolvedValue(WHATSAPP_AGENT_DEFAULTS)
  saveSettingsMock.mockResolvedValue(undefined)
  handOffMock.mockResolvedValue(undefined)
  giveBackMock.mockResolvedValue(undefined)
  getModeMock.mockResolvedValue({ mode: 'HUMAN', reason: 'MANUAL', changedAt: CHANGED_AT })
})

describe('acciones de configuración del agente', () => {
  it('R8 — leer devuelve `success` con la configuración del caso de uso', async () => {
    expect(await getWhatsappAgentSettingsAction()).toEqual({ status: 'success', settings: WHATSAPP_AGENT_DEFAULTS })
    expect(getSettingsMock).toHaveBeenCalledWith(ACTOR)
  })

  it('R16 — guardar baja la entrada tal cual con el actor y devuelve `success`', async () => {
    expect(await saveWhatsappAgentSettingsAction(ENTRADA)).toEqual({ status: 'success' })
    expect(saveSettingsMock).toHaveBeenCalledTimes(1)
    expect(saveSettingsMock).toHaveBeenCalledWith(ENTRADA, ACTOR)
  })

  it('R22 — pasar a humano baja la entrada tal cual con el actor (con sus añadidos) y devuelve `success`', async () => {
    expect(await handOffWhatsappConversationAction({ contactId: CONTACT_ID })).toEqual({ status: 'success' })
    expect(handOffMock).toHaveBeenCalledTimes(1)
    expect(handOffMock).toHaveBeenCalledWith({ contactId: CONTACT_ID }, ACTOR)
  })

  it('R24 — devolver al agente baja la entrada tal cual con el actor y devuelve `success`', async () => {
    expect(await returnWhatsappConversationToAgentAction({ contactId: CONTACT_ID })).toEqual({ status: 'success' })
    expect(giveBackMock).toHaveBeenCalledTimes(1)
    expect(giveBackMock).toHaveBeenCalledWith({ contactId: CONTACT_ID }, ACTOR)
  })

  it('R28 — consultar el modo devuelve `success` con modo, motivo y fecha', async () => {
    expect(await getWhatsappConversationModeAction({ contactId: CONTACT_ID })).toEqual({
      status: 'success',
      mode: 'HUMAN',
      reason: 'MANUAL',
      changedAt: CHANGED_AT,
    })
    expect(getModeMock).toHaveBeenCalledWith({ contactId: CONTACT_ID }, ACTOR)
  })

  it('R28 — una conversación que nunca cambió sale con motivo y fecha nulos', async () => {
    getModeMock.mockResolvedValueOnce({ mode: 'AGENT', reason: null, changedAt: null })
    expect(await getWhatsappConversationModeAction({ contactId: CONTACT_ID })).toEqual({
      status: 'success',
      mode: 'AGENT',
      reason: null,
      changedAt: null,
    })
  })

  it('R26, R27, R28 — las acciones de modo traducen unauthorized, contacto no encontrado e invalid_input del catálogo', async () => {
    const CASES = [
      { error: new UnauthorizedError('diagnostico interno'), code: 'unauthorized' },
      { error: new WhatsappContactNotFoundError(), code: 'whatsapp_contact_not_found' },
      { error: new ValidationError('diagnostico interno'), code: 'invalid_input' },
    ] as const

    for (const name of MODE_ACTIONS) {
      for (const { error, code } of CASES) {
        USE_CASE_OF[name].mockRejectedValueOnce(error)
        const result = await ACTIONS[name]()
        expect(result, `${name} / ${code}`).toEqual({ status: 'error', code, message: errorMessage(code) })
        expect(JSON.stringify(result)).not.toContain('diagnostico interno')
      }
    }
  })

  it('cada acción lee la sesión una sola vez y no revalida ninguna ruta', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      getSessionUserMock.mockClear()
      getSessionContextMock.mockClear()
      await action()
      expect(getSessionUserMock, name).toHaveBeenCalledTimes(1)
      expect(getSessionContextMock, name).toHaveBeenCalledTimes(1)
    }
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('R9, R10 — sin sesión el actor baja nulo y el `unauthorized` del caso de uso sale del catálogo', async () => {
    getSessionContextMock.mockResolvedValue(null)
    for (const [name, action] of Object.entries(ACTIONS)) {
      const useCase = USE_CASE_OF[name as keyof typeof ACTIONS]
      useCase.mockClear()
      useCase.mockRejectedValueOnce(new UnauthorizedError())
      const result = await action()
      expect(useCase.mock.calls[0]?.at(-1), name).toBeNull()
      expect(result, name).toEqual({ status: 'error', code: 'unauthorized', message: errorMessage('unauthorized') })
    }
  })

  it('R9, R10, R11 — cada error de dominio se traduce por su código con el texto del catálogo, sin diagnóstico', async () => {
    const CASES = [
      { error: new UnauthorizedError('diagnostico interno'), code: 'unauthorized' },
      { error: new ValidationError('diagnostico interno'), code: 'invalid_input' },
    ] as const

    for (const [name, action] of Object.entries(ACTIONS)) {
      for (const { error, code } of CASES) {
        USE_CASE_OF[name as keyof typeof ACTIONS].mockRejectedValueOnce(error)
        const result = await action()
        expect(result, `${name} / ${code}`).toEqual({ status: 'error', code, message: errorMessage(code) })
        expect(JSON.stringify(result)).not.toContain('diagnostico interno')
      }
    }
  })

  it('un error ajeno al dominio sale como `unexpected` con referencia y sin su texto', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      USE_CASE_OF[name as keyof typeof ACTIONS].mockRejectedValueOnce(new Error('fallo interno de la base'))
      const result = await action()
      expect(result, name).toEqual({
        status: 'error',
        code: 'unexpected',
        message: errorMessage('unexpected'),
        reference: REQUEST_ID,
      })
      expect(JSON.stringify(result)).not.toContain('fallo interno')
    }
  })

  it('el borde no decide: sin permiso, esquema, ORM, driven ni revalidatePath', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..', '..', '..', '..',
        'lib', 'modules', 'integraciones', 'adapters', 'driving', 'whatsapp-agent-actions.ts',
      ),
      'utf8',
    )
    expect(source.startsWith("'use server';")).toBe(true)
    expect(source).not.toMatch(/requireAgent|agente_ia\.|whatsapp\.(enviar|consultar)|agente_ia_whatsapp/)
    expect(source).not.toMatch(/planModeChange|isDueForAgentReturn/)
    expect(source).not.toMatch(/Schema\b/)
    expect(source).not.toMatch(/@prisma\/client|prisma\./)
    expect(source).not.toMatch(/adapters\/driven|\.\.\/driven/)
    expect(source).not.toMatch(/revalidatePath|next\/cache/)
  })
})
