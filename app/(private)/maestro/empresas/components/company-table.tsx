'use client';

import { Building2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import {
  DataTable,
  type DataTableCardLayout,
  type DataTableParams,
  type DataTableStates,
} from '@/components/shared/data-table';
import type { EmptyStateProps } from '@/components/shared/empty-state';
import { buttonVariants } from '@/components/ui/button';
import type { ErrorState } from '@/lib/modules/errores';
import type { CompanyRow } from '@/lib/modules/identity';
import { cn } from '@/lib/utils';

import {
  COUNTRY_COLUMN_ID,
  COMPANY_COLUMN_COUNT,
  TAX_ID_COLUMN_ID,
  USERS_COLUMN_ID,
  buildCompanyColumns,
  type CompanyRowAction,
} from './company-columns';
import { COMPANY_EMPTY_TEXTS, COMPANY_ERROR_TITLE, companyTableTexts } from './company-labels';
import {
  CREATED_AT_COLUMN_ID,
  FIRST_PAGE,
  NAME_COLUMN_ID,
  STATUS_COLUMN_ID,
  companyListHref,
  isDeletedOnlyFilter,
  withSearchResetsPage,
  withoutSearch,
  withoutStatusFilter,
} from './company-list-params';

export const COMPANY_TABLE_ID = 'maestro-empresas';
export const COMPANY_TABLE_TESTID = 'company-table';
export const COMPANY_LIST_SKELETON_TESTID = 'company-list-skeleton';
export const COMPANY_ROW_SKELETON_TESTID = 'company-row-skeleton';
export const COMPANY_LIST_ERROR_TESTID = 'company-list-error';
export const COMPANY_LIST_RETRY_TESTID = 'company-list-retry';
export const COMPANY_LIST_EMPTY_TESTID = 'company-list-empty';
export const COMPANY_LIST_CLEAR_FILTER_TESTID = 'company-list-clear-filter';
export const COMPANY_LIST_CLEAR_SEARCH_TESTID = 'company-list-clear-search';
export const COMPANY_LIST_FIRST_PAGE_TESTID = 'company-list-first-page';

const COMPANY_CARD: DataTableCardLayout = {
  primary: NAME_COLUMN_ID,
  status: STATUS_COLUMN_ID,
  meta: [TAX_ID_COLUMN_ID, COUNTRY_COLUMN_ID, CREATED_AT_COLUMN_ID],
  footer: USERS_COLUMN_ID,
};

export type CompanyActionTarget = {
  readonly action: CompanyRowAction;
  readonly company: CompanyRow;
};

type CompanyTableStatusProps =
  | { readonly status?: 'idle' | 'loading'; readonly error?: undefined }
  | { readonly status: 'error'; readonly error: ErrorState };

export type CompanyTableProps = CompanyTableStatusProps & {
  readonly companies: readonly CompanyRow[];
  readonly params: DataTableParams;
  readonly total: number;
  readonly totalPages: number;
  readonly canModify: boolean;
};

function buildEmpty(params: DataTableParams): EmptyStateProps {
  const searching = params.search !== '';
  const clearSearch = searching
    ? {
        href: companyListHref(withoutSearch(params)),
        label: COMPANY_EMPTY_TEXTS.clearSearch,
        testId: COMPANY_LIST_CLEAR_SEARCH_TESTID,
      }
    : undefined;
  const firstPage =
    params.page > FIRST_PAGE
      ? {
          href: companyListHref({ ...params, page: FIRST_PAGE }),
          label: COMPANY_EMPTY_TEXTS.firstPage,
          testId: COMPANY_LIST_FIRST_PAGE_TESTID,
        }
      : undefined;

  if (isDeletedOnlyFilter(params)) {
    return {
      testId: COMPANY_LIST_EMPTY_TESTID,
      icon: { node: <Building2Icon /> },
      heading: { text: COMPANY_EMPTY_TEXTS.deletedHeading, level: 2 },
      message: COMPANY_EMPTY_TEXTS.deletedMessage,
      clearSearch,
      firstPage,
      children: (
        <Link
          href={companyListHref(withoutStatusFilter(params))}
          data-slot="button"
          data-testid={COMPANY_LIST_CLEAR_FILTER_TESTID}
          className={cn(buttonVariants({ variant: 'outline', touch: true }))}
        >
          {COMPANY_EMPTY_TEXTS.clearFilter}
        </Link>
      ),
    };
  }

  return {
    testId: COMPANY_LIST_EMPTY_TESTID,
    message: searching ? COMPANY_EMPTY_TEXTS.noMatches : COMPANY_EMPTY_TEXTS.empty,
    clearSearch,
    firstPage,
  };
}

function buildStates(params: DataTableParams, error: ErrorState | undefined): DataTableStates {
  return {
    loading: {
      columns: COMPANY_COLUMN_COUNT,
      rows: params.pageSize,
      label: companyTableTexts(0).loading,
      testId: COMPANY_LIST_SKELETON_TESTID,
      rowTestId: COMPANY_ROW_SKELETON_TESTID,
      headCellClassName: 'h-4 w-full',
    },
    ...(error === undefined
      ? {}
      : {
          error: {
            error,
            title: COMPANY_ERROR_TITLE,
            testId: COMPANY_LIST_ERROR_TESTID,
            retry: { kind: 'refresh' },
            retryTestId: COMPANY_LIST_RETRY_TESTID,
          },
        }),
    empty: buildEmpty(params),
  };
}

export function CompanyTable({
  companies,
  params,
  total,
  totalPages,
  canModify,
  status = 'idle',
  error,
}: CompanyTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [, setTarget] = useState<CompanyActionTarget | null>(null);

  const columns = useMemo(
    () =>
      buildCompanyColumns({
        canModify,
        onAction: (action, company) => setTarget({ action, company }),
      }),
    [canModify],
  );
  const texts = useMemo(() => companyTableTexts(total), [total]);

  const handleParamsChange = (next: DataTableParams) => {
    startTransition(() => {
      router.replace(companyListHref(withSearchResetsPage(params, next)));
    });
  };

  return (
    <div
      data-testid={COMPANY_TABLE_TESTID}
      aria-busy={isPending}
      className={isPending ? 'opacity-60 transition-opacity' : 'transition-opacity'}
    >
      <DataTable
        tableId={COMPANY_TABLE_ID}
        columns={columns}
        rows={companies}
        getRowId={(company) => company.id}
        params={params}
        totalPages={totalPages}
        onParamsChange={handleParamsChange}
        status={status}
        texts={texts}
        states={buildStates(params, error)}
        card={COMPANY_CARD}
      />
    </div>
  );
}
