// Rediseño de «Establecer contraseña». Un `describe` por requisito o grupo de requisitos.
//
// El caso de R20 no monta todavía el formulario de la ruta: reproduce su cableado mínimo
// (`useActionState` + `<form action>` + `PasswordField` con lista) con una action que rechaza,
// para medir qué ocurre cuando React reinicia el `<form>` al terminar la action.

import { useActionState } from 'react';

import { render, screen, waitFor } from '@testing-library/react';

import { CredentialRequirements } from '@/components/shared/credential-requirements';
import { PasswordField } from '@/components/shared/password-field';

import { setupUser } from '../../helpers/user-event';

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
});
