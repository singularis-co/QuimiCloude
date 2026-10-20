/**
 * La sincronización diaria de plantillas de WhatsApp. La lógica vive en el adaptador driving; aquí
 * solo se enchufa y se declara la configuración de segmento, con literales: Next la lee
 * estáticamente y no acepta reexportarla ni sacarla de una expresión (mismo motivo que
 * `app/api/cron/caducar-pedidos/route.ts`).
 */
export { GET } from '@/lib/modules/integraciones/adapters/driving/whatsapp-template-cron-route';

/** `timingSafeEqual` de `node:crypto` exige este runtime. */
export const runtime = 'nodejs';

/** El presupuesto interno del caso de uso es de 240 s; esto deja margen bajo el techo de 300 s. */
export const maxDuration = 300;
