import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  ConditioningOrderScreen,
  ConditioningTeamList,
  ConditioningTeamPicker,
  FinishConditioningDialog,
  type ConditioningTeamSelection,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components';
import {
  ConditionedOrdersListSection,
  ConditioningOrdersListSection,
  ConditioningOrdersSkeleton,
  OrderOutcomeNotice,
} from '@/app/(private)/asignacion/components';
import { PackingOrderScreen } from '@/app/(private)/asignacion/empaque/[id]/components';
import type { DataTableParams } from '@/components/shared/data-table';
import type {
  ConditioningBatchForm,
  ConditioningBatchLineView,
  ConditioningOrderDetail,
  ConditioningOrderRow,
  ConditioningTeamCandidates,
  ConditioningTeamMemberView,
  FinishedOrderView,
  PackingOrderDetail,
} from '@/lib/modules/asignaciones';
import type { FinishConditioningResult } from '@/lib/modules/asignaciones/adapters/driving/order-conditioning-actions';
import { errorMessage, type ErrorState } from '@/lib/modules/errores';

import { errorInesperado } from '../../helpers/identificador-de-request';
import { WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';
import { arbolAccesible, resolverServerComponents } from './arbol-accesible';

/**
 * Lo que `asignacion-paridad` y `asignacion-listas-paridad` no cubren del acondicionador y del
 * empaque: vacios, esqueletos y filas de sus tres listas, los avisos de resultado, el detalle de
 * acondicionamiento con su equipo y su selector, el dialogo de terminar y la pantalla de empaque.
 * Mocks de `asignacion-listas-paridad.test.tsx` y de los tests de cada pieza.
 */

const {
  routerMock,
  getSessionUserMock,
  getSessionContextMock,
  listConditioningOrdersMock,
  listConditionedOrdersMock,
  finishConditioningActionMock,
} = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
  getSessionUserMock: vi.fn<() => Promise<unknown>>(),
  getSessionContextMock: vi.fn<() => Promise<unknown>>(),
  listConditioningOrdersMock: vi.fn<(actor: unknown, query: unknown) => Promise<unknown>>(),
  listConditionedOrdersMock: vi.fn<(actor: unknown, query: unknown) => Promise<unknown>>(),
  finishConditioningActionMock:
    vi.fn<(prev: FinishConditioningResult, data: FormData) => Promise<FinishConditioningResult>>(),
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, getSessionContext: getSessionContextMock },
  asignaciones: {
    listPackingOrders: vi.fn(),
    listConditioningOrders: listConditioningOrdersMock,
    listConditionedOrders: listConditionedOrdersMock,
  },
  observabilidad: {
    readRequestIdHeader: vi.fn(async () => '7b1c9f2e-4d3a-4f5b-9c0d-1e2f3a4b5c6d'),
  },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/asignacion',
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-assignment-actions', () => ({
  listAssignedOrdersAction: vi.fn(),
  listFinishedOrdersAction: vi.fn(),
  listCompanyOrdersAction: vi.fn(),
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-conditioning-actions', () => ({
  startConditioningAction: vi.fn(),
  finishConditioningAction: finishConditioningActionMock,
  saveConditioningBatchDataAction: vi.fn(),
}));

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-packing-actions', () => ({
  startPackingAction: vi.fn(),
  finishPackingAction: vi.fn(),
}));

const PARAMS: DataTableParams = { page: 1, pageSize: 10, sort: null, filters: {}, search: '' };

function pagina(items: readonly unknown[], page = 1) {
  return { items, total: items.length, page, pageSize: 10, totalPages: 1 };
}

async function renderSeccion(seccion: Promise<ReactNode>) {
  return render(<>{await resolverServerComponents(await seccion)}</>);
}

