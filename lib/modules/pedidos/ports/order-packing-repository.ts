import type { OrderScope } from '../domain/order-scope';

/**
 * Puerto de Comenzar el empaque de una linea, fuera de la unidad de trabajo compartida con
 * `inventario` -no toca material ni producto terminado-.
 *
 * Terminar el empaque YA NO vive aqui: da de alta un lote por linea del
 * reparto, y por eso corre DENTRO de `OrderUnitOfWork` -`OrderWriteRepository.finishPackingAlive`
 * y `.findPresentationLinesForFinish`, `ports/order-write-repository.ts`-, para que ese alta y
 * el `UPDATE` del estado compartan la MISMA transaccion.
 *
 * Mismo criterio de ambito que `OrderWriteRepository`: `scope: OrderScope` es SIEMPRE el ultimo
 * parametro (`tests/guards/guard-ambito-empresa-pedidos.test.ts`).
 */
export interface OrderPackingRepository {
  /** Transaccion corta con `SELECT ... FOR UPDATE` del pedido y de la linea, conteo del reparto de
   *  la linea en una sentencia aparte y solo entonces el `UPDATE` de la linea, que vuelve a derivar
   *  el pedido: `'ok'` si mueve la linea; `'without_distribution'` si esta `POR_EMPACAR` sin reparto;
   *  si no, `'not_found'` -tambien una linea de otro pedido o quitada-, `'already_mine'`, `'taken'`
   *  o `'not_packable'` segun la linea bloqueada. */
  startPackingAlive(
    id: string,
    lineId: string,
    packerId: string,
    now: Date,
    scope: OrderScope,
  ): Promise<'ok' | 'already_mine' | 'taken' | 'not_packable' | 'not_found' | 'without_distribution'>;
}
