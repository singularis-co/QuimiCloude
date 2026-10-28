// El selector del modelo del proveedor IA: opciones del catálogo, «Recomendado», modelo no
// disponible, ocupado mientras se consulta y hoja inferior en teléfono.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_MODEL_SELECT_ERROR_TESTID,
  AI_MODEL_SELECT_HELP_TESTID,
  AI_MODEL_SELECT_OPTION_TESTID,
  AI_MODEL_SELECT_TRIGGER_TESTID,
  AiModelSelect,
  type AiModelSelectProps,
} from '@/app/(private)/integraciones/proveedor-ia/components';
import { errorMessage } from '@/lib/modules/errores';
import type { AiModelOption } from '@/lib/modules/integraciones';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';
import { resetViewport, setViewportWidth } from '../../helpers/viewport';

const ESCRITORIO = 1280;
const TELEFONO = 390;

const GEMINI: AiModelOption[] = [
  { modelId: 'gemini-4-argon', isDefault: false },
  { modelId: 'gemini-3.8-flash', isDefault: true },
  { modelId: 'gemini-3.7-flash', isDefault: false },
  { modelId: 'gemini-3.5-flash-lite', isDefault: false },
  { modelId: 'gemini-3.1-flash-lite', isDefault: false },
];

function montar(overrides: Partial<AiModelSelectProps> = {}) {
  const onChange = vi.fn<(modelId: string) => void>();
  const utils = render(
    <AiModelSelect
      providerName="Gemini"
      options={GEMINI}
      value="gemini-3.8-flash"
      isDefault
      unavailable={false}
      pending={false}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { ...utils, onChange };
}

function disparador(): HTMLElement {
  return screen.getByTestId(AI_MODEL_SELECT_TRIGGER_TESTID);
}

function ayuda(): HTMLElement {
  return screen.getByTestId(AI_MODEL_SELECT_HELP_TESTID);
}

async function abrirLista() {
  const user = setupUser();
  await user.click(disparador());
  const lista = await screen.findByRole('listbox');
  return { user, lista };
}

beforeEach(() => {
  setViewportWidth(ESCRITORIO);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('AiModelSelect', () => {
  it('QT-291 R26: un solo selector «Modelo de <proveedor>» con las opciones del catálogo en su orden, «recomendado» en el predeterminado y la marca en el valor', async () => {
    montar();

    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.getByRole('combobox', { name: 'Modelo de Gemini' })).toBe(disparador());

    const { lista } = await abrirLista();
    const opciones = within(lista).getAllByTestId(AI_MODEL_SELECT_OPTION_TESTID);
    expect(opciones.map((opcion) => opcion.getAttribute('data-value'))).toEqual(GEMINI.map((m) => m.modelId));
    const recomendadas = opciones.filter((opcion) => within(opcion).queryByText('recomendado') !== null);
    expect(recomendadas.map((opcion) => opcion.getAttribute('data-value'))).toEqual(['gemini-3.8-flash']);
    const elegida = within(lista).getByRole('option', { selected: true });
    expect(elegida.getAttribute('data-value')).toBe('gemini-3.8-flash');
    expect(document.body.textContent).not.toMatch(/predeterminado/i);
  });

  it('QT-291 R27: sin elección muestra el recomendado con «Recomendado» y «Se usa el modelo recomendado de <proveedor>.»', () => {
    montar();

    expect(within(disparador()).getByText('gemini-3.8-flash')).toBeTruthy();
    expect(within(disparador()).getByText('Recomendado')).toBeTruthy();
    expect(ayuda().textContent).toBe('Se usa el modelo recomendado de Gemini.');
    expect(disparador().getAttribute('aria-describedby')).toContain(ayuda().id);
    expect(disparador()).not.toHaveAttribute('aria-invalid');
    expect(document.body.textContent).not.toMatch(/predeterminado/i);
  });

  it('QT-291 R27: con elección muestra el modelo sin insignia y «Elegido por tu empresa.»', () => {
    montar({ value: 'gemini-4-argon', isDefault: false });

    expect(within(disparador()).getByText('gemini-4-argon')).toBeTruthy();
    expect(within(disparador()).queryByText('Recomendado')).toBeNull();
    expect(ayuda().textContent).toBe('Elegido por tu empresa.');
  });

  it('QT-291 R28: el modelo no disponible se muestra tachado, con «No disponible», inválido, con su ayuda y fuera de las opciones', async () => {
    const sinMarcado = GEMINI.filter((m) => m.modelId !== 'gemini-3.7-flash');
    montar({ options: sinMarcado, value: 'gemini-3.7-flash', isDefault: false, unavailable: true });

    const modelo = within(disparador()).getByText('gemini-3.7-flash');
    expect(modelo).toHaveClass('line-through');
    const insignia = within(disparador()).getByText('No disponible').closest('[data-tone]');
    expect(insignia).toHaveAttribute('data-tone', 'danger');
    expect(disparador()).toHaveAttribute('aria-invalid', 'true');
    expect(ayuda().textContent).toBe('Este modelo ya no está disponible. Elige otro para volver a leer PDF.');
    expect(ayuda()).toHaveClass('text-destructive');

    const { lista } = await abrirLista();
    const valores = within(lista)
      .getAllByTestId(AI_MODEL_SELECT_OPTION_TESTID)
      .map((opcion) => opcion.getAttribute('data-value'));
    expect(valores).not.toContain('gemini-3.7-flash');
    expect(within(lista).queryByRole('option', { selected: true })).toBeNull();
  });

  it('QT-291 R29: elegir otra opción notifica su id, sin otro botón', async () => {
    const { onChange } = montar();

    const { user, lista } = await abrirLista();
    const opcion = within(lista)
      .getAllByTestId(AI_MODEL_SELECT_OPTION_TESTID)
      .find((o) => o.getAttribute('data-value') === 'gemini-4-argon') as HTMLElement;
    await user.click(await esperarInteractiva(opcion));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('gemini-4-argon');
  });

  it('QT-291 R29: ocupado, el disparador está deshabilitado, con aria-busy y spinner, y no abre la lista', async () => {
    const { onChange } = montar({ pending: true });

    expect(disparador()).toHaveAttribute('aria-busy', 'true');
    expect(disparador().querySelector('svg.animate-\\[spin_0\\.9s_linear_infinite\\]')).not.toBeNull();
    const user = setupUser();
    await user.click(disparador());
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('QT-291 R29: el error de la elección se pinta bajo el selector y se enlaza al disparador', () => {
    montar({
      error: {
        status: 'error',
        code: 'ai_provider_error',
        message: 'Error con tu proveedor: el modelo gemini-4-argon ya no está disponible.',
      },
    });

    const error = screen.getByTestId(AI_MODEL_SELECT_ERROR_TESTID);
    expect(error.textContent).toBe('Error con tu proveedor: el modelo gemini-4-argon ya no está disponible.');
    expect(error).toHaveAttribute('role', 'alert');
    expect(disparador().getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
  });

  it('QT-291 R29: un error del catálogo se pinta con su texto', () => {
    montar({
      error: {
        status: 'error',
        code: 'integration_secret_unreadable',
        message: errorMessage('integration_secret_unreadable'),
      },
    });

    expect(screen.getByTestId(AI_MODEL_SELECT_ERROR_TESTID).textContent).toContain(
      errorMessage('integration_secret_unreadable'),
    );
  });

  it('QT-291 R31: en escritorio, disparador de 44 px con letra de 16 px, opciones de 44 px y lista debajo con flecha que gira', async () => {
    montar();

    expect(disparador()).toHaveClass('min-h-11', 'text-base', 'w-full');
    expect(disparador().className).toContain('data-popup-open:[&>svg:last-child]:rotate-180');
    const { lista } = await abrirLista();
    for (const opcion of within(lista).getAllByTestId(AI_MODEL_SELECT_OPTION_TESTID)) {
      expect(opcion).toHaveClass('min-h-11', 'text-base');
    }
    expect(lista.closest('[data-align-trigger]')).toHaveAttribute('data-align-trigger', 'false');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('QT-291 R31: a 390 px el disparador ocupa el ancho con 48 px y la lista se abre en una hoja inferior con título; elegir notifica y cierra', async () => {
    setViewportWidth(TELEFONO);
    const { onChange } = montar();

    await waitFor(() => expect(disparador()).toHaveAttribute('aria-haspopup', 'dialog'));
    expect(screen.getByRole('combobox', { name: 'Modelo de Gemini' })).toBe(disparador());
    expect(disparador()).toHaveClass('h-12', 'w-full', 'text-base', 'min-h-11');

    const user = setupUser();
    await user.click(disparador());
    const hoja = await screen.findByRole('dialog', { name: 'Modelo de Gemini' });
    expect(hoja).toHaveAttribute('data-side', 'bottom');
    const opciones = within(hoja).getAllByRole('option');
    expect(opciones.map((o) => o.getAttribute('data-value'))).toEqual(GEMINI.map((m) => m.modelId));
    for (const opcion of opciones) expect(opcion).toHaveClass('min-h-12', 'text-base');
    expect(within(hoja).getByRole('option', { selected: true }).getAttribute('data-value')).toBe('gemini-3.8-flash');
    expect(within(hoja).getByText('recomendado')).toBeTruthy();

    await user.click(opciones[0] as HTMLElement);

    expect(onChange).toHaveBeenCalledWith('gemini-4-argon');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('QT-291 R31: a 390 px, ocupado no abre la hoja', async () => {
    setViewportWidth(TELEFONO);
    montar({ pending: true });

    await waitFor(() => expect(disparador()).toHaveAttribute('aria-haspopup', 'dialog'));
    expect(disparador()).toBeDisabled();
    expect(disparador()).toHaveAttribute('aria-busy', 'true');
    const user = setupUser();
    await user.click(disparador());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
