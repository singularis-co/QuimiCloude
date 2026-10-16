import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupUser } from '../../helpers/user-event';

import {
  CONDITIONING_BATCH_DATA_DIVERGENT_TESTID,
  CONDITIONING_BATCH_DATA_ERROR_TESTID,
  CONDITIONING_BATCH_DATA_SECTION_TESTID,
  CONDITIONING_BATCH_DATA_TEXTS,
  ConditioningBatchDataForm,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components';
import type { ConditioningBatchForm } from '@/lib/modules/asignaciones';
import type { SaveConditioningBatchDataResult } from '@/lib/modules/asignaciones/adapters/driving/order-conditioning-actions';

const { saveActionMock } = vi.hoisted(() => ({
  saveActionMock:
    vi.fn<(prev: SaveConditioningBatchDataResult, data: FormData) => Promise<SaveConditioningBatchDataResult>>(),
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-conditioning-actions', () => ({
  startConditioningAction: vi.fn(),
  finishConditioningAction: vi.fn(),
  saveConditioningBatchDataAction: saveActionMock,
}));

let toastExito: ReturnType<typeof vi.spyOn>;
let toastError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  toastExito = vi.spyOn(toast, 'success');
  toastError = vi.spyOn(toast, 'error');
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

const ORDER_ID = '33333333-3333-4333-8333-333333333333';

const LABELS = { 'pres-1': '12 × 1 L', 'pres-2': '30 × 200 ml', 'pres-3': '6 × 5 L' };

const SHARED: ConditioningBatchForm = {
  kind: 'shared',
  lot: 'CR-2610',
  expiryDate: '2027-10-01',
  productionDate: '2026-10-01',
};

const DIVERGENT: ConditioningBatchForm = {
  kind: 'divergent',
  lines: [
    { presentationId: 'pres-1', lot: 'CR-2610-A' },
    { presentationId: 'pres-2', lot: '0000042' },
    { presentationId: 'pres-3', lot: null },
  ],
};

function pintar(form: ConditioningBatchForm = { kind: 'empty' }) {
  return render(<ConditioningBatchDataForm orderId={ORDER_ID} form={form} divergentLabels={LABELS} />);
}

function campos() {
  const seccion = screen.getByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID);
  return {
    lot: within(seccion).getByLabelText(CONDITIONING_BATCH_DATA_TEXTS.lot) as HTMLInputElement,
    expiry: within(seccion).getByLabelText(CONDITIONING_BATCH_DATA_TEXTS.expiryDate) as HTMLInputElement,
    production: within(seccion).getByLabelText(CONDITIONING_BATCH_DATA_TEXTS.productionDate) as HTMLInputElement,
  };
}

function guardar(): HTMLElement {
  return screen.getByRole('button', { name: 'Guardar datos de lote' });
}

describe('la sección «Datos de lote»', () => {
  it('R13: un solo juego de «Lote», «Vencimiento» y «Día de producción» y un único botón, sin bloques por línea', () => {
    pintar(DIVERGENT);

    const seccion = screen.getByTestId(CONDITIONING_BATCH_DATA_SECTION_TESTID);
    expect(within(seccion).getByRole('heading', { name: 'Datos de lote' })).toBeInTheDocument();
    expect(within(seccion).getAllByLabelText('Lote')).toHaveLength(1);
    expect(within(seccion).getAllByLabelText('Vencimiento')).toHaveLength(1);
    expect(within(seccion).getAllByLabelText('Día de producción')).toHaveLength(1);
    expect(seccion.querySelectorAll('fieldset')).toHaveLength(0);
    expect(seccion.querySelectorAll('input[name="batchId"]')).toHaveLength(0);
    expect(within(seccion).getAllByRole('button')).toHaveLength(1);
    expect(guardar()).toHaveAttribute('type', 'submit');
  });

  it('R14: con datos uniformes los tres campos vienen rellenos y no hay aviso', () => {
    pintar(SHARED);

    const { lot, expiry, production } = campos();
    expect([lot.value, expiry.value, production.value]).toEqual(['CR-2610', '2027-10-01', '2026-10-01']);
    expect(screen.queryByTestId(CONDITIONING_BATCH_DATA_DIVERGENT_TESTID)).toBeNull();
  });

  it('R14: sin datos los tres campos vienen vacíos y no hay aviso', () => {
    pintar({ kind: 'empty' });

    const { lot, expiry, production } = campos();
    expect([lot.value, expiry.value, production.value]).toEqual(['', '', '']);
    expect(screen.queryByTestId(CONDITIONING_BATCH_DATA_DIVERGENT_TESTID)).toBeNull();
    expect(guardar()).toBeEnabled();
  });

  it('R15: con lotes distintos los campos vienen vacíos y un aviso warning lista cada línea con su lote o «sin lote»', () => {
    pintar(DIVERGENT);

    const { lot, expiry, production } = campos();
    expect([lot.value, expiry.value, production.value]).toEqual(['', '', '']);

    const aviso = screen.getByTestId(CONDITIONING_BATCH_DATA_DIVERGENT_TESTID);
    expect(aviso).toHaveAttribute('data-tone', 'warning');
    expect(aviso).not.toHaveAttribute('role', 'alert');
    expect(aviso).toHaveTextContent('Hoy las líneas tienen lotes distintos.');
    expect(within(aviso).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '12 × 1 L: CR-2610-A',
      '30 × 200 ml: 0000042',
      '6 × 5 L: sin lote',
    ]);
    expect(aviso).toHaveTextContent(
      'Al guardar, el lote, el vencimiento y el día de producción pasan a todas las líneas.',
    );
  });

  it('R17: sin ninguna línea con lote los tres campos y el botón van deshabilitados', () => {
    pintar({ kind: 'no_batches' });

    const { lot, expiry, production } = campos();
    for (const campo of [lot, expiry, production]) expect(campo).toBeDisabled();
    expect(guardar()).toBeDisabled();
  });

  it('R13: cada campo tiene su etiqueta, 16 px, 44 px de alto, es obligatorio y las fechas usan el selector nativo', () => {
    pintar();

    const { lot, expiry, production } = campos();
    expect(lot).toHaveAttribute('type', 'text');
    expect(expiry).toHaveAttribute('type', 'date');
    expect(production).toHaveAttribute('type', 'date');
    for (const campo of [lot, expiry, production]) {
      expect(campo.className).toContain('text-base');
      expect(campo.className).toContain('md:text-base');
      expect(campo.className).toContain('min-h-11');
      expect(campo).toBeRequired();
    }
    expect(guardar().className).toContain('min-h-11');
  });
});

