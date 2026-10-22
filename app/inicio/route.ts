export { GET } from '@/lib/modules/identity/adapters/driving/home-route';

/** La lectura de sesión consulta la base con Prisma, que el runtime edge no carga. */
export const runtime = 'nodejs';
