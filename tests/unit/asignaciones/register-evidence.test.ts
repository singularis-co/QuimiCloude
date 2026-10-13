// Registrar una foto subida: acceso, ruta, contenido, tope, sustitucion y lectura firmada.
import { describe, expect, it } from 'vitest';

import {
  EvidenceInvalidFileError,
  EvidenceLimitError,
  EvidenceNotFoundError,
  OrderNotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/asignaciones/domain/errors';
import { createRegisterEvidence, type RegisterEvidenceDeps } from '@/lib/modules/asignaciones/domain/register-evidence';
import { EVIDENCE_READ_LINK_TTL_SECONDS } from '@/lib/modules/asignaciones/domain/step-evidence';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';

import {
  ANA,
  BETO,
  EMPACADOR,
  EMPRESA,
  OPERADOR,
  OTRA_EMPRESA,
  PEDIDO,
  PNG_VALIDO,
  acceso,
  bucket,
  filaFoto,
  funcionesDe,
  repositorioEnMemoria,
  uuid,
} from './evidence-doubles';

type Opciones = Parameters<typeof acceso>[0] & {
  readonly filas?: Parameters<typeof repositorioEnMemoria>[0];
  readonly descarga?: Uint8Array | null;
  readonly borradoFalla?: Error;
};

function montar(options?: Opciones) {
  const target = acceso(options);
  const { repo, filas } = repositorioEnMemoria(options?.filas);
  const storage = bucket({ descarga: options?.descarga, borradoFalla: options?.borradoFalla });
  const deps: RegisterEvidenceDeps = { ...target.deps, evidence: repo, storage };
  const todos = [...target.puertos, ...funcionesDe(repo), ...funcionesDe(storage)];
  return { register: createRegisterEvidence(deps), repo, filas, storage, todos };
}

const RUTA = `${EMPRESA}/${PEDIDO}/${uuid('c')}`;
const FABRICACION = { orderId: PEDIDO, phase: 'manufacturing', stepPosition: 2, path: RUTA } as const;
const ENVASADO = { orderId: PEDIDO, phase: 'packing', stepPosition: 1, path: RUTA } as const;
const EN_EMPAQUE_DE_ANA = { status: 'EN_EMPAQUE', packedBy: ANA } as const;

function sinEscrituras(d: ReturnType<typeof montar>): void {
  expect(d.repo.insert).not.toHaveBeenCalled();
  expect(d.repo.replace).not.toHaveBeenCalled();
  expect(d.repo.delete).not.toHaveBeenCalled();
  expect(d.storage.remove).not.toHaveBeenCalled();
}

describe('registerEvidence — autorizacion (R26, R27, R38, R39)', () => {
  it('R26, R27: sin ninguno de los dos permisos rechaza sin leer la entrada ni tocar ningun puerto', async () => {
    for (const actor of [null, undefined, { ...OPERADOR, permissions: ['asignaciones.consultar'] }] as const) {
      const d = montar();
      await expect(d.register(actor as Actor | null | undefined, FABRICACION)).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
      for (const puerto of d.todos) expect(puerto).not.toHaveBeenCalled();
    }
  });

  it('R26: un empacador no registra fotos de fabricacion; R27: un operador no registra de envasado; sin tocar ningun puerto', async () => {
    const fab = montar();
    await expect(fab.register(EMPACADOR, FABRICACION)).rejects.toBeInstanceOf(UnauthorizedError);
    for (const puerto of fab.todos) expect(puerto).not.toHaveBeenCalled();

    const env = montar(EN_EMPAQUE_DE_ANA);
    await expect(env.register(OPERADOR, ENVASADO)).rejects.toBeInstanceOf(UnauthorizedError);
    for (const puerto of env.todos) expect(puerto).not.toHaveBeenCalled();
  });

  it('R26: no asignado: order_not_found sin tocar el bucket ni escribir', async () => {
    const d = montar({ asignados: [] });
    await expect(d.register(OPERADOR, FABRICACION)).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(d.storage.download).not.toHaveBeenCalled();
    sinEscrituras(d);
  });

  it('R27: si empaca otra persona: order_not_found sin tocar el bucket ni escribir', async () => {
    const d = montar({ status: 'EN_EMPAQUE', packedBy: BETO });
    await expect(d.register(EMPACADOR, ENVASADO)).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(d.storage.download).not.toHaveBeenCalled();
    sinEscrituras(d);
  });

  it('R38: fabricacion terminada (POR_EMPACAR), cancelada o dada de baja: rechazo sin tocar el bucket', async () => {
    for (const status of ['POR_EMPACAR', 'CANCELADO', null] as const) {
      const d = montar({ status });
      await expect(d.register(OPERADOR, FABRICACION), String(status)).rejects.toBeInstanceOf(OrderNotFoundError);
      expect(d.storage.download).not.toHaveBeenCalled();
      sinEscrituras(d);
    }
  });

  it('R38: envasado POR_EMPACAR, terminado, cancelado o dado de baja: rechazo sin tocar el bucket', async () => {
    for (const status of ['POR_EMPACAR', 'POR_ACONDICIONAR', 'CANCELADO', null] as const) {
      const d = montar({ status, packedBy: ANA });
      await expect(d.register(EMPACADOR, ENVASADO), String(status)).rejects.toBeInstanceOf(OrderNotFoundError);
      expect(d.storage.download).not.toHaveBeenCalled();
      sinEscrituras(d);
    }
  });

  it('R39: el actor de otra empresa no ve el pedido', async () => {
    const d = montar();
    const ajeno = { ...OPERADOR, companyId: OTRA_EMPRESA };
    await expect(
      d.register(ajeno, { ...FABRICACION, path: `${OTRA_EMPRESA}/${PEDIDO}/${uuid('c')}` }),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(d.storage.download).not.toHaveBeenCalled();
    sinEscrituras(d);
  });
});

describe('registerEvidence — paso y ruta (R28, R31)', () => {
  it('R28: posicion inexistente o paso sin evidencia: rechazo sin tocar el bucket', async () => {
    for (const stepPosition of [1, 4]) {
      const d = montar();
      await expect(d.register(OPERADOR, { ...FABRICACION, stepPosition })).rejects.toBeInstanceOf(ValidationError);
      expect(d.storage.download).not.toHaveBeenCalled();
      sinEscrituras(d);
    }
  });

  it('R31: una ruta fuera de <empresa del actor>/<pedido>/ se rechaza sin tocar el bucket', async () => {
    for (const path of [
      `${OTRA_EMPRESA}/${PEDIDO}/${uuid('c')}`,
      `${EMPRESA}/${uuid('8')}/${uuid('c')}`,
      `${EMPRESA}/${PEDIDO}/../${uuid('c')}`,
      `${EMPRESA}/${PEDIDO}`,
      `${EMPRESA}/${PEDIDO}/a/b`,
    ]) {
      const d = montar();
      await expect(d.register(OPERADOR, { ...FABRICACION, path }), path).rejects.toBeInstanceOf(ValidationError);
      expect(d.storage.download).not.toHaveBeenCalled();
      sinEscrituras(d);
    }
  });

  it('un campo de mas en la entrada se rechaza sin tocar ningun puerto', async () => {
    const d = montar();
    await expect(d.register(OPERADOR, { ...FABRICACION, companyId: OTRA_EMPRESA })).rejects.toBeInstanceOf(
      ValidationError,
    );
    for (const puerto of d.todos) expect(puerto).not.toHaveBeenCalled();
  });
});

describe('registerEvidence — contenido (R32)', () => {
  it('R32: archivo inexistente: evidence_invalid_file sin escribir', async () => {
    const d = montar({ descarga: null });
    const error = await d.register(OPERADOR, FABRICACION).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EvidenceInvalidFileError);
    expect((error as EvidenceInvalidFileError).code).toBe('evidence_invalid_file');
    sinEscrituras(d);
  });

  it('R32: un PDF renombrado: evidence_invalid_file, el archivo se borra y no cuenta', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\n...');
    const d = montar({ descarga: pdf });
    await expect(d.register(OPERADOR, FABRICACION)).rejects.toBeInstanceOf(EvidenceInvalidFileError);
    expect(d.storage.remove).toHaveBeenCalledWith(RUTA);
    expect(d.repo.insert).not.toHaveBeenCalled();
    expect(d.filas).toHaveLength(0);
  });

  it('R32: una imagen de mas de 5 MB: evidence_invalid_file, el archivo se borra y no cuenta', async () => {
    const grande = new Uint8Array(5 * 1024 * 1024 + 1);
    grande.set(PNG_VALIDO);
    const d = montar({ descarga: grande });
    await expect(d.register(OPERADOR, FABRICACION)).rejects.toBeInstanceOf(EvidenceInvalidFileError);
    expect(d.storage.remove).toHaveBeenCalledWith(RUTA);
    expect(d.repo.insert).not.toHaveBeenCalled();
  });

  it('R32: si ademas el borrado falla, el error sigue siendo evidence_invalid_file y el fallo va al diagnostico', async () => {
    const d = montar({ descarga: new Uint8Array([1, 2, 3]), borradoFalla: new Error('bucket caido') });
    const error = await d.register(OPERADOR, FABRICACION).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EvidenceInvalidFileError);
    expect((error as EvidenceInvalidFileError).diagnostic).toContain('bucket caido');
    expect((error as EvidenceInvalidFileError).diagnostic).toContain(RUTA);
  });

  it('R32: guarda el tipo y el tamano leidos del contenido, y quien la subio', async () => {
    const d = montar();
    await d.register(OPERADOR, FABRICACION);
    expect(d.repo.insert).toHaveBeenCalledWith({
      companyId: EMPRESA,
      orderId: PEDIDO,
      phase: 'manufacturing',
      stepPosition: 2,
      path: RUTA,
      contentType: 'image/png',
      sizeBytes: PNG_VALIDO.byteLength,
      uploadedBy: ANA,
    });
  });
});

