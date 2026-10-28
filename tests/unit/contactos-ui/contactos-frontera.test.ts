// QC-246 T17 — Frontera de la ruta `/clientes/contactos` (R48).
//
// R48: la pantalla lee y escribe solo por las Server Actions del contrato de QC-245 y por la URL de
// medio que llega en `attachment.mediaUrl`. Por FUENTE, eso es:
//   1. ningun archivo de la ruta importa `@/lib/composition` (ni una subruta suya);
//   2. un modulo se importa por su barrel (`@/lib/modules/<m>`) o por `adapters/driving/**`, nunca
//      por otra ruta profunda;
//   3. nadie construye la URL de un medio: ni el literal de la ruta de medios ni su constante.
//
// El detector es una funcion PURA sobre `{ ruta, fuente }[]`. Contra el arbol real tiene que dar
// cero; la sensibilidad se demuestra con fuentes FABRICADAS EN MEMORIA, sin escribir nada dentro de
// `app/`. La pagina ya tiene su caso propio en `tests/unit/clientes-ui/contactos-page.test.tsx`;
// este barre toda la carpeta, componentes incluidos.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CUSTOMER_CONTACTS_ROUTE, WHATSAPP_MEDIA_ROUTE_BASE } from '@/lib/shared/routes';

const RAIZ = join(__dirname, '..', '..', '..');

/** La carpeta de la ruta, DERIVADA de la constante: el route group no aporta segmento. */
const CARPETA = join(RAIZ, 'app', '(private)', ...CUSTOMER_CONTACTS_ROUTE.split('/').filter(Boolean));

const COMPOSICION = '@/lib/composition';
const PREFIJO_DE_MODULOS = '@/lib/modules/';
const CONSTANTE_DE_MEDIOS = 'WHATSAPP_MEDIA_ROUTE_BASE';

export interface FuenteDeLaRuta {
  readonly ruta: string;
  readonly fuente: string;
}

/** Fuente sin comentarios: la frontera mira codigo, no prosa (los JSDoc nombran rutas). */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** Los especificadores de `import ... from`, `export ... from`, `import '...'` e `import('...')`. */
function especificadores(fuente: string): readonly string[] {
  const patrones = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  return patrones.flatMap((patron) => [...fuente.matchAll(patron)].map((m) => m[1] as string));
}

/** `@/lib/modules/<m>` o `@/lib/modules/<m>/adapters/driving/**`: lo unico que R48 permite. */
function importDeModuloPermitido(especificador: string): boolean {
  const resto = especificador.slice(PREFIJO_DE_MODULOS.length).split('/');
  if (resto.length === 1) return true;
  return resto[1] === 'adapters' && resto[2] === 'driving' && resto.length > 3;
}

/** Descriptores legibles de cada violacion de R48, `[]` si la ruta cumple. */
export function findBoundaryViolations(fuentes: readonly FuenteDeLaRuta[]): readonly string[] {
  return fuentes.flatMap(({ ruta, fuente }) => {
    const codigo = sinComentarios(fuente);
    const violaciones: string[] = [];

    for (const especificador of especificadores(codigo)) {
      if (especificador === COMPOSICION || especificador.startsWith(`${COMPOSICION}/`)) {
        violaciones.push(`${ruta}: importa ${especificador}`);
      } else if (especificador.startsWith(PREFIJO_DE_MODULOS) && !importDeModuloPermitido(especificador)) {
        violaciones.push(`${ruta}: ruta profunda ${especificador}`);
      }
    }
    if (codigo.includes(WHATSAPP_MEDIA_ROUTE_BASE)) {
      violaciones.push(`${ruta}: construye la URL de un medio con el literal ${WHATSAPP_MEDIA_ROUTE_BASE}`);
    }
    if (new RegExp(`\\b${CONSTANTE_DE_MEDIOS}\\b`).test(codigo)) {
      violaciones.push(`${ruta}: construye la URL de un medio con ${CONSTANTE_DE_MEDIOS}`);
    }

    return violaciones;
  });
}

/** Todas las fuentes `.ts`/`.tsx` bajo la carpeta de la ruta, recursivo. */
function fuentesDeLaRuta(): readonly FuenteDeLaRuta[] {
  const encontradas: FuenteDeLaRuta[] = [];
  const recorrer = (directorio: string) => {
    for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
      const completa = join(directorio, entrada.name);
      if (entrada.isDirectory()) recorrer(completa);
      else if (/\.tsx?$/.test(entrada.name)) {
        encontradas.push({
          ruta: relative(RAIZ, completa).split('\\').join('/'),
          fuente: readFileSync(completa, 'utf8'),
        });
      }
    }
  };
  if (existsSync(CARPETA)) recorrer(CARPETA);
  return encontradas;
}

const FUENTES_REALES = fuentesDeLaRuta();

