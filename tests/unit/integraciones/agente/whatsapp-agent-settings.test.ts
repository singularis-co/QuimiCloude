// La configuración del agente de IA de WhatsApp: los valores por defecto y el esquema del guardado.
// Puro, sin puertos: los casos de uso que lo usan se prueban en `save-whatsapp-agent-settings.test.ts`.

import { describe, expect, it } from 'vitest'

import {
  saveWhatsappAgentSettingsSchema,
  WHATSAPP_AGENT_DEFAULTS,
  WHATSAPP_ASSISTANT_NAME_MAX_LENGTH,
} from '@/lib/modules/integraciones/domain/whatsapp-agent-settings'

const VALIDA = {
  enabled: true,
  confidenceThreshold: 0.75,
  dailyReplyLimit: 300,
  contactHourlyReplyLimit: 10,
  inactivityHours: 6,
  handoffMessage: 'Te paso con alguien del equipo.',
  greetingMessage: 'Hola, soy {nombre}.',
  assistantName: 'Ana',
}

function con(overrides: Record<string, unknown>): Record<string, unknown> {
  return { ...VALIDA, ...overrides }
}

function sin(campo: string): Record<string, unknown> {
  const copia: Record<string, unknown> = { ...VALIDA }
  delete copia[campo]
  return copia
}

function acepta(input: unknown): boolean {
  return saveWhatsappAgentSettingsSchema.safeParse(input).success
}

function nombreGuardado(input: unknown): string | null | undefined {
  const parsed = saveWhatsappAgentSettingsSchema.safeParse(input)
  if (!parsed.success) throw new Error('se esperaba una entrada válida')
  return parsed.data.assistantName
}

describe('valores por defecto del agente', () => {
  it('R8 — activo false, umbral 0.6, 500 por día, 20 por contacto por hora, 12 horas y los textos exactos', () => {
    expect(WHATSAPP_AGENT_DEFAULTS).toEqual({
      enabled: false,
      confidenceThreshold: 0.6,
      dailyReplyLimit: 500,
      contactHourlyReplyLimit: 20,
      inactivityHours: 12,
      handoffMessage: 'Te comunico con una persona del equipo. Te responderá en cuanto pueda.',
      greetingMessage:
        'Hola, soy el asistente virtual {nombre}. Si prefieres hablar con una persona, escribe "asesor".',
      assistantName: null,
    })
  })

  it('R8 — el saludo por defecto guarda `{nombre}` literal y no tiene nombre del asistente', () => {
    expect(WHATSAPP_AGENT_DEFAULTS.greetingMessage).toContain('{nombre}')
    expect(WHATSAPP_AGENT_DEFAULTS.assistantName).toBeNull()
  })

  it('R8 — los valores por defecto pasan el propio esquema del guardado', () => {
    expect(acepta(WHATSAPP_AGENT_DEFAULTS)).toBe(true)
  })

  it('R8 — los valores por defecto no se pueden mutar', () => {
    expect(Object.isFrozen(WHATSAPP_AGENT_DEFAULTS)).toBe(true)
  })
})

