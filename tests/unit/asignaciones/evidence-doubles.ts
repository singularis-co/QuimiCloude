// Dobles comunes de los casos de uso de fotos de evidencia: el acceso al pedido (asignaciones,
// catalogo de pedidos, pasos de la formula), el repositorio de fotos en memoria y el bucket, cada
// metodo un `vi.fn` que se puede inspeccionar.
import { vi } from 'vitest';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';
import type { EvidenceTargetDeps } from '@/lib/modules/asignaciones/domain/evidence-target';
import type { EvidencePhase } from '@/lib/modules/asignaciones/domain/step-evidence';
import type { EvidenceStorage } from '@/lib/modules/asignaciones/ports/evidence-storage';
import type {
  NewStepEvidence,
  StepEvidenceRepository,
  StepEvidenceRow,
} from '@/lib/modules/asignaciones/ports/step-evidence-repository';
import type { OrderStatus } from '@/lib/modules/pedidos';
import type { RecipeStepView } from '@/lib/modules/recetas';

export function uuid(seed: string): string {
  return `${seed.repeat(8)}-${seed.repeat(4)}-4${seed.repeat(3)}-8${seed.repeat(3)}-${seed.repeat(12)}`;
}

export const EMPRESA = uuid('3');
export const OTRA_EMPRESA = uuid('4');
export const ANA = uuid('1');
export const BETO = uuid('2');
export const PEDIDO = uuid('7');
export const RECETA = uuid('9');

export const OPERADOR: Actor = { id: ANA, companyId: EMPRESA, permissions: ['asignaciones.ejecutar'] };
export const EMPACADOR: Actor = { id: ANA, companyId: EMPRESA, permissions: ['empaque.modificar'] };

/** Fabricacion: el paso 2 y el 3 piden evidencia, el 1 no. */
export const PASOS_FABRICACION: readonly RecipeStepView[] = [
  { blocks: [] },
  { blocks: [], requiresEvidence: true },
  { blocks: [], requiresEvidence: true },
];

/** Envasado: solo el paso 1 pide evidencia. */
export const PASOS_ENVASADO: readonly RecipeStepView[] = [{ blocks: [], requiresEvidence: true }, { blocks: [] }];

export function filaFoto(
  overrides: Partial<StepEvidenceRow> & { readonly id: string; readonly slot: number },
  companyId = EMPRESA,
): StepEvidenceRow & { readonly companyId: string } {
  return {
    orderId: PEDIDO,
    phase: 'manufacturing',
    stepPosition: 2,
    path: `${companyId}/${PEDIDO}/${overrides.id}`,
    companyId,
    ...overrides,
  };
}

type FilaGuardada = StepEvidenceRow & { readonly companyId: string };

/** Repositorio en memoria: filtra por empresa como el real y respeta el tope de 3 por paso y la
 *  ruta unica por empresa. */
export function repositorioEnMemoria(iniciales: readonly FilaGuardada[] = []) {
  const filas: FilaGuardada[] = [...iniciales];
  let secuencia = 0;
  const nuevaId = () => uuid('e').replace(/e{12}$/, String(++secuencia).padStart(12, '0'));
  const de = (companyId: string, orderId: string, phase: EvidencePhase) =>
    filas.filter((f) => f.companyId === companyId && f.orderId === orderId && f.phase === phase);
  const rutaOcupada = (companyId: string, path: string, salvo?: string) =>
    filas.some((f) => f.companyId === companyId && f.path === path && f.id !== salvo);
  const sinEmpresa = (fila: FilaGuardada): StepEvidenceRow => ({
    id: fila.id,
    orderId: fila.orderId,
    phase: fila.phase,
    stepPosition: fila.stepPosition,
    slot: fila.slot,
    path: fila.path,
  });

  const repo = {
    listByOrder: vi.fn<StepEvidenceRepository['listByOrder']>(async (companyId, orderId, phase) =>
      de(companyId, orderId, phase)
        .sort((a, b) => a.stepPosition - b.stepPosition || a.slot - b.slot)
        .map(sinEmpresa),
    ),
    findById: vi.fn<StepEvidenceRepository['findById']>(async (companyId, orderId, phase, id) => {
      const fila = de(companyId, orderId, phase).find((f) => f.id === id);
      return fila === undefined ? null : sinEmpresa(fila);
    }),
    insert: vi.fn<StepEvidenceRepository['insert']>(async (row: NewStepEvidence) => {
      const ocupados = new Set(
        de(row.companyId, row.orderId, row.phase)
          .filter((f) => f.stepPosition === row.stepPosition)
          .map((f) => f.slot),
      );
      const slot = [1, 2, 3].find((s) => !ocupados.has(s));
      if (slot === undefined) return 'limit';
      if (rutaOcupada(row.companyId, row.path)) return 'path_taken';
      const fila: FilaGuardada = {
        id: nuevaId(),
        companyId: row.companyId,
        orderId: row.orderId,
        phase: row.phase,
        stepPosition: row.stepPosition,
        slot,
        path: row.path,
      };
      filas.push(fila);
      return sinEmpresa(fila);
    }),
    replace: vi.fn<StepEvidenceRepository['replace']>(async (replacedId, row) => {
      const index = filas.findIndex(
        (f) =>
          f.id === replacedId &&
          f.companyId === row.companyId &&
          f.orderId === row.orderId &&
          f.phase === row.phase &&
          f.stepPosition === row.stepPosition,
      );
      if (index < 0) return 'not_found';
      const vieja = filas[index]!;
      if (rutaOcupada(row.companyId, row.path, vieja.id)) return 'path_taken';
      const fila: FilaGuardada = { ...vieja, id: nuevaId(), path: row.path };
      filas.splice(index, 1, fila);
      return sinEmpresa(fila);
    }),
    delete: vi.fn<StepEvidenceRepository['delete']>(async (companyId, orderId, phase, id) => {
      const index = filas.findIndex(
        (f) => f.id === id && f.companyId === companyId && f.orderId === orderId && f.phase === phase,
      );
      if (index < 0) return null;
      const [borrada] = filas.splice(index, 1);
      return sinEmpresa(borrada!);
    }),
    listOrderIdsWithEvidence: vi.fn<StepEvidenceRepository['listOrderIdsWithEvidence']>(
      async (companyId, candidates) =>
        candidates
          .filter((c) => de(companyId, c.orderId, c.phase).length > 0)
          .map((c) => c.orderId),
    ),
    countByOrders: vi.fn<StepEvidenceRepository['countByOrders']>(async (companyId, orderIds) => {
      const conteo = new Map<string, number>();
      for (const orderId of new Set(orderIds)) {
        const total = filas.filter((f) => f.companyId === companyId && f.orderId === orderId).length;
        if (total > 0) conteo.set(orderId, total);
      }
      return conteo;
    }),
  } satisfies StepEvidenceRepository;

  return { repo, filas };
}

