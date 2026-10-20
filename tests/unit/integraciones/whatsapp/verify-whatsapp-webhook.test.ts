import { describe, expect, it, vi } from 'vitest'

import {
  createVerifyWhatsappWebhook,
  type VerifyWhatsappWebhookInput,
} from '@/lib/modules/integraciones/domain/verify-whatsapp-webhook'
import { resolveWebhookConnection } from '@/lib/modules/integraciones/domain/webhook-connection'
import type { WhatsappConnectionRecord } from '@/lib/modules/integraciones/domain/whatsapp-connection'

import {
  COMPANY_ID,
  CONNECTION_ID,
  NOW,
  OTHER_COMPANY_ID,
  makeCipher,
  makeDigest,
  makeIntegrationsSwitch,
  makeRepository,
  makeWebhookDirectory,
  storedConnection,
} from './whatsapp-doubles'

const VERIFY_TOKEN = 'verify-token-de-prueba'
const CHALLENGE = '1158201444'

type SetupOptions = {
  record?: Partial<WhatsappConnectionRecord>
  /** Empresa que el resolutor dice para `CONNECTION_ID`; `null` = no hay fila viva. */
  directoryCompany?: string | null
  addonOn?: boolean
  rows?: boolean
}

function setup(options: SetupOptions = {}) {
  const digest = makeDigest()
  const cipher = makeCipher()
  const record = storedConnection(cipher.seed, {
    verifyTokenHash: digest.digestOf(VERIFY_TOKEN),
    ...options.record,
  })
  const repo = makeRepository(options.rows === false ? [] : [record])
  const directoryCompany =
    options.directoryCompany === undefined ? record.companyId : options.directoryCompany
  const directory = makeWebhookDirectory(
    directoryCompany === null ? {} : { [CONNECTION_ID]: directoryCompany },
  )
  const integrations = makeIntegrationsSwitch(options.addonOn ?? true)
  const verify = createVerifyWhatsappWebhook({
    directory: directory.directory,
    integrations: integrations.integrations,
    connections: repo.connections,
    digest,
    now: () => NOW,
  })
  /** Ningún puerto tocado: ni la base, ni el añadido, ni el resumen. */
  const expectNoPortCalled = () => {
    expect(directory.companyOfConnection).not.toHaveBeenCalled()
    expect(integrations.isOn).not.toHaveBeenCalled()
    expect(repo.findLiveById).not.toHaveBeenCalled()
    expect(repo.findLive).not.toHaveBeenCalled()
    expect(digest.matches).not.toHaveBeenCalled()
    expect(repo.recordWebhookHandshake).not.toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
  }
  return { record, repo, directory, integrations, digest, verify, expectNoPortCalled }
}

function input(overrides: Partial<VerifyWhatsappWebhookInput> = {}): VerifyWhatsappWebhookInput {
  return {
    connectionId: CONNECTION_ID,
    mode: 'subscribe',
    verifyToken: VERIFY_TOKEN,
    challenge: CHALLENGE,
    ...overrides,
  }
}

