// `sendMessage` del cliente real de Graph y de su doble para el E2E, con `fetch` simulado: nunca
// sale a la red.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CANNED_SEND_FAIL_PREFIX,
  resetCannedSentMessages,
  whatsappGraphClientCanned,
} from '@/lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-canned'
import { whatsappGraphClientFetch } from '@/lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-fetch'

import type { GraphOutboundMessage } from '@/lib/modules/integraciones/ports/whatsapp-graph-client'

const TOKEN = 'EAAG-token-secreto-123'
const PHONE_ID = '3456789012'
const TO = '573001234567'
const WAMID = 'wamid.HBgMNTczMDAxMjM0NTY3FQIAERgSQUFBQUFB'

const TEXT: GraphOutboundMessage = { type: 'text', body: 'Hola, tu pedido está listo.' }
const COMPONENTS = [
  { type: 'header', parameters: [{ type: 'text', text: 'Ana' }] },
  { type: 'body', parameters: [{ type: 'text', text: 'Ana' }, { type: 'text', text: '#120' }] },
  { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'abc' }] },
]
const TEMPLATE: GraphOutboundMessage = {
  type: 'template',
  name: 'pedido_listo',
  language: 'es_CO',
  components: COMPONENTS,
}

const savedVersion = process.env.WHATSAPP_GRAPH_API_VERSION
let fetchMock: ReturnType<typeof vi.fn>

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function send(message: GraphOutboundMessage = TEXT, to = TO) {
  return whatsappGraphClientFetch.sendMessage({ phoneNumberId: PHONE_ID, accessToken: TOKEN, to, message })
}

function lastCall(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1) as [string, RequestInit] | undefined
  if (call === undefined) throw new Error('fetch no se llamó')
  return { url: call[0], init: call[1] }
}

function sentBody(): unknown {
  return JSON.parse(String(lastCall().init.body))
}

const UNREACHABLE = { ok: false, kind: 'unreachable', message: null, code: null, subcode: null }

beforeEach(() => {
  process.env.WHATSAPP_GRAPH_API_VERSION = 'v21.0'
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  if (savedVersion === undefined) delete process.env.WHATSAPP_GRAPH_API_VERSION
  else process.env.WHATSAPP_GRAPH_API_VERSION = savedVersion
})

