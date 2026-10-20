'use client';

import { ArrowRightIcon, PencilIcon, RotateCcwIcon, SquarePlusIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';

import { actionsColumn, type DataTableColumn } from '@/components/shared/data-table';
import type { RowActionMenuItem } from '@/components/shared/row-actions-menu';
import { StatusBadge } from '@/components/shared/status-badge';
import type { CompanyRow } from '@/lib/modules/identity';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { maestroCompanyRoute } from '@/lib/shared/routes';

import { CompanyAddonAvatars } from './company-addon-avatars';
import {
  COMPANY_COLUMN_LABELS,
  COMPANY_CONTACT_EMPTY_LABELS,
  COMPANY_CREATED_PREFIX,
  COMPANY_MENU_LABELS,
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_TONES,
  COMPANY_USERS_SUFFIX,
  companyActionsLabel,
  companyCountryLabel,
  formatCompanyDate,
} from './company-labels';
import { CREATED_AT_COLUMN_ID, NAME_COLUMN_ID, STATUS_COLUMN_ID } from './company-list-params';

export const TAX_ID_COLUMN_ID = 'taxId';
export const COUNTRY_COLUMN_ID = 'country';
export const USERS_COLUMN_ID = 'liveUserCount';
export const CONTACT_COLUMN_ID = 'contact';
export const MODULES_COLUMN_ID = 'modules';

export const COMPANY_COLUMN_COUNT = 9;

// Solo se ven en la tarjeta: en la tabla la cabecera de la columna ya dice qué es el dato.
const CARD_ONLY = 'hidden @max-[760px]:inline';

function ContactLine({ value, emptyLabel }: { readonly value: string | null; readonly emptyLabel: string }) {
  return value === null ? (
    <span aria-label={emptyLabel} data-empty="true" className="text-muted-foreground">
      {EMPTY_MARK}
    </span>
  ) : (
    <span className="break-all">{value}</span>
  );
}

function CompanyContact({ company }: { readonly company: CompanyRow }) {
  if (company.contactEmail === null && company.contactPhone === null) {
    return (
      <span aria-label={COMPANY_CONTACT_EMPTY_LABELS.both} data-testid="company-contact" data-empty="true">
        {EMPTY_MARK}
      </span>
    );
  }
  return (
    <span className="flex flex-col" data-testid="company-contact">
      <span data-testid="company-contact-email">
        <ContactLine value={company.contactEmail} emptyLabel={COMPANY_CONTACT_EMPTY_LABELS.email} />
      </span>
      <span data-testid="company-contact-phone" className="tabular-nums">
        <ContactLine value={company.contactPhone} emptyLabel={COMPANY_CONTACT_EMPTY_LABELS.phone} />
      </span>
    </span>
  );
}

export type CompanyRowAction = 'edit' | 'delete' | 'reactivate';

export type CompanyColumnsDeps = {
  readonly canModify: boolean;
  readonly onAction: (action: CompanyRowAction, company: CompanyRow) => void;
};

function companyMenuItems(
  company: CompanyRow,
  { canModify, onAction }: CompanyColumnsDeps,
): RowActionMenuItem[] {
  const live = company.status === 'active';
  const items: RowActionMenuItem[] = [
    {
      key: 'open',
      label: COMPANY_MENU_LABELS.open,
      icon: ArrowRightIcon,
      href: maestroCompanyRoute(company.id),
      testId: 'company-action-open',
    },
  ];

  if (canModify) {
    items.push({
      key: 'edit',
      label: COMPANY_MENU_LABELS.edit,
      icon: PencilIcon,
      onSelect: () => onAction('edit', company),
      testId: 'company-action-edit',
    });
  }

  if (live) {
    items.push({
      key: 'modules',
      label: COMPANY_MENU_LABELS.modules,
      icon: SquarePlusIcon,
      href: maestroCompanyRoute(company.id, 'modulos'),
      testId: 'company-action-modules',
    });
  }

  if (canModify && live) {
    items.push({
      key: 'delete',
      label: COMPANY_MENU_LABELS.delete,
      icon: Trash2Icon,
      destructive: true,
      separatorBefore: true,
      onSelect: () => onAction('delete', company),
      testId: 'company-action-delete',
    });
  }

  if (canModify && !live) {
    items.push({
      key: 'reactivate',
      label: COMPANY_MENU_LABELS.reactivate,
      icon: RotateCcwIcon,
      separatorBefore: true,
      onSelect: () => onAction('reactivate', company),
      testId: 'company-action-reactivate',
    });
  }

  return items;
}

export function buildCompanyColumns(deps: CompanyColumnsDeps): readonly DataTableColumn<CompanyRow>[] {
  return [
    {
      id: NAME_COLUMN_ID,
      label: COMPANY_COLUMN_LABELS.name,
      align: 'start',
      sortable: true,
      cell: (company) => (
        <Link
          href={maestroCompanyRoute(company.id)}
          data-testid="company-name-link"
          className="rounded-sm font-sans font-semibold text-foreground underline-offset-3 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {company.name}
        </Link>
      ),
    },
    {
      id: TAX_ID_COLUMN_ID,
      label: COMPANY_COLUMN_LABELS.taxId,
      align: 'start',
      tabular: true,
      cell: (company) =>
        company.taxId === null ? (
          <span aria-label="Sin identificación fiscal" data-testid="company-tax-id" data-empty="true">
            {EMPTY_MARK}
          </span>
        ) : (
          <span data-testid="company-tax-id">{company.taxId}</span>
        ),
    },
    {
      id: CONTACT_COLUMN_ID,
      label: COMPANY_COLUMN_LABELS.contact,
      align: 'start',
      cell: (company) => <CompanyContact company={company} />,
    },
    {
      id: COUNTRY_COLUMN_ID,
      label: COMPANY_COLUMN_LABELS.country,
      align: 'start',
      cell: (company) => (
        <span
          data-testid="company-country"
          className={company.country === null ? 'text-muted-foreground' : undefined}
        >
          {companyCountryLabel(company.country)}
        </span>
      ),
    },
    {
      id: USERS_COLUMN_ID,
      label: COMPANY_COLUMN_LABELS.liveUserCount,
      align: 'end',
      tabular: true,
      cell: (company) => (
        <span data-testid="company-users">
          {company.liveUserCount}
          <span className={CARD_ONLY}>{COMPANY_USERS_SUFFIX}</span>
        </span>
      ),
    },
    {
      id: MODULES_COLUMN_ID,
      label: COMPANY_COLUMN_LABELS.modules,
      align: 'start',
      cell: (company) => <CompanyAddonAvatars addons={company.activeAddons} />,
    },
    {
      id: CREATED_AT_COLUMN_ID,
      label: COMPANY_COLUMN_LABELS.createdAt,
      align: 'start',
      tabular: true,
      sortable: true,
      cell: (company) => (
        <span data-testid="company-created-at">
          <span className={`${CARD_ONLY} font-sans`}>{COMPANY_CREATED_PREFIX}</span>
          {formatCompanyDate(company.createdAt)}
        </span>
      ),
    },
    {
      id: STATUS_COLUMN_ID,
      label: COMPANY_COLUMN_LABELS.status,
      align: 'start',
      filter: {
        kind: 'select',
        options: [
          { value: 'active', label: COMPANY_STATUS_LABELS.active },
          { value: 'deleted', label: COMPANY_STATUS_LABELS.deleted },
        ],
      },
      cell: (company) => (
        <StatusBadge
          tone={COMPANY_STATUS_TONES[company.status]}
          label={COMPANY_STATUS_LABELS[company.status]}
          data-testid="company-status"
          data-status={company.status}
        />
      ),
    },
    actionsColumn<CompanyRow>({
      menu: (company) => ({
        triggerLabel: companyActionsLabel(company.name),
        title: company.name,
        triggerTestId: 'company-actions',
        items: companyMenuItems(company, deps),
      }),
    }),
  ];
}
