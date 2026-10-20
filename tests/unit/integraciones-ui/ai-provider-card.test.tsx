// La tarjeta de la conexion del proveedor IA: estado, modelos, ultima prueba, aviso de error,
// probar la guardada, cambiar y desconectar. Solo las Server Actions, `toast` y el router son el doble.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_PROVIDER_CARD_CATALOG_MODEL_TESTID,
  AI_PROVIDER_CARD_CHANGE_TESTID,
  AI_PROVIDER_CARD_DISCONNECT_TESTID,
  AI_PROVIDER_CARD_ERROR_TESTID,
  AI_PROVIDER_CARD_KEY_SAVED_TESTID,
  AI_PROVIDER_CARD_LAST_TEST_TESTID,
  AI_PROVIDER_CARD_RECIPE_MODEL_TESTID,
  AI_PROVIDER_CARD_RESULT_TESTID,
  AI_PROVIDER_CARD_STATUS_TESTID,
  AI_PROVIDER_CARD_TEST_TESTID,
  AI_PROVIDER_CARD_TESTID,
  AI_PROVIDER_DISCONNECT_CONFIRM_TESTID,
  AI_PROVIDER_DISCONNECT_DIALOG_TESTID,
  AI_PROVIDER_DISCONNECT_DISMISS_TESTID,
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
  TestSavedAiProviderFormState,
} from '@/lib/modules/integraciones/adapters/driving/ai-provider-actions';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import { setupUser } from '../../helpers/user-event';

const { testSavedMock, disconnectMock, toastSuccessMock, refreshMock } = vi.hoisted(() => ({
  testSavedMock: vi.fn<
    (prev: TestSavedAiProviderFormState, data: FormData) => Promise<TestSavedAiProviderFormState>
  >(),
  disconnectMock: vi.fn<
    (prev: DisconnectAiProviderFormState, data: FormData) => Promise<DisconnectAiProviderFormState>
  >(),
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

const PROVEEDORES: AiProviderEntry[] = [
  { code: 'ANTHROPIC', name: 'Claude', recipeModel: 'claude-haiku-5-5', catalogModel: 'claude-haiku-5-5' },
  { code: 'GOOGLE', name: 'Gemini', recipeModel: 'gemini-3.8-flash', catalogModel: 'gemini-3.5-flash-lite' },
  { code: 'OPENAI', name: 'OpenAI', recipeModel: 'gpt-6-luna', catalogModel: 'gpt-6-luna' },
  {
    code: 'OPENROUTER',
    name: 'OpenRouter',
    recipeModel: 'anthropic/claude-haiku-5.5',
    catalogModel: 'anthropic/claude-haiku-5.5',
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
    recipeModel: 'gemini-3.8-flash',
    catalogModel: 'gemini-3.5-flash-lite',
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

function montar(connection: AiProviderConnectionView) {
  return render(<AiProviderCard providers={PROVEEDORES} connection={connection} />);
}

function tarjeta(): HTMLElement {
  return screen.getByTestId(AI_PROVIDER_CARD_TESTID);
}

function resultado(): HTMLElement {
  return screen.getByTestId(AI_PROVIDER_CARD_RESULT_TESTID);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('AiProviderCard', () => {
  it('R31: pinta el nombre del proveedor, «Key guardada el dd/mm/aaaa · cifrada», los dos modelos y las etiquetas del tablero', () => {
    montar(vista());

    expect(within(tarjeta()).getByRole('heading', { level: 2 }).textContent).toBe('Gemini');
    expect(screen.getByTestId(AI_PROVIDER_CARD_KEY_SAVED_TESTID).textContent).toBe(
      'Key guardada el 13/10/2026 · cifrada',
    );
    expect(screen.getByTestId(AI_PROVIDER_CARD_RECIPE_MODEL_TESTID).textContent).toBe('gemini-3.8-flash');
    expect(screen.getByTestId(AI_PROVIDER_CARD_CATALOG_MODEL_TESTID).textContent).toBe('gemini-3.5-flash-lite');
    const terminos = within(tarjeta())
      .getAllByRole('term')
      .map((dt) => dt.textContent);
    expect(terminos).toEqual(['Receta (fórmula desde PDF)', 'Catálogo desde PDF', 'Última prueba']);
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

  it('R34: «Probar conexión» prueba la guardada y muestra «Conexión correcta · respondió en X s»', async () => {
    testSavedMock.mockResolvedValue({ status: 'tested', ok: true, elapsedMs: 1260 });
    const user = setupUser();
    montar(vista());

    await user.click(screen.getByTestId(AI_PROVIDER_CARD_TEST_TESTID));

    await waitFor(() => expect(resultado().textContent).toBe('Conexión correcta · respondió en 1,3 s'));
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

  it('R32: «Cambiar key o proveedor» muestra el formulario con el proveedor actual elegido y la key vacia', async () => {
    const user = setupUser();
    montar(enError());

    await user.click(screen.getByTestId(AI_PROVIDER_CARD_CHANGE_TESTID));

    expect(screen.queryByTestId(AI_PROVIDER_CARD_TESTID)).toBeNull();
    expect(screen.getByTestId(AI_PROVIDER_FORM_TESTID)).toBeTruthy();
    expect(screen.getByTestId(`${AI_PROVIDER_OPTION_TESTID_PREFIX}GOOGLE`)).toHaveAttribute('aria-checked', 'true');
    expect((screen.getByTestId(AI_PROVIDER_KEY_FIELD_TESTID) as HTMLInputElement).value).toBe('');
    expect(screen.getByLabelText('API key de Gemini')).toBe(screen.getByTestId(AI_PROVIDER_KEY_FIELD_TESTID));
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
});
