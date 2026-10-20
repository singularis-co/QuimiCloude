// Pedir el enlace firmado para subir una foto de evidencia: quien puede, en que paso, el tope de 3
// y la ruta que pone el servidor.
import { describe, expect, it } from 'vitest';

import {
  EvidenceLimitError,
  EvidenceNotFoundError,
  OrderNotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/asignaciones/domain/errors';
import {
  createRequestEvidenceUpload,
  type RequestEvidenceUploadDeps,
} from '@/lib/modules/asignaciones/domain/request-evidence-upload';
import { isEvidencePathOf } from '@/lib/modules/asignaciones/domain/step-evidence';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';

import {
  ANA,
  BETO,
  EMPACADOR,
  EMPRESA,
  OPERADOR,
  OTRA_EMPRESA,
  PEDIDO,
  acceso,
  bucket,
  filaFoto,
  funcionesDe,
  repositorioEnMemoria,
  uuid,
} from './evidence-doubles';

type Opciones = Parameters<typeof acceso>[0] & {
  readonly filas?: Parameters<typeof repositorioEnMemoria>[0];
};

function montar(options?: Opciones) {
  const target = acceso(options);
  const { repo } = repositorioEnMemoria(options?.filas);
  const storage = bucket();
  const deps: RequestEvidenceUploadDeps = { ...target.deps, evidence: repo, storage };
  const todos = [...target.puertos, ...funcionesDe(repo), ...funcionesDe(storage)];
  return { request: createRequestEvidenceUpload(deps), repo, storage, todos };
}

const FABRICACION = { orderId: PEDIDO, phase: 'manufacturing', stepPosition: 2 } as const;
const ENVASADO = { orderId: PEDIDO, phase: 'packing', stepPosition: 1 } as const;
const EN_EMPAQUE_DE_ANA = { status: 'EN_EMPAQUE', packedBy: ANA } as const;

describe('requestEvidenceUpload — autorizacion (R26, R27)', () => {
  it('R26, R27: sin ninguno de los dos permisos rechaza antes de leer la entrada y sin tocar ningun puerto', async () => {
    for (const actor of [
      null,
      undefined,
      { ...OPERADOR, permissions: [] },
      { ...OPERADOR, permissions: ['asignaciones.consultar'] },
    ] as const) {
      const d = montar();
      await expect(d.request(actor as Actor | null | undefined, { basura: true })).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
      for (const puerto of d.todos) expect(puerto).not.toHaveBeenCalled();
    }
  });

  it('R26: un empacador sin asignaciones.ejecutar no puede pedir una foto de fabricacion, sin tocar ningun puerto', async () => {
    const d = montar();
    await expect(d.request(EMPACADOR, FABRICACION)).rejects.toBeInstanceOf(UnauthorizedError);
    for (const puerto of d.todos) expect(puerto).not.toHaveBeenCalled();
  });

  it('R27: un operador sin empaque.modificar no puede pedir una foto de envasado, sin tocar ningun puerto', async () => {
    const d = montar(EN_EMPAQUE_DE_ANA);
    await expect(d.request(OPERADOR, ENVASADO)).rejects.toBeInstanceOf(UnauthorizedError);
    for (const puerto of d.todos) expect(puerto).not.toHaveBeenCalled();
  });

  it('R26: quien no es responsable asignado no firma nada', async () => {
    const d = montar({ asignados: [] });
    await expect(d.request(OPERADOR, FABRICACION)).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(d.storage.createSignedUpload).not.toHaveBeenCalled();
  });

  it('R27: si empaca otra persona no firma nada', async () => {
    const d = montar({ status: 'EN_EMPAQUE', packedBy: BETO });
    await expect(d.request(EMPACADOR, ENVASADO)).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(d.storage.createSignedUpload).not.toHaveBeenCalled();
  });

  it('R38: fabricacion fuera de EN_CURSO (terminada, cancelada, dada de baja) no firma nada', async () => {
    for (const status of ['POR_EMPACAR', 'ENTREGADO', 'CANCELADO', null] as const) {
      const d = montar({ status });
      await expect(d.request(OPERADOR, FABRICACION), String(status)).rejects.toBeInstanceOf(OrderNotFoundError);
      expect(d.storage.createSignedUpload).not.toHaveBeenCalled();
      expect(d.repo.listByOrder).not.toHaveBeenCalled();
    }
  });

  it('R38: envasado POR_EMPACAR, terminado, cancelado o dado de baja no firma nada', async () => {
    for (const status of ['POR_EMPACAR', 'POR_ACONDICIONAR', 'CANCELADO', null] as const) {
      const d = montar({ status, packedBy: ANA });
      await expect(d.request(EMPACADOR, ENVASADO), String(status)).rejects.toBeInstanceOf(OrderNotFoundError);
      expect(d.storage.createSignedUpload).not.toHaveBeenCalled();
    }
  });

  it('R39: el pedido de otra empresa no existe para el actor', async () => {
    const d = montar();
    await expect(d.request({ ...OPERADOR, companyId: OTRA_EMPRESA }, FABRICACION)).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
    expect(d.storage.createSignedUpload).not.toHaveBeenCalled();
  });
});

describe('requestEvidenceUpload — entrada (R28, R30)', () => {
  it('R30: un campo de mas -una ruta, una empresa- se rechaza sin tocar ningun puerto (strictObject)', async () => {
    for (const extra of [{ path: `${EMPRESA}/${PEDIDO}/mia.png` }, { companyId: OTRA_EMPRESA }]) {
      const d = montar();
      await expect(d.request(OPERADOR, { ...FABRICACION, ...extra })).rejects.toBeInstanceOf(ValidationError);
      for (const puerto of d.todos) expect(puerto).not.toHaveBeenCalled();
    }
  });

  it('entrada mal formada -fase desconocida, posicion 0 o decimal, ids no uuid- es invalid_input', async () => {
    for (const entrada of [
      { ...FABRICACION, phase: 'conditioning' },
      { ...FABRICACION, stepPosition: 0 },
      { ...FABRICACION, stepPosition: 1.5 },
      { ...FABRICACION, orderId: 'no-uuid' },
      { ...FABRICACION, replacesEvidenceId: 'no-uuid' },
    ]) {
      const d = montar();
      await expect(d.request(OPERADOR, entrada)).rejects.toBeInstanceOf(ValidationError);
      for (const puerto of d.todos) expect(puerto).not.toHaveBeenCalled();
    }
  });

  it('R28: una posicion que no existe en la lista actual se rechaza sin firmar', async () => {
    const d = montar();
    await expect(d.request(OPERADOR, { ...FABRICACION, stepPosition: 4 })).rejects.toBeInstanceOf(ValidationError);
    expect(d.storage.createSignedUpload).not.toHaveBeenCalled();
  });

  it('R28: un paso que no pide evidencia se rechaza sin firmar', async () => {
    const d = montar();
    await expect(d.request(OPERADOR, { ...FABRICACION, stepPosition: 1 })).rejects.toBeInstanceOf(ValidationError);
    expect(d.storage.createSignedUpload).not.toHaveBeenCalled();
  });

  it('R28, R37: rige la lista actual: un paso que acaba de encenderse ya admite fotos', async () => {
    const d = montar({ pasosFabricacion: [{ blocks: [], requiresEvidence: true }] });
    await expect(d.request(OPERADOR, { ...FABRICACION, stepPosition: 1 })).resolves.toMatchObject({
      token: 'token-de-subida',
    });
  });
});

describe('requestEvidenceUpload — tope y sustitucion (R29, R19)', () => {
  const TRES = [1, 2, 3].map((slot) => filaFoto({ id: uuid(String(slot)), slot }));

  it('R29: con 3 fotos en el paso y sin sustituir, evidence_limit sin firmar', async () => {
    const d = montar({ filas: TRES });
    const error = await d.request(OPERADOR, FABRICACION).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EvidenceLimitError);
    expect((error as EvidenceLimitError).code).toBe('evidence_limit');
    expect(d.storage.createSignedUpload).not.toHaveBeenCalled();
  });

  it('R29: las fotos de otro paso no cuentan para el tope de este', async () => {
    const d = montar({ filas: TRES.map((f) => ({ ...f, stepPosition: 3 })) });
    await expect(d.request(OPERADOR, FABRICACION)).resolves.toBeDefined();
  });

  it('R19, R29: con 3 fotos, sustituir una de ellas firma', async () => {
    const d = montar({ filas: TRES });
    await expect(d.request(OPERADOR, { ...FABRICACION, replacesEvidenceId: uuid('2') })).resolves.toBeDefined();
    expect(d.storage.createSignedUpload).toHaveBeenCalledTimes(1);
  });

  it('R19: sustituir una foto que no existe, o que es de otro paso, es evidence_not_found sin firmar', async () => {
    for (const replacesEvidenceId of [uuid('d'), uuid('1')]) {
      const d = montar({ filas: [filaFoto({ id: uuid('1'), slot: 1, stepPosition: 3 })] });
      await expect(d.request(OPERADOR, { ...FABRICACION, replacesEvidenceId })).rejects.toBeInstanceOf(
        EvidenceNotFoundError,
      );
      expect(d.storage.createSignedUpload).not.toHaveBeenCalled();
    }
  });

  it('R39: sustituir una foto de otra empresa es evidence_not_found', async () => {
    const d = montar({ filas: [filaFoto({ id: uuid('1'), slot: 1 }, OTRA_EMPRESA)] });
    await expect(d.request(OPERADOR, { ...FABRICACION, replacesEvidenceId: uuid('1') })).rejects.toBeInstanceOf(
      EvidenceNotFoundError,
    );
  });

  it('R39: las fotos de otra empresa no cuentan para el tope', async () => {
    const d = montar({ filas: TRES.map((f) => ({ ...f, companyId: OTRA_EMPRESA })) });
    await expect(d.request(OPERADOR, FABRICACION)).resolves.toBeDefined();
    expect(d.repo.listByOrder).toHaveBeenCalledWith(EMPRESA, PEDIDO, 'manufacturing');
  });
});

