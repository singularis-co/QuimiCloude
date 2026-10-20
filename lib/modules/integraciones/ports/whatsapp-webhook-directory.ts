/**
 * La URL del webhook solo trae el id de la conexión: hasta saber su empresa no hay ámbito con qué
 * leerla. Devuelve la empresa y nada más; la fila se lee después, ya con ámbito.
 */
export interface WhatsappWebhookDirectory {
  companyOfConnection(connectionId: string): Promise<string | null>;
}
