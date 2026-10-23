export const RETENTION_DAYS = 90;

const DAY_MS = 86_400_000;

/** El instante más antiguo que sigue vigente: lo anterior no se ve y se borra. */
export function retentionCutoff(now: Date): Date {
  return new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
}
