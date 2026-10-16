import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ValidationError } from './errors';
import { buildExecutionTrace, type TraceDuration } from './execution-trace';

import type { ExecutionTraceTeamMember } from './conditioning-trace';
import type { ExecutionEntryRecord } from './execution-entry';
import type { ConditioningTeamMemberRow, ConditioningTeamRepository } from '../ports/conditioning-team-repository';
import type { ExecutedOrdersFilter, ExecutionLogRepository } from '../ports/execution-log-repository';
import type { PeopleDirectory, PersonRef } from '@/lib/modules/identity';
import type { PresentationCatalog } from '@/lib/modules/inventario';
import {
  effectivePackages,
  formatOrderNumber,
  ORDER_STATUS_VALUES,
  remainingPackages,
  type OrderCatalog,
  type OrderDeliveryProgress,
  type OrderStatus,
  type Page,
} from '@/lib/modules/pedidos';
import type { RecipeCatalog, RecipeRef } from '@/lib/modules/recetas';

const MAX_ORDER_NUMBER_LENGTH = 20;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Una fecha civil `YYYY-MM-DD` que existe en el calendario: `2026-02-30` no pasa. */
const civilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((day) => {
    const parsed = new Date(`${day}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
  });

const listExecutionTracesSchema = z.strictObject({
  page: z.number().int().min(1).default(1),
  pageSize: z.union([z.literal(10), z.literal(25)]).default(10),
  // Un texto con letras no es invalido: no casa con ningun numero y deja la lista vacia.
  orderNumber: z
    .string()
    .trim()
    .max(MAX_ORDER_NUMBER_LENGTH)
    .optional()
    .transform((text) => (text === '' ? undefined : text)),
  userId: z.string().uuid().optional(),
  from: civilDateSchema.optional(),
  to: civilDateSchema.optional(),
  cancelledOnly: z.boolean().default(false),
});

export type ExecutionTraceListInput = z.input<typeof listExecutionTracesSchema>;

export type ExecutionTracePerson = { readonly userId: string; readonly displayName: string };

/** Envases de una presentacion del reparto: `label` es el nombre de la presentacion. */
export type ExecutionTracePresentation = {
  readonly label: string;
  readonly quantity: number;
};

export type ExecutionTraceRow = {
  readonly orderId: string;
  readonly numberText: string;
  readonly status: OrderStatus;
  readonly deleted: boolean;
  readonly active: boolean;
  /** Quien firma anotaciones y despues el equipo del Comenzar anotado, sin repetir. */
  readonly people: readonly ExecutionTracePerson[];
  readonly firstAt: Date;
  readonly lastAt: Date;
  readonly totalDuration: TraceDuration;
  readonly goBackCount: number;
  /** Nombre de la receta del pedido, tambien dada de baja; `null` si no vuelve del catalogo. */
  readonly formulaName: string | null;
  /** URL publica de la imagen de la receta (la de la original en una version); `null` = sin imagen. */
  readonly formulaImageUrl: string | null;
  /** Lo que pide el pedido: los envases planeados de cada linea, en el orden de alta. */
  readonly presentations: readonly ExecutionTracePresentation[];
  /** Lo que falta por entregar, mismo criterio que el sheet de entrega (contados al empacar menos
   *  lo entregado sin anular); solo lineas con algo pendiente. Vacio en un pedido ENTREGADO. */
  readonly pendingDelivery: readonly ExecutionTracePresentation[];
};

export type ExecutionTraceList = {
  readonly page: Page<ExecutionTraceRow>;
  readonly personOptions: readonly ExecutionTracePerson[];
};

export type ListExecutionTracesDeps = {
  readonly log: ExecutionLogRepository;
  readonly orders: OrderCatalog;
  readonly people: PeopleDirectory;
  readonly team: Pick<ConditioningTeamRepository, 'listByOrdersInCompany'>;
  readonly recipes: Pick<RecipeCatalog, 'findRefsIncludingDeleted'>;
  readonly presentations: Pick<PresentationCatalog, 'findRefs'>;
};

/** Receta y reparto de la pagina, cada catalogo una sola vez sin importar cuantas filas haya. */
type OrderContents = {
  readonly progress: ReadonlyMap<string, OrderDeliveryProgress>;
  readonly recipes: ReadonlyMap<string, RecipeRef>;
  readonly presentationNames: ReadonlyMap<string, string>;
};

async function listOrderContents(
  deps: ListExecutionTracesDeps,
  companyId: string,
  orderIds: readonly string[],
): Promise<OrderContents> {
  const progress = await deps.orders.listDeliveryProgressByIdsIncludingDeleted(companyId, orderIds);
  const recipeIds = [...new Set(progress.map((order) => order.recipeId))];
  const presentationIds = [
    ...new Set(progress.flatMap((order) => order.lines.map((line) => line.presentationId))),
  ];
  const [recipes, presentations] = await Promise.all([
    recipeIds.length === 0 ? [] : deps.recipes.findRefsIncludingDeleted(recipeIds, companyId),
    presentationIds.length === 0 ? [] : deps.presentations.findRefs(presentationIds, companyId),
  ]);
  return {
    progress: new Map(progress.map((order) => [order.id, order])),
    recipes: new Map(recipes.map((recipe) => [recipe.id, recipe])),
    presentationNames: new Map(presentations.map((presentation) => [presentation.id, presentation.name])),
  };
}

/** Una linea cuya presentacion no vuelve del catalogo se omite: se devuelve lo que hay. */
export function toTracePresentations(
  progress: OrderDeliveryProgress | undefined,
  status: OrderStatus,
  presentationNames: ReadonlyMap<string, string>,
): Pick<ExecutionTraceRow, 'presentations' | 'pendingDelivery'> {
  const presentations: ExecutionTracePresentation[] = [];
  const pendingDelivery: ExecutionTracePresentation[] = [];
  for (const line of progress?.lines ?? []) {
    const label = presentationNames.get(line.presentationId);
    if (label === undefined) continue;
    presentations.push({ label, quantity: line.packages });
    // Un ENTREGADO anterior a las entregas por linea no tiene nada anotado y ya no debe nada.
    if (status === 'ENTREGADO') continue;
    const pending = remainingPackages({
      presentationLineId: line.presentationId,
      orderedPackages: effectivePackages(line),
      deliveredPackages: line.deliveredPackages,
    });
    if (pending > 0) pendingDelivery.push({ label, quantity: pending });
  }
  return { presentations, pendingDelivery };
}

function startOfDayUtc(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** Dias UTC con los dos extremos inclusivos: `to` se convierte en el dia siguiente, exclusivo. */
function toExecutedOrdersFilter(input: {
  readonly userId?: string;
  readonly from?: string;
  readonly to?: string;
}): ExecutedOrdersFilter {
  return {
    ...(input.userId === undefined ? {} : { userId: input.userId }),
    ...(input.from === undefined ? {} : { occurredFrom: startOfDayUtc(input.from) }),
    ...(input.to === undefined
      ? {}
      : { occurredBefore: new Date(startOfDayUtc(input.to).getTime() + MILLISECONDS_PER_DAY) }),
  };
}

function emptyPage(page: number, pageSize: number): Page<ExecutionTraceRow> {
  return { items: [], total: 0, page, pageSize, totalPages: 1 };
}

/** Agrupa por pedido conservando el orden en que el registro devuelve las anotaciones. */
export function groupEntriesByOrder(
  entries: readonly ExecutionEntryRecord[],
): Map<string, ExecutionEntryRecord[]> {
  const byOrder = new Map<string, ExecutionEntryRecord[]>();
  for (const entry of entries) {
    const group = byOrder.get(entry.orderId);
    if (group === undefined) byOrder.set(entry.orderId, [entry]);
    else group.push(entry);
  }
  return byOrder;
}

export async function findPeopleByIds(
  people: PeopleDirectory,
  companyId: string,
  userIds: readonly string[],
  now: Date,
): Promise<Map<string, PersonRef>> {
  if (userIds.length === 0) return new Map();
  const refs = await people.findRefsIncludingDeletedInCompany(companyId, userIds, now);
  return new Map(refs.map((ref) => [ref.id, ref]));
}

/** Solo los pedidos con `conditioning_start` anotado: un equipo sin Comenzar no se muestra. */
export async function listConditioningTeams(
  team: ListExecutionTracesDeps['team'],
  companyId: string,
  entriesByOrder: ReadonlyMap<string, readonly ExecutionEntryRecord[]>,
): Promise<Map<string, ConditioningTeamMemberRow[]>> {
  const orderIds = [...entriesByOrder]
    .filter(([, entries]) => entries.some((entry) => entry.action === 'conditioning_start'))
    .map(([orderId]) => orderId);
  const byOrder = new Map<string, ConditioningTeamMemberRow[]>();
  if (orderIds.length === 0) return byOrder;
  for (const { orderId, ...member } of await team.listByOrdersInCompany(companyId, orderIds)) {
    const members = byOrder.get(orderId);
    if (members === undefined) byOrder.set(orderId, [member]);
    else members.push(member);
  }
  return byOrder;
}

export function toTraceTeamMember(
  member: ConditioningTeamMemberRow,
  refs: ReadonlyMap<string, PersonRef>,
): ExecutionTraceTeamMember {
  return {
    userId: member.userId,
    displayName: refs.get(member.userId)?.displayName ?? null,
    origin:
      member.workGroupId === null || member.workGroupName === null
        ? { kind: 'direct' }
        : { kind: 'workGroup', workGroupId: member.workGroupId, workGroupName: member.workGroupName },
  };
}

function toTraceFormula(
  contents: OrderContents,
  orderId: string,
): Pick<ExecutionTraceRow, 'formulaName' | 'formulaImageUrl'> {
  const recipeId = contents.progress.get(orderId)?.recipeId;
  const recipe = recipeId === undefined ? undefined : contents.recipes.get(recipeId);
  return { formulaName: recipe?.name ?? null, formulaImageUrl: recipe?.imageUrl ?? null };
}

async function listPersonOptions(
  deps: ListExecutionTracesDeps,
  companyId: string,
  now: Date,
): Promise<readonly ExecutionTracePerson[]> {
  const userIds = await deps.log.listUserIdsWithEntries(companyId);
  const refs = await findPeopleByIds(deps.people, companyId, userIds, now);
  return [...refs.values()]
    .map((ref) => ({ userId: ref.id, displayName: ref.displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es') || a.userId.localeCompare(b.userId));
}

export function createListExecutionTraces(
  deps: ListExecutionTracesDeps,
): (actor: Actor | null | undefined, input: unknown, now: Date) => Promise<ExecutionTraceList> {
  return async function listExecutionTraces(
    actor: Actor | null | undefined,
    input: unknown,
    now: Date,
  ): Promise<ExecutionTraceList> {
    // Autorizar va antes de validar la entrada y antes de tocar ningun puerto.
    requirePermission(actor, 'dashboard.consultar');

    const parsed = listExecutionTracesSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { page, pageSize, orderNumber, cancelledOnly } = parsed.data;
    const companyId = actor.companyId;

    const listPage = async (): Promise<Page<ExecutionTraceRow>> => {
      const orderIds = await deps.log.listExecutedOrderIds(companyId, toExecutedOrdersFilter(parsed.data));
      if (orderIds.length === 0) return emptyPage(page, pageSize);

      const ordersPage = await deps.orders.listSummariesByIdsIncludingDeleted(
        companyId,
        orderIds,
        cancelledOnly ? ['CANCELADO'] : ORDER_STATUS_VALUES,
        page,
        pageSize,
        orderNumber === undefined ? undefined : { numberContains: orderNumber },
      );
      if (ordersPage.items.length === 0) return { ...ordersPage, items: [] };

      const entries = await deps.log.listEntriesForOrders(
        companyId,
        ordersPage.items.map((order) => order.id),
      );
      const byOrder = groupEntriesByOrder(entries);

      const traces = ordersPage.items.flatMap((order) => {
        const orderEntries = byOrder.get(order.id);
        if (orderEntries === undefined) return [];
        return [{ order, trace: buildExecutionTrace(orderEntries, order, now) }];
      });

      const [teams, contents] = await Promise.all([
        listConditioningTeams(deps.team, companyId, byOrder),
        listOrderContents(
          deps,
          companyId,
          traces.map(({ order }) => order.id),
        ),
      ]);
      const peopleOf = new Map(
        traces.map(({ order, trace }) => [
          order.id,
          [...new Set([...trace.userIds, ...(teams.get(order.id) ?? []).map((member) => member.userId)])],
        ]),
      );
      const userIds = [...new Set([...peopleOf.values()].flat())];
      const refs = await findPeopleByIds(deps.people, companyId, userIds, now);

      const items: ExecutionTraceRow[] = traces.map(({ order, trace }) => ({
        orderId: order.id,
        numberText: formatOrderNumber(order.number),
        status: order.status,
        deleted: order.deleted,
        active: trace.active,
        people: (peopleOf.get(order.id) ?? []).flatMap((userId) => {
          const ref = refs.get(userId);
          return ref === undefined ? [] : [{ userId, displayName: ref.displayName }];
        }),
        firstAt: trace.firstAt,
        lastAt: trace.lastAt,
        totalDuration: trace.totalDuration,
        goBackCount: trace.goBackCount,
        ...toTraceFormula(contents, order.id),
        ...toTracePresentations(contents.progress.get(order.id), order.status, contents.presentationNames),
      }));

      return {
        items,
        total: ordersPage.total,
        page: ordersPage.page,
        pageSize: ordersPage.pageSize,
        totalPages: ordersPage.totalPages,
      };
    };

    const [pageResult, personOptions] = await Promise.all([
      listPage(),
      listPersonOptions(deps, companyId, now),
    ]);
    return { page: pageResult, personOptions };
  };
}
