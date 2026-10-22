'use client';

import type { ComponentProps } from 'react';
import { PlusIcon } from 'lucide-react';

import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

import type { DataTableFilterSpec, DataTableFilterValue } from './data-table-types';

/** Valor que se pinta dentro del chip, o `null` si el filtro no está activo. */
export function formatFilterChipValue(
  spec: DataTableFilterSpec,
  value: DataTableFilterValue | undefined,
): string | null {
  if (value === undefined || value.kind !== spec.kind) return null;

  switch (value.kind) {
    case 'select': {
      const [first, ...rest] = value.values;
      if (first === undefined) return null;
      const options = spec.kind === 'select' ? spec.options : [];
      const firstLabel = options.find((option) => option.value === first)?.label ?? first;
      return rest.length === 0 ? firstLabel : `${firstLabel} +${rest.length}`;
    }
    case 'text':
      return value.value === '' ? null : value.value;
    case 'numberRange':
      return formatRange(value.min === null ? null : String(value.min), value.max === null ? null : String(value.max));
    case 'dateRange':
      return formatRange(value.from, value.to);
  }
}

function formatRange(from: string | null, to: string | null): string | null {
  if (from !== null && to !== null) return `${from} – ${to}`;
  if (from !== null) return `≥ ${from}`;
  if (to !== null) return `≤ ${to}`;
  return null;
}

export type DataTableFilterChipProps = Omit<ComponentProps<'button'>, 'value'> & {
  readonly label: string;
  readonly value: string | null;
};

export function DataTableFilterChip({ label, value, className, type = 'button', ...props }: DataTableFilterChipProps) {
  const active = value !== null;

  return (
    <button
      type={type}
      data-active={active ? 'true' : undefined}
      className={cn(
        'btn-veil inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[13px] font-medium whitespace-nowrap outline-none select-none active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring [&_svg]:pointer-events-none [&_svg]:shrink-0',
        touchTarget,
        active
          ? 'border-solid border-primary bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))] text-primary'
          : 'border-dashed border-input bg-transparent text-foreground',
        className,
      )}
      {...props}
    >
      {active ? null : <PlusIcon className="size-4" aria-hidden="true" />}
      <span>{label}</span>
      {active ? (
        <>
          {' '}
          <span className="border-l border-border pl-2 font-semibold text-foreground">{value}</span>
        </>
      ) : null}
    </button>
  );
}
