'use client';

import { LinkIcon, PowerIcon } from 'lucide-react';
import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Notice } from '@/components/shared/notice';
import { Spinner } from '@/components/shared/spinner';
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { ErrorState } from '@/lib/modules/errores';
import type { Addon, CompanyAddonState, CompanyAddonsView } from '@/lib/modules/identity';
import {
  setAllCompanyAddonsAction,
  setCompanyAddonAction,
} from '@/lib/modules/identity/adapters/driving/company-actions';
import { cn } from '@/lib/utils';

import { ADDON_LABELS, changedAddons, successMessage, type AddonWriteVia } from './addon-labels';
import { offConsequences } from './addon-off-consequences';

export const ADDON_SWITCH_LIST_TESTIDS = {
  section: 'company-addons',
  count: 'company-addons-count',
  allOn: 'company-addons-all-on',
  allOff: 'company-addons-all-off',
  allError: 'company-addons-all-error',
  deletedNotice: 'company-addons-deleted-notice',
  dialog: 'company-addon-off-dialog',
  dismiss: 'company-addon-off-dismiss',
  confirm: 'company-addon-off-confirm',
  row: (addon: Addon) => `company-addon-${addon}`,
  toggle: (addon: Addon) => `company-addon-${addon}-switch`,
  status: (addon: Addon) => `company-addon-${addon}-status`,
  requires: (addon: Addon) => `company-addon-${addon}-requires`,
  error: (addon: Addon) => `company-addon-${addon}-error`,
} as const;

export const ADDON_SWITCH_LIST_TEXTS = {
  title: 'Añadidos',
  countSuffix: 'prendidos.',
  countNote: 'Al apagar uno, desaparece para todos los usuarios de la empresa desde su siguiente acción.',
  allOn: 'Prender todos',
  allOff: 'Apagar todos',
  turnOn: 'Prender',
  turnOff: 'Apagar',
  deletedTitle: 'Esta empresa está de baja',
  deletedBody: 'Reactívala para cambiar sus módulos.',
  requires: 'Necesita',
  requiresFix: 'Préndela para que funcione.',
  saveError: 'No se guardó el cambio',
  dismiss: 'Volver',
  confirmOne: 'Apagar',
  confirmAll: 'Apagar todos',
  oneBodyBefore: 'Desaparece del menú y de las pantallas de todos los usuarios de',
  allBodyBefore: 'desaparecen para todos los usuarios de',
  bodyAfter: 'desde su siguiente acción. Lo ya confirmado no se borra.',
} as const;

type AddonStatus = { readonly label: string; readonly tone: StatusTone };

const STATUS_ON: AddonStatus = { label: 'Prendido', tone: 'success' };
const STATUS_NO_EFFECT: AddonStatus = { label: 'Sin efecto', tone: 'waiting' };
const STATUS_OFF: AddonStatus = { label: 'Apagado', tone: 'muted' };

const NAME_LIST = new Intl.ListFormat('es', { style: 'long', type: 'conjunction' });

const HEADING_ID = 'company-addons-heading';

const ERROR_CLASS =
  'flex flex-col gap-0.5 rounded-[10px] border border-destructive-border bg-destructive-subtle px-3.5 py-3 text-sm text-destructive-text';

type Pending = { readonly addons: readonly Addon[] } | null;
type ListError = { readonly at: Addon | 'all'; readonly error: ErrorState } | null;
type OffRequest = { readonly addons: readonly Addon[]; readonly via: AddonWriteVia };

export type AddonSwitchListProps = {
  readonly initialView: CompanyAddonsView;
  readonly companyName: string;
  readonly isDeleted: boolean;
  readonly canModify: boolean;
};

function statusOf(state: CompanyAddonState): AddonStatus {
  if (state.active) return STATUS_ON;
  return state.enabled ? STATUS_NO_EFFECT : STATUS_OFF;
}

function namesOf(addons: readonly Addon[]): string {
  return NAME_LIST.format(addons.map((addon) => ADDON_LABELS[addon].name));
}

function SaveError({ error, testId }: { readonly error: ErrorState; readonly testId: string }) {
  return (
    <ErrorAlert
      error={error}
      testId={testId}
      className={ERROR_CLASS}
      before={<b className="font-semibold">{ADDON_SWITCH_LIST_TEXTS.saveError}</b>}
    />
  );
}

