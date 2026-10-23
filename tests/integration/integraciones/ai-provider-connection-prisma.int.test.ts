// El repositorio de la conexion del proveedor IA y el catalogo de proveedores contra Postgres REAL.
//
// Aislamiento: `commit`. Las funciones de `ai-provider-connection-prisma.ts` usan el cliente Prisma
// GLOBAL, no un `tx` inyectado, y R19 necesita dos altas concurrentes de verdad contra el indice
// unico de empresa: una transaccion de test con ROLLBACK seria aislamiento de mentira. Cada empresa
// efimera (empresa, rol, tipo de documento, usuario) y sus conexiones se borran en `afterAll`, en el
// orden de las FK, y se afirma contando que no queda ninguna conexion de esas empresas.

import { randomBytes, randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { aiProviderProbeCanned } from '@/lib/modules/integraciones/adapters/driven/ai/ai-provider-probe-canned'
import {
  getAiProvider,
  listAiProviders,
} from '@/lib/modules/integraciones/adapters/driven/catalog/ai-provider-catalog-prisma'
import {
  deleteAiProviderConnection,
  findAiProviderConnection,
  insertAiProviderConnection,
  updateAiProviderConnection,
} from '@/lib/modules/integraciones/adapters/driven/persistence/ai-provider-connection-prisma'
import { randomSourceNode } from '@/lib/modules/integraciones/adapters/driven/security/random-source-node'
import { secretCipherAesGcm } from '@/lib/modules/integraciones/adapters/driven/security/secret-cipher-aes-gcm'
import { createSaveAiProviderConnection } from '@/lib/modules/integraciones/domain/save-ai-provider-connection'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'
import type { AiProviderCatalog } from '@/lib/modules/integraciones/ports/ai-provider-catalog'
import {
  AiProviderConnectionRaceError,
  type AiProviderConnectionRepository,
  type NewAiProviderConnectionRow,
} from '@/lib/modules/integraciones/ports/ai-provider-connection-repository'

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

type Empresa = {
  readonly companyId: string
  readonly userId: string
  readonly roleId: string
  readonly documentTypeCode: string
  readonly scope: IntegracionesScope
}

const empresas: Empresa[] = []

async function crearEmpresa(): Promise<Empresa> {
  const marker = token()
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marker.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  })
  const role = await prisma.role.create({
    data: { name: `rol-${marker}`, description: 'Rol de prueba' },
    select: { id: true },
  })
  const companyName = `Empresa proveedor ia ${marker}`
  const company = await prisma.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  })
  const user = await prisma.user.create({
    data: {
      firstNames: 'Ana Maria',
      lastNames: 'Perez Gomez',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `ana.${marker}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode: documentType.code,
      documentNumber: marker.slice(0, 12),
      username: `ana.${marker}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  })
  const empresa: Empresa = {
    companyId: company.id,
    userId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    scope: { companyId: company.id },
  }
  empresas.push(empresa)
  return empresa
}

const NOW = new Date('2026-10-13T12:00:00.000Z')

function nuevaFila(empresa: Empresa, overrides: Partial<NewAiProviderConnectionRow> = {}): NewAiProviderConnectionRow {
  return {
    id: randomUUID(),
    provider: 'GOOGLE',
    apiKeyEnc: 'v1:valor-cifrado-de-prueba',
    status: 'ACTIVE',
    lastError: null,
    lastErrorAt: null,
    lastCheckedAt: NOW,
    keyUpdatedAt: NOW,
    createdById: empresa.userId,
    updatedById: empresa.userId,
    ...overrides,
  }
}

const connections: AiProviderConnectionRepository = {
  find: findAiProviderConnection,
  create: insertAiProviderConnection,
  update: updateAiProviderConnection,
  delete: deleteAiProviderConnection,
}
const catalog: AiProviderCatalog = { list: listAiProviders, get: getAiProvider }

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('se esperaba un error y no se lanzo')
}

const ENCRYPTION_VARS = ['INTEGRATIONS_ENCRYPTION_KEYS', 'INTEGRATIONS_ENCRYPTION_ACTIVE'] as const
const savedEnv: Record<string, string | undefined> = {}

beforeAll(() => {
  for (const name of ENCRYPTION_VARS) savedEnv[name] = process.env[name]
  process.env.INTEGRATIONS_ENCRYPTION_KEYS = `v1:${randomBytes(32).toString('base64')}`
  process.env.INTEGRATIONS_ENCRYPTION_ACTIVE = 'v1'
})

