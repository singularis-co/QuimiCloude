import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  GUIDE_EXAMPLES_TESTID,
  GUIDE_RULES_TESTID,
  GUIDE_TABS,
  GUIDE_VALUES_TESTID,
  GUIDE_VALUES_UNAVAILABLE,
  ImportGuide,
} from '@/app/(private)/inventario/importar/components';
import { IMPORT_EXAMPLE_ROWS, IMPORT_TYPE_LABELS, INVENTORY_IMPORT_COLUMNS } from '@/lib/modules/inventario';

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
    expect(within(panel).getByText(/«Costo unitario» es obligatorio/)).toBeInTheDocument();
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
