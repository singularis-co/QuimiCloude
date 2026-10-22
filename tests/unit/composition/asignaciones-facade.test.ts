// QC-102 T5 — La FACHADA ya cableada del modulo `asignaciones` (`design.md > 2.5`).
//
// Lo que se afirma aqui es el CABLEADO, no el dominio: que `lib/composition` publica las CINCO
// operaciones del modulo —las cuatro de QC-87 mas la consulta EN LOTE de QC-102— y que la nueva se
// cablea con el MISMO repositorio y el MISMO directorio de personas, sin ningun adaptador nuevo y
// **sin `OrderCatalog`** (hallazgo H3: comprobar cada pedido costaria una consulta por pedido, que
// es justo lo que R4 prohibe).
//
// Como `tests/unit/composition/identity-facade.test.ts`: se sustituye el cliente Prisma entero
// —`lib/composition` arrastra todos los adaptadores del repo y no hace falta ni Postgres ni
// `DATABASE_URL`— y se ejercita el cableado REAL.

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/shared/db/prisma', () => ({ prisma: {} }));

import { asignaciones } from '@/lib/composition';

describe('QC-88 T8 (censo crecido por QC-63, QC-145, QC-168, QC-82, QC-167, QC-215, QC-218, QC-219, QC-214, la de abrir la pantalla, QC-271 y QC-299, menos QC-301) — la fachada de `asignaciones` lista sus TREINTA Y CINCO operaciones', () => {
  // El censo CRECE, no se afloja: primero llegaron las tres de la pantalla de ejecucion, luego
  // las tres de las vistas nuevas -`listFinishedOrders`, `listCompanyOrders`,
  // `listResponsibleCandidates`- y ahora las CUATRO del empaque de QC-168. Siguen nombradas UNA A
  // UNA y comparadas por igualdad exacta: una operacion futura que nadie declare aqui pone el caso
  // en rojo, que es justo lo que este censo promete.
  // 2026-10-06 (QC-82): crece con `cancelAssignedOrder` y `recordStepMove`.
  // 2026-10-08 (QC-167): crece con DOS operaciones de solo lectura del recorrido de ejecucion,
  // `listExecutionTraces` y `getExecutionTrace` (`design.md` de QC-167). Ninguna previa se quita.
  // 2026-10-08 (QC-215): crece con `startConditioning` y `finishConditioning`.
  // 2026-10-08: crece con `listConditioningOrders`, `listConditionedOrders` y `getConditioningOrder`.
  // 2026-10-08 (QC-218): crece con `listConditioningTeamCandidates`.
  // 2026-10-09 (QC-219): crece con `saveConditioningBatchData` y `listDeliveredConditionedOrders`.
  // 2026-10-13 (QC-214): crece con TRES operaciones de la evidencia por paso, `registerEvidence`,
  // `removeEvidence` y `requestEvidenceUpload` (T13, `design.md` de QC-214). Ninguna previa se
  // quita; el censo pasa de veintiocho a TREINTA Y UNA.
  // Crece con `openAssignedOrder`: abrir la pantalla sin comenzar un PENDIENTE. Pasa a TREINTA Y DOS.
  // 2026-10-14 (QC-271): crece con TRES lecturas de las fotos de un pedido ejecutado,
  // `getExecutionEvidence`, `getOrderEvidence` y `countOrderEvidence`. Ninguna previa se quita; el
  // censo pasa de treinta y dos a TREINTA Y CINCO.
  // 2026-10-19 (QC-301 R6): sale `listDeliveredConditionedOrders`, que alimentaba la pestana
  // «Entregados» del acondicionador. Es la unica que se quita; el censo baja a TREINTA Y CUATRO.
  // 2026-10-21 (QC-299): crece con `recordConditioningStep`, el avance de los pasos de
  // acondicionamiento. Ninguna previa se quita; el censo pasa a TREINTA Y SEIS.
  // Merge de dev en QC-299 (2026-10-21): 35 = 34 que deja QC-301 + `recordConditioningStep`.
  it('R31: expone las doce anteriores, las CUATRO de QC-168, las DOS de QC-82, las DOS de QC-167, las DOS de QC-215, las TRES del acondicionamiento, los candidatos del equipo, la de QC-219 que sigue (QC-301 R6 quita la de «Entregados»), las TRES de QC-214, la de abrir la pantalla, las TRES de QC-271 y la de QC-299, y ninguna mas', () => {
    expect(Object.keys(asignaciones).sort()).toEqual([
      'assignResponsibles',
      'cancelAssignedOrder',
      'countOrderEvidence',
      'finishAssignedOrder',
      'finishConditioning',
      'finishPacking',
      'getAssignedOrderExecution',
      'getConditioningOrder',
      'getExecutionEvidence',
      'getExecutionTrace',
      'getOrderEvidence',
      'getPackingOrder',
      'listAssignedOrders',
      'listCompanyOrders',
      'listConditionedOrders',
      'listConditioningOrders',
      'listConditioningTeamCandidates',
      'listExecutionTraces',
      'listFinishedOrders',
      'listOrderResponsibles',
      'listPackingOrders',
      'listResponsibleCandidates',
      'listResponsiblesForOrders',
      'openAssignedOrder',
      'recordConditioningStep',
      'recordStepMove',
      'registerEvidence',
      'removeEvidence',
      'removeWorkGroupFromOrder',
      'requestEvidenceUpload',
      'saveConditioningBatchData',
      'startAssignedOrder',
      'startConditioning',
      'startPacking',
      'unassignResponsible',
    ]);
  });

  it('`getAssignedOrderExecution` rechaza sin `asignaciones.consultar` sin llegar a la base', async () => {
    // Mismo criterio que los de abajo: con el cliente Prisma doblado a `{}`, un `unauthorized`
    // demuestra a la vez que el cableado existe y que el permiso corta ANTES de ningun puerto.
    const error = await asignaciones
      .getAssignedOrderExecution({ id: 'u', companyId: 'c', permissions: [] }, { orderId: 'o' })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('`startAssignedOrder` rechaza sin `asignaciones.consultar` sin llegar a la base', async () => {
    const error = await asignaciones
      .startAssignedOrder({ id: 'u', companyId: 'c', permissions: [] }, { orderId: 'o' })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('`finishAssignedOrder` rechaza sin `asignaciones.consultar` sin llegar a la base', async () => {
    const error = await asignaciones
      .finishAssignedOrder({ id: 'u', companyId: 'c', permissions: [] }, { orderId: 'o' })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('`listResponsiblesForOrders` es una funcion de DOS argumentos: el actor y los identificadores', () => {
    // El actor entra por PARAMETRO, igual que en las otras cuatro: la composicion no lo resuelve
    // (quien lo construye con las dos caras de la sesion es el adaptador driving).
    expect(typeof asignaciones.listResponsiblesForOrders).toBe('function');
    expect(asignaciones.listResponsiblesForOrders).toHaveLength(2);
  });

  it('rechaza sin permiso sin llegar a la base: la frontera esta en el caso de uso, no aqui', async () => {
    // El cliente Prisma doblado es `{}`: si la operacion tocara el repositorio, reventaria con un
    // `TypeError` en vez de con `unauthorized`. Que salga `unauthorized` demuestra las dos cosas a
    // la vez —el cableado existe y el permiso corta ANTES de ningun puerto (R2)—.
    const error = await asignaciones
      .listResponsiblesForOrders({ id: 'u', companyId: 'c', permissions: [] }, [])
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('`listAssignedOrders` es una funcion de DOS argumentos: el actor y la entrada', () => {
    expect(typeof asignaciones.listAssignedOrders).toBe('function');
    expect(asignaciones.listAssignedOrders).toHaveLength(2);
  });

  it('`listAssignedOrders` rechaza sin `asignaciones.consultar` sin llegar a la base (R5, R13)', async () => {
    // Mismo criterio que arriba: el cliente Prisma doblado es `{}`, asi que un `unauthorized`
    // demuestra a la vez que el cableado existe y que el permiso corta ANTES de ningun puerto.
    const error = await asignaciones
      .listAssignedOrders({ id: 'u', companyId: 'c', permissions: [] }, { page: 1 })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  // Las TRES operaciones nuevas: mismo criterio que las de arriba, el cliente Prisma doblado es
  // `{}`, asi que `unauthorized` demuestra el cableado sin llegar a ningun puerto.
  it('`listFinishedOrders` rechaza sin `terminados.consultar` sin llegar a la base', async () => {
    const error = await asignaciones
      .listFinishedOrders({ id: 'u', companyId: 'c', permissions: [] }, { page: 1 })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('`listCompanyOrders` rechaza sin `pedidos.consultar` sin llegar a la base', async () => {
    const error = await asignaciones
      .listCompanyOrders({ id: 'u', companyId: 'c', permissions: [] }, { page: 1 })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('`listResponsibleCandidates` rechaza sin `asignaciones.modificar` sin llegar a la base', async () => {
    const error = await asignaciones
      .listResponsibleCandidates({ id: 'u', companyId: 'c', permissions: [] }, {})
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  // Las CUATRO operaciones de QC-168: mismo criterio, el cliente Prisma doblado es `{}`, asi que
  // `unauthorized` demuestra el cableado sin llegar a ningun puerto.
  it('`listPackingOrders` rechaza sin `empaque.modificar` sin llegar a la base', async () => {
    const error = await asignaciones
      .listPackingOrders({ id: 'u', companyId: 'c', permissions: [] }, { page: 1 })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('`getPackingOrder` rechaza sin `empaque.modificar` sin llegar a la base', async () => {
    const error = await asignaciones
      .getPackingOrder({ id: 'u', companyId: 'c', permissions: [] }, { orderId: 'o' })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('`startPacking` rechaza sin `empaque.modificar` sin llegar a la base', async () => {
    const error = await asignaciones
      .startPacking({ id: 'u', companyId: 'c', permissions: [] }, { orderId: 'o' })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('`finishPacking` rechaza sin `empaque.modificar` sin llegar a la base', async () => {
    const error = await asignaciones
      .finishPacking({ id: 'u', companyId: 'c', permissions: [] }, { orderId: 'o' })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('R26: `cancelAssignedOrder` rechaza sin `asignaciones.ejecutar` sin llegar a la base', async () => {
    const error = await asignaciones
      .cancelAssignedOrder({ id: 'u', companyId: 'c', permissions: ['asignaciones.consultar'] }, { orderId: 'o' })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('R26: `recordStepMove` rechaza sin `asignaciones.ejecutar` sin llegar a la base', async () => {
    const error = await asignaciones
      .recordStepMove({ id: 'u', companyId: 'c', permissions: ['asignaciones.consultar'] }, { orderId: 'o' })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  // QC-215: mismo criterio, con un actor que tiene los permisos del empaque pero no el suyo.
  it('R15: `startConditioning` rechaza sin `acondicionamiento.modificar` sin llegar a la base', async () => {
    const error = await asignaciones
      .startConditioning({ id: 'u', companyId: 'c', permissions: ['empaque.modificar'] }, { orderId: 'o' })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('R15: `finishConditioning` rechaza sin `acondicionamiento.modificar` sin llegar a la base', async () => {
    const error = await asignaciones
      .finishConditioning({ id: 'u', companyId: 'c', permissions: ['empaque.modificar'] }, { orderId: 'o' })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('R19: `listConditioningOrders` rechaza sin `acondicionamiento.modificar` sin llegar a la base', async () => {
    const error = await asignaciones
      .listConditioningOrders({ id: 'u', companyId: 'c', permissions: ['empaque.modificar'] }, { page: 1 })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('R19: `listConditionedOrders` rechaza sin `acondicionamiento.modificar` sin llegar a la base', async () => {
    const error = await asignaciones
      .listConditionedOrders({ id: 'u', companyId: 'c', permissions: ['terminados.consultar'] }, { page: 1 })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('QC-219 R13: `saveConditioningBatchData` rechaza sin `acondicionamiento.modificar` sin llegar a la base', async () => {
    const error = await asignaciones
      .saveConditioningBatchData({ id: 'u', companyId: 'c', permissions: ['empaque.modificar'] }, { orderId: 'o' })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('QC-301 R6: la fachada no expone un caso de uso que liste los `ENTREGADO` acondicionados por el actor', () => {
    expect(Object.keys(asignaciones)).not.toContain('listDeliveredConditionedOrders');
  });

  it('R19: `getConditioningOrder` rechaza sin `acondicionamiento.modificar` sin llegar a la base', async () => {
    const error = await asignaciones
      .getConditioningOrder({ id: 'u', companyId: 'c', permissions: ['pedidos.consultar'] }, { orderId: 'o' })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('R30: `listConditioningTeamCandidates` rechaza sin `acondicionamiento.modificar` sin llegar a la base', async () => {
    const error = await asignaciones
      .listConditioningTeamCandidates(
        { id: 'u', companyId: 'c', permissions: ['asignaciones.modificar', 'usuarios.consultar'] },
        {},
      )
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('QC-271 R1: `getExecutionEvidence` rechaza sin `dashboard.consultar` sin llegar a la base', async () => {
    const error = await asignaciones
      .getExecutionEvidence({ id: 'u', companyId: 'c', permissions: ['pedidos.consultar'] }, { orderId: 'o' })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('QC-271 R2: `getOrderEvidence` rechaza sin `pedidos.consultar` sin llegar a la base', async () => {
    const error = await asignaciones
      .getOrderEvidence({ id: 'u', companyId: 'c', permissions: ['inventario.consultar'] }, { orderId: 'o' })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('QC-271 R2: `countOrderEvidence` rechaza sin `pedidos.consultar` sin llegar a la base', async () => {
    const error = await asignaciones
      .countOrderEvidence({ id: 'u', companyId: 'c', permissions: ['inventario.consultar'] }, { orderIds: [] })
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('QC-299 R31: `recordConditioningStep` rechaza sin `acondicionamiento.modificar` sin llegar a la base', async () => {
    const error = await asignaciones
      .recordConditioningStep(
        { id: 'u', companyId: 'c', permissions: ['empaque.modificar', 'recetas.consultar'] },
        { orderId: 'o', stepPosition: 1 },
      )
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });

  it('R19: `startConditioning` con la entrada nueva sigue rechazando sin el permiso sin llegar a la base', async () => {
    const error = await asignaciones
      .startConditioning(
        { id: 'u', companyId: 'c', permissions: ['empaque.modificar'] },
        { orderId: 'o', userIds: [], workGroupIds: [] },
      )
      .catch((caught: unknown) => caught);

    expect((error as { code?: string }).code).toBe('unauthorized');
  });
});
