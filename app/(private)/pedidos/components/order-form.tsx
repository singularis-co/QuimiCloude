'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useState,
  type FormEvent,
} from 'react';
import { PlusIcon } from 'lucide-react';

import { PRESENTATION_UNIT_FIELD } from '@/components/shared/presentation-unit-select';
import { ErrorAlert } from '@/components/shared/error-alert';
import { FormSheet } from '@/components/shared/form-sheet';
import { Notice } from '@/components/shared/notice';
import { SelectField } from '@/components/shared/select-field';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_ORDER_PRIORITY,
  ORDER_PRIORITY_VALUES,
  type OrderPriority,
  type OrderSummary,
} from '@/lib/modules/pedidos';
import {
  createOrderAction,
  updateOrderAction,
  type OrderLinesErrorState,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';
import type { ErrorCode } from '@/lib/modules/errores';
import type { MassVolumeBridge, UnitView } from '@/lib/modules/unidades';
// Solo el tipo: la arista pedidos -> inventario ya existe en el contrato del modulo.
import type { OrderCoverage } from '@/lib/modules/inventario';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import type { OrderCustomerChoice } from '@/components/shared/order-customer-label';
import { OrderCustomerPicker } from '@/components/shared/order-customer-picker';

import {
  candidateOf,
  draftFromOrder,
  draftTotals,
  type OrderCandidate,
  type OrderLineDraft,
} from './order-line-draft';
import { OrderLineSheet } from './order-line-sheet';
import { OrderLinesEmpty, OrderLinesTable, OrderLinesTotals } from './order-lines-table';
import { RECIPE_FIELD, type RecipePickerPage } from './recipe-picker';
import { RECIPE_VERSION_FIELD } from './recipe-version-select';
import { ORDER_PRIORITY_LABELS, OrderCoverageBadge } from './order-status-badge';

/** La etiqueta de cobertura de la hoja. */
export const ORDER_SHEET_COVERAGE_TESTID = 'order-sheet-coverage';

/** Los campos de una receta del pedido, más la prioridad del pedido. */
export const ORDER_BUSINESS_FIELDS = [
  RECIPE_FIELD,
  'quantity',
  PRESENTATION_UNIT_FIELD,
  'priority',
  RECIPE_VERSION_FIELD,
  'salePrice',
] as const;

export const ORDER_STATUS_FIELD = 'status';
export const ORDER_CONFIRM_BLOCKED_FIELD = 'confirmBlocked';
export const ORDER_PRIORITY_SELECT_TESTID = 'order-priority-select';
export const ORDER_PRIORITY_OPTION_TESTID = 'order-priority-option';
export const ORDER_STATUS_SELECT_TESTID = 'order-status-select';
export const ORDER_STATUS_OPTION_TESTID = 'order-status-option';
export const ORDER_FORM_TESTID = 'order-form';
export const ORDER_FORM_TITLE_TESTID = 'order-form-title';
export const ORDER_FORM_ERROR_TESTID = 'order-form-error';
export const ORDER_FORM_SUBMIT_TESTID = 'order-form-submit';
export const ORDER_FORM_CANCEL_TESTID = 'order-form-cancel';
export const ORDER_FORM_LINES_COUNT_TESTID = 'order-form-lines-count';
export const ORDER_FORM_ADD_LINE_TESTID = 'order-form-add-line';
export const ORDER_FORM_LINES_ERROR_TESTID = 'order-form-lines-error';
export const ORDER_FORM_LINES_ERROR_ITEM_TESTID = 'order-form-lines-error-item';
export const ORDER_FORM_REVIEW_LINE_TESTID = 'order-form-review-line';
export const ORDER_FORM_SAVE_BLOCKED_TESTID = 'order-form-save-blocked';

/** Nombre del campo del `FormData` con el id del cliente; vacio = sin cliente. */
export const ORDER_CUSTOMER_FIELD = 'customerId';

export type OrderFormTexts = {
  readonly createTitle: string;
  readonly editTitle: (numberText: string) => string;
  readonly createDescription: string;
  readonly editDescription: string;
  readonly customer: string;
  readonly customerPlaceholder: string;
  readonly customerEmpty: string;
  readonly priority: string;
  readonly lines: string;
  readonly addLine: string;
  readonly save: string;
  readonly materialLine: (recipeName: string, number: number) => string;
  readonly catalogLine: (message: string, recipeName: string, number: number) => string;
  readonly reviewLine: string;
  readonly saveBlocked: string;
};

export const ORDER_FORM_TEXTS: OrderFormTexts = {
  createTitle: 'Nuevo pedido',
  editTitle: (numberText) => `Editar pedido ${numberText}`,
  createDescription: 'Añade una o más recetas. La fecha y el número los pone el sistema.',
  editDescription:
    'Las recetas que ya no se pueden editar salen en solo lectura. Siempre puedes añadir otra.',
  customer: 'Cliente (opcional)',
  customerPlaceholder: 'Busca un cliente por su nombre',
  customerEmpty: 'Ningún cliente coincide con la búsqueda.',
  priority: 'Prioridad',
  lines: 'Recetas',
  addLine: 'Añadir receta',
  save: 'Guardar pedido',
  materialLine: (recipeName, number) => `No alcanza el material para ${recipeName} (receta ${number}).`,
  catalogLine: (message, recipeName, number) => `${message} ${recipeName} (receta ${number}).`,
  reviewLine: 'Revisar receta',
  saveBlocked: 'Guardar bloqueada',
};

const WOULD_BLOCK_CODE = 'order_would_block' satisfies ErrorCode;
const MATERIAL_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  WOULD_BLOCK_CODE,
  'insufficient_material',
]);

