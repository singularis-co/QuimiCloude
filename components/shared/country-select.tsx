'use client';

import { CheckIcon, ChevronDownIcon, CircleAlertIcon, XIcon } from 'lucide-react';
import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CountryCode } from 'libphonenumber-js';

import {
  countryOptionLabel,
  filterCountryOptions,
  listCountryOptions,
  type CountryOption,
} from '@/components/shared/country-options';
import { FieldError } from '@/components/shared/field-error';
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteIcon,
  AutocompleteInput,
  AutocompleteInputGroup,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteTrigger,
} from '@/components/ui/autocomplete';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

const NO_COUNTRY_LABEL = 'Sin país';
const SEARCH_LABEL = 'Buscar país por nombre o prefijo';
const SEARCH_PLACEHOLDER = 'Busca por nombre o prefijo';
const CLOSE_LABEL = 'Cerrar';
const noMatchesLabel = (query: string) => `Ningún país coincide con «${query}».`;

/** La hoja de teléfono se usa a 640 px o menos. */
const SHEET_BREAKPOINT = 641;

const TRIGGER_CLASS = cn(
  'group/trigger flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-left text-base transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring',
  'disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50',
  'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
  'dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
  touchTarget,
);

const CHEVRON_CLASS =
  'size-4 shrink-0 text-muted-foreground transition-transform duration-(--dur-base) group-aria-expanded/trigger:rotate-180 motion-reduce:transition-none';

const SEARCH_INPUT_CLASS = 'pl-9 text-base md:text-base';

const ITEM_CLASS =
  'gap-2.5 px-2.5 text-sm transition-colors duration-100 data-selected:bg-accent data-selected:text-accent-foreground motion-reduce:transition-none';

type NoCountryItem = { readonly code: null };
type CountryItem = CountryOption | NoCountryItem;

const NO_COUNTRY: NoCountryItem = { code: null };

function itemText(item: CountryItem): string {
  return item.code === null ? NO_COUNTRY_LABEL : countryOptionLabel(item);
}

function itemKey(item: CountryItem): string {
  return item.code ?? 'none';
}

/** El elegido se desplaza a la vista cuando su opción se monta, es decir, al abrir la lista. */
function scrollIntoViewOnMount(node: HTMLElement | null) {
  if (node === null) return;
  // Un fotograma después: el popup se posiciona tras montarse y antes no hay dónde desplazar.
  const frame = requestAnimationFrame(() => node.scrollIntoView({ block: 'nearest' }));
  return () => cancelAnimationFrame(frame);
}

export type CountrySelectProps = {
  readonly value: CountryCode | null;
  readonly onChange: (value: CountryCode | null) => void;
  readonly label: string;
  readonly disabled?: boolean;
  readonly error?: string;
  /** Base de los id de la etiqueta, el error y la lista. */
  readonly id?: string;
  /** `data-testid` del disparador; la lista y las opciones derivan de él. */
  readonly testId?: string;
};

