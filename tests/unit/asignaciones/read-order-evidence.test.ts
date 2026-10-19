// La lectura compartida de las fotos de un pedido, con los puertos simulados: todas las fotos
// guardadas sin mirar la formula, agrupadas por fase y paso, firmadas en una sola llamada, y la
// firma caida que no tumba la lectura.
import { describe, expect, it } from 'vitest';

import { OrderNotFoundError } from '@/lib/modules/asignaciones/domain/errors';
import { readOrderEvidence } from '@/lib/modules/asignaciones/domain/read-order-evidence';
import { EVIDENCE_READ_LINK_TTL_SECONDS } from '@/lib/modules/asignaciones/domain/step-evidence';
import { ORDER_STATUS_VALUES } from '@/lib/modules/pedidos';

import { EMPRESA, OTRA_EMPRESA, PASOS_FABRICACION, PEDIDO, filaFoto } from './evidence-doubles';
import { FILAS_DEL_PEDIDO, montarLectura, pedido } from './order-evidence-doubles';

describe('readOrderEvidence — que fotos se leen', () => {
  it('R7: devuelve las fotos de un paso que hoy no pide evidencia y de uno que ya no existe en la formula', async () => {
    // En la formula de los dobles el paso 1 no pide evidencia y no hay paso 9.
    expect(PASOS_FABRICACION[0]?.requiresEvidence).toBeUndefined();
    expect(PASOS_FABRICACION).toHaveLength(3);
    const m = montarLectura({
      filas: [filaFoto({ id: 'a', slot: 1, stepPosition: 1 }), filaFoto({ id: 'b', slot: 1, stepPosition: 9 })],
    });

    const { evidence } = await readOrderEvidence(m.deps, EMPRESA, PEDIDO);

    expect(evidence.manufacturing.map((grupo) => grupo.stepPosition)).toEqual([1, 9]);
    expect(evidence.manufacturing.map((grupo) => grupo.photos?.map((foto) => foto.id))).toEqual([['a'], ['b']]);
  });

  it('R7: lee las dos fases del pedido y las devuelve por separado', async () => {
    const m = montarLectura({ filas: FILAS_DEL_PEDIDO });

    const { evidence } = await readOrderEvidence(m.deps, EMPRESA, PEDIDO);

    expect(m.repo.listByOrder).toHaveBeenCalledWith(EMPRESA, PEDIDO, 'manufacturing');
    expect(m.repo.listByOrder).toHaveBeenCalledWith(EMPRESA, PEDIDO, 'packing');
    expect(evidence.manufacturing.map((grupo) => grupo.photoCount)).toEqual([2, 1]);
    expect(evidence.packing).toEqual([
      { stepPosition: 1, photoCount: 1, photos: [{ id: 'p1-1', slot: 1, url: expect.any(String) }] },
    ]);
  });

  it('R8: los grupos van por numero de paso guardado ascendente y las fotos por casilla', async () => {
    const m = montarLectura({ filas: FILAS_DEL_PEDIDO });

    const { evidence } = await readOrderEvidence(m.deps, EMPRESA, PEDIDO);

    expect(evidence.manufacturing.map((grupo) => grupo.stepPosition)).toEqual([1, 3]);
    expect(evidence.manufacturing[0]!.photos!.map((foto) => [foto.id, foto.slot])).toEqual([
      ['m1-1', 1],
      ['m1-2', 2],
    ]);
  });

  it('R8: cada foto lleva la URL firmada de su propia ruta', async () => {
    const m = montarLectura({ filas: FILAS_DEL_PEDIDO });

    const { evidence } = await readOrderEvidence(m.deps, EMPRESA, PEDIDO);

    const fotos = [...evidence.manufacturing, ...evidence.packing].flatMap((grupo) => grupo.photos ?? []);
    for (const foto of fotos) {
      expect(foto.url).toBe(`https://bucket.test/read/${EMPRESA}/${PEDIDO}/${foto.id}?ttl=900`);
    }
  });
});

describe('readOrderEvidence — pedidos cancelados y dados de baja', () => {
  it.each([
    ['cancelado', pedido({ status: 'CANCELADO' })],
    ['dado de baja', pedido({ status: 'TERMINADO', deleted: true })],
  ])('R9: un pedido %s devuelve sus fotos igual que uno vigente', async (_caso, resumen) => {
    const vigente = await readOrderEvidence(montarLectura({ filas: FILAS_DEL_PEDIDO }).deps, EMPRESA, PEDIDO);
    const m = montarLectura({ pedido: resumen, filas: FILAS_DEL_PEDIDO });

    const lectura = await readOrderEvidence(m.deps, EMPRESA, PEDIDO);

    expect(lectura).toEqual(vigente);
    expect(lectura.signingFailure).toBeNull();
  });

  it('R9: pregunta por el pedido con todos los estados y dados de baja incluidos', async () => {
    const m = montarLectura({ filas: FILAS_DEL_PEDIDO });

    await readOrderEvidence(m.deps, EMPRESA, PEDIDO);

    expect(m.listSummariesByIdsIncludingDeleted).toHaveBeenCalledWith(EMPRESA, [PEDIDO], ORDER_STATUS_VALUES, 1, 1);
  });
});

