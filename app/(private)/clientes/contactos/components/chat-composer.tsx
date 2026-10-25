'use client';

import { Clock, SendHorizontal } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';

import { ErrorAlert } from '@/components/shared/error-alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { sendWhatsappMessageAction } from '@/lib/modules/integraciones/adapters/driving/whatsapp-message-actions';
import type {
  WhatsappChat,
  WhatsappOutboundMessageView,
  WhatsappSendableTemplate,
} from '@/lib/modules/integraciones';
import { constantLabelsForBackend } from '@/lib/shared/ui/whatsapp-system-constants';
import { cn } from '@/lib/utils';

import { settleAction } from './action-rejection';
import { ChatTemplateChips } from './chat-template-chips';
import type { ChatContextView, ChatMessageView, ChatTarget } from './chat-view';
import {
  CHAT_COMPOSER_ERROR_TESTID,
  CHAT_COMPOSER_MISSING_TESTID,
  CHAT_COMPOSER_TESTID,
  CHAT_COMPOSER_TEXT,
} from './contact-texts';
import { SendTemplateDialog, type TemplateSendFailure } from './send-template-dialog';
import { missingValuesText, resolveTemplate, systemConstantsFor, type TemplateValues } from './template-values';
import { useWindowOpen } from './use-window-open';

export const CHAT_TEXT_MAX_LENGTH = 4096;

export type ChatComposerProps = {
  /** El contacto del chat, si ya existe; sin él se envía al cliente. */
  readonly contactId: string | null;
  readonly customerId: string;
  readonly canSend: boolean;
  readonly window: WhatsappChat['window'];
  readonly hasMessages: boolean;
  readonly templates: readonly WhatsappSendableTemplate[];
  readonly context: ChatContextView | null;
  readonly contextLoading: boolean;
  readonly onSelectOrder: (orderId: string) => void;
  /** Saliente provisional, con id `pending:<n>` y `delivery: 'sending'`. */
  readonly onOptimistic: (message: ChatMessageView) => void;
  /** Reemplaza el provisional `pendingId` por el mensaje devuelto. */
  readonly onSent: (pendingId: string, message: ChatMessageView) => void;
  /** Quita el provisional `pendingId`: la acción no creó ningún mensaje. */
  readonly onSendFailed: (pendingId: string) => void;
  /** Tras enviar al cliente sin conversación: la acción ya creó el contacto. */
  readonly onReloadChat: () => void;
};

const EMPTY_VALUES: TemplateValues = {};

let pendingSequence = 0;

function nextPendingId(): string {
  pendingSequence += 1;
  return `pending:${pendingSequence}`;
}

function lengthOf(text: string): number {
  return [...text].length;
}

function pendingMessage(id: string, text: string): ChatMessageView {
  return {
    id,
    side: 'out',
    at: new Date().toISOString(),
    author: { kind: 'user', name: null },
    delivery: 'sending',
    errorReason: null,
    retryable: false,
    content: { kind: 'text', text },
    reaction: null,
  };
}

export function sentMessage(data: WhatsappOutboundMessageView): ChatMessageView {
  const failed = data.status === 'FAILED';
  return {
    id: data.id,
    side: 'out',
    at: data.createdAt,
    author: { kind: 'user', name: null },
    delivery: failed ? 'failed' : 'sent',
    errorReason: data.errorReason,
    retryable: failed,
    content: data.body.trim() === '' ? { kind: 'unsupported' } : { kind: 'text', text: data.body },
    reaction: null,
  };
}

type Mode = 'text' | 'chips' | 'closed';

function modeOf(hasMessages: boolean, open: boolean): Mode {
  if (!hasMessages) return 'chips';
  return open ? 'text' : 'closed';
}

