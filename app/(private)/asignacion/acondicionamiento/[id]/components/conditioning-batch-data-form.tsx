'use client';

import { startTransition, useActionState, useEffect, useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConditioningBatchForm } from '@/lib/modules/asignaciones';
import {
  saveConditioningBatchDataAction,
  type SaveConditioningBatchDataResult,
} from '@/lib/modules/asignaciones/adapters/driving/order-conditioning-actions';

export const CONDITIONING_BATCH_DATA_SECTION_TESTID = 'conditioning-batch-data';
export const CONDITIONING_BATCH_DATA_FORM_TESTID = 'conditioning-batch-data-form';
export const CONDITIONING_BATCH_DATA_DIVERGENT_TESTID = 'conditioning-batch-data-divergent';
export const CONDITIONING_BATCH_DATA_SUBMIT_TESTID = 'conditioning-batch-data-submit';
export const CONDITIONING_BATCH_DATA_ERROR_TESTID = 'conditioning-batch-data-error';

export const CONDITIONING_BATCH_DATA_FIELDS = {
  orderId: 'orderId',
  lot: 'lot',
  expiryDate: 'expiryDate',
  productionDate: 'productionDate',
} as const;

export const CONDITIONING_BATCH_DATA_TEXTS = {
  title: 'Datos de lote',
  lot: 'Lote',
  expiryDate: 'Vencimiento',
  productionDate: 'Día de producción',
  submit: 'Guardar datos de lote',
  saved: 'Datos de lote guardados.',
  divergentTitle: 'Hoy las líneas tienen lotes distintos.',
  divergentClosing: 'Al guardar, el lote, el vencimiento y el día de producción pasan a todas las líneas.',
  noLot: 'sin lote',
  divergentLine: (label: string, lot: string) => `${label}: ${lot}`,
} as const;

type FieldName = 'lot' | 'expiryDate' | 'productionDate';

type Values = Readonly<Record<FieldName, string>>;

const FIELD_CLASS = 'min-h-11 text-base md:text-base';

const INITIAL_STATE: SaveConditioningBatchDataResult = { status: 'idle' };

const CULPRIT_BY_CODE: Readonly<Partial<Record<string, FieldName>>> = {
  batch_duplicate_lot: 'lot',
  batch_expiry_not_future: 'expiryDate',
  batch_production_date_future: 'productionDate',
};

function initialValues(form: ConditioningBatchForm): Values {
  if (form.kind === 'shared') {
    return { lot: form.lot, expiryDate: form.expiryDate, productionDate: form.productionDate };
  }
  return { lot: '', expiryDate: '', productionDate: '' };
}

export type ConditioningBatchDataFormProps = {
  readonly orderId: string;
  readonly form: ConditioningBatchForm;
  /** Cada línea ya escrita como en el reparto, por `presentationId`; la compone la pantalla de servidor. */
  readonly divergentLabels: Readonly<Record<string, string>>;
};

export function ConditioningBatchDataForm({ orderId, form, divergentLabels }: ConditioningBatchDataFormProps) {
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const errorId = `${baseId}-error`;
  const [values, setValues] = useState<Values>(() => initialValues(form));
  const [state, formAction, isPending] = useActionState(saveConditioningBatchDataAction, INITIAL_STATE);

  // Cada envío devuelve un estado nuevo: un toast por guardado, sobre el `<Toaster/>` del layout privado.
  useEffect(() => {
    if (state.status !== 'success') return;
    toast.success(CONDITIONING_BATCH_DATA_TEXTS.saved);
  }, [state]);

  const error = state.status === 'error' ? state : undefined;
  const culprit = error === undefined ? undefined : CULPRIT_BY_CODE[error.code];
  const disabled = form.kind === 'no_batches';

  // Sin el reinicio automático de `<form action>`: tras un rechazo, lo escrito se queda.
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  }

  function field(name: FieldName, type: 'text' | 'date') {
    const id = `${baseId}-${name}`;
    const invalid = culprit === name;
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="text-base">
          {CONDITIONING_BATCH_DATA_TEXTS[name]}
        </Label>
        <Input
          id={id}
          type={type}
          name={CONDITIONING_BATCH_DATA_FIELDS[name]}
          value={values[name]}
          onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
          required
          disabled={disabled}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? errorId : undefined}
          className={FIELD_CLASS}
        />
      </div>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3"
      data-testid={CONDITIONING_BATCH_DATA_SECTION_TESTID}
    >
      <h2 id={headingId} className="text-base font-medium">
        {CONDITIONING_BATCH_DATA_TEXTS.title}
      </h2>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        data-testid={CONDITIONING_BATCH_DATA_FORM_TESTID}
      >
        <input type="hidden" name={CONDITIONING_BATCH_DATA_FIELDS.orderId} value={orderId} />

        {form.kind === 'divergent' ? (
          <Notice
            tone="warning"
            title={CONDITIONING_BATCH_DATA_TEXTS.divergentTitle}
            testId={CONDITIONING_BATCH_DATA_DIVERGENT_TESTID}
          >
            <ul className="list-disc pl-5">
              {form.lines.map((line) => (
                <li key={line.presentationId}>
                  {CONDITIONING_BATCH_DATA_TEXTS.divergentLine(
                    divergentLabels[line.presentationId] ?? '',
                    line.lot ?? CONDITIONING_BATCH_DATA_TEXTS.noLot,
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1">{CONDITIONING_BATCH_DATA_TEXTS.divergentClosing}</p>
          </Notice>
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {field('lot', 'text')}
          {field('expiryDate', 'date')}
          {field('productionDate', 'date')}
        </div>

        {error === undefined ? null : (
          <ErrorAlert
            error={error}
            id={errorId}
            className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
            testId={CONDITIONING_BATCH_DATA_ERROR_TESTID}
            withDataCode
          />
        )}

        <Button
          type="submit"
          touch
          className="w-fit"
          disabled={disabled || isPending}
          aria-busy={isPending}
          data-testid={CONDITIONING_BATCH_DATA_SUBMIT_TESTID}
        >
          {CONDITIONING_BATCH_DATA_TEXTS.submit}
        </Button>
      </form>
    </section>
  );
}
