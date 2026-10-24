import type { PresentationCatalog } from '@/lib/modules/inventario';
import {
  ORDER_STATUSES_NOT_IN_PROGRESS,
  type CustomerOrderDirectory,
  type OrderCatalog,
  type OrderDeliveryProgress,
} from '@/lib/modules/pedidos';
import type { RecipeCatalog } from '@/lib/modules/recetas';

import { requireReadPermission, type Actor } from './actor';
import { ValidationError, WhatsappOrderNotFoundError } from './errors';
import { resolveChatCustomer, type ChatCustomerDeps } from './get-whatsapp-chat';
import { scopeOf } from './integraciones-scope';
import {
  contextValuesOf,
  customerOrderOf,
  isOpenCustomerOrder,
  type OpenCustomerOrderSummary,
  type WhatsappChatContext,
  type WhatsappCustomerOrder,
} from './whatsapp-chat-context';
import { customerNameOf } from './whatsapp-conversation';
import { CUSTOMER_ORDERS_LIMIT, getWhatsappChatContextSchema } from './whatsapp-conversation-input';

import type { CompanyNameLookup } from '../ports/company-name-lookup';
import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappVariableKeyRepository } from '../ports/whatsapp-variable-key-repository';

export type GetWhatsappChatContextDeps = ChatCustomerDeps & {
  readonly connections: Pick<WhatsappConnectionRepository, 'findLive'>;
  readonly customerOrders: Pick<CustomerOrderDirectory, 'listAliveOfCustomer'>;
  readonly deliveryProgress: Pick<OrderCatalog, 'listDeliveryProgressByIdsIncludingDeleted'>;
  readonly presentations: Pick<PresentationCatalog, 'findRefs'>;
  readonly recipes: Pick<RecipeCatalog, 'findRefsIncludingDeleted'>;
  readonly companyName: CompanyNameLookup;
  readonly variableKeys: Pick<WhatsappVariableKeyRepository, 'listAll'>;
};

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function namesById(refs: readonly { readonly id: string; readonly name: string }[]): ReadonlyMap<string, { readonly name: string }> {
  return new Map(refs.map((ref) => [ref.id, { name: ref.name }]));
}

/** Una lectura por lote de cada catálogo para todos los pedidos, nunca una por pedido. */
async function customerOrdersOf(
  deps: GetWhatsappChatContextDeps,
  summaries: readonly OpenCustomerOrderSummary[],
  companyId: string,
): Promise<readonly WhatsappCustomerOrder[]> {
  if (summaries.length === 0) return [];
  const progress = await deps.deliveryProgress.listDeliveryProgressByIdsIncludingDeleted(
    companyId,
    summaries.map((summary) => summary.id),
  );
  const progressById = new Map<string, OrderDeliveryProgress>(progress.map((entry) => [entry.id, entry]));
  const presentationIds = unique(progress.flatMap((entry) => entry.lines.map((line) => line.presentationId)));
  const recipeIds = unique(summaries.map((summary) => summary.recipeId));
  const [presentations, recipes] = await Promise.all([
    deps.presentations.findRefs(presentationIds, companyId),
    deps.recipes.findRefsIncludingDeleted(recipeIds, companyId),
  ]);
  const presentationNames = namesById(presentations);
  const recipeNames = namesById(recipes);
  return summaries.map((summary) =>
    customerOrderOf(summary, progressById.get(summary.id) ?? null, presentationNames, recipeNames),
  );
}

/**
 * Solo lee: no mueve la marca de lectura ni toca la conexión. Basta el permiso de leer WhatsApp;
 * los pedidos llegan por el contrato de `pedidos`, sin actor.
 */
export function createGetWhatsappChatContext(
  deps: GetWhatsappChatContextDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<WhatsappChatContext> {
  return async function getWhatsappChatContext(input, actor) {
    requireReadPermission(actor);
    const scope = scopeOf(actor);

    const parsed = getWhatsappChatContextSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { target, orderId } = parsed.data;

    // Por cliente no se mira la conexión: sin WhatsApp conectado el contexto sigue disponible.
    const connection = 'contactId' in target ? await deps.connections.findLive(scope) : null;
    const { customer } = await resolveChatCustomer(deps, target, connection, scope);

    const summaries = (
      await deps.customerOrders.listAliveOfCustomer(
        scope.companyId,
        customer.id,
        ORDER_STATUSES_NOT_IN_PROGRESS,
        CUSTOMER_ORDERS_LIMIT,
      )
    ).filter(isOpenCustomerOrder);

    const selectedId = orderId ?? summaries[0]?.id ?? null;
    if (selectedId !== null && !summaries.some((summary) => summary.id === selectedId)) {
      throw new WhatsappOrderNotFoundError();
    }

    const [orders, companyName, variables] = await Promise.all([
      customerOrdersOf(deps, summaries, scope.companyId),
      deps.companyName(scope.companyId),
      deps.variableKeys.listAll(scope),
    ]);
    const selected = orders.find((order) => order.id === selectedId) ?? null;

    return {
      customer: { id: customer.id, name: customerNameOf(customer) },
      orders,
      selectedOrderId: selected?.id ?? null,
      values: contextValuesOf({ customer, companyName, selected, variables }),
    };
  };
}
