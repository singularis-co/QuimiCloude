import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import {
  mockAllIsIntersecting,
  resetIntersectionMocking,
  setupIntersectionMocking,
} from 'react-intersection-observer/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupUser } from '../../helpers/user-event';
import { NARROW_VIEWPORT, WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';

const { panelProps, getSessionUserMock, cookiesMock, usePathnameMock } = vi.hoisted(() => ({
  panelProps: { current: null as Record<string, unknown> | null },
  getSessionUserMock: vi.fn(),
  cookiesMock: vi.fn(),
  usePathnameMock: vi.fn<() => string>(() => '/ruta-de-prueba'),
}));

vi.mock('@/lib/modules/notificaciones/adapters/driving/notification-actions', () => ({
  getNotificationSummaryAction: vi.fn(() => new Promise(() => undefined)),
  listNotificationsAction: vi.fn(() => new Promise(() => undefined)),
  markNotificationReadAction: vi.fn(() => new Promise(() => undefined)),
  markAllNotificationsReadAction: vi.fn(() => new Promise(() => undefined)),
}));

// Se envuelve el `PopoverContent` real para leer lo que la campana le pasa: jsdom no hace layout,
// así que el ancla y los márgenes de colisión no se pueden medir en el DOM.
vi.mock('@/components/ui/popover', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/ui/popover')>();
  function PopoverContent(props: ComponentProps<typeof real.PopoverContent>) {
    panelProps.current = props as Record<string, unknown>;
    return <real.PopoverContent {...props} />;
  }
  return { ...real, PopoverContent };
});

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: usePathnameMock,
  redirect: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));

vi.mock('@/lib/modules/identity/adapters/driving/logout-action', () => ({
  logoutAction: vi.fn(),
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, endSession: vi.fn() },
}));

import PrivateLayout from '@/app/(private)/layout';
import {
  NOTIFICATION_BELL_TEXTS,
  NOTIFICATION_TAIL_TEXTS,
  NotificationBell,
  NotificationsProvider,
  PHONE_PANEL_COLLISION_PADDING,
  type NotificationsActions,
} from '@/app/(private)/components/notifications';
import type { NotificationFeed, NotificationSummary } from '@/app/(private)/components/notifications/notification-feed';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { SessionUser } from '@/lib/modules/identity';
import type {
  NotificationActionResult,
  NotificationBatchView,
  NotificationView,
} from '@/lib/modules/notificaciones/adapters/driving/notification-actions';

const at = (n: number) => new Date(Date.UTC(2026, 9, 19, 10, n)).toISOString();

const view = (n: number, read = false): NotificationView => ({
  id: `n${n}`,
  tone: 'success',
  title: `Aviso ${n}`,
  body: 'Se leyó el archivo.',
  bodyTime: null,
  linkLabel: 'Ver fórmulas',
  href: '/formulas',
  createdAt: at(n),
  read,
});

/** Del más reciente al más antiguo, como los devuelve el servidor. */
const range = (from: number, to: number, read = false) =>
  Array.from({ length: from - to + 1 }, (_, i) => view(from - i, read));

type BatchResult = NotificationActionResult<NotificationBatchView>;

const batch = (items: NotificationView[], nextCursor: string | null): BatchResult => ({
  ok: true,
  data: { items, nextCursor },
});

