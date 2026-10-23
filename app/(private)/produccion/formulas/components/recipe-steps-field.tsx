'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDndContext,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CircleAlertIcon, GripVerticalIcon, PlusIcon, XIcon } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ConditioningStepInput, RecipeStepDocument } from '@/lib/modules/recetas';
import { touchTarget } from '@/lib/shared/ui/touch-target';

import {
  createLocalKey,
  isStepDocumentEmpty,
  type RecipeStepErrorMessages,
  type RecipeStepErrors,
  type RecipeStepFormValue,
} from './recipe-form-state';
import { RecipeStepEditor } from './recipe-step-editor';

/**
 * Campo de pasos, con arrastre y equivalente por teclado (T17, R32-R34; `design.md > 7`, `> 10`).
 *
 * **ÚNICO archivo de toda la feature que importa `@dnd-kit/*`** (excepción aprobada, R45): la
 * salida a `@atlaskit/pragmatic-drag-and-drop` -si el riesgo del check 2 se materializa- se
 * limita a reescribir este archivo. Una guardia de fuente confirma que ningún otro lo importa.
 *
 * **`KeyboardSensor` con `sortableKeyboardCoordinates`** (R34): con `Tab` se alcanza el asa, con
 * `Espacio` se toma el paso, con las flechas se mueve y con `Espacio` se suelta -MISMO
 * `onDragEnd` que el arrastre con ratón-. **`PointerSensor` con `activationConstraint: {distance:
 * 8}`** (R50) para que un toque que solo quiere hacer scroll no dispare el arrastre en móvil.
 *
 * **El asa es un `<button>` real** con nombre accesible que incluye la posición actual
 * (`Arrastrar el paso 2 de 4`), **≥ 44×44 px y SIEMPRE visible** -nada detrás de `:hover`, que en
 * táctil no existe (R50)-. Los `announcements` de `DndContext` anuncian el cambio de posición a
 * la tecnología de asistencia (R34).
 *
 * **QC-64 T7 (R1, R24)**: el campo de cada paso ya no es un `<Input>` de texto plano, es
 * `RecipeStepEditor` -el editor enriquecido de esquema cerrado-, y el estado del paso es EL
 * DOCUMENTO del contrato. Del arrastre no se ha tocado nada: ni el asa, ni `useSortable`, ni los
 * sensores, ni `handleDragEnd`, ni los `announcements`. Los dos teclados NO se pisan porque los
 * `listeners` del `KeyboardSensor` viven SOLO en el `<button>` del asa: escribir dentro del área
 * editable no llega al sensor y no inicia ningún arrastre (`design.md > 8`).
 *
 * Este archivo NO importa la librería del editor (`design.md > 7`): monta el componente que la
 * aísla y habla con él en documentos del contrato.
 */

/**
 * Documento de un paso RECIEN AÑADIDO: un solo parrafo SIN fragmentos (QC-64 R4). No es `{blocks:
 * []}` -un documento sin bloques no tiene donde escribir- ni `text: ''`, que ya no existe.
 *
 * Es una FUNCION y no una constante compartida a proposito: cada paso nuevo se lleva su propio
 * objeto, asi que editar uno no puede tocar el documento de otro por alias.
 */
function emptyStepDocument(): RecipeStepDocument {
  return { blocks: [{ kind: 'paragraph', spans: [] }] };
}

export { isStepDocumentEmpty };

/** Título y ayuda de la sección de envasado; los comparten el alta, la edición y la importación. */
/**
 * Textos propios para los issues de forma de zod sobre un paso: el genérico de zod sale en inglés.
 * Los que escribe el esquema («Un paso no puede quedar vacio.», el ítem vacío, el tope de
 * elementos) pasan tal cual (`recipe-form-state.ts`).
 */
export const RECIPE_STEP_ERROR_MESSAGES: RecipeStepErrorMessages = {
  checklistWithoutItems: 'Una lista de verificación necesita al menos un ítem.',
  invalid: 'Revisa el contenido de este paso.',
};

