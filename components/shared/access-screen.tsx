import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';

export type AccessScreenProps = {
  readonly children: ReactNode;
  readonly width?: 'default' | 'wide';
  readonly labelledBy?: string;
  readonly testId?: string;
};

const HEXAGON = '21,10.5 32.7,17.3 32.7,30.8 21,37.5 9.3,30.8 9.3,17.3';

// Tamaño, posición, color y giro viven en `app/globals.css`: un `style` en línea ganaría a la
// regla de movimiento reducido.
function Molecules() {
  return (
    <div data-access="molecules" aria-hidden="true">
      <svg data-access="molecule" data-access-index="1" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" focusable="false">
        <polygon points={HEXAGON} />
        <path d="M32.7 30.8 40.9 35.5" />
        <circle cx="40.9" cy="35.5" r="3" fill="currentColor" />
      </svg>
      <svg data-access="molecule" data-access-index="2" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" focusable="false">
        <polygon points={HEXAGON} />
        <path d="M9.3 17.3 3.3 13.8" />
        <circle cx="3.3" cy="13.8" r="3" fill="currentColor" />
      </svg>
      <svg data-access="molecule" data-access-index="3" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" focusable="false">
        <polygon points={HEXAGON} />
        <path d="M14.5 26.7v-5.4M21.9 17l4.7 2.7" />
      </svg>
      <svg data-access="molecule" data-access-index="4" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.6" focusable="false">
        <circle cx="16" cy="24" r="6" />
        <circle cx="34" cy="16" r="4" />
        <circle cx="34" cy="34" r="4" />
        <path d="M21.5 21.5 30.5 17.5M21.5 26.5 30.5 32.5" />
      </svg>
      <svg data-access="molecule" data-access-index="5" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.6" focusable="false">
        <polygon points={HEXAGON} />
      </svg>
    </div>
  );
}

export function AccessScreen({ children, width = 'default', labelledBy, testId }: AccessScreenProps) {
  return (
    <main data-access="screen" data-testid={testId} className="relative flex min-h-dvh items-center justify-center overflow-hidden">
      <Molecules />
      {/* Un `div` sin rol no admite nombre accesible: con `aria-labelledby` pasa a ser región. */}
      <Card
        data-access="card"
        data-width={width}
        role={labelledBy ? 'region' : undefined}
        aria-labelledby={labelledBy}
      >
        {children}
      </Card>
    </main>
  );
}
