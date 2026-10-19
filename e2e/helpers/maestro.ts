// QC-166 — lo que comparten los E2E del área del Maestro (design.md > 10).
//
// - Las credenciales del Maestro sembrado (`SEED_MAESTRO_*`): en CI las pone `gate.yml` en el
//   entorno; en local llegan del `.env`, que Prisma carga al importar su cliente. Se leen al
//   llamar y no al importar, y sin ellas se falla nombrando la variable: un Maestro sin sembrar
//   tiene que romper el caso, no convertirlo en un login rechazado que no dice por qué.
// - La limpieza de las empresas de fixture. Una empresa dada de alta POR LA PANTALLA arrastra filas
//   que la base no borra en cascada (su evento de alta, el enlace de su Administrador inicial), así
//   que se borran en el orden de sus claves foráneas.
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import type { Credentials } from './landing';

const MAESTRO_ENV = {
  username: 'SEED_MAESTRO_USERNAME',
  password: 'SEED_MAESTRO_PASSWORD',
} as const;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `falta ${name}: el E2E del Maestro entra con el Maestro sembrado (\`pnpm run db:seed\` con las SEED_MAESTRO_* del entorno).`,
    );
  }
  return value;
}

/** Usuario y contraseña del Maestro sembrado. */
export function maestroCredentials(): Credentials {
  return {
    username: requiredEnv(MAESTRO_ENV.username),
    password: requiredEnv(MAESTRO_ENV.password),
  };
}

/**
 * Borra las empresas cuyo nombre empieza por `prefix` (y, con `createdBefore`, solo las anteriores
 * a ese instante) con todo lo que cuelga de ellas: eventos, enlaces y sesiones revocadas de sus
 * usuarios, los usuarios y la empresa. Las excepciones de añadidos se van en cascada.
 */
export async function deleteFixtureCompanies(prefix: string, createdBefore?: Date): Promise<void> {
  const where: Prisma.CompanyWhereInput = {
    name: { startsWith: prefix },
    ...(createdBefore === undefined ? {} : { createdAt: { lt: createdBefore } }),
  };
  const companies = await prisma.company.findMany({ where, select: { id: true } });
  if (companies.length === 0) return;
  const companyIds = companies.map((company) => company.id);
  const users = await prisma.user.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);

  await prisma.$transaction([
    prisma.companyEvent.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.credentialSetupToken.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.revokedSession.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    prisma.company.deleteMany({ where: { id: { in: companyIds } } }),
  ]);
}
