'use client';

import { X } from 'lucide-react';
import { useId, useState } from 'react';

import { ErrorAlert } from '@/components/shared/error-alert';
import { SHARED_SELECT_TRIGGER_CLASS, SharedSelectControl } from '@/components/shared/shared-select';
import { WaBubble, type WaBubbleVariable } from '@/components/shared/wa-bubble';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ErrorState } from '@/lib/modules/errores';
import type { WhatsappSendableTemplate } from '@/lib/modules/integraciones';

import type { ChatContextView } from './chat-view';
import {
  MISSING_VALUE_TEXT,
  SEND_TEMPLATE_DIALOG_TESTID,
  SEND_TEMPLATE_DIALOG_TEXT,
  SEND_TEMPLATE_ERROR_TESTID,
  SEND_TEMPLATE_MISSING_TESTID,
  SEND_TEMPLATE_ORDER_SELECT_TESTID,
  SEND_TEMPLATE_SELECT_TESTID,
} from './contact-texts';
import { missingValuesText, resolveTemplate, type TemplateValues } from './template-values';

/** Lo que la acción de envío devolvió y no fue un mensaje. */
export type TemplateSendFailure = ErrorState | { readonly status: 'missing_values'; readonly message: string };

export type SendTemplateDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly templates: readonly WhatsappSendableTemplate[];
  /** `null` mientras no ha llegado el contexto del chat: todo sale como `[falta …]`. */
  readonly context: ChatContextView | null;
  readonly contextLoading: boolean;
  /** El pedido es el mismo de la cabecera: quien lo cambia es el padre. */
  readonly onSelectOrder: (orderId: string) => void;
  readonly sending: boolean;
  readonly failure: TemplateSendFailure | null;
  readonly onSend: (template: WhatsappSendableTemplate) => void;
};

const EMPTY_VALUES: TemplateValues = {};

// R7: un nombre de plantilla sin espacios no debe ensanchar el diálogo a 360 px. El disparador
// encoge y trunca la etiqueta; las opciones parten la palabra en vez de desbordar la lista.
const TRIGGER_CLASS = `${SHARED_SELECT_TRIGGER_CLASS} min-w-0 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate`;
const OPTION_CLASS = '*:first:min-w-0 *:first:whitespace-normal *:first:[overflow-wrap:anywhere]';
const MARKER = /\{\{([^{}]+)\}\}/g;

function previewVariables(template: WhatsappSendableTemplate, values: TemplateValues): WaBubbleVariable[] {
  const text = `${template.content.header?.text ?? ''}\n${template.content.body.text}`;
  const keys = new Set([...text.matchAll(MARKER)].map((match) => (match[1] ?? '').trim()));
  return [...keys].map((key) => ({ key, preview: values[key] ?? MISSING_VALUE_TEXT.marker(key) }));
}

