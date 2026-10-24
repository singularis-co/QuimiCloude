// `downloadMedia` del cliente real de Graph con `fetch` simulado: nunca sale a la red.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { whatsappGraphClientFetch } from '@/lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-fetch'

import type { GraphMediaDownload } from '@/lib/modules/integraciones/ports/whatsapp-graph-client'

const TOKEN = 'EAAG-token-secreto-123'
const MEDIA_ID = '1234567890'
const MAX_BYTES = 16
const MEDIA_URL = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1234567890&hash=firma'
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

const savedVersion = process.env.WHATSAPP_GRAPH_API_VERSION
let fetchMock: ReturnType<typeof vi.fn>

const UNREACHABLE = { ok: false, kind: 'unreachable', message: null, code: null, subcode: null }
const REJECTED = { ok: false, kind: 'rejected', message: null, code: null, subcode: null }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function metadata(overrides: Record<string, unknown> = {}): Response {
  return jsonResponse(200, { url: MEDIA_URL, mime_type: 'image/png', file_size: PNG.byteLength, id: MEDIA_ID, ...overrides })
}

function binary(bytes: Uint8Array<ArrayBuffer>, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(new Blob([bytes]).stream(), { status, headers: { 'content-type': 'image/png', ...headers } })
}

/** Un cuerpo que miente: sin `Content-Length` y entrega trozos hasta pasar del tope. */
function streamOf(chunks: Uint8Array[], onCancel: () => void = () => undefined): ReadableStream<Uint8Array> {
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index]
      index += 1
      if (chunk === undefined) controller.close()
      else controller.enqueue(chunk)
    },
    cancel: onCancel,
  })
}

function download(maxBytes = MAX_BYTES): Promise<GraphMediaDownload> {
  return whatsappGraphClientFetch.downloadMedia({ mediaId: MEDIA_ID, accessToken: TOKEN, maxBytes })
}

function calls(): { url: string; init: RequestInit }[] {
  return (fetchMock.mock.calls as [string, RequestInit][]).map(([url, init]) => ({ url, init }))
}

async function readAll(body: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(body).arrayBuffer())
}

beforeEach(() => {
  process.env.WHATSAPP_GRAPH_API_VERSION = 'v21.0'
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  if (savedVersion === undefined) delete process.env.WHATSAPP_GRAPH_API_VERSION
  else process.env.WHATSAPP_GRAPH_API_VERSION = savedVersion
})

describe('downloadMedia — dos pasos', () => {
  it('R45: primero pide los datos del medio a Graph y luego descarga el binario de la URL de Meta', async () => {
    fetchMock.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(binary(PNG, { 'content-length': '8' }))

    const result = await download()

    expect(calls().map((call) => call.url)).toEqual([`https://graph.facebook.com/v21.0/${MEDIA_ID}`, MEDIA_URL])
    expect(calls().map((call) => call.init.method)).toEqual(['GET', 'GET'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.contentType).toBe('image/png')
    expect(result.contentLength).toBe(8)
    expect(await readAll(result.body)).toEqual(PNG)
  })

  it('R45: el id del medio va codificado en la ruta de Graph', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, {}))
    await whatsappGraphClientFetch.downloadMedia({ mediaId: 'a/b', accessToken: TOKEN, maxBytes: MAX_BYTES })
    expect(calls()[0]?.url).toBe('https://graph.facebook.com/v21.0/a%2Fb')
  })

  it('R45: el tipo es la cabecera sin parametros; sin cabecera, el `mime_type` de Graph', async () => {
    fetchMock
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(binary(PNG, { 'content-type': 'Image/JPEG; charset=binary' }))
    const withHeader = await download()
    expect(withHeader.ok && withHeader.contentType).toBe('image/jpeg')

    fetchMock
      .mockResolvedValueOnce(metadata({ mime_type: 'image/webp' }))
      .mockResolvedValueOnce(new Response(new Blob([PNG]).stream(), { status: 200 }))
    const withoutHeader = await download()
    expect(withoutHeader.ok && withoutHeader.contentType).toBe('image/webp')
  })

  it('R45: sin `Content-Length` el tamaño queda desconocido y el archivo llega entero', async () => {
    fetchMock.mockResolvedValueOnce(metadata({ file_size: undefined })).mockResolvedValueOnce(binary(PNG))
    const result = await download()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.contentLength).toBeNull()
    expect(await readAll(result.body)).toEqual(PNG)
  })
})

