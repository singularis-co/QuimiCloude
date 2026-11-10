import { readFileSync } from 'node:fs';
import path from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OrderExecutionScreen } from '@/app/(private)/asignacion/[id]/components';
import { ConditioningOrderScreen } from '@/app/(private)/asignacion/acondicionamiento/[id]/components';
import { RECIPE_HEADER_TEXTS, type RecipeAccess } from '@/app/(private)/asignacion/components';
import { PackingOrderScreen } from '@/app/(private)/asignacion/empaque/[id]/components';
import type {
  ConditioningOrderDetail,
  OtherRecipeView,
  PackingOrderDetail,
  StartedOrderExecution,
} from '@/lib/modules/asignaciones';
import { assignedOrderRoute, conditioningOrderRoute, packingOrderRoute } from '@/lib/shared/routes';

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-execution-actions', () => ({
  cancelAssignedOrderAction: vi.fn(),
  finishAssignedOrderAction: vi.fn(),
  recordStepMoveAction: vi.fn(),
  startAssignedOrderAction: vi.fn(),
}));
vi.mock('@/lib/modules/asignaciones/adapters/driving/order-packing-actions', () => ({
  finishPackingAction: vi.fn(),
  startPackingAction: vi.fn(),
}));
vi.mock('@/lib/modules/asignaciones/adapters/driving/order-conditioning-actions', () => ({
  finishConditioningAction: vi.fn(),
  recordConditioningStepAction: vi.fn(),
  saveConditioningBatchDataAction: vi.fn(),
  startConditioningAction: vi.fn(),
}));
vi.mock('@/lib/modules/asignaciones/adapters/driving/step-evidence-actions', () => ({
  registerEvidenceAction: vi.fn(),
  removeEvidenceAction: vi.fn(),
  requestEvidenceUploadAction: vi.fn(),
}));

const ORDER_ID = '33333333-3333-4333-8333-333333333333';
const LINE_A = '55555555-5555-4555-8555-555555555555';
const LINE_B = '66666666-6666-4666-8666-666666666666';
const LINE_C = '77777777-7777-4777-8777-777777777777';
const NUMBER = '2026-0001042';
const FULL_ACCESS: RecipeAccess = { execute: true, pack: true, condition: true };

const OTRAS: readonly OtherRecipeView[] = [
  { lineId: LINE_B, recipeName: 'Desengrasante alcalino', status: 'PENDIENTE' },
  { lineId: LINE_C, recipeName: 'Jabón líquido', status: 'CANCELADO' },
];

const EJECUCION: StartedOrderExecution = {
  orderId: ORDER_ID,
  lineId: LINE_A,
  numberText: NUMBER,
  recipe: { position: 1, count: 3 },
  otherRecipes: OTRAS,
  status: 'PENDIENTE',
  recipeName: 'Hipoclorito 5 %',
  orderQuantity: '200',
  steps: [{ blocks: [{ kind: 'paragraph', spans: [{ text: 'Paso uno' }] }] }],
  lines: [],
  tools: [],
  presentationLines: [],
  unitId: null,
  unitLabel: 'L',
  evidence: [],
  resumeStepPosition: null,
};

const EMPAQUE: PackingOrderDetail = {
  id: ORDER_ID,
  lineId: LINE_A,
  numberText: NUMBER,
  recipe: { position: 1, count: 3 },
  otherRecipes: OTRAS,
  recipeName: 'Hipoclorito 5 %',
  quantity: '200',
  presentationLines: [],
  unitId: 'unit-1',
  unitLabel: 'L',
  status: 'POR_EMPACAR',
  priority: 'MEDIA',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  packedByName: null,
  packedById: null,
  packingSteps: [],
  packingEvidence: [],
  finish: null,
};

const ACONDICIONAMIENTO: ConditioningOrderDetail = {
  id: ORDER_ID,
  lineId: LINE_A,
  numberText: NUMBER,
  recipe: { position: 1, count: 3 },
  otherRecipes: OTRAS,
  recipeName: 'Hipoclorito 5 %',
  quantity: '200',
  unitId: 'unit-1',
  unitLabel: 'L',
  presentationLines: [],
  status: 'POR_ACONDICIONAR',
  conditionedByName: null,
  conditionedById: null,
  team: [],
  batchData: null,
  conditioningSteps: null,
};

type Pantalla = {
  readonly nombre: string;
  readonly fase: string;
  readonly pintar: (cambios: { access?: RecipeAccess; unaReceta?: boolean }) => ReactElement;
};

