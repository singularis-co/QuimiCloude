// El repositorio de plantillas de WhatsApp contra Postgres REAL.
//
// Aislamiento: `commit`. Las funciones de `whatsapp-template-prisma.ts` usan el cliente Prisma
// GLOBAL, no un `tx` inyectado, y `applyWhatsappTemplateSync` abre su propia transaccion: una
// transaccion de test con ROLLBACK seria aislamiento de mentira. Cada empresa efimera (empresa, rol,
// tipo de documento, usuario y conexion) y sus plantillas se borran en `afterAll`, en el orden de
// las FK, y se afirma contando que no queda ninguna plantilla ni conexion de esas empresas.

import { randomUUID } from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'

import { insertWhatsappConnection } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-connection-prisma'
import {
  applyWhatsappTemplateSync,
  applyWhatsappTemplateWebhookUpdates,
  findLiveWhatsappTemplateById,
  findLiveWhatsappTemplateByNameAndLanguage,
  insertCreatedWhatsappTemplate,
  listLiveWhatsappTemplates,
  listWhatsappTemplatesForSync,
  markWhatsappTemplateDeleted,
  replaceWhatsappTemplateVariables,
  setWhatsappTemplateEnabled,
} from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-template-prisma'
import { WhatsappTemplateNameTakenError } from '@/lib/modules/integraciones/domain/errors'
import {
  planTemplateSync,
  type TemplateSyncInsert,
  type TemplateSyncPlan,
  type TemplateSyncUpdate,
} from '@/lib/modules/integraciones/domain/template-sync-plan'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'
import type { WhatsappTemplateRecord } from '@/lib/modules/integraciones/domain/whatsapp-template'
import type { TemplateVariableBinding } from '@/lib/modules/integraciones/domain/whatsapp-template-variables'
import type { MetaTemplateSnapshot } from '@/lib/modules/integraciones/domain/whatsapp-template-meta'
import type { NewCreatedTemplateRow } from '@/lib/modules/integraciones/ports/whatsapp-template-repository'

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
  const companyName = `Empresa plantillas ${marker}`
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
  const scope = { companyId: company.id }
  const connection = await insertWhatsappConnection(
    {
      id: randomUUID(),
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
      lastCheckedAt: null,
      createdById: user.id,
    },
    scope,
  )
  const empresa: Empresa = {
    companyId: company.id,
    userId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    connectionId: connection.id,
    scope,
  }
  empresas.push(empresa)
  return empresa
}

let metaCounter = 0
function metaId(): string {
  metaCounter += 1
  return `${String(Date.now())}${String(metaCounter).padStart(4, '0')}`
}

function filaCreada(empresa: Empresa, overrides: Partial<NewCreatedTemplateRow> = {}): NewCreatedTemplateRow {
  return {
    metaTemplateId: metaId(),
    name: `plantilla_${token().slice(0, 10)}`,
    language: 'es',
    category: 'UTILITY',
    components: [{ type: 'BODY', text: 'Hola' }],
    status: 'PENDING',
    createdById: empresa.userId,
    lastSyncedAt: new Date('2026-10-20T10:00:00.000Z'),
    variables: [],
    mappingStatus: 'MAPPED',
    enabled: true,
    ...overrides,
  }
}

async function crear(
  fila: NewCreatedTemplateRow,
  connectionId: string,
  scope: IntegracionesScope,
): Promise<WhatsappTemplateRecord> {
  return (await insertCreatedWhatsappTemplate(fila, connectionId, scope)).record
}

function snapshot(overrides: Partial<MetaTemplateSnapshot> = {}): MetaTemplateSnapshot {
  return {
    metaTemplateId: metaId(),
    name: `meta_${token().slice(0, 10)}`,
    language: 'es',
    category: 'MARKETING',
    status: 'APPROVED',
    statusRaw: null,
    rejectedReason: null,
    components: [{ type: 'BODY', text: 'Desde Meta' }],
    ...overrides,
  }
}

const VACIO: TemplateSyncPlan = { inserts: [], updates: [], deletes: [] }

/** Una puesta al dia sin reinicio de variables, salvo que `extra` diga otra cosa. */
function puesta(
  id: string,
  template: MetaTemplateSnapshot,
  changed: boolean,
  extra: Partial<TemplateSyncUpdate> = {},
): TemplateSyncUpdate {
  return { id, template, changed, resetVariables: false, mappingStatusAfterReset: 'MAPPED', enabledAfterReset: true, ...extra }
}

function importada(template: MetaTemplateSnapshot, extra: Partial<TemplateSyncInsert> = {}): TemplateSyncInsert {
  return { template, mappingStatus: 'MAPPED', enabled: true, ...extra }
}

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('se esperaba un error y no se lanzo')
}

