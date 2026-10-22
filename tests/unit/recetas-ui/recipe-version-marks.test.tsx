import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupUser } from '../../helpers/user-event';

import {
  RecipeLinesField,
  RecipeVersionForm,
  type RecipeLineFormValue,
} from '@/app/(private)/produccion/formulas/components';
import type { RecipeDetail, RecipeLineView } from '@/lib/modules/recetas';

const { listProductsActionMock } = vi.hoisted(() => ({ listProductsActionMock: vi.fn() }));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listProductsAction: listProductsActionMock,
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  createRecipeVersionAction: vi.fn(),
  updateRecipeVersionAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const EMPTY_PAGE = { items: [], totalPages: 1 };
const ORIGINAL_ID = '11111111-1111-4111-8111-111111111111';

function originalLine(key: string, percentage: string, productName: string | null = `Producto ${key}`): RecipeLineView {
  return { id: `line-${key}`, productId: `product-${key}`, productName, percentage, productUnitId: null, productStock: null };
}

function lineValue(key: string, percentage: string): RecipeLineFormValue {
  return { key, productId: `product-${key}`, productName: `Producto ${key}`, percentage, productUnitId: null };
}

function Harness({
  initialLines,
  baseline,
}: {
  initialLines: readonly RecipeLineFormValue[];
  baseline?: readonly RecipeLineView[];
}) {
  const [lines, setLines] = useState(initialLines);
  return (
    <RecipeLinesField
      lines={lines}
      onChange={setLines}
      units={[]}
      initialProductPage={EMPTY_PAGE}
      tools={[]}
      onToolsChange={() => {}}
      initialMachinePage={EMPTY_PAGE}
      baseline={baseline}
    />
  );
}

const BASELINE: readonly RecipeLineView[] = [
  originalLine('a', '50.00'),
  originalLine('b', '30.00'),
  originalLine('c', '20.00'),
];

// a igual, b cambiada, x añadida; c queda quitada.
const LINES = [lineValue('a', '50'), lineValue('b', '25,5'), lineValue('x', '10')];

function versionDetail(isUnderReview: boolean): RecipeDetail {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Sin sal',
    description: null,
    imageUrl: null,
    stepCount: 0,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-02T00:00:00Z'),
    createdBy: null,
    updatedBy: null,
    steps: [],
    packingSteps: [],
    conditioningSteps: [],
    lines: [],
    tools: [],
    original: { id: ORIGINAL_ID, name: 'Jabón' },
    isUnderReview,
    displayName: 'Jabón · Sin sal',
  };
}

function renderEdit(isUnderReview: boolean) {
  render(
    <RecipeVersionForm
      mode="edit"
      original={{ id: ORIGINAL_ID, name: 'Jabón', lines: [], tools: [] }}
      version={versionDetail(isUnderReview)}
      units={[]}
      initialProductPage={EMPTY_PAGE}
      initialMachinePage={EMPTY_PAGE}
    />,
  );
}

