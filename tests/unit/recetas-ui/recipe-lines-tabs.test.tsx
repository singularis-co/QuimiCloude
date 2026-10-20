import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupUser } from '../../helpers/user-event';

import {
  RecipeLinesField,
  type RecipeLineFormValue,
  type RecipeToolFormValue,
} from '@/app/(private)/produccion/formulas/components';
import { isLineIncomplete } from '@/app/(private)/produccion/formulas/components/recipe-lines-field';

/**
 * Tabs de líneas de la receta: ingredientes (PRODUCT, con % y cantidad) y herramientas
 * (MACHINE, con cantidad entera propia y sin %: no entra a la suma).
 *
 * Se monta `RecipeLinesField` directamente porque los tabs son SUYOS: el formulario solo le
 * pasa las dos primeras páginas ya filtradas por tipo. `listProductsAction` está mockeada
 * porque `ProductPicker` la importa; los casos de filtro SÍ la invocan (búsqueda con término).
 */

const { listProductsActionMock } = vi.hoisted(() => ({ listProductsActionMock: vi.fn() }));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listProductsAction: listProductsActionMock,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const PRODUCT_PAGE = {
  items: [{ id: 'product-1', name: 'Ácido cítrico', unitId: null }],
  totalPages: 1,
};
const MACHINE_PAGE = {
  items: [{ id: 'machine-1', name: 'Agitador industrial', unitId: null }],
  totalPages: 1,
};

function lineValue(key: string, percentage: string): RecipeLineFormValue {
  return { key, productId: `product-${key}`, productName: `Producto ${key}`, percentage, productUnitId: null };
}

function toolValue(key: string): RecipeToolFormValue {
  return { key, productId: `machine-${key}`, productName: `Herramienta ${key}`, quantity: '1' };
}

function Harness({
  initialLines = [] as readonly RecipeLineFormValue[],
  initialTools = [] as readonly RecipeToolFormValue[],
}) {
  const [lines, setLines] = useState(initialLines);
  const [tools, setTools] = useState<readonly RecipeToolFormValue[]>(initialTools);
  return (
    <RecipeLinesField
      lines={lines}
      onChange={setLines}
      tools={tools}
      onToolsChange={setTools}
      units={[]}
      initialProductPage={PRODUCT_PAGE}
      initialMachinePage={MACHINE_PAGE}
    />
  );
}

