// Login rediseñado: tarjeta, cabecera, ojo, envío y pie. Un `describe` por requisito.
//
// La pantalla es un Server Component que puede devolver promesa: se invoca y se pinta su árbol.

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';

import LoginPage from '@/app/(public)/login/page';
import { PASSWORD_FIELD_HIDE_LABEL, PASSWORD_FIELD_SHOW_LABEL } from '@/components/shared/password-field';
import {
  GENERIC_CREDENTIALS_ERROR,
  type LoginFormState,
} from '@/lib/modules/identity/adapters/driving/login-form-state';
import { BRAND_LABEL } from '@/lib/shared/navigation/private-nav';
import { FORGOT_PASSWORD_ROUTE } from '@/lib/shared/routes';

import { setupUser } from '../../helpers/user-event';

const { loginActionMock } = vi.hoisted(() => ({
  loginActionMock:
    vi.fn<(prevState: LoginFormState, formData: FormData) => Promise<LoginFormState>>(),
}));

vi.mock('@/lib/modules/identity/adapters/driving/login-action', () => ({
  loginAction: loginActionMock,
}));

async function pintarLogin(searchParams: Record<string, string> = {}) {
  return render(await LoginPage({ searchParams: Promise.resolve(searchParams) }));
}

function errorState(attemptId: string, username = 'ana.perez'): LoginFormState {
  return { status: 'error', attemptId, username, message: GENERIC_CREDENTIALS_ERROR };
}

