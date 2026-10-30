// Claves propias: lib/shared no importa dominio. Un test de tipos las iguala a `Addon` de identity.
export type AddonNameKey =
  | 'dashboard'
  | 'proveedores'
  | 'lectura_pdf'
  | 'importacion_excel'
  | 'integraciones'
  | 'agente_ia_whatsapp';

export const ADDON_NAMES: Readonly<Record<AddonNameKey, string>> = {
  dashboard: 'Dashboard y recorrido',
  proveedores: 'Proveedores',
  lectura_pdf: 'Lectura de PDF con IA',
  importacion_excel: 'Importación desde Excel',
  integraciones: 'Integraciones',
  agente_ia_whatsapp: 'Agente de IA para WhatsApp',
};