export const PACKING_STEPS_FIELD_TEXTS = {
  title: 'Pasos de envasado',
  optionalHelp:
    'Opcional. Pasos que sigue el empacador uno a uno al empacar el pedido.',
  optionalHelpLabel: 'Qué son los pasos de envasado',
  sectionName: 'Envasado',
} as const;

export const CONDITIONING_STEPS_FIELD_TEXTS = {
  title: 'Acondicionamiento',
  help: 'Opcional. Pasos que sigue el acondicionador uno a uno al acondicionar el pedido. «Asignación requerida» le pide elegir quién del equipo hizo el paso.',
} as const;

const FIELD_TEXTS = {
  optional: '(opcional)',
  addAfter: (position: number) => `Añadir un paso después del ${position}`,
  remove: (position: number) => `Quitar paso ${position}`,
} as const;

const CARD_TRANSITION = 'box-shadow 200ms, border-color 200ms, scale 200ms';

const EVIDENCE_TEXTS = {
  summary: (count: number) =>
    count === 0
      ? 'Ningún paso pide evidencia'
      : count === 1
        ? '1 paso pide evidencia'
        : `${count} pasos piden evidencia`,
  switchLabel: (position: number, section: string) =>
    `Requiere evidencia en el paso ${position} de ${section}`,
  lockedHandle: (position: number) =>
    `No se puede mover el paso ${position}: hay pedidos en curso con fotos`,
  lockedRemove: (position: number) =>
    `No se puede quitar el paso ${position}: hay pedidos en curso con fotos`,
} as const;

const ASSIGNMENT_TEXTS = {
  switchLabel: (position: number, section: string) =>
    `Asignación requerida en el paso ${position} de ${section}`,
} as const;

const SECTION_SUMMARY_TEXTS = {
  steps: (count: number) => (count === 1 ? '1 paso' : `${count} pasos`),
  evidence: (count: number) => (count === 1 ? '1 pide evidencia' : `${count} piden evidencia`),
  assignment: (count: number) =>
    count === 1 ? '1 pide responsables' : `${count} piden responsables`,
  separator: ' · ',
} as const;

type StepMarks = { readonly evidence: boolean; readonly assignment: boolean };

function marksOf(document: ConditioningStepInput): StepMarks {
  return {
    evidence: document.requiresEvidence === true,
    assignment: document.requiresAssignment === true,
  };
}

/**
 * El editor devuelve solo el contenido del paso; las marcas se copian aparte para que escribir no
 * las apague. Apagada, la clave desaparece: el JSON de una fórmula que nunca la usó no cambia.
 */
function withMarks(document: RecipeStepDocument, marks: StepMarks): ConditioningStepInput {
  const next: ConditioningStepInput = { ...document };
  if (marks.evidence) next.requiresEvidence = true;
  else delete next.requiresEvidence;
  if (marks.assignment) next.requiresAssignment = true;
  else delete next.requiresAssignment;
  return next;
}

function sectionSummary(steps: number, evidence: number, assignment: number): string {
  return [
    steps === 0 ? null : SECTION_SUMMARY_TEXTS.steps(steps),
    evidence === 0 ? null : SECTION_SUMMARY_TEXTS.evidence(evidence),
    assignment === 0 ? null : SECTION_SUMMARY_TEXTS.assignment(assignment),
  ]
    .filter((part): part is string => part !== null)
    .join(SECTION_SUMMARY_TEXTS.separator);
}

export type RecipeStepsFieldProps = {
  readonly steps: readonly RecipeStepFormValue[];
  readonly onChange: (steps: readonly RecipeStepFormValue[]) => void;
  readonly errors?: RecipeStepErrors;
  readonly title?: string;
  /** Nombre de la sección en el nombre accesible de cada interruptor; por defecto, `title`. */
  readonly sectionName?: string;
  /** Marca la sección como opcional junto al título y explica para qué sirve en un tooltip. */
  readonly optionalHelp?: { readonly text: string; readonly label: string };
  /** Marca la sección como opcional y pinta la ayuda como texto visible bajo el título. */
  readonly optionalDescription?: string;
  /** Raiz de los `data-testid` y de los `id` de error: dos instancias en la misma pagina no
   *  deben colisionar. */
  readonly testIdPrefix?: string;
  /** Pinta el interruptor «Requiere evidencia» en cada paso y el resumen de la lista. */
  readonly showEvidenceSwitch?: boolean;
  /** Pinta el interruptor «Asignación requerida» en cada paso y lo cuenta en el resumen. */
  readonly showAssignmentSwitch?: boolean;
  /** Deshabilita mover y quitar pasos; editar el texto y la marca siguen activos, y añadir solo
   *  al final (añadir se apaga mientras haya un paso vacío, con o sin `locked`). */
  readonly locked?: boolean;
};

