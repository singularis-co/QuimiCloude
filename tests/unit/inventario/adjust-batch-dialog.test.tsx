import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdjustBatchDialog } from '@/app/(private)/inventario/components';
import type { AdjustBatchStockFormState } from '@/lib/modules/inventario/adapters/driving/batch-actions';
import type { ProductBatchView } from '@/lib/modules/inventario';
import { ADJUST_FORM_STATES } from '../../fixtures/adjust-batch-stock';
import { esperarInteractiva, setupUser } from '../../helpers/user-event';

/**
 * La Server Action `adjustBatchStockAction` esta mockeada: es el borde del modulo `inventario`,
 * mismo criterio que `batch-history.test.tsx` y `product-page.test.tsx`.
 */

const { routerMock, adjustBatchStockActionMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  adjustBatchStockActionMock:
    vi.fn<
      (prev: AdjustBatchStockFormState, data: FormData) => Promise<AdjustBatchStockFormState>
    >(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/inventario/adapters/driving/batch-actions', () => ({
  adjustBatchStockAction: adjustBatchStockActionMock,
}));

type User = ReturnType<typeof setupUser>;

function lote(overrides: Partial<ProductBatchView> = {}): ProductBatchView {
  return {
    id: 'batch-42',
    lot: 'L-001',
    stock: '10',
    unitId: 'unit-kg',
    purchaseDate: '2026-03-05',
    expiryDate: null,
    packageContent: null,
    ...overrides,
  };
}

let toastExito: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  adjustBatchStockActionMock.mockResolvedValue(ADJUST_FORM_STATES.success);
  toastExito = vi.spyOn(toast, 'success');
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.restoreAllMocks();
});

async function abrirDialogo(user: User) {
  await user.click(screen.getByTestId('adjust-batch-open'));
  return screen.getByTestId('adjust-batch-dialog');
}

async function escribirTotal(user: User, total: string) {
  const campo = screen.getByTestId('adjust-batch-counted');
  await user.clear(campo);
  if (total !== '') await user.type(campo, total);
}

async function elegirMotivo(user: User, etiqueta: string) {
  await user.click(screen.getByTestId('adjust-batch-reason'));
  await user.click(await esperarInteractiva(await screen.findByRole('option', { name: etiqueta })));
  await waitFor(() => expect(screen.queryByRole('option', { name: etiqueta })).toBeNull());
  await waitFor(() => expect(screen.getByTestId('adjust-batch-reason')).toHaveFocus());
}

/** Abre el selector y devuelve las etiquetas ofrecidas; lo deja abierto. */
async function opcionesDeMotivo(user: User): Promise<string[]> {
  await user.click(screen.getByTestId('adjust-batch-reason'));
  const opciones = await screen.findAllByTestId('adjust-batch-reason-option');
  return opciones.map((opcion) => opcion.textContent ?? '');
}

function selectorDeshabilitado(): boolean {
  return screen.getByTestId('adjust-batch-reason').hasAttribute('data-disabled');
}

function enviado(llamada: number): FormData {
  return adjustBatchStockActionMock.mock.calls[llamada]![1];
}

