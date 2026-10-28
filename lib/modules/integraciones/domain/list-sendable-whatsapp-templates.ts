import { requireReadPermission, type Actor } from './actor';
import { scopeOf } from './integraciones-scope';
import { ownKeyIndexOf, toWhatsappTemplateView } from './list-whatsapp-templates';
import type { WhatsappSendableTemplate, WhatsappSendableTemplateVariable } from './whatsapp-conversation';
import { isSendable } from './whatsapp-template-message';

import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappTemplateRepository } from '../ports/whatsapp-template-repository';
import type { WhatsappVariableKeyRepository } from '../ports/whatsapp-variable-key-repository';

export type ListSendableWhatsappTemplatesDeps = {
  readonly connections: Pick<WhatsappConnectionRepository, 'findLive'>;
  readonly templates: Pick<WhatsappTemplateRepository, 'listLive'>;
  readonly variableKeys: Pick<WhatsappVariableKeyRepository, 'listAll'>;
};

export type WhatsappSendableTemplateList = { readonly templates: readonly WhatsappSendableTemplate[] };

/**
 * Las variables propias llevan su valor guardado porque el envío lo pone solo; las constantes no,
 * su valor sale del contexto del chat. Una plantilla enviable está mapeada y una variable propia en
 * uso no se puede borrar, así que un hueco sin clave no debería llegar aquí; si llega, se omite.
 */
export function createListSendableWhatsappTemplates(
  deps: ListSendableWhatsappTemplatesDeps,
): (actor: Actor | null | undefined) => Promise<WhatsappSendableTemplateList> {
  return async function listSendableWhatsappTemplates(actor) {
    requireReadPermission(actor);
    const scope = scopeOf(actor);

    const connection = await deps.connections.findLive(scope);
    if (connection === null) return { templates: [] };

    const records = (await deps.templates.listLive(connection.id, { onlyApproved: true }, scope)).filter(isSendable);
    if (records.length === 0) return { templates: [] };
    const ownRecords = await deps.variableKeys.listAll(scope);
    const ownKeys = ownKeyIndexOf(ownRecords);
    const ownValues = new Map(ownRecords.map((record) => [record.key, record.value]));

    const templates = records.flatMap((record): WhatsappSendableTemplate[] => {
      const view = toWhatsappTemplateView(record, ownKeys);
      if (view.content === null) return [];
      const variables = view.variables.flatMap((variable): WhatsappSendableTemplateVariable[] => {
        if (variable.kind === null || variable.key === null) return [];
        const own = variable.kind === 'company';
        return [
          {
            slot: variable.slot,
            position: variable.position,
            kind: variable.kind,
            key: variable.key,
            label: own ? variable.label : null,
            value: own ? (ownValues.get(variable.key) ?? null) : null,
          },
        ];
      });
      return [
        {
          id: view.id,
          name: view.name,
          language: view.language,
          category: view.category,
          content: view.content,
          variables,
        },
      ];
    });
    return { templates };
  };
}
