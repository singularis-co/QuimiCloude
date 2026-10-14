// Dominio PURO: sin base de datos, sin framework, sin reloj. Cantidades como texto y aritmetica en
// `BigInt` escalado, como `decimal-quantity.ts`.

import { addQuantities, compareQuantities, subtractQuantities } from './decimal-quantity';
import { quantityForPackages, wholePackagesIn } from './finished-goods-dispatch';

import type { InventoryMovementView } from './inventory-movement';
import type { MovementReason } from './movement-reason';
import type { Page } from './page';

// Solo el tipo: el contrato de este modulo lo carga un componente de cliente.
import type { CustomerRef } from '@/lib/modules/clientes';

export const FINISHED_PRODUCT_MOVEMENT_DIRECTIONS = ['in', 'out'] as const;
export type FinishedProductMovementDirection = (typeof FINISHED_PRODUCT_MOVEMENT_DIRECTIONS)[number];

/** Envases enteros y resto de una cantidad positiva con el contenido de su lote. */
export type PackagedQuantity = {
  readonly packages: number;
  /** Unidad base, sin ceros sobrantes; `null` si es cero. */
  readonly remainder: string | null;
};

export type FinishedStockSummary = {
  /** decimal(14,4), unidad base. */
  readonly total: string;
  /** Ordenado por contenido ascendente. */
  readonly byPackageContent: readonly {
    readonly packageContent: string;
    readonly packages: number;
    readonly remainder: string | null;
  }[];
  /** Existencia de los lotes sin contenido, decimal(14,4); `null` si es cero. */
  readonly withoutPackage: string | null;
};

export type FinishedProductDetail = {
  readonly id: string;
  readonly name: string;
  readonly imagePath: string | null;
  readonly qtyAlert: string | null;
  readonly unit: { readonly id: string; readonly name: string; readonly symbol: string | null } | null;
  readonly presentation: {
    readonly id: string;
    readonly name: string;
    readonly content: string | null;
    readonly unit: { readonly id: string; readonly name: string; readonly symbol: string | null } | null;
  } | null;
  readonly stock: FinishedStockSummary;
};

export type FinishedProductBatchRow = {
  readonly id: string;
  readonly lot: string;
  /** `null`: el lote no tiene asiento `production`. */
  readonly orderNumberText: string | null;
  /** YYYY-MM-DD */
  readonly purchaseDate: string;
  readonly productionDate: string | null;
  readonly expiryDate: string | null;
  readonly packageContent: string | null;
  readonly stock: string;
  readonly packagedStock: PackagedQuantity | null;
  /** ISO */
  readonly createdAt: string;
};

/** Derivado del libro y no repetido: un tipo de asiento nuevo obliga a etiquetarlo en la UI. */
export type FinishedProductMovementKind = InventoryMovementView['kind'];

export type FinishedProductMovementRow = {
  readonly id: string;
  readonly kind: FinishedProductMovementKind;
  readonly batchId: string;
  readonly lot: string;
  /** Valor absoluto. */
  readonly quantity: string;
  readonly packaged: PackagedQuantity | null;
  readonly orderNumberText: string | null;
  readonly reason: MovementReason | null;
  readonly createdAt: string;
};

export type FinishedProductDeliveryRow = {
  readonly movementId: string;
  readonly orderDeliveryId: string;
  readonly createdAt: string;
  readonly customer: CustomerRef | null;
  readonly orderNumberText: string | null;
  readonly batchId: string;
  readonly lot: string;
  /** `null` si la linea de entrega no vuelve del directorio. */
  readonly packages: number | null;
  /** Valor absoluto. */
  readonly quantity: string;
  /** `null`: no anulada, o la linea no volvio del directorio. */
  readonly void: { readonly reason: string } | null;
};

/** Solo las lineas no anuladas, de todas las entregas del producto. */
export type DeliveredTotal = {
  /** decimal(14,4), unidad base. */
  readonly quantity: string;
  readonly packages: number;
};

export type FinishedProductDeliveriesPage = Page<FinishedProductDeliveryRow> & {
  readonly delivered: DeliveredTotal;
};

export type FinishedProductCostRow = {
  readonly batchId: string;
  readonly lot: string;
  readonly orderNumberText: string | null;
  /** La del asiento `production`. */
  readonly quantity: string;
  readonly packaged: PackagedQuantity | null;
  /** `null` en lotes anteriores a guardar el costo unitario. */
  readonly unitCost: string | null;
  readonly totalCost: string | null;
  readonly createdAt: string;
};

export type ProducedProductLink = {
  readonly orderId: string;
  readonly presentationId: string;
  readonly productId: string;
};

