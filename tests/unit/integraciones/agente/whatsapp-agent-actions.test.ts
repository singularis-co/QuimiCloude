// Las Server Actions de configuración del agente contra dobles de `@/lib/composition`: se prueba el
// borde (actor con añadidos, una sola lectura de sesión, entrada que baja tal cual, `success` o
// `ErrorState` del catálogo y ninguna revalidación), nunca el dominio ni la sesión reales.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getWhatsappAgentSettingsAction,
  saveWhatsappAgentSettingsAction,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-agent-actions'
import { errorMessage } from '@/lib/modules/errores'
import { UnauthorizedError, ValidationError, WHATSAPP_AGENT_DEFAULTS } from '@/lib/modules/integraciones'

const {
  getSettingsMock,
  saveSettingsMock,
  getSessionUserMock,
  getSessionContextMock,
  revalidatePathMock,
  readRequestIdHeaderMock,
} = vi.hoisted(() => ({
  getSettingsMock: vi.fn(),
  saveSettingsMock: vi.fn(),
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
  },
}))

const REQUEST_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const COMPANY_ID = '22222222-2222-4222-8222-222222222222'

const SESSION_USER = {
  id: 'user-admin-1',
  username: 'ana.perez',
  displayName: 'Ana Perez',
  roleName: 'Administrador',
  permissions: ['agente_ia.consultar', 'agente_ia.modificar'],
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

const ACTIONS = {
  get: () => getWhatsappAgentSettingsAction(),
  save: () => saveWhatsappAgentSettingsAction(ENTRADA),
} as const

const USE_CASE_OF = { get: getSettingsMock, save: saveSettingsMock } as const

beforeEach(() => {
  vi.clearAllMocks()
  getSessionUserMock.mockResolvedValue(SESSION_USER)
  getSessionContextMock.mockResolvedValue({ companyId: COMPANY_ID })
  getSettingsMock.mockResolvedValue(WHATSAPP_AGENT_DEFAULTS)
  saveSettingsMock.mockResolvedValue(undefined)
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
    expect(source).not.toMatch(/requireAgent|agente_ia\./)
    expect(source).not.toMatch(/Schema\b/)
    expect(source).not.toMatch(/@prisma\/client|prisma\./)
    expect(source).not.toMatch(/adapters\/driven|\.\.\/driven/)
    expect(source).not.toMatch(/revalidatePath|next\/cache/)
  })
})
