/**
 * Convierte el texto de un paso leido por la IA en un documento de paso de receta, en orden:
 * - las lineas consecutivas con prefijo de casilla (`[ ]`, `[]`, `[x]`, `[X]`) se agrupan en UN
 *   bloque `checklist`, un item por linea sin el prefijo; un item que queda vacio se descarta;
 * - cada otra linea no vacia es un `paragraph`, y corta el grupo de casillas en curso.
 * No interpreta negritas ni otras vinetas -el revisor tiene el editor completo para corregirlo-.
 * No recorta al tope de elementos por paso: si se supera, la revision de la importacion lo marca.
 *
 * Dominio puro: sin base de datos ni framework.
 */

import type { RecipeStepDocument } from '@/lib/modules/recetas';

type StepBlock = RecipeStepDocument['blocks'][number];
type ChecklistItem = Extract<StepBlock, { kind: 'checklist' }>['items'][number];

/** Prefijo de casilla al inicio de una linea ya recortada: `[ ]`, `[]`, `[x]` o `[X]`. */
const CHECKBOX_PREFIX = /^\[(?: |x|X)?\]/;

/** El documento del paso, o `null` si el texto no tiene ninguna linea con contenido. */
export function stepTextToDocument(text: string): RecipeStepDocument | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  if (lines.length === 0) return null;

  const blocks: StepBlock[] = [];
  let pendingItems: ChecklistItem[] = [];

  const flushChecklist = (): void => {
    if (pendingItems.length > 0) blocks.push({ kind: 'checklist', items: pendingItems });
    pendingItems = [];
  };

  for (const line of lines) {
    if (CHECKBOX_PREFIX.test(line)) {
      const itemText = line.replace(CHECKBOX_PREFIX, '').trim();
      if (itemText !== '') pendingItems.push({ spans: [{ text: itemText }] });
      continue;
    }
    flushChecklist();
    blocks.push({ kind: 'paragraph', spans: [{ text: line }] });
  }
  flushChecklist();

  return blocks.length === 0 ? null : { blocks };
}
