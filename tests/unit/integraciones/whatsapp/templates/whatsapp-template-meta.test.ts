import { describe, expect, it } from 'vitest'

import { interpretMetaTemplate } from '@/lib/modules/integraciones/domain/whatsapp-template-meta'

const COMPONENTS = [{ type: 'BODY', text: 'Hola' }]

function meta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '1234567890',
    name: 'pedido_listo',
    language: 'es',
    status: 'APPROVED',
    category: 'UTILITY',
    components: COMPONENTS,
    ...overrides,
  }
}

describe('interpretMetaTemplate', () => {
  it('R23: una plantilla de Meta valida da su foto con los componentes tal cual', () => {
    expect(interpretMetaTemplate(meta({ quality_score: { score: 'GREEN' } }))).toEqual({
      ok: true,
      template: {
        metaTemplateId: '1234567890',
        name: 'pedido_listo',
        language: 'es',
        category: 'UTILITY',
        status: 'APPROVED',
        statusRaw: null,
        rejectedReason: null,
        components: COMPONENTS,
      },
    })
  })

  it('R23: sin components se guarda un arreglo vacio', () => {
    const result = interpretMetaTemplate(meta({ components: undefined }))
    expect(result.ok && result.template.components).toEqual([])
  })

  it('R4: IN_APPEAL da OTHER con su valor crudo; un estado conocido va sin valor crudo', () => {
    const appeal = interpretMetaTemplate(meta({ status: 'IN_APPEAL' }))
    expect(appeal.ok && { status: appeal.template.status, statusRaw: appeal.template.statusRaw }).toEqual({
      status: 'OTHER',
      statusRaw: 'IN_APPEAL',
    })
    for (const status of ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED']) {
      const known = interpretMetaTemplate(meta({ status }))
      expect(known.ok && { status: known.template.status, statusRaw: known.template.statusRaw }).toEqual({
        status,
        statusRaw: null,
      })
    }
  })

  it('R23: el motivo de rechazo solo se guarda con REJECTED, y NONE o vacio es null', () => {
    const reasonOf = (status: string, reason: unknown) => {
      const result = interpretMetaTemplate(meta({ status, rejected_reason: reason }))
      return result.ok ? result.template.rejectedReason : 'no-ok'
    }
    expect(reasonOf('REJECTED', 'INVALID_FORMAT')).toBe('INVALID_FORMAT')
    expect(reasonOf('REJECTED', 'NONE')).toBeNull()
    expect(reasonOf('REJECTED', '')).toBeNull()
    expect(reasonOf('REJECTED', null)).toBeNull()
    expect(reasonOf('APPROVED', 'INVALID_FORMAT')).toBeNull()
  })

  it('R26: sin id, nombre o idioma no se interpreta; con id lo devuelve', () => {
    expect(interpretMetaTemplate(meta({ id: undefined }))).toEqual({ ok: false, metaTemplateId: null })
    expect(interpretMetaTemplate(meta({ id: 'abc' }))).toEqual({ ok: false, metaTemplateId: null })
    expect(interpretMetaTemplate(meta({ name: '' }))).toEqual({ ok: false, metaTemplateId: '1234567890' })
    expect(interpretMetaTemplate(meta({ language: undefined }))).toEqual({ ok: false, metaTemplateId: '1234567890' })
    expect(interpretMetaTemplate(null)).toEqual({ ok: false, metaTemplateId: null })
  })

  it('R26: una categoria fuera de las tres no se interpreta y devuelve su id; AUTHENTICATION si', () => {
    expect(interpretMetaTemplate(meta({ category: 'TRANSACTIONAL' }))).toEqual({
      ok: false,
      metaTemplateId: '1234567890',
    })
    expect(interpretMetaTemplate(meta({ category: 'AUTHENTICATION' })).ok).toBe(true)
  })

  it('R26: un texto o un componente con U+0000 no se interpreta', () => {
    expect(interpretMetaTemplate(meta({ name: 'a\u0000b' }))).toEqual({ ok: false, metaTemplateId: '1234567890' })
    expect(interpretMetaTemplate(meta({ components: [{ type: 'BODY', text: 'x\u0000' }] })).ok).toBe(false)
  })
})
