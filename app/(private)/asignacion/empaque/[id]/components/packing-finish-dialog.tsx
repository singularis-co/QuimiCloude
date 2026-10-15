'use client';

import { CircleCheckIcon, MinusIcon, PackageIcon, PlusIcon, XIcon } from 'lucide-react';
import { useId, useState, type ReactNode, type TransitionEvent } from 'react';

import { FieldError } from '@/components/shared/field-error';
import { SharedSelectControl } from '@/components/shared/shared-select';
import { StatusBadge } from '@/components/shared/status-badge';
import { STEP_EVIDENCE_TEXTS } from '@/components/shared/step-evidence';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PackingOrderDetail } from '@/lib/modules/asignaciones';
import {
  PACKING_DIFFERENCE_REASONS,
  PACKING_INCREASE_REASONS,
  PACKING_REASON_OTHER_MAX,
  checkPackingCounts,
  maxPackagesForLine,
  packedTotalInOrderUnit,
  type PackedLineCount,
  type PackingDifferenceReason,
} from '@/lib/modules/pedidos';
import { formatDecimalDisplay } from '@/lib/shared/ui/decimal-display';
import { cn } from '@/lib/utils';

type PackingFinishView = NonNullable<PackingOrderDetail['finish']>;
type PackingFinishLine = PackingFinishView['lines'][number];

export const PACKING_FINISH_DIALOG_TEXTS = {
  title: '¿Terminar el empaque?',
  descriptionLead:
    'Cuenta los envases que salieron de verdad. Ya vienen con el plan: cambia solo los que no coinciden.',
  descriptionEnd: 'Terminar el empaque no se puede deshacer.',
  quantity: 'Cantidad',
  close: 'Cerrar',
  planPrefix: 'Plan:',
  planSuffix: 'envases',
  countLabel: (name: string) => `Envases reales de ${name}`,
  decrease: (name: string) => `Quitar un envase de ${name}`,
  increase: (name: string) => `Añadir un envase de ${name}`,
  badgeLabel: (difference: number) =>
    difference > 0 ? `${difference} más que el plan` : `${-difference} menos que el plan`,
  reasonLabel: 'Motivo de la diferencia',
  reasonPlaceholder: 'Elegir',
  increaseHint: 'Para envases de más solo valen Conteo físico, Error de carga u Otro.',
  otherLabel: 'Describe el motivo',
  reasons: {
    merma: 'Merma',
    rotura: 'Rotura',
    conteo_fisico: 'Conteo físico',
    error_de_carga: 'Error de carga',
    otro: 'Otro',
  } satisfies Record<PackingDifferenceReason, string>,
  invalidCount: 'Escribe un número entero: 0 o más.',
  missingReason: 'Elige un motivo.',
  missingOther: 'Escribe el motivo.',
  exceeds: (packages: number, total: string, quantity: string, max: number) =>
    `Supera la cantidad del pedido: con ${packages} envases se envasan ${total} de ${quantity}. Máximo en esta línea: ${max}.`,
  stock: (needed: number, name: string, free: number) =>
    `No alcanza el stock del envase: hacen falta ${needed} envases vacíos de ${name} y quedan ${free} libres.`,
  zeroHelp: (plan: number) => `Esta línea no da de alta lote. Se liberan sus ${plan} envases apartados.`,
  releaseHelp: (released: number) =>
    released === 1 ? 'Se libera 1 envase apartado.' : `Se liberan ${released} envases apartados.`,
  takeHelp: (taken: number, free: number) =>
    taken === 1
      ? `Sale 1 envase vacío del stock libre (quedan ${free}).`
      : `Salen ${taken} envases vacíos del stock libre (quedan ${free}).`,
  packed: 'Envasado:',
  of: 'de',
  blocked: 'Corrige las líneas marcadas para poder terminar.',
  missing: 'Falta el motivo en las líneas que no coinciden con el plan.',
  cancel: 'Cancelar',
  confirm: 'Terminar',
} as const;

