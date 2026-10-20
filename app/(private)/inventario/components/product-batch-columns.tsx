'use client';

import { withCardFieldLabel } from '@/components/shared/card-field-label';
import {
  actionsColumn,
  type DataTableCardLayout,
  type DataTableColumn,
  type DataTableTexts,
  type RowActionsSpec,
} from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { PRODUCT_TYPES, type ProductBatchView, type ProductView } from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';
import { exactDecimalTitle, formatDecimalDisplay, trimDecimal } from '@/lib/shared/ui/decimal-display';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import { ExpiryDate, useLocalToday } from './expiry-date';
import { daysUntil, isExpiringSoon } from './expiry-warning';

/** Cabeceras de la tabla; las cifras y fechas repiten el texto como rótulo de la tarjeta. */
export const PRODUCT_BATCH_COLUMN_LABELS = {
  lot: 'Lote',
  quantity: 'Cantidad',
  purchaseDate: 'Fecha de compra',
  expiryDate: 'Vencimiento',
  reserved: 'Apartado',
  available: 'Disponible',
} as const;

const EXPIRED_LABEL = 'Vencido';
const OVER_RESERVED_LABEL = 'Sobre-reservado';
const EXPIRY_TEST_IDS = {
  date: 'product-batch-expiry-date',
  relative: 'product-batch-expiry-relative',
  expired: 'product-batch-expired',
} as const;

export const PRODUCT_BATCHES_TABLE_ID = 'inventario-lotes';

export const PRODUCT_BATCHES_CARD: DataTableCardLayout = {
  primary: 'lot',
  meta: ['quantity', 'reserved', 'available', 'purchaseDate', 'expiryDate'],
};

export const PRODUCT_BATCHES_TABLE_TEXTS: DataTableTexts = {
  empty: 'Este producto todavía no tiene lotes registrados.',
  loading: 'Cargando lotes…',
  error: 'No se pudieron mostrar los lotes.',
  search: 'Buscar lote',
  filters: 'Filtros',
  columnMenu: 'opciones de la columna',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  pageIndicator: (page, totalPages) => `Página ${page} de ${totalPages}`,
  pageSize: 'Lotes por página',
  sortAscending: 'Orden ascendente',
  sortDescending: 'Orden descendente',
  pinColumn: 'Fijar columna',
  unpinColumn: 'Soltar columna',
  filterColumn: 'Filtrar columna',
  clearFilter: 'Limpiar filtro',
  lastWeek: 'Última semana',
  lastMonth: 'Último mes',
  lastYear: 'Último año',
  cardActions: 'Acciones',
  closeMenu: 'Cerrar',
};

export type ProductBatchColumnsProduct = Pick<
  ProductView,
  'type' | 'unitId' | 'presentationId' | 'presentationName'
>;

export type ProductBatchColumnsDeps = {
  /** Catalogo de unidades para resolver el simbolo de cada lote. Sin el, la cantidad se pinta sola. */
  readonly units?: readonly UnitRef[];
  readonly product?: ProductBatchColumnsProduct;
  readonly menu?: (batch: ProductBatchView) => RowActionsSpec;
};

/** Un envase con presentacion fija no guarda unidad en el lote: se cuenta en la del producto. */
function batchUnitId(batch: ProductBatchView, product: ProductBatchColumnsProduct | undefined): string | null {
  if (batch.unitId !== null) return batch.unitId;
  const fixedPackaging = product?.type === PRODUCT_TYPES.PACKAGING && product.presentationId != null;
  return fixedPackaging ? (product?.unitId ?? null) : null;
}

/**
 * Sin catalogo (`units` indefinido) o sin unidad en el lote (MACHINE) devuelve `null` y la
 * cantidad se pinta sola; con catalogo pero sin esa unidad, el marcador de vacio.
 */
function unitLabel(unitId: string | null, units: readonly UnitRef[] | undefined): string | null {
  if (unitId === null || units === undefined) return null;
  const unit = units.find((candidate) => candidate.id === unitId);
  return unit?.symbol ?? unit?.name ?? EMPTY_MARK;
}

function formattedQuantity(value: string, unitId: string | null, units: readonly UnitRef[] | undefined): string {
  const label = unitLabel(unitId, units);
  const amount = formatDecimalDisplay(value);
  return label === null ? amount : `${amount} ${label}`;
}

/** Cifra exacta, para quien no puede quedarse con el redondeo de la celda. */
function exactQuantity(value: string, unitId: string | null, units: readonly UnitRef[] | undefined): string {
  const label = unitLabel(unitId, units);
  const amount = trimDecimal(value);
  return label === null ? amount : `${amount} ${label}`;
}

const PACKAGE_CONTENT_SCALE = 4;
const PACKAGE_DECIMAL_PATTERN = /^\d+(?:\.\d{1,4})?$/;

/** Aritmetica exacta de enteros: nada de `Number` ni `parseFloat`. */
function toScaledPackageContent(value: string): bigint | null {
  if (!PACKAGE_DECIMAL_PATTERN.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole + fraction.padEnd(PACKAGE_CONTENT_SCALE, '0'));
}