describe('verifyWhatsappWebhook: handshake válido', () => {
  it('R5, R6: con token correcto devuelve el challenge tal cual y deja ACTIVE una conexión PENDING', async () => {
    const { verify, repo } = setup({ record: { status: 'PENDING' } })
    const challenge = '  abc-123 ñ  '

    const result = await verify(input({ challenge }))

    expect(result).toEqual({ kind: 'verified', challenge })
    expect(repo.recordWebhookHandshake).toHaveBeenCalledTimes(1)
    expect(repo.recordWebhookHandshake).toHaveBeenCalledWith(CONNECTION_ID, NOW, { companyId: COMPANY_ID })
    expect(repo.row(CONNECTION_ID)).toMatchObject({ status: 'ACTIVE', lastWebhookAt: NOW })
  })

  it('R5: el token se compara contra el resumen guardado, nunca en claro', async () => {
    const { verify, digest, record } = setup()

    await verify(input())

    expect(digest.matches).toHaveBeenCalledWith(VERIFY_TOKEN, record.verifyTokenHash)
  })

  it.each(['ACTIVE', 'ERROR'] as const)(
    'R6: una conexión %s conserva su estado y gana lastWebhookAt',
    async (status) => {
      const { verify, repo } = setup({ record: { status } })

      expect(await verify(input())).toEqual({ kind: 'verified', challenge: CHALLENGE })

      expect(repo.recordWebhookHandshake).toHaveBeenCalledWith(CONNECTION_ID, NOW, { companyId: COMPANY_ID })
      expect(repo.row(CONNECTION_ID)).toMatchObject({ status, lastWebhookAt: NOW })
    },
  )

  it('R6: si la deshabilitan entre la lectura y la escritura, sigue DISABLED', async () => {
    const { verify, repo, record } = setup({ record: { status: 'DISABLED' } })
    // La lectura la vio PENDING; la fila ya está DISABLED cuando llega la escritura.
    repo.findLiveById.mockResolvedValueOnce({ ...record, status: 'PENDING' })

    expect(await verify(input())).toEqual({ kind: 'verified', challenge: CHALLENGE })

    expect(repo.row(CONNECTION_ID)).toMatchObject({ status: 'DISABLED', lastWebhookAt: null })
  })
})

