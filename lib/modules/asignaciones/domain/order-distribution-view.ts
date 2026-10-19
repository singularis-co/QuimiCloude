// lib/modules/asignaciones/domain/order-distribution-view.ts
/**
 * El reparto del pedido y la etiqueta de su unidad tal como los leen las vistas de este modulo.
 * Solo lectura: `asignaciones` no tiene ninguna forma de escribir ni el reparto ni la unidad.
 */
import type { AssignedOrderPresentationLine } from '@/lib/modules/pedidos';
import type { PresentationRef } from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';

export type OrderDistributionLineView = {
  readonly lineId: string;
  readonly presentationId: string;
  /** `null` = la presentacion no volvio del catalogo: la pantalla pinta el marcador de ausencia. */
  readonly presentationName: string | null;
  readonly packages: number;
  /** Envases contados al terminar el empaque; `null` = sin contar todavia, o empacado antes de que
   *  se contaran. */
  readonly packedPackages: number | null;
  /** `null` = linea antigua o envase que no volvio: la pantalla cae al nombre de la presentacion. */
  readonly packagingName: string | null;
  /** Cadena decimal: el contenido copiado en la linea o, sin copia, el vigente de la
   *  presentacion. `null` = ninguno de los dos: la etiqueta no pinta el volumen. */
  readonly presentationContent: string | null;
  /** Simbolo (o nombre) de la unidad de la PRESENTACION, en la que se expresa el contenido;
   *  `null` si la presentacion o su unidad no vuelven del catalogo. */
  readonly presentationUnitLabel: string | null;
  /** `null` = sin envase, envase que no volvio o envase sin imagen: la pantalla pinta el marcador. */
  readonly packagingImageUrl?: string | null;
};

/** Lo que una linea toma de su presentacion: nombre, contenido vigente y etiqueta de su unidad. */
export type DistributionPresentation = {
  readonly name: string;
  readonly content: string | null;
  readonly unitLabel: string | null;
};

/** Las presentaciones del catalogo listas para `toDistributionLines`, con la etiqueta de su unidad
 *  ya resuelta (`unitLabels` por id de unidad; una unidad que no volvio deja `null`). */
export function toDistributionPresentations(
  presentations: readonly PresentationRef[],
  unitLabels: ReadonlyMap<string, string>,
): ReadonlyMap<string, DistributionPresentation> {
  return new Map(
    presentations.map((presentation) => [
      presentation.id,
      { name: presentation.name, content: presentation.content, unitLabel: unitLabels.get(presentation.unitId) ?? null },
    ]),
  );
}

/** Los ids unicos de las presentaciones de todas las lineas, para resolverlos en una sola llamada. */
export function distributionPresentationIds(
  orders: readonly { readonly presentationLines: readonly AssignedOrderPresentationLine[] }[],
): string[] {
  return [
    ...new Set(orders.flatMap((order) => order.presentationLines.map((line) => line.presentationId))),
  ];
}

/** Conserva el orden en que llegan las lineas: el de alta, que es el que fija `pedidos`. */
export function toDistributionLines(
  lines: readonly AssignedOrderPresentationLine[],
  presentations: ReadonlyMap<string, DistributionPresentation>,
): readonly OrderDistributionLineView[] {
  return lines.map((line) => {
    const presentation = presentations.get(line.presentationId);
    return {
      lineId: line.id,
      presentationId: line.presentationId,
      presentationName: presentation?.name ?? null,
      packages: line.packages,
      packedPackages: line.packedPackages,
      packagingName: line.packagingName,
      // Mismo criterio que Terminar el empaque: la copia de la linea manda sobre la vigente.
      presentationContent: line.presentationContent ?? presentation?.content ?? null,
      presentationUnitLabel: presentation?.unitLabel ?? null,
      packagingImageUrl: line.packagingImageUrl,
    };
  });
}

/** El simbolo de la unidad, o su nombre si no lo tiene. Mismo criterio que la ficha de pedidos,
 *  que no lo publica en su contrato. */
export function unitLabelOf(unit: Pick<UnitRef, 'name' | 'symbol'>): string {
  return unit.symbol ?? unit.name;
}
