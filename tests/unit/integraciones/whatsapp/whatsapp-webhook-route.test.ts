// El Route Handler del webhook de WhatsApp, invocado DIRECTO con un `Request` normal, sin levantar
// Next. Los casos de uso se doblan en `@/lib/composition`: aqui se prueba la lectura de la entrada,
// la traduccion de cada resultado a su codigo y lo que llega a los logs. El recorrido real contra
// la base vive en `tests/integration/integraciones/whatsapp-webhook-route.int.test.ts`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { messagesNotification, PHONE_NUMBER_ID, SENDER, textMessage } from './whatsapp-webhook-fixtures'

import { decideRouteAccess } from '@/lib/modules/identity'
import { GET, POST } from '@/lib/modules/integraciones/adapters/driving/whatsapp-webhook-route'
import {
  DASHBOARD_ROUTE,
  LOGIN_ROUTE,
  PRIVATE_ROUTE_PREFIXES,
  whatsappWebhookPath,
} from '@/lib/shared/routes'

const { verifyMock, receiveMock, resyncMock, afterMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  receiveMock: vi.fn(),
  resyncMock: vi.fn(),
  afterMock: vi.fn(),
}))

vi.mock('@/lib/composition', () => ({
  integraciones: {
    verifyWhatsappWebhook: verifyMock,
    receiveWhatsappWebhook: receiveMock,
    resyncWhatsappTemplates: resyncMock,
  },
}))

// `after` se sustituye por una cola: la tarea no corre hasta que el test la vacia, igual que en
// Next no corre hasta despues de mandar la respuesta.
vi.mock('next/server', () => ({ after: afterMock }))

const CONEXION = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const NO_UUID = 'no-es-un-uuid'
const TOKEN = 'token-de-verificacion-secreto'
const CHALLENGE = '1158201444'
const FIRMA = `sha256=${'ab'.repeat(32)}`
const TEXTO = 'texto de prueba que no debe registrarse'
const CUERPO = JSON.stringify(messagesNotification([textMessage(TEXTO)]))

const SENSIBLES = [CUERPO, TOKEN, FIRMA, 'ab'.repeat(32), SENDER, TEXTO, PHONE_NUMBER_ID]

const SIN_SALTADOS = { changes: 0, messages: 0, statuses: 0, templates: 0 }

/** Las tareas que la ruta dejo en `after`, en orden; vaciarla las corre y espera a todas. */
const pendientes: (() => Promise<unknown>)[] = []

async function vaciarAfter(): Promise<void> {
  while (pendientes.length > 0) await (pendientes.shift() as () => Promise<unknown>)()
}

function contexto(conexionId: string = CONEXION) {
  return { params: Promise.resolve({ conexionId }) }
}

function getCon(query: string, conexionId: string = CONEXION): Promise<Response> {
  const request = new Request(`https://app.invalida${whatsappWebhookPath(conexionId)}?${query}`)
  return GET(request, contexto(conexionId))
}

function postCon(
  body: BodyInit = CUERPO,
  headers: Record<string, string> = { 'x-hub-signature-256': FIRMA },
  conexionId: string = CONEXION,
): Promise<Response> {
  const request = new Request(`https://app.invalida${whatsappWebhookPath(conexionId)}`, {
    method: 'POST',
    headers,
    body,
  })
  return POST(request, contexto(conexionId))
}

const QUERY_PUNTO = new URLSearchParams({
  'hub.mode': 'subscribe',
  'hub.verify_token': TOKEN,
  'hub.challenge': CHALLENGE,
}).toString()

let warnSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>

function argumentosLogueados(): string {
  return JSON.stringify([...warnSpy.mock.calls, ...errorSpy.mock.calls])
}

function expectSinDatosSensibles(): void {
  const logs = argumentosLogueados()
  for (const sensible of SENSIBLES) expect(logs).not.toContain(sensible)
}

