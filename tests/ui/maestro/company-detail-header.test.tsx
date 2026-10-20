// La cabecera del detalle de empresa: estado, acciones según estado y permiso, y los mismos
// panel y diálogos de la lista. Las acciones del servidor están simuladas.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompanyDetailHeader } from '@/app/(private)/maestro/empresas/[id]/components';
import type { CompanyDetail } from '@/lib/modules/identity';

import { setupUser } from '../../helpers/user-event';
import { WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';

const { routerMock, toastMock, actions } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  toastMock: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  actions: {
    getCompanyAction: vi.fn<(id: string) => Promise<unknown>>(),
    getCompanyDeletionImpactAction: vi.fn<(id: string) => Promise<unknown>>(),
    reactivateCompanyAction: vi.fn<(prev: unknown, formData: FormData) => Promise<unknown>>(),
  },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@/lib/modules/identity/adapters/driving/company-actions', () => ({
  getCompanyAction: actions.getCompanyAction,
  getCompanyDeletionImpactAction: actions.getCompanyDeletionImpactAction,
  reactivateCompanyAction: actions.reactivateCompanyAction,
  listCompaniesAction: vi.fn(),
  listCompanyEventsAction: vi.fn(),
  createCompanyAction: vi.fn(),
  updateCompanyAction: vi.fn(),
  setCompanyCountryAction: vi.fn(),
  deleteCompanyAction: vi.fn(),
}));

const ACTIVA: CompanyDetail = {
  id: '2d8e9f0a-3142-4c5d-8e6f-7a8b9c0d1e2f',
  name: 'Químicos del Valle',
  taxId: '900.481.227-3',
  contactEmail: 'contacto@quimicosvalle.co',
  contactPhone: '602 488 1200',
  country: 'CO',
  createdAt: new Date('2026-09-14T11:02:00.000Z'),
  status: 'active',
  deletedAt: null,
};

const DE_BAJA: CompanyDetail = {
  ...ACTIVA,
  status: 'deleted',
  deletedAt: new Date('2026-10-15T08:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  setViewportWidth(WIDE_VIEWPORT);
  actions.getCompanyDeletionImpactAction.mockResolvedValue({
    status: 'success',
    data: { liveUsers: 4, openOrders: 2 },
  });
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('la cabecera del detalle de empresa', () => {
  it('R27: miga «Empresas» con enlace a la lista, nombre como titulo y estado «Activa»', () => {
    render(<CompanyDetailHeader company={ACTIVA} canModify />);
    expect(screen.getByRole('link', { name: 'Empresas' })).toHaveAttribute('href', '/maestro/empresas');
    expect(screen.getByTestId('company-detail-title')).toHaveTextContent('Químicos del Valle');
    expect(screen.getByTestId('company-detail-status')).toHaveTextContent('Activa');
  });

  it('R28: una empresa activa ofrece «Editar» y «Dar de baja», y no «Reactivar»', () => {
    render(<CompanyDetailHeader company={ACTIVA} canModify />);
    expect(screen.getByTestId('company-detail-edit')).toHaveTextContent('Editar');
    expect(screen.getByTestId('company-detail-delete')).toHaveTextContent('Dar de baja');
    expect(screen.queryByTestId('company-detail-reactivate')).not.toBeInTheDocument();
  });

  it('R28: una empresa de baja ofrece «Editar» y «Reactivar», y no «Dar de baja»', () => {
    render(<CompanyDetailHeader company={DE_BAJA} canModify />);
    expect(screen.getByTestId('company-detail-status')).toHaveTextContent('De baja');
    expect(screen.getByTestId('company-detail-edit')).toHaveTextContent('Editar');
    expect(screen.getByTestId('company-detail-reactivate')).toHaveTextContent('Reactivar');
    expect(screen.queryByTestId('company-detail-delete')).not.toBeInTheDocument();
  });

  it.each([
    ['activa', ACTIVA],
    ['de baja', DE_BAJA],
  ])('R6: sin empresas.modificar, una empresa %s no ofrece ninguna escritura', (_caso, company) => {
    render(<CompanyDetailHeader company={company} canModify={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('R28: los botones de la cabecera tienen objetivo tactil de 44 px', () => {
    render(<CompanyDetailHeader company={ACTIVA} canModify />);
    for (const boton of screen.getAllByRole('button')) {
      expect(boton.className).toMatch(/min-h-11/);
    }
  });

  it('R28: «Editar» abre el panel de edicion con los datos del detalle, sin volver a pedirlos', async () => {
    const user = setupUser();
    render(<CompanyDetailHeader company={ACTIVA} canModify />);
    await user.click(screen.getByTestId('company-detail-edit'));
    const panel = await screen.findByTestId('company-edit-sheet');
    expect(within(panel).getByDisplayValue('Químicos del Valle')).toBeInTheDocument();
    expect(within(panel).getByDisplayValue('900.481.227-3')).toBeInTheDocument();
    expect(actions.getCompanyAction).not.toHaveBeenCalled();
  });

  it('R28: «Dar de baja» abre el dialogo de baja de la lista, que pide el impacto de esta empresa', async () => {
    const user = setupUser();
    render(<CompanyDetailHeader company={ACTIVA} canModify />);
    await user.click(screen.getByTestId('company-detail-delete'));
    expect(await screen.findByTestId('company-delete-dialog')).toBeInTheDocument();
    await waitFor(() =>
      expect(actions.getCompanyDeletionImpactAction).toHaveBeenCalledWith(ACTIVA.id),
    );
  });

  it('R28: «Reactivar» abre el dialogo de reactivacion y, con exito, refresca el detalle', async () => {
    actions.reactivateCompanyAction.mockResolvedValue({ status: 'success' });
    const user = setupUser();
    render(<CompanyDetailHeader company={DE_BAJA} canModify />);
    await user.click(screen.getByTestId('company-detail-reactivate'));
    await user.click(await screen.findByTestId('company-reactivate-confirm'));
    await waitFor(() => expect(routerMock.refresh).toHaveBeenCalledTimes(1));
    expect(actions.reactivateCompanyAction.mock.calls[0]![1].get('companyId')).toBe(DE_BAJA.id);
    expect(toastMock.success).toHaveBeenCalledWith('Empresa reactivada.');
    await waitFor(() =>
      expect(screen.queryByTestId('company-reactivate-dialog')).not.toBeInTheDocument(),
    );
  });
});
