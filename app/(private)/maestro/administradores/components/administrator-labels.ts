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
  resend: 'Reenviar enlace',
  delete: 'Dar de baja',
} as const;

export const ADMINISTRATOR_RESEND_TEXTS = {
  title: (name: string) => `¿Reenviar el enlace a ${name}?`,
  descriptionBefore: 'Le llegará a ',
  descriptionAfter: ' un correo nuevo para fijar su contraseña. El enlace anterior deja de servir.',
  dismiss: 'Volver',
  confirm: 'Reenviar enlace',
  pending: 'Reenviando…',
  sent: (name: string) => `Enviamos el enlace a ${name}.`,
  mailFailed: (name: string) => `No pudimos enviar el correo a ${name}.`,
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

export const ADMINISTRATOR_COMPANY_FIELD_LABEL = 'Empresa';
export const ADMINISTRATOR_COMPANY_PLACEHOLDER = 'Elige una empresa';
export const ADMINISTRATOR_COMPANY_HINT = 'Solo empresas activas.';
export const ADMINISTRATOR_ROLE_LABEL = 'Rol';
export const ADMINISTRATOR_MAIL_NOTICE = 'Le llegará un correo con un enlace para fijar su contraseña.';

export const ADMINISTRATOR_CREATE_TEXTS = {
  open: 'Nuevo administrador',
  title: 'Nuevo administrador',
  description: 'Elige la empresa y describe a la persona que la va a administrar.',
  submit: 'Crear administrador',
  success: 'Administrador creado. Enviamos el enlace.',
  mailFailed: 'Administrador creado, pero no pudimos enviar el correo.',
} as const;

export const ADMINISTRATOR_EDIT_TEXTS = {
  title: 'Editar administrador',
  description: 'Cambia los datos de la persona.',
  loading: 'Cargando los datos del Administrador…',
  submit: 'Guardar',
  success: 'Administrador actualizado.',
} as const;

export const ADMINISTRATOR_DELETE_TEXTS = {
  title: (name: string) => `Dar de baja a ${name}`,
  description: (name: string, company: string) => `${name} deja de poder entrar a ${company}.`,
  lastTitle: (company: string) => `Es el último Administrador de ${company}`,
  lastMessage: 'Crea otro Administrador para esta empresa antes de darlo de baja.',
  dismiss: 'Volver',
  confirm: 'Dar de baja',
  success: 'Administrador dado de baja.',
} as const;

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
