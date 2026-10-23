'use client';

import { useRouter } from 'next/navigation';
import {
  startTransition,
  useActionState,
  useCallback,
  useId,
  useOptimistic,
  useState,
  useSyncExternalStore,
} from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Notice } from '@/components/shared/notice';
import { Spinner } from '@/components/shared/spinner';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ErrorState } from '@/lib/modules/errores';
import type {
  AiProviderConnectionStatus,
  AiProviderConnectionView,
  AiProviderEntry,
} from '@/lib/modules/integraciones';
import {
  disconnectAiProviderAction,
  selectAiModelAction,
  testSavedAiProviderAction,
} from '@/lib/modules/integraciones/adapters/driving/ai-provider-actions';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import { AiModelSelect } from './ai-model-select';
import {
  AiProviderFeedbackMessage,
  AiProviderForm,
  NO_AI_PROVIDER_FEEDBACK,
  type AiProviderFeedback,
} from './ai-provider-form';
import { AiProviderLogo } from './ai-provider-logo';

export const AI_PROVIDER_CARD_TESTID = 'ai-provider-card';
export const AI_PROVIDER_CARD_KEY_SAVED_TESTID = 'ai-provider-card-key-saved';
export const AI_PROVIDER_CARD_STATUS_TESTID = 'ai-provider-card-status';
export const AI_PROVIDER_CARD_MODEL_SECTION_TESTID = 'ai-provider-card-model';
export const AI_PROVIDER_CARD_LAST_TEST_TESTID = 'ai-provider-card-last-test';
export const AI_PROVIDER_CARD_ERROR_TESTID = 'ai-provider-card-error';
export const AI_PROVIDER_CARD_RESULT_TESTID = 'ai-provider-card-result';
export const AI_PROVIDER_CARD_DISCONNECT_TESTID = 'ai-provider-card-disconnect';
export const AI_PROVIDER_CARD_TEST_TESTID = 'ai-provider-card-test';
export const AI_PROVIDER_CARD_CHANGE_TESTID = 'ai-provider-card-change';
export const AI_PROVIDER_DISCONNECT_DIALOG_TESTID = 'ai-provider-disconnect-dialog';
export const AI_PROVIDER_DISCONNECT_CONFIRM_TESTID = 'ai-provider-disconnect-confirm';
export const AI_PROVIDER_DISCONNECT_DISMISS_TESTID = 'ai-provider-disconnect-dismiss';
export const AI_PROVIDER_CHANGE_DIALOG_TESTID = 'ai-provider-change-dialog';
export const AI_PROVIDER_CHANGE_CONFIRM_TESTID = 'ai-provider-change-confirm';
export const AI_PROVIDER_CHANGE_DISMISS_TESTID = 'ai-provider-change-dismiss';

export const AI_PROVIDER_CARD_TEXTS = {
  keySavedBefore: 'Key guardada el ',
  keySavedAfter: ' · cifrada',
  modelTitle: 'Modelo',
  modelDescription: (name: string) =>
    `Se usa para leer fórmulas y catálogos en PDF. Solo aparecen modelos de ${name} que leen PDF e imágenes.`,
  modelSaved: 'Modelo guardado',
  lastTest: 'Última prueba',
  lastTestOk: 'Correcta el ',
  lastTestFailed: 'Falló el ',
  errorTitle: 'Error con tu proveedor',
  disconnect: 'Desconectar',
  test: 'Probar conexión',
  change: 'Cambiar key o proveedor',
  disconnected: 'Proveedor IA desconectado',
} as const;

export const AI_PROVIDER_STATUS_LABELS: Readonly<Record<AiProviderConnectionStatus, string>> = {
  ACTIVE: 'Conectado',
  ERROR: 'Error',
};

export const AI_PROVIDER_DISCONNECT_DIALOG_TEXTS = {
  title: (name: string) => `¿Desconectar ${name}?`,
  description:
    'La key se borra y no se puede recuperar. Mientras no conectes otro proveedor, nadie de tu empresa podrá leer fórmulas ni catálogos en PDF.',
  dismiss: 'Cancelar',
  confirm: 'Desconectar',
} as const;

