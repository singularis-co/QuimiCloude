// tests/unit/asignaciones/responsible-eligibility.test.ts
//
// `canBeResponsible` y `ORDER_RESPONSIBLE_FILTERS`: quien puede ser responsable de un pedido.
// QC-274 (2026-10-13): por nombre de rol, Operador y Empacador; enmienda QC-145 R32/D13.

import { describe, expect, it } from 'vitest';

import {
  canBeResponsible,
  ORDER_RESPONSIBLE_FILTERS,
} from '@/lib/modules/asignaciones/domain/responsible-eligibility';
import {
  ROLE_ACONDICIONAMIENTO,
  ROLE_ADMINISTRADOR,
  ROLE_EMPACADOR,
  ROLE_MAESTRO,
  ROLE_OPERADOR,
  type PersonRef,
} from '@/lib/modules/identity';

function conRol(roleName: string): PersonRef {
  return { id: 'p', displayName: 'Persona', isActive: true, permissions: [], roleName };
}

describe('canBeResponsible (QC-274)', () => {
  it('Operador -> true', () => {
    expect(canBeResponsible(conRol(ROLE_OPERADOR))).toBe(true);
  });

  it('Empacador -> true', () => {
    expect(canBeResponsible(conRol(ROLE_EMPACADOR))).toBe(true);
  });

  it('Administrador de acondicionamiento -> false', () => {
    expect(canBeResponsible(conRol(ROLE_ACONDICIONAMIENTO))).toBe(false);
  });

  it('Administrador -> false', () => {
    expect(canBeResponsible(conRol(ROLE_ADMINISTRADOR))).toBe(false);
  });

  it('Maestro y un rol desconocido -> false', () => {
    expect(canBeResponsible(conRol(ROLE_MAESTRO))).toBe(false);
    expect(canBeResponsible(conRol('operador'))).toBe(false);
    expect(canBeResponsible(conRol(''))).toBe(false);
  });
});

describe('ORDER_RESPONSIBLE_FILTERS (QC-274)', () => {
  it('pide solo cuentas efectivamente activas y los roles Operador y Empacador', () => {
    expect(ORDER_RESPONSIBLE_FILTERS).toEqual({
      accountStatus: ['active'],
      roles: [ROLE_OPERADOR, ROLE_EMPACADOR],
    });
  });

  it('es la misma lista que decide `canBeResponsible`', () => {
    for (const role of ORDER_RESPONSIBLE_FILTERS.roles) expect(canBeResponsible(conRol(role))).toBe(true);
  });
});
