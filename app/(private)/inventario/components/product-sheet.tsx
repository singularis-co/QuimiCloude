'use client';

import { PencilIcon, PlusIcon } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { useEntitySheet } from '@/hooks/use-entity-sheet';
import type { ProductFormUnits, ProductView, SupplyConversion } from '@/lib/modules/inventario';
import type { UnitRef } from '@/lib/modules/unidades';

import { ProductForm, type ProductSaved } from './product-form';
import { displayDecimal, unitDisplayLabel } from './supply-conversion-notice';

const CREATE_SUCCESS = 'Producto creado.';
const UPDATE_SUCCESS = 'Producto actualizado.';

/**
 * Texto neutro a proposito: dice «Lote X», nunca «se asigno el lote X», porque el lote puede venir
 * tecleado a mano.
 */
function createSuccessMessage(lot: string): string {
  return `${CREATE_SUCCESS} Lote ${lot}.`;
}

/** `null` si la unidad del destino no esta entre las del formulario: queda el aviso de siempre. */
function conversionSuccessMessage(
  conversion: SupplyConversion,
  formUnits: ProductFormUnits | undefined,
): string | null {
  const unit = formUnits?.find((candidate) => candidate.id === conversion.unitId);
  if (unit === undefined) return null;
  const label = unitDisplayLabel(unit);
  return `Se agregó un lote de ${displayDecimal(conversion.stock)} ${label} a ${conversion.productName} · ${label}.`;
}

/**
 * Panel lateral de alta y edicion de producto. Sin `open` trae su propio disparador y su propio
 * estado; con `open` lo abre quien lo monta (el menu de la fila) y no pinta disparador.
 *
 * El formulario solo se monta con el panel abierto: `productType`, `template` y el estado de
 * `useActionState` viven en `ProductForm`, y si se quedara montado conservaria el ultimo tipo
 * elegido entre aperturas mientras `SharedSelect`, dentro del portal, volveria al tipo por defecto.
 */
export function ProductSheet({
  product,
  units,
  formUnits,
  open,
  onOpenChange,
}: {
  readonly product?: ProductView;
  /**
   * Catalogo de unidades: en el alta, para el alta rapida de presentacion del selector; en la
   * edicion, para nombrar la unidad de la alerta de cantidad.
   */
  readonly units?: readonly UnitRef[];
  /** Unidades del selector «Unidad» del alta de insumo. La edicion no las usa. */
  readonly formUnits?: ProductFormUnits;
  /** Apertura controlada desde fuera. Ausente = el panel trae su propio disparador. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = product !== undefined;
  const { isOpen, isControlled, changeOpen, handleSaved } = useEntitySheet({
    open,
    onOpenChange,
    successMessage: isEdit ? UPDATE_SUCCESS : CREATE_SUCCESS,
  });

  const handleProductSaved = useCallback(
    (saved?: ProductSaved) => {
      if (isEdit || saved === undefined) {
        handleSaved();
        return;
      }
      const converted =
        saved.conversion === undefined ? null : conversionSuccessMessage(saved.conversion, formUnits);
      handleSaved(converted ?? (saved.lot === undefined ? undefined : createSuccessMessage(saved.lot)));
    },
    [isEdit, handleSaved, formUnits],
  );

  return (
    <Sheet open={isOpen} onOpenChange={changeOpen}>
      {isControlled ? null : (
        <SheetTrigger
          render={
            <Button
              variant={isEdit ? 'ghost' : 'default'}
              touch
              aria-label={isEdit ? `Editar ${product.name}` : undefined}
              data-testid={isEdit ? 'product-edit-open' : 'product-create-open'}
            />
          }
        >
          {isEdit ? <PencilIcon /> : <PlusIcon />}
          {isEdit ? null : 'Nuevo producto'}
        </SheetTrigger>
      )}
      {isOpen ? (
        <ProductForm
          product={product}
          units={units}
          formUnits={formUnits}
          onSaved={handleProductSaved}
        />
      ) : null}
    </Sheet>
  );
}
