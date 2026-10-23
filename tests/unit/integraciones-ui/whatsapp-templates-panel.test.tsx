// La pestaña «Plantillas»: barra de sincronización, listado (tabla y tarjeta), filtros, interruptor
// de uso y eliminar. Las acciones de QC-242 se simulan por su ruta exacta.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WHATSAPP_DELETE_TEMPLATE_CONFIRM_TESTID,
  WHATSAPP_DELETE_TEMPLATE_DIALOG_TESTID,
  WHATSAPP_DELETE_TEMPLATE_DISMISS_TESTID,
  WHATSAPP_DELETE_TEMPLATE_ERROR_TESTID,
  WHATSAPP_DELETE_TEMPLATE_MESSAGE_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-delete-dialog';
import {
  WHATSAPP_TEMPLATE_REASON_BUTTON_TESTID,
  WHATSAPP_TEMPLATE_REASON_TEXT_TESTID,
  WHATSAPP_TEMPLATE_STATUS_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-status';
import {
  WHATSAPP_SYNC_AT_TESTID,
  WHATSAPP_SYNC_BAR_TESTID,
  WHATSAPP_SYNC_BUTTON_TESTID,
  WHATSAPP_SYNC_SUMMARY_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-sync-bar';
import {
  WHATSAPP_TEMPLATE_ACTION_TESTIDS,
  WHATSAPP_TEMPLATE_ACTIONS_TESTID,
  WHATSAPP_TEMPLATE_CLEAR_FILTERS_TESTID,
  WHATSAPP_TEMPLATE_COUNT_TESTID,
  WHATSAPP_TEMPLATE_FILTER_TESTID,
  WHATSAPP_TEMPLATE_NAME_TESTID,
  WHATSAPP_TEMPLATE_NEW_TESTID,
  WHATSAPP_TEMPLATE_SNIPPET_TESTID,
  type TemplateFilter,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-table';
import {
  WHATSAPP_TEMPLATE_NOT_COMPATIBLE_REASON_TESTID,
  WHATSAPP_TEMPLATE_RELATE_BUTTON_TESTID,
  WHATSAPP_TEMPLATE_RELATE_LINK_TESTID,
  WHATSAPP_TEMPLATE_SWITCH_TESTID,
  WHATSAPP_TEMPLATE_USAGE_BADGE_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-usage';
import {
  WHATSAPP_TEMPLATES_EMPTY_NEW_TESTID,
  WHATSAPP_TEMPLATES_EMPTY_SYNC_TESTID,
  WHATSAPP_TEMPLATES_EMPTY_TESTID,
  WHATSAPP_TEMPLATES_PANEL_TESTID,
  WHATSAPP_TEMPLATES_UNMAPPED_NOTICE_TESTID,
  WhatsappTemplatesPanel,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-templates-panel';
import { formatSyncDateTime, TEMPLATE_RULES_TEXTS } from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-rules';
import { errorMessage, type ErrorState } from '@/lib/modules/errores';
import type { TemplateSyncSummary, WhatsappTemplateList, WhatsappTemplateView } from '@/lib/modules/integraciones';
import type {
  WhatsappTemplateCreateResult,
  WhatsappTemplateDeleteResult,
  WhatsappTemplateSyncResult,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-template-actions';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const { syncMock, setEnabledMock, deleteMock, otherActionMock, toastSuccessMock, toastErrorMock, refreshMock } =
  vi.hoisted(() => ({
    syncMock: vi.fn<() => Promise<WhatsappTemplateSyncResult>>(),
    setEnabledMock: vi.fn<(input: unknown) => Promise<WhatsappTemplateCreateResult>>(),
    deleteMock: vi.fn<(id: string) => Promise<WhatsappTemplateDeleteResult>>(),
    otherActionMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
    refreshMock: vi.fn(),
  }));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-template-actions', () => ({
  listWhatsappTemplatesAction: otherActionMock,
  createWhatsappTemplateAction: otherActionMock,
  relateWhatsappTemplateVariablesAction: otherActionMock,
  syncWhatsappTemplatesAction: syncMock,
  setWhatsappTemplateEnabledAction: setEnabledMock,
  deleteWhatsappTemplateAction: deleteMock,
}));

vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: { success: toastSuccessMock, error: toastErrorMock, dismiss: vi.fn() },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), replace: vi.fn() }),
}));

