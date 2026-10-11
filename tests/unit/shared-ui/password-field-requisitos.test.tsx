// `PasswordField` con la lista de requisitos, ejercitado a través de un formulario de prueba
// mínimo: monta el campo, guarda lo que llega por `onOwnRulesMetChange` y lo aplica al
// `disabled` de un `<button type="submit">`, que es el cableado que hará cualquier consumidor.
// Interacciones con `@testing-library/user-event`, nunca `fireEvent`.

import { useState } from 'react';

import { render, screen } from '@testing-library/react';

import type { CredentialRuleState } from '@/components/shared/credential-requirements';
import { PASSWORD_FIELD_SHOW_LABEL, PasswordField } from '@/components/shared/password-field';

import { setupUser } from '../../helpers/user-event';

/** Candidata que cumple las seis reglas comprobables en vivo (no la séptima, que es del servidor). */
const CANDIDATA_QUE_CUMPLE_LAS_SEIS = 'Abcdefg1#';

type TestFormProps = {
  readonly breachedState?: CredentialRuleState;
  readonly onOwnRulesMetChange?: (met: boolean) => void;
};

function TestForm({ breachedState, onOwnRulesMetChange }: TestFormProps) {
  const [ownRulesMet, setOwnRulesMet] = useState(false);

  return (
    <form aria-label="formulario de prueba">
      <PasswordField
        name="credential"
        label="Contrasena nueva"
        autoComplete="new-password"
        requirements={{
          breachedState,
          onOwnRulesMetChange: (met) => {
            setOwnRulesMet(met);
            onOwnRulesMetChange?.(met);
          },
        }}
      />
      <button type="submit" disabled={!ownRulesMet}>
        Enviar
      </button>
    </form>
  );
}

describe('PasswordField con requisitos — el bloqueo del envío es parcial', () => {
  it('R25 — mientras falte alguna de las seis el control de envío está deshabilitado', async () => {
    const user = setupUser();
    render(<TestForm />);

    const input = screen.getByLabelText('Contrasena nueva');
    const boton = screen.getByRole('button', { name: 'Enviar' });

    expect(boton).toBeDisabled();
    await user.type(input, 'incompleta');
    expect(boton).toBeDisabled();
  });

  it('R25 — con las seis en verde el envío se habilita aunque la séptima siga neutra', async () => {
    const user = setupUser();
    render(<TestForm />);

    const input = screen.getByLabelText('Contrasena nueva');
    const boton = screen.getByRole('button', { name: 'Enviar' });

    await user.type(input, CANDIDATA_QUE_CUMPLE_LAS_SEIS);

    expect(boton).toBeEnabled();
    const septima = document.querySelector('li[data-rule="breached"]');
    expect(septima?.getAttribute('data-state')).toBe('unknown');
  });

  it('R25 — tras el rechazo por filtrada las seis siguen en verde y el envío sigue habilitado', async () => {
    const user = setupUser();
    const { rerender } = render(<TestForm />);

    const input = screen.getByLabelText('Contrasena nueva');
    await user.type(input, CANDIDATA_QUE_CUMPLE_LAS_SEIS);

    // El servidor rechaza la candidata y el consumidor re-renderiza con el veredicto.
    rerender(<TestForm breachedState="unmet" />);

    const boton = screen.getByRole('button', { name: 'Enviar' });
    expect(boton).toBeEnabled();

    const septima = document.querySelector('li[data-rule="breached"]');
    expect(septima?.getAttribute('data-state')).toBe('unmet');

    const reglasLive = ['min_length', 'max_length', 'no_uppercase', 'no_lowercase', 'no_digit', 'no_symbol'];
    for (const rule of reglasLive) {
      const item = document.querySelector(`li[data-rule="${rule}"]`);
      expect(item?.getAttribute('data-state'), `regla ${rule}`).toBe('met');
    }
  });
});