export function CountrySelect({
  value,
  onChange,
  label,
  disabled = false,
  error,
  id,
  testId,
}: CountrySelectProps) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const labelId = `${baseId}-label`;
  const errorId = `${baseId}-error`;
  const listId = `${baseId}-list`;

  const isMobile = useIsMobile(SHEET_BREAKPOINT);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const options = listCountryOptions();
  const selected = useMemo(
    () => (value === null ? undefined : options.find((option) => option.code === value)),
    [options, value],
  );
  const items = useMemo<CountryItem[]>(() => {
    const filtered = filterCountryOptions(options, query);
    return query.trim() === '' ? [NO_COUNTRY, ...filtered] : [...filtered];
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) setOpen(true);
      else close();
    },
    [close],
  );

  // Al elegir, el primitivo escribe la etiqueta de la opción en el buscador: aquí se descarta,
  // porque el buscador se vacía al elegir.
  const handleQueryChange = useCallback(
    (next: string, details: { readonly reason: string }) => {
      if (details.reason === 'item-press') return;
      setQuery(next);
    },
    [],
  );

  const choose = (item: CountryItem) => {
    onChange(item.code);
    close();
  };

  const invalid = error !== undefined;
  const triggerProps = {
    id: baseId,
    'aria-labelledby': labelId,
    'aria-invalid': invalid || undefined,
    'aria-describedby': invalid ? errorId : undefined,
    disabled,
    className: TRIGGER_CLASS,
    'data-testid': testId,
  };

  const triggerContent = (
    <>
      {selected === undefined ? (
        <span className="truncate text-muted-foreground">{NO_COUNTRY_LABEL}</span>
      ) : (
        <span className="truncate">
          {selected.name}{' '}
          <span className="font-mono text-muted-foreground">(+{selected.callingCode})</span>
        </span>
      )}
      <ChevronDownIcon aria-hidden className={CHEVRON_CLASS} />
    </>
  );

  const renderItem = (itemClassName: string) =>
    function renderCountryItem(item: CountryItem, index: number): ReactNode {
      const isSelected = item.code === value;
      return (
        <AutocompleteItem
          key={itemKey(item)}
          index={index}
          value={item}
          aria-selected={isSelected}
          data-selected={isSelected ? '' : undefined}
          data-testid={testId === undefined ? undefined : `${testId}-option-${itemKey(item)}`}
          className={cn(ITEM_CLASS, itemClassName)}
          ref={isSelected ? scrollIntoViewOnMount : undefined}
          onClick={() => choose(item)}
        >
          {item.code === null ? (
            <span className="flex-1 text-muted-foreground">{NO_COUNTRY_LABEL}</span>
          ) : (
            <>
              <span className="flex-1 truncate">{item.name}</span>
              <span className="font-mono text-[13px] text-muted-foreground">
                +{item.callingCode}
              </span>
            </>
          )}
          <CheckIcon aria-hidden className={isSelected ? 'opacity-100' : 'opacity-0'} />
        </AutocompleteItem>
      );
    };

  const search = (inputClassName: string) => (
    <AutocompleteInputGroup>
      <AutocompleteIcon />
      <AutocompleteInput
        ref={searchRef}
        aria-label={SEARCH_LABEL}
        placeholder={SEARCH_PLACEHOLDER}
        className={cn(SEARCH_INPUT_CLASS, inputClassName)}
      />
    </AutocompleteInputGroup>
  );

  const list = (itemClassName: string, listClassName: string) => (
    <>
      <AutocompleteList
        id={listId}
        aria-labelledby={labelId}
        data-testid={testId === undefined ? undefined : `${testId}-list`}
        className={cn('gap-0.5 overflow-y-auto overscroll-contain', listClassName)}
      >
        {renderItem(itemClassName)}
      </AutocompleteList>
      <AutocompleteEmpty className="px-2.5 text-left empty:p-0">
        {items.length === 0 ? noMatchesLabel(query.trim()) : null}
      </AutocompleteEmpty>
    </>
  );

  const autocompleteProps = {
    items,
    mode: 'none' as const,
    value: query,
    onValueChange: handleQueryChange,
    itemToStringValue: itemText,
    disabled,
  };

  return (
    <div className="flex flex-col gap-2">
      <Label id={labelId} htmlFor={baseId}>
        {label}
      </Label>

      {isMobile ? (
        <>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            {...triggerProps}
          >
            {triggerContent}
          </button>
          <Sheet
            open={open}
            onOpenChange={handleOpenChange}
            disableEscapeDismissal={false}
            disablePointerDismissal={false}
          >
            <SheetContent
              side="bottom"
              showCloseButton={false}
              initialFocus={searchRef}
              className={cn(
                'max-h-[85dvh] gap-2 rounded-t-2xl px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]',
                'duration-[250ms] data-[side=bottom]:data-starting-style:translate-y-full data-[side=bottom]:data-ending-style:translate-y-full motion-reduce:transition-none',
              )}
            >
              <span aria-hidden className="h-1 w-10 shrink-0 self-center rounded-full bg-border" />
              <div className="flex items-center justify-between">
                <SheetTitle>{label}</SheetTitle>
                <SheetClose
                  render={<Button variant="ghost" size="icon" touch aria-label={CLOSE_LABEL} />}
                >
                  <XIcon aria-hidden />
                </SheetClose>
              </div>
              <Autocomplete<CountryItem> {...autocompleteProps} inline open>
                {search('h-12')}
                {list('min-h-12', 'min-h-0 flex-1')}
              </Autocomplete>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <Autocomplete<CountryItem>
          {...autocompleteProps}
          open={open}
          onOpenChange={handleOpenChange}
        >
          <AutocompleteTrigger {...triggerProps}>{triggerContent}</AutocompleteTrigger>
          <AutocompleteContent className="p-1.5">
            <div className="mb-1.5">{search('h-11')}</div>
            {list('min-h-11', 'max-h-66')}
          </AutocompleteContent>
        </Autocomplete>
      )}

      <FieldError
        id={errorId}
        message={
          error === undefined ? undefined : (
            <span className="flex items-center gap-1.5">
              <CircleAlertIcon aria-hidden className="size-4 shrink-0" />
              {error}
            </span>
          )
        }
      />
    </div>
  );
}