/** `null` cuando el lote no es de producto terminado o la division no es entera. */
function packageCountLabel(batch: ProductBatchView): string | null {
  if (batch.packageContent === null) return null;

  const stock = toScaledPackageContent(batch.stock);
  const content = toScaledPackageContent(batch.packageContent);
  if (stock === null || content === null || content === BigInt(0)) return null;
  if (stock % content !== BigInt(0)) return null;

  const packages = stock / content;
  return packages === BigInt(1) ? '1 envase' : `${packages.toString()} envases`;
}

function AmountValue({
  value,
  unitId,
  units,
  testId,
  className,
}: {
  readonly value: string | undefined;
  readonly unitId: string | null;
  readonly units: readonly UnitRef[] | undefined;
  readonly testId: string;
  readonly className?: string;
}) {
  if (value === undefined) return <span>{EMPTY_MARK}</span>;
  return (
    <span
      data-testid={testId}
      className={className}
      title={exactDecimalTitle(value)}
      aria-label={exactQuantity(value, unitId, units)}
    >
      {formattedQuantity(value, unitId, units)}
    </span>
  );
}

// Sin «hoy» (servidor) no se marca ningun vencimiento: se pinta tras hidratar.
function BatchExpiryCell({ expiryDate }: { readonly expiryDate: string | null }) {
  const today = useLocalToday();
  if (expiryDate === null) return <span>{EMPTY_MARK}</span>;
  return (
    <ExpiryDate
      as="span"
      date={expiryDate}
      expiring={today !== null && isExpiringSoon(expiryDate, today)}
      daysToExpiry={today === null ? null : daysUntil(expiryDate, today)}
      expiredLabel={EXPIRED_LABEL}
      testIds={EXPIRY_TEST_IDS}
    />
  );
}

export function buildProductBatchColumns({
  units,
  product,
  menu,
}: ProductBatchColumnsDeps): readonly DataTableColumn<ProductBatchView>[] {
  const columns: DataTableColumn<ProductBatchView>[] = [
    {
      id: 'lot',
      label: PRODUCT_BATCH_COLUMN_LABELS.lot,
      align: 'start',
      tabular: true,
      cell: (batch) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span data-testid="product-batch-lot" className="font-semibold">
            {batch.lot}
          </span>
          {batch.overReserved === true ? (
            <StatusBadge
              tone="danger"
              label={OVER_RESERVED_LABEL}
              data-testid="product-batch-over-reserved"
              className="font-sans"
            />
          ) : null}
        </span>
      ),
    },
    {
      id: 'quantity',
      label: PRODUCT_BATCH_COLUMN_LABELS.quantity,
      align: 'end',
      tabular: true,
      cell: (batch) => {
        const packages = packageCountLabel(batch);
        return withCardFieldLabel(
          PRODUCT_BATCH_COLUMN_LABELS.quantity,
          <span className="inline-flex flex-col">
            <AmountValue
              value={batch.stock}
              unitId={batchUnitId(batch, product)}
              units={units}
              testId="product-batch-quantity"
            />
            {packages === null ? null : (
              <span data-testid="product-batch-packages" className="font-sans text-xs text-muted-foreground">
                {packages}
              </span>
            )}
          </span>,
        );
      },
    },
    {
      id: 'purchaseDate',
      label: PRODUCT_BATCH_COLUMN_LABELS.purchaseDate,
      align: 'end',
      tabular: true,
      cell: (batch) =>
        withCardFieldLabel(
          PRODUCT_BATCH_COLUMN_LABELS.purchaseDate,
          <span data-testid="product-batch-purchase-date">{batch.purchaseDate}</span>,
        ),
    },
    {
      id: 'expiryDate',
      label: PRODUCT_BATCH_COLUMN_LABELS.expiryDate,
      align: 'end',
      tabular: true,
      cell: (batch) =>
        withCardFieldLabel(PRODUCT_BATCH_COLUMN_LABELS.expiryDate, <BatchExpiryCell expiryDate={batch.expiryDate} />),
    },
    {
      id: 'reserved',
      label: PRODUCT_BATCH_COLUMN_LABELS.reserved,
      align: 'end',
      tabular: true,
      cell: (batch) =>
        withCardFieldLabel(
          PRODUCT_BATCH_COLUMN_LABELS.reserved,
          <AmountValue
            value={batch.reserved}
            unitId={batchUnitId(batch, product)}
            units={units}
            testId="product-batch-reserved"
          />,
        ),
    },
    {
      id: 'available',
      label: PRODUCT_BATCH_COLUMN_LABELS.available,
      align: 'end',
      tabular: true,
      cell: (batch) =>
        withCardFieldLabel(
          PRODUCT_BATCH_COLUMN_LABELS.available,
          <AmountValue
            value={batch.available}
            unitId={batchUnitId(batch, product)}
            units={units}
            testId="product-batch-available"
            className="font-semibold"
          />,
        ),
    },
  ];

  if (menu !== undefined) columns.push(actionsColumn<ProductBatchView>({ menu }));
  return columns;
}
