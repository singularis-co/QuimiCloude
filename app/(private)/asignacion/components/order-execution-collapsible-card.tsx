'use client';

import type { ReactNode } from 'react';

import { ChevronDownIcon, type LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export type OperatorSectionTone = 'materials' | 'tools' | 'team';

export type OrderExecutionCollapsibleCardProps = {
  readonly icon: LucideIcon;
  readonly title: ReactNode;
  /** Id del título: el contenido lo usa como `aria-labelledby`. */
  readonly titleId: string;
  readonly count: number;
  readonly tone?: OperatorSectionTone;
  readonly testIds: {
    readonly card: string;
    readonly trigger: string;
    readonly count: string;
    readonly content: string;
  };
  readonly children: ReactNode;
};

// Literales completos: Tailwind solo genera las clases que encuentra escritas en el código.
export const OPERATOR_SECTION_TONE_CLASSES: Record<OperatorSectionTone, string> = {
  materials: 'bg-(--section-materials)',
  tools: 'bg-(--section-tools)',
  team: 'bg-(--section-team)',
};

/**
 * Card plegable de la ejecución, abierta al entrar. El contenido sigue montado al plegarla: el
 * estado de dentro (la unidad elegida en cada línea) no se pierde.
 */
export function OrderExecutionCollapsibleCard({
  icon: Icon,
  title,
  titleId,
  count,
  tone,
  testIds,
  children,
}: OrderExecutionCollapsibleCardProps) {
  const toned = tone !== undefined;

  return (
    <Card className="gap-0 py-0" data-testid={testIds.card}>
      <Collapsible defaultOpen>
        <CollapsibleTrigger
          className={cn(
            'group flex min-h-13 w-full cursor-pointer items-center justify-between gap-3 px-4 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            toned
              ? cn('rounded-none text-(--section-foreground)', OPERATOR_SECTION_TONE_CLASSES[tone])
              : 'rounded-xl',
          )}
          data-testid={testIds.trigger}
          data-tone={tone}
        >
          <span className="flex items-center gap-2.5">
            <Icon
              aria-hidden="true"
              className={cn('size-5', toned ? 'text-current' : 'text-muted-foreground')}
            />
            <span id={titleId} className="text-base font-semibold">
              {title}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 font-mono text-sm tabular-nums',
                toned ? 'bg-(--section-foreground)/22 text-(--section-foreground)' : 'bg-muted',
              )}
              data-testid={testIds.count}
            >
              {count}
            </span>
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className="size-5 transition-transform duration-(--dur-base) group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
          />
        </CollapsibleTrigger>
        <CollapsibleContent keepMounted data-testid={testIds.content}>
          <div className={cn('px-4 pb-4', toned && 'pt-4')}>{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
