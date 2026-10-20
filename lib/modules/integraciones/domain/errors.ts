import { errorMessage, type ErrorCode } from '@/lib/modules/errores';

export abstract class IntegracionesError extends Error {
  abstract readonly code: ErrorCode;

  /** Solo para el log del servidor: nunca lleva el texto en claro, una clave ni el valor guardado. */
  readonly diagnostic?: string;

  constructor(code: ErrorCode, diagnostic?: string) {
    super(errorMessage(code));
    this.diagnostic = diagnostic;
    this.name = new.target.name;
    // Sin esto, al compilar a un target que no extiende `Error` de forma nativa, `instanceof` falla.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Un solo error para cualquier fallo al descifrar: forma, versión, tag o contexto. Para quien lo
 * recibe la acción es siempre la misma, volver a escribir el secreto.
 */
export class SecretUnreadableError extends IntegracionesError {
  readonly code = 'integration_secret_unreadable';

  constructor(diagnostic?: string) {
    super('integration_secret_unreadable', diagnostic);
  }
}

export class ValidationError extends IntegracionesError {
  readonly code = 'invalid_input';

  constructor(diagnostic?: string) {
    super('invalid_input', diagnostic);
  }
}

export class UnauthorizedError extends IntegracionesError {
  readonly code = 'unauthorized';

  constructor(diagnostic?: string) {
    super('unauthorized', diagnostic);
  }
}

/** La conexión no existe, está borrada o es de otra empresa: el texto no distingue los tres casos. */
export class WhatsappConnectionNotFoundError extends IntegracionesError {
  readonly code = 'whatsapp_connection_not_found';

  constructor(diagnostic?: string) {
    super('whatsapp_connection_not_found', diagnostic);
  }
}

export class WhatsappConnectionExistsError extends IntegracionesError {
  readonly code = 'whatsapp_connection_exists';

  constructor(diagnostic?: string) {
    super('whatsapp_connection_exists', diagnostic);
  }
}

/** El texto no nombra a la empresa dueña del número: sería una fuga entre empresas. */
export class WhatsappPhoneNumberTakenError extends IntegracionesError {
  readonly code = 'whatsapp_phone_number_taken';

  constructor(diagnostic?: string) {
    super('whatsapp_phone_number_taken', diagnostic);
  }
}

export class ActionNotAllowedError extends IntegracionesError {
  readonly code = 'action_not_allowed';

  constructor(diagnostic?: string) {
    super('action_not_allowed', diagnostic);
  }
}

/** El contacto no existe o es de otra empresa: el texto no distingue los dos casos. */
export class WhatsappContactNotFoundError extends IntegracionesError {
  readonly code = 'whatsapp_contact_not_found';

  constructor(diagnostic?: string) {
    super('whatsapp_contact_not_found', diagnostic);
  }
}

/** Ninguna variante del número del contacto es un teléfono válido: no hay qué añadir al cliente. */
export class WhatsappContactNumberInvalidError extends IntegracionesError {
  readonly code = 'whatsapp_contact_number_invalid';

  constructor(diagnostic?: string) {
    super('whatsapp_contact_number_invalid', diagnostic);
  }
}

/** Con el código de `clientes`, pero subclase de este módulo para que su traductor la reconozca. */
export class LinkedCustomerNotFoundError extends IntegracionesError {
  readonly code = 'customer_not_found';

  constructor(diagnostic?: string) {
    super('customer_not_found', diagnostic);
  }
}

/** La plantilla no existe, está eliminada o es de otra empresa: el texto no distingue los tres casos. */
export class WhatsappTemplateNotFoundError extends IntegracionesError {
  readonly code = 'whatsapp_template_not_found';

  constructor(diagnostic?: string) {
    super('whatsapp_template_not_found', diagnostic);
  }
}

export class WhatsappTemplateNameTakenError extends IntegracionesError {
  readonly code = 'whatsapp_template_name_taken';

  constructor(diagnostic?: string) {
    super('whatsapp_template_name_taken', diagnostic);
  }
}

export class WhatsappTemplateRateLimitedError extends IntegracionesError {
  readonly code = 'whatsapp_template_rate_limited';

  constructor(diagnostic?: string) {
    super('whatsapp_template_rate_limited', diagnostic);
  }
}

export class WhatsappTemplateRejectedError extends IntegracionesError {
  readonly code = 'whatsapp_template_rejected';

  constructor(diagnostic?: string) {
    super('whatsapp_template_rejected', diagnostic);
  }
}

export class WhatsappMetaRejectedError extends IntegracionesError {
  readonly code = 'whatsapp_meta_rejected';

  constructor(diagnostic?: string) {
    super('whatsapp_meta_rejected', diagnostic);
  }
}

export class WhatsappMetaUnreachableError extends IntegracionesError {
  readonly code = 'whatsapp_meta_unreachable';

  constructor(diagnostic?: string) {
    super('whatsapp_meta_unreachable', diagnostic);
  }
}
