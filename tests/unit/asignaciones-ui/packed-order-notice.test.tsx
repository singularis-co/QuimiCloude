import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PACKED_ORDER_NOTICE_TESTID,
  OrderOutcomeNotice,
  packedOrderNoticeText,
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
});