describe('el dialogo pide el total contado frente a la existencia registrada', () => {
  it('R1 — muestra la existencia registrada y un unico campo de total contado, sin campo con signo', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    const dialogo = await abrirDialogo(user);

    expect(screen.getByTestId('adjust-batch-recorded-stock')).toHaveValue('10');
    expect(dialogo).toHaveTextContent('Existencia registrada');
    const campo = screen.getByTestId('adjust-batch-counted');
    expect(campo).toHaveAttribute('name', 'countedStock');
    expect(campo).toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByLabelText('Total contado')).toBe(campo);
    expect(screen.queryByTestId('adjust-batch-delta')).toBeNull();
    expect(dialogo.querySelector('[name="delta"]')).toBeNull();
    const registrada = screen.getByTestId('adjust-batch-recorded-stock');
    expect(within(dialogo).getAllByRole('textbox')).toEqual([registrada, campo]);
    expect(within(dialogo).queryByRole('spinbutton')).toBeNull();
  });

  it('R1 — el campo de total no admite signo: el menos se descarta y la coma pasa a punto', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '-5');
    expect(screen.getByTestId('adjust-batch-counted')).toHaveValue('5');

    await escribirTotal(user, '1,5');
    expect(screen.getByTestId('adjust-batch-counted')).toHaveValue('1.5');
  });

  it('R1 — la existencia registrada se pinta redondeada con la cifra exacta en el title', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote({ stock: '12.3456' })} canAdjust />);

    await abrirDialogo(user);
    const existencia = screen.getByTestId('adjust-batch-recorded-stock');
    expect(existencia).toHaveValue('12.35');
    expect(existencia).toHaveAttribute('title', '12.3456');
  });

  it('R2 — un total mayor muestra «Aumento de X» y uno menor «Disminucion de X», con X en valor absoluto', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '15');
    const aumento = screen.getByTestId('adjust-batch-difference');
    expect(aumento).toHaveTextContent('Aumento de 5');
    expect(aumento).toHaveAttribute('data-direction', 'increase');

    await escribirTotal(user, '7.5');
    const disminucion = screen.getByTestId('adjust-batch-difference');
    expect(disminucion).toHaveTextContent('Disminución de 2.5');
    expect(disminucion).toHaveAttribute('data-direction', 'decrease');
    expect(disminucion).not.toHaveTextContent('-');
  });

  it('R2 — la diferencia es exacta, sin redondear a dos decimales', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '10.0001');
    expect(screen.getByTestId('adjust-batch-difference')).toHaveTextContent('Aumento de 0.0001');
  });

  it('R2, R5 — sin total, con un total parcial o igual a la existencia no se muestra diferencia', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    expect(screen.queryByTestId('adjust-batch-difference')).toBeNull();
    await escribirTotal(user, '12.');
    expect(screen.queryByTestId('adjust-batch-difference')).toBeNull();
    await escribirTotal(user, '10.0000');
    expect(screen.queryByTestId('adjust-batch-difference')).toBeNull();
  });

  it('R3 — confirmar un total igual a la existencia registrada avisa y NO invoca la action', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '10.00');
    await user.click(screen.getByTestId('adjust-batch-confirm'));

    const aviso = await screen.findByTestId('adjust-batch-zero-error');
    expect(aviso).toHaveAttribute('role', 'alert');
    expect(aviso).toHaveTextContent('El total contado es igual a la existencia registrada.');
    const describedBy = screen.getByTestId('adjust-batch-counted').getAttribute('aria-describedby');
    expect(describedBy?.split(' ')).toContain(aviso.id);
    expect(adjustBatchStockActionMock).not.toHaveBeenCalled();
  });
});

