import { Card } from '@/components/ui/card';
import type { CompanyDetail } from '@/lib/modules/identity';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { cn } from '@/lib/utils';

import {
  COMPANY_FIELD_LABELS,
  companyCountryLabel,
  formatCompanyDate,
} from '../../components';

export const COMPANY_DATA_PANEL_TESTID = 'company-data-panel';

export const COMPANY_DATA_LABELS = {
  ...COMPANY_FIELD_LABELS,
  createdAt: 'Creada',
  deletedAt: 'Dada de baja',
} as const;

type DataRowKey = keyof typeof COMPANY_DATA_LABELS;

type DataRow = {
  readonly key: DataRowKey;
  readonly value: string | null;
  readonly mono?: boolean;
  readonly strong?: boolean;
};

export function companyDataTestId(key: DataRowKey): string {
  return `company-data-${key}`;
}

function rowsOf(company: CompanyDetail): readonly DataRow[] {
  return [
    { key: 'name', value: company.name, strong: true },
    { key: 'taxId', value: company.taxId, mono: true },
    { key: 'contactEmail', value: company.contactEmail },
    { key: 'contactPhone', value: company.contactPhone, mono: true },
    { key: 'country', value: company.country === null ? null : companyCountryLabel(company.country) },
    { key: 'createdAt', value: formatCompanyDate(company.createdAt), mono: true },
    {
      key: 'deletedAt',
      value: company.deletedAt === null ? null : formatCompanyDate(company.deletedAt),
      mono: true,
    },
  ];
}

const CELL_CLASS = 'm-0 border-b border-border py-3 text-sm';
const LAST_CELL_CLASS = 'border-b-0';

export type CompanyDataPanelProps = {
  readonly company: CompanyDetail;
};

export function CompanyDataPanel({ company }: CompanyDataPanelProps) {
  const rows = rowsOf(company);
  const lastIndex = rows.length - 1;

  return (
    <Card data-testid={COMPANY_DATA_PANEL_TESTID} className="max-w-[760px] px-5 py-2">
      <dl className="m-0 grid grid-cols-[200px_minmax(0,1fr)] @max-[760px]:grid-cols-1">
        {rows.map(({ key, value, mono, strong }, index) => {
          const last = index === lastIndex;
          return (
            <div key={key} className="contents">
              <dt
                className={cn(
                  CELL_CLASS,
                  'text-muted-foreground @max-[760px]:border-b-0 @max-[760px]:pb-0',
                  last && LAST_CELL_CLASS,
                )}
              >
                {COMPANY_DATA_LABELS[key]}
              </dt>
              <dd
                data-testid={companyDataTestId(key)}
                className={cn(
                  CELL_CLASS,
                  'min-w-0 break-words @max-[760px]:pt-1',
                  mono && value !== null && 'font-mono',
                  strong && 'font-medium',
                  last && LAST_CELL_CLASS,
                )}
              >
                {value ?? EMPTY_MARK}
              </dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}
