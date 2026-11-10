import { cleanup, render, screen } from '@testing-library/react';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ASSIGNED_ORDER_CANCELLED_TESTID,
  ASSIGNED_ORDER_MANUFACTURED_TESTID,
  CONDITIONED_ORDER_NOTICE_TESTID,
  OrderOutcomeNotice,
  PACKED_ORDER_NOTICE_TESTID,
  assignedOrderCancelledNoticeText,
  conditionedOrderNoticeText,
  manufacturedOrderNoticeText,
  packedOrderNoticeText,
  type OrderOutcomeKind,
} from '@/app/(private)/asignacion/components';
import AsignacionPage from '@/app/(private)/asignacion/page';
import {
  CANCELLED_ORDER_PARAM,
  MANUFACTURED_ORDER_PARAM,
  OUTCOME_RECIPE_PARAM,
} from '@/lib/shared/routes';

/**
 * Resuelve los Server Components `async` del arbol antes de entregarselo al renderer de cliente.
 *
 * `react-dom` en jsdom no sabe ejecutar un componente `async` -se queda suspendido para siempre-,
 * asi que sin esto la seccion de la lista no llegaria a pintarse nunca. Copiado de
 * `usuarios-page.test.tsx`.
 */
async function resolverServerComponents(nodo: ReactNode): Promise<ReactNode> {
  if (Array.isArray(nodo)) {
    return Promise.all((nodo as ReactNode[]).map((hijo) => resolverServerComponents(hijo)));
  }
  if (!isValidElement(nodo)) return nodo;

  const elemento = nodo as ReactElement<{ children?: ReactNode }>;
  const tipo = elemento.type;

  if (typeof tipo === 'function' && tipo.constructor.name === 'AsyncFunction') {
    const producido = await (tipo as (props: unknown) => Promise<ReactNode>)(elemento.props);
    return resolverServerComponents(producido);
  }

  const hijos = elemento.props.children;
  if (hijos === undefined) return elemento;

  const resueltos = await resolverServerComponents(hijos);

  return Array.isArray(resueltos)
    ? cloneElement(elemento, undefined, ...(resueltos as ReactNode[]))
    : cloneElement(elemento, undefined, resueltos);
}

/**
 * La lista de pedidos asignados pinta el aviso de «por empacar» al volver de finalizar (R9):
 * `finishAssignedOrderAction` redirige aqui con `MANUFACTURED_ORDER_PARAM` en la URL, nunca con un
 * estado de exito que la propia accion no puede resolver -ver `order-execution-screen.tsx`.
 */

const { getSessionUserMock, listAssignedOrdersActionMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn<() => Promise<unknown>>(),
  listAssignedOrdersActionMock: vi.fn<(query: unknown) => Promise<unknown>>(),
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, endSession: vi.fn<() => Promise<void>>() },
  // `packing-orders-list-section.tsx` construye su traductor de errores al cargar el modulo -esta
  // en el mismo barrel que `OrderOutcomeNotice`- y sin este doble la carga revienta.
  observabilidad: { readRequestIdHeader: vi.fn(async (): Promise<string | null> => null) },
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-assignment-actions', () => ({
  listAssignedOrdersAction: listAssignedOrdersActionMock,
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

type Consulta = Record<string, string | string[] | undefined>;

async function renderPantalla(searchParams: Consulta = {}) {
  const arbol = await AsignacionPage({ searchParams: Promise.resolve(searchParams) });
  return render(await resolverServerComponents(arbol));
}

