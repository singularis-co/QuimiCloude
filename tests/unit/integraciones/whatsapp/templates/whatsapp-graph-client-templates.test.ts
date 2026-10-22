// Las tres llamadas de plantillas del cliente real de Graph, con `fetch` simulado: nunca sale a la red.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { whatsappGraphClientFetch } from '@/lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-fetch'

const TOKEN = 'EAAG-token-secreto-123'
const WABA_ID = '2345678901'
const BASE = 'https://graph.facebook.com/v21.0/2345678901/message_templates'
const FIELDS = 'id,name,language,status,category,components,rejected_reason'

const savedVersion = process.env.WHATSAPP_GRAPH_API_VERSION
let fetchMock: ReturnType<typeof vi.fn>

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

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

function lastCall(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1) as [string, RequestInit] | undefined
  if (call === undefined) throw new Error('fetch no se llamó')
  return { url: call[0], init: call[1] }
}

const COMPONENTS = [{ type: 'BODY', text: 'Hola {{1}}', example: { body_text: [['Ana']] } }]

function create(overrides: Partial<Parameters<typeof whatsappGraphClientFetch.createTemplate>[0]> = {}) {
  return whatsappGraphClientFetch.createTemplate({
    wabaId: WABA_ID,
    accessToken: TOKEN,
    name: 'bienvenida',
    language: 'es',
    category: 'UTILITY',
    components: COMPONENTS,
    ...overrides,
  })
}

function list(after: string | null = null) {
  return whatsappGraphClientFetch.listTemplatesPage({ wabaId: WABA_ID, accessToken: TOKEN, after })
}

function remove(overrides: { hsmId?: string; name?: string } = {}) {
  return whatsappGraphClientFetch.deleteTemplate({
    wabaId: WABA_ID,
    accessToken: TOKEN,
    hsmId: overrides.hsmId ?? '9001',
    name: overrides.name ?? 'bienvenida',
  })
}

/** Las tres llamadas con una respuesta que el test no mira: solo importa la peticion. */
const CALLS = [
  ['crear', () => create()],
  ['listar', () => list('cursor-1')],
  ['borrar', () => remove()],
] as const

