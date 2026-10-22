// Completar y revisitar pasos de acondicionamiento: el avance y los responsables se anotan en el
// registro de ejecucion, y todo lo demas se rechaza sin escribir.
import { describe, expect, it } from 'vitest';

import { createRecordConditioningStep } from '@/lib/modules/asignaciones/domain/record-conditioning-step';
import {
  ConditioningResponsibleNotAllowedError,
  ConditioningResponsiblesRequiredError,
  ConditioningStepOutOfOrderError,
  EvidenceRequiredError,
  OrderConditioningTakenError,
  OrderNotConditionableError,
  OrderNotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/modules/asignaciones/domain/errors';
import { ROLE_ACONDICIONAMIENTO, ROLE_ADMINISTRADOR, ROLE_EMPACADOR, ROLE_OPERADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';

import type { Actor } from '@/lib/modules/asignaciones/domain/actor';
import type { ConditioningTeamMemberRow } from '@/lib/modules/asignaciones/ports/conditioning-team-repository';
import type { ConditioningStepView } from '@/lib/modules/recetas';

import {
  ACONDICIONADOR,
  AHORA,
  ANA,
  BETO,
  EMPRESA,
  PEDIDO_1,
  RECETA,
  actoresSinElPermiso,
  anotacionDePaso,
  fotoDeAcondicionamiento,
  montarRegistroDePaso,
  uuid,
} from './conditioning-doubles';

const CARLA = uuid('c');
const EXTRANO = uuid('d');
const OTRA_EMPRESA = uuid('4');

const SIMPLE: ConditioningStepView = { blocks: [] };
const CON_FOTO: ConditioningStepView = { blocks: [], requiresEvidence: true };
const CON_ASIGNACION: ConditioningStepView = { blocks: [], requiresAssignment: true };

/** Tres pasos: el 2 pide responsables. */
const PASOS: readonly ConditioningStepView[] = [SIMPLE, CON_ASIGNACION, SIMPLE];

const EQUIPO: readonly ConditioningTeamMemberRow[] = [
  { userId: BETO, workGroupId: null, workGroupName: null },
  { userId: CARLA, workGroupId: null, workGroupName: null },
];

describe('recordConditioningStep — autorizacion (R31)', () => {
  it.each(actoresSinElPermiso(SEED_ROLE_PERMISSIONS, [ROLE_ADMINISTRADOR, ROLE_OPERADOR, ROLE_EMPACADOR]))(
    'R31: rechaza con unauthorized a %s, aun con entrada invalida, sin tocar ningun puerto',
    async (_nombre, actor) => {
      const { deps, todos } = montarRegistroDePaso({ pasos: PASOS });

      await expect(
        createRecordConditioningStep(deps)(actor, { orderId: 'no-es-uuid', stepPosition: 0 }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      for (const doble of todos) expect(doble).not.toHaveBeenCalled();
    },
  );

  it('R31: con acondicionamiento.modificar y sin recetas.consultar completa el paso', async () => {
    const actor: Actor = { id: ANA, companyId: EMPRESA, permissions: SEED_ROLE_PERMISSIONS[ROLE_ACONDICIONAMIENTO]! };
    expect(actor.permissions).toContain('acondicionamiento.modificar');
    expect(actor.permissions).not.toContain('recetas.consultar');
    const { deps, append } = montarRegistroDePaso({ pasos: PASOS });

    await expect(createRecordConditioningStep(deps)(actor, { orderId: PEDIDO_1, stepPosition: 1 })).resolves.toEqual({
      completedCount: 1,
      allCompleted: false,
    });
    expect(append).toHaveBeenCalledTimes(1);
  });
});

describe('recordConditioningStep — entrada', () => {
  it.each([
    ['orderId que no es uuid', { orderId: 'pedido', stepPosition: 1 }],
    ['sin stepPosition', { orderId: PEDIDO_1 }],
    ['stepPosition 0', { orderId: PEDIDO_1, stepPosition: 0 }],
    ['stepPosition decimal', { orderId: PEDIDO_1, stepPosition: 1.5 }],
    ['un responsable que no es uuid', { orderId: PEDIDO_1, stepPosition: 2, responsibleUserIds: ['beto'] }],
    ['una clave de mas', { orderId: PEDIDO_1, stepPosition: 1, companyId: EMPRESA }],
    ['no es un objeto', PEDIDO_1],
  ])('R31: %s rechaza con invalid_input sin tocar ningun puerto', async (_nombre, entrada) => {
    const { deps, todos } = montarRegistroDePaso({ pasos: PASOS });

    const error = await createRecordConditioningStep(deps)(ACONDICIONADOR, entrada).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ValidationError);
    for (const doble of todos) expect(doble).not.toHaveBeenCalled();
  });

  it('R23: un responsable repetido rechaza con invalid_input sin tocar ningun puerto', async () => {
    const { deps, todos } = montarRegistroDePaso({ pasos: PASOS, equipo: EQUIPO });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, {
        orderId: PEDIDO_1,
        stepPosition: 2,
        responsibleUserIds: [BETO, BETO],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    for (const doble of todos) expect(doble).not.toHaveBeenCalled();
  });
});

describe('recordConditioningStep — solo sobre un pedido EN_ACONDICIONAMIENTO del actor (R29, R32)', () => {
  it.each([
    ['POR_ACONDICIONAR', 'POR_ACONDICIONAR', null, OrderNotConditionableError],
    ['TERMINADO', 'TERMINADO', ANA, OrderNotConditionableError],
    ['ENTREGADO', 'ENTREGADO', ANA, OrderNotConditionableError],
    ['EN_ACONDICIONAMIENTO de otra persona', 'EN_ACONDICIONAMIENTO', BETO, OrderConditioningTakenError],
  ] as const)('R29: %s rechaza sin leer los pasos ni escribir', async (_nombre, status, conditionedBy, clase) => {
    const { deps, findConditioningStepsById, listEntriesForOrders, append } = montarRegistroDePaso({
      status,
      conditionedBy,
      pasos: PASOS,
    });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 1 }),
    ).rejects.toBeInstanceOf(clase);
    expect(findConditioningStepsById).not.toHaveBeenCalled();
    expect(listEntriesForOrders).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it('R29: tambien rechaza el cambio de responsables de un paso ya completado en un pedido terminado', async () => {
    const { deps, append } = montarRegistroDePaso({
      status: 'TERMINADO',
      pasos: PASOS,
      equipo: EQUIPO,
      anotaciones: [anotacionDePaso('conditioning_step_advance', 1, null), anotacionDePaso('conditioning_step_advance', 2, [BETO])],
    });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 2, responsibleUserIds: [CARLA] }),
    ).rejects.toBeInstanceOf(OrderNotConditionableError);
    expect(append).not.toHaveBeenCalled();
  });

  it('R32: un pedido inexistente o de otra empresa es order_not_found sin escribir', async () => {
    const { deps, listAliveSummariesByIds, append } = montarRegistroDePaso({ target: null, pasos: PASOS });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 1 }),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(listAliveSummariesByIds).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it('R32: la empresa sale siempre del actor: pedido, receta, registro y anotacion', async () => {
    const actor: Actor = { ...ACONDICIONADOR, companyId: OTRA_EMPRESA };
    const { deps, findAliveById, listAliveSummariesByIds, findConditioningStepsById, listEntriesForOrders, append } =
      montarRegistroDePaso({ pasos: PASOS });

    await createRecordConditioningStep(deps)(actor, { orderId: PEDIDO_1, stepPosition: 1 });

    expect(findAliveById).toHaveBeenCalledWith(PEDIDO_1, OTRA_EMPRESA);
    expect(listAliveSummariesByIds.mock.calls[0]?.[0]).toBe(OTRA_EMPRESA);
    expect(findConditioningStepsById).toHaveBeenCalledWith(RECETA, OTRA_EMPRESA);
    expect(listEntriesForOrders).toHaveBeenCalledWith(OTRA_EMPRESA, [PEDIDO_1]);
    expect(append.mock.calls[0]?.[0]).toMatchObject({ companyId: OTRA_EMPRESA });
  });

  it('R32: una receta que el lector no devuelve (otra empresa) no tiene ningun paso que completar', async () => {
    const { deps, append } = montarRegistroDePaso({ pasos: null });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 1 }),
    ).rejects.toBeInstanceOf(ConditioningStepOutOfOrderError);
    expect(append).not.toHaveBeenCalled();
  });
});

