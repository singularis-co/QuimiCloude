import type { DataTableTexts } from '@/components/shared/data-table';
import type { StatusTone } from '@/lib/shared/ui/status-tone';

type StatusLabel = { readonly label: string; readonly tone: StatusTone };

const ADMINISTRATOR_STATUS_LABELS: Readonly<Record<string, StatusLabel>> = {
  active: { label: 'Activo', tone: 'success' },
  pending: { label: 'Pendiente', tone: 'neutral' },
};

/** Un estado sin fila se pinta con su código, sin fallar. */
export function administratorStatusLabel(status: string): StatusLabel {
  return ADMINISTRATOR_STATUS_LABELS[status] ?? { label: status, tone: 'neutral' };
}

export const ADMINISTRATOR_COLUMN_LABELS = {
  name: 'Nombre',
  username: 'Usuario',
  email: 'Correo',
  company: 'Empresa',
  status: 'Estado',
} as const;

export const ADMINISTRATOR_MENU_LABELS = {
  edit: 'Editar',
  delete: 'Dar de baja',
} as const;

export function administratorDisplayName(person: {
  readonly firstNames: string;
  readonly lastNames: string;
}): string {
  return `${person.firstNames} ${person.lastNames}`;
}

export function administratorActionsLabel(name: string): string {
  return `Acciones de ${name}`;
}

export const ADMINISTRATOR_EMPTY_TEXTS = {
  empty: 'No hay Administradores que mostrar.',
  noMatches: 'No hay Administradores en las empresas elegidas.',
  clearFilter: 'Quitar el filtro',
  firstPage: 'Volver a la primera página',
} as const;

export const ADMINISTRATOR_ERROR_TITLE = 'No se pudo cargar la lista de Administradores.';

export function administratorTableTexts(total: number): DataTableTexts {
  return {
    empty: ADMINISTRATOR_EMPTY_TEXTS.empty,
    loading: 'Cargando Administradores…',
    error: ADMINISTRATOR_ERROR_TITLE,
    search: 'Buscar Administradores',
    filters: 'Filtros',
    columnMenu: 'opciones de la columna',
    previousPage: 'Página anterior',
    nextPage: 'Página siguiente',
    pageIndicator: (page, totalPages) => `Página ${page} de ${totalPages} · ${total} en total`,
    pageSize: 'Administradores por página',
    sortAscending: 'Orden ascendente',
    sortDescending: 'Orden descendente',
    pinColumn: 'Fijar columna',
    unpinColumn: 'Soltar columna',
    filterColumn: 'Filtrar columna',
    clearFilter: 'Limpiar filtro',
    lastWeek: 'Última semana',
    lastMonth: 'Último mes',
    lastYear: 'Último año',
  };
}
