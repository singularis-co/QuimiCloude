// Las restricciones de `whatsapp_contacts` y `whatsapp_messages` y el resolutor de empresa del
// webhook contra Postgres REAL.
//
// Aislamiento: `commit`. `companyOfWhatsappConnection` lee con el cliente Prisma GLOBAL, asi que
// solo ve filas confirmadas; las altas que la base debe rechazar no dejan nada. Cada caso fabrica su
// empresa efimera (tipo de documento, rol, empresa, usuario y conexion) y `afterAll` borra
// mensajes -> contactos -> conexiones por `company_id`, afirma contando que no queda nada y despues
// borra usuario -> rol -> tipo de documento -> empresa.

import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { insertWhatsappConnection } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-connection-prisma'
import { companyOfWhatsappConnection } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-webhook-directory-prisma'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

type Empresa = {
  readonly companyId: string
  readonly userId: string
  readonly roleId: string
  readonly documentTypeCode: string
  readonly connectionId: string
}

const empresas: Empresa[] = []

/** Una conexion borrada se siembra ya borrada: el unico parcial solo admite una viva por empresa. */
async function conexionBorrada(companyId: string, userId: string): Promise<string> {
  const row = await prisma.whatsappConnection.create({
    data: {
      id: randomUUID(),
      companyId,
      displayName: 'Ventas antigua',
      wabaId: `waba-${token()}`,
      phoneNumberId: `phone-${token()}`,
      accessTokenEnc: 'v1:valor-cifrado-de-prueba',
      appSecretEnc: 'v1:otro-valor-cifrado',
      verifyTokenHash: 'a'.repeat(64),
      createdById: userId,
      deletedAt: new Date('2026-10-10T00:00:00.000Z'),
    },
    select: { id: true },
  })
  return row.id
}

async function nuevaConexion(companyId: string, userId: string): Promise<string> {
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
  const companyName = `Empresa mensajes ${marker}`
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
    connectionId: await nuevaConexion(company.id, user.id),
  }
  empresas.push(empresa)
  return empresa
}

