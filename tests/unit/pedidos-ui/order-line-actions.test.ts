// QT-314 T10 — Qué acciones admite cada receta y qué ofrece el pedido entero.

import { describe, expect, it } from 'vitest';

import {
  LINE_ACTION_DISABLED_REASONS,
  canCancelOrder,
  canDeleteOrder,
  canEditOrder,
  lineAcceptsAction,
  lineActionDisabledReason,
  orderOffersLineAction,
  responsiblesFrozen,
  type LineActionKind,
} from '@/app/(private)/pedidos/components';
import type { OrderLineStatus, OrderStatus } from '@/lib/modules/pedidos';

const ESTADOS_DE_RECETA: readonly OrderLineStatus[] = [
  'PENDIENTE',
  'EN_CURSO',
  'BLOQUEADO',
  'POR_EMPACAR',
  'EN_EMPAQUE',
  'POR_ACONDICIONAR',
  'EN_ACONDICIONAMIENTO',
  'TERMINADO',
  'ENTREGADO',
  'CANCELADO',
];

const ESTADOS_DE_PEDIDO: readonly OrderStatus[] = ['PARCIAL', ...ESTADOS_DE_RECETA];

function admiten(kind: LineActionKind): OrderLineStatus[] {
  return ESTADOS_DE_RECETA.filter((status) => lineAcceptsAction(kind, { status }));
}

function parcial(...statuses: OrderLineStatus[]) {
  return { status: 'PARCIAL' as const, lines: statuses.map((status) => ({ status })) };
}

describe('lineAcceptsAction con todos los estados de receta (R26, R27)', () => {
  it('R26: «Reparto y unidad» solo en POR_EMPACAR', () => {
    expect(admiten('distribution')).toEqual(['POR_EMPACAR']);
  });

  it('R26: «Entregar» solo en TERMINADO', () => {
    expect(admiten('deliver')).toEqual(['TERMINADO']);
  });

  it('R26: «Entregas» en TERMINADO y ENTREGADO', () => {
    expect(admiten('deliveries')).toEqual(['TERMINADO', 'ENTREGADO']);
  });

  it('R26: «Cancelar receta» en los estados cancelables: PENDIENTE, EN_CURSO y BLOQUEADO', () => {
    expect(admiten('cancelLine')).toEqual(['PENDIENTE', 'EN_CURSO', 'BLOQUEADO']);
  });
});

describe('los motivos de una receta que no admite la acción (R27)', () => {
  it('R27: los del tablero, uno por acción', () => {
    expect(LINE_ACTION_DISABLED_REASONS).toEqual({
      distribution: 'Solo Por empacar',
      deliver: 'Aún no está terminada',
      deliveries: 'Sin entregas',
      cancelLine: 'No se puede cancelar en este estado',
    });
  });

  it('R27: sin motivo la que admite, con el suyo la que no', () => {
    expect(lineActionDisabledReason('deliver', { status: 'TERMINADO' })).toBeNull();
    expect(lineActionDisabledReason('deliver', { status: 'EN_CURSO' })).toBe('Aún no está terminada');
    expect(lineActionDisabledReason('cancelLine', { status: 'CANCELADO' })).toBe(
      'No se puede cancelar en este estado',
    );
  });
});

describe('orderOffersLineAction en pedidos PARCIAL (R26)', () => {
  it('R26: un PARCIAL con una receta POR_EMPACAR ofrece «Reparto y unidad»; sin ella, no', () => {
    expect(orderOffersLineAction('distribution', parcial('POR_EMPACAR', 'TERMINADO'))).toBe(true);
    expect(orderOffersLineAction('distribution', parcial('EN_EMPAQUE', 'TERMINADO'))).toBe(false);
  });

  it('R26: un PARCIAL con una receta TERMINADO ofrece «Entregar»; con solo ENTREGADO, no', () => {
    expect(orderOffersLineAction('deliver', parcial('EN_CURSO', 'TERMINADO'))).toBe(true);
    expect(orderOffersLineAction('deliver', parcial('EN_CURSO', 'ENTREGADO'))).toBe(false);
  });

  it('R26: un PARCIAL con una receta ENTREGADO ofrece «Entregas»; sin terminadas ni entregadas, no', () => {
    expect(orderOffersLineAction('deliveries', parcial('PENDIENTE', 'ENTREGADO'))).toBe(true);
    expect(orderOffersLineAction('deliveries', parcial('PENDIENTE', 'POR_EMPACAR'))).toBe(false);
  });

  it('R26: un PARCIAL con una receta cancelable ofrece «Cancelar receta»; con canceladas y terminadas, no', () => {
    expect(orderOffersLineAction('cancelLine', parcial('BLOQUEADO', 'TERMINADO'))).toBe(true);
    expect(orderOffersLineAction('cancelLine', parcial('CANCELADO', 'TERMINADO'))).toBe(false);
  });
});

