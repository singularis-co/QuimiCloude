// La baja de empresa: impacto, confirmación por nombre y respuesta del servidor. Las acciones
// están simuladas: es el borde del módulo.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompanyDeleteDialog } from '@/app/(private)/maestro/empresas/components';

import { setupUser } from '../../helpers/user-event';

const { routerMock, toastMock, impactMock, deleteMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  toastMock: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  impactMock: vi.fn<(id: string) => Promise<unknown>>(),
  deleteMock: vi.fn<(prev: unknown, formData: FormData) => Promise<unknown>>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@/lib/modules/identity/adapters/driving/company-actions', () => ({
  getCompanyDeletionImpactAction: impactMock,
  deleteCompanyAction: deleteMock,
  getCompanyAction: vi.fn(),
  updateCompanyAction: vi.fn(),
  setCompanyCountryAction: vi.fn(),
  createCompanyAction: vi.fn(),
  listCompaniesAction: vi.fn(),
  listCompanyEventsAction: vi.fn(),
  reactivateCompanyAction: vi.fn(),
}));

const VALLE = { id: '1c7d8e9f-2031-4b4c-9d5e-6f7a8b9c0d1e', name: 'Químicos del Valle S.A.S.' };
const onOpenChange = vi.fn<(open: boolean) => void>();

function montar() {
  render(<CompanyDeleteDialog company={VALLE} open onOpenChange={onOpenChange} />);
}

function confirmar(): HTMLElement {
  return screen.getByTestId('company-delete-confirm');
}

function escribir(texto: string) {
  fireEvent.change(screen.getByTestId('company-delete-confirmation'), { target: { value: texto } });
}

async function impactoListo() {
  impactMock.mockResolvedValue({ status: 'success', data: { liveUsers: 14, openOrders: 6 } });
  montar();
  await screen.findByTestId('company-delete-impact');
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('el dialogo de baja', () => {
  it('R23: muestra «Calculando el impacto…» y despues las dos cifras, el aviso y el campo', async () => {
    let resolver: (value: unknown) => void = () => {};
    impactMock.mockReturnValue(new Promise((resolve) => (resolver = resolve)));
    montar();
    const dialogo = screen.getByTestId('company-delete-dialog');
    expect(within(dialogo).getByRole('heading', { name: `Dar de baja a ${VALLE.name}` })).toBeInTheDocument();
    expect(screen.getByTestId('company-delete-impact-loading')).toHaveTextContent(
      'Calculando el impacto…',
    );
    expect(impactMock).toHaveBeenCalledWith(VALLE.id);

    resolver({ status: 'success', data: { liveUsers: 14, openOrders: 6 } });
    const impacto = await screen.findByTestId('company-delete-impact');
    expect(within(impacto).getByText('Usuarios activos')).toBeInTheDocument();
    expect(screen.getByTestId('company-delete-liveUsers')).toHaveTextContent('14');
    expect(within(impacto).getByText('Pedidos abiertos')).toBeInTheDocument();
    expect(screen.getByTestId('company-delete-openOrders')).toHaveTextContent('6');
    expect(screen.queryByTestId('company-delete-impact-loading')).toBeNull();
    expect(screen.getByTestId('company-delete-message')).toHaveTextContent(
      'Sus usuarios no podrán entrar y se cerrarán las sesiones que tengan abiertas. Podrás reactivarla después.',
    );
    expect(screen.getByLabelText(`Escribe ${VALLE.name} para confirmar`)).toBeInTheDocument();
  });

  it('R23: el orden del tablero: titulo, cifras, aviso y campo de confirmacion', async () => {
    await impactoListo();
    const titulo = screen.getByRole('heading', { name: `Dar de baja a ${VALLE.name}` });
    const cifras = screen.getByTestId('company-delete-impact');
    const aviso = screen.getByTestId('company-delete-message');
    const campo = screen.getByTestId('company-delete-confirmation');
    const sigue = (a: Node, b: Node) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(sigue(titulo, cifras)).toBe(true);
    expect(sigue(cifras, aviso)).toBe(true);
    expect(sigue(aviso, campo)).toBe(true);
    // El aviso sigue siendo la descripcion del dialogo.
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
      'Sus usuarios no podrán entrar y se cerrarán las sesiones que tengan abiertas. Podrás reactivarla después.',
    );
  });

  it('tablero: lleva el icono de papelera en tono danger, decorativo y delante del titulo', async () => {
    await impactoListo();
    const icono = screen.getByTestId('company-delete-icon');
    expect(icono).toHaveAttribute('data-tone', 'danger');
    expect(icono.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    const titulo = screen.getByRole('heading', { name: `Dar de baja a ${VALLE.name}` });
    expect(icono.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('R24: sin impacto cargado «Dar de baja» sigue deshabilitado aunque haya texto', () => {
    impactMock.mockReturnValue(new Promise(() => {}));
    montar();
    escribir(VALLE.name);
    expect(confirmar()).toHaveTextContent('Dar de baja');
    expect(confirmar()).toBeDisabled();
  });

  it('R24: con el impacto pero el campo vacio esta deshabilitado; con texto se habilita', async () => {
    await impactoListo();
    expect(confirmar()).toBeDisabled();
    escribir('   ');
    expect(confirmar()).toBeDisabled();
    escribir(VALLE.name);
    expect(confirmar()).toBeEnabled();
  });

  it('R24: si el impacto falla pinta el error con su referencia y el boton sigue deshabilitado', async () => {
    impactMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: 'Ocurrio un error inesperado.',
      reference: 'req-imp',
    });
    montar();
    expect(await screen.findByTestId('company-delete-impact-error')).toHaveTextContent('req-imp');
    escribir(VALLE.name);
    expect(confirmar()).toBeDisabled();
  });
});

describe('la baja', () => {
  it('R25: con exito cierra, avisa «Empresa dada de baja.» y refresca', async () => {
    deleteMock.mockResolvedValue({ status: 'success' });
    const user = setupUser();
    await impactoListo();
    escribir(VALLE.name);
    await user.click(confirmar());
    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1));
    const formData = deleteMock.mock.calls[0]![1];
    expect(formData.get('companyId')).toBe(VALLE.id);
    expect(formData.get('confirmationName')).toBe(VALLE.name);
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Empresa dada de baja.'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('R25: company_name_mismatch deja el dialogo abierto con el error junto al campo', async () => {
    deleteMock.mockResolvedValue({
      status: 'error',
      code: 'company_name_mismatch',
      message: 'El nombre escrito no coincide con el de la empresa.',
    });
    const user = setupUser();
    await impactoListo();
    escribir('Quimicos del valle');
    await user.click(confirmar());
    expect(await screen.findByTestId('company-delete-confirmation-error')).toHaveTextContent(
      'El nombre escrito no coincide con el de la empresa.',
    );
    expect(screen.getByTestId('company-delete-confirmation')).toHaveValue('Quimicos del valle');
    expect(screen.queryByTestId('company-delete-error')).toBeNull();
    expect(screen.getByTestId('company-delete-dialog')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('R7: unauthorized se pinta en la region del dialogo, sin cerrarlo', async () => {
    deleteMock.mockResolvedValue({
      status: 'error',
      code: 'unauthorized',
      message: 'El actor no tiene permiso para realizar esta operacion.',
    });
    const user = setupUser();
    await impactoListo();
    escribir(VALLE.name);
    await user.click(confirmar());
    expect(await screen.findByTestId('company-delete-error')).toHaveTextContent(
      'El actor no tiene permiso para realizar esta operacion.',
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
