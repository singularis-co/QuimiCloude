import { z } from 'zod';

import { WHATSAPP_TEXT_MAX_LENGTH } from './whatsapp-send-input';

export type WhatsappAgentSettings = {
  readonly enabled: boolean;
  readonly confidenceThreshold: number;
  readonly dailyReplyLimit: number;
  readonly contactHourlyReplyLimit: number;
  readonly inactivityHours: number;
  readonly handoffMessage: string;
  /** Plantilla: guarda `{nombre}` sin resolver; se resuelve con `renderGreeting` al usarla. */
  readonly greetingMessage: string;
  readonly assistantName: string | null;
};

export const GREETING_NAME_PLACEHOLDER = '{nombre}';

export const WHATSAPP_ASSISTANT_NAME_MAX_LENGTH = 60;

/** La única fuente de los valores por defecto: la tabla no los repite, una empresa sin fila los lee de aquí. */
export const WHATSAPP_AGENT_DEFAULTS: WhatsappAgentSettings = Object.freeze({
  enabled: false,
  confidenceThreshold: 0.6,
  dailyReplyLimit: 500,
  contactHourlyReplyLimit: 20,
  inactivityHours: 12,
  handoffMessage: 'Te comunico con una persona del equipo. Te responderá en cuanto pueda.',
  greetingMessage: `Hola, soy el asistente virtual ${GREETING_NAME_PLACEHOLDER}. Si prefieres hablar con una persona, escribe "asesor".`,
  assistantName: null,
});

/** En puntos de código, como `char_length` de la base: un emoji cuenta uno. */
function lengthOf(text: string): number {
  return [...text].length;
}

const NAMELESS_PLACEHOLDER = / \{nombre\}|\{nombre\} ?/g;

/**
 * Una sola pasada: un `{nombre}` que venga dentro del propio nombre no se vuelve a resolver. Sin
 * nombre, cada `{nombre}` se va con el espacio que lo precede o, si no lo hay, con el que lo sigue.
 */
export function renderGreeting(template: string, assistantName: string | null): string {
  if (assistantName === null || assistantName.trim() === '') {
    return template.replace(NAMELESS_PLACEHOLDER, '');
  }
  return template.split(GREETING_NAME_PLACEHOLDER).join(assistantName);
}

/** Tolerancia de coma flotante: `0.29 * 100` no da 29 exacto. */
function hasAtMostTwoDecimals(value: number): boolean {
  const scaled = value * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-9;
}

const message = z
  .string()
  .trim()
  .min(1)
  .refine((value) => lengthOf(value) <= WHATSAPP_TEXT_MAX_LENGTH);

const positiveInteger = z.number().int().min(1);

const assistantName = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? '';
    return trimmed === '' ? null : trimmed;
  })
  .refine((value) => value === null || lengthOf(value) <= WHATSAPP_ASSISTANT_NAME_MAX_LENGTH);

/** Sin `strict`: una clave de más, como una empresa, se descarta; la empresa sale del actor. */
export const saveWhatsappAgentSettingsSchema = z
  .object({
    enabled: z.boolean(),
    confidenceThreshold: z.number().min(0).max(1).refine(hasAtMostTwoDecimals),
    dailyReplyLimit: positiveInteger,
    contactHourlyReplyLimit: positiveInteger,
    inactivityHours: positiveInteger,
    handoffMessage: message,
    greetingMessage: message,
    assistantName,
  })
  .superRefine((settings, context) => {
    // Con otro campo ya inválido, zod puede llegar aquí con la entrada sin transformar.
    if (typeof settings.greetingMessage !== 'string') return;
    const rendered = renderGreeting(settings.greetingMessage, settings.assistantName);
    if (rendered.trim() === '' || lengthOf(rendered) > WHATSAPP_TEXT_MAX_LENGTH) {
      context.addIssue({ code: 'custom', path: ['greetingMessage'], message: 'rendered greeting out of range' });
    }
  });

export type SaveWhatsappAgentSettingsInput = z.input<typeof saveWhatsappAgentSettingsSchema>;
