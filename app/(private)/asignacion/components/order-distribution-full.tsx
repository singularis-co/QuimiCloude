/**
 * El reparto entero de un pedido, todas sus lineas en orden de alta. Sin `'use client'` y sin
 * hooks: lo usan tanto la columna de una tabla de cliente como una pantalla de servidor.
 *
 * El nombre de cada linea sigue el criterio de `OrderDistributionLabel`: el envase con el volumen de su
 * presentacion («Envase 2 · 300 ml») y, si una linea antigua no tiene envase, la presentacion.
 */

import { EntityImage } from '@/components/shared/entity-image';
import { orderDistributionLineText } from '@/components/shared/order-distribution-label';

export type OrderDistributionFullLine = {
  readonly presentationId: string;
  readonly presentationName: string | null;
  readonly packagingName?: string | null;
  readonly packagingImageUrl?: string | null;
  readonly packages: number;
  readonly presentationContent?: string | null;
  readonly presentationUnitLabel?: string | null;
};

export type OrderDistributionFullProps = {
  /** En orden de alta. */
  readonly lines: readonly OrderDistributionFullLine[];
  /** Pinta cada linea con la miniatura de su envase, en un bloque propio en vez de texto en linea. */
  readonly withImages?: boolean;
};

export const ORDER_DISTRIBUTION_FULL_TESTID = 'order-distribution-full';
export const ORDER_DISTRIBUTION_FULL_LINE_TESTID = 'order-distribution-full-line';
export const ORDER_DISTRIBUTION_FULL_SEPARATOR = ' / ';

const EMPTY_TEXT = 'Sin presentación';

export function orderDistributionFullText(lines: readonly OrderDistributionFullLine[]): string {
  if (lines.length === 0) return EMPTY_TEXT;
  return lines.map(orderDistributionLineText).join(ORDER_DISTRIBUTION_FULL_SEPARATOR);
}

export function OrderDistributionFull({ lines, withImages = false }: OrderDistributionFullProps) {
  if (!withImages || lines.length === 0) {
    return (
      <span
        data-testid={ORDER_DISTRIBUTION_FULL_TESTID}
        data-empty={lines.length === 0 ? 'true' : undefined}
      >
        {orderDistributionFullText(lines)}
      </span>
    );
  }

  return (
    <ul data-testid={ORDER_DISTRIBUTION_FULL_TESTID} className="flex flex-wrap gap-4">
      {lines.map((line) => (
        <li
          key={line.presentationId}
          className="flex items-center gap-3"
          data-testid={ORDER_DISTRIBUTION_FULL_LINE_TESTID}
        >
          <EntityImage
            path={line.packagingImageUrl ?? null}
            name={line.packagingName ?? line.presentationName ?? ''}
          />
          <span>{orderDistributionLineText(line)}</span>
        </li>
      ))}
    </ul>
  );
}
