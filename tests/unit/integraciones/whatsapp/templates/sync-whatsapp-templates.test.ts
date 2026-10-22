import { describe, expect, it } from 'vitest'

import { UNREADABLE_SECRET_MESSAGE } from '@/lib/modules/integraciones/domain/connection-secrets'
import {
  ActionNotAllowedError,
  IntegracionesError,
  SecretUnreadableError,
  UnauthorizedError,
  WhatsappConnectionNotFoundError,
  WhatsappMetaRejectedError,
  WhatsappMetaUnreachableError,
} from '@/lib/modules/integraciones/domain/errors'
import {
  MAX_TEMPLATE_PAGES,
  createResyncWhatsappTemplates,
  createSyncWhatsappTemplates,
  syncConnectionTemplates,
  type SyncTemplatesGraph,
} from '@/lib/modules/integraciones/domain/sync-whatsapp-templates'
import type { GraphTemplatePage } from '@/lib/modules/integraciones/ports/whatsapp-graph-client'

import {
  ACCESS_TOKEN,
  APP_SECRET,
  COMPANY_ID,
  CONNECTION_ID,
  NOW,
  admin,
  makeIntegrationsSwitch,
  makeWebhookDirectory,
  storedConnection,
  storedTemplate,
} from '../whatsapp-doubles'
import { explodingTemplateDeps, setupTemplates, type TemplateSetupOptions } from './template-use-case-setup'

const STARTED_AT = new Date('2026-10-09T11:59:00.000Z')

function metaItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `plantilla_${id}`,
    language: 'es',
    status: 'APPROVED',
    category: 'UTILITY',
    components: [{ type: 'BODY', text: `Hola ${id}` }],
    ...overrides,
  }
}

function pages(...list: GraphTemplatePage[]) {
  const queue = [...list]
  return async () => queue.shift() ?? { ok: false as const, kind: 'rejected' as const, message: 'sin mas paginas' }
}

function setup(options: TemplateSetupOptions & { addonOn?: boolean } = {}) {
  const ctx = setupTemplates(options)
  let ticks = 0
  const clock = () => {
    ticks += 1
    return ticks === 1 ? STARTED_AT : NOW
  }
  const directory = makeWebhookDirectory()
  const integrations = makeIntegrationsSwitch(options.addonOn ?? true)
  const deps = { ...ctx.deps, now: clock, directory: directory.directory, integrations: integrations.integrations }
  return {
    ...ctx,
    deps,
    directory,
    integrations,
    sync: createSyncWhatsappTemplates(deps),
    resync: createResyncWhatsappTemplates(deps),
  }
}

