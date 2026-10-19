// Las cuatro importaciones desde PDF exigen el añadido además de su permiso. Los puertos son
// dobles que fallan si se llaman: un rechazo que leyera algo antes se nota aquí.

import { describe, expect, it } from 'vitest';

import {
  CATALOG_IMPORT_PERMISSION,
  FORMULA_IMPORT_PERMISSION,
  type Actor,
} from '@/lib/modules/documentos/domain/actor';
import { createConfirmCatalogImport } from '@/lib/modules/documentos/domain/confirm-catalog-import';
import { createConfirmFormulaImport } from '@/lib/modules/documentos/domain/confirm-formula-import';
import { UnauthorizedError } from '@/lib/modules/documentos/domain/errors';
import { createPreviewCatalogImport } from '@/lib/modules/documentos/domain/preview-catalog-import';
import { createPreviewFormulaImport } from '@/lib/modules/documentos/domain/preview-formula-import';
import { ADDONS, type PermissionCode } from '@/lib/modules/identity';

const EMPRESA = '33333333-3333-4333-8333-333333333333';
const PERSONA = '11111111-1111-4111-8111-111111111111';
const PROVEEDOR = '22222222-2222-4222-8222-222222222222';
const ARCHIVO = '44444444-4444-4444-8444-444444444444';

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

type Caso = readonly [string, PermissionCode, (deps: never, actor: Actor) => Promise<unknown>];

const CASOS: readonly Caso[] = [
  [
    'la vista previa de fórmula',
    FORMULA_IMPORT_PERMISSION,
    (deps, actor) => createPreviewFormulaImport(deps)(actor, { documentFileId: ARCHIVO }),
  ],
  [
    'la confirmación de fórmula',
    FORMULA_IMPORT_PERMISSION,
    (deps, actor) =>
      createConfirmFormulaImport(deps)(actor, {
        documentFileId: ARCHIVO,
        name: 'Detergente X',
        description: null,
        lines: [{ kind: 'new', newProductName: 'Agua', percentage: '100.00' }],
        steps: [{ blocks: [{ kind: 'paragraph', spans: [{ text: 'Mezclar' }] }] }],
        replaceRecipeId: null,
      }),
  ],
  [
    'la vista previa de catálogo',
    CATALOG_IMPORT_PERMISSION,
    (deps, actor) => createPreviewCatalogImport(deps)(actor, { supplierId: PROVEEDOR, documentFileId: ARCHIVO }),
  ],
  [
    'la confirmación de catálogo',
    CATALOG_IMPORT_PERMISSION,
    (deps, actor) =>
      createConfirmCatalogImport(deps)(actor, { supplierId: PROVEEDOR, documentFileId: ARCHIVO, lines: [] }),
  ],
];

function actor(permission: PermissionCode, addons?: readonly string[]): Actor {
  return {
    id: PERSONA,
    companyId: EMPRESA,
    permissions: [permission, 'inventario.modificar'],
    ...(addons === undefined ? {} : { addons }),
  };
}

describe('importaciones desde PDF — añadido `lectura_pdf`', () => {
  for (const [punto, permiso, invocar] of CASOS) {
    const sinElAnadido: readonly (readonly [string, Actor])[] = [
      ['sin `addons`', actor(permiso)],
      ['con `addons` vacío', actor(permiso, [])],
      ['con todos los demás añadidos', actor(permiso, ADDONS.filter((addon) => addon !== 'lectura_pdf'))],
    ];

    for (const [nombre, sinAnadido] of sinElAnadido) {
      it(`R14, R15, R23: ${punto} con \`${permiso}\` y ${nombre} → unauthorized sin tocar puertos`, async () => {
        const llamadas: string[] = [];

        const error = await invocar(depsQueFallan(llamadas), sinAnadido).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(UnauthorizedError);
        expect((error as UnauthorizedError).code).toBe('unauthorized');
        expect(llamadas).toEqual([]);
      });
    }

    it(`R14: ${punto} con el permiso y el añadido pasa el corte`, async () => {
      const llamadas: string[] = [];

      const error = await invocar(depsQueFallan(llamadas), actor(permiso, ['lectura_pdf', 'integraciones'])).catch(
        (e: unknown) => e,
      );

      expect(error).not.toBeInstanceOf(UnauthorizedError);
    });
  }
});
