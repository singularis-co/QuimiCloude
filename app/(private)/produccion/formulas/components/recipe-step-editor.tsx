'use client';

import { EditorContent, useEditor, useEditorState, type Content } from '@tiptap/react';
import { BoldIcon, CameraIcon, CheckIcon, ItalicIcon, ListChecksIcon } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { Switch } from '@/components/ui/switch';
import {
  MAX_STEP_ELEMENTS,
  countRecipeStepElements,
  type RecipeStepDocument,
} from '@/lib/modules/recetas';
import { touchTarget } from '@/lib/shared/ui/touch-target';

import { editorJsonToStepDocument, stepDocumentToEditorJson } from './recipe-step-document';
import { RECIPE_STEP_EXTENSIONS } from './recipe-step-schema';

/**
 * Editor de UN paso de receta (QC-64 T6, `design.md > 3`, `> 7`, `> 8`; R2, R3, R6, R7, R8, R26,
 * R27).
 *
 * Junto con `recipe-step-schema.ts` es **uno de los dos unicos archivos del repo que importan la
 * libreria del editor** (R25, `design.md > 7`): cambiar de editor es reescribir estos dos y el
 * mapeo, no buscar `@tiptap` por todo el arbol. Una guardia de fuente lo hace cumplir.
 *
 * **No conoce el contrato mas que por sus tipos y sus utilidades publicas**: convierte con
 * `stepDocumentToEditorJson` al montar y con `editorJsonToStepDocument` en cada cambio, y el aviso
 * de tope lo calcula con `countRecipeStepElements` / `MAX_STEP_ELEMENTS` del modulo. Aqui no se
 * reescribe ni el numero ni la aritmetica (R7).
 *
 * **Sin ningun tope de caracteres (R8)**: no hay `maxLength`, ni recorte, ni contador que impida
 * escribir. Un test afirma sobre el fuente y sobre el DOM que no aparece.
 *
 * **Barra de formato SIEMPRE visible (R26)**: tres `<button>` reales, nunca una barra flotante que
 * asoma al pasar el raton sobre la seleccion —en tactil no hay `:hover` y esa barra no existiria—.
 */

/**
 * Textos de la interfaz en UNA constante, para que la i18n futura sea sustituirla. No se aceptan
 * por props: la barra de formato es la misma en todos los pasos.
 */
const TEXTS = {
  bold: 'Negrilla',
  italic: 'Cursiva',
  checklist: 'Lista de verificacion',
  toolbar: 'Formato del paso',
  requiresEvidence: 'Requiere evidencia',
  evidenceHelp: 'Al ejecutar, este paso pide de 1 a 3 fotos antes de avanzar.',
  tooManyElements: (count: number, max: number) =>
    `Este paso tiene ${count} elementos y el maximo es ${max}. Quita elementos antes de guardar.`,
} as const;

export type RecipeStepEditorProps = {
  readonly document: RecipeStepDocument;
  readonly onChange: (document: RecipeStepDocument) => void;
  /** Nombre accesible del area editable, por ejemplo «Paso 1». */
  readonly label: string;
  /** `data-testid` del area editable; lo decide quien monta el editor, que sabe su posicion. */
  readonly editableTestId: string;
  readonly error?: string;
  readonly errorId?: string;
  /** Sin ella no se pinta el interruptor «Requiere evidencia». */
  readonly evidence?: RecipeStepEvidenceControl;
  /** Botones de la fila (añadir, quitar), en el mismo grupo que el interruptor. */
  readonly actions?: ReactNode;
};

export type RecipeStepEvidenceControl = {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  /** Nombre accesible del interruptor, por ejemplo «Requiere evidencia en el paso 1». */
  readonly label: string;
};

/** Lo que la barra necesita de la seleccion. Se lee del editor; no se duplica en un `useState`. */
type ToolbarState = {
  readonly bold: boolean;
  readonly italic: boolean;
  readonly checklist: boolean;
};

const TOOLBAR_STATE_INICIAL: ToolbarState = { bold: false, italic: false, checklist: false };

