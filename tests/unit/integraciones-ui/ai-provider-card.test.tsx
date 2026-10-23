// La tarjeta de la conexion del proveedor IA: estado, modelo, ultima prueba, aviso de error,
// probar la guardada, cambiar y desconectar. Solo las Server Actions, `toast` y el router son el doble.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_MODEL_SELECT_ERROR_TESTID,
  AI_MODEL_SELECT_HELP_TESTID,
  AI_MODEL_SELECT_OPTION_TESTID,
  AI_MODEL_SELECT_TRIGGER_TESTID,
  AI_PROVIDER_CARD_CHANGE_TESTID,
  AI_PROVIDER_CARD_DISCONNECT_TESTID,
  AI_PROVIDER_CARD_ERROR_TESTID,
  AI_PROVIDER_CARD_KEY_SAVED_TESTID,
  AI_PROVIDER_CARD_LAST_TEST_TESTID,
  AI_PROVIDER_CARD_MODEL_SECTION_TESTID,
  AI_PROVIDER_CARD_RESULT_TESTID,
  AI_PROVIDER_CARD_STATUS_TESTID,
  AI_PROVIDER_CARD_TEST_TESTID,
  AI_PROVIDER_CARD_TESTID,
  AI_PROVIDER_CHANGE_CONFIRM_TESTID,
  AI_PROVIDER_CHANGE_DIALOG_TESTID,
  AI_PROVIDER_CHANGE_DISMISS_TESTID,
  AI_PROVIDER_DISCONNECT_CONFIRM_TESTID,
  AI_PROVIDER_DISCONNECT_DIALOG_TESTID,
  AI_PROVIDER_DISCONNECT_DISMISS_TESTID,
  AI_PROVIDER_FORM_HELP_TESTID,
  AI_PROVIDER_FORM_TESTID,
  AI_PROVIDER_KEY_FIELD_TESTID,
  AI_PROVIDER_LOGO_TESTID,
  AI_PROVIDER_OPTION_TESTID_PREFIX,
  AiProviderCard,
} from '@/app/(private)/integraciones/proveedor-ia/components';
import { errorMessage } from '@/lib/modules/errores';
import type { AiProviderCode, AiProviderConnectionView, AiProviderEntry } from '@/lib/modules/integraciones';
import type {
  DisconnectAiProviderFormState,
  SelectAiModelFormState,
  TestSavedAiProviderFormState,
} from '@/lib/modules/integraciones/adapters/driving/ai-provider-actions';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';
import { resetViewport, setViewportWidth } from '../../helpers/viewport';

const { testSavedMock, disconnectMock, selectMock, toastSuccessMock, refreshMock } = vi.hoisted(() => ({
  testSavedMock: vi.fn<
    (prev: TestSavedAiProviderFormState, data: FormData) => Promise<TestSavedAiProviderFormState>
  >(),
  disconnectMock: vi.fn<
    (prev: DisconnectAiProviderFormState, data: FormData) => Promise<DisconnectAiProviderFormState>
  >(),
  selectMock: vi.fn<(prev: SelectAiModelFormState, data: FormData) => Promise<SelectAiModelFormState>>(),
  toastSuccessMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/ai-provider-actions', () => {
  const prohibida = (nombre: string) => () => {
    throw new Error(`${nombre} no se invoca desde la tarjeta`);
  };
  return {
    getAiProviderConnectionAction: vi.fn(prohibida('getAiProviderConnectionAction')),
    testAiProviderKeyAction: vi.fn(prohibida('testAiProviderKeyAction')),
    testSavedAiProviderAction: testSavedMock,
    saveAiProviderConnectionAction: vi.fn(prohibida('saveAiProviderConnectionAction')),
    disconnectAiProviderAction: disconnectMock,
    selectAiModelAction: selectMock,
    getAiProviderReadinessAction: vi.fn(prohibida('getAiProviderReadinessAction')),
  };
});

vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: { success: toastSuccessMock, dismiss: vi.fn() },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), replace: vi.fn() }),
}));

function modelos(ids: readonly string[], recomendado: string) {
  return ids.map((modelId) => ({ modelId, isDefault: modelId === recomendado }));
}