describe('guardar', () => {
  it('R13: envía orderId y un solo valor por campo, y confirma con un solo toast', async () => {
    saveActionMock.mockResolvedValue({ status: 'success' });
    const user = setupUser();
    pintar(DIVERGENT);

    const { lot, expiry, production } = campos();
    await user.type(lot, 'CR-2610-B');
    await user.type(expiry, '2027-11-01');
    await user.type(production, '2026-10-02');
    await user.click(guardar());

    await waitFor(() => expect(saveActionMock).toHaveBeenCalledTimes(1));
    const enviado = saveActionMock.mock.calls[0]?.[1];
    expect([...(enviado?.keys() ?? [])].sort()).toEqual(['expiryDate', 'lot', 'orderId', 'productionDate']);
    expect(enviado?.getAll('orderId')).toEqual([ORDER_ID]);
    expect(enviado?.getAll('lot')).toEqual(['CR-2610-B']);
    expect(enviado?.getAll('expiryDate')).toEqual(['2027-11-01']);
    expect(enviado?.getAll('productionDate')).toEqual(['2026-10-02']);
    await waitFor(() => expect(toastExito).toHaveBeenCalledTimes(1));
    expect(toastExito).toHaveBeenCalledWith('Datos de lote guardados.');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('un toast por envío; volver a pintar sin enviar no repite el aviso', async () => {
    saveActionMock
      .mockResolvedValueOnce({ status: 'success' })
      .mockResolvedValueOnce({ status: 'success' });
    const user = setupUser();
    const { rerender } = pintar(SHARED);

    await user.click(guardar());
    await waitFor(() => expect(toastExito).toHaveBeenCalledTimes(1));

    rerender(<ConditioningBatchDataForm orderId={ORDER_ID} form={SHARED} divergentLabels={LABELS} />);
    expect(toastExito).toHaveBeenCalledTimes(1);

    await user.click(guardar());
    await waitFor(() => expect(toastExito).toHaveBeenCalledTimes(2));
    expect(saveActionMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['batch_duplicate_lot', 'Ya existe un lote con ese valor para ese producto y presentacion.', 'lot'],
    ['batch_expiry_not_future', 'El vencimiento debe ser posterior a hoy.', 'expiry'],
    ['batch_production_date_future', 'El dia de produccion no puede ser posterior a hoy.', 'production'],
  ] as const)(
    'R25: con %s muestra el mensaje en role="alert", marca aria-invalid solo su campo y conserva lo escrito',
    async (code, message, culpable) => {
      saveActionMock.mockResolvedValue({ status: 'error', code, message });
      const user = setupUser();
      pintar();

      const escritos = campos();
      await user.type(escritos.lot, 'CR-2610-A');
      await user.type(escritos.expiry, '2027-11-01');
      await user.type(escritos.production, '2026-10-02');
      await user.click(guardar());

      const alerta = await screen.findByTestId(CONDITIONING_BATCH_DATA_ERROR_TESTID);
      expect(alerta).toHaveAttribute('role', 'alert');
      expect(alerta).toHaveAttribute('data-code', code);
      expect(alerta).toHaveTextContent(message);

      const tras = campos();
      for (const [nombre, campo] of Object.entries(tras)) {
        if (nombre === culpable) {
          expect(campo).toHaveAttribute('aria-invalid', 'true');
          expect(campo).toHaveAttribute('aria-describedby', alerta.id);
        } else {
          expect(campo).not.toHaveAttribute('aria-invalid');
          expect(campo).not.toHaveAttribute('aria-describedby');
        }
      }
      expect([tras.lot.value, tras.expiry.value, tras.production.value]).toEqual([
        'CR-2610-A',
        '2027-11-01',
        '2026-10-02',
      ]);
      expect(toastExito).not.toHaveBeenCalled();
      expect(toastError).not.toHaveBeenCalled();
    },
  );

  it('R25: con cualquier otro código va a role="alert" sin marcar ningún campo', async () => {
    saveActionMock.mockResolvedValue({
      status: 'error',
      code: 'order_not_found',
      message: 'No se encontro el pedido.',
    });
    const user = setupUser();
    pintar(SHARED);

    await user.click(guardar());

    expect(await screen.findByRole('alert')).toHaveTextContent('No se encontro el pedido.');
    for (const campo of Object.values(campos())) expect(campo).not.toHaveAttribute('aria-invalid');
    expect(toastExito).not.toHaveBeenCalled();
  });
});
