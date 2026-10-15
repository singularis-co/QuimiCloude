// Contrato estatico del SQL que guarda el conteo real de envases en `order_presentation_lines`.
// Predicados puros sobre el texto, aplicados al archivo real y a una version mutada en memoria.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PACKING_DIFFERENCE_REASONS,
  PACKING_INCREASE_REASONS,
  PACKING_REASON_OTHER_MAX,
} from '@/lib/modules/pedidos/domain/packing-count';

const repoRoot = process.cwd();
const migrationsDir = join(repoRoot, 'db', 'migrations');
const SUFFIX = '_order_presentation_lines_packed_count';

function migrationDir(): string {
  const found = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(SUFFIX))
    .map((entry) => entry.name);
  if (found.length !== 1) throw new Error(`se esperaba una migracion "${SUFFIX}"; hay ${String(found.length)}`);
  return join(migrationsDir, found[0] as string);
}

function withoutComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .replace(/\s+/g, ' ');
}

const up = withoutComments(readFileSync(join(migrationDir(), 'migration.sql'), 'utf8'));
const down = withoutComments(readFileSync(join(migrationDir(), 'down.sql'), 'utf8'));
const schema = readFileSync(join(repoRoot, 'db', 'schema.prisma'), 'utf8');

const CONSTRAINTS = [
  'order_presentation_lines_packed_packages_non_negative',
  'order_presentation_lines_packed_reason_in_catalog',
  'order_presentation_lines_packed_reason_matches_count',
  'order_presentation_lines_packed_reason_other_matches',
] as const;

const COLUMNS = ['packed_packages', 'packed_reason', 'packed_reason_other'] as const;

/** El cuerpo del CHECK de una constraint: desde `CHECK (` hasta su parentesis de cierre. */
function checkBody(sql: string, name: string): string | null {
  const start = sql.indexOf(`ADD CONSTRAINT "${name}"`);
  if (start < 0) return null;
  const open = sql.indexOf('(', sql.indexOf('CHECK', start));
  let depth = 0;
  for (let i = open; i < sql.length; i += 1) {
    if (sql[i] === '(') depth += 1;
    if (sql[i] === ')') depth -= 1;
    if (depth === 0) return sql.slice(open + 1, i);
  }
  return null;
}

function quotedList(fragment: string): readonly string[] {
  return [...fragment.matchAll(/'([^']*)'/g)].map((match) => match[1] as string);
}

function reasonCatalog(sql: string): readonly string[] | null {
  const body = checkBody(sql, 'order_presentation_lines_packed_reason_in_catalog');
  const list = body?.match(/IN \(([^)]*)\)/);
  return list ? quotedList(list[1] as string) : null;
}

function increaseReasons(sql: string): readonly string[] | null {
  const body = checkBody(sql, 'order_presentation_lines_packed_reason_matches_count');
  const list = body?.match(/"packed_packages" > "packages" AND "packed_reason" IN \(([^)]*)\)/);
  return list ? quotedList(list[1] as string) : null;
}

function otherTextMax(sql: string): number | null {
  const body = checkBody(sql, 'order_presentation_lines_packed_reason_other_matches');
  const match = body?.match(/char_length\("packed_reason_other"\) <= (\d+)/);
  return match ? Number(match[1]) : null;
}

function addsColumn(sql: string, column: string, type: string): boolean {
  return new RegExp(`ADD COLUMN "${column}" ${type}(,|;| )`).test(sql.replace(/ADD COLUMN\s+/g, 'ADD COLUMN '));
}

/** Dos migraciones con el mismo instante dejan el orden de aplicacion al azar del nombre. */
function sharesTimestamp(name: string, others: readonly string[]): boolean {
  const stamp = name.slice(0, 14);
  return others.some((other) => other !== name && other.slice(0, 14) === stamp);
}

