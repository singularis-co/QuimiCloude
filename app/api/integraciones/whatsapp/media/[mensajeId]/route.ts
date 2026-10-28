/**
 * El Route Handler del archivo de una imagen o un sticker de WhatsApp. La lógica vive en el
 * adaptador driving; aquí solo se enchufa y se declara la configuración de segmento.
 *
 * `runtime` se declara aquí y con un literal: Next lo extrae analizando el archivo estáticamente y
 * no admite reexportarlo.
 */
export { GET } from '@/lib/modules/integraciones/adapters/driving/whatsapp-media-route';

/** El descifrado del token usa `node:crypto`, que el runtime edge no carga. */
export const runtime = 'nodejs';
