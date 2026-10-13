import { describe, expect, expectTypeOf, it } from 'vitest';

import { groupResponsiblesByOrigin as barrelGroupResponsiblesByOrigin } from '@/app/(private)/pedidos/components';
import type { AssignmentOrigin, ConditioningTeamMemberView } from '@/lib/modules/asignaciones';
import {
  filterByDisplayName,
  groupResponsiblesByOrigin,
  type ResponsibleOrigin,
} from '@/lib/shared/ui/responsible-groups';

type Persona = { readonly id: string; readonly displayName: string; readonly origin: ResponsibleOrigin };

const directo = (id: string, displayName = id): Persona => ({
  id,
  displayName,
  origin: { kind: 'direct' },
});

const deGrupo = (id: string, workGroupId: string, workGroupName: string): Persona => ({
  id,
  displayName: id,
  origin: { kind: 'workGroup', workGroupId, workGroupName },
});

describe('groupResponsiblesByOrigin', () => {
  it('R8 — los grupos salen en el orden de su primera aparición y conservan el orden de sus personas', () => {
    const lista = [
      deGrupo('a', 'g2', 'Turno tarde'),
      deGrupo('b', 'g1', 'Turno mañana'),
      deGrupo('c', 'g2', 'Turno tarde'),
    ];

    expect(groupResponsiblesByOrigin(lista)).toEqual([
      { kind: 'workGroup', workGroupId: 'g2', workGroupName: 'Turno tarde', responsibles: [lista[0], lista[2]] },
      { kind: 'workGroup', workGroupId: 'g1', workGroupName: 'Turno mañana', responsibles: [lista[1]] },
    ]);
  });

  it('R8 — «directos» va primero aunque aparezca después de un grupo', () => {
    const lista = [deGrupo('a', 'g1', 'Turno mañana'), directo('b'), directo('c')];

    const grupos = groupResponsiblesByOrigin(lista);

    expect(grupos.map((grupo) => grupo.kind)).toEqual(['direct', 'workGroup']);
    expect(grupos[0]?.responsibles).toEqual([lista[1], lista[2]]);
  });

  it('R8 — sin directos no hay grupo «directos»; lista vacía, sin grupos', () => {
    const grupos = groupResponsiblesByOrigin([deGrupo('a', 'g1', 'Turno mañana')]);

    expect(grupos.some((grupo) => grupo.kind === 'direct')).toBe(false);
    expect(groupResponsiblesByOrigin([])).toEqual([]);
  });
});

describe('filterByDisplayName', () => {
  const lista = [directo('1', 'Ana López'), directo('2', 'Bruno Díaz'), directo('3', 'Ánxela Ruiz')];

  it('R10 — ignora mayúsculas y espacios de los extremos', () => {
    expect(filterByDisplayName(lista, '  LÓPEZ ')).toEqual([lista[0]]);
    expect(filterByDisplayName(lista, 'ánx')).toEqual([lista[2]]);
    expect(filterByDisplayName(lista, 'zz')).toEqual([]);
  });

  it('R10 — una búsqueda vacía o solo de espacios devuelve la lista entera', () => {
    expect(filterByDisplayName(lista, '')).toBe(lista);
    expect(filterByDisplayName(lista, '   ')).toBe(lista);
  });
});

describe('forma del origen', () => {
  it('R9 — ResponsibleOrigin, AssignmentOrigin y el origen del equipo son asignables en los dos sentidos', () => {
    type OrigenEquipo = ConditioningTeamMemberView['origin'];

    expectTypeOf<AssignmentOrigin>().toMatchTypeOf<ResponsibleOrigin>();
    expectTypeOf<ResponsibleOrigin>().toMatchTypeOf<AssignmentOrigin>();
    expectTypeOf<OrigenEquipo>().toMatchTypeOf<ResponsibleOrigin>();
    expectTypeOf<ResponsibleOrigin>().toMatchTypeOf<OrigenEquipo>();
    expectTypeOf<ResponsibleOrigin>().toEqualTypeOf<AssignmentOrigin>();
    expectTypeOf<ResponsibleOrigin>().toEqualTypeOf<OrigenEquipo>();
  });

  it('R9 — el barrel de /pedidos exporta la misma función compartida', () => {
    expect(barrelGroupResponsiblesByOrigin).toBe(groupResponsiblesByOrigin);
  });
});
