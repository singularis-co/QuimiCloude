import { describe, expect, it, vi } from 'vitest'

import { UNREADABLE_SECRET_MESSAGE } from '@/lib/modules/integraciones/domain/connection-secrets'
import type { GraphFailure } from '@/lib/modules/integraciones/domain/graph-failure'
import {
  createProcessWhatsappSend,
  type ProcessWhatsappSendDeps,
} from '@/lib/modules/integraciones/domain/process-whatsapp-send'
import type { WhatsappConnectionRecord } from '@/lib/modules/integraciones/domain/whatsapp-connection'
import type { ClaimedMessage } from '@/lib/modules/integraciones/domain/whatsapp-outbound-message'
import {
  TOKEN_INVALID_MESSAGE,
  rejectedWithCodeReason,
} from '@/lib/modules/integraciones/domain/whatsapp-send-failure'
import type { WhatsappSendJob } from '@/lib/modules/integraciones/domain/whatsapp-send-job'
import { NOT_DELIVERABLE_REASON } from '@/lib/modules/integraciones/domain/whatsapp-send-retry-policy'
import type { GraphMessageSent } from '@/lib/modules/integraciones/ports/whatsapp-graph-client'
import type { WhatsappSendQueueRepository } from '@/lib/modules/integraciones/ports/whatsapp-send-queue-repository'

import {
  ACCESS_TOKEN,
  COMPANY_ID,
  CONNECTION_ID,
  CONTACT_ID,
  NEW_CONNECTION_ID,
  OTHER_COMPANY_ID,
  SENT_WAMID,
  makeCipher,
  makeGraph,
  makeIntegrationsSwitch,
  makeOutbox,
  makeRepository,
  makeSendLog,
  outboxContact,
  outboxMessage,
  storedConnection,
  type OutboxContactRow,
} from '../whatsapp-doubles'

const MESSAGE_ID = '00000000-0000-4000-8000-000000000401'
const WA_ID = '573001234567'
const META_TEXT = `Message failed to send to +${WA_ID}: Hola Ana, su cuenta 123-456`
const COMPONENTS = [{ type: 'body', parameters: [{ type: 'text', text: 'Ana' }] }]

const JOB: WhatsappSendJob = { kind: 'send_message', messageId: MESSAGE_ID, companyId: COMPANY_ID }

function claimedMessage(overrides: Partial<ClaimedMessage> = {}): ClaimedMessage {
  return {
    id: MESSAGE_ID,
    connectionId: CONNECTION_ID,
    contactId: CONTACT_ID,
    templateName: 'aviso_cuenta',
    templateLanguage: 'es_MX',
    templateComponents: COMPONENTS,
    attempts: 1,
    ...overrides,
  }
}

function rejected(code: number | null, subcode: number | null = null): GraphMessageSent {
  return { ok: false, kind: 'rejected', message: META_TEXT, code, subcode }
}

const UNREACHABLE: GraphMessageSent = { ok: false, kind: 'unreachable', message: META_TEXT }

type SetupOptions = {
  addonOn?: boolean
  connection?: Partial<WhatsappConnectionRecord> | null
  contact?: Partial<OutboxContactRow> | null
  claimed?: ClaimedMessage | null
  sent?: GraphMessageSent
  maxRetries?: number
}

function setup(options: SetupOptions = {}) {
  const cipherDouble = makeCipher()
  const connection =
    options.connection === null ? [] : [storedConnection(cipherDouble.seed, { status: 'ACTIVE', ...options.connection })]
  const repository = makeRepository(connection)
  const switchDouble = makeIntegrationsSwitch(options.addonOn ?? true)
  const contacts = options.contact === null ? [] : [outboxContact({ waId: WA_ID, ...options.contact })]
  const outboxDouble = makeOutbox({
    contacts,
    messages: [
      outboxMessage({
        id: MESSAGE_ID,
        sentById: null,
        type: 'TEMPLATE',
        status: 'SENDING',
        origin: 'SYSTEM',
        errorCode: null,
        errorReason: null,
      }),
    ],
  })
  const graphDouble = makeGraph()
  if (options.sent !== undefined) {
    const sent = options.sent
    graphDouble.sendMessage.mockImplementation(async () => sent)
  }
  const logDouble = makeSendLog()
  const claimed = options.claimed === undefined ? claimedMessage() : options.claimed
  const claim = vi.fn<WhatsappSendQueueRepository['claim']>(async (_id, _max, scope) =>
    scope.companyId === COMPANY_ID ? claimed : null,
  )
  const release = vi.fn<WhatsappSendQueueRepository['release']>(async () => undefined)
  const maxRetries = vi.fn(() => options.maxRetries ?? 3)
  const deps: ProcessWhatsappSendDeps = {
    integrations: switchDouble.integrations,
    connections: repository.connections,
    cipher: cipherDouble.cipher,
    queueStore: { claim, release },
    outbox: outboxDouble.outbox,
    graph: graphDouble.graph,
    config: { maxRetries },
    sendLog: logDouble.sendLog,
  }
  return {
    process: createProcessWhatsappSend(deps),
    repository,
    switch: switchDouble,
    cipher: cipherDouble,
    outbox: outboxDouble,
    graph: graphDouble,
    sendFailed: logDouble.sendFailed,
    claim,
    release,
  }
}

