// tests/unit/asignaciones/order-distribution-view.test.ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as asignaciones from '@/lib/modules/asignaciones';
import {
  distributionPresentationIds,
  toDistributionLines,
  toDistributionPresentations,
  unitLabelOf,
  type DistributionPresentation,
} from '@/lib/modules/asignaciones/domain/order-distribution-view';

/** Presentaciones solo con nombre: sin contenido ni unidad, la etiqueta no pinta volumen. */
function soloNombres(entries: readonly (readonly [string, string])[]): Map<string, DistributionPresentation> {
  return new Map(entries.map(([id, name]) => [id, { name, content: null, unitLabel: null }]));
}

const SIN_VOLUMEN = { presentationContent: null, presentationUnitLabel: null } as const;

const MODULE_ROOT = join(process.cwd(), 'lib', 'modules', 'asignaciones');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

const WRITE_VERB = '(?:create|update|set|save|replace|change|edit|add|remove|delete|clear)';
const DISTRIBUTION_NOUN = '(?:Presentation|Distribution|Unit)';
const WRITE_NAME = new RegExp(`^${WRITE_VERB}\\w*${DISTRIBUTION_NOUN}`, 'i');

describe('QC-170 — order-distribution-view: el reparto en solo lectura', () => {
  it('R26: conserva el orden de llegada de las lineas (el de alta) y resuelve cada nombre', () => {
    const names = soloNombres([
      ['p-1', 'Botella 1L'],
      ['p-2', 'Botella 200 ml'],
    ]);

    expect(
      toDistributionLines(
        [
          { id: 'linea-1', presentationId: 'p-2', packages: 5, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null },
          { id: 'linea-2', presentationId: 'p-1', packages: 1, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null },
        ],
        names,
      ),
    ).toEqual([
      { lineId: 'linea-1', presentationId: 'p-2', presentationName: 'Botella 200 ml', packages: 5, packedPackages: null, packagingName: null , ...SIN_VOLUMEN },
      { lineId: 'linea-2', presentationId: 'p-1', presentationName: 'Botella 1L', packages: 1, packedPackages: null, packagingName: null , ...SIN_VOLUMEN },
    ]);
  });

  it('R26: una presentacion que no vuelve del catalogo deja `presentationName: null` y no se descarta', () => {
    expect(toDistributionLines([{ id: 'linea-3', presentationId: 'p-x', packages: 2, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null }], new Map())).toEqual([
      { lineId: 'linea-3', presentationId: 'p-x', presentationName: null, packages: 2, packedPackages: null, packagingName: null , ...SIN_VOLUMEN },
    ]);
  });

  it('R44: copia el `packagingName` de la linea con envase y deja `null` en la linea antigua (R33)', () => {
    const names = soloNombres([
      ['p-1', 'Botella 1L'],
      ['p-2', 'Bidon 20L'],
    ]);

    expect(
      toDistributionLines(
        [
          { id: 'linea-4', presentationId: 'p-1', packages: 4, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: 'Envase PET 1L' },
          { id: 'linea-5', presentationId: 'p-2', packages: 2, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null },
        ],
        names,
      ),
    ).toEqual([
      { lineId: 'linea-4', presentationId: 'p-1', presentationName: 'Botella 1L', packages: 4, packedPackages: null, packagingName: 'Envase PET 1L' , ...SIN_VOLUMEN },
      { lineId: 'linea-5', presentationId: 'p-2', presentationName: 'Bidon 20L', packages: 2, packedPackages: null, packagingName: null , ...SIN_VOLUMEN },
    ]);
  });

  it('imagen del envase: copia `packagingImageUrl` de cada linea, `null` incluido', () => {
    const lineas = toDistributionLines(
      [
        { id: 'linea-6', presentationId: 'p-1', packages: 1, packedPackages: null, presentationContent: null, packagingProductId: 'env-1', packagingName: 'Envase PET 1L', packagingImageUrl: 'https://cdn.test/productos/env-1.png' },
        { id: 'linea-7', presentationId: 'p-1', packages: 1, packedPackages: null, presentationContent: null, packagingProductId: 'env-2', packagingName: 'Galon', packagingImageUrl: null },
      ],
      soloNombres([['p-1', 'Botella 1L']]),
    );

    expect(lineas.map((linea) => linea.packagingImageUrl)).toEqual(['https://cdn.test/productos/env-1.png', null]);
  });

  it('QC-281 R23: lleva el id de la linea y los envases contados junto al plan', () => {
    expect(
      toDistributionLines(
        [{ id: 'linea-9', presentationId: 'p-1', packages: 5, packedPackages: 3, presentationContent: null, packagingProductId: null, packagingName: null }],
        soloNombres([['p-1', 'Botella 1L']]),
      ),
    ).toEqual([{ lineId: 'linea-9', presentationId: 'p-1', presentationName: 'Botella 1L', packages: 5, packedPackages: 3, packagingName: null , ...SIN_VOLUMEN }]);
  });

  it('la linea lleva el contenido copiado y la etiqueta de la unidad de su presentacion', () => {
    const presentaciones = toDistributionPresentations(
      [{ id: 'p-1', name: 'Botella 300', content: '250.0000', unitId: 'u-ml' }],
      new Map([['u-ml', 'ml']]),
    );

    expect(
      toDistributionLines(
        [{ id: 'linea-10', presentationId: 'p-1', packages: 9, packedPackages: null, presentationContent: '300.0000', packagingProductId: 'e-1', packagingName: 'Embase pequeño 2' }],
        presentaciones,
      ),
    ).toEqual([
      {
        lineId: 'linea-10',
        presentationId: 'p-1',
        presentationName: 'Botella 300',
        packages: 9,
        packedPackages: null,
        packagingName: 'Embase pequeño 2',
        presentationContent: '300.0000',
        presentationUnitLabel: 'ml',
      },
    ]);
  });

  it('sin contenido copiado en la linea, vale el vigente de la presentacion', () => {
    const presentaciones = toDistributionPresentations(
      [{ id: 'p-1', name: 'Botella 1L', content: '1.0000', unitId: 'u-l' }],
      new Map([['u-l', 'L']]),
    );

    expect(
      toDistributionLines(
        [{ id: 'linea-11', presentationId: 'p-1', packages: 2, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null }],
        presentaciones,
      )[0],
    ).toMatchObject({ presentationContent: '1.0000', presentationUnitLabel: 'L' });
  });

  it('una unidad o una presentacion que no vuelven dejan la etiqueta de unidad en `null`', () => {
    const presentaciones = toDistributionPresentations(
      [{ id: 'p-1', name: 'Botella 1L', content: null, unitId: 'u-perdida' }],
      new Map(),
    );

    expect(
      toDistributionLines(
        [
          { id: 'linea-12', presentationId: 'p-1', packages: 1, packedPackages: null, presentationContent: '5.0000', packagingProductId: null, packagingName: null },
          { id: 'linea-13', presentationId: 'p-x', packages: 1, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null },
        ],
        presentaciones,
      ),
    ).toEqual([
      expect.objectContaining({ presentationContent: '5.0000', presentationUnitLabel: null }),
      expect.objectContaining({ presentationName: null, presentationContent: null, presentationUnitLabel: null }),
    ]);
  });

  it('R27: sin lineas, el reparto es `[]`', () => {
    expect(toDistributionLines([], new Map())).toEqual([]);
  });

  it('R26: los ids de presentacion de toda la pagina salen unicos, para una sola llamada al catalogo', () => {
    expect(
      distributionPresentationIds([
        { presentationLines: [{ id: 'linea-6', presentationId: 'p-1', packages: 1, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null }, { id: 'linea-7', presentationId: 'p-2', packages: 2, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null }] },
        { presentationLines: [] },
        { presentationLines: [{ id: 'linea-8', presentationId: 'p-1', packages: 3, packedPackages: null, presentationContent: null, packagingProductId: null, packagingName: null }] },
      ]),
    ).toEqual(['p-1', 'p-2']);
  });

  it('R42: la etiqueta de la unidad es su simbolo, o su nombre si no lo tiene', () => {
    expect(unitLabelOf({ name: 'Litro', symbol: 'L' })).toBe('L');
    expect(unitLabelOf({ name: 'Garrafa', symbol: null })).toBe('Garrafa');
  });

  it('R12: el contrato de `asignaciones` no publica ninguna escritura del reparto ni de la unidad', () => {
    const offending = Object.keys(asignaciones).filter((name) => WRITE_NAME.test(name));
    expect(offending).toEqual([]);
  });

  it('R12: ningun archivo de `asignaciones` declara ni invoca una escritura del reparto o de la unidad', () => {
    const findings: string[] = [];
    const declared = new RegExp(`export\\s+(?:async\\s+)?function\\s+(${WRITE_VERB}\\w*${DISTRIBUTION_NOUN}\\w*)`, 'gi');
    const invoked = /\b(update\w*PresentationLines\w*|updateOrderDistribution\w*)\s*\(/g;
    for (const file of sourceFiles(MODULE_ROOT)) {
      const source = readFileSync(file, 'utf8');
      const rel = relative(process.cwd(), file);
      for (const match of source.matchAll(declared)) findings.push(`${rel}: declara ${match[1]}`);
      for (const match of source.matchAll(invoked)) findings.push(`${rel}: invoca ${match[1]}`);
    }
    expect(findings).toEqual([]);
  });
});
