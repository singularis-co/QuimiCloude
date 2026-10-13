import { describe, expect, it } from 'vitest'

import { hasConfigurePermission, type Actor } from '@/lib/modules/integraciones/domain/actor'

const COMPANY_ID = '00000000-0000-4000-8000-0000000000aa'

function actor(permissions: readonly string[]): Actor {
  return { id: '00000000-0000-4000-8000-000000000001', companyId: COMPANY_ID, permissions }
}

describe('hasConfigurePermission', () => {
  it('R37: es verdadero con integraciones.modificar', () => {
    expect(hasConfigurePermission(actor(['documentos.modificar', 'integraciones.modificar']))).toBe(true)
  })

  it('R37: es falso sin el permiso, con otro permiso o sin actor, y no lanza', () => {
    expect(hasConfigurePermission(actor([]))).toBe(false)
    expect(hasConfigurePermission(actor(['documentos.modificar']))).toBe(false)
    expect(hasConfigurePermission(null)).toBe(false)
    expect(hasConfigurePermission(undefined)).toBe(false)
  })
})
