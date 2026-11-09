import { z } from 'zod';

import {
  DEFAULT_ORDER_PRIORITY,
  ORDER_PRIORITY_VALUES,
  ORDER_STATUS_VALUES,
  type OrderStatus,
} from './order-classification';
import type { DistributionLineInput } from './resolve-distribution';

/**
 * Esquemas de entrada de los seis casos de uso (`design.md > 7.1-7.3`). Validacion de BORDE
 * (R55): nada sin tipar ni sin validar cruza hacia el dominio. Viven en `domain/` y el
 * contrato los reexporta, asi que la Server Action y -manana- el formulario de QC-35 validan
 * con el MISMO esquema.
 */

/**
 * Desde 2026-09-07 el precio unitario y la unidad salieron del pedido; el precio **unitario**
 * sigue fuera -el precio del pedido entero es `salePrice`-, pero la UNIDAD vuelve (`unitId`,
 * obligatoria en el alta y en la edicion): la cantidad se interpreta siempre en ella, con o sin
 * reparto, y cada linea del reparto la usa para convertir `envases x contenido` de la unidad de
 * su presentacion a la del pedido. `unitPriceSchema` sigue sin existir: lo que el esquema no
 * declara no puede llegar.
 */

/**
 * Cantidad como CADENA decimal, nunca `number`: el dominio no puede importar
 * `Prisma.Decimal` y un `number` de JavaScript es coma flotante binaria
 * (`docs/architecture.md > Anti-patrones`). `Decimal(14, 4)` son hasta 10 digitos enteros y 4
 * decimales. Mismo patron -literal- que `recetas` y `proveedores`; el adaptador driven es
 * quien convierte a `Prisma.Decimal`, y a la salida vuelve con `.toFixed(4)`.
 *
 * El patron NO admite signo, asi que una cantidad NEGATIVA se rechaza aqui, en la forma (R17).
 */
const DECIMAL_14_4 = /^\d{1,10}(\.\d{1,4})?$/;

/**
 * R17: la cantidad tiene que ser MAYOR que cero, y desde el 2026-09-07 es el UNICO decimal que
 * le queda al pedido. El patron por si solo deja pasar "0" y "0.0000", asi que el `> 0` real lo
 * cierra el `refine`.
 */
const quantitySchema = z
  .string()
  .regex(DECIMAL_14_4, { message: 'La cantidad debe ser un numero decimal valido.' })
  .refine((value) => Number.parseFloat(value) > 0, {
    message: 'La cantidad debe ser mayor que cero.',
  });

/** Precio de venta del pedido entero. Ausente, '' o solo espacios = sin precio (`null`); el 0 SI
 *  vale (se regala). El patron no admite signo, asi que un negativo muere aqui. */
const salePriceSchema = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? null : value.trim()))
  .refine((value) => value === null || DECIMAL_14_4.test(value), {
    message: 'El precio debe ser un número decimal mayor o igual que cero.',
  });

/**
 * Receta: aqui, en el borde, solo se valida la FORMA -un UUID-. La EXISTENCIA y la vigencia las
 * comprueba el caso de uso a traves del contrato publico `@/lib/modules/recetas` (R15), nunca
 * consultando su tabla.
 */
const recipeIdSchema = z.string().uuid();

/** R19: conjunto CERRADO. Un valor de fuera muere en el borde y no llega al caso de uso. */
const prioritySchema = z.enum(ORDER_PRIORITY_VALUES);

/**
 * La unidad en que se expresa `quantity`: aqui solo se valida la FORMA -un UUID-.
 * La EXISTENCIA y que sea visible para la empresa de quien escribe las comprueba el caso de uso
 * contra el contrato publico `@/lib/modules/unidades`. Obligatoria en el alta y en la edicion.
 */
const unitIdSchema = z.string().uuid();

/**
 * Una linea del reparto: el envase en que se entrega parte de lo fabricado y cuantos envases
 * ENTEROS, o -solo para conservar una linea antigua sin cambios- su presentacion. Lleva uno y
 * solo uno de los dos identificadores. Aqui solo la FORMA; la existencia, el contenido copiado
 * y el total contra la cantidad del pedido los comprueba el caso de uso.
 */
export const distributionLineSchema = z
  .object({
    packagingProductId: z.string().uuid().optional(),
    presentationId: z.string().uuid().optional(),
    packages: z.coerce.number().int().positive(),
  })
  .refine((line) => (line.packagingProductId === undefined) !== (line.presentationId === undefined), {
    message: 'Cada línea nombra un envase o una presentación, no las dos.',
  })
  .transform((line): DistributionLineInput => {
    if (line.packagingProductId !== undefined) {
      return { packagingProductId: line.packagingProductId, packages: line.packages };
    }
    return { presentationId: line.presentationId ?? '', packages: line.packages };
  });