const PANTALLAS: readonly Pantalla[] = [
  {
    nombre: 'ejecucion',
    fase: 'Fabricación',
    pintar: ({ access, unaReceta }) => (
      <OrderExecutionScreen
        lineId={LINE_A}
        access={access}
        execution={
          unaReceta ? { ...EJECUCION, recipe: { position: 1, count: 1 }, otherRecipes: [] } : EJECUCION
        }
      />
    ),
  },
  {
    nombre: 'empaque',
    fase: 'Empaque',
    pintar: ({ access, unaReceta }) => (
      <PackingOrderScreen
        actorId="user-1"
        backHref="/asignacion?vista=por_empacar"
        access={access}
        order={unaReceta ? { ...EMPAQUE, recipe: { position: 1, count: 1 }, otherRecipes: [] } : EMPAQUE}
      />
    ),
  },
  {
    nombre: 'acondicionamiento',
    fase: 'Acondicionamiento',
    pintar: ({ access, unaReceta }) => (
      <ConditioningOrderScreen
        access={access}
        order={
          unaReceta
            ? { ...ACONDICIONAMIENTO, recipe: { position: 1, count: 1 }, otherRecipes: [] }
            : ACONDICIONAMIENTO
        }
      />
    ),
  },
];

afterEach(() => {
  cleanup();
});

