import { describe, expect, it } from 'vitest'

import { UnauthorizedError, ValidationError, WhatsappTemplateNotFoundError } from '@/lib/modules/integraciones/domain/errors'
import {
  createGetWhatsappTemplate,
  createListWhatsappTemplates,
  toWhatsappTemplateView,
} from '@/lib/modules/integraciones/domain/list-whatsapp-templates'
import { toMetaComponents } from '@/lib/modules/integraciones/domain/whatsapp-template-components'

import {
  NEW_CONNECTION_ID,
  OTHER_COMPANY_ID,
  TEMPLATE_ID,
  admin,
  storedTemplate,
} from '../whatsapp-doubles'
import { explodingTemplateDeps, setupTemplates, type TemplateSetupOptions } from './template-use-case-setup'

const SYNCED_AT = new Date('2026-10-08T08:00:00.000Z')

const idOf = (n: number) => `00000000-0000-4000-8000-${String(200000000000 + n)}`

function setup(options: TemplateSetupOptions = {}) {
  const ctx = setupTemplates({ connection: { templatesSyncedAt: SYNCED_AT }, ...options })
  return {
    ...ctx,
    list: createListWhatsappTemplates(ctx.deps),
    get: createGetWhatsappTemplate(ctx.deps),
  }
}

describe('listar y consultar plantillas: permiso', () => {
  it.each([
    ['sin actor', null],
    ['sin el permiso', admin({ permissions: ['integraciones.ver'] })],
    ['sin empresa', admin({ companyId: '' })],
  ])('R5: listar %s rechaza con unauthorized antes de validar y sin tocar ningun puerto', async (_caso, actor) => {
    const { deps, espias } = explodingTemplateDeps()

    await expect(createListWhatsappTemplates(deps)({ onlyApproved: 'si' }, actor)).rejects.toBeInstanceOf(UnauthorizedError)
    for (const espia of espias) expect(espia).not.toHaveBeenCalled()
  })

  it.each([
    ['sin actor', null],
    ['sin el permiso', admin({ permissions: [] })],
  ])('R5: consultar %s rechaza con unauthorized sin tocar ningun puerto', async (_caso, actor) => {
    const { deps, espias } = explodingTemplateDeps()

    await expect(createGetWhatsappTemplate(deps)('no-es-uuid', actor)).rejects.toBeInstanceOf(UnauthorizedError)
    for (const espia of espias) expect(espia).not.toHaveBeenCalled()
  })
})

