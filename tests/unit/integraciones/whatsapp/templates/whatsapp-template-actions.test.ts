// Las Server Actions de plantillas contra dobles de `@/lib/composition`: se prueba el borde (actor,
// argumentos, forma exacta de cada `data`, traduccion de errores y revalidacion), nunca el dominio
// ni la sesion reales.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createWhatsappTemplateAction,
  deleteWhatsappTemplateAction,
  listWhatsappTemplatesAction,
  relateWhatsappTemplateVariablesAction,
  setWhatsappTemplateEnabledAction,
  syncWhatsappTemplatesAction,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-template-actions'
import { errorMessage } from '@/lib/modules/errores'
import {
  ActionNotAllowedError,
  SecretUnreadableError,
  UnauthorizedError,
  ValidationError,
  WhatsappConnectionNotFoundError,
  WhatsappMetaRejectedError,
  WhatsappMetaUnreachableError,
  WhatsappTemplateNameTakenError,
  WhatsappTemplateNotFoundError,
  WhatsappTemplateNotMappableError,
  WhatsappTemplateNotMappedError,
  WhatsappTemplateRateLimitedError,
  WhatsappTemplateRejectedError,
  WhatsappVariableKeyNotFoundError,
  type TemplateSyncSummary,
  type WhatsappTemplateList,
  type WhatsappTemplateView,
} from '@/lib/modules/integraciones'

const {
  listMock,
  createMock,
  syncMock,
  deleteMock,
  relateMock,
  setEnabledMock,
  getSessionUserMock,
  getSessionContextMock,
  revalidatePathMock,
  readRequestIdHeaderMock,
} = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
  syncMock: vi.fn(),
  deleteMock: vi.fn(),
  relateMock: vi.fn(),
  setEnabledMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  getSessionContextMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  readRequestIdHeaderMock: vi.fn(async () => '7c9e6679-7425-40de-944b-e07fc1f90ae7'),
}))

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

vi.mock('@/lib/composition', () => ({
  observabilidad: { readRequestIdHeader: readRequestIdHeaderMock },
  identity: { getSessionUser: getSessionUserMock, getSessionContext: getSessionContextMock },
  integraciones: {
    listWhatsappTemplates: listMock,
    createWhatsappTemplate: createMock,
    syncWhatsappTemplates: syncMock,
    deleteWhatsappTemplate: deleteMock,
    relateWhatsappTemplateVariables: relateMock,
    setWhatsappTemplateEnabled: setEnabledMock,
  },
}))

const REQUEST_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const COMPANY_ID = '22222222-2222-4222-8222-222222222222'
const CONNECTION_ID = '33333333-3333-4333-8333-333333333333'
const TEMPLATE_ID = '44444444-4444-4444-8444-444444444444'
const WHATSAPP_ROUTE = '/integraciones/whatsapp'
const ACCESS_TOKEN = 'EAAG-token-de-prueba-que-no-debe-salir'

const SESSION_USER = {
  id: 'user-admin-1',
  username: 'ana.perez',
  displayName: 'Ana Perez',
  roleName: 'Administrador',
  permissions: ['integraciones.modificar'],
}

const ACTOR = { id: SESSION_USER.id, companyId: COMPANY_ID, permissions: SESSION_USER.permissions }

const VIEW: WhatsappTemplateView = {
  id: TEMPLATE_ID,
  name: 'pedido_listo',
  language: 'es',
  category: 'UTILITY',
  status: 'PENDING',
  statusRaw: null,
  rejectedReason: null,
  content: { header: null, body: { text: 'Hola {{1}}', examples: ['Ana'] }, footer: null, buttons: [] },
  lastSyncedAt: null,
  createdAt: '2026-10-20T12:00:00.000Z',
  mappingStatus: 'MAPPED',
  enabled: true,
  variables: [],
}

const VIEW_KEYS = [
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
]

