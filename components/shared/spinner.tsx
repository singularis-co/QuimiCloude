import { Loader2Icon } from 'lucide-react';

import { cn } from '@/lib/utils';

type SpinnerProps = {
  /** `inherit` deja que el tamaño lo ponga el contenedor (p. ej. el `svg` de un `Button`). */
  readonly size?: 'sm' | 'lg' | 'inherit';
  readonly className?: string;
};

const SIZE_CLASS = {
  sm: 'size-4',
  lg: 'size-5',
  inherit: undefined,
} as const;

export function Spinner({ size = 'sm', className }: SpinnerProps) {
  return (
    <Loader2Icon
      className={cn(SIZE_CLASS[size], 'animate-[spin_0.9s_linear_infinite]', className)}
      aria-hidden
    />
  );
}
