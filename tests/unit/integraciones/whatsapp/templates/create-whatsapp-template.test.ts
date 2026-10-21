import { describe, expect, it } from 'vitest'

import { UNREADABLE_SECRET_MESSAGE } from '@/lib/modules/integraciones/domain/connection-secrets'
import { createCreateWhatsappTemplate } from '@/lib/modules/integraciones/domain/create-whatsapp-template'
import {
  ActionNotAllowedError,
  IntegracionesError,
  SecretUnreadableError,
  UnauthorizedError,
  ValidationError,
  WhatsappConnectionNotFoundError,
  WhatsappMetaUnreachableError,
  WhatsappTemplateNameTakenError,
  WhatsappTemplateRateLimitedError,
  WhatsappTemplateRejectedError,
} from '@/lib/modules/integraciones/domain/errors'
import { HIDDEN_SECRET_MARK } from '@/lib/modules/integraciones/domain/graph-failure'
import {
  META_RATE_LIMITED_CODE,
  TEMPLATE_NAME_TAKEN_SUBCODE,
} from '@/lib/modules/integraciones/domain/template-graph-failure'
import { toMetaComponents } from '@/lib/modules/integraciones/domain/whatsapp-template-components'
import type { GraphTemplateCreated } from '@/lib/modules/integraciones/ports/whatsapp-graph-client'

import {
  ACCESS_TOKEN,
  ACTOR_ID,
  APP_SECRET,
  CONNECTION_ID,
  CREATED_META_TEMPLATE_ID,
  NOW,
  OTHER_COMPANY_ID,
  admin,
  storedTemplate,
} from '../whatsapp-doubles'
import { explodingTemplateDeps, setupTemplates, validDraft, type TemplateSetupOptions } from './template-use-case-setup'

function setup(options: TemplateSetupOptions = {}) {
  const ctx = setupTemplates(options)
  return { ...ctx, create: createCreateWhatsappTemplate(ctx.deps) }
}

function answer(result: GraphTemplateCreated) {
  return async () => result
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('se esperaba un error')
}

describe('crear plantilla: permiso', () => {
  it.each([
    ['sin actor', null],
    ['sin el permiso', admin({ permissions: ['pedidos.ver'] })],
    ['sin empresa', admin({ companyId: '' })],
  ])('R5: %s rechaza con unauthorized antes de validar y sin tocar ningun puerto', async (_caso, actor) => {
    const { deps, espias } = explodingTemplateDeps()
    const create = createCreateWhatsappTemplate(deps)

    await expect(create({ basura: true }, actor)).rejects.toBeInstanceOf(UnauthorizedError)
    for (const espia of espias) expect(espia).not.toHaveBeenCalled()
  })
})

describe('crear plantilla: borrador invalido', () => {
  it('R14: un borrador invalido rechaza con invalid_input sin llamar a Graph ni escribir', async () => {
    const { graph, templates, repo, create } = setup()

    const error = await caught(create(validDraft({ name: 'Con Mayusculas' }), admin()))

    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).code).toBe('invalid_input')
    expect((error as ValidationError).diagnostic).toContain('name:invalid_chars')
    expect(repo.findLive).not.toHaveBeenCalled()
    expect(graph.createTemplate).not.toHaveBeenCalled()
    expect(templates.insertCreated).not.toHaveBeenCalled()
  })

  it('R14 R6: aplica el validador del dominio: AUTHENTICATION no se crea', async () => {
    const { graph, create } = setup()

    await expect(create(validDraft({ category: 'AUTHENTICATION' }), admin())).rejects.toBeInstanceOf(ValidationError)
    expect(graph.createTemplate).not.toHaveBeenCalled()
  })
})

