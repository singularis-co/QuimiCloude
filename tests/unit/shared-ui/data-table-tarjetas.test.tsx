// `DataTable` con `card`: pinta los dos cuerpos y el contenedor decide cuál se ve (tabla por encima
// de 760 px, tarjetas por debajo). jsdom no tiene layout, así que se afirma sobre las clases de
// consulta de contenedor y sobre el contenido de cada cuerpo.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  actionsColumn,
  createDefaultParams,
  DataTable,
  type DataTableCardLayout,
  type DataTableColumn,
  type DataTableProps,
  type DataTableTexts,
} from '@/components/shared/data-table';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

type Pedido = {
  readonly id: string;
  readonly numero: string;
  readonly estado: string;
  readonly receta: string;
  readonly cantidad: string;
  readonly fecha: string;
  readonly prioridad: string;
  readonly cliente: string;
};

const PEDIDOS: readonly Pedido[] = [
  {
    id: 'p1',
    numero: '2026-0000008',
    estado: 'Terminado',
    receta: 'Desengrasante alcalino',
    cantidad: '90,0 L',
    fecha: '2026-10-01',
    prioridad: 'Baja',
    cliente: 'Lavandería Sol',
  },
  {
    id: 'p2',
    numero: '2026-0000009',
    estado: 'En curso',
    receta: 'Jabón neutro',
    cantidad: '20,0 L',
    fecha: '2026-10-02',
    prioridad: 'Alta',
    cliente: 'Hotel Mar',
  },
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

const onEliminar = vi.fn();

const COLUMNAS: readonly DataTableColumn<Pedido>[] = [
  { id: 'numero', label: 'Número', align: 'start', cell: (p) => p.numero },
  {
    id: 'estado',
    label: 'Estado',
    align: 'start',
    cell: (p) => p.estado,
    filter: { kind: 'select', options: [{ value: 'x', label: 'X' }] },
  },
  { id: 'receta', label: 'Receta', align: 'start', cell: (p) => p.receta },
  { id: 'cantidad', label: 'Cantidad', align: 'end', cell: (p) => p.cantidad, tabular: true },
  { id: 'fecha', label: 'Fecha', align: 'start', cell: (p) => p.fecha },
  { id: 'prioridad', label: 'Prioridad', align: 'start', cell: (p) => p.prioridad },
  { id: 'cliente', label: 'Cliente', align: 'start', cell: (p) => p.cliente },
  actionsColumn<Pedido>({
    menu: (p) => ({
      triggerLabel: `Acciones del pedido ${p.numero}`,
      triggerTestId: `pedido-acciones-${p.id}`,
      title: `Pedido ${p.numero}`,
      items: [
        { key: 'edit', label: 'Editar', icon: PencilIcon, href: `/pedidos/${p.id}`, testId: `editar-${p.id}` },
        {
          key: 'delete',
          label: 'Eliminar',
          icon: Trash2Icon,
          destructive: true,
          onSelect: () => onEliminar(p.id),
          testId: `eliminar-${p.id}`,
        },
      ],
    }),
  }),
];

const CARD: DataTableCardLayout = {
  primary: 'numero',
  status: 'estado',
  title: 'receta',
  meta: ['cantidad', 'fecha'],
  footer: 'prioridad',
};

function renderTabla(overrides: Partial<DataTableProps<Pedido>> = {}) {
  return render(
    <DataTable<Pedido>
      tableId={`tarjetas-${Math.random()}`}
      columns={COLUMNAS}
      rows={PEDIDOS}
      getRowId={(p) => p.id}
      params={createDefaultParams()}
      totalPages={3}
      onParamsChange={vi.fn()}
      status="idle"
      texts={texts}
      card={CARD}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
  onEliminar.mockReset();
});

describe('disposición en tarjeta', () => {
  it('R34: el envoltorio mide su contenedor; la tabla se oculta y las tarjetas aparecen a 760 px o menos', () => {
    renderTabla();

    const raiz = screen.getByTestId('data-table');
    expect(raiz.className).toContain('@container');

    const tablaWrap = screen.getByRole('table').closest('[data-slot="table-container"]')?.parentElement;
    expect(tablaWrap?.className).toContain('@max-[760px]:hidden');

    const tarjetas = screen.getByTestId('data-table-cards');
    expect(tarjetas.className).toContain('hidden');
    expect(tarjetas.className).toContain('@max-[760px]:flex');
  });

  it('R34: una tarjeta por fila, en el orden recibido', () => {
    renderTabla();

    const tarjetas = within(screen.getByTestId('data-table-cards')).getAllByRole('listitem');
    expect(tarjetas.map((t) => t.getAttribute('data-testid'))).toEqual(['data-table-card-p1', 'data-table-card-p2']);
  });

  it('R34: la tarjeta lleva identificador y estado arriba, título, datos secundarios y pie', () => {
    renderTabla();

    const tarjeta = screen.getByTestId('data-table-card-p1');
    const campo = (id: string) => within(tarjeta).getByTestId(`data-table-card-field-${id}`);

    expect(campo('numero')).toHaveTextContent('2026-0000008');
    expect(campo('numero').className).toContain('font-mono');
    expect(campo('estado')).toHaveTextContent('Terminado');
    expect(campo('receta')).toHaveTextContent('Desengrasante alcalino');
    expect(campo('cantidad')).toHaveTextContent('90,0 L');
    expect(campo('cantidad').className).toContain('tabular-nums');
    expect(campo('fecha')).toHaveTextContent('2026-10-01');
    expect(campo('prioridad')).toHaveTextContent('Baja');

    const orden = ['numero', 'estado', 'receta', 'cantidad', 'fecha', 'prioridad'].map(campo);
    for (let i = 1; i < orden.length; i += 1) {
      expect(orden[i - 1].compareDocumentPosition(orden[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('R34: las columnas que la disposición no nombra no salen en la tarjeta', () => {
    renderTabla();

    const tarjeta = screen.getByTestId('data-table-card-p1');
    expect(within(tarjeta).queryByText('Lavandería Sol')).not.toBeInTheDocument();
    expect(within(tarjeta).queryByTestId('data-table-card-field-cliente')).not.toBeInTheDocument();
  });

  it('R35: el pie de la tarjeta lleva «Acciones» con el nombre del menú de la fila y 44 px', () => {
    renderTabla({ texts: { ...texts, cardActions: 'Acciones' } });

    const tarjeta = screen.getByTestId('data-table-card-p2');
    const boton = within(tarjeta).getByTestId('pedido-acciones-p2');
    expect(boton).toHaveTextContent('Acciones');
    expect(boton).toHaveAccessibleName('Acciones del pedido 2026-0000009');
    expect(boton.className).toContain('min-h-11');
  });

  it('R35: una columna de acciones con cell no da «Acciones» a la tarjeta', () => {
    const conCelda: readonly DataTableColumn<Pedido>[] = [
      ...COLUMNAS.slice(0, -1),
      actionsColumn<Pedido>({ cell: () => <button type="button">propio</button> }),
    ];
    renderTabla({ columns: conCelda, card: { primary: 'numero' } });

    const tarjeta = screen.getByTestId('data-table-card-p1');
    expect(within(tarjeta).queryByRole('button')).not.toBeInTheDocument();
  });

  it('R36, R37: «Acciones» de la tarjeta abre el menú centrado con el título y los ítems de la fila', async () => {
    const user = setupUser();
    renderTabla({ texts: { ...texts, closeMenu: 'Cerrar' } });

    await user.click(within(screen.getByTestId('data-table-card-p1')).getByTestId('pedido-acciones-p1'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Pedido 2026-0000008');
    expect(within(dialog).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();

    await user.click(await esperarInteractiva(within(dialog).getByTestId('eliminar-p1')));
    expect(onEliminar).toHaveBeenCalledWith('p1');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('lo que comparten la tabla y las tarjetas', () => {
  it('R39: búsqueda, filtros y paginación salen una sola vez, fuera de los dos cuerpos', () => {
    renderTabla();

    const tarjetas = screen.getByTestId('data-table-cards');
    for (const testId of ['data-table-search', 'data-table-filters', 'data-table-pagination']) {
      const piezas = screen.getAllByTestId(testId);
      expect(piezas).toHaveLength(1);
      expect(tarjetas.contains(piezas[0])).toBe(false);
      expect(screen.getByRole('table').contains(piezas[0])).toBe(false);
    }
  });

  it.each([
    ['carga', { status: 'loading' as const }],
    ['error', { status: 'error' as const }],
    ['vacío', { rows: [] as readonly Pedido[] }],
  ])('R39: en %s no hay tarjetas, igual que no hay filas en la tabla', (_estado, overrides) => {
    renderTabla(overrides);

    expect(screen.queryByTestId('data-table-cards')).not.toBeInTheDocument();
    expect(screen.queryByTestId(/^data-table-card-/)).not.toBeInTheDocument();
  });

  it('R39: los estados que sustituyen a la tabla sustituyen también a las tarjetas', () => {
    renderTabla({ rows: [], states: { empty: { testId: 'vacio-propio', message: 'Sin pedidos' } } });

    expect(screen.getByTestId('vacio-propio')).toBeInTheDocument();
    expect(screen.queryByTestId('data-table-cards')).not.toBeInTheDocument();
  });
});

describe('sin disposición en tarjeta', () => {
  it('R38: pinta solo la tabla, sin consulta de contenedor ni tarjetas', () => {
    renderTabla({ card: undefined });

    expect(screen.getByTestId('data-table').className).not.toContain('@container');
    expect(screen.queryByTestId('data-table-cards')).not.toBeInTheDocument();
    const tablaWrap = screen.getByRole('table').closest('[data-slot="table-container"]')?.parentElement;
    expect(tablaWrap?.className).not.toContain('@max-[760px]');
  });
});
