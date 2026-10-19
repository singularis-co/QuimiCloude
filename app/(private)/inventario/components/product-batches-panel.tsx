'use client';

import { useMemo, useState } from 'react';

import {
  DataTable,
  createDefaultParams,
  type DataTableParams,
  type RowActionsSpec,
} from '@/components/shared/data-table';
import { PRODUCT_TYPES, type ProductBatchView } from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import {
  PRODUCT_BATCHES_CARD,
  PRODUCT_BATCHES_TABLE_ID,
  PRODUCT_BATCHES_TABLE_TEXTS,
  buildProductBatchColumns,
  type ProductBatchColumnsProduct,
} from './product-batch-columns';

const PACKAGING_PRESENTATION_LABEL = 'Presentación del envase';
const PACKAGING_LEGACY_LABEL = 'Envase sin presentación fija';

export type ProductBatchesPanelProps = {
  readonly batches: readonly ProductBatchView[];
  /** Catalogo de unidades para resolver el simbolo de cada lote. Sin el, la cantidad se pinta sola. */
  readonly units?: readonly UnitRef[];
  /** Acciones de cada lote. Sin ellas, la tabla no tiene columna de acciones. */
  readonly batchMenu?: (batch: ProductBatchView) => RowActionsSpec;
  /**
   * El producto de los lotes. Un lote de envase no lleva presentacion propia: su unidad y su
   * presentacion son las del producto.
   */
  readonly product?: ProductBatchColumnsProduct;
};

type PackagingInfo =
  | { readonly kind: 'fixed'; readonly presentationName: string }
  | { readonly kind: 'legacy' }
  | null;

function packagingInfo(product: ProductBatchesPanelProps['product']): PackagingInfo {
  if (product === undefined || product.type !== PRODUCT_TYPES.PACKAGING) return null;
  if (product.presentationId == null) return { kind: 'legacy' };
  return { kind: 'fixed', presentationName: product.presentationName ?? EMPTY_MARK };
}

function PackagingLine({ packaging }: { readonly packaging: PackagingInfo }) {
  if (packaging === null) return null;
  if (packaging.kind === 'legacy') {
    return (
      <p
        role="note"
        className="rounded-lg border px-3 py-2 text-sm font-medium"
        data-testid="product-batches-packaging-legacy"
      >
        {PACKAGING_LEGACY_LABEL}
      </p>
    );
  }
  return (
    <p className="text-sm" data-testid="product-batches-packaging-presentation">
      <span className="text-muted-foreground">{PACKAGING_PRESENTATION_LABEL}: </span>
      {packaging.presentationName}
    </p>
  );
}

/**
 * Los lotes de un producto en una tabla (tarjetas en un contenedor estrecho). Lo que abre el menu
 * de cada lote lo monta quien compone la pantalla.
 */
export function ProductBatchesPanel({ batches, units, batchMenu, product }: ProductBatchesPanelProps) {
  const [params, setParams] = useState<DataTableParams>(createDefaultParams);
  const columns = useMemo(
    () => buildProductBatchColumns({ units, product, menu: batchMenu }),
    [units, product, batchMenu],
  );
  const packaging = packagingInfo(product);

  if (batches.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <PackagingLine packaging={packaging} />
        <div data-testid="product-batches-panel" className="p-4 text-sm text-muted-foreground">
          {PRODUCT_BATCHES_TABLE_TEXTS.empty}
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(batches.length / params.pageSize));
  const page = Math.min(params.page, totalPages);
  const pageRows = batches.slice((page - 1) * params.pageSize, page * params.pageSize);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <PackagingLine packaging={packaging} />
      <div data-testid="product-batches-panel" className="min-w-0">
        <DataTable
          tableId={PRODUCT_BATCHES_TABLE_ID}
          columns={columns}
          rows={pageRows}
          getRowId={(batch) => batch.id}
          params={{ ...params, page }}
          totalPages={totalPages}
          onParamsChange={setParams}
          status="idle"
          texts={PRODUCT_BATCHES_TABLE_TEXTS}
          searchable={false}
          card={PRODUCT_BATCHES_CARD}
        />
      </div>
    </div>
  );
}
