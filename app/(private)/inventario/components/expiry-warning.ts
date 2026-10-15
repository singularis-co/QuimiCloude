/** Dias de calendario por debajo de los cuales un vencimiento se pinta como aviso. */
export const EXPIRY_WARNING_DAYS = 30;

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function civilDayNumber(value: string): number | null {
  const match = CIVIL_DATE_PATTERN.exec(value);
  if (match === null) return null;
  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day)) / MS_PER_DAY;
}

/**
 * El vencimiento cae a menos de `EXPIRY_WARNING_DAYS` dias de calendario de `today`; uno ya
 * vencido tambien. Se comparan fechas `YYYY-MM-DD`, no instantes: asi el huso no corre un dia.
 */
export function isExpiringSoon(date: string | null | undefined, today: string): boolean {
  if (date === null || date === undefined) return false;
  const target = civilDayNumber(date);
  const now = civilDayNumber(today);
  if (target === null || now === null) return false;
  return target - now < EXPIRY_WARNING_DAYS;
}