describe('esquema del guardado', () => {
  it('acepta una configuración válida completa', () => {
    expect(acepta(VALIDA)).toBe(true)
  })

  it.each([0, 1, 0.6, 0.01, 0.29, 0.99])('R11 — umbral %s dentro de [0, 1] con hasta dos decimales: acepta', (umbral) => {
    expect(acepta(con({ confidenceThreshold: umbral }))).toBe(true)
  })

  it.each([1.01, -0.01, 0.655, 2, Number.NaN, Number.POSITIVE_INFINITY, '0.6', null])(
    'R11 — umbral %s fuera de rango, con más de dos decimales o no numérico: rechaza',
    (umbral) => {
      expect(acepta(con({ confidenceThreshold: umbral }))).toBe(false)
    },
  )

  it.each(['dailyReplyLimit', 'contactHourlyReplyLimit'])('R12 — %s: 1 acepta; 0, 1.5, -3 y texto rechazan', (campo) => {
    expect(acepta(con({ [campo]: 1 }))).toBe(true)
    expect(acepta(con({ [campo]: 1_000_000 }))).toBe(true)
    for (const valor of [0, 1.5, -3, '10', null]) {
      expect(acepta(con({ [campo]: valor })), `${campo}=${String(valor)}`).toBe(false)
    }
  })

  it('R13 — horas de inactividad: 1 acepta; 0, 1.5, -1 y texto rechazan', () => {
    expect(acepta(con({ inactivityHours: 1 }))).toBe(true)
    expect(acepta(con({ inactivityHours: 720 }))).toBe(true)
    for (const valor of [0, 1.5, -1, '12', null]) {
      expect(acepta(con({ inactivityHours: valor })), String(valor)).toBe(false)
    }
  })

  it.each(['handoffMessage', 'greetingMessage'])(
    'R14 — %s vacío, solo espacios o solo blancos rechaza; 4096 caracteres acepta y 4097 rechaza',
    (campo) => {
      for (const valor of ['', '   ', ' \t\n\r ']) {
        expect(acepta(con({ [campo]: valor })), JSON.stringify(valor)).toBe(false)
      }
      expect(acepta(con({ [campo]: 'a'.repeat(4096) }))).toBe(true)
      expect(acepta(con({ [campo]: 'a'.repeat(4097) }))).toBe(false)
    },
  )

  it('R14 — el tope de 4096 se cuenta después de quitar los espacios de los extremos', () => {
    expect(acepta(con({ handoffMessage: `  ${'a'.repeat(4096)}  ` }))).toBe(true)
  })

  it.each([
    'enabled',
    'confidenceThreshold',
    'dailyReplyLimit',
    'contactHourlyReplyLimit',
    'inactivityHours',
    'handoffMessage',
    'greetingMessage',
  ])('R15 — sin el campo %s rechaza', (campo) => {
    expect(acepta(sin(campo))).toBe(false)
  })

  it.each(['true', 1, 0, null, 'si'])('R15 — `enabled` no booleano (%s) rechaza', (valor) => {
    expect(acepta(con({ enabled: valor }))).toBe(false)
  })

  it('R15 — sin nombre del asistente no rechaza', () => {
    expect(acepta(sin('assistantName'))).toBe(true)
  })

  it('R15 — una entrada que no es un objeto rechaza', () => {
    for (const valor of [null, undefined, 'texto', 42, []]) {
      expect(acepta(valor), String(valor)).toBe(false)
    }
  })
})

describe('nombre del asistente', () => {
  it('R34 — ausente, null, vacío o solo espacios se guarda sin nombre', () => {
    expect(nombreGuardado(sin('assistantName'))).toBeNull()
    expect(nombreGuardado(con({ assistantName: null }))).toBeNull()
    expect(nombreGuardado(con({ assistantName: '' }))).toBeNull()
    expect(nombreGuardado(con({ assistantName: '   ' }))).toBeNull()
  })

  it('R34 — se guarda sin los espacios de los extremos', () => {
    expect(nombreGuardado(con({ assistantName: '  Ana  ' }))).toBe('Ana')
  })

  it.each(['\tAna', 'Ana\n', '\r\nAna'])(
    'R34/D15 — se guarda sin tabuladores ni saltos de línea en los extremos (%j)',
    (valor) => {
      expect(nombreGuardado(con({ assistantName: valor }))).toBe('Ana')
    },
  )

  it('R34/D15 — un nombre hecho solo de blancos (\\t \\n \\r) se guarda sin nombre', () => {
    expect(nombreGuardado(con({ assistantName: ' \t\r\n ' }))).toBeNull()
  })

  it('R34 — 60 caracteres recortados pasan y 61 rechazan', () => {
    expect(WHATSAPP_ASSISTANT_NAME_MAX_LENGTH).toBe(60)
    expect(nombreGuardado(con({ assistantName: `  ${'a'.repeat(60)}  ` }))).toBe('a'.repeat(60))
    expect(acepta(con({ assistantName: 'a'.repeat(61) }))).toBe(false)
  })

  it.each([42, true, {}, ['Ana']])('R34 — un nombre que no es texto (%s) rechaza', (valor) => {
    expect(acepta(con({ assistantName: valor }))).toBe(false)
  })
})

describe('saludo resuelto con el nombre que se guarda', () => {
  it('R36 — un saludo que es solo `{nombre}` sin nombre del asistente rechaza', () => {
    expect(acepta(con({ greetingMessage: '{nombre}', assistantName: null }))).toBe(false)
    expect(acepta(con({ greetingMessage: '  {nombre}  ', assistantName: '   ' }))).toBe(false)
  })

  it('R36 — el mismo saludo `{nombre}` con nombre acepta', () => {
    expect(acepta(con({ greetingMessage: '{nombre}', assistantName: 'Ana' }))).toBe(true)
  })

  it('R36 — un saludo de 4090 caracteres con `{nombre}` que el nombre lleva a más de 4096 rechaza', () => {
    const saludo = `${'a'.repeat(4082)}{nombre}`
    expect(saludo).toHaveLength(4090)
    expect(acepta(con({ greetingMessage: saludo, assistantName: 'Benjamín Alberto' }))).toBe(false)
    // El mismo saludo con un nombre corto queda en 4096 o menos y pasa.
    expect(acepta(con({ greetingMessage: saludo, assistantName: 'Ana' }))).toBe(true)
  })
})
