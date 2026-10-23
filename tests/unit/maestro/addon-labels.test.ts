// Textos puros de la pestaña Módulos: etiquetas, toasts y lo que se descarta al apagar.
import { describe, expect, it } from 'vitest';

import {
  ADDON_LABELS,
  changedAddons,
  successMessage,
} from '@/app/(private)/maestro/empresas/[id]/components/modulos/addon-labels';
import { offConsequences } from '@/app/(private)/maestro/empresas/[id]/components/modulos/addon-off-consequences';
import { ADDONS, type Addon, type CompanyAddonsView } from '@/lib/modules/identity';
import { ADDON_DETAILS } from '@/lib/shared/ui/addon-details';
import { ADDON_NAMES } from '@/lib/shared/ui/addon-names';

const LECTURAS_FALLIDAS = 'Las lecturas de PDF en cola terminan como fallidas.';
const REVISIONES_OCULTAS = 'Las revisiones sin confirmar quedan ocultas hasta que lo vuelvas a prender.';
const LECTURA_DEJA_DE_FUNCIONAR =
  'Lectura de PDF con IA deja de funcionar aunque siga prendida, porque la necesita.';

function vista(prendidos: readonly Addon[]): CompanyAddonsView {
  return {
    companyId: '2d8e9f0a-3142-4c5d-8e6f-7a8b9c0d1e2f',
    addons: ADDONS.map((addon) => ({
      addon,
      enabled: prendidos.includes(addon),
      active: prendidos.includes(addon),
      requires: addon === 'lectura_pdf' ? ['integraciones'] : [],
    })),
  };
}

describe('ADDON_LABELS', () => {
  it('R5: hay una etiqueta por añadido del catálogo, con nombre, descripción e icono de lib/shared/ui', () => {
    expect(Object.keys(ADDON_LABELS)).toEqual([...ADDONS]);
    expect(Object.keys(ADDON_DETAILS)).toEqual([...ADDONS]);
    for (const addon of ADDONS) {
      expect(ADDON_LABELS[addon].name).toBe(ADDON_NAMES[addon]);
      expect(ADDON_LABELS[addon].description).toBe(ADDON_DETAILS[addon].description);
      expect(ADDON_LABELS[addon].icon).toBe(ADDON_DETAILS[addon].icon);
      expect(ADDON_LABELS[addon].description).not.toBe('');
      expect(ADDON_LABELS[addon].icon).toBeDefined();
    }
  });

  it('R5: las descripciones son las de la pregunta 1, cerrada', () => {
    expect(Object.fromEntries(ADDONS.map((addon) => [addon, ADDON_LABELS[addon].description]))).toEqual({
      dashboard: 'Indicadores del día y recorrido de cada pedido.',
      proveedores: 'Directorio de proveedores y su catálogo.',
      lectura_pdf: 'Lee fórmulas y catálogos desde un PDF.',
      importacion_excel: 'Carga inventario y catálogos desde una hoja de cálculo.',
      integraciones: 'Proveedor IA, Inventarios y WhatsApp.',
    });
  });
});

describe('changedAddons', () => {
  it('R15: devuelve solo los añadidos cuyo interruptor cambió, en el orden de la vista', () => {
    const antes = vista(['proveedores', 'integraciones']);
    const despues = vista(['dashboard', 'proveedores', 'lectura_pdf', 'integraciones']);
    expect(changedAddons(antes, despues)).toEqual(['dashboard', 'lectura_pdf']);
    expect(changedAddons(antes, antes)).toEqual([]);
  });
});

describe('successMessage', () => {
  it('R15: mensajes de toast en singular y plural', () => {
    expect(successMessage(['proveedores'], true, 'one')).toBe('Proveedores prendido.');
    expect(successMessage(['lectura_pdf'], false, 'one')).toBe('Lectura de PDF con IA apagado.');
    expect(successMessage(['proveedores'], true, 'all')).toBe('Se prendió 1 módulo.');
    expect(successMessage(['proveedores'], false, 'all')).toBe('Se apagó 1 módulo.');
    expect(successMessage(['dashboard', 'proveedores', 'integraciones'], true, 'all')).toBe(
      'Se prendieron 3 módulos.',
    );
    expect(successMessage(['dashboard', 'proveedores'], false, 'all')).toBe('Se apagaron 2 módulos.');
  });
});

describe('offConsequences', () => {
  it('R10: cada añadido lista lo que se descarta al apagarlo', () => {
    const todos = vista(ADDONS);
    expect(offConsequences(['lectura_pdf'], todos)).toEqual([LECTURAS_FALLIDAS, REVISIONES_OCULTAS]);
    expect(offConsequences(['importacion_excel'], todos)).toEqual([REVISIONES_OCULTAS]);
    expect(offConsequences(['dashboard'], todos)).toEqual([]);
    expect(offConsequences(['proveedores'], todos)).toEqual([]);
  });

  it('R10: Integraciones solo avisa de la lectura si está prendida', () => {
    expect(offConsequences(['integraciones'], vista(['lectura_pdf', 'integraciones']))).toEqual([
      LECTURA_DEJA_DE_FUNCIONAR,
    ]);
    expect(offConsequences(['integraciones'], vista(['integraciones']))).toEqual([]);
  });

  it('R12: Apagar todos junta lo que se descarta sin repetir, en el orden del catálogo y sin la línea de Integraciones', () => {
    expect(offConsequences([...ADDONS].reverse(), vista(ADDONS))).toEqual([
      LECTURAS_FALLIDAS,
      REVISIONES_OCULTAS,
    ]);
    expect(offConsequences(['integraciones', 'importacion_excel'], vista(ADDONS))).toEqual([
      REVISIONES_OCULTAS,
    ]);
  });
});
