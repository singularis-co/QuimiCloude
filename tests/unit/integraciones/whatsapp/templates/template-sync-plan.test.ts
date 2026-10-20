import { describe, expect, it } from 'vitest'

import {
  planTemplateSync,
  templateSyncCounts,
  type LocalTemplateForSync,
} from '@/lib/modules/integraciones/domain/template-sync-plan'
import type { MetaTemplateSnapshot } from '@/lib/modules/integraciones/domain/whatsapp-template-meta'

function snapshot(metaTemplateId: string, overrides: Partial<MetaTemplateSnapshot> = {}): MetaTemplateSnapshot {
  return {
    metaTemplateId,
    name: `plantilla_${metaTemplateId}`,
    language: 'es',
    category: 'UTILITY',
    status: 'APPROVED',
    statusRaw: null,
    rejectedReason: null,
    components: [{ type: 'BODY', text: 'Hola', example: { body_text: [['a']] } }],
    ...overrides,
  }
}

function local(id: string, metaTemplateId: string, overrides: Partial<LocalTemplateForSync> = {}): LocalTemplateForSync {
  return { id, ...snapshot(metaTemplateId), deletedAt: null, ...overrides }
}

const DELETED_AT = new Date('2026-10-01T00:00:00Z')

describe('planTemplateSync', () => {
  const cases: {
    name: string
    locals: LocalTemplateForSync[]
    snapshots: MetaTemplateSnapshot[]
    protectedIds?: string[]
    inserts: string[]
    updates: { id: string; changed: boolean }[]
    deletes: string[]
    counts: { imported: number; updated: number; deleted: number }
  }[] = [
    {
      name: 'R23: importa la que no tiene fila local',
      locals: [],
      snapshots: [snapshot('1')],
      inserts: ['1'],
      updates: [],
      deletes: [],
      counts: { imported: 1, updated: 0, deleted: 0 },
    },
    {
      name: 'R23: actualiza el estado de una que cambio en Meta',
      locals: [local('a', '1', { status: 'PENDING' })],
      snapshots: [snapshot('1')],
      inserts: [],
      updates: [{ id: 'a', changed: true }],
      deletes: [],
      counts: { imported: 0, updated: 1, deleted: 0 },
    },
    {
      name: 'R23: revive una eliminada que Meta sigue devolviendo',
      locals: [local('a', '1', { deletedAt: DELETED_AT })],
      snapshots: [snapshot('1')],
      inserts: [],
      updates: [{ id: 'a', changed: true }],
      deletes: [],
      counts: { imported: 0, updated: 1, deleted: 0 },
    },
    {
      name: 'R25: no cuenta como actualizada la que no cambia, aunque Meta ordene las claves distinto',
      locals: [local('a', '1', { components: [{ example: { body_text: [['a']] }, text: 'Hola', type: 'BODY' }] })],
      snapshots: [snapshot('1')],
      inserts: [],
      updates: [{ id: 'a', changed: false }],
      deletes: [],
      counts: { imported: 0, updated: 0, deleted: 0 },
    },
    {
      name: 'R24: no borra una protegida aunque no venga en la lista',
      locals: [local('a', '1')],
      snapshots: [],
      protectedIds: ['1'],
      inserts: [],
      updates: [],
      deletes: [],
      counts: { imported: 0, updated: 0, deleted: 0 },
    },
    {
      name: 'R24: borra la viva que falta en la lista, y no vuelve a borrar una ya eliminada',
      locals: [local('a', '1'), local('b', '2', { deletedAt: DELETED_AT }), local('c', '3')],
      snapshots: [snapshot('3')],
      inserts: [],
      updates: [{ id: 'c', changed: false }],
      deletes: ['a'],
      counts: { imported: 0, updated: 0, deleted: 1 },
    },
  ]

  for (const c of cases) {
    it(c.name, () => {
      const plan = planTemplateSync({ locals: c.locals, snapshots: c.snapshots, protectedIds: c.protectedIds ?? [] })
      expect(plan.inserts.map((t) => t.metaTemplateId)).toEqual(c.inserts)
      expect(plan.updates.map(({ id, changed }) => ({ id, changed }))).toEqual(c.updates)
      expect(plan.deletes).toEqual(c.deletes)
      expect(templateSyncCounts(plan)).toEqual(c.counts)
    })
  }

  it('R23: cada campo de la puesta al dia, cambiado solo, marca la fila como cambiada', () => {
    const changes: Partial<LocalTemplateForSync>[] = [
      { name: 'otro' },
      { language: 'en' },
      { category: 'MARKETING' },
      { status: 'OTHER', statusRaw: 'IN_APPEAL' },
      { rejectedReason: 'INVALID_FORMAT' },
      { components: [{ type: 'BODY', text: 'Adios' }] },
    ]
    for (const change of changes) {
      const plan = planTemplateSync({ locals: [local('a', '1', change)], snapshots: [snapshot('1')], protectedIds: [] })
      expect(plan.updates[0]?.changed, JSON.stringify(change)).toBe(true)
    }
  })

  it('R23: la actualizacion lleva la foto de Meta y el id local', () => {
    const fresh = snapshot('1', { status: 'REJECTED', rejectedReason: 'INVALID_FORMAT' })
    const plan = planTemplateSync({ locals: [local('a', '1')], snapshots: [fresh], protectedIds: [] })
    expect(plan.updates).toEqual([{ id: 'a', template: fresh, changed: true }])
  })

  it('R23: un id de Meta repetido en la lista se toma una sola vez', () => {
    const plan = planTemplateSync({ locals: [], snapshots: [snapshot('1'), snapshot('1')], protectedIds: [] })
    expect(plan.inserts).toHaveLength(1)
  })
})
