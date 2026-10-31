import { requireAgentConfigurePermission, type Actor } from './actor';
import { ValidationError } from './errors';
import { scopeOf } from './integraciones-scope';
import { saveWhatsappAgentSettingsSchema, type WhatsappAgentSettings } from './whatsapp-agent-settings';

import type { WhatsappAgentSettingsRepository } from '../ports/whatsapp-agent-settings-repository';

export type SaveWhatsappAgentSettingsDeps = {
  readonly agentSettings: WhatsappAgentSettingsRepository;
  readonly now?: () => Date;
};

export type SaveWhatsappAgentSettings = (input: unknown, actor: Actor | null | undefined) => Promise<void>;

export function createSaveWhatsappAgentSettings(deps: SaveWhatsappAgentSettingsDeps): SaveWhatsappAgentSettings {
  const now = deps.now ?? (() => new Date());

  return async function saveWhatsappAgentSettings(input, actor) {
    requireAgentConfigurePermission(actor);
    const scope = scopeOf(actor);

    const parsed = saveWhatsappAgentSettingsSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.path.join('.')).join(','));
    }

    const settings: WhatsappAgentSettings = parsed.data;
    await deps.agentSettings.save(settings, actor.id, now(), scope);
  };
}