describe('sincronizar: nucleo', () => {
  it('R22 R23 R25: lee las tres paginas con el cursor y despues importa, actualiza y devuelve el resumen', async () => {
    const { graph, templates, sync } = setup({
      templates: [storedTemplate({ metaTemplateId: '2', name: 'plantilla_2', status: 'PENDING', components: [{ type: 'BODY', text: 'Hola 2' }] })],
    })
    graph.listTemplatesPage.mockImplementation(
      pages(
        { ok: true, items: [metaItem('1')], next: 'c1' },
        { ok: true, items: [metaItem('2')], next: 'c2' },
        { ok: true, items: [metaItem('3')], next: null },
      ),
    )

    const summary = await sync(admin())

    expect(graph.listTemplatesPage.mock.calls.map(([input]) => input.after)).toEqual([null, 'c1', 'c2'])
    expect(graph.listTemplatesPage.mock.calls[0]?.[0]).toEqual({ wabaId: '2345678901', accessToken: ACCESS_TOKEN, after: null })
    expect(summary).toEqual({ imported: 2, updated: 1, deleted: 0, skipped: 0, syncedAt: NOW.toISOString() })
    expect(templates.applySync).toHaveBeenCalledTimes(1)
    expect(templates.applySync.mock.calls[0]?.[2]).toEqual(STARTED_AT)
    expect(templates.applySync.mock.calls[0]?.[3]).toEqual(NOW)
    expect(templates.syncedAtOf(CONNECTION_ID)).toEqual(NOW)
  })

  it('R22: si falla la segunda de tres paginas no se escribe nada', async () => {
    const { graph, templates, sync } = setup({ templates: [storedTemplate()] })
    graph.listTemplatesPage.mockImplementation(
      pages(
        { ok: true, items: [metaItem('1')], next: 'c1' },
        { ok: false, kind: 'unreachable', message: null, code: null, subcode: null },
        { ok: true, items: [metaItem('3')], next: null },
      ),
    )

    await expect(sync(admin())).rejects.toBeInstanceOf(WhatsappMetaUnreachableError)
    expect(graph.listTemplatesPage).toHaveBeenCalledTimes(2)
    expect(templates.applySync).not.toHaveBeenCalled()
    expect(templates.all()).toEqual([storedTemplate()])
  })

  it('R22 R21: un rechazo de Meta al listar es whatsapp_meta_rejected, sin secretos en el diagnostico', async () => {
    const { graph, templates, sync } = setup()
    graph.listTemplatesPage.mockImplementation(
      pages({ ok: false, kind: 'rejected', message: `${ACCESS_TOKEN} / ${APP_SECRET}`, code: 190, subcode: null }),
    )

    const error = (await sync(admin()).catch((e: unknown) => e)) as IntegracionesError

    expect(error).toBeInstanceOf(WhatsappMetaRejectedError)
    expect(`${error.message} ${error.diagnostic ?? ''}`).not.toContain(ACCESS_TOKEN)
    expect(`${error.message} ${error.diagnostic ?? ''}`).not.toContain(APP_SECRET)
    expect(templates.applySync).not.toHaveBeenCalled()
  })

  it('R22: si se alcanza el tope de paginas sin terminar rechaza sin escribir', async () => {
    const { graph, templates, sync } = setup()
    graph.listTemplatesPage.mockImplementation(async () => ({ ok: true, items: [metaItem('1')], next: 'otra' }))

    await expect(sync(admin())).rejects.toBeInstanceOf(WhatsappMetaRejectedError)
    expect(graph.listTemplatesPage).toHaveBeenCalledTimes(MAX_TEMPLATE_PAGES)
    expect(templates.applySync).not.toHaveBeenCalled()
  })

  it('R22: si falla la escritura el error se propaga', async () => {
    const { templates, sync } = setup()
    templates.applySync.mockRejectedValueOnce(new Error('la base fallo'))

    await expect(sync(admin())).rejects.toThrow('la base fallo')
  })

  it('R24: marca eliminadas las vivas que Meta ya no lista', async () => {
    const { templates, sync } = setup({ templates: [storedTemplate()] })

    const summary = await sync(admin())

    expect(summary).toMatchObject({ imported: 0, updated: 0, deleted: 1 })
    expect(templates.applySync.mock.calls[0]?.[1].deletes).toEqual([storedTemplate().id])
  })

  it('R26: salta las que no se pueden interpretar, las cuenta y no borra la local con ese id', async () => {
    const { graph, templates, sync } = setup({ templates: [storedTemplate({ metaTemplateId: '9001' })] })
    graph.listTemplatesPage.mockImplementation(
      pages({
        ok: true,
        items: [metaItem('9001', { category: 'NUEVA' }), metaItem('7', { name: '' }), { sin: 'id' }, metaItem('8')],
        next: null,
      }),
    )

    const summary = await sync(admin())

    expect(summary).toMatchObject({ imported: 1, deleted: 0, skipped: 3 })
    expect(templates.row(storedTemplate().id)?.deletedAt).toBeNull()
  })

  it('R27: nunca llama a crear ni a borrar en Meta, y el nucleo solo recibe la lectura por tipo', async () => {
    const { graph, deps, sync } = setup({ templates: [storedTemplate()] })
    const record = storedConnection(() => 'sin-uso', { status: 'ACTIVE' })
    graph.listTemplatesPage.mockImplementation(async () => ({ ok: true, items: [metaItem('1')], next: null }))

    const soloLectura: SyncTemplatesGraph = { listTemplatesPage: graph.listTemplatesPage }
    // @ts-expect-error la sincronizacion no admite un cliente que solo sabe crear
    const soloCrear: SyncTemplatesGraph = { createTemplate: graph.createTemplate }
    void soloCrear
    await syncConnectionTemplates({ ...deps, graph: soloLectura }, record, ACCESS_TOKEN, { companyId: COMPANY_ID })
    await sync(admin())

    expect(graph.createTemplate).not.toHaveBeenCalled()
    expect(graph.deleteTemplate).not.toHaveBeenCalled()
    expect(graph.fetchPhoneNumber).not.toHaveBeenCalled()
  })
})

