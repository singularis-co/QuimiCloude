'use client';

import { HistoryIcon, ScaleIcon } from 'lucide-react';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';

import type { RowActionsSpec } from '@/components/shared/data-table';
import type { RowActionMenuItem } from '@/components/shared/row-actions-menu';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  listProductBatchesAction,
  type ProductBatchesResult,
} from '@/lib/modules/inventario/adapters/driving/batch-actions';
import type { ErrorState } from '@/lib/modules/errores';
import {
  PRODUCT_TYPES,
  productDisplayName,
  type ProductBatchView,
  type ProductView,
} from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';

import { AdjustBatchDialog } from './adjust-batch-dialog';
import { BatchHistory } from './batch-history';
import { productNameWithoutPresentation } from './product-base-name';
import { productUnitLabel } from './product-columns';
import { ProductBatchesPanel } from './product-batches-panel';
import { PRODUCT_ROW_ACTION_LABELS } from './product-row-actions';

const BATCHES_LABEL = 'Lotes';
const BATCHES_SHEET_WIDTH_CLASS = 'data-[side=right]:w-full data-[side=right]:sm:max-w-[900px]';

export const BATCH_HISTORY_ITEM_TESTID = 'batch-history-trigger';
export const BATCH_ADJUST_ITEM_TESTID = 'adjust-batch-open';

/** Nombre accesible del disparador del menu de un lote. */
export function batchActionsLabel(lot: string): string {
  return `Acciones del lote ${lot}`;
}

type BatchAction = 'history' | 'adjust';

type BatchDialog = {
  readonly batch: ProductBatchView;
  readonly action: BatchAction;
  /** Cada eleccion monta el dialogo de nuevo, aunque sea el mismo lote. */
  readonly key: number;
};

type BatchesLoadState =
  | { readonly status: 'idle' }
  /** Abierto desde fuera: la peticion sale en el efecto, justo despues de pintar. */
  | { readonly status: 'queued' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: readonly ProductBatchView[] }
  | ErrorState;

export type ProductBatchesSheetProps = {
  readonly product: ProductView;
  readonly units?: readonly UnitRef[];
  /** Falla cerrado: el permiso baja por props, esta pantalla no lo resuelve. */
  readonly canAdjust: boolean;
  /** Que lotes se piden. Sin el, todos los del producto. */
  readonly loadBatches?: () => Promise<ProductBatchesResult>;
  /** Apertura controlada desde fuera. Ausente = el panel trae su propio disparador. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
};

/**
 * Panel lateral con los lotes de un producto. Pide los lotes al abrirse por primera vez y
 * los vuelve a pedir tras un ajuste, para que la existencia nueva se vea.
 *
 * Sin `open` trae su propio disparador; con `open` lo abre quien lo monta (el menu de la fila) y
 * no pinta disparador.
 */
export function ProductBatchesSheet({
  product,
  units,
  canAdjust,
  loadBatches,
  open,
  onOpenChange,
}: ProductBatchesSheetProps) {
  const [state, setState] = useState<BatchesLoadState>({ status: 'idle' });
  const [dialog, setDialog] = useState<BatchDialog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const displayName = productDisplayName(product.name, productUnitLabel(product, units));

  const productId = product.id;
  const requestBatches = useCallback(() => {
    const request = loadBatches ? loadBatches() : listProductBatchesAction(productId);
    void request.then((result) => {
      setState(result.status === 'success' ? { status: 'success', data: result.data } : result);
    });
  }, [loadBatches, productId]);

  // Estable: el ajuste sigue montado mientras se recargan los lotes y repite su aviso si cambia.
  const fetchBatches = useCallback(() => {
    setState({ status: 'loading' });
    requestBatches();
  }, [requestBatches]);

  // Con apertura controlada no pasa por `handleOpenChange`: la primera apertura se detecta aqui.
  if (open === true && state.status === 'idle') setState({ status: 'queued' });

  const sendQueuedRequest = useEffectEvent(requestBatches);

  useEffect(() => {
    if (state.status === 'queued') sendQueuedRequest();
  }, [state.status]);

  function handleOpenChange(next: boolean) {
    if (next && state.status === 'idle') fetchBatches();
    onOpenChange?.(next);
  }

  function openBatchDialog(batch: ProductBatchView, action: BatchAction) {
    setDialog((current) => ({ batch, action, key: (current?.key ?? 0) + 1 }));
    setDialogOpen(true);
  }

  function batchMenu(batch: ProductBatchView): RowActionsSpec {
    const items: RowActionMenuItem[] = [
      {
        key: 'history',
        label: PRODUCT_ROW_ACTION_LABELS.history,
        icon: HistoryIcon,
        onSelect: () => openBatchDialog(batch, 'history'),
        testId: BATCH_HISTORY_ITEM_TESTID,
      },
    ];
    if (canAdjust) {
      items.push({
        key: 'adjust',
        label: PRODUCT_ROW_ACTION_LABELS.adjust,
        icon: ScaleIcon,
        onSelect: () => openBatchDialog(batch, 'adjust'),
        testId: BATCH_ADJUST_ITEM_TESTID,
      });
    }
    return { items, triggerLabel: batchActionsLabel(batch.lot), title: batch.lot };
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {open === undefined ? (
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              touch
              aria-label={`Lotes de ${displayName}`}
              data-testid="product-batches-open"
            />
          }
        >
          Lotes
        </SheetTrigger>
      ) : null}
      <SheetContent data-testid="product-batches-sheet" className={BATCHES_SHEET_WIDTH_CLASS}>
        <SheetHeader>
          <span
            data-testid="product-batches-label"
            className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase"
          >
            {BATCHES_LABEL}
          </span>
          <SheetTitle>{displayName}</SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
          {state.status === 'loading' || state.status === 'queued' ? (
            <p data-testid="product-batches-loading">Cargando lotes…</p>
          ) : null}

          {state.status === 'error' ? (
            <p role="alert" data-testid="product-batches-error">
              {state.message}
            </p>
          ) : null}

          {state.status === 'success' ? (
            <ProductBatchesPanel
              batches={state.data}
              units={units}
              product={product}
              batchMenu={batchMenu}
            />
          ) : null}

          {dialog?.action === 'history' ? (
            <BatchHistory
              key={dialog.key}
              batchId={dialog.batch.id}
              batchLot={dialog.batch.lot}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            />
          ) : null}

          {dialog?.action === 'adjust' ? (
            <AdjustBatchDialog
              key={dialog.key}
              batch={dialog.batch}
              productName={productNameWithoutPresentation(product)}
              canAdjust={canAdjust}
              productType={product.type}
              wholePackages={
                product.type === PRODUCT_TYPES.PACKAGING && product.presentationId != null
              }
              onAdjusted={fetchBatches}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
