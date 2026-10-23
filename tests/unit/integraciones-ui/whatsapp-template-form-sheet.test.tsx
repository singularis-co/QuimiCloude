// El alta de plantilla (nueva y duplicar): campos, menú de insertar variable, validación del
// dominio, vista previa, confirmación, envío y pestañas en teléfono. La acción de QC-242 se
// simula por su ruta exacta.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WA_BUBBLE_TESTID, WA_BUBBLE_VARIABLE_TESTID } from '@/app/(private)/integraciones/whatsapp/components/wa-bubble';
import {
  WHATSAPP_TEMPLATE_CONFIRM_DIALOG_TESTID,
  WHATSAPP_TEMPLATE_CONFIRM_DISMISS_TESTID,
  WHATSAPP_TEMPLATE_CONFIRM_MESSAGE_TESTID,
  WHATSAPP_TEMPLATE_CONFIRM_SUBMIT_TESTID,
  WHATSAPP_TEMPLATE_CONFIRM_SUMMARY_TESTID,
  WHATSAPP_TEMPLATE_FORM_BODY_COUNT_TESTID,
  WHATSAPP_TEMPLATE_FORM_BODY_ERROR_TESTID,
  WHATSAPP_TEMPLATE_FORM_BODY_TESTID,
  WHATSAPP_TEMPLATE_FORM_CATEGORY_HINT_TESTID,
  WHATSAPP_TEMPLATE_FORM_CATEGORY_OPTION_TESTID,
  WHATSAPP_TEMPLATE_FORM_CATEGORY_TESTID,
  WHATSAPP_TEMPLATE_FORM_DESCRIPTION_TESTID,
  WHATSAPP_TEMPLATE_FORM_DROPPED_TESTID,
  WHATSAPP_TEMPLATE_FORM_ERROR_TESTID,
  WHATSAPP_TEMPLATE_FORM_FOOTER_COUNT_TESTID,
  WHATSAPP_TEMPLATE_FORM_FOOTER_HINT_TESTID,
  WHATSAPP_TEMPLATE_FORM_FOOTER_TESTID,
  WHATSAPP_TEMPLATE_FORM_LANGUAGE_GROUP_TESTID,
  WHATSAPP_TEMPLATE_FORM_LANGUAGE_HINT_TESTID,
  WHATSAPP_TEMPLATE_FORM_LANGUAGE_OPTION_TESTID,
  WHATSAPP_TEMPLATE_FORM_LANGUAGE_TESTID,
  WHATSAPP_TEMPLATE_FORM_NAME_ERROR_TESTID,
  WHATSAPP_TEMPLATE_FORM_NAME_HINT_TESTID,
  WHATSAPP_TEMPLATE_FORM_NAME_TESTID,
  WHATSAPP_TEMPLATE_FORM_SHEET_TESTID,
  WHATSAPP_TEMPLATE_FORM_SUBMIT_TESTID,
  WHATSAPP_TEMPLATE_FORM_TAB_TESTID,
  WHATSAPP_TEMPLATE_FORM_TABS_TESTID,
  WHATSAPP_TEMPLATE_FORM_TEXTS,
  WHATSAPP_TEMPLATE_FORM_TITLE_TESTID,
  WHATSAPP_TEMPLATE_FORM_USED_ITEM_TESTID,
  WHATSAPP_TEMPLATE_FORM_USED_TESTID,
  WhatsappTemplateFormSheet,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-form-sheet';
import { WHATSAPP_TEMPLATE_STATUS_TESTID } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-status';
import {
  WHATSAPP_TEMPLATE_ACTION_TESTIDS,
  WHATSAPP_TEMPLATE_ACTIONS_TESTID,
  WHATSAPP_TEMPLATE_NEW_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-table';
import {
  WHATSAPP_VARIABLE_MENU_GROUP_TESTID,
  WHATSAPP_VARIABLE_MENU_HINT_TESTID,
  WHATSAPP_VARIABLE_MENU_ITEM_TESTID,
  WHATSAPP_VARIABLE_MENU_NEW_TESTID,
  WHATSAPP_VARIABLE_MENU_TEXTS,
  WHATSAPP_VARIABLE_MENU_TRIGGER_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-variable-menu';
import { WhatsappTemplatesPanel } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-templates-panel';
import {
  WHATSAPP_VARIABLE_KEY_TESTID,
  WHATSAPP_VARIABLE_LABEL_TESTID,
  WHATSAPP_VARIABLE_SAVE_TESTID,
  WHATSAPP_VARIABLE_SHEET_TESTID,
  WHATSAPP_VARIABLE_TITLE_TESTID,
  WHATSAPP_VARIABLE_VALUE_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-variable-form-sheet';
import { errorMessage, type ErrorState } from '@/lib/modules/errores';
import {
  TEMPLATE_LIMITS,
  validateKeyedTemplateDraft,
  WHATSAPP_TEMPLATE_LANGUAGES,
  type WhatsappDictionaryEntryView,
  type WhatsappTemplateView,
} from '@/lib/modules/integraciones';
import type { WhatsappTemplateCreateResult } from '@/lib/modules/integraciones/adapters/driving/whatsapp-template-actions';
import type { WhatsappVariableKeyResult } from '@/lib/modules/integraciones/adapters/driving/whatsapp-variable-key-actions';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';
import { NARROW_VIEWPORT, resetViewport, setViewportWidth, WIDE_VIEWPORT } from '../../helpers/viewport';

type User = ReturnType<typeof setupUser>;

const { createMock, createVariableMock, otherActionMock, toastSuccessMock, toastErrorMock, refreshMock } = vi.hoisted(() => ({
  createMock: vi.fn<(draft: unknown) => Promise<WhatsappTemplateCreateResult>>(),
  createVariableMock: vi.fn<(input: unknown) => Promise<WhatsappVariableKeyResult>>(),
  otherActionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-template-actions', () => ({
  listWhatsappTemplatesAction: otherActionMock,
  createWhatsappTemplateAction: createMock,
  relateWhatsappTemplateVariablesAction: otherActionMock,
  syncWhatsappTemplatesAction: otherActionMock,
  setWhatsappTemplateEnabledAction: otherActionMock,
  deleteWhatsappTemplateAction: otherActionMock,
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-variable-key-actions', () => ({
  createWhatsappVariableKeyAction: createVariableMock,
  updateWhatsappVariableKeyAction: otherActionMock,
  deleteWhatsappVariableKeyAction: otherActionMock,
}));

vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: { success: toastSuccessMock, error: toastErrorMock, dismiss: vi.fn() },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), replace: vi.fn() }),
}));

