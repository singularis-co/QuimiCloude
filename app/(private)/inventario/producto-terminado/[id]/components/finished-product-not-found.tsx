import { ArrowLink } from '@/components/shared/arrow-link';
import { EmptyState } from '@/components/shared/empty-state';

export type FinishedProductNotFoundProps = {
  readonly backHref: string;
};

export function FinishedProductNotFound({ backHref }: FinishedProductNotFoundProps) {
  return (
    <EmptyState
      testId="finished-product-not-found"
      messageTestId="finished-product-not-found-message"
      heading={{ text: 'Producto no encontrado', level: 1 }}
      message="Este producto terminado no existe o fue dado de baja."
    >
      <ArrowLink href={backHref} direction="back" touch testId="finished-product-back">
        Volver a producto terminado
      </ArrowLink>
    </EmptyState>
  );
}