describe('crear plantilla: conexion', () => {
  it('R15: sin conexion viva rechaza con whatsapp_connection_not_found sin llamar a Meta', async () => {
    const { graph, create } = setup({ connection: null })

    await expect(create(validDraft(), admin())).rejects.toBeInstanceOf(WhatsappConnectionNotFoundError)
    expect(graph.createTemplate).not.toHaveBeenCalled()
  })

  it('R15: con la conexion deshabilitada rechaza con action_not_allowed sin llamar a Meta', async () => {
    const { graph, cipher, create } = setup({ connection: { status: 'DISABLED' } })

    await expect(create(validDraft(), admin())).rejects.toBeInstanceOf(ActionNotAllowedError)
    expect(graph.createTemplate).not.toHaveBeenCalled()
    expect(cipher.decrypt).not.toHaveBeenCalled()
  })

  it('R15 R3: la conexion de otra empresa es como si no hubiera', async () => {
    const { graph, create } = setup({ connection: { companyId: OTHER_COMPANY_ID } })

    await expect(create(validDraft(), admin())).rejects.toBeInstanceOf(WhatsappConnectionNotFoundError)
    expect(graph.createTemplate).not.toHaveBeenCalled()
  })

  it('R20: un token ilegible rechaza con integration_secret_unreadable, sin Meta, y deja la conexion en ERROR', async () => {
    const { graph, repo, templates, create } = setup({ connection: { accessTokenEnc: 'v1:roto', status: 'ACTIVE' } })

    await expect(create(validDraft(), admin())).rejects.toBeInstanceOf(SecretUnreadableError)
    expect(graph.createTemplate).not.toHaveBeenCalled()
    expect(templates.insertCreated).not.toHaveBeenCalled()
    expect(repo.row(CONNECTION_ID)).toMatchObject({ status: 'ERROR', lastError: UNREADABLE_SECRET_MESSAGE })
  })

  it.each(['PENDING', 'ERROR'] as const)('R16: una conexion %s sirve para crear', async (status) => {
    const { graph, create } = setup({ connection: { status } })

    await create(validDraft(), admin())
    expect(graph.createTemplate).toHaveBeenCalledTimes(1)
  })
})

describe('crear plantilla: exito', () => {
  it('R16: manda a Meta el token descifrado y los componentes, y guarda PENDING con creador, componentes y hora', async () => {
    const { graph, templates, create } = setup()
    const draft = validDraft()

    const view = await create(draft, admin())

    const components = toMetaComponents({
      header: null,
      body: { text: 'Hola {{1}}, tu pedido esta listo.', examples: ['Ana'] },
      footer: null,
      buttons: [{ type: 'QUICK_REPLY', text: 'Gracias' }],
    })
    expect(graph.createTemplate).toHaveBeenCalledWith({
      wabaId: '2345678901',
      accessToken: ACCESS_TOKEN,
      name: 'pedido_listo',
      language: 'es',
      category: 'UTILITY',
      components,
    })
    expect(templates.insertCreated).toHaveBeenCalledWith(
      {
        metaTemplateId: CREATED_META_TEMPLATE_ID,
        name: 'pedido_listo',
        language: 'es',
        category: 'UTILITY',
        components,
        status: 'PENDING',
        createdById: ACTOR_ID,
        lastSyncedAt: NOW,
        variables: [],
        mappingStatus: 'UNMAPPED',
        enabled: false,
      },
      CONNECTION_ID,
      { companyId: admin().companyId },
    )
    expect(view).toMatchObject({
      name: 'pedido_listo',
      language: 'es',
      category: 'UTILITY',
      status: 'PENDING',
      statusRaw: null,
      rejectedReason: null,
      lastSyncedAt: NOW.toISOString(),
      content: {
        header: null,
        body: { text: 'Hola {{1}}, tu pedido esta listo.', examples: ['Ana'] },
        footer: null,
        buttons: [{ type: 'QUICK_REPLY', text: 'Gracias' }],
      },
    })
    expect(view).not.toHaveProperty('metaTemplateId')
  })

  it('R16: nace PENDING aunque Meta conteste otro estado', async () => {
    const { graph, templates, create } = setup()
    graph.createTemplate.mockImplementation(answer({ ok: true, id: '77', status: 'APPROVED', category: null }))

    const view = await create(validDraft(), admin())

    expect(templates.insertCreated.mock.calls[0]?.[0]).toMatchObject({ status: 'PENDING', metaTemplateId: '77' })
    expect(view.status).toBe('PENDING')
  })

  it('R17: si Meta asigna otra categoria se guarda la de Meta', async () => {
    const { graph, templates, create } = setup()
    graph.createTemplate.mockImplementation(answer({ ok: true, id: '77', status: 'PENDING', category: 'MARKETING' }))

    const view = await create(validDraft({ category: 'UTILITY' }), admin())

    expect(templates.insertCreated.mock.calls[0]?.[0]).toMatchObject({ category: 'MARKETING' })
    expect(view.category).toBe('MARKETING')
  })

  it('R17: una categoria de Meta desconocida o ausente deja la pedida', async () => {
    const { graph, templates, create } = setup()
    graph.createTemplate.mockImplementation(answer({ ok: true, id: '77', status: 'PENDING', category: 'NUEVA' }))

    await create(validDraft({ category: 'MARKETING' }), admin())

    expect(templates.insertCreated.mock.calls[0]?.[0]).toMatchObject({ category: 'MARKETING' })
  })
})

