import type { Customer } from './customer';

/** Las cuatro columnas del telefono tal como se escriben. Escribirlas nunca deja un aviso. */
export type CustomerPhoneColumns = Pick<Customer, 'phone' | 'phoneCountry' | 'phoneE164'> & {
  readonly phoneIssue: null;
};

/**
 * Edicion con el numero vacio: si la fila tiene un telefono antiguo con aviso se conserva tal
 * cual, y si no, se borra. Lo decide el adaptador con la fila bloqueada, no la pantalla.
 */
export type KeepLegacyOrClearPhone = { readonly kind: 'keep_legacy_or_clear' };

export type NewCustomerPhone = CustomerPhoneColumns | KeepLegacyOrClearPhone;

/**
 * Datos de negocio de un cliente, ya validados por `customer-input.ts` y listos para el
 * puerto. Las tres formas normalizadas las calcula el caso de uso con `normalizeCustomerText`
 * y viajan emparejadas con su dato: el puerto solo las escribe, no las recalcula.
 */
export type NewCustomer = Pick<Customer, 'firstNames' | 'lastNames' | 'city' | 'email' | 'address'> & {
  readonly phone: NewCustomerPhone;
  readonly firstNamesNormalized: string;
  readonly lastNamesNormalized: string;
  readonly cityNormalized: string;
};

/**
 * Salida de una consulta de cliente. `companyId` no sale (quien pregunta ya es de esa empresa)
 * y `deletedAt` tampoco (toda consulta excluye los dados de baja). Las formas normalizadas
 * tampoco salen: son derivadas para buscar, no un dato de negocio.
 */
export type CustomerView = Omit<Customer, 'companyId' | 'deletedAt'>;
