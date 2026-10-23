// Constructores de cuerpos del webhook `messages` de la Cloud API, con la forma de la documentación
// de Meta. Ningún número, nombre ni texto es real.

export const PHONE_NUMBER_ID = '3456789012'
export const FOREIGN_PHONE_NUMBER_ID = '9999999999'
export const WABA_ID = '2345678901'
export const SENDER = '15550000001'
export const OTHER_SENDER = '15550000002'
export const SENDER_USER_ID = 'US.0000000000000001'
export const TIMESTAMP = '1760875200'

type Json = Record<string, unknown>

let wamidCounter = 0

export function wamid(): string {
  wamidCounter += 1
  return `wamid.prueba-${String(wamidCounter).padStart(6, '0')}`
}

/** `name` en `null` ⇒ un contacto sin `profile`. */
export function contact(waId: string = SENDER, name: string | null = 'Cliente de Prueba'): Json {
  return name === null ? { wa_id: waId } : { wa_id: waId, profile: { name } }
}

/** Cabecera común de un mensaje entrante más el objeto propio de su tipo. */
export function message(type: string, content: Json = {}, overrides: Json = {}): Json {
  return { from: SENDER, id: wamid(), timestamp: TIMESTAMP, type, ...content, ...overrides }
}

export const textMessage = (body = 'hola, texto de prueba', overrides: Json = {}) =>
  message('text', { text: { body } }, overrides)

export const imageMessage = (image: Json = { id: 'media-1', mime_type: 'image/jpeg', sha256: 'abc' }) =>
  message('image', { image })

export function status(id: string, value: string, extra: Json = {}): Json {
  return { id, status: value, timestamp: TIMESTAMP, recipient_id: OTHER_SENDER, ...extra }
}

export type ValueParts = {
  phoneNumberId?: string
  contacts?: Json[]
  messages?: Json[]
  statuses?: Json[]
}

export function value(parts: ValueParts = {}): Json {
  const result: Json = {
    messaging_product: 'whatsapp',
    metadata: { display_phone_number: '15550009999', phone_number_id: parts.phoneNumberId ?? PHONE_NUMBER_ID },
  }
  if (parts.contacts !== undefined) result.contacts = parts.contacts
  if (parts.messages !== undefined) result.messages = parts.messages
  if (parts.statuses !== undefined) result.statuses = parts.statuses
  return result
}

export function change(valueBody: unknown, field = 'messages'): Json {
  return { field, value: valueBody }
}

export function notification(...changes: Json[]): Json {
  return { object: 'whatsapp_business_account', entry: [{ id: WABA_ID, changes }] }
}

/** Un `value` de mensajes con un solo contacto, el caso habitual de Meta. */
export function messagesNotification(messages: Json[], contacts: Json[] = [contact()]): Json {
  return notification(change(value({ contacts, messages })))
}
