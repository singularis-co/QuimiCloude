// Los casos de uso de leer y guardar la configuración del agente, con el puerto simulado.

import { describe, expect, it, vi } from 'vitest'

import { UnauthorizedError, ValidationError } from '@/lib/modules/integraciones/domain/errors'
import { createGetWhatsappAgentSettings } from '@/lib/modules/integraciones/domain/get-whatsapp-agent-settings'
import { createSaveWhatsappAgentSettings } from '@/lib/modules/integraciones/domain/save-whatsapp-agent-settings'
import {
  WHATSAPP_AGENT_DEFAULTS,
  type WhatsappAgentSettings,
} from '@/lib/modules/integraciones/domain/whatsapp-agent-settings'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'
import type { WhatsappAgentSettingsRepository } from '@/lib/modules/integraciones/ports/whatsapp-agent-settings-repository'

const COMPANY_ID = '00000000-0000-4000-8000-0000000000a1'
const OTHER_COMPANY_ID = '00000000-0000-4000-8000-0000000000b2'
const ACTOR_ID = '00000000-0000-4000-8000-0000000000c3'
const NOW = new Date('2026-10-30T15:00:00.000Z')

const GUARDADA: WhatsappAgentSettings = {
  enabled: true,
  confidenceThreshold: 0.8,
  dailyReplyLimit: 100,
  contactHourlyReplyLimit: 5,
  inactivityHours: 24,
  handoffMessage: 'Ya te atiende alguien.',
  greetingMessage: 'Hola, soy {nombre}.',
  assistantName: 'Lupe',
}

const ENTRADA = {
  enabled: true,
  confidenceThreshold: 0.45,
  dailyReplyLimit: 250,
  contactHourlyReplyLimit: 8,
  inactivityHours: 3,
  handoffMessage: '  Te paso con alguien del equipo.  ',
  greetingMessage: '\n Hola, soy {nombre}. Escribe "asesor". \t',
  assistantName: '  Ana  ',
}

function sinCampo(campo: keyof typeof ENTRADA): Record<string, unknown> {
  const copia: Record<string, unknown> = { ...ENTRADA }
  delete copia[campo]
  return copia
}

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: ACTOR_ID,
    companyId: COMPANY_ID,
    permissions: ['agente_ia.consultar', 'agente_ia.modificar'],
    addons: ['integraciones', 'agente_ia_whatsapp'],
    ...overrides,
  }
}

function doble(guardada: WhatsappAgentSettings | null = null) {
  const find = vi.fn<WhatsappAgentSettingsRepository['find']>(async () => guardada)
  const save = vi.fn<WhatsappAgentSettingsRepository['save']>(async () => {})
  const agentSettings: WhatsappAgentSettingsRepository = { find, save }
  return { agentSettings, find, save }
}

function entradaVigilada(base: Record<string, unknown> = ENTRADA) {
  const leida = vi.fn()
  const input = new Proxy(base, {
    get(target, key, receiver) {
      leida(key)
      return Reflect.get(target, key, receiver) as unknown
    },
  })
  return { input, leida }
}

