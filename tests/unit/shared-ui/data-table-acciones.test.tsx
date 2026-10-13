// `actionsColumn({ menu })`: las acciones de la fila como datos. La celda pinta el menú ⋯ de la
// fila con esos ítems, y la columna conserva la forma de siempre (no ordena, no filtra).

import { cleanup, render, screen, within } from '@testing-library/react';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  actionsColumn,
  createDefaultParams,
  DataTable,
  type DataTableColumn,
  type DataTableTexts,
  type RowActionsSpec,
} from '@/components/shared/data-table';

import { setupUser } from '../../helpers/user-event';
import { clickRowAction, openRowActionsMenu } from '../../helpers/row-actions-menu';

type Fila = { readonly id: string; readonly nombre: string };

const FILAS: readonly Fila[] = [
  { id: 'f1', nombre: 'Ana' },
  { id: 'f2', nombre: 'Luis' },
];

const texts: DataTableTexts = {
  empty: 'vacio',
  loading: 'cargando',
  error: 'fallo',
  search: 'buscar',
  filters: 'filtros',
  columnMenu: 'menu-columna',
  previousPage: 'anterior',
  nextPage: 'siguiente',
  pageIndicator: (page, totalPages) => `${page}/${totalPages}`,
  pageSize: 'tamano',
  sortAscending: 'asc',
  sortDescending: 'desc',
  pinColumn: 'fijar',
  unpinColumn: 'soltar',
  filterColumn: 'filtrar',
  clearFilter: 'limpiar',
  lastWeek: 'ultima semana',
  lastMonth: 'ultimo mes',
  lastYear: 'ultimo año',
};

function menuDe(onDelete: (fila: Fila) => void) {
  return (fila: Fila): RowActionsSpec => ({
    triggerLabel: `Acciones de ${fila.nombre}`,
    triggerTestId: `acciones-${fila.id}`,
    items: [
      { key: 'edit', label: 'Editar', icon: PencilIcon, href: `/x/${fila.id}`, testId: `editar-${fila.id}` },
      {
        key: 'delete',
        label: 'Eliminar',
        icon: Trash2Icon,
        destructive: true,
        onSelect: () => onDelete(fila),
        testId: `eliminar-${fila.id}`,
      },
    ],
  });
}

function renderTabla(columns: readonly DataTableColumn<Fila>[]) {
  render(
    <DataTable
      tableId={`acciones-${Math.random()}`}
      columns={columns}
      rows={FILAS}
      getRowId={(fila) => fila.id}
      params={createDefaultParams()}
      totalPages={1}
      onParamsChange={vi.fn()}
      status="idle"
      texts={texts}
    />,
  );
}

const NOMBRE: DataTableColumn<Fila> = { id: 'nombre', label: 'Nombre', align: 'start', cell: (f) => f.nombre };

afterEach(cleanup);

describe('actionsColumn con menu', () => {
  it('R32: la columna guarda el menú y conserva la forma de siempre', () => {
    const menu = menuDe(vi.fn());
    const col = actionsColumn<Fila>({ menu });

    expect(col.id).toBe('actions');
    expect(col.align).toBe('end');
    expect(col.pinnable).toBe(false);
    expect(col.sortable).toBeUndefined();
    expect(col.filter).toBeUndefined();
    expect(col.menu).toBe(menu);
  });

  it('R32: con defaultPinned right nace fijada, también con menu', () => {
    const col = actionsColumn<Fila>({ menu: menuDe(vi.fn()), defaultPinned: 'right' });

    expect(col.defaultPinned).toBe('right');
    expect(col.pinnable).toBeUndefined();
  });

  it('R32: cada fila pinta su menú ⋯ con el nombre que declara', () => {
    renderTabla([NOMBRE, actionsColumn<Fila>({ menu: menuDe(vi.fn()) })]);

    const fila = screen.getByTestId('data-table-row-f2');
    const trigger = within(fila).getByTestId('acciones-f2');
    expect(trigger).toHaveAccessibleName('Acciones de Luis');
  });

  it('R32: el menú de la fila lleva los ítems declarados, en orden', async () => {
    const user = setupUser();
    renderTabla([NOMBRE, actionsColumn<Fila>({ menu: menuDe(vi.fn()) })]);

    const menu = await openRowActionsMenu(user, screen.getByTestId('acciones-f1'));
    const nombres = within(menu).getAllByRole('menuitem').map((item) => item.textContent);
    expect(nombres).toEqual(['Editar', 'Eliminar']);
    expect(within(menu).getByTestId('editar-f1')).toHaveAttribute('href', '/x/f1');
  });

  it('R32: elegir un ítem llama a su acción con la fila que toca', async () => {
    const user = setupUser();
    const onDelete = vi.fn();
    renderTabla([NOMBRE, actionsColumn<Fila>({ menu: menuDe(onDelete) })]);

    await clickRowAction(user, screen.getByTestId('acciones-f2'), 'eliminar-f2');

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(FILAS[1]);
  });

  it('R32: la celda pinta el desplegable, no el botón «Acciones» de tarjeta', () => {
    renderTabla([NOMBRE, actionsColumn<Fila>({ menu: menuDe(vi.fn()) })]);

    const trigger = screen.getByTestId('acciones-f1');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).not.toHaveTextContent('Acciones');
  });
});
