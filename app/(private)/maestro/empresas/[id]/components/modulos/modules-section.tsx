import { ErrorState } from '@/components/shared/error-state';
import { getCompanyAddonsAction } from '@/lib/modules/identity/adapters/driving/company-actions';

import { AddonSwitchList } from './addon-switch-list';
import { CoreModuleChips } from './core-module-chips';

export const MODULES_SECTION_TESTIDS = {
  error: 'company-modules-error',
  retry: 'company-modules-retry',
} as const;

export const MODULES_SECTION_TEXTS = {
  error: 'No pudimos cargar los módulos',
} as const;

export type ModulesSectionProps = {
  readonly companyId: string;
  readonly companyName: string;
  readonly isDeleted: boolean;
  readonly canModify: boolean;
};

export async function ModulesSection({ companyId, companyName, isDeleted, canModify }: ModulesSectionProps) {
  const result = await getCompanyAddonsAction(companyId);

  if (result.status === 'error') {
    return (
      <ErrorState
        error={result}
        title={MODULES_SECTION_TEXTS.error}
        testId={MODULES_SECTION_TESTIDS.error}
        retry={{ kind: 'refresh' }}
        retryTestId={MODULES_SECTION_TESTIDS.retry}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <AddonSwitchList
        initialView={result.data}
        companyName={companyName}
        isDeleted={isDeleted}
        canModify={canModify}
      />
      <CoreModuleChips />
    </div>
  );
}
