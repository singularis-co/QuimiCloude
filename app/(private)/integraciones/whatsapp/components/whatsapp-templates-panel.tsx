'use client';

import type { WhatsappDictionaryEntryView, WhatsappTemplateList } from '@/lib/modules/integraciones';

export const WHATSAPP_TEMPLATES_PANEL_TESTID = 'whatsapp-templates-panel';

export type WhatsappTemplatesPanelProps = {
  readonly list: WhatsappTemplateList;
  /** `null` si la carga del diccionario falló: la pestaña de plantillas sigue funcionando. */
  readonly dictionary: readonly WhatsappDictionaryEntryView[] | null;
};

export function WhatsappTemplatesPanel({ list }: WhatsappTemplatesPanelProps) {
  return (
    <section
      data-testid={WHATSAPP_TEMPLATES_PANEL_TESTID}
      data-count={list.templates.length}
      className="flex flex-col gap-4"
    />
  );
}
