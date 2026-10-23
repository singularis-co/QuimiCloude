import type { IntegracionesScope } from '../domain/integraciones-scope';
import type { WhatsappVariableKeyInput, WhatsappVariableKeyRecord } from '../domain/whatsapp-variable-key';

/** `usedBy`: plantillas vivas distintas con alguna relación a esta variable. */
export type WhatsappVariableKeyWithUsage = WhatsappVariableKeyRecord & { readonly usedBy: number };

export type WhatsappVariableKeyUpdateResult =
  | { readonly kind: 'updated'; readonly record: WhatsappVariableKeyRecord }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'in_use' };

export type WhatsappVariableKeyDeleteResult = 'deleted' | 'not_found' | 'in_use';

/**
 * Solo las variables propias de la empresa de `scope`; una de otra empresa es igual que una
 * inexistente. `scope` va al final de cada firma: una llamada que lo omita no compila.
 */
export interface WhatsappVariableKeyRepository {
  /** Ordenadas por clave. */
  listAll(scope: IntegracionesScope): Promise<readonly WhatsappVariableKeyRecord[]>;
  /** Ordenadas por clave. */
  listWithUsage(scope: IntegracionesScope): Promise<readonly WhatsappVariableKeyWithUsage[]>;
  findByKeys(keys: readonly string[], scope: IntegracionesScope): Promise<readonly WhatsappVariableKeyRecord[]>;
  /** Otra con la misma clave en la empresa lanza `WhatsappVariableKeyTakenError`. */
  create(input: WhatsappVariableKeyInput, scope: IntegracionesScope): Promise<WhatsappVariableKeyRecord>;
  /**
   * `in_use` solo si la clave cambia y la usa una plantilla viva; etiqueta y valor se guardan
   * siempre. Otra con la clave nueva lanza `WhatsappVariableKeyTakenError`.
   */
  update(id: string, input: WhatsappVariableKeyInput, scope: IntegracionesScope): Promise<WhatsappVariableKeyUpdateResult>;
  delete(id: string, scope: IntegracionesScope): Promise<WhatsappVariableKeyDeleteResult>;
}
