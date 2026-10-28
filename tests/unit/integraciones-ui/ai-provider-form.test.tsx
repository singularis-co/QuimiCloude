// El formulario del proveedor IA: elegir proveedor, escribir la key, probarla y guardarla. Solo las
// Server Actions y `toast` son el doble.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_PROVIDER_BRANDS,
  AI_PROVIDER_FORM_HELP_TESTID,
  AI_PROVIDER_FORM_RESULT_TESTID,
  AI_PROVIDER_FORM_SAVE_TESTID,
  AI_PROVIDER_FORM_TEST_TESTID,
  AI_PROVIDER_FORM_TESTID,
  AI_PROVIDER_KEY_FIELD_TESTID,
  AI_PROVIDER_OPTION_TESTID_PREFIX,
  AI_PROVIDER_PICKER_TESTID,
  AiProviderForm,
} from '@/app/(private)/integraciones/proveedor-ia/components';
import { errorMessage } from '@/lib/modules/errores';
import type { AiProviderCode, AiProviderEntry } from '@/lib/modules/integraciones';
import type {
  SaveAiProviderConnectionFormState,
  TestAiProviderKeyFormState,
} from '@/lib/modules/integraciones/adapters/driving/ai-provider-actions';

import { setupUser } from '../../helpers/user-event';

const { testKeyMock, saveMock, toastSuccessMock } = vi.hoisted(() => ({
  testKeyMock: vi.fn<
    (prev: TestAiProviderKeyFormState, data: FormData) => Promise<TestAiProviderKeyFormState>
  >(),
  saveMock: vi.fn<
    (
      prev: SaveAiProviderConnectionFormState,
      data: FormData,
    ) => Promise<SaveAiProviderConnectionFormState>
  >(),
  toastSuccessMock: vi.fn(),
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/ai-provider-actions', () => {
  const prohibida = (nombre: string) => () => {
    throw new Error(`${nombre} no se invoca desde el formulario`);
  };
  return {
    getAiProviderConnectionAction: vi.fn(prohibida('getAiProviderConnectionAction')),
    testAiProviderKeyAction: testKeyMock,
    testSavedAiProviderAction: vi.fn(prohibida('testSavedAiProviderAction')),
    saveAiProviderConnectionAction: saveMock,
    disconnectAiProviderAction: vi.fn(prohibida('disconnectAiProviderAction')),
    selectAiModelAction: vi.fn(prohibida('selectAiModelAction')),
    getAiProviderReadinessAction: vi.fn(prohibida('getAiProviderReadinessAction')),
  };
});

vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: { success: toastSuccessMock, dismiss: vi.fn() },
}));

function proveedor(code: AiProviderCode, name: string, recomendado: string, otro: string): AiProviderEntry {
  return {
    code,
    name,
    models: [
      { modelId: otro, isDefault: false },
      { modelId: recomendado, isDefault: true },
    ],
    defaultModel: recomendado,
  };
}

const PROVEEDORES: AiProviderEntry[] = [
  proveedor('ANTHROPIC', 'Claude', 'claude-haiku-5-5', 'claude-sonnet-5-5'),
  proveedor('GOOGLE', 'Gemini', 'gemini-3.8-flash', 'gemini-4-argon'),
  proveedor('OPENAI', 'OpenAI', 'gpt-6-luna', 'gpt-6-sol'),
  proveedor('OPENROUTER', 'OpenRouter', 'anthropic/claude-haiku-5.5', 'openai/gpt-6-luna'),
];

const KEY = 'sk-ant-centinela-que-nunca-vuelve-a-la-pantalla-0001';
const RECHAZADA = 'Error con tu proveedor: la key fue rechazada. Revísala y vuelve a probar.';

function campo(): HTMLInputElement {
  return screen.getByTestId(AI_PROVIDER_KEY_FIELD_TESTID) as HTMLInputElement;
}

function opcion(code: AiProviderCode): HTMLElement {
  return screen.getByTestId(`${AI_PROVIDER_OPTION_TESTID_PREFIX}${code}`);
}

function botonProbar(): HTMLElement {
  return screen.getByTestId(AI_PROVIDER_FORM_TEST_TESTID);
}

function botonGuardar(): HTMLElement {
  return screen.getByTestId(AI_PROVIDER_FORM_SAVE_TESTID);
}

