import { z } from 'zod';

import type { ConditioningTeamMemberView } from './conditioning-order-view';
import type { TraceDuration } from './execution-trace';

export const CONDITIONING_ACTIONS = [
  'conditioning_start',
  'conditioning_batch_save',
  'conditioning_finish',
  'conditioning_step_advance',
  'conditioning_steps_complete',
  'conditioning_responsibles_change',
] as const;
export type ConditioningAction = (typeof CONDITIONING_ACTIONS)[number];

/** Las dos anotaciones que completan un paso; el cambio de responsables no completa nada. */
export const CONDITIONING_STEP_COMPLETING_ACTIONS = ['conditioning_step_advance', 'conditioning_steps_complete'] as const;
export type ConditioningStepCompletingAction = (typeof CONDITIONING_STEP_COMPLETING_ACTIONS)[number];

/** Valida `responsible_user_ids` al escribir y al leer. */
export const conditioningResponsiblesSchema = z
  .array(z.string().uuid())
  .min(1)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'responsables repetidos' });

/** Una línea de la foto de un guardado de lote. Fechas `AAAA-MM-DD`. */
export type ConditioningBatchSnapshotLine = {
  readonly batchId: string;
  readonly presentationId: string;
  /** El nombre en el instante del guardado; `null` si el catálogo no la devolvió. */
  readonly presentationName: string | null;
  readonly lot: string;
  readonly expiryDate: string;
  readonly productionDate: string;
};

/** Valida `batch_lines` al escribir y al leer: una fila corrupta lanza en vez de pintarse a medias. */
export const conditioningBatchSnapshotSchema = z
  .array(
    z.strictObject({
      batchId: z.string().uuid(),
      presentationId: z.string().uuid(),
      presentationName: z.string().nullable(),
      lot: z.string().min(1),
      expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .min(1);

export type ExecutionPhase = 'production' | 'packing' | 'conditioning';

/** Una cifra por fase. `null` = la fase no tiene anotación que la abra. */
export type TraceDurations = {
  readonly production: TraceDuration | null;
  readonly packing: TraceDuration | null;
  readonly conditioning: TraceDuration | null;
};

/** Un miembro del equipo en el recorrido. `displayName` `null` si el directorio no lo devuelve. */
export type ExecutionTraceTeamMember = {
  readonly userId: string;
  readonly displayName: string | null;
  readonly origin: ConditioningTeamMemberView['origin'];
};
