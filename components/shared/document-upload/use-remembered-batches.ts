'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { PdfStrategy } from '@/lib/modules/documentos';

import {
  onRememberedBatchesChange,
  rememberedBatches,
  type RememberedBatch,
} from './batch-memory';

const EMPTY: readonly RememberedBatch[] = [];

const serverSnapshot = (): readonly RememberedBatch[] => EMPTY;

/** Las tandas recordadas de una estrategia en el ámbito. El servidor no pinta ninguna. */
export function useRememberedBatches(
  scope: string,
  strategy: PdfStrategy,
): readonly RememberedBatch[] {
  const subscribe = useCallback(
    (onChange: () => void) => onRememberedBatchesChange(scope, onChange),
    [scope],
  );
  const clientSnapshot = useCallback(() => rememberedBatches(scope), [scope]);
  const all = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return useMemo(
    () => all.filter((batch) => batch.strategy === strategy),
    [all, strategy],
  );
}
