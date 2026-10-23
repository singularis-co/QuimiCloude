// Los dos espejos del enum `PackagingSubtype` (inventario y proveedores) y el de `CatalogLineType`
// no pueden divergir entre si ni de `db/schema.prisma`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PACKAGING_SUBTYPES, PACKAGING_SUBTYPE_VALUES, requiresPresentation } from '@/lib/modules/inventario';
import {
  CATALOG_LINE_PACKAGING_SUBTYPES,
  CATALOG_LINE_PACKAGING_SUBTYPES_VALUES,
  CATALOG_LINE_TYPES,
  CATALOG_LINE_TYPE_VALUES,
} from '@/lib/modules/proveedores';

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

const schema = readFileSync(join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'db', 'schema.prisma'), 'utf8');

function enumValues(name: string): readonly string[] {
  const match = new RegExp(`^enum\\s+${name}\\s*\\{([\\s\\S]*?)^\\}`, 'm').exec(schema);
  expect(match, `enum ${name} en db/schema.prisma`).not.toBeNull();
  return (match?.[1] ?? '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('@@'));
}

describe('espejos del subtipo de empaque y del tipo de la linea de catalogo', () => {
  it('R1: el subtipo es un conjunto cerrado de cuatro identificadores en ingles, igual en los dos espejos', () => {
    expect(PACKAGING_SUBTYPE_VALUES).toEqual(['CONTAINER', 'CAP', 'MEASURER', 'OTHER']);
    expect(Object.values(PACKAGING_SUBTYPES)).toEqual([...PACKAGING_SUBTYPE_VALUES]);
    expect(CATALOG_LINE_PACKAGING_SUBTYPES_VALUES).toEqual(PACKAGING_SUBTYPE_VALUES);
    expect(CATALOG_LINE_PACKAGING_SUBTYPES).toEqual(PACKAGING_SUBTYPES);
    expect(Object.isFrozen(PACKAGING_SUBTYPES)).toBe(true);
    expect(Object.isFrozen(CATALOG_LINE_PACKAGING_SUBTYPES)).toBe(true);
  });

  it('R1: los dos espejos coinciden con el enum PackagingSubtype de db/schema.prisma', () => {
    expect(enumValues('PackagingSubtype')).toEqual([...PACKAGING_SUBTYPE_VALUES]);
    expect(enumValues('PackagingSubtype')).toEqual([...CATALOG_LINE_PACKAGING_SUBTYPES_VALUES]);
  });

  it('R23: CATALOG_LINE_TYPE_VALUES coincide con el enum CatalogLineType y no incluye producto terminado', () => {
    expect(enumValues('CatalogLineType')).toEqual([...CATALOG_LINE_TYPE_VALUES]);
    expect(Object.values(CATALOG_LINE_TYPES)).toEqual([...CATALOG_LINE_TYPE_VALUES]);
    expect(CATALOG_LINE_TYPE_VALUES).not.toContain('FINISHED_PRODUCT');
  });

  it('R3: solo el envase requiere presentacion', () => {
    expect(PACKAGING_SUBTYPE_VALUES.filter((subtype) => requiresPresentation(subtype))).toEqual([
      PACKAGING_SUBTYPES.CONTAINER,
    ]);
  });

  it('R1, R24: db/schema.prisma declara las columnas con su enum, anulables y en snake_case', () => {
    const product = /^model Product \{[\s\S]*?^\}/m.exec(schema)?.[0] ?? '';
    const line = /^model SupplierCatalogLine \{[\s\S]*?^\}/m.exec(schema)?.[0] ?? '';
    expect(product).toMatch(/^\s*packagingSubtype\s+PackagingSubtype\?\s+@map\("packaging_subtype"\)/m);
    expect(line).toMatch(/^\s*type\s+CatalogLineType\?\s+@map\("type"\)/m);
    expect(line).toMatch(/^\s*packagingSubtype\s+PackagingSubtype\?\s+@map\("packaging_subtype"\)/m);
  });
});