type AddonRowProps = {
  readonly state: CompanyAddonState;
  readonly locked: boolean;
  readonly busy: boolean;
  readonly error: ErrorState | null;
  readonly onToggle: (addon: Addon, enabled: boolean) => void;
};

function AddonRow({ state, locked, busy, error, onToggle }: AddonRowProps) {
  const { addon, enabled, requires } = state;
  const label = ADDON_LABELS[addon];
  const Icon = label.icon;
  const status = statusOf(state);
  const noEffect = status === STATUS_NO_EFFECT;
  const switchProps = {
    checked: enabled,
    disabled: locked,
    'aria-label': `${enabled ? ADDON_SWITCH_LIST_TEXTS.turnOff : ADDON_SWITCH_LIST_TEXTS.turnOn} ${label.name}`,
    'aria-busy': busy || undefined,
    'data-testid': ADDON_SWITCH_LIST_TESTIDS.toggle(addon),
    className: 'col-start-3 row-start-1 justify-self-end md:col-start-auto md:row-start-auto',
    onCheckedChange: (checked: boolean) => onToggle(addon, checked),
  };

  return (
    <li
      data-testid={ADDON_SWITCH_LIST_TESTIDS.row(addon)}
      data-active={state.active}
      className="flex flex-col gap-2 border-b border-border px-4 py-3.5 last:border-b-0"
    >
      <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 md:grid-cols-[40px_minmax(0,1fr)_auto_auto]">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-9 items-center justify-center rounded-[10px] transition-colors duration-(--dur-base) motion-reduce:transition-none md:size-10',
            state.active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold">{label.name}</span>
          <span className="text-xs text-muted-foreground">{label.description}</span>
          {requires.length > 0 ? (
            <span
              data-testid={ADDON_SWITCH_LIST_TESTIDS.requires(addon)}
              data-tone={noEffect ? 'warning' : 'neutral'}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs',
                noEffect ? 'text-warning-text' : 'text-muted-foreground',
              )}
            >
              <LinkIcon aria-hidden="true" className="size-3.5 shrink-0" />
              <span>
                {`${ADDON_SWITCH_LIST_TEXTS.requires} ${namesOf(requires)}.`}
                {noEffect ? ` ${ADDON_SWITCH_LIST_TEXTS.requiresFix}` : null}
              </span>
            </span>
          ) : null}
        </span>
        <span className="col-start-2 md:col-start-auto">
          <StatusBadge
            tone={status.tone}
            label={status.label}
            data-testid={ADDON_SWITCH_LIST_TESTIDS.status(addon)}
          />
        </span>
        {busy ? (
          <Switch {...switchProps}>
            <Spinner />
          </Switch>
        ) : (
          <Switch {...switchProps} />
        )}
      </div>
      {error === null ? null : <SaveError error={error} testId={ADDON_SWITCH_LIST_TESTIDS.error(addon)} />}
    </li>
  );
}

function offDialogTexts(request: OffRequest, companyName: string) {
  const company = <strong className="font-semibold text-foreground">{companyName}</strong>;
  const T = ADDON_SWITCH_LIST_TEXTS;
  if (request.via === 'one') {
    const [only] = request.addons;
    return {
      title: `¿Apagar ${only === undefined ? '' : ADDON_LABELS[only].name}?`,
      description: (
        <>
          {T.oneBodyBefore} {company} {T.bodyAfter}
        </>
      ),
      dismiss: T.dismiss,
      confirm: T.confirmOne,
    };
  }
  return {
    title: `¿Apagar los ${request.addons.length} módulos prendidos?`,
    description: (
      <>
        {namesOf(request.addons)} {T.allBodyBefore} {company} {T.bodyAfter}
      </>
    ),
    dismiss: T.dismiss,
    confirm: T.confirmAll,
  };
}

