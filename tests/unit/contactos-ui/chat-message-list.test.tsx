// El historial del chat: separadores de día, centinela de anteriores con su indicador de carga,
// y el scroll (al final al abrir, posición conservada al anteponer, al final con un mensaje nuevo
// solo si el usuario ya estaba ahí). También el hook del centinela por separado.

import { act, cleanup, render, renderHook, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatMessageList } from '@/app/(private)/clientes/contactos/components/chat-message-list';
import type { ChatMessageView } from '@/app/(private)/clientes/contactos/components/chat-view';
import { useEndSentinel } from '@/app/(private)/clientes/contactos/components/use-end-sentinel';

const NOW = new Date(2026, 9, 23, 12, 0);
const CLIENTE = 'Distribuidora El Roble';

// Geometría simulada: jsdom no maqueta. Cada mensaje mide 100 px y la ventana del historial 300.
const MESSAGE_HEIGHT = 100;
const VIEWPORT_HEIGHT = 300;
const scrollTops = new WeakMap<Element, number>();
const originals = {
  scrollHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight'),
  clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight'),
  scrollTop: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop'),
};

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.querySelectorAll('[data-testid="chat-message"]').length * MESSAGE_HEIGHT;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => VIEWPORT_HEIGHT,
  });
  Object.defineProperty(Element.prototype, 'scrollTop', {
    configurable: true,
    get(this: Element) {
      return scrollTops.get(this) ?? 0;
    },
    set(this: Element, value: number) {
      const max = Math.max(0, (this as HTMLElement).scrollHeight - VIEWPORT_HEIGHT);
      scrollTops.set(this, Math.min(Math.max(0, value), max));
    },
  });
});

afterAll(() => {
  if (originals.scrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originals.scrollHeight);
  if (originals.clientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originals.clientHeight);
  if (originals.scrollTop) Object.defineProperty(Element.prototype, 'scrollTop', originals.scrollTop);
});

