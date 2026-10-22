import type { DirectDeliveryView, OrderCustomer } from '@/lib/modules/pedidos';

const DRAFT_KEY_PREFIX = 'qc.direct-delivery-draft.';
const DRAFT_VERSION = 1;

/** Un cliente de la entrega. `packages` lleva el texto tal cual se escribio, por id de lote. */
export type DirectDeliveryDraftBlock = {
  /** Identidad local del bloque: solo sirve para que React no confunda bloques al quitar uno. */
  readonly key: string;
  readonly customer: OrderCustomer | null;
  readonly packages: Readonly<Record<string, string>>;
};

/** Lo que el sheet guarda de una entrega sin pedido a medias. Siempre tiene al menos un bloque. */
export type DirectDeliveryDraft = {
  readonly v: typeof DRAFT_VERSION;
  readonly productId: string;
  readonly deliveryKey: string;
  readonly blocks: readonly DirectDeliveryDraftBlock[];
  readonly note: string;
};

export type DirectDeliveryDraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type LoadedDirectDeliveryDraft = {
  readonly draft: DirectDeliveryDraft;
  /** Se descarto algun envase escrito en un lote que ya no se ofrece. */
  readonly adjusted: boolean;
};

export function directDeliveryDraftKey(productId: string): string {
  return `${DRAFT_KEY_PREFIX}${productId}`;
}

const FIRST_BLOCK_KEY = '1';

function nextBlockKey(blocks: readonly DirectDeliveryDraftBlock[]): string {
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
  if (typeof id !== 'string' || typeof name !== 'string' || typeof isDeleted !== 'boolean') return undefined;
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

function parseBlock(value: unknown): DirectDeliveryDraftBlock | undefined {
  if (!isRecord(value) || typeof value.key !== 'string' || value.key === '') return undefined;
  const customer = parseCustomer(value.customer);
  const packages = parsePackages(value.packages);
  if (customer === undefined || packages === undefined) return undefined;
  return { key: value.key, customer, packages };
}

function parseBlocks(value: unknown): DirectDeliveryDraftBlock[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const blocks: DirectDeliveryDraftBlock[] = [];
  for (const item of value) {
    const block = parseBlock(item);
    if (block === undefined || blocks.some((other) => other.key === block.key)) return undefined;
    blocks.push(block);
  }
  return blocks;
}

/** Un texto que no es un borrador valido de este producto devuelve `null`, sin lanzar. */
export function parseDirectDeliveryDraft(raw: string | null, productId: string): DirectDeliveryDraft | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.v !== DRAFT_VERSION || value.productId !== productId) return null;
  if (typeof value.deliveryKey !== 'string' || value.deliveryKey === '') return null;
  if (typeof value.note !== 'string') return null;
  const blocks = parseBlocks(value.blocks);
  if (blocks === undefined) return null;
  return { v: DRAFT_VERSION, productId, deliveryKey: value.deliveryKey, blocks, note: value.note };
}

export function newDirectDeliveryDraft(productId: string, deliveryKey: string): DirectDeliveryDraft {
  return {
    v: DRAFT_VERSION,
    productId,
    deliveryKey,
    blocks: [{ key: FIRST_BLOCK_KEY, customer: null, packages: {} }],
    note: '',
  };
}

/** Quita, de todos los bloques, los envases de los lotes que la vista ya no ofrece. */
export function adjustDirectDeliveryDraft(
  draft: DirectDeliveryDraft,
  view: Pick<DirectDeliveryView, 'batches'>,
): LoadedDirectDeliveryDraft {
  const offered = new Set(view.batches.map((batch) => batch.batchId));
  let adjusted = false;
  const blocks = draft.blocks.map((block) => {
    const packages: Record<string, string> = {};
    for (const [batchId, text] of Object.entries(block.packages)) {
      if (offered.has(batchId)) packages[batchId] = text;
      else if (text.trim() !== '') adjusted = true;
    }
    return { ...block, packages };
  });
  return { draft: { ...draft, blocks }, adjusted };
}

/** Lee el borrador del producto y lo ajusta a la vista. Sin borrador valido, empieza uno vacio. */
export function loadDirectDeliveryDraft(
  storage: DirectDeliveryDraftStorage | null,
  view: Pick<DirectDeliveryView, 'productId' | 'batches'>,
  newDeliveryKey: () => string,
): LoadedDirectDeliveryDraft {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(directDeliveryDraftKey(view.productId)) ?? null;
  } catch {
    raw = null;
  }
  const saved = parseDirectDeliveryDraft(raw, view.productId);
  if (saved === null) {
    return { draft: newDirectDeliveryDraft(view.productId, newDeliveryKey()), adjusted: false };
  }
  return adjustDirectDeliveryDraft(saved, view);
}

export function addDirectDraftBlock(draft: DirectDeliveryDraft): DirectDeliveryDraft {
  return { ...draft, blocks: [...draft.blocks, { key: nextBlockKey(draft.blocks), customer: null, packages: {} }] };
}

/** El ultimo bloque no se quita: una entrega siempre tiene al menos un cliente. */
export function removeDirectDraftBlock(draft: DirectDeliveryDraft, blockKey: string): DirectDeliveryDraft {
  if (draft.blocks.length <= 1) return draft;
  return { ...draft, blocks: draft.blocks.flatMap((block) => (block.key === blockKey ? [] : [block])) };
}

export function setDirectDraftBlockCustomer(
  draft: DirectDeliveryDraft,
  blockKey: string,
  customer: OrderCustomer | null,
): DirectDeliveryDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((block) => (block.key === blockKey ? { ...block, customer } : block)),
  };
}

export function setDirectDraftBlockPackages(
  draft: DirectDeliveryDraft,
  blockKey: string,
  batchId: string,
  text: string,
): DirectDeliveryDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((block) =>
      block.key === blockKey ? { ...block, packages: { ...block.packages, [batchId]: text } } : block,
    ),
  };
}

export function setDirectDraftNote(draft: DirectDeliveryDraft, note: string): DirectDeliveryDraft {
  return { ...draft, note };
}

// Sin almacenamiento, o con la cuota llena, el sheet sigue funcionando: solo deja de persistir.
export function saveDirectDeliveryDraft(storage: DirectDeliveryDraftStorage | null, draft: DirectDeliveryDraft): void {
  try {
    storage?.setItem(directDeliveryDraftKey(draft.productId), JSON.stringify(draft));
  } catch {
    // Ignorado a proposito: ver arriba.
  }
}

export function clearDirectDeliveryDraft(storage: DirectDeliveryDraftStorage | null, productId: string): void {
  try {
    storage?.removeItem(directDeliveryDraftKey(productId));
  } catch {
    // Ignorado a proposito: ver `saveDirectDeliveryDraft`.
  }
}
