// Guardia: toda ruta de `app/api` corre sin sesión, así que el recorte por añadidos de la sesión no
// la alcanza. Cada una se clasifica aquí como núcleo o como de un añadido, y nombra la prueba que lo
// demuestra: la del núcleo, que no mira añadidos; la de un añadido, que comprueba su interruptor en
// la empresa del trabajo antes de actuar. Una ruta nueva sin clasificar pone esto en rojo.
//
// Mismo patrón que `guard-pantallas-de-anadido.test.ts`: barrido del árbol real, funciones puras y
// casos sintéticos que demuestran que la regla dispara.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ADDONS, type Addon } from '@/lib/modules/identity';

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    try {
      readFileSync(join(dir, 'package.json'));
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) throw new Error(`no se encontro package.json subiendo desde ${startDir}`);
      dir = parent;
    }
  }
}

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

export type Clasificacion =
  | { readonly nucleo: true; readonly prueba: string }
  | { readonly anadido: Addon; readonly prueba: string };

/** Ruta sin sesión → núcleo o añadido, con su prueba. Una ruta nueva de `app/api` entra aquí. */
export const RUTAS_FUERA_DE_SESION: Readonly<Record<string, Clasificacion>> = {
  'app/api/cron/caducar-pedidos/route.ts': {
    nucleo: true,
    prueba: 'tests/integration/identity/company-directory-addons.int.test.ts',
  },
  'app/api/documentos/trabajos/route.ts': {
    anadido: 'lectura_pdf',
    prueba: 'tests/unit/documentos/run-document-job-addon.test.ts',
  },
  'app/api/cron/purgar-notificaciones/route.ts': {
    nucleo: true,
    prueba: 'tests/unit/notificaciones/purge-route.test.ts',
  },
  'app/api/integraciones/whatsapp/webhook/[conexionId]/route.ts': {
    anadido: 'integraciones',
    prueba: 'tests/unit/integraciones/whatsapp/receive-whatsapp-webhook.test.ts',
  },
  'app/api/cron/sincronizar-plantillas-whatsapp/route.ts': {
    anadido: 'integraciones',
    prueba: 'tests/unit/integraciones/whatsapp/templates/sync-all-whatsapp-templates.test.ts',
  },
  'app/api/integraciones/whatsapp/media/[mensajeId]/route.ts': {
    anadido: 'integraciones',
    prueba: 'tests/unit/integraciones/whatsapp/conversations/whatsapp-media-route.test.ts',
  },
};

export function listApiRoutes(root: string): readonly string[] {
  function walk(dir: string, segments: readonly string[]): readonly string[] {
    let names: readonly string[] = [];
    try {
      names = readdirSync(dir);
    } catch {
      return [];
    }
    const propias = names.includes('route.ts') ? [['app', 'api', ...segments, 'route.ts'].join('/')] : [];
    const hijas = names
      .filter((name) => statSync(join(dir, name)).isDirectory())
      .flatMap((name) => walk(join(dir, name), [...segments, name]));
    return [...propias, ...hijas];
  }
  return walk(join(root, 'app', 'api'), []);
}

export type Infraccion =
  | { readonly clase: 'sin-clasificar'; readonly file: string }
  | { readonly clase: 'clasificada-sin-ruta'; readonly file: string }
  | { readonly clase: 'prueba-inexistente'; readonly file: string; readonly prueba: string }
  | { readonly clase: 'anadido-desconocido'; readonly file: string; readonly anadido: string };

export function findInfracciones(
  rutas: readonly string[],
  mapa: Readonly<Record<string, Clasificacion>>,
  existe: (archivo: string) => boolean,
): readonly Infraccion[] {
  const sinClasificar = rutas
    .filter((file) => !(file in mapa))
    .map((file): Infraccion => ({ clase: 'sin-clasificar', file }));
  const delMapa = Object.entries(mapa).flatMap(([file, clase]): readonly Infraccion[] => {
    const propias: Infraccion[] = [];
    if (!rutas.includes(file)) propias.push({ clase: 'clasificada-sin-ruta', file });
    if (!existe(clase.prueba)) propias.push({ clase: 'prueba-inexistente', file, prueba: clase.prueba });
    if ('anadido' in clase && !(ADDONS as readonly string[]).includes(clase.anadido)) {
      propias.push({ clase: 'anadido-desconocido', file, anadido: clase.anadido });
    }
    return propias;
  });
  return [...sinClasificar, ...delMapa];
}

function describir(infracciones: readonly Infraccion[]): string {
  return infracciones
    .map((i) => {
      switch (i.clase) {
        case 'sin-clasificar':
          return `${i.file}: ruta sin sesión sin entrada en RUTAS_FUERA_DE_SESION (núcleo o añadido, con su prueba)`;
        case 'clasificada-sin-ruta':
          return `${i.file}: está en RUTAS_FUERA_DE_SESION pero la ruta no existe`;
        case 'prueba-inexistente':
          return `${i.file}: su prueba ${i.prueba} no existe`;
        case 'anadido-desconocido':
          return `${i.file}: '${i.anadido}' no es un añadido del catálogo`;
      }
    })
    .join('; ');
}

