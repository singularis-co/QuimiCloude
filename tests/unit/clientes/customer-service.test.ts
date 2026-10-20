// Los cuatro casos de uso de escritura y ficha de `clientes`, con DOBLES del puerto
// (`design.md > 5`). Cubre R9, R13, R18, R19-R25 y R42. Lo que solo Postgres puede demostrar
// -que el ambito filtra de verdad- es la integracion.
//
// El alta y la edicion escriben por la unidad de trabajo (QC-239): el doble ejecuta `work` con el
// mismo repositorio de escritura, un doble de telefonos y un espia del recalculo de contactos.

import { describe, expect, it, vi } from 'vitest'

import { createCreateCustomer } from '@/lib/modules/clientes/domain/create-customer'
import { createDeleteCustomer } from '@/lib/modules/clientes/domain/delete-customer'
import {
  CustomerNotFoundError,
  CustomerPhoneCountryRequiredError,
  CustomerPhoneInvalidError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/clientes/domain/errors'
import { createGetCustomer } from '@/lib/modules/clientes/domain/get-customer'
import { createUpdateCustomer } from '@/lib/modules/clientes/domain/update-customer'
import * as clientesErrors from '@/lib/modules/clientes/domain/errors'
import { ERROR_CODES } from '@/lib/modules/errores/domain/error-codes'

import type { Actor } from '@/lib/modules/clientes/domain/actor'
import type { CustomerView } from '@/lib/modules/clientes/domain/customer-view'
import type { CustomerRepository } from '@/lib/modules/clientes/ports/customer-repository'
import type { CustomerWriteRepository } from '@/lib/modules/clientes/ports/customer-write-repository'
import type { CustomerPhoneLink, CustomerPhoneRepository } from '@/lib/modules/clientes/ports/customer-phone-repository'
import type { CustomerUnitOfWork } from '@/lib/modules/clientes/ports/customer-unit-of-work'

type Repos = CustomerRepository & CustomerWriteRepository

const ADMIN: Actor = {
  id: '11111111-1111-4111-8111-111111111111',
  companyId: '99999999-9999-4999-8999-999999999999',
  permissions: ['clientes.consultar', 'clientes.modificar'],
}
const AHORA = new Date('2026-09-24T12:00:00.000Z')
const now = () => AHORA
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222'
const ID_SIN_FORMA = 'no-es-un-uuid'

const ENTRADA_VALIDA = {
  firstNames: 'Maria',
  lastNames: 'Perez',
  city: 'Bogota',
  phoneCountry: 'CO',
  phoneNumber: '3001112233',
  email: null,
  address: null,
}

const VISTA: CustomerView = {
  id: CUSTOMER_ID,
  firstNames: 'Maria',
  lastNames: 'Perez',
  city: 'Bogota',
  phone: '3001112233',
  phoneCountry: null,
  phoneE164: null,
  phoneIssue: null,
  email: null,
  address: null,
  createdBy: ADMIN.id,
  updatedBy: ADMIN.id,
  createdAt: AHORA,
  updatedAt: AHORA,
}

function makeCustomers(overrides: Partial<Repos> = {}): {
  readonly repo: Repos
  readonly spies: Record<keyof Repos, ReturnType<typeof vi.fn>>
} {
  const spies = {
    create: vi.fn(async () => ({ id: 'nuevo-id' })),
    findAliveById: vi.fn(async () => null),
    updateAlive: vi.fn(async () => ({ kind: 'ok', before: null, after: null })),
    softDeleteAlive: vi.fn(async () => true),
    listAlive: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 })),
  }
  const repo = { ...spies, ...overrides }
  return {
    repo: repo as unknown as Repos,
    spies: repo as unknown as Record<keyof Repos, ReturnType<typeof vi.fn>>,
  }
}

