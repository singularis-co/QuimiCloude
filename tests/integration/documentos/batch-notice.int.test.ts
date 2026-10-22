/**
 * `createBatch` y `readBatchNotice` de `document-batch-repository-prisma.ts` contra Postgres real.
 *
 * AISLAMIENTO — `commit`: el adaptador usa el cliente Prisma GLOBAL y `createBatch` abre su propia
 * `prisma.$transaction`, así que una transacción del test no lo envolvería. Cada caso fabrica su
 * empresa con randomUUID y `afterAll` la borra en orden de FK.
 */
import { randomUUID } from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'

import {
  createBatch,
  finish,
  readBatchNotice,
} from '@/lib/modules/documentos/adapters/driven/persistence/document-batch-repository-prisma'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { NO_CREDENTIAL_SENTINEL } from '@/lib/modules/identity/domain/credential-setup-link'
import { DOCUMENT_TYPE_CC } from '@/lib/modules/identity/domain/document-type'
import { ROLE_ADMINISTRADOR } from '@/lib/modules/identity/domain/roles'
import { NOTIFICATION_CATALOG } from '@/lib/modules/notificaciones'
import { prisma } from '@/lib/shared/db/prisma'

const companies: string[] = []
const users: string[] = []

function tag(): string {
  return randomUUID().replaceAll('-', '')
}

async function createCompany(): Promise<string> {
  const name = `Aviso de tanda ${tag()}`
  const company = await prisma.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  })
  companies.push(company.id)
  return company.id
}

async function createUser(companyId: string): Promise<string> {
  const marca = tag()
  const role = await prisma.role.findUniqueOrThrow({ where: { name: ROLE_ADMINISTRADOR }, select: { id: true } })
  const user = await prisma.user.create({
    data: {
      firstNames: 'Ana',
      lastNames: 'Prueba',
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      email: `qc137.tanda.${marca}@example.test`,
      phone: '000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: marca.slice(0, 20),
      username: `qc137.tanda.${marca}`,
      passwordHash: NO_CREDENTIAL_SENTINEL,
      roleId: role.id,
      companyId,
      accountStatus: 'active',
    },
    select: { id: true },
  })
  users.push(user.id)
  return user.id
}

function paths(companyId: string, count: number): string[] {
  return Array.from({ length: count }, () => `${companyId}/${randomUUID()}.pdf`)
}

const failure = { kind: 'error', code: 'invalid_input', reason: 'no se pudo leer' } as const
const success = { kind: 'done', text: 'texto' } as const

afterAll(async () => {
  try {
    await prisma.documentFile.deleteMany({ where: { companyId: { in: companies } } })
    await prisma.documentBatch.deleteMany({ where: { companyId: { in: companies } } })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
    await prisma.company.deleteMany({ where: { id: { in: companies } } })
    expect(await prisma.company.count({ where: { id: { in: companies } } })).toBe(0)
  } finally {
    await prisma.$disconnect()
  }
})

describe('createBatch guarda el nombre original de cada archivo (R50)', () => {
  it('QC-137 R50: cada fila guarda su nombre, alineado con su ruta', async () => {
    const companyId = await createCompany()
    const rutas = paths(companyId, 3)

    const created = await createBatch({
      companyId,
      strategy: 'formula',
      createdBy: null,
      paths: rutas,
      originalNames: ['a.pdf', 'b.pdf', 'c.pdf'],
    })

    const rows = await prisma.documentFile.findMany({
      where: { batchId: created.batchId },
      select: { path: true, originalName: true },
    })
    const byPath = new Map(rows.map((row) => [row.path, row.originalName]))
    expect(rutas.map((ruta) => byPath.get(ruta))).toEqual(['a.pdf', 'b.pdf', 'c.pdf'])
  })

  it('QC-137 R50: sin nombres las filas quedan con NULL, como las anteriores a la migración', async () => {
    const companyId = await createCompany()

    const created = await createBatch({ companyId, strategy: 'formula', createdBy: null, paths: paths(companyId, 2) })

    const rows = await prisma.documentFile.findMany({
      where: { batchId: created.batchId },
      select: { originalName: true },
    })
    expect(rows.map((row) => row.originalName)).toEqual([null, null])
  })

  it('QC-137 R50: la base rechaza un nombre vacío y uno de más de 255 caracteres', async () => {
    const companyId = await createCompany()

    await expect(
      createBatch({ companyId, strategy: 'formula', createdBy: null, paths: paths(companyId, 1), originalNames: [''] }),
    ).rejects.toThrow()
    await expect(
      createBatch({
        companyId,
        strategy: 'formula',
        createdBy: null,
        paths: paths(companyId, 1),
        originalNames: ['x'.repeat(256)],
      }),
    ).rejects.toThrow()
    expect(await prisma.documentBatch.count({ where: { companyId } })).toBe(0)
  })
})

