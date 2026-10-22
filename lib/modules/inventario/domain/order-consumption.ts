// lib/modules/inventario/domain/order-consumption.ts
//
// Contrato por el que otro modulo lee lo que un pedido consumio de cada lote, sin tocar las
// tablas de este. La implementacion vive en un adaptador driven y se cablea en `lib/composition`.

/** Un lote consumido por un pedido, ya neto: lo que salio de el por asientos `consumption`. */
export type ConsumedLot = {
  readonly batchId: string;
  /** Cadena decimal positiva, en la unidad del lote: -SUM(quantity) de sus asientos. */
  readonly quantity: string;
  /** `unit_cost` del lote al leerlo; `null` = el lote no tiene coste. */
  readonly unitCost: string | null;
};

/** Lectura dentro de la transaccion de quien llama. */
export interface OrderConsumptionLedger {
  findConsumedLots(input: {
    readonly orderId: string;
    readonly companyId: string;
  }): Promise<readonly ConsumedLot[]>;
}
