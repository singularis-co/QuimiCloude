'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';

import { FieldError } from '@/components/shared/field-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { type OrderCustomerChoice } from '@/components/shared/order-customer-label';
import { OrderCustomerPicker } from '@/components/shared/order-customer-picker';

export const ORDER_DELIVERY_BLOCK_TESTID = 'order-delivery-block';
export const ORDER_DELIVERY_BLOCK_REMOVE_TESTID = 'order-delivery-block-remove';
export const ORDER_DELIVERY_BLOCK_ERROR_TESTID = 'order-delivery-block-error';
export const ORDER_DELIVERY_ADD_CUSTOMER_TESTID = 'order-delivery-add-customer';
export const ORDER_DELIVERY_LINE_TESTID = 'order-delivery-line';
export const ORDER_DELIVERY_BATCH_TESTID = 'order-delivery-batch';
export const ORDER_DELIVERY_BATCH_PACKAGES_TESTID = 'order-delivery-batch-packages';
export const ORDER_DELIVERY_BATCH_OVER_TESTID = 'order-delivery-batch-over';

export type OrderDeliveryBlockBatch = {
  readonly batchId: string;
  readonly lot: string;
  /** Lo que le queda al lote despues de lo que llevan todos los clientes. */
  readonly leftPackages: number;
  readonly availablePackages: number;
  /** Lo escrito en el lote entre todos los clientes supera sus envases disponibles. */
  readonly over: boolean;
  readonly value: string;
};

export type OrderDeliveryBlockPresentation = {
  readonly presentationLineId: string;
  readonly presentationName: string;
  /** Envases de esta presentacion que lleva este cliente. */
  readonly packages: number;
  readonly batches: readonly OrderDeliveryBlockBatch[];
};

export type OrderDeliveryCustomerBlockLabels = {
  readonly title: (position: number) => string;
  readonly remove: string;
  readonly removeAria: (position: number) => string;
  readonly customer: string;
  readonly customerPlaceholder: string;
  readonly customerEmpty: string;
  readonly packagesCount: (packages: number) => string;
  readonly noBatches: string;
  readonly lot: string;
  readonly available: string;
  readonly entry: string;
  readonly packagesAria: (lot: string, presentationName: string, position: number) => string;
  readonly onlyAvailable: (packages: number) => string;
};

export type OrderDeliveryCustomerBlockProps = {
  /** Posicion del bloque contando desde 0. */
  readonly index: number;
  readonly canRemove: boolean;
  readonly onRemove: () => void;
  readonly customer: OrderCustomerChoice | null;
  readonly onCustomerChange: (choice: OrderCustomerChoice | null) => void;
  readonly error: string | null;
  readonly presentations: readonly OrderDeliveryBlockPresentation[];
  readonly onPackagesChange: (presentationLineId: string, batchId: string, text: string) => void;
  readonly disabled: boolean;
  readonly labels: OrderDeliveryCustomerBlockLabels;
};

/** Un cliente de la entrega: su buscador y, por presentacion, los envases que lleva de cada lote. */
export function OrderDeliveryCustomerBlock({
  index,
  canRemove,
  onRemove,
  customer,
  onCustomerChange,
  error,
  presentations,
  onPackagesChange,
  disabled,
  labels,
}: OrderDeliveryCustomerBlockProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const customerFieldId = `${baseId}-customer`;
  const errorId = `${baseId}-error`;
  const position = index + 1;

  return (
    <section
      className="flex flex-col gap-3.5 rounded-lg border p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-(--dur-base)"
      aria-labelledby={titleId}
      data-testid={ORDER_DELIVERY_BLOCK_TESTID}
      data-block-index={index}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={titleId} className="text-base font-semibold">
          {labels.title(position)}
        </h3>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            touch
            onClick={onRemove}
            disabled={disabled}
            aria-label={labels.removeAria(position)}
            data-testid={ORDER_DELIVERY_BLOCK_REMOVE_TESTID}
          >
            <Trash2 aria-hidden="true" />
            {labels.remove}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={customerFieldId} className="text-sm font-medium">
          {labels.customer}
          <span aria-hidden="true" className="text-destructive">
            {' *'}
          </span>
        </label>
        <OrderCustomerPicker
          purpose="deliver"
          id={customerFieldId}
          value={customer}
          onChange={onCustomerChange}
          disabled={disabled}
          placeholder={labels.customerPlaceholder}
          emptyMessage={labels.customerEmpty}
          aria-invalid={error !== null}
          aria-describedby={error === null ? undefined : errorId}
        />
        {error === null ? null : (
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-(--dur-base)">
            <FieldError id={errorId} message={error} testId={ORDER_DELIVERY_BLOCK_ERROR_TESTID} />
          </div>
        )}
      </div>

      {presentations.map((presentation) => (
        <BlockPresentation
          key={presentation.presentationLineId}
          presentation={presentation}
          position={position}
          baseId={baseId}
          onPackagesChange={onPackagesChange}
          disabled={disabled}
          labels={labels}
        />
      ))}
    </section>
  );
}

