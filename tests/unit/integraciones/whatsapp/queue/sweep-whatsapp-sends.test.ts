import { describe, expect, it, vi } from 'vitest'

import {
  SWEEP_BATCH,
  createSweepWhatsappSends,
  type SweepWhatsappSendsDeps,
} from '@/lib/modules/integraciones/domain/sweep-whatsapp-sends'
import {
  NOT_DELIVERABLE_REASON,
  QUEUED_STALE_MS,
  RETRIES_EXHAUSTED_REASON,
  SENDING_STUCK_MS,
  SENDING_STUCK_REASON,
} from '@/lib/modules/integraciones/domain/whatsapp-send-retry-policy'
import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'
import type { WhatsappQueueLog } from '@/lib/modules/integraciones/ports/whatsapp-queue-log'
import type { WhatsappSendQueue } from '@/lib/modules/integraciones/ports/whatsapp-send-queue'
import type { WhatsappSendQueueRepository } from '@/lib/modules/integraciones/ports/whatsapp-send-queue-repository'

import { COMPANY_ID, NOW, OTHER_COMPANY_ID } from '../whatsapp-doubles'

const THIRD_COMPANY_ID = '00000000-0000-4000-8000-0000000000cd'
const MESSAGE_A = '00000000-0000-4000-8000-000000000501'
const MESSAGE_B = '00000000-0000-4000-8000-000000000502'

const QUEUED_BEFORE = new Date(NOW.getTime() - QUEUED_STALE_MS)
const SENDING_BEFORE = new Date(NOW.getTime() - SENDING_STUCK_MS)

type SetupOptions = {
  companies?: readonly string[]
  addonOff?: readonly string[]
  stale?: Readonly<Record<string, readonly string[]>>
  maxRetries?: number
  budgetMs?: number
}

function setup(options: SetupOptions = {}) {
  const calls: string[] = []
  const track =
    <A extends unknown[], R>(name: string, impl: (...args: A) => Promise<R>) =>
    (...args: A) => {
      const scope = args[args.length - 1] as IntegracionesScope | string
      calls.push(`${name}:${typeof scope === 'string' ? scope : scope.companyId}`)
      return impl(...args)
    }
  const stale = options.stale ?? { [COMPANY_ID]: [MESSAGE_A, MESSAGE_B] }
  const failStuckSending = vi.fn<WhatsappSendQueueRepository['failStuckSending']>(track('stuck', async () => 1))
  const failExhausted = vi.fn<WhatsappSendQueueRepository['failExhausted']>(track('exhausted', async () => 2))
  const failStaleQueued = vi.fn<WhatsappSendQueueRepository['failStaleQueued']>(track('staleFailed', async () => 4))
  const listStaleQueued = vi.fn<WhatsappSendQueueRepository['listStaleQueued']>(
    track('listStale', async (_before: Date, _max: number, _limit: number, scope: IntegracionesScope) => stale[scope.companyId] ?? []),
  )
  const recordPublished = vi.fn<WhatsappSendQueueRepository['recordPublished']>(track('recordPublished', async () => undefined))
  const publish = vi.fn<WhatsappSendQueue['publish']>(async (job) => {
    calls.push(`publish:${job.companyId}`)
    return `cola-${job.messageId}`
  })
  const isOn = vi.fn(async (companyId: string) => {
    calls.push(`isOn:${companyId}`)
    return !(options.addonOff ?? []).includes(companyId)
  })
  const listCompanyIds = vi.fn(async () => options.companies ?? [COMPANY_ID])
  const log = {
    info: vi.fn<WhatsappQueueLog['info']>(),
    warn: vi.fn<WhatsappQueueLog['warn']>(),
    error: vi.fn<WhatsappQueueLog['error']>(),
  }
  const deps: SweepWhatsappSendsDeps = {
    listCompanyIds,
    integrations: { isOn },
    queueStore: { failStuckSending, failExhausted, failStaleQueued, listStaleQueued, recordPublished },
    queue: { publish },
    config: { maxRetries: () => options.maxRetries ?? 3 },
    log,
    now: () => NOW,
    budgetMs: options.budgetMs,
  }
  return {
    sweep: createSweepWhatsappSends(deps),
    calls,
    failStuckSending,
    failExhausted,
    failStaleQueued,
    listStaleQueued,
    recordPublished,
    publish,
    isOn,
    listCompanyIds,
    log,
  }
}

