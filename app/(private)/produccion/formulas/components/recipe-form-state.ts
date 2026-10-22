import type { ZodIssue } from 'zod';

// Solo el tipo: se borra al compilar, asi que este archivo sigue sin arrastrar React.
import type { ImageFieldState } from '@/components/shared/image-field';

import {
  formatPercentage,
  type ConditioningStepInput,
  type RecipeLineView,
  type RecipeStepDocument,
  type RecipeToolView,
} from '@/lib/modules/recetas';

/**
 * Tipos del estado del formulario de receta y el armado de su payload (T13, R22, R29, R32, R35,
 * R36; `design.md > 5`, `> 8`).
 *
 * **Archivo SIN React y SIN DOM a propósito**: es lo que `buildRecipePayload` necesita para ser
 * puro y testeable sin montar nada (`tasks.md > T13`). `recipe-form.tsx` es quien lo usa dentro de
 * React; este archivo no sabe que React existe.
 */

/** Modo del formulario: determina qué esquema del contrato valida el payload. */
export type RecipeFormMode = 'create' | 'edit';

export type { ImageFieldState };

/**
 * Línea de producto tal como vive en el ESTADO del formulario (no el payload que se envía).
 *
 * `key` es una clave LOCAL de React para la lista -nunca el `id` de la línea que devuelve el
 * backend-: el esquema de recetas no admite ids de línea (`design.md > 6`).
 *
 * `productName` tiene TRES lecturas posibles y es el único discriminante disponible (R53, R54):
 * - `''` (cadena vacía): línea nueva, el usuario todavía no eligió producto.
 * - una cadena no vacía: producto elegido y disponible.
 * - `null`: la línea vino de la precarga de edición con un producto DADO DE BAJA (R21, R53). Dejar
 *   de estar marcada es automático: en cuanto el usuario elige otro producto por el selector,
 *   `productName` pasa a la cadena elegida y ya no es `null`.
 *
 * **Sin unidad propia**: la línea ya no lleva `unitId` ni un selector que lo pida. `percentage`
 * es LO QUE EL USUARIO ESCRIBIO, con coma si la usó -`buildRecipePayload` es quien la sustituye por
 * un punto, sin pasar nunca por `number`-.
 */
export type RecipeLineFormValue = {
  readonly key: string;
  readonly productId: string;
  readonly productName: string | null;
  readonly percentage: string;
  /**
   * Unidad del INGREDIENTE elegido (no de la línea, que ya no tiene una), o `null` si no se
   * sabe -sin lotes o dado de baja-. Es de PRESENTACION pura, para mostrar «nombre ·
   * unidad» junto al ingrediente elegido; `buildRecipePayload` la descarta igual que `key`
   * y `productName`, porque el contrato de receta no la declara.
   */
  readonly productUnitId: string | null;
};

/**
 * Paso del formulario, con su clave local de React (mismo motivo que en `RecipeLineFormValue`).
 *
 * `document` es EL DOCUMENTO DEL CONTRATO tal cual (QC-64 R1, R5; `design.md > 4`), no una
 * proyeccion a texto plano: el estado del formulario guarda exactamente lo que se va a enviar,
 * con sus parrafos, sus marcas y sus listas de verificacion. El paso tampoco tiene `type`
 * -desaparecio del contrato (QC-62 R9, decision cerrada 2)-.
 *
 * Aqui NO hay conversion: quien traduce entre el editor y esta forma es
 * `recipe-step-document.ts`, y lo hace dentro del editor. El puente de texto plano de QC-62 R19
 * (`textToStepDocument` / `stepDocumentToText`) se RETIRO con esta feature.
 */
export type RecipeStepFormValue = {
  readonly key: string;
  readonly document: RecipeStepDocument;
};

/**
 * Herramienta del tab, con la misma lectura de `productName` que `RecipeLineFormValue` (`''`
 * sin elegir, `null` dada de baja). `quantity` es el texto tal cual lo escribe el usuario: se
 * convierte a entero solo al armar el payload, para no perder lo tecleado si no es válido.
 */
export type RecipeToolFormValue = {
  readonly key: string;
  readonly productId: string;
  readonly productName: string | null;
  readonly quantity: string;
};

