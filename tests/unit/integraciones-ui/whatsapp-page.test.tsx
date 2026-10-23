// La pantalla /integraciones/whatsapp: corte por permiso, pestañas, alta sin conexion, tarjeta con
// conexion, ningun verify token en la pagina y carga de plantillas y diccionario por pestaña.
// Los casos «QC-243 R<n>» son de esa ficha; el resto, de QC-237.
//
// Se mockea el proveedor de sesion, no `requirePagePermission`: el corte se ejecuta de verdad.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import { isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WHATSAPP_CONNECTION_ACTIONS_TESTID,
  WHATSAPP_CONNECTION_CARD_TESTID,
  WHATSAPP_CONNECTION_FORM_TESTID,
  WHATSAPP_CONNECTION_PANEL_TESTID,
  WHATSAPP_CONNECTION_STATUS_TESTID,
  WHATSAPP_FIELD_TESTIDS,
  WHATSAPP_SETUP_GUIDE_STEPS,
  WHATSAPP_SETUP_GUIDE_TESTID,
  WHATSAPP_TAB_CONNECTION_TESTID,
  WHATSAPP_DICTIONARY_ERROR_TESTID,
  WHATSAPP_DICTIONARY_RETRY_TESTID,
  WHATSAPP_NO_CONNECTION_HINT_TESTID,
  WHATSAPP_TAB_TEMPLATES_TESTID,
  WHATSAPP_TAB_VARIABLES_TESTID,
  WHATSAPP_TABS_TEXTS,
  WHATSAPP_TEMPLATES_ERROR_TESTID,
  WHATSAPP_TEMPLATES_RETRY_TESTID,
  WHATSAPP_TEMPLATES_TAB_PANEL_TESTID,
  WHATSAPP_VARIABLES_TAB_PANEL_TESTID,
  WHATSAPP_VERIFY_TOKEN_NOTICE_TESTID,
  WHATSAPP_VERIFY_TOKEN_TESTID,
  WHATSAPP_WEBHOOK_PANEL_TESTID,
  WHATSAPP_WEBHOOK_URL_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components';
import { WHATSAPP_TEMPLATES_PANEL_TESTID } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-templates-panel';
import { WHATSAPP_VARIABLES_PANEL_TESTID } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-variables-panel';
import WhatsappIntegrationPage from '@/app/(private)/integraciones/whatsapp/page';
import { errorMessage } from '@/lib/modules/errores';
import type { SessionUser } from '@/lib/modules/identity';
import type {
  WhatsappConnectionView,
  WhatsappDictionaryEntryView,
  WhatsappTemplateView,
} from '@/lib/modules/integraciones';
import type { WhatsappConnectionQueryResult } from '@/lib/modules/integraciones/adapters/driving/whatsapp-connection-actions';
import type { WhatsappTemplateListResult } from '@/lib/modules/integraciones/adapters/driving/whatsapp-template-actions';
import type { WhatsappDictionaryListResult } from '@/lib/modules/integraciones/adapters/driving/whatsapp-variable-key-actions';
import { WHATSAPP_INTEGRATION_LABEL } from '@/lib/shared/navigation/private-nav';
import { LOGIN_ROUTE_SESSION_ENDED, WHATSAPP_INTEGRATION_ROUTE } from '@/lib/shared/routes';

import { setupUser } from '../../helpers/user-event';
import { resetViewport, setViewportWidth, WIDE_VIEWPORT } from '../../helpers/viewport';

