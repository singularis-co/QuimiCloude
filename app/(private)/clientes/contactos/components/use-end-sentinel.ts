'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type UseEndSentinelOptions = {
  /** Se llama cada vez que el centinela pasa a verse. */
  readonly onVisible: () => void;
  /** Con `false` no se observa: p. ej. sin más páginas o mientras llega una. */
  readonly enabled?: boolean;
  /** Margen del observador, para pedir antes de llegar al borde. */
  readonly rootMargin?: string;
};

/**
 * Devuelve la `ref` del elemento centinela. Sin `IntersectionObserver` en el entorno no observa
 * y no falla.
 */
export function useEndSentinel<T extends Element = HTMLDivElement>({
  onVisible,
  enabled = true,
  rootMargin,
}: UseEndSentinelOptions): (node: T | null) => void {
  const [node, setNode] = useState<T | null>(null);
  const onVisibleRef = useRef(onVisible);

  useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  // Se vuelve a observar al rehabilitarse: si el centinela sigue a la vista tras cargar una página,
  // el observador nuevo lo notifica de entrada y se pide la siguiente.
  useEffect(() => {
    if (!enabled || node === null || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onVisibleRef.current();
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, node, rootMargin]);

  return useCallback((next: T | null) => setNode(next), []);
}
