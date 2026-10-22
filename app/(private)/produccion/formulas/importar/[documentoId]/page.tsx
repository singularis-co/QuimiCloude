import type { Metadata } from 'next';
import { CircleAlertIcon } from 'lucide-react';

import { previewFormulaImportAction } from '@/lib/modules/documentos/adapters/driving/formula-import-actions';
import type { ErrorState } from '@/lib/modules/errores';
import { requirePageAddon } from '@/lib/modules/identity/adapters/driving/require-page-addon';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import { PRODUCT_TYPES } from '@/lib/modules/inventario';
import { listProductsAction } from '@/lib/modules/inventario/adapters/driving/product-actions';
import { listUnitsAction } from '@/lib/modules/unidades/adapters/driving/unit-actions';
import { BRAND_LABEL, RECIPES_LABEL } from '@/lib/shared/navigation/private-nav';
import { MAX_PAGE_SIZE } from '@/lib/shared/pagination';
import { FORMULAS_ROUTE } from '@/lib/shared/routes';

import { ArrowLink } from '@/components/shared/arrow-link';
import { ErrorAlert } from '@/components/shared/error-alert';
import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';

import { FormulaImportReview } from './components';

export const metadata: Metadata = {
  title: `Revisar fórmula · ${RECIPES_LABEL} · ${BRAND_LABEL}`,
};

const FIRST_PAGE = 1;
const BACK_LABEL = 'Volver al listado';

/**
 * Estado de error de esta pantalla: un rechazo de las unidades, de los productos o de la vista
 * previa, siempre SIN ningun dato del documento. El mensaje es SIEMPRE el mismo, cualquiera de
 * los motivos que agrupa `invalid_input`: no se distingue archivo inexistente, de otra empresa,
 * fuera de estado o de otra tanda.
 */
function ImportErrorNotice({ error }: { readonly error: ErrorState }) {
  return (
    <ErrorAlert
      error={error}
      className="flex flex-col items-center gap-2.5 rounded-xl border border-destructive-border bg-card px-5 py-8 text-center"
      testId="formula-import-error"
      before={
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-xl bg-destructive-subtle text-destructive-text"
        >
          <CircleAlertIcon className="size-5" />
        </span>
      }
      renderCatalogued={(catalogued) => (
        <>
          <p className="text-sm text-muted-foreground" data-testid="formula-import-error-message">
            No se pudo abrir esta revisión.
          </p>
          <p className="font-mono text-xs text-muted-foreground" data-testid="formula-import-error-code">
            {catalogued.code}
          </p>
        </>
      )}
      after={
        <ArrowLink direction="back" href={FORMULAS_ROUTE} touch testId="formula-import-error-back-link">
          {BACK_LABEL}
        </ArrowLink>
      }
    />
  );
}

function ImportPageHeading() {
  return (
    <div className="flex flex-col gap-3">
      <ArrowLink
        direction="back"
        href={FORMULAS_ROUTE}
        touch
        testId="formula-import-back-link"
        className="self-start"
      >
        {BACK_LABEL}
      </ArrowLink>
      <PageHeader title="Revisar fórmula" titleTestId="formula-import-title" />
    </div>
  );
}

/**
 * Pantalla de revision de una importacion de formula desde un PDF, para un archivo concreto.
 *
 * **El corte por permiso vive AQUI, y son DOS**: `recetas.consultar` y `recetas.modificar`,
 * mismo patron que `/configuracion/unidades` y la revision de catalogo. Se aparta a
 * proposito del criterio de `formulas/nueva` -que solo pide `consultar`-: esta pantalla no tiene
 * uso de solo lectura, muestra el contenido de un documento y su unica accion es escribir.
 *
 * **Las tres lecturas van en paralelo y una sola vez cada una**: el catalogo de unidades, la
 * primera pagina de productos de tipo `PRODUCT` -para `ProductPicker`, igual que pide
 * `formulas/nueva/page.tsx`- y la vista previa de la importacion. Un rechazo de cualquiera deja
 * la pantalla sin ninguna fila.
 */
export default async function FormulaImportPage({
  params,
}: {
  readonly params: Promise<{ documentoId: string }>;
}) {
  await requirePagePermission('recetas.consultar');
  await requirePagePermission('recetas.modificar');
  await requirePageAddon('lectura_pdf');

  const { documentoId } = await params;

  const [unitsResult, productsResult, previewResult] = await Promise.all([
    listUnitsAction(),
    listProductsAction({
      page: FIRST_PAGE,
      pageSize: MAX_PAGE_SIZE,
      filters: { type: { kind: 'select', values: [PRODUCT_TYPES.PRODUCT] } },
    }),
    previewFormulaImportAction({ documentFileId: documentoId }),
  ]);

  if (unitsResult.status === 'error') {
    return (
      <PageShell>
        <ImportPageHeading />
        <ImportErrorNotice error={unitsResult} />
      </PageShell>
    );
  }

  if (productsResult.status === 'error') {
    return (
      <PageShell>
        <ImportPageHeading />
        <ImportErrorNotice error={productsResult} />
      </PageShell>
    );
  }

  if (previewResult.status === 'error') {
    return (
      <PageShell>
        <ImportPageHeading />
        <ImportErrorNotice error={previewResult} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ImportPageHeading />
      <FormulaImportReview
        documentFileId={documentoId}
        units={unitsResult.data}
        initialProductPage={{
          items: productsResult.data.items.map((item) => ({
            id: item.id,
            name: item.name,
            unitId: item.unitId,
          })),
          totalPages: productsResult.data.totalPages,
        }}
        preview={previewResult.data}
      />
    </PageShell>
  );
}
