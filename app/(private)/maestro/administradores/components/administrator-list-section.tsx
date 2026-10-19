import type { DataTableParams } from '@/components/shared/data-table';
import { listAdministratorsAction } from '@/lib/modules/identity/adapters/driving/administrator-actions';

import { AdministratorTable } from './administrator-table';
import type { ActiveCompany } from './load-active-companies';

export type AdministratorListSectionProps = {
  readonly params: DataTableParams;
  readonly companies: readonly ActiveCompany[];
  readonly canModify: boolean;
};

export async function AdministratorListSection({
  params,
  companies,
  canModify,
}: AdministratorListSectionProps) {
  const result = await listAdministratorsAction(params);

  if (result.status === 'error') {
    return (
      <AdministratorTable
        status="error"
        error={result}
        administrators={[]}
        companies={companies}
        params={params}
        total={0}
        totalPages={0}
        canModify={canModify}
      />
    );
  }

  const { items, total, totalPages } = result.data;
  return (
    <AdministratorTable
      administrators={items}
      companies={companies}
      params={params}
      total={total}
      totalPages={totalPages}
      canModify={canModify}
    />
  );
}
