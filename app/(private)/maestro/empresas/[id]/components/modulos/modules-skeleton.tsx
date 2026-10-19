import { Spinner } from '@/components/shared/spinner';
import { Skeleton } from '@/components/ui/skeleton';

export const MODULES_SKELETON_TESTID = 'company-modules-skeleton';
export const MODULES_LOADING_TEXT = 'Cargando los módulos…';

const SKELETON_ROWS = 4;

export function ModulesSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={MODULES_LOADING_TEXT}
      data-testid={MODULES_SKELETON_TESTID}
      className="flex flex-col gap-3"
    >
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner />
        {MODULES_LOADING_TEXT}
      </span>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton key={index} className="h-[68px] w-full rounded-xl" />
      ))}
    </div>
  );
}