export function ChatComposer({
  contactId,
  customerId,
  canSend,
  window: chatWindow,
  hasMessages,
  templates,
  context,
  contextLoading,
  onSelectOrder,
  onOptimistic,
  onSent,
  onSendFailed,
  onReloadChat,
}: ChatComposerProps) {
  const baseId = useId();
  const textareaId = `${baseId}-message`;
  const hintId = `${baseId}-hint`;
  const problemId = `${baseId}-problem`;

  const [draft, setDraft] = useState('');
  const [chipId, setChipId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<TemplateSendFailure | null>(null);
  const [dialogFailure, setDialogFailure] = useState<TemplateSendFailure | null>(null);
  const windowOpen = useWindowOpen(chatWindow);

  if (!canSend) return null;

  const recipient: ChatTarget = contactId === null ? { customerId } : { contactId };
  const values = context?.values ?? EMPTY_VALUES;
  const mode = modeOf(hasMessages, windowOpen);

  const chip = mode === 'chips' ? (templates.find((template) => template.id === chipId) ?? null) : null;
  const chipResolved = chip === null ? null : resolveTemplate(chip, values);
  const chipMissing = chipResolved === null ? null : missingValuesText(chipResolved.missing);

  const tooLong = lengthOf(draft) > CHAT_TEXT_MAX_LENGTH;
  const canSendText = mode === 'text' && !sending && draft.trim() !== '' && !tooLong;
  const canSendChip = chip !== null && chipMissing === null && !sending && !contextLoading;

  const afterSuccess = () => {
    if ('customerId' in recipient) onReloadChat();
  };

  async function sendText() {
    if (!canSendText) return;
    const text = draft;
    const pendingId = nextPendingId();
    setFailure(null);
    setSending(true);
    onOptimistic(pendingMessage(pendingId, text));
    setDraft('');
    const result = await settleAction(() => sendWhatsappMessageAction({ kind: 'text', recipient, text }));
    setSending(false);
    if (result.status === 'success') {
      onSent(pendingId, sentMessage(result.data));
      afterSuccess();
      return;
    }
    onSendFailed(pendingId);
    setDraft((current) => (current === '' ? text : current));
    setFailure(result.status === 'missing_values' ? { status: 'missing_values', message: result.message } : result);
  }

  async function sendTemplate(template: WhatsappSendableTemplate, fromDialog: boolean) {
    const resolved = resolveTemplate(template, values);
    if (resolved.missing.length > 0) return;
    const pendingId = nextPendingId();
    const report = fromDialog ? setDialogFailure : setFailure;
    report(null);
    setSending(true);
    onOptimistic(pendingMessage(pendingId, resolved.text));
    const result = await settleAction(() =>
      sendWhatsappMessageAction({
        kind: 'template',
        recipient,
        templateId: template.id,
        constants: systemConstantsFor(template, values),
        constantLabels: { ...constantLabelsForBackend() },
      }),
    );
    setSending(false);
    if (result.status === 'success') {
      onSent(pendingId, sentMessage(result.data));
      if (fromDialog) setDialogOpen(false);
      else setChipId(null);
      afterSuccess();
      return;
    }
    onSendFailed(pendingId);
    report(result.status === 'missing_values' ? { status: 'missing_values', message: result.message } : result);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void sendText();
  }

  const problemText = chipMissing;

  return (
    <footer
      data-testid={CHAT_COMPOSER_TESTID}
      className="flex flex-col gap-2.5 border-t bg-card px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:px-5 md:pt-3 md:pb-3"
    >
      {mode === 'closed' && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] leading-snug text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          <Clock aria-hidden="true" className="mt-px size-4 shrink-0" />
          <span>{CHAT_COMPOSER_TEXT.windowClosed}</span>
        </div>
      )}

      {mode === 'chips' && (
        <ChatTemplateChips
          templates={templates}
          selectedId={chipId}
          onSelect={(id) => {
            setFailure(null);
            setChipId(id);
          }}
          disabled={sending}
        />
      )}

      <div className={cn('flex gap-2.5', mode === 'closed' ? 'items-center' : 'items-end')}>
        <label htmlFor={textareaId} className="sr-only">
          {CHAT_COMPOSER_TEXT.messageLabel}
        </label>
        <Textarea
          id={textareaId}
          rows={mode === 'chips' ? 3 : 2}
          placeholder={mode === 'chips' ? CHAT_COMPOSER_TEXT.templatePlaceholder : CHAT_COMPOSER_TEXT.placeholder}
          value={mode === 'text' ? draft : (chipResolved?.text ?? '')}
          readOnly={mode === 'chips'}
          disabled={mode === 'closed'}
          aria-invalid={problemText !== null || (mode === 'text' && tooLong) ? true : undefined}
          aria-describedby={[mode === 'text' ? hintId : null, problemText !== null ? problemId : null].filter(Boolean).join(' ') || undefined}
          onChange={(event) => {
            if (mode !== 'text') return;
            setFailure(null);
            setDraft(event.target.value);
          }}
          onKeyDown={mode === 'text' ? handleKeyDown : undefined}
          className="max-h-40 min-h-11 flex-1 resize-none [overflow-wrap:anywhere]"
        />
        {mode === 'text' && (
          <Button type="button" size="icon" touch aria-label={CHAT_COMPOSER_TEXT.send} disabled={!canSendText} onClick={() => void sendText()}>
            <SendHorizontal aria-hidden="true" className="size-4" />
          </Button>
        )}
        {mode === 'chips' && (
          <Button
            type="button"
            size="icon"
            touch
            aria-label={CHAT_COMPOSER_TEXT.sendTemplate}
            disabled={!canSendChip}
            onClick={() => {
              if (chip !== null && canSendChip) void sendTemplate(chip, false);
            }}
          >
            <SendHorizontal aria-hidden="true" className="size-4" />
          </Button>
        )}
        {mode === 'closed' && (
          <Button
            type="button"
            touch
            disabled={templates.length === 0}
            onClick={() => {
              setDialogFailure(null);
              setDialogOpen(true);
            }}
          >
            {CHAT_COMPOSER_TEXT.sendTemplate}
          </Button>
        )}
      </div>

      {mode === 'text' && (
        <span id={hintId} className="hidden text-xs text-muted-foreground md:inline">
          {CHAT_COMPOSER_TEXT.keyboardHint}
        </span>
      )}
      {problemText !== null && (
        <p id={problemId} data-testid={CHAT_COMPOSER_MISSING_TESTID} className="text-xs text-destructive-text">
          {problemText}
        </p>
      )}
      {failure !== null &&
        (failure.status === 'missing_values' ? (
          <p role="alert" data-testid={CHAT_COMPOSER_ERROR_TESTID} className="text-sm text-destructive-text">
            {failure.message}
          </p>
        ) : (
          <ErrorAlert error={failure} testId={CHAT_COMPOSER_ERROR_TESTID} className="text-sm text-destructive-text" />
        ))}

      {mode === 'closed' && dialogOpen && (
        <SendTemplateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          templates={templates}
          context={context}
          contextLoading={contextLoading}
          onSelectOrder={onSelectOrder}
          sending={sending}
          failure={dialogFailure}
          onSend={(template) => void sendTemplate(template, true)}
        />
      )}
    </footer>
  );
}