export const PACKING_FINISH_LINE_TESTID = 'packing-finish-line';
export const PACKING_FINISH_COUNT_TESTID = 'packing-finish-count';
export const PACKING_FINISH_DECREASE_TESTID = 'packing-finish-decrease';
export const PACKING_FINISH_INCREASE_TESTID = 'packing-finish-increase';
export const PACKING_FINISH_BADGE_TESTID = 'packing-finish-badge';
export const PACKING_FINISH_LINE_ERROR_TESTID = 'packing-finish-line-error';
export const PACKING_FINISH_REASON_TESTID = 'packing-finish-reason';
export const PACKING_FINISH_REASON_FOLD_TESTID = 'packing-finish-reason-fold';
export const PACKING_FINISH_OTHER_FOLD_TESTID = 'packing-finish-other-fold';
export const PACKING_FINISH_REASON_OPTION_TESTID = 'packing-finish-reason-option';
export const PACKING_FINISH_REASON_ERROR_TESTID = 'packing-finish-reason-error';
export const PACKING_FINISH_OTHER_TESTID = 'packing-finish-other';
export const PACKING_FINISH_OTHER_ERROR_TESTID = 'packing-finish-other-error';
export const PACKING_FINISH_HELP_TESTID = 'packing-finish-help';
export const PACKING_FINISH_TOTAL_TESTID = 'packing-finish-total';
export const PACKING_FINISH_GATE_TESTID = 'packing-finish-gate';

const TEXTS = PACKING_FINISH_DIALOG_TEXTS;

const FOLD_CLASS = [
  'grid grid-rows-[1fr] translate-y-0 opacity-100',
  'transition-[grid-template-rows,opacity,translate] duration-(--dur-base) ease-(--ease-enter) data-closed:ease-(--ease-exit)',
  'data-starting-style:grid-rows-[0fr] data-starting-style:translate-y-[10px] data-starting-style:opacity-0',
  'data-ending-style:grid-rows-[0fr] data-ending-style:translate-y-[10px] data-ending-style:opacity-0',
].join(' ');
const ERROR_REVEAL_CLASS =
  'animate-in fade-in-0 slide-in-from-top-1 duration-(--dur-fast) ease-(--ease-enter)';

type LineState = {
  readonly value: string;
  readonly reason: PackingDifferenceReason | null;
  readonly reasonOther: string;
};

/** Lo que viaja en el campo `lines` del formulario. */
export type PackingFinishSubmission = readonly PackedLineCount[];

export type PackingFinishDialogTestIds = {
  readonly dialog: string;
  readonly dismiss: string;
  readonly confirm: string;
};

export type PackingFinishDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly finish: PackingFinishView | null;
  readonly numberText: string;
  readonly recipeName: string;
  readonly quantityText: string;
  readonly hasEvidenceSteps: boolean;
  readonly onConfirm: (lines: PackingFinishSubmission) => void;
  readonly testIds: PackingFinishDialogTestIds;
};

