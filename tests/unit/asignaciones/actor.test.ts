// El predicado con el que la ficha decide si pinta la columna de fotos: mismo criterio que los
// casos de uso de lectura, leido sin lanzar y cerrado ante cualquier actor incompleto.
import { describe, expect, it } from 'vitest';

import { canConsultOrderEvidence, requirePermission, type Actor } from '@/lib/modules/asignaciones/domain/actor';
import { ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';

const PERMISO = 'pedidos.consultar';

function conPermisos(...permissions: readonly string[]): Actor {
  return { id: 'u-1', companyId: 'c-1', permissions };
}

const ACTORES_DENEGADOS: readonly (readonly [string, Actor | null | undefined])[] = [
  ['actor nulo', null],
  ['actor ausente', undefined],
  ['sin conjunto de permisos', { id: 'u-1', companyId: 'c-1' } as unknown as Actor],
  ['con el conjunto vacio', conPermisos()],
];

describe('canConsultOrderEvidence', () => {
  it('R4: verdadero con pedidos.consultar, solo o acompanado', () => {
    expect(canConsultOrderEvidence(conPermisos(PERMISO))).toBe(true);
    expect(canConsultOrderEvidence(conPermisos('inventario.consultar', PERMISO))).toBe(true);
  });

  it('R4: falso con inventario.consultar o dashboard.consultar sin pedidos.consultar', () => {
    expect(canConsultOrderEvidence(conPermisos('inventario.consultar'))).toBe(false);
    expect(canConsultOrderEvidence(conPermisos('inventario.consultar', 'dashboard.consultar'))).toBe(false);
    expect(canConsultOrderEvidence(conPermisos('pedidos.modificar'))).toBe(false);
  });

  it('R4: falla cerrado y no lanza ante actor nulo, ausente, sin conjunto o con el conjunto vacio', () => {
    for (const [nombre, actor] of ACTORES_DENEGADOS) {
      expect(() => canConsultOrderEvidence(actor), nombre).not.toThrow();
      expect(canConsultOrderEvidence(actor), nombre).toBe(false);
    }
  });

  it('R3: un Administrador sin pedidos.consultar en su conjunto da falso', () => {
    const permisos = [...SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]].filter((p) => p !== PERMISO);
    expect(canConsultOrderEvidence(conPermisos(...permisos))).toBe(false);
  });

  it('R4: responde lo mismo que `requirePermission(actor, pedidos.consultar)` sobre la matriz', () => {
    const casos: ReadonlyArray<Actor | null | undefined> = [
      ...ACTORES_DENEGADOS.map(([, actor]) => actor),
      conPermisos(PERMISO),
      conPermisos('inventario.consultar'),
      conPermisos('pedidos.consultarr'),
      conPermisos('pedidos.*'),
      conPermisos('inventario.consultar', PERMISO),
    ];
    for (const actor of casos) {
      let autorizado = true;
      try {
        requirePermission(actor, PERMISO);
      } catch {
        autorizado = false;
      }
      expect(canConsultOrderEvidence(actor), JSON.stringify(actor)).toBe(autorizado);
    }
  });

  it('R4: el modulo lo publica en su contrato', async () => {
    const contrato = await import('@/lib/modules/asignaciones');
    expect(contrato.canConsultOrderEvidence(conPermisos(PERMISO))).toBe(true);
    expect(contrato.canConsultOrderEvidence(conPermisos('inventario.consultar'))).toBe(false);
  });
});