describe('tabs de líneas: ingredientes y máquinas', () => {
  it('pinta los dos tabs e ingredientes queda activo por defecto', () => {
    render(<Harness />);

    expect(screen.getByTestId('recipe-lines-tab-ingredients')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-lines-tab-machines')).toBeInTheDocument();
    // El tab de ingredientes es el activo: su fila fantasma sigue en pantalla.
    expect(screen.getByTestId('recipe-line-product-0')).toBeInTheDocument();
  });

  it('al 100 % no se puede pedir otra línea: todos los `+` se deshabilitan', () => {
    render(<Harness initialLines={[lineValue('a', '60'), lineValue('b', '40')]} />);

    expect(screen.getByTestId('recipe-lines-sum')).toHaveAttribute('data-complete', 'true');
    expect(screen.getByTestId('recipe-line-add-0')).toBeDisabled();
    expect(screen.getByTestId('recipe-line-add-1')).toBeDisabled();
  });

  it('al quitar una línea del 100 %, el `+` restante vuelve a habilitarse', async () => {
    const user = setupUser();
    render(<Harness initialLines={[lineValue('a', '60'), lineValue('b', '40')]} />);

    expect(screen.getByTestId('recipe-line-add-0')).toBeDisabled();

    await user.click(screen.getByTestId('recipe-line-remove-1'));

    expect(screen.getByTestId('recipe-lines-sum')).toHaveAttribute('data-complete', 'false');
    expect(screen.getByTestId('recipe-line-add-0')).toBeEnabled();
  });

  it('el tab de máquinas no lleva % ni cantidad de referencia', async () => {
    const user = setupUser();
    render(<Harness />);

    await user.click(screen.getByTestId('recipe-lines-tab-machines'));

    expect(screen.getByTestId('recipe-machine-product-0')).toBeInTheDocument();
    expect(screen.queryByTestId('recipe-machine-percentage-0')).toBeNull();
    expect(screen.queryByTestId('recipe-machine-amount-0')).toBeNull();
    // El fantasma de herramientas pide herramienta, no ingrediente.
    expect(screen.getByTestId('recipe-machine-product-0')).toHaveAttribute(
      'placeholder',
      'Buscar herramienta',
    );
  });

  it('las máquinas se agregan múltiples: elegir habilita el `+` y añade otra fila', async () => {
    const user = setupUser();
    render(<Harness />);

    await user.click(screen.getByTestId('recipe-lines-tab-machines'));
    expect(screen.getByTestId('recipe-machine-add-0')).toBeDisabled();

    await user.click(screen.getByTestId('recipe-machine-product-0'));
    await user.click(await screen.findByRole('option', { name: 'Agitador industrial' }));

    expect(screen.getByTestId('recipe-machine-add-0')).toBeEnabled();

    await user.click(screen.getByTestId('recipe-machine-add-0'));
    expect(screen.getAllByTestId('recipe-machine-row')).toHaveLength(2);
  });

  it('lo elegido en máquinas no toca la suma de ingredientes', async () => {
    const user = setupUser();
    render(<Harness initialLines={[lineValue('a', '60')]} />);

    await user.click(screen.getByTestId('recipe-lines-tab-machines'));
    await user.click(screen.getByTestId('recipe-machine-product-0'));
    await user.click(await screen.findByRole('option', { name: 'Agitador industrial' }));

    // El panel inactivo se desmonta: se vuelve al tab para leer la suma.
    await user.click(screen.getByTestId('recipe-lines-tab-ingredients'));
    expect(screen.getByTestId('recipe-lines-sum')).toHaveTextContent(
      'Suma: 60,00 % — faltan 40,00 %',
    );
  });
});

describe('pestañas con contador', () => {
  it('R12: cada pestaña pinta su cifra junto a la etiqueta y conserva su data-testid', () => {
    render(
      <Harness
        initialLines={[lineValue('a', '30'), lineValue('b', '20'), lineValue('c', '10')]}
        initialTools={[toolValue('x')]}
      />,
    );

    const ingredients = screen.getByTestId('recipe-lines-tab-ingredients');
    const machines = screen.getByTestId('recipe-lines-tab-machines');
    expect(ingredients).toHaveAttribute('role', 'tab');
    expect(machines).toHaveAttribute('role', 'tab');

    const ingredientsCount = screen.getByTestId('recipe-lines-tab-ingredients-count');
    const machinesCount = screen.getByTestId('recipe-lines-tab-machines-count');
    expect(ingredients).toContainElement(ingredientsCount);
    expect(machines).toContainElement(machinesCount);
    expect(ingredientsCount).toHaveTextContent(/^3$/);
    expect(machinesCount).toHaveTextContent(/^1$/);
    expect(ingredientsCount).toHaveClass('font-mono', 'tabular-nums');

    expect(screen.getByRole('tab', { name: 'Ingredientes 3' })).toBe(ingredients);
    expect(screen.getByRole('tab', { name: 'Herramientas 1' })).toBe(machines);
  });

  it('R12: la fila en blanco de arranque no cuenta', async () => {
    const user = setupUser();
    render(<Harness />);

    expect(screen.getByTestId('recipe-line-product-0')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-lines-tab-ingredients-count')).toHaveTextContent(/^0$/);

    await user.click(screen.getByTestId('recipe-lines-tab-machines'));
    expect(screen.getByTestId('recipe-machine-product-0')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-lines-tab-machines-count')).toHaveTextContent(/^0$/);
  });

  it('R12: la cifra cambia al añadir o quitar líneas', async () => {
    const user = setupUser();
    render(<Harness initialLines={[lineValue('a', '30'), lineValue('b', '20')]} />);

    const ingredientsCount = screen.getByTestId('recipe-lines-tab-ingredients-count');
    expect(ingredientsCount).toHaveTextContent(/^2$/);
    await user.click(screen.getByTestId('recipe-line-add-1'));
    expect(ingredientsCount).toHaveTextContent(/^3$/);
    await user.click(screen.getByTestId('recipe-line-remove-0'));
    expect(ingredientsCount).toHaveTextContent(/^2$/);

    await user.click(screen.getByTestId('recipe-lines-tab-machines'));
    const machinesCount = screen.getByTestId('recipe-lines-tab-machines-count');
    await user.click(screen.getByTestId('recipe-machine-product-0'));
    await user.click(await screen.findByRole('option', { name: 'Agitador industrial' }));
    expect(machinesCount).toHaveTextContent(/^1$/);
    await user.click(screen.getByTestId('recipe-machine-add-0'));
    expect(machinesCount).toHaveTextContent(/^2$/);
    await user.click(screen.getByTestId('recipe-machine-remove-1'));
    expect(machinesCount).toHaveTextContent(/^1$/);
  });

  it('R12: la pastilla activa es TabsIndicator dentro de una lista con relative', () => {
    render(<Harness />);

    const list = screen.getByRole('tablist', { name: 'Líneas de la receta por tipo' });
    expect(list).toHaveClass('relative');
    const indicator = list.querySelector('[data-slot="tabs-indicator"]');
    expect(indicator).not.toBeNull();
    expect(list.firstElementChild).toBe(indicator);
  });
});

describe('el select filtra por tipo en el servidor', () => {
  it('buscar en ingredientes pide type=PRODUCT', async () => {
    const user = setupUser();
    listProductsActionMock.mockResolvedValue({
      status: 'success',
      data: { items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 },
    });
    render(<Harness />);

    await user.click(screen.getByTestId('recipe-line-product-0'));
    await user.type(screen.getByTestId('recipe-line-product-0'), 'acido');

    await waitFor(() =>
      expect(listProductsActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'acido',
          filters: { type: { kind: 'select', values: ['PRODUCT'] } },
        }),
      ),
    );
  });

  it('buscar en máquinas pide type=MACHINE', async () => {
    const user = setupUser();
    listProductsActionMock.mockResolvedValue({
      status: 'success',
      data: { items: [], total: 0, page: 1, pageSize: 25, totalPages: 1 },
    });
    render(<Harness />);

    await user.click(screen.getByTestId('recipe-lines-tab-machines'));
    await user.click(screen.getByTestId('recipe-machine-product-0'));
    await user.type(screen.getByTestId('recipe-machine-product-0'), 'agitador');

    await waitFor(() =>
      expect(listProductsActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'agitador',
          filters: { type: { kind: 'select', values: ['MACHINE'] } },
        }),
      ),
    );
  });
});

