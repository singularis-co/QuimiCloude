const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const RELATIVE_LIMIT_DAYS = 7;

export const RELATIVE_TIME_TEXT = {
  now: 'ahora',
  minutes: (n: number) => `hace ${n} min`,
  hours: (n: number) => `hace ${n} h`,
  days: (n: number) => (n === 1 ? 'hace 1 día' : `hace ${n} días`),
} as const;

type PartName = 'day' | 'month' | 'year' | 'hour' | 'minute';
type Parts = Record<PartName, string>;
const PART_NAMES: ReadonlySet<string> = new Set<PartName>(['day', 'month', 'year', 'hour', 'minute']);

function parts(date: Date, timeZone: string | undefined): Parts {
  const formatter = new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  });
  const found: Partial<Parts> = {};
  for (const part of formatter.formatToParts(date)) {
    if (PART_NAMES.has(part.type)) found[part.type as PartName] = part.value;
  }
  return found as Parts;
}

/** `HH:MM` en la zona del navegador, o en `timeZone` si se da. */
export function formatClock(value: string | Date, timeZone?: string): string {
  const { hour, minute } = parts(new Date(value), timeZone);
  return `${hour}:${minute}`;
}

/** Hasta 7 días, la antigüedad en palabras; después, `DD/MM/AAAA HH:MM`. */
export function formatRelativeTime(value: string | Date, now: Date | number, timeZone?: string): string {
  const date = new Date(value);
  const elapsed = Math.max(0, Number(now) - date.getTime());
  if (elapsed < MINUTE) return RELATIVE_TIME_TEXT.now;
  if (elapsed < HOUR) return RELATIVE_TIME_TEXT.minutes(Math.floor(elapsed / MINUTE));
  if (elapsed < DAY) return RELATIVE_TIME_TEXT.hours(Math.floor(elapsed / HOUR));
  if (elapsed <= RELATIVE_LIMIT_DAYS * DAY) return RELATIVE_TIME_TEXT.days(Math.floor(elapsed / DAY));
  const p = parts(date, timeZone);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
