'use client';

import { CircleCheckIcon } from 'lucide-react';

import { ArrowLink } from '@/components/shared/arrow-link';
import { Card } from '@/components/ui/card';
import type { FormulaImportSummary as FormulaImportSummaryData } from '@/lib/modules/documentos';
import { FORMULAS_ROUTE, recipeEditRoute } from '@/lib/shared/routes';

const OUTCOME_LABELS: Record<FormulaImportSummaryData['outcome'], string> = {
  created: 'Se creó una fórmula nueva.',
  replaced: 'Se reemplazó la fórmula existente.',
};

type FormulaImportSummaryProps = {
  readonly summary: FormulaImportSummaryData;
};

/**
 * Resultado de una confirmacion que termino bien: si la receta se creo o se reemplazo,
 * cuantas materias primas se crearon y cuantas se reutilizaron, y la vuelta a la ficha de esa
 * receta -que sale de `recipeEditRoute`, nunca de un literal.
 */
export function FormulaImportSummary({ summary }: FormulaImportSummaryProps) {
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
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-semibold text-muted-foreground">Materias primas reutilizadas</dt>
          <dd
            className="font-mono text-2xl font-semibold"
            data-testid="formula-import-summary-raw-materials-reused"
          >
            {summary.rawMaterialsReused}
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