const LIST: WhatsappTemplateList = { templates: [VIEW], templatesSyncedAt: '2026-10-20T08:00:00.000Z' }

const SUMMARY: TemplateSyncSummary = {
  imported: 2,
  updated: 1,
  deleted: 1,
  skipped: 0,
  syncedAt: '2026-10-20T12:30:00.000Z',
}

const DRAFT = {
  name: 'pedido_listo',
  language: 'es',
  category: 'UTILITY',
  header: null,
  body: { text: 'Hola {{1}}', examples: ['Ana'] },
  footer: null,
  buttons: [],
}

const RELATE_INPUT = {
  templateId: TEMPLATE_ID,
  bindings: [{ slot: 'body.1', key: 'cliente.nombre' }],
}

const ENABLE_INPUT = { templateId: TEMPLATE_ID, enabled: true }

/** Datos de la conexion que nunca pueden salir de una accion de plantillas. */
const CONNECTION_LEAK = {
  connection: { id: CONNECTION_ID, wabaId: '222', phoneNumberId: '333', accessTokenEnc: 'v1:enc' },
  connectionId: CONNECTION_ID,
  wabaId: '222',
  accessToken: ACCESS_TOKEN,
}

const ACTIONS = {
  list: () => listWhatsappTemplatesAction(),
  create: () => createWhatsappTemplateAction(DRAFT),
  sync: () => syncWhatsappTemplatesAction(),
  delete: () => deleteWhatsappTemplateAction(TEMPLATE_ID),
  relate: () => relateWhatsappTemplateVariablesAction(RELATE_INPUT),
  setEnabled: () => setWhatsappTemplateEnabledAction(ENABLE_INPUT),
} as const

const USE_CASE_OF = {
  list: listMock,
  create: createMock,
  sync: syncMock,
  delete: deleteMock,
  relate: relateMock,
  setEnabled: setEnabledMock,
} as const

const WRITES = ['create', 'sync', 'delete'] as const

beforeEach(() => {
  vi.clearAllMocks()
  getSessionUserMock.mockResolvedValue(SESSION_USER)
  getSessionContextMock.mockResolvedValue({ companyId: COMPANY_ID })
  listMock.mockResolvedValue(LIST)
  createMock.mockResolvedValue(VIEW)
  syncMock.mockResolvedValue(SUMMARY)
  deleteMock.mockResolvedValue({ id: TEMPLATE_ID })
  relateMock.mockResolvedValue(VIEW)
  setEnabledMock.mockResolvedValue(VIEW)
})

