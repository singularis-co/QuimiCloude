import { describe, expect, it } from 'vitest'

import {
  ActionNotAllowedError,
  UnauthorizedError,
  ValidationError,
  WhatsappTemplateNotFoundError,
  WhatsappTemplateNotMappableError,
  WhatsappTemplateNotMappedError,
  WhatsappVariableKeyNotFoundError,
} from '@/lib/modules/integraciones/domain/errors'
import {
  createRelateWhatsappTemplateVariables,
  createSetWhatsappTemplateEnabled,
} from '@/lib/modules/integraciones/domain/relate-whatsapp-template-variables'
import { toMetaComponents } from '@/lib/modules/integraciones/domain/whatsapp-template-components'
import type { WhatsappTemplateRecord } from '@/lib/modules/integraciones/domain/whatsapp-template'

import {
  NEW_CONNECTION_ID,
  OTHER_COMPANY_ID,
  TEMPLATE_ID,
  admin,
  storedTemplate,
  storedVariableKey,
} from '../whatsapp-doubles'
import { explodingTemplateDeps, setupTemplates, type TemplateSetupOptions } from './template-use-case-setup'

const CUENTA = storedVariableKey()
const AJENA = storedVariableKey({ id: '00000000-0000-4000-8000-000000000203', key: 'ajena', companyId: OTHER_COMPANY_ID })

const TWO_SLOTS = toMetaComponents({
  header: null,
  body: { text: 'Hola {{1}}, tu cuenta {{2}}', examples: ['Ana', '123'] },
  footer: null,
  buttons: [],
})

const CONSTANT_BODY_1 = { slot: 'body.1', kind: 'system', systemKey: 'cliente.nombre' } as const
const OWN_BODY_2 = { slot: 'body.2', kind: 'company', variableKeyId: CUENTA.id } as const

function unmapped(overrides: Partial<WhatsappTemplateRecord> = {}): WhatsappTemplateRecord {
  return storedTemplate({ components: TWO_SLOTS, mappingStatus: 'UNMAPPED', enabled: false, variables: [], ...overrides })
}

function mapped(overrides: Partial<WhatsappTemplateRecord> = {}): WhatsappTemplateRecord {
  return storedTemplate({
    components: TWO_SLOTS,
    mappingStatus: 'MAPPED',
    enabled: true,
    variables: [CONSTANT_BODY_1, OWN_BODY_2],
    ...overrides,
  })
}

function setup(options: TemplateSetupOptions = {}) {
  const ctx = setupTemplates({ variableKeys: [CUENTA, AJENA], ...options })
  return {
    ...ctx,
    relate: createRelateWhatsappTemplateVariables(ctx.deps),
    setEnabled: createSetWhatsappTemplateEnabled(ctx.deps),
  }
}

function graphUntouched(graph: ReturnType<typeof setup>['graph']): void {
  expect(graph.createTemplate).not.toHaveBeenCalled()
  expect(graph.listTemplatesPage).not.toHaveBeenCalled()
  expect(graph.deleteTemplate).not.toHaveBeenCalled()
  expect(graph.fetchPhoneNumber).not.toHaveBeenCalled()
}

const BOTH = [
  { slot: 'body.1', key: 'cliente.nombre' },
  { slot: 'body.2', key: 'cuenta_numero' },
]

describe('relacionar y habilitar: permiso', () => {
  const actors = [
    ['sin actor', null],
    ['sin el permiso', admin({ permissions: ['integraciones.ver'] })],
    ['sin empresa', admin({ companyId: '' })],
  ] as const

  it.each(actors)('R62: relacionar %s rechaza con unauthorized antes de validar y sin tocar ningun puerto', async (_caso, actor) => {
    const { deps, espias } = explodingTemplateDeps()

    await expect(createRelateWhatsappTemplateVariables(deps)({ basura: true }, actor)).rejects.toBeInstanceOf(
      UnauthorizedError,
    )
    for (const espia of espias) expect(espia).not.toHaveBeenCalled()
  })

  it.each(actors)('R62: habilitar o deshabilitar %s rechaza con unauthorized sin tocar ningun puerto', async (_caso, actor) => {
    const { deps, espias } = explodingTemplateDeps()

    await expect(createSetWhatsappTemplateEnabled(deps)({ basura: true }, actor)).rejects.toBeInstanceOf(UnauthorizedError)
    for (const espia of espias) expect(espia).not.toHaveBeenCalled()
  })
})

