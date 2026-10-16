'use client';

import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { actionsColumn, type DataTableColumn } from '@/components/shared/data-table';
import { EntityImage } from '@/components/shared/entity-image';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { compareQuantities, type ProductBatchView, type ProductView } from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';
import {
  exactDecimalTitle,
  formatDecimalDisplay,
  formatMoneyDisplay,
  trimDecimal,
} from '@/lib/shared/ui/decimal-display';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { cn } from '@/lib/utils';

import { EXPIRING_CLASS, ExpiryDate } from './expiry-date';
import { productNameWithoutPresentation } from './product-base-name';
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_TONES } from './product-type-label';

/**
 * Declaracion de las columnas de la tabla de productos (R6, R7, R8, `design.md > 7`).
 *
 * **MIGRADO A LA TABLA COMPARTIDA el 2026-09-07 (decision humana).** Antes esta lista describia
 * celdas de TEXTO (`value: (product) => string`) y la tabla propia de la ruta las recorria. Ahora
 * son `DataTableColumn<ProductView>` de `components/shared/data-table`, cuyas celdas devuelven
 * `ReactNode`: es lo que permite que la primera columna sea la miniatura y lo que quita de esta
 * ruta una tabla, una barra de paginacion y un esqueleto propios.
 *
 * **Lo que R7 protege no se ha aflojado, y sigue siendo de TIPOS**: `ProductColumnId` excluye el
 * identificador tecnico, el id de la presentacion, el de la unidad y los dos de autoria, asi que
 * escribir `id: 'createdBy'` **no compila**. Se anaden `image` y `actions`, que no son campos de
 * `ProductView` sino las dos columnas de MARCADO -miniatura y acciones-. El test en negativo
 * sigue haciendo falta y sigue ahi.
 *
 * **Es una FACTORIA y no un array del modulo** por lo mismo que en pedidos: la celda de acciones
 * monta el panel de edicion y el dialogo de baja, que son componentes de cliente. Mientras fue un
 * array de datos, esas acciones vivian incrustadas en la tabla.
 *
 * **Que columna ordena y que columna filtra sale de `PRODUCT_QUERYABLE`**, la lista blanca del
 * modulo, no de una decision de esta pantalla: declarar `sortable` en una cabecera que el backend
 * ignora seria pintar un control que miente. `imagePath` no esta en esa lista blanca y por eso la
 * columna de imagen no ordena ni filtra: no se ordena por una ruta de archivo.
 */

/**
 * Campos de `ProductView` que quedan FUERA de la tabla como columna propia: el identificador
 * tecnico, la ruta de la imagen y el id de la unidad -un UUID que esta pantalla no resuelve a
 * nombre por si solo-. La unidad no desaparece: se pinta junto a la existencia y las demas
 * cantidades, resuelta contra el catalogo que recibe la columna.
 *
 * `imagePath` esta fuera por el mismo criterio: la RUTA no se pinta como texto. La imagen se ve
 * -es la primera columna-, pero su columna se llama `image` y pinta una miniatura, no la cadena.
 */
type HiddenProductField =
  | 'id'
  | 'unitId'
  | 'imagePath';

/** Id de la columna de la miniatura. No es un campo de `ProductView`: es marcado. */
export const IMAGE_COLUMN_ID = 'image';

/** Id de la columna de acciones. Tampoco es un campo: es marcado. */
export const ACTIONS_COLUMN_ID = 'actions';

/**
 * Id valido de columna. **Es la primera defensa de R7, y es de tipos**: escribir
 * `id: 'createdBy'` en la declaracion de abajo no compila. El test en negativo sigue haciendo
 * falta -el tipo no impide anadir una columna con un id valido que pinte el autor-, pero el
 * error mas probable se detiene antes de llegar al test.
 */
export type ProductColumnId =
  | Exclude<keyof ProductView, HiddenProductField>
  | typeof IMAGE_COLUMN_ID
  | typeof ACTIONS_COLUMN_ID;

/** Estado de la carga de los lotes de un producto desplegado. */
export type ProductBatchesStatus =
  | { readonly status: 'loading' }
  | { readonly status: 'empty' }
  | { readonly status: 'error'; readonly message: string };

/**
 * Fila que pinta la tabla: la del producto y, desplegada, una por lote vivo o una de estado
 * (cargando, vacio, error).
 */
