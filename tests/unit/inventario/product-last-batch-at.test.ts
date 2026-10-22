// `products.last_batch_at` y el orden por defecto del inventario, con un `tx` doblado: nada toca
// Postgres. Que la columna quede con el `created_at` del lote contra la base real es de
// `tests/integration/inventario/product-last-batch-at.int.test.ts`.

import { describe, expect, it, vi } from 'vitest';

import {
  addImportedFinishedGoodsBatch,
  consumeBatchStock,
  productOrderBy,
  receiveFinishedGoods,
} from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';

import type { Prisma } from '@prisma/client';

type Row = Record<string, unknown>;
type SqlLike = { readonly sql: string; readonly values: readonly unknown[] };

const SCOPE = { companyId: 'company-1' };
const NOW = new Date('2026-10-16T12:00:00Z');

/** Un `tx` que responde a los `$queryRaw` por turno y apunta cada `$executeRaw`. */
function makeTx(queryRawRows: readonly (readonly Row[])[]) {
  let queryRawCall = 0;
  const tx = {
    $queryRaw: vi.fn(async () => {
      const rows = queryRawRows[queryRawCall] ?? [];
      queryRawCall += 1;
      return rows;
    }),
    $executeRaw: vi.fn<(sql: SqlLike) => Promise<number>>(async () => 1),
    productBatch: {
      create: vi.fn(async (args: { data: Row }) => ({ id: 'batch-1', ...args.data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findFirst: vi.fn(async () => null),
    },
    inventoryMovement: { create: vi.fn(async (args: { data: Row }) => ({ id: 'movement-1', ...args.data })) },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, txDouble: tx };
}

function lastBatchAtWrites(txDouble: ReturnType<typeof makeTx>['txDouble']): readonly SqlLike[] {
  return txDouble.$executeRaw.mock.calls.map(([sql]) => sql).filter((sql) => sql.sql.includes('"last_batch_at"'));
}

describe('orden por defecto del inventario de productos', () => {
  it('sin columna elegida: ultimo lote descendente con nulos al final, luego alta descendente y el id', () => {
    expect(productOrderBy(null)).toEqual([
      { lastBatchAt: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
  });

  it('una columna elegida no arrastra el ultimo lote', () => {
    expect(productOrderBy({ columnId: 'name', direction: 'asc' })).toEqual([{ name: 'asc' }, { id: 'asc' }]);
  });

  it('cada llamada devuelve un array nuevo', () => {
    expect(productOrderBy(null)).not.toBe(productOrderBy(null));
  });
});

describe('quien escribe products.last_batch_at', () => {
  it('el lote importado de producto terminado la escribe con el mismo instante que el lote', async () => {
    const { tx, txDouble } = makeTx([[{ top: null }]]);

    await addImportedFinishedGoodsBatch(
      tx,
      'product-1',
      {
        presentationId: 'presentation-1',
        stock: '10',
        unitCost: '1.0000',
        lot: null,
        purchaseDate: '2026-10-16',
        expiryDate: null,
        createdBy: 'actor-1',
      },
      '1.0000',
      NOW,
      SCOPE,
    );

    const batchData = txDouble.productBatch.create.mock.calls[0]?.[0]?.data;
    expect(batchData?.createdAt).toBe(NOW);
    const writes = lastBatchAtWrites(txDouble);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.values).toEqual([NOW, 'product-1', 'company-1']);
  });

  it('el lote de una produccion la escribe con el mismo instante que el lote', async () => {
    const { tx, txDouble } = makeTx([
      [{ name: 'Botella 1L', unitId: 'unit-1', content: '1.0000' }],
      [{ id: 'product-1', name: 'Desengrasante · Botella 1L' }],
      [{ top: null }],
    ]);

    const outcome = await receiveFinishedGoods(
      tx,
      {
        orderId: 'order-1',
        recipeId: 'recipe-1',
        recipeName: 'Desengrasante',
        presentationId: 'presentation-1',
        orderPresentationLineId: 'line-1',
        packages: 5,
        orderContent: null,
        unitCost: '2.0000',
        actorId: 'actor-1',
        now: NOW,
      },
      SCOPE,
    );

    expect(outcome.kind).toBe('received');
    expect(txDouble.productBatch.create).toHaveBeenCalledTimes(1);
    const batchData = txDouble.productBatch.create.mock.calls[0]?.[0]?.data;
    expect(batchData?.createdAt).toBe(NOW);
    const writes = lastBatchAtWrites(txDouble);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.values).toEqual([NOW, 'product-1', 'company-1']);
  });

  it('el consumo de un pedido no la toca', async () => {
    const { tx, txDouble } = makeTx([]);

    const outcome = await consumeBatchStock(
      tx,
      { batchId: 'batch-1', quantity: '2', orderId: 'order-1', actorId: 'actor-1' },
      NOW,
      SCOPE,
    );

    expect(outcome.kind).toBe('consumed');
    expect(txDouble.$executeRaw).not.toHaveBeenCalled();
  });
});
