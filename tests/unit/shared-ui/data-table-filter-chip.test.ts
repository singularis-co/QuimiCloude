import { describe, expect, it } from 'vitest'

import { formatFilterChipValue } from '@/components/shared/data-table/data-table-filter-chip'
import type { DataTableFilterSpec } from '@/components/shared/data-table/data-table-types'

const SELECT: DataTableFilterSpec = {
  kind: 'select',
  options: [
    { value: 'EN_CURSO', label: 'En curso' },
    { value: 'TERMINADO', label: 'Terminado' },
    { value: 'CANCELADO', label: 'Cancelado' },
  ],
}

describe('formatFilterChipValue: el valor que se pinta dentro del chip (R55)', () => {
  it('R55 select con una opción: la etiqueta de la opción', () => {
    expect(formatFilterChipValue(SELECT, { kind: 'select', values: ['TERMINADO'] })).toBe('Terminado')
  })

  it('R55 select con varias opciones: la primera seguida de «+N»', () => {
    expect(formatFilterChipValue(SELECT, { kind: 'select', values: ['EN_CURSO', 'TERMINADO'] })).toBe('En curso +1')
    expect(
      formatFilterChipValue(SELECT, { kind: 'select', values: ['CANCELADO', 'EN_CURSO', 'TERMINADO'] }),
    ).toBe('Cancelado +2')
  })

  it('R55 select con un valor que no está entre las opciones: el valor tal cual', () => {
    expect(formatFilterChipValue(SELECT, { kind: 'select', values: ['OTRO'] })).toBe('OTRO')
  })

  it('R55 text: el texto', () => {
    expect(formatFilterChipValue({ kind: 'text' }, { kind: 'text', value: 'acido' })).toBe('acido')
  })

  it('R55 numberRange: «mín – máx», «≥ mín» o «≤ máx» según los extremos', () => {
    const spec: DataTableFilterSpec = { kind: 'numberRange' }
    expect(formatFilterChipValue(spec, { kind: 'numberRange', min: 1, max: 10 })).toBe('1 – 10')
    expect(formatFilterChipValue(spec, { kind: 'numberRange', min: 0, max: null })).toBe('≥ 0')
    expect(formatFilterChipValue(spec, { kind: 'numberRange', min: null, max: 2.5 })).toBe('≤ 2.5')
  })

  it('R55 dateRange: «desde – hasta» en AAAA-MM-DD, sin conversión', () => {
    const spec: DataTableFilterSpec = { kind: 'dateRange' }
    expect(formatFilterChipValue(spec, { kind: 'dateRange', from: '2026-01-01', to: '2026-01-31' })).toBe(
      '2026-01-01 – 2026-01-31',
    )
    expect(formatFilterChipValue(spec, { kind: 'dateRange', from: '2026-01-01', to: null })).toBe('≥ 2026-01-01')
    expect(formatFilterChipValue(spec, { kind: 'dateRange', from: null, to: '2026-01-31' })).toBe('≤ 2026-01-31')
  })

  it('R54 sin valor el filtro no está activo: devuelve null', () => {
    expect(formatFilterChipValue(SELECT, undefined)).toBeNull()
    expect(formatFilterChipValue(SELECT, { kind: 'select', values: [] })).toBeNull()
    expect(formatFilterChipValue({ kind: 'text' }, { kind: 'text', value: '' })).toBeNull()
    expect(formatFilterChipValue({ kind: 'numberRange' }, { kind: 'numberRange', min: null, max: null })).toBeNull()
    expect(formatFilterChipValue({ kind: 'dateRange' }, { kind: 'dateRange', from: null, to: null })).toBeNull()
  })

  it('R54 un valor de otra forma que la del filtro no cuenta como activo', () => {
    expect(formatFilterChipValue({ kind: 'text' }, { kind: 'select', values: ['x'] })).toBeNull()
  })
})