// Doble de IntersectionObserver: guarda los observados y deja disparar la intersección a mano.
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly targets = new Set<Element>();
  disconnected = false;

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.disconnected = true;
    this.targets.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  trigger(isIntersecting: boolean) {
    const entries = [...this.targets].map(
      (target) => ({ target, isIntersecting }) as unknown as IntersectionObserverEntry,
    );
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

function showSentinel(isIntersecting = true) {
  act(() => {
    for (const observer of FakeIntersectionObserver.instances) {
      if (!observer.disconnected) observer.trigger(isIntersecting);
    }
  });
}

function mensaje(id: string, at: Date, overrides: Partial<ChatMessageView> = {}): ChatMessageView {
  return {
    id,
    side: 'in',
    at: at.toISOString(),
    author: null,
    delivery: null,
    errorReason: null,
    retryable: false,
    content: { kind: 'text', text: `Texto ${id}` },
    reaction: null,
    ...overrides,
  };
}

function hoy(id: string, hour: number) {
  return mensaje(id, new Date(2026, 9, 23, hour, 0));
}

type Props = ComponentProps<typeof ChatMessageList>;

function props(overrides: Partial<Props> = {}): Props {
  return {
    messages: [hoy('m1', 9), hoy('m2', 10), hoy('m3', 11), hoy('m4', 11), hoy('m5', 11)],
    now: NOW,
    nextCursor: null,
    loadingOlder: false,
    onLoadOlder: vi.fn(),
    customerName: CLIENTE,
    canSend: true,
    onRetry: vi.fn(),
    ...overrides,
  };
}

function lista() {
  return screen.getByTestId('chat-message-list');
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('R17 · orden y separadores de día', () => {
  it('R17: pinta los mensajes de más antiguo a más reciente con «Ayer», «Hoy» y dd/MM/yyyy al cambiar de día', () => {
    const messages = [
      mensaje('viejo', new Date(2026, 8, 30, 8, 0)),
      mensaje('ayer', new Date(2026, 9, 22, 9, 15)),
      mensaje('hoy-1', new Date(2026, 9, 23, 8, 5), { side: 'out', author: { kind: 'system' }, delivery: 'sent' }),
      mensaje('hoy-2', new Date(2026, 9, 23, 10, 40)),
    ];
    render(<ChatMessageList {...props({ messages })} />);

    const items = within(lista())
      .getAllByText(/^(Texto .+|Hoy|Ayer|\d{2}\/\d{2}\/\d{4})$/)
      .map((node) => node.textContent);
    expect(items).toEqual(['30/09/2026', 'Texto viejo', 'Ayer', 'Texto ayer', 'Hoy', 'Texto hoy-1', 'Texto hoy-2']);
    expect(screen.getAllByTestId('chat-day-separator')).toHaveLength(3);
  });

  it('R17: entrantes a la izquierda y salientes a la derecha', () => {
    const messages = [hoy('in', 9), mensaje('out', new Date(2026, 9, 23, 10), { side: 'out', author: { kind: 'system' }, delivery: 'sent' })];
    render(<ChatMessageList {...props({ messages })} />);
    const [entrante, saliente] = screen.getAllByTestId('chat-message');
    expect(entrante).toHaveAttribute('data-side', 'in');
    expect(entrante.className).toContain('self-start');
    expect(saliente).toHaveAttribute('data-side', 'out');
    expect(saliente.className).toContain('self-end');
  });
});

describe('R25 · mensajes anteriores', () => {
  it('R25: con nextCursor, al verse el centinela pide los anteriores con ese cursor', () => {
    const onLoadOlder = vi.fn();
    render(<ChatMessageList {...props({ nextCursor: 'cur-1', onLoadOlder })} />);
    expect(onLoadOlder).not.toHaveBeenCalled();

    showSentinel();
    expect(onLoadOlder).toHaveBeenCalledTimes(1);
    expect(onLoadOlder).toHaveBeenCalledWith('cur-1');
  });

  it('R25: si el centinela no está a la vista no pide', () => {
    const onLoadOlder = vi.fn();
    render(<ChatMessageList {...props({ nextCursor: 'cur-1', onLoadOlder })} />);
    showSentinel(false);
    expect(onLoadOlder).not.toHaveBeenCalled();
  });

  it('R25: sin nextCursor no hay centinela ni petición', () => {
    const onLoadOlder = vi.fn();
    render(<ChatMessageList {...props({ nextCursor: null, onLoadOlder })} />);
    expect(screen.queryByTestId('chat-older-sentinel')).toBeNull();
    showSentinel();
    expect(onLoadOlder).not.toHaveBeenCalled();
  });

  it('R25: muestra «Cargando mensajes anteriores…» mientras llegan y no vuelve a pedir', () => {
    const onLoadOlder = vi.fn();
    render(<ChatMessageList {...props({ nextCursor: 'cur-1', loadingOlder: true, onLoadOlder })} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando mensajes anteriores…');
    showSentinel();
    expect(onLoadOlder).not.toHaveBeenCalled();
  });

  it('R25: sin carga en curso no muestra el indicador', () => {
    render(<ChatMessageList {...props({ nextCursor: 'cur-1' })} />);
    expect(screen.queryByText('Cargando mensajes anteriores…')).toBeNull();
  });

  it('R25: al anteponer anteriores conserva lo que el usuario estaba viendo', () => {
    const base = props({ nextCursor: 'cur-1' });
    const { rerender } = render(<ChatMessageList {...base} />);
    // 5 mensajes = 500 px; el usuario sube hasta arriba del todo.
    act(() => {
      lista().scrollTop = 0;
      lista().dispatchEvent(new Event('scroll'));
    });

    rerender(<ChatMessageList {...base} loadingOlder />);
    const older = [hoy('o1', 6), hoy('o2', 7), hoy('o3', 8)];
    rerender(<ChatMessageList {...base} messages={[...older, ...base.messages]} nextCursor="cur-2" />);

    // 8 mensajes = 800 px; lo que estaba arriba queda 300 px más abajo, en la misma posición en pantalla.
    expect(lista().scrollTop).toBe(3 * MESSAGE_HEIGHT);
  });

  it('R25: con otro cursor tras cargar, al volver a verse el centinela pide la página siguiente', () => {
    const onLoadOlder = vi.fn();
    const base = props({ nextCursor: 'cur-1', onLoadOlder });
    const { rerender } = render(<ChatMessageList {...base} />);
    showSentinel();
    rerender(<ChatMessageList {...base} loadingOlder />);
    rerender(<ChatMessageList {...base} messages={[hoy('o1', 6), ...base.messages]} nextCursor="cur-2" />);
    showSentinel();
    expect(onLoadOlder.mock.calls).toEqual([['cur-1'], ['cur-2']]);
  });
});

describe('R26 · scroll al final', () => {
  it('R26: al abrir el chat muestra el mensaje más reciente', () => {
    render(<ChatMessageList {...props()} />);
    // 500 px de contenido en 300 de ventana: el fondo es scrollTop = 200.
    expect(lista().scrollTop).toBe(5 * MESSAGE_HEIGHT - VIEWPORT_HEIGHT);
  });

  it('R26: con un mensaje nuevo desplaza al final si el usuario ya estaba al final', () => {
    const base = props();
    const { rerender } = render(<ChatMessageList {...base} />);
    rerender(<ChatMessageList {...base} messages={[...base.messages, hoy('nuevo', 12)]} />);
    expect(lista().scrollTop).toBe(6 * MESSAGE_HEIGHT - VIEWPORT_HEIGHT);
  });

  it('R26: a menos de 48 px del fondo cuenta como al final', () => {
    const base = props();
    const { rerender } = render(<ChatMessageList {...base} />);
    act(() => {
      lista().scrollTop = 5 * MESSAGE_HEIGHT - VIEWPORT_HEIGHT - 40;
      lista().dispatchEvent(new Event('scroll'));
    });
    rerender(<ChatMessageList {...base} messages={[...base.messages, hoy('nuevo', 12)]} />);
    expect(lista().scrollTop).toBe(6 * MESSAGE_HEIGHT - VIEWPORT_HEIGHT);
  });

  it('R26: con un mensaje nuevo no desplaza si el usuario estaba leyendo más arriba', () => {
    const base = props();
    const { rerender } = render(<ChatMessageList {...base} />);
    act(() => {
      lista().scrollTop = 50;
      lista().dispatchEvent(new Event('scroll'));
    });
    rerender(<ChatMessageList {...base} messages={[...base.messages, hoy('nuevo', 12)]} />);
    expect(lista().scrollTop).toBe(50);
  });
});

describe('useEndSentinel', () => {
  function observar(options: Parameters<typeof useEndSentinel>[0]) {
    const node = document.createElement('div');
    const hook = renderHook((current: Parameters<typeof useEndSentinel>[0]) => useEndSentinel(current), {
      initialProps: options,
    });
    act(() => hook.result.current(node));
    return { ...hook, node };
  }

  it('R13, R25: llama al callback cuando el centinela pasa a verse', () => {
    const onVisible = vi.fn();
    const { node } = observar({ onVisible });
    expect(FakeIntersectionObserver.instances.at(-1)?.targets.has(node)).toBe(true);
    showSentinel();
    expect(onVisible).toHaveBeenCalledTimes(1);
  });

  it('R13, R25: deshabilitado no observa ni llama', () => {
    const onVisible = vi.fn();
    observar({ onVisible, enabled: false });
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    showSentinel();
    expect(onVisible).not.toHaveBeenCalled();
  });

  it('R13, R25: al deshabilitarse desconecta el observador', () => {
    const onVisible = vi.fn();
    const { rerender } = observar({ onVisible });
    const observer = FakeIntersectionObserver.instances.at(-1);
    rerender({ onVisible, enabled: false });
    expect(observer?.disconnected).toBe(true);
  });

  it('R13, R25: sin IntersectionObserver en el entorno no falla ni llama', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const onVisible = vi.fn();
    expect(() => observar({ onVisible })).not.toThrow();
    expect(onVisible).not.toHaveBeenCalled();
  });
});
