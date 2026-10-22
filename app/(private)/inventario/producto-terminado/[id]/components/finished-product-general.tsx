import { EntityImage } from '@/components/shared/entity-image';
import type { FinishedProductDetail } from '@/lib/modules/inventario';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import { quantityText, unitLabelOf } from './finished-product-stock';

function presentationText(presentation: FinishedProductDetail['presentation']): string {
  if (presentation === null) return EMPTY_MARK;
  if (presentation.content === null) return presentation.name;
  return `${presentation.name} · ${quantityText(presentation.content, unitLabelOf(presentation.unit))}`;
}

export type FinishedProductGeneralProps = {
  readonly product: FinishedProductDetail;
};

export function FinishedProductGeneral({ product }: FinishedProductGeneralProps) {
  const unitLabel = unitLabelOf(product.unit);

  return (
    <section
      aria-labelledby="finished-product-general-heading"
      className="flex flex-col gap-4 sm:flex-row sm:items-start"
      data-testid="finished-product-general"
    >
      <div className="w-full max-w-48 shrink-0">
        <EntityImage
          path={product.imagePath}
          name={product.name}
          size="fill"
          testId="finished-product-general-image"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <h2 id="finished-product-general-heading" className="text-lg font-semibold">
          Datos generales
        </h2>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-muted-foreground">Nombre</dt>
          <dd className="break-words" data-testid="finished-product-general-name">
            {product.name}
          </dd>
          <dt className="text-muted-foreground">Presentación</dt>
          <dd data-testid="finished-product-general-presentation">
            {presentationText(product.presentation)}
          </dd>
          <dt className="text-muted-foreground">Unidad base</dt>
          <dd data-testid="finished-product-general-unit">{unitLabel ?? EMPTY_MARK}</dd>
          <dt className="text-muted-foreground">Alerta de cantidad</dt>
          <dd className="tabular-nums" data-testid="finished-product-general-alert">
            {product.qtyAlert === null ? EMPTY_MARK : quantityText(product.qtyAlert, unitLabel)}
          </dd>
        </dl>
      </div>
    </section>
  );
}
