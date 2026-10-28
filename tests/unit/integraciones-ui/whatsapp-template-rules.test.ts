import { describe, expect, it } from 'vitest';

import {
  SYSTEM_CONSTANTS,
  constantLabelsForBackend,
  displayKeyOf,
  toBackendKey,
  toBackendText,
  toDisplayText,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-system-constants';
import {
  LANGUAGE_OPTIONS,
  TEMPLATE_RULES_TEXTS,
  categoryLabelOf,
  dictionaryOf,
  draftFromView,
  formatSyncDateTime,
  isMappable,
  isUnmapped,
  labelOfKey,
  metaLengthOf,
  notCompatibleReasonOf,
  numberedContentOf,
  slotMarkOf,
  statusBadgeOf,
  usageBadgeOf,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-template-rules';
import {
  VARIABLE_RULES_TEXTS,
  keyFromLabel,
  keyProblemOf,
} from '@/app/(private)/integraciones/whatsapp/components/whatsapp-variable-rules';
import {
  WHATSAPP_TEMPLATE_LANGUAGES,
  type WhatsappTemplateContent,
  type WhatsappTemplateView,
} from '@/lib/modules/integraciones';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

function contentOf(body: string, extra: Partial<WhatsappTemplateContent> = {}): WhatsappTemplateContent {
  return { header: null, body: { text: body, examples: [] }, footer: null, buttons: [], ...extra };
}

function viewOf(overrides: Partial<WhatsappTemplateView> = {}): WhatsappTemplateView {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'pedido_listo',
    language: 'es',
    category: 'UTILITY',
    status: 'APPROVED',
    statusRaw: null,
    rejectedReason: null,
    content: contentOf('Hola {{1}}'),
    lastSyncedAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    mappingStatus: 'UNMAPPED',
    enabled: false,
    variables: [{ slot: 'body.1', position: 1, kind: null, key: null, label: null }],
    ...overrides,
  };
}

const OWN = [{ id: 'k1', key: 'numero_de_cuenta', label: 'Número de cuenta', value: '123456', usedBy: 0 }];

describe('constantes del sistema', () => {
  it('R48 R50: son exactamente siete, las tres de siempre primero y luego las cuatro del pedido, con sus textos de pantalla', () => {
    expect(SYSTEM_CONSTANTS.map(({ displayKey, label, description, example }) => ({ displayKey, label, description, example }))).toEqual([
      {
        displayKey: 'nombre_del_cliente',
        label: 'Nombre del cliente',
        description: 'Nombres y apellidos del cliente que recibe el mensaje.',
        example: 'Laura Gómez',
      },
      {
        displayKey: 'numero_de_pedido',
        label: 'Número de pedido',
        description: 'Número del pedido del que trata el mensaje.',
        example: 'PED-00128',
      },
      {
        displayKey: 'nombre_de_la_empresa',
        label: 'Nombre de la empresa',
        description: 'El nombre de tu empresa en QuimiCloude.',
        example: EMPTY_MARK,
      },
      {
        displayKey: 'estado_del_pedido',
        label: 'Estado del pedido',
        description: 'Estado del pedido como lo ve el cliente: recibido, en preparación, entregado o cancelado.',
        example: 'en preparación',
      },
      {
        displayKey: 'fecha_de_solicitud',
        label: 'Fecha de solicitud',
        description: 'Día en que se pidió el pedido (DD/MM/AAAA).',
        example: '23/10/2026',
      },
      {
        displayKey: 'total_del_pedido',
        label: 'Total del pedido',
        description: 'Importe total del pedido. Aún no disponible: el mensaje no se envía hasta que lo esté.',
        example: EMPTY_MARK,
      },
      {
        displayKey: 'detalle_del_pedido',
        label: 'Detalle del pedido',
        description: 'Presentaciones pedidas, con lo entregado y lo que falta, en una línea.',
        example: '10 × Bidón 20 L (entregado 6, faltan 4)',
      },
    ]);
  });

  it('P1 R51: las siete claves van al backend con punto y vuelven a la de pantalla', () => {
    const pairs = [
      ['nombre_del_cliente', 'cliente.nombre'],
      ['numero_de_pedido', 'pedido.numero'],
      ['nombre_de_la_empresa', 'empresa.nombre'],
      ['estado_del_pedido', 'pedido.estado'],
      ['fecha_de_solicitud', 'pedido.fecha_solicitud'],
      ['total_del_pedido', 'pedido.total'],
      ['detalle_del_pedido', 'pedido.detalle'],
    ] as const;
    for (const [display, backend] of pairs) {
      expect(toBackendKey(display)).toBe(backend);
      expect(displayKeyOf(backend)).toBe(display);
      expect(toBackendText(`a {{${display}}} b`)).toBe(`a {{${backend}}} b`);
      expect(toDisplayText(toBackendText(`a {{${display}}} b`))).toBe(`a {{${display}}} b`);
    }
  });

  it('P1: una propia, un {{n}} y una clave con punto desconocida quedan intactas', () => {
    const text = 'Hola {{numero_de_cuenta}} {{1}} {{otra.cosa}}';
    expect(toBackendText(text)).toBe(text);
    expect(toDisplayText(text)).toBe(text);
    expect(displayKeyOf('otra.cosa')).toBe('otra.cosa');
    expect(toBackendKey('numero_de_cuenta')).toBe('numero_de_cuenta');
  });

  it('P1 R51: las etiquetas de las siete constantes van al backend por su clave con punto', () => {
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

  it('R53: una variable propia con la clave de una de las cuatro del pedido da el aviso de clave ocupada', () => {
    expect(keyFromLabel('Estado del pedido')).toBe('estado_del_pedido');
    expect(keyProblemOf('estado_del_pedido', [])).toBe(VARIABLE_RULES_TEXTS.keyTaken('estado_del_pedido'));
    for (const key of ['fecha_de_solicitud', 'total_del_pedido', 'detalle_del_pedido']) {
      expect(keyProblemOf(key, [])).toBe(VARIABLE_RULES_TEXTS.keyTaken(key));
    }
    expect(keyProblemOf('nombre_de_la_empresa', [])).toBe(VARIABLE_RULES_TEXTS.keyTaken('nombre_de_la_empresa'));
  });
});

describe('diccionario de pantalla', () => {
  it('R32: una constante se previsualiza por su ejemplo y una propia por su valor', () => {
    const dictionary = dictionaryOf(OWN);
    expect(dictionary).toHaveLength(8);
    expect(dictionary[0]).toEqual({
      key: 'nombre_del_cliente',
      label: 'Nombre del cliente',
      preview: 'Laura Gómez',
      kind: 'system',
    });
    expect(dictionary[1]).toMatchObject({ key: 'numero_de_pedido', label: 'Número de pedido', preview: 'PED-00128' });
    expect(dictionary[3]).toEqual({ key: 'estado_del_pedido', label: 'Estado del pedido', preview: 'en preparación', kind: 'system' });
    expect(dictionary[7]).toEqual({ key: 'numero_de_cuenta', label: 'Número de cuenta', preview: '123456', kind: 'company' });
  });

  it('R32: una constante sin ejemplo (EMPTY_MARK) se previsualiza por su etiqueta', () => {
    const empresa = dictionaryOf(OWN).find((entry) => entry.key === 'nombre_de_la_empresa');
    expect(empresa).toEqual({
      key: 'nombre_de_la_empresa',
      label: 'Nombre de la empresa',
      preview: 'Nombre de la empresa',
      kind: 'system',
    });
    expect(empresa?.preview).not.toBe(EMPTY_MARK);
  });

  it('R52: el diccionario trae las siete constantes en orden, con el total del pedido previsualizado por su etiqueta', () => {
    const dictionary = dictionaryOf([]);
    expect(dictionary.map((entry) => [entry.key, entry.preview, entry.kind])).toEqual([
      ['nombre_del_cliente', 'Laura Gómez', 'system'],
      ['numero_de_pedido', 'PED-00128', 'system'],
      ['nombre_de_la_empresa', 'Nombre de la empresa', 'system'],
      ['estado_del_pedido', 'en preparación', 'system'],
      ['fecha_de_solicitud', '23/10/2026', 'system'],
      ['total_del_pedido', 'Total del pedido', 'system'],
      ['detalle_del_pedido', '10 × Bidón 20 L (entregado 6, faltan 4)', 'system'],
    ]);
  });

  it('P1: una clave que no está en el diccionario se muestra con la clave como etiqueta', () => {
    const dictionary = dictionaryOf(OWN);
    expect(labelOfKey('numero_de_cuenta', dictionary)).toBe('Número de cuenta');
    expect(labelOfKey('otra.cosa', dictionary)).toBe('otra.cosa');
  });
});

describe('relacionable', () => {
  it('R15: con el contenido vacío no es relacionable', () => {
    const view = viewOf({ content: null, variables: [] });
    expect(isMappable(view)).toBe(false);
    expect(usageBadgeOf(view)).toEqual({ label: 'No compatible', tone: 'muted' });
    expect(notCompatibleReasonOf(view)).toBe(TEMPLATE_RULES_TEXTS.notCompatibleOther);
  });

  it('R15: con una variable con nombre no es relacionable', () => {
    const view = viewOf({ content: contentOf('Hola {{first_name}}'), variables: [] });
    expect(isMappable(view)).toBe(false);
    expect(notCompatibleReasonOf(view)).toBe(TEMPLATE_RULES_TEXTS.notCompatibleNamed);
  });

  it('R15: con huecos {{n}} es relacionable y queda sin relacionar', () => {
    const view = viewOf();
    expect(isMappable(view)).toBe(true);
    expect(isUnmapped(view)).toBe(true);
    expect(usageBadgeOf(view)).toEqual({ label: 'Sin relacionar', tone: 'waiting' });
  });

  it('R15: con la clave de un hueco relacionado es relacionable', () => {
    const view = viewOf({
      content: contentOf('Hola {{cliente.nombre}}, tu cuenta {{numero_de_cuenta}}'),
      mappingStatus: 'MAPPED',
      enabled: true,
      variables: [
        { slot: 'body.1', position: 1, kind: 'system', key: 'cliente.nombre', label: null },
        { slot: 'body.2', position: 2, kind: 'company', key: 'numero_de_cuenta', label: 'Número de cuenta' },
      ],
    });
    expect(isMappable(view)).toBe(true);
    expect(isUnmapped(view)).toBe(false);
    expect(usageBadgeOf(view)).toBeNull();
  });

  it('R15: una marca de URL que no es hueco ni clave relacionada la hace no relacionable', () => {
    const view = viewOf({
      content: contentOf('Hola {{1}}', {
        buttons: [{ type: 'URL', text: 'Ver', url: 'https://x.test/{{codigo}}', example: null }],
      }),
    });
    expect(isMappable(view)).toBe(false);
  });
});

describe('huecos', () => {
  it('R42: marca de cada hueco del cuerpo, del encabezado y de un botón', () => {
    expect(slotMarkOf('body.2')).toBe('{{2}}');
    expect(slotMarkOf('header')).toBe('Encabezado {{1}}');
    expect(slotMarkOf('button.0')).toBe('Botón 1 {{1}}');
  });

  it('R42: el texto de la plantilla vuelve a numerar los huecos relacionados', () => {
    const view = viewOf({
      content: contentOf('Hola {{cliente.nombre}}, pedido {{2}}', {
        header: { text: 'Para {{empresa.nombre}}', example: null },
        buttons: [{ type: 'URL', text: 'Ver', url: 'https://x.test/{{numero_de_cuenta}}', example: null }],
      }),
      variables: [
        { slot: 'header', position: 1, kind: 'system', key: 'empresa.nombre', label: null },
        { slot: 'body.1', position: 1, kind: 'system', key: 'cliente.nombre', label: null },
        { slot: 'body.2', position: 2, kind: null, key: null, label: null },
        { slot: 'button.0', position: 1, kind: 'company', key: 'numero_de_cuenta', label: 'Número de cuenta' },
      ],
    });
    const numbered = numberedContentOf(view);
    expect(numbered?.body.text).toBe('Hola {{1}}, pedido {{2}}');
    expect(numbered?.header?.text).toBe('Para {{1}}');
    expect(numbered?.buttons[0]).toMatchObject({ url: 'https://x.test/{{1}}' });
  });
});

describe('contador', () => {
  it('R26: {{nombre_del_cliente}} cuenta como {{1}}, 5 caracteres', () => {
    expect(metaLengthOf('{{nombre_del_cliente}}')).toBe(5);
  });

  it('R26: la misma clave repetida conserva su número y cuenta puntos de código', () => {
    expect(metaLengthOf('Hola {{nombre_del_cliente}} y {{nombre_del_cliente}} 👋')).toBe('Hola {{1}} y {{1}} 👋'.length - 1);
    expect(metaLengthOf('{{a}}{{b}}')).toBe('{{1}}{{2}}'.length);
  });
});

describe('estado y categoría', () => {
  it('R11: cada estado con su texto y su tono', () => {
    expect(statusBadgeOf({ status: 'APPROVED', statusRaw: null })).toEqual({ label: 'Aprobada', tone: 'success' });
    expect(statusBadgeOf({ status: 'PENDING', statusRaw: null })).toEqual({ label: 'Pendiente', tone: 'waiting' });
    expect(statusBadgeOf({ status: 'REJECTED', statusRaw: null })).toEqual({ label: 'Rechazada', tone: 'danger' });
    expect(statusBadgeOf({ status: 'PAUSED', statusRaw: null })).toEqual({ label: 'Pausada', tone: 'progress' });
    expect(statusBadgeOf({ status: 'DISABLED', statusRaw: null })).toEqual({ label: 'Deshabilitada', tone: 'neutral' });
    expect(statusBadgeOf({ status: 'OTHER', statusRaw: 'IN_APPEAL' })).toEqual({ label: 'Otro · IN_APPEAL', tone: 'muted' });
  });

  it('R10: cada categoría con su nombre', () => {
    expect(categoryLabelOf('UTILITY')).toBe('Utilidad');
    expect(categoryLabelOf('MARKETING')).toBe('Marketing');
    expect(categoryLabelOf('AUTHENTICATION')).toBe('Autenticación');
  });
});

describe('fecha de sincronización', () => {
  it('R7: sin sincronizar muestra la marca de vacío', () => {
    expect(formatSyncDateTime(null)).toBe(EMPTY_MARK);
  });

  it('R7: DD/MM/AAAA HH:MM en la zona que se pide', () => {
    expect(formatSyncDateTime('2026-10-22T03:05:00.000Z', 'America/Bogota')).toBe('21/10/2026 22:05');
    expect(formatSyncDateTime('2026-10-22T03:05:00.000Z', 'UTC')).toBe('22/10/2026 03:05');
  });
});

describe('idiomas', () => {
  it('R24: solo es, los es_* del dominio, en, en_US y en_GB', () => {
    const spanish = WHATSAPP_TEMPLATE_LANGUAGES.filter((code) => code === 'es' || code.startsWith('es_'));
    expect(LANGUAGE_OPTIONS.map((option) => option.code)).toEqual([...spanish, 'en', 'en_GB', 'en_US']);
    expect(LANGUAGE_OPTIONS.filter((option) => option.group === 'es')).toHaveLength(spanish.length);
  });

  it('R24: cada idioma con su nombre en español', () => {
    const nameOf = (code: string) => LANGUAGE_OPTIONS.find((option) => option.code === code)?.name;
    expect(nameOf('es')).toBe('Español');
    expect(nameOf('es_CO')).toBe('Español · Colombia');
    expect(nameOf('es_ES')).toBe('Español · España');
    expect(nameOf('en')).toBe('Inglés');
    expect(nameOf('en_US')).toBe('Inglés · Estados Unidos');
    expect(nameOf('en_GB')).toBe('Inglés · Reino Unido');
  });
});

describe('duplicar', () => {
  it('R40: nombre con _v2, mensaje con claves de pantalla y huecos sin relacionar como {{n}}', () => {
    const view = viewOf({
      language: 'es_CO',
      category: 'MARKETING',
      content: contentOf('Hola {{cliente.nombre}}, pedido {{2}}', { footer: 'Gracias' }),
      variables: [
        { slot: 'body.1', position: 1, kind: 'system', key: 'cliente.nombre', label: null },
        { slot: 'body.2', position: 2, kind: null, key: null, label: null },
      ],
    });
    expect(draftFromView(view)).toEqual({
      name: 'pedido_listo_v2',
      language: 'es_CO',
      category: 'MARKETING',
      body: 'Hola {{nombre_del_cliente}}, pedido {{2}}',
      footer: 'Gracias',
      hadDroppedParts: false,
    });
  });

  it('R40: sin encabezado ni botones, y avisa de que se pierden', () => {
    const view = viewOf({
      content: contentOf('Hola {{1}}', {
        header: { text: 'Aviso', example: null },
        buttons: [{ type: 'QUICK_REPLY', text: 'Ok' }],
      }),
    });
    const draft = draftFromView(view);
    expect(draft).not.toHaveProperty('header');
    expect(draft).not.toHaveProperty('buttons');
    expect(draft.hadDroppedParts).toBe(true);
  });

  it('R40: AUTHENTICATION pasa a UTILITY', () => {
    expect(draftFromView(viewOf({ category: 'AUTHENTICATION' })).category).toBe('UTILITY');
  });

  it('R40: una no compatible se duplica sin mensaje ni pie', () => {
    const draft = draftFromView(viewOf({ content: null, variables: [] }));
    expect(draft.body).toBe('');
    expect(draft.footer).toBe('');
    expect(draft.hadDroppedParts).toBe(false);
  });
});