/** Estado completo y controlado del formulario. */
export type RecipeFormState = {
  readonly name: string;
  readonly description: string;
  readonly lines: readonly RecipeLineFormValue[];
  readonly tools: readonly RecipeToolFormValue[];
  readonly steps: readonly RecipeStepFormValue[];
  readonly packingSteps: readonly RecipeStepFormValue[];
  readonly conditioningSteps: readonly RecipeStepFormValue[];
  readonly image: ImageFieldState;
};

/** Línea tal como la espera el contrato (`recipeLineSchema`): sin `key` ni `productName`, sin unidad. */
export type RecipeLinePayload = {
  readonly productId: string;
  readonly percentage: string;
};

/**
 * Payload que arma `buildRecipePayload`. `image` es OPCIONAL -y la ausencia de la clave, no un
 * valor `undefined` asignado, es lo que representa "no tocado"- y puede valer `null` de forma
 * explícita solo cuando el estado es `cleared` (edición). Coincide con la forma que esperan
 * `createRecipeSchema.safeParse` y `updateRecipeSchema.safeParse` del contrato público.
 */
/**
 * Un paso tal y como lo reciben `createRecipeSchema`/`updateRecipeSchema`: EL DOCUMENTO DEL
 * CONTRATO, declarado como alias y nunca como copia paralela -dos definiciones que hay que
 * sincronizar a mano acaban desincronizadas (`design.md > 2`)-.
 */
export type RecipeStepPayload = RecipeStepDocument;

/** Paso del acondicionador: el mismo documento con la marca «Asignación requerida». */
export type ConditioningStepPayload = ConditioningStepInput;

/** Herramienta tal como la espera el contrato: sin `key` ni `productName`, cantidad numérica. */
export type RecipeToolPayload = {
  readonly productId: string;
  readonly quantity: number;
};

export type RecipePayload = {
  readonly name: string;
  readonly description: string | null;
  readonly steps: readonly RecipeStepPayload[];
  readonly packingSteps: readonly RecipeStepPayload[];
  readonly conditioningSteps: readonly ConditioningStepPayload[];
  readonly lines: readonly RecipeLinePayload[];
  readonly tools: readonly RecipeToolPayload[];
  readonly image?: { readonly bytes: Uint8Array } | null;
};

/**
 * Arma el payload que se envía a `createRecipeAction`/`updateRecipeAction` (T13, `design.md > 5`,
 * `> 8`).
 *
 * **Los tres estados de la imagen se distinguen por PRESENCIA DE LA CLAVE** (R35, R36): cuando el
 * estado es `untouched`, el objeto devuelto directamente NO TIENE la propiedad `image` -ni
 * siquiera con valor `undefined` asignado, que dejaría `'image' in payload` en `true`-. Cuando es
 * `replaced`, lleva `image: { bytes }`. Cuando es `cleared`, lleva `image: null` EXPLÍCITO. La
 * prueba correcta de un test sobre esto es `'image' in payload`, nunca `payload.image ===
 * undefined` (`design.md > 8`, riesgo 6).
 *
 * **El porcentaje viaja como cadena, con una única sustitución de texto**: esta función
 * cambia la coma que el usuario pudo escribir por un punto (`replace(',', '.')`) y nada más -no
 * la parsea, no la redondea y no la convierte a número en ningún punto-.
 *
 * **Cada paso viaja como el DOCUMENTO del contrato, TAL CUAL** (QC-64 R5): esta funcion ya no
 * proyecta texto -el puente de QC-62 R19 se retiro-, solo copia `step.document` y descarta la
 * `key`, que es de PRESENTACION. Asi el payload no puede llevar ninguna clave que el contrato no
 * declare: ni estado de marcado, ni identificador de bloque, ni version, ni tipo de paso.
 *
 * **Los pasos salen en el orden en que `state.steps` los tiene** (R32): es responsabilidad de
 * `recipe-steps-field.tsx` mantener ese array en el orden que el usuario ve, arrastre o teclado
 * mediante; esta función solo proyecta cada paso a su documento.
 *
 * **Las líneas van completas y sin decisión propia** (R21, R22): `productName` y `key` -que son
 * de PRESENTACIÓN, nunca del contrato- se descartan aquí, pero `productId` y el porcentaje ya
 * convertido viajan intactos incluso si la línea está marcada como "producto no disponible" en la
 * interfaz: esta función no conoce esa marca, es derivada en `recipe-lines-field.tsx` a partir de
 * `productName === null` y nunca llega hasta aquí.
 */
