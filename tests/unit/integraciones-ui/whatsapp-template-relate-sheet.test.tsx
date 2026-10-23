// El panel «Relacionar variables» y su diálogo «Revisa la relación». La acción de QC-242 se simula
// por su ruta exacta.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WA_BUBBLE_BODY_TESTID, WA_BUBBLE_HEADER_TESTID } from '@/app/(private)/integraciones/whatsapp/components/wa-bubble';
import {
  WHATSAPP_RELATE_CANCEL_TESTID,
  WHATSAPP_RELATE_CONFIRM_DIALOG_TESTID,
  WHATSAPP_RELATE_CONFIRM_DISMISS_TESTID,
  WHATSAPP_RELATE_CONFIRM_ERROR_TESTID,
  WHATSAPP_RELATE_CONFIRM_LINE_TESTID,
  WHATSAPP_RELATE_CONFIRM_MESSAGE_TESTID,
  WHATSAPP_RELATE_CONFIRM_SUBMIT_TESTID,
  WHATSAPP_RELATE_HELP_TESTID,
  WHATSAPP_RELATE_MISSING_TESTID,
  WHATSAPP_RELATE_SAVE_TESTID,
  WHATSAPP_RELATE_SELECT_TESTID,
  WHATSAPP_RELATE_SHEET_TESTID,
  WHATSAPP_RELATE_SLOT_MARK_TESTID,
  WHATSAPP_RELATE_TEXT_TESTID,
  WHATSAPP_RELATE_TEXTS,
  WhatsappTemplateRelateSheet,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-relate-sheet';
import { errorMessage, type ErrorState } from '@/lib/modules/errores';
import type { WhatsappDictionaryEntryView, WhatsappTemplateView } from '@/lib/modules/integraciones';
import type { WhatsappTemplateCreateResult } from '@/lib/modules/integraciones/adapters/driving/whatsapp-template-actions';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';
import { NARROW_VIEWPORT, resetViewport, setViewportWidth, WIDE_VIEWPORT } from '../../helpers/viewport';

const { relateMock, otherActionMock, toastSuccessMock } = vi.hoisted(() => ({
  relateMock: vi.fn<(input: unknown) => Promise<WhatsappTemplateCreateResult>>(),
  otherActionMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-template-actions', () => ({
  listWhatsappTemplatesAction: otherActionMock,
  createWhatsappTemplateAction: otherActionMock,
  syncWhatsappTemplatesAction: otherActionMock,
  setWhatsappTemplateEnabledAction: otherActionMock,
  deleteWhatsappTemplateAction: otherActionMock,
  relateWhatsappTemplateVariablesAction: relateMock,
}));

vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: { success: toastSuccessMock, error: vi.fn(), dismiss: vi.fn() },
}));

// Encabezado y botón con su `{{1}}`, un hueco relacionado con una constante, otro con una propia y
// uno sin relacionar.
const PLANTILLA: WhatsappTemplateView = {
  id: 't9',
  name: 'bienvenida_cliente',
  language: 'es',
  category: 'UTILITY',
  status: 'APPROVED',
  statusRaw: null,
  rejectedReason: null,
  content: {
    header: { text: 'Pedido {{1}}', example: null },
    body: { text: 'Hola {{cliente.nombre}}, bienvenido a {{2}}. Paga en {{numero_de_cuenta}}.', examples: [] },
    footer: null,
    buttons: [{ type: 'URL', text: 'Ver pedido', url: 'https://tienda.example/p/{{1}}', example: null }],
  },
  lastSyncedAt: '2026-10-22T09:14:00.000Z',
  createdAt: '2026-10-01T10:00:00.000Z',
  mappingStatus: 'UNMAPPED',
  enabled: false,
  variables: [
    { slot: 'header', position: 1, kind: null, key: null, label: null },
    { slot: 'body.1', position: 1, kind: 'system', key: 'cliente.nombre', label: null },
    { slot: 'body.2', position: 2, kind: null, key: null, label: null },
    { slot: 'body.3', position: 3, kind: 'company', key: 'numero_de_cuenta', label: 'Número de cuenta' },
    { slot: 'button.0', position: 1, kind: null, key: null, label: null },
  ],
};

const PROPIAS: readonly WhatsappDictionaryEntryView[] = [
  { id: 'v1', key: 'numero_de_cuenta', label: 'Número de cuenta', value: '0012-3456', usedBy: 1 },
  { id: 'v2', key: 'horario', label: 'Horario', value: 'De 8 a 17 h', usedBy: 0 },
];

const RELACIONADA: WhatsappTemplateView = { ...PLANTILLA, mappingStatus: 'MAPPED' };

const FALLO: ErrorState = {
  status: 'error',
  code: 'whatsapp_variable_key_not_found',
  message: errorMessage('whatsapp_variable_key_not_found'),
};