const POR_ACONDICIONAR: ConditioningOrderRow = {
  id: 'order-a',
  numberText: '2026-0000040',
  recipeName: 'Jarabe simple',
  quantity: '20.5000',
  unitId: 'unit-kg',
  unitLabel: 'kg',
  presentationLines: [
    { lineId: 'linea-1', packedPackages: null, presentationId: 'pres-1', presentationName: 'Frasco', packagingName: '500 g', packages: 12, presentationContent: null, presentationUnitLabel: null },
    { lineId: 'linea-2', packedPackages: null, presentationId: 'pres-2', presentationName: 'Bolsa', packagingName: null, packages: 4, presentationContent: null, presentationUnitLabel: null },
  ],
  status: 'POR_ACONDICIONAR',
  conditionedByName: null,
  conditionedById: null,
};

const EN_ACONDICIONAMIENTO: ConditioningOrderRow = {
  ...POR_ACONDICIONAR,
  id: 'order-b',
  numberText: '2026-0000041',
  recipeName: null,
  unitId: null,
  unitLabel: null,
  presentationLines: [],
  status: 'EN_ACONDICIONAMIENTO',
  conditionedByName: 'Berta Ruiz',
  conditionedById: 'user-2',
};

const ACONDICIONADO: FinishedOrderView = {
  id: 'order-c',
  numberText: '2026-0000042',
  recipeName: 'Jarabe simple',
  quantity: '12.5000',
  presentationLines: [
    { lineId: 'linea-3', packedPackages: null, presentationId: 'pres-1', presentationName: 'Frasco', packagingName: '500 g', packages: 5, presentationContent: null, presentationUnitLabel: null },
  ],
  unitId: null,
  unitLabel: null,
  finishedAt: new Date('2026-09-20T15:30:00.000Z'),
  responsibles: [],
};

const EQUIPO: readonly ConditioningTeamMemberView[] = [
  {
    userId: 'user-3',
    displayName: 'Carla Gómez',
    origin: { kind: 'workGroup', workGroupId: 'wg-1', workGroupName: 'Turno de mañana' },
  },
  { userId: 'user-4', displayName: 'Diego Pérez', origin: { kind: 'direct' } },
  {
    userId: 'user-5',
    displayName: 'Elena Soto',
    origin: { kind: 'workGroup', workGroupId: 'wg-2', workGroupName: 'Turno de tarde' },
  },
  {
    userId: 'user-6',
    displayName: 'Fabio Núñez',
    origin: { kind: 'workGroup', workGroupId: 'wg-1', workGroupName: 'Turno de mañana' },
  },
  { userId: 'user-7', displayName: 'Gema Ortiz', origin: { kind: 'direct' } },
];

const CANDIDATOS: ConditioningTeamCandidates = {
  people: [
    { id: 'user-3', displayName: 'Carla Gómez' },
    { id: 'user-4', displayName: 'Diego Pérez' },
    { id: 'user-5', displayName: 'Elena Soto' },
  ],
  workGroups: [
    { id: 'wg-1', name: 'Turno de mañana', contributes: 2, excludedAdministrators: 0 },
    { id: 'wg-2', name: 'Turno de tarde', contributes: 1, excludedAdministrators: 1 },
    { id: 'wg-3', name: 'Supervisión', contributes: 0, excludedAdministrators: 2 },
    { id: 'wg-4', name: 'Vacío', contributes: 0, excludedAdministrators: 0 },
  ],
};

const LINEA_DE_LOTE: ConditioningBatchLineView = {
  batchId: 'batch-1',
  presentationId: 'pres-1',
  presentationName: 'Frasco',
  packagingName: '500 g',
  packages: 12,
  provisionalLot: '0000042',
  lot: null,
  expiryDate: null,
  productionDate: null,
};

const LINEA_DE_LOTE_COMPLETA: ConditioningBatchLineView = {
  ...LINEA_DE_LOTE,
  batchId: 'batch-2',
  presentationId: 'pres-2',
  presentationName: 'Bolsa',
  packagingName: null,
  packages: 4,
  provisionalLot: null,
  lot: 'L-2026-07',
  expiryDate: '2027-09-30',
  productionDate: '2026-09-30',
};

