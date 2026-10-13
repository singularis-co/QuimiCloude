// lib/modules/asignaciones/domain/responsible-eligibility.ts
/**
 * Quien puede ser responsable de un pedido: persona viva de la empresa del actor, con la cuenta
 * efectivamente activa y cuyo rol es Operador o Empacador.
 *
 * QC-274 (2026-10-13): por nombre de rol, Operador y Empacador; enmienda QC-145 R32/D13.
 *
 * La regla vive en `identity` (`order-responsible.ts`), duena del nombre del rol: este modulo no
 * lo lee (`guard-autorizacion-por-permiso`). Aqui solo se delega, igual que `requirePermission`
 * delega en `assertPermission`. El selector pasa `ORDER_RESPONSIBLE_FILTERS` al directorio y el
 * camino de escritura pregunta `canBeResponsible`: una sola definicion.
 */
import { isOrderResponsible, type PersonRef } from '@/lib/modules/identity';

export { ORDER_RESPONSIBLE_FILTERS } from '@/lib/modules/identity';

/** Nunca lanza: es una pregunta, no una autorizacion. */
export function canBeResponsible(person: PersonRef): boolean {
  return isOrderResponsible(person);
}
