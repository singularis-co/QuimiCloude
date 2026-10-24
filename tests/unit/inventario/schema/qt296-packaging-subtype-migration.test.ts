// Contrato estatico del SQL de `*_packaging_subtype`. El comportamiento contra Postgres real lo
// cubren `tests/integration/inventario/qt296-packaging-subtype-*.int.test.ts` y
// `tests/integration/proveedores/qt296-catalog-line-type.int.test.ts`.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    try {
      readFileSync(join(dir, 'package.json'));
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) throw new Error(`no se encontro package.json subiendo desde ${startDir}`);
      dir = parent;
    }
  }
}

const migrationsDir = join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'db', 'migrations');
const candidates = readdirSync(migrationsDir).filter((name) => name.endsWith('_packaging_subtype'));
const migrationDir = join(migrationsDir, candidates[0] ?? 'missing');
const up = (): string => readFileSync(join(migrationDir, 'migration.sql'), 'utf8');
const down = (): string => readFileSync(join(migrationDir, 'down.sql'), 'utf8');

/** Quita comentarios y colapsa espacios para comparar sentencias sin depender del formato. */
function code(sql: string): string {
  return sql
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join(' ')
    .replace(/\s+/g, ' ');
}

/** `[tabla, objeto]` de cada `ADD COLUMN` / `ADD CONSTRAINT` / `CREATE TYPE`. */
function created(sql: string): readonly string[] {
  const out: string[] = [];
  for (const m of sql.matchAll(/ALTER TABLE "(\w+)" ADD (COLUMN|CONSTRAINT) "(\w+)"/g)) out.push(`${m[1]}.${m[3]}`);
  for (const m of sql.matchAll(/CREATE TYPE "(\w+)"/g)) out.push(`type.${m[1]}`);
  return out.sort();
}

function dropped(sql: string): readonly string[] {
  const out: string[] = [];
  for (const m of sql.matchAll(/ALTER TABLE "(\w+)" DROP (COLUMN|CONSTRAINT) "(\w+)"/g)) out.push(`${m[1]}.${m[3]}`);
  for (const m of sql.matchAll(/DROP TYPE "(\w+)"/g)) out.push(`type.${m[1]}`);
  return out.sort();
}

describe('migracion packaging_subtype', () => {
  it('existe exactamente una, con migration.sql y down.sql', () => {
    expect(candidates).toHaveLength(1);
    expect(up().length).toBeGreaterThan(0);
    expect(down().length).toBeGreaterThan(0);
  });

  it('R1, R23: crea los dos enums con sus valores en ingles', () => {
    const sql = code(up());
    expect(sql).toContain(`CREATE TYPE "PackagingSubtype" AS ENUM ('CONTAINER', 'CAP', 'MEASURER', 'OTHER');`);
    expect(sql).toContain(`CREATE TYPE "CatalogLineType" AS ENUM ('RAW_MATERIAL', 'TOOL', 'PACKAGING_MATERIAL');`);
  });

  it('R2, R3, R24: los tres CHECK con su cuerpo', () => {
    const sql = code(up());
    expect(sql).toContain(
      `ADD CONSTRAINT "products_packaging_subtype_matches_type" CHECK ( ("type" = 'PACKAGING') = ("packaging_subtype" IS NOT NULL) )`,
    );
    expect(sql).toContain(
      `ADD CONSTRAINT "products_presentation_only_in_container" CHECK ( "packaging_subtype" IS NULL OR "packaging_subtype" = 'CONTAINER' OR "presentation_id" IS NULL )`,
    );
    expect(sql).toContain(
      `ADD CONSTRAINT "supplier_catalog_lines_packaging_subtype_matches_type" CHECK ( "packaging_subtype" IS NULL OR "type" IS NOT DISTINCT FROM 'PACKAGING_MATERIAL' )`,
    );
  });

  it('R4: rellena los empaques como envase antes del CHECK y dentro del parentesis de RLS, sin tocar updated_at', () => {
    const sql = code(up());
    const noForce = sql.indexOf('ALTER TABLE "products" NO FORCE ROW LEVEL SECURITY');
    const update = sql.indexOf(`UPDATE "products" SET "packaging_subtype" = 'CONTAINER' WHERE "type" = 'PACKAGING';`);
    const check = sql.indexOf('ADD CONSTRAINT "products_packaging_subtype_matches_type"');
    const force = sql.lastIndexOf('ALTER TABLE "products" FORCE ROW LEVEL SECURITY');
    expect(noForce).toBeGreaterThanOrEqual(0);
    expect(update).toBeGreaterThan(noForce);
    expect(check).toBeGreaterThan(update);
    expect(force).toBeGreaterThan(check);
    expect(sql).not.toMatch(/deleted_at/);
    expect(sql).not.toMatch(/updated_at/);
  });

  it('R25: no borra filas ni recrea material ni medidas, y la linea de catalogo no se rellena', () => {
    const sql = code(up());
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bmaterial\b/);
    expect(sql).not.toMatch(/measurements/);
    expect(sql).not.toMatch(/UPDATE "supplier_catalog_lines"/);
    expect(sql).not.toMatch(/"supplier_catalog_lines" ADD COLUMN "[a-z_]+" "\w+" NOT NULL/);
    expect(sql).not.toMatch(/DEFAULT/);
  });

  it('R25: down.sql quita exactamente lo que crea migration.sql, en orden inverso', () => {
    expect(dropped(code(down()))).toEqual(created(code(up())));
    const sql = code(down());
    const lineCheck = sql.indexOf('DROP CONSTRAINT "supplier_catalog_lines_packaging_subtype_matches_type"');
    const lineColumn = sql.indexOf('"supplier_catalog_lines" DROP COLUMN "packaging_subtype"');
    const productChecks = sql.indexOf('DROP CONSTRAINT "products_packaging_subtype_matches_type"');
    const productColumn = sql.indexOf('"products" DROP COLUMN "packaging_subtype"');
    const subtypeType = sql.indexOf('DROP TYPE "PackagingSubtype"');
    expect(lineColumn).toBeGreaterThan(lineCheck);
    expect(productColumn).toBeGreaterThan(productChecks);
    expect(subtypeType).toBeGreaterThan(Math.max(lineColumn, productColumn));
    expect(sql.lastIndexOf('ALTER TABLE "products" FORCE ROW LEVEL SECURITY')).toBeGreaterThan(subtypeType);
  });
});
