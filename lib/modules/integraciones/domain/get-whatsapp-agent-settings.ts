import { requireAgentReadPermission, type Actor } from './actor';
import { scopeOf } from './integraciones-scope';
import { WHATSAPP_AGENT_DEFAULTS, type WhatsappAgentSettings } from './whatsapp-agent-settings';

import type { WhatsappAgentSettingsRepository } from '../ports/whatsapp-agent-settings-repository';

export type GetWhatsappAgentSettingsDeps = {
  readonly agentSettings: WhatsappAgentSettingsRepository;
};

export type GetWhatsappAgentSettings = (actor: Actor | null | undefined) => Promise<WhatsappAgentSettings>;

export function createGetWhatsappAgentSettings(deps: GetWhatsappAgentSettingsDeps): GetWhatsappAgentSettings {
  return async function getWhatsappAgentSettings(actor) {
    requireAgentReadPermission(actor);
    const saved = await deps.agentSettings.find(scopeOf(actor));
    return saved ?? WHATSAPP_AGENT_DEFAULTS;
  };
}
