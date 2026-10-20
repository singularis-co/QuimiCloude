import { describe, expect, it } from 'vitest';

import {
  administratorIdSchema,
  createAdministratorSchema,
  updateAdministratorSchema,
} from '@/lib/modules/identity/domain/administrator-input';
import { ADMINISTRATOR_QUERYABLE } from '@/lib/modules/identity/domain/administrator-queryable';
import {
  USER_DOCUMENT_NUMBER_MAX_LENGTH,
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USER_PHONE_MAX_LENGTH,
  USER_USERNAME_MAX_LENGTH,
  createUserSchema,
} from '@/lib/modules/identity/domain/user-input';

const COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const ROLE_ID = '11111111-1111-4111-8111-111111111111';

const OCHO_DATOS = {
  firstNames: 'Ana Maria',
  lastNames: 'Restrepo Gomez',
  birthDate: '1990-04-17',
  email: 'ana.restrepo@quimicloude.test',
  phone: '3001112233',
  documentTypeCode: 'CC',
  documentNumber: '1020304050',
  username: 'arestrepo',
} as const;

const ALTA = { ...OCHO_DATOS, companyId: COMPANY_ID };
const EDICION = { ...OCHO_DATOS, id: ADMIN_ID };

const TOPES = [
  ['firstNames', USER_NAME_MAX_LENGTH],
  ['lastNames', USER_NAME_MAX_LENGTH],
  ['email', USER_EMAIL_MAX_LENGTH],
  ['phone', USER_PHONE_MAX_LENGTH],
  ['documentNumber', USER_DOCUMENT_NUMBER_MAX_LENGTH],
  ['username', USER_USERNAME_MAX_LENGTH],
] as const;

const ESQUEMAS = [
  ['alta', createAdministratorSchema, ALTA],
  ['edicion', updateAdministratorSchema, EDICION],
] as const;

describe('administrator-input — los ocho datos', () => {
  it('R12: el alta valida con la empresa y los ocho datos, recortados', () => {
    const parsed = createAdministratorSchema.parse({
      ...ALTA,
      firstNames: '  Ana Maria  ',
      username: ' arestrepo ',
    });

    expect(parsed).toEqual(ALTA);
  });

  it('R12, R18: la edicion valida con el identificador y los ocho datos', () => {
    expect(updateAdministratorSchema.parse(EDICION)).toEqual(EDICION);
  });

  it.each(ESQUEMAS)('R12: %s aplica las mismas reglas que el alta de usuarios en cada dato', (_n, schema, base) => {
    const casos: ReadonlyArray<Record<string, unknown>> = [
      { firstNames: '   ' },
      { lastNames: '' },
      { birthDate: '1990-02-30' },
      { birthDate: '17/04/1990' },
      { documentTypeCode: 'XX' },
      { email: '' },
    ];
    for (const cambio of casos) {
      const usuario = createUserSchema.safeParse({ ...OCHO_DATOS, roleId: ROLE_ID, ...cambio });
      const admin = schema.safeParse({ ...base, ...cambio });
      expect(admin.success).toBe(false);
      expect(admin.success).toBe(usuario.success);
    }
  });

  it.each(ESQUEMAS)('R12: %s respeta los topes de cada texto de usuarios', (_n, schema, base) => {
    for (const [campo, tope] of TOPES) {
      expect(schema.safeParse({ ...base, [campo]: 'a'.repeat(tope) }).success).toBe(true);
      expect(schema.safeParse({ ...base, [campo]: 'a'.repeat(tope + 1) }).success).toBe(false);
    }
  });
});

describe('administrator-input — alta', () => {
  it.each([
    ['roleId', { roleId: ROLE_ID }],
    ['credential', { credential: 'Secreta-123!' }],
    ['accountStatus', { accountStatus: 'active' }],
    ['mustChangeCredential', { mustChangeCredential: false }],
  ])('R13: rechaza la clave no prevista %s', (_n, extra) => {
    expect(createAdministratorSchema.safeParse({ ...ALTA, ...extra }).success).toBe(false);
  });

  it('R13: rechaza cuando falta cualquiera de los nueve campos', () => {
    for (const campo of Object.keys(ALTA)) {
      const entrada: Record<string, unknown> = { ...ALTA };
      delete entrada[campo];
      expect(createAdministratorSchema.safeParse(entrada).success, campo).toBe(false);
    }
  });

  it.each([['no-es-uuid'], [''], [null], [42]])('R13: rechaza una empresa que no es un uuid: %s', (companyId) => {
    expect(createAdministratorSchema.safeParse({ ...ALTA, companyId }).success).toBe(false);
  });
});

describe('administrator-input — edicion', () => {
  it.each([
    ['companyId', { companyId: COMPANY_ID }],
    ['roleId', { roleId: ROLE_ID }],
    ['credential', { credential: 'Secreta-123!' }],
    ['accountStatus', { accountStatus: 'active' }],
  ])('R19: rechaza la clave %s', (_n, extra) => {
    expect(updateAdministratorSchema.safeParse({ ...EDICION, ...extra }).success).toBe(false);
  });

  it('R19: rechaza cuando falta cualquiera de los nueve campos o el id no es uuid', () => {
    for (const campo of Object.keys(EDICION)) {
      const entrada: Record<string, unknown> = { ...EDICION };
      delete entrada[campo];
      expect(updateAdministratorSchema.safeParse(entrada).success, campo).toBe(false);
    }
    expect(updateAdministratorSchema.safeParse({ ...EDICION, id: 'x' }).success).toBe(false);
  });
});

describe('administrator-input — identificador', () => {
  it('R29: solo admite el identificador del Administrador', () => {
    expect(administratorIdSchema.parse({ id: ADMIN_ID })).toEqual({ id: ADMIN_ID });
    expect(administratorIdSchema.safeParse({ id: ADMIN_ID, email: 'otro@x.test' }).success).toBe(false);
    expect(administratorIdSchema.safeParse({ id: ADMIN_ID, companyId: COMPANY_ID }).success).toBe(false);
    expect(administratorIdSchema.safeParse({ id: 'no-es-uuid' }).success).toBe(false);
  });
});

describe('administrator-queryable', () => {
  it('R8: declara los siete ordenes, el filtro por empresa y la busqueda', () => {
    expect([...ADMINISTRATOR_QUERYABLE.sortable].sort()).toEqual(
      ['accountStatus', 'companyName', 'createdAt', 'email', 'firstNames', 'lastNames', 'username'].sort(),
    );
    expect(ADMINISTRATOR_QUERYABLE.filterable).toEqual({ companyId: 'select' });
    expect(ADMINISTRATOR_QUERYABLE.searchable).toBe(true);
    expect(ADMINISTRATOR_QUERYABLE.sortable).not.toContain('deletedAt');
  });
});
