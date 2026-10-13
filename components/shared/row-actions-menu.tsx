'use client';

import { useState, type ComponentType, type ReactNode } from 'react';

import { EllipsisIcon, MoreVerticalIcon, XIcon } from 'lucide-react';
import Link from 'next/link';

import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.key}
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
        })}
      </DropdownMenuContent>
    </DropdownMenu>
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
          {items.map((item) => {
            const Icon = item.icon;
            const select = () => {
              item.onSelect?.();
              setOpen(false);
            };
            const className = cn(
              CENTERED_ITEM_CLASS,
              item.destructive && 'text-destructive hover:text-destructive',
            );

            if (item.href !== undefined && item.disabled !== true) {
              return (
                <Link
                  key={item.key}
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
                key={item.key}
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
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
