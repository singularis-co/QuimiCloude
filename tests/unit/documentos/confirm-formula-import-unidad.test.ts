// Confirmacion de una importacion de formula con materia prima nueva: la unidad es obligatoria y
// el homonimo se busca por nombre y familia de la unidad elegida. Dobles de todos los puertos.

import { describe, expect, it, vi } from 'vitest';

import { FORMULA_IMPORT_PERMISSION, type Actor } from '@/lib/modules/documentos/domain/actor';
import { UnauthorizedError, ValidationError } from '@/lib/modules/documentos/domain/errors';
import { createConfirmFormulaImport } from '@/lib/modules/documentos/domain/confirm-formula-import';
import type { FormulaImportDeps } from '@/lib/modules/documentos/domain/preview-formula-import';
import type { DocumentBatchRepository, FileForReview } from '@/lib/modules/documentos/ports/document-batch-repository';

import { PRODUCT_TYPES, type ProductNameMatch } from '@/lib/modules/inventario';
import type { RecipeStepDocument } from '@/lib/modules/recetas';
import type { UnitRef } from '@/lib/modules/unidades';

const EMPRESA = '33333333-3333-4333-8333-333333333333';
const PERSONA = '11111111-1111-4111-8111-111111111111';
const ARCHIVO = '44444444-4444-4444-8444-444444444444';
const KG = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const G = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const L = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const UNIDAD_AJENA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9';

const UNIDADES_VISIBLES: readonly UnitRef[] = [
  { id: KG, name: 'kilogramo', symbol: 'kg', baseUnitId: null, factor: null },
  { id: G, name: 'gramo', symbol: 'g', baseUnitId: KG, factor: '0.0010' },
  { id: L, name: 'litro', symbol: 'l', baseUnitId: null, factor: null },
];

const ARCHIVO_LISTO: FileForReview = { status: 'done', strategy: 'formula', extractedText: null };
const PASO: RecipeStepDocument = { blocks: [{ kind: 'paragraph', spans: [{ text: 'Mezclar' }] }] };

const CON_INVENTARIO: Actor = {
  id: PERSONA,
  companyId: EMPRESA,
  permissions: [FORMULA_IMPORT_PERMISSION, 'inventario.modificar'],
  addons: ['lectura_pdf'],
};
const SIN_INVENTARIO: Actor = { id: PERSONA, companyId: EMPRESA, permissions: [FORMULA_IMPORT_PERMISSION], addons: ['lectura_pdf'] };

function homonimo(id: string, name: string, unitId: string | null): ProductNameMatch {
  return { id, name, nameNormalized: name.toLowerCase(), type: PRODUCT_TYPES.PRODUCT, unitId };
}

function filaNueva(newProductName: string, unitId: string | undefined, percentage = '100.00') {
  return unitId === undefined
    ? { kind: 'new' as const, newProductName, percentage }
    : { kind: 'new' as const, newProductName, unitId, percentage };
}

function entrada(lines: readonly unknown[]) {
  return { documentFileId: ARCHIVO, name: 'Crema', description: null, lines, steps: [PASO], replaceRecipeId: null };
}

function crearDeps(homonimos: readonly ProductNameMatch[] = []) {
  const createRawMaterial = vi.fn(async (input: { name: string; unitId: string }) => ({ id: `nueva-${input.name}` }));
  const createRecipe = vi.fn(async () => ({ id: 'receta-nueva' }));
  const updateRecipe = vi.fn();
  const findRefs = vi.fn(async (ids: readonly string[]) => UNIDADES_VISIBLES.filter((unit) => ids.includes(unit.id)));
  const deps: FormulaImportDeps = {
    repository: { readFileForReview: vi.fn(async () => ARCHIVO_LISTO) } as unknown as DocumentBatchRepository,
    recipes: {
      findAliveByNormalizedName: vi.fn(async () => null),
      findRefsIncludingDeleted: vi.fn(async () => []),
    } as unknown as FormulaImportDeps['recipes'],
    products: { findRefs: vi.fn(async () => []) } as unknown as FormulaImportDeps['products'],
    productNames: {
      findAliveByNormalizedNames: vi.fn(async () => homonimos),
    } as unknown as FormulaImportDeps['productNames'],
    units: { findRefs },
    createRawMaterial: createRawMaterial as unknown as FormulaImportDeps['createRawMaterial'],
    createRecipe: createRecipe as unknown as FormulaImportDeps['createRecipe'],
    updateRecipe: updateRecipe as unknown as FormulaImportDeps['updateRecipe'],
  };
  return { deps, createRawMaterial, createRecipe, findRefs };
}

function lineasDeLaReceta(createRecipe: ReturnType<typeof crearDeps>['createRecipe']) {
  const llamada = createRecipe.mock.calls[0] as unknown as [{ lines: { productId: string }[] }] | undefined;
  return llamada?.[0].lines.map((line) => line.productId);
}

