import { z } from 'zod';

import { ADDONS } from './company-addons';

// Solo las claves de añadido pasan: el núcleo no tiene interruptor, así que nombrarlo es una
// entrada inválida, igual que una clave inventada.
export const companyAddonsQuerySchema = z.strictObject({ companyId: z.string().uuid() });

export const setCompanyAddonSchema = z.strictObject({
  companyId: z.string().uuid(),
  addon: z.enum(ADDONS),
  enabled: z.boolean(),
});

export const setAllCompanyAddonsSchema = z.strictObject({
  companyId: z.string().uuid(),
  enabled: z.boolean(),
});

export type CompanyAddonsQueryInput = z.output<typeof companyAddonsQuerySchema>;
export type SetCompanyAddonInput = z.output<typeof setCompanyAddonSchema>;
export type SetAllCompanyAddonsInput = z.output<typeof setAllCompanyAddonsSchema>;