export type ProductTableRow =
  | {
      readonly kind: 'product';
      readonly product: ProductView;
      readonly expanded: boolean;
      readonly expiring: boolean;
    }
  | {
      readonly kind: 'batch';
      readonly product: ProductView;
      readonly batch: ProductBatchView;
      readonly expiring: boolean;
      /** Dias hasta el vencimiento (negativo si vencio); null sin fecha o sin «hoy» (servidor). */
      readonly daysToExpiry: number | null;
    }
  | {
      readonly kind: 'batchesStatus';
      readonly product: ProductView;
      readonly state: ProductBatchesStatus;
    };

/** Columna de esta tabla: la de la tabla compartida, con el id acotado por R7. */
export type ProductColumn = DataTableColumn<ProductTableRow> & { readonly id: ProductColumnId };

/** Textos de las sub-filas de lotes. */
export const PRODUCT_BATCH_ROW_TEXTS = {
  toggle: (name: string) => `Mostrar lotes de ${name}`,
  lot: 'Lote:',
  purchaseDate: 'Fecha de compra:',
  expiryDate: 'Vencimiento:',
  expired: 'Vencido',
  loading: 'Cargando lotes…',
  empty: 'Sin lotes con existencia.',
  error: 'No se pudieron cargar los lotes.',
  retry: 'Reintentar',
} as const;

/** Encabezado de la columna de imagen. Constante para que ningun test dependa del literal. */
export const IMAGE_COLUMN_LABEL = 'Imagen';

/** Encabezado de la columna de acciones. Constante para que ningun test dependa del literal. */
export const ACTIONS_COLUMN_LABEL = 'Acciones';

/**
 * Etiqueta de una unidad a partir de su id: simbolo, nombre, o el marcador si el catalogo no la
 * trae. Sin catalogo (`units` indefinido), devuelve `null` y quien llama pinta la cantidad sola.
 */
export function unitLabel(unitId: UnitRef['id'], units: readonly UnitRef[] | undefined): string | null {
  if (units === undefined) return null;
  const unit = units.find((candidate) => candidate.id === unitId);
  return unit?.symbol ?? unit?.name ?? EMPTY_MARK;
}

/**
 * La existencia esta en alarma cuando la alerta de cantidad SUPERA la existencia guardada del
 * producto. Sin lotes, esa existencia es 0 y la alarma sigue funcionando igual.
 *
 * El nombre no es casual: `inventario-schema.test.ts` prohibe `isBelowAlert` y sus hermanos
 * COMO CAMPO DEL ESQUEMA -no puede existir una columna derivada de bajo de existencias-. Aqui es
 * una funcion de presentacion en un archivo de UI, que es justo lo que esa prohibicion deja vivo.
 */
export function isBelowAlert(product: ProductView): boolean {
  return typeof product.qtyAlert === 'string' && compareQuantities(product.qtyAlert, product.stock) > 0;
}

/**
 * Etiqueta de la unidad del producto, o `null` sin unidad o sin catalogo.
 *
 * Exportada para que otras pantallas de esta ruta -el panel de lotes, por ejemplo- resuelvan la
 * unidad con la misma regla que esta tabla.
 */
export function productUnitLabel(
  product: ProductView,
  units: readonly UnitRef[] | undefined,
): string | null {
  return product.unitId === null ? null : unitLabel(product.unitId, units);
}

/**
 * Una existencia junto a su unidad, tenida de rojo cuando esta en alarma.
 *
 * Se pinta a dos decimales: la celda no es donde se vuelve a guardar. El `aria-label` lleva la
 * cifra exacta. `data-alert` acompana a la clase para que la alarma sea afirmable sin depender
 * del nombre de una utilidad de Tailwind. `testId` distingue la sub-fila de lote de la fila de
 * producto.
 */
export function stockAmountCell(
  stock: string,
  label: string | null,
  alerted: boolean,
  testId = 'product-stock',
): ReactNode {
  const amount = formatDecimalDisplay(stock);
  const exact = trimDecimal(stock);

  return (
    <span
      data-testid={testId}
      data-alert={alerted ? 'true' : undefined}
      className={alerted ? 'font-semibold text-destructive' : undefined}
      title={exactDecimalTitle(stock)}
      aria-label={label === null ? exact : `${exact} ${label}`}
    >
      {label === null ? amount : `${amount} ${label}`}
    </span>
  );
}

function stockCell(product: ProductView, units: readonly UnitRef[] | undefined): ReactNode {
  return stockAmountCell(product.stock, productUnitLabel(product, units), isBelowAlert(product));
}

/** Una cantidad en la unidad del producto; sin unidad conocida, la cifra sola. */
function productQuantityCell(
  value: string,
  testId: string,
  product: ProductView,
  units: readonly UnitRef[] | undefined,
): ReactNode {
  return quantityCell(value, testId, productUnitLabel(product, units));
}

