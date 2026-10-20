'use client';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';

type FormulaNameClashProps = {
  readonly recipeName: string;
  readonly onReplace: () => void;
  readonly onRename: () => void;
};

/**
 * El aviso de choque de nombre: una receta viva ya tiene ese nombre. El texto es EXACTO
 * y las dos opciones son las unicas admitidas: reemplazarla o cambiar
 * el nombre. Ninguna de las dos decide aqui lo que pasa despues; eso lo hace quien llama.
 */
export function FormulaNameClash({ recipeName, onReplace, onRename }: FormulaNameClashProps) {
  return (
    <Notice tone="warning" testId="formula-import-clash">
      <div className="flex flex-col gap-3">
        <p data-testid="formula-import-clash-message">
          {`Ya existe la fórmula «${recipeName}». Reemplazarla cambia sus ingredientes, pasos y descripción; los pedidos que la usan no cambian su coste guardado.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            touch
            onClick={onRename}
            data-testid="formula-import-clash-rename"
          >
            Cambiar el nombre
          </Button>
          <Button type="button" variant="destructive" touch onClick={onReplace} data-testid="formula-import-clash-replace">
            Reemplazar
          </Button>
        </div>
      </div>
    </Notice>
  );
}
