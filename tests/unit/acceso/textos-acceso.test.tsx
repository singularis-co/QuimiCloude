// Textos de las dos pantallas de acceso: la tabla exacta de R25, los nombres de R26 (seis
// en la lista en vivo, siete en el aviso del servidor; QC-273) y
// ninguna forma sin tilde en lo pintado.
//
// «Lo pintado» es el `textContent` del documento (incluye el texto solo para lectores de pantalla)
// más los atributos de los que sale un nombre accesible que no está en el texto: `aria-label`,
// `alt`, `title`, `placeholder` y `value` de los botones.

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';

import LoginPage from '@/app/(public)/login/page';
import CredentialSetupPage from '@/app/(public)/establecer-contrasena/[token]/page';
import type { SetCredentialFormState } from '@/lib/modules/identity/adapters/driving/credential-setup-actions';
import type { LoginFormState } from '@/lib/modules/identity/adapters/driving/login-form-state';
import { errorMessage, UNEXPECTED_ERROR_CODE } from '@/lib/modules/errores';
import { CREDENTIAL_RULES } from '@/lib/modules/identity';

import { setupUser } from '../../helpers/user-event';

const { loginActionMock, setCredentialActionMock } = vi.hoisted(() => ({
  loginActionMock:
    vi.fn<(prevState: LoginFormState, formData: FormData) => Promise<LoginFormState>>(),
  setCredentialActionMock:
    vi.fn<
      (prevState: SetCredentialFormState, formData: FormData) => Promise<SetCredentialFormState>
    >(),
}));

vi.mock('@/lib/modules/identity/adapters/driving/login-action', () => ({
  loginAction: loginActionMock,
}));

vi.mock('@/lib/modules/identity/adapters/driving/credential-setup-actions', () => ({
  setCredentialWithLinkAction: setCredentialActionMock,
}));

const SECRETO = 'n5q7Yx0Zt1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r';

/** Los seis nombres que la lista comprueba en vivo, en el orden de la política. */
const NOMBRES_EN_VIVO = [
  'Al menos 8 caracteres',
  'Como máximo 64 caracteres',
  'Al menos una letra mayúscula',
  'Al menos una letra minúscula',
  'Al menos un número',
  'Al menos un símbolo que no sea letra ni número',
];

/** La regla que solo comprueba el servidor: no sale en la lista, sí en su aviso (QC-273). */
const NOMBRE_DE_FILTRADAS = 'No debe figurar en una lista de credenciales filtradas';

/** Los siete nombres de R26, en el orden de la política. */
const NOMBRES_DE_LOS_REQUISITOS = [...NOMBRES_EN_VIVO, NOMBRE_DE_FILTRADAS];

const FORMAS_SIN_TILDE = /contrasena|sesion|todavia|repitela/i;

const ATRIBUTOS_CON_NOMBRE = ['aria-label', 'alt', 'title', 'placeholder'] as const;

/** Todo el texto pintado y los nombres accesibles que no salen del texto. */
function textoPintado(): string[] {
  const textos = [document.body.textContent ?? ''];
  for (const elemento of document.body.querySelectorAll('*')) {
    for (const atributo of ATRIBUTOS_CON_NOMBRE) {
      const valor = elemento.getAttribute(atributo);
      if (valor) textos.push(valor);
    }
    if (elemento instanceof HTMLInputElement && ['button', 'submit'].includes(elemento.type)) {
      textos.push(elemento.value);
    }
  }
  return textos;
}

function expectSinFormasSinTilde(): void {
  for (const texto of textoPintado()) {
    expect(texto).not.toMatch(FORMAS_SIN_TILDE);
  }
}

/** El nombre visible de cada requisito, sin el estado que se anuncia solo a lectores de pantalla. */
function nombresDeLaLista(lista: HTMLElement): string[] {
  return [...lista.querySelectorAll('li[data-rule] > span:not(.sr-only)')].map(
    (nombre) => nombre.textContent ?? '',
  );
}

/** Deja la action colgada y devuelve con qué soltarla. */
function accionColgada<Estado>(mock: {
  mockImplementation: (impl: () => Promise<Estado>) => unknown;
}) {
  let soltar: (estado: Estado) => void = () => {};
  mock.mockImplementation(
    () =>
      new Promise<Estado>((resolve) => {
        soltar = resolve;
      }),
  );
  return async (estado: Estado) => {
    await act(async () => {
      soltar(estado);
    });
  };
}