function quantityCell(value: string, testId: string, label: string | null): ReactNode {
  const amount = formatDecimalDisplay(value);
  const exact = trimDecimal(value);

  return (
    <span
      data-testid={testId}
      title={exactDecimalTitle(value)}
      aria-label={label === null ? exact : `${exact} ${label}`}
    >
      {label === null ? amount : `${amount} ${label}`}
    </span>
  );
}

/** La alerta de cantidad, opcional: sin valor pinta el marcador de vacio, sin `title` ni `aria-label`. */
export function qtyAlertCell(product: ProductView, units: readonly UnitRef[] | undefined): ReactNode {
  if (product.qtyAlert === null) return EMPTY_MARK;
  return productQuantityCell(product.qtyAlert, 'product-qty-alert', product, units);
}

/**
 * Celda de una cantidad agregada (reservado, disponible), junto a su unidad.
 *
 * `undefined` pinta el marcador de vacio sin `title` ni `aria-label`: es lo que devuelve toda
 * lectura que no sea el listado paginado, que es la unica que agrega estas dos columnas.
 */
function aggregateQuantityCell(
  value: string | undefined,
  testId: string,
  label: string | null,
): ReactNode {
  if (value === undefined) return EMPTY_MARK;
  return quantityCell(value, testId, label);
}

/** Encabezado de la columna de costo. Constante para que ningun test dependa del literal. */
export const COST_COLUMN_LABEL = 'Costo unitario';

/**
 * Celda de un costo unitario: el del producto (promedio ponderado de sus lotes con existencia y
 * costo) o el del lote. Se pinta como DINERO con `formatMoneyDisplay`: «$», separador de miles y
 * siempre dos decimales redondeados («$1,234.56», «$12.50»), sin pasar por coma flotante. Un costo
 * que a dos decimales se leeria «$0.00» (0.0020) no se pierde: el valor exacto queda en el `title`
 * (`exactDecimalTitle`), a un hover, como en las cantidades. Con unidad conocida se lee «por
 * unidad» («$2,500.00 / L»); sin ella -tampoco con una unidad que no esta en el catalogo, que
 * `unitLabel` marca con el vacio-, el importe solo. Sin costo, el marcador de vacio.
 */
function unitCostCell(
  value: string | null | undefined,
  testId: string,
  label: string | null,
): ReactNode {
  if (value === undefined || value === null) return EMPTY_MARK;
  const amount = formatMoneyDisplay(value);
  return (
    <span data-testid={testId} title={exactDecimalTitle(value)}>
      {label === null || label === EMPTY_MARK ? amount : `${amount} / ${label}`}
    </span>
  );
}

export type ProductColumnsDeps = {
  /**
   * Acciones de la fila (el menu de la fila). Es un **slot**: la declaracion de columnas no
   * importa el panel lateral ni el dialogo, los enchufa quien monta la tabla.
   */
  readonly rowActions: (product: ProductView) => ReactNode;
  /**
   * Catalogo de unidades para resolver el simbolo de la existencia. Sin el (lectura fallida en la
   * pagina), la celda sigue pintando la cantidad, sin etiqueta.
   */
  readonly units?: readonly UnitRef[];
  /**
   * Anade la columna «Tipo» con su chip. Solo tiene sentido en la pestana «Todos»: con un tipo
   * filtrado, todas las filas dirian lo mismo. Defecto `false`, que es el recuento del esqueleto.
   */
  readonly showType?: boolean;
  /**
   * Anade la columna «Costo unitario». Solo la ve el Administrador: la decide el Server Component con el
   * permiso de la sesion (`canViewUnitCosts`) y baja por props. Defecto `false`: falla cerrado,
   * como `canAdjust`. Presentacion, no autorizacion: quien deja de enviar el costo a quien no
   * debe verlo es el servidor.
   */
  readonly showCost?: boolean;
  /**
   * Pinta la columna «Presentación». Defecto `true`; la tabla la apaga en la pestana «Producto»,
   * donde la presentacion no aporta.
   */
  readonly showPresentation?: boolean;
  /** Despliega o pliega los lotes de un producto. Sin el, la fila no pinta el chevron. */
  readonly onToggle?: (productId: string) => void;
  /** Vuelve a pedir los lotes de un producto tras un error. */
  readonly onRetry?: (productId: string) => void;
};

/** Encabezado de la columna de tipo. Constante para que ningun test dependa del literal. */
export const TYPE_COLUMN_LABEL = 'Tipo';

