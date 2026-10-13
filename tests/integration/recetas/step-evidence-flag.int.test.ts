/**
 * «Requiere evidencia» en el paso contra Postgres real: los adaptadores de `recetas` guardan el
 * flag dentro del JSONB de `steps` y `packing_steps`, lo devuelven igual en el detalle, en el
 * contenido de ejecucion y en los pasos de envasado, y una version devuelve el de su original.
 *
 * Los adaptadores usan el cliente Prisma GLOBAL y abren su propia `$transaction`, asi que una
 * transaccion del test con ROLLBACK no los envolveria: una empresa con nombre irrepetible nace en
 * `beforeAll` y se borra en `afterAll` (versiones -> originales -> productos -> usuario -> rol y
 * tipo de documento -> empresa).
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import {
  findRecipeExecutionContentById,
  findRecipePackingStepsById,
} from '@/lib/modules/recetas/adapters/driven/persistence/recipe-catalog-prisma';
import {
  createRecipe,
  createRecipeVersion,
  findAliveRecipeById,
  replaceAliveRecipe,
} from '@/lib/modules/recetas/adapters/driven/persistence/recipe-prisma';
import { createRecipeSchema, updateRecipeSchema } from '@/lib/modules/recetas/domain/recipe-input';
import { prisma } from '@/lib/shared/db/prisma';

import type { RecipeStepInput } from '@/lib/modules/recetas/domain/recipe-input';
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
  readonly productoId: string;
  readonly scope: RecipeScope;
};

let A: Empresa;

function paso(text: string, requiresEvidence?: boolean): RecipeStepInput {
  const blocks = [{ kind: 'paragraph' as const, spans: [{ text }] }];
  return requiresEvidence === undefined ? { blocks } : { blocks, requiresEvidence };
}

const MEZCLAR = paso('Mezclar en frio', true);
const REPOSAR = paso('Reposar 10 min');
const FILTRAR = paso('Filtrar', false);
const ENVASAR = paso('Envasar en garrafas de 5 L');
const SELLAR = paso('Sellar la tapa', true);

async function sembrarEmpresa(): Promise<Empresa> {
  const marca = token();
  const nombre = `Empresa evidencia ${marca}`;
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
  const producto = await prisma.product.create({
    data: { name: `Producto ${marca}`, nameNormalized: `producto${marca}`, companyId: company.id },
    select: { id: true },
  });
  return {
    companyId: company.id,
    userId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    productoId: producto.id,
    scope: { companyId: company.id },
  };
}

beforeAll(async () => {
  A = await sembrarEmpresa();
});

afterAll(async () => {
  if (A !== undefined) {
    await prisma.recipe.deleteMany({ where: { companyId: A.companyId, parentRecipeId: { not: null } } });
    await prisma.recipe.deleteMany({ where: { companyId: A.companyId } });
    await prisma.product.deleteMany({ where: { companyId: A.companyId } });
    await prisma.user.deleteMany({ where: { id: A.userId } });
    await prisma.role.deleteMany({ where: { id: A.roleId } });
    await prisma.documentType.deleteMany({ where: { code: A.documentTypeCode } });
    await prisma.company.deleteMany({ where: { id: A.companyId } });
  }
  await prisma.$disconnect();
});

/** Los pasos pasan por el esquema del borde, como en el caso de uso, antes de llegar al adaptador. */
function datos(steps: readonly unknown[], packingSteps: readonly unknown[]): NewRecipe {
  const parsed = createRecipeSchema.parse({
    name: `Crema ${token()}`,
    description: 'Base',
    steps,
    packingSteps,
    lines: [{ productId: A.productoId, percentage: '100' }],
  });
  return {
    name: parsed.name,
    description: parsed.description ?? null,
    steps: parsed.steps,
    packingSteps: parsed.packingSteps,
    lines: [{ productId: A.productoId, percentage: '100.00' }],
    imagePath: null,
    tools: [],
  };
}

async function original(steps: readonly unknown[], packingSteps: readonly unknown[]): Promise<string> {
  const creada = await createRecipe(datos(steps, packingSteps), A.userId, new Date(), A.scope);
  if (creada === 'duplicate') throw new Error('alta de original: duplicate');
  return creada.id;
}

async function version(originalId: string): Promise<string> {
  const creada = await createRecipeVersion(
    originalId,
    { name: `Version ${token()}`, lines: [{ productId: A.productoId, percentage: '100.00' }], tools: [] },
    A.userId,
    new Date(),
    A.scope,
  );
  if (creada === 'duplicate' || creada === 'not_found') throw new Error(`alta de version: ${creada}`);
  return creada.id;
}

async function columnasCrudas(id: string): Promise<{ steps: unknown; packing_steps: unknown }> {
  const filas = await prisma.$queryRaw<{ steps: unknown; packing_steps: unknown }[]>`
    SELECT "steps", "packing_steps" FROM "recipes" WHERE "id" = ${id}::uuid`;
  const fila = filas[0];
  if (fila === undefined) throw new Error(`no existe la receta ${id}`);
  return fila;
}

