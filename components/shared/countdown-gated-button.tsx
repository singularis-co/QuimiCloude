'use client';

import { useState } from 'react';

import { CountdownRing } from '@/components/shared/countdown-ring';
import { CountdownTimer } from '@/components/shared/countdown-timer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { touchTarget } from '@/lib/shared/ui/touch-target';

/**
 * Botón que no se puede pulsar hasta que pasa la espera. La cuenta arranca al montar: quien lo usa
 * lo monta con una `key` nueva en cada apertura para que la espera empiece de nuevo.
 * Es `submit` porque va dentro del `<form>` de quien lo usa.
 * La espera es solo de cliente; el servidor no la comprueba.
 */

export const COUNTDOWN_GATED_BUTTON_TESTID = 'countdown-gated-button';

export type CountdownGatedButtonProps = {
  readonly label: string;
  readonly seconds: number;
  /** Deshabilita el botón por motivos ajenos a la espera (sin selección, envío en curso...). */
  readonly disabled?: boolean;
  readonly className?: string;
};

export function CountdownGatedButton({
  label,
  seconds,
  disabled = false,
  className,
}: CountdownGatedButtonProps) {
  const [waiting, setWaiting] = useState(true);

  return (
    <Button
      type="submit"
      disabled={waiting || disabled}
      className={cn(touchTarget, 'gap-2', className)}
      data-testid={COUNTDOWN_GATED_BUTTON_TESTID}
    >
      {label}
      {waiting ? (
        <>
          {/* `size-5` evita el `size-4` que Button impone a sus svg; sobre su fondo, el anillo
              toma el color del texto. */}
          <CountdownRing
            seconds={seconds}
            size={20}
            className="size-5 [&_[data-slot=countdown-ring-progress]]:stroke-current [&_[data-slot=countdown-ring-track]]:stroke-current/30"
          />
          <CountdownTimer seconds={seconds} onEnd={() => setWaiting(false)} className="text-current" />
        </>
      ) : null}
    </Button>
  );
}
