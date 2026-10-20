/**
 * El Route Handler del webhook de WhatsApp. La logica vive en el adaptador driving; aqui solo se
 * enchufa y se declara la configuracion de segmento.
 *
 * `runtime` se declara AQUI y con un literal: Next lo extrae analizando el archivo
 * estaticamente y no admite reexportarlo (el detalle esta en `caducar-pedidos/route.ts`).
 *
 * Sin `maxDuration`: el camino es una consulta, un descifrado, un HMAC y una transaccion; el
 * limite por defecto de la plataforma basta.
 */
export { GET, POST } from '@/lib/modules/integraciones/adapters/driving/whatsapp-webhook-route';

/** `createHmac`/`timingSafeEqual` de `node:crypto` exigen este runtime; el edge no los carga. */
export const runtime = 'nodejs';