describe('verifyWhatsappWebhook: sin servicios externos', () => {
  it('R26: el handshake no llama a fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { verify } = setup()

    expect((await verify(input())).kind).toBe('verified')
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

describe('verifyWhatsappWebhook: rechazos', () => {
  it.each([
    ['hub.mode distinto de subscribe', { mode: 'unsubscribe' }],
    ['hub.mode en mayúsculas', { mode: 'SUBSCRIBE' }],
    ['sin hub.mode', { mode: null }],
    ['hub.mode vacío', { mode: '' }],
    ['sin hub.verify_token', { verifyToken: null }],
    ['hub.verify_token vacío', { verifyToken: '' }],
    ['sin hub.challenge', { challenge: null }],
    ['hub.challenge vacío', { challenge: '' }],
  ] as const)('R7: %s ⇒ forbidden(bad_request) sin tocar ningún puerto', async (_caso, overrides) => {
    const { verify, repo, record, expectNoPortCalled } = setup()

    expect(await verify(input(overrides))).toEqual({ kind: 'forbidden', reason: 'bad_request' })

    expectNoPortCalled()
    expect(repo.row(CONNECTION_ID)).toEqual(record)
  })

  it.each(['no-es-uuid', '', '00000000-0000-4000-8000-00000000000', `${CONNECTION_ID}x`, "1' OR '1'='1"])(
    'R3: el id %j sin forma de UUID ⇒ forbidden(missing) sin llamar a ningún puerto',
    async (connectionId) => {
      const { verify, expectNoPortCalled } = setup()

      expect(await verify(input({ connectionId }))).toEqual({ kind: 'forbidden', reason: 'missing' })

      expectNoPortCalled()
    },
  )

  it('R7: conexión inexistente (el resolutor no la encuentra) ⇒ forbidden(missing), sin handshake', async () => {
    const { verify, repo, digest, integrations } = setup({ directoryCompany: null })

    expect(await verify(input())).toEqual({ kind: 'forbidden', reason: 'missing' })

    expect(integrations.isOn).not.toHaveBeenCalled()
    expect(repo.findLiveById).not.toHaveBeenCalled()
    expect(digest.matches).not.toHaveBeenCalled()
    expect(repo.recordWebhookHandshake).not.toHaveBeenCalled()
  })

  it('R7: la fila desaparece entre el resolutor y la lectura con ámbito ⇒ forbidden(missing), sin handshake', async () => {
    const { verify, repo, digest } = setup({ rows: false, directoryCompany: COMPANY_ID })

    expect(await verify(input())).toEqual({ kind: 'forbidden', reason: 'missing' })

    expect(repo.findLiveById).toHaveBeenCalledTimes(1)
    expect(digest.matches).not.toHaveBeenCalled()
    expect(repo.recordWebhookHandshake).not.toHaveBeenCalled()
  })

  it('R7: conexión DISABLED ⇒ forbidden(disabled), sin comprobar el token ni hacer handshake', async () => {
    const { verify, repo, digest, record } = setup({ record: { status: 'DISABLED' } })

    expect(await verify(input())).toEqual({ kind: 'forbidden', reason: 'disabled' })

    expect(digest.matches).not.toHaveBeenCalled()
    expect(repo.recordWebhookHandshake).not.toHaveBeenCalled()
    expect(repo.row(CONNECTION_ID)).toEqual(record)
  })

  it('R4, R7: añadido integraciones apagado ⇒ forbidden(addon_off), sin leer la conexión ni hacer handshake', async () => {
    const { verify, repo, digest, integrations, record } = setup({ addonOn: false })

    expect(await verify(input())).toEqual({ kind: 'forbidden', reason: 'addon_off' })

    expect(integrations.isOn).toHaveBeenCalledWith(COMPANY_ID)
    expect(repo.findLiveById).not.toHaveBeenCalled()
    expect(digest.matches).not.toHaveBeenCalled()
    expect(repo.recordWebhookHandshake).not.toHaveBeenCalled()
    expect(repo.row(CONNECTION_ID)).toEqual(record)
  })

  it('R7: token que no coincide ⇒ forbidden(token_mismatch), sin handshake ni cambios en la fila', async () => {
    const { verify, repo, record } = setup()

    expect(await verify(input({ verifyToken: `${VERIFY_TOKEN}-otro` }))).toEqual({
      kind: 'forbidden',
      reason: 'token_mismatch',
    })

    expect(repo.recordWebhookHandshake).not.toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
    expect(repo.row(CONNECTION_ID)).toEqual(record)
  })
})

describe('resolveWebhookConnection: el ámbito sale de la fila', () => {
  function deps(options: SetupOptions = {}) {
    const { repo, directory, integrations, record } = setup(options)
    return {
      repo,
      directory,
      integrations,
      record,
      deps: { directory: directory.directory, integrations: integrations.integrations, connections: repo.connections },
    }
  }

  it('R2: el ámbito pasado a findLiveById y devuelto es el que dio el resolutor, no otro', async () => {
    const { deps: d, repo, integrations, record } = deps({ record: { companyId: OTHER_COMPANY_ID } })

    const result = await resolveWebhookConnection(d, CONNECTION_ID)

    expect(integrations.isOn).toHaveBeenCalledWith(OTHER_COMPANY_ID)
    expect(repo.findLiveById).toHaveBeenCalledWith(CONNECTION_ID, { companyId: OTHER_COMPANY_ID })
    expect(result).toEqual({ kind: 'ready', record, scope: { companyId: OTHER_COMPANY_ID } })
  })

  it('R2: si el resolutor da otra empresa que la de la fila, la lectura con ámbito no la ve ⇒ missing', async () => {
    const { deps: d, repo } = deps({ record: { companyId: COMPANY_ID }, directoryCompany: OTHER_COMPANY_ID })

    expect(await resolveWebhookConnection(d, CONNECTION_ID)).toEqual({ kind: 'missing' })
    expect(repo.findLiveById).toHaveBeenCalledWith(CONNECTION_ID, { companyId: OTHER_COMPANY_ID })
  })

  it('R2: el resolutor recibe el id de la URL y nada más', async () => {
    const { deps: d, directory } = deps()

    await resolveWebhookConnection(d, CONNECTION_ID)

    expect(directory.companyOfConnection).toHaveBeenCalledTimes(1)
    expect(directory.companyOfConnection).toHaveBeenCalledWith(CONNECTION_ID)
  })

  it('R3: un id sin forma de UUID ⇒ missing sin llamar a ningún puerto', async () => {
    const { deps: d, directory, integrations, repo } = deps()

    expect(await resolveWebhookConnection(d, 'no-es-uuid')).toEqual({ kind: 'missing' })
    expect(directory.companyOfConnection).not.toHaveBeenCalled()
    expect(integrations.isOn).not.toHaveBeenCalled()
    expect(repo.findLiveById).not.toHaveBeenCalled()
  })
})
