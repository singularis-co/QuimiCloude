import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  OrderCoverageBadge,
  OrderPriorityBadge,
  OrderStatusBadge,
} from '@/app/(private)/pedidos/components';
import type { StatusTone } from '@/lib/shared/ui/status-tone';
import type { OrderCoverage } from '@/lib/modules/inventario';
import type { OrderPriority, OrderStatus } from '@/lib/modules/pedidos';

afterEach(() => {
  cleanup();
});

// Tablas escritas a mano a proposito: si el mapa compartido cambia, este test lo nota.
const ESTADOS: Readonly<Record<OrderStatus, { tone: StatusTone; label: string }>> = {
  PENDIENTE: { tone: 'neutral', label: 'Pendiente' },
  EN_CURSO: { tone: 'progress', label: 'En fabricación' },
  POR_EMPACAR: { tone: 'waiting', label: 'Por empacar' },
  EN_EMPAQUE: { tone: 'progress', label: 'En empaque' },
  ENTREGADO: { tone: 'success', label: 'Entregado' },
  CANCELADO: { tone: 'muted', label: 'Cancelado' },
  BLOQUEADO: { tone: 'danger', label: 'Bloqueado' },
  POR_ACONDICIONAR: { tone: 'waiting', label: 'Por acondicionar' },
  EN_ACONDICIONAMIENTO: { tone: 'progress', label: 'En acondicionamiento' },
  TERMINADO: { tone: 'success', label: 'Terminado' },
};

const PRIORIDADES: Readonly<Record<OrderPriority, { level: number; label: string }>> = {
  BAJA: { level: 1, label: 'Baja' },
  MEDIA: { level: 2, label: 'Media' },
  ALTA: { level: 3, label: 'Alta' },
  CRITICA: { level: 4, label: 'Crítica' },
};

const COBERTURAS: Readonly<Record<OrderCoverage, { tone: StatusTone; label: string }>> = {
  full: { tone: 'success', label: 'Apartado' },
  none: { tone: 'neutral', label: 'Sin apartar' },
  partial: { tone: 'waiting', label: 'Sin cobertura completa' },
};

describe('estado del pedido', () => {
  it.each(Object.entries(ESTADOS) as [OrderStatus, (typeof ESTADOS)[OrderStatus]][])(
    'R5: %s es un StatusBadge con su tono, su etiqueta y sus data-* de hoy',
    (status, { tone, label }) => {
      render(<OrderStatusBadge status={status} />);
      const badge = screen.getByTestId('order-status');

      expect(badge).toHaveAttribute('data-slot', 'badge');
      expect(badge).toHaveAttribute('data-tone', tone);
      expect(badge).toHaveAttribute('data-status', status);
      expect(badge).toHaveTextContent(label);
      expect(badge.querySelector('[data-slot="status-dot"]')).toHaveAttribute('aria-hidden', 'true');
    },
  );
});

describe('prioridad del pedido', () => {
  it.each(Object.entries(PRIORIDADES) as [OrderPriority, (typeof PRIORIDADES)[OrderPriority]][])(
    'R6: %s es un PriorityMark con su nivel, su etiqueta y sus data-* de hoy',
    (priority, { level, label }) => {
      render(<OrderPriorityBadge priority={priority} />);
      const mark = screen.getByTestId('order-priority');

      expect(mark).not.toHaveAttribute('data-slot', 'badge');
      expect(mark).toHaveAttribute('data-level', String(level));
      expect(mark).toHaveAttribute('data-priority', priority);
      expect(mark).toHaveTextContent(label);
    },
  );

  it('R6: solo la prioridad critica pinta el icono de critica en vez de barras', () => {
    render(<OrderPriorityBadge priority="CRITICA" />);
    const mark = screen.getByTestId('order-priority');

    expect(mark.querySelectorAll('rect[data-filled]')).toHaveLength(0);
    expect(mark.querySelector('[data-slot="priority-icon"]')).toHaveAttribute('aria-hidden', 'true');
  });

  it('R6: alta llena las tres barras y baja solo una', () => {
    const { unmount } = render(<OrderPriorityBadge priority="ALTA" />);
    expect(
      screen.getByTestId('order-priority').querySelectorAll('rect[data-filled="true"]'),
    ).toHaveLength(3);
    unmount();

    render(<OrderPriorityBadge priority="BAJA" />);
    expect(
      screen.getByTestId('order-priority').querySelectorAll('rect[data-filled="true"]'),
    ).toHaveLength(1);
  });
});

describe('cobertura del pedido', () => {
  it.each(Object.entries(COBERTURAS) as [OrderCoverage, (typeof COBERTURAS)[OrderCoverage]][])(
    'R7: %s es un StatusBadge con su tono, su etiqueta y sus data-* de hoy',
    (coverage, { tone, label }) => {
      render(<OrderCoverageBadge coverage={coverage} />);
      const badge = screen.getByTestId('order-coverage');

      expect(badge).toHaveAttribute('data-slot', 'badge');
      expect(badge).toHaveAttribute('data-tone', tone);
      expect(badge).toHaveAttribute('data-coverage', coverage);
      expect(badge).toHaveTextContent(label);
    },
  );
});
