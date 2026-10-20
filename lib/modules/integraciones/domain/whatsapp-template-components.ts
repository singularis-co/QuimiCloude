import { z } from 'zod';

import type { WhatsappTemplateButton, WhatsappTemplateContent } from './whatsapp-template-draft';

export type MetaTemplateButton =
  | { readonly type: 'QUICK_REPLY'; readonly text: string }
  | { readonly type: 'URL'; readonly text: string; readonly url: string; readonly example?: readonly string[] }
  | { readonly type: 'PHONE_NUMBER'; readonly text: string; readonly phone_number: string };

export type MetaTemplateComponent =
  | {
      readonly type: 'HEADER';
      readonly format: 'TEXT';
      readonly text: string;
      readonly example?: { readonly header_text: readonly string[] };
    }
  | { readonly type: 'BODY'; readonly text: string; readonly example?: { readonly body_text: readonly (readonly string[])[] } }
  | { readonly type: 'FOOTER'; readonly text: string }
  | { readonly type: 'BUTTONS'; readonly buttons: readonly MetaTemplateButton[] };

function metaButtonOf(button: WhatsappTemplateButton): MetaTemplateButton {
  if (button.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: button.text };
  if (button.type === 'PHONE_NUMBER') {
    return { type: 'PHONE_NUMBER', text: button.text, phone_number: button.phoneNumber };
  }
  return button.example === null
    ? { type: 'URL', text: button.text, url: button.url }
    : { type: 'URL', text: button.text, url: button.url, example: [button.example] };
}

export function toMetaComponents(content: WhatsappTemplateContent): MetaTemplateComponent[] {
  const components: MetaTemplateComponent[] = [];
  const { header, body, footer, buttons } = content;
  if (header !== null) {
    components.push(
      header.example === null
        ? { type: 'HEADER', format: 'TEXT', text: header.text }
        : { type: 'HEADER', format: 'TEXT', text: header.text, example: { header_text: [header.example] } },
    );
  }
  components.push(
    body.examples.length === 0
      ? { type: 'BODY', text: body.text }
      : { type: 'BODY', text: body.text, example: { body_text: [[...body.examples]] } },
  );
  if (footer !== null) components.push({ type: 'FOOTER', text: footer });
  if (buttons.length > 0) components.push({ type: 'BUTTONS', buttons: buttons.map(metaButtonOf) });
  return components;
}

const metaButtonSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('QUICK_REPLY'), text: z.string() }),
  z.object({ type: z.literal('URL'), text: z.string(), url: z.string(), example: z.array(z.string()).optional() }),
  z.object({ type: z.literal('PHONE_NUMBER'), text: z.string(), phone_number: z.string() }),
]);

const metaComponentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('HEADER'),
    format: z.literal('TEXT'),
    text: z.string(),
    example: z.object({ header_text: z.array(z.string()) }).optional(),
  }),
  z.object({
    type: z.literal('BODY'),
    text: z.string(),
    example: z.object({ body_text: z.array(z.array(z.string())) }).optional(),
  }),
  z.object({ type: z.literal('FOOTER'), text: z.string() }),
  z.object({ type: z.literal('BUTTONS'), buttons: z.array(metaButtonSchema) }),
]);

type ParsedComponent = z.infer<typeof metaComponentSchema>;
type ParsedButton = z.infer<typeof metaButtonSchema>;

function buttonOf(button: ParsedButton): WhatsappTemplateButton {
  if (button.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: button.text };
  if (button.type === 'PHONE_NUMBER') {
    return { type: 'PHONE_NUMBER', text: button.text, phoneNumber: button.phone_number };
  }
  return { type: 'URL', text: button.text, url: button.url, example: button.example?.[0] ?? null };
}

function onlyOne<T extends ParsedComponent['type']>(
  components: readonly ParsedComponent[],
  type: T,
): Extract<ParsedComponent, { type: T }> | null | undefined {
  const found = components.filter((c): c is Extract<ParsedComponent, { type: T }> => c.type === type);
  if (found.length > 1) return undefined;
  return found[0] ?? null;
}

/** `null` si algun componente no es de los que esta fase sabe editar. */
export function contentOf(components: unknown): WhatsappTemplateContent | null {
  const parsed = z.array(metaComponentSchema).safeParse(components);
  if (!parsed.success) return null;
  const header = onlyOne(parsed.data, 'HEADER');
  const body = onlyOne(parsed.data, 'BODY');
  const footer = onlyOne(parsed.data, 'FOOTER');
  const buttons = onlyOne(parsed.data, 'BUTTONS');
  if (header === undefined || footer === undefined || buttons === undefined || !body) return null;
  return {
    header: header === null ? null : { text: header.text, example: header.example?.header_text[0] ?? null },
    body: { text: body.text, examples: [...(body.example?.body_text[0] ?? [])] },
    footer: footer === null ? null : footer.text,
    buttons: buttons === null ? [] : buttons.buttons.map(buttonOf),
  };
}
