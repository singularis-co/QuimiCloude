import { describe, expect, it, vi } from 'vitest';

import { createListFinishedProductDistribution } from '@/lib/modules/inventario/domain/list-finished-product-distribution';
import { ProductNotFoundError, UnauthorizedError, ValidationError } from '@/lib/modules/inventario/domain/errors';
import {
  FINISHED_PRESENTATION_ID,
  FINISHED_PRODUCT_ID,
  finishedProductPage,
} from '@/tests/fixtures/finished-product-detail';

import type { Actor } from '@/lib/modules/inventario/domain/actor';
import type {
  FinishedDistributionDirectory,
  FinishedDistributionLine,
} from '@/lib/modules/inventario/domain/finished-product-detail';
import type { FinishedProductRecord } from '@/lib/modules/inventario/ports/finished-product-detail-repository';

const EMPRESA = 'company-a';
const RECETA = 'd0000000-0000-4000-8000-000000000281';
const LECTOR: Actor = { id: 'u-lector', companyId: EMPRESA, permissions: ['inventario.consultar'] };

const REGISTRO: FinishedProductRecord = {
  id: FINISHED_PRODUCT_ID,
  name: 'Limpiador multiusos',
  imagePath: null,
  qtyAlert: null,
  unitId: null,
  recipeId: RECETA,
  presentation: { id: FINISHED_PRESENTATION_ID, name: 'Botella 1 L', content: '1.0000', unitId: null },
  batches: [],
};

function linea(overrides: Partial<FinishedDistributionLine> = {}): FinishedDistributionLine {
  return {
    lineId: '30000000-0000-4000-8000-000000000281',
    orderNumberText: '2026-0000003',
    plan: 10,
    packedPackages: 10,
    reason: null,
    reasonOther: null,
    ...overrides,
  };
}

/** Una fila por cada forma que la tab pinta, en el orden en que la devuelve el directorio. */
const LINEAS: readonly FinishedDistributionLine[] = [
  linea({ lineId: 'l-igual', orderNumberText: '2026-0000006' }),
  linea({ lineId: 'l-menos', orderNumberText: '2026-0000005', packedPackages: 8, reason: 'merma' }),
  linea({ lineId: 'l-mas', orderNumberText: '2026-0000004', packedPackages: 12, reason: 'conteo_fisico' }),
  linea({
    lineId: 'l-otro',
    orderNumberText: '2026-0000003',
    packedPackages: 9,
    reason: 'otro',
    reasonOther: 'Se cayo una caja',
  }),
  linea({ lineId: 'l-cero', orderNumberText: '2026-0000002', packedPackages: 0, reason: 'rotura' }),
  linea({ lineId: 'l-antes', orderNumberText: '2026-0000001', packedPackages: null }),
];

function montar(record: FinishedProductRecord | null = REGISTRO, items: readonly FinishedDistributionLine[] = LINEAS) {
  const findAliveFinished = vi.fn(async () => record);
  const distribution: FinishedDistributionDirectory = {
    listPackedLines: vi.fn<FinishedDistributionDirectory['listPackedLines']>(async (_c, _k, paging) =>
      finishedProductPage(items, { page: paging.page, pageSize: paging.pageSize ?? 10 }),
    ),
  };
  return {
    findAliveFinished,
    distribution,
    listar: createListFinishedProductDistribution({ products: { findAliveFinished }, distribution }),
  };
}

describe('listFinishedProductDistribution', () => {
  it('R26: sin inventario.consultar responde unauthorized y no llama a ningun puerto', async () => {
    const m = montar();
    const sinPermiso: Actor = { id: 'u-sin', companyId: EMPRESA, permissions: ['pedidos.consultar', 'empaque.modificar'] };

    await expect(m.listar(FINISHED_PRODUCT_ID, {}, sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(m.listar(FINISHED_PRODUCT_ID, {}, null)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(m.findAliveFinished).not.toHaveBeenCalled();
    expect(m.distribution.listPackedLines).not.toHaveBeenCalled();
  });

  it('R29: un producto de otra empresa o borrado responde product_not_found y no lista el reparto', async () => {
    const ajeno = montar(null);

    await expect(ajeno.listar(FINISHED_PRODUCT_ID, {}, LECTOR)).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(ajeno.findAliveFinished).toHaveBeenCalledWith(FINISHED_PRODUCT_ID, { companyId: EMPRESA });
    expect(ajeno.distribution.listPackedLines).not.toHaveBeenCalled();
  });

  it('R29: un id que no es uuid responde igual que uno que no existe', async () => {
    const m = montar();

    await expect(m.listar('no-es-uuid', {}, LECTOR)).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(m.findAliveFinished).not.toHaveBeenCalled();
  });

  it('R26: pide al directorio las lineas de la empresa del actor, con la receta y la presentacion del producto', async () => {
    const m = montar();

    await m.listar(FINISHED_PRODUCT_ID, { page: 2 }, LECTOR);

    expect(m.distribution.listPackedLines).toHaveBeenCalledWith(
      EMPRESA,
      { recipeId: RECETA, presentationId: FINISHED_PRESENTATION_ID },
      { page: 2 },
    );
  });

  it('R26: pasa el tamano de pagina 10 o 25 al directorio y devuelve su pagina', async () => {
    for (const pageSize of [10, 25]) {
      const m = montar();

      const pagina = await m.listar(FINISHED_PRODUCT_ID, { page: 1, pageSize }, LECTOR);

      expect(m.distribution.listPackedLines).toHaveBeenCalledWith(EMPRESA, expect.anything(), { page: 1, pageSize });
      expect(pagina.pageSize).toBe(pageSize);
    }
  });

  it('R26: una entrada de paginacion invalida responde invalid_input sin listar', async () => {
    const m = montar();

    await expect(m.listar(FINISHED_PRODUCT_ID, { page: 0 }, LECTOR)).rejects.toBeInstanceOf(ValidationError);
    await expect(m.listar(FINISHED_PRODUCT_ID, { page: 1, extra: true }, LECTOR)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(m.distribution.listPackedLines).not.toHaveBeenCalled();
  });

  it('R27: devuelve tal cual las filas igual, menos, mas, Otro con su texto, en 0 y sin conteo guardado', async () => {
    const m = montar();

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items).toEqual(LINEAS);
    expect(pagina.items.find((l) => l.lineId === 'l-otro')).toMatchObject({ reason: 'otro', reasonOther: 'Se cayo una caja' });
    expect(pagina.items.find((l) => l.lineId === 'l-cero')?.packedPackages).toBe(0);
    expect(pagina.items.find((l) => l.lineId === 'l-antes')).toMatchObject({ plan: 10, packedPackages: null, reason: null });
  });

  it('R26: un producto sin receta o sin presentacion devuelve una pagina vacia sin consultar el reparto', async () => {
    for (const record of [{ ...REGISTRO, recipeId: null }, { ...REGISTRO, presentation: null }]) {
      const m = montar(record);

      await expect(m.listar(FINISHED_PRODUCT_ID, { page: 1, pageSize: 50 }, LECTOR)).resolves.toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      });
      expect(m.distribution.listPackedLines).not.toHaveBeenCalled();
    }
  });
});
