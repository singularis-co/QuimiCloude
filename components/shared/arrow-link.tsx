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
}: ArrowLinkProps) {
  const isBack = direction === 'back';
  const resolvedVariant = variant ?? (isBack ? 'outline' : 'default');

  return (
    <Link
      href={href}
      data-testid={testId}
      data-direction={direction}
      className={cn(
        buttonVariants({ variant: resolvedVariant, size, touch }),
        isBack && 'pl-2.5',
        className,
      )}
    >
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
