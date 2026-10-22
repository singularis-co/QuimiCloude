/**
 * Resumen compartido del reparto de un pedido: todas sus lineas, separadas por coma.
 *
 * **Vive en `components/shared/` porque la usan DOS rutas** (`/pedidos` y `/asignacion`) con la
 * misma API, que es la condicion de `docs/architecture.md > Regla: sin sobre-ingenieria`.
 *
 * «Sin presentación» no reutiliza el `MissingValue` de esas rutas: un reparto vacio es un dato del
 * pedido, no un fallo de carga. El nombre `null` de una linea si es un fallo de carga y lleva «—».
 *
 * Con varias lineas el texto crece: la etiqueta salta de linea dentro de un ancho maximo propio,
 * como la columna Receta, en vez de ensanchar la celda de la tabla (que es `whitespace-nowrap`).
 * No se fija un `width` en la columna: solo Receta lo declara (P2 de QC-55).
 */

import { trimDecimal } from '@/lib/shared/ui/decimal-display';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

export type OrderDistributionLabelLine = {
  readonly presentationName: string | null;
  /** `null` en una linea antigua, que se pinta con el nombre de su presentacion. */
  readonly packagingName?: string | null;
  readonly packages: number;
  /** Contenido de la presentacion en texto decimal («300.0000»). Sin el, no se pinta el volumen. */
  readonly presentationContent?: string | null;
  /** Simbolo (o nombre) de la unidad de la presentacion («ml»). Sin el, no se pinta el volumen. */
  readonly presentationUnitLabel?: string | null;
};

export type OrderDistributionLabelProps = {
  /** En orden de alta: se pintan todas, en ese orden, separadas por coma. */
  readonly lines: readonly OrderDistributionLabelLine[];
};

const EMPTY_TEXT = 'Sin presentación';
const LINE_SEPARATOR = ', ';
const VOLUME_SEPARATOR = ' · ';

/** «300 ml» con el contenido sin ceros de relleno; `null` si falta el contenido o la unidad. */
function volumeText(line: OrderDistributionLabelLine): string | null {
  const { presentationContent, presentationUnitLabel } = line;
  if (presentationContent == null || presentationUnitLabel == null) return null;
  return `${trimDecimal(presentationContent)} ${presentationUnitLabel}`;
}

/**
 * Una linea con envase se nombra por el envase y, si se conoce, el volumen de su presentacion
 * («9 × Envase 2 · 300 ml»); sin volumen, solo por el envase. Una linea antigua, sin envase, por
 * el nombre de su presentacion; sin ninguno de los dos, con el marcador de ausencia.
 */
export function orderDistributionLineText(line: OrderDistributionLabelLine): string {
  const { packagingName, presentationName } = line;
  if (packagingName == null) return `${line.packages} × ${presentationName ?? EMPTY_MARK}`;
  const volume = volumeText(line);
  const name = volume === null ? packagingName : `${packagingName}${VOLUME_SEPARATOR}${volume}`;
  return `${line.packages} × ${name}`;
}

export function OrderDistributionLabel({ lines }: OrderDistributionLabelProps) {
  if (lines.length === 0) {
    return (
      <span data-testid="order-distribution" data-empty="true">
        {EMPTY_TEXT}
      </span>
    );
  }

  const text = lines.map(orderDistributionLineText).join(LINE_SEPARATOR);

  return (
    <span
      data-testid="order-distribution"
      title={text}
      className="inline-block max-w-xs align-middle break-words whitespace-normal"
    >
      {text}
    </span>
  );
}
