/**
 * Pasos de acondicionamiento contra Postgres real: los adaptadores de `recetas` guardan y releen
 * las tres listas de pasos por separado, la edicion sin la lista conserva la guardada, una version
 * no guarda propios y lee los de su original, y el lector del acondicionamiento respeta la empresa
 * y sigue leyendo una receta dada de baja.
 *
 * Los adaptadores usan el cliente Prisma GLOBAL y abren su propia `$transaction`, asi que una
 * transaccion del test con ROLLBACK no los envolveria: dos empresas con nombre irrepetible nacen
 * en `beforeAll` y se borran en `afterAll` (versiones -> originales -> productos -> usuario ->
 * rol y tipo de documento -> empresa).
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import {
  findRecipeConditioningStepsById,
  findRecipeExecutionContentById,
  findRecipePackingStepsById,
} from '@/lib/modules/recetas/adapters/driven/persistence/recipe-catalog-prisma';
import {
  createRecipe,
  createRecipeVersion,
  findAliveRecipeById,
  replaceAliveRecipe,
  replaceAliveRecipeWithPropagation,
  softDeleteAliveRecipe,
} from '@/lib/modules/recetas/adapters/driven/persistence/recipe-prisma';
import { prisma } from '@/lib/shared/db/prisma';

import type { RecipeScope } from '@/lib/modules/recetas/domain/recipe-scope';
import type { NewRecipe } from '@/lib/modules/recetas/ports/recipe-repository';

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

type Empresa = {
  readonly companyId: string;
  readonly userId: string;
  readonly roleId: string;
  readonly documentTypeCode: string;
  readonly productos: readonly [string, string];
  readonly scope: RecipeScope;
};

let A: Empresa;
let B: Empresa;

function paso(text: string) {
  return { blocks: [{ kind: 'paragraph' as const, spans: [{ text }] }] };
}

const MEZCLAR = paso('Mezclar en frio');
const REPOSAR = { blocks: [{ kind: 'checklist' as const, items: [{ spans: [{ text: 'Reposar 10 min', italic: true }] }] }] };
const ENVASAR = paso('Envasar en garrafas de 5 L');
const ETIQUETAR = paso('Etiquetar con el lote');
const ROTULAR = { ...paso('Rotular cajas'), requiresAssignment: true };
const PALETIZAR = {
  blocks: [{ kind: 'checklist' as const, items: [{ spans: [{ text: 'Palet ', bold: true }, { text: 'flejado' }] }] }],
  requiresEvidence: true,
  requiresAssignment: false,
};
const FLEJAR = paso('Flejar el palet');

async function sembrarEmpresa(etiqueta: string): Promise<Empresa> {
  const marca = token();
  const nombre = `Empresa acondicionamiento ${etiqueta} ${marca}`;
  const company = await prisma.company.create({
    data: { name: nombre, nameNormalized: normalizeCompanyName(nombre) },
    select: { id: true },
  });
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marca.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const role = await prisma.role.create({
    data: { name: `rol-${marca}`, description: 'Rol de prueba' },
    select: { id: true },
  });
  const user = await prisma.user.create({
    data: {
      firstNames: 'Ana Maria',
      lastNames: 'Perez Gomez',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `ana.${marca}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode: documentType.code,
      documentNumber: marca.slice(0, 12),
      username: `ana.${marca}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  });
  const productos: string[] = [];
  for (const letra of ['a', 'b']) {
    const producto = await prisma.product.create({
      data: { name: `Producto ${letra} ${marca}`, nameNormalized: `producto${letra}${marca}`, companyId: company.id },
      select: { id: true },
    });
    productos.push(producto.id);
  }
  return {
    companyId: company.id,
    userId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    productos: productos as unknown as readonly [string, string],
    scope: { companyId: company.id },
  };
}

beforeAll(async () => {
  A = await sembrarEmpresa('A');
  B = await sembrarEmpresa('B');
});

afterAll(async () => {
  const empresas = [A, B].filter((empresa): empresa is Empresa => empresa !== undefined);
  for (const empresa of empresas) {
    await prisma.recipe.deleteMany({ where: { companyId: empresa.companyId, parentRecipeId: { not: null } } });
    await prisma.recipe.deleteMany({ where: { companyId: empresa.companyId } });
    await prisma.product.deleteMany({ where: { companyId: empresa.companyId } });
  }
  for (const empresa of empresas) {
    await prisma.user.deleteMany({ where: { id: empresa.userId } });
    await prisma.role.deleteMany({ where: { id: empresa.roleId } });
    await prisma.documentType.deleteMany({ where: { code: empresa.documentTypeCode } });
    await prisma.company.deleteMany({ where: { id: empresa.companyId } });
  }
  await prisma.$disconnect();
});

function datos(empresa: Empresa, overrides: Partial<NewRecipe> = {}): NewRecipe {
  const [a, b] = empresa.productos;
  return {
    name: `Crema ${token()}`,
    description: 'Base',
    steps: [MEZCLAR, REPOSAR],
    packingSteps: [ENVASAR, ETIQUETAR],
    conditioningSteps: [ROTULAR, PALETIZAR],
    lines: [
      { productId: a, percentage: '70.00' },
      { productId: b, percentage: '30.00' },
    ],
    imagePath: null,
    tools: [],
    ...overrides,
  };
}

/** Los datos de una receta SIN la clave `conditioningSteps`: lo que manda el reemplazo por PDF. */
function sinLista(empresa: Empresa, overrides: Partial<NewRecipe> = {}): NewRecipe {
  const resto: { -readonly [K in keyof NewRecipe]: NewRecipe[K] } = { ...datos(empresa, overrides) };
  delete resto.conditioningSteps;
  return resto;
}

