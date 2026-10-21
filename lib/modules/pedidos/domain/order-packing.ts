// lib/modules/pedidos/domain/order-packing.ts
//
// `createStartPacking` implementa `OrderCatalog['startPackingAliveById']` sobre
// `OrderPackingRepository`: un `UPDATE` condicional fuera de la unidad de trabajo compartida con
// `inventario`, sin tocar material ni producto terminado.
//
// `createFinishPacking` implementa `OrderCatalog['finishPackingAliveById']` (Terminar):
// abre `OrderUnitOfWork`, mueve el estado con `OrderWriteRepository.finishPackingAlive`, guarda
// el conteo real y los envases libres de cada linea, liquida los envases con ese conteo y da de
// alta, por cada linea con envases, un lote de producto terminado con un unico coste por unidad
// del pedido, expresado en la unidad de cada lote; todo en la MISMA transaccion. `asignaciones`
// solo conoce la firma de `OrderCatalog`, nunca este archivo.

import { planFinishedGoodsLine } from '@/lib/modules/inventario';
import { convertQuantity, type UnitConversion } from '@/lib/modules/unidades';

import {
  IncompatibleUnitsError,
  InsufficientMaterialError,
  OrderWithoutUnitError,
  PresentationWithoutContentError,
  RecipeNotFoundError,
} from './errors';
import { sumInOrderUnit } from './order-distribution';
import { buildOrderRequirement, packagingLinesOf } from './order-requirement';
import { checkPackingCounts, packingSurplusByLine, type PackedLineCount } from './packing-count';
import { resolveLotCost } from './resolve-ingredients-cost';
import { assertTransition } from './order-transitions';

import type { FinishedGoodsReceipt, OrderCatalog } from './order-catalog';

import type { OrderPackingRepository } from '../ports/order-packing-repository';
import type { FinishPackingLine, RecordedPackedLine } from '../ports/order-write-repository';
import type { OrderTransactionScope, OrderUnitOfWork } from '../ports/order-unit-of-work';

import type { PackagingCatalog, PresentationCatalog, ProductCatalog } from '@/lib/modules/inventario';
import type { RecipeCatalog } from '@/lib/modules/recetas';
import type { UnitCatalog } from '@/lib/modules/unidades';

export type StartPackingDeps = {
  readonly packing: OrderPackingRepository;
};

export type FinishPackingDeps = {
  readonly packing: OrderPackingRepository;
  readonly unitOfWork: OrderUnitOfWork;
  /** Nombre de la receta y coste del lote cuando el pedido no tiene importe guardado: las dos
   *  lecturas van por los catalogos publicos, sobre el cliente global -la misma foto que veria
   *  una edicion en ese instante-, nunca sobre `scope.recipes`. Mismo criterio que tenia
   *  `transition-order.ts` cuando Finalizar daba de alta el lote. */
  readonly recipes: RecipeCatalog;
  readonly products: ProductCatalog;
  readonly units: UnitCatalog;
  /** La unidad de cada presentacion, para repartir el coste en la unidad del pedido, y el
   *  contenido vigente con el que rescatar una linea sin contenido copiado. Lectura global,
   *  fuera de la transaccion, igual que `recipes`/`products`. */
  readonly presentations: Pick<PresentationCatalog, 'findRefs'>;
  /** El costo de los envases del reparto, para el lote sin importe guardado. */
  readonly packaging: PackagingCatalog;
};

/** Firma exacta de `OrderCatalog['startPackingAliveById']`. `'without_distribution'` sale
 *  tal cual del puerto: este dominio no distingue ese caso de los demas, solo delega. */
export function createStartPacking(deps: StartPackingDeps): OrderCatalog['startPackingAliveById'] {
  return async function startPackingAliveById(id, companyId, packerId, now) {
    // La unica transicion que alcanza este metodo: falla rapido si algun dia dejara de ser legal.
    assertTransition('POR_EMPACAR', 'EN_EMPAQUE');
    return deps.packing.startPackingAlive(id, packerId, now, { companyId });
  };
}

type ResolvedLine = {
  readonly line: FinishPackingLine;
  readonly content: string;
  readonly unitId: string;
  readonly packedPackages: number;
};

type RejectedFinish = 'invalid_packing_count' | 'packaging_stock_insufficient';

/** Rechazo tras mover el estado: se lanza para que la unidad de trabajo deshaga el `UPDATE`. */
class FinishPackingRejectedSignal extends Error {
  constructor(readonly outcome: RejectedFinish) {
    super(outcome);
  }
}

