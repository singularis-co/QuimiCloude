import {
  Building2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HistoryIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  RotateCcwIcon,
  Trash2Icon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { CompanyEventView, Page } from '@/lib/modules/identity';
import { listCompanyEventsAction } from '@/lib/modules/identity/adapters/driving/company-actions';
import { cn } from '@/lib/utils';

import { FIRST_HISTORY_PAGE, companyHistoryPageHref } from './company-detail-tabs';
import { companyEventText, formatCompanyEventInstant } from './company-event-text';

export const COMPANY_HISTORY_TESTID = 'company-history';
export const COMPANY_HISTORY_EVENT_TESTID = 'company-history-event';
export const COMPANY_HISTORY_PAGINATION_TESTID = 'company-history-pagination';
export const COMPANY_HISTORY_PREVIOUS_TESTID = 'company-history-previous';
export const COMPANY_HISTORY_NEXT_TESTID = 'company-history-next';
export const COMPANY_HISTORY_SKELETON_TESTID = 'company-history-skeleton';
export const COMPANY_HISTORY_ERROR_TESTID = 'company-history-error';
export const COMPANY_HISTORY_RETRY_TESTID = 'company-history-retry';
export const COMPANY_HISTORY_EMPTY_TESTID = 'company-history-empty';
export const COMPANY_HISTORY_FIRST_PAGE_TESTID = 'company-history-first-page';

export const COMPANY_HISTORY_TEXTS = {
  list: 'Historial de la empresa',
  loading: 'Cargando el historial…',
  error: 'No se pudo cargar el historial.',
  empty: 'Todavía no hay eventos en el historial.',
  outOfRange: 'No hay eventos en esta página.',
  firstPage: 'Volver a la primera página',
  pagination: 'Páginas del historial',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  pageIndicator: (page: number, totalPages: number, total: number) =>
    `Página ${page} de ${totalPages} · ${total} en total`,
} as const;

const SKELETON_ROWS = 5;
const PANEL_CLASS = 'flex max-w-[760px] flex-col gap-2';

const ICON_CLASS = 'size-4';

const EVENT_ICONS: Readonly<Record<string, ReactNode>> = {
  'company.created': <Building2Icon aria-hidden="true" className={ICON_CLASS} />,
  'company.updated': <PencilIcon aria-hidden="true" className={ICON_CLASS} />,
  'company.deleted': <Trash2Icon aria-hidden="true" className={ICON_CLASS} />,
  'company.reactivated': <RotateCcwIcon aria-hidden="true" className={ICON_CLASS} />,
  'addon.enabled': <PlusIcon aria-hidden="true" className={ICON_CLASS} />,
  'addon.disabled': <PowerIcon aria-hidden="true" className={ICON_CLASS} />,
};

const UNKNOWN_EVENT_ICON = <HistoryIcon aria-hidden="true" className={ICON_CLASS} />;

function iconOf(kind: string): ReactNode {
  return Object.hasOwn(EVENT_ICONS, kind) ? EVENT_ICONS[kind] : UNKNOWN_EVENT_ICON;
}

function authorOf(event: CompanyEventView): string {
  return `${event.actor.firstNames} ${event.actor.lastNames}`;
}

function HistoryEvent({ event }: { readonly event: CompanyEventView }) {
  return (
    <li
      data-testid={COMPANY_HISTORY_EVENT_TESTID}
      data-kind={event.kind}
      className="relative grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3.5 py-2"
    >
      <span className="relative z-10 flex size-10 items-center justify-center rounded-full border-2 border-border bg-card text-muted-foreground">
        {iconOf(event.kind)}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5">
        <span className="text-sm font-medium break-words">{companyEventText(event)}</span>
        <span className="text-[13px] text-muted-foreground">
          {authorOf(event)} ·{' '}
          <time dateTime={event.occurredAt.toISOString()} className="font-mono">
            {formatCompanyEventInstant(event.occurredAt)}
          </time>
        </span>
      </div>
    </li>
  );
}

type PageLinkProps = {
  readonly href: string | null;
  readonly label: string;
  readonly testId: string;
  readonly icon: LucideIcon;
};

const PAGE_LINK_CLASS = cn(buttonVariants({ variant: 'outline', touch: true }), 'min-w-11 px-0');

function PageLink({ href, label, testId, icon: Icon }: PageLinkProps) {
  if (href === null) {
    return (
      <span
        aria-disabled="true"
        role="link"
        aria-label={label}
        data-testid={testId}
        className={cn(PAGE_LINK_CLASS, 'pointer-events-none opacity-50')}
      >
        <Icon aria-hidden="true" />
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} data-testid={testId} className={PAGE_LINK_CLASS}>
      <Icon aria-hidden="true" />
    </Link>
  );
}

type HistoryPaginationProps = {
  readonly companyId: string;
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
};

function HistoryPagination({ companyId, page, totalPages, total }: HistoryPaginationProps) {
  return (
    <nav
      aria-label={COMPANY_HISTORY_TEXTS.pagination}
      data-testid={COMPANY_HISTORY_PAGINATION_TESTID}
      className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-[13px] text-muted-foreground"
    >
      <span>{COMPANY_HISTORY_TEXTS.pageIndicator(page, totalPages, total)}</span>
      <span className="inline-flex gap-1">
        <PageLink
          href={page > FIRST_HISTORY_PAGE ? companyHistoryPageHref(companyId, page - 1) : null}
          label={COMPANY_HISTORY_TEXTS.previousPage}
          testId={COMPANY_HISTORY_PREVIOUS_TESTID}
          icon={ChevronLeftIcon}
        />
        <PageLink
          href={page < totalPages ? companyHistoryPageHref(companyId, page + 1) : null}
          label={COMPANY_HISTORY_TEXTS.nextPage}
          testId={COMPANY_HISTORY_NEXT_TESTID}
          icon={ChevronRightIcon}
        />
      </span>
    </nav>
  );
}

export type CompanyHistoryTimelineProps = {
  readonly companyId: string;
  readonly events: Page<CompanyEventView>;
};

export function CompanyHistoryTimeline({ companyId, events }: CompanyHistoryTimelineProps) {
  if (events.items.length === 0) {
    return (
      <EmptyState
        testId={COMPANY_HISTORY_EMPTY_TESTID}
        className={PANEL_CLASS}
        message={events.total === 0 ? COMPANY_HISTORY_TEXTS.empty : COMPANY_HISTORY_TEXTS.outOfRange}
        firstPage={
          events.page > FIRST_HISTORY_PAGE
            ? {
                href: companyHistoryPageHref(companyId, FIRST_HISTORY_PAGE),
                label: COMPANY_HISTORY_TEXTS.firstPage,
                testId: COMPANY_HISTORY_FIRST_PAGE_TESTID,
              }
            : undefined
        }
      />
    );
  }

  return (
    <div data-testid={COMPANY_HISTORY_TESTID} className={PANEL_CLASS}>
      <ol
        aria-label={COMPANY_HISTORY_TEXTS.list}
        className="relative m-0 list-none p-0 before:absolute before:top-5 before:bottom-5 before:left-[19px] before:w-0.5 before:bg-border"
      >
        {events.items.map((event) => (
          <HistoryEvent key={event.id} event={event} />
        ))}
      </ol>
      <HistoryPagination
        companyId={companyId}
        page={events.page}
        totalPages={events.totalPages}
        total={events.total}
      />
    </div>
  );
}

export function CompanyHistorySkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={COMPANY_HISTORY_TEXTS.loading}
      data-testid={COMPANY_HISTORY_SKELETON_TESTID}
      className={PANEL_CLASS}
    >
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3.5 py-2">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export type CompanyHistoryPanelProps = {
  readonly companyId: string;
  readonly page: number;
};

export async function CompanyHistoryPanel({ companyId, page }: CompanyHistoryPanelProps) {
  const result = await listCompanyEventsAction({ companyId, page });

  if (result.status === 'error') {
    return (
      <ErrorState
        error={result}
        title={COMPANY_HISTORY_TEXTS.error}
        testId={COMPANY_HISTORY_ERROR_TESTID}
        retry={{ kind: 'refresh' }}
        retryTestId={COMPANY_HISTORY_RETRY_TESTID}
        className="flex max-w-[760px] flex-col items-start gap-3 rounded-lg border border-destructive/40 p-4"
      />
    );
  }

  return <CompanyHistoryTimeline companyId={companyId} events={result.data} />;
}
