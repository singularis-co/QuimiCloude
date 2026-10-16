import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CONDITIONING_TEAM_LIST_GROUP_COUNT_TESTID,
  CONDITIONING_TEAM_LIST_GROUP_NAME_TESTID,
  CONDITIONING_TEAM_LIST_GROUP_TESTID,
  CONDITIONING_TEAM_LIST_ME_TESTID,
  CONDITIONING_TEAM_LIST_MEMBER_TESTID,
  CONDITIONING_TEAM_LIST_ROW_TESTID,
  CONDITIONING_TEAM_LIST_TESTID,
  CONDITIONING_TEAM_LIST_TEXTS,
  ConditioningTeamList,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components';
import type { ConditioningTeamMemberView } from '@/lib/modules/asignaciones';
import { avatarTone } from '@/lib/shared/ui/avatar-tone';

afterEach(() => {
  cleanup();
});

const CALIDAD = { kind: 'workGroup', workGroupId: 'wg-1', workGroupName: 'Calidad' } as const;
const DIRECTO = { kind: 'direct' } as const;

const EQUIPO: readonly ConditioningTeamMemberView[] = [
  { userId: 'user-maria', displayName: 'María Díaz', origin: CALIDAD },
  { userId: 'user-luis', displayName: 'Luis Ortega', origin: DIRECTO },
  { userId: 'user-carlos', displayName: 'Carlos Pérez', origin: CALIDAD },
];

function grupos(): HTMLElement[] {
  return within(screen.getByTestId(CONDITIONING_TEAM_LIST_TESTID)).getAllByTestId(
    CONDITIONING_TEAM_LIST_GROUP_TESTID,
  );
}

function filaDe(nombre: string): HTMLElement {
  const fila = screen
    .getAllByTestId(CONDITIONING_TEAM_LIST_ROW_TESTID)
    .find((row) => within(row).queryByText(nombre) !== null);
  if (fila === undefined) throw new Error(`no hay fila de ${nombre}`);
  return fila;
}

describe('ConditioningTeamList — grupos, avatares y sin rol', () => {
  it('R23: agrupa a las sueltas bajo «Personas» y a cada grupo con su nombre, cada uno con su número', () => {
    render(<ConditioningTeamList team={EQUIPO} />);

    const [sueltas, calidad, ...resto] = grupos();
    if (sueltas === undefined || calidad === undefined) throw new Error('faltan grupos');
    expect(resto).toHaveLength(0);

    expect(CONDITIONING_TEAM_LIST_TEXTS.directLabel).toBe('Personas');
    expect(sueltas).toHaveAttribute('data-kind', 'direct');
    expect(within(sueltas).getByTestId(CONDITIONING_TEAM_LIST_GROUP_NAME_TESTID)).toHaveTextContent(/^Personas$/);
    expect(within(sueltas).getByTestId(CONDITIONING_TEAM_LIST_GROUP_COUNT_TESTID)).toHaveTextContent(/^1$/);

    expect(calidad).toHaveAttribute('data-kind', 'workGroup');
    expect(within(calidad).getByTestId(CONDITIONING_TEAM_LIST_GROUP_NAME_TESTID)).toHaveTextContent(/^Calidad$/);
    expect(within(calidad).getByTestId(CONDITIONING_TEAM_LIST_GROUP_COUNT_TESTID)).toHaveTextContent(/^2$/);
    expect(
      within(calidad)
        .getAllByTestId(CONDITIONING_TEAM_LIST_MEMBER_TESTID)
        .map((miembro) => miembro.textContent),
    ).toEqual(['María Díaz', 'Carlos Pérez']);
  });

  it('R23: cada persona lleva un avatar oculto a lectores con sus iniciales y su tono, y la fila mide al menos 44 px', () => {
    render(<ConditioningTeamList team={EQUIPO} />);

    const fila = filaDe('María Díaz');
    expect(fila).toHaveClass('min-h-11');
    const avatar = fila.querySelector('[data-slot="avatar"]');
    if (avatar === null) throw new Error('la fila no tiene avatar');
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
    expect(avatar).toHaveClass('size-9');
    expect(avatar).toHaveAttribute('data-tone', String(avatarTone('user-maria')));
    expect(avatar).toHaveTextContent(/^MD$/);
    expect(filaDe('Luis Ortega').querySelector('[data-slot="avatar"]')).toHaveTextContent(/^LO$/);
  });

  it('R23: la fila no muestra rol: solo avatar y nombre, y la lista no pinta título propio ni acciones', () => {
    render(<ConditioningTeamList team={EQUIPO} />);

    const fila = filaDe('Carlos Pérez');
    expect(fila.textContent).toBe('CPCarlos Pérez');
    const lista = screen.getByTestId(CONDITIONING_TEAM_LIST_TESTID);
    expect(within(lista).queryByRole('heading')).toBeNull();
    expect(within(lista).queryAllByRole('button')).toHaveLength(0);
  });
});

describe('ConditioningTeamList — la marca «Tú»', () => {
  it('R24: con el actor en el equipo, «Tú» va solo en su fila', () => {
    render(<ConditioningTeamList team={EQUIPO} actorId="user-carlos" />);

    const marcas = screen.getAllByTestId(CONDITIONING_TEAM_LIST_ME_TESTID);
    expect(marcas).toHaveLength(1);
    expect(marcas[0]).toHaveTextContent(/^Tú$/);
    expect(filaDe('Carlos Pérez')).toContainElement(marcas[0] ?? null);
    for (const otro of ['María Díaz', 'Luis Ortega']) {
      expect(within(filaDe(otro)).queryByTestId(CONDITIONING_TEAM_LIST_ME_TESTID)).toBeNull();
      expect(filaDe(otro)).not.toHaveTextContent('Tú');
    }
    // El nombre de miembro sigue siendo solo el nombre, sin la marca.
    expect(
      screen.getAllByTestId(CONDITIONING_TEAM_LIST_MEMBER_TESTID).map((miembro) => miembro.textContent),
    ).toEqual(['Luis Ortega', 'María Díaz', 'Carlos Pérez']);
  });

  it.each([
    ['sin actor', undefined],
    ['con actor nulo', null],
    ['con un actor que no está en el equipo', 'user-otro'],
  ] as const)('R24: %s no hay ninguna marca «Tú»', (_caso, actorId) => {
    render(<ConditioningTeamList team={EQUIPO} actorId={actorId} />);

    expect(screen.queryByTestId(CONDITIONING_TEAM_LIST_ME_TESTID)).toBeNull();
    expect(screen.getByTestId(CONDITIONING_TEAM_LIST_TESTID)).not.toHaveTextContent('Tú');
  });
});
