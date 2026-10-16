// El borrador de la entrega sin pedido: forma, lectura, ajuste a la vista y escritura tolerante.

import { describe, expect, it, vi } from 'vitest';

import {
  addDirectDraftBlock,
  adjustDirectDeliveryDraft,
  clearDirectDeliveryDraft,
  directDeliveryDraftKey,
  loadDirectDeliveryDraft,
  newDirectDeliveryDraft,
  parseDirectDeliveryDraft,
  removeDirectDraftBlock,
  saveDirectDeliveryDraft,
  setDirectDraftBlockCustomer,
  setDirectDraftBlockPackages,
  setDirectDraftNote,
  type DirectDeliveryDraft,
  type DirectDeliveryDraftStorage,
} from '@/app/(private)/inventario/components';

import {
  DIRECT_DELIVERY_KEY,
  DIRECT_FIRST_CUSTOMER_ID,
  DIRECT_NEWER_BATCH_ID,
  DIRECT_OLDER_BATCH_ID,
  DIRECT_PRODUCT_ID,
  DIRECT_SECOND_CUSTOMER_ID,
  directDeliveryView,
} from '../../fixtures/direct-delivery';

const OTHER_PRODUCT_ID = 'a0000000-0000-4000-8000-000000000999';
const GONE_BATCH_ID = 'e0000000-0000-4000-8000-000000000999';
const ANA = { id: DIRECT_FIRST_CUSTOMER_ID, name: 'Ana Perez', isDeleted: false };
const BRUNO = { id: DIRECT_SECOND_CUSTOMER_ID, name: 'Bruno Diaz', isDeleted: false };

function memoryStorage(): DirectDeliveryDraftStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

