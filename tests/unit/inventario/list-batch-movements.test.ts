import { describe, expect, it, vi } from 'vitest';

import { createListBatchMovements } from '@/lib/modules/inventario/domain/list-batch-movements';

import type { CustomerCatalog, CustomerRef } from '@/lib/modules/clientes';
import type { PeopleDirectory } from '@/lib/modules/identity';
import type { Actor } from '@/lib/modules/inventario/domain/actor';
import type { DeliveryCustomerDirectory } from '@/lib/modules/inventario/domain/list-batch-movements';
import type { BatchMovementRecord, OrderNumberDirectory } from '@/lib/modules/inventario/domain/reservation';
import type { ProductRepository } from '@/lib/modules/inventario/ports/product-repository';

// QC-288: el historial de un lote nombra a los clientes de las entregas sin pedido y de sus anulaciones.

const EMPRESA = 'company-a';
const LOTE = '11111111-1111-4111-8111-111111111288';
const AHORA = new Date('2026-10-16T10:00:00.000Z');
const LECTOR: Actor = { id: 'u-lector', companyId: EMPRESA, permissions: ['inventario.consultar'] };

const ENTREGA = '20000000-0000-4000-8000-000000000288';
const ANULACION = '21000000-0000-4000-8000-000000000288';
const PEDIDO = '22000000-0000-4000-8000-000000000288';
const ZOE = 'c0000000-0000-4000-8000-000000000001';
const ANA = 'c0000000-0000-4000-8000-000000000002';
const DESAPARECIDO = 'c0000000-0000-4000-8000-000000000003';

function asiento(overrides: Partial<BatchMovementRecord> & Pick<BatchMovementRecord, 'id' | 'kind'>): BatchMovementRecord {
  return {
    quantity: '-1.0000',
    reason: null,
    orderNumberText: null,
    authorName: null,
    createdAt: '2026-10-16T09:00:00.000Z',
    previousStock: null,
    countedStock: null,
    customerNames: null,
    ...overrides,
  };
}

const SALIDA_SIN_PEDIDO = asiento({ id: 'm-directa', kind: 'direct_delivery', quantity: '-8.0000', orderDeliveryId: ENTREGA });
const DEVOLUCION_SIN_PEDIDO = asiento({
  id: 'm-anulacion',
  kind: 'direct_delivery_void',
  quantity: '4.0000',
  orderDeliveryId: ENTREGA,
  orderDeliveryVoidId: ANULACION,
});
const SALIDA_DE_PEDIDO = asiento({
  id: 'm-pedido',
  kind: 'delivery',
  quantity: '-2.0000',
  orderNumberText: PEDIDO,
  orderDeliveryId: '20000000-0000-4000-8000-000000000999',
});
const AJUSTE = asiento({ id: 'm-ajuste', kind: 'adjustment', quantity: '1.0000' });

const REFS: readonly CustomerRef[] = [
  { id: ZOE, firstNames: 'Zoe', lastNames: 'Alvarez', isDeleted: false },
  { id: ANA, firstNames: 'Ana', lastNames: 'Perez', isDeleted: true },
];

type Montaje = {
  readonly asientos: readonly BatchMovementRecord[];
  readonly clientesPorAsiento?: ReadonlyMap<string, readonly string[]>;
  readonly refs?: readonly CustomerRef[];
};

function montar({ asientos, clientesPorAsiento = new Map(), refs = REFS }: Montaje) {
  const findBatchMovements = vi.fn(async () => asientos);
  const products = { findBatchMovements } as unknown as ProductRepository;
  const people = {
    findRefsIncludingDeletedInCompany: vi.fn(async () => []),
  } as unknown as PeopleDirectory;
  const orders: OrderNumberDirectory = {
    findNumberTexts: vi.fn<OrderNumberDirectory['findNumberTexts']>(async () => new Map([[PEDIDO, 'P-0042']])),
  };
  const deliveryCustomers: DeliveryCustomerDirectory = {
    findCustomerIds: vi.fn<DeliveryCustomerDirectory['findCustomerIds']>(async () => clientesPorAsiento),
  };
  const customers: Pick<CustomerCatalog, 'findRefsIncludingDeleted'> = {
    findRefsIncludingDeleted: vi.fn<CustomerCatalog['findRefsIncludingDeleted']>(async () => refs),
  };
  return {
    deliveryCustomers,
    customers,
    orders,
    listar: createListBatchMovements({ products, people, orders, deliveryCustomers, customers, now: () => AHORA }),
  };
}

