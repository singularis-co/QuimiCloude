export type DeliveryLineState = {
  readonly presentationLineId: string;
  /** Entero >= 1. */
  readonly orderedPackages: number;
  /** Entero >= 0. */
  readonly deliveredPackages: number;
};

export type DeliveryBatchState = {
  readonly batchId: string;
  readonly presentationLineId: string;
  /** Entero >= 0. */
  readonly availablePackages: number;
};

export type DeliveryAllocation = {
  readonly presentationLineId: string;
  readonly batchId: string;
  /** Entero >= 1. */
  readonly packages: number;
};

export type DeliveryCheck =
  | { readonly kind: 'ok'; readonly completesOrder: boolean }
  | { readonly kind: 'empty' }
  | { readonly kind: 'exceeds_remaining'; readonly presentationLineIds: readonly string[] }
  | { readonly kind: 'exceeds_batch'; readonly batchIds: readonly string[] };

export type DeliveryCustomerBlock = {
  /** `null` solo en el sheet: el bloque aun no tiene cliente. */
  readonly customerId: string | null;
  readonly allocations: readonly DeliveryAllocation[];
};

export type DeliveryBlockIssue = 'missing_customer' | 'duplicate_customer' | 'no_packages';

/** Cuenta las asignaciones de todos los clientes juntos. */
export const DELIVERY_MAX_ALLOCATIONS = 200;

export function remainingPackages(line: DeliveryLineState): number {
  return Math.max(0, line.orderedPackages - line.deliveredPackages);
}

function sumBy(allocations: readonly DeliveryAllocation[], key: (a: DeliveryAllocation) => string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const allocation of allocations) {
    if (allocation.packages <= 0) continue;
    const id = key(allocation);
    totals.set(id, (totals.get(id) ?? 0) + allocation.packages);
  }
  return totals;
}

/** Los lotes cuya suma de asignaciones supera lo disponible, en el orden en que aparecen en
 *  `allocations`. Un lote que no esta en `batches` cuenta con 0 disponibles. */
export function batchesOverAvailable(
  batches: readonly DeliveryBatchState[],
  allocations: readonly DeliveryAllocation[],
): readonly string[] {
  const availableByBatch = new Map(batches.map((batch) => [batch.batchId, batch.availablePackages]));
  return [...sumBy(allocations, (a) => a.batchId)]
    .filter(([batchId, packages]) => packages > (availableByBatch.get(batchId) ?? 0))
    .map(([batchId]) => batchId);
}

/** Los envases asignados a una presentacion; las asignaciones sin envases no cuentan. */
export function packagesInLine(allocations: readonly DeliveryAllocation[], presentationLineId: string): number {
  return sumBy(allocations, (a) => a.presentationLineId).get(presentationLineId) ?? 0;
}

/**
 * Comprueba una entrega en este orden: `empty`, `exceeds_remaining` y `exceeds_batch`. Con
 * `batches` en `null` no se comprueba el tope por lote: lo hace quien tiene el lote bloqueado.
 * `completesOrder` es true si, sumando las asignaciones, no le falta ningun envase a ninguna linea.
 * Una asignacion a una linea que no esta en `lines` cuenta como exceso de esa linea.
 */
export function checkDelivery(
  lines: readonly DeliveryLineState[],
  batches: readonly DeliveryBatchState[] | null,
  allocations: readonly DeliveryAllocation[],
): DeliveryCheck {
  const byLine = sumBy(allocations, (a) => a.presentationLineId);
  if (byLine.size === 0) return { kind: 'empty' };

  const remainingByLine = new Map(lines.map((line) => [line.presentationLineId, remainingPackages(line)]));
  const exceededLines = [...byLine]
    .filter(([lineId, packages]) => packages > (remainingByLine.get(lineId) ?? 0))
    .map(([lineId]) => lineId);
  if (exceededLines.length > 0) return { kind: 'exceeds_remaining', presentationLineIds: exceededLines };

  if (batches !== null) {
    const exceededBatches = batchesOverAvailable(batches, allocations);
    if (exceededBatches.length > 0) return { kind: 'exceeds_batch', batchIds: exceededBatches };
  }

  const completesOrder = lines.every((line) => (byLine.get(line.presentationLineId) ?? 0) >= remainingPackages(line));
  return { kind: 'ok', completesOrder };
}

/** Por indice de bloque, el primer problema en el orden `missing_customer`, `duplicate_customer`
 *  (frente a un bloque anterior) y `no_packages`. Los bloques sin problema no aparecen. */
export function checkDeliveryBlocks(blocks: readonly DeliveryCustomerBlock[]): ReadonlyMap<number, DeliveryBlockIssue> {
  const issues = new Map<number, DeliveryBlockIssue>();
  const seen = new Set<string>();
  blocks.forEach((block, index) => {
    if (block.customerId === null) {
      issues.set(index, 'missing_customer');
      return;
    }
    // Postgres iguala un uuid en mayusculas y en minusculas: son el mismo cliente.
    const customerKey = block.customerId.toLowerCase();
    if (seen.has(customerKey)) {
      issues.set(index, 'duplicate_customer');
      return;
    }
    seen.add(customerKey);
    if (!block.allocations.some((allocation) => allocation.packages > 0)) issues.set(index, 'no_packages');
  });
  return issues;
}

export function flattenBlocks(blocks: readonly DeliveryCustomerBlock[]): readonly DeliveryAllocation[] {
  return blocks.flatMap((block) => block.allocations);
}

/** Lo que le queda al lote tras `allocations`, sin bajar de cero. */
export function packagesLeftInBatch(
  availablePackages: number,
  allocations: readonly DeliveryAllocation[],
  batchId: string,
): number {
  const used = sumBy(allocations, (a) => a.batchId).get(batchId) ?? 0;
  return Math.max(0, availablePackages - used);
}
