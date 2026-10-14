// El alcance del seed sale de `VERCEL_ENV`, con el mismo recorte que `scripts/build.mjs`.
import { describe, expect, it } from 'vitest';

import { readSeedScopeFromEnv } from '@/lib/modules/identity/adapters/driven/config/seed-scope-env';

describe('readSeedScopeFromEnv', () => {
  it('R40: VERCEL_ENV=production → platform-only', () => {
    expect(readSeedScopeFromEnv({ VERCEL_ENV: 'production' })).toBe('platform-only');
  });

  it('R40: VERCEL_ENV=" production " se recorta → platform-only', () => {
    expect(readSeedScopeFromEnv({ VERCEL_ENV: ' production ' })).toBe('platform-only');
  });

  it('R40: no depende de VERCEL: production sin VERCEL tambien es platform-only', () => {
    expect(readSeedScopeFromEnv({ VERCEL_ENV: 'production', VERCEL: undefined })).toBe('platform-only');
  });

  it('R41: VERCEL_ENV=preview → full', () => {
    expect(readSeedScopeFromEnv({ VERCEL_ENV: 'preview', VERCEL: '1' })).toBe('full');
  });

  it('R41: VERCEL_ENV=development → full', () => {
    expect(readSeedScopeFromEnv({ VERCEL_ENV: 'development' })).toBe('full');
  });

  it('R41: VERCEL_ENV vacio o solo espacios → full', () => {
    expect(readSeedScopeFromEnv({ VERCEL_ENV: '' })).toBe('full');
    expect(readSeedScopeFromEnv({ VERCEL_ENV: '   ' })).toBe('full');
  });

  it('R41: VERCEL_ENV ausente → full', () => {
    expect(readSeedScopeFromEnv({})).toBe('full');
  });

  it('R41: otra grafia no cuenta como produccion → full', () => {
    expect(readSeedScopeFromEnv({ VERCEL_ENV: 'Production' })).toBe('full');
  });

  it('R40: sin argumento lee process.env en la invocacion', () => {
    const antes = process.env.VERCEL_ENV;
    try {
      process.env.VERCEL_ENV = 'production';
      expect(readSeedScopeFromEnv()).toBe('platform-only');
      delete process.env.VERCEL_ENV;
      expect(readSeedScopeFromEnv()).toBe('full');
    } finally {
      if (antes === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = antes;
    }
  });
});