const GEMINI = modelos(
  ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  'gemini-3.8-flash',
);

const PROVEEDORES: AiProviderEntry[] = [
  {
    code: 'ANTHROPIC',
    name: 'Claude',
    models: modelos(['claude-sonnet-5-5', 'claude-haiku-5-5'], 'claude-haiku-5-5'),
    defaultModel: 'claude-haiku-5-5',
  },
  { code: 'GOOGLE', name: 'Gemini', models: GEMINI, defaultModel: 'gemini-3.8-flash' },
  { code: 'OPENAI', name: 'OpenAI', models: modelos(['gpt-6-luna'], 'gpt-6-luna'), defaultModel: 'gpt-6-luna' },
  {
    code: 'OPENROUTER',
    name: 'OpenRouter',
    models: modelos(['anthropic/claude-haiku-5.5'], 'anthropic/claude-haiku-5.5'),
    defaultModel: 'anthropic/claude-haiku-5.5',
  },
];

const ULTIMO_ERROR = 'La última lectura falló: Gemini rechazó la key (401).';
const RECHAZADA = 'Error con tu proveedor: la key fue rechazada. Revísala y vuelve a probar.';
const DESCRIPCION_DESCONECTAR =
  'La key se borra y no se puede recuperar. Mientras no conectes otro proveedor, nadie de tu empresa podrá leer fórmulas ni catálogos en PDF.';

// A mediodia UTC la fecha es la misma en cualquier huso de -11 a +11.
const GUARDADA = '2026-10-13T12:00:00.000Z';
const PROBADA = '2026-10-13T12:05:00.000Z';
const FALLADA = '2026-10-13T12:20:00.000Z';

function horaLocal(iso: string): string {
  return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(iso),
  );
}

function vista(overrides: Partial<AiProviderConnectionView> = {}): AiProviderConnectionView {
  return {
    provider: 'GOOGLE',
    providerName: 'Gemini',
    modelInUse: 'gemini-3.8-flash',
    modelIsDefault: true,
    modelUnavailable: false,
    modelOptions: GEMINI,
    status: 'ACTIVE',
    lastError: null,
    lastErrorAt: null,
    lastCheckedAt: PROBADA,
    keyUpdatedAt: GUARDADA,
    ...overrides,
  };
}

function enError(overrides: Partial<AiProviderConnectionView> = {}): AiProviderConnectionView {
  return vista({ status: 'ERROR', lastError: ULTIMO_ERROR, lastErrorAt: FALLADA, ...overrides });
}

function conEleccion(overrides: Partial<AiProviderConnectionView> = {}): AiProviderConnectionView {
  return vista({ modelInUse: 'gemini-4-argon', modelIsDefault: false, ...overrides });
}

function montar(connection: AiProviderConnectionView) {
  return render(<AiProviderCard providers={PROVEEDORES} connection={connection} />);
}

function tarjeta(): HTMLElement {
  return screen.getByTestId(AI_PROVIDER_CARD_TESTID);
}

function resultado(): HTMLElement {
  return screen.getByTestId(AI_PROVIDER_CARD_RESULT_TESTID);
}

function disparador(): HTMLElement {
  return screen.getByTestId(AI_MODEL_SELECT_TRIGGER_TESTID);
}

async function elegir(user: ReturnType<typeof setupUser>, modelId: string) {
  await user.click(disparador());
  const lista = await screen.findByRole('listbox');
  const opcion = within(lista)
    .getAllByTestId(AI_MODEL_SELECT_OPTION_TESTID)
    .find((o) => o.getAttribute('data-value') === modelId) as HTMLElement;
  await user.click(await esperarInteractiva(opcion));
}

function diferida<T>() {
  let resolver: (valor: T) => void = () => {};
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promesa, resolver };
}

