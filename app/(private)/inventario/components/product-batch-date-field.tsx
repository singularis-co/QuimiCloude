'use client';

import type { ReactNode } from 'react';
import type { Matcher } from 'react-day-picker';

import { DatePicker } from '@/components/shared/date-picker';
import { parseDateLocalISO } from '@/lib/shared/ui/date-civil';

import { ProductFieldHelper } from './product-field';

/** Campo del formulario de producto que alimenta este componente, via su `input` espejo. */
export const PURCHASE_DATE_FIELD = 'purchaseDate';
/** Fecha de expiracion del lote: opcional y estrictamente posterior a hoy (desde manana). */
export const EXPIRY_DATE_FIELD = 'expiryDate';

export type ProductBatchDateFieldName = typeof PURCHASE_DATE_FIELD | typeof EXPIRY_DATE_FIELD;

const PURCHASE_LABEL = 'Fecha de compra';
const EMPTY_PLACEHOLDER = 'Sin fecha';

/** "Hoy" a medianoche local, sin arrastrar la hora. */
function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Lo que distingue a cada fecha del lote. La de compra siempre lleva valor ("hoy" por defecto) y
 * no admite dias futuros; la de expiracion puede quedar vacia y no admite ni hoy ni dias pasados.
 */
const FIELD_RULES: Record<
  ProductBatchDateFieldName,
  {
    readonly optional: boolean;
    readonly valueTestId: string;
    readonly disabled: (hoy: Date) => Matcher;
  }
> = {
  [PURCHASE_DATE_FIELD]: {
    optional: false,
    valueTestId: 'product-batch-date-value',
    disabled: (hoy) => ({ after: hoy }),
  },
  [EXPIRY_DATE_FIELD]: {
    optional: true,
    valueTestId: 'product-value-expiryDate',
    disabled: (hoy) => ({
      before: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1),
    }),
  },
};

type ProductBatchDateFieldProps = {
  /** Que fecha del lote pinta. Por defecto, la de compra. */
  readonly name?: ProductBatchDateFieldName;
  /** Etiqueta visible. Por defecto, la de la fecha de compra. */
  readonly label?: string;
  /** Si viene, la etiqueta gana el mismo boton de ayuda que el resto de campos del panel. */
  readonly helper?: ReactNode;
  /** Texto del disparador vacio (solo la fecha opcional puede estarlo). */
  readonly placeholder?: ReactNode;
  /** Fecha ya elegida, en `YYYY-MM-DD`. Ausente o vacia = "hoy" (compra) o sin fecha (expiracion). */
  readonly initialValue?: string;
  readonly error?: string;
};

/**
 * Fecha del primer lote en el alta de producto: la de compra o la de expiracion, con el MISMO
 * selector de calendario. El dia elegido vive en estado desde el primer render y sobrevive a un
 * reenvio fallido sin remontar nada: `initialValue` solo cuenta si el panel se remonta desde cero.
 */
export function ProductBatchDateField({
  name = PURCHASE_DATE_FIELD,
  label = PURCHASE_LABEL,
  helper,
  placeholder = EMPTY_PLACEHOLDER,
  initialValue,
  error,
}: ProductBatchDateFieldProps) {
  const hoy = today();
  const rules = FIELD_RULES[name];
  const empty = initialValue === undefined || initialValue === '';

  return (
    <DatePicker
      mode="single"
      name={name}
      label={label}
      labelAdornment={
        helper === undefined ? undefined : (
          <ProductFieldHelper name={name} label={label} helper={helper} />
        )
      }
      defaultValue={empty ? (rules.optional ? undefined : hoy) : parseDateLocalISO(initialValue)}
      optional={rules.optional}
      placeholder={placeholder}
      disabled={rules.disabled(hoy)}
      triggerTestId={`product-field-${name}`}
      valueTestId={rules.valueTestId}
      error={error}
      errorTestId={`product-error-${name}`}
      errorAlert={false}
    />
  );
}
