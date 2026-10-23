'use client';

import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react';
import { useId, useState } from 'react';

import { ErrorAlert } from '@/components/shared/error-alert';
import { SHARED_SELECT_TRIGGER_CLASS, SharedSelectControl } from '@/components/shared/shared-select';
import { Spinner } from '@/components/shared/spinner';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ErrorState } from '@/lib/modules/errores';
import type { AiModelOption } from '@/lib/modules/integraciones';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

export const AI_MODEL_SELECT_TRIGGER_TESTID = 'ai-model-select-trigger';
export const AI_MODEL_SELECT_OPTION_TESTID = 'ai-model-select-option';
export const AI_MODEL_SELECT_HELP_TESTID = 'ai-model-select-help';
export const AI_MODEL_SELECT_ERROR_TESTID = 'ai-model-select-error';
export const AI_MODEL_SELECT_SHEET_TESTID = 'ai-model-select-sheet';

export const AI_MODEL_SELECT_TEXTS = {
  label: (provider: string) => `Modelo de ${provider}`,
  recommendedBadge: 'Recomendado',
  unavailableBadge: 'No disponible',
  recommendedMark: 'recomendado',
  helpRecommended: (provider: string) => `Se usa el modelo recomendado de ${provider}.`,
  helpChosen: 'Elegido por tu empresa.',
  helpUnavailable: 'Este modelo ya no está disponible. Elige otro para volver a leer PDF.',
  close: 'Cerrar',
} as const;

/** La hoja de teléfono se usa a 640 px o menos, como en `CountrySelect`. */
const SHEET_BREAKPOINT = 641;

const CHEVRON_ROTATION =
  '[&>svg:last-child]:transition-[rotate] [&>svg:last-child]:duration-(--dur-base) data-popup-open:[&>svg:last-child]:rotate-180 motion-reduce:[&>svg:last-child]:transition-none';

const DESKTOP_TRIGGER_CLASS = cn(SHARED_SELECT_TRIGGER_CLASS, 'h-auto gap-2 px-3', CHEVRON_ROTATION);

const PHONE_TRIGGER_CLASS = cn(
  'group/trigger flex h-12 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-left text-base transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
  'dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
  touchTarget,
);

const PHONE_CHEVRON_CLASS =
  'size-4 shrink-0 text-muted-foreground transition-[rotate] duration-(--dur-base) group-aria-expanded/trigger:rotate-180 motion-reduce:transition-none';

const DESKTOP_OPTION_CLASS = 'min-h-11 px-2.5 text-base md:text-base';

const PHONE_OPTION_CLASS =
  'flex min-h-12 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-base transition-colors duration-100 outline-none focus-visible:bg-accent focus-visible:text-accent-foreground active:bg-accent aria-selected:bg-accent aria-selected:text-accent-foreground motion-reduce:transition-none';

export type AiModelSelectProps = {
  readonly providerName: string;
  /** En el orden del catálogo y sin el modelo marcado como no disponible. */
  readonly options: readonly AiModelOption[];
  /** Modelo en uso. */
  readonly value: string;
  /** Sin elección de la empresa: el valor es el recomendado del proveedor. */
  readonly isDefault: boolean;
  readonly unavailable: boolean;
  /** Mientras se consulta el modelo elegido: no se puede volver a elegir. */
  readonly pending: boolean;
  readonly onChange: (modelId: string) => void;
  readonly error?: ErrorState;
};

function OptionContent({ option }: { readonly option: AiModelOption }) {
  return (
    // El texto de la opción del primitivo es flex sin alinear: sin este envoltorio la marca
    // queda pegada arriba en vez de centrada con el id.
    <span className="flex items-center gap-2">
      <span className="font-mono break-all">{option.modelId}</span>
      {option.isDefault ? (
        <span className="text-xs text-muted-foreground">{AI_MODEL_SELECT_TEXTS.recommendedMark}</span>
      ) : null}
    </span>
  );
}

