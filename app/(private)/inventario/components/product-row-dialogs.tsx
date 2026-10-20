'use client';

import { useEffect, useState } from 'react';

import {
  listProductBatchesAction,
  type ProductBatchesResult,
} from '@/lib/modules/inventario/adapters/driving/batch-actions';
import { PRODUCT_TYPES, type ProductBatchView, type ProductView } from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';

import { AdjustBatchDialog } from './adjust-batch-dialog';
import { BatchHistory } from './batch-history';
import { DeleteProductDialog } from './delete-product-dialog';
import { DirectDeliverySheet } from './direct-delivery-sheet';
import { productNameWithoutPresentation } from './product-base-name';
import { ProductBatchesSheet } from './product-batches-sheet';
import type { ProductRowAction } from './product-row-actions';
import { ProductSheet } from './product-sheet';

export type BatchTarget =
  | { readonly kind: 'single'; readonly batch: ProductBatchView }
  | { readonly kind: 'choose' };

/** Con un solo lote no hay nada que elegir; con ninguno o con varios, se elige en «Lotes». */
export function batchTarget(batches: readonly ProductBatchView[]): BatchTarget {
  const [only] = batches;
  return batches.length === 1 && only !== undefined ? { kind: 'single', batch: only } : { kind: 'choose' };
}

export type ProductRowDialogsActive = {
  readonly product: ProductView;
  readonly action: ProductRowAction;
  /** Que lotes se piden. Sin el, todos los del producto. */
  readonly loadBatches?: () => Promise<ProductBatchesResult>;
};

export type ProductRowDialogsProps = {
  readonly active: ProductRowDialogsActive | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly units?: readonly UnitRef[];
  readonly canAdjust: boolean;
};

type Resolved = { readonly active: ProductRowDialogsActive; readonly target: BatchTarget };

function needsBatch(action: ProductRowAction): boolean {
  return action === 'history' || action === 'adjust';
}

/**
 * Lo que abre el menú de una fila, montado una sola vez por tabla: así la tarjeta y la fila abren
 * lo mismo. Los lotes dependen de qué se pide (en producto terminado, de la línea): cada elección
 * los vuelve a montar. La edición y el borrado dependen solo del producto y conservan su estado
 * entre aperturas, como cuando vivían en la fila.
 */
export function ProductRowDialogs({ active, open, onOpenChange, units, canAdjust }: ProductRowDialogsProps) {
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [seenActive, setSeenActive] = useState(active);
  const [epoch, setEpoch] = useState(0);
  if (active !== seenActive) {
    setSeenActive(active);
    setEpoch((current) => current + 1);
  }

  useEffect(() => {
    if (active === null || !open || !needsBatch(active.action)) return;
    let current = true;
    const settle = (target: BatchTarget) => {
      if (current) setResolved({ active, target });
    };
    const request = active.loadBatches ? active.loadBatches() : listProductBatchesAction(active.product.id);
    // Un error de lectura abre «Lotes», que pide de nuevo y pinta su propio error.
    void request.then(
      (result) => settle(result.status === 'success' ? batchTarget(result.data) : { kind: 'choose' }),
      () => settle({ kind: 'choose' }),
    );
    return () => {
      current = false;
    };
  }, [active, open]);

  if (active === null) return null;

  const { product, action, loadBatches } = active;
  const target = resolved?.active === active ? resolved.target : null;
  const key = `${epoch}`;

  if (action === 'edit') {
    return <ProductSheet key={product.id} product={product} units={units} open={open} onOpenChange={onOpenChange} />;
  }

  if (action === 'delete') {
    return <DeleteProductDialog key={product.id} product={product} open={open} onOpenChange={onOpenChange} />;
  }

  // El sheet lee su vista al montarse: solo existe mientras está abierto.
  if (action === 'direct-delivery') {
    return open ? <DirectDeliverySheet key={key} productId={product.id} open onOpenChange={onOpenChange} /> : null;
  }

  if (action === 'batches' || target?.kind === 'choose') {
    return (
      <ProductBatchesSheet
        key={key}
        product={product}
        units={units}
        canAdjust={canAdjust}
        loadBatches={loadBatches}
        open={open}
        onOpenChange={onOpenChange}
      />
    );
  }

  if (target?.kind !== 'single') return null;

  if (action === 'history') {
    return (
      <BatchHistory
        key={key}
        batchId={target.batch.id}
        batchLot={target.batch.lot}
        open={open}
        onOpenChange={onOpenChange}
      />
    );
  }

  return (
    <AdjustBatchDialog
      key={key}
      batch={target.batch}
      canAdjust={canAdjust}
      productType={product.type}
      wholePackages={product.type === PRODUCT_TYPES.PACKAGING && product.presentationId != null}
      productName={productNameWithoutPresentation(product)}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
