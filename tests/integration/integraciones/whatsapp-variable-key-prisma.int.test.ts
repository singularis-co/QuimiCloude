// El repositorio de variables propias de WhatsApp contra Postgres REAL.
//
// Aislamiento: `commit`. Las funciones de `whatsapp-variable-key-prisma.ts` usan el cliente Prisma
// GLOBAL y `update`/`delete` abren su propia transaccion: una transaccion de test con ROLLBACK seria
// aislamiento de mentira. Cada empresa efimera (empresa, rol, tipo de documento, usuario y conexion),
// sus plantillas, relaciones y variables se borran en `afterAll`, en el orden de las FK, y se afirma
// contando que no queda nada de esas empresas.

import { randomUUID } from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'

import { insertWhatsappConnection } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-connection-prisma'
import {
  createWhatsappVariableKey,
  deleteWhatsappVariableKey,
  findWhatsappVariableKeysByKeys,
  listAllWhatsappVariableKeys,
  listWhatsappVariableKeysWithUsage,
  updateWhatsappVariableKey,
} from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-variable-key-prisma'
import { WhatsappVariableKeyTakenError } from '@/lib/modules/integraciones/domain/errors'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'
import type { WhatsappVariableKeyRecord } from '@/lib/modules/integraciones/domain/whatsapp-variable-key'

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
  const companyName = `Empresa variables ${marker}`
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
async function crearPlantilla(empresa: Empresa): Promise<string> {
  metaCounter += 1
  const template = await prisma.whatsappTemplate.create({
    data: {
      companyId: empresa.companyId,
      connectionId: empresa.connectionId,
      metaTemplateId: `${String(Date.now())}${String(metaCounter).padStart(4, '0')}`,
      name: `plantilla_${token().slice(0, 10)}`,
      language: 'es',
      category: 'UTILITY',
      status: 'APPROVED',
      components: [{ type: 'BODY', text: 'Hola {{1}} y {{2}}' }],
    },
    select: { id: true },
  })
  return template.id
}

async function relacionar(empresa: Empresa, templateId: string, slot: string, variableKeyId: string): Promise<void> {
  await prisma.whatsappTemplateVariable.create({
    data: { companyId: empresa.companyId, templateId, slot, variableKeyId },
  })
}

function entrada(key: string, overrides: Partial<{ label: string; value: string }> = {}) {
  return { key, label: `Etiqueta de ${key}`, value: 'valor fijo', ...overrides }
}

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('se esperaba un error y no se lanzo')
}

async function enUso(empresa: Empresa): Promise<WhatsappVariableKeyRecord> {
  const variable = await createWhatsappVariableKey(entrada(`en_uso_${token().slice(0, 8)}`), empresa.scope)
  await relacionar(empresa, await crearPlantilla(empresa), 'body.1', variable.id)
  return variable
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

describe('R53: el diccionario de propias por empresa', () => {
  it('R53 — el alta guarda la empresa del ambito, la clave, la etiqueta y el valor', async () => {
    const a = await crearEmpresa()

    const creada = await createWhatsappVariableKey(entrada('cuenta_numero', { value: '123-456' }), a.scope)

    expect(creada).toMatchObject({ companyId: a.companyId, key: 'cuenta_numero', label: 'Etiqueta de cuenta_numero', value: '123-456' })
    expect(Object.keys(creada).sort()).toEqual(['companyId', 'createdAt', 'id', 'key', 'label', 'value'])
  })

  it('R53 — la misma clave dos veces en la empresa lanza WhatsappVariableKeyTakenError; en otra empresa entra', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    await createWhatsappVariableKey(entrada('repetida'), a.scope)

    expect(await errorOf(createWhatsappVariableKey(entrada('repetida'), a.scope))).toBeInstanceOf(WhatsappVariableKeyTakenError)
    await createWhatsappVariableKey(entrada('repetida'), b.scope)

    expect(await prisma.whatsappVariableKey.count({ where: { companyId: a.companyId, key: 'repetida' } })).toBe(1)
    expect(await prisma.whatsappVariableKey.count({ where: { companyId: b.companyId, key: 'repetida' } })).toBe(1)
  })

  it('R53 — cambiar la clave a la de otra propia de la empresa lanza WhatsappVariableKeyTakenError y no escribe', async () => {
    const a = await crearEmpresa()
    await createWhatsappVariableKey(entrada('ocupada'), a.scope)
    const otra = await createWhatsappVariableKey(entrada('libre'), a.scope)

    expect(await errorOf(updateWhatsappVariableKey(otra.id, entrada('ocupada'), a.scope))).toBeInstanceOf(
      WhatsappVariableKeyTakenError,
    )
    expect((await prisma.whatsappVariableKey.findUniqueOrThrow({ where: { id: otra.id } })).key).toBe('libre')
  })

  it('R53 — el CHECK del valor admite 50 caracteres y rechaza 51', async () => {
    const a = await crearEmpresa()

    await createWhatsappVariableKey(entrada('valor_50', { value: 'x'.repeat(50) }), a.scope)
    await expect(createWhatsappVariableKey(entrada('valor_51', { value: 'x'.repeat(51) }), a.scope)).rejects.toThrow(
      /whatsapp_variable_keys_value_length/,
    )
    expect(await prisma.whatsappVariableKey.count({ where: { companyId: a.companyId, key: 'valor_51' } })).toBe(0)
  })
})