describe('el barrido de envios del sistema', () => {
  it('R28: recorre las empresas de una en una, cada consulta con el ambito de una sola empresa', async () => {
    const s = setup({ companies: [COMPANY_ID, OTHER_COMPANY_ID], stale: {} })
    await s.sweep()

    expect(s.calls).toEqual([
      `stuck:${COMPANY_ID}`,
      `exhausted:${COMPANY_ID}`,
      `isOn:${COMPANY_ID}`,
      `listStale:${COMPANY_ID}`,
      `stuck:${OTHER_COMPANY_ID}`,
      `exhausted:${OTHER_COMPANY_ID}`,
      `isOn:${OTHER_COMPANY_ID}`,
      `listStale:${OTHER_COMPANY_ID}`,
    ])
  })

  it('R28: el fallo de una empresa no detiene a las demas; se registra con su codigo y entra en el resumen', async () => {
    const s = setup({ companies: [COMPANY_ID, OTHER_COMPANY_ID, THIRD_COMPANY_ID], stale: {} })
    s.failExhausted.mockImplementationOnce(async () => 2)
    s.failExhausted.mockImplementationOnce(async () => {
      throw Object.assign(new Error('fallo con datos del mensaje'), { code: 'P1001' })
    })

    const result = await s.sweep()

    expect(result.companiesFailed).toEqual([{ companyId: OTHER_COMPANY_ID, code: 'P1001' }])
    expect(s.failStuckSending).toHaveBeenCalledWith(SENDING_BEFORE, SENDING_STUCK_REASON, { companyId: THIRD_COMPANY_ID })
    expect(s.listStaleQueued).toHaveBeenCalledWith(QUEUED_BEFORE, 4, SWEEP_BATCH, { companyId: THIRD_COMPANY_ID })
    expect(s.log.error).toHaveBeenCalledWith('whatsapp_sweep_company_failed', { companyId: OTHER_COMPANY_ID, code: 'P1001' })
    expect(JSON.stringify(s.log.error.mock.calls)).not.toContain('datos del mensaje')
  })

  it('R28: el resumen solo trae cuantos republico, cuantos marco FAILED y las empresas que fallaron', async () => {
    const s = setup()
    const result = await s.sweep()

    expect(result).toEqual({ republished: 2, failed: 3, companiesFailed: [] })
  })

  it('R28: un error sin codigo se resume como inesperado', async () => {
    const s = setup()
    s.failStuckSending.mockRejectedValueOnce(new Error('caida'))

    const result = await s.sweep()

    expect(result.companiesFailed).toEqual([{ companyId: COMPANY_ID, code: 'unexpected' }])
  })

  it('R28: al agotar el presupuesto de tiempo no empieza otra empresa', async () => {
    const s = setup({ companies: [COMPANY_ID, OTHER_COMPANY_ID], budgetMs: 0 })
    const result = await s.sweep()

    expect(s.failStuckSending).not.toHaveBeenCalled()
    expect(result).toEqual({ republished: 0, failed: 0, companiesFailed: [] })
  })

  it('R29: vuelve a publicar los QUEUED viejos sin agotar el tope, guarda el nuevo id de la cola y renueva su marca', async () => {
    const s = setup({ maxRetries: 2 })
    const result = await s.sweep()

    expect(s.listStaleQueued).toHaveBeenCalledWith(QUEUED_BEFORE, 3, SWEEP_BATCH, { companyId: COMPANY_ID })
    expect(s.publish).toHaveBeenNthCalledWith(1, { kind: 'send_message', messageId: MESSAGE_A, companyId: COMPANY_ID })
    expect(s.publish).toHaveBeenNthCalledWith(2, { kind: 'send_message', messageId: MESSAGE_B, companyId: COMPANY_ID })
    expect(s.recordPublished).toHaveBeenCalledWith(MESSAGE_A, `cola-${MESSAGE_A}`, { companyId: COMPANY_ID })
    expect(s.recordPublished).toHaveBeenCalledWith(MESSAGE_B, `cola-${MESSAGE_B}`, { companyId: COMPANY_ID })
    expect(result.republished).toBe(2)
  })

  it('R30: si volver a publicar uno falla, queda en cola, se registra y sigue con los demas', async () => {
    const s = setup()
    s.publish.mockRejectedValueOnce(new Error('QStash 503 con token qstash_secreto'))

    const result = await s.sweep()

    expect(s.recordPublished).toHaveBeenCalledTimes(1)
    expect(s.recordPublished).toHaveBeenCalledWith(MESSAGE_B, `cola-${MESSAGE_B}`, { companyId: COMPANY_ID })
    expect(s.log.warn).toHaveBeenCalledWith('whatsapp_sweep_publish_failed', { messageId: MESSAGE_A })
    expect(JSON.stringify(s.log.warn.mock.calls)).not.toContain('qstash_secreto')
    expect(result).toMatchObject({ republished: 1, companiesFailed: [] })
  })

  it('R31: deja FAILED los QUEUED que alcanzaron el tope, con su motivo fijo', async () => {
    const s = setup({ maxRetries: 5 })
    await s.sweep()

    expect(s.failExhausted).toHaveBeenCalledWith(6, RETRIES_EXHAUSTED_REASON, { companyId: COMPANY_ID })
  })

  it('R32: deja FAILED los SENDING de mas de 10 minutos con su motivo fijo, antes de republicar, y nunca los publica', async () => {
    const s = setup({ stale: {} })
    const result = await s.sweep()

    expect(s.failStuckSending).toHaveBeenCalledWith(SENDING_BEFORE, SENDING_STUCK_REASON, { companyId: COMPANY_ID })
    expect(s.failStuckSending.mock.invocationCallOrder[0]).toBeLessThan(s.listStaleQueued.mock.invocationCallOrder[0] ?? 0)
    expect(s.publish).not.toHaveBeenCalled()
    expect(result).toEqual({ republished: 0, failed: 3, companiesFailed: [] })
  })

  it('R33, R36: todo lo que el barrido lee y escribe pasa por el repositorio de la cola, que solo ve mensajes SYSTEM de una empresa', async () => {
    const s = setup({ companies: [COMPANY_ID, OTHER_COMPANY_ID] })
    await s.sweep()

    for (const spy of [s.failStuckSending, s.failExhausted, s.listStaleQueued, s.recordPublished]) {
      for (const args of spy.mock.calls) {
        const scope = args[args.length - 1] as IntegracionesScope
        expect(Object.keys(scope)).toEqual(['companyId'])
        expect([COMPANY_ID, OTHER_COMPANY_ID]).toContain(scope.companyId)
      }
    }
  })

  it('R34: con el anadido apagado no republica y deja FAILED con el motivo de no enviable los QUEUED de mas de 5 minutos', async () => {
    const s = setup({ companies: [COMPANY_ID, OTHER_COMPANY_ID], addonOff: [COMPANY_ID], stale: { [OTHER_COMPANY_ID]: [MESSAGE_B] } })
    const result = await s.sweep()

    expect(s.failStaleQueued).toHaveBeenCalledTimes(1)
    expect(s.failStaleQueued).toHaveBeenCalledWith(QUEUED_BEFORE, NOT_DELIVERABLE_REASON, { companyId: COMPANY_ID })
    expect(s.listStaleQueued).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), {
      companyId: COMPANY_ID,
    })
    expect(s.publish).toHaveBeenCalledTimes(1)
    expect(s.publish).toHaveBeenCalledWith({ kind: 'send_message', messageId: MESSAGE_B, companyId: OTHER_COMPANY_ID })
    expect(s.failStuckSending).toHaveBeenCalledWith(SENDING_BEFORE, SENDING_STUCK_REASON, { companyId: COMPANY_ID })
    expect(s.failExhausted).toHaveBeenCalledWith(4, RETRIES_EXHAUSTED_REASON, { companyId: COMPANY_ID })
    expect(result).toEqual({ republished: 1, failed: 1 + 2 + 4 + 1 + 2, companiesFailed: [] })
  })
})
