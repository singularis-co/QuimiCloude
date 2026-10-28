'use client';

import { CopyIcon, Link2Icon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import {
  actionsColumn,
  createDefaultParams,
  DataTable,
  type DataTableCardLayout,
  type DataTableColumn,
  type DataTableParams,
  type DataTableTexts,
} from '@/components/shared/data-table';
import type { RowActionMenuItem } from '@/components/shared/row-actions-menu';
import { Button } from '@/components/ui/button';
import type { WhatsappTemplateStatus as TemplateStatus, WhatsappTemplateView } from '@/lib/modules/integraciones';

import { toDisplayText } from './whatsapp-system-constants';
import { categoryLabelOf, isMappable, isUnmapped } from './whatsapp-template-rules';
import { WhatsappTemplateStatus } from './whatsapp-template-status';
import { SyncDateTime } from './whatsapp-template-sync-bar';
import { WhatsappTemplateUsage } from './whatsapp-template-usage';

export const WHATSAPP_TEMPLATE_TABLE_ID = 'integraciones-whatsapp-plantillas';
export const WHATSAPP_TEMPLATE_TABLE_TESTID = 'whatsapp-template-table';
export const WHATSAPP_TEMPLATE_FILTERS_TESTID = 'whatsapp-template-filters';
export const WHATSAPP_TEMPLATE_FILTER_TESTID = (filter: TemplateFilter) => `whatsapp-template-filter-${filter}`;
export const WHATSAPP_TEMPLATE_NEW_TESTID = 'whatsapp-template-new';
export const WHATSAPP_TEMPLATE_CLEAR_FILTERS_TESTID = 'whatsapp-template-clear-filters';
export const WHATSAPP_TEMPLATE_COUNT_TESTID = 'whatsapp-template-count';
export const WHATSAPP_TEMPLATE_NAME_TESTID = 'whatsapp-template-name';
export const WHATSAPP_TEMPLATE_SNIPPET_TESTID = 'whatsapp-template-snippet';
export const WHATSAPP_TEMPLATE_ACTIONS_TESTID = (id: string) => `whatsapp-template-actions-${id}`;
export const WHATSAPP_TEMPLATE_ACTION_TESTIDS = {
  relate: 'whatsapp-template-action-relate',
  duplicate: 'whatsapp-template-action-duplicate',
  delete: 'whatsapp-template-action-delete',
} as const;

// La fila recién relacionada entra con el fundido de los avisos del sistema.
const FRESH_ROW_CLASS = 'block animate-in fade-in duration-(--dur-slow) ease-(--ease-enter) motion-reduce:animate-none';

export type TemplateFilter = 'ALL' | Exclude<TemplateStatus, 'OTHER'> | 'UNMAPPED';

export const WHATSAPP_TEMPLATE_TABLE_TEXTS = {
  columns: {
    name: 'Nombre',
    language: 'Idioma',
    category: 'Categoría',
    status: 'Estado en Meta',
    usage: 'Uso en el sistema',
    syncedAt: 'Última sincronización',
    actions: 'Acciones',
  },
  filterGroup: 'Filtrar por estado',
  filters: {
    ALL: 'Todas',
    APPROVED: 'Aprobadas',
    PENDING: 'Pendientes',
    REJECTED: 'Rechazadas',
    PAUSED: 'Pausadas',
    DISABLED: 'Deshabilitadas',
    UNMAPPED: 'Sin relacionar',
  } satisfies Record<TemplateFilter, string>,
  newTemplate: 'Nueva plantilla',
  noMatch: 'Ninguna plantilla coincide con la búsqueda.',
  clearFilters: 'Quitar filtros',
  count: (count: number) => `${count} ${count === 1 ? 'plantilla' : 'plantillas'}`,
  actionsOf: (name: string) => `Acciones de ${name}`,
  relateVariables: 'Relacionar variables',
  duplicate: 'Duplicar',
  delete: 'Eliminar',
} as const;

const FILTER_ORDER: readonly TemplateFilter[] = [
  'ALL',
  'APPROVED',
  'PENDING',
  'REJECTED',
  'PAUSED',
  'DISABLED',
  'UNMAPPED',
];

const DATA_TABLE_TEXTS: DataTableTexts = {
  empty: WHATSAPP_TEMPLATE_TABLE_TEXTS.noMatch,
  loading: 'Cargando plantillas…',
  error: 'No se pudo cargar la lista de plantillas.',
  search: 'Buscar por nombre',
  filters: 'Filtros',
  columnMenu: 'opciones de la columna',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  pageIndicator: (page, totalPages) => `Página ${page} de ${totalPages}`,
  pageSize: 'Plantillas por página',
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

const CARD_LAYOUT: DataTableCardLayout = {
  primary: 'name',
  status: 'status',
  meta: ['language', 'category', 'syncedAt'],
  footer: 'usage',
};

/** Filtra en el cliente: la lista llega entera. */
export function filterTemplates(
  templates: readonly WhatsappTemplateView[],
  filter: TemplateFilter,
  search: string,
): readonly WhatsappTemplateView[] {
  const needle = search.trim().toLocaleLowerCase('es');
  return templates.filter((template) => {
    if (needle !== '' && !template.name.toLocaleLowerCase('es').includes(needle)) return false;
    if (filter === 'ALL') return true;
    if (filter === 'UNMAPPED') return isUnmapped(template);
    return template.status === filter;
  });
}

export type WhatsappTemplateRowHandlers = {
  readonly enabledOf: (template: WhatsappTemplateView) => boolean;
  readonly isToggling: (template: WhatsappTemplateView) => boolean;
  readonly onToggle: (template: WhatsappTemplateView, enabled: boolean) => void;
  readonly onRelate: (template: WhatsappTemplateView) => void;
  readonly onDuplicate: (template: WhatsappTemplateView) => void;
  readonly onDelete: (template: WhatsappTemplateView) => void;
};

type ColumnHandlers = WhatsappTemplateRowHandlers & { readonly freshId: string | null };

function menuItemsOf(template: WhatsappTemplateView, handlers: WhatsappTemplateRowHandlers): RowActionMenuItem[] {
  const items: RowActionMenuItem[] = [];
  if (isMappable(template)) {
    items.push({
      key: 'relate',
      label: WHATSAPP_TEMPLATE_TABLE_TEXTS.relateVariables,
      icon: Link2Icon,
      testId: WHATSAPP_TEMPLATE_ACTION_TESTIDS.relate,
      onSelect: () => handlers.onRelate(template),
    });
  }
  items.push(
    {
      key: 'duplicate',
      label: WHATSAPP_TEMPLATE_TABLE_TEXTS.duplicate,
      icon: CopyIcon,
      testId: WHATSAPP_TEMPLATE_ACTION_TESTIDS.duplicate,
      onSelect: () => handlers.onDuplicate(template),
    },
    {
      key: 'delete',
      label: WHATSAPP_TEMPLATE_TABLE_TEXTS.delete,
      icon: Trash2Icon,
      destructive: true,
      separatorBefore: true,
      testId: WHATSAPP_TEMPLATE_ACTION_TESTIDS.delete,
      onSelect: () => handlers.onDelete(template),
    },
  );
  return items;
}

function NameCell({ template }: { readonly template: WhatsappTemplateView }) {
  const snippet = template.content === null ? null : toDisplayText(template.content.body.text);
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-mono font-semibold [overflow-wrap:anywhere]" data-testid={WHATSAPP_TEMPLATE_NAME_TESTID}>
        {template.name}
      </span>
      {snippet === null ? null : (
        <span
          className="block max-w-80 truncate text-xs text-muted-foreground @max-[760px]:hidden"
          data-testid={WHATSAPP_TEMPLATE_SNIPPET_TESTID}
        >
          {snippet}
        </span>
      )}
    </span>
  );
}

function buildColumns(handlers: ColumnHandlers): readonly DataTableColumn<WhatsappTemplateView>[] {
  const labels = WHATSAPP_TEMPLATE_TABLE_TEXTS.columns;
  const enter = (row: WhatsappTemplateView, node: ReactNode) =>
    row.id === handlers.freshId ? (
      <span className={FRESH_ROW_CLASS} data-fresh="true">
        {node}
      </span>
    ) : (
      node
    );
  return [
    { id: 'name', label: labels.name, align: 'start', cell: (row) => enter(row, <NameCell template={row} />) },
    { id: 'language', label: labels.language, align: 'start', tabular: true, cell: (row) => row.language },
    { id: 'category', label: labels.category, align: 'start', cell: (row) => categoryLabelOf(row.category) },
    {
      id: 'status',
      label: labels.status,
      align: 'start',
      cell: (row) => enter(row, <WhatsappTemplateStatus template={row} />),
    },
    {
      id: 'usage',
      label: labels.usage,
      align: 'start',
      hideText: false,
      cell: (row) =>
        enter(
          row,
          <WhatsappTemplateUsage
            template={row}
            enabled={handlers.enabledOf(row)}
            pending={handlers.isToggling(row)}
            onToggle={handlers.onToggle}
            onRelate={handlers.onRelate}
          />,
        ),
    },
    {
      id: 'syncedAt',
      label: labels.syncedAt,
      align: 'end',
      tabular: true,
      cell: (row) => <SyncDateTime iso={row.lastSyncedAt} />,
    },
    actionsColumn<WhatsappTemplateView>({
      label: labels.actions,
      srOnlyLabel: true,
      menu: (row) => ({
        items: menuItemsOf(row, handlers),
        triggerLabel: WHATSAPP_TEMPLATE_TABLE_TEXTS.actionsOf(row.name),
        triggerTestId: WHATSAPP_TEMPLATE_ACTIONS_TESTID(row.id),
        title: row.name,
      }),
    }),
  ];
}

export type WhatsappTemplateTableProps = WhatsappTemplateRowHandlers & {
  readonly templates: readonly WhatsappTemplateView[];
  readonly loading: boolean;
  readonly onNewTemplate: () => void;
  /** La fila que acaba de cambiar y entra con un fundido. */
  readonly freshId?: string | null;
};

export function WhatsappTemplateTable({
  templates,
  loading,
  onNewTemplate,
  freshId = null,
  ...handlers
}: WhatsappTemplateTableProps) {
  const [params, setParams] = useState<DataTableParams>(createDefaultParams);
  const [filter, setFilter] = useState<TemplateFilter>('ALL');
  // El campo de búsqueda guarda su propio borrador: volver a montarlo es la forma de vaciarlo.
  const [resetKey, setResetKey] = useState(0);

  const { enabledOf, isToggling, onToggle, onRelate, onDuplicate, onDelete } = handlers;
  const columns = useMemo(
    () => buildColumns({ enabledOf, isToggling, onToggle, onRelate, onDuplicate, onDelete, freshId }),
    [enabledOf, isToggling, onToggle, onRelate, onDuplicate, onDelete, freshId],
  );

  const shown = filterTemplates(templates, filter, params.search);
  const totalPages = Math.max(1, Math.ceil(shown.length / params.pageSize));
  const page = Math.min(params.page, totalPages);
  const pageRows = shown.slice((page - 1) * params.pageSize, page * params.pageSize);

  function changeParams(next: DataTableParams) {
    setParams(next.search === params.search ? next : { ...next, page: 1 });
  }

  function pickFilter(next: TemplateFilter) {
    setFilter(next);
    setParams((current) => ({ ...current, page: 1 }));
  }

  function clearFilters() {
    setFilter('ALL');
    setParams(createDefaultParams());
    setResetKey((key) => key + 1);
  }

  const toolbar = (
    <>
      <div
        role="group"
        aria-label={WHATSAPP_TEMPLATE_TABLE_TEXTS.filterGroup}
        className="flex max-w-full gap-2 overflow-x-auto"
        data-testid={WHATSAPP_TEMPLATE_FILTERS_TESTID}
      >
        {FILTER_ORDER.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            touch
            variant={option === filter ? 'default' : 'outline'}
            aria-pressed={option === filter}
            className="shrink-0 rounded-full"
            data-testid={WHATSAPP_TEMPLATE_FILTER_TESTID(option)}
            onClick={() => pickFilter(option)}
          >
            {WHATSAPP_TEMPLATE_TABLE_TEXTS.filters[option]}
          </Button>
        ))}
      </div>
      <Button type="button" touch className="shrink-0" data-testid={WHATSAPP_TEMPLATE_NEW_TESTID} onClick={onNewTemplate}>
        <PlusIcon aria-hidden="true" />
        {WHATSAPP_TEMPLATE_TABLE_TEXTS.newTemplate}
      </Button>
    </>
  );

  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid={WHATSAPP_TEMPLATE_TABLE_TESTID}>
      <DataTable
        key={resetKey}
        tableId={WHATSAPP_TEMPLATE_TABLE_ID}
        columns={columns}
        rows={pageRows}
        getRowId={(template) => template.id}
        params={{ ...params, page }}
        totalPages={totalPages}
        onParamsChange={changeParams}
        status={loading ? 'loading' : 'idle'}
        texts={DATA_TABLE_TEXTS}
        toolbarActions={toolbar}
        emptyAction={
          <Button
            type="button"
            variant="outline"
            touch
            data-testid={WHATSAPP_TEMPLATE_CLEAR_FILTERS_TESTID}
            onClick={clearFilters}
          >
            {WHATSAPP_TEMPLATE_TABLE_TEXTS.clearFilters}
          </Button>
        }
        card={CARD_LAYOUT}
      />
      {loading ? null : (
        <p className="text-sm text-muted-foreground" data-testid={WHATSAPP_TEMPLATE_COUNT_TESTID}>
          <span className="font-mono tabular-nums">{WHATSAPP_TEMPLATE_TABLE_TEXTS.count(shown.length)}</span>
        </p>
      )}
    </div>
  );
}
