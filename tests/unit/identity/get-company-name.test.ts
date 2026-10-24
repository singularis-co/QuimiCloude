import { describe, expect, it, vi } from 'vitest'

import { createGetCompanyName } from '@/lib/modules/identity'

describe('getCompanyName', () => {
  it('R56: devuelve el nombre que lee el puerto para esa empresa', async () => {
    const findNameOf = vi.fn(async (companyId: string) => (companyId === 'company-1' ? 'Quimica Andina' : null))
    const getCompanyName = createGetCompanyName({ companies: { findNameOf } })

    await expect(getCompanyName('company-1')).resolves.toBe('Quimica Andina')
    expect(findNameOf).toHaveBeenCalledTimes(1)
    expect(findNameOf).toHaveBeenCalledWith('company-1')
  })

  it('R56: una empresa sin nombre legible (inexistente o dada de baja) da null, no una cadena vacia', async () => {
    const getCompanyName = createGetCompanyName({
      companies: { findNameOf: async () => null },
    })

    await expect(getCompanyName('company-2')).resolves.toBeNull()
  })
})