const PROPIAS: WhatsappDictionaryEntryView[] = [
  { id: 'v1', key: 'numero_de_cuenta', label: 'Número de cuenta', value: '2200345678', usedBy: 0 },
];

function plantilla(overrides: Partial<WhatsappTemplateView> & Pick<WhatsappTemplateView, 'id' | 'name'>): WhatsappTemplateView {
  return {
    language: 'es',
    category: 'UTILITY',
    status: 'APPROVED',
    statusRaw: null,
    rejectedReason: null,
    content: { header: null, body: { text: 'Gracias por tu compra.', examples: [] }, footer: null, buttons: [] },
    lastSyncedAt: '2026-10-22T09:14:00.000Z',
    createdAt: '2026-10-01T10:00:00.000Z',
    mappingStatus: 'MAPPED',
    enabled: false,
    variables: [],
    ...overrides,
  };
}

// Relacionada a medias: {{1}} a una constante, {{2}} sin relacionar; con encabezado y un botón.
const CON_PARTES = plantilla({
  id: 't1',
  name: 'promo_octubre',
  language: 'es_EC',
  category: 'MARKETING',
  mappingStatus: 'UNMAPPED',
  content: {
    header: { text: 'Promoción', example: null },
    body: { text: 'Hola {{cliente.nombre}}, usa el código {{2}}.', examples: [] },
    footer: 'Hasta agotar stock',
    buttons: [{ type: 'QUICK_REPLY', text: 'Ver más' }],
  },
  variables: [
    { slot: 'body.1', position: 1, kind: 'system', key: 'cliente.nombre', label: 'Nombre del cliente' },
    { slot: 'body.2', position: 2, kind: null, key: null, label: null },
  ],
});

const SIN_PARTES = plantilla({
  id: 't2',
  name: 'pedido_listo',
  content: {
    header: null,
    body: { text: 'Tu pedido está listo. Cuenta: {{numero_de_cuenta}}', examples: [] },
    footer: null,
    buttons: [],
  },
  variables: [{ slot: 'body.1', position: 1, kind: 'company', key: 'numero_de_cuenta', label: 'Número de cuenta' }],
});

const CREADA = plantilla({
  id: 'nueva',
  name: 'pedido_en_camino',
  status: 'PENDING',
  content: {
    header: null,
    body: { text: 'Hola {{cliente.nombre}}, tu pedido va en camino.', examples: [] },
    footer: null,
    buttons: [],
  },
  variables: [{ slot: 'body.1', position: 1, kind: 'system', key: 'cliente.nombre', label: 'Nombre del cliente' }],
});

const FALLO: ErrorState = {
  status: 'error',
  code: 'whatsapp_meta_unreachable',
  message: errorMessage('whatsapp_meta_unreachable'),
};

type RenderOptions = {
  readonly source?: WhatsappTemplateView | null;
  readonly dictionary?: readonly WhatsappDictionaryEntryView[];
  readonly onCreateVariable?: () => void;
};

function renderSheet({ source = null, dictionary = PROPIAS, onCreateVariable }: RenderOptions = {}) {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(
    <WhatsappTemplateFormSheet
      source={source}
      dictionary={dictionary}
      onClose={onClose}
      onCreated={onCreated}
      onCreateVariable={onCreateVariable}
    />,
  );
  return { onClose, onCreated };
}

const nombre = () => screen.getByTestId(WHATSAPP_TEMPLATE_FORM_NAME_TESTID) as HTMLInputElement;
const mensaje = () => screen.getByTestId(WHATSAPP_TEMPLATE_FORM_BODY_TESTID) as HTMLTextAreaElement;
const pie = () => screen.getByTestId(WHATSAPP_TEMPLATE_FORM_FOOTER_TESTID) as HTMLInputElement;
const enviarARevision = () => screen.getByTestId(WHATSAPP_TEMPLATE_FORM_SUBMIT_TESTID);

// `paste` y no `type`: `user-event` lee `{` como inicio de una tecla.
async function escribir(user: User, campo: HTMLElement, texto: string) {
  await user.click(campo);
  await user.paste(texto);
}

