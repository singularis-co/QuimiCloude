import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listas, getSessionUserMock, getSessionContextMock } = vi.hoisted(() => {
  const lista = () => vi.fn<(actor: unknown, query: unknown) => Promise<{ total: number }>>();
  return {
    listas: {
      listAssignedOrders: lista(),
      listFinishedOrders: lista(),
      listCompanyOrders: lista(),
      listPackingOrders: lista(),
      listConditioningOrders: lista(),
      listConditionedOrders: lista(),
      // QC-301: ya no esta en la fachada; se deja el doble para comprobar que nadie lo llama.
      listDeliveredConditionedOrders: lista(),
    },
    getSessionUserMock: vi.fn<() => Promise<unknown>>(),
    getSessionContextMock: vi.fn<() => Promise<unknown>>(),
  };
});

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, getSessionContext: getSessionContextMock },
  asignaciones: listas,
  observabilidad: { readRequestIdHeader: vi.fn(async (): Promise<string | null> => null) },
}));

import {
  ASSIGNMENT_VIEW_LABELS,
  ASSIGNMENT_VIEW_TAB_TESTIDS,
  ASSIGNMENT_VIEW_TABS_TESTID,
  AssignmentViewTabs,
  AssignmentViewTabsSection,
} from '@/app/(private)/asignacion/components';

afterEach(() => {
  cleanup();
});

const ACONDICIONADOR = ['por_acondicionar', 'acondicionados'] as const;

describe('AssignmentViewTabs', () => {
  it('R7: la vista `acondicionados` se llama «Acondicionados» y las demás conservan su etiqueta', () => {
    expect(ASSIGNMENT_VIEW_LABELS).toEqual({
      asignados: 'Mis asignados',
      terminados: 'Terminados',
      todos: 'Todos',
      por_empacar: 'Por empacar',
      por_acondicionar: 'Por acondicionar',
      acondicionados: 'Acondicionados',
    });

    render(<AssignmentViewTabs current="acondicionados" views={ACONDICIONADOR} />);

    expect(screen.getByTestId('assignment-view-tab-acondicionados')).toHaveTextContent('Acondicionados');
    expect(screen.queryByText('Terminados')).toBeNull();
  });

  it('R12: es una lista de pestañas «Vistas de asignación» con sus testids de hoy', () => {
    render(<AssignmentViewTabs current="por_acondicionar" views={ACONDICIONADOR} />);

    const lista = screen.getByRole('tablist', { name: 'Vistas de asignación' });
    expect(lista).toHaveAttribute('data-testid', ASSIGNMENT_VIEW_TABS_TESTID);
    expect(ASSIGNMENT_VIEW_TABS_TESTID).toBe('assignment-view-tabs');
    for (const view of ACONDICIONADOR) {
      expect(within(lista).getByTestId(ASSIGNMENT_VIEW_TAB_TESTIDS[view])).toBeInTheDocument();
      expect(ASSIGNMENT_VIEW_TAB_TESTIDS[view]).toBe(`assignment-view-tab-${view}`);
    }
  });

  it('R12: cada pestaña es un enlace real a `/asignacion?vista=<vista>` y solo la vigente está seleccionada', () => {
    render(<AssignmentViewTabs current="acondicionados" views={ACONDICIONADOR} />);

    for (const view of ACONDICIONADOR) {
      const tab = screen.getByTestId(`assignment-view-tab-${view}`);
      expect(tab.tagName).toBe('A');
      expect(tab).toHaveAttribute('href', `/asignacion?vista=${view}`);
      expect(tab).toHaveAttribute('aria-selected', view === 'acondicionados' ? 'true' : 'false');
    }
  });

  it('R9: con `counts`, cada pestaña muestra el total junto a su etiqueta', () => {
    render(
      <AssignmentViewTabs
        current="por_acondicionar"
        views={ACONDICIONADOR}
        counts={{ por_acondicionar: 4, acondicionados: 12 }}
      />,
    );

    expect(screen.getByTestId('assignment-view-tab-por_acondicionar')).toHaveTextContent('Por acondicionar4');
    expect(screen.getByTestId('assignment-view-tab-acondicionados')).toHaveTextContent('Acondicionados12');
    const contador = screen
      .getByTestId('assignment-view-tab-acondicionados')
      .querySelector('[data-slot="url-tabs-count"]');
    expect(contador).toHaveTextContent('12');
  });

  it('R11: una vista sin contador se pinta solo con su etiqueta', () => {
    render(
      <AssignmentViewTabs current="por_acondicionar" views={ACONDICIONADOR} counts={{ por_acondicionar: 4 }} />,
    );

    const sinContador = screen.getByTestId('assignment-view-tab-acondicionados');
    expect(sinContador.querySelector('[data-slot="url-tabs-count"]')).toBeNull();
    expect(sinContador).toHaveTextContent(/^Acondicionados$/);
  });

  it('R12: sin `counts` no hay ningún contador', () => {
    render(<AssignmentViewTabs current="por_acondicionar" views={ACONDICIONADOR} />);

    expect(document.querySelector('[data-slot="url-tabs-count"]')).toBeNull();
  });
});

