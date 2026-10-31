// El modo de la conversación (`findMode`, `setMode` del repositorio de contactos) contra Postgres
// REAL, y los tres casos de uso del modo sobre ese repositorio.
//
// Aislamiento: `commit`. El repositorio usa el cliente Prisma GLOBAL, no un `tx` inyectado, y los
// cambios simultáneos al mismo destino necesitan conexiones distintas de verdad: una transacción de
// test con ROLLBACK sería aislamiento de mentira. Cada empresa efímera (empresa, rol, tipo de
// documento, usuario, conexión) y sus contactos se borran en `afterAll`, en el orden de las FK, y
// se afirma contando que no queda ningún contacto ni conexión de esas empresas.

import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
import { insertWhatsappConnection } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-connection-prisma'
import { createWhatsappContactRepository } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-contact-prisma'
import { createGetWhatsappConversationMode } from '@/lib/modules/integraciones/domain/get-whatsapp-conversation-mode'
import { createHandOffWhatsappConversation } from '@/lib/modules/integraciones/domain/hand-off-whatsapp-conversation'
import { createReturnWhatsappConversationToAgent } from '@/lib/modules/integraciones/domain/return-whatsapp-conversation-to-agent'
import { prisma } from '@/lib/shared/db/prisma'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'
import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

type Empresa = {
  readonly companyId: string
  readonly userId: string
  readonly roleId: string
  readonly documentTypeCode: string
  readonly connectionId: string
  readonly scope: IntegracionesScope
  readonly actor: Actor
}

const empresas: Empresa[] = []

async function conexion(companyId: string, userId: string): Promise<string> {
  const id = randomUUID()
  await insertWhatsappConnection(
    {
      id,
      origin: 'MANUAL',
      displayName: 'Ventas',
      wabaId: `waba-${token()}`,
      phoneNumberId: `phone-${token()}`,
      displayPhoneNumber: '+57 300 1234567',
      verifiedName: 'Empresa Verificada',
      accessTokenEnc: 'v1:valor-cifrado-de-prueba',
      appSecretEnc: 'v1:otro-valor-cifrado',
      verifyTokenHash: 'a'.repeat(64),
      status: 'ACTIVE',
      lastError: null,
      lastCheckedAt: new Date('2026-10-09T12:00:00.000Z'),
      createdById: userId,
    },
    { companyId },
  )
  return id
}

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
  const companyName = `Empresa modo conversacion ${marker}`
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
    connectionId: await conexion(company.id, user.id),
    scope: { companyId: company.id },
    actor: {
      id: user.id,
      companyId: company.id,
      permissions: ['whatsapp.consultar', 'whatsapp.enviar'],
      addons: ['integraciones', 'agente_ia_whatsapp'],
    },
  }
  empresas.push(empresa)
  return empresa
}

function digitos(n: number): string {
  return String(Math.floor(Math.random() * 10 ** n)).padStart(n, '0')
}

async function contacto(empresa: Empresa, lastMessageAt: Date | null = null): Promise<string> {
  const { id } = await prisma.whatsappContact.create({
    data: { companyId: empresa.companyId, connectionId: empresa.connectionId, waId: `57300${digitos(7)}`, lastMessageAt },
    select: { id: true },
  })
  return id
}

function columnasDeModo(contactId: string) {
  return prisma.whatsappContact.findUniqueOrThrow({
    where: { id: contactId },
    select: {
      conversationMode: true,
      conversationModeReason: true,
      conversationModeChangedAt: true,
      conversationModeChangedBy: true,
    },
  })
}

const repo = createWhatsappContactRepository()
const AT = new Date('2026-10-30T15:00:00.000Z')
const LUEGO = new Date('2026-10-30T18:00:00.000Z')

let A: Empresa
let B: Empresa

beforeAll(async () => {
  A = await crearEmpresa()
  B = await crearEmpresa()
})