beforeEach(() => {
  verifyMock.mockReset()
  receiveMock.mockReset()
  resyncMock.mockReset()
  afterMock.mockReset()
  pendientes.length = 0
  afterMock.mockImplementation((tarea: () => Promise<unknown>) => {
    pendientes.push(tarea)
  })
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  warnSpy.mockRestore()
  errorSpy.mockRestore()
})

describe('R1: la ruta del webhook queda fuera de la sesion', () => {
  it('R1: decideRouteAccess deja pasar la ruta del webhook a una sesion anonima, sin redirigir al login', () => {
    const decision = decideRouteAccess({
      pathname: whatsappWebhookPath(CONEXION),
      search: QUERY_PUNTO,
      session: { kind: 'anonymous' },
      privatePrefixes: PRIVATE_ROUTE_PREFIXES,
      routes: { login: LOGIN_ROUTE, landing: DASHBOARD_ROUTE },
    })

    expect(decision).toEqual({ kind: 'allow' })
  })

  it('R1: GET y POST responden sin cookie ni cabecera de sesion', async () => {
    verifyMock.mockResolvedValue({ kind: 'verified', challenge: CHALLENGE })
    receiveMock.mockResolvedValue({ kind: 'stored', counts: { messages: 1, statuses: 0 }, skipped: SIN_SALTADOS, followUp: null })

    expect((await getCon(QUERY_PUNTO)).status).toBe(200)
    expect((await postCon()).status).toBe(200)
  })
})

describe('GET: el handshake de Meta', () => {
  it('R8: lee hub.mode, hub.verify_token y hub.challenge por su nombre con punto y los pasa con el id de la URL', async () => {
    verifyMock.mockResolvedValue({ kind: 'verified', challenge: CHALLENGE })

    await getCon(QUERY_PUNTO)

    expect(verifyMock).toHaveBeenCalledWith({
      connectionId: CONEXION,
      mode: 'subscribe',
      verifyToken: TOKEN,
      challenge: CHALLENGE,
    })
  })

  it('R8: verificado ⇒ 200, text/plain, sin cache y el challenge exacto como cuerpo', async () => {
    verifyMock.mockResolvedValue({ kind: 'verified', challenge: CHALLENGE })

    const response = await getCon(QUERY_PUNTO)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).toBe(CHALLENGE)
  })

  it('R8: solo las variantes hub_* ⇒ el caso de uso recibe los tres en null y la ruta responde 403', async () => {
    verifyMock.mockResolvedValue({ kind: 'forbidden', reason: 'bad_request' })
    const query = new URLSearchParams({
      hub_mode: 'subscribe',
      hub_verify_token: TOKEN,
      hub_challenge: CHALLENGE,
    }).toString()

    const response = await getCon(query)

    expect(verifyMock).toHaveBeenCalledWith({
      connectionId: CONEXION,
      mode: null,
      verifyToken: null,
      challenge: null,
    })
    expect(response.status).toBe(403)
    expect(await response.text()).toBe('')
  })

  it.each(['bad_request', 'missing', 'addon_off', 'disabled', 'token_mismatch'] as const)(
    'R7: forbidden(%s) ⇒ 403 sin cuerpo, identico en todos los casos, y la razon solo en el log',
    async (reason) => {
      verifyMock.mockResolvedValue({ kind: 'forbidden', reason })

      const response = await getCon(QUERY_PUNTO)

      expect(response.status).toBe(403)
      expect(await response.text()).toBe('')
      expect(warnSpy).toHaveBeenCalledWith('whatsapp_webhook_verify_rejected', { reason })
      expectSinDatosSensibles()
    },
  )
})

