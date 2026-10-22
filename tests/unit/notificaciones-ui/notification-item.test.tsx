import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { setupUser } from '../../helpers/user-event';

vi.mock('@/lib/modules/notificaciones/adapters/driving/notification-actions', () => ({
  getNotificationSummaryAction: vi.fn(),
  listNotificationsAction: vi.fn(),
  markNotificationReadAction: vi.fn(),
  markAllNotificationsReadAction: vi.fn(),
}));

import {
  NotificationItem,
  renderNotificationBody,
  type NotificationEntrance,
} from '@/app/(private)/components/notifications';
import type { NotificationView } from '@/lib/modules/notificaciones/adapters/driving/notification-actions';

const ZONE = 'America/Santo_Domingo';
const NOW = Date.parse('2026-10-19T19:00:00.000Z');

function view(overrides: Partial<NotificationView> = {}): NotificationView {
  return {
    id: 'n1',
    tone: 'success',
    title: 'Tanda de PDFs procesada',
    body: 'Se leyeron los 3 archivos de la tanda que subiste a las {hora}.',
    bodyTime: '2026-10-19T18:52:00.000Z',
    linkLabel: 'Ver fórmulas',
    href: '/formulas',
    createdAt: '2026-10-19T18:57:00.000Z',
    read: false,
    ...overrides,
  };
}

function renderItem(notification: NotificationView, entrance?: NotificationEntrance) {
  const onSelect = vi.fn();
  const utils = render(
    <NotificationItem notification={notification} now={NOW} onSelect={onSelect} entrance={entrance} timeZone={ZONE} />,
  );
  return { ...utils, onSelect };
}

describe('NotificationItem', () => {
  it.each([
    ['success', 'file-check'],
    ['warning', 'file-exclamation-point'],
    ['danger', 'file-x'],
  ] as const)('R29: el tono %s lleva su icono', (tone, icon) => {
    const { container } = renderItem(view({ tone }));
    const box = container.querySelector(`[data-tone="${tone}"]`);
    expect(box).not.toBeNull();
    expect(box?.querySelector(`svg[class*="lucide-${icon}"]`)).not.toBeNull();
  });

  it('R29: un aviso no leído lleva fondo tintado, título en negrita, punto y nombre que termina en «Sin leer»', () => {
    const { container } = renderItem(view());
    const row = screen.getByRole('link');
    expect(row).toHaveAccessibleName(
      'Tanda de PDFs procesada. Se leyeron los 3 archivos de la tanda que subiste a las 14:52. hace 3 min. Sin leer',
    );
    expect(row.className).toMatch(/\bbg-primary\/7\b/);
    expect(screen.getByText('Tanda de PDFs procesada')).toHaveClass('font-semibold');
    expect(container.querySelector('[data-slot="unread-dot"]')).not.toBeNull();
  });

  it('R29: uno leído no lleva tinte, ni negrita, ni punto, ni «Sin leer»', () => {
    const { container } = renderItem(view({ read: true }));
    const row = screen.getByRole('link');
    expect(row.getAttribute('aria-label')).not.toMatch(/Sin leer/);
    expect(row.className).not.toMatch(/bg-primary\/7/);
    expect(screen.getByText('Tanda de PDFs procesada')).not.toHaveClass('font-semibold');
    expect(container.querySelector('[data-slot="unread-dot"]')).toBeNull();
  });

  it('R29: muestra título, texto, enlace a su origen y hora', () => {
    renderItem(view());
    expect(screen.getByRole('link')).toHaveAttribute('href', '/formulas');
    expect(screen.getByText('Ver fórmulas')).toBeInTheDocument();
    expect(screen.getByText('hace 3 min')).toBeInTheDocument();
  });

  it('R31: al pulsar avisa con el aviso; sin destino es un botón', async () => {
    const { onSelect, unmount } = renderItem(view());
    await setupUser().click(screen.getByRole('link'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }));
    unmount();

    renderItem(view({ href: null }));
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.queryByText('Ver fórmulas')).toBeNull();
  });

  it('R47: sustituye {hora} por HH:MM de bodyTime en la zona del navegador', () => {
    renderItem(view());
    expect(
      screen.getByText('Se leyeron los 3 archivos de la tanda que subiste a las 14:52.'),
    ).toBeInTheDocument();
  });

  it('R47: el nombre de archivo con <b> se pinta como texto', () => {
    const { container } = renderItem(
      view({ tone: 'danger', body: 'No se pudo leer "<b>x</b>.pdf", de la tanda que subiste a las {hora}.' }),
    );
    expect(screen.getByText('No se pudo leer "<b>x</b>.pdf", de la tanda que subiste a las 14:52.')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
  });

  it('R47: sin bodyTime quita la marca junto con « a las »', () => {
    expect(renderNotificationBody('Se leyó el archivo de la tanda que subiste a las {hora}.', null)).toBe(
      'Se leyó el archivo de la tanda que subiste.',
    );
    expect(renderNotificationBody('Se leyeron 2 de 3 archivos.', null)).toBe('Se leyeron 2 de 3 archivos.');
  });

  it('R35: el área táctil de la fila es de al menos 44 px de alto', () => {
    renderItem(view());
    expect(screen.getByRole('link')).toHaveClass('min-h-11');
  });

  it.each(['arrive', 'fade'] as const)('R36: las clases de animación de %s van todas bajo motion-safe', (entrance) => {
    renderItem(view(), entrance);
    const classes = screen.getByRole('link').className.split(/\s+/);
    const motion = classes.filter((c) => /animate-|fade-|slide-|duration-|ease-/.test(c));
    expect(motion.length).toBeGreaterThan(0);
    expect(motion.every((c) => c.startsWith('motion-safe:'))).toBe(true);
    expect(motion).toContain('motion-safe:fade-in');
    if (entrance === 'arrive') expect(motion).toContain('motion-safe:slide-in-from-top-2');
    else expect(motion.some((c) => c.includes('slide-in'))).toBe(false);
  });

  it('R36: sin entrada no hay animación', () => {
    renderItem(view());
    expect(screen.getByRole('link').className).not.toMatch(/animate-/);
  });
});
