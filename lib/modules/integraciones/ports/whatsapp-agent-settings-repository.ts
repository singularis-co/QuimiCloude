import type { IntegracionesScope } from '../domain/integraciones-scope';
import type { WhatsappAgentSettings } from '../domain/whatsapp-agent-settings';

/**
 * Solo la configuración de la empresa de `scope`, que va al final de cada firma: una llamada que
 * lo omita no compila. `null` es «la empresa nunca la guardó».
 */
export interface WhatsappAgentSettingsRepository {
  find(scope: IntegracionesScope): Promise<WhatsappAgentSettings | null>;
  /** Reemplaza todos los campos; dos guardados a la vez de la misma empresa dejan una sola fila. */
  save(settings: WhatsappAgentSettings, by: string, at: Date, scope: IntegracionesScope): Promise<void>;
}