describe('crear plantilla: nombre repetido', () => {
  it('R18: una viva con el mismo nombre e idioma rechaza con whatsapp_template_name_taken sin llamar a Meta', async () => {
    const { graph, templates, create } = setup({ templates: [storedTemplate({ name: 'pedido_listo', language: 'es' })] })

    await expect(create(validDraft(), admin())).rejects.toBeInstanceOf(WhatsappTemplateNameTakenError)
    expect(graph.createTemplate).not.toHaveBeenCalled()
    expect(templates.insertCreated).not.toHaveBeenCalled()
  })

  it('R18: el mismo nombre en otro idioma o una eliminada no lo impiden', async () => {
    const { graph, create } = setup({
      templates: [
        storedTemplate({ name: 'pedido_listo', language: 'en_US' }),
        storedTemplate({ id: '00000000-0000-4000-8000-000000000102', metaTemplateId: '9002', name: 'pedido_listo', language: 'es', deletedAt: NOW }),
      ],
    })

    await create(validDraft(), admin())
    expect(graph.createTemplate).toHaveBeenCalledTimes(1)
  })
})

describe('crear plantilla: Meta rechaza', () => {
  it.each([
    ['nombre repetido', { kind: 'rejected', message: 'ya existe', code: 100, subcode: TEMPLATE_NAME_TAKEN_SUBCODE }, WhatsappTemplateNameTakenError, 'whatsapp_template_name_taken'],
    ['limite de creaciones', { kind: 'rejected', message: 'limite', code: META_RATE_LIMITED_CODE, subcode: null }, WhatsappTemplateRateLimitedError, 'whatsapp_template_rate_limited'],
    ['cualquier otro rechazo', { kind: 'rejected', message: 'contenido', code: 100, subcode: 2388299 }, WhatsappTemplateRejectedError, 'whatsapp_template_rejected'],
    ['sin respuesta', { kind: 'unreachable', message: null, code: null, subcode: null }, WhatsappMetaUnreachableError, 'whatsapp_meta_unreachable'],
  ] as const)('R19: %s responde su codigo en espanol y no guarda nada', async (_caso, failure, errorClass, code) => {
    const { graph, templates, create } = setup()
    graph.createTemplate.mockImplementation(answer({ ok: false, ...failure }))

    const error = await caught(create(validDraft(), admin()))

    expect(error).toBeInstanceOf(errorClass)
    expect((error as IntegracionesError).code).toBe(code)
    expect(templates.insertCreated).not.toHaveBeenCalled()
    expect(templates.all()).toEqual([])
  })

  it('R21: ni el mensaje ni el diagnostico llevan el Access Token ni el App Secret', async () => {
    const { graph, create } = setup()
    graph.createTemplate.mockImplementation(
      answer({ ok: false, kind: 'rejected', message: `token ${ACCESS_TOKEN} y secreto ${APP_SECRET}`, code: 100, subcode: null }),
    )

    const error = (await caught(create(validDraft(), admin()))) as IntegracionesError

    const visible = `${error.message} ${error.diagnostic ?? ''}`
    expect(visible).not.toContain(ACCESS_TOKEN)
    expect(visible).not.toContain(APP_SECRET)
    expect(error.diagnostic).toContain(HIDDEN_SECRET_MARK)
  })

  it('R21: si el App Secret no se puede leer igual se tacha el token', async () => {
    const { graph, create } = setup({ connection: { appSecretEnc: 'v1:roto' } })
    graph.createTemplate.mockImplementation(
      answer({ ok: false, kind: 'rejected', message: `token ${ACCESS_TOKEN}`, code: 100, subcode: null }),
    )

    const error = (await caught(create(validDraft(), admin()))) as IntegracionesError

    expect(error).toBeInstanceOf(WhatsappTemplateRejectedError)
    expect(error.diagnostic).not.toContain(ACCESS_TOKEN)
  })
})