afterAll(async () => {
  for (const name of ENCRYPTION_VARS) {
    if (savedEnv[name] === undefined) delete process.env[name]
    else process.env[name] = savedEnv[name]
  }
  const ids = empresas.map((empresa) => empresa.companyId)
  await prisma.aiProviderConnection.deleteMany({ where: { companyId: { in: ids } } })
  expect(await prisma.aiProviderConnection.count({ where: { companyId: { in: ids } } })).toBe(0)
  for (const empresa of empresas) {
    await prisma.user.delete({ where: { id: empresa.userId } })
    await prisma.role.delete({ where: { id: empresa.roleId } })
    await prisma.documentType.delete({ where: { code: empresa.documentTypeCode } })
    await prisma.company.delete({ where: { id: empresa.companyId } })
  }
  await prisma.$disconnect()
})

describe('R4: el catalogo de proveedores', () => {
  it('R4 — list devuelve los cuatro proveedores en el orden del tablero, con nombre, modelos y predeterminado', async () => {
    const entries = await listAiProviders()
    expect(entries.map((entry) => [entry.code, entry.name])).toEqual([
      ['ANTHROPIC', 'Claude'],
      ['GOOGLE', 'Gemini'],
      ['OPENAI', 'OpenAI'],
      ['OPENROUTER', 'OpenRouter'],
    ])
    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual(['code', 'defaultModel', 'models', 'name'])
      expect(entry.models).toHaveLength(5)
      expect(entry.models.filter((model) => model.isDefault).map((model) => model.modelId)).toEqual([
        entry.defaultModel,
      ])
      for (const model of entry.models) expect(Object.keys(model).sort()).toEqual(['isDefault', 'modelId'])
    }
  })

  it('QT-291 R2, R3, R5 — los modelos de cada proveedor salen del catalogo de modelos en su orden, con el predeterminado sembrado', async () => {
    const entries = await listAiProviders()
    const google = entries.find((entry) => entry.code === 'GOOGLE')
    expect(google?.models).toEqual([
      { modelId: 'gemini-4-argon', isDefault: false },
      { modelId: 'gemini-3.8-flash', isDefault: true },
      { modelId: 'gemini-3.7-flash', isDefault: false },
      { modelId: 'gemini-3.5-flash-lite', isDefault: false },
      { modelId: 'gemini-3.1-flash-lite', isDefault: false },
    ])
    expect(Object.fromEntries(entries.map((entry) => [entry.code, entry.defaultModel]))).toEqual({
      ANTHROPIC: 'claude-haiku-5-5',
      GOOGLE: 'gemini-3.8-flash',
      OPENAI: 'gpt-6-luna',
      OPENROUTER: 'anthropic/claude-haiku-5.5',
    })
  })

  it('QT-291 R17 — el catalogo se lee en cada llamada: un cambio de predeterminado se ve en la siguiente', async () => {
    const antes = await getAiProvider('OPENAI')
    expect(antes?.defaultModel).toBe('gpt-6-luna')
    try {
      await prisma.$transaction([
        prisma.aiModel.update({
          where: { provider_modelId: { provider: 'OPENAI', modelId: 'gpt-6-luna' } },
          data: { isDefault: false },
        }),
        prisma.aiModel.update({
          where: { provider_modelId: { provider: 'OPENAI', modelId: 'gpt-5.6-luna' } },
          data: { isDefault: true },
        }),
      ])
      expect((await getAiProvider('OPENAI'))?.defaultModel).toBe('gpt-5.6-luna')
    } finally {
      await prisma.$transaction([
        prisma.aiModel.update({
          where: { provider_modelId: { provider: 'OPENAI', modelId: 'gpt-5.6-luna' } },
          data: { isDefault: false },
        }),
        prisma.aiModel.update({
          where: { provider_modelId: { provider: 'OPENAI', modelId: 'gpt-6-luna' } },
          data: { isDefault: true },
        }),
      ])
    }
    expect(await getAiProvider('OPENAI')).toEqual(antes)
  })

  it('QT-291 R3 — un proveedor sin predeterminado (dato imposible) no sale de list y get devuelve null', async () => {
    try {
      await prisma.aiModel.update({
        where: { provider_modelId: { provider: 'OPENROUTER', modelId: 'anthropic/claude-haiku-5.5' } },
        data: { isDefault: false },
      })
      expect((await listAiProviders()).map((entry) => entry.code)).toEqual(['ANTHROPIC', 'GOOGLE', 'OPENAI'])
      expect(await getAiProvider('OPENROUTER')).toBeNull()
    } finally {
      await prisma.aiModel.update({
        where: { provider_modelId: { provider: 'OPENROUTER', modelId: 'anthropic/claude-haiku-5.5' } },
        data: { isDefault: true },
      })
    }
    expect((await getAiProvider('OPENROUTER'))?.defaultModel).toBe('anthropic/claude-haiku-5.5')
  })

  it('R4 — get devuelve la fila de un codigo, igual a la de list', async () => {
    const entries = await listAiProviders()
    for (const entry of entries) expect(await getAiProvider(entry.code)).toEqual(entry)
  })
})

