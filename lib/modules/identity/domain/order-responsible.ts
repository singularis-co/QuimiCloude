// lib/modules/identity/domain/order-responsible.ts
/**
 * Quien puede ser responsable de un pedido, como filtro del directorio de personas.
 *
 * QC-274 (2026-10-13): por nombre de rol, Operador y Empacador; enmienda QC-145 R32/D13.
 *
 * Vive en `identity` porque el nombre del rol es suyo (`./roles`): los modulos de negocio no lo
 * leen (`guard-autorizacion-por-permiso`). `asignaciones` pasa `ORDER_RESPONSIBLE_FILTERS` a
 * `PeopleDirectory.listAliveInCompany` para el selector y pregunta `isOrderResponsible` al validar
 * la asignacion: la lista de roles se escribe UNA vez, aqui.
 */
import { ROLE_EMPACADOR, ROLE_OPERADOR } from './roles';

import type { PeopleRefFilters, PersonRef } from './people-directory';

export const ORDER_RESPONSIBLE_FILTERS = {
  accountStatus: ['active'],
  roles: [ROLE_OPERADOR, ROLE_EMPACADOR],
} as const satisfies PeopleRefFilters;

const RESPONSIBLE_ROLES: readonly string[] = ORDER_RESPONSIBLE_FILTERS.roles;

/**
 * Solo el ROL de `ORDER_RESPONSIBLE_FILTERS`. La cuenta activa la comprueba quien asigna, con su
 * propio error; la vida y la empresa, el directorio (la fila no vuelve). Nunca lanza.
 */
export function isOrderResponsible(person: Pick<PersonRef, 'roleName'>): boolean {
  return RESPONSIBLE_ROLES.includes(person.roleName);
}
