import { planLegacyPhoneBackfill } from './legacy-phone-backfill';

import type { CompanyCountryLookup } from '../ports/company-country-lookup';
import type { LegacyPhoneRepository } from '../ports/legacy-phone-repository';

export type BackfillLegacyPhonesDeps = {
  /** Las empresas activas, una vuelta por cada una. */
  readonly listCompanyIds: () => Promise<readonly string[]>;
  readonly legacyPhones: LegacyPhoneRepository;
  readonly companyCountryOf: CompanyCountryLookup;
};

export type BackfillLegacyPhonesSummary = {
  readonly companies: number;
  readonly converted: number;
  readonly invalid: number;
  readonly reconverted: number;
};

const FALLBACK_COUNTRY = 'CO';

/**
 * Sin actor: corre en el build, fuera de cualquier sesion. Cada empresa va en su propia
 * transaccion y ninguna consulta lee clientes de dos empresas a la vez. Un fallo se propaga: el
 * build tiene que fallar.
 */
export function createBackfillLegacyPhones(
  deps: BackfillLegacyPhonesDeps,
): () => Promise<BackfillLegacyPhonesSummary> {
  return async function backfillLegacyPhones(): Promise<BackfillLegacyPhonesSummary> {
    const companyIds = await deps.listCompanyIds();
    let converted = 0;
    let invalid = 0;
    let reconverted = 0;

    for (const companyId of companyIds) {
      const country = (await deps.companyCountryOf(companyId)) ?? FALLBACK_COUNTRY;
      const result = await deps.legacyPhones.processCompany(
        (rows) => planLegacyPhoneBackfill(rows, country),
        { companyId },
      );
      converted += result.converted;
      invalid += result.invalid;
      reconverted += result.reconverted;
    }

    return { companies: companyIds.length, converted, invalid, reconverted };
  };
}
