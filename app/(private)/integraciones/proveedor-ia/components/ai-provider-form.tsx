'use client';

import { CircleAlert } from 'lucide-react';
import { useActionState, useId, useState } from 'react';
import { toast } from 'sonner';

import { ErrorAlert } from '@/components/shared/error-alert';
import { PasswordField } from '@/components/shared/password-field';
import { Spinner } from '@/components/shared/spinner';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ErrorState } from '@/lib/modules/errores';
import type { AiProviderCode, AiProviderEntry } from '@/lib/modules/integraciones';
import {
  saveAiProviderConnectionAction,
  testAiProviderKeyAction,
} from '@/lib/modules/integraciones/adapters/driving/ai-provider-actions';

import { AI_PROVIDER_BRANDS } from './ai-provider-brand';
import { AiProviderPicker } from './ai-provider-picker';

export const AI_PROVIDER_FORM_TESTID = 'ai-provider-form';
export const AI_PROVIDER_KEY_FIELD_TESTID = 'ai-provider-key';
export const AI_PROVIDER_FORM_HELP_TESTID = 'ai-provider-form-help';
export const AI_PROVIDER_FORM_RESULT_TESTID = 'ai-provider-form-result';
export const AI_PROVIDER_FORM_TEST_TESTID = 'ai-provider-form-test';
export const AI_PROVIDER_FORM_SAVE_TESTID = 'ai-provider-form-save';

/** Nombres de los campos que leen las acciones del servidor. */
export const AI_PROVIDER_FORM_FIELDS = { provider: 'provider', apiKey: 'apiKey' } as const;

export const AI_PROVIDER_FORM_TEXTS = {
  title: 'Conecta tu proveedor',
  description: 'Sin proveedor configurado no se pueden leer PDF.',
  status: 'Sin configurar',
  keyLabel: (name: string) => `API key de ${name}`,
  keyPlaceholder: 'Pega aquí tu API key',
  showKey: 'Mostrar la key',
  hideKey: 'Ocultar la key',
  helpBeforeLink: (name: string) => `Créala en la consola de ${name}: `,
  helpModels: 'Se usa con los modelos ',
  helpModelsJoin: ' y ',
  test: 'Probar conexión',
  save: 'Guardar y conectar',
  note: '«Guardar y conectar» hace la misma prueba pequeña antes de guardar: con la key rechazada no se guarda nada.',
  saved: 'Proveedor IA conectado',
} as const;

const SECONDS = new Intl.NumberFormat('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function aiProviderTestOkMessage(elapsedMs: number): string {
  return `Conexión correcta · respondió en ${SECONDS.format(elapsedMs / 1000)} s`;
}

/** Sin el protocolo, como se lee en la ayuda. */
function linkText(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

export type AiProviderFeedback =
  | { readonly kind: 'none' }
  | { readonly kind: 'ok'; readonly elapsedMs: number }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'error'; readonly error: ErrorState };

export const NO_AI_PROVIDER_FEEDBACK: AiProviderFeedback = { kind: 'none' };

export function AiProviderFeedbackMessage({ feedback }: { readonly feedback: AiProviderFeedback }) {
  if (feedback.kind === 'none') return null;
  if (feedback.kind === 'ok') {
    return (
      <StatusBadge
        tone="success"
        label={aiProviderTestOkMessage(feedback.elapsedMs)}
        className="animate-in fade-in duration-150"
      />
    );
  }
  if (feedback.kind === 'failed') {
    return (
      <p className="flex items-start gap-2 text-sm text-destructive animate-in fade-in duration-150">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span className="break-words">{feedback.message}</span>
      </p>
    );
  }
  return (
    <ErrorAlert
      error={feedback.error}
      className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
      withDataCode
    />
  );
}

type Shown = 'test' | 'save' | null;

export type AiProviderFormProps = {
  readonly providers: readonly AiProviderEntry[];
  /** Al cambiar de proveedor desde la tarjeta, el que ya estaba. */
  readonly initialProvider?: AiProviderCode;
  /** Tras guardar con éxito, para que la tarjeta vuelva a su vista. */
  readonly onSaved?: () => void;
};

/**
 * La key nunca tiene valor inicial y el campo se vuelve a montar vacío tras cada respuesta: ni lo
 * escrito vuelve del servidor ni depende del reinicio automático del `<form>`.
 */
