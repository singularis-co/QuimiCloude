'use client';

import { Fragment, useId, useState, type ComponentType, type ReactNode } from 'react';

import { EllipsisIcon, MoreVerticalIcon, XIcon } from 'lucide-react';
import Link from 'next/link';

import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

/**
 * Menu "de los 3 puntos" para las acciones de una fila: UN disparador siempre presente en el DOM
 * (icono `MoreVerticalIcon`, objetivo tactil de 44x44 px) que abre un `DropdownMenu` con una
 * accion por item.
 *
 * Generico: no conoce ningun dominio (ni usuarios, ni pedidos, ni nada de `lib/modules/`). Cada
 * pantalla decide sus propios `items` (icono, etiqueta, callback) y este componente solo los pinta.
 *
 * Decision humana puntual, pedida por chat y solo para la pantalla de usuarios: agrupar las
 * acciones de fila tras este menu. Esto NO deroga la regla general de que los botones EN LINEA del
 * resto del repo deben seguir siempre visibles y en el DOM, nunca detras de un `:hover` ni de un
 * desplegable que los esconda del arbol -esa regla sigue vigente donde ya se aplicaba-. Lo que
 * cambia aqui es solo que las acciones individuales viven dentro de un menu que se abre con un
 * clic; el disparador en si sigue siempre visible, siempre en el DOM y con su propio objetivo
 * tactil, igual que cualquier otro boton de accion del repo.
 */

/** El primitivo trae `px-1.5 py-1 gap-1.5` (~28 px): demasiado justo para tocar con el dedo. */
const ITEM_TOUCH_TARGET = 'min-h-11 gap-2.5 px-3 py-2.5';

/** Aire alrededor de los items; el primitivo trae `p-1`. */
const CONTENT_PADDING = 'p-1.5';

export type RowActionMenuItem = {
  readonly key: string;
  readonly label: string;
  /** Componente de icono de lucide-react, p. ej. `PencilIcon`. */
  readonly icon: ComponentType<{ 'aria-hidden'?: boolean | 'true' | 'false' }>;
  readonly disabled?: boolean;
  readonly destructive?: boolean;
  /** `data-testid` de ESTE item del menu. Sin valor, no lleva ninguno. */
  readonly testId?: string;
  /** Línea divisoria delante de este ítem. En el primer ítem no se pinta. */
  readonly separatorBefore?: boolean;
  /**
   * Rótulo no interactivo delante de este ítem: abre un grupo (`role="group"` con nombre) que llega
   * hasta el siguiente rótulo o la siguiente línea. Combina con `separatorBefore`: línea, rótulo, ítem.
   */
  readonly groupLabel?: string;
} & (
  | { readonly onSelect: () => void; readonly href?: undefined }
  /** Item enlace: se pinta como `<a href>` y navega a esa ruta. */
  | { readonly href: string; readonly onSelect?: () => void }
);

export type RowActionsMenuProps = {
  readonly items: readonly RowActionMenuItem[];
  /** `aria-label` del disparador (los 3 puntos), p. ej. "Acciones de Ana Torres". */
  readonly triggerLabel: string;
  /** `data-testid` del disparador. */
  readonly triggerTestId?: string;
  /**
   * Atributos `data-*` extra para el boton disparador (p. ej. identificar la fila para un
   * localizador E2E). El componente no interpreta su contenido: solo los reenvia.
   */
  readonly triggerDataAttributes?: Readonly<Record<`data-${string}`, string>>;
  /** `centered`: botón «Acciones» que abre los ítems en un diálogo centrado, para las tarjetas. */
  readonly presentation?: 'dropdown' | 'centered';
  /** Título del diálogo centrado. Sin valor, `triggerLabel`. */
  readonly title?: ReactNode;
  readonly texts?: { readonly actions?: string; readonly close?: string };
};

const ACTIONS_FALLBACK = 'Acciones';
const CLOSE_FALLBACK = 'Cerrar';

/** El primer ítem no lleva línea delante: no hay nada que separar. */
function hasSeparatorBefore(item: RowActionMenuItem, index: number): boolean {
  return index > 0 && item.separatorBefore === true;
}

/** Tramo de ítems seguidos; con `label`, se pinta como grupo con su rótulo. */
type ItemSegment = {
  readonly key: string;
  readonly label?: string;
  readonly separator: boolean;
  readonly items: readonly RowActionMenuItem[];
};

/**
 * Parte la lista en tramos: empieza uno nuevo en cada rótulo y en cada línea. Sin `groupLabel` en
 * ningún ítem, los tramos se pintan sin envoltorio y el árbol es el de siempre.
 */
function segmentItems(items: readonly RowActionMenuItem[]): ItemSegment[] {
  const segments: { key: string; label?: string; separator: boolean; items: RowActionMenuItem[] }[] = [];
  items.forEach((item, index) => {
    const separator = hasSeparatorBefore(item, index);
    const current = segments.at(-1);
    if (current === undefined || separator || item.groupLabel !== undefined) {
      segments.push({ key: item.key, label: item.groupLabel, separator, items: [item] });
    } else {
      current.items.push(item);
    }
  });
  return segments;
}

