import { describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'
import type { AiProviderConnectionRecord } from '@/lib/modules/integraciones/domain/ai-provider'
import {
  modelUnavailableNotice,
  READING_FAILURE_PREFIX,
  type AiProviderFailureKind,
  type AiProviderProbeResult,
} from '@/lib/modules/integraciones/domain/ai-provider-failure'
import {
  SecretUnreadableError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/integraciones/domain/errors'
import { createSelectAiModel } from '@/lib/modules/integraciones/domain/select-ai-model'

import {
  ACTOR_ID,
  CONNECTION_ID,
  EARLIER,
  OLD_API_KEY,
  OTHER_COMPANY_ID,
  admin,
  failedProbe,
  makeCatalog,
  makeCipher,
  makeProbe,
  makeRepository,
  storedConnection,
} from './ai-provider-doubles'

function setup(
  options: { probe?: AiProviderProbeResult; record?: Partial<AiProviderConnectionRecord> | null } = {},
) {
  const cipher = makeCipher()
  const initial = options.record === null ? [] : [storedConnection(cipher.seed, options.record ?? {})]
  const repo = makeRepository(initial)
  const catalog = makeCatalog()
  const probe = makeProbe(options.probe)
  const select = createSelectAiModel({
    connections: repo.connections,
    catalog: catalog.catalog,
    cipher: cipher.cipher,
    probe: probe.probe,
  })
  const touched = () =>
    [repo.find, repo.create, repo.update, repo.remove, catalog.get, catalog.list, probe.call, cipher.decrypt].some(
      (fn) => fn.mock.calls.length > 0,
    )
  return { repo, cipher, catalog, probe, select, touched }
}

const REJECTED_ACTORS: Record<string, Actor | null | undefined> = {
  'sin actor (null)': null,
  'sin actor (undefined)': undefined,
  'sin empresa': admin({ companyId: '' }),
  'sin permisos': admin({ permissions: [] }),
  'con otro permiso': admin({ permissions: ['documentos.modificar'] }),
}

describe('elegir modelo: permiso', () => {
  for (const [label, actor] of Object.entries(REJECTED_ACTORS)) {
    it(`R8: rechaza ${label} con unauthorized sin leer ni escribir la conexion`, async () => {
      const { select, touched } = setup()
      await expect(select({ modelId: 'modelo-alto-g' }, actor)).rejects.toBeInstanceOf(UnauthorizedError)
      expect(touched()).toBe(false)
    })
  }

  it('R8: el rechazo llega antes de validar la entrada', async () => {
    const { select, touched } = setup()
    await expect(select({ modelId: '' }, null)).rejects.toBeInstanceOf(UnauthorizedError)
    await expect(select(null, admin({ permissions: [] }))).rejects.toBeInstanceOf(UnauthorizedError)
    expect(touched()).toBe(false)
  })
})

describe('elegir modelo: guardar', () => {
  it('R9: un modelo del catalogo del proveedor conectado queda como la eleccion y la vista lo refleja', async () => {
    const { select, repo } = setup()
    const result = await select({ modelId: 'modelo-alto-g' }, admin())

    expect(repo.row(CONNECTION_ID)).toMatchObject({ model: 'modelo-alto-g', status: 'ACTIVE' })
    expect(repo.update.mock.calls[0]?.[1]).toMatchObject({ model: 'modelo-alto-g', updatedById: ACTOR_ID })
    expect(result).toMatchObject({
      status: 'saved',
      connection: { modelInUse: 'modelo-alto-g', modelIsDefault: false, modelUnavailable: false },
    })
  })

  it('R9: la entrada se recorta antes de compararla con el catalogo', async () => {
    const { select, repo } = setup()
    await select({ modelId: '  modelo-bajo-g \n' }, admin())
    expect(repo.row(CONNECTION_ID)?.model).toBe('modelo-bajo-g')
  })

  it('R9: elegir el predeterminado deja la eleccion vacia', async () => {
    const { select, repo } = setup({ record: { model: 'modelo-alto-g' } })
    const result = await select({ modelId: 'modelo-recomendado-g' }, admin())

    expect(repo.row(CONNECTION_ID)?.model).toBeNull()
    expect(result).toMatchObject({
      status: 'saved',
      connection: { modelInUse: 'modelo-recomendado-g', modelIsDefault: true },
    })
  })

  it('R9: elegir no escribe lastCheckedAt ni toca la key ni el proveedor', async () => {
    const { select, repo } = setup()
    await select({ modelId: 'modelo-alto-g' }, admin())
    const patch = repo.update.mock.calls[0]?.[1] ?? {}
    for (const field of ['lastCheckedAt', 'apiKeyEnc', 'provider', 'keyUpdatedAt']) {
      expect(patch).not.toHaveProperty(field)
    }
    expect(repo.row(CONNECTION_ID)).toMatchObject({ lastCheckedAt: EARLIER, keyUpdatedAt: EARLIER })
  })

  it('R9: solo escribe en la conexion de la empresa del actor', async () => {
    const { select, repo } = setup()
    await select({ modelId: 'modelo-alto-g', companyId: OTHER_COMPANY_ID }, admin())
    for (const call of [...repo.find.mock.calls, ...repo.update.mock.calls]) {
      expect(call.at(-1)).toEqual({ companyId: admin().companyId })
    }
  })
})

describe('elegir modelo: entrada fuera del catalogo', () => {
  const INVALID: Record<string, unknown> = {
    'un modelo de otro proveedor': { modelId: 'modelo-alto-a' },
    'un modelo inexistente': { modelId: 'no-existe' },
    'vacio': { modelId: '' },
    'solo espacios': { modelId: '   ' },
    'de 201 caracteres': { modelId: 'm'.repeat(201) },
    'que no es texto': { modelId: 42 },
    'sin modelId': {},
    'entrada nula': null,
  }
  for (const [label, input] of Object.entries(INVALID)) {
    it(`R10: ${label} da invalid_input sin consultar ni escribir`, async () => {
      const { select, repo, probe, cipher } = setup()
      await expect(select(input, admin())).rejects.toBeInstanceOf(ValidationError)
      expect(probe.call).not.toHaveBeenCalled()
      expect(cipher.decrypt).not.toHaveBeenCalled()
      expect(repo.update).not.toHaveBeenCalled()
    })
  }

  it('R10: el modelo marcado da invalid_input sin consultar ni escribir', async () => {
    const { select, repo, probe } = setup({
      record: { model: 'modelo-alto-g', unavailableModel: 'modelo-alto-g', status: 'ERROR' },
    })
    await expect(select({ modelId: 'modelo-alto-g' }, admin())).rejects.toBeInstanceOf(ValidationError)
    expect(probe.call).not.toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
  })
})

describe('elegir modelo: sin conexion', () => {
  it('R11: sin conexion responde not_connected sin consultar ni escribir', async () => {
    const { select, repo, probe, cipher, catalog } = setup({ record: null })
    expect(await select({ modelId: 'modelo-alto-g' }, admin())).toEqual({ status: 'not_connected' })
    expect(probe.call).not.toHaveBeenCalled()
    expect(cipher.decrypt).not.toHaveBeenCalled()
    expect(catalog.get).not.toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('R11: la conexion de otra empresa no cuenta', async () => {
    const { select, repo, probe } = setup({ record: { companyId: OTHER_COMPANY_ID } })
    expect(await select({ modelId: 'modelo-alto-g' }, admin())).toEqual({ status: 'not_connected' })
    expect(probe.call).not.toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
  })
})

describe('elegir modelo: el modelo marcado y el estado de la conexion', () => {
  it('R12: con un modelo marcado que no es el elegido, guarda la eleccion y vacia el marcado', async () => {
    const { select, repo } = setup({ record: { unavailableModel: 'modelo-bajo-g' } })
    await select({ modelId: 'modelo-alto-g' }, admin())
    expect(repo.row(CONNECTION_ID)).toMatchObject({ model: 'modelo-alto-g', unavailableModel: null })
  })

  it('R12: en ERROR por modelo no disponible (aviso de la prueba) queda ACTIVE, sin error y con la eleccion', async () => {
    const { select, repo } = setup({
      record: {
        model: 'modelo-bajo-g',
        unavailableModel: 'modelo-bajo-g',
        status: 'ERROR',
        lastError: modelUnavailableNotice('modelo-bajo-g', 'Gemini', true),
        lastErrorAt: EARLIER,
      },
    })
    const result = await select({ modelId: 'modelo-alto-g' }, admin())

    expect(repo.row(CONNECTION_ID)).toMatchObject({
      model: 'modelo-alto-g',
      unavailableModel: null,
      status: 'ACTIVE',
      lastError: null,
      lastErrorAt: null,
    })
    expect(result).toMatchObject({ status: 'saved', connection: { status: 'ACTIVE', modelUnavailable: false } })
  })

  it('R12: en ERROR por modelo no disponible (aviso de la lectura) tambien vuelve a ACTIVE', async () => {
    const { select, repo } = setup({
      record: {
        unavailableModel: 'modelo-recomendado-g',
        status: 'ERROR',
        lastError: READING_FAILURE_PREFIX + modelUnavailableNotice('modelo-recomendado-g', 'Gemini', false),
        lastErrorAt: EARLIER,
      },
    })
    await select({ modelId: 'modelo-alto-g' }, admin())
    expect(repo.row(CONNECTION_ID)).toMatchObject({ status: 'ACTIVE', lastError: null, lastErrorAt: null })
  })

  it('R12: en ERROR por key rechazada (de «Probar conexion») queda ACTIVE, sin error y con la eleccion', async () => {
    const { select, repo } = setup({
      record: {
        status: 'ERROR',
        lastError: 'Error con tu proveedor: la key fue rechazada. Revísala y vuelve a probar.',
        lastErrorAt: EARLIER,
      },
    })
    await select({ modelId: 'modelo-alto-g' }, admin())
    expect(repo.row(CONNECTION_ID)).toMatchObject({
      model: 'modelo-alto-g',
      status: 'ACTIVE',
      lastError: null,
      lastErrorAt: null,
    })
  })

  it('R12: en ERROR por falta de cuota (de una lectura) queda ACTIVE, sin error y con la eleccion', async () => {
    const { select, repo } = setup({
      record: {
        status: 'ERROR',
        lastError: 'La última lectura falló: Gemini indicó que tu cuenta no tiene cuota o saldo (429).',
        lastErrorAt: EARLIER,
      },
    })
    await select({ modelId: 'modelo-alto-g' }, admin())
    expect(repo.row(CONNECTION_ID)).toMatchObject({
      model: 'modelo-alto-g',
      status: 'ACTIVE',
      lastError: null,
      lastErrorAt: null,
    })
  })

  for (const [label, lastError] of [
    ['sin respuesta', 'Error con tu proveedor: no respondió a tiempo. Vuelve a probar en unos minutos.'],
    ['error inesperado', 'Error con tu proveedor: respondió con un error inesperado (500).'],
    ['key ilegible', 'No se pudo leer la key guardada. Vuelve a escribirla.'],
  ] as const) {
    it(`R12: en ERROR por ${label} guarda la eleccion sin cambiar el estado ni el error`, async () => {
      const { select, repo } = setup({ record: { status: 'ERROR', lastError, lastErrorAt: EARLIER } })
      await select({ modelId: 'modelo-alto-g' }, admin())

      expect(repo.row(CONNECTION_ID)).toMatchObject({
        model: 'modelo-alto-g',
        status: 'ERROR',
        lastError,
        lastErrorAt: EARLIER,
      })
      const patch = repo.update.mock.calls[0]?.[1] ?? {}
      for (const field of ['status', 'lastError', 'lastErrorAt']) expect(patch).not.toHaveProperty(field)
    })
  }

  it('R12: un aviso de key rechazada de otro proveedor no se reconoce y el error se queda', async () => {
    const lastError = 'La última lectura falló: Claude rechazó la key (401).'
    const { select, repo } = setup({ record: { status: 'ERROR', lastError, lastErrorAt: EARLIER } })
    await select({ modelId: 'modelo-alto-g' }, admin())
    expect(repo.row(CONNECTION_ID)).toMatchObject({ status: 'ERROR', lastError })
  })

  it('R12: en ACTIVE solo escribe la eleccion', async () => {
    const { select, repo } = setup()
    await select({ modelId: 'modelo-alto-g' }, admin())
    expect(repo.update.mock.calls[0]?.[1]).toEqual({ model: 'modelo-alto-g', updatedById: ACTOR_ID })
  })
})

describe('elegir modelo: consulta antes de guardar', () => {
  it('R32: consulta solo el modelo elegido con la key guardada, y nada se escribe antes', async () => {
    const order: string[] = []
    const { select, repo, probe } = setup()
    probe.call.mockImplementation(async () => {
      order.push('probe')
      return { ok: true, elapsedMs: 10 }
    })
    repo.update.mockImplementationOnce(async () => {
      order.push('update')
      return null
    })

    await select({ modelId: 'modelo-alto-g' }, admin())
    expect(probe.call).toHaveBeenCalledTimes(1)
    expect(probe.call).toHaveBeenCalledWith({ provider: 'GOOGLE', apiKey: OLD_API_KEY, models: ['modelo-alto-g'] })
    expect(order).toEqual(['probe', 'update'])
  })

  it('R32: tambien consulta cuando el elegido es el predeterminado', async () => {
    const { select, probe } = setup({ record: { model: 'modelo-alto-g' } })
    await select({ modelId: 'modelo-recomendado-g' }, admin())
    expect(probe.call).toHaveBeenCalledWith({
      provider: 'GOOGLE',
      apiKey: OLD_API_KEY,
      models: ['modelo-recomendado-g'],
    })
  })

  it('R32: descifra con el contexto de su propia fila y su empresa', async () => {
    const { select, cipher } = setup()
    await select({ modelId: 'modelo-alto-g' }, admin())
    expect(cipher.decrypt).toHaveBeenCalledWith(expect.any(String), {
      companyId: admin().companyId,
      recordId: CONNECTION_ID,
      field: 'api_key',
    })
  })

  it('R11: si la conexion desaparece entre la consulta y la escritura, responde not_connected', async () => {
    const { select, repo } = setup()
    repo.update.mockResolvedValueOnce(null)
    expect(await select({ modelId: 'modelo-alto-g' }, admin())).toEqual({ status: 'not_connected' })
  })
})

describe('elegir modelo: consulta fallida', () => {
  const MESSAGES: Record<AiProviderFailureKind, string> = {
    rejected_key: 'Error con tu proveedor: la key fue rechazada. Revísala y vuelve a probar.',
    quota: 'Error con tu proveedor: tu cuenta no tiene cuota o saldo disponible.',
    model_unavailable: 'Error con tu proveedor: el modelo modelo-alto-g ya no está disponible.',
    unreachable: 'Error con tu proveedor: no respondió a tiempo. Vuelve a probar en unos minutos.',
    unexpected: 'Error con tu proveedor: respondió con un error inesperado (500).',
  }
  for (const [kind, message] of Object.entries(MESSAGES) as [AiProviderFailureKind, string][]) {
    it(`R33: con ${kind} no escribe nada y devuelve el mensaje de la prueba`, async () => {
      const { select, repo } = setup({
        probe: failedProbe(kind, 'modelo-alto-g'),
        record: { status: 'ERROR', lastError: 'antes', lastErrorAt: EARLIER, unavailableModel: 'modelo-bajo-g' },
      })
      const before = repo.row(CONNECTION_ID)

      const result = await select({ modelId: 'modelo-alto-g' }, admin())

      expect(result).toEqual({ status: 'rejected', message })
      expect(repo.update).not.toHaveBeenCalled()
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.row(CONNECTION_ID)).toEqual(before)
      expect(JSON.stringify(result)).not.toContain(OLD_API_KEY)
    })
  }
})

describe('elegir modelo: key ilegible', () => {
  it('R34: no consulta al proveedor, no escribe y lanza integration_secret_unreadable', async () => {
    const { select, repo, probe } = setup({ record: { apiKeyEnc: 'v1:valor-que-no-descifra' } })
    const before = repo.row(CONNECTION_ID)

    const error = await select({ modelId: 'modelo-alto-g' }, admin()).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(SecretUnreadableError)
    expect((error as SecretUnreadableError).code).toBe('integration_secret_unreadable')
    expect(probe.call).not.toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
    expect(repo.row(CONNECTION_ID)).toEqual(before)
  })
})
