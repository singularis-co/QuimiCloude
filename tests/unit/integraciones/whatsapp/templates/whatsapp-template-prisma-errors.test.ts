// Rojo de CI del PR #281: sin base. Solo prueba la traduccion de error de
// `whatsapp-template-prisma.ts` con errores de Prisma construidos a mano con la forma que da
// `@prisma/client@6.19.3` para un indice unico parcial creado en SQL crudo. Que el indice dispare
// de verdad lo prueba `tests/integration/integraciones/whatsapp-template-prisma.int.test.ts`.
import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { isNameLanguageTaken } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-template-prisma'

function p2002(target: unknown): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`connection_id`,`name`,`language`)',
    { code: 'P2002', clientVersion: 'test', meta: { modelName: 'WhatsappTemplate', target } },
  )
}

describe('R2: el unico parcial de nombre e idioma entre vivas se traduce a WhatsappTemplateNameTakenError', () => {
  it('R2 — P2002 con las columnas del indice parcial en meta.target (forma real) es nombre tomado', () => {
    expect(isNameLanguageTaken(p2002(['connection_id', 'name', 'language']))).toBe(true)
  })

  it('R2 — P2002 con el nombre del indice en meta.target es nombre tomado', () => {
    expect(isNameLanguageTaken(p2002('whatsapp_templates_name_language_live_key'))).toBe(true)
  })

  it('R2 — P2002 del unico (connection_id, meta_template_id) no es nombre tomado', () => {
    expect(isNameLanguageTaken(p2002(['connection_id', 'meta_template_id']))).toBe(false)
  })

  it('R2 — P2002 sin meta.target no se clasifica: se relanza', () => {
    expect(isNameLanguageTaken(p2002(undefined))).toBe(false)
  })

  it('R2 — P2010 con SQLSTATE 23505 que nombra el indice en el texto es nombre tomado', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Raw query failed. Code: `23505`. Message: `whatsapp_templates_name_language_live_key`',
      { code: 'P2010', clientVersion: 'test', meta: { code: '23505', message: 'whatsapp_templates_name_language_live_key' } },
    )
    expect(isNameLanguageTaken(error)).toBe(true)
  })

  it('R2 — otro codigo de Prisma o un error que no es de Prisma no es nombre tomado', () => {
    const fk = new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'test' })
    expect(isNameLanguageTaken(fk)).toBe(false)
    expect(isNameLanguageTaken(new Error('whatsapp_templates_name_language_live_key'))).toBe(false)
  })
})