afterAll(async () => {
  const ids = empresas.map((empresa) => empresa.companyId)
  await prisma.whatsappTemplateVariable.deleteMany({ where: { companyId: { in: ids } } })
  await prisma.whatsappVariableKey.deleteMany({ where: { companyId: { in: ids } } })
  await prisma.whatsappTemplate.deleteMany({ where: { companyId: { in: ids } } })
  await prisma.whatsappConnection.deleteMany({ where: { companyId: { in: ids } } })
  expect(await prisma.whatsappTemplateVariable.count({ where: { companyId: { in: ids } } })).toBe(0)
  expect(await prisma.whatsappVariableKey.count({ where: { companyId: { in: ids } } })).toBe(0)
  expect(await prisma.whatsappTemplate.count({ where: { companyId: { in: ids } } })).toBe(0)
  expect(await prisma.whatsappConnection.count({ where: { companyId: { in: ids } } })).toBe(0)
  for (const empresa of empresas) {
    await prisma.user.delete({ where: { id: empresa.userId } })
    await prisma.role.delete({ where: { id: empresa.roleId } })
    await prisma.documentType.delete({ where: { code: empresa.documentTypeCode } })
    await prisma.company.delete({ where: { id: empresa.companyId } })
  }
  await prisma.$disconnect()
})

describe('R1: la plantilla va con su empresa y su conexion', () => {
  it('R1 — el alta guarda la empresa del ambito, la conexion, el creador y PENDING', async () => {
    const a = await crearEmpresa()
    const fila = filaCreada(a)

    const creada = await crear(fila, a.connectionId, a.scope)

    expect(creada).toMatchObject({
      companyId: a.companyId,
      connectionId: a.connectionId,
      metaTemplateId: fila.metaTemplateId,
      name: fila.name,
      language: 'es',
      category: 'UTILITY',
      components: fila.components,
      status: 'PENDING',
      statusRaw: null,
      rejectedReason: null,
      createdById: a.userId,
      deletedAt: null,
    })
    expect(creada.lastSyncedAt).toEqual(fila.lastSyncedAt)
    expect(await findLiveWhatsappTemplateById(creada.id, a.scope)).toEqual(creada)
  })

  it('R1 — la base rechaza una plantilla cuya empresa no es la de su conexion', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()

    const error = await errorOf(
      prisma.whatsappTemplate.create({
        data: {
          companyId: b.companyId,
          connectionId: a.connectionId,
          metaTemplateId: metaId(),
          name: 'cruzada',
          language: 'es',
          category: 'UTILITY',
          status: 'PENDING',
        },
      }),
    )
    expect(error).toBeInstanceOf(Error)
    expect(await prisma.whatsappTemplate.count({ where: { connectionId: a.connectionId, name: 'cruzada' } })).toBe(0)
  })

  it('R1 — el alta con el ambito de otra empresa que la conexion no deja fila', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()

    await expect(insertCreatedWhatsappTemplate(filaCreada(b), a.connectionId, b.scope)).rejects.toThrow()
    expect(await prisma.whatsappTemplate.count({ where: { connectionId: a.connectionId } })).toBe(0)
  })
})

describe('R2: unicos de nombre e idioma entre vivas, y de id de Meta por conexion', () => {
  it('R2 — dos vivas con la misma conexion, nombre e idioma no entran: el alta lanza WhatsappTemplateNameTakenError', async () => {
    const a = await crearEmpresa()
    await crear(filaCreada(a, { name: 'duplicada' }), a.connectionId, a.scope)

    const error = await errorOf(
      insertCreatedWhatsappTemplate(filaCreada(a, { name: 'duplicada' }), a.connectionId, a.scope),
    )
    expect(error).toBeInstanceOf(WhatsappTemplateNameTakenError)
    expect(await prisma.whatsappTemplate.count({ where: { connectionId: a.connectionId, name: 'duplicada' } })).toBe(1)
  })

  it('R2 — el mismo nombre en otro idioma si entra', async () => {
    const a = await crearEmpresa()
    await crear(filaCreada(a, { name: 'bilingue', language: 'es' }), a.connectionId, a.scope)
    await crear(filaCreada(a, { name: 'bilingue', language: 'en' }), a.connectionId, a.scope)

    expect(await prisma.whatsappTemplate.count({ where: { connectionId: a.connectionId, name: 'bilingue' } })).toBe(2)
  })

  it('R2 — una eliminada no bloquea una nueva viva con el mismo nombre e idioma', async () => {
    const a = await crearEmpresa()
    const vieja = await crear(filaCreada(a, { name: 'renacida' }), a.connectionId, a.scope)
    expect(await markWhatsappTemplateDeleted(vieja.id, new Date(), a.scope)).toBe(true)

    const nueva = await crear(filaCreada(a, { name: 'renacida' }), a.connectionId, a.scope)

    expect(nueva.id).not.toBe(vieja.id)
    expect((await findLiveWhatsappTemplateByNameAndLanguage(a.connectionId, 'renacida', 'es', a.scope))?.id).toBe(nueva.id)
  })

  it('R2 — dos filas (aunque una este eliminada) con la misma conexion y el mismo id de Meta no entran', async () => {
    const a = await crearEmpresa()
    const vieja = await crear(filaCreada(a), a.connectionId, a.scope)
    await markWhatsappTemplateDeleted(vieja.id, new Date(), a.scope)

    const error = await errorOf(
      prisma.whatsappTemplate.create({
        data: {
          companyId: a.companyId,
          connectionId: a.connectionId,
          metaTemplateId: vieja.metaTemplateId,
          name: 'otro_nombre',
          language: 'es',
          category: 'UTILITY',
          status: 'PENDING',
        },
      }),
    )
    expect(error).toMatchObject({ code: 'P2002' })
  })
})

