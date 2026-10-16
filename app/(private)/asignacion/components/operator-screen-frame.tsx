import type { ReactNode, Ref } from 'react';

import { ArrowLink } from '@/components/shared/arrow-link';
import { cn } from '@/lib/utils';

import { ThemeToggle } from '../../components/theme-toggle';

export type OperatorScreenFrameProps = {
  readonly back?: OperatorScreenBack;
  readonly phaseLabel?: string;
  readonly eyebrow: string;
  readonly eyebrowTestId?: string;
  readonly title: string;
  readonly titleTestId?: string;
  /** Sustituye a `back`, con `role="status"`. */
  readonly running?: string;
  readonly quantity?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly status?: ReactNode;
  readonly headerActions?: ReactNode;
  readonly progressSlotRef?: Ref<HTMLDivElement>;
  readonly footer?: ReactNode;
  readonly footerSlotRef?: Ref<HTMLDivElement>;
  /** Va fuera de la zona con scroll para no desplazarse con el contenido. */
  readonly overlay?: ReactNode;
  readonly testId: string;
  readonly children: ReactNode;
};

export type OperatorScreenBack = {
  readonly href: string;
  readonly label: string;
  readonly testId: string;
  readonly disabled?: boolean;
};

const CONTENT_WIDTH = 'mx-auto w-full max-w-[1120px]';

/**
 * Marco de pantalla del operario: alto de la ventana, cabecera arriba, pie abajo y solo el
 * contenido de en medio con scroll. La raíz es contenedor de consultas para que las pantallas
 * pasen a dos columnas por el ancho que de verdad tienen.
 */
export function OperatorScreenFrame({
  back,
  phaseLabel,
  eyebrow,
  eyebrowTestId,
  title,
  titleTestId,
  running,
  quantity,
  subtitle,
  status,
  headerActions,
  progressSlotRef,
  footer,
  footerSlotRef,
  overlay,
  testId,
  children,
}: OperatorScreenFrameProps) {
  const hasFooter = footer !== undefined || footerSlotRef !== undefined;

  return (
    <div
      // `app/globals.css` lo busca para ocultar la barra lateral y la cabecera privada.
      data-operator-screen=""
      data-testid={testId}
      className="@container relative flex h-dvh flex-col overflow-hidden bg-background"
    >
      <header
        className="sticky top-0 z-10 flex-none border-b border-border bg-card pt-[env(safe-area-inset-top)]"
        data-slot="operator-header"
      >
        <div
          className={cn(
            CONTENT_WIDTH,
            'flex flex-col gap-[18px] px-6 pt-5 pb-[22px]',
            '@max-[560px]:gap-3.5 @max-[560px]:px-4 @max-[560px]:pt-3.5 @max-[560px]:pb-4',
          )}
        >
          <div
            className="flex min-h-11 items-center justify-between gap-3"
            data-slot="operator-header-top"
          >
            {running !== undefined ? (
              <span
                role="status"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground"
                data-slot="operator-running"
              >
                <i
                  aria-hidden="true"
                  className="size-2 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_18%,transparent)]"
                />
                {running}
              </span>
            ) : back ? (
              <ArrowLink
                href={back.href}
                direction="back"
                touch
                testId={back.testId}
                disabled={back.disabled}
              >
                {back.label}
              </ArrowLink>
            ) : (
              <span />
            )}
            <div className="flex flex-none items-center gap-2" data-slot="operator-header-controls">
              {headerActions}
              <ThemeToggle />
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col">
              <span className="text-sm text-muted-foreground" data-slot="operator-phase">
                {phaseLabel ? `${phaseLabel} · ` : null}
                <span
                  className="font-mono tabular-nums"
                  data-slot="operator-eyebrow"
                  data-testid={eyebrowTestId}
                >
                  {eyebrow}
                </span>
              </span>
              <h1
                className="m-0 mt-1 text-[30px] leading-[1.15] font-bold tracking-[-0.01em] @max-[560px]:text-2xl"
                data-testid={titleTestId}
              >
                {title}
              </h1>
              {quantity ? (
                <div className="mt-3 flex flex-wrap gap-2" data-slot="operator-meta">
                  {quantity}
                </div>
              ) : subtitle ? (
                <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
              ) : null}
            </div>
            {status ? <div className="flex-none">{status}</div> : null}
          </div>

          {progressSlotRef ? <div ref={progressSlotRef} data-slot="operator-progress" /> : null}
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        data-slot="operator-scroll"
      >
        <div className={cn(CONTENT_WIDTH, 'flex flex-col gap-5 p-5')} data-slot="operator-body">
          {children}
        </div>
      </div>

      {hasFooter ? (
        <footer
          className="flex-none border-t border-border bg-card px-4 pt-3 pb-[calc(14px+env(safe-area-inset-bottom))]"
          data-slot="operator-footer"
        >
          <div className="mx-auto w-full max-w-[720px]">
            {footer}
            {footerSlotRef ? <div ref={footerSlotRef} data-slot="operator-footer-slot" /> : null}
          </div>
        </footer>
      ) : null}

      {overlay}
    </div>
  );
}
