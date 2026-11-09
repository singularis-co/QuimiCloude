// QT-314 T14 — Datos y gestos comunes de los tests del panel del pedido y su sub-panel.
//
// El pedido de dos recetas tiene una primera receta distinta de los campos planos del pedido, para
// que un componente que pinte el dato plano se note.

import { screen, waitFor } from '@testing-library/react'
import { expect } from 'vitest'

import {
  ORDER_FORM_ADD_LINE_TESTID,
  ORDER_LINE_SHEET_APPLY_TESTID,
  ORDER_LINE_SHEET_TESTID,
  RECIPE_PICKER_TESTID,
  type RecipePickerPage,
} from '@/app/(private)/pedidos/components'
import { formatOrderNumber, type OrderLineView, type OrderSummary } from '@/lib/modules/pedidos'
import type { RecipeDetail } from '@/lib/modules/recetas'
import type { UnitView } from '@/lib/modules/unidades'

import { esperarInteractiva, type setupUser } from './user-event'

type Usuario = ReturnType<typeof setupUser>

export const UNIDAD: UnitView = {
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Litro',
  symbol: 'L',
  baseUnitId: null,
  factor: null,
  isSystem: true,
}

export const UNIDADES: readonly UnitView[] = [UNIDAD]

export const RECETA_A = {
  id: '10000000-0000-4000-8000-00000000000a',
  name: 'Desengrasante',
  imageUrl: null,
} as const
export const RECETA_B = {
  id: '10000000-0000-4000-8000-00000000000b',
  name: 'Suavizante',
  imageUrl: 'https://ejemplo.test/suavizante.png',
} as const
export const VERSION_B = '10000000-0000-4000-8000-0000000000b2'
export const RECETA_C = {
  id: '10000000-0000-4000-8000-00000000000c',
  name: 'Desinfectante',
  imageUrl: null,
} as const

export const RECETAS: RecipePickerPage = { items: [RECETA_A, RECETA_B, RECETA_C], totalPages: 1 }

export const ENVASE = '30000000-0000-4000-8000-000000000001'
export const PRESENTACION = '40000000-0000-4000-8000-000000000001'

export const LINEA_A_ID = '50000000-0000-4000-8000-00000000000a'
export const LINEA_B_ID = '50000000-0000-4000-8000-00000000000b'
export const PEDIDO_ID = '60000000-0000-4000-8000-000000000001'

export function recetaDetalle(id: string = RECETA_A.id, overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id,
    name: 'Receta',
    description: null,
    imageUrl: null,
    stepCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    steps: [],
    packingSteps: [],
    conditioningSteps: [],
    lines: [],
    tools: [],
    original: null,
    isUnderReview: false,
    displayName: 'Receta',
    ...overrides,
  }
}

export function lineaPedido(overrides: Partial<OrderLineView> = {}): OrderLineView {
  return {
    id: LINEA_A_ID,
    position: 0,
    recipeId: RECETA_A.id,
    recipeName: RECETA_A.name,
    originalRecipeId: RECETA_A.id,
    recipeVersion: null,
    recipeImageUrl: null,
    quantity: '15.0000',
    unitId: UNIDAD.id,
    unitLabel: 'L',
    status: 'PENDIENTE',
    cancellationReason: null,
    presentationLines: [
      {
        presentationId: PRESENTACION,
        presentationName: 'Galón',
        packages: 3,
        packagingProductId: ENVASE,
        packagingName: 'Envase 5 L',
        presentationContent: '5.0000',
        presentationUnitLabel: 'L',
      },
    ],
    salePrice: '120.5000',
    ingredientsCost: '40.0000',
    packagingCost: null,
    actualCost: null,
    finishedAt: null,
    reservedAt: null,
    ...overrides,
  }
}