function parseCount(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function allowedReasons(difference: number): readonly PackingDifferenceReason[] {
  return difference > 0 ? PACKING_INCREASE_REASONS : PACKING_DIFFERENCE_REASONS;
}

function toCount(line: PackingFinishLine, state: LineState): PackedLineCount {
  const packed = parseCount(state.value);
  const differs = packed !== null && packed !== line.plan;
  const reason = differs ? state.reason : null;
  return {
    lineId: line.lineId,
    packedPackages: packed ?? Number.NaN,
    reason,
    reasonOther: reason === 'otro' ? state.reasonOther.trim() : null,
  };
}

type LineView = {
  readonly line: PackingFinishLine;
  readonly state: LineState;
  readonly packed: number | null;
  readonly difference: number;
  readonly error: string | null;
  readonly exceeds: boolean;
  /** Difiere del plan y le falta el motivo o el texto de «Otro». */
  readonly incomplete: boolean;
  readonly reasonError: string | null;
  readonly otherError: string | null;
  readonly help: string | null;
};

function withUnit(value: string, unitLabel: string): string {
  return `${formatDecimalDisplay(value)} ${unitLabel}`;
}

function describeLines(
  finish: PackingFinishView,
  states: ReadonlyMap<string, LineState>,
  tried: boolean,
): { readonly views: readonly LineView[]; readonly total: string | null } {
  const stateOf = (line: PackingFinishLine): LineState =>
    states.get(line.lineId) ?? { value: String(line.plan), reason: null, reasonOther: '' };

  const packedLines = finish.lines.map((line) => ({
    lineId: line.lineId,
    presentationId: line.lineId,
    packedPackages: parseCount(stateOf(line).value) ?? 0,
    content: line.content,
    unit: line.unit,
  }));
  const summed = packedTotalInOrderUnit(finish.orderUnit, packedLines);
  const total = summed.kind === 'ok' ? summed.total : null;

  const counts = finish.lines.map((line) => toCount(line, stateOf(line)));
  const check = checkPackingCounts(
    finish.lines.map((line) => ({ id: line.lineId, packages: line.plan })),
    counts,
  );
  const lineErrors = check.kind === 'invalid' ? check.lineErrors : new Map();

  const excessByPackaging = new Map<string, number>();
  for (const line of finish.lines) {
    const packed = parseCount(stateOf(line).value);
    if (line.packaging === null || packed === null || packed <= line.plan) continue;
    const id = line.packaging.productId;
    excessByPackaging.set(id, (excessByPackaging.get(id) ?? 0) + packed - line.plan);
  }

  const views = finish.lines.map((line): LineView => {
    const state = stateOf(line);
    const packed = parseCount(state.value);
    const difference = packed === null ? 0 : packed - line.plan;

    let error: string | null = null;
    let exceeds = false;
    if (packed === null) {
      error = TEXTS.invalidCount;
    } else if (difference > 0) {
      const max = maxPackagesForLine(finish.orderQuantity, finish.orderUnit, packedLines, line.lineId);
      const excess = line.packaging === null ? 0 : excessByPackaging.get(line.packaging.productId) ?? 0;
      if ((max === null || packed > max) && total !== null) {
        exceeds = true;
        error = TEXTS.exceeds(
          packed,
          withUnit(total, finish.orderUnitLabel),
          withUnit(finish.orderQuantity, finish.orderUnitLabel),
          max ?? 0,
        );
      } else if (line.packaging !== null && excess > line.packaging.freePackages) {
        error = TEXTS.stock(excess, line.label, line.packaging.freePackages);
      }
    }

    const checkError = lineErrors.get(line.lineId);
    const reasonMissing =
      difference !== 0 && (checkError === 'missing_reason' || checkError === 'reason_not_allowed');
    const otherMissing = difference !== 0 && checkError === 'missing_reason_other';

    let help: string | null = null;
    if (error === null && packed !== null && difference !== 0) {
      if (packed === 0) help = TEXTS.zeroHelp(line.plan);
      else if (difference < 0) help = TEXTS.releaseHelp(-difference);
      else if (line.packaging !== null) help = TEXTS.takeHelp(difference, line.packaging.freePackages);
    }

    return {
      line,
      state,
      packed,
      difference,
      error,
      exceeds,
      incomplete: reasonMissing || otherMissing,
      reasonError: tried && reasonMissing ? TEXTS.missingReason : null,
      otherError: tried && otherMissing ? TEXTS.missingOther : null,
      help,
    };
  });

  return { views, total };
}

function initialStates(finish: PackingFinishView | null): ReadonlyMap<string, LineState> {
  return new Map(
    (finish?.lines ?? []).map((line) => [
      line.lineId,
      { value: String(line.plan), reason: null, reasonOther: '' },
    ]),
  );
}

export function PackingFinishDialog({
  open,
  onOpenChange,
  finish,
  numberText,
  recipeName,
  quantityText,
  hasEvidenceSteps,
  onConfirm,
  testIds,
}: PackingFinishDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-testid={testIds.dialog}
        className={cn(
          'flex flex-col gap-0 p-0',
          'inset-0 top-0 left-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 rounded-none sm:max-w-none',
          'md:inset-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[calc(100dvh-48px)] md:max-w-[720px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl',
        )}
      >
        {/* El cuerpo se monta con el popup: al reabrir, el conteo vuelve al plan. */}
        <PackingFinishBody
          finish={finish}
          numberText={numberText}
          recipeName={recipeName}
          quantityText={quantityText}
          hasEvidenceSteps={hasEvidenceSteps}
          onConfirm={(lines) => {
            onOpenChange(false);
            onConfirm(lines);
          }}
          testIds={testIds}
        />
      </DialogContent>
    </Dialog>
  );
}

