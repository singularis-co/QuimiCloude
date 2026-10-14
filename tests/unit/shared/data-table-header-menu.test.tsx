import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { esperarInteractiva, setupUser } from '../../helpers/user-event'

import { DataTable } from '@/components/shared/data-table/data-table'
import { toColumnAlignClass, toColumnJustifyClass } from '@/components/shared/data-table/data-table-column-style'
import {
  DataTableHeaderCell,
  DataTableHeaderMenu,
} from '@/components/shared/data-table/data-table-header-menu'
import { createDefaultParams } from '@/components/shared/data-table/data-table-params'
import type {
  DataTableColumn,
  DataTableParams,
  DataTableSort,
  DataTableTexts,
} from '@/components/shared/data-table/data-table-types'

/**
 * `data-table-header-menu.tsx` (`design.md > 2, 5, 8`, T7): menu por columna y celda de cabecera.
 *
 * Asserts sobre roles ARIA, `data-testid` y constantes -nunca sobre el copy de relleno de
 * `texts`- (decision 20, R36).
 */

type FilaDePrueba = { readonly id: string }

const TEXTOS_DE_RELLENO: DataTableTexts = {
  empty: 'empty',
  loading: 'loading',
  error: 'error',
  search: 'search',
  filters: 'filters',
  columnMenu: 'menu-columna',
  previousPage: 'previousPage',
  nextPage: 'nextPage',
  pageIndicator: (page, totalPages) => `${page}/${totalPages}`,
  pageSize: 'pageSize',
  sortAscending: 'sortAscending',
  sortDescending: 'sortDescending',
  pinColumn: 'pinColumn',
  unpinColumn: 'unpinColumn',
  filterColumn: 'filterColumn',
  clearFilter: 'clearFilter',
  lastWeek: 'lastWeek',
  lastMonth: 'lastMonth',
  lastYear: 'lastYear',
}

function columnaOrdenableConFiltro(): DataTableColumn<FilaDePrueba> {
  return {
    id: 'nombre',
    label: 'Nombre',
    align: 'start',
    cell: (row) => row.id,
    sortable: true,
    filter: { kind: 'text' },
  }
}

function renderCelda(props: {
  readonly column: DataTableColumn<FilaDePrueba>
  readonly sort: DataTableSort | null
  readonly onSortChange: (sort: DataTableSort | null) => void
}) {
  return render(
    <table>
      <thead>
        <tr>
          <DataTableHeaderCell column={props.column} sort={props.sort} onSortChange={props.onSortChange} />
        </tr>
      </thead>
    </table>,
  )
}

describe('DataTableHeaderCell: orden por teclado y aria-sort', () => {
  it('activar la cabecera con teclado emite el orden ascendente cuando no habia orden previo', async () => {
    // R12, R14.
    const usuario = setupUser()
    const onSortChange = vi.fn()
    renderCelda({ column: columnaOrdenableConFiltro(), sort: null, onSortChange })

    await usuario.tab()
    await usuario.keyboard('{Enter}')

    expect(onSortChange).toHaveBeenCalledExactlyOnceWith({ columnId: 'nombre', direction: 'asc' })
  })

  it('una columna sin sortable no ofrece boton de orden y no emite nada al interactuar', async () => {
    // R14.
    const usuario = setupUser()
    const onSortChange = vi.fn()
    const columnaNoOrdenable: DataTableColumn<FilaDePrueba> = {
      id: 'descripcion',
      label: 'Descripcion',
      align: 'start',
      cell: (row) => row.id,
    }
    renderCelda({ column: columnaNoOrdenable, sort: null, onSortChange })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByTestId('data-table-head-descripcion')).not.toHaveAttribute('aria-sort')

    await usuario.tab()
    await usuario.keyboard('{Enter}')

    expect(onSortChange).not.toHaveBeenCalled()
  })

  it('refleja los tres valores de aria-sort segun el orden vigente', () => {
    // R12.
    const columna = columnaOrdenableConFiltro()

    const { unmount: cerrarSinOrden } = renderCelda({ column: columna, sort: null, onSortChange: vi.fn() })
    expect(screen.getByTestId('data-table-head-nombre')).toHaveAttribute('aria-sort', 'none')
    cerrarSinOrden()

    const { unmount: cerrarAsc } = renderCelda({
      column: columna,
      sort: { columnId: 'nombre', direction: 'asc' },
      onSortChange: vi.fn(),
    })
    expect(screen.getByTestId('data-table-head-nombre')).toHaveAttribute('aria-sort', 'ascending')
    cerrarAsc()

    renderCelda({
      column: columna,
      sort: { columnId: 'nombre', direction: 'desc' },
      onSortChange: vi.fn(),
    })
    expect(screen.getByTestId('data-table-head-nombre')).toHaveAttribute('aria-sort', 'descending')
  })

  it('alterna descendente -> ascendente al reactivar una cabecera ya en orden descendente', async () => {
    // R12: la alternancia no vuelve a "sin orden".
    const usuario = setupUser()
    const onSortChange = vi.fn()
    renderCelda({
      column: columnaOrdenableConFiltro(),
      sort: { columnId: 'nombre', direction: 'desc' },
      onSortChange,
    })

    await usuario.tab()
    await usuario.keyboard('{Enter}')

    expect(onSortChange).toHaveBeenCalledExactlyOnceWith({ columnId: 'nombre', direction: 'asc' })
  })
})

