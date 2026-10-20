// La celda «Teléfono» de la lista de clientes.
//
// El texto del formato internacional se deriva de `formatPhoneInternational`: el literal exacto
// depende de los metadatos de la librería y queda fuera de este test.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PHONE_COLUMN_ID, buildCustomerColumns } from '@/app/(private)/clientes/components';
import { formatPhoneInternational, type CustomerView } from '@/lib/modules/clientes';

const BASE: CustomerView = {
  id: '11111111-1111-4111-8111-111111111111',
  firstNames: 'Ana',
  lastNames: 'Torres',
  city: 'Cali',
  phone: null,
  phoneCountry: null,
  phoneE164: null,
  phoneIssue: null,
  email: null,
  address: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: null,
  updatedBy: null,
};

const E164 = '573001234567';

function renderPhoneCell(customer: CustomerView) {
  const column = buildCustomerColumns({ rowActions: () => null }).find(
    (candidate) => candidate.id === PHONE_COLUMN_ID,
  );
  if (column === undefined) throw new Error('falta la columna del teléfono');
  return render(<div data-testid="celda">{column.cell(customer)}</div>);
}

afterEach(() => {
  cleanup();
});

describe('columna «Teléfono» de la lista de clientes', () => {
  it('R29 — un cliente con phone_e164 muestra el número en formato internacional, en mono', () => {
    renderPhoneCell({ ...BASE, phone: E164, phoneCountry: 'CO', phoneE164: E164 });

    const international = formatPhoneInternational(E164);
    expect(international.startsWith('+57 ')).toBe(true);
    const text = screen.getByText(international);
    expect(text).toHaveClass('font-mono');
    expect(screen.queryByTestId(`customer-phone-issue-${BASE.id}`)).toBeNull();
  });

  it('R30 — invalid_format: el teléfono antiguo en gris y la etiqueta corta «Sin formato válido» en tono waiting', () => {
    renderPhoneCell({
      ...BASE,
      phone: 'ext 204 oficina',
      phoneCountry: 'CO',
      phoneIssue: 'invalid_format',
    });

    const issue = screen.getByTestId(`customer-phone-issue-${BASE.id}`);
    expect(screen.getByText('ext 204 oficina')).toHaveClass('text-muted-foreground');
    const badge = issue.querySelector('[data-tone]');
    expect(badge).toHaveAttribute('data-tone', 'waiting');
    expect(badge).toHaveTextContent('Sin formato válido');
    expect(issue).not.toHaveTextContent('Teléfono sin formato válido');
  });

  it('R30 — duplicate: el teléfono antiguo en gris y la etiqueta corta «Duplicado: revisar» en tono waiting', () => {
    renderPhoneCell({
      ...BASE,
      phone: '300 123 4567',
      phoneCountry: 'CO',
      phoneIssue: 'duplicate',
    });

    const issue = screen.getByTestId(`customer-phone-issue-${BASE.id}`);
    expect(screen.getByText('300 123 4567')).toHaveClass('text-muted-foreground');
    const badge = issue.querySelector('[data-tone]');
    expect(badge).toHaveAttribute('data-tone', 'waiting');
    expect(badge).toHaveTextContent('Duplicado: revisar');
    expect(issue).not.toHaveTextContent('Teléfono duplicado: revisar');
  });

  it('R36 — un cliente pendiente de relleno muestra su teléfono antiguo en gris y en mono, sin etiqueta', () => {
    renderPhoneCell({ ...BASE, phone: '300-123-4567 casa' });

    const legacy = screen.getByTestId(`customer-phone-legacy-${BASE.id}`);
    expect(legacy).toHaveTextContent('300-123-4567 casa');
    expect(legacy).toHaveClass('text-muted-foreground');
    expect(legacy).toHaveClass('font-mono');
    expect(screen.getByTestId('celda').querySelector('[data-tone]')).toBeNull();
    expect(screen.queryByTestId(`customer-missing-${PHONE_COLUMN_ID}`)).toBeNull();
  });

  it('R29 — un cliente sin teléfono muestra la marca de dato ausente', () => {
    renderPhoneCell(BASE);

    expect(screen.getByTestId(`customer-missing-${PHONE_COLUMN_ID}`)).toHaveAccessibleName('Sin dato');
    expect(screen.queryByTestId(`customer-phone-issue-${BASE.id}`)).toBeNull();
  });
});
