import { describe, expect, it, vi } from 'vitest';

import {
  addDraftBlock,
  adjustOrderDeliveryDraft,
  clearOrderDeliveryDraft,
  loadOrderDeliveryDraft,
  orderDeliveryDraftKey,
  packagesKey,
  parseOrderDeliveryDraft,
  removeDraftBlock,
  saveOrderDeliveryDraft,
  setDraftBlockCustomer,
  setDraftBlockPackages,
  type DraftStorage,
  type OrderDeliveryDraft,
  type OrderDeliveryDraftBlock,
} from '@/app/(private)/pedidos/components';

import {
  COMPLETE_LINE_ID,
  DELIVERY_KEY,
  DELIVERY_ORDER_ID,
  GALLON_BATCH_ID,
  NEWER_BATCH_ID,
  OLDER_BATCH_ID,
  PENDING_LINE_ID,
  SECOND_PENDING_LINE_ID,
  deliveryView,
  multiCustomerDeliveryView,
} from '../../fixtures/order-delivery';

const OTHER_ORDER_ID = 'a0000000-0000-4000-8000-000000000002';
const GONE_BATCH_ID = 'e0000000-0000-4000-8000-000000000099';
const ANA = deliveryView().customer;
const LUIS = { id: 'c0000000-0000-4000-8000-00000000000b', name: 'Luis Gil', isDeleted: false };

function memoryStorage(): DraftStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

