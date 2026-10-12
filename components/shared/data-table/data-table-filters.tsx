'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { XIcon } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

import { DataTableFilterChip, formatFilterChipValue } from './data-table-filter-chip';
import { DataTableFilterDate } from './data-table-filter-date';
import { SEARCH_DEBOUNCE_MS, withFilter, withoutFilters, withSearch } from './data-table-params';
import type {
  DataTableColumn,
  DataTableFilterValue,
  DataTableParams,
  DataTableTexts,
} from './data-table-types';

/**
 * Barra de filtros y busqueda global (`design.md`, T8, R15, R16, R17, R27).
 *
 * **Solo emite.** Nada se filtra en el cliente (R13, R17): cada control llama a
 * `onParamsChange` con el `DataTableParams` completo y la pantalla/consumidor decide que hacer.
 * Solo aparecen las columnas que declaran `filter` (R15); limpiar un filtro SACA su clave del
 * objeto en vez de emitirla vacia (R16, via `withFilter`).
 */

/** 16 px en TODOS los anchos: el primitivo baja a 14 px en `md`, y R20 no distingue por ancho. */
const FIELD_TEXT = 'text-base md:text-base';

export type DataTableFiltersProps<TRow> = {
  readonly columns: readonly DataTableColumn<TRow>[];
  readonly params: DataTableParams;
  readonly texts: DataTableTexts;
  readonly onParamsChange: (next: DataTableParams) => void;
  /** Acciones de la barra, p. ej. "Nuevo producto" (R30: decididas por la pantalla). */
  readonly toolbarActions?: ReactNode;
  /**
   * Si se monta el campo de busqueda global. **Ausente = `true`**: el comportamiento de siempre
   * (R17). Con `false` el campo NO se monta -no se pinta deshabilitado ni oculto: no existe en
   * el DOM- para una lista que no admite busqueda (QC-35 `design.md > 6.2`).
   */
  readonly searchable?: boolean;
};

/** Campo de busqueda global, con rebote (R17, `design.md > 6`). Emite en `search`, no en `filters`. */
function DataTableSearchField({
  params,
  texts,
  onParamsChange,
}: Pick<DataTableFiltersProps<unknown>, 'params' | 'texts' | 'onParamsChange'>) {
  const [draft, setDraft] = useState(params.search);
  const paramsRef = useRef(params);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
    Mantiene la ultima version de `params` accesible desde el temporizador del rebote sin
    reprogramarlo en cada tecla: mutar un ref en un efecto no es `setState`, asi que no dispara
    el render en cascada que `react-hooks/set-state-in-effect` prohibe (visto en
    `delete-product-dialog.tsx`).
  */
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (next: string) => {
    setDraft(next);
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onParamsChange(withSearch(paramsRef.current, next));
    }, SEARCH_DEBOUNCE_MS);
  };

  return (
    <Input
      type="search"
      value={draft}
      aria-label={texts.search}
      placeholder={texts.search}
      data-testid="data-table-search"
      className={cn(touchTarget, FIELD_TEXT)}
      onChange={(event) => handleChange(event.target.value)}
    />
  );
}

/** Boton de limpiar un filtro (R16): saca la clave del objeto, nunca la emite vacia. */
function DataTableFilterClearButton({
  columnId,
  texts,
  onClear,
}: {
  readonly columnId: string;
  readonly texts: DataTableTexts;
  readonly onClear: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      touch
      aria-label={texts.clearFilter}
      data-testid={`data-table-filter-clear-${columnId}`}
      onClick={onClear}
    >
      <XIcon />
    </Button>
  );
}

const CLEAR_FILTERS_FALLBACK = 'Limpiar filtros';

type FilterControlProps<TRow> = {
  readonly column: DataTableColumn<TRow>;
  readonly value: DataTableFilterValue | undefined;
  readonly chipValue: string | null;
  readonly texts: DataTableTexts;
  readonly onChange: (next: DataTableFilterValue | null) => void;
};

