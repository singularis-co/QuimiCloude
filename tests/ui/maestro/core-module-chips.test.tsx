// La sección Núcleo de la pestaña Módulos: fichas fijas, sin nada que se pueda pulsar.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CoreModuleChips } from '@/app/(private)/maestro/empresas/[id]/components/modulos/core-module-chips';

afterEach(() => {
  cleanup();
});

describe('CoreModuleChips', () => {
  it('R19: once fichas del núcleo con candado y nada pulsable', () => {
    render(<CoreModuleChips />);
    const seccion = screen.getByRole('region', { name: 'Núcleo' });
    expect(within(seccion).getByRole('heading', { level: 2, name: 'Núcleo' })).toBeInTheDocument();
    expect(
      within(seccion).getByText('Siempre prendido en todas las empresas. No se puede apagar.'),
    ).toBeInTheDocument();

    const fichas = within(seccion).getAllByRole('listitem');
    expect(fichas.map((ficha) => ficha.textContent)).toEqual([
      'Usuarios y grupos',
      'Unidades',
      'Presentaciones',
      'Inventario',
      'Fórmulas',
      'Pedidos',
      'Asignación y ejecución',
      'Empaque',
      'Acondicionamiento',
      'Terminados y entregas',
      'Clientes',
    ]);
    for (const ficha of fichas) {
      expect(ficha.querySelector('svg.lucide-lock')).not.toBeNull();
    }

    expect(within(seccion).queryByRole('switch')).toBeNull();
    expect(within(seccion).queryByRole('button')).toBeNull();
    expect(within(seccion).queryByRole('link')).toBeNull();
    expect(seccion.querySelector('input, button, a, [tabindex]')).toBeNull();
  });
});
