'use client';

import { useState } from 'react';

import { NotConvertibleNotice } from '@/components/shared/unit-conversion-marks';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ExecutionLineView } from '@/lib/modules/asignaciones';
import { formatPercentage } from '@/lib/modules/recetas';
import { convertQuantity, type UnitRef } from '@/lib/modules/unidades';
import { exactDecimalTitle, formatDecimalDisplay } from '@/lib/shared/ui/decimal-display';
import { touchTarget } from '@/lib/shared/ui/touch-target';

/**
 * Las lineas de la receta, en modo lectura, con selector de unidad de visualizacion.
 * La conversion la hace `convertQuantity` del contrato publico de `unidades`; este
 * archivo no repite esa aritmetica, y no captura `IncompatibleUnitsError`: si algun dia una
 * unidad ofrecida no compartiera base efectiva, el fallo tiene que verse, no un guion.
 *
 * El cambio de unidad es estado en memoria: no viaja a ningun sitio. Sin `selectedUnitIds`, cada
 * fila lo guarda y remontar la lista lo devuelve a la unidad original. Con `selectedUnitIds`, lo
 * guarda quien pinta la lista, para que dos copias de la misma lista muestren la misma unidad.
 * Con `unit === null` no hay unidad resoluble: la fila no ofrece selector ni simbolo.
 */

export const ORDER_EXECUTION_LINES_TESTID = 'order-execution-lines';
export const ORDER_EXECUTION_LINE_TESTID = 'order-execution-line';
export const ORDER_EXECUTION_LINE_NAME_TESTID = 'order-execution-line-name';
export const ORDER_EXECUTION_LINE_PERCENTAGE_TESTID = 'order-execution-line-percentage';
export const ORDER_EXECUTION_LINE_QUANTITY_TESTID = 'order-execution-line-quantity';
export const ORDER_EXECUTION_LINE_UNIT_SELECT_TESTID = 'order-execution-line-unit-select';
export const ORDER_EXECUTION_LINE_UNIT_OPTION_TESTID = 'order-execution-line-unit-option';
export const ORDER_EXECUTION_LINE_UNIT_TESTID = 'order-execution-line-unit';
export const ORDER_EXECUTION_LINE_NOT_CONVERTIBLE_TESTID = 'order-execution-line-not-convertible';
export const PRODUCT_NAME_FALLBACK = 'Producto no disponible';

const FIELD_TEXT = 'text-base';

function unitLabel(unit: UnitRef): string {
  return unit.symbol ?? unit.name;
}

type OrderExecutionLineRowProps = {
  readonly line: ExecutionLineView;
  readonly index: number;
  readonly controlledUnitId?: string | undefined;
  readonly onSelectUnit?: ((index: number, unitId: string) => void) | undefined;
  readonly controlled: boolean;
};