function makePhones(links: readonly CustomerPhoneLink[] = []) {
  return {
    isAlive: vi.fn(async () => true),
    listAliveLinks: vi.fn(async () => links),
    addLink: vi.fn(async () => undefined),
    removeLinks: vi.fn(async () => undefined),
    setMain: vi.fn(async () => undefined),
    writeMainMirror: vi.fn(async () => undefined),
    findAliveOwners: vi.fn(async () => [] as readonly string[]),
  }
}

/** La unidad de trabajo sobre dobles: `run` ejecuta `work` una vez y cuenta cuantas se abrio. */
function unitOfWorkOn(
  customers: CustomerWriteRepository,
  phones: ReturnType<typeof makePhones> = makePhones(),
  refresh: ReturnType<typeof vi.fn> = vi.fn(async () => undefined),
): CustomerUnitOfWork & { readonly runs: ReturnType<typeof vi.fn> } {
  const runs = vi.fn()
  return {
    runs,
    run: (work) => {
      runs()
      return work({
        customers,
        phones: phones as unknown as CustomerPhoneRepository,
        whatsappLinks: { refresh: refresh as unknown as (n: readonly string[], c: string) => Promise<void> },
      })
    },
  }
}

describe('casos de uso del cliente', () => {
  it('R9 — el alta usa la empresa del actor aunque la entrada traiga otra', async () => {
    const AJENA = '33333333-3333-4333-8333-333333333333'
    const { repo, spies } = makeCustomers()

    await createCreateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(
      { ...ENTRADA_VALIDA, companyId: AJENA },
      ADMIN,
    )

    const args = spies.create.mock.calls[0] as unknown as readonly unknown[]
    expect(args[args.length - 1]).toStrictEqual({ companyId: ADMIN.companyId })
    expect(JSON.stringify(args[0])).not.toContain(AJENA)
  })

  it('R13 — el alta con datos validos devuelve el identificador del puerto', async () => {
    const { repo } = makeCustomers()
    const creado = await createCreateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(ENTRADA_VALIDA, ADMIN)
    expect(creado).toEqual({ id: 'nuevo-id' })
  })

  it('R18 — al puerto solo llegan los seis datos de negocio (mas sus tres formas normalizadas)', async () => {
    const { repo, spies } = makeCustomers()

    await createCreateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(
      { ...ENTRADA_VALIDA, companyId: 'ajena', nit: '900123456-7' },
      ADMIN,
    )

    expect(Object.keys(spies.create.mock.calls[0]?.[0] as object).sort()).toEqual([
      'address',
      'city',
      'cityNormalized',
      'email',
      'firstNames',
      'firstNamesNormalized',
      'lastNames',
      'lastNamesNormalized',
      'phone',
    ])
  })

  it('R19 — dos clientes vivos con los mismos datos y sin telefono se crean los dos, sin error de duplicado', async () => {
    const { repo } = makeCustomers()
    const sinTelefono = { ...ENTRADA_VALIDA, phoneNumber: '' }
    const uno = await createCreateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(sinTelefono, ADMIN)
    const otro = await createCreateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(sinTelefono, ADMIN)
    expect(uno).toEqual({ id: 'nuevo-id' })
    expect(otro).toEqual({ id: 'nuevo-id' })
  })

  it('R20 — la edicion reemplaza los seis datos y el opcional ausente queda como ausencia', async () => {
    const { repo, spies } = makeCustomers()

    await createUpdateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(
      CUSTOMER_ID,
      {
        firstNames: 'Ana',
        lastNames: 'Gomez',
        city: 'Cali',
        phoneCountry: 'CO',
        phoneNumber: '   ',
        email: null,
        address: undefined,
      },
      ADMIN,
    )

    expect(spies.updateAlive.mock.calls[0]?.[1]).toEqual({
      firstNames: 'Ana',
      lastNames: 'Gomez',
      city: 'Cali',
      phone: { kind: 'keep_legacy_or_clear' },
      email: null,
      address: null,
      firstNamesNormalized: 'ana',
      lastNamesNormalized: 'gomez',
      cityNormalized: 'cali',
    })
  })

  it('R21 — el actor queda como autor de creacion y modificacion al crear, y solo de modificacion al editar y dar de baja', async () => {
    const { repo, spies } = makeCustomers()

    await createCreateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(ENTRADA_VALIDA, ADMIN)
    expect(spies.create).toHaveBeenCalledWith(expect.anything(), ADMIN.id, AHORA, expect.anything())

    await createUpdateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(CUSTOMER_ID, ENTRADA_VALIDA, ADMIN)
    expect(spies.updateAlive).toHaveBeenCalledWith(
      CUSTOMER_ID,
      expect.anything(),
      ADMIN.id,
      AHORA,
      expect.anything(),
    )

    await createDeleteCustomer({ customers: repo, now })(CUSTOMER_ID, ADMIN)
    expect(spies.softDeleteAlive).toHaveBeenCalledWith(CUSTOMER_ID, ADMIN.id, AHORA, expect.anything())
  })

  it('R22 — la ficha devuelve id, seis datos, instantes y autores, sin empresa ni marca de baja', async () => {
    const { repo } = makeCustomers({ findAliveById: vi.fn(async () => VISTA) })
    const ficha = await createGetCustomer({ customers: repo })(CUSTOMER_ID, ADMIN)
    expect(Object.keys(ficha).sort()).toEqual(
      [
        'address',
        'city',
        'createdAt',
        'createdBy',
        'email',
        'firstNames',
        'id',
        'lastNames',
        'phone',
        'phoneCountry',
        'phoneE164',
        'phoneIssue',
        'updatedAt',
        'updatedBy',
      ].sort(),
    )
  })

  it('R23 — inexistente, dado de baja o id sin forma responden customer_not_found; el id sin forma no llega al puerto', async () => {
    const consulta = makeCustomers({ findAliveById: vi.fn(async () => null) })
    await expect(
      createGetCustomer({ customers: consulta.repo })(CUSTOMER_ID, ADMIN),
    ).rejects.toBeInstanceOf(CustomerNotFoundError)

    const edicion = makeCustomers({ updateAlive: vi.fn(async () => 'not_found' as const) })
    await expect(
      createUpdateCustomer({ unitOfWork: unitOfWorkOn(edicion.repo), now })(CUSTOMER_ID, ENTRADA_VALIDA, ADMIN),
    ).rejects.toBeInstanceOf(CustomerNotFoundError)

    const baja = makeCustomers({ softDeleteAlive: vi.fn(async () => false) })
    await expect(
      createDeleteCustomer({ customers: baja.repo, now })(CUSTOMER_ID, ADMIN),
    ).rejects.toBeInstanceOf(CustomerNotFoundError)

    // El id sin forma no llega al puerto, en los tres casos.
    const sinForma = makeCustomers()
    await expect(
      createGetCustomer({ customers: sinForma.repo })(ID_SIN_FORMA, ADMIN),
    ).rejects.toBeInstanceOf(CustomerNotFoundError)
    await expect(
      createUpdateCustomer({ unitOfWork: unitOfWorkOn(sinForma.repo), now })(ID_SIN_FORMA, ENTRADA_VALIDA, ADMIN),
    ).rejects.toBeInstanceOf(CustomerNotFoundError)
    await expect(
      createDeleteCustomer({ customers: sinForma.repo, now })(ID_SIN_FORMA, ADMIN),
    ).rejects.toBeInstanceOf(CustomerNotFoundError)
    expect(sinForma.spies.findAliveById).not.toHaveBeenCalled()
    expect(sinForma.spies.updateAlive).not.toHaveBeenCalled()
    expect(sinForma.spies.softDeleteAlive).not.toHaveBeenCalled()
  })

  // `CustomerRepository` y `CustomerWriteRepository` son interfaces de TypeScript: sin instancia
  // real, solo el doble se puede reflejar en tiempo de ejecucion. Que los TIPOS de los puertos
  // tengan exactamente estos metodos lo sostiene `guard-ambito-empresa-clientes`.
  it('R25 — no existe ninguna operacion de restaurar ni de listar dados de baja (metodosEsperados: 3 en CustomerRepository y 2 en CustomerWriteRepository, guard-ambito-empresa-clientes)', async () => {
    const puerto = Object.keys(makeCustomers().repo).sort()
    expect(puerto).toEqual(['create', 'findAliveById', 'listAlive', 'softDeleteAlive', 'updateAlive'])

    const { repo, spies } = makeCustomers()
    await createDeleteCustomer({ customers: repo, now })(CUSTOMER_ID, ADMIN)
    expect(spies.softDeleteAlive).toHaveBeenCalledTimes(1)
  })

  it('R42 — el alta y la edicion pasan cada forma normalizada emparejada con su dato', async () => {
    const { repo, spies } = makeCustomers()

    await createCreateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(
      { ...ENTRADA_VALIDA, firstNames: '  María José  ', lastNames: 'Pérez Muñoz', city: 'Bogotá' },
      ADMIN,
    )
    expect(spies.create.mock.calls[0]?.[0]).toMatchObject({
      firstNames: 'María José',
      firstNamesNormalized: 'mariajose',
      lastNames: 'Pérez Muñoz',
      lastNamesNormalized: 'perezmunoz',
      city: 'Bogotá',
      cityNormalized: 'bogota',
    })

    await createUpdateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(
      CUSTOMER_ID,
      { ...ENTRADA_VALIDA, firstNames: 'Andrés', lastNames: 'Niño Peña', city: 'Medellín' },
      ADMIN,
    )
    expect(spies.updateAlive.mock.calls[0]?.[1]).toMatchObject({
      firstNames: 'Andrés',
      firstNamesNormalized: 'andres',
      lastNames: 'Niño Peña',
      lastNamesNormalized: 'ninopena',
      city: 'Medellín',
      cityNormalized: 'medellin',
    })
  })

  it('R47 — ni la ficha ni el listado devuelven formas normalizadas', async () => {
    const { repo } = makeCustomers({
      findAliveById: vi.fn(async () => VISTA),
      listAlive: vi.fn(async () => ({ items: [VISTA], total: 1, page: 1, pageSize: 10, totalPages: 1 })),
    })

    const ficha = await createGetCustomer({ customers: repo })(CUSTOMER_ID, ADMIN)
    expect(ficha).not.toHaveProperty('firstNamesNormalized')
    expect(ficha).not.toHaveProperty('lastNamesNormalized')
    expect(ficha).not.toHaveProperty('cityNormalized')

    const listado = await repo.listAlive({ page: 1, sort: null, filters: {}, search: '' }, {
      companyId: ADMIN.companyId,
    })
    for (const item of listado.items) {
      expect(item).not.toHaveProperty('firstNamesNormalized')
      expect(item).not.toHaveProperty('lastNamesNormalized')
      expect(item).not.toHaveProperty('cityNormalized')
    }
  })
})

