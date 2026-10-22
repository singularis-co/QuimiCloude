/** Solo primitivas: identificadores, claves y conteos, nunca el texto de un aviso. */
export type NotificationLogFields = {
  readonly [field: string]: string | number | boolean | null | undefined;
};

export type NotificationLog = {
  readonly info: (message: string, fields?: NotificationLogFields) => void;
  readonly warn: (message: string, fields?: NotificationLogFields) => void;
  readonly error: (message: string, fields?: NotificationLogFields) => void;
};
