import type { ComponentProps, ReactNode } from 'react';
import { cva } from 'class-variance-authority';

import { Badge } from '@/components/ui/badge';
import { STATUS_TONES, type StatusTone } from '@/lib/shared/ui/status-tone';
import { cn } from '@/lib/utils';

export { STATUS_TONES, type StatusTone };

const statusBadgeVariants = cva(
  'h-[22px] shrink-0 gap-1.5 rounded-full border-0 py-0 pr-[9px] pl-2 text-xs font-medium whitespace-nowrap transition-[background-color,color] duration-(--dur-base) ease-(--ease-standard)',
  {
    variants: {
      tone: {
        neutral: 'bg-status-neutral-subtle text-status-neutral-text',
        progress: 'bg-status-progress-subtle text-status-progress-text',
        waiting: 'bg-warning-subtle text-warning-text',
        success: 'bg-success-subtle text-success-text',
        danger: 'bg-destructive-subtle text-destructive-text',
        info: 'bg-info-subtle text-info-text',
        muted: 'bg-transparent text-muted-foreground inset-ring inset-ring-border',
      },
    },
  },
);

const statusDotVariants = cva('size-1.5 shrink-0 rounded-full', {
  variants: {
    tone: {
      neutral: 'bg-status-neutral-dot',
      progress: 'animate-[status-pulse_1.6s_var(--ease-standard)_infinite] bg-status-progress-dot',
      waiting: 'bg-warning',
      success: 'bg-success',
      danger: 'bg-destructive',
      info: 'bg-info',
      muted: 'bg-muted-foreground opacity-60',
    },
  },
});

// Si llegan `children`, mandan sobre `label`: sirven para una etiqueta con marcado propio.
export type StatusBadgeProps = {
  readonly tone: StatusTone;
  readonly label: string;
  readonly children?: ReactNode;
} & Omit<ComponentProps<'span'>, 'children'>;

export function StatusBadge({ tone, label, children, className, ...props }: StatusBadgeProps) {
  return (
    <Badge {...props} data-tone={tone} className={cn(statusBadgeVariants({ tone }), className)}>
      <span aria-hidden="true" data-slot="status-dot" className={statusDotVariants({ tone })} />
      {children ?? label}
    </Badge>
  );
}
