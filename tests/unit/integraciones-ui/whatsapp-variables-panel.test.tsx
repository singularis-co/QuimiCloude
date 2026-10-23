// Pestaña Variables: texto de entrada, constantes del sistema, variables propias, vacío y diálogo de
// eliminar.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WHATSAPP_CONSTANTS_CARDS_TESTID,
  WHATSAPP_CONSTANTS_TABLE_TESTID,
  WHATSAPP_DELETE_VARIABLE_CONFIRM_TESTID,
  WHATSAPP_DELETE_VARIABLE_DIALOG_TESTID,
  WHATSAPP_DELETE_VARIABLE_ERROR_TESTID,
  WHATSAPP_DELETE_VARIABLE_MESSAGE_TESTID,
  WHATSAPP_NEW_VARIABLE_EMPTY_TESTID,
  WHATSAPP_NEW_VARIABLE_TESTID,
  WHATSAPP_OWN_VARIABLES_CARDS_TESTID,
  WHATSAPP_OWN_VARIABLES_EMPTY_TESTID,
  WHATSAPP_OWN_VARIABLES_TABLE_TESTID,
  WHATSAPP_VARIABLES_INTRO_TESTID,
  WHATSAPP_VARIABLES_TEXTS,
  WhatsappVariablesPanel,
  ownVariableCardDeleteTestId,
  ownVariableDeleteTestId,
  ownVariableEditTestId,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-variables-panel';
import {
  WHATSAPP_VARIABLE_CANCEL_TESTID,
  WHATSAPP_VARIABLE_KEY_TESTID,
  WHATSAPP_VARIABLE_SHEET_TESTID,
  WHATSAPP_VARIABLE_TITLE_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-variable-form-sheet';
import type { WhatsappDictionaryEntryView } from '@/lib/modules/integraciones';
import type { WhatsappVariableKeyDeleteResult } from '@/lib/modules/integraciones/adapters/driving/whatsapp-variable-key-actions';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { setupUser } from '../../helpers/user-event';

const { deleteMock, refreshMock, toastSuccessMock } = vi.hoisted(() => ({
  deleteMock: vi.fn<(id: string) => Promise<WhatsappVariableKeyDeleteResult>>(),
  refreshMock: vi.fn<() => void>(),
  toastSuccessMock: vi.fn(),
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-variable-key-actions', () => ({
  deleteWhatsappVariableKeyAction: deleteMock,
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('sonner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sonner')>()),
  toast: { success: toastSuccessMock, error: vi.fn() },
}));

const CUENTA: WhatsappDictionaryEntryView = {
  id: 'v1',
  key: 'numero_de_cuenta',
  label: 'Número de cuenta',
  value: '2200345678',
  usedBy: 2,
};
const HORARIO: WhatsappDictionaryEntryView = {
  id: 'v2',
  key: 'horario_de_atencion',
  label: 'Horario de atención',
  value: 'Lunes a viernes, 8:00 a 17:00',
  usedBy: 0,
};

function montar(entries: readonly WhatsappDictionaryEntryView[]) {
  return render(<WhatsappVariablesPanel entries={entries} hasConnection />);
}

function cabeceras(tabla: HTMLElement): string[] {
  return within(tabla)
    .getAllByRole('columnheader')
    .map((th) => th.textContent ?? '');
}

beforeEach(() => {
  deleteMock.mockReset();
  refreshMock.mockReset();
  toastSuccessMock.mockReset();
});

afterEach(cleanup);