/** `checkPackingCounts` ya exigio un conteo por linea: si falta, el flujo esta roto. */
function requirePacked(packedById: ReadonlyMap<string, number>, lineId: string): number {
  const packed = packedById.get(lineId);
  if (packed === undefined) throw new Error(`finishPacking: la linea ${lineId} no tiene conteo`);
  return packed;
}

/** Cada linea con su contenido -el copiado o, si falta, el vigente de la presentacion- y la
 *  unidad de su presentacion. Una linea sin ninguno de los dos contenidos deshace todo. */
async function resolveLines(
  presentations: Pick<PresentationCatalog, 'findRefs'>,
  companyId: string,
  lines: readonly FinishPackingLine[],
  packedById: ReadonlyMap<string, number>,
): Promise<readonly ResolvedLine[]> {
  const presentationIds = [...new Set(lines.map((line) => line.presentationId))];
  const refById = new Map((await presentations.findRefs(presentationIds, companyId)).map((ref) => [ref.id, ref] as const));

  return lines.map((line) => {
    const ref = refById.get(line.presentationId);
    // La clave foranea de la linea garantiza la presentacion: si falta, la base esta rota.
    if (ref === undefined) throw new Error(`finishPacking: la presentacion ${line.presentationId} no aparece`);
    const content = line.presentationContent ?? ref.content;
    if (content === null) throw new PresentationWithoutContentError(line.id);
    const plan = planFinishedGoodsLine({ packages: line.packages, content, unitCost: '0.0000' });
    if (plan.kind === 'no_content') throw new PresentationWithoutContentError(line.id);
    return { line, content, unitId: ref.unitId, packedPackages: requirePacked(packedById, line.id) };
  });
}

const COST_SCALE = 4;
const UNSIGNED_DECIMAL = /^\d+(?:\.\d+)?$/;

function parseUnsigned(raw: string): { readonly unscaled: bigint; readonly scale: number } {
  if (!UNSIGNED_DECIMAL.test(raw)) throw new Error(`finishPacking: no es un decimal valido: ${JSON.stringify(raw)}`);
  const [whole = '', fraction = ''] = raw.split('.');
  return { unscaled: BigInt(`${whole}${fraction}`), scale: fraction.length };
}

/**
 * `totalCost / quantity` con cuatro decimales, mitad arriba, sin pasar por coma flotante. No
 * usa `deriveUnitCost` porque la cantidad convertida puede traer hasta doce decimales y esa
 * funcion solo acepta los cuatro de `decimal(14,4)`. Cantidad cero o coste que redondea a cero
 * dan `'0.0000'`, el coste que ya aceptaba un lote de producto terminado.
 */
function divideCost(totalCost: string, quantity: string): string {
  const cost = parseUnsigned(totalCost);
  const amount = parseUnsigned(quantity);
  if (amount.unscaled === BigInt(0)) return '0.0000';

  const ten = BigInt(10);
  const numerator = cost.unscaled * ten ** BigInt(amount.scale + COST_SCALE);
  const denominator = amount.unscaled * ten ** BigInt(cost.scale);
  const quotient = numerator / denominator;
  const rounded = (numerator % denominator) * BigInt(2) >= denominator ? quotient + BigInt(1) : quotient;

  const factor = ten ** BigInt(COST_SCALE);
  return `${rounded / factor}.${(rounded % factor).toString().padStart(COST_SCALE, '0')}`;
}

/** Las claves foraneas de pedido y presentacion garantizan la unidad: si falta, la base esta rota. */
function requireUnit(unitById: ReadonlyMap<string, UnitConversion>, unitId: string): UnitConversion {
  const unit = unitById.get(unitId);
  if (unit === undefined) throw new Error(`finishPacking: la unidad ${unitId} no aparece`);
  return unit;
}

function toDistributionLines(unitById: ReadonlyMap<string, UnitConversion>, lines: readonly ResolvedLine[]) {
  return lines.map(({ line, content, unitId, packedPackages }) => ({
    presentationId: line.presentationId,
    packages: packedPackages,
    content,
    unit: requireUnit(unitById, unitId),
  }));
}

/** Los envases libres de cada linea por `lineId`. Lo envasado puede superar la cantidad sin
 *  tope; solo deshace una linea que no se puede sumar en la unidad del pedido. */
