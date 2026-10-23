// La pantalla /integraciones/proveedor-ia: corte por permiso, formulario sin conexion, tarjeta con
// conexion, error de carga y ninguna key en las props ni en el HTML.
//
// Se mockea el proveedor de sesion, no `requirePagePermission`: el corte se ejecuta de verdad.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import { isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_MODEL_SELECT_TRIGGER_TESTID,
  AI_PROVIDER_CARD_MODEL_SECTION_TESTID,
  AI_PROVIDER_CARD_STATUS_TESTID,
  AI_PROVIDER_CARD_TESTID,
  AI_PROVIDER_FORM_SAVE_TESTID,
  AI_PROVIDER_FORM_TEST_TESTID,
  AI_PROVIDER_FORM_TESTID,
  AI_PROVIDER_KEY_FIELD_TESTID,
  AI_PROVIDER_PICKER_TESTID,
} from '@/app/(private)/integraciones/proveedor-ia/components';
import AiProviderIntegrationPage from '@/app/(private)/integraciones/proveedor-ia/page';
import { errorMessage } from '@/lib/modules/errores';
import type { SessionUser } from '@/lib/modules/identity';
import type { AiProviderCode, AiProviderConnectionView, AiProviderEntry } from '@/lib/modules/integraciones';
import type { AiProviderConnectionQueryResult } from '@/lib/modules/integraciones/adapters/driving/ai-provider-actions';
import { AI_PROVIDER_INTEGRATION_LABEL } from '@/lib/shared/navigation/private-nav';
import { AI_PROVIDER_INTEGRATION_ROUTE, LOGIN_ROUTE_SESSION_ENDED } from '@/lib/shared/routes';

import { resetViewport, setViewportWidth } from '../../helpers/viewport';

