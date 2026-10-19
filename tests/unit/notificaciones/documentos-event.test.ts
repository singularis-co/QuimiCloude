// El evento `documentos.tanda_terminada` del catálogo, pasado por el motor real con una bandeja
// en memoria: lo que se guarda es lo que verá el usuario.
import { describe, expect, it, vi } from 'vitest';

import { createChannelFactory, createNotify, NOTIFICATION_CATALOG } from '@/lib/modules/notificaciones';
import type {
  NewNotification,
  StoredNotification,
} from '@/lib/modules/notificaciones/ports/notification-inbox';

const KEY = 'documentos.tanda_terminada';
const COMPANY = '7c1e0f52-8a3d-4b6e-9f21-5d0c4a8e7b13';
const AUTHOR = '0b6f3d1e-2c4a-4e8b-9d7f-1a2b3c4d5e6f';
const UPLOADED_AT = new Date('2026-10-19T09:12:00.000Z');

type Payload = {
  recipientUserId: string | null;
  strategy: 'formula' | 'catalogo';
  uploadedAt: Date;
  total: number;
  done: number;
  failed: number;
  failedNames: string[];
  [extra: string]: unknown;
};

function payload(overrides: Partial<Payload> = {}): Payload {
  return {
    recipientUserId: AUTHOR,
    strategy: 'formula',
    uploadedAt: UPLOADED_AT,
    total: 3,
    done: 3,
    failed: 0,
    failedNames: [],
    ...overrides,
  };
}

function engine() {
  const rows: NewNotification[] = [];
  const insertIfAbsent = vi.fn(async (n: NewNotification): Promise<StoredNotification> => {
    rows.push(n);
    return { ...n, id: `id-${rows.length}`, createdAt: new Date() };
  });
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const notify = createNotify({
    catalog: NOTIFICATION_CATALOG,
    inbox: { insertIfAbsent },
    addon: { isOn: async () => true },
    recipients: { belongsToCompany: async () => true },
    channels: createChannelFactory({ in_app: { key: 'in_app', deliver: async () => undefined } }),
    log,
  });
  async function emit(p: Payload): Promise<NewNotification | undefined> {
    await notify({ key: KEY, companyId: COMPANY, dedupeKey: `${KEY}:tanda-1`, payload: p });
    return rows.at(-1);
  }
  return { emit, rows, insertIfAbsent, log };
}

type Row = {
  readonly name: string;
  readonly payload: Partial<Payload>;
  readonly tone: 'success' | 'warning' | 'danger';
  readonly title: string;
  readonly body: string;
  readonly withTime: boolean;
};

const ROWS: readonly Row[] = [
  {
    name: 'todos leídos, varios',
    payload: { total: 3, done: 3, failed: 0 },
    tone: 'success',
    title: 'Tanda de PDFs procesada',
    body: 'Se leyeron los 3 archivos de la tanda que subiste a las {hora}.',
    withTime: true,
  },
  {
    name: 'todos leídos, uno',
    payload: { total: 1, done: 1, failed: 0 },
    tone: 'success',
    title: 'Tanda de PDFs procesada',
    body: 'Se leyó el archivo de la tanda que subiste a las {hora}.',
    withTime: true,
  },
  {
    name: 'parcial, un fallido con nombre',
    payload: { total: 3, done: 2, failed: 1, failedNames: ['a.pdf'] },
    tone: 'warning',
    title: 'Tanda procesada con errores',
    body: 'Se leyeron 2 de 3 archivos. No se pudo leer "a.pdf".',
    withTime: false,
  },
  {
    name: 'parcial, un fallido sin nombre',
    payload: { total: 3, done: 2, failed: 1, failedNames: [] },
    tone: 'warning',
    title: 'Tanda procesada con errores',
    body: 'Se leyeron 2 de 3 archivos. Uno no se pudo leer.',
    withTime: false,
  },
  {
    name: 'parcial, varios fallidos con nombre',
    payload: { total: 6, done: 1, failed: 5, failedNames: ['a.pdf', 'b.pdf', 'c.pdf'] },
    tone: 'warning',
    title: 'Tanda procesada con errores',
    body: 'Se leyeron 1 de 6 archivos. No se pudieron leer "a.pdf", "b.pdf", "c.pdf" y 2 más.',
    withTime: false,
  },
  {
    name: 'parcial, varios fallidos sin nombre',
    payload: { total: 4, done: 2, failed: 2, failedNames: [] },
    tone: 'warning',
    title: 'Tanda procesada con errores',
    body: 'Se leyeron 2 de 4 archivos. 2 no se pudieron leer.',
    withTime: false,
  },
  {
    name: 'ninguno leído, uno con nombre',
    payload: { total: 1, done: 0, failed: 1, failedNames: ['a.pdf'] },
    tone: 'danger',
    title: 'Falló la lectura de la tanda',
    body: 'No se pudo leer "a.pdf", de la tanda que subiste a las {hora}.',
    withTime: true,
  },
  {
    name: 'ninguno leído, uno sin nombre',
    payload: { total: 1, done: 0, failed: 1, failedNames: [] },
    tone: 'danger',
    title: 'Falló la lectura de la tanda',
    body: 'No se pudo leer el archivo de la tanda que subiste a las {hora}.',
    withTime: true,
  },
  {
    name: 'ninguno leído, varios con nombre',
    payload: { total: 2, done: 0, failed: 2, failedNames: ['a.pdf', 'b.pdf'] },
    tone: 'danger',
    title: 'Falló la lectura de la tanda',
    body: 'No se pudo leer ningún archivo de la tanda que subiste a las {hora}: "a.pdf" y "b.pdf".',
    withTime: true,
  },
  {
    name: 'ninguno leído, varios sin nombre',
    payload: { total: 2, done: 0, failed: 2, failedNames: [] },
    tone: 'danger',
    title: 'Falló la lectura de la tanda',
    body: 'No se pudo leer ningún archivo de la tanda que subiste a las {hora}.',
    withTime: true,
  },
];