describe('R3: otra empresa se trata igual que una inexistente', () => {
  it('R3 — la empresa B no ve, no busca, no lista ni elimina las plantillas de A', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const deA = await crear(filaCreada(a, { name: 'de_a' }), a.connectionId, a.scope)

    expect(await findLiveWhatsappTemplateById(deA.id, b.scope)).toBeNull()
    expect(await findLiveWhatsappTemplateByNameAndLanguage(a.connectionId, 'de_a', 'es', b.scope)).toBeNull()
    expect(await listLiveWhatsappTemplates(a.connectionId, { onlyApproved: false }, b.scope)).toEqual([])
    expect(await listWhatsappTemplatesForSync(a.connectionId, b.scope)).toEqual([])
    expect(await markWhatsappTemplateDeleted(deA.id, new Date(), b.scope)).toBe(false)

    expect(await findLiveWhatsappTemplateById(deA.id, a.scope)).toEqual(deA)
  })

  it('R3 — un webhook con el ambito de B no cambia las plantillas de A y las cuenta como desconocidas', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const deA = await crear(filaCreada(a), a.connectionId, a.scope)

    const result = await applyWhatsappTemplateWebhookUpdates(
      a.connectionId,
      [
        { kind: 'status', metaTemplateId: deA.metaTemplateId, status: 'APPROVED', statusRaw: null, rejectedReason: null },
        { kind: 'category', metaTemplateId: deA.metaTemplateId, category: 'MARKETING' },
      ],
      b.scope,
    )

    expect(result).toEqual({ unknown: 2 })
    expect(await findLiveWhatsappTemplateById(deA.id, a.scope)).toMatchObject({ status: 'PENDING', category: 'UTILITY' })
  })

  it('R3 — una sincronizacion con el ambito de B no borra, no cambia ni anota nada de A', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const deA = await crear(filaCreada(a), a.connectionId, a.scope)
    const at = new Date()

    await applyWhatsappTemplateSync(
      a.connectionId,
      { inserts: [], updates: [puesta(deA.id, snapshot({ metaTemplateId: deA.metaTemplateId }), true)], deletes: [deA.id] },
      new Date(Date.now() + 60_000),
      at,
      b.scope,
    )

    expect(await findLiveWhatsappTemplateById(deA.id, a.scope)).toEqual(deA)
    const conexion = await prisma.whatsappConnection.findUniqueOrThrow({ where: { id: a.connectionId } })
    expect(conexion.templatesSyncedAt).toBeNull()
  })
})

describe('lectura de las vivas', () => {
  it('R3 — listLive ordena por nombre, idioma e id, deja fuera las eliminadas y filtra las aprobadas', async () => {
    const a = await crearEmpresa()
    const zeta = await crear(filaCreada(a, { name: 'zeta' }), a.connectionId, a.scope)
    const alfaEs = await crear(filaCreada(a, { name: 'alfa', language: 'es' }), a.connectionId, a.scope)
    const alfaEn = await crear(filaCreada(a, { name: 'alfa', language: 'en' }), a.connectionId, a.scope)
    const borrada = await crear(filaCreada(a, { name: 'beta' }), a.connectionId, a.scope)
    await markWhatsappTemplateDeleted(borrada.id, new Date(), a.scope)
    await applyWhatsappTemplateWebhookUpdates(
      a.connectionId,
      [{ kind: 'status', metaTemplateId: zeta.metaTemplateId, status: 'APPROVED', statusRaw: null, rejectedReason: null }],
      a.scope,
    )

    const todas = await listLiveWhatsappTemplates(a.connectionId, { onlyApproved: false }, a.scope)
    expect(todas.map((t) => t.id)).toEqual([alfaEn.id, alfaEs.id, zeta.id])
    const aprobadas = await listLiveWhatsappTemplates(a.connectionId, { onlyApproved: true }, a.scope)
    expect(aprobadas.map((t) => t.id)).toEqual([zeta.id])
  })

  it('R3 — markDeleted solo marca una viva: la segunda vez devuelve false', async () => {
    const a = await crearEmpresa()
    const t = await crear(filaCreada(a), a.connectionId, a.scope)
    const at = new Date('2026-10-20T12:00:00.000Z')

    expect(await markWhatsappTemplateDeleted(t.id, at, a.scope)).toBe(true)
    expect(await markWhatsappTemplateDeleted(t.id, new Date(), a.scope)).toBe(false)
    const fila = await prisma.whatsappTemplate.findUniqueOrThrow({ where: { id: t.id } })
    expect(fila.deletedAt).toEqual(at)
    expect(await findLiveWhatsappTemplateById(t.id, a.scope)).toBeNull()
  })
})

