/**
 * El avance de los pasos de acondicionamiento, contra Postgres real y con la composicion real
 * (`asignaciones` de `@/lib/composition`): completar, revisitar y cambiar responsables escriben las
 * anotaciones esperadas en `order_execution_entries`; el segundo completado del mismo paso lo
 * rechaza el indice unico `order_execution_entries_conditioning_step_once`; y otra empresa no ve ni
 * escribe nada.
 *
 * Como se fuerza la carrera sin depender del reloj: el registro GLOBAL se envuelve para que, con
 * `lecturaVieja.activa`, `listEntriesForOrders` devuelva la lista vacia. Es lo que ve la segunda
 * pestana que leyo antes de que la primera escribiera: cree que el paso 1 es el siguiente y lo
 * intenta escribir; quien lo para es el indice de la base, no un doble.
 *
 * AISLAMIENTO: `commit`. El caso de uso escribe con el cliente global y la carrera necesita dos
 * conexiones, asi que una transaccion del test no lo envolveria. Cada caso fabrica sus empresas
 * efimeras con randomUUID y las borra en su `finally`, en orden de FK.
 */
import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

const lecturaVieja = vi.hoisted(() => ({ activa: false }));

vi.mock('@/lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma', async (importOriginal) => {
  const real =
    await importOriginal<typeof import('@/lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma')>();
  return {
    ...real,
    createExecutionLogRepository: (db?: Parameters<typeof real.createExecutionLogRepository>[0]) => {
      const repo = real.createExecutionLogRepository(db);
      return {
        ...repo,
        listEntriesForOrders: async (companyId: string, orderIds: readonly string[]) =>
          lecturaVieja.activa ? [] : repo.listEntriesForOrders(companyId, orderIds),
      };
    },
  };
});

import { asignaciones } from '@/lib/composition';
import { ConditioningStepOutOfOrderError, OrderNotFoundError } from '@/lib/modules/asignaciones';
import { createExecutionLogRepository } from '@/lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma';
import { normalizeCompanyName } from '@/lib/modules/identity';
import { prisma } from '@/lib/shared/db/prisma';

type Actor = { readonly id: string; readonly companyId: string; readonly permissions: readonly string[] };

const PERMISOS_ACONDICIONADOR = ['asignaciones.consultar', 'acondicionamiento.modificar'] as const;

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

let nextSequence = 975_000;
function freshSequence(): number {
  nextSequence += 1;
  return nextSequence;
}

function paso(text: string) {
  return { blocks: [{ kind: 'paragraph' as const, spans: [{ text }] }] };
}

/** Tres pasos: solo el segundo exige responsables. */
const PASOS = [paso('Rotular cajas'), { ...paso('Paletizar'), requiresAssignment: true }, paso('Flejar el palet')];

type Empresa = {
  readonly companyId: string;
  readonly documentTypeCode: string;
  readonly roleIds: readonly string[];
  readonly recipeId: string;
  readonly packerId: string;
  readonly acondicionador: string;
  readonly operario: string;
};

async function crearRol(permisos: readonly string[]): Promise<string> {
  const role = await prisma.role.create({
    data: { name: `rol-${token()}`, description: 'Rol de prueba' },
    select: { id: true },
  });
  for (const permissionCode of permisos) {
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionCode } });
  }
  return role.id;
}

async function crearPersona(companyId: string, roleId: string, documentTypeCode: string, nombre: string): Promise<string> {
  const marca = token();
  const user = await prisma.user.create({
    data: {
      firstNames: nombre,
      lastNames: 'Prueba',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `${marca}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode,
      documentNumber: marca.slice(0, 12),
      username: `u.${marca}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId,
      companyId,
      accountStatus: 'active',
    },
    select: { id: true },
  });
  return user.id;
}

