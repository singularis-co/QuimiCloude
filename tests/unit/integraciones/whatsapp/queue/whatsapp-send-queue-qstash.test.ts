// Adaptador `WhatsappSendQueue` contra `@upstash/qstash`, doblado con `vi.mock`: ningún caso toca la red.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const publishJSONMock = vi.fn();
const clientConstructorMock = vi.fn();

vi.mock('@upstash/qstash', () => ({
  Client: vi.fn(function ClientDouble(config: unknown) {
    clientConstructorMock(config);
    return { publishJSON: publishJSONMock };
  }),
}));

const VARS = [
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
  'APP_BASE_URL',
  'WHATSAPP_SEND_MAX_RETRIES',
] as const;

const JOB = {
  kind: 'send_message',
  messageId: '11111111-1111-4111-8111-111111111111',
  companyId: '22222222-2222-4222-8222-222222222222',
} as const;

function setAll(maxRetries?: string): void {
  process.env.QSTASH_TOKEN = 'token-de-prueba';
  process.env.QSTASH_CURRENT_SIGNING_KEY = 'clave-actual';
  process.env.QSTASH_NEXT_SIGNING_KEY = 'clave-siguiente';
  process.env.APP_BASE_URL = 'https://app.invalido';
  if (maxRetries !== undefined) process.env.WHATSAPP_SEND_MAX_RETRIES = maxRetries;
}

describe('integraciones — WhatsappSendQueue con @upstash/qstash', () => {
  const saved: Partial<Record<(typeof VARS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const name of VARS) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of VARS) {
      const value = saved[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    publishJSONMock.mockReset();
    clientConstructorMock.mockClear();
  });

  it('R10: importar el adaptador con las variables vacías no lanza ni construye el cliente', async () => {
    await expect(
      import('@/lib/modules/integraciones/adapters/driven/queue/whatsapp-send-queue-qstash'),
    ).resolves.toBeDefined();
    expect(clientConstructorMock).not.toHaveBeenCalled();
  });

  it('R10: publica el trabajo en la URL del consumidor y devuelve el id de la cola', async () => {
    setAll();
    publishJSONMock.mockResolvedValueOnce({ messageId: 'msg-1', url: 'https://x' });
    const { whatsappSendQueueQstash } = await import(
      '@/lib/modules/integraciones/adapters/driven/queue/whatsapp-send-queue-qstash'
    );

    await expect(whatsappSendQueueQstash.publish(JOB)).resolves.toBe('msg-1');

    expect(clientConstructorMock).toHaveBeenCalledWith({ token: 'token-de-prueba' });
    expect(publishJSONMock).toHaveBeenCalledWith({
      url: 'https://app.invalido/api/integraciones/whatsapp/envios',
      body: JOB,
      retries: 3,
    });
  });

  it('R25: los reintentos que se mandan salen de WHATSAPP_SEND_MAX_RETRIES, leída al llamar', async () => {
    const { publishWhatsappSendJob } = await import(
      '@/lib/modules/integraciones/adapters/driven/queue/whatsapp-send-queue-qstash'
    );
    setAll('0');
    publishJSONMock.mockResolvedValue({ messageId: 'msg-2', url: 'https://x' });
    await publishWhatsappSendJob(JOB);
    process.env.WHATSAPP_SEND_MAX_RETRIES = '6';
    await publishWhatsappSendJob(JOB);

    expect(publishJSONMock.mock.calls.map(([request]) => (request as { retries: number }).retries)).toEqual([0, 6]);
  });

  it('R10: sin configuración la publicación falla sin llamar a la cola', async () => {
    const { publishWhatsappSendJob } = await import(
      '@/lib/modules/integraciones/adapters/driven/queue/whatsapp-send-queue-qstash'
    );
    await expect(publishWhatsappSendJob(JOB)).rejects.toThrow('QSTASH_TOKEN');
    expect(publishJSONMock).not.toHaveBeenCalled();
  });

  it('R10: un fallo de la cola se propaga para que quien encola lo registre', async () => {
    setAll();
    publishJSONMock.mockRejectedValueOnce(new Error('cola caída'));
    const { publishWhatsappSendJob } = await import(
      '@/lib/modules/integraciones/adapters/driven/queue/whatsapp-send-queue-qstash'
    );
    await expect(publishWhatsappSendJob(JOB)).rejects.toThrow('cola caída');
  });
});