export function RecipeStepEditor({
  document: stepDocument,
  onChange,
  label,
  editableTestId,
  error,
  errorId,
  evidence,
  actions,
}: RecipeStepEditorProps) {
  const warningId = useId();
  const evidenceHelpId = useId();
  const evidenceOn = evidence?.checked === true;

  // `onChange` puede cambiar de identidad en cada render del formulario, pero el editor se crea
  // UNA vez: sin esta referencia, `onUpdate` se quedaria con la primera version para siempre.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: RECIPE_STEP_EXTENSIONS,
    // El contrato SIEMPRE tiene representacion en el editor: `stepDocumentToEditorJson` es total.
    //
    // La conversion declarada es DELIBERADA y vive aqui a proposito: `recipe-step-document.ts`
    // devuelve `unknown` para no importar un solo tipo de `@tiptap/*` —es lo que permite que el
    // mapeo sobreviva a un cambio de editor (`design.md > 7`)—, asi que el unico sitio donde ese
    // JSON se declara como contenido de ESTA libreria es este archivo, que ya la importa.
    content: stepDocumentToEditorJson(stepDocument) as Content,
    // Next renderiza en el servidor: crear el editor en el primer render romperia la hidratacion.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        // `text-base` = 16 px: por debajo, iOS hace zoom al enfocar el area editable (R26).
        class:
          'min-h-11 w-full rounded-b-lg px-3 py-2.5 text-base leading-normal outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50 [&_ul]:list-none [&_li]:flex [&_li]:items-start [&_li]:gap-2 [&_li>div]:flex-1',
        'aria-label': label,
        'aria-multiline': 'true',
        'data-testid': editableTestId,
      },
    },
    onUpdate({ editor: instance }) {
      onChangeRef.current(editorJsonToStepDocument(instance.getJSON()));
    },
  });

  // La barra se repinta cuando cambian la seleccion o el documento, que es lo que `aria-pressed`
  // tiene que reflejar (R27). `useEditorState` re-renderiza SOLO si el resultado cambio.
  const toolbar = useEditorState({
    editor,
    selector: ({ editor: instance }): ToolbarState =>
      instance === null
        ? TOOLBAR_STATE_INICIAL
        : {
            bold: instance.isActive('bold'),
            italic: instance.isActive('italic'),
            checklist: instance.isActive('taskList'),
          },
  });
  const estado = toolbar ?? TOOLBAR_STATE_INICIAL;

  // R7: el aviso se calcula sobre el documento del CONTRATO y esta en pantalla mientras se
  // escribe, o sea ANTES de invocar el guardado; no despues de que el servidor lo rechace.
  const elementos = countRecipeStepElements(stepDocument);
  const excedeElTope = elementos > MAX_STEP_ELEMENTS;

  const describedBy =
    [
      errorId !== undefined && error !== undefined ? errorId : null,
      excedeElTope ? warningId : null,
    ]
      .filter((id): id is string => id !== null)
      .join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1" data-testid={`${editableTestId}-editor`}>
      <div className="rounded-lg border border-input bg-card">
        {/* La barra ofrece tres acciones y ninguna más: ni encabezados, enlaces, imágenes, tablas,
            citas, listas numeradas ni bloques de código. */}
        <div
          className="flex flex-wrap items-center gap-1 rounded-t-lg border-b bg-muted p-1"
          data-testid={`${editableTestId}-bar`}
        >
          <div
            role="toolbar"
            aria-label={TEXTS.toolbar}
            aria-orientation="horizontal"
            className="flex flex-wrap gap-0.5"
            data-testid={`${editableTestId}-toolbar`}
          >
            <ToolbarButton
              label={TEXTS.bold}
              pressed={estado.bold}
              testId={`${editableTestId}-bold`}
              onActivate={() => editor?.chain().focus().toggleBold().run()}
            >
              <BoldIcon aria-hidden="true" className="size-4" />
            </ToolbarButton>
            <ToolbarButton
              label={TEXTS.italic}
              pressed={estado.italic}
              testId={`${editableTestId}-italic`}
              onActivate={() => editor?.chain().focus().toggleItalic().run()}
            >
              <ItalicIcon aria-hidden="true" className="size-4" />
            </ToolbarButton>
            <ToolbarButton
              label={TEXTS.checklist}
              pressed={estado.checklist}
              testId={`${editableTestId}-checklist`}
              onActivate={() => editor?.chain().focus().toggleTaskList().run()}
            >
              <ListChecksIcon aria-hidden="true" className="size-4" />
            </ToolbarButton>
          </div>
          {evidence === undefined && actions === undefined ? null : (
            // En teléfono el interruptor baja a su propia línea; desde md se alinea a la derecha.
            <div
              className="flex w-full items-center gap-1 md:ml-auto md:w-auto"
              data-testid={`${editableTestId}-row-tools`}
            >
              {evidence === undefined ? null : (
                <Switch
                  checked={evidenceOn}
                  onCheckedChange={(checked) => evidence.onCheckedChange(checked)}
                  aria-label={evidence.label}
                  aria-describedby={evidenceOn ? evidenceHelpId : undefined}
                  data-testid={`${editableTestId}-evidence`}
                >
                  <CameraIcon aria-hidden="true" className="size-4" />
                  {TEXTS.requiresEvidence}
                </Switch>
              )}
              {actions === undefined ? null : <div className="ml-auto flex gap-1">{actions}</div>}
            </div>
          )}
        </div>

        <EditorContent
          editor={editor}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={describedBy}
        />

        {evidenceOn ? (
          <p
            id={evidenceHelpId}
            className="flex animate-in items-center gap-1.5 px-3 pb-2.5 text-xs text-primary duration-(--dur-slow) ease-(--ease-enter) fade-in slide-in-from-bottom-[10px]"
            data-testid={`${editableTestId}-evidence-help`}
          >
            <CheckIcon aria-hidden="true" className="size-4 shrink-0" />
            {TEXTS.evidenceHelp}
          </p>
        ) : null}
      </div>

      {excedeElTope && (
        <p
          id={warningId}
          className="text-sm text-destructive"
          data-testid={`${editableTestId}-limit`}
        >
          {TEXTS.tooManyElements(elementos, MAX_STEP_ELEMENTS)}
        </p>
      )}
    </div>
  );
}

type ToolbarButtonProps = {
  readonly label: string;
  readonly pressed: boolean;
  readonly testId: string;
  readonly onActivate: () => void;
  readonly children: ReactNode;
};

/**
 * Boton de la barra: `<button type="button">` REAL —no un `div` con `onClick`—, en el orden
 * natural del tabulador y activable con `Enter`/`Espacio` sin raton (R27), de 44x44 px como minimo
 * y SIEMPRE visible (R26). `aria-pressed` dice si la marca o el nodo esta activo en la seleccion.
 */
function ToolbarButton({ label, pressed, testId, onActivate, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      data-testid={testId}
      onClick={onActivate}
      className={`${touchTarget} flex items-center justify-center rounded-md text-foreground transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring ${
        pressed ? 'bg-card' : 'bg-transparent'
      }`}
    >
      {children}
    </button>
  );
}