describe('R23-R25: aplicar una sincronizacion', () => {
  it('R23 — importa sin creador, pone al dia y revive, y anota la hora en todas, tambien en las que no cambian', async () => {
    const a = await crearEmpresa()
    const cambia = await crear(filaCreada(a, { name: 'cambia' }), a.connectionId, a.scope)
    const igual = await crear(filaCreada(a, { name: 'igual' }), a.connectionId, a.scope)
    const revive = await crear(filaCreada(a, { name: 'revive' }), a.connectionId, a.scope)
    await markWhatsappTemplateDeleted(revive.id, new Date(), a.scope)
    const nueva = snapshot({ name: 'importada' })
    const at = new Date('2026-10-20T15:00:00.000Z')

    await applyWhatsappTemplateSync(
      a.connectionId,
      {
        inserts: [importada(nueva)],
        updates: [
          puesta(cambia.id, snapshot({
              metaTemplateId: cambia.metaTemplateId,
              name: 'cambia',
              status: 'REJECTED',
              rejectedReason: 'INVALID_FORMAT',
              category: 'MARKETING',
            }), true),
          puesta(igual.id, snapshot({ metaTemplateId: igual.metaTemplateId, name: 'igual', status: 'PENDING', category: 'UTILITY' }), false),
          puesta(revive.id, snapshot({ metaTemplateId: revive.metaTemplateId, name: 'revive', status: 'OTHER', statusRaw: 'IN_APPEAL' }), true),
        ],
        deletes: [],
      },
      new Date(Date.now() + 60_000),
      at,
      a.scope,
    )

    const filas = await prisma.whatsappTemplate.findMany({ where: { connectionId: a.connectionId } })
    const porNombre = new Map(filas.map((fila) => [fila.name, fila]))
    expect(porNombre.get('importada')).toMatchObject({
      companyId: a.companyId,
      metaTemplateId: nueva.metaTemplateId,
      status: 'APPROVED',
      category: 'MARKETING',
      createdById: null,
      deletedAt: null,
      lastSyncedAt: at,
      components: nueva.components,
    })
    expect(porNombre.get('cambia')).toMatchObject({
      status: 'REJECTED',
      rejectedReason: 'INVALID_FORMAT',
      category: 'MARKETING',
      createdById: a.userId,
      lastSyncedAt: at,
    })
    expect(porNombre.get('igual')).toMatchObject({ status: 'PENDING', lastSyncedAt: at })
    expect(porNombre.get('revive')).toMatchObject({ status: 'OTHER', statusRaw: 'IN_APPEAL', deletedAt: null, lastSyncedAt: at })
  })

  it('R24 — marca eliminadas las que faltan, pero no una creada despues de que empezo la sincronizacion', async () => {
    const a = await crearEmpresa()
    const antigua = await crear(filaCreada(a, { name: 'antigua' }), a.connectionId, a.scope)
    const reciente = await crear(filaCreada(a, { name: 'reciente' }), a.connectionId, a.scope)
    // `created_at` lo pone el reloj de la base: se fija a mano para no depender de su desfase con el de la app.
    const startedAt = new Date('2026-10-20T12:00:00.000Z')
    await prisma.whatsappTemplate.update({ where: { id: antigua.id }, data: { createdAt: new Date('2026-10-20T11:59:59.000Z') } })
    await prisma.whatsappTemplate.update({ where: { id: reciente.id }, data: { createdAt: new Date('2026-10-20T12:00:01.000Z') } })
    const at = new Date('2026-10-20T12:00:05.000Z')

    await applyWhatsappTemplateSync(
      a.connectionId,
      { ...VACIO, deletes: [antigua.id, reciente.id] },
      startedAt,
      at,
      a.scope,
    )

    expect(await findLiveWhatsappTemplateById(antigua.id, a.scope)).toBeNull()
    const borrada = await prisma.whatsappTemplate.findUniqueOrThrow({ where: { id: antigua.id } })
    expect(borrada.deletedAt).toEqual(at)
    expect(borrada.lastSyncedAt).toEqual(at)
    expect(await findLiveWhatsappTemplateById(reciente.id, a.scope)).not.toBeNull()
  })

  it('R25 — anota la hora de la sincronizacion en la conexion', async () => {
    const a = await crearEmpresa()
    const at = new Date('2026-10-20T16:30:00.000Z')

    await applyWhatsappTemplateSync(a.connectionId, VACIO, new Date(), at, a.scope)

    const conexion = await prisma.whatsappConnection.findUniqueOrThrow({ where: { id: a.connectionId } })
    expect(conexion.templatesSyncedAt).toEqual(at)
  })

  it('R23 R24 — una borrada y vuelta a crear en Meta con el mismo nombre e idioma entra sin chocar', async () => {
    const a = await crearEmpresa()
    const vieja = await crear(filaCreada(a, { name: 'recreada' }), a.connectionId, a.scope)
    const recreada = snapshot({ name: 'recreada', language: 'es' })
    const locals = await listWhatsappTemplatesForSync(a.connectionId, a.scope)
    const plan = planTemplateSync({ locals, snapshots: [recreada], protectedIds: [] })
    expect(plan.deletes).toEqual([vieja.id])
    expect(plan.inserts).toEqual([importada(recreada)])

    await applyWhatsappTemplateSync(a.connectionId, plan, new Date(Date.now() + 60_000), new Date(), a.scope)

    const viva = await findLiveWhatsappTemplateByNameAndLanguage(a.connectionId, 'recreada', 'es', a.scope)
    expect(viva?.metaTemplateId).toBe(recreada.metaTemplateId)
    expect(await findLiveWhatsappTemplateById(vieja.id, a.scope)).toBeNull()
  })

  it('R22 — si un paso falla no queda nada escrito, ni las plantillas ni la hora de la conexion', async () => {
    const a = await crearEmpresa()
    const viva = await crear(filaCreada(a, { name: 'ocupada' }), a.connectionId, a.scope)
    const borrada = await crear(filaCreada(a, { name: 'ocupada', language: 'en' }), a.connectionId, a.scope)
    await markWhatsappTemplateDeleted(borrada.id, new Date(), a.scope)

    const error = await errorOf(
      applyWhatsappTemplateSync(
        a.connectionId,
        {
          inserts: [],
          updates: [
            puesta(viva.id, snapshot({ metaTemplateId: viva.metaTemplateId, name: 'ocupada', status: 'APPROVED' }), true),
            puesta(borrada.id, snapshot({ metaTemplateId: borrada.metaTemplateId, name: 'ocupada', language: 'es' }), true),
          ],
          deletes: [],
        },
        new Date(Date.now() + 60_000),
        new Date(),
        a.scope,
      ),
    )

    expect(error).toBeInstanceOf(Error)
    expect(await findLiveWhatsappTemplateById(viva.id, a.scope)).toMatchObject({ status: 'PENDING' })
    const conexion = await prisma.whatsappConnection.findUniqueOrThrow({ where: { id: a.connectionId } })
    expect(conexion.templatesSyncedAt).toBeNull()
  })
})

