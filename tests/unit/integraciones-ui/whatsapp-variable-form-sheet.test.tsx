// Panel de variable propia (nueva y editar) y diálogo «Revisa el cambio», abiertos desde la pestaña
// Variables. Las acciones de QC-242 se simulan por su ruta exacta.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WHATSAPP_VARIABLE_CLOSE_TESTID,
  WHATSAPP_VARIABLE_CONFIRM_AFTER_TESTID,
  WHATSAPP_VARIABLE_CONFIRM_BEFORE_TESTID,
  WHATSAPP_VARIABLE_CONFIRM_DIALOG_TESTID,
  WHATSAPP_VARIABLE_CONFIRM_DISMISS_TESTID,
  WHATSAPP_VARIABLE_CONFIRM_ERROR_TESTID,
  WHATSAPP_VARIABLE_CONFIRM_MESSAGE_TESTID,
  WHATSAPP_VARIABLE_CONFIRM_SUBMIT_TESTID,
  WHATSAPP_VARIABLE_CONFIRM_WARNING_TESTID,
  WHATSAPP_VARIABLE_ERROR_TESTID,
  WHATSAPP_VARIABLE_FORM_TEXTS,
  WHATSAPP_VARIABLE_KEY_ERROR_TESTID,
  WHATSAPP_VARIABLE_KEY_TESTID,
  WHATSAPP_VARIABLE_LABEL_ERROR_TESTID,
  WHATSAPP_VARIABLE_LABEL_TESTID,
  WHATSAPP_VARIABLE_SAVE_TESTID,
  WHATSAPP_VARIABLE_SHEET_TESTID,
  WHATSAPP_VARIABLE_TITLE_TESTID,
  WHATSAPP_VARIABLE_VALUE_ERROR_TESTID,
  WHATSAPP_VARIABLE_VALUE_TESTID,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-variable-form-sheet';
