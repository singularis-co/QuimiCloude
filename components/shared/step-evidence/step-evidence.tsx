'use client';

import { type ChangeEvent, type DragEvent, type ReactNode, useId, useRef, useState } from 'react';
import { CameraIcon, RefreshCwIcon, Trash2Icon, TriangleAlertIcon, XIcon } from 'lucide-react';

import { toAcceptAttribute } from '@/components/shared/file-types';
import { Spinner } from '@/components/shared/spinner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
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
  stepHeading: (step: number) => `Paso ${step}`,
  groupLabel: (phase: string, step: number) => `Evidencia de ${phase}, paso ${step}`,
  loading: 'Cargando fotos…',
  expired: 'Vista vencida',
  reload: 'Recargar',
  reloadPhoto: (n: number, step: number) => `Recargar la foto ${n} del paso ${step}`,
  readError: 'No se pudieron cargar las fotos.',
  retry: 'Reintentar',
} as const;

export type StepEvidenceTile =
  | { readonly id: string; readonly status: 'ok'; readonly url: string }
  | { readonly id: string; readonly status: 'uploading'; readonly percent: number }
  | { readonly id: string; readonly status: 'error'; readonly message: string }
  | { readonly id: string; readonly status: 'loading' };

export type StepEvidenceProps = {
  /** Posición del paso desde 1: solo nombra las fotos para los lectores de pantalla. */
  readonly stepPosition: number;
  /** Las casillas en el orden de la cuadrícula; solo las `ok` cuentan, salvo con `consult`. */
  readonly photos: readonly StepEvidenceTile[];
  readonly readOnly?: boolean;
  /**
   * Solo para ver fotos ya guardadas: implica `readOnly`, quita los textos de requisito y de ayuda
   * y cuenta también las casillas que aún cargan.
   */
  readonly consult?: boolean;
  /** Con `consult`, la fase que nombra el grupo para los lectores de pantalla. */
  readonly phaseLabel?: string;
  readonly heading?: string;
  readonly onAdd?: (file: File) => void;
  readonly onChange?: (id: string, file: File) => void;
  /** En una foto contada la retira; en una casilla en error la descarta. */
  readonly onRemove?: (id: string) => void;
  /** Con `consult`, «Recargar» en una miniatura que no cargó; sin él no hay botón. */
  readonly onReload?: () => void;
};

const TILE_ENTER =
  'animate-in fade-in slide-in-from-bottom-1 duration-(--dur-base) ease-(--ease-enter)';

const PHOTO_ACTION_CLASS =
  'size-11 rounded-[10px] bg-card/90 text-foreground shadow-sm hover:bg-card';

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

function withUrl(set: ReadonlySet<string>, url: string): ReadonlySet<string> {
  return set.has(url) ? set : new Set(set).add(url);
}

