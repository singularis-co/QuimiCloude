import type { ReactNode } from 'react';

export type FormFooterBarProps = {
  /** Va pegado a la izquierda; el resto de acciones, a la derecha. */
  readonly leading?: ReactNode;
  readonly children: ReactNode;
  readonly testId?: string;
};

// Los márgenes negativos son el relleno de `PageShell`: el pie va de borde a borde del contenido y
// apoyado en su borde inferior.
export function FormFooterBar({ leading, children, testId }: FormFooterBarProps) {
  return (
    <footer
      data-slot="form-footer-bar"
      data-testid={testId}
      className="sticky bottom-0 z-10 -mx-4 -mb-6 flex flex-wrap items-center justify-end gap-3 border-t bg-card/92 px-4 pt-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] backdrop-blur-sm md:-mx-7 md:-mb-8 md:px-7"
    >
      {leading === undefined ? null : <div className="mr-auto flex items-center">{leading}</div>}
      {children}
    </footer>
  );
}
