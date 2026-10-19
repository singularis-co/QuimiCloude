import { z } from 'zod';

import { companyAdministratorSchema } from './company-input';

// `extend` conserva el `strictObject`: en la edicion `companyId` es una clave no prevista, y por
// eso la empresa de un Administrador no se puede cambiar.
export const createAdministratorSchema = companyAdministratorSchema.extend({
  companyId: z.string().uuid(),
});

export const updateAdministratorSchema = companyAdministratorSchema.extend({
  id: z.string().uuid(),
});

export const administratorIdSchema = z.strictObject({ id: z.string().uuid() });

export type CreateAdministratorInput = z.output<typeof createAdministratorSchema>;
export type UpdateAdministratorInput = z.output<typeof updateAdministratorSchema>;
export type AdministratorIdInput = z.output<typeof administratorIdSchema>;
