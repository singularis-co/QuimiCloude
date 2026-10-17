// La pestaña Datos del detalle de empresa: lista clave-valor de solo lectura.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CompanyDataPanel } from '@/app/(private)/maestro/empresas/[id]/components';
import type { CompanyDetail } from '@/lib/modules/identity';

const COMPLETA: CompanyDetail = {
  id: '2d8e9f0a-3142-4c5d-8e6f-7a8b9c0d1e2f',
  name: 'Químicos del Valle',
  taxId: '900.481.227-3',
  contactEmail: 'contacto@quimicosvalle.co',
  contactPhone: '602 488 1200',
  country: 'CO',
  createdAt: new Date('2026-09-14T23:30:00.000Z'),
  status: 'active',
  deletedAt: null,
};

const VACIA: CompanyDetail = {
  ...COMPLETA,
  taxId: null,
  contactEmail: null,
  contactPhone: null,
  country: null,
};

afterEach(() => {
  cleanup();
});

function valor(clave: string): HTMLElement {
  return screen.getByTestId(`company-data-${clave}`);
}

describe('la pestaña Datos', () => {
  it('R29: muestra, en este orden, los siete datos de la empresa', () => {
    render(<CompanyDataPanel company={COMPLETA} />);
    const lista = within(screen.getByTestId('company-data-panel'));
    expect(lista.getAllByRole('term').map((termino) => termino.textContent)).toEqual([
      'Nombre',
      'Identificación fiscal',
      'Correo de contacto',
      'Teléfono de contacto',
      'País',
      'Creada',
      'Dada de baja',
    ]);
  });

  it('R29: con todos los datos pinta sus valores, el pais con su prefijo y la fecha dd/mm/aaaa en UTC', () => {
    render(<CompanyDataPanel company={COMPLETA} />);
    expect(valor('name')).toHaveTextContent('Químicos del Valle');
    expect(valor('taxId')).toHaveTextContent('900.481.227-3');
    expect(valor('contactEmail')).toHaveTextContent('contacto@quimicosvalle.co');
    expect(valor('contactPhone')).toHaveTextContent('602 488 1200');
    expect(valor('country')).toHaveTextContent('Colombia (+57)');
    expect(valor('createdAt')).toHaveTextContent('14/09/2026');
    expect(valor('deletedAt')).toHaveTextContent('—');
  });

  it('R29: lo que no tiene valor lleva la marca de vacio', () => {
    render(<CompanyDataPanel company={VACIA} />);
    for (const clave of ['taxId', 'contactEmail', 'contactPhone', 'country', 'deletedAt']) {
      expect(valor(clave)).toHaveTextContent(/^—$/);
    }
  });

  it('R29: una empresa de baja muestra su fecha de baja', () => {
    render(
      <CompanyDataPanel
        company={{ ...COMPLETA, status: 'deleted', deletedAt: new Date('2026-10-15T08:00:00.000Z') }}
      />,
    );
    expect(valor('deletedAt')).toHaveTextContent('15/10/2026');
  });

  it('R29: es de solo lectura, sin campos ni botones', () => {
    render(<CompanyDataPanel company={COMPLETA} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
