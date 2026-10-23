'use client';

import { useEffect, useId, useState } from 'react';
import { XIcon } from 'lucide-react';

import {
  EvidenceReadError,
  EvidenceStepList,
  MAX_STEP_EVIDENCE_PHOTOS,
  STEP_EVIDENCE_TEXTS,
  StepEvidence,
  type StepEvidenceTile,
} from '@/components/shared/step-evidence';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { OrderEvidence, OrderEvidenceGroup } from '@/lib/modules/asignaciones';
import { getOrderEvidenceAction } from '@/lib/modules/asignaciones/adapters/driving/order-evidence-actions';

export const BATCH_EVIDENCE_TEXTS = {
  column: 'Evidencia',
  photos: (n: number) => (n === 1 ? '1 foto' : `${n} fotos`),
  open: (lot: string, n: number) =>
    `Ver evidencia del lote ${lot}: ${BATCH_EVIDENCE_TEXTS.photos(n)}`,
  title: 'Evidencia',
  lot: 'Lote',
  order: 'Pedido',
  description: 'Fotos tomadas durante la ejecución del pedido. Solo consulta.',
  manufacturing: 'Fabricación',
  packing: 'Envasado',
  manufacturingPhase: 'fabricación',
  packingPhase: 'envasado',
} as const;

/** En teléfono ocupa la pantalla; desde 768 px vuelve a ser un diálogo centrado. */
export const BATCH_EVIDENCE_DIALOG_CLASS =
  'top-0 left-0 h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-none md:top-1/2 md:left-1/2 md:h-auto md:max-h-[85dvh] md:max-w-3xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:p-6';

export const BATCH_EVIDENCE_DIALOG_TESTID = 'batch-evidence-dialog';

export type BatchEvidenceDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly lot: string;
  readonly orderId: string;
  readonly orderNumberText: string;
  /** Total del pedido: da cuántas casillas esqueleto pintar mientras se lee. */
  readonly photoCount: number;
};

type Settled =
  | { readonly attempt: number; readonly status: 'ready'; readonly evidence: OrderEvidence }
  | { readonly attempt: number; readonly status: 'error' };

function totalOf(groups: readonly OrderEvidenceGroup[]): number {
  return groups.reduce((sum, group) => sum + group.photoCount, 0);
}

function loadingTiles(photoCount: number): StepEvidenceTile[] {
  const count = Math.min(Math.max(photoCount, 1), MAX_STEP_EVIDENCE_PHOTOS);
  return Array.from({ length: count }, (_, index) => ({ id: `loading-${index}`, status: 'loading' }));
}

function PhaseSection({
  name,
  phaseLabel,
  groups,
  onRetry,
  onReload,
  testId,
}: {
  readonly name: string;
  readonly phaseLabel: string;
  readonly groups: readonly OrderEvidenceGroup[];
  readonly onRetry: () => void;
  readonly onReload: () => void;
  readonly testId: string;
}) {
  const headingId = useId();
  if (groups.length === 0) return null;
  const total = totalOf(groups);

  return (
    <section aria-labelledby={headingId} data-testid={testId} className="flex flex-col gap-1">
      <h3 id={headingId} className="flex items-center gap-2 text-base font-semibold">
        {name}
        <span
          data-testid={`${testId}-count`}
          aria-label={BATCH_EVIDENCE_TEXTS.photos(total)}
          className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-normal"
        >
          {total}
        </span>
      </h3>
      <EvidenceStepList
        groups={groups}
        phaseLabel={phaseLabel}
        onRetry={onRetry}
        onReload={onReload}
        testId={`${testId}-steps`}
      />
    </section>
  );
}

export function BatchEvidenceDialog({
  open,
  onOpenChange,
  lot,
  orderId,
  orderNumberText,
  photoCount,
}: BatchEvidenceDialogProps) {
  // Cada intento es una lectura nueva: reintentar, recargar o volver a abrir pide firmas nuevas.
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    getOrderEvidenceAction(orderId).then(
      (result) => {
        if (!live) return;
        setSettled(
          result.status === 'success'
            ? { attempt, status: 'ready', evidence: result.data }
            : { attempt, status: 'error' },
        );
      },
      () => {
        if (live) setSettled({ attempt, status: 'error' });
      },
    );
    return () => {
      live = false;
    };
  }, [open, attempt, orderId]);

  const reread = () => setAttempt((current) => current + 1);
  const current = settled !== null && settled.attempt === attempt ? settled : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reread();
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-testid={BATCH_EVIDENCE_DIALOG_TESTID}
        data-status={current === null ? 'loading' : current.status}
        className={BATCH_EVIDENCE_DIALOG_CLASS}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <DialogTitle className="text-lg leading-snug font-semibold">
              {BATCH_EVIDENCE_TEXTS.title} · {BATCH_EVIDENCE_TEXTS.lot}{' '}
              <span className="font-mono">{lot}</span> · {BATCH_EVIDENCE_TEXTS.order}{' '}
              <span className="font-mono">{orderNumberText}</span>
            </DialogTitle>
            <DialogDescription>{BATCH_EVIDENCE_TEXTS.description}</DialogDescription>
          </div>
          <DialogClose
            render={<Button type="button" variant="ghost" size="icon" touch />}
            aria-label={STEP_EVIDENCE_TEXTS.close}
          >
            <XIcon aria-hidden />
          </DialogClose>
        </div>

        {current === null && (
          <StepEvidence consult stepPosition={1} photos={loadingTiles(photoCount)} />
        )}

        {current?.status === 'error' && (
          <EvidenceReadError onRetry={reread} testId="batch-evidence-error" />
        )}

        {current?.status === 'ready' && (
          <div className="flex flex-col gap-4">
            <PhaseSection
              name={BATCH_EVIDENCE_TEXTS.manufacturing}
              phaseLabel={BATCH_EVIDENCE_TEXTS.manufacturingPhase}
              groups={current.evidence.manufacturing}
              onRetry={reread}
              onReload={reread}
              testId="batch-evidence-manufacturing"
            />
            <PhaseSection
              name={BATCH_EVIDENCE_TEXTS.packing}
              phaseLabel={BATCH_EVIDENCE_TEXTS.packingPhase}
              groups={current.evidence.packing}
              onRetry={reread}
              onReload={reread}
              testId="batch-evidence-packing"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