async function original(empresa: Empresa, overrides: Partial<NewRecipe> = {}): Promise<string> {
  const creada = await createRecipe(datos(empresa, overrides), empresa.userId, new Date(), empresa.scope);
  if (creada === 'duplicate') throw new Error('alta de original: duplicate');
  return creada.id;
}

async function version(empresa: Empresa, originalId: string): Promise<string> {
  const creada = await createRecipeVersion(
    originalId,
    { name: `Version ${token()}`, lines: [{ productId: empresa.productos[0], percentage: '100.00' }], tools: [] },
    empresa.userId,
    new Date(),
    empresa.scope,
  );
  if (creada === 'duplicate' || creada === 'not_found') throw new Error(`alta de version: ${creada}`);
  return creada.id;
}

type Columnas = { steps: unknown; packing_steps: unknown; conditioning_steps: unknown };

async function columnasCrudas(id: string): Promise<Columnas> {
  const filas = await prisma.$queryRaw<Columnas[]>`
    SELECT "steps", "packing_steps", "conditioning_steps" FROM "recipes" WHERE "id" = ${id}::uuid`;
  const fila = filas[0];
  if (fila === undefined) throw new Error(`no existe la receta ${id}`);
  return fila;
}

describe('guardar y releer las tres listas de pasos', () => {
  it('R4: el alta guarda cada lista en su columna, en orden y con sus marcas, y la lectura las devuelve intactas y separadas', async () => {
    const id = await original(A);

    expect(await columnasCrudas(id)).toEqual({
      steps: [MEZCLAR, REPOSAR],
      packing_steps: [ENVASAR, ETIQUETAR],
      conditioning_steps: [ROTULAR, PALETIZAR],
    });

    const fila = await findAliveRecipeById(id, A.scope);
    expect(fila?.steps).toEqual([MEZCLAR, REPOSAR]);
    expect(fila?.packingSteps).toEqual([ENVASAR, ETIQUETAR]);
    expect(fila?.conditioningSteps).toEqual([ROTULAR, PALETIZAR]);
  });

  it('R4: el alta sin la lista deja la columna en []', async () => {
    const creada = await createRecipe(sinLista(A), A.userId, new Date(), A.scope);
    if (creada === 'duplicate') throw new Error('alta: duplicate');

    expect((await columnasCrudas(creada.id)).conditioning_steps).toEqual([]);
    expect((await findAliveRecipeById(creada.id, A.scope))?.conditioningSteps).toEqual([]);
  });

  it('R4: la edicion sustituye los pasos de acondicionamiento en el orden recibido sin tocar las otras listas', async () => {
    const id = await original(A);

    const resultado = await replaceAliveRecipe(
      id,
      datos(A, { name: `Crema editada ${token()}`, conditioningSteps: [FLEJAR, ROTULAR] }),
      A.userId,
      new Date(),
      A.scope,
    );
    expect(resultado).toBe('ok');

    expect(await columnasCrudas(id)).toEqual({
      steps: [MEZCLAR, REPOSAR],
      packing_steps: [ENVASAR, ETIQUETAR],
      conditioning_steps: [FLEJAR, ROTULAR],
    });
  });

  it('R4: la edicion sin la lista conserva la guardada, con y sin propagacion a versiones', async () => {
    const id = await original(A);
    const versionId = await version(A, id);

    const editada = await replaceAliveRecipe(
      id,
      sinLista(A, { name: `Crema ${token()}`, packingSteps: [ETIQUETAR] }),
      A.userId,
      new Date(),
      A.scope,
    );
    expect(editada).toBe('ok');
    expect(await columnasCrudas(id)).toMatchObject({
      packing_steps: [ETIQUETAR],
      conditioning_steps: [ROTULAR, PALETIZAR],
    });

    const propagada = await replaceAliveRecipeWithPropagation(
      id,
      sinLista(A, { name: `Crema ${token()}` }),
      [versionId],
      A.userId,
      new Date(),
      A.scope,
    );
    expect(propagada).toMatchObject({ kind: 'ok' });
    expect((await columnasCrudas(id)).conditioning_steps).toEqual([ROTULAR, PALETIZAR]);
  });

  it('R4: una receta con la lista vacia se guarda y se lee con la lista vacia', async () => {
    const id = await original(A, { conditioningSteps: [] });

    expect((await columnasCrudas(id)).conditioning_steps).toEqual([]);
    expect((await findAliveRecipeById(id, A.scope))?.conditioningSteps).toEqual([]);
  });
});

