// La pestaña Historial del detalle de empresa. La sección es un Server Component asíncrono: se
// invoca y se pinta lo que devuelve. La acción del servidor está simulada.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CompanyHistoryPanel,
  CompanyHistorySkeleton,
  parseCompanyDetailParams,
} from '@/app/(private)/maestro/empresas/[id]/components';
import type { CompanyEventView, Page } from '@/lib/modules/identity';

import { setupUser } from '../../helpers/user-event';

const { routerMock, listCompanyEventsActionMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  listCompanyEventsActionMock: vi.fn<(input: unknown) => Promise<unknown>>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

vi.mock('@/lib/modules/identity/adapters/driving/company-actions', () => ({
  listCompanyEventsAction: listCompanyEventsActionMock,
  listCompaniesAction: vi.fn(),
  getCompanyAction: vi.fn(),
  getCompanyDeletionImpactAction: vi.fn(),
  createCompanyAction: vi.fn(),
  updateCompanyAction: vi.fn(),
  setCompanyCountryAction: vi.fn(),
  deleteCompanyAction: vi.fn(),
  reactivateCompanyAction: vi.fn(),
}));

const ID = '2d8e9f0a-3142-4c5d-8e6f-7a8b9c0d1e2f';
const HISTORIAL = `/maestro/empresas/${ID}?tab=historial`;
const MARTA = { id: 'u-maestro', firstNames: 'Marta Lucía', lastNames: 'Maestro Ríos' };

function ev(
  id: string,
  kind: string,
  occurredAt: string,
  extra: Partial<Pick<CompanyEventView, 'fields' | 'addon'>> = {},
): CompanyEventView {
  return {
    id,
    kind,
    occurredAt: new Date(occurredAt),
    actor: MARTA,
    fields: extra.fields ?? [],
    addon: extra.addon ?? null,
  };
}

const EVENTOS: readonly CompanyEventView[] = [
  ev('e5', 'addon.disabled', '2026-10-15T16:40:00.000Z', { addon: 'importacion_excel' }),
  ev('e4', 'addon.enabled', '2026-10-15T16:38:00.000Z', { addon: 'lectura_pdf' }),
  ev('e3', 'company.updated', '2026-10-02T09:12:00.000Z', { fields: ['country', 'contactPhone'] }),
  ev('e2', 'company.reactivated', '2026-09-20T10:00:00.000Z'),
  ev('e1', 'company.created', '2026-09-14T11:02:00.000Z'),
];

function pagina(
  items: readonly CompanyEventView[],
  extra: Partial<Page<CompanyEventView>> = {},
): Page<CompanyEventView> {
  return { items, total: items.length, page: 1, pageSize: 10, totalPages: 1, ...extra };
}

async function pintar(page = 1) {
  render(await CompanyHistoryPanel({ companyId: ID, page }));
}

beforeEach(() => {
  vi.clearAllMocks();
  listCompanyEventsActionMock.mockResolvedValue({ status: 'success', data: pagina(EVENTOS) });
});

afterEach(() => {
  cleanup();
});

describe('la pestaña Historial', () => {
  it('R31: pide los eventos de la empresa con la pagina de la direccion', async () => {
    await pintar(3);
    expect(listCompanyEventsActionMock).toHaveBeenCalledWith({ companyId: ID, page: 3 });
  });

  it('R31, R32: pinta los eventos en el orden del servidor, del mas reciente al mas antiguo, con su texto', async () => {
    await pintar();
    const lista = screen.getByRole('list', { name: 'Historial de la empresa' });
    const eventos = within(lista).getAllByRole('listitem');
    expect(eventos.map((evento) => evento.getAttribute('data-kind'))).toEqual(
      EVENTOS.map((evento) => evento.kind),
    );
    expect(eventos.map((evento) => evento.querySelector('span.font-medium')?.textContent)).toEqual([
      'Apagó Importación desde Excel',
      'Prendió Lectura de PDF con IA',
      'Editó País y Teléfono de contacto',
      'Reactivó la empresa',
      'Dio de alta la empresa',
    ]);
  });

  it('R31: cada evento lleva el nombre y apellidos de quien lo hizo y su instante dd/mm/aaaa HH:mm', async () => {
    await pintar();
    const primero = screen.getAllByTestId('company-history-event')[0]!;
    expect(primero).toHaveTextContent('Marta Lucía Maestro Ríos · 15/10/2026 16:40');
    expect(within(primero).getByText('15/10/2026 16:40').tagName).toBe('TIME');
    expect(within(primero).getByText('15/10/2026 16:40')).toHaveAttribute(
      'dateTime',
      '2026-10-15T16:40:00.000Z',
    );
  });

  it('R32: nombra los campos que cambiaron y ningun valor', async () => {
    await pintar();
    const historial = screen.getByTestId('company-history');
    expect(historial).toHaveTextContent('Editó País y Teléfono de contacto');
    for (const valor of ['Colombia', '+57', 'CO', '602 488 1200']) {
      expect(historial.textContent).not.toContain(valor);
    }
  });

  it('R33: un evento de tipo desconocido se pinta con el texto generico, sin fallar', async () => {
    listCompanyEventsActionMock.mockResolvedValue({
      status: 'success',
      data: pagina([ev('x1', 'billing.plan_changed', '2026-10-16T08:00:00.000Z'), ...EVENTOS]),
    });
    await pintar();
    const primero = screen.getAllByTestId('company-history-event')[0]!;
    expect(primero).toHaveTextContent('Registró un cambio');
    expect(primero).toHaveTextContent('Marta Lucía Maestro Ríos');
  });

  it('R31: pagina con «Página N de M · T en total» y enlaces a la anterior y la siguiente', async () => {
    listCompanyEventsActionMock.mockResolvedValue({
      status: 'success',
      data: pagina(EVENTOS, { page: 2, totalPages: 3, total: 27 }),
    });
    await pintar(2);
    const paginacion = screen.getByRole('navigation', { name: 'Páginas del historial' });
    expect(paginacion).toHaveTextContent('Página 2 de 3 · 27 en total');
    expect(within(paginacion).getByRole('link', { name: 'Página anterior' })).toHaveAttribute(
      'href',
      HISTORIAL,
    );
    expect(within(paginacion).getByRole('link', { name: 'Página siguiente' })).toHaveAttribute(
      'href',
      `${HISTORIAL}&page=3`,
    );
  });

  it('R31: en la primera y la ultima pagina el enlace que no lleva a ningun sitio queda deshabilitado', async () => {
    listCompanyEventsActionMock.mockResolvedValue({
      status: 'success',
      data: pagina(EVENTOS, { page: 1, totalPages: 2, total: 12 }),
    });
    await pintar(1);
    expect(screen.getByTestId('company-history-previous')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('company-history-previous')).not.toHaveAttribute('href');
    expect(screen.getByTestId('company-history-next')).toHaveAttribute('href', `${HISTORIAL}&page=2`);
    cleanup();

    listCompanyEventsActionMock.mockResolvedValue({
      status: 'success',
      data: pagina(EVENTOS, { page: 2, totalPages: 2, total: 12 }),
    });
    await pintar(2);
    expect(screen.getByTestId('company-history-next')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('company-history-previous')).toHaveAttribute('href', HISTORIAL);
  });

  it('R31: los enlaces de pagina tienen objetivo tactil de 44 px', async () => {
    await pintar();
    for (const testId of ['company-history-previous', 'company-history-next']) {
      expect(screen.getByTestId(testId).className).toMatch(/min-h-11/);
      expect(screen.getByTestId(testId).className).toMatch(/min-w-11/);
    }
  });

  it('R31: una pagina fuera de rango ofrece volver a la primera', async () => {
    listCompanyEventsActionMock.mockResolvedValue({
      status: 'success',
      data: pagina([], { page: 9, totalPages: 2, total: 12 }),
    });
    await pintar(9);
    expect(screen.getByTestId('company-history-empty')).toHaveTextContent('No hay eventos en esta página.');
    expect(screen.getByTestId('company-history-first-page')).toHaveAttribute('href', HISTORIAL);
  });

  it('R34: mientras carga muestra un esqueleto anunciado a lectores de pantalla', () => {
    render(<CompanyHistorySkeleton />);
    const esqueleto = screen.getByRole('status', { name: 'Cargando el historial…' });
    expect(esqueleto).toHaveAttribute('aria-busy', 'true');
  });

  it('R34: si la consulta falla muestra el recuadro de error con su referencia y «Reintentar»', async () => {
    listCompanyEventsActionMock.mockResolvedValue({
      status: 'error',
      code: 'unexpected',
      message: 'Ocurrio un error inesperado.',
      reference: 'req-historial-7',
    });
    await pintar();
    const error = screen.getByTestId('company-history-error');
    expect(error).toHaveTextContent('No se pudo cargar el historial.');
    expect(error).toHaveTextContent('req-historial-7');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    await setupUser().click(screen.getByTestId('company-history-retry'));
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });
});

describe('la pagina del historial en la direccion', () => {
  it('R31: con tab=historial lee page de la direccion', () => {
    expect(parseCompanyDetailParams({ tab: 'historial', page: '4' })).toEqual({
      tab: 'historial',
      historyPage: 4,
    });
  });

  it.each(['0', '-1', '1.5', '1e3', ' 2 ', 'dos'])(
    'R31: un page invalido («%s») vuelve a la primera',
    (page) => {
      expect(parseCompanyDetailParams({ tab: 'historial', page }).historyPage).toBe(1);
    },
  );

  it('R31: page solo cuenta con tab=historial', () => {
    expect(parseCompanyDetailParams({ tab: 'datos', page: '4' }).historyPage).toBe(1);
    expect(parseCompanyDetailParams({ page: '4' }).historyPage).toBe(1);
  });
});
