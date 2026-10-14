/**
 * La clasificacion de un fallo del trabajo en REINTENTABLE o DEFINITIVO, en un solo sitio: quien
 * decide como responder a la cola consulta esto y nada mas.
 *
 * `ProcessingFailureCode` acota los codigos que pueden salir del procesamiento de un PDF, y el
 * `Record` no compila si alguno queda sin clasificar.
 *
 * La descarga del bucket falla ANTES de producir un `ErrorCode` propio de este modulo —el puerto
 * la lanza tal cual—, y por eso tiene su propia constante en vez de pasar por el mapa de codigos.
 */
import type { ErrorCode } from '@/lib/modules/errores';

export type FailureKind = 'retryable' | 'definitive';

type ProcessingFailureCode = Extract<
  ErrorCode,
  'ai_unavailable' | 'unexpected' | 'invalid_input' | 'ai_provider_missing' | 'ai_provider_error'
>;

// Sin conexión o con la cuenta rechazada, reintentar no mejora nada y vuelve a rasterizar el PDF.
const KIND_BY_PROCESSING_CODE: Record<ProcessingFailureCode, FailureKind> = {
  ai_unavailable: 'retryable',
  unexpected: 'definitive',
  invalid_input: 'definitive',
  ai_provider_missing: 'definitive',
  ai_provider_error: 'definitive',
};

function isProcessingFailureCode(code: ErrorCode): code is ProcessingFailureCode {
  return code in KIND_BY_PROCESSING_CODE;
}

/**
 * Clasifica un `ErrorCode` que salio del procesamiento de un PDF. Un codigo fuera de los
 * conocidos se trata como definitivo: reintentar algo que no se sabe interpretar no mejora nada.
 */
export function failureKind(code: ErrorCode): FailureKind {
  return isProcessingFailureCode(code) ? KIND_BY_PROCESSING_CODE[code] : 'definitive';
}

/** La descarga del bucket SIEMPRE admite otro intento: un corte de almacenamiento mejora esperando. */
export const STORAGE_FAILURE_KIND: FailureKind = 'retryable';
