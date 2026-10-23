'use client';

import { BracesIcon, PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import type { DisplayDictionaryEntry } from './whatsapp-template-rules';

export const WHATSAPP_VARIABLE_MENU_TRIGGER_TESTID = 'whatsapp-variable-menu-trigger';
export const WHATSAPP_VARIABLE_MENU_HINT_TESTID = 'whatsapp-variable-menu-hint';
export const WHATSAPP_VARIABLE_MENU_GROUP_TESTID = (kind: DisplayDictionaryEntry['kind']) =>
  `whatsapp-variable-menu-group-${kind}`;
export const WHATSAPP_VARIABLE_MENU_ITEM_TESTID = (key: string) => `whatsapp-variable-menu-item-${key}`;
export const WHATSAPP_VARIABLE_MENU_NEW_TESTID = 'whatsapp-variable-menu-new';

export const WHATSAPP_VARIABLE_MENU_TEXTS = {
  trigger: 'Insertar variable',
  hintStart: 'Se escribe como ',
  hintKey: '{{clave}}',
  hintEnd: '.',
  systemGroup: 'Constantes del sistema',
  ownGroup: 'Variables propias',
  newVariable: 'Nueva variable propia',
} as const;

const ITEM_CLASS = 'min-h-11 text-base md:text-sm';

export type WhatsappTemplateVariableMenuProps = {
  /** Constantes y propias ya juntas (`dictionaryOf`): el menú pinta lo que recibe. */
  readonly dictionary: readonly DisplayDictionaryEntry[];
  /** Recibe la clave de pantalla elegida, sin llaves. */
  readonly onInsert: (key: string) => void;
  /** Sin él, «Nueva variable propia» se ve deshabilitada. */
  readonly onCreateVariable?: () => void;
  readonly disabled?: boolean;
};

function EntryItem({ entry, onInsert }: { readonly entry: DisplayDictionaryEntry; readonly onInsert: (key: string) => void }) {
  return (
    <DropdownMenuItem
      className={ITEM_CLASS}
      data-testid={WHATSAPP_VARIABLE_MENU_ITEM_TESTID(entry.key)}
      onClick={() => onInsert(entry.key)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span className="truncate">{entry.label}</span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{entry.key}</span>
      </span>
    </DropdownMenuItem>
  );
}

export function WhatsappTemplateVariableMenu({
  dictionary,
  onInsert,
  onCreateVariable,
  disabled = false,
}: WhatsappTemplateVariableMenuProps) {
  const system = dictionary.filter((entry) => entry.kind === 'system');
  const own = dictionary.filter((entry) => entry.kind === 'company');

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          render={
            <Button
              type="button"
              variant="outline"
              touch
              data-testid={WHATSAPP_VARIABLE_MENU_TRIGGER_TESTID}
            />
          }
        >
          <BracesIcon aria-hidden="true" />
          {WHATSAPP_VARIABLE_MENU_TEXTS.trigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start" className="w-auto min-w-[280px]">
          <DropdownMenuGroup data-testid={WHATSAPP_VARIABLE_MENU_GROUP_TESTID('system')}>
            <DropdownMenuLabel>{WHATSAPP_VARIABLE_MENU_TEXTS.systemGroup}</DropdownMenuLabel>
            {system.map((entry) => (
              <EntryItem key={entry.key} entry={entry} onInsert={onInsert} />
            ))}
          </DropdownMenuGroup>
          {own.length === 0 ? null : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup data-testid={WHATSAPP_VARIABLE_MENU_GROUP_TESTID('company')}>
                <DropdownMenuLabel>{WHATSAPP_VARIABLE_MENU_TEXTS.ownGroup}</DropdownMenuLabel>
                {own.map((entry) => (
                  <EntryItem key={entry.key} entry={entry} onInsert={onInsert} />
                ))}
              </DropdownMenuGroup>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={cn(ITEM_CLASS, 'font-medium')}
            disabled={onCreateVariable === undefined}
            data-testid={WHATSAPP_VARIABLE_MENU_NEW_TESTID}
            onClick={() => onCreateVariable?.()}
          >
            <PlusIcon aria-hidden="true" />
            {WHATSAPP_VARIABLE_MENU_TEXTS.newVariable}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-sm text-muted-foreground" data-testid={WHATSAPP_VARIABLE_MENU_HINT_TESTID}>
        {WHATSAPP_VARIABLE_MENU_TEXTS.hintStart}
        <span className="font-mono">{WHATSAPP_VARIABLE_MENU_TEXTS.hintKey}</span>
        {WHATSAPP_VARIABLE_MENU_TEXTS.hintEnd}
      </span>
    </div>
  );
}
