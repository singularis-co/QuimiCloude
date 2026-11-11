import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { identity } from '@/lib/composition';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import { openAssignedOrderAction } from '@/lib/modules/asignaciones/adapters/driving/order-execution-actions';
import { BRAND_LABEL } from '@/lib/shared/navigation/private-nav';

import { recipeAccessOf, recipeLineIdOf, type RecipeSearchParams } from '../components';

import { OrderExecutionError, OrderExecutionScreen } from './components';

export const metadata: Metadata = {
  title: `Ejecutar fórmula · ${BRAND_LABEL}`,
};

/**
 * Pantalla de ejecucion de una receta de un pedido asignado, la que nombra `?receta=`.
 *
 * El corte por permiso es la PRIMERA linea, antes de resolver `params`: sin `asignaciones.ejecutar`
 * responde 404, nunca 403. La direccion sale de `assignedOrderRoute` (`lib/shared/routes.ts`); esta
 * carpeta es solo la forma en que el App Router materializa esa constante.
 *
 * Entrar es libre: un pedido `PENDIENTE` se abre sin comenzarlo -lo comienza el boton «Comenzar»
 * de la pantalla- y uno `EN_CURSO` se retoma. El resultado baja entero por props: ningun
 * componente de cliente de esta ruta importa `lib/composition`.
 */
export default async function AssignedOrderExecutionPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<RecipeSearchParams>;
}) {
  await requirePagePermission('asignaciones.ejecutar');

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const lineId = recipeLineIdOf(query);
  if (lineId === null) notFound();

  const result = await openAssignedOrderAction(id, lineId);

  if (result.status === 'error') {
    return <OrderExecutionError error={result} />;
  }

  // Misma lectura de sesion que `requirePagePermission`: esta memoizada por peticion.
  const access = recipeAccessOf(await identity.getSessionUser());

  return <OrderExecutionScreen execution={result.data} lineId={lineId} access={access} />;
}
