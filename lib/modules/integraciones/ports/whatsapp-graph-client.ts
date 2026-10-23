import type { GraphFailure } from '../domain/graph-failure';
import type { WhatsappTemplateCategory } from '../domain/whatsapp-template';

export type GraphPhoneNumber = {
  readonly displayPhoneNumber: string;
  readonly verifiedName: string;
};

export type GraphProbeResult =
  | { readonly ok: true; readonly phone: GraphPhoneNumber }
  | ({ readonly ok: false } & GraphFailure);

export type GraphTemplateCreated =
  | { readonly ok: true; readonly id: string; readonly status: string | null; readonly category: string | null }
  | ({ readonly ok: false } & GraphFailure);

/** Los elementos viajan sin interpretar: los interpreta el dominio. `next` es el cursor `after`. */
export type GraphTemplatePage =
  | { readonly ok: true; readonly items: readonly unknown[]; readonly next: string | null }
  | ({ readonly ok: false } & GraphFailure);

export type GraphTemplateDeleted = { readonly ok: true } | ({ readonly ok: false } & GraphFailure);

/** `components` viaja con la forma de Meta, ya armada por el dominio. */
export type GraphOutboundMessage =
  | { readonly type: 'text'; readonly body: string }
  | {
      readonly type: 'template';
      readonly name: string;
      readonly language: string;
      readonly components: readonly unknown[];
    };

export type GraphMessageSent = { readonly ok: true; readonly wamid: string } | ({ readonly ok: false } & GraphFailure);

/** Un fallo de Meta o de red es un resultado, no una excepción: el caso de uso decide qué guardar. */
export interface WhatsappGraphClient {
  fetchPhoneNumber(input: {
    readonly phoneNumberId: string;
    readonly accessToken: string;
  }): Promise<GraphProbeResult>;
  createTemplate(input: {
    readonly wabaId: string;
    readonly accessToken: string;
    readonly name: string;
    readonly language: string;
    readonly category: WhatsappTemplateCategory;
    readonly components: readonly unknown[];
  }): Promise<GraphTemplateCreated>;
  listTemplatesPage(input: {
    readonly wabaId: string;
    readonly accessToken: string;
    readonly after: string | null;
  }): Promise<GraphTemplatePage>;
  /** Con `hsmId`, Meta borra solo ese idioma de la plantilla. */
  deleteTemplate(input: {
    readonly wabaId: string;
    readonly accessToken: string;
    readonly hsmId: string;
    readonly name: string;
  }): Promise<GraphTemplateDeleted>;
  /** `to` es el `waId` del contacto. Sin `wamid` en la respuesta no hay prueba de entrega: es un fallo. */
  sendMessage(input: {
    readonly phoneNumberId: string;
    readonly accessToken: string;
    readonly to: string;
    readonly message: GraphOutboundMessage;
  }): Promise<GraphMessageSent>;
}
