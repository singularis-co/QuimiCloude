// El menú de la fila de un pedido: el disparador, los tres grupos y la habilitación de cada acción
// según el estado del pedido, el de sus recetas y los permisos.
//
// Las reglas esperadas se escriben a mano en este archivo, sin llamar a los predicados de
// producción. Los ítems deshabilitados se pulsan con `fireEvent.click`: `user-event` se niega a
// pinchar un elemento con `pointer-events: none`, y lo que se comprueba aquí es que, aunque llegue
// el evento, el primitivo no invoca `onSelect`.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_ACTION_CANCEL_LINE_TESTID,
  ORDER_ACTION_CUSTOMER_TESTID,
  ORDER_ACTION_DELIVERIES_TESTID,
  ORDER_ACTION_DELIVER_TESTID,
  ORDER_ACTION_DETAIL_TESTID,
  ORDER_ACTION_DISTRIBUTION_TESTID,
  OrderRowActions,
  orderRowActionsSpec,
  type OrderRowAction,
} from '@/app/(private)/pedidos/components';
import { RowActionsMenu } from '@/components/shared/row-actions-menu';
import {
  ORDER_STATUS_VALUES,
  type OrderLineStatus,
  type OrderStatus,
  type OrderSummary,
} from '@/lib/modules/pedidos';

import { lineaB, lineaPedido, pedidoDeDosRecetas } from '../../helpers/order-form-ui';
import { setupUser } from '../../helpers/user-event';

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
    cancelOrderLineAction: vi.fn(noDebeInvocarse('cancelOrderLineAction')),
    deleteOrderAction: vi.fn(noDebeInvocarse('deleteOrderAction')),
  };
});

// El barrel de la ruta arrastra el formulario, que importa el selector de presentación.
vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  listPresentationsAction: vi.fn(() => {
    throw new Error('listPresentationsAction no debe invocarse desde las acciones de fila');
  }),
  createPresentationAction: vi.fn(() => {
    throw new Error('createPresentationAction no debe invocarse desde las acciones de fila');
  }),
}));

/** Un pedido con una receta por estado de `lineas`; la primera, distinta de los campos planos. */
function pedido(status: OrderStatus, lineas: readonly OrderLineStatus[] = ['PENDIENTE']): OrderSummary {
  const lines = lineas.map((lineStatus, index) =>
    index === 0
      ? lineaPedido({ status: lineStatus })
      : lineaB({
          id: `50000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`,
          position: index,
          status: lineStatus,
        }),
  );
  return pedidoDeDosRecetas(lines, {
    status,
    cancellationReason: status === 'CANCELADO' ? 'Cliente anuló el encargo' : null,
  });
}

/** Un pedido de una receta en el mismo estado que el pedido (todos salvo `PARCIAL`). */
function pedidoSimple(status: Exclude<OrderStatus, 'PARCIAL'>): OrderSummary {
  return pedido(status, [status]);
}

const ESTADOS_DE_RECETA = ORDER_STATUS_VALUES.filter(
  (status): status is Exclude<OrderStatus, 'PARCIAL'> => status !== 'PARCIAL',
);

const CLASES_TACTILES = ['min-h-11', 'min-w-11'] as const;

function abrirMenu(): void {
  fireEvent.click(screen.getByTestId('order-row-actions'));
}

type Permisos = {
  readonly canEditDistribution: boolean;
  readonly canEditCustomer: boolean;
  readonly canDeliver: boolean;
  readonly canCancelLine: boolean;
};

const TODOS_LOS_PERMISOS: Permisos = {
  canEditDistribution: true,
  canEditCustomer: true,
  canDeliver: true,
  canCancelLine: true,
};

const SIN_PERMISOS: Permisos = {
  canEditDistribution: false,
  canEditCustomer: false,
  canDeliver: false,
  canCancelLine: false,
};

