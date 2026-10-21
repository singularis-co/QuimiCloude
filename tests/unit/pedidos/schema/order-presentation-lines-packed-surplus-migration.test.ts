// Contrato estatico del SQL que guarda los envases libres en `order_presentation_lines`.
// Predicados puros sobre el texto, aplicados al archivo real y a una version mutada en memoria.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const migrationsDir = join(repoRoot, 'db', 'migrations');
const SUFFIX = '_order_presentation_lines_packed_surplus';
const CONSTRAINT = 'order_presentation_lines_packed_surplus_within_excess';
const COLUMN = 'packed_surplus_packages';

function migrationNames(): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function migrationDir(): string {
  const found = migrationNames().filter((name) => name.endsWith(SUFFIX));
  if (found.length !== 1) throw new Error(`se esperaba una migracion "${SUFFIX}"; hay ${String(found.length)}`);
  return join(migrationsDir, found[0] as string);
}

function withoutComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
}

const up = withoutComments(readFileSync(join(migrationDir(), 'migration.sql'), 'utf8'));
const down = withoutComments(readFileSync(join(migrationDir(), 'down.sql'), 'utf8'));
const schema = readFileSync(join(repoRoot, 'db', 'schema.prisma'), 'utf8');

/** El cuerpo del CHECK de una constraint: desde `CHECK (` hasta su parentesis de cierre. */
function checkBody(sql: string, name: string): string | null {
  const start = sql.indexOf(`ADD CONSTRAINT "${name}"`);
  if (start < 0) return null;
  const open = sql.indexOf('(', sql.indexOf('CHECK', start));
  let depth = 0;
  for (let i = open; i < sql.length; i += 1) {
    if (sql[i] === '(') depth += 1;
    if (sql[i] === ')') depth -= 1;
    if (depth === 0) return sql.slice(open + 1, i).trim();
  }
  return null;
}

function addsColumn(sql: string): boolean {
  return new RegExp(`ADD COLUMN "${COLUMN}" INTEGER NOT NULL DEFAULT 0;`).test(sql.replace(/ADD COLUMN\s+/g, 'ADD COLUMN '));
}

/** Dos migraciones con el mismo instante dejan el orden de aplicacion al azar del nombre. */
function sharesTimestamp(name: string, others: readonly string[]): boolean {
  const stamp = name.slice(0, 14);
  return others.some((other) => other !== name && other.slice(0, 14) === stamp);
}

describe('migracion order_presentation_lines_packed_surplus', () => {
  it('R8: su instante no lo comparte ninguna otra migracion y va despues del conteo real', () => {
    const names = migrationNames();
    const own = migrationDir().split(/[\\/]/).pop() ?? '';
    expect(sharesTimestamp(own, names)).toBe(false);
    expect(sharesTimestamp(own, [...names, `${own.slice(0, 14)}_otra`])).toBe(true);
    const packedCount = names.find((name) => name.endsWith('_order_presentation_lines_packed_count')) ?? '';
    expect(own > packedCount).toBe(true);
  });

  it('R8, R11: anade la columna entera, NOT NULL y con DEFAULT 0', () => {
    expect(addsColumn(up)).toBe(true);
    expect(addsColumn(up.replace('DEFAULT 0', 'DEFAULT 1'))).toBe(false);
    expect(addsColumn(up.replace('NOT NULL ', ''))).toBe(false);
  });

  it('R11: no reescribe plan, conteo real ni motivos de ninguna linea', () => {
    expect(up).not.toMatch(/\bUPDATE\b/i);
    expect(up).not.toMatch(/ALTER COLUMN|DROP COLUMN|DROP CONSTRAINT/i);
    expect(up.match(/ADD COLUMN/g)).toHaveLength(1);
    expect(/\bUPDATE\b/i.test(`${up} UPDATE "order_presentation_lines" SET "packed_packages" = "packages";`)).toBe(true);
  });

  it('R6, R11: el CHECK solo admite libres en una linea contada y como mucho reales menos plan', () => {
    const body = checkBody(up, CONSTRAINT) ?? '';
    expect(body).toContain(`"${COLUMN}" = 0 OR`);
    expect(body).toContain('"packed_packages" IS NOT NULL');
    expect(body).toContain(`"${COLUMN}" > 0`);
    expect(body).toContain(`"${COLUMN}" <= "packed_packages" - "packages"`);
    expect(checkBody(up.replace(CONSTRAINT, 'otro_nombre'), CONSTRAINT)).toBeNull();
  });

  it('R8: down.sql revierte exactamente: quita el CHECK y luego la columna, y nada mas', () => {
    expect(down).toBe(
      `ALTER TABLE "order_presentation_lines" DROP CONSTRAINT "${CONSTRAINT}"; ` +
        `ALTER TABLE "order_presentation_lines" DROP COLUMN "${COLUMN}";`,
    );
    expect(down).not.toMatch(/DROP TABLE|CASCADE/);
  });

  it('R8: el modelo Prisma mapea la columna con default 0', () => {
    expect(schema).toMatch(/packedSurplusPackages\s+Int\s+@default\(0\)\s+@map\("packed_surplus_packages"\)/);
  });
});
