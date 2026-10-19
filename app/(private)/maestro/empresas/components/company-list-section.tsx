import type { DataTableParams } from '@/components/shared/data-table';
import { listCompaniesAction } from '@/lib/modules/identity/adapters/driving/company-actions';

import { CompanyTable } from './company-table';

export type CompanyListSectionProps = {
  readonly params: DataTableParams;
  readonly canModify: boolean;
};

export async function CompanyListSection({ params, canModify }: CompanyListSectionProps) {
  const result = await listCompaniesAction(params);

  if (result.status === 'error') {
    return (
      <CompanyTable
        status="error"
        error={result}
        companies={[]}
        params={params}
        total={0}
        totalPages={0}
        canModify={canModify}
      />
    );
  }

  const { items, total, totalPages } = result.data;
  return (
    <CompanyTable
      companies={items}
      params={params}
      total={total}
      totalPages={totalPages}
      canModify={canModify}
    />
  );
}