/** Hueco para `pedidos`: las tablas de entregas son suyas. Sin permisos: autoriza quien llama. */
export interface FinishedDeliveryDirectory {
  findDeliveryDetails(
    companyId: string,
    deliveryIds: readonly string[],
  ): Promise<ReadonlyMap<string, {
    readonly customerId: string;
    /** Clave: batchId. `(delivery_id, batch_id)` es unico en `order_delivery_lines`. */
    readonly linesByBatch: ReadonlyMap<string, {
      readonly packages: number;
      readonly void: { readonly reason: string } | null;
    }>;
  }>>;
  /** Cantidad y envases de las lineas de entrega de esos lotes sin linea de anulacion. */
  summarizeDelivered(companyId: string, batchIds: readonly string[]): Promise<DeliveredTotal>;
}

const ZERO_QUANTITY = '0.0000';
const SCALE = 4;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const TEN = BigInt(10);

const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

function normalize(quantity: string): string {
  return addQuantities(quantity, ZERO_QUANTITY);
}

function withoutTrailingZeros(quantity: string): string {
  if (!quantity.includes('.')) return quantity;
  return quantity.replace(/0+$/u, '').replace(/\.$/u, '');
}

function isPositive(quantity: string): boolean {
  return compareQuantities(quantity, ZERO_QUANTITY) > 0;
}

/** `null` si `packageContent` es `null` o no es positivo. */
export function packagedQuantityOf(
  quantity: string,
  packageContent: string | null,
): PackagedQuantity | null {
  if (packageContent === null || !isPositive(packageContent)) return null;

  const packages = wholePackagesIn(quantity, packageContent);
  const remainder = subtractQuantities(quantity, quantityForPackages(packages, packageContent));
  return {
    packages,
    remainder: compareQuantities(remainder, ZERO_QUANTITY) === 0 ? null : withoutTrailingZeros(remainder),
  };
}

/** Los lotes sin existencia no aportan ninguna entrada. */
export function summarizeFinishedStock(
  batches: readonly { readonly stock: string; readonly packageContent: string | null }[],
): FinishedStockSummary {
  let total = ZERO_QUANTITY;
  let withoutPackage = ZERO_QUANTITY;
  const groups = new Map<string, { packages: number; remainder: string }>();

  for (const batch of batches) {
    total = addQuantities(total, batch.stock);
    if (!isPositive(batch.stock)) continue;

    const packaged = packagedQuantityOf(batch.stock, batch.packageContent);
    if (packaged === null || batch.packageContent === null) {
      withoutPackage = addQuantities(withoutPackage, batch.stock);
      continue;
    }

    const content = normalize(batch.packageContent);
    const group = groups.get(content) ?? { packages: 0, remainder: ZERO_QUANTITY };
    group.packages += packaged.packages;
    group.remainder = addQuantities(group.remainder, packaged.remainder ?? ZERO_QUANTITY);
    groups.set(content, group);
  }

  return {
    total,
    byPackageContent: [...groups.entries()]
      .sort(([a], [b]) => compareQuantities(a, b))
      .map(([packageContent, group]) => ({
        packageContent,
        packages: group.packages,
        remainder:
          compareQuantities(group.remainder, ZERO_QUANTITY) === 0
            ? null
            : withoutTrailingZeros(group.remainder),
      })),
    withoutPackage: compareQuantities(withoutPackage, ZERO_QUANTITY) === 0 ? null : withoutPackage,
  };
}

function parseScaled(raw: string): { readonly unscaled: bigint; readonly scale: number } {
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new Error(`finished-product-detail: no es un decimal valido: ${JSON.stringify(raw)}`);
  }
  const [whole = '', fraction = ''] = raw.split('.');
  return { unscaled: BigInt(whole + fraction), scale: fraction.length };
}

function formatScale4(scaled: bigint): string {
  const negative = scaled < ZERO;
  const digits = (negative ? -scaled : scaled).toString().padStart(SCALE + 1, '0');
  const cut = digits.length - SCALE;
  return `${negative ? '-' : ''}${digits.slice(0, cut)}.${digits.slice(cut)}`;
}

/** `unitCost x quantity`, exacto y redondeado mitad arriba a cuatro decimales. */
export function productionCostTotal(unitCost: string, quantity: string): string {
  const cost = parseScaled(unitCost);
  const amount = parseScaled(quantity);
  const product = cost.unscaled * amount.unscaled;
  const scale = cost.scale + amount.scale;

  if (scale <= SCALE) return formatScale4(product * TEN ** BigInt(SCALE - scale));

  const divisor = TEN ** BigInt(scale - SCALE);
  const negative = product < ZERO;
  const magnitude = negative ? -product : product;
  const quotient = magnitude / divisor;
  const rounded = (magnitude % divisor) * TWO >= divisor ? quotient + ONE : quotient;
  return formatScale4(negative ? -rounded : rounded);
}
