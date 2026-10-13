import { describe, expect, it, vi } from 'vitest';

import {
  VIEW_COUNT_QUERY,
  readViewCounts,
  toViewCounts,
  type ViewCountReader,
  type ViewCountReaders,
} from '@/app/(private)/asignacion/components/assignment-view-counts';
import type { AssignmentViewKind } from '@/lib/modules/asignaciones';

function lectorCon(total: number) {
  return vi.fn<ViewCountReader>(async () => ({ total }));
}

function lectores(overrides: Partial<ViewCountReaders> = {}): ViewCountReaders {
  return {
    asignados: lectorCon(1),
    terminados: lectorCon(2),
    todos: lectorCon(3),
    por_empacar: lectorCon(4),
    por_acondicionar: lectorCon(5),
    acondicionados: lectorCon(6),
    acondicionados_entregados: lectorCon(7),
    ...overrides,
  };
}

describe('readViewCounts', () => {
  it('R10: llama a la lista de cada vista con la primera página de una fila y sin filtros', async () => {
    const readers = lectores();
    const views: readonly AssignmentViewKind[] = ['asignados', 'terminados', 'por_empacar'];

    await readViewCounts(views, readers);

    expect(VIEW_COUNT_QUERY).toEqual({ page: 1, pageSize: 1 });
    for (const view of views) {
      expect(readers[view]).toHaveBeenCalledTimes(1);
      expect(readers[view]).toHaveBeenCalledWith({ page: 1, pageSize: 1 });
    }
  });

  it('R10: no lee las vistas que el usuario no tiene', async () => {
    const readers = lectores();

    await readViewCounts(['por_acondicionar', 'acondicionados'], readers);

    expect(readers.asignados).not.toHaveBeenCalled();
    expect(readers.todos).not.toHaveBeenCalled();
    expect(readers.acondicionados_entregados).not.toHaveBeenCalled();
  });

  it('R10: el contador es el `total` de la lista', async () => {
    const counts = await readViewCounts(
      ['por_acondicionar', 'acondicionados', 'acondicionados_entregados'],
      lectores({ acondicionados_entregados: lectorCon(0) }),
    );

    expect(counts).toEqual({ por_acondicionar: 5, acondicionados: 6, acondicionados_entregados: 0 });
  });

  it('R11: una vista cuya lista falla queda sin contador y el resto se lee igual, sin lanzar', async () => {
    const falla = vi.fn<ViewCountReader>(async () => {
      throw new Error('fallo de lectura');
    });

    const counts = await readViewCounts(['asignados', 'terminados'], lectores({ terminados: falla }));

    expect(counts).toEqual({ asignados: 1 });
    expect(counts).not.toHaveProperty('terminados');
  });

  it('R11: un lector que lanza sin promesa tampoco tumba la lectura', async () => {
    const lanza = vi.fn<ViewCountReader>(() => {
      throw new Error('fallo síncrono');
    });

    await expect(readViewCounts(['todos', 'por_empacar'], lectores({ todos: lanza }))).resolves.toEqual({
      por_empacar: 4,
    });
  });
});

describe('toViewCounts', () => {
  it('R10, R11: casa cada resultado con su vista por posición y salta los rechazados', () => {
    expect(
      toViewCounts(
        ['asignados', 'terminados', 'todos'],
        [
          { status: 'fulfilled', value: { total: 9 } },
          { status: 'rejected', reason: new Error('x') },
          { status: 'fulfilled', value: { total: 0 } },
        ],
      ),
    ).toEqual({ asignados: 9, todos: 0 });
  });
});