const FORMULARIO_COMPARTIDO: ConditioningBatchForm = {
  kind: 'shared',
  lot: 'L-2026-07',
  expiryDate: '2027-09-30',
  productionDate: '2026-09-30',
};

function detalle(overrides: Partial<ConditioningOrderDetail> = {}): ConditioningOrderDetail {
  return { ...POR_ACONDICIONAR, team: [], batchData: null, conditioningSteps: null, ...overrides };
}

const MIO = {
  status: 'EN_ACONDICIONAMIENTO',
  conditionedByName: 'Ana Ruiz',
  conditionedById: 'user-1',
  team: EQUIPO,
} as const;

const ERROR_DE_CATALOGO: ErrorState = {
  status: 'error',
  code: 'unauthorized',
  message: errorMessage('unauthorized'),
};

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';

function pedidoDeEmpaque(overrides: Partial<PackingOrderDetail> = {}): PackingOrderDetail {
  return {
    id: 'order-1',
    numberText: '2026-0000030',
    recipeName: 'Jarabe simple',
    quantity: '12.5',
    presentationLines: [
      { lineId: 'linea-4', packedPackages: null, presentationId: 'p-1', presentationName: 'Botella 200 ml', packagingName: null, packages: 5, presentationContent: null, presentationUnitLabel: null },
      { lineId: 'linea-5', packedPackages: null, presentationId: 'p-2', presentationName: 'Garrafa 5 l', packagingName: 'Garrafa azul', packages: 2, presentationContent: null, presentationUnitLabel: null },
      { lineId: 'linea-6', packedPackages: null, presentationId: 'p-3', presentationName: null, packagingName: null, packages: 1, presentationContent: null, presentationUnitLabel: null },
    ],
    unitId: 'unit-1',
    unitLabel: 'kg',
    status: 'POR_EMPACAR',
    priority: 'MEDIA',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    packedByName: null,
    packedById: null,
    packingSteps: [],
    packingEvidence: [],
    finish: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue({
    id: 'u-1',
    username: 'acondicionador.prueba',
    displayName: 'Acondicionador De Prueba',
    roleName: 'Acondicionador',
    permissions: ['asignaciones.consultar', 'acondicionamiento.modificar'],
  });
  getSessionContextMock.mockResolvedValue({ companyId: 'company-1' });
  setViewportWidth(WIDE_VIEWPORT);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetViewport();
});

type Lista = {
  readonly nombre: string;
  readonly responder: (items: readonly unknown[], page: number) => void;
  readonly fila: unknown;
  readonly montar: (params: DataTableParams) => Promise<ReactNode>;
};

const LISTAS: readonly Lista[] = [
  {
    nombre: 'por acondicionar',
    responder: (items, page) => listConditioningOrdersMock.mockResolvedValue(pagina(items, page)),
    fila: POR_ACONDICIONAR,
    montar: (params) => ConditioningOrdersListSection({ params }),
  },
  {
    nombre: 'acondicionados',
    responder: (items, page) => listConditionedOrdersMock.mockResolvedValue(pagina(items, page)),
    fila: ACONDICIONADO,
    montar: (params) => ConditionedOrdersListSection({ params }),
  },
];

