// Reglas puras del modo de la conversación: qué motivo vale para cada destino y cuándo una
// conversación en HUMAN vuelve sola al agente. Sin puertos ni reloj: la hora entra como argumento.

import { describe, expect, it } from 'vitest'

import { ValidationError } from '@/lib/modules/integraciones/domain/errors'
import {
  CONVERSATION_MODES,
  CONVERSATION_MODE_REASONS,
  REASONS_BY_TARGET,
  isDueForAgentReturn,
  planModeChange,
  type ConversationMode,
  type ConversationModeReason,
} from '@/lib/modules/integraciones/domain/whatsapp-conversation-mode'

const HACIA_HUMANO: readonly ConversationModeReason[] = [
  'MANUAL',
  'CUSTOMER_REQUEST',
  'MISSING_DATA',
  'LOW_CONFIDENCE',
  'AI_ERROR',
  'USAGE_LIMIT',
  'USER_REPLY',
  'COMPLAINT',
  'NEGATIVE_SENTIMENT',
  'UNSUPPORTED_MEDIA',
]
const HACIA_AGENTE: readonly ConversationModeReason[] = ['MANUAL', 'INACTIVITY']

const ADMITIDOS: Record<ConversationMode, readonly ConversationModeReason[]> = {
  HUMAN: HACIA_HUMANO,
  AGENT: HACIA_AGENTE,
}

describe('motivos por destino', () => {
  it('R21 — hay once motivos y dos modos, con los valores del enum del esquema', () => {
    expect(CONVERSATION_MODES).toEqual(['AGENT', 'HUMAN'])
    expect([...CONVERSATION_MODE_REASONS].sort()).toEqual(
      [
        'AI_ERROR',
        'COMPLAINT',
        'CUSTOMER_REQUEST',
        'INACTIVITY',
        'LOW_CONFIDENCE',
        'MANUAL',
        'MISSING_DATA',
        'NEGATIVE_SENTIMENT',
        'UNSUPPORTED_MEDIA',
        'USAGE_LIMIT',
        'USER_REPLY',
      ].sort(),
    )
  })

  it('R21 — HUMAN admite los diez de paso a humano (también reclamo, sentimiento negativo y medio no soportado); AGENT, a mano e inactividad', () => {
    expect([...REASONS_BY_TARGET.HUMAN].sort()).toEqual([...HACIA_HUMANO].sort())
    expect([...REASONS_BY_TARGET.AGENT].sort()).toEqual([...HACIA_AGENTE].sort())
  })

  for (const target of CONVERSATION_MODES) {
    for (const reason of CONVERSATION_MODE_REASONS) {
      const admitido = ADMITIDOS[target].includes(reason)
      it(`R21 — ${reason} hacia ${target}: ${admitido ? 'se admite' : 'rechaza con ValidationError'}`, () => {
        for (const current of CONVERSATION_MODES) {
          if (admitido) {
            expect(planModeChange(current, target, reason)).toBe(current === target ? 'unchanged' : 'change')
          } else {
            expect(() => planModeChange(current, target, reason)).toThrow(ValidationError)
          }
        }
      })
    }
  }

  it('R21 — un motivo fuera del catálogo rechaza', () => {
    expect(() => planModeChange('AGENT', 'HUMAN', 'OTRO' as ConversationModeReason)).toThrow(ValidationError)
  })

  it('R23, R25 — ya en el destino con un motivo válido no hay cambio', () => {
    expect(planModeChange('HUMAN', 'HUMAN', 'MANUAL')).toBe('unchanged')
    expect(planModeChange('AGENT', 'AGENT', 'MANUAL')).toBe('unchanged')
  })

  it('las listas por destino no se pueden mutar', () => {
    expect(Object.isFrozen(REASONS_BY_TARGET)).toBe(true)
    expect(Object.isFrozen(REASONS_BY_TARGET.HUMAN)).toBe(true)
    expect(Object.isFrozen(REASONS_BY_TARGET.AGENT)).toBe(true)
  })
})

