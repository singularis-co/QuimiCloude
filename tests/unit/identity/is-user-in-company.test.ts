// La pertenencia de un usuario a una empresa, con el puerto simulado.
import { describe, expect, it, vi } from 'vitest';

import { createIsUserInCompany } from '@/lib/modules/identity';

import type { CompanyMembershipReader } from '@/lib/modules/identity/ports/company-membership-reader';

const USER_ID = '3f2b1c9e-0d4a-4c8b-9e77-2a5f6c1d8b40';
const COMPANY_ID = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';

function setup(answer: boolean) {
  const isUserInCompany = vi.fn<CompanyMembershipReader['isUserInCompany']>(async () => answer);
  return { check: createIsUserInCompany({ members: { isUserInCompany } }), isUserInCompany };
}

describe('isUserInCompany', () => {
  it('QC-137 R12: devuelve lo que responde el puerto para ese usuario y esa empresa', async () => {
    const dentro = setup(true);
    expect(await dentro.check(USER_ID, COMPANY_ID)).toBe(true);
    expect(dentro.isUserInCompany).toHaveBeenCalledWith(USER_ID, COMPANY_ID);

    const fuera = setup(false);
    expect(await fuera.check(USER_ID, COMPANY_ID)).toBe(false);
  });

  const NO_UUID: ReadonlyArray<{ caso: string; userId: string; companyId: string }> = [
    { caso: 'usuario vacío', userId: '', companyId: COMPANY_ID },
    { caso: 'usuario que no es UUID', userId: 'usuario-1', companyId: COMPANY_ID },
    { caso: 'empresa que no es UUID', userId: USER_ID, companyId: 'empresa-1' },
  ];

  for (const { caso, userId, companyId } of NO_UUID) {
    it(`QC-137 R12: ${caso} → false sin tocar el puerto`, async () => {
      const { check, isUserInCompany } = setup(true);

      expect(await check(userId, companyId)).toBe(false);
      expect(isUserInCompany).not.toHaveBeenCalled();
    });
  }
});
