// El consumidor de la cola, invocado directo con un `Request` sin levantar Next. La firma y el caso
// de uso se doblan en `@/lib/composition`; el log, en el logger compartido.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/lib/modules/integraciones/adapters/driving/whatsapp-send-route'

const { verifyMock, processMock, logError } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  processMock: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@/lib/composition', () => ({
  integraciones: {
    whatsappQueueSignature: { verify: verifyMock },
    processWhatsappSend: processMock,
  },
}))

vi.mock('@/lib/shared/observability/logger', () => ({
  forModule: () => ({ info: vi.fn(), warn: vi.fn(), error: logError }),
}))

const MESSAGE_ID = '00000000-0000-4000-8000-000000000401'
const COMPANY_ID = '00000000-0000-4000-8000-0000000000aa'
const JOB = { kind: 'send_message', messageId: MESSAGE_ID, companyId: COMPANY_ID }
const SIGNATURE = 'firma-jwt'

function delivery(body: string, signature: string | null = SIGNATURE): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (signature !== null) headers['upstash-signature'] = signature
  return new Request('https://app.invalida/api/integraciones/whatsapp/envios', { method: 'POST', headers, body })
}

beforeEach(() => {
  vi.clearAllMocks()
  verifyMock.mockResolvedValue(true)
  processMock.mockResolvedValue('done')
})

describe('la puerta del consumidor es la firma', () => {
  it('R14: verifica la firma sobre el cuerpo crudo con la cabecera de la cola', async () => {
    const body = JSON.stringify(JOB)
    await POST(delivery(body))

    expect(verifyMock).toHaveBeenCalledWith({ rawBody: body, signature: SIGNATURE })
  })

  it('R14: sin firma o con una firma invalida responde 401 sin cuerpo y no procesa nada', async () => {
    verifyMock.mockResolvedValue(false)

    for (const request of [delivery(JSON.stringify(JOB), null), delivery(JSON.stringify(JOB), 'mala')]) {
      const respuesta = await POST(request)
      expect(respuesta.status).toBe(401)
      expect(await respuesta.text()).toBe('')
    }
    expect(verifyMock).toHaveBeenNthCalledWith(1, { rawBody: JSON.stringify(JOB), signature: null })
    expect(processMock).not.toHaveBeenCalled()
  })

  it('R14: la firma se comprueba antes de interpretar el cuerpo: un cuerpo roto sin firma valida da 401, no 400', async () => {
    verifyMock.mockResolvedValue(false)

    expect((await POST(delivery('{no es json'))).status).toBe(401)
  })

  it('R15: un cuerpo firmado que no es JSON responde 400 sin procesar', async () => {
    const respuesta = await POST(delivery('{no es json'))

    expect(respuesta.status).toBe(400)
    expect(processMock).not.toHaveBeenCalled()
  })

  it.each([
    ['otro tipo de trabajo', { ...JOB, kind: 'otra_cosa' }],
    ['un id que no es UUID', { ...JOB, messageId: 'abc' }],
    ['sin empresa', { kind: 'send_message', messageId: MESSAGE_ID }],
    ['un campo de mas', { ...JOB, extra: 1 }],
  ])('R15: un trabajo firmado con %s responde 400 sin procesar', async (_caso, job) => {
    const respuesta = await POST(delivery(JSON.stringify(job)))

    expect(respuesta.status).toBe(400)
    expect(processMock).not.toHaveBeenCalled()
  })

  it('R16: no necesita sesion ni cookie: un trabajo firmado se procesa con lo que trae', async () => {
    const respuesta = await POST(delivery(JSON.stringify(JOB)))

    expect(respuesta.status).toBe(200)
    expect(processMock).toHaveBeenCalledWith(JOB)
  })
})

describe('la respuesta del consumidor', () => {
  it('R18, R21, R23: done responde 200 sin cuerpo para que la cola no reintente', async () => {
    processMock.mockResolvedValue('done')

    const respuesta = await POST(delivery(JSON.stringify(JOB)))

    expect(respuesta.status).toBe(200)
    expect(await respuesta.text()).toBe('')
  })

  it('R22: requeue responde 500 para que la cola reintente', async () => {
    processMock.mockResolvedValue('requeue')

    expect((await POST(delivery(JSON.stringify(JOB)))).status).toBe(500)
  })

  it('R24: un error no previsto responde 500 y deja una linea solo con el id del mensaje', async () => {
    processMock.mockRejectedValue(new Error('la base no responde con datos'))

    const respuesta = await POST(delivery(JSON.stringify(JOB)))

    expect(respuesta.status).toBe(500)
    expect(logError).toHaveBeenCalledWith('whatsapp_send_job_crashed', { messageId: MESSAGE_ID })
  })
})

describe('la configuracion de segmento de la ruta del consumidor', () => {
  const codigo = readFileSync(join(process.cwd(), 'app', 'api', 'integraciones', 'whatsapp', 'envios', 'route.ts'), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

  it('reexporta solo POST del adaptador driving', () => {
    expect(codigo).toMatch(
      /^export \{ POST \} from '@\/lib\/modules\/integraciones\/adapters\/driving\/whatsapp-send-route';$/m,
    )
  })

  it('declara runtime nodejs y maxDuration 60 como literales', () => {
    expect(codigo).toMatch(/^export const runtime = 'nodejs';$/m)
    expect(codigo).toMatch(/^export const maxDuration = 60;$/m)
    expect(codigo).not.toMatch(/process\.env/)
  })
})
