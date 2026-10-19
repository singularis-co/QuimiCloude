import { z } from 'zod';

import { fileListPhrase } from './file-list-phrase';

import type { ChannelKey } from '../ports/notification-channel';

export type NotificationTone = 'success' | 'warning' | 'danger';

/** Destino abstracto: la ruta se resuelve en el borde, así un cambio de URL no rompe lo guardado. */
export type NotificationTarget = { readonly kind: 'formulas' } | { readonly kind: 'suppliers' };

export type NotificationRecipient =
  | { readonly kind: 'role'; readonly role: string }
  | { readonly kind: 'user'; readonly userId: string };

export type Audience<P> =
  | { readonly kind: 'role'; readonly role: string }
  | { readonly kind: 'user'; userIdFrom(payload: P): string };

// Firmas de método y no de propiedad: así una entrada con su payload concreto cabe en el catálogo.
export type CatalogEntry<P> = {
  readonly schema: z.ZodType<P>;
  tone(payload: P): NotificationTone;
  title(payload: P): string;
  /** Puede llevar la marca `{hora}`, que el navegador sustituye por la hora de `bodyTime`. */
  body(payload: P): string;
  bodyTime(payload: P): Date | null;
  linkLabel(payload: P): string;
  target(payload: P): NotificationTarget | null;
  readonly audience: Audience<P>;
  readonly channels: readonly ChannelKey[];
};

export type NotificationCatalog = Readonly<Record<string, CatalogEntry<unknown>>>;

const HOUR_MARK = '{hora}';

// Sin importar `documentos`: la estrategia se repite aquí como los dos literales del negocio.
const batchFinishedSchema = z
  .strictObject({
    recipientUserId: z.uuid(),
    strategy: z.enum(['formula', 'catalogo']),
    uploadedAt: z.date(),
    total: z.int().min(1),
    done: z.int().min(0),
    failed: z.int().min(0),
    failedNames: z.array(z.string().min(1)).max(3),
  })
  .refine((p) => p.done + p.failed === p.total && p.failedNames.length <= p.failed);

export type BatchFinishedPayload = z.infer<typeof batchFinishedSchema>;

function batchFinishedBody(p: BatchFinishedPayload): string {
  const list = fileListPhrase(p.failedNames, p.failed);
  const read = `Se leyeron ${p.done} de ${p.total} archivos.`;
  if (p.failed === 0) {
    return p.total === 1
      ? `Se leyó el archivo de la tanda que subiste a las ${HOUR_MARK}.`
      : `Se leyeron los ${p.total} archivos de la tanda que subiste a las ${HOUR_MARK}.`;
  }
  if (p.done > 0) {
    if (list !== '') {
      return p.failed === 1 ? `${read} No se pudo leer ${list}.` : `${read} No se pudieron leer ${list}.`;
    }
    return p.failed === 1 ? `${read} Uno no se pudo leer.` : `${read} ${p.failed} no se pudieron leer.`;
  }
  if (p.total === 1) {
    return list !== ''
      ? `No se pudo leer ${list}, de la tanda que subiste a las ${HOUR_MARK}.`
      : `No se pudo leer el archivo de la tanda que subiste a las ${HOUR_MARK}.`;
  }
  return list !== ''
    ? `No se pudo leer ningún archivo de la tanda que subiste a las ${HOUR_MARK}: ${list}.`
    : `No se pudo leer ningún archivo de la tanda que subiste a las ${HOUR_MARK}.`;
}

const batchFinished: CatalogEntry<BatchFinishedPayload> = {
  schema: batchFinishedSchema,
  tone: (p) => (p.failed === 0 ? 'success' : p.done > 0 ? 'warning' : 'danger'),
  title: (p) =>
    p.failed === 0
      ? 'Tanda de PDFs procesada'
      : p.done > 0
        ? 'Tanda procesada con errores'
        : 'Falló la lectura de la tanda',
  body: batchFinishedBody,
  // La base exige que la hora y su marca vayan juntas, y los textos con errores parciales no la llevan.
  bodyTime: (p) => (batchFinishedBody(p).includes(HOUR_MARK) ? p.uploadedAt : null),
  linkLabel: (p) => (p.strategy === 'formula' ? 'Ver fórmulas' : 'Ver proveedores'),
  target: (p) => (p.strategy === 'formula' ? { kind: 'formulas' } : { kind: 'suppliers' }),
  audience: { kind: 'user', userIdFrom: (p) => p.recipientUserId },
  channels: ['in_app'],
};

export const NOTIFICATION_CATALOG = {
  'documentos.tanda_terminada': batchFinished,
} satisfies NotificationCatalog;
