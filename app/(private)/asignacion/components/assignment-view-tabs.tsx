import { UrlTabs } from '@/components/shared/url-tabs';
import type { AssignmentViewKind } from '@/lib/modules/asignaciones';

import { assignmentViewHref } from './assignment-view-params';

export const ASSIGNMENT_VIEW_TABS_TESTID = 'assignment-view-tabs';
export const ASSIGNMENT_VIEW_TABS_LABEL = 'Vistas de asignación';

export const ASSIGNMENT_VIEW_LABELS: Readonly<Record<AssignmentViewKind, string>> = {
  asignados: 'Mis asignados',
  terminados: 'Terminados',
  todos: 'Todos',
  por_empacar: 'Por empacar',
  por_acondicionar: 'Por acondicionar',
  acondicionados: 'Acondicionados',
};

export const ASSIGNMENT_VIEW_TAB_TESTIDS: Readonly<Record<AssignmentViewKind, string>> = {
  asignados: 'assignment-view-tab-asignados',
  terminados: 'assignment-view-tab-terminados',
  todos: 'assignment-view-tab-todos',
  por_empacar: 'assignment-view-tab-por_empacar',
  por_acondicionar: 'assignment-view-tab-por_acondicionar',
  acondicionados: 'assignment-view-tab-acondicionados',
};

export type AssignmentViewCounts = Readonly<Partial<Record<AssignmentViewKind, number>>>;

export type AssignmentViewTabsProps = {
  /** La vista vigente, ya resuelta en el servidor a partir de la direccion. */
  readonly current: AssignmentViewKind;
  /** Las vistas que este usuario puede ver, en el orden en que se ofrecen. */
  readonly views: readonly AssignmentViewKind[];
  /** Una vista sin entrada se pinta sin contador. */
  readonly counts?: AssignmentViewCounts;
};

export function AssignmentViewTabs({ current, views, counts }: AssignmentViewTabsProps) {
  return (
    <UrlTabs
      label={ASSIGNMENT_VIEW_TABS_LABEL}
      testId={ASSIGNMENT_VIEW_TABS_TESTID}
      current={current}
      items={views.map((view) => ({
        value: view,
        href: assignmentViewHref(view),
        label: ASSIGNMENT_VIEW_LABELS[view],
        count: counts?.[view],
        testId: ASSIGNMENT_VIEW_TAB_TESTIDS[view],
      }))}
    />
  );
}
