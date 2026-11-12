// Adaptador `WhatsappQueueSignature` contra `@upstash/qstash`, doblado con `vi.mock`: ningún caso toca la red.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const verifyMock = vi.fn();
const receiverConstructorMock = vi.fn();
const logError = vi.fn();

vi.mock('@/lib/shared/observability/logger', () => ({
  forModule: () => ({ info: vi.fn(), warn: vi.fn(), error: logError }),
}));

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
    logError.mockClear();
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

  describe('R42: claves de firma que faltan con la firma presente', () => {
    const SENTINEL = 'valor-centinela-que-no-debe-salir';

    it.each([
      { caso: 'las dos ausentes', current: undefined, next: undefined, missing: 'QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY' },
      { caso: 'las dos vacías', current: '  ', next: '', missing: 'QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY' },
      { caso: 'falta la actual', current: undefined, next: SENTINEL, missing: 'QSTASH_CURRENT_SIGNING_KEY' },
      { caso: 'la siguiente vacía', current: SENTINEL, next: ' ', missing: 'QSTASH_NEXT_SIGNING_KEY' },
    ])('R42: $caso ⇒ false y una sola línea error con el flujo y los nombres', async ({ current, next, missing }) => {
      if (current !== undefined) process.env.QSTASH_CURRENT_SIGNING_KEY = current;
      if (next !== undefined) process.env.QSTASH_NEXT_SIGNING_KEY = next;
      const { verifyWhatsappQueueSignature, WHATSAPP_SYSTEM_SEND_FLOW } = await load();

      await expect(verifyWhatsappQueueSignature({ rawBody: '{}', signature: 'firma' })).resolves.toBe(false);

      expect(WHATSAPP_SYSTEM_SEND_FLOW).toBe('whatsapp_system_send');
      expect(logError).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledWith('whatsapp_send_signing_keys_missing', {
        flow: WHATSAPP_SYSTEM_SEND_FLOW,
        missing,
      });
      expect(receiverConstructorMock).not.toHaveBeenCalled();
    });

    it('R42: la línea no lleva el valor de la clave presente', async () => {
      process.env.QSTASH_CURRENT_SIGNING_KEY = SENTINEL;
      const { verifyWhatsappQueueSignature } = await load();

      await verifyWhatsappQueueSignature({ rawBody: '{}', signature: 'firma' });

      expect(logError).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(logError.mock.calls)).not.toContain(SENTINEL);
    });

    it('R42: sin firma y sin claves ⇒ false y ninguna línea', async () => {
      const { verifyWhatsappQueueSignature } = await load();

      await expect(verifyWhatsappQueueSignature({ rawBody: '{}', signature: null })).resolves.toBe(false);
      expect(logError).not.toHaveBeenCalled();
    });

    it('R42: firma inválida con las claves puestas ⇒ false y ninguna línea', async () => {
      setKeys();
      verifyMock.mockRejectedValueOnce(new Error('SignatureError'));
      const { verifyWhatsappQueueSignature } = await load();

      await expect(verifyWhatsappQueueSignature({ rawBody: '{}', signature: 'mala' })).resolves.toBe(false);
      expect(logError).not.toHaveBeenCalled();
    });

    it('R42: firma que no corresponde (verify ⇒ false) con las claves puestas ⇒ ninguna línea', async () => {
      setKeys();
      verifyMock.mockResolvedValueOnce(false);
      const { verifyWhatsappQueueSignature } = await load();

      await expect(verifyWhatsappQueueSignature({ rawBody: '{}', signature: 'mala' })).resolves.toBe(false);
      expect(logError).not.toHaveBeenCalled();
    });
  });
});