function especificacion(
  order: OrderSummary,
  permisos: Permisos = TODOS_LOS_PERMISOS,
  onAction: (action: OrderRowAction, order: OrderSummary) => void = vi.fn(),
) {
  return orderRowActionsSpec({ order, ...permisos, onAction });
}

function claves(order: OrderSummary, permisos: Permisos = TODOS_LOS_PERMISOS): string[] {
  return especificacion(order, permisos).items.map((item) => item.key);
}

function item(order: OrderSummary, key: OrderRowAction, permisos: Permisos = TODOS_LOS_PERMISOS) {
  return especificacion(order, permisos).items.find((candidato) => candidato.key === key);
}

const ORDEN: readonly OrderRowAction[] = [
  'detail',
  'edit',
  'responsibles',
  'customer',
  'distribution',
  'deliver',
  'deliveries',
  'cancelLine',
  'cancel',
  'delete',
];

const TESTID_DE: Readonly<Record<OrderRowAction, string>> = {
  detail: 'order-action-detail',
  edit: 'order-action-edit',
  responsibles: 'order-action-responsibles',
  customer: 'order-action-customer',
  distribution: 'order-action-distribution',
  deliver: 'order-action-deliver',
  deliveries: 'order-action-deliveries',
  cancelLine: 'order-action-cancel-line',
  cancel: 'order-action-cancel',
  delete: 'order-action-delete',
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('el disparador está siempre en el DOM, sin ninguna acción detrás hasta abrirlo', () => {
  it('existe sin interacción previa, mide al menos 44x44 px y no hay ningún ítem en el árbol', () => {
    render(<OrderRowActions order={pedido('PENDIENTE')} />);

    const disparador = screen.getByTestId('order-row-actions');
    for (const clase of CLASES_TACTILES) {
      expect(disparador.className, `disparador sin ${clase}`).toContain(clase);
    }
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByTestId('order-action-edit')).toBeNull();
  });

  it('no depende de `:hover`', () => {
    render(<OrderRowActions order={pedido('PENDIENTE')} />);

    const disparador = screen.getByTestId('order-row-actions');
    expect(disparador.className).not.toContain('group-hover');
    expect(disparador.className).not.toContain('hover:opacity');
  });

  it('lleva el identificador de la fila como dato, no como texto visible', () => {
    const elPedido = pedido('PENDIENTE');
    render(<OrderRowActions order={elPedido} />);

    const disparador = screen.getByTestId('order-row-actions');
    expect(disparador).toHaveAttribute('data-order-id', elPedido.id);
    expect(disparador.textContent).not.toContain(elPedido.id);
  });

  it('ningún ítem repite el número del pedido', async () => {
    const elPedido = pedido('PENDIENTE');
    render(<OrderRowActions order={elPedido} {...TODOS_LOS_PERMISOS} />);

    abrirMenu();
    await screen.findByTestId('order-action-edit');

    for (const menuItem of screen.getAllByRole('menuitem')) {
      expect(menuItem.textContent).not.toContain(elPedido.numberText);
    }
  });
});