/** Rótulo del tablero (`.cap`): 12 px, color apagado, padding 4/10. */
const GROUP_LABEL_CLASS = 'px-2.5 py-1 text-xs leading-normal font-normal text-muted-foreground';

const CENTERED_ITEM_CLASS = 'min-h-12 w-full justify-start gap-3 px-3 text-base font-normal';

/** Sin items no hay nada que ofrecer: ni disparador, ni menu vacio. */
export function RowActionsMenu({
  items,
  triggerLabel,
  triggerTestId,
  triggerDataAttributes,
  presentation = 'dropdown',
  title,
  texts,
}: RowActionsMenuProps) {
  if (items.length === 0) return null;

  if (presentation === 'centered') {
    return (
      <CenteredRowActions
        items={items}
        triggerLabel={triggerLabel}
        triggerTestId={triggerTestId}
        triggerDataAttributes={triggerDataAttributes}
        title={title}
        texts={texts}
      />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={touchTarget}
            aria-label={triggerLabel}
            data-testid={triggerTestId}
            {...triggerDataAttributes}
          />
        }
      >
        <MoreVerticalIcon aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent side="bottom" align="end" className={`min-w-[200px] ${CONTENT_PADDING}`}>
        {segmentItems(items).map((segment) => {
          const rendered = segment.items.map((item) => <DropdownRowItem key={item.key} item={item} />);
          return (
            <Fragment key={segment.key}>
              {segment.separator ? <DropdownMenuSeparator /> : null}
              {segment.label === undefined ? (
                rendered
              ) : (
                <DropdownMenuGroup>
                  <DropdownMenuLabel className={GROUP_LABEL_CLASS}>{segment.label}</DropdownMenuLabel>
                  {rendered}
                </DropdownMenuGroup>
              )}
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DropdownRowItem({ item }: { readonly item: RowActionMenuItem }) {
  const Icon = item.icon;
  return (
    <DropdownMenuItem
      variant={item.destructive ? 'destructive' : 'default'}
      disabled={item.disabled}
      data-testid={item.testId}
      className={ITEM_TOUCH_TARGET}
      render={item.href === undefined ? undefined : <Link href={item.href} />}
      // El primitivo de Base UI (`components/ui/dropdown-menu.tsx`) expone `onClick`, no
      // `onSelect`: aqui se traduce el callback semantico del item a ese evento.
      onClick={item.onSelect}
    >
      <Icon aria-hidden="true" />
      {item.label}
    </DropdownMenuItem>
  );
}

function CenteredRowActions({
  items,
  triggerLabel,
  triggerTestId,
  triggerDataAttributes,
  title,
  texts,
}: Omit<RowActionsMenuProps, 'presentation'>) {
  const [open, setOpen] = useState(false);
  const labelIdPrefix = useId();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            touch
            aria-label={triggerLabel}
            data-testid={triggerTestId}
            {...triggerDataAttributes}
          />
        }
      >
        <EllipsisIcon aria-hidden="true" />
        {texts?.actions ?? ACTIONS_FALLBACK}
      </DialogTrigger>

      <DialogContent showCloseButton={false} className="gap-1 p-4">
        <div className="flex items-start justify-between gap-3 pb-2 pl-1">
          <DialogTitle className="pt-2.5 text-lg leading-snug font-semibold">
            {title ?? triggerLabel}
          </DialogTitle>
          <DialogClose
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                touch
                aria-label={texts?.close ?? CLOSE_FALLBACK}
              />
            }
          >
            <XIcon aria-hidden="true" />
          </DialogClose>
        </div>

        <div className="flex flex-col">
          {segmentItems(items).map((segment) => {
            const rendered = segment.items.map((item) => (
              <CenteredRowItem key={item.key} item={item} onDone={() => setOpen(false)} />
            ));
            const labelId = `${labelIdPrefix}-${segment.key}`;
            return (
              <Fragment key={segment.key}>
                {segment.separator ? <Separator className="my-1" /> : null}
                {segment.label === undefined ? (
                  rendered
                ) : (
                  <div role="group" aria-labelledby={labelId} className="flex flex-col">
                    <div id={labelId} className={GROUP_LABEL_CLASS}>
                      {segment.label}
                    </div>
                    {rendered}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CenteredRowItem({
  item,
  onDone,
}: {
  readonly item: RowActionMenuItem;
  readonly onDone: () => void;
}) {
  const Icon = item.icon;
  const select = () => {
    item.onSelect?.();
    onDone();
  };
  const className = cn(CENTERED_ITEM_CLASS, item.destructive && 'text-destructive hover:text-destructive');

  if (item.href !== undefined && item.disabled !== true) {
    return (
      <Link
        href={item.href}
        data-testid={item.testId}
        className={cn(buttonVariants({ variant: 'ghost' }), className)}
        onClick={select}
      >
        <Icon aria-hidden="true" />
        {item.label}
      </Link>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={item.disabled}
      data-testid={item.testId}
      className={className}
      onClick={select}
    >
      <Icon aria-hidden="true" />
      {item.label}
    </Button>
  );
}
