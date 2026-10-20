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

  // Forma MEDIDA contra Postgres local (console.log temporal en `insertCreatedWhatsappTemplate`,
  // caso R2 de whatsapp-template-prisma.int.test.ts): el `$queryRaw` con ON CONFLICT lanza
  // PrismaClientKnownRequestError code 'P2010', meta { code: '23505', message: 'Key (connection_id,
  // name, language)=(<uuid>, duplicada, es) already exists.' }; el nombre del indice no aparece.
  function p2010(detail: string): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError(
      `\nInvalid \`prisma.$queryRaw()\` invocation:\n\n\nRaw query failed. Code: \`23505\`. Message: \`${detail}\``,
      { code: 'P2010', clientVersion: 'test', meta: { code: '23505', message: detail } },
    )
  }

  it('R2 — P2010 23505 con las columnas (connection_id, name, language) en el DETAIL (forma medida) es nombre tomado', () => {
    const detail = 'Key (connection_id, name, language)=(35233d07-2df9-4818-9c61-70a9873b286e, duplicada, es) already exists.'
    expect(isNameLanguageTaken(p2010(detail))).toBe(true)
  })

  it('R2 — P2010 23505 con el DETAIL en espanol tambien es nombre tomado (solo se leen las columnas)', () => {
    const detail = 'Ya existe la llave (connection_id, name, language)=(35233d07-2df9-4818-9c61-70a9873b286e, duplicada, es).'
    expect(isNameLanguageTaken(p2010(detail))).toBe(true)
  })

  it('R2 — P2010 23505 del unico (connection_id, meta_template_id) no es nombre tomado', () => {
    const detail = 'Key (connection_id, meta_template_id)=(35233d07-2df9-4818-9c61-70a9873b286e, 123) already exists.'
    expect(isNameLanguageTaken(p2010(detail))).toBe(false)
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
