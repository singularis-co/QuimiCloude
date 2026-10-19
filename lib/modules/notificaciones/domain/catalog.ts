import type { z } from 'zod';

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

export const NOTIFICATION_CATALOG = {} satisfies NotificationCatalog;