describe('R47: el contrato de cada accion de plantillas', () => {
  it('R47: listar pasa la entrada y el actor, y devuelve success con la lista', async () => {
    const result = await listWhatsappTemplatesAction({ onlyApproved: true })
    expect(result).toEqual({ status: 'success', data: LIST })
    expect(listMock).toHaveBeenCalledWith({ onlyApproved: true }, ACTOR)

    await listWhatsappTemplatesAction()
    expect(listMock).toHaveBeenLastCalledWith(undefined, ACTOR)
  })

  it('R47: crear pasa el borrador tal cual (anidado, sin FormData) y devuelve success con la vista', async () => {
    const result = await ACTIONS.create()
    expect(result).toEqual({ status: 'success', data: VIEW })
    expect(createMock).toHaveBeenCalledWith(DRAFT, ACTOR)
  })

  it('R47: sincronizar pasa solo el actor y devuelve success con el resumen', async () => {
    const result = await ACTIONS.sync()
    expect(result).toEqual({ status: 'success', data: SUMMARY })
    expect(syncMock).toHaveBeenCalledWith(ACTOR)
  })

  it('R47: eliminar pasa el id y devuelve success con el id', async () => {
    const result = await ACTIONS.delete()
    expect(result).toEqual({ status: 'success', data: { id: TEMPLATE_ID } })
    expect(deleteMock).toHaveBeenCalledWith(TEMPLATE_ID, ACTOR)
  })

  it('R47: las tres de escritura revalidan la pantalla de WhatsApp en exito; listar no', async () => {
    await ACTIONS.list()
    expect(revalidatePathMock).not.toHaveBeenCalled()

    for (const name of WRITES) {
      revalidatePathMock.mockClear()
      await ACTIONS[name]()
      expect(revalidatePathMock, name).toHaveBeenCalledTimes(1)
      expect(revalidatePathMock, name).toHaveBeenCalledWith(WHATSAPP_ROUTE)
    }
  })

  it('R47: cada error de dominio sale como ErrorState con el texto del catalogo, sin diagnostico y sin revalidar', async () => {
    const CASES = [
      { error: new ValidationError('diagnostico interno'), code: 'invalid_input' },
      { error: new WhatsappConnectionNotFoundError('diagnostico interno'), code: 'whatsapp_connection_not_found' },
      { error: new SecretUnreadableError('diagnostico interno'), code: 'integration_secret_unreadable' },
      { error: new WhatsappTemplateNotFoundError('diagnostico interno'), code: 'whatsapp_template_not_found' },
      { error: new WhatsappTemplateNameTakenError('diagnostico interno'), code: 'whatsapp_template_name_taken' },
      { error: new WhatsappTemplateRateLimitedError('diagnostico interno'), code: 'whatsapp_template_rate_limited' },
      { error: new WhatsappTemplateRejectedError('diagnostico interno'), code: 'whatsapp_template_rejected' },
      { error: new WhatsappMetaRejectedError('diagnostico interno'), code: 'whatsapp_meta_rejected' },
      { error: new WhatsappMetaUnreachableError('diagnostico interno'), code: 'whatsapp_meta_unreachable' },
    ] as const

    for (const [name, action] of Object.entries(ACTIONS)) {
      for (const { error, code } of CASES) {
        USE_CASE_OF[name as keyof typeof ACTIONS].mockRejectedValueOnce(error)
        revalidatePathMock.mockClear()
        const result = await action()
        expect(result, `${name} / ${code}`).toEqual({ status: 'error', code, message: errorMessage(code) })
        expect(JSON.stringify(result)).not.toContain('diagnostico interno')
        expect(revalidatePathMock).not.toHaveBeenCalled()
      }
    }
  })

  it('R47: un error ajeno al dominio sale como `unexpected` con referencia y sin su texto', async () => {
    const foreign = new Error(`fallo con ${ACCESS_TOKEN} dentro`)
    for (const [name, action] of Object.entries(ACTIONS)) {
      USE_CASE_OF[name as keyof typeof ACTIONS].mockRejectedValueOnce(foreign)
      const result = await action()
      expect(result, name).toEqual({
        status: 'error',
        code: 'unexpected',
        message: errorMessage('unexpected'),
        reference: REQUEST_ID,
      })
      expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN)
    }
  })

  it('R47: el borde no decide: use server, sin permiso, esquema, ORM ni adaptadores driven', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..', '..', '..', '..', '..',
        'lib', 'modules', 'integraciones', 'adapters', 'driving', 'whatsapp-template-actions.ts',
      ),
      'utf8',
    )
    expect(source.startsWith("'use server';")).toBe(true)
    expect(source).not.toMatch(/requirePermission|integraciones\.modificar|Administrador/)
    expect(source).not.toMatch(/Schema\b|from 'zod'/)
    expect(source).not.toMatch(/@prisma\/client|prisma\./)
    expect(source).not.toMatch(/adapters\/driven|\.\.\/driven/)
  })
})