function resultado(): HTMLElement {
  return screen.getByTestId(AI_PROVIDER_FORM_RESULT_TESTID);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('AiProviderForm', () => {
  it('R30: pinta la tarjeta «Conecta tu proveedor» con «Sin configurar» y los cuatro proveedores como radios excluyentes', () => {
    render(<AiProviderForm providers={PROVEEDORES} />);

    const formulario = screen.getByTestId(AI_PROVIDER_FORM_TESTID);
    expect(within(formulario).getByRole('heading', { level: 2 }).textContent).toBe('Conecta tu proveedor');
    expect(within(formulario).getByText('Sin proveedor configurado no se pueden leer PDF.')).toBeTruthy();
    expect(within(formulario).getByText('Sin configurar')).toBeTruthy();

    const grupo = screen.getByRole('radiogroup', { name: 'Proveedor' });
    expect(grupo).toBe(screen.getByTestId(AI_PROVIDER_PICKER_TESTID));
    const radios = within(grupo).getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(radios.filter((radio) => radio.getAttribute('aria-checked') === 'true')).toEqual([
      opcion('ANTHROPIC'),
    ]);
  });

  it.each([
    ['ANTHROPIC', 'Claude', 'Anthropic', 'C'],
    ['GOOGLE', 'Gemini', 'Google', 'G'],
    ['OPENAI', 'OpenAI', 'GPT', 'O'],
    ['OPENROUTER', 'OpenRouter', 'Muchos modelos con una key', 'R'],
  ] as const)('R30: %s se ofrece con su logo, su nombre como nombre accesible y su subtitulo', (code, nombre, subtitulo, monograma) => {
    render(<AiProviderForm providers={PROVEEDORES} />);

    const radio = screen.getByRole('radio', { name: nombre });
    expect(radio).toBe(opcion(code));
    expect(radio).toHaveAccessibleDescription(subtitulo);
    const logo = within(radio).getByRole('img', { name: nombre });
    expect(logo.textContent).toBe(monograma);
    expect(AI_PROVIDER_BRANDS[code].subtitle).toBe(subtitulo);
  });

  it('R30: el campo «API key de <proveedor>» nace oculto y vacio, con ojo para mostrarlo', async () => {
    const user = setupUser();
    render(<AiProviderForm providers={PROVEEDORES} />);

    expect(screen.getByLabelText('API key de Claude')).toBe(campo());
    expect(campo().type).toBe('password');
    expect(campo().value).toBe('');
    expect(campo().getAttribute('autocomplete')).toBe('off');
    expect(campo()).toHaveAttribute('placeholder', 'Pega aquí tu API key');

    const ojo = screen.getByRole('button', { name: 'Mostrar la key' });
    await user.click(ojo);
    expect(campo().type).toBe('text');
    expect(screen.getByRole('button', { name: 'Ocultar la key' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('R30, QT-291 R30: la ayuda enlaza la consola del elegido y dice «Después de conectar podrás elegir el modelo.» sin nombrar modelos, y cambia al elegir otro', async () => {
    const user = setupUser();
    render(<AiProviderForm providers={PROVEEDORES} />);

    const ayuda = screen.getByTestId(AI_PROVIDER_FORM_HELP_TESTID);
    expect(campo()).toHaveAccessibleDescription(ayuda.textContent ?? '');
    expect(ayuda.textContent).toBe(
      'Créala en la consola de Claude: console.anthropic.com/settings/keys. Después de conectar podrás elegir el modelo.',
    );
    for (const entry of PROVEEDORES) {
      for (const model of entry.models) expect(ayuda.textContent).not.toContain(model.modelId);
    }
    expect(ayuda.querySelector('.font-mono')).toBeNull();
    const enlace = within(ayuda).getByRole('link');
    expect(enlace).toHaveAttribute('href', 'https://console.anthropic.com/settings/keys');
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer');

    await user.click(opcion('OPENAI'));

    expect(opcion('OPENAI')).toHaveAttribute('aria-checked', 'true');
    expect(opcion('ANTHROPIC')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByLabelText('API key de OpenAI')).toBe(campo());
    expect(screen.getByTestId(AI_PROVIDER_FORM_HELP_TESTID).textContent).toBe(
      'Créala en la consola de OpenAI: platform.openai.com/api-keys. Después de conectar podrás elegir el modelo.',
    );
  });

  it('QT-291 R30: con la empresa ya conectada, la ayuda solo enlaza la consola, sin «Después de conectar podrás elegir el modelo.»', async () => {
    const user = setupUser();
    render(<AiProviderForm providers={PROVEEDORES} initialProvider="GOOGLE" connected />);

    const ayuda = screen.getByTestId(AI_PROVIDER_FORM_HELP_TESTID);
    expect(campo()).toHaveAccessibleDescription(ayuda.textContent ?? '');
    expect(ayuda.textContent).not.toContain('Después de conectar podrás elegir el modelo.');
    expect(within(ayuda).getByRole('link')).toBeTruthy();

    await user.click(opcion('OPENAI'));

    expect(screen.getByTestId(AI_PROVIDER_FORM_HELP_TESTID).textContent).toBe(
      'Créala en la consola de OpenAI: platform.openai.com/api-keys.',
    );
  });

  it('R30: las flechas mueven la eleccion entre proveedores', async () => {
    const user = setupUser();
    render(<AiProviderForm providers={PROVEEDORES} />);

    opcion('ANTHROPIC').focus();
    await user.keyboard('{ArrowRight}');

    await waitFor(() => expect(opcion('GOOGLE')).toHaveAttribute('aria-checked', 'true'));
    expect(opcion('GOOGLE')).toHaveFocus();
    expect(opcion('ANTHROPIC')).toHaveAttribute('aria-checked', 'false');
  });

  it('R30: «Probar conexión» y «Guardar y conectar» estan deshabilitados con la key vacia o en blanco y se habilitan al escribirla', async () => {
    const user = setupUser();
    render(<AiProviderForm providers={PROVEEDORES} />);

    expect(botonProbar()).toBeDisabled();
    expect(botonGuardar()).toBeDisabled();
    expect(botonProbar().textContent).toBe('Probar conexión');
    expect(botonGuardar().textContent).toBe('Guardar y conectar');

    await user.type(campo(), '   ');
    expect(botonProbar()).toBeDisabled();
    expect(botonGuardar()).toBeDisabled();

    await user.type(campo(), KEY);
    expect(botonProbar()).toBeEnabled();
    expect(botonGuardar()).toBeEnabled();

    await user.clear(campo());
    expect(botonProbar()).toBeDisabled();
    expect(screen.getByText(/«Guardar y conectar» hace la misma prueba pequeña antes de guardar: con la key rechazada no se guarda nada\./)).toBeTruthy();
  });

  it('R34, QT-291 R20: la prueba buena de la key escrita muestra «Conexión correcta · el modelo en uso responde», sin tiempo, en la region viva, y envia proveedor y key', async () => {
    testKeyMock.mockResolvedValue({ status: 'tested', ok: true, elapsedMs: 812 });
    const user = setupUser();
    render(<AiProviderForm providers={PROVEEDORES} />);

    await user.click(opcion('GOOGLE'));
    await user.type(campo(), KEY);
    await user.click(botonProbar());

    await waitFor(() => expect(resultado().textContent).toBe('Conexión correcta · el modelo en uso responde'));
    expect(resultado()).toHaveAttribute('aria-live', 'polite');
    expect(testKeyMock).toHaveBeenCalledTimes(1);
    expect(saveMock).not.toHaveBeenCalled();
    const datos = testKeyMock.mock.calls[0]?.[1];
    expect(Object.fromEntries(datos?.entries() ?? [])).toEqual({ provider: 'GOOGLE', apiKey: KEY });
  });

  it('R34: la prueba fallida muestra el mensaje del proveedor bajo el campo', async () => {
    testKeyMock.mockResolvedValue({ status: 'tested', ok: false, message: RECHAZADA });
    const user = setupUser();
    render(<AiProviderForm providers={PROVEEDORES} />);

    await user.type(campo(), KEY);
    await user.click(botonProbar());

    await waitFor(() => expect(resultado().textContent).toBe(RECHAZADA));
  });

  it('R34: guardar con la prueba fallida no avisa de conexion y muestra el mensaje del proveedor', async () => {
    saveMock.mockResolvedValue({ status: 'test_failed', message: RECHAZADA });
    const onSaved = vi.fn();
    const user = setupUser();
    render(<AiProviderForm providers={PROVEEDORES} onSaved={onSaved} />);

    await user.type(campo(), KEY);
    await user.click(botonGuardar());

    await waitFor(() => expect(resultado().textContent).toBe(RECHAZADA));
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(testKeyMock).not.toHaveBeenCalled();
  });

  it('R34: guardar bien avisa «Proveedor IA conectado» y llama a onSaved', async () => {
    saveMock.mockResolvedValue({ status: 'saved' });
    const onSaved = vi.fn();
    const user = setupUser();
    render(<AiProviderForm providers={PROVEEDORES} onSaved={onSaved} />);

    await user.type(campo(), KEY);
    await user.click(botonGuardar());

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Proveedor IA conectado'));
    expect(onSaved).toHaveBeenCalledTimes(1);
    const datos = saveMock.mock.calls[0]?.[1];
    expect(Object.fromEntries(datos?.entries() ?? [])).toEqual({ provider: 'ANTHROPIC', apiKey: KEY });
  });

  it('R34: un error del catalogo se muestra con su texto', async () => {
    saveMock.mockResolvedValue({
      status: 'error',
      code: 'invalid_input',
      message: errorMessage('invalid_input'),
    });
    const user = setupUser();
    render(<AiProviderForm providers={PROVEEDORES} />);

    await user.type(campo(), KEY);
    await user.click(botonGuardar());

    await waitFor(() =>
      expect(within(resultado()).getByRole('alert').textContent).toContain(errorMessage('invalid_input')),
    );
  });

  it.each([
    ['probar bien', { status: 'tested', ok: true, elapsedMs: 500 }],
    ['probar mal', { status: 'tested', ok: false, message: RECHAZADA }],
  ] as const)('R8: tras %s la key escrita se queda en el campo y los botones siguen habilitados', async (_caso, respuesta) => {
    testKeyMock.mockResolvedValue(respuesta as TestAiProviderKeyFormState);
    const user = setupUser();
    render(<AiProviderForm providers={PROVEEDORES} />);

    await user.type(campo(), KEY);
    await user.click(botonProbar());

    await waitFor(() => expect(resultado().textContent).not.toBe(''));
    expect(campo().value).toBe(KEY);
    expect(botonProbar()).toBeEnabled();
    expect(botonGuardar()).toBeEnabled();
  });

  it.each([
    ['guardar mal', { status: 'test_failed', message: RECHAZADA }],
    ['guardar con error', { status: 'error', code: 'invalid_input', message: errorMessage('invalid_input') }],
  ] as const)('R8: tras %s el campo de la key vuelve vacio, los botones se deshabilitan y la key no esta en el HTML', async (_caso, respuesta) => {
    saveMock.mockResolvedValue(respuesta as SaveAiProviderConnectionFormState);
    const user = setupUser();
    const { container } = render(<AiProviderForm providers={PROVEEDORES} />);

    await user.type(campo(), KEY);
    await user.click(botonGuardar());

    await waitFor(() => expect(resultado().textContent).not.toBe(''));
    expect(campo().value).toBe('');
    expect(botonProbar()).toBeDisabled();
    expect(botonGuardar()).toBeDisabled();
    expect(container.innerHTML).not.toContain(KEY);
  });

  it('R32: con el proveedor actual, lo deja elegido y la key vacia', () => {
    render(<AiProviderForm providers={PROVEEDORES} initialProvider="OPENROUTER" />);

    expect(opcion('OPENROUTER')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('API key de OpenRouter')).toBe(campo());
    expect(campo().value).toBe('');
    expect(botonGuardar()).toBeDisabled();
  });

  it('R36: campo de 16 px y 44 px, ojo de 44 x 44, botones de 44 px y opciones de 64 px', () => {
    render(<AiProviderForm providers={PROVEEDORES} />);

    expect(campo().className).toMatch(/(^|\s)text-base(\s|$)/);
    expect(campo().className).toMatch(/(^|\s)md:text-base(\s|$)/);
    expect(campo().className).toMatch(/(^|\s)h-11(\s|$)/);
    expect(screen.getByTestId(`${AI_PROVIDER_KEY_FIELD_TESTID}-toggle`).className).toMatch(/(^|\s)size-11(\s|$)/);
    for (const boton of [botonProbar(), botonGuardar()]) {
      expect(boton.className).toMatch(/(^|\s)min-h-11(\s|$)/);
    }
    for (const code of ['ANTHROPIC', 'GOOGLE', 'OPENAI', 'OPENROUTER'] as const) {
      expect(opcion(code).className).toMatch(/(^|\s)min-h-16(\s|$)/);
      expect(opcion(code).className).not.toMatch(/(^|\s)hover:/);
    }
  });

  it('R36: dos columnas de proveedores y acciones en fila que pasan a una columna y apiladas con 760 px de contenedor o menos', () => {
    render(<AiProviderForm providers={PROVEEDORES} />);

    const grupo = screen.getByTestId(AI_PROVIDER_PICKER_TESTID);
    expect(grupo.className).toMatch(/(^|\s)grid-cols-2(\s|$)/);
    expect(grupo.className).toMatch(/(^|\s)@max-\[760px\]:grid-cols-1(\s|$)/);
    const acciones = botonGuardar().parentElement as HTMLElement;
    expect(acciones.className).toMatch(/(^|\s)@max-\[760px\]:flex-col(\s|$)/);
    expect(acciones.className).toMatch(/(^|\s)@max-\[760px\]:items-stretch(\s|$)/);
  });
});
