// QT-313 T13 — Los campos por linea de `OrderView` para los fixtures de la pantalla actual, que
// todavia solo lee los campos planos del pedido. Vacios a proposito: ningun test que los use mira
// las lineas ni los totales.

import type { OrderView } from '@/lib/modules/pedidos'

export const VISTA_SIN_LINEAS = {
  lines: [],
  progress: { total: 0, finished: 0 },
  salePriceTotal: null,
  linesWithoutPrice: 0,
  ingredientsCostTotal: null,
  actualCostTotal: null,
} as const satisfies Pick<
  OrderView,
  'lines' | 'progress' | 'salePriceTotal' | 'linesWithoutPrice' | 'ingredientsCostTotal' | 'actualCostTotal'
>
