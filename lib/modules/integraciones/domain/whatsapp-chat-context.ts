import {
  formatOrderNumber,
  ORDER_STATUSES_NOT_IN_PROGRESS,
  orderedPackages,
  remainingPackages,
  type CustomerOrderSummary,
  type OrderDeliveryProgress,
  type OrderStatus,
} from '@/lib/modules/pedidos';

import { customerNameOf } from './whatsapp-conversation';

export const WHATSAPP_SYSTEM_CONSTANT_KEYS = [
  'cliente.nombre',
  'empresa.nombre',
  'pedido.numero',
  'pedido.estado',
  'pedido.fecha_solicitud',
  'pedido.total',
  'pedido.detalle',
] as const;

export type WhatsappSystemConstantKey = (typeof WHATSAPP_SYSTEM_CONSTANT_KEYS)[number];

export type CustomerOrderStage = 'recibido' | 'en preparación' | 'entregado' | 'cancelado';

// El único sitio con el texto que lee el cliente por estado: el `Record` obliga a etiquetar un estado nuevo.
export const CUSTOMER_ORDER_STAGE: Readonly<Record<OrderStatus, CustomerOrderStage>> = {
  PENDIENTE: 'recibido',
  EN_CURSO: 'en preparación',
  POR_EMPACAR: 'en preparación',
  EN_EMPAQUE: 'en preparación',
  POR_ACONDICIONAR: 'en preparación',
  EN_ACONDICIONAMIENTO: 'en preparación',
  TERMINADO: 'en preparación',
  BLOQUEADO: 'en preparación',
  ENTREGADO: 'entregado',
  CANCELADO: 'cancelado',
};

export const UNNAMED_PRESENTATION_TEXT = 'presentación sin nombre';

export type WhatsappCustomerOrderStatus = Exclude<OrderStatus, (typeof ORDER_STATUSES_NOT_IN_PROGRESS)[number]>;

export type WhatsappCustomerOrderLine = {
  readonly presentationId: string;
  readonly presentationName: string | null;
  readonly ordered: number;
  readonly delivered: number;
  readonly pending: number;
};

export type WhatsappCustomerOrder = {
  readonly id: string;
  readonly number: string;
  readonly status: WhatsappCustomerOrderStatus;
  readonly requestedAt: string;
  readonly total: string | null;
  readonly productName: string | null;
  readonly lines: readonly WhatsappCustomerOrderLine[];
};

export type WhatsappChatContext = {
  readonly customer: { readonly id: string; readonly name: string };
  readonly orders: readonly WhatsappCustomerOrder[];
  readonly selectedOrderId: string | null;
  readonly values: Readonly<Record<string, string | null>>;
};

export type OpenCustomerOrderSummary = CustomerOrderSummary & { readonly status: WhatsappCustomerOrderStatus };

export function isOpenCustomerOrder(summary: CustomerOrderSummary): summary is OpenCustomerOrderSummary {
  return !(ORDER_STATUSES_NOT_IN_PROGRESS as readonly OrderStatus[]).includes(summary.status);
}

type NamedRefs = ReadonlyMap<string, { readonly name: string }>;

/** `DD/MM/AAAA` del día UTC: el mismo día civil que muestra Pedidos. */
export function customerDateOf(instant: Date): string {
  const [year, month, day] = instant.toISOString().slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function textOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === '') return null;
  return value;
}

// Meta rechaza un parámetro con saltos de línea, tabuladores o más de cuatro espacios seguidos.
function singleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function presentationTextOf(name: string | null): string {
  const text = name === null ? '' : singleLine(name);
  return text === '' ? UNNAMED_PRESENTATION_TEXT : text;
}

function lineTextOf(line: WhatsappCustomerOrderLine): string {
  const pendingWord = line.pending === 1 ? 'falta' : 'faltan';
  const presentation = presentationTextOf(line.presentationName);
  return `${line.ordered} × ${presentation} (entregado ${line.delivered}, ${pendingWord} ${line.pending})`;
}

export function orderDetailTextOf(lines: readonly WhatsappCustomerOrderLine[]): string | null {
  if (lines.length === 0) return null;
  return lines.map(lineTextOf).join('; ');
}

export function customerOrderOf(
  summary: OpenCustomerOrderSummary,
  progress: OrderDeliveryProgress | null,
  presentations: NamedRefs,
  recipes: NamedRefs,
): WhatsappCustomerOrder {
  const lines = (progress?.lines ?? []).map((line) => {
    const ordered = orderedPackages(line);
    const delivered = line.deliveredPackages;
    return {
      presentationId: line.presentationId,
      presentationName: presentations.get(line.presentationId)?.name ?? null,
      ordered,
      delivered,
      pending: remainingPackages({ presentationLineId: line.presentationId, orderedPackages: ordered, deliveredPackages: delivered }),
    };
  });
  return {
    id: summary.id,
    number: formatOrderNumber(summary.number),
    status: summary.status,
    requestedAt: summary.createdAt.toISOString(),
    total: null,
    productName: recipes.get(summary.recipeId)?.name ?? null,
    lines,
  };
}

export type ContextValuesSource = {
  readonly customer: { readonly firstNames: string; readonly lastNames: string };
  readonly companyName: string | null;
  readonly selected: WhatsappCustomerOrder | null;
  readonly variables: readonly { readonly key: string; readonly value: string | null }[];
};

type OrderConstantKey = Extract<WhatsappSystemConstantKey, `pedido.${string}`>;

function orderValuesOf(selected: WhatsappCustomerOrder | null): Record<OrderConstantKey, string | null> {
  if (selected === null) {
    return {
      'pedido.numero': null,
      'pedido.estado': null,
      'pedido.fecha_solicitud': null,
      'pedido.total': null,
      'pedido.detalle': null,
    };
  }
  return {
    'pedido.numero': textOrNull(selected.number),
    'pedido.estado': CUSTOMER_ORDER_STAGE[selected.status],
    'pedido.fecha_solicitud': customerDateOf(new Date(selected.requestedAt)),
    'pedido.total': textOrNull(selected.total),
    'pedido.detalle': orderDetailTextOf(selected.lines),
  };
}

export function contextValuesOf(source: ContextValuesSource): Readonly<Record<string, string | null>> {
  const values: Record<string, string | null> = {};
  for (const variable of source.variables) values[variable.key] = textOrNull(variable.value);
  return {
    ...values,
    'cliente.nombre': textOrNull(customerNameOf(source.customer)),
    'empresa.nombre': textOrNull(source.companyName),
    ...orderValuesOf(source.selected),
  } satisfies Record<WhatsappSystemConstantKey, string | null>;
}
