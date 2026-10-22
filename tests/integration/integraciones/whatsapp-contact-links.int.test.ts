// Vincular, desvincular y bloquear contactos de WhatsApp contra Postgres REAL, por la fachada de
// `lib/composition`: la unidad de trabajo de los contactos, los telefonos de `clientes` sobre el
// mismo `tx` y el recalculo de los contactos que comparten numero. El alta y la edicion de
// clientes van tambien por la composicion, que recalcula con el mismo servicio.
//
// Aislamiento: `commit`. `withWhatsappContactTransaction` y `withCustomerTransaction` abren su
// PROPIA `prisma.$transaction` sobre el cliente GLOBAL, asi que una transaccion del test con
// ROLLBACK no las envolveria; el caso del fallo forzado necesita ademas que la transaccion de
// verdad se deshaga. Cada caso fabrica sus numeros irrepetibles en empresas efimeras, y `afterAll`
// borra por `company_id` mensajes -> contactos -> conexiones -> vinculos -> numeros -> clientes,
// cuenta que no quedo nada y despues borra usuario -> rol -> tipo de documento -> empresa.

import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { clientes, integraciones } from '@/lib/composition'
import { createCustomerPhoneLinks } from '@/lib/modules/clientes'
import { createCustomerPhoneRepository } from '@/lib/modules/clientes/adapters/driven/persistence/customer-phone-prisma'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { createLinkWhatsappContact } from '@/lib/modules/integraciones'
import { insertWhatsappConnection } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-connection-prisma'
import { createWhatsappContactRepository } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-contact-prisma'
import { withWhatsappContactTransaction } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-contact-unit-of-work-prisma'
import { prisma } from '@/lib/shared/db/prisma'

import type { WhatsappContactUnitOfWork } from '@/lib/modules/integraciones/ports/whatsapp-contact-unit-of-work'

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

function digitos(n: number): string {
  return String(Math.floor(Math.random() * 10 ** n)).padStart(n, '0')
}

/** Un movil colombiano irrepetible entre corridas: su `wa_id` y su `phone_e164` son el mismo. */
function numeroColombiano(): string {
  return `57300${digitos(7)}`
}

type Empresa = {
  readonly companyId: string
  readonly userId: string
  readonly roleId: string
  readonly documentTypeCode: string
  readonly connectionId: string
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
  const companyName = `Empresa vinculos ${marker}`
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
  }
  empresas.push(empresa)
  return empresa
}

let A: Empresa
let B: Empresa

beforeAll(async () => {
  A = await crearEmpresa()
  B = await crearEmpresa()
})

afterAll(async () => {
  const enEmpresas = { where: { companyId: { in: empresas.map((empresa) => empresa.companyId) } } }
  await prisma.whatsappMessage.deleteMany(enEmpresas)
  await prisma.whatsappContact.deleteMany(enEmpresas)
  await prisma.whatsappConnection.deleteMany(enEmpresas)
  await prisma.customerPhoneNumber.deleteMany(enEmpresas)
  await prisma.phoneNumber.deleteMany(enEmpresas)
  await prisma.customer.deleteMany(enEmpresas)
  expect(await prisma.whatsappMessage.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappContact.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappConnection.count(enEmpresas)).toBe(0)
  expect(await prisma.customerPhoneNumber.count(enEmpresas)).toBe(0)
  expect(await prisma.phoneNumber.count(enEmpresas)).toBe(0)
  expect(await prisma.customer.count(enEmpresas)).toBe(0)
  for (const empresa of empresas) {
    await prisma.user.delete({ where: { id: empresa.userId } })
    await prisma.role.delete({ where: { id: empresa.roleId } })
    await prisma.documentType.delete({ where: { code: empresa.documentTypeCode } })
    await prisma.company.delete({ where: { id: empresa.companyId } })
  }
  await prisma.$disconnect()
})

function actorDeClientes(empresa: Empresa) {
  return { id: empresa.userId, companyId: empresa.companyId, permissions: ['clientes.modificar'] }
}

function vinculador(empresa: Empresa) {
  return { ...actorDeClientes(empresa), addons: ['integraciones'] }
}

/** Lo que manda el formulario de clientes; `null` deja el telefono vacio. */
function formulario(numero: { country: string; national: string } | string | null) {
  const telefono =
    numero === null
      ? { phoneCountry: 'CO', phoneNumber: '' }
      : typeof numero === 'string'
        ? { phoneCountry: 'CO', phoneNumber: numero.slice(2) }
        : { phoneCountry: numero.country, phoneNumber: numero.national }
  return {
    firstNames: `Nombre ${token()}`,
    lastNames: `Apellido ${token()}`,
    city: 'Bogota',
    ...telefono,
    email: null,
    address: null,
  }
}