/** Un componente plausible de la ruta, limpio: la base de cada caso fabricado. */
const COMPONENTE_LIMPIO = `'use client';
import { sendWhatsappMessageAction } from '@/lib/modules/integraciones/adapters/driving/whatsapp-message-actions';
import { type WhatsappChatMessage } from '@/lib/modules/integraciones';
import { Button } from '@/components/ui/button';
export function Imagen({ message }: { message: WhatsappChatMessage }) {
  return <img src={message.attachment?.mediaUrl ?? ''} alt="" />;
}
`;

function fabricada(fuente: string): readonly FuenteDeLaRuta[] {
  return [{ ruta: 'app/(private)/clientes/contactos/components/fabricado.tsx', fuente }];
}

describe('R48: frontera de app/(private)/clientes/contactos/**', () => {
  it('ancla: el barrido encuentra la pagina y sus componentes', () => {
    const rutas = FUENTES_REALES.map((f) => f.ruta);
    expect(rutas).toContain('app/(private)/clientes/contactos/page.tsx');
    expect(rutas.filter((r) => r.includes('/components/')).length).toBeGreaterThan(10);
  });

  it('ancla: la ruta real SI usa acciones por adapters/driving y el mediaUrl del contrato', () => {
    // Si estos usos desaparecieran, el «pasa con el codigo real» de abajo no probaria nada.
    const todo = FUENTES_REALES.map((f) => f.fuente).join('\n');
    expect(todo).toContain(`${PREFIJO_DE_MODULOS}integraciones/adapters/driving/`);
    expect(todo).toContain('mediaUrl');
  });

  it('el codigo real no tiene ninguna violacion', () => {
    expect(findBoundaryViolations(FUENTES_REALES)).toEqual([]);
  });

  it('el componente limpio fabricado pasa', () => {
    expect(findBoundaryViolations(fabricada(COMPONENTE_LIMPIO))).toEqual([]);
  });

  it.each([
    ['import nombrado', `import { getContainer } from '${COMPOSICION}';`],
    ['subruta', `import { x } from '${COMPOSICION}/container';`],
    ['import dinamico', `const c = await import('${COMPOSICION}');`],
    ['reexportacion', `export { getContainer } from "${COMPOSICION}";`],
  ])('falla con un import simulado de @/lib/composition (%s)', (_caso, linea) => {
    const violaciones = findBoundaryViolations(fabricada(`${COMPONENTE_LIMPIO}\n${linea}\n`));
    expect(violaciones).toHaveLength(1);
    expect(violaciones[0]).toContain(COMPOSICION);
  });

  it.each([
    ['dominio', `import { x } from '${PREFIJO_DE_MODULOS}integraciones/domain/whatsapp-message';`],
    ['application', `import { x } from '${PREFIJO_DE_MODULOS}integraciones/application/use-cases';`],
    ['adapters/driven', `import { x } from '${PREFIJO_DE_MODULOS}integraciones/adapters/driven/graph-client';`],
    ['adapters sin driving', `import { x } from '${PREFIJO_DE_MODULOS}integraciones/adapters';`],
  ])('falla con una ruta profunda que no es adapters/driving (%s)', (_caso, linea) => {
    const violaciones = findBoundaryViolations(fabricada(`${COMPONENTE_LIMPIO}\n${linea}\n`));
    expect(violaciones).toHaveLength(1);
    expect(violaciones[0]).toContain('ruta profunda');
  });

  it.each([
    ['comillas simples', `const src = '${WHATSAPP_MEDIA_ROUTE_BASE}/' + id;`],
    ['plantilla', `const src = \`${WHATSAPP_MEDIA_ROUTE_BASE}/\${id}\`;`],
  ])('falla con el literal de la ruta de medios en la ruta (%s)', (_caso, linea) => {
    const violaciones = findBoundaryViolations(fabricada(`${COMPONENTE_LIMPIO}\n${linea}\n`));
    expect(violaciones).toHaveLength(1);
    expect(violaciones[0]).toContain(WHATSAPP_MEDIA_ROUTE_BASE);
  });

  it('falla si construye la URL con la constante de la ruta de medios', () => {
    const fuente = `import { ${CONSTANTE_DE_MEDIOS} } from '@/lib/shared/routes';\nconst src = ${CONSTANTE_DE_MEDIOS} + id;\n`;
    expect(findBoundaryViolations(fabricada(fuente)).length).toBeGreaterThan(0);
  });

  it('un comentario que nombra la composicion o la ruta de medios no es una violacion', () => {
    const fuente = `${COMPONENTE_LIMPIO}\n// no importar ${COMPOSICION}\n/* la URL ${WHATSAPP_MEDIA_ROUTE_BASE} llega hecha */\n`;
    expect(findBoundaryViolations(fabricada(fuente))).toEqual([]);
  });
});
