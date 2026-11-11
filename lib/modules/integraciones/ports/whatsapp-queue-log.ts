/**
 * Solo primitivas: identificadores, motivos, conteos y nombres de error. La forma no admite objetos,
 * así que un mensaje o un error crudo no se cuelan por descuido.
 */
export type WhatsappQueueLogFields = {
  readonly [field: string]: string | number | boolean | null | undefined;
};

export type WhatsappQueueLog = {
  readonly info: (message: string, fields?: WhatsappQueueLogFields) => void;
  readonly warn: (message: string, fields?: WhatsappQueueLogFields) => void;
  readonly error: (message: string, fields?: WhatsappQueueLogFields) => void;
};
