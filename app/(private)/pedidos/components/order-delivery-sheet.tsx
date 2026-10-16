'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition, type FormEvent } from 'react';
import { toast } from 'sonner';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage, UNEXPECTED_ERROR_CODE, type ErrorState } from '@/lib/modules/errores';
import { newRequestId } from '@/lib/modules/observabilidad';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import {
  batchesOverAvailable,
  checkDelivery,
  checkDeliveryBlocks,
  flattenBlocks,
  packagesInLine,
  packagesLeftInBatch,
  type DeliveryAllocation,
  type DeliveryBatchState,
  type DeliveryBlockIssue,
  type DeliveryCheck,
  type DeliveryCustomerBlock,
  type OrderDeliveryView,
  type OrderSummary,
} from '@/lib/modules/pedidos';
import {
  deliverOrderAction,
  getOrderDeliveryAction,
  type DeliverOrderActionResult,
  type DeliverOrderInput,
  type OrderDeliveryResult,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';

import {
  OrderDeliveryAddCustomer,
  OrderDeliveryCustomerBlock,
  type OrderDeliveryBlockPresentation,
  type OrderDeliveryCustomerBlockLabels,
} from '@/components/shared/order-delivery-customer-block';
import { packagesKey, type OrderDeliveryDraft } from './order-delivery-draft';
import { OrderDeliverySummary, type OrderDeliverySummaryLabels, type OrderDeliverySummaryLine } from './order-delivery-summary';
import { type OrderCustomerChoice } from '@/components/shared/order-customer-label';
import { useOrderDeliveryDraft } from './use-order-delivery-draft';

export const ORDER_DELIVERY_SHEET_TESTID = 'order-delivery-sheet';
export const ORDER_DELIVERY_SKELETON_TESTID = 'order-delivery-skeleton';
export const ORDER_DELIVERY_ERROR_TESTID = 'order-delivery-error';
export const ORDER_DELIVERY_REJECTED_TESTID = 'order-delivery-rejected';
export const ORDER_DELIVERY_DRAFT_ADJUSTED_TESTID = 'order-delivery-draft-adjusted';
export const ORDER_DELIVERY_STOCK_OVER_TESTID = 'order-delivery-stock-over';
export const ORDER_DELIVERY_SUBMIT_TESTID = 'order-delivery-submit';
export const ORDER_DELIVERY_CANCEL_TESTID = 'order-delivery-cancel';

const LABELS = {
  title: (numberText: string) => `Entregar pedido ${numberText}`,
  description: 'Elige el cliente y, por presentación, de qué lotes salen los envases.',
  adjusted: 'Algunos lotes del borrador ya no están disponibles y se quitaron sus envases.',
  stockOver: 'Entre todos los clientes se pasa de lo disponible en un lote. Baja los envases para poder entregar.',
  addCustomer: 'Añadir cliente',
  submit: 'Entregar',
  submitting: 'Entregando…',
  cancel: 'Cancelar',
  delivered: 'Entrega registrada',
  completed: 'Pedido entregado',
  summary: {
    title: 'Por entregar',
    written: 'Entregas',
    of: 'de',
    complete: 'Completa',
    missing: (packages: number) => `Faltan ${packages}`,
    exceeds: (packages: number) => `Sobran ${packages}`,
    footnote: 'Suma de todos los clientes. El pedido es el tope por presentación.',
  } satisfies OrderDeliverySummaryLabels,
  block: {
    title: (position: number) => `Cliente ${position}`,
    remove: 'Quitar',
    removeAria: (position: number) => `Quitar el cliente ${position}`,
    customer: 'Cliente',
    customerPlaceholder: 'Busca un cliente por su nombre',
    customerEmpty: 'Ningún cliente coincide con la búsqueda.',
    packagesCount: (packages: number) => `${packages} envases`,
    noBatches: 'No hay lotes con envases disponibles para esta presentación.',
    lot: 'Lote',
    available: 'Disponibles',
    entry: 'Entrada',
    packagesAria: (lot: string, presentationName: string, position: number) =>
      `Envases del lote ${lot} de ${presentationName} para el cliente ${position}`,
    onlyAvailable: (packages: number) => `Solo hay ${packages}`,
  } satisfies OrderDeliveryCustomerBlockLabels,
  blockIssues: {
    missing_customer: 'Elige el cliente.',
    duplicate_customer: 'Este cliente ya está en la entrega.',
    no_packages: 'Este cliente no lleva envases: indica al menos uno en alguna presentación.',
  } satisfies Record<DeliveryBlockIssue, string>,
} as const;

const REREAD_CODES: ReadonlySet<ErrorState['code']> = new Set([
  'delivery_exceeds_remaining',
  'delivery_batch_insufficient',
]);

const WHOLE_NUMBER = /^\d+$/;
const NON_DIGITS = /\D/g;

/** Lo que no es un entero (p. ej. un borrador viejo con «2.5») no cuenta como envases. */
function writtenPackages(text: string | undefined): number {
  const trimmed = (text ?? '').trim();
  return WHOLE_NUMBER.test(trimmed) ? Number(trimmed) : 0;
}

function unexpectedFromRejection(): ErrorState {
  return {
    status: 'error',
    code: UNEXPECTED_ERROR_CODE,
    message: errorMessage(UNEXPECTED_ERROR_CODE),
    reference: newRequestId(),
  };
}

async function readDeliveryView(orderId: string): Promise<OrderDeliveryResult> {
  try {
    return await getOrderDeliveryAction(orderId);
  } catch {
    return unexpectedFromRejection();
  }
}

type Evaluation = {
  readonly blocks: readonly DeliveryCustomerBlock[];
  readonly allocations: readonly DeliveryAllocation[];
  readonly batches: readonly DeliveryBatchState[];
  readonly check: DeliveryCheck;
  readonly issues: ReadonlyMap<number, DeliveryBlockIssue>;
  readonly overBatchIds: ReadonlySet<string>;
};

function evaluate(view: OrderDeliveryView, draft: OrderDeliveryDraft): Evaluation {
  const pendingLines = view.lines.filter((line) => line.remainingPackages > 0);
  const blocks: DeliveryCustomerBlock[] = draft.blocks.map((block) => ({
    customerId: block.customer?.id ?? null,
    allocations: pendingLines.flatMap((line) =>
      line.batches.flatMap((batch) => {
        const packages = writtenPackages(block.packages[packagesKey(line.presentationLineId, batch.batchId)]);
        return packages > 0 ? [{ presentationLineId: line.presentationLineId, batchId: batch.batchId, packages }] : [];
      }),
    ),
  }));
  const allocations = flattenBlocks(blocks);
  const batches = view.lines.flatMap((line) =>
    line.batches.map((batch) => ({
      batchId: batch.batchId,
      presentationLineId: line.presentationLineId,
      availablePackages: batch.availablePackages,
    })),
  );
  const overBatchIds = new Set(batchesOverAvailable(batches, allocations));
  return {
    blocks,
    allocations,
    batches,
    check: checkDelivery(view.lines, batches, allocations),
    issues: checkDeliveryBlocks(blocks),
    overBatchIds,
  };
}

function summaryLines(view: OrderDeliveryView, evaluation: Evaluation): OrderDeliverySummaryLine[] {
  return view.lines.map((line) => ({
    presentationLineId: line.presentationLineId,
    presentationName: line.presentationName,
    writtenPackages: packagesInLine(evaluation.allocations, line.presentationLineId),
    remainingPackages: line.remainingPackages,
  }));
}

function blockPresentations(
  view: OrderDeliveryView,
  evaluation: Evaluation,
  draftBlock: OrderDeliveryDraft['blocks'][number],
  blockIndex: number,
): OrderDeliveryBlockPresentation[] {
  const own = evaluation.blocks[blockIndex]?.allocations ?? [];
  return view.lines
    .filter((line) => line.remainingPackages > 0)
    .map((line) => ({
      presentationLineId: line.presentationLineId,
      presentationName: line.presentationName,
      packages: packagesInLine(own, line.presentationLineId),
      batches: line.batches.map((batch) => ({
        batchId: batch.batchId,
        lot: batch.lot,
        leftPackages: packagesLeftInBatch(batch.availablePackages, evaluation.allocations, batch.batchId),
        availablePackages: batch.availablePackages,
        over: evaluation.overBatchIds.has(batch.batchId),
        value: draftBlock.packages[packagesKey(line.presentationLineId, batch.batchId)] ?? '',
      })),
    }));
}

function toDeliverInput(orderId: string, deliveryKey: string, blocks: readonly DeliveryCustomerBlock[]): DeliverOrderInput {
  return {
    orderId,
    deliveryKey,
    customers: blocks.flatMap((block) =>
      block.customerId === null ? [] : [{ customerId: block.customerId, allocations: block.allocations }],
    ),
  };
}

function ErrorNotice({ error, testId }: { readonly error: ErrorState; readonly testId: string }) {
  return (
    <ErrorAlert
      error={error}
      className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
      testId={testId}
      withDataCode
    />
  );
}

export type OrderDeliverySheetProps = {
  readonly order: Pick<OrderSummary, 'id' | 'numberText'>;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: ErrorState }
  | { readonly kind: 'ready'; readonly view: OrderDeliveryView };

/**
 * Registra una entrega parcial o total de un pedido terminado, repartida entre uno o mas clientes.
 * El borrador vive en el navegador hasta que la entrega se aplica o se cancela; cerrar el panel de
 * cualquier otra forma lo conserva.
 */
export function OrderDeliverySheet({ order, open, onOpenChange }: OrderDeliverySheetProps) {
  const router = useRouter();
  const store = useOrderDeliveryDraft(order.id);
  const { sync, hasDraft } = store;
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [attempted, setAttempted] = useState(false);
  const [rejected, setRejected] = useState<ErrorState | null>(null);
  const [submitError, setSubmitError] = useState<ErrorState | null>(null);
  const [isPending, startTransition] = useTransition();

  const applyView = useCallback(
    (result: OrderDeliveryResult) => {
      if (result.status === 'error') {
        if (hasDraft()) setSubmitError(result);
        else setLoad({ kind: 'error', error: result });
        return;
      }
      sync(result.data);
      setLoad({ kind: 'ready', view: result.data });
    },
    [hasDraft, sync],
  );

  const readView = useCallback(() => readDeliveryView(order.id).then(applyView), [applyView, order.id]);

  useEffect(() => {
    void readView();
  }, [readView]);

  const view = load.kind === 'ready' ? load.view : null;
  const draft = store.draft;
  const evaluation = view !== null && draft !== null ? evaluate(view, draft) : null;
  const stockOver = evaluation !== null && evaluation.overBatchIds.size > 0;

  function changePackages(blockKey: string, presentationLineId: string, batchId: string, text: string) {
    if (view === null || draft === null || evaluation === null) return;
    const key = packagesKey(presentationLineId, batchId);
    const digits = text.replace(NON_DIGITS, '');
    if (digits === '') {
      store.setPackages(blockKey, key, '');
      return;
    }
    const batch = evaluation.batches.find((candidate) => candidate.batchId === batchId);
    const others = flattenBlocks(evaluation.blocks.filter((_, index) => draft.blocks[index]?.key !== blockKey));
    const cap = packagesLeftInBatch(batch?.availablePackages ?? 0, others, batchId);
    store.setPackages(blockKey, key, String(Math.min(Number(digits), cap)));
  }

  function changeCustomer(blockKey: string, choice: OrderCustomerChoice | null) {
    store.setCustomer(blockKey, choice?.kind === 'customer' ? choice.customer : null);
  }

  function cancel() {
    store.clear();
    onOpenChange(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft === null || evaluation === null || isPending || stockOver) return;
    setAttempted(true);
    if (evaluation.issues.size > 0 || evaluation.check.kind !== 'ok') return;

    const input = toDeliverInput(order.id, draft.deliveryKey, evaluation.blocks);
    startTransition(async () => {
      let result: DeliverOrderActionResult;
      try {
        result = await deliverOrderAction(input);
      } catch {
        result = unexpectedFromRejection();
      }

      if (result.status === 'success') {
        store.clear();
        onOpenChange(false);
        toast.success(result.data.orderStatus === 'ENTREGADO' ? LABELS.completed : LABELS.delivered);
        router.refresh();
        return;
      }

      if (REREAD_CODES.has(result.code)) {
        setSubmitError(null);
        setRejected(result);
        await readView();
        return;
      }
      setRejected(null);
      setSubmitError(result);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} disableEscapeDismissal={false} disablePointerDismissal={false}>
      <SheetContent
        side="right"
        className="w-full pb-[env(safe-area-inset-bottom)] data-[side=right]:w-full data-[side=right]:sm:max-w-[600px]"
        data-testid={ORDER_DELIVERY_SHEET_TESTID}
        isForm={view !== null}
        formProps={{ onSubmit: submit, noValidate: true }}
        footer={
          view === null ? undefined : (
            <>
              <Button
                type="button"
                variant="outline"
                className={touchTarget}
                onClick={cancel}
                data-testid={ORDER_DELIVERY_CANCEL_TESTID}
              >
                {LABELS.cancel}
              </Button>
              <Button
                type="submit"
                className={touchTarget}
                disabled={isPending || stockOver}
                data-testid={ORDER_DELIVERY_SUBMIT_TESTID}
              >
                {isPending ? LABELS.submitting : LABELS.submit}
              </Button>
            </>
          )
        }
      >
        <SheetHeader>
          <SheetTitle>{LABELS.title(order.numberText)}</SheetTitle>
          <SheetDescription>{LABELS.description}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {load.kind === 'loading' ? (
            <div className="flex flex-col gap-3" data-testid={ORDER_DELIVERY_SKELETON_TESTID} aria-hidden="true">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : null}

          {load.kind === 'error' ? <ErrorNotice error={load.error} testId={ORDER_DELIVERY_ERROR_TESTID} /> : null}

          {view !== null && draft !== null && evaluation !== null ? (
            <>
              {rejected === null ? null : <ErrorNotice error={rejected} testId={ORDER_DELIVERY_REJECTED_TESTID} />}
              {submitError === null ? null : <ErrorNotice error={submitError} testId={ORDER_DELIVERY_ERROR_TESTID} />}
              {store.adjusted ? (
                <p
                  role="status"
                  className="rounded-lg border bg-muted p-3 text-sm"
                  data-testid={ORDER_DELIVERY_DRAFT_ADJUSTED_TESTID}
                >
                  {LABELS.adjusted}
                </p>
              ) : null}

              <OrderDeliverySummary lines={summaryLines(view, evaluation)} labels={LABELS.summary} />

              {draft.blocks.map((block, index) => {
                const issue = attempted ? evaluation.issues.get(index) : undefined;
                return (
                  <OrderDeliveryCustomerBlock
                    key={block.key}
                    index={index}
                    canRemove={draft.blocks.length > 1}
                    onRemove={() => store.removeBlock(block.key)}
                    customer={block.customer === null ? null : { kind: 'customer', customer: block.customer }}
                    onCustomerChange={(choice) => changeCustomer(block.key, choice)}
                    error={issue === undefined ? null : LABELS.blockIssues[issue]}
                    presentations={blockPresentations(view, evaluation, block, index)}
                    onPackagesChange={(lineId, batchId, text) => changePackages(block.key, lineId, batchId, text)}
                    disabled={isPending}
                    labels={LABELS.block}
                  />
                );
              })}

              <OrderDeliveryAddCustomer onAdd={store.addBlock} disabled={isPending} label={LABELS.addCustomer} />
            </>
          ) : null}
        </div>

        {stockOver ? (
          <p role="alert" className="px-4 text-sm text-destructive" data-testid={ORDER_DELIVERY_STOCK_OVER_TESTID}>
            {LABELS.stockOver}
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
