// Guardia: el mapeo tarjeta de Trello -> ficha de `feature_list.json` de `scripts/trello.mjs`
// cumple `docs/trello.md > El contrato de campos`, sin red:
//   - labels `zone:`, `complexity:`, `slug:`, `sdd` y `epic:<KEY> <nombre>`, como en Jira;
//   - `depends_on` sale del checklist «Depende de»;
//   - el label `key:<KEY>` (features migradas de Jira) manda sobre `<prefijo>-<idShort>`;
//   - una lista sin traduccion en `tracker.estados` lanza: el estado nunca se adivina.
//
// Las funciones son puras y estan exportadas a proposito; la red (fetch) no se toca aqui.

import { describe, expect, it } from 'vitest'

import { fusionarConCopia, keyDeTarjeta, listaParaEstado, resolverTracker, tarjetaAFicha } from '../../scripts/trello.mjs'

const ESTADOS = { Pendiente: 'pending', 'Spec en revisión': 'spec_ready', 'En curso': 'in_progress', Hecho: 'done' }
const LISTAS = new Map([
  ['l1', 'Pendiente'],
  ['l2', 'Spec en revisión'],
  ['l3', 'En curso'],
  ['l9', 'Ideas'],
])
const CTX = { prefijo: 'QT', estados: ESTADOS, listas: LISTAS }

const label = (name: string) => ({ id: `id-${name}`, name, color: null })

const tarjeta = (extra: Record<string, unknown> = {}) => ({
  id: 'c1',
  idShort: 7,
  name: 'Alta de clientes',
  desc: 'Pantalla de alta',
  idList: 'l3',
  labels: ['zone:backend', 'complexity:medium', 'slug:alta-de-clientes', 'sdd', 'epic:QC-17 Identidad y acceso'].map(label),
  members: [{ id: 'm1', fullName: 'Ana Pérez' }],
  idMembers: ['m1'],
  checklists: [
    { id: 'k0', name: 'Otro', checkItems: [{ name: 'no cuenta', pos: 1 }] },
    {
      id: 'k1',
      name: 'Depende de',
      checkItems: [
        { name: 'QC-12', pos: 2 },
        { name: 'QT-3', pos: 1 },
      ],
    },
  ],
  ...extra,
})

describe('guardia: cliente de Trello, tarjeta -> ficha', () => {
  it('mapea labels, lista, checklist y member como en el contrato de campos', () => {
    expect(tarjetaAFicha(tarjeta(), CTX)).toEqual({
      key: 'QT-7',
      id: 7,
      epic: 'QC-17',
      epic_name: 'Identidad y acceso',
      name: 'alta-de-clientes',
      description: 'Pantalla de alta',
      status: 'in_progress',
      sdd: true,
      complexity: 'medium',
      zone: 'backend',
      branch: 'feature/QT-7-alta-de-clientes',
      depends_on: ['QT-3', 'QC-12'],
      spec_path: 'specs/QT-7-alta-de-clientes',
      assignee: { accountId: 'm1', displayName: 'Ana Pérez' },
    })
  })

  it('el label key: manda sobre el idShort (features migradas de Jira)', () => {
    const f = tarjetaAFicha(tarjeta({ labels: [label('key:QC-131'), label('slug:prompts')] }), CTX)
    expect(f.key).toBe('QC-131')
    expect(f.id).toBe(131)
    expect(f.branch).toBe('feature/QC-131-prompts')
    expect(keyDeTarjeta(tarjeta({ labels: [] }), 'QT')).toBe('QT-7')
  })

  it('un label key: mal formado lanza', () => {
    expect(() => keyDeTarjeta(tarjeta({ labels: [label('key:qc131')] }), 'QT')).toThrow('PROYECTO-NUMERO')
  })

  it('una lista sin traduccion en tracker.estados lanza nombrando la lista y la key', () => {
    expect(() => tarjetaAFicha(tarjeta({ idList: 'l9' }), CTX)).toThrow(/QT-7: la lista "Ideas" no esta en .*tracker\.estados/)
  })

  it('una lista que no es del board lanza', () => {
    expect(() => tarjetaAFicha(tarjeta({ idList: 'lx' }), CTX)).toThrow('lista desconocida')
  })

  it('sin checklist «Depende de», depends_on es []; sin labels, campos en null y sdd false', () => {
    const f = tarjetaAFicha(tarjeta({ labels: [], checklists: [] }), CTX)
    expect(f.depends_on).toEqual([])
    expect(f).toMatchObject({ zone: null, complexity: null, name: null, sdd: false, epic: null, epic_name: null, branch: null })
  })

  it('assignee: 0 members = null; mas de 1 = array (el validador lo rechaza en vuelo)', () => {
    expect(tarjetaAFicha(tarjeta({ members: [], idMembers: [] }), CTX).assignee).toBeNull()
    const dos = tarjetaAFicha(
      tarjeta({ members: [{ id: 'm1', fullName: 'Ana' }, { id: 'm2', fullName: 'Beto' }], idMembers: ['m1', 'm2'] }),
      CTX,
    ).assignee
    expect(dos).toEqual([
      { accountId: 'm1', displayName: 'Ana' },
      { accountId: 'm2', displayName: 'Beto' },
    ])
  })

  it('un label epic: sin nombre lanza', () => {
    expect(() => tarjetaAFicha(tarjeta({ labels: [label('epic:QC-17')] }), CTX)).toThrow('epic:<KEY> <nombre>')
  })

  it('F0 no degrada una in_progress ni borra zone/complexity evaluadas', () => {
    const nueva = { key: 'QT-7', status: 'spec_ready', zone: null, complexity: null }
    const antes = { key: 'QT-7', status: 'in_progress', zone: 'backend', complexity: 'low' }
    const { fichas, avisos } = fusionarConCopia([nueva], [antes])
    expect(fichas[0]).toMatchObject({ status: 'in_progress', zone: 'backend', complexity: 'low' })
    expect(avisos).toHaveLength(3)
  })

  it('listaParaEstado elige la lista del board que traduce a ese estado', () => {
    const listas = [
      { id: 'l1', name: 'Pendiente' },
      { id: 'l3', name: 'En curso' },
    ]
    expect(listaParaEstado('in_progress', ESTADOS, listas)).toEqual({ id: 'l3', name: 'En curso' })
    expect(listaParaEstado('cancelled', ESTADOS, listas)).toBeNull()
  })

  it('resolverTracker: sin bloque tracker, el bloque jira equivale a tipo jira', () => {
    expect(resolverTracker({ jira: { project: 'QC', estados: { A: 'pending' } } })).toMatchObject({
      tipo: 'jira',
      prefijo: 'QC',
      estados: { A: 'pending' },
    })
    expect(resolverTracker({ tracker: { tipo: 'trello', board: 'b', prefijo: 'QT', prefijos_historicos: ['QC'] } })).toMatchObject({
      tipo: 'trello',
      prefijo: 'QT',
      historicos: ['QC'],
    })
  })
})
