import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CUSTOMER_CONTACTS_EMPTY_MESSAGE,
  CUSTOMER_CONTACTS_EMPTY_TESTID,
  CUSTOMER_CONTACTS_TITLE_TESTID,
} from '@/app/(private)/clientes/contactos/components';
import CustomerContactsPage, { metadata } from '@/app/(private)/clientes/contactos/page';
import type { SessionUser } from '@/lib/modules/identity';
import { BRAND_LABEL, CUSTOMER_CONTACTS_LABEL } from '@/lib/shared/navigation/private-nav';
import { CUSTOMER_CONTACTS_ROUTE, LOGIN_ROUTE_SESSION_ENDED } from '@/lib/shared/routes';

const { getSessionUserMock, notFoundMock, redirectMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn<() => Promise<unknown>>(),
  notFoundMock: vi.fn<() => never>(),
  redirectMock: vi.fn<(ruta: string) => never>(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: notFoundMock,
  redirect: redirectMock,
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, endSession: vi.fn<() => Promise<void>>() },
  observabilidad: { readRequestIdHeader: vi.fn(async (): Promise<string | null> => null) },
}));

const RAIZ = join(__dirname, '..', '..', '..');

const PERMISO = 'clientes.consultar';

const IMPORTS_DE_LA_PAGINA = [
  'next',
  '@/components/shared/empty-state',
  '@/components/shared/page-header',
  '@/components/shared/page-shell',
  '@/lib/modules/identity/adapters/driving/require-page-permission',
  '@/lib/shared/navigation/private-nav',
  './components',
];

function fuenteDeLaPagina(): string {
  return readFileSync(
    join(RAIZ, 'app', '(private)', ...CUSTOMER_CONTACTS_ROUTE.split('/').filter(Boolean), 'page.tsx'),
    'utf8',
  );
}

function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
}

function sesionCon(permissions: readonly string[]): SessionUser {
  return {
    id: 'u-test-contactos',
    username: 'carla.duarte',
    displayName: 'Carla Duarte Salas',
    roleName: 'Administrador',
    permissions,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  notFoundMock.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  redirectMock.mockImplementation(() => {
    throw new Error('NEXT_REDIRECT');
  });
});

afterEach(() => {
  cleanup();
});

describe('la pagina de contactos', () => {
  it('R7: el texto del estado vacio es el acordado', () => {
    expect(CUSTOMER_CONTACTS_EMPTY_MESSAGE).toBe(
      'Aquí verás las conversaciones de WhatsApp con tus clientes.',
    );
  });

  it('R7, R11: con el permiso pinta un unico h1 con la etiqueta de Contactos y el estado vacio', async () => {
    getSessionUserMock.mockResolvedValue(sesionCon([PERMISO]));

    render(await CustomerContactsPage());

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toBe(screen.getByTestId(CUSTOMER_CONTACTS_TITLE_TESTID));
    expect(titulos[0]?.textContent).toBe(CUSTOMER_CONTACTS_LABEL);
    expect(screen.getByTestId(CUSTOMER_CONTACTS_EMPTY_TESTID).textContent).toBe(
      CUSTOMER_CONTACTS_EMPTY_MESSAGE,
    );
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('R7: no pinta enlace, boton, formulario ni campo', async () => {
    getSessionUserMock.mockResolvedValue(sesionCon([PERMISO]));

    const { container } = render(await CustomerContactsPage());

    expect(container.querySelectorAll('a, button, form, input, select, textarea')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('R7: no declara params ni searchParams, no tiene comentarios y solo importa sus piezas', () => {
    const original = fuenteDeLaPagina();
    const fuente = sinComentarios(original);
    const imports = [...fuente.matchAll(/^import\s[\s\S]*?\sfrom\s'([^']+)';/gm)].map(
      (coincidencia) => coincidencia[1],
    );

    expect(original).toBe(fuente);
    expect(fuente).not.toMatch(/\bparams\b/);
    expect(fuente).not.toMatch(/\bsearchParams\b/);
    expect(fuente).toMatch(/export default async function \w+\(\)/);
    expect(fuente).toMatch(/^import type \{ Metadata \} from 'next';/m);
    expect(imports).toEqual(IMPORTS_DE_LA_PAGINA);
  });

  it('R3: exige clientes.consultar una sola vez y como primera sentencia', () => {
    const fuente = sinComentarios(fuenteDeLaPagina());
    const cortes = [...fuente.matchAll(/requirePagePermission\(([^)]*)\)/g)].map(
      (coincidencia) => coincidencia[1],
    );
    const primeraSentencia = /export default async function \w+\(\)\s*\{\s*([^;]+);/.exec(
      fuente,
    )?.[1];

    expect(cortes).toEqual([`'${PERMISO}'`]);
    expect(primeraSentencia).toBe(`await requirePagePermission('${PERMISO}')`);
  });

  it('R8: con sesion sin el permiso responde notFound y no pinta nada', async () => {
    getSessionUserMock.mockResolvedValue(sesionCon(['inventario.consultar']));

    await expect(CustomerContactsPage()).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId(CUSTOMER_CONTACTS_TITLE_TESTID)).toBeNull();
    expect(screen.queryByTestId(CUSTOMER_CONTACTS_EMPTY_TESTID)).toBeNull();
  });

  it('R9: sin sesion redirige al login con la marca de sesion terminada', async () => {
    getSessionUserMock.mockResolvedValue(null);

    await expect(CustomerContactsPage()).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith(LOGIN_ROUTE_SESSION_ENDED);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('R11: la metadata sale de la etiqueta de Contactos y la marca', () => {
    expect(metadata.title).toBe(`${CUSTOMER_CONTACTS_LABEL} · ${BRAND_LABEL}`);
  });

  it('R11: la pagina y sus textos no escriben la etiqueta de Contactos como literal', () => {
    const carpeta = join(
      RAIZ,
      'app',
      '(private)',
      ...CUSTOMER_CONTACTS_ROUTE.split('/').filter(Boolean),
    );
    const fuentes = [
      fuenteDeLaPagina(),
      readFileSync(join(carpeta, 'components', 'index.ts'), 'utf8'),
      readFileSync(join(carpeta, 'components', 'contact-texts.ts'), 'utf8'),
    ];

    for (const fuente of fuentes) {
      expect(sinComentarios(fuente)).not.toContain(`'${CUSTOMER_CONTACTS_LABEL}'`);
    }
    expect(sinComentarios(fuenteDeLaPagina())).not.toContain(CUSTOMER_CONTACTS_LABEL);
  });
});