beforeEach(() => {
  vi.clearAllMocks();
  setViewportWidth(1280);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('AiProviderCard', () => {
  it('R31: pinta el nombre del proveedor, «Key guardada el dd/mm/aaaa · cifrada», la ultima prueba y las acciones del tablero', () => {
    montar(vista());

    expect(within(tarjeta()).getByRole('heading', { level: 2 }).textContent).toBe('Gemini');
    expect(screen.getByTestId(AI_PROVIDER_CARD_KEY_SAVED_TESTID).textContent).toBe(
      'Key guardada el 13/10/2026 · cifrada',
    );
    const terminos = within(tarjeta())
      .getAllByRole('term')
      .map((dt) => dt.textContent);
    expect(terminos).toEqual(['Última prueba']);
    expect(within(tarjeta()).getByRole('button', { name: 'Desconectar' })).toBeTruthy();
    expect(within(tarjeta()).getByRole('button', { name: 'Probar conexión' })).toBeTruthy();
    expect(within(tarjeta()).getByRole('button', { name: 'Cambiar key o proveedor' })).toBeTruthy();
  });

  it.each([
    ['ACTIVE', 'Conectado', 'success'],
    ['ERROR', 'Error', 'danger'],
  ] as const)('R31: el estado %s se pinta «%s»', (status, etiqueta, tono) => {
    montar(status === 'ERROR' ? enError() : vista());

    const insignia = screen.getByTestId(AI_PROVIDER_CARD_STATUS_TESTID);
    expect(insignia.textContent).toBe(etiqueta);
    expect(insignia).toHaveAttribute('data-tone', tono);
    expect(tarjeta()).toHaveAttribute('data-status', status);
  });

  it('R31: con ACTIVE la ultima prueba es «Correcta el <fecha hora>» y no hay aviso de error', () => {
    montar(vista());

    expect(screen.getByTestId(AI_PROVIDER_CARD_LAST_TEST_TESTID).textContent).toBe(
      `Correcta el 13/10/2026 ${horaLocal(PROBADA)}`,
    );
    expect(screen.queryByTestId(AI_PROVIDER_CARD_ERROR_TESTID)).toBeNull();
    expect(screen.queryByText('Error con tu proveedor')).toBeNull();
  });

  it('R31: con ERROR la ultima prueba es «Falló el <fecha hora>» y el aviso «Error con tu proveedor» lleva el lastError', () => {
    montar(enError());

    expect(screen.getByTestId(AI_PROVIDER_CARD_LAST_TEST_TESTID).textContent).toBe(
      `Falló el 13/10/2026 ${horaLocal(FALLADA)}`,
    );
    const aviso = screen.getByTestId(AI_PROVIDER_CARD_ERROR_TESTID);
    expect(aviso).toHaveAttribute('role', 'alert');
    expect(aviso).toHaveAttribute('data-tone', 'danger');
    expect(within(aviso).getByText('Error con tu proveedor')).toBeTruthy();
    expect(within(aviso).getByText(ULTIMO_ERROR)).toBeTruthy();
  });

  it('R31: sin ninguna prueba registrada la ultima prueba es la marca de vacio', () => {
    montar(vista({ lastCheckedAt: null }));

    expect(screen.getByTestId(AI_PROVIDER_CARD_LAST_TEST_TESTID).textContent).toBe(EMPTY_MARK);
  });

  it.each([
    ['ANTHROPIC', 'Claude', 'C'],
    ['GOOGLE', 'Gemini', 'G'],
    ['OPENAI', 'OpenAI', 'O'],
    ['OPENROUTER', 'OpenRouter', 'R'],
  ] as const)('R35: el logo de %s es el monograma «%s» con el nombre del proveedor como aria-label', (code, nombre, monograma) => {
    montar(vista({ provider: code as AiProviderCode, providerName: nombre }));

    const logo = within(tarjeta()).getByTestId(AI_PROVIDER_LOGO_TESTID);
    expect(logo).toHaveAttribute('role', 'img');
    expect(logo).toHaveAttribute('aria-label', nombre);
    expect(logo).toHaveAttribute('data-provider', code);
    expect(logo.textContent).toBe(monograma);
    expect(within(tarjeta()).getByRole('img', { name: nombre })).toBe(logo);
    expect(logo.className).toMatch(/(^|\s)size-11(\s|$)/);
  });

  it('QT-291 R20: «Probar conexión» prueba la guardada y muestra «Conexión correcta · el modelo en uso responde», sin tiempo', async () => {
    testSavedMock.mockResolvedValue({ status: 'tested', ok: true, elapsedMs: 1260 });
    const user = setupUser();
    montar(vista());

    await user.click(screen.getByTestId(AI_PROVIDER_CARD_TEST_TESTID));

    await waitFor(() => expect(resultado().textContent).toBe('Conexión correcta · el modelo en uso responde'));
    expect(resultado()).toHaveAttribute('aria-live', 'polite');
    expect(testSavedMock).toHaveBeenCalledTimes(1);
    expect(disconnectMock).not.toHaveBeenCalled();
  });

  it('R34: una prueba fallida se lee en el aviso de la tarjeta; debajo solo mientras el aviso no lo trae', async () => {
    testSavedMock.mockResolvedValue({ status: 'tested', ok: false, message: RECHAZADA });
    const user = setupUser();
    const { rerender } = montar(vista());

    await user.click(screen.getByTestId(AI_PROVIDER_CARD_TEST_TESTID));
    await waitFor(() => expect(resultado().textContent).toBe(RECHAZADA));

    rerender(
      <AiProviderCard providers={PROVEEDORES} connection={enError({ lastError: RECHAZADA })} />,
    );

    expect(within(screen.getByTestId(AI_PROVIDER_CARD_ERROR_TESTID)).getByText(RECHAZADA)).toBeTruthy();
    expect(resultado().textContent).toBe('');
  });

  it('R34: un error del catalogo al probar se muestra con su texto', async () => {
    testSavedMock.mockResolvedValue({
      status: 'error',
      code: 'integration_secret_unreadable',
      message: errorMessage('integration_secret_unreadable'),
    });
    const user = setupUser();
    montar(vista());

    await user.click(screen.getByTestId(AI_PROVIDER_CARD_TEST_TESTID));

    await waitFor(() =>
      expect(within(resultado()).getByRole('alert').textContent).toContain(
        errorMessage('integration_secret_unreadable'),
      ),
    );
  });

  it('R34: si ya no hay conexion, refresca la pantalla sin mensaje', async () => {
    testSavedMock.mockResolvedValue({ status: 'not_connected' });
    const user = setupUser();
    montar(vista());

    await user.click(screen.getByTestId(AI_PROVIDER_CARD_TEST_TESTID));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(resultado().textContent).toBe('');
  });

  it('QT-291 R15, R32: sin elección, «Cambiar key o proveedor» muestra el formulario sin confirmación, con el proveedor actual elegido y la key vacia', async () => {
    const user = setupUser();
    montar(enError());

    await user.click(screen.getByTestId(AI_PROVIDER_CARD_CHANGE_TESTID));

    expect(screen.queryByTestId(AI_PROVIDER_CARD_TESTID)).toBeNull();
    expect(screen.getByTestId(AI_PROVIDER_FORM_TESTID)).toBeTruthy();
    expect(screen.getByTestId(`${AI_PROVIDER_OPTION_TESTID_PREFIX}GOOGLE`)).toHaveAttribute('aria-checked', 'true');
    expect((screen.getByTestId(AI_PROVIDER_KEY_FIELD_TESTID) as HTMLInputElement).value).toBe('');
    expect(screen.getByLabelText('API key de Gemini')).toBe(screen.getByTestId(AI_PROVIDER_KEY_FIELD_TESTID));
  });

  it('QT-291 R30: al pulsar «Cambiar key o proveedor» la ayuda del formulario no dice «Después de conectar podrás elegir el modelo.»', async () => {
    const user = setupUser();
    montar(enError());

    await user.click(screen.getByTestId(AI_PROVIDER_CARD_CHANGE_TESTID));

    const ayuda = screen.getByTestId(AI_PROVIDER_FORM_HELP_TESTID);
    expect(ayuda.textContent).toBe('Créala en la consola de Gemini: aistudio.google.com/apikey.');
    expect(screen.queryByText(/Después de conectar podrás elegir el modelo/)).toBeNull();
  });

  it('R33: «Desconectar» pide confirmacion con el titulo y el texto del tablero; cancelar no cambia nada', async () => {
    const user = setupUser();
    montar(vista());

    await user.click(screen.getByTestId(AI_PROVIDER_CARD_DISCONNECT_TESTID));

    const dialogo = await screen.findByTestId(AI_PROVIDER_DISCONNECT_DIALOG_TESTID);
    expect(within(dialogo).getByRole('heading', { name: '¿Desconectar Gemini?' })).toBeTruthy();
    expect(within(dialogo).getByText(DESCRIPCION_DESCONECTAR)).toBeTruthy();
    expect(screen.getByTestId(AI_PROVIDER_DISCONNECT_CONFIRM_TESTID).textContent).toBe('Desconectar');

    await user.click(screen.getByTestId(AI_PROVIDER_DISCONNECT_DISMISS_TESTID));

    await waitFor(() => expect(screen.queryByTestId(AI_PROVIDER_DISCONNECT_DIALOG_TESTID)).toBeNull());
    expect(disconnectMock).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(tarjeta()).toBeTruthy();
  });

  it('R34: confirmar «Desconectar» llama a la accion y avisa «Proveedor IA desconectado»', async () => {
    disconnectMock.mockResolvedValue({ status: 'disconnected' });
    const user = setupUser();
    montar(vista());

    await user.click(screen.getByTestId(AI_PROVIDER_CARD_DISCONNECT_TESTID));
    await user.click(await screen.findByTestId(AI_PROVIDER_DISCONNECT_CONFIRM_TESTID));

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Proveedor IA desconectado'));
    expect(disconnectMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId(AI_PROVIDER_DISCONNECT_DIALOG_TESTID)).toBeNull());
  });

  it('R34: si desconectar falla, el dialogo sigue abierto con el texto del catalogo y no avisa', async () => {
    disconnectMock.mockResolvedValue({
      status: 'error',
      code: 'unauthorized',
      message: errorMessage('unauthorized'),
    });
    const user = setupUser();
    montar(vista());

    await user.click(screen.getByTestId(AI_PROVIDER_CARD_DISCONNECT_TESTID));
    await user.click(await screen.findByTestId(AI_PROVIDER_DISCONNECT_CONFIRM_TESTID));

    const dialogo = screen.getByTestId(AI_PROVIDER_DISCONNECT_DIALOG_TESTID);
    await waitFor(() =>
      expect(within(dialogo).getByRole('alert').textContent).toContain(errorMessage('unauthorized')),
    );
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('R36: acciones de 44 px, ninguna solo por hover, apiladas con 760 px de contenedor o menos', () => {
    montar(vista());

    for (const testId of [
      AI_PROVIDER_CARD_DISCONNECT_TESTID,
      AI_PROVIDER_CARD_TEST_TESTID,
      AI_PROVIDER_CARD_CHANGE_TESTID,
    ]) {
      expect(screen.getByTestId(testId).className).toMatch(/(^|\s)min-h-11(\s|$)/);
    }
    const fila = screen.getByTestId(AI_PROVIDER_CARD_DISCONNECT_TESTID).parentElement as HTMLElement;
    expect(fila.className).toMatch(/(^|\s)@max-\[760px\]:flex-col(\s|$)/);
    expect(fila.className).toMatch(/(^|\s)@max-\[760px\]:items-stretch(\s|$)/);
  });

  it('QT-291 R26: la sección «Modelo» va entre el aviso de error y «Última prueba», con su texto y un solo selector de Gemini, sin las filas de receta y catálogo', () => {
    montar(enError());

    const seccion = screen.getByTestId(AI_PROVIDER_CARD_MODEL_SECTION_TESTID);
    expect(within(seccion).getByRole('heading', { level: 3, name: 'Modelo' })).toBeTruthy();
    expect(seccion).toHaveAccessibleName('Modelo');
    expect(
      within(seccion).getByText(
        'Se usa para leer fórmulas y catálogos en PDF. Solo aparecen modelos de Gemini que leen PDF e imágenes.',
      ),
    ).toBeTruthy();
    expect(within(tarjeta()).getAllByRole('combobox')).toHaveLength(1);
    expect(within(seccion).getByRole('combobox', { name: 'Modelo de Gemini' })).toBeTruthy();
    const aviso = screen.getByTestId(AI_PROVIDER_CARD_ERROR_TESTID);
    const ultima = screen.getByTestId(AI_PROVIDER_CARD_LAST_TEST_TESTID);
    expect(aviso.compareDocumentPosition(seccion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(seccion.compareDocumentPosition(ultima) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tarjeta().textContent).not.toContain('Fórmula (desde PDF)');
    expect(tarjeta().textContent).not.toContain('Receta (fórmula desde PDF)');
    expect(tarjeta().textContent).not.toContain('Catálogo desde PDF');
    expect(tarjeta().textContent).not.toMatch(/predeterminado/i);
  });

  it('QT-291 R26: las opciones son solo las del proveedor conectado, en su orden', async () => {
    const user = setupUser();
    montar(vista());

    await user.click(disparador());
    const lista = await screen.findByRole('listbox');
    const valores = within(lista)
      .getAllByTestId(AI_MODEL_SELECT_OPTION_TESTID)
      .map((o) => o.getAttribute('data-value'));
    expect(valores).toEqual(GEMINI.map((m) => m.modelId));
  });

  it('QT-291 R27: sin elección, «Recomendado» y su ayuda; con elección, «Elegido por tu empresa.»', () => {
    const { rerender } = montar(vista());

    expect(within(disparador()).getByText('Recomendado')).toBeTruthy();
    expect(screen.getByTestId(AI_MODEL_SELECT_HELP_TESTID).textContent).toBe(
      'Se usa el modelo recomendado de Gemini.',
    );

    rerender(<AiProviderCard providers={PROVEEDORES} connection={conEleccion()} />);

    expect(within(disparador()).getByText('gemini-4-argon')).toBeTruthy();
    expect(within(disparador()).queryByText('Recomendado')).toBeNull();
    expect(screen.getByTestId(AI_MODEL_SELECT_HELP_TESTID).textContent).toBe('Elegido por tu empresa.');
  });

  it('QT-291 R28: con el modelo en uso marcado, el selector lo muestra tachado con «No disponible» y no lo ofrece', async () => {
    const user = setupUser();
    montar(
      enError({
        modelInUse: 'gemini-3.7-flash',
        modelIsDefault: false,
        modelUnavailable: true,
        modelOptions: GEMINI.filter((m) => m.modelId !== 'gemini-3.7-flash'),
      }),
    );

    expect(within(disparador()).getByText('gemini-3.7-flash')).toHaveClass('line-through');
    expect(within(disparador()).getByText('No disponible')).toBeTruthy();
    expect(disparador()).toHaveAttribute('aria-invalid', 'true');

    await user.click(disparador());
    const lista = await screen.findByRole('listbox');
    const valores = within(lista)
      .getAllByTestId(AI_MODEL_SELECT_OPTION_TESTID)
      .map((o) => o.getAttribute('data-value'));
    expect(valores).not.toContain('gemini-3.7-flash');
  });

  it('QT-291 R29: elegir envía el modelo sin otro botón; mientras se consulta, el selector está ocupado con el elegido; si se guarda, «Modelo guardado»', async () => {
    const respuesta = diferida<SelectAiModelFormState>();
    selectMock.mockReturnValue(respuesta.promesa);
    const user = setupUser();
    montar(vista());

    await elegir(user, 'gemini-4-argon');

    await waitFor(() => expect(disparador()).toHaveAttribute('aria-busy', 'true'));
    expect(within(disparador()).getByText('gemini-4-argon')).toBeTruthy();
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect((selectMock.mock.calls[0]?.[1] as FormData).get('modelId')).toBe('gemini-4-argon');
    await user.click(disparador());
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(toastSuccessMock).not.toHaveBeenCalled();

    respuesta.resolver({ status: 'saved' });

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Modelo guardado'));
    await waitFor(() => expect(disparador()).not.toHaveAttribute('aria-busy'));
    expect(screen.queryByTestId(AI_MODEL_SELECT_ERROR_TESTID)).toBeNull();
  });

  it('QT-291 R29: si la consulta falla, el mensaje va bajo el selector, vuelve el valor anterior y la tarjeta no cambia', async () => {
    const mensaje = 'Error con tu proveedor: el modelo gemini-4-argon ya no está disponible.';
    selectMock.mockResolvedValue({ status: 'error', code: 'ai_provider_error', message: mensaje });
    const user = setupUser();
    montar(vista());

    await elegir(user, 'gemini-4-argon');

    const error = await screen.findByTestId(AI_MODEL_SELECT_ERROR_TESTID);
    expect(error.textContent).toBe(mensaje);
    expect(within(disparador()).getByText('gemini-3.8-flash')).toBeTruthy();
    expect(within(disparador()).getByText('Recomendado')).toBeTruthy();
    expect(screen.getByTestId(AI_PROVIDER_CARD_MODEL_SECTION_TESTID).contains(error)).toBe(true);
    expect(screen.queryByTestId(AI_PROVIDER_CARD_ERROR_TESTID)).toBeNull();
    expect(screen.getByTestId(AI_PROVIDER_CARD_STATUS_TESTID).textContent).toBe('Conectado');
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('QT-291 R29: un error del catálogo (key ilegible) se pinta bajo el selector con su texto', async () => {
    selectMock.mockResolvedValue({
      status: 'error',
      code: 'integration_secret_unreadable',
      message: errorMessage('integration_secret_unreadable'),
    });
    const user = setupUser();
    montar(conEleccion());

    await elegir(user, 'gemini-3.7-flash');

    const error = await screen.findByTestId(AI_MODEL_SELECT_ERROR_TESTID);
    expect(error.textContent).toContain(errorMessage('integration_secret_unreadable'));
    expect(within(disparador()).getByText('gemini-4-argon')).toBeTruthy();
  });

  it('QT-291 R29: si ya no hay conexion al elegir, refresca la pantalla sin aviso', async () => {
    selectMock.mockResolvedValue({ status: 'not_connected' });
    const user = setupUser();
    montar(vista());

    await elegir(user, 'gemini-4-argon');

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId(AI_MODEL_SELECT_ERROR_TESTID)).toBeNull();
  });

  it('QT-291 R15: con elección, «Cambiar key o proveedor» pide confirmación con «recomendado»; «Cancelar» no cambia nada', async () => {
    const user = setupUser();
    montar(conEleccion());

    await user.click(screen.getByTestId(AI_PROVIDER_CARD_CHANGE_TESTID));

    const dialogo = await screen.findByTestId(AI_PROVIDER_CHANGE_DIALOG_TESTID);
    expect(within(dialogo).getByRole('heading', { name: '¿Cambiar de proveedor?' })).toBeTruthy();
    expect(
      within(dialogo).getByText(
        'El modelo que elegiste es de Gemini. Si conectas otro proveedor, se usa el modelo recomendado del nuevo proveedor. Si solo cambias la key de Gemini, se conserva.',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId(AI_PROVIDER_CHANGE_DISMISS_TESTID).textContent).toBe('Cancelar');
    expect(screen.getByTestId(AI_PROVIDER_CHANGE_CONFIRM_TESTID).textContent).toBe('Continuar');

    await user.click(screen.getByTestId(AI_PROVIDER_CHANGE_DISMISS_TESTID));

    await waitFor(() => expect(screen.queryByTestId(AI_PROVIDER_CHANGE_DIALOG_TESTID)).toBeNull());
    expect(tarjeta()).toBeTruthy();
    expect(screen.queryByTestId(AI_PROVIDER_FORM_TESTID)).toBeNull();
  });

  it('QT-291 R15: con elección, «Continuar» abre el formulario con el proveedor actual', async () => {
    const user = setupUser();
    montar(conEleccion());

    await user.click(screen.getByTestId(AI_PROVIDER_CARD_CHANGE_TESTID));
    await user.click(await screen.findByTestId(AI_PROVIDER_CHANGE_CONFIRM_TESTID));

    expect(await screen.findByTestId(AI_PROVIDER_FORM_TESTID)).toBeTruthy();
    expect(screen.queryByTestId(AI_PROVIDER_CARD_TESTID)).toBeNull();
    expect(screen.getByTestId(`${AI_PROVIDER_OPTION_TESTID_PREFIX}GOOGLE`)).toHaveAttribute('aria-checked', 'true');
  });
});