describe('relacionar variables', () => {
  it('R74 R93: sustituye las relaciones por la lista, constante por su forma y propia por su clave, y recalcula a MAPPED', async () => {
    const { relate, templates, variableKeys, graph } = setup({ templates: [unmapped()] })

    const view = await relate({ templateId: TEMPLATE_ID, bindings: BOTH }, admin())

    expect(variableKeys.findByKeys).toHaveBeenCalledWith(['cuenta_numero'], { companyId: admin().companyId })
    expect(templates.replaceVariables).toHaveBeenCalledWith(
      TEMPLATE_ID,
      [CONSTANT_BODY_1, OWN_BODY_2],
      { mappingStatus: 'MAPPED', enabled: false },
      TWO_SLOTS,
      { companyId: admin().companyId },
    )
    expect(templates.row(TEMPLATE_ID)).toMatchObject({ variables: [CONSTANT_BODY_1, OWN_BODY_2], mappingStatus: 'MAPPED' })
    expect(view.variables).toEqual([
      { slot: 'body.1', position: 1, kind: 'system', key: 'cliente.nombre', label: null },
      { slot: 'body.2', position: 2, kind: 'company', key: 'cuenta_numero', label: CUENTA.label },
    ])
    expect(view.content?.body.text).toBe('Hola {{cliente.nombre}}, tu cuenta {{cuenta_numero}}')
    graphUntouched(graph)
  })

  it('R74: solo constantes no consulta las variables propias', async () => {
    const { relate, variableKeys } = setup({ templates: [unmapped()] })

    await relate(
      { templateId: TEMPLATE_ID, bindings: [{ slot: 'body.1', key: 'cliente.nombre' }, { slot: 'body.2', key: 'cuenta.numero' }] },
      admin(),
    )

    expect(variableKeys.findByKeys).not.toHaveBeenCalled()
  })

  it('R74: un hueco que no viene queda sin relacion y la plantilla sin relacionar', async () => {
    const { relate, templates } = setup({ templates: [unmapped({ variables: [OWN_BODY_2] })] })

    const view = await relate({ templateId: TEMPLATE_ID, bindings: [{ slot: 'body.1', key: 'cliente.nombre' }] }, admin())

    expect(templates.row(TEMPLATE_ID)).toMatchObject({ variables: [CONSTANT_BODY_1], mappingStatus: 'UNMAPPED', enabled: false })
    expect(view.variables[1]).toEqual({ slot: 'body.2', position: 2, kind: null, key: null, label: null })
  })

  it('R74: con la conexion deshabilitada se relaciona igual, sin Meta', async () => {
    const { relate, templates, graph, cipher } = setup({ connection: { status: 'DISABLED' }, templates: [unmapped()] })

    await relate({ templateId: TEMPLATE_ID, bindings: BOTH }, admin())

    expect(templates.row(TEMPLATE_ID)?.mappingStatus).toBe('MAPPED')
    expect(cipher.decrypt).not.toHaveBeenCalled()
    graphUntouched(graph)
  })

  it('R72: quitar una relacion a una habilitada la deja sin relacionar y deshabilitada en la misma escritura', async () => {
    const { relate, templates } = setup({ templates: [mapped()] })

    const view = await relate({ templateId: TEMPLATE_ID, bindings: [{ slot: 'body.1', key: 'cliente.nombre' }] }, admin())

    expect(templates.replaceVariables).toHaveBeenCalledTimes(1)
    expect(templates.replaceVariables.mock.calls[0]?.[2]).toEqual({ mappingStatus: 'UNMAPPED', enabled: false })
    expect(view).toMatchObject({ mappingStatus: 'UNMAPPED', enabled: false })
    expect(templates.setEnabled).not.toHaveBeenCalled()
  })

  it('R79: quedar relacionada no la habilita; si ya estaba habilitada sigue habilitada', async () => {
    const off = setup({ templates: [unmapped()] })
    await expect(off.relate({ templateId: TEMPLATE_ID, bindings: BOTH }, admin())).resolves.toMatchObject({
      mappingStatus: 'MAPPED',
      enabled: false,
    })

    const on = setup({ templates: [mapped()] })
    await expect(on.relate({ templateId: TEMPLATE_ID, bindings: BOTH }, admin())).resolves.toMatchObject({
      mappingStatus: 'MAPPED',
      enabled: true,
    })
  })

  it('R75: una plantilla no relacionable rechaza con whatsapp_template_not_mappable sin escribir', async () => {
    const { relate, templates } = setup({
      templates: [unmapped({ components: [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'Hola {{1}}' }] })],
    })

    await expect(relate({ templateId: TEMPLATE_ID, bindings: [] }, admin())).rejects.toBeInstanceOf(
      WhatsappTemplateNotMappableError,
    )
    expect(templates.replaceVariables).not.toHaveBeenCalled()
  })

  it.each([
    ['un hueco que la plantilla no tiene', [{ slot: 'body.3', key: 'cliente.nombre' }]],
    ['un hueco repetido', [{ slot: 'body.1', key: 'cliente.nombre' }, { slot: 'body.1', key: 'cuenta_numero' }]],
    ['una clave sin forma de clave', [{ slot: 'body.1', key: 'Cliente' }]],
    ['una clave con tres segmentos', [{ slot: 'body.1', key: 'a.b.c' }]],
  ])('R75 R93: %s rechaza con invalid_input sin escribir', async (_caso, bindings) => {
    const { relate, templates } = setup({ templates: [unmapped()] })

    await expect(relate({ templateId: TEMPLATE_ID, bindings }, admin())).rejects.toBeInstanceOf(ValidationError)
    expect(templates.replaceVariables).not.toHaveBeenCalled()
  })

  it.each([
    ['sin lista', { templateId: TEMPLATE_ID }],
    ['con un par sin clave', { templateId: TEMPLATE_ID, bindings: [{ slot: 'body.1' }] }],
    ['sin entrada', undefined],
  ])('R75: una entrada %s rechaza con invalid_input', async (_caso, input) => {
    const { relate, templates } = setup({ templates: [unmapped()] })

    await expect(relate(input, admin())).rejects.toBeInstanceOf(ValidationError)
    expect(templates.findLiveById).not.toHaveBeenCalled()
  })

  it.each([
    ['que la empresa no tiene', 'desconocida'],
    ['de otra empresa', 'ajena'],
  ])('R75 R93: una propia %s rechaza con whatsapp_variable_key_not_found sin escribir', async (_caso, key) => {
    const { relate, templates } = setup({ templates: [unmapped()] })

    await expect(relate({ templateId: TEMPLATE_ID, bindings: [{ slot: 'body.1', key }] }, admin())).rejects.toBeInstanceOf(
      WhatsappVariableKeyNotFoundError,
    )
    expect(templates.replaceVariables).not.toHaveBeenCalled()
  })

  it.each([
    ['no es UUID', 'abc', [unmapped()], {}],
    ['no existe', TEMPLATE_ID, [], {}],
    ['es de otra empresa', TEMPLATE_ID, [unmapped({ companyId: OTHER_COMPANY_ID })], {}],
    ['es de otra conexion', TEMPLATE_ID, [unmapped({ connectionId: NEW_CONNECTION_ID })], {}],
    ['esta eliminada', TEMPLATE_ID, [unmapped({ deletedAt: new Date('2026-10-02T00:00:00.000Z') })], {}],
    ['no hay conexion viva', TEMPLATE_ID, [unmapped()], { connection: null }],
  ] as const)('R75: si la plantilla %s rechaza con whatsapp_template_not_found', async (_caso, templateId, rows, options) => {
    const { relate, setEnabled, templates } = setup({ templates: [...rows], ...options })

    await expect(relate({ templateId, bindings: BOTH }, admin())).rejects.toBeInstanceOf(WhatsappTemplateNotFoundError)
    await expect(setEnabled({ templateId, enabled: false }, admin())).rejects.toBeInstanceOf(WhatsappTemplateNotFoundError)
    expect(templates.replaceVariables).not.toHaveBeenCalled()
    expect(templates.setEnabled).not.toHaveBeenCalled()
  })

  it('R76: si los componentes cambiaron entre la lectura y la escritura rechaza con action_not_allowed', async () => {
    const { relate, templates } = setup({ templates: [unmapped()] })
    templates.replaceVariables.mockResolvedValueOnce(false)

    const error = await relate({ templateId: TEMPLATE_ID, bindings: BOTH }, admin()).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ActionNotAllowedError)
    expect((error as ActionNotAllowedError).code).toBe('action_not_allowed')
  })
})