function resolveSurplus(
  quantity: string,
  orderUnit: UnitConversion,
  unitById: ReadonlyMap<string, UnitConversion>,
  lines: readonly ResolvedLine[],
): ReadonlyMap<string, number> {
  const result = packingSurplusByLine(
    quantity,
    orderUnit,
    lines.map(({ line, content, unitId, packedPackages }) => ({
      lineId: line.id,
      presentationId: line.presentationId,
      packedPackages,
      content,
      unit: requireUnit(unitById, unitId),
      plan: line.packages,
    })),
  );
  if (result.kind === 'incompatible_units') throw new IncompatibleUnitsError(result.presentationId);
  if (result.kind === 'presentation_without_content') throw new PresentationWithoutContentError(result.presentationId);
  return result.byLine;
}

function withSurplus(counts: readonly PackedLineCount[], surplusById: ReadonlyMap<string, number>): readonly RecordedPackedLine[] {
  return counts.map((count) => ({ ...count, packedSurplusPackages: surplusById.get(count.lineId) ?? 0 }));
}

/**
 * Coste unitario por cada unidad de presentacion del reparto. El total producido se suma en la
 * unidad del pedido para que el coste por unidad del pedido sea uno solo; despues se expresa en
 * la unidad de cada lote, porque su existencia se guarda en esa unidad y su valor es
 * `existencia x coste unitario`. Una sola division por unidad: un lote en la unidad del pedido
 * lleva exactamente `lotCost / total`.
 */
function unitCostByPresentationUnit(
  lotCost: string,
  orderUnit: UnitConversion,
  unitById: ReadonlyMap<string, UnitConversion>,
  lines: readonly ResolvedLine[],
): ReadonlyMap<string, string> {
  const summed = sumInOrderUnit(
    orderUnit,
    toDistributionLines(unitById, lines),
  );
  if (summed.kind === 'incompatible_units') throw new IncompatibleUnitsError(summed.presentationId);
  if (summed.kind === 'presentation_without_content') throw new PresentationWithoutContentError(summed.presentationId);

  const costs = new Map<string, string>();
  for (const unitId of new Set(lines.map((line) => line.unitId))) {
    const totalInLotUnit =
      unitId === orderUnit.id ? summed.total : convertQuantity(summed.total, orderUnit, requireUnit(unitById, unitId));
    costs.set(unitId, divideCost(lotCost, totalInLotUnit));
  }
  return costs;
}

/** La necesidad de envases de unas lineas, una por producto, con la cantidad ya sumada. */
function packagingRequirementOf(
  quantity: string,
  lines: readonly { readonly packagingProductId: string | null; readonly packages: number }[],
) {
  const requirement = buildOrderRequirement({
    recipeLines: [],
    quantity,
    packagingLines: packagingLinesOf(lines),
    phase: 'materials_consumed',
    // Sin receta no hay ninguna linea que convertir: las unidades no se leen.
    units: { orderUnitId: null, orderUnit: null, bridge: null, productUnits: new Map() },
  });
  if (requirement.kind !== 'ok') {
    throw new Error('finishPacking: los envases no se convierten y aun asi la necesidad no salio ok');
  }
  return requirement.lines;
}

/**
 * Liquida los envases con el conteo real. Un envase que es tambien ingrediente ya se consumio con
 * la receta al pasar a POR_EMPACAR: de el solo se consume lo que siga apartado, nunca su
 * disponible, y por eso no entra en la liquidacion con el conteo.
 */
async function settlePackaging(
  scope: OrderTransactionScope,
  input: {
    readonly orderId: string;
    readonly companyId: string;
    readonly recipeId: string;
    readonly quantity: string;
    readonly lines: readonly ResolvedLine[];
    readonly actorId: string;
    readonly now: Date;
  },
): Promise<void> {
  const real = packagingRequirementOf(
    input.quantity,
    input.lines.map(({ line, packedPackages }) => ({ packagingProductId: line.packagingProductId, packages: packedPackages })),
  );
  if (real.length === 0) return;

  const content = await scope.recipes.findExecutionContentById(input.recipeId, input.companyId);
  if (content === null) throw new RecipeNotFoundError();
  const ingredientIds = new Set(content.lines.map((line) => line.productId));

  const settled = real.filter((line) => !ingredientIds.has(line.productId));
  if (settled.length > 0) {
    const outcome = await scope.reservations.settlePackagingForOrder({
      orderId: input.orderId,
      companyId: input.companyId,
      requirement: settled,
      actorId: input.actorId,
      now: input.now,
    });
    if (outcome.kind === 'insufficient') throw new FinishPackingRejectedSignal('packaging_stock_insufficient');
  }

  const ingredientPackaging = real.filter((line) => ingredientIds.has(line.productId)).map((line) => line.productId);
  if (ingredientPackaging.length > 0) {
    const consumption = await scope.reservations.consumeForOrder({
      orderId: input.orderId,
      companyId: input.companyId,
      fallbackRequirement: [],
      productIds: ingredientPackaging,
      actorId: input.actorId,
      now: input.now,
    });
    if (consumption.kind === 'insufficient') throw new InsufficientMaterialError();
  }
}

