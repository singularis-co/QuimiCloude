// `platform-only` siembra roles, permisos y Maestro, y nada de la empresa inicial.
export const SEED_SCOPES = ['full', 'platform-only'] as const;
export type SeedScope = (typeof SEED_SCOPES)[number];