/** La segunda receta: una versión de Suavizante, en curso y sin precio. */
export function lineaB(overrides: Partial<OrderLineView> = {}): OrderLineView {
  return lineaPedido({
    id: LINEA_B_ID,
    position: 1,
    recipeId: VERSION_B,
    recipeName: 'Suavizante lavanda',
    originalRecipeId: RECETA_B.id,
    recipeVersion: { originalId: RECETA_B.id, originalName: RECETA_B.name, versionName: 'lavanda' },
    recipeImageUrl: RECETA_B.imageUrl,
    quantity: '30.0000',
    status: 'EN_CURSO',
    presentationLines: [],
    salePrice: null,
    ingredientsCost: '25.0000',
    ...overrides,
  })
}

export function pedidoDeDosRecetas(
  lines: readonly OrderLineView[] = [lineaPedido(), lineaB()],
  overrides: Partial<OrderSummary> = {},
): OrderSummary {
  const pedido: OrderSummary = {
    id: PEDIDO_ID,
    number: { year: 2026, sequence: 42 },
    numberText: formatOrderNumber({ year: 2026, sequence: 42 }),
    priority: 'ALTA',
    status: 'PENDIENTE',
    cancellationReason: null,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    customer: null,
    lines,
    progress: { total: lines.length, finished: 0 },
    salePriceTotal: null,
    linesWithoutPrice: 0,
    ingredientsCostTotal: null,
    actualCostTotal: null,
    pendingDelivery: { kind: 'not_packed' },
    ...overrides,
  }
  // Campos planos que el tipo ya no declara, colados con datos que no son de ninguna receta: si la
  // pantalla los leyera por un camino sin tipo, los pintaria.
  return Object.assign(pedido, {
    recipeId: '10000000-0000-4000-8000-0000000000ff',
    recipeName: 'PLANO NO USAR',
    quantity: '999.0000',
    ingredientsCost: '999.0000',
    salePrice: '999.0000',
    unitLabel: 'L',
  })
}

export function subPanel(): HTMLElement | null {
  return screen.queryByTestId(ORDER_LINE_SHEET_TESTID)
}

export async function abrirAnadirReceta(user: Usuario): Promise<void> {
  await user.click(screen.getByTestId(ORDER_FORM_ADD_LINE_TESTID))
  await screen.findByTestId(ORDER_LINE_SHEET_TESTID)
}

export async function elegirReceta(user: Usuario, recetaId: string = RECETA_A.id): Promise<void> {
  await user.click(screen.getByTestId(RECIPE_PICKER_TESTID))
  const opciones = await screen.findAllByTestId(`${RECIPE_PICKER_TESTID}-option`)
  const opcion = opciones.find((candidata) => candidata.getAttribute('data-recipe-id') === recetaId)
  if (opcion === undefined) throw new Error(`no se ofrece la receta ${recetaId}`)
  await user.click(await esperarInteractiva(opcion))
}

export async function elegirUnidad(user: Usuario): Promise<void> {
  await user.click(screen.getByTestId('presentation-unit-select'))
  await user.click(await esperarInteractiva(await screen.findByTestId('presentation-unit-option')))
}

export async function escribirCantidad(user: Usuario, cantidad: string): Promise<void> {
  const campo = screen.getByTestId('order-field-quantity')
  await user.clear(campo)
  await user.type(campo, cantidad)
}

export async function escribirPrecio(user: Usuario, precio: string): Promise<void> {
  const campo = screen.getByTestId('order-field-salePrice')
  await user.clear(campo)
  if (precio !== '') await user.type(campo, precio)
}

export async function aplicar(user: Usuario): Promise<void> {
  await user.click(screen.getByTestId(ORDER_LINE_SHEET_APPLY_TESTID))
}

/** Añade una receta nueva completa y espera a que el sub-panel se cierre. */
export async function anadirReceta(
  user: Usuario,
  { recetaId = RECETA_A.id, cantidad = '10', precio = '' }: { recetaId?: string; cantidad?: string; precio?: string } = {},
): Promise<void> {
  await abrirAnadirReceta(user)
  await elegirReceta(user, recetaId)
  await elegirUnidad(user)
  await escribirCantidad(user, cantidad)
  if (precio !== '') await escribirPrecio(user, precio)
  await aplicar(user)
  await waitFor(() => expect(subPanel()).toBeNull())
}