function throwingStorage(): DraftStorage {
  const fail = () => {
    throw new Error('QuotaExceededError');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

function block(overrides: Partial<OrderDeliveryDraftBlock> = {}): OrderDeliveryDraftBlock {
  return { key: '1', customer: LUIS, packages: { [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '3' }, ...overrides };
}

/** Dos clientes que comparten el lote viejo; el segundo lleva ademas la otra presentacion. */
function draft(overrides: Partial<OrderDeliveryDraft> = {}): OrderDeliveryDraft {
  return {
    v: 2,
    orderId: DELIVERY_ORDER_ID,
    deliveryKey: DELIVERY_KEY,
    blocks: [
      block({ key: '1', customer: ANA }),
      block({
        key: '2',
        customer: LUIS,
        packages: {
          [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '1',
          [packagesKey(SECOND_PENDING_LINE_ID, GALLON_BATCH_ID)]: '2',
        },
      }),
    ],
    ...overrides,
  };
}

const neverCalled = () => {
  throw new Error('no debe generarse una clave nueva');
};

describe('borrador de entrega con bloques', () => {
  it('R45: escribe y lee por pedido los bloques en su orden, con sus clientes, envases y clave', () => {
    const storage = memoryStorage();
    saveOrderDeliveryDraft(storage, draft());

    expect([...storage.items.keys()]).toEqual([orderDeliveryDraftKey(DELIVERY_ORDER_ID)]);
    const loaded = loadOrderDeliveryDraft(storage, multiCustomerDeliveryView(), neverCalled);
    expect(loaded).toEqual({ draft: draft(), adjusted: false });
    expect(loaded.draft.blocks.map((b) => b.customer?.name)).toEqual(['Ana Perez', 'Luis Gil']);
  });

  it('R45: el borrador de un pedido no se lee desde otro', () => {
    const storage = memoryStorage();
    saveOrderDeliveryDraft(storage, draft());
    const newKey = vi.fn(() => 'b0000000-0000-4000-8000-0000000000b2');

    const loaded = loadOrderDeliveryDraft(storage, deliveryView({ orderId: OTHER_ORDER_ID }), newKey);

    expect(newKey).toHaveBeenCalledOnce();
    expect(loaded.draft.orderId).toBe(OTHER_ORDER_ID);
    expect(loaded.draft.blocks).toEqual([{ key: '1', customer: ANA, packages: {} }]);
  });

  it('R4: sin borrador empieza con un solo bloque con el cliente vivo del pedido y una clave nueva', () => {
    const loaded = loadOrderDeliveryDraft(memoryStorage(), deliveryView(), () => DELIVERY_KEY);

    expect(loaded).toEqual({
      draft: {
        v: 2,
        orderId: DELIVERY_ORDER_ID,
        deliveryKey: DELIVERY_KEY,
        blocks: [{ key: '1', customer: ANA, packages: {} }],
      },
      adjusted: false,
    });
  });

  it.each([
    ['sin cliente', null],
    ['con el cliente dado de baja', { ...LUIS, isDeleted: true }],
  ])('R5: sin borrador y %s, el unico bloque queda sin cliente', (_caso, customer) => {
    const loaded = loadOrderDeliveryDraft(null, deliveryView({ customer }), () => DELIVERY_KEY);
    expect(loaded.draft.blocks).toEqual([{ key: '1', customer: null, packages: {} }]);
  });

  it('R45: un borrador v1 guardado antes de los bloques se lee como un solo bloque con su cliente y sus envases', () => {
    const storage = memoryStorage();
    const packages = {
      [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '2',
      [packagesKey(PENDING_LINE_ID, NEWER_BATCH_ID)]: '1',
    };
    storage.setItem(
      orderDeliveryDraftKey(DELIVERY_ORDER_ID),
      JSON.stringify({ v: 1, orderId: DELIVERY_ORDER_ID, deliveryKey: DELIVERY_KEY, customer: LUIS, packages }),
    );

    expect(loadOrderDeliveryDraft(storage, deliveryView(), neverCalled)).toEqual({
      draft: { v: 2, orderId: DELIVERY_ORDER_ID, deliveryKey: DELIVERY_KEY, blocks: [{ key: '1', customer: LUIS, packages }] },
      adjusted: false,
    });
  });

  it('R45: un borrador v1 sin cliente se lee como un bloque sin cliente', () => {
    const raw = JSON.stringify({ v: 1, orderId: DELIVERY_ORDER_ID, deliveryKey: DELIVERY_KEY, customer: null, packages: {} });
    expect(parseOrderDeliveryDraft(raw, DELIVERY_ORDER_ID)?.blocks).toEqual([{ key: '1', customer: null, packages: {} }]);
  });

  it('borra el borrador del pedido y deja los de los demas', () => {
    const storage = memoryStorage();
    saveOrderDeliveryDraft(storage, draft());
    saveOrderDeliveryDraft(storage, draft({ orderId: OTHER_ORDER_ID }));

    clearOrderDeliveryDraft(storage, DELIVERY_ORDER_ID);

    expect([...storage.items.keys()]).toEqual([orderDeliveryDraftKey(OTHER_ORDER_ID)]);
  });

  it('R46: descarta de todos los bloques los envases de los lotes que ya no se ofrecen y marca `adjusted`', () => {
    const saved = draft({
      blocks: [
        block({
          key: '1',
          packages: {
            [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '2',
            [packagesKey(PENDING_LINE_ID, GONE_BATCH_ID)]: '4',
          },
        }),
        block({
          key: '2',
          customer: ANA,
          packages: {
            [packagesKey(PENDING_LINE_ID, NEWER_BATCH_ID)]: '1',
            [packagesKey(COMPLETE_LINE_ID, OLDER_BATCH_ID)]: '1',
          },
        }),
      ],
    });

    const result = adjustOrderDeliveryDraft(saved, deliveryView());

    expect(result.adjusted).toBe(true);
    expect(result.draft.blocks).toEqual([
      block({ key: '1', packages: { [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '2' } }),
      block({ key: '2', customer: ANA, packages: { [packagesKey(PENDING_LINE_ID, NEWER_BATCH_ID)]: '1' } }),
    ]);
    expect(result.draft.deliveryKey).toBe(DELIVERY_KEY);
  });

  it('R46: un lote retirado sin envases escritos no cuenta como ajuste', () => {
    const saved = draft({ blocks: [block({ packages: { [packagesKey(PENDING_LINE_ID, GONE_BATCH_ID)]: '' } })] });
    expect(adjustOrderDeliveryDraft(saved, deliveryView())).toEqual({
      draft: { ...saved, blocks: [block({ packages: {} })] },
      adjusted: false,
    });
  });

  it('R46: un lote que sigue ofrecido con menos envases que lo escrito no es un ajuste', () => {
    const saved = draft({ blocks: [block({ packages: { [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '40' } })] });
    expect(adjustOrderDeliveryDraft(saved, deliveryView())).toEqual({ draft: saved, adjusted: false });
  });

  it.each([
    ['JSON corrupto', '{"v":2,'],
    ['otra version', JSON.stringify({ ...draft(), v: 3 })],
    ['sin clave de entrega', JSON.stringify({ ...draft(), deliveryKey: '' })],
    ['sin bloques', JSON.stringify({ ...draft(), blocks: [] })],
    ['dos bloques con la misma clave', JSON.stringify({ ...draft(), blocks: [block(), block()] })],
    ['envases que no son texto', JSON.stringify({ ...draft(), blocks: [{ ...block(), packages: { a: 3 } }] })],
    ['cliente mal formado', JSON.stringify({ ...draft(), blocks: [{ ...block(), customer: { id: 'x' } }] })],
    ['v1 con envases que no son texto', JSON.stringify({ v: 1, orderId: DELIVERY_ORDER_ID, deliveryKey: DELIVERY_KEY, customer: null, packages: { a: 3 } })],
    ['un array', '[]'],
  ])('%s: se descarta sin lanzar', (_caso, raw) => {
    expect(parseOrderDeliveryDraft(raw, DELIVERY_ORDER_ID)).toBeNull();

    const storage = memoryStorage();
    storage.setItem(orderDeliveryDraftKey(DELIVERY_ORDER_ID), raw);
    const loaded = loadOrderDeliveryDraft(storage, deliveryView(), () => 'nueva');
    expect(loaded.draft.deliveryKey).toBe('nueva');
    expect(loaded.draft.blocks).toEqual([{ key: '1', customer: ANA, packages: {} }]);
  });

  it('sin localStorage, o con uno que lanza, ninguna operacion lanza', () => {
    for (const storage of [null, throwingStorage()]) {
      expect(() => saveOrderDeliveryDraft(storage, draft())).not.toThrow();
      expect(() => clearOrderDeliveryDraft(storage, DELIVERY_ORDER_ID)).not.toThrow();
      expect(loadOrderDeliveryDraft(storage, deliveryView(), () => DELIVERY_KEY).draft.blocks).toHaveLength(1);
    }
  });
});

describe('cambios de los bloques', () => {
  it('R8: añadir pone al final un bloque sin cliente ni envases, con una clave que no repite', () => {
    const next = addDraftBlock(draft());
    expect(next.blocks.map((b) => b.key)).toEqual(['1', '2', '3']);
    expect(next.blocks[2]).toEqual({ key: '3', customer: null, packages: {} });
  });

  it('R9: quitar un bloque se lleva sus envases y deja los demas en su orden; el ultimo no se quita', () => {
    const three = addDraftBlock(draft());
    const removed = removeDraftBlock(three, '2');
    expect(removed.blocks.map((b) => b.key)).toEqual(['1', '3']);
    expect(addDraftBlock(removed).blocks.map((b) => b.key)).toEqual(['1', '3', '4']);

    const single = draft({ blocks: [block()] });
    expect(removeDraftBlock(single, '1')).toBe(single);
  });

  it('R45: cambiar cliente o envases solo toca su bloque', () => {
    const withCustomer = setDraftBlockCustomer(draft(), '2', null);
    expect(withCustomer.blocks.map((b) => b.customer)).toEqual([ANA, null]);

    const key = packagesKey(PENDING_LINE_ID, NEWER_BATCH_ID);
    const withPackages = setDraftBlockPackages(draft(), '1', key, '5');
    expect(withPackages.blocks[0]?.packages[key]).toBe('5');
    expect(withPackages.blocks[1]).toEqual(draft().blocks[1]);
  });
});
