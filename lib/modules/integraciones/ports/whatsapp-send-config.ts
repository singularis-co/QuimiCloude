export interface WhatsappSendConfig {
  /** Reintentos que la cola aplica a un trabajo; el tope de intentos sale de aquí. */
  maxRetries(): number;
}
