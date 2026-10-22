// Guardia: el validador resuelve el tracker del perfil (`arnes.config.json > tracker`, o el bloque
// `jira` antiguo como respaldo) y lo hace cumplir sin red (`docs/trello.md`):
//   - `tracker.tipo` solo puede ser `jira` o `trello`;
//   - la key de cada ficha lleva `tracker.prefijo` o uno de `tracker.prefijos_historicos`;
//   - un perfil con solo `jira` se valida como siempre;
//   - una feature en vuelo con mas de un member de Trello es un error: el candado admite uno.
//
// Sale de la migracion de QC a Trello (2026-10-13). Un fixture por desenlace, con los rojos
// nombrando lo que falla (`docs/gate.md > Probar que muerde, no que pasa`).

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const AQUI = dirname(fileURLToPath(import.meta.url))
const VALIDADOR = join(AQUI, '..', '..', 'scripts', 'validate-features.mjs')

const ESTADOS = {
  Pendiente: 'pending',
  'Spec en revisión': 'spec_ready',
  'En curso': 'in_progress',
  Hecho: 'done',
  Cancelado: 'cancelled',
}

const TRACKER = { tipo: 'trello', board: 'b1', prefijo: 'QT', prefijos_historicos: ['QC'], estados: ESTADOS }

const ficha = (key: string, extra: Record<string, unknown> = {}) => ({
  key,
  id: Number(key.split('-')[1]),
  name: `ficha-${key.toLowerCase()}`,
  sdd: false,
  status: 'pending',
  zone: 'backend',
  assignee: null,
  ...extra,
})

let temporal: string | null = null

afterEach(() => {
  if (temporal) rmSync(temporal, { recursive: true, force: true })
  temporal = null
})

function correr(config: unknown, features: unknown[] | null, identidad: unknown = { trello_member_id: 'm1' }) {
  const raiz = mkdtempSync(join(tmpdir(), 'guard-tracker-'))
  temporal = raiz
  writeFileSync(join(raiz, 'arnes.config.json'), JSON.stringify(config))
  if (features) writeFileSync(join(raiz, 'feature_list.json'), JSON.stringify({ features }))
  writeFileSync(join(raiz, '.arnes.local.json'), JSON.stringify(identidad))
  try {
    const salida = execFileSync(process.execPath, [VALIDADOR], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, salida }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? 1, salida: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

describe('guardia: tracker resuelto en el validador', () => {
  it('pasa con tracker trello, prefijo nuevo y prefijo historico', () => {
    const { code, salida } = correr({ tracker: TRACKER }, [ficha('QT-1'), ficha('QC-131')])
    expect(code, salida).toBe(0)
    expect(salida).toContain('vienen del proyecto QT/QC')
  })

  it('falla si tracker.tipo no es jira ni trello, aun sin copia del board', () => {
    const { code, salida } = correr({ tracker: { ...TRACKER, tipo: 'linear' } }, null)
    expect(salida).toContain('tracker.tipo es "linear"')
    expect(code).not.toBe(0)
  })

  it('falla si una key trae un prefijo ajeno al tracker', () => {
    const { code, salida } = correr({ tracker: TRACKER }, [ficha('QT-1'), ficha('XX-2')])
    expect(salida).toContain('fichas de otro board')
    expect(salida).toContain('XX-2')
    expect(salida).toContain('tracker.prefijo')
    expect(code).not.toBe(0)
  })

  it('sin prefijos_historicos, una key QC- de una migracion falla', () => {
    const sinHistoricos = { ...TRACKER, prefijos_historicos: [] }
    const { code, salida } = correr({ tracker: sinHistoricos }, [ficha('QC-131')])
    expect(salida).toContain('QC-131')
    expect(code).not.toBe(0)
  })

  it('valida tracker.estados igual que jira.estados', () => {
    const { code, salida } = correr({ tracker: { ...TRACKER, estados: { ...ESTADOS, Hecho: 'hecho' } } }, null)
    expect(salida).toContain('tracker.estados traduce "Hecho" a "hecho"')
    expect(code).not.toBe(0)
  })

  it('un perfil con solo jira pasa como antes, con jira_account_id', () => {
    const { code, salida } = correr(
      { jira: { project: 'QC', estados: { 'Por hacer': 'pending', 'En curso': 'in_progress' } } },
      [ficha('QC-1', { status: 'in_progress', assignee: { accountId: 'u1', displayName: 'u1' } })],
      { jira_account_id: 'u1' },
    )
    expect(code, salida).toBe(0)
    expect(salida).toContain('vienen del proyecto QC')
    expect(salida).not.toContain('/tracker-connect')
  })

  it('trello: una feature en vuelo con mas de un member falla', () => {
    const dos = [
      { accountId: 'm1', displayName: 'Ana' },
      { accountId: 'm2', displayName: 'Beto' },
    ]
    const { code, salida } = correr({ tracker: TRACKER }, [ficha('QT-1', { status: 'in_progress', assignee: dos })])
    expect(salida).toContain('QT-1 esta en vuelo con 2 members')
    expect(code).not.toBe(0)
  })

  it('trello: la identidad es trello_member_id y cuenta el cupo con ella', () => {
    const mia = { status: 'in_progress', zone: 'backend', assignee: { accountId: 'm1', displayName: 'Ana' } }
    const { code, salida } = correr({ tracker: TRACKER }, [ficha('QT-1', mia)])
    expect(code, salida).toBe(0)
    expect(salida).toContain('mis in_progress=1')
  })

  it('trello sin trello_member_id avisa con /tracker-connect', () => {
    const { code, salida } = correr({ tracker: TRACKER }, [ficha('QT-1')], { jira_account_id: 'u1' })
    expect(code, salida).toBe(0)
    expect(salida).toContain('trello_member_id')
    expect(salida).toContain('/tracker-connect')
  })

  it('una feature en vuelo sin member falla nombrando el tracker', () => {
    const { code, salida } = correr({ tracker: TRACKER }, [ficha('QT-1', { status: 'in_progress' })])
    expect(salida).toContain('sin assignee en el tracker: QT-1')
    expect(code).not.toBe(0)
  })
})
