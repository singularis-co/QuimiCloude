/**
 * El consumidor de la cola de envíos de WhatsApp. La lógica vive en el adaptador driving; aquí solo
 * se enchufa y se declara la configuración de segmento, con literales: Next la lee estáticamente y
 * no acepta reexportarla ni sacarla de una expresión.
 */
export { POST } from '@/lib/modules/integraciones/adapters/driving/whatsapp-send-route';

/** El descifrado del token usa `node:crypto`, que el runtime edge no carga. */
export const runtime = 'nodejs';

/** Un reclamo, un descifrado y una llamada a Graph, con su propio tiempo máximo: cabe de sobra. */
export const maxDuration = 60;
