import { describe, expect, it } from 'vitest';

import { nextUsernameCandidate, usernameFromNames } from '@/components/shared/username-from-names';
import { USER_USERNAME_MAX_LENGTH } from '@/lib/modules/identity';

describe('`usernameFromNames`: primer nombre entero mas iniciales', () => {
  it.each([
    ['José Carlos', 'Pérez Núñez', 'josecpn'],
    ['Ana', 'López', 'anal'],
    ['  María   Fernanda  ', 'Restrepo de la Hoz', 'mariafrdlh'],
    ['Peña', '', 'pena'],
    ["O'Neil 2", 'Ñandú', 'oneil2n'],
    ['', 'Pérez', ''],
    ['   ', 'Pérez', ''],
  ])('(%j, %j) -> %j', (nombres, apellidos, esperado) => {
    expect(usernameFromNames(nombres, apellidos)).toBe(esperado);
  });

  it('recorta al maximo del contrato', () => {
    const largo = 'a'.repeat(USER_USERNAME_MAX_LENGTH + 10);
    expect(usernameFromNames(largo, 'Perez')).toHaveLength(USER_USERNAME_MAX_LENGTH);
  });
});

describe('`nextUsernameCandidate`: el sufijo numerico final, mas uno', () => {
  it.each([
    ['josecpn', 'josecpn1'],
    ['josecpn1', 'josecpn2'],
    ['josecpn9', 'josecpn10'],
    ['josecpn99', 'josecpn100'],
    ['ana2lopez', 'ana2lopez1'],
    ['', '1'],
  ])('%j -> %j', (enviado, esperado) => {
    expect(nextUsernameCandidate(enviado)).toBe(esperado);
  });

  it('recorta la base para no pasar del maximo del contrato', () => {
    const lleno = 'a'.repeat(USER_USERNAME_MAX_LENGTH);
    expect(nextUsernameCandidate(lleno)).toBe(`${'a'.repeat(USER_USERNAME_MAX_LENGTH - 1)}1`);

    const conNueve = `${'a'.repeat(USER_USERNAME_MAX_LENGTH - 1)}9`;
    expect(nextUsernameCandidate(conNueve)).toBe(`${'a'.repeat(USER_USERNAME_MAX_LENGTH - 2)}10`);
  });
});