const { getSessionUserMock, getConnectionMock, notFoundMock, redirectMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn<() => Promise<unknown>>(),
  getConnectionMock: vi.fn<() => Promise<AiProviderConnectionQueryResult>>(),
  notFoundMock: vi.fn<() => never>(),
  redirectMock: vi.fn<(ruta: string) => never>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: notFoundMock,
  redirect: redirectMock,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, endSession: vi.fn<() => Promise<void>>() },
  observabilidad: { readRequestIdHeader: vi.fn(async (): Promise<string | null> => null) },
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/ai-provider-actions', () => {
  const noDebeInvocarse = (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse al pintar la pagina`);
  };
  return {
    getAiProviderConnectionAction: getConnectionMock,
    testAiProviderKeyAction: vi.fn(noDebeInvocarse('testAiProviderKeyAction')),
    testSavedAiProviderAction: vi.fn(noDebeInvocarse('testSavedAiProviderAction')),
    saveAiProviderConnectionAction: vi.fn(noDebeInvocarse('saveAiProviderConnectionAction')),
    disconnectAiProviderAction: vi.fn(noDebeInvocarse('disconnectAiProviderAction')),
    selectAiModelAction: vi.fn(noDebeInvocarse('selectAiModelAction')),
    getAiProviderReadinessAction: vi.fn(noDebeInvocarse('getAiProviderReadinessAction')),
  };
});

const PERMISO = 'integraciones.modificar';
const RAIZ = join(__dirname, '..', '..', '..');

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

const INTRO =
  'La lectura de fórmulas y catálogos en PDF usa la cuenta de IA de tu empresa. Elige el proveedor, pega tu API key y prueba la conexión. La key se guarda cifrada y nunca se vuelve a mostrar.';

function sesionCon(permissions: readonly string[]): SessionUser {
  return {
    id: 'u-test-proveedor-ia',
    username: 'carla.duarte',
    displayName: 'Carla Duarte Salas',
    roleName: 'Administrador',
    permissions,
  };
}

function vista(overrides: Partial<AiProviderConnectionView> = {}): AiProviderConnectionView {
  return {
    provider: 'GOOGLE',
    providerName: 'Gemini',
    modelInUse: 'gemini-3.8-flash',
    modelIsDefault: true,
    modelUnavailable: false,
    modelOptions: PROVEEDORES[1]?.models ?? [],
    status: 'ACTIVE',
    lastError: null,
    lastErrorAt: null,
    lastCheckedAt: '2026-10-13T12:05:00.000Z',
    keyUpdatedAt: '2026-10-13T12:00:00.000Z',
    ...overrides,
  };
}

function fuenteDeLaPagina(): string {
  return readFileSync(
    join(RAIZ, 'app', '(private)', ...AI_PROVIDER_INTEGRATION_ROUTE.split('/').filter(Boolean), 'page.tsx'),
    'utf8',
  )
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, '');
}

/** Todas las claves de props del arbol que devuelve la pagina, y sus valores de texto. */
function recorrerProps(nodo: ReactNode, claves: Set<string>, textos: string[]): void {
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) recorrerProps(hijo as ReactNode, claves, textos);
    return;
  }
  if (typeof nodo === 'string') {
    textos.push(nodo);
    return;
  }
  if (!isValidElement(nodo)) return;
  const props = nodo.props as Record<string, unknown>;
  for (const [clave, valor] of Object.entries(props)) {
    claves.add(clave);
    if (clave === 'children') recorrerProps(valor as ReactNode, claves, textos);
    else {
      textos.push(JSON.stringify(valor) ?? '');
      if (valor !== null && typeof valor === 'object' && !isValidElement(valor)) {
        recolectarClaves(valor, claves);
      }
    }
  }
}

function recolectarClaves(valor: unknown, claves: Set<string>): void {
  if (Array.isArray(valor)) {
    for (const item of valor) recolectarClaves(item, claves);
    return;
  }
  if (valor === null || typeof valor !== 'object') return;
  for (const [clave, interior] of Object.entries(valor)) {
    claves.add(clave);
    recolectarClaves(interior, claves);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  notFoundMock.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  redirectMock.mockImplementation(() => {
    throw new Error('NEXT_REDIRECT');
  });
  getSessionUserMock.mockResolvedValue(sesionCon([PERMISO]));
  getConnectionMock.mockResolvedValue({ status: 'success', providers: PROVEEDORES, connection: null });
  setViewportWidth(1280);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('AiProviderIntegrationPage', () => {
  it('R3: sin integraciones.modificar responde notFound y no consulta la conexion', async () => {
    getSessionUserMock.mockResolvedValue(sesionCon(['formulas.consultar', 'documentos.subir']));

    await expect(AiProviderIntegrationPage()).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getConnectionMock).not.toHaveBeenCalled();
  });

  it('R3: sin sesion redirige al login y no consulta la conexion', async () => {
    getSessionUserMock.mockResolvedValue(null);

    await expect(AiProviderIntegrationPage()).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith(LOGIN_ROUTE_SESSION_ENDED);
    expect(getConnectionMock).not.toHaveBeenCalled();
  });

  it('R3: exige integraciones.modificar como primera sentencia y una sola vez, y lee la conexion por la ruta exacta de sus acciones', () => {
    const fuente = fuenteDeLaPagina();
    const primera = /export default async function \w+\(\)\s*\{\s*([^;]+);/.exec(fuente)?.[1];

    expect(primera).toBe(`await requirePagePermission('${PERMISO}')`);
    expect([...fuente.matchAll(/requirePagePermission\(/g)]).toHaveLength(1);
    expect(fuente).toMatch(
      /import \{ getAiProviderConnectionAction \} from '@\/lib\/modules\/integraciones\/adapters\/driving\/ai-provider-actions';/,
    );
    expect(fuente).not.toMatch(/IntegrationPlaceholder/);
  });

  it('R30: muestra el titulo, la miga «Integraciones» y el parrafo del tablero', async () => {
    render(await AiProviderIntegrationPage());

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(AI_PROVIDER_INTEGRATION_LABEL);
    expect(screen.getByTestId('integration-title').textContent).toBe(AI_PROVIDER_INTEGRATION_LABEL);
    const miga = screen.getByRole('navigation', { name: 'Ruta' });
    expect(within(miga).getByText('Integraciones')).toBeTruthy();
    expect(within(miga).getByText(AI_PROVIDER_INTEGRATION_LABEL)).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(INTRO)).toBeTruthy();
  });

  it('R30: sin conexion pinta el formulario con los cuatro proveedores, el campo vacio y los botones deshabilitados', async () => {
    render(await AiProviderIntegrationPage());

    const formulario = screen.getByTestId(AI_PROVIDER_FORM_TESTID);
    expect(within(formulario).getByRole('heading', { level: 2 }).textContent).toBe('Conecta tu proveedor');
    expect(within(formulario).getByText('Sin configurar')).toBeTruthy();
    expect(within(screen.getByTestId(AI_PROVIDER_PICKER_TESTID)).getAllByRole('radio')).toHaveLength(4);
    const campo = screen.getByTestId(AI_PROVIDER_KEY_FIELD_TESTID) as HTMLInputElement;
    expect(campo.value).toBe('');
    expect(campo.type).toBe('password');
    expect(screen.getByTestId(AI_PROVIDER_FORM_TEST_TESTID)).toBeDisabled();
    expect(screen.getByTestId(AI_PROVIDER_FORM_SAVE_TESTID)).toBeDisabled();
    expect(screen.queryByTestId(AI_PROVIDER_CARD_TESTID)).toBeNull();
  });

  it('R31, QT-291 R26: con conexion pinta la tarjeta con el proveedor, su estado y la sección «Modelo» con el modelo en uso, sin formulario', async () => {
    getConnectionMock.mockResolvedValue({
      status: 'success',
      providers: PROVEEDORES,
      connection: vista(),
    });

    render(await AiProviderIntegrationPage());

    const tarjeta = screen.getByTestId(AI_PROVIDER_CARD_TESTID);
    expect(within(tarjeta).getByRole('heading', { level: 2 }).textContent).toBe('Gemini');
    expect(within(tarjeta).getByTestId(AI_PROVIDER_CARD_STATUS_TESTID).textContent).toBe('Conectado');
    const seccion = within(tarjeta).getByTestId(AI_PROVIDER_CARD_MODEL_SECTION_TESTID);
    expect(within(seccion).getByTestId(AI_MODEL_SELECT_TRIGGER_TESTID).textContent).toContain('gemini-3.8-flash');
    expect(screen.queryByTestId(AI_PROVIDER_FORM_TESTID)).toBeNull();
    expect(screen.queryByTestId(AI_PROVIDER_KEY_FIELD_TESTID)).toBeNull();
  });

  it('R34: si la consulta falla, muestra el texto del catalogo y ni el formulario ni la tarjeta', async () => {
    getConnectionMock.mockResolvedValue({
      status: 'error',
      code: 'unauthorized',
      message: errorMessage('unauthorized'),
    });

    render(await AiProviderIntegrationPage());

    expect(screen.getByRole('alert').textContent).toContain(errorMessage('unauthorized'));
    expect(screen.queryByTestId(AI_PROVIDER_FORM_TESTID)).toBeNull();
    expect(screen.queryByTestId(AI_PROVIDER_CARD_TESTID)).toBeNull();
  });

  it.each([
    ['sin conexion', null],
    ['con conexion en ERROR', vista({ status: 'ERROR', lastError: 'Error con tu proveedor: la key fue rechazada. Revísala y vuelve a probar.', lastErrorAt: '2026-10-13T12:20:00.000Z' })],
  ])('R8: %s, ni las props ni el HTML llevan la key ni su valor cifrado', async (_caso, connection) => {
    getConnectionMock.mockResolvedValue({ status: 'success', providers: PROVEEDORES, connection });

    const arbol = await AiProviderIntegrationPage();
    const claves = new Set<string>();
    const textos: string[] = [];
    recorrerProps(arbol, claves, textos);

    expect([...claves].filter((clave) => /api_?key|enc$|secret|cipher/i.test(clave))).toEqual([]);
    expect(textos.join('\n')).not.toMatch(/apiKeyEnc|api_key_enc|v\d+:/);

    const { container } = render(arbol);
    expect(container.innerHTML).not.toMatch(/apiKeyEnc|api_key_enc/);
    // El input oculto del selector de modelo lleva el modelo en uso, no la key.
    const seccionModelo = `[data-testid="${AI_PROVIDER_CARD_MODEL_SECTION_TESTID}"]`;
    for (const campo of container.querySelectorAll('input')) {
      if (campo.closest(seccionModelo) !== null) continue;
      if (campo.type !== 'hidden' && campo.type !== 'radio') expect(campo.value).toBe('');
    }
    const modelos = PROVEEDORES.flatMap((p) => p.models.map((m) => m.modelId));
    for (const campo of container.querySelectorAll(`${seccionModelo} input`)) {
      expect(modelos).toContain((campo as HTMLInputElement).value);
    }
    expect(fuenteDeLaPagina()).not.toMatch(/apiKey/);
  });
});
