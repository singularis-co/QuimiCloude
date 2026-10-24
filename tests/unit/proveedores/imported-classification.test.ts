// QT-296 T6 — regla unica de tipo y subtipo al reimportar una linea viva (`design.md > 5.3, 6.3`).
// La misma tabla la aplica el SQL de `upsertCatalogLinesByIdentity`; su prueba contra Postgres
// esta en `tests/integration/proveedores/catalog-import-upsert.int.test.ts`.

import { describe, expect, it } from 'vitest'

import {
  CATALOG_LINE_PACKAGING_SUBTYPES_VALUES,
  CATALOG_LINE_TYPE_VALUES,
  resolveImportedClassification,
  type CatalogLineClassification,
} from '@/lib/modules/proveedores'

const SIN: CatalogLineClassification = { type: null, packagingSubtype: null }

function c(
  type: CatalogLineClassification['type'],
  packagingSubtype: CatalogLineClassification['packagingSubtype'] = null,
): CatalogLineClassification {
  return { type, packagingSubtype }
}

describe('resolveImportedClassification', () => {
  it.each([
    // guardado,                               importado,                              resultado
    [SIN, SIN, SIN],
    [SIN, c('TOOL'), c('TOOL')],
    [SIN, c('PACKAGING_MATERIAL', 'CAP'), c('PACKAGING_MATERIAL', 'CAP')],
    [SIN, c('PACKAGING_MATERIAL'), c('PACKAGING_MATERIAL')],
    [c('PACKAGING_MATERIAL', 'CAP'), SIN, c('PACKAGING_MATERIAL', 'CAP')],
    [c('PACKAGING_MATERIAL', 'CAP'), c('PACKAGING_MATERIAL'), c('PACKAGING_MATERIAL', 'CAP')],
    [c('PACKAGING_MATERIAL', 'CAP'), c('PACKAGING_MATERIAL', 'CONTAINER'), c('PACKAGING_MATERIAL', 'CONTAINER')],
    [c('PACKAGING_MATERIAL', 'CAP'), c('TOOL'), c('TOOL')],
    [c('PACKAGING_MATERIAL', 'CAP'), c('RAW_MATERIAL'), c('RAW_MATERIAL')],
    [c('PACKAGING_MATERIAL'), c('PACKAGING_MATERIAL', 'MEASURER'), c('PACKAGING_MATERIAL', 'MEASURER')],
    [c('RAW_MATERIAL'), SIN, c('RAW_MATERIAL')],
    [c('RAW_MATERIAL'), c('PACKAGING_MATERIAL'), c('PACKAGING_MATERIAL')],
    [c('RAW_MATERIAL'), c('PACKAGING_MATERIAL', 'OTHER'), c('PACKAGING_MATERIAL', 'OTHER')],
    [c('TOOL'), c('RAW_MATERIAL'), c('RAW_MATERIAL')],
  ] as const)(
    'R34 — guardado %j + importado %j = %j',
    (stored, incoming, expected) => {
      expect(resolveImportedClassification(stored, incoming)).toEqual(expected)
    },
  )

  it('R34 — un subtipo importado sin tipo empaque resultante se descarta', () => {
    expect(resolveImportedClassification(c('TOOL'), c(null, 'CAP'))).toEqual(c('TOOL'))
    expect(resolveImportedClassification(SIN, c(null, 'CAP'))).toEqual(SIN)
    expect(resolveImportedClassification(c('PACKAGING_MATERIAL'), c(null, 'CAP'))).toEqual(
      c('PACKAGING_MATERIAL', 'CAP'),
    )
  })

  it('R34 — el resultado nunca deja un subtipo bajo un tipo que no es empaque, en todas las combinaciones', () => {
    const tipos = [null, ...CATALOG_LINE_TYPE_VALUES]
    const subtipos = [null, ...CATALOG_LINE_PACKAGING_SUBTYPES_VALUES]
    const validas = tipos.flatMap((type) =>
      (type === 'PACKAGING_MATERIAL' ? subtipos : [null]).map((packagingSubtype) => c(type, packagingSubtype)),
    )
    const importadas = tipos.flatMap((type) => subtipos.map((packagingSubtype) => c(type, packagingSubtype)))

    for (const stored of validas) {
      for (const incoming of importadas) {
        const result = resolveImportedClassification(stored, incoming)
        expect(result.type).toBe(incoming.type ?? stored.type)
        if (result.type !== 'PACKAGING_MATERIAL') expect(result.packagingSubtype).toBeNull()
      }
    }
  })
})