async function alta(empresa: Empresa, numero: Parameters<typeof formulario>[0] = null): Promise<string> {
  const { id } = await clientes.createCustomer(formulario(numero), actorDeClientes(empresa))
  return id
}

async function contacto(empresa: Empresa, waId: string): Promise<string> {
  const { id } = await prisma.whatsappContact.create({
    data: { companyId: empresa.companyId, connectionId: empresa.connectionId, waId },
    select: { id: true },
  })
  return id
}

function vinculoDe(contactId: string) {
  return prisma.whatsappContact.findUniqueOrThrow({
    where: { id: contactId },
    select: { customerId: true, customerLinkedBy: true },
  })
}

async function telefonosDe(empresa: Empresa, customerId: string) {
  const links = await createCustomerPhoneRepository(prisma).listAliveLinks(customerId, { companyId: empresa.companyId })
  return links.map(({ e164, main }) => ({ e164, main }))
}

function telefonoMostrado(customerId: string) {
  return prisma.customer.findUniqueOrThrow({
    where: { id: customerId },
    select: { phone: true, phoneCountry: true, phoneE164: true, phoneIssue: true },
  })
}

const SIN_CLIENTE = { customerId: null, customerLinkedBy: null }

describe('R10 — cambiar el principal en el formulario, de punta a punta', () => {
  it('R10, R21, R22: el contacto del numero anterior sigue vinculado y el contacto previo del numero nuevo queda vinculado', async () => {
    const anterior = numeroColombiano()
    const nuevo = numeroColombiano()
    const delAnterior = await contacto(A, anterior)
    const delNuevo = await contacto(A, nuevo)

    const id = await alta(A, anterior)
    expect(await vinculoDe(delAnterior)).toEqual({ customerId: id, customerLinkedBy: null })
    expect(await vinculoDe(delNuevo)).toEqual(SIN_CLIENTE)

    await clientes.updateCustomer(id, formulario(nuevo), actorDeClientes(A))

    expect(await vinculoDe(delAnterior)).toEqual({ customerId: id, customerLinkedBy: null })
    expect(await vinculoDe(delNuevo)).toEqual({ customerId: id, customerLinkedBy: null })
    expect(await telefonosDe(A, id)).toEqual(
      expect.arrayContaining([
        { e164: anterior, main: false },
        { e164: nuevo, main: true },
      ]),
    )
  })
})

describe('R21–R24 — el recalculo al cambiar los telefonos de un cliente', () => {
  it('R21, R23: la edicion que vacia el numero desvincula sus contactos', async () => {
    const numero = numeroColombiano()
    const delNumero = await contacto(A, numero)
    const id = await alta(A, numero)
    expect(await vinculoDe(delNumero)).toEqual({ customerId: id, customerLinkedBy: null })

    await clientes.updateCustomer(id, formulario(null), actorDeClientes(A))

    expect(await vinculoDe(delNumero)).toEqual(SIN_CLIENTE)
  })

  it('R22: un contacto sin cliente queda vinculado como automatico cuando su numero pasa a tener un unico dueno', async () => {
    const numero = numeroColombiano()
    const sinCliente = await contacto(A, numero)

    const id = await alta(A, numero)

    expect(await vinculoDe(sinCliente)).toEqual({ customerId: id, customerLinkedBy: null })
  })

  it('R24: cuando otro cliente anade el numero, el contacto automatico queda sin cliente y el manual se conserva', async () => {
    // Una conexion por empresa: los dos contactos del mismo numero son sus dos variantes de Mexico.
    const nacional = `55${digitos(8)}`
    const numero = { country: 'MX', national: nacional }
    const automatico = await contacto(A, `52${nacional}`)
    const manual = await contacto(A, `521${nacional}`)
    const primero = await alta(A, numero)
    await integraciones.linkWhatsappContact({ contactId: manual, customerId: primero }, vinculador(A))
    expect(await vinculoDe(automatico)).toEqual({ customerId: primero, customerLinkedBy: null })

    await alta(A, numero)

    expect(await vinculoDe(automatico)).toEqual(SIN_CLIENTE)
    expect(await vinculoDe(manual)).toEqual({ customerId: primero, customerLinkedBy: A.userId })
  })

  it('R23: al quitar el numero de un cliente, su contacto pasa al unico dueno que queda', async () => {
    const numero = numeroColombiano()
    const delNumero = await contacto(A, numero)
    const primero = await alta(A, numero)
    const segundo = await alta(A, numero)
    await integraciones.linkWhatsappContact({ contactId: delNumero, customerId: primero }, vinculador(A))

    await clientes.updateCustomer(primero, formulario(null), actorDeClientes(A))

    expect(await vinculoDe(delNumero)).toEqual({ customerId: segundo, customerLinkedBy: null })
  })
})