describe('la carrera del alta con la resincronizacion del webhook', () => {
  it('R23 — si la sincronizacion ya inserto ese id de Meta, el alta conserva su fila y su estado y solo pone el creador', async () => {
    const a = await crearEmpresa()
    const deMeta = snapshot({ name: 'carrera', status: 'APPROVED', category: 'UTILITY' })
    await applyWhatsappTemplateSync(a.connectionId, { ...VACIO, inserts: [importada(deMeta)] }, new Date(), new Date(), a.scope)

    const creada = await crear(
      filaCreada(a, { metaTemplateId: deMeta.metaTemplateId, name: 'carrera' }),
      a.connectionId,
      a.scope,
    )

    expect(creada).toMatchObject({ metaTemplateId: deMeta.metaTemplateId, status: 'APPROVED', createdById: a.userId })
    expect(await prisma.whatsappTemplate.count({ where: { connectionId: a.connectionId } })).toBe(1)
  })
})

describe('R36 R37: cambios del webhook', () => {
  it('R36 — el estado y el motivo de rechazo llegan a la viva con ese id de Meta; un id desconocido se cuenta', async () => {
    const a = await crearEmpresa()
    const t = await crear(filaCreada(a), a.connectionId, a.scope)

    const rechazo = await applyWhatsappTemplateWebhookUpdates(
      a.connectionId,
      [
        { kind: 'status', metaTemplateId: t.metaTemplateId, status: 'REJECTED', statusRaw: null, rejectedReason: 'INVALID_FORMAT' },
        { kind: 'status', metaTemplateId: '999999999999999', status: 'APPROVED', statusRaw: null, rejectedReason: null },
      ],
      a.scope,
    )
    expect(rechazo).toEqual({ unknown: 1 })
    expect(await findLiveWhatsappTemplateById(t.id, a.scope)).toMatchObject({ status: 'REJECTED', rejectedReason: 'INVALID_FORMAT' })

    await applyWhatsappTemplateWebhookUpdates(
      a.connectionId,
      [{ kind: 'status', metaTemplateId: t.metaTemplateId, status: 'OTHER', statusRaw: 'FLAGGED', rejectedReason: null }],
      a.scope,
    )
    expect(await findLiveWhatsappTemplateById(t.id, a.scope)).toMatchObject({
      status: 'OTHER',
      statusRaw: 'FLAGGED',
      rejectedReason: null,
    })
  })

  it('R37 — la categoria nueva llega a la viva; una eliminada no cambia y cuenta como desconocida', async () => {
    const a = await crearEmpresa()
    const viva = await crear(filaCreada(a), a.connectionId, a.scope)
    const borrada = await crear(filaCreada(a), a.connectionId, a.scope)
    await markWhatsappTemplateDeleted(borrada.id, new Date(), a.scope)

    const result = await applyWhatsappTemplateWebhookUpdates(
      a.connectionId,
      [
        { kind: 'category', metaTemplateId: viva.metaTemplateId, category: 'MARKETING' },
        { kind: 'category', metaTemplateId: borrada.metaTemplateId, category: 'MARKETING' },
      ],
      a.scope,
    )

    expect(result).toEqual({ unknown: 1 })
    expect(await findLiveWhatsappTemplateById(viva.id, a.scope)).toMatchObject({ category: 'MARKETING' })
    const fila = await prisma.whatsappTemplate.findUniqueOrThrow({ where: { id: borrada.id } })
    expect(fila.category).toBe('UTILITY')
  })
})

// --- Enmienda: relaciones de variables, estado del mapeo y habilitacion -----------------------

const CON_HUECOS = [{ type: 'BODY', text: 'Hola {{1}}, tu cuenta {{2}}', example: { body_text: [['Ana', '123']] } }]

async function crearVariable(empresa: Empresa, key: string): Promise<string> {
  const variable = await prisma.whatsappVariableKey.create({
    data: { companyId: empresa.companyId, key, label: `Etiqueta ${key}`, value: 'valor' },
    select: { id: true },
  })
  return variable.id
}

function relaciones(variableKeyId: string): TemplateVariableBinding[] {
  return [
    { slot: 'body.1', kind: 'system', systemKey: 'cliente.nombre' },
    { slot: 'body.2', kind: 'company', variableKeyId },
  ]
}