/** Deja la action colgada y devuelve el resolvedor, para observar el estado «enviando». */
function accionPendiente() {
  let resolver!: (state: LoginFormState) => void;
  loginActionMock.mockImplementation(
    () =>
      new Promise<LoginFormState>((resolve) => {
        resolver = resolve;
      }),
  );
  return {
    resolve: async (state: LoginFormState) => {
      await act(async () => {
        resolver(state);
      });
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loginActionMock.mockResolvedValue(errorState('intento-1'));
});

afterEach(() => {
  cleanup();
});

describe('R9: tarjeta de 400 px con un único h1 de isotipo y marca escrita, nombrado BRAND_LABEL', () => {
  it('pinta la tarjeta estrecha, nombrada por su único h1, que lleva isotipo decorativo y la marca escrita', async () => {
    await pintarLogin();

    const tarjeta = document.querySelector('[data-access="card"]');
    expect(tarjeta).toHaveAttribute('data-width', 'default');

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    const titulo = titulos[0];
    expect(titulo).toHaveAccessibleName(BRAND_LABEL);
    expect(screen.getByRole('region', { name: BRAND_LABEL })).toBe(tarjeta);
    expect(tarjeta).toContainElement(titulo);

    const isotipos = [...titulo.querySelectorAll('img')];
    expect(isotipos.length).toBeGreaterThan(0);
    for (const isotipo of isotipos) {
      expect(isotipo.getAttribute('src')).toContain('isotipo');
      expect(isotipo).toHaveAttribute('alt', '');
    }

    // La segunda mitad de la marca va en el color primario y con más peso.
    const acento = within(titulo).getByText((_, nodo) => nodo?.tagName === 'SPAN' && nodo.textContent === 'Cloude');
    expect(acento).toHaveClass('text-primary', 'font-semibold');
    expect(titulo.textContent).toBe(BRAND_LABEL);
  });
});

describe('R10: el campo «Contraseña» del login tiene el ojo de mostrar u ocultar', () => {
  it('el ojo controla el campo, lleva aria-pressed y su nombre cambia con el estado', async () => {
    const user = setupUser();
    await pintarLogin();

    const campo = screen.getByLabelText('Contraseña');
    expect(campo).toBe(screen.getByTestId('login-password'));
    const ojo = screen.getByRole('button', { name: PASSWORD_FIELD_SHOW_LABEL });

    expect(ojo).toHaveAttribute('type', 'button');
    expect(ojo).toHaveAttribute('aria-controls', campo.id);
    expect(ojo).toHaveAttribute('aria-pressed', 'false');
    expect(campo).toHaveAttribute('type', 'password');

    await user.type(campo, 'clave');
    await user.click(ojo);

    expect(campo).toHaveAttribute('type', 'text');
    expect(ojo).toHaveAttribute('aria-pressed', 'true');
    expect(ojo).toHaveAccessibleName(PASSWORD_FIELD_HIDE_LABEL);
    expect(loginActionMock).not.toHaveBeenCalled();

    await user.click(ojo);
    expect(campo).toHaveAttribute('type', 'password');
    expect(ojo).toHaveAccessibleName(PASSWORD_FIELD_SHOW_LABEL);
    expect(loginActionMock).not.toHaveBeenCalled();
  });
});

describe('R11: se conserva el contrato del formulario de login', () => {
  it('mantiene nombres, data-testid, el destino oculto y el error de contraseña con aria-describedby', async () => {
    const user = setupUser();
    loginActionMock.mockResolvedValue({
      status: 'invalid',
      attemptId: 'intento-1',
      username: 'ana.perez',
      fieldErrors: { password: 'Falta la contraseña.' },
    });
    await pintarLogin({ next: '/inventario' });

    const form = screen.getByTestId('login-form');
    expect(screen.getByTestId('login-username')).toHaveAttribute('name', 'username');
    expect(screen.getByTestId('login-password')).toHaveAttribute('name', 'password');
    expect(screen.getByTestId('login-password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByTestId('login-next')).toHaveAttribute('type', 'hidden');
    expect(screen.getByTestId('login-next')).toHaveValue('/inventario');
    expect(form).toContainElement(screen.getByTestId('login-submit'));

    await user.type(screen.getByTestId('login-username'), 'ana.perez');
    await user.click(screen.getByTestId('login-submit'));

    const error = await screen.findByTestId('login-password-error');
    const campo = screen.getByTestId('login-password');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
    expect(error.id).toBe('password-error');
    expect(campo).toHaveValue('');
    expect(screen.getByTestId('login-username')).toHaveValue('ana.perez');
  });

  it('un intento rechazado deja un único aviso emergente con el error genérico', async () => {
    const user = setupUser();
    const errorSpy = vi.spyOn(toast, 'error');
    await pintarLogin();

    await user.type(screen.getByTestId('login-username'), 'ana.perez');
    await user.type(screen.getByTestId('login-password'), 'clave');
    await user.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(1));
    expect(errorSpy).toHaveBeenCalledWith(GENERIC_CREDENTIALS_ERROR);
    errorSpy.mockRestore();
  });
});

describe('R12: mientras se envía, el botón dice «Entrando…», lleva spinner oculto, se deshabilita y ocupa todo el ancho', () => {
  it('pinta el estado de envío y vuelve a «Entrar» al terminar', async () => {
    const user = setupUser();
    const enCurso = accionPendiente();
    await pintarLogin();

    const boton = screen.getByTestId('login-submit');
    expect(boton).toHaveClass('w-full');
    expect(boton).toHaveTextContent('Entrar');
    expect(boton.querySelector('svg')).toBeNull();

    await user.type(screen.getByTestId('login-username'), 'ana.perez');
    await user.type(screen.getByTestId('login-password'), 'clave');
    await user.click(boton);

    expect(boton).toHaveTextContent('Entrando…');
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('aria-busy', 'true');
    const spinner = boton.querySelector('svg');
    expect(spinner).not.toBeNull();
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
    expect(boton).toHaveAccessibleName('Entrando…');

    await enCurso.resolve(errorState('intento-1'));
    await waitFor(() => expect(boton).toHaveTextContent('Entrar'));
  });
});

describe('R13: «¿Olvidaste tu contraseña?» enlaza a FORGOT_PASSWORD_ROUTE, fuera del form, al pie y con borde', () => {
  it('el enlace va al pie de la tarjeta, separado por un borde superior y fuera del formulario', async () => {
    await pintarLogin();

    const enlace = screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' });
    expect(enlace).toBe(screen.getByTestId('login-forgot-password'));
    expect(enlace).toHaveAttribute('href', FORGOT_PASSWORD_ROUTE);
    expect(screen.getByTestId('login-form').contains(enlace)).toBe(false);
    expect(enlace).toHaveClass('min-h-11');

    const tarjeta = document.querySelector('[data-access="card"]')!;
    const pie = enlace.parentElement!;
    expect(pie.parentElement).toBe(tarjeta);
    expect(tarjeta.lastElementChild).toBe(pie);
    expect(pie).toHaveClass('border-t');
  });
});