const {
  getSessionUserMock,
  getConnectionMock,
  listTemplatesMock,
  listDictionaryMock,
  notFoundMock,
  redirectMock,
  refreshMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn<() => Promise<unknown>>(),
  getConnectionMock: vi.fn<() => Promise<WhatsappConnectionQueryResult>>(),
  listTemplatesMock: vi.fn<() => Promise<WhatsappTemplateListResult>>(),
  listDictionaryMock: vi.fn<() => Promise<WhatsappDictionaryListResult>>(),
  notFoundMock: vi.fn<() => never>(),
  redirectMock: vi.fn<(ruta: string) => never>(),
  refreshMock: vi.fn<() => void>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: notFoundMock,
  redirect: redirectMock,
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-template-actions', () => ({
  listWhatsappTemplatesAction: listTemplatesMock,
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-variable-key-actions', () => ({
  listWhatsappDictionaryAction: listDictionaryMock,
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, endSession: vi.fn<() => Promise<void>>() },
  observabilidad: { readRequestIdHeader: vi.fn(async (): Promise<string | null> => null) },
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-connection-actions', () => {
  const noDebeInvocarse = (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse al pintar la pagina`);
  };
  return {
    getWhatsappConnectionAction: getConnectionMock,
    createWhatsappConnectionAction: vi.fn(noDebeInvocarse('createWhatsappConnectionAction')),
    updateWhatsappConnectionAction: vi.fn(noDebeInvocarse('updateWhatsappConnectionAction')),
    testWhatsappConnectionAction: vi.fn(noDebeInvocarse('testWhatsappConnectionAction')),
    enableWhatsappConnectionAction: vi.fn(noDebeInvocarse('enableWhatsappConnectionAction')),
    disableWhatsappConnectionAction: vi.fn(noDebeInvocarse('disableWhatsappConnectionAction')),
    regenerateWhatsappVerifyTokenAction: vi.fn(
      noDebeInvocarse('regenerateWhatsappVerifyTokenAction'),
    ),
  };
});

const PERMISO = 'integraciones.modificar';
const RAIZ = join(__dirname, '..', '..', '..');
const TOKEN_DE_ALTA = 'tok_centinela_que_nunca_debe_aparecer_en_la_pagina_0001';
const WEBHOOK = {
  url: 'https://app.ejemplo.com/api/integraciones/whatsapp/webhook/conn-1',
  complete: true,
};

const PLANTILLA: WhatsappTemplateView = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'pedido_listo',
  language: 'es',
  category: 'UTILITY',
  status: 'APPROVED',
  statusRaw: null,
  rejectedReason: null,
  content: { header: null, body: { text: 'Hola {{1}}', examples: [] }, footer: null, buttons: [] },
  lastSyncedAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  mappingStatus: 'UNMAPPED',
  enabled: false,
  variables: [{ slot: 'body.1', position: 1, kind: null, key: null, label: null }],
};

const DICCIONARIO: readonly WhatsappDictionaryEntryView[] = [
  { id: 'k1', key: 'numero_de_cuenta', label: 'Número de cuenta', value: '123456', usedBy: 0 },
  { id: 'k2', key: 'horario', label: 'Horario', value: '9 a 18', usedBy: 1 },
];

function sesionCon(permissions: readonly string[]): SessionUser {
  return {
    id: 'u-test-whatsapp',
    username: 'carla.duarte',
    displayName: 'Carla Duarte Salas',
    roleName: 'Administrador',
    permissions,
  };
}

function vista(overrides: Partial<WhatsappConnectionView> = {}): WhatsappConnectionView {
  return {
    id: 'conn-1',
    displayName: 'Ventas',
    wabaId: '222',
    phoneNumberId: '333',
    displayPhoneNumber: '+57 300 0000000',
    verifiedName: 'Empresa de prueba',
    status: 'PENDING',
    lastError: null,
    lastCheckedAt: '2026-10-09T15:30:00.000Z',
    lastWebhookAt: null,
    ...overrides,
  };
}

function fuenteDeLaPagina(): string {
  return readFileSync(
    join(RAIZ, 'app', '(private)', ...WHATSAPP_INTEGRATION_ROUTE.split('/').filter(Boolean), 'page.tsx'),
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
    else textos.push(JSON.stringify(valor) ?? '');
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  setViewportWidth(WIDE_VIEWPORT);
  notFoundMock.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  redirectMock.mockImplementation(() => {
    throw new Error('NEXT_REDIRECT');
  });
  getSessionUserMock.mockResolvedValue(sesionCon([PERMISO]));
  getConnectionMock.mockResolvedValue({ status: 'success', data: null, webhook: null });
  listTemplatesMock.mockResolvedValue({
    status: 'success',
    data: { templates: [PLANTILLA], templatesSyncedAt: null },
  });
  listDictionaryMock.mockResolvedValue({ status: 'success', data: DICCIONARIO });
});

function conConexion(): void {
  getConnectionMock.mockResolvedValue({ status: 'success', data: vista(), webhook: WEBHOOK });
}

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('WhatsappIntegrationPage', () => {
  it('R4: sin integraciones.modificar responde notFound y no consulta la conexion', async () => {
    getSessionUserMock.mockResolvedValue(sesionCon(['clientes.consultar']));

    await expect(WhatsappIntegrationPage()).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getConnectionMock).not.toHaveBeenCalled();
  });

  it('R4: sin sesion redirige al login y no consulta la conexion', async () => {
    getSessionUserMock.mockResolvedValue(null);

    await expect(WhatsappIntegrationPage()).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith(LOGIN_ROUTE_SESSION_ENDED);
    expect(getConnectionMock).not.toHaveBeenCalled();
  });

  it('R4: exige integraciones.modificar como primera sentencia y una sola vez', () => {
    const fuente = fuenteDeLaPagina();
    const primera = /export default async function \w+\(\)\s*\{\s*([^;]+);/.exec(fuente)?.[1];

    expect(primera).toBe(`await requirePagePermission('${PERMISO}')`);
    expect([...fuente.matchAll(/requirePagePermission\(/g)]).toHaveLength(1);
  });

  it('QC-243 R1: muestra el titulo y una sola fila de pestañas «Conexión», «Plantillas» y «Variables», con «Conexión» activa', async () => {
    render(await WhatsappIntegrationPage());

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(WHATSAPP_INTEGRATION_LABEL);
    const listas = screen.getAllByRole('tablist');
    expect(listas).toHaveLength(1);
    expect(within(listas[0]).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Conexión',
      'Plantillas',
      'Variables',
    ]);
    expect(screen.getByTestId(WHATSAPP_TAB_CONNECTION_TESTID)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId(WHATSAPP_TAB_TEMPLATES_TESTID)).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId(WHATSAPP_TAB_VARIABLES_TESTID)).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId(WHATSAPP_CONNECTION_PANEL_TESTID)).toBeVisible();
    expect(screen.queryByText('Disponible próximamente')).toBeNull();
  });

  it('QC-243 R2: sin conexion, «Plantillas» esta deshabilitada y descrita por su texto, y «Variables» habilitada', async () => {
    const user = setupUser();
    render(await WhatsappIntegrationPage());

    const plantillas = screen.getByTestId(WHATSAPP_TAB_TEMPLATES_TESTID);
    expect(
      plantillas.hasAttribute('disabled') || plantillas.getAttribute('aria-disabled') === 'true',
    ).toBe(true);
    const pista = screen.getByTestId(WHATSAPP_NO_CONNECTION_HINT_TESTID);
    expect(pista.textContent).toBe('Conecta tu número primero para ver Plantillas.');
    expect(pista).toBeVisible();
    expect(plantillas.getAttribute('aria-describedby')).toBe(pista.id);

    const variables = screen.getByTestId(WHATSAPP_TAB_VARIABLES_TESTID);
    expect(variables.hasAttribute('disabled')).toBe(false);
    expect(variables.getAttribute('aria-disabled')).not.toBe('true');
    expect(listTemplatesMock).not.toHaveBeenCalled();
    expect(listDictionaryMock).toHaveBeenCalledTimes(1);

    await user.click(variables);
    expect(variables).toHaveAttribute('aria-selected', 'true');
    expect(
      within(screen.getByTestId(WHATSAPP_VARIABLES_TAB_PANEL_TESTID)).getByTestId(
        WHATSAPP_VARIABLES_PANEL_TESTID,
      ),
    ).toHaveAttribute('data-count', String(DICCIONARIO.length));
  });

  it('QC-243 R3: con conexion, «Plantillas» esta habilitada, sin texto de ayuda, y muestra el listado de listWhatsappTemplatesAction', async () => {
    const user = setupUser();
    conConexion();
    render(await WhatsappIntegrationPage());

    const plantillas = screen.getByTestId(WHATSAPP_TAB_TEMPLATES_TESTID);
    expect(plantillas.hasAttribute('disabled')).toBe(false);
    expect(plantillas.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByTestId(WHATSAPP_NO_CONNECTION_HINT_TESTID)).toBeNull();
    expect(listTemplatesMock).toHaveBeenCalledTimes(1);

    await user.click(plantillas);
    expect(plantillas).toHaveAttribute('aria-selected', 'true');
    expect(
      within(screen.getByTestId(WHATSAPP_TEMPLATES_TAB_PANEL_TESTID)).getByTestId(
        WHATSAPP_TEMPLATES_PANEL_TESTID,
      ),
    ).toHaveAttribute('data-count', '1');
  });

  it('QC-243 R5: al entrar en «Plantillas» o «Variables» pide otra vez los datos; al volver a «Conexión», no', async () => {
    const user = setupUser();
    conConexion();
    render(await WhatsappIntegrationPage());
    expect(refreshMock).not.toHaveBeenCalled();

    await user.click(screen.getByTestId(WHATSAPP_TAB_TEMPLATES_TESTID));
    expect(refreshMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId(WHATSAPP_TAB_VARIABLES_TESTID));
    expect(refreshMock).toHaveBeenCalledTimes(2);

    await user.click(screen.getByTestId(WHATSAPP_TAB_CONNECTION_TESTID));
    expect(screen.getByTestId(WHATSAPP_TAB_CONNECTION_TESTID)).toHaveAttribute('aria-selected', 'true');
    expect(refreshMock).toHaveBeenCalledTimes(2);
  });

  it('QC-243 R6: si falla el listado de plantillas, esa pestaña muestra el error con reintento y Conexión y Variables siguen', async () => {
    const user = setupUser();
    conConexion();
    listTemplatesMock.mockResolvedValue({
      status: 'error',
      code: 'unauthorized',
      message: errorMessage('unauthorized'),
    });
    render(await WhatsappIntegrationPage());

    expect(
      within(screen.getByTestId(WHATSAPP_CONNECTION_PANEL_TESTID)).getByTestId(
        WHATSAPP_CONNECTION_CARD_TESTID,
      ),
    ).toBeTruthy();

    await user.click(screen.getByTestId(WHATSAPP_TAB_TEMPLATES_TESTID));
    const error = screen.getByTestId(WHATSAPP_TEMPLATES_ERROR_TESTID);
    expect(error.textContent).toContain(WHATSAPP_TABS_TEXTS.templatesError);
    expect(error.textContent).toContain(errorMessage('unauthorized'));
    expect(screen.queryByTestId(WHATSAPP_TEMPLATES_PANEL_TESTID)).toBeNull();
    refreshMock.mockClear();
    await user.click(screen.getByTestId(WHATSAPP_TEMPLATES_RETRY_TESTID));
    expect(refreshMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId(WHATSAPP_TAB_VARIABLES_TESTID));
    expect(screen.getByTestId(WHATSAPP_VARIABLES_PANEL_TESTID)).toBeTruthy();
    expect(screen.queryByTestId(WHATSAPP_DICTIONARY_ERROR_TESTID)).toBeNull();
  });

  it('QC-243 R6: si falla el diccionario, «Variables» muestra el error con reintento y Conexión y Plantillas siguen', async () => {
    const user = setupUser();
    conConexion();
    listDictionaryMock.mockResolvedValue({
      status: 'error',
      code: 'unauthorized',
      message: errorMessage('unauthorized'),
    });
    render(await WhatsappIntegrationPage());

    expect(
      within(screen.getByTestId(WHATSAPP_CONNECTION_PANEL_TESTID)).getByTestId(
        WHATSAPP_CONNECTION_CARD_TESTID,
      ),
    ).toBeTruthy();

    await user.click(screen.getByTestId(WHATSAPP_TAB_VARIABLES_TESTID));
    const error = screen.getByTestId(WHATSAPP_DICTIONARY_ERROR_TESTID);
    expect(error.textContent).toContain(WHATSAPP_TABS_TEXTS.dictionaryError);
    expect(error.textContent).toContain(errorMessage('unauthorized'));
    expect(screen.getByTestId(WHATSAPP_DICTIONARY_RETRY_TESTID)).toBeTruthy();
    expect(screen.queryByTestId(WHATSAPP_VARIABLES_PANEL_TESTID)).toBeNull();

    await user.click(screen.getByTestId(WHATSAPP_TAB_TEMPLATES_TESTID));
    expect(screen.getByTestId(WHATSAPP_TEMPLATES_PANEL_TESTID)).toHaveAttribute('data-count', '1');
    expect(screen.queryByTestId(WHATSAPP_TEMPLATES_ERROR_TESTID)).toBeNull();
  });

  it('QC-243 R6: si falla la consulta de la conexion, «Variables» sigue funcionando', async () => {
    const user = setupUser();
    getConnectionMock.mockResolvedValue({
      status: 'error',
      code: 'unauthorized',
      message: errorMessage('unauthorized'),
    });
    render(await WhatsappIntegrationPage());

    expect(listTemplatesMock).not.toHaveBeenCalled();
    await user.click(screen.getByTestId(WHATSAPP_TAB_VARIABLES_TESTID));
    expect(screen.getByTestId(WHATSAPP_VARIABLES_PANEL_TESTID)).toBeTruthy();
  });

  it('R35: las pestañas miden al menos 44 px', async () => {
    render(await WhatsappIntegrationPage());

    for (const testId of [
      WHATSAPP_TAB_CONNECTION_TESTID,
      WHATSAPP_TAB_TEMPLATES_TESTID,
      WHATSAPP_TAB_VARIABLES_TESTID,
    ]) {
      expect(screen.getByTestId(testId).className).toMatch(/(^|\s)min-h-11(\s|$)/);
    }
  });

  it('QC-243 R4, R36: sin conexion, la pestaña «Conexión» muestra la guia y el formulario de alta', async () => {
    render(await WhatsappIntegrationPage());

    const panel = screen.getByTestId(WHATSAPP_CONNECTION_PANEL_TESTID);
    const guia = within(panel).getByTestId(WHATSAPP_SETUP_GUIDE_TESTID);
    for (const paso of WHATSAPP_SETUP_GUIDE_STEPS) expect(guia.textContent).toContain(paso);
    expect(within(panel).getByTestId(WHATSAPP_CONNECTION_FORM_TESTID)).toHaveAttribute(
      'data-mode',
      'create',
    );
    for (const testId of Object.values(WHATSAPP_FIELD_TESTIDS)) {
      expect(within(panel).getByTestId(testId)).toBeTruthy();
    }
    expect(screen.queryByTestId(WHATSAPP_CONNECTION_CARD_TESTID)).toBeNull();
  });

  it('R49: la guia incluye un paso que pide suscribir messages, message_template_status_update y template_category_update', async () => {
    render(await WhatsappIntegrationPage());

    const guia = screen.getByTestId(WHATSAPP_SETUP_GUIDE_TESTID);
    const pasos = within(guia)
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    const campos = ['messages', 'message_template_status_update', 'template_category_update'];
    const paso = pasos.find((texto) => campos.every((campo) => texto.includes(campo)));

    expect(paso).toBeDefined();
    expect(pasos).toHaveLength(WHATSAPP_SETUP_GUIDE_STEPS.length);
  });

  it('QC-243 R4, R37: con conexion, muestra la tarjeta, el panel del webhook y las acciones, sin formulario de alta', async () => {
    getConnectionMock.mockResolvedValue({
      status: 'success',
      data: vista({ status: 'ERROR', lastError: 'Token caducado' }),
      webhook: WEBHOOK,
    });

    render(await WhatsappIntegrationPage());

    const panel = screen.getByTestId(WHATSAPP_CONNECTION_PANEL_TESTID);
    expect(within(panel).getByTestId(WHATSAPP_CONNECTION_CARD_TESTID)).toBeTruthy();
    expect(within(panel).getByTestId(WHATSAPP_CONNECTION_STATUS_TESTID).textContent).toBe(
      'ErrorToken caducado',
    );
    expect(within(panel).getByTestId(WHATSAPP_WEBHOOK_PANEL_TESTID)).toBeTruthy();
    expect((within(panel).getByTestId(WHATSAPP_WEBHOOK_URL_TESTID) as HTMLInputElement).value).toBe(
      WEBHOOK.url,
    );
    expect(within(panel).getByTestId(WHATSAPP_CONNECTION_ACTIONS_TESTID)).toBeTruthy();
    expect(screen.queryByTestId(WHATSAPP_CONNECTION_FORM_TESTID)).toBeNull();
    expect(screen.queryByTestId(WHATSAPP_SETUP_GUIDE_TESTID)).toBeNull();
  });

  it('R37: si la consulta falla, muestra el mensaje del catalogo dentro de la pestaña', async () => {
    getConnectionMock.mockResolvedValue({
      status: 'error',
      code: 'unauthorized',
      message: errorMessage('unauthorized'),
    });

    render(await WhatsappIntegrationPage());

    const panel = screen.getByTestId(WHATSAPP_CONNECTION_PANEL_TESTID);
    expect(within(panel).getByRole('alert').textContent).toContain(errorMessage('unauthorized'));
    expect(screen.queryByTestId(WHATSAPP_CONNECTION_FORM_TESTID)).toBeNull();
    expect(screen.queryByTestId(WHATSAPP_CONNECTION_CARD_TESTID)).toBeNull();
  });

  it('R16: ni el HTML ni las props de la pagina contienen un verify token', async () => {
    getConnectionMock.mockResolvedValue({ status: 'success', data: vista(), webhook: WEBHOOK });

    const arbol = await WhatsappIntegrationPage();
    const claves = new Set<string>();
    const textos: string[] = [];
    recorrerProps(arbol, claves, textos);

    expect([...claves].filter((clave) => /token|secret|hash|enc$/i.test(clave))).toEqual([]);
    expect(textos.join('\n')).not.toContain(TOKEN_DE_ALTA);

    const { container } = render(arbol);
    expect(screen.queryByTestId(WHATSAPP_VERIFY_TOKEN_NOTICE_TESTID)).toBeNull();
    expect(screen.queryByTestId(WHATSAPP_VERIFY_TOKEN_TESTID)).toBeNull();
    expect(container.innerHTML).not.toContain(TOKEN_DE_ALTA);
    expect(fuenteDeLaPagina()).not.toMatch(/verifyToken/);
  });
});