import {
  WHATSAPP_NEW_VARIABLE_TESTID,
  WhatsappVariablesPanel,
  ownVariableEditTestId,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-variables-panel';
import type { ErrorState } from '@/lib/modules/errores';
import type { WhatsappDictionaryEntryView } from '@/lib/modules/integraciones';
import type { WhatsappVariableKeyResult } from '@/lib/modules/integraciones/adapters/driving/whatsapp-variable-key-actions';

import { setupUser } from '../../helpers/user-event';
import { resetViewport, setViewportWidth, WIDE_VIEWPORT } from '../../helpers/viewport';

type User = ReturnType<typeof setupUser>;

const { createMock, updateMock, refreshMock, toastSuccessMock } = vi.hoisted(() => ({
  createMock: vi.fn<(input: unknown) => Promise<WhatsappVariableKeyResult>>(),
  updateMock: vi.fn<(id: string, input: unknown) => Promise<WhatsappVariableKeyResult>>(),
  refreshMock: vi.fn<() => void>(),
  toastSuccessMock: vi.fn(),
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-variable-key-actions', () => ({
  createWhatsappVariableKeyAction: createMock,
  updateWhatsappVariableKeyAction: updateMock,
  deleteWhatsappVariableKeyAction: vi.fn(),
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
  value: 'Lunes a viernes',
  usedBy: 0,
};

const FALLO: ErrorState = { status: 'error', code: 'whatsapp_variable_key_taken', message: 'Ya existe esa clave.' };

function montar(entries: readonly WhatsappDictionaryEntryView[] = [CUENTA, HORARIO]) {
  return render(<WhatsappVariablesPanel entries={entries} hasConnection />);
}

const etiqueta = () => screen.getByTestId(WHATSAPP_VARIABLE_LABEL_TESTID) as HTMLInputElement;
const clave = () => screen.getByTestId(WHATSAPP_VARIABLE_KEY_TESTID) as HTMLInputElement;
const valor = () => screen.getByTestId(WHATSAPP_VARIABLE_VALUE_TESTID) as HTMLInputElement;
const guardar = () => screen.getByTestId(WHATSAPP_VARIABLE_SAVE_TESTID);

async function abrirNueva(user: User) {
  await user.click(screen.getByTestId(WHATSAPP_NEW_VARIABLE_TESTID));
  await screen.findByTestId(WHATSAPP_VARIABLE_SHEET_TESTID);
}

async function abrirEditar(user: User, entry: WhatsappDictionaryEntryView) {
  await user.click(screen.getByTestId(ownVariableEditTestId(entry.id)));
  await screen.findByTestId(WHATSAPP_VARIABLE_SHEET_TESTID);
}

// `paste` y no `type`: `user-event` lee `{` como inicio de una tecla.
async function escribir(user: User, campo: HTMLElement, texto: string) {
  await user.clear(campo);
  if (texto !== '') await user.paste(texto);
}

beforeEach(() => {
  vi.clearAllMocks();
  setViewportWidth(WIDE_VIEWPORT);
});

afterEach(() => {
  cleanup();
  resetViewport();
});

describe('nueva variable', () => {
  it('R50: «Nueva variable» abre el panel con su texto, Etiqueta, Clave de solo lectura y Valor con sus ayudas', async () => {
    const user = setupUser();
    montar();
    await abrirNueva(user);

    const panel = screen.getByTestId(WHATSAPP_VARIABLE_SHEET_TESTID);
    expect(screen.getByTestId(WHATSAPP_VARIABLE_TITLE_TESTID)).toHaveTextContent('Nueva variable');
    expect(within(panel).getByText('Un dato fijo de tu empresa para usar en las plantillas.')).toBeTruthy();
    expect(within(panel).getByLabelText(/^Etiqueta/)).toBe(etiqueta());
    expect(within(panel).getByLabelText('Clave')).toBe(clave());
    expect(within(panel).getByLabelText(/^Valor/)).toBe(valor());
    expect(etiqueta()).toHaveAccessibleDescription('Cómo se ve en la app. Hasta 60 caracteres.');
    expect(clave()).toHaveAccessibleDescription(
      'Se arma sola desde la etiqueta: sin tildes ni mayúsculas, espacios como _. No se puede cambiar después.',
    );
    expect(valor()).toHaveAccessibleDescription('Lo que se envía al cliente. Hasta 50 caracteres.');
    expect(clave()).toHaveAttribute('readonly');
    expect(etiqueta()).toHaveValue('');
    expect(valor()).toHaveValue('');
    expect(guardar()).toBeDisabled();
  });

  it('R51: la Clave sigue a la etiqueta mientras se escribe y no se puede escribir en ella', async () => {
    const user = setupUser();
    montar();
    await abrirNueva(user);

    await user.type(etiqueta(), 'Cuenta de ahorros');
    expect(clave()).toHaveValue('cuenta_de_ahorros');
    await escribir(user, etiqueta(), '2º Horario de atención!');
    expect(clave()).toHaveValue('horario_de_atencion');
    await escribir(user, etiqueta(), 'Ñandú   Pérez');
    expect(clave()).toHaveValue('nandu_perez');

    await user.type(clave(), 'otra');
    expect(clave()).toHaveValue('nandu_perez');
  });

  it('R52: una etiqueta sin letras deja la clave vacía, lo dice en Clave y no deja guardar', async () => {
    const user = setupUser();
    montar();
    await abrirNueva(user);
    expect(screen.queryByTestId(WHATSAPP_VARIABLE_KEY_ERROR_TESTID)).toBeNull();

    await user.type(etiqueta(), '123');
    await user.type(valor(), 'algo');
    expect(clave()).toHaveValue('');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_KEY_ERROR_TESTID)).toHaveTextContent(
      'La etiqueta tiene que tener al menos una letra.',
    );
    expect(clave()).toHaveAttribute('aria-invalid', 'true');
    expect(guardar()).toBeDisabled();
  });

  it('R52: la clave de otra variable propia o de una constante se marca en Clave y no deja guardar', async () => {
    const user = setupUser();
    montar();
    await abrirNueva(user);
    await user.type(valor(), 'algo');

    await user.type(etiqueta(), 'Numero de cuenta');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_KEY_ERROR_TESTID)).toHaveTextContent(
      'Ya hay una variable con la clave numero_de_cuenta.',
    );
    expect(guardar()).toBeDisabled();

    await escribir(user, etiqueta(), 'Nombre del cliente');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_KEY_ERROR_TESTID)).toHaveTextContent(
      'Ya hay una variable con la clave nombre_del_cliente.',
    );
    expect(guardar()).toBeDisabled();

    await user.click(guardar());
    expect(createMock).not.toHaveBeenCalled();
  });

  it('R53: etiqueta y valor se validan con el dominio y cada problema sale en su campo', async () => {
    const user = setupUser();
    montar();
    await abrirNueva(user);

    await escribir(user, etiqueta(), 'x'.repeat(61));
    expect(screen.getByTestId(WHATSAPP_VARIABLE_LABEL_ERROR_TESTID)).toHaveTextContent(
      'La etiqueta admite como mucho 60 caracteres.',
    );
    await escribir(user, etiqueta(), 'Cuenta');
    expect(screen.queryByTestId(WHATSAPP_VARIABLE_LABEL_ERROR_TESTID)).toBeNull();

    await escribir(user, valor(), 'Cuenta {{1}}');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_VALUE_ERROR_TESTID)).toHaveTextContent('El valor no admite {{ ni }}.');
    expect(valor()).toHaveAttribute('aria-invalid', 'true');
    expect(guardar()).toBeDisabled();

    await escribir(user, valor(), '');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_VALUE_ERROR_TESTID)).toHaveTextContent('El valor es obligatorio.');
    expect(guardar()).toBeDisabled();
  });

  it('R54 y R58: guarda con clave, etiqueta y valor (sin descripción), cierra, avisa «Variable creada.» y pide la lista nueva', async () => {
    const user = setupUser();
    createMock.mockResolvedValue({
      status: 'success',
      data: { id: 'v9', key: 'cuenta_de_ahorros', label: 'Cuenta de ahorros', value: '2200', usedBy: 0 },
    });
    montar();
    await abrirNueva(user);
    await user.type(etiqueta(), 'Cuenta de ahorros');
    await user.type(valor(), '2200');
    await user.click(guardar());

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Variable creada.'));
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]?.[0]).toStrictEqual({ key: 'cuenta_de_ahorros', label: 'Cuenta de ahorros', value: '2200' });
    expect(refreshMock).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId(WHATSAPP_VARIABLE_SHEET_TESTID)).toBeNull());
  });

  it('R54: si la creación falla, el panel sigue abierto con lo escrito y el mensaje del error', async () => {
    const user = setupUser();
    createMock.mockResolvedValue(FALLO);
    montar();
    await abrirNueva(user);
    await user.type(etiqueta(), 'Cuenta de ahorros');
    await user.type(valor(), '2200');
    await user.click(guardar());

    expect(await screen.findByTestId(WHATSAPP_VARIABLE_ERROR_TESTID)).toHaveTextContent('Ya existe esa clave.');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_SHEET_TESTID)).toBeInTheDocument();
    expect(etiqueta()).toHaveValue('Cuenta de ahorros');
    expect(valor()).toHaveValue('2200');
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('R58: el panel no tiene campo Descripción', async () => {
    const user = setupUser();
    montar();
    await abrirNueva(user);
    const panel = screen.getByTestId(WHATSAPP_VARIABLE_SHEET_TESTID);
    expect(within(panel).queryByLabelText(/Descripción/)).toBeNull();
    expect(within(panel).queryByText(/Para qué sirve el dato/)).toBeNull();
    expect(within(panel).queryAllByRole('textbox')).toHaveLength(3);
  });
});