/** Lo que se envió, para reenviarlo tal cual con «Guardar bloqueada». */
type SaveRequest = {
  readonly candidate: OrderCandidate;
  readonly rowOfPosition: readonly number[];
  readonly lines: readonly OrderLineDraft[];
};

type FailedLine = { readonly key: string; readonly name: string; readonly number: number };

type OrderFormState =
  | { readonly status: 'idle' }
  | { readonly status: 'success' }
  | {
      readonly status: 'error';
      readonly error: OrderLinesErrorState;
      readonly failed: readonly FailedLine[];
      readonly request: SaveRequest;
    };

const INITIAL_STATE: OrderFormState = { status: 'idle' };

function failedLinesOf(positions: readonly number[], request: SaveRequest): FailedLine[] {
  return positions.flatMap((position) => {
    const row = request.rowOfPosition[position];
    const line = row === undefined ? undefined : request.lines[row];
    return row === undefined || line === undefined
      ? []
      : [{ key: line.key, name: line.recipe.name, number: row + 1 }];
  });
}

function priorityOf(formData: FormData): OrderPriority {
  const raw = formData.get('priority');
  return ORDER_PRIORITY_VALUES.find((value) => value === raw) ?? DEFAULT_ORDER_PRIORITY;
}

type SubPanel = { readonly session: number; readonly line: OrderLineDraft | null };

export type OrderFormProps = {
  /** Pedido que se edita. Ausente en el alta. */
  readonly order?: OrderSummary;
  readonly recipes: RecipePickerPage;
  readonly units: readonly UnitView[];
  readonly bridge: MassVolumeBridge | null;
  /** Lo llama el panel cuando la operacion termina bien: cerrar, avisar y refrescar. */
  readonly onSaved: () => void;
  /** La cobertura que la fila del listado ya trajo; sin ella no se pinta la etiqueta. */
  readonly coverage?: OrderCoverage;
  readonly texts?: OrderFormTexts;
};

/**
 * Panel de alta y edición de un pedido: cliente, prioridad y la tabla de recetas. Las recetas se
 * añaden y se editan en un sub-panel y solo viven en el borrador hasta «Guardar pedido».
 */