const existeEnElRepo = (archivo: string): boolean => existsSync(join(repoRoot, ...archivo.split('/')));

describe('guardia: rutas que corren sin sesión', () => {
  const rutas = listApiRoutes(repoRoot);

  it('R26, QC-238 R31: ancla anti-vacuidad: el barrido encuentra el cron, el webhook de documentos y el de WhatsApp', () => {
    expect(rutas).toContain('app/api/cron/caducar-pedidos/route.ts');
    expect(rutas).toContain('app/api/documentos/trabajos/route.ts');
    expect(rutas).toContain('app/api/integraciones/whatsapp/webhook/[conexionId]/route.ts');
  });

  it('QC-238 R31: el webhook de WhatsApp es del añadido `integraciones`, con la prueba que comprueba el interruptor', () => {
    expect(RUTAS_FUERA_DE_SESION['app/api/integraciones/whatsapp/webhook/[conexionId]/route.ts']).toEqual({
      anadido: 'integraciones',
      prueba: 'tests/unit/integraciones/whatsapp/receive-whatsapp-webhook.test.ts',
    });
  });

  it('QC-242 R35: el cron de plantillas es del añadido `integraciones`, con la prueba de R32', () => {
    expect(rutas).toContain('app/api/cron/sincronizar-plantillas-whatsapp/route.ts');
    expect(RUTAS_FUERA_DE_SESION['app/api/cron/sincronizar-plantillas-whatsapp/route.ts']).toEqual({
      anadido: 'integraciones',
      prueba: 'tests/unit/integraciones/whatsapp/templates/sync-all-whatsapp-templates.test.ts',
    });
  });

  it('QC-245 R58: la ruta del archivo de un medio es del añadido `integraciones`, con la prueba de que sin el permiso responde 404', () => {
    expect(rutas).toContain('app/api/integraciones/whatsapp/media/[mensajeId]/route.ts');
    expect(RUTAS_FUERA_DE_SESION['app/api/integraciones/whatsapp/media/[mensajeId]/route.ts']).toEqual({
      anadido: 'integraciones',
      prueba: 'tests/unit/integraciones/whatsapp/conversations/whatsapp-media-route.test.ts',
    });
  });

  it('R26: toda ruta de app/api está clasificada, cada entrada tiene ruta y su prueba existe', () => {
    const infracciones = findInfracciones(rutas, RUTAS_FUERA_DE_SESION, existeEnElRepo);
    expect(infracciones, describir(infracciones)).toEqual([]);
  });

  describe('autocomprobación con rutas sintéticas', () => {
    const CRON = 'app/api/cron/caducar-pedidos/route.ts';
    const PRUEBA = 'tests/prueba.test.ts';
    const existeSoloLaPrueba = (archivo: string) => archivo === PRUEBA;

    it('R26: una ruta nueva sin clasificar es roja', () => {
      const nueva = 'app/api/whatsapp/webhook/route.ts';
      expect(
        findInfracciones([CRON, nueva], { [CRON]: { nucleo: true, prueba: PRUEBA } }, existeSoloLaPrueba),
      ).toEqual([{ clase: 'sin-clasificar', file: nueva }]);
    });

    it('R26: una entrada sin ruta es roja', () => {
      expect(findInfracciones([], { [CRON]: { nucleo: true, prueba: PRUEBA } }, existeSoloLaPrueba)).toEqual([
        { clase: 'clasificada-sin-ruta', file: CRON },
      ]);
    });

    it('R26: una entrada cuya prueba no existe es roja', () => {
      expect(
        findInfracciones([CRON], { [CRON]: { anadido: 'lectura_pdf', prueba: 'tests/no-existe.test.ts' } }, existeSoloLaPrueba),
      ).toEqual([{ clase: 'prueba-inexistente', file: CRON, prueba: 'tests/no-existe.test.ts' }]);
    });

    it('R26: una entrada con un añadido fuera del catálogo es roja', () => {
      const mapa = { [CRON]: { anadido: 'pedidos', prueba: PRUEBA } } as unknown as Record<string, Clasificacion>;
      expect(findInfracciones([CRON], mapa, existeSoloLaPrueba)).toEqual([
        { clase: 'anadido-desconocido', file: CRON, anadido: 'pedidos' },
      ]);
    });

    it('R26: clasificada, con ruta y con prueba, no hay infracción', () => {
      expect(findInfracciones([CRON], { [CRON]: { nucleo: true, prueba: PRUEBA } }, existeSoloLaPrueba)).toEqual([]);
    });
  });
});
