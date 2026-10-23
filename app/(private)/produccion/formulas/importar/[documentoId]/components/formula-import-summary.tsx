'use client';

import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import type { FormulaImportSummary as FormulaImportSummaryData } from '@/lib/modules/documentos';
import type { UnitRef } from '@/lib/modules/unidades';
import { recipeEditRoute } from '@/lib/shared/routes';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { cn } from '@/lib/utils';

const OUTCOME_LABELS: Record<FormulaImportSummaryData['outcome'], string> = {
  created: 'Se creó una fórmula nueva.',
  replaced: 'Se reemplazó la fórmula existente.',
};

const LIST_SEPARATOR = ' · ';

type FormulaImportSummaryProps = {
  readonly summary: FormulaImportSummaryData;
  /** Las mismas unidades de la revision: dan el simbolo (o el nombre) de cada creada. */
  readonly units: readonly UnitRef[];
};

/** `symbol` cuando existe; `name` si no. Una unidad que no esta en la lista no inventa texto. */
function unitText(unitId: string, units: readonly UnitRef[]): string {
  const unit = units.find((item) => item.id === unitId);
  if (unit === undefined) return '';
  return unit.symbol ?? unit.name;
}

/**
 * Resultado de una confirmacion que termino bien: si la receta se creo o se reemplazo,
 * cuantas materias primas se crearon -cada una con su unidad- y cuantas se reutilizaron -por su
 * nombre- (QC-203 R27), y la vuelta a la ficha de esa receta, que sale de `recipeEditRoute`,
 * nunca de un literal.
 */
export function FormulaImportSummary({ summary, units }: FormulaImportSummaryProps) {
  const createdList = summary.created
    .map((item) => {
      const unit = unitText(item.unitId, units);
      return unit === '' ? item.name : `${item.name}${LIST_SEPARATOR}${unit}`;
    })
    .join(', ');
  const reusedList = summary.reused.map((item) => item.name).join(', ');

  return (
    <div
      role="status"
      className="flex flex-col items-start gap-4 rounded-lg border p-4"
      data-testid="formula-import-summary"
    >
      <p className="text-sm font-medium" data-testid="formula-import-summary-outcome">
        {OUTCOME_LABELS[summary.outcome]}
      </p>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">Materias primas creadas</dt>
          <dd data-testid="formula-import-summary-raw-materials-created">{summary.rawMaterialsCreated}</dd>
          <dd className="text-muted-foreground" data-testid="formula-import-summary-created-list">
            {createdList === '' ? EMPTY_MARK : createdList}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground">Materias primas reutilizadas</dt>
          <dd data-testid="formula-import-summary-raw-materials-reused">{summary.rawMaterialsReused}</dd>
          <dd className="text-muted-foreground" data-testid="formula-import-summary-reused-list">
            {reusedList === '' ? EMPTY_MARK : reusedList}
          </dd>
        </div>
      </dl>

      <Link
        href={recipeEditRoute(summary.recipeId)}
        data-slot="button"
        className={cn(buttonVariants({ variant: 'outline', touch: true }))}
        data-testid="formula-import-summary-link"
      >
        Ver la fórmula
      </Link>
    </div>
  );
}