function throwingStorage(): DirectDeliveryDraftStorage {
  const fail = () => {
    throw new Error('QuotaExceededError');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

function savedDraft(overrides: Partial<DirectDeliveryDraft> = {}): DirectDeliveryDraft {
  return {
    v: 1,
    productId: DIRECT_PRODUCT_ID,
    deliveryKey: DIRECT_DELIVERY_KEY,
    blocks: [
      { key: '1', customer: ANA, packages: { [DIRECT_OLDER_BATCH_ID]: '4' } },
      { key: '2', customer: BRUNO, packages: { [DIRECT_NEWER_BATCH_ID]: '2' } },
    ],
    note: 'Venta mostrador',
    ...overrides,
  };
}

describe('clave y forma del borrador', () => {
  it('R27: la clave es propia del producto', () => {
    expect(directDeliveryDraftKey(DIRECT_PRODUCT_ID)).toBe(`qc.direct-delivery-draft.${DIRECT_PRODUCT_ID}`);
    expect(directDeliveryDraftKey(OTHER_PRODUCT_ID)).not.toBe(directDeliveryDraftKey(DIRECT_PRODUCT_ID));
  });

  it('R12: un borrador nuevo tiene un solo bloque vacio, la nota vacia y la clave de entrega dada', () => {
    expect(newDirectDeliveryDraft(DIRECT_PRODUCT_ID, DIRECT_DELIVERY_KEY)).toEqual({
      v: 1,
      productId: DIRECT_PRODUCT_ID,
      deliveryKey: DIRECT_DELIVERY_KEY,
      blocks: [{ key: '1', customer: null, packages: {} }],
      note: '',
    });
  });

  it('R27: lo guardado se vuelve a leer igual: bloques en orden, clientes, envases, nota y clave', () => {
    const storage = memoryStorage();
    saveDirectDeliveryDraft(storage, savedDraft());

    const raw = storage.items.get(directDeliveryDraftKey(DIRECT_PRODUCT_ID)) ?? null;
    expect(parseDirectDeliveryDraft(raw, DIRECT_PRODUCT_ID)).toEqual(savedDraft());
  });

  it.each([
    ['nada guardado', null],
    ['un texto que no es JSON', '{no'],
    ['otro producto', JSON.stringify(savedDraft({ productId: OTHER_PRODUCT_ID }))],
    ['otra version', JSON.stringify({ ...savedDraft(), v: 2 })],
    ['sin clave de entrega', JSON.stringify({ ...savedDraft(), deliveryKey: '' })],
    ['sin nota', JSON.stringify({ ...savedDraft(), note: undefined })],
    ['sin bloques', JSON.stringify({ ...savedDraft(), blocks: [] })],
    ['bloques con la misma clave', JSON.stringify({ ...savedDraft(), blocks: [savedDraft().blocks[0], savedDraft().blocks[0]] })],
    ['un envase que no es texto', JSON.stringify({ ...savedDraft(), blocks: [{ key: '1', customer: null, packages: { x: 3 } }] })],
  ])('R27: %s no es un borrador valido', (_caso, raw) => {
    expect(parseDirectDeliveryDraft(raw, DIRECT_PRODUCT_ID)).toBeNull();
  });
});

describe('lectura al abrir', () => {
  it('R12: sin borrador empieza uno vacio con una clave nueva', () => {
    const newKey = vi.fn(() => DIRECT_DELIVERY_KEY);
    const loaded = loadDirectDeliveryDraft(memoryStorage(), directDeliveryView(), newKey);

    expect(newKey).toHaveBeenCalledTimes(1);
    expect(loaded).toEqual({ draft: newDirectDeliveryDraft(DIRECT_PRODUCT_ID, DIRECT_DELIVERY_KEY), adjusted: false });
  });

  it('R27: con borrador lo restaura tal cual y conserva su clave de entrega', () => {
    const storage = memoryStorage();
    saveDirectDeliveryDraft(storage, savedDraft());
    const newKey = vi.fn(() => 'otra-clave');

    const loaded = loadDirectDeliveryDraft(storage, directDeliveryView(), newKey);

    expect(newKey).not.toHaveBeenCalled();
    expect(loaded).toEqual({ draft: savedDraft(), adjusted: false });
  });

  it('R27: sin almacenamiento, o si leerlo lanza, empieza uno vacio sin romper', () => {
    for (const storage of [null, throwingStorage()]) {
      const loaded = loadDirectDeliveryDraft(storage, directDeliveryView(), () => DIRECT_DELIVERY_KEY);
      expect(loaded.draft.blocks).toHaveLength(1);
      expect(loaded.adjusted).toBe(false);
    }
  });
});

describe('ajuste a la vista', () => {
  it('R28: quita de todos los bloques los envases de los lotes que ya no se ofrecen y lo avisa', () => {
    const draft = savedDraft({
      blocks: [
        { key: '1', customer: ANA, packages: { [DIRECT_OLDER_BATCH_ID]: '4', [GONE_BATCH_ID]: '1' } },
        { key: '2', customer: BRUNO, packages: { [GONE_BATCH_ID]: '2', [DIRECT_NEWER_BATCH_ID]: '1' } },
      ],
    });

    const result = adjustDirectDeliveryDraft(draft, directDeliveryView());

    expect(result.adjusted).toBe(true);
    expect(result.draft.blocks.map((block) => block.packages)).toEqual([
      { [DIRECT_OLDER_BATCH_ID]: '4' },
      { [DIRECT_NEWER_BATCH_ID]: '1' },
    ]);
    expect(result.draft.note).toBe(draft.note);
    expect(result.draft.deliveryKey).toBe(DIRECT_DELIVERY_KEY);
  });

  it('R28: si todos los lotes del borrador se siguen ofreciendo no avisa', () => {
    expect(adjustDirectDeliveryDraft(savedDraft(), directDeliveryView())).toEqual({ draft: savedDraft(), adjusted: false });
  });

  it('R28: un lote que ya no se ofrece pero estaba vacio se quita sin avisar', () => {
    const draft = savedDraft({ blocks: [{ key: '1', customer: ANA, packages: { [GONE_BATCH_ID]: ' ' } }] });
    const result = adjustDirectDeliveryDraft(draft, directDeliveryView());

    expect(result.adjusted).toBe(false);
    expect(result.draft.blocks[0]?.packages).toEqual({});
  });

  it('R28: al restaurar un borrador con lotes que ya no estan, lo ajusta y lo avisa', () => {
    const storage = memoryStorage();
    saveDirectDeliveryDraft(
      storage,
      savedDraft({ blocks: [{ key: '1', customer: ANA, packages: { [GONE_BATCH_ID]: '3' } }] }),
    );

    const loaded = loadDirectDeliveryDraft(storage, directDeliveryView(), () => 'nueva');

    expect(loaded.adjusted).toBe(true);
    expect(loaded.draft.blocks[0]?.packages).toEqual({});
    expect(loaded.draft.deliveryKey).toBe(DIRECT_DELIVERY_KEY);
  });
});

describe('cambios del borrador', () => {
  it('R14: añadir pone al final un bloque vacio con una clave nueva', () => {
    const draft = addDirectDraftBlock(savedDraft());
    expect(draft.blocks.map((block) => block.key)).toEqual(['1', '2', '3']);
    expect(draft.blocks[2]).toEqual({ key: '3', customer: null, packages: {} });
  });

  it('R14: quitar saca el bloque con sus envases y el ultimo no se quita', () => {
    const draft = removeDirectDraftBlock(savedDraft(), '1');
    expect(draft.blocks.map((block) => block.key)).toEqual(['2']);
    expect(removeDirectDraftBlock(draft, '2')).toBe(draft);
  });

  it('R27: cliente, envases y nota cambian solo lo suyo', () => {
    let draft = setDirectDraftBlockCustomer(savedDraft(), '2', null);
    draft = setDirectDraftBlockPackages(draft, '1', DIRECT_NEWER_BATCH_ID, '3');
    draft = setDirectDraftNote(draft, 'Otra nota');

    expect(draft.blocks).toEqual([
      { key: '1', customer: ANA, packages: { [DIRECT_OLDER_BATCH_ID]: '4', [DIRECT_NEWER_BATCH_ID]: '3' } },
      { key: '2', customer: null, packages: { [DIRECT_NEWER_BATCH_ID]: '2' } },
    ]);
    expect(draft.note).toBe('Otra nota');
  });
});

describe('escritura tolerante', () => {
  it('R27: borrar quita el borrador del producto y deja los demas', () => {
    const storage = memoryStorage();
    saveDirectDeliveryDraft(storage, savedDraft());
    saveDirectDeliveryDraft(storage, savedDraft({ productId: OTHER_PRODUCT_ID }));

    clearDirectDeliveryDraft(storage, DIRECT_PRODUCT_ID);

    expect(storage.items.has(directDeliveryDraftKey(DIRECT_PRODUCT_ID))).toBe(false);
    expect(storage.items.has(directDeliveryDraftKey(OTHER_PRODUCT_ID))).toBe(true);
  });

  it('R27: sin almacenamiento o con la cuota llena, guardar y borrar no lanzan', () => {
    for (const storage of [null, throwingStorage()]) {
      expect(() => saveDirectDeliveryDraft(storage, savedDraft())).not.toThrow();
      expect(() => clearDirectDeliveryDraft(storage, DIRECT_PRODUCT_ID)).not.toThrow();
    }
  });
});
