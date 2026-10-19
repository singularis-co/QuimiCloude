// El proceso diario tiene que estar declarado como tarea programada de la plataforma de
// despliegue, con una sola ejecucion al dia y apuntando a la ruta del handler. Hay otras tareas en
// el mismo archivo: no se fija el total, solo que la de caducidad existe una vez y con su horario.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const RUTA = join(process.cwd(), 'vercel.json')

type VercelCron = { readonly path: string; readonly schedule: string }
type VercelConfig = { readonly crons?: readonly VercelCron[] }

const RUTA_CADUCIDAD = '/api/cron/caducar-pedidos'

function leer(): VercelConfig {
  return JSON.parse(readFileSync(RUTA, 'utf8')) as VercelConfig
}

function tareasDeCaducidad(): readonly VercelCron[] {
  return (leer().crons ?? []).filter((cron) => cron.path === RUTA_CADUCIDAD)
}

describe('vercel.json — el cron de caducidad de pedidos', () => {
  it('R23 — declara UNA sola tarea apuntando a /api/cron/caducar-pedidos, sin fijar cuantas hay en total', () => {
    expect(tareasDeCaducidad()).toHaveLength(1)
  })

  it('R23 — la expresion cron de la caducidad es UNA sola ejecucion al dia', () => {
    const schedule = tareasDeCaducidad()[0]?.schedule ?? ''
    const campos = schedule.trim().split(/\s+/)
    // minuto hora dia-mes mes dia-semana: los CINCO campos de una expresion cron estandar.
    expect(campos).toHaveLength(5)
    const [minuto, hora, diaMes, mes, diaSemana] = campos
    // Un minuto y una hora FIJOS -sin `*`, `/` ni `,`- son los que garantizan una sola
    // ejecucion por dia; los otros tres campos sin acotar (`*`) es lo que hace que sea TODOS
    // los dias, no una fecha concreta.
    expect(minuto).toMatch(/^\d+$/)
    expect(hora).toMatch(/^\d+$/)
    expect(diaMes).toBe('*')
    expect(mes).toBe('*')
    expect(diaSemana).toBe('*')
  })
})
