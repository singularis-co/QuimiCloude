import { WHATSAPP_SEND_ROUTE } from '@/lib/shared/routes';

import { readPublicBaseUrl } from './public-base-url-env';

/**
 * Las credenciales de la cola son las mismas que usa `documentos`, con un lector propio: un módulo no
 * importa los adaptadores de otro. Todo se lee dentro de cada llamada, nunca al importar, y los
 * errores nombran las variables sin su valor.
 */
const TOKEN_VAR = 'QSTASH_TOKEN';
const CURRENT_SIGNING_KEY_VAR = 'QSTASH_CURRENT_SIGNING_KEY';
const NEXT_SIGNING_KEY_VAR = 'QSTASH_NEXT_SIGNING_KEY';
const PUBLIC_BASE_URL_VAR = 'APP_BASE_URL';
const MAX_RETRIES_VAR = 'WHATSAPP_SEND_MAX_RETRIES';

export const DEFAULT_WHATSAPP_SEND_MAX_RETRIES = 3;

export type WhatsappSendQueueConfig = {
  readonly token: string;
  readonly currentSigningKey: string;
  readonly nextSigningKey: string;
  readonly targetUrl: string;
  readonly maxRetries: number;
};

export type WhatsappQueueSigningKeys = {
  readonly currentSigningKey: string;
  readonly nextSigningKey: string;
};

function isBlank(raw: string | undefined): raw is undefined {
  return raw === undefined || raw.trim() === '';
}

/** Si faltan varias, las nombra todas juntas. */
function readRequired<const Names extends readonly string[]>(names: Names): { readonly [K in Names[number]]: string } {
  const missing = names.filter((name) => isBlank(process.env[name]));
  if (missing.length > 0) {
    throw new Error(`faltan las variables de entorno: ${missing.join(', ')}`);
  }
  return Object.fromEntries(names.map((name) => [name, process.env[name] as string])) as {
    readonly [K in Names[number]]: string;
  };
}

export function readWhatsappSendMaxRetries(): number {
  const raw = process.env[MAX_RETRIES_VAR];
  if (isBlank(raw)) return DEFAULT_WHATSAPP_SEND_MAX_RETRIES;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${MAX_RETRIES_VAR}: no es un entero mayor o igual que 0`);
  }
  return Number(trimmed);
}

/** La verificación de la firma solo necesita las dos claves: no exige ni la URL ni el token. */
export function readWhatsappQueueSigningKeys(): WhatsappQueueSigningKeys {
  const env = readRequired([CURRENT_SIGNING_KEY_VAR, NEXT_SIGNING_KEY_VAR]);
  return { currentSigningKey: env[CURRENT_SIGNING_KEY_VAR], nextSigningKey: env[NEXT_SIGNING_KEY_VAR] };
}

export function readWhatsappSendQueueConfig(): WhatsappSendQueueConfig {
  const env = readRequired([TOKEN_VAR, CURRENT_SIGNING_KEY_VAR, NEXT_SIGNING_KEY_VAR]);
  const baseUrl = readPublicBaseUrl();
  if (baseUrl === null) {
    throw new Error(`falta la variable de entorno ${PUBLIC_BASE_URL_VAR}`);
  }
  return {
    token: env[TOKEN_VAR],
    currentSigningKey: env[CURRENT_SIGNING_KEY_VAR],
    nextSigningKey: env[NEXT_SIGNING_KEY_VAR],
    targetUrl: `${baseUrl}${WHATSAPP_SEND_ROUTE}`,
    maxRetries: readWhatsappSendMaxRetries(),
  };
}