const SYNCED_AT = '2026-10-22T09:14:00.000Z';
const NEW_SYNCED_AT = '2026-10-22T10:02:00.000Z';

function plantilla(overrides: Partial<WhatsappTemplateView> & Pick<WhatsappTemplateView, 'id' | 'name'>): WhatsappTemplateView {
  return {
    language: 'es',
    category: 'UTILITY',
    status: 'APPROVED',
    statusRaw: null,
    rejectedReason: null,
    content: { header: null, body: { text: 'Gracias por tu compra.', examples: [] }, footer: null, buttons: [] },
    lastSyncedAt: SYNCED_AT,
    createdAt: '2026-10-01T10:00:00.000Z',
    mappingStatus: 'MAPPED',
    enabled: false,
    variables: [],
    ...overrides,
  };
}

const RELACIONADA = plantilla({
  id: 't1',
  name: 'pedido_listo',
  enabled: true,
  content: {
    header: null,
    body: { text: 'Hola {{cliente.nombre}}, tu pedido ya está listo para recoger.', examples: [] },
    footer: null,
    buttons: [],
  },
  variables: [{ slot: 'body.1', position: 1, kind: 'system', key: 'cliente.nombre', label: 'Nombre del cliente' }],
});
const SIN_RELACIONAR = plantilla({
  id: 't2',
  name: 'recordatorio_pago',
  status: 'PENDING',
  mappingStatus: 'UNMAPPED',
  content: { header: null, body: { text: 'Hola {{1}}, recuerda pagar.', examples: [] }, footer: null, buttons: [] },
  variables: [{ slot: 'body.1', position: 1, kind: null, key: null, label: null }],
});
const RECHAZADA = plantilla({
  id: 't3',
  name: 'promo_octubre',
  category: 'MARKETING',
  status: 'REJECTED',
  rejectedReason: 'El contenido no cumple la política.',
});
const NO_COMPATIBLE = plantilla({ id: 't4', name: 'catalogo_con_imagen', content: null, mappingStatus: 'UNMAPPED' });
const PAUSADA = plantilla({ id: 't5', name: 'aviso_entrega', language: 'en', status: 'PAUSED', category: 'AUTHENTICATION' });
const DESHABILITADA = plantilla({ id: 't6', name: 'encuesta_servicio', status: 'DISABLED' });
const OTRA = plantilla({
  id: 't7',
  name: 'hello_world',
  language: 'en_US',
  status: 'OTHER',
  statusRaw: 'IN_APPEAL',
  mappingStatus: 'UNMAPPED',
  content: { header: null, body: { text: 'Hello {{1}}', examples: [] }, footer: null, buttons: [] },
  variables: [{ slot: 'body.1', position: 1, kind: null, key: null, label: null }],
});

const TODAS = [RELACIONADA, SIN_RELACIONAR, RECHAZADA, NO_COMPATIBLE, PAUSADA, DESHABILITADA, OTRA];

function lista(templates: readonly WhatsappTemplateView[] = TODAS, templatesSyncedAt: string | null = SYNCED_AT): WhatsappTemplateList {
  return { templates, templatesSyncedAt };
}

const FALLO: ErrorState = {
  status: 'error',
  code: 'whatsapp_meta_unreachable',
  message: errorMessage('whatsapp_meta_unreachable'),
};

const RESUMEN: TemplateSyncSummary = { imported: 3, updated: 2, deleted: 1, skipped: 0, syncedAt: NEW_SYNCED_AT };

