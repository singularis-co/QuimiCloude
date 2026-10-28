import { describe, expect, it } from 'vitest';

import {
  missingValuesText,
  resolveTemplate,
  systemConstantsFor,
} from '@/app/(private)/clientes/contactos/components/template-values';
import type { WhatsappSendableTemplate } from '@/lib/modules/integraciones';

type Variable = WhatsappSendableTemplate['variables'][number];

function system(key: string, slot: string): Variable {
  return { slot, position: 1, kind: 'system', key, label: null, value: null };
}

function own(key: string, label: string | null, slot: string): Variable {
  return { slot, position: 1, kind: 'company', key, label, value: 'guardado' };
}

function template(
  body: string,
  variables: readonly Variable[],
  extra: { header?: string | null; footer?: string | null } = {},
): WhatsappSendableTemplate {
  return {
    id: 't1',
    name: 'pedido_listo',
    language: 'es_MX',
    category: 'UTILITY',
    content: {
      header: extra.header == null ? null : { text: extra.header, example: null },
      body: { text: body, examples: [] },
      footer: extra.footer ?? null,
      buttons: [],
    },
    variables,
  };
}

const VALUES = {
  'cliente.nombre': 'Laura Gómez',
  'empresa.nombre': 'Químicos del Sur',
  'pedido.numero': '2026-0000128',
  'pedido.estado': 'en preparación',
  'pedido.fecha_solicitud': '20/10/2026',
  'pedido.total': null,
  'pedido.detalle': '10 × Bidón 20 L (entregado 6, faltan 4)',
  horario: 'de 8 a 17 h',
};

describe('resolveTemplate', () => {
  it('R35: reemplaza cada clave del encabezado, el cuerpo y el pie con values', () => {
    const tpl = template(
      'Hola {{cliente.nombre}}, tu pedido {{pedido.numero}} está {{pedido.estado}} desde el {{pedido.fecha_solicitud}}: {{pedido.detalle}}. Atendemos {{horario}}.',
      [system('cliente.nombre', 'body.1'), system('pedido.numero', 'body.2'), own('horario', 'Horario', 'body.3')],
      { header: '{{empresa.nombre}}', footer: 'Gracias por elegirnos' },
    );
    const resolved = resolveTemplate(tpl, VALUES);
    expect(resolved.header).toBe('Químicos del Sur');
    expect(resolved.body).toBe(
      'Hola Laura Gómez, tu pedido 2026-0000128 está en preparación desde el 20/10/2026: 10 × Bidón 20 L (entregado 6, faltan 4). Atendemos de 8 a 17 h.',
    );
    expect(resolved.footer).toBe('Gracias por elegirnos');
    expect(resolved.missing).toEqual([]);
  });

  it('R35: una clave ausente y un valor null salen como [falta <clave>]', () => {
    const tpl = template('Hola {{cliente.nombre}}, {{promocion}}', [own('promocion', 'Promoción', 'body.2')]);
    const resolved = resolveTemplate(tpl, { 'cliente.nombre': null });
    expect(resolved.body).toBe('Hola [falta cliente.nombre], [falta promocion]');
  });

  it('R35: pedido.total null sale [falta pedido.total], nunca «—»', () => {
    const resolved = resolveTemplate(template('Total: {{pedido.total}}', [system('pedido.total', 'body.1')]), VALUES);
    expect(resolved.body).toBe('Total: [falta pedido.total]');
    expect(resolved.body).not.toContain('—');
  });

  it('R35: el texto de la caja une encabezado, cuerpo y pie no vacíos con una línea en blanco', () => {
    expect(resolveTemplate(template('Cuerpo', [], { header: 'Encabezado', footer: 'Pie' }), {}).text).toBe('Encabezado\n\nCuerpo\n\nPie');
    expect(resolveTemplate(template('Solo cuerpo', [], { header: null, footer: '' }), {}).text).toBe('Solo cuerpo');
  });

  it('R36: missing lleva las etiquetas del catálogo, incluidas las cuatro constantes nuevas, sin repetir', () => {
    const tpl = template(
      '{{pedido.estado}} {{pedido.fecha_solicitud}} {{pedido.total}} {{pedido.detalle}} {{pedido.total}}',
      [system('pedido.estado', 'body.1'), system('pedido.fecha_solicitud', 'body.2'), system('pedido.total', 'body.3'), system('pedido.detalle', 'body.4')],
    );
    expect(resolveTemplate(tpl, {}).missing).toEqual([
      { key: 'pedido.estado', label: 'Estado del pedido' },
      { key: 'pedido.fecha_solicitud', label: 'Fecha de solicitud' },
      { key: 'pedido.total', label: 'Total del pedido' },
      { key: 'pedido.detalle', label: 'Detalle del pedido' },
    ]);
  });

  it('R36: una propia que falta usa su etiqueta, y sin etiqueta la clave', () => {
    const tpl = template('{{horario}} {{codigo}}', [own('horario', 'Horario de atención', 'body.1'), own('codigo', null, 'body.2')]);
    expect(resolveTemplate(tpl, {}).missing).toEqual([
      { key: 'horario', label: 'Horario de atención' },
      { key: 'codigo', label: 'codigo' },
    ]);
  });

  it('R38: otros values dan otro texto resuelto', () => {
    const tpl = template('Pedido {{pedido.numero}}: {{pedido.estado}}', [system('pedido.numero', 'body.1'), system('pedido.estado', 'body.2')]);
    const first = resolveTemplate(tpl, VALUES).text;
    const second = resolveTemplate(tpl, { ...VALUES, 'pedido.numero': '2026-0000101', 'pedido.estado': 'recibido' }).text;
    expect(first).toBe('Pedido 2026-0000128: en preparación');
    expect(second).toBe('Pedido 2026-0000101: recibido');
  });
});

describe('missingValuesText', () => {
  it('R36: con 1, 2 y 3 faltantes usa el formato del back; sin faltantes no hay texto', () => {
    const entry = (label: string) => ({ key: label, label });
    expect(missingValuesText([])).toBeNull();
    expect(missingValuesText([entry('A')])).toBe('Falta el valor de A');
    expect(missingValuesText([entry('A'), entry('B')])).toBe('Falta el valor de A y B');
    expect(missingValuesText([entry('A'), entry('B'), entry('C')])).toBe('Falta el valor de A, B y C');
  });
});

describe('systemConstantsFor', () => {
  it('R37/R41: manda solo las constantes de la plantilla con valor, sin las nulas ni las propias', () => {
    const tpl = template('{{cliente.nombre}} {{pedido.total}} {{pedido.numero}} {{horario}}', [
      system('cliente.nombre', 'body.1'),
      system('pedido.total', 'body.2'),
      system('pedido.numero', 'body.3'),
      own('horario', 'Horario', 'body.4'),
    ]);
    expect(systemConstantsFor(tpl, VALUES)).toEqual({ 'cliente.nombre': 'Laura Gómez', 'pedido.numero': '2026-0000128' });
  });

  it('R37: no manda constantes que la plantilla no usa aunque estén en values', () => {
    expect(systemConstantsFor(template('Hola', []), VALUES)).toEqual({});
  });
});
