import type { SeedScope } from '../../../domain/seed-scope';

// Mismo recorte que `scripts/build.mjs`. No mira `VERCEL`: un `VERCEL_ENV=production` puesto a mano
// tambien siembra solo la plataforma, que es el lado seguro.
export function readSeedScopeFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): SeedScope {
  return (env.VERCEL_ENV ?? '').trim() === 'production' ? 'platform-only' : 'full';
}
