import { errorMessage, UNEXPECTED_ERROR_CODE, type ErrorState } from '@/lib/modules/errores';
import { newRequestId } from '@/lib/modules/observabilidad';

/** Una Server Action que no llega a responder (red caída) se pinta como cualquier error inesperado. */
export function unexpectedFromRejection(): ErrorState {
  return {
    status: 'error',
    code: UNEXPECTED_ERROR_CODE,
    message: errorMessage(UNEXPECTED_ERROR_CODE),
    reference: newRequestId(),
  };
}

export async function settleAction<T>(request: () => Promise<T>): Promise<T | ErrorState> {
  try {
    return await request();
  } catch {
    return unexpectedFromRejection();
  }
}
