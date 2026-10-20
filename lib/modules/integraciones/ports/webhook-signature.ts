/** Comprueba la cabecera `X-Hub-Signature-256` sobre los bytes exactos recibidos, no sobre un texto. */
export interface WebhookSignature {
  matches(rawBody: Uint8Array, header: string | null, appSecret: string): boolean;
}