describe('habilitar y deshabilitar', () => {
  it.each(['APPROVED', 'PENDING', 'REJECTED'] as const)(
    'R77: una relacionada %s se habilita, cualquiera que sea su estado en Meta, sin Meta',
    async (status) => {
      const { setEnabled, templates, graph } = setup({ templates: [mapped({ status, enabled: false })] })

      const view = await setEnabled({ templateId: TEMPLATE_ID, enabled: true }, admin())

      expect(templates.setEnabled).toHaveBeenCalledWith(TEMPLATE_ID, true, TWO_SLOTS, { companyId: admin().companyId })
      expect(templates.row(TEMPLATE_ID)?.enabled).toBe(true)
      expect(view).toMatchObject({ enabled: true, mappingStatus: 'MAPPED', status })
      expect(view.variables.map((variable) => variable.key)).toEqual(['cliente.nombre', 'cuenta_numero'])
      graphUntouched(graph)
    },
  )

  it('R77 R80: una sin relacionar rechaza con whatsapp_template_not_mapped sin escribir', async () => {
    const { setEnabled, templates } = setup({ templates: [unmapped()] })

    await expect(setEnabled({ templateId: TEMPLATE_ID, enabled: true }, admin())).rejects.toBeInstanceOf(
      WhatsappTemplateNotMappedError,
    )
    expect(templates.setEnabled).not.toHaveBeenCalled()
    expect(templates.row(TEMPLATE_ID)?.enabled).toBe(false)
  })

  it('R78: deshabilitar no tiene condicion y no cambia las relaciones ni el estado del mapeo', async () => {
    const { setEnabled, templates } = setup({ templates: [mapped()] })

    const view = await setEnabled({ templateId: TEMPLATE_ID, enabled: false }, admin())

    expect(templates.row(TEMPLATE_ID)).toMatchObject({
      enabled: false,
      mappingStatus: 'MAPPED',
      variables: [CONSTANT_BODY_1, OWN_BODY_2],
    })
    expect(view.enabled).toBe(false)
    expect(templates.replaceVariables).not.toHaveBeenCalled()
  })

  it('R78: deshabilitar una sin relacionar tambien vale', async () => {
    const { setEnabled } = setup({ templates: [unmapped()] })

    await expect(setEnabled({ templateId: TEMPLATE_ID, enabled: false }, admin())).resolves.toMatchObject({ enabled: false })
  })

  it('R74: con la conexion deshabilitada se habilita igual', async () => {
    const { setEnabled } = setup({ connection: { status: 'DISABLED' }, templates: [mapped({ enabled: false })] })

    await expect(setEnabled({ templateId: TEMPLATE_ID, enabled: true }, admin())).resolves.toMatchObject({ enabled: true })
  })

  it.each([
    ['sin enabled', { templateId: TEMPLATE_ID }],
    ['con enabled de texto', { templateId: TEMPLATE_ID, enabled: 'si' }],
  ])('R75: una entrada %s rechaza con invalid_input', async (_caso, input) => {
    const { setEnabled, templates } = setup({ templates: [mapped()] })

    await expect(setEnabled(input, admin())).rejects.toBeInstanceOf(ValidationError)
    expect(templates.findLiveById).not.toHaveBeenCalled()
  })

  it('R76: si la plantilla cambio entre la lectura y la escritura rechaza con action_not_allowed', async () => {
    const { setEnabled, templates } = setup({ templates: [mapped({ enabled: false })] })
    templates.setEnabled.mockResolvedValueOnce(false)

    await expect(setEnabled({ templateId: TEMPLATE_ID, enabled: true }, admin())).rejects.toBeInstanceOf(
      ActionNotAllowedError,
    )
  })
})