describe('listar plantillas', () => {
  const rows = [
    storedTemplate({ id: idOf(1), metaTemplateId: '1', name: 'zeta', language: 'es', status: 'APPROVED' }),
    storedTemplate({ id: idOf(2), metaTemplateId: '2', name: 'alfa', language: 'es', status: 'PENDING' }),
    storedTemplate({ id: idOf(3), metaTemplateId: '3', name: 'alfa', language: 'en_US', status: 'APPROVED' }),
    storedTemplate({ id: idOf(4), metaTemplateId: '4', name: 'borrada', deletedAt: new Date('2026-10-02T00:00:00.000Z') }),
    storedTemplate({ id: idOf(5), metaTemplateId: '5', name: 'ajena', companyId: OTHER_COMPANY_ID }),
    storedTemplate({ id: idOf(6), metaTemplateId: '6', name: 'otra_conexion', connectionId: NEW_CONNECTION_ID }),
  ]

  it('R44: devuelve las vivas de la conexion viva ordenadas por nombre y luego idioma, con la hora de sincronizacion', async () => {
    const { list } = setup({ templates: rows })

    const result = await list({}, admin())

    expect(result.templates.map((t) => `${t.name}/${t.language}`)).toEqual(['alfa/en_US', 'alfa/es', 'zeta/es'])
    expect(result.templatesSyncedAt).toBe(SYNCED_AT.toISOString())
  })

  it('R44: con «solo aprobadas» devuelve unicamente las APPROVED', async () => {
    const { list, templates } = setup({ templates: rows })

    const result = await list({ onlyApproved: true }, admin())

    expect(result.templates.map((t) => t.status)).toEqual(['APPROVED', 'APPROVED'])
    expect(templates.listLive.mock.calls[0]?.[1]).toEqual({ onlyApproved: true })
  })

  it('R44: sin entrada lista todas las vivas', async () => {
    const { list, templates } = setup({ templates: rows })

    await list(undefined, admin())
    expect(templates.listLive.mock.calls[0]?.[1]).toEqual({ onlyApproved: false })
  })

  it('R44: sin conexion viva devuelve la lista vacia y la hora vacia sin leer plantillas', async () => {
    const { list, templates } = setup({ connection: null, templates: rows })

    await expect(list({}, admin())).resolves.toEqual({ templates: [], templatesSyncedAt: null })
    expect(templates.listLive).not.toHaveBeenCalled()
  })

  it('R44: una conexion nunca sincronizada devuelve la hora vacia', async () => {
    const { list } = setup({ connection: { templatesSyncedAt: null } })

    await expect(list({}, admin())).resolves.toEqual({ templates: [], templatesSyncedAt: null })
  })

  it('R44: una conexion deshabilitada se lista igual: leer la copia local no toca Meta', async () => {
    const { list, graph } = setup({ connection: { status: 'DISABLED', templatesSyncedAt: SYNCED_AT }, templates: rows })

    const result = await list({}, admin())

    expect(result.templates).toHaveLength(3)
    expect(graph.listTemplatesPage).not.toHaveBeenCalled()
  })

  it('R44: un filtro con forma invalida rechaza con invalid_input', async () => {
    const { list } = setup()

    await expect(list({ onlyApproved: 'si' }, admin())).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('consultar plantilla', () => {
  it('R45: devuelve la vista de una viva de la conexion viva', async () => {
    const { get } = setup({ templates: [storedTemplate()] })

    await expect(get(TEMPLATE_ID, admin())).resolves.toMatchObject({ id: TEMPLATE_ID, name: 'bienvenida' })
  })

  it.each([
    ['no es UUID', 'abc', [storedTemplate()]],
    ['no existe', TEMPLATE_ID, []],
    ['es de otra empresa', TEMPLATE_ID, [storedTemplate({ companyId: OTHER_COMPANY_ID })]],
    ['es de otra conexion', TEMPLATE_ID, [storedTemplate({ connectionId: NEW_CONNECTION_ID })]],
    ['esta eliminada', TEMPLATE_ID, [storedTemplate({ deletedAt: new Date('2026-10-02T00:00:00.000Z') })]],
  ])('R45: si %s responde whatsapp_template_not_found', async (_caso, id, templates) => {
    const { get } = setup({ templates })

    await expect(get(id, admin())).rejects.toBeInstanceOf(WhatsappTemplateNotFoundError)
  })

  it('R45: sin conexion viva responde whatsapp_template_not_found', async () => {
    const { get } = setup({ connection: null, templates: [storedTemplate()] })

    await expect(get(TEMPLATE_ID, admin())).rejects.toBeInstanceOf(WhatsappTemplateNotFoundError)
  })
})

describe('vista de una plantilla', () => {
  const content = {
    header: { text: 'Hola {{1}}', example: 'Ana' },
    body: { text: 'Tu pedido {{1}} esta listo', examples: ['A-1'] },
    footer: 'Gracias',
    buttons: [{ type: 'QUICK_REPLY' as const, text: 'Ok' }],
  }

  it('R46: trae exactamente id, nombre, idioma, categoria, estado, valor crudo, motivo, contenido y horas', () => {
    const view = toWhatsappTemplateView(
      storedTemplate({
        components: toMetaComponents(content),
        status: 'OTHER',
        statusRaw: 'IN_APPEAL',
        lastSyncedAt: new Date('2026-10-03T00:00:00.000Z'),
      }),
    )

    expect(Object.keys(view).sort()).toEqual(
      [
        'category',
        'content',
        'createdAt',
        'enabled',
        'id',
        'language',
        'lastSyncedAt',
        'mappingStatus',
        'name',
        'rejectedReason',
        'status',
        'statusRaw',
        'variables',
      ].sort(),
    )
    expect(view).toEqual({
      id: TEMPLATE_ID,
      name: 'bienvenida',
      language: 'es',
      category: 'UTILITY',
      status: 'OTHER',
      statusRaw: 'IN_APPEAL',
      rejectedReason: null,
      content,
      lastSyncedAt: '2026-10-03T00:00:00.000Z',
      createdAt: '2026-10-01T00:00:00.000Z',
      mappingStatus: 'MAPPED',
      enabled: true,
      variables: [],
    })
  })

  it('R46: el contenido viene vacio si un componente no es de esta fase', () => {
    const view = toWhatsappTemplateView(
      storedTemplate({ components: [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'Hola' }] }),
    )

    expect(view.content).toBeNull()
  })

  it('R46: sin hora de sincronizacion la vista la trae vacia', () => {
    expect(toWhatsappTemplateView(storedTemplate({ lastSyncedAt: null })).lastSyncedAt).toBeNull()
  })
})
