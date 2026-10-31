// El repositorio de la configuración del agente de IA de WhatsApp contra Postgres REAL.
//
// Aislamiento: `commit`. El adaptador usa el cliente Prisma GLOBAL, no un `tx` inyectado, y R17
// necesita guardados concurrentes de verdad contra la clave primaria: una transacción de test con
// ROLLBACK sería aislamiento de mentira. Cada empresa efímera (empresa, rol, tipo de documento,
// usuario) y su configuración se borran en `afterAll`, en el orden de las FK, y se afirma contando
// que no queda ninguna configuración de esas empresas.

import { randomUUID } from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'

import { createWhatsappAgentSettingsRepository } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-agent-settings-prisma'
import { createGetWhatsappAgentSettings } from '@/lib/modules/integraciones/domain/get-whatsapp-agent-settings'
import { createSaveWhatsappAgentSettings } from '@/lib/modules/integraciones/domain/save-whatsapp-agent-settings'
import {
  WHATSAPP_AGENT_DEFAULTS,
  type WhatsappAgentSettings,
} from '@/lib/modules/integraciones/domain/whatsapp-agent-settings'
import { normalizeCompanyName } from '@/lib/modules/identity'
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
  readonly scope: IntegracionesScope
  readonly actor: Actor
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
  const companyName = `Empresa agente ia ${marker}`
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
    actor: {
      id: user.id,
      companyId: company.id,
      permissions: ['agente_ia.consultar', 'agente_ia.modificar'],
      addons: ['integraciones', 'agente_ia_whatsapp'],
    },
  }
  empresas.push(empresa)
  return empresa
}

const repo = createWhatsappAgentSettingsRepository()
const AT = new Date('2026-10-30T15:00:00.000Z')

function config(overrides: Partial<WhatsappAgentSettings> = {}): WhatsappAgentSettings {
  return {
    enabled: true,
    confidenceThreshold: 0.75,
    dailyReplyLimit: 300,
    contactHourlyReplyLimit: 15,
    inactivityHours: 6,
    handoffMessage: 'Te paso con alguien del equipo.',
    greetingMessage: 'Hola, soy {nombre}. Escribe "asesor".',
    assistantName: 'Ana',
    ...overrides,
  }
}

afterAll(async () => {
  const ids = empresas.map((empresa) => empresa.companyId)
  await prisma.whatsappAgentSettings.deleteMany({ where: { companyId: { in: ids } } })
  expect(await prisma.whatsappAgentSettings.count({ where: { companyId: { in: ids } } })).toBe(0)
  for (const empresa of empresas) {
    await prisma.user.delete({ where: { id: empresa.userId } })
    await prisma.role.delete({ where: { id: empresa.roleId } })
    await prisma.documentType.delete({ where: { code: empresa.documentTypeCode } })
    await prisma.company.delete({ where: { id: empresa.companyId } })
  }
  await prisma.$disconnect()
})

