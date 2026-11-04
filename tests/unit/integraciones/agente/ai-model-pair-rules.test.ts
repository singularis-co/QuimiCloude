// QT-304 R10, R11: la regla pura de un par de modelos contra el catalogo de su proveedor.
// El catalogo doble trae, por proveedor: `modelo-alto-*` (herramientas, no economico),
// `modelo-recomendado-*` (herramientas, economico) y `modelo-bajo-*` (economico sin herramientas).

import { describe, expect, it } from 'vitest'

import { AI_MODEL_ROLES, aiModelPairProblems } from '@/lib/modules/integraciones/domain/ai-model-pair'
import type { AiCatalogEntry } from '@/lib/modules/integraciones/domain/ai-provider'

import { CATALOG } from '../ai-provider/ai-provider-doubles'

const GOOGLE = CATALOG.find((entry) => entry.code === 'GOOGLE') as AiCatalogEntry

describe('aiModelPairProblems', () => {
  it('los roles son exactamente AGENT y ROUTER, como el enum de la base', () => {
    expect(AI_MODEL_ROLES).toEqual(['AGENT', 'ROUTER'])
  })

  it('R10: un par de agente con dos modelos distintos del catalogo y con herramientas no tiene problemas', () => {
    expect(aiModelPairProblems(GOOGLE, 'AGENT', 'modelo-alto-g', 'modelo-recomendado-g')).toEqual([])
  })

  it('R10: un par de enrutador con el principal economico no tiene problemas', () => {
    expect(aiModelPairProblems(GOOGLE, 'ROUTER', 'modelo-recomendado-g', 'modelo-alto-g')).toEqual([])
  })

  it('R10: el principal fuera del catalogo del proveedor (aunque este en el de otro) es un problema', () => {
    const problems = aiModelPairProblems(GOOGLE, 'AGENT', 'modelo-alto-a', 'modelo-alto-g')
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('modelo-alto-a')
  })

  it('R10: el respaldo fuera del catalogo es un problema', () => {
    const problems = aiModelPairProblems(GOOGLE, 'AGENT', 'modelo-alto-g', 'no-existe')
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('no-existe')
  })

  it('R10: principal y respaldo iguales es un problema', () => {
    expect(aiModelPairProblems(GOOGLE, 'AGENT', 'modelo-alto-g', 'modelo-alto-g')).toEqual([
      'el principal y el respaldo son el mismo modelo',
    ])
  })

  it('R10: un principal sin herramientas es un problema', () => {
    const problems = aiModelPairProblems(GOOGLE, 'AGENT', 'modelo-bajo-g', 'modelo-alto-g')
    expect(problems).toEqual(['el principal modelo-bajo-g no admite herramientas'])
  })

  it('R10: un respaldo sin herramientas es un problema, tambien en el enrutador', () => {
    for (const role of AI_MODEL_ROLES) {
      expect(aiModelPairProblems(GOOGLE, role, 'modelo-recomendado-g', 'modelo-bajo-g')).toEqual([
        'el respaldo modelo-bajo-g no admite herramientas',
      ])
    }
  })

  it('R10: el principal del enrutador que no es economico es un problema; en el agente no', () => {
    expect(aiModelPairProblems(GOOGLE, 'ROUTER', 'modelo-alto-g', 'modelo-recomendado-g')).toEqual([
      'el principal del enrutador modelo-alto-g no es económico',
    ])
    expect(aiModelPairProblems(GOOGLE, 'AGENT', 'modelo-alto-g', 'modelo-recomendado-g')).toEqual([])
  })

  it('R11: el respaldo del enrutador no se mira por economico', () => {
    // `modelo-alto-g` no es economico y es el respaldo: se acepta.
    expect(aiModelPairProblems(GOOGLE, 'ROUTER', 'modelo-recomendado-g', 'modelo-alto-g')).toEqual([])
  })

  it('R10: los problemas se acumulan, no se corta en el primero', () => {
    const problems = aiModelPairProblems(GOOGLE, 'ROUTER', 'modelo-bajo-g', 'modelo-bajo-g')
    expect(problems).toEqual([
      'el principal y el respaldo son el mismo modelo',
      'el principal modelo-bajo-g no admite herramientas',
      'el respaldo modelo-bajo-g no admite herramientas',
    ])
  })
})
