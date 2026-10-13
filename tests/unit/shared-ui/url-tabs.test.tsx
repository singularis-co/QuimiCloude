import { cleanup, render, screen, within } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';

import { UrlTabs, type UrlTabItem } from '@/components/shared/url-tabs';

afterEach(cleanup);

function classesOf(element: Element): Set<string> {
  return new Set((element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));
}

const ITEMS: readonly UrlTabItem[] = [
  { value: 'asignados', href: '/asignacion?vista=asignados', label: 'Mis asignados', icon: Inbox, count: 3, testId: 'tab-asignados' },
  { value: 'terminados', href: '/asignacion?vista=terminados', label: 'Terminados', testId: 'tab-terminados' },
  { value: 'todos', href: '/asignacion?vista=todos', label: 'Todos', count: 0, testId: 'tab-todos' },
];

function renderTabs(current = 'terminados') {
  return render(<UrlTabs label="Vistas de asignación" current={current} items={ITEMS} testId="vistas" />);
}

describe('UrlTabs', () => {
  it('R31 — cada pestaña es un enlace real a su dirección', () => {
    renderTabs();

    const lista = screen.getByRole('tablist', { name: 'Vistas de asignación' });
    expect(lista).toHaveAttribute('data-testid', 'vistas');

    for (const item of ITEMS) {
      const pestana = screen.getByTestId(item.testId as string);
      expect(pestana.tagName).toBe('A');
      expect(pestana).toHaveAttribute('href', item.href);
    }
  });

  it('R31 — la pestaña vigente la decide el consumidor y queda seleccionada', () => {
    renderTabs('terminados');
    expect(screen.getByTestId('tab-terminados')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-asignados')).toHaveAttribute('aria-selected', 'false');
    cleanup();

    renderTabs('todos');
    expect(screen.getByTestId('tab-todos')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-terminados')).toHaveAttribute('aria-selected', 'false');
  });

  it('R31 — cada pestaña mide al menos 44 px de alto', () => {
    renderTabs();
    for (const item of ITEMS) {
      const clases = classesOf(screen.getByTestId(item.testId as string));
      expect(clases.has('min-h-11'), item.value).toBe(true);
      expect(clases.has('h-auto'), item.value).toBe(true);
    }
  });

  it('R31 — admite icono y contador visibles', () => {
    renderTabs();

    const asignados = screen.getByTestId('tab-asignados');
    const icono = asignados.querySelector('svg');
    expect(icono).not.toBeNull();
    expect(icono).toHaveAttribute('aria-hidden', 'true');
    expect(within(asignados).getByText('3')).toHaveAttribute('data-slot', 'url-tabs-count');

    expect(within(screen.getByTestId('tab-todos')).getByText('0')).toBeInTheDocument();
    expect(screen.getByTestId('tab-terminados').querySelector('[data-slot="url-tabs-count"]')).toBeNull();
  });

  it('R31 — un indicador se desliza en 200 ms hasta la pestaña vigente', () => {
    renderTabs();

    const lista = screen.getByRole('tablist');
    const indicador = lista.querySelector('[data-slot="tabs-indicator"]') as HTMLElement;
    expect(indicador).not.toBeNull();
    expect(lista.firstElementChild).toBe(indicador);
    expect(classesOf(lista).has('relative')).toBe(true);

    const clases = classesOf(indicador);
    expect(clases.has('transition-[translate,width]')).toBe(true);
    expect(clases.has('duration-(--dur-base)')).toBe(true);
    expect(clases.has('translate-x-(--active-tab-left)')).toBe(true);
    expect(clases.has('w-(--active-tab-width)')).toBe(true);
  });

  it('R31 — por debajo del ancho disponible las pestañas se desplazan en horizontal sin saltar de línea', () => {
    renderTabs();
    const clases = classesOf(screen.getByRole('tablist'));
    expect(clases.has('flex-nowrap')).toBe(true);
    expect(clases.has('overflow-x-auto')).toBe(true);
    for (const item of ITEMS) {
      expect(classesOf(screen.getByTestId(item.testId as string)).has('flex-none')).toBe(true);
    }
  });
});
