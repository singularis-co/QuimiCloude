import type {
  FinishedProductBatchRow,
  FinishedProductMovementDirection,
  FinishedProductMovementKind,
  ProducedProductLink,
} from '../domain/finished-product-detail';
import type { InventoryScope } from '../domain/inventory-scope';
import type { MovementReason } from '../domain/movement-reason';
import type { Page } from '../domain/page';

export type FinishedProductRecord = {
  readonly id: string;
  readonly name: string;
  readonly imagePath: string | null;
  readonly qtyAlert: string | null;
  readonly unitId: string | null;
  readonly presentation: {
    readonly id: string;
    readonly name: string;
    readonly content: string | null;
    readonly unitId: string | null;
  } | null;
  readonly batches: readonly {
    readonly id: string;
    readonly lot: string;
    readonly stock: string;
    readonly packageContent: string | null;
  }[];
};

/** El defecto y el tope del tamano los aplica el adaptador. */
export type PageRequest = { readonly page: number; readonly pageSize?: number };

export type FinishedProductBatchRecord = Omit<FinishedProductBatchRow, 'orderNumberText' | 'packagedStock'> & {
  readonly orderId: string | null;
};

export type FinishedProductMovementRecord = {
  readonly id: string;
  readonly kind: FinishedProductMovementKind;
  readonly batchId: string;
  readonly lot: string;
  /** Con signo. */
  readonly quantity: string;
  readonly packageContent: string | null;
  readonly orderId: string | null;
  readonly reason: MovementReason | null;
  readonly createdAt: string;
};

export type FinishedProductCostRecord = {
  readonly batchId: string;
  readonly lot: string;
  readonly orderId: string | null;
  readonly quantity: string;
  readonly packageContent: string | null;
  readonly unitCost: string | null;
  readonly createdAt: string;
};

/** Todos los listados van en orden `createdAt desc, id desc`. */
export interface FinishedProductDetailRepository {
  /** Vivo, de la empresa y `FINISHED_PRODUCT`; si no, `null`. */
  findAliveFinished(id: string, scope: InventoryScope): Promise<FinishedProductRecord | null>;
  /** `orderId` sale del asiento `production` del lote. */
  listBatches(
    productId: string,
    page: PageRequest,
    scope: InventoryScope,
  ): Promise<Page<FinishedProductBatchRecord>>;
  /** Por el signo de la cantidad y no por el tipo de asiento. */
  listMovements(
    productId: string,
    direction: FinishedProductMovementDirection,
    page: PageRequest,
    scope: InventoryScope,
  ): Promise<Page<FinishedProductMovementRecord>>;
  /** Asientos `production`, con el `unitCost` y el `packageContent` de su lote. */
  listProductionCosts(
    productId: string,
    page: PageRequest,
    scope: InventoryScope,
  ): Promise<Page<FinishedProductCostRecord>>;
  /** Sin repetidos, y solo de productos vivos `FINISHED_PRODUCT`. */
  findProducedProducts(
    orderIds: readonly string[],
    scope: InventoryScope,
  ): Promise<readonly ProducedProductLink[]>;
}