export function StepEvidence({
  stepPosition,
  photos,
  readOnly: readOnlyProp = false,
  consult = false,
  phaseLabel,
  heading = STEP_EVIDENCE_TEXTS.heading,
  onAdd,
  onChange,
  onRemove,
  onReload,
}: StepEvidenceProps) {
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const inputRef = useRef<HTMLInputElement>(null);
  const changeTarget = useRef<string | null>(null);
  const [viewing, setViewing] = useState<{ url: string; label: string } | null>(null);
  // Por URL y no por id: una lectura firmada nueva de la misma foto vuelve a esperar su carga.
  const [loadedUrls, setLoadedUrls] = useState<ReadonlySet<string>>(() => new Set());
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(() => new Set());

  const readOnly = readOnlyProp || consult;
  const okCount = photos.filter((photo) =>
    consult ? photo.status !== 'error' : photo.status === 'ok',
  ).length;
  const canAdd = !readOnly && photos.length < MAX_STEP_EVIDENCE_PHOTOS;

  function isPending(photo: StepEvidenceTile): boolean {
    if (photo.status === 'loading') return true;
    return (
      consult && photo.status === 'ok' && !loadedUrls.has(photo.url) && !failedUrls.has(photo.url)
    );
  }
  const anyPending = photos.some(isPending);

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

  const body = (
    <>
      {consult ? (
        <EvidenceGroupHeader title={heading} count={okCount} titleId={headingId} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2.5">
            <CameraIcon className="size-4" aria-hidden />
            <h3 id={headingId} className="text-base font-semibold">
              {heading}
            </h3>
            <EvidenceCount count={okCount} />
          </span>
          <span data-testid="step-evidence-requirement" className="text-xs text-muted-foreground">
            {readOnly ? STEP_EVIDENCE_TEXTS.fixed : STEP_EVIDENCE_TEXTS.required}
          </span>
        </div>
      )}

      {consult && (
        <span role="status" className="sr-only" data-testid="step-evidence-loading">
          {anyPending ? STEP_EVIDENCE_TEXTS.loading : ''}
        </span>
      )}

      <ul
        className={cn('grid grid-cols-3', consult ? 'gap-2' : 'gap-2.5')}
        data-testid="step-evidence-grid"
        aria-busy={consult && anyPending ? true : undefined}
      >
        {photos.map((photo, index) => {
          const n = index + 1;
          const expired = consult && photo.status === 'ok' && failedUrls.has(photo.url);
          const pending = isPending(photo);
          return (
            <li
              key={photo.id}
              data-testid={`step-evidence-tile-${n}`}
              data-status={expired ? 'expired' : photo.status}
              data-pending={pending || undefined}
              className={cn(
                'relative aspect-square overflow-hidden rounded-xl',
                photo.status === 'loading' ? 'border-0' : 'border border-border',
                TILE_ENTER,
              )}
            >
              {pending && (
                <Skeleton
                  data-testid="step-evidence-skeleton"
                  className="absolute inset-0 size-full rounded-xl"
                />
              )}

              {expired && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-warning-subtle p-1.5 text-center text-xs leading-snug text-warning-text">
                  <span className="font-semibold">{STEP_EVIDENCE_TEXTS.expired}</span>
                  {onReload !== undefined && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      touch
                      aria-label={STEP_EVIDENCE_TEXTS.reloadPhoto(n, stepPosition)}
                      onClick={onReload}
                    >
                      {STEP_EVIDENCE_TEXTS.reload}
                    </Button>
                  )}
                </div>
              )}

              {photo.status === 'ok' && !expired && (
                <>
                  {/* URL firmada de vida corta del bucket: `next/image` exigiría declarar su dominio. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={photo.url}
                    src={photo.url}
                    alt=""
                    className={cn('absolute inset-0 size-full object-cover', pending && 'opacity-0')}
                    // La imagen puede terminar antes de que la hidratación enganche onLoad/onError
                    // y ese evento se pierde: al montar, se lee su estado. `withUrl` devuelve el
                    // mismo Set si la URL ya está, así que repetirlo no vuelve a renderizar.
                    ref={
                      consult
                        ? (img: HTMLImageElement | null) => {
                            if (img === null || !img.getAttribute('src') || !img.complete) return;
                            if (img.naturalWidth > 0) {
                              setLoadedUrls((set) => withUrl(set, photo.url));
                            } else {
                              setFailedUrls((set) => withUrl(set, photo.url));
                            }
                          }
                        : undefined
                    }
                    onLoad={
                      consult ? () => setLoadedUrls((set) => withUrl(set, photo.url)) : undefined
                    }
                    onError={
                      consult ? () => setFailedUrls((set) => withUrl(set, photo.url)) : undefined
                    }
                  />
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

              {photo.status !== 'loading' && !expired && (
                <span
                  aria-hidden
                  className="absolute bottom-2 left-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-card/90 px-1.5 font-mono text-xs"
                >
                  {n}
                </span>
              )}
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

      {!consult && (
        <p data-testid="step-evidence-hint" className="m-0 text-xs text-muted-foreground">
          {readOnly ? STEP_EVIDENCE_TEXTS.fixedHint : STEP_EVIDENCE_TEXTS.hint}
        </p>
      )}

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
    </>
  );

  if (consult) {
    return (
      <div
        role="group"
        aria-label={
          phaseLabel === undefined ? undefined : STEP_EVIDENCE_TEXTS.groupLabel(phaseLabel, stepPosition)
        }
        aria-labelledby={phaseLabel === undefined ? headingId : undefined}
        data-testid="step-evidence"
        data-read-only
        data-consult
        className="flex flex-col gap-2"
      >
        {body}
      </div>
    );
  }

  return (
    <Card
      role="region"
      aria-labelledby={headingId}
      data-testid="step-evidence"
      data-read-only={readOnly || undefined}
      className="gap-3 px-4"
    >
      {body}
    </Card>
  );
}

function EvidenceCount({ count }: { readonly count: number }) {
  return (
    <span
      data-testid="step-evidence-count"
      aria-label={STEP_EVIDENCE_TEXTS.countLabel(count)}
      className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs"
    >
      {STEP_EVIDENCE_TEXTS.count(count)}
    </span>
  );
}

/** Cabecera de un grupo en modo consulta; la reutiliza el grupo que no se pudo leer. */
export function EvidenceGroupHeader({
  title,
  count,
  titleId,
}: {
  readonly title: ReactNode;
  readonly count: number;
  readonly titleId?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <CameraIcon className="size-4" aria-hidden />
      <span id={titleId} className="font-semibold">
        {title}
      </span>
      <EvidenceCount count={count} />
    </div>
  );
}
