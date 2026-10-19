/**
 * Siembra CONFIRMADA para los `.int` de la entrega sin pedido, sobre `order-delivery-seed.ts`: el
 * escenario del tablero (20 envases en stock y dos pedidos TERMINADO que esperan 5 y 3, excedente 12)
 * con envases de 2 L, para que cantidad y envases no coincidan.
 */
import { prisma } from '@/lib/shared/db/prisma';

import {
  borrarEmpresaDeEntrega,
  crearCliente,
  crearEmpresaDeEntrega,
  crearLote,
  crearPedido,
  crearPresentacion,
  crearTerminado,
  type EmpresaDeEntrega,
} from './order-delivery-seed';

import type { Actor } from '@/lib/modules/pedidos';

export type EscenarioSinPedido = {
  readonly empresa: EmpresaDeEntrega;
  /** Con `entregas.modificar` y `entregas.anular`. */
  readonly actor: Actor;
  readonly ana: string;
  readonly bruno: string;
  readonly presentationId: string;
  readonly productId: string;
  /** 12 envases de 2 L (24.0000). */
  readonly olderBatchId: string;
  /** 8 envases de 2 L (16.0000). */
  readonly newerBatchId: string;
  /** TERMINADO, espera 5 envases. */
  readonly firstOrder: { readonly orderId: string; readonly lineId: string };
  /** TERMINADO, espera 3 envases. */
  readonly secondOrder: { readonly orderId: string; readonly lineId: string };
};

export async function crearEscenarioSinPedido(label: string): Promise<EscenarioSinPedido> {
  const empresa = await crearEmpresaDeEntrega(label);
  const ana = await crearCliente(empresa, 'Perez');
  const bruno = await crearCliente(empresa, 'Diaz');
  const presentationId = await crearPresentacion(empresa, '2.0000');
  const productId = await crearTerminado(empresa, presentationId);
  const olderBatchId = await crearLote(empresa, productId, presentationId, '24.0000', '2.0000', '2026-09-01');
  const newerBatchId = await crearLote(empresa, productId, presentationId, '16.0000', '2.0000', '2026-09-02');
  const first = await crearPedido(empresa, 'TERMINADO', ana, [{ presentationId, packages: 5 }]);
  const second = await crearPedido(empresa, 'TERMINADO', bruno, [{ presentationId, packages: 3 }]);
  return {
    empresa,
    actor: { ...empresa.actor, permissions: ['entregas.modificar', 'entregas.anular'] },
    ana,
    bruno,
    presentationId,
    productId,
    olderBatchId,
    newerBatchId,
    firstOrder: { orderId: first.orderId, lineId: first.lineIds[0] as string },
    secondOrder: { orderId: second.orderId, lineId: second.lineIds[0] as string },
  };
}

/** Antes que `borrarEmpresaDeEntrega`: las anulaciones y sus asientos. */
export async function borrarEmpresaSinPedido(empresa: EmpresaDeEntrega): Promise<void> {
  const companyId = empresa.companyId;
  await prisma.inventoryMovement.deleteMany({ where: { companyId } });
  await prisma.orderDeliveryVoidLine.deleteMany({ where: { companyId } });
  await prisma.orderDeliveryVoid.deleteMany({ where: { companyId } });
  await borrarEmpresaDeEntrega(empresa);
}

/** Lo que escriben la entrega sin pedido y su anulacion en la empresa. */
export async function escritoSinPedido(companyId: string): Promise<{
  entregas: number;
  lineas: number;
  asientos: number;
  anulaciones: number;
  lineasAnuladas: number;
  asientosDeAnulacion: number;
}> {
  return {
    entregas: await prisma.orderDelivery.count({ where: { companyId, orderId: null } }),
    lineas: await prisma.orderDeliveryLine.count({ where: { companyId, orderPresentationLineId: null } }),
    asientos: await prisma.inventoryMovement.count({ where: { companyId, kind: 'direct_delivery' } }),
    anulaciones: await prisma.orderDeliveryVoid.count({ where: { companyId, delivery: { orderId: null } } }),
    lineasAnuladas: await prisma.orderDeliveryVoidLine.count({ where: { companyId, deliveryLine: { orderPresentationLineId: null } } }),
    asientosDeAnulacion: await prisma.inventoryMovement.count({ where: { companyId, kind: 'direct_delivery_void' } }),
  };
}

export const NADA_ESCRITO = {
  entregas: 0,
  lineas: 0,
  asientos: 0,
  anulaciones: 0,
  lineasAnuladas: 0,
  asientosDeAnulacion: 0,
} as const;

export function codigos(resultados: readonly PromiseSettledResult<unknown>[]): string[] {
  return resultados
    .map((r) => (r.status === 'fulfilled' ? 'aplicada' : ((r.reason as { code?: string }).code ?? String(r.reason))))
    .sort();
}

export async function codigoDe(operacion: Promise<unknown>): Promise<string> {
  const error = await operacion.then(
    () => null,
    (e: unknown) => e,
  );
  if (error === null) throw new Error('la operacion tenia que fallar');
  return (error as { code?: string }).code ?? String(error);
}
