// Guardia: el catálogo de añadidos del código (`ADDONS`) es exactamente el que siembran las
// migraciones en la tabla `addons`. La FK `company_addon_overrides.addon_key -> addons.key` hace
// que una clave que el código conoce y la tabla no rompa en la base, en el despliegue, no en el
// gate; y el tipo `Addon` no ve el SQL.
//
// Lee las migraciones como texto, en orden de carpeta, y no toca la base. Mismo patrón que
// `guard-permisos-sembrados.test.ts`: funciones puras, el dato real importado del contrato del
// módulo (nunca una copia), casos sintéticos que demuestran que la regla dispara y anclas contra
// el verde por vacuidad.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ADDONS } from '@/lib/modules/identity';

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

export type Migracion = { readonly carpeta: string; readonly sql: string };

export type CatalogoLeido = {
  readonly claves: ReadonlySet<string>;
  readonly inserts: number;
  readonly hallazgos: readonly string[];
};

const TABLA = String.raw`(?:"?public"?\s*\.\s*)?(?:"addons"|addons\b)`;
const LITERAL = /^'([^']*)'$/;

/** Fuera comentarios `--` y `/* *\/`; las claves del catálogo no llevan esos caracteres. */
export function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, '');
}

function sentencias(sql: string): readonly string[] {
  return stripSqlComments(sql)
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function columnasDe(lista: string | undefined): readonly string[] | null {
  if (lista === undefined) return null;
  return lista
    .slice(1, -1)
    .split(',')
    .map((c) => c.trim().replace(/^"|"$/g, ''));
}

function literalesDe(texto: string): readonly string[] {
  return [...texto.matchAll(/'([^']*)'/g)].map((m) => m[1] as string);
}

/**
 * Recorre las migraciones en orden de carpeta: suma las claves de cada `INSERT INTO "addons"`,
 * resta las de cada `DELETE FROM "addons"`, vacía con `TRUNCATE` o `DROP TABLE`. Lo que no sabe
 * leer, o un `UPDATE` que cambia la clave, es un hallazgo: renombrar es borrar una y crear otra.
 */
export function leerCatalogo(migraciones: readonly Migracion[]): CatalogoLeido {
  const claves = new Set<string>();
  const hallazgos: string[] = [];
  let inserts = 0;
  const ordenadas = [...migraciones].sort((a, b) => a.carpeta.localeCompare(b.carpeta));

  for (const { carpeta, sql } of ordenadas) {
    for (const sentencia of sentencias(sql)) {
      const insert = new RegExp(String.raw`^INSERT\s+INTO\s+${TABLA}\s*(\([^)]*\))?\s*([\s\S]*)$`, 'i').exec(
        sentencia,
      );
      if (insert) {
        inserts += 1;
        const columnas = columnasDe(insert[1]);
        const indiceClave = columnas === null ? 0 : columnas.indexOf('key');
        const cuerpo = insert[2] ?? '';
        const valores = /^VALUES\s*([\s\S]*?)(?:\s+ON\s+CONFLICT[\s\S]*)?$/i.exec(cuerpo);
        if (indiceClave === -1 || !valores) {
          hallazgos.push(`${carpeta}: INSERT INTO "addons" que la guardia no sabe leer (solo VALUES con "key")`);
          continue;
        }
        for (const tupla of (valores[1] ?? '').matchAll(/\(([^()]*)\)/g)) {
          const campo = (tupla[1] ?? '').split(',')[indiceClave]?.trim() ?? '';
          const literal = LITERAL.exec(campo);
          if (!literal) {
            hallazgos.push(`${carpeta}: INSERT INTO "addons" con una clave que no es un literal: ${campo}`);
            continue;
          }
          const clave = literal[1] as string;
          if (claves.has(clave)) hallazgos.push(`${carpeta}: INSERT INTO "addons" repite la clave '${clave}'`);
          claves.add(clave);
        }
        continue;
      }

      const borrado = new RegExp(String.raw`^DELETE\s+FROM\s+${TABLA}([\s\S]*)$`, 'i').exec(sentencia);
      if (borrado) {
        const resto = borrado[1] ?? '';
        if (!/\bWHERE\b/i.test(resto)) claves.clear();
        else for (const clave of literalesDe(resto)) claves.delete(clave);
        continue;
      }

      if (new RegExp(String.raw`^(?:TRUNCATE(?:\s+TABLE)?|DROP\s+TABLE(?:\s+IF\s+EXISTS)?)\s+${TABLA}`, 'i').test(sentencia)) {
        claves.clear();
        continue;
      }

      const update = new RegExp(String.raw`^UPDATE\s+${TABLA}\s+SET\s+([\s\S]*)$`, 'i').exec(sentencia);
      if (update && /(?:^|[\s,])(?:"key"|key)\s*=/i.test(update[1] ?? '')) {
        hallazgos.push(
          `${carpeta}: UPDATE "addons" SET "key": renombrar un añadido es un DELETE de la clave vieja y un INSERT de la nueva`,
        );
      }
    }
  }
  return { claves, inserts, hallazgos };
}

/** Diferencias entre el catálogo del código y el que dejan las migraciones. */
export function hallazgosCatalogo(codigo: readonly string[], leido: CatalogoLeido): readonly string[] {
  const hallazgos = [...leido.hallazgos];
  const faltan = codigo.filter((clave) => !leido.claves.has(clave));
  if (faltan.length > 0) {
    hallazgos.push(
      `ADDONS declara ${faltan.join(', ')} y ninguna migración lo siembra: falta su INSERT INTO "addons"`,
    );
  }
  const sobran = [...leido.claves].filter((clave) => !codigo.includes(clave));
  if (sobran.length > 0) {
    hallazgos.push(`las migraciones siembran ${sobran.join(', ')} en "addons" y ADDONS no lo declara`);
  }
  return hallazgos;
}

function leerMigracionesReales(): readonly Migracion[] {
  const raiz = join(repoRoot, 'db', 'migrations');
  return readdirSync(raiz)
    .filter((carpeta) => statSync(join(raiz, carpeta)).isDirectory())
    .flatMap((carpeta) => {
      try {
        return [{ carpeta, sql: readFileSync(join(raiz, carpeta, 'migration.sql'), 'utf8') }];
      } catch {
        return [];
      }
    });
}

const migracionesReales = leerMigracionesReales();
const CARPETA_FUTURA = '99991231000000_sintetica';

describe('guardia — el catálogo de añadidos del código es el de la tabla addons', () => {
  it('R2: las migraciones reales siembran exactamente ADDONS', () => {
    const leido = leerCatalogo(migracionesReales);
    expect(hallazgosCatalogo(ADDONS, leido)).toEqual([]);
    expect(new Set(leido.claves)).toEqual(new Set(ADDONS));
  });

  it('R2: ancla, hay migraciones, al menos un INSERT INTO "addons" y ADDONS no está vacío', () => {
    expect(migracionesReales.length).toBeGreaterThan(0);
    expect(leerCatalogo(migracionesReales).inserts).toBeGreaterThan(0);
    expect(ADDONS.length).toBeGreaterThan(0);
  });

  it('R2: rojo con un añadido nuevo en el código sin su INSERT', () => {
    const codigo = [...ADDONS, 'sintetico'];
    expect(hallazgosCatalogo(codigo, leerCatalogo(migracionesReales))).toEqual([
      'ADDONS declara sintetico y ninguna migración lo siembra: falta su INSERT INTO "addons"',
    ]);
  });

  it('R2: rojo con una migración que siembra una clave que el código no conoce', () => {
    const migraciones = [
      ...migracionesReales,
      { carpeta: CARPETA_FUTURA, sql: `INSERT INTO "addons" ("key") VALUES ('futuro');` },
    ];
    expect(hallazgosCatalogo(ADDONS, leerCatalogo(migraciones))).toEqual([
      'las migraciones siembran futuro en "addons" y ADDONS no lo declara',
    ]);
  });

  it('R2: rojo con un UPDATE "addons" SET "key"', () => {
    const migraciones = [
      ...migracionesReales,
      { carpeta: CARPETA_FUTURA, sql: `UPDATE "addons" SET "key" = 'tablero' WHERE "key" = 'dashboard';` },
    ];
    expect(hallazgosCatalogo(ADDONS, leerCatalogo(migraciones))).toEqual([
      `${CARPETA_FUTURA}: UPDATE "addons" SET "key": renombrar un añadido es un DELETE de la clave vieja y un INSERT de la nueva`,
    ]);
  });

  it('R2: rojo con un INSERT que no sabe leer', () => {
    const migraciones = [
      ...migracionesReales,
      { carpeta: CARPETA_FUTURA, sql: `INSERT INTO "addons" ("key") SELECT 'x';` },
    ];
    expect(hallazgosCatalogo(ADDONS, leerCatalogo(migraciones))).toEqual([
      `${CARPETA_FUTURA}: INSERT INTO "addons" que la guardia no sabe leer (solo VALUES con "key")`,
    ]);
  });

  it('R2: verde con el caso simétrico, añadido nuevo con su INSERT y renombre como DELETE + INSERT', () => {
    const migraciones = [
      ...migracionesReales,
      {
        carpeta: CARPETA_FUTURA,
        sql: [
          '-- INSERT INTO "addons" ("key") VALUES (\'comentado\');',
          `INSERT INTO addons ("key") VALUES ('nuevo') ON CONFLICT DO NOTHING;`,
          `DELETE FROM "addons" WHERE "key" IN ('dashboard');`,
          `INSERT INTO "addons" ("key") VALUES ('tablero');`,
        ].join('\n'),
      },
    ];
    const codigo = [...ADDONS.filter((clave) => clave !== 'dashboard'), 'nuevo', 'tablero'];
    expect(hallazgosCatalogo(codigo, leerCatalogo(migraciones))).toEqual([]);
  });

  it('R2: el orden es el de las carpetas y no toca company_addon_overrides', () => {
    const leido = leerCatalogo([
      { carpeta: '2', sql: `DELETE FROM "addons" WHERE "key" = 'a';` },
      { carpeta: '1', sql: `INSERT INTO "addons" ("key") VALUES ('a'), ('b');` },
      { carpeta: '3', sql: `INSERT INTO "company_addon_overrides" ("company_id", "addon_key") VALUES ('c', 'z');` },
    ]);
    expect([...leido.claves]).toEqual(['b']);
    expect(leido.hallazgos).toEqual([]);
  });
});