async function rellenar(user: User, name: string, body: string) {
  await escribir(user, nombre(), name);
  await escribir(user, mensaje(), body);
}

async function elegirOpcion(user: User, triggerTestId: string, optionTestId: string, value: string) {
  await user.click(screen.getByTestId(triggerTestId));
  const options = await screen.findAllByTestId(optionTestId);
  const option = options.find((candidate) => candidate.getAttribute('data-value') === value);
  if (option === undefined) throw new Error(`No hay opción ${value}`);
  await user.click(await esperarInteractiva(option));
}

async function insertar(user: User, key: string) {
  await user.click(screen.getByTestId(WHATSAPP_VARIABLE_MENU_TRIGGER_TESTID));
  await user.click(await esperarInteractiva(await screen.findByTestId(WHATSAPP_VARIABLE_MENU_ITEM_TESTID(key))));
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const BORRADOR_VALIDO = {
  name: 'pedido_en_camino',
  body: 'Hola {{nombre_del_cliente}}, tu cuenta es {{numero_de_cuenta}}.',
};

beforeEach(() => {
  vi.clearAllMocks();
  setViewportWidth(WIDE_VIEWPORT);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('alta de plantilla', () => {
  it('R21: abre «Nueva plantilla» con su texto, los cinco campos y la vista previa, sin encabezado ni botones', () => {
    renderSheet();
    const sheet = screen.getByTestId(WHATSAPP_TEMPLATE_FORM_SHEET_TESTID);
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_TITLE_TESTID)).toHaveTextContent('Nueva plantilla');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_DESCRIPTION_TESTID)).toHaveTextContent(
      'Cada plantilla pasa por autorización antes de poder usarla. Suele tardar unas horas.',
    );
    expect(nombre()).toBeInTheDocument();
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_LANGUAGE_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_CATEGORY_TESTID)).toBeInTheDocument();
    expect(mensaje()).toBeInTheDocument();
    expect(pie()).toBeInTheDocument();
    expect(within(sheet).getByTestId(WA_BUBBLE_TESTID)).toBeInTheDocument();

    expect(within(sheet).queryByText(/encabezado/i)).toBeNull();
    expect(within(sheet).queryByText(/bot[oó]n/i)).toBeNull();
    expect(within(sheet).getAllByRole('textbox')).toHaveLength(3);
  });

  it('R22: la ayuda del nombre y, con otro carácter, el error en su lugar', async () => {
    const user = setupUser();
    renderSheet();
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_NAME_HINT_TESTID)).toHaveTextContent(
      'Solo minúsculas, números y guion bajo (_). Ejemplo: pedido_listo.',
    );

    await user.type(nombre(), 'Pedido listo');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_NAME_ERROR_TESTID)).toHaveTextContent(
      'Usa solo minúsculas, números y guion bajo (_), sin espacios ni tildes.',
    );
    expect(screen.queryByTestId(WHATSAPP_TEMPLATE_FORM_NAME_HINT_TESTID)).toBeNull();
    expect(nombre()).toHaveAttribute('aria-invalid', 'true');

    await user.clear(nombre());
    await user.type(nombre(), 'pedido_listo');
    expect(screen.queryByTestId(WHATSAPP_TEMPLATE_FORM_NAME_ERROR_TESTID)).toBeNull();
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_NAME_HINT_TESTID)).toBeInTheDocument();
  });

  it('R22: las demás reglas del nombre son las del dominio (vacío tras escribir)', async () => {
    const user = setupUser();
    renderSheet();
    await user.type(nombre(), 'a');
    await user.clear(nombre());
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_NAME_ERROR_TESTID)).toHaveTextContent('El nombre es obligatorio.');
  });

  it('R23: abre con Español (es), Utilidad y nombre, mensaje y pie vacíos', () => {
    renderSheet();
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_LANGUAGE_TESTID)).toHaveTextContent('Español (es)');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_CATEGORY_TESTID)).toHaveTextContent('Utilidad');
    expect(nombre()).toHaveValue('');
    expect(mensaje()).toHaveValue('');
    expect(pie()).toHaveValue('');
  });

  it('R24: Idioma ofrece solo es, es_* y en, en_US, en_GB, agrupados y con nombre y código, y su ayuda', async () => {
    const user = setupUser();
    renderSheet();
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_LANGUAGE_HINT_TESTID)).toHaveTextContent(
      'El idioma del texto: español o inglés.',
    );

    await user.click(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_LANGUAGE_TESTID));
    const options = await screen.findAllByTestId(WHATSAPP_TEMPLATE_FORM_LANGUAGE_OPTION_TESTID);
    const codes = options.map((option) => option.getAttribute('data-value'));
    const esperados = WHATSAPP_TEMPLATE_LANGUAGES.filter(
      (code) => code === 'es' || code.startsWith('es_') || ['en', 'en_US', 'en_GB'].includes(code),
    );
    expect([...codes].sort()).toEqual([...esperados].sort());
    expect(codes).not.toContain('pt_BR');
    expect(codes).not.toContain('en_AU');

    const spanish = screen.getByTestId(WHATSAPP_TEMPLATE_FORM_LANGUAGE_GROUP_TESTID('es'));
    const english = screen.getByTestId(WHATSAPP_TEMPLATE_FORM_LANGUAGE_GROUP_TESTID('en'));
    expect(spanish).toHaveTextContent(/^Español/);
    expect(english).toHaveTextContent(/^Inglés/);
    expect(within(spanish).getAllByTestId(WHATSAPP_TEMPLATE_FORM_LANGUAGE_OPTION_TESTID).every((o) => /^es(_|$)/.test(o.getAttribute('data-value') ?? ''))).toBe(true);
    expect(within(english).getAllByTestId(WHATSAPP_TEMPLATE_FORM_LANGUAGE_OPTION_TESTID).map((o) => o.textContent)).toEqual([
      'Inglés (en)',
      'Inglés · Reino Unido (en_GB)',
      'Inglés · Estados Unidos (en_US)',
    ]);
    expect(options.find((o) => o.getAttribute('data-value') === 'es_EC')).toHaveTextContent('Español · Ecuador (es_EC)');

    await user.click(await esperarInteractiva(options.find((o) => o.getAttribute('data-value') === 'en_US') as HTMLElement));
    await waitFor(() =>
      expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_LANGUAGE_TESTID)).toHaveTextContent('Inglés · Estados Unidos (en_US)'),
    );
  });

  it('R25: Categoría es un desplegable con Utilidad y Marketing y su descripción; elegida, solo su nombre y la descripción debajo', async () => {
    const user = setupUser();
    renderSheet();
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_CATEGORY_HINT_TESTID)).toHaveTextContent(
      'Avisos sobre un pedido o una cuenta: confirmaciones, estados, recordatorios.',
    );

    await user.click(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_CATEGORY_TESTID));
    const options = await screen.findAllByTestId(WHATSAPP_TEMPLATE_FORM_CATEGORY_OPTION_TESTID);
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Utilidad');
    expect(options[0]).toHaveTextContent('Avisos sobre un pedido o una cuenta: confirmaciones, estados, recordatorios.');
    expect(options[1]).toHaveTextContent('Marketing');
    expect(options[1]).toHaveTextContent('Promociones y novedades. Tiene un costo de envío distinto.');

    await user.click(await esperarInteractiva(options[1] as HTMLElement));
    const trigger = screen.getByTestId(WHATSAPP_TEMPLATE_FORM_CATEGORY_TESTID);
    await waitFor(() => expect(trigger).toHaveTextContent('Marketing'));
    expect(trigger).not.toHaveTextContent('Promociones');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_CATEGORY_HINT_TESTID)).toHaveTextContent(
      'Promociones y novedades. Tiene un costo de envío distinto.',
    );
  });

  it('R26: contadores de Mensaje y Pie sobre el texto con las variables numeradas, en color de error al pasarse', async () => {
    const user = setupUser();
    renderSheet();
    const bodyCount = screen.getByTestId(WHATSAPP_TEMPLATE_FORM_BODY_COUNT_TESTID);
    const footerCount = screen.getByTestId(WHATSAPP_TEMPLATE_FORM_FOOTER_COUNT_TESTID);
    expect(bodyCount).toHaveTextContent(`0 / ${TEMPLATE_LIMITS.bodyMaxLength}`);
    expect(footerCount).toHaveTextContent(`0 / ${TEMPLATE_LIMITS.footerMaxLength}`);
    expect(screen.getByText(WHATSAPP_TEMPLATE_FORM_TEXTS.optional)).toBeInTheDocument();
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_FOOTER_HINT_TESTID)).toHaveTextContent(
      'Texto gris al final del mensaje. Sin variables.',
    );

    await escribir(user, mensaje(), 'Hola {{nombre_del_cliente}}');
    expect(bodyCount).toHaveTextContent('10 / 1024');
    expect(bodyCount).toHaveAttribute('data-over', 'false');

    await escribir(user, pie(), 'x'.repeat(61));
    expect(footerCount).toHaveTextContent('61 / 60');
    expect(footerCount).toHaveAttribute('data-over', 'true');
    expect(footerCount).toHaveClass('text-destructive');
  });

  it('R27: «Insertar variable» abre los dos grupos con etiqueta y clave, «Nueva variable propia» y la ayuda junto al botón', async () => {
    const user = setupUser();
    renderSheet();
    expect(screen.getByTestId(WHATSAPP_VARIABLE_MENU_HINT_TESTID)).toHaveTextContent('Se escribe como {{clave}}.');

    await user.click(screen.getByTestId(WHATSAPP_VARIABLE_MENU_TRIGGER_TESTID));
    const system = await screen.findByTestId(WHATSAPP_VARIABLE_MENU_GROUP_TESTID('system'));
    expect(system).toHaveTextContent('Constantes del sistema');
    for (const [label, key] of [
      ['Nombre del cliente', 'nombre_del_cliente'],
      ['Número de pedido', 'numero_de_pedido'],
      ['Nombre de la empresa', 'nombre_de_la_empresa'],
    ]) {
      const item = within(system).getByTestId(WHATSAPP_VARIABLE_MENU_ITEM_TESTID(key));
      expect(item).toHaveTextContent(label);
      expect(item).toHaveTextContent(key);
    }
    const own = screen.getByTestId(WHATSAPP_VARIABLE_MENU_GROUP_TESTID('company'));
    expect(own).toHaveTextContent('Variables propias');
    expect(within(own).getByTestId(WHATSAPP_VARIABLE_MENU_ITEM_TESTID('numero_de_cuenta'))).toHaveTextContent(
      'Número de cuentanumero_de_cuenta',
    );
    expect(screen.getByTestId(WHATSAPP_VARIABLE_MENU_NEW_TESTID)).toHaveTextContent('Nueva variable propia');
    expect(screen.queryByText('Constante')).toBeNull();
    expect(screen.queryByText('Propia')).toBeNull();
  });

  it('R27: elegir un dato inserta {{clave}} en la posición del cursor', async () => {
    const user = setupUser();
    renderSheet();
    await escribir(user, mensaje(), 'Hola , bienvenido');
    await user.pointer({ target: mensaje(), offset: 5, keys: '[MouseLeft]' });

    await insertar(user, 'nombre_del_cliente');
    expect(mensaje()).toHaveValue('Hola {{nombre_del_cliente}}, bienvenido');

    await insertar(user, 'numero_de_cuenta');
    expect(mensaje()).toHaveValue('Hola {{nombre_del_cliente}}{{numero_de_cuenta}}, bienvenido');
  });

  it('R27: sin cursor en el Mensaje, inserta al final', async () => {
    const user = setupUser();
    renderSheet({ source: SIN_PARTES });
    await insertar(user, 'numero_de_pedido');
    expect(mensaje()).toHaveValue('Tu pedido está listo. Cuenta: {{numero_de_cuenta}}{{numero_de_pedido}}');
  });

  it('R27: «Nueva variable propia» llama al formulario de variable y el borrador sigue', async () => {
    const user = setupUser();
    const onCreateVariable = vi.fn();
    renderSheet({ onCreateVariable });
    await rellenar(user, BORRADOR_VALIDO.name, BORRADOR_VALIDO.body);

    await user.click(screen.getByTestId(WHATSAPP_VARIABLE_MENU_TRIGGER_TESTID));
    await user.click(await esperarInteractiva(await screen.findByTestId(WHATSAPP_VARIABLE_MENU_NEW_TESTID)));

    expect(onCreateVariable).toHaveBeenCalledTimes(1);
    expect(nombre()).toHaveValue(BORRADOR_VALIDO.name);
    expect(mensaje()).toHaveValue(BORRADOR_VALIDO.body);
  });

  it('R29: «Variables en el mensaje» lista cada variable del diccionario una vez y por orden de aparición', async () => {
    const user = setupUser();
    renderSheet();
    expect(screen.queryByTestId(WHATSAPP_TEMPLATE_FORM_USED_TESTID)).toBeNull();

    await escribir(user, mensaje(), 'Cuenta {{numero_de_cuenta}} para {{nombre_del_cliente}}; otra vez {{numero_de_cuenta}}.');
    const used = screen.getByTestId(WHATSAPP_TEMPLATE_FORM_USED_TESTID);
    expect(used).toHaveTextContent('Variables en el mensaje');
    expect(within(used).getAllByTestId(WHATSAPP_TEMPLATE_FORM_USED_ITEM_TESTID).map((item) => item.textContent)).toEqual([
      '{{numero_de_cuenta}}Número de cuenta',
      '{{nombre_del_cliente}}Nombre del cliente',
    ]);
    expect(
      within(screen.getByTestId(WA_BUBBLE_TESTID)).getAllByTestId(WA_BUBBLE_VARIABLE_TESTID).map((v) => v.textContent),
    ).toEqual(['2200345678', 'Nombre del cliente', '2200345678']);
  });

  it('R30: un {{1}} o una clave inventada muestran el aviso y no dejan enviar', async () => {
    const user = setupUser();
    renderSheet();
    await rellenar(user, 'pedido_listo', 'Hola {{1}}');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_BODY_ERROR_TESTID)).toHaveTextContent(
      'La variable 1 no está en el diccionario. Elígela con «Insertar variable» o créala como variable propia.',
    );
    expect(enviarARevision()).toBeDisabled();

    await user.clear(mensaje());
    await escribir(user, mensaje(), 'Hola {{inventada}}');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_BODY_ERROR_TESTID)).toHaveTextContent(
      'La variable inventada no está en el diccionario.',
    );
    expect(enviarARevision()).toBeDisabled();
  });

  it('R31: «Enviar a revisión» deshabilitado sin Mensaje y habilitado con un borrador válido', async () => {
    const user = setupUser();
    renderSheet();
    expect(enviarARevision()).toBeDisabled();
    await escribir(user, nombre(), BORRADOR_VALIDO.name);
    expect(enviarARevision()).toBeDisabled();
    await escribir(user, mensaje(), BORRADOR_VALIDO.body);
    expect(enviarARevision()).toBeEnabled();
  });

  it('R31: un problema del dominio sale en su campo y deshabilita el envío', async () => {
    const user = setupUser();
    renderSheet();
    const largo = `Hola {{nombre_del_cliente}} ${'x'.repeat(TEMPLATE_LIMITS.bodyMaxLength)}`;
    const esperado = validateKeyedTemplateDraft(
      {
        name: 'pedido_listo',
        language: 'es',
        category: 'UTILITY',
        header: null,
        body: { text: `Hola {{cliente.nombre}} ${'x'.repeat(TEMPLATE_LIMITS.bodyMaxLength)}` },
        footer: null,
        buttons: [],
        constantLabels: { 'cliente.nombre': 'Nombre del cliente' },
      },
      PROPIAS,
    );
    if (esperado.ok) throw new Error('el borrador debía ser inválido');
    const issue = esperado.issues.find((candidate) => candidate.field === 'body.text');

    await rellenar(user, 'pedido_listo', largo);
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_BODY_ERROR_TESTID)).toHaveTextContent(issue?.message ?? '');
    expect(mensaje()).toHaveAttribute('aria-invalid', 'true');
    expect(enviarARevision()).toBeDisabled();
  });

  it('R33: «Enviar a revisión» abre la confirmación con sus textos y «Volver a revisar» la cierra sin enviar', async () => {
    const user = setupUser();
    renderSheet();
    await rellenar(user, BORRADOR_VALIDO.name, BORRADOR_VALIDO.body);
    await user.click(enviarARevision());

    const dialog = await screen.findByTestId(WHATSAPP_TEMPLATE_CONFIRM_DIALOG_TESTID);
    expect(dialog).toHaveTextContent('Enviar para autorización');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_CONFIRM_MESSAGE_TESTID)).toHaveTextContent(
      'La plantilla pedido_en_camino se va a enviar para autorización. No se puede cambiar mientras está en autorización; si hace falta otro texto, se duplica.',
    );
    const summary = screen.getByTestId(WHATSAPP_TEMPLATE_CONFIRM_SUMMARY_TESTID);
    expect(summary).toHaveTextContent('Idiomaes');
    expect(summary).toHaveTextContent('CategoríaUtilidad');
    expect(summary).toHaveTextContent('VariablesNombre del cliente, Número de cuenta');
    expect(summary).toHaveTextContent('Revisa el mensaje en la vista previa antes de enviarlo.');

    await user.click(screen.getByTestId(WHATSAPP_TEMPLATE_CONFIRM_DISMISS_TESTID));
    await waitFor(() => expect(screen.queryByTestId(WHATSAPP_TEMPLATE_CONFIRM_DIALOG_TESTID)).toBeNull());
    expect(createMock).not.toHaveBeenCalled();
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_SHEET_TESTID)).toBeInTheDocument();
  });

  it('R33: sin variables, la confirmación dice «Ninguna»', async () => {
    const user = setupUser();
    renderSheet();
    await rellenar(user, 'aviso_simple', 'Tu pedido está listo.');
    await user.click(enviarARevision());
    expect(await screen.findByTestId(WHATSAPP_TEMPLATE_CONFIRM_SUMMARY_TESTID)).toHaveTextContent('VariablesNinguna');
  });

  it('R34: «Enviar» llama a la acción con el borrador exacto y, mientras responde, el botón está deshabilitado y cargando', async () => {
    const pendiente = deferred<WhatsappTemplateCreateResult>();
    createMock.mockReturnValue(pendiente.promise);
    const user = setupUser();
    renderSheet();
    await rellenar(user, BORRADOR_VALIDO.name, BORRADOR_VALIDO.body);
    await user.click(enviarARevision());
    await user.click(await screen.findByTestId(WHATSAPP_TEMPLATE_CONFIRM_SUBMIT_TESTID));

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      name: 'pedido_en_camino',
      language: 'es',
      category: 'UTILITY',
      header: null,
      body: { text: 'Hola {{cliente.nombre}}, tu cuenta es {{numero_de_cuenta}}.' },
      footer: null,
      buttons: [],
      constantLabels: { 'cliente.nombre': 'Nombre del cliente' },
    });
    const confirm = screen.getByTestId(WHATSAPP_TEMPLATE_CONFIRM_SUBMIT_TESTID);
    await waitFor(() => expect(confirm).toBeDisabled());
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    expect(confirm.querySelector('svg')).not.toBeNull();

    pendiente.resolve({ status: 'success', data: CREADA });
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
  });

  it('R34: con pie y elegidos Marketing y en_US, el borrador los lleva', async () => {
    createMock.mockResolvedValue({ status: 'success', data: CREADA });
    const user = setupUser();
    renderSheet();
    await rellenar(user, 'promo', 'Ofertas de {{nombre_de_la_empresa}}');
    await escribir(user, pie(), 'Responde BAJA para no recibir más');
    await elegirOpcion(user, WHATSAPP_TEMPLATE_FORM_LANGUAGE_TESTID, WHATSAPP_TEMPLATE_FORM_LANGUAGE_OPTION_TESTID, 'en_US');
    await elegirOpcion(user, WHATSAPP_TEMPLATE_FORM_CATEGORY_TESTID, WHATSAPP_TEMPLATE_FORM_CATEGORY_OPTION_TESTID, 'MARKETING');
    await user.click(enviarARevision());
    await user.click(await screen.findByTestId(WHATSAPP_TEMPLATE_CONFIRM_SUBMIT_TESTID));

    expect(createMock).toHaveBeenCalledWith({
      name: 'promo',
      language: 'en_US',
      category: 'MARKETING',
      header: null,
      body: { text: 'Ofertas de {{empresa.nombre}}' },
      footer: 'Responde BAJA para no recibir más',
      buttons: [],
      constantLabels: { 'empresa.nombre': 'Nombre de la empresa' },
    });
  });

  it('R36: si falla, el panel sigue abierto con el borrador intacto y «No se pudo enviar la plantilla» con el mensaje', async () => {
    createMock.mockResolvedValue(FALLO);
    const user = setupUser();
    const { onCreated } = renderSheet();
    await rellenar(user, BORRADOR_VALIDO.name, BORRADOR_VALIDO.body);
    await user.click(enviarARevision());
    await user.click(await screen.findByTestId(WHATSAPP_TEMPLATE_CONFIRM_SUBMIT_TESTID));

    const error = await screen.findByTestId(WHATSAPP_TEMPLATE_FORM_ERROR_TESTID);
    expect(error).toHaveTextContent('No se pudo enviar la plantilla');
    expect(error).toHaveTextContent(FALLO.message);
    await waitFor(() => expect(screen.queryByTestId(WHATSAPP_TEMPLATE_CONFIRM_DIALOG_TESTID)).toBeNull());
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_SHEET_TESTID)).toBeInTheDocument();
    expect(nombre()).toHaveValue(BORRADOR_VALIDO.name);
    expect(mensaje()).toHaveValue(BORRADOR_VALIDO.body);
    expect(onCreated).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('R37: los textos del alta, su confirmación y el menú no nombran a Meta ni a la empresa', () => {
    const textos: string[] = [];
    const recoger = (value: unknown) => {
      if (typeof value === 'string') textos.push(value);
      else if (typeof value === 'function') textos.push(String((value as (...args: unknown[]) => unknown)('x', 1)));
      else if (value !== null && typeof value === 'object') Object.values(value).forEach(recoger);
    };
    recoger(WHATSAPP_TEMPLATE_FORM_TEXTS);
    recoger(WHATSAPP_VARIABLE_MENU_TEXTS);
    expect(textos.length).toBeGreaterThan(20);
    for (const texto of textos) {
      expect(texto).not.toMatch(/\bMeta\b/);
      expect(texto).not.toMatch(/QuimiCloude/);
    }
  });

  it('R38: por debajo de 768 px, a pantalla completa con las pestañas «Formulario | Vista previa»', async () => {
    setViewportWidth(NARROW_VIEWPORT);
    const user = setupUser();
    renderSheet();
    const sheet = screen.getByTestId(WHATSAPP_TEMPLATE_FORM_SHEET_TESTID);
    await waitFor(() => expect(sheet).toHaveAttribute('data-layout', 'tabs'));
    expect(sheet.className).toContain('max-w-none');
    const tabs = screen.getByTestId(WHATSAPP_TEMPLATE_FORM_TABS_TESTID);
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Formulario', 'Vista previa']);
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_TAB_TESTID('form'))).toHaveAttribute('aria-selected', 'true');

    await escribir(user, mensaje(), 'Hola {{nombre_del_cliente}}');
    await user.click(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_TAB_TESTID('preview')));
    expect(screen.getByTestId(WA_BUBBLE_TESTID)).toBeVisible();
    expect(screen.getByTestId(WA_BUBBLE_TESTID)).toHaveTextContent('Hola Nombre del cliente');

    await user.click(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_TAB_TESTID('form')));
    expect(mensaje()).toHaveValue('Hola {{nombre_del_cliente}}');
  });

  it('R38: desde 768 px, formulario y vista previa a la vez, sin pestañas', () => {
    renderSheet();
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_SHEET_TESTID)).toHaveAttribute('data-layout', 'columns');
    expect(screen.queryByTestId(WHATSAPP_TEMPLATE_FORM_TABS_TESTID)).toBeNull();
    expect(mensaje()).toBeVisible();
    expect(screen.getByTestId(WA_BUBBLE_TESTID)).toBeVisible();
  });

  it('R60: campos de 16 px y 44 px de alto', () => {
    renderSheet();
    for (const campo of [nombre(), pie()]) {
      expect(campo).toHaveClass('text-base', 'md:text-base', 'min-h-11');
    }
    expect(mensaje()).toHaveClass('text-base', 'md:text-base');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_LANGUAGE_TESTID)).toHaveClass('min-h-11', 'text-base');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_CATEGORY_TESTID)).toHaveClass('min-h-11', 'text-base');
  });
});

