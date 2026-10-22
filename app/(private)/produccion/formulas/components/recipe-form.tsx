'use client';

import { EyeIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';

import { StepReader } from '@/components/shared/step-reader';
import { ErrorAlert } from '@/components/shared/error-alert';
import { ImageField } from '@/components/shared/image-field';
import { Notice } from '@/components/shared/notice';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ErrorCode, ErrorState } from '@/lib/modules/errores';
import {
  createRecipeSchema,
  MAX_IMAGE_BYTES,
  sumPercentages,
  updateRecipeSchema,
  validateRecipeImage,
  type CreateRecipeInput,
  type RecipeDetail,
  type RecipeVersionSummary,
  type UpdateRecipeInput,
} from '@/lib/modules/recetas';
import {
  createRecipeAction,
  updateRecipeAction,
} from '@/lib/modules/recetas/adapters/driving/recipe-actions';
import type { UnitRef } from '@/lib/modules/unidades';
import { FORMULAS_ROUTE, recipeVersionRoute } from '@/lib/shared/routes';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

import { FormFooterBar } from './form-footer-bar';
import type { ProductPickerOption } from './product-picker';
import { PropagateVersionsDialog } from './propagate-versions-dialog';
import {
  RECIPE_LINE_ERROR_MESSAGES,
  RECIPE_LINES_GENERAL_ERROR_MESSAGE,
  RECIPE_TOOL_ERROR_MESSAGES,
  RECIPE_TOOLS_GENERAL_ERROR_MESSAGE,
  RecipeLinesField,
} from './recipe-lines-field';
import {
  CONDITIONING_STEPS_FIELD_TEXTS,
  PACKING_STEPS_FIELD_TEXTS,
  RECIPE_STEP_ERROR_MESSAGES,
  RecipeStepsField,
} from './recipe-steps-field';
import {
  buildRecipePayload,
  createLocalKey,
  extractFieldError,
  extractGeneralLinesError,
  extractGeneralToolsError,
  extractLineErrors,
  extractStepErrors,
  extractToolErrors,
  toLineFormValues,
  toToolFormValues,
  type RecipeFieldErrorMessages,
  type RecipeFormState,
  type RecipeLineErrors,
  type RecipeStepErrors,
  type RecipeStepFormValue,
  type RecipeToolErrors,
} from './recipe-form-state';