describe('createConfirmFormulaImport — materia prima nueva con unidad', () => {
  it('R24 sin unidad rechaza invalid_input sin crear', async () => {
    const { deps, createRawMaterial, createRecipe } = crearDeps();
    const confirm = createConfirmFormulaImport(deps);

    const error = await confirm(CON_INVENTARIO, entrada([filaNueva('Glicerina', undefined)])).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe('invalid_input');
    expect(createRawMaterial).not.toHaveBeenCalled();
    expect(createRecipe).not.toHaveBeenCalled();
  });

  it('R24 unidad no visible rechaza sin crear', async () => {
    const { deps, createRawMaterial, createRecipe, findRefs } = crearDeps();
    const confirm = createConfirmFormulaImport(deps);

    await expect(
      confirm(CON_INVENTARIO, entrada([filaNueva('Glicerina', KG, '50.00'), filaNueva('Urea', UNIDAD_AJENA, '50.00')])),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(findRefs).toHaveBeenCalledWith(expect.arrayContaining([KG, UNIDAD_AJENA]), EMPRESA);
    expect(createRawMaterial).not.toHaveBeenCalled();
    expect(createRecipe).not.toHaveBeenCalled();
  });

  it('R25 crea la materia prima con la unidad elegida', async () => {
    const { deps, createRawMaterial, createRecipe } = crearDeps();
    const confirm = createConfirmFormulaImport(deps);

    await confirm(CON_INVENTARIO, entrada([filaNueva('Glicerina', G)]));

    expect(createRawMaterial).toHaveBeenCalledWith({ name: 'Glicerina', unitId: G }, CON_INVENTARIO);
    expect(lineasDeLaReceta(createRecipe)).toEqual(['nueva-Glicerina']);
  });

  it('R26 reutiliza el único homónimo de la familia', async () => {
    const { deps, createRawMaterial, createRecipe } = crearDeps([homonimo('prod-kg', 'Glicerina', KG)]);
    const confirm = createConfirmFormulaImport(deps);

    const resumen = await confirm(CON_INVENTARIO, entrada([filaNueva('Glicerina', G)]));

    expect(createRawMaterial).not.toHaveBeenCalled();
    expect(lineasDeLaReceta(createRecipe)).toEqual(['prod-kg']);
    expect(resumen.rawMaterialsReused).toBe(1);
  });

  it('R26 más de uno de la familia rechaza', async () => {
    const { deps, createRawMaterial, createRecipe } = crearDeps([
      homonimo('prod-kg', 'Glicerina', KG),
      homonimo('prod-g', 'Glicerina', G),
    ]);
    const confirm = createConfirmFormulaImport(deps);

    await expect(confirm(CON_INVENTARIO, entrada([filaNueva('Glicerina', KG)]))).rejects.toBeInstanceOf(
      ValidationError,
    );

    expect(createRawMaterial).not.toHaveBeenCalled();
    expect(createRecipe).not.toHaveBeenCalled();
  });

  it('R26 un homónimo sin unidad o de otra familia no cuenta y crea', async () => {
    const { deps, createRawMaterial, createRecipe } = crearDeps([
      homonimo('prod-sin-unidad', 'Glicerina', null),
      homonimo('prod-l', 'Glicerina', L),
    ]);
    const confirm = createConfirmFormulaImport(deps);

    const resumen = await confirm(CON_INVENTARIO, entrada([filaNueva('Glicerina', KG)]));

    expect(createRawMaterial).toHaveBeenCalledWith({ name: 'Glicerina', unitId: KG }, CON_INVENTARIO);
    expect(lineasDeLaReceta(createRecipe)).toEqual(['nueva-Glicerina']);
    expect(resumen.rawMaterialsReused).toBe(0);
  });

  it('R27 el resumen trae creadas con unidad y reutilizadas', async () => {
    const { deps } = crearDeps([homonimo('prod-kg', 'Glicerina', KG)]);
    const confirm = createConfirmFormulaImport(deps);

    const resumen = await confirm(
      CON_INVENTARIO,
      entrada([filaNueva('glicerina', G, '60.00'), filaNueva('  Alcohol  ', L, '40.00')]),
    );

    expect(resumen).toEqual({
      recipeId: 'receta-nueva',
      outcome: 'created',
      rawMaterialsCreated: 1,
      rawMaterialsReused: 1,
      created: [{ name: 'Alcohol', unitId: L }],
      reused: [{ name: 'Glicerina' }],
    });
  });

  it('R28 sin inventario.modificar no crea', async () => {
    const { deps, createRawMaterial, createRecipe } = crearDeps();
    const confirm = createConfirmFormulaImport(deps);

    await expect(confirm(SIN_INVENTARIO, entrada([filaNueva('Glicerina', KG)]))).rejects.toBeInstanceOf(
      UnauthorizedError,
    );

    expect(createRawMaterial).not.toHaveBeenCalled();
    expect(createRecipe).not.toHaveBeenCalled();
  });
});
