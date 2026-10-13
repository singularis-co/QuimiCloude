import { fireEvent, render, screen } from '@testing-library/react'
import { esperarInteractiva, setupUser } from '../../helpers/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DataTableFilters } from '@/components/shared/data-table/data-table-filters'
import {
  SEARCH_DEBOUNCE_MS,
  createDefaultParams,
  withFilter,
  withSearch,
  withSort,
  withoutFilters,
} from '@/components/shared/data-table/data-table-params'
import type { DataTableColumn, DataTableParams, DataTableTexts } from '@/components/shared/data-table/data-table-types'
import { NARROW_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport'

/**
 * Barra de filtros en chips. Se afirma sobre lo emitido, los `data-testid`, los roles y las
 * clases que fijan el aspecto; nunca sobre el copy, que llega por `texts`.
 */

type Row = { readonly id: string }

const texts: DataTableTexts = {
  empty: 'vacio',
  loading: 'cargando',
  error: 'error',
  search: 'buscar',
  filters: 'filtros',
  columnMenu: 'menu-columna',
  previousPage: 'anterior',
  nextPage: 'siguiente',
  pageIndicator: (page, totalPages) => `${page}/${totalPages}`,
  pageSize: 'tamano',
  sortAscending: 'asc',
  sortDescending: 'desc',
  pinColumn: 'fijar',
  unpinColumn: 'soltar',
  filterColumn: 'filtrar',
  clearFilter: 'quitar-filtro',
  lastWeek: 'ultima semana',
  lastMonth: 'ultimo mes',
  lastYear: 'ultimo año',
}

const columns: readonly DataTableColumn<Row>[] = [
  { id: 'nombre', label: 'Nombre', align: 'start', cell: (row) => row.id, filter: { kind: 'text' } },
  { id: 'cantidad', label: 'Cantidad', align: 'end', cell: (row) => row.id, filter: { kind: 'numberRange' } },
  {
    id: 'estado',
    label: 'Estado',
    align: 'start',
    cell: (row) => row.id,
    filter: {
      kind: 'select',
      options: [
        { value: 'activo', label: 'Activo' },
        { value: 'inactivo', label: 'Inactivo' },
      ],
    },
  },
  { id: 'creado', label: 'Creado', align: 'start', cell: (row) => row.id, filter: { kind: 'dateRange' } },
  { id: 'notas', label: 'Notas', align: 'start', cell: (row) => row.id },
]

const CHIPS = {
  nombre: 'data-table-filter-chip-nombre',
  cantidad: 'data-table-filter-chip-cantidad',
  estado: 'data-table-filter-estado',
  creado: 'data-table-filter-date-creado',
} as const

function renderFilters(
  overrides: Partial<{ params: DataTableParams; onParamsChange: (next: DataTableParams) => void; texts: DataTableTexts }> = {},
) {
  const onParamsChange = overrides.onParamsChange ?? vi.fn()
  const params = overrides.params ?? createDefaultParams()

  render(
    <DataTableFilters
      columns={columns}
      params={params}
      texts={overrides.texts ?? texts}
      onParamsChange={onParamsChange}
    />,
  )

  return { onParamsChange: onParamsChange as ReturnType<typeof vi.fn>, params }
}

function ultimaEmision(onParamsChange: ReturnType<typeof vi.fn>): DataTableParams {
  return onParamsChange.mock.calls.at(-1)?.[0] as DataTableParams
}

function conTodosActivos(): DataTableParams {
  let params = createDefaultParams()
  params = withFilter(params, 'nombre', { kind: 'text', value: 'acido' })
  params = withFilter(params, 'cantidad', { kind: 'numberRange', min: 1, max: 10 })
  params = withFilter(params, 'estado', { kind: 'select', values: ['activo', 'inactivo'] })
  params = withFilter(params, 'creado', { kind: 'dateRange', from: '2026-01-01', to: '2026-01-31' })
  return params
}

beforeEach(() => {
  setViewportWidth(NARROW_VIEWPORT)
})

afterEach(() => {
  resetViewport()
})

describe('DataTableFilters: un chip por columna con filtro (R52)', () => {
  it('R52 pinta un chip por cada columna que declara filtro, con su etiqueta, y ninguno para la que no', () => {
    renderFilters()

    for (const [columna, testId] of Object.entries(CHIPS)) {
      const chip = screen.getByTestId(testId)
      expect(chip.tagName).toBe('BUTTON')
      expect(chip).toHaveTextContent(columns.find((c) => c.id === columna)?.label ?? '')
    }
    expect(screen.queryByTestId('data-table-filter-notas')).not.toBeInTheDocument()
    expect(screen.queryByTestId('data-table-filter-chip-notas')).not.toBeInTheDocument()
  })

  it('R52 sin filtro activo el chip es punteado, lleva el icono de añadir oculto al lector y mide al menos 44 px', () => {
    renderFilters()

    for (const testId of Object.values(CHIPS)) {
      const chip = screen.getByTestId(testId)
      expect(chip.className).toMatch(/\bborder-dashed\b/)
      expect(chip.className).toMatch(/\bmin-h-11\b/)
      expect(chip.className).toMatch(/\bmin-w-11\b/)
      const icono = chip.querySelector('svg')
      expect(icono).not.toBeNull()
      expect(icono).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('R52 los campos de text y numberRange no están en la barra hasta abrir su chip', () => {
    renderFilters()

    expect(screen.queryByTestId('data-table-filter-nombre')).not.toBeInTheDocument()
    expect(screen.queryByTestId('data-table-filter-min-cantidad')).not.toBeInTheDocument()
    expect(screen.queryByTestId('data-table-filter-max-cantidad')).not.toBeInTheDocument()
  })
})

describe('DataTableFilters: pulsar un chip abre su control y emite igual que antes (R53)', () => {
  it('R53 text: el chip abre un campo y escribir emite { kind: "text", value }', async () => {
    const user = setupUser()
    const { onParamsChange, params } = renderFilters()

    await user.click(screen.getByTestId(CHIPS.nombre))
    // Campo controlado por `params`: sin re-alimentarlo, se afirma sobre una sola tecla.
    await user.type(await esperarInteractiva(await screen.findByTestId('data-table-filter-nombre')), 'a')

    expect(ultimaEmision(onParamsChange)).toEqual(withFilter(params, 'nombre', { kind: 'text', value: 'a' }))
  })

  it('R53 text: vaciar el campo saca la clave del filtro', async () => {
    const user = setupUser()
    const params = withFilter(createDefaultParams(), 'nombre', { kind: 'text', value: 'a' })
    const { onParamsChange } = renderFilters({ params })

    await user.click(screen.getByTestId(CHIPS.nombre))
    await user.clear(await esperarInteractiva(await screen.findByTestId('data-table-filter-nombre')))

    expect(ultimaEmision(onParamsChange).filters).toEqual({})
  })

  it('R53 numberRange: el chip abre mínimo y máximo, y cada uno emite { kind: "numberRange", min, max }', async () => {
    const user = setupUser()
    const { onParamsChange } = renderFilters()

    await user.click(screen.getByTestId(CHIPS.cantidad))
    await user.type(await esperarInteractiva(await screen.findByTestId('data-table-filter-min-cantidad')), '5')
    expect(ultimaEmision(onParamsChange).filters.cantidad).toEqual({ kind: 'numberRange', min: 5, max: null })

    await user.type(screen.getByTestId('data-table-filter-max-cantidad'), '9')
    expect(ultimaEmision(onParamsChange).filters.cantidad).toEqual({ kind: 'numberRange', min: null, max: 9 })
  })

  it('R53 numberRange: vaciar los dos extremos saca la clave del filtro', async () => {
    const user = setupUser()
    const params = withFilter(createDefaultParams(), 'cantidad', { kind: 'numberRange', min: 5, max: null })
    const { onParamsChange } = renderFilters({ params })

    await user.click(screen.getByTestId(CHIPS.cantidad))
    await user.clear(await esperarInteractiva(await screen.findByTestId('data-table-filter-min-cantidad')))

    expect(ultimaEmision(onParamsChange).filters).toEqual({})
  })

  it('R53 select: el chip abre la lista de casillas y marcar una emite { kind: "select", values }', async () => {
    const user = setupUser()
    const { onParamsChange } = renderFilters()

    // Con otros popups montados, el menú de Base UI en jsdom solo abre fiable con un click sintético.
    fireEvent.click(screen.getByTestId(CHIPS.estado))
    await user.click(await esperarInteractiva(await screen.findByTestId('data-table-filter-option-estado-activo')))

    expect(ultimaEmision(onParamsChange).filters.estado).toEqual({ kind: 'select', values: ['activo'] })
  })

  it('R53 dateRange: el chip abre el calendario con atajos y un atajo emite { kind: "dateRange", from, to }', async () => {
    const user = setupUser()
    const { onParamsChange } = renderFilters()

    await user.click(screen.getByTestId(CHIPS.creado))
    await user.click(await esperarInteractiva(await screen.findByTestId('data-table-date-last-week')))

    const creado = ultimaEmision(onParamsChange).filters.creado
    expect(creado?.kind).toBe('dateRange')
    if (creado?.kind === 'dateRange') {
      expect(creado.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(creado.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

describe('DataTableFilters: chip activo (R54, R55)', () => {
  it('R54 con filtro activo el chip es sólido y primario, sin icono de añadir, con el valor en peso 600', () => {
    renderFilters({ params: conTodosActivos() })

    for (const testId of Object.values(CHIPS)) {
      const chip = screen.getByTestId(testId)
      expect(chip.className).toMatch(/\bborder-solid\b/)
      expect(chip.className).toMatch(/\bborder-primary\b/)
      expect(chip.className).toMatch(/\btext-primary\b/)
      expect(chip.className).not.toMatch(/\bborder-dashed\b/)
      expect(chip.querySelector('svg')).toBeNull()
      const valor = chip.querySelector('span.font-semibold')
      expect(valor).not.toBeNull()
      expect(valor?.className).toMatch(/\bborder-l\b/)
    }
  })

  it('R54 R55 el nombre accesible del chip incluye la etiqueta y el valor', () => {
    renderFilters({ params: conTodosActivos() })

    expect(screen.getByTestId(CHIPS.nombre)).toHaveAccessibleName('Nombre acido')
    expect(screen.getByTestId(CHIPS.cantidad)).toHaveAccessibleName('Cantidad 1 – 10')
    expect(screen.getByTestId(CHIPS.estado)).toHaveAccessibleName('Estado Activo +1')
    expect(screen.getByTestId(CHIPS.creado)).toHaveAccessibleName('Creado 2026-01-01 – 2026-01-31')
  })
})

describe('DataTableFilters: quitar un filtro (R57)', () => {
  it('R57 sin filtro activo no existe el botón de quitar ese filtro', () => {
    renderFilters()

    for (const columna of Object.keys(CHIPS)) {
      expect(screen.queryByTestId(`data-table-filter-clear-${columna}`)).not.toBeInTheDocument()
    }
  })

  it('R57 con filtro activo el botón existe, mide 44 × 44 y lleva el nombre de quitar filtro', () => {
    renderFilters({ params: conTodosActivos() })

    for (const columna of Object.keys(CHIPS)) {
      const boton = screen.getByTestId(`data-table-filter-clear-${columna}`)
      expect(boton).toHaveAccessibleName(texts.clearFilter)
      expect(boton.className).toMatch(/\bmin-h-11\b/)
      expect(boton.className).toMatch(/\bmin-w-11\b/)
    }
  })

  it('R57 pulsarlo saca solo la clave de ese filtro', async () => {
    const user = setupUser()
    const conDos = withFilter(
      withFilter(createDefaultParams(), 'nombre', { kind: 'text', value: 'acido' }),
      'cantidad',
      { kind: 'numberRange', min: 1, max: 10 },
    )
    const { onParamsChange } = renderFilters({ params: conDos })

    expect(screen.queryByTestId('data-table-filter-clear-estado')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('data-table-filter-clear-nombre'))

    expect(onParamsChange).toHaveBeenCalledTimes(1)
    expect(ultimaEmision(onParamsChange).filters).toEqual({ cantidad: { kind: 'numberRange', min: 1, max: 10 } })
  })
})

describe('DataTableFilters: «Limpiar filtros» (R56)', () => {
  it('R56 sin filtros activos el botón no existe', () => {
    renderFilters({ params: withSearch(createDefaultParams(), 'acido') })

    expect(screen.queryByTestId('data-table-clear-filters')).not.toBeInTheDocument()
  })

  it('R56 con algún filtro activo aparece al final de la barra de chips', () => {
    renderFilters({ params: withFilter(createDefaultParams(), 'estado', { kind: 'select', values: ['activo'] }) })

    const boton = screen.getByTestId('data-table-clear-filters')
    expect(screen.getByTestId('data-table-chips').lastElementChild).toBe(boton)
    expect(boton.className).toMatch(/\bmin-h-11\b/)
  })

  it('R56 pulsarlo quita todos los filtros en una emisión y conserva búsqueda, orden y tamaño de página', async () => {
    const user = setupUser()
    const params = { ...withSort(withSearch(conTodosActivos(), 'acido'), { columnId: 'nombre', direction: 'asc' }), page: 3, pageSize: 25 } as DataTableParams
    const { onParamsChange } = renderFilters({ params })

    await user.click(screen.getByTestId('data-table-clear-filters'))

    expect(onParamsChange).toHaveBeenCalledTimes(1)
    const emitido = ultimaEmision(onParamsChange)
    expect(emitido).toEqual(withoutFilters(params))
    expect(emitido.filters).toEqual({})
    expect(emitido.search).toBe(params.search)
    expect(emitido.sort).toEqual(params.sort)
    expect(emitido.pageSize).toBe(params.pageSize)
  })

  it('R56 usa texts.clearFilters cuando llega', () => {
    renderFilters({
      params: withFilter(createDefaultParams(), 'nombre', { kind: 'text', value: 'a' }),
      texts: { ...texts, clearFilters: 'quitar-todo' },
    })

    expect(screen.getByTestId('data-table-clear-filters')).toHaveTextContent('quitar-todo')
  })
})

describe('DataTableFilters: contenedor estrecho y velo (R58)', () => {
  it('R58 la barra es contenedor y, a 760 px o menos, la búsqueda y la fila de chips ocupan todo el ancho y parten línea', () => {
    renderFilters()

    const barra = screen.getByTestId('data-table-filters')
    expect(barra.className).toMatch(/@container/)
    expect(barra.className).toMatch(/\bflex-wrap\b/)

    const chips = screen.getByTestId('data-table-chips')
    expect(chips.className).toMatch(/@max-\[760px\]:basis-full/)
    expect(chips.className).toMatch(/\bflex-wrap\b/)

    const envoltorioBusqueda = screen.getByTestId('data-table-search').parentElement
    expect(envoltorioBusqueda?.className).toMatch(/@max-\[760px\]:basis-full/)
  })

  it('R58 el chip usa el velo que solo se aplica con puntero que puede pasar por encima', () => {
    renderFilters()

    for (const testId of Object.values(CHIPS)) {
      const chip = screen.getByTestId(testId)
      expect(chip.className).toMatch(/\bbtn-veil\b/)
      expect(chip.className).not.toMatch(/(^|\s)hover:/)
    }
  })
})

describe('DataTableFilters: la busqueda global se emite en su propio campo, con rebote (R17)', () => {
  it('escribir en la busqueda emite `search` (no `filters`) tras el rebote', async () => {
    vi.useFakeTimers()
    const onParamsChange = vi.fn()
    const params = withFilter(createDefaultParams(), 'nombre', { kind: 'text', value: 'x' })

    render(<DataTableFilters columns={columns} params={params} texts={texts} onParamsChange={onParamsChange} />)

    const campoBusqueda = screen.getByTestId('data-table-search')
    expect(campoBusqueda).toHaveAttribute('type', 'search')

    // Con temporizadores falseados, `userEvent` cuelga en este repo; `fireEvent.change` no.
    fireEvent.change(campoBusqueda, { target: { value: 'acido' } })

    expect(onParamsChange).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)

    expect(onParamsChange).toHaveBeenCalledTimes(1)
    const emitido = onParamsChange.mock.calls[0]?.[0] as DataTableParams
    expect(emitido.search).toBe('acido')
    expect(emitido.filters).toEqual(params.filters)

    vi.useRealTimers()
  })
})

describe('DataTableFilters: acciones de la barra (R30)', () => {
  it('renderiza `toolbarActions` bajo su propio data-testid cuando se recibe', () => {
    render(
      <DataTableFilters
        columns={columns}
        params={createDefaultParams()}
        texts={texts}
        onParamsChange={vi.fn()}
        toolbarActions={<button type="button">Nuevo</button>}
      />,
    )

    expect(screen.getByTestId('data-table-toolbar-actions')).toBeInTheDocument()
  })
})

describe('DataTableFilters: objetivos tactiles minimos (R27)', () => {
  it('el campo de busqueda cumple min-h-11 min-w-11 y text-base', () => {
    renderFilters()

    const campo = screen.getByTestId('data-table-search')
    expect(campo.className).toMatch(/min-h-11/)
    expect(campo.className).toMatch(/min-w-11/)
    expect(campo.className).toMatch(/text-base/)
  })
})

describe('DataTableFilters: campo de busqueda opcional (QC-35 R20)', () => {
  it('con `searchable={false}` el campo de busqueda NO existe en el DOM', () => {
    render(
      <DataTableFilters
        columns={columns}
        params={createDefaultParams()}
        texts={texts}
        onParamsChange={vi.fn()}
        searchable={false}
      />,
    )

    expect(screen.queryByTestId('data-table-search')).toBeNull()
  })

  it('con `searchable={false}` los filtros por columna se siguen montando', () => {
    render(
      <DataTableFilters
        columns={columns}
        params={createDefaultParams()}
        texts={texts}
        onParamsChange={vi.fn()}
        searchable={false}
      />,
    )

    expect(screen.getByTestId(CHIPS.nombre)).toBeInTheDocument()
    expect(screen.getByTestId(CHIPS.estado)).toBeInTheDocument()
  })

  it('sin la prop, el campo de busqueda SI existe (ausente = true, comportamiento de siempre)', () => {
    renderFilters()

    expect(screen.getByTestId('data-table-search')).toBeInTheDocument()
  })

  it('con `searchable={true}` explicito el campo de busqueda existe igual', () => {
    render(
      <DataTableFilters
        columns={columns}
        params={createDefaultParams()}
        texts={texts}
        onParamsChange={vi.fn()}
        searchable
      />,
    )

    expect(screen.getByTestId('data-table-search')).toBeInTheDocument()
  })
})
