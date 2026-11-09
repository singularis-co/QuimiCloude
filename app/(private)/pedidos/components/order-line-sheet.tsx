'use client';

import { ArrowLeftIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { PresentationUnitSelect } from '@/components/shared/presentation-unit-select';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { isStartedOrderStatus, orderLineInputSchema } from '@/lib/modules/pedidos';
import { getRecipeAction } from '@/lib/modules/recetas/adapters/driving/recipe-actions';
import type { RecipeQueryResult } from '@/lib/modules/recetas/adapters/driving/recipe-actions';
import type { RecipeLineView } from '@/lib/modules/recetas';
import type { MassVolumeBridge, UnitView } from '@/lib/modules/unidades';
import { touchTarget } from '@/lib/shared/ui/touch-target';

import { compatibleUnitIds } from './compatible-unit-ids';
import { OrderCostQuote } from './order-cost-quote';
import { OrderDistributionField } from './order-distribution-field';
import { OrderField } from './order-field';
import { ingredientNeedOf, OrderIngredientsTable } from './order-ingredients-table';
import { leftoverOf, OrderLeftoverDialog } from './order-leftover-dialog';
import { canRemove, isSameRecipe, type OrderLineDraft } from './order-line-draft';
import { OrderRecipeImage } from './order-recipe-image';
import { RecipePicker, type RecipePickerOption, type RecipePickerPage } from './recipe-picker';
import { RecipeVersionSelect } from './recipe-version-select';
import { useOrderCostQuote } from './use-order-cost-quote';
import {
  availabilityBlocksSave,
  distributionLinesValid,
  toDistributionLinesInput,
  useOrderDistributionAvailability,
  type OrderDistributionLine,
} from './use-order-distribution-availability';

export const ORDER_LINE_SHEET_TESTID = 'order-line-sheet';
export const ORDER_LINE_SHEET_TITLE_TESTID = 'order-line-sheet-title';
export const ORDER_LINE_SHEET_BACK_TESTID = 'order-line-sheet-back';
export const ORDER_LINE_SHEET_DISCARD_TESTID = 'order-line-sheet-discard';
export const ORDER_LINE_SHEET_APPLY_TESTID = 'order-line-sheet-apply';
export const ORDER_LINE_SHEET_REMOVE_TESTID = 'order-line-sheet-remove';

export type OrderLineSheetTexts = {
  readonly addTitle: string;
  readonly editTitle: string;
  readonly description: string;
  readonly back: string;
  readonly discard: string;
  readonly apply: string;
  readonly remove: string;
  readonly quantity: string;
  readonly salePrice: string;
  readonly duplicate: string;
  readonly leftoverMessage: (amount: string, unitLabel: string | null) => string;
  readonly leftoverConfirm: string;
  readonly fieldErrors: Readonly<Record<LineFieldName, string>>;
};

type LineFieldName =
  | 'recipeId'
  | 'recipeVersionId'
  | 'quantity'
  | 'unitId'
  | 'presentationLines'
  | 'salePrice';

export const ORDER_LINE_SHEET_TEXTS: OrderLineSheetTexts = {
  addTitle: 'Añadir receta',
  editTitle: 'Editar receta',
  description: 'Los cambios se guardan con «Guardar pedido».',
  back: 'Volver al pedido',
  discard: 'Descartar',
  apply: 'Aplicar',
  remove: 'Quitar receta',
  quantity: 'Cantidad',
  salePrice: 'Precio de venta (opcional)',
  duplicate: 'Esta receta, o una de sus versiones, ya está en el pedido.',
  leftoverMessage: (amount, unitLabel) =>
    `Queda sobrante: ${unitLabel === null ? amount : `${amount} ${unitLabel}`} sin envasar. ¿Aplicar la receta igualmente?`,
  leftoverConfirm: 'Aplicar con sobrante',
  fieldErrors: {
    recipeId: 'Elige una fórmula de la lista.',
    recipeVersionId: 'Elige una versión de la lista.',
    quantity: 'Ingresa un número mayor a 0.',
    unitId: 'Elige la unidad del pedido.',
    presentationLines:
      'Revisa el reparto: envases enteros mayores que cero, una línea por envase y por presentación.',
    salePrice: 'Ingresa un número mayor o igual a 0, con hasta 4 decimales.',
  },
};

const LINE_FIELDS: readonly LineFieldName[] = [
  'recipeId',
  'recipeVersionId',
  'quantity',
  'unitId',
  'presentationLines',
  'salePrice',
];

type FieldErrors = Partial<Record<LineFieldName, string>>;

export type OrderLineSheetProps = {
  readonly open: boolean;
  /** Con `false`, descarta lo escrito: «Volver al pedido» y «Descartar». */
  readonly onOpenChange: (open: boolean) => void;
  /** `null` = receta nueva. */
  readonly line: OrderLineDraft | null;
  /** Todas las recetas del borrador, para no repetir una. */
  readonly lines: readonly OrderLineDraft[];
  readonly recipes: RecipePickerPage;
  readonly units: readonly UnitView[];
  readonly bridge: MassVolumeBridge | null;
  readonly onApply: (line: OrderLineDraft) => void;
  readonly onRemove: (key: string) => void;
  readonly texts?: OrderLineSheetTexts;
};

/**
 * Sub-panel de una receta del pedido. No guarda nada: «Aplicar» devuelve la receta al borrador del
 * panel. Se monta de nuevo en cada apertura (`key` del anfitrión) para arrancar con la receta elegida.
 */
export function OrderLineSheet({ open, onOpenChange, ...props }: OrderLineSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <OrderLineEditor {...props} onDiscard={() => onOpenChange(false)} />
    </Sheet>
  );
}