export function SendTemplateDialog({
  open,
  onOpenChange,
  templates,
  context,
  contextLoading,
  onSelectOrder,
  sending,
  failure,
  onSend,
}: SendTemplateDialogProps) {
  const baseId = useId();
  const templateLabelId = `${baseId}-template`;
  const orderLabelId = `${baseId}-order`;
  const orderHintId = `${baseId}-order-hint`;
  const missingId = `${baseId}-missing`;

  const [chosenId, setChosenId] = useState<string | null>(templates[0]?.id ?? null);
  const template = templates.find((candidate) => candidate.id === chosenId) ?? templates[0] ?? null;

  const values = context?.values ?? EMPTY_VALUES;
  const orders = context?.orders ?? [];
  const selectedOrderId = orders.some((order) => order.id === context?.selectedOrderId)
    ? (context?.selectedOrderId ?? null)
    : (orders[0]?.id ?? null);

  const resolved = template === null ? null : resolveTemplate(template, values);
  const missingText = resolved === null ? null : missingValuesText(resolved.missing);
  const canSubmit = template !== null && missingText === null && !sending && !contextLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        data-testid={SEND_TEMPLATE_DIALOG_TESTID}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-3xl"
      >
        <div className="flex min-w-0 items-start justify-between gap-3 px-5 pt-5 pb-3 md:px-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle className="text-lg font-semibold [overflow-wrap:anywhere]">{SEND_TEMPLATE_DIALOG_TEXT.title}</DialogTitle>
            <DialogDescription className="text-[13px] [overflow-wrap:anywhere]">{SEND_TEMPLATE_DIALOG_TEXT.description}</DialogDescription>
          </div>
          <DialogClose
            aria-label={SEND_TEMPLATE_DIALOG_TEXT.close}
            render={<Button type="button" variant="ghost" size="icon" touch className="-mt-1 -mr-2" />}
          >
            <X aria-hidden="true" className="size-4" />
          </DialogClose>
        </div>

        <div className="flex min-w-0 flex-col gap-5 px-5 pb-5 md:flex-row md:px-6">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span id={templateLabelId} className="text-[13px] font-medium">
                {SEND_TEMPLATE_DIALOG_TEXT.template}
              </span>
              <SharedSelectControl
                name="templateId"
                options={templates.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
                value={template?.id ?? null}
                onValueChange={(value) => setChosenId(value)}
                disabled={sending || templates.length === 0}
                labelledBy={templateLabelId}
                triggerTestId={SEND_TEMPLATE_SELECT_TESTID}
                triggerClassName={TRIGGER_CLASS}
                optionClassName={OPTION_CLASS}
                alignItemWithTrigger={false}
              />
            </div>

            {orders.length > 1 && selectedOrderId !== null && (
              <div className="flex min-w-0 flex-col gap-1.5">
                <span id={orderLabelId} className="text-[13px] font-medium">
                  {SEND_TEMPLATE_DIALOG_TEXT.order}
                </span>
                <SharedSelectControl
                  name="orderId"
                  options={orders.map((order) => ({ value: order.id, label: order.number }))}
                  value={selectedOrderId}
                  onValueChange={(value) => {
                    if (value !== null && value !== selectedOrderId) onSelectOrder(value);
                  }}
                  disabled={contextLoading || sending}
                  busy={contextLoading}
                  labelledBy={orderLabelId}
                  describedBy={orderHintId}
                  triggerTestId={SEND_TEMPLATE_ORDER_SELECT_TESTID}
                  triggerClassName={TRIGGER_CLASS}
                  optionClassName={OPTION_CLASS}
                  alignItemWithTrigger={false}
                />
                <span id={orderHintId} className="text-xs text-muted-foreground">
                  {SEND_TEMPLATE_DIALOG_TEXT.orderHint}
                </span>
              </div>
            )}
          </div>

          <div className="flex w-full min-w-0 flex-col gap-1.5 md:w-80 md:shrink-0">
            <span className="text-[13px] font-medium">{SEND_TEMPLATE_DIALOG_TEXT.preview}</span>
            {template !== null && resolved !== null && (
              <WaBubble
                header={template.content.header?.text ?? null}
                body={template.content.body.text}
                footer={resolved.footer}
                variables={previewVariables(template, values)}
                time=""
                className="min-h-40"
              />
            )}
            {missingText !== null && (
              <p id={missingId} data-testid={SEND_TEMPLATE_MISSING_TESTID} className="text-xs text-destructive-text [overflow-wrap:anywhere]">
                {missingText}
              </p>
            )}
          </div>
        </div>

        {failure !== null &&
          (failure.status === 'missing_values' ? (
            <p role="alert" data-testid={SEND_TEMPLATE_ERROR_TESTID} className="min-w-0 px-5 pb-4 text-sm text-destructive-text [overflow-wrap:anywhere] md:px-6">
              {failure.message}
            </p>
          ) : (
            <ErrorAlert
              error={failure}
              testId={SEND_TEMPLATE_ERROR_TESTID}
              className="min-w-0 px-5 pb-4 text-sm text-destructive-text [overflow-wrap:anywhere] md:px-6"
            />
          ))}

        <DialogFooter className="mx-0 mb-0 min-w-0 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6">
          <DialogClose render={<Button type="button" variant="outline" touch />}>{SEND_TEMPLATE_DIALOG_TEXT.cancel}</DialogClose>
          <Button
            type="button"
            touch
            disabled={!canSubmit}
            aria-describedby={missingText === null ? undefined : missingId}
            onClick={() => {
              if (template !== null && canSubmit) onSend(template);
            }}
          >
            {SEND_TEMPLATE_DIALOG_TEXT.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