describe('sincronizar a mano', () => {
  it.each([
    ['sin actor', null],
    ['sin el permiso', admin({ permissions: [] })],
    ['sin empresa', admin({ companyId: '' })],
  ])('R5: %s rechaza con unauthorized sin tocar ningun puerto', async (_caso, actor) => {
    const { deps, espias } = explodingTemplateDeps()

    await expect(createSyncWhatsappTemplates(deps)(actor)).rejects.toBeInstanceOf(UnauthorizedError)
    for (const espia of espias) expect(espia).not.toHaveBeenCalled()
  })

  it('R28: sincroniza la conexion viva de la empresa del actor y devuelve el resumen', async () => {
    const { graph, templates, sync } = setup()
    graph.listTemplatesPage.mockImplementation(pages({ ok: true, items: [metaItem('1')], next: null }))

    await expect(sync(admin())).resolves.toEqual({ imported: 1, updated: 0, deleted: 0, skipped: 0, syncedAt: NOW.toISOString() })
    expect(templates.applySync.mock.calls[0]?.[0]).toBe(CONNECTION_ID)
    expect(templates.applySync.mock.calls[0]?.[4]).toEqual({ companyId: COMPANY_ID })
  })

  it('R15: sin conexion viva rechaza con whatsapp_connection_not_found sin llamar a Meta', async () => {
    const { graph, sync } = setup({ connection: null })

    await expect(sync(admin())).rejects.toBeInstanceOf(WhatsappConnectionNotFoundError)
    expect(graph.listTemplatesPage).not.toHaveBeenCalled()
  })

  it('R15: con la conexion deshabilitada rechaza con action_not_allowed sin llamar a Meta', async () => {
    const { graph, sync } = setup({ connection: { status: 'DISABLED' } })

    await expect(sync(admin())).rejects.toBeInstanceOf(ActionNotAllowedError)
    expect(graph.listTemplatesPage).not.toHaveBeenCalled()
  })

  it('R20: un token ilegible rechaza con integration_secret_unreadable sin Meta y deja la conexion en ERROR', async () => {
    const { graph, repo, templates, sync } = setup({ connection: { accessTokenEnc: 'v1:roto', status: 'ACTIVE' } })

    await expect(sync(admin())).rejects.toBeInstanceOf(SecretUnreadableError)
    expect(graph.listTemplatesPage).not.toHaveBeenCalled()
    expect(templates.applySync).not.toHaveBeenCalled()
    expect(repo.row(CONNECTION_ID)).toMatchObject({ status: 'ERROR', lastError: UNREADABLE_SECRET_MESSAGE })
  })
})

describe('reintento del webhook', () => {
  it('R38: sincroniza la conexion del webhook con el ambito de su fila', async () => {
    const { graph, templates, resync } = setup({ connection: { status: 'ACTIVE' } })
    graph.listTemplatesPage.mockImplementation(pages({ ok: true, items: [metaItem('1')], next: null }))

    const outcome = await resync(CONNECTION_ID)

    expect(outcome).toEqual({
      kind: 'synced',
      summary: { imported: 1, updated: 0, deleted: 0, skipped: 0, syncedAt: NOW.toISOString() },
    })
    expect(templates.applySync.mock.calls[0]?.[4]).toEqual({ companyId: COMPANY_ID })
  })

  it.each([
    ['la conexion esta deshabilitada', { connection: { status: 'DISABLED' as const } }, 'disabled'],
    ['el anadido esta apagado', { addonOn: false }, 'addon_off'],
    ['la conexion no existe', { connection: null }, 'missing'],
  ])('R38: si %s se salta sin llamar a Meta', async (_caso, options, reason) => {
    const { graph, resync } = setup(options)

    await expect(resync(CONNECTION_ID)).resolves.toEqual({ kind: 'skipped', reason })
    expect(graph.listTemplatesPage).not.toHaveBeenCalled()
  })

  it('R38: un id que no es UUID se salta sin tocar el directorio', async () => {
    const { directory, resync } = setup()

    await expect(resync('no-es-uuid')).resolves.toEqual({ kind: 'skipped', reason: 'missing' })
    expect(directory.companyOfConnection).not.toHaveBeenCalled()
  })

  it('R38: un fallo de Meta vuelve como failed con su codigo, sin lanzar ni escribir', async () => {
    const { graph, templates, resync } = setup()
    graph.listTemplatesPage.mockImplementation(pages({ ok: false, kind: 'unreachable', message: null, code: null, subcode: null }))

    await expect(resync(CONNECTION_ID)).resolves.toEqual({ kind: 'failed', code: 'whatsapp_meta_unreachable' })
    expect(templates.applySync).not.toHaveBeenCalled()
  })

  it('R38 R20: un token ilegible vuelve como failed y deja la conexion en ERROR', async () => {
    const { repo, resync } = setup({ connection: { accessTokenEnc: 'v1:roto', status: 'ACTIVE' } })

    await expect(resync(CONNECTION_ID)).resolves.toEqual({ kind: 'failed', code: 'integration_secret_unreadable' })
    expect(repo.row(CONNECTION_ID)).toMatchObject({ status: 'ERROR' })
  })

  it('R38: un error sin codigo del catalogo vuelve como unexpected, sin su mensaje', async () => {
    const { templates, resync } = setup()
    templates.applySync.mockRejectedValueOnce(new Error('detalle interno'))

    await expect(resync(CONNECTION_ID)).resolves.toEqual({ kind: 'failed', code: 'unexpected' })
  })

  it('R38: un fallo del directorio tampoco lanza', async () => {
    const { directory, resync } = setup()
    directory.companyOfConnection.mockRejectedValueOnce(new Error('sin base'))

    await expect(resync(CONNECTION_ID)).resolves.toEqual({ kind: 'failed', code: 'unexpected' })
  })
})
