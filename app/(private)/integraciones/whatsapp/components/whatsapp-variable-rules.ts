import { WHATSAPP_VARIABLE_KEY_LIMITS } from '@/lib/modules/integraciones';

import { isSystemDisplayKey } from './whatsapp-system-constants';

export const VARIABLE_RULES_TEXTS = {
  keyEmpty: 'La etiqueta tiene que tener al menos una letra.',
  keyTaken: (key: string) => `Ya hay una variable con la clave ${key}.`,
  valueFormatWarning:
    'El valor nuevo tiene espacios de más o no tiene el mismo formato que el anterior (antes solo números). Revísalo.',
} as const;

/** Sin tildes ni mayúsculas, cada tramo de otros signos como `_` y empezando por una letra. */
export function keyFromLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+$/, '')
    .slice(0, WHATSAPP_VARIABLE_KEY_LIMITS.keyMaxLength)
    .replace(/_+$/, '');
}

/** El problema de la clave derivada, o `null` si se puede guardar. */
export function keyProblemOf(key: string, ownKeys: readonly string[]): string | null {
  if (key === '') return VARIABLE_RULES_TEXTS.keyEmpty;
  if (ownKeys.includes(key) || isSystemDisplayKey(key)) return VARIABLE_RULES_TEXTS.keyTaken(key);
  return null;
}

const ONLY_DIGITS = /^\d+$/;

export function valueFormatWarning(before: string, after: string): boolean {
  return after !== after.trim() || /\s{2,}/.test(after) || (ONLY_DIGITS.test(before) && !ONLY_DIGITS.test(after.trim()));
}
