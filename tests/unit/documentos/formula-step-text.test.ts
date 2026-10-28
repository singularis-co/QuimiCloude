import { describe, expect, it } from 'vitest';

import { stepTextToDocument } from '@/lib/modules/documentos/domain/formula-step-text';
import { MAX_STEP_ELEMENTS, recipeStepSchema } from '@/lib/modules/recetas';

describe('documentos — stepTextToDocument', () => {
  describe('R9 — un parrafo por linea no vacia, en orden', () => {
    it('una sola linea da un unico parrafo', () => {
      const documento = stepTextToDocument('Mezclar los ingredientes');
      expect(documento).toEqual({
        blocks: [{ kind: 'paragraph', spans: [{ text: 'Mezclar los ingredientes' }] }],
      });
    });

    it('tres lineas con una vacia en medio da dos parrafos, en orden', () => {
      const documento = stepTextToDocument('Primero\n\nSegundo');
      expect(documento).toEqual({
        blocks: [
          { kind: 'paragraph', spans: [{ text: 'Primero' }] },
          { kind: 'paragraph', spans: [{ text: 'Segundo' }] },
        ],
      });
    });

    it('recorta cada linea antes de convertirla en parrafo', () => {
      const documento = stepTextToDocument('  Primero  \n  Segundo  ');
      expect(documento?.blocks[0]).toEqual({ kind: 'paragraph', spans: [{ text: 'Primero' }] });
      expect(documento?.blocks[1]).toEqual({ kind: 'paragraph', spans: [{ text: 'Segundo' }] });
    });

    it('respeta saltos de linea con retorno de carro (\\r\\n)', () => {
      const documento = stepTextToDocument('Primero\r\nSegundo');
      expect(documento?.blocks).toHaveLength(2);
    });
  });

  describe('lineas con prefijo de casilla se agrupan en una lista de verificacion', () => {
    const FASE_A =
      'Fase A\n[ ] Calentar el agua a ~40 °C.\n[ ] Disolver el EDTA, luego la cafeina y la biotina con agitacion hasta solucion transparente.\n[ ] Agregar niacinamida, glicerina y pantenol.';

    it('el ejemplo Fase A da un parrafo y un checklist de 3 items', () => {
      expect(stepTextToDocument(FASE_A)).toEqual({
        blocks: [
          { kind: 'paragraph', spans: [{ text: 'Fase A' }] },
          {
            kind: 'checklist',
            items: [
              { spans: [{ text: 'Calentar el agua a ~40 °C.' }] },
              {
                spans: [
                  {
                    text: 'Disolver el EDTA, luego la cafeina y la biotina con agitacion hasta solucion transparente.',
                  },
                ],
              },
              { spans: [{ text: 'Agregar niacinamida, glicerina y pantenol.' }] },
            ],
          },
        ],
      });
    });

    it('el documento resultante pasa el esquema del paso', () => {
      const documento = stepTextToDocument(FASE_A);
      expect(() => recipeStepSchema.parse(documento)).not.toThrow();
    });

    it('tolera `[]`, `[ ]` sin espacio posterior y `[x]`/`[X]`', () => {
      const documento = stepTextToDocument('[]Uno\n[ ]Dos\n[x] Tres\n  [X]  Cuatro  ');
      expect(documento).toEqual({
        blocks: [
          {
            kind: 'checklist',
            items: [
              { spans: [{ text: 'Uno' }] },
              { spans: [{ text: 'Dos' }] },
              { spans: [{ text: 'Tres' }] },
              { spans: [{ text: 'Cuatro' }] },
            ],
          },
        ],
      });
    });

    it('un parrafo entre dos grupos de casillas da dos checklists', () => {
      const documento = stepTextToDocument('[ ] Uno\n[ ] Dos\nFase B\n[ ] Tres');
      expect(documento).toEqual({
        blocks: [
          {
            kind: 'checklist',
            items: [{ spans: [{ text: 'Uno' }] }, { spans: [{ text: 'Dos' }] }],
          },
          { kind: 'paragraph', spans: [{ text: 'Fase B' }] },
          { kind: 'checklist', items: [{ spans: [{ text: 'Tres' }] }] },
        ],
      });
    });

    it('un item vacio tras quitar el prefijo se descarta', () => {
      const documento = stepTextToDocument('Fase A\n[ ] Uno\n[ ]   \n[ ] Dos');
      expect(documento).toEqual({
        blocks: [
          { kind: 'paragraph', spans: [{ text: 'Fase A' }] },
          {
            kind: 'checklist',
            items: [{ spans: [{ text: 'Uno' }] }, { spans: [{ text: 'Dos' }] }],
          },
        ],
      });
    });

    it('un grupo de casillas todas vacias no emite bloque', () => {
      expect(stepTextToDocument('Fase A\n[ ]\n[x]')).toEqual({
        blocks: [{ kind: 'paragraph', spans: [{ text: 'Fase A' }] }],
      });
      expect(stepTextToDocument('[ ]\n[]')).toBeNull();
    });

    it('no recorta por encima del tope: el esquema lo rechaza despues', () => {
      const texto = Array.from({ length: MAX_STEP_ELEMENTS + 1 }, (_, i) => `[ ] Item ${i}`).join(
        '\n',
      );
      const documento = stepTextToDocument(texto);
      const bloque = documento?.blocks[0];
      expect(bloque?.kind === 'checklist' ? bloque.items : []).toHaveLength(MAX_STEP_ELEMENTS + 1);
      expect(recipeStepSchema.safeParse(documento).success).toBe(false);
    });
  });

  describe('un paso sin ningun caracter visible se descarta', () => {
    it('texto vacio -> null', () => {
      expect(stepTextToDocument('')).toBeNull();
    });

    it('solo espacios y saltos de linea -> null', () => {
      expect(stepTextToDocument('   \n   \n\t')).toBeNull();
    });
  });
});
