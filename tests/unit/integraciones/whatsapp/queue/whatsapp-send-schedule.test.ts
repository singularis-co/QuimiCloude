import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

type Cron = { readonly path: string; readonly schedule: string }

const repoRoot = process.cwd()
const SWEEP_PATH = '/api/cron/barrer-envios-whatsapp'

function crons(): readonly Cron[] {
  const config = JSON.parse(readFileSync(join(repoRoot, 'vercel.json'), 'utf8')) as { crons?: Cron[] }
  return config.crons ?? []
}

describe('la tarea programada del barrido', () => {
  it('R35: vercel.json declara el barrido una vez, en su ruta, cada hora en punto', () => {
    const delBarrido = crons().filter((cron) => cron.path === SWEEP_PATH)

    expect(delBarrido).toEqual([{ path: SWEEP_PATH, schedule: '0 * * * *' }])
  })

  it('R35: la ruta declarada existe y exporta GET', () => {
    const ruta = join(repoRoot, 'app', 'api', 'cron', 'barrer-envios-whatsapp', 'route.ts')

    expect(existsSync(ruta)).toBe(true)
    expect(readFileSync(ruta, 'utf8')).toMatch(/^export \{ GET \} from /m)
  })

  it('R35: los tres crons que ya existian siguen con su horario', () => {
    expect(crons()).toEqual(
      expect.arrayContaining([
        { path: '/api/cron/caducar-pedidos', schedule: '0 7 * * *' },
        { path: '/api/cron/purgar-notificaciones', schedule: '30 7 * * *' },
        { path: '/api/cron/sincronizar-plantillas-whatsapp', schedule: '0 8 * * *' },
      ]),
    )
  })
})
