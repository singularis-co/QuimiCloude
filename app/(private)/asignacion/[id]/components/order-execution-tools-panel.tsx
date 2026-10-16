'use client';

import { useId } from 'react';

import { FlaskConicalIcon, WrenchIcon } from 'lucide-react';

import type { ExecutionLineView, ExecutionToolView } from '@/lib/modules/asignaciones';
import { cn } from '@/lib/utils';

import { OrderExecutionCollapsibleCard } from '../../components/order-execution-collapsible-card';

import { OrderExecutionLines } from './order-execution-lines';
import { OrderExecutionTools } from './order-execution-tools';

/** La columna lateral entera: las dos Cards plegables. */
export const ORDER_EXECUTION_MATERIALS_TESTID = 'order-execution-materials';
export const ORDER_EXECUTION_TOOLS_PANEL_TESTID = 'order-execution-tools-panel';
export const ORDER_EXECUTION_TOOLS_PANEL_TRIGGER_TESTID = 'order-execution-tools-panel-trigger';
export const ORDER_EXECUTION_TOOLS_PANEL_COUNT_TESTID = 'order-execution-tools-panel-count';
export const ORDER_EXECUTION_TOOLS_PANEL_CONTENT_TESTID = 'order-execution-tools-panel-content';
export const ORDER_EXECUTION_MATERIALS_PANEL_TESTID = 'order-execution-materials-panel';
export const ORDER_EXECUTION_MATERIALS_PANEL_TRIGGER_TESTID =
  'order-execution-materials-panel-trigger';
export const ORDER_EXECUTION_MATERIALS_PANEL_COUNT_TESTID = 'order-execution-materials-panel-count';
export const ORDER_EXECUTION_MATERIALS_PANEL_CONTENT_TESTID =
  'order-execution-materials-panel-content';

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
 * Herramientas y materiales de la receta, cada uno en su Card plegable e independiente, abiertas
 * al entrar. Sin herramientas no se pinta su Card: `OrderExecutionTools` tampoco pintaría nada.
 */
export function OrderExecutionToolsPanel({
  tools,
  lines,
  className,
}: OrderExecutionToolsPanelProps) {
  const baseId = useId();
  const toolsTitleId = `${baseId}-tools`;
  const materialsTitleId = `${baseId}-materials`;

  return (
    <div
      className={cn('flex min-w-0 flex-col gap-4', className)}
      data-testid={ORDER_EXECUTION_MATERIALS_TESTID}
    >
      {tools.length > 0 ? (
        <OrderExecutionCollapsibleCard
          icon={WrenchIcon}
          title={ORDER_EXECUTION_TOOLS_PANEL_TEXTS.tools}
          titleId={toolsTitleId}
          count={tools.length}
          testIds={{
            card: ORDER_EXECUTION_TOOLS_PANEL_TESTID,
            trigger: ORDER_EXECUTION_TOOLS_PANEL_TRIGGER_TESTID,
            count: ORDER_EXECUTION_TOOLS_PANEL_COUNT_TESTID,
            content: ORDER_EXECUTION_TOOLS_PANEL_CONTENT_TESTID,
          }}
        >
          <OrderExecutionTools tools={tools} labelledBy={toolsTitleId} />
        </OrderExecutionCollapsibleCard>
      ) : null}
      <OrderExecutionCollapsibleCard
        icon={FlaskConicalIcon}
        title={ORDER_EXECUTION_TOOLS_PANEL_TEXTS.materials}
        titleId={materialsTitleId}
        count={lines.length}
        testIds={{
          card: ORDER_EXECUTION_MATERIALS_PANEL_TESTID,
          trigger: ORDER_EXECUTION_MATERIALS_PANEL_TRIGGER_TESTID,
          count: ORDER_EXECUTION_MATERIALS_PANEL_COUNT_TESTID,
          content: ORDER_EXECUTION_MATERIALS_PANEL_CONTENT_TESTID,
        }}
      >
        <section aria-labelledby={materialsTitleId}>
          <OrderExecutionLines lines={lines} />
        </section>
      </OrderExecutionCollapsibleCard>
    </div>
  );
}
