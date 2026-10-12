import { AssignmentListEmpty } from './assignment-list-parts';

/** El estado vacío de las listas del acondicionador. */

export const CONDITIONING_ORDERS_EMPTY_TEXTS = {
  por_acondicionar: 'No hay pedidos por acondicionar en tu empresa.',
  acondicionados: 'Todavía no has terminado ningún acondicionamiento.',
  acondicionados_entregados: 'Todavía no se ha entregado ningún pedido que acondicionaste.',
} as const;

export const CONDITIONING_ORDERS_PAGE_PAST_END_TEXT = 'Esta página ya no tiene pedidos.';
export const CONDITIONING_ORDERS_FIRST_PAGE_TEXT = 'Volver a la primera página';

export type ConditioningOrdersEmptyProps = {
  /** Qué lista está vacía: decide el texto cuando no hay ningún pedido. */
  readonly list: keyof typeof CONDITIONING_ORDERS_EMPTY_TEXTS;
  /** Presente solo si la pagina pedida se paso del total; ausente si no hay ningun pedido. */
  readonly firstPageHref?: string;
};

export function ConditioningOrdersEmpty({ list, firstPageHref }: ConditioningOrdersEmptyProps) {
  return (
    <AssignmentListEmpty
      testIdPrefix="conditioning-orders"
      message={CONDITIONING_ORDERS_EMPTY_TEXTS[list]}
      firstPageHref={firstPageHref}
    />
  );
}
