// Rediseño de «Establecer contraseña». Un `describe` por requisito o grupo de requisitos.
//
// El primer caso de R20 no monta el formulario de la ruta: reproduce su cableado mínimo
// (`useActionState` + `<form action>` + `PasswordField` con lista) con una action que rechaza,
// para medir qué ocurre cuando React reinicia el `<form>` al terminar la action. El resto monta la
// página real con la Server Action mockeada.

import { useActionState } from 'react';

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';

import CredentialSetupPage from '@/app/(public)/establecer-contrasena/[token]/page';
import { CredentialRequirements } from '@/components/shared/credential-requirements';
import { CREDENTIAL_RULE_LABELS } from '@/components/shared/credential-rule-labels';
import { PasswordField } from '@/components/shared/password-field';
import type { SetCredentialFormState } from '@/lib/modules/identity/adapters/driving/credential-setup-actions';
import { BRAND_LABEL } from '@/lib/shared/navigation/private-nav';
import { LOGIN_ROUTE } from '@/lib/shared/routes';

import { setupUser } from '../../helpers/user-event';

const { accionMock } = vi.hoisted(() => ({
  accionMock:
    vi.fn<
      (prevState: SetCredentialFormState, formData: FormData) => Promise<SetCredentialFormState>
    >(),
}));

vi.mock('@/lib/modules/identity/adapters/driving/credential-setup-actions', () => ({
  setCredentialWithLinkAction: accionMock,
}));

const SECRETO = 'n5q7Yx0Zt1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r';

beforeEach(() => {
  accionMock.mockReset();
  accionMock.mockResolvedValue({ status: 'idle' });
});

afterEach(() => {
  cleanup();
});

async function pintarPagina() {
  return render(await CredentialSetupPage({ params: Promise.resolve({ token: SECRETO }) }));
}

/** Envía el formulario real con la respuesta dada y espera a que React salga de «enviando». */
async function enviarCon(estado: SetCredentialFormState, candidata?: string) {
  accionMock.mockResolvedValue(estado);
  const user = setupUser();
  await pintarPagina();
  if (candidata !== undefined) {
    await user.type(screen.getByTestId('set-credential-credential'), candidata);
  }
  await user.click(screen.getByTestId('set-credential-submit'));
  await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
  await waitFor(() => expect(accionMock).toHaveBeenCalledTimes(1));
  return user;
}