describe('PasswordField con requisitos — lista enlazada al campo', () => {
  it('R25 — pinta los siete requisitos debajo, enlazados por aria-describedby', () => {
    render(<TestForm />);

    const input = screen.getByLabelText('Contrasena nueva');
    const lista = document.querySelector('ul');
    expect(lista).not.toBeNull();
    expect(lista?.querySelectorAll('li')).toHaveLength(7);
    expect((input.getAttribute('aria-describedby') ?? '').split(' ')).toContain(lista?.id);
  });
});

describe('PasswordField con requisitos — aviso al formulario consumidor', () => {
  it('R25 — avisa al montar y solo cuando cambia si las seis se cumplen', async () => {
    const user = setupUser();
    const onOwnRulesMetChange = vi.fn();

    render(<TestForm onOwnRulesMetChange={onOwnRulesMetChange} />);

    expect(onOwnRulesMetChange).toHaveBeenCalledTimes(1);
    expect(onOwnRulesMetChange).toHaveBeenNthCalledWith(1, false);

    const input = screen.getByLabelText('Contrasena nueva');

    await user.type(input, 'Abc');
    expect(onOwnRulesMetChange).toHaveBeenCalledTimes(1);

    await user.type(input, 'defg1#');
    expect(onOwnRulesMetChange).toHaveBeenCalledTimes(2);
    expect(onOwnRulesMetChange).toHaveBeenNthCalledWith(2, true);

    await user.type(input, 'X');
    expect(onOwnRulesMetChange).toHaveBeenCalledTimes(2);
  });
});

describe('PasswordField con requisitos — sin red mientras se escribe', () => {
  it('R25 — escribir no dispara ninguna petición de red', async () => {
    // `globalThis.fetch` puede no existir según la versión de Node/jsdom.
    if (typeof globalThis.fetch !== 'function') {
      globalThis.fetch = vi.fn() as unknown as typeof fetch;
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('no debería llamarse a fetch');
    });

    const user = setupUser();
    render(<TestForm />);

    await user.type(screen.getByLabelText('Contrasena nueva'), CANDIDATA_QUE_CUMPLE_LAS_SEIS);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('PasswordField con requisitos — el campo nace oculto', () => {
  it('R25 — el campo oculta la candidata hasta que se pulsa el ojo', async () => {
    const user = setupUser();
    render(<TestForm />);

    const input = screen.getByLabelText('Contrasena nueva');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: PASSWORD_FIELD_SHOW_LABEL }));
    expect(input).toHaveAttribute('type', 'text');
  });
});

describe('PasswordField con requisitos — el veredicto del servidor solo entra por props', () => {
  it('R25 — el veredicto del servidor solo entra por props', async () => {
    const conVeredicto = render(<TestForm breachedState="unmet" />);
    const septima = conVeredicto.container.querySelector('li[data-rule="breached"]');
    expect(septima?.getAttribute('data-state')).toBe('unmet');
    conVeredicto.unmount();

    const user = setupUser();
    const sinVeredicto = render(<TestForm />);
    const input = sinVeredicto.getByLabelText('Contrasena nueva');
    await user.type(input, CANDIDATA_QUE_CUMPLE_LAS_SEIS);
    const septimaSinVeredicto = sinVeredicto.container.querySelector('li[data-rule="breached"]');
    expect(septimaSinVeredicto?.getAttribute('data-state')).not.toBe('unmet');
  });
});

describe('PasswordField con requisitos — el flujo corre en jsdom, sin red ni base', () => {
  it('R25 — el flujo completo se ejercita en un formulario de prueba sin servidor', async () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');

    const user = setupUser();
    render(<TestForm />);

    const boton = screen.getByRole('button', { name: 'Enviar' });
    expect(boton).toBeDisabled();
    await user.type(screen.getByLabelText('Contrasena nueva'), CANDIDATA_QUE_CUMPLE_LAS_SEIS);
    expect(boton).toBeEnabled();
  });
});