function renderSheet(template: WhatsappTemplateView | null = PLANTILLA) {
  const onClose = vi.fn();
  const onRelated = vi.fn();
  render(
    <WhatsappTemplateRelateSheet template={template} dictionary={PROPIAS} onClose={onClose} onRelated={onRelated} />,
  );
  return { onClose, onRelated };
}

async function elegir(user: ReturnType<typeof setupUser>, slot: string, etiqueta: RegExp) {
  await user.click(screen.getByTestId(WHATSAPP_RELATE_SELECT_TESTID(slot)));
  await user.click(await esperarInteractiva(await screen.findByRole('option', { name: etiqueta })));
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
}

async function completar(user: ReturnType<typeof setupUser>) {
  await elegir(user, 'header', /Número de pedido/);
  await elegir(user, 'body.2', /Nombre de la empresa/);
  await elegir(user, 'button.0', /Horario/);
}

const guardar = () => screen.getByTestId(WHATSAPP_RELATE_SAVE_TESTID);

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  setViewportWidth(WIDE_VIEWPORT);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('Relacionar variables', () => {
  it('R42: título, nombre con la frase de ayuda, «Texto de la plantilla» con sus {{n}} y la ayuda final', () => {
    renderSheet();
    const sheet = screen.getByTestId(WHATSAPP_RELATE_SHEET_TESTID);
    expect(within(sheet).getByRole('heading', { name: 'Relacionar variables' })).toBeInTheDocument();
    expect(sheet).toHaveTextContent(
      'bienvenida_cliente · Elige qué dato va en cada hueco. Con todos relacionados puedes habilitarla.',
    );
    const texto = screen.getByTestId(WHATSAPP_RELATE_TEXT_TESTID);
    expect(texto).toHaveTextContent('Pedido {{1}}');
    expect(texto).toHaveTextContent('Hola {{1}}, bienvenido a {{2}}. Paga en {{3}}.');
    expect(texto).toHaveTextContent('https://tienda.example/p/{{1}}');
    expect(screen.getByTestId(WHATSAPP_RELATE_HELP_TESTID)).toHaveTextContent(
      '¿Falta un dato? Créalo en Variables y vuelve aquí.',
    );
  });

  it('R42: marca de cada hueco: {{n}} en el cuerpo, «Encabezado {{1}}» y «Botón 1 {{1}}»', () => {
    renderSheet();
    expect(screen.getByTestId(WHATSAPP_RELATE_SLOT_MARK_TESTID('header'))).toHaveTextContent('Encabezado {{1}}');
    expect(screen.getByTestId(WHATSAPP_RELATE_SLOT_MARK_TESTID('body.1'))).toHaveTextContent(/^\{\{1\}\}$/);
    expect(screen.getByTestId(WHATSAPP_RELATE_SLOT_MARK_TESTID('body.2'))).toHaveTextContent(/^\{\{2\}\}$/);
    expect(screen.getByTestId(WHATSAPP_RELATE_SLOT_MARK_TESTID('body.3'))).toHaveTextContent(/^\{\{3\}\}$/);
    expect(screen.getByTestId(WHATSAPP_RELATE_SLOT_MARK_TESTID('button.0'))).toHaveTextContent('Botón 1 {{1}}');
    expect(screen.getByRole('combobox', { name: 'Dato para el hueco 2' })).toBeInTheDocument();
  });

  it('R42: la relación actual llega elegida, con etiqueta y clave (la constante con su clave de pantalla)', () => {
    renderSheet();
    const constante = screen.getByTestId(WHATSAPP_RELATE_SELECT_TESTID('body.1'));
    expect(constante).toHaveTextContent('Nombre del cliente');
    expect(constante).toHaveTextContent('nombre_del_cliente');
    const propia = screen.getByTestId(WHATSAPP_RELATE_SELECT_TESTID('body.3'));
    expect(propia).toHaveTextContent('Número de cuenta');
    expect(propia).toHaveTextContent('numero_de_cuenta');
    expect(screen.getByTestId(WHATSAPP_RELATE_SELECT_TESTID('body.2'))).toHaveTextContent('Elige un dato…');
  });

  it('R42: el selector agrupa «Constantes del sistema» y «Variables propias», cada dato con etiqueta y clave', async () => {
    const user = setupUser();
    renderSheet();
    await user.click(screen.getByTestId(WHATSAPP_RELATE_SELECT_TESTID('body.2')));
    const lista = await screen.findByRole('listbox');
    const grupos = within(lista).getAllByRole('group');
    expect(grupos).toHaveLength(2);
    expect(grupos[0]).toHaveTextContent('Constantes del sistema');
    expect(within(grupos[0]!).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Nombre del clientenombre_del_cliente',
      'Número de pedidonumero_de_pedido',
      'Nombre de la empresanombre_de_la_empresa',
    ]);
    expect(grupos[1]).toHaveTextContent('Variables propias');
    expect(within(grupos[1]!).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Número de cuentanumero_de_cuenta',
      'Horariohorario',
    ]);
    expect(lista).not.toHaveTextContent(/Constante$|Propia$/);
  });

  it('R43: «Guardar» deshabilitado y un «Falta relacionar el hueco <n>.» por hueco sin dato; con todos, se habilita', async () => {
    const user = setupUser();
    renderSheet();
    expect(guardar()).toBeDisabled();
    expect(screen.getByTestId(WHATSAPP_RELATE_MISSING_TESTID('body.2'))).toHaveTextContent(
      'Falta relacionar el hueco 2.',
    );
    expect(screen.getByTestId(WHATSAPP_RELATE_MISSING_TESTID('header'))).toHaveTextContent(
      'Falta relacionar el hueco Encabezado {{1}}.',
    );
    expect(screen.getByTestId(WHATSAPP_RELATE_MISSING_TESTID('button.0'))).toHaveTextContent(
      'Falta relacionar el hueco Botón 1 {{1}}.',
    );
    expect(screen.queryByTestId(WHATSAPP_RELATE_MISSING_TESTID('body.1'))).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Dato para el hueco 2' })).toHaveAttribute('aria-invalid', 'true');

    await completar(user);

    expect(guardar()).toBeEnabled();
    expect(screen.queryByText(/Falta relacionar el hueco/)).toBeNull();
  });

  it('R44: la vista previa pinta la etiqueta de la constante, el valor de la propia y «[n sin relacionar]»', async () => {
    const user = setupUser();
    renderSheet();
    const cuerpo = screen.getByTestId(WA_BUBBLE_BODY_TESTID);
    expect(cuerpo).toHaveTextContent('Hola Nombre del cliente, bienvenido a [2 sin relacionar]. Paga en 0012-3456.');
    expect(screen.getByTestId(WA_BUBBLE_HEADER_TESTID)).toHaveTextContent('Pedido [1 sin relacionar]');

    await elegir(user, 'body.2', /Horario/);
    await elegir(user, 'header', /Número de pedido/);

    expect(screen.getByTestId(WA_BUBBLE_BODY_TESTID)).toHaveTextContent(
      'Hola Nombre del cliente, bienvenido a De 8 a 17 h. Paga en 0012-3456.',
    );
    expect(screen.getByTestId(WA_BUBBLE_HEADER_TESTID)).toHaveTextContent('Pedido Número de pedido');
  });

  it('R45: «Guardar» abre «Revisa la relación» con el resumen {{n}} → etiqueta y clave por hueco', async () => {
    const user = setupUser();
    renderSheet();
    await completar(user);
    await user.click(guardar());

    const dialogo = await screen.findByTestId(WHATSAPP_RELATE_CONFIRM_DIALOG_TESTID);
    expect(within(dialogo).getByRole('heading', { name: 'Revisa la relación' })).toBeInTheDocument();
    expect(screen.getByTestId(WHATSAPP_RELATE_CONFIRM_MESSAGE_TESTID)).toHaveTextContent(
      'bienvenida_cliente enviará estos datos en cada mensaje:',
    );
    expect(within(dialogo).getAllByTestId(WHATSAPP_RELATE_CONFIRM_LINE_TESTID).map((line) => line.textContent)).toEqual([
      'Encabezado {{1}}Número de pedidonumero_de_pedido',
      '{{1}}Nombre del clientenombre_del_cliente',
      '{{2}}Nombre de la empresanombre_de_la_empresa',
      '{{3}}Número de cuentanumero_de_cuenta',
      'Botón 1 {{1}}Horariohorario',
    ]);
    expect(relateMock).not.toHaveBeenCalled();
  });

  it('R45: «Volver a revisar» cierra el diálogo, vuelve al panel con lo elegido y no guarda', async () => {
    const user = setupUser();
    const { onClose } = renderSheet();
    await completar(user);
    await user.click(guardar());
    await user.click(await screen.findByTestId(WHATSAPP_RELATE_CONFIRM_DISMISS_TESTID));

    await waitFor(() => expect(screen.queryByTestId(WHATSAPP_RELATE_CONFIRM_DIALOG_TESTID)).toBeNull());
    expect(screen.getByTestId(WHATSAPP_RELATE_SHEET_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(WHATSAPP_RELATE_SELECT_TESTID('body.2'))).toHaveTextContent('Nombre de la empresa');
    expect(relateMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('R46: «Guardar relación» envía un par hueco → clave, con la clave con punto para las constantes', async () => {
    relateMock.mockResolvedValue({ status: 'success', data: RELACIONADA });
    const user = setupUser();
    renderSheet();
    await completar(user);
    await user.click(guardar());
    await user.click(await screen.findByTestId(WHATSAPP_RELATE_CONFIRM_SUBMIT_TESTID));

    await waitFor(() => expect(relateMock).toHaveBeenCalledTimes(1));
    expect(relateMock).toHaveBeenCalledWith({
      templateId: 't9',
      bindings: [
        { slot: 'header', key: 'pedido.numero' },
        { slot: 'body.1', key: 'cliente.nombre' },
        { slot: 'body.2', key: 'empresa.nombre' },
        { slot: 'body.3', key: 'numero_de_cuenta' },
        { slot: 'button.0', key: 'horario' },
      ],
    });
  });

  it('R46: con éxito avisa «Variables relacionadas. Ya puedes habilitarla.» y entrega la plantilla devuelta', async () => {
    relateMock.mockResolvedValue({ status: 'success', data: RELACIONADA });
    const user = setupUser();
    const { onRelated } = renderSheet();
    await completar(user);
    await user.click(guardar());
    await user.click(await screen.findByTestId(WHATSAPP_RELATE_CONFIRM_SUBMIT_TESTID));

    await waitFor(() => expect(onRelated).toHaveBeenCalledWith(RELACIONADA));
    expect(toastSuccessMock).toHaveBeenCalledWith('Variables relacionadas. Ya puedes habilitarla.');
    await waitFor(() => expect(screen.queryByTestId(WHATSAPP_RELATE_CONFIRM_DIALOG_TESTID)).toBeNull());
  });

  it('R46: mientras responde, «Guardar relación» y «Volver a revisar» quedan deshabilitados', async () => {
    const pendiente = deferred<WhatsappTemplateCreateResult>();
    relateMock.mockReturnValue(pendiente.promise);
    const user = setupUser();
    renderSheet();
    await completar(user);
    await user.click(guardar());
    await user.click(await screen.findByTestId(WHATSAPP_RELATE_CONFIRM_SUBMIT_TESTID));

    await waitFor(() => expect(screen.getByTestId(WHATSAPP_RELATE_CONFIRM_SUBMIT_TESTID)).toBeDisabled());
    expect(screen.getByTestId(WHATSAPP_RELATE_CONFIRM_DISMISS_TESTID)).toBeDisabled();
    pendiente.resolve({ status: 'success', data: RELACIONADA });
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
  });

  it('R46: si falla, el diálogo muestra el mensaje del error y no cambia nada', async () => {
    relateMock.mockResolvedValue(FALLO);
    const user = setupUser();
    const { onRelated, onClose } = renderSheet();
    await completar(user);
    await user.click(guardar());
    await user.click(await screen.findByTestId(WHATSAPP_RELATE_CONFIRM_SUBMIT_TESTID));

    expect(await screen.findByTestId(WHATSAPP_RELATE_CONFIRM_ERROR_TESTID)).toHaveTextContent(FALLO.message);
    expect(screen.getByTestId(WHATSAPP_RELATE_CONFIRM_DIALOG_TESTID)).toBeInTheDocument();
    expect(onRelated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('«Cancelar» cierra el panel sin guardar', async () => {
    const user = setupUser();
    const { onClose } = renderSheet();
    await user.click(screen.getByTestId(WHATSAPP_RELATE_CANCEL_TESTID));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(relateMock).not.toHaveBeenCalled();
  });

  it('sin plantilla el panel no se pinta', () => {
    renderSheet(null);
    expect(screen.queryByTestId(WHATSAPP_RELATE_SHEET_TESTID)).toBeNull();
  });

  it('R38: por debajo de 768 px el panel ocupa la pantalla con las pestañas «Formulario | Vista previa»', async () => {
    setViewportWidth(NARROW_VIEWPORT);
    const user = setupUser();
    renderSheet();
    const pestañas = await screen.findAllByRole('tab');
    expect(pestañas.map((tab) => tab.textContent)).toEqual(['Formulario', 'Vista previa']);
    expect(screen.getByTestId(WHATSAPP_RELATE_TEXT_TESTID)).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'Vista previa' }));
    expect(await screen.findByTestId(WA_BUBBLE_BODY_TESTID)).toBeInTheDocument();
  });

  it('R37: ningún texto fijo del panel ni del diálogo nombra a Meta ni a la empresa', () => {
    const textos = Object.values(WHATSAPP_RELATE_TEXTS).map((texto) =>
      typeof texto === 'function' ? texto('1') : texto,
    );
    for (const texto of textos) {
      expect(texto).not.toMatch(/Meta|QuimiCloude/);
    }
  });
});