async function crearEmpresa(etiqueta: string): Promise<Empresa> {
  const marca = token();
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marca.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const nombre = `Empresa pasos acondicionamiento ${etiqueta} ${marca}`;
  const company = await prisma.company.create({
    data: { name: nombre, nameNormalized: normalizeCompanyName(nombre) },
    select: { id: true },
  });
  const rolAcondicionador = await crearRol(PERMISOS_ACONDICIONADOR);
  const rolOtro = await crearRol(['asignaciones.consultar', 'asignaciones.ejecutar']);
  const persona = (roleId: string, n: string) => crearPersona(company.id, roleId, documentType.code, n);
  const packerId = await persona(rolOtro, 'Empacador');
  const operario = await persona(rolOtro, 'Olga');
  const acondicionador = await persona(rolAcondicionador, 'Alba');
  const recipe = await prisma.recipe.create({
    data: {
      name: `Receta ${marca}`,
      nameNormalized: `receta${marca}`,
      companyId: company.id,
      conditioningSteps: PASOS,
    },
    select: { id: true },
  });

  return {
    companyId: company.id,
    documentTypeCode: documentType.code,
    roleIds: [rolAcondicionador, rolOtro],
    recipeId: recipe.id,
    packerId,
    acondicionador,
    operario,
  };
}