function idsDescritos(elemento: HTMLElement): string[] {
  return (elemento.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
}

/** Cumple las seis reglas comprobables en el navegador. */
const CANDIDATA_QUE_CUMPLE_LAS_SEIS = 'Abcdefg1#';

type EstadoDePrueba = { readonly intento: number; readonly rechazado: boolean };

const ESTADO_INICIAL: EstadoDePrueba = { intento: 0, rechazado: false };

async function accionQueRechaza(previo: EstadoDePrueba): Promise<EstadoDePrueba> {
  return { intento: previo.intento + 1, rechazado: true };
}

function FormularioDePrueba() {
  const [estado, formAction] = useActionState(accionQueRechaza, ESTADO_INICIAL);

  return (
    <form action={formAction} aria-label="formulario de prueba">
      <PasswordField
        name="credential"
        id="credential"
        label="Contraseña nueva"
        autoComplete="new-password"
        requirements={{}}
      />
      {estado.rechazado ? <p data-testid="rechazo">rechazado {estado.intento}</p> : null}
      <button type="submit">Enviar</button>
    </form>
  );
}

function estadosDeLaLista(raiz: ParentNode): Record<string, string | null> {
  const estados: Record<string, string | null> = {};
  for (const item of raiz.querySelectorAll('li[data-rule]')) {
    estados[item.getAttribute('data-rule') ?? ''] = item.getAttribute('data-state');
  }
  return estados;
}

/** Lo que la lista debería decir para un valor dado, calculado por la propia lista sin estado. */
function estadosEsperadosPara(valor: string): Record<string, string | null> {
  const contenedor = document.createElement('div');
  const { unmount } = render(<CredentialRequirements candidate={valor} />, { container: contenedor });
  const estados = estadosDeLaLista(contenedor);
  unmount();
  return estados;
}

describe('R20 — tras el rechazo del servidor la lista de requisitos sigue al campo visible', () => {
  it('R20 — la lista coincide con el valor visible de «Contraseña nueva» tras el reinicio del formulario', async () => {
    const user = setupUser();
    render(<FormularioDePrueba />);

    const input = screen.getByLabelText<HTMLInputElement>('Contraseña nueva');
    await user.type(input, CANDIDATA_QUE_CUMPLE_LAS_SEIS);
    const lista = document.getElementById('credential-requirements');
    expect(lista).not.toBeNull();
    expect(estadosDeLaLista(lista as HTMLElement)).toEqual(
      estadosEsperadosPara(CANDIDATA_QUE_CUMPLE_LAS_SEIS),
    );

    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByTestId('rechazo');
    // Deja que React termine el reinicio del formulario que encola tras la action.
    await waitFor(() => expect(screen.getByTestId('rechazo')).toHaveTextContent('rechazado 1'));

    const valorVisible = screen.getByLabelText<HTMLInputElement>('Contraseña nueva').value;
    const listaTrasRechazo = document.getElementById('credential-requirements');
    expect(estadosDeLaLista(listaTrasRechazo as HTMLElement)).toEqual(
      estadosEsperadosPara(valorVisible),
    );
  });

  it('R20 — en el formulario de la ruta, tras invalid_credential la lista coincide con el valor visible', async () => {
    await enviarCon({ status: 'invalid_credential', unmet: ['breached'] }, CANDIDATA_QUE_CUMPLE_LAS_SEIS);

    const valorVisible = screen.getByTestId<HTMLInputElement>('set-credential-credential').value;
    const lista = document.getElementById('credential-requirements');
    expect(lista).not.toBeNull();
    expect(estadosDeLaLista(lista as HTMLElement)).toEqual(estadosEsperadosPara(valorVisible));
  });
});

describe('R14 — cabecera de la tarjeta de establecer contraseña', () => {
  it('R14 — tarjeta ancha con isotipo nombrado BRAND_LABEL, un único h1 y la introducción', async () => {
    await pintarPagina();

    const tarjeta = document.querySelector<HTMLElement>('[data-access="card"]');
    expect(tarjeta).not.toBeNull();
    const card = tarjeta as HTMLElement;
    expect(card).toHaveAttribute('data-width', 'wide');

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent('Establece tu contraseña');
    expect(screen.getByRole('region', { name: 'Establece tu contraseña' })).toBe(card);

    const isotipos = within(card).getAllByAltText(BRAND_LABEL);
    expect(isotipos.length).toBeGreaterThan(0);
    for (const isotipo of isotipos) expect(isotipo).toHaveAttribute('height', '40');

    expect(
      within(card).getByText('Escribe la contraseña con la que vas a entrar y repítela para confirmarla.'),
    ).toBeInTheDocument();
  });
});

describe('R15 — los dos campos con su ojo', () => {
  it('R15 — cada ojo controla solo su campo, con new-password y los nombres del formulario', async () => {
    const user = setupUser();
    await pintarPagina();

    const nueva = screen.getByLabelText('Contraseña nueva');
    const repetir = screen.getByLabelText('Repite la contraseña');
    expect(nueva).toHaveAttribute('name', 'credential');
    expect(repetir).toHaveAttribute('name', 'credentialConfirmation');
    for (const campo of [nueva, repetir]) {
      expect(campo).toHaveAttribute('autocomplete', 'new-password');
      expect(campo).toHaveAttribute('type', 'password');
    }

    const ojos = screen.getAllByRole('button', { name: 'Mostrar la contraseña' });
    expect(ojos).toHaveLength(2);
    const [ojoNueva, ojoRepetir] = ojos as [HTMLElement, HTMLElement];
    expect(ojoNueva).toHaveAttribute('aria-controls', nueva.id);
    expect(ojoRepetir).toHaveAttribute('aria-controls', repetir.id);

    await user.click(ojoRepetir);
    expect(repetir).toHaveAttribute('type', 'text');
    expect(nueva).toHaveAttribute('type', 'password');
    expect(ojoRepetir).toHaveAttribute('aria-pressed', 'true');
    expect(ojoRepetir).toHaveAccessibleName('Ocultar la contraseña');
    expect(ojoNueva).toHaveAttribute('aria-pressed', 'false');
    expect(accionMock).not.toHaveBeenCalled();
  });
});

describe('R16 — la lista de requisitos se marca mientras se escribe', () => {
  it('R16 — siete requisitos enlazados al campo y marcados en cada pulsación con texto accesible', async () => {
    const user = setupUser();
    await pintarPagina();

    const nueva = screen.getByTestId('set-credential-credential');
    const lista = document.getElementById('credential-requirements') as HTMLElement;
    expect(idsDescritos(nueva)).toContain('credential-requirements');
    expect(within(lista).getAllByRole('listitem')).toHaveLength(7);

    await user.type(nueva, 'a');
    expect(estadosDeLaLista(lista)).toEqual(estadosEsperadosPara('a'));
    expect(lista.querySelector('[data-rule="no_lowercase"]')).toHaveAttribute('data-state', 'met');
    expect(lista.querySelector('[data-rule="no_uppercase"]')).toHaveAttribute('data-state', 'unmet');

    await user.type(nueva, 'A');
    expect(lista.querySelector('[data-rule="no_uppercase"]')).toHaveAttribute('data-state', 'met');
    expect(within(lista).getAllByText('Requisito cumplido').length).toBeGreaterThan(0);
  });
});

describe('R17 — «filtradas» queda pendiente', () => {
  it('R17 — con las seis comprobables cumplidas, «filtradas» sigue pendiente', async () => {
    const user = setupUser();
    await pintarPagina();

    await user.type(screen.getByTestId('set-credential-credential'), CANDIDATA_QUE_CUMPLE_LAS_SEIS);
    const filtradas = document.querySelector('#credential-requirements [data-rule="breached"]');
    expect(filtradas).toHaveAttribute('data-state', 'unknown');
    expect(filtradas).toHaveTextContent(CREDENTIAL_RULE_LABELS.breached);
  });
});

describe('R18 — aviso de requisitos incumplidos', () => {
  it('R18 — aviso de peligro con su título, cada regla del servidor y citado por «Contraseña nueva»', async () => {
    await enviarCon({ status: 'invalid_credential', unmet: ['no_symbol', 'breached'] });

    const aviso = screen.getByTestId('set-credential-feedback');
    expect(aviso).toHaveAttribute('role', 'alert');
    expect(aviso).toHaveAttribute('data-tone', 'danger');
    expect(aviso).toHaveAttribute('id', 'set-credential-feedback');
    expect(aviso).toHaveTextContent('La contraseña todavía no cumple estos requisitos:');

    const lista = within(aviso).getByTestId('set-credential-unmet');
    expect(within(lista).getAllByRole('listitem').map((regla) => regla.textContent)).toEqual([
      CREDENTIAL_RULE_LABELS.no_symbol,
      CREDENTIAL_RULE_LABELS.breached,
    ]);

    expect(idsDescritos(screen.getByTestId('set-credential-credential'))).toContain(
      'set-credential-feedback',
    );
  });
});

describe('R19 — no coinciden', () => {
  it('R19 — error de campo bajo «Repite la contraseña» y sin el aviso de requisitos', async () => {
    await enviarCon({ status: 'mismatch' });

    const repetir = screen.getByTestId('set-credential-confirmation');
    const error = screen.getByTestId('set-credential-confirmation-error');
    expect(error).toHaveTextContent('Las dos contraseñas no coinciden.');
    expect(error).toHaveAttribute('role', 'alert');
    expect(repetir).toHaveAttribute('aria-invalid', 'true');
    expect(idsDescritos(repetir)).toContain(error.id);

    expect(screen.queryByTestId('set-credential-feedback')).toBeNull();
    expect(screen.queryByTestId('set-credential-unmet')).toBeNull();
    expect(idsDescritos(screen.getByTestId('set-credential-credential'))).not.toContain(
      'set-credential-feedback',
    );
  });
});

describe('R21 — el botón mientras se envía', () => {
  it('R21 — «Guardando…», indicador oculto, deshabilitado, aria-busy y a todo el ancho', async () => {
    let responder: (estado: SetCredentialFormState) => void = () => {};
    accionMock.mockImplementation(
      () =>
        new Promise<SetCredentialFormState>((resolve) => {
          responder = resolve;
        }),
    );
    const user = setupUser();
    await pintarPagina();

    const boton = screen.getByTestId('set-credential-submit');
    expect(boton).toHaveTextContent('Guardar contraseña');
    expect(boton.className).toContain('w-full');

    await user.click(boton);
    await waitFor(() => expect(boton).toHaveAttribute('aria-busy', 'true'));
    expect(boton).toHaveTextContent('Guardando…');
    expect(boton).toBeDisabled();
    const indicador = boton.querySelector('svg');
    expect(indicador).not.toBeNull();
    expect(indicador).toHaveAttribute('aria-hidden', 'true');

    // React enreda las transiciones asíncronas en curso: una action sin resolver bloquearía la
    // del caso siguiente.
    responder({ status: 'idle' });
    await waitFor(() => expect(boton).toHaveAttribute('aria-busy', 'false'));
  });
});

describe('R22 — éxito en la misma tarjeta', () => {
  it('R22 — icono oculto, h1, texto y enlace «Ir a iniciar sesión» con flecha a todo el ancho', async () => {
    await enviarCon({ status: 'success' });

    const card = document.querySelector('[data-access="card"]') as HTMLElement;
    expect(screen.queryByTestId('set-credential-form')).toBeNull();
    expect(screen.getByTestId('set-credential-success')).toBeInTheDocument();

    const icono = within(card).getByTestId('set-credential-success-icon');
    expect(icono).toHaveAttribute('aria-hidden', 'true');
    expect(icono.querySelector('svg')).not.toBeNull();

    const titulos = within(card).getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent('Contraseña establecida');
    expect(screen.getByRole('region', { name: 'Contraseña establecida' })).toBe(card);
    expect(within(card).getByText('Ya puedes entrar con ella.')).toBeInTheDocument();

    const enlace = within(card).getByRole('link', { name: 'Ir a iniciar sesión' });
    expect(enlace).toHaveAttribute('href', LOGIN_ROUTE);
    expect(enlace).toHaveAttribute('data-testid', 'set-credential-login-link');
    expect(enlace).toHaveAttribute('data-direction', 'forward');
    expect(enlace.querySelector('svg')).not.toBeNull();
    expect(enlace.className).toContain('w-full');
    expect(within(card).queryByRole('button')).toBeNull();

    // Hijos directos de la tarjeta: entran escalonados al montarse el éxito.
    expect(icono.parentElement).toBe(card);
    expect(enlace.parentElement).toBe(card);
    expect(accionMock).toHaveBeenCalledTimes(1);
  });
});
