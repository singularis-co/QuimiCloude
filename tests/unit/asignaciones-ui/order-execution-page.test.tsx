import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AssignedOrderExecutionPage from '@/app/(private)/asignacion/[id]/page';
import {
  ORDER_EXECUTION_BACK_LINK_TESTID,
  ORDER_EXECUTION_ERROR_TESTID,
  ORDER_EXECUTION_NOT_STARTED_TESTID,
  ORDER_EXECUTION_SCREEN_TESTID,
  ORDER_EXECUTION_START_BUTTON_TESTID,
} from '@/app/(private)/asignacion/[id]/components';
import { LOGIN_ROUTE_SESSION_ENDED } from '@/lib/shared/routes';

/**
 * La pagina de ejecucion: el corte por permiso (R1, R2, R3) y el reparto de la lectura (R6, R7).
 */

const {
  getSessionUserMock,
  notFoundMock,
  redirectMock,
  openAssignedOrderActionMock,
  startAssignedOrderActionMock,
} =
  vi.hoisted(() => ({
    getSessionUserMock: vi.fn<() => Promise<unknown>>(),
    // `notFound()` y `redirect()` estan tipadas `(): never` y LANZAN. El doble hace lo mismo: si
    // no lanzara, el corte seguiria ejecutandose y el test mediria otra cosa.
    notFoundMock: vi.fn<() => never>(() => {
      throw new Error('NEXT_NOT_FOUND');
    }),
    redirectMock: vi.fn<(ruta: string) => never>(() => {
      throw new Error('NEXT_REDIRECT');
    }),
    openAssignedOrderActionMock: vi.fn(),
    startAssignedOrderActionMock: vi.fn(),
  }));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: notFoundMock,
  redirect: redirectMock,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, endSession: vi.fn<() => Promise<void>>() },
  // La pagina lee `?receta` con una pieza del barrel de la lista, y sus secciones construyen su
  // traductor de errores al cargar el modulo.
  observabilidad: { readRequestIdHeader: vi.fn(async (): Promise<string | null> => null) },
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-execution-actions', () => ({
  openAssignedOrderAction: openAssignedOrderActionMock,
  startAssignedOrderAction: startAssignedOrderActionMock,
  finishAssignedOrderAction: vi.fn(),
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/step-evidence-actions', () => ({
  requestEvidenceUploadAction: vi.fn(),
  registerEvidenceAction: vi.fn(),
  removeEvidenceAction: vi.fn(),
}));

function sesionCon(permissions: readonly string[]) {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    username: 'operador.prueba',
    displayName: 'Operador De Prueba',
    roleName: 'Operador',
    permissions,
  };
}

const EXECUCION_MINIMA = {
  orderId: 'order-1',
  numberText: 'PED-0007',
  recipe: { position: 1, count: 1 },
  otherRecipes: [],
  status: 'EN_CURSO' as const,
  recipeName: 'Barniz acrílico',
  orderQuantity: '250',
  steps: [],
  lines: [],
  tools: [],
  presentationLines: [],
  unitId: null,
  unitLabel: null,
  evidence: [],
  resumeStepPosition: null,
};

const LINE_ID = '55555555-5555-4555-8555-555555555555';

type Consulta = Record<string, string | string[] | undefined>;

function arbolDeLaPagina(id = 'order-1', consulta: Consulta = { receta: LINE_ID }) {
  return AssignedOrderExecutionPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(consulta) });
}

