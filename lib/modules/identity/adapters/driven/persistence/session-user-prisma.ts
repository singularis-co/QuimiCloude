import { prisma } from '@/lib/shared/db/prisma';

import type { UserAccountStatus } from '../../../domain/account-status';
import type { SessionUserRecord } from '../../../ports/session-user-reader';

/** Fila cruda que devuelve Postgres: nombres de columna, no de modelo. */
type FilaSesion = {
  id: string;
  username: string;
  first_names: string;
  last_names: string;
  role_name: string;
  company_id: string | null;
  company_deleted_at: Date | null;
  permissions: string[];
  account_status: string;
  locked_until: Date | null;
  sessions_valid_from: Date;
  session_revoked_at: Date | null;
};

/**
 * Implementa `SessionUserReader.findActiveById` (`design.md > 4.2`). Es la lectura de la ruta mas
 * caliente de la aplicacion: corre en cada peticion autenticada.
 *
 * **UNA SOLA SENTENCIA SQL por llamada.** Hasta aqui era un `prisma.user.findFirst` con
 * relaciones anidadas (`role.permissions`, `company`, `revokedSessions`): UNA llamada a Prisma,
 * pero medido con el log de consultas de Prisma eran **cinco sentencias en serie** (`users`,
 * `roles`, `role_permissions`, `companies`, `revoked_sessions`), porque sin `relationJoins` el
 * motor resuelve cada relacion con su propio `SELECT`. Los comentarios de QC-48, QC-74 y QC-23
 * que decian «ni una consulta adicional» contaban llamadas a Prisma, no idas a la base.
 *
 * Ahora es un `$queryRaw` parametrizado (template tag, jamas `$queryRawUnsafe` ni interpolacion
 * de cadenas) con `JOIN`s y subselects, que Postgres resuelve en una sola ida. NO se activa
 * `previewFeatures = ["relationJoins"]`: cambiaria la carga de TODAS las consultas del repo, y
 * medido empeora inventario y recetas. Solo esta funcion cambia de mecanismo.
 *
 * Contrato identico al de antes, campo a campo:
 * - `JOIN roles`: `users.role_id` es NOT NULL con FK `onDelete: Restrict`; todo usuario vivo
 *   tiene rol (R12: el rol es siempre el ACTUAL, leido en cada peticion).
 * - `LEFT JOIN companies`: el Maestro no tiene empresa y se encuentra igual, con `company_id` y
 *   `company_deleted_at` en `null` (QC-161 R31). La fila SI sale con la empresa dada de baja: el
 *   corte de «empresa viva» es del dominio (`resolve-session.ts`, QC-48 R13), no del `WHERE`.
 * - Permisos (QC-74 R7, R11): `ARRAY(SELECT ...)` sobre `role_permissions` por su clave primaria
 *   compuesta `(role_id, permission_code)`. Un rol sin asignaciones da `{}`, o sea `[]`, sin
 *   `GROUP BY` ni `COALESCE`. Sin ordenar y sin deduplicar: la comparacion de `assertPermission`
 *   es por pertenencia exacta (R13) y la clave primaria ya impide repetidos.
 * - Revocacion (QC-23 R11, R14): subselect escalar acotado al `sid` de la sesion en curso, por
 *   `revoked_sessions_session_id_key`; 0 o 1 filas, `null` si no hay. Solo sale `revoked_at`: ni
 *   el `sid`, ni el `id` de la fila (decision cerrada 12).
 * - `u.deleted_at IS NULL` va en el `WHERE` (R11): un usuario dado de baja no sale de la base.
 *   Un id inexistente da cero filas, o sea `null`, sin excepcion.
 * - Sin filtro por `account_status`: el corte por estado es del dominio
 *   (`effectiveAccountStatus`, QC-78 R7, R20), igual que el de la empresa.
 *
 * El `SELECT` es explicito y minimo (R14 de QC-8): ni correo, ni telefono, ni documento, ni
 * `password_hash`, ni los contadores de bloqueo. Lo que sale ademas de la identidad
 * (`company_deleted_at`, `account_status`, `locked_until`, `sessions_valid_from`,
 * `session_revoked_at`) **no es PII** y no se registra en ningun log; coste aceptado por escrito
 * en QC-48, QC-78 y QC-23.
 *
 * `::uuid` en los dos parametros: Prisma los manda como texto. El esquema del dominio exige forma
 * de UUID y corta antes de llegar aqui (R6); un valor sin esa forma haria lanzar a Postgres, igual
 * que antes lanzaba Prisma. `account_status::text` porque por el raw el enum se lee como cadena y
 * asi el tipo de la columna no depende del deserializador.
 *
 * RLS: misma conexion y mismo cliente global que antes; las cinco tablas se leian ya con el y
 * `findActiveByUsername` (`user-credentials-prisma.ts`) lee `users`, `roles` y `companies` por
 * `$queryRaw` igual.
 *
 * **Cero escrituras** (R40 de QC-23): aqui no se purga nada. La purga vive en las dos operaciones
 * de `session-revocation-prisma.ts`, nunca en el camino de lectura.
 */
export async function findActiveSessionUserById(
  id: string,
  sessionId: string,
): Promise<SessionUserRecord | null> {
  const filas = await prisma.$queryRaw<FilaSesion[]>`
    SELECT u.id, u.username, u.first_names, u.last_names,
           r.name AS role_name,
           u.company_id, c.deleted_at AS company_deleted_at,
           ARRAY(
             SELECT rp.permission_code FROM role_permissions rp WHERE rp.role_id = u.role_id
           ) AS permissions,
           u.account_status::text AS account_status, u.locked_until, u.sessions_valid_from,
           (
             SELECT rs.revoked_at FROM revoked_sessions rs
             WHERE rs.user_id = u.id AND rs.session_id = ${sessionId}::uuid
             LIMIT 1
           ) AS session_revoked_at
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN companies c ON c.id = u.company_id
    WHERE u.id = ${id}::uuid AND u.deleted_at IS NULL
    LIMIT 1
  `;

  const fila = filas[0];
  if (fila === undefined) return null;

  // El raw no pasa por el mapeo de Prisma: las conversiones son explicitas y no implicitas.
  return {
    id: fila.id,
    username: fila.username,
    firstNames: fila.first_names,
    lastNames: fila.last_names,
    roleName: fila.role_name,
    companyId: fila.company_id,
    // La marca cruda; sin empresa no hay marca. Quien decide si «esta viva» es el dominio.
    companyDeletedAt: fecha(fila.company_deleted_at),
    // QC-74 R7: los permisos salen de la ASIGNACION rol-permiso, nunca del nombre del rol.
    permissions: fila.permissions,
    // QC-78 R7, R20: los dos crudos. Quien traduce «lo que la columna dice» a «lo que significa
    // AHORA» es `effectiveAccountStatus`, no este adaptador. El texto se afirma contra la union
    // de literales del dominio, unica definicion del conjunto (QC-65 R3).
    accountStatus: fila.account_status as UserAccountStatus,
    lockedUntil: fecha(fila.locked_until),
    // QC-23 R8: el sello crudo. Quien compara `iat <= sello` es `isStampedOut`, no este
    // adaptador: esa desigualdad tiene UN solo cuerpo en el repositorio.
    sessionRevokedAt: fecha(fila.session_revoked_at),
    sessionsValidFrom: new Date(fila.sessions_valid_from),
  };
}

function fecha(valor: Date | null): Date | null {
  return valor === null ? null : new Date(valor);
}