describe('readOrderEvidence — la firma', () => {
  it('R10: sin fotos devuelve las dos fases vacias y no firma nada', async () => {
    const m = montarLectura();

    const lectura = await readOrderEvidence(m.deps, EMPRESA, PEDIDO);

    expect(lectura).toEqual({ evidence: { manufacturing: [], packing: [] }, signingFailure: null });
    expect(m.storage.createSignedReadUrls).not.toHaveBeenCalled();
    expect(m.storage.createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('R10: firma todas las rutas en una sola llamada con un plazo de 900 segundos', async () => {
    const m = montarLectura({ filas: FILAS_DEL_PEDIDO });

    await readOrderEvidence(m.deps, EMPRESA, PEDIDO);

    expect(EVIDENCE_READ_LINK_TTL_SECONDS).toBe(900);
    expect(m.storage.createSignedReadUrls).toHaveBeenCalledTimes(1);
    const [rutas, plazo] = m.storage.createSignedReadUrls.mock.calls[0]!;
    expect(plazo).toBe(900);
    expect([...rutas].sort()).toEqual(FILAS_DEL_PEDIDO.map((fila) => fila.path).sort());
    expect(m.storage.createSignedReadUrl).not.toHaveBeenCalled();
  });

  it('R10: la ruta del archivo en el bucket no sale en la respuesta', async () => {
    const m = montarLectura({ filas: FILAS_DEL_PEDIDO });

    const lectura = await readOrderEvidence(m.deps, EMPRESA, PEDIDO);

    const fotos = [...lectura.evidence.manufacturing, ...lectura.evidence.packing].flatMap((g) => g.photos ?? []);
    expect(fotos).toHaveLength(FILAS_DEL_PEDIDO.length);
    for (const foto of fotos) expect(Object.keys(foto).sort()).toEqual(['id', 'slot', 'url']);
    for (const fila of FILAS_DEL_PEDIDO) {
      expect(JSON.stringify(lectura)).not.toContain(`"${fila.path}"`);
    }
  });

  it('R11: si la firma lanza, la lectura no falla: cada grupo sale con su paso y su cantidad y sin fotos', async () => {
    const m = montarLectura({ filas: FILAS_DEL_PEDIDO, firmaFalla: new Error('storage caido') });

    const lectura = await readOrderEvidence(m.deps, EMPRESA, PEDIDO);

    expect(lectura.evidence).toEqual({
      manufacturing: [
        { stepPosition: 1, photoCount: 2, photos: null },
        { stepPosition: 3, photoCount: 1, photos: null },
      ],
      packing: [{ stepPosition: 1, photoCount: 1, photos: null }],
    });
  });

  it('R11: la causa de la firma caida viaja en `signingFailure` para el log', async () => {
    const m = montarLectura({ filas: FILAS_DEL_PEDIDO, firmaFalla: new Error('storage caido') });

    const lectura = await readOrderEvidence(m.deps, EMPRESA, PEDIDO);

    expect(lectura.signingFailure).toBe('storage caido');
  });

  it('R11: un valor lanzado que no es Error tampoco tumba la lectura ni se copia al diagnostico', async () => {
    const m = montarLectura({ filas: FILAS_DEL_PEDIDO });
    m.storage.createSignedReadUrls.mockRejectedValue('https://secreto?token=x');

    const lectura = await readOrderEvidence(m.deps, EMPRESA, PEDIDO);

    expect(lectura.evidence.manufacturing.every((grupo) => grupo.photos === null)).toBe(true);
    expect(lectura.signingFailure).not.toBeNull();
    expect(lectura.signingFailure).not.toContain('token');
  });
});

describe('readOrderEvidence — el pedido tiene que ser de la empresa', () => {
  it('R5: un pedido que no vuelve del catalogo lanza order_not_found sin listar ni firmar', async () => {
    const m = montarLectura({ pedido: null, filas: FILAS_DEL_PEDIDO });

    await expect(readOrderEvidence(m.deps, EMPRESA, PEDIDO)).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(m.repo.listByOrder).not.toHaveBeenCalled();
    expect(m.storage.createSignedReadUrls).not.toHaveBeenCalled();
  });

  it('R29: un pedido de otra empresa lanza order_not_found sin listar ni firmar', async () => {
    const m = montarLectura({ filas: FILAS_DEL_PEDIDO });

    await expect(readOrderEvidence(m.deps, OTRA_EMPRESA, PEDIDO)).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(m.repo.listByOrder).not.toHaveBeenCalled();
    expect(m.storage.createSignedReadUrls).not.toHaveBeenCalled();
  });
});