describe('R26–R29, R33 — vincular', () => {
  it('R26, R27, R28: vincular a un cliente sin telefono lo deja manual y anade el numero como principal, con el mismo formato que el formulario', async () => {
    const numero = numeroColombiano()
    const delNumero = await contacto(A, numero)
    const sinTelefono = await alta(A)

    await integraciones.linkWhatsappContact({ contactId: delNumero, customerId: sinTelefono }, vinculador(A))

    expect(await vinculoDe(delNumero)).toEqual({ customerId: sinTelefono, customerLinkedBy: A.userId })
    expect(await telefonosDe(A, sinTelefono)).toEqual([{ e164: numero, main: true }])
    const porFormulario = await alta(B, numero)
    expect(await telefonoMostrado(sinTelefono)).toEqual(await telefonoMostrado(porFormulario))
  })

  it('R27, R28: vincular a un cliente con solo un telefono antiguo con aviso deja el de WhatsApp como principal y quita el aviso', async () => {
    const numero = numeroColombiano()
    const delNumero = await contacto(A, numero)
    const migrado = await alta(A)
    await prisma.customer.update({
      where: { id: migrado },
      data: { phone: 'tel. viejo 300-12', phoneCountry: 'CO', phoneIssue: 'invalid_format' },
    })

    await integraciones.linkWhatsappContact({ contactId: delNumero, customerId: migrado }, vinculador(A))

    expect(await telefonoMostrado(migrado)).toMatchObject({ phoneE164: numero, phoneCountry: 'CO', phoneIssue: null })
    expect(await telefonosDe(A, migrado)).toEqual([{ e164: numero, main: true }])
  })

  it('R27: vincular a un cliente que ya tiene principal anade el numero como secundario y no cambia el telefono mostrado', async () => {
    const principal = numeroColombiano()
    const numero = numeroColombiano()
    const delNumero = await contacto(A, numero)
    const id = await alta(A, principal)
    const antes = await telefonoMostrado(id)

    await integraciones.linkWhatsappContact({ contactId: delNumero, customerId: id }, vinculador(A))

    expect(await telefonosDe(A, id)).toEqual(
      expect.arrayContaining([
        { e164: principal, main: true },
        { e164: numero, main: false },
      ]),
    )
    expect(await telefonoMostrado(id)).toEqual(antes)
  })

  it('R29: si el cliente ya tiene un telefono que coincide (Mexico sin el 1 frente al wa_id con el 1), no anade otro ni cambia el principal', async () => {
    const nacional = `55${digitos(8)}`
    const delNumero = await contacto(A, `521${nacional}`)
    const id = await alta(A, { country: 'MX', national: nacional })
    const antes = await telefonosDe(A, id)
    expect(antes).toEqual([{ e164: `52${nacional}`, main: true }])

    await integraciones.linkWhatsappContact({ contactId: delNumero, customerId: id }, vinculador(A))

    expect(await telefonosDe(A, id)).toEqual(antes)
    expect(await vinculoDe(delNumero)).toEqual({ customerId: id, customerLinkedBy: A.userId })
  })

  it('R33: un fallo despues de escribir el vinculo deshace el vinculo, el numero anadido y el telefono mostrado', async () => {
    const numero = numeroColombiano()
    const delNumero = await contacto(A, numero)
    const sinTelefono = await alta(A)
    const unidadQueFalla: WhatsappContactUnitOfWork = {
      run: (work) =>
        withWhatsappContactTransaction((tx) => {
          const links = createCustomerPhoneLinks({ phones: createCustomerPhoneRepository(tx) })
          const contacts = createWhatsappContactRepository(tx)
          return work({
            contacts: {
              ...contacts,
              setLink: async (id, link, scope) => {
                await contacts.setLink(id, link, scope)
                throw new Error('fallo forzado despues de setLink')
              },
            },
            customerPhones: links,
            owners: links,
          })
        }),
    }
    const link = createLinkWhatsappContact({ unitOfWork: unidadQueFalla })

    await expect(link({ contactId: delNumero, customerId: sinTelefono }, vinculador(A))).rejects.toThrow(
      'fallo forzado despues de setLink',
    )

    expect(await vinculoDe(delNumero)).toEqual(SIN_CLIENTE)
    expect(await telefonosDe(A, sinTelefono)).toEqual([])
    expect(await prisma.customerPhoneNumber.count({ where: { customerId: sinTelefono } })).toBe(0)
    expect((await telefonoMostrado(sinTelefono)).phoneE164).toBeNull()
  })
})