describe('R5: tablas e indice unico de empresa', () => {
  it('R5 — pg_class marca las dos tablas con relrowsecurity y relforcerowsecurity', async () => {
    const rows = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE relname IN ('ai_providers', 'ai_provider_connections') AND relnamespace = 'public'::regnamespace
      ORDER BY relname`
    expect(rows).toEqual([
      { relname: 'ai_provider_connections', relrowsecurity: true, relforcerowsecurity: true },
      { relname: 'ai_providers', relrowsecurity: true, relforcerowsecurity: true },
    ])
  })

  it('R5 — una segunda alta en la misma empresa da el error de carrera y deja una sola fila', async () => {
    const a = await crearEmpresa()
    await insertAiProviderConnection(nuevaFila(a), a.scope)

    const error = await errorOf(insertAiProviderConnection(nuevaFila(a, { provider: 'OPENAI' }), a.scope))
    expect(error).toBeInstanceOf(AiProviderConnectionRaceError)
    expect(await prisma.aiProviderConnection.count({ where: { companyId: a.companyId } })).toBe(1)
  })

  it('R5 — cualquier otra violacion de unicidad (la clave primaria) se propaga sin traducir', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const filaA = nuevaFila(a)
    await insertAiProviderConnection(filaA, a.scope)

    const error = await errorOf(insertAiProviderConnection(nuevaFila(b, { id: filaA.id }), b.scope))
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002')
  })
})

describe('R2: la empresa sale del ambito, nunca de la fila', () => {
  it('R2 — el alta queda en la empresa del ambito aunque la fila traiga otra empresa', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const fila = { ...nuevaFila(a), companyId: b.companyId } as NewAiProviderConnectionRow

    const creada = await insertAiProviderConnection(fila, a.scope)

    expect(creada.companyId).toBe(a.companyId)
    expect(await findAiProviderConnection(b.scope)).toBeNull()
  })

  it('R2 — find devuelve exactamente la fila del puerto, sin la auditoria', async () => {
    const a = await crearEmpresa()
    const fila = nuevaFila(a)
    await insertAiProviderConnection(fila, a.scope)

    expect(await findAiProviderConnection(a.scope)).toEqual({
      id: fila.id,
      companyId: a.companyId,
      provider: fila.provider,
      apiKeyEnc: fila.apiKeyEnc,
      status: fila.status,
      lastError: null,
      lastErrorAt: null,
      lastCheckedAt: NOW,
      keyUpdatedAt: NOW,
      model: null,
      unavailableModel: null,
    })
  })

  it('R2 — la empresa B no lee, no actualiza ni borra la conexion de A, y la fila de A no cambia', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const fila = nuevaFila(a)
    await insertAiProviderConnection(fila, a.scope)
    const antes = await prisma.aiProviderConnection.findUniqueOrThrow({ where: { id: fila.id } })

    expect(await findAiProviderConnection(b.scope)).toBeNull()
    expect(
      await updateAiProviderConnection(fila.id, { status: 'ERROR', lastError: 'robada' }, b.scope),
    ).toBeNull()
    await deleteAiProviderConnection(b.scope)

    const despues = await prisma.aiProviderConnection.findUniqueOrThrow({ where: { id: fila.id } })
    expect(despues).toEqual(antes)
  })

  it('R2 — en su empresa, update cambia solo lo del parche y devuelve la fila releida', async () => {
    const a = await crearEmpresa()
    const fila = nuevaFila(a)
    await insertAiProviderConnection(fila, a.scope)
    const errorAt = new Date('2026-10-13T13:00:00.000Z')

    const actualizada = await updateAiProviderConnection(
      fila.id,
      { status: 'ERROR', lastError: 'fallo', lastErrorAt: errorAt },
      a.scope,
    )
    expect(actualizada).toMatchObject({
      id: fila.id,
      provider: 'GOOGLE',
      apiKeyEnc: fila.apiKeyEnc,
      status: 'ERROR',
      lastError: 'fallo',
      lastErrorAt: errorAt,
      keyUpdatedAt: NOW,
    })
  })

  it('R20 — delete borra la fila de la empresa, y repetirlo no falla', async () => {
    const a = await crearEmpresa()
    await insertAiProviderConnection(nuevaFila(a), a.scope)

    await deleteAiProviderConnection(a.scope)
    await deleteAiProviderConnection(a.scope)
    expect(await prisma.aiProviderConnection.count({ where: { companyId: a.companyId } })).toBe(0)
  })
})

const MODEL_OUTSIDE_CATALOG = 'integraciones: el modelo de la conexión no está en el catálogo de su proveedor'

describe('QT-291 R7: la eleccion y el modelo marcado en la conexion', () => {
  it('QT-291 R7 — create guarda la eleccion y el modelo marcado, y find los devuelve', async () => {
    const a = await crearEmpresa()
    const fila = nuevaFila(a, { model: 'gemini-4-argon', unavailableModel: 'gemini-3.8-flash' })
    const creada = await insertAiProviderConnection(fila, a.scope)

    expect(creada).toMatchObject({ model: 'gemini-4-argon', unavailableModel: 'gemini-3.8-flash' })
    expect(await findAiProviderConnection(a.scope)).toMatchObject({
      model: 'gemini-4-argon',
      unavailableModel: 'gemini-3.8-flash',
    })
  })

  it('QT-291 R7 — create sin los campos deja la eleccion y el modelo marcado vacios', async () => {
    const a = await crearEmpresa()
    const creada = await insertAiProviderConnection(nuevaFila(a), a.scope)
    expect(creada).toMatchObject({ model: null, unavailableModel: null })
  })

  it('QT-291 R7, R12 — update cambia y vacia la eleccion y el modelo marcado; un parche sin ellos los conserva', async () => {
    const a = await crearEmpresa()
    const fila = nuevaFila(a)
    await insertAiProviderConnection(fila, a.scope)

    expect(
      await updateAiProviderConnection(
        fila.id,
        { model: 'gemini-3.7-flash', unavailableModel: 'gemini-3.7-flash' },
        a.scope,
      ),
    ).toMatchObject({ model: 'gemini-3.7-flash', unavailableModel: 'gemini-3.7-flash' })

    expect(await updateAiProviderConnection(fila.id, { status: 'ERROR', lastError: 'x' }, a.scope)).toMatchObject({
      model: 'gemini-3.7-flash',
      unavailableModel: 'gemini-3.7-flash',
    })

    expect(
      await updateAiProviderConnection(fila.id, { model: null, unavailableModel: null }, a.scope),
    ).toMatchObject({ model: null, unavailableModel: null, status: 'ERROR', lastError: 'x' })
  })

  it('QT-291 R14 — cambiar de proveedor vaciando la eleccion en el mismo parche se acepta', async () => {
    const a = await crearEmpresa()
    await insertAiProviderConnection(nuevaFila(a, { model: 'gemini-4-argon' }), a.scope)
    const fila = await findAiProviderConnection(a.scope)
    if (fila === null) throw new Error('falta la fila')

    expect(
      await updateAiProviderConnection(fila.id, { provider: 'OPENAI', model: null, unavailableModel: null }, a.scope),
    ).toMatchObject({ provider: 'OPENAI', model: null, unavailableModel: null })
  })

  it('QT-291 R7 — una eleccion de otro proveedor la rechaza la base y el adaptador lanza el error de dato imposible, sin escribir', async () => {
    const a = await crearEmpresa()
    const fila = nuevaFila(a)
    await insertAiProviderConnection(fila, a.scope)

    const alActualizar = await errorOf(updateAiProviderConnection(fila.id, { model: 'gpt-6-luna' }, a.scope))
    expect(alActualizar).toBeInstanceOf(Error)
    expect(alActualizar).not.toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
    expect((alActualizar as Error).message).toBe(MODEL_OUTSIDE_CATALOG)
    const causa = (alActualizar as Error).cause
    expect(causa).toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
    expect((causa as Prisma.PrismaClientKnownRequestError).code).toBe('P2003')
    expect(await findAiProviderConnection(a.scope)).toMatchObject({ model: null })

    const b = await crearEmpresa()
    const alCrear = await errorOf(insertAiProviderConnection(nuevaFila(b, { model: 'no-existe' }), b.scope))
    expect((alCrear as Error).message).toBe(MODEL_OUTSIDE_CATALOG)
    expect(await findAiProviderConnection(b.scope)).toBeNull()
  })

  it('QT-291 R7 — otra FK rota (el autor) no se disfraza de modelo fuera del catalogo', async () => {
    const a = await crearEmpresa()
    const error = await errorOf(insertAiProviderConnection(nuevaFila(a, { createdById: randomUUID() }), a.scope))
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2003')
  })
})

describe('R7 y R19: la key cifrada y la carrera, por el caso de uso con adaptadores reales', () => {
  function save() {
    return createSaveAiProviderConnection({
      connections,
      catalog,
      probe: aiProviderProbeCanned,
      cipher: secretCipherAesGcm,
      random: randomSourceNode,
    })
  }

  it('R7 — la columna guarda v<n>: sin la key en claro, y se descifra con el contexto de su fila', async () => {
    const a = await crearEmpresa()
    const apiKey = `sk-${token()}`
    const result = await save()(
      { provider: 'OPENAI', apiKey },
      { id: a.userId, companyId: a.companyId, permissions: ['integraciones.modificar'] },
    )
    expect(result.status).toBe('saved')

    const rows = await prisma.$queryRaw<{ id: string; api_key_enc: string; row: string }[]>`
      SELECT id::text AS id, api_key_enc, row_to_json(c)::text AS row
      FROM ai_provider_connections c WHERE company_id = ${a.companyId}::uuid`
    expect(rows).toHaveLength(1)
    const row = rows[0]
    if (row === undefined) return
    expect(row.api_key_enc).toMatch(/^v\d+:/)
    expect(row.row).not.toContain(apiKey)
    expect(JSON.stringify(result)).not.toContain(apiKey)
    expect(JSON.stringify(result)).not.toContain(row.api_key_enc)
    expect(
      await secretCipherAesGcm.decrypt(row.api_key_enc, {
        companyId: a.companyId,
        recordId: row.id,
        field: 'api_key',
      }),
    ).toBe(apiKey)
  })

  it('R19 — dos altas concurrentes del repositorio acaban en una fila y un error de carrera', async () => {
    const a = await crearEmpresa()
    const resultados = await Promise.allSettled([
      insertAiProviderConnection(nuevaFila(a), a.scope),
      insertAiProviderConnection(nuevaFila(a), a.scope),
    ])

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rechazos = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(rechazos).toHaveLength(1)
    expect(rechazos[0]?.reason).toBeInstanceOf(AiProviderConnectionRaceError)
    expect(await prisma.aiProviderConnection.count({ where: { companyId: a.companyId } })).toBe(1)
  })

  it('R19 — dos guardados concurrentes de la misma empresa terminan en una conexion cuya key descifra con su propio id', async () => {
    const a = await crearEmpresa()
    const actor = { id: a.userId, companyId: a.companyId, permissions: ['integraciones.modificar'] }
    const keys = [`sk-a-${token()}`, `sk-b-${token()}`]

    const resultados = await Promise.all([
      save()({ provider: 'ANTHROPIC', apiKey: keys[0] }, actor),
      save()({ provider: 'OPENROUTER', apiKey: keys[1] }, actor),
    ])
    expect(resultados.map((r) => r.status)).toEqual(['saved', 'saved'])

    const filas = await prisma.aiProviderConnection.findMany({
      where: { companyId: a.companyId },
      select: { id: true, apiKeyEnc: true },
    })
    expect(filas).toHaveLength(1)
    const fila = filas[0]
    if (fila === undefined) return
    const key = await secretCipherAesGcm.decrypt(fila.apiKeyEnc, {
      companyId: a.companyId,
      recordId: fila.id,
      field: 'api_key',
    })
    expect(keys).toContain(key)
  })
})