describe('paridad del acondicionador — sus tres listas', () => {
  it.each(LISTAS)('R4 R24 — $nombre, vacio', async (lista) => {
    lista.responder([], 1);
    await renderSeccion(lista.montar(PARAMS));
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it.each(LISTAS)('R4 R24 — $nombre, vacio en una pagina posterior', async (lista) => {
    lista.responder([], 3);
    await renderSeccion(lista.montar({ ...PARAMS, page: 3 }));
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it.each(LISTAS)('R24 — $nombre, con filas', async (lista) => {
    lista.responder(
      lista.fila === POR_ACONDICIONAR ? [POR_ACONDICIONAR, EN_ACONDICIONAMIENTO] : [lista.fila],
      1,
    );
    await renderSeccion(lista.montar(PARAMS));
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it.each(['por_acondicionar', 'acondicionados'] as const)(
    'R6 R24 — esqueleto de %s',
    (list) => {
      render(<ConditioningOrdersSkeleton rows={3} list={list} />);
      expect(arbolAccesible()).toMatchSnapshot();
    },
  );
});

describe('paridad del acondicionador — avisos de resultado', () => {
  it('R15 R24 — pedido empacado', () => {
    render(<OrderOutcomeNotice kind="packed" orderNumber="2026-0000030" />);
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R15 R24 — pedido acondicionado', () => {
    render(<OrderOutcomeNotice kind="conditioned" orderNumber="2026-0000040" />);
    expect(arbolAccesible()).toMatchSnapshot();
  });
});

describe('paridad del acondicionador — el detalle', () => {
  it('R11 R20 R24 — por acondicionar, sin equipo, con candidatos', () => {
    render(<ConditioningOrderScreen order={detalle()} canStart candidates={CANDIDATOS} />);
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R8 R11 R24 — en acondicionamiento por otra persona, con equipo, sin receta ni reparto', () => {
    render(<ConditioningOrderScreen order={detalle({ ...EN_ACONDICIONAMIENTO, team: EQUIPO })} />);
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R20 R24 — por acondicionar, con error de candidatos de catalogo', () => {
    render(<ConditioningOrderScreen order={detalle()} canStart candidatesError={ERROR_DE_CATALOGO} />);
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R20 R24 — por acondicionar, con error de candidatos inesperado', () => {
    render(<ConditioningOrderScreen order={detalle()} canStart candidatesError={errorInesperado()} />);
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R11 R13 R15 R24 — mio, con datos de lote incompletos y «Terminar» bloqueado', () => {
    render(
      <ConditioningOrderScreen
        order={detalle({
          ...MIO,
          batchData: {
            lines: [LINEA_DE_LOTE, LINEA_DE_LOTE_COMPLETA],
            missingCount: 1,
            form: {
              kind: 'divergent',
              lines: [
                { presentationId: 'pres-1', lot: '0000042' },
                { presentationId: 'pres-2', lot: 'L-2026-07' },
              ],
            },
          },
        })}
        canFinish
        finishBlocked
      />,
    );
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R11 R24 — mio, con los datos de lote completos y «Terminar» disponible', () => {
    render(
      <ConditioningOrderScreen
        order={detalle({
          ...MIO,
          batchData: { lines: [LINEA_DE_LOTE_COMPLETA], missingCount: 0, form: FORMULARIO_COMPARTIDO },
        })}
        canFinish
      />,
    );
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R17 R24 — mio, sin ninguna línea con lote: el formulario va deshabilitado', () => {
    render(
      <ConditioningOrderScreen
        order={detalle({
          ...MIO,
          batchData: {
            lines: [{ ...LINEA_DE_LOTE, batchId: null, provisionalLot: null }],
            missingCount: 1,
            form: { kind: 'no_batches' },
          },
        })}
        canFinish
        finishBlocked
      />,
    );
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it.each(['TERMINADO', 'ENTREGADO'] as const)('R11 R24 — %s, con su vuelta a la lista', (status) => {
    render(
      <ConditioningOrderScreen
        order={detalle({
          ...MIO,
          status,
          batchData: { lines: [LINEA_DE_LOTE_COMPLETA], missingCount: 0, form: FORMULARIO_COMPARTIDO },
        })}
      />,
    );
    expect(arbolAccesible()).toMatchSnapshot();
  });
});

describe('paridad del acondicionador — equipo y selector', () => {
  it('R8 R24 — la lista de equipo, directos primero y grupos por primera aparicion', () => {
    render(<ConditioningTeamList team={EQUIPO} />);
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R8 R24 — la lista de equipo, solo con grupos', () => {
    render(<ConditioningTeamList team={EQUIPO.filter((member) => member.origin.kind !== 'direct')} />);
    expect(arbolAccesible()).toMatchSnapshot();
  });

  function pintarSelector(
    selection: ConditioningTeamSelection = { userIds: [], workGroupIds: [] },
    candidates: ConditioningTeamCandidates = CANDIDATOS,
  ) {
    render(
      <ConditioningTeamPicker
        candidates={candidates}
        selection={selection}
        onSelectionChange={() => undefined}
      />,
    );
  }

  it('R10 R24 — el selector sin seleccion, con un grupo que no aporta nadie', () => {
    pintarSelector();
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R10 R24 — el selector con seleccion', () => {
    pintarSelector({ userIds: ['user-4', 'user-3'], workGroupIds: ['wg-2'] });
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R9 R10 R24 — el selector con busqueda, con mayusculas y espacios', () => {
    pintarSelector();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  ELENA ' } });
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R9 R10 R24 — el selector con una busqueda sin resultados', () => {
    pintarSelector();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nadie' } });
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R10 R24 — el selector sin personas ni grupos', () => {
    pintarSelector(undefined, { people: [], workGroups: [] });
    expect(arbolAccesible()).toMatchSnapshot();
  });
});

describe('paridad del acondicionador — el dialogo de terminar', () => {
  function pintarDialogo() {
    render(
      <FinishConditioningDialog
        open
        onOpenChange={() => undefined}
        orderId="33333333-3333-4333-8333-333333333333"
        orderNumber="2026-0000040"
      />,
    );
  }

  function avanzar(ms: number): void {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  it('R17 R24 — abierto, durante la espera', () => {
    vi.useFakeTimers();
    pintarDialogo();
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R17 R24 — abierto, pasada la espera', () => {
    vi.useFakeTimers();
    pintarDialogo();
    avanzar(5000);
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R17 R24 — abierto, con el error de la accion', async () => {
    finishConditioningActionMock.mockResolvedValue({
      status: 'error',
      code: 'order_conditioning_taken',
      message: 'Otra persona ya está acondicionando este pedido.',
    });
    vi.useFakeTimers();
    pintarDialogo();
    avanzar(5000);
    vi.useRealTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));
    });
    await within(screen.getByRole('alertdialog')).findByRole('alert');
    expect(arbolAccesible()).toMatchSnapshot();
  });
});

describe('paridad del empaque — la pantalla del pedido', () => {
  function pintar(order: PackingOrderDetail) {
    render(
      <PackingOrderScreen order={order} actorId={ACTOR_ID} backHref="/asignacion?vista=por_empacar" />,
    );
  }

  it('R11 R13 R24 — por empacar: «Comenzar»', () => {
    pintar(pedidoDeEmpaque());
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R11 R13 R24 — en empaque a mi nombre: «Terminar»', () => {
    pintar(
      pedidoDeEmpaque({
        status: 'EN_EMPAQUE',
        packedById: ACTOR_ID,
        packedByName: 'Empacador De Prueba',
        finish: {
          orderQuantity: '12.5',
          orderUnit: { id: 'unit-1', baseUnitId: null, factor: null },
          orderUnitLabel: 'kg',
          lines: [],
        },
      }),
    );
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R11 R13 R24 — en empaque por otra persona', () => {
    pintar(
      pedidoDeEmpaque({
        status: 'EN_EMPAQUE',
        packedById: '22222222-2222-4222-8222-222222222222',
        packedByName: 'Otra Persona',
        recipeName: null,
        unitId: null,
        unitLabel: null,
      }),
    );
    expect(arbolAccesible()).toMatchSnapshot();
  });

  it('R13 R24 — por empacar con el reparto vacio', () => {
    pintar(pedidoDeEmpaque({ presentationLines: [] }));
    expect(arbolAccesible()).toMatchSnapshot();
  });
});