/**
 * El formulario y sus dos modos (T19, R20-R26, R37, `design.md > 5`).
 *
 * **NO usa `useActionState`, y el motivo es del CONTRATO, no de gusto** (`design.md > 5`,
 * alternativa B descartada frente al patrón de `product-form.tsx` de `inventario`):
 * `createRecipeAction(input)` y `updateRecipeAction(id, input)` NO reciben `prevState` -así que no
 * encajan en la firma que `useActionState` exige- y reciben un OBJETO TIPADO con listas
 * anidadas, no `FormData` -así que no hay `<form action={fn}>` que las produzca-. Este componente
 * mantiene su propio estado controlado en React (`recipe-form-state.ts`) y envía dentro de
 * `useTransition`; `isPending` deshabilita el botón de envío mientras la operación está en curso
 * (R37).
 *
 * **Validación previa con los esquemas del CONTRATO** (`createRecipeSchema`/`updateRecipeSchema`
 * del barrel de `recetas`, R26): se ejecutan con `safeParse` ANTES de invocar la operación, sobre
 * el payload que arma `buildRecipePayload` -nunca sobre el estado crudo-, y sus issues alimentan
 * los errores por campo, por línea (R31) y por paso. La REGLA es la del esquema; el TEXTO se
 * traduce aquí: los `refine` del esquema ya traen su mensaje en español y pasan tal cual, y los
 * issues de forma de zod (`too_small`, `too_big`, …), que traen el genérico en inglés, se
 * sustituyen por el texto propio del formulario (`NAME_ERROR_MESSAGES`, `RECIPE_*_ERROR_MESSAGES`),
 * igual que `product-form.tsx`. El servidor revalida igual: el cliente nunca es la frontera.
 *
 * **Errores de la operación (R23)**: `recipe_duplicate_name` va junto al campo nombre;
 * `recipe_not_found` se presenta con un enlace a la lista; cualquier otro código (`invalid_input`,
 * `unauthorized`, …) va en la región `role="alert"` del formulario. Ninguno navega fuera del
 * formulario ni pierde lo que el usuario había escrito. El código se pinta bajo el mensaje salvo
 * `invalid_input`: su mensaje ya dice qué hacer y el código no le dice nada al usuario.
 *
 * QC-70 (R20, R21, R32): los dos códigos que se comparan son los ABIERTOS por caso -los genéricos
 * `duplicate_name` y `not_found` ya no existen en el catálogo-, el código está tipado con
 * `ErrorCode` -un literal mal escrito no compila- y el texto que se pinta cuando el error viene de
 * la operación es SIEMPRE su `message`. Lo que el formulario valida por su cuenta no se toca
 * (R31): `INVALID_INPUT_MESSAGE` sigue siendo suyo; del catálogo sale solo el código.
 *
 * **Éxito (R24)**: navega a la lista, `toast.success(...)` -con el `<Toaster/>` que el layout
 * privado YA monta, nunca uno propio (R25)- y `router.refresh()` para que la lista salga puesta al
 * día sin que el usuario tenga que recargar.
 *
 * Si al propagar alguna versión queda por revisar, NO navega: se queda en la ficha y las nombra.
 */

const FIELD_TEXT = 'text-base';

const PACKING_STEPS_TESTID_PREFIX = 'recipe-packing-step';
const CONDITIONING_STEPS_TESTID_PREFIX = 'recipe-conditioning-step';

const PREVIEW_OPEN_LABEL = 'Vista previa';
const PREVIEW_TITLE = 'Vista previa';
const PREVIEW_DESCRIPTION =
  'Así se leerá esta fórmula, paso a paso. Nada de lo que hagas aquí se guarda.';
const PREVIEW_CLOSE_LABEL = 'Cerrar';
// Por debajo de 768 px ocupa la pantalla visible entera; desde ahí, centrado con tope de 920 × 900.
// `dvh` y no `vh`: en el móvil la barra del navegador se come parte del alto de ventana.
const PREVIEW_DIALOG_CLASS =
  'top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-none md:top-1/2 md:left-1/2 md:h-[min(900px,calc(100dvh-64px))] md:w-[min(920px,calc(100vw-48px))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl';

const STEP_LOCK_TITLE = (orders: number) =>
  orders === 1
    ? '1 pedido en curso ya tiene fotos de evidencia'
    : `${orders} pedidos en curso ya tienen fotos de evidencia`;
const STEP_LOCK_BODY =
  'Mientras sigan en curso no puedes mover ni quitar pasos. Sí puedes cambiar el texto, encender o apagar «Requiere evidencia» y añadir pasos al final.';

const SAVE_SUCCESS_CREATE = 'Fórmula creada.';
const SAVE_SUCCESS_EDIT = 'Fórmula actualizada.';
/**
 * QC-70 (R21): el código que el formulario FABRICA para su propio rechazo sale del catálogo
 * -`satisfies` conserva el literal y a la vez obliga a que siga estando en la lista cerrada-. El
 * mensaje NO: es la frase que el formulario escribe para su propia validación y R31 la congela.
 */
const INVALID_INPUT_CODE = 'invalid_input' satisfies ErrorCode;
const INVALID_INPUT_MESSAGE = 'Revisa los campos marcados.';

