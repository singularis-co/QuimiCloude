import { describe, expect, it } from 'vitest'

import { whatsappGraphClientCanned } from '@/lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-canned'
import {
  planTemplateSync,
  templateSyncCounts,
  type LocalTemplateForSync,
} from '@/lib/modules/integraciones/domain/template-sync-plan'
import { toMetaComponents } from '@/lib/modules/integraciones/domain/whatsapp-template-components'
import type { WhatsappTemplateContent } from '@/lib/modules/integraciones/domain/whatsapp-template-draft'
import { interpretMetaTemplate, type MetaTemplateSnapshot } from '@/lib/modules/integraciones/domain/whatsapp-template-meta'

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
  return { id, ...snapshot(metaTemplateId), deletedAt: null, mappingStatus: 'MAPPED', enabled: true, ...overrides }
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
      expect(plan.inserts.map((insert) => insert.template.metaTemplateId)).toEqual(c.inserts)
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
    expect(plan.updates).toEqual([
      { id: 'a', template: fresh, changed: true, resetVariables: false, mappingStatusAfterReset: 'MAPPED', enabledAfterReset: true },
    ])
  })

  it('R23: un id de Meta repetido en la lista se toma una sola vez', () => {
    const plan = planTemplateSync({ locals: [], snapshots: [snapshot('1'), snapshot('1')], protectedIds: [] })
    expect(plan.inserts).toHaveLength(1)
  })
})

const WITH_SLOT = [{ type: 'BODY', text: 'Hola {{1}}', example: { body_text: [['Ana']] } }]
const NOT_MAPPABLE = [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'Hola' }]

describe('R70: lo importado llega sin relaciones', () => {
  it.each([
    ['sin huecos', snapshot('1').components, 'MAPPED', true],
    ['con un hueco en el body', WITH_SLOT, 'UNMAPPED', false],
    ['no relacionable (header de imagen)', NOT_MAPPABLE, 'UNMAPPED', false],
    ['con una variable con nombre', [{ type: 'BODY', text: 'Hola {{first_name}}' }], 'UNMAPPED', false],
  ] as const)('R70: importada %s => %s y habilitada %s', (_caso, components, mappingStatus, enabled) => {
    const template = snapshot('1', { components })
    const plan = planTemplateSync({ locals: [], snapshots: [template], protectedIds: [] })
    expect(plan.inserts).toEqual([{ template, mappingStatus, enabled }])
  })

  it.each([
    ['sin huecos', snapshot('1').components, true, 'MAPPED', true],
    ['sin huecos, aunque estuviera deshabilitada', snapshot('1').components, false, 'MAPPED', true],
    ['con huecos, aunque estuviera habilitada', WITH_SLOT, true, 'UNMAPPED', false],
  ] as const)('R70: una revivida %s se trata como importada', (_caso, components, wasEnabled, mappingStatus, enabled) => {
    const plan = planTemplateSync({
      locals: [local('a', '1', { components, deletedAt: DELETED_AT, enabled: wasEnabled })],
      snapshots: [snapshot('1', { components })],
      protectedIds: [],
    })
    expect(plan.updates[0]).toMatchObject({
      changed: true,
      resetVariables: true,
      mappingStatusAfterReset: mappingStatus,
      enabledAfterReset: enabled,
    })
  })
})

