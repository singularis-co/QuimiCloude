// La baja de un Administrador. La Server Action está simulada: lo que se afirma es el `FormData` que
// recibe y lo que el diálogo hace con su respuesta.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AdministratorDeleteDialog,
  type AdministratorDeleteDialogProps,
} from '@/app/(private)/maestro/administradores/components';
import type { ErrorState } from '@/lib/modules/errores';

import { setupUser } from '../../helpers/user-event';

const { routerMock, deleteAdministratorActionMock, toastMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  deleteAdministratorActionMock: vi.fn<(prev: unknown, formData: FormData) => Promise<unknown>>(),
  toastMock: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@/lib/modules/identity/adapters/driving/administrator-actions', () => ({
  listAdministratorsAction: vi.fn(),
  getAdministratorAction: vi.fn(),
  createAdministratorAction: vi.fn(),
  updateAdministratorAction: vi.fn(),
  deleteAdministratorAction: deleteAdministratorActionMock,
  resendAdministratorLinkAction: vi.fn(),
}));

vi.mock('@/lib/modules/identity/adapters/driving/company-actions', () => ({
  listCompaniesAction: vi.fn(),
}));

type Target = AdministratorDeleteDialogProps['administrator'];

const DIANA: Target = {
  id: 'a1b2c3d4-0001-4a00-8000-000000000001',
  firstNames: 'Diana',
  lastNames: 'Mejía',
  company: { id: '1c7d8e9f-2031-4b4c-9d5e-6f7a8b9c0d1e', name: 'Químicos del Valle S.A.S.' },
  isLastAdministrator: false,
};

const NATALIA: Target = {
  id: 'a1b2c3d4-0003-4a00-8000-000000000003',
  firstNames: 'Natalia',
  lastNames: 'Ríos',
  company: { id: '3e9f0a1b-4253-4d6e-9f70-8b9c0d1e2f30', name: 'Laboratorios Andinos' },
  isLastAdministrator: true,
};

function montar(administrator: Target, onOpenChange = vi.fn()) {
  render(<AdministratorDeleteDialog administrator={administrator} open onOpenChange={onOpenChange} />);
  return onOpenChange;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('el dialogo de baja', () => {
  it('R39: se titula «Dar de baja a <nombre>» y dice a que empresa deja de poder entrar', () => {
    montar(DIANA);
    const dialogo = screen.getByTestId('administrator-delete-dialog');
    expect(within(dialogo).getByRole('heading', { name: 'Dar de baja a Diana Mejía' })).toBeInTheDocument();
    expect(screen.getByTestId('administrator-delete-message')).toHaveTextContent(
      'Diana Mejía deja de poder entrar a Químicos del Valle S.A.S..',
    );
    expect(screen.getByTestId('administrator-delete-dismiss')).toHaveTextContent('Volver');
    expect(screen.getByTestId('administrator-delete-confirm')).toHaveTextContent('Dar de baja');
    expect(screen.getByTestId('administrator-delete-confirm')).toBeEnabled();
    expect(screen.queryByTestId('administrator-delete-last')).toBeNull();
  });

  it('tablero: lleva el icono de papelera en tono danger, decorativo y delante del titulo', () => {
    montar(DIANA);
    const icono = screen.getByTestId('administrator-delete-icon');
    expect(icono).toHaveAttribute('data-tone', 'danger');
    expect(icono.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    const titulo = screen.getByRole('heading', { name: 'Dar de baja a Diana Mejía' });
    expect(icono.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('R39: confirmar manda solo el id; con exito cierra, avisa y refresca', async () => {
    deleteAdministratorActionMock.mockResolvedValue({ status: 'success' });
    const user = setupUser();
    const onOpenChange = montar(DIANA);
    await user.click(screen.getByTestId('administrator-delete-confirm'));
    await waitFor(() => expect(deleteAdministratorActionMock).toHaveBeenCalled());
    const formData = deleteAdministratorActionMock.mock.calls[0]![1];
    expect([...formData.keys()]).toEqual(['id']);
    expect(formData.get('id')).toBe(DIANA.id);
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Administrador dado de baja.'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('R40: el ultimo Administrador muestra el aviso y no deja confirmar', () => {
    montar(NATALIA);
    const aviso = screen.getByTestId('administrator-delete-last');
    expect(aviso).toHaveTextContent('Es el último Administrador de Laboratorios Andinos');
    expect(aviso).toHaveTextContent('Crea otro Administrador para esta empresa antes de darlo de baja.');
    const confirmar = screen.getByTestId('administrator-delete-confirm');
    expect(confirmar).toBeDisabled();
    expect(confirmar.getAttribute('aria-describedby')).toContain(aviso.id);
  });

  it('R40: si el servidor rechaza por ultimo Administrador, pinta su mensaje sin cerrar', async () => {
    const rechazo: ErrorState = {
      status: 'error',
      code: 'company_last_administrator',
      message: 'Es el único Administrador de la empresa: crea otro antes de darlo de baja.',
    };
    deleteAdministratorActionMock.mockResolvedValue(rechazo);
    const user = setupUser();
    const onOpenChange = montar(DIANA);
    await user.click(screen.getByTestId('administrator-delete-confirm'));
    const region = await screen.findByTestId('administrator-delete-error');
    expect(region).toHaveTextContent(
      'Es el único Administrador de la empresa: crea otro antes de darlo de baja.',
    );
    expect(region).toHaveAttribute('data-code', 'company_last_administrator');
    expect(screen.getByTestId('administrator-delete-dialog')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it('R7: unauthorized se pinta dentro del dialogo, sin cerrarlo', async () => {
    deleteAdministratorActionMock.mockResolvedValue({
      status: 'error',
      code: 'unauthorized',
      message: 'El actor no tiene permiso para realizar esta operacion.',
    });
    const user = setupUser();
    const onOpenChange = montar(DIANA);
    await user.click(screen.getByTestId('administrator-delete-confirm'));
    expect(await screen.findByTestId('administrator-delete-error')).toHaveTextContent(
      'El actor no tiene permiso para realizar esta operacion.',
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
