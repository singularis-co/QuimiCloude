// Cuantos pedidos en curso con fotos bloquean mover o quitar pasos de una formula.
import { describe, expect, it, vi } from 'vitest';

import { createCountEvidenceLockingOrders } from '@/lib/modules/asignaciones/domain/count-evidence-locking-orders';

import type { OrderCatalog, OrderStatus } from '@/lib/modules/pedidos';

import { EMPRESA, OTRA_EMPRESA, filaFoto, repositorioEnMemoria, uuid } from './evidence-doubles';

import type { EvidencePhase } from '@/lib/modules/asignaciones/domain/step-evidence';

const RECETA = uuid('a');
const VERSION = uuid('b');
const OTRA_RECETA = uuid('c');

type Pedido = { readonly id: string; readonly recipeId: string; readonly status: OrderStatus };

function pedido(seed: string, status: OrderStatus, recipeId = RECETA): Pedido {
  return { id: uuid(seed), recipeId, status };
}

/** El catalogo pagina de 2 en 2 aunque se le pidan mas, para que el recorrido tenga que seguir. */
function catalogo(pedidos: readonly Pedido[], tamano = 2) {
  const listAliveSummariesInCompany = vi.fn(
    async (companyId: string, statuses: readonly OrderStatus[], _ordering: string, page: number) => {
      const visibles = companyId === EMPRESA ? pedidos.filter((p) => statuses.includes(p.status)) : [];
      const totalPages = Math.max(1, Math.ceil(visibles.length / tamano));
      const items = visibles.slice((page - 1) * tamano, page * tamano);
      return { items, total: visibles.length, page, pageSize: tamano, totalPages };
    },
  );
  return { orders: { listAliveSummariesInCompany } as unknown as OrderCatalog, listAliveSummariesInCompany };
}

function foto(orderId: string, phase: EvidencePhase, companyId = EMPRESA) {
  return { ...filaFoto({ id: uuid('f'), slot: 1, phase }, companyId), orderId };
}

describe('countEvidenceLockingOrders (R8-R12)', () => {
  it('R9, R10: cuenta EN_CURSO con fotos de fabricacion y EN_EMPAQUE con fotos de envasado', async () => {
    const a = pedido('1', 'EN_CURSO');
    const b = pedido('2', 'EN_EMPAQUE');
    const { orders } = catalogo([a, b]);
    const { repo } = repositorioEnMemoria([foto(a.id, 'manufacturing'), foto(b.id, 'packing')]);
    await expect(createCountEvidenceLockingOrders({ orders, evidence: repo })(EMPRESA, [RECETA])).resolves.toBe(2);
    expect(repo.listOrderIdsWithEvidence).toHaveBeenCalledWith(EMPRESA, [
      { orderId: a.id, phase: 'manufacturing' },
      { orderId: b.id, phase: 'packing' },
    ]);
  });

  it('R12: las fotos de la otra fase no cuentan: EN_EMPAQUE con fotos solo de fabricacion no bloquea', async () => {
    const a = pedido('1', 'EN_CURSO');
    const b = pedido('2', 'EN_EMPAQUE');
    const { orders } = catalogo([a, b]);
    const { repo } = repositorioEnMemoria([foto(a.id, 'packing'), foto(b.id, 'manufacturing')]);
    await expect(createCountEvidenceLockingOrders({ orders, evidence: repo })(EMPRESA, [RECETA])).resolves.toBe(0);
  });

  it('R12 (QC-299 R34): pide solo pedidos EN_CURSO, EN_EMPAQUE y EN_ACONDICIONAMIENTO; los de otros estados no cuentan', async () => {
    const { orders, listAliveSummariesInCompany } = catalogo([
      pedido('1', 'PENDIENTE'),
      pedido('2', 'POR_EMPACAR'),
      pedido('3', 'ENTREGADO'),
      pedido('4', 'CANCELADO'),
      pedido('5', 'POR_ACONDICIONAR'),
      pedido('6', 'TERMINADO'),
    ]);
    const { repo } = repositorioEnMemoria();
    await expect(createCountEvidenceLockingOrders({ orders, evidence: repo })(EMPRESA, [RECETA])).resolves.toBe(0);
    expect(listAliveSummariesInCompany.mock.calls[0]?.[1]).toEqual(['EN_CURSO', 'EN_EMPAQUE', 'EN_ACONDICIONAMIENTO']);
    expect(listAliveSummariesInCompany.mock.calls[0]?.[2]).toBe('work_queue');
    expect(repo.listOrderIdsWithEvidence).not.toHaveBeenCalled();
  });

  it('R12: ignora pedidos de otras recetas y pedidos sin fotos', async () => {
    const deOtra = pedido('1', 'EN_CURSO', OTRA_RECETA);
    const sinFotos = pedido('2', 'EN_CURSO');
    const conFotos = pedido('3', 'EN_CURSO');
    const { orders } = catalogo([deOtra, sinFotos, conFotos]);
    const { repo } = repositorioEnMemoria([foto(deOtra.id, 'manufacturing'), foto(conFotos.id, 'manufacturing')]);
    await expect(createCountEvidenceLockingOrders({ orders, evidence: repo })(EMPRESA, [RECETA])).resolves.toBe(1);
    expect(repo.listOrderIdsWithEvidence.mock.calls[0]?.[1].map((c) => c.orderId)).toEqual([sinFotos.id, conFotos.id]);
  });

  it('R9: cuenta los pedidos de cualquiera de las recetas pedidas (la original y sus versiones)', async () => {
    const a = pedido('1', 'EN_CURSO');
    const b = pedido('2', 'EN_CURSO', VERSION);
    const { orders } = catalogo([a, b]);
    const { repo } = repositorioEnMemoria([foto(a.id, 'manufacturing'), foto(b.id, 'manufacturing')]);
    await expect(
      createCountEvidenceLockingOrders({ orders, evidence: repo })(EMPRESA, [RECETA, VERSION]),
    ).resolves.toBe(2);
  });

  it('R9: pagina hasta el final', async () => {
    const pedidos = ['1', '2', '3', '4', '5'].map((s) => pedido(s, 'EN_CURSO'));
    const { orders, listAliveSummariesInCompany } = catalogo(pedidos);
    const { repo } = repositorioEnMemoria([foto(pedidos[4]!.id, 'manufacturing')]);
    await expect(createCountEvidenceLockingOrders({ orders, evidence: repo })(EMPRESA, [RECETA])).resolves.toBe(1);
    expect(listAliveSummariesInCompany.mock.calls.map((c) => c[3])).toEqual([1, 2, 3]);
  });

  it('R39: lee pedidos y fotos de la empresa indicada; las fotos de otra empresa no cuentan', async () => {
    const a = pedido('1', 'EN_CURSO');
    const { orders, listAliveSummariesInCompany } = catalogo([a]);
    const { repo } = repositorioEnMemoria([foto(a.id, 'manufacturing', OTRA_EMPRESA)]);
    await expect(createCountEvidenceLockingOrders({ orders, evidence: repo })(EMPRESA, [RECETA])).resolves.toBe(0);
    expect(listAliveSummariesInCompany.mock.calls[0]?.[0]).toBe(EMPRESA);
    expect(repo.listOrderIdsWithEvidence.mock.calls[0]?.[0]).toBe(EMPRESA);
  });

  it('sin recetas no consulta nada', async () => {
    const { orders, listAliveSummariesInCompany } = catalogo([pedido('1', 'EN_CURSO')]);
    const { repo } = repositorioEnMemoria();
    await expect(createCountEvidenceLockingOrders({ orders, evidence: repo })(EMPRESA, [])).resolves.toBe(0);
    expect(listAliveSummariesInCompany).not.toHaveBeenCalled();
    expect(repo.listOrderIdsWithEvidence).not.toHaveBeenCalled();
  });
});