describe('el motivo depende del sentido de la diferencia', () => {
  it('R4 — en un aumento solo se ofrecen conteo fisico y error de carga', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '12');

    expect(await opcionesDeMotivo(user)).toEqual(['Conteo físico', 'Error de carga']);
  });

  it('R4 — en una disminucion se ofrecen los cuatro motivos', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '8');

    expect(await opcionesDeMotivo(user)).toEqual([
      'Merma',
      'Rotura',
      'Conteo físico',
      'Error de carga',
    ]);
  });

  it('R5 — el selector esta deshabilitado sin total, con un total parcial o igual a la existencia', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    expect(selectorDeshabilitado()).toBe(true);
    await escribirTotal(user, '9.');
    expect(selectorDeshabilitado()).toBe(true);
    await escribirTotal(user, '10');
    expect(selectorDeshabilitado()).toBe(true);
    await escribirTotal(user, '11');
    expect(selectorDeshabilitado()).toBe(false);
  });

  it('R6 — pasar de disminucion a aumento deja sin elegir un motivo que el aumento no admite', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '8');
    await elegirMotivo(user, 'Merma');
    expect(screen.getByTestId('adjust-batch-reason')).toHaveTextContent('Merma');

    await escribirTotal(user, '12');
    expect(screen.getByTestId('adjust-batch-reason')).not.toHaveTextContent('Merma');

    // Volver al sentido anterior no lo resucita: quedo sin elegir.
    await escribirTotal(user, '8');
    expect(screen.getByTestId('adjust-batch-reason')).not.toHaveTextContent('Merma');
  });

  it('R6 — un motivo valido para los dos sentidos se conserva al cambiar de sentido', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '8');
    await elegirMotivo(user, 'Conteo físico');
    await escribirTotal(user, '12');

    expect(screen.getByTestId('adjust-batch-reason')).toHaveTextContent('Conteo físico');
  });

  it('R25 — sin motivo, «Elige un motivo.» sale bajo el campo, lo marca inválido y lo describe, y NO invoca la action', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '5');
    const selector = screen.getByTestId('adjust-batch-reason');
    expect(selector).not.toHaveAttribute('aria-invalid');
    await user.click(screen.getByTestId('adjust-batch-confirm'));

    const aviso = await screen.findByTestId('adjust-batch-reason-error');
    expect(aviso).toHaveAttribute('role', 'alert');
    expect(aviso).toHaveTextContent('Elige un motivo.');
    expect(aviso.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(selector).toHaveAttribute('aria-invalid', 'true');
    expect(selector.getAttribute('aria-describedby')?.split(' ')).toContain(aviso.id);
    // Debajo del selector, no arriba del formulario.
    expect(selector.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('adjust-batch-counted').compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('adjust-batch-dialog')).not.toHaveTextContent('Elegi un motivo');
    expect(adjustBatchStockActionMock).not.toHaveBeenCalled();
  });

  it('un total a medio escribir avisa y NO invoca la action', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '5.');
    await user.click(screen.getByTestId('adjust-batch-confirm'));

    expect(await screen.findByTestId('adjust-batch-counted-error')).toHaveAttribute('role', 'alert');
    expect(adjustBatchStockActionMock).not.toHaveBeenCalled();
  });
});

describe('el envio y la respuesta del servidor', () => {
  it('R8 — el FormData lleva exactamente batchId, countedStock, seenStock y reason, sin diferencia', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '7');
    await elegirMotivo(user, 'Merma');
    await user.click(screen.getByTestId('adjust-batch-confirm'));

    await waitFor(() => expect(adjustBatchStockActionMock).toHaveBeenCalledTimes(1));
    const datos = enviado(0);
    expect([...datos.keys()].sort()).toEqual(['batchId', 'countedStock', 'reason', 'seenStock']);
    expect(datos.get('batchId')).toBe('batch-42');
    expect(datos.get('countedStock')).toBe('7');
    expect(datos.get('seenStock')).toBe('10');
    expect(datos.get('reason')).toBe('merma');
  });

  it('R8 — un aumento tambien viaja como total, nunca como cantidad con signo', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote({ stock: '10.0000' })} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '12.25');
    await elegirMotivo(user, 'Error de carga');
    await user.click(screen.getByTestId('adjust-batch-confirm'));

    await waitFor(() => expect(adjustBatchStockActionMock).toHaveBeenCalledTimes(1));
    const datos = enviado(0);
    expect(datos.get('countedStock')).toBe('12.25');
    expect(datos.get('seenStock')).toBe('10.0000');
    expect(datos.get('reason')).toBe('error_de_carga');
    expect(datos.has('delta')).toBe(false);
  });

  it('con exito cierra, avisa por toast y refresca', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '7');
    await elegirMotivo(user, 'Merma');
    await user.click(screen.getByTestId('adjust-batch-confirm'));

    await waitFor(() => expect(screen.queryByTestId('adjust-batch-dialog')).toBeNull());
    expect(toastExito).toHaveBeenCalledTimes(1);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('adjust-batch-over-reserved')).toBeNull();
  });

  it('R9 — con el lote sobre-reservado, muestra el aviso y el dialogo sigue abierto', async () => {
    adjustBatchStockActionMock.mockResolvedValue(ADJUST_FORM_STATES.successOverReserved);
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '2');
    await elegirMotivo(user, 'Merma');
    await user.click(screen.getByTestId('adjust-batch-confirm'));

    const aviso = await screen.findByTestId('adjust-batch-over-reserved');
    expect(aviso).toHaveAttribute('role', 'alert');
    expect(aviso).toHaveTextContent(
      'El lote queda sobre-reservado: hay pedidos sin cobertura completa.',
    );
    expect(screen.getByTestId('adjust-batch-dialog')).toBeInTheDocument();
    expect(toastExito).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('adjust-batch-cancel'));
    await waitFor(() => expect(screen.queryByTestId('adjust-batch-dialog')).toBeNull());
  });

  it('con error el dialogo sigue abierto con el mensaje del catalogo a la vista', async () => {
    adjustBatchStockActionMock.mockResolvedValue(ADJUST_FORM_STATES.reasonNotAllowed);
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '12');
    await elegirMotivo(user, 'Conteo físico');
    await user.click(screen.getByTestId('adjust-batch-confirm'));

    const aviso = await screen.findByTestId('adjust-batch-error');
    expect(aviso).toHaveAttribute('role', 'alert');
    expect(aviso).toHaveAttribute('data-code', 'adjustment_reason_not_allowed');
    expect(aviso).toHaveTextContent(ADJUST_FORM_STATES.reasonNotAllowed.message);
    expect(screen.getByTestId('adjust-batch-dialog')).toBeInTheDocument();
    expect(toastExito).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it('un error inesperado muestra su referencia', async () => {
    adjustBatchStockActionMock.mockResolvedValue(ADJUST_FORM_STATES.unexpected);
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '7');
    await elegirMotivo(user, 'Merma');
    await user.click(screen.getByTestId('adjust-batch-confirm'));

    const aviso = await screen.findByTestId('adjust-batch-error');
    expect(aviso).toHaveAttribute('data-code', 'unexpected');
    expect(aviso).toHaveTextContent(ADJUST_FORM_STATES.unexpected.reference);
  });
});

