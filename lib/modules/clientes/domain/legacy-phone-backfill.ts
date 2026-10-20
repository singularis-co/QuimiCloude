import { parseCustomerPhoneText } from './customer-phone';

import type { CountryCode } from 'libphonenumber-js/max';

export type LegacyPhoneRow = {
  readonly id: string;
  readonly phone: string;
  readonly createdAt: Date;
};

/** Los `phone_e164` que ya tienen clientes vivos de la empresa. */
export type TakenE164 = ReadonlySet<string>;

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
      readonly phoneIssue: 'invalid_format' | 'duplicate';
    };

export type LegacyPhonePlan = (
  rows: readonly LegacyPhoneRow[],
  taken: TakenE164,
) => readonly LegacyPhoneOutcome[];

type ValidRow = { readonly row: LegacyPhoneRow; readonly phoneCountry: CountryCode; readonly phoneE164: string };

function newestFirst(a: LegacyPhoneRow, b: LegacyPhoneRow): number {
  const byDate = b.createdAt.getTime() - a.createdAt.getTime();
  if (byDate !== 0) return byDate;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/**
 * Que hacer con cada telefono antiguo de UNA empresa. `country` es el pais con el que se lee el
 * texto que no trae `+`. De un mismo numero solo se lo queda el cliente mas reciente, y ninguno si
 * ya lo tiene otro cliente vivo.
 */
export function planLegacyPhoneBackfill(
  rows: readonly LegacyPhoneRow[],
  country: CountryCode,
  taken: TakenE164,
): readonly LegacyPhoneOutcome[] {
  const outcomes = new Map<string, LegacyPhoneOutcome>();
  const groups = new Map<string, ValidRow[]>();

  for (const row of rows) {
    const parsed = parseCustomerPhoneText(row.phone, country);
    if (parsed.kind === 'invalid') {
      outcomes.set(row.id, { id: row.id, phoneCountry: country, phoneE164: null, phoneIssue: 'invalid_format' });
      continue;
    }
    const group = groups.get(parsed.phoneE164) ?? [];
    group.push({ row, phoneCountry: parsed.phoneCountry, phoneE164: parsed.phoneE164 });
    groups.set(parsed.phoneE164, group);
  }

  for (const [e164, group] of groups) {
    const ordered = [...group].sort((a, b) => newestFirst(a.row, b.row));
    ordered.forEach((valid, index) => {
      const keeps = index === 0 && !taken.has(e164);
      outcomes.set(
        valid.row.id,
        keeps
          ? { id: valid.row.id, phoneCountry: valid.phoneCountry, phoneE164: e164, phoneIssue: null }
          : { id: valid.row.id, phoneCountry: valid.phoneCountry, phoneE164: null, phoneIssue: 'duplicate' },
      );
    });
  }

  return rows.map((row) => outcomes.get(row.id)).filter((o): o is LegacyPhoneOutcome => o !== undefined);
}