async function relacionesEnLaBase(templateId: string): Promise<number> {
  return prisma.whatsappTemplateVariable.count({ where: { templateId } })
}

/** Una plantilla relacionada y habilitada, con una relacion a constante y otra a propia. */
async function relacionada(empresa: Empresa, overrides: Partial<NewCreatedTemplateRow> = {}) {
  const variableKeyId = await crearVariable(empresa, `cuenta_${token().slice(0, 8)}`)
  const bindings = relaciones(variableKeyId)
  const record = await crear(
    filaCreada(empresa, { components: CON_HUECOS, variables: bindings, mappingStatus: 'MAPPED', enabled: true, ...overrides }),
    empresa.connectionId,
    empresa.scope,
  )
  return { record, bindings, variableKeyId }
}

describe('R68 R69: el alta guarda las relaciones de la creacion', () => {
  it('R68 — inserta las relaciones con la empresa del ambito, relacionada y habilitada, y las lecturas las traen', async () => {
    const a = await crearEmpresa()
    const variableKeyId = await crearVariable(a, 'cuenta_numero')
    const bindings = relaciones(variableKeyId)

    const { record, inserted } = await insertCreatedWhatsappTemplate(
      filaCreada(a, { components: CON_HUECOS, variables: bindings, mappingStatus: 'MAPPED', enabled: true }),
      a.connectionId,
      a.scope,
    )

    expect(inserted).toBe(true)
    expect(record).toMatchObject({ mappingStatus: 'MAPPED', enabled: true, variables: bindings })
    const filas = await prisma.whatsappTemplateVariable.findMany({ where: { templateId: record.id }, orderBy: { slot: 'asc' } })
    expect(filas.map((f) => ({ companyId: f.companyId, slot: f.slot, variableKeyId: f.variableKeyId, systemKey: f.systemKey }))).toEqual([
      { companyId: a.companyId, slot: 'body.1', variableKeyId: null, systemKey: 'cliente.nombre' },
      { companyId: a.companyId, slot: 'body.2', variableKeyId, systemKey: null },
    ])
    expect(await findLiveWhatsappTemplateById(record.id, a.scope)).toEqual(record)
    expect((await listLiveWhatsappTemplates(a.connectionId, { onlyApproved: false }, a.scope))[0]?.variables).toEqual(bindings)
    expect((await findLiveWhatsappTemplateByNameAndLanguage(a.connectionId, record.name, 'es', a.scope))?.variables).toEqual(bindings)
  })

  it('R69 — si la sincronizacion ya la inserto, el alta devuelve inserted false y no escribe relaciones ni el mapeo', async () => {
    const a = await crearEmpresa()
    const variableKeyId = await crearVariable(a, 'cuenta_numero')
    const deMeta = snapshot({ name: 'carrera_variables', components: CON_HUECOS })
    await applyWhatsappTemplateSync(
      a.connectionId,
      { ...VACIO, inserts: [importada(deMeta, { mappingStatus: 'UNMAPPED', enabled: false })] },
      new Date(),
      new Date(),
      a.scope,
    )

    const { record, inserted } = await insertCreatedWhatsappTemplate(
      filaCreada(a, {
        metaTemplateId: deMeta.metaTemplateId,
        name: 'carrera_variables',
        components: CON_HUECOS,
        variables: relaciones(variableKeyId),
        mappingStatus: 'MAPPED',
        enabled: true,
      }),
      a.connectionId,
      a.scope,
    )

    expect(inserted).toBe(false)
    expect(record).toMatchObject({ mappingStatus: 'UNMAPPED', enabled: false, variables: [], createdById: a.userId })
    expect(await relacionesEnLaBase(record.id)).toBe(0)
  })

  it('R69 — inserted false trae las relaciones que la fila ya tenia', async () => {
    const a = await crearEmpresa()
    const { record, bindings } = await relacionada(a)

    const repetida = await insertCreatedWhatsappTemplate(
      filaCreada(a, { metaTemplateId: record.metaTemplateId, name: record.name, components: CON_HUECOS }),
      a.connectionId,
      a.scope,
    )

    expect(repetida.inserted).toBe(false)
    expect(repetida.record.variables).toEqual(bindings)
    expect(await relacionesEnLaBase(record.id)).toBe(2)
  })
})