describe('telefono en el alta y la edicion', () => {
  const SIN_PERMISO: Actor = { ...ADMIN, permissions: ['clientes.consultar'] }

  type Caso = {
    readonly nombre: string
    readonly puerto: 'create' | 'updateAlive'
    readonly correr: (repo: Repos, input: unknown, actor: Actor | null) => Promise<unknown>
  }

  const CASOS: readonly Caso[] = [
    {
      nombre: 'alta',
      puerto: 'create',
      correr: (repo, input, actor) => createCreateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(input, actor),
    },
    {
      nombre: 'edicion',
      puerto: 'updateAlive',
      correr: (repo, input, actor) =>
        createUpdateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(CUSTOMER_ID, input, actor),
    },
  ]

  /** El `NewCustomer` que llego al puerto: primer argumento del alta, segundo de la edicion. */
  function datosEnElPuerto(spy: ReturnType<typeof vi.fn>, puerto: Caso['puerto']): unknown {
    const args = spy.mock.calls[0] as unknown as readonly unknown[]
    return args[puerto === 'create' ? 0 : 1]
  }

  for (const { nombre, puerto, correr } of CASOS) {
    it(`R11 — ${nombre}: un numero valido llega al puerto con pais, e164, formato internacional y sin aviso`, async () => {
      const { repo, spies } = makeCustomers()
      await correr(repo, { ...ENTRADA_VALIDA, phoneCountry: 'CO', phoneNumber: '300 123 4567' }, ADMIN)
      expect(datosEnElPuerto(spies[puerto], puerto)).toMatchObject({
        phone: { phone: '+57 300 1234567', phoneCountry: 'CO', phoneE164: '573001234567', phoneIssue: null },
      })
    })

    it(`R8 — ${nombre}: numero sin pais lanza customer_phone_country_required sin llegar al puerto`, async () => {
      const { repo, spies } = makeCustomers()
      const intento = correr(repo, { ...ENTRADA_VALIDA, phoneCountry: '', phoneNumber: '300 123 4567' }, ADMIN)
      await expect(intento).rejects.toBeInstanceOf(CustomerPhoneCountryRequiredError)
      await expect(intento).rejects.toMatchObject({
        code: 'customer_phone_country_required',
        message: 'Elige el país del teléfono.',
      })
      expect(spies[puerto]).not.toHaveBeenCalled()
    })

    it(`R9 — ${nombre}: numero no valido para el pais lanza customer_phone_invalid sin llegar al puerto`, async () => {
      const { repo, spies } = makeCustomers()
      const intento = correr(repo, { ...ENTRADA_VALIDA, phoneCountry: 'CO', phoneNumber: '600 123 4567' }, ADMIN)
      await expect(intento).rejects.toBeInstanceOf(CustomerPhoneInvalidError)
      await expect(intento).rejects.toMatchObject({ code: 'customer_phone_invalid' })
      expect(spies[puerto]).not.toHaveBeenCalled()
    })

    it(`R15 — ${nombre}: un pais fuera de la lista lanza invalid_input sin llegar al puerto`, async () => {
      const { repo, spies } = makeCustomers()
      const intento = correr(repo, { ...ENTRADA_VALIDA, phoneCountry: 'ZZ', phoneNumber: '300 123 4567' }, ADMIN)
      await expect(intento).rejects.toBeInstanceOf(ValidationError)
      await expect(intento).rejects.toMatchObject({ code: 'invalid_input' })
      expect(spies[puerto]).not.toHaveBeenCalled()
    })

    it(`R17 — ${nombre}: sin permiso lanza unauthorized antes de validar el telefono y sin llegar al puerto`, async () => {
      const { repo, spies } = makeCustomers()
      for (const input of [
        { ...ENTRADA_VALIDA, phoneCountry: '', phoneNumber: '300 123 4567' },
        { ...ENTRADA_VALIDA, phoneCountry: 'CO', phoneNumber: '300 12' },
      ]) {
        await expect(correr(repo, input, SIN_PERMISO)).rejects.toBeInstanceOf(UnauthorizedError)
        await expect(correr(repo, input, null)).rejects.toBeInstanceOf(UnauthorizedError)
      }
      expect(spies[puerto]).not.toHaveBeenCalled()
    })

    it(`R17 — ${nombre}: la empresa que llega al puerto es la del actor aunque la entrada traiga otra`, async () => {
      const { repo, spies } = makeCustomers()
      await correr(repo, { ...ENTRADA_VALIDA, companyId: '33333333-3333-4333-8333-333333333333' }, ADMIN)
      const args = spies[puerto].mock.calls[0] as unknown as readonly unknown[]
      expect(args[args.length - 1]).toStrictEqual({ companyId: ADMIN.companyId })
    })
  }

  it('R10 — alta con el numero vacio y pais marcado: al puerto llegan los cuatro campos nulos', async () => {
    const { repo, spies } = makeCustomers()
    await createCreateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(
      { ...ENTRADA_VALIDA, phoneCountry: 'CO', phoneNumber: '  ' },
      ADMIN,
    )
    expect(datosEnElPuerto(spies.create, 'create')).toMatchObject({
      phone: { phone: null, phoneCountry: null, phoneE164: null, phoneIssue: null },
    })
  })

  it('R34 — edicion con el numero vacio: al puerto llega keep_legacy_or_clear y no los cuatro nulos', async () => {
    const { repo, spies } = makeCustomers()
    for (const phoneNumber of ['', '   ', undefined, null]) {
      await createUpdateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(
        CUSTOMER_ID,
        { ...ENTRADA_VALIDA, phoneCountry: 'EC', phoneNumber },
        ADMIN,
      )
    }
    expect(spies.updateAlive).toHaveBeenCalledTimes(4)
    for (const llamada of spies.updateAlive.mock.calls) {
      const datos = (llamada as unknown as readonly unknown[])[1] as { readonly phone: unknown }
      expect(datos.phone).toEqual({ kind: 'keep_legacy_or_clear' })
    }
  })

  it('R32 — edicion con un numero valido: al puerto llegan las columnas con phoneIssue nulo, no la variante', async () => {
    const { repo, spies } = makeCustomers()
    await createUpdateCustomer({ unitOfWork: unitOfWorkOn(repo), now })(
      CUSTOMER_ID,
      { ...ENTRADA_VALIDA, phoneCountry: 'CO', phoneNumber: '3001234567' },
      ADMIN,
    )
    expect(datosEnElPuerto(spies.updateAlive, 'updateAlive')).toMatchObject({
      phone: { phone: '+57 300 1234567', phoneCountry: 'CO', phoneE164: '573001234567', phoneIssue: null },
    })
  })
})

