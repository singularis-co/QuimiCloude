'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import type { OrderCustomer, OrderDeliveryView } from '@/lib/modules/pedidos';

import {
  addDraftBlock,
  adjustOrderDeliveryDraft,
  clearOrderDeliveryDraft,
  loadOrderDeliveryDraft,
  removeDraftBlock,
  saveOrderDeliveryDraft,
  setDraftBlockCustomer,
  setDraftBlockPackages,
  type DraftStorage,
  type OrderDeliveryDraft,
} from './order-delivery-draft';

// Leer `window.localStorage` lanza en algunos modos privados y WebViews con el almacenamiento
// bloqueado.
function browserStorage(): DraftStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export type OrderDeliveryDraftStore = {
  /** `null` hasta la primera lectura de la vista. */
  readonly draft: OrderDeliveryDraft | null;
  /** La ultima lectura quito envases de lotes que ya no se ofrecen. */
  readonly adjusted: boolean;
  /** Estable entre renders, como `sync`: se puede usar en las dependencias de un efecto. */
  readonly hasDraft: () => boolean;
  /** La primera vez lee el borrador guardado; despues ajusta el que hay a la vista nueva. */
  readonly sync: (view: OrderDeliveryView) => void;
  readonly addBlock: () => void;
  readonly removeBlock: (blockKey: string) => void;
  readonly setCustomer: (blockKey: string, customer: OrderCustomer | null) => void;
  readonly setPackages: (blockKey: string, key: string, text: string) => void;
  readonly clear: () => void;
};

/** El borrador de la entrega de un pedido: cada cambio se guarda en el navegador al momento. */
export function useOrderDeliveryDraft(orderId: string): OrderDeliveryDraftStore {
  const storage = useMemo(() => browserStorage(), []);
  const [draft, setDraft] = useState<OrderDeliveryDraft | null>(null);
  const [adjusted, setAdjusted] = useState(false);
  // Los cambios seguidos dentro del mismo evento se encadenan sobre el ultimo, no sobre el render.
  const draftRef = useRef<OrderDeliveryDraft | null>(null);

  const commit = useCallback(
    (next: OrderDeliveryDraft) => {
      draftRef.current = next;
      setDraft(next);
      saveOrderDeliveryDraft(storage, next);
    },
    [storage],
  );

  const update = useCallback(
    (change: (current: OrderDeliveryDraft) => OrderDeliveryDraft) => {
      if (draftRef.current !== null) commit(change(draftRef.current));
    },
    [commit],
  );

  const hasDraft = useCallback(() => draftRef.current !== null, []);

  const sync = useCallback(
    (view: OrderDeliveryView) => {
      const loaded =
        draftRef.current === null
          ? loadOrderDeliveryDraft(storage, view, () => crypto.randomUUID())
          : adjustOrderDeliveryDraft(draftRef.current, view);
      commit(loaded.draft);
      setAdjusted(loaded.adjusted);
    },
    [commit, storage],
  );

  return useMemo(
    () => ({
      draft,
      adjusted,
      hasDraft,
      sync,
      addBlock: () => update(addDraftBlock),
      removeBlock: (blockKey) => update((current) => removeDraftBlock(current, blockKey)),
      setCustomer: (blockKey, customer) => update((current) => setDraftBlockCustomer(current, blockKey, customer)),
      setPackages: (blockKey, key, text) => update((current) => setDraftBlockPackages(current, blockKey, key, text)),
      clear: () => clearOrderDeliveryDraft(storage, orderId),
    }),
    [adjusted, draft, hasDraft, orderId, storage, sync, update],
  );
}
