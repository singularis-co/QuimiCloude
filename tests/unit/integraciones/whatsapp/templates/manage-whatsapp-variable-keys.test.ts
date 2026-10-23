import { describe, expect, it, vi } from 'vitest'

import {
  UnauthorizedError,
  ValidationError,
  WhatsappVariableKeyInUseError,
  WhatsappVariableKeyNotFoundError,
  WhatsappVariableKeyTakenError,
} from '@/lib/modules/integraciones/domain/errors'
import {
  createCreateWhatsappVariableKey,
  createDeleteWhatsappVariableKey,
  createListWhatsappDictionary,
  createUpdateWhatsappVariableKey,
} from '@/lib/modules/integraciones/domain/manage-whatsapp-variable-keys'
import type { WhatsappVariableKeyRepository } from '@/lib/modules/integraciones/ports/whatsapp-variable-key-repository'

import { NOW, OTHER_COMPANY_ID, admin, makeVariableKeyRepository, storedVariableKey } from '../whatsapp-doubles'

const CUENTA = storedVariableKey()
const HORARIO = storedVariableKey({ id: '00000000-0000-4000-8000-000000000202', key: 'horario', label: 'Horario', value: '9 a 18' })
const AJENA = storedVariableKey({ id: '00000000-0000-4000-8000-000000000203', key: 'ajena', companyId: OTHER_COMPANY_ID })
const MISSING_ID = '00000000-0000-4000-8000-000000000299'

function setup(usage: Record<string, number> = {}) {
  const repo = makeVariableKeyRepository([CUENTA, HORARIO, AJENA], (id) => usage[id] ?? 0)
  const deps = { variableKeys: repo.variableKeys }
  return {
    repo,
    list: createListWhatsappDictionary(deps),
    create: createCreateWhatsappVariableKey(deps),
    update: createUpdateWhatsappVariableKey(deps),
    remove: createDeleteWhatsappVariableKey(deps),
  }
}

function explodingVariableKeys() {
  const explota = (nombre: string) =>
    vi.fn(() => {
      throw new Error(`${nombre} no debe llamarse sin autorizacion`)
    })
  const spies = {
    listAll: explota('listAll'),
    listWithUsage: explota('listWithUsage'),
    findByKeys: explota('findByKeys'),
    create: explota('create'),
    update: explota('update'),
    delete: explota('delete'),
  }
  return { deps: { variableKeys: spies as unknown as WhatsappVariableKeyRepository }, espias: Object.values(spies) }
}

const VALID = { key: 'telefono_tienda', label: 'Telefono de la tienda', value: '+34 600 000 000' }

describe('diccionario: permiso', () => {
  const actors = [
    ['sin actor', null],
    ['sin el permiso', admin({ permissions: ['integraciones.ver'] })],
    ['sin empresa', admin({ companyId: '' })],
  ] as const

  it.each(actors)('R62: listar %s rechaza con unauthorized sin tocar ningun puerto', async (_caso, actor) => {
    const { deps, espias } = explodingVariableKeys()

    await expect(createListWhatsappDictionary(deps)(actor)).rejects.toBeInstanceOf(UnauthorizedError)
    for (const espia of espias) expect(espia).not.toHaveBeenCalled()
  })

  it.each(actors)('R62: crear %s rechaza con unauthorized antes de validar y sin tocar ningun puerto', async (_caso, actor) => {
    const { deps, espias } = explodingVariableKeys()

    await expect(createCreateWhatsappVariableKey(deps)({ basura: true }, actor)).rejects.toBeInstanceOf(UnauthorizedError)
    for (const espia of espias) expect(espia).not.toHaveBeenCalled()
  })

  it.each(actors)('R62: modificar %s rechaza con unauthorized antes de validar y sin tocar ningun puerto', async (_caso, actor) => {
    const { deps, espias } = explodingVariableKeys()

    await expect(createUpdateWhatsappVariableKey(deps)('no-es-uuid', { basura: true }, actor)).rejects.toBeInstanceOf(
      UnauthorizedError,
    )
    for (const espia of espias) expect(espia).not.toHaveBeenCalled()
  })

  it.each(actors)('R62: eliminar %s rechaza con unauthorized sin tocar ningun puerto', async (_caso, actor) => {
    const { deps, espias } = explodingVariableKeys()

    await expect(createDeleteWhatsappVariableKey(deps)('no-es-uuid', actor)).rejects.toBeInstanceOf(UnauthorizedError)
    for (const espia of espias) expect(espia).not.toHaveBeenCalled()
  })
})

describe('diccionario: listar', () => {
  it('R90 R87: devuelve solo las propias de su empresa, por clave, con exactamente id, clave, etiqueta, valor y uso', async () => {
    const { list } = setup({ [CUENTA.id]: 2 })

    const entries = await list(admin())

    expect(entries).toEqual([
      { id: CUENTA.id, key: 'cuenta_numero', label: CUENTA.label, value: CUENTA.value, usedBy: 2 },
      { id: HORARIO.id, key: 'horario', label: 'Horario', value: '9 a 18', usedBy: 0 },
    ])
    for (const entry of entries) expect(Object.keys(entry).sort()).toEqual(['id', 'key', 'label', 'usedBy', 'value'])
  })
})