describe('sendMessage — la llamada a Graph', () => {
  it('R29: POST a /{version}/{phone_number_id}/messages con el Phone Number ID codificado', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { messages: [{ id: WAMID }] }))
    await send()
    expect(lastCall().url).toBe('https://graph.facebook.com/v21.0/3456789012/messages')
    expect(lastCall().init.method).toBe('POST')

    await whatsappGraphClientFetch.sendMessage({ phoneNumberId: 'a/b', accessToken: TOKEN, to: TO, message: TEXT })
    expect(lastCall().url).toBe('https://graph.facebook.com/v21.0/a%2Fb/messages')
  })

  it('R29: el token descifrado va en `Authorization: Bearer`, nunca en la URL ni en el cuerpo; JSON y tiempo maximo', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { messages: [{ id: WAMID }] }))
    await send()

    const { url, init } = lastCall()
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBe(`Bearer ${TOKEN}`)
    expect(headers.get('content-type')).toBe('application/json')
    expect(url).not.toContain(TOKEN)
    expect(String(init.body)).not.toContain(TOKEN)
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.cache).toBe('no-store')
  })

  it('R29: cuerpo de texto con el waId como destino y el texto tal cual, sin vista previa de enlaces', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { messages: [{ id: WAMID }] }))
    await send({ type: 'text', body: '  con espacios  ' })

    expect(sentBody()).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: TO,
      type: 'text',
      text: { body: '  con espacios  ', preview_url: false },
    })
  })

  it('R29: cuerpo de plantilla con nombre, idioma como `language.code` y los componentes sin tocar', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { messages: [{ id: WAMID }] }))
    await send(TEMPLATE)

    expect(sentBody()).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: TO,
      type: 'template',
      template: { name: 'pedido_listo', language: { code: 'es_CO' }, components: COMPONENTS },
    })
  })

  it('R29: sin WHATSAPP_GRAPH_API_VERSION lanza nombrando la variable y no llama a fetch', async () => {
    delete process.env.WHATSAPP_GRAPH_API_VERSION
    await expect(send()).rejects.toThrow('WHATSAPP_GRAPH_API_VERSION')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('sendMessage — las respuestas de Graph', () => {
  it('R29, R30: 2xx con `messages[0].id` es un envio aceptado con ese wamid', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { messaging_product: 'whatsapp', contacts: [{ wa_id: TO }], messages: [{ id: WAMID }] }),
    )
    await expect(send()).resolves.toEqual({ ok: true, wamid: WAMID })
  })

  it.each([
    ['sin messages', { messaging_product: 'whatsapp' }],
    ['messages vacio', { messages: [] }],
    ['id vacio', { messages: [{ id: '' }] }],
    ['id no texto', { messages: [{ id: 123 }] }],
    ['cuerpo que no es JSON', null],
  ])('R31: 2xx %s no prueba la entrega ⇒ unreachable sin codigo', async (_caso, body) => {
    fetchMock.mockResolvedValue(
      body === null ? new Response('ok', { status: 200 }) : jsonResponse(200, body),
    )
    await expect(send()).resolves.toEqual(UNREACHABLE)
  })

  it.each([190, 131047, 130429, 131056, 100])(
    'R31, R33–R36: 4xx con `error.code` %i es un rechazo con ese codigo, su subcodigo y el texto de Meta',
    async (code) => {
      fetchMock.mockResolvedValue(
        jsonResponse(400, { error: { message: 'texto de Meta', type: 'OAuthException', code, error_subcode: 2494010 } }),
      )
      await expect(send()).resolves.toEqual({
        ok: false,
        kind: 'rejected',
        message: 'texto de Meta',
        code,
        subcode: 2494010,
      })
    },
  )

  it('R31: 4xx con `error` sin codigo ni subcodigo es un rechazo con ambos nulos', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { message: 'Invalid OAuth access token.' } }))
    await expect(send()).resolves.toEqual({
      ok: false,
      kind: 'rejected',
      message: 'Invalid OAuth access token.',
      code: null,
      subcode: null,
    })
  })

  it('R31: 4xx sin cuerpo que se entienda es un rechazo sin detalle', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 400 }))
    await expect(send()).resolves.toEqual({ ok: false, kind: 'rejected', message: null, code: null, subcode: null })
  })

  it('R31: 5xx es Meta caida ⇒ unreachable, aunque traiga un codigo', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { error: { message: 'down', code: 2 } }))
    await expect(send()).resolves.toEqual(UNREACHABLE)
  })

  it('R31: un fallo de red es unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    await expect(send()).resolves.toEqual(UNREACHABLE)
  })

  it('R31: el tiempo maximo agotado es unreachable', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    await expect(send()).resolves.toEqual(UNREACHABLE)
  })

  it('R46: no escribe nada en la consola, ni la URL, el token, el destino ni el texto', async () => {
    const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    )
    try {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'))
      await send()
      fetchMock.mockResolvedValue(jsonResponse(400, { error: { message: 'x', code: 190 } }))
      await send()
      fetchMock.mockResolvedValue(jsonResponse(200, {}))
      await send()
      for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })
})

describe('sendMessage — el doble para el E2E', () => {
  beforeEach(() => {
    resetCannedSentMessages()
  })

  it('R29: acepta texto y plantilla con un wamid `wamid.E2E.<n>` creciente y sin red', async () => {
    const base = { phoneNumberId: PHONE_ID, accessToken: TOKEN, to: TO }
    await expect(whatsappGraphClientCanned.sendMessage({ ...base, message: TEXT })).resolves.toEqual({
      ok: true,
      wamid: 'wamid.E2E.1',
    })
    await expect(whatsappGraphClientCanned.sendMessage({ ...base, message: TEMPLATE })).resolves.toEqual({
      ok: true,
      wamid: 'wamid.E2E.2',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('R33: un destino con el prefijo de fallo devuelve el rechazo 190 de token invalido', async () => {
    const result = await whatsappGraphClientCanned.sendMessage({
      phoneNumberId: PHONE_ID,
      accessToken: TOKEN,
      to: `${CANNED_SEND_FAIL_PREFIX}573001234567`,
      message: TEXT,
    })
    expect(result).toMatchObject({ ok: false, kind: 'rejected', code: 190, subcode: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