/**
 * Anuncios de `aria-live` del cambio de posición (R34). `dnd-kit` solo entrega el `id` del paso
 * activo/objetivo -nunca su texto-, así que el mensaje habla de POSICIONES, no de contenido.
 */
function buildAnnouncements(steps: readonly RecipeStepFormValue[]): Announcements {
  const positionOf = (id: string | number): number =>
    steps.findIndex((step) => step.key === id) + 1;

  return {
    onDragStart({ active }) {
      return `Se tomó el paso en la posición ${positionOf(active.id)} de ${steps.length}.`;
    },
    onDragOver({ over }) {
      if (over === null) return undefined;
      return `El paso se movería a la posición ${positionOf(over.id)} de ${steps.length}.`;
    },
    onDragEnd({ active, over }) {
      if (over === null) {
        return `El arrastre se canceló. El paso sigue en la posición ${positionOf(active.id)}.`;
      }
      return `El paso se soltó en la posición ${positionOf(over.id)} de ${steps.length}.`;
    },
    onDragCancel({ active }) {
      return `Se canceló el arrastre. El paso sigue en la posición ${positionOf(active.id)}.`;
    },
  };
}

export function RecipeStepsField({
  steps,
  onChange,
  errors,
  title = 'Pasos de producción',
  sectionName = title,
  optionalHelp,
  optionalDescription,
  testIdPrefix = 'recipe-step',
  showEvidenceSwitch = false,
  showAssignmentSwitch = false,
  locked = false,
}: RecipeStepsFieldProps) {
  const headingId = useId();
  // La fila en blanco de arranque vive fuera de `steps` hasta que se escribe en ella, como la de
  // ingredientes. Al materializarse se queda con esta clave para que el editor no se remonte y
  // conserve el foco; la siguiente fila en blanco estrena otra.
  const [ghostKey, setGhostKey] = useState(() => createLocalKey('step'));
  const isGhost = steps.length === 0;
  const rows: readonly RecipeStepFormValue[] = isGhost
    ? [{ key: ghostKey, document: emptyStepDocument() }]
    : steps;
  const evidenceCount = steps.filter((step) => step.document.requiresEvidence === true).length;
  const assignmentCount = steps.filter((step) => marksOf(step.document).assignment).length;
  const isOptional = optionalHelp !== undefined || optionalDescription !== undefined;
  // Con algún paso vacío no se añade otro: primero se rellena el que ya está.
  const canAddStep = !rows.some((step) => isStepDocumentEmpty(step.document));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function blankStep(): RecipeStepFormValue {
    return { key: createLocalKey('step'), document: emptyStepDocument() };
  }

  function addStepAfter(index: number) {
    if (isGhost) {
      setGhostKey(createLocalKey('step'));
      onChange([{ key: ghostKey, document: emptyStepDocument() }, blankStep()]);
      return;
    }
    onChange([...steps.slice(0, index + 1), blankStep(), ...steps.slice(index + 1)]);
  }

  function updateStep(index: number, patch: Partial<RecipeStepFormValue>) {
    if (isGhost) {
      setGhostKey(createLocalKey('step'));
      onChange([{ key: ghostKey, document: emptyStepDocument(), ...patch }]);
      return;
    }
    onChange(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  function removeStep(index: number) {
    // La fila en blanco no está en `steps`: quitarla no deja la sección sin filas.
    if (isGhost) return;
    onChange(steps.filter((_, i) => i !== index));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over === null || active.id === over.id) return;
    const oldIndex = steps.findIndex((step) => step.key === active.id);
    const newIndex = steps.findIndex((step) => step.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    // MISMO `onDragEnd` para ratón y teclado (R34): dnd-kit dispara este manejador sea cual sea
    // el sensor que originó el arrastre.
    onChange(arrayMove([...steps], oldIndex, newIndex));
  }

  return (
    <section
      aria-labelledby={headingId}
      data-testid={`${testIdPrefix}s-field`}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <h2 id={headingId} className="text-lg font-medium">
            {title}
            {!isOptional ? null : (
              <span
                className="ml-1 text-sm font-normal text-muted-foreground"
                data-testid={`${testIdPrefix}s-optional`}
              >
                {FIELD_TEXTS.optional}
              </span>
            )}
          </h2>
          {optionalHelp === undefined ? null : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={optionalHelp.label}
                    className={`flex ${touchTarget} shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring`}
                    data-testid={`${testIdPrefix}s-help`}
                  />
                }
              >
                <CircleAlertIcon aria-hidden="true" className="size-4" />
              </TooltipTrigger>
              <TooltipContent data-testid={`${testIdPrefix}s-help-text`}>
                {optionalHelp.text}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {showEvidenceSwitch ? (
          <p
            className="text-xs text-muted-foreground"
            data-testid={`${testIdPrefix}-evidence-summary`}
          >
            {showAssignmentSwitch
              ? sectionSummary(rows.length, evidenceCount, assignmentCount)
              : EVIDENCE_TEXTS.summary(evidenceCount)}
          </p>
        ) : null}
        {optionalDescription === undefined ? null : (
          <p className="text-sm text-muted-foreground" data-testid={`${testIdPrefix}s-description`}>
            {optionalDescription}
          </p>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ announcements: buildAnnouncements(rows) }}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={rows.map((step) => step.key)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-2" data-testid={`${testIdPrefix}s-list`}>
            {rows.map((step, index) => (
              <RecipeStepRow
                key={step.key}
                step={step}
                index={index}
                total={rows.length}
                testIdPrefix={testIdPrefix}
                error={errors?.[index]}
                sectionName={sectionName}
                showEvidenceSwitch={showEvidenceSwitch}
                showAssignmentSwitch={showAssignmentSwitch}
                locked={locked}
                // Bloqueado solo se añade al final: insertar en medio movería los pasos siguientes.
                canAdd={canAddStep && (!locked || index === rows.length - 1)}
                onAdd={() => addStepAfter(index)}
                onChangeDocument={(document) =>
                  updateStep(index, { document: withMarks(document, marksOf(step.document)) })
                }
                onChangeEvidence={(on) =>
                  updateStep(index, {
                    document: withMarks(step.document, { ...marksOf(step.document), evidence: on }),
                  })
                }
                onChangeAssignment={(on) =>
                  updateStep(index, {
                    document: withMarks(step.document, { ...marksOf(step.document), assignment: on }),
                  })
                }
                onRemove={() => removeStep(index)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </section>
  );
}

type RecipeStepRowProps = {
  readonly step: RecipeStepFormValue;
  readonly index: number;
  readonly total: number;
  readonly testIdPrefix: string;
  readonly error?: string;
  readonly sectionName: string;
  readonly showEvidenceSwitch: boolean;
  readonly showAssignmentSwitch: boolean;
  readonly locked: boolean;
  readonly canAdd: boolean;
  readonly onAdd: () => void;
  readonly onChangeDocument: (document: RecipeStepDocument) => void;
  readonly onChangeEvidence: (on: boolean) => void;
  readonly onChangeAssignment: (on: boolean) => void;
  readonly onRemove: () => void;
};

function RecipeStepRow({
  step,
  index,
  total,
  testIdPrefix,
  error,
  sectionName,
  showEvidenceSwitch,
  showAssignmentSwitch,
  locked,
  canAdd,
  onAdd,
  onChangeDocument,
  onChangeEvidence,
  onChangeAssignment,
  onRemove,
}: RecipeStepRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.key,
    disabled: locked,
  });
  const { active } = useDndContext();
  const evidenceOn = showEvidenceSwitch && step.document.requiresEvidence === true;
  const assignmentOn = showAssignmentSwitch && marksOf(step.document).assignment;
  const lifted = !locked && isDragging;
  const dropTarget = !locked && !isDragging && active !== null;
  // El estilo en línea de dnd-kit pisaría la transición de la clase mientras se reordena.
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition === undefined ? undefined : `${transition}, ${CARD_TRANSITION}`,
  };
  const errorId = `${testIdPrefix}-error-${index}`;
  const stateClass = lifted
    ? 'z-10 border-primary shadow-lg scale-[1.01] motion-reduce:scale-100'
    : dropTarget
      ? 'border-dashed border-primary'
      : evidenceOn || assignmentOn
        ? 'border-[color-mix(in_oklch,var(--primary)_45%,var(--border))]'
        : '';

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={`${testIdPrefix}-row`}
      data-dragging={lifted ? 'true' : undefined}
      data-drop-target={dropTarget ? 'true' : undefined}
      className={`relative grid grid-cols-[44px_minmax(0,1fr)] items-start gap-2.5 rounded-xl border bg-card p-3 transition-[box-shadow,border-color,scale] duration-200 ${stateClass}`}
    >
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={`${touchTarget} flex shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50`}
          disabled={locked}
          aria-label={
            locked
              ? EVIDENCE_TEXTS.lockedHandle(index + 1)
              : `Arrastrar el paso en la posición ${index + 1} de ${total}`
          }
          data-testid={`${testIdPrefix}-handle-${index}`}
        >
          <GripVerticalIcon aria-hidden="true" />
        </button>
        {/* Oculto a lectores: la posición ya va en el nombre del asa. */}
        <span
          aria-hidden="true"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[13px] font-semibold"
          data-testid={`${testIdPrefix}-number-${index}`}
        >
          {index + 1}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        {/* El NOMBRE ACCESIBLE del area editable sigue siendo «Paso N», el mismo que daba la
            etiqueta del campo de texto de QC-26. Ahora viaja por la prop `label` del editor, que
            lo pone como `aria-label` sobre el `contenteditable`, y no por una etiqueta con
            `htmlFor`: una etiqueta de formulario no puede asociarse a un `contenteditable` -que
            no es un control de formulario-, y renderizar las dos cosas daria DOS nombres
            accesibles para el mismo elemento.

            El `data-testid` del area editable se CONSERVA (`recipe-step-text-N`, R24): el E2E
            heredado de QC-26 escribe por ese testid y `fill()` funciona sobre `contenteditable`. */}
        <RecipeStepEditor
          document={step.document}
          onChange={onChangeDocument}
          label={`Paso ${index + 1}`}
          editableTestId={`${testIdPrefix}-text-${index}`}
          error={error}
          errorId={errorId}
          evidence={
            showEvidenceSwitch
              ? {
                  checked: evidenceOn,
                  onCheckedChange: onChangeEvidence,
                  label: EVIDENCE_TEXTS.switchLabel(index + 1, sectionName),
                }
              : undefined
          }
          assignment={
            showAssignmentSwitch
              ? {
                  checked: assignmentOn,
                  onCheckedChange: onChangeAssignment,
                  label: ASSIGNMENT_TEXTS.switchLabel(index + 1, sectionName),
                }
              : undefined
          }
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                touch
                disabled={locked}
                aria-label={
                  locked ? EVIDENCE_TEXTS.lockedRemove(index + 1) : FIELD_TEXTS.remove(index + 1)
                }
                data-testid={`${testIdPrefix}-remove-${index}`}
                onClick={onRemove}
              >
                <XIcon aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                touch
                disabled={!canAdd}
                aria-label={FIELD_TEXTS.addAfter(index + 1)}
                data-testid={`${testIdPrefix}-add-${index}`}
                onClick={onAdd}
              >
                <PlusIcon aria-hidden />
              </Button>
            </>
          }
        />
        {error === undefined ? null : (
          <p id={errorId} className="text-sm text-destructive" data-testid={`${testIdPrefix}-field-error-${index}`}>
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