const FAILED: BatchResult = { ok: false, code: 'unexpected' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function fakeFeed() {
  let onSummary: ((s: NotificationSummary) => void) | null = null;
  const feed: NotificationFeed = {
    start(listener) {
      onSummary = listener;
      return () => {
        onSummary = null;
      };
    },
    refresh: vi.fn(async () => undefined),
  };
  const emit = (unreadCount: number, newest: number | null = null) =>
    act(() => {
      onSummary?.({
        status: 'ready',
        unreadCount,
        newest: newest === null ? null : { id: `n${newest}`, createdAt: at(newest) },
      });
    });
  return { feed, emit };
}

function fakeActions() {
  return {
    fetchBatch: vi.fn<NotificationsActions['fetchBatch']>(),
    markRead: vi.fn<NotificationsActions['markRead']>(async () => ({ ok: true as const })),
    markAllRead: vi.fn<NotificationsActions['markAllRead']>(async () => ({
      ok: true as const,
      data: { marked: 3 },
    })),
  } satisfies NotificationsActions;
}

function renderBell() {
  const { feed, emit } = fakeFeed();
  const actions = fakeActions();
  render(
    <header data-testid="cabecera">
      <TooltipProvider>
        <NotificationsProvider userId="u1" feed={feed} bus={null} chime={null} actions={actions}>
          <NotificationBell />
        </NotificationsProvider>
      </TooltipProvider>
    </header>,
  );
  return { emit, actions };
}

const bell = () => screen.getByTestId('notification-bell');
const panel = () => screen.getByTestId('notification-panel');
const rows = () => within(panel()).getAllByRole('link');
const user = () => setupUser();

async function openWith(actions: ReturnType<typeof fakeActions>, first: BatchResult) {
  actions.fetchBatch.mockResolvedValueOnce(first);
  await user().click(bell());
  return panel();
}

beforeAll(() => {
  setupIntersectionMocking(vi.fn);
});

beforeEach(() => {
  panelProps.current = null;
  setViewportWidth(WIDE_VIEWPORT);
});

afterEach(() => {
  cleanup();
  resetIntersectionMocking();
  resetViewport();
});

describe('NotificationBell', () => {
  it('R22: el nombre accesible dice cuántos hay sin leer, o «ninguna sin leer»', () => {
    const { emit } = renderBell();

    emit(3, 3);
    expect(bell()).toHaveAccessibleName('Notificaciones, 3 sin leer');
    expect(within(bell()).getByTestId('unread-count-badge')).toHaveTextContent(/^3$/);

    emit(0, 3);
    expect(bell()).toHaveAccessibleName('Notificaciones, ninguna sin leer');
    expect(within(bell()).queryByTestId('unread-count-badge')).toBeNull();
  });

  it('R23: al abrir pinta el primer lote de 10 del más reciente al más antiguo y «Marcar todas…» con no leídos', async () => {
    const { emit, actions } = renderBell();
    emit(2, 12);

    await openWith(actions, batch(range(12, 3), 'c1'));

    await waitFor(() => expect(rows()).toHaveLength(10));
    expect(actions.fetchBatch).toHaveBeenCalledWith({ cursor: null });
    expect(rows().map((row) => row.getAttribute('aria-label')?.split('.')[0])).toEqual(
      range(12, 3).map((item) => item.title),
    );
    expect(panel()).toHaveAttribute('role', 'dialog');
    expect(within(panel()).getByRole('button', { name: NOTIFICATION_BELL_TEXTS.markAll })).toBeInTheDocument();

    emit(0, 12);
    expect(within(panel()).queryByRole('button', { name: NOTIFICATION_BELL_TEXTS.markAll })).toBeNull();
  });

  it('R25: el centinela a la vista pide el lote siguiente, pinta «Cargando más avisos…» y no pide otro mientras tanto', async () => {
    const { emit, actions } = renderBell();
    emit(0, 12);
    await openWith(actions, batch(range(12, 3), 'c1'));
    await waitFor(() => expect(rows()).toHaveLength(10));

    const next = deferred<BatchResult>();
    actions.fetchBatch.mockReturnValueOnce(next.promise);
    act(() => mockAllIsIntersecting(true));

    expect(actions.fetchBatch).toHaveBeenCalledTimes(2);
    expect(actions.fetchBatch).toHaveBeenLastCalledWith({ cursor: 'c1' });
    expect(within(panel()).getByRole('status')).toHaveTextContent(NOTIFICATION_TAIL_TEXTS.loading);

    act(() => mockAllIsIntersecting(false));
    act(() => mockAllIsIntersecting(true));
    expect(actions.fetchBatch).toHaveBeenCalledTimes(2);

    await act(async () => next.resolve(batch(range(2, 1), null)));
    expect(rows()).toHaveLength(12);
    expect(rows().at(-1)).toHaveAccessibleName(/^Aviso 1\./);
  });

  it('R26: si falla el lote siguiente, conserva las filas, no vuelve a pedir solo y «Reintentar» pide el mismo', async () => {
    const { emit, actions } = renderBell();
    emit(0, 12);
    await openWith(actions, batch(range(12, 3), 'c1'));
    await waitFor(() => expect(rows()).toHaveLength(10));

    actions.fetchBatch.mockResolvedValueOnce(FAILED);
    await act(async () => mockAllIsIntersecting(true));

    const alert = await within(panel()).findByRole('alert');
    expect(alert).toHaveTextContent(NOTIFICATION_TAIL_TEXTS.error);
    expect(rows()).toHaveLength(10);

    act(() => mockAllIsIntersecting(true));
    expect(actions.fetchBatch).toHaveBeenCalledTimes(2);

    actions.fetchBatch.mockResolvedValueOnce(batch(range(2, 1), null));
    await user().click(within(alert).getByRole('button', { name: NOTIFICATION_TAIL_TEXTS.retry }));

    expect(actions.fetchBatch).toHaveBeenCalledTimes(3);
    expect(actions.fetchBatch).toHaveBeenLastCalledWith({ cursor: 'c1' });
    await waitFor(() => expect(rows()).toHaveLength(12));
  });

  it('R27: sin más lotes pinta «No hay más avisos. Se conservan 90 días.» y no pide más', async () => {
    const { emit, actions } = renderBell();
    emit(0, 3);
    await openWith(actions, batch(range(3, 1), null));

    expect(await within(panel()).findByText(NOTIFICATION_TAIL_TEXTS.end)).toBeInTheDocument();
    act(() => mockAllIsIntersecting(true));
    expect(actions.fetchBatch).toHaveBeenCalledTimes(1);
  });

  it('R31: el clic en un aviso lo marca leído, cierra el panel y lleva a su origen', async () => {
    const { emit, actions } = renderBell();
    emit(1, 2);
    await openWith(actions, batch([view(2), view(1, true)], null));
    await waitFor(() => expect(rows()).toHaveLength(2));

    const first = rows()[0] as HTMLElement;
    expect(first).toHaveAttribute('href', '/formulas');
    await user().click(first);

    expect(actions.markRead).toHaveBeenCalledWith('n2');
    await waitFor(() => expect(bell()).toHaveAccessibleName('Notificaciones, ninguna sin leer'));
    await waitFor(() => expect(screen.queryByTestId('notification-panel')).toBeNull());
  });

  it('R32: «Marcar todas como leídas» deja el conteo a 0 y las filas cargadas como leídas', async () => {
    const { emit, actions } = renderBell();
    emit(5, 3);
    await openWith(actions, batch(range(3, 1), 'c1'));
    await waitFor(() => expect(rows()).toHaveLength(3));

    await user().click(within(panel()).getByRole('button', { name: NOTIFICATION_BELL_TEXTS.markAll }));

    expect(actions.markAllRead).toHaveBeenCalledTimes(1);
    expect(bell()).toHaveAccessibleName('Notificaciones, ninguna sin leer');
    expect(rows().map((row) => row.getAttribute('data-read'))).toEqual(['true', 'true', 'true']);
    expect(within(panel()).queryByRole('button', { name: NOTIFICATION_BELL_TEXTS.markAll })).toBeNull();
  });

  it('R33: esqueletos mientras carga el primer lote y «No tienes notificaciones.» sin avisos', async () => {
    const { emit, actions } = renderBell();
    emit(0, null);
    const first = deferred<BatchResult>();
    actions.fetchBatch.mockReturnValueOnce(first.promise);
    await user().click(bell());

    expect(within(panel()).getByRole('status', { name: NOTIFICATION_BELL_TEXTS.loading })).toBeInTheDocument();
    expect(within(panel()).getByTestId('notification-skeletons').children).toHaveLength(5);

    await act(async () => first.resolve(batch([], null)));
    expect(within(panel()).getByText(NOTIFICATION_BELL_TEXTS.empty)).toBeInTheDocument();
    expect(within(panel()).queryByText(NOTIFICATION_TAIL_TEXTS.end)).toBeNull();
  });

  it('R33: si falla el primer lote pinta el error y «Reintentar» vuelve a pedir el primer lote', async () => {
    const { emit, actions } = renderBell();
    emit(1, 1);
    await openWith(actions, FAILED);

    const alert = await within(panel()).findByRole('alert');
    expect(alert).toHaveTextContent(NOTIFICATION_BELL_TEXTS.firstError);

    actions.fetchBatch.mockResolvedValueOnce(batch([view(1)], null));
    await user().click(within(alert).getByRole('button', { name: NOTIFICATION_BELL_TEXTS.retry }));

    expect(actions.fetchBatch).toHaveBeenCalledTimes(2);
    expect(actions.fetchBatch).toHaveBeenLastCalledWith({ cursor: null });
    await waitFor(() => expect(rows()).toHaveLength(1));
  });

  it('R34: en escritorio el panel va bajo la campana, con 400 px de ancho y 520 px de alto con scroll', async () => {
    const { emit, actions } = renderBell();
    emit(0, 1);
    await openWith(actions, batch([view(1)], null));

    expect(panelProps.current?.anchor).toBeUndefined();
    expect(panelProps.current?.collisionPadding).toBeUndefined();
    expect(panel().className.split(/\s+/)).toContain('w-[400px]');
    const area = screen.getByTestId('notification-scroll-area');
    expect(area.className.split(/\s+/)).toEqual(expect.arrayContaining(['h-[520px]', 'overflow-y-auto']));
    expect(panel()).toContainElement(area);
  });

  it('R34: en tablet (820 px) el panel es el de escritorio', async () => {
    setViewportWidth(820);
    const { emit, actions } = renderBell();
    emit(0, 1);
    await openWith(actions, batch([view(1)], null));

    expect(panelProps.current?.anchor).toBeUndefined();
    expect(panel().className.split(/\s+/)).toContain('w-[400px]');
  });

  it('R35: en el teléfono el panel se ancla a la cabecera, 8 px por lado y arriba, 16 abajo, sin salirse, con filas de 44 px', async () => {
    setViewportWidth(NARROW_VIEWPORT);
    const { emit, actions } = renderBell();
    emit(1, 2);
    await openWith(actions, batch([view(2), view(1, true)], null));
    await waitFor(() => expect(rows()).toHaveLength(2));

    const anchor = panelProps.current?.anchor as () => Element | null;
    expect(typeof anchor).toBe('function');
    expect(anchor()).toBe(screen.getByTestId('cabecera'));
    expect(panelProps.current?.collisionPadding).toEqual({ top: 8, right: 8, bottom: 16, left: 8 });
    expect(PHONE_PANEL_COLLISION_PADDING).toEqual({ top: 8, right: 8, bottom: 16, left: 8 });
    expect(panelProps.current?.positionerClassName).toBe('w-[calc(100vw-16px)]');
    expect(panel().parentElement?.className.split(/\s+/)).toContain('w-[calc(100vw-16px)]');

    const panelClasses = panel().className.split(/\s+/);
    expect(panelClasses).toContain('max-h-(--available-height)');
    expect(panelClasses).not.toContain('w-[400px]');
    const area = screen.getByTestId('notification-scroll-area');
    expect(area.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['min-h-0', 'flex-1', 'overflow-y-auto']),
    );
    expect(area.className).not.toMatch(/h-\[520px\]/);

    for (const row of rows()) expect(row.className.split(/\s+/)).toContain('min-h-11');
  });

  it('R36: al llegar un aviso la campana se balancea bajo motion-safe, y no al cargar', () => {
    const { emit } = renderBell();
    const icon = () => screen.getByTestId('notification-bell-icon');
    const classes = () => (icon().getAttribute('class') ?? '').split(/\s+/);

    emit(2, 2);
    expect(classes().some((c) => c.includes('notification-bell-swing'))).toBe(false);

    emit(2, 2);
    expect(classes().some((c) => c.includes('notification-bell-swing'))).toBe(false);

    emit(3, 3);
    expect(classes()).toContain('motion-safe:animate-notification-bell-swing');
    expect(classes().filter((c) => c.includes('notification-bell-swing'))).toEqual([
      'motion-safe:animate-notification-bell-swing',
    ]);

    const css = readFileSync(join(RAIZ, 'app', 'globals.css'), 'utf8');
    expect(css).toMatch(/@keyframes notification-bell-swing\s*\{/);
    const utility = /@utility animate-notification-bell-swing\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(utility).toMatch(/animation:\s*notification-bell-swing 700ms var\(--ease-(standard|enter|exit)\) both;/);
    expect(utility).not.toMatch(/infinite/);
  });

  it('R56: con el resumen vacío del Maestro, campana sin insignia, "ninguna sin leer" y panel "No tienes notificaciones." sin error', async () => {
    const { emit, actions } = renderBell();
    emit(0, null);

    expect(bell()).toHaveAccessibleName('Notificaciones, ninguna sin leer');
    expect(within(bell()).queryByTestId('unread-count-badge')).toBeNull();

    await openWith(actions, batch([], null));

    expect(await within(panel()).findByText(NOTIFICATION_BELL_TEXTS.empty)).toBeInTheDocument();
    expect(within(panel()).queryByRole('alert')).toBeNull();
    expect(within(panel()).queryByText(NOTIFICATION_BELL_TEXTS.firstError)).toBeNull();
    expect(within(panel()).queryByRole('button', { name: NOTIFICATION_BELL_TEXTS.markAll })).toBeNull();

    emit(0, null);
    expect(bell()).toHaveAccessibleName('Notificaciones, ninguna sin leer');
    expect(within(panel()).getByText(NOTIFICATION_BELL_TEXTS.empty)).toBeInTheDocument();
  });
});

const RAIZ = join(__dirname, '..', '..', '..');

const usuario = (permissions: string[]): SessionUser => ({
  id: 'u-campana',
  username: 'ana',
  displayName: 'Ana Pérez',
  roleName: 'Operador',
  permissions,
});

describe('montaje en el layout privado', () => {
  beforeEach(() => {
    cookiesMock.mockResolvedValue({ get: () => undefined });
  });

  it('R19: con sesión monta la campana en la cabecera aunque no tenga ningún permiso (las notificaciones son núcleo)', async () => {
    for (const permissions of [[], ['inventario.consultar']]) {
      getSessionUserMock.mockResolvedValueOnce(usuario(permissions));
      render(await PrivateLayout({ children: <div /> }));

      const header = screen.getByTestId('private-header');
      expect(within(header).getByTestId('notification-bell')).toHaveAccessibleName(
        'Notificaciones, ninguna sin leer',
      );
      cleanup();
    }
  });

  it('R19: el layout no condiciona la campana a ningún permiso ni añadido de notificaciones', () => {
    const fuente = readFileSync(join(RAIZ, 'app', '(private)', 'layout.tsx'), 'utf8');
    expect(fuente).toContain('<NotificationBell />');
    expect(fuente).not.toMatch(/notificaciones\.consultar/);
    expect(fuente).not.toMatch(/isCompanyAddonActive|addon/i);
  });
});