describe('recordConditioningStep — completa solo el siguiente (R27, R35)', () => {
  it('R27: sin avance, el paso 1 se anota como conditioning_step_advance sin responsables', async () => {
    const { deps, append } = montarRegistroDePaso({ pasos: PASOS });

    const resultado = await createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 1 });

    expect(resultado).toEqual({ completedCount: 1, allCompleted: false });
    expect(append).toHaveBeenCalledWith({
      action: 'conditioning_step_advance',
      companyId: EMPRESA,
      orderId: PEDIDO_1,
      userId: ANA,
      stepPosition: 1,
      responsibleUserIds: null,
      occurredAt: AHORA,
    });
  });

  it('R27: el ultimo paso se anota como conditioning_steps_complete y deja todo completado', async () => {
    const { deps, append } = montarRegistroDePaso({
      pasos: PASOS,
      anotaciones: [anotacionDePaso('conditioning_step_advance', 1, null), anotacionDePaso('conditioning_step_advance', 2, [BETO])],
    });

    const resultado = await createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 3 });

    expect(resultado).toEqual({ completedCount: 3, allCompleted: true });
    expect(append).toHaveBeenCalledTimes(1);
    expect(append.mock.calls[0]?.[0]).toMatchObject({ action: 'conditioning_steps_complete', stepPosition: 3 });
  });

  it('R27: una formula de un solo paso lo completa con conditioning_steps_complete', async () => {
    const { deps, append } = montarRegistroDePaso({ pasos: [SIMPLE] });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 1 }),
    ).resolves.toEqual({ completedCount: 1, allCompleted: true });
    expect(append.mock.calls[0]?.[0]).toMatchObject({ action: 'conditioning_steps_complete' });
  });

  it('R27: saltar pasos rechaza con conditioning_step_out_of_order sin escribir', async () => {
    const { deps, append } = montarRegistroDePaso({
      pasos: PASOS,
      anotaciones: [anotacionDePaso('conditioning_step_advance', 1, null)],
    });

    const error = await createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 3 }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ConditioningStepOutOfOrderError);
    expect((error as ConditioningStepOutOfOrderError).code).toBe('conditioning_step_out_of_order');
    expect(append).not.toHaveBeenCalled();
  });

  it('R27: un paso que ya no existe en la formula rechaza sin escribir ni leer el registro', async () => {
    const { deps, append, listEntriesForOrders } = montarRegistroDePaso({ pasos: PASOS });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 4 }),
    ).rejects.toBeInstanceOf(ConditioningStepOutOfOrderError);
    expect(listEntriesForOrders).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it('R27: una formula sin pasos de acondicionamiento no tiene nada que completar', async () => {
    const { deps, append } = montarRegistroDePaso({ pasos: [] });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 1 }),
    ).rejects.toBeInstanceOf(ConditioningStepOutOfOrderError);
    expect(append).not.toHaveBeenCalled();
  });

  it('R27: si otra pestana ya completo el paso, el desenlace del registro sale como conditioning_step_out_of_order', async () => {
    const { deps, append } = montarRegistroDePaso({ pasos: PASOS, desenlace: 'step_already_completed' });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 1 }),
    ).rejects.toBeInstanceOf(ConditioningStepOutOfOrderError);
    expect(append).toHaveBeenCalledTimes(1);
  });

  it('R35: completar un paso con asignacion anota sus responsables', async () => {
    const { deps, append } = montarRegistroDePaso({
      pasos: PASOS,
      equipo: EQUIPO,
      anotaciones: [anotacionDePaso('conditioning_step_advance', 1, null)],
    });

    await createRecordConditioningStep(deps)(ACONDICIONADOR, {
      orderId: PEDIDO_1,
      stepPosition: 2,
      responsibleUserIds: [CARLA, ANA],
    });

    expect(append).toHaveBeenCalledWith({
      action: 'conditioning_step_advance',
      companyId: EMPRESA,
      orderId: PEDIDO_1,
      userId: ANA,
      stepPosition: 2,
      responsibleUserIds: [CARLA, ANA],
      occurredAt: AHORA,
    });
  });
});

