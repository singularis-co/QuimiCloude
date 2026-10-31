// La regla pura que resuelve `{nombre}` en el saludo del agente.

import { describe, expect, it } from 'vitest'

import {
  renderGreeting,
  WHATSAPP_AGENT_DEFAULTS,
} from '@/lib/modules/integraciones/domain/whatsapp-agent-settings'

const SALUDO = WHATSAPP_AGENT_DEFAULTS.greetingMessage

describe('renderGreeting', () => {
  it('R35 — el saludo por defecto con nombre «Ana» lo pone en su sitio', () => {
    expect(renderGreeting(SALUDO, 'Ana')).toBe(
      'Hola, soy el asistente virtual Ana. Si prefieres hablar con una persona, escribe "asesor".',
    )
  })

  it('R35 — el saludo por defecto sin nombre quita `{nombre}` con el espacio que lo precede', () => {
    const esperado = 'Hola, soy el asistente virtual. Si prefieres hablar con una persona, escribe "asesor".'
    expect(renderGreeting(SALUDO, null)).toBe(esperado)
    expect(renderGreeting(SALUDO, '')).toBe(esperado)
    expect(renderGreeting(SALUDO, '   ')).toBe(esperado)
  })

  it('R35 — `{nombre}` al inicio sin nombre se va con el espacio que lo sigue', () => {
    expect(renderGreeting('{nombre} te saluda.', null)).toBe('te saluda.')
  })

  it('R35 — `{nombre}` pegado, sin espacio a ningún lado, se quita solo', () => {
    expect(renderGreeting('Hola,{nombre}.', null)).toBe('Hola,.')
  })

  it('R35 — dos `{nombre}` se resuelven los dos, con nombre y sin él', () => {
    expect(renderGreeting('Soy {nombre}, sí, {nombre}.', 'Ana')).toBe('Soy Ana, sí, Ana.')
    expect(renderGreeting('Soy {nombre}, sí, {nombre}.', null)).toBe('Soy, sí,.')
  })

  it('R35 — un saludo propio sin `{nombre}` queda igual, con nombre y sin él', () => {
    const propio = 'Buenas, ¿en qué te ayudo?  Escribe "asesor" para hablar con alguien.'
    expect(renderGreeting(propio, 'Ana')).toBe(propio)
    expect(renderGreeting(propio, null)).toBe(propio)
  })

  it('R35 — un nombre que contiene `{nombre}` no se vuelve a resolver', () => {
    expect(renderGreeting('Hola, soy {nombre}.', '{nombre}')).toBe('Hola, soy {nombre}.')
    expect(renderGreeting('{nombre} y {nombre}', 'X{nombre}')).toBe('X{nombre} y X{nombre}')
  })

  it('R35 — no recorta ni colapsa otros espacios del texto', () => {
    expect(renderGreeting('  Hola   {nombre}  ', null)).toBe('  Hola    ')
  })
})
