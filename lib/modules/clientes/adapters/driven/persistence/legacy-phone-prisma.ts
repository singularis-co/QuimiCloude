import { isSupportedCountry, type CountryCode } from 'libphonenumber-js/max';

import { prisma } from '@/lib/shared/db/prisma';

import { customerCompanyScope } from './company-scope';
import { createCustomerPhoneRepository } from './customer-phone-prisma';

import type { Prisma } from '@prisma/client';

import type { CustomerScope } from '../../../domain/customer-scope';
import type { LegacyPhoneOutcome, LegacyPhonePlan } from '../../../domain/legacy-phone-backfill';
import type { LegacyPhoneCompanyResult } from '../../../ports/legacy-phone-repository';

const DUPLICATE = 'duplicate';

const CANDIDATE: Prisma.CustomerWhereInput = {
  deletedAt: null,
  phone: { not: null },
  phoneE164: null,
  OR: [{ phoneIssue: null }, { phoneIssue: DUPLICATE }],
};

const NOTHING: LegacyPhoneCompanyResult = { converted: 0, invalid: 0, reconverted: 0 };

/** Solo la fila en `duplicate` trae su pais: la pendiente se lee con el de la empresa. */
function countryOfDuplicate(phoneIssue: string | null, phoneCountry: string | null): CountryCode | null {
  if (phoneIssue !== DUPLICATE || phoneCountry === null) return null;
  return isSupportedCountry(phoneCountry) ? phoneCountry : null;
}

type Written = { readonly outcome: LegacyPhoneOutcome; readonly wasDuplicate: boolean };

function summarize(written: readonly Written[]): LegacyPhoneCompanyResult {
  let converted = 0;
  let invalid = 0;
  let reconverted = 0;
  for (const { outcome, wasDuplicate } of written) {
    if (outcome.phoneIssue === 'invalid_format') invalid += 1;
    else if (wasDuplicate) reconverted += 1;
    else converted += 1;
  }
  return { converted, invalid, reconverted };
}

/**
 * Cada `UPDATE` vuelve a exigir que la fila siga como se leyo: si alguien la edito entre la
 * lectura y la escritura, se deja como la dejo esa edicion y no se le crea vinculo. Sin
 * `updated_by`: no es una edicion de negocio.
 *
 * `updatedAt` es `@updatedAt` en el esquema: Prisma lo sella con la hora de la corrida en todo
 * `UPDATE` que no lo traiga. Por eso se reescribe el valor LEIDO. El `where` exige ademas que no
 * se haya movido desde la lectura (dentro del mismo milisegundo, que es lo que un `Date` guarda).
 */
export async function processLegacyPhonesOfCompany(
  plan: LegacyPhonePlan,
  scope: CustomerScope,
): Promise<LegacyPhoneCompanyResult> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.customer.findMany({
        where: { ...CANDIDATE, ...customerCompanyScope(scope) },
        select: { id: true, phone: true, phoneCountry: true, phoneIssue: true, updatedAt: true },
        orderBy: { id: 'asc' },
      });
      if (rows.length === 0) return NOTHING;

      const outcomes = plan(
        rows.map((row) => ({
          id: row.id,
          phone: row.phone ?? '',
          phoneCountry: countryOfDuplicate(row.phoneIssue, row.phoneCountry),
        })),
      );

      const phones = createCustomerPhoneRepository(tx);
      const now = new Date();
      const readById = new Map(rows.map((row) => [row.id, row]));
      // El resumen cuenta lo que se escribio, no el plan: una fila que dejo de ser candidata da
      // `count` 0 y no entra.
      const written: Written[] = [];
      for (const outcome of outcomes) {
        const read = readById.get(outcome.id);
        if (read === undefined) continue;
        const { count } = await tx.customer.updateMany({
          where: {
            id: outcome.id,
            deletedAt: null,
            phone: { not: null },
            phoneE164: null,
            phoneIssue: read.phoneIssue,
            updatedAt: { gte: read.updatedAt, lt: new Date(read.updatedAt.getTime() + 1) },
            ...customerCompanyScope(scope),
          },
          data: {
            phoneCountry: outcome.phoneCountry,
            phoneE164: outcome.phoneE164,
            phoneIssue: outcome.phoneIssue,
            updatedAt: read.updatedAt,
          },
        });
        if (count !== 1) continue;
        if (outcome.phoneE164 !== null) await phones.addLink(outcome.id, outcome.phoneE164, true, now, scope);
        written.push({ outcome, wasDuplicate: read.phoneIssue === DUPLICATE });
      }
      return summarize(written);
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}