describe('rechazo por existencia cambiada', () => {
  async function confirmarConExistenciaCambiada(user: User) {
    adjustBatchStockActionMock.mockResolvedValueOnce(ADJUST_FORM_STATES.stockChanged);
    await abrirDialogo(user);
    await escribirTotal(user, '9');
    await elegirMotivo(user, 'Merma');
    await user.click(screen.getByTestId('adjust-batch-confirm'));
    return screen.findByTestId('adjust-batch-stock-changed');
  }

  it('R10 — muestra el mensaje, la existencia actual, la diferencia recalculada y limpia el motivo que ya no vale, sin reenviar', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    const aviso = await confirmarConExistenciaCambiada(user);

    expect(aviso).toHaveAttribute('role', 'alert');
    expect(aviso).toHaveTextContent(ADJUST_FORM_STATES.stockChanged.message);
    expect(screen.getByTestId('adjust-batch-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('adjust-batch-recorded-stock')).toHaveValue('8');
    expect(screen.getByTestId('adjust-batch-seen-stock')).toHaveValue('8.0000');
    expect(screen.getByTestId('adjust-batch-counted')).toHaveValue('9');

    const diferencia = screen.getByTestId('adjust-batch-difference');
    expect(diferencia).toHaveTextContent('Aumento de 1');
    expect(diferencia).toHaveAttribute('data-direction', 'increase');
    // Merma no vale para un aumento: queda sin elegir y las opciones son las del aumento.
    expect(screen.getByTestId('adjust-batch-reason')).not.toHaveTextContent('Merma');
    expect(await opcionesDeMotivo(user)).toEqual(['Conteo físico', 'Error de carga']);

    expect(adjustBatchStockActionMock).toHaveBeenCalledTimes(1);
    expect(toastExito).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it('R10 — si el sentido recalculado admite el motivo elegido, se conserva', async () => {
    adjustBatchStockActionMock.mockResolvedValueOnce(ADJUST_FORM_STATES.stockChanged);
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '5');
    await elegirMotivo(user, 'Merma');
    await user.click(screen.getByTestId('adjust-batch-confirm'));

    await screen.findByTestId('adjust-batch-stock-changed');
    expect(screen.getByTestId('adjust-batch-difference')).toHaveTextContent('Disminución de 3');
    expect(screen.getByTestId('adjust-batch-reason')).toHaveTextContent('Merma');
  });

  it('R11 — la siguiente confirmacion envia como existencia vista la existencia actual recibida', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await confirmarConExistenciaCambiada(user);
    await elegirMotivo(user, 'Conteo físico');
    await user.click(screen.getByTestId('adjust-batch-confirm'));

    await waitFor(() => expect(adjustBatchStockActionMock).toHaveBeenCalledTimes(2));
    expect(enviado(0).get('seenStock')).toBe('10');
    const segundo = enviado(1);
    expect(segundo.get('seenStock')).toBe(ADJUST_FORM_STATES.stockChanged.currentStock);
    expect(segundo.get('countedStock')).toBe('9');
    expect(segundo.get('reason')).toBe('conteo_fisico');
    await waitFor(() => expect(screen.queryByTestId('adjust-batch-dialog')).toBeNull());
  });

  it('R10 — al cerrar y reabrir vuelve a la existencia del lote, sin el aviso del rechazo', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await confirmarConExistenciaCambiada(user);
    await user.click(screen.getByTestId('adjust-batch-cancel'));
    await waitFor(() => expect(screen.queryByTestId('adjust-batch-dialog')).toBeNull());

    await abrirDialogo(user);
    expect(screen.getByTestId('adjust-batch-recorded-stock')).toHaveValue('10');
    expect(screen.queryByTestId('adjust-batch-stock-changed')).toBeNull();
    expect(screen.getByTestId('adjust-batch-counted')).toHaveValue('');
  });
});

