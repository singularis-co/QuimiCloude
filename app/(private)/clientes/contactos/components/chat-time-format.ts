import type { WhatsappChat } from '@/lib/modules/integraciones';

import { CHAT_TIME_TEXT, CHAT_WINDOW_TEXT } from './contact-texts';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MINUTES_PER_HOUR = 60;
const WEEKDAY_LIMIT_DAYS = 7;

type DateInput = string | Date;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

// Por días del calendario local, no por bloques de 24 h: a las 00:05, lo de las 23:55 ya es «Ayer».
// Se pasa por UTC para que un cambio de horario no deje un día de 23 o 25 h.
function calendarDaysBetween(earlier: Date, later: Date): number {
  const from = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const to = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((to - from) / DAY_MS);
}

/** `HH:mm` en la hora local del navegador. */
export function formatMessageTime(value: DateInput): string {
  const date = new Date(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatListTime(value: DateInput, now: Date): string {
  const date = new Date(value);
  const days = calendarDaysBetween(date, now);
  if (days <= 0) return formatMessageTime(date);
  if (days === 1) return CHAT_TIME_TEXT.yesterday;
  if (days < WEEKDAY_LIMIT_DAYS) return CHAT_TIME_TEXT.weekdays[date.getDay()];
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

/** Clave del día local del mensaje, para saber dónde va un separador. */
export function localDayKey(value: DateInput): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDaySeparator(value: DateInput, now: Date): string {
  const date = new Date(value);
  const days = calendarDaysBetween(date, now);
  if (days <= 0) return CHAT_TIME_TEXT.today;
  if (days === 1) return CHAT_TIME_TEXT.yesterday;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export type WindowRemaining = { readonly hours: number; readonly minutes: number };

// Se redondea hacia arriba: con la ventana abierta nunca se lee «se cierra en 0 min».
export function windowRemaining(window: WhatsappChat['window'], now: Date): WindowRemaining | null {
  if (!window.open) return null;
  const left = Date.parse(window.closesAt) - now.getTime();
  if (left <= 0) return null;
  const totalMinutes = Math.ceil(left / MINUTE_MS);
  return { hours: Math.floor(totalMinutes / MINUTES_PER_HOUR), minutes: totalMinutes % MINUTES_PER_HOUR };
}

export function formatWindowStatus(window: WhatsappChat['window'], now: Date): string {
  const remaining = windowRemaining(window, now);
  if (remaining === null) return CHAT_WINDOW_TEXT.closed;
  if (remaining.hours === 0) return CHAT_WINDOW_TEXT.openMinutes(remaining.minutes);
  return CHAT_WINDOW_TEXT.openWithHours(remaining.hours, remaining.minutes);
}