type PackingFinishBodyProps = Omit<PackingFinishDialogProps, 'open' | 'onOpenChange'>;

function PackingFinishBody({
  finish,
  numberText,
  recipeName,
  quantityText,
  hasEvidenceSteps,
  onConfirm,
  testIds,
}: PackingFinishBodyProps) {
  const [states, setStates] = useState(() => initialStates(finish));
  const [tried, setTried] = useState(false);

  const { views, total } =
    finish === null ? { views: [], total: null } : describeLines(finish, states, tried);
  const blocked = views.some((view) => view.error !== null);
  const missing = views.some((view) => view.incomplete);

  const gate = blocked ? TEXTS.blocked : tried && missing ? TEXTS.missing : '';
  const overQuantity = views.some((view) => view.exceeds);

  const description = hasEvidenceSteps
    ? `${TEXTS.descriptionLead} ${STEP_EVIDENCE_TEXTS.finishWarning}`
    : `${TEXTS.descriptionLead} ${TEXTS.descriptionEnd}`;

  function update(line: PackingFinishLine, patch: Partial<LineState>) {
    setStates((previous) => {
      const current = previous.get(line.lineId) ?? { value: String(line.plan), reason: null, reasonOther: '' };
      const next: LineState = { ...current, ...patch };
      const packed = parseCount(next.value);
      const reason =
        next.reason !== null && packed !== null && packed !== line.plan && !allowedReasons(packed - line.plan).includes(next.reason)
          ? null
          : next.reason;
      const updated = new Map(previous);
      updated.set(line.lineId, { ...next, reason });
      return updated;
    });
  }

  function handleConfirm() {
    if (blocked) return;
    if (missing) {
      setTried(true);
      return;
    }
    onConfirm(finish === null ? [] : views.map((view) => toCount(view.line, view.state)));
  }

  return (
    <>
      <div className="flex flex-col gap-3 px-4 pt-5 pb-3 md:px-6 md:pt-6 md:pb-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div
              aria-hidden="true"
              className="flex size-11 flex-none items-center justify-center rounded-xl bg-status-progress-subtle text-status-progress-text"
            >
              <CircleCheckIcon className="size-6" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle className="text-lg font-semibold">{TEXTS.title}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono">{numberText}</span> · {recipeName} · {TEXTS.quantity}{' '}
                <span className="font-mono">{quantityText}</span>
              </p>
            </div>
          </div>
          <DialogClose
            render={<Button type="button" variant="ghost" size="icon" touch aria-label={TEXTS.close} />}
          >
            <XIcon aria-hidden="true" />
          </DialogClose>
        </div>
        <DialogDescription className="text-base">{description}</DialogDescription>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-border px-4 pb-3 md:px-6">
        {views.map((view) => (
          <PackingFinishLineRow
            key={view.line.lineId}
            view={view}
            onChange={(patch) => update(view.line, patch)}
          />
        ))}
      </div>

      <div className="flex flex-col items-stretch gap-3 border-t border-border px-4 pt-3 pb-[calc(14px+env(safe-area-inset-bottom))] md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4 md:px-6 md:pt-3.5 md:pb-5">
        <div className="flex flex-col gap-0.5 text-sm" aria-live="polite">
          {finish === null ? null : (
            <span data-testid={PACKING_FINISH_TOTAL_TESTID}>
              {TEXTS.packed}{' '}
              <span className={cn('font-mono font-semibold', overQuantity && 'text-destructive')}>
                {total === null ? '—' : withUnit(total, finish.orderUnitLabel)}
              </span>{' '}
              {TEXTS.of}{' '}
              <span className="font-mono">{withUnit(finish.orderQuantity, finish.orderUnitLabel)}</span>
            </span>
          )}
          <span className="text-xs text-muted-foreground" data-testid={PACKING_FINISH_GATE_TESTID}>
            {gate}
          </span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 md:flex">
          <DialogClose
            render={
              <Button type="button" variant="outline" touch className="h-11" data-testid={testIds.dismiss} />
            }
          >
            {TEXTS.cancel}
          </DialogClose>
          <Button
            type="button"
            touch
            className="h-11"
            disabled={blocked}
            onClick={handleConfirm}
            data-testid={testIds.confirm}
          >
            <CircleCheckIcon aria-hidden="true" />
            {TEXTS.confirm}
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * Panel de `Collapsible` que se pliega con lo último que mostró abierto: al volver al plan la
 * ayuda y el aviso cambian, y sin congelarlos el bloque saltaría mientras se cierra.
 */
function FoldPanel({
  open,
  className,
  testId,
  children,
}: {
  readonly open: boolean;
  readonly className?: string;
  readonly testId: string;
  readonly children: ReactNode;
}) {
  const [lastOpen, setLastOpen] = useState<ReactNode>(open ? children : null);
  // Recorta solo mientras se mueve: abierto y quieto, el anillo de foco no se corta.
  const [settled, setSettled] = useState(false);

  if (open && lastOpen !== children) setLastOpen(children);
  if (!open && settled) setSettled(false);

  function handleTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (open && event.target === event.currentTarget) setSettled(true);
  }

  return (
    <Collapsible open={open} className="contents">
      <CollapsibleContent
        data-testid={testId}
        inert={!open}
        aria-hidden={open ? undefined : true}
        onTransitionEnd={handleTransitionEnd}
        className={cn(FOLD_CLASS, className)}
      >
        <div className={cn('min-h-0', !(open && settled) && 'overflow-hidden')}>
          {open ? children : lastOpen}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PackingFinishLineRow({
  view,
  onChange,
}: {
  readonly view: LineView;
  readonly onChange: (patch: Partial<LineState>) => void;
}) {
  const id = useId();
  const nameId = `${id}-name`;
  const errorId = `${id}-error`;
  const reasonLabelId = `${id}-reason-label`;
  const reasonErrorId = `${id}-reason-error`;
  const otherId = `${id}-other`;
  const otherErrorId = `${id}-other-error`;

  const { line, state, packed, difference, error, reasonError, otherError, help } = view;
  const name = line.label;
  const differs = packed !== null && difference !== 0;
  const allowed = allowedReasons(difference);
  const reason = state.reason !== null && allowed.includes(state.reason) ? state.reason : null;
  const base = packed ?? line.plan;

  return (
    <div
      role="group"
      aria-labelledby={nameId}
      data-testid={PACKING_FINISH_LINE_TESTID}
      data-line-id={line.lineId}
      className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2.5 border-b border-border py-4 md:grid-cols-[40px_minmax(0,1fr)_auto]"
    >
      <span
        aria-hidden="true"
        className="flex size-10 flex-none items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"
      >
        <PackageIcon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span id={nameId} className="text-[15px] font-semibold">
          {name}
        </span>
        <span className="text-sm text-muted-foreground">
          {TEXTS.planPrefix} <span className="font-mono">{line.plan}</span> {TEXTS.planSuffix}
        </span>
      </span>

      <div className="col-span-full flex items-center gap-1.5 md:col-span-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          touch
          aria-label={TEXTS.decrease(name)}
          onClick={() => onChange({ value: String(Math.max(0, base - 1)) })}
          data-testid={PACKING_FINISH_DECREASE_TESTID}
        >
          <MinusIcon aria-hidden="true" />
        </Button>
        <Input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={TEXTS.countLabel(name)}
          aria-invalid={error === null ? undefined : true}
          aria-describedby={error === null ? undefined : errorId}
          value={state.value}
          onChange={(event) => onChange({ value: event.currentTarget.value.replace(/[^0-9]/g, '') })}
          className="h-12 flex-1 text-center font-mono text-lg md:w-20 md:flex-none md:text-lg"
          data-testid={PACKING_FINISH_COUNT_TESTID}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          touch
          aria-label={TEXTS.increase(name)}
          onClick={() => onChange({ value: String(base + 1) })}
          data-testid={PACKING_FINISH_INCREASE_TESTID}
        >
          <PlusIcon aria-hidden="true" />
        </Button>
        <span className="flex min-w-12 justify-end">
          {differs ? (
            <StatusBadge
              tone={error === null ? 'waiting' : 'danger'}
              label={difference > 0 ? `+${difference}` : `−${-difference}`}
              aria-label={TEXTS.badgeLabel(difference)}
              data-testid={PACKING_FINISH_BADGE_TESTID}
            />
          ) : null}
        </span>
      </div>

      {error === null ? null : (
        <div className={cn('col-span-full md:col-start-2', ERROR_REVEAL_CLASS)}>
          <FieldError id={errorId} message={error} testId={PACKING_FINISH_LINE_ERROR_TESTID} />
        </div>
      )}

      <FoldPanel open={differs} className="col-span-full md:col-start-2" testId={PACKING_FINISH_REASON_FOLD_TESTID}>
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-2">
            <span id={reasonLabelId} className="text-sm font-medium">
              {TEXTS.reasonLabel} <span aria-hidden="true" className="text-destructive">*</span>
            </span>
            <SharedSelectControl
              name={`reason-${line.lineId}`}
              options={allowed.map((value) => ({ value, label: TEXTS.reasons[value] }))}
              value={reason}
              onValueChange={(value) => onChange({ reason: value as PackingDifferenceReason | null })}
              required
              labelledBy={reasonLabelId}
              invalid={reasonError !== null}
              describedBy={reasonError === null ? undefined : reasonErrorId}
              triggerTestId={PACKING_FINISH_REASON_TESTID}
              optionTestId={PACKING_FINISH_REASON_OPTION_TESTID}
              triggerClassName="w-full min-h-11 h-12 text-base md:text-base"
            >
              <span className={cn('flex-1 text-left', reason === null && 'text-muted-foreground')}>
                {reason === null ? TEXTS.reasonPlaceholder : TEXTS.reasons[reason]}
              </span>
            </SharedSelectControl>
            {reasonError === null ? null : (
              <div className={ERROR_REVEAL_CLASS}>
                <FieldError id={reasonErrorId} message={reasonError} testId={PACKING_FINISH_REASON_ERROR_TESTID} />
              </div>
            )}
            {difference > 0 ? <p className="text-xs text-muted-foreground">{TEXTS.increaseHint}</p> : null}
          </div>

          <FoldPanel open={reason === 'otro'} testId={PACKING_FINISH_OTHER_FOLD_TESTID}>
            <div className="flex flex-col gap-2">
              <Label htmlFor={otherId}>
                {TEXTS.otherLabel} <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Textarea
                id={otherId}
                rows={2}
                maxLength={PACKING_REASON_OTHER_MAX}
                aria-required
                aria-invalid={otherError === null ? undefined : true}
                aria-describedby={otherError === null ? undefined : otherErrorId}
                value={state.reasonOther}
                onChange={(event) => onChange({ reasonOther: event.currentTarget.value })}
                className="min-h-12 text-base md:text-base"
                data-testid={PACKING_FINISH_OTHER_TESTID}
              />
              {otherError === null ? null : (
                <div className={ERROR_REVEAL_CLASS}>
                  <FieldError id={otherErrorId} message={otherError} testId={PACKING_FINISH_OTHER_ERROR_TESTID} />
                </div>
              )}
            </div>
          </FoldPanel>

          {help === null ? null : (
            <p className="text-xs text-muted-foreground" data-testid={PACKING_FINISH_HELP_TESTID}>
              {help}
            </p>
          )}
        </div>
      </FoldPanel>
    </div>
  );
}
