import { describe, expect, it } from 'vitest'

import { UNREADABLE_SECRET_MESSAGE } from '@/lib/modules/integraciones/domain/connection-secrets'
import { createDeleteWhatsappTemplate } from '@/lib/modules/integraciones/domain/delete-whatsapp-template'
import {
  ActionNotAllowedError,
  IntegracionesError,
  SecretUnreadableError,
  UnauthorizedError,
  WhatsappConnectionNotFoundError,
  WhatsappMetaRejectedError,
  WhatsappMetaUnreachableError,
  WhatsappTemplateNotFoundError,
} from '@/lib/modules/integraciones/domain/errors'

import {
  ACCESS_TOKEN,
  APP_SECRET,
  CONNECTION_ID,
  NEW_CONNECTION_ID,
  NOW,
  OTHER_COMPANY_ID,
  TEMPLATE_ID,
  admin,
  storedTemplate,
} from '../whatsapp-doubles'
import { explodingTemplateDeps, setupTemplates, type TemplateSetupOptions } from './template-use-case-setup'

const OTHER_LANGUAGE_ID = '00000000-0000-4000-8000-000000000102'

function setup(options: TemplateSetupOptions = {}) {
  const ctx = setupTemplates({ templates: [storedTemplate()], ...options })
  return { ...ctx, remove: createDeleteWhatsappTemplate(ctx.deps) }
}

describe('eliminar plantilla: permiso', () => {
  it.each([
    ['sin actor', null],
    ['sin el permiso', admin({ permissions: [] })],
    ['sin empresa', admin({ companyId: '' })],
  ])('R5: %s rechaza con unauthorized sin tocar ningun puerto', async (_caso, actor) => {
    const { deps, espias } = explodingTemplateDeps()

    await expect(createDeleteWhatsappTemplate(deps)('no-es-uuid', actor)).rejects.toBeInstanceOf(UnauthorizedError)
    for (const espia of espias) expect(espia).not.toHaveBeenCalled()
  })
})

describe('eliminar plantilla: exito', () => {
  it('R42: pide a Meta borrar por hsm_id y nombre y la marca eliminada; el mismo nombre en otro idioma no cambia', async () => {
    const otherLanguage = storedTemplate({ id: OTHER_LANGUAGE_ID, metaTemplateId: '9002', language: 'en_US' })
    const { graph, templates, remove } = setup({ templates: [storedTemplate(), otherLanguage] })

    const result = await remove(TEMPLATE_ID, admin())

    expect(result).toEqual({ id: TEMPLATE_ID })
    expect(graph.deleteTemplate).toHaveBeenCalledTimes(1)
    expect(graph.deleteTemplate).toHaveBeenCalledWith({
      wabaId: '2345678901',
      accessToken: ACCESS_TOKEN,
      hsmId: '9001',
      name: 'bienvenida',
    })
    expect(templates.row(TEMPLATE_ID)?.deletedAt).toEqual(NOW)
    expect(templates.row(OTHER_LANGUAGE_ID)).toEqual(otherLanguage)
  })
})

describe('eliminar plantilla: no encontrada', () => {
  it('R43: un id que no es UUID responde whatsapp_template_not_found sin tocar puertos', async () => {
    const { graph, repo, templates, remove } = setup()

    await expect(remove('9001', admin())).rejects.toBeInstanceOf(WhatsappTemplateNotFoundError)
    expect(repo.findLive).not.toHaveBeenCalled()
    expect(templates.findLiveById).not.toHaveBeenCalled()
    expect(graph.deleteTemplate).not.toHaveBeenCalled()
  })

  it.each([
    ['no existe', [] as ReturnType<typeof storedTemplate>[]],
    ['es de otra empresa', [storedTemplate({ companyId: OTHER_COMPANY_ID })]],
    ['es de otra conexion', [storedTemplate({ connectionId: NEW_CONNECTION_ID })]],
    ['ya esta eliminada', [storedTemplate({ deletedAt: new Date('2026-10-02T00:00:00.000Z') })]],
  ])('R43: si %s responde whatsapp_template_not_found sin llamar a Meta', async (_caso, rows) => {
    const { graph, templates, remove } = setup({ templates: rows })

    await expect(remove(TEMPLATE_ID, admin())).rejects.toBeInstanceOf(WhatsappTemplateNotFoundError)
    expect(graph.deleteTemplate).not.toHaveBeenCalled()
    expect(templates.markDeleted).not.toHaveBeenCalled()
  })
})

describe('eliminar plantilla: Meta falla', () => {
  it.each([
    ['rechaza', { kind: 'rejected', message: 'no se puede', code: 100, subcode: null }, WhatsappMetaRejectedError, 'whatsapp_meta_rejected'],
    ['no responde', { kind: 'unreachable', message: null, code: null, subcode: null }, WhatsappMetaUnreachableError, 'whatsapp_meta_unreachable'],
  ] as const)('R43: si Meta %s la plantilla no cambia y responde %s', async (_caso, failure, errorClass, code) => {
    const { graph, templates, remove } = setup()
    graph.deleteTemplate.mockImplementation(async () => ({ ok: false, ...failure }))

    const error = await remove(TEMPLATE_ID, admin()).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(errorClass)
    expect((error as IntegracionesError).code).toBe(code)
    expect(templates.markDeleted).not.toHaveBeenCalled()
    expect(templates.row(TEMPLATE_ID)?.deletedAt).toBeNull()
  })

  it('R21: el diagnostico del rechazo no lleva el Access Token ni el App Secret', async () => {
    const { graph, remove } = setup()
    graph.deleteTemplate.mockImplementation(async () => ({
      ok: false,
      kind: 'rejected',
      message: `${ACCESS_TOKEN} ${APP_SECRET}`,
      code: 100,
      subcode: null,
    }))

    const error = (await remove(TEMPLATE_ID, admin()).catch((e: unknown) => e)) as IntegracionesError

    expect(`${error.message} ${error.diagnostic ?? ''}`).not.toMatch(new RegExp(`${ACCESS_TOKEN}|${APP_SECRET}`))
  })
})

describe('eliminar plantilla: conexion', () => {
  it('R15: sin conexion viva responde whatsapp_connection_not_found sin llamar a Meta', async () => {
    const { graph, remove } = setup({ connection: null })

    await expect(remove(TEMPLATE_ID, admin())).rejects.toBeInstanceOf(WhatsappConnectionNotFoundError)
    expect(graph.deleteTemplate).not.toHaveBeenCalled()
  })

  it('R15: con la conexion deshabilitada responde action_not_allowed sin llamar a Meta', async () => {
    const { graph, remove } = setup({ connection: { status: 'DISABLED' } })

    await expect(remove(TEMPLATE_ID, admin())).rejects.toBeInstanceOf(ActionNotAllowedError)
    expect(graph.deleteTemplate).not.toHaveBeenCalled()
  })

  it('R20: un token ilegible responde integration_secret_unreadable sin Meta y deja la conexion en ERROR', async () => {
    const { graph, repo, templates, remove } = setup({ connection: { accessTokenEnc: 'v1:roto', status: 'ACTIVE' } })

    await expect(remove(TEMPLATE_ID, admin())).rejects.toBeInstanceOf(SecretUnreadableError)
    expect(graph.deleteTemplate).not.toHaveBeenCalled()
    expect(templates.row(TEMPLATE_ID)?.deletedAt).toBeNull()
    expect(repo.row(CONNECTION_ID)).toMatchObject({ status: 'ERROR', lastError: UNREADABLE_SECRET_MESSAGE })
  })
})
