// QT-304 R5, R12: el repositorio de los pares de modelos de la plataforma contra Postgres REAL.
//
// Aislamiento: `commit`. `createAiModelPairPrisma()` usa el cliente Prisma GLOBAL, no un `tx` del
// test, y la tabla es de plataforma: no hay empresa efimera que la acote. `beforeAll` fotografia los
// ocho pares sembrados y `afterAll` los deja tal cual (principal, respaldo, autor nulo y hora), afirma
// que la foto coincide y despues borra el usuario efimero -> rol -> tipo de documento -> empresa.

import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createAiModelPairPrisma } from '@/lib/modules/integraciones/adapters/driven/catalog/ai-model-pair-prisma'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

const pairs = createAiModelPairPrisma()

type Foto = Awaited<ReturnType<typeof leerTabla>>
let foto: Foto = []
let userId = ''
let roleId = ''
let documentTypeCode = ''
let companyId = ''

function leerTabla() {
  return prisma.aiAgentModelPair.findMany({ orderBy: [{ provider: 'asc' }, { role: 'asc' }] })
}

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('se esperaba un error y no se lanzo')
}

beforeAll(async () => {
  foto = await leerTabla()
  const marker = randomUUID().replace(/-/gu, '')
  documentTypeCode = (
    await prisma.documentType.create({
      data: { code: `DOC${marker.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
      select: { code: true },
    })
  ).code
  roleId = (await prisma.role.create({ data: { name: `rol-${marker}`, description: 'Rol de prueba' }, select: { id: true } })).id
  const companyName = `Empresa pares ia ${marker}`
  companyId = (
    await prisma.company.create({
      data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
      select: { id: true },
    })
  ).id
  userId = (
    await prisma.user.create({
      data: {
        firstNames: 'Mara',
        lastNames: 'Maestro Prueba',
        birthDate: new Date('1990-05-17T00:00:00.000Z'),
        email: `mara.${marker}@quimicloude.test`,
        phone: '+57 300 111 2233',
        documentTypeCode,
        documentNumber: marker.slice(0, 12),
        username: `mara.${marker}`,
        passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
        roleId,
        companyId,
      },
      select: { id: true },
    })
  ).id
})

afterAll(async () => {
  for (const row of foto) {
    await prisma.aiAgentModelPair.upsert({
      where: { provider_role: { provider: row.provider, role: row.role } },
      create: row,
      update: {
        primaryModelId: row.primaryModelId,
        fallbackModelId: row.fallbackModelId,
        updatedBy: row.updatedBy,
        updatedAt: row.updatedAt,
      },
    })
  }
  await prisma.aiAgentModelPair.deleteMany({
    where: { NOT: { OR: foto.map((row) => ({ provider: row.provider, role: row.role })) } },
  })
  expect(await leerTabla()).toEqual(foto)
  expect(await prisma.aiAgentModelPair.count({ where: { updatedBy: userId } })).toBe(0)
  if (userId !== '') await prisma.user.delete({ where: { id: userId } })
  if (roleId !== '') await prisma.role.delete({ where: { id: roleId } })
  if (documentTypeCode !== '') await prisma.documentType.delete({ where: { code: documentTypeCode } })
  if (companyId !== '') await prisma.company.delete({ where: { id: companyId } })
})

describe('ai-model-pair-prisma', () => {
  it('R5: list trae los ocho pares sembrados, uno por proveedor y rol, con principal y respaldo', async () => {
    const list = await pairs.list()
    expect(list.map((pair) => `${pair.provider}:${pair.role}`)).toEqual([
      'ANTHROPIC:AGENT',
      'ANTHROPIC:ROUTER',
      'GOOGLE:AGENT',
      'GOOGLE:ROUTER',
      'OPENAI:AGENT',
      'OPENAI:ROUTER',
      'OPENROUTER:AGENT',
      'OPENROUTER:ROUTER',
    ])
    for (const pair of list) {
      expect(pair.primaryModelId.length).toBeGreaterThan(0)
      expect(pair.fallbackModelId.length).toBeGreaterThan(0)
      expect(pair.updatedAt).toBeInstanceOf(Date)
    }
  })

  it('R5: get devuelve el par de ese proveedor y rol', async () => {
    expect(await pairs.get('ANTHROPIC', 'ROUTER')).toMatchObject({
      provider: 'ANTHROPIC',
      role: 'ROUTER',
      primaryModelId: 'claude-haiku-5-5',
      fallbackModelId: 'claude-sonnet-5-5',
    })
  })

  it('R5: get de un par que falta devuelve null', async () => {
    const original = await prisma.aiAgentModelPair.delete({
      where: { provider_role: { provider: 'OPENAI', role: 'AGENT' } },
    })
    try {
      expect(await pairs.get('OPENAI', 'AGENT')).toBeNull()
    } finally {
      await prisma.aiAgentModelPair.create({ data: original })
    }
  })

  it('R12: save reemplaza el par de ese proveedor y rol con autor y hora, y deja los demas intactos', async () => {
    const antes = await leerTabla()
    const inicio = Date.now()
    const saved = await pairs.save(
      { provider: 'GOOGLE', role: 'AGENT', primaryModelId: 'gemini-3.8-flash', fallbackModelId: 'gemini-4-argon' },
      userId,
    )

    expect(saved).toMatchObject({
      provider: 'GOOGLE',
      role: 'AGENT',
      primaryModelId: 'gemini-3.8-flash',
      fallbackModelId: 'gemini-4-argon',
      updatedBy: userId,
    })
    expect(saved.updatedAt.getTime()).toBeGreaterThanOrEqual(inicio - 1000)
    expect(await pairs.get('GOOGLE', 'AGENT')).toEqual(saved)

    const despues = await leerTabla()
    const otros = (rows: typeof antes) => rows.filter((row) => !(row.provider === 'GOOGLE' && row.role === 'AGENT'))
    expect(otros(despues)).toEqual(otros(antes))
    expect(despues).toHaveLength(antes.length)
  })

  it('R12: save de un par que falta lo crea', async () => {
    const original = await prisma.aiAgentModelPair.delete({
      where: { provider_role: { provider: 'OPENROUTER', role: 'ROUTER' } },
    })
    try {
      const saved = await pairs.save(
        {
          provider: 'OPENROUTER',
          role: 'ROUTER',
          primaryModelId: 'google/gemini-3.8-flash',
          fallbackModelId: 'anthropic/claude-haiku-5.5',
        },
        userId,
      )
      expect(saved.updatedBy).toBe(userId)
      expect(await prisma.aiAgentModelPair.count()).toBe(foto.length)
    } finally {
      await prisma.aiAgentModelPair.update({
        where: { provider_role: { provider: 'OPENROUTER', role: 'ROUTER' } },
        data: original,
      })
    }
  })

  it('R5: la base sigue cortando lo que el caso de uso deja pasar por error (otro proveedor, iguales)', async () => {
    const otroProveedor = await errorOf(
      pairs.save({ provider: 'GOOGLE', role: 'AGENT', primaryModelId: 'claude-sonnet-5-5', fallbackModelId: 'gemini-4-argon' }, userId),
    )
    expect(otroProveedor).toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
    const iguales = await errorOf(
      pairs.save({ provider: 'GOOGLE', role: 'AGENT', primaryModelId: 'gemini-4-argon', fallbackModelId: 'gemini-4-argon' }, userId),
    )
    expect(iguales).toBeInstanceOf(Error)
  })
})
