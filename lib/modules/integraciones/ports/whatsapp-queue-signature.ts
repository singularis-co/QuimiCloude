export type WhatsappQueueDelivery = {
  readonly rawBody: string;
  readonly signature: string | null;
};

export interface WhatsappQueueSignature {
  /** `true` solo si la firma corresponde a ese cuerpo. Nunca lanza: una firma mala es un caso normal. */
  verify(delivery: WhatsappQueueDelivery): Promise<boolean>;
}
