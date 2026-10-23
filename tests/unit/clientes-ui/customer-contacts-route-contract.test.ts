// Contrato de la ruta de contactos de clientes: se declara una vez, derivada de la de clientes,
// nadie la escribe como literal y el prefijo privado de clientes la cubre por segmentos.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { decideRouteAccess } from '@/lib/modules/identity';
import {
  CUSTOMER_CONTACTS_ROUTE,
  CUSTOMERS_ROUTE,
  DASHBOARD_ROUTE,
  LOGIN_ROUTE,
  PRIVATE_ROUTE_PREFIXES,
} from '@/lib/shared/routes';

const RAIZ = join(__dirname, '..', '..', '..');

const URL_ESPERADA = '/clientes/contactos';

const PAGE_PATH = join('app', '(private)', ...CUSTOMER_CONTACTS_ROUTE.split('/').filter(Boolean), 'page.tsx');

const ARCHIVO_DE_LA_CONSTANTE = join('lib', 'shared', 'routes.ts');

function fuenteSinComentarios(rutaRelativa: string): string {
  return readFileSync(join(RAIZ, rutaRelativa), 'utf8')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function existe(ruta: string): boolean {
  try {
    statSync(ruta);
    return true;
  } catch {
    return false;
  }
}

function fuentesDe(...directorios: readonly string[]): readonly string[] {
  const encontrados: string[] = [];

  const recorrer = (absoluto: string): void => {
    if (!existe(absoluto)) return;
    for (const entrada of readdirSync(absoluto)) {
      if (entrada === 'node_modules' || entrada === '.next') continue;
      const hijo = join(absoluto, entrada);
      if (statSync(hijo).isDirectory()) {
        recorrer(hijo);
      } else if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(entrada)) {
        encontrados.push(relative(RAIZ, hijo));
      }
    }
  };

  for (const directorio of directorios) recorrer(join(RAIZ, directorio));
  return encontrados;
}

const LITERAL_DE_LA_URL = new RegExp(`(['"\`])${URL_ESPERADA}\\1`);

describe('la ruta de contactos se declara una sola vez', () => {
  it('R10: la constante vale /clientes/contactos', () => {
    expect(CUSTOMER_CONTACTS_ROUTE).toBe(URL_ESPERADA);
  });

  it('R10: routes.ts la construye desde CUSTOMERS_ROUTE, sin escribir la URL entera', () => {
    const fuente = fuenteSinComentarios(ARCHIVO_DE_LA_CONSTANTE);

    expect(fuente).toMatch(
      /export const CUSTOMER_CONTACTS_ROUTE\s*=\s*`\$\{CUSTOMERS_ROUTE\}\/contactos`;/,
    );
    expect(LITERAL_DE_LA_URL.test(fuente)).toBe(false);
    expect(fuente.match(/export const CUSTOMER_CONTACTS_ROUTE\b/g)).toHaveLength(1);
  });

  it('R10: ningun archivo de lib/, app/ ni components/ lleva la URL entera entre comillas', () => {
    const infractores = fuentesDe('lib', 'app', 'components').filter((ruta) =>
      LITERAL_DE_LA_URL.test(fuenteSinComentarios(ruta)),
    );

    expect(infractores).toEqual([]);
  });

  it('R10: el barrido caza un literal en codigo e ignora uno en comentario', () => {
    const conLiteral = `const a = '${URL_ESPERADA}';`;
    const enComentario = `// '${URL_ESPERADA}'\nconst a = 1;`;

    expect(LITERAL_DE_LA_URL.test(conLiteral)).toBe(true);
    expect(LITERAL_DE_LA_URL.test(enComentario.replace(/\/\/.*$/gm, ''))).toBe(false);
  });

  it('R10: la page.tsx vive en la carpeta derivada de la constante', () => {
    expect(existe(join(RAIZ, PAGE_PATH))).toBe(true);
  });
});

describe('el prefijo privado de clientes la cubre', () => {
  it('R10: PRIVATE_ROUTE_PREFIXES no la contiene y CUSTOMERS_ROUTE sigue una sola vez', () => {
    const prefijos: readonly string[] = PRIVATE_ROUTE_PREFIXES;

    expect(prefijos).not.toContain(CUSTOMER_CONTACTS_ROUTE);
    expect(prefijos.filter((prefijo) => prefijo === CUSTOMERS_ROUTE)).toEqual([CUSTOMERS_ROUTE]);
  });

  it('R9: sin sesion, el borde redirige al login con los prefijos reales', () => {
    const decision = decideRouteAccess({
      pathname: CUSTOMER_CONTACTS_ROUTE,
      search: '',
      session: { kind: 'anonymous' },
      privatePrefixes: PRIVATE_ROUTE_PREFIXES,
      routes: { login: LOGIN_ROUTE, landing: DASHBOARD_ROUTE },
    });

    expect(decision.kind).toBe('redirect');
    if (decision.kind !== 'redirect') return;
    expect(decision.reason).toBe('unauthenticated');
    expect(new URL(decision.to, 'http://localhost').pathname).toBe(LOGIN_ROUTE);
  });
});