describe('documentos.tanda_terminada — textos (R47, R51)', () => {
  it.each(ROWS)('R47: $name', async (row) => {
    const { emit } = engine();

    const stored = await emit(payload(row.payload));

    expect(stored).toMatchObject({
      eventKey: KEY,
      companyId: COMPANY,
      tone: row.tone,
      title: row.title,
      body: row.body,
      recipient: { kind: 'user', userId: AUTHOR },
      dedupeKey: `${KEY}:tanda-1`,
    });
    // La base exige que `{hora}` y su instante vayan juntos.
    expect(stored?.bodyTime).toEqual(row.withTime ? UPLOADED_AT : null);
    expect(stored?.body.includes('{hora}')).toBe(row.withTime);
  });

  it('R51: sin ningún fallido con nombre se usa el texto genérico, aunque haya fallidos', async () => {
    const { emit } = engine();

    const stored = await emit(payload({ total: 5, done: 0, failed: 5, failedNames: [] }));

    expect(stored?.body).toBe('No se pudo leer ningún archivo de la tanda que subiste a las {hora}.');
  });

  it('R51: un nombre largo llega recortado al texto del aviso', async () => {
    const { emit } = engine();
    const largo = `${'z'.repeat(70)}.pdf`;

    const stored = await emit(payload({ total: 1, done: 0, failed: 1, failedNames: [largo] }));

    expect(stored?.body).toBe(`No se pudo leer "${'z'.repeat(59)}…", de la tanda que subiste a las {hora}.`);
  });
});

describe('documentos.tanda_terminada — destino (R49)', () => {
  it('R49: una tanda de fórmula lleva a fórmulas con «Ver fórmulas»', async () => {
    const { emit } = engine();

    const stored = await emit(payload({ strategy: 'formula' }));

    expect(stored?.target).toEqual({ kind: 'formulas' });
    expect(stored?.linkLabel).toBe('Ver fórmulas');
  });

  it('R49: una tanda de catálogo lleva a la lista de proveedores con «Ver proveedores»', async () => {
    const { emit } = engine();

    const stored = await emit(payload({ strategy: 'catalogo' }));

    expect(stored?.target).toEqual({ kind: 'suppliers' });
    expect(stored?.linkLabel).toBe('Ver proveedores');
  });

  it('R49: el payload no admite el proveedor: con supplierId se rechaza y no se guarda', async () => {
    const { emit, rows, log } = engine();

    await emit(payload({ strategy: 'catalogo', supplierId: '5d0c4a8e-7b13-4c1e-8f52-8a3d4b6e9f21' }));

    expect(rows).toHaveLength(0);
    expect(log.warn).toHaveBeenCalledWith('notification_rejected', {
      eventKey: KEY,
      companyId: COMPANY,
      reason: 'invalid_payload',
    });
  });
});

describe('documentos.tanda_terminada — forma del payload', () => {
  it('R48: sin autor no se crea el aviso y queda el rechazo en el log', async () => {
    const { emit, rows, log } = engine();

    await emit(payload({ recipientUserId: null }));

    expect(rows).toHaveLength(0);
    expect(log.warn).toHaveBeenCalledWith('notification_rejected', expect.objectContaining({ reason: 'invalid_payload' }));
  });

  it('R4: conteos que no cuadran (done + failed ≠ total) se rechazan', async () => {
    const { emit, rows } = engine();

    await emit(payload({ total: 3, done: 1, failed: 1 }));
    await emit(payload({ total: 1, done: 0, failed: 1, failedNames: ['a.pdf', 'b.pdf'] }));

    expect(rows).toHaveLength(0);
  });

  it('el evento va al usuario que subió la tanda y solo por el canal de la aplicación', () => {
    const entry = NOTIFICATION_CATALOG[KEY];
    expect(entry.audience.kind).toBe('user');
    expect(entry.channels).toEqual(['in_app']);
  });
});
