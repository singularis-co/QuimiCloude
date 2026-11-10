// Las direcciones de las pantallas de una receta y los parametros de sus avisos.
import { describe, expect, it } from 'vitest';

import * as rutas from '@/lib/shared/routes';

const PEDIDO = '3f1c9b2e-8d47-4a10-9c65-2b7e4f0a1d38';
const LINEA = '9a2d4c6e-1b3f-4a5c-8d7e-0f1a2b3c4d5e';

describe('las pantallas de una receta llevan la receta en la consulta', () => {
  it('R9, R11: ejecucion, empaque y acondicionamiento nombran la receta con `?receta=<lineId>`', () => {
    expect(rutas.RECIPE_PARAM).toBe('receta');
    expect(rutas.assignedOrderRoute(PEDIDO, LINEA)).toBe(`/asignacion/${PEDIDO}?receta=${LINEA}`);
    expect(rutas.packingOrderRoute(PEDIDO, LINEA)).toBe(`/asignacion/empaque/${PEDIDO}?receta=${LINEA}`);
    expect(rutas.conditioningOrderRoute(PEDIDO, LINEA)).toBe(`/asignacion/acondicionamiento/${PEDIDO}?receta=${LINEA}`);
  });

  it('R11: la receta se lee de la consulta con `RECIPE_PARAM`', () => {
    for (const ruta of [
      rutas.assignedOrderRoute(PEDIDO, LINEA),
      rutas.packingOrderRoute(PEDIDO, LINEA),
      rutas.conditioningOrderRoute(PEDIDO, LINEA),
    ]) {
      expect(new URL(ruta, 'http://localhost').searchParams.getAll(rutas.RECIPE_PARAM)).toEqual([LINEA]);
    }
  });

  it('R14: el `lineId` es obligatorio en los tres helpers', () => {
    expect(rutas.assignedOrderRoute.length).toBe(2);
    expect(rutas.packingOrderRoute.length).toBe(2);
    expect(rutas.conditioningOrderRoute.length).toBe(2);
  });

  it('el Recorrido sigue siendo del pedido', () => {
    expect(rutas.executionTraceRoute(PEDIDO)).toBe(`/dashboard/recorrido/${PEDIDO}`);
  });
});

describe('los parametros de los avisos de vuelta a la lista', () => {
  it('R19: el aviso de fabricacion terminada se llama `fabricado` y ningun parametro dice «entregado»', () => {
    expect(rutas.MANUFACTURED_ORDER_PARAM).toBe('fabricado');
    const nombres = Object.keys(rutas);
    expect(nombres.filter((nombre) => nombre.startsWith('DELIVERED_ORDER'))).toEqual([]);
    const valores = Object.values(rutas as Record<string, unknown>).filter((valor): valor is string => typeof valor === 'string');
    expect(valores.filter((valor) => /entregado/.test(valor))).toEqual([]);
  });

  it('R20: la receta del aviso viaja en `receta_aviso`, distinto del parametro de las pantallas', () => {
    expect(rutas.OUTCOME_RECIPE_PARAM).toBe('receta_aviso');
    expect(rutas.OUTCOME_RECIPE_PARAM).not.toBe(rutas.RECIPE_PARAM);
  });
});