async function borrarEmpresas(empresas: readonly Empresa[]): Promise<void> {
  const companyIds = empresas.map((empresa) => empresa.companyId);
  const roleIds = empresas.flatMap((empresa) => empresa.roleIds);
  await prisma.orderExecutionEntry.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.orderConditioningTeamMember.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.order.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.recipe.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
  await prisma.role.deleteMany({ where: { id: { in: roleIds } } });
  await prisma.documentType.deleteMany({
    where: { code: { in: empresas.map((empresa) => empresa.documentTypeCode) } },
  });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

/** Un pedido `EN_ACONDICIONAMIENTO` a nombre del acondicionador, con el operario en su equipo. */
async function pedidoEnAcondicionamiento(empresa: Empresa, recipeId = empresa.recipeId): Promise<string> {
  const { id } = await prisma.order.create({
    data: {
      companyId: empresa.companyId,
      orderYear: new Date().getUTCFullYear(),
      orderSequence: freshSequence(),
      recipeId,
      quantity: new Prisma.Decimal('10'),
      status: 'POR_ACONDICIONAR',
      packedBy: empresa.packerId,
    },
    select: { id: true },
  });
  await prisma.order.update({
    where: { id },
    data: { status: 'EN_ACONDICIONAMIENTO', conditionedBy: empresa.acondicionador },
  });
  await prisma.orderConditioningTeamMember.create({
    data: { orderId: id, userId: empresa.operario, companyId: empresa.companyId, position: 0 },
  });
  return id;
}

function actor(empresa: Empresa): Actor {
  return { id: empresa.acondicionador, companyId: empresa.companyId, permissions: PERMISOS_ACONDICIONADOR };
}

async function leerAnotaciones(orderId: string) {
  return prisma.orderExecutionEntry.findMany({
    where: { orderId },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    select: { id: true, userId: true, action: true, stepPosition: true, responsibleUserIds: true },
  });
}

describe('QC-299 T14 — avance de los pasos de acondicionamiento contra la base real', () => {
  it('R27, R28: completar escribe un avance por paso y el ultimo cierra; revisitar con el mismo conjunto no escribe y con otro anade un cambio sin tocar lo anterior', async () => {
    const a = await crearEmpresa('A');
    try {
      const pedido = await pedidoEnAcondicionamiento(a);
      const alba = actor(a);

      // R27: saltarse el paso 1 se rechaza sin escribir.
      await expect(
        asignaciones.recordConditioningStep(alba, { orderId: pedido, stepPosition: 2, responsibleUserIds: [a.operario] }),
      ).rejects.toBeInstanceOf(ConditioningStepOutOfOrderError);
      expect(await leerAnotaciones(pedido)).toEqual([]);

      await expect(asignaciones.recordConditioningStep(alba, { orderId: pedido, stepPosition: 1 })).resolves.toEqual({
        completedCount: 1,
        allCompleted: false,
      });
      await expect(
        asignaciones.recordConditioningStep(alba, { orderId: pedido, stepPosition: 2, responsibleUserIds: [a.operario] }),
      ).resolves.toEqual({ completedCount: 2, allCompleted: false });

      // R27: un paso que la formula no tiene se rechaza sin escribir.
      await expect(asignaciones.recordConditioningStep(alba, { orderId: pedido, stepPosition: 4 })).rejects.toBeInstanceOf(
        ConditioningStepOutOfOrderError,
      );

      const tras2 = await leerAnotaciones(pedido);
      expect(tras2).toEqual([
        { id: expect.any(String), userId: a.acondicionador, action: 'CONDITIONING_STEP_ADVANCE', stepPosition: 1, responsibleUserIds: null },
        {
          id: expect.any(String),
          userId: a.acondicionador,
          action: 'CONDITIONING_STEP_ADVANCE',
          stepPosition: 2,
          responsibleUserIds: [a.operario],
        },
      ]);

      // R28: revisitar con el mismo conjunto y revisitar un paso sin asignacion no escriben.
      await asignaciones.recordConditioningStep(alba, { orderId: pedido, stepPosition: 2, responsibleUserIds: [a.operario] });
      await asignaciones.recordConditioningStep(alba, { orderId: pedido, stepPosition: 1 });
      expect(await leerAnotaciones(pedido)).toEqual(tras2);

      // R28: otro conjunto anade un cambio; las dos filas anteriores quedan intactas.
      await expect(
        asignaciones.recordConditioningStep(alba, {
          orderId: pedido,
          stepPosition: 2,
          responsibleUserIds: [a.acondicionador, a.operario],
        }),
      ).resolves.toEqual({ completedCount: 2, allCompleted: false });
      const trasCambio = await leerAnotaciones(pedido);
      expect(trasCambio.slice(0, 2)).toEqual(tras2);
      expect(trasCambio.slice(2)).toEqual([
        {
          id: expect.any(String),
          userId: a.acondicionador,
          action: 'CONDITIONING_RESPONSIBLES_CHANGE',
          stepPosition: 2,
          responsibleUserIds: [a.acondicionador, a.operario],
        },
      ]);

      // El ultimo paso cierra con `conditioning_steps_complete`.
      await expect(asignaciones.recordConditioningStep(alba, { orderId: pedido, stepPosition: 3 })).resolves.toEqual({
        completedCount: 3,
        allCompleted: true,
      });
      const finales = await leerAnotaciones(pedido);
      expect(finales.slice(0, 3)).toEqual(trasCambio);
      expect(finales.slice(3)).toEqual([
        { id: expect.any(String), userId: a.acondicionador, action: 'CONDITIONING_STEPS_COMPLETE', stepPosition: 3, responsibleUserIds: null },
      ]);

      // Al reabrir, el avance y los responsables vigentes salen de esas anotaciones.
      const detalle = await asignaciones.getConditioningOrder(alba, { orderId: pedido });
      expect(detalle.conditioningSteps?.steps).toHaveLength(3);
      expect(detalle.conditioningSteps?.completedCount).toBe(3);
      expect(detalle.conditioningSteps?.responsibles).toEqual([
        { stepPosition: 2, userIds: [a.acondicionador, a.operario] },
      ]);
    } finally {
      await borrarEmpresas([a]);
    }
  });

  it('R27: el segundo completado del mismo paso, que leyo antes de que el primero escribiera, lo rechaza el indice unico de la base', async () => {
    const a = await crearEmpresa('A');
    try {
      const pedido = await pedidoEnAcondicionamiento(a);
      const alba = actor(a);

      await asignaciones.recordConditioningStep(alba, { orderId: pedido, stepPosition: 1 });

      lecturaVieja.activa = true;
      try {
        await expect(asignaciones.recordConditioningStep(alba, { orderId: pedido, stepPosition: 1 })).rejects.toBeInstanceOf(
          ConditioningStepOutOfOrderError,
        );
      } finally {
        lecturaVieja.activa = false;
      }

      expect((await leerAnotaciones(pedido)).map((fila) => [fila.action, fila.stepPosition])).toEqual([
        ['CONDITIONING_STEP_ADVANCE', 1],
      ]);
    } finally {
      await borrarEmpresas([a]);
    }
  });

  it('R27: dos completados simultaneos del mismo paso dejan una sola anotacion; el que pierde, si escribe, falla con conditioning_step_out_of_order', async () => {
    const a = await crearEmpresa('A');
    try {
      const pedido = await pedidoEnAcondicionamiento(a);
      const alba = actor(a);

      const resultados = await Promise.allSettled([
        asignaciones.recordConditioningStep(alba, { orderId: pedido, stepPosition: 1 }),
        asignaciones.recordConditioningStep(alba, { orderId: pedido, stepPosition: 1 }),
      ]);

      // Segun quien lea antes, el perdedor revisita (no escribe) o choca con el indice.
      expect(resultados.some((r) => r.status === 'fulfilled')).toBe(true);
      for (const r of resultados) {
        if (r.status === 'rejected') expect(r.reason).toBeInstanceOf(ConditioningStepOutOfOrderError);
      }
      expect((await leerAnotaciones(pedido)).map((fila) => [fila.action, fila.stepPosition])).toEqual([
        ['CONDITIONING_STEP_ADVANCE', 1],
      ]);
    } finally {
      await borrarEmpresas([a]);
    }
  });

  it('R27: el adaptador traduce la violacion real del indice unico a `step_already_completed` y deja pasar los demas errores', async () => {
    const a = await crearEmpresa('A');
    try {
      const pedido = await pedidoEnAcondicionamiento(a);
      const log = createExecutionLogRepository();
      const anotacion = {
        action: 'conditioning_step_advance' as const,
        companyId: a.companyId,
        orderId: pedido,
        userId: a.acondicionador,
        stepPosition: 1,
        responsibleUserIds: null,
        occurredAt: new Date(),
      };

      await expect(log.append(anotacion)).resolves.toBe('ok');
      await expect(log.append(anotacion)).resolves.toBe('step_already_completed');
      // El cierre en la misma posicion choca con el mismo indice.
      await expect(log.append({ ...anotacion, action: 'conditioning_steps_complete' })).resolves.toBe(
        'step_already_completed',
      );
      // El cambio de responsables no entra en el indice: se anota tantas veces como haga falta.
      const cambio = {
        ...anotacion,
        action: 'conditioning_responsibles_change' as const,
        responsibleUserIds: [a.operario],
      };
      await expect(log.append(cambio)).resolves.toBe('ok');
      await expect(log.append(cambio)).resolves.toBe('ok');

      // Las tres llevan el mismo instante: el orden entre ellas no se mira.
      expect((await leerAnotaciones(pedido)).map((fila) => fila.action).sort()).toEqual([
        'CONDITIONING_RESPONSIBLES_CHANGE',
        'CONDITIONING_RESPONSIBLES_CHANGE',
        'CONDITIONING_STEP_ADVANCE',
      ]);
    } finally {
      await borrarEmpresas([a]);
    }
  });

  it('R32: el acondicionador de otra empresa no ve ni escribe el avance de un pedido ajeno', async () => {
    const a = await crearEmpresa('A');
    const b = await crearEmpresa('B');
    try {
      const pedido = await pedidoEnAcondicionamiento(a);
      await asignaciones.recordConditioningStep(actor(a), { orderId: pedido, stepPosition: 1 });
      const antes = await leerAnotaciones(pedido);

      await expect(asignaciones.getConditioningOrder(actor(b), { orderId: pedido })).rejects.toBeInstanceOf(
        OrderNotFoundError,
      );
      await expect(
        asignaciones.recordConditioningStep(actor(b), { orderId: pedido, stepPosition: 2, responsibleUserIds: [b.acondicionador] }),
      ).rejects.toBeInstanceOf(OrderNotFoundError);
      await expect(
        asignaciones.recordConditioningStep(actor(b), { orderId: pedido, stepPosition: 1 }),
      ).rejects.toBeInstanceOf(OrderNotFoundError);

      expect(await leerAnotaciones(pedido)).toEqual(antes);
      expect(await prisma.orderExecutionEntry.count({ where: { companyId: b.companyId } })).toBe(0);
    } finally {
      await borrarEmpresas([a, b]);
    }
  });

  it('R32: un pedido propio cuya receta es de otra empresa no recibe sus pasos ni acepta avance', async () => {
    const a = await crearEmpresa('A');
    const b = await crearEmpresa('B');
    try {
      const pedido = await pedidoEnAcondicionamiento(a, b.recipeId);
      const alba = actor(a);

      await expect(asignaciones.recordConditioningStep(alba, { orderId: pedido, stepPosition: 1 })).rejects.toBeInstanceOf(
        ConditioningStepOutOfOrderError,
      );
      expect(await leerAnotaciones(pedido)).toEqual([]);
    } finally {
      await borrarEmpresas([a, b]);
    }
  });
});
