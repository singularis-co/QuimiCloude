import { describe, expect, it } from 'vitest'

import {
  WhatsappMetaRejectedError,
  WhatsappMetaUnreachableError,
  WhatsappTemplateNameTakenError,
  WhatsappTemplateRateLimitedError,
  WhatsappTemplateRejectedError,
} from '@/lib/modules/integraciones/domain/errors'
import type { GraphFailure } from '@/lib/modules/integraciones/domain/graph-failure'
import {
  META_RATE_LIMITED_CODE,
  TEMPLATE_NAME_TAKEN_SUBCODE,
  templateGraphErrorOf,
} from '@/lib/modules/integraciones/domain/template-graph-failure'

const TOKEN = 'EAAG-token-secreto'
const SECRET = 'app-secret-123'
const SECRETS = [TOKEN, SECRET]

const unreachable: GraphFailure = { kind: 'unreachable', message: null }
const nameTaken: GraphFailure = {
  kind: 'rejected',
  message: 'Content in This Language Already Exists',
  code: 100,
  subcode: 2388024,
}
const rateLimited: GraphFailure = { kind: 'rejected', message: 'Rate limit hit', code: 80008, subcode: null }
const otherRejection: GraphFailure = { kind: 'rejected', message: 'Invalid parameter', code: 100, subcode: 2388299 }

describe('templateGraphErrorOf', () => {
  it('R19: los numeros de Meta son el subcode 2388024 (nombre repetido) y el code 80008 (limite)', () => {
    expect(TEMPLATE_NAME_TAKEN_SUBCODE).toBe(2388024)
    expect(META_RATE_LIMITED_CODE).toBe(80008)
  })

  it('R19: al crear, sin respuesta o 5xx da whatsapp_meta_unreachable', () => {
    expect(templateGraphErrorOf('create', unreachable, SECRETS)).toBeInstanceOf(WhatsappMetaUnreachableError)
    expect(templateGraphErrorOf('create', { ...unreachable, code: 1 }, SECRETS).code).toBe('whatsapp_meta_unreachable')
  })

  it('R19: al crear, el subcode 2388024 da whatsapp_template_name_taken', () => {
    expect(templateGraphErrorOf('create', nameTaken, SECRETS)).toBeInstanceOf(WhatsappTemplateNameTakenError)
  })

  it('R19: al crear, el code 80008 da whatsapp_template_rate_limited, con o sin subcode', () => {
    expect(templateGraphErrorOf('create', rateLimited, SECRETS)).toBeInstanceOf(WhatsappTemplateRateLimitedError)
    expect(templateGraphErrorOf('create', { ...rateLimited, subcode: 2388001 }, SECRETS)).toBeInstanceOf(
      WhatsappTemplateRateLimitedError,
    )
  })

  it('R19: al crear, cualquier otro rechazo da whatsapp_template_rejected, tambien un subcode 23880xx sin el code 80008', () => {
    expect(templateGraphErrorOf('create', otherRejection, SECRETS)).toBeInstanceOf(WhatsappTemplateRejectedError)
    expect(templateGraphErrorOf('create', { kind: 'rejected', message: 'x', code: 100, subcode: 2388001 }, SECRETS)).toBeInstanceOf(
      WhatsappTemplateRejectedError,
    )
    expect(templateGraphErrorOf('create', { kind: 'rejected', message: null }, SECRETS)).toBeInstanceOf(
      WhatsappTemplateRejectedError,
    )
  })

  it('R43: al sincronizar o eliminar, sin respuesta da whatsapp_meta_unreachable', () => {
    expect(templateGraphErrorOf('sync', unreachable, SECRETS)).toBeInstanceOf(WhatsappMetaUnreachableError)
    expect(templateGraphErrorOf('delete', unreachable, SECRETS)).toBeInstanceOf(WhatsappMetaUnreachableError)
  })

  it('R43: al sincronizar o eliminar, todo rechazo da whatsapp_meta_rejected, tambien el nombre repetido y el limite', () => {
    for (const operation of ['sync', 'delete'] as const) {
      for (const failure of [nameTaken, rateLimited, otherRejection]) {
        expect(templateGraphErrorOf(operation, failure, SECRETS)).toBeInstanceOf(WhatsappMetaRejectedError)
      }
    }
  })

  it('R21: el diagnostic lleva code, subcode y el texto de Meta con los secretos tachados', () => {
    const failure: GraphFailure = {
      kind: 'rejected',
      message: `token ${TOKEN} y secreto ${SECRET}`,
      code: 100,
      subcode: 2388024,
    }
    const error = templateGraphErrorOf('create', failure, SECRETS)
    expect(error.diagnostic).toContain('code=100')
    expect(error.diagnostic).toContain('subcode=2388024')
    expect(error.diagnostic).toContain('token [oculto] y secreto [oculto]')
    expect(error.diagnostic).not.toContain(TOKEN)
    expect(error.diagnostic).not.toContain(SECRET)
  })

  it('R21: ni el mensaje ni el diagnostic de ningun error llevan los secretos', () => {
    const failures: GraphFailure[] = [
      { kind: 'unreachable', message: `fallo ${TOKEN}` },
      { kind: 'rejected', message: `fallo ${SECRET}`, code: 80008 },
      { kind: 'rejected', message: `fallo ${TOKEN}`, subcode: 2388024 },
    ]
    for (const operation of ['create', 'sync', 'delete'] as const) {
      for (const failure of failures) {
        const error = templateGraphErrorOf(operation, failure, SECRETS)
        for (const secret of SECRETS) {
          expect(error.message).not.toContain(secret)
          expect(error.diagnostic).not.toContain(secret)
        }
      }
    }
  })

  it('R21: sin code ni subcode el diagnostic lo dice sin romper', () => {
    expect(templateGraphErrorOf('sync', unreachable, SECRETS).diagnostic).toContain('code=-; subcode=-')
  })
})
