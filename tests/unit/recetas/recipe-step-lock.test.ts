// tests/unit/recetas/recipe-step-lock.test.ts
//
// Que cambio de una lista de pasos desplazaria las fotos de evidencia. Puro: sin puertos.
import { describe, expect, it } from 'vitest';

import { detectLockedStepChange } from '@/lib/modules/recetas';

function paso(texto: string, requiresEvidence?: boolean) {
  return {
    blocks: [{ kind: 'paragraph' as const, spans: [{ text: texto }] }],
    ...(requiresEvidence === undefined ? {} : { requiresEvidence }),
  };
}

const A = paso('Pesar');
const B = paso('Mezclar');
const C = paso('Envasar');

describe('detectLockedStepChange', () => {
  it('R9: una lista mas corta es quitar', () => {
    expect(detectLockedStepChange([A, B, C], [A, B])).toBe('removed');
    expect(detectLockedStepChange([A, B, C], [A, C])).toBe('removed');
    expect(detectLockedStepChange([A], [])).toBe('removed');
  });

  it('R10: un paso intacto que llega en otra posicion es mover', () => {
    expect(detectLockedStepChange([A, B, C], [B, A, C])).toBe('moved');
    expect(detectLockedStepChange([A, B, C], [C, A, B])).toBe('moved');
  });

  it('R10: mover un paso al final y anadir otro en su sitio tambien es mover', () => {
    expect(detectLockedStepChange([A, B], [paso('Nuevo'), B, A])).toBe('moved');
  });

  it('R11: mover y reescribir a la vez no se distingue de editar el texto en su sitio', () => {
    expect(detectLockedStepChange([A, B], [paso('Mezclar bien'), paso('Pesar todo')])).toBeNull();
  });

  it('R11: cambiar solo el switch de evidencia no es mover', () => {
    expect(detectLockedStepChange([A, B], [paso('Pesar', true), B])).toBeNull();
    expect(detectLockedStepChange([paso('Pesar', true), B], [paso('Pesar', false), B])).toBeNull();
  });

  it('R11: anadir pasos al final no bloquea', () => {
    expect(detectLockedStepChange([A, B], [A, B, C])).toBeNull();
  });

  it('R11: cambiar el texto de un paso en su sitio no bloquea', () => {
    expect(detectLockedStepChange([A, B, C], [A, paso('Mezclar 5 min'), C])).toBeNull();
  });

  it('la lista sin cambios no bloquea', () => {
    expect(detectLockedStepChange([A, B, C], [A, B, C])).toBeNull();
    expect(detectLockedStepChange([], [])).toBeNull();
  });

  it('el orden de las claves y una marca apagada no cambian el contenido del paso', () => {
    const guardado = { blocks: [{ spans: [{ text: 'Pesar', bold: false }], kind: 'paragraph' as const }] };
    expect(detectLockedStepChange([guardado, B], [A, B])).toBeNull();
    expect(detectLockedStepChange([guardado, B], [B, A])).toBe('moved');
  });

  it('una marca encendida si cambia el contenido', () => {
    const negrita = { blocks: [{ kind: 'paragraph' as const, spans: [{ text: 'Pesar', bold: true }] }] };
    expect(detectLockedStepChange([A, B], [negrita, B])).toBeNull();
    expect(detectLockedStepChange([A, B], [B, negrita])).toBe('moved');
  });

  it('R10: con pasos repetidos, mover el distinto sigue siendo mover', () => {
    expect(detectLockedStepChange([A, A, B], [A, B, A])).toBe('moved');
  });
});