function renderPanel(list: WhatsappTemplateList = lista()) {
  return render(<WhatsappTemplatesPanel list={list} dictionary={[]} />);
}

const fila = (id: string) => screen.getByTestId(`data-table-row-${id}`);
const tarjeta = (id: string) => screen.getByTestId(`data-table-card-${id}`);
const filasVisibles = () =>
  screen.queryAllByTestId(/^data-table-row-/).map((row) => row.getAttribute('data-testid')?.replace('data-table-row-', ''));

async function abrirMenu(id: string) {
  const user = setupUser();
  await user.click(within(fila(id)).getByTestId(WHATSAPP_TEMPLATE_ACTIONS_TESTID(id)));
  return user;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('barra de sincronización', () => {
  it('R7: muestra «Sincronización con Meta» y «Última:» con la hora como DD/MM/AAAA HH:MM', () => {
    renderPanel();
    const bar = screen.getByTestId(WHATSAPP_SYNC_BAR_TESTID);
    expect(bar).toHaveTextContent('Sincronización con Meta');
    expect(bar).toHaveTextContent('Última:');
    const at = screen.getByTestId(WHATSAPP_SYNC_AT_TESTID);
    expect(at).toHaveTextContent(formatSyncDateTime(SYNCED_AT));
    expect(at.textContent).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });

  it('R7: sin sincronizar nunca, la marca de vacío', () => {
    renderPanel(lista(TODAS, null));
    expect(screen.getByTestId(WHATSAPP_SYNC_AT_TESTID)).toHaveTextContent(EMPTY_MARK);
  });

  it('R8: mientras sincroniza, botón deshabilitado con «Sincronizando…» y listado como esqueleto', async () => {
    const pendiente = deferred<WhatsappTemplateSyncResult>();
    syncMock.mockReturnValue(pendiente.promise);
    const user = setupUser();
    renderPanel();

    await user.click(screen.getByTestId(WHATSAPP_SYNC_BUTTON_TESTID));

    const button = screen.getByTestId(WHATSAPP_SYNC_BUTTON_TESTID);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Sincronizando…');
    expect(screen.getByTestId('data-table-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('data-table-row-t1')).toBeNull();
    expect(syncMock).toHaveBeenCalledTimes(1);

    pendiente.resolve({ status: 'success', data: RESUMEN });
    await waitFor(() => expect(screen.getByTestId(WHATSAPP_SYNC_BUTTON_TESTID)).toBeEnabled());
  });

  it('R8: con éxito, aviso, hora nueva, tres etiquetas y pide la lista nueva', async () => {
    syncMock.mockResolvedValue({ status: 'success', data: RESUMEN });
    const user = setupUser();
    const { rerender } = renderPanel();

    await user.click(screen.getByTestId(WHATSAPP_SYNC_BUTTON_TESTID));

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Plantillas sincronizadas con Meta.'));
    expect(screen.getByTestId(WHATSAPP_SYNC_AT_TESTID)).toHaveTextContent(formatSyncDateTime(NEW_SYNCED_AT));
    const summary = screen.getByTestId(WHATSAPP_SYNC_SUMMARY_TESTID);
    expect(within(summary).getByText('3 importadas')).toBeInTheDocument();
    expect(within(summary).getByText('2 actualizadas')).toBeInTheDocument();
    expect(within(summary).getByText('1 eliminada')).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();

    const nueva = plantilla({ id: 't9', name: 'importada_nueva' });
    rerender(<WhatsappTemplatesPanel list={lista([nueva], NEW_SYNCED_AT)} dictionary={[]} />);
    expect(filasVisibles()).toEqual(['t9']);
  });

  it('R8: «Sincronizar con Meta» del estado vacío también sincroniza', async () => {
    syncMock.mockResolvedValue({ status: 'success', data: RESUMEN });
    const user = setupUser();
    renderPanel(lista([]));

    await user.click(screen.getByTestId(WHATSAPP_TEMPLATES_EMPTY_SYNC_TESTID));

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Plantillas sincronizadas con Meta.'));
    expect(syncMock).toHaveBeenCalledTimes(1);
  });

  it('R9: si falla, muestra el mensaje y deja listado y hora como estaban', async () => {
    syncMock.mockResolvedValue(FALLO);
    const user = setupUser();
    renderPanel();

    await user.click(screen.getByTestId(WHATSAPP_SYNC_BUTTON_TESTID));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith(FALLO.message));
    expect(screen.getByTestId(WHATSAPP_SYNC_AT_TESTID)).toHaveTextContent(formatSyncDateTime(SYNCED_AT));
    expect(screen.queryByTestId(WHATSAPP_SYNC_SUMMARY_TESTID)).toBeNull();
    expect(filasVisibles()).toEqual(TODAS.map((template) => template.id));
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe('listado', () => {
  it('R10: columnas, nombre con el inicio del mensaje, idioma, categoría, fecha y el total al pie', () => {
    renderPanel();
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    for (const label of ['Nombre', 'Idioma', 'Categoría', 'Estado en Meta', 'Uso en el sistema', 'Última sincronización']) {
      expect(headers.some((text) => text?.includes(label))).toBe(true);
    }
    const row = fila('t1');
    expect(within(row).getByTestId(WHATSAPP_TEMPLATE_NAME_TESTID)).toHaveTextContent('pedido_listo');
    expect(within(row).getByTestId(WHATSAPP_TEMPLATE_SNIPPET_TESTID)).toHaveTextContent(
      'Hola {{nombre_del_cliente}}, tu pedido ya está listo para recoger.',
    );
    expect(within(row).getByText('es')).toBeInTheDocument();
    expect(within(row).getByText('Utilidad')).toBeInTheDocument();
    expect(within(fila('t3')).getByText('Marketing')).toBeInTheDocument();
    expect(within(fila('t5')).getByText('Autenticación')).toBeInTheDocument();
    expect(within(row).getByText(formatSyncDateTime(SYNCED_AT))).toBeInTheDocument();
    expect(within(row).getByTestId(WHATSAPP_TEMPLATE_ACTIONS_TESTID('t1'))).toHaveAccessibleName(
      'Acciones de pedido_listo',
    );
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_COUNT_TESTID)).toHaveTextContent('7 plantillas');
  });

  it('R11: cada estado en Meta con su texto y su tono', () => {
    renderPanel();
    const esperado: [string, string, string][] = [
      ['t1', 'Aprobada', 'success'],
      ['t2', 'Pendiente', 'waiting'],
      ['t3', 'Rechazada', 'danger'],
      ['t5', 'Pausada', 'progress'],
      ['t6', 'Deshabilitada', 'neutral'],
      ['t7', 'Otro · IN_APPEAL', 'muted'],
    ];
    for (const [id, label, tone] of esperado) {
      const badge = within(fila(id)).getByTestId(WHATSAPP_TEMPLATE_STATUS_TESTID);
      expect(badge).toHaveTextContent(label);
      expect(badge).toHaveAttribute('data-tone', tone);
    }
  });

  it('R12: con 760 px o menos, tarjeta con nombre, estado, idioma, categoría, fecha, uso y «Acciones»', async () => {
    renderPanel();
    const card = tarjeta('t1');
    expect(within(card).getByTestId('data-table-card-field-name')).toHaveTextContent('pedido_listo');
    expect(within(card).getByTestId('data-table-card-field-status')).toHaveTextContent('Aprobada');
    expect(within(card).getByTestId('data-table-card-field-language')).toHaveTextContent('es');
    expect(within(card).getByTestId('data-table-card-field-category')).toHaveTextContent('Utilidad');
    expect(within(card).getByTestId('data-table-card-field-syncedAt')).toHaveTextContent(formatSyncDateTime(SYNCED_AT));
    expect(within(card).getByTestId(WHATSAPP_TEMPLATE_SWITCH_TESTID)).toBeInTheDocument();
    expect(within(tarjeta('t2')).getByTestId(WHATSAPP_TEMPLATE_RELATE_BUTTON_TESTID)).toHaveTextContent(
      'Relacionar variables',
    );

    const user = setupUser();
    const actions = within(tarjeta('t2')).getByRole('button', { name: /Acciones/ });
    expect(actions).toHaveTextContent('Acciones');
    await user.click(actions);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId(WHATSAPP_TEMPLATE_ACTION_TESTIDS.relate)).toHaveTextContent('Relacionar variables');
    expect(within(dialog).getByTestId(WHATSAPP_TEMPLATE_ACTION_TESTIDS.duplicate)).toHaveTextContent('Duplicar');
    expect(within(dialog).getByTestId(WHATSAPP_TEMPLATE_ACTION_TESTIDS.delete)).toHaveTextContent('Eliminar');
  });

  it('R13: la rechazada lleva el «!» con el motivo en su nombre accesible y el globo al enfocarlo', async () => {
    renderPanel();
    const button = within(fila('t3')).getByTestId(WHATSAPP_TEMPLATE_REASON_BUTTON_TESTID);
    expect(button).toHaveAccessibleName('Motivo del rechazo: El contenido no cumple la política.');

    button.focus();
    expect(await screen.findByText('El contenido no cumple la política.', { selector: '[data-slot="tooltip-content"]' })).toBeInTheDocument();
    expect(within(fila('t1')).queryByTestId(WHATSAPP_TEMPLATE_REASON_BUTTON_TESTID)).toBeNull();
  });

  it('R13: en la tarjeta el motivo se ve como texto, sin depender del globo', () => {
    renderPanel();
    const text = within(tarjeta('t3')).getByTestId(WHATSAPP_TEMPLATE_REASON_TEXT_TESTID);
    expect(text).toHaveTextContent('El contenido no cumple la política.');
    expect(text.className).toContain('@max-[760px]:flex');
    expect(within(tarjeta('t3')).getByTestId(WHATSAPP_TEMPLATE_REASON_BUTTON_TESTID).parentElement?.className).toContain(
      '@max-[760px]:hidden',
    );
  });

  it('R14: relacionada con interruptor, sin relacionar con etiqueta y enlace, no compatible con su motivo', () => {
    renderPanel();
    const sw = within(fila('t1')).getByTestId(WHATSAPP_TEMPLATE_SWITCH_TESTID);
    expect(sw).toHaveAttribute('role', 'switch');
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw).toHaveTextContent('Habilitada');
    expect(within(fila('t5')).getByTestId(WHATSAPP_TEMPLATE_SWITCH_TESTID)).toHaveTextContent('Deshabilitada');

    const unmapped = fila('t2');
    expect(within(unmapped).getByTestId(WHATSAPP_TEMPLATE_USAGE_BADGE_TESTID)).toHaveTextContent('Sin relacionar');
    expect(within(unmapped).getByTestId(WHATSAPP_TEMPLATE_RELATE_LINK_TESTID)).toHaveTextContent('Relacionar');
    expect(within(unmapped).queryByTestId(WHATSAPP_TEMPLATE_SWITCH_TESTID)).toBeNull();

    const incompatible = fila('t4');
    expect(within(incompatible).getByTestId(WHATSAPP_TEMPLATE_USAGE_BADGE_TESTID)).toHaveTextContent('No compatible');
    expect(within(incompatible).getByTestId(WHATSAPP_TEMPLATE_NOT_COMPATIBLE_REASON_TESTID)).toHaveTextContent(
      TEMPLATE_RULES_TEXTS.notCompatibleOther,
    );
    expect(within(incompatible).queryByTestId(WHATSAPP_TEMPLATE_RELATE_LINK_TESTID)).toBeNull();
    expect(within(incompatible).queryByTestId(WHATSAPP_TEMPLATE_SWITCH_TESTID)).toBeNull();
    expect(within(tarjeta('t4')).queryByTestId(WHATSAPP_TEMPLATE_RELATE_BUTTON_TESTID)).toBeNull();
  });

  it('R14: «Relacionar» abre el panel de relación de esa plantilla', async () => {
    const user = setupUser();
    renderPanel();
    await user.click(within(fila('t2')).getByTestId(WHATSAPP_TEMPLATE_RELATE_LINK_TESTID));
    expect(screen.getByTestId(WHATSAPP_TEMPLATES_PANEL_TESTID)).toHaveAttribute('data-open-sheet', 'relate:t2');
  });

  it('R17: aviso en plural con varias sin relacionar', () => {
    renderPanel();
    expect(screen.getByTestId(WHATSAPP_TEMPLATES_UNMAPPED_NOTICE_TESTID)).toHaveTextContent(
      '2 plantillas importadas de Meta están sin relacionar. Relaciónalas para usarlas en el sistema.',
    );
  });

  it('R17: aviso en singular con una, y sin aviso si no hay ninguna', () => {
    const { unmount } = renderPanel(lista([RELACIONADA, SIN_RELACIONAR, NO_COMPATIBLE]));
    expect(screen.getByTestId(WHATSAPP_TEMPLATES_UNMAPPED_NOTICE_TESTID)).toHaveTextContent(
      '1 plantilla importada de Meta está sin relacionar. Relaciónala para usarla en el sistema.',
    );
    unmount();
    renderPanel(lista([RELACIONADA, NO_COMPATIBLE]));
    expect(screen.queryByTestId(WHATSAPP_TEMPLATES_UNMAPPED_NOTICE_TESTID)).toBeNull();
  });

  it('R18: cada chip filtra, uno activo a la vez, la búsqueda no distingue mayúsculas y nada va al servidor', async () => {
    const user = setupUser();
    renderPanel();
    const esperado: [TemplateFilter, string, string[]][] = [
      ['APPROVED', 'Aprobadas', ['t1', 't4']],
      ['PENDING', 'Pendientes', ['t2']],
      ['REJECTED', 'Rechazadas', ['t3']],
      ['PAUSED', 'Pausadas', ['t5']],
      ['DISABLED', 'Deshabilitadas', ['t6']],
      ['UNMAPPED', 'Sin relacionar', ['t2', 't7']],
      ['ALL', 'Todas', TODAS.map((template) => template.id)],
    ];
    for (const [filter, label, ids] of esperado) {
      const chip = screen.getByTestId(WHATSAPP_TEMPLATE_FILTER_TESTID(filter));
      expect(chip).toHaveTextContent(label);
      await user.click(chip);
      expect(chip).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
      expect(filasVisibles()).toEqual(ids);
    }

    await user.type(screen.getByTestId('data-table-search'), 'PEDIDO');
    await waitFor(() => expect(filasVisibles()).toEqual(['t1']));
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_COUNT_TESTID)).toHaveTextContent('1 plantilla');

    expect(otherActionMock).not.toHaveBeenCalled();
    expect(syncMock).not.toHaveBeenCalled();
    expect(setEnabledMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('R19: sin plantillas, el estado vacío con sus textos y sus dos botones', async () => {
    const user = setupUser();
    renderPanel(lista([]));
    const empty = screen.getByTestId(WHATSAPP_TEMPLATES_EMPTY_TESTID);
    expect(empty).toHaveTextContent('Todavía no hay plantillas.');
    expect(empty).toHaveTextContent('Crea una aquí o trae las que ya tienes aprobadas en Meta.');
    expect(screen.getByTestId(WHATSAPP_TEMPLATES_EMPTY_SYNC_TESTID)).toHaveTextContent('Sincronizar con Meta');
    const create = screen.getByTestId(WHATSAPP_TEMPLATES_EMPTY_NEW_TESTID);
    expect(create).toHaveTextContent('Nueva plantilla');

    await user.click(create);
    expect(screen.getByTestId(WHATSAPP_TEMPLATES_PANEL_TESTID)).toHaveAttribute('data-open-sheet', 'new');
  });

  it('R19: sin coincidencias, el aviso y «Quitar filtros» vacía la búsqueda y vuelve a «Todas»', async () => {
    const user = setupUser();
    renderPanel();
    await user.click(screen.getByTestId(WHATSAPP_TEMPLATE_FILTER_TESTID('REJECTED')));
    await user.type(screen.getByTestId('data-table-search'), 'pedido');

    await waitFor(() => expect(screen.getByTestId('data-table-empty')).toHaveTextContent('Ninguna plantilla coincide con la búsqueda.'));
    await user.click(screen.getByTestId(WHATSAPP_TEMPLATE_CLEAR_FILTERS_TESTID));

    expect(filasVisibles()).toEqual(TODAS.map((template) => template.id));
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_FILTER_TESTID('ALL'))).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('data-table-search')).toHaveValue('');
  });

  it('R19: «Nueva plantilla» de la barra abre el alta', async () => {
    const user = setupUser();
    renderPanel();
    await user.click(screen.getByTestId(WHATSAPP_TEMPLATE_NEW_TESTID));
    expect(screen.getByTestId(WHATSAPP_TEMPLATES_PANEL_TESTID)).toHaveAttribute('data-open-sheet', 'new');
  });

  it('R20: el menú de una relacionable ofrece «Relacionar variables», «Duplicar» y «Eliminar»', async () => {
    renderPanel();
    const user = await abrirMenu('t2');
    const relate = await screen.findByTestId(WHATSAPP_TEMPLATE_ACTION_TESTIDS.relate);
    expect(relate).toHaveTextContent('Relacionar variables');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_ACTION_TESTIDS.duplicate)).toHaveTextContent('Duplicar');
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_ACTION_TESTIDS.delete)).toHaveTextContent('Eliminar');

    await user.click(await esperarInteractiva(screen.getByTestId(WHATSAPP_TEMPLATE_ACTION_TESTIDS.duplicate)));
    expect(screen.getByTestId(WHATSAPP_TEMPLATES_PANEL_TESTID)).toHaveAttribute('data-open-sheet', 'duplicate:t2');
  });

  it('R20: en una no relacionable no hay «Relacionar variables»', async () => {
    renderPanel();
    await abrirMenu('t4');
    expect(await screen.findByTestId(WHATSAPP_TEMPLATE_ACTION_TESTIDS.duplicate)).toBeInTheDocument();
    expect(screen.getByTestId(WHATSAPP_TEMPLATE_ACTION_TESTIDS.delete)).toBeInTheDocument();
    expect(screen.queryByTestId(WHATSAPP_TEMPLATE_ACTION_TESTIDS.relate)).toBeNull();
  });
});