describe('readBatchNotice — lo que lee el aviso de fin de tanda (R46, R51)', () => {
  it('QC-137 R51: conteos por estado, autor, estrategia y uploadedAt = created_at de la tanda', async () => {
    const companyId = await createCompany()
    const author = await createUser(companyId)
    const created = await createBatch({
      companyId,
      strategy: 'catalogo',
      createdBy: author,
      paths: paths(companyId, 4),
      originalNames: ['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf'],
    })
    const [f1, f2, f3] = created.files
    await finish(f1!.id, success)
    await finish(f2!.id, failure)
    await prisma.documentFile.update({ where: { id: f3!.id }, data: { status: 'processing' } })

    const notice = await readBatchNotice(created.batchId, companyId)
    const batch = await prisma.documentBatch.findUniqueOrThrow({
      where: { id: created.batchId },
      select: { createdAt: true },
    })

    expect(notice).toEqual({
      strategy: 'catalogo',
      createdBy: author,
      uploadedAt: batch.createdAt,
      total: 4,
      done: 1,
      failed: 1,
      pending: 2,
      failedNames: ['b.pdf'],
    })
  })

  it('QC-137 R51: los tres primeros fallidos con nombre, en orden de subida, y el total de fallidos aparte', async () => {
    const companyId = await createCompany()
    const names = ['uno.pdf', 'dos.pdf', 'tres.pdf', 'cuatro.pdf', 'cinco.pdf', 'seis.pdf']
    const created = await createBatch({
      companyId,
      strategy: 'formula',
      createdBy: null,
      paths: paths(companyId, names.length),
      originalNames: names,
    })
    // Se terminan en orden inverso: el orden del aviso es el de subida, no el de terminar.
    for (const file of [...created.files].reverse()) await finish(file.id, failure)

    const notice = await readBatchNotice(created.batchId, companyId)

    expect(notice?.failed).toBe(6)
    expect(notice?.pending).toBe(0)
    expect(notice?.failedNames).toEqual(['uno.pdf', 'dos.pdf', 'tres.pdf'])
  })

  it('QC-137 R51: los fallidos sin nombre se saltan y el leído con nombre no cuenta', async () => {
    const companyId = await createCompany()
    const created = await createBatch({
      companyId,
      strategy: 'formula',
      createdBy: null,
      paths: paths(companyId, 4),
      originalNames: [null, 'leido.pdf', 'b.pdf', null],
    })
    const [f1, f2, f3, f4] = created.files
    await finish(f1!.id, failure)
    await finish(f2!.id, success)
    await finish(f3!.id, failure)
    await finish(f4!.id, failure)

    const notice = await readBatchNotice(created.batchId, companyId)

    expect(notice).toMatchObject({ total: 4, done: 1, failed: 3, pending: 0, failedNames: ['b.pdf'] })
    expect(NOTIFICATION_CATALOG['documentos.tanda_terminada'].body({
      recipientUserId: randomUUID(),
      strategy: 'formula',
      uploadedAt: notice!.uploadedAt,
      total: notice!.total,
      done: notice!.done,
      failed: notice!.failed,
      failedNames: [...notice!.failedNames],
    })).toBe('Se leyeron 1 de 4 archivos. No se pudieron leer "b.pdf" y 2 más.')
  })

  it('QC-137 R50, R51: una tanda con filas sin nombre da failedNames vacío y el aviso usa el texto genérico', async () => {
    const companyId = await createCompany()
    const created = await createBatch({ companyId, strategy: 'formula', createdBy: null, paths: paths(companyId, 2) })
    for (const file of created.files) await finish(file.id, failure)

    const notice = await readBatchNotice(created.batchId, companyId)

    expect(notice).toMatchObject({ total: 2, done: 0, failed: 2, pending: 0, failedNames: [] })
    expect(NOTIFICATION_CATALOG['documentos.tanda_terminada'].body({
      recipientUserId: randomUUID(),
      strategy: 'formula',
      uploadedAt: notice!.uploadedAt,
      total: notice!.total,
      done: notice!.done,
      failed: notice!.failed,
      failedNames: [...notice!.failedNames],
    })).toBe('No se pudo leer ningún archivo de la tanda que subiste a las {hora}.')
  })

  it('QC-137 R46: una tanda de otra empresa o inexistente da null', async () => {
    const companyId = await createCompany()
    const otherCompany = await createCompany()
    const created = await createBatch({ companyId, strategy: 'formula', createdBy: null, paths: paths(companyId, 1) })

    expect(await readBatchNotice(created.batchId, otherCompany)).toBeNull()
    expect(await readBatchNotice(randomUUID(), companyId)).toBeNull()
  })
})