afterAll(async () => {
  const ids = empresas.map((empresa) => empresa.companyId)
  const enEmpresas = { where: { companyId: { in: ids } } }
  await prisma.whatsappMessage.deleteMany(enEmpresas)
  await prisma.whatsappContact.deleteMany(enEmpresas)
  await prisma.whatsappConnection.deleteMany(enEmpresas)
  expect(await prisma.whatsappMessage.count(enEmpresas)).toBe(0)
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

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('se esperaba que la base rechazara el alta y no lo hizo')
}

/** El codigo de Prisma de un rechazo de la base: P2002 (unico) o P2003 (FK). */
async function codigoDeRechazo(promise: Promise<unknown>): Promise<string> {
  const error = await errorOf(promise)
  expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
  return (error as Prisma.PrismaClientKnownRequestError).code
}

function contacto(empresa: Pick<Empresa, 'companyId' | 'connectionId'>, waId = `57300${token().slice(0, 8)}`) {
  return prisma.whatsappContact.create({
    data: { companyId: empresa.companyId, connectionId: empresa.connectionId, waId },
  })
}

type MensajeDatos = {
  readonly companyId: string
  readonly connectionId: string
  readonly contactId: string
  readonly wamid?: string | null
}

function mensaje(datos: MensajeDatos) {
  return prisma.whatsappMessage.create({
    data: {
      companyId: datos.companyId,
      connectionId: datos.connectionId,
      contactId: datos.contactId,
      direction: 'IN',
      wamid: datos.wamid === undefined ? `wamid.restricciones-${token()}` : datos.wamid,
      type: 'TEXT',
      body: 'hola',
      status: 'RECEIVED',
    },
  })
}

describe('R28: whatsapp_contacts', () => {
  it('R28: company_id obligatorio, customer_id opcional y RLS activada y forzada', async () => {
    const columnas = await prisma.$queryRaw<{ column_name: string; is_nullable: string }[]>`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'whatsapp_contacts'
        AND column_name IN ('company_id', 'customer_id')
      ORDER BY column_name`
    expect(columnas).toEqual([
      { column_name: 'company_id', is_nullable: 'NO' },
      { column_name: 'customer_id', is_nullable: 'YES' },
    ])
    const rls = await prisma.$queryRaw<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE relname = 'whatsapp_contacts' AND relnamespace = 'public'::regnamespace`
    expect(rls).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }])
  })

  it('R28: el mismo wa_id en la misma conexion choca con el unico; en otra conexion entra', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const waId = `57300${token().slice(0, 8)}`
    const creado = await contacto(a, waId)
    expect(creado.customerId).toBeNull()

    expect(await codigoDeRechazo(contacto(a, waId))).toBe('P2002')
    await expect(contacto(b, waId)).resolves.toMatchObject({ waId, companyId: b.companyId })
    expect(await prisma.whatsappContact.count({ where: { companyId: a.companyId } })).toBe(1)
  })

  it('R28: un wa_id vacio lo rechaza el CHECK', async () => {
    const a = await crearEmpresa()
    await expect(contacto(a, '')).rejects.toThrow(/whatsapp_contacts_wa_id_not_empty|23514|check/i)
    expect(await prisma.whatsappContact.count({ where: { companyId: a.companyId } })).toBe(0)
  })
})

describe('R29: whatsapp_messages', () => {
  it('R29: company_id obligatorio, indice (connection_id, contact_id, meta_timestamp) y RLS activada y forzada', async () => {
    const columna = await prisma.$queryRaw<{ is_nullable: string }[]>`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'whatsapp_messages' AND column_name = 'company_id'`
    expect(columna).toEqual([{ is_nullable: 'NO' }])
    const indices = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'whatsapp_messages'
        AND indexname IN ('whatsapp_messages_connection_contact_ts_idx', 'whatsapp_messages_wamid_key')
      ORDER BY indexname`
    expect(indices).toEqual([
      {
        indexname: 'whatsapp_messages_connection_contact_ts_idx',
        indexdef:
          'CREATE INDEX whatsapp_messages_connection_contact_ts_idx ON public.whatsapp_messages ' +
          'USING btree (connection_id, contact_id, meta_timestamp)',
      },
      {
        indexname: 'whatsapp_messages_wamid_key',
        indexdef: 'CREATE UNIQUE INDEX whatsapp_messages_wamid_key ON public.whatsapp_messages USING btree (wamid)',
      },
    ])
    const rls = await prisma.$queryRaw<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE relname = 'whatsapp_messages' AND relnamespace = 'public'::regnamespace`
    expect(rls).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }])
  })

  it('R29: el wamid es unico, y varios mensajes sin wamid conviven', async () => {
    const a = await crearEmpresa()
    const c = await contacto(a)
    const base = { companyId: a.companyId, connectionId: a.connectionId, contactId: c.id }
    const wamid = `wamid.unico-${token()}`

    const guardado = await mensaje({ ...base, wamid })
    expect(guardado).toMatchObject({
      origin: null,
      sentById: null,
      templateName: null,
      attempts: 0,
      queueMessageId: null,
      errorCode: null,
      errorReason: null,
      payload: {},
    })
    expect(await codigoDeRechazo(mensaje({ ...base, wamid }))).toBe('P2002')
    await mensaje({ ...base, wamid: null })
    await mensaje({ ...base, wamid: null })
    expect(await prisma.whatsappMessage.count({ where: { companyId: a.companyId } })).toBe(3)
  })
})

describe('R30: la empresa de un contacto o un mensaje es la de su conexion y su contacto', () => {
  it('R30: un contacto con la empresa B y la conexion de A lo rechaza la FK compuesta', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()

    expect(await codigoDeRechazo(contacto({ companyId: b.companyId, connectionId: a.connectionId }))).toBe('P2003')
    expect(await prisma.whatsappContact.count({ where: { connectionId: a.connectionId } })).toBe(0)
  })

  it('R30: un mensaje con la empresa B y la conexion y el contacto de A lo rechaza la FK compuesta', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const c = await contacto(a)

    expect(
      await codigoDeRechazo(mensaje({ companyId: b.companyId, connectionId: a.connectionId, contactId: c.id })),
    ).toBe('P2003')
    expect(await prisma.whatsappMessage.count({ where: { connectionId: a.connectionId } })).toBe(0)
  })

  it('R30: un mensaje de B con el contacto de A lo rechaza la FK del contacto', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const deA = await contacto(a)

    expect(
      await codigoDeRechazo(mensaje({ companyId: b.companyId, connectionId: b.connectionId, contactId: deA.id })),
    ).toBe('P2003')
    expect(await prisma.whatsappMessage.count({ where: { companyId: b.companyId } })).toBe(0)
  })

  it('R30: un mensaje con el contacto de otra conexion de la misma empresa lo rechaza la FK del contacto', async () => {
    const a = await crearEmpresa()
    const otraConexion = await conexionBorrada(a.companyId, a.userId)
    const deLaOtra = await contacto({ companyId: a.companyId, connectionId: otraConexion })

    expect(
      await codigoDeRechazo(mensaje({ companyId: a.companyId, connectionId: a.connectionId, contactId: deLaOtra.id })),
    ).toBe('P2003')
    expect(await prisma.whatsappMessage.count({ where: { companyId: a.companyId } })).toBe(0)
  })

  it('R30 (control): con empresa, conexion y contacto coherentes el mensaje entra', async () => {
    const a = await crearEmpresa()
    const c = await contacto(a)

    await expect(
      mensaje({ companyId: a.companyId, connectionId: a.connectionId, contactId: c.id }),
    ).resolves.toMatchObject({ companyId: a.companyId, contactId: c.id })
  })
})

describe('R32: el resolutor de empresa del webhook', () => {
  it('R32: una conexion viva devuelve solo el id de su empresa', async () => {
    const a = await crearEmpresa()

    expect(await companyOfWhatsappConnection(a.connectionId)).toBe(a.companyId)
  })

  it('R32: una conexion borrada o un id inexistente devuelven null', async () => {
    const a = await crearEmpresa()
    const borrada = await conexionBorrada(a.companyId, a.userId)

    expect(await companyOfWhatsappConnection(borrada)).toBeNull()
    expect(await companyOfWhatsappConnection(randomUUID())).toBeNull()
  })
})
