export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWindowOpen(lastInboundAt: Date | null, now: Date): boolean {
  if (lastInboundAt === null) return false;
  return now.getTime() - lastInboundAt.getTime() < WHATSAPP_WINDOW_MS;
}
