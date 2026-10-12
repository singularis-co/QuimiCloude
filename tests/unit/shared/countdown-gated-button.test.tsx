import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COUNTDOWN_GATED_BUTTON_TESTID,
  CountdownGatedButton,
} from '@/components/shared/countdown-gated-button';

const SECONDS = 5;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function avanzar(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function boton() {
  return screen.getByTestId(COUNTDOWN_GATED_BUTTON_TESTID);
}

describe('CountdownGatedButton', () => {
  it('R19: al montar está deshabilitado y la cuenta empieza en «00:05»', () => {
    render(<CountdownGatedButton seconds={SECONDS} label="Comenzar" />);

    expect(boton()).toBeDisabled();
    expect(boton()).toHaveTextContent('Comenzar');
    expect(screen.getByRole('timer')).toHaveTextContent('00:05');
  });

  it('R19: sigue deshabilitado a los 4 s y se habilita a los 5 s, sin cuenta visible', () => {
    render(<CountdownGatedButton seconds={SECONDS} label="Terminar" />);

    avanzar(4000);
    expect(boton()).toBeDisabled();
    expect(screen.getByRole('timer')).toHaveTextContent('00:01');

    avanzar(1000);
    expect(boton()).toBeEnabled();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('R19: sigue deshabilitado pasada la espera si `disabled`', () => {
    render(<CountdownGatedButton seconds={SECONDS} label="Comenzar" disabled />);

    avanzar(5000);
    expect(boton()).toBeDisabled();
  });

  it('R19: una `key` nueva reinicia la cuenta en «00:05»', () => {
    const { rerender } = render(
      <CountdownGatedButton seconds={SECONDS} key="apertura-1" label="Comenzar" />,
    );
    avanzar(5000);
    expect(boton()).toBeEnabled();

    rerender(
      <CountdownGatedButton seconds={SECONDS} key="apertura-2" label="Comenzar" />,
    );

    expect(boton()).toBeDisabled();
    expect(screen.getByRole('timer')).toHaveTextContent('00:05');
    avanzar(5000);
    expect(boton()).toBeEnabled();
  });

  it('R19: es un botón de envío corriente, sin nada que mande la espera al servidor', () => {
    render(
      <form>
        <CountdownGatedButton seconds={SECONDS} label="Comenzar" />
      </form>,
    );

    expect(boton()).toHaveAttribute('type', 'submit');
    expect(boton()).not.toHaveAttribute('name');
    expect(document.querySelectorAll('input')).toHaveLength(0);
  });
});
