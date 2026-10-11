import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export type NoticeTone = 'success' | 'warning' | 'info' | 'danger';

export type NoticeProps = {
  readonly tone: NoticeTone;
  readonly title?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly testId?: string;
};

const TONES: Readonly<Record<NoticeTone, { readonly icon: LucideIcon; readonly classes: string }>> = {
  success: { icon: CircleCheck, classes: 'border-success-border bg-success-subtle text-success-text' },
  warning: { icon: TriangleAlert, classes: 'border-warning-border bg-warning-subtle text-warning-text' },
  info: { icon: Info, classes: 'border-info-border bg-info-subtle text-info-text' },
  danger: { icon: CircleAlert, classes: 'border-destructive-border bg-destructive-subtle text-destructive-text' },
};

// Compone el Alert de shadcn: el layout del tablero (flex, gap 12, padding 12/14, radio 10)
// sustituye al grid base vía tailwind-merge, y el role de Alert se sobrescribe por props.
export function Notice({ tone, title, children, className, testId }: NoticeProps) {
  const { icon: Icon, classes } = TONES[tone];
  return (
    <Alert
      role={tone === 'danger' ? 'alert' : 'status'}
      data-tone={tone}
      data-testid={testId}
      className={cn(
        'flex items-start gap-3 rounded-[10px] border px-3.5 py-3 text-sm leading-[1.45]',
        'has-[>svg]:gap-x-3 *:[svg]:translate-y-0',
        'animate-in fade-in slide-in-from-bottom-[10px] duration-(--dur-slow) ease-(--ease-enter)',
        classes,
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-px size-[18px] shrink-0" data-slot="notice-icon" />
      <div className="min-w-0">
        {title !== undefined && <AlertTitle className="mb-0.5 font-semibold">{title}</AlertTitle>}
        {children !== undefined && (
          <AlertDescription className="text-current">{children}</AlertDescription>
        )}
      </div>
    </Alert>
  );
}
