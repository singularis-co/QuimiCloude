'use client';

import { useCallback, useId, useRef, useState, type ReactNode } from 'react';

import { XIcon, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import {
  OPERATOR_SECTION_TONE_CLASSES,
  OrderExecutionCollapsibleCard,
  type OperatorSectionTone,
} from './order-execution-collapsible-card';

export type OperatorSection = {
  readonly key: OperatorSectionTone;
  readonly title: string;
  readonly icon: LucideIcon;
  readonly count: number;
  readonly content: ReactNode;
  readonly testIds: {
    readonly card: string;
    readonly trigger: string;
    readonly count: string;
    readonly content: string;
    readonly fab: string;
  };
};

export type OperatorSidePanelsProps = {
  /** Ya en el orden de la pantalla y sin las secciones vacías. */
  readonly sections: readonly OperatorSection[];
  readonly columnTestId?: string;
};

export type OperatorSidePanels = {
  readonly column: ReactNode;
  readonly overlay: ReactNode;
};

export const OPERATOR_SIDE_PANELS_TEXTS = {
  close: 'Cerrar',
  open: (title: string) => `Ver ${title.toLocaleLowerCase('es')}`,
  and: 'y',
} as const;

export const OPERATOR_SIDE_PANELS_FABS_TESTID = 'operator-side-panels-fabs';
export const OPERATOR_SIDE_PANEL_CLOSE_TESTID = 'operator-side-panel-close';
export const OPERATOR_SIDE_PANEL_BODY_TESTID = 'operator-side-panel-body';

export function operatorSidePanelTestId(key: OperatorSectionTone): string {
  return `operator-side-panel-${key}`;
}

/** «Materiales y herramientas», «Envases y equipo», «Envases». */
export function operatorSectionsLabel(titles: readonly string[]): string {
  const [first, ...rest] = titles;
  if (first === undefined) return '';
  const tail = rest.map((title) => title.toLocaleLowerCase('es'));
  const last = tail.pop();
  if (last === undefined) return first;
  return `${[first, ...tail].join(', ')} ${OPERATOR_SIDE_PANELS_TEXTS.and} ${last}`;
}

// Literales completos: Tailwind solo genera las clases que encuentra escritas en el código.
const FAB_OPEN_RING_CLASSES: Record<OperatorSectionTone, string> = {
  materials: 'aria-expanded:outline-(--section-materials)/40',
  tools: 'aria-expanded:outline-(--section-tools)/40',
  team: 'aria-expanded:outline-(--section-team)/40',
};

/** Las dos mitades de las secciones: la columna lateral y la capa de botones flotantes y panel. */
export function useOperatorSidePanels({
  sections,
  columnTestId,
}: OperatorSidePanelsProps): OperatorSidePanels {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const [active, setActive] = useState<OperatorSectionTone | null>(null);
  // Se queda con la última abierta para que el panel no se vacíe mientras se anima su cierre.
  const [shown, setShown] = useState<OperatorSectionTone | null>(null);
  const fabs = useRef(new Map<OperatorSectionTone, HTMLButtonElement>());
  // Base UI no devuelve el foco tras un toque fuera donde `focus()` no admite `preventScroll`
  // (Chrome Android). Aquí no hay salto de scroll: el botón vive fuera de la zona con scroll.
  const refocusAfterOutsidePress = useRef(false);

  const open = useCallback((key: OperatorSectionTone) => {
    setShown(key);
    setActive((current) => (current === key ? null : key));
  }, []);

  // Safari no enfoca un botón al pulsarlo, así que el foco previo no es siempre el botón.
  const finalFocus = useCallback(
    () => (shown === null ? true : (fabs.current.get(shown) ?? true)),
    [shown],
  );

  const shownSection = sections.find((section) => section.key === shown);

  const column = (
    <aside
      aria-label={operatorSectionsLabel(sections.map((section) => section.title))}
      className="flex min-w-0 flex-col gap-4 @max-[1000px]:hidden"
      data-testid={columnTestId}
    >
      {sections.map((section) => (
        <OrderExecutionCollapsibleCard
          key={section.key}
          icon={section.icon}
          title={section.title}
          titleId={`${baseId}-${section.key}-title`}
          count={section.count}
          tone={section.key}
          testIds={{
            card: section.testIds.card,
            trigger: section.testIds.trigger,
            count: section.testIds.count,
            content: section.testIds.content,
          }}
        >
          {section.content}
        </OrderExecutionCollapsibleCard>
      ))}
    </aside>
  );

  const overlay = (
    <div className="@min-[1001px]:hidden">
      <div
        className={cn(
          'absolute right-4 bottom-[calc(132px+env(safe-area-inset-bottom))] z-20 flex flex-col gap-3',
          active !== null && '@max-[560px]:hidden',
        )}
        data-testid={OPERATOR_SIDE_PANELS_FABS_TESTID}
      >
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Button
              key={section.key}
              ref={(node: HTMLButtonElement | null) => {
                if (node) fabs.current.set(section.key, node);
                else fabs.current.delete(section.key);
              }}
              type="button"
              className={cn(
                'relative size-14 rounded-full text-(--section-foreground) shadow-[0_6px_18px_-6px_color-mix(in_oklch,var(--foreground)_40%,transparent)] aria-expanded:outline-[3px] aria-expanded:outline-offset-2 aria-expanded:outline-solid',
                OPERATOR_SECTION_TONE_CLASSES[section.key],
                FAB_OPEN_RING_CLASSES[section.key],
              )}
              aria-label={OPERATOR_SIDE_PANELS_TEXTS.open(section.title)}
              aria-expanded={active === section.key}
              aria-controls={panelId}
              data-tone={section.key}
              data-testid={section.testIds.fab}
              onClick={() => open(section.key)}
            >
              <Icon aria-hidden="true" className="size-[22px]" />
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-foreground px-1.5 font-mono text-[11px] text-background tabular-nums"
              >
                {section.count}
              </span>
            </Button>
          );
        })}
      </div>

      <Dialog
        open={active !== null}
        onOpenChange={(next, details) => {
          if (next) return;
          setActive(null);
          refocusAfterOutsidePress.current = details.reason === 'outside-press';
        }}
        onOpenChangeComplete={(isOpen) => {
          if (isOpen || !refocusAfterOutsidePress.current) return;
          refocusAfterOutsidePress.current = false;
          const fab = shown === null ? undefined : fabs.current.get(shown);
          if (fab && (document.activeElement === null || document.activeElement === document.body)) {
            fab.focus({ preventScroll: true });
          }
        }}
      >
        {shownSection ? (
          <DialogContent
            id={panelId}
            showCloseButton={false}
            finalFocus={finalFocus}
            data-testid={operatorSidePanelTestId(shownSection.key)}
            data-tone={shownSection.key}
            className={cn(
              // El marco ocupa toda la ventana, así que sus cortes de ancho coinciden con los de
              // la ventana aunque el panel se pinte fuera de él, en el portal.
              'top-auto right-[88px] bottom-[calc(132px+env(safe-area-inset-bottom))] left-auto flex max-h-[calc(100dvh-300px)] w-[min(380px,calc(100%-104px))] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl bg-card p-0 sm:max-w-none',
              'max-[560px]:inset-x-4 max-[560px]:bottom-[calc(140px+env(safe-area-inset-bottom))] max-[560px]:max-h-[calc(100dvh-338px)] max-[560px]:w-auto',
            )}
          >
            <div
              className={cn(
                'flex flex-none items-center justify-between gap-2 py-2 pr-2 pl-[18px] text-(--section-foreground)',
                OPERATOR_SECTION_TONE_CLASSES[shownSection.key],
              )}
              data-slot="operator-side-panel-header"
            >
              <DialogTitle
                className="flex items-center gap-2 text-base leading-normal font-semibold"
              >
                <shownSection.icon aria-hidden="true" className="size-5" />
                {shownSection.title}
                <span className="rounded-full bg-(--section-foreground)/22 px-2 py-0.5 font-mono text-sm tabular-nums">
                  {shownSection.count}
                </span>
              </DialogTitle>
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 text-(--section-foreground)"
                  />
                }
                aria-label={OPERATOR_SIDE_PANELS_TEXTS.close}
                data-testid={OPERATOR_SIDE_PANEL_CLOSE_TESTID}
              >
                <XIcon aria-hidden="true" className="size-5" />
              </DialogClose>
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[18px] pt-3.5 pb-[18px]"
              data-testid={OPERATOR_SIDE_PANEL_BODY_TESTID}
            >
              {shownSection.content}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );

  return { column, overlay };
}
