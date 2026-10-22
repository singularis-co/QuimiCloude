import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/** 1–3 llenan esa cantidad de barras; 4 es la prioridad crítica. */
export type PriorityLevel = 1 | 2 | 3 | 4;

const CRITICAL_LEVEL = 4;

const BARS = [
  { x: 1, y: 10, height: 5 },
  { x: 6, y: 6, height: 9 },
  { x: 11, y: 2, height: 13 },
] as const;

function PriorityBars({ filled }: { readonly filled: number }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 shrink-0" data-slot="priority-icon">
      {BARS.map((bar, index) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={bar.y}
          width={3}
          height={bar.height}
          rx={1}
          fill="currentColor"
          opacity={index < filled ? undefined : 0.2}
          data-filled={index < filled}
        />
      ))}
    </svg>
  );
}

function CriticalIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 shrink-0" data-slot="priority-icon">
      <path d="M8 1.5 15 14H1z" fill="currentColor" />
      <rect x={7.2} y={6} width={1.6} height={4} className="fill-card" />
      <rect x={7.2} y={11} width={1.6} height={1.6} className="fill-card" />
    </svg>
  );
}

export type PriorityMarkProps = { readonly level: PriorityLevel; readonly label: string } & Omit<
  ComponentProps<'span'>,
  'children'
>;

export function PriorityMark({ level, label, className, ...props }: PriorityMarkProps) {
  const critical = level === CRITICAL_LEVEL;
  return (
    <span
      {...props}
      data-level={level}
      className={cn(
        'inline-flex items-center gap-2 text-[13px] whitespace-nowrap',
        critical && 'font-semibold text-destructive-text',
        className,
      )}
    >
      {critical ? <CriticalIcon /> : <PriorityBars filled={level} />}
      {label}
    </span>
  );
}