export function buildRecipePayload(mode: RecipeFormMode, state: RecipeFormState): RecipePayload {
  if (mode === 'create' && state.image.kind === 'cleared') {
    // R36: el control de quitar no se ofrece en el alta, así que este estado nunca debería
    // producirse en modo alta. Si ocurre de todos modos es un error de programación del propio
    // formulario -no un caso válido para el que haya que inventar una representación-, y se
    // prefiere fallar aquí a enviar en silencio un `null` que el esquema de alta rechazaría con
    // un mensaje que no explica el motivo real.
    throw new Error('El estado "cleared" de la imagen no es válido en el alta (R36).');
  }

  const base = {
    name: state.name,
    description: state.description.trim() === '' ? null : state.description,
    steps: toStepPayloads(state.steps),
    packingSteps: toStepPayloads(state.packingSteps),
    conditioningSteps: toStepPayloads(state.conditioningSteps),
    lines: toLinePayloads(state.lines),
    tools: toToolPayloads(state.tools),
  };

  switch (state.image.kind) {
    case 'untouched':
      // Sin la clave `image`: es justo lo que hace que 'image' in payload sea false.
      return base;
    case 'replaced':
      return { ...base, image: { bytes: state.image.bytes } };
    case 'cleared':
      return { ...base, image: null };
  }
}

/**
 * `true` si el documento no aporta ningún carácter visible: recorre TODOS los bloques -párrafos
 * e ítems de cada lista de verificación- y mira si algún fragmento tiene texto tras `trim`.
 */
export function isStepDocumentEmpty(document: RecipeStepDocument): boolean {
  const hasText = (spans: readonly { readonly text: string }[]) =>
    spans.some((span) => span.text.trim() !== '');
  return !document.blocks.some((block) =>
    block.kind === 'paragraph' ? hasText(block.spans) : block.items.some((item) => hasText(item.spans)),
  );
}

/**
 * Una sección cuyo único paso está en blanco se envía vacía: es la fila de arranque, que el
 * usuario tocó y dejó sin texto. Con dos o más pasos, el vacío sí llega al esquema y se señala.
 */
export function toStepPayloads(steps: readonly RecipeStepFormValue[]): RecipeStepPayload[] {
  const [only] = steps;
  if (steps.length === 1 && only !== undefined && isStepDocumentEmpty(only.document)) return [];
  return steps.map((step): RecipeStepPayload => step.document);
}

function toLinePayloads(lines: readonly RecipeLineFormValue[]): RecipeLinePayload[] {
  return lines.map(
    (line): RecipeLinePayload => ({
      productId: line.productId,
      percentage: line.percentage.replace(',', '.'),
    }),
  );
}

/**
 * Las de baja viajan igual que las demás: el servidor las conserva. Una cantidad vacía sale como
 * `NaN` y la rechaza el esquema, que es quien señala la fila.
 */
function toToolPayloads(tools: readonly RecipeToolFormValue[]): RecipeToolPayload[] {
  return tools.map(
    (tool): RecipeToolPayload => ({
      productId: tool.productId,
      quantity: Number.parseInt(tool.quantity, 10),
    }),
  );
}

/** Estado del formulario de una versión: solo lo que la versión tiene propio. */
export type RecipeVersionFormState = {
  readonly name: string;
  readonly lines: readonly RecipeLineFormValue[];
  readonly tools: readonly RecipeToolFormValue[];
};

export type RecipeVersionPayload = {
  readonly name: string;
  readonly lines: readonly RecipeLinePayload[];
  readonly tools: readonly RecipeToolPayload[];
};

/** Pasos, descripción e imagen son de la original: la versión nunca los envía. */
export function buildRecipeVersionPayload(state: RecipeVersionFormState): RecipeVersionPayload {
  return {
    name: state.name,
    lines: toLinePayloads(state.lines),
    tools: toToolPayloads(state.tools),
  };
}

/**
 * Líneas del detalle proyectadas al estado del formulario. Se conservan las de un producto dado
 * de baja (`productName: null`) y el % se precarga ya formateado («12.50» -> «12,50»).
 */