describe('R88: la forma de las claves en la base', () => {
  it('R88 — una propia con punto no entra', async () => {
    const a = await crearEmpresa()

    await expect(createWhatsappVariableKey(entrada('cliente.nombre'), a.scope)).rejects.toThrow(/whatsapp_variable_keys_key_format/)
  })

  it('R88 — una constante de un segmento se rechaza; con dos segmentos entra', async () => {
    const a = await crearEmpresa()
    const templateId = await crearPlantilla(a)

    const unSegmento = await errorOf(
      prisma.whatsappTemplateVariable.create({ data: { companyId: a.companyId, templateId, slot: 'body.1', systemKey: 'nombre' } }),
    )
    expect(String(unSegmento)).toMatch(/whatsapp_template_variables_system_key_format/)
    const tresSegmentos = await errorOf(
      prisma.whatsappTemplateVariable.create({ data: { companyId: a.companyId, templateId, slot: 'body.1', systemKey: 'a.b.c' } }),
    )
    expect(String(tresSegmentos)).toMatch(/whatsapp_template_variables_system_key_format/)

    await prisma.whatsappTemplateVariable.create({
      data: { companyId: a.companyId, templateId, slot: 'body.1', systemKey: 'cliente.nombre' },
    })
    expect(await prisma.whatsappTemplateVariable.count({ where: { templateId } })).toBe(1)
  })
})

describe('R57 R58: modificar una propia', () => {
  it('R58 — cambiar la clave de una sin uso la guarda, con etiqueta y valor', async () => {
    const a = await crearEmpresa()
    const variable = await createWhatsappVariableKey(entrada('vieja'), a.scope)

    const result = await updateWhatsappVariableKey(variable.id, entrada('nueva', { label: 'Otra', value: 'otro' }), a.scope)

    expect(result).toEqual({ kind: 'updated', record: { ...variable, key: 'nueva', label: 'Otra', value: 'otro' } })
  })

  it('R58 — cambiar la clave de una en uso por una plantilla viva devuelve in_use y no escribe nada', async () => {
    const a = await crearEmpresa()
    const variable = await enUso(a)

    expect(await updateWhatsappVariableKey(variable.id, entrada('renombrada', { label: 'Otra' }), a.scope)).toEqual({ kind: 'in_use' })

    expect(await prisma.whatsappVariableKey.findUniqueOrThrow({ where: { id: variable.id } })).toMatchObject({
      key: variable.key,
      label: variable.label,
    })
  })

  it('R57 — la etiqueta y el valor de una en uso se guardan', async () => {
    const a = await crearEmpresa()
    const variable = await enUso(a)

    const result = await updateWhatsappVariableKey(variable.id, entrada(variable.key, { label: 'Nueva', value: 'nuevo' }), a.scope)

    expect(result).toMatchObject({ kind: 'updated', record: { key: variable.key, label: 'Nueva', value: 'nuevo' } })
  })

  it('R58 — una relacion de una plantilla eliminada no cuenta como uso', async () => {
    const a = await crearEmpresa()
    const variable = await createWhatsappVariableKey(entrada('de_eliminada'), a.scope)
    const templateId = await crearPlantilla(a)
    await relacionar(a, templateId, 'body.1', variable.id)
    await prisma.whatsappTemplate.update({ where: { id: templateId }, data: { deletedAt: new Date() } })

    expect(await updateWhatsappVariableKey(variable.id, entrada('renombrada'), a.scope)).toMatchObject({ kind: 'updated' })
  })
})