describe('requestEvidenceUpload — la ruta (R30)', () => {
  it('R30: firma una ruta <empresa del actor>/<pedido>/<uuid> y no escribe ninguna fila', async () => {
    const d = montar();
    const subida = await d.request(OPERADOR, FABRICACION);
    const path = d.storage.createSignedUpload.mock.calls[0]?.[0] ?? '';
    expect(isEvidencePathOf(path, EMPRESA, PEDIDO)).toBe(true);
    expect(path.split('/')[2]).toMatch(/^[0-9a-f-]{36}$/);
    expect(subida).toEqual({ path, uploadUrl: `https://bucket.test/upload/${path}`, token: 'token-de-subida' });
    expect(d.repo.insert).not.toHaveBeenCalled();
    expect(d.repo.replace).not.toHaveBeenCalled();
  });

  it('R30: dos peticiones dan dos rutas distintas', async () => {
    const d = montar();
    const a = await d.request(OPERADOR, FABRICACION);
    const b = await d.request(OPERADOR, FABRICACION);
    expect(a.path).not.toBe(b.path);
  });

  it('R27, R30: en envasado, quien empaca recibe la ruta bajo su empresa y el pedido', async () => {
    const d = montar(EN_EMPAQUE_DE_ANA);
    const subida = await d.request(EMPACADOR, ENVASADO);
    expect(isEvidencePathOf(subida.path, EMPRESA, PEDIDO)).toBe(true);
    expect(d.repo.listByOrder).toHaveBeenCalledWith(EMPRESA, PEDIDO, 'packing');
  });
});
