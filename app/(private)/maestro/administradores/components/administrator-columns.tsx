'use client';

import { MailIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';

import { actionsColumn, type DataTableColumn } from '@/components/shared/data-table';
import type { RowActionMenuItem } from '@/components/shared/row-actions-menu';
import { StatusBadge } from '@/components/shared/status-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { AdministratorRow } from '@/lib/modules/identity';
import { maestroCompanyRoute } from '@/lib/shared/routes';
import { avatarTone } from '@/lib/shared/ui/avatar-tone';
import { getInitials } from '@/lib/shared/ui/initials';

import {
  ADMINISTRATOR_COLUMN_LABELS,
  ADMINISTRATOR_MENU_LABELS,
  administratorActionsLabel,
  administratorDisplayName,
  administratorStatusLabel,
} from './administrator-labels';
import {
  ADMINISTRATOR_COMPANY_COLUMN_ID,
  ADMINISTRATOR_EMAIL_COLUMN_ID,
  ADMINISTRATOR_NAME_COLUMN_ID,
  ADMINISTRATOR_USERNAME_COLUMN_ID,
} from './administrator-list-params';
import type { ActiveCompany } from './load-active-companies';

export const ADMINISTRATOR_COLUMN_COUNT = 6;

// Vive aquí y no con los parámetros de la URL: el estado no se filtra desde la dirección, y solo
// este archivo lo pinta.
export const ADMINISTRATOR_STATUS_COLUMN_ID = 'accountStatus';

export type AdministratorRowAction = 'edit' | 'resend' | 'delete';

export type AdministratorColumnsDeps = {
  readonly canModify: boolean;
  readonly companies: readonly ActiveCompany[];
  readonly onAction: (action: AdministratorRowAction, administrator: AdministratorRow) => void;
};

function administratorMenuItems(
  administrator: AdministratorRow,
  onAction: AdministratorColumnsDeps['onAction'],
): RowActionMenuItem[] {
  const items: RowActionMenuItem[] = [
    {
      key: 'edit',
      label: ADMINISTRATOR_MENU_LABELS.edit,
      icon: PencilIcon,
      onSelect: () => onAction('edit', administrator),
      testId: 'administrator-action-edit',
    },
  ];

  // El servidor solo reenvía a una cuenta que aún no fijó su contraseña.
  if (administrator.accountStatus === 'pending') {
    items.push({
      key: 'resend',
      label: ADMINISTRATOR_MENU_LABELS.resend,
      icon: MailIcon,
      onSelect: () => onAction('resend', administrator),
      testId: 'administrator-action-resend',
    });
  }

  items.push({
    key: 'delete',
    label: ADMINISTRATOR_MENU_LABELS.delete,
    icon: Trash2Icon,
    destructive: true,
    separatorBefore: true,
    onSelect: () => onAction('delete', administrator),
    testId: 'administrator-action-delete',
  });

  return items;
}

export function buildAdministratorColumns({
  canModify,
  companies,
  onAction,
}: AdministratorColumnsDeps): readonly DataTableColumn<AdministratorRow>[] {
  const columns: DataTableColumn<AdministratorRow>[] = [
    {
      id: ADMINISTRATOR_NAME_COLUMN_ID,
      label: ADMINISTRATOR_COLUMN_LABELS.name,
      align: 'start',
      cell: (administrator) => {
        const name = administratorDisplayName(administrator);
        return (
          <span className="inline-flex items-center gap-2" data-testid="administrator-name">
            <Avatar size="sm" tone={avatarTone(administrator.id)} aria-hidden="true">
              <AvatarFallback>{getInitials(name)}</AvatarFallback>
            </Avatar>
            <span className="font-sans font-semibold text-foreground">{name}</span>
          </span>
        );
      },
    },
    {
      id: ADMINISTRATOR_USERNAME_COLUMN_ID,
      label: ADMINISTRATOR_COLUMN_LABELS.username,
      align: 'start',
      tabular: true,
      cell: (administrator) => (
        <span data-testid="administrator-username">{administrator.username}</span>
      ),
    },
    {
      id: ADMINISTRATOR_EMAIL_COLUMN_ID,
      label: ADMINISTRATOR_COLUMN_LABELS.email,
      align: 'start',
      cell: (administrator) => <span data-testid="administrator-email">{administrator.email}</span>,
    },
    {
      id: ADMINISTRATOR_COMPANY_COLUMN_ID,
      label: ADMINISTRATOR_COLUMN_LABELS.company,
      align: 'start',
      filter: {
        kind: 'select',
        options: companies.map((company) => ({ value: company.id, label: company.name })),
      },
      cell: (administrator) => (
        <Link
          href={maestroCompanyRoute(administrator.company.id)}
          data-testid="administrator-company-link"
          className="rounded-sm text-foreground underline-offset-3 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {administrator.company.name}
        </Link>
      ),
    },
    {
      id: ADMINISTRATOR_STATUS_COLUMN_ID,
      label: ADMINISTRATOR_COLUMN_LABELS.status,
      align: 'start',
      cell: (administrator) => {
        const status = administratorStatusLabel(administrator.accountStatus);
        return (
          <StatusBadge
            tone={status.tone}
            label={status.label}
            data-testid="administrator-status"
            data-status={administrator.accountStatus}
          />
        );
      },
    },
  ];

  if (!canModify) return columns;

  return [
    ...columns,
    actionsColumn<AdministratorRow>({
      menu: (administrator) => {
        const name = administratorDisplayName(administrator);
        return {
          triggerLabel: administratorActionsLabel(name),
          title: name,
          triggerTestId: 'administrator-actions',
          items: administratorMenuItems(administrator, onAction),
        };
      },
    }),
  ];
}