export function AiModelSelect({
  providerName,
  options,
  value,
  isDefault,
  unavailable,
  pending,
  onChange,
  error,
}: AiModelSelectProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const helpId = `${baseId}-help`;
  const errorId = `${baseId}-error`;
  const listId = `${baseId}-list`;
  const isMobile = useIsMobile(SHEET_BREAKPOINT);
  const [sheetOpen, setSheetOpen] = useState(false);

  const label = AI_MODEL_SELECT_TEXTS.label(providerName);
  const help = unavailable
    ? AI_MODEL_SELECT_TEXTS.helpUnavailable
    : isDefault
      ? AI_MODEL_SELECT_TEXTS.helpRecommended(providerName)
      : AI_MODEL_SELECT_TEXTS.helpChosen;
  const describedBy = error === undefined ? helpId : `${helpId} ${errorId}`;

  function choose(modelId: string) {
    if (pending || modelId === value) return;
    onChange(modelId);
  }

  const triggerContent = (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      {pending ? <Spinner size="sm" /> : null}
      <span className={cn('font-mono break-all', unavailable && 'line-through')}>{value}</span>
      {unavailable ? (
        <StatusBadge tone="danger" label={AI_MODEL_SELECT_TEXTS.unavailableBadge} />
      ) : isDefault ? (
        <StatusBadge tone="neutral" label={AI_MODEL_SELECT_TEXTS.recommendedBadge} />
      ) : null}
    </span>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-[13px] font-medium">
        {label}
      </span>

      {isMobile ? (
        <>
          <button
            type="button"
            role="combobox"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            aria-controls={listId}
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            aria-invalid={unavailable || undefined}
            aria-busy={pending || undefined}
            disabled={pending}
            onClick={() => setSheetOpen(true)}
            className={PHONE_TRIGGER_CLASS}
            data-testid={AI_MODEL_SELECT_TRIGGER_TESTID}
          >
            {triggerContent}
            <ChevronDownIcon aria-hidden className={PHONE_CHEVRON_CLASS} />
          </button>
          <Sheet
            open={sheetOpen && !pending}
            onOpenChange={setSheetOpen}
            disableEscapeDismissal={false}
            disablePointerDismissal={false}
          >
            <SheetContent
              side="bottom"
              showCloseButton={false}
              data-testid={AI_MODEL_SELECT_SHEET_TESTID}
              className={cn(
                'max-h-[85dvh] gap-2 rounded-t-2xl px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]',
                'duration-[250ms] data-[side=bottom]:data-starting-style:translate-y-full data-[side=bottom]:data-ending-style:translate-y-full motion-reduce:transition-none',
              )}
            >
              <span aria-hidden className="h-1 w-10 shrink-0 self-center rounded-full bg-border" />
              <div className="flex items-center justify-between">
                <SheetTitle>{label}</SheetTitle>
                <SheetClose
                  render={<Button variant="ghost" size="icon" touch aria-label={AI_MODEL_SELECT_TEXTS.close} />}
                >
                  <XIcon aria-hidden />
                </SheetClose>
              </div>
              <div id={listId} role="listbox" aria-label={label} className="flex min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain">
                {options.map((option) => {
                  const selected = option.modelId === value;
                  return (
                    <button
                      key={option.modelId}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={PHONE_OPTION_CLASS}
                      data-testid={AI_MODEL_SELECT_OPTION_TESTID}
                      data-value={option.modelId}
                      onClick={() => {
                        setSheetOpen(false);
                        choose(option.modelId);
                      }}
                    >
                      <span className="flex flex-1 flex-wrap items-center gap-2">
                        <OptionContent option={option} />
                      </span>
                      <CheckIcon
                        aria-hidden
                        className={cn('size-4 shrink-0 text-primary', selected ? 'opacity-100' : 'opacity-0')}
                      />
                    </button>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <SharedSelectControl
          name="modelId"
          options={options.map((option) => ({ value: option.modelId, label: option.modelId }))}
          value={value}
          onValueChange={(next) => {
            if (next !== null) choose(next);
          }}
          labelledBy={labelId}
          describedBy={describedBy}
          invalid={unavailable}
          disabled={pending}
          busy={pending}
          alignItemWithTrigger={false}
          triggerClassName={DESKTOP_TRIGGER_CLASS}
          triggerTestId={AI_MODEL_SELECT_TRIGGER_TESTID}
          optionTestId={AI_MODEL_SELECT_OPTION_TESTID}
          optionValueAttribute
          optionClassName={DESKTOP_OPTION_CLASS}
          renderOption={(option) => {
            const model = options.find((entry) => entry.modelId === option.value);
            return model === undefined ? option.label : <OptionContent option={model} />;
          }}
        >
          {triggerContent}
        </SharedSelectControl>
      )}

      <span
        id={helpId}
        className={cn('text-xs', unavailable ? 'text-destructive' : 'text-muted-foreground')}
        data-testid={AI_MODEL_SELECT_HELP_TESTID}
      >
        {help}
      </span>

      {error === undefined ? null : (
        <ErrorAlert
          error={error}
          id={errorId}
          cataloguedAs="p"
          className="text-sm break-words text-destructive animate-in fade-in duration-150"
          testId={AI_MODEL_SELECT_ERROR_TESTID}
          withDataCode
        />
      )}
    </div>
  );
}
