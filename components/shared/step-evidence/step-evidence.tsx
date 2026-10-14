'use client';

import { type ChangeEvent, type DragEvent, useId, useRef, useState } from 'react';
import { CameraIcon, RefreshCwIcon, Trash2Icon, TriangleAlertIcon, XIcon } from 'lucide-react';

import { toAcceptAttribute } from '@/components/shared/file-types';
import { Spinner } from '@/components/shared/spinner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

import { EVIDENCE_ACCEPTED_TYPES, EVIDENCE_MAX_SIZE_LABEL } from './upload-evidence';

export const MAX_STEP_EVIDENCE_PHOTOS = 3;

export const STEP_EVIDENCE_TEXTS = {
  heading: 'Evidencia',
  count: (ok: number) => `${ok}/${MAX_STEP_EVIDENCE_PHOTOS}`,
  countLabel: (ok: number) => `${ok} de ${MAX_STEP_EVIDENCE_PHOTOS} fotos`,
  required: 'Obligatoria · de 1 a 3 fotos',
  fixed: 'Fijada al terminar',
  hint: `JPG, PNG o WebP · hasta ${EVIDENCE_MAX_SIZE_LABEL} · se comprime antes de subir.`,
  fixedHint: 'El pedido ya terminó: las fotos no se pueden cambiar ni quitar.',
  add: 'Añadir foto',
  addAnother: 'Añadir otra foto',
  addCaption: 'Cámara o archivo',
  uploading: (percent: number) => `Subiendo ${percent} %`,
  remove: 'Quitar',
  close: 'Cerrar',
  photo: (n: number, step: number) => `Foto ${n} del paso ${step}`,
  changePhoto: (n: number, step: number) => `Cambiar la foto ${n} del paso ${step}`,
  removePhoto: (n: number, step: number) => `Quitar la foto ${n} del paso ${step}`,
  uploadingReason: 'Espera a que termine de subir la foto.',
  missingReason: 'Sube al menos 1 foto de evidencia para continuar.',
  finishWarning: 'Al terminar, las fotos de evidencia quedan fijas. No se puede deshacer.',
} as const;

export type StepEvidenceTile =
  | { readonly id: string; readonly status: 'ok'; readonly url: string }
  | { readonly id: string; readonly status: 'uploading'; readonly percent: number }
  | { readonly id: string; readonly status: 'error'; readonly message: string };

export type StepEvidenceProps = {
  /** Posición del paso desde 1: solo nombra las fotos para los lectores de pantalla. */
  readonly stepPosition: number;
  /** Las casillas en el orden de la cuadrícula; solo las `ok` cuentan. */
  readonly photos: readonly StepEvidenceTile[];
  readonly readOnly?: boolean;
  readonly onAdd?: (file: File) => void;
  readonly onChange?: (id: string, file: File) => void;
  /** En una foto contada la retira; en una casilla en error la descarta. */
  readonly onRemove?: (id: string) => void;
};

const TILE_ENTER =
  'animate-in fade-in slide-in-from-bottom-1 duration-(--dur-base) ease-(--ease-enter)';

const PHOTO_ACTION_CLASS =
  'size-11 rounded-[10px] bg-card/90 text-foreground shadow-sm hover:bg-card';

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

