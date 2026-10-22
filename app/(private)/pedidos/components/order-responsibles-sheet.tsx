'use client';

import {
  OrderDistributionLabel,
  type OrderDistributionLabelLine,
} from '@/components/shared/order-distribution-label';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { OrderResponsible } from '@/lib/modules/asignaciones';
import type { OrderPresentationLineView, OrderSummary } from '@/lib/modules/pedidos';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { exactDecimalTitle, formatDecimalDisplay } from '@/lib/shared/ui/decimal-display';
import { touchTarget } from '@/lib/shared/ui/touch-target';

import { orderCustomerLabel } from '@/components/shared/order-customer-label';
import { OrderRecipeImage } from './order-recipe-image';
import {
  EMPTY_RESPONSIBLES_CATALOG,
  OrderResponsibles,
  type OrderResponsiblesCatalog,
} from './order-responsibles';
import { isFinalOrderStatus } from './order-row-actions';
import { OrderPriorityBadge, OrderStatusBadge } from './order-status-badge';

export const ORDER_RESPONSIBLES_SHEET_TESTID = 'order-responsibles-sheet';
export const ORDER_RESPONSIBLES_SUMMARY_TESTID = 'order-responsibles-summary';
/** El contenedor de la gestión de responsables dentro de su hoja. */
export const ORDER_SHEET_RESPONSIBLES_TESTID = 'order-sheet-responsibles';
export const ORDER_RESPONSIBLES_CLOSE_TESTID = 'order-responsibles-close';

export const ORDER_RESPONSIBLES_SHEET_LABELS = {
  title: 'Responsables',
  orderNumber: 'Pedido',
  summary: 'Datos del pedido',
  quantity: 'Cantidad',
  distribution: 'Reparto',
  priority: 'Prioridad',
  customer: 'Cliente',
  missing: 'Sin dato',
  close: 'Cerrar',
} as const;

const LABELS = ORDER_RESPONSIBLES_SHEET_LABELS;

/**
 * Los campos de la linea que pinta `OrderDistributionLabel`, sin mezclar: la etiqueta decide el
 * nombre (envase y volumen, o la presentacion en una linea antigua).
 */
export function distributionLabelLine(line: OrderPresentationLineView): OrderDistributionLabelLine {
  return {
    presentationName: line.presentationName,
    packagingName: line.packagingName,
    packages: line.packages,
    presentationContent: line.presentationContent,
    presentationUnitLabel: line.presentationUnitLabel,
  };
}

function Missing() {
  return <span aria-label={LABELS.missing}>{EMPTY_MARK}</span>;
}

export type OrderResponsiblesSheetProps = {
  readonly order: OrderSummary;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Los responsables que la fila ya trajo: abrir la hoja no consulta nada. */
  readonly responsibles: readonly OrderResponsible[];
  readonly responsiblesCatalog?: OrderResponsiblesCatalog;
};

/**
 * Hoja de responsables: los datos del pedido como ficha de solo lectura y, debajo, lo único que
 * aquí se edita, asignar y quitar responsables.
 */
export function OrderResponsiblesSheet({
  order,
  open,
  onOpenChange,
  responsibles,
  responsiblesCatalog = EMPTY_RESPONSIBLES_CATALOG,
}: OrderResponsiblesSheetProps) {
  const recipeName = order.recipeName?.trim() ?? '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full pb-[env(safe-area-inset-bottom)] data-[side=right]:w-full sm:max-w-lg"
        data-testid={ORDER_RESPONSIBLES_SHEET_TESTID}
        footer={
          <SheetClose
            render={
              <Button
                type="button"
                variant="outline"
                className={touchTarget}
                data-testid={ORDER_RESPONSIBLES_CLOSE_TESTID}
              />
            }
          >
            {LABELS.close}
          </SheetClose>
        }
      >
        <SheetHeader>
          <SheetTitle>{LABELS.title}</SheetTitle>
          <SheetDescription>
            {LABELS.orderNumber} <span className="font-mono">{order.numberText}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <section
            aria-label={LABELS.summary}
            className="flex flex-col gap-3 rounded-lg border p-4"
            data-testid={ORDER_RESPONSIBLES_SUMMARY_TESTID}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="size-16 shrink-0">
                <OrderRecipeImage imageUrl={order.recipeImageUrl} name={recipeName} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h3 className="text-base font-semibold break-words">
                  {recipeName === '' ? <Missing /> : recipeName}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {LABELS.orderNumber} <span className="font-mono">{order.numberText}</span>
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>

            <dl
              className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-md bg-muted px-4 py-3 text-sm"
            >
              <dt className="text-muted-foreground">{LABELS.quantity}</dt>
              <dd className="font-mono tabular-nums" title={exactDecimalTitle(order.quantity)}>
                {formatDecimalDisplay(order.quantity)}
                {order.unitLabel === null ? null : ` ${order.unitLabel}`}
              </dd>
              <dt className="text-muted-foreground">{LABELS.distribution}</dt>
              <dd className="min-w-0 break-words">
                <OrderDistributionLabel lines={order.presentationLines.map(distributionLabelLine)} />
              </dd>
              <dt className="text-muted-foreground">{LABELS.priority}</dt>
              <dd>
                <OrderPriorityBadge priority={order.priority} />
              </dd>
              <dt className="text-muted-foreground">{LABELS.customer}</dt>
              <dd className="min-w-0 break-words">
                {order.customer === null ? <Missing /> : orderCustomerLabel(order.customer)}
              </dd>
            </dl>
          </section>

          <div data-testid={ORDER_SHEET_RESPONSIBLES_TESTID} data-section="responsibles">
            <OrderResponsibles
              orderId={order.id}
              responsibles={responsibles}
              canWrite={responsiblesCatalog.canWrite}
              isFinal={isFinalOrderStatus(order.status)}
              people={responsiblesCatalog.people}
              workGroups={responsiblesCatalog.workGroups}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
