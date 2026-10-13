import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ASSIGNED_ORDER_CANCELLED_TESTID,
  ASSIGNED_ORDER_DELIVERED_TESTID,
  CONDITIONED_ORDER_NOTICE_TESTID,
  PACKED_ORDER_NOTICE_TESTID,
  OrderOutcomeNotice,
  packedOrderNoticeText,
  type OrderOutcomeKind,
} from '@/app/(private)/asignacion/components';

afterEach(() => {
  cleanup();
});

describe('OrderOutcomeNotice kind="packed" — confirmacion visible al terminar el empaque', () => {
  it('R7 - nombra el pedido empacado y nunca dice «entregado»', () => {
    render(<OrderOutcomeNotice kind="packed" orderNumber="2026-0000012" />);

    const aviso = screen.getByTestId(PACKED_ORDER_NOTICE_TESTID);
    expect(aviso).toBeVisible();
    expect(aviso).toHaveTextContent('Pedido 2026-0000012 empacado');
    expect(aviso.textContent?.toLowerCase()).not.toContain('entregado');
  });

  it('R7 - el texto sale de una funcion, no de un literal duplicado', () => {
    expect(packedOrderNoticeText('2026-0000013')).toBe('Pedido 2026-0000013 empacado');
    expect(packedOrderNoticeText('2026-0000013').toLowerCase()).not.toContain('entregado');
  });

  it('usa `role="status"` para que un lector de pantalla lo anuncie sin foco', () => {
    render(<OrderOutcomeNotice kind="packed" orderNumber="2026-0000014" />);

    expect(screen.getByTestId(PACKED_ORDER_NOTICE_TESTID)).toHaveAttribute('role', 'status');
  });

  it('R13: se pinta con `Notice` en tono success', () => {
    render(<OrderOutcomeNotice kind="packed" orderNumber="2026-0000015" />);

    const aviso = screen.getByTestId(PACKED_ORDER_NOTICE_TESTID);
    expect(aviso).toHaveAttribute('data-slot', 'alert');
    expect(aviso).toHaveAttribute('data-tone', 'success');
  });
});

describe('R15 — los avisos de /asignacion se cierran con «Cerrar»', () => {
  const CASOS: readonly { kind: OrderOutcomeKind; testId: string }[] = [
    { kind: 'delivered', testId: ASSIGNED_ORDER_DELIVERED_TESTID },
    { kind: 'cancelled', testId: ASSIGNED_ORDER_CANCELLED_TESTID },
    { kind: 'packed', testId: PACKED_ORDER_NOTICE_TESTID },
    { kind: 'conditioned', testId: CONDITIONED_ORDER_NOTICE_TESTID },
  ];

  it.each(CASOS)('R15: el aviso $kind tiene «Cerrar» de 44 × 44 px y al pulsarlo desaparece', ({ kind, testId }) => {
    render(<OrderOutcomeNotice kind={kind} orderNumber="2026-0000016" />);

    const cerrar = screen.getByRole('button', { name: 'Cerrar' });
    expect(cerrar).toHaveClass('size-11');
    expect(cerrar).toHaveAttribute('data-testid', `${testId}-close`);

    fireEvent.click(cerrar);

    expect(screen.queryByTestId(testId)).toBeNull();
  });
});