describe('R27: las peticiones de plantillas a Graph', () => {
  it('crear: POST a message_templates de la WABA con el JSON de nombre, idioma, categoria y componentes', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: '1234', status: 'PENDING', category: 'UTILITY' }))
    await create()

    const { url, init } = lastCall()
    expect(url).toBe(BASE)
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'bienvenida',
      language: 'es',
      category: 'UTILITY',
      components: COMPONENTS,
    })
  })

  it('listar: GET con los campos y limit=100, sin `after` en la primera pagina', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [] }))
    await list()

    const { url, init } = lastCall()
    expect(url).toBe(`${BASE}?fields=${FIELDS}&limit=100`)
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
  })

  it('listar: la pagina siguiente se pide con el cursor en `after`, codificado', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [] }))
    await list('QVFI&x=1/2')

    const parsed = new URL(lastCall().url)
    expect(parsed.searchParams.get('after')).toBe('QVFI&x=1/2')
    expect(parsed.searchParams.get('x')).toBeNull()
    expect(lastCall().url).toContain('after=QVFI%26x%3D1%2F2')
  })

  it('borrar: DELETE con `hsm_id` y `name`, codificados', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true }))
    await remove({ hsmId: '9001', name: 'promo_a&b' })

    const { url, init } = lastCall()
    expect(url).toBe(`${BASE}?hsm_id=9001&name=promo_a%26b`)
    expect(init.method).toBe('DELETE')
  })

  it('el id de la WABA queda codificado dentro de su segmento', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [] }))
    await whatsappGraphClientFetch.listTemplatesPage({ wabaId: '1/../2?x', accessToken: TOKEN, after: null })

    expect(new URL(lastCall().url).pathname).toBe('/v21.0/1%2F..%2F2%3Fx/message_templates')
  })

  it.each(CALLS)('%s: el token va en `Authorization: Bearer` y nunca en la URL; hay tiempo maximo', async (_caso, call) => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}))
    await call()

    const { url, init } = lastCall()
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${TOKEN}`)
    expect(url).not.toContain(TOKEN)
    expect(url).not.toContain('access_token')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.cache).toBe('no-store')
  })

  it.each(CALLS)('%s: sin WHATSAPP_GRAPH_API_VERSION lanza nombrando la variable y no llama a fetch', async (_caso, call) => {
    delete process.env.WHATSAPP_GRAPH_API_VERSION
    await expect(call()).rejects.toThrow('WHATSAPP_GRAPH_API_VERSION')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('R27: las respuestas de plantillas de Graph', () => {
  it('crear: 2xx da el id, el estado y la categoria; sin estado ni categoria quedan en null', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: '1234', status: 'PENDING', category: 'MARKETING' }))
    await expect(create()).resolves.toEqual({ ok: true, id: '1234', status: 'PENDING', category: 'MARKETING' })

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: '1235' }))
    await expect(create()).resolves.toEqual({ ok: true, id: '1235', status: null, category: null })
  })

  it('crear: 2xx sin id es un rechazo sin detalle', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status: 'PENDING' }))
    await expect(create()).resolves.toEqual({ ok: false, kind: 'rejected', message: null, code: null, subcode: null })
  })

  it('listar: sin `paging.next` es la ultima pagina; los elementos viajan sin interpretar', async () => {
    const items = [{ id: '1', name: 'a', raro: true }, 'no-es-objeto']
    fetchMock.mockResolvedValue(
      jsonResponse(200, { data: items, paging: { cursors: { before: 'b', after: 'ultimo' } } }),
    )
    await expect(list()).resolves.toEqual({ ok: true, items, next: null })
  })

  it('listar: con `paging.next` el siguiente cursor es `paging.cursors.after`, no la URL de Meta', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        data: [],
        paging: { cursors: { after: 'QVFI-siguiente' }, next: 'https://graph.facebook.com/v21.0/x?after=otro&access_token=y' },
      }),
    )
    await expect(list()).resolves.toEqual({ ok: true, items: [], next: 'QVFI-siguiente' })
  })

  it('listar: `paging.next` sin cursor es un rechazo: cortar ahi dejaria la lista a medias', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [], paging: { next: 'https://graph.facebook.com/x' } }))
    await expect(list()).resolves.toEqual({ ok: false, kind: 'rejected', message: null, code: null, subcode: null })
  })

  it('listar: 2xx sin `data` es un rechazo sin detalle', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { paging: {} }))
    await expect(list()).resolves.toMatchObject({ ok: false, kind: 'rejected' })
  })

  it('borrar: `{ success: true }` es ok; cualquier otro 2xx es un rechazo', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true }))
    await expect(remove()).resolves.toEqual({ ok: true })

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: false }))
    await expect(remove()).resolves.toMatchObject({ ok: false, kind: 'rejected' })
  })

  it.each(CALLS)('%s: un 4xx con `error` da rechazo con su mensaje, `code` y `error_subcode`', async (_caso, call) => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: {
          message: 'Content in This Language Already Exists',
          type: 'OAuthException',
          code: 100,
          error_subcode: 2388024,
          fbtrace_id: 'abc',
        },
      }),
    )
    await expect(call()).resolves.toEqual({
      ok: false,
      kind: 'rejected',
      message: 'Content in This Language Already Exists',
      code: 100,
      subcode: 2388024,
    })
  })

  it('un 4xx con `error` sin codigos ni mensaje da rechazo con los tres en null', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: {} }))
    await expect(create()).resolves.toEqual({ ok: false, kind: 'rejected', message: null, code: null, subcode: null })
  })

  it('un 4xx que no se entiende es un rechazo sin detalle', async () => {
    fetchMock.mockResolvedValue(new Response('<html>nope</html>', { status: 403 }))
    await expect(create()).resolves.toEqual({ ok: false, kind: 'rejected', message: null, code: null, subcode: null })
  })

  it.each(CALLS)('%s: un 5xx es `unreachable`, aunque traiga un `error` de Meta', async (_caso, call) => {
    fetchMock.mockResolvedValue(jsonResponse(503, { error: { message: 'Service temporarily unavailable', code: 2 } }))
    await expect(call()).resolves.toEqual({ ok: false, kind: 'unreachable', message: null, code: null, subcode: null })
  })

  it.each(CALLS)('%s: un fallo de red o el tiempo maximo agotado es `unreachable`', async (_caso, call) => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(call()).resolves.toMatchObject({ ok: false, kind: 'unreachable' })

    fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    await expect(call()).resolves.toMatchObject({ ok: false, kind: 'unreachable' })
  })

  it('no escribe nada en la consola, ni la URL ni el token', async () => {
    const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    )
    try {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'))
      for (const [, call] of CALLS) await call()
      fetchMock.mockImplementation(async () => jsonResponse(400, { error: { message: 'x', code: 100 } }))
      for (const [, call] of CALLS) await call()
      for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })
})