describe('countEvidenceLockingOrders — acondicionamiento (QC-299: R34, R32)', () => {
  it('R34: un pedido EN_ACONDICIONAMIENTO con fotos de acondicionamiento bloquea', async () => {
    const a = pedido('1', 'EN_ACONDICIONAMIENTO');
    const { orders } = catalogo([a]);
    const { repo } = repositorioEnMemoria([foto(a.id, 'conditioning')]);
    await expect(createCountEvidenceLockingOrders({ orders, evidence: repo })(EMPRESA, [RECETA])).resolves.toBe(1);
    expect(repo.listOrderIdsWithEvidence).toHaveBeenCalledWith(EMPRESA, [{ orderId: a.id, phase: 'conditioning' }]);
  });

  it('R34: cuenta tambien los pedidos EN_ACONDICIONAMIENTO de una version de la formula', async () => {
    const a = pedido('1', 'EN_ACONDICIONAMIENTO', VERSION);
    const { orders } = catalogo([a]);
    const { repo } = repositorioEnMemoria([foto(a.id, 'conditioning')]);
    await expect(
      createCountEvidenceLockingOrders({ orders, evidence: repo })(EMPRESA, [RECETA, VERSION]),
    ).resolves.toBe(1);
  });

  it('R34: EN_ACONDICIONAMIENTO sin fotos, o solo con fotos de fabricacion o envasado, no bloquea', async () => {
    const sinFotos = pedido('1', 'EN_ACONDICIONAMIENTO');
    const otrasFases = pedido('2', 'EN_ACONDICIONAMIENTO');
    const { orders } = catalogo([sinFotos, otrasFases]);
    const { repo } = repositorioEnMemoria([foto(otrasFases.id, 'manufacturing'), foto(otrasFases.id, 'packing')]);
    await expect(createCountEvidenceLockingOrders({ orders, evidence: repo })(EMPRESA, [RECETA])).resolves.toBe(0);
  });

  it('R34: las fotos de acondicionamiento no bloquean un pedido de otra fase', async () => {
    const a = pedido('1', 'EN_CURSO');
    const b = pedido('2', 'EN_EMPAQUE');
    const { orders } = catalogo([a, b]);
    const { repo } = repositorioEnMemoria([foto(a.id, 'conditioning'), foto(b.id, 'conditioning')]);
    await expect(createCountEvidenceLockingOrders({ orders, evidence: repo })(EMPRESA, [RECETA])).resolves.toBe(0);
  });

  it('R32: las fotos de acondicionamiento de otra empresa no cuentan', async () => {
    const a = pedido('1', 'EN_ACONDICIONAMIENTO');
    const { orders } = catalogo([a]);
    const { repo } = repositorioEnMemoria([foto(a.id, 'conditioning', OTRA_EMPRESA)]);
    await expect(createCountEvidenceLockingOrders({ orders, evidence: repo })(EMPRESA, [RECETA])).resolves.toBe(0);
  });
});