/** Texto propio del nombre y la descripción para los issues de forma de zod (tope en el esquema). */
const NAME_ERROR_MESSAGES: RecipeFieldErrorMessages = {
  invalid: 'Escribe el nombre de la fórmula.',
  tooLong: 'El nombre admite como máximo 120 caracteres.',
};
const DESCRIPTION_ERROR_MESSAGES: RecipeFieldErrorMessages = {
  invalid: 'Revisa la descripción.',
  tooLong: 'La descripción admite como máximo 500 caracteres.',
};

export type RecipeFormProductPage = {
  readonly items: readonly ProductPickerOption[];
  readonly totalPages: number;
};

const CARD_CLASS = 'gap-4 overflow-visible rounded-[14px] px-5 py-5';

export type RecipeFormProps = (
  | {
      readonly mode: 'create';
      readonly units: readonly UnitRef[];
      readonly initialProductPage: RecipeFormProductPage;
      readonly initialMachinePage: RecipeFormProductPage;
    }
  | {
      readonly mode: 'edit';
      readonly recipe: RecipeDetail;
      readonly versions: readonly RecipeVersionSummary[];
      /** Pedidos en curso con fotos de evidencia de esta fórmula; con más de 0 no se mueven ni quitan pasos. */
      readonly lockingOrders?: number;
      readonly units: readonly UnitRef[];
      readonly initialProductPage: RecipeFormProductPage;
      readonly initialMachinePage: RecipeFormProductPage;
    }
) & {
  /** Lista de versiones: va entre los datos generales y los ingredientes. */
  readonly versionList?: ReactNode;
  /** Acción «Nueva versión»: va en el pie, junto a «Vista previa». */
  readonly newVersionAction?: ReactNode;
};

type FieldErrors = {
  readonly name?: string;
  readonly description?: string;
  readonly lines?: RecipeLineErrors;
  readonly linesGeneral?: string;
  readonly tools?: RecipeToolErrors;
  readonly toolsGeneral?: string;
  readonly steps?: RecipeStepErrors;
  readonly packingSteps?: RecipeStepErrors;
  readonly conditioningSteps?: RecipeStepErrors;
};

/**
 * El error general del formulario, ENTERO.
 *
 * **QC-71 (R17): era `{ code, message }` copiado a mano, y esa copia perdia el `reference` del
 * error inesperado.** Un `reference?: string` aqui reabriria el agujero por el otro lado -deja
 * construir un inesperado sin identificador-, asi que lo que se guarda es la union cerrada de
 * `lib/modules/errores` y el render estrecha por `code`.
 */
type SaveError = ErrorState;

type ValidatedPayload = CreateRecipeInput | UpdateRecipeInput;

type UnderReviewVersion = { readonly id: string; readonly name: string };

const UNDER_REVIEW_MESSAGE =
  'Estas versiones han quedado por revisar: sus líneas ya no suman 100 %.';

function buildInitialState(props: RecipeFormProps): RecipeFormState {
  if (props.mode === 'create') {
    return {
      name: '',
      description: '',
      lines: [],
      tools: [],
      steps: [],
      packingSteps: [],
      conditioningSteps: [],
      image: { kind: 'untouched' },
    };
  }

  const { recipe } = props;
  return {
    name: recipe.name,
    description: recipe.description ?? '',
    lines: toLineFormValues(recipe.lines),
    tools: toToolFormValues(recipe.tools),
    // QC-64 R9: el paso guardado entra en el estado COMO DOCUMENTO, tal cual. Ya no se aplana a
    // texto -el puente de QC-62 R19 se retiro con T4-, asi que reabrir una receta conserva sus
    // marcas y sus listas de verificacion intactas. `key` es una clave local de React.
    steps: recipe.steps.map(
      (step): RecipeStepFormValue => ({ key: createLocalKey('step'), document: step }),
    ),
    // El tipo la exige, pero un detalle sin la clave debe abrir la sección vacía, no romper.
    packingSteps: (recipe.packingSteps ?? []).map(
      (step): RecipeStepFormValue => ({ key: createLocalKey('packing-step'), document: step }),
    ),
    conditioningSteps: (recipe.conditioningSteps ?? []).map(
      (step): RecipeStepFormValue => ({ key: createLocalKey('conditioning-step'), document: step }),
    ),
    image: { kind: 'untouched' },
  };
}

