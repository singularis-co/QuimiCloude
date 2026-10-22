import { pdfStrategySchema, type PdfStrategy } from '@/lib/modules/documentos';

/**
 * La MEMORIA de tandas: los batchIds que este navegador ya encolo, con la estrategia de cada uno.
 * Vive en `localStorage` para sobrevivir a cerrar la ventana y a navegar dentro de la app, y en
 * memoria para que quien este montado se entere en el acto.
 */
export const REMEMBERED_BATCHES_STORAGE_KEY = 'document-upload-remembered-batches';

/** Tope del registro: mas alla, se descartan las tandas mas viejas. */
export const MAX_REMEMBERED_BATCHES = 20;

export type RememberedBatch = {
  readonly batchId: string;
  readonly strategy: PdfStrategy;
  readonly rememberedAt: number;
};

const EMPTY: readonly RememberedBatch[] = [];

let current: readonly RememberedBatch[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

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

/**
 * Lo guardado puede venir de una version vieja de la propia pieza o estar corrupto: se conservan
 * solo las entradas que siguen teniendo la forma de una tanda recordada.
 */
function sanitize(parsed: unknown): readonly RememberedBatch[] {
  if (!Array.isArray(parsed)) return EMPTY;
  return parsed.filter(isRememberedBatch);
}

function ensureHydrated(): void {
  if (hydrated) return;
  hydrated = true;
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(REMEMBERED_BATCHES_STORAGE_KEY);
    if (raw !== null) current = sanitize(JSON.parse(raw));
  } catch {
    // Registro ilegible: arrancar vacio es lo unico seguro, y la memoria de la sesion sigue viva.
  }
}

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(REMEMBERED_BATCHES_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Almacenamiento bloqueado o lleno (p. ej. modo privado): la sesion pierde la continuidad
    // entre pantallas, no la lista viva.
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** Las tandas recordadas, la mas reciente primero. */
export function rememberedBatches(): readonly RememberedBatch[] {
  ensureHydrated();
  return current;
}

/** Recuerda una tanda: la pone la primera y recorta el registro a su tope. */
export function rememberBatch(batchId: string, strategy: PdfStrategy): void {
  ensureHydrated();
  const rest = current.filter((batch) => batch.batchId !== batchId);
  current = [{ batchId, strategy, rememberedAt: Date.now() }, ...rest].slice(
    0,
    MAX_REMEMBERED_BATCHES,
  );
  persist();
  notify();
}

/** Quita una tanda del registro; no pasa nada si ya no estaba. */
export function forgetBatch(batchId: string): void {
  ensureHydrated();
  if (!current.some((batch) => batch.batchId === batchId)) return;
  current = current.filter((batch) => batch.batchId !== batchId);
  persist();
  notify();
}

/** Aviso de que el registro cambio; devuelve como deshacerse del aviso. */
export function onRememberedBatchesChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}