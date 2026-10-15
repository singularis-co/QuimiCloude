// lib/modules/asignaciones/domain/packing-order-view.ts
/**
 * La fila comun de «Por empacar»: numero, receta, cantidad con su unidad, reparto, estado y quien
 * empaca. La usan `listPackingOrders` y `getPackingOrder`, para que las dos consultas nunca puedan
 * mostrar datos distintos de un mismo pedido.
 *
 * Reutiliza `composeOrderRows` para receta, reparto y unidad aunque tambien calcule responsables: esta
 * vista no los necesita, pero una segunda composicion paralela es la que podria divergir el dia que
 * cambie el criterio de nombre de receta, de presentacion o de etiqueta de la unidad.
 */
import { composeOrderRows, type ComposeOrderRowsDeps } from './compose-order-rows';
import { unitLabelOf, type OrderDistributionLineView } from './order-distribution-view';
import type { StepEvidenceView } from './step-evidence';

import type { AssignedOrderSummary } from '@/lib/modules/pedidos';
import type { RecipeStepView } from '@/lib/modules/recetas';
import { formatOrderNumber, type OrderStatus } from '@/lib/modules/pedidos';
import type { PackagingCatalog } from '@/lib/modules/inventario';
import type { UnitConversion, UnitRef } from '@/lib/modules/unidades';

export type PackingOrderViewDeps = ComposeOrderRowsDeps;

/** Las piezas que la pantalla de «Por empacar» necesita de cada fila. `packedByName` y `packedById`
 *  viajan vacios (`null`) en `POR_EMPACAR`, porque todavia no hay quien empaca. */
export type PackingOrderRow = {
  readonly id: string;
  readonly numberText: string;
  readonly recipeName: string | null;
  /** Cadena decimal, nunca `number`. */
  readonly quantity: string;
  /** El reparto en orden de alta; vacio = «Sin presentacion». Solo lectura. */
  readonly presentationLines: readonly OrderDistributionLineView[];
  /** La unidad de `quantity`; los dos `null` = pedido sin unidad, la cifra va sola. */
  readonly unitId: string | null;
  readonly unitLabel: string | null;
  readonly status: OrderStatus;
  readonly packedByName: string | null;
  readonly packedById: string | null;
};

/** Una linea del reparto tal como la cuenta el dialogo de Terminar. */
export type PackingFinishLineView = {
  readonly lineId: string;
  /** El nombre del envase o, en una linea antigua, el de la presentacion. */
  readonly label: string;
  /** Envases planeados en el reparto. */
  readonly plan: number;
  /** Cadena decimal: el contenido copiado en la linea o, sin copia, el vigente de la presentacion.
   *  `null` = ninguno de los dos; Terminar lo rechazara. */
  readonly content: string | null;
  /** La unidad de la presentacion. */
  readonly unit: UnitConversion;
  /** `null` = linea guardada antes de que el reparto nombrara envases. `freePackages` es lo que
   *  queda sin apartar por ningun pedido; si dos lineas comparten envase, lo comparten. */
  readonly packaging: { readonly productId: string; readonly name: string; readonly freePackages: number } | null;
};

/** Lo que el dialogo de Terminar necesita para validar el conteo igual que el servidor. */
export type PackingFinishView = {
  /** Cadena decimal, nunca `number`. */
  readonly orderQuantity: string;
  readonly orderUnit: UnitConversion;
  readonly orderUnitLabel: string;
  readonly lines: readonly PackingFinishLineView[];
};

/** La fila de un unico pedido, con los pasos con que se empaca. */
export type PackingOrderDetail = PackingOrderRow & {
  /** Vacio salvo `EN_EMPAQUE` a nombre del actor. Nunca trae pasos del operador. */
  readonly packingSteps: readonly RecipeStepView[];
  /** Las fotos de envasado por paso, con URL firmada. Vacio en los mismos casos que `packingSteps`. */
  readonly packingEvidence: readonly StepEvidenceView[];
  /** `null` salvo `EN_EMPAQUE` a nombre del actor, y tambien si el pedido no tiene unidad o la de
   *  una presentacion no vuelve: sin ellas no hay con que validar el conteo. */
  readonly finish: PackingFinishView | null;
};

