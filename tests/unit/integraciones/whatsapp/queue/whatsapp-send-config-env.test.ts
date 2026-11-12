// Lector de la configuración de la cola de envíos. Sin red: solo `process.env`.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_WHATSAPP_SEND_MAX_RETRIES,
  readWhatsappQueueSigningKeys,
  readWhatsappSendMaxRetries,
  readWhatsappSendQueueConfig,
} from '@/lib/modules/integraciones/adapters/driven/config/whatsapp-send-config-env';
import { WHATSAPP_SEND_ROUTE } from '@/lib/shared/routes';

const VARS = [
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
  'APP_BASE_URL',
  'WHATSAPP_SEND_MAX_RETRIES',
] as const;

const SECRET_VALUES = ['token-secreto-xyz', 'clave-actual-xyz', 'clave-siguiente-xyz'];

function setAll(): void {
  process.env.QSTASH_TOKEN = 'token-secreto-xyz';
  process.env.QSTASH_CURRENT_SIGNING_KEY = 'clave-actual-xyz';
  process.env.QSTASH_NEXT_SIGNING_KEY = 'clave-siguiente-xyz';
  process.env.APP_BASE_URL = 'https://app.invalido/';
}

function errorMessageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('se esperaba que lanzara');
}

describe('integraciones — configuración de la cola de envíos de WhatsApp', () => {
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
  });

  it('R25: sin WHATSAPP_SEND_MAX_RETRIES (ausente, vacía o espacios) aplica el defecto 3', () => {
    expect(DEFAULT_WHATSAPP_SEND_MAX_RETRIES).toBe(3);
    expect(readWhatsappSendMaxRetries()).toBe(3);
    process.env.WHATSAPP_SEND_MAX_RETRIES = '';
    expect(readWhatsappSendMaxRetries()).toBe(3);
    process.env.WHATSAPP_SEND_MAX_RETRIES = '   ';
    expect(readWhatsappSendMaxRetries()).toBe(3);
  });

  it('R25: lee un entero >= 0, incluido el 0', () => {
    process.env.WHATSAPP_SEND_MAX_RETRIES = '0';
    expect(readWhatsappSendMaxRetries()).toBe(0);
    process.env.WHATSAPP_SEND_MAX_RETRIES = ' 7 ';
    expect(readWhatsappSendMaxRetries()).toBe(7);
  });

  it.each(['-1', '2.5', 'tres', '1e2', '0x3'])(
    'R25: el valor inválido %s falla nombrando la variable sin mostrar su valor',
    (raw) => {
      process.env.WHATSAPP_SEND_MAX_RETRIES = raw;
      const message = errorMessageOf(() => readWhatsappSendMaxRetries());
      expect(message).toContain('WHATSAPP_SEND_MAX_RETRIES');
      expect(message).not.toContain(raw);
    },
  );

  it('R10, R25: arma la URL del consumidor desde APP_BASE_URL y lleva los reintentos', () => {
    setAll();
    process.env.WHATSAPP_SEND_MAX_RETRIES = '5';
    expect(readWhatsappSendQueueConfig()).toEqual({
      token: 'token-secreto-xyz',
      currentSigningKey: 'clave-actual-xyz',
      nextSigningKey: 'clave-siguiente-xyz',
      targetUrl: `https://app.invalido${WHATSAPP_SEND_ROUTE}`,
      maxRetries: 5,
    });
    expect(WHATSAPP_SEND_ROUTE).toBe('/api/integraciones/whatsapp/envios');
  });

  it('R25: si faltan las de QStash, las nombra todas juntas sin ningún valor', () => {
    process.env.APP_BASE_URL = 'https://app.invalido';
    process.env.QSTASH_CURRENT_SIGNING_KEY = 'clave-actual-xyz';
    const message = errorMessageOf(() => readWhatsappSendQueueConfig());
    expect(message).toContain('QSTASH_TOKEN');
    expect(message).toContain('QSTASH_NEXT_SIGNING_KEY');
    expect(message).not.toContain('QSTASH_CURRENT_SIGNING_KEY');
    for (const value of SECRET_VALUES) expect(message).not.toContain(value);
  });

  it('R25: sin APP_BASE_URL falla nombrándola, sin valores de QStash', () => {
    setAll();
    delete process.env.APP_BASE_URL;
    const message = errorMessageOf(() => readWhatsappSendQueueConfig());
    expect(message).toContain('APP_BASE_URL');
    for (const value of SECRET_VALUES) expect(message).not.toContain(value);
  });

  it('R14: las claves de firma solo exigen las dos claves, no el token ni la URL', () => {
    process.env.QSTASH_CURRENT_SIGNING_KEY = 'clave-actual-xyz';
    process.env.QSTASH_NEXT_SIGNING_KEY = 'clave-siguiente-xyz';
    expect(readWhatsappQueueSigningKeys()).toEqual({
      currentSigningKey: 'clave-actual-xyz',
      nextSigningKey: 'clave-siguiente-xyz',
    });
  });

  it('R25: la configuración se lee en cada llamada, no al importar', () => {
    process.env.WHATSAPP_SEND_MAX_RETRIES = '1';
    expect(readWhatsappSendMaxRetries()).toBe(1);
    process.env.WHATSAPP_SEND_MAX_RETRIES = '4';
    expect(readWhatsappSendMaxRetries()).toBe(4);
  });
});