describe('alta desde la pestaña Plantillas', () => {
  function renderPanel(templates: readonly WhatsappTemplateView[] = [SIN_PARTES, CON_PARTES]) {
    return render(
      <WhatsappTemplatesPanel list={{ templates, templatesSyncedAt: null }} dictionary={PROPIAS} />,
    );
  }

  it('R35: con éxito, cierra el panel, avisa y la plantilla nueva sale en el listado como «Pendiente»', async () => {
    createMock.mockResolvedValue({ status: 'success', data: CREADA });
    const user = setupUser();
    renderPanel();
    await user.click(screen.getByTestId(WHATSAPP_TEMPLATE_NEW_TESTID));
    await rellenar(user, 'pedido_en_camino', 'Hola {{nombre_del_cliente}}, tu pedido va en camino.');
    await user.click(enviarARevision());
    await user.click(await screen.findByTestId(WHATSAPP_TEMPLATE_CONFIRM_SUBMIT_TESTID));

    await waitFor(() => expect(screen.queryByTestId(WHATSAPP_TEMPLATE_FORM_SHEET_TESTID)).toBeNull());
    expect(toastSuccessMock).toHaveBeenCalledWith('Plantilla enviada para autorización.');
    const fila = screen.getByTestId('data-table-row-nueva');
    expect(within(fila).getByTestId(WHATSAPP_TEMPLATE_STATUS_TESTID)).toHaveTextContent('Pendiente');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('R28: «Nueva variable propia» abre el panel de variable encima del alta; al guardarla el borrador sigue y la variable está en el menú', async () => {
    createVariableMock.mockResolvedValue({
      status: 'success',
      data: { id: 'v2', key: 'horario_de_atencion', label: 'Horario de atención', value: 'Lunes a viernes', usedBy: 0 },
    });
    const user = setupUser();
    renderPanel();
    await user.click(screen.getByTestId(WHATSAPP_TEMPLATE_NEW_TESTID));
    await rellenar(user, BORRADOR_VALIDO.name, BORRADOR_VALIDO.body);

    await user.click(screen.getByTestId(WHATSAPP_VARIABLE_MENU_TRIGGER_TESTID));
    await user.click(await esperarInteractiva(await screen.findByTestId(WHATSAPP_VARIABLE_MENU_NEW_TESTID)));

    expect(await screen.findByTestId(WHATSAPP_VARIABLE_TITLE_TESTID)).toHaveTextContent('Nueva variable');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_SHEET_TESTID)).toBeInTheDocument();
    await user.type(screen.getByTestId(WHATSAPP_VARIABLE_LABEL_TESTID), 'Horario de atención');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_KEY_TESTID)).toHaveValue('horario_de_atencion');
    await user.type(screen.getByTestId(WHATSAPP_VARIABLE_VALUE_TESTID), 'Lunes a viernes');
    await user.click(screen.getByTestId(WHATSAPP_VARIABLE_SAVE_TESTID));

    await waitFor(() => expect(screen.queryByTestId(WHATSAPP_VARIABLE_SHEET_TESTID)).toBeNull());
    expect(createVariableMock).toHaveBeenCalledWith({
      key: 'horario_de_atencion',
      label: 'Horario de atención',
      value: 'Lunes a viernes',
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Variable creada.');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_SHEET_TESTID)).toBeInTheDocument();
    expect(nombre()).toHaveValue(BORRADOR_VALIDO.name);
    expect(mensaje()).toHaveValue(BORRADOR_VALIDO.body);

    await insertar(user, 'horario_de_atencion');
    expect(mensaje()).toHaveValue(`${BORRADOR_VALIDO.body}{{horario_de_atencion}}`);
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_USED_TESTID)).toHaveTextContent('Horario de atención');
  });

  it('R40: «Duplicar» abre «Duplicar plantilla» con _v2, su idioma, categoría, mensaje con claves de pantalla, pie y el aviso de lo que pierde', async () => {
    const user = setupUser();
    renderPanel();
    await user.click(within(screen.getByTestId('data-table-row-t1')).getByTestId(WHATSAPP_TEMPLATE_ACTIONS_TESTID('t1')));
    await user.click(await esperarInteractiva(await screen.findByTestId(WHATSAPP_TEMPLATE_ACTION_TESTIDS.duplicate)));

    expect(await screen.findByTestId(WHATSAPP_TEMPLATE_FORM_TITLE_TESTID)).toHaveTextContent('Duplicar plantilla');
    expect(nombre()).toHaveValue('promo_octubre_v2');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_LANGUAGE_TESTID)).toHaveTextContent('Español · Ecuador (es_EC)');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_CATEGORY_TESTID)).toHaveTextContent('Marketing');
    expect(mensaje()).toHaveValue('Hola {{nombre_del_cliente}}, usa el código {{2}}.');
    expect(pie()).toHaveValue('Hasta agotar stock');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_DROPPED_TESTID)).toHaveTextContent(
      'La copia no lleva el encabezado ni los botones de la original.',
    );
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_BODY_ERROR_TESTID)).toHaveTextContent(
      'La variable 2 no está en el diccionario.',
    );
    expect(enviarARevision()).toBeDisabled();
  });

  it('R40: duplicar una sin encabezado ni botones no muestra el aviso y deja enviar la copia', async () => {
    const user = setupUser();
    renderSheet({ source: SIN_PARTES });
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_TITLE_TESTID)).toHaveTextContent('Duplicar plantilla');
    expect(nombre()).toHaveValue('pedido_listo_v2');
    expect(mensaje()).toHaveValue('Tu pedido está listo. Cuenta: {{numero_de_cuenta}}');
    expect(screen.queryByTestId(WHATSAPP_TEMPLATE_FORM_DROPPED_TESTID)).toBeNull();
    expect(enviarARevision()).toBeEnabled();
    await user.click(enviarARevision());
    expect(await screen.findByTestId(WHATSAPP_TEMPLATE_CONFIRM_DIALOG_TESTID)).toBeInTheDocument();
  });

  it('R40: duplicar una «No compatible» abre con _v2 e idioma, sin mensaje, y AUTHENTICATION queda en Utilidad', () => {
    renderSheet({
      source: plantilla({ id: 't9', name: 'codigo_otp', language: 'en', category: 'AUTHENTICATION', content: null }),
    });
    expect(nombre()).toHaveValue('codigo_otp_v2');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_LANGUAGE_TESTID)).toHaveTextContent('Inglés (en)');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FORM_CATEGORY_TESTID)).toHaveTextContent('Utilidad');
    expect(mensaje()).toHaveValue('');
    expect(pie()).toHaveValue('');
  });
});
