// Test de fuente (QT-313 T15): `orders` solo guarda la cabecera del pedido. Ni el esquema de Prisma
// ni el SQL crudo de `lib/` y `scripts/` leen o escriben en `orders` la receta, la cantidad, la
// unidad, los costes, el precio, el plazo de reserva ni las etapas: todo eso es de la linea.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

const LINE_COLUMNS = [
  'recipe_id',
  'quantity',
  'unit_id',
  'ingredients_cost',
  'packaging_cost',
  'actual_cost',
  'sale_price',
  'reserved_at',
  'finished_at',
  'packed_by',
  'conditioned_by',
] as const;

const LINE_FIELDS = [
  'recipeId',
  'quantity',
  'unitId',
  'ingredientsCost',
  'packagingCost',
  'actualCost',
  'salePrice',
  'reservedAt',
  'finishedAt',
  'packedBy',
  'conditionedBy',
] as const;

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/u.test(name) ? [path] : [];
  });
}

/** El cuerpo del `model Order` de `db/schema.prisma`, sin comentarios. */
function orderModel(): string {
  const schema = readFileSync(join(ROOT, 'db/schema.prisma'), 'utf8');
  const match = /^model Order \{([\s\S]*?)^\}/mu.exec(schema);
  if (match?.[1] === undefined) throw new Error('db/schema.prisma no declara el modelo Order');
  return match[1].replace(/\/\/\/.*$/gmu, '');
}

/**
 * Cada plantilla de SQL que nombra `orders` y una columna que era suya, sin ser una sentencia que
 * tambien hable de `order_lines`: ahi la columna seria de la linea.
 */
function rawSqlReadingOrderLineColumns(source: string): string[] {
  const templates = [...source.matchAll(/`[^`]*`/gu)].map((match) => match[0]);
  return templates.filter((sql) => {
    if (!/\b(FROM|UPDATE|INTO|JOIN)\s+"orders"/u.test(sql)) return false;
    if (/"order_lines"/u.test(sql)) return LINE_COLUMNS.some((column) => sql.includes(`o."${column}"`));
    return LINE_COLUMNS.some((column) => new RegExp(`"${column}"`, 'u').test(sql));
  });
}

describe('QT-313 T15 — orders solo guarda la cabecera del pedido', () => {
  it('QT-313 R1: el modelo Order de Prisma no declara receta, cantidad, unidad, costes, precio, reserva ni etapas', () => {
    const model = orderModel();

    for (const field of LINE_FIELDS) {
      expect(model, field).not.toMatch(new RegExp(`^\\s*${field}\\s`, 'mu'));
    }
    // Y la linea si las declara: el dato no se perdio, cambio de sitio.
    expect(model).toMatch(/^\s*lines\s+OrderLine\[\]/mu);
  });

  it('QT-313 R1: ningun SQL crudo de lib/ ni de scripts/ lee o escribe en orders las columnas de la linea', () => {
    const files = [...sourceFiles(join(ROOT, 'lib')), ...sourceFiles(join(ROOT, 'scripts'))];
    const offenders = files.flatMap((file) =>
      rawSqlReadingOrderLineColumns(withoutComments(readFileSync(file, 'utf8'))).map(
        (sql) => `${relative(ROOT, file)}: ${sql.slice(0, 80)}`,
      ),
    );

    expect(files.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('QT-313 R1: el detector reconoce una lectura de orders con una columna de la linea', () => {
    expect(rawSqlReadingOrderLineColumns('`SELECT "recipe_id" FROM "orders" WHERE "id" = $1`')).toHaveLength(1);
    expect(rawSqlReadingOrderLineColumns('`UPDATE "orders" AS o SET "status" = l."status" FROM "order_lines" l`')).toEqual([]);
    expect(rawSqlReadingOrderLineColumns('`SELECT o."quantity" FROM "orders" o JOIN "order_lines" l ON l."order_id" = o."id"`')).toHaveLength(1);
  });

  it('QT-313 R1: ya no queda el espejo de orders ni su escritura del plazo de reserva', () => {
    const files = sourceFiles(join(ROOT, 'lib'));
    const offenders = files.filter((file) =>
      /\bmirrorFirstLine\b|\bmirrorFirstOrderLine\b|\bsetReservedAt\b|\bsetOrderReservedAt\b/u.test(
        withoutComments(readFileSync(file, 'utf8')),
      ),
    );

    expect(offenders.map((file) => relative(ROOT, file))).toEqual([]);
  });
});
