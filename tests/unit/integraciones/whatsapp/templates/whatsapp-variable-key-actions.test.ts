// Las Server Actions del diccionario de variables propias contra dobles de `@/lib/composition`: se
// prueba el borde (actor, argumentos, forma exacta de cada `data`, traduccion de errores y
// revalidacion), nunca el dominio ni la sesion reales.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createWhatsappVariableKeyAction,
  deleteWhatsappVariableKeyAction,
  listWhatsappDictionaryAction,
  updateWhatsappVariableKeyAction,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-variable-key-actions'
import { errorMessage } from '@/lib/modules/errores'
import {
  UnauthorizedError,
  ValidationError,
  WhatsappVariableKeyInUseError,
  WhatsappVariableKeyNotFoundError,
  WhatsappVariableKeyTakenError,
  type WhatsappDictionaryEntryView,
} from '@/lib/modules/integraciones'

const {
  listMock,
  createMock,
  updateMock,
  deleteMock,
  getSessionUserMock,
  getSessionContextMock,
  revalidatePathMock,
  readRequestIdHeaderMock,
} = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
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
    listWhatsappDictionary: listMock,
    createWhatsappVariableKey: createMock,
    updateWhatsappVariableKey: updateMock,
    deleteWhatsappVariableKey: deleteMock,
  },
}))

const REQUEST_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const COMPANY_ID = '22222222-2222-4222-8222-222222222222'
const KEY_ID = '55555555-5555-4555-8555-555555555555'
const WHATSAPP_ROUTE = '/integraciones/whatsapp'

const SESSION_USER = {
  id: 'user-admin-1',
  username: 'ana.perez',
  displayName: 'Ana Perez',
  roleName: 'Administrador',
  permissions: ['integraciones.modificar'],
}

const ACTOR = { id: SESSION_USER.id, companyId: COMPANY_ID, permissions: SESSION_USER.permissions }

const ENTRY: WhatsappDictionaryEntryView = {
  id: KEY_ID,
  key: 'cuenta_numero',
  label: 'Numero de cuenta',
  value: '0123-4567',
  usedBy: 2,
}

const ENTRY_KEYS = ['id', 'key', 'label', 'usedBy', 'value']

const INPUT = { key: 'cuenta_numero', label: 'Numero de cuenta', value: '0123-4567' }

/** Lo que el caso de uso podria traer de mas y nunca sale por el borde. */
const LEAK = { companyId: COMPANY_ID, createdAt: new Date('2026-10-20T12:00:00.000Z'), kind: 'company' }

const ACTIONS = {
  list: () => listWhatsappDictionaryAction(),
  create: () => createWhatsappVariableKeyAction(INPUT),
  update: () => updateWhatsappVariableKeyAction(KEY_ID, INPUT),
  delete: () => deleteWhatsappVariableKeyAction(KEY_ID),
} as const

const USE_CASE_OF = {
  list: listMock,
  create: createMock,
  update: updateMock,
  delete: deleteMock,
} as const

const WRITES = ['create', 'update', 'delete'] as const

beforeEach(() => {
  vi.clearAllMocks()
  getSessionUserMock.mockResolvedValue(SESSION_USER)
  getSessionContextMock.mockResolvedValue({ companyId: COMPANY_ID })
  listMock.mockResolvedValue([ENTRY])
  createMock.mockResolvedValue({ ...ENTRY, usedBy: 0 })
  updateMock.mockResolvedValue(ENTRY)
  deleteMock.mockResolvedValue({ id: KEY_ID })
})