afterAll(async () => {
  const enEmpresas = { where: { companyId: { in: empresas.map((empresa) => empresa.companyId) } } }
  await prisma.whatsappContact.deleteMany(enEmpresas)
  await prisma.whatsappConnection.deleteMany(enEmpresas)
  expect(await prisma.whatsappContact.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappConnection.count(enEmpresas)).toBe(0)
  for (const empresa of empresas) {
    await prisma.user.delete({ where: { id: empresa.userId } })
    await prisma.role.delete({ where: { id: empresa.roleId } })
    await prisma.documentType.delete({ where: { code: empresa.documentTypeCode } })
    await prisma.company.delete({ where: { id: empresa.companyId } })
  }
  await prisma.$disconnect()
})

describe('repositorio: modo de la conversación', () => {
  it('R19, R28 — un contacto nuevo se lee en AGENT, sin motivo ni fecha, con su último mensaje', async () => {
    const ultimo = new Date('2026-10-29T10:00:00.000Z')
    const id = await contacto(A, ultimo)
    expect(await repo.findMode(id, A.scope)).toEqual({ mode: 'AGENT', reason: null, changedAt: null, lastMessageAt: ultimo })
  })

  it('R20, R22 — setMode a HUMAN cambia y guarda motivo, fecha y usuario', async () => {
    const id = await contacto(A)
    expect(await repo.setMode(id, { mode: 'HUMAN', reason: 'MANUAL', at: AT, by: A.userId }, A.scope)).toBe('changed')
    expect(await columnasDeModo(id)).toEqual({
      conversationMode: 'HUMAN',
      conversationModeReason: 'MANUAL',
      conversationModeChangedAt: AT,
      conversationModeChangedBy: A.userId,
    })
    expect(await repo.findMode(id, A.scope)).toEqual({ mode: 'HUMAN', reason: 'MANUAL', changedAt: AT, lastMessageAt: null })
  })

  it('R20 — un cambio del sistema guarda el usuario nulo', async () => {
    const id = await contacto(A)
    expect(await repo.setMode(id, { mode: 'HUMAN', reason: 'LOW_CONFIDENCE', at: AT, by: null }, A.scope)).toBe('changed')
    expect(await columnasDeModo(id)).toEqual({
      conversationMode: 'HUMAN',
      conversationModeReason: 'LOW_CONFIDENCE',
      conversationModeChangedAt: AT,
      conversationModeChangedBy: null,
    })
  })

  it('R23 — ya en el destino devuelve unchanged sin tocar motivo, fecha ni usuario', async () => {
    const id = await contacto(A)
    await repo.setMode(id, { mode: 'HUMAN', reason: 'COMPLAINT', at: AT, by: null }, A.scope)
    expect(await repo.setMode(id, { mode: 'HUMAN', reason: 'MANUAL', at: LUEGO, by: A.userId }, A.scope)).toBe('unchanged')
    expect(await columnasDeModo(id)).toEqual({
      conversationMode: 'HUMAN',
      conversationModeReason: 'COMPLAINT',
      conversationModeChangedAt: AT,
      conversationModeChangedBy: null,
    })
  })

  it('R25 — un contacto que nunca cambió ya está en AGENT: unchanged y sigue sin motivo ni fecha', async () => {
    const id = await contacto(A)
    expect(await repo.setMode(id, { mode: 'AGENT', reason: 'MANUAL', at: AT, by: A.userId }, A.scope)).toBe('unchanged')
    expect(await columnasDeModo(id)).toEqual({
      conversationMode: 'AGENT',
      conversationModeReason: null,
      conversationModeChangedAt: null,
      conversationModeChangedBy: null,
    })
  })

  it('R24 — de HUMAN a AGENT cambia con el motivo, la fecha y el usuario nuevos', async () => {
    const id = await contacto(A)
    await repo.setMode(id, { mode: 'HUMAN', reason: 'AI_ERROR', at: AT, by: null }, A.scope)
    expect(await repo.setMode(id, { mode: 'AGENT', reason: 'MANUAL', at: LUEGO, by: A.userId }, A.scope)).toBe('changed')
    expect(await columnasDeModo(id)).toEqual({
      conversationMode: 'AGENT',
      conversationModeReason: 'MANUAL',
      conversationModeChangedAt: LUEGO,
      conversationModeChangedBy: A.userId,
    })
  })

  it('R23 — ocho cambios simultáneos al mismo destino: uno cambia, los demás no pisan su motivo ni su fecha', async () => {
    const id = await contacto(A)
    const fechas = Array.from({ length: 8 }, (_, i) => new Date(AT.getTime() + i * 60_000))
    const resultados = await Promise.all(
      fechas.map((at, i) =>
        repo.setMode(id, { mode: 'HUMAN', reason: i % 2 === 0 ? 'MANUAL' : 'USER_REPLY', at, by: A.userId }, A.scope),
      ),
    )
    expect(resultados.filter((r) => r === 'changed')).toHaveLength(1)
    expect(resultados.filter((r) => r === 'unchanged')).toHaveLength(7)
    const ganador = resultados.indexOf('changed')
    expect(await columnasDeModo(id)).toEqual({
      conversationMode: 'HUMAN',
      conversationModeReason: ganador % 2 === 0 ? 'MANUAL' : 'USER_REPLY',
      conversationModeChangedAt: fechas[ganador],
      conversationModeChangedBy: A.userId,
    })
  })

  it('R27 — un contacto de otra empresa no se lee ni se escribe: null y not_found', async () => {
    const deB = await contacto(B)
    expect(await repo.findMode(deB, A.scope)).toBeNull()
    expect(await repo.setMode(deB, { mode: 'HUMAN', reason: 'MANUAL', at: AT, by: A.userId }, A.scope)).toBe('not_found')
    expect(await columnasDeModo(deB)).toEqual({
      conversationMode: 'AGENT',
      conversationModeReason: null,
      conversationModeChangedAt: null,
      conversationModeChangedBy: null,
    })
  })

  it('R27 — un id que no existe: null y not_found', async () => {
    const id = randomUUID()
    expect(await repo.findMode(id, A.scope)).toBeNull()
    expect(await repo.setMode(id, { mode: 'HUMAN', reason: 'MANUAL', at: AT, by: A.userId }, A.scope)).toBe('not_found')
  })
})

