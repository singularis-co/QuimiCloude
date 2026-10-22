import { requirePermission, type Actor } from './actor';
import { OrderNotFoundError } from './errors';
import { toOrderCustomer, type OrderCustomer } from './order-customer';
import { formatOrderNumber } from './order-number';
import type { OrderScope } from './order-scope';
import type { OrderRow, OrderView } from './order-view';

import type { CustomerCatalog } from '@/lib/modules/clientes';
import type { PackagingCatalog, PresentationCatalog, PresentationRef } from '@/lib/modules/inventario';
import type { RecipeCatalog, RecipeRef } from '@/lib/modules/recetas';
import type { UnitCatalog } from '@/lib/modules/unidades';

import type { OrderRepository } from '../ports/order-repository';

/**
 * La unidad vuelve al pedido: `units` VUELVE a ser una dependencia de este caso de uso,
 * porque `quantity` se interpreta siempre en `unitId` y la ficha muestra su etiqueta. Sigue sin
 * haber ningun `unitPrice` que costear aqui.
 */
export type GetOrderDeps = {
  readonly orders: OrderRepository;
  readonly recipes: RecipeCatalog;
  /** Contrato PUBLICO de `inventario`: resuelve los nombres de las presentaciones del reparto. */
  readonly presentations: PresentationCatalog;
  /** Contrato PUBLICO de `inventario`: resuelve los nombres de los envases del reparto. */
  readonly packaging: PackagingCatalog;
  /** Contrato PUBLICO de `unidades`: resuelve la etiqueta de `unitId`. */
  readonly units: UnitCatalog;
  /** Contrato PUBLICO de `clientes`: el nombre del cliente, aunque este dado de baja. */
  readonly customerCatalog: Pick<CustomerCatalog, 'findRefsIncludingDeleted'>;
};

/** El simbolo de la unidad, o su nombre si no lo tiene. Se exporta porque
 *  `list-orders.ts` la reutiliza para no divergir en el criterio. */
export function unitLabelOf(unit: { readonly name: string; readonly symbol: string | null }): string {
  return unit.symbol ?? unit.name;
}

/** Lo que la vista de una linea toma de su presentacion: el nombre, el contenido vigente y la
 *  etiqueta de la unidad en que se declara ese contenido (`null` si la unidad no volvio). */
export type OrderPresentationDisplay = {
  readonly name: string;
  readonly content: string | null;
  readonly unitLabel: string | null;
};

/**
 * Las presentaciones del catalogo listas para `toOrderView`: la etiqueta de la unidad sale del
 * mismo `unitLabels` que la del pedido, asi que quien llama lee las unidades del pedido Y las de
 * las presentaciones en UNA sola llamada (`presentationUnitIds`).
 */
export function toPresentationDisplays(
  presentations: readonly PresentationRef[],
  unitLabels: ReadonlyMap<string, string>,
): ReadonlyMap<string, OrderPresentationDisplay> {
  return new Map(
    presentations.map((presentation) => [
      presentation.id,
      { name: presentation.name, content: presentation.content, unitLabel: unitLabels.get(presentation.unitId) ?? null },
    ]),
  );
}

/** Los ids unicos de unidad de los pedidos y de sus presentaciones, para una sola llamada. */
export function orderAndPresentationUnitIds(
  rows: readonly Pick<OrderRow, 'unitId'>[],
  presentations: readonly Pick<PresentationRef, 'unitId'>[],
): string[] {
  return [
    ...new Set([
      ...rows.flatMap((row) => (row.unitId === null ? [] : [row.unitId])),
      ...presentations.map((presentation) => presentation.unitId),
    ]),
  ];
}

/** Los ids unicos de las presentaciones de todo el reparto de las filas, para resolverlos
 *  en una sola llamada al catalogo. */
export function orderPresentationIds(rows: readonly Pick<OrderRow, 'presentationLines'>[]): string[] {
  return [...new Set(rows.flatMap((row) => row.presentationLines.map((line) => line.presentationId)))];
}

