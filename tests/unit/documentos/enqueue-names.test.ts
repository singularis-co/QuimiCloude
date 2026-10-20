// El nombre original de cada archivo al encolar: cómo se limpia en el borde y cómo llega al
// repositorio, alineado con su ruta.
import { describe, expect, it, vi } from 'vitest';

import { DOCUMENT_UPLOAD_PERMISSION, type Actor } from '@/lib/modules/documentos/domain/actor';
import { createEnqueueBatch } from '@/lib/modules/documentos/domain/enqueue-batch';
import { enqueueBatchSchema } from '@/lib/modules/documentos/domain/enqueue-input';
import { ValidationError } from '@/lib/modules/documentos/domain/errors';
import { fileNameSchema, MAX_FILE_NAME_LENGTH } from '@/lib/modules/documentos/domain/file-name';

import type {
  CreatedBatch,
  DocumentBatchRepository,
  NewBatch,
} from '@/lib/modules/documentos/ports/document-batch-repository';
import type { ProcessingQueue } from '@/lib/modules/documentos/ports/processing-queue';

const EMPRESA = '33333333-3333-4333-8333-333333333333';
const PERSONA = '11111111-1111-4111-8111-111111111111';
const ACTOR: Actor = { id: PERSONA, companyId: EMPRESA, permissions: [DOCUMENT_UPLOAD_PERMISSION] };

function rutas(cantidad: number): string[] {
  return Array.from({ length: cantidad }, (_, i) => `${EMPRESA}/archivo-${i + 1}.pdf`);
}

function nombre(entrada: string): string | null {
  return fileNameSchema.parse(entrada);
}

function dobles() {
  const createBatch = vi.fn(async (input: NewBatch): Promise<CreatedBatch> => ({
    batchId: 'tanda-1',
    files: input.paths.map((path, i) => ({ id: `archivo-${i + 1}`, path })),
  }));
  const repository: DocumentBatchRepository = {
    createBatch,
    attachMessageId: vi.fn(async () => {}),
    claim: vi.fn(async () => null),
    finish: vi.fn(async () => {}),
    expireStale: vi.fn(async () => {}),
    readBatch: vi.fn(async () => null),
    readFileForReview: vi.fn(async () => null),
  };
  const queue: ProcessingQueue = { publish: vi.fn(async () => 'mensaje') };
  return { repository, queue, createBatch };
}

describe('R50: fileNameSchema deja el nombre que tenía el archivo en el equipo', () => {
  it('R50: se queda sin carpetas, con barra invertida o normal', () => {
    expect(nombre('C:\\x\\a.pdf')).toBe('a.pdf');
    expect(nombre('/home/ana/docs/b.pdf')).toBe('b.pdf');
    expect(nombre('c.pdf')).toBe('c.pdf');
  });

  it('R50: recorta espacios y quita caracteres de control', () => {
    expect(nombre('   factura  marzo.pdf  ')).toBe('factura  marzo.pdf');
    expect(nombre('a\u0000b\u001f\u007f.pdf')).toBe('ab.pdf');
    expect(nombre('C:\\x\\\t  d.pdf\n')).toBe('d.pdf');
  });

  it('R50: un nombre que queda vacío tras sanear es null, no un error', () => {
    expect(nombre('')).toBeNull();
    expect(nombre('    ')).toBeNull();
    expect(nombre('C:\\carpeta\\')).toBeNull();
    expect(nombre('\u0000\u0001')).toBeNull();
  });

  it('R50: admite 255 caracteres y recorta a 255 lo que pasa del tope', () => {
    expect(nombre('a'.repeat(MAX_FILE_NAME_LENGTH))).toBe('a'.repeat(255));
    expect(nombre('a'.repeat(MAX_FILE_NAME_LENGTH + 1))).toBe('a'.repeat(255));
    expect(nombre('a'.repeat(1000))).toBe('a'.repeat(255));
  });

  it('R50: el recorte cuenta puntos de código, no unidades UTF-16, y no parte un emoji', () => {
    expect(nombre('😀'.repeat(255))).toBe('😀'.repeat(255));
    const recortado = nombre('😀'.repeat(300));
    expect(recortado).toBe('😀'.repeat(255));
    expect([...(recortado ?? '')]).toHaveLength(MAX_FILE_NAME_LENGTH);
    expect(nombre(`${'a'.repeat(254)}😀😀`)).toBe(`${'a'.repeat(254)}😀`);
  });

  it('R50: tras recortar se vuelven a quitar los espacios del final', () => {
    expect(nombre(`${'a'.repeat(250)}     resto.pdf`)).toBe('a'.repeat(250));
  });
});

