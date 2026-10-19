import type { Locator, Page } from '@playwright/test';

/** Celda de la columna «Presentación» de las tablas de inventario. */
export const PRESENTATION_CELL_TESTID = 'data-table-cell-presentationName';

/**
 * Igualdad exacta del nombre de producto EN LA CELDA de la tabla de inventario: la celda pinta
 * solo el nombre, sin unidad ni presentacion. Exacta para no casar con el prefijo de otro.
 */
export function exactProductNameCellText(value: string): RegExp {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s*${escaped}\\s*$`);
}

/**
 * Fila de una tabla de inventario cuyo nombre es `name` y cuya presentacion es `presentation`.
 * Un producto terminado se distingue de sus hermanos de receta solo por la presentacion.
 */
export function productRowByNameAndPresentation(
  page: Page,
  nameCell: Locator,
  presentation: string,
): Locator {
  return page
    .locator('[data-testid^="data-table-row-"]')
    .filter({ has: nameCell })
    .filter({
      has: page
        .getByTestId(PRESENTATION_CELL_TESTID)
        .filter({ hasText: exactProductNameCellText(presentation) }),
    });
}