describe('marcas de línea de la versión (R33)', () => {
  it.each([
    [0, 'same', 'neutral', 'Igual'],
    [1, 'changed', 'waiting', 'Cambiado'],
    [2, 'added', 'success', 'Añadido'],
  ] as const)('R33: la línea %i lleva data-mark=%s con StatusBadge %s', (index, mark, tone, label) => {
    render(<Harness baseline={BASELINE} initialLines={LINES} />);

    const marca = screen.getByTestId(`recipe-line-mark-${index}`);
    expect(marca).toHaveAttribute('data-mark', mark);
    expect(marca).toHaveAttribute('data-slot', 'badge');
    expect(marca).toHaveAttribute('data-tone', tone);
    expect(marca).toHaveTextContent(label);
  });

  it('R33: con «Cambiado» el porcentaje original se pinta tachado y el texto no cambia', () => {
    render(<Harness baseline={BASELINE} initialLines={LINES} />);

    expect(screen.getByTestId('recipe-line-original-1')).toHaveTextContent('Original: 30,00 %');
    const cifra = screen.getByTestId('recipe-line-original-value-1');
    expect(cifra).toHaveTextContent('30,00');
    expect(cifra).toHaveClass('line-through');
    expect(screen.queryByTestId('recipe-line-original-value-0')).toBeNull();
    expect(screen.queryByTestId('recipe-line-original-value-2')).toBeNull();
  });

  it('R33: la fila cambiada va en ámbar suave, la añadida en verde suave y la igual sin fondo', () => {
    render(<Harness baseline={BASELINE} initialLines={LINES} />);

    const [igual, cambiada, anadida] = screen.getAllByTestId('recipe-line-row');
    expect(cambiada).toHaveClass('bg-warning-subtle/45', 'border-warning-border');
    expect(anadida).toHaveClass('bg-success-subtle/45', 'border-success-border');
    expect(igual!.className).not.toMatch(/bg-(warning|success)-subtle/);
  });

  it('R33: cada quitado lleva «Quitado» en danger y el nombre tachado', () => {
    render(<Harness baseline={BASELINE} initialLines={LINES} />);

    const quitados = screen.getByTestId('recipe-lines-removed');
    const fila = within(quitados).getByTestId('recipe-line-removed-0');
    const marca = within(fila).getByTestId('recipe-line-removed-mark-0');
    expect(marca).toHaveAttribute('data-tone', 'danger');
    expect(marca).toHaveTextContent('Quitado');
    const nombre = within(fila).getByTestId('recipe-line-removed-name-0');
    expect(nombre).toHaveTextContent('Producto c');
    expect(nombre).toHaveClass('line-through');
    expect(fila).toHaveTextContent('20,00 %');
  });

  it('R33: el código de la marca ya no usa Badge ni MARK_VARIANT', () => {
    const carpeta = join(process.cwd(), 'app', '(private)', 'produccion', 'formulas', 'components');
    for (const archivo of ['recipe-lines-field.tsx', 'recipe-version-form.tsx']) {
      const fuente = readFileSync(join(carpeta, archivo), 'utf8');
      expect(fuente, archivo).not.toContain('MARK_VARIANT');
      expect(fuente, archivo).not.toContain("from '@/components/ui/badge'");
    }
  });
});

describe('resumen de marcas (R34)', () => {
  function cifras() {
    const resumen = screen.getByTestId('recipe-lines-diff-summary');
    return {
      resumen,
      igual: within(resumen).getByTestId('recipe-lines-diff-summary-same'),
      cambiado: within(resumen).getByTestId('recipe-lines-diff-summary-changed'),
      anadido: within(resumen).getByTestId('recipe-lines-diff-summary-added'),
    };
  }

  it('R34: sin baseline no hay resumen', () => {
    render(<Harness initialLines={LINES} />);

    expect(screen.queryByTestId('recipe-lines-diff-summary')).toBeNull();
  });

  it('R34: la cabecera pinta «Igual N», «Cambiado N» y «Añadido N» con StatusBadge', () => {
    render(<Harness baseline={BASELINE} initialLines={LINES} />);

    const { resumen, igual, cambiado, anadido } = cifras();
    const cabecera = screen.getByRole('heading', { name: 'Ingredientes y herramientas' });
    expect(cabecera.parentElement).toContainElement(resumen);
    expect(igual).toHaveTextContent('Igual 1');
    expect(igual).toHaveAttribute('data-tone', 'neutral');
    expect(cambiado).toHaveTextContent('Cambiado 1');
    expect(cambiado).toHaveAttribute('data-tone', 'waiting');
    expect(anadido).toHaveTextContent('Añadido 1');
    expect(anadido).toHaveAttribute('data-tone', 'success');
  });

  it('R34: al cambiar una línea el resumen cuenta las marcas nuevas', async () => {
    const user = setupUser();
    render(<Harness baseline={BASELINE} initialLines={LINES} />);

    const campo = screen.getByTestId('recipe-line-percentage-1');
    await user.clear(campo);
    await user.type(campo, '30');

    expect(screen.getByTestId('recipe-line-mark-1')).toHaveAttribute('data-mark', 'same');
    const { igual, cambiado, anadido } = cifras();
    expect(igual).toHaveTextContent('Igual 2');
    expect(cambiado).toHaveTextContent('Cambiado 0');
    expect(anadido).toHaveTextContent('Añadido 1');
  });
});

describe('«Por revisar» en el formulario de versión (R35)', () => {
  it('R35: con la versión por revisar pinta «Por revisar» en StatusBadge waiting', () => {
    renderEdit(true);

    const marca = screen.getByTestId('recipe-version-form-under-review');
    expect(marca).toHaveAttribute('data-slot', 'badge');
    expect(marca).toHaveAttribute('data-tone', 'waiting');
    expect(marca).toHaveTextContent('Por revisar');
    expect(marca).toHaveClass('whitespace-nowrap');
  });

  it('R35: sin revisión pendiente no lo pinta', () => {
    renderEdit(false);

    expect(screen.queryByTestId('recipe-version-form-under-review')).toBeNull();
  });
});