describe('R50: enqueueBatchSchema acepta names opcional y alineado con paths', () => {
  it('R50: con names de la misma longitud que paths, pasa ya limpio', () => {
    const parsed = enqueueBatchSchema.safeParse({
      strategy: 'formula',
      paths: rutas(2),
      names: ['C:\\x\\a.pdf', ' b.pdf '],
    });
    expect(parsed.success && parsed.data.names).toEqual(['a.pdf', 'b.pdf']);
  });

  it('R50: una longitud distinta de paths se rechaza', () => {
    expect(enqueueBatchSchema.safeParse({ strategy: 'formula', paths: rutas(2), names: ['a.pdf'] }).success).toBe(false);
    expect(
      enqueueBatchSchema.safeParse({ strategy: 'formula', paths: rutas(1), names: ['a.pdf', 'b.pdf'] }).success,
    ).toBe(false);
  });

  it('R50: un nombre malo ya no rechaza la tanda: se recorta o queda null', () => {
    const parsed = enqueueBatchSchema.safeParse({
      strategy: 'formula',
      paths: rutas(3),
      names: ['a.pdf', 'x'.repeat(256), '  \u0000 '],
    });
    expect(parsed.success && parsed.data.names).toEqual(['a.pdf', 'x'.repeat(255), null]);
  });

  it('R50: sin names la entrada sigue siendo válida', () => {
    expect(enqueueBatchSchema.safeParse({ strategy: 'formula', paths: rutas(2) }).success).toBe(true);
  });
});

describe('R50: enqueueBatch pasa los nombres al repositorio', () => {
  it('R50: los nombres llegan limpios y en el mismo orden que las rutas', async () => {
    const doble = dobles();
    const paths = rutas(3);

    await createEnqueueBatch(doble)(ACTOR, {
      strategy: 'catalogo',
      paths,
      names: ['C:\\x\\a.pdf', 'b.pdf', ' c.pdf'],
    });

    expect(doble.createBatch).toHaveBeenCalledWith({
      companyId: EMPRESA,
      strategy: 'catalogo',
      createdBy: PERSONA,
      paths,
      originalNames: ['a.pdf', 'b.pdf', 'c.pdf'],
    });
  });

  it('R50: sin names se encola igual y el repositorio no recibe nombres, así quedan NULL', async () => {
    const doble = dobles();

    await createEnqueueBatch(doble)(ACTOR, { strategy: 'formula', paths: rutas(2) });

    const entrada = doble.createBatch.mock.calls[0]?.[0];
    expect(entrada?.paths).toEqual(rutas(2));
    expect(entrada).not.toHaveProperty('originalNames');
  });

  it('R50: una tanda con un nombre inservible se encola y ese archivo llega sin nombre', async () => {
    const doble = dobles();
    const paths = rutas(2);

    await createEnqueueBatch(doble)(ACTOR, { strategy: 'formula', paths, names: ['a.pdf', 'C:\\carpeta\\'] });

    expect(doble.createBatch.mock.calls[0]?.[0].originalNames).toEqual(['a.pdf', null]);
  });

  it('R50: names con otra longitud rechaza sin escribir', async () => {
    const doble = dobles();

    await expect(
      createEnqueueBatch(doble)(ACTOR, { strategy: 'formula', paths: rutas(2), names: ['a.pdf'] }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(doble.createBatch).not.toHaveBeenCalled();
  });
});