describe('recordConditioningStep — evidencia (R21)', () => {
  it('R21: completar un paso que pide evidencia sin ninguna foto suya rechaza sin escribir', async () => {
    const { deps, append, listByOrder } = montarRegistroDePaso({
      pasos: [CON_FOTO, SIMPLE],
      fotos: [fotoDeAcondicionamiento(2)],
    });

    const error = await createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 1 }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(EvidenceRequiredError);
    expect((error as EvidenceRequiredError).code).toBe('evidence_required');
    expect(listByOrder).toHaveBeenCalledWith(EMPRESA, PEDIDO_1, 'conditioning');
    expect(append).not.toHaveBeenCalled();
  });

  it('R21: con una foto en ese paso lo completa', async () => {
    const { deps, append } = montarRegistroDePaso({ pasos: [CON_FOTO, SIMPLE], fotos: [fotoDeAcondicionamiento(1)] });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 1 }),
    ).resolves.toEqual({ completedCount: 1, allCompleted: false });
    expect(append).toHaveBeenCalledTimes(1);
  });

  it('R21: un paso sin evidencia no consulta las fotos', async () => {
    const { deps, listByOrder } = montarRegistroDePaso({ pasos: PASOS });

    await createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 1 });

    expect(listByOrder).not.toHaveBeenCalled();
  });
});