describe('casos de uso del modo sobre Postgres', () => {
  const deps = { contacts: repo, now: () => AT }
  const handOff = createHandOffWhatsappConversation(deps)
  const giveBack = createReturnWhatsappConversationToAgent({ ...deps, now: () => LUEGO })
  const getMode = createGetWhatsappConversationMode(deps)

  it('R22, R24, R28 — pasar a humano, consultar, devolver al agente y consultar otra vez', async () => {
    const id = await contacto(A)
    expect(await getMode({ contactId: id }, A.actor)).toEqual({ mode: 'AGENT', reason: null, changedAt: null })

    await handOff({ contactId: id }, A.actor)
    expect(await getMode({ contactId: id }, A.actor)).toEqual({ mode: 'HUMAN', reason: 'MANUAL', changedAt: AT })
    expect((await columnasDeModo(id)).conversationModeChangedBy).toBe(A.userId)

    await giveBack({ contactId: id }, A.actor)
    expect(await getMode({ contactId: id }, A.actor)).toEqual({ mode: 'AGENT', reason: 'MANUAL', changedAt: LUEGO })
  })

  it('R23 — pasar a humano dos veces a la vez no falla y deja un solo cambio', async () => {
    const id = await contacto(A)
    const pasar = createHandOffWhatsappConversation({ contacts: repo, now: () => new Date() })
    await expect(Promise.all([pasar({ contactId: id }, A.actor), pasar({ contactId: id }, A.actor)])).resolves.toEqual([
      undefined,
      undefined,
    ])
    expect((await columnasDeModo(id)).conversationMode).toBe('HUMAN')
  })

  it('R27 — el contacto de otra empresa responde no encontrado y queda intacto', async () => {
    const deB = await contacto(B)
    await expect(handOff({ contactId: deB }, A.actor)).rejects.toMatchObject({ code: 'whatsapp_contact_not_found' })
    await expect(getMode({ contactId: deB }, A.actor)).rejects.toMatchObject({ code: 'whatsapp_contact_not_found' })
    expect((await columnasDeModo(deB)).conversationMode).toBe('AGENT')
  })
})