describe('AssignmentViewTabsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({ id: 'u-1', permissions: ['acondicionamiento.modificar'] });
    getSessionContextMock.mockResolvedValue({ companyId: 'company-1' });
    listas.listConditioningOrders.mockResolvedValue({ total: 4 });
    listas.listConditionedOrders.mockRejectedValue(new Error('fallo'));
  });

  it('R10: cada vista lee su propia lista con el actor de la sesión y la primera página de una fila', async () => {
    await AssignmentViewTabsSection({ current: 'por_acondicionar', views: ACONDICIONADOR });

    const actor = { id: 'u-1', companyId: 'company-1', permissions: ['acondicionamiento.modificar'] };
    expect(listas.listConditioningOrders).toHaveBeenCalledWith(actor, { page: 1, pageSize: 1 });
    expect(listas.listConditionedOrders).toHaveBeenCalledWith(actor, { page: 1, pageSize: 1 });
    expect(listas.listAssignedOrders).not.toHaveBeenCalled();
    expect(listas.listCompanyOrders).not.toHaveBeenCalled();
  });

  it('R9, R11: pinta las pestañas con los contadores leídos y deja sin número la que falló', async () => {
    render(await AssignmentViewTabsSection({ current: 'por_acondicionar', views: ACONDICIONADOR }));

    expect(screen.getByTestId('assignment-view-tab-por_acondicionar')).toHaveTextContent('Por acondicionar4');
    expect(screen.getByTestId('assignment-view-tab-acondicionados')).toHaveTextContent(/^Acondicionados$/);
  });
});

describe('QC-301: sin «Entregados» para el acondicionador', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserMock.mockResolvedValue({ id: 'u-1', permissions: ['acondicionamiento.modificar'] });
    getSessionContextMock.mockResolvedValue({ companyId: 'company-1' });
    listas.listConditioningOrders.mockResolvedValue({ total: 4 });
    listas.listConditionedOrders.mockResolvedValue({ total: 7 });
  });

  it('QC-301 R2: pinta exactamente dos pestañas, «Por acondicionar» y «Acondicionados», con su contador', async () => {
    render(await AssignmentViewTabsSection({ current: 'por_acondicionar', views: ACONDICIONADOR }));

    const lista = screen.getByRole('tablist', { name: 'Vistas de asignación' });
    expect(within(lista).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Por acondicionar4',
      'Acondicionados7',
    ]);
    expect(screen.queryByText('Entregados')).toBeNull();
  });

  it('QC-301 R2: no lee el número de pedidos entregados', async () => {
    await AssignmentViewTabsSection({ current: 'por_acondicionar', views: ACONDICIONADOR });

    expect(listas.listDeliveredConditionedOrders).not.toHaveBeenCalled();
  });
});