export function StepEvidence({
  stepPosition,
  photos,
  readOnly = false,
  onAdd,
  onChange,
  onRemove,
}: StepEvidenceProps) {
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const inputRef = useRef<HTMLInputElement>(null);
  const changeTarget = useRef<string | null>(null);
  const [viewing, setViewing] = useState<{ url: string; label: string } | null>(null);

  const okCount = photos.filter((photo) => photo.status === 'ok').length;
  const canAdd = !readOnly && photos.length < MAX_STEP_EVIDENCE_PHOTOS;

  function pickFile(targetId: string | null) {
    changeTarget.current = targetId;
    inputRef.current?.click();
  }

  function deliver(file: File) {
    const targetId = changeTarget.current;
    changeTarget.current = null;
    if (targetId === null) {
      onAdd?.(file);
    } else {
      onChange?.(targetId, file);
    }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Vaciarlo deja volver a elegir el mismo archivo después de un error.
    event.target.value = '';
    if (file !== undefined) deliver(file);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file === undefined) return;
    changeTarget.current = null;
    deliver(file);
  }

  return (
    <Card
      role="region"
      aria-labelledby={headingId}
      data-testid="step-evidence"
      data-read-only={readOnly || undefined}
      className="gap-3 px-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2.5">
          <CameraIcon className="size-4" aria-hidden />
          <h3 id={headingId} className="text-base font-semibold">
            {STEP_EVIDENCE_TEXTS.heading}
          </h3>
          <span
            data-testid="step-evidence-count"
            aria-label={STEP_EVIDENCE_TEXTS.countLabel(okCount)}
            className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs"
          >
            {STEP_EVIDENCE_TEXTS.count(okCount)}
          </span>
        </span>
        <span data-testid="step-evidence-requirement" className="text-xs text-muted-foreground">
          {readOnly ? STEP_EVIDENCE_TEXTS.fixed : STEP_EVIDENCE_TEXTS.required}
        </span>
      </div>

      <ul className="grid grid-cols-3 gap-2.5" data-testid="step-evidence-grid">
        {photos.map((photo, index) => {
          const n = index + 1;
          return (
            <li
              key={photo.id}
              data-testid={`step-evidence-tile-${n}`}
              data-status={photo.status}
              className={cn(
                'relative aspect-square overflow-hidden rounded-xl border border-border',
                TILE_ENTER,
              )}
            >
              {photo.status === 'ok' && (
                <>
                  {/* URL firmada de vida corta del bucket: `next/image` exigiría declarar su dominio. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" className="absolute inset-0 size-full object-cover" />
                  <button
                    type="button"
                    aria-label={STEP_EVIDENCE_TEXTS.photo(n, stepPosition)}
                    className="absolute inset-0 size-full cursor-zoom-in rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring"
                    onClick={() =>
                      setViewing({ url: photo.url, label: STEP_EVIDENCE_TEXTS.photo(n, stepPosition) })
                    }
                  />
                  {!readOnly && (
                    <div className="absolute top-1.5 right-1.5 flex gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        touch
                        className={PHOTO_ACTION_CLASS}
                        aria-label={STEP_EVIDENCE_TEXTS.changePhoto(n, stepPosition)}
                        onClick={() => pickFile(photo.id)}
                      >
                        <RefreshCwIcon aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        touch
                        className={PHOTO_ACTION_CLASS}
                        aria-label={STEP_EVIDENCE_TEXTS.removePhoto(n, stepPosition)}
                        onClick={() => onRemove?.(photo.id)}
                      >
                        <Trash2Icon aria-hidden />
                      </Button>
                    </div>
                  )}
                </>
              )}

              {photo.status === 'uploading' && (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/70 p-3.5"
                >
                  <Spinner size="lg" />
                  <span className="font-mono text-xs text-muted-foreground">
                    {STEP_EVIDENCE_TEXTS.uploading(clampPercent(photo.percent))}
                  </span>
                  <div
                    role="progressbar"
                    aria-label={STEP_EVIDENCE_TEXTS.photo(n, stepPosition)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={clampPercent(photo.percent)}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-(--dur-slow) ease-(--ease-standard)"
                      style={{ width: `${clampPercent(photo.percent)}%` }}
                    />
                  </div>
                </div>
              )}

              {photo.status === 'error' && (
                <div
                  role="alert"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-destructive/10 p-2.5 text-center text-[13px] leading-snug text-destructive"
                >
                  <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
                  <span>{photo.message}</span>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      touch
                      onClick={() => onRemove?.(photo.id)}
                    >
                      {STEP_EVIDENCE_TEXTS.remove}
                    </Button>
                  )}
                </div>
              )}

              <span
                aria-hidden
                className="absolute bottom-2 left-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-card/90 px-1.5 font-mono text-xs"
              >
                {n}
              </span>
            </li>
          );
        })}

        {canAdd && (
          <li className={TILE_ENTER}>
            <button
              type="button"
              data-testid="step-evidence-add"
              className={cn(
                'flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-background p-3 text-center transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                touchTarget,
              )}
              onClick={() => pickFile(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <CameraIcon className="size-5 text-primary" aria-hidden />
              <span className="text-sm font-semibold">
                {photos.length > 0 ? STEP_EVIDENCE_TEXTS.addAnother : STEP_EVIDENCE_TEXTS.add}
              </span>
              <span className="text-xs text-muted-foreground">{STEP_EVIDENCE_TEXTS.addCaption}</span>
            </button>
          </li>
        )}
      </ul>

      {!readOnly && (
        <input
          ref={inputRef}
          type="file"
          accept={toAcceptAttribute(EVIDENCE_ACCEPTED_TYPES)}
          capture="environment"
          tabIndex={-1}
          aria-hidden
          data-testid="step-evidence-input"
          className="sr-only"
          onChange={handleInput}
        />
      )}

      <p data-testid="step-evidence-hint" className="m-0 text-xs text-muted-foreground">
        {readOnly ? STEP_EVIDENCE_TEXTS.fixedHint : STEP_EVIDENCE_TEXTS.hint}
      </p>

      <Dialog open={viewing !== null} onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          data-testid="step-evidence-viewer"
          className="max-w-[calc(100%-1rem)] gap-3 sm:max-w-2xl"
        >
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold">{viewing?.label}</DialogTitle>
            <DialogClose
              render={<Button type="button" variant="ghost" size="icon" touch />}
              aria-label={STEP_EVIDENCE_TEXTS.close}
            >
              <XIcon aria-hidden />
            </DialogClose>
          </div>
          {viewing !== null && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewing.url}
              alt={viewing.label}
              className="max-h-[80dvh] w-full rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
