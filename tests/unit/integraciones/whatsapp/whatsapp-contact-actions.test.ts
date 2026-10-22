// QC-239 R46 — Las cuatro Server Actions del contacto de WhatsApp contra dobles de
// `@/lib/composition`: se prueba el borde (actor con añadidos, entrada que baja tal cual, `success`
// o `ErrorState` del catalogo y ninguna revalidacion), nunca el dominio ni la sesion reales.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  blockWhatsappContactAction,
  linkWhatsappContactAction,
  unblockWhatsappContactAction,
  unlinkWhatsappContactAction,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-contact-actions'
import { errorMessage } from '@/lib/modules/errores'
import {
  LinkedCustomerNotFoundError,
  UnauthorizedError,
  ValidationError,
  WhatsappContactNotFoundError,
  WhatsappContactNumberInvalidError,
} from '@/lib/modules/integraciones'

const {
  linkMock,
  unlinkMock,
  setBlockedMock,
  getSessionUserMock,
  getSessionContextMock,
  revalidatePathMock,
  readRequestIdHeaderMock,
} = vi.hoisted(() => ({
  linkMock: vi.fn(),
  unlinkMock: vi.fn(),
  setBlockedMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  getSessionContextMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  readRequestIdHeaderMock: vi.fn(async () => '7c9e6679-7425-40de-944b-e07fc1f90ae7'),
}))

// Se dobla para poder afirmar que NADIE la llama, aunque el modulo no la importe.
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))

vi.mock('@/lib/composition', () => ({
  observabilidad: { readRequestIdHeader: readRequestIdHeaderMock },
  identity: { getSessionUser: getSessionUserMock, getSessionContext: getSessionContextMock },
  integraciones: {
    linkWhatsappContact: linkMock,
    unlinkWhatsappContact: unlinkMock,
    setWhatsappContactBlocked: setBlockedMock,
  },
}))

const REQUEST_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const COMPANY_ID = '22222222-2222-4222-8222-222222222222'
const CONTACT_ID = '44444444-4444-4444-8444-444444444444'
const CUSTOMER_ID = '55555555-5555-4555-8555-555555555555'

const SESSION_USER = {
  id: 'user-ventas-1',
  username: 'ana.perez',
  displayName: 'Ana Perez',
  roleName: 'Ventas',
  permissions: ['clientes.modificar'],
  addons: ['integraciones'],
}

const ACTOR = {
  id: SESSION_USER.id,
  companyId: COMPANY_ID,
  permissions: SESSION_USER.permissions,
  addons: SESSION_USER.addons,
}

const ACTIONS = {
  link: () => linkWhatsappContactAction({ contactId: CONTACT_ID, customerId: CUSTOMER_ID }),
  unlink: () => unlinkWhatsappContactAction({ contactId: CONTACT_ID }),
  block: () => blockWhatsappContactAction({ contactId: CONTACT_ID }),
  unblock: () => unblockWhatsappContactAction({ contactId: CONTACT_ID }),
} as const

const USE_CASE_OF = {
  link: linkMock,
  unlink: unlinkMock,
  block: setBlockedMock,
  unblock: setBlockedMock,
} as const

const EXPECTED_INPUT_OF = {
  link: { contactId: CONTACT_ID, customerId: CUSTOMER_ID },
  unlink: { contactId: CONTACT_ID },
  block: { contactId: CONTACT_ID, blocked: true },
  unblock: { contactId: CONTACT_ID, blocked: false },
} as const

beforeEach(() => {
  vi.clearAllMocks()
  getSessionUserMock.mockResolvedValue(SESSION_USER)
  getSessionContextMock.mockResolvedValue({ companyId: COMPANY_ID })
  linkMock.mockResolvedValue(undefined)
  unlinkMock.mockResolvedValue(undefined)
  setBlockedMock.mockResolvedValue(undefined)
})