describe('R59: eliminar una propia', () => {
  it('R59 — una sin uso se borra', async () => {
    const a = await crearEmpresa()
    const variable = await createWhatsappVariableKey(entrada('borrable'), a.scope)

    expect(await deleteWhatsappVariableKey(variable.id, a.scope)).toBe('deleted')
    expect(await prisma.whatsappVariableKey.count({ where: { id: variable.id } })).toBe(0)
    expect(await deleteWhatsappVariableKey(variable.id, a.scope)).toBe('not_found')
  })

  it('R59 — una en uso por una plantilla viva devuelve in_use y no se borra', async () => {
    const a = await crearEmpresa()
    const variable = await enUso(a)

    expect(await deleteWhatsappVariableKey(variable.id, a.scope)).toBe('in_use')
    expect(await prisma.whatsappVariableKey.count({ where: { id: variable.id } })).toBe(1)
  })

  it('R59 — la FK impide borrarla en uso: directo es un error, y por el adaptador (uso solo de una eliminada) es in_use', async () => {
    const a = await crearEmpresa()
    const variable = await createWhatsappVariableKey(entrada('referida'), a.scope)
    const templateId = await crearPlantilla(a)
    await relacionar(a, templateId, 'body.1', variable.id)
    await prisma.whatsappTemplate.update({ where: { id: templateId }, data: { deletedAt: new Date() } })

    expect(await errorOf(prisma.whatsappVariableKey.delete({ where: { id: variable.id } }))).toMatchObject({ code: 'P2003' })
    expect(await deleteWhatsappVariableKey(variable.id, a.scope)).toBe('in_use')
    expect(await prisma.whatsappVariableKey.count({ where: { id: variable.id } })).toBe(1)
  })
})

describe('R60: listar con el uso', () => {
  it('R60 — ordena por clave y cuenta plantillas vivas distintas, sin contar las eliminadas', async () => {
    const a = await crearEmpresa()
    const zeta = await createWhatsappVariableKey(entrada('zeta'), a.scope)
    const alfa = await createWhatsappVariableKey(entrada('alfa'), a.scope)
    const sinUso = await createWhatsappVariableKey(entrada('media'), a.scope)
    const una = await crearPlantilla(a)
    const otra = await crearPlantilla(a)
    const eliminada = await crearPlantilla(a)
    await relacionar(a, una, 'body.1', alfa.id)
    await relacionar(a, una, 'body.2', alfa.id)
    await relacionar(a, otra, 'body.1', alfa.id)
    await relacionar(a, eliminada, 'body.1', zeta.id)
    await prisma.whatsappTemplate.update({ where: { id: eliminada }, data: { deletedAt: new Date() } })

    const lista = await listWhatsappVariableKeysWithUsage(a.scope)

    expect(lista.map(({ key, usedBy }) => ({ key, usedBy }))).toEqual([
      { key: 'alfa', usedBy: 2 },
      { key: 'media', usedBy: 0 },
      { key: 'zeta', usedBy: 0 },
    ])
    expect(lista.find((entry) => entry.id === sinUso.id)).toEqual({ ...sinUso, usedBy: 0 })
    expect((await listAllWhatsappVariableKeys(a.scope)).map((entry) => entry.key)).toEqual(['alfa', 'media', 'zeta'])
  })

  it('R60 — findByKeys devuelve solo las claves pedidas de la empresa', async () => {
    const a = await crearEmpresa()
    await createWhatsappVariableKey(entrada('uno'), a.scope)
    await createWhatsappVariableKey(entrada('dos'), a.scope)

    expect((await findWhatsappVariableKeysByKeys(['dos', 'tres'], a.scope)).map((entry) => entry.key)).toEqual(['dos'])
    expect(await findWhatsappVariableKeysByKeys([], a.scope)).toEqual([])
  })
})

