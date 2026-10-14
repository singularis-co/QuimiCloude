/**
 * Que cambio de una lista de pasos dejaria fotos de evidencia atadas al paso equivocado. Las fotos
 * van por posicion: quitar un paso o moverlo de sitio desplaza las de los que vienen detras.
 *
 * Sin identidad de paso, mover un paso y a la vez reescribirlo es indistinguible de reescribir
 * cada paso en su sitio, que si esta permitido. Se detecta lo que si se distingue: la lista se
 * acorta, o un paso llega intacto a otra posicion y no a la suya.
 */
import type { RecipeStepBlock } from './recipe-input';

export type LockedStepChange = 'removed' | 'moved';

type StepContent = { readonly blocks: readonly RecipeStepBlock[] };

/**
 * Forma canonica de los bloques: claves ordenadas y sin las marcas apagadas, porque `jsonb`
 * reordena las claves al guardar y `bold: false` pinta igual que no traerlo. `requiresEvidence`
 * queda fuera a proposito: encender o apagar el switch nunca es mover.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== false)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stepKey(step: StepContent): string {
  return canonical(step.blocks);
}

export function detectLockedStepChange(
  previous: readonly StepContent[],
  next: readonly StepContent[],
): LockedStepChange | null {
  if (next.length < previous.length) return 'removed';

  const nextKeys = next.map(stepKey);
  for (const [i, step] of previous.entries()) {
    const key = stepKey(step);
    if (nextKeys[i] === key) continue;
    if (nextKeys.some((other, k) => k !== i && other === key)) return 'moved';
  }
  return null;
}
