import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  GUIDE_CATALOG_LINK_LABELS,
  GUIDE_CATALOG_LINK_TESTIDS,
  GUIDE_COLUMN_DESCRIPTION_TEXTS,
  GUIDE_DESCRIPTION_HEADER,
  GUIDE_EXAMPLES_TESTID,
  GUIDE_RULE_OPTIONAL_AUTO_LABEL,
  GUIDE_RULES_TESTID,
  GUIDE_TABS,
  GUIDE_VALUES_TESTID,
  GUIDE_VALUES_UNAVAILABLE,
  ImportGuide,
} from '@/app/(private)/inventario/importar/components';
import { IMPORT_EXAMPLE_ROWS, IMPORT_TYPE_LABELS, INVENTORY_IMPORT_COLUMNS } from '@/lib/modules/inventario';
import { FORMULAS_ROUTE, PRESENTATIONS_ROUTE, UNITS_ROUTE } from '@/lib/shared/routes';

import { setupUser } from '../../../helpers/user-event';

const VALUES = { units: ['gramo', 'kilogramo'], presentations: ['Bidón 20 L'], formulas: ['Desengrasante'] };

afterEach(() => {
  cleanup();
});

describe('guía de la importación', () => {
  it('R3 la pestaña inicial muestra cada columna con su regla para los cuatro tipos', () => {
    render(<ImportGuide values={VALUES} />);

    const panel = screen.getByTestId(GUIDE_RULES_TESTID);
    for (const column of INVENTORY_IMPORT_COLUMNS) expect(within(panel).getByText(column.header)).toBeInTheDocument();
    const nameRow = within(panel).getByText('Nombre').closest('tr');
    expect(nameRow).not.toBeNull();
    const rules = [...(nameRow?.querySelectorAll('[data-rule]') ?? [])].map((cell) => cell.getAttribute('data-rule'));
    expect(rules).toEqual(
      (Object.keys(IMPORT_TYPE_LABELS) as (keyof typeof IMPORT_TYPE_LABELS)[]).map(
        (type) => INVENTORY_IMPORT_COLUMNS.find((column) => column.key === 'name')?.rules[type],
      ),
    );
  });

  it('R3 «Costo unitario» es obligatorio salvo en Instrumento, como exige la importación', () => {
    render(<ImportGuide values={VALUES} />);

    const panel = screen.getByTestId(GUIDE_RULES_TESTID);
    const costRow = within(panel).getByText('Costo unitario', { selector: 'td' }).closest('tr');
    const rules = [...(costRow?.querySelectorAll('[data-rule]') ?? [])].map((cell) => cell.getAttribute('data-rule'));
    expect(rules).toEqual(['required', 'required', 'optional', 'required']);
  });

  it('R3 cada columna muestra su descripción junto a su nombre', () => {
    render(<ImportGuide values={VALUES} />);

    const panel = screen.getByTestId(GUIDE_RULES_TESTID);
    expect(within(panel).getByRole('columnheader', { name: GUIDE_DESCRIPTION_HEADER })).toBeInTheDocument();
    for (const column of INVENTORY_IMPORT_COLUMNS) {
      const row = within(panel).getByText(column.header, { selector: 'td' }).closest('tr');
      expect(row).not.toBeNull();
      expect(row?.querySelector('[data-description]')).toHaveTextContent(GUIDE_COLUMN_DESCRIPTION_TEXTS[column.key]);
    }
  });

  it('R3 unidad, presentación y fórmula enlazan a su módulo desde la descripción', () => {
    render(<ImportGuide values={VALUES} />);

    const panel = screen.getByTestId(GUIDE_RULES_TESTID);
    const expected = [
      ['unit', UNITS_ROUTE],
      ['presentation', PRESENTATIONS_ROUTE],
      ['formula', FORMULAS_ROUTE],
    ] as const;
    for (const [column, route] of expected) {
      const link = within(panel).getByTestId(GUIDE_CATALOG_LINK_TESTIDS[column]);
      expect(link).toHaveAttribute('href', route);
      expect(link).toHaveAccessibleName(GUIDE_CATALOG_LINK_LABELS[column]);
      const header = INVENTORY_IMPORT_COLUMNS.find((entry) => entry.key === column)?.header ?? '';
      const row = within(panel).getByText(header, { selector: 'td' }).closest('tr') as HTMLElement;
      expect(row).toContainElement(link);
    }
    const nameRow = within(panel).getByText('Nombre', { selector: 'td' }).closest('tr') as HTMLElement;
    expect(within(nameRow).queryByRole('link')).toBeNull();
  });

  it('R3 lote y fecha de compra marcan que se rellenan solos si van vacíos', () => {
    render(<ImportGuide values={VALUES} />);

    const panel = screen.getByTestId(GUIDE_RULES_TESTID);
    const typeCount = Object.keys(IMPORT_TYPE_LABELS).length;
    for (const header of ['Lote', 'Fecha de compra']) {
      const row = within(panel).getByText(header, { selector: 'td' }).closest('tr') as HTMLElement;
      expect(within(row).getAllByText(GUIDE_RULE_OPTIONAL_AUTO_LABEL)).toHaveLength(typeCount);
    }
    const costRow = within(panel).getByText('Costo unitario', { selector: 'td' }).closest('tr') as HTMLElement;
    expect(within(costRow).queryByText(GUIDE_RULE_OPTIONAL_AUTO_LABEL)).toBeNull();
  });

  it('R3 los valores disponibles listan tipos, unidades, presentaciones y fórmulas de la empresa', async () => {
    const user = setupUser();
    render(<ImportGuide values={VALUES} />);

    await user.click(screen.getByRole('tab', { name: GUIDE_TABS.values }));

    const panel = screen.getByTestId(GUIDE_VALUES_TESTID);
    for (const value of [...Object.values(IMPORT_TYPE_LABELS), ...VALUES.units, ...VALUES.presentations, ...VALUES.formulas]) {
      expect(within(panel).getByText(value)).toBeInTheDocument();
    }
  });

  it('R3 sin valores de la empresa avisa y sigue mostrando los tipos', async () => {
    const user = setupUser();
    render(<ImportGuide values={null} />);

    await user.click(screen.getByRole('tab', { name: GUIDE_TABS.values }));

    const panel = screen.getByTestId(GUIDE_VALUES_TESTID);
    expect(within(panel).getByText(GUIDE_VALUES_UNAVAILABLE)).toBeInTheDocument();
    expect(within(panel).getByText(IMPORT_TYPE_LABELS.PRODUCT)).toBeInTheDocument();
  });

  it('R3 los ejemplos son los mismos de la plantilla, uno por tipo', async () => {
    const user = setupUser();
    render(<ImportGuide values={VALUES} />);

    await user.click(screen.getByRole('tab', { name: GUIDE_TABS.examples }));

    const panel = screen.getByTestId(GUIDE_EXAMPLES_TESTID);
    expect(within(panel).getAllByRole('row')).toHaveLength(1 + IMPORT_EXAMPLE_ROWS.length);
    for (const example of IMPORT_EXAMPLE_ROWS) expect(within(panel).getByText(example.lot)).toBeInTheDocument();
  });
});
