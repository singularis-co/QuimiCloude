import { PlusIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { AiProviderRequiredTooltip } from '@/components/shared/ai-provider-required-tooltip';
import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { identity } from '@/lib/composition';
import { canUploadDocuments } from '@/lib/modules/documentos';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import { getAiProviderReadinessAction } from '@/lib/modules/integraciones/adapters/driving/ai-provider-actions';
import { BRAND_LABEL, RECIPES_LABEL } from '@/lib/shared/navigation/private-nav';
import { NEW_RECIPE_ROUTE } from '@/lib/shared/routes';

import {
  FormulaBatchPanel,
  FormulaPdfUpload,
  parseRecipeListParams,
  RecipeListSection,
  RecipeTable,
} from './components';

export const metadata: Metadata = {
  title: `${RECIPES_LABEL} · ${BRAND_LABEL}`,
};

const NEW_RECIPE_LABEL = 'Nueva fórmula';

export default async function FormulasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission('recetas.consultar');

  const params = parseRecipeListParams(await searchParams);
  const canUpload = canUploadDocuments(await identity.getSessionUser());
  const [readiness, context] = canUpload
    ? await Promise.all([getAiProviderReadinessAction(), identity.getSessionContext()])
    : [null, null];
  const registryScope = context === null ? undefined : `${context.userId}:${context.companyId}`;

  return (
    <PageShell>
      <PageHeader
        title={RECIPES_LABEL}
        titleTestId="recipes-title"
        actions={
          <>
            {readiness === null ? null : readiness.configured ? (
              <FormulaPdfUpload registryScope={registryScope} />
            ) : (
              <AiProviderRequiredTooltip>
                <FormulaPdfUpload disabled registryScope={registryScope} />
              </AiProviderRequiredTooltip>
            )}
            {/* Un enlace y no `Button` con `render`: Base UI le pondría `role="button"` al `<a>`. */}
            <Link
              href={NEW_RECIPE_ROUTE}
              data-slot="button"
              data-testid="recipe-create-open"
              className={cn(buttonVariants({ variant: 'default', touch: true }))}
            >
              <PlusIcon aria-hidden="true" />
              {NEW_RECIPE_LABEL}
            </Link>
          </>
        }
      />
      {readiness === null || registryScope === undefined ? null : (
        <FormulaBatchPanel registryScope={registryScope} disabled={!readiness.configured} />
      )}
      {/* Sin `key`: remontar el límite en cada consulta borraría el foco del campo de búsqueda. */}
      <Suspense
        fallback={<RecipeTable status="loading" recipes={[]} params={params} totalPages={0} />}
      >
        <RecipeListSection params={params} />
      </Suspense>
    </PageShell>
  );
}
