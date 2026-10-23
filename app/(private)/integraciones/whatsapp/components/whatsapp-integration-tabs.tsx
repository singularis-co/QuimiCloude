'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { ErrorState } from '@/components/shared/error-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ErrorState as OperationError } from '@/lib/modules/errores';
import type { WhatsappDictionaryEntryView, WhatsappTemplateList } from '@/lib/modules/integraciones';

import { WhatsappTemplatesPanel } from './whatsapp-templates-panel';
import { WhatsappVariablesPanel } from './whatsapp-variables-panel';
import { WhatsappVerifyTokenProvider } from './whatsapp-webhook-panel';

export const WHATSAPP_TABS_TESTID = 'whatsapp-integration-tabs';
export const WHATSAPP_TAB_CONNECTION_TESTID = 'whatsapp-tab-connection';
export const WHATSAPP_TAB_TEMPLATES_TESTID = 'whatsapp-tab-templates';
export const WHATSAPP_TAB_VARIABLES_TESTID = 'whatsapp-tab-variables';
export const WHATSAPP_CONNECTION_PANEL_TESTID = 'whatsapp-connection-panel';
export const WHATSAPP_TEMPLATES_TAB_PANEL_TESTID = 'whatsapp-templates-tab-panel';
export const WHATSAPP_VARIABLES_TAB_PANEL_TESTID = 'whatsapp-variables-tab-panel';
export const WHATSAPP_NO_CONNECTION_HINT_TESTID = 'whatsapp-no-connection-hint';
export const WHATSAPP_TEMPLATES_ERROR_TESTID = 'whatsapp-templates-error';
export const WHATSAPP_TEMPLATES_RETRY_TESTID = 'whatsapp-templates-retry';
export const WHATSAPP_DICTIONARY_ERROR_TESTID = 'whatsapp-dictionary-error';
export const WHATSAPP_DICTIONARY_RETRY_TESTID = 'whatsapp-dictionary-retry';

export const WHATSAPP_TABS_TEXTS = {
  listLabel: 'Secciones de WhatsApp',
  connection: 'Conexión',
  templates: 'Plantillas',
  variables: 'Variables',
  noConnection: 'Conecta tu número primero para ver Plantillas.',
  templatesError: 'No se pudo cargar la lista de plantillas.',
  dictionaryError: 'No se pudo cargar la lista de variables.',
} as const;

const NO_CONNECTION_HINT_ID = 'whatsapp-no-connection-hint';

const TRIGGER_CLASS = 'h-auto min-h-11 px-3 py-1';
const PANEL_CLASS = 'flex flex-col gap-4 pt-2';

export type WhatsappLoad<T> = { readonly status: 'success'; readonly data: T } | OperationError;

export type WhatsappIntegrationTabsProps = {
  /** Contenido de la pestaña «Conexión», pintado por la página. */
  readonly children: ReactNode;
  readonly hasConnection: boolean;
  /** `null` sin conexión: no se piden. */
  readonly templates: WhatsappLoad<WhatsappTemplateList> | null;
  readonly dictionary: WhatsappLoad<readonly WhatsappDictionaryEntryView[]>;
};

type TabSpec = {
  readonly value: string;
  readonly label: string;
  readonly testId: string;
  readonly panelTestId: string;
  readonly disabled: boolean;
  readonly describedBy?: string;
  readonly refreshOnEnter: boolean;
  readonly panel: ReactNode;
};

const CONNECTION_TAB = 'conexion';

function loadError(
  load: WhatsappLoad<unknown>,
  title: string,
  testId: string,
  retryTestId: string,
): ReactNode | null {
  if (load.status !== 'error') return null;
  return (
    <ErrorState
      error={load}
      title={title}
      testId={testId}
      retry={{ kind: 'refresh' }}
      retryTestId={retryTestId}
    />
  );
}

