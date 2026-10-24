import { describe, expect, it } from 'vitest';

import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';
import {
  SYSTEM_CONSTANTS,
  constantLabelsForBackend,
  displayKeyOf,
  isSystemDisplayKey,
  systemConstantOf,
  toBackendKey,
  toBackendText,
  toDisplayText,
} from '@/lib/shared/ui/whatsapp-system-constants';

const ACTUALES = [
  {
    displayKey: 'nombre_del_cliente',
    backendKey: 'cliente.nombre',
    label: 'Nombre del cliente',
    description: 'Nombres y apellidos del cliente que recibe el mensaje.',
    example: 'Laura Gómez',
  },
  {
    displayKey: 'numero_de_pedido',
    backendKey: 'pedido.numero',
    label: 'Número de pedido',
    description: 'Número del pedido del que trata el mensaje.',
    example: 'PED-00128',
  },
  {
    displayKey: 'nombre_de_la_empresa',
    backendKey: 'empresa.nombre',
    label: 'Nombre de la empresa',
    description: 'El nombre de tu empresa en QuimiCloude.',
    example: EMPTY_MARK,
  },
];

const NUEVAS = [
  {
    displayKey: 'estado_del_pedido',
    backendKey: 'pedido.estado',
    label: 'Estado del pedido',
    description: 'Estado del pedido como lo ve el cliente: recibido, en preparación, entregado o cancelado.',
    example: 'en preparación',
  },
  {
    displayKey: 'fecha_de_solicitud',
    backendKey: 'pedido.fecha_solicitud',
    label: 'Fecha de solicitud',
    description: 'Día en que se pidió el pedido (DD/MM/AAAA).',
    example: '23/10/2026',
  },
  {
    displayKey: 'total_del_pedido',
    backendKey: 'pedido.total',
    label: 'Total del pedido',
    description: 'Importe total del pedido. Aún no disponible: el mensaje no se envía hasta que lo esté.',
    example: EMPTY_MARK,
  },
  {
    displayKey: 'detalle_del_pedido',
    backendKey: 'pedido.detalle',
    label: 'Detalle del pedido',
    description: 'Presentaciones pedidas, con lo entregado y lo que falta, en una línea.',
    example: '10 × Bidón 20 L (entregado 6, faltan 4)',
  },
];

describe('constantes del sistema de WhatsApp', () => {
  it('R50: son siete, en orden: las tres actuales y luego las cuatro del pedido', () => {
    expect(SYSTEM_CONSTANTS).toEqual([...ACTUALES, ...NUEVAS]);
  });

  it('R50: las tres actuales siguen intactas y en las tres primeras posiciones', () => {
    expect(SYSTEM_CONSTANTS.slice(0, 3)).toEqual(ACTUALES);
  });

  it('R50: claves visibles y del backend sin repetir', () => {
    expect(new Set(SYSTEM_CONSTANTS.map((c) => c.displayKey)).size).toBe(7);
    expect(new Set(SYSTEM_CONSTANTS.map((c) => c.backendKey)).size).toBe(7);
  });

  it('R51: cada clave nueva suelta se traduce a la del backend y vuelve', () => {
    for (const { displayKey, backendKey } of NUEVAS) {
      expect(isSystemDisplayKey(displayKey)).toBe(true);
      expect(systemConstantOf(displayKey)?.backendKey).toBe(backendKey);
      expect(toBackendKey(displayKey)).toBe(backendKey);
      expect(displayKeyOf(backendKey)).toBe(displayKey);
    }
  });

  it('R51: dentro de un texto con marcas, las cuatro nuevas se traducen en los dos sentidos y lo ajeno queda intacto', () => {
    const pantalla =
      'Pedido {{numero_de_pedido}}: {{estado_del_pedido}} desde {{fecha_de_solicitud}}. Total {{total_del_pedido}}. {{detalle_del_pedido}} {{numero_de_cuenta}} {{1}}';
    const backend =
      'Pedido {{pedido.numero}}: {{pedido.estado}} desde {{pedido.fecha_solicitud}}. Total {{pedido.total}}. {{pedido.detalle}} {{numero_de_cuenta}} {{1}}';
    expect(toBackendText(pantalla)).toBe(backend);
    expect(toDisplayText(backend)).toBe(pantalla);
  });

  it('R51: constantLabelsForBackend trae las siete etiquetas por su clave del backend', () => {
    expect(constantLabelsForBackend()).toEqual({
      'cliente.nombre': 'Nombre del cliente',
      'pedido.numero': 'Número de pedido',
      'empresa.nombre': 'Nombre de la empresa',
      'pedido.estado': 'Estado del pedido',
      'pedido.fecha_solicitud': 'Fecha de solicitud',
      'pedido.total': 'Total del pedido',
      'pedido.detalle': 'Detalle del pedido',
    });
  });
});
