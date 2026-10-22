import Link from 'next/link';
import type { ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export type ArrowLinkProps = {
  readonly href: string;
  readonly direction: 'back' | 'forward';
  readonly children: ReactNode;
  readonly variant?: NonNullable<ButtonVariantProps['variant']>;
  readonly size?: NonNullable<ButtonVariantProps['size']>;
  readonly touch?: boolean | 'mobile';
  readonly testId?: string;
  readonly className?: string;
  /** Pinta el mismo aspecto atenuado y sin `href`: no navega ni recibe el foco, y lo anuncia
   *  con `aria-disabled`. */
  readonly disabled?: boolean;
};

// Tailwind v4 ya limita `hover` a `@media (hover: hover)`: en tacto la flecha no se mueve.
const ARROW_MOTION = 'transition-[translate] duration-(--dur-base) ease-(--ease-standard)';

export function ArrowLink({
  href,
  direction,
  children,
  variant,
  size,
  touch,
  testId,
  className,
  disabled = false,
}: ArrowLinkProps) {
  const isBack = direction === 'back';
  const resolvedVariant = variant ?? (isBack ? 'outline' : 'default');
  const classes = cn(
    buttonVariants({ variant: resolvedVariant, size, touch }),
    isBack && 'pl-2.5',
    className,
  );

  // Sin `<a>`: un enlace sin `href` no es enlace, y uno con `href` se seguiria pudiendo abrir.
  if (disabled) {
    return (
      <span
        role="link"
        aria-disabled="true"
        data-testid={testId}
        data-direction={direction}
        className={cn(classes, 'pointer-events-none cursor-not-allowed opacity-50')}
      >
        {isBack ? <ArrowLeft aria-hidden /> : null}
        {children}
        {isBack ? null : <ArrowRight aria-hidden />}
      </span>
    );
  }

  return (
    <Link href={href} data-testid={testId} data-direction={direction} className={classes}>
      {isBack ? (
        <ArrowLeft
          aria-hidden
          className={cn(ARROW_MOTION, 'group-hover/button:-translate-x-[3px]')}
        />
      ) : null}
      {children}
      {isBack ? null : (
        <ArrowRight
          aria-hidden
          className={cn(ARROW_MOTION, 'group-hover/button:translate-x-[3px]')}
        />
      )}
    </Link>
  );
}