/** Los ids unicos de los envases del reparto de las filas; las lineas antiguas no tienen. */
export function orderPackagingIds(rows: readonly Pick<OrderRow, 'presentationLines'>[]): string[] {
  return [
    ...new Set(
      rows.flatMap((row) =>
        row.presentationLines.flatMap((line) => (line.packagingProductId === null ? [] : [line.packagingProductId])),
      ),
    ),
  ];
}

/** Los clientes de las filas en una sola llamada, con los ids sin repetir; sin ninguno, no
 *  consulta. Los dados de baja vuelven marcados: el pedido conserva la referencia. */
export async function findOrderCustomers(
  customerCatalog: Pick<CustomerCatalog, 'findRefsIncludingDeleted'>,
  rows: readonly Pick<OrderRow, 'customerId'>[],
  companyId: string,
): Promise<ReadonlyMap<string, OrderCustomer>> {
  const ids = [...new Set(rows.flatMap((row) => (row.customerId === null ? [] : [row.customerId])))];
  if (ids.length === 0) return new Map();
  const refs = await customerCatalog.findRefsIncludingDeleted(ids, companyId);
  return new Map(refs.map((ref) => [ref.id, toOrderCustomer(ref)]));
}

export type PackagingInfo = { readonly name: string; readonly imageUrl: string | null };

/** Nombre e imagen de los envases; uno dado de baja o sin presentacion fija no vuelve. */
export async function findPackagingInfo(
  packaging: PackagingCatalog,
  ids: readonly string[],
  companyId: string,
): Promise<ReadonlyMap<string, PackagingInfo>> {
  if (ids.length === 0) return new Map();
  const refs = await packaging.findRefs(ids, companyId);
  return new Map(refs.map((ref) => [ref.id, { name: ref.name, imageUrl: ref.imageUrl ?? null }]));
}

/** Los nombres de los envases; uno dado de baja o sin presentacion fija no vuelve. */
export async function findPackagingNames(
  packaging: PackagingCatalog,
  ids: readonly string[],
  companyId: string,
): Promise<ReadonlyMap<string, string>> {
  const info = await findPackagingInfo(packaging, ids, companyId);
  return new Map([...info].map(([id, { name }]) => [id, name]));
}

/**
 * Compone la salida de una fila con los nombres ya resueltos (R42, R43, R44, R46).
 *
 * Vive aqui y lo IMPORTA `list-orders.ts` para que la ficha y el listado no puedan diverger:
 * `OrderSummary` es `OrderView` mas lo pendiente de entregar, y una segunda copia de este mapeo
 * seria el sitio exacto por donde empezarian a diferir.
 *
 * `recipeName` es `null` solo si el id NO vuelve del catalogo -una receta borrada FISICAMENTE
 * por consola, que las FK `RESTRICT` de QC-33 hacen casi imposible-: la fila SIGUE saliendo
 * (mismo criterio que QC-25 R18 y QC-43 R37). Una receta dada de BAJA si vuelve, con su nombre
 * (R44).
 *
 * `numberText` lo compone `formatOrderNumber`, la UNICA definicion del formato (R14): no se
 * persiste ni se vuelve a formatear en ningun otro sitio. Los dos autores salen como
 * IDENTIFICADORES (R46): este modulo no consulta el modelo `User`.
 */