describe('DataTableHeaderMenu: disparador, acciones y tamano tactil', () => {
  it('el disparador cumple el objetivo tactil minimo y se abre por teclado', async () => {
    // R27.
    const usuario = setupUser()
    render(
      <DataTableHeaderMenu
        column={columnaOrdenableConFiltro()}
        sort={null}
        isPinned={false}
        texts={TEXTOS_DE_RELLENO}
        onSortChange={vi.fn()}
        onTogglePin={vi.fn()}
        onOpenFilter={vi.fn()}
      />,
    )

    const disparador = screen.getByTestId('data-table-header-menu-nombre')
    expect(disparador).toHaveClass('min-h-11')
    expect(disparador).toHaveClass('min-w-11')
    expect(screen.queryByTestId('data-table-sort-asc-nombre')).not.toBeInTheDocument()

    await usuario.tab()
    await usuario.keyboard('{Enter}')

    expect(await screen.findByTestId('data-table-sort-asc-nombre')).toBeInTheDocument()
  })

  it('ordenar ascendente y descendente emiten el orden esperado y solo aparecen si la columna es sortable', async () => {
    // R12, R14.
    const usuario = setupUser()
    const onSortChange = vi.fn()
    render(
      <DataTableHeaderMenu
        column={columnaOrdenableConFiltro()}
        sort={null}
        isPinned={false}
        texts={TEXTOS_DE_RELLENO}
        onSortChange={onSortChange}
        onTogglePin={vi.fn()}
        onOpenFilter={vi.fn()}
      />,
    )

    await usuario.click(screen.getByTestId('data-table-header-menu-nombre'))
    await usuario.click(await esperarInteractiva(await screen.findByTestId('data-table-sort-desc-nombre')))

    expect(onSortChange).toHaveBeenCalledExactlyOnceWith({ columnId: 'nombre', direction: 'desc' })
  })

  it('una columna sin sortable no ofrece las acciones de orden en el menu', async () => {
    // R14.
    const usuario = setupUser()
    const columnaNoOrdenable: DataTableColumn<FilaDePrueba> = {
      id: 'descripcion',
      label: 'Descripcion',
      align: 'start',
      cell: (row) => row.id,
      filter: { kind: 'text' },
    }
    render(
      <DataTableHeaderMenu
        column={columnaNoOrdenable}
        sort={null}
        isPinned={false}
        texts={TEXTOS_DE_RELLENO}
        onSortChange={vi.fn()}
        onTogglePin={vi.fn()}
        onOpenFilter={vi.fn()}
      />,
    )

    await usuario.click(screen.getByTestId('data-table-header-menu-descripcion'))

    expect(screen.queryByTestId('data-table-sort-asc-descripcion')).not.toBeInTheDocument()
    expect(screen.queryByTestId('data-table-sort-desc-descripcion')).not.toBeInTheDocument()
  })

  it('fijar emite onTogglePin y una columna pinnable:false no ofrece la accion de fijar', async () => {
    // R23.
    const usuario = setupUser()
    const onTogglePin = vi.fn()
    render(
      <DataTableHeaderMenu
        column={columnaOrdenableConFiltro()}
        sort={null}
        isPinned={false}
        texts={TEXTOS_DE_RELLENO}
        onSortChange={vi.fn()}
        onTogglePin={onTogglePin}
        onOpenFilter={vi.fn()}
      />,
    )

    await usuario.click(screen.getByTestId('data-table-header-menu-nombre'))
    await usuario.click(await esperarInteractiva(await screen.findByTestId('data-table-pin-nombre')))

    expect(onTogglePin).toHaveBeenCalledOnce()

    const columnaNoFijable: DataTableColumn<FilaDePrueba> = {
      ...columnaOrdenableConFiltro(),
      id: 'no-fijable',
      pinnable: false,
    }
    render(
      <DataTableHeaderMenu
        column={columnaNoFijable}
        sort={null}
        isPinned={false}
        texts={TEXTOS_DE_RELLENO}
        onSortChange={vi.fn()}
        onTogglePin={vi.fn()}
        onOpenFilter={vi.fn()}
      />,
    )

    await usuario.click(screen.getByTestId('data-table-header-menu-no-fijable'))

    expect(screen.queryByTestId('data-table-pin-no-fijable')).not.toBeInTheDocument()
    expect(screen.queryByTestId('data-table-unpin-no-fijable')).not.toBeInTheDocument()
  })

  it('una columna fijada ofrece "soltar" en vez de "fijar"', async () => {
    // R23.
    const usuario = setupUser()
    render(
      <DataTableHeaderMenu
        column={columnaOrdenableConFiltro()}
        sort={null}
        isPinned
        texts={TEXTOS_DE_RELLENO}
        onSortChange={vi.fn()}
        onTogglePin={vi.fn()}
        onOpenFilter={vi.fn()}
      />,
    )

    await usuario.click(screen.getByTestId('data-table-header-menu-nombre'))

    expect(await screen.findByTestId('data-table-unpin-nombre')).toBeInTheDocument()
    expect(screen.queryByTestId('data-table-pin-nombre')).not.toBeInTheDocument()
  })

  it('abrir el filtro emite onOpenFilter y una columna sin filter no ofrece la accion', async () => {
    // R15.
    const usuario = setupUser()
    const onOpenFilter = vi.fn()
    render(
      <DataTableHeaderMenu
        column={columnaOrdenableConFiltro()}
        sort={null}
        isPinned={false}
        texts={TEXTOS_DE_RELLENO}
        onSortChange={vi.fn()}
        onTogglePin={vi.fn()}
        onOpenFilter={onOpenFilter}
      />,
    )

    await usuario.click(screen.getByTestId('data-table-header-menu-nombre'))
    await usuario.click(await esperarInteractiva(await screen.findByTestId('data-table-filter-open-nombre')))

    expect(onOpenFilter).toHaveBeenCalledOnce()

    const columnaSinFiltro: DataTableColumn<FilaDePrueba> = {
      id: 'sin-filtro',
      label: 'Sin filtro',
      align: 'start',
      cell: (row) => row.id,
      sortable: true,
    }
    render(
      <DataTableHeaderMenu
        column={columnaSinFiltro}
        sort={null}
        isPinned={false}
        texts={TEXTOS_DE_RELLENO}
        onSortChange={vi.fn()}
        onTogglePin={vi.fn()}
        onOpenFilter={vi.fn()}
      />,
    )

    await usuario.click(screen.getByTestId('data-table-header-menu-sin-filtro'))

    expect(screen.queryByTestId('data-table-filter-open-sin-filtro')).not.toBeInTheDocument()
  })
})