describe('POST: la entrega de Meta', () => {
  it('R10: pasa al caso de uso los bytes exactos del cuerpo, la cabecera de firma y el id de la URL', async () => {
    receiveMock.mockResolvedValue({ kind: 'stored', counts: { messages: 1, statuses: 0 }, skipped: SIN_SALTADOS, followUp: null })
    // Un BOM y un byte que no es UTF-8 valido: decodificar y volver a codificar los cambiaria.
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0xff, 0x7d])

    await postCon(bytes)

    expect(receiveMock).toHaveBeenCalledTimes(1)
    const input = receiveMock.mock.calls[0][0]
    expect(input.connectionId).toBe(CONEXION)
    expect(input.signature).toBe(FIRMA)
    expect(input.rawBody).toBeInstanceOf(Uint8Array)
    expect(Array.from(input.rawBody as Uint8Array)).toEqual(Array.from(bytes))
  })

  it('R11: sin cabecera de firma ⇒ el caso de uso recibe signature null', async () => {
    receiveMock.mockResolvedValue({ kind: 'unauthorized' })

    await postCon(CUERPO, {})

    expect(receiveMock.mock.calls[0][0].signature).toBeNull()
  })

  it('R16: stored sin nada saltado ⇒ 200 sin cuerpo y sin log', async () => {
    receiveMock.mockResolvedValue({
      kind: 'stored',
      counts: { messages: 2, statuses: 1 },
      skipped: SIN_SALTADOS,
      followUp: null,
    })

    const response = await postCon()

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('R15: stored con cambios saltados ⇒ 200 sin cuerpo y una sola linea de log con los conteos', async () => {
    receiveMock.mockResolvedValue({
      kind: 'stored',
      counts: { messages: 1, statuses: 0 },
      skipped: { changes: 1, messages: 2, statuses: 3, templates: 0 },
      followUp: null,
    })

    const response = await postCon()

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith('whatsapp_webhook_changes_skipped', {
      connectionId: CONEXION,
      changes: 1,
      messages: 2,
      statuses: 3,
      templates: 0,
    })
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('R39: stored con solo cambios de plantillas saltados ⇒ la misma linea de log, con su conteo', async () => {
    receiveMock.mockResolvedValue({
      kind: 'stored',
      counts: { messages: 0, statuses: 0 },
      skipped: { changes: 0, messages: 0, statuses: 0, templates: 2 },
      followUp: null,
    })

    const response = await postCon()

    expect(response.status).toBe(200)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith('whatsapp_webhook_changes_skipped', {
      connectionId: CONEXION,
      changes: 0,
      messages: 0,
      statuses: 0,
      templates: 2,
    })
  })

  it.each(['addon_off', 'disabled', 'unparseable'] as const)(
    'R9, R13: ignored(%s) ⇒ 200 sin cuerpo, con la razon y el id de la conexion en el log',
    async (reason) => {
      receiveMock.mockResolvedValue({ kind: 'ignored', reason })

      const response = await postCon()

      expect(response.status).toBe(200)
      expect(await response.text()).toBe('')
      expect(warnSpy).toHaveBeenCalledWith('whatsapp_webhook_ignored', { reason, connectionId: CONEXION })
      expectSinDatosSensibles()
    },
  )

  it('R9: ignored(missing) ⇒ 200 sin cuerpo y el log no lleva el id que escribio un desconocido', async () => {
    receiveMock.mockResolvedValue({ kind: 'ignored', reason: 'missing' })

    const response = await postCon(CUERPO, { 'x-hub-signature-256': FIRMA }, NO_UUID)

    expect(response.status).toBe(200)
    expect(warnSpy).toHaveBeenCalledWith('whatsapp_webhook_ignored', { reason: 'missing' })
    expect(argumentosLogueados()).not.toContain(NO_UUID)
  })

  it('R11: unauthorized ⇒ 401 sin cuerpo y un log sin la firma', async () => {
    receiveMock.mockResolvedValue({ kind: 'unauthorized' })

    const response = await postCon()

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('')
    expect(warnSpy).toHaveBeenCalledWith('whatsapp_webhook_bad_signature')
    expectSinDatosSensibles()
  })

  it('R12: secret_unreadable ⇒ 500 sin cuerpo y error con el id de la conexion', async () => {
    receiveMock.mockResolvedValue({ kind: 'secret_unreadable' })

    const response = await postCon()

    expect(response.status).toBe(500)
    expect(await response.text()).toBe('')
    expect(errorSpy).toHaveBeenCalledWith('whatsapp_webhook_secret_unreadable', { connectionId: CONEXION })
    expectSinDatosSensibles()
  })

  it('R23: una excepcion del caso de uso ⇒ 500 sin cuerpo y error con el mensaje recortado', async () => {
    receiveMock.mockRejectedValue(new Error(`fallo de la transaccion ${'x'.repeat(1000)}`))

    const response = await postCon()

    expect(response.status).toBe(500)
    expect(await response.text()).toBe('')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    const [evento, detalle] = errorSpy.mock.calls[0] as [string, { connectionId: string; error: string }]
    expect(evento).toBe('whatsapp_webhook_store_failed')
    expect(detalle.connectionId).toBe(CONEXION)
    expect(detalle.error.startsWith('fallo de la transaccion')).toBe(true)
    expect(detalle.error.length).toBeLessThanOrEqual(300)
    expectSinDatosSensibles()
  })

  it('R23: una excepcion con un id que no es UUID ⇒ 500 y el log no registra ese id', async () => {
    receiveMock.mockRejectedValue(new Error('fallo'))

    const response = await postCon(CUERPO, { 'x-hub-signature-256': FIRMA }, NO_UUID)

    expect(response.status).toBe(500)
    expect(errorSpy).toHaveBeenCalledWith('whatsapp_webhook_store_failed', { connectionId: null, error: 'fallo' })
    expect(argumentosLogueados()).not.toContain(NO_UUID)
  })
})

describe('R27: ningun log de la ruta lleva datos sensibles', () => {
  it('R27: recorriendo cada resultado de GET y POST, ningun argumento logueado contiene el cuerpo, la firma, el token, el wa_id, el texto ni el phone_number_id', async () => {
    for (const reason of ['bad_request', 'missing', 'addon_off', 'disabled', 'token_mismatch'] as const) {
      verifyMock.mockResolvedValueOnce({ kind: 'forbidden', reason })
      await getCon(QUERY_PUNTO)
    }
    for (const result of [
      { kind: 'ignored', reason: 'missing' },
      { kind: 'ignored', reason: 'addon_off' },
      { kind: 'ignored', reason: 'disabled' },
      { kind: 'ignored', reason: 'unparseable' },
      { kind: 'unauthorized' },
      { kind: 'secret_unreadable' },
      { kind: 'stored', counts: { messages: 1, statuses: 0 }, skipped: SIN_SALTADOS, followUp: null },
      {
        kind: 'stored',
        counts: { messages: 1, statuses: 0 },
        skipped: { changes: 1, messages: 1, statuses: 1, templates: 1 },
        followUp: null,
      },
    ]) {
      receiveMock.mockResolvedValueOnce(result)
      await postCon()
    }
    receiveMock.mockRejectedValueOnce(new Error('fallo de la base'))
    await postCon()

    expect(warnSpy.mock.calls.length + errorSpy.mock.calls.length).toBeGreaterThan(0)
    expect(warnSpy.mock.calls.map((llamada: unknown[]) => llamada[0])).toContain('whatsapp_webhook_changes_skipped')
    expectSinDatosSensibles()
  })
})

describe('R38: la resincronizacion de plantillas corre despues de responder', () => {
  const STORED_CON_SEGUIMIENTO = {
    kind: 'stored',
    counts: { messages: 0, statuses: 0 },
    skipped: SIN_SALTADOS,
    followUp: 'resync_templates',
  } as const
  const SUMMARY = { imported: 1, updated: 0, deleted: 0, skipped: 0, syncedAt: '2026-10-20T12:00:00.000Z' }

  it('R38: con followUp ⇒ 200 y after llamado UNA vez; la resincronizacion no corre antes de responder', async () => {
    receiveMock.mockResolvedValue(STORED_CON_SEGUIMIENTO)
    resyncMock.mockResolvedValue({ kind: 'synced', summary: SUMMARY })

    const response = await postCon()

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
    expect(afterMock).toHaveBeenCalledTimes(1)
    expect(resyncMock).not.toHaveBeenCalled()

    await vaciarAfter()

    expect(resyncMock).toHaveBeenCalledTimes(1)
    expect(resyncMock).toHaveBeenCalledWith(CONEXION)
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('R38: sin followUp after no se llama, en ningun resultado', async () => {
    for (const result of [
      { kind: 'stored', counts: { messages: 1, statuses: 0 }, skipped: SIN_SALTADOS, followUp: null },
      {
        kind: 'stored',
        counts: { messages: 0, statuses: 0 },
        skipped: { changes: 1, messages: 0, statuses: 0, templates: 1 },
        followUp: null,
      },
      { kind: 'ignored', reason: 'missing' },
      { kind: 'ignored', reason: 'addon_off' },
      { kind: 'ignored', reason: 'disabled' },
      { kind: 'ignored', reason: 'unparseable' },
      { kind: 'unauthorized' },
      { kind: 'secret_unreadable' },
    ]) {
      receiveMock.mockResolvedValueOnce(result)
      await postCon()
    }
    receiveMock.mockRejectedValueOnce(new Error('fallo'))
    await postCon()

    expect(afterMock).not.toHaveBeenCalled()
    expect(resyncMock).not.toHaveBeenCalled()
  })

  it.each([
    { kind: 'failed', code: 'whatsapp_meta_unreachable' },
    { kind: 'failed', code: 'unexpected' },
  ] as const)('R38: un fallo de la resincronizacion ($code) no cambia el 200 y deja una linea de log con el codigo', async (outcome) => {
    receiveMock.mockResolvedValue(STORED_CON_SEGUIMIENTO)
    resyncMock.mockResolvedValue(outcome)

    const response = await postCon()
    await vaciarAfter()

    expect(response.status).toBe(200)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith('whatsapp_templates_resync_failed', {
      connectionId: CONEXION,
      code: outcome.code,
    })
    expectSinDatosSensibles()
  })

  it.each(['missing', 'addon_off', 'disabled'] as const)(
    'R38: una resincronizacion saltada (%s) no escribe log ni cambia el 200',
    async (reason) => {
      receiveMock.mockResolvedValue(STORED_CON_SEGUIMIENTO)
      resyncMock.mockResolvedValue({ kind: 'skipped', reason })

      const response = await postCon()
      await vaciarAfter()

      expect(response.status).toBe(200)
      expect(errorSpy).not.toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalled()
    },
  )

  it('R40: con followUp y cambios saltados, la linea de saltos y la resincronizacion salen las dos', async () => {
    receiveMock.mockResolvedValue({
      ...STORED_CON_SEGUIMIENTO,
      counts: { messages: 1, statuses: 0 },
      skipped: { changes: 0, messages: 0, statuses: 0, templates: 1 },
    })
    resyncMock.mockResolvedValue({ kind: 'synced', summary: SUMMARY })

    const response = await postCon()
    await vaciarAfter()

    expect(response.status).toBe(200)
    expect(warnSpy).toHaveBeenCalledWith('whatsapp_webhook_changes_skipped', {
      connectionId: CONEXION,
      changes: 0,
      messages: 0,
      statuses: 0,
      templates: 1,
    })
    expect(afterMock).toHaveBeenCalledTimes(1)
    expect(resyncMock).toHaveBeenCalledTimes(1)
  })

  it('R40: si guardar los cambios de plantillas falla, el caso de uso lanza ⇒ 500 y no se programa nada', async () => {
    receiveMock.mockRejectedValue(new Error('fallo al guardar las plantillas'))

    const response = await postCon()

    expect(response.status).toBe(500)
    expect(afterMock).not.toHaveBeenCalled()
  })
})