function OrderExecutionLineRow({
  line,
  index,
  controlledUnitId,
  onSelectUnit,
  controlled,
}: OrderExecutionLineRowProps) {
  const [ownUnitId, setOwnUnitId] = useState(line.unit?.id ?? null);
  const selectedUnitId = controlled ? (controlledUnitId ?? line.unit?.id ?? null) : ownUnitId;

  const availableUnits = line.unit === null ? [] : [line.unit, ...line.alternativeUnits];
  const selectedUnit = availableUnits.find((unit) => unit.id === selectedUnitId) ?? line.unit;
  const displayedQuantity =
    line.quantity === null || line.unit === null || selectedUnit === null || selectedUnit.id === line.unit.id
      ? line.quantity
      : convertQuantity(line.quantity, line.unit, selectedUnit);

  const rowTestId = `${ORDER_EXECUTION_LINE_TESTID}-${index}`;
  const productLabel = line.productName ?? PRODUCT_NAME_FALLBACK;

  return (
    <li data-testid={rowTestId} className="flex flex-wrap items-center gap-3 py-2">
      {/* Base de 12 rem: el nombre manda y, si no cabe con las cifras, las cifras bajan enteras
          a la linea siguiente. */}
      <span
        data-testid={`${ORDER_EXECUTION_LINE_NAME_TESTID}-${index}`}
        className="min-w-0 flex-[1_1_12rem] break-words text-base"
      >
        {productLabel}
      </span>
      {/* Crece para ocupar el resto de la fila (o la fila entera cuando baja de linea): la unidad,
          con `ml-auto`, queda siempre en el extremo derecho, opuesta al nombre. */}
      <span className="flex min-w-0 flex-[1_1_auto] flex-wrap items-center gap-3">
        <span aria-hidden="true" className="text-base text-muted-foreground">
          {' · '}
        </span>
        <span
          data-testid={`${ORDER_EXECUTION_LINE_PERCENTAGE_TESTID}-${index}`}
          className="text-base"
        >
          {formatPercentage(line.percentage)} %
        </span>
        <span aria-hidden="true" className="text-base text-muted-foreground">
          {' · '}
        </span>
        {line.need === 'not_convertible' ? (
          <NotConvertibleNotice
            testId={`${ORDER_EXECUTION_LINE_NOT_CONVERTIBLE_TESTID}-${index}`}
            className="text-base"
          />
        ) : (
          <span
            data-testid={`${ORDER_EXECUTION_LINE_QUANTITY_TESTID}-${index}`}
            className="text-base font-medium"
            title={displayedQuantity === null ? undefined : exactDecimalTitle(displayedQuantity)}
          >
            {displayedQuantity === null ? null : formatDecimalDisplay(displayedQuantity)}
          </span>
        )}
        {line.unit === null || line.need === 'not_convertible' ? null : line.alternativeUnits.length > 0 ? (
          <Select
            value={selectedUnitId ?? line.unit.id}
            onValueChange={(next) => {
              if (next === null) return;
              if (!controlled) setOwnUnitId(next);
              onSelectUnit?.(index, next);
            }}
            items={availableUnits.map((unit) => ({ label: unitLabel(unit), value: unit.id }))}
          >
            <SelectTrigger
              aria-label={`Unidad de ${productLabel}`}
              className={`ml-auto ${touchTarget} ${FIELD_TEXT}`}
              data-testid={`${ORDER_EXECUTION_LINE_UNIT_SELECT_TESTID}-${index}`}
            >
              <SelectValue data-testid={`${ORDER_EXECUTION_LINE_UNIT_TESTID}-${index}`} />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.map((unit) => (
                <SelectItem
                  key={unit.id}
                  value={unit.id}
                  data-testid={ORDER_EXECUTION_LINE_UNIT_OPTION_TESTID}
                >
                  {unitLabel(unit)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span
            data-testid={`${ORDER_EXECUTION_LINE_UNIT_TESTID}-${index}`}
            className="ml-auto text-base text-muted-foreground"
          >
            {' '}
            {unitLabel(line.unit)}
          </span>
        )}
      </span>
    </li>
  );
}

export type OrderExecutionLinesProps = {
  readonly lines: readonly ExecutionLineView[];
  /** Unidad elegida por indice de linea; si se pasa, la lista es controlada. */
  readonly selectedUnitIds?: ReadonlyMap<number, string>;
  readonly onSelectUnit?: (index: number, unitId: string) => void;
};

export function OrderExecutionLines({ lines, selectedUnitIds, onSelectUnit }: OrderExecutionLinesProps) {
  return (
    <ul data-testid={ORDER_EXECUTION_LINES_TESTID} className="flex flex-col divide-y">
      {lines.map((line, index) => (
        <OrderExecutionLineRow
          key={`${line.unit?.id ?? 'sin-unidad'}-${index}`}
          line={line}
          index={index}
          controlled={selectedUnitIds !== undefined}
          controlledUnitId={selectedUnitIds?.get(index)}
          onSelectUnit={onSelectUnit}
        />
      ))}
    </ul>
  );
}
