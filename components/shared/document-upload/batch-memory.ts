import { pdfStrategySchema, type PdfStrategy } from '@/lib/modules/documentos';

/**
 * La clave de antes, sin ámbito, y el prefijo de la de cada ámbito
 * (`<prefijo>:<userId>:<companyId>`).
 */
export const REMEMBERED_BATCHES_STORAGE_KEY = 'document-upload-remembered-batches';

export const MAX_REMEMBERED_BATCHES = 20;

export type RememberedBatch = {
  readonly batchId: string;
  readonly strategy: PdfStrategy;
  readonly rememberedAt: number;
};

type Batches = readonly RememberedBatch[];

const EMPTY: Batches = [];

const snapshots = new Map<string, Batches>();
const listeners = new Map<string, Set<() => void>>();
const detached = new Set<string>();
let legacyCleared = false;
let listening = false;

const keyFor = (scope: string): string => `${REMEMBERED_BATCHES_STORAGE_KEY}:${scope}`;

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRememberedBatch(value: unknown): value is RememberedBatch {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.batchId === 'string' &&
    candidate.batchId !== '' &&
    pdfStrategySchema.safeParse(candidate.strategy).success &&
    typeof candidate.rememberedAt === 'number'
  );
}

function toRememberedBatch({ batchId, strategy, rememberedAt }: RememberedBatch): RememberedBatch {
  return { batchId, strategy, rememberedAt };
}

/** `null` cuando el navegador no deja leer: quien llama decide con qué seguir. */
function readStored(scope: string): Batches | null {
  const store = storage();
  if (store === null) return null;
  let raw: string | null;
  try {
    raw = store.getItem(keyFor(scope));
  } catch {
    return null;
  }
  if (raw === null) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRememberedBatch).map(toRememberedBatch) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeStored(scope: string, batches: Batches): boolean {
  const store = storage();
  if (store === null) return false;
  try {
    store.setItem(keyFor(scope), JSON.stringify(batches));
    return true;
  } catch {
    return false;
  }
}

function clearLegacyKey(): void {
  if (legacyCleared) return;
  const store = storage();
  if (store === null) return;
  legacyCleared = true;
  try {
    store.removeItem(REMEMBERED_BATCHES_STORAGE_KEY);
  } catch {
    legacyCleared = false;
  }
}

function sameBatches(a: Batches, b: Batches): boolean {
  return (
    a.length === b.length &&
    a.every(
      (batch, index) =>
        batch.batchId === b[index]?.batchId &&
        batch.strategy === b[index]?.strategy &&
        batch.rememberedAt === b[index]?.rememberedAt,
    )
  );
}

function notify(scope: string): void {
  for (const listener of listeners.get(scope) ?? []) listener();
}

function replace(scope: string, next: Batches): void {
  const before = snapshots.get(scope);
  if (before !== undefined && sameBatches(before, next)) return;
  snapshots.set(scope, next);
  notify(scope);
}

/**
 * Con la escritura rechazada, lo guardado ya no es la verdad: la sesión sigue con su copia en
 * memoria hasta que una escritura vuelva a entrar.
 */
function update(scope: string, change: (batches: Batches) => Batches): void {
  const current = rememberedBatches(scope);
  const base = detached.has(scope) ? current : (readStored(scope) ?? current);
  const next = change(base);
  if (writeStored(scope, next)) detached.delete(scope);
  else detached.add(scope);
  replace(scope, next);
}

function onStorage(event: StorageEvent): void {
  for (const scope of listeners.keys()) {
    if (event.key !== null && event.key !== keyFor(scope)) continue;
    if (detached.has(scope)) continue;
    const stored = readStored(scope);
    if (stored !== null) replace(scope, stored);
  }
}

/** Las tandas del ámbito, la más reciente primero. La referencia solo cambia al mutar. */
export function rememberedBatches(scope: string): Batches {
  const cached = snapshots.get(scope);
  if (cached !== undefined) return cached;
  if (storage() === null) return EMPTY;
  clearLegacyKey();
  const hydrated = readStored(scope) ?? EMPTY;
  snapshots.set(scope, hydrated);
  return hydrated;
}

export function rememberBatch(scope: string, batchId: string, strategy: PdfStrategy): void {
  update(scope, (batches) =>
    [
      { batchId, strategy, rememberedAt: Date.now() },
      ...batches.filter((batch) => batch.batchId !== batchId),
    ].slice(0, MAX_REMEMBERED_BATCHES),
  );
}

export function forgetBatch(scope: string, batchId: string): void {
  update(scope, (batches) => batches.filter((batch) => batch.batchId !== batchId));
}

/** Avisa cuando cambia el registro del ámbito, también desde otra pestaña. */
export function onRememberedBatchesChange(scope: string, listener: () => void): () => void {
  const ofScope = listeners.get(scope) ?? new Set<() => void>();
  ofScope.add(listener);
  listeners.set(scope, ofScope);
  if (!listening && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
    listening = true;
  }

  return () => {
    ofScope.delete(listener);
    if (ofScope.size === 0) {
      listeners.delete(scope);
      // Sin oyentes, nadie atiende el evento `storage`: la próxima lectura vuelve a hidratar.
      if (!detached.has(scope)) snapshots.delete(scope);
    }
    if (listeners.size === 0 && listening) {
      window.removeEventListener('storage', onStorage);
      listening = false;
    }
  };
}
