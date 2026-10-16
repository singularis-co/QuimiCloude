import { cleanup, render } from '@testing-library/react';

import DashboardPage from '@/app/(private)/dashboard/page';
import { ExecutionTraceDetail } from '@/app/(private)/dashboard/recorrido/[id]/components';
import type { ExecutionTraceList, ExecutionTraceRow } from '@/lib/modules/asignaciones';
import { DASHBOARD_ROUTE } from '@/lib/shared/routes';
import type { ExecutionTraceListResult } from '@/lib/modules/asignaciones/adapters/driving/execution-trace-actions';
import { errorMessage, type ErrorState } from '@/lib/modules/errores';
import { PERMISSIONS } from '@/lib/modules/identity';

import {
  FINISHED_CONDITIONING_TRACE,
  IN_PROGRESS_CONDITIONING_TRACE,
  PREVIOUS_CONDITIONING_TRACE,
} from '../../fixtures/execution-trace-conditioning';
import { errorInesperado } from '../../helpers/identificador-de-request';
import { WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';
import { arbolAccesible, nuncaResuelve, resolverServerComponents } from './arbol-accesible';

/**
 * Paridad de la lista de recorridos del dashboard: su error interno pasa a ser el estado de error
 * de la tabla. Mocks de `tests/unit/dashboard-page.test.tsx`, pero con la seccion real.
 */

const { routerMock, getSessionUserMock, listExecutionTracesActionMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  getSessionUserMock: vi.fn(),
  listExecutionTracesActionMock: vi.fn<(input: unknown) => Promise<ExecutionTraceListResult>>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/dashboard',
  useRouter: () => routerMock,
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, endSession: vi.fn() },
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/execution-trace-actions', () => ({
  listExecutionTracesAction: listExecutionTracesActionMock,
  getExecutionTraceAction: vi.fn(),
  getExecutionEvidenceAction: vi.fn(),
}));

const PERSONA = { userId: 'user-1', displayName: 'Ana López García' };

const FILAS: readonly ExecutionTraceRow[] = [
  {
    orderId: 'order-1',
    numberText: '2026-000123',
    status: 'TERMINADO',
    deleted: false,
    people: [PERSONA],
    firstAt: new Date('2026-09-20T08:00:00.000Z'),
    lastAt: new Date('2026-09-20T09:30:15.000Z'),
    active: false,
    totalDuration: { kind: 'closed', ms: 5_415_000 },
    goBackCount: 1,
    formulaName: null,
    formulaImageUrl: null,
    presentations: [],
  },
  {
    orderId: 'order-2',
    numberText: '2026-000124',
    status: 'EN_CURSO',
    deleted: true,
    people: [],
    firstAt: new Date('2026-09-21T10:00:00.000Z'),
    lastAt: new Date('2026-09-21T10:05:00.000Z'),
    active: false,
    totalDuration: { kind: 'unclosed', ms: 300_000 },
    goBackCount: 0,
    formulaName: null,
    formulaImageUrl: null,
    presentations: [],
  },
];

function exito(items: readonly ExecutionTraceRow[], page = 1): ExecutionTraceListResult {
  const data: ExecutionTraceList = {
    page: { items, total: items.length, page, pageSize: 10, totalPages: 1 },
    personOptions: [PERSONA],
  };
  return { status: 'success', data };
}

const ERROR_DE_CATALOGO: ErrorState = {
  status: 'error',
  code: 'unauthorized',
  message: errorMessage('unauthorized'),
};

type Consulta = Record<string, string | undefined>;

async function renderPantalla(consulta: Consulta = {}) {
  const arbol = await DashboardPage({ searchParams: Promise.resolve(consulta) });
  return render(<>{await resolverServerComponents(arbol)}</>);
}

async function renderCargando() {
  listExecutionTracesActionMock.mockReturnValue(nuncaResuelve());
  const arbol = await DashboardPage({ searchParams: Promise.resolve({}) });
  return render(<>{arbol}</>);
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue({
    id: 'u-paridad',
    username: 'carla.duarte',
    displayName: 'Carla Duarte Salas',
    roleName: 'Administrador',
    permissions: PERMISSIONS.map((permiso) => permiso.code),
  });
  listExecutionTracesActionMock.mockResolvedValue(exito(FILAS));
  setViewportWidth(WIDE_VIEWPORT);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('paridad de recorridos (dashboard)', () => {
  it('R1 — con filas', async () => {
    await renderPantalla();
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R1 — cargando', async () => {
    await renderCargando();
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R1 — vacio, sin filtro', async () => {
    listExecutionTracesActionMock.mockResolvedValue(exito([]));
    await renderPantalla();
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R1 — sin resultados, con filtro activo', async () => {
    listExecutionTracesActionMock.mockResolvedValue(exito([]));
    await renderPantalla({ q: '2026-999999' });
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R1 R17 — error de catalogo', async () => {
    listExecutionTracesActionMock.mockResolvedValue(ERROR_DE_CATALOGO);
    await renderPantalla();
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R1 R17 — error inesperado, con su identificador', async () => {
    listExecutionTracesActionMock.mockResolvedValue(errorInesperado());
    await renderPantalla();
    expect(arbolAccesible()).toMatchSnapshot();
  });
});

// Una variante por cada una del tablero `RecorridoAcondicionamiento`: terminado, en curso y anterior.
describe('paridad del detalle del recorrido con acondicionamiento', () => {
  it.each([
    ['terminado', FINISHED_CONDITIONING_TRACE],
    ['en curso', IN_PROGRESS_CONDITIONING_TRACE],
    ['anterior', PREVIOUS_CONDITIONING_TRACE],
  ])('R12 R13 R14 R15 R16 R17 R18 R25 — %s', (_variante, trace) => {
    render(<ExecutionTraceDetail trace={trace} backHref={DASHBOARD_ROUTE} />);
    expect(arbolAccesible()).toMatchSnapshot();
  });
});
