'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';

import {
  DataTable,
  type DataTableCardLayout,
  type DataTableParams,
  type DataTableStates,
  type DataTableTexts,
} from '@/components/shared/data-table';
import type { ErrorState as OperationError } from '@/lib/modules/errores';
import { PRODUCT_TYPES, type ProductBatchView, type ProductView } from '@/lib/modules/inventario';
import { listAliveProductBatchesAction } from '@/lib/modules/inventario/adapters/driving/batch-actions';
import type { UnitRef } from '@/lib/modules/unidades';

import { useLocalToday } from './expiry-date';
import { daysUntil, isExpiringSoon } from './expiry-warning';
import {
  BATCHES_TOGGLE_COLUMN_ID,
  buildProductColumns,
  IMAGE_COLUMN_ID,
  PRODUCT_BATCH_ROW_TEXTS,
  type ProductTableRow,
} from './product-columns';
import { PRODUCT_SKELETON_COLUMN_COUNT } from './product-columns-skeleton';
import {
  productListHref,
  QTY_ALERT_COLUMN_ID,
  STOCK_COLUMN_ID,
  TYPE_COLUMN_ID,
} from './product-list-params';
import { ProductRowDialogs, type ProductRowDialogsActive } from './product-row-dialogs';
import { productRowActionsSpec, type ProductRowAction } from './product-row-actions';
import { ProductTypeTabs } from './product-type-tabs';

/**
 * Tabla del catalogo (R6-R11, `design.md > 4.3`, `> 7`).
 *
 * **MIGRADA A LA TABLA COMPARTIDA el 2026-09-07 (decision humana).** Antes esta ruta declaraba su
 * propia tabla con `components/ui/table.tsx` y su propia barra de paginacion
 * (`product-list-toolbar.tsx`, que DESAPARECE). Ahora monta `components/shared/data-table`, la
 * misma que ya usan pedidos y recetas, importada por su barrel publico. Lo que se gana, ademas de
 * no mantener tres tablas: orden por cabecera, filtros de rango, busqueda, fijado de columnas y
 * un solo sitio donde se arreglan los tres.
 *
 * **Ahora es `'use client'`**, y antes no: la tabla compartida es interactiva -emite
 * `onParamsChange`- y monta el panel o el dialogo que abre el menu de la fila. El Server Component
 * sigue siendo `ProductListSection`, que es quien pide los datos (R30); aqui solo llegan filas ya
 * resueltas y los parametros con los que se pidieron.
 *
 * **Solo emite; el servidor recalcula.** `onParamsChange` entrega el `DataTableParams` completo y
 * aqui se traduce a una navegacion con la cadena de consulta canonica. Esta pantalla **no ordena,
 * no filtra y no busca en el cliente**: la lista vuelve a pedirse sobre el conjunto entero. El
 * destino sale de `productListHref` (R2): ningun archivo de la ruta escribe la URL como literal.
 *
 * **`searchable` se queda en su defecto (`true`)**, al contrario que en pedidos:
 * `PRODUCT_QUERYABLE.searchable` es `true` y `listProducts` resuelve la busqueda contra la columna
 * normalizada con su indice de trigramas, asi que la caja de busqueda no miente.
 *
 * **El «cargando» de una navegacion no remonta la pantalla**: la `key` del `<Suspense>` de la
 * pagina desaparecio (2026-09-07) porque remontaba la tabla entera en cada cambio de consulta y
 * borraba el foco del campo de busqueda o de filtro que se estaba escribiendo. Ahora la navegacion
 * va en una transicion y, mientras esta en vuelo, esta pantalla lo anuncia con `aria-busy` y un
 * rotulo, y atenua la tabla, sin desmontarla. La primera carga, el error y el catalogo vacio los
 * pinta la tabla compartida en lugar de toda la tabla.
 *
 * **El desbordamiento horizontal lo absorbe el primitivo** (R9): `components/ui/table.tsx`, que
 * la tabla compartida usa por dentro, envuelve la tabla en un contenedor con `overflow-x-auto`.
 * No se edita el primitivo (R29) ni se anade columna pegajosa a mano: el fijado de columnas lo
 * ofrece la tabla compartida.
 */

/** Clave de persistencia del fijado de columnas. Una sola tabla en la pantalla, un solo id. */
export const PRODUCT_TABLE_ID = 'inventario';

/**
 * Textos del componente compartido. Viven aqui -y no en el componente- porque la tabla compartida
 * no incrusta copy de ningun dominio. Ningun test afirma sobre estos literales: los controles se
 * localizan por rol o por `data-testid`.
 */