/**
 * Columna «Tipo»: un chip con la etiqueta y el tono propios del tipo. Sin `sortable` ni `filter`
 * en la cabecera: `type` no ordena en `PRODUCT_QUERYABLE` y el filtro ya lo dan las pestanas.
 */
const typeColumn: ProductColumn = {
  id: 'type',
  label: TYPE_COLUMN_LABEL,
  align: 'start',
  cell: (row) =>
    row.kind === 'product' ? (
      <StatusBadge
        tone={PRODUCT_TYPE_TONES[row.product.type]}
        label={PRODUCT_TYPE_LABELS[row.product.type]}
        data-testid="product-type"
        data-type={row.product.type}
      />
    ) : null,
};

/** Columna «Presentación». Sin `sortable` ni `filter`: `PRODUCT_QUERYABLE` no los admite. */
const presentationColumn: ProductColumn = {
  id: 'presentationName',
  label: 'Presentación',
  align: 'start',
  cell: (row) => (row.kind === 'product' ? (row.product.presentationName ?? EMPTY_MARK) : null),
};

/**
 * Columna «Costo unitario»: el promedio en la fila del producto y el propio en la del lote, los dos
 * en la unidad del producto. No ordena ni filtra: es un agregado de los lotes, no una columna de
 * `products`.
 */
function costColumn(units: readonly UnitRef[] | undefined): ProductColumn {
  return {
    id: 'averageUnitCost',
    label: COST_COLUMN_LABEL,
    tabular: true,
    align: 'center',
    cell: (row) => {
      if (row.kind === 'batchesStatus') return null;
      const label = productUnitLabel(row.product, units);
      return row.kind === 'product'
        ? unitCostCell(row.product.averageUnitCost, 'product-cost', label)
        : unitCostCell(row.batch.unitCost, 'product-batch-row-cost', label);
    },
  };
}

const BATCH_ROW_EXPIRY_TEST_IDS = {
  date: 'product-batch-row-expiry-date',
  relative: 'product-batch-row-expiry-relative',
  expired: 'product-batch-row-expired',
} as const;
/** Clave de la sub-fila de lote: en negrita y en linea con su valor. */
const BATCH_KEY_CLASS = 'inline font-bold';

function productNameCell(
  row: Extract<ProductTableRow, { kind: 'product' }>,
  onToggle: ProductColumnsDeps['onToggle'],
): ReactNode {
  const name = productNameWithoutPresentation(row.product);
  const label = (
    <span
      data-testid="product-name"
      data-expiring={row.expiring ? 'true' : undefined}
      className={row.expiring ? EXPIRING_CLASS : undefined}
    >
      {name}
    </span>
  );
  if (onToggle === undefined) return label;

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        touch
        className="shrink-0"
        aria-expanded={row.expanded}
        aria-label={PRODUCT_BATCH_ROW_TEXTS.toggle(name)}
        data-testid="product-batches-toggle"
        onClick={() => onToggle(row.product.id)}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn('transition-transform', row.expanded && 'rotate-90')}
        />
      </Button>
      {label}
    </div>
  );
}

function batchDetailCell(row: Extract<ProductTableRow, { kind: 'batch' }>): ReactNode {
  const { batch } = row;
  return (
    <dl data-testid="product-batch-row" className="space-y-1 pl-12 text-sm">
      <div className="block">
        <dt className={BATCH_KEY_CLASS}>{PRODUCT_BATCH_ROW_TEXTS.lot}</dt>{' '}
        <dd data-testid="product-batch-row-lot" className="inline font-mono tabular-nums">
          {batch.lot}
        </dd>
      </div>
      <div className="block">
        <dt className={BATCH_KEY_CLASS}>{PRODUCT_BATCH_ROW_TEXTS.purchaseDate}</dt>{' '}
        <dd data-testid="product-batch-row-purchase-date" className="inline font-mono tabular-nums">
          {batch.purchaseDate}
        </dd>
      </div>
      <div className="block">
        <dt className={BATCH_KEY_CLASS}>{PRODUCT_BATCH_ROW_TEXTS.expiryDate}</dt>{' '}
        <ExpiryDate
          date={batch.expiryDate}
          expiring={row.expiring}
          daysToExpiry={row.daysToExpiry}
          expiredLabel={PRODUCT_BATCH_ROW_TEXTS.expired}
          testIds={BATCH_ROW_EXPIRY_TEST_IDS}
          className="inline"
        />
      </div>
    </dl>
  );
}

