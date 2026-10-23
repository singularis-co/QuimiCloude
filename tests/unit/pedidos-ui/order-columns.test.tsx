// QC-35 T7 — Las diez columnas de la lista de pedidos: R8, R9, R10, R11, R12, R14, R19, R39.
//
// **Las columnas son DATOS**, asi que el test las recorre en vez de listar literales: anadir una
// columna es anadir una fila a `ORDER_COLUMNS`, y eso es justo lo que el test en negativo de R8
// vigila.
//
// **Los asserts van sobre ids de columna, `data-testid` y constantes exportadas** (R44), nunca
// sobre el copy de las etiquetas: `label` se reescribe sin avisar y un assert sobre el no dice
// nada sobre el comportamiento.
//
// **`order-actions.ts` esta mockeada con dobles que FALLAN si se les llama**: el barrel de la
// ruta arrastra el Server Component de la seccion, y una declaracion de columnas no puede pedir
// datos por su cuenta (R43).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACTIONS_COLUMN_ID,
  ACTUAL_COST_COLUMN_ID,
  ACTUAL_COST_TESTID,
  CANCELLATION_REASON_COLUMN_ID,
  COVERAGE_COLUMN_ID,
  CREATED_AT_COLUMN_ID,
  MISSING_VALUE_MARK,
  ORDER_COVERAGE_LABELS,
  ORDER_CUSTOMER_NAME_COLUMN_ID,
  ORDER_NUMBER_COLUMN_ID,
  ORDER_PRIORITY_LABELS,
  ORDER_PRODUCED_PRESENTATIONS_TESTID,
  ORDER_PRODUCED_PRODUCT_LINK_TESTID,
  ORDER_SKELETON_COLUMN_COUNT,
  ORDER_STATUS_LABELS,
  NOTHING_PENDING_MARK,
  PENDING_DELIVERY_COLUMN_ID,
  PENDING_DELIVERY_TESTID,
  PRESENTATION_NAME_COLUMN_ID,
  PRIORITY_COLUMN_ID,
  PRODUCTION_COST_COLUMN_ID,
  PRODUCTION_COST_TESTID,
  RESPONSIBLES_COLUMN_ID,
  STATUS_COLUMN_ID,
  RECIPE_NAME_COLUMN_ID,
  STATUS_PARAM,
  buildOrderColumns,
  orderRowActionsSpec,
  parseOrderListParams,
} from '@/app/(private)/pedidos/components';
import {
  ORDER_PRIORITY_VALUES,
  ORDER_QUERYABLE,
  ORDER_STATUS_FLOW,
  formatOrderNumber,
  type OrderSummary,
} from '@/lib/modules/pedidos';
import { finishedProductDetailRoute } from '@/lib/shared/routes';

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => {
  const noDebeInvocarse = (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse desde la declaracion de columnas`);
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

/**
 * Las columnas se construyen con la FACTORIA (`buildOrderColumns`) porque la celda de acciones
 * necesita los dos catalogos del panel de edicion. Es el unico cambio respecto de la version que
 * las declaraba como array del modulo: **ningun assert de este archivo se relaja**.
 */
const ORDER_COLUMNS = buildOrderColumns({
  units: [],
  bridge: null,
});

const RECIPE_ID = '22222222-2222-4222-8222-222222222222';

const ESTADOS_DE_ACONDICIONAMIENTO = ['POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO'] as const;

function pedido(overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    number: { year: 2026, sequence: 42 },
    numberText: formatOrderNumber({ year: 2026, sequence: 42 }),
    recipeId: RECIPE_ID,
    recipeName: 'Esmalte azul',
    recipeVersion: null,
    quantity: '12.5000',
    priority: 'MEDIA',
    status: 'PENDIENTE',
    cancellationReason: null,
    ingredientsCost: null,
    packagingCost: null,
    actualCost: null,
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

/** Pinta la celda de una columna por su id. Las celdas devuelven `ReactNode`, no cadena. */
function pintarCelda(columnId: string, order: OrderSummary) {
  const column = ORDER_COLUMNS.find((candidate) => candidate.id === columnId);
  if (column === undefined) throw new Error(`No existe la columna ${columnId}`);
  return render(<>{column.cell(order)}</>);
}

afterEach(() => {
  cleanup();
});

// QC-35bis (2026-09-07): eran DIEZ. La unidad y el precio unitario salieron del pedido -de la
// tabla `orders` hacia arriba-, asi que sus dos columnas ya no tienen dato que pintar y la lista
// acordada baja a ocho. Luego sube a diez con RESPONSABLES, a ONCE con COBERTURA, a DOCE con
// CLIENTE y a TRECE con POR ENTREGAR, que llega desde el dashboard. El 2026-10-16 baja a DOCE: sale
// CANTIDAD (decision humana). El 2026-10-20 sube a TRECE con el costo y despues a CATORCE con el
// costo real. El 2026-10-22 POR ENTREGAR pasa delante de PRESENTACION. Sigue siendo cerrada y en un
// orden acordado.
describe('las columnas declaradas son exactamente las catorce acordadas (R8, R20, R35)', () => {
  it('en positivo: los catorce ids, en el orden acordado', () => {
    expect(ORDER_COLUMNS.map((column) => column.id)).toEqual([
      ORDER_NUMBER_COLUMN_ID,
      STATUS_COLUMN_ID,
      PRIORITY_COLUMN_ID,
      RECIPE_NAME_COLUMN_ID,
      ORDER_CUSTOMER_NAME_COLUMN_ID,
      PENDING_DELIVERY_COLUMN_ID,
      PRESENTATION_NAME_COLUMN_ID,
      CREATED_AT_COLUMN_ID,
      CANCELLATION_REASON_COLUMN_ID,
      COVERAGE_COLUMN_ID,
      RESPONSIBLES_COLUMN_ID,
      PRODUCTION_COST_COLUMN_ID,
      ACTUAL_COST_COLUMN_ID,
      ACTIONS_COLUMN_ID,
    ]);
    expect(ORDER_COLUMNS).toHaveLength(14);
  });

  it('en negativo: ninguna columna es `total`, `createdBy`, `updatedBy`, unidad ni precio', () => {
    const ids = ORDER_COLUMNS.map((column) => column.id);

    expect(ids).not.toContain('total');
    expect(ids).not.toContain('createdBy');
    expect(ids).not.toContain('updatedBy');
    // Los dos que se fueron el 2026-09-07. En negativo para que devolverlos sin decidirlo
    // ponga el test rojo.
    expect(ids).not.toContain('unitName');
    expect(ids).not.toContain('unitPrice');
  });

  it('en negativo: la columna «Cantidad» ya no esta (decision humana del 2026-10-16)', () => {
    expect(ORDER_COLUMNS.map((column) => column.id)).not.toContain('quantity');
    expect(ORDER_COLUMNS.map((column) => column.label)).not.toContain('Cantidad');
  });

  it('el esqueleto de carga pinta tantas celdas como columnas hay (R21)', () => {
    expect(ORDER_SKELETON_COLUMN_COUNT).toBe(ORDER_COLUMNS.length);
  });
});

describe('solo cuatro columnas ordenan, y son las de la lista blanca menos la no acordada (R12)', () => {
  it('en positivo: correlativo, estado, prioridad y fecha de solicitud', () => {
    const ordenables = ORDER_COLUMNS.filter((column) => column.sortable === true).map((c) => c.id);

    expect(ordenables).toEqual([
      ORDER_NUMBER_COLUMN_ID,
      STATUS_COLUMN_ID,
      PRIORITY_COLUMN_ID,
      CREATED_AT_COLUMN_ID,
    ]);
    // Ninguna cabecera ordena por un campo que la lista blanca no declare.
    for (const id of ordenables) {
      expect(ORDER_QUERYABLE.sortable).toContain(id);
    }
  });

  it('en negativo: ninguna otra columna es ordenable', () => {
    const noOrdenables = ORDER_COLUMNS.filter((column) => column.sortable !== true).map((c) => c.id);

    expect(noOrdenables).toEqual([
      RECIPE_NAME_COLUMN_ID,
      ORDER_CUSTOMER_NAME_COLUMN_ID,
      PENDING_DELIVERY_COLUMN_ID,
      PRESENTATION_NAME_COLUMN_ID,
      CANCELLATION_REASON_COLUMN_ID,
      COVERAGE_COLUMN_ID,
      RESPONSIBLES_COLUMN_ID,
      PRODUCTION_COST_COLUMN_ID,
      ACTUAL_COST_COLUMN_ID,
      ACTIONS_COLUMN_ID,
    ]);
    // `quantity` sigue en `ORDER_QUERYABLE.sortable` -una URL vieja con ese orden no rompe-, pero
    // desde el 2026-10-16 ni siquiera hay columna.
    expect(ORDER_QUERYABLE.sortable).toContain('quantity');
    // Y `unitPrice` ya no esta ni en la lista blanca: se fue con la columna (2026-09-07).
    expect(ORDER_QUERYABLE.sortable).not.toContain('unitPrice');
  });
});

describe('los filtros son los tres de la decision cerrada y ninguno mas (R14)', () => {
  it('estado y prioridad como seleccion de los conjuntos cerrados, fecha como rango', () => {
    const porId = new Map(ORDER_COLUMNS.map((column) => [column.id, column]));

    // R41: en orden de flujo (`ORDER_STATUS_FLOW`), no en el orden crudo del enum.
    const estado = porId.get(STATUS_COLUMN_ID)?.filter;
    expect(estado?.kind).toBe('select');
    expect(estado?.kind === 'select' ? estado.options.map((o) => o.value) : []).toEqual([
      ...ORDER_STATUS_FLOW,
    ]);

    const prioridad = porId.get(PRIORITY_COLUMN_ID)?.filter;
    expect(prioridad?.kind).toBe('select');
    expect(prioridad?.kind === 'select' ? prioridad.options.map((o) => o.value) : []).toEqual([
      ...ORDER_PRIORITY_VALUES,
    ]);

    expect(porId.get(CREATED_AT_COLUMN_ID)?.filter).toEqual({ kind: 'dateRange' });
  });

  it('ninguna otra columna declara filtro', () => {
    const conFiltro = ORDER_COLUMNS.filter((column) => column.filter !== undefined).map((c) => c.id);

    expect(conFiltro).toEqual([STATUS_COLUMN_ID, PRIORITY_COLUMN_ID, CREATED_AT_COLUMN_ID]);
  });
});

describe('el fijado por defecto y la columna de acciones (R19, `design.md > 6.1`)', () => {
  it('el correlativo es la unica columna fijada por defecto, al borde izquierdo', () => {
    const fijadas = ORDER_COLUMNS.filter((column) => column.defaultPinned !== undefined);

    expect(fijadas.map((column) => column.id)).toEqual([ORDER_NUMBER_COLUMN_ID]);
    expect(fijadas[0]?.defaultPinned).toBe('left');
  });

  it('la columna de acciones no se puede fijar, para que no tape la del correlativo', () => {
    const acciones = ORDER_COLUMNS.find((column) => column.id === ACTIONS_COLUMN_ID);

    expect(acciones?.pinnable).toBe(false);
    expect(acciones?.sortable).toBeUndefined();
    expect(acciones?.filter).toBeUndefined();
  });

  it('todas las demas columnas se pueden fijar', () => {
    const noFijables = ORDER_COLUMNS.filter((column) => column.pinnable === false).map((c) => c.id);

    expect(noFijables).toEqual([ACTIONS_COLUMN_ID]);
  });

  it('R10: la columna de acciones declara su menu como datos, para la fila y la tarjeta', () => {
    const acciones = ORDER_COLUMNS.find((column) => column.id === ACTIONS_COLUMN_ID);
    const elPedido = pedido();

    const spec = acciones?.menu?.(elPedido);

    expect(spec?.triggerTestId).toBe('order-row-actions');
    expect(spec?.title).toBe(`Pedido ${elPedido.numberText}`);
    expect(spec?.items.map((item) => item.key)).toEqual(
      orderRowActionsSpec({
        order: elPedido,
        canEditDistribution: false,
        canEditCustomer: false,
        canDeliver: false,
        onAction: vi.fn(),
      }).items.map((item) => item.key),
    );
  });

  it('R10: el menu lleva los permisos del servidor y emite `onAction` con el pedido de la fila', () => {
    const onAction = vi.fn();
    const columnas = buildOrderColumns({
      units: [],
      bridge: null,
      canEditCustomer: true,
      onAction,
    });
    const elPedido = pedido();
    const spec = columnas.find((column) => column.id === ACTIONS_COLUMN_ID)?.menu?.(elPedido);
    const cliente = spec?.items.find((item) => item.key === 'customer');

    cliente?.onSelect?.();

    expect(cliente?.testId).toBe('order-action-customer');
    expect(onAction).toHaveBeenCalledExactlyOnceWith('customer', elPedido);
  });

  it('R10: la celda pinta el disparador del menu con el id del pedido como dato', () => {
    const acciones = ORDER_COLUMNS.find((column) => column.id === ACTIONS_COLUMN_ID);
    const elPedido = pedido();

    render(<>{acciones?.cell(elPedido)}</>);

    expect(screen.getByTestId('order-row-actions')).toHaveAttribute('data-order-id', elPedido.id);
  });
});

describe('el correlativo se compone SIEMPRE con la funcion del contrato (R10)', () => {
  it('la celda es exactamente `formatOrderNumber(order.number)` y no el identificador tecnico', () => {
    const order = pedido({ number: { year: 2025, sequence: 7 } });

    const { container } = pintarCelda(ORDER_NUMBER_COLUMN_ID, order);

    expect(container.textContent).toBe(formatOrderNumber({ year: 2025, sequence: 7 }));
    expect(container.textContent).not.toContain(order.id);
  });
});

describe('receta y unidad se presentan por su NOMBRE, tomado de la propia fila (R9)', () => {
  it('con nombre informado se pinta el nombre y no el identificador', () => {
    const order = pedido();

    const { container } = pintarCelda(RECIPE_NAME_COLUMN_ID, order);

    expect(container.textContent).toBe('Esmalte azul');
    expect(container.textContent).not.toContain(RECIPE_ID);
  });

  it('sin nombre de receta se pinta un marcador identificable y NUNCA el uuid', () => {
    const { container } = pintarCelda(RECIPE_NAME_COLUMN_ID, pedido({ recipeName: null }));

    expect(screen.getByTestId(`order-missing-${RECIPE_NAME_COLUMN_ID}`)).toHaveTextContent(
      MISSING_VALUE_MARK,
    );
    expect(container.textContent).not.toContain(RECIPE_ID);
  });

});

describe('el motivo de cancelacion (R11)', () => {
  it('con el pedido cancelado se presenta su motivo', () => {
    const order = pedido({ status: 'CANCELADO', cancellationReason: 'Cliente anuló el encargo' });

    const { container } = pintarCelda(CANCELLATION_REASON_COLUMN_ID, order);

    expect(container.textContent).toBe('Cliente anuló el encargo');
    expect(screen.queryByTestId(`order-missing-${CANCELLATION_REASON_COLUMN_ID}`)).toBeNull();
  });

  it('sin cancelar se presenta un marcador de ausencia y ningun motivo', () => {
    pintarCelda(CANCELLATION_REASON_COLUMN_ID, pedido({ status: 'PENDIENTE' }));

    expect(screen.getByTestId(`order-missing-${CANCELLATION_REASON_COLUMN_ID}`)).toHaveTextContent(
      MISSING_VALUE_MARK,
    );
  });
});

describe('R20: la columna Presentación pinta el reparto o Sin presentación', () => {
  it('QC-170 R26: con una linea pinta «envases × nombre» sin «+0»', () => {
    const { container } = pintarCelda(
      PRESENTATION_NAME_COLUMN_ID,
      pedido({
        presentationLines: [{ presentationId: 'p-1', presentationName: 'Bidón 20L', packages: 2, packagingProductId: null, packagingName: null, presentationContent: null, presentationUnitLabel: null }],
      }),
    );

    expect(container.textContent).toBe('2 × Bidón 20L');
  });

  it('QC-170 R26: con varias lineas pinta todas separadas por coma', () => {
    const { container } = pintarCelda(
      PRESENTATION_NAME_COLUMN_ID,
      pedido({
        presentationLines: [
          { presentationId: 'p-1', presentationName: 'Botella 200 ml', packages: 5, packagingProductId: null, packagingName: null, presentationContent: null, presentationUnitLabel: null },
          { presentationId: 'p-2', presentationName: 'Bidón 20L', packages: 1, packagingProductId: null, packagingName: null, presentationContent: null, presentationUnitLabel: null },
        ],
      }),
    );

    expect(container.textContent).toBe('5 × Botella 200 ml, 1 × Bidón 20L');
  });

  it('QC-170 R27: sin reparto se pinta «Sin presentación»', () => {
    const { container } = pintarCelda(
      PRESENTATION_NAME_COLUMN_ID,
      pedido({ presentationLines: [] }),
    );

    expect(container.textContent).toBe('Sin presentación');
  });
});

describe('el reparto del listado con lineas de envase y antiguas', () => {
  it('R33: una linea con envase se pinta con el nombre del envase', () => {
    const { container } = pintarCelda(
      PRESENTATION_NAME_COLUMN_ID,
      pedido({
        presentationLines: [
          {
            presentationId: 'p-1',
            presentationName: '20 L',
            packages: 2,
            packagingProductId: 'e-1',
            packagingName: 'Bidón PET 20 L',
            presentationContent: null,
            presentationUnitLabel: null,
          },
        ],
      }),
    );

    expect(container.textContent).toBe('2 × Bidón PET 20 L');
  });

  it('R33: una linea antigua se sigue pintando con el nombre de su presentacion', () => {
    const { container } = pintarCelda(
      PRESENTATION_NAME_COLUMN_ID,
      pedido({
        presentationLines: [
          {
            presentationId: 'p-1',
            presentationName: 'Bidón 20L',
            packages: 2,
            packagingProductId: null,
            packagingName: null,
            presentationContent: null,
            presentationUnitLabel: null,
          },
        ],
      }),
    );

    expect(container.textContent).toBe('2 × Bidón 20L');
  });

  it('R33: un envase cuyo nombre no vuelve del catalogo se pinta con su presentacion', () => {
    const { container } = pintarCelda(
      PRESENTATION_NAME_COLUMN_ID,
      pedido({
        presentationLines: [
          {
            presentationId: 'p-1',
            presentationName: '20 L',
            packages: 3,
            packagingProductId: 'e-1',
            packagingName: null,
            presentationContent: null,
            presentationUnitLabel: null,
          },
        ],
      }),
    );

    expect(container.textContent).toBe('3 × 20 L');
  });

  it('una linea con envase y volumen conocido pinta «envases × envase · volumen»', () => {
    const { container } = pintarCelda(
      PRESENTATION_NAME_COLUMN_ID,
      pedido({
        presentationLines: [
          {
            presentationId: 'p-1',
            presentationName: '300 ml',
            packages: 9,
            packagingProductId: 'e-1',
            packagingName: 'Embase pequeño 2',
            presentationContent: '300.0000',
            presentationUnitLabel: 'ml',
          },
        ],
      }),
    );

    expect(container.textContent).toBe('9 × Embase pequeño 2 · 300 ml');
  });
});

describe('R21: Presentación no ordena ni filtra', () => {
  it('la columna no declara `sortable` ni `filter`', () => {
    const columna = ORDER_COLUMNS.find((c) => c.id === PRESENTATION_NAME_COLUMN_ID);

    expect(columna?.sortable).not.toBe(true);
    expect(columna?.filter).toBeUndefined();
  });
});

describe('estado y prioridad se leen como etiqueta, no como valor crudo del enum (R8)', () => {
  it('cada estado del contrato tiene su etiqueta legible', () => {
    pintarCelda(STATUS_COLUMN_ID, pedido({ status: 'EN_CURSO' }));

    const badge = screen.getByTestId('order-status');
    expect(badge).toHaveAttribute('data-status', 'EN_CURSO');
    expect(badge).toHaveTextContent(ORDER_STATUS_LABELS.EN_CURSO);
  });

  it('R34: el filtro de estado ofrece «Bloqueado» y la celda pinta su etiqueta', () => {
    const estado = ORDER_COLUMNS.find((column) => column.id === STATUS_COLUMN_ID)?.filter;
    const opciones = estado?.kind === 'select' ? estado.options : [];
    expect(opciones).toContainEqual({ value: 'BLOQUEADO', label: ORDER_STATUS_LABELS.BLOQUEADO });

    pintarCelda(STATUS_COLUMN_ID, pedido({ status: 'BLOQUEADO' }));

    const badge = screen.getByTestId('order-status');
    expect(badge).toHaveAttribute('data-status', 'BLOQUEADO');
    expect(badge).toHaveTextContent(ORDER_STATUS_LABELS.BLOQUEADO);
    expect(badge.textContent).not.toBe('BLOQUEADO');
  });

  it('R29, R32: el filtro de estado ofrece los tres estados nuevos, en el orden del flujo, entre «En empaque» y «Entregado»', () => {
    const estado = ORDER_COLUMNS.find((column) => column.id === STATUS_COLUMN_ID)?.filter;
    const valores = estado?.kind === 'select' ? estado.options.map((option) => option.value) : [];

    const desde = valores.indexOf('EN_EMPAQUE');
    expect(valores.slice(desde, desde + 5)).toEqual([
      'EN_EMPAQUE',
      'POR_ACONDICIONAR',
      'EN_ACONDICIONAMIENTO',
      'TERMINADO',
      'ENTREGADO',
    ]);
    for (const status of ESTADOS_DE_ACONDICIONAMIENTO) {
      expect(estado?.kind === 'select' ? estado.options : []).toContainEqual({
        value: status,
        label: ORDER_STATUS_LABELS[status],
      });
    }
  });

  it.each(ESTADOS_DE_ACONDICIONAMIENTO)('R29: el filtro de estado acepta %s en la URL', (status) => {
    const params = parseOrderListParams({ [STATUS_PARAM]: status });

    expect(params.filters[STATUS_COLUMN_ID]).toEqual({ kind: 'select', values: [status] });
  });

  it.each([
    // ENMIENDA QC-262: de variante de Badge a tono de StatusBadge.
    ['POR_ACONDICIONAR', 'Por acondicionar', 'waiting'],
    ['EN_ACONDICIONAMIENTO', 'En acondicionamiento', 'progress'],
    ['TERMINADO', 'Terminado', 'success'],
  ] as const)(
    'R29, R32: la celda pinta %s como «%s», con su valor en `data-status` y el tono %s',
    (status, etiqueta, tono) => {
      // El texto acordado en R28/R29/R32 se afirma una vez aqui, contra la constante exportada,
      // y la celda se compara con la constante: si alguien reescribe la etiqueta, falla el primero.
      expect(ORDER_STATUS_LABELS[status]).toBe(etiqueta);

      pintarCelda(STATUS_COLUMN_ID, pedido({ status }));

      const badge = screen.getByTestId('order-status');
      expect(badge).toHaveAttribute('data-status', status);
      expect(badge).toHaveTextContent(ORDER_STATUS_LABELS[status]);
      expect(badge.textContent).not.toBe(status);
      expect(badge).toHaveAttribute('data-tone', tono);
    },
  );

  it('cada prioridad del contrato tiene su etiqueta legible', () => {
    pintarCelda(PRIORITY_COLUMN_ID, pedido({ priority: 'CRITICA' }));

    const badge = screen.getByTestId('order-priority');
    expect(badge).toHaveAttribute('data-priority', 'CRITICA');
    expect(badge).toHaveTextContent(ORDER_PRIORITY_LABELS.CRITICA);
  });
});

// ---------------------------------------------------------------------------------------------
// QC-102 T12 — La columna de RESPONSABLES: R16.
//
// Aqui se afirma solo sobre la DECLARACION —que es lo que este archivo hace con las demas—: el
// DOM de la celda vive en `order-sheet-responsibles.test.tsx`, que si monta el panel y por eso
// necesita el router. La declaracion no debe necesitar ninguno de los dos.
// ---------------------------------------------------------------------------------------------

// QC-123 T9 (R18) — el importe NO se pinta en esta ficha (lo pinta QC-122). En positivo, la
// lista blanca de ids sigue sin ninguna columna de importe; en negativo, las celdas que SI se
// pueden pintar sin montar el resto de la pantalla (router, dialogos) no dejan escapar el valor.
// Los costes SI se pintan, pero solo en sus columnas propias (cubiertas abajo); las demas celdas
// siguen sin dejarlos escapar.
describe('la tabla de pedidos no pinta el importe (R18)', () => {
  it('la tabla de pedidos no pinta el importe (R18)', () => {
    const ids = ORDER_COLUMNS.map((column) => column.id);
    expect(ids).not.toContain('ingredientsCost');
    expect(ids).not.toContain('importe');
    expect(ids).toHaveLength(14);

    const VALOR_DELATOR = '999999.9999';
    const order = pedido({ ingredientsCost: VALOR_DELATOR, actualCost: VALOR_DELATOR });
    const idsRenderizablesSinContexto = [
      ORDER_NUMBER_COLUMN_ID,
      STATUS_COLUMN_ID,
      PRIORITY_COLUMN_ID,
      RECIPE_NAME_COLUMN_ID,
      ORDER_CUSTOMER_NAME_COLUMN_ID,
      PRESENTATION_NAME_COLUMN_ID,
      PENDING_DELIVERY_COLUMN_ID,
      CREATED_AT_COLUMN_ID,
      CANCELLATION_REASON_COLUMN_ID,
    ];
    for (const id of idsRenderizablesSinContexto) {
      const { container } = pintarCelda(id, order);
      expect(container.textContent).not.toContain(VALOR_DELATOR);
    }
  });
});

describe('las columnas «Costo estimado» y «Costo real»', () => {
  it('R19: son contiguas, en ese orden, justo antes de las acciones', () => {
    const ids = ORDER_COLUMNS.map((column) => column.id);

    expect(ids.at(-1)).toBe(ACTIONS_COLUMN_ID);
    expect(ids.at(-2)).toBe(ACTUAL_COST_COLUMN_ID);
    expect(ids.at(-3)).toBe(PRODUCTION_COST_COLUMN_ID);
  });

  it('R19: se rotulan «Costo estimado» y «Costo real», y el rotulo viejo ya no esta', () => {
    const porId = new Map(ORDER_COLUMNS.map((column) => [column.id, column]));

    expect(porId.get(PRODUCTION_COST_COLUMN_ID)?.label).toBe('Costo estimado');
    expect(porId.get(ACTUAL_COST_COLUMN_ID)?.label).toBe('Costo real');
    expect(ORDER_COLUMNS.map((column) => column.label)).not.toContain('Costo de producción');
  });

  it('R19: el estimado conserva su id para no perder preferencias guardadas', () => {
    expect(PRODUCTION_COST_COLUMN_ID).toBe('productionCost');
    expect(ACTUAL_COST_COLUMN_ID).toBe('actualCost');
  });

  it('R19: ninguna de las dos ordena ni filtra', () => {
    for (const id of [PRODUCTION_COST_COLUMN_ID, ACTUAL_COST_COLUMN_ID]) {
      const costo = ORDER_COLUMNS.find((column) => column.id === id);
      expect(costo?.sortable, id).not.toBe(true);
      expect(costo?.filter, id).toBeUndefined();
    }
  });

  it('R19: las dos alinean al final y en cifras tabulares', () => {
    for (const id of [PRODUCTION_COST_COLUMN_ID, ACTUAL_COST_COLUMN_ID]) {
      const costo = ORDER_COLUMNS.find((column) => column.id === id);
      expect(costo?.align, id).toBe('end');
      expect(costo?.tabular, id).toBe(true);
    }
  });

  it('R20: sin coste real pinta el guion con el rotulo «Sin dato», nunca 0 ni vacio', () => {
    pintarCelda(ACTUAL_COST_COLUMN_ID, pedido({ ingredientsCost: '50.0000', actualCost: null }));

    expect(screen.queryByTestId(ACTUAL_COST_TESTID)).toBeNull();
    const guion = screen.getByTestId(`order-missing-${ACTUAL_COST_COLUMN_ID}`);
    expect(guion).toHaveTextContent(MISSING_VALUE_MARK);
    expect(guion).toHaveAccessibleName('Sin dato');
    expect(guion).not.toHaveTextContent('0');
  });

  it('R20: sin estimado pinta el guion con el rotulo «Sin dato», como hoy', () => {
    pintarCelda(PRODUCTION_COST_COLUMN_ID, pedido({ ingredientsCost: null, packagingCost: null }));

    expect(screen.queryByTestId(PRODUCTION_COST_TESTID)).toBeNull();
    const guion = screen.getByTestId(`order-missing-${PRODUCTION_COST_COLUMN_ID}`);
    expect(guion).toHaveTextContent(MISSING_VALUE_MARK);
    expect(guion).toHaveAccessibleName('Sin dato');
  });

  it('R20: el real no cae al estimado cuando falta', () => {
    pintarCelda(ACTUAL_COST_COLUMN_ID, pedido({ ingredientsCost: '50.0000', actualCost: null }));

    expect(document.body).not.toHaveTextContent('50.00');
  });

  it('R21: un importe exacto a dos decimales no lleva `title`', () => {
    pintarCelda(ACTUAL_COST_COLUMN_ID, pedido({ actualCost: '120.0000' }));

    const celda = screen.getByTestId(ACTUAL_COST_TESTID);
    expect(celda.textContent).toBe('$120.00');
    expect(celda).not.toHaveAttribute('title');
  });

  it('R21: un importe que se redondea expone el exacto en el `title`', () => {
    pintarCelda(ACTUAL_COST_COLUMN_ID, pedido({ actualCost: '12752.5512' }));

    const celda = screen.getByTestId(ACTUAL_COST_TESTID);
    expect(celda.textContent).toBe('$12,752.55');
    expect(celda).toHaveAttribute('title', '12752.5512');
  });

  it('R21: el real se pinta de `actualCost` y no del estimado', () => {
    pintarCelda(ACTUAL_COST_COLUMN_ID, pedido({ ingredientsCost: '99.0000', actualCost: '120.0000' }));

    expect(screen.getByTestId(ACTUAL_COST_TESTID).textContent).toBe('$120.00');
    expect(screen.getByTestId(ACTUAL_COST_TESTID)).not.toHaveTextContent('99.00');
  });

  it('el estimado pinta el importe como dinero, con el valor exacto en el `title` si se redondea', () => {
    pintarCelda(PRODUCTION_COST_COLUMN_ID, pedido({ ingredientsCost: '1234.5670', packagingCost: '0.0000' }));

    const celda = screen.getByTestId(PRODUCTION_COST_TESTID);
    expect(celda).toHaveTextContent('$1,234.57');
    expect(celda).toHaveAttribute('title', '1234.567');
  });

  it('el estimado NO suma `packagingCost`: los envases ya van dentro de `ingredientsCost`', () => {
    pintarCelda(PRODUCTION_COST_COLUMN_ID, pedido({ ingredientsCost: '12.5000', packagingCost: '2.0000' }));

    const celda = screen.getByTestId(PRODUCTION_COST_TESTID);
    expect(celda).toHaveTextContent('$12.50');
    expect(celda).not.toHaveTextContent('$14.50');
    expect(celda).not.toHaveAttribute('title');
  });
});

describe('QC-102 — la columna propia de responsables (R16)', () => {
  it('existe una columna `responsibles`, y va antes de las acciones', () => {
    const ids = ORDER_COLUMNS.map((column) => column.id);

    expect(ids).toContain(RESPONSIBLES_COLUMN_ID);
    expect(ids.indexOf(RESPONSIBLES_COLUMN_ID)).toBeLessThan(ids.indexOf(ACTIONS_COLUMN_ID));
  });

  it('no ordena, no filtra y se puede fijar como cualquier otra columna de datos', () => {
    const responsables = ORDER_COLUMNS.find((column) => column.id === RESPONSIBLES_COLUMN_ID);

    // `sortable: false` se expresa NO declarandolo: el orden de la lista lo manda `pedidos`.
    expect(responsables?.sortable).not.toBe(true);
    expect(responsables?.filter).toBeUndefined();
    // `pinnable` por defecto: la unica columna que no se puede fijar sigue siendo la de acciones.
    expect(responsables?.pinnable).not.toBe(false);
  });

  it('la celda se pinta con lo que el lote ya trajo para ESA fila, sin pedir nada', () => {
    const RESPONSABLE = {
      userId: '0000000a-0000-4000-8000-00000000000a',
      displayName: 'Ana Torres',
      origin: { kind: 'direct' } as const,
    };
    const order = pedido();
    const columnas = buildOrderColumns({
      units: [],
      bridge: null,
      responsiblesByOrder: { [order.id]: [RESPONSABLE] },
    });
    const columna = columnas.find((candidate) => candidate.id === RESPONSIBLES_COLUMN_ID);

    // La celda es un elemento y recibe por props los responsables de SU fila: se comprueba sobre
    // el arbol declarado, sin renderizar —montar el panel exige el router, y esa es otra suite—.
    const celda = columna?.cell(order) as { props: { responsibles: readonly unknown[] } };
    expect(celda.props.responsibles).toEqual([RESPONSABLE]);

    // Y una fila sin entrada en el lote no rompe: recibe la lista vacia (R19, R20).
    const otra = columna?.cell(pedido({ id: '99999999-9999-4999-8999-999999999999' })) as {
      props: { responsibles: readonly unknown[] };
    };
    expect(otra.props.responsibles).toEqual([]);
  });
});

describe('QC-141 T14 — la columna propia de cobertura del material (R35)', () => {
  it('existe una columna `coverage`, entre el motivo de cancelacion y responsables', () => {
    const ids = ORDER_COLUMNS.map((column) => column.id);

    expect(ids).toContain(COVERAGE_COLUMN_ID);
    expect(ids.indexOf(CANCELLATION_REASON_COLUMN_ID)).toBeLessThan(ids.indexOf(COVERAGE_COLUMN_ID));
    expect(ids.indexOf(COVERAGE_COLUMN_ID)).toBeLessThan(ids.indexOf(RESPONSIBLES_COLUMN_ID));
  });

  it('no ordena, no filtra y se puede fijar como cualquier otra columna de datos', () => {
    const cobertura = ORDER_COLUMNS.find((column) => column.id === COVERAGE_COLUMN_ID);

    expect(cobertura?.sortable).not.toBe(true);
    expect(cobertura?.filter).toBeUndefined();
    expect(cobertura?.pinnable).not.toBe(false);
  });

  it.each(['full', 'none', 'partial'] as const)(
    'pinta la etiqueta de N6 para la cobertura `%s` (R35)',
    (coverage) => {
      const order = pedido();
      const columnas = buildOrderColumns({
        units: [],
        bridge: null,
        coverageByOrder: { [order.id]: coverage },
      });
      const columna = columnas.find((candidate) => candidate.id === COVERAGE_COLUMN_ID);

      render(<>{columna?.cell(order)}</>);

      const etiqueta = screen.getByTestId('order-coverage');
      expect(etiqueta).toHaveAttribute('data-coverage', coverage);
      expect(etiqueta).toHaveTextContent(ORDER_COVERAGE_LABELS[coverage]);
      expect(screen.queryByTestId(`order-missing-${COVERAGE_COLUMN_ID}`)).toBeNull();
    },
  );

  it('los tres textos de N6 son exactamente «Apartado», «Sin apartar» y «Sin cobertura completa» (R35)', () => {
    expect(ORDER_COVERAGE_LABELS).toEqual({
      full: 'Apartado',
      none: 'Sin apartar',
      partial: 'Sin cobertura completa',
    });
  });

  it('sin entrada en el lote —fallo o carga en vuelo— pinta el marcador de ausencia (R20, R35)', () => {
    // `ORDER_COLUMNS` (arriba del archivo) se construye SIN `coverageByOrder`: es exactamente el
    // caso del lote caido, mismo criterio que ya usan las celdas de receta y motivo.
    pintarCelda(COVERAGE_COLUMN_ID, pedido());

    expect(screen.getByTestId(`order-missing-${COVERAGE_COLUMN_ID}`)).toHaveTextContent(
      MISSING_VALUE_MARK,
    );
    expect(screen.queryByTestId('order-coverage')).toBeNull();
  });
});

describe('la columna «Cliente»', () => {
  const CLIENTE_ID = '6f1c2a3b-4d5e-4f60-8a71-b2c3d4e5f601';

  it('R30: pinta el nombre del cliente del pedido', () => {
    pintarCelda(
      ORDER_CUSTOMER_NAME_COLUMN_ID,
      pedido({ customer: { id: CLIENTE_ID, name: 'Ana Garcia', isDeleted: false } }),
    );

    expect(screen.getByText('Ana Garcia')).toBeInTheDocument();
    expect(screen.queryByText(CLIENTE_ID)).toBeNull();
  });

  it('R20: un cliente dado de baja lleva el sufijo «(eliminado)»', () => {
    pintarCelda(
      ORDER_CUSTOMER_NAME_COLUMN_ID,
      pedido({ customer: { id: CLIENTE_ID, name: 'Bruno Lopez', isDeleted: true } }),
    );

    expect(screen.getByText('Bruno Lopez (eliminado)')).toBeInTheDocument();
  });

  it('R30: sin cliente pinta el marcador de ausencia', () => {
    pintarCelda(ORDER_CUSTOMER_NAME_COLUMN_ID, pedido({ customer: null }));

    expect(screen.getByTestId(`order-missing-${ORDER_CUSTOMER_NAME_COLUMN_ID}`)).toHaveTextContent(
      MISSING_VALUE_MARK,
    );
  });

  it('R26/R30: no ordena ni filtra desde su cabecera', () => {
    const columna = ORDER_COLUMNS.find((column) => column.id === ORDER_CUSTOMER_NAME_COLUMN_ID);

    expect(columna?.sortable).toBeUndefined();
    expect(columna?.filter).toBeUndefined();
  });

  it('R30: va justo detras de «Receta»', () => {
    const ids = ORDER_COLUMNS.map((column) => column.id);

    expect(ids.indexOf(ORDER_CUSTOMER_NAME_COLUMN_ID)).toBe(ids.indexOf(RECIPE_NAME_COLUMN_ID) + 1);
  });
});

// 2026-10-13 — la celda de «Presentación» enlaza a la ficha del producto terminado en los pedidos
// producidos. Los casos de arriba, sin mapa, siguen afirmando el reparto de siempre.
describe('la columna «Presentación» enlaza al producto terminado del pedido producido', () => {
  const PEDIDO_ID = '11111111-1111-4111-8111-111111111111';
  const PRESENTACION_ID = 'p-1';
  const PRODUCTO_ID = '33333333-3333-4333-8333-333333333333';
  const LINEAS = [
    { presentationId: PRESENTACION_ID, presentationName: 'Bidón 20L', packages: 2, packagingProductId: null, packagingName: null, presentationContent: null, presentationUnitLabel: null },
  ];

  function pintarPresentacionConMapa(order: OrderSummary) {
    const columnas = buildOrderColumns({
      units: [],
      bridge: null,
      producedProductsByOrder: { [PEDIDO_ID]: { [PRESENTACION_ID]: PRODUCTO_ID } },
    });
    const columna = columnas.find((candidate) => candidate.id === PRESENTATION_NAME_COLUMN_ID);
    if (columna === undefined) throw new Error('No existe la columna de presentación');
    return render(<>{columna.cell(order)}</>);
  }

  it.each(['TERMINADO', 'ENTREGADO'] as const)(
    'R27: un pedido %s con mapa enlaza la presentación a la ficha de su producto',
    (status) => {
      pintarPresentacionConMapa(pedido({ id: PEDIDO_ID, status, presentationLines: LINEAS }));

      const enlace = screen.getByTestId(ORDER_PRODUCED_PRODUCT_LINK_TESTID);
      expect(enlace).toHaveAttribute('href', finishedProductDetailRoute(PRODUCTO_ID));
      expect(enlace).toHaveTextContent('2 × Bidón 20L');
    },
  );

  it.each(['EN_EMPAQUE', 'CANCELADO'] as const)(
    'R28: un pedido %s con mapa pinta el reparto de siempre, sin enlace',
    (status) => {
      const { container } = pintarPresentacionConMapa(
        pedido({ id: PEDIDO_ID, status, presentationLines: LINEAS }),
      );

      expect(screen.queryByTestId(ORDER_PRODUCED_PRODUCT_LINK_TESTID)).toBeNull();
      expect(screen.queryByTestId(ORDER_PRODUCED_PRESENTATIONS_TESTID)).toBeNull();
      expect(container.textContent).toBe('2 × Bidón 20L');
    },
  );

  it.each(['TERMINADO', 'ENTREGADO'] as const)(
    'R28: un pedido %s sin mapa pinta el reparto de siempre, sin enlace',
    (status) => {
      const { container } = pintarCelda(
        PRESENTATION_NAME_COLUMN_ID,
        pedido({ id: PEDIDO_ID, status, presentationLines: LINEAS }),
      );

      expect(screen.queryByTestId(ORDER_PRODUCED_PRODUCT_LINK_TESTID)).toBeNull();
      expect(screen.queryByTestId(ORDER_PRODUCED_PRESENTATIONS_TESTID)).toBeNull();
      expect(container.textContent).toBe('2 × Bidón 20L');
    },
  );

  it('R28: un pedido TERMINADO cuyo id no está en el mapa pinta el reparto de siempre', () => {
    const { container } = pintarPresentacionConMapa(
      pedido({
        id: '44444444-4444-4444-8444-444444444444',
        status: 'TERMINADO',
        presentationLines: LINEAS,
      }),
    );

    expect(screen.queryByTestId(ORDER_PRODUCED_PRODUCT_LINK_TESTID)).toBeNull();
    expect(container.textContent).toBe('2 × Bidón 20L');
  });
});

describe('la columna «Por entregar», traida del dashboard', () => {
  // 2026-10-22: pasa delante de «Presentación», justo despues de «Cliente» (decision humana).
  it('va despues de Cliente, antes de Presentación, y no ordena ni filtra', () => {
    const ids = ORDER_COLUMNS.map((column) => column.id);
    expect(ids.indexOf(PENDING_DELIVERY_COLUMN_ID)).toBe(ids.indexOf(ORDER_CUSTOMER_NAME_COLUMN_ID) + 1);
    expect(ids.indexOf(PRESENTATION_NAME_COLUMN_ID)).toBe(ids.indexOf(PENDING_DELIVERY_COLUMN_ID) + 1);

    const columna = ORDER_COLUMNS.find((column) => column.id === PENDING_DELIVERY_COLUMN_ID);
    expect(columna?.sortable).not.toBe(true);
    expect(columna?.filter).toBeUndefined();
  });

  it('pendiente: pinta cantidad y nombre de cada presentacion, separadas por coma', () => {
    pintarCelda(
      PENDING_DELIVERY_COLUMN_ID,
      pedido({
        status: 'POR_ACONDICIONAR',
        pendingDelivery: {
          kind: 'pending',
          items: [
            { label: 'galones', quantity: 4 },
            { label: 'vasos', quantity: 2 },
          ],
        },
      }),
    );

    const celda = screen.getByTestId(PENDING_DELIVERY_TESTID);
    expect(celda).toHaveTextContent('4 galones, 2 vasos');
    expect(celda).toHaveAttribute('title', '4 galones, 2 vasos');
    expect(celda).not.toHaveAttribute('data-empty');
  });

  it('entregado: pinta «Entregado» atenuado, como lo hacia el dashboard', () => {
    pintarCelda(
      PENDING_DELIVERY_COLUMN_ID,
      pedido({ status: 'ENTREGADO', pendingDelivery: { kind: 'delivered' } }),
    );

    const celda = screen.getByTestId(PENDING_DELIVERY_TESTID);
    expect(NOTHING_PENDING_MARK).toBe(ORDER_STATUS_LABELS.ENTREGADO);
    expect(celda).toHaveTextContent(NOTHING_PENDING_MARK);
    expect(celda).toHaveAttribute('data-empty', 'true');
    expect(celda).toHaveClass('text-muted-foreground');
  });

  it.each(['EN_EMPAQUE', 'CANCELADO'] as const)(
    'sin empacar (%s): pinta el marcador de ausencia atenuado, no «Entregado»',
    (status) => {
      pintarCelda(PENDING_DELIVERY_COLUMN_ID, pedido({ status, pendingDelivery: { kind: 'not_packed' } }));

      const celda = screen.getByTestId(PENDING_DELIVERY_TESTID);
      expect(celda).toHaveTextContent(MISSING_VALUE_MARK);
      expect(celda).not.toHaveTextContent(NOTHING_PENDING_MARK);
      expect(celda).toHaveAttribute('data-empty', 'true');
      expect(celda).toHaveClass('text-muted-foreground');
    },
  );

  it('pendiente sin presentaciones con nombre: pinta el marcador de ausencia, no una celda vacia', () => {
    pintarCelda(
      PENDING_DELIVERY_COLUMN_ID,
      pedido({ status: 'TERMINADO', pendingDelivery: { kind: 'pending', items: [] } }),
    );

    const celda = screen.getByTestId(PENDING_DELIVERY_TESTID);
    expect(celda).toHaveTextContent(MISSING_VALUE_MARK);
    expect(celda).toHaveAttribute('data-empty', 'true');
  });
});
