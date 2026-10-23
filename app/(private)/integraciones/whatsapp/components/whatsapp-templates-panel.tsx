'use client';

import { MessageSquareTextIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/shared/empty-state';
import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import type {
  TemplateSyncSummary,
  WhatsappDictionaryEntryView,
  WhatsappTemplateList,
  WhatsappTemplateView,
} from '@/lib/modules/integraciones';
import {
  setWhatsappTemplateEnabledAction,
  syncWhatsappTemplatesAction,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-template-actions';

import { WhatsappTemplateDeleteDialog } from './whatsapp-template-delete-dialog';
import { isUnmapped } from './whatsapp-template-rules';
import { WHATSAPP_SYNC_BAR_TEXTS, WhatsappTemplateSyncBar } from './whatsapp-template-sync-bar';
import { WhatsappTemplateTable } from './whatsapp-template-table';

export const WHATSAPP_TEMPLATES_PANEL_TESTID = 'whatsapp-templates-panel';
export const WHATSAPP_TEMPLATES_UNMAPPED_NOTICE_TESTID = 'whatsapp-templates-unmapped-notice';
export const WHATSAPP_TEMPLATES_EMPTY_TESTID = 'whatsapp-templates-empty';
export const WHATSAPP_TEMPLATES_EMPTY_SYNC_TESTID = 'whatsapp-templates-empty-sync';
export const WHATSAPP_TEMPLATES_EMPTY_NEW_TESTID = 'whatsapp-templates-empty-new';

export const WHATSAPP_TEMPLATES_PANEL_TEXTS = {
  unmapped: (count: number) =>
    count === 1
      ? '1 plantilla importada de Meta está sin relacionar. Relaciónala para usarla en el sistema.'
      : `${count} plantillas importadas de Meta están sin relacionar. Relaciónalas para usarlas en el sistema.`,
  emptyTitle: 'Todavía no hay plantillas.',
  emptyMessage: 'Crea una aquí o trae las que ya tienes aprobadas en Meta.',
  newTemplate: 'Nueva plantilla',
  synced: 'Plantillas sincronizadas con Meta.',
  enabled: 'Plantilla habilitada.',
  disabled: 'Plantilla deshabilitada.',
  deleted: 'Plantilla eliminada.',
} as const;

/** El panel lateral abierto encima de la pestaña: solo uno a la vez. */
export type TemplatesPanelSheet =
  | { readonly kind: 'new' }
  | { readonly kind: 'duplicate'; readonly template: WhatsappTemplateView }
  | { readonly kind: 'relate'; readonly template: WhatsappTemplateView };

function sheetMarkerOf(sheet: TemplatesPanelSheet | null): string | undefined {
  if (sheet === null) return undefined;
  return sheet.kind === 'new' ? sheet.kind : `${sheet.kind}:${sheet.template.id}`;
}

export type WhatsappTemplatesPanelProps = {
  readonly list: WhatsappTemplateList;
  /** `null` si la carga del diccionario falló: la pestaña de plantillas sigue funcionando. */
  readonly dictionary: readonly WhatsappDictionaryEntryView[] | null;
};

/**
 * Cambios hechos en esta pantalla antes de que llegue la lista nueva del servidor. Van atados a
 * la lista sobre la que se hicieron: con otra lista ya no aplican.
 */
type LocalChanges = {
  readonly source: WhatsappTemplateList;
  readonly upserted: ReadonlyMap<string, WhatsappTemplateView>;
  readonly removed: ReadonlySet<string>;
  readonly syncedAt: string | null;
};

function noChanges(source: WhatsappTemplateList): LocalChanges {
  return { source, upserted: new Map(), removed: new Set(), syncedAt: source.templatesSyncedAt };
}

function templatesOf(changes: LocalChanges): readonly WhatsappTemplateView[] {
  const fromServer = changes.source.templates.map((template) => changes.upserted.get(template.id) ?? template);
  const serverIds = new Set(changes.source.templates.map((template) => template.id));
  const added = [...changes.upserted.values()].filter((template) => !serverIds.has(template.id));
  return [...added, ...fromServer].filter((template) => !changes.removed.has(template.id));
}

export function WhatsappTemplatesPanel({ list }: WhatsappTemplatesPanelProps) {
  const router = useRouter();
  const [stored, setStored] = useState<LocalChanges>(() => noChanges(list));
  const changes = stored.source === list ? stored : noChanges(list);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<TemplateSyncSummary | null>(null);
  const [toggling, setToggling] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [deleting, setDeleting] = useState<WhatsappTemplateView | null>(null);
  const [sheet, setSheet] = useState<TemplatesPanelSheet | null>(null);

  const update = useCallback(
    (change: (current: LocalChanges) => LocalChanges) =>
      setStored((current) => change(current.source === list ? current : noChanges(list))),
    [list],
  );

  const upsertTemplate = useCallback(
    (template: WhatsappTemplateView) =>
      update((current) => ({ ...current, upserted: new Map(current.upserted).set(template.id, template) })),
    [update],
  );

  const templates = templatesOf(changes);
  const unmappedCount = templates.filter(isUnmapped).length;

  async function sync() {
    if (syncing) return;
    setSyncing(true);
    const result = await syncWhatsappTemplatesAction();
    setSyncing(false);
    if (result.status === 'error') {
      toast.error(result.message);
      return;
    }
    setSummary(result.data);
    update((current) => ({ ...current, syncedAt: result.data.syncedAt }));
    toast.success(WHATSAPP_TEMPLATES_PANEL_TEXTS.synced);
    router.refresh();
  }

  const enabledOf = useCallback(
    (template: WhatsappTemplateView) => toggling.get(template.id) ?? template.enabled,
    [toggling],
  );
  const isToggling = useCallback((template: WhatsappTemplateView) => toggling.has(template.id), [toggling]);

  const toggle = useCallback(
    async (template: WhatsappTemplateView, enabled: boolean) => {
      setToggling((current) => new Map(current).set(template.id, enabled));
      const result = await setWhatsappTemplateEnabledAction({ templateId: template.id, enabled });
      setToggling((current) => {
        const next = new Map(current);
        next.delete(template.id);
        return next;
      });
      if (result.status === 'error') {
        toast.error(result.message);
        return;
      }
      upsertTemplate(result.data);
      toast.success(enabled ? WHATSAPP_TEMPLATES_PANEL_TEXTS.enabled : WHATSAPP_TEMPLATES_PANEL_TEXTS.disabled);
      router.refresh();
    },
    [router, upsertTemplate],
  );

  const openNewTemplate = useCallback(() => setSheet({ kind: 'new' }), []);
  const openDuplicate = useCallback(
    (template: WhatsappTemplateView) => setSheet({ kind: 'duplicate', template }),
    [],
  );
  const openRelate = useCallback((template: WhatsappTemplateView) => setSheet({ kind: 'relate', template }), []);
  const openDelete = useCallback((template: WhatsappTemplateView) => setDeleting(template), []);

  function handleDeleted(template: WhatsappTemplateView) {
    setDeleting(null);
    update((current) => ({ ...current, removed: new Set(current.removed).add(template.id) }));
    toast.success(WHATSAPP_TEMPLATES_PANEL_TEXTS.deleted);
    router.refresh();
  }

  const isEmpty = templates.length === 0 && !syncing;

  return (
    <section
      data-testid={WHATSAPP_TEMPLATES_PANEL_TESTID}
      data-count={list.templates.length}
      data-open-sheet={sheetMarkerOf(sheet)}
      className="flex min-w-0 flex-col gap-4"
    >
      <WhatsappTemplateSyncBar syncedAt={changes.syncedAt} syncing={syncing} summary={summary} onSync={sync} />

      {unmappedCount === 0 ? null : (
        <Notice tone="info" testId={WHATSAPP_TEMPLATES_UNMAPPED_NOTICE_TESTID}>
          {WHATSAPP_TEMPLATES_PANEL_TEXTS.unmapped(unmappedCount)}
        </Notice>
      )}

      {isEmpty ? (
        <EmptyState
          testId={WHATSAPP_TEMPLATES_EMPTY_TESTID}
          icon={{ node: <MessageSquareTextIcon aria-hidden="true" /> }}
          heading={{ text: WHATSAPP_TEMPLATES_PANEL_TEXTS.emptyTitle, level: 2 }}
          message={WHATSAPP_TEMPLATES_PANEL_TEXTS.emptyMessage}
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              touch
              data-testid={WHATSAPP_TEMPLATES_EMPTY_SYNC_TESTID}
              onClick={sync}
            >
              <RefreshCwIcon aria-hidden="true" />
              {WHATSAPP_SYNC_BAR_TEXTS.sync}
            </Button>
            <Button type="button" touch data-testid={WHATSAPP_TEMPLATES_EMPTY_NEW_TESTID} onClick={openNewTemplate}>
              <PlusIcon aria-hidden="true" />
              {WHATSAPP_TEMPLATES_PANEL_TEXTS.newTemplate}
            </Button>
          </div>
        </EmptyState>
      ) : (
        <WhatsappTemplateTable
          templates={templates}
          loading={syncing}
          onNewTemplate={openNewTemplate}
          enabledOf={enabledOf}
          isToggling={isToggling}
          onToggle={toggle}
          onRelate={openRelate}
          onDuplicate={openDuplicate}
          onDelete={openDelete}
        />
      )}

      <WhatsappTemplateDeleteDialog template={deleting} onClose={() => setDeleting(null)} onDeleted={handleDeleted} />
    </section>
  );
}
