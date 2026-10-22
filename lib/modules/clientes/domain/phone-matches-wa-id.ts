const DIGITS_ONLY = /^[0-9]+$/;

/**
 * WhatsApp manda el `wa_id` de Mexico con o sin el `1` tras el `52`, el de Argentina con o sin el
 * `9` tras el `54` y el de Brasil con o sin el noveno digito tras el area. Se llevan las dos formas
 * a la corta para comparar.
 */
function canonical(digits: string): string {
  if (digits.length !== 13) return digits;
  if (digits.startsWith('521')) return `52${digits.slice(3)}`;
  if (digits.startsWith('549')) return `54${digits.slice(3)}`;
  if (digits.startsWith('55') && digits[4] === '9') return digits.slice(0, 4) + digits.slice(5);
  return digits;
}

export function phoneMatchesWaId(phoneE164: string, waId: string): boolean {
  if (!DIGITS_ONLY.test(phoneE164) || !DIGITS_ONLY.test(waId)) return false;
  return canonical(phoneE164) === canonical(waId);
}

/**
 * Todos los numeros que `phoneMatchesWaId` da por iguales a `digits`, incluido el mismo, para
 * buscarlos por indice en lugar de recorrer todos los numeros.
 */
export function waIdCandidates(digits: string): readonly string[] {
  if (!DIGITS_ONLY.test(digits)) return [];
  const short = canonical(digits);
  const candidates = new Set([digits, short]);
  if (short.length === 12) {
    if (short.startsWith('52')) candidates.add(`521${short.slice(2)}`);
    else if (short.startsWith('54')) candidates.add(`549${short.slice(2)}`);
    else if (short.startsWith('55')) candidates.add(`${short.slice(0, 4)}9${short.slice(4)}`);
  }
  return [...candidates];
}
