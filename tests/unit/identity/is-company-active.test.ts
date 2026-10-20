// Si una empresa vive, con el puerto simulado.
import { describe, expect, it, vi } from 'vitest';

import { createIsCompanyActive } from '@/lib/modules/identity';

import type { CompanyMembershipReader } from '@/lib/modules/identity/ports/company-membership-reader';

const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';

function setup(answer: boolean) {
  const isCompanyActive = vi.fn<CompanyMembershipReader['isCompanyActive']>(async () => answer);
  return { check: createIsCompanyActive({ members: { isCompanyActive } }), isCompanyActive };
}

describe('isCompanyActive', () => {
  it('QC-137 R57: devuelve lo que responde el puerto para esa empresa', async () => {
    const viva = setup(true);
    expect(await viva.check(COMPANY_ID)).toBe(true);
    expect(viva.isCompanyActive).toHaveBeenCalledWith(COMPANY_ID);

    expect(await setup(false).check(COMPANY_ID)).toBe(false);
  });

  it.each([[''], ['empresa-1']])('QC-137 R57: una empresa que no es UUID (%s) da false sin tocar el puerto', async (id) => {
    const { check, isCompanyActive } = setup(true);

    expect(await check(id)).toBe(false);
    expect(isCompanyActive).not.toHaveBeenCalled();
  });
});