describe('el Operador, que solo tiene inventario.consultar, no encuentra el control', () => {
  it('R21 — sin canAdjust el disparador del ajuste no existe en el DOM, ni abierto desde fuera', () => {
    render(
      <>
        <AdjustBatchDialog batch={lote()} canAdjust={false} />
        <AdjustBatchDialog batch={lote({ id: 'batch-43' })} canAdjust={false} open onOpenChange={() => undefined} />
      </>,
    );

    expect(screen.queryByTestId('adjust-batch-open')).toBeNull();
    expect(screen.queryByTestId('adjust-batch-dialog')).toBeNull();
    expect(screen.queryByTestId('adjust-batch-counted')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ajustar existencia' })).toBeNull();
  });

  it('R21 — con canAdjust el control SI esta', () => {
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    expect(screen.getByTestId('adjust-batch-open')).toBeInTheDocument();
  });
});

describe('aviso de solo restar en lotes de producto terminado', () => {
  it('con productType FINISHED_PRODUCT muestra el texto visible', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust productType="FINISHED_PRODUCT" />);

    await abrirDialogo(user);
    expect(screen.getByTestId('adjust-batch-finished-product-notice')).toHaveTextContent(
      'Solo se admiten ajustes que restan.',
    );
  });

  it('con otro tipo de producto, no aparece', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust productType="PRODUCT" />);

    await abrirDialogo(user);
    expect(screen.queryByTestId('adjust-batch-finished-product-notice')).toBeNull();
  });

  it('sin productType, no aparece', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    expect(screen.queryByTestId('adjust-batch-finished-product-notice')).toBeNull();
  });
});