type Setup = ReturnType<typeof setup>

function expectNotDeliverable(s: Setup) {
  expect(s.graph.sendMessage).not.toHaveBeenCalled()
  expect(s.outbox.markFailed).toHaveBeenCalledWith(MESSAGE_ID, null, NOT_DELIVERABLE_REASON, { companyId: COMPANY_ID })
  expect(s.outbox.message(MESSAGE_ID)).toMatchObject({ status: 'FAILED', errorCode: null, errorReason: NOT_DELIVERABLE_REASON })
  expect(s.release).not.toHaveBeenCalled()
}

describe('el consumidor de la cola de envios', () => {
  it('R16, R17: reclama el mensaje con el ambito de la empresa del trabajo y el tope 1 + reintentos', async () => {
    const s = setup({ maxRetries: 2 })
    await s.process(JOB)

    expect(s.claim).toHaveBeenCalledWith(MESSAGE_ID, 3, { companyId: COMPANY_ID })
    expect(s.switch.isOn).toHaveBeenCalledWith(COMPANY_ID)
    expect(s.repository.findLive).toHaveBeenCalledWith({ companyId: COMPANY_ID })
    expect(s.outbox.findContact).toHaveBeenCalledWith(CONTACT_ID, CONNECTION_ID, { companyId: COMPANY_ID })
    expect(s.outbox.markSent).toHaveBeenCalledWith(MESSAGE_ID, SENT_WAMID, { companyId: COMPANY_ID })
  })

  it('R18: si el reclamo no cambia ninguna fila responde done sin llamar a Meta ni escribir nada', async () => {
    const s = setup({ claimed: null })

    expect(await s.process(JOB)).toBe('done')
    expect(s.graph.sendMessage).not.toHaveBeenCalled()
    expect(s.cipher.decrypt).not.toHaveBeenCalled()
    expect(s.outbox.markSent).not.toHaveBeenCalled()
    expect(s.outbox.markFailed).not.toHaveBeenCalled()
    expect(s.release).not.toHaveBeenCalled()
    expect(s.repository.update).not.toHaveBeenCalled()
  })

  it('R16, R36: un trabajo con otra empresa no reclama el mensaje ni lo modifica', async () => {
    const s = setup()

    expect(await s.process({ ...JOB, companyId: OTHER_COMPANY_ID })).toBe('done')
    expect(s.claim).toHaveBeenCalledWith(MESSAGE_ID, 4, { companyId: OTHER_COMPANY_ID })
    expect(s.graph.sendMessage).not.toHaveBeenCalled()
    expect(s.outbox.message(MESSAGE_ID)?.status).toBe('SENDING')
  })

  it('R19: con el anadido apagado tras el reclamo lo deja FAILED con el motivo, sin Meta, y responde done', async () => {
    const s = setup({ addonOn: false })

    expect(await s.process(JOB)).toBe('done')
    expectNotDeliverable(s)
  })

  it.each([
    ['sin conexion viva', null],
    ['con la conexion PENDING', { status: 'PENDING' as const }],
    ['con la conexion en ERROR', { status: 'ERROR' as const }],
    ['con la conexion DISABLED', { status: 'DISABLED' as const }],
    ['con otra conexion viva distinta de la del mensaje', { id: NEW_CONNECTION_ID }],
  ])('R19: %s lo deja FAILED con el motivo, sin Meta, y responde done', async (_caso, connection) => {
    const s = setup({ connection })

    expect(await s.process(JOB)).toBe('done')
    expectNotDeliverable(s)
  })

  it.each([
    ['el contacto no existe en la conexion', null],
    ['el contacto esta bloqueado', { blockedAt: new Date('2026-10-01') }],
  ])('R19: si %s lo deja FAILED con el motivo, sin Meta, y responde done', async (_caso, contact) => {
    const s = setup({ contact })

    expect(await s.process(JOB)).toBe('done')
    expectNotDeliverable(s)
  })

  it('R19: si la credencial no se puede descifrar lo deja FAILED, la conexion queda en ERROR y responde done', async () => {
    const s = setup({ connection: { accessTokenEnc: 'v1:ilegible' } })

    expect(await s.process(JOB)).toBe('done')
    expectNotDeliverable(s)
    expect(s.repository.row(CONNECTION_ID)).toMatchObject({ status: 'ERROR', lastError: UNREADABLE_SECRET_MESSAGE })
  })

  it('R20: llama a Meta con el token descifrado, el waId del contacto y la plantilla guardada en el mensaje', async () => {
    const s = setup()
    await s.process(JOB)

    expect(s.graph.sendMessage).toHaveBeenCalledTimes(1)
    expect(s.graph.sendMessage).toHaveBeenCalledWith({
      phoneNumberId: '3456789012',
      accessToken: ACCESS_TOKEN,
      to: WA_ID,
      message: { type: 'template', name: 'aviso_cuenta', language: 'es_MX', components: COMPONENTS },
    })
  })

  it('R21: si Meta acepta guarda el wamid, deja el mensaje SENT y responde done', async () => {
    const s = setup()

    expect(await s.process(JOB)).toBe('done')
    expect(s.outbox.message(MESSAGE_ID)).toMatchObject({ status: 'SENT', wamid: SENT_WAMID })
    expect(s.sendFailed).not.toHaveBeenCalled()
  })

  it('R21: si markSent ya no encuentra el mensaje en SENDING responde done igual, sin reintentar', async () => {
    const s = setup()
    s.outbox.markSent.mockResolvedValueOnce(null)

    expect(await s.process(JOB)).toBe('done')
    expect(s.release).not.toHaveBeenCalled()
  })

  it.each([
    ['red, tiempo, 5xx o 2xx sin wamid', UNREACHABLE],
    ['el limite 130429', rejected(130429)],
    ['el limite 131056', rejected(131056)],
  ])('R22: ante %s devuelve el mensaje a QUEUED conservando los intentos y pide reintentar', async (_caso, sent) => {
    const s = setup({ sent })

    expect(await s.process(JOB)).toBe('requeue')
    expect(s.release).toHaveBeenCalledWith(MESSAGE_ID, { companyId: COMPANY_ID })
    expect(s.outbox.markFailed).not.toHaveBeenCalled()
    expect(s.repository.update).not.toHaveBeenCalled()
    expect(s.sendFailed).toHaveBeenCalledTimes(1)
  })

  it('R23: ante un rechazo permanente lo deja FAILED con el codigo y el motivo en espanol y responde done', async () => {
    const s = setup({ sent: rejected(131026, 7) })

    expect(await s.process(JOB)).toBe('done')
    expect(s.outbox.markFailed).toHaveBeenCalledWith(MESSAGE_ID, '131026', rejectedWithCodeReason(131026), {
      companyId: COMPANY_ID,
    })
    expect(s.release).not.toHaveBeenCalled()
    expect(s.repository.update).not.toHaveBeenCalled()
  })

  it('R23: con el codigo 190 ademas deja la conexion en ERROR con el aviso del token', async () => {
    const s = setup({ sent: rejected(190) })

    expect(await s.process(JOB)).toBe('done')
    expect(s.outbox.message(MESSAGE_ID)).toMatchObject({ status: 'FAILED', errorCode: '190', errorReason: TOKEN_INVALID_MESSAGE })
    expect(s.repository.update).toHaveBeenCalledWith(
      CONNECTION_ID,
      { status: 'ERROR', lastError: TOKEN_INVALID_MESSAGE },
      { companyId: COMPANY_ID },
    )
    expect(s.repository.row(CONNECTION_ID)).toMatchObject({ status: 'ERROR', lastError: TOKEN_INVALID_MESSAGE })
  })

  it('R24: un error no previsto se propaga para que el borde responda 500', async () => {
    const s = setup()
    s.claim.mockRejectedValueOnce(new Error('la base no responde'))

    await expect(s.process(JOB)).rejects.toThrow('la base no responde')
    expect(s.graph.sendMessage).not.toHaveBeenCalled()
  })

  it.each([
    ['temporal', UNREACHABLE, 'unreachable', '-'],
    ['permanente', rejected(131026, 7), 'rejected', '131026'],
  ])('R26: el log de un fallo %s lleva solo el id y el diagnostico, sin texto de Meta, numero, valores ni token', async (_caso, sent, kind, code) => {
    const s = setup({ sent })
    await s.process(JOB)

    expect(s.sendFailed).toHaveBeenCalledWith({
      messageId: MESSAGE_ID,
      diagnostic: expect.stringContaining(`Graph enviar mensaje: ${kind}; code=${code}`),
    })
    const texto = JSON.stringify(s.sendFailed.mock.calls)
    for (const prohibido of [META_TEXT, WA_ID, 'Ana', '123-456', ACCESS_TOKEN]) {
      expect(texto).not.toContain(prohibido)
    }
    expect(Object.keys(s.sendFailed.mock.calls[0]?.[0] ?? {}).sort()).toEqual(['diagnostic', 'messageId'])
  })

  it('R22: la politica temporal y permanente no depende del texto de Meta', async () => {
    const sinTexto: GraphFailure = { kind: 'rejected', message: null, code: 130429 }
    const s = setup({ sent: { ok: false, ...sinTexto } })

    expect(await s.process(JOB)).toBe('requeue')
  })
})
