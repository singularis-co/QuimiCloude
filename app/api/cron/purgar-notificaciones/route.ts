// Next lee `runtime` analizando este archivo: tiene que declararse aquí, con un literal, y no reexportarse.
export { GET } from '@/lib/modules/notificaciones/adapters/driving/purge-route';

/** `timingSafeEqual` de `node:crypto`, que compara el secreto, no existe en el runtime edge. */
export const runtime = 'nodejs';