async function pintarLogin() {
  return render(await LoginPage({ searchParams: Promise.resolve({}) }));
}

async function pintarEstablecer() {
  return render(await CredentialSetupPage({ params: Promise.resolve({ token: SECRETO }) }));
}

/** Envía «Establecer contraseña» con la respuesta dada y espera a que salga de «enviando». */
async function enviarEstablecerCon(estado: SetCredentialFormState) {
  setCredentialActionMock.mockResolvedValue(estado);
  const user = setupUser();
  await pintarEstablecer();
  await user.click(screen.getByTestId('set-credential-submit'));
  await waitFor(() => expect(setCredentialActionMock).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
}

beforeEach(() => {
  vi.clearAllMocks();
  loginActionMock.mockResolvedValue({ status: 'idle' });
  setCredentialActionMock.mockReset();
  setCredentialActionMock.mockResolvedValue({ status: 'idle' });
});

afterEach(() => {
  cleanup();
});

describe('R25 — textos del login', () => {
  it('R25 — etiquetas «Usuario» y «Contraseña», botón «Entrar» y pie «¿Olvidaste tu contraseña?», sin formas sin tilde', async () => {
    await pintarLogin();

    expect(screen.getByLabelText('Usuario')).toBe(screen.getByTestId('login-username'));
    expect(screen.getByLabelText('Contraseña')).toBe(screen.getByTestId('login-password'));
    expect(screen.getByTestId('login-submit')).toHaveAccessibleName('Entrar');
    expect(screen.getByTestId('login-submit')).toHaveTextContent(/^Entrar$/);
    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveTextContent(
      '¿Olvidaste tu contraseña?',
    );
    expect(screen.getByRole('button', { name: 'Mostrar la contraseña' })).toBeInTheDocument();
    expectSinFormasSinTilde();
  });

  it('R25 — el ojo pasa a «Ocultar la contraseña» y el botón a «Entrando…» mientras se envía', async () => {
    const user = setupUser();
    const soltar = accionColgada<LoginFormState>(loginActionMock);
    await pintarLogin();

    await user.click(screen.getByRole('button', { name: 'Mostrar la contraseña' }));
    expect(screen.getByRole('button', { name: 'Ocultar la contraseña' })).toBeInTheDocument();
    expectSinFormasSinTilde();

    await user.type(screen.getByTestId('login-username'), 'ana.perez');
    await user.type(screen.getByTestId('login-password'), 'clave');
    const boton = screen.getByTestId('login-submit');
    await user.click(boton);

    await waitFor(() => expect(boton).toHaveAttribute('aria-busy', 'true'));
    expect(boton).toHaveTextContent(/^Entrando…$/);
    expect(boton).toHaveAccessibleName('Entrando…');
    expectSinFormasSinTilde();

    await soltar({ status: 'idle' });
  });
});

describe('R25 — textos de establecer contraseña', () => {
  it('R25 — en reposo: cabecera, etiquetas, ojos y botón «Guardar contraseña», sin formas sin tilde', async () => {
    await pintarEstablecer();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Establece tu contraseña$/);
    expect(
      screen.getByText('Escribe la contraseña con la que vas a entrar y repítela para confirmarla.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña nueva')).toBe(
      screen.getByTestId('set-credential-credential'),
    );
    expect(screen.getByLabelText('Repite la contraseña')).toBe(
      screen.getByTestId('set-credential-confirmation'),
    );
    expect(screen.getAllByRole('button', { name: 'Mostrar la contraseña' })).toHaveLength(2);
    expect(screen.getByTestId('set-credential-submit')).toHaveAccessibleName('Guardar contraseña');
    expect(screen.getByTestId('set-credential-submit')).toHaveTextContent(/^Guardar contraseña$/);
    expectSinFormasSinTilde();
  });

  it('R25 — el ojo pasa a «Ocultar la contraseña» y el botón a «Guardando…» mientras se envía', async () => {
    const user = setupUser();
    const soltar = accionColgada<SetCredentialFormState>(setCredentialActionMock);
    await pintarEstablecer();

    const [ojoNueva] = screen.getAllByRole('button', { name: 'Mostrar la contraseña' });
    await user.click(ojoNueva as HTMLElement);
    expect(screen.getByRole('button', { name: 'Ocultar la contraseña' })).toBeInTheDocument();

    const boton = screen.getByTestId('set-credential-submit');
    await user.click(boton);
    await waitFor(() => expect(boton).toHaveAttribute('aria-busy', 'true'));
    expect(boton).toHaveTextContent(/^Guardando…$/);
    expect(boton).toHaveAccessibleName('Guardando…');
    expectSinFormasSinTilde();

    await soltar({ status: 'idle' });
    await waitFor(() => expect(boton).toHaveAttribute('aria-busy', 'false'));
  });

  it('R25 — «Las dos contraseñas no coinciden.» al no coincidir, sin formas sin tilde', async () => {
    await enviarEstablecerCon({ status: 'mismatch' });

    expect(screen.getByTestId('set-credential-confirmation-error')).toHaveTextContent(
      /^Las dos contraseñas no coinciden\.$/,
    );
    expectSinFormasSinTilde();
  });

  it('R25 — «La contraseña todavía no cumple estos requisitos:» con la política incumplida, sin formas sin tilde', async () => {
    await enviarEstablecerCon({ status: 'invalid_credential', unmet: [...CREDENTIAL_RULES] });

    expect(screen.getByTestId('set-credential-feedback')).toHaveTextContent(
      'La contraseña todavía no cumple estos requisitos:',
    );
    expectSinFormasSinTilde();
  });

  it('R25 — «Referencia del fallo:» en el error inesperado del catálogo, sin formas sin tilde', async () => {
    await enviarEstablecerCon({
      status: 'error',
      code: UNEXPECTED_ERROR_CODE,
      message: errorMessage(UNEXPECTED_ERROR_CODE),
      reference: 'ref-0001',
    });

    expect(screen.getByTestId('set-credential-error-reference')).toHaveTextContent(
      /^Referencia del fallo: ref-0001$/,
    );
    expectSinFormasSinTilde();
  });

  it('R25 — en éxito: «Contraseña establecida», «Ya puedes entrar con ella.» e «Ir a iniciar sesión», sin formas sin tilde', async () => {
    await enviarEstablecerCon({ status: 'success' });

    const exito = screen.getByTestId('set-credential-success');
    expect(within(exito).getByRole('heading', { level: 1 })).toHaveTextContent(
      /^Contraseña establecida$/,
    );
    expect(within(exito).getByText('Ya puedes entrar con ella.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a iniciar sesión' })).toHaveTextContent(
      'Ir a iniciar sesión',
    );
    expectSinFormasSinTilde();
  });
});

