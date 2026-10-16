'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';

import {
  DataTable,
  type DataTableCardLayout,
  type DataTableParams,
  type DataTableStates,
} from '@/components/shared/data-table';
import type { EmptyStateProps } from '@/components/shared/empty-state';
import { buttonVariants } from '@/components/ui/button';
import type { ErrorState } from '@/lib/modules/errores';
import type { AdministratorRow } from '@/lib/modules/identity';
import { cn } from '@/lib/utils';

import {
  ADMINISTRATOR_COLUMN_COUNT,
  buildAdministratorColumns,
  type AdministratorRowAction,
} from './administrator-columns';
import {
  ADMINISTRATOR_EMPTY_TEXTS,
  ADMINISTRATOR_ERROR_TITLE,
  administratorTableTexts,
} from './administrator-labels';
import {
  ADMINISTRATOR_COMPANY_COLUMN_ID,
  ADMINISTRATOR_EMAIL_COLUMN_ID,
  ADMINISTRATOR_FIRST_PAGE,
  ADMINISTRATOR_NAME_COLUMN_ID,
  ADMINISTRATOR_STATUS_COLUMN_ID,
  ADMINISTRATOR_USERNAME_COLUMN_ID,
  administratorListHref,
  companyFilterValues,
  withFilterResetsPage,
  withoutCompanyFilter,
} from './administrator-list-params';
import type { ActiveCompany } from './load-active-companies';

export const ADMINISTRATOR_TABLE_ID = 'maestro-administradores';
export const ADMINISTRATOR_TABLE_TESTID = 'administrator-table';
export const ADMINISTRATOR_LIST_SKELETON_TESTID = 'administrator-list-skeleton';
export const ADMINISTRATOR_ROW_SKELETON_TESTID = 'administrator-row-skeleton';
export const ADMINISTRATOR_LIST_ERROR_TESTID = 'administrator-list-error';
export const ADMINISTRATOR_LIST_RETRY_TESTID = 'administrator-list-retry';
export const ADMINISTRATOR_LIST_EMPTY_TESTID = 'administrator-list-empty';
export const ADMINISTRATOR_LIST_CLEAR_FILTER_TESTID = 'administrator-list-clear-filter';
export const ADMINISTRATOR_LIST_FIRST_PAGE_TESTID = 'administrator-list-first-page';

const ADMINISTRATOR_CARD: DataTableCardLayout = {
  primary: ADMINISTRATOR_NAME_COLUMN_ID,
  status: ADMINISTRATOR_STATUS_COLUMN_ID,
  meta: [ADMINISTRATOR_USERNAME_COLUMN_ID, ADMINISTRATOR_EMAIL_COLUMN_ID],
  footer: ADMINISTRATOR_COMPANY_COLUMN_ID,
};

export type AdministratorActionTarget = {
  readonly action: AdministratorRowAction;
  readonly administrator: AdministratorRow;
};

type AdministratorTableStatusProps =
  | { readonly status?: 'idle' | 'loading'; readonly error?: undefined }
  | { readonly status: 'error'; readonly error: ErrorState };

export type AdministratorTableProps = AdministratorTableStatusProps & {
  readonly administrators: readonly AdministratorRow[];
  readonly companies: readonly ActiveCompany[];
  readonly params: DataTableParams;
  readonly total: number;
  readonly totalPages: number;
  readonly canModify: boolean;
};

function buildEmpty(params: DataTableParams): EmptyStateProps {
  const filtered = companyFilterValues(params).length > 0;
  const firstPage =
    params.page > ADMINISTRATOR_FIRST_PAGE
      ? {
          href: administratorListHref({ ...params, page: ADMINISTRATOR_FIRST_PAGE }),
          label: ADMINISTRATOR_EMPTY_TEXTS.firstPage,
          testId: ADMINISTRATOR_LIST_FIRST_PAGE_TESTID,
        }
      : undefined;

  if (!filtered) {
    return {
      testId: ADMINISTRATOR_LIST_EMPTY_TESTID,
      message: ADMINISTRATOR_EMPTY_TEXTS.empty,
      firstPage,
    };
  }

  return {
    testId: ADMINISTRATOR_LIST_EMPTY_TESTID,
    message: ADMINISTRATOR_EMPTY_TEXTS.noMatches,
    firstPage,
    children: (
      <Link
        href={administratorListHref(withoutCompanyFilter(params))}
        data-slot="button"
        data-testid={ADMINISTRATOR_LIST_CLEAR_FILTER_TESTID}
        className={cn(buttonVariants({ variant: 'outline', touch: true }))}
      >
        {ADMINISTRATOR_EMPTY_TEXTS.clearFilter}
      </Link>
    ),
  };
}

function buildStates(params: DataTableParams, error: ErrorState | undefined): DataTableStates {
  return {
    loading: {
      columns: ADMINISTRATOR_COLUMN_COUNT,
      rows: params.pageSize,
      label: administratorTableTexts(0).loading,
      testId: ADMINISTRATOR_LIST_SKELETON_TESTID,
      rowTestId: ADMINISTRATOR_ROW_SKELETON_TESTID,
      headCellClassName: 'h-4 w-full',
    },
    ...(error === undefined
      ? {}
      : {
          error: {
            error,
            title: ADMINISTRATOR_ERROR_TITLE,
            testId: ADMINISTRATOR_LIST_ERROR_TESTID,
            retry: { kind: 'refresh' },
            retryTestId: ADMINISTRATOR_LIST_RETRY_TESTID,
          },
        }),
    empty: buildEmpty(params),
  };
}

export function AdministratorTable({
  administrators,
  companies,
  params,
  total,
  totalPages,
  canModify,
  status = 'idle',
  error,
}: AdministratorTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [, setTarget] = useState<AdministratorActionTarget | null>(null);

  const onAction = useCallback((action: AdministratorRowAction, administrator: AdministratorRow) => {
    setTarget({ action, administrator });
  }, []);

  const columns = useMemo(
    () => buildAdministratorColumns({ canModify, companies, onAction }),
    [canModify, companies, onAction],
  );
  const texts = useMemo(() => administratorTableTexts(total), [total]);

  const handleParamsChange = (next: DataTableParams) => {
    startTransition(() => {
      router.replace(administratorListHref(withFilterResetsPage(params, next)));
    });
  };

  return (
    <div
      data-testid={ADMINISTRATOR_TABLE_TESTID}
      aria-busy={isPending}
      className={isPending ? 'opacity-60 transition-opacity' : 'transition-opacity'}
    >
      <DataTable
        tableId={ADMINISTRATOR_TABLE_ID}
        columns={columns}
        rows={administrators}
        getRowId={(administrator) => administrator.id}
        params={params}
        totalPages={totalPages}
        onParamsChange={handleParamsChange}
        status={status}
        texts={texts}
        searchable={false}
        states={buildStates(params, error)}
        card={ADMINISTRATOR_CARD}
      />
    </div>
  );
}
