// El reenvío del enlace de contraseña a un Administrador pendiente. La Server Action está simulada:
// lo que se afirma es el `FormData` que recibe y lo que el diálogo hace con su respuesta.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AdministratorResendLinkDialog,
  type AdministratorResendLinkDialogProps,
} from '@/app/(private)/maestro/administradores/components';
import type { ErrorState } from '@/lib/modules/errores';

import { setupUser } from '../../helpers/user-event';

const { routerMock, resendActionMock, toastMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  resendActionMock: vi.fn<(prev: unknown, formData: FormData) => Promise<unknown>>(),
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
  deleteAdministratorAction: vi.fn(),
  resendAdministratorLinkAction: resendActionMock,
}));

vi.mock('@/lib/modules/identity/adapters/driving/company-actions', () => ({
  listCompaniesAction: vi.fn(),
}));

const JULIAN: AdministratorResendLinkDialogProps['administrator'] = {
  id: 'a1b2c3d4-0002-4a00-8000-000000000002',
  firstNames: 'Julián',
  lastNames: 'Castro',
  email: 'jcastro@quimicosvalle.co',
};

function montar(onOpenChange = vi.fn()) {
  render(<AdministratorResendLinkDialog administrator={JULIAN} open onOpenChange={onOpenChange} />);
  return onOpenChange;
}

async function confirmar(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByTestId('administrator-resend-confirm'));
  await waitFor(() => expect(resendActionMock).toHaveBeenCalled());
}

function rechazo(code: Exclude<ErrorState['code'], 'unexpected'>, message: string): ErrorState {
  return { status: 'error', code, message };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('el dialogo «Reenviar enlace»', () => {
  it('R46: pregunta «¿Reenviar el enlace a <nombre>?» con el correo y no pide ningun dato', () => {
    montar();
    const dialogo = screen.getByTestId('administrator-resend-dialog');
    expect(
      within(dialogo).getByRole('heading', { name: '¿Reenviar el enlace a Julián Castro?' }),
    ).toBeInTheDocument();
    const mensaje = screen.getByTestId('administrator-resend-message');
    expect(mensaje).toHaveTextContent(
      'Le llegará a jcastro@quimicosvalle.co un correo nuevo para fijar su contraseña. El enlace anterior deja de servir.',
    );
    expect(within(mensaje).getByText('jcastro@quimicosvalle.co').tagName).toBe('STRONG');
    expect(screen.getByTestId('administrator-resend-dismiss')).toHaveTextContent('Volver');
    expect(screen.getByTestId('administrator-resend-confirm')).toHaveTextContent('Reenviar enlace');
    expect(within(dialogo).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dialogo).queryAllByRole('combobox')).toHaveLength(0);
  });

  it('R46: confirmar manda un FormData con solo el id', async () => {
    resendActionMock.mockResolvedValue({ status: 'success', mail: 'sent' });
    const user = setupUser();
    montar();
    await confirmar(user);
    const formData = resendActionMock.mock.calls[0]![1];
    expect([...formData.keys()]).toEqual(['id']);
    expect(formData.get('id')).toBe(JULIAN.id);
  });

  it('R47: si el correo salio, cierra y avisa «Enviamos el enlace a <nombre>.» sin refrescar la lista', async () => {
    resendActionMock.mockResolvedValue({ status: 'success', mail: 'sent' });
    const user = setupUser();
    const onOpenChange = montar();
    await confirmar(user);
    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith('Enviamos el enlace a Julián Castro.'),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock.warning).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it('R47: si el correo no salio, cierra y avisa con el texto del fallo sin refrescar la lista', async () => {
    resendActionMock.mockResolvedValue({ status: 'success', mail: 'failed' });
    const user = setupUser();
    const onOpenChange = montar();
    await confirmar(user);
    await waitFor(() =>
      expect(toastMock.warning).toHaveBeenCalledWith('No pudimos enviar el correo a Julián Castro.'),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it.each([
    ['user_not_pending', 'La cuenta ya no esta pendiente de activacion.'],
    ['user_not_found', 'El usuario no existe.'],
    ['unauthorized', 'El actor no tiene permiso para realizar esta operacion.'],
  ] as const)(
    'R48: %s se pinta dentro del dialogo, que sigue abierto y sin aviso de exito',
    async (code, message) => {
      resendActionMock.mockResolvedValue(rechazo(code, message));
      const user = setupUser();
      const onOpenChange = montar();
      await confirmar(user);
      const region = await screen.findByTestId('administrator-resend-error');
      expect(region).toHaveTextContent(message);
      expect(region).toHaveAttribute('data-code', code);
      expect(screen.getByTestId('administrator-resend-dialog')).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(toastMock.warning).not.toHaveBeenCalled();
    },
  );

  it('R48: un error inesperado se pinta con su referencia', async () => {
    resendActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: 'Ocurrio un error inesperado.',
      reference: 'req-5a6b',
    });
    const user = setupUser();
    montar();
    await confirmar(user);
    expect(await screen.findByTestId('administrator-resend-error')).toHaveTextContent('req-5a6b');
    expect(screen.getByTestId('administrator-resend-dialog')).toBeInTheDocument();
  });

  it('R49: mientras reenvia, el boton dice «Reenviando…», esta deshabilitado y no envia dos veces', async () => {
    let resolver: (value: unknown) => void = () => {};
    resendActionMock.mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      }),
    );
    const user = setupUser();
    montar();
    await confirmar(user);
    const boton = screen.getByTestId('administrator-resend-confirm');
    await waitFor(() => expect(boton).toHaveTextContent('Reenviando…'));
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('aria-busy', 'true');
    await user.click(boton);
    expect(resendActionMock).toHaveBeenCalledTimes(1);
    resolver({ status: 'success', mail: 'sent' });
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledTimes(1));
  });
});