function templatesPanel(
  templates: WhatsappIntegrationTabsProps['templates'],
  dictionary: WhatsappIntegrationTabsProps['dictionary'],
): ReactNode {
  if (templates === null) return null;
  return (
    loadError(
      templates,
      WHATSAPP_TABS_TEXTS.templatesError,
      WHATSAPP_TEMPLATES_ERROR_TESTID,
      WHATSAPP_TEMPLATES_RETRY_TESTID,
    ) ??
    (templates.status === 'success' ? (
      <WhatsappTemplatesPanel
        list={templates.data}
        dictionary={dictionary.status === 'success' ? dictionary.data : null}
      />
    ) : null)
  );
}

function variablesPanel(
  dictionary: WhatsappIntegrationTabsProps['dictionary'],
  hasConnection: boolean,
): ReactNode {
  return (
    loadError(
      dictionary,
      WHATSAPP_TABS_TEXTS.dictionaryError,
      WHATSAPP_DICTIONARY_ERROR_TESTID,
      WHATSAPP_DICTIONARY_RETRY_TESTID,
    ) ??
    (dictionary.status === 'success' ? (
      <WhatsappVariablesPanel entries={dictionary.data} hasConnection={hasConnection} />
    ) : null)
  );
}

export function WhatsappIntegrationTabs({
  children,
  hasConnection,
  templates,
  dictionary,
}: WhatsappIntegrationTabsProps) {
  const router = useRouter();

  const tabs: readonly TabSpec[] = [
    {
      value: CONNECTION_TAB,
      label: WHATSAPP_TABS_TEXTS.connection,
      testId: WHATSAPP_TAB_CONNECTION_TESTID,
      panelTestId: WHATSAPP_CONNECTION_PANEL_TESTID,
      disabled: false,
      refreshOnEnter: false,
      panel: children,
    },
    {
      value: 'plantillas',
      label: WHATSAPP_TABS_TEXTS.templates,
      testId: WHATSAPP_TAB_TEMPLATES_TESTID,
      panelTestId: WHATSAPP_TEMPLATES_TAB_PANEL_TESTID,
      disabled: !hasConnection,
      describedBy: hasConnection ? undefined : NO_CONNECTION_HINT_ID,
      refreshOnEnter: true,
      panel: templatesPanel(templates, dictionary),
    },
    {
      value: 'variables',
      label: WHATSAPP_TABS_TEXTS.variables,
      testId: WHATSAPP_TAB_VARIABLES_TESTID,
      panelTestId: WHATSAPP_VARIABLES_TAB_PANEL_TESTID,
      disabled: false,
      refreshOnEnter: true,
      panel: variablesPanel(dictionary, hasConnection),
    },
  ];

  function handleValueChange(value: unknown) {
    if (tabs.find((tab) => tab.value === value)?.refreshOnEnter) router.refresh();
  }

  return (
    <WhatsappVerifyTokenProvider>
      <Tabs
        defaultValue={CONNECTION_TAB}
        onValueChange={handleValueChange}
        data-testid={WHATSAPP_TABS_TESTID}
      >
        <div className="flex flex-wrap items-center gap-3">
          <TabsList
            aria-label={WHATSAPP_TABS_TEXTS.listLabel}
            className="h-auto self-start group-data-horizontal/tabs:h-auto"
          >
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                disabled={tab.disabled}
                aria-describedby={tab.describedBy}
                className={TRIGGER_CLASS}
                data-testid={tab.testId}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {hasConnection ? null : (
            <span
              id={NO_CONNECTION_HINT_ID}
              className="text-sm text-muted-foreground"
              data-testid={WHATSAPP_NO_CONNECTION_HINT_TESTID}
            >
              {WHATSAPP_TABS_TEXTS.noConnection}
            </span>
          )}
        </div>
        {tabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className={PANEL_CLASS}
            data-testid={tab.panelTestId}
          >
            {tab.panel}
          </TabsContent>
        ))}
      </Tabs>
    </WhatsappVerifyTokenProvider>
  );
}
