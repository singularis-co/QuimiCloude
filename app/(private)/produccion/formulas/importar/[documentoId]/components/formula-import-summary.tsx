'use client';

import { CircleCheckIcon } from 'lucide-react';

import { ArrowLink } from '@/components/shared/arrow-link';
import { Card } from '@/components/ui/card';
import type { FormulaImportSummary as FormulaImportSummaryData } from '@/lib/modules/documentos';
import type { UnitRef } from '@/lib/modules/unidades';
import { FORMULAS_ROUTE, recipeEditRoute } from '@/lib/shared/routes';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

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
 * nombre-, y la vuelta a la ficha de esa receta, que sale de `recipeEditRoute`,
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
    <Card
      role="status"
      aria-labelledby="formula-import-summary-outcome"
      className="gap-4 rounded-[14px] px-5 py-5"
      data-testid="formula-import-summary"
    >
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden="true"
          data-testid="formula-import-summary-icon"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success-subtle text-success-text"
        >
          <CircleCheckIcon className="size-5" />
        </span>
        <h2
          id="formula-import-summary-outcome"
          className="text-lg font-semibold"
          data-testid="formula-import-summary-outcome"
        >
          {OUTCOME_LABELS[summary.outcome]}
        </h2>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-semibold text-muted-foreground">Materias primas creadas</dt>
          <dd
            className="font-mono text-2xl font-semibold"
            data-testid="formula-import-summary-raw-materials-created"
          >
            {summary.rawMaterialsCreated}
          </dd>
          <dd className="text-muted-foreground" data-testid="formula-import-summary-created-list">
            {createdList === '' ? EMPTY_MARK : createdList}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-semibold text-muted-foreground">Materias primas reutilizadas</dt>
          <dd
            className="font-mono text-2xl font-semibold"
            data-testid="formula-import-summary-raw-materials-reused"
          >
            {summary.rawMaterialsReused}
          </dd>
          <dd className="text-muted-foreground" data-testid="formula-import-summary-reused-list">
            {reusedList === '' ? EMPTY_MARK : reusedList}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap justify-end gap-3">
        <ArrowLink direction="back" href={FORMULAS_ROUTE} touch testId="formula-import-summary-back-link">
          Volver al listado
        </ArrowLink>
        <ArrowLink
          direction="forward"
          href={recipeEditRoute(summary.recipeId)}
          touch
          testId="formula-import-summary-link"
        >
          Ver la fórmula
        </ArrowLink>
      </div>
    </Card>
  );
}
