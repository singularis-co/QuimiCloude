import { type Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { ADDONS, isAddon, type Addon } from '../../../domain/company-addons';

import { atomically } from './company-prisma';

import type { CompanyEventKind } from '../../../domain/company-event';
import type { AddonChange, CompanyAddonRepository } from '../../../ports/company-addon-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

// La base guarda texto sin lista cerrada: una clave que el catálogo no conoce no concede nada, y
// esta escritura no la borra.
function nextAddons(
  stored: readonly string[],
  enable: readonly Addon[],
  disable: readonly Addon[],
): string[] {
  const on = new Set<string>(stored.filter(isAddon));
  for (const addon of disable) on.delete(addon);
  for (const addon of enable) on.add(addon);
  const unknown = stored.filter((key) => !isAddon(key));
  return [...ADDONS.filter((addon) => on.has(addon)), ...unknown];
}

function changesBetween(before: readonly string[], after: readonly string[]): AddonChange[] {
  return ADDONS.filter((addon) => before.includes(addon) !== after.includes(addon)).map(
    (addon) => ({ addon, enabled: after.includes(addon) }),
  );
}

export function createCompanyAddonRepository(db: PrismaLike = prisma): CompanyAddonRepository {
  return {
    async findByCompany(companyId) {
      const row = await db.company.findUnique({
        where: { id: companyId },
        select: { addons: true, deletedAt: true },
      });
      if (row === null) return null;
      return { stored: row.addons, alive: row.deletedAt === null };
    },

    async apply({ companyId, enable = [], disable = [], actorId, now }) {
      return atomically(db, async (tx) => {
        const rows = await tx.$queryRaw<Array<{ addons: string[] }>>`
          SELECT addons FROM companies
          WHERE id = ${companyId}::uuid AND deleted_at IS NULL FOR UPDATE`;
        const current = rows[0];
        if (current === undefined) return 'not_found' as const;

        const stored = nextAddons(current.addons, enable, disable);
        const changed = changesBetween(current.addons, stored);
        if (changed.length === 0) return { stored: current.addons, changed };

        await tx.company.update({
          where: { id: companyId },
          data: { addons: stored, updatedAt: now },
          select: { id: true },
        });
        for (const change of changed) {
          const kind: CompanyEventKind = change.enabled ? 'addon.enabled' : 'addon.disabled';
          await tx.companyEvent.create({
            data: { companyId, kind, actorId, occurredAt: now, details: { addon: change.addon } },
            select: { id: true },
          });
        }
        return { stored, changed };
      });
    },
  };
}