describe('repositorio de la configuración del agente', () => {
  it('R8 — una empresa sin fila lee null y el caso de uso devuelve los valores por defecto', async () => {
    const empresa = await crearEmpresa()

    expect(await repo.find(empresa.scope)).toBeNull()
    expect(await createGetWhatsappAgentSettings({ agentSettings: repo })(empresa.actor)).toEqual(
      WHATSAPP_AGENT_DEFAULTS,
    )
  })

  it('R16, R34 — guardar y leer con nombre del asistente devuelve lo guardado, con autor y fecha', async () => {
    const empresa = await crearEmpresa()
    const guardada = config()

    await repo.save(guardada, empresa.userId, AT, empresa.scope)

    expect(await repo.find(empresa.scope)).toEqual(guardada)
    const fila = await prisma.whatsappAgentSettings.findUniqueOrThrow({ where: { companyId: empresa.companyId } })
    expect(fila.updatedById).toBe(empresa.userId)
    expect(fila.updatedAt.toISOString()).toBe(AT.toISOString())
  })

  it('R16, R34 — guardar sin nombre del asistente lo deja nulo en la base y en la lectura', async () => {
    const empresa = await crearEmpresa()

    await repo.save(config({ assistantName: null }), empresa.userId, AT, empresa.scope)

    expect((await repo.find(empresa.scope))?.assistantName).toBeNull()
    const fila = await prisma.whatsappAgentSettings.findUniqueOrThrow({ where: { companyId: empresa.companyId } })
    expect(fila.assistantName).toBeNull()
  })

  it('R16 — un segundo guardado reemplaza todos los campos, el autor y la fecha', async () => {
    const empresa = await crearEmpresa()
    const otroAutor = await crearEmpresa()
    const despues = new Date('2026-10-31T09:30:00.000Z')
    const segunda = config({
      enabled: false,
      confidenceThreshold: 0.1,
      dailyReplyLimit: 1,
      contactHourlyReplyLimit: 1,
      inactivityHours: 1,
      handoffMessage: 'Otro mensaje.',
      greetingMessage: 'Otro saludo.',
      assistantName: null,
    })

    await repo.save(config(), empresa.userId, AT, empresa.scope)
    await repo.save(segunda, otroAutor.userId, despues, empresa.scope)

    expect(await repo.find(empresa.scope)).toEqual(segunda)
    const fila = await prisma.whatsappAgentSettings.findUniqueOrThrow({ where: { companyId: empresa.companyId } })
    expect(fila.updatedById).toBe(otroAutor.userId)
    expect(fila.updatedAt.toISOString()).toBe(despues.toISOString())
  })

  it.each([0, 1, 0.6, 0.29, 0.07, 0.99])('R16 — el umbral %s vuelve exacto', async (umbral) => {
    const empresa = await crearEmpresa()

    await repo.save(config({ confidenceThreshold: umbral }), empresa.userId, AT, empresa.scope)

    expect((await repo.find(empresa.scope))?.confidenceThreshold).toBe(umbral)
  })

  it('R17 — guardados concurrentes de la misma empresa dejan una sola fila, con uno de los valores', async () => {
    const empresa = await crearEmpresa()
    const variantes = Array.from({ length: 8 }, (_, i) => config({ dailyReplyLimit: 100 + i }))

    const resultados = await Promise.allSettled(
      variantes.map((variante) => repo.save(variante, empresa.userId, AT, empresa.scope)),
    )

    expect(resultados.filter((r) => r.status === 'rejected')).toEqual([])
    expect(await prisma.whatsappAgentSettings.count({ where: { companyId: empresa.companyId } })).toBe(1)
    const leida = await repo.find(empresa.scope)
    expect(variantes.map((v) => v.dailyReplyLimit)).toContain(leida?.dailyReplyLimit)
  })

  it('R18 — una empresa no lee ni pisa la configuración de otra', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()

    await repo.save(config({ assistantName: 'De A' }), a.userId, AT, a.scope)
    expect(await repo.find(b.scope)).toBeNull()

    await repo.save(config({ assistantName: 'De B', dailyReplyLimit: 9 }), b.userId, AT, b.scope)
    expect((await repo.find(a.scope))?.assistantName).toBe('De A')
    expect((await repo.find(a.scope))?.dailyReplyLimit).toBe(300)
    expect((await repo.find(b.scope))?.assistantName).toBe('De B')
  })

  it('R16, R18 — el caso de uso guarda recortado en la empresa del actor aunque la entrada traiga otra', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const save = createSaveWhatsappAgentSettings({ agentSettings: repo, now: () => AT })
    const get = createGetWhatsappAgentSettings({ agentSettings: repo })

    await save(
      {
        ...config(),
        handoffMessage: '  Te paso con alguien.  ',
        assistantName: '  Lupe  ',
        companyId: b.companyId,
      },
      a.actor,
    )

    expect(await get(a.actor)).toEqual(config({ handoffMessage: 'Te paso con alguien.', assistantName: 'Lupe' }))
    expect(await get(b.actor)).toEqual(WHATSAPP_AGENT_DEFAULTS)
    const fila = await prisma.whatsappAgentSettings.findUniqueOrThrow({ where: { companyId: a.companyId } })
    expect(fila.updatedById).toBe(a.userId)
  })
})
