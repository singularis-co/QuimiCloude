import type { OrderCustomer, OrderDeliveryView } from '@/lib/modules/pedidos';

const DRAFT_KEY_PREFIX = 'qc.order-delivery-draft.';
const DRAFT_VERSION = 2;
const LEGACY_DRAFT_VERSION = 1;

/** Un cliente de la entrega. `packages` lleva el texto tal cual se escribio, por `packagesKey`. */
export type OrderDeliveryDraftBlock = {
  /** Identidad local del bloque: solo sirve para que React no confunda bloques al quitar uno. */
  readonly key: string;
  readonly customer: OrderCustomer | null;
  readonly packages: Readonly<Record<string, string>>;
};

/** Lo que el sheet guarda de una entrega a medias. Siempre tiene al menos un bloque. */
export type OrderDeliveryDraft = {
  readonly v: typeof DRAFT_VERSION;
  readonly orderId: string;
  readonly deliveryKey: string;
  readonly blocks: readonly OrderDeliveryDraftBlock[];
};

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type LoadedOrderDeliveryDraft = {
  readonly draft: OrderDeliveryDraft;
  /** Se descarto algun envase escrito en un lote que ya no se ofrece. */
  readonly adjusted: boolean;
};

export function orderDeliveryDraftKey(orderId: string): string {
  return `${DRAFT_KEY_PREFIX}${orderId}`;
}

export function packagesKey(presentationLineId: string, batchId: string): string {
  return `${presentationLineId}:${batchId}`;
}

const FIRST_BLOCK_KEY = '1';

function nextBlockKey(blocks: readonly OrderDeliveryDraftBlock[]): string {
  const highest = blocks.reduce((max, block) => Math.max(max, Number.parseInt(block.key, 10) || 0), 0);
  return String(highest + 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCustomer(value: unknown): OrderCustomer | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const { id, name, isDeleted } = value;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof isDeleted !== 'boolean') {
    return undefined;
  }
  return { id, name, isDeleted };
}

function parsePackages(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const packages: Record<string, string> = {};
  for (const [key, text] of Object.entries(value)) {
    if (typeof text !== 'string') return undefined;
    packages[key] = text;
  }
  return packages;
}

function parseBlock(value: unknown): OrderDeliveryDraftBlock | undefined {
  if (!isRecord(value) || typeof value.key !== 'string' || value.key === '') return undefined;
  const customer = parseCustomer(value.customer);
  const packages = parsePackages(value.packages);
  if (customer === undefined || packages === undefined) return undefined;
  return { key: value.key, customer, packages };
}

function parseBlocks(value: unknown): OrderDeliveryDraftBlock[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const blocks: OrderDeliveryDraftBlock[] = [];
  for (const item of value) {
    const block = parseBlock(item);
    if (block === undefined || blocks.some((other) => other.key === block.key)) return undefined;
    blocks.push(block);
  }
  return blocks;
}

// Un borrador de antes de los bloques sigue siendo una entrega a medias: se lee como un solo bloque.
function parseLegacyBlocks(value: Record<string, unknown>): OrderDeliveryDraftBlock[] | undefined {
  const customer = parseCustomer(value.customer);
  const packages = parsePackages(value.packages);
  if (customer === undefined || packages === undefined) return undefined;
  return [{ key: FIRST_BLOCK_KEY, customer, packages }];
}

/** Un texto que no es un borrador valido de este pedido devuelve `null`, sin lanzar. */
export function parseOrderDeliveryDraft(raw: string | null, orderId: string): OrderDeliveryDraft | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.orderId !== orderId) return null;
  if (typeof value.deliveryKey !== 'string' || value.deliveryKey === '') return null;
  const blocks =
    value.v === DRAFT_VERSION
      ? parseBlocks(value.blocks)
      : value.v === LEGACY_DRAFT_VERSION
        ? parseLegacyBlocks(value)
        : undefined;
  if (blocks === undefined) return null;
  return { v: DRAFT_VERSION, orderId, deliveryKey: value.deliveryKey, blocks };
}