type FilaAlineada = { readonly id: string; readonly valor: string }

const FILAS_ALINEADAS: readonly FilaAlineada[] = [{ id: 'f1', valor: 'uno' }]

const COLUMNAS_ALINEADAS: readonly DataTableColumn<FilaAlineada>[] = [
  { id: 'inicio', label: 'Inicio', align: 'start', cell: (row) => row.valor, sortable: true },
  { id: 'fin', label: 'Fin', align: 'end', cell: (row) => row.valor, sortable: true },
  { id: 'centro', label: 'Centro', align: 'center', cell: (row) => row.valor, sortable: true },
]

function TablaAlineadaConEstado({ tableId }: { readonly tableId: string }) {
  const [params, setParams] = useState<DataTableParams>(createDefaultParams())
  return (
    <DataTable
      tableId={tableId}
      columns={COLUMNAS_ALINEADAS}
      rows={FILAS_ALINEADAS}
      getRowId={(row) => row.id}
      params={params}
      totalPages={1}
      onParamsChange={setParams}
      status="idle"
      texts={TEXTOS_DE_RELLENO}
    />
  )
}

function contenedorDeEtiqueta(columnId: string): Element {
  const contenedor = screen.getByTestId(`data-table-head-${columnId}`).firstElementChild
  if (contenedor === null) throw new Error(`la cabecera ${columnId} no tiene contenedor de etiqueta`)
  return contenedor
}