describe('downloadMedia — el token', () => {
  it('R47: el token va solo en `Authorization: Bearer` en los dos pasos, nunca en la URL', async () => {
    fetchMock.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(binary(PNG))
    await download()
    for (const call of calls()) {
      expect(call.url).not.toContain(TOKEN)
      expect(new Headers(call.init.headers).get('authorization')).toBe(`Bearer ${TOKEN}`)
      expect(call.init.signal).toBeInstanceOf(AbortSignal)
      expect(call.init.cache).toBe('no-store')
    }
  })

  it('R47: una redireccion no se sigue: el token no viaja a otro host y la descarga es un rechazo', async () => {
    fetchMock
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://evil.example/x' } }))
    await expect(download()).resolves.toEqual(REJECTED)
    expect(calls()[1]?.init.redirect).toBe('manual')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['otro host', 'https://evil.example/archivo.png'],
    ['un host que solo contiene el dominio', 'https://fbsbx.com.evil.example/a.png'],
    ['el dominio sin subdominio que imita el sufijo', 'https://evilfbsbx.com/a.png'],
    ['http sin cifrar', 'http://lookaside.fbsbx.com/a.png'],
  ])('R47: una URL de %s es un rechazo y el token no se manda a ese host', async (_caso, url) => {
    fetchMock.mockResolvedValueOnce(metadata({ url }))
    await expect(download()).resolves.toEqual(REJECTED)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('R47: nada de la URL de Meta ni del token acaba en la consola', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    )
    fetchMock.mockResolvedValueOnce(metadata()).mockRejectedValueOnce(new Error(`fallo en ${MEDIA_URL}`))
    await expect(download()).resolves.toEqual(UNREACHABLE)
    fetchMock.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(binary(PNG))
    await download()
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  })

  it('R47: el resultado no lleva la URL de Meta ni el token', async () => {
    fetchMock.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(binary(PNG))
    const result = await download()
    const visible = JSON.stringify({ ...result, body: undefined })
    expect(visible).not.toContain(MEDIA_URL)
    expect(visible).not.toContain('fbsbx')
    expect(visible).not.toContain(TOKEN)
  })
})

describe('downloadMedia — fallos', () => {
  it('R46: sin red en los datos o en el binario es `unreachable`', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(download()).resolves.toEqual(UNREACHABLE)

    fetchMock.mockResolvedValueOnce(metadata()).mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(download()).resolves.toEqual(UNREACHABLE)
  })

  it('R46: un 5xx de Graph o de la descarga es `unreachable`', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503, {}))
    await expect(download()).resolves.toEqual(UNREACHABLE)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(binary(PNG, {}, 500))
    await expect(download()).resolves.toEqual(UNREACHABLE)
  })

  it('R46: un 4xx de Graph (medio caducado) es `rejected` y no se descarga nada', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: { message: 'Unsupported get request', code: 100, error_subcode: 33 } }),
    )
    await expect(download()).resolves.toEqual({
      ok: false,
      kind: 'rejected',
      message: 'Unsupported get request',
      code: 100,
      subcode: 33,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('R46: un 4xx de la descarga es `rejected`', async () => {
    fetchMock.mockResolvedValueOnce(metadata()).mockResolvedValueOnce(binary(PNG, {}, 404))
    await expect(download()).resolves.toEqual(REJECTED)
  })

  it.each([
    ['sin url', { url: undefined }],
    ['url que no es URL', { url: 'no-es-url' }],
    ['sin mime_type', { mime_type: undefined }],
    ['file_size no entero', { file_size: 1.5 }],
  ])('R46: unos datos de Graph %s son `rejected` sin descargar', async (_caso, overrides) => {
    fetchMock.mockResolvedValueOnce(metadata(overrides))
    await expect(download()).resolves.toEqual(REJECTED)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('downloadMedia — tamaño maximo', () => {
  it('R46: `file_size` mayor que el tope es `rejected` sin pedir el binario', async () => {
    fetchMock.mockResolvedValueOnce(metadata({ file_size: MAX_BYTES + 1 }))
    await expect(download()).resolves.toEqual(REJECTED)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('R46: `file_size` igual al tope se descarga', async () => {
    fetchMock.mockResolvedValueOnce(metadata({ file_size: MAX_BYTES })).mockResolvedValueOnce(binary(PNG))
    await expect(download()).resolves.toMatchObject({ ok: true })
  })

  it('R46: `Content-Length` mayor que el tope es `rejected` y el cuerpo se descarta sin leer', async () => {
    const cancel = vi.fn()
    fetchMock.mockResolvedValueOnce(metadata({ file_size: undefined })).mockResolvedValueOnce(
      new Response(streamOf([PNG], cancel), {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': String(MAX_BYTES + 1) },
      }),
    )
    await expect(download()).resolves.toEqual(REJECTED)
    expect(cancel).toHaveBeenCalled()
  })

  it('R46: si la cabecera miente, el stream se corta con error al pasar del tope', async () => {
    const cancel = vi.fn()
    const chunk = new Uint8Array(10)
    fetchMock
      .mockResolvedValueOnce(metadata({ file_size: undefined }))
      .mockResolvedValueOnce(
        new Response(streamOf([chunk, chunk, chunk], cancel), { status: 200, headers: { 'content-type': 'image/png' } }),
      )
    const result = await download()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    await expect(readAll(result.body)).rejects.toThrow()
    expect(cancel).toHaveBeenCalled()
  })

  it('R46: un cuerpo de exactamente el tope pasa entero', async () => {
    const exact = new Uint8Array(MAX_BYTES).fill(7)
    fetchMock.mockResolvedValueOnce(metadata({ file_size: undefined })).mockResolvedValueOnce(binary(exact))
    const result = await download()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(await readAll(result.body)).toEqual(exact)
  })
})