describe('R34, R35 — desvincular', () => {
  it('R34, R35: quita el numero del cliente con borrado logico y el vinculo; sin principal, ningun secundario ocupa su lugar', async () => {
    const numero = numeroColombiano()
    const secundario = numeroColombiano()
    const delNumero = await contacto(A, numero)
    const delSecundario = await contacto(A, secundario)
    const id = await alta(A)
    await integraciones.linkWhatsappContact({ contactId: delNumero, customerId: id }, vinculador(A))
    await integraciones.linkWhatsappContact({ contactId: delSecundario, customerId: id }, vinculador(A))
    expect(await telefonosDe(A, id)).toEqual(
      expect.arrayContaining([
        { e164: numero, main: true },
        { e164: secundario, main: false },
      ]),
    )

    await integraciones.unlinkWhatsappContact({ contactId: delNumero }, vinculador(A))

    expect(await vinculoDe(delNumero)).toEqual(SIN_CLIENTE)
    expect(await telefonosDe(A, id)).toEqual([{ e164: secundario, main: false }])
    expect(await telefonoMostrado(id)).toEqual({ phone: null, phoneCountry: null, phoneE164: null, phoneIssue: null })
    const quitados = await prisma.customerPhoneNumber.findMany({
      where: { customerId: id, deletedAt: { not: null } },
      select: { main: true },
    })
    expect(quitados).toHaveLength(1)
    expect(await vinculoDe(delSecundario)).toEqual({ customerId: id, customerLinkedBy: A.userId })
  })

  it('R34: si el numero tiene otro dueno unico, el contacto desvinculado pasa a el como automatico', async () => {
    const numero = numeroColombiano()
    const delNumero = await contacto(A, numero)
    const elegido = await alta(A, numero)
    const otro = await alta(A, numero)
    await integraciones.linkWhatsappContact({ contactId: delNumero, customerId: elegido }, vinculador(A))

    await integraciones.unlinkWhatsappContact({ contactId: delNumero }, vinculador(A))

    expect(await vinculoDe(delNumero)).toEqual({ customerId: otro, customerLinkedBy: null })
    expect(await telefonosDe(A, elegido)).toEqual([])
  })

  it('R36: desvincular un contacto sin cliente responde exito y no cambia nada', async () => {
    const delNumero = await contacto(A, numeroColombiano())

    await expect(integraciones.unlinkWhatsappContact({ contactId: delNumero }, vinculador(A))).resolves.toBeUndefined()

    expect(await vinculoDe(delNumero)).toEqual(SIN_CLIENTE)
  })
})

describe('R37, R38, R42 — bloquear, desbloquear y conservar', () => {
  it('R37, R38, R42: bloquear marca fecha y usuario, repetirlo no cambia la marca, desbloquear la quita, y el contacto y sus mensajes siguen', async () => {
    const numero = numeroColombiano()
    const delNumero = await contacto(A, numero)
    const id = await alta(A, numero)
    await prisma.whatsappMessage.create({
      data: {
        companyId: A.companyId,
        connectionId: A.connectionId,
        contactId: delNumero,
        direction: 'IN',
        wamid: `wamid.${token()}`,
        type: 'TEXT',
        body: 'hola',
        status: 'RECEIVED',
        metaTimestamp: new Date('2026-10-20T10:00:00.000Z'),
      },
    })
    const marca = () =>
      prisma.whatsappContact.findUniqueOrThrow({ where: { id: delNumero }, select: { blockedAt: true, blockedBy: true } })

    await integraciones.setWhatsappContactBlocked({ contactId: delNumero, blocked: true }, vinculador(A))
    const primera = await marca()
    expect(primera.blockedAt).toBeInstanceOf(Date)
    expect(primera.blockedBy).toBe(A.userId)

    await integraciones.setWhatsappContactBlocked({ contactId: delNumero, blocked: true }, vinculador(A))
    expect(await marca()).toEqual(primera)

    await integraciones.setWhatsappContactBlocked({ contactId: delNumero, blocked: false }, vinculador(A))
    expect(await marca()).toEqual({ blockedAt: null, blockedBy: null })
    expect(await vinculoDe(delNumero)).toEqual({ customerId: id, customerLinkedBy: null })

    await integraciones.unlinkWhatsappContact({ contactId: delNumero }, vinculador(A))
    expect(await prisma.whatsappContact.count({ where: { id: delNumero } })).toBe(1)
    expect(await prisma.whatsappMessage.count({ where: { contactId: delNumero } })).toBe(1)
  })
})

