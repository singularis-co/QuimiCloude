// QC-35 T8 — Las acciones de fila y los estados finales: R23, R24, R43, R45.
//
// **Migrado al menu "de los 3 puntos" por la misma decision humana puntual que ya migro
// `user-row-actions.tsx`** (ver el comentario de cabecera de `order-row-actions.tsx`): las
// cuatro acciones ya no son botones en linea, sino items de `RowActionsMenu` que aparecen al
// abrir su disparador. R45 se prueba ahora en DOS mitades: el disparador esta siempre presente y
// mide 44x44 px sin ninguna interaccion previa, y las cuatro acciones solo llegan al arbol tras
// abrirlo con un clic.
//
// **Los dobles FALLAN si se les llama.** Las seis Server Actions de `pedidos` y los tres
// callbacks de enganche estan sustituidos por funciones que lanzan: asi «no se invoca ninguna
// operacion» se comprueba de verdad, en vez de mirar un contador que un fallo silencioso podria
// dejar a cero por otra razon.
//
// **Items deshabilitados: `fireEvent.click` y no `user.click`.** `user-event` se niega a pinchar
// un elemento con `pointer-events: none` (la clase que trae `data-disabled`), que es justo la
// comprobacion visual que ya cubre `pedidos-viewport.test.tsx`. Aqui lo que se demuestra es la
// otra mitad: que aunque alguien dispare el evento nativo, el primitivo del menu no llega a
// invocar `onSelect`.
//
// **Ningun assert sobre copy** (R44): los controles se localizan por `data-testid` y por su rol
// accesible. Con el pedido en estado final no hay ningun texto de motivo que afirmar: las tres
// acciones simplemente quedan `aria-disabled` dentro del menu.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setupUser } from '../../helpers/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_ACTION_CUSTOMER_TESTID,
  ORDER_ACTION_DELIVER_TESTID,
  ORDER_ACTION_DISTRIBUTION_TESTID,
  OrderRowActions,
  acceptsDistributionEdit,
  isFinalOrderStatus,
  orderRowActionsSpec,
  type OrderRowAction,
} from '@/app/(private)/pedidos/components';
import { RowActionsMenu } from '@/components/shared/row-actions-menu';
import {
  ORDER_STATUS_VALUES,
  formatOrderNumber,
  type OrderStatus,
  type OrderSummary,
} from '@/lib/modules/pedidos';

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => {
  const noDebeInvocarse = (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse desde las acciones de fila`);
  };
  return {
    listOrdersAction: vi.fn(noDebeInvocarse('listOrdersAction')),
    getOrderAction: vi.fn(noDebeInvocarse('getOrderAction')),
    createOrderAction: vi.fn(noDebeInvocarse('createOrderAction')),
    updateOrderAction: vi.fn(noDebeInvocarse('updateOrderAction')),
    cancelOrderAction: vi.fn(noDebeInvocarse('cancelOrderAction')),
    deleteOrderAction: vi.fn(noDebeInvocarse('deleteOrderAction')),
  };
});

// El barrel de la ruta arrastra el formulario de edicion, que importa el selector de
// presentacion: se aisla igual que `order-actions` de aqui arriba.
vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  listPresentationsAction: vi.fn(() => {
    throw new Error('listPresentationsAction no debe invocarse desde las acciones de fila');
  }),
  createPresentationAction: vi.fn(() => {
    throw new Error('createPresentationAction no debe invocarse desde las acciones de fila');
  }),
}));

function pedido(status: OrderStatus, overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    number: { year: 2026, sequence: 42 },
    numberText: formatOrderNumber({ year: 2026, sequence: 42 }),
    recipeId: '22222222-2222-4222-8222-222222222222',
    recipeName: 'Esmalte azul',
    recipeVersion: null,
    quantity: '12.5000',
    priority: 'MEDIA',
    status,
    cancellationReason: status === 'CANCELADO' ? 'Cliente anuló el encargo' : null,
    ingredientsCost: null,
    packagingCost: null,
    actualCost: null,
    salePrice: null,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    presentationLines: [],
    unitId: null,
    unitLabel: null,
    pendingDelivery: { kind: 'not_packed' },
    customer: null,
    recipeImageUrl: null,
    ...overrides,
  };
}

/** Objetivo tactil minimo que exige R45: 44x44 px, que en Tailwind es `min-h-11 min-w-11`. */
const CLASES_TACTILES = ['min-h-11', 'min-w-11'] as const;

/** Abre el menu pulsando su disparador. Mismo patron que `user-row-actions.test.tsx`. */
function abrirMenu(): void {
  fireEvent.click(screen.getByTestId('order-row-actions'));
}

/** Los tres callbacks de enganche, como dobles que FALLAN si alguien los llama. */
function enganchesQueFallan() {
  return {
    onEdit: vi.fn(() => {
      throw new Error('no se debe abrir la edicion de un pedido cerrado');
    }),
    onCancel: vi.fn(() => {
      throw new Error('no se debe abrir la cancelacion de un pedido cerrado');
    }),
    onDelete: vi.fn(() => {
      throw new Error('no se debe abrir el borrado de un pedido cerrado');
    }),
  };
}

const CONTROLES = ['order-action-edit', 'order-action-cancel', 'order-action-delete'] as const;
const RESPONSABLES_TESTID = 'order-action-responsibles';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('el disparador esta SIEMPRE en el DOM, sin ninguna accion detras hasta abrirlo (R23, R45)', () => {
  it('existe sin interaccion previa, mide al menos 44x44 px y ninguna accion esta aun en el arbol', () => {
    render(<OrderRowActions order={pedido('PENDIENTE')} />);

    const disparador = screen.getByTestId('order-row-actions');
    expect(disparador).toBeInTheDocument();
    for (const clase of CLASES_TACTILES) {
      expect(disparador.className, `disparador sin ${clase}`).toContain(clase);
    }

    for (const testId of [...CONTROLES, RESPONSABLES_TESTID]) {
      expect(screen.queryByTestId(testId)).toBeNull();
    }
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('no depende de `:hover`: nada en su clase condiciona la visibilidad al puntero', () => {
    render(<OrderRowActions order={pedido('PENDIENTE')} />);

    const disparador = screen.getByTestId('order-row-actions');
    expect(disparador.className).not.toContain('group-hover');
    expect(disparador.className).not.toContain('hover:opacity');
  });

  it('lleva el identificador de la fila como DATO, no como texto visible', () => {
    const elPedido = pedido('PENDIENTE');
    render(<OrderRowActions order={elPedido} />);

    const disparador = screen.getByTestId('order-row-actions');
    expect(disparador).toHaveAttribute('data-order-id', elPedido.id);
    expect(disparador.textContent).not.toContain(elPedido.id);
  });
});

describe('al abrir el disparador, el menu trae las CUATRO acciones y ninguna mas (R23, R41)', () => {
  it('editar, cancelar, borrar y responsables, las cuatro presentes y ninguna otra', async () => {
    render(<OrderRowActions order={pedido('PENDIENTE')} />);

    abrirMenu();

    expect(await screen.findByTestId('order-action-edit')).toBeInTheDocument();
    expect(screen.getByTestId('order-action-cancel')).toBeInTheDocument();
    expect(screen.getByTestId('order-action-delete')).toBeInTheDocument();
    expect(screen.getByTestId(RESPONSABLES_TESTID)).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(4);
  });

  // Decision humana puntual (2026-10-04): los items dicen solo el verbo; el numero queda en el
  // disparador.
  it('R41 — ningun item repite el numero del pedido', async () => {
    const elPedido = pedido('PENDIENTE');
    render(<OrderRowActions order={elPedido} />);

    abrirMenu();
    await screen.findByTestId('order-action-edit');

    for (const item of screen.getAllByRole('menuitem')) {
      expect(item.textContent).not.toContain(elPedido.numberText);
    }
  });
});

describe('con el pedido abierto, pulsar una accion emite su enganche con la fila recibida por props (R43)', () => {
  it('editar', async () => {
    const onEdit = vi.fn();
    render(<OrderRowActions order={pedido('EN_CURSO')} onEdit={onEdit} />);

    abrirMenu();
    fireEvent.click(await screen.findByTestId('order-action-edit'));

    expect(onEdit).toHaveBeenCalledExactlyOnceWith(pedido('EN_CURSO'));
  });

  it('cancelar', async () => {
    const onCancel = vi.fn();
    render(<OrderRowActions order={pedido('EN_CURSO')} onCancel={onCancel} />);

    abrirMenu();
    fireEvent.click(await screen.findByTestId('order-action-cancel'));

    expect(onCancel).toHaveBeenCalledExactlyOnceWith(pedido('EN_CURSO'));
  });

  it('borrar', async () => {
    const onDelete = vi.fn();
    render(<OrderRowActions order={pedido('EN_CURSO')} onDelete={onDelete} />);

    abrirMenu();
    fireEvent.click(await screen.findByTestId('order-action-delete'));

    expect(onDelete).toHaveBeenCalledExactlyOnceWith(pedido('EN_CURSO'));
  });

  it('sin manejadores —el panel y los dialogos aun no existen— pulsar no rompe nada', async () => {
    render(<OrderRowActions order={pedido('EN_CURSO')} />);

    abrirMenu();
    fireEvent.click(await screen.findByTestId('order-action-edit'));

    expect(screen.getByTestId('order-row-actions')).toBeInTheDocument();
  });
});

describe('con el pedido en estado final las tres acciones estan deshabilitadas (R24, R42)', () => {
  it.each(['ENTREGADO', 'CANCELADO', 'POR_EMPACAR', 'EN_EMPAQUE'] as const)(
    'con un pedido %s: las tres marcadas `aria-disabled` y ninguna operacion invocada',
    async (status) => {
      const enganches = enganchesQueFallan();
      render(<OrderRowActions order={pedido(status)} {...enganches} />);

      abrirMenu();
      for (const testId of CONTROLES) {
        expect(await screen.findByTestId(testId)).toHaveAttribute('aria-disabled', 'true');
      }

      // El primitivo deja el item en el arbol pero bloquea su `onSelect`: se dispara el evento
      // nativo a mano (sin pasar por la comprobacion de `pointer-events` de `user-event`, que ya
      // cubre `pedidos-viewport.test.tsx`) y se confirma que ningun enganche llega a invocarse.
      for (const testId of CONTROLES) {
        fireEvent.click(screen.getByTestId(testId));
      }
      expect(enganches.onEdit).not.toHaveBeenCalled();
      expect(enganches.onCancel).not.toHaveBeenCalled();
      expect(enganches.onDelete).not.toHaveBeenCalled();
    },
  );

  it.each(['PENDIENTE', 'EN_CURSO'] as const)(
    'con un pedido %s las tres acciones no llevan `aria-disabled`',
    async (status) => {
      render(<OrderRowActions order={pedido(status)} />);

      abrirMenu();
      for (const testId of CONTROLES) {
        expect(await screen.findByTestId(testId)).not.toHaveAttribute('aria-disabled');
      }
    },
  );
});

describe('el predicado de estado final es UNO solo y sale del contrato (R24, R42)', () => {
  it('R22: exactamente `ENTREGADO`, `CANCELADO`, `POR_EMPACAR`, `EN_EMPAQUE`, `POR_ACONDICIONAR`, `EN_ACONDICIONAMIENTO` y `TERMINADO` de los valores que publica `pedidos`', () => {
    const finales = ORDER_STATUS_VALUES.filter((status) => isFinalOrderStatus(status));

    expect(finales).toEqual([
      'ENTREGADO',
      'CANCELADO',
      'POR_EMPACAR',
      'EN_EMPAQUE',
      'POR_ACONDICIONAR',
      'EN_ACONDICIONAMIENTO',
      'TERMINADO',
    ]);
  });
});

describe('los estados de acondicionamiento son finales y no admiten la edicion de reparto', () => {
  const ESTADOS_DE_ACONDICIONAMIENTO = ['POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO'] as const;

  it.each(ESTADOS_DE_ACONDICIONAMIENTO)('R22: %s es final y no acepta la edicion acotada de reparto', (status) => {
    expect(isFinalOrderStatus(status)).toBe(true);
    expect(acceptsDistributionEdit(status)).toBe(false);
  });

  it.each(ESTADOS_DE_ACONDICIONAMIENTO)(
    'R22: con un pedido %s, editar, cancelar y eliminar deshabilitados, sin «Reparto y unidad» y con «Responsables» activa',
    async (status) => {
      const enganches = enganchesQueFallan();
      const onResponsibles = vi.fn();
      render(
        <OrderRowActions
          order={pedido(status)}
          {...enganches}
          onResponsibles={onResponsibles}
          canEditDistribution
          onDistribution={vi.fn(() => {
            throw new Error('no se debe abrir el reparto de un pedido en acondicionamiento');
          })}
        />,
      );

      abrirMenu();
      for (const testId of CONTROLES) {
        expect(await screen.findByTestId(testId)).toHaveAttribute('aria-disabled', 'true');
      }
      expect(screen.queryByTestId(ORDER_ACTION_DISTRIBUTION_TESTID)).toBeNull();

      for (const testId of CONTROLES) {
        fireEvent.click(screen.getByTestId(testId));
      }
      expect(enganches.onEdit).not.toHaveBeenCalled();
      expect(enganches.onCancel).not.toHaveBeenCalled();
      expect(enganches.onDelete).not.toHaveBeenCalled();

      const responsables = screen.getByTestId(RESPONSABLES_TESTID);
      expect(responsables).not.toHaveAttribute('aria-disabled');
      fireEvent.click(responsables);
      expect(onResponsibles).toHaveBeenCalledExactlyOnceWith(pedido(status));
    },
  );
});

// ---------------------------------------------------------------------------------------------
// QC-102 T13 — La CUARTA accion del menu, «Responsables»: R24.
//
// Lo que este bloque protege es la asimetria deliberada de `design.md > 3.2`: las tres acciones
// de QC-35 mueren con el pedido cerrado porque lo MODIFICAN; esta solo abre el panel para VER, y
// QC-87 R13 permite consultar responsables en los cuatro estados. Si alguien "uniformara" el
// menu deshabilitando las cuatro, aqui se pone rojo.
// ---------------------------------------------------------------------------------------------

describe('QC-102 — la entrada propia «Responsables» (R24)', () => {
  it('existe en el menu, visible, con nombre accesible y sin `aria-disabled`', async () => {
    render(<OrderRowActions order={pedido('PENDIENTE')} />);

    abrirMenu();

    const item = await screen.findByTestId(RESPONSABLES_TESTID);
    expect(item).toBeVisible();
    expect(item).toHaveAccessibleName();
    expect(item).not.toHaveAttribute('aria-disabled');
  });

  it('pulsarla emite su enganche con la fila: ver responsables NO exige abrir la edicion', async () => {
    const user = setupUser();
    const onResponsibles = vi.fn();
    const onEdit = vi.fn(() => {
      throw new Error('ver responsables no debe abrir el formulario de edicion');
    });
    render(
      <OrderRowActions order={pedido('EN_CURSO')} onEdit={onEdit} onResponsibles={onResponsibles} />,
    );

    abrirMenu();
    await user.click(await screen.findByTestId(RESPONSABLES_TESTID));

    expect(onResponsibles).toHaveBeenCalledExactlyOnceWith(pedido('EN_CURSO'));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it.each(['ENTREGADO', 'CANCELADO'] as const)(
    'con un pedido %s sigue ACTIVA, mientras las otras tres siguen deshabilitadas',
    async (status) => {
      const enganches = enganchesQueFallan();
      const onResponsibles = vi.fn();
      render(
        <OrderRowActions order={pedido(status)} {...enganches} onResponsibles={onResponsibles} />,
      );

      abrirMenu();

      // Las tres de QC-35, intactas: `aria-disabled`.
      for (const testId of CONTROLES) {
        expect(await screen.findByTestId(testId)).toHaveAttribute('aria-disabled', 'true');
      }

      // Y la cuarta, viva: se puede pulsar y emite.
      const item = screen.getByTestId(RESPONSABLES_TESTID);
      expect(item).not.toHaveAttribute('aria-disabled');
      fireEvent.click(item);
      expect(onResponsibles).toHaveBeenCalledExactlyOnceWith(pedido(status));

      // Sin haber abierto nada de lo que el pedido cerrado prohibe.
      expect(enganches.onEdit).not.toHaveBeenCalled();
      expect(enganches.onCancel).not.toHaveBeenCalled();
      expect(enganches.onDelete).not.toHaveBeenCalled();
    },
  );
});

describe('la accion «Cliente»', () => {
  const CLIENTE_CERRADO = ['ENTREGADO', 'CANCELADO'] as const satisfies readonly OrderStatus[];
  const CLIENTE_ABIERTO = ORDER_STATUS_VALUES.filter(
    (status) => !(CLIENTE_CERRADO as readonly OrderStatus[]).includes(status),
  );

  it('R39: los diez estados del contrato quedan repartidos entre abiertos y cerrados', () => {
    expect(ORDER_STATUS_VALUES).toHaveLength(10);
    expect(CLIENTE_ABIERTO).toEqual([
      'PENDIENTE',
      'EN_CURSO',
      'POR_EMPACAR',
      'EN_EMPAQUE',
      'BLOQUEADO',
      'POR_ACONDICIONAR',
      'EN_ACONDICIONAMIENTO',
      'TERMINADO',
    ]);
  });

  it.each(CLIENTE_ABIERTO)('R39: con canEditCustomer aparece y esta habilitada en %s', async (status) => {
    const onCustomer = vi.fn();
    render(<OrderRowActions order={pedido(status)} canEditCustomer onCustomer={onCustomer} />);

    abrirMenu();

    const item = await screen.findByTestId(ORDER_ACTION_CUSTOMER_TESTID);
    expect(item).not.toHaveAttribute('aria-disabled');
    fireEvent.click(item);
    expect(onCustomer).toHaveBeenCalledExactlyOnceWith(pedido(status));
  });

  it.each(CLIENTE_CERRADO)(
    'R39: con canEditCustomer aparece deshabilitada en %s y pulsarla no emite',
    async (status) => {
      const onCustomer = vi.fn(() => {
        throw new Error('no se debe abrir el cambio de cliente de un pedido entregado o cancelado');
      });
      render(<OrderRowActions order={pedido(status)} canEditCustomer onCustomer={onCustomer} />);

      abrirMenu();

      const item = await screen.findByTestId(ORDER_ACTION_CUSTOMER_TESTID);
      expect(item).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(item);
      expect(onCustomer).not.toHaveBeenCalled();
    },
  );

  it.each(ORDER_STATUS_VALUES)('R39: sin canEditCustomer no aparece en %s', async (status) => {
    render(<OrderRowActions order={pedido(status)} />);

    abrirMenu();

    await screen.findByTestId('order-action-edit');
    expect(screen.queryByTestId(ORDER_ACTION_CUSTOMER_TESTID)).toBeNull();
  });

  it('va detras de «Responsables» y delante de «Reparto y unidad»', async () => {
    render(<OrderRowActions order={pedido('POR_EMPACAR')} canEditCustomer canEditDistribution />);

    abrirMenu();
    await screen.findByTestId(ORDER_ACTION_CUSTOMER_TESTID);

    expect(screen.getAllByRole('menuitem').map((item) => item.getAttribute('data-testid'))).toEqual([
      'order-action-edit',
      RESPONSABLES_TESTID,
      ORDER_ACTION_CUSTOMER_TESTID,
      ORDER_ACTION_DISTRIBUTION_TESTID,
      'order-action-cancel',
      'order-action-delete',
    ]);
  });
});

describe('la accion «Entregar»', () => {
  const NO_ENTREGABLES = ORDER_STATUS_VALUES.filter((status) => status !== 'TERMINADO');

  it('R4: los otros nueve estados del contrato no admiten la entrega', () => {
    expect(NO_ENTREGABLES).toHaveLength(9);
  });

  it('R4: con canDeliver aparece en TERMINADO, habilitada, y emite su enganche con la fila', async () => {
    const onDeliver = vi.fn();
    render(<OrderRowActions order={pedido('TERMINADO')} canDeliver onDeliver={onDeliver} />);

    abrirMenu();

    const item = await screen.findByTestId(ORDER_ACTION_DELIVER_TESTID);
    expect(item).not.toHaveAttribute('aria-disabled');
    fireEvent.click(item);
    expect(onDeliver).toHaveBeenCalledExactlyOnceWith(pedido('TERMINADO'));
  });

  it.each(NO_ENTREGABLES)('R4: con canDeliver no aparece en %s', async (status) => {
    render(<OrderRowActions order={pedido(status)} canDeliver onDeliver={vi.fn()} />);

    abrirMenu();

    await screen.findByTestId('order-action-edit');
    expect(screen.queryByTestId(ORDER_ACTION_DELIVER_TESTID)).toBeNull();
  });

  it.each(ORDER_STATUS_VALUES)('R4: sin canDeliver no esta en el DOM en %s', async (status) => {
    render(<OrderRowActions order={pedido(status)} onDeliver={vi.fn()} />);

    abrirMenu();

    await screen.findByTestId('order-action-edit');
    expect(screen.queryByTestId(ORDER_ACTION_DELIVER_TESTID)).toBeNull();
    expect(document.querySelector(`[data-testid="${ORDER_ACTION_DELIVER_TESTID}"]`)).toBeNull();
  });

  it('R4: va la ultima antes de «Cancelar» y «Eliminar»', async () => {
    render(<OrderRowActions order={pedido('TERMINADO')} canEditCustomer canDeliver />);

    abrirMenu();
    await screen.findByTestId(ORDER_ACTION_DELIVER_TESTID);

    expect(screen.getAllByRole('menuitem').map((item) => item.getAttribute('data-testid'))).toEqual([
      'order-action-edit',
      RESPONSABLES_TESTID,
      ORDER_ACTION_CUSTOMER_TESTID,
      'order-action-deliveries',
      ORDER_ACTION_DELIVER_TESTID,
      'order-action-cancel',
      'order-action-delete',
    ]);
  });
});

describe('la accion «Entregas»', () => {
  const ENTREGAS_TESTID = 'order-action-deliveries';
  const CON_ENTREGAS = ['TERMINADO', 'ENTREGADO'] as const satisfies readonly OrderStatus[];
  const SIN_ENTREGAS = ORDER_STATUS_VALUES.filter(
    (status) => !(CON_ENTREGAS as readonly OrderStatus[]).includes(status),
  );

  it('R5: los otros ocho estados del contrato no ofrecen la lista de entregas', () => {
    expect(SIN_ENTREGAS).toHaveLength(8);
  });

  it.each(CON_ENTREGAS)(
    'R5: aparece en %s, habilitada y sin pedir permiso propio, y emite su enganche con la fila',
    async (status) => {
      const onDeliveries = vi.fn();
      render(<OrderRowActions order={pedido(status)} onDeliveries={onDeliveries} />);

      abrirMenu();

      const item = await screen.findByTestId(ENTREGAS_TESTID);
      expect(item).not.toHaveAttribute('aria-disabled');
      fireEvent.click(item);
      expect(onDeliveries).toHaveBeenCalledExactlyOnceWith(pedido(status));
    },
  );

  it.each(SIN_ENTREGAS)('R5: no esta en el DOM en %s', async (status) => {
    render(
      <OrderRowActions
        order={pedido(status)}
        canDeliver
        canEditCustomer
        canEditDistribution
        onDeliveries={vi.fn()}
      />,
    );

    abrirMenu();

    await screen.findByTestId('order-action-edit');
    expect(screen.queryByTestId(ENTREGAS_TESTID)).toBeNull();
    expect(document.querySelector(`[data-testid="${ENTREGAS_TESTID}"]`)).toBeNull();
  });

  it('R5: va justo delante de «Entregar»', async () => {
    render(<OrderRowActions order={pedido('TERMINADO')} canDeliver />);

    abrirMenu();
    await screen.findByTestId(ENTREGAS_TESTID);

    const ids = screen.getAllByRole('menuitem').map((item) => item.getAttribute('data-testid'));
    expect(ids.indexOf(ORDER_ACTION_DELIVER_TESTID)).toBe(ids.indexOf(ENTREGAS_TESTID) + 1);
  });
});

// ---------------------------------------------------------------------------------------------
// El menu como datos: `orderRowActionsSpec` alimenta la fila y la tarjeta (R10, R11, R12).
// La tabla de reglas esta escrita a mano, sin llamar a los predicados de produccion.
// ---------------------------------------------------------------------------------------------

const ORDEN_R11: readonly OrderRowAction[] = [
  'edit',
  'responsibles',
  'customer',
  'distribution',
  'deliveries',
  'deliver',
  'cancel',
  'delete',
];

const TESTID_DE: Readonly<Record<OrderRowAction, string>> = {
  edit: 'order-action-edit',
  responsibles: 'order-action-responsibles',
  customer: 'order-action-customer',
  distribution: 'order-action-distribution',
  deliveries: 'order-action-deliveries',
  deliver: 'order-action-deliver',
  cancel: 'order-action-cancel',
  delete: 'order-action-delete',
};

const FINALES: readonly OrderStatus[] = [
  'POR_EMPACAR',
  'EN_EMPAQUE',
  'ENTREGADO',
  'CANCELADO',
  'POR_ACONDICIONAR',
  'EN_ACONDICIONAMIENTO',
  'TERMINADO',
];

type Permisos = {
  readonly canEditDistribution: boolean;
  readonly canEditCustomer: boolean;
  readonly canDeliver: boolean;
};

/** Lo que el menu debe ofrecer: clave ausente = omitido; valor = si va deshabilitado. */
function esperado(status: OrderStatus, permisos: Permisos): Partial<Record<OrderRowAction, boolean>> {
  const final = FINALES.includes(status);
  const reglas: Partial<Record<OrderRowAction, boolean>> = { edit: final, responsibles: false };
  if (permisos.canEditCustomer) reglas.customer = status === 'ENTREGADO' || status === 'CANCELADO';
  if (permisos.canEditDistribution && status === 'POR_EMPACAR') reglas.distribution = false;
  if (status === 'TERMINADO' || status === 'ENTREGADO') reglas.deliveries = false;
  if (permisos.canDeliver && status === 'TERMINADO') reglas.deliver = false;
  reglas.cancel = final;
  reglas.delete = final;
  return reglas;
}

const COMBINACIONES: readonly Permisos[] = [false, true].flatMap((canEditDistribution) =>
  [false, true].flatMap((canEditCustomer) =>
    [false, true].map((canDeliver) => ({ canEditDistribution, canEditCustomer, canDeliver })),
  ),
);

const TODOS_LOS_PERMISOS: Permisos = { canEditDistribution: true, canEditCustomer: true, canDeliver: true };

function especificacion(
  status: OrderStatus,
  permisos: Permisos = TODOS_LOS_PERMISOS,
  onAction: (action: OrderRowAction, order: OrderSummary) => void = vi.fn(),
) {
  return orderRowActionsSpec({ order: pedido(status), ...permisos, onAction });
}

function claves(status: OrderStatus, permisos: Permisos = TODOS_LOS_PERMISOS): string[] {
  return especificacion(status, permisos).items.map((item) => item.key);
}

describe('orderRowActionsSpec: orden, separador y destructivos (R11)', () => {
  it('R11: en POR_EMPACAR con todos los permisos, Editar, Responsables, Cliente, Reparto y unidad, Cancelar, Eliminar', () => {
    expect(claves('POR_EMPACAR')).toEqual(['edit', 'responsibles', 'customer', 'distribution', 'cancel', 'delete']);
  });

  it('R11: en TERMINADO con todos los permisos, Entregas y Entregar van antes de Cancelar y Eliminar', () => {
    expect(claves('TERMINADO')).toEqual([
      'edit',
      'responsibles',
      'customer',
      'deliveries',
      'deliver',
      'cancel',
      'delete',
    ]);
  });

  it.each(ORDER_STATUS_VALUES)('R11: en %s, con cualquier permiso, los items siguen el orden del menu', (status) => {
    for (const permisos of COMBINACIONES) {
      const orden = claves(status, permisos);
      expect(orden).toEqual(ORDEN_R11.filter((accion) => orden.includes(accion)));
    }
  });

  it.each(ORDER_STATUS_VALUES)('R11: en %s solo «Cancelar» lleva separador delante', (status) => {
    const conSeparador = especificacion(status).items.filter((item) => item.separatorBefore === true);
    expect(conSeparador.map((item) => item.key)).toEqual(['cancel']);
  });

  it.each(ORDER_STATUS_VALUES)('R11: en %s «Cancelar» y «Eliminar» son los unicos destructivos', (status) => {
    const destructivos = especificacion(status).items.filter((item) => item.destructive === true);
    expect(destructivos.map((item) => item.key)).toEqual(['cancel', 'delete']);
  });

  it('R11: cada item conserva su data-testid de hoy', () => {
    for (const status of ['POR_EMPACAR', 'TERMINADO'] as const) {
      for (const item of especificacion(status).items) {
        expect(item.testId).toBe(TESTID_DE[item.key as OrderRowAction]);
      }
    }
  });

  it('R11, R14: abierto el menu, hay una linea divisoria justo antes de «Cancelar»', async () => {
    render(<OrderRowActions order={pedido('PENDIENTE')} />);

    abrirMenu();
    const cancelar = await screen.findByTestId('order-action-cancel');

    expect(screen.getAllByRole('separator')).toHaveLength(1);
    expect(cancelar.previousElementSibling).toHaveAttribute('role', 'separator');
  });
});

describe('orderRowActionsSpec: reglas por estado y permiso (R12)', () => {
  const CASOS = ORDER_STATUS_VALUES.flatMap((status) =>
    COMBINACIONES.map((permisos) => [status, permisos] as const),
  );

  it.each(CASOS)('R12: en %s con %o, cada item aparece, se deshabilita o se omite segun la regla', (status, permisos) => {
    const reglas = esperado(status, permisos);
    const items = especificacion(status, permisos).items;

    expect(items.map((item) => item.key)).toEqual(ORDEN_R11.filter((accion) => accion in reglas));
    for (const item of items) {
      expect(item.disabled === true, `${item.key} en ${status}`).toBe(reglas[item.key as OrderRowAction]);
    }
  });
});

describe('orderRowActionsSpec: disparador, titulo y emision (R10)', () => {
  it('R10: el disparador se llama «Acciones del pedido <numero>», con su testid y el id como dato', () => {
    const spec = especificacion('PENDIENTE');
    const elPedido = pedido('PENDIENTE');

    expect(spec.triggerLabel).toBe(`Acciones del pedido ${elPedido.numberText}`);
    expect(spec.triggerTestId).toBe('order-row-actions');
    expect(spec.triggerDataAttributes).toEqual({ 'data-order-id': elPedido.id });
  });

  it('R10: el titulo del dialogo centrado es «Pedido <numero>»', () => {
    expect(especificacion('PENDIENTE').title).toBe(`Pedido ${pedido('PENDIENTE').numberText}`);
  });

  it('R10: en el dialogo centrado, el disparador lleva el id y el titulo es «Pedido <numero>»', async () => {
    const user = setupUser();
    const elPedido = pedido('PENDIENTE');
    render(<RowActionsMenu {...especificacion('PENDIENTE')} presentation="centered" />);

    const disparador = screen.getByTestId('order-row-actions');
    expect(disparador).toHaveAttribute('data-order-id', elPedido.id);
    await user.click(disparador);

    expect(await screen.findByRole('dialog', { name: `Pedido ${elPedido.numberText}` })).toBeInTheDocument();
    expect(screen.getByTestId('order-action-cancel').previousElementSibling).toHaveAttribute('role', 'separator');
  });

  it('R10: cada item emite su accion con el pedido de la fila', () => {
    const onAction = vi.fn();
    const spec = especificacion('TERMINADO', TODOS_LOS_PERMISOS, onAction);

    for (const item of spec.items) item.onSelect?.();

    expect(onAction.mock.calls).toEqual(spec.items.map((item) => [item.key, pedido('TERMINADO')]));
  });

  it('R10: OrderRowActions es el mismo menu y emite `onAction`', async () => {
    const onAction = vi.fn();
    render(<OrderRowActions order={pedido('EN_CURSO')} onAction={onAction} />);

    abrirMenu();
    fireEvent.click(await screen.findByTestId('order-action-responsibles'));

    expect(onAction).toHaveBeenCalledExactlyOnceWith('responsibles', pedido('EN_CURSO'));
  });
});
