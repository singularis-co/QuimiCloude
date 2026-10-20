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
