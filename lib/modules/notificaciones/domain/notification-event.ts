/** Lo que un módulo emite. `payload` se valida contra el esquema de su entrada del catálogo. */
export type NotificationEvent = {
  readonly key: string;
  readonly companyId: string;
  /** Única por empresa: el mismo evento emitido dos veces deja un solo aviso. */
  readonly dedupeKey: string;
  readonly payload: unknown;
};