type OrderLineEditorProps = Omit<OrderLineSheetProps, 'open' | 'onOpenChange'> & {
  readonly onDiscard: () => void;
};

function unitLabelOf(units: readonly UnitView[], unitId: string, line: OrderLineDraft | null): string | null {
  const unit = units.find((candidate) => candidate.id === unitId);
  if (unit !== undefined) return unit.symbol ?? unit.name;
  return line !== null && line.unitId === unitId ? line.unitLabel : null;
}

function OrderLineEditor({
  line,
  lines,
  recipes,
  units,
  bridge,
  onApply,
  onRemove,
  onDiscard,
  texts = ORDER_LINE_SHEET_TEXTS,
}: OrderLineEditorProps) {
  const newKey = `nueva${useId()}`;
  const [recipe, setRecipe] = useState<RecipePickerOption | null>(line?.recipe ?? null);
  const [versionId, setVersionId] = useState<string | null>(line?.recipeVersionId ?? null);
  // Cada elección de receta remonta el selector de versión para que vuelva a «Original».
  const [recipeChoice, setRecipeChoice] = useState(0);
  const [quantity, setQuantity] = useState(line?.quantity ?? '');
  const [unitId, setUnitId] = useState(line?.unitId ?? '');
  const [distribution, setDistribution] = useState<readonly OrderDistributionLine[]>(
    line?.presentationLines ?? [],
  );
  const [salePrice, setSalePrice] = useState(line?.salePrice ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [leftoverDraft, setLeftoverDraft] = useState<{ draft: OrderLineDraft; leftover: string } | null>(
    null,
  );

  const saved = line?.saved ?? null;
  const quote = useOrderCostQuote(line?.ingredientsCost ?? null, saved?.id, distribution, {
    frozen: saved !== null && isStartedOrderStatus(saved.status),
  });
  const availability = useOrderDistributionAvailability({ quantity, unitId, lines: distribution });
  const unitLabel = unitLabelOf(units, unitId, line);
  const compatibleIds = useMemo(() => compatibleUnitIds(units, unitId), [units, unitId]);
  const effectiveRecipeId = recipe === null ? null : (versionId ?? recipe.id);

  const [ingredients, setIngredients] = useState<readonly RecipeLineView[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(line !== null);
  const [ingredientsError, setIngredientsError] = useState<string | null>(null);
  const ingredientsRequestRef = useRef(0);
  const [initialRecipeId] = useState(effectiveRecipeId);

  const costApproximate =
    quote.state.amount !== null &&
    ingredients.some(
      (ingredient) => ingredientNeedOf(ingredient, quantity, unitId, units, bridge)?.kind === 'approximate',
    );

  // Descarta la respuesta de una receta ya superada si llega después que la de la nueva.
  const applyIngredientsResult = useCallback((requestId: number, result: RecipeQueryResult) => {
    if (requestId !== ingredientsRequestRef.current) return;
    setIngredientsLoading(false);
    if (result.status === 'error') {
      setIngredients([]);
      setIngredientsError(result.message);
      return;
    }
    setIngredients(result.data.lines);
    setIngredientsError(null);
  }, []);

  const loadIngredients = useCallback(
    (selectedId: string) => {
      const requestId = ++ingredientsRequestRef.current;
      void getRecipeAction(selectedId).then((result) => applyIngredientsResult(requestId, result));
    },
    [applyIngredientsResult],
  );

  useEffect(() => {
    if (initialRecipeId !== null) loadIngredients(initialRecipeId);
  }, [loadIngredients, initialRecipeId]);

  function chooseRecipe(option: RecipePickerOption | null) {
    setVersionId(null);
    setRecipeChoice((count) => count + 1);
    if (option === null) {
      setRecipe(null);
      setIngredients([]);
      setIngredientsError(null);
      quote.onRecipeChange(null, quantity, unitId);
      return;
    }
    setRecipe({ id: option.id, name: option.name, imageUrl: option.imageUrl });
    setIngredientsLoading(true);
    setIngredientsError(null);
    loadIngredients(option.id);
    quote.onRecipeChange(option.id, quantity, unitId);
  }

  function chooseVersion(nextVersionId: string | null) {
    if (recipe === null) return;
    const nextRecipeId = nextVersionId ?? recipe.id;
    setVersionId(nextVersionId);
    setIngredientsLoading(true);
    setIngredientsError(null);
    loadIngredients(nextRecipeId);
    quote.onRecipeChange(nextRecipeId, quantity, unitId);
  }

  function validate(): { draft: OrderLineDraft } | { errors: FieldErrors } {
    const parsed = orderLineInputSchema.safeParse({
      recipeId: recipe?.id ?? '',
      recipeVersionId: versionId,
      quantity,
      unitId,
      presentationLines: toDistributionLinesInput(distribution),
      salePrice,
    });
    const errors: FieldErrors = {};
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      const field = LINE_FIELDS.find((name) => name === issue.path[0]);
      if (field !== undefined && errors[field] === undefined) errors[field] = texts.fieldErrors[field];
    }
    if (!distributionLinesValid(distribution)) errors.presentationLines = texts.fieldErrors.presentationLines;

    const draft: OrderLineDraft = {
      key: line?.key ?? newKey,
      saved,
      recipe: recipe ?? { id: '', name: '', imageUrl: null },
      recipeVersionId: versionId,
      quantity,
      unitId,
      unitLabel,
      presentationLines: distribution,
      salePrice: salePrice.trim(),
      ingredientsCost: quote.state.amount,
    };
    if (errors.recipeId === undefined && lines.some((other) => isSameRecipe(draft, other))) {
      errors.recipeId = texts.duplicate;
    }
    return Object.keys(errors).length === 0 ? { draft } : { errors };
  }

  function apply() {
    const result = validate();
    if ('errors' in result) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    const leftover = leftoverOf(availability);
    if (leftover !== null) {
      setLeftoverDraft({ draft: result.draft, leftover });
      return;
    }
    onApply(result.draft);
  }

  function applyWithLeftover() {
    if (leftoverDraft === null) return;
    const { draft } = leftoverDraft;
    setLeftoverDraft(null);
    onApply(draft);
  }

  return (
    <SheetContent
      side="right"
      showCloseButton={false}
      minScreenWidth={60}
      className="w-full pb-[env(safe-area-inset-bottom)] data-[side=right]:w-full sm:max-w-lg"
      data-testid={ORDER_LINE_SHEET_TESTID}
      footer={
        <>
          {line !== null && canRemove(line) ? (
            <Button
              type="button"
              variant="ghost"
              className={`${touchTarget} mr-auto text-destructive`}
              onClick={() => onRemove(line.key)}
              data-testid={ORDER_LINE_SHEET_REMOVE_TESTID}
            >
              {texts.remove}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className={touchTarget}
            onClick={onDiscard}
            data-testid={ORDER_LINE_SHEET_DISCARD_TESTID}
          >
            {texts.discard}
          </Button>
          <Button
            type="button"
            className={touchTarget}
            disabled={availabilityBlocksSave(availability)}
            onClick={apply}
            data-testid={ORDER_LINE_SHEET_APPLY_TESTID}
          >
            {texts.apply}
          </Button>
        </>
      }
    >
      <OrderLeftoverDialog
        open={leftoverDraft !== null}
        leftover={leftoverDraft?.leftover ?? '0'}
        unitLabel={unitLabel}
        message={texts.leftoverMessage}
        confirmLabel={texts.leftoverConfirm}
        onConfirm={applyWithLeftover}
        onDismiss={() => setLeftoverDraft(null)}
      />
      <SheetHeader>
        <div className="flex items-start gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={touchTarget}
            aria-label={texts.back}
            onClick={onDiscard}
            data-testid={ORDER_LINE_SHEET_BACK_TESTID}
          >
            <ArrowLeftIcon aria-hidden="true" />
          </Button>
          <div className="flex flex-col gap-0.5">
            <SheetTitle data-testid={ORDER_LINE_SHEET_TITLE_TESTID}>
              {line === null ? texts.addTitle : texts.editTitle}
            </SheetTitle>
            <SheetDescription>{texts.description}</SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-12">
          <div className="sm:col-span-3">
            <OrderRecipeImage imageUrl={recipe?.imageUrl ?? null} name={recipe?.name ?? ''} />
          </div>

          <div className="flex flex-col gap-4 sm:col-span-9">
            <RecipePicker
              initialPage={recipes}
              onSelect={chooseRecipe}
              defaultValue={line?.recipe.id ?? ''}
              defaultLabel={line?.recipe.name ?? ''}
              error={fieldErrors.recipeId}
            />

            <RecipeVersionSelect
              key={recipeChoice}
              recipeId={recipe?.id ?? null}
              initialVersion={
                recipeChoice === 0 && line !== null && line.recipeVersionId !== null
                  ? {
                      id: line.recipeVersionId,
                      name: saved?.recipeVersion?.versionName ?? '',
                    }
                  : null
              }
              onChange={chooseVersion}
              error={fieldErrors.recipeVersionId}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <OrderField
                  name="quantity"
                  label={texts.quantity}
                  required
                  type="number"
                  step="any"
                  min="0.01"
                  inputMode="decimal"
                  roundDecimals={2}
                  defaultValue={line?.quantity ?? ''}
                  onValueChange={(value) => {
                    setQuantity(value);
                    quote.onQuantityChange(effectiveRecipeId, value, unitId);
                  }}
                  error={fieldErrors.quantity}
                />
              </div>
              <div className="sm:col-span-6">
                <PresentationUnitSelect
                  units={units}
                  value={unitId}
                  onValueChange={(next) => {
                    setUnitId(next);
                    quote.onUnitChange(effectiveRecipeId, quantity, next);
                  }}
                  error={fieldErrors.unitId}
                />
              </div>
            </div>

            <OrderDistributionField
              lines={distribution}
              onLinesChange={(next) => {
                setDistribution(next);
                quote.onDistributionChange(effectiveRecipeId, quantity, unitId, next);
              }}
              unitId={unitId}
              compatibleUnitIds={compatibleIds}
              unitLabel={unitLabel}
              quantity={quantity}
              units={units}
              availability={availability}
              error={fieldErrors.presentationLines}
            />

            {/* Sin `roundDecimals`: el esquema admite 4 decimales y redondear cambiaría el precio. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <OrderField
                  name="salePrice"
                  label={texts.salePrice}
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  defaultValue={line?.salePrice ?? ''}
                  onValueChange={setSalePrice}
                  error={fieldErrors.salePrice}
                />
              </div>
            </div>

            <OrderCostQuote {...quote.state} approximate={costApproximate} />
          </div>
        </div>

        {recipe === null ? null : (
          <OrderIngredientsTable
            lines={ingredients}
            units={units}
            quantity={quantity}
            orderUnitId={unitId}
            bridge={bridge}
            loading={ingredientsLoading}
            error={ingredientsError}
          />
        )}
      </div>
    </SheetContent>
  );
}
