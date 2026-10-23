import { describe, expect, it } from 'vitest'

import {
  sendWhatsappMessageSchema,
  WHATSAPP_TEXT_MAX_LENGTH,
} from '@/lib/modules/integraciones/domain/whatsapp-send-input'
import { isWindowOpen, WHATSAPP_WINDOW_MS } from '@/lib/modules/integraciones/domain/whatsapp-send-window'

const NOW = new Date('2026-10-23T12:00:00.000Z')
const MINUTE = 60 * 1000
const CONTACT_ID = '00000000-0000-4000-8000-0000000000d1'

function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms)
}

function textInput(text: unknown) {
  return { kind: 'text', recipient: { contactId: CONTACT_ID }, text }
}

describe('isWindowOpen', () => {
  it('R15: la ventana mide 24 horas', () => {
    expect(WHATSAPP_WINDOW_MS).toBe(24 * 60 * MINUTE)
  })

  it('R15: con el último entrante hace 23 h 59 min la ventana está abierta', () => {
    expect(isWindowOpen(ago(WHATSAPP_WINDOW_MS - MINUTE), NOW)).toBe(true)
  })

  it('R15: con un entrante de hace un momento la ventana está abierta', () => {
    expect(isWindowOpen(ago(1000), NOW)).toBe(true)
  })

  it('R16: con el último entrante hace 24 h exactas la ventana está cerrada', () => {
    expect(isWindowOpen(ago(WHATSAPP_WINDOW_MS), NOW)).toBe(false)
  })

  it('R16: con el último entrante hace más de 24 h la ventana está cerrada', () => {
    expect(isWindowOpen(ago(WHATSAPP_WINDOW_MS + MINUTE), NOW)).toBe(false)
  })

  it('R16: sin ningún entrante la ventana está cerrada', () => {
    expect(isWindowOpen(null, NOW)).toBe(false)
  })
})

describe('sendWhatsappMessageSchema (texto libre)', () => {
  it('R17: el largo máximo del texto es 4096', () => {
    expect(WHATSAPP_TEXT_MAX_LENGTH).toBe(4096)
  })

  it('R17: acepta un texto de 4096 caracteres y lo deja tal cual, sin recortar', () => {
    const text = `  ${'a'.repeat(WHATSAPP_TEXT_MAX_LENGTH - 4)}  `
    const parsed = sendWhatsappMessageSchema.safeParse(textInput(text))
    expect(parsed.success).toBe(true)
    expect(parsed.data).toMatchObject({ kind: 'text', text })
  })

  it('R17: rechaza un texto de 4097 caracteres', () => {
    expect(sendWhatsappMessageSchema.safeParse(textInput('a'.repeat(WHATSAPP_TEXT_MAX_LENGTH + 1))).success).toBe(false)
  })

  it('R17: mide el largo en puntos de código (un emoji cuenta uno)', () => {
    const emojis = '😀'.repeat(WHATSAPP_TEXT_MAX_LENGTH)
    expect(emojis.length).toBe(WHATSAPP_TEXT_MAX_LENGTH * 2)
    expect(sendWhatsappMessageSchema.safeParse(textInput(emojis)).success).toBe(true)
    expect(sendWhatsappMessageSchema.safeParse(textInput(`${emojis}😀`)).success).toBe(false)
  })

  it('R17: rechaza el texto vacío', () => {
    expect(sendWhatsappMessageSchema.safeParse(textInput('')).success).toBe(false)
  })

  it('R17: rechaza el texto con solo espacios y saltos de línea', () => {
    expect(sendWhatsappMessageSchema.safeParse(textInput('   \n\t ')).success).toBe(false)
  })

  it('R17: rechaza un texto que no es cadena', () => {
    expect(sendWhatsappMessageSchema.safeParse(textInput(42)).success).toBe(false)
  })

  it('R17: rechaza un destinatario con contacto y cliente a la vez', () => {
    const input = {
      kind: 'text',
      recipient: { contactId: CONTACT_ID, customerId: CONTACT_ID },
      text: 'hola',
    }
    expect(sendWhatsappMessageSchema.safeParse(input).success).toBe(false)
  })

  it('R17: acepta el destinatario por cliente', () => {
    const input = { kind: 'text', recipient: { customerId: CONTACT_ID }, text: 'hola' }
    expect(sendWhatsappMessageSchema.safeParse(input).success).toBe(true)
  })
})
