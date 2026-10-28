'use client';

import { useState, type ChangeEvent } from 'react';

import { multiplyCost, sanitizeCostInput } from './product-cost-amount';
import { ProductField } from './product-field';

type ProductCostFieldsProps = {
  /** Vienen del formulario para que el copy siga teniendo un solo sitio. */
  readonly unitCostLabel: string;
  readonly totalCostLabel: string;
  /**
   * Se lee solo al montar, y basta: el panel se crea de cero en cada apertura, y tras un rechazo
   * —que no lo desmonta— el estado de aqui ya guarda lo que se envio.
   */
  readonly initialUnitCost: string;
  /** La existencia del lote tal como esta en el formulario: de ella sale el total. */
  readonly quantity: string;
  readonly unitCostError?: string;
  /** Avisa del costo unitario que viajará, el escrito. */
  readonly onUnitCostChange?: (unitCost: string) => void;
};

/**
 * Los dos importes del primer lote. El unitario es la UNICA entrada; el total es de solo lectura
 * y se calcula siempre como unitario x existencia, asi que cambiar la existencia tambien lo
 * recalcula.
 *
 * El total es `readOnly` y no `disabled`: se sigue viendo, enfocando y enviando. El servidor hace
 * prevalecer el unitario sobre el total, de modo que el total enviado nunca decide nada.
 *
 * Sin unitario, o sin existencia utilizable, el total queda en blanco: un importe obsoleto engana
 * mas que uno vacio.
 */
export function ProductCostFields({
  unitCostLabel,
  totalCostLabel,
  initialUnitCost,
  quantity,
  unitCostError,
  onUnitCostChange,
}: ProductCostFieldsProps) {
  const [unitCost, setUnitCostState] = useState(initialUnitCost);
  const totalCost = unitCost === '' ? '' : (multiplyCost(unitCost, quantity.trim()) ?? '');

  function setUnitCost(next: string) {
    setUnitCostState(next);
    onUnitCostChange?.(next);
  }

  function handleUnitCostChange(event: ChangeEvent<HTMLInputElement>) {
    setUnitCost(sanitizeCostInput(event.currentTarget.value));
  }

  return (
    <>
      <ProductField
        name="unitCost"
        label={unitCostLabel}
        type="text"
        inputMode="decimal"
        helper="Lo que cuesta UNA unidad de este lote. El costo total se calcula solo con la existencia."
        value={unitCost}
        onChange={handleUnitCostChange}
        error={unitCostError}
      />

      <ProductField
        name="totalCost"
        label={totalCostLabel}
        type="text"
        inputMode="decimal"
        readOnly
        helper="Lo que cuesta el lote COMPLETO: costo unitario por existencia. Se calcula solo; no se escribe."
        value={totalCost}
      />
    </>
  );
}
