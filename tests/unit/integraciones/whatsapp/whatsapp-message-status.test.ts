import { describe, expect, it } from 'vitest'

import {
  WHATSAPP_MESSAGE_STATUSES,
  type WhatsappMessageStatus,
} from '@/lib/modules/integraciones/domain/whatsapp-message'
import {
  STATUS_PREDECESSORS,
  WHATSAPP_STATUS_UPDATES,
  canApplyStatus,
  isWhatsappStatusUpdate,
  type WhatsappStatusUpdate,
} from '@/lib/modules/integraciones/domain/whatsapp-message-status'

// Escrita a mano, fila por fila: si la tabla del código cambia, este test no la sigue.
const EXPECTED: Record<WhatsappMessageStatus, Record<WhatsappStatusUpdate, boolean>> = {
  RECEIVED: { SENT: false, DELIVERED: false, READ: false, FAILED: false },
  QUEUED: { SENT: true, DELIVERED: true, READ: true, FAILED: true },
  SENDING: { SENT: true, DELIVERED: true, READ: true, FAILED: true },
  SENT: { SENT: false, DELIVERED: true, READ: true, FAILED: true },
  DELIVERED: { SENT: false, DELIVERED: false, READ: true, FAILED: false },
  READ: { SENT: false, DELIVERED: false, READ: false, FAILED: false },
  FAILED: { SENT: false, DELIVERED: false, READ: false, FAILED: false },
}

const TABLE = WHATSAPP_MESSAGE_STATUSES.flatMap((current) =>
  WHATSAPP_STATUS_UPDATES.map((incoming) => [current, incoming, EXPECTED[current][incoming]] as const),
)

describe('orden de statuses de un mensaje', () => {
  it('R21: los status entrantes son exactamente SENT, DELIVERED, READ y FAILED', () => {
    expect([...WHATSAPP_STATUS_UPDATES].sort()).toEqual(['DELIVERED', 'FAILED', 'READ', 'SENT'])
    expect(TABLE).toHaveLength(WHATSAPP_MESSAGE_STATUSES.length * 4)
  })

  it.each(TABLE)('R21: estado actual %s con status %s ⇒ se aplica: %s', (current, incoming, expected) => {
    expect(canApplyStatus(current, incoming)).toBe(expected)
  })

  it('R21: RECEIVED no es predecesor de nada (un status nunca toca un entrante)', () => {
    for (const predecessors of Object.values(STATUS_PREDECESSORS)) {
      expect(predecessors).not.toContain('RECEIVED')
    }
  })

  it('R21: nada sale de FAILED ni de READ', () => {
    for (const predecessors of Object.values(STATUS_PREDECESSORS)) {
      expect(predecessors).not.toContain('FAILED')
      expect(predecessors).not.toContain('READ')
    }
  })

  it('R21: un status no es predecesor de sí mismo', () => {
    for (const [incoming, predecessors] of Object.entries(STATUS_PREDECESSORS)) {
      expect(predecessors).not.toContain(incoming)
    }
  })

  it.each(['sent', 'played', 'deleted', 'RECEIVED', 'QUEUED', 'toString', ''])(
    'R22: %j no es un status entrante',
    (value) => {
      expect(isWhatsappStatusUpdate(value)).toBe(false)
    },
  )

  it.each(['SENT', 'DELIVERED', 'READ', 'FAILED'])('R21: %s es un status entrante', (value) => {
    expect(isWhatsappStatusUpdate(value)).toBe(true)
  })
})