describe('R70-R73: la sincronizacion y el borrado con relaciones', () => {
  it('R70 — las importadas guardan el estado del mapeo y la habilitacion del plan, sin relaciones', async () => {
    const a = await crearEmpresa()
    const sinHuecos = snapshot({ name: 'sin_huecos' })
    const conHuecos = snapshot({ name: 'con_huecos', components: CON_HUECOS })

    await applyWhatsappTemplateSync(
      a.connectionId,
      {
        ...VACIO,
        inserts: [importada(sinHuecos), importada(conHuecos, { mappingStatus: 'UNMAPPED', enabled: false })],
      },
      new Date(),
      new Date(),
      a.scope,
    )

    const filas = await prisma.whatsappTemplate.findMany({ where: { connectionId: a.connectionId } })
    const porNombre = new Map(filas.map((fila) => [fila.name, fila]))
    expect(porNombre.get('sin_huecos')).toMatchObject({ mappingStatus: 'MAPPED', enabled: true })
    expect(porNombre.get('con_huecos')).toMatchObject({ mappingStatus: 'UNMAPPED', enabled: false })
    expect(await prisma.whatsappTemplateVariable.count({ where: { companyId: a.companyId } })).toBe(0)
  })

  it('R71 R72 — el reset quita las relaciones y escribe el mapeo del plan; sin reset se conservan', async () => {
    const a = await crearEmpresa()
    const cambia = await relacionada(a, { name: 'cambia' })
    const igual = await relacionada(a, { name: 'igual' })
    const at = new Date('2026-10-20T18:00:00.000Z')

    await applyWhatsappTemplateSync(
      a.connectionId,
      {
        ...VACIO,
        updates: [
          puesta(cambia.record.id, snapshot({ metaTemplateId: cambia.record.metaTemplateId, name: 'cambia', components: [{ type: 'BODY', text: 'Otro {{1}}' }] }), true, {
            resetVariables: true,
            mappingStatusAfterReset: 'UNMAPPED',
            enabledAfterReset: false,
          }),
          puesta(igual.record.id, snapshot({ metaTemplateId: igual.record.metaTemplateId, name: 'igual', components: CON_HUECOS, status: 'REJECTED' }), true),
        ],
      },
      new Date(Date.now() + 60_000),
      at,
      a.scope,
    )

    expect(await findLiveWhatsappTemplateById(cambia.record.id, a.scope)).toMatchObject({
      mappingStatus: 'UNMAPPED',
      enabled: false,
      variables: [],
      components: [{ type: 'BODY', text: 'Otro {{1}}' }],
    })
    expect(await findLiveWhatsappTemplateById(igual.record.id, a.scope)).toMatchObject({
      mappingStatus: 'MAPPED',
      enabled: true,
      variables: igual.bindings,
      status: 'REJECTED',
    })
  })

  it('R71 — el reset sin huecos conserva la habilitacion que diga el plan', async () => {
    const a = await crearEmpresa()
    const t = await relacionada(a)

    await applyWhatsappTemplateSync(
      a.connectionId,
      {
        ...VACIO,
        updates: [
          puesta(t.record.id, snapshot({ metaTemplateId: t.record.metaTemplateId, name: t.record.name, components: [{ type: 'BODY', text: 'Adios' }] }), true, {
            resetVariables: true,
            mappingStatusAfterReset: 'MAPPED',
            enabledAfterReset: true,
          }),
        ],
      },
      new Date(Date.now() + 60_000),
      new Date(),
      a.scope,
    )

    expect(await findLiveWhatsappTemplateById(t.record.id, a.scope)).toMatchObject({ mappingStatus: 'MAPPED', enabled: true, variables: [] })
  })

  it('R73 — los borrados de la sincronizacion quitan relaciones y deshabilitan, salvo lo creado despues de empezar', async () => {
    const a = await crearEmpresa()
    const antigua = await relacionada(a, { name: 'antigua' })
    const reciente = await relacionada(a, { name: 'reciente' })
    const startedAt = new Date('2026-10-20T12:00:00.000Z')
    await prisma.whatsappTemplate.update({ where: { id: antigua.record.id }, data: { createdAt: new Date('2026-10-20T11:59:59.000Z') } })
    await prisma.whatsappTemplate.update({ where: { id: reciente.record.id }, data: { createdAt: new Date('2026-10-20T12:00:01.000Z') } })

    await applyWhatsappTemplateSync(
      a.connectionId,
      { ...VACIO, deletes: [antigua.record.id, reciente.record.id] },
      startedAt,
      new Date('2026-10-20T12:00:05.000Z'),
      a.scope,
    )

    const borrada = await prisma.whatsappTemplate.findUniqueOrThrow({ where: { id: antigua.record.id } })
    expect(borrada).toMatchObject({ enabled: false })
    expect(borrada.deletedAt).not.toBeNull()
    expect(await relacionesEnLaBase(antigua.record.id)).toBe(0)
    expect(await findLiveWhatsappTemplateById(reciente.record.id, a.scope)).toMatchObject({ enabled: true, variables: reciente.bindings })
  })

  it('R73 — markDeleted quita las relaciones y deshabilita; el estado del mapeo se queda', async () => {
    const a = await crearEmpresa()
    const t = await relacionada(a)

    expect(await markWhatsappTemplateDeleted(t.record.id, new Date(), a.scope)).toBe(true)

    const fila = await prisma.whatsappTemplate.findUniqueOrThrow({ where: { id: t.record.id } })
    expect(fila).toMatchObject({ enabled: false, mappingStatus: 'MAPPED' })
    expect(await relacionesEnLaBase(t.record.id)).toBe(0)
  })

  it('R73 — markDeleted con el ambito de otra empresa no quita relaciones', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const t = await relacionada(a)

    expect(await markWhatsappTemplateDeleted(t.record.id, new Date(), b.scope)).toBe(false)
    expect(await relacionesEnLaBase(t.record.id)).toBe(2)
  })

  it('R73 — los cambios de estado y categoria del webhook no tocan relaciones, mapeo ni habilitacion', async () => {
    const a = await crearEmpresa()
    const t = await relacionada(a)

    await applyWhatsappTemplateWebhookUpdates(
      a.connectionId,
      [
        { kind: 'status', metaTemplateId: t.record.metaTemplateId, status: 'REJECTED', statusRaw: null, rejectedReason: 'INVALID_FORMAT' },
        { kind: 'category', metaTemplateId: t.record.metaTemplateId, category: 'MARKETING' },
      ],
      a.scope,
    )

    expect(await findLiveWhatsappTemplateById(t.record.id, a.scope)).toMatchObject({
      status: 'REJECTED',
      category: 'MARKETING',
      mappingStatus: 'MAPPED',
      enabled: true,
      variables: t.bindings,
    })
  })
})

