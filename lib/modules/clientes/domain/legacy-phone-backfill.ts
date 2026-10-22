import { parseCustomerPhoneText } from './customer-phone';

import type { CountryCode } from 'libphonenumber-js/max';

export type LegacyPhoneRow = {
  readonly id: string;
  readonly phone: string;
  /** El pais con el que se interpreto la fila en una pasada anterior; `null` si nunca se interpreto. */
  readonly phoneCountry: CountryCode | null;
};

export type LegacyPhoneOutcome =
  | {
      readonly id: string;
      readonly phoneCountry: CountryCode;
      readonly phoneE164: string;
      readonly phoneIssue: null;
    }
  | {
      readonly id: string;
      readonly phoneCountry: CountryCode;
      readonly phoneE164: null;
      readonly phoneIssue: 'invalid_format';
    };

export type LegacyPhonePlan = (rows: readonly LegacyPhoneRow[]) => readonly LegacyPhoneOutcome[];

/**
 * Que hacer con cada telefono antiguo de UNA empresa. Cada fila se lee con su propio pais si ya lo
 * tiene y, si no, con `country`. Un mismo numero puede quedar en varios clientes.
 */
export function planLegacyPhoneBackfill(
  rows: readonly LegacyPhoneRow[],
  country: CountryCode,
): readonly LegacyPhoneOutcome[] {
  return rows.map((row) => {
    const rowCountry = row.phoneCountry ?? country;
    const parsed = parseCustomerPhoneText(row.phone, rowCountry);
    if (parsed.kind === 'invalid') {
      return { id: row.id, phoneCountry: rowCountry, phoneE164: null, phoneIssue: 'invalid_format' };
    }
    return { id: row.id, phoneCountry: parsed.phoneCountry, phoneE164: parsed.phoneE164, phoneIssue: null };
  });
}
