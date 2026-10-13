'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

export const COUNTDOWN_RING_TESTID = 'countdown-ring';

export type CountdownRingProps = {
  readonly seconds: number;
  /** Lado en px. */
  readonly size?: number;
  readonly testId?: string;
  readonly className?: string;
};

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Anillo que se vacía en `seconds`. Solo decora: la cuenta la da `CountdownTimer`.
 * La transición arranca un fotograma después de montar para que el navegador pinte antes el anillo
 * lleno. Con movimiento reducido se queda lleno: la regla global acorta las transiciones y el
 * anillo saltaría a vacío.
 */
export function CountdownRing({
  seconds,
  size = 40,
  testId = COUNTDOWN_RING_TESTID,
  className,
}: CountdownRingProps) {
  const [depleted, setDepleted] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const frame = requestAnimationFrame(() => setDepleted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      data-testid={testId}
      className={cn('shrink-0', className)}
    >
      <circle
        cx="24"
        cy="24"
        r={RADIUS}
        fill="none"
        strokeWidth="4"
        className="stroke-muted"
        data-slot="countdown-ring-track"
      />
      <circle
        cx="24"
        cy="24"
        r={RADIUS}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
        className="stroke-primary"
        data-slot="countdown-ring-progress"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={depleted ? CIRCUMFERENCE : 0}
        style={{ transition: `stroke-dashoffset ${seconds}s linear` }}
      />
    </svg>
  );
}
