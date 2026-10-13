import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { STATUS_TONES, StatusBadge, type StatusTone } from '@/components/shared/status-badge';
import { STATUS_TONES as TONOS_DE_LIB } from '@/lib/shared/ui/status-tone';

function classesOf(element: Element): string[] {
  return (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

function dotOf(badge: HTMLElement): HTMLElement {
  const dot = badge.querySelector<HTMLElement>('[data-slot="status-dot"]');
  if (dot === null) throw new Error('StatusBadge no pinto el punto');
  return dot;
}

const COLORES_ESPERADOS: Readonly<Record<StatusTone, { fondo: string; texto: string; punto: string }>> = {
  neutral: {
    fondo: 'bg-status-neutral-subtle',
    texto: 'text-status-neutral-text',
    punto: 'bg-status-neutral-dot',
  },
  progress: {
    fondo: 'bg-status-progress-subtle',
    texto: 'text-status-progress-text',
    punto: 'bg-status-progress-dot',
  },
  waiting: { fondo: 'bg-warning-subtle', texto: 'text-warning-text', punto: 'bg-warning' },
  success: { fondo: 'bg-success-subtle', texto: 'text-success-text', punto: 'bg-success' },
  danger: { fondo: 'bg-destructive-subtle', texto: 'text-destructive-text', punto: 'bg-destructive' },
  info: { fondo: 'bg-info-subtle', texto: 'text-info-text', punto: 'bg-info' },
  muted: { fondo: 'bg-transparent', texto: 'text-muted-foreground', punto: 'bg-muted-foreground' },
};

afterEach(cleanup);

describe('StatusBadge', () => {
  it('R6 — ofrece exactamente siete tonos', () => {
    expect([...STATUS_TONES].sort()).toEqual(
      ['danger', 'info', 'muted', 'neutral', 'progress', 'success', 'waiting'],
    );
  });

  it('R6 — status-badge reexporta la lista de tonos de lib/shared/ui sin copiarla', () => {
    expect(STATUS_TONES).toBe(TONOS_DE_LIB);
  });

  it.each(STATUS_TONES)('R6 — el tono %s toma fondo, texto y punto de tokens del tema', (tone) => {
    render(
      <StatusBadge tone={tone} data-testid="badge" label="Etiqueta" />,
    );
    const badge = screen.getByTestId('badge');
    const esperado = COLORES_ESPERADOS[tone];

    expect(classesOf(badge)).toEqual(expect.arrayContaining([esperado.fondo, esperado.texto]));
    expect(classesOf(dotOf(badge))).toContain(esperado.punto);
    expect(badge).toHaveAttribute('data-tone', tone);
  });

  it('R6 — el tono muted lleva borde interior en el color del borde', () => {
    render(
      <StatusBadge tone="muted" data-testid="badge" label="Cancelado" />,
    );
    expect(classesOf(screen.getByTestId('badge'))).toEqual(
      expect.arrayContaining(['inset-ring', 'inset-ring-border']),
    );
  });

  it('R7 — la etiqueta es texto visible, el punto está oculto a lectores y no se parte la línea', () => {
    render(
      <StatusBadge tone="neutral" data-testid="badge" label="Pendiente" />,
    );
    const badge = screen.getByTestId('badge');

    expect(badge).toHaveTextContent('Pendiente');
    expect(dotOf(badge)).toHaveAttribute('aria-hidden', 'true');
    expect(dotOf(badge)).toBeEmptyDOMElement();
    expect(classesOf(badge)).toEqual(expect.arrayContaining(['whitespace-nowrap', 'shrink-0']));
  });

  it('R7 — pasa data-* y atributos del span tal cual', () => {
    render(
      <StatusBadge tone="info" data-testid="badge" data-status="EN_CURSO" title="Estado" label="En curso" />,
    );
    const badge = screen.getByTestId('badge');

    expect(badge.tagName).toBe('SPAN');
    expect(badge).toHaveAttribute('data-status', 'EN_CURSO');
    expect(badge).toHaveAttribute('title', 'Estado');
  });

  it('R7 — los children mandan sobre label cuando llegan', () => {
    render(
      <StatusBadge tone="neutral" label="Pendiente" data-testid="badge">
        <strong>Pendiente de revisión</strong>
      </StatusBadge>,
    );
    const badge = screen.getByTestId('badge');

    expect(badge).toHaveTextContent('Pendiente de revisión');
    expect(badge.querySelector('strong')).not.toBeNull();
  });

  it('R8 — solo el tono progress anima su punto con el pulso de 1,6 s en bucle', () => {
    for (const tone of STATUS_TONES) {
      render(
        <StatusBadge tone={tone} data-testid={`badge-${tone}`} label={tone} />,
      );
      const clasesDelPunto = classesOf(dotOf(screen.getByTestId(`badge-${tone}`)));
      const animaciones = clasesDelPunto.filter((clase) => clase.startsWith('animate-'));

      if (tone === 'progress') {
        expect(animaciones).toEqual(['animate-[status-pulse_1.6s_var(--ease-standard)_infinite]']);
      } else {
        expect(animaciones).toEqual([]);
      }
    }
  });

  it('R9 — al cambiar de tono, fondo y texto pasan en 200 ms con la curva estándar sin animar el ancho', () => {
    const { rerender } = render(
      <StatusBadge tone="neutral" data-testid="badge" label="Pendiente" />,
    );
    rerender(
      <StatusBadge tone="progress" data-testid="badge" label="En curso" />,
    );
    const clases = classesOf(screen.getByTestId('badge'));

    expect(clases).toEqual(
      expect.arrayContaining([
        'transition-[background-color,color]',
        'duration-(--dur-base)',
        'ease-(--ease-standard)',
        'bg-status-progress-subtle',
      ]),
    );
    expect(clases).not.toContain('transition-all');
    expect(clases).not.toContain('bg-status-neutral-subtle');
  });
});
