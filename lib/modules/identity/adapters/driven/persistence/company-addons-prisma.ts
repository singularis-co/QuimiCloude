import { type Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { ADDONS, type Addon } from '../../../domain/company-addons';

import { atomically } from './company-prisma';

import type { CompanyEventKind } from '../../../domain/company-event';
import type { AddonChange, CompanyAddonRepository } from '../../../ports/company-addon-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

// Sin planes, un añadido está prendido solo si su excepción dice `enabled = true`: no tener fila o
// tenerla en `false` es estar apagado.
function inCatalogOrder(on: ReadonlySet<string>): Addon[] {
  return ADDONS.filter((addon) => on.has(addon));
}

function changesFor(
  on: ReadonlySet<string>,
  enable: readonly Addon[],
  disable: readonly Addon[],
): AddonChange[] {
  const next = new Set(on);
  for (const addon of disable) next.delete(addon);
  for (const addon of enable) next.add(addon);
  return ADDONS.filter((addon) => on.has(addon) !== next.has(addon)).map((addon) => ({
    addon,
    enabled: next.has(addon),
  }));
}

export function createCompanyAddonRepository(db: PrismaLike = prisma): CompanyAddonRepository {
  return {
    async findByCompany(companyId) {
      const row = await db.company.findUnique({
        where: { id: companyId },
        select: {
          deletedAt: true,
          addonOverrides: { where: { enabled: true }, select: { addonKey: true } },
        },
      });
      if (row === null) return null;
      const on = new Set(row.addonOverrides.map((o) => o.addonKey));
      return { stored: inCatalogOrder(on), alive: row.deletedAt === null };
    },

    async apply({ companyId, enable = [], disable = [], actorId, now }) {
      return atomically(db, async (tx) => {
        // Se bloquea la empresa y no las excepciones, que pueden no existir todavía: así dos
        // escrituras a la vez sobre la misma empresa se serializan.
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM companies
          WHERE id = ${companyId}::uuid AND deleted_at IS NULL FOR UPDATE`;
        if (rows[0] === undefined) return 'not_found' as const;

        const overrides = await tx.companyAddonOverride.findMany({
          where: { companyId, enabled: true },
          select: { addonKey: true },
        });
        const on = new Set(overrides.map((o) => o.addonKey));
        const changed = changesFor(on, enable, disable);
        if (changed.length === 0) return { stored: inCatalogOrder(on), changed };

        for (const { addon, enabled } of changed) {
          // Apagar escribe `false` y no borra: la fila guarda quién fijó el valor vigente y cuándo.
          await tx.companyAddonOverride.upsert({
            where: { companyId_addonKey: { companyId, addonKey: addon } },
            create: { companyId, addonKey: addon, enabled, createdBy: actorId, createdAt: now },
            update: { enabled, createdBy: actorId, createdAt: now },
            select: { addonKey: true },
          });
          if (enabled) on.add(addon);
          else on.delete(addon);
        }
        await tx.company.update({
          where: { id: companyId },
          data: { updatedAt: now },
          select: { id: true },
        });
        for (const change of changed) {
          const kind: CompanyEventKind = change.enabled ? 'addon.enabled' : 'addon.disabled';
          await tx.companyEvent.create({
            data: { companyId, kind, actorId, occurredAt: now, details: { addon: change.addon } },
            select: { id: true },
          });
        }
        return { stored: inCatalogOrder(on), changed };
      });
    },
  };
}