describe('QC-239 — el alta y la edicion escriben el principal y recalculan los contactos en la misma unidad', () => {
  const NUMERO = '573001234567'
  const ANTERIOR = '573009998877'
  const PRINCIPAL_ANTERIOR: CustomerPhoneLink = { linkId: 'link-anterior', e164: ANTERIOR, main: true }

  it('R7 (QC-239) — dos altas con el mismo numero se guardan las dos y el error de telefono duplicado ya no existe', async () => {
    const { repo, spies } = makeCustomers()
    const phones = makePhones()
    const uow = unitOfWorkOn(repo, phones)
    const entrada = { ...ENTRADA_VALIDA, phoneCountry: 'CO', phoneNumber: '300 123 4567' }

    await expect(createCreateCustomer({ unitOfWork: uow, now })(entrada, ADMIN)).resolves.toEqual({ id: 'nuevo-id' })
    await expect(createCreateCustomer({ unitOfWork: uow, now })(entrada, ADMIN)).resolves.toEqual({ id: 'nuevo-id' })
    expect(spies.create).toHaveBeenCalledTimes(2)
    expect(phones.addLink).toHaveBeenCalledTimes(2)

    expect(Object.keys(clientesErrors)).not.toContain('CustomerDuplicatePhoneError')
    expect(ERROR_CODES as readonly string[]).not.toContain('customer_duplicate_phone')
  })

  it('R9 (QC-239) — el alta con numero crea el cliente y su vinculo principal en la MISMA unidad de trabajo, en ese orden', async () => {
    const orden: string[] = []
    const { repo } = makeCustomers({
      create: vi.fn(async () => {
        orden.push('create')
        return { id: 'nuevo-id' }
      }),
    })
    const phones = makePhones()
    phones.addLink.mockImplementation(async () => {
      orden.push('addLink')
    })
    const refresh = vi.fn(async () => {
      orden.push('refresh')
    })
    const uow = unitOfWorkOn(repo, phones, refresh)

    await createCreateCustomer({ unitOfWork: uow, now })({ ...ENTRADA_VALIDA, phoneCountry: 'CO', phoneNumber: '3001234567' }, ADMIN)

    expect(uow.runs).toHaveBeenCalledTimes(1)
    expect(orden).toEqual(['create', 'addLink', 'refresh'])
    expect(phones.addLink).toHaveBeenCalledWith('nuevo-id', NUMERO, true, AHORA, { companyId: ADMIN.companyId })
  })

  it('R9 (QC-239) — el alta sin numero no crea ningun vinculo y recalcula con la lista vacia', async () => {
    const { repo } = makeCustomers()
    const phones = makePhones()
    const refresh = vi.fn(async () => undefined)

    await createCreateCustomer({ unitOfWork: unitOfWorkOn(repo, phones, refresh), now })(
      { ...ENTRADA_VALIDA, phoneNumber: '' },
      ADMIN,
    )

    expect(phones.addLink).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledWith([], ADMIN.companyId)
  })

  it('R21 (QC-239) — el alta recalcula los contactos con el numero anadido y la empresa del actor', async () => {
    const { repo } = makeCustomers()
    const refresh = vi.fn(async () => undefined)

    await createCreateCustomer({ unitOfWork: unitOfWorkOn(repo, makePhones(), refresh), now })(
      { ...ENTRADA_VALIDA, phoneCountry: 'CO', phoneNumber: '3001234567', companyId: 'ajena' },
      ADMIN,
    )

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith([NUMERO], ADMIN.companyId)
  })

  it('R21, R10 (QC-239) — la edicion que cambia el numero degrada el anterior, crea el nuevo y recalcula SOLO con el nuevo', async () => {
    const { repo } = makeCustomers({
      updateAlive: vi.fn(async () => ({ kind: 'ok' as const, before: ANTERIOR, after: NUMERO })),
    })
    const phones = makePhones([PRINCIPAL_ANTERIOR])
    const refresh = vi.fn(async () => undefined)
    const uow = unitOfWorkOn(repo, phones, refresh)

    await createUpdateCustomer({ unitOfWork: uow, now })(
      CUSTOMER_ID,
      { ...ENTRADA_VALIDA, phoneCountry: 'CO', phoneNumber: '3001234567' },
      ADMIN,
    )

    expect(uow.runs).toHaveBeenCalledTimes(1)
    expect(phones.setMain).toHaveBeenCalledWith('link-anterior', false, AHORA, { companyId: ADMIN.companyId })
    expect(phones.addLink).toHaveBeenCalledWith(CUSTOMER_ID, NUMERO, true, AHORA, { companyId: ADMIN.companyId })
    expect(phones.removeLinks).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledWith([NUMERO], ADMIN.companyId)
  })

  it('R21, R12 (QC-239) — la edicion con el mismo numero no toca los vinculos y recalcula con la lista vacia', async () => {
    const { repo } = makeCustomers({
      updateAlive: vi.fn(async () => ({ kind: 'ok' as const, before: ANTERIOR, after: ANTERIOR })),
    })
    const phones = makePhones([PRINCIPAL_ANTERIOR])
    const refresh = vi.fn(async () => undefined)

    await createUpdateCustomer({ unitOfWork: unitOfWorkOn(repo, phones, refresh), now })(CUSTOMER_ID, ENTRADA_VALIDA, ADMIN)

    expect(phones.setMain).not.toHaveBeenCalled()
    expect(phones.addLink).not.toHaveBeenCalled()
    expect(phones.removeLinks).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledWith([], ADMIN.companyId)
  })

  it('R11, R21 (QC-239) — la edicion que vacia el numero de un cliente con phone_e164 quita su principal y recalcula con ese numero', async () => {
    const { repo } = makeCustomers({
      updateAlive: vi.fn(async () => ({ kind: 'ok' as const, before: ANTERIOR, after: null })),
    })
    const phones = makePhones([PRINCIPAL_ANTERIOR])
    const refresh = vi.fn(async () => undefined)

    await createUpdateCustomer({ unitOfWork: unitOfWorkOn(repo, phones, refresh), now })(
      CUSTOMER_ID,
      { ...ENTRADA_VALIDA, phoneNumber: '' },
      ADMIN,
    )

    expect(phones.removeLinks).toHaveBeenCalledWith(['link-anterior'], AHORA, { companyId: ADMIN.companyId })
    expect(refresh).toHaveBeenCalledWith([ANTERIOR], ADMIN.companyId)
  })

  it('R11 (QC-239) — los telefonos se sincronizan con el `after` que devuelve el puerto, no con la entrada', async () => {
    // Migrado con aviso: la entrada viene vacia, el adaptador conserva el telefono antiguo y la fila
    // sigue sin phone_e164. Sin principal, no hay nada que quitar.
    const migrado = makeCustomers({
      updateAlive: vi.fn(async () => ({ kind: 'ok' as const, before: null, after: null })),
    })
    const phonesMigrado = makePhones()
    const refreshMigrado = vi.fn(async () => undefined)
    await createUpdateCustomer({ unitOfWork: unitOfWorkOn(migrado.repo, phonesMigrado, refreshMigrado), now })(
      CUSTOMER_ID,
      { ...ENTRADA_VALIDA, phoneNumber: '' },
      ADMIN,
    )
    expect(phonesMigrado.removeLinks).not.toHaveBeenCalled()
    expect(phonesMigrado.addLink).not.toHaveBeenCalled()
    expect(refreshMigrado).toHaveBeenCalledWith([], ADMIN.companyId)

    // Si la fila quedo con otro numero que el de la entrada, manda la fila.
    const otro = '573005556677'
    const desfase = makeCustomers({
      updateAlive: vi.fn(async () => ({ kind: 'ok' as const, before: null, after: otro })),
    })
    const phonesDesfase = makePhones()
    await createUpdateCustomer({ unitOfWork: unitOfWorkOn(desfase.repo, phonesDesfase), now })(
      CUSTOMER_ID,
      { ...ENTRADA_VALIDA, phoneCountry: 'CO', phoneNumber: '3001234567' },
      ADMIN,
    )
    expect(phonesDesfase.addLink).toHaveBeenCalledWith(CUSTOMER_ID, otro, true, AHORA, { companyId: ADMIN.companyId })
  })

  it('R21 (QC-239) — una edicion de un cliente inexistente lanza customer_not_found sin tocar telefonos ni recalcular', async () => {
    const { repo } = makeCustomers({ updateAlive: vi.fn(async () => 'not_found' as const) })
    const phones = makePhones()
    const refresh = vi.fn(async () => undefined)

    await expect(
      createUpdateCustomer({ unitOfWork: unitOfWorkOn(repo, phones, refresh), now })(CUSTOMER_ID, ENTRADA_VALIDA, ADMIN),
    ).rejects.toBeInstanceOf(CustomerNotFoundError)
    expect(phones.listAliveLinks).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('R21 (QC-239) — un fallo del recalculo sube desde la unidad de trabajo: el alta no se da por buena', async () => {
    const { repo } = makeCustomers()
    const refresh = vi.fn(async () => {
      throw new Error('fallo del recalculo')
    })

    await expect(
      createCreateCustomer({ unitOfWork: unitOfWorkOn(repo, makePhones(), refresh), now })(
        { ...ENTRADA_VALIDA, phoneCountry: 'CO', phoneNumber: '3001234567' },
        ADMIN,
      ),
    ).rejects.toThrow('fallo del recalculo')
  })
})