function packedByLineId(counts: readonly PackedLineCount[]): ReadonlyMap<string, number> {
  return new Map(counts.map((count) => [count.lineId, count.packedPackages] as const));
}

/** Firma exacta de `OrderCatalog['finishPackingAliveById']`. */
export function createFinishPacking(deps: FinishPackingDeps): OrderCatalog['finishPackingAliveById'] {
  return async function finishPackingAliveById(id, companyId, packerId, now, counts) {
    assertTransition('EN_EMPAQUE', 'POR_ACONDICIONAR');

    try {
      return await deps.unitOfWork.run(async (scope) => {
        const updated = await scope.orders.finishPackingAlive(id, packerId, now, { companyId });
        if (updated.kind !== 'ok') return updated.kind;

        const lines = await scope.orders.findPresentationLinesForFinish(id, { companyId });
        if (checkPackingCounts(lines, counts).kind !== 'ok') {
          throw new FinishPackingRejectedSignal('invalid_packing_count');
        }
        if (lines.length === 0) return { kind: 'ok' as const, finishedGoods: [] };

        if (updated.unitId === null) throw new OrderWithoutUnitError(id);
        const resolvedLines = await resolveLines(deps.presentations, companyId, lines, packedByLineId(counts));
        const unitIds = [...new Set([updated.unitId, ...resolvedLines.map((line) => line.unitId)])];
        const unitById = new Map((await deps.units.findRefs(unitIds, companyId)).map((ref) => [ref.id, ref] as const));
        const orderUnit = requireUnit(unitById, updated.unitId);
        const surplusById = resolveSurplus(updated.quantity, orderUnit, unitById, resolvedLines);

        await scope.orders.recordPackedCounts(id, withSurplus(counts, surplusById), { companyId });

        await settlePackaging(scope, {
          orderId: id,
          companyId,
          recipeId: updated.recipeId,
          quantity: updated.quantity,
          lines: resolvedLines,
          actorId: packerId,
          now,
        });

        const [recipeRef] = await deps.recipes.findRefsIncludingDeleted([updated.recipeId], companyId);
        if (recipeRef === undefined) throw new RecipeNotFoundError();

        // El coste del pedido sale del plan, envases incluidos: el conteo real solo cambia entre
        // cuantas unidades se reparte.
        const lotCost =
          updated.ingredientsCost !== null
            ? updated.ingredientsCost
            : await resolveLotCost(
                deps,
                updated.recipeId,
                updated.quantity,
                updated.unitId,
                packagingLinesOf(lines),
                companyId,
                { orderId: id },
              );

        const packedLines = resolvedLines.filter((line) => line.packedPackages > 0);
        if (packedLines.length === 0) return { kind: 'ok' as const, finishedGoods: [] };
        const unitCosts = unitCostByPresentationUnit(lotCost, orderUnit, unitById, resolvedLines);

        const finishedGoods: FinishedGoodsReceipt[] = [];
        for (const { line, content, unitId, packedPackages } of packedLines) {
          const outcome = await scope.finishedGoods.receiveFromOrder({
            orderId: id,
            companyId,
            recipeId: updated.recipeId,
            recipeName: recipeRef.name,
            presentationId: line.presentationId,
            orderPresentationLineId: line.id,
            packages: packedPackages,
            orderContent: content,
            unitCost: unitCosts.get(unitId) ?? '0.0000',
            actorId: packerId,
            now,
          });

          if (outcome.kind === 'presentation_without_content') {
            throw new PresentationWithoutContentError(line.id);
          }
          finishedGoods.push({ productName: outcome.productName, packages: outcome.packages });
        }

        return { kind: 'ok' as const, finishedGoods };
      });
    } catch (err) {
      if (err instanceof FinishPackingRejectedSignal) return err.outcome;
      if (err instanceof InsufficientMaterialError) return 'insufficient_material';
      if (err instanceof RecipeNotFoundError) return 'recipe_not_found';
      if (err instanceof PresentationWithoutContentError) return 'presentation_without_content';
      if (err instanceof IncompatibleUnitsError) return 'incompatible_units';
      if (err instanceof OrderWithoutUnitError) return 'order_without_unit';
      throw err;
    }
  };
}