describe('pantallas de una receta — la cabecera', () => {
  it.each(PANTALLAS)(
    'R7: $nombre nombra la fase, el pedido, «Receta 1 de 3», la receta en el h1 y su estado',
    ({ fase, pintar }) => {
      render(pintar({ access: FULL_ACCESS }));

      const cabecera = screen.getByRole('banner');
      expect(within(cabecera).getByText(new RegExp(`^${fase}`))).toHaveTextContent(
        `${fase} · Pedido ${NUMBER} · Receta 1 de 3`,
      );
      expect(within(cabecera).getByRole('heading', { level: 1 })).toHaveTextContent('Hipoclorito 5 %');
      expect(within(cabecera).getAllByRole('heading', { level: 1 })).toHaveLength(1);
    },
  );

  it.each(PANTALLAS)(
    'R8: $nombre lista las otras recetas, con «Ir a esta receta» solo en la que se puede abrir',
    ({ pintar }) => {
      render(pintar({ access: FULL_ACCESS }));

      const lista = screen.getByRole('list', { name: RECIPE_HEADER_TEXTS.otherRecipes });
      const filas = within(lista).getAllByRole('listitem');
      expect(filas.map((fila) => fila.getAttribute('data-status'))).toEqual(['PENDIENTE', 'CANCELADO']);
      expect(within(filas[0]!).getByRole('link', { name: RECIPE_HEADER_TEXTS.goToRecipe })).toHaveAttribute(
        'href',
        assignedOrderRoute(ORDER_ID, LINE_B),
      );
      expect(within(filas[1]!).queryByRole('link')).toBeNull();
    },
  );

  it.each(PANTALLAS)('R8: $nombre sin el permiso de la ejecucion no ofrece ir a la receta pendiente', ({ pintar }) => {
    render(pintar({ access: { ...FULL_ACCESS, execute: false } }));

    expect(screen.queryByRole('link', { name: RECIPE_HEADER_TEXTS.goToRecipe })).toBeNull();
    expect(screen.getByRole('list', { name: RECIPE_HEADER_TEXTS.otherRecipes })).toHaveTextContent(
      'Desengrasante alcalino',
    );
  });

  it.each(PANTALLAS)('R8: $nombre sin permisos pasados no ofrece ningun enlace', ({ pintar }) => {
    render(pintar({}));

    expect(screen.queryByRole('link', { name: RECIPE_HEADER_TEXTS.goToRecipe })).toBeNull();
  });

  it.each(PANTALLAS)('R29: $nombre con una sola receta no muestra «Receta 1 de 1» ni otras recetas', ({ pintar, fase }) => {
    render(pintar({ access: FULL_ACCESS, unaReceta: true }));

    expect(screen.queryByText(/Receta \d+ de \d+/)).toBeNull();
    expect(screen.queryByRole('list', { name: RECIPE_HEADER_TEXTS.otherRecipes })).toBeNull();
    expect(screen.getByText(new RegExp(`^${fase}`))).toHaveTextContent(`${fase} · Pedido ${NUMBER}`);
  });

  it.each(PANTALLAS)('R31: $nombre no ofrece entregar la receta ni el pedido', ({ pintar }) => {
    render(pintar({ access: FULL_ACCESS }));

    const controles = [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')];
    expect(controles.length).toBeGreaterThan(0);
    for (const control of controles) {
      expect(control.textContent ?? '').not.toMatch(/entreg/i);
      expect(control.getAttribute('aria-label') ?? '').not.toMatch(/entreg/i);
    }
  });
});

describe('R8 — los destinos de las otras recetas en una pantalla real', () => {
  it('R8: empaque y acondicionamiento llevan a su pantalla, cada una con su permiso', () => {
    render(
      <OrderExecutionScreen
        lineId={LINE_A}
        access={FULL_ACCESS}
        execution={{
          ...EJECUCION,
          otherRecipes: [
            { lineId: LINE_B, recipeName: 'Desengrasante alcalino', status: 'EN_EMPAQUE' },
            { lineId: LINE_C, recipeName: 'Jabón líquido', status: 'EN_ACONDICIONAMIENTO' },
          ],
        }}
      />,
    );

    const enlaces = screen.getAllByRole('link', { name: RECIPE_HEADER_TEXTS.goToRecipe });
    expect(enlaces.map((enlace) => enlace.getAttribute('href'))).toEqual([
      packingOrderRoute(ORDER_ID, LINE_B),
      conditioningOrderRoute(ORDER_ID, LINE_C),
    ]);
  });
});

describe('R31 — ninguna pantalla de planta importa la accion de entregar', () => {
  const RAIZ = path.join(process.cwd(), 'app', '(private)', 'asignacion');
  const ARCHIVOS = [
    path.join(RAIZ, 'page.tsx'),
    path.join(RAIZ, '[id]', 'page.tsx'),
    path.join(RAIZ, '[id]', 'components', 'order-execution-screen.tsx'),
    path.join(RAIZ, 'empaque', '[id]', 'page.tsx'),
    path.join(RAIZ, 'empaque', '[id]', 'components', 'packing-order-screen.tsx'),
    path.join(RAIZ, 'acondicionamiento', '[id]', 'page.tsx'),
    path.join(RAIZ, 'acondicionamiento', '[id]', 'components', 'conditioning-order-screen.tsx'),
    path.join(RAIZ, 'components', 'recipe-header.tsx'),
    path.join(RAIZ, 'components', 'assignment-row-actions.tsx'),
  ];

  it.each(ARCHIVOS)('R31: %s no nombra ninguna accion de entrega', (archivo) => {
    expect(readFileSync(archivo, 'utf8')).not.toMatch(/deliver[A-Za-z]*Action|deliverOrder|Entregar/);
  });
});

describe('R6 — la pantalla muestra solo la receta de la dirección', () => {
  it.each(PANTALLAS)(
    'R6: $nombre muestra los datos de la receta nombrada y la otra receta solo sale en «Otras recetas»',
    ({ pintar }) => {
      render(pintar({ access: FULL_ACCESS }));

      const lista = screen.getByRole('list', { name: RECIPE_HEADER_TEXTS.otherRecipes });
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hipoclorito 5 %');
      for (const otra of ['Desengrasante alcalino', 'Jabón líquido']) {
        const apariciones = screen.getAllByText(otra);
        expect(apariciones).toHaveLength(1);
        expect(lista).toContainElement(apariciones[0]!);
      }
      for (const enlace of document.querySelectorAll('[href*="' + LINE_B + '"], [href*="' + LINE_C + '"]')) {
        expect(lista).toContainElement(enlace as HTMLElement);
      }
    },
  );

  it('R6: ejecucion pinta los pasos de su receta, no los de otra del mismo pedido', () => {
    render(
      <OrderExecutionScreen
        lineId={LINE_A}
        access={FULL_ACCESS}
        execution={{
          ...EJECUCION,
          status: 'EN_CURSO',
          otherRecipes: [{ lineId: LINE_B, recipeName: 'Desengrasante alcalino', status: 'EN_CURSO' }],
        }}
      />,
    );

    expect(screen.getAllByText('Paso uno').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Paso de la otra receta/)).toBeNull();
    const lista = screen.getByRole('list', { name: RECIPE_HEADER_TEXTS.otherRecipes });
    expect(lista).toContainElement(screen.getByText('Desengrasante alcalino'));
  });
});
