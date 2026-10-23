const SCALE = 4;
const ZERO = BigInt(0);

const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

function toScaled(amount: string): bigint {
  if (!DECIMAL_PATTERN.test(amount)) {
    throw new Error(`finished-goods-dispatch: no es un decimal valido: ${JSON.stringify(amount)}`);
  }
  const [whole = '', fraction = ''] = amount.split('.');
  const digits = fraction.length > SCALE ? fraction.slice(0, SCALE) : fraction.padEnd(SCALE, '0');
  const negative = whole.startsWith('-');
  const magnitude = BigInt(whole.replace('-', '') + digits);
  return negative ? -magnitude : magnitude;
}

/** Envases enteros de un lote: floor(stock / content), exacto a cuatro decimales. Sin contenido
 *  positivo o sin existencia no hay ningun envase que contar. */
export function wholePackagesIn(stock: string, packageContent: string): number {
  const content = toScaled(packageContent);
  const available = toScaled(stock);
  if (content <= ZERO || available <= ZERO) return 0;
  return Number(available / content);
}

/** `packages x packageContent`, exacto, como `'d.dddd'`. Es lo que sale del lote al entregar
 *  esos envases. */
export function quantityForPackages(packages: number, packageContent: string): string {
  if (!Number.isSafeInteger(packages) || packages < 0) {
    throw new Error(`finished-goods-dispatch: envases no validos: ${String(packages)}`);
  }
  const scaled = BigInt(packages) * toScaled(packageContent);
  const negative = scaled < ZERO;
  const digits = (negative ? -scaled : scaled).toString().padStart(SCALE + 1, '0');
  const cut = digits.length - SCALE;
  return `${negative ? '-' : ''}${digits.slice(0, cut)}.${digits.slice(cut)}`;
}

export type DeliverableBatch = {
  readonly batchId: string;
  readonly presentationId: string;
  readonly lot: string;
  /** YYYY-MM-DD */
  readonly purchaseDate: string;
  readonly expiryDate: string | null;
  /** decimal(14,4) */
  readonly packageContent: string;
  /** Al menos 1: los lotes sin un envase entero no se devuelven. */
  readonly availablePackages: number;
};

/** Lectura fuera de transaccion de los lotes que se pueden entregar, por fecha de entrada y luego
 *  por lote, ascendentes. El orden solo es de presentacion: el lote lo elige el usuario. */
export interface FinishedBatchCatalog {
  findDeliverableBatches(
    recipeId: string,
    presentationIds: readonly string[],
    companyId: string,
  ): Promise<readonly DeliverableBatch[]>;
}

export type FinishedGoodsDispatchInput = {
  readonly companyId: string;
  readonly orderId: string;
  readonly orderDeliveryId: string;
  readonly recipeId: string;
  readonly presentationId: string;
  /** Puede repetir `batchId`: cada lote se descuenta una vez, por la suma de sus envases, con un solo
   *  asiento. */
  readonly allocations: readonly { readonly batchId: string; readonly packages: number }[];
  readonly actorId: string;
  readonly now: Date;
};

export type FinishedGoodsDispatchOutcome =
  | {
      readonly kind: 'dispatched';
      /** Una por asignacion de entrada, en el mismo orden; las de un lote suman su asiento. */
      readonly lines: readonly {
        readonly batchId: string;
        readonly packages: number;
        /** packages x packageContent, decimal(14,4), positivo. */
        readonly quantity: string;
      }[];
    }
  | { readonly kind: 'batch_not_found'; readonly batchId: string }
  | { readonly kind: 'insufficient'; readonly batchId: string; readonly availablePackages: number };

/** Salida de producto terminado hacia un cliente. Lo implementa un adaptador driven de
 *  `inventario` sobre la transaccion de quien llama. */
export interface FinishedGoodsDispatch {
  dispatchForDelivery(input: FinishedGoodsDispatchInput): Promise<FinishedGoodsDispatchOutcome>;
}

/** Un producto terminado listo para entregar sin pedido, leido fuera de transaccion. */
export type FinishedProductForDelivery = {
  readonly productId: string;
  readonly name: string;
  readonly recipeId: string | null;
  readonly presentationId: string | null;
  readonly presentationName: string | null;
  /** Suma de los envases enteros de sus lotes con contenido de envase. */
  readonly stockPackages: number;
  /** Mismo orden que `FinishedBatchCatalog.findDeliverableBatches`. */
  readonly batches: readonly DeliverableBatch[];
};

export type FinishedProductSurplusBase = {
  readonly productId: string;
  readonly recipeId: string | null;
  readonly presentationId: string | null;
  readonly stockPackages: number;
};

export interface FinishedProductDeliveryCatalog {
  /** El producto terminado vivo de la empresa, o `null`. */
  findForDelivery(productId: string, companyId: string): Promise<FinishedProductForDelivery | null>;
  /** Una sola consulta; los ids que no son productos terminados vivos de la empresa no vuelven. */
  findSurplusBases(
    productIds: readonly string[],
    companyId: string,
  ): Promise<readonly FinishedProductSurplusBase[]>;
}

export type FinishedProductDeliveryLock = {
  readonly recipeId: string | null;
  readonly presentationId: string | null;
  readonly stockPackages: number;
};

export type FinishedGoodsDirectDispatchInput = {
  readonly companyId: string;
  readonly productId: string;
  readonly orderDeliveryId: string;
  /** Puede repetir `batchId`: cada lote se descuenta una vez, con un solo asiento. */
  readonly allocations: readonly { readonly batchId: string; readonly packages: number }[];
  readonly actorId: string;
  readonly now: Date;
};

/** Salida de producto terminado sin pedido, sobre la transaccion de quien llama. */
export interface FinishedGoodsDirectDispatch {
  /** Bloquea el producto terminado vivo y lee sus lotes ya bloqueado; `null` si no lo es. */
  lockForDirectDelivery(productId: string, companyId: string): Promise<FinishedProductDeliveryLock | null>;
  dispatchDirect(input: FinishedGoodsDirectDispatchInput): Promise<FinishedGoodsDispatchOutcome>;
}