describe('registerEvidence — tope, sustitucion y lectura (R29, R19, R21, R33)', () => {
  it('R18, R33: registra y devuelve las fotos del paso con URL firmada de 15 minutos', async () => {
    const d = montar({ filas: [filaFoto({ id: uuid('1'), slot: 1 }), filaFoto({ id: uuid('2'), slot: 1, stepPosition: 3 })] });
    const result = await d.register(OPERADOR, FABRICACION);
    expect(result.warnings).toEqual([]);
    expect(result.photos.map((p) => p.slot)).toEqual([1, 2]);
    expect(result.photos[1]?.url).toBe(`https://bucket.test/read/${RUTA}?ttl=${String(15 * 60)}`);
    expect(EVIDENCE_READ_LINK_TTL_SECONDS).toBe(900);
    for (const call of d.storage.createSignedReadUrl.mock.calls) expect(call[1]).toBe(900);
    expect(d.storage.createSignedReadUrl).toHaveBeenCalledTimes(2);
  });

  it('R29: si el paso ya tiene 3 (tambien si otra peticion ocupo el ultimo a la vez): evidence_limit y el archivo se borra', async () => {
    const d = montar({ filas: [1, 2, 3].map((slot) => filaFoto({ id: uuid(String(slot)), slot })) });
    const error = await d.register(OPERADOR, FABRICACION).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EvidenceLimitError);
    expect(d.storage.remove).toHaveBeenCalledWith(RUTA);
    expect(d.filas).toHaveLength(3);
  });

  it('R19: Cambiar sustituye en el mismo slot y borra el archivo viejo', async () => {
    const vieja = filaFoto({ id: uuid('2'), slot: 2 });
    const d = montar({ filas: [filaFoto({ id: uuid('1'), slot: 1 }), vieja] });
    const result = await d.register(OPERADOR, { ...FABRICACION, replacesEvidenceId: vieja.id });
    expect(d.repo.replace).toHaveBeenCalledWith(vieja.id, expect.objectContaining({ path: RUTA, stepPosition: 2 }));
    expect(d.repo.insert).not.toHaveBeenCalled();
    expect(d.storage.remove).toHaveBeenCalledWith(vieja.path);
    expect(result.photos.map((p) => p.slot)).toEqual([1, 2]);
    expect(result.photos.find((p) => p.slot === 2)?.url).toContain(RUTA);
  });

  it('R19: sustituir una foto que no esta en ese paso: evidence_not_found y el archivo nuevo se borra', async () => {
    const d = montar({ filas: [filaFoto({ id: uuid('1'), slot: 1, stepPosition: 3 })] });
    await expect(
      d.register(OPERADOR, { ...FABRICACION, replacesEvidenceId: uuid('1') }),
    ).rejects.toBeInstanceOf(EvidenceNotFoundError);
    expect(d.repo.replace).not.toHaveBeenCalled();
    expect(d.storage.remove).toHaveBeenCalledWith(RUTA);
  });

  it('R19: si la foto a sustituir desaparecio entre leer y sustituir: evidence_not_found y el archivo nuevo se borra', async () => {
    const vieja = filaFoto({ id: uuid('2'), slot: 2 });
    const d = montar({ filas: [vieja] });
    d.repo.replace.mockResolvedValueOnce('not_found');
    await expect(d.register(OPERADOR, { ...FABRICACION, replacesEvidenceId: vieja.id })).rejects.toBeInstanceOf(
      EvidenceNotFoundError,
    );
    expect(d.storage.remove).toHaveBeenCalledWith(RUTA);
    expect(d.storage.remove).not.toHaveBeenCalledWith(vieja.path);
  });

  it('R19: un remove del archivo viejo que falla no deshace el registro: vuelve como advertencia', async () => {
    const vieja = filaFoto({ id: uuid('2'), slot: 2 });
    const d = montar({ filas: [vieja], borradoFalla: new Error('bucket caido') });
    const result = await d.register(OPERADOR, { ...FABRICACION, replacesEvidenceId: vieja.id });
    expect(result.warnings).toEqual([{ operation: 'remove', path: vieja.path, message: 'bucket caido' }]);
    expect(result.photos).toHaveLength(1);
    expect(d.filas[0]?.path).toBe(RUTA);
  });

  it('R21: tambien registra en un paso anterior mientras el pedido sigue en curso', async () => {
    const d = montar();
    await expect(d.register(OPERADOR, { ...FABRICACION, stepPosition: 2 })).resolves.toBeDefined();
    await expect(
      d.register(OPERADOR, { ...FABRICACION, stepPosition: 3, path: `${EMPRESA}/${PEDIDO}/${uuid('d')}` }),
    ).resolves.toBeDefined();
    expect(d.filas.map((f) => f.stepPosition)).toEqual([2, 3]);
  });

  it('R27: en envasado registra con la fase packing', async () => {
    const d = montar(EN_EMPAQUE_DE_ANA);
    await d.register(EMPACADOR, ENVASADO);
    expect(d.repo.insert).toHaveBeenCalledWith(expect.objectContaining({ phase: 'packing', stepPosition: 1 }));
  });
});