describe('R26 — los nombres de la política', () => {
  it('R26 — la lista de requisitos nombra las seis reglas en vivo con la redacción exacta', async () => {
    await pintarEstablecer();

    const lista = document.getElementById('credential-requirements') as HTMLElement;
    expect(nombresDeLaLista(lista)).toEqual(NOMBRES_EN_VIVO);
  });

  it('QC-273 — la lista de requisitos no muestra el de credenciales filtradas', async () => {
    await pintarEstablecer();

    const lista = document.getElementById('credential-requirements') as HTMLElement;
    expect(within(lista).queryByText(NOMBRE_DE_FILTRADAS)).toBeNull();
    expect(lista.querySelector('[data-rule="breached"]')).toBeNull();
  });

  it('QC-273 — si el servidor la rechaza por filtrada, el aviso lo dice con la redacción exacta', async () => {
    await enviarEstablecerCon({ status: 'invalid_credential', unmet: ['breached'] });

    const aviso = within(screen.getByTestId('set-credential-feedback')).getByTestId(
      'set-credential-unmet',
    );
    expect(within(aviso).getAllByRole('listitem').map((regla) => regla.textContent)).toEqual([
      NOMBRE_DE_FILTRADAS,
    ]);
  });

  it('R26 — el aviso de requisitos incumplidos nombra las siete reglas con la redacción exacta', async () => {
    await enviarEstablecerCon({ status: 'invalid_credential', unmet: [...CREDENTIAL_RULES] });

    const aviso = within(screen.getByTestId('set-credential-feedback')).getByTestId(
      'set-credential-unmet',
    );
    expect(within(aviso).getAllByRole('listitem').map((regla) => regla.textContent)).toEqual(
      NOMBRES_DE_LOS_REQUISITOS,
    );
  });
});
