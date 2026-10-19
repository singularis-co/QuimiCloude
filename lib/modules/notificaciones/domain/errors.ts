import { errorMessage, type ErrorCode } from '@/lib/modules/errores';

export abstract class NotificacionesError extends Error {
  abstract readonly code: ErrorCode;

  /** Va al registro del servidor, nunca al navegador. */
  readonly diagnostic?: string;

  constructor(code: ErrorCode, diagnostic?: string) {
    super(errorMessage(code));
    this.diagnostic = diagnostic;
    this.name = new.target.name;
    // Sin esto `instanceof` falla en los targets que no extienden `Error` de forma nativa.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends NotificacionesError {
  readonly code = 'invalid_input';

  constructor(diagnostic?: string) {
    super('invalid_input', diagnostic);
  }
}
