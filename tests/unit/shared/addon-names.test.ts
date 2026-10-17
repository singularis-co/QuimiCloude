import { describe, expect, expectTypeOf, it } from 'vitest';

import { ADDONS, type Addon } from '@/lib/modules/identity';
import { ADDON_NAMES, type AddonNameKey } from '@/lib/shared/ui/addon-names';

describe('ADDON_NAMES', () => {
  it('R32: la clave propia es exactamente el tipo `Addon` del dominio', () => {
    expectTypeOf<AddonNameKey>().toEqualTypeOf<Addon>();
  });

  it('R32: hay un nombre por cada añadido del catálogo, ni uno más ni uno menos', () => {
    expect(Object.keys(ADDON_NAMES).sort()).toEqual([...ADDONS].sort());
  });

  it('R32: los nombres son los del tablero aprobado', () => {
    expect(ADDON_NAMES).toEqual({
      dashboard: 'Dashboard y recorrido',
      proveedores: 'Proveedores',
      lectura_pdf: 'Lectura de PDF con IA',
      importacion_excel: 'Importación desde Excel',
      integraciones: 'Integraciones',
    });
  });

  it('R33: un añadido fuera del catálogo no tiene nombre, para que quien pinte caiga al texto genérico', () => {
    expect(Object.hasOwn(ADDON_NAMES, 'desconocido')).toBe(false);
    for (const nombre of Object.values(ADDON_NAMES)) {
      expect(nombre.trim()).not.toBe('');
    }
  });
});