export const AI_PROVIDER_CHANGE_DIALOG_TEXTS = {
  title: '¿Cambiar de proveedor?',
  description: (name: string) =>
    `El modelo que elegiste es de ${name}. Si conectas otro proveedor, se usa el modelo recomendado del nuevo proveedor. Si solo cambias la key de ${name}, se conserva.`,
  dismiss: 'Cancelar',
  confirm: 'Continuar',
} as const;

const noSubscription = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
// El servidor no conoce el huso del usuario: pinta UTC y, al hidratar, React repinta con el del
// navegador sin desajuste de hidratación.
const serverTimeZone = () => 'UTC';

function formatDate(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone,
  }).format(date);
}

function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(iso));
}

function LocalDate({ iso, withTime }: { readonly iso: string; readonly withTime?: boolean }) {
  const timeZone = useSyncExternalStore(noSubscription, browserTimeZone, serverTimeZone);
  const date = formatDate(iso, timeZone);
  const text = withTime && date !== iso ? `${date} ${formatTime(iso, timeZone)}` : date;
  return <time dateTime={iso}>{text}</time>;
}

function LastTest({ connection }: { readonly connection: AiProviderConnectionView }) {
  if (connection.status === 'ERROR' && connection.lastErrorAt !== null) {
    return (
      <>
        {AI_PROVIDER_CARD_TEXTS.lastTestFailed}
        <LocalDate iso={connection.lastErrorAt} withTime />
      </>
    );
  }
  if (connection.status === 'ACTIVE' && connection.lastCheckedAt !== null) {
    return (
      <>
        {AI_PROVIDER_CARD_TEXTS.lastTestOk}
        <LocalDate iso={connection.lastCheckedAt} withTime />
      </>
    );
  }
  return <>{EMPTY_MARK}</>;
}

type DisconnectState = { readonly kind: 'idle' } | { readonly kind: 'error'; readonly error: ErrorState };

const DISCONNECT_IDLE: DisconnectState = { kind: 'idle' };

type SelectModelState = { readonly kind: 'idle' } | { readonly kind: 'error'; readonly error: ErrorState };

const SELECT_MODEL_IDLE: SelectModelState = { kind: 'idle' };

export type AiProviderCardProps = {
  readonly providers: readonly AiProviderEntry[];
  readonly connection: AiProviderConnectionView;
};