describe('R83: el contrato de cada accion del diccionario', () => {
  it('R83: listar pasa solo el actor y devuelve success con las entradas', async () => {
    const result = await ACTIONS.list()
    expect(result).toEqual({ status: 'success', data: [ENTRY] })
    expect(listMock).toHaveBeenCalledWith(ACTOR)
  })

  it('R83: crear pasa la entrada tal cual y devuelve success con la entrada, usedBy 0', async () => {
    const result = await ACTIONS.create()
    expect(result).toEqual({ status: 'success', data: { ...ENTRY, usedBy: 0 } })
    expect(createMock).toHaveBeenCalledWith(INPUT, ACTOR)
  })

  it('R83: modificar pasa el id y la entrada, y devuelve success con la entrada', async () => {
    const result = await ACTIONS.update()
    expect(result).toEqual({ status: 'success', data: ENTRY })
    expect(updateMock).toHaveBeenCalledWith(KEY_ID, INPUT, ACTOR)
  })

  it('R83: eliminar pasa el id y devuelve success con el id', async () => {
    const result = await ACTIONS.delete()
    expect(result).toEqual({ status: 'success', data: { id: KEY_ID } })
    expect(deleteMock).toHaveBeenCalledWith(KEY_ID, ACTOR)
  })

  it('R83: las tres de escritura revalidan la pantalla de WhatsApp en exito; listar no', async () => {
    await ACTIONS.list()
    expect(revalidatePathMock).not.toHaveBeenCalled()

    for (const name of WRITES) {
      revalidatePathMock.mockClear()
      await ACTIONS[name]()
      expect(revalidatePathMock, name).toHaveBeenCalledTimes(1)
      expect(revalidatePathMock, name).toHaveBeenCalledWith(WHATSAPP_ROUTE)
    }
  })

  it('R83: cada error de dominio sale como ErrorState con el texto del catalogo, sin diagnostico y sin revalidar', async () => {
    const CASES = [
      { error: new ValidationError('diagnostico interno'), code: 'invalid_input' },
      { error: new WhatsappVariableKeyNotFoundError('diagnostico interno'), code: 'whatsapp_variable_key_not_found' },
      { error: new WhatsappVariableKeyTakenError('diagnostico interno'), code: 'whatsapp_variable_key_taken' },
      { error: new WhatsappVariableKeyInUseError('diagnostico interno'), code: 'whatsapp_variable_key_in_use' },
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

  it('R83: un error ajeno al dominio sale como `unexpected` con referencia y sin su texto', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      USE_CASE_OF[name as keyof typeof ACTIONS].mockRejectedValueOnce(new Error('fallo con 0123-4567 dentro'))
      const result = await action()
      expect(result, name).toEqual({
        status: 'error',
        code: 'unexpected',
        message: errorMessage('unexpected'),
        reference: REQUEST_ID,
      })
      expect(JSON.stringify(result)).not.toContain('fallo con')
    }
  })

  it('R83: el borde no decide: use server, sin permiso, esquema, ORM ni adaptadores driven', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..', '..', '..', '..', '..',
        'lib', 'modules', 'integraciones', 'adapters', 'driving', 'whatsapp-variable-key-actions.ts',
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

describe('R83: las claves exactas de cada data', () => {
  it('R83: listar, crear y modificar devuelven cada entrada con exactamente id, key, label, value y usedBy', async () => {
    for (const name of ['list', 'create', 'update'] as const) {
      const result = await ACTIONS[name]()
      if (result.status !== 'success') throw new Error(`${name}: se esperaba success`)
      const entries = Array.isArray(result.data) ? result.data : [result.data]
      expect(entries.length, name).toBeGreaterThan(0)
      for (const entry of entries) expect(Object.keys(entry).sort(), name).toEqual(ENTRY_KEYS)
    }
  })

  it('R83: eliminar devuelve exactamente el id', async () => {
    const result = await ACTIONS.delete()
    if (result.status !== 'success') throw new Error('se esperaba success')
    expect(Object.keys(result.data)).toEqual(['id'])
  })

  it('R83: si el caso de uso devolviera campos de mas, no salen por el borde', async () => {
    listMock.mockResolvedValueOnce([{ ...ENTRY, ...LEAK }])
    createMock.mockResolvedValueOnce({ ...ENTRY, ...LEAK })
    updateMock.mockResolvedValueOnce({ ...ENTRY, ...LEAK })
    deleteMock.mockResolvedValueOnce({ id: KEY_ID, ...LEAK })

    for (const name of Object.keys(ACTIONS) as (keyof typeof ACTIONS)[]) {
      const serialized = JSON.stringify(await ACTIONS[name]())
      for (const forbidden of [COMPANY_ID, 'companyId', 'createdAt', 'kind']) {
        expect(serialized, `${name} lleva ${forbidden}`).not.toContain(forbidden)
      }
    }
  })
})

describe('R62: el actor llega al caso de uso, que rechaza sin permiso', () => {
  it('R62: cada accion construye el actor con usuario y empresa de la sesion', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      await action()
      const calls = USE_CASE_OF[name as keyof typeof ACTIONS].mock.calls
      const lastCall = calls[calls.length - 1] ?? []
      expect(lastCall[lastCall.length - 1], name).toEqual(ACTOR)
    }
  })

  it('R62: sin sesion o sin empresa pasan actor null, y el unauthorized sale con su codigo y sin revalidar', async () => {
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

  it('R62: un actor sin el permiso tambien sale como unauthorized', async () => {
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
