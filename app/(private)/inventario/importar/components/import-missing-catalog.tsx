'use client';

import { PlusIcon, TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ImportMissingEntry } from '@/lib/modules/inventario';
import type { UnitView } from '@/lib/modules/unidades';

import { ImportCreatePresentationDialog } from './import-create-presentation-dialog';
import { ImportCreateUnitDialog } from './import-create-unit-dialog';
import {
  MISSING_CREATE_LABEL,
  MISSING_CREATE_TESTID,
  MISSING_NAME_TESTID,
  MISSING_PRESENTATIONS_TITLE,
  MISSING_PRESENTATION_TESTID,
  MISSING_ROWS_TESTID,
  MISSING_SECTION_DESCRIPTION,
  MISSING_SECTION_TESTID,
  MISSING_SECTION_TITLE,
  MISSING_UNITS_TITLE,
  MISSING_UNIT_TESTID,
  missingCreateAriaLabel,
  missingRowsLabel,
} from './import-texts';

type CreationTarget = { readonly kind: 'unit' | 'presentation'; readonly name: string };

function MissingList({
  title,
  entries,
  canCreate,
  itemTestId,
  disabled,
  onCreate,
}: {
  readonly title: string;
  readonly entries: readonly ImportMissingEntry[];
  readonly canCreate: boolean;
  readonly itemTestId: string;
  readonly disabled: boolean;
  readonly onCreate: (name: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li
            key={entry.name}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5"
            data-testid={itemTestId}
          >
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold break-words" data-testid={MISSING_NAME_TESTID}>
                {entry.name}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums" data-testid={MISSING_ROWS_TESTID}>
                {missingRowsLabel(entry.rowNumbers)}
              </span>
            </span>
            {canCreate ? (
              <Button
                type="button"
                variant="outline"
                touch
                disabled={disabled}
                aria-label={missingCreateAriaLabel(entry.name)}
                data-testid={MISSING_CREATE_TESTID}
                onClick={() => onCreate(entry.name)}
              >
                <PlusIcon aria-hidden />
                {MISSING_CREATE_LABEL}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export type ImportMissingCatalogProps = {
  readonly missingUnits: readonly ImportMissingEntry[];
  readonly missingPresentations: readonly ImportMissingEntry[];
  readonly canCreateUnits: boolean;
  readonly canCreatePresentations: boolean;
  readonly units: readonly UnitView[];
  readonly disabled?: boolean;
  readonly onCreated: () => void;
};

export function ImportMissingCatalog({
  missingUnits,
  missingPresentations,
  canCreateUnits,
  canCreatePresentations,
  units,
  disabled = false,
  onCreated,
}: ImportMissingCatalogProps) {
  const [target, setTarget] = useState<CreationTarget | null>(null);

  if (missingUnits.length === 0 && missingPresentations.length === 0) return null;

  function created() {
    setTarget(null);
    onCreated();
  }

  return (
    <Card
      className="gap-4 rounded-[14px] border border-warning-border px-5 py-5 ring-0"
      data-testid={MISSING_SECTION_TESTID}
    >
      <div className="flex items-start gap-2.5">
        <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-warning-subtle text-warning-text">
          <TriangleAlertIcon className="size-4" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg font-semibold">{MISSING_SECTION_TITLE}</h2>
          <p className="text-sm text-muted-foreground">{MISSING_SECTION_DESCRIPTION}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 @max-[760px]:grid-cols-1" data-slot="missing-catalog-columns">
        <MissingList
          title={MISSING_UNITS_TITLE}
          entries={missingUnits}
          canCreate={canCreateUnits}
          itemTestId={MISSING_UNIT_TESTID}
          disabled={disabled}
          onCreate={(name) => setTarget({ kind: 'unit', name })}
        />
        <MissingList
          title={MISSING_PRESENTATIONS_TITLE}
          entries={missingPresentations}
          canCreate={canCreatePresentations}
          itemTestId={MISSING_PRESENTATION_TESTID}
          disabled={disabled}
          onCreate={(name) => setTarget({ kind: 'presentation', name })}
        />
      </div>
      {target?.kind === 'unit' ? (
        <ImportCreateUnitDialog
          key={target.name}
          initialName={target.name}
          units={units}
          onClose={() => setTarget(null)}
          onCreated={created}
        />
      ) : null}
      {target?.kind === 'presentation' ? (
        <ImportCreatePresentationDialog
          key={target.name}
          initialName={target.name}
          units={units}
          onClose={() => setTarget(null)}
          onCreated={created}
        />
      ) : null}
    </Card>
  );
}
