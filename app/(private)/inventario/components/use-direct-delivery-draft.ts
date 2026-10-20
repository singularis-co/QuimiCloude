'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import type { DirectDeliveryView, OrderCustomer } from '@/lib/modules/pedidos';

import {
  addDirectDraftBlock,
  adjustDirectDeliveryDraft,
  clearDirectDeliveryDraft,
  loadDirectDeliveryDraft,
  removeDirectDraftBlock,
  saveDirectDeliveryDraft,
  setDirectDraftBlockCustomer,
  setDirectDraftBlockPackages,
  setDirectDraftNote,
  type DirectDeliveryDraft,
  type DirectDeliveryDraftStorage,
} from './direct-delivery-draft';

// Leer `window.localStorage` lanza en algunos modos privados y WebViews con el almacenamiento
// bloqueado.
function browserStorage(): DirectDeliveryDraftStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export type DirectDeliveryDraftStore = {
  /** `null` hasta la primera lectura de la vista. */
  readonly draft: DirectDeliveryDraft | null;
  /** La ultima lectura quito envases de lotes que ya no se ofrecen. */
  readonly adjusted: boolean;
  /** Estable entre renders, como `sync`: se puede usar en las dependencias de un efecto. */
  readonly hasDraft: () => boolean;
  /** La primera vez lee el borrador guardado; despues ajusta el que hay a la vista nueva. */
  readonly sync: (view: DirectDeliveryView) => void;
  readonly addBlock: () => void;
  readonly removeBlock: (blockKey: string) => void;
  readonly setCustomer: (blockKey: string, customer: OrderCustomer | null) => void;
  readonly setPackages: (blockKey: string, batchId: string, text: string) => void;
  readonly setNote: (note: string) => void;
  readonly clear: () => void;
};

/** El borrador de la entrega sin pedido de un producto: cada cambio se guarda en el navegador. */
export function useDirectDeliveryDraft(productId: string): DirectDeliveryDraftStore {
  const storage = useMemo(() => browserStorage(), []);
  const [draft, setDraft] = useState<DirectDeliveryDraft | null>(null);
  const [adjusted, setAdjusted] = useState(false);
  // Los cambios seguidos dentro del mismo evento se encadenan sobre el ultimo, no sobre el render.
  const draftRef = useRef<DirectDeliveryDraft | null>(null);

  const commit = useCallback(
    (next: DirectDeliveryDraft) => {
      draftRef.current = next;
      setDraft(next);
      saveDirectDeliveryDraft(storage, next);
    },
    [storage],
  );

  const update = useCallback(
    (change: (current: DirectDeliveryDraft) => DirectDeliveryDraft) => {
      if (draftRef.current !== null) commit(change(draftRef.current));
    },
    [commit],
  );

  const hasDraft = useCallback(() => draftRef.current !== null, []);

  const sync = useCallback(
    (view: DirectDeliveryView) => {
      const loaded =
        draftRef.current === null
          ? loadDirectDeliveryDraft(storage, view, () => crypto.randomUUID())
          : adjustDirectDeliveryDraft(draftRef.current, view);
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
      addBlock: () => update(addDirectDraftBlock),
      removeBlock: (blockKey) => update((current) => removeDirectDraftBlock(current, blockKey)),
      setCustomer: (blockKey, customer) =>
        update((current) => setDirectDraftBlockCustomer(current, blockKey, customer)),
      setPackages: (blockKey, batchId, text) =>
        update((current) => setDirectDraftBlockPackages(current, blockKey, batchId, text)),
      setNote: (note) => update((current) => setDirectDraftNote(current, note)),
      clear: () => clearDirectDeliveryDraft(storage, productId),
    }),
    [adjusted, draft, hasDraft, productId, storage, sync, update],
  );
}
