import { LockIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import { CORE_MODULE_NAMES } from './core-modules';

export const CORE_MODULES_TESTID = 'company-core-modules';

export const CORE_MODULES_TEXTS = {
  title: 'Núcleo',
  subtitle: 'Siempre prendido en todas las empresas. No se puede apagar.',
} as const;

const HEADING_ID = 'company-core-modules-heading';

export function CoreModuleChips() {
  return (
    <section aria-labelledby={HEADING_ID} data-testid={CORE_MODULES_TESTID} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={HEADING_ID} className="text-lg font-semibold">
          {CORE_MODULES_TEXTS.title}
        </h2>
        <p className="text-sm text-muted-foreground">{CORE_MODULES_TEXTS.subtitle}</p>
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {CORE_MODULE_NAMES.map((name) => (
          <li key={name}>
            <Badge
              variant="outline"
              className="h-8 gap-1.5 bg-card px-3 text-[13px] font-normal [&>svg]:size-3.5! [&>svg]:text-muted-foreground"
            >
              <LockIcon aria-hidden="true" />
              {name}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