beforeEach(() => {
  getSessionUserMock.mockResolvedValue(sesionCon(['asignaciones.consultar', 'asignaciones.ejecutar']));
  openAssignedOrderActionMock.mockResolvedValue({ status: 'success', data: EXECUCION_MINIMA });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('pagina de ejecucion — el corte por permiso ocurre ANTES de leer nada (R2, R3)', () => {
  it('sin sesion redirige al login y no responde 404', async () => {
    getSessionUserMock.mockResolvedValue(null);

    await expect(arbolDeLaPagina()).rejects.toThrow();

    expect(redirectMock).toHaveBeenCalledWith(LOGIN_ROUTE_SESSION_ENDED);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(openAssignedOrderActionMock).not.toHaveBeenCalled();
  });

  it('R8: con sesion pero sin `asignaciones.ejecutar` responde 404, nunca 403', async () => {
    getSessionUserMock.mockResolvedValue(sesionCon(['inventario.consultar']));

    await expect(arbolDeLaPagina()).rejects.toThrow();

    expect(notFoundMock).toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(openAssignedOrderActionMock).not.toHaveBeenCalled();
  });

  it('R8: con los permisos del Empacador (consulta pero no ejecuta) responde 404 sin comenzar el pedido', async () => {
    getSessionUserMock.mockResolvedValue(
      sesionCon(['asignaciones.consultar', 'terminados.consultar', 'empaque.modificar']),
    );

    await expect(arbolDeLaPagina()).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(openAssignedOrderActionMock).not.toHaveBeenCalled();
  });

  it('R8: con `asignaciones.ejecutar` aunque no tenga `asignaciones.consultar`, entra y abre el pedido', async () => {
    getSessionUserMock.mockResolvedValue(sesionCon(['asignaciones.ejecutar']));

    render(await arbolDeLaPagina());

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(openAssignedOrderActionMock).toHaveBeenCalledWith('order-1', LINE_ID);
    expect(screen.getByTestId(ORDER_EXECUTION_SCREEN_TESTID)).toBeInTheDocument();
  });

  it('R8: con el permiso, entra y abre el pedido', async () => {
    const arbol = await arbolDeLaPagina();
    render(arbol);

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(openAssignedOrderActionMock).toHaveBeenCalledWith('order-1', LINE_ID);
    expect(screen.getByTestId(ORDER_EXECUTION_SCREEN_TESTID)).toBeInTheDocument();
  });

  it('QC-265 R1, R2: la pantalla se monta sobre el marco del operario, con un solo h1', async () => {
    render(await arbolDeLaPagina());

    expect(screen.getByTestId(ORDER_EXECUTION_SCREEN_TESTID)).toHaveAttribute('data-operator-screen');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('pagina de ejecucion — la receta viaja en ?receta', () => {
  it.each<[string, Consulta]>([
    ['sin ?receta', {}],
    ['con ?receta que no es un uuid', { receta: 'linea-1' }],
    ['con ?receta repetida', { receta: [LINE_ID, LINE_ID] }],
  ])('R9: %s responde 404 sin abrir ningun pedido', async (_caso, consulta) => {
    await expect(arbolDeLaPagina('order-1', consulta)).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(openAssignedOrderActionMock).not.toHaveBeenCalled();
  });

  it('R9: con una receta ajena pinta lo mismo que un pedido inexistente, sin datos del pedido', async () => {
    const AJENA = '66666666-6666-4666-8666-666666666666';
    openAssignedOrderActionMock.mockResolvedValue({
      status: 'error',
      code: 'order_not_found',
      message: 'El pedido solicitado no existe.',
    });

    render(await arbolDeLaPagina('order-1', { receta: AJENA }));

    expect(openAssignedOrderActionMock).toHaveBeenCalledWith('order-1', AJENA);
    expect(screen.getByTestId(ORDER_EXECUTION_ERROR_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(ORDER_EXECUTION_SCREEN_TESTID)).toBeNull();
    expect(screen.queryByText(EXECUCION_MINIMA.numberText)).toBeNull();
  });
});

describe('pagina de ejecucion — «no existe» y «no es tuyo» pintan lo mismo (R6)', () => {
  it('presenta el estado de error cuando la operacion rechaza con `order_not_found`', async () => {
    openAssignedOrderActionMock.mockResolvedValue({
      status: 'error',
      code: 'order_not_found',
      message: 'El pedido solicitado no existe.',
    });

    const arbol = await arbolDeLaPagina();
    render(arbol);

    expect(screen.getByTestId(ORDER_EXECUTION_ERROR_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(ORDER_EXECUTION_SCREEN_TESTID)).toBeNull();
  });
});

describe('pagina de ejecucion — entrar es libre: abrir no comienza el pedido', () => {
  it('PENDIENTE: abre la pantalla sin comenzar, con «Comenzar», la vuelta habilitada y sin paso a paso', async () => {
    openAssignedOrderActionMock.mockResolvedValue({
      status: 'success',
      data: { ...EXECUCION_MINIMA, status: 'PENDIENTE' },
    });

    render(await arbolDeLaPagina());

    expect(openAssignedOrderActionMock).toHaveBeenCalledWith('order-1', LINE_ID);
    expect(startAssignedOrderActionMock).not.toHaveBeenCalled();
    expect(screen.getByTestId(ORDER_EXECUTION_START_BUTTON_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(ORDER_EXECUTION_NOT_STARTED_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(ORDER_EXECUTION_BACK_LINK_TESTID).tagName).toBe('A');
  });

  it('EN_CURSO: retoma sin «Comenzar» y con la vuelta deshabilitada', async () => {
    render(await arbolDeLaPagina());

    expect(startAssignedOrderActionMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId(ORDER_EXECUTION_START_BUTTON_TESTID)).toBeNull();
    expect(screen.getByTestId(ORDER_EXECUTION_BACK_LINK_TESTID)).toHaveAttribute('aria-disabled', 'true');
  });
});