describe('R76: relacionar y habilitar solo escriben si los componentes no cambiaron', () => {
  it('R76 — replaceVariables sustituye todo con los componentes leidos, aunque sus claves vengan en otro orden', async () => {
    const a = await crearEmpresa()
    const t = await relacionada(a)
    const reordenados = [{ example: { body_text: [['Ana', '123']] }, text: 'Hola {{1}}, tu cuenta {{2}}', type: 'BODY' }]

    const ok = await replaceWhatsappTemplateVariables(
      t.record.id,
      [{ slot: 'body.1', kind: 'system', systemKey: 'pedido.numero' }],
      { mappingStatus: 'UNMAPPED', enabled: false },
      reordenados,
      a.scope,
    )

    expect(ok).toBe(true)
    expect(await findLiveWhatsappTemplateById(t.record.id, a.scope)).toMatchObject({
      mappingStatus: 'UNMAPPED',
      enabled: false,
      variables: [{ slot: 'body.1', kind: 'system', systemKey: 'pedido.numero' }],
    })
  })

  it('R76 — con los componentes cambiados entre lectura y escritura devuelve false y no escribe', async () => {
    const a = await crearEmpresa()
    const t = await relacionada(a)
    await prisma.whatsappTemplate.update({ where: { id: t.record.id }, data: { components: [{ type: 'BODY', text: 'Cambiada {{1}}' }] } })

    expect(
      await replaceWhatsappTemplateVariables(t.record.id, [], { mappingStatus: 'UNMAPPED', enabled: false }, t.record.components, a.scope),
    ).toBe(false)
    expect(await setWhatsappTemplateEnabled(t.record.id, false, t.record.components, a.scope)).toBe(false)

    expect(await findLiveWhatsappTemplateById(t.record.id, a.scope)).toMatchObject({ mappingStatus: 'MAPPED', enabled: true, variables: t.bindings })
  })

  it('R76 — con la plantilla eliminada, o de otra empresa, devuelve false y no escribe', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const viva = await relacionada(a)
    const borrada = await relacionada(a)
    await prisma.whatsappTemplate.update({ where: { id: borrada.record.id }, data: { deletedAt: new Date() } })

    expect(await replaceWhatsappTemplateVariables(borrada.record.id, [], { mappingStatus: 'UNMAPPED', enabled: false }, CON_HUECOS, a.scope)).toBe(false)
    expect(await setWhatsappTemplateEnabled(borrada.record.id, false, CON_HUECOS, a.scope)).toBe(false)
    expect(await replaceWhatsappTemplateVariables(viva.record.id, [], { mappingStatus: 'UNMAPPED', enabled: false }, CON_HUECOS, b.scope)).toBe(false)
    expect(await setWhatsappTemplateEnabled(viva.record.id, false, CON_HUECOS, b.scope)).toBe(false)

    expect(await relacionesEnLaBase(borrada.record.id)).toBe(2)
    expect(await findLiveWhatsappTemplateById(viva.record.id, a.scope)).toMatchObject({ enabled: true, variables: viva.bindings })
  })

  it('R76 — setEnabled con los componentes leidos cambia solo la habilitacion', async () => {
    const a = await crearEmpresa()
    const t = await relacionada(a)

    expect(await setWhatsappTemplateEnabled(t.record.id, false, t.record.components, a.scope)).toBe(true)
    expect(await findLiveWhatsappTemplateById(t.record.id, a.scope)).toMatchObject({ enabled: false, mappingStatus: 'MAPPED', variables: t.bindings })
    expect(await setWhatsappTemplateEnabled(t.record.id, true, t.record.components, a.scope)).toBe(true)
    expect(await findLiveWhatsappTemplateById(t.record.id, a.scope)).toMatchObject({ enabled: true })
  })
})

describe('R80: la base no deja habilitada una plantilla sin relacionar', () => {
  it('R80 — el CHECK rechaza enabled con UNMAPPED, en una escritura directa y por setEnabled', async () => {
    const a = await crearEmpresa()
    const t = await crear(filaCreada(a, { components: CON_HUECOS, mappingStatus: 'UNMAPPED', enabled: false }), a.connectionId, a.scope)

    const directa = await errorOf(prisma.whatsappTemplate.update({ where: { id: t.id }, data: { enabled: true } }))
    expect(String(directa)).toMatch(/whatsapp_templates_enabled_requires_mapped/)
    await expect(setWhatsappTemplateEnabled(t.id, true, t.components, a.scope)).rejects.toThrow()
    await expect(
      crear(filaCreada(a, { mappingStatus: 'UNMAPPED', enabled: true }), a.connectionId, a.scope),
    ).rejects.toThrow()

    expect(await findLiveWhatsappTemplateById(t.id, a.scope)).toMatchObject({ enabled: false, mappingStatus: 'UNMAPPED' })
  })
})
