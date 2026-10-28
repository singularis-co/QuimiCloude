'use client';

import { RefreshCwIcon } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { Spinner } from '@/components/shared/spinner';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { TemplateSyncSummary } from '@/lib/modules/integraciones';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import { formatSyncDateTime } from './whatsapp-template-rules';

export const WHATSAPP_SYNC_BAR_TESTID = 'whatsapp-template-sync-bar';
export const WHATSAPP_SYNC_AT_TESTID = 'whatsapp-template-sync-at';
export const WHATSAPP_SYNC_BUTTON_TESTID = 'whatsapp-template-sync-button';
export const WHATSAPP_SYNC_SUMMARY_TESTID = 'whatsapp-template-sync-summary';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const WHATSAPP_SYNC_BAR_TEXTS = {
  title: 'Sincronización con Meta',
  last: 'Última:',
  sync: 'Sincronizar con Meta',
  syncing: 'Sincronizando…',
  imported: (count: number) => plural(count, 'importada', 'importadas'),
  updated: (count: number) => plural(count, 'actualizada', 'actualizadas'),
  deleted: (count: number) => plural(count, 'eliminada', 'eliminadas'),
} as const;

const noSubscription = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** La zona es la del dispositivo: el servidor no la conoce, así que pinta la marca de vacío. */
export function SyncDateTime({ iso, testId }: { readonly iso: string | null; readonly testId?: string }) {
  const isClient = useSyncExternalStore(noSubscription, onClient, onServer);
  if (iso === null) return <span data-testid={testId}>{EMPTY_MARK}</span>;
  return (
    <time dateTime={iso} data-testid={testId}>
      {isClient ? formatSyncDateTime(iso) : EMPTY_MARK}
    </time>
  );
}

export type WhatsappTemplateSyncBarProps = {
  readonly syncedAt: string | null;
  readonly syncing: boolean;
  /** Resumen de la última sincronización hecha desde esta pantalla. */
  readonly summary: TemplateSyncSummary | null;
  readonly onSync: () => void;
};

export function WhatsappTemplateSyncBar({ syncedAt, syncing, summary, onSync }: WhatsappTemplateSyncBarProps) {
  return (
    <Card
      size="sm"
      data-testid={WHATSAPP_SYNC_BAR_TESTID}
      className="flex-row flex-wrap items-center justify-between gap-3 px-4 py-3"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold">{WHATSAPP_SYNC_BAR_TEXTS.title}</span>
        <span className="text-[13px] text-muted-foreground">
          {WHATSAPP_SYNC_BAR_TEXTS.last}{' '}
          <span className="font-mono tabular-nums">
            <SyncDateTime iso={syncedAt} testId={WHATSAPP_SYNC_AT_TESTID} />
          </span>
        </span>
        {summary === null || syncing ? null : (
          <span
            className="flex flex-wrap gap-1.5 pt-0.5 animate-in fade-in-0 motion-reduce:animate-none"
            data-testid={WHATSAPP_SYNC_SUMMARY_TESTID}
          >
            <StatusBadge tone="success" label={WHATSAPP_SYNC_BAR_TEXTS.imported(summary.imported)} />
            <StatusBadge tone="info" label={WHATSAPP_SYNC_BAR_TEXTS.updated(summary.updated)} />
            <StatusBadge tone="neutral" label={WHATSAPP_SYNC_BAR_TEXTS.deleted(summary.deleted)} />
          </span>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        touch
        disabled={syncing}
        aria-busy={syncing}
        data-testid={WHATSAPP_SYNC_BUTTON_TESTID}
        onClick={onSync}
      >
        {syncing ? <Spinner /> : <RefreshCwIcon aria-hidden="true" />}
        {syncing ? WHATSAPP_SYNC_BAR_TEXTS.syncing : WHATSAPP_SYNC_BAR_TEXTS.sync}
      </Button>
    </Card>
  );
}
