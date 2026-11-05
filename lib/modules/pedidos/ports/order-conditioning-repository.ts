import type { OrderScope } from '../domain/order-scope';

/**
 * Puerto de Comenzar y Terminar el acondicionamiento de una linea: cada metodo bloquea el pedido y
 * la linea, la mueve y vuelve a derivar el pedido en una transaccion corta, fuera de la unidad de
 * trabajo compartida con `inventario`, porque ninguno toca material ni producto terminado.
 *
 * `scope: OrderScope` es SIEMPRE el ultimo parametro (`tests/guards/guard-ambito-empresa-pedidos.test.ts`).
 */
export interface OrderConditioningRepository {
  /** `POR_ACONDICIONAR -> EN_ACONDICIONAMIENTO` con `conditionerId` como quien acondiciona.
   *  `'already_mine'` es el mismo acondicionador sobre su propio `EN_ACONDICIONAMIENTO`, sin
   *  escribir; `'taken'`, ese estado a nombre de otro; `'not_conditionable'`, cualquier otro
   *  estado de la linea; `'not_found'`, no existe, esta de baja, es de otra empresa o la linea no es suya. */
  startConditioningAlive(
    id: string,
    lineId: string,
    conditionerId: string,
    now: Date,
    scope: OrderScope,
  ): Promise<'ok' | 'already_mine' | 'taken' | 'not_conditionable' | 'not_found'>;

  /** `EN_ACONDICIONAMIENTO -> TERMINADO` con `finishedAt = now`, solo si `conditionerId` es quien
   *  lo acondiciona. `'not_conditioner'` es ese estado a nombre de otro; `'not_conditionable'`,
   *  cualquier otro estado; `'not_found'`, igual que arriba. */
  finishConditioningAlive(
    id: string,
    lineId: string,
    conditionerId: string,
    now: Date,
    scope: OrderScope,
  ): Promise<'ok' | 'not_conditioner' | 'not_conditionable' | 'not_found'>;
}
