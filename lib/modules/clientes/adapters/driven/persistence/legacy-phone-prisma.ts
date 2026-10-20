import { prisma } from '@/lib/shared/db/prisma';

import { customerCompanyScope } from './company-scope';

import type { CustomerScope } from '../../../domain/customer-scope';
import type { LegacyPhoneOutcome, LegacyPhonePlan } from '../../../domain/legacy-phone-backfill';
import type { LegacyPhoneCompanyResult } from '../../../ports/legacy-phone-repository';

const PENDING = { deletedAt: null, phone: { not: null }, phoneE164: null, phoneIssue: null } as const;

function summarize(outcomes: readonly LegacyPhoneOutcome[]): LegacyPhoneCompanyResult {
  let converted = 0;
  let invalid = 0;
  let duplicate = 0;
  for (const outcome of outcomes) {
    if (outcome.phoneIssue === null) converted += 1;
    else if (outcome.phoneIssue === 'invalid_format') invalid += 1;
    else duplicate += 1;
  }
  return { converted, invalid, duplicate };
}

/**
 * Cada `UPDATE` vuelve a exigir que la fila siga pendiente: si alguien la edito entre la lectura
 * y la escritura, ya no lo esta y se deja como la dejo esa edicion. Sin `updated_at` ni
 * `updated_by`: no es una edicion de negocio (R27, D6).
 *
 * `updatedAt` es `@updatedAt` en el esquema: Prisma lo sella con la hora de la corrida en todo
 * `UPDATE` que no lo traiga. Por eso se reescribe el valor LEIDO. El `where` exige ademas que no
 * se haya movido desde la lectura (dentro del mismo milisegundo, que es lo que un `Date` guarda):
 * una edicion que no saca la fila de pendiente no se devuelve atras.
 */
export async function processLegacyPhonesOfCompany(
  plan: LegacyPhonePlan,
  scope: CustomerScope,
): Promise<LegacyPhoneCompanyResult> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.customer.findMany({
        where: { ...PENDING, ...customerCompanyScope(scope) },
        select: { id: true, phone: true, createdAt: true, updatedAt: true },
        orderBy: { id: 'asc' },
      });
      if (rows.length === 0) return { converted: 0, invalid: 0, duplicate: 0 };

      const taken = await tx.customer.findMany({
        where: { deletedAt: null, phoneE164: { not: null }, ...customerCompanyScope(scope) },
        select: { phoneE164: true },
      });

      const outcomes = plan(
        rows.map((row) => ({ id: row.id, phone: row.phone ?? '', createdAt: row.createdAt })),
        new Set(taken.map((row) => row.phoneE164).filter((e164): e164 is string => e164 !== null)),
      );

      // El resumen cuenta lo que se escribio, no el plan: una fila que dejo de estar pendiente da
      // `count` 0 y no entra.
      const readUpdatedAt = new Map(rows.map((row) => [row.id, row.updatedAt]));
      const written: LegacyPhoneOutcome[] = [];
      for (const outcome of outcomes) {
        const updatedAt = readUpdatedAt.get(outcome.id);
        if (updatedAt === undefined) continue;
        const { count } = await tx.customer.updateMany({
          where: {
            id: outcome.id,
            ...PENDING,
            updatedAt: { gte: updatedAt, lt: new Date(updatedAt.getTime() + 1) },
            ...customerCompanyScope(scope),
          },
          data: {
            phoneCountry: outcome.phoneCountry,
            phoneE164: outcome.phoneE164,
            phoneIssue: outcome.phoneIssue,
            updatedAt,
          },
        });
        if (count === 1) written.push(outcome);
      }
      return summarize(written);
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}
