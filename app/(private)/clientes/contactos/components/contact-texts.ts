export const CUSTOMER_CONTACTS_EMPTY_MESSAGE =
  'Aquí verás las conversaciones de WhatsApp con tus clientes.';
export const CUSTOMER_CONTACTS_TITLE_TESTID = 'customer-contacts-title';
export const CUSTOMER_CONTACTS_EMPTY_TESTID = 'customer-contacts-empty';

export const CHAT_MEDIA_LABELS = {
  audio: '[Audio]',
  video: '[Video]',
  document: '[Documento]',
} as const;

export const MISSING_VALUE_TEXT = {
  marker: (key: string) => `[falta ${key}]`,
  prefix: 'Falta el valor de',
  lastSeparator: ' y ',
  separator: ', ',
} as const;

export const CHAT_TIME_TEXT = {
  today: 'Hoy',
  yesterday: 'Ayer',
  weekdays: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
} as const;

export const CHAT_WINDOW_TEXT = {
  closed: 'Ventana cerrada',
  openWithHours: (hours: number, minutes: number) => `Ventana abierta · se cierra en ${hours} h ${minutes} min`,
  openMinutes: (minutes: number) => `Ventana abierta · se cierra en ${minutes} min`,
} as const;
