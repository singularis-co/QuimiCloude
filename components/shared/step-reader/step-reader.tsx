'use client';

import { TriangleAlertIcon } from 'lucide-react';
import { type ReactNode, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { CountdownRing } from '@/components/shared/countdown-ring';
import { CountdownTimer } from '@/components/shared/countdown-timer';
import { Button } from '@/components/ui/button';
import type { RecipeStepDocument } from '@/lib/modules/recetas';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

import { StepDocumentView } from './step-document-view';

/**
 * Asistente de lectura de una receta: **un paso por pantalla** (R14-R21, `design.md > 5`).
 *
 * **Recibe TODO por props (R20).** No lee datos por su cuenta, no importa `lib/composition`, ni
 * Server Actions, ni `next/navigation`, ni nada de `app/`: por eso vive en `components/shared/` y
 * por eso QC-63 podra montarlo en la ruta del Operador pasandole otro `onFinish` sin tocar una
 * linea de aqui. Un test de fuente afirma que ninguno de estos archivos menciona lo prohibido.
 *
 * **Estado en memoria y solo en memoria (R19):** el indice del paso actual y un conjunto de
 * items marcados con clave `${paso}:${bloque}:${item}`. Sin `localStorage`, sin `sessionStorage`
 * y sin URL — desmontarlo se lleva el marcado con el.
 *
 * **El bloqueo (R17)** no es solo `disabled`: el motivo va en un parrafo de **texto visible**
 * junto al boton y asociado por `aria-describedby`. Un `title` no vale, porque en tactil no hay
 * `:hover` (R26) y una pantalla que no responde sin decir por que es una pantalla rota. En
 * `mode="ejecucion"` la espera minima es la excepcion: su cuenta va visible dentro del boton
 * primario y su motivo, solo para lectores de pantalla (decision humana, fuera de SDD).
 *
 * Los textos viven en UNA constante para que la i18n futura sea sustituirla.
 *
 * **Enmienda del 2026-09-21, fuera de SDD, por decision humana explicita.** La prop `mode` se
 * anadio sin pasar por requirements/design/tasks. `mode="lectura"` (el valor por defecto)
 * preserva integro el contrato que describen los specs de QC-63, QC-64 y QC-125 — de ahi que la
 * API se llamara antes "cerrada". La variante `mode="ejecucion"` es un rediseno para la pantalla
 * del operario en planta (tablet, guantes, un dedo que ya va en camino al boton) y NO esta
 * cubierta por los requisitos de esas fichas: quien la toque no encontrara un `R<n>` que la
 * ampare. Quien busque trazabilidad completa, que la pida — hoy no existe.
 */

/** En `'ejecucion'` los botones van en talla `xl` y llenan su columna del pie, a partes iguales. */
const PRIMARY_TOUCH_TARGET_EJECUCION = 'w-full min-w-11';

const TEXTS = {
  empty: 'Esta receta no tiene ningún paso que leer.',
  previous: 'Anterior',
  next: 'Siguiente',
  finish: 'Finalizar',
  position: (current: number, total: number) => `Paso ${current} de ${total}`,
  blocked: (pending: number) => `Marca los ${pending} elementos pendientes para continuar.`,
  waitPrefix: 'Espera',
  waitSuffix: 'para continuar.',
  waitReasonEjecucion: 'Espera a que termine la cuenta regresiva para continuar.',
  percent: (value: number) => `${value} %`,
  badgeOf: (total: number) => `de ${total}`,
  checklistTitle: 'Comprueba',
  checklistCount: (done: number, total: number) => `${done} de ${total}`,
} as const;

export type StepReaderProps = {
  readonly steps: readonly RecipeStepDocument[];
  readonly onFinish: () => void;
  readonly title?: string;
  /** Segundos que cada paso exige antes de permitir avanzar. Ausente, cero, negativo o no
   *  finito: sin espera. */
  readonly minStepSeconds?: number;
  /** `'lectura'` (por defecto) es el contrato historico. `'ejecucion'` es la variante de planta:
   *  ver la enmienda del docblock de este archivo. */
  readonly mode?: 'lectura' | 'ejecucion';
  readonly finishLabel?: string;
  /** Mientras la accion de terminar esta en curso: evita enviarla dos veces. */
  readonly finishBusy?: boolean;
  /** Paso de entrada, desde 1. Fuera de rango se recorta al primero o al ultimo. */
  readonly initialStepPosition?: number;
  /** Se llama tras cambiar de paso; no se llama si el paso no cambia. */
  readonly onStepChange?: (change: {
    direction: 'advance' | 'go_back';
    position: number;
  }) => void;
  /** Contenido extra del paso actual (posición desde 1), debajo del documento del paso. */
  readonly renderStepAddon?: (position: number) => ReactNode;
  /** Motivo extra que bloquea el paso actual (posición desde 1); `null` si no bloquea. Se muestra
   *  solo cuando no quedan elementos por marcar. */
  readonly stepBlockReason?: (position: number) => string | null;
  /** Cada `id` nuevo lleva al paso `position` (desde 1), aunque el actual esté bloqueado, y avisa
   *  a `onStepChange` si el paso cambia. El `id` con el que se monta no navega. */
  readonly stepRequest?: { readonly position: number; readonly id: number };
  /** Solo en `'ejecucion'`. Nodos de la pantalla donde se pintan el progreso y los botones, en
   *  lugar del pie fijo propio. Con `slots` el paso usa la presentación de planta: insignia,
   *  porcentaje, contador de comprobaciones, tarjetas y párrafos grandes. Mientras un nodo sea
   *  `null`, esa parte no se pinta. */
  readonly slots?: {
    readonly progress: HTMLElement | null;
    readonly actions: HTMLElement | null;
  };
  /** Solo en `'ejecucion'`. Nota de seguridad del paso actual (posición desde 1); `null` o vacía
   *  no pinta nada. */
  readonly stepNote?: (position: number) => string | null;
};

/**
 * Posicion de entrada, desde 1, recortada a los pasos que hay; `null` si no hay pasos. Exportada
 * para que quien registra la posicion mande la misma que se ve.
 */
export function clampStepPosition(
  position: number | null | undefined,
  stepsCount: number,
): number | null {
  if (stepsCount === 0) return null;
  if (position === null || position === undefined || !Number.isFinite(position)) return 1;
  return Math.min(Math.max(Math.trunc(position), 1), stepsCount);
}

function initialIndexFor(position: number | undefined, total: number): number {
  return (clampStepPosition(position, total) ?? 1) - 1;
}

/** Clave de un item marcado. El paso entra en la clave: marcar en el paso 2 no marca en el 1. */
function itemKey(stepIndex: number, blockIndex: number, itemIndex: number): string {
  return `${stepIndex}:${blockIndex}:${itemIndex}`;
}

/**
 * Items sin marcar del paso ACTUAL (R17). Un paso sin lista de verificacion devuelve 0, que es
 * exactamente lo que pide R18: se avanza sin ninguna accion previa.
 */
function countPendingItems(
  document: RecipeStepDocument,
  stepIndex: number,
  checked: ReadonlySet<string>,
): number {
  return document.blocks.reduce((pending, block, blockIndex) => {
    if (block.kind === 'paragraph') {
      return pending;
    }
    const sinMarcar = block.items.filter(
      (_item, itemIndex) => !checked.has(itemKey(stepIndex, blockIndex, itemIndex)),
    );
    return pending + sinMarcar.length;
  }, 0);
}

function countItems(document: RecipeStepDocument): number {
  return document.blocks.reduce(
    (total, block) => (block.kind === 'paragraph' ? total : total + block.items.length),
    0,
  );
}

/** Progreso segmentado (solo `'ejecucion'`): un tramo por paso, con su estado. */
export function StepProgress({ total, current }: { readonly total: number; readonly current: number }) {
  return (
    <div data-testid="step-reader-progress" role="list" className="flex gap-1">
      {Array.from({ length: total }, (_, stepIndex) => {
        const state = stepIndex < current ? 'done' : stepIndex === current ? 'current' : 'pending';
        return (
          <span
            key={stepIndex}
            role="listitem"
            data-testid={`step-reader-progress-segment-${stepIndex}`}
            data-state={state}
            className={cn(
              'h-1.5 flex-1 rounded-full bg-muted',
              state === 'done' && 'bg-primary',
              state === 'current' && 'bg-primary/50',
            )}
          />
        );
      })}
    </div>
  );
}

export function StepReader({
  steps,
  onFinish,
  title,
  minStepSeconds,
  mode = 'lectura',
  finishLabel = TEXTS.finish,
  finishBusy = false,
  initialStepPosition,
  onStepChange,
  renderStepAddon,
  stepBlockReason,
  stepRequest,
  slots,
  stepNote,
}: StepReaderProps) {
  const isEjecucion = mode === 'ejecucion';
  const isPlanta = isEjecucion && slots !== undefined;
  const baseId = useId();
  const [index, setIndex] = useState(() => initialIndexFor(initialStepPosition, steps.length));
  const [checkedItems, setCheckedItems] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [arrival, setArrival] = useState(0);
  const [waitedArrival, setWaitedArrival] = useState<number | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const skipNextFocus = useRef(true);

  const waitEnabled =
    minStepSeconds !== undefined && Number.isFinite(minStepSeconds) && minStepSeconds > 0;

  const headingId = `${baseId}-title`;
  const reasonId = `${baseId}-reason`;
  const waitReasonId = `${baseId}-wait-reason`;

  // Solo en 'ejecucion': en 'lectura' robar el foco interrumpiria a quien esta editando.
  useEffect(() => {
    if (!isEjecucion) return;
    if (skipNextFocus.current) {
      skipNextFocus.current = false;
      return;
    }
    const heading = headingRef.current;
    heading?.focus();
    if (typeof heading?.scrollIntoView === 'function') {
      heading.scrollIntoView({ block: 'start' });
    }
  }, [arrival, isEjecucion]);

  const requestId = stepRequest?.id;
  const handledRequestId = useRef(requestId);

  const followStepRequest = useEffectEvent(() => {
    if (stepRequest === undefined || steps.length === 0) return;
    const from = Math.min(index, steps.length - 1);
    const target = (clampStepPosition(stepRequest.position, steps.length) ?? 1) - 1;
    if (target === from) return;
    setArrival((previous) => previous + 1);
    setIndex(target);
    onStepChange?.({ direction: target > from ? 'advance' : 'go_back', position: target + 1 });
  });

  useEffect(() => {
    if (requestId === undefined || requestId === handledRequestId.current) return;
    handledRequestId.current = requestId;
    followStepRequest();
  }, [requestId]);

  if (steps.length === 0) {
    // R21: estado vacio explicito y NINGUNA navegacion entre pasos.
    return (
      <section
        data-testid="step-reader"
        aria-labelledby={title === undefined ? undefined : headingId}
        className="flex flex-col gap-4"
      >
        {title !== undefined && (
          <h2 id={headingId} data-testid="step-reader-title" className="text-base font-semibold">
            {title}
          </h2>
        )}
        <p data-testid="step-reader-empty" className="text-base">
          {TEXTS.empty}
        </p>
      </section>
    );
  }

  const currentIndex = Math.min(index, steps.length - 1);
  const current = steps[currentIndex];
  const isLast = currentIndex === steps.length - 1;
  const isFirst = currentIndex === 0;
  const pending = countPendingItems(current, currentIndex, checkedItems);
  const waiting = waitEnabled && waitedArrival !== arrival;
  const extraReason = stepBlockReason?.(currentIndex + 1) ?? null;
  const reasonText = pending > 0 ? TEXTS.blocked(pending) : extraReason;
  const blocked = pending > 0 || extraReason !== null || waiting;
  const reasonIds = [reasonText !== null ? reasonId : undefined, waiting ? waitReasonId : undefined]
    .filter((id): id is string => id !== undefined)
    .join(' ');
  const describedBy = reasonIds === '' ? undefined : reasonIds;

  function toggleItem(blockIndex: number, itemIndex: number, checked: boolean) {
    setCheckedItems((previous) => {
      const next = new Set(previous);
      const key = itemKey(currentIndex, blockIndex, itemIndex);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  function goPrevious() {
    // En el primer paso, Anterior no retrocede. El boton ya va `disabled`; esto cierra
    // tambien la activacion por programa.
    const next = Math.max(0, currentIndex - 1);
    if (next !== currentIndex) {
      setArrival((previous) => previous + 1);
    }
    setIndex(next);
    if (next !== currentIndex) {
      onStepChange?.({ direction: 'go_back', position: next + 1 });
    }
  }

  function goNext() {
    if (blocked) return;
    const next = Math.min(steps.length - 1, currentIndex + 1);
    if (next !== currentIndex) {
      setArrival((previous) => previous + 1);
    }
    setIndex(next);
    if (next !== currentIndex) {
      onStepChange?.({ direction: 'advance', position: next + 1 });
    }
  }

  function finish() {
    if (blocked || finishBusy) return;
    onFinish();
  }

  const totalItems = countItems(current);
  const checklistHeader =
    isPlanta && totalItems > 0 ? (
    <div
      data-testid="step-reader-checklist-header"
      className="flex items-baseline justify-between gap-3"
    >
      <span className="text-sm font-semibold">{TEXTS.checklistTitle}</span>
      <span
        data-testid="step-reader-checklist-count"
        className="font-mono text-sm text-muted-foreground"
      >
        {TEXTS.checklistCount(totalItems - pending, totalItems)}
      </span>
    </div>
    ) : undefined;

  const noteText = isEjecucion ? (stepNote?.(currentIndex + 1) ?? null) : null;
  const stepNoteBlock = noteText !== null && noteText.trim() !== '' && (
    <div
      role="note"
      data-testid="step-reader-note"
      className="flex items-start gap-3 rounded-[14px] bg-muted px-4 py-3.5 text-[15px]"
    >
      <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{noteText}</span>
    </div>
  );

  const documentView = (
    <StepDocumentView
      key={currentIndex}
      document={current}
      idPrefix={`${baseId}-${currentIndex}`}
      isItemChecked={(blockIndex, itemIndex) =>
        checkedItems.has(itemKey(currentIndex, blockIndex, itemIndex))
      }
      onToggleItem={toggleItem}
      variant={isPlanta ? 'ejecucion' : undefined}
      checklistHeader={checklistHeader}
    />
  );

  const stepAddon = renderStepAddon?.(currentIndex + 1);

  const waitTimer = (
    <CountdownTimer
      key={`timer-${arrival}`}
      seconds={minStepSeconds}
      onEnd={() => setWaitedArrival(arrival)}
      className={isEjecucion ? 'text-current' : undefined}
    />
  );

  // En 'lectura' el motivo de espera, con su cuenta, es texto visible en el cuerpo del paso.
  // En 'ejecucion' la cuenta va dentro del boton primario y el motivo queda solo para lectores
  // de pantalla, sin la cuenta: anunciar cada segundo seria ruido.
  const waitReason =
    waiting &&
    (isEjecucion ? (
      <p id={waitReasonId} data-testid="step-reader-wait-reason" className="sr-only">
        {TEXTS.waitReasonEjecucion}
      </p>
    ) : (
      <p id={waitReasonId} data-testid="step-reader-wait-reason" className="text-base">
        {TEXTS.waitPrefix} {waitTimer} {TEXTS.waitSuffix}
      </p>
    ));

  // `aria-hidden`: el nombre accesible del boton se queda en su texto, no cambia con cada tick.
  const buttonCountdown = isEjecucion && waiting && (
    <span
      aria-hidden="true"
      data-testid="step-reader-button-countdown"
      className="inline-flex items-center gap-1.5"
    >
      <CountdownRing
        key={`ring-${arrival}`}
        seconds={minStepSeconds ?? 0}
        testId="step-reader-wait-ring"
        className="size-5 [&_[data-slot=countdown-ring-progress]]:stroke-primary-foreground [&_[data-slot=countdown-ring-track]]:stroke-primary-foreground/30"
      />
      {waitTimer}
    </span>
  );

  const buttonSize = isEjecucion ? 'xl' : 'default';

  const previousButton = (
    <Button
      type="button"
      variant="outline"
      size={buttonSize}
      touch
      className={isEjecucion ? PRIMARY_TOUCH_TARGET_EJECUCION : undefined}
      data-testid="step-reader-previous"
      disabled={isFirst}
      onClick={goPrevious}
    >
      {TEXTS.previous}
    </Button>
  );

  const primaryButton = isLast ? (
    <Button
      type="button"
      size={buttonSize}
      className={isEjecucion ? PRIMARY_TOUCH_TARGET_EJECUCION : touchTarget}
      touch={isEjecucion}
      data-testid="step-reader-finish"
      disabled={blocked || finishBusy}
      aria-busy={finishBusy || undefined}
      aria-describedby={describedBy}
      onClick={finish}
    >
      {finishLabel}
      {buttonCountdown}
    </Button>
  ) : (
    <Button
      type="button"
      size={buttonSize}
      className={isEjecucion ? PRIMARY_TOUCH_TARGET_EJECUCION : touchTarget}
      touch={isEjecucion}
      data-testid="step-reader-next"
      disabled={blocked}
      aria-describedby={describedBy}
      onClick={goNext}
    >
      {TEXTS.next}
      {buttonCountdown}
    </Button>
  );

  const actionsContent = (
    <>
      {/* Reserva su alto aunque no haya motivo: marcar el ultimo item no debe mover el boton. */}
      <div data-testid="step-reader-reason-slot" className="min-h-6">
        <p
          id={reasonId}
          data-testid="step-reader-blocked-reason"
          className={cn('text-center text-base', reasonText === null && 'invisible')}
        >
          {reasonText ?? TEXTS.blocked(pending)}
        </p>
        {waitReason}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {previousButton}
        {primaryButton}
      </div>
    </>
  );

  if (isPlanta) {
    const total = steps.length;
    const percent = Math.round(((currentIndex + 1) / total) * 100);
    return (
      <section data-testid="step-reader" className="flex flex-col gap-5">
        {title !== undefined && (
          <h2 id={headingId} data-testid="step-reader-title" className="text-xl font-bold sm:text-2xl">
            {title}
          </h2>
        )}

        <div
          ref={headingRef}
          tabIndex={-1}
          data-testid="step-reader-heading"
          className="flex outline-none"
        >
          <span
            data-testid="step-reader-badge"
            className="inline-flex items-center gap-2.5 text-sm text-muted-foreground"
          >
            <b className="inline-flex size-8 items-center justify-center rounded-[10px] bg-primary font-mono text-[15px] font-semibold text-primary-foreground">
              {currentIndex + 1}
            </b>
            <span className="font-mono">{TEXTS.badgeOf(total)}</span>
          </span>
        </div>

        {documentView}

        {stepNoteBlock}

        {stepAddon}

        {slots.progress !== null &&
          createPortal(
            <div data-testid="step-reader-progress-slot" className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <p
                  aria-live="polite"
                  data-testid="step-reader-position"
                  className="text-[15px] font-semibold"
                >
                  {TEXTS.position(currentIndex + 1, total)}
                </p>
                <span
                  data-testid="step-reader-percent"
                  className="font-mono text-sm text-muted-foreground"
                >
                  {TEXTS.percent(percent)}
                </span>
              </div>
              <StepProgress total={total} current={currentIndex} />
            </div>,
            slots.progress,
          )}

        {slots.actions !== null &&
          createPortal(
            <div data-testid="step-reader-actions" className="flex w-full flex-col gap-2">
              {actionsContent}
            </div>,
            slots.actions,
          )}
      </section>
    );
  }

  if (isEjecucion) {
    return (
      // El relleno inferior reserva el alto del pie fijo para que el paso no quede debajo.
      <section
        data-testid="step-reader"
        className="flex flex-col gap-4 pb-[calc(140px+env(safe-area-inset-bottom,0px))]"
      >
        <div
          ref={headingRef}
          tabIndex={-1}
          data-testid="step-reader-heading"
          className="flex flex-col gap-1 outline-none"
        >
          <StepProgress total={steps.length} current={currentIndex} />

          {title !== undefined && (
            <h2 id={headingId} data-testid="step-reader-title" className="text-xl font-bold sm:text-2xl">
              {title}
            </h2>
          )}

          {/* R27: el cambio de paso se anuncia a la tecnologia de asistencia. */}
          <p
            aria-live="polite"
            data-testid="step-reader-position"
            className="text-sm font-medium text-muted-foreground"
          >
            {TEXTS.position(currentIndex + 1, steps.length)}
          </p>
        </div>

        {documentView}

        {stepNoteBlock}

        {stepAddon}

        <div
          data-testid="step-reader-actions"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card px-4 pt-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))]"
        >
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2">
            {actionsContent}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section data-testid="step-reader" className="flex flex-col gap-4">
      {title !== undefined && (
        <h2 id={headingId} data-testid="step-reader-title" className="text-base font-semibold">
          {title}
        </h2>
      )}

      {/* R27: el cambio de paso se anuncia a la tecnologia de asistencia. */}
      <p
        aria-live="polite"
        data-testid="step-reader-position"
        className="text-base text-muted-foreground"
      >
        {TEXTS.position(currentIndex + 1, steps.length)}
      </p>

      {/* R14: solo `steps[currentIndex]` esta en el DOM; los demas NO se renderizan. */}
      {documentView}

      {stepAddon}

      {reasonText !== null && (
        <p id={reasonId} data-testid="step-reader-blocked-reason" className="text-base">
          {reasonText}
        </p>
      )}

      {waitReason}

      <div className="flex flex-wrap items-center gap-2">
        {previousButton}
        {primaryButton}
      </div>
    </section>
  );
}