export const PRODUCT_TABLE_TEXTS: DataTableTexts = {
  empty: 'No hay productos que mostrar.',
  loading: 'Cargando productos…',
  error: 'No se pudo cargar el catálogo.',
  search: 'Buscar producto',
  filters: 'Filtros',
  columnMenu: 'opciones de la columna',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  pageIndicator: (page, totalPages) => `Página ${page} de ${totalPages}`,
  pageSize: 'Productos por página',
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

export type ProductTableCardOptions = {
  readonly showType: boolean;
  readonly showPresentation: boolean;
  readonly canSeeCost: boolean;
};

/** La tarjeta del producto: cada campo sale solo donde sale su columna. */
export function productTableCard({
  showType,
  showPresentation,
  canSeeCost,
}: ProductTableCardOptions): DataTableCardLayout {
  return {
    primary: IMAGE_COLUMN_ID,
    status: showType ? TYPE_COLUMN_ID : undefined,
    title: 'name',
    meta: [
      ...(showPresentation ? ['presentationName'] : []),
      STOCK_COLUMN_ID,
      QTY_ALERT_COLUMN_ID,
      'available',
      ...(canSeeCost ? ['averageUnitCost'] : []),
    ],
    footer: BATCHES_TOGGLE_COLUMN_ID,
  };
}

/**
 * Va en el envoltorio de la tabla. En la tabla oculta el conmutador del pie (ya está el chevrón
 * del nombre) y en la tarjeta el chevrón; las sub-filas de lote ganan fondo, sangría y entrada.
 */
export const PRODUCT_TABLE_SCOPE_CLASS = [
  '[&_[data-testid=data-table-head-batchesToggle]]:hidden',
  '[&_[data-testid=data-table-cell-batchesToggle]]:hidden',
  '[&_[data-testid=data-table-cards]_[data-testid=product-batches-toggle]]:hidden',
  // Opaco: las celdas fijadas (imagen, acciones) tapan lo que pasa por debajo con scroll horizontal.
  '[&_tr:has([data-batch-subrow])>td]:bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))]',
  'motion-safe:[&_tr:has([data-batch-subrow])>td]:animate-[screen-enter_var(--dur-slow)_var(--ease-enter)_both]',
  '[&_li:has([data-batch-subrow])]:ml-5',
  '[&_li:has([data-batch-subrow])]:rounded-lg',
  '[&_li:has([data-batch-subrow])]:bg-muted',
  'motion-safe:[&_li:has([data-batch-subrow])]:animate-[screen-enter_var(--dur-slow)_var(--ease-enter)_both]',
].join(' ');

export type ProductTableProps = {
  /** Las filas **ya resueltas** por la consulta, en el orden en que las entrega. */
  readonly products: readonly ProductView[];
  /** Los parametros vigentes, los mismos con los que se pidio la lista. */
  readonly params: DataTableParams;
  readonly totalPages: number;
  /** Catalogo de unidades, para resolver el simbolo de la existencia en la columna. */
  readonly units?: readonly UnitRef[];
  /**
   * Permiso `inventario.modificar`, resuelto en el servidor y bajado por props. Defecto `false`:
   * falla cerrado, como el resto de esta ruta.
   */
  readonly canAdjust?: boolean;
  /**
   * Si se pinta la columna «Costo» (solo el Administrador), resuelto en el servidor con
   * `canViewUnitCosts` y bajado por props. Defecto `false`: falla cerrado, como `canAdjust`.
   */
  readonly canSeeCost?: boolean;
  /** Defecto `'idle'`. `'loading'` es la primera carga, el `fallback` del `<Suspense>`. */
  readonly status?: ProductTableStatus;
  /** El error de la consulta, entero; solo se pinta con `status="error"`. */
  readonly error?: OperationError;
  /** El catalogo vacio, que la seccion pasa solo sin busqueda ni filtro activos. */
  readonly empty?: ProductTableEmpty;
};

export type ProductTableStatus = 'idle' | 'loading' | 'error';

export type ProductTableEmpty = {
  /** Solo cuando la pagina pedida se quedo sin elementos tras un borrado. */
  readonly firstPageHref?: string;
  /** La accion de crear el primer producto. */
  readonly action?: ReactNode;
};

/**
 * Los estados que sustituyen a toda la tabla. Los comparte la pestana de producto terminado:
 * las dos listas cargan y fallan igual.
 */
export function productTableStates({
  pageSize,
  error,
  empty,
  columns = PRODUCT_SKELETON_COLUMN_COUNT,
}: {
  readonly pageSize: number;
  readonly error?: OperationError;
  readonly empty?: ProductTableEmpty;
  /** Celdas por fila del esqueleto: las columnas que de verdad se van a pintar. */
  readonly columns?: number;
}): DataTableStates {
  return {
    loading: {
      columns,
      rows: pageSize,
      label: PRODUCT_TABLE_TEXTS.loading,
      testId: 'product-table-skeleton',
      rowTestId: 'product-row-skeleton',
    },
    error:
      error === undefined
        ? undefined
        : {
            error,
            title: PRODUCT_TABLE_TEXTS.error,
            testId: 'product-list-error',
            messageTestId: 'product-list-error-message',
            codeTestId: 'product-list-error-code',
            retry: { kind: 'refresh' },
            retryTestId: 'product-list-retry',
          },
    empty:
      empty === undefined
        ? undefined
        : {
            testId: 'product-list-empty',
            message:
              empty.firstPageHref === undefined
                ? 'Todavía no hay productos en el catálogo.'
                : 'Esta página ya no tiene productos.',
            firstPage:
              empty.firstPageHref === undefined
                ? undefined
                : {
                    href: empty.firstPageHref,
                    label: 'Volver a la primera página',
                    testId: 'product-list-first-page',
                  },
            children: empty.action,
          },
  };
}

type BatchesLoad =
  // `request` identifica la peticion en vuelo: solo su respuesta puede sustituir esta entrada.
  | { readonly status: 'loading'; readonly request: object }
  | { readonly status: 'success'; readonly data: readonly ProductBatchView[] }
  | { readonly status: 'error'; readonly message: string };


function productRowId(row: ProductTableRow): string {
  if (row.kind === 'product') return row.product.id;
  if (row.kind === 'batch') return `${row.product.id}--batch-${row.batch.id}`;
  return `${row.product.id}--batches`;
}

function expandedRows(
  product: ProductView,
  load: BatchesLoad | undefined,
  today: string | null,
): ProductTableRow[] {
  if (load === undefined || load.status === 'loading') {
    return [{ kind: 'batchesStatus', product, state: { status: 'loading' } }];
  }
  if (load.status === 'error') {
    return [{ kind: 'batchesStatus', product, state: load }];
  }
  if (load.data.length === 0) {
    return [{ kind: 'batchesStatus', product, state: { status: 'empty' } }];
  }
  return load.data.map((batch) => ({
    kind: 'batch',
    product,
    batch,
    expiring: today !== null && isExpiringSoon(batch.expiryDate, today),
    daysToExpiry: today === null ? null : daysUntil(batch.expiryDate, today),
  }));
}

export function ProductTable({
  products,
  params,
  totalPages,
  units,
  canAdjust = false,
  canSeeCost = false,
  status = 'idle',
  error,
  empty,
}: ProductTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // En el servidor no hay «hoy» del usuario: sin el, nada se marca y se pinta tras hidratar.
  const today = useLocalToday();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [batches, setBatches] = useState<ReadonlyMap<string, BatchesLoad>>(() => new Map());
  const [shownProducts, setShownProducts] = useState(products);

  // Una lista nueva (otra pagina, o el refresco tras un ajuste) invalida los lotes ya leidos.
  if (shownProducts !== products) {
    setShownProducts(products);
    setExpanded(new Set());
    setBatches(new Map());
  }

  const [active, setActive] = useState<ProductRowDialogsActive | null>(null);
  const [activeOpen, setActiveOpen] = useState(false);
  const handleAction = useCallback((action: ProductRowAction, product: ProductView) => {
    setActive({ product, action });
    setActiveOpen(true);
  }, []);

  // La columna «Tipo» solo sale en la pestana «Todos» (sin filtro de tipo): con un tipo
  // filtrado, todas las filas dirian lo mismo.
  const typeFilter = params.filters[TYPE_COLUMN_ID];
  const showType = typeFilter === undefined;
  // La pestana «Producto» no pinta «Presentación»; «Todos» y el resto de pestanas, si.
  const showPresentation = !(
    typeFilter?.kind === 'select' && typeFilter.values[0] === PRODUCT_TYPES.PRODUCT
  );
  const card = useMemo(
    () => productTableCard({ showType, showPresentation, canSeeCost }),
    [showType, showPresentation, canSeeCost],
  );
  const columns = useMemo(() => {
    const loadBatches = (productId: string) => {
      // Cada peticion lleva su propia identidad. Si la lista se invalido mientras tanto (y quiza
      // el producto se reabrio con otra peticion), la respuesta ya no le pertenece y se descarta.
      const request = {};
      setBatches((current) => new Map(current).set(productId, { status: 'loading', request }));
      const settle = (next: BatchesLoad) =>
        setBatches((current) => {
          const entry = current.get(productId);
          return entry?.status === 'loading' && entry.request === request
            ? new Map(current).set(productId, next)
            : current;
        });
      void listAliveProductBatchesAction(productId).then(
        (result) =>
          settle(
            result.status === 'success'
              ? { status: 'success', data: result.data }
              : { status: 'error', message: result.message },
          ),
        () => settle({ status: 'error', message: PRODUCT_BATCH_ROW_TEXTS.error }),
      );
    };

    return buildProductColumns({
      menu: (product) => productRowActionsSpec({ product, units, canAdjust, onAction: handleAction }),
      units,
      showType,
      showCost: canSeeCost,
      showPresentation,
      onToggle: (productId) => {
        setExpanded((current) => {
          const next = new Set(current);
          if (next.has(productId)) next.delete(productId);
          else next.add(productId);
          return next;
        });
        // Solo un producto nunca abierto carece de entrada: el resto se sirve de lo ya leido.
        if (!batches.has(productId)) loadBatches(productId);
      },
      onRetry: loadBatches,
    });
  }, [units, canAdjust, canSeeCost, showType, showPresentation, batches, handleAction]);

  const tableRows = useMemo(
    () =>
      products.flatMap((product): ProductTableRow[] => {
        const isOpen = expanded.has(product.id);
        const row: ProductTableRow = {
          kind: 'product',
          product,
          expanded: isOpen,
          expiring: today !== null && isExpiringSoon(product.nextExpiryDate, today),
        };
        if (!isOpen) return [row];
        return [row, ...expandedRows(product, batches.get(product.id), today)];
      }),
    [products, expanded, batches, today],
  );

  /*
    La navegacion va DENTRO de una transicion (`startTransition`), y su `isPending` es la senal de
    «algo esta en vuelo» mientras el servidor recalcula la lista (2026-09-07).

    Esa senal NO desmonta nada: antes la daba la `key` del `<Suspense>` de la pagina, que
    remontaba el subarbol entero en cada cambio de consulta y con el borraba el foco del campo que
    se estaba escribiendo -escribir en la busqueda o en un filtro de texto perdia el cursor en
    cuanto salia la peticion-. Tampoco se pasa `status="loading"` a la tabla compartida por lo
    mismo: ese estado sustituye cabecera y filas por el esqueleto, y el foco se iria igual. Se
    anuncia con `aria-busy` y un rotulo visible, atenuando la tabla, que sigue montada y sigue
    aceptando teclas.
  */
  const navigate = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
  };

  // El conmutador del pie es una columna que la tabla no pinta.
  const hasCardToggle = columns.some((column) => column.id === BATCHES_TOGGLE_COLUMN_ID);
  const tableColumnCount = hasCardToggle ? columns.length - 1 : columns.length;

  const table = (
    <DataTable
      tableId={PRODUCT_TABLE_ID}
      columns={columns}
      rows={tableRows}
      getRowId={productRowId}
      params={params}
      totalPages={totalPages}
      onParamsChange={(next) => navigate(productListHref(next))}
      status={status}
      texts={PRODUCT_TABLE_TEXTS}
      states={productTableStates({
        pageSize: params.pageSize,
        error,
        empty,
        columns: tableColumnCount,
      })}
      card={card}
    />
  );

  // Fuera de las filas, el estado sustituye a la pantalla entera: sin pestanas ni envoltorio.
  if (status !== 'idle' || (products.length === 0 && empty !== undefined)) {
    return table;
  }

  return (
    <div
      data-testid="product-table"
      aria-busy={isPending}
      className={
        isPending
          ? 'flex flex-col gap-4 opacity-60 transition-opacity'
          : 'flex flex-col gap-4 transition-opacity'
      }
    >
      {/*
        La senal de «en vuelo»: un rotulo visible con el texto de `PRODUCT_TABLE_TEXTS.loading`
        y la tabla atenuada. Para la tecnologia de asistencia la lleva `aria-busy` en el
        contenedor -no una segunda region viva: la zona privada tiene EXACTAMENTE una, la de
        avisos que monta el layout privado, y varios tests lo afirman-. La tabla NO se desmonta ni
        se bloquea: se puede seguir escribiendo en la barra de filtros mientras se recalcula.
      */}
      {isPending ? (
        <p className="text-xs text-muted-foreground">{PRODUCT_TABLE_TEXTS.loading}</p>
      ) : null}
      <ProductTypeTabs params={params} />
      <div className={PRODUCT_TABLE_SCOPE_CLASS}>{table}</div>
      <ProductRowDialogs
        active={active}
        open={activeOpen}
        onOpenChange={setActiveOpen}
        units={units}
        canAdjust={canAdjust}
      />
    </div>
  );
}