describe('leer la configuración del agente', () => {
  it('R8 — una empresa sin configuración guardada recibe los valores por defecto', async () => {
    const repo = doble(null)
    const get = createGetWhatsappAgentSettings(repo)

    expect(await get(actor())).toEqual(WHATSAPP_AGENT_DEFAULTS)
    expect(repo.find).toHaveBeenCalledWith({ companyId: COMPANY_ID })
  })

  it('R16 — con configuración guardada devuelve la guardada', async () => {
    const repo = doble(GUARDADA)
    expect(await createGetWhatsappAgentSettings(repo)(actor())).toEqual(GUARDADA)
  })

  it.each([
    ['sin agente_ia.consultar', actor({ permissions: ['agente_ia.modificar', 'whatsapp.consultar'] })],
    ['sin empresa', actor({ companyId: '' })],
    ['sin actor', null],
    ['actor indefinido', undefined],
  ])('R9 — %s: rechaza con unauthorized y no lee', async (_caso, quien) => {
    const repo = doble(GUARDADA)
    await expect(createGetWhatsappAgentSettings(repo)(quien)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(repo.find).not.toHaveBeenCalled()
  })

  it('R18 — lee siempre la empresa del actor', async () => {
    const repo = doble(GUARDADA)
    await createGetWhatsappAgentSettings(repo)(actor({ companyId: OTHER_COMPANY_ID }))
    expect(repo.find).toHaveBeenCalledWith({ companyId: OTHER_COMPANY_ID })
  })
})

describe('guardar la configuración del agente', () => {
  function setup() {
    const repo = doble()
    const save = createSaveWhatsappAgentSettings({ agentSettings: repo.agentSettings, now: () => NOW })
    return { repo, save }
  }

  it.each([
    ['sin agente_ia.modificar', actor({ permissions: ['agente_ia.consultar', 'integraciones.modificar'] })],
    ['sin empresa', actor({ companyId: '' })],
    ['sin actor', null],
  ])('R10 — %s: rechaza con unauthorized antes de leer la entrada y sin escribir', async (_caso, quien) => {
    const { repo, save } = setup()
    const { input, leida } = entradaVigilada()

    await expect(save(input, quien)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(leida).not.toHaveBeenCalled()
    expect(repo.save).not.toHaveBeenCalled()
    expect(repo.find).not.toHaveBeenCalled()
  })

  it('R16 — reemplaza todos los campos, recorta mensajes y nombre y registra autor y fecha', async () => {
    const { repo, save } = setup()

    await save(ENTRADA, actor())

    expect(repo.save).toHaveBeenCalledTimes(1)
    expect(repo.save).toHaveBeenCalledWith(
      {
        enabled: true,
        confidenceThreshold: 0.45,
        dailyReplyLimit: 250,
        contactHourlyReplyLimit: 8,
        inactivityHours: 3,
        handoffMessage: 'Te paso con alguien del equipo.',
        greetingMessage: 'Hola, soy {nombre}. Escribe "asesor".',
        assistantName: 'Ana',
      },
      ACTOR_ID,
      NOW,
      { companyId: COMPANY_ID },
    )
  })

  it('R16, R34 — sin nombre del asistente guarda el nombre nulo', async () => {
    const { repo, save } = setup()
    await save(sinCampo('assistantName'), actor())
    await save({ ...ENTRADA, assistantName: '   ' }, actor())

    expect(repo.save.mock.calls.map((call) => call[0].assistantName)).toEqual([null, null])
  })

  it('R18 — escribe en la empresa del actor aunque la entrada traiga otra, y no guarda esa clave', async () => {
    const { repo, save } = setup()

    await save({ ...ENTRADA, companyId: OTHER_COMPANY_ID, company_id: OTHER_COMPANY_ID }, actor())

    expect(repo.save).toHaveBeenCalledTimes(1)
    const [settings, , , scope] = repo.save.mock.calls[0] ?? []
    expect(scope).toEqual({ companyId: COMPANY_ID })
    expect(settings).not.toHaveProperty('companyId')
    expect(settings).not.toHaveProperty('company_id')
  })

  it.each([
    ['umbral fuera de rango', { confidenceThreshold: 1.01 }],
    ['umbral con tres decimales', { confidenceThreshold: 0.655 }],
    ['respuestas por día 0', { dailyReplyLimit: 0 }],
    ['respuestas por contacto 1.5', { contactHourlyReplyLimit: 1.5 }],
    ['horas de inactividad 0', { inactivityHours: 0 }],
    ['mensaje de paso a humano en blanco', { handoffMessage: '   ' }],
    ['saludo de 4097', { greetingMessage: 'a'.repeat(4097) }],
    ['activo no booleano', { enabled: 'true' }],
    ['nombre de 61', { assistantName: 'a'.repeat(61) }],
    ['saludo que queda vacío', { greetingMessage: '{nombre}', assistantName: null }],
  ])('R11–R15, R34, R36 — %s: rechaza con invalid_input y no escribe', async (_caso, cambio) => {
    const { repo, save } = setup()

    const error = await save({ ...ENTRADA, ...cambio }, actor()).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValidationError)
    expect(error).toMatchObject({ code: 'invalid_input' })
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('R15 — sin un campo obligatorio rechaza y no escribe', async () => {
    const { repo, save } = setup()
    await expect(save(sinCampo('inactivityHours'), actor())).rejects.toBeInstanceOf(ValidationError)
    expect(repo.save).not.toHaveBeenCalled()
  })
})
