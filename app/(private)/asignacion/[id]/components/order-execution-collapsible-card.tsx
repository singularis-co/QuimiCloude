'use client';

import type { ReactNode } from 'react';

import { ChevronDownIcon, type LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export type OrderExecutionCollapsibleCardProps = {
  readonly icon: LucideIcon;
  readonly title: ReactNode;
  /** Id del título: el contenido lo usa como `aria-labelledby`. */
  readonly titleId: string;
  readonly count: number;
  readonly testIds: {
    readonly card: string;
    readonly trigger: string;
    readonly count: string;
    readonly content: string;
  };
  readonly children: ReactNode;
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
  testIds,
  children,
}: OrderExecutionCollapsibleCardProps) {
  return (
    <Card className="gap-0 py-0" data-testid={testIds.card}>
      <Collapsible defaultOpen>
        <CollapsibleTrigger
          className="group flex min-h-13 w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-4 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-testid={testIds.trigger}
        >
          <span className="flex items-center gap-2.5">
            <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
            <span id={titleId} className="text-base font-semibold">
              {title}
            </span>
            <span
              className="rounded-full bg-muted px-2 py-0.5 font-mono text-sm tabular-nums"
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
          <div className="px-4 pb-4">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