describe('acciones del contacto de WhatsApp (R46)', () => {
  it('R46 — cada accion con exito devuelve `success` y no revalida ninguna ruta', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      expect(await action(), name).toEqual({ status: 'success' })
    }
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('R46 — la entrada baja tal cual al caso de uso; bloquear y desbloquear fijan `blocked`', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      const useCase = USE_CASE_OF[name as keyof typeof ACTIONS]
      useCase.mockClear()
      await action()
      expect(useCase, name).toHaveBeenCalledTimes(1)
      expect(useCase.mock.calls[0]?.[0], name).toEqual(EXPECTED_INPUT_OF[name as keyof typeof ACTIONS])
    }
  })

  it('R46, R44 — el actor lleva usuario, empresa, permisos y los añadidos de la sesion', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      const useCase = USE_CASE_OF[name as keyof typeof ACTIONS]
      useCase.mockClear()
      await action()
      expect(useCase.mock.calls[0]?.[1], name).toEqual(ACTOR)
    }
  })

  it('R46 — sin sesion el actor baja nulo y el `unauthorized` del caso de uso sale del catalogo', async () => {
    getSessionContextMock.mockResolvedValue(null)
    for (const [name, action] of Object.entries(ACTIONS)) {
      const useCase = USE_CASE_OF[name as keyof typeof ACTIONS]
      useCase.mockClear()
      useCase.mockRejectedValueOnce(new UnauthorizedError())
      const result = await action()
      expect(useCase.mock.calls[0]?.[1], name).toBeNull()
      expect(result, name).toEqual({ status: 'error', code: 'unauthorized', message: errorMessage('unauthorized') })
    }
  })

  it('R46 — cada error de dominio se traduce por su codigo con el texto del catalogo, sin diagnostico', async () => {
    const CASES = [
      { error: new UnauthorizedError('diagnostico interno'), code: 'unauthorized' },
      { error: new ValidationError('diagnostico interno'), code: 'invalid_input' },
      { error: new WhatsappContactNotFoundError('diagnostico interno'), code: 'whatsapp_contact_not_found' },
      { error: new WhatsappContactNumberInvalidError('diagnostico interno'), code: 'whatsapp_contact_number_invalid' },
      { error: new LinkedCustomerNotFoundError('diagnostico interno'), code: 'customer_not_found' },
    ] as const

    for (const [name, action] of Object.entries(ACTIONS)) {
      for (const { error, code } of CASES) {
        USE_CASE_OF[name as keyof typeof ACTIONS].mockRejectedValueOnce(error)
        const result = await action()
        expect(result, `${name} / ${code}`).toEqual({ status: 'error', code, message: errorMessage(code) })
        expect(JSON.stringify(result)).not.toContain('diagnostico interno')
      }
    }
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('R46 — un error ajeno al dominio sale como `unexpected` con referencia y sin su texto', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      USE_CASE_OF[name as keyof typeof ACTIONS].mockRejectedValueOnce(new Error('fallo interno de la base'))
      const result = await action()
      expect(result, name).toEqual({
        status: 'error',
        code: 'unexpected',
        message: errorMessage('unexpected'),
        reference: REQUEST_ID,
      })
      expect(JSON.stringify(result)).not.toContain('fallo interno')
    }
  })

  it('R46 — el borde no decide ni tiene pantalla: sin permiso, esquema, ORM, driven ni revalidatePath', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..', '..', '..', '..',
        'lib', 'modules', 'integraciones', 'adapters', 'driving', 'whatsapp-contact-actions.ts',
      ),
      'utf8',
    )
    expect(source.startsWith("'use server';")).toBe(true)
    expect(source).not.toMatch(/requireCustomerLinkPermission|requirePermission|clientes\.modificar/)
    expect(source).not.toMatch(/Schema\b/)
    expect(source).not.toMatch(/@prisma\/client|prisma\./)
    expect(source).not.toMatch(/adapters\/driven|\.\.\/driven/)
    expect(source).not.toMatch(/revalidatePath|next\/cache/)
  })
})
