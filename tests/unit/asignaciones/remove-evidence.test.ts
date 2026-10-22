// Quitar una foto: acceso, foto inexistente o ajena, borrado del bucket como advertencia.
import { describe, expect, it } from 'vitest';

import {
  EvidenceNotFoundError,
  OrderNotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/asignaciones/domain/errors';
import { createRemoveEvidence, type RemoveEvidenceDeps } from '@/lib/modules/asignaciones/domain/remove-evidence';

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
  readonly borradoFalla?: Error;
};

const UNA = filaFoto({ id: uuid('1'), slot: 1 });
const DOS = filaFoto({ id: uuid('2'), slot: 2 });
const DE_ENVASADO = filaFoto({ id: uuid('5'), slot: 1, phase: 'packing', stepPosition: 1 });

function montar(options?: Opciones) {
  const target = acceso(options);
  const { repo, filas } = repositorioEnMemoria(options?.filas ?? [UNA, DOS, DE_ENVASADO]);
  const storage = bucket({ borradoFalla: options?.borradoFalla });
  const deps: RemoveEvidenceDeps = { ...target.deps, evidence: repo, storage };
  const todos = [...target.puertos, ...funcionesDe(repo), ...funcionesDe(storage)];
  return { remove: createRemoveEvidence(deps), repo, filas, storage, todos };
}

const FABRICACION = { orderId: PEDIDO, phase: 'manufacturing', evidenceId: UNA.id } as const;
const ENVASADO = { orderId: PEDIDO, phase: 'packing', evidenceId: DE_ENVASADO.id } as const;

describe('removeEvidence — autorizacion (R26, R27, R38, R39)', () => {
  it('R26, R27: sin ninguno de los dos permisos rechaza sin tocar ningun puerto', async () => {
    for (const actor of [null, undefined, { ...OPERADOR, permissions: [] }] as const) {
      const d = montar();
      await expect(d.remove(actor as Actor | null | undefined, FABRICACION)).rejects.toBeInstanceOf(UnauthorizedError);
      for (const puerto of d.todos) expect(puerto).not.toHaveBeenCalled();
    }
  });

  it('R26, R27: el permiso de la otra fase no basta, y no se toca ningun puerto', async () => {
    const fab = montar();
    await expect(fab.remove(EMPACADOR, FABRICACION)).rejects.toBeInstanceOf(UnauthorizedError);
    for (const puerto of fab.todos) expect(puerto).not.toHaveBeenCalled();

    const env = montar({ status: 'EN_EMPAQUE', packedBy: ANA });
    await expect(env.remove(OPERADOR, ENVASADO)).rejects.toBeInstanceOf(UnauthorizedError);
    for (const puerto of env.todos) expect(puerto).not.toHaveBeenCalled();
  });

  it('R26: no asignado: no borra nada', async () => {
    const d = montar({ asignados: [] });
    await expect(d.remove(OPERADOR, FABRICACION)).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(d.repo.delete).not.toHaveBeenCalled();
    expect(d.storage.remove).not.toHaveBeenCalled();
  });

  it('R27: si empaca otra persona: no borra nada', async () => {
    const d = montar({ status: 'EN_EMPAQUE', packedBy: BETO });
    await expect(d.remove(EMPACADOR, ENVASADO)).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(d.repo.delete).not.toHaveBeenCalled();
    expect(d.storage.remove).not.toHaveBeenCalled();
  });

  it('R38: con la fase terminada, el pedido cancelado o dado de baja, las fotos y sus archivos se conservan', async () => {
    for (const status of ['POR_EMPACAR', 'ENTREGADO', 'CANCELADO', null] as const) {
      const d = montar({ status });
      await expect(d.remove(OPERADOR, FABRICACION), String(status)).rejects.toBeInstanceOf(OrderNotFoundError);
      expect(d.repo.delete).not.toHaveBeenCalled();
      expect(d.storage.remove).not.toHaveBeenCalled();
      expect(d.filas).toHaveLength(3);
    }
  });

  it('R39: el actor de otra empresa no ve el pedido', async () => {
    const d = montar();
    await expect(d.remove({ ...OPERADOR, companyId: OTRA_EMPRESA }, FABRICACION)).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
    expect(d.repo.delete).not.toHaveBeenCalled();
  });

  it('entrada con un campo de mas o un id que no es uuid: invalid_input sin tocar ningun puerto', async () => {
    for (const entrada of [{ ...FABRICACION, path: 'x' }, { ...FABRICACION, evidenceId: 'no-uuid' }]) {
      const d = montar();
      await expect(d.remove(OPERADOR, entrada)).rejects.toBeInstanceOf(ValidationError);
      for (const puerto of d.todos) expect(puerto).not.toHaveBeenCalled();
    }
  });
});

describe('removeEvidence — que borra (R19, R21, R39)', () => {
  it('R19: Quitar borra la fila y el archivo y devuelve las fotos que le quedan al paso, firmadas', async () => {
    const d = montar();
    const result = await d.remove(OPERADOR, FABRICACION);
    expect(d.repo.delete).toHaveBeenCalledWith(EMPRESA, PEDIDO, 'manufacturing', UNA.id);
    expect(d.storage.remove).toHaveBeenCalledWith(UNA.path);
    expect(result).toEqual({
      stepPosition: 2,
      photos: [{ id: DOS.id, slot: 2, url: `https://bucket.test/read/${DOS.path}?ttl=900` }],
      warnings: [],
    });
  });

  it('R21: tambien quita la ultima foto de un paso anterior; el paso queda sin fotos', async () => {
    const d = montar({ filas: [UNA] });
    const result = await d.remove(OPERADOR, FABRICACION);
    expect(result.photos).toEqual([]);
    expect(d.filas).toHaveLength(0);
  });

  it('una foto que no existe, de otra fase o de otra empresa: evidence_not_found sin tocar el bucket', async () => {
    const ajena = filaFoto({ id: uuid('6'), slot: 1 }, OTRA_EMPRESA);
    for (const evidenceId of [uuid('d'), DE_ENVASADO.id, ajena.id]) {
      const d = montar({ filas: [UNA, DE_ENVASADO, ajena] });
      await expect(d.remove(OPERADOR, { ...FABRICACION, evidenceId })).rejects.toBeInstanceOf(EvidenceNotFoundError);
      expect(d.storage.remove).not.toHaveBeenCalled();
      expect(d.filas).toHaveLength(3);
    }
  });

  it('R19: un remove del bucket que falla no deshace el borrado: vuelve como advertencia', async () => {
    const d = montar({ borradoFalla: new Error('bucket caido') });
    const result = await d.remove(OPERADOR, FABRICACION);
    expect(result.warnings).toEqual([{ operation: 'remove', path: UNA.path, message: 'bucket caido' }]);
    expect(d.filas.map((f) => f.id)).not.toContain(UNA.id);
  });

  it('R27: quien empaca quita fotos de envasado', async () => {
    const d = montar({ status: 'EN_EMPAQUE', packedBy: ANA });
    const result = await d.remove(EMPACADOR, ENVASADO);
    expect(d.repo.delete).toHaveBeenCalledWith(EMPRESA, PEDIDO, 'packing', DE_ENVASADO.id);
    expect(result.stepPosition).toBe(1);
  });
});
