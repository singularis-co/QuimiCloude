// Adaptador `WhatsappQueueSignature` contra `@upstash/qstash`, doblado con `vi.mock`: ningún caso toca la red.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const verifyMock = vi.fn();
const receiverConstructorMock = vi.fn();

vi.mock('@upstash/qstash', () => ({
  Receiver: vi.fn(function ReceiverDouble(config: unknown) {
    receiverConstructorMock(config);
    return { verify: verifyMock };
  }),
}));

const VARS = ['QSTASH_TOKEN', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY', 'APP_BASE_URL'] as const;

function setKeys(): void {
  process.env.QSTASH_CURRENT_SIGNING_KEY = 'clave-actual';
  process.env.QSTASH_NEXT_SIGNING_KEY = 'clave-siguiente';
}

async function load() {
  return import('@/lib/modules/integraciones/adapters/driven/queue/whatsapp-queue-signature-qstash');
}

describe('integraciones — WhatsappQueueSignature con @upstash/qstash', () => {
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
    verifyMock.mockReset();
    receiverConstructorMock.mockClear();
  });

  it('R14: importar el adaptador con las variables vacías no lanza', async () => {
    await expect(load()).resolves.toBeDefined();
    expect(receiverConstructorMock).not.toHaveBeenCalled();
  });

  it('R14: firma válida sobre el cuerpo crudo ⇒ true, con las dos claves y sin token ni URL', async () => {
    setKeys();
    verifyMock.mockResolvedValueOnce(true);
    const { whatsappQueueSignatureQstash } = await load();

    await expect(whatsappQueueSignatureQstash.verify({ rawBody: '{"a":1}', signature: 'firma' })).resolves.toBe(true);

    expect(receiverConstructorMock).toHaveBeenCalledWith({
      currentSigningKey: 'clave-actual',
      nextSigningKey: 'clave-siguiente',
    });
    expect(verifyMock).toHaveBeenCalledWith({ signature: 'firma', body: '{"a":1}' });
  });

  it('R14: firma ausente ⇒ false sin construir el Receiver', async () => {
    setKeys();
    const { verifyWhatsappQueueSignature } = await load();

    await expect(verifyWhatsappQueueSignature({ rawBody: '{}', signature: null })).resolves.toBe(false);
    expect(receiverConstructorMock).not.toHaveBeenCalled();
  });

  it('R14: `verify` que lanza (firma que no corresponde) ⇒ false, sin propagar', async () => {
    setKeys();
    verifyMock.mockRejectedValueOnce(new Error('SignatureError'));
    const { verifyWhatsappQueueSignature } = await load();

    await expect(verifyWhatsappQueueSignature({ rawBody: '{}', signature: 'mala' })).resolves.toBe(false);
  });

  it('R14: `verify` que devuelve false ⇒ false', async () => {
    setKeys();
    verifyMock.mockResolvedValueOnce(false);
    const { verifyWhatsappQueueSignature } = await load();

    await expect(verifyWhatsappQueueSignature({ rawBody: '{}', signature: 'mala' })).resolves.toBe(false);
  });

  it('R14: sin claves configuradas ⇒ false, nunca lanza', async () => {
    const { verifyWhatsappQueueSignature } = await load();

    await expect(verifyWhatsappQueueSignature({ rawBody: '{}', signature: 'firma' })).resolves.toBe(false);
    expect(receiverConstructorMock).not.toHaveBeenCalled();
  });
});
