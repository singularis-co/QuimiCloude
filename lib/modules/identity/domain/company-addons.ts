import type { PermissionCode } from './permissions';

export const ADDONS = ['dashboard', 'proveedores', 'lectura_pdf', 'importacion_excel', 'integraciones', 'agente_ia_whatsapp'] as const;
export type Addon = (typeof ADDONS)[number];

export const ADDON_PERMISSIONS: Readonly<Record<Addon, readonly PermissionCode[]>> = {
  dashboard: ['dashboard.consultar'],
  proveedores: ['proveedores.consultar', 'proveedores.modificar'],
  lectura_pdf: ['documentos.consultar', 'documentos.modificar'],
  importacion_excel: [],
  integraciones: ['integraciones.modificar', 'whatsapp.enviar', 'whatsapp.consultar'],
  agente_ia_whatsapp: ['agente_ia.consultar', 'agente_ia.modificar'],
};

export const ADDON_REQUIRES: Readonly<Record<Addon, readonly Addon[]>> = {
  dashboard: [],
  proveedores: [],
  importacion_excel: [],
  integraciones: [],
  lectura_pdf: ['integraciones'],
  agente_ia_whatsapp: ['integraciones'],
};

// Escrito uno a uno, no derivado: un permiso nuevo tiene que clasificarse a mano.
export const CORE_PERMISSIONS: readonly PermissionCode[] = [
  'inventario.consultar',
  'inventario.modificar',
  'recetas.consultar',
  'recetas.modificar',
  'unidades.consultar',
  'unidades.modificar',
  'pedidos.consultar',
  'pedidos.modificar',
  'usuarios.consultar',
  'usuarios.modificar',
  'asignaciones.consultar',
  'asignaciones.modificar',
  'asignaciones.ejecutar',
  'terminados.consultar',
  'clientes.consultar',
  'clientes.modificar',
  'empaque.modificar',
  'empresas.consultar',
  'empresas.modificar',
  'acondicionamiento.modificar',
  'entregas.modificar',
  'entregas.anular',
  'planes.consultar',
  'planes.modificar',
];

export function isAddon(value: string): value is Addon {
  return (ADDONS as readonly string[]).includes(value);
}

/**
 * Interruptores guardados -> añadidos activos, en el orden de ADDONS. Claves desconocidas o
 * repetidas se ignoran; un añadido cuya dependencia no está prendida no es activo.
 */
export function effectiveAddons(stored: readonly string[]): readonly Addon[] {
  const on = new Set(stored.filter(isAddon));
  return ADDONS.filter((addon) => on.has(addon) && ADDON_REQUIRES[addon].every((dep) => on.has(dep)));
}

/** Permisos del rol menos los de cada añadido no activo. Nunca añade nada. */
export function effectivePermissions(
  rolePermissions: readonly string[],
  active: readonly Addon[],
): readonly string[] {
  const off = new Set<string>(
    ADDONS.filter((addon) => !active.includes(addon)).flatMap((addon) => ADDON_PERMISSIONS[addon]),
  );
  return rolePermissions.filter((permission) => !off.has(permission));
}

/** `addons` es opcional: un portador sin ellos no tiene ningún añadido. */
export type AddonBearer = { readonly addons?: readonly string[] };

export function hasAddon(bearer: AddonBearer | null | undefined, addon: Addon): boolean {
  return Boolean(bearer) && Array.isArray(bearer!.addons) && bearer!.addons.includes(addon);
}

export function assertAddon(
  bearer: AddonBearer | null | undefined,
  addon: Addon,
  onDenied: () => Error,
): void {
  if (!hasAddon(bearer, addon)) {
    throw onDenied();
  }
}