describe('migracion order_presentation_lines_packed_count', () => {
  it('R16: su instante no lo comparte ninguna otra migracion', () => {
    const names = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const own = migrationDir().split(/[\\/]/).pop() ?? '';
    expect(sharesTimestamp(own, names)).toBe(false);
    expect(sharesTimestamp(own, [...names, `${own.slice(0, 14)}_otra`])).toBe(true);
  });

  it('R16: anade las tres columnas anulables del conteo real', () => {
    expect(addsColumn(up, 'packed_packages', 'INTEGER')).toBe(true);
    expect(addsColumn(up, 'packed_reason', 'TEXT')).toBe(true);
    expect(addsColumn(up, 'packed_reason_other', 'TEXT')).toBe(true);
    expect(up).not.toMatch(/NOT NULL,?\s*(ADD COLUMN|;)/);
    expect(addsColumn(up.replace('"packed_reason" TEXT', '"packed_reason" INTEGER'), 'packed_reason', 'TEXT')).toBe(false);
  });

  it('R16: declara los cuatro CHECK', () => {
    for (const name of CONSTRAINTS) expect(checkBody(up, name), name).not.toBeNull();
    expect(checkBody(up.replace(CONSTRAINTS[2], 'otro_nombre'), CONSTRAINTS[2])).toBeNull();
  });

  it('R16: el catalogo de motivos del CHECK es PACKING_DIFFERENCE_REASONS', () => {
    expect(reasonCatalog(up)).toEqual([...PACKING_DIFFERENCE_REASONS]);
    expect(reasonCatalog(up.replace("'rotura', ", ''))).not.toEqual([...PACKING_DIFFERENCE_REASONS]);
  });

  it('R16: con envases de mas el CHECK solo admite PACKING_INCREASE_REASONS', () => {
    expect(increaseReasons(up)).toEqual([...PACKING_INCREASE_REASONS]);
  });

  it('R16: los envases reales no admiten negativos y el motivo exige diferencia', () => {
    expect(checkBody(up, CONSTRAINTS[0])).toContain('"packed_packages" IS NULL OR "packed_packages" >= 0');
    const matches = checkBody(up, CONSTRAINTS[2]) ?? '';
    expect(matches).toContain('"packed_packages" = "packages" AND "packed_reason" IS NULL');
    expect(matches).toContain('"packed_packages" < "packages" AND "packed_reason" IS NOT NULL');
  });

  it('R13: el tope del texto de «Otro» en el CHECK es PACKING_REASON_OTHER_MAX', () => {
    expect(otherTextMax(up)).toBe(PACKING_REASON_OTHER_MAX);
    expect(otherTextMax(up.replace('<= 200', '<= 500'))).not.toBe(PACKING_REASON_OTHER_MAX);
    expect(checkBody(up, CONSTRAINTS[3])).toContain(`btrim("packed_reason_other") <> ''`);
  });

  it('R25: no reescribe las lineas existentes (sin UPDATE ni DEFAULT)', () => {
    expect(up).not.toMatch(/\bUPDATE\b/i);
    expect(up).not.toMatch(/\bDEFAULT\b/i);
    expect(/\bUPDATE\b/i.test(`${up} UPDATE "order_presentation_lines" SET "packed_packages" = "packages";`)).toBe(true);
  });

  it('R16: down.sql quita los cuatro CHECK y las tres columnas, y nada mas', () => {
    for (const name of CONSTRAINTS) expect(down).toContain(`DROP CONSTRAINT "${name}"`);
    for (const column of COLUMNS) expect(down).toContain(`DROP COLUMN "${column}"`);
    expect(down.match(/DROP CONSTRAINT/g)).toHaveLength(CONSTRAINTS.length);
    expect(down.match(/DROP COLUMN/g)).toHaveLength(COLUMNS.length);
    expect(down).not.toMatch(/DROP TABLE|CASCADE/);
  });

  it('R16: down.sql quita los CHECK antes que las columnas', () => {
    const lastConstraint = Math.max(...CONSTRAINTS.map((name) => down.indexOf(name)));
    const firstColumn = Math.min(...COLUMNS.map((column) => down.indexOf(`DROP COLUMN "${column}"`)));
    expect(lastConstraint).toBeLessThan(firstColumn);
  });

  it('R16: el modelo Prisma mapea las tres columnas anulables', () => {
    expect(schema).toMatch(/packedPackages\s+Int\?\s+@map\("packed_packages"\)/);
    expect(schema).toMatch(/packedReason\s+String\?\s+@map\("packed_reason"\)/);
    expect(schema).toMatch(/packedReasonOther\s+String\?\s+@map\("packed_reason_other"\)/);
  });
});