export async function composePackingOrderRows(
  deps: PackingOrderViewDeps,
  companyId: string,
  orders: readonly AssignedOrderSummary[],
): Promise<readonly PackingOrderRow[]> {
  const composed = await composeOrderRows(deps, companyId, orders);

  const packerIds = [
    ...new Set(orders.map((order) => order.packedBy).filter((id): id is string => id !== null)),
  ];
  const packerRefs =
    packerIds.length === 0
      ? []
      : await deps.people.findRefsIncludingDeletedInCompany(companyId, packerIds, deps.now?.() ?? new Date());
  const packerNames = new Map(packerRefs.map((ref) => [ref.id, ref.displayName] as const));

  return orders.map((order) => {
    const rowComposed = composed.get(order.id);
    return {
      id: order.id,
      numberText: formatOrderNumber(order.number),
      recipeName: rowComposed?.recipeName ?? null,
      quantity: order.quantity,
      presentationLines: rowComposed?.presentationLines ?? [],
      unitId: order.unitId,
      unitLabel: rowComposed?.unitLabel ?? null,
      status: order.status,
      packedByName: order.packedBy === null ? null : packerNames.get(order.packedBy) ?? order.packedBy,
      packedById: order.packedBy,
    };
  });
}

export type PackingFinishViewDeps = Pick<PackingOrderViewDeps, 'presentations' | 'units'> & {
  readonly packaging: Pick<PackagingCatalog, 'findRefs'>;
};

function toConversion(unit: UnitRef): UnitConversion {
  return { id: unit.id, baseUnitId: unit.baseUnitId, factor: unit.factor };
}

/** Parte entera no negativa de un disponible decimal, sin pasar por coma flotante. */
function wholePackages(available: string): number {
  const whole = Number(available.split('.')[0]);
  return Number.isFinite(whole) && whole > 0 ? whole : 0;
}

export async function composePackingFinishView(
  deps: PackingFinishViewDeps,
  companyId: string,
  order: AssignedOrderSummary,
): Promise<PackingFinishView | null> {
  if (order.unitId === null) return null;
  const lines = order.presentationLines;

  const presentationIds = [...new Set(lines.map((line) => line.presentationId))];
  const presentations =
    presentationIds.length === 0 ? [] : await deps.presentations.findRefs(presentationIds, companyId);
  const presentationById = new Map(presentations.map((ref) => [ref.id, ref] as const));

  const unitIds = [...new Set([order.unitId, ...presentations.map((ref) => ref.unitId)])];
  const unitById = new Map((await deps.units.findRefs(unitIds, companyId)).map((unit) => [unit.id, unit] as const));

  const packagingIds = [
    ...new Set(lines.map((line) => line.packagingProductId).filter((id): id is string => id !== null)),
  ];
  // Sin excluir ningun pedido: el libre descuenta todo lo apartado, tambien lo de este pedido.
  const packagingRefs = packagingIds.length === 0 ? [] : await deps.packaging.findRefs(packagingIds, companyId);
  const packagingById = new Map(packagingRefs.map((ref) => [ref.id, ref] as const));

  const orderUnit = unitById.get(order.unitId);
  if (orderUnit === undefined) return null;

  const finishLines: PackingFinishLineView[] = [];
  for (const line of lines) {
    const presentation = presentationById.get(line.presentationId);
    const unit = presentation === undefined ? undefined : unitById.get(presentation.unitId);
    if (presentation === undefined || unit === undefined) return null;

    const packagingId = line.packagingProductId;
    const packagingRef = packagingId === null ? undefined : packagingById.get(packagingId);
    finishLines.push({
      lineId: line.id,
      label: line.packagingName ?? presentation.name,
      plan: line.packages,
      content: line.presentationContent ?? presentation.content,
      unit: toConversion(unit),
      packaging:
        packagingId === null
          ? null
          : {
              productId: packagingId,
              name: packagingRef?.name ?? line.packagingName ?? presentation.name,
              freePackages: packagingRef === undefined ? 0 : wholePackages(packagingRef.available),
            },
    });
  }

  return {
    orderQuantity: order.quantity,
    orderUnit: toConversion(orderUnit),
    orderUnitLabel: unitLabelOf(orderUnit),
    lines: finishLines,
  };
}