describe('diccionario: crear', () => {
  it('R89: guarda una propia valida en su empresa y devuelve su vista sin uso', async () => {
    const { create, repo } = setup()

    const view = await create(VALID, admin())

    expect(repo.create).toHaveBeenCalledWith(VALID, { companyId: admin().companyId })
    expect(view).toEqual({ id: expect.any(String), ...VALID, usedBy: 0 })
    expect(repo.row(view.id)).toMatchObject({ ...VALID, companyId: admin().companyId, createdAt: NOW })
  })

  it.each([
    ['una clave con forma de constante', { ...VALID, key: 'cliente.nombre' }, 'key:invalid_chars'],
    ['una clave con mayuscula', { ...VALID, key: 'Telefono' }, 'key:invalid_chars'],
    ['una etiqueta vacia', { ...VALID, label: '  ' }, 'label:required'],
    ['un valor con {{', { ...VALID, value: 'a {{1}}' }, 'value:not_allowed'],
    ['una forma rota', { key: 'x' }, 'label:required'],
  ])('R89 R54: %s rechaza con invalid_input sin llamar al puerto', async (_caso, input, code) => {
    const { create, repo } = setup()

    const error = await create(input, admin()).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).diagnostic).toContain(code)
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('R89: una clave que ya tiene otra propia de la empresa rechaza con whatsapp_variable_key_taken', async () => {
    const { create, repo } = setup()

    await expect(create({ ...VALID, key: 'horario' }, admin())).rejects.toBeInstanceOf(WhatsappVariableKeyTakenError)
    expect(repo.all()).toHaveLength(3)
  })

  it('R89 R63: la misma clave en otra empresa no la impide', async () => {
    const { create } = setup()

    await expect(create({ ...VALID, key: 'ajena' }, admin())).resolves.toMatchObject({ key: 'ajena' })
  })
})

describe('diccionario: modificar', () => {
  it('R57: guarda etiqueta y valor aunque este en uso, y la vista trae su uso', async () => {
    const { update, repo } = setup({ [CUENTA.id]: 3 })

    const view = await update(CUENTA.id, { key: CUENTA.key, label: 'Cuenta', value: '999' }, admin())

    expect(view).toEqual({ id: CUENTA.id, key: CUENTA.key, label: 'Cuenta', value: '999', usedBy: 3 })
    expect(repo.row(CUENTA.id)).toMatchObject({ label: 'Cuenta', value: '999' })
  })

  it('R58: cambiar la clave de una sin uso la guarda', async () => {
    const { update, repo } = setup()

    await expect(update(CUENTA.id, { ...VALID, key: 'cuenta' }, admin())).resolves.toMatchObject({ key: 'cuenta' })
    expect(repo.row(CUENTA.id)?.key).toBe('cuenta')
  })

  it('R58: cambiar la clave de una en uso rechaza con whatsapp_variable_key_in_use sin escribir', async () => {
    const { update, repo } = setup({ [CUENTA.id]: 1 })

    await expect(update(CUENTA.id, { ...VALID, key: 'cuenta' }, admin())).rejects.toBeInstanceOf(
      WhatsappVariableKeyInUseError,
    )
    expect(repo.row(CUENTA.id)).toEqual(CUENTA)
  })

  it('R58 R89: la clave de otra propia de la empresa rechaza con whatsapp_variable_key_taken', async () => {
    const { update, repo } = setup()

    await expect(update(CUENTA.id, { ...VALID, key: 'horario' }, admin())).rejects.toBeInstanceOf(
      WhatsappVariableKeyTakenError,
    )
    expect(repo.row(CUENTA.id)).toEqual(CUENTA)
  })

  it('R89: una clave con forma de constante rechaza con invalid_input sin llamar al puerto', async () => {
    const { update, repo } = setup()

    await expect(update(CUENTA.id, { ...VALID, key: 'cliente.nombre' }, admin())).rejects.toBeInstanceOf(ValidationError)
    expect(repo.update).not.toHaveBeenCalled()
  })

  it.each([
    ['no es UUID', 'abc'],
    ['no existe', MISSING_ID],
    ['es de otra empresa', AJENA.id],
  ])('R61: si el id %s rechaza con whatsapp_variable_key_not_found sin escribir', async (_caso, id) => {
    const { update, repo } = setup()

    await expect(update(id, VALID, admin())).rejects.toBeInstanceOf(WhatsappVariableKeyNotFoundError)
    expect(repo.all()).toEqual([CUENTA, HORARIO, AJENA])
  })

  it('R61: un id que no es UUID no llega al puerto', async () => {
    const { update, repo } = setup()

    await expect(update('abc', VALID, admin())).rejects.toBeInstanceOf(WhatsappVariableKeyNotFoundError)
    expect(repo.update).not.toHaveBeenCalled()
  })
})

describe('diccionario: eliminar', () => {
  it('R59: borra una sin uso y devuelve su id', async () => {
    const { remove, repo } = setup()

    await expect(remove(HORARIO.id, admin())).resolves.toEqual({ id: HORARIO.id })
    expect(repo.row(HORARIO.id)).toBeUndefined()
  })

  it('R59: una en uso rechaza con whatsapp_variable_key_in_use sin borrar', async () => {
    const { remove, repo } = setup({ [HORARIO.id]: 1 })

    await expect(remove(HORARIO.id, admin())).rejects.toBeInstanceOf(WhatsappVariableKeyInUseError)
    expect(repo.row(HORARIO.id)).toEqual(HORARIO)
  })

  it.each([
    ['no es UUID', 'abc'],
    ['no existe', MISSING_ID],
    ['es de otra empresa', AJENA.id],
  ])('R61: si el id %s rechaza con whatsapp_variable_key_not_found sin borrar', async (_caso, id) => {
    const { remove, repo } = setup()

    await expect(remove(id, admin())).rejects.toBeInstanceOf(WhatsappVariableKeyNotFoundError)
    expect(repo.all()).toHaveLength(3)
  })
})
