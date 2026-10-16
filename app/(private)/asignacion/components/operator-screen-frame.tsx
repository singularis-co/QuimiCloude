import type { ReactNode } from 'react';

import { ArrowLink } from '@/components/shared/arrow-link';
import { cn } from '@/lib/utils';

import { ThemeToggle } from '../../components/theme-toggle';

export type OperatorScreenFrameProps = {
  readonly back?: OperatorScreenBack;
  readonly eyebrow: string;
  readonly eyebrowTestId?: string;
  readonly title: string;
  readonly titleTestId?: string;
  readonly subtitle?: ReactNode;
  readonly status?: ReactNode;
  readonly headerActions?: ReactNode;
  readonly footer?: ReactNode;
  readonly testId: string;
  readonly children: ReactNode;
};

export type OperatorScreenBack = {
  readonly href: string;
  readonly label: string;
  readonly testId: string;
  /** Pedido ya comenzado por quien lo mira: la vuelta se ve, pero no navega hasta terminarlo. */
  readonly disabled?: boolean;
};

const CONTENT_WIDTH = 'mx-auto w-full max-w-[1064px]';

/** Reserva del pie fijo de `StepReader` (`mode="ejecucion"`) en la columna lateral, solo con dos
 *  columnas. Mismo `calc` que el `pb-[…]` de `step-reader.tsx`: lo vigila order-execution-screen.test.tsx. */
export const STEP_READER_SIDE_COLUMN_RESERVE =
  '@min-[1101px]:mb-[calc(140px+env(safe-area-inset-bottom,0px))]';

/**
 * Marco de pantalla del operario: cabecera pegada arriba, pie fijo abajo y, entre ambos, el
 * contenido. La raíz es contenedor de consultas para que las pantallas pasen a dos columnas
 * por el ancho que de verdad tienen.
 */
export function OperatorScreenFrame({
  back,
  eyebrow,
  eyebrowTestId,
  title,
  titleTestId,
  subtitle,
  status,
  headerActions,
  footer,
  testId,
  children,
}: OperatorScreenFrameProps) {
  const controls = (
    <div className="flex flex-none items-center gap-2" data-slot="operator-header-controls">
      {headerActions}
      <ThemeToggle />
    </div>
  );

  const heading = (
    <div className="flex min-w-0 flex-1 flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className="font-mono text-xs text-muted-foreground tabular-nums"
          data-slot="operator-eyebrow"
          data-testid={eyebrowTestId}
        >
          {eyebrow}
        </span>
        <h1 className="m-0 text-[22px] leading-tight font-semibold" data-testid={titleTestId}>
          {title}
        </h1>
        {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
      </div>
      {status ? <div className="flex-none">{status}</div> : null}
    </div>
  );

  return (
    <div
      // `app/globals.css` lo busca para ocultar la barra lateral y la cabecera privada.
      data-operator-screen=""
      data-testid={testId}
      className="@container flex min-h-dvh flex-col bg-background"
    >
      <header
        className="sticky top-0 z-10 border-b border-border bg-card"
        data-slot="operator-header"
      >
        <div className={cn(CONTENT_WIDTH, 'flex flex-col gap-3 px-5 pt-3 pb-3.5')}>
          {back ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <ArrowLink
                  href={back.href}
                  direction="back"
                  touch
                  testId={back.testId}
                  disabled={back.disabled}
                >
                  {back.label}
                </ArrowLink>
                {controls}
              </div>
              {heading}
            </>
          ) : (
            <div className="flex items-start justify-between gap-3">
              {heading}
              {controls}
            </div>
          )}
        </div>
      </header>

      <div
        className={cn(
          CONTENT_WIDTH,
          'flex flex-1 flex-col gap-5 p-5',
          // Reserva el alto del pie fijo para que el final del contenido no quede debajo.
          footer && 'pb-[calc(132px+env(safe-area-inset-bottom))]',
        )}
        data-slot="operator-body"
      >
        {children}
      </div>

      {footer ? (
        <footer
          className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card px-4 pt-3 pb-[calc(14px+env(safe-area-inset-bottom))]"
          data-slot="operator-footer"
        >
          <div className={CONTENT_WIDTH}>{footer}</div>
        </footer>
      ) : null}
    </div>
  );
}