/** PNG de 1 x 1 pixel: lo que `validateRecipeImage` acepta. */
export const PNG_VALIDO = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
  (c) => c.charCodeAt(0),
);

export function bucket(options?: {
  readonly descarga?: Uint8Array | null;
  readonly borradoFalla?: Error;
}) {
  const storage = {
    createSignedUpload: vi.fn<EvidenceStorage['createSignedUpload']>(async (path) => ({
      path,
      uploadUrl: `https://bucket.test/upload/${path}`,
      token: 'token-de-subida',
    })),
    createSignedReadUrl: vi.fn<EvidenceStorage['createSignedReadUrl']>(
      async (path, expiresInSeconds) => `https://bucket.test/read/${path}?ttl=${String(expiresInSeconds)}`,
    ),
    createSignedReadUrls: vi.fn<EvidenceStorage['createSignedReadUrls']>(async (paths, expiresInSeconds) =>
      paths.map((path) => `https://bucket.test/read/${path}?ttl=${String(expiresInSeconds)}`),
    ),
    download: vi.fn<EvidenceStorage['download']>(async () =>
      options?.descarga === undefined ? PNG_VALIDO : options.descarga,
    ),
    remove: vi.fn<EvidenceStorage['remove']>(async () => {
      if (options?.borradoFalla) throw options.borradoFalla;
    }),
  } satisfies EvidenceStorage;
  return storage;
}

/**
 * El acceso al pedido: por defecto Ana es responsable del pedido `EN_CURSO` (fabricacion). Con
 * `status: 'EN_EMPAQUE'` y `packedBy`, el de envasado.
 */
export function acceso(options?: {
  readonly asignados?: readonly string[];
  readonly status?: OrderStatus | null;
  readonly packedBy?: string | null;
  readonly pasosFabricacion?: readonly RecipeStepView[];
  readonly pasosEnvasado?: readonly RecipeStepView[];
}) {
  const status = options?.status === undefined ? 'EN_CURSO' : options.status;
  const listOrderIdsByUserInCompany = vi.fn(async () => options?.asignados ?? [PEDIDO]);
  const findAliveById = vi.fn(async (_id: string, companyId: string) =>
    status === null || companyId !== EMPRESA ? null : { id: PEDIDO, status },
  );
  const listAliveSummariesByIds = vi.fn(
    async (companyId: string, _ids: readonly string[], statuses: readonly OrderStatus[]) => {
      const visible = status !== null && companyId === EMPRESA && statuses.includes(status);
      const items = visible ? [{ id: PEDIDO, recipeId: RECETA, status, packedBy: options?.packedBy ?? null }] : [];
      return { items, total: items.length, page: 1, pageSize: 1, totalPages: 1 };
    },
  );
  const findExecutionContentById = vi.fn(async () => ({
    steps: options?.pasosFabricacion ?? PASOS_FABRICACION,
  }));
  const findPackingStepsById = vi.fn(async () => options?.pasosEnvasado ?? PASOS_ENVASADO);

  const deps = {
    assignments: { listOrderIdsByUserInCompany },
    orders: { findAliveById, listAliveSummariesByIds },
    recipes: { findExecutionContentById },
    packingSteps: { findPackingStepsById },
  } as unknown as EvidenceTargetDeps;

  const puertos = [
    listOrderIdsByUserInCompany,
    findAliveById,
    listAliveSummariesByIds,
    findExecutionContentById,
    findPackingStepsById,
  ];
  return { deps, puertos };
}

/** Todos los `vi.fn` de un objeto, para afirmar que ninguno se llamo. */
export function funcionesDe(objeto: Record<string, unknown>): ReturnType<typeof vi.fn>[] {
  return Object.values(objeto).filter((v): v is ReturnType<typeof vi.fn> => vi.isMockFunction(v));
}