describe('aspecto del rediseño', () => {
  it('R24 — debajo del título, «<producto> · Lote <lote>», con el lote en cifras tabulares', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote({ lot: 'L-2026-0912' })} canAdjust productName="Hipoclorito de sodio 13 %" />);

    const dialogo = await abrirDialogo(user);
    expect(within(dialogo).getByRole('heading', { name: 'Ajustar existencia' })).toBeInTheDocument();
    const descripcion = screen.getByTestId('adjust-batch-description');
    expect(descripcion).toHaveTextContent('Hipoclorito de sodio 13 % · Lote L-2026-0912');
    expect(within(descripcion).getByText('L-2026-0912')).toHaveClass('font-mono', 'tabular-nums');
    expect(dialogo).toHaveAccessibleDescription('Hipoclorito de sodio 13 % · Lote L-2026-0912');
  });

  it('R24 — sin el nombre del producto, solo el lote', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    expect(screen.getByTestId('adjust-batch-description')).toHaveTextContent(/^Lote L-001$/);
  });

  it('R24 — «Existencia registrada» es un campo deshabilitado, con su etiqueta y sin viajar en el envío', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote({ stock: '12.3456' })} canAdjust />);

    await abrirDialogo(user);
    const registrada = screen.getByTestId('adjust-batch-recorded-stock');
    expect(registrada.tagName).toBe('INPUT');
    expect(registrada).toBeDisabled();
    expect(registrada).toHaveValue('12.35');
    expect(screen.getByLabelText('Existencia registrada')).toBe(registrada);
    expect(registrada).not.toHaveAttribute('name');
    expect(registrada.className).toMatch(/min-h-11/);
  });

  it('R24 — la diferencia lleva una flecha hacia abajo al disminuir y hacia arriba al aumentar', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '7');
    const disminucion = screen.getByTestId('adjust-batch-difference');
    expect(within(disminucion).getByTestId('adjust-batch-difference-decrease-icon')).toHaveAttribute('aria-hidden', 'true');
    expect(within(disminucion).queryByTestId('adjust-batch-difference-increase-icon')).toBeNull();
    expect(disminucion).toHaveTextContent('Disminución de 3');

    await escribirTotal(user, '12');
    const aumento = screen.getByTestId('adjust-batch-difference');
    expect(within(aumento).getByTestId('adjust-batch-difference-increase-icon')).toHaveAttribute('aria-hidden', 'true');
    expect(within(aumento).queryByTestId('adjust-batch-difference-decrease-icon')).toBeNull();
    expect(aumento).toHaveTextContent('Aumento de 2');
  });

  it('R26 — la ayuda de aumento sale solo mientras la diferencia es un aumento, y describe el motivo', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    expect(screen.queryByTestId('adjust-batch-increase-hint')).toBeNull();

    await escribirTotal(user, '8');
    expect(screen.queryByTestId('adjust-batch-increase-hint')).toBeNull();

    await escribirTotal(user, '12');
    const ayuda = screen.getByTestId('adjust-batch-increase-hint');
    expect(ayuda).toHaveTextContent('Para aumentar solo valen Conteo físico y Error de carga.');
    expect(screen.getByTestId('adjust-batch-reason').getAttribute('aria-describedby')?.split(' ')).toContain(ayuda.id);

    await escribirTotal(user, '10');
    expect(screen.queryByTestId('adjust-batch-increase-hint')).toBeNull();
  });

  it('R24 — los motivos se leen con tilde en la opción y en el valor elegido', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    await abrirDialogo(user);
    await escribirTotal(user, '8');
    await elegirMotivo(user, 'Conteo físico');
    expect(screen.getByTestId('adjust-batch-reason')).toHaveTextContent('Conteo físico');
    expect(screen.getByTestId('adjust-batch-dialog')).not.toHaveTextContent('Conteo fisico');
  });

  it('R24 — en modo controlado no pinta disparador y abre con la prop', async () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    const user = setupUser();
    const { rerender } = render(
      <AdjustBatchDialog batch={lote()} canAdjust productName="Ácido cítrico" open={false} onOpenChange={onOpenChange} />,
    );
    expect(screen.queryByTestId('adjust-batch-open')).toBeNull();
    expect(screen.queryByTestId('adjust-batch-dialog')).toBeNull();

    rerender(<AdjustBatchDialog batch={lote()} canAdjust productName="Ácido cítrico" open onOpenChange={onOpenChange} />);
    expect(await screen.findByTestId('adjust-batch-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('adjust-batch-description')).toHaveTextContent('Ácido cítrico · Lote L-001');
    expect(screen.queryByTestId('adjust-batch-open')).toBeNull();

    await user.click(screen.getByTestId('adjust-batch-cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('multiplataforma', () => {
  it('el disparador y los campos llevan area tactil, y el campo de total lleva text-base', async () => {
    const user = setupUser();
    render(<AdjustBatchDialog batch={lote()} canAdjust />);

    expect(screen.getByTestId('adjust-batch-open').className).toMatch(/min-h-11/);

    await abrirDialogo(user);
    const total = screen.getByTestId('adjust-batch-counted');
    expect(total.className).toMatch(/min-h-11/);
    expect(total.className).toMatch(/text-base/);
    expect(screen.getByTestId('adjust-batch-reason').className).toMatch(/min-h-11/);
    expect(screen.getByTestId('adjust-batch-confirm').className).toMatch(/min-h-11/);
    expect(screen.getByTestId('adjust-batch-cancel').className).toMatch(/min-h-11/);
  });
});