describe('listBatchMovements: clientes de la entrega sin pedido', () => {
  it('R54: la salida y su anulacion salen con sus clientes por nombre ascendente; el resto con customerNames null', async () => {
    const m = montar({
      asientos: [DEVOLUCION_SIN_PEDIDO, SALIDA_SIN_PEDIDO, SALIDA_DE_PEDIDO, AJUSTE],
      clientesPorAsiento: new Map([
        [SALIDA_SIN_PEDIDO.id, [ZOE, ANA]],
        [DEVOLUCION_SIN_PEDIDO.id, [ZOE]],
      ]),
    });

    const salida = await m.listar(LOTE, LECTOR);

    expect(salida.map((entrada) => [entrada.kind, entrada.quantity, entrada.customerNames])).toEqual([
      ['direct_delivery_void', '4.0000', ['Zoe Alvarez']],
      ['direct_delivery', '-8.0000', ['Ana Perez', 'Zoe Alvarez']],
      ['delivery', '-2.0000', null],
      ['adjustment', '1.0000', null],
    ]);
    expect(salida[1]?.orderNumberText).toBeNull();
    expect(salida[2]?.orderNumberText).toBe('P-0042');
  });

  it('R54: una sola llamada a cada directorio, con la entrega en la salida y solo la anulacion en la devolucion', async () => {
    const m = montar({
      asientos: [DEVOLUCION_SIN_PEDIDO, SALIDA_SIN_PEDIDO, SALIDA_DE_PEDIDO, AJUSTE],
      clientesPorAsiento: new Map([
        [SALIDA_SIN_PEDIDO.id, [ZOE, ANA]],
        [DEVOLUCION_SIN_PEDIDO.id, [ZOE]],
      ]),
    });

    await m.listar(LOTE, LECTOR);

    expect(m.deliveryCustomers.findCustomerIds).toHaveBeenCalledTimes(1);
    expect(m.deliveryCustomers.findCustomerIds).toHaveBeenCalledWith(EMPRESA, [
      { movementId: DEVOLUCION_SIN_PEDIDO.id, batchId: LOTE, deliveryId: null, voidId: ANULACION },
      { movementId: SALIDA_SIN_PEDIDO.id, batchId: LOTE, deliveryId: ENTREGA, voidId: null },
    ]);
    expect(m.customers.findRefsIncludingDeleted).toHaveBeenCalledTimes(1);
    expect(m.customers.findRefsIncludingDeleted).toHaveBeenCalledWith([ZOE, ANA], EMPRESA);
  });

  it('R54: las referencias a la entrega no salen del caso de uso', async () => {
    const m = montar({ asientos: [SALIDA_SIN_PEDIDO, SALIDA_DE_PEDIDO], clientesPorAsiento: new Map([[SALIDA_SIN_PEDIDO.id, [ZOE]]]) });

    const salida = await m.listar(LOTE, LECTOR);

    for (const entrada of salida) {
      expect(entrada).not.toHaveProperty('orderDeliveryId');
      expect(entrada).not.toHaveProperty('orderDeliveryVoidId');
    }
  });

  it('R54: un cliente que no vuelve del catalogo sale con su id y el asiento sigue', async () => {
    const m = montar({
      asientos: [SALIDA_SIN_PEDIDO],
      clientesPorAsiento: new Map([[SALIDA_SIN_PEDIDO.id, [DESAPARECIDO, ZOE]]]),
    });

    const salida = await m.listar(LOTE, LECTOR);

    expect(salida).toHaveLength(1);
    expect(salida[0]?.customerNames).toEqual(['Zoe Alvarez', DESAPARECIDO].sort((a, b) => a.localeCompare(b, 'es')));
  });

  it('R54: un asiento sin pedido sin clientes en el directorio sale con lista vacia', async () => {
    const m = montar({ asientos: [SALIDA_SIN_PEDIDO], refs: [] });

    const salida = await m.listar(LOTE, LECTOR);

    expect(salida[0]?.customerNames).toEqual([]);
    expect(m.customers.findRefsIncludingDeleted).not.toHaveBeenCalled();
  });

  it('R54: sin asientos de entrega sin pedido no se consulta ninguno de los dos directorios nuevos', async () => {
    const m = montar({ asientos: [SALIDA_DE_PEDIDO, AJUSTE] });

    const salida = await m.listar(LOTE, LECTOR);

    expect(salida.map((entrada) => entrada.customerNames)).toEqual([null, null]);
    expect(m.deliveryCustomers.findCustomerIds).not.toHaveBeenCalled();
    expect(m.customers.findRefsIncludingDeleted).not.toHaveBeenCalled();
  });
});