export function RecipeForm(props: RecipeFormProps) {
  const router = useRouter();
  const formId = useId();
  const [state, setState] = useState<RecipeFormState>(() => buildInitialState(props));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [isPending, startTransition] = useTransition();
  // QC-64 R11-R13: la vista previa es SOLO estado de pantalla. Ni guarda, ni invoca ninguna
  // operacion del modulo, ni navega; abrirla y cerrarla no toca una sola letra del formulario.
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);
  const [pendingPayload, setPendingPayload] = useState<ValidatedPayload | null>(null);
  const [underReview, setUnderReview] = useState<readonly UnderReviewVersion[]>([]);

  const isEdit = props.mode === 'edit';
  const lockingOrders = props.mode === 'edit' ? (props.lockingOrders ?? 0) : 0;
  const stepsLocked = lockingOrders > 0;

  // Se recalcula en CADA render con la misma función que el indicador de suma y que el
  // esquema del contrato -nunca una copia local de la regla-, también con cero líneas. La
  // coma se sustituye por un punto igual que en `buildRecipePayload`: `sumPercentages` opera
  // sobre el formato del contrato.
  const isComplete = sumPercentages(
    state.lines.map((line) => line.percentage.replace(',', '.')),
  ).isComplete;

  // Cada línea necesita su ingrediente elegido: un 100 % sin producto no habilita el guardado.
  // El esquema del contrato lo rechazaría igual (`productId` uuid); esto es refuerzo de UX.
  const hasAllProducts =
    state.lines.length > 0 && state.lines.every((line) => line.productId !== '');
  const canSubmit = isComplete && hasAllProducts;

  function handleSubmit() {
    setSaveError(null);

    // Enter en un campo no se salta la comprobación -`disabled` en el botón no basta,
    // porque el formulario también se envía por teclado-. Se repite la MISMA función que ya
    // deshabilita el botón, no una regla nueva.
    if (!canSubmit) return;

    const payload = buildRecipePayload(props.mode, state);
    const schema = isEdit ? updateRecipeSchema : createRecipeSchema;
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      const issues = parsed.error.issues;
      setFieldErrors({
        name: extractFieldError(issues, 'name', NAME_ERROR_MESSAGES),
        description: extractFieldError(issues, 'description', DESCRIPTION_ERROR_MESSAGES),
        lines: extractLineErrors(issues, RECIPE_LINE_ERROR_MESSAGES),
        linesGeneral: extractGeneralLinesError(issues, RECIPE_LINES_GENERAL_ERROR_MESSAGE),
        tools: extractToolErrors(issues, RECIPE_TOOL_ERROR_MESSAGES),
        toolsGeneral: extractGeneralToolsError(issues, RECIPE_TOOLS_GENERAL_ERROR_MESSAGE),
        steps: extractStepErrors(issues, RECIPE_STEP_ERROR_MESSAGES),
        packingSteps: extractStepErrors(issues, RECIPE_STEP_ERROR_MESSAGES, 'packingSteps'),
        conditioningSteps: extractStepErrors(
          issues,
          RECIPE_STEP_ERROR_MESSAGES,
          'conditioningSteps',
        ),
      });
      // R23: la validación previa rechazada tampoco invoca la operación, pero SÍ es un rechazo
      // que el usuario tiene que ver -no un silencio-, así que también alimenta la región de error
      // general con el código estable `invalid_input`, igual que si lo hubiera rechazado el
      // servidor.
      setSaveError({ status: 'error', code: INVALID_INPUT_CODE, message: INVALID_INPUT_MESSAGE });
      return;
    }

    setFieldErrors({});

    // Con versiones vivas no se guarda todavia: decide el aviso.
    if (props.mode === 'edit' && props.versions.length > 0) {
      setPendingPayload(parsed.data);
      return;
    }

    save(parsed.data, []);
  }

  function save(payload: ValidatedPayload, propagateToVersionIds: readonly string[]) {
    startTransition(async () => {
      const result =
        props.mode === 'edit'
          ? await updateRecipeAction(props.recipe.id, { ...payload, propagateToVersionIds })
          : await createRecipeAction(payload);

      if (result.status === 'error') {
        if (result.code === 'recipe_duplicate_name') {
          // `recipe_duplicate_name` SÍ identifica un campo (R23): junto al nombre, no en la región
          // general. Se pinta el `message` de la operación, nunca un texto propio (QC-70 R32).
          setFieldErrors((previous) => ({ ...previous, name: result.message }));
          return;
        }
        // El estado de la operacion, TAL CUAL: copiarlo campo a campo tiraba el identificador.
        setSaveError(result);
        return;
      }

      if (props.mode === 'edit' && 'propagated' in result) {
        const underReviewIds = new Set(
          result.propagated.filter((entry) => entry.isUnderReview).map((entry) => entry.versionId),
        );
        if (underReviewIds.size > 0) {
          // Se queda en la ficha: el usuario tiene que poder ir a revisar esas versiones.
          toast.success(SAVE_SUCCESS_EDIT);
          router.refresh();
          setUnderReview(
            props.versions
              .filter((version) => underReviewIds.has(version.id))
              .map((version) => ({ id: version.id, name: version.name })),
          );
          return;
        }
      }

      toast.success(isEdit ? SAVE_SUCCESS_EDIT : SAVE_SUCCESS_CREATE);
      router.push(FORMULAS_ROUTE);
      router.refresh();
    });
  }

  // Proyecta el estado actual del formulario, no lo guardado; el lector solo se monta con el
  // diálogo abierto, así que cerrarlo lo desmonta y se lleva lo marcado.
  const previewDialog = (
    <Dialog open={isPreviewOpen} onOpenChange={setPreviewOpen}>
      <DialogTrigger
        data-testid="recipe-form-preview-open"
        render={<Button type="button" variant="outline" ref={previewTriggerRef} touch />}
      >
        <EyeIcon aria-hidden />
        {PREVIEW_OPEN_LABEL}
      </DialogTrigger>
      <DialogContent
        data-testid="recipe-form-preview"
        className={PREVIEW_DIALOG_CLASS}
        finalFocus={previewTriggerRef}
        showCloseButton={false}
      >
        <div className="flex items-start justify-between gap-3 border-b px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 md:pt-5">
          <DialogHeader className="min-w-0 gap-1">
            <DialogTitle className="text-lg leading-snug font-semibold">{PREVIEW_TITLE}</DialogTitle>
            <DialogDescription>{PREVIEW_DESCRIPTION}</DialogDescription>
          </DialogHeader>
          <DialogClose
            data-testid="recipe-form-preview-close"
            render={
              <Button type="button" variant="ghost" size="icon" touch aria-label={PREVIEW_CLOSE_LABEL} />
            }
          >
            <XIcon aria-hidden />
          </DialogClose>
        </div>
        <div className="min-h-0 flex-1">
          {isPreviewOpen && (
            <StepReader
              steps={state.steps.map((step) => step.document)}
              onFinish={() => setPreviewOpen(false)}
              layout="panel"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div data-slot="recipe-form-layout" className="flex flex-col gap-5">
      <form
        id={formId}
        data-testid="recipe-form"
        className="flex min-w-0 flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        {saveError === null ? null : saveError.code === 'recipe_not_found' ? (
          <div role="alert" data-testid="recipe-form-not-found" className="rounded-lg border p-3 text-sm">
            <p data-testid="recipe-form-not-found-message">{saveError.message}</p>
            <Link href={FORMULAS_ROUTE} className="underline" data-testid="recipe-form-not-found-link">
              Volver a la lista
            </Link>
          </div>
        ) : (
          <ErrorAlert
            error={saveError}
            className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
            testId="recipe-form-error"
            renderCatalogued={(catalogued) => (
              <>
                <p data-testid="recipe-form-error-message">{catalogued.message}</p>
                {catalogued.code === INVALID_INPUT_CODE ? null : (
                  <p className="text-xs" data-testid="recipe-form-error-code">
                    {catalogued.code}
                  </p>
                )}
              </>
            )}
          />
        )}

        {stepsLocked ? (
          <Notice tone="warning" title={STEP_LOCK_TITLE(lockingOrders)} testId="recipe-form-steps-locked">
            {STEP_LOCK_BODY}
          </Notice>
        ) : null}

        {props.mode === 'edit' && underReview.length > 0 ? (
          <div
            role="status"
            className="flex flex-col gap-2 rounded-lg border p-3 text-sm"
            data-testid="recipe-form-under-review"
          >
            <p>{UNDER_REVIEW_MESSAGE}</p>
            <ul className="flex flex-col">
              {underReview.map((version) => (
                <li key={version.id}>
                  <Link
                    href={recipeVersionRoute(props.recipe.id, version.id)}
                    className={cn('inline-flex items-center underline', touchTarget)}
                    data-testid="recipe-form-under-review-link"
                  >
                    {version.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Card className={CARD_CLASS}>
          {/* La imagen manda a la izquierda (3 de 12) y los datos de texto la acompañan (9). */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-start">
            <div className="sm:col-span-3">
              <ImageField
                mode={props.mode}
                initialImageUrl={props.mode === 'edit' ? props.recipe.imageUrl : null}
                value={state.image}
                onChange={(image) => setState((previous) => ({ ...previous, image }))}
                maxBytes={MAX_IMAGE_BYTES}
                validate={validateRecipeImage}
                testIdPrefix="recipe-image"
              />
            </div>

            <div className="flex flex-col gap-4 sm:col-span-9">
              <div className="flex flex-col gap-1">
                <Label htmlFor="recipe-field-name-input">Nombre</Label>
                <Input
                  id="recipe-field-name-input"
                  type="text"
                  value={state.name}
                  onChange={(event) => setState((previous) => ({ ...previous, name: event.target.value }))}
                  className={`${touchTarget} ${FIELD_TEXT}`}
                  aria-invalid={fieldErrors.name === undefined ? undefined : true}
                  aria-describedby={fieldErrors.name === undefined ? undefined : 'recipe-error-name'}
                  data-testid="recipe-field-name"
                />
                {fieldErrors.name === undefined ? null : (
                  <p id="recipe-error-name" className="text-sm text-destructive" data-testid="recipe-error-name">
                    {fieldErrors.name}
                  </p>
                )}
            </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="recipe-field-description-input">Descripción</Label>
                <Textarea
                  id="recipe-field-description-input"
                  rows={4}
                  value={state.description}
                  onChange={(event) =>
                    setState((previous) => ({ ...previous, description: event.target.value }))
                  }
                  // `field-sizing-content` ignora `rows`: el alto mínimo deja ver tres líneas.
                  className={`min-h-24 ${FIELD_TEXT}`}
                  aria-invalid={fieldErrors.description === undefined ? undefined : true}
                  aria-describedby={fieldErrors.description === undefined ? undefined : 'recipe-error-description'}
                  data-testid="recipe-field-description"
                />
                {fieldErrors.description === undefined ? null : (
                  <p
                    id="recipe-error-description"
                    className="text-sm text-destructive"
                    data-testid="recipe-error-description"
                  >
                    {fieldErrors.description}
                  </p>
                )}
            </div>
            </div>
          </div>
        </Card>

        {props.versionList === undefined ? null : (
          // Un envío desde un diálogo de la lista sube por el árbol de React hasta el `onSubmit`
          // de la receta, aunque el diálogo esté en un portal.
          <div data-slot="recipe-form-versions" onSubmit={(event) => event.stopPropagation()}>
            {props.versionList}
          </div>
        )}

        <Card className={CARD_CLASS}>
          <RecipeLinesField
            lines={state.lines}
            onChange={(lines) => setState((previous) => ({ ...previous, lines }))}
            tools={state.tools}
            onToolsChange={(tools) => setState((previous) => ({ ...previous, tools }))}
            units={props.units}
            initialProductPage={props.initialProductPage}
            initialMachinePage={props.initialMachinePage}
            errors={fieldErrors.lines}
            generalError={fieldErrors.linesGeneral}
            toolErrors={fieldErrors.tools}
            toolsGeneralError={fieldErrors.toolsGeneral}
          />
        </Card>

        <Card className={CARD_CLASS}>
          <RecipeStepsField
            steps={state.steps}
            onChange={(steps) => setState((previous) => ({ ...previous, steps }))}
            errors={fieldErrors.steps}
            showEvidenceSwitch
            locked={stepsLocked}
          />
        </Card>

        <Card className={CARD_CLASS}>
          <RecipeStepsField
            steps={state.packingSteps}
            onChange={(packingSteps) => setState((previous) => ({ ...previous, packingSteps }))}
            errors={fieldErrors.packingSteps}
            title={PACKING_STEPS_FIELD_TEXTS.title}
            optionalHelp={{
              text: PACKING_STEPS_FIELD_TEXTS.optionalHelp,
              label: PACKING_STEPS_FIELD_TEXTS.optionalHelpLabel,
            }}
            sectionName={PACKING_STEPS_FIELD_TEXTS.sectionName}
            testIdPrefix={PACKING_STEPS_TESTID_PREFIX}
            showEvidenceSwitch
            locked={stepsLocked}
          />
        </Card>

        <Card className={CARD_CLASS}>
          <RecipeStepsField
            steps={state.conditioningSteps}
            onChange={(conditioningSteps) =>
              setState((previous) => ({ ...previous, conditioningSteps }))
            }
            errors={fieldErrors.conditioningSteps}
            title={CONDITIONING_STEPS_FIELD_TEXTS.title}
            optionalDescription={CONDITIONING_STEPS_FIELD_TEXTS.help}
            testIdPrefix={CONDITIONING_STEPS_TESTID_PREFIX}
            showEvidenceSwitch
            showAssignmentSwitch
            locked={stepsLocked}
          />
        </Card>

        {props.mode === 'edit' && props.versions.length > 0 ? (
          <PropagateVersionsDialog
            open={pendingPayload !== null}
            versions={props.versions}
            onOpenChange={(open) => {
              if (!open) setPendingPayload(null);
            }}
            onSave={(propagateToVersionIds) => {
              if (pendingPayload === null) return;
              setPendingPayload(null);
              save(pendingPayload, propagateToVersionIds);
            }}
          />
        ) : null}
      </form>

      <FormFooterBar
        testId="recipe-form-footer"
        leading={
          <>
            {previewDialog}
            {props.newVersionAction}
          </>
        }
      >
        <Link
          href={FORMULAS_ROUTE}
          data-slot="button"
          data-testid="recipe-form-cancel"
          className={cn(buttonVariants({ variant: 'outline', touch: true }))}
        >
          Cancelar
        </Link>
        {/* Fuera del `<form>`: `form` lo asocia y sigue siendo el botón por defecto del Enter. */}
        <Button
          type="submit"
          form={formId}
          touch
          disabled={isPending || !canSubmit}
          aria-busy={isPending}
          data-testid="recipe-form-submit"
        >
          {isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </FormFooterBar>
    </div>
  );
}
