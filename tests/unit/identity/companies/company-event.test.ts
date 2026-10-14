// Tipos del historial de empresas, la forma que vigila la base y los campos cambiados de una
// edicion. Tambien el resto del dominio puro de la lista y del alcance del seed.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  COMPANY_EVENT_KINDS,
  COMPANY_FIELDS,
  EVENT_KIND_FORMAT,
  changedCompanyFields,
} from '@/lib/modules/identity/domain/company-event';
import { COMPANY_QUERYABLE, COMPANY_STATUSES } from '@/lib/modules/identity/domain/company-queryable';
import { sanitizeListQuery, type ListQuery } from '@/lib/modules/identity/domain/list-query';
import { SEED_SCOPES } from '@/lib/modules/identity/domain/seed-scope';

const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');

function migracionDelHistorial(): string {
  const dirs = readdirSync(MIGRATIONS_DIR).filter((name) => /^\d{14}_companies_management$/.test(name));
  expect(dirs).toHaveLength(1);
  return readFileSync(join(MIGRATIONS_DIR, dirs[0] as string, 'migration.sql'), 'utf8');
}

function patronDelCheck(sql: string): string | null {
  const match = /"company_events_kind_format"\s+CHECK\s*\(\s*"kind"\s*~\s*'([^']*)'\s*\)/.exec(sql);
  return match?.[1] ?? null;
}

const ANTES = {
  name: 'QuimiCloud',
  taxId: '900',
  contactEmail: 'a@b.co',
  contactPhone: null,
  country: 'CO',
};

describe('company-event', () => {
  it('R34: los cuatro tipos de esta ficha cumplen la forma `<ambito>.<accion>`', () => {
    expect(COMPANY_EVENT_KINDS).toEqual([
      'company.created',
      'company.updated',
      'company.deleted',
      'company.reactivated',
    ]);
    for (const kind of COMPANY_EVENT_KINDS) expect(EVENT_KIND_FORMAT.test(kind), kind).toBe(true);
  });

  it('R39: la forma admite tipos nuevos y rechaza lo que no la tiene', () => {
    for (const kind of ['module.enabled', 'company_module.turned_off']) {
      expect(EVENT_KIND_FORMAT.test(kind), kind).toBe(true);
    }
    for (const kind of ['Bad Kind', 'company', 'Company.created', 'company.', 'a.b.c', '1x.y']) {
      expect(EVENT_KIND_FORMAT.test(kind), kind).toBe(false);
    }
  });

  it('R39, R43: el CHECK de la migracion es la misma expresion que EVENT_KIND_FORMAT', () => {
    expect(patronDelCheck(migracionDelHistorial())).toBe(EVENT_KIND_FORMAT.source);
  });

  it('R39, R43: el cruce detecta un CHECK que diverge', () => {
    const mutada = migracionDelHistorial().replace('[a-z][a-z_]*\\.', '[a-z]+\\.');
    expect(patronDelCheck(mutada)).not.toBeNull();
    expect(patronDelCheck(mutada)).not.toBe(EVENT_KIND_FORMAT.source);
  });

  it('R35: sin cambios → ninguna lista de campos', () => {
    expect(changedCompanyFields(ANTES, { ...ANTES })).toEqual([]);
  });

  it('R35: nombra los campos cambiados en el orden fijo, sin importar el de la entrada', () => {
    const despues = { contactPhone: '300', country: 'CO', taxId: '901', contactEmail: 'a@b.co', name: 'Otra' };
    expect(changedCompanyFields(ANTES, despues)).toEqual(['name', 'taxId', 'contactPhone']);
    expect(COMPANY_FIELDS).toEqual(['name', 'taxId', 'contactEmail', 'contactPhone', 'country']);
  });

  it('R35: null frente a texto cuenta como cambio en los dos sentidos', () => {
    expect(changedCompanyFields(ANTES, { ...ANTES, contactPhone: '300' })).toEqual(['contactPhone']);
    expect(changedCompanyFields(ANTES, { ...ANTES, taxId: null })).toEqual(['taxId']);
  });

  it('R35: la comparacion es exacta, una diferencia de mayusculas es un cambio', () => {
    expect(changedCompanyFields(ANTES, { ...ANTES, name: 'quimicloud' })).toEqual(['name']);
  });

  it('R36: el pais se compara como un campo mas', () => {
    expect(changedCompanyFields({ country: 'CO' }, { country: 'MX' })).toEqual(['country']);
    expect(changedCompanyFields({ country: 'CO' }, { country: 'CO' })).toEqual([]);
  });
});

describe('company-queryable', () => {
  function query(parcial: Partial<ListQuery>): ListQuery {
    return { page: 1, sort: null, filters: {}, search: '', ...parcial };
  }

  it('R30: el filtro de estado admite active y deleted', () => {
    expect(COMPANY_STATUSES).toEqual(['active', 'deleted']);
    const { query: saneada, ignored } = sanitizeListQuery(
      query({ filters: { status: { kind: 'select', values: ['deleted'] } } }),
      COMPANY_QUERYABLE,
    );
    expect(saneada.filters).toEqual({ status: { kind: 'select', values: ['deleted'] } });
    expect(ignored).toEqual([]);
  });

  it('R32: solo se ordena por nombre o fecha de alta; lo demas se ignora sin fallar', () => {
    for (const columnId of ['name', 'createdAt']) {
      const { query: saneada } = sanitizeListQuery(
        query({ sort: { columnId, direction: 'desc' } }),
        COMPANY_QUERYABLE,
      );
      expect(saneada.sort).toEqual({ columnId, direction: 'desc' });
    }
    const { query: saneada, ignored } = sanitizeListQuery(
      query({
        sort: { columnId: 'taxId', direction: 'asc' },
        filters: { country: { kind: 'select', values: ['CO'] }, deletedAt: { kind: 'text', value: 'x' } },
      }),
      COMPANY_QUERYABLE,
    );
    expect(saneada.sort).toBeNull();
    expect(saneada.filters).toEqual({});
    expect([...ignored].sort()).toEqual(['country', 'deletedAt', 'taxId']);
  });

  it('R31: la lista busca', () => {
    expect(COMPANY_QUERYABLE.searchable).toBe(true);
    expect(sanitizeListQuery(query({ search: 'quimi' }), COMPANY_QUERYABLE).query.search).toBe('quimi');
  });
});

describe('seed-scope', () => {
  it('R40, R41: dos alcances, el completo y el de solo plataforma', () => {
    expect(SEED_SCOPES).toEqual(['full', 'platform-only']);
  });
});