describe('el menú en tres grupos', () => {
  it('R25: en un PARCIAL que lo admite todo, las del pedido, «Por receta» y «Pedido entero», en ese orden', () => {
    const order = pedido('PARCIAL', ['POR_EMPACAR', 'TERMINADO', 'PENDIENTE']);

    expect(claves(order)).toEqual([...ORDEN]);
  });

  it('R25: los rótulos van en la primera acción de una receta y en «Cancelar pedido», con su línea delante', () => {
    const order = pedido('PARCIAL', ['POR_EMPACAR', 'TERMINADO', 'PENDIENTE']);
    const items = especificacion(order).items;

    expect(items.filter((candidato) => candidato.groupLabel !== undefined).map((c) => [c.key, c.groupLabel])).toEqual([
      ['distribution', 'Por receta'],
      ['cancel', 'Pedido entero'],
    ]);
    expect(items.filter((candidato) => candidato.separatorBefore === true).map((c) => c.key)).toEqual([
      'distribution',
      'cancel',
    ]);
  });

  it('R25: si solo se pinta una acción de receta, el rótulo «Por receta» va en ella', () => {
    const order = pedidoSimple('ENTREGADO');
    const items = especificacion(order).items;

    expect(items.find((candidato) => candidato.groupLabel === 'Por receta')?.key).toBe('deliveries');
  });

  it('R25: sin ninguna acción de receta no hay rótulo «Por receta» y «Pedido entero» sigue', () => {
    const items = especificacion(pedidoSimple('PENDIENTE'), {
      ...TODOS_LOS_PERMISOS,
      canCancelLine: false,
    }).items;

    expect(items.map((candidato) => candidato.groupLabel).filter(Boolean)).toEqual(['Pedido entero']);
  });

  it('R25: los textos son los del tablero', () => {
    const order = pedido('PARCIAL', ['POR_EMPACAR', 'TERMINADO', 'PENDIENTE']);

    expect(especificacion(order).items.map((candidato) => candidato.label)).toEqual([
      'Ver detalle',
      'Editar',
      'Responsables',
      'Cliente',
      'Reparto y unidad…',
      'Entregar…',
      'Entregas…',
      'Cancelar receta…',
      'Cancelar pedido',
      'Eliminar',
    ]);
  });

  it('R25: abierto, cada grupo lleva su nombre y contiene sus acciones', async () => {
    render(
      <OrderRowActions
        order={pedido('PARCIAL', ['POR_EMPACAR', 'TERMINADO', 'PENDIENTE'])}
        {...TODOS_LOS_PERMISOS}
      />,
    );

    abrirMenu();
    const menu = await screen.findByRole('menu');

    const porReceta = within(menu).getByRole('group', { name: 'Por receta' });
    for (const testId of [
      ORDER_ACTION_DISTRIBUTION_TESTID,
      ORDER_ACTION_DELIVER_TESTID,
      ORDER_ACTION_DELIVERIES_TESTID,
      ORDER_ACTION_CANCEL_LINE_TESTID,
    ]) {
      expect(within(porReceta).getByTestId(testId)).toBeInTheDocument();
    }
    const pedidoEntero = within(menu).getByRole('group', { name: 'Pedido entero' });
    expect(within(pedidoEntero).getByTestId('order-action-cancel')).toBeInTheDocument();
    expect(within(pedidoEntero).getByTestId('order-action-delete')).toBeInTheDocument();
    expect(within(porReceta).queryByTestId('order-action-edit')).toBeNull();
    expect(within(pedidoEntero).queryByTestId(ORDER_ACTION_DETAIL_TESTID)).toBeNull();
  });

  it('R25: en el diálogo centrado del teléfono salen los mismos grupos', async () => {
    const user = setupUser();
    const order = pedido('PARCIAL', ['POR_EMPACAR', 'TERMINADO', 'PENDIENTE']);
    render(<RowActionsMenu {...especificacion(order)} presentation="centered" />);

    await user.click(screen.getByTestId('order-row-actions'));
    const dialogo = await screen.findByRole('dialog', { name: `Pedido ${order.numberText}` });

    expect(within(dialogo).getByRole('group', { name: 'Por receta' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('group', { name: 'Pedido entero' })).toBeInTheDocument();
  });

  it('R25: con cualquier estado y permisos, los ítems siguen el orden de los tres grupos', () => {
    const combinaciones: Permisos[] = [TODOS_LOS_PERMISOS, SIN_PERMISOS];
    for (const status of ESTADOS_DE_RECETA) {
      for (const permisos of combinaciones) {
        const orden = claves(pedidoSimple(status), permisos);
        expect(orden).toEqual(ORDEN.filter((accion) => orden.includes(accion)));
      }
    }
  });

  it('R25: solo «Cancelar receta…», «Cancelar pedido» y «Eliminar» son destructivas, y cada ítem lleva su testid', () => {
    const items = especificacion(pedido('PARCIAL', ['POR_EMPACAR', 'TERMINADO', 'PENDIENTE'])).items;

    expect(items.filter((candidato) => candidato.destructive === true).map((c) => c.key)).toEqual([
      'cancelLine',
      'cancel',
      'delete',
    ]);
    for (const candidato of items) {
      expect(candidato.testId).toBe(TESTID_DE[candidato.key as OrderRowAction]);
    }
  });
});

describe('«Ver detalle» y «Editar»', () => {
  it('R18: «Ver detalle» es la primera, está siempre habilitada y emite `detail` con el pedido', () => {
    const onAction = vi.fn();
    for (const status of ESTADOS_DE_RECETA) {
      const order = pedidoSimple(status);
      const spec = especificacion(order, SIN_PERMISOS, onAction);
      expect(spec.items[0]?.key).toBe('detail');
      expect(spec.items[0]?.disabled ?? false).toBe(false);
      spec.items[0]?.onSelect?.();
      expect(onAction).toHaveBeenLastCalledWith('detail', order);
    }
  });

  it('R9: «Editar» habilitado en todo estado salvo ENTREGADO y CANCELADO, PARCIAL incluido', () => {
    for (const status of ORDER_STATUS_VALUES) {
      const order = status === 'PARCIAL' ? pedido('PARCIAL', ['TERMINADO', 'PENDIENTE']) : pedidoSimple(status);
      const cerrado = status === 'ENTREGADO' || status === 'CANCELADO';
      expect(item(order, 'edit')?.disabled, status).toBe(cerrado);
    }
  });

  it('R9: en PARCIAL, pulsar «Editar» emite la edición', async () => {
    const onAction = vi.fn();
    const order = pedido('PARCIAL', ['TERMINADO', 'PENDIENTE']);
    render(<OrderRowActions order={order} onAction={onAction} />);

    abrirMenu();
    const editar = await screen.findByTestId('order-action-edit');
    expect(editar).not.toHaveAttribute('aria-disabled');
    fireEvent.click(editar);

    expect(onAction).toHaveBeenCalledExactlyOnceWith('edit', order);
  });

  it.each(['ENTREGADO', 'CANCELADO'] as const)(
    'R9: en %s «Editar» sale deshabilitado y pulsarlo no emite',
    async (status) => {
      const onAction = vi.fn();
      render(<OrderRowActions order={pedidoSimple(status)} onAction={onAction} />);

      abrirMenu();
      const editar = await screen.findByTestId('order-action-edit');
      expect(editar).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(editar);

      expect(onAction).not.toHaveBeenCalledWith('edit', expect.anything());
    },
  );
});

describe('las acciones de una receta (R26)', () => {
  // Qué estados de receta admite cada acción y qué permiso la pinta, escritos a mano.
  const ADMITE: Readonly<Record<'distribution' | 'deliver' | 'deliveries' | 'cancelLine', readonly OrderLineStatus[]>> = {
    distribution: ['POR_EMPACAR'],
    deliver: ['TERMINADO'],
    deliveries: ['TERMINADO', 'ENTREGADO'],
    cancelLine: ['PENDIENTE', 'EN_CURSO', 'BLOQUEADO'],
  };
  const PERMISO: Readonly<Record<keyof typeof ADMITE, keyof Permisos | null>> = {
    distribution: 'canEditDistribution',
    deliver: 'canDeliver',
    deliveries: null,
    cancelLine: 'canCancelLine',
  };
  const ACCIONES = Object.keys(ADMITE) as (keyof typeof ADMITE)[];

  it.each(ACCIONES)(
    'R26: «%s» se pinta con su permiso solo si alguna receta del pedido la admite, y nunca deshabilitada',
    (accion) => {
      for (const status of ESTADOS_DE_RECETA) {
        // El pedido en PARCIAL con una receta en `status` y otra que no admite nada.
        const order = pedido('PARCIAL', ['CANCELADO', status]);
        const admite = ADMITE[accion].includes(status);
        const encontrado = item(order, accion);
        expect(encontrado !== undefined, `${accion} con una receta ${status}`).toBe(admite);
        expect(encontrado?.disabled ?? false).toBe(false);
      }
    },
  );

  it.each(ACCIONES.filter((accion) => PERMISO[accion] !== null))(
    'R26: «%s» no se pinta sin su permiso, aunque alguna receta la admita',
    (accion) => {
      const permiso = PERMISO[accion] as keyof Permisos;
      for (const status of ADMITE[accion]) {
        const order = pedido('PARCIAL', ['CANCELADO', status]);
        expect(item(order, accion, { ...TODOS_LOS_PERMISOS, [permiso]: false })).toBeUndefined();
      }
    },
  );

  it('R26: «Entregas…» no pide permiso propio', () => {
    expect(item(pedidoSimple('ENTREGADO'), 'deliveries', SIN_PERMISOS)).toBeDefined();
  });

  it('R26: un PARCIAL con una receta TERMINADO y otra PENDIENTE ofrece entregar, entregas y cancelar receta, pero no el reparto', () => {
    const order = pedido('PARCIAL', ['TERMINADO', 'PENDIENTE']);

    expect(claves(order).filter((clave) => ACCIONES.includes(clave as keyof typeof ADMITE))).toEqual([
      'deliver',
      'deliveries',
      'cancelLine',
    ]);
  });

  it('R26: sin ningún permiso, un PARCIAL solo ofrece «Entregas…» de las acciones de receta', () => {
    const order = pedido('PARCIAL', ['POR_EMPACAR', 'TERMINADO', 'PENDIENTE']);

    expect(claves(order, SIN_PERMISOS).filter((clave) => ACCIONES.includes(clave as keyof typeof ADMITE))).toEqual([
      'deliveries',
    ]);
  });

  it('R26: cada acción de receta emite su clase con el pedido de la fila', async () => {
    const onAction = vi.fn();
    const order = pedido('PARCIAL', ['POR_EMPACAR', 'TERMINADO', 'PENDIENTE']);
    render(<OrderRowActions order={order} onAction={onAction} {...TODOS_LOS_PERMISOS} />);

    for (const [testId, accion] of [
      [ORDER_ACTION_DISTRIBUTION_TESTID, 'distribution'],
      [ORDER_ACTION_DELIVER_TESTID, 'deliver'],
      [ORDER_ACTION_DELIVERIES_TESTID, 'deliveries'],
      [ORDER_ACTION_CANCEL_LINE_TESTID, 'cancelLine'],
    ] as const) {
      abrirMenu();
      fireEvent.click(await screen.findByTestId(testId));
      expect(onAction).toHaveBeenLastCalledWith(accion, order);
    }
  });
});

describe('las acciones del pedido entero', () => {
  it('R36: «Cancelar pedido» se pinta siempre y se habilita solo si alguna receta es cancelable', () => {
    expect(item(pedido('PARCIAL', ['TERMINADO', 'PENDIENTE']), 'cancel', SIN_PERMISOS)?.disabled).toBe(false);
    expect(item(pedido('PARCIAL', ['TERMINADO', 'CANCELADO']), 'cancel', SIN_PERMISOS)?.disabled).toBe(true);
    for (const status of ESTADOS_DE_RECETA) {
      const cancelable = status === 'PENDIENTE' || status === 'EN_CURSO' || status === 'BLOQUEADO';
      expect(item(pedidoSimple(status), 'cancel', SIN_PERMISOS)?.disabled, status).toBe(!cancelable);
    }
  });

  it('R37: «Eliminar» se pinta siempre y se habilita si el pedido y todas sus recetas se pueden borrar', () => {
    const borrables: readonly OrderStatus[] = ['PENDIENTE', 'EN_CURSO', 'BLOQUEADO'];
    for (const status of ESTADOS_DE_RECETA) {
      expect(item(pedidoSimple(status), 'delete', SIN_PERMISOS)?.disabled, status).toBe(!borrables.includes(status));
    }
    expect(item(pedido('PARCIAL', ['PENDIENTE', 'EN_CURSO']), 'delete')?.disabled).toBe(false);
    expect(item(pedido('PARCIAL', ['TERMINADO', 'PENDIENTE']), 'delete')?.disabled).toBe(true);
  });

  it('R36: con todas las recetas sin cancelar posible, pulsar «Cancelar pedido» no emite', async () => {
    const onAction = vi.fn();
    render(<OrderRowActions order={pedido('PARCIAL', ['TERMINADO', 'CANCELADO'])} onAction={onAction} />);

    abrirMenu();
    const cancelar = await screen.findByTestId('order-action-cancel');
    expect(cancelar).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(cancelar);

    expect(onAction).not.toHaveBeenCalled();
  });
});

describe('«Responsables» y «Cliente»', () => {
  it('R38: «Responsables» está habilitado en todos los estados, PARCIAL incluido', () => {
    for (const status of ESTADOS_DE_RECETA) {
      expect(item(pedidoSimple(status), 'responsibles', SIN_PERMISOS)?.disabled ?? false, status).toBe(false);
    }
    expect(item(pedido('PARCIAL', ['TERMINADO', 'POR_EMPACAR']), 'responsibles')?.disabled ?? false).toBe(false);
  });

  it('R38: en PARCIAL «Cliente» está habilitado y emite el cambio de cliente', async () => {
    const onAction = vi.fn();
    const order = pedido('PARCIAL', ['TERMINADO', 'POR_EMPACAR']);
    render(<OrderRowActions order={order} onAction={onAction} canEditCustomer />);

    abrirMenu();
    const cliente = await screen.findByTestId(ORDER_ACTION_CUSTOMER_TESTID);
    expect(cliente).not.toHaveAttribute('aria-disabled');
    fireEvent.click(cliente);

    expect(onAction).toHaveBeenCalledExactlyOnceWith('customer', order);
  });

  it('«Cliente» se deshabilita en ENTREGADO y CANCELADO, y sin el permiso no se pinta', () => {
    for (const status of ESTADOS_DE_RECETA) {
      const cerrado = status === 'ENTREGADO' || status === 'CANCELADO';
      expect(item(pedidoSimple(status), 'customer')?.disabled, status).toBe(cerrado);
      expect(item(pedidoSimple(status), 'customer', SIN_PERMISOS)).toBeUndefined();
    }
  });
});

describe('orderRowActionsSpec: disparador, título y emisión', () => {
  it('el disparador se llama «Acciones del pedido <número>», con su testid y el id como dato', () => {
    const order = pedido('PENDIENTE');
    const spec = especificacion(order);

    expect(spec.triggerLabel).toBe(`Acciones del pedido ${order.numberText}`);
    expect(spec.triggerTestId).toBe('order-row-actions');
    expect(spec.triggerDataAttributes).toEqual({ 'data-order-id': order.id });
    expect(spec.title).toBe(`Pedido ${order.numberText}`);
  });

  it('cada ítem emite su acción con el pedido de la fila', () => {
    const onAction = vi.fn();
    const order = pedido('PARCIAL', ['POR_EMPACAR', 'TERMINADO', 'PENDIENTE']);
    const spec = especificacion(order, TODOS_LOS_PERMISOS, onAction);

    for (const candidato of spec.items) candidato.onSelect?.();

    expect(onAction.mock.calls).toEqual(spec.items.map((candidato) => [candidato.key, order]));
  });
});