describe('«+» de ingredientes: solo con todas las líneas completas y la suma por debajo de 100 %', () => {
  it('caso válido: líneas completas que suman menos de 100 % dejan todos los `+` activos', () => {
    render(<Harness initialLines={[lineValue('a', '30'), lineValue('b', '20,5')]} />);
    expect(screen.getByTestId('recipe-line-add-0')).toBeEnabled();
    expect(screen.getByTestId('recipe-line-add-1')).toBeEnabled();
  });

  it('una línea sin porcentaje deshabilita todos los `+`', () => {
    render(<Harness initialLines={[lineValue('a', '30'), lineValue('b', '')]} />);
    expect(screen.getByTestId('recipe-line-add-0')).toBeDisabled();
    expect(screen.getByTestId('recipe-line-add-1')).toBeDisabled();
  });

  it('una línea con porcentaje cero o que no parsea deshabilita todos los `+`', () => {
    render(<Harness initialLines={[lineValue('a', '30'), lineValue('b', '0')]} />);
    expect(screen.getByTestId('recipe-line-add-0')).toBeDisabled();
    cleanup();
    render(<Harness initialLines={[lineValue('a', '30'), lineValue('b', '5,')]} />);
    expect(screen.getByTestId('recipe-line-add-0')).toBeDisabled();
  });

  it('una línea sin producto deshabilita todos los `+`', () => {
    render(
      <Harness
        initialLines={[lineValue('a', '30'), { ...lineValue('b', '20'), productId: '', productName: '' }]}
      />,
    );
    expect(screen.getByTestId('recipe-line-add-0')).toBeDisabled();
    expect(screen.getByTestId('recipe-line-add-1')).toBeDisabled();
  });

  it('la fila fantasma, vacía, no deja añadir', () => {
    render(<Harness />);
    expect(screen.getByTestId('recipe-line-add-0')).toBeDisabled();
  });

  it('isLineIncomplete marca producto vacío, de baja y porcentajes vacíos o cero', () => {
    expect(isLineIncomplete(lineValue('a', '10'))).toBe(false);
    expect(isLineIncomplete(lineValue('a', '10,25'))).toBe(false);
    expect(isLineIncomplete(lineValue('a', ''))).toBe(true);
    expect(isLineIncomplete(lineValue('a', '0,00'))).toBe(true);
    expect(isLineIncomplete({ ...lineValue('a', '10'), productId: '' })).toBe(true);
    expect(isLineIncomplete({ ...lineValue('a', '10'), productName: null })).toBe(true);
  });
});
