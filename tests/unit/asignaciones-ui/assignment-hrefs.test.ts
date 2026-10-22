// Las direcciones de /asignacion salen de dos constructores. Las cadenas esperadas estan escritas a
// mano a proposito: son las que producian los constructores que se borraron, caracter a caracter.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { assignedOrdersListHref, assignmentViewHref } from '@/app/(private)/asignacion/components';
import type { DataTableParams } from '@/components/shared/data-table';
import type { AssignmentViewKind } from '@/lib/modules/asignaciones';

function parametros(overrides: Partial<DataTableParams> = {}): DataTableParams {
  return { page: 1, pageSize: 10, sort: null, filters: {}, search: '', ...overrides };
}

const LISTAS: readonly { readonly vista: AssignmentViewKind; readonly page: number; readonly pageSize: number; readonly esperada: string }[] = [
  { vista: 'por_acondicionar', page: 1, pageSize: 25, esperada: '/asignacion?page=1&pageSize=25&vista=por_acondicionar' },
  { vista: 'acondicionados', page: 2, pageSize: 50, esperada: '/asignacion?page=2&pageSize=50&vista=acondicionados' },
  { vista: 'acondicionados', page: 3, pageSize: 10, esperada: '/asignacion?page=3&pageSize=10&vista=acondicionados' },
  { vista: 'terminados', page: 1, pageSize: 100, esperada: '/asignacion?page=1&pageSize=100&vista=terminados' },
  { vista: 'por_empacar', page: 4, pageSize: 25, esperada: '/asignacion?page=4&pageSize=25&vista=por_empacar' },
];

describe('direcciones de las listas de /asignacion (R1)', () => {
  it.each(LISTAS)('$vista: page, pageSize y vista en ese orden', ({ vista, page, pageSize, esperada }) => {
    expect(assignedOrdersListHref(parametros({ page, pageSize }), vista)).toBe(esperada);
  });

  it('el orden, el filtro y la búsqueda no entran en la dirección', () => {
    const params = parametros({
      page: 2,
      pageSize: 25,
      sort: { columnId: 'orderNumber', direction: 'asc' },
      search: 'abc',
    });
    expect(assignedOrdersListHref(params, 'terminados')).toBe('/asignacion?page=2&pageSize=25&vista=terminados');
  });
});

describe('vuelta a «Por empacar» (R2)', () => {
  it('apunta a la vista sin página ni tamaño', () => {
    expect(assignmentViewHref('por_empacar')).toBe('/asignacion?vista=por_empacar');
  });
});

const RUTA = join(process.cwd(), 'app', '(private)', 'asignacion');
const SIMBOLOS_BORRADOS = [
  'finishedOrdersHref',
  'packingOrdersHref',
  'BACK_HREF',
  'conditioningOrdersHref',
  'conditionedOrdersHref',
  'deliveredConditionedOrdersHref',
  'ConditioningListView',
  'conditioning-orders-href',
] as const;

function archivosDeCodigo(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const ruta = join(dir, entry.name);
    if (entry.isDirectory()) return archivosDeCodigo(ruta);
    return /\.tsx?$/.test(entry.name) ? [ruta] : [];
  });
}

describe('los constructores sueltos ya no existen (R3)', () => {
  it('no queda conditioning-orders-href.ts', () => {
    expect(existsSync(join(RUTA, 'components', 'conditioning-orders-href.ts'))).toBe(false);
  });

  it('ningún archivo de la ruta nombra un constructor borrado', () => {
    const hallazgos = archivosDeCodigo(RUTA).flatMap((archivo) => {
      const fuente = readFileSync(archivo, 'utf8');
      return SIMBOLOS_BORRADOS.filter((simbolo) => fuente.includes(simbolo)).map(
        (simbolo) => `${archivo}: ${simbolo}`,
      );
    });
    expect(hallazgos).toEqual([]);
  });
});