const HORA = 3_600_000
const CAMBIO = new Date('2026-10-30T08:00:00.000Z')

describe('vuelta automática al agente', () => {
  it('R29 — justo a las N horas del cambio vuelve; un milisegundo antes, no', () => {
    const conversacion = { mode: 'HUMAN', modeChangedAt: CAMBIO, lastMessageAt: null } as const
    expect(isDueForAgentReturn(conversacion, 12, new Date(CAMBIO.getTime() + 12 * HORA))).toBe(true)
    expect(isDueForAgentReturn(conversacion, 12, new Date(CAMBIO.getTime() + 12 * HORA - 1))).toBe(false)
    expect(isDueForAgentReturn(conversacion, 12, new Date(CAMBIO.getTime() + 30 * HORA))).toBe(true)
  })

  it('R29 — la referencia es la más reciente de las dos fechas: un mensaje posterior al cambio reinicia la cuenta', () => {
    const mensaje = new Date(CAMBIO.getTime() + 5 * HORA)
    const conversacion = { mode: 'HUMAN', modeChangedAt: CAMBIO, lastMessageAt: mensaje } as const
    expect(isDueForAgentReturn(conversacion, 12, new Date(CAMBIO.getTime() + 12 * HORA))).toBe(false)
    expect(isDueForAgentReturn(conversacion, 12, new Date(mensaje.getTime() + 12 * HORA - 1))).toBe(false)
    expect(isDueForAgentReturn(conversacion, 12, new Date(mensaje.getTime() + 12 * HORA))).toBe(true)
  })

  it('R29 — un mensaje anterior al cambio no adelanta la vuelta: cuenta la fecha del cambio', () => {
    const mensaje = new Date(CAMBIO.getTime() - 20 * HORA)
    const conversacion = { mode: 'HUMAN', modeChangedAt: CAMBIO, lastMessageAt: mensaje } as const
    expect(isDueForAgentReturn(conversacion, 12, new Date(CAMBIO.getTime() + 12 * HORA - 1))).toBe(false)
    expect(isDueForAgentReturn(conversacion, 12, new Date(CAMBIO.getTime() + 12 * HORA))).toBe(true)
  })

  it('R29 — con solo la fecha del último mensaje, cuenta desde ella', () => {
    const mensaje = new Date('2026-10-30T10:00:00.000Z')
    const conversacion = { mode: 'HUMAN', modeChangedAt: null, lastMessageAt: mensaje } as const
    expect(isDueForAgentReturn(conversacion, 1, new Date(mensaje.getTime() + HORA - 1))).toBe(false)
    expect(isDueForAgentReturn(conversacion, 1, new Date(mensaje.getTime() + HORA))).toBe(true)
  })

  it('R29 — las horas configuradas mandan: 1 hora y 48 horas', () => {
    const conversacion = { mode: 'HUMAN', modeChangedAt: CAMBIO, lastMessageAt: null } as const
    const ahora = new Date(CAMBIO.getTime() + 24 * HORA)
    expect(isDueForAgentReturn(conversacion, 1, ahora)).toBe(true)
    expect(isDueForAgentReturn(conversacion, 48, ahora)).toBe(false)
  })

  it('R30 — una conversación en AGENT nunca vuelve, por vieja que sea', () => {
    const conversacion = { mode: 'AGENT', modeChangedAt: CAMBIO, lastMessageAt: CAMBIO } as const
    expect(isDueForAgentReturn(conversacion, 1, new Date(CAMBIO.getTime() + 1000 * HORA))).toBe(false)
    expect(
      isDueForAgentReturn({ mode: 'AGENT', modeChangedAt: null, lastMessageAt: null }, 1, new Date(CAMBIO.getTime() + 1000 * HORA)),
    ).toBe(false)
  })

  it('R30 — una conversación en HUMAN sin fecha de cambio ni de último mensaje no vuelve', () => {
    expect(
      isDueForAgentReturn({ mode: 'HUMAN', modeChangedAt: null, lastMessageAt: null }, 1, new Date('2030-01-01T00:00:00.000Z')),
    ).toBe(false)
  })
})
