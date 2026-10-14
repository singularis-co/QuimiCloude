// Para los tests que no ejercitan las fotos de evidencia: ningun paso las pide, asi que avanzar,
// finalizar y terminar el empaque siguen haciendo lo de siempre y ninguna foto se lee. Si un caso
// llegara a tocar el repositorio de fotos, falla en vez de pasar en vacio.
import type { EvidenceStorage } from '@/lib/modules/asignaciones/ports/evidence-storage';
import type { StepEvidenceRepository } from '@/lib/modules/asignaciones/ports/step-evidence-repository';
import type { RecipeCatalog, RecipePackingStepsReader } from '@/lib/modules/recetas';
import type { RecipeStepLockReader } from '@/lib/modules/recetas/ports/recipe-step-lock-reader';

function noUsado(operation: string): () => Promise<never> {
  return () => Promise.reject(new Error(`este test no ejercita la evidencia: ${operation}`));
}

export const evidenceRepositoryUnused: StepEvidenceRepository = {
  listByOrder: noUsado('listByOrder'),
  findById: noUsado('findById'),
  insert: noUsado('insert'),
  replace: noUsado('replace'),
  delete: noUsado('delete'),
  listOrderIdsWithEvidence: noUsado('listOrderIdsWithEvidence'),
};

export const evidenceStorageUnused: EvidenceStorage = {
  createSignedUpload: noUsado('createSignedUpload'),
  createSignedReadUrl: noUsado('createSignedReadUrl'),
  download: noUsado('download'),
  remove: noUsado('remove'),
};

/** Lector de pasos de fabricacion sin contenido: ningun paso pide evidencia. */
export const recipesWithoutEvidence = {
  findExecutionContentById: async () => null,
} as unknown as RecipeCatalog;

/** Lector de pasos de envasado sin pasos. */
export const packingStepsWithoutEvidence: RecipePackingStepsReader = {
  findPackingStepsById: async () => null,
};

/** Ningun pedido en curso con fotos: mover y quitar pasos se acepta como siempre. */
export const noEvidenceLocks: RecipeStepLockReader = {
  countOrdersWithEvidenceInProgress: async () => 0,
};
