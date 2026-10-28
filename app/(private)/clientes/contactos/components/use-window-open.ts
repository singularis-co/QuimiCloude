'use client';

import { useEffect, useState } from 'react';

import type { WhatsappChat } from '@/lib/modules/integraciones';

// Por encima de este retraso el navegador dispara el temporizador al instante.
const MAX_TIMEOUT_MS = 2_147_483_647;

/** `false` en cuanto llega `closesAt`, sin esperar a que el servidor diga que la ventana cerró. */
export function useWindowOpen(chatWindow: WhatsappChat['window']): boolean {
  const closesAt = chatWindow.open ? chatWindow.closesAt : null;
  const [elapsed, setElapsed] = useState<string | null>(null);

  useEffect(() => {
    if (closesAt === null) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const left = Date.parse(closesAt) - Date.now();
      if (left <= 0) setElapsed(closesAt);
      else timer = setTimeout(check, Math.min(left, MAX_TIMEOUT_MS));
    };
    timer = setTimeout(check, 0);
    return () => clearTimeout(timer);
  }, [closesAt]);

  return closesAt !== null && elapsed !== closesAt;
}