describe('versiones', () => {
  it('R15: una version nace sin pasos de acondicionamiento propios y lee los de su original', async () => {
    const originalId = await original(A);
    const versionId = await version(A, originalId);

    expect((await columnasCrudas(versionId)).conditioning_steps).toEqual([]);

    const fila = await findAliveRecipeById(versionId, A.scope);
    expect(fila?.conditioningSteps).toEqual([]);
    expect(fila?.original?.conditioningSteps).toEqual([ROTULAR, PALETIZAR]);
    await expect(findRecipeConditioningStepsById(versionId, A.companyId)).resolves.toEqual([ROTULAR, PALETIZAR]);
  });

  it('R15: editar los de la original se ve en la siguiente lectura de su version', async () => {
    const originalId = await original(A);
    const versionId = await version(A, originalId);

    const resultado = await replaceAliveRecipe(
      originalId,
      datos(A, { name: `Crema nueva ${token()}`, conditioningSteps: [FLEJAR] }),
      A.userId,
      new Date(),
      A.scope,
    );
    expect(resultado).toBe('ok');

    expect((await findAliveRecipeById(versionId, A.scope))?.original?.conditioningSteps).toEqual([FLEJAR]);
    await expect(findRecipeConditioningStepsById(versionId, A.companyId)).resolves.toEqual([FLEJAR]);
    expect((await columnasCrudas(versionId)).conditioning_steps).toEqual([]);
  });
});

describe('lector de pasos de acondicionamiento', () => {
  it('R32: devuelve null para una receta de otra empresa, y la otra empresa no la reescribe', async () => {
    const id = await original(A);

    await expect(findRecipeConditioningStepsById(id, B.companyId)).resolves.toBeNull();
    await expect(findRecipeConditioningStepsById(id, A.companyId)).resolves.toEqual([ROTULAR, PALETIZAR]);

    const ajena = await replaceAliveRecipe(
      id,
      datos(B, { name: `Ajena ${token()}`, conditioningSteps: [FLEJAR] }),
      B.userId,
      new Date(),
      B.scope,
    );
    expect(ajena).toBe('not_found');
    expect((await columnasCrudas(id)).conditioning_steps).toEqual([ROTULAR, PALETIZAR]);
  });

  it('R33: sigue devolviendo los pasos de una receta dada de baja', async () => {
    const id = await original(A);
    expect(await softDeleteAliveRecipe(id, A.userId, new Date(), A.scope)).toBe('ok');
    expect(await findAliveRecipeById(id, A.scope)).toBeNull();

    await expect(findRecipeConditioningStepsById(id, A.companyId)).resolves.toEqual([ROTULAR, PALETIZAR]);
  });

  it('R33: una version cuya original esta dada de baja sigue leyendo los de la original', async () => {
    const originalId = await original(A);
    const versionId = await version(A, originalId);
    expect(await softDeleteAliveRecipe(originalId, A.userId, new Date(), A.scope)).toBe('ok');

    await expect(findRecipeConditioningStepsById(versionId, A.companyId)).resolves.toEqual([ROTULAR, PALETIZAR]);
  });

  it('R4: la ejecucion del operador y el empaque no reciben pasos de acondicionamiento', async () => {
    const id = await original(A);

    const ejecucion = await findRecipeExecutionContentById(id, A.companyId);
    expect(ejecucion?.steps).toEqual([MEZCLAR, REPOSAR]);
    expect(JSON.stringify(ejecucion)).not.toContain('Rotular');

    const empaque = await findRecipePackingStepsById(id, A.companyId);
    expect(empaque).toEqual([ENVASAR, ETIQUETAR]);
    expect(JSON.stringify(empaque)).not.toContain('Rotular');
  });
});