beforeEach(() => {
  getSessionUserMock.mockResolvedValue(sesionCon(['asignaciones.consultar']));
  listAssignedOrdersActionMock.mockResolvedValue({
    status: 'success',
    data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('lista de pedidos asignados — R9: aviso de «por empacar» al volver de finalizar', () => {
  it('con el parametro presente, el aviso queda visible y nombra el pedido', async () => {
    await renderPantalla({ [MANUFACTURED_ORDER_PARAM]: '2026-0000007' });

    const aviso = await screen.findByTestId(ASSIGNED_ORDER_MANUFACTURED_TESTID);
    expect(aviso).toBeVisible();
    expect(aviso).toHaveTextContent('2026-0000007');
  });

  it('sin el parametro, no pinta ningun aviso', async () => {
    await renderPantalla();

    expect(screen.queryByTestId(ASSIGNED_ORDER_MANUFACTURED_TESTID)).toBeNull();
  });

  it('R19: el parametro se llama `fabricado`, no `entregado`, y el aviso no habla de envases', async () => {
    expect(MANUFACTURED_ORDER_PARAM).toBe('fabricado');
    await renderPantalla({
      [MANUFACTURED_ORDER_PARAM]: '2026-0000007',
      entregado: '2026-0000008',
      entregado_envases: '50',
      entregado_producto: 'Desengrasante industrial · Botella 1L',
    });

    const avisos = await screen.findAllByTestId(ASSIGNED_ORDER_MANUFACTURED_TESTID);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toHaveTextContent('Pedido 2026-0000007 por empacar');
    expect(avisos[0]).not.toHaveTextContent('envases');
  });

  it('R19, R20: con `receta_aviso`, el aviso de fabricada nombra la receta y el pedido', async () => {
    expect(OUTCOME_RECIPE_PARAM).toBe('receta_aviso');
    await renderPantalla({
      [MANUFACTURED_ORDER_PARAM]: '2026-0000007',
      [OUTCOME_RECIPE_PARAM]: 'Hipoclorito 5 %',
    });

    const aviso = await screen.findByTestId(ASSIGNED_ORDER_MANUFACTURED_TESTID);
    expect(aviso).toHaveTextContent('Hipoclorito 5 % del pedido 2026-0000007, por empacar');
  });

  it('R20: con `receta_aviso`, el aviso de cancelada nombra la receta y el pedido', async () => {
    await renderPantalla({
      [CANCELLED_ORDER_PARAM]: '2026-0000007',
      [OUTCOME_RECIPE_PARAM]: 'Desengrasante alcalino',
    });

    const aviso = await screen.findByTestId(ASSIGNED_ORDER_CANCELLED_TESTID);
    expect(aviso).toHaveTextContent(
      'Desengrasante alcalino del pedido 2026-0000007 cancelada. Su material quedó libre.',
    );
  });

  it('R20, R29: con `receta_aviso` vacio, el aviso nombra solo el pedido, como hoy', async () => {
    await renderPantalla({ [MANUFACTURED_ORDER_PARAM]: '2026-0000007', [OUTCOME_RECIPE_PARAM]: '' });

    const aviso = await screen.findByTestId(ASSIGNED_ORDER_MANUFACTURED_TESTID);
    expect(aviso).toHaveTextContent('Pedido 2026-0000007 por empacar');
  });
});

describe('OrderOutcomeNotice kind="manufactured" — R19: la receta quedo por empacar', () => {
  afterEach(() => {
    cleanup();
  });

  it('R19: sin receta pinta el aviso de siempre, sin envases', () => {
    render(<OrderOutcomeNotice kind="manufactured" orderNumber="2026-0000009" />);

    const aviso = screen.getByTestId(ASSIGNED_ORDER_MANUFACTURED_TESTID);
    expect(aviso).toHaveTextContent('Pedido 2026-0000009 por empacar');
    expect(aviso).not.toHaveTextContent('envases');
  });

  it('R13: se pinta con `Notice` en tono warning y role="status"', () => {
    render(<OrderOutcomeNotice kind="manufactured" orderNumber="2026-0000010" />);

    const aviso = screen.getByTestId(ASSIGNED_ORDER_MANUFACTURED_TESTID);
    expect(aviso).toHaveAttribute('data-slot', 'alert');
    expect(aviso).toHaveAttribute('data-tone', 'warning');
    expect(aviso).toHaveAttribute('role', 'status');
    expect(aviso).toHaveTextContent('Pedido 2026-0000010 por empacar');
  });

  it('R19: el testid del aviso no se llama «entregado»', () => {
    expect(ASSIGNED_ORDER_MANUFACTURED_TESTID).not.toMatch(/deliver|entreg/i);
  });
});

const AVISOS: readonly {
  readonly kind: OrderOutcomeKind;
  readonly testId: string;
  readonly text: (orderNumber: string, recipeName?: string) => string;
  readonly sinReceta: string;
  readonly conReceta: string;
}[] = [
  {
    kind: 'manufactured',
    testId: ASSIGNED_ORDER_MANUFACTURED_TESTID,
    text: manufacturedOrderNoticeText,
    sinReceta: 'Pedido 2026-0000020 por empacar',
    conReceta: 'Hipoclorito 5 % del pedido 2026-0000020, por empacar',
  },
  {
    kind: 'cancelled',
    testId: ASSIGNED_ORDER_CANCELLED_TESTID,
    text: assignedOrderCancelledNoticeText,
    sinReceta: 'Pedido 2026-0000020 cancelado',
    conReceta: 'Hipoclorito 5 % del pedido 2026-0000020 cancelada. Su material quedó libre.',
  },
  {
    kind: 'packed',
    testId: PACKED_ORDER_NOTICE_TESTID,
    text: packedOrderNoticeText,
    sinReceta: 'Pedido 2026-0000020 empacado',
    conReceta: 'Hipoclorito 5 % del pedido 2026-0000020, empacada',
  },
  {
    kind: 'conditioned',
    testId: CONDITIONED_ORDER_NOTICE_TESTID,
    text: conditionedOrderNoticeText,
    sinReceta: 'Pedido 2026-0000020 acondicionado',
    conReceta: 'Hipoclorito 5 % del pedido 2026-0000020, acondicionada',
  },
];

describe('los cuatro avisos de vuelta a la lista', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(AVISOS)('R20, R29: «$kind» sin receta nombra solo el pedido', ({ kind, testId, text, sinReceta }) => {
    render(<OrderOutcomeNotice kind={kind} orderNumber="2026-0000020" />);

    expect(screen.getByTestId(testId)).toHaveTextContent(sinReceta);
    expect(text('2026-0000020')).toBe(sinReceta);
  });

  it.each(AVISOS)('R20: «$kind» con receta nombra la receta y el pedido', ({ kind, testId, text, conReceta }) => {
    render(<OrderOutcomeNotice kind={kind} orderNumber="2026-0000020" recipeName="Hipoclorito 5 %" />);

    expect(screen.getByTestId(testId)).toHaveTextContent(conReceta);
    expect(text('2026-0000020', 'Hipoclorito 5 %')).toBe(conReceta);
  });

  it.each(AVISOS)('R19: «$kind» no dice «entregado», con receta ni sin ella', ({ kind, testId }) => {
    const { unmount } = render(<OrderOutcomeNotice kind={kind} orderNumber="2026-0000020" />);
    expect(screen.getByTestId(testId).textContent?.toLowerCase()).not.toContain('entregad');
    unmount();

    render(<OrderOutcomeNotice kind={kind} orderNumber="2026-0000020" recipeName="Hipoclorito 5 %" />);
    expect(screen.getByTestId(testId).textContent?.toLowerCase()).not.toContain('entregad');
  });
});