/** El mismo envase dos veces, o la misma presentacion antigua dos veces, no son dos lineas: el
 *  borde lo rechaza en vez de sumarlas. Dos envases distintos con la misma presentacion solo se
 *  ven al resolverlos, y los rechaza el caso de uso. */
function hasNoDuplicateLine(lines: readonly DistributionLineInput[]): boolean {
  const keys = lines.map((line) =>
    'packagingProductId' in line ? `envase:${line.packagingProductId}` : `presentacion:${line.presentationId}`,
  );
  return new Set(keys).size === keys.length;
}

const distributionLinesSchema = z
  .array(distributionLineSchema)
  .refine(hasNoDuplicateLine, { message: 'Cada envase aparece una sola vez.' });

/** El reparto completo. `[]` es un pedido sin reparto todavia, valido: quien no reparte
 *  nada al dar de alta lo reparte despues, hasta que empieza el empaque. */
export const presentationLinesSchema = distributionLinesSchema.default([]);

/** Nombres de los campos repetidos con que el formulario envia el reparto, en orden. */
export const ORDER_DISTRIBUTION_PRESENTATION_FIELD = 'presentationLines.presentationId';
export const ORDER_DISTRIBUTION_PACKAGES_FIELD = 'presentationLines.packages';
export const ORDER_DISTRIBUTION_PACKAGING_FIELD = 'presentationLines.packagingProductId';

/**
 * Los estados que una EDICION puede escribir (R24). Se DERIVA de `ORDER_STATUS_VALUES`
 * quitando `'CANCELADO'`, y no se escribe a mano: asi, el dia que aparezca un quinto estado,
 * quien lo anada tiene que decidir explicitamente si es editable en vez de heredarlo por
 * descuido de una lista copiada.
 */
export type EditableOrderStatus = Exclude<OrderStatus, 'CANCELADO'>;

export const EDITABLE_STATUS_VALUES: readonly EditableOrderStatus[] = ORDER_STATUS_VALUES.filter(
  (status): status is EditableOrderStatus => status !== 'CANCELADO',
);

/**
 * Cancelacion (R27). El tope de 500 vive AQUI, en la validacion de aplicacion, y no en el tipo
 * de la columna -que es `TEXT` sin longitud- (decision cerrada 4): cambiarlo es una linea y su
 * caso de test, no una migracion.
 *
 * `trim()` va ANTES de `min(1)` y de `max(500)`: si se aplicara despues, un motivo de solo
 * espacios pasaria el minimo y uno de 500 caracteres mas espacios se rechazaria sin motivo.
 */
export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

// '' es «Original»: la receta sin version.
const recipeVersionIdSchema = z
  .preprocess((value) => (value === '' ? null : value), z.string().uuid().nullable())
  .default(null);

// Sin `.uuid()`: un id sin forma tiene que acabar en `customer_not_found`, no en `invalid_input`.
const customerIdSchema = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? null : value));

/** Una receta del pedido. Prioridad y cliente son del pedido: si llegan aqui, `z.object` los
 *  descarta. */
export const orderLineInputSchema = z.object({
  id: z.string().uuid().optional(),
  recipeId: recipeIdSchema,
  recipeVersionId: recipeVersionIdSchema,
  quantity: quantitySchema,
  unitId: unitIdSchema,
  presentationLines: presentationLinesSchema,
  salePrice: salePriceSchema,
});

function hasNoRepeatedLineId(lines: readonly { readonly id?: string | undefined }[]): boolean {
  const ids = lines.flatMap((line) => (line.id === undefined ? [] : [line.id]));
  return new Set(ids).size === ids.length;
}

/**
 * Lo que el esquema no declara no llega: `z.object` descarta `status`, motivo, correlativo y
 * autores. El estado de alta lo pone el caso de uso y los autores salen de la sesion. La prioridad
 * ausente es la de defecto del dominio, aplicada aqui para que nadie tenga que volver a resolverla.
 */
const orderWithLinesSchema = z.object({
  lines: z
    .array(orderLineInputSchema)
    .min(1)
    .refine(hasNoRepeatedLineId, { message: 'Cada línea aparece una sola vez.' }),
  priority: prioritySchema.default(DEFAULT_ORDER_PRIORITY),
  customerId: customerIdSchema,
  /** Permiso para guardar el pedido bloqueado si el material no alcanza; no elige el estado. */
  confirmBlocked: z.boolean().default(false),
});