describe('canEditOrder (R9)', () => {
  it('R9: habilitado en todo estado salvo ENTREGADO y CANCELADO, PARCIAL incluido', () => {
    const editables = ESTADOS_DE_PEDIDO.filter((status) => canEditOrder({ status }));

    expect(editables).toEqual(ESTADOS_DE_PEDIDO.filter((s) => s !== 'ENTREGADO' && s !== 'CANCELADO'));
    expect(canEditOrder({ status: 'PARCIAL' })).toBe(true);
  });
});

describe('canCancelOrder (R36)', () => {
  it('R36: un PARCIAL con alguna receta activa cancelable se puede cancelar', () => {
    expect(canCancelOrder(parcial('TERMINADO', 'EN_CURSO'))).toBe(true);
  });

  it('R36: un PARCIAL sin recetas cancelables no se puede cancelar', () => {
    expect(canCancelOrder(parcial('TERMINADO', 'CANCELADO', 'POR_EMPACAR'))).toBe(false);
  });
});

describe('canDeleteOrder (R37)', () => {
  it('R37: con el pedido y todas sus recetas en estado borrable, sí', () => {
    expect(canDeleteOrder({ status: 'PENDIENTE', lines: [{ status: 'PENDIENTE' }, { status: 'BLOQUEADO' }] })).toBe(
      true,
    );
  });

  it('R37: un PARCIAL con una receta ya fabricada no se elimina', () => {
    expect(canDeleteOrder(parcial('PENDIENTE', 'TERMINADO'))).toBe(false);
  });

  it('R37: un PARCIAL de recetas que aún no se fabricaron sigue la misma regla que el servidor', () => {
    expect(canDeleteOrder(parcial('PENDIENTE', 'EN_CURSO'))).toBe(true);
  });

  it('R37: ENTREGADO y CANCELADO no se eliminan', () => {
    expect(canDeleteOrder({ status: 'ENTREGADO', lines: [{ status: 'ENTREGADO' }] })).toBe(false);
    expect(canDeleteOrder({ status: 'CANCELADO', lines: [{ status: 'CANCELADO' }] })).toBe(false);
  });
});

describe('responsiblesFrozen (R38)', () => {
  it('R38: fuera de PARCIAL, abierto solo en PENDIENTE, EN_CURSO y BLOQUEADO, como hoy', () => {
    const abiertos = ESTADOS_DE_RECETA.filter((status) => !responsiblesFrozen({ status, lines: [{ status }] }));

    expect(abiertos).toEqual(['PENDIENTE', 'EN_CURSO', 'BLOQUEADO']);
  });

  it('R38: un PARCIAL con una receta activa en PENDIENTE, EN_CURSO o BLOQUEADO no está congelado', () => {
    expect(responsiblesFrozen(parcial('TERMINADO', 'PENDIENTE'))).toBe(false);
    expect(responsiblesFrozen(parcial('ENTREGADO', 'EN_CURSO'))).toBe(false);
    expect(responsiblesFrozen(parcial('POR_EMPACAR', 'BLOQUEADO'))).toBe(false);
  });

  it('R38: un PARCIAL con solo recetas fabricadas o canceladas está congelado', () => {
    expect(responsiblesFrozen(parcial('TERMINADO', 'CANCELADO', 'ENTREGADO'))).toBe(true);
  });
});
