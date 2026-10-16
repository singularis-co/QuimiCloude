// Actor de las operaciones de plataforma: no lleva empresa porque quien las hace (el Maestro) no
// pertenece a ninguna; la empresa sobre la que actua llega en la entrada. Las operaciones con
// ambito de empresa siguen usando `Actor`.
import type { PermissionCode } from './permissions';
import { UnauthorizedError } from './errors';
import { assertPermission } from './require-permission';

export type PlatformActor = { readonly id: string; readonly permissions: readonly string[] };

export function requirePlatformPermission(
  actor: PlatformActor | null | undefined,
  permission: PermissionCode,
): asserts actor is PlatformActor {
  assertPermission(actor, permission, () => new UnauthorizedError());
}