type BlockPresentationProps = {
  readonly presentation: OrderDeliveryBlockPresentation;
  readonly position: number;
  readonly baseId: string;
  readonly onPackagesChange: OrderDeliveryCustomerBlockProps['onPackagesChange'];
  readonly disabled: boolean;
  readonly labels: OrderDeliveryCustomerBlockLabels;
};

// Una sola rejilla para todos los anchos: en teléfono cada lote es una tarjeta y desde `sm` las
// filas se alinean bajo la cabecera, sin duplicar el campo de envases.
function BlockPresentation({ presentation, position, baseId, onPackagesChange, disabled, labels }: BlockPresentationProps) {
  const { presentationLineId, presentationName } = presentation;
  return (
    <div
      className="flex flex-col gap-2"
      role="group"
      aria-label={presentationName}
      data-testid={ORDER_DELIVERY_LINE_TESTID}
      data-presentation-line-id={presentationLineId}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 text-sm font-semibold break-words">{presentationName}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{labels.packagesCount(presentation.packages)}</span>
      </div>
      {presentation.batches.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.noBatches}</p>
      ) : (
        <div className="flex flex-col gap-2 sm:gap-0 sm:rounded-lg sm:border">
          <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(0,1fr)_auto_7rem] gap-3 border-b px-3 py-2 text-xs font-medium text-muted-foreground sm:grid"
          >
            <span>{labels.lot}</span>
            <span className="text-right">{labels.available}</span>
            <span>{labels.entry}</span>
          </div>
          {presentation.batches.map((batch) => {
            const fieldId = `${baseId}-${presentationLineId}-${batch.batchId}`;
            const overId = `${fieldId}-over`;
            return (
              <div
                key={batch.batchId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_auto_7rem] sm:rounded-none sm:border-0 sm:border-b sm:px-3 sm:py-2 sm:last:border-b-0"
                data-testid={ORDER_DELIVERY_BATCH_TESTID}
                data-batch-id={batch.batchId}
              >
                <span className="font-mono text-sm font-medium break-all">
                  <span className="sr-only">{labels.lot} </span>
                  {batch.lot}
                </span>
                <span className="text-right text-sm">
                  <span className="text-muted-foreground sm:sr-only">{labels.available} </span>
                  <span className={cn('font-mono tabular-nums', batch.leftPackages === 0 && 'text-muted-foreground')}>
                    {batch.leftPackages}
                  </span>
                </span>
                <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                  <span aria-hidden="true" className="text-xs font-medium sm:hidden">
                    {labels.entry}
                  </span>
                  <Input
                    id={fieldId}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    aria-label={labels.packagesAria(batch.lot, presentationName, position)}
                    aria-invalid={batch.over}
                    aria-describedby={batch.over ? overId : undefined}
                    className="min-h-11 font-mono text-base tabular-nums md:text-base"
                    value={batch.value}
                    onChange={(event) => onPackagesChange(presentationLineId, batch.batchId, event.target.value)}
                    disabled={disabled}
                    data-testid={ORDER_DELIVERY_BATCH_PACKAGES_TESTID}
                  />
                  {batch.over ? (
                    <p id={overId} className="text-sm text-destructive" data-testid={ORDER_DELIVERY_BATCH_OVER_TESTID}>
                      {labels.onlyAvailable(batch.availablePackages)}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type OrderDeliveryAddCustomerProps = {
  readonly onAdd: () => void;
  readonly disabled: boolean;
  readonly label: string;
};

export function OrderDeliveryAddCustomer({ onAdd, disabled, label }: OrderDeliveryAddCustomerProps) {
  return (
    <Button
      type="button"
      variant="outline-dashed"
      touch
      className="w-full"
      onClick={onAdd}
      disabled={disabled}
      data-testid={ORDER_DELIVERY_ADD_CUSTOMER_TESTID}
    >
      <Plus aria-hidden="true" />
      {label}
    </Button>
  );
}