export function toOrderView(
  row: OrderRow,
  recipes: ReadonlyMap<string, RecipeRef>,
  presentations: ReadonlyMap<string, OrderPresentationDisplay> = new Map(),
  unitLabels: ReadonlyMap<string, string> = new Map(),
  packagingNames: ReadonlyMap<string, string> = new Map(),
  orderCustomers: ReadonlyMap<string, OrderCustomer> = new Map(),
): OrderView {
  const recipe = recipes.get(row.recipeId);
  return {
    id: row.id,
    number: row.number,
    numberText: formatOrderNumber(row.number),
    recipeId: row.recipeId,
    recipeName: recipe?.name ?? null,
    recipeVersion:
      recipe?.original == null
        ? null
        : { originalId: recipe.original.id, originalName: recipe.original.name, versionName: recipe.ownName },
    // El catalogo ya resuelve la de la original para una version.
    recipeImageUrl: recipe?.imageUrl ?? null,
    quantity: row.quantity,
    priority: row.priority,
    status: row.status,
    // R29: el motivo se devuelve en la ficha Y en el listado mientras el pedido este
    // cancelado. Ningun caso de uso lo vacia ni lo sustituye.
    cancellationReason: row.cancellationReason,
    ingredientsCost: row.ingredientsCost,
    packagingCost: row.packagingCost,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    presentationLines: row.presentationLines.map((line) => {
      const presentation = presentations.get(line.presentationId);
      return {
        presentationId: line.presentationId,
        presentationName: presentation?.name ?? null,
        packages: line.packages,
        packagingProductId: line.packagingProductId,
        packagingName: line.packagingProductId === null ? null : packagingNames.get(line.packagingProductId) ?? null,
        // Mismo criterio que Terminar el empaque: la copia de la linea manda sobre la vigente.
        presentationContent: line.presentationContent ?? presentation?.content ?? null,
        presentationUnitLabel: presentation?.unitLabel ?? null,
      };
    }),
    unitId: row.unitId,
    // `null` si el pedido esta sin unidad; la FK con RESTRICT hace imposible el caso
    // «tiene id pero no vuelve del catalogo».
    unitLabel: row.unitId === null ? null : unitLabels.get(row.unitId) ?? null,
    // Un id que no vuelve del catalogo se pinta sin cliente y la fila sigue saliendo.
    customer: row.customerId === null ? null : orderCustomers.get(row.customerId) ?? null,
  };
}

/**
 * Ficha de un pedido (R42). Consultar exige `pedidos.consultar` (QC-74 R16): quien no lo tiene
 * ni siquiera lee, y el `requirePermission` va antes de tocar el repositorio y los catalogos
 * de recetas, presentaciones y unidades.
 */
export function createGetOrder(
  deps: GetOrderDeps,
): (id: string, actor: Actor | null | undefined) => Promise<OrderView> {
  return async function getOrder(
    id: string,
    actor: Actor | null | undefined,
  ): Promise<OrderView> {
    requirePermission(actor, 'pedidos.consultar');

    // La empresa sale del ACTOR y jamas de la entrada: nadie puede elegir consultar otra.
    const scope: OrderScope = { companyId: actor.companyId };

    // null = no existe o ya esta borrado: para el dominio son el mismo caso (R33), y el
    // filtro `deleted_at IS NULL` es del puerto, no de un `if` de aqui (R40).
    const row = await deps.orders.findAliveById(id, scope);
    if (row === null) throw new OrderNotFoundError();

    const recipes = await deps.recipes.findRefsIncludingDeleted([row.recipeId], actor.companyId);

    const presentationIds = orderPresentationIds([row]);
    const presentations =
      presentationIds.length === 0 ? [] : await deps.presentations.findRefs(presentationIds, actor.companyId);

    // La unidad del pedido y las de sus presentaciones, en una sola llamada.
    const unitIds = orderAndPresentationUnitIds([row], presentations);
    const units = unitIds.length === 0 ? [] : await deps.units.findRefs(unitIds, actor.companyId);
    const unitLabels = new Map(units.map((unit) => [unit.id, unitLabelOf(unit)]));
    const packagingNames = await findPackagingNames(deps.packaging, orderPackagingIds([row]), actor.companyId);
    const orderCustomers = await findOrderCustomers(deps.customerCatalog, [row], actor.companyId);

    return toOrderView(
      row,
      new Map(recipes.map((recipe) => [recipe.id, recipe])),
      toPresentationDisplays(presentations, unitLabels),
      unitLabels,
      packagingNames,
      orderCustomers,
    );
  };
}