describe('DataTable: la cabecera sigue la alineacion de su columna', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('R1: una columna end pinta la cabecera con text-right y la etiqueta agrupada con justify-end', () => {
    render(<TablaAlineadaConEstado tableId="alineacion-r1" />)

    expect(screen.getByTestId('data-table-head-fin')).toHaveClass('text-right')
    expect(contenedorDeEtiqueta('fin')).toHaveClass('justify-end')
  })

  it('R2: una columna center pinta la cabecera con text-center y la etiqueta agrupada con justify-center', () => {
    render(<TablaAlineadaConEstado tableId="alineacion-r2" />)

    expect(screen.getByTestId('data-table-head-centro')).toHaveClass('text-center')
    expect(contenedorDeEtiqueta('centro')).toHaveClass('justify-center')
  })

  it('R3: una columna start no gana clase de alineacion en la cabecera ni de reparto en su etiqueta', () => {
    render(<TablaAlineadaConEstado tableId="alineacion-r3" />)

    const cabecera = screen.getByTestId('data-table-head-inicio')
    expect(cabecera).not.toHaveClass('text-right')
    expect(cabecera).not.toHaveClass('text-center')
    const contenedor = contenedorDeEtiqueta('inicio')
    expect(contenedor).not.toHaveClass('justify-end')
    expect(contenedor).not.toHaveClass('justify-center')
  })

  it('R4: activar por clic la etiqueta de una columna end o center ordena y aria-sort pasa a ascending', async () => {
    const usuario = setupUser()
    render(<TablaAlineadaConEstado tableId="alineacion-r4-clic" />)

    for (const columnId of ['fin', 'centro']) {
      const cabecera = screen.getByTestId(`data-table-head-${columnId}`)
      expect(cabecera).toHaveAttribute('aria-sort', 'none')

      await usuario.click(within(cabecera).getAllByRole('button')[0])

      expect(screen.getByTestId(`data-table-head-${columnId}`)).toHaveAttribute('aria-sort', 'ascending')
    }
  })

  it('R4: activar por teclado la etiqueta de una columna end o center ordena y aria-sort pasa a ascending', async () => {
    const usuario = setupUser()
    render(<TablaAlineadaConEstado tableId="alineacion-r4-teclado" />)

    for (const columnId of ['fin', 'centro']) {
      const botonDeOrden = within(screen.getByTestId(`data-table-head-${columnId}`)).getAllByRole('button')[0]
      botonDeOrden.focus()
      await usuario.keyboard('{Enter}')

      expect(screen.getByTestId(`data-table-head-${columnId}`)).toHaveAttribute('aria-sort', 'ascending')
    }
  })

  it('R5: el menu de una columna end o center ordena descendente y fija la columna', async () => {
    const usuario = setupUser()
    render(<TablaAlineadaConEstado tableId="alineacion-r5" />)

    for (const columnId of ['fin', 'centro']) {
      await usuario.click(screen.getByTestId(`data-table-header-menu-${columnId}`))
      await usuario.click(await esperarInteractiva(await screen.findByTestId(`data-table-sort-desc-${columnId}`)))

      expect(screen.getByTestId(`data-table-head-${columnId}`)).toHaveAttribute('aria-sort', 'descending')

      await usuario.click(screen.getByTestId(`data-table-header-menu-${columnId}`))
      await usuario.click(await esperarInteractiva(await screen.findByTestId(`data-table-pin-${columnId}`)))

      expect(screen.getByTestId(`data-table-head-${columnId}`)).toHaveAttribute('data-pinned', 'left')
    }
  })

  it('R6: en las tres alineaciones el boton de orden precede en el DOM al disparador del menu', () => {
    render(<TablaAlineadaConEstado tableId="alineacion-r6" />)

    for (const columnId of ['inicio', 'fin', 'centro']) {
      const cabecera = screen.getByTestId(`data-table-head-${columnId}`)
      const botonDeOrden = within(cabecera).getAllByRole('button')[0]
      const disparador = within(cabecera).getByTestId(`data-table-header-menu-${columnId}`)

      expect(botonDeOrden).not.toBe(disparador)
      expect(botonDeOrden.compareDocumentPosition(disparador) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('R7: las celdas del cuerpo conservan text-right en end, text-center en center y ninguna en start', () => {
    render(<TablaAlineadaConEstado tableId="alineacion-r7" />)

    const [celdaFin] = screen.getAllByTestId('data-table-cell-fin')
    const [celdaCentro] = screen.getAllByTestId('data-table-cell-centro')
    const [celdaInicio] = screen.getAllByTestId('data-table-cell-inicio')
    expect(celdaFin).toHaveClass('text-right')
    expect(celdaFin).not.toHaveClass('text-center')
    expect(celdaCentro).toHaveClass('text-center')
    expect(celdaCentro).not.toHaveClass('text-right')
    expect(celdaInicio).not.toHaveClass('text-right')
    expect(celdaInicio).not.toHaveClass('text-center')
  })
})

describe('toColumnAlignClass y toColumnJustifyClass', () => {
  it('R1, R7: end se traduce a text-right y justify-end', () => {
    expect(toColumnAlignClass({ align: 'end' })).toBe('text-right')
    expect(toColumnJustifyClass({ align: 'end' })).toBe('justify-end')
  })

  it('R2, R7: center se traduce a text-center y justify-center', () => {
    expect(toColumnAlignClass({ align: 'center' })).toBe('text-center')
    expect(toColumnJustifyClass({ align: 'center' })).toBe('justify-center')
  })

  it('R3, R7: start no produce clase en ninguna de las dos', () => {
    expect(toColumnAlignClass({ align: 'start' })).toBe('')
    expect(toColumnJustifyClass({ align: 'start' })).toBe('')
  })
})
