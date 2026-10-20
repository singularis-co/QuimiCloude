'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  IMPORT_EXAMPLE_ROWS,
  IMPORT_TYPE_LABELS,
  INVENTORY_IMPORT_COLUMNS,
  type ImportColumnKey,
  type ImportColumnRule,
  type ImportRowType,
  type ImportTemplateValues,
} from '@/lib/modules/inventario';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import { cn } from '@/lib/utils';

import { GUIDE_COLUMN_DESCRIPTIONS } from './import-guide-descriptions';
import {
  GUIDE_COLUMN_HEADER,
  GUIDE_DESCRIPTION,
  GUIDE_DESCRIPTION_HEADER,
  GUIDE_EXAMPLES_NOTE,
  GUIDE_EXAMPLES_TESTID,
  GUIDE_RULES_NOTES,
  GUIDE_RULES_TESTID,
  GUIDE_RULE_LABELS,
  GUIDE_RULE_OPTIONAL_AUTO_LABEL,
  GUIDE_TABS,
  GUIDE_TESTID,
  GUIDE_TITLE,
  GUIDE_VALUES_EMPTY,
  GUIDE_VALUES_HEADERS,
  GUIDE_VALUES_TESTID,
  GUIDE_VALUES_UNAVAILABLE,
} from './import-texts';

const TYPES = Object.keys(IMPORT_TYPE_LABELS) as ImportRowType[];

const RULE_CLASS = {
  required: 'font-medium text-foreground',
  optional: 'text-muted-foreground',
  forbidden: 'text-muted-foreground/70 italic',
} as const;

/**
 * Columnas que, vacias, rellena la propia importacion: el lote se genera al escribir y la fecha de
 * compra toma la de hoy (`create-product.ts`, `import-finished-goods.ts`).
 */
const AUTO_FILLED_COLUMNS: ReadonlySet<ImportColumnKey> = new Set<ImportColumnKey>(['lot', 'purchaseDate']);

function RuleLabel({ column, rule }: { readonly column: ImportColumnKey; readonly rule: ImportColumnRule }) {
  if (rule !== 'optional' || !AUTO_FILLED_COLUMNS.has(column)) return <>{GUIDE_RULE_LABELS[rule]}</>;
  return (
    <span
      className="inline-flex rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium whitespace-normal text-primary"
      data-auto-fill
    >
      {GUIDE_RULE_OPTIONAL_AUTO_LABEL}
    </span>
  );
}

/** Sale de la misma tabla de reglas que aplica la importacion: no hay una segunda copia que se desfase. */
function RulesPanel() {
  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{GUIDE_COLUMN_HEADER}</TableHead>
            <TableHead className="min-w-64">{GUIDE_DESCRIPTION_HEADER}</TableHead>
            {TYPES.map((type) => (
              <TableHead key={type}>{IMPORT_TYPE_LABELS[type]}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {INVENTORY_IMPORT_COLUMNS.map((column) => (
            <TableRow key={column.key}>
              <TableCell className="font-medium">{column.header}</TableCell>
              <TableCell className="min-w-64 max-w-md whitespace-normal text-muted-foreground" data-description>
                {GUIDE_COLUMN_DESCRIPTIONS[column.key]}
              </TableCell>
              {TYPES.map((type) => {
                const rule = column.rules[type];
                return (
                  <TableCell key={type} className={RULE_CLASS[rule]} data-rule={rule}>
                    <RuleLabel column={column.key} rule={rule} />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
        {GUIDE_RULES_NOTES.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function ValueList({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border p-3">
      <h3 className="-mx-3 -mt-3 mb-1 rounded-t-lg border-b bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{GUIDE_VALUES_EMPTY}</p>
      ) : (
        <ul className="flex max-h-60 flex-col gap-0.5 overflow-y-auto text-sm break-words">
          {items.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ValuesPanel({ values }: { readonly values: ImportTemplateValues | null }) {
  return (
    <div className="flex flex-col gap-3">
      {values === null ? <p className="text-sm text-muted-foreground">{GUIDE_VALUES_UNAVAILABLE}</p> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ValueList title={GUIDE_VALUES_HEADERS.types} items={Object.values(IMPORT_TYPE_LABELS)} />
        {values === null ? null : (
          <>
            <ValueList title={GUIDE_VALUES_HEADERS.units} items={values.units} />
            <ValueList title={GUIDE_VALUES_HEADERS.presentations} items={values.presentations} />
            <ValueList title={GUIDE_VALUES_HEADERS.formulas} items={values.formulas} />
          </>
        )}
      </div>
    </div>
  );
}

function ExamplesPanel() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{GUIDE_EXAMPLES_NOTE}</p>
      <Table>
        <TableHeader>
          <TableRow>
            {INVENTORY_IMPORT_COLUMNS.map((column) => (
              <TableHead key={column.key}>{column.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {IMPORT_EXAMPLE_ROWS.map((example) => (
            <TableRow key={example.type}>
              {INVENTORY_IMPORT_COLUMNS.map((column) => {
                const value = example[column.key];
                return (
                  <TableCell key={column.key} className={cn(value === '' && 'text-muted-foreground')}>
                    {value === '' ? EMPTY_MARK : value}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export type ImportGuideProps = {
  /** `null` si no se pudieron leer: la guia sigue mostrando reglas, tipos y ejemplos. */
  readonly values: ImportTemplateValues | null;
};

export function ImportGuide({ values }: ImportGuideProps) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border p-4" data-testid={GUIDE_TESTID}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{GUIDE_TITLE}</h2>
        <p className="text-sm text-muted-foreground">{GUIDE_DESCRIPTION}</p>
      </div>
      <Tabs defaultValue="rules">
        <TabsList className="h-auto flex-wrap group-data-horizontal/tabs:h-auto">
          <TabsTrigger value="rules">{GUIDE_TABS.rules}</TabsTrigger>
          <TabsTrigger value="values">{GUIDE_TABS.values}</TabsTrigger>
          <TabsTrigger value="examples">{GUIDE_TABS.examples}</TabsTrigger>
        </TabsList>
        <TabsContent value="rules" className="pt-2" data-testid={GUIDE_RULES_TESTID}>
          <RulesPanel />
        </TabsContent>
        <TabsContent value="values" className="pt-2" data-testid={GUIDE_VALUES_TESTID}>
          <ValuesPanel values={values} />
        </TabsContent>
        <TabsContent value="examples" className="pt-2" data-testid={GUIDE_EXAMPLES_TESTID}>
          <ExamplesPanel />
        </TabsContent>
      </Tabs>
    </section>
  );
}
