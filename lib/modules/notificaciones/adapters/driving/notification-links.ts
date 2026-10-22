import { FORMULAS_ROUTE, SUPPLIERS_ROUTE } from '@/lib/shared/routes';

import type { NotificationTarget } from '@/lib/modules/notificaciones';

const HREF_BY_KIND: Readonly<Record<NotificationTarget['kind'], string>> = {
  formulas: FORMULAS_ROUTE,
  suppliers: SUPPLIERS_ROUTE,
};

/** Un `kind` que este código ya no conoce da un aviso sin enlace, que se sigue pudiendo marcar. */
export function notificationHref(target: { readonly kind: string } | null): string | null {
  if (target === null || !Object.hasOwn(HREF_BY_KIND, target.kind)) return null;
  return HREF_BY_KIND[target.kind as NotificationTarget['kind']];
}
