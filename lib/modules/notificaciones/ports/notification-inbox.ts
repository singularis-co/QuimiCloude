import type {
  NotificationRecipient,
  NotificationTarget,
  NotificationTone,
} from '../domain/catalog';

export type NewNotification = {
  readonly companyId: string;
  readonly eventKey: string;
  readonly tone: NotificationTone;
  readonly title: string;
  readonly body: string;
  readonly bodyTime: Date | null;
  readonly linkLabel: string;
  readonly target: NotificationTarget | null;
  readonly recipient: NotificationRecipient;
  readonly dedupeKey: string;
};

export type StoredNotification = NewNotification & {
  readonly id: string;
  readonly createdAt: Date;
};

/**
 * Qué avisos ve quien lee: los vigentes de su empresa dirigidos a él o a su rol. `roleName` acota,
 * no autoriza.
 */
export type InboxScope = {
  readonly companyId: string;
  readonly userId: string;
  readonly roleName: string | null;
  readonly cutoff: Date;
};

/** `t` es `created_at` como texto con microsegundos: un `Date` solo guarda milisegundos. */
export type InboxCursor = { readonly t: string; readonly i: string };

/** El destino tal como está guardado: puede ser de un `kind` que este código ya no conoce. */
export type StoredTarget = { readonly kind: string };

export type InboxItem = {
  readonly id: string;
  readonly tone: NotificationTone;
  readonly title: string;
  readonly body: string;
  readonly bodyTime: Date | null;
  readonly linkLabel: string;
  readonly target: StoredTarget | null;
  readonly createdAt: Date;
  readonly read: boolean;
};

export type InboxSummary = {
  readonly unreadCount: number;
  readonly newest: { readonly id: string; readonly createdAt: Date } | null;
};

export type InboxBatch = {
  readonly items: readonly InboxItem[];
  readonly next: InboxCursor | null;
};

export interface NotificationInbox {
  /** `null` si ya había un aviso con esa `dedupeKey` en la empresa. */
  insertIfAbsent(notification: NewNotification): Promise<StoredNotification | null>;
  summary(scope: InboxScope): Promise<InboxSummary>;
  /** Un lote, del más reciente al más antiguo, estrictamente después de `after`. */
  listBatch(scope: InboxScope, after: InboxCursor | null): Promise<InboxBatch>;
  /** `false` si el aviso no es visible para `scope`; marcar uno ya leído da `true`. */
  markRead(scope: InboxScope, notificationId: string): Promise<boolean>;
  /** Cuántos pasaron de no leídos a leídos. */
  markAllRead(scope: InboxScope): Promise<number>;
  deleteExpired(companyId: string, cutoff: Date): Promise<number>;
}
