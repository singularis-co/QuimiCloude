'use client';

import { PencilIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useState } from 'react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import type { CompanyDetail } from '@/lib/modules/identity';
import { COMPANIES_LABEL } from '@/lib/shared/navigation/private-nav';
import { MAESTRO_COMPANIES_ROUTE } from '@/lib/shared/routes';

import {
  COMPANY_MENU_LABELS,
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_TONES,
  CompanyDeleteDialog,
  CompanyEditSheet,
  CompanyReactivateDialog,
} from '../../components';

export const COMPANY_DETAIL_TITLE_TESTID = 'company-detail-title';
export const COMPANY_DETAIL_STATUS_TESTID = 'company-detail-status';
export const COMPANY_DETAIL_EDIT_TESTID = 'company-detail-edit';
export const COMPANY_DETAIL_DELETE_TESTID = 'company-detail-delete';
export const COMPANY_DETAIL_REACTIVATE_TESTID = 'company-detail-reactivate';

export const COMPANY_DETAIL_BREADCRUMB_NAV_LABEL = 'Ruta de navegación';

type HeaderAction = 'edit' | 'delete' | 'reactivate';

export type CompanyDetailHeaderProps = {
  readonly company: CompanyDetail;
  readonly canModify: boolean;
};

export function CompanyDetailHeader({ company, canModify }: CompanyDetailHeaderProps) {
  const [open, setOpen] = useState<HeaderAction | null>(null);
  const close = useCallback((next: boolean) => {
    if (!next) setOpen(null);
  }, []);
  const active = company.status === 'active';

  const actions = canModify ? (
    <>
      <Button
        type="button"
        variant="outline"
        touch
        onClick={() => setOpen('edit')}
        data-testid={COMPANY_DETAIL_EDIT_TESTID}
      >
        <PencilIcon aria-hidden="true" />
        {COMPANY_MENU_LABELS.edit}
      </Button>
      {active ? (
        <Button
          type="button"
          variant="outline"
          touch
          className="text-destructive"
          onClick={() => setOpen('delete')}
          data-testid={COMPANY_DETAIL_DELETE_TESTID}
        >
          <Trash2Icon aria-hidden="true" />
          {COMPANY_MENU_LABELS.delete}
        </Button>
      ) : (
        <Button
          type="button"
          touch
          onClick={() => setOpen('reactivate')}
          data-testid={COMPANY_DETAIL_REACTIVATE_TESTID}
        >
          <RotateCcwIcon aria-hidden="true" />
          {COMPANY_MENU_LABELS.reactivate}
        </Button>
      )}
    </>
  ) : undefined;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span data-testid={COMPANY_DETAIL_TITLE_TESTID}>{company.name}</span>
            <StatusBadge
              tone={COMPANY_STATUS_TONES[company.status]}
              label={COMPANY_STATUS_LABELS[company.status]}
              className="text-sm font-normal tracking-normal"
              data-testid={COMPANY_DETAIL_STATUS_TESTID}
            />
          </span>
        }
        breadcrumb={{
          label: COMPANY_DETAIL_BREADCRUMB_NAV_LABEL,
          items: [
            { label: COMPANIES_LABEL, href: MAESTRO_COMPANIES_ROUTE },
            { label: company.name },
          ],
        }}
        actions={actions}
      />
      {/* Montados solo mientras están abiertos: cada apertura empieza limpia. */}
      {open === 'edit' ? (
        <CompanyEditSheet companyId={company.id} detail={company} open onOpenChange={close} />
      ) : null}
      {open === 'delete' ? <CompanyDeleteDialog company={company} open onOpenChange={close} /> : null}
      {open === 'reactivate' ? (
        <CompanyReactivateDialog company={company} open onOpenChange={close} />
      ) : null}
    </>
  );
}
