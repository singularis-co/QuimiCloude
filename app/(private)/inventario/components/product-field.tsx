'use client';

import { CircleAlertIcon } from 'lucide-react';
import { useId, type ChangeEventHandler, type ReactNode } from 'react';

import { TextField } from '@/components/shared/text-field';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { touchTarget } from '@/lib/shared/ui/touch-target';

/** 16 px en todos los anchos: el primitivo baja a 14 px en `md`. */
const FIELD_TEXT = 'text-base md:text-base';
/**
 * El fondo es el del `Input` deshabilitado y el texto, el del tipo fijo de este mismo formulario.
 * El anillo de foco se queda: el campo sigue siendo enfocable con teclado.
 */
const PRODUCT_FIELD_READ_ONLY_CLASS =
  'cursor-default bg-input/50 text-muted-foreground dark:bg-input/80';

type ProductFieldProps = {
  /** Nombre del campo en el `FormData`. De el salen tambien los `data-testid`. */
  readonly name: string;
  /** Etiqueta visible. Es tambien la que nombra al disparador de la ayuda. */
  readonly label: string;
  /** Tipo del `<input>`. `number` es el unico que ademas fija `inputMode`, `min` y `step`. */
  readonly type: 'text' | 'number' | 'date';
  readonly required?: boolean;
  /** Campo derivado: se ve y se envia, pero no se escribe. */
  readonly readOnly?: boolean;
  /** Si viene, la etiqueta gana un boton de ayuda que lo muestra en un tooltip. */
  readonly helper?: ReactNode;
  /** Valor inicial del campo sin controlar. No se pasa junto con `value`. */
  readonly defaultValue?: string;
  readonly error?: string;
  /** Solo para `text`: teclado decimal, o numerico para enteros, en movil sin `type="number"`. */
  readonly inputMode?: 'decimal' | 'numeric';
  /** Pasa el campo a controlado, sin `defaultValue` ni remontaje. */
  readonly value?: string;
  readonly onChange?: ChangeEventHandler<HTMLInputElement>;
};

/**
 * Un campo del formulario de producto.
 *
 * `type="number"` no vale para un importe: pasaria por el binario de coma flotante, y el importe
 * viaja como cadena decimal. Quien necesite teclado numerico sin `type="number"` pasa `inputMode`.
 *
 * La ayuda es un `<button type="button">`: el panel entero es un `<form>` y un boton sin tipo lo
 * enviaria.
 */
export function ProductField({
  name,
  label,
  type,
  required,
  readOnly,
  helper,
  defaultValue,
  error,
  inputMode,
  value,
  onChange,
}: ProductFieldProps) {
  const fieldId = useId();
  const inputId = `${fieldId}-${name}`;
  const isNumber = type === 'number';

  return (
    <TextField
      id={inputId}
      name={name}
      label={label}
      type={type}
      inputMode={isNumber ? 'numeric' : inputMode}
      step={isNumber ? 1 : undefined}
      min={isNumber ? 0 : undefined}
      required={required}
      readOnly={readOnly}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange}
      remountOnDefault
      inputClassName={`${touchTarget} ${FIELD_TEXT}${readOnly ? ` ${PRODUCT_FIELD_READ_ONLY_CLASS}` : ''}`}
      labelRowClassName="flex items-center gap-1.5"
      labelAdornment={
        helper === undefined ? undefined : (
          <ProductFieldHelper name={name} label={label} helper={helper} />
        )
      }
      error={error}
      errorTestId={`product-error-${name}`}
      errorAlert={false}
      testId={`product-field-${name}`}
    />
  );
}

/**
 * Boton de ayuda junto a la etiqueta de un campo del formulario de producto. Lo comparten los
 * campos de texto y los de fecha (`ProductBatchDateField`), para que la ayuda se vea y se nombre
 * igual en todo el panel.
 */
export function ProductFieldHelper({
  name,
  label,
  helper,
}: {
  readonly name: string;
  readonly label: string;
  readonly helper: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={`Qué es ${label}`}
            // 44x44 de toque, como el gemelo de `PresentationSelect` en el mismo panel; el
            // icono sigue en `size-4`. `shrink-0` impide que el flex le recorte el ancho.
            className={`flex ${touchTarget} shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring`}
            data-testid={`product-helper-${name}`}
          />
        }
      >
        <CircleAlertIcon className="size-4" />
      </TooltipTrigger>
      <TooltipContent data-testid={`product-helper-text-${name}`}>{helper}</TooltipContent>
    </Tooltip>
  );
}
