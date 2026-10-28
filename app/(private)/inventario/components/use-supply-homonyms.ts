'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { SupplyHomonym } from '@/lib/modules/inventario';
import { findSupplyHomonymsAction } from '@/lib/modules/inventario/adapters/driving/product-actions';

/** El mismo rebote que la búsqueda de `ProductNamePicker`. */
export const SUPPLY_HOMONYMS_DEBOUNCE_MS = 400;

const NONE: readonly SupplyHomonym[] = [];

export type SupplyHomonymsLookup = {
  readonly homonyms: readonly SupplyHomonym[];
  readonly onNameChange: (name: string) => void;
};

/**
 * Homónimos vivos del nombre del alta. Solo pide al cambiar el nombre: la unidad y la existencia
 * se recalculan en el navegador sobre esta lista.
 *
 * El nombre se guarda en una referencia y no en estado: teclear no vuelve a pintar el formulario
 * entero, solo la respuesta lo hace.
 *
 * Un fallo de lectura deja la lista vacía y el aviso no se pinta: el aviso informa, y quien
 * decide al guardar es el servidor.
 */
export function useSupplyHomonyms(enabled: boolean): SupplyHomonymsLookup {
  const [homonyms, setHomonyms] = useState<readonly SupplyHomonym[]>(NONE);
  const nameRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);

  const cancel = useCallback(() => {
    requestRef.current += 1;
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const schedule = useCallback(
    (name: string) => {
      cancel();
      if (name === '') return;
      const request = requestRef.current;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void (async () => {
          let found: readonly SupplyHomonym[] = NONE;
          try {
            const result = await findSupplyHomonymsAction(name);
            if (result.status === 'success') found = result.data;
          } catch {
            found = NONE;
          }
          if (requestRef.current === request) setHomonyms(found);
        })();
      }, SUPPLY_HOMONYMS_DEBOUNCE_MS);
    },
    [cancel],
  );

  useEffect(() => {
    if (enabled) schedule(nameRef.current);
    return cancel;
  }, [enabled, schedule, cancel]);

  const onNameChange = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (trimmed === nameRef.current) return;
      nameRef.current = trimmed;
      // La lista del nombre anterior ya no vale; si ya estaba vacía, React no repinta.
      setHomonyms(NONE);
      if (enabled) schedule(trimmed);
    },
    [enabled, schedule],
  );

  return { homonyms, onNameChange };
}
