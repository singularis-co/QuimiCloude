'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useState, useTransition, type FormEvent } from 'react';
import { toast } from 'sonner';

import { ErrorAlert } from '@/components/shared/error-alert';
import { FieldError } from '@/components/shared/field-error';
import { type OrderCustomerChoice } from '@/components/shared/order-customer-label';
import {
  OrderDeliveryAddCustomer,
  OrderDeliveryCustomerBlock,
  type OrderDeliveryBlockPresentation,
  type OrderDeliveryCustomerBlockLabels,
} from '@/components/shared/order-delivery-customer-block';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, UNEXPECTED_ERROR_CODE, type ErrorState } from '@/lib/modules/errores';
import { newRequestId } from '@/lib/modules/observabilidad';
import {
  DIRECT_DELIVERY_NOTE_MAX_LENGTH,
  batchesOverAvailable,
  checkDeliveryBlocks,
  checkDirectDelivery,
  flattenBlocks,
  normalizeDeliveryNote,
  packagesInLine,
  packagesLeftInBatch,
  type DeliveryAllocation,
  type DeliveryBatchState,
  type DeliveryBlockIssue,
  type DeliveryCustomerBlock,
  type DirectDeliveryCheck,
  type DirectDeliveryView,
} from '@/lib/modules/pedidos';
import {
  deliverDirectAction,
  getDirectDeliveryAction,
  type DeliverDirectActionResult,
  type DeliverDirectInput,
  type DirectDeliveryResult,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';
import { touchTarget } from '@/lib/shared/ui/touch-target';

import type { DirectDeliveryDraft } from './direct-delivery-draft';
import { DirectDeliverySurplusCard } from './direct-delivery-surplus-card';
import { productNameWithoutPresentation } from './product-base-name';
import { useDirectDeliveryDraft } from './use-direct-delivery-draft';

export const DIRECT_DELIVERY_SHEET_TESTID = 'direct-delivery-sheet';
export const DIRECT_DELIVERY_SKELETON_TESTID = 'direct-delivery-skeleton';
export const DIRECT_DELIVERY_NO_SURPLUS_TESTID = 'direct-delivery-no-surplus';
export const DIRECT_DELIVERY_NOTE_TESTID = 'direct-delivery-note';
export const DIRECT_DELIVERY_NOTE_ERROR_TESTID = 'direct-delivery-note-error';
export const DIRECT_DELIVERY_OVER_SURPLUS_TESTID = 'direct-delivery-over-surplus';
export const DIRECT_DELIVERY_STOCK_OVER_TESTID = 'direct-delivery-stock-over';
export const DIRECT_DELIVERY_SUBMIT_TESTID = 'direct-delivery-submit';
export const DIRECT_DELIVERY_CANCEL_TESTID = 'direct-delivery-cancel';
export const DIRECT_DELIVERY_DRAFT_ADJUSTED_TESTID = 'direct-delivery-draft-adjusted';
export const DIRECT_DELIVERY_REJECTED_TESTID = 'direct-delivery-rejected';
export const DIRECT_DELIVERY_ERROR_TESTID = 'direct-delivery-error';

const LABELS = {
  title: 'Entregar sin pedido',
  description: 'Elige los clientes y de qué lotes salen los envases.',
  noSurplusTitle: 'No hay envases libres para entregar sin pedido',
  noSurplusBody: (stock: number) =>
    `Los ${stock} envases en stock esperan a pedidos terminados. Entrégalos desde cada pedido.`,
  adjusted: 'Algunos lotes del borrador ya no están disponibles y se quitaron sus envases.',
  overSurplus: (surplus: number) =>
    `Entre todos los clientes se pasa del excedente: solo se pueden entregar ${surplus} envases sin tocar lo que esperan los pedidos.`,
  stockOver: 'Entre todos los clientes se pasa de lo disponible en un lote. Baja los envases para poder entregar.',
  addCustomer: 'Añadir cliente',
  note: 'Nota (opcional)',
  noteHelp: 'Se ve en el tab Entregas del producto.',
  notePlaceholder: 'Por ejemplo: venta de mostrador, factura 0012',
  noteTooLong: `La nota no puede pasar de ${DIRECT_DELIVERY_NOTE_MAX_LENGTH} caracteres.`,
  submit: 'Entregar',
  submitting: 'Entregando…',
  cancel: 'Cancelar',
  delivered: 'Entrega sin pedido registrada',
  block: {
    title: (position: number) => `Cliente ${position}`,
    remove: 'Quitar',
    removeAria: (position: number) => `Quitar el cliente ${position}`,
    customer: 'Cliente',
    customerPlaceholder: 'Busca un cliente por su nombre',
    customerEmpty: 'Ningún cliente coincide con la búsqueda.',
    packagesCount: (packages: number) => `${packages} envases`,
    noBatches: 'No hay lotes con envases disponibles para este producto.',
    lot: 'Lote',
    available: 'Disponibles',
    entry: 'Entrada',
    packagesAria: (lot: string, _presentationName: string, position: number) =>
      `Envases del lote ${lot} para el cliente ${position}`,
    onlyAvailable: (packages: number) => `Solo hay ${packages}`,
  } satisfies OrderDeliveryCustomerBlockLabels,
  blockIssues: {
    missing_customer: 'Elige el cliente.',
    duplicate_customer: 'Este cliente ya está en la entrega.',
    no_packages: 'Este cliente no lleva envases: indica al menos uno.',
  } satisfies Record<DeliveryBlockIssue, string>,
} as const;

const REREAD_CODES: ReadonlySet<ErrorState['code']> = new Set([
  'delivery_exceeds_surplus',
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

async function readDirectDeliveryView(productId: string): Promise<DirectDeliveryResult> {
  try {
    return await getDirectDeliveryAction(productId);
  } catch {
    return unexpectedFromRejection();
  }
}

type Evaluation = {
  readonly blocks: readonly DeliveryCustomerBlock[];
  readonly allocations: readonly DeliveryAllocation[];
  readonly batches: readonly DeliveryBatchState[];
  readonly written: number;
  readonly check: DirectDeliveryCheck;
  readonly issues: ReadonlyMap<number, DeliveryBlockIssue>;
  readonly overBatchIds: ReadonlySet<string>;
};

// El producto hace de unica «linea» de la entrega: asi las reglas de bloque y de lote de la entrega
// de pedido sirven tal cual.
function evaluate(view: DirectDeliveryView, draft: DirectDeliveryDraft): Evaluation {
  const blocks: DeliveryCustomerBlock[] = draft.blocks.map((block) => ({
    customerId: block.customer?.id ?? null,
    allocations: view.batches.flatMap((batch) => {
      const packages = writtenPackages(block.packages[batch.batchId]);
      return packages > 0 ? [{ presentationLineId: view.productId, batchId: batch.batchId, packages }] : [];
    }),
  }));
  const allocations = flattenBlocks(blocks);
  const batches = view.batches.map((batch) => ({
    batchId: batch.batchId,
    presentationLineId: view.productId,
    availablePackages: batch.availablePackages,
  }));
  return {
    blocks,
    allocations,
    batches,
    written: packagesInLine(allocations, view.productId),
    check: checkDirectDelivery(view.surplusPackages, batches, allocations),
    issues: checkDeliveryBlocks(blocks),
    overBatchIds: new Set(batchesOverAvailable(batches, allocations)),
  };
}

function productTitle(view: DirectDeliveryView): string {
  const base = productNameWithoutPresentation({ name: view.productName, presentationName: view.presentationName });
  return view.presentationName ? `${base} · ${view.presentationName}` : base;
}

function blockPresentation(
  view: DirectDeliveryView,
  evaluation: Evaluation,
  draftBlock: DirectDeliveryDraft['blocks'][number],
  blockIndex: number,
): OrderDeliveryBlockPresentation {
  const own = evaluation.blocks[blockIndex]?.allocations ?? [];
  return {
    presentationLineId: view.productId,
    presentationName: view.presentationName ?? view.productName,
    packages: packagesInLine(own, view.productId),
    batches: view.batches.map((batch) => ({
      batchId: batch.batchId,
      lot: batch.lot,
      leftPackages: packagesLeftInBatch(batch.availablePackages, evaluation.allocations, batch.batchId),
      availablePackages: batch.availablePackages,
      over: evaluation.overBatchIds.has(batch.batchId),
      value: draftBlock.packages[batch.batchId] ?? '',
    })),
  };
}

function toDeliverInput(
  productId: string,
  draft: DirectDeliveryDraft,
  blocks: readonly DeliveryCustomerBlock[],
): DeliverDirectInput {
  return {
    productId,
    deliveryKey: draft.deliveryKey,
    note: normalizeDeliveryNote(draft.note),
    customers: blocks.flatMap((block) =>
      block.customerId === null
        ? []
        : [
            {
              customerId: block.customerId,
              allocations: block.allocations.map(({ batchId, packages }) => ({ batchId, packages })),
            },
          ],
    ),
  };
}

function noteTooLong(note: string): boolean {
  return (normalizeDeliveryNote(note) ?? '').length > DIRECT_DELIVERY_NOTE_MAX_LENGTH;
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

export type DirectDeliverySheetProps = {
  readonly productId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: ErrorState }
  | { readonly kind: 'ready'; readonly view: DirectDeliveryView };

/**
 * Entrega envases de los lotes de un producto terminado a uno o mas clientes, sin pedido y con el
 * excedente como tope. El borrador vive en el navegador hasta que la entrega se aplica o se
 * cancela; cerrar el panel de cualquier otra forma lo conserva.
 */
export function DirectDeliverySheet({ productId, open, onOpenChange }: DirectDeliverySheetProps) {
  const router = useRouter();
  const store = useDirectDeliveryDraft(productId);
  const { sync, hasDraft } = store;
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [attempted, setAttempted] = useState(false);
  const [rejected, setRejected] = useState<ErrorState | null>(null);
  const [submitError, setSubmitError] = useState<ErrorState | null>(null);
  const [isPending, startTransition] = useTransition();
  const baseId = useId();
  const noteId = `${baseId}-note`;
  const noteHelpId = `${baseId}-note-help`;
  const noteErrorId = `${baseId}-note-error`;

  const applyView = useCallback(
    (result: DirectDeliveryResult) => {
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

  const readView = useCallback(() => readDirectDeliveryView(productId).then(applyView), [applyView, productId]);

  useEffect(() => {
    void readView();
  }, [readView]);

  const view = load.kind === 'ready' ? load.view : null;
  const draft = store.draft;
  const evaluation = view !== null && draft !== null ? evaluate(view, draft) : null;
  const noSurplus = view !== null && view.surplusPackages === 0;
  const stockOver = !noSurplus && evaluation !== null && evaluation.overBatchIds.size > 0;
  const overSurplus = !noSurplus && view !== null && evaluation !== null && evaluation.written > view.surplusPackages;
  const noteError = draft !== null && noteTooLong(draft.note);

  function changePackages(blockKey: string, batchId: string, text: string) {
    if (view === null || draft === null || evaluation === null) return;
    const digits = text.replace(NON_DIGITS, '');
    if (digits === '') {
      store.setPackages(blockKey, batchId, '');
      return;
    }
    const batch = view.batches.find((candidate) => candidate.batchId === batchId);
    const others = flattenBlocks(
      evaluation.blocks.flatMap((block, index) => (draft.blocks[index]?.key === blockKey ? [] : [block])),
    );
    const cap = packagesLeftInBatch(batch?.availablePackages ?? 0, others, batchId);
    store.setPackages(blockKey, batchId, String(Math.min(Number(digits), cap)));
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
    if (view === null || draft === null || evaluation === null) return;
    if (isPending || noSurplus || stockOver || overSurplus) return;
    setAttempted(true);
    if (evaluation.issues.size > 0 || noteError || evaluation.check.kind !== 'ok') return;

    const input = toDeliverInput(view.productId, draft, evaluation.blocks);
    startTransition(async () => {
      let result: DeliverDirectActionResult;
      try {
        result = await deliverDirectAction(input);
      } catch {
        result = unexpectedFromRejection();
      }

      if (result.status === 'success') {
        store.clear();
        onOpenChange(false);
        toast.success(LABELS.delivered);
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
        data-testid={DIRECT_DELIVERY_SHEET_TESTID}
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
                data-testid={DIRECT_DELIVERY_CANCEL_TESTID}
              >
                {LABELS.cancel}
              </Button>
              <Button
                type="submit"
                className={touchTarget}
                disabled={isPending || noSurplus || stockOver || overSurplus}
                data-testid={DIRECT_DELIVERY_SUBMIT_TESTID}
              >
                {isPending ? LABELS.submitting : LABELS.submit}
              </Button>
            </>
          )
        }
      >
        <SheetHeader>
          <SheetTitle>{LABELS.title}</SheetTitle>
          <SheetDescription>
            {view === null ? LABELS.description : `${productTitle(view)}. ${LABELS.description}`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {load.kind === 'loading' ? (
            <div className="flex flex-col gap-3" data-testid={DIRECT_DELIVERY_SKELETON_TESTID} aria-hidden="true">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : null}

          {load.kind === 'error' ? <ErrorNotice error={load.error} testId={DIRECT_DELIVERY_ERROR_TESTID} /> : null}

          {view !== null && draft !== null && evaluation !== null ? (
            <>
              {rejected === null ? null : <ErrorNotice error={rejected} testId={DIRECT_DELIVERY_REJECTED_TESTID} />}
              {submitError === null ? null : <ErrorNotice error={submitError} testId={DIRECT_DELIVERY_ERROR_TESTID} />}

              {noSurplus ? (
                <div
                  role="status"
                  className="flex flex-col items-start gap-2 rounded-lg border p-5"
                  data-testid={DIRECT_DELIVERY_NO_SURPLUS_TESTID}
                >
                  <h3 className="text-base font-semibold">{LABELS.noSurplusTitle}</h3>
                  <p className="text-sm text-muted-foreground">{LABELS.noSurplusBody(view.stockPackages)}</p>
                </div>
              ) : (
                <>
                  {store.adjusted ? (
                    <p
                      role="status"
                      className="rounded-lg border bg-muted p-3 text-sm"
                      data-testid={DIRECT_DELIVERY_DRAFT_ADJUSTED_TESTID}
                    >
                      {LABELS.adjusted}
                    </p>
                  ) : null}

                  <DirectDeliverySurplusCard
                    stockPackages={view.stockPackages}
                    waitingPackages={view.waitingPackages}
                    surplusPackages={view.surplusPackages}
                    waiting={view.waiting}
                    writtenPackages={evaluation.written}
                  />

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
                        presentations={[blockPresentation(view, evaluation, block, index)]}
                        onPackagesChange={(_lineId, batchId, text) => changePackages(block.key, batchId, text)}
                        disabled={isPending}
                        labels={LABELS.block}
                      />
                    );
                  })}

                  <OrderDeliveryAddCustomer onAdd={store.addBlock} disabled={isPending} label={LABELS.addCustomer} />

                  <div className="flex flex-col gap-2">
                    <label htmlFor={noteId} className="text-sm font-medium">
                      {LABELS.note}
                    </label>
                    <Textarea
                      id={noteId}
                      rows={2}
                      value={draft.note}
                      onChange={(event) => store.setNote(event.target.value)}
                      placeholder={LABELS.notePlaceholder}
                      disabled={isPending}
                      aria-invalid={noteError}
                      aria-describedby={noteError ? `${noteErrorId} ${noteHelpId}` : noteHelpId}
                      className="min-h-11 text-base md:text-base"
                      data-testid={DIRECT_DELIVERY_NOTE_TESTID}
                    />
                    <p id={noteHelpId} className="text-xs text-muted-foreground">
                      {LABELS.noteHelp}
                    </p>
                    {noteError ? (
                      <FieldError id={noteErrorId} message={LABELS.noteTooLong} testId={DIRECT_DELIVERY_NOTE_ERROR_TESTID} />
                    ) : null}
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>

        {overSurplus && view !== null ? (
          <p role="alert" className="px-4 text-sm text-destructive" data-testid={DIRECT_DELIVERY_OVER_SURPLUS_TESTID}>
            {LABELS.overSurplus(view.surplusPackages)}
          </p>
        ) : null}
        {stockOver ? (
          <p role="alert" className="px-4 text-sm text-destructive" data-testid={DIRECT_DELIVERY_STOCK_OVER_TESTID}>
            {LABELS.stockOver}
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