export function AiProviderForm({ providers, initialProvider, onSaved }: AiProviderFormProps) {
  const baseId = useId();
  const keyId = `${baseId}-key`;
  const helpId = `${baseId}-help`;
  const titleId = `${baseId}-title`;

  const [provider, setProvider] = useState<AiProviderCode | undefined>(
    initialProvider ?? providers[0]?.code,
  );
  const [hasKey, setHasKey] = useState(false);
  const [fieldGeneration, setFieldGeneration] = useState(0);
  const [shown, setShown] = useState<Shown>(null);

  function afterResponse() {
    setHasKey(false);
    setFieldGeneration((previous) => previous + 1);
  }

  const [testFeedback, testAction, testPending] = useActionState(
    async (_previous: AiProviderFeedback, formData: FormData): Promise<AiProviderFeedback> => {
      const result = await testAiProviderKeyAction({ status: 'idle' }, formData);
      afterResponse();
      if (result.status === 'error') return { kind: 'error', error: result };
      if (result.status === 'tested') {
        return result.ok
          ? { kind: 'ok', elapsedMs: result.elapsedMs }
          : { kind: 'failed', message: result.message };
      }
      return NO_AI_PROVIDER_FEEDBACK;
    },
    NO_AI_PROVIDER_FEEDBACK,
  );

  const [saveFeedback, saveAction, savePending] = useActionState(
    async (_previous: AiProviderFeedback, formData: FormData): Promise<AiProviderFeedback> => {
      const result = await saveAiProviderConnectionAction({ status: 'idle' }, formData);
      afterResponse();
      if (result.status === 'error') return { kind: 'error', error: result };
      if (result.status === 'test_failed') return { kind: 'failed', message: result.message };
      if (result.status === 'saved') {
        // Dentro de la acción: el refresco del servidor desmonta este formulario en el mismo paso.
        toast.success(AI_PROVIDER_FORM_TEXTS.saved);
        onSaved?.();
      }
      return NO_AI_PROVIDER_FEEDBACK;
    },
    NO_AI_PROVIDER_FEEDBACK,
  );

  const selected = providers.find((entry) => entry.code === provider);
  if (selected === undefined) return null;
  const brand = AI_PROVIDER_BRANDS[selected.code];

  const pending = testPending || savePending;
  const disabled = !hasKey || pending;
  const feedback =
    pending || shown === null ? NO_AI_PROVIDER_FEEDBACK : shown === 'test' ? testFeedback : saveFeedback;

  return (
    <Card
      role="region"
      aria-labelledby={titleId}
      className="max-w-[760px] gap-[18px] p-5"
      data-testid={AI_PROVIDER_FORM_TESTID}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-lg font-semibold">
            {AI_PROVIDER_FORM_TEXTS.title}
          </h2>
          <p className="text-sm text-muted-foreground">{AI_PROVIDER_FORM_TEXTS.description}</p>
        </div>
        <StatusBadge tone="neutral" label={AI_PROVIDER_FORM_TEXTS.status} />
      </div>

      <form
        className="flex flex-col gap-[18px]"
        onInput={(event) => {
          const target = event.target as HTMLInputElement;
          if (target.name !== AI_PROVIDER_FORM_FIELDS.apiKey) return;
          setHasKey(target.value.trim() !== '');
          setShown(null);
        }}
      >
        <AiProviderPicker
          providers={providers}
          value={selected.code}
          onValueChange={(code) => {
            setProvider(code);
            setShown(null);
          }}
        />
        <input type="hidden" name={AI_PROVIDER_FORM_FIELDS.provider} value={selected.code} />

        <div className="flex flex-col gap-2">
          <PasswordField
            key={fieldGeneration}
            id={keyId}
            name={AI_PROVIDER_FORM_FIELDS.apiKey}
            label={AI_PROVIDER_FORM_TEXTS.keyLabel(selected.name)}
            variant="secret"
            autoComplete="off"
            placeholder={AI_PROVIDER_FORM_TEXTS.keyPlaceholder}
            texts={{ show: AI_PROVIDER_FORM_TEXTS.showKey, hide: AI_PROVIDER_FORM_TEXTS.hideKey }}
            describedBy={helpId}
            testId={AI_PROVIDER_KEY_FIELD_TESTID}
          />
          <p id={helpId} className="text-xs text-muted-foreground" data-testid={AI_PROVIDER_FORM_HELP_TESTID}>
            {AI_PROVIDER_FORM_TEXTS.helpBeforeLink(selected.name)}
            <a
              href={brand.consoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-primary underline underline-offset-4"
            >
              {linkText(brand.consoleUrl)}
            </a>
            {'. '}
            {AI_PROVIDER_FORM_TEXTS.helpModels}
            <span className="font-mono">{selected.recipeModel}</span>
            {AI_PROVIDER_FORM_TEXTS.helpModelsJoin}
            <span className="font-mono">{selected.catalogModel}</span>.
          </p>
        </div>

        <div aria-live="polite" className="min-h-[22px]" data-testid={AI_PROVIDER_FORM_RESULT_TESTID}>
          <AiProviderFeedbackMessage feedback={feedback} />
        </div>

        <div className="flex flex-wrap justify-end gap-3 @max-[760px]:flex-col @max-[760px]:items-stretch">
          <Button
            type="submit"
            variant="outline"
            touch
            formAction={testAction}
            disabled={disabled}
            aria-busy={testPending}
            onClick={() => setShown('test')}
            data-testid={AI_PROVIDER_FORM_TEST_TESTID}
          >
            {testPending ? <Spinner size="sm" /> : null}
            {AI_PROVIDER_FORM_TEXTS.test}
          </Button>
          <Button
            type="submit"
            touch
            formAction={saveAction}
            disabled={disabled}
            aria-busy={savePending}
            onClick={() => setShown('save')}
            data-testid={AI_PROVIDER_FORM_SAVE_TESTID}
          >
            {savePending ? <Spinner size="sm" /> : null}
            {AI_PROVIDER_FORM_TEXTS.save}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{AI_PROVIDER_FORM_TEXTS.note}</p>
      </form>
    </Card>
  );
}
