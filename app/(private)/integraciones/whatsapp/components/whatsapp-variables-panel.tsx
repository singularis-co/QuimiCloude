'use client';

import type { WhatsappDictionaryEntryView } from '@/lib/modules/integraciones';

export const WHATSAPP_VARIABLES_PANEL_TESTID = 'whatsapp-variables-panel';

export type WhatsappVariablesPanelProps = {
  readonly entries: readonly WhatsappDictionaryEntryView[];
  readonly hasConnection: boolean;
};

export function WhatsappVariablesPanel({ entries }: WhatsappVariablesPanelProps) {
  return (
    <section
      data-testid={WHATSAPP_VARIABLES_PANEL_TESTID}
      data-count={entries.length}
      className="flex flex-col gap-4"
    />
  );
}
