// Las Server Actions del proveedor IA contra dobles de `@/lib/composition`: se prueba el borde
// (actor, FormData, estados de salida, traduccion de errores y revalidacion), nunca el dominio ni
// la sesion reales.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  disconnectAiProviderAction,
  getAiProviderConnectionAction,
  getAiProviderReadinessAction,
  saveAiProviderConnectionAction,
  selectAiModelAction,
  testAiProviderKeyAction,
  testSavedAiProviderAction,
} from '@/lib/modules/integraciones/adapters/driving/ai-provider-actions'
import { errorMessage } from '@/lib/modules/errores'
import {
  SecretUnreadableError,
  UnauthorizedError,
  ValidationError,
  type AiProviderConnectionView,
  type AiProviderEntry,
} from '@/lib/modules/integraciones'

const {
  getMock,
  testKeyMock,
  testSavedMock,
  saveMock,
  selectMock,
  disconnectMock,
  readinessMock,
  getSessionUserMock,
  getSessionContextMock,
  revalidatePathMock,
  readRequestIdHeaderMock,
  logErrorMock,
} = vi.hoisted(() => ({
  getMock: vi.fn(),
  testKeyMock: vi.fn(),
  testSavedMock: vi.fn(),
  saveMock: vi.fn(),
  selectMock: vi.fn(),
  disconnectMock: vi.fn(),
  readinessMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  getSessionContextMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  readRequestIdHeaderMock: vi.fn(async () => '7c9e6679-7425-40de-944b-e07fc1f90ae7'),
  logErrorMock: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

vi.mock('@/lib/shared/observability/logger', () => ({
  forModule: () => ({ info: vi.fn(), warn: vi.fn(), error: logErrorMock }),
}))

vi.mock('@/lib/composition', () => ({
  observabilidad: { readRequestIdHeader: readRequestIdHeaderMock },
  identity: { getSessionUser: getSessionUserMock, getSessionContext: getSessionContextMock },
  integraciones: {
    getAiProviderConnection: getMock,
    testAiProviderKey: testKeyMock,
    testSavedAiProvider: testSavedMock,
    saveAiProviderConnection: saveMock,
    selectAiModel: selectMock,
    disconnectAiProvider: disconnectMock,
    getAiProviderReadiness: readinessMock,
  },
}))

const REQUEST_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const COMPANY_ID = '22222222-2222-4222-8222-222222222222'
const AI_PROVIDER_ROUTE = '/integraciones/proveedor-ia'

const API_KEY = 'sk-key-de-prueba-que-no-debe-salir'
const API_KEY_ENC = 'v1:valor-cifrado-que-no-debe-salir'

const SESSION_USER = {
  id: 'user-admin-1',
  username: 'ana.perez',
  displayName: 'Ana Perez',
  roleName: 'Administrador',
  permissions: ['integraciones.modificar'],
}

const ACTOR = { id: SESSION_USER.id, companyId: COMPANY_ID, permissions: SESSION_USER.permissions }

const ENTRY: AiProviderEntry = {
  code: 'GOOGLE',
  name: 'Google Gemini',
  models: [
    { modelId: 'modelo-mejor', isDefault: false },
    { modelId: 'modelo-predeterminado', isDefault: true },
  ],
  defaultModel: 'modelo-predeterminado',
}

const VIEW: AiProviderConnectionView = {
  provider: 'GOOGLE',
  providerName: 'Google Gemini',
  modelInUse: 'modelo-mejor',
  modelIsDefault: false,
  modelUnavailable: false,
  modelOptions: [
    { modelId: 'modelo-mejor', isDefault: false },
    { modelId: 'modelo-predeterminado', isDefault: true },
  ],
  status: 'ACTIVE',
  lastError: null,
  lastErrorAt: null,
  lastCheckedAt: '2026-10-13T12:00:00.000Z',
  keyUpdatedAt: '2026-10-13T12:00:00.000Z',
}

const KEY_FIELDS = { provider: 'GOOGLE', apiKey: API_KEY }

function formDataOf(fields: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [name, value] of Object.entries(fields)) formData.set(name, value)
  return formData
}

/** Lo que nunca puede viajar en un estado: la key ni su valor cifrado, por valor ni por nombre. */
function expectNoKey(state: unknown): void {
  const serialized = JSON.stringify(state)
  for (const forbidden of [API_KEY, API_KEY_ENC, 'apiKey', 'apiKeyEnc']) {
    expect(serialized, `el estado lleva ${forbidden}`).not.toContain(forbidden)
  }
}

function happyPath(): void {
  getMock.mockResolvedValue({ providers: [ENTRY], connection: VIEW })
  testKeyMock.mockResolvedValue({ status: 'tested', ok: true, elapsedMs: 812 })
  testSavedMock.mockResolvedValue({ status: 'tested', ok: true, elapsedMs: 640 })
  saveMock.mockResolvedValue({ status: 'saved', connection: VIEW })
  selectMock.mockResolvedValue({ status: 'saved', connection: VIEW })
  disconnectMock.mockResolvedValue({ status: 'disconnected' })
  readinessMock.mockResolvedValue({ configured: true, canConfigure: true })
}

/** Cada accion que traduce errores, con la entrada minima que la lleva hasta su caso de uso. */
const ACTIONS = {
  get: () => getAiProviderConnectionAction(),
  testKey: () => testAiProviderKeyAction({ status: 'idle' }, formDataOf(KEY_FIELDS)),
  testSaved: () => testSavedAiProviderAction({ status: 'idle' }, new FormData()),
  save: () => saveAiProviderConnectionAction({ status: 'idle' }, formDataOf(KEY_FIELDS)),
  select: () => selectAiModelAction({ status: 'idle' }, formDataOf({ modelId: 'modelo-mejor' })),
  disconnect: () => disconnectAiProviderAction({ status: 'idle' }, new FormData()),
} as const

const USE_CASE_OF = {
  get: getMock,
  testKey: testKeyMock,
  testSaved: testSavedMock,
  save: saveMock,
  select: selectMock,
  disconnect: disconnectMock,
} as const

beforeEach(() => {
  vi.clearAllMocks()
  getSessionUserMock.mockResolvedValue(SESSION_USER)
  getSessionContextMock.mockResolvedValue({ companyId: COMPANY_ID })
  happyPath()
})

describe('acciones del proveedor IA — estados de salida', () => {
  it('R8 — la consulta devuelve el catalogo y la vista, sin la key; sin conexion, `null`', async () => {
    const result = await getAiProviderConnectionAction()
    expect(result).toEqual({ status: 'success', providers: [ENTRY], connection: VIEW })
    expect(getMock).toHaveBeenCalledWith(ACTOR)
    expectNoKey(result)

    getMock.mockResolvedValueOnce({ providers: [ENTRY], connection: null })
    expect(await getAiProviderConnectionAction()).toEqual({
      status: 'success',
      providers: [ENTRY],
      connection: null,
    })
  })

  it('R13 — probar la key escrita pasa proveedor y key al caso de uso y no revalida', async () => {
    const ok = await ACTIONS.testKey()
    expect(ok).toEqual({ status: 'tested', ok: true, elapsedMs: 812 })
    expect(testKeyMock).toHaveBeenCalledWith(KEY_FIELDS, ACTOR)
    expect(revalidatePathMock).not.toHaveBeenCalled()
    expectNoKey(ok)

    testKeyMock.mockResolvedValueOnce({ status: 'tested', ok: false, message: 'Error con tu proveedor: x' })
    const failed = await ACTIONS.testKey()
    expect(failed).toEqual({ status: 'tested', ok: false, message: 'Error con tu proveedor: x' })
    expectNoKey(failed)
  })

  it('R18 — campos ausentes llegan al caso de uso como cadena vacia: el esquema los rechaza alli', async () => {
    await testAiProviderKeyAction({ status: 'idle' }, new FormData())
    expect(testKeyMock).toHaveBeenCalledWith({ provider: '', apiKey: '' }, ACTOR)

    await saveAiProviderConnectionAction({ status: 'idle' }, new FormData())
    expect(saveMock).toHaveBeenCalledWith({ provider: '', apiKey: '' }, ACTOR)
  })

  it('R14 — probar la conexion guardada devuelve el resultado y revalida; sin conexion, `not_connected` sin revalidar', async () => {
    expect(await ACTIONS.testSaved()).toEqual({ status: 'tested', ok: true, elapsedMs: 640 })
    expect(testSavedMock).toHaveBeenCalledWith(ACTOR)
    expect(revalidatePathMock).toHaveBeenCalledWith(AI_PROVIDER_ROUTE)

    testSavedMock.mockResolvedValueOnce({ status: 'tested', ok: false, message: 'rechazada' })
    revalidatePathMock.mockClear()
    expect(await ACTIONS.testSaved()).toEqual({ status: 'tested', ok: false, message: 'rechazada' })
    expect(revalidatePathMock).toHaveBeenCalledWith(AI_PROVIDER_ROUTE)

    testSavedMock.mockResolvedValueOnce({ status: 'not_connected' })
    revalidatePathMock.mockClear()
    expect(await ACTIONS.testSaved()).toEqual({ status: 'not_connected' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('R15, R17 — guardar devuelve solo `saved` y revalida; nunca la conexion ni la key', async () => {
    const result = await ACTIONS.save()
    expect(result).toEqual({ status: 'saved' })
    expect(saveMock).toHaveBeenCalledWith(KEY_FIELDS, ACTOR)
    expect(revalidatePathMock).toHaveBeenCalledWith(AI_PROVIDER_ROUTE)
    expectNoKey(result)
  })

  it('R16 — guardar con la prueba fallida devuelve el mensaje y no revalida', async () => {
    saveMock.mockResolvedValueOnce({ status: 'test_failed', message: 'Error con tu proveedor: rechazada' })
    const result = await ACTIONS.save()
    expect(result).toEqual({ status: 'test_failed', message: 'Error con tu proveedor: rechazada' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('R20 — desconectar devuelve `disconnected` y revalida', async () => {
    expect(await ACTIONS.disconnect()).toEqual({ status: 'disconnected' })
    expect(disconnectMock).toHaveBeenCalledWith(ACTOR)
    expect(revalidatePathMock).toHaveBeenCalledWith(AI_PROVIDER_ROUTE)
  })

  it('R8 — un caso de uso que devolviera la fila entera no la filtra: el borde copia solo lo suyo', async () => {
    const leakyView = { ...VIEW, apiKey: API_KEY, apiKeyEnc: API_KEY_ENC }
    const leakyEntry = { ...ENTRY, apiKey: API_KEY }
    getMock.mockResolvedValueOnce({ providers: [leakyEntry], connection: leakyView })
    testKeyMock.mockResolvedValueOnce({ status: 'tested', ok: true, elapsedMs: 1, apiKey: API_KEY })
    testSavedMock.mockResolvedValueOnce({ status: 'tested', ok: true, elapsedMs: 1, apiKeyEnc: API_KEY_ENC })
    saveMock.mockResolvedValueOnce({ status: 'saved', connection: leakyView })
    selectMock.mockResolvedValueOnce({ status: 'saved', connection: leakyView })
    disconnectMock.mockResolvedValueOnce({ status: 'disconnected', apiKeyEnc: API_KEY_ENC })
    readinessMock.mockResolvedValueOnce({ configured: true, canConfigure: true, apiKey: API_KEY })

    for (const name of Object.keys(ACTIONS) as (keyof typeof ACTIONS)[]) {
      expectNoKey(await ACTIONS[name]())
    }
    expectNoKey(await getAiProviderReadinessAction())
  })
})

describe('accion de elegir modelo (QT-291)', () => {
  it('QT-291 R9, R13 — elegir pasa el modelo del formulario al caso de uso, devuelve solo `saved` y revalida', async () => {
    const result = await ACTIONS.select()
    expect(result).toEqual({ status: 'saved' })
    expect(selectMock).toHaveBeenCalledWith({ modelId: 'modelo-mejor' }, ACTOR)
    expect(revalidatePathMock).toHaveBeenCalledTimes(1)
    expect(revalidatePathMock).toHaveBeenCalledWith(AI_PROVIDER_ROUTE)
    expectNoKey(result)
  })

  it('QT-291 R10 — sin el campo llega una cadena vacia al caso de uso: el esquema la rechaza alli', async () => {
    await selectAiModelAction({ status: 'idle' }, new FormData())
    expect(selectMock).toHaveBeenCalledWith({ modelId: '' }, ACTOR)
  })

  it('QT-291 R11 — sin conexion devuelve `not_connected` sin revalidar', async () => {
    selectMock.mockResolvedValueOnce({ status: 'not_connected' })
    expect(await ACTIONS.select()).toEqual({ status: 'not_connected' })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('QT-291 R33 — una consulta fallida devuelve un ErrorState con el mensaje de la prueba y no revalida', async () => {
    const message = 'Error con tu proveedor: el modelo modelo-mejor ya no está disponible.'
    selectMock.mockResolvedValueOnce({ status: 'rejected', message })
    const result = await ACTIONS.select()
    expect(result).toEqual({ status: 'error', code: 'ai_provider_error', message })
    expect(revalidatePathMock).not.toHaveBeenCalled()
    expectNoKey(result)
  })

  it('QT-291 R34 — con la key ilegible devuelve `integration_secret_unreadable` con el texto del catalogo y no revalida', async () => {
    selectMock.mockRejectedValueOnce(new SecretUnreadableError('diagnostico interno'))
    const result = await ACTIONS.select()
    expect(result).toEqual({
      status: 'error',
      code: 'integration_secret_unreadable',
      message: errorMessage('integration_secret_unreadable'),
    })
    expect(JSON.stringify(result)).not.toContain('diagnostico interno')
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('QT-291 R34 — con la key ilegible registra el error en el log del servidor, sin datos sensibles, y no toca la conexion', async () => {
    // El traductor de errores escribe su propia linea en consola (QC-70 R28): se silencia.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      // El diagnostico real del cifrado (`secret-cipher-aes-gcm.ts`): nunca lleva la key ni el valor cifrado.
      selectMock.mockRejectedValueOnce(new SecretUnreadableError('no autentica'))
      await ACTIONS.select()

      // La linea del evento en el logger del modulo, con la empresa para saber cual mirar.
      expect(logErrorMock).toHaveBeenCalledWith('ai_provider_select_secret_unreadable', { companyId: COMPANY_ID })
      expect(logErrorMock).toHaveBeenCalledTimes(1)
      const logged = JSON.stringify([logErrorMock.mock.calls, consoleError.mock.calls])
      for (const forbidden of [API_KEY, API_KEY_ENC, 'apiKey', 'apiKeyEnc']) {
        expect(logged, `el log lleva ${forbidden}`).not.toContain(forbidden)
      }
      // La accion solo eligio: ningun otro caso de uso (probar, guardar, desconectar) cambio la conexion.
      expect(selectMock).toHaveBeenCalledTimes(1)
      for (const other of [testSavedMock, saveMock, disconnectMock]) expect(other).not.toHaveBeenCalled()
      expect(revalidatePathMock).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('QT-291 R34 — otro error al elegir no se registra como key ilegible', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      selectMock.mockRejectedValueOnce(new ValidationError('modelo fuera del catalogo'))
      await ACTIONS.select()
      expect(logErrorMock).not.toHaveBeenCalledWith('ai_provider_select_secret_unreadable', expect.anything())
    } finally {
      consoleError.mockRestore()
    }
  })

  it('QT-291 R13 — la consulta copia la vista y el catalogo campo a campo, tambien cada opcion de modelo', async () => {
    const leakyOption = { modelId: 'modelo-mejor', isDefault: false, apiKey: API_KEY }
    getMock.mockResolvedValueOnce({
      providers: [{ ...ENTRY, models: [leakyOption] }],
      connection: { ...VIEW, modelOptions: [leakyOption], apiKeyEnc: API_KEY_ENC },
    })
    const result = await getAiProviderConnectionAction()
    expectNoKey(result)
    expect(result).toEqual({
      status: 'success',
      providers: [{ ...ENTRY, models: [{ modelId: 'modelo-mejor', isDefault: false }] }],
      connection: { ...VIEW, modelOptions: [{ modelId: 'modelo-mejor', isDefault: false }] },
    })
  })
})

describe('acciones del proveedor IA — actor, revalidacion y errores', () => {
  it('cada accion construye el actor con usuario y empresa de la sesion, y sin sesion pasa `null`', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      await action()
      const calls = USE_CASE_OF[name as keyof typeof ACTIONS].mock.calls
      const lastCall = calls[calls.length - 1] ?? []
      expect(lastCall[lastCall.length - 1], name).toEqual(ACTOR)
    }

    getSessionContextMock.mockResolvedValue(null)
    saveMock.mockRejectedValueOnce(new UnauthorizedError())
    const result = await ACTIONS.save()
    expect(saveMock.mock.calls[saveMock.mock.calls.length - 1]?.[1]).toBeNull()
    expect(result).toEqual({ status: 'error', code: 'unauthorized', message: errorMessage('unauthorized') })
  })

  it('R1 — cada error de dominio se traduce por su codigo con el texto del catalogo, sin diagnostico ni revalidar', async () => {
    const CASES = [
      { error: new UnauthorizedError('diagnostico interno'), code: 'unauthorized' },
      { error: new ValidationError('diagnostico interno'), code: 'invalid_input' },
      { error: new SecretUnreadableError('diagnostico interno'), code: 'integration_secret_unreadable' },
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

  it('R8 — un error ajeno al dominio sale como `unexpected` con referencia y sin su texto', async () => {
    const foreign = new Error(`fallo con ${API_KEY} dentro`)
    for (const [name, action] of Object.entries(ACTIONS)) {
      USE_CASE_OF[name as keyof typeof ACTIONS].mockRejectedValueOnce(foreign)
      const result = await action()
      expect(result, name).toEqual({
        status: 'error',
        code: 'unexpected',
        message: errorMessage('unexpected'),
        reference: REQUEST_ID,
      })
      expectNoKey(result)
    }
  })
})

describe('accion de la disponibilidad del proveedor IA', () => {
  it('R37 — devuelve lo que dice el caso de uso, con el actor de la sesion', async () => {
    readinessMock.mockResolvedValueOnce({ configured: false, canConfigure: true })
    expect(await getAiProviderReadinessAction()).toEqual({ configured: false, canConfigure: true })
    expect(readinessMock).toHaveBeenCalledWith(ACTOR)
  })

  it('R37 — ante cualquier error, del caso de uso o de la sesion, responde «sin configurar» y no lanza', async () => {
    for (const error of [new UnauthorizedError(), new Error('base caida')]) {
      readinessMock.mockRejectedValueOnce(error)
      expect(await getAiProviderReadinessAction()).toEqual({ configured: false, canConfigure: false })
    }

    getSessionUserMock.mockRejectedValueOnce(new Error('sesion caida'))
    expect(await getAiProviderReadinessAction()).toEqual({ configured: false, canConfigure: false })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('el borde no decide', () => {
  it('ni permiso, ni esquema, ni ORM, ni adaptadores driven', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..', '..', '..', '..',
        'lib', 'modules', 'integraciones', 'adapters', 'driving', 'ai-provider-actions.ts',
      ),
      'utf8',
    )
    expect(source.startsWith("'use server';")).toBe(true)
    expect(source).not.toMatch(/requirePermission|integraciones\.modificar|Administrador/)
    expect(source).not.toMatch(/Schema\b/)
    expect(source).not.toMatch(/@prisma\/client|prisma\./)
    expect(source).not.toMatch(/adapters\/driven|\.\.\/driven/)
  })
})