describe('R48: las claves exactas de cada data', () => {
  it('R48: listar devuelve exactamente templates y templatesSyncedAt, y cada plantilla las claves de la vista', async () => {
    const result = await ACTIONS.list()
    if (result.status !== 'success') throw new Error('se esperaba success')
    expect(Object.keys(result.data).sort()).toEqual(['templates', 'templatesSyncedAt'])
    expect(Object.keys(result.data.templates[0] ?? {}).sort()).toEqual(VIEW_KEYS)
  })

  it('R48: crear devuelve exactamente las claves de la vista', async () => {
    const result = await ACTIONS.create()
    if (result.status !== 'success') throw new Error('se esperaba success')
    expect(Object.keys(result.data).sort()).toEqual(VIEW_KEYS)
  })

  it('R48: sincronizar devuelve exactamente el resumen', async () => {
    const result = await ACTIONS.sync()
    if (result.status !== 'success') throw new Error('se esperaba success')
    expect(Object.keys(result.data).sort()).toEqual(['deleted', 'imported', 'skipped', 'syncedAt', 'updated'])
  })

  it('R48: eliminar devuelve exactamente el id', async () => {
    const result = await ACTIONS.delete()
    if (result.status !== 'success') throw new Error('se esperaba success')
    expect(Object.keys(result.data)).toEqual(['id'])
  })

  it('R48: si el caso de uso devolviera datos de la conexion, listar, sincronizar y eliminar no los dejan salir', async () => {
    listMock.mockResolvedValueOnce({ ...LIST, ...CONNECTION_LEAK })
    syncMock.mockResolvedValueOnce({ ...SUMMARY, ...CONNECTION_LEAK })
    deleteMock.mockResolvedValueOnce({ id: TEMPLATE_ID, ...CONNECTION_LEAK })

    for (const name of ['list', 'sync', 'delete'] as const) {
      const serialized = JSON.stringify(await ACTIONS[name]())
      for (const forbidden of [CONNECTION_ID, ACCESS_TOKEN, 'wabaId', 'connection', 'accessToken']) {
        expect(serialized, `${name} lleva ${forbidden}`).not.toContain(forbidden)
      }
    }
  })

  it('R48: lo unico de la conexion que sale es templatesSyncedAt', async () => {
    const result = await ACTIONS.list()
    if (result.status !== 'success') throw new Error('se esperaba success')
    expect(result.data.templatesSyncedAt).toBe(LIST.templatesSyncedAt)
  })
})

describe('R5: el actor llega al caso de uso, que rechaza sin permiso', () => {
  it('R5: cada accion construye el actor con usuario y empresa de la sesion', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      await action()
      const calls = USE_CASE_OF[name as keyof typeof ACTIONS].mock.calls
      const lastCall = calls[calls.length - 1] ?? []
      expect(lastCall[lastCall.length - 1], name).toEqual(ACTOR)
    }
  })

  it('R5: sin sesion o sin empresa pasan actor null, y el unauthorized sale con su codigo y sin revalidar', async () => {
    for (const sinSesion of ['usuario', 'empresa'] as const) {
      if (sinSesion === 'usuario') getSessionUserMock.mockResolvedValue(null)
      else getSessionContextMock.mockResolvedValue(null)

      for (const [name, action] of Object.entries(ACTIONS)) {
        const useCase = USE_CASE_OF[name as keyof typeof ACTIONS]
        useCase.mockRejectedValueOnce(new UnauthorizedError())
        revalidatePathMock.mockClear()
        const result = await action()
        const lastCall = useCase.mock.calls[useCase.mock.calls.length - 1] ?? []
        expect(lastCall[lastCall.length - 1], `${sinSesion} / ${name}`).toBeNull()
        expect(result, `${sinSesion} / ${name}`).toEqual({
          status: 'error',
          code: 'unauthorized',
          message: errorMessage('unauthorized'),
        })
        expect(revalidatePathMock).not.toHaveBeenCalled()
      }
      getSessionUserMock.mockResolvedValue(SESSION_USER)
      getSessionContextMock.mockResolvedValue({ companyId: COMPANY_ID })
    }
  })

  it('R5: un actor sin el permiso tambien sale como unauthorized', async () => {
    getSessionUserMock.mockResolvedValue({ ...SESSION_USER, permissions: [] })
    for (const [name, action] of Object.entries(ACTIONS)) {
      const useCase = USE_CASE_OF[name as keyof typeof ACTIONS]
      useCase.mockRejectedValueOnce(new UnauthorizedError())
      const result = await action()
      const lastCall = useCase.mock.calls[useCase.mock.calls.length - 1] ?? []
      expect(lastCall[lastCall.length - 1], name).toEqual({ ...ACTOR, permissions: [] })
      expect(result, name).toEqual({ status: 'error', code: 'unauthorized', message: errorMessage('unauthorized') })
    }
  })
})

