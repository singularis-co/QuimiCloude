import Link from 'next/link';
import type { ReactNode } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type EmptyStateLink = {
  readonly href: string;
  readonly label: ReactNode;
  readonly testId: string;
};

export type EmptyStateProps = {
  readonly testId: string;
  readonly message: ReactNode;
  readonly messageTestId?: string;
  /** Va antes de `firstPage`. */
  readonly clearSearch?: EmptyStateLink;
  readonly firstPage?: EmptyStateLink;
  readonly className?: string;
  /** Acciones, después de los enlaces. */
  readonly children?: ReactNode;
  /** Recuadro con icono antes del texto; oculto a lectores. `lg` = 64 px (página), si no 44 px. */
  readonly icon?: EmptyStateIcon;
  /** Encabezado antes del mensaje; `eyebrow` es una etiqueta corta encima (p. ej. «404»). */
  readonly heading?: EmptyStateHeading;
};

export type EmptyStateIcon = {
  readonly node: ReactNode;
  readonly size?: 'default' | 'lg';
};

export type EmptyStateHeading = {
  readonly text: ReactNode;
  readonly level: 1 | 2;
  readonly eyebrow?: ReactNode;
};

const DEFAULT_CLASS_NAME =
  'flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center';

// Recuadro `.box .bi` del tablero NoEncontrada: 44 px y radio 12 px; en página, 64 px y radio 16 px.
const ICON_SIZE_CLASS_NAME = {
  default: 'size-11 rounded-[12px] [&_svg]:size-5',
  lg: 'size-16 rounded-[16px] [&_svg]:size-7',
} as const;

function EmptyStateIconBox({ icon }: { readonly icon: EmptyStateIcon }) {
  return (
    <span
      aria-hidden="true"
      data-size={icon.size ?? 'default'}
      className={cn(
        'flex shrink-0 items-center justify-center bg-muted text-muted-foreground',
        ICON_SIZE_CLASS_NAME[icon.size ?? 'default'],
      )}
    >
      {icon.node}
    </span>
  );
}

function EmptyStateHeadingBlock({ heading }: { readonly heading: EmptyStateHeading }) {
  const Tag = heading.level === 1 ? 'h1' : 'h2';
  return (
    <>
      {heading.eyebrow === undefined ? null : (
        <span className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {heading.eyebrow}
        </span>
      )}
      <Tag
        className={cn(
          'font-semibold text-foreground',
          heading.level === 1 ? 'text-[26px] leading-tight' : 'text-lg',
        )}
      >
        {heading.text}
      </Tag>
    </>
  );
}

function EmptyStateAction({ link }: { readonly link: EmptyStateLink }) {
  return (
    <Link
      href={link.href}
      data-slot="button"
      data-testid={link.testId}
      className={cn(buttonVariants({ variant: 'outline', touch: true }))}
    >
      {link.label}
    </Link>
  );
}

export function EmptyState({
  testId,
  message,
  messageTestId,
  clearSearch,
  firstPage,
  className = DEFAULT_CLASS_NAME,
  children,
  icon,
  heading,
}: EmptyStateProps) {
  return (
    <div data-testid={testId} className={className}>
      {icon === undefined ? null : <EmptyStateIconBox icon={icon} />}
      {heading === undefined ? null : <EmptyStateHeadingBlock heading={heading} />}
      <p className="text-sm text-muted-foreground" data-testid={messageTestId}>
        {message}
      </p>
      {clearSearch === undefined ? null : <EmptyStateAction link={clearSearch} />}
      {firstPage === undefined ? null : <EmptyStateAction link={firstPage} />}
      {children}
    </div>
  );
}