describe('R45 — todo se limita a la empresa del actor', () => {
  it('R45: un contacto de otra empresa responde whatsapp_contact_not_found en las tres acciones y no cambia', async () => {
    const numero = numeroColombiano()
    const ajeno = await contacto(B, numero)
    const propio = await alta(A)

    await expect(
      integraciones.linkWhatsappContact({ contactId: ajeno, customerId: propio }, vinculador(A)),
    ).rejects.toMatchObject({ code: 'whatsapp_contact_not_found' })
    await expect(integraciones.unlinkWhatsappContact({ contactId: ajeno }, vinculador(A))).rejects.toMatchObject({
      code: 'whatsapp_contact_not_found',
    })
    await expect(
      integraciones.setWhatsappContactBlocked({ contactId: ajeno, blocked: true }, vinculador(A)),
    ).rejects.toMatchObject({ code: 'whatsapp_contact_not_found' })

    expect(await vinculoDe(ajeno)).toEqual(SIN_CLIENTE)
    expect(
      await prisma.whatsappContact.findUniqueOrThrow({ where: { id: ajeno }, select: { blockedAt: true } }),
    ).toEqual({ blockedAt: null })
    expect(await telefonosDe(A, propio)).toEqual([])
  })

  it('R45, R31: un cliente de otra empresa responde customer_not_found y no anade ningun telefono', async () => {
    const numero = numeroColombiano()
    const propio = await contacto(A, numero)
    const ajeno = await alta(B)

    await expect(
      integraciones.linkWhatsappContact({ contactId: propio, customerId: ajeno }, vinculador(A)),
    ).rejects.toMatchObject({ code: 'customer_not_found' })

    expect(await vinculoDe(propio)).toEqual(SIN_CLIENTE)
    expect(await prisma.customerPhoneNumber.count({ where: { customerId: ajeno } })).toBe(0)
  })
})

describe('R33 — dos vinculos simultaneos que anaden el mismo numero nuevo a clientes distintos', () => {
  /** Espera a que alguna sesion de esta base quede bloqueada esperando a otra transaccion. */
  async function esperarUnaSesionBloqueada(): Promise<void> {
    for (let vuelta = 0; vuelta < 200; vuelta += 1) {
      const [fila] = await prisma.$queryRaw<{ esperando: number }[]>`
        SELECT count(*)::int AS esperando FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`
      if ((fila?.esperando ?? 0) > 0) return
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    throw new Error('la segunda transaccion nunca quedo esperando a la primera')
  }

  it('R33: la segunda espera a la primera, choca en phone_numbers_company_id_e164_key y su unico reintento reutiliza el numero', async () => {
    const numero = numeroColombiano()
    const uno = await alta(A)
    const otro = await alta(A)
    const scope = { companyId: A.companyId }
    let soltarLaPrimera = (): void => undefined
    const puerta = new Promise<void>((resolve) => {
      soltarLaPrimera = resolve
    })
    let avisarEscrito = (): void => undefined
    const escrito = new Promise<void>((resolve) => {
      avisarEscrito = resolve
    })
    let intentosDeLaSegunda = 0

    const primera = withWhatsappContactTransaction(async (tx) => {
      await createCustomerPhoneRepository(tx).addLink(uno, numero, true, new Date(), scope)
      avisarEscrito()
      await puerta
    })
    await escrito
    const segunda = withWhatsappContactTransaction(async (tx) => {
      intentosDeLaSegunda += 1
      await createCustomerPhoneRepository(tx).addLink(otro, numero, true, new Date(), scope)
    })
    try {
      await esperarUnaSesionBloqueada()
    } finally {
      soltarLaPrimera()
    }
    await Promise.all([primera, segunda])

    expect(intentosDeLaSegunda).toBe(2)
    expect(await prisma.phoneNumber.count({ where: { companyId: A.companyId, e164: numero } })).toBe(1)
    expect(await telefonosDe(A, uno)).toEqual([{ e164: numero, main: true }])
    expect(await telefonosDe(A, otro)).toEqual([{ e164: numero, main: true }])
  })
})