describe('recordConditioningStep — responsables (R23)', () => {
  const COMPLETADO_1 = [anotacionDePaso('conditioning_step_advance', 1, null)];

  it('R23: un paso con asignacion sin ningun responsable rechaza con conditioning_responsibles_required', async () => {
    const { deps, append } = montarRegistroDePaso({ pasos: PASOS, equipo: EQUIPO, anotaciones: COMPLETADO_1 });

    const error = await createRecordConditioningStep(deps)(ACONDICIONADOR, {
      orderId: PEDIDO_1,
      stepPosition: 2,
      responsibleUserIds: [],
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConditioningResponsiblesRequiredError);
    expect((error as ConditioningResponsiblesRequiredError).code).toBe('conditioning_responsibles_required');
    expect(append).not.toHaveBeenCalled();
  });

  it('R23: omitir la lista en un paso con asignacion es lo mismo que mandarla vacia', async () => {
    const { deps, append } = montarRegistroDePaso({ pasos: PASOS, equipo: EQUIPO, anotaciones: COMPLETADO_1 });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 2 }),
    ).rejects.toBeInstanceOf(ConditioningResponsiblesRequiredError);
    expect(append).not.toHaveBeenCalled();
  });

  it('R23: alguien fuera del equipo y que no es el acondicionador rechaza con conditioning_responsible_not_allowed', async () => {
    const { deps, append, listByOrderInCompany } = montarRegistroDePaso({
      pasos: PASOS,
      equipo: EQUIPO,
      anotaciones: COMPLETADO_1,
    });

    const error = await createRecordConditioningStep(deps)(ACONDICIONADOR, {
      orderId: PEDIDO_1,
      stepPosition: 2,
      responsibleUserIds: [BETO, EXTRANO],
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConditioningResponsibleNotAllowedError);
    expect((error as ConditioningResponsibleNotAllowedError).code).toBe('conditioning_responsible_not_allowed');
    expect(listByOrderInCompany).toHaveBeenCalledWith(EMPRESA, PEDIDO_1);
    expect(append).not.toHaveBeenCalled();
  });

  it('R23: el acondicionador solo, sin nadie del equipo, vale como responsable', async () => {
    const { deps, append } = montarRegistroDePaso({ pasos: PASOS, equipo: EQUIPO, anotaciones: COMPLETADO_1 });

    await createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 2, responsibleUserIds: [ANA] });

    expect(append.mock.calls[0]?.[0]).toMatchObject({ stepPosition: 2, responsibleUserIds: [ANA] });
  });

  it('R23: responsables en un paso sin asignacion rechaza con invalid_input sin escribir', async () => {
    const { deps, append, listByOrderInCompany } = montarRegistroDePaso({ pasos: PASOS, equipo: EQUIPO });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 1, responsibleUserIds: [BETO] }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(listByOrderInCompany).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it('R23: el cambio de responsables de un paso ya completado tambien se valida contra el equipo', async () => {
    const { deps, append } = montarRegistroDePaso({
      pasos: PASOS,
      equipo: EQUIPO,
      anotaciones: [...COMPLETADO_1, anotacionDePaso('conditioning_step_advance', 2, [BETO])],
    });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 2, responsibleUserIds: [EXTRANO] }),
    ).rejects.toBeInstanceOf(ConditioningResponsibleNotAllowedError);
    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 2, responsibleUserIds: [] }),
    ).rejects.toBeInstanceOf(ConditioningResponsiblesRequiredError);
    expect(append).not.toHaveBeenCalled();
  });
});

