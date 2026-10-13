import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type PageShellProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

// Sin animación de entrada: la pone el layout privado.
export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      data-slot="page-shell"
      className={cn(
        '@container flex flex-1 flex-col gap-5 px-4 pt-4 pb-6 md:px-7 md:pt-6 md:pb-8',
        className,
      )}
    >
      {children}
    </div>
  );
}
