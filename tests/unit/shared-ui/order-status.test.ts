import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  ASSIGNED_ORDER_PRIORITY_LABELS,
  ASSIGNED_ORDER_STATUS_LABELS,
  COMPANY_ORDER_PRIORITY_LABELS,
  COMPANY_ORDER_STATUS_LABELS,
} from '@/app/(private)/asignacion/components';
import { TRACE_ORDER_STATUS_LABELS } from '@/app/(private)/dashboard/components/execution-trace-format';
import {
  ORDER_COVERAGE_LABELS as RUTA_COVERAGE_LABELS,
  ORDER_PRIORITY_LABELS as RUTA_PRIORITY_LABELS,
  ORDER_STATUS_LABELS as RUTA_STATUS_LABELS,
} from '@/app/(private)/pedidos/components';
import {
  ORDER_COVERAGE_LABELS,
  ORDER_COVERAGE_TONES,
  ORDER_PRIORITY_LABELS,
  ORDER_PRIORITY_LEVELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  type OrderCoverageKey,
  type OrderPriorityKey,
  type OrderStatusKey,
} from '@/lib/shared/ui/order-status';
import type { OrderCoverage } from '@/lib/modules/inventario';
import type { OrderPriority, OrderStatus } from '@/lib/modules/pedidos';

const raiz = process.cwd();

function archivosDe(directorio: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(directorio)) {
    const ruta = join(directorio, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivosDe(ruta));
    else if (/\.(ts|tsx)$/.test(nombre)) salida.push(ruta);
  }
  return salida;
}

// Un mapa propio es un objeto literal tipado por estado, prioridad o cobertura de pedido cuyos
// valores son textos escritos a mano.
const MAPA_PROPIO =
  /Record<\s*(OrderStatus|OrderPriority|OrderCoverage|AssignedOrderView\['status'\]|ExecutionTraceRow\['status'\])\s*,\s*string\s*>>?\s*=\s*\{[^}]*['"`]/;

describe('mapa de pedido', () => {
  it('R10 — reparte los tonos de estado según el tablero', () => {
    expect(ORDER_STATUS_TONES).toEqual({
      PENDIENTE: 'neutral',
      EN_CURSO: 'progress',
      EN_EMPAQUE: 'progress',
      EN_ACONDICIONAMIENTO: 'progress',
      POR_EMPACAR: 'waiting',
      POR_ACONDICIONAR: 'waiting',
      TERMINADO: 'success',
      ENTREGADO: 'success',
      CANCELADO: 'muted',
      BLOQUEADO: 'danger',
    });
  });

  it('R10 — reparte los tonos de cobertura según el tablero', () => {
    expect(ORDER_COVERAGE_TONES).toEqual({ full: 'success', none: 'neutral', partial: 'waiting' });
  });

  it('R10 — conserva los textos de hoy', () => {
    expect(ORDER_STATUS_LABELS).toEqual({
      PENDIENTE: 'Pendiente',
      EN_CURSO: 'En fabricación',
      POR_EMPACAR: 'Por empacar',
      EN_EMPAQUE: 'En empaque',
      ENTREGADO: 'Entregado',
      CANCELADO: 'Cancelado',
      BLOQUEADO: 'Bloqueado',
      POR_ACONDICIONAR: 'Por acondicionar',
      EN_ACONDICIONAMIENTO: 'En acondicionamiento',
      TERMINADO: 'Terminado',
    });
    expect(ORDER_PRIORITY_LABELS).toEqual({
      BAJA: 'Baja',
      MEDIA: 'Media',
      ALTA: 'Alta',
      CRITICA: 'Crítica',
    });
    expect(ORDER_COVERAGE_LABELS).toEqual({
      full: 'Apartado',
      none: 'Sin apartar',
      partial: 'Sin cobertura completa',
    });
  });

  it('R10 — da a cada prioridad su nivel de PriorityMark, con Crítica en el 4', () => {
    expect(ORDER_PRIORITY_LEVELS).toEqual({ BAJA: 1, MEDIA: 2, ALTA: 3, CRITICA: 4 });
  });

  it('R10 — las claves del mapa son exactamente las del dominio: si falta o sobra una, no compila', () => {
    expectTypeOf<OrderStatusKey>().toEqualTypeOf<OrderStatus>();
    expectTypeOf<OrderPriorityKey>().toEqualTypeOf<OrderPriority>();
    expectTypeOf<OrderCoverageKey>().toEqualTypeOf<OrderCoverage>();
  });

  it('R11 — las constantes de las rutas conservan su nombre y leen del mapa único', () => {
    expect(RUTA_STATUS_LABELS).toBe(ORDER_STATUS_LABELS);
    expect(RUTA_PRIORITY_LABELS).toBe(ORDER_PRIORITY_LABELS);
    expect(RUTA_COVERAGE_LABELS).toBe(ORDER_COVERAGE_LABELS);
    expect(COMPANY_ORDER_STATUS_LABELS).toBe(ORDER_STATUS_LABELS);
    expect(COMPANY_ORDER_PRIORITY_LABELS).toBe(ORDER_PRIORITY_LABELS);
    expect(ASSIGNED_ORDER_PRIORITY_LABELS).toBe(ORDER_PRIORITY_LABELS);
    expect(TRACE_ORDER_STATUS_LABELS).toBe(ORDER_STATUS_LABELS);
    expect(ASSIGNED_ORDER_STATUS_LABELS).toEqual({
      PENDIENTE: ORDER_STATUS_LABELS.PENDIENTE,
      EN_CURSO: ORDER_STATUS_LABELS.EN_CURSO,
      BLOQUEADO: ORDER_STATUS_LABELS.BLOQUEADO,
    });
  });

  it('R11 — ningún archivo de app/ declara un mapa propio de etiquetas de pedido', () => {
    const conMapaPropio = archivosDe(join(raiz, 'app'))
      .filter((archivo) => MAPA_PROPIO.test(readFileSync(archivo, 'utf8')))
      .map((archivo) => relative(raiz, archivo).replaceAll('\\', '/'));

    expect(conMapaPropio).toEqual([]);
  });

  it('R11 — el detector reconoce un mapa propio escrito a mano', () => {
    expect(MAPA_PROPIO.test("const X: Readonly<Record<OrderStatus, string>> = { PENDIENTE: 'Pendiente' };")).toBe(
      true,
    );
    expect(
      MAPA_PROPIO.test(
        "const X: Readonly<Record<AssignedOrderView['status'], string>> =\n  { PENDIENTE: 'Pendiente' };",
      ),
    ).toBe(true);
    expect(MAPA_PROPIO.test('const X: Readonly<Record<OrderStatus, boolean>> = { PENDIENTE: true };')).toBe(
      false,
    );
  });
});
