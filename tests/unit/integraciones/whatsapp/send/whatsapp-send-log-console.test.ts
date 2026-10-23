// El adaptador del aviso de un fallo de Meta (`design.md > 7`, R46). El escritor entra por
// parametro: se espia sin parchear la consola global.

import { describe, expect, it, vi } from 'vitest'

import { createWhatsappSendLogConsole } from '@/lib/modules/integraciones/adapters/driven/observability/whatsapp-send-log-console'

const MESSAGE_ID = '55555555-5555-4555-8555-555555555555'
const DIAGNOSTIC = 'Graph enviar mensaje: rejected; code=131026; subcode=7'

describe('createWhatsappSendLogConsole', () => {
  it('R46: escribe whatsapp_send_failed con el id del mensaje y el diagnostico, y nada mas', () => {
    const escribir = vi.fn()
    const log = createWhatsappSendLogConsole(escribir)

    log.sendFailed({ messageId: MESSAGE_ID, diagnostic: DIAGNOSTIC })

    expect(escribir).toHaveBeenCalledTimes(1)
    expect(escribir).toHaveBeenCalledWith('whatsapp_send_failed', { messageId: MESSAGE_ID, diagnostic: DIAGNOSTIC })
  })

  it('R46: si el llamador pasa claves de mas, no llegan al registro', () => {
    const escribir = vi.fn()
    const log = createWhatsappSendLogConsole(escribir)
    const leaky = { messageId: MESSAGE_ID, diagnostic: DIAGNOSTIC, waId: '573001234567', text: 'Hola' }

    log.sendFailed(leaky)

    expect(escribir.mock.calls[0]?.[1]).toEqual({ messageId: MESSAGE_ID, diagnostic: DIAGNOSTIC })
  })

  it('R46: por defecto escribe en console.warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      createWhatsappSendLogConsole().sendFailed({ messageId: MESSAGE_ID, diagnostic: DIAGNOSTIC })
      expect(warn).toHaveBeenCalledWith('whatsapp_send_failed', { messageId: MESSAGE_ID, diagnostic: DIAGNOSTIC })
    } finally {
      warn.mockRestore()
    }
  })
})
