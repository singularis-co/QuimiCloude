import { Suspense } from 'react';

import { ModulesSection } from './modules-section';
import { ModulesSkeleton } from './modules-skeleton';

export type CompanyModulesTabProps = {
  readonly companyId: string;
  readonly companyName: string;
  readonly isDeleted: boolean;
  readonly canModify: boolean;
};

// El panel con su rol y su nombre accesible lo pinta la página del detalle.
export function CompanyModulesTab({ companyId, companyName, isDeleted, canModify }: CompanyModulesTabProps) {
  return (
    <Suspense fallback={<ModulesSkeleton />}>
      <ModulesSection
        companyId={companyId}
        companyName={companyName}
        isDeleted={isDeleted}
        canModify={canModify}
      />
    </Suspense>
  );
}