describe('editar variable', () => {
  it('R55: «Editar variable» con su clave fija, su ayuda y el valor con cuántas plantillas la usan', async () => {
    const user = setupUser();
    montar();
    await abrirEditar(user, CUENTA);

    expect(screen.getByTestId(WHATSAPP_VARIABLE_TITLE_TESTID)).toHaveTextContent('Editar variable');
    expect(etiqueta()).toHaveValue('Número de cuenta');
    expect(clave()).toHaveValue('numero_de_cuenta');
    expect(clave()).toHaveAttribute('readonly');
    expect(clave()).toHaveAccessibleDescription('La clave no se cambia después de crear la variable.');
    expect(valor()).toHaveValue('2200345678');
    expect(valor()).toHaveAccessibleDescription(
      'Lo usan 2 plantillas. El valor nuevo se envía desde el próximo mensaje. Hasta 50 caracteres.',
    );
  });

  it('R55: sin uso, la ayuda del valor es la de siempre', async () => {
    const user = setupUser();
    montar();
    await abrirEditar(user, HORARIO);
    expect(valor()).toHaveAccessibleDescription('Lo que se envía al cliente. Hasta 50 caracteres.');
  });

  it('R55: cambiar la etiqueta de una en uso no cambia la clave y se guarda con la clave guardada, sin diálogo', async () => {
    const user = setupUser();
    updateMock.mockResolvedValue({ status: 'success', data: { ...CUENTA, label: 'Cuenta corriente' } });
    montar();
    await abrirEditar(user, CUENTA);

    await escribir(user, etiqueta(), 'Cuenta corriente');
    expect(clave()).toHaveValue('numero_de_cuenta');
    await user.click(guardar());

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Variable actualizada.'));
    expect(screen.queryByTestId(WHATSAPP_VARIABLE_CONFIRM_DIALOG_TESTID)).toBeNull();
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0]?.[0]).toBe(CUENTA.id);
    expect(updateMock.mock.calls[0]?.[1]).toStrictEqual({
      key: 'numero_de_cuenta',
      label: 'Cuenta corriente',
      value: '2200345678',
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it('R56: sin uso, cambiar el valor guarda sin diálogo y avisa «Variable actualizada.»', async () => {
    const user = setupUser();
    updateMock.mockResolvedValue({ status: 'success', data: { ...HORARIO, value: 'Lunes a sábado' } });
    montar();
    await abrirEditar(user, HORARIO);

    await escribir(user, valor(), 'Lunes a sábado');
    await user.click(guardar());

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Variable actualizada.'));
    expect(screen.queryByTestId(WHATSAPP_VARIABLE_CONFIRM_DIALOG_TESTID)).toBeNull();
    expect(updateMock).toHaveBeenCalledWith(HORARIO.id, {
      key: 'horario_de_atencion',
      label: 'Horario de atención',
      value: 'Lunes a sábado',
    });
  });

  it('R56: en uso y con valor nuevo, «Revisa el cambio» con antes y ahora; «Volver a revisar» vuelve sin guardar', async () => {
    const user = setupUser();
    montar();
    await abrirEditar(user, CUENTA);

    await escribir(user, valor(), '2200345679');
    await user.click(guardar());

    const dialogo = await screen.findByTestId(WHATSAPP_VARIABLE_CONFIRM_DIALOG_TESTID);
    expect(within(dialogo).getByRole('heading', { name: 'Revisa el cambio' })).toBeTruthy();
    expect(screen.getByTestId(WHATSAPP_VARIABLE_CONFIRM_MESSAGE_TESTID)).toHaveTextContent(
      '«Número de cuenta» se envía en 2 plantillas. Desde el próximo mensaje, los clientes recibirán el valor nuevo.',
    );
    expect(within(dialogo).getByText('Antes')).toBeTruthy();
    expect(within(dialogo).getByText('Ahora')).toBeTruthy();
    expect(screen.getByTestId(WHATSAPP_VARIABLE_CONFIRM_BEFORE_TESTID)).toHaveTextContent('2200345678');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_CONFIRM_BEFORE_TESTID)).toHaveClass('line-through');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_CONFIRM_AFTER_TESTID)).toHaveTextContent('2200345679');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_CONFIRM_DISMISS_TESTID)).toHaveTextContent('Volver a revisar');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_CONFIRM_SUBMIT_TESTID)).toHaveTextContent('Guardar cambio');
    expect(updateMock).not.toHaveBeenCalled();

    await user.click(screen.getByTestId(WHATSAPP_VARIABLE_CONFIRM_DISMISS_TESTID));
    await waitFor(() => expect(screen.queryByTestId(WHATSAPP_VARIABLE_CONFIRM_DIALOG_TESTID)).toBeNull());
    expect(updateMock).not.toHaveBeenCalled();
    expect(valor()).toHaveValue('2200345679');
  });

  it('R56: «Guardar cambio» guarda con la clave guardada y avisa que el valor nuevo va desde el próximo mensaje', async () => {
    const user = setupUser();
    updateMock.mockResolvedValue({ status: 'success', data: { ...CUENTA, value: '2200345679' } });
    montar();
    await abrirEditar(user, CUENTA);
    await escribir(user, valor(), '2200345679');
    await user.click(guardar());
    await user.click(await screen.findByTestId(WHATSAPP_VARIABLE_CONFIRM_SUBMIT_TESTID));

    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        'Variable actualizada. El valor nuevo se envía desde el próximo mensaje.',
      ),
    );
    expect(updateMock).toHaveBeenCalledWith(CUENTA.id, {
      key: 'numero_de_cuenta',
      label: 'Número de cuenta',
      value: '2200345679',
    });
    expect(refreshMock).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId(WHATSAPP_VARIABLE_SHEET_TESTID)).toBeNull());
  });

  it('R56: si guardar el cambio falla, el diálogo sigue con el mensaje del error', async () => {
    const user = setupUser();
    updateMock.mockResolvedValue(FALLO);
    montar();
    await abrirEditar(user, CUENTA);
    await escribir(user, valor(), '2200345679');
    await user.click(guardar());
    await user.click(await screen.findByTestId(WHATSAPP_VARIABLE_CONFIRM_SUBMIT_TESTID));

    expect(await screen.findByTestId(WHATSAPP_VARIABLE_CONFIRM_ERROR_TESTID)).toHaveTextContent('Ya existe esa clave.');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_CONFIRM_DIALOG_TESTID)).toBeInTheDocument();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('R57: con espacios de más o sin el formato de solo números de antes, el diálogo avisa', async () => {
    const user = setupUser();
    montar();
    await abrirEditar(user, CUENTA);
    await escribir(user, valor(), '22003456 78');
    await user.click(guardar());

    await screen.findByTestId(WHATSAPP_VARIABLE_CONFIRM_DIALOG_TESTID);
    expect(screen.getByTestId(WHATSAPP_VARIABLE_CONFIRM_WARNING_TESTID)).toHaveTextContent(
      'El valor nuevo tiene espacios de más o no tiene el mismo formato que el anterior (antes solo números). Revísalo.',
    );
  });

  it('R57: con el mismo formato, el diálogo no avisa', async () => {
    const user = setupUser();
    montar();
    await abrirEditar(user, CUENTA);
    await escribir(user, valor(), '2200345679');
    await user.click(guardar());

    await screen.findByTestId(WHATSAPP_VARIABLE_CONFIRM_DIALOG_TESTID);
    expect(screen.queryByTestId(WHATSAPP_VARIABLE_CONFIRM_WARNING_TESTID)).toBeNull();
  });
});

describe('transversal', () => {
  it('R37: los textos del panel y del diálogo no nombran a Meta ni a la empresa', () => {
    const { valueHintInUse, confirmDescription, ...fijos } = WHATSAPP_VARIABLE_FORM_TEXTS;
    const textos = [...Object.values(fijos), valueHintInUse(2), confirmDescription('X', 2)];
    for (const texto of textos) {
      expect(texto).not.toMatch(/Meta|QuimiCloude/);
    }
  });

  it('R60: campos de 16 px y 44 px de alto, y botones de 44 px', async () => {
    const user = setupUser();
    montar();
    await abrirNueva(user);
    for (const campo of [etiqueta(), clave(), valor()]) {
      expect(campo).toHaveClass('min-h-11', 'text-base', 'md:text-base');
    }
    expect(screen.getByTestId(WHATSAPP_VARIABLE_CLOSE_TESTID)).toHaveAccessibleName('Cerrar');
    expect(screen.getByTestId(WHATSAPP_VARIABLE_CLOSE_TESTID)).toHaveClass('min-h-11', 'min-w-11');
  });
});
