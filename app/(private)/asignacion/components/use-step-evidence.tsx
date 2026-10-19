'use client';

import { useRef, useState, type ReactNode } from 'react';

import {
  STEP_EVIDENCE_TEXTS,
  StepEvidence,
  uploadEvidence,
  type StepEvidenceTile,
} from '@/components/shared/step-evidence';
import {
  missingEvidencePositions,
  stepRequiresEvidence,
  type EvidencePhase,
  type EvidenceStep,
  type StepEvidencePhotoView,
  type StepEvidenceView,
} from '@/lib/modules/asignaciones';
import {
  registerEvidenceAction,
  removeEvidenceAction,
  requestEvidenceUploadAction,
} from '@/lib/modules/asignaciones/adapters/driving/step-evidence-actions';
import { errorMessage, UNEXPECTED_ERROR_CODE } from '@/lib/modules/errores';

type OkTile = Extract<StepEvidenceTile, { status: 'ok' }>;

type Entry = { readonly tile: StepEvidenceTile };

type EntriesByStep = Readonly<Record<number, readonly Entry[]>>;

export type UseStepEvidenceOptions = {
  readonly orderId: string;
  readonly phase: EvidencePhase;
  readonly steps: readonly EvidenceStep[];
  readonly initial: readonly StepEvidenceView[];
};

export type StepEvidenceController = {
  readonly renderStepAddon: (position: number) => ReactNode;
  readonly stepBlockReason: (position: number) => string | null;
  /** Pasos que exigen evidencia y no tienen ninguna foto contada. */
  readonly missingPositions: () => readonly number[];
  readonly hasEvidenceSteps: boolean;
};

const UNEXPECTED_MESSAGE = errorMessage(UNEXPECTED_ERROR_CODE);

function okTiles(photos: readonly StepEvidencePhotoView[]): Entry[] {
  return [...photos]
    .sort((a, b) => a.slot - b.slot)
    .map((photo) => ({ tile: { id: photo.id, status: 'ok', url: photo.url } }));
}

function initialEntries(initial: readonly StepEvidenceView[]): EntriesByStep {
  const entries: Record<number, readonly Entry[]> = {};
  for (const view of initial) entries[view.stepPosition] = okTiles(view.photos);
  return entries;
}

/** Las fotos del servidor sustituyen a las contadas; lo que sigue en vuelo o en error se queda. */
function withServerPhotos(
  entries: readonly Entry[],
  photos: readonly StepEvidencePhotoView[],
  settledId: string | null,
): Entry[] {
  const pending = entries.filter(
    (entry) => entry.tile.status !== 'ok' && entry.tile.id !== settledId,
  );
  return [...okTiles(photos), ...pending];
}

export function useStepEvidence({
  orderId,
  phase,
  steps,
  initial,
}: UseStepEvidenceOptions): StepEvidenceController {
  const [entries, setEntries] = useState<EntriesByStep>(() => initialEntries(initial));
  const localSeq = useRef(0);
  const removing = useRef(new Set<string>());

  function nextLocalId(): string {
    localSeq.current += 1;
    return `local-${localSeq.current}`;
  }

  function update(position: number, change: (current: readonly Entry[]) => readonly Entry[]) {
    setEntries((previous) => ({ ...previous, [position]: change(previous[position] ?? []) }));
  }

  function errorEntry(message: string): Entry {
    return { tile: { id: nextLocalId(), status: 'error', message } };
  }

  async function upload(position: number, file: File, localId: string, replaces?: OkTile) {
    const result = await uploadEvidence(
      file,
      {
        orderId,
        phase,
        stepPosition: position,
        ...(replaces === undefined ? {} : { replacesEvidenceId: replaces.id }),
      },
      {
        requestUpload: requestEvidenceUploadAction,
        register: registerEvidenceAction,
        onProgress: (percent) =>
          update(position, (current) =>
            current.map((entry) =>
              entry.tile.id === localId
                ? { tile: { id: localId, status: 'uploading', percent } }
                : entry,
            ),
          ),
      },
    );

    if (result.status === 'success') {
      update(position, (current) => withServerPhotos(current, result.photos, localId));
      return;
    }

    update(position, (current) => {
      if (replaces === undefined) {
        return current.map((entry) =>
          entry.tile.id === localId
            ? { tile: { id: localId, status: 'error', message: result.message } }
            : entry,
        );
      }
      // La foto que se quería cambiar sigue contando en el servidor: vuelve a su sitio.
      const restored = current.map((entry) =>
        entry.tile.id === localId ? { tile: replaces } : entry,
      );
      return [...restored, errorEntry(result.message)];
    });
  }

  function handleAdd(position: number, file: File) {
    const localId = nextLocalId();
    update(position, (current) => [
      ...current,
      { tile: { id: localId, status: 'uploading', percent: 0 } },
    ]);
    void upload(position, file, localId);
  }

  function handleChange(position: number, id: string, file: File) {
    const target = (entries[position] ?? []).find((entry) => entry.tile.id === id)?.tile;
    if (target === undefined || target.status !== 'ok') return;
    const localId = nextLocalId();
    update(position, (current) =>
      current.map((entry) =>
        entry.tile.id === id
          ? { tile: { id: localId, status: 'uploading', percent: 0 } }
          : entry,
      ),
    );
    void upload(position, file, localId, target);
  }

  async function handleRemove(position: number, id: string) {
    const target = (entries[position] ?? []).find((entry) => entry.tile.id === id)?.tile;
    if (target === undefined) return;
    if (target.status !== 'ok') {
      update(position, (current) => current.filter((entry) => entry.tile.id !== id));
      return;
    }
    if (removing.current.has(id)) return;
    removing.current.add(id);
    try {
      const result = await removeEvidenceAction({ orderId, phase, evidenceId: id });
      if (result.status === 'success') {
        update(position, (current) => withServerPhotos(current, result.data.photos, null));
      } else {
        update(position, (current) => [...current, errorEntry(result.message)]);
      }
    } catch {
      update(position, (current) => [...current, errorEntry(UNEXPECTED_MESSAGE)]);
    } finally {
      removing.current.delete(id);
    }
  }

  function tilesOf(position: number): StepEvidenceTile[] {
    return (entries[position] ?? []).map((entry) => entry.tile);
  }

  return {
    hasEvidenceSteps: steps.some((step) => step.requiresEvidence === true),
    renderStepAddon: (position) =>
      stepRequiresEvidence(steps, position) ? (
        <StepEvidence
          stepPosition={position}
          photos={tilesOf(position)}
          onAdd={(file) => handleAdd(position, file)}
          onChange={(id, file) => handleChange(position, id, file)}
          onRemove={(id) => void handleRemove(position, id)}
        />
      ) : null,
    stepBlockReason: (position) => {
      const tiles = tilesOf(position);
      if (tiles.some((tile) => tile.status === 'uploading')) {
        return STEP_EVIDENCE_TEXTS.uploadingReason;
      }
      if (stepRequiresEvidence(steps, position) && !tiles.some((tile) => tile.status === 'ok')) {
        return STEP_EVIDENCE_TEXTS.missingReason;
      }
      return null;
    },
    missingPositions: () =>
      missingEvidencePositions(
        steps,
        Object.entries(entries)
          .filter(([, list]) => list.some((entry) => entry.tile.status === 'ok'))
          .map(([position]) => ({ stepPosition: Number(position) })),
      ),
  };
}