describe('interruptor de uso', () => {
  it('R16: llama a la acción con el id y el valor nuevo y avisa', async () => {
    setEnabledMock.mockResolvedValue({ status: 'success', data: { ...RELACIONADA, enabled: false } });
    const user = setupUser();
    renderPanel();

    await user.click(within(fila('t1')).getByTestId(WHATSAPP_TEMPLATE_SWITCH_TESTID));

    expect(setEnabledMock).toHaveBeenCalledWith({ templateId: 't1', enabled: false });
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Plantilla deshabilitada.'));
    expect(within(fila('t1')).getByTestId(WHATSAPP_TEMPLATE_SWITCH_TESTID)).toHaveAttribute('aria-checked', 'false');
  });

  it('R16: al habilitar avisa «Plantilla habilitada.»', async () => {
    setEnabledMock.mockResolvedValue({ status: 'success', data: { ...PAUSADA, enabled: true } });
    const user = setupUser();
    renderPanel();

    await user.click(within(fila('t5')).getByTestId(WHATSAPP_TEMPLATE_SWITCH_TESTID));

    expect(setEnabledMock).toHaveBeenCalledWith({ templateId: 't5', enabled: true });
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Plantilla habilitada.'));
  });

  it('R16: si falla, muestra el mensaje y el interruptor vuelve a su valor', async () => {
    const pendiente = deferred<WhatsappTemplateCreateResult>();
    setEnabledMock.mockReturnValue(pendiente.promise);
    const user = setupUser();
    renderPanel();

    await user.click(within(fila('t1')).getByTestId(WHATSAPP_TEMPLATE_SWITCH_TESTID));
    expect(within(fila('t1')).getByTestId(WHATSAPP_TEMPLATE_SWITCH_TESTID)).toHaveAttribute('aria-checked', 'false');

    pendiente.resolve(FALLO);
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith(FALLO.message));
    expect(within(fila('t1')).getByTestId(WHATSAPP_TEMPLATE_SWITCH_TESTID)).toHaveAttribute('aria-checked', 'true');
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});

describe('eliminar plantilla', () => {
  async function abrirEliminar(id: string) {
    const user = await abrirMenu(id);
    await user.click(await esperarInteractiva(await screen.findByTestId(WHATSAPP_TEMPLATE_ACTION_TESTIDS.delete)));
    return { user, dialog: await screen.findByTestId(WHATSAPP_DELETE_TEMPLATE_DIALOG_TESTID) };
  }

  it('R41: pide confirmación con sus textos', async () => {
    renderPanel();
    const { user, dialog } = await abrirEliminar('t3');
    expect(dialog).toHaveTextContent('Eliminar la plantilla');
    expect(within(dialog).getByTestId(WHATSAPP_DELETE_TEMPLATE_MESSAGE_TESTID)).toHaveTextContent(
      'Se va a eliminar promo_octubre. Esta acción no se puede deshacer.',
    );
    expect(within(dialog).getByTestId(WHATSAPP_DELETE_TEMPLATE_DISMISS_TESTID)).toHaveTextContent('Volver');
    expect(within(dialog).getByTestId(WHATSAPP_DELETE_TEMPLATE_CONFIRM_TESTID)).toHaveTextContent('Eliminar');

    await user.click(within(dialog).getByTestId(WHATSAPP_DELETE_TEMPLATE_DISMISS_TESTID));
    await waitFor(() => expect(screen.queryByTestId(WHATSAPP_DELETE_TEMPLATE_DIALOG_TESTID)).toBeNull());
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('R41: al confirmar llama a la acción, avisa y quita la fila', async () => {
    deleteMock.mockResolvedValue({ status: 'success', data: { id: 't3' } });
    renderPanel();
    const { user, dialog } = await abrirEliminar('t3');

    await user.click(within(dialog).getByTestId(WHATSAPP_DELETE_TEMPLATE_CONFIRM_TESTID));

    expect(deleteMock).toHaveBeenCalledWith('t3');
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Plantilla eliminada.'));
    expect(screen.queryByTestId('data-table-row-t3')).toBeNull();
    expect(refreshMock).toHaveBeenCalled();
  });

  it('R41: si falla, el mensaje en el diálogo y la fila sigue', async () => {
    deleteMock.mockResolvedValue(FALLO);
    renderPanel();
    const { user, dialog } = await abrirEliminar('t3');

    await user.click(within(dialog).getByTestId(WHATSAPP_DELETE_TEMPLATE_CONFIRM_TESTID));

    expect(await within(dialog).findByTestId(WHATSAPP_DELETE_TEMPLATE_ERROR_TESTID)).toHaveTextContent(FALLO.message);
    expect(screen.getByTestId(WHATSAPP_DELETE_TEMPLATE_DIALOG_TESTID)).toBeInTheDocument();
    expect(fila('t3')).toBeInTheDocument();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