describe('recordConditioningStep — revisitar un paso completado (R28)', () => {
  const HASTA_EL_2 = [
    anotacionDePaso('conditioning_step_advance', 1, null),
    anotacionDePaso('conditioning_step_advance', 2, [BETO]),
  ];

  it('R28: con otro conjunto anota conditioning_responsibles_change y no toca el avance', async () => {
    const { deps, append } = montarRegistroDePaso({ pasos: PASOS, equipo: EQUIPO, anotaciones: HASTA_EL_2 });

    const resultado = await createRecordConditioningStep(deps)(ACONDICIONADOR, {
      orderId: PEDIDO_1,
      stepPosition: 2,
      responsibleUserIds: [BETO, CARLA],
    });

    expect(resultado).toEqual({ completedCount: 2, allCompleted: false });
    expect(append).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledWith({
      action: 'conditioning_responsibles_change',
      companyId: EMPRESA,
      orderId: PEDIDO_1,
      userId: ANA,
      stepPosition: 2,
      responsibleUserIds: [BETO, CARLA],
      occurredAt: AHORA,
    });
  });

  it('R28: con el mismo conjunto, en otro orden, no escribe nada', async () => {
    const { deps, append } = montarRegistroDePaso({
      pasos: PASOS,
      equipo: EQUIPO,
      anotaciones: [anotacionDePaso('conditioning_step_advance', 1, null), anotacionDePaso('conditioning_step_advance', 2, [BETO, CARLA])],
    });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 2, responsibleUserIds: [CARLA, BETO] }),
    ).resolves.toEqual({ completedCount: 2, allCompleted: false });
    expect(append).not.toHaveBeenCalled();
  });

  it('R28: compara contra el ultimo cambio, no contra el completado', async () => {
    const anotaciones = [...HASTA_EL_2, anotacionDePaso('conditioning_responsibles_change', 2, [CARLA], 10)];
    const mismo = montarRegistroDePaso({ pasos: PASOS, equipo: EQUIPO, anotaciones });
    const vuelta = montarRegistroDePaso({ pasos: PASOS, equipo: EQUIPO, anotaciones });

    await createRecordConditioningStep(mismo.deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 2, responsibleUserIds: [CARLA] });
    await createRecordConditioningStep(vuelta.deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 2, responsibleUserIds: [BETO] });

    expect(mismo.append).not.toHaveBeenCalled();
    expect(vuelta.append).toHaveBeenCalledTimes(1);
    expect(vuelta.append.mock.calls[0]?.[0]).toMatchObject({
      action: 'conditioning_responsibles_change',
      responsibleUserIds: [BETO],
    });
  });

  it('R28: revisitar un paso sin asignacion no escribe nada', async () => {
    const { deps, append } = montarRegistroDePaso({ pasos: PASOS, anotaciones: HASTA_EL_2 });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 1 }),
    ).resolves.toEqual({ completedCount: 2, allCompleted: false });
    expect(append).not.toHaveBeenCalled();
  });

  it('R28: revisitar un paso con evidencia no vuelve a exigir fotos', async () => {
    const { deps, append, listByOrder } = montarRegistroDePaso({
      pasos: [CON_FOTO, SIMPLE],
      anotaciones: [anotacionDePaso('conditioning_step_advance', 1, null)],
    });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 1 }),
    ).resolves.toEqual({ completedCount: 1, allCompleted: false });
    expect(listByOrder).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it('R28: con todos completados, revisitar devuelve allCompleted', async () => {
    const { deps } = montarRegistroDePaso({
      pasos: PASOS,
      equipo: EQUIPO,
      anotaciones: [...HASTA_EL_2, anotacionDePaso('conditioning_steps_complete', 3, null)],
    });

    await expect(
      createRecordConditioningStep(deps)(ACONDICIONADOR, { orderId: PEDIDO_1, stepPosition: 1 }),
    ).resolves.toEqual({ completedCount: 3, allCompleted: true });
  });
});
