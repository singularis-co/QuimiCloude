import { describe, expect, it } from 'vitest'

import type { GraphFailure } from '@/lib/modules/integraciones/domain/graph-failure'
import { sendDiagnosticOf, sendFailureOf } from '@/lib/modules/integraciones/domain/whatsapp-send-failure'
import { whatsappSendJobSchema, WHATSAPP_SEND_JOB_KIND } from '@/lib/modules/integraciones/domain/whatsapp-send-job'
import {
  isTemporarySendFailure,
  maxAttemptsOf,
  NOT_DELIVERABLE_REASON,
  QUEUED_STALE_MS,
  RETRIES_EXHAUSTED_REASON,
  SENDING_STUCK_MS,
  SENDING_STUCK_REASON,
} from '@/lib/modules/integraciones/domain/whatsapp-send-retry-policy'

const META_TEXT = 'Message failed to send to +573001234567: Hola Ana'

function rejected(code: number | null, subcode: number | null = null): GraphFailure {
  return { kind: 'rejected', message: META_TEXT, code, subcode }
}

describe('politica de reintentos del envio del sistema', () => {
  it.each([
    ['red, tiempo agotado, 5xx o 2xx sin wamid (unreachable sin codigo)', { kind: 'unreachable', message: null } as GraphFailure],
    ['unreachable aunque traiga codigo', { kind: 'unreachable', message: null, code: 100 } as GraphFailure],
    ['limite de mensajes 130429', rejected(130429)],
    ['limite de par 131056', rejected(131056)],
  ])('R22: %s es temporal', (_caso, failure) => {
    expect(isTemporarySendFailure(failure)).toBe(true)
  })

  it.each([
    ['token invalido 190', rejected(190)],
    ['ventana cerrada 131047', rejected(131047)],
    ['destinatario no valido 131026', rejected(131026, 7)],
    ['parametro de plantilla 132000', rejected(132000)],
    ['rechazo sin codigo', rejected(null)],
    ['rechazo con codigo ausente', { kind: 'rejected', message: null } as GraphFailure],
  ])('R23: %s es permanente', (_caso, failure) => {
    expect(isTemporarySendFailure(failure)).toBe(false)
  })

  it('R23: un permanente se traduce con la traduccion del envio de usuario y el 190 marca el token', () => {
    expect(sendFailureOf(rejected(190))).toEqual({
      errorCode: '190',
      errorReason: 'Revisa el token en Integraciones',
      effect: 'token_invalid',
    })
    expect(sendFailureOf(rejected(131026)).effect).toBeNull()
  })

  it('R25: el tope de intentos es la primera entrega mas los reintentos', () => {
    expect(maxAttemptsOf(0)).toBe(1)
    expect(maxAttemptsOf(3)).toBe(4)
    expect(maxAttemptsOf(10)).toBe(11)
  })

  it('R29, R32: los plazos del barrido son 5 minutos para QUEUED y 10 para SENDING', () => {
    expect(QUEUED_STALE_MS).toBe(300_000)
    expect(SENDING_STUCK_MS).toBe(600_000)
  })

  it('R19, R31, R32: los motivos fijos en espanol', () => {
    expect(SENDING_STUCK_REASON).toBe(
      'No se pudo confirmar si el mensaje llegó. Revisa con el cliente antes de volver a enviarlo.',
    )
    expect(RETRIES_EXHAUSTED_REASON).toBe('No se pudo enviar después de varios intentos.')
    expect(NOT_DELIVERABLE_REASON).toBe(
      'No se envió: la conexión de WhatsApp no estaba activa o el contacto no estaba disponible.',
    )
    for (const reason of [SENDING_STUCK_REASON, RETRIES_EXHAUSTED_REASON, NOT_DELIVERABLE_REASON]) {
      expect(reason.length).toBeLessThanOrEqual(500)
    }
  })

  it('R26: el diagnostico lleva el tipo y los codigos, nunca el texto de Meta', () => {
    expect(sendDiagnosticOf(rejected(131026, 7))).toBe('Graph enviar mensaje: rejected; code=131026; subcode=7')
    expect(sendDiagnosticOf({ kind: 'unreachable', message: META_TEXT })).toBe(
      'Graph enviar mensaje: unreachable; code=-; subcode=-',
    )
    expect(sendDiagnosticOf(rejected(131026, 7))).not.toContain('573001234567')
    expect(sendDiagnosticOf(rejected(131026, 7))).not.toContain('Ana')
  })
})

describe('trabajo de envio de la cola', () => {
  const VALID = {
    kind: WHATSAPP_SEND_JOB_KIND,
    messageId: '6f1c2b8e-4d3a-4b6e-9a51-2f0d7c9e8a10',
    companyId: '0b7e4f2a-9c1d-4e8b-8f3a-5d6c7b8a9e01',
  }

  it('R15: acepta el trabajo con su tipo, el mensaje y la empresa', () => {
    expect(whatsappSendJobSchema.parse(VALID)).toEqual(VALID)
    expect(WHATSAPP_SEND_JOB_KIND).toBe('send_message')
  })

  it.each([
    ['otro tipo', { ...VALID, kind: 'process_document' }],
    ['mensaje que no es uuid', { ...VALID, messageId: 'abc' }],
    ['sin empresa', { kind: VALID.kind, messageId: VALID.messageId }],
    ['un campo de mas', { ...VALID, to: '573001234567' }],
    ['no es un objeto', 'send_message'],
  ])('R15: rechaza %s', (_caso, body) => {
    expect(whatsappSendJobSchema.safeParse(body).success).toBe(false)
  })
})
