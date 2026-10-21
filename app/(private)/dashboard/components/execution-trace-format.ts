import { ORDER_STATUS_LABELS } from '@/lib/shared/ui/order-status';
import type {
  ExecutionAction,
  ExecutionPhase,
  ExecutionTraceRow,
  TraceDuration,
} from '@/lib/modules/asignaciones';

export const DELETED_ORDER_MARK = 'Dado de baja';
export const GO_BACK_MARK = 'Vuelta atrás';

export const EXECUTION_ACTION_LABELS: Readonly<Record<ExecutionAction, string>> = {
  start: 'Arrancar',
  resume: 'Retomar',
  advance: 'Avanzar',
  go_back: 'Retroceder',
  cancel: 'Cancelar',
  finish: 'Finalizar',
  pack_start: 'Comenzar empaque',
  pack_finish: 'Terminar empaque',
  conditioning_start: 'Comenzar acondicionamiento',
  conditioning_batch_save: 'Guardado de datos de lote',
  conditioning_finish: 'Terminar acondicionamiento',
  conditioning_step_advance: 'Avanzar',
  conditioning_steps_complete: 'Completar pasos',
  conditioning_responsibles_change: 'Cambio de responsables',
};

export const TRACE_ORDER_STATUS_LABELS: Readonly<Record<ExecutionTraceRow['status'], string>> =
  ORDER_STATUS_LABELS;

export const TRACE_DURATION_SUFFIXES:Readonly<Record<TraceDuration['kind'], string>> = {
  closed: '',
  open: ' (en curso)',
  unclosed: ' (sin cierre anotado)',
};

const SECOND_MS = 1000;
const MINUTE_S = 60;
const HOUR_S = 60 * MINUTE_S;
const DAY_S = 24 * HOUR_S;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Los segundos se truncan: una duracion nunca se muestra mayor de lo que fue. */
export function formatElapsed(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / SECOND_MS);
  const days = Math.floor(total / DAY_S);
  const hours = Math.floor((total % DAY_S) / HOUR_S);
  const minutes = Math.floor((total % HOUR_S) / MINUTE_S);
  const seconds = total % MINUTE_S;

  if (days > 0) return `${days} d ${pad2(hours)} h ${pad2(minutes)} min`;
  if (hours > 0) return `${hours} h ${pad2(minutes)} min`;
  if (minutes > 0) return `${minutes} min ${pad2(seconds)} s`;
  return `${seconds} s`;
}

export function formatElapsedMinutes(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / SECOND_MS);
  const days = Math.floor(total / DAY_S);
  const hours = Math.floor((total % DAY_S) / HOUR_S);
  const minutes = Math.floor((total % HOUR_S) / MINUTE_S);

  if (days > 0) return `${days} d ${pad2(hours)} h ${pad2(minutes)} min`;
  if (hours > 0) return `${hours} h ${pad2(minutes)} min`;
  return `${minutes} min`;
}

export function formatTraceTotal(duration: TraceDuration): string {
  return `${formatElapsedMinutes(duration.ms)}${TRACE_DURATION_SUFFIXES[duration.kind]}`;
}

/** Reordena la cadena `AAAA-MM-DD` sin pasar por `Date`: un huso horario no puede mover el día. */
export function formatSnapshotDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export const PHASE_DURATION_LABELS: Readonly<Record<ExecutionPhase, string>> = {
  production: 'Duración de producción',
  packing: 'Duración de empaque',
  conditioning: 'Duración de acondicionamiento',
};

export const PHASE_OPEN_MARK = 'En curso';
export const PHASE_UNCLOSED_MARK = 'Sin cierre anotado';

export const CONDITIONING_TEXTS = {
  supervisor: 'Supervisor',
  teamPrefix: 'Equipo de trabajo · ',
  noTeam: 'Se comenzó sin equipo de trabajo.',
  workGroupPrefix: 'Grupo de trabajo:',
  savedBy: 'Guardó',
  presentationOne: 'presentación',
  presentationMany: 'presentaciones',
  lot: 'Lote',
  presentation: 'Presentación',
  expiry: 'Vencimiento',
  productionDay: 'Día de producción',
  expiresPrefix: 'Vence',
  producedPrefix: 'Producido',
  snapshotNotice: 'Datos tal como se guardaron en ese momento',
} as const;

/** UTC y sin configuracion regional: servidor y navegador pintan la misma cadena. */
export function formatTraceInstant(value: Date): string {
  return value.toISOString().slice(0, 19).replace('T', ' ');
}
