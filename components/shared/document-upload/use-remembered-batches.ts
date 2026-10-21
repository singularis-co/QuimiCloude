'use client';

import { useMemo, useSyncExternalStore } from 'react';

import type { PdfStrategy } from '@/lib/modules/documentos';

import {
  onRememberedBatchesChange,
  rememberedBatches,
  type RememberedBatch,
} from './batch-memory';

const EMPTY: readonly RememberedBatch[] = [];

/**
 * Las tandas recordadas de UNA estrategia. El servidor no pinta nada: la foto inicial es la del
 * render del cliente, y a partir de ahi manda la suscripcion al registro.
 */
export function useRememberedBatches(strategy: PdfStrategy): readonly RememberedBatch[] {
  const all = useSyncExternalStore(onRememberedBatchesChange, rememberedBatches, () => EMPTY);
  return useMemo(
    () => all.filter((batch) => batch.strategy === strategy),
    [all, strategy],
  );
}