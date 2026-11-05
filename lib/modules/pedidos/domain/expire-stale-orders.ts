// lib/modules/pedidos/domain/expire-stale-orders.ts
/**
 * El proceso diario que cancela las lineas `PENDIENTE` cuya reserva caduco. Recorre las
 * EMPRESAS una por una y, dentro de cada una, sus candidatos por lotes con un cursor
 * `(reservedAt, lineId)`: ninguna consulta lee pedidos de mas de una empresa a la vez, y un
 * candidato que falla queda DETRAS del cursor, asi que no se vuelve a pedir en esta ejecucion.
 *
 * Cada linea se cancela en su PROPIA transaccion: un fallo no arrastra a las demas, la misma
 * transaccion bloquea el pedido y la linea y sirve para recomprobar el plazo bajo el candado
 * antes de tocar nada. Las demas lineas del pedido no cambian, aunque tambien esten `PENDIENTE`. Un fallo al listar empresas o los candidatos de una tampoco
 * detiene a las demas: queda anotado en `failed` con el `stage` que le corresponde, y la
 * ejecucion sigue con la siguiente empresa.
 *
 * Sin actor: es una operacion del sistema, sin permiso que comprobar, y la unica puerta es el
 * secreto del handler.
 */
import { UNEXPECTED_ERROR_CODE } from '@/lib/modules/errores';

import { cancelLockedLine } from './order-cancellation';
import { EXPIRED_ORDER_REASON, ORDER_RESERVATION_TTL_DAYS } from './order-expiry';

import type { OrderScope } from './order-scope';
import type { OrderUnitOfWork } from '../ports/order-unit-of-work';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Una linea candidata a caducar, con lo que hace falta para avanzar el cursor del lote
 *  siguiente. */
export type ExpirableOrderCandidate = {
  readonly orderId: string;
  readonly lineId: string;
  readonly reservedAt: Date;
};

/** El ultimo `(reservedAt, lineId)` visto de una empresa, o `null` para el primer lote. */
export type ExpirableOrdersCursor = { readonly reservedAt: Date; readonly lineId: string } | null;

/** Un fallo del proceso diario: sin mensaje ni datos del pedido, solo lo que hace falta para
 *  diagnosticarlo -donde ocurrio y su codigo del catalogo-. */
export type ExpiredOrderFailure =
  | { readonly stage: 'companies'; readonly code: string }
  | { readonly stage: 'candidates'; readonly companyId: string; readonly code: string }
  | {
      readonly stage: 'order';
      readonly id: string;
      readonly lineId: string;
      readonly companyId: string;
      readonly code: string;
    };

export type ExpireStaleOrdersResult = {
  /** Lineas canceladas. */
  readonly expired: number;
  readonly failed: readonly ExpiredOrderFailure[];
};

export type ExpireStaleOrdersDeps = {
  /** Las empresas a recorrer, una vuelta por cada una. */
  readonly listCompanyIds: () => Promise<readonly string[]>;
  /** Un lote de lineas candidatas de UNA empresa, `PENDIENTE`, vivas, de pedidos vivos y con la
   *  reserva vencida, en el orden `(reservedAt, lineId)` y a partir del cursor del lote anterior. */
  readonly findExpirable: (
    companyId: string,
    threshold: Date,
    cursor: ExpirableOrdersCursor,
    limit: number,
    scope: OrderScope,
  ) => Promise<readonly ExpirableOrderCandidate[]>;
  readonly unitOfWork: OrderUnitOfWork;
  /** Mismo patron que `create-order.ts`: el reloj se inyecta y `lib/composition` lo da real. */
  readonly now?: () => Date;
  /** Cuanto puede correr esta vuelta antes de dejar el resto para la siguiente ejecucion, en
   *  milisegundos. Inyectable solo para que el test no espere 240 s de verdad. */
  readonly budgetMs?: number;
};

const BATCH_LIMIT = 100;
const DEFAULT_BUDGET_MS = 240_000;

/** El codigo del catalogo si el error lo trae -los errores de dominio lo llevan-, o el
 *  generico si no. Nunca el mensaje ni ningun dato del pedido: sin PII en el log. */
function codeOf(error: unknown): string {
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return UNEXPECTED_ERROR_CODE;
}

export function createExpireStaleOrders(
  deps: ExpireStaleOrdersDeps,
): () => Promise<ExpireStaleOrdersResult> {
  const now = deps.now ?? (() => new Date());
  const budgetMs = deps.budgetMs ?? DEFAULT_BUDGET_MS;

  return async function expireStaleOrders(): Promise<ExpireStaleOrdersResult> {
    const instant = now();
    const threshold = new Date(instant.getTime() - ORDER_RESERVATION_TTL_DAYS * MILLISECONDS_PER_DAY);
    const deadline = Date.now() + budgetMs;

    let expired = 0;
    const failed: ExpiredOrderFailure[] = [];

    let companyIds: readonly string[];
    try {
      companyIds = await deps.listCompanyIds();
    } catch (e) {
      failed.push({ stage: 'companies', code: codeOf(e) });
      return { expired, failed };
    }

    for (const companyId of companyIds) {
      if (Date.now() >= deadline) break;

      let cursor: ExpirableOrdersCursor = null;

      while (Date.now() < deadline) {
        let batch: readonly ExpirableOrderCandidate[];
        try {
          batch = await deps.findExpirable(companyId, threshold, cursor, BATCH_LIMIT, { companyId });
        } catch (e) {
          failed.push({ stage: 'candidates', companyId, code: codeOf(e) });
          break;
        }
        if (batch.length === 0) break;

        for (const candidate of batch) {
          try {
            const cancelled = await expireOne(deps.unitOfWork, candidate, companyId, instant, threshold);
            if (cancelled) expired += 1;
          } catch (e) {
            failed.push({ stage: 'order', id: candidate.orderId, lineId: candidate.lineId, companyId, code: codeOf(e) });
          }
        }

        const last = batch[batch.length - 1];
        cursor = { reservedAt: last.reservedAt, lineId: last.lineId };

        if (batch.length < BATCH_LIMIT) break;
      }
    }

    return { expired, failed };
  };
}

/** Una transaccion por linea: bloquea pedido y linea, recomprueba plazo y estado, y si sigue
 *  vencida la cancela, libera lo suyo y deriva el estado del pedido. */
async function expireOne(
  unitOfWork: OrderUnitOfWork,
  candidate: ExpirableOrderCandidate,
  companyId: string,
  instant: Date,
  threshold: Date,
): Promise<boolean> {
  const scope = { companyId };
  const { orderId, lineId } = candidate;

  return unitOfWork.run(async (transaction) => {
    const locked = await transaction.orders.lockAliveLine(orderId, lineId, scope);
    // Idempotencia: otra ejecucion ya la cancelo, dejo de estar viva, o una edicion intercalada
    // reinicio el plazo o la dejo sin material apartado entre el lote y el candado.
    if (
      locked === null ||
      locked.line.status !== 'PENDIENTE' ||
      locked.line.reservedAt === null ||
      locked.line.reservedAt > threshold
    ) {
      return false;
    }

    await cancelLockedLine(transaction, {
      orderId,
      lineId,
      reason: EXPIRED_ORDER_REASON,
      releaseReason: 'expire',
      actorId: null,
      now: instant,
      companyId,
    });
    await transaction.orders.refreshStatus(orderId, null, instant, scope);
    await transaction.orders.mirrorFirstLine(orderId, scope);
    return true;
  });
}