export function AddonSwitchList({ initialView, companyName, isDeleted, canModify }: AddonSwitchListProps) {
  const [view, setView] = useState<CompanyAddonsView>(initialView);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<ListError>(null);
  // La petición se conserva al cerrar para que el diálogo no se vacíe durante su salida.
  const [offRequest, setOffRequest] = useState<OffRequest | null>(null);
  const [offOpen, setOffOpen] = useState(false);
  const [, startTransition] = useTransition();

  const locked = isDeleted || !canModify || pending !== null;
  const enabledAddons = view.addons.filter((state) => state.enabled).map((state) => state.addon);
  const disabledAddons = view.addons.filter((state) => !state.enabled).map((state) => state.addon);

  function write(addons: readonly Addon[], enabled: boolean, via: AddonWriteVia) {
    const [first] = addons;
    if (first === undefined) return;
    const formData = new FormData();
    formData.set('companyId', view.companyId);
    formData.set('enabled', String(enabled));
    if (via === 'one') formData.set('addon', first);
    setError(null);
    setPending({ addons });
    startTransition(async () => {
      const result =
        via === 'one'
          ? await setCompanyAddonAction({ status: 'idle' }, formData)
          : await setAllCompanyAddonsAction({ status: 'idle' }, formData);
      setPending(null);
      if (result.status === 'success') {
        const changed = changedAddons(view, result.data);
        setView(result.data);
        toast.success(successMessage(changed, enabled, via));
      } else if (result.status === 'error') {
        setError({ at: via === 'one' ? first : 'all', error: result });
      }
    });
  }

  function askOff(request: OffRequest) {
    setError(null);
    setOffRequest(request);
    setOffOpen(true);
  }

  function toggle(addon: Addon, enabled: boolean) {
    if (locked) return;
    if (enabled) write([addon], true, 'one');
    else askOff({ addons: [addon], via: 'one' });
  }

  const T = ADDON_SWITCH_LIST_TEXTS;
  const consequences = offRequest === null ? [] : offConsequences(offRequest.addons, view);
  let dialogBody: ReactNode = null;
  if (consequences.length > 0) {
    dialogBody = (
      <ul className="m-0 flex list-disc flex-col gap-1 pl-[18px] text-sm text-muted-foreground">
        {consequences.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-[22px]">
      {isDeleted ? (
        <Notice tone="warning" title={T.deletedTitle} testId={ADDON_SWITCH_LIST_TESTIDS.deletedNotice}>
          {T.deletedBody}
        </Notice>
      ) : null}
      <section
        aria-labelledby={HEADING_ID}
        data-testid={ADDON_SWITCH_LIST_TESTIDS.section}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-1">
            <h2 id={HEADING_ID} className="text-lg font-semibold">
              {T.title}
            </h2>
            <p className="text-sm text-muted-foreground" data-testid={ADDON_SWITCH_LIST_TESTIDS.count}>
              <span className="font-mono">{enabledAddons.length}</span> de{' '}
              <span className="font-mono">{view.addons.length}</span> {T.countSuffix} {T.countNote}
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
            <Button
              type="button"
              variant="outline"
              touch="mobile"
              className="w-full md:w-auto"
              disabled={locked || disabledAddons.length === 0}
              data-testid={ADDON_SWITCH_LIST_TESTIDS.allOn}
              onClick={() => write(disabledAddons, true, 'all')}
            >
              {T.allOn}
            </Button>
            <Button
              type="button"
              variant="outline"
              touch="mobile"
              className="w-full md:w-auto"
              disabled={locked || enabledAddons.length === 0}
              data-testid={ADDON_SWITCH_LIST_TESTIDS.allOff}
              onClick={() => askOff({ addons: enabledAddons, via: 'all' })}
            >
              {T.allOff}
            </Button>
          </div>
        </div>
        {error !== null && error.at === 'all' ? (
          <SaveError error={error.error} testId={ADDON_SWITCH_LIST_TESTIDS.allError} />
        ) : null}
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[14px] border border-border bg-card p-0">
          {view.addons.map((state) => (
            <AddonRow
              key={state.addon}
              state={state}
              locked={locked}
              busy={pending?.addons.includes(state.addon) ?? false}
              error={error !== null && error.at === state.addon ? error.error : null}
              onToggle={toggle}
            />
          ))}
        </ul>
      </section>
      {offRequest === null ? null : (
        <ConfirmDialog
          open={offOpen}
          onOpenChange={setOffOpen}
          variant="destructive"
          icon={{ glyph: PowerIcon, tone: 'warning' }}
          texts={offDialogTexts(offRequest, companyName)}
          testIds={{
            dialog: ADDON_SWITCH_LIST_TESTIDS.dialog,
            dismiss: ADDON_SWITCH_LIST_TESTIDS.dismiss,
            confirm: ADDON_SWITCH_LIST_TESTIDS.confirm,
          }}
          onConfirm={() => write(offRequest.addons, false, offRequest.via)}
        >
          {dialogBody}
        </ConfirmDialog>
      )}
    </div>
  );
}