describe('R63: otra empresa se trata igual que una inexistente', () => {
  it('R63 — la empresa B no lista, no busca, no modifica ni borra las propias de A', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const deA = await createWhatsappVariableKey(entrada('de_a'), a.scope)

    expect(await listAllWhatsappVariableKeys(b.scope)).toEqual([])
    expect(await listWhatsappVariableKeysWithUsage(b.scope)).toEqual([])
    expect(await findWhatsappVariableKeysByKeys(['de_a'], b.scope)).toEqual([])
    expect(await updateWhatsappVariableKey(deA.id, entrada('robada'), b.scope)).toEqual({ kind: 'not_found' })
    expect(await deleteWhatsappVariableKey(deA.id, b.scope)).toBe('not_found')

    expect(await listAllWhatsappVariableKeys(a.scope)).toEqual([deA])
  })

  it('R63 — el uso de B no cuenta en las propias de A', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const deA = await enUso(a)

    expect((await listWhatsappVariableKeysWithUsage(b.scope)).length).toBe(0)
    expect((await listWhatsappVariableKeysWithUsage(a.scope)).find((entry) => entry.id === deA.id)?.usedBy).toBe(1)
  })

  it('R63 — la FK compuesta rechaza una relacion cuya plantilla o cuya propia es de otra empresa', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const plantillaDeA = await crearPlantilla(a)
    const plantillaDeB = await crearPlantilla(b)
    const propiaDeA = await createWhatsappVariableKey(entrada('cruzada'), a.scope)

    const plantillaCruzada = await errorOf(
      prisma.whatsappTemplateVariable.create({
        data: { companyId: b.companyId, templateId: plantillaDeA, slot: 'body.1', systemKey: 'cliente.nombre' },
      }),
    )
    expect(String(plantillaCruzada)).toMatch(/whatsapp_template_variables_company_template_fkey/)
    const propiaCruzada = await errorOf(
      prisma.whatsappTemplateVariable.create({
        data: { companyId: b.companyId, templateId: plantillaDeB, slot: 'body.1', variableKeyId: propiaDeA.id },
      }),
    )
    expect(String(propiaCruzada)).toMatch(/whatsapp_template_variables_company_variable_key_fkey/)
    expect(await prisma.whatsappTemplateVariable.count({ where: { companyId: b.companyId } })).toBe(0)
  })

  it('R63 — una relacion con las dos columnas de destino, o con ninguna, se rechaza', async () => {
    const a = await crearEmpresa()
    const templateId = await crearPlantilla(a)
    const propia = await createWhatsappVariableKey(entrada('destino'), a.scope)

    const dos = await errorOf(
      prisma.whatsappTemplateVariable.create({
        data: { companyId: a.companyId, templateId, slot: 'body.1', variableKeyId: propia.id, systemKey: 'cliente.nombre' },
      }),
    )
    expect(String(dos)).toMatch(/whatsapp_template_variables_one_target/)
    const ninguna = await errorOf(
      prisma.whatsappTemplateVariable.create({ data: { companyId: a.companyId, templateId, slot: 'body.1' } }),
    )
    expect(String(ninguna)).toMatch(/whatsapp_template_variables_one_target/)
    expect(await prisma.whatsappTemplateVariable.count({ where: { templateId } })).toBe(0)
  })
})
