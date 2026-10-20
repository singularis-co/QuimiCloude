// El destino abstracto del aviso pasa a ruta en el borde, con las constantes de rutas de la app.
import { describe, expect, it } from 'vitest';

import { notificationHref } from '@/lib/modules/notificaciones/adapters/driving/notification-links';
import { FORMULAS_ROUTE, SUPPLIERS_ROUTE } from '@/lib/shared/routes';

describe('enlace de un aviso', () => {
  it('R49: el destino de fórmulas lleva a la lista de fórmulas', () => {
    expect(notificationHref({ kind: 'formulas' })).toBe(FORMULAS_ROUTE);
  });

  it('R49: el destino de proveedores lleva a la lista de proveedores, sin proveedor concreto', () => {
    expect(notificationHref({ kind: 'suppliers' })).toBe(SUPPLIERS_ROUTE);
  });

  it('R49: un destino desconocido, o ninguno, da un aviso sin enlace', () => {
    expect(notificationHref({ kind: 'proveedor_detalle' })).toBeNull();
    expect(notificationHref({ kind: 'toString' })).toBeNull();
    expect(notificationHref(null)).toBeNull();
  });
});
