import type { DataTableTexts } from '@/components/shared/data-table';
import { countryOptionLabel, listCountryOptions } from '@/components/shared/country-options';
import type { StatusTone } from '@/lib/shared/ui/status-tone';

import type { CompanyStatusValue } from './company-list-params';

export const COMPANY_STATUS_LABELS: Readonly<Record<CompanyStatusValue, string>> = {
  active: 'Activa',
  deleted: 'De baja',
};

export const COMPANY_STATUS_TONES: Readonly<Record<CompanyStatusValue, StatusTone>> = {
  active: 'success',
  deleted: 'muted',
};

export const NO_COUNTRY_LABEL = 'Sin país';

export const COMPANY_COLUMN_LABELS = {
  name: 'Nombre',
  taxId: 'Identificación fiscal',
  country: 'País',
  liveUserCount: 'Usuarios',
  createdAt: 'Creada',
  status: 'Estado',
} as const;

export const COMPANY_USERS_SUFFIX = ' usuarios';
export const COMPANY_CREATED_PREFIX = 'creada ';

export const COMPANY_MENU_LABELS = {
  open: 'Abrir',
  edit: 'Editar',
  modules: 'Módulos',
  delete: 'Dar de baja',
  reactivate: 'Reactivar',
} as const;

export function companyActionsLabel(name: string): string {
  return `Acciones de ${name}`;
}

export const COMPANY_EMPTY_TEXTS = {
  deletedHeading: 'No hay empresas de baja',
  deletedMessage: 'Cuando des de baja una empresa, aparecerá aquí para reactivarla.',
  clearFilter: 'Quitar el filtro',
  noMatches: 'No hay empresas que coincidan con la búsqueda.',
  clearSearch: 'Limpiar la búsqueda',
  empty: 'No hay empresas que mostrar.',
  firstPage: 'Volver a la primera página',
} as const;

export const COMPANY_ERROR_TITLE = 'No se pudo cargar la lista de empresas.';

export const COMPANY_FIELD_LABELS = {
  name: 'Nombre',
  taxId: 'Identificación fiscal',
  contactEmail: 'Correo de contacto',
  contactPhone: 'Teléfono de contacto',
  country: 'País',
} as const;

export const COMPANY_TAX_ID_HINT = 'Opcional. Por ejemplo, el NIT.';

export const COMPANY_DATA_SECTION_LABEL = 'Empresa';
export const COMPANY_ADMIN_SECTION_LABEL = 'Administrador inicial';
export const COMPANY_MAIL_NOTICE = 'Le llegará un correo con un enlace para fijar su contraseña.';

export const COMPANY_CREATE_TEXTS = {
  open: 'Nueva empresa',
  title: 'Nueva empresa',
  description: 'Da de alta la empresa y a su primer Administrador.',
  submit: 'Crear empresa',
  success: 'Empresa creada. Enviamos el enlace al Administrador.',
  mailFailed: 'Empresa creada, pero no pudimos enviar el correo al Administrador.',
} as const;

export function companyTableTexts(total: number): DataTableTexts {
  return {
    empty: COMPANY_EMPTY_TEXTS.empty,
    loading: 'Cargando empresas…',
    error: COMPANY_ERROR_TITLE,
    search: 'Buscar empresas por nombre o identificación fiscal',
    filters: 'Filtros',
    columnMenu: 'opciones de la columna',
    previousPage: 'Página anterior',
    nextPage: 'Página siguiente',
    pageIndicator: (page, totalPages) => `Página ${page} de ${totalPages} · ${total} en total`,
    pageSize: 'Empresas por página',
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

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

// En UTC, para que el servidor y el navegador pinten el mismo día.
export function formatCompanyDate(date: Date): string {
  return `${twoDigits(date.getUTCDate())}/${twoDigits(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

/** «Colombia (+57)», «Sin país», o el código tal cual si la lista no lo conoce. */
export function companyCountryLabel(code: string | null): string {
  if (code === null) return NO_COUNTRY_LABEL;
  const option = listCountryOptions().find((candidate) => candidate.code === code);
  return option === undefined ? code : countryOptionLabel(option);
}