describe('R71: si cambian los componentes se quitan las relaciones', () => {
  const content: WhatsappTemplateContent = {
    header: { text: 'Pedido {{1}}', example: 'A-1' },
    body: { text: 'Hola {{1}}, tu pedido {{2}}', examples: ['Ana', 'A-1'] },
    footer: 'Gracias',
    buttons: [
      { type: 'URL', text: 'Ver', url: 'https://tienda.test/p/{{1}}', example: 'https://tienda.test/p/A-1' },
      { type: 'QUICK_REPLY', text: 'Ok' },
    ],
  }
  const stored = toMetaComponents(content)

  it.each([
    ['el body', { ...content, body: { ...content.body, text: 'Adios {{1}}, tu pedido {{2}}' } }, true],
    ['el footer', { ...content, footer: 'Saludos' }, true],
    ['un ejemplo', { ...content, body: { ...content.body, examples: ['Luis', 'A-1'] } }, true],
    ['un boton', { ...content, buttons: [content.buttons[0]!, { type: 'QUICK_REPLY' as const, text: 'Listo' }] }, true],
    ['nada del contenido', content, false],
  ])('R71: cambia %s => resetVariables %s', (_caso, listed, reset) => {
    const plan = planTemplateSync({
      locals: [local('a', '1', { components: stored, mappingStatus: 'MAPPED', enabled: true })],
      snapshots: [snapshot('1', { components: toMetaComponents(listed) })],
      protectedIds: [],
    })
    expect(plan.updates[0]?.resetVariables).toBe(reset)
  })

  it('R71: el mismo contenido con otra forma de JSON (claves de mas, otro orden) no quita relaciones', () => {
    const listed = [
      { text: 'Hola {{1}}', type: 'BODY', example: { body_text: [['Ana']] }, extra: 'de Meta' },
    ]
    const plan = planTemplateSync({
      locals: [local('a', '1', { components: WITH_SLOT, mappingStatus: 'MAPPED', enabled: true })],
      snapshots: [snapshot('1', { components: listed })],
      protectedIds: [],
    })
    expect(plan.updates[0]).toMatchObject({ resetVariables: false, mappingStatusAfterReset: 'MAPPED', enabledAfterReset: true })
  })

  it('R71: sin cambio de componentes la fila conserva su estado del mapeo y su habilitacion', () => {
    const plan = planTemplateSync({
      locals: [local('a', '1', { components: WITH_SLOT, mappingStatus: 'UNMAPPED', enabled: false, status: 'PENDING' })],
      snapshots: [snapshot('1', { components: WITH_SLOT })],
      protectedIds: [],
    })
    expect(plan.updates[0]).toMatchObject({
      changed: true,
      resetVariables: false,
      mappingStatusAfterReset: 'UNMAPPED',
      enabledAfterReset: false,
    })
  })

  it('R71 R72: el reset con huecos deja la plantilla sin relacionar y deshabilitada', () => {
    const plan = planTemplateSync({
      locals: [local('a', '1', { components: WITH_SLOT, mappingStatus: 'MAPPED', enabled: true })],
      snapshots: [snapshot('1', { components: [{ type: 'BODY', text: 'Hola {{1}} y {{2}}', example: { body_text: [['a', 'b']] } }] })],
      protectedIds: [],
    })
    expect(plan.updates[0]).toMatchObject({
      changed: true,
      resetVariables: true,
      mappingStatusAfterReset: 'UNMAPPED',
      enabledAfterReset: false,
    })
  })

  it.each([true, false])('R71: el reset sin huecos queda relacionado y conserva la habilitacion (%s)', (enabled) => {
    const plan = planTemplateSync({
      locals: [local('a', '1', { components: WITH_SLOT, mappingStatus: 'MAPPED', enabled })],
      snapshots: [snapshot('1', { components: [{ type: 'BODY', text: 'Adios' }] })],
      protectedIds: [],
    })
    expect(plan.updates[0]).toMatchObject({ resetVariables: true, mappingStatusAfterReset: 'MAPPED', enabledAfterReset: enabled })
  })

  it('R71: el reset a contenido no relacionable deja la plantilla sin relacionar y deshabilitada', () => {
    const plan = planTemplateSync({
      locals: [local('a', '1', { components: snapshot('1').components, mappingStatus: 'MAPPED', enabled: true })],
      snapshots: [snapshot('1', { components: NOT_MAPPABLE })],
      protectedIds: [],
    })
    expect(plan.updates[0]).toMatchObject({ resetVariables: true, mappingStatusAfterReset: 'UNMAPPED', enabledAfterReset: false })
  })

  it('R25 R71: quitar relaciones no cambia los conteos', () => {
    const plan = planTemplateSync({
      locals: [local('a', '1', { components: WITH_SLOT }), local('b', '2')],
      snapshots: [snapshot('1', { components: [{ type: 'BODY', text: 'Otro {{1}}' }] }), snapshot('2')],
      protectedIds: [],
    })
    expect(plan.updates.map(({ id, changed, resetVariables }) => ({ id, changed, resetVariables }))).toEqual([
      { id: 'a', changed: true, resetVariables: true },
      { id: 'b', changed: false, resetVariables: false },
    ])
    expect(templateSyncCounts(plan)).toEqual({ imported: 0, updated: 1, deleted: 0 })
  })

  it('R71: lo creado (toMetaComponents) y lo que lista el doble canned para esa misma plantilla no cuentan como cambio', async () => {
    const wabaId = `waba-plan-${String(Date.now())}`
    const created = await whatsappGraphClientCanned.createTemplate({
      wabaId,
      accessToken: 'token',
      name: 'pedido_listo',
      language: 'es',
      category: 'UTILITY',
      components: stored,
    })
    if (!created.ok) throw new Error('el doble no creo la plantilla')
    const page = await whatsappGraphClientCanned.listTemplatesPage({ wabaId, accessToken: 'token', after: null })
    if (!page.ok) throw new Error('el doble no listo las plantillas')
    const interpreted = interpretMetaTemplate(page.items[0])
    if (!interpreted.ok) throw new Error('el listado del doble no se interpreta')

    const plan = planTemplateSync({
      locals: [
        local('a', created.id, {
          name: 'pedido_listo',
          status: 'PENDING',
          components: stored,
          mappingStatus: 'MAPPED',
          enabled: true,
        }),
      ],
      snapshots: [interpreted.template],
      protectedIds: [],
    })

    expect(plan.updates[0]).toMatchObject({
      changed: false,
      resetVariables: false,
      mappingStatusAfterReset: 'MAPPED',
      enabledAfterReset: true,
    })
  })

  it('R96: el ejemplo del boton URL listado como texto, y guardado como lista, no quita relaciones', () => {
    const listed = stored.map((component) =>
      component.type === 'BUTTONS'
        ? {
            ...component,
            buttons: component.buttons.map((button) =>
              button.type === 'URL' ? { ...button, example: button.example?.[0] } : button,
            ),
          }
        : component,
    )
    const plan = planTemplateSync({
      locals: [local('a', '1', { components: stored, mappingStatus: 'MAPPED', enabled: true })],
      snapshots: [snapshot('1', { components: listed })],
      protectedIds: [],
    })
    expect(plan.updates[0]).toMatchObject({ resetVariables: false, mappingStatusAfterReset: 'MAPPED', enabledAfterReset: true })
  })

  it('R96: un ejemplo de URL distinto como texto si quita relaciones', () => {
    const listed = stored.map((component) =>
      component.type === 'BUTTONS'
        ? {
            ...component,
            buttons: component.buttons.map((button) =>
              button.type === 'URL' ? { ...button, example: 'https://tienda.test/p/B-2' } : button,
            ),
          }
        : component,
    )
    const plan = planTemplateSync({
      locals: [local('a', '1', { components: stored })],
      snapshots: [snapshot('1', { components: listed })],
      protectedIds: [],
    })
    expect(plan.updates[0]?.resetVariables).toBe(true)
  })
})