export function AiProviderCard({ providers, connection }: AiProviderCardProps) {
  const router = useRouter();
  const titleId = useId();
  const modelTitleId = useId();
  const [editing, setEditing] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  // Al terminar la consulta el valor optimista se descarta: si falló, vuelve el del servidor.
  const [shownModel, showModel] = useOptimistic(connection.modelInUse);

  const [testFeedback, runTest, testPending] = useActionState(
    async (_previous: AiProviderFeedback, formData: FormData): Promise<AiProviderFeedback> => {
      const result = await testSavedAiProviderAction({ status: 'idle' }, formData);
      if (result.status === 'error') return { kind: 'error', error: result };
      if (result.status === 'not_connected') {
        router.refresh();
        return NO_AI_PROVIDER_FEEDBACK;
      }
      if (result.status === 'tested') {
        return result.ok ? { kind: 'ok' } : { kind: 'failed', message: result.message };
      }
      return NO_AI_PROVIDER_FEEDBACK;
    },
    NO_AI_PROVIDER_FEEDBACK,
  );

  const [disconnectState, runDisconnect, disconnectPending] = useActionState(
    async (_previous: DisconnectState, formData: FormData): Promise<DisconnectState> => {
      const result = await disconnectAiProviderAction({ status: 'idle' }, formData);
      if (result.status === 'error') return { kind: 'error', error: result };
      if (result.status === 'disconnected') {
        // Dentro de la acción: el refresco del servidor desmonta la tarjeta en el mismo paso.
        setDisconnectOpen(false);
        toast.success(AI_PROVIDER_CARD_TEXTS.disconnected);
      }
      return DISCONNECT_IDLE;
    },
    DISCONNECT_IDLE,
  );

  const [selectState, runSelect, selectPending] = useActionState(
    async (_previous: SelectModelState, formData: FormData): Promise<SelectModelState> => {
      const result = await selectAiModelAction({ status: 'idle' }, formData);
      if (result.status === 'error') return { kind: 'error', error: result };
      if (result.status === 'not_connected') router.refresh();
      if (result.status === 'saved') toast.success(AI_PROVIDER_CARD_TEXTS.modelSaved);
      return SELECT_MODEL_IDLE;
    },
    SELECT_MODEL_IDLE,
  );

  const chooseModel = (modelId: string) => {
    const formData = new FormData();
    formData.set('modelId', modelId);
    startTransition(() => {
      showModel(modelId);
      runSelect(formData);
    });
  };

  const closeEditor = useCallback(() => setEditing(false), []);

  if (editing) {
    return <AiProviderForm providers={providers} initialProvider={connection.provider} onSaved={closeEditor} />;
  }

  const isError = connection.status === 'ERROR';
  // Tras una prueba fallida el aviso de la tarjeta ya lleva el mensaje: no se repite debajo.
  const feedback =
    testPending ||
    (testFeedback.kind === 'failed' && isError && connection.lastError === testFeedback.message)
      ? NO_AI_PROVIDER_FEEDBACK
      : testFeedback;

  const isServerModel = shownModel === connection.modelInUse;
  const shownIsDefault = isServerModel
    ? connection.modelIsDefault
    : connection.modelOptions.some((option) => option.modelId === shownModel && option.isDefault);
  const shownUnavailable = isServerModel && connection.modelUnavailable;
  const selectError = !selectPending && selectState.kind === 'error' ? selectState.error : undefined;

  const askChange = () => {
    if (connection.modelIsDefault) setEditing(true);
    else setChangeOpen(true);
  };

  return (
    <Card
      role="region"
      aria-labelledby={titleId}
      className="max-w-[760px] gap-4 p-5"
      data-testid={AI_PROVIDER_CARD_TESTID}
      data-status={connection.status}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AiProviderLogo code={connection.provider} name={connection.providerName} size="card" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id={titleId} className="text-lg font-semibold break-words">
              {connection.providerName}
            </h2>
            <p className="text-sm text-muted-foreground" data-testid={AI_PROVIDER_CARD_KEY_SAVED_TESTID}>
              {AI_PROVIDER_CARD_TEXTS.keySavedBefore}
              <LocalDate iso={connection.keyUpdatedAt} />
              {AI_PROVIDER_CARD_TEXTS.keySavedAfter}
            </p>
          </div>
        </div>
        <StatusBadge
          tone={isError ? 'danger' : 'success'}
          label={AI_PROVIDER_STATUS_LABELS[connection.status]}
          data-testid={AI_PROVIDER_CARD_STATUS_TESTID}
        />
      </div>

      {isError && connection.lastError !== null ? (
        <Notice tone="danger" title={AI_PROVIDER_CARD_TEXTS.errorTitle} testId={AI_PROVIDER_CARD_ERROR_TESTID}>
          <span className="break-words">{connection.lastError}</span>
        </Notice>
      ) : null}

      <section
        aria-labelledby={modelTitleId}
        className="flex flex-col gap-3 pt-1"
        data-testid={AI_PROVIDER_CARD_MODEL_SECTION_TESTID}
      >
        <div className="flex flex-col gap-0.5">
          <h3 id={modelTitleId} className="text-[15px] font-semibold">
            {AI_PROVIDER_CARD_TEXTS.modelTitle}
          </h3>
          <p className="text-sm text-muted-foreground">
            {AI_PROVIDER_CARD_TEXTS.modelDescription(connection.providerName)}
          </p>
        </div>
        <AiModelSelect
          providerName={connection.providerName}
          options={connection.modelOptions}
          value={shownModel}
          isDefault={shownIsDefault}
          unavailable={shownUnavailable}
          pending={selectPending}
          onChange={chooseModel}
          error={selectError}
        />
      </section>

      <dl className="m-0 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl bg-muted px-4 py-3.5 text-xs leading-normal @max-[760px]:grid-cols-1">
        <dt className="text-muted-foreground">{AI_PROVIDER_CARD_TEXTS.lastTest}</dt>
        <dd className="m-0" data-testid={AI_PROVIDER_CARD_LAST_TEST_TESTID}>
          <LastTest connection={connection} />
        </dd>
      </dl>

      <div aria-live="polite" className="min-h-[22px]" data-testid={AI_PROVIDER_CARD_RESULT_TESTID}>
        <AiProviderFeedbackMessage feedback={feedback} />
      </div>

      <div className="flex flex-wrap justify-between gap-3 @max-[760px]:flex-col @max-[760px]:items-stretch">
        <Button
          type="button"
          variant="destructive"
          touch
          disabled={testPending || disconnectPending}
          onClick={() => setDisconnectOpen(true)}
          data-testid={AI_PROVIDER_CARD_DISCONNECT_TESTID}
        >
          {AI_PROVIDER_CARD_TEXTS.disconnect}
        </Button>
        <div className="flex flex-wrap gap-2 @max-[760px]:flex-col @max-[760px]:items-stretch">
          <Button
            type="button"
            variant="outline"
            touch
            disabled={testPending || disconnectPending}
            aria-busy={testPending}
            onClick={() => startTransition(() => runTest(new FormData()))}
            data-testid={AI_PROVIDER_CARD_TEST_TESTID}
          >
            {testPending ? <Spinner size="sm" /> : null}
            {AI_PROVIDER_CARD_TEXTS.test}
          </Button>
          <Button
            type="button"
            touch
            disabled={testPending || disconnectPending}
            onClick={askChange}
            data-testid={AI_PROVIDER_CARD_CHANGE_TESTID}
          >
            {AI_PROVIDER_CARD_TEXTS.change}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        variant="destructive"
        texts={{
          title: AI_PROVIDER_DISCONNECT_DIALOG_TEXTS.title(connection.providerName),
          description: AI_PROVIDER_DISCONNECT_DIALOG_TEXTS.description,
          dismiss: AI_PROVIDER_DISCONNECT_DIALOG_TEXTS.dismiss,
          confirm: AI_PROVIDER_DISCONNECT_DIALOG_TEXTS.confirm,
        }}
        submit={{ kind: 'action', action: runDisconnect }}
        isPending={disconnectPending}
        error={disconnectState.kind === 'error' ? disconnectState.error : undefined}
        testIds={{
          dialog: AI_PROVIDER_DISCONNECT_DIALOG_TESTID,
          dismiss: AI_PROVIDER_DISCONNECT_DISMISS_TESTID,
          confirm: AI_PROVIDER_DISCONNECT_CONFIRM_TESTID,
        }}
      />

      <ConfirmDialog
        open={changeOpen}
        onOpenChange={setChangeOpen}
        texts={{
          title: AI_PROVIDER_CHANGE_DIALOG_TEXTS.title,
          description: AI_PROVIDER_CHANGE_DIALOG_TEXTS.description(connection.providerName),
          dismiss: AI_PROVIDER_CHANGE_DIALOG_TEXTS.dismiss,
          confirm: AI_PROVIDER_CHANGE_DIALOG_TEXTS.confirm,
        }}
        onConfirm={() => setEditing(true)}
        testIds={{
          dialog: AI_PROVIDER_CHANGE_DIALOG_TESTID,
          dismiss: AI_PROVIDER_CHANGE_DISMISS_TESTID,
          confirm: AI_PROVIDER_CHANGE_CONFIRM_TESTID,
        }}
      />
    </Card>
  );
}