/** Un solo bloque con el cliente del pedido, si sigue vivo. */
export function newOrderDeliveryDraft(view: OrderDeliveryView, deliveryKey: string): OrderDeliveryDraft {
  const customer = view.customer !== null && !view.customer.isDeleted ? view.customer : null;
  return {
    v: DRAFT_VERSION,
    orderId: view.orderId,
    deliveryKey,
    blocks: [{ key: FIRST_BLOCK_KEY, customer, packages: {} }],
  };
}

/** Quita, de todos los bloques, los envases de los lotes que la vista ya no ofrece para su linea. */
export function adjustOrderDeliveryDraft(
  draft: OrderDeliveryDraft,
  view: OrderDeliveryView,
): LoadedOrderDeliveryDraft {
  const offered = new Set(
    view.lines.flatMap((line) => line.batches.map((batch) => packagesKey(line.presentationLineId, batch.batchId))),
  );
  let adjusted = false;
  const blocks = draft.blocks.map((block) => {
    const packages: Record<string, string> = {};
    for (const [key, text] of Object.entries(block.packages)) {
      if (offered.has(key)) {
        packages[key] = text;
      } else if (text.trim() !== '') {
        adjusted = true;
      }
    }
    return { ...block, packages };
  });
  return { draft: { ...draft, blocks }, adjusted };
}

/**
 * Lee el borrador del pedido y lo ajusta a la vista. Sin borrador valido, empieza uno con el
 * cliente vivo del pedido y una clave de entrega nueva.
 */
export function loadOrderDeliveryDraft(
  storage: DraftStorage | null,
  view: OrderDeliveryView,
  newDeliveryKey: () => string,
): LoadedOrderDeliveryDraft {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(orderDeliveryDraftKey(view.orderId)) ?? null;
  } catch {
    raw = null;
  }
  const saved = parseOrderDeliveryDraft(raw, view.orderId);
  if (saved === null) {
    return { draft: newOrderDeliveryDraft(view, newDeliveryKey()), adjusted: false };
  }
  return adjustOrderDeliveryDraft(saved, view);
}

export function addDraftBlock(draft: OrderDeliveryDraft): OrderDeliveryDraft {
  return { ...draft, blocks: [...draft.blocks, { key: nextBlockKey(draft.blocks), customer: null, packages: {} }] };
}

/** El ultimo bloque no se quita: una entrega siempre tiene al menos un cliente. */
export function removeDraftBlock(draft: OrderDeliveryDraft, blockKey: string): OrderDeliveryDraft {
  if (draft.blocks.length <= 1) return draft;
  return { ...draft, blocks: draft.blocks.filter((block) => block.key !== blockKey) };
}

export function setDraftBlockCustomer(
  draft: OrderDeliveryDraft,
  blockKey: string,
  customer: OrderCustomer | null,
): OrderDeliveryDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((block) => (block.key === blockKey ? { ...block, customer } : block)),
  };
}

export function setDraftBlockPackages(
  draft: OrderDeliveryDraft,
  blockKey: string,
  key: string,
  text: string,
): OrderDeliveryDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((block) =>
      block.key === blockKey ? { ...block, packages: { ...block.packages, [key]: text } } : block,
    ),
  };
}

// Sin almacenamiento, o con la cuota llena, el sheet sigue funcionando: solo deja de persistir.
export function saveOrderDeliveryDraft(storage: DraftStorage | null, draft: OrderDeliveryDraft): void {
  try {
    storage?.setItem(orderDeliveryDraftKey(draft.orderId), JSON.stringify(draft));
  } catch {
    // Ignorado a proposito: ver arriba.
  }
}

export function clearOrderDeliveryDraft(storage: DraftStorage | null, orderId: string): void {
  try {
    storage?.removeItem(orderDeliveryDraftKey(orderId));
  } catch {
    // Ignorado a proposito: ver `saveOrderDeliveryDraft`.
  }
}