export const createOrderSchema = orderWithLinesSchema.refine(
  (order) => order.lines.every((line) => line.id === undefined),
  { message: 'Una línea nueva no trae identificador.', path: ['lines'] },
);

/** Reemplazo completo: una receta guardada que no llega se quita, y una sin `id` es nueva. */
export const updateOrderSchema = orderWithLinesSchema;

export const cancelOrderLineSchema = cancelOrderSchema;

export type OrderLineInput = z.infer<typeof orderLineInputSchema>;
export type CancelOrderLineInput = z.infer<typeof cancelOrderLineSchema>;

/**
 * QC-57 (R25): **`listOrdersSchema` DESAPARECIO.** El listado de pedidos ya no tiene forma
 * propia de consulta: el estado y la prioridad dejan de ser parametros suyos y entran como
 * filtros `select` del contrato generico (`domain/list-query.ts`), igual que en las otras seis
 * listas. Lo que aquel esquema garantizaba sigue garantizado, en otro sitio:
 *
 *   - los dos filtros OPCIONALES y COMBINABLES -ahora dos entradas de `filters`-;
 *   - su conjunto CERRADO (R19) -ahora lo poda `list-orders.ts` contra `ORDER_STATUS_VALUES` y
 *     `ORDER_PRIORITY_VALUES`; la diferencia deliberada es que un valor de fuera ya no rechaza
 *     la consulta: se omite y se anota, como cualquier campo no declarado (R5)-;
 *   - que un pedido `CANCELADO` SI se consulta (R25);
 *   - y que no hay busqueda por texto (R17: `orders` no tiene columna `name`, la busqueda se
 *     omite y se registra).
 *
 * `pageQuerySchema` se queda: lo publica el contrato del modulo y su forma es la que el
 * contrato de lista hereda para `page`/`pageSize`.
 */

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

/**
 * Receta, cantidad y unidad, con la MISMA regla que una receta del pedido -`pick` hereda la
 * forma UUID y el patron decimal sin copiarlos-. Sin unidad no hay cotizacion: la necesidad se
 * expresa en la unidad de la receta. Un `companyId` en la entrada no llega a
 * ninguna parte: `z.object` descarta las claves de mas.
 *
 * `orderLineId` es OPCIONAL y solo llega al editar una linea que ya existe: lo que esa linea tiene
 * apartado cuenta como disponible para ella, y lo de las demas lineas del pedido no. Esta entrada
 * no abre ninguna lectura de la linea: el identificador viaja como cadena opaca hasta
 * `findCostingBatches`.
 */
export const quoteOrderCostSchema = orderLineInputSchema
  .pick({ recipeId: true, quantity: true, unitId: true })
  .extend({ orderLineId: z.string().uuid().optional(), presentationLines: distributionLinesSchema.optional() });

export type QuoteOrderCostInput = Omit<z.infer<typeof quoteOrderCostSchema>, 'presentationLines'> & {
  /** Las lineas antiguas no suman costo de envase. */
  readonly presentationLines?: readonly DistributionLineInput[];
};

/**
 * «Cuanto queda disponible», de solo lectura. Comparte forma con una receta del pedido -misma
 * cantidad, misma unidad, mismo reparto- porque el calculo se hace ANTES de guardar.
 */
export const orderPresentationAvailabilitySchema = orderLineInputSchema.pick({
  quantity: true,
  unitId: true,
  presentationLines: true,
});

export type OrderPresentationAvailabilityInput = z.infer<typeof orderPresentationAvailabilitySchema>;

/**
 * La edicion ACOTADA «Reparto y unidad» de una receta, nombrada por `lineId`. A
 * diferencia de `createOrderSchema`/`updateOrderSchema` -que cubren el pedido ENTERO y
 * descartan las claves de mas en silencio-, este esquema es `.strict()`: la cantidad, la
 * receta o los responsables no se ignoran, RECHAZAN la entrada entera, porque este formulario
 * no tiene permiso para tocarlos.
 */
export const updateOrderDistributionSchema = z
  .object({
    lineId: z.string().uuid(),
    unitId: unitIdSchema,
    presentationLines: presentationLinesSchema,
    confirmBlocked: z.boolean().default(false),
  })
  .strict();

export type UpdateOrderDistributionInput = Omit<
  z.infer<typeof updateOrderDistributionSchema>,
  'presentationLines' | 'confirmBlocked'
> & {
  readonly presentationLines: readonly DistributionLineInput[];
  /** Permiso explicito para dejar el pedido bloqueado si un envase o material no alcanza. */
  readonly confirmBlocked?: boolean;
};
