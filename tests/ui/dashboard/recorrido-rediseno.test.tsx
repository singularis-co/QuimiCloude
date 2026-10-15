// El recorrido rediseñado. Cada bloque `describe` agrupa una pieza para que se puedan añadir los
// casos del detalle sin tocar los de la línea de tiempo.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ExecutionTimeline } from '@/app/(private)/dashboard/recorrido/[id]/components/execution-timeline';
import {
  BACK_TO_LIST_TEXT,
  ExecutionTraceDetail,
  ExecutionTraceDetailError,
} from '@/app/(private)/dashboard/recorrido/[id]/components';
import {
  ACTIVE_ORDER_MARK,
  DELETED_ORDER_MARK,
  EXECUTION_ACTION_LABELS,
  GO_BACK_MARK,
  TRACE_ORDER_STATUS_LABELS,
  formatElapsed,
  formatTraceDuration,
  formatTraceInstant,
} from '@/app/(private)/dashboard/components';
import type {
  ExecutionAction,
  ExecutionTraceDetail as ExecutionTraceDetailData,
  ExecutionTraceDetailStep,
} from '@/lib/modules/asignaciones';
import { UNEXPECTED_ERROR_CODE } from '@/lib/modules/errores';
import { DASHBOARD_ROUTE } from '@/lib/shared/routes';
import { ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';
import { avatarTone } from '@/lib/shared/ui/avatar-tone';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

const ORDER_ID = '0b1c2d3e-4f50-4a61-8b72-c3d4e5f60718';
const MIN = 60 * 1000;

function step(overrides: Partial<ExecutionTraceDetailStep> & Pick<ExecutionTraceDetailStep, 'id' | 'action'>): ExecutionTraceDetailStep {
  return {
    orderId: ORDER_ID,
    userId: 'u1',
    userDisplayName: 'Ana Ruiz',
    stepPosition: 1,
    reason: null,
    batchLines: null,
    occurredAt: new Date('2026-10-07T08:00:00.000Z'),
    gapToNextMs: 5 * MIN,
    isGoBack: false,
    ...overrides,
  };
}

const STEPS: readonly ExecutionTraceDetailStep[] = [
  step({ id: 'e1', action: 'start', stepPosition: 1 }),
  step({ id: 'e2', action: 'advance', stepPosition: 2, occurredAt: new Date('2026-10-07T08:05:00.000Z') }),
  step({
    id: 'e3',
    action: 'go_back',
    userId: 'u2',
    userDisplayName: null,
    stepPosition: 1,
    occurredAt: new Date('2026-10-07T08:10:00.000Z'),
    gapToNextMs: 10 * MIN,
    isGoBack: true,
  }),
  step({
    id: 'e4',
    action: 'cancel',
    stepPosition: null,
    reason: 'Falta materia prima',
    occurredAt: new Date('2026-10-07T08:20:00.000Z'),
    gapToNextMs: null,
  }),
];

const ALL_ACTIONS: readonly { readonly action: ExecutionAction; readonly tone: string; readonly icon: string }[] = [
  { action: 'start', tone: 'progress', icon: 'lucide-play' },
  { action: 'resume', tone: 'progress', icon: 'lucide-play' },
  { action: 'pack_start', tone: 'progress', icon: 'lucide-package' },
  { action: 'advance', tone: 'neutral', icon: 'lucide-arrow-right' },
  { action: 'go_back', tone: 'waiting', icon: 'lucide-rotate-ccw' },
  { action: 'finish', tone: 'success', icon: 'lucide-circle-check' },
  { action: 'pack_finish', tone: 'success', icon: 'lucide-package' },
  { action: 'cancel', tone: 'danger', icon: 'lucide-ban' },
];

function renderedSteps(): HTMLElement[] {
  return screen.getAllByTestId('execution-trace-step');
}

afterEach(() => {
  cleanup();
});

describe('ExecutionTimeline', () => {
  it('R13: bloque sin landmark con h2 «Anotaciones», contador y lista ordenada con ese nombre', () => {
    const { container } = render(<ExecutionTimeline steps={STEPS} />);

    expect(container.querySelector('section')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Anotaciones' })).toBeTruthy();
    expect(screen.getByTestId('execution-trace-step-count').textContent).toBe('4');

    const list = screen.getByRole('list', { name: 'Anotaciones' });
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
  });

  it('R13: un li por anotación en el orden del dominio, con data-action y data-go-back solo en retroceder', () => {
    render(<ExecutionTimeline steps={STEPS} />);

    const items = renderedSteps();
    expect(items.map((li) => li.dataset.action)).toEqual(['start', 'advance', 'go_back', 'cancel']);
    expect(items.map((li) => li.getAttribute('data-go-back'))).toEqual([null, null, 'true', null]);
  });

  it('R14: acción, instante en <time dateTime> ISO, «Paso {n}» solo con posición y punto oculto a lectores', () => {
    render(<ExecutionTimeline steps={STEPS} />);
    const [first, , , last] = renderedSteps();

    const action = within(first!).getByTestId('execution-trace-step-action');
    expect(action.tagName).toBe('STRONG');
    expect(action.textContent).toBe(EXECUTION_ACTION_LABELS.start);

    const time = within(first!).getByTestId('execution-trace-step-instant');
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('dateTime')).toBe('2026-10-07T08:00:00.000Z');
    expect(time.textContent).toBe(formatTraceInstant(new Date('2026-10-07T08:00:00.000Z')));

    expect(within(first!).getByTestId('execution-trace-step-position').textContent).toBe('Paso 1');
    expect(within(last!).queryByTestId('execution-trace-step-position')).toBeNull();

    for (const li of renderedSteps()) {
      expect(within(li).getByTestId('execution-trace-step-dot').getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('R14: avatar de iniciales con el color estable del identificador y el nombre al lado', () => {
    render(<ExecutionTimeline steps={STEPS} />);
    const [first] = renderedSteps();

    const person = within(first!).getByTestId('execution-trace-step-person');
    expect(person.textContent).toContain('Ana Ruiz');
    const avatar = within(person).getByTestId('execution-trace-step-avatar');
    expect(avatar.getAttribute('data-size')).toBe('sm');
    expect(avatar.getAttribute('data-tone')).toBe(String(avatarTone('u1')));
    expect(avatar.textContent).toBe('AR');
  });

  it('R14: persona que el directorio ya no devuelve: «—» con nombre accesible «Sin dato» y sin avatar', () => {
    render(<ExecutionTimeline steps={STEPS} />);
    const goBack = renderedSteps()[2]!;

    const person = within(goBack).getByTestId('execution-trace-step-person');
    expect(person.textContent).toBe(EMPTY_MARK);
    expect(person.getAttribute('aria-label')).toBe('Sin dato');
    expect(within(goBack).queryByTestId('execution-trace-step-avatar')).toBeNull();
  });

  it('R14: «Motivo · {motivo}» solo en cancelar con motivo', () => {
    const steps = [
      ...STEPS,
      step({ id: 'e5', action: 'cancel', reason: null, gapToNextMs: null }),
      step({ id: 'e6', action: 'advance', reason: 'No aplica', gapToNextMs: null }),
    ];
    render(<ExecutionTimeline steps={steps} />);
    const items = renderedSteps();

    expect(within(items[3]!).getByTestId('execution-trace-step-reason').textContent).toBe(
      'Motivo · Falta materia prima',
    );
    expect(within(items[4]!).queryByTestId('execution-trace-step-reason')).toBeNull();
    expect(within(items[5]!).queryByTestId('execution-trace-step-reason')).toBeNull();
    expect(screen.getAllByTestId('execution-trace-step-reason')).toHaveLength(1);
  });

  it('R14: «Hasta la siguiente: {tramo}» en todas salvo la última', () => {
    render(<ExecutionTimeline steps={STEPS} />);
    const items = renderedSteps();

    expect(within(items[0]!).getByTestId('execution-trace-step-gap').textContent).toBe(
      `Hasta la siguiente: ${formatElapsed(5 * MIN)}`,
    );
    expect(within(items[2]!).getByTestId('execution-trace-step-gap').textContent).toBe(
      `Hasta la siguiente: ${formatElapsed(10 * MIN)}`,
    );
    expect(within(items[3]!).queryByTestId('execution-trace-step-gap')).toBeNull();
  });

  it.each(ALL_ACTIONS)('R15: $action lleva el tono $tone y su icono propio', ({ action, tone, icon }) => {
    render(
      <ExecutionTimeline
        steps={[step({ id: 'x', action, isGoBack: action === 'go_back', gapToNextMs: null })]}
      />,
    );
    const [li] = renderedSteps();

    expect(li!.dataset.tone).toBe(tone);
    const svg = within(li!).getByTestId('execution-trace-step-dot').querySelector('svg');
    expect(svg?.classList.contains(icon)).toBe(true);
    expect(within(li!).getByTestId('execution-trace-step-action').textContent).toBe(EXECUTION_ACTION_LABELS[action]);
  });

  it('R15: cada retroceder lleva «Vuelta atrás» solo para lectores, y fondo y borde ámbar en su tarjeta', () => {
    render(<ExecutionTimeline steps={STEPS} />);
    const items = renderedSteps();

    const mark = within(items[2]!).getByTestId('execution-trace-step-go-back');
    expect(mark.textContent).toBe(GO_BACK_MARK);
    expect(GO_BACK_MARK).toBe('Vuelta atrás');
    expect(mark.className).toBe('sr-only');
    expect(screen.getAllByTestId('execution-trace-step-go-back')).toHaveLength(1);

    const body = within(items[2]!).getByTestId('execution-trace-step-action').closest('div')!.parentElement!;
    expect(body.className).toContain('bg-warning-subtle');
    expect(body.className).toContain('border-warning-border');
    const plainBody = within(items[0]!).getByTestId('execution-trace-step-action').closest('div')!.parentElement!;
    expect(plainBody.className).not.toContain('warning');
  });

  it('R16: entrada con motion-safe y screen-enter, retardo de 40 ms por índice', () => {
    render(<ExecutionTimeline steps={STEPS} />);
    const items = renderedSteps();

    for (const li of items) {
      expect(li.className.split(/\s+/)).toContain(
        'motion-safe:animate-[screen-enter_var(--dur-slow)_var(--ease-enter)_both]',
      );
      expect(li.className).not.toMatch(/(^|\s)animate-/);
    }
    expect(items.map((li) => li.style.animationDelay)).toEqual(['0ms', '40ms', '80ms', '120ms']);
  });

  it('R16: el realce de la tarjeta va solo con hover: y ningún dato depende de él', () => {
    render(<ExecutionTimeline steps={STEPS} />);
    const body = within(renderedSteps()[0]!).getByTestId('execution-trace-step-action').closest('div')!.parentElement!;

    const hoverClasses = body.className.split(/\s+/).filter((c) => c.startsWith('hover:'));
    expect(hoverClasses.length).toBeGreaterThan(0);
    for (const c of hoverClasses) {
      expect(c).not.toMatch(/hidden|invisible|opacity-0|sr-only|block|flex/);
    }
    expect(within(body).getByTestId('execution-trace-step-person').textContent).toContain('Ana Ruiz');
  });
});

const TRACE: ExecutionTraceDetailData = {
  orderId: ORDER_ID,
  numberText: '2026-0000042',
  status: 'CANCELADO',
  deleted: false,
  firstAt: new Date('2026-10-07T08:00:00.000Z'),
  lastAt: new Date('2026-10-07T08:20:00.000Z'),
  duration: { kind: 'closed', ms: 20 * MIN },
  goBackCount: 1,
  steps: STEPS,
};

const BACK_HREF = `${DASHBOARD_ROUTE}?page=2&pageSize=25`;

function renderDetail(overrides: Partial<ExecutionTraceDetailData> = {}) {
  return render(<ExecutionTraceDetail trace={{ ...TRACE, ...overrides }} backHref={BACK_HREF} />);
}

function renderError() {
  return render(
    <ExecutionTraceDetailError
      error={{ status: 'error', code: UNEXPECTED_ERROR_CODE, message: 'Fallo', reference: 'ref-1' }}
      backHref={BACK_HREF}
    />,
  );
}

function statValue(label: string): HTMLElement {
  const dd = screen.getByText(label, { selector: 'dt' }).nextElementSibling;
  if (!(dd instanceof HTMLElement) || dd.tagName !== 'DD') throw new Error(`sin dd para «${label}»`);
  return dd;
}

function follows(first: Node, second: Node): boolean {
  return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

describe('ExecutionTraceDetail', () => {
  it('R10: dentro de PageShell, un único h1 «Recorrido del pedido {n}» con el número en Mono', () => {
    const { container } = renderDetail();

    const shell = container.querySelector('[data-slot="page-shell"]');
    expect(shell).not.toBeNull();
    expect(container.querySelector('main')).toBeNull();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    const title = screen.getByTestId('execution-trace-title');
    expect(title).toBe(h1s[0]);
    expect(shell!.contains(title)).toBe(true);
    expect(title).toHaveTextContent('Recorrido del pedido 2026-0000042');
    expect(within(title).getByText(TRACE.numberText)).toHaveClass('font-mono');
  });

  it('R11: «Volver a la lista» es un enlace-botón con flecha atrás, 44×44, antes de la cabecera', () => {
    renderDetail();

    const back = screen.getByRole('link', { name: BACK_TO_LIST_TEXT });
    expect(back).toHaveAttribute('data-testid', 'execution-trace-back');
    expect(back).toHaveAttribute('href', BACK_HREF);
    expect(back).toHaveAttribute('data-direction', 'back');
    expect(back).toHaveClass('min-h-11', 'min-w-11');
    expect(back.className).not.toMatch(/(^|\s)underline(\s|$)/);
    const arrow = back.firstElementChild;
    expect(arrow?.tagName.toLowerCase()).toBe('svg');
    expect(arrow).toHaveAttribute('aria-hidden');
    expect(follows(back, screen.getByTestId('execution-trace-title'))).toBe(true);
  });

  it('R11: también en el estado de error, con la misma dirección y 44×44', () => {
    renderError();

    const back = screen.getByRole('link', { name: BACK_TO_LIST_TEXT });
    expect(back).toHaveAttribute('data-testid', 'execution-trace-back');
    expect(back).toHaveAttribute('href', BACK_HREF);
    expect(back).toHaveAttribute('data-direction', 'back');
    expect(back).toHaveClass('min-h-11', 'min-w-11');
  });

  it('R12: dl con «Estado», «Duración» y «Vueltas atrás» en tres columnas que se apilan a 760 px', () => {
    const { container } = renderDetail();

    const dl = container.querySelector('dl');
    expect(dl).not.toBeNull();
    expect(dl).toHaveClass('grid-cols-3', '@max-[760px]:grid-cols-1');
    expect(Array.from(dl!.querySelectorAll('dt')).map((dt) => dt.textContent)).toEqual([
      'Estado',
      'Duración',
      'Vueltas atrás',
    ]);

    const status = screen.getByTestId('execution-trace-status');
    expect(statValue('Estado').contains(status)).toBe(true);
    expect(status).toHaveAttribute('data-status', 'CANCELADO');
    expect(status).toHaveAttribute('data-tone', ORDER_STATUS_TONES.CANCELADO);
    expect(status).toHaveTextContent(TRACE_ORDER_STATUS_LABELS.CANCELADO);

    const duration = screen.getByTestId('execution-trace-duration');
    expect(statValue('Duración').contains(duration)).toBe(true);
    expect(duration).toHaveAttribute('data-kind', 'closed');
    expect(duration).toHaveClass('font-mono');
    expect(duration).toHaveTextContent(formatTraceDuration(TRACE.duration));

    const goBacks = screen.getByTestId('execution-trace-go-backs');
    expect(statValue('Vueltas atrás').contains(goBacks)).toBe(true);
    expect(goBacks).toHaveAttribute('data-tone', 'waiting');
    expect(goBacks).toHaveTextContent('1');
  });

  it('R12: cero vueltas atrás se pinta «0» sin insignia y atenuado', () => {
    renderDetail({ goBackCount: 0 });

    const goBacks = screen.getByTestId('execution-trace-go-backs');
    expect(goBacks).not.toHaveAttribute('data-tone');
    expect(goBacks).toHaveClass('text-muted-foreground');
    expect(goBacks).toHaveTextContent(/^0$/);
  });

  it('R12: «En curso» y «Dado de baja» van junto al estado, y un dado de baja nunca lleva «En curso»', () => {
    renderDetail({ status: 'EN_EMPAQUE', duration: { kind: 'open', ms: 20 * MIN } });
    const active = screen.getByTestId('execution-trace-active');
    expect(active).toHaveTextContent(ACTIVE_ORDER_MARK);
    expect(active).toHaveAttribute('data-tone', 'progress');
    expect(statValue('Estado').contains(active)).toBe(true);
    expect(screen.queryByTestId('execution-trace-deleted')).toBeNull();
    cleanup();

    renderDetail({ deleted: true, status: 'EN_CURSO', duration: { kind: 'open', ms: 20 * MIN } });
    const deleted = screen.getByTestId('execution-trace-deleted');
    expect(deleted).toHaveTextContent(DELETED_ORDER_MARK);
    expect(deleted).toHaveAttribute('data-tone', 'muted');
    expect(statValue('Estado').contains(deleted)).toBe(true);
    expect(screen.queryByTestId('execution-trace-active')).toBeNull();
  });

  it('R12: la línea de tiempo va después de los tres datos, con todas las anotaciones', () => {
    const { container } = renderDetail();

    const timeline = screen.getByTestId('execution-trace-timeline');
    expect(follows(container.querySelector('dl')!, timeline)).toBe(true);
    expect(within(timeline).getAllByTestId('execution-trace-step')).toHaveLength(STEPS.length);
  });

  it('R17: error con un único h1 «Recorrido» y «No se pudo cargar el recorrido.» en su testid', () => {
    const { container } = renderError();

    expect(container.querySelector('[data-slot="page-shell"]')).not.toBeNull();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/^Recorrido$/);
    expect(screen.getByTestId('execution-trace-detail-error')).toHaveTextContent(
      'No se pudo cargar el recorrido.',
    );
    expect(screen.queryByTestId('execution-trace-timeline')).toBeNull();
  });
});
