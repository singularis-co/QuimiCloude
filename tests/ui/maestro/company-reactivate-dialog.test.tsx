// La reactivación de empresa. La acción está simulada: es el borde del módulo.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompanyReactivateDialog } from '@/app/(private)/maestro/empresas/components';

import { setupUser } from '../../helpers/user-event';

const { routerMock, toastMock, reactivateMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  toastMock: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  reactivateMock: vi.fn<(prev: unknown, formData: FormData) => Promise<unknown>>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@/lib/modules/identity/adapters/driving/company-actions', () => ({
  reactivateCompanyAction: reactivateMock,
  getCompanyDeletionImpactAction: vi.fn(),
  deleteCompanyAction: vi.fn(),
  getCompanyAction: vi.fn(),
  updateCompanyAction: vi.fn(),
  setCompanyCountryAction: vi.fn(),
  createCompanyAction: vi.fn(),
  listCompaniesAction: vi.fn(),
  listCompanyEventsAction: vi.fn(),
}));

const LA_CEJA = { id: '2d8e9f0a-3142-4c5d-8e6f-7a8b9c0d1e2f', name: 'Detergentes La Ceja' };
const onOpenChange = vi.fn<(open: boolean) => void>();

async function montarYConfirmar() {
  const user = setupUser();
  render(<CompanyReactivateDialog company={LA_CEJA} open onOpenChange={onOpenChange} />);
  await user.click(screen.getByTestId('company-reactivate-confirm'));
  await waitFor(() => expect(reactivateMock).toHaveBeenCalledTimes(1));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('el dialogo de reactivacion', () => {
  it('R26: abre «¿Reactivar <nombre>?» con su texto, «Volver» y «Reactivar»', () => {
    render(<CompanyReactivateDialog company={LA_CEJA} open onOpenChange={onOpenChange} />);
    const dialogo = screen.getByTestId('company-reactivate-dialog');
    expect(within(dialogo).getByRole('heading', { name: `¿Reactivar ${LA_CEJA.name}?` })).toBeInTheDocument();
    expect(screen.getByTestId('company-reactivate-message')).toHaveTextContent(
      'La empresa vuelve a estar activa con los datos y módulos que tenía.',
    );
    expect(screen.getByTestId('company-reactivate-dismiss')).toHaveTextContent('Volver');
    expect(screen.getByTestId('company-reactivate-confirm')).toHaveTextContent('Reactivar');
  });

  it('R26: con exito cierra, avisa «Empresa reactivada.» y refresca', async () => {
    reactivateMock.mockResolvedValue({ status: 'success' });
    await montarYConfirmar();
    expect(reactivateMock.mock.calls[0]![1].get('companyId')).toBe(LA_CEJA.id);
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Empresa reactivada.'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('R26: si el servidor la rechaza muestra el mensaje como aviso de peligro dentro, sin cerrar', async () => {
    reactivateMock.mockResolvedValue({
      status: 'error',
      code: 'company_duplicate_tax_id',
      message: 'Ya existe una empresa activa con esa identificación fiscal.',
    });
    await montarYConfirmar();
    const aviso = await screen.findByTestId('company-reactivate-error');
    expect(aviso).toHaveTextContent('Ya existe una empresa activa con esa identificación fiscal.');
    expect(aviso).toHaveAttribute('data-tone', 'danger');
    expect(aviso).toHaveAttribute('role', 'alert');
    expect(within(screen.getByTestId('company-reactivate-dialog')).getByTestId('company-reactivate-error')).toBe(aviso);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it('R26: un rechazo inesperado se pinta con su referencia', async () => {
    reactivateMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: 'Ocurrio un error inesperado.',
      reference: 'req-rea',
    });
    await montarYConfirmar();
    expect(await screen.findByTestId('company-reactivate-error')).toHaveTextContent('req-rea');
  });

  it('R7: unauthorized se pinta dentro del dialogo, sin cerrarlo', async () => {
    reactivateMock.mockResolvedValue({
      status: 'error',
      code: 'unauthorized',
      message: 'El actor no tiene permiso para realizar esta operacion.',
    });
    await montarYConfirmar();
    expect(await screen.findByTestId('company-reactivate-error')).toHaveTextContent(
      'El actor no tiene permiso para realizar esta operacion.',
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