function batchesStatusCell(
  row: Extract<ProductTableRow, { kind: 'batchesStatus' }>,
  onRetry: ProductColumnsDeps['onRetry'],
): ReactNode {
  const { state } = row;
  if (state.status === 'loading') {
    return (
      <p data-testid="product-batches-row-loading" className="pl-12 text-sm text-muted-foreground">
        {PRODUCT_BATCH_ROW_TEXTS.loading}
      </p>
    );
  }
  if (state.status === 'empty') {
    return (
      <p data-testid="product-batches-row-empty" className="pl-12 text-sm text-muted-foreground">
        {PRODUCT_BATCH_ROW_TEXTS.empty}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 pl-12" data-testid="product-batches-row-error">
      <p data-testid="product-batches-row-error-message" className="text-sm text-destructive">
        {state.message}
      </p>
      {onRetry === undefined ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          touch
          data-testid="product-batches-row-retry"
          onClick={() => onRetry(row.product.id)}
        >
          {PRODUCT_BATCH_ROW_TEXTS.retry}
        </Button>
      )}
    </div>
  );
}

function reservedOrAvailableCell(
  row: ProductTableRow,
  field: 'reserved' | 'available',
  units: readonly UnitRef[] | undefined,
): ReactNode {
  if (row.kind === 'batchesStatus') return null;
  const label = productUnitLabel(row.product, units);
  return row.kind === 'product'
    ? aggregateQuantityCell(row.product[field], `product-${field}`, label)
    : aggregateQuantityCell(row.batch[field], `product-batch-row-${field}`, label);
}

export function buildProductColumns({
  rowActions,
  units,
  showType = false,
  showCost = false,
  showPresentation = true,
  onToggle,
  onRetry,
}: ProductColumnsDeps): readonly ProductColumn[] {
  return [
    {
      id: IMAGE_COLUMN_ID,
      label: IMAGE_COLUMN_LABEL,
      align: 'center',
      // Nace fijada: es la que identifica la fila de un vistazo y la que menos ancho ocupa.
      // Es un defecto, con preferencia guardada gana la del usuario.
      defaultPinned: 'left',
      // `imageUrl` y no `imagePath`: la ruta del bucket no es una URL servible. Sin imagen sale
      // el marcador.
      cell: (row) =>
        row.kind === 'product' ? (
          <EntityImage
            path={row.product.imageUrl ?? null}
            name={row.product.name}
            testId="product-image"
          />
        ) : null,
    },
    {
      id: 'name',
      label: 'Nombre',
      align: 'start',
      sortable: true,
      width: 500,
      hideText: false,
      cell: (row) => {
        if (row.kind === 'product') return productNameCell(row, onToggle);
        if (row.kind === 'batch') return batchDetailCell(row);
        return batchesStatusCell(row, onRetry);
      },
    },
    ...(showType ? [typeColumn] : []),
    ...(showPresentation ? [presentationColumn] : []),
    {
      id: 'stock',
      label: 'Existencia',
      tabular: true,
      align: 'center',
      sortable: true,
      filter: { kind: 'numberRange' },
      cell: (row) => {
        if (row.kind === 'product') return stockCell(row.product, units);
        if (row.kind === 'batch') {
          return stockAmountCell(
            row.batch.stock,
            productUnitLabel(row.product, units),
            false,
            'batch-stock',
          );
        }
        return null;
      },
    },
    ...(showCost ? [costColumn(units)] : []),
    {
      id: 'qtyAlert',
      label: 'Alerta de cantidad',
      tabular: true,
      align: 'center',
      sortable: true,
      filter: { kind: 'numberRange' },
      cell: (row) => (row.kind === 'product' ? qtyAlertCell(row.product, units) : null),
    },
    {
      id: 'reserved',
      label: 'Reservado',
      tabular: true,
      align: 'center',
      // No ordena ni filtra: es un agregado de los lotes, no una columna de `products`.
      cell: (row) => reservedOrAvailableCell(row, 'reserved', units),
    },
    {
      id: 'available',
      label: 'Disponible',
      tabular: true,
      align: 'center',
      cell: (row) => reservedOrAvailableCell(row, 'available', units),
    },
    {
      ...actionsColumn<ProductTableRow>({
        id: ACTIONS_COLUMN_ID,
        label: ACTIONS_COLUMN_LABEL,
        defaultPinned: 'right',
        cell: (row) => (row.kind === 'product' ? rowActions(row.product) : null),
      }),
      id: ACTIONS_COLUMN_ID,
    },
  ];
}
