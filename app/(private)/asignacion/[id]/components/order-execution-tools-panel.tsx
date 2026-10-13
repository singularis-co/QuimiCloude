'use client';

import { useId } from 'react';

import { ChevronDownIcon, PackageIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import type { ExecutionLineView, ExecutionToolView } from '@/lib/modules/asignaciones';
import { cn } from '@/lib/utils';

import { OrderExecutionLines } from './order-execution-lines';
import { OrderExecutionTools } from './order-execution-tools';

export const ORDER_EXECUTION_MATERIALS_TESTID = 'order-execution-materials';
export const ORDER_EXECUTION_MATERIALS_DIVIDER_TESTID = 'order-execution-materials-divider';
export const ORDER_EXECUTION_TOOLS_PANEL_TRIGGER_TESTID = 'order-execution-tools-panel-trigger';
export const ORDER_EXECUTION_TOOLS_PANEL_COUNT_TESTID = 'order-execution-tools-panel-count';
export const ORDER_EXECUTION_TOOLS_PANEL_CONTENT_TESTID = 'order-execution-tools-panel-content';

export const ORDER_EXECUTION_TOOLS_PANEL_TEXTS = {
  tools: 'Herramientas',
  materials: 'Materiales',
} as const;

export type OrderExecutionToolsPanelProps = {
  readonly tools: readonly ExecutionToolView[];
  readonly lines: readonly ExecutionLineView[];
  readonly className?: string;
};

/**
 * Herramientas y materiales de la receta en un panel plegable, abierto al entrar. El contenido
 * sigue montado al plegarlo: la unidad elegida en cada línea no se pierde.
 */
export function OrderExecutionToolsPanel({
  tools,
  lines,
  className,
}: OrderExecutionToolsPanelProps) {
  const baseId = useId();
  const titleId = `${baseId}-tools`;
  const materialsId = `${baseId}-materials`;

  return (
    <Card className={cn('gap-0 py-0', className)} data-testid={ORDER_EXECUTION_MATERIALS_TESTID}>
      <Collapsible defaultOpen>
        <CollapsibleTrigger
          className="group flex min-h-13 w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-4 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-testid={ORDER_EXECUTION_TOOLS_PANEL_TRIGGER_TESTID}
        >
          <span className="flex items-center gap-2.5">
            <PackageIcon aria-hidden="true" className="size-5 text-muted-foreground" />
            <span id={titleId} className="text-base font-semibold">
              {ORDER_EXECUTION_TOOLS_PANEL_TEXTS.tools}
            </span>
            <span
              className="rounded-full bg-muted px-2 py-0.5 font-mono text-sm tabular-nums"
              data-testid={ORDER_EXECUTION_TOOLS_PANEL_COUNT_TESTID}
            >
              {tools.length}
            </span>
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className="size-5 transition-transform duration-(--dur-base) group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
          />
        </CollapsibleTrigger>
        <CollapsibleContent keepMounted data-testid={ORDER_EXECUTION_TOOLS_PANEL_CONTENT_TESTID}>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <OrderExecutionTools tools={tools} labelledBy={titleId} />
            {/* Sin herramientas `OrderExecutionTools` no pinta nada: el divisor quedaría colgando. */}
            {tools.length > 0 ? (
              <Separator data-testid={ORDER_EXECUTION_MATERIALS_DIVIDER_TESTID} />
            ) : null}
            <section aria-labelledby={materialsId} className="flex flex-col gap-2">
              <h3
                id={materialsId}
                className="font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                {ORDER_EXECUTION_TOOLS_PANEL_TEXTS.materials}
              </h3>
              <OrderExecutionLines lines={lines} />
            </section>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
