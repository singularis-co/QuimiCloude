// El cron del barrido, invocado directo con un `Request` sin levantar Next. `verifyCronSecret` y el
// caso de uso se doblan en `@/lib/composition`: sin el secreto correcto no se lee ninguna empresa.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/lib/modules/integraciones/adapters/driving/whatsapp-send-sweep-cron-route'

const { verifyCronSecretMock, sweepMock, logError } = vi.hoisted(() => ({
  verifyCronSecretMock: vi.fn(),
  sweepMock: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@/lib/composition', () => ({
  integraciones: {
    verifyCronSecret: verifyCronSecretMock,
    sweepWhatsappSends: sweepMock,
  },
}))

vi.mock('@/lib/shared/observability/logger', () => ({
  forModule: () => ({ info: vi.fn(), warn: vi.fn(), error: logError }),
}))

const COMPANY_ID = '00000000-0000-4000-8000-0000000000aa'

function requestCon(headers: Record<string, string> = {}): Request {
  return new Request('https://app.invalida/api/cron/barrer-envios-whatsapp', { headers })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('la puerta del barrido es el secreto del cron', () => {
  it('R27: sin cabecera responde 401 sin cuerpo y no barre', async () => {
    verifyCronSecretMock.mockReturnValue('unauthorized')

    const respuesta = await GET(requestCon())

    expect(respuesta.status).toBe(401)
    expect(await respuesta.text()).toBe('')
    expect(verifyCronSecretMock).toHaveBeenCalledWith(null)
    expect(sweepMock).not.toHaveBeenCalled()
  })

  it('R27: con un secreto incorrecto responde 401 y no barre', async () => {
    verifyCronSecretMock.mockReturnValue('unauthorized')

    const respuesta = await GET(requestCon({ authorization: 'Bearer mal' }))

    expect(respuesta.status).toBe(401)
    expect(verifyCronSecretMock).toHaveBeenCalledWith('Bearer mal')
    expect(sweepMock).not.toHaveBeenCalled()
  })

  it('R27: con CRON_SECRET sin definir responde 500, deja una linea y no barre', async () => {
    verifyCronSecretMock.mockReturnValue('misconfigured')

    const respuesta = await GET(requestCon({ authorization: 'Bearer cualquiera' }))

    expect(respuesta.status).toBe(500)
    expect(await respuesta.text()).toBe('')
    expect(logError).toHaveBeenCalledWith('whatsapp_send_sweep_misconfigured')
    expect(sweepMock).not.toHaveBeenCalled()
  })
})

describe('la respuesta del barrido', () => {
  it('R28: autorizado y sin fallos responde 200 con el resumen', async () => {
    verifyCronSecretMock.mockReturnValue('ok')
    sweepMock.mockResolvedValue({ republished: 3, failed: 2, companiesFailed: [] })

    const respuesta = await GET(requestCon({ authorization: 'Bearer bueno' }))

    expect(respuesta.status).toBe(200)
    expect(await respuesta.json()).toEqual({ republished: 3, failed: 2, companiesFailed: [] })
    expect(sweepMock).toHaveBeenCalledTimes(1)
  })

  it('R28: si alguna empresa fallo responde 500 con el resumen, que solo lleva empresa y codigo', async () => {
    verifyCronSecretMock.mockReturnValue('ok')
    sweepMock.mockResolvedValue({ republished: 1, failed: 0, companiesFailed: [{ companyId: COMPANY_ID, code: 'P1001' }] })

    const respuesta = await GET(requestCon({ authorization: 'Bearer bueno' }))
    const cuerpo = (await respuesta.json()) as { companiesFailed: Record<string, unknown>[] }

    expect(respuesta.status).toBe(500)
    expect(cuerpo).toEqual({ republished: 1, failed: 0, companiesFailed: [{ companyId: COMPANY_ID, code: 'P1001' }] })
    expect(Object.keys(cuerpo).sort()).toEqual(['companiesFailed', 'failed', 'republished'])
  })
})

describe('la configuracion de segmento de la ruta del barrido', () => {
  const codigo = readFileSync(join(process.cwd(), 'app', 'api', 'cron', 'barrer-envios-whatsapp', 'route.ts'), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

  it('reexporta solo GET del adaptador driving', () => {
    expect(codigo).toMatch(
      /^export \{ GET \} from '@\/lib\/modules\/integraciones\/adapters\/driving\/whatsapp-send-sweep-cron-route';$/m,
    )
  })

  it('declara runtime nodejs y maxDuration 300 como literales', () => {
    expect(codigo).toMatch(/^export const runtime = 'nodejs';$/m)
    expect(codigo).toMatch(/^export const maxDuration = 300;$/m)
    expect(codigo).not.toMatch(/process\.env/)
  })
})
