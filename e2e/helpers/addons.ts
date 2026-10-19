// QC-277 — prende todos los añadidos a una empresa de fixture (R20, design.md > 10.2).
//
// Una empresa nace sin añadidos: sin fila en `company_addon_overrides` no hay añadido prendido.
// Los specs que crean su empresa propia y entran en un añadido (dashboard, proveedores, documentos,
// importacion, integraciones) la llaman tras crearla. El censo de quien la necesita se hace en T20,
// y solo por esa causa.
import { ADDONS } from '@/lib/modules/identity';
import { prisma } from '@/lib/shared/db/prisma';

/**
 * Deja todas las excepciones de la empresa `companyId` en `enabled = true`. Sin autor (P7): las
 * siembra el fixture, no un Maestro. `upsert` para que sirva tambien sobre una empresa que ya tenia
 * alguna excepcion, prendida o apagada.
 */
export async function enableAllAddons(companyId: string): Promise<void> {
  await prisma.$transaction(
    ADDONS.map((addonKey) =>
      prisma.companyAddonOverride.upsert({
        where: { companyId_addonKey: { companyId, addonKey } },
        create: { companyId, addonKey, enabled: true },
        update: { enabled: true },
      }),
    ),
  );
}
