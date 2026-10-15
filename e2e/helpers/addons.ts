// QC-277 — prende todos los añadidos a una empresa de fixture (R20, design.md > 10.2).
//
// Una empresa nace sin añadidos. Los specs que crean su empresa propia y entran en un añadido
// (dashboard, proveedores, documentos, importacion, integraciones) la llaman tras crearla. El censo
// de quien la necesita se hace en T20, y solo por esa causa.
import { ADDONS } from '@/lib/modules/identity';
import { prisma } from '@/lib/shared/db/prisma';

/** Guarda los cinco interruptores prendidos en la empresa `companyId`. */
export async function enableAllAddons(companyId: string): Promise<void> {
  await prisma.company.update({ where: { id: companyId }, data: { addons: [...ADDONS] } });
}