export function OrderForm({
  order,
  recipes,
  units,
  bridge,
  onSaved,
  coverage,
  texts = ORDER_FORM_TEXTS,
}: OrderFormProps) {
  const fieldId = useId();
  const customerFieldId = `${fieldId}-customer`;
  const isEdit = order !== undefined;
  const [customer, setCustomer] = useState<OrderCustomerChoice | null>(
    order?.customer ? { kind: 'customer', customer: order.customer } : null,
  );
  const [lines, setLines] = useState<readonly OrderLineDraft[]>(() =>
    order === undefined ? [] : draftFromOrder(order),
  );
  const [subPanel, setSubPanel] = useState<SubPanel | null>(null);
  const [subPanelOpen, setSubPanelOpen] = useState(false);

  const totals = draftTotals(lines);
  const canSave = totals.activeLines > 0;

  async function save(_previous: OrderFormState, request: SaveRequest): Promise<OrderFormState> {
    const result =
      order === undefined
        ? await createOrderAction(request.candidate)
        : await updateOrderAction(order.id, request.candidate);
    if (result.status !== 'error') return { status: 'success' };
    return { status: 'error', error: result, failed: failedLinesOf(result.linePositions, request), request };
  }

  const [state, dispatch, isPending] = useActionState(save, INITIAL_STATE);

  useEffect(() => {
    if (state.status !== 'success') return;
    onSaved();
  }, [state, onSaved]);

  // Se recuerda qué aviso se cerró, no un booleano: el de un envío nuevo es otro objeto y se ve.
  const [closedNotice, setClosedNotice] = useState<OrderFormState | null>(null);

  // Sin `<form action>`: React reiniciaría la prioridad al terminar el envío.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || isPending) return;
    const { candidate, rowOfPosition } = candidateOf(lines, {
      priority: priorityOf(new FormData(event.currentTarget)),
      customerId: customer?.kind === 'customer' ? customer.customer.id : null,
      confirmBlocked: false,
    });
    startTransition(() => dispatch({ candidate, rowOfPosition, lines }));
  }

  function saveBlocked() {
    if (state.status !== 'error') return;
    const { request } = state;
    setClosedNotice(state);
    startTransition(() =>
      dispatch({ ...request, candidate: { ...request.candidate, confirmBlocked: true } }),
    );
  }

  function openSubPanel(line: OrderLineDraft | null) {
    setSubPanel((current) => ({ session: (current?.session ?? 0) + 1, line }));
    setSubPanelOpen(true);
  }

  function applyLine(draft: OrderLineDraft) {
    setLines((current) =>
      current.some((line) => line.key === draft.key)
        ? current.map((line) => (line.key === draft.key ? draft : line))
        : [...current, draft],
    );
    setSubPanelOpen(false);
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
    setSubPanelOpen(false);
  }

  const failed = state.status === 'error' ? state.failed : [];
  const markedKeys = new Set(failed.map((line) => line.key));
  const showLinesNotice = state.status === 'error' && failed.length > 0 && closedNotice !== state;
  const formError = state.status === 'error' && failed.length === 0 ? state.error : undefined;

  return (
    <>
      <FormSheet
        minScreenWidth={70}
        formAction={ignoreFormAction}
        onSubmit={submit}
        noValidate
        testIds={{
          sheet: 'order-sheet',
          form: ORDER_FORM_TESTID,
          cancel: ORDER_FORM_CANCEL_TESTID,
          submit: ORDER_FORM_SUBMIT_TESTID,
          title: ORDER_FORM_TITLE_TESTID,
        }}
        saveLabel={texts.save}
        canSave={canSave}
        busy={isPending}
        saveTouch="class"
        title={isEdit ? texts.editTitle(order.numberText) : texts.createTitle}
        description={isEdit ? texts.editDescription : texts.createDescription}
        headerExtra={
          isEdit && coverage !== undefined ? (
            <div data-testid={ORDER_SHEET_COVERAGE_TESTID}>
              <OrderCoverageBadge coverage={coverage} />
            </div>
          ) : null
        }
      >
        {showLinesNotice && state.status === 'error' ? (
          <Notice
            tone="danger"
            testId={ORDER_FORM_LINES_ERROR_TESTID}
            actions={
              state.error.code === WOULD_BLOCK_CODE ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className={touchTarget}
                    onClick={() => setClosedNotice(state)}
                    data-testid={ORDER_FORM_REVIEW_LINE_TESTID}
                  >
                    {texts.reviewLine}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className={touchTarget}
                    onClick={saveBlocked}
                    disabled={isPending}
                    data-testid={ORDER_FORM_SAVE_BLOCKED_TESTID}
                  >
                    {texts.saveBlocked}
                  </Button>
                </>
              ) : undefined
            }
          >
            {failed.map((line) => (
              <span key={line.key} className="block" data-testid={ORDER_FORM_LINES_ERROR_ITEM_TESTID}>
                {MATERIAL_CODES.has(state.error.code)
                  ? texts.materialLine(line.name, line.number)
                  : texts.catalogLine(state.error.message, line.name, line.number)}
              </span>
            ))}
          </Notice>
        ) : null}

        {formError === undefined ? null : (
          <ErrorAlert
            error={formError}
            id={`${fieldId}-form-error`}
            className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
            testId={ORDER_FORM_ERROR_TESTID}
            renderCatalogued={(catalogued) => (
              <>
                <p data-testid="order-form-error-message">{catalogued.message}</p>
                <p className="text-xs" data-testid="order-form-error-code">
                  {catalogued.code}
                </p>
              </>
            )}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor={customerFieldId} className="text-sm font-medium">
              {texts.customer}
            </label>
            <OrderCustomerPicker
              purpose="assign"
              name={ORDER_CUSTOMER_FIELD}
              id={customerFieldId}
              value={customer}
              onChange={setCustomer}
              placeholder={texts.customerPlaceholder}
              emptyMessage={texts.customerEmpty}
            />
          </div>
          <SelectField
            name="priority"
            label={texts.priority}
            defaultValue={order?.priority ?? DEFAULT_ORDER_PRIORITY}
            options={ORDER_PRIORITY_VALUES.map((value) => ({
              value,
              label: ORDER_PRIORITY_LABELS[value],
            }))}
            triggerTestId={ORDER_PRIORITY_SELECT_TESTID}
            optionTestId={ORDER_PRIORITY_OPTION_TESTID}
            optionValueAttribute
            errorAlert={false}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">
            {texts.lines}{' '}
            <span className="text-muted-foreground" data-testid={ORDER_FORM_LINES_COUNT_TESTID}>
              {lines.length}
            </span>
          </h3>
          <Button
            type="button"
            variant="outline"
            className={touchTarget}
            onClick={() => openSubPanel(null)}
            data-testid={ORDER_FORM_ADD_LINE_TESTID}
          >
            <PlusIcon aria-hidden="true" />
            {texts.addLine}
          </Button>
        </div>

        {totals.activeLines === 0 ? <OrderLinesEmpty /> : null}
        <OrderLinesTable
          lines={lines}
          markedKeys={markedKeys}
          onEdit={(key) => openSubPanel(lines.find((line) => line.key === key) ?? null)}
        />
        {lines.length === 0 ? null : <OrderLinesTotals totals={totals} />}
      </FormSheet>

      {subPanel === null ? null : (
        <OrderLineSheet
          key={subPanel.session}
          open={subPanelOpen}
          onOpenChange={setSubPanelOpen}
          line={subPanel.line}
          lines={lines}
          recipes={recipes}
          units={units}
          bridge={bridge}
          onApply={applyLine}
          onRemove={removeLine}
        />
      )}
    </>
  );
}

function ignoreFormAction(): void {}