describe('R83: relacionar y habilitar por el mismo contrato', () => {
  it('R83: crear pasa constantLabels dentro del borrador, tal cual', async () => {
    const draft = {
      ...DRAFT,
      body: { text: 'Hola {{cliente.nombre}}' },
      constantLabels: { 'cliente.nombre': 'Nombre del cliente' },
    }
    await createWhatsappTemplateAction(draft)
    expect(createMock).toHaveBeenCalledWith(draft, ACTOR)
  })

  it('R83: relacionar pasa la entrada tal cual y devuelve success con la vista', async () => {
    const result = await ACTIONS.relate()
    expect(result).toEqual({ status: 'success', data: VIEW })
    expect(relateMock).toHaveBeenCalledWith(RELATE_INPUT, ACTOR)
  })

  it('R83: habilitar y deshabilitar pasan { templateId, enabled } y devuelven success con la vista', async () => {
    expect(await ACTIONS.setEnabled()).toEqual({ status: 'success', data: VIEW })
    expect(setEnabledMock).toHaveBeenCalledWith(ENABLE_INPUT, ACTOR)

    await setWhatsappTemplateEnabledAction({ templateId: TEMPLATE_ID, enabled: false })
    expect(setEnabledMock).toHaveBeenLastCalledWith({ templateId: TEMPLATE_ID, enabled: false }, ACTOR)
  })

  it('R83: las dos revalidan la pantalla de WhatsApp en exito', async () => {
    for (const name of ['relate', 'setEnabled'] as const) {
      revalidatePathMock.mockClear()
      await ACTIONS[name]()
      expect(revalidatePathMock, name).toHaveBeenCalledTimes(1)
      expect(revalidatePathMock, name).toHaveBeenCalledWith(WHATSAPP_ROUTE)
    }
  })

  it('R83: las dos devuelven exactamente las claves de la vista', async () => {
    for (const name of ['relate', 'setEnabled'] as const) {
      const result = await ACTIONS[name]()
      if (result.status !== 'success') throw new Error(`${name}: se esperaba success`)
      expect(Object.keys(result.data).sort(), name).toEqual(VIEW_KEYS)
    }
  })

  it('R83: los errores propios de relacionar y habilitar salen con su codigo y sin revalidar', async () => {
    const CASES = [
      { error: new WhatsappTemplateNotMappedError('diagnostico interno'), code: 'whatsapp_template_not_mapped' },
      { error: new WhatsappTemplateNotMappableError('diagnostico interno'), code: 'whatsapp_template_not_mappable' },
      { error: new WhatsappVariableKeyNotFoundError('diagnostico interno'), code: 'whatsapp_variable_key_not_found' },
      { error: new ActionNotAllowedError('diagnostico interno'), code: 'action_not_allowed' },
    ] as const

    for (const name of ['relate', 'setEnabled'] as const) {
      for (const { error, code } of CASES) {
        USE_CASE_OF[name].mockRejectedValueOnce(error)
        revalidatePathMock.mockClear()
        const result = await ACTIONS[name]()
        expect(result, `${name} / ${code}`).toEqual({ status: 'error', code, message: errorMessage(code) })
        expect(JSON.stringify(result)).not.toContain('diagnostico interno')
        expect(revalidatePathMock).not.toHaveBeenCalled()
      }
    }
  })
})
