// El Route Handler del cron de plantillas, invocado DIRECTO con un `Request` normal, sin levantar
// Next. `verifyCronSecret` y `syncAllWhatsappTemplates` se doblan en `@/lib/composition`: sin el
// secreto correcto el caso de uso no se llama, asi que no se lee ninguna empresa ni conexion.
// La configuracion de segmento de `route.ts` se lee del disco: lo que importa es que sea literal.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/lib/modules/integraciones/adapters/driving/whatsapp-template-cron-route'

const { verifyCronSecretMock, syncAllMock } = vi.hoisted(() => ({
  verifyCronSecretMock: vi.fn(),
  syncAllMock: vi.fn(),
}))

vi.mock('@/lib/composition', () => ({
  integraciones: {
    verifyCronSecret: verifyCronSecretMock,
    syncAllWhatsappTemplates: syncAllMock,
  },
}))

const COMPANY_A = '22222222-2222-4222-8222-222222222222'
const META_MESSAGE = 'Invalid OAuth access token EAAG-secreto'

function requestCon(headers: Record<string, string> = {}): Request {
  return new Request('https://app.invalida/api/cron/sincronizar-plantillas-whatsapp', { headers })
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  consoleError.mockRestore()
})

describe('R31: la puerta del cron es su secreto', () => {
  it('R31: sin cabecera ⇒ 401 sin cuerpo y ningun caso de uso llamado', async () => {
    verifyCronSecretMock.mockReturnValue('unauthorized')

    const respuesta = await GET(requestCon())

    expect(respuesta.status).toBe(401)
    expect(await respuesta.text()).toBe('')
    expect(verifyCronSecretMock).toHaveBeenCalledWith(null)
    expect(syncAllMock).not.toHaveBeenCalled()
  })

  it('R31: con un secreto incorrecto ⇒ 401 y ningun caso de uso llamado', async () => {
    verifyCronSecretMock.mockReturnValue('unauthorized')

    const respuesta = await GET(requestCon({ authorization: 'Bearer mal' }))

    expect(respuesta.status).toBe(401)
    expect(verifyCronSecretMock).toHaveBeenCalledWith('Bearer mal')
    expect(syncAllMock).not.toHaveBeenCalled()
  })

  it('R31: CRON_SECRET sin definir ⇒ 500, una linea de log sin el secreto y ningun caso de uso llamado', async () => {
    verifyCronSecretMock.mockReturnValue('misconfigured')

    const respuesta = await GET(requestCon({ authorization: 'Bearer cualquiera' }))

    expect(respuesta.status).toBe(500)
    expect(await respuesta.text()).toBe('')
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith('whatsapp_templates_cron_misconfigured')
    expect(syncAllMock).not.toHaveBeenCalled()
  })
})

describe('R33: la respuesta del cron', () => {
  it('R33: sin fallos ⇒ 200 con las sincronizadas y failed 0, sin log', async () => {
    verifyCronSecretMock.mockReturnValue('ok')
    syncAllMock.mockResolvedValue({ synced: 3, failed: [] })

    const respuesta = await GET(requestCon({ authorization: 'Bearer bueno' }))

    expect(respuesta.status).toBe(200)
    expect(await respuesta.json()).toEqual({ synced: 3, failed: 0 })
    expect(syncAllMock).toHaveBeenCalledTimes(1)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('R33: con fallos ⇒ 500 con el numero de sincronizadas y de fallos, y una linea de log con empresa y codigo', async () => {
    verifyCronSecretMock.mockReturnValue('ok')
    const fallos = [
      { stage: 'connection' as const, companyId: COMPANY_A, code: 'whatsapp_meta_unreachable' },
      { stage: 'companies' as const, code: 'unexpected' },
    ]
    syncAllMock.mockResolvedValue({ synced: 2, failed: fallos })

    const respuesta = await GET(requestCon({ authorization: 'Bearer bueno' }))

    expect(respuesta.status).toBe(500)
    expect(await respuesta.json()).toEqual({ synced: 2, failed: 2 })
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith('whatsapp_templates_cron_failed', { failedCount: 2, failed: fallos })
  })

  it('R33: ni el cuerpo ni el log llevan un mensaje de Meta: solo stage, companyId y code', async () => {
    verifyCronSecretMock.mockReturnValue('ok')
    syncAllMock.mockResolvedValue({
      synced: 0,
      failed: [{ stage: 'connection', companyId: COMPANY_A, code: 'whatsapp_meta_rejected' }],
    })

    const respuesta = await GET(requestCon({ authorization: 'Bearer bueno' }))

    expect(JSON.stringify(await respuesta.json())).not.toContain(META_MESSAGE)
    const [, detalle] = consoleError.mock.calls[0] as [string, { failed: Record<string, unknown>[] }]
    for (const fallo of detalle.failed) {
      expect(Object.keys(fallo).sort()).toEqual(['code', 'companyId', 'stage'])
    }
  })
})

describe('la configuracion de segmento de la ruta del cron', () => {
  const RUTA = join(process.cwd(), 'app', 'api', 'cron', 'sincronizar-plantillas-whatsapp', 'route.ts')
  const codigo = readFileSync(RUTA, 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

  it('reexporta solo GET del adaptador driving, nunca un campo de configuracion', () => {
    expect(codigo).toMatch(
      /^export \{ GET \} from '@\/lib\/modules\/integraciones\/adapters\/driving\/whatsapp-template-cron-route';$/m,
    )
    for (const bloque of codigo.matchAll(/export\s*\{([^}]*)\}\s*from/g)) {
      expect((bloque[1] ?? '').trim()).toBe('GET')
    }
  })

  it('declara runtime y maxDuration como literales, maxDuration sin pasar de 300 s', () => {
    expect(codigo).toMatch(/^export const runtime = 'nodejs';$/m)
    const maxDuration = /^export const maxDuration = (\d+);$/m.exec(codigo)
    expect(maxDuration, 'maxDuration no es un literal numerico').not.toBeNull()
    expect(Number(maxDuration?.[1])).toBeGreaterThan(0)
    expect(Number(maxDuration?.[1])).toBeLessThanOrEqual(300)
    expect(codigo).not.toMatch(/process\.env/)
  })
})
