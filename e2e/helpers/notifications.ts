// Siembra y limpieza de avisos para los E2E de la campana.
//
// Un aviso dirigido a un rol, o una docena para un usuario, no tiene forma de nacer desde la
// pantalla más rápido que escribiéndolo: hoy el único evento que avisa es el fin de una tanda de
// PDFs, y avisa a quien la subió.
import { prisma } from '@/lib/shared/db/prisma';

export type SeededNotification = {
  readonly companyId: string;
  readonly title: string;
  readonly dedupeKey: string;
  readonly createdAt: Date;
  readonly recipient: { readonly userId: string } | { readonly role: string };
};

/** Avisos de éxito con enlace a fórmulas y sin hora en el cuerpo, como los del evento de PDFs. */
export async function seedNotifications(rows: readonly SeededNotification[]): Promise<void> {
  await prisma.notification.createMany({
    data: rows.map((row) => ({
      companyId: row.companyId,
      eventKey: 'documentos.tanda_terminada',
      tone: 'success',
      title: row.title,
      body: 'Se leyó el archivo de la tanda.',
      bodyTime: null,
      linkLabel: 'Ver fórmulas',
      targetKind: 'formulas',
      recipientUserId: 'userId' in row.recipient ? row.recipient.userId : null,
      recipientRole: 'role' in row.recipient ? row.recipient.role : null,
      dedupeKey: row.dedupeKey,
      createdAt: row.createdAt,
    })),
  });
}

/** Las lecturas antes que los avisos: su FK compuesta apunta a ellos. */
export async function deleteCompanyNotifications(companyIds: readonly string[]): Promise<void> {
  if (companyIds.length === 0) return;
  await prisma.notificationRead.deleteMany({ where: { companyId: { in: [...companyIds] } } });
  await prisma.notification.deleteMany({ where: { companyId: { in: [...companyIds] } } });
}