function SelectFilter<TRow>({ column, value, chipValue, onChange }: FilterControlProps<TRow>) {
  if (column.filter?.kind !== 'select') return null;
  const { options } = column.filter;
  const values = value?.kind === 'select' ? value.values : [];

  const toggle = (optionValue: string) => {
    const next = values.includes(optionValue)
      ? values.filter((current) => current !== optionValue)
      : [...values, optionValue];
    onChange(next.length === 0 ? null : { kind: 'select', values: next });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<DataTableFilterChip label={column.label} value={chipValue} />}
        data-testid={`data-table-filter-${column.id}`}
      />
      <DropdownMenuContent>
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={values.includes(option.value)}
            onCheckedChange={() => toggle(option.value)}
            data-testid={`data-table-filter-option-${column.id}-${option.value}`}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TextFilter<TRow>({ column, value, chipValue, onChange }: FilterControlProps<TRow>) {
  const textValue = value?.kind === 'text' ? value.value : '';

  return (
    <Popover>
      <PopoverTrigger
        render={<DataTableFilterChip label={column.label} value={chipValue} />}
        data-testid={`data-table-filter-chip-${column.id}`}
      />
      <PopoverContent align="start">
        <Input
          type="text"
          aria-label={column.label}
          value={textValue}
          data-testid={`data-table-filter-${column.id}`}
          className={cn(touchTarget, FIELD_TEXT)}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === '' ? null : { kind: 'text', value: next });
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function NumberRangeFilter<TRow>({ column, value, chipValue, onChange }: FilterControlProps<TRow>) {
  const min = value?.kind === 'numberRange' ? value.min : null;
  const max = value?.kind === 'numberRange' ? value.max : null;

  const emitRange = (nextMin: number | null, nextMax: number | null) => {
    onChange(nextMin === null && nextMax === null ? null : { kind: 'numberRange', min: nextMin, max: nextMax });
  };
  const toNumber = (raw: string) => (raw === '' ? null : Number(raw));

  return (
    <Popover>
      <PopoverTrigger
        render={<DataTableFilterChip label={column.label} value={chipValue} />}
        data-testid={`data-table-filter-chip-${column.id}`}
      />
      <PopoverContent align="start" className="w-auto">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            aria-label={column.label}
            value={min === null ? '' : min}
            data-testid={`data-table-filter-min-${column.id}`}
            className={cn(touchTarget, FIELD_TEXT, 'w-28')}
            onChange={(event) => emitRange(toNumber(event.target.value), max)}
          />
          <span aria-hidden="true">–</span>
          <Input
            type="number"
            inputMode="decimal"
            aria-label={column.label}
            value={max === null ? '' : max}
            data-testid={`data-table-filter-max-${column.id}`}
            className={cn(touchTarget, FIELD_TEXT, 'w-28')}
            onChange={(event) => emitRange(min, toNumber(event.target.value))}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DateFilter<TRow>({ column, value, texts, onChange }: FilterControlProps<TRow>) {
  return (
    <DataTableFilterDate
      columnId={column.id}
      label={column.label}
      value={value?.kind === 'dateRange' ? value : undefined}
      texts={texts}
      onChange={onChange}
    />
  );
}

const FILTER_CONTROLS = {
  select: SelectFilter,
  text: TextFilter,
  numberRange: NumberRangeFilter,
  dateRange: DateFilter,
} as const;

export function DataTableFilters<TRow>({
  columns,
  params,
  texts,
  onParamsChange,
  toolbarActions,
  searchable = true,
}: DataTableFiltersProps<TRow>) {
  const filters = columns.flatMap((column) =>
    column.filter === undefined
      ? []
      : [{ column, filter: column.filter, chipValue: formatFilterChipValue(column.filter, params.filters[column.id]) }],
  );
  const anyActive = filters.some(({ chipValue }) => chipValue !== null);

  return (
    <div className="@container flex flex-wrap items-center gap-2" data-testid="data-table-filters">
      {searchable ? (
        <div className="max-w-[380px] flex-[1_1_220px] @max-[760px]:max-w-none @max-[760px]:basis-full">
          <DataTableSearchField params={params} texts={texts} onParamsChange={onParamsChange} />
        </div>
      ) : null}

      {toolbarActions === undefined ? null : (
        <div className="flex items-center gap-2" data-testid="data-table-toolbar-actions">
          {toolbarActions}
        </div>
      )}

      {filters.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-2 @max-[760px]:basis-full" data-testid="data-table-chips">
          {filters.map(({ column, filter, chipValue }) => {
            const Control = FILTER_CONTROLS[filter.kind] as (props: FilterControlProps<TRow>) => ReactNode;
            return (
              <div key={column.id} className="flex items-center gap-1">
                <Control
                  column={column}
                  value={params.filters[column.id]}
                  chipValue={chipValue}
                  texts={texts}
                  onChange={(next) => onParamsChange(withFilter(params, column.id, next))}
                />
                {chipValue === null ? null : (
                  <DataTableFilterClearButton
                    columnId={column.id}
                    texts={texts}
                    onClear={() => onParamsChange(withFilter(params, column.id, null))}
                  />
                )}
              </div>
            );
          })}

          {anyActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              touch
              data-testid="data-table-clear-filters"
              onClick={() => onParamsChange(withoutFilters(params))}
            >
              {texts.clearFilters ?? CLEAR_FILTERS_FALLBACK}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