describe('WhatsappVariablesPanel', () => {
  it('R47: muestra el texto de entrada y la sección de constantes con sus columnas, sin acciones', () => {
    montar([CUENTA]);

    expect(screen.getByTestId(WHATSAPP_VARIABLES_INTRO_TESTID).textContent).toBe(
      'Las variables se insertan en las plantillas como {{clave}}. Al enviar, el sistema pone el dato real. Meta ve la etiqueta como ejemplo cuando revisa la plantilla.',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Constantes del sistema' })).toBeTruthy();
    expect(screen.getByText('Las resuelve el sistema con el dato de cada envío. No se editan.')).toBeTruthy();

    const tabla = screen.getByTestId(WHATSAPP_CONSTANTS_TABLE_TESTID);
    expect(cabeceras(tabla)).toEqual(['Etiqueta', 'Clave', 'Descripción', 'Ejemplo']);
    expect(within(tabla).queryAllByRole('button')).toHaveLength(0);
    expect(within(screen.getByTestId(WHATSAPP_CONSTANTS_CARDS_TESTID)).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 2, name: 'Variables propias' })).toBeTruthy();
  });

  it('R48: la tabla de constantes trae exactamente las tres, con clave, etiqueta, descripción y ejemplo', () => {
    montar([]);

    const filas = within(screen.getByTestId(WHATSAPP_CONSTANTS_TABLE_TESTID)).getAllByRole('row').slice(1);
    const celdas = filas.map((fila) =>
      within(fila)
        .getAllByRole('cell')
        .map((td) => td.textContent),
    );
    expect(celdas).toEqual([
      ['Nombre del cliente', 'nombre_del_cliente', 'Nombres y apellidos del cliente que recibe el mensaje.', 'Laura Gómez'],
      ['Número de pedido', 'numero_de_pedido', 'Número del pedido del que trata el mensaje.', 'PED-00128'],
      ['Nombre de la empresa', 'nombre_de_la_empresa', 'El nombre de tu empresa en QuimiCloude.', EMPTY_MARK],
    ]);
    expect(within(screen.getByTestId(WHATSAPP_CONSTANTS_CARDS_TESTID)).getAllByRole('listitem')).toHaveLength(3);
  });

  it('R49: la sección de propias tiene su texto, «Nueva variable» y la tabla sin columna Descripción (R58), con editar y eliminar', () => {
    montar([CUENTA, HORARIO]);

    expect(
      screen.getByText(
        'Datos fijos de tu empresa, como un número de cuenta. Se guardan una vez y sirven para todas las plantillas; se envía el valor guardado.',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId(WHATSAPP_NEW_VARIABLE_TESTID).textContent).toBe('Nueva variable');

    const tabla = screen.getByTestId(WHATSAPP_OWN_VARIABLES_TABLE_TESTID);
    expect(cabeceras(tabla)).toEqual(['Etiqueta', 'Clave', 'Valor', 'Plantillas que la usan', 'Acciones']);
    expect(cabeceras(tabla)).not.toContain('Descripción');

    const fila = within(tabla).getAllByRole('row')[1];
    const celdas = within(fila)
      .getAllByRole('cell')
      .map((td) => td.textContent);
    expect(celdas.slice(0, 4)).toEqual(['Número de cuenta', 'numero_de_cuenta', '2200345678', '2']);
    expect(within(fila).getByRole('button', { name: 'Editar Número de cuenta' })).toBeTruthy();
    expect(within(fila).getByRole('button', { name: 'Eliminar Número de cuenta' })).toBeTruthy();

    const tarjetas = screen.getByTestId(WHATSAPP_OWN_VARIABLES_CARDS_TESTID);
    expect(within(tarjetas).getAllByRole('button', { name: /^Editar / })).toHaveLength(2);
    expect(within(tarjetas).getAllByRole('button', { name: /^Eliminar / })).toHaveLength(2);
  });

  it('R49: «Nueva variable» abre el panel de variable nueva y «Editar» el de esa variable', async () => {
    const user = setupUser();
    montar([CUENTA]);

    expect(screen.queryByTestId(WHATSAPP_VARIABLE_SHEET_TESTID)).toBeNull();
    await user.click(screen.getByTestId(WHATSAPP_NEW_VARIABLE_TESTID));
    expect(await screen.findByTestId(WHATSAPP_VARIABLE_TITLE_TESTID)).toHaveTextContent('Nueva variable');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_KEY_TESTID)).toHaveValue('');

    await user.click(screen.getByTestId(WHATSAPP_VARIABLE_CANCEL_TESTID));
    await waitFor(() => expect(screen.queryByTestId(WHATSAPP_VARIABLE_SHEET_TESTID)).toBeNull());
    await user.click(screen.getByTestId(ownVariableEditTestId(CUENTA.id)));
    expect(await screen.findByTestId(WHATSAPP_VARIABLE_TITLE_TESTID)).toHaveTextContent('Editar variable');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_KEY_TESTID)).toHaveValue(CUENTA.key);
  });

  it('R49: sin variables propias muestra el estado vacío con «Nueva variable»', async () => {
    const user = setupUser();
    montar([]);

    const vacio = screen.getByTestId(WHATSAPP_OWN_VARIABLES_EMPTY_TESTID);
    expect(vacio.textContent).toContain(WHATSAPP_VARIABLES_TEXTS.ownEmpty);
    expect(screen.queryByTestId(WHATSAPP_OWN_VARIABLES_TABLE_TESTID)).toBeNull();
    expect(screen.queryByTestId(WHATSAPP_NEW_VARIABLE_TESTID)).toBeNull();

    const boton = within(vacio).getByTestId(WHATSAPP_NEW_VARIABLE_EMPTY_TESTID);
    expect(boton.textContent).toBe('Nueva variable');
    await user.click(boton);
    expect(await screen.findByTestId(WHATSAPP_VARIABLE_TITLE_TESTID)).toHaveTextContent('Nueva variable');
  });

  it('R59: sin uso pide confirmación, llama a la acción con su id y avisa «Variable eliminada.»', async () => {
    const user = setupUser();
    deleteMock.mockResolvedValue({ status: 'success', data: { id: HORARIO.id } });
    montar([CUENTA, HORARIO]);

    await user.click(screen.getByTestId(ownVariableDeleteTestId(HORARIO.id)));
    const dialogo = await screen.findByTestId(WHATSAPP_DELETE_VARIABLE_DIALOG_TESTID);
    expect(within(dialogo).getByRole('heading', { name: 'Eliminar la variable' })).toBeTruthy();
    expect(screen.getByTestId(WHATSAPP_DELETE_VARIABLE_MESSAGE_TESTID).textContent).toBe(
      'Se va a eliminar «Horario de atención». Esta acción no se puede deshacer.',
    );
    expect(deleteMock).not.toHaveBeenCalled();

    const confirmar = screen.getByTestId(WHATSAPP_DELETE_VARIABLE_CONFIRM_TESTID);
    expect(confirmar.textContent).toBe('Eliminar');
    expect(confirmar).not.toBeDisabled();
    await user.click(confirmar);

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Variable eliminada.'));
    expect(deleteMock).toHaveBeenCalledWith(HORARIO.id);
    expect(refreshMock).toHaveBeenCalled();
  });

  it('R59: si la acción falla, el diálogo sigue abierto con el mensaje del error', async () => {
    const user = setupUser();
    deleteMock.mockResolvedValue({ status: 'error', code: 'whatsapp_variable_key_in_use', message: 'Algo salió mal.' });
    montar([HORARIO]);

    await user.click(screen.getByTestId(ownVariableCardDeleteTestId(HORARIO.id)));
    await user.click(await screen.findByTestId(WHATSAPP_DELETE_VARIABLE_CONFIRM_TESTID));

    expect((await screen.findByTestId(WHATSAPP_DELETE_VARIABLE_ERROR_TESTID)).textContent).toContain('Algo salió mal.');
    expect(screen.getByTestId(WHATSAPP_DELETE_VARIABLE_DIALOG_TESTID)).toBeTruthy();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('R59: en uso dice que no se puede y deja «Eliminar» deshabilitado', async () => {
    const user = setupUser();
    montar([CUENTA]);

    await user.click(screen.getByTestId(ownVariableDeleteTestId(CUENTA.id)));
    await screen.findByTestId(WHATSAPP_DELETE_VARIABLE_DIALOG_TESTID);
    expect(screen.getByTestId(WHATSAPP_DELETE_VARIABLE_MESSAGE_TESTID).textContent).toBe(
      'No se puede eliminar «Número de cuenta»: la usan 2 plantillas. Quítala de esas plantillas primero.',
    );
    const confirmar = screen.getByTestId(WHATSAPP_DELETE_VARIABLE_CONFIRM_TESTID);
    expect(confirmar).toBeDisabled();
    await user.click(confirmar);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('R59: en uso por una sola plantilla, el aviso va en singular', async () => {
    const user = setupUser();
    const unaSola = { ...CUENTA, usedBy: 1 };
    montar([unaSola]);

    await user.click(screen.getByTestId(ownVariableDeleteTestId(unaSola.id)));
    await screen.findByTestId(WHATSAPP_DELETE_VARIABLE_DIALOG_TESTID);
    expect(screen.getByTestId(WHATSAPP_DELETE_VARIABLE_MESSAGE_TESTID).textContent).toBe(
      'No se puede eliminar «Número de cuenta»: la usa 1 plantilla. Quítala de esa plantilla primero.',
    );
    expect(screen.getByTestId(WHATSAPP_DELETE_VARIABLE_CONFIRM_TESTID)).toBeDisabled();
  });

  it('R60: «Nueva variable» (con lista y vacía), editar y eliminar miden 44 × 44 px en todos los anchos', () => {
    const { unmount } = montar([CUENTA]);
    const conLista = [
      screen.getByTestId(WHATSAPP_NEW_VARIABLE_TESTID),
      screen.getByTestId(ownVariableEditTestId(CUENTA.id)),
      screen.getByTestId(ownVariableDeleteTestId(CUENTA.id)),
    ];
    for (const boton of conLista) {
      expect(boton.className.split(/\s+/)).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']));
    }
    unmount();

    montar([]);
    const vacio = screen.getByTestId(WHATSAPP_NEW_VARIABLE_EMPTY_TESTID);
    expect(vacio.className.split(/\s+/)).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']));
    expect(vacio.className).not.toContain('max-md:min-h-11');
  });

  it('R37: los textos del diálogo de eliminar no nombran a Meta ni a la empresa', () => {
    const textos = [
      WHATSAPP_VARIABLES_TEXTS.deleteTitle,
      WHATSAPP_VARIABLES_TEXTS.deleteDescription('X'),
      WHATSAPP_VARIABLES_TEXTS.deleteBlocked('X', 2),
      WHATSAPP_VARIABLES_TEXTS.deleteDismiss,
      WHATSAPP_VARIABLES_TEXTS.deleted,
    ];
    for (const texto of textos) {
      expect(texto).not.toMatch(/Meta|QuimiCloude/);
    }
  });
});
