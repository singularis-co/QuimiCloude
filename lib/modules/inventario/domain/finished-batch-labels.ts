/** El lote de produccion de una linea del reparto, con sus datos de lote. Fechas `AAAA-MM-DD`. */
export type FinishedBatchOfOrderLine = {
  readonly batchId: string;
  readonly orderPresentationLineId: string;
  readonly presentationId: string;
  readonly lot: string;
  readonly expiryDate: string | null;
  readonly productionDate: string | null;
};

/** Los tres datos van juntos: un dato guardado no se borra, solo se sustituye. Fechas `AAAA-MM-DD`. */
export type FinishedBatchLabel = {
  readonly lot: string;
  readonly expiryDate: string;
  readonly productionDate: string;
};

/** `no_batches`: el pedido no tiene ningun lote de produccion. `batchId` `null` en `duplicate_lot`:
 *  el choque lo detecto el indice unico en carrera y no se sabe que lote lo causo. */
export type FinishedBatchLabelsOutcome =
  | { readonly kind: 'written' }
  | { readonly kind: 'no_batches' }
  | { readonly kind: 'duplicate_lot'; readonly batchId: string | null };

/** Escribe lote, vencimiento y dia de produccion solo en lotes que entraron por produccion del
 *  pedido. No cambia existencias ni asienta movimientos. */
export interface FinishedBatchLabels {
  /** Un elemento por linea que tiene asiento `production` de ese pedido; una linea sin lote no
   *  aparece. Fuera de transaccion. */
  listOfOrder(companyId: string, orderId: string): Promise<readonly FinishedBatchOfOrderLine[]>;
  /** El mismo dato en todos los lotes que devuelve `listOfOrder`: los elige el servidor, no quien
   *  llama. Todo o nada, en su propia transaccion. */
  writeForOrder(input: {
    readonly companyId: string;
    readonly orderId: string;
    readonly label: FinishedBatchLabel;
    readonly actorId: string;
    readonly now: Date;
  }): Promise<FinishedBatchLabelsOutcome>;
}
