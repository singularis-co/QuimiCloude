import type { Metadata } from 'next';
import Link from 'next/link';

import { ArrowLink } from '@/components/shared/arrow-link';
import { ErrorState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import { errorMessage } from '@/lib/modules/errores';
import { PRODUCT_TYPES } from '@/lib/modules/inventario';
import { listProductsAction } from '@/lib/modules/inventario/adapters/driving/product-actions';
import { getRecipeAction } from '@/lib/modules/recetas/adapters/driving/recipe-actions';
import { listUnitsAction } from '@/lib/modules/unidades/adapters/driving/unit-actions';
import { BRAND_LABEL, RECIPES_LABEL } from '@/lib/shared/navigation/private-nav';
import { MAX_PAGE_SIZE } from '@/lib/shared/pagination';
import { FORMULAS_ROUTE, recipeEditRoute } from '@/lib/shared/routes';
import { touchTarget } from '@/lib/shared/ui/touch-target';

import { RecipeVersionForm } from '../../../components';

export const metadata: Metadata = {
  title: `Nueva versión · ${RECIPES_LABEL} · ${BRAND_LABEL}`,
};

const FIRST_PAGE = 1;
const BACK_LABEL = 'Volver a la fórmula';

// Los mismos testids que el error de la lista: los vigila el E2E de errores.
const LOAD_ERROR = {
  title: 'No se pudo cargar el catálogo.',
  testId: 'recipe-list-error',
  messageTestId: 'recipe-list-error-message',
  codeTestId: 'recipe-list-error-code',
  retry: { kind: 'refresh' },
  retryTestId: 'recipe-list-retry',
} as const;

export default async function NuevaVersionPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  // `consultar` y no `modificar`: el permiso de escritura lo exige el servicio al guardar.
  await requirePagePermission('recetas.consultar');

  const { id } = await params;

  const [recipeResult, unitsResult, productsResult, machinesResult] = await Promise.all([
    getRecipeAction(id),
    listUnitsAction(),
    listProductsAction({
      page: FIRST_PAGE,
      pageSize: MAX_PAGE_SIZE,
      filters: { type: { kind: 'select', values: [PRODUCT_TYPES.PRODUCT] } },
    }),
    listProductsAction({
      page: FIRST_PAGE,
      pageSize: MAX_PAGE_SIZE,
      filters: { type: { kind: 'select', values: [PRODUCT_TYPES.MACHINE] } },
    }),
  ]);

  let notFoundMessage: string | null = null;
  if (recipeResult.status === 'error' && recipeResult.code === 'recipe_not_found') {
    notFoundMessage = recipeResult.message;
  } else if (recipeResult.status === 'success' && recipeResult.data.original !== null) {
    // Una version no tiene versiones propias: para esta ruta no existe.
    notFoundMessage = errorMessage('recipe_not_found');
  }

  if (notFoundMessage !== null) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <div
          role="alert"
          data-testid="recipe-not-found"
          className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 p-4"
        >
          <p className="text-sm font-medium" data-testid="recipe-not-found-message">
            {notFoundMessage}
          </p>
          <Link
            href={FORMULAS_ROUTE}
            className={`${touchTarget} text-sm underline`}
            data-testid="recipe-not-found-link"
          >
            Volver a la lista
          </Link>
        </div>
      </div>
    );
  }

  if (recipeResult.status === 'error') {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <ErrorState error={recipeResult} {...LOAD_ERROR} />
      </div>
    );
  }

  if (unitsResult.status === 'error') {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <ErrorState error={unitsResult} {...LOAD_ERROR} />
      </div>
    );
  }

  if (productsResult.status === 'error') {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <ErrorState error={productsResult} {...LOAD_ERROR} />
      </div>
    );
  }

  if (machinesResult.status === 'error') {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <ErrorState error={machinesResult} {...LOAD_ERROR} />
      </div>
    );
  }

  const original = recipeResult.data;

  return (
    <PageShell>
      <div className="flex flex-col gap-3">
        <ArrowLink
          direction="back"
          href={recipeEditRoute(original.id)}
          touch
          testId="recipe-version-back-link"
          className="self-start"
        >
          {BACK_LABEL}
        </ArrowLink>
        <PageHeader
          title={<span className="break-words">Nueva versión de {original.name}</span>}
          titleTestId="recipe-version-page-title"
        />
      </div>
      <RecipeVersionForm
        mode="create"
        original={{
          id: original.id,
          name: original.name,
          lines: original.lines,
          tools: original.tools,
        }}
        units={unitsResult.data}
        initialProductPage={{
          items: productsResult.data.items.map((item) => ({
            id: item.id,
            name: item.name,
            unitId: item.unitId,
          })),
          totalPages: productsResult.data.totalPages,
        }}
        initialMachinePage={{
          items: machinesResult.data.items.map((item) => ({
            id: item.id,
            name: item.name,
            unitId: item.unitId,
          })),
          totalPages: machinesResult.data.totalPages,
        }}
      />
    </PageShell>
  );
}
