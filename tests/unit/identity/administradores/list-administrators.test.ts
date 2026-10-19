// Lista de Administradores con el puerto simulado: forma de la consulta, saneado contra la lista
// blanca y registro de lo omitido. El SQL real lo cubre la integracion.
import { describe, expect, it, vi } from 'vitest';

import { createListAdministrators, type AdministratorRow } from '@/lib/modules/identity';

import type { Page } from '@/lib/modules/identity/domain/page';
import type { AdministratorRepository } from '@/lib/modules/identity/ports/administrator-repository';
import type { ListQueryLog } from '@/lib/modules/identity/ports/list-query-log';

import { ADMIN_ID, COMPANY_ID, MAESTRO, OTRA_EMPRESA_ID, repositorio } from './administrator-doubles';

const PAGINA: Page<AdministratorRow> = {
  items: [
    {
      id: ADMIN_ID,
      firstNames: 'Ana',
      lastNames: 'Perez',
      username: 'ana.perez',
      email: 'ana@quimi.co',
      company: { id: COMPANY_ID, name: 'QuimiCloud' },
      accountStatus: 'pending',
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      isLastAdministrator: true,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
  totalPages: 1,
};

function setup() {
  const list = vi.fn<AdministratorRepository['list']>(async () => PAGINA);
  const ignoredFields = vi.fn<ListQueryLog['ignoredFields']>();
  const listAdministrators = createListAdministrators({
    administrators: repositorio({ list }),
    log: { ignoredFields },
  });
  return { listAdministrators, list, ignoredFields };
}

describe('listAdministrators', () => {
  it('R4: devuelve la pagina del puerto tal cual', async () => {
    const { listAdministrators } = setup();

    await expect(listAdministrators(MAESTRO, {})).resolves.toBe(PAGINA);
  });

  it('R4: una consulta vacia llega al puerto con los defectos, sin orden ni filtros', async () => {
    const { listAdministrators, list, ignoredFields } = setup();

    await listAdministrators(MAESTRO, {});

    expect(list).toHaveBeenCalledWith({ page: 1, sort: null, filters: {}, search: '' });
    expect(ignoredFields).toHaveBeenCalledWith('administrators', []);
  });

  it('R4: el tamano de pagina por encima del tope no se rechaza: llega al puerto, que lo acota', async () => {
    const { listAdministrators, list } = setup();

    await listAdministrators(MAESTRO, { pageSize: 25, page: 3 });

    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 3, pageSize: 25 }));
  });

  it('R4: el filtro por empresa, la busqueda y un orden declarado llegan saneados al puerto', async () => {
    const { listAdministrators, list, ignoredFields } = setup();

    await listAdministrators(MAESTRO, {
      sort: { columnId: 'companyName', direction: 'asc' },
      filters: { companyId: { kind: 'select', values: [COMPANY_ID, OTRA_EMPRESA_ID] } },
      search: '  ana ',
    });

    expect(list).toHaveBeenCalledWith({
      page: 1,
      sort: { columnId: 'companyName', direction: 'asc' },
      filters: { companyId: { kind: 'select', values: [COMPANY_ID, OTRA_EMPRESA_ID] } },
      search: 'ana',
    });
    expect(ignoredFields).toHaveBeenCalledWith('administrators', []);
  });

  for (const columnId of ['lastNames', 'firstNames', 'username', 'email', 'accountStatus', 'createdAt', 'companyName']) {
    for (const direction of ['asc', 'desc'] as const) {
      it(`R8: el orden por ${columnId} ${direction} llega al puerto`, async () => {
        const { listAdministrators, list } = setup();

        await listAdministrators(MAESTRO, { sort: { columnId, direction } });

        expect(list).toHaveBeenCalledWith(expect.objectContaining({ sort: { columnId, direction } }));
      });
    }
  }

  const FORMAS_INVALIDAS: ReadonlyArray<{ caso: string; entrada: unknown }> = [
    { caso: 'pagina 0', entrada: { page: 0 } },
    { caso: 'pagina no entera', entrada: { page: 1.5 } },
    { caso: 'orden sin direccion valida', entrada: { sort: { columnId: 'email', direction: 'arriba' } } },
    { caso: 'busqueda que no es texto', entrada: { search: 42 } },
    { caso: 'no es un objeto', entrada: 'lista' },
  ];

  for (const { caso, entrada } of FORMAS_INVALIDAS) {
    it(`R4: una consulta con forma invalida (${caso}) → invalid_input sin tocar el puerto ni el log`, async () => {
      const { listAdministrators, list, ignoredFields } = setup();

      await expect(listAdministrators(MAESTRO, entrada)).rejects.toMatchObject({ code: 'invalid_input' });
      expect(list).not.toHaveBeenCalled();
      expect(ignoredFields).not.toHaveBeenCalled();
    });
  }

  it('R8: un orden y un filtro no declarados se omiten sin romper la consulta y se registran por nombre', async () => {
    const { listAdministrators, list, ignoredFields } = setup();

    await listAdministrators(MAESTRO, {
      sort: { columnId: 'passwordHash', direction: 'asc' },
      filters: { roleId: { kind: 'select', values: ['valor-secreto'] } },
    });

    expect(list).toHaveBeenCalledWith({ page: 1, sort: null, filters: {}, search: '' });
    expect(ignoredFields).toHaveBeenCalledTimes(1);
    const [nombre, campos] = ignoredFields.mock.calls[0] as [string, readonly string[]];
    expect(nombre).toBe('administrators');
    expect([...campos].sort()).toEqual(['passwordHash', 'roleId']);
    expect(JSON.stringify(ignoredFields.mock.calls)).not.toContain('valor-secreto');
  });
});
