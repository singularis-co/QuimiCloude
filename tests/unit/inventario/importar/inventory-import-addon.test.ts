// Los cuatro puntos de la importación desde Excel exigen el añadido además del permiso. Los
// puertos son dobles que fallan si se llaman: un rechazo que leyera algo antes se nota aquí.

import { describe, expect, it } from 'vitest';

import { ADDONS } from '@/lib/modules/identity';
import type { Actor } from '@/lib/modules/inventario/domain/actor';
import { createConfirmInventoryImport } from '@/lib/modules/inventario/domain/confirm-inventory-import';
import { UnauthorizedError } from '@/lib/modules/inventario/domain/errors';
import {
  createGetInventoryImportTemplate,
  createGetInventoryImportValues,
} from '@/lib/modules/inventario/domain/get-inventory-import-template';
import { createPreviewInventoryImport } from '@/lib/modules/inventario/domain/preview-inventory-import';

const EMPRESA = '33333333-3333-4333-8333-333333333333';
const PERSONA = '11111111-1111-4111-8111-111111111111';

class PuertoTocado extends Error {}

/**
 * Dependencias en las que cualquier llamada, a cualquier profundidad, lanza y queda anotada.
 * Leer una propiedad no cuenta: algunas fábricas componen sus dependencias al construirse.
 */
function depsQueFallan(llamadas: string[]): never {
  const nodo = (ruta: string): unknown =>
    new Proxy(function () {}, {
      get: (_target, prop) => (prop === 'then' || typeof prop === 'symbol' ? undefined : nodo(`${ruta}.${prop}`)),
      apply: () => {
        llamadas.push(ruta);
        throw new PuertoTocado(ruta);
      },
    });
  return nodo('deps') as never;
}

const ENTRADA = { fileName: 'inventario.xlsx', bytes: new Uint8Array([1, 2, 3]) };

type Caso = readonly [string, (deps: never, actor: Actor) => Promise<unknown>];

const CASOS: readonly Caso[] = [
  ['la plantilla', (deps, actor) => createGetInventoryImportTemplate(deps)(actor)],
  ['los valores de la plantilla', (deps, actor) => createGetInventoryImportValues(deps)(actor)],
  ['la vista previa', (deps, actor) => createPreviewInventoryImport(deps)(ENTRADA as never, actor)],
  ['la confirmación', (deps, actor) => createConfirmInventoryImport(deps)(ENTRADA as never, actor)],
];

function actor(addons?: readonly string[]): Actor {
  return {
    id: PERSONA,
    companyId: EMPRESA,
    permissions: ['inventario.consultar', 'inventario.modificar'],
    ...(addons === undefined ? {} : { addons }),
  };
}

const SIN_EL_ANADIDO: readonly (readonly [string, Actor])[] = [
  ['sin `addons`', actor()],
  ['con `addons` vacío', actor([])],
  ['con todos los demás añadidos', actor(ADDONS.filter((addon) => addon !== 'importacion_excel'))],
];

describe('importación desde Excel — añadido `importacion_excel`', () => {
  for (const [punto, invocar] of CASOS) {
    for (const [nombre, sinAnadido] of SIN_EL_ANADIDO) {
      it(`R14, R16: ${punto} con \`inventario.modificar\` y ${nombre} → unauthorized sin tocar puertos`, async () => {
        const llamadas: string[] = [];

        const error = await invocar(depsQueFallan(llamadas), sinAnadido).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(UnauthorizedError);
        expect((error as UnauthorizedError).code).toBe('unauthorized');
        expect(llamadas).toEqual([]);
      });
    }

    it(`R14: ${punto} sin el permiso sigue rechazando igual aunque tenga el añadido`, async () => {
      const llamadas: string[] = [];
      const sinPermiso: Actor = { id: PERSONA, companyId: EMPRESA, permissions: ['inventario.consultar'], addons: ['importacion_excel'] };

      await expect(invocar(depsQueFallan(llamadas), sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
      expect(llamadas).toEqual([]);
    });

    it(`R16: ${punto} con el permiso y el añadido pasa el corte y sigue hacia sus puertos`, async () => {
      const llamadas: string[] = [];

      const error = await invocar(depsQueFallan(llamadas), actor(['importacion_excel'])).catch((e: unknown) => e);

      expect(error).not.toBeInstanceOf(UnauthorizedError);
      expect(error).toBeInstanceOf(PuertoTocado);
      expect(llamadas.length).toBeGreaterThan(0);
    });
  }
});