export function toLineFormValues(lines: readonly RecipeLineView[]): RecipeLineFormValue[] {
  return lines.map(
    (line): RecipeLineFormValue => ({
      key: createLocalKey('line'),
      productId: line.productId,
      productName: line.productName,
      percentage: formatPercentage(line.percentage),
      productUnitId: line.productUnitId,
    }),
  );
}

/** Herramientas del detalle proyectadas al estado, conservando las de baja. */
export function toToolFormValues(tools: readonly RecipeToolView[]): RecipeToolFormValue[] {
  return tools.map(
    (tool): RecipeToolFormValue => ({
      key: createLocalKey('tool'),
      productId: tool.productId,
      productName: tool.productName,
      quantity: String(tool.quantity),
    }),
  );
}

/** Genera una clave local única para una línea o un paso nuevo. Nunca es el id de dominio. */
let localKeySequence = 0;
export function createLocalKey(prefix: string): string {
  localKeySequence += 1;
  return `${prefix}-${localKeySequence}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * QUÉ TEXTO SE PINTA POR CADA ISSUE. El esquema del contrato es la regla y no se toca; el
 * formulario solo traduce. Los issues `custom` -los `refine`/`superRefine` del esquema- ya traen
 * su mensaje en español y pasan tal cual. Los de forma de zod (`too_small`, `too_big`,
 * `invalid_format`, …) traen el genérico en inglés («Too small: expected string…») y se sustituyen
 * por el texto propio del formulario, igual que `product-form.tsx` con sus `FIELD_MESSAGES`.
 */
function isSchemaMessage(issue: ZodIssue): boolean {
  return issue.code === 'custom';
}

/** Campos de línea a los que el esquema del contrato puede atribuir un error (R31). */
export type RecipeLineFieldName = 'productId' | 'percentage';

/** Errores por línea, indexados por posición, tal como sale de `error.issues[].path` (R31). */
export type RecipeLineErrors = Readonly<Record<number, Partial<Record<RecipeLineFieldName, string>>>>;

/** Texto propio de cada campo de línea, para los issues de forma de zod. */
export type RecipeLineErrorMessages = Readonly<Record<RecipeLineFieldName, string>>;

/** Errores por paso, indexados por posición (R32). */
export type RecipeStepErrors = Readonly<Record<number, string>>;

/**
 * Texto propio de un paso para los issues de forma de zod: la lista de verificación sin ítems
 * (`items` con `min(1)`) tiene el suyo; cualquier otro (fragmento vacío, clave extra) usa el
 * genérico.
 */
export type RecipeStepErrorMessages = Readonly<{
  checklistWithoutItems: string;
  invalid: string;
}>;

/** Texto propio de un campo raíz (`name`, `description`): pasarse del tope o cualquier otro. */
export type RecipeFieldErrorMessages = Readonly<{
  tooLong: string;
  invalid: string;
}>;

/**
 * El porcentaje es el único campo de forma cuyo `regex` YA trae en el esquema un mensaje en
 * español (`invalid_format` con `message`): ese también pasa tal cual.
 */
function isLineSchemaMessage(field: RecipeLineFieldName, issue: ZodIssue): boolean {
  return isSchemaMessage(issue) || (field === 'percentage' && issue.code === 'invalid_format');
}

/**
 * Extrae de `error.issues` los mensajes que identifican una línea concreta -`path` con forma
 * `['lines', <índice>, <campo>]`-. La regla es la del esquema (R26); el texto, el del esquema si
 * lo escribió él y el propio (`messages`) si es el genérico de zod. No confundir con el error de
 * "dos líneas con el mismo producto", cuyo `path` es `['lines']` sin índice -lo captura
 * `extractGeneralLinesError`-.
 */
export function extractLineErrors(
  issues: readonly ZodIssue[],
  messages: RecipeLineErrorMessages,
): RecipeLineErrors {
  const result: Record<number, Partial<Record<RecipeLineFieldName, string>>> = {};
  for (const issue of issues) {
    const [root, index, field] = issue.path;
    if (root !== 'lines' || typeof index !== 'number') continue;
    if (field !== 'productId' && field !== 'percentage') continue;
    const message = isLineSchemaMessage(field, issue) ? issue.message : messages[field];
    result[index] = { ...result[index], [field]: message };
  }
  return result;
}

function stepMessage(issue: ZodIssue, messages: RecipeStepErrorMessages): string {
  if (isSchemaMessage(issue)) return issue.message;
  if (issue.code === 'too_small' && issue.path[issue.path.length - 1] === 'items') {
    return messages.checklistWithoutItems;
  }
  return messages.invalid;
}

/**
 * Extrae de `error.issues` los mensajes que identifican un paso concreto, sea cual sea la
 * profundidad del `path` dentro del documento. Si un paso trae varios, gana el primero que
 * escribió el esquema: es el más concreto.
 * `root` separa cada sección de pasos de las demás: comparten índices.
 */
export function extractStepErrors(
  issues: readonly ZodIssue[],
  messages: RecipeStepErrorMessages,
  root: 'steps' | 'packingSteps' | 'conditioningSteps' = 'steps',
): RecipeStepErrors {
  const result: Record<number, string> = {};
  const fromSchema = new Set<number>();
  for (const issue of issues) {
    const [issueRoot, index] = issue.path;
    if (issueRoot !== root || typeof index !== 'number') continue;
    if (fromSchema.has(index)) continue;
    if (isSchemaMessage(issue)) {
      result[index] = issue.message;
      fromSchema.add(index);
    } else if (result[index] === undefined) {
      result[index] = stepMessage(issue, messages);
    }
  }
  return result;
}

/**
 * Mensaje que no identifica ninguna línea concreta -típicamente "dos líneas con el mismo
 * producto", cuyo `path` es exactamente `['lines']`-. Se presenta junto al bloque de líneas, no
 * junto a una fila. `fallback` cubre un issue de forma de zod sobre la lista entera.
 */
export function extractGeneralLinesError(
  issues: readonly ZodIssue[],
  fallback: string,
): string | undefined {
  const issue = issues.find((candidate) => candidate.path.length === 1 && candidate.path[0] === 'lines');
  if (issue === undefined) return undefined;
  return isSchemaMessage(issue) ? issue.message : fallback;
}

export type RecipeToolFieldName = 'productId' | 'quantity';

export type RecipeToolErrors = Readonly<Record<number, Partial<Record<RecipeToolFieldName, string>>>>;

export type RecipeToolErrorMessages = Readonly<Record<RecipeToolFieldName, string>>;

/**
 * Los mensajes de forma del esquema son los genéricos de zod, en inglés: por eso aquí se toma
 * solo el `path` del issue y el texto lo pone quien llama.
 */
export function extractToolErrors(
  issues: readonly ZodIssue[],
  messages: RecipeToolErrorMessages,
): RecipeToolErrors {
  const result: Record<number, Partial<Record<RecipeToolFieldName, string>>> = {};
  for (const issue of issues) {
    const [root, index, field] = issue.path;
    if (root !== 'tools' || typeof index !== 'number') continue;
    if (field !== 'productId' && field !== 'quantity') continue;
    result[index] = { ...result[index], [field]: messages[field] };
  }
  return result;
}

/** Error del array entero (producto repetido): no apunta a ninguna fila. */
export function extractGeneralToolsError(
  issues: readonly ZodIssue[],
  fallback: string,
): string | undefined {
  const issue = issues.find((candidate) => candidate.path.length === 1 && candidate.path[0] === 'tools');
  if (issue === undefined) return undefined;
  return isSchemaMessage(issue) ? issue.message : fallback;
}

/**
 * Mensaje de un campo raíz del formulario (`name`, `description`), por su nombre exacto de
 * `path`. El `refine` del esquema pasa tal cual; `too_big` usa `messages.tooLong` y cualquier
 * otro issue de forma (vacío, tipo) `messages.invalid`.
 */
export function extractFieldError(
  issues: readonly ZodIssue[],
  field: string,
  messages: RecipeFieldErrorMessages,
): string | undefined {
  const issue = issues.find((candidate) => candidate.path.length === 1 && candidate.path[0] === field);
  if (issue === undefined) return undefined;
  if (isSchemaMessage(issue)) return issue.message;
  return issue.code === 'too_big' ? messages.tooLong : messages.invalid;
}