const flags = (steps: readonly { readonly requiresEvidence?: boolean }[] | undefined) =>
  steps?.map((step) => step.requiresEvidence);

describe('guardar y releer requiresEvidence (R3)', () => {
  it('R3: el alta guarda el flag de cada paso en steps y packing_steps, y ausente sigue ausente', async () => {
    const id = await original([MEZCLAR, REPOSAR, FILTRAR], [ENVASAR, SELLAR]);

    const crudas = await columnasCrudas(id);
    expect(crudas).toEqual({ steps: [MEZCLAR, REPOSAR, FILTRAR], packing_steps: [ENVASAR, SELLAR] });
    expect((crudas.steps as Record<string, unknown>[])[1]).not.toHaveProperty('requiresEvidence');
  });

  it('R3: el detalle, el contenido de ejecucion y los pasos de envasado devuelven el flag igual', async () => {
    const id = await original([MEZCLAR, REPOSAR, FILTRAR], [ENVASAR, SELLAR]);

    const fila = await findAliveRecipeById(id, A.scope);
    expect(fila?.steps).toEqual([MEZCLAR, REPOSAR, FILTRAR]);
    expect(fila?.packingSteps).toEqual([ENVASAR, SELLAR]);
    expect(flags(fila?.steps)).toEqual([true, undefined, false]);
    expect(flags(fila?.packingSteps)).toEqual([undefined, true]);

    const ejecucion = await findRecipeExecutionContentById(id, A.companyId);
    expect(ejecucion?.steps).toEqual([MEZCLAR, REPOSAR, FILTRAR]);
    await expect(findRecipePackingStepsById(id, A.companyId)).resolves.toEqual([ENVASAR, SELLAR]);
  });

  it('R3: la edicion que solo cambia el flag lo persiste y la siguiente lectura lo devuelve', async () => {
    const id = await original([MEZCLAR, REPOSAR], [ENVASAR, SELLAR]);
    const editado = updateRecipeSchema.parse({
      name: `Crema editada ${token()}`,
      steps: [paso('Mezclar en frio'), paso('Reposar 10 min', true)],
      packingSteps: [paso('Envasar en garrafas de 5 L', true), paso('Sellar la tapa', false)],
      lines: [{ productId: A.productoId, percentage: '100' }],
    });

    const resultado = await replaceAliveRecipe(
      id,
      {
        ...datos([], []),
        name: editado.name,
        steps: editado.steps,
        packingSteps: editado.packingSteps,
      },
      A.userId,
      new Date(),
      A.scope,
    );
    expect(resultado).toBe('ok');

    const fila = await findAliveRecipeById(id, A.scope);
    expect(flags(fila?.steps)).toEqual([undefined, true]);
    expect(flags(fila?.packingSteps)).toEqual([true, false]);
    expect(flags((await findRecipeExecutionContentById(id, A.companyId))?.steps)).toEqual([undefined, true]);
    expect(flags((await findRecipePackingStepsById(id, A.companyId)) ?? undefined)).toEqual([true, false]);
  });
});

describe('versiones (R6)', () => {
  it('R6: una version no guarda pasos propios y devuelve el flag de los pasos de su original', async () => {
    const originalId = await original([MEZCLAR, REPOSAR], [ENVASAR, SELLAR]);
    const versionId = await version(originalId);

    expect(await columnasCrudas(versionId)).toEqual({ steps: [], packing_steps: [] });

    const fila = await findAliveRecipeById(versionId, A.scope);
    expect(flags(fila?.original?.steps)).toEqual([true, undefined]);
    expect(flags(fila?.original?.packingSteps)).toEqual([undefined, true]);
    expect(flags((await findRecipeExecutionContentById(versionId, A.companyId))?.steps)).toEqual([true, undefined]);
    expect(flags((await findRecipePackingStepsById(versionId, A.companyId)) ?? undefined)).toEqual([undefined, true]);
  });

  it('R6: encender el flag en la original se ve en la siguiente lectura de su version', async () => {
    const originalId = await original([REPOSAR], [ENVASAR]);
    const versionId = await version(originalId);
    expect(flags((await findRecipeExecutionContentById(versionId, A.companyId))?.steps)).toEqual([undefined]);

    const resultado = await replaceAliveRecipe(
      originalId,
      { ...datos([paso('Reposar 10 min', true)], [paso('Envasar en garrafas de 5 L', true)]) },
      A.userId,
      new Date(),
      A.scope,
    );
    expect(resultado).toBe('ok');

    expect(flags((await findRecipeExecutionContentById(versionId, A.companyId))?.steps)).toEqual([true]);
    expect(flags((await findRecipePackingStepsById(versionId, A.companyId)) ?? undefined)).toEqual([true]);
    expect(flags((await findAliveRecipeById(versionId, A.scope))?.original?.steps)).toEqual([true]);
  });
});
