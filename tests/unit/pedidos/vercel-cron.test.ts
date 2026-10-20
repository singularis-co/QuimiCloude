// Cada proceso diario tiene que estar declarado como tarea programada de la plataforma de
// despliegue, con una sola ejecucion al dia y apuntando a la ruta de su handler. Cada cron se busca
// por su `path`: un cron de otra ficha no cambia lo que se exige a este.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const RUTA = join(process.cwd(), 'vercel.json')

type VercelCron = { readonly path: string; readonly schedule: string }
type VercelConfig = { readonly crons?: readonly VercelCron[] }

function leer(): VercelConfig {
  return JSON.parse(readFileSync(RUTA, 'utf8')) as VercelConfig
}

function cronesCon(path: string): readonly VercelCron[] {
  return (leer().crons ?? []).filter((cron) => cron.path === path)
}

/** Minuto y hora fijos, los otros tres campos sin acotar: una ejecucion, todos los dias. */
function expectUnaVezAlDia(schedule: string): void {
  const campos = schedule.trim().split(/\s+/)
  // minuto hora dia-mes mes dia-semana: los CINCO campos de una expresion cron estandar.
  expect(campos).toHaveLength(5)
  const [minuto, hora, diaMes, mes, diaSemana] = campos
  expect(minuto).toMatch(/^\d+$/)
  expect(hora).toMatch(/^\d+$/)
  expect(diaMes).toBe('*')
  expect(mes).toBe('*')
  expect(diaSemana).toBe('*')
}

describe('vercel.json — el cron de caducidad de pedidos', () => {
  it('R23 — declara UNA sola tarea apuntando a /api/cron/caducar-pedidos', () => {
    expect(cronesCon('/api/cron/caducar-pedidos')).toHaveLength(1)
  })

  it('R23 — la expresion cron es UNA sola ejecucion al dia', () => {
    expectUnaVezAlDia(cronesCon('/api/cron/caducar-pedidos')[0]?.schedule ?? '')
  })
})

describe('vercel.json — el cron de sincronizacion de plantillas de WhatsApp', () => {
  const PATH = '/api/cron/sincronizar-plantillas-whatsapp'

  it('R34: declara UNA sola tarea apuntando a /api/cron/sincronizar-plantillas-whatsapp', () => {
    expect(cronesCon(PATH)).toHaveLength(1)
  })

  it('R34: corre una sola vez al dia, a las 08:00', () => {
    const schedule = cronesCon(PATH)[0]?.schedule ?? ''
    expectUnaVezAlDia(schedule)
    expect(schedule).toBe('0 8 * * *')
  })
})

describe('vercel.json — el lector por path', () => {
  it('ningun path se declara dos veces', () => {
    const paths = (leer().crons ?? []).map((cron) => cron.path)
    expect(paths.length).toBeGreaterThan(0)
    expect(new Set(paths).size).toBe(paths.length)
  })
})
