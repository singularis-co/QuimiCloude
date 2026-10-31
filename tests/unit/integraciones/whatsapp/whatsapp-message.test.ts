import { WhatsappMessageOrigin as PrismaWhatsappMessageOrigin } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
  WHATSAPP_MESSAGE_ORIGINS,
  type WhatsappMessageOrigin,
} from '@/lib/modules/integraciones/domain/whatsapp-message'

describe('origenes de un mensaje de WhatsApp en el dominio', () => {
  it('R33: el dominio admite AGENT ademas de USER y SYSTEM', () => {
    expect(WHATSAPP_MESSAGE_ORIGINS).toEqual(['USER', 'SYSTEM', 'AGENT'])
    const agent: WhatsappMessageOrigin = 'AGENT'
    expect(WHATSAPP_MESSAGE_ORIGINS).toContain(agent)
  })

  it('R33: el dominio y el enum del esquema tienen los mismos origenes', () => {
    expect([...WHATSAPP_MESSAGE_ORIGINS].sort()).toEqual(Object.values(PrismaWhatsappMessageOrigin).sort())
  })
})
