import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ValidationError } from './errors';
import {
  buildExecutionTrace,
  combineDurations,
  FINAL_STATUSES,
  type ExecutionTrace,
  type TraceDuration,
} from './execution-trace';
import { readRecipeOutlines } from './recipe-of-order';

import type { ExecutionTraceTeamMember } from './conditioning-trace';
import type { ExecutionEntryRecord } from './execution-entry';
import type { ConditioningTeamMemberRow, ConditioningTeamRepository } from '../ports/conditioning-team-repository';
import type { ExecutedOrdersFilter, ExecutionLogRepository } from '../ports/execution-log-repository';
import type { PeopleDirectory, PersonRef } from '@/lib/modules/identity';
import type { PresentationCatalog } from '@/lib/modules/inventario';
import {
  formatOrderNumber,
  ORDER_STATUS_VALUES,
  type OrderCatalog,
  type OrderHistorySummary,
  type OrderProgress,
  type OrderRecipeOutline,
  type OrderRecipesOutline,
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

export type ExecutionTraceRowRecipe = {
  /** `null` = la receta no vuelve del catalogo. */
  readonly recipeName: string | null;
  readonly presentations: readonly ExecutionTracePresentation[];
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
  /** La suma de las recetas: abierta si alguna lo esta. */
  readonly totalDuration: TraceDuration;
  readonly goBackCount: number;
  /** La primera receta en orden de alta, tambien dada de baja; `null` si no vuelve del catalogo. */
  readonly formulaName: string | null;
  /** URL publica de la imagen de esa receta (la de la original en una version); `null` = sin imagen. */
  readonly formulaImageUrl: string | null;
  /** Recetas del pedido ademas de la primera, canceladas incluidas. */
  readonly moreRecipes: number;
  readonly progress: OrderProgress;
  /** Lo que pide cada receta, en orden de alta, sin mezclar envases de recetas distintas. */
  readonly recipes: readonly ExecutionTraceRowRecipe[];
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

/** Sin outline no hay recetas que contar. */
export const NO_PROGRESS: OrderProgress = { total: 0, finished: 0 };

/** Recetas y reparto de la pagina, cada catalogo una sola vez sin importar cuantas filas haya. */
export type OrderContents = {
  readonly outlines: ReadonlyMap<string, OrderRecipesOutline>;
  readonly recipes: ReadonlyMap<string, RecipeRef>;
  readonly presentationNames: ReadonlyMap<string, string>;
};

export async function listOrderContents(
  deps: Pick<ListExecutionTracesDeps, 'orders' | 'recipes' | 'presentations'>,
  companyId: string,
  orderIds: readonly string[],
): Promise<OrderContents> {
  const outlines = await readRecipeOutlines(deps.orders, companyId, orderIds);
  const recipesOfPage = [...outlines.values()].flatMap((outline) => outline.recipes);
  const recipeIds = [...new Set(recipesOfPage.map((recipe) => recipe.recipeId))];
  const presentationIds = [
    ...new Set(recipesOfPage.flatMap((recipe) => recipe.presentationLines.map((line) => line.presentationId))),
  ];
  const [recipes, presentations] = await Promise.all([
    recipeIds.length === 0 ? [] : deps.recipes.findRefsIncludingDeleted(recipeIds, companyId),
    presentationIds.length === 0 ? [] : deps.presentations.findRefs(presentationIds, companyId),
  ]);
  return {
    outlines,
    recipes: new Map(recipes.map((recipe) => [recipe.id, recipe])),
    presentationNames: new Map(presentations.map((presentation) => [presentation.id, presentation.name])),
  };
}

/** En orden de alta. */
export function recipesInOrder(outline: OrderRecipesOutline | undefined): readonly OrderRecipeOutline[] {
  return [...(outline?.recipes ?? [])].sort((a, b) => a.position - b.position);
}

/** Una linea cuya presentacion no vuelve del catalogo se omite: se devuelve lo que hay. */
export function toTracePresentations(
  presentationLines: OrderRecipeOutline['presentationLines'],
  presentationNames: ReadonlyMap<string, string>,
): readonly ExecutionTracePresentation[] {
  const presentations: ExecutionTracePresentation[] = [];
  for (const line of presentationLines) {
    const label = presentationNames.get(line.presentationId);
    if (label === undefined) continue;
    presentations.push({ label, quantity: line.packages });
  }
  return presentations;
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

function groupEntriesBy(
  entries: readonly ExecutionEntryRecord[],
  keyOf: (entry: ExecutionEntryRecord) => string,
): Map<string, ExecutionEntryRecord[]> {
  const groups = new Map<string, ExecutionEntryRecord[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [entry]);
    else group.push(entry);
  }
  return groups;
}

/** Agrupa por pedido conservando el orden en que el registro devuelve las anotaciones. */
export function groupEntriesByOrder(
  entries: readonly ExecutionEntryRecord[],
): Map<string, ExecutionEntryRecord[]> {
  return groupEntriesBy(entries, (entry) => entry.orderId);
}

/** Agrupa por linea del pedido conservando el orden del registro. */
export function groupEntriesByLine(
  entries: readonly ExecutionEntryRecord[],
): Map<string, ExecutionEntryRecord[]> {
  return groupEntriesBy(entries, (entry) => entry.orderLineId);
}

export type RecipeTrace = { readonly lineId: string; readonly trace: ExecutionTrace };

/**
 * Un recorrido por receta, medido con el estado de su linea: un pedido `PARCIAL` no esta en
 * ninguna fase, sus recetas si. Una linea que el outline no trae se mide con el estado del pedido
 * y va al final.
 */
export function traceRecipes(
  orderEntries: readonly ExecutionEntryRecord[],
  order: Pick<OrderHistorySummary, 'status' | 'deleted'>,
  outline: OrderRecipesOutline | undefined,
  now: Date,
): readonly RecipeTrace[] {
  const recipeOf = new Map((outline?.recipes ?? []).map((recipe) => [recipe.lineId, recipe]));
  const positionOf = (lineId: string): number => recipeOf.get(lineId)?.position ?? Number.POSITIVE_INFINITY;
  return [...groupEntriesByLine(orderEntries)]
    .map(([lineId, lineEntries]) => ({
      lineId,
      trace: buildExecutionTrace(
        lineEntries,
        { status: recipeOf.get(lineId)?.status ?? order.status, deleted: order.deleted },
        now,
      ),
    }))
    .sort((a, b) => positionOf(a.lineId) - positionOf(b.lineId));
}

export function isOrderActive(order: Pick<OrderHistorySummary, 'status' | 'deleted'>): boolean {
  return !order.deleted && !FINAL_STATUSES.includes(order.status);
}

/** Primera y ultima anotacion del pedido (al menos una), sin suponer el orden en que llegan. */
export function entriesSpan(entries: readonly ExecutionEntryRecord[]): { firstAt: Date; lastAt: Date } {
  const times = entries.map((entry) => entry.occurredAt.getTime());
  return { firstAt: new Date(Math.min(...times)), lastAt: new Date(Math.max(...times)) };
}

/** Quien firma, en el orden del registro y sin repetir. */
export function signerIds(entries: readonly ExecutionEntryRecord[]): readonly string[] {
  return [...new Set(entries.map((entry) => entry.userId))];
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

/**
 * El equipo de cada linea, por `lineId`. Solo las lineas con `conditioning_start` anotado: un
 * equipo sin Comenzar no se muestra.
 */
export async function listConditioningTeams(
  team: ListExecutionTracesDeps['team'],
  companyId: string,
  entries: readonly ExecutionEntryRecord[],
): Promise<Map<string, ConditioningTeamMemberRow[]>> {
  const starts = entries.filter((entry) => entry.action === 'conditioning_start');
  const startedLines = new Set(starts.map((entry) => entry.orderLineId));
  const orderIds = [...new Set(starts.map((entry) => entry.orderId))];
  const byLine = new Map<string, ConditioningTeamMemberRow[]>();
  if (orderIds.length === 0) return byLine;
  for (const row of await team.listByOrdersInCompany(companyId, orderIds)) {
    if (!startedLines.has(row.orderLineId)) continue;
    const member: ConditioningTeamMemberRow = {
      userId: row.userId,
      workGroupId: row.workGroupId,
      workGroupName: row.workGroupName,
    };
    const members = byLine.get(row.orderLineId);
    if (members === undefined) byLine.set(row.orderLineId, [member]);
    else members.push(member);
  }
  return byLine;
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

function toRowRecipes(
  contents: OrderContents,
  orderId: string,
): Pick<ExecutionTraceRow, 'formulaName' | 'formulaImageUrl' | 'moreRecipes' | 'progress' | 'recipes'> {
  const outline = contents.outlines.get(orderId);
  const recipes = recipesInOrder(outline);
  const first = recipes[0] === undefined ? undefined : contents.recipes.get(recipes[0].recipeId);
  return {
    formulaName: first?.name ?? null,
    formulaImageUrl: first?.imageUrl ?? null,
    moreRecipes: Math.max(recipes.length - 1, 0),
    progress: outline?.progress ?? NO_PROGRESS,
    recipes: recipes.map((recipe) => ({
      recipeName: contents.recipes.get(recipe.recipeId)?.name ?? null,
      presentations: toTracePresentations(recipe.presentationLines, contents.presentationNames),
    })),
  };
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
      const executed = ordersPage.items.flatMap((order) => {
        const orderEntries = byOrder.get(order.id);
        return orderEntries === undefined ? [] : [{ order, orderEntries }];
      });

      const [teams, contents] = await Promise.all([
        listConditioningTeams(deps.team, companyId, entries),
        listOrderContents(
          deps,
          companyId,
          executed.map(({ order }) => order.id),
        ),
      ]);
      const traces = executed.map(({ order, orderEntries }) => ({
        order,
        orderEntries,
        recipes: traceRecipes(orderEntries, order, contents.outlines.get(order.id), now),
      }));
      const peopleOf = new Map(
        traces.map(({ order, orderEntries, recipes }) => [
          order.id,
          [
            ...new Set([
              ...signerIds(orderEntries),
              ...recipes.flatMap(({ lineId }) => (teams.get(lineId) ?? []).map((member) => member.userId)),
            ]),
          ],
        ]),
      );
      const userIds = [...new Set([...peopleOf.values()].flat())];
      const refs = await findPeopleByIds(deps.people, companyId, userIds, now);

      const items: ExecutionTraceRow[] = traces.map(({ order, orderEntries, recipes }) => ({
        orderId: order.id,
        numberText: formatOrderNumber(order.number),
        status: order.status,
        deleted: order.deleted,
        active: isOrderActive(order),
        people: (peopleOf.get(order.id) ?? []).flatMap((userId) => {
          const ref = refs.get(userId);
          return ref === undefined ? [] : [{ userId, displayName: ref.displayName }];
        }),
        ...entriesSpan(orderEntries),
        totalDuration: combineDurations(recipes.map(({ trace }) => trace.totalDuration)),
        goBackCount: recipes.reduce((sum, { trace }) => sum + trace.goBackCount, 0),
        ...toRowRecipes(contents, order.id),
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
