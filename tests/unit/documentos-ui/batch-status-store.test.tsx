import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GetBatchStatusResult } from '@/lib/modules/documentos/adapters/driving/document-batch-actions';

const { getBatchStatusActionMock } = vi.hoisted(() => ({
  getBatchStatusActionMock: vi.fn<(batchId: string) => Promise<GetBatchStatusResult>>(),
}));

vi.mock('@/lib/modules/documentos/adapters/driving/document-batch-actions', () => ({
  enqueueBatchAction: vi.fn(),
  getBatchStatusAction: getBatchStatusActionMock,
}));

import { resetBatchStatusStore } from '@/components/shared/document-upload/batch-status-store';
import {
  BATCH_STATUS_POLL_INTERVAL_MS,
  useBatchStatus,
} from '@/components/shared/document-upload/use-batch-status';

import { batch, entry } from './helpers';

const INTERVALO = BATCH_STATUS_POLL_INTERVAL_MS;

// El almacen vive en el modulo y dura toda la carga: se reinicia antes de cada caso y, ademas,
// cada caso usa su propia tanda para que la memoria de un caso no decida el siguiente.
let secuencia = 0;
function tandaNueva(): string {
  secuencia += 1;
  return `tanda-almacen-${secuencia}`;
}

async function avanzar(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const enCola: GetBatchStatusResult = {
  status: 'success',
  data: batch([entry({ status: 'queued' })]),
};

const terminada: GetBatchStatusResult = {
  status: 'success',
  data: batch([entry({ id: 'a', status: 'done' }), entry({ id: 'b', status: 'error' })]),
};

const desaparecida: GetBatchStatusResult = { status: 'success', data: null };

const fallo: GetBatchStatusResult = {
  status: 'error',
  code: 'unexpected',
  message: 'No se pudo consultar la tanda.',
  reference: 'req-1',
};

beforeEach(() => {
  vi.useFakeTimers();
  getBatchStatusActionMock.mockReset();
  resetBatchStatusStore();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('una sola consulta por tanda aunque la sigan varios consumidores', () => {
  it('la ventana y el panel siguiendo la misma tanda dan una sola llamada por intervalo (R24)', async () => {
    getBatchStatusActionMock.mockResolvedValue(enCola);
    const tanda = tandaNueva();

    const ventana = renderHook(() => useBatchStatus(tanda));
    const panel = renderHook(() => useBatchStatus(tanda));

    await avanzar(0);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(1);
    expect(ventana.result.current.status?.files[0]?.status).toBe('queued');
    expect(panel.result.current.status?.files[0]?.status).toBe('queued');

    await avanzar(INTERVALO);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(2);

    await avanzar(INTERVALO * 3);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(5);
  });

  it('con dos consumidores nunca hay dos consultas de la misma tanda en vuelo (R24)', async () => {
    let responder: ((result: GetBatchStatusResult) => void) | undefined;
    getBatchStatusActionMock.mockImplementation(
      () =>
        new Promise<GetBatchStatusResult>((resolve) => {
          responder = resolve;
        }),
    );
    const tanda = tandaNueva();

    renderHook(() => useBatchStatus(tanda));
    renderHook(() => useBatchStatus(tanda));

    await avanzar(INTERVALO * 5);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      responder?.(enCola);
      await Promise.resolve();
    });

    await avanzar(INTERVALO);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(2);
  });

  it('el sondeo sigue mientras quede un consumidor y se para con el ultimo (R24)', async () => {
    getBatchStatusActionMock.mockResolvedValue(enCola);
    const tanda = tandaNueva();

    const ventana = renderHook(() => useBatchStatus(tanda));
    const panel = renderHook(() => useBatchStatus(tanda));

    await avanzar(0);
    ventana.unmount();

    await avanzar(INTERVALO);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(2);

    panel.unmount();

    await avanzar(INTERVALO * 5);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(2);
  });
});

describe('las tandas terminadas o desaparecidas no se vuelven a consultar', () => {
  it('remontar una tanda ya vista terminada la sirve de memoria sin ninguna llamada (R25)', async () => {
    getBatchStatusActionMock.mockResolvedValue(terminada);
    const tanda = tandaNueva();

    const primero = renderHook(() => useBatchStatus(tanda));
    await avanzar(0);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(1);
    primero.unmount();

    const segundo = renderHook(() => useBatchStatus(tanda));
    expect(segundo.result.current.status?.files.map((file) => file.status)).toEqual([
      'done',
      'error',
    ]);

    await avanzar(INTERVALO * 5);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(1);
  });

  it('remontar una tanda ya vista desaparecida no hace ninguna llamada (R25)', async () => {
    getBatchStatusActionMock.mockResolvedValue(desaparecida);
    const tanda = tandaNueva();

    const primero = renderHook(() => useBatchStatus(tanda));
    await avanzar(0);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(1);
    primero.unmount();

    const segundo = renderHook(() => useBatchStatus(tanda));
    expect(segundo.result.current.missing).toBe(true);
    expect(segundo.result.current.error).toBeNull();

    await avanzar(INTERVALO * 5);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(1);
  });

  it('tras recargar, una tanda terminada da exactamente una llamada y no arma el temporizador (R25)', async () => {
    getBatchStatusActionMock.mockResolvedValue(terminada);
    const tanda = tandaNueva();

    const antes = renderHook(() => useBatchStatus(tanda));
    await avanzar(0);
    antes.unmount();
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(1);

    // La recarga vacia la memoria del modulo: nada de la foto final se guardo fuera de ella.
    vi.resetModules();
    const recargado = await import('@/components/shared/document-upload/use-batch-status');

    const tras = renderHook(() => recargado.useBatchStatus(tanda));
    await avanzar(0);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(2);
    expect(tras.result.current.status?.files[0]?.status).toBe('done');
    expect(vi.getTimerCount()).toBe(0);
    tras.unmount();

    renderHook(() => recargado.useBatchStatus(tanda));
    await avanzar(INTERVALO * 5);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(2);
  });

  it('no guarda la foto de la tanda en el almacenamiento del navegador (R25)', async () => {
    getBatchStatusActionMock.mockResolvedValue(terminada);
    window.localStorage.clear();
    window.sessionStorage.clear();
    const tanda = tandaNueva();

    renderHook(() => useBatchStatus(tanda));
    await avanzar(0);

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});

describe('reanudar sobre la entrada compartida', () => {
  it('resume desde un consumidor vuelve a consultar y limpia el error en todos', async () => {
    getBatchStatusActionMock.mockResolvedValueOnce(fallo).mockResolvedValue(enCola);
    const tanda = tandaNueva();

    const ventana = renderHook(() => useBatchStatus(tanda));
    const panel = renderHook(() => useBatchStatus(tanda));

    await avanzar(0);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(1);
    expect(ventana.result.current.error).not.toBeNull();
    expect(panel.result.current.error).not.toBeNull();

    await avanzar(INTERVALO * 5);
    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(1);

    act(() => {
      panel.result.current.resume();
    });
    await avanzar(0);

    expect(getBatchStatusActionMock).toHaveBeenCalledTimes(2);
    expect(ventana.result.current.error).toBeNull();
    expect(panel.result.current.error).toBeNull();
    expect(ventana.result.current.status?.files[0]?.status).toBe('queued');
    expect(panel.result.current.status?.files[0]?.status).toBe('queued');
  });
});
