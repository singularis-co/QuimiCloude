// La migracion `db/migrations/*_whatsapp_agent/` contra Postgres REAL.
//
// Aislamiento: cada `it` corre dentro de `prisma.$transaction` interactiva y termina lanzando
// `RollbackSignal`, asi que ninguna fila ni ningun DDL sobrevive. Lo que se espera que falle, o
// solo se quiere probar que la base admite, va en un SAVEPOINT que siempre se deshace. El SQL de
// la migracion se lee del archivo.
import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test')
    this.name = 'RollbackSignal'
  }
}

async function inRolledBackTransaction(
  body: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx)
        throw new RollbackSignal()
      },
      { maxWait: 10_000, timeout: 60_000 },
    )
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error
  }
}

function findRepoRoot(startDir: string): string {
  let dir = startDir
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no se encontro package.json subiendo desde ${startDir}`)
    dir = parent
  }
}

const migrationsDir = join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'db', 'migrations')
const carpetas = readdirSync(migrationsDir).filter((name) => /^\d{14}_whatsapp_agent$/.test(name))
const migrationDir = join(migrationsDir, carpetas[0] ?? '__falta__')

function statementsOf(sql: string): readonly string[] {
  return sql
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

const UP_STATEMENTS = statementsOf(readFileSync(join(migrationDir, 'migration.sql'), 'utf8'))
const DOWN_STATEMENTS = statementsOf(readFileSync(join(migrationDir, 'down.sql'), 'utf8'))

const SETTINGS = 'whatsapp_agent_settings'
const MODE_COLUMNS = [
  'conversation_mode',
  'conversation_mode_changed_at',
  'conversation_mode_changed_by',
  'conversation_mode_reason',
] as const
const MODE_CONSTRAINTS = [
  'whatsapp_contacts_conversation_mode_changed_by_fkey',
  'whatsapp_contacts_human_mode_has_reason',
  'whatsapp_contacts_mode_change_consistent',
] as const
const MODE_INDEX = 'whatsapp_contacts_conversation_mode_changed_by_idx'

const HUMAN_REASONS = [
  'MANUAL',
  'CUSTOMER_REQUEST',
  'MISSING_DATA',
  'LOW_CONFIDENCE',
  'AI_ERROR',
  'USAGE_LIMIT',
  'USER_REPLY',
  'COMPLAINT',
  'NEGATIVE_SENTIMENT',
  'UNSUPPORTED_MEDIA',
] as const

async function applyStatements(tx: Prisma.TransactionClient, statements: readonly string[]): Promise<void> {
  for (const statement of statements) {
    await tx.$executeRawUnsafe(statement)
  }
}

/**
 * Corre `statement` en un SAVEPOINT que siempre se deshace y devuelve el error de Postgres, o null
 * si no fallo. Asi un caso admitido no deja la fila puesta para el siguiente.
 */
async function outcomeOf(tx: Prisma.TransactionClient, statement: string, ...values: unknown[]) {
  await tx.$executeRawUnsafe('SAVEPOINT intento')
  try {
    await tx.$executeRawUnsafe(statement, ...values)
    return null
  } catch (error) {
    return String(error instanceof Error ? error.message : error)
  } finally {
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT intento')
  }
}

async function tableSnapshot(tx: Prisma.TransactionClient, table: string) {
  const columns = await tx.$queryRaw<
    {
      column_name: string
      data_type: string
      udt_name: string
      numeric_precision: number | null
      numeric_scale: number | null
      is_nullable: string
      column_default: string | null
    }[]
  >`
    SELECT column_name, data_type, udt_name, numeric_precision, numeric_scale, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY column_name`
  const indexes = await tx.$queryRaw<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ${table}
    ORDER BY indexname`
  const constraints = await tx.$queryRaw<{ conname: string; def: string }[]>`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = ${table} AND t.relnamespace = 'public'::regnamespace
    ORDER BY c.conname`
  const rls = await tx.$queryRaw<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
    SELECT relrowsecurity, relforcerowsecurity FROM pg_class
    WHERE relname = ${table} AND relnamespace = 'public'::regnamespace`
  const policies = await tx.$queryRaw<{ policyname: string }[]>`
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = ${table}
    ORDER BY policyname`
  return { columns, indexes, constraints, rls, policies }
}

async function schemaSnapshot(tx: Prisma.TransactionClient) {
  const enums = await tx.$queryRaw<{ typname: string; labels: string[] }[]>`
    SELECT t.typname, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname IN (
      'whatsapp_message_origin', 'whatsapp_conversation_mode', 'whatsapp_conversation_mode_reason',
      'whatsapp_message_origin_old')
    GROUP BY t.typname
    ORDER BY t.typname`
  const tables = await tx.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  return {
    enums,
    tables: tables.map((row) => row.tablename),
    contacts: await tableSnapshot(tx, 'whatsapp_contacts'),
    messages: await tableSnapshot(tx, 'whatsapp_messages'),
    settings: await tableSnapshot(tx, SETTINGS),
  }
}

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

type Seed = {
  readonly companyId: string
  readonly userId: string
  readonly connectionId: string
  readonly contactId: string
}

/** Empresa, usuario, conexion y un contacto propios, dentro de la transaccion del caso. */
async function seed(tx: Prisma.TransactionClient): Promise<Seed> {
  const marker = token()
  const documentType = await tx.documentType.create({
    data: { code: `DOC${marker.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  })
  const role = await tx.role.create({
    data: { name: `rol-${marker}`, description: 'Rol de prueba' },
    select: { id: true },
  })
  const companyName = `Empresa agente ${marker}`
  const company = await tx.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  })
  const user = await tx.user.create({
    data: {
      firstNames: 'Ana Maria',
      lastNames: 'Perez Gomez',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `ana.${marker}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode: documentType.code,
      documentNumber: marker.slice(0, 12),
      username: `ana.${marker}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  })
  const connection = await tx.whatsappConnection.create({
    data: {
      id: randomUUID(),
      companyId: company.id,
      displayName: 'Ventas',
      wabaId: `waba-${marker}`,
      phoneNumberId: `phone-${marker}`,
      accessTokenEnc: 'v1:valor-cifrado-de-prueba',
      appSecretEnc: 'v1:otro-valor-cifrado',
      verifyTokenHash: 'a'.repeat(64),
      createdById: user.id,
    },
    select: { id: true },
  })
  const contact = await tx.whatsappContact.create({
    data: { companyId: company.id, connectionId: connection.id, waId: '573001234567' },
    select: { id: true },
  })
  return { companyId: company.id, userId: user.id, connectionId: connection.id, contactId: contact.id }
}

/** Contacto escrito en SQL: sirve tambien con el esquema anterior a la migracion. */
async function insertRawContact(tx: Prisma.TransactionClient, s: Seed, waId: string): Promise<string> {
  const rows = await tx.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "whatsapp_contacts" ("company_id", "connection_id", "wa_id", "updated_at")
     VALUES ($1::uuid, $2::uuid, $3, CURRENT_TIMESTAMP) RETURNING "id"::text AS "id"`,
    s.companyId,
    s.connectionId,
    waId,
  )
  return (rows[0] as { id: string }).id
}

const INSERT_MESSAGE =
  `INSERT INTO "whatsapp_messages" ("company_id", "connection_id", "contact_id", "direction", "type", ` +
  `"body", "status", "origin", "updated_at") VALUES ($1::uuid, $2::uuid, $3::uuid, 'OUT', 'TEXT', $4, ` +
  `'QUEUED', $5::"whatsapp_message_origin", CURRENT_TIMESTAMP)`

type SettingsRow = {
  readonly enabled: boolean
  readonly confidenceThreshold: string
  readonly dailyReplyLimit: number
  readonly contactHourlyReplyLimit: number
  readonly inactivityHours: number
  readonly handoffMessage: string
  readonly greetingMessage: string
  readonly assistantName: string | null
}

const VALID_SETTINGS: SettingsRow = {
  enabled: false,
  confidenceThreshold: '0.6',
  dailyReplyLimit: 500,
  contactHourlyReplyLimit: 20,
  inactivityHours: 12,
  handoffMessage: 'Te comunico con una persona del equipo. Te responderá en cuanto pueda.',
  greetingMessage: 'Hola, soy el asistente virtual {nombre}. Si prefieres hablar con una persona, escribe "asesor".',
  assistantName: null,
}

const INSERT_SETTINGS =
  `INSERT INTO "${SETTINGS}" ("company_id", "enabled", "confidence_threshold", "daily_reply_limit", ` +
  `"contact_hourly_reply_limit", "inactivity_hours", "handoff_message", "greeting_message", ` +
  `"assistant_name", "updated_by", "updated_at") VALUES ($1::uuid, $2::boolean, $3::numeric, $4::int, ` +
  `$5::int, $6::int, $7::text, $8::text, $9::text, $10::uuid, CURRENT_TIMESTAMP)`

function settingsValues(s: Seed, override: Partial<SettingsRow> = {}): unknown[] {
  const row = { ...VALID_SETTINGS, ...override }
  return [
    s.companyId,
    row.enabled,
    row.confidenceThreshold,
    row.dailyReplyLimit,
    row.contactHourlyReplyLimit,
    row.inactivityHours,
    row.handoffMessage,
    row.greetingMessage,
    row.assistantName,
    s.userId,
  ]
}

function settingsOutcome(tx: Prisma.TransactionClient, s: Seed, override: Partial<SettingsRow> = {}) {
  return outcomeOf(tx, INSERT_SETTINGS, ...settingsValues(s, override))
}

const SET_MODE =
  `UPDATE "whatsapp_contacts" SET "conversation_mode" = $2::"whatsapp_conversation_mode", ` +
  `"conversation_mode_reason" = $3::"whatsapp_conversation_mode_reason", ` +
  `"conversation_mode_changed_at" = $4::timestamptz, "conversation_mode_changed_by" = $5::uuid WHERE "id" = $1::uuid`

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion whatsapp_agent contra Postgres real', () => {
  it('existe exactamente una carpeta de la migracion, con su down.sql', () => {
    expect(carpetas).toEqual(['20261030120000_whatsapp_agent'])
    expect(existsSync(join(migrationDir, 'down.sql'))).toBe(true)
  })

  it('R19: los contactos que ya existian al migrar quedan en AGENT con motivo, fecha y autor nulos', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seed(tx)
      await applyStatements(tx, DOWN_STATEMENTS)
      const anterior = await insertRawContact(tx, s, '573009998877')
      await applyStatements(tx, UP_STATEMENTS)

      const rows = await tx.$queryRawUnsafe<
        { id: string; mode: string; reason: string | null; changed_at: Date | null; changed_by: string | null }[]
      >(
        `SELECT "id"::text AS "id", "conversation_mode"::text AS "mode", "conversation_mode_reason"::text AS "reason",
                "conversation_mode_changed_at" AS "changed_at", "conversation_mode_changed_by"::text AS "changed_by"
         FROM "whatsapp_contacts" WHERE "id" IN ($1::uuid, $2::uuid) ORDER BY "id"`,
        anterior,
        s.contactId,
      )
      expect(rows).toHaveLength(2)
      for (const row of rows) {
        expect(row).toMatchObject({ mode: 'AGENT', reason: null, changed_at: null, changed_by: null })
      }
    })
  })

  it('R19: un contacto nuevo nace en AGENT sin motivo ni fecha', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seed(tx)
      expect(
        await tx.whatsappContact.findUniqueOrThrow({
          where: { id: s.contactId },
          select: {
            conversationMode: true,
            conversationModeReason: true,
            conversationModeChangedAt: true,
            conversationModeChangedBy: true,
          },
        }),
      ).toEqual({
        conversationMode: 'AGENT',
        conversationModeReason: null,
        conversationModeChangedAt: null,
        conversationModeChangedBy: null,
      })
    })
  })

  it('R31: la base rechaza HUMAN sin motivo ni fecha, motivo sin fecha y fecha sin motivo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seed(tx)
      const at = '2026-10-30T10:00:00Z'
      expect(await outcomeOf(tx, SET_MODE, s.contactId, 'HUMAN', null, null, s.userId)).toMatch(
        /whatsapp_contacts_human_mode_has_reason/,
      )
      expect(await outcomeOf(tx, SET_MODE, s.contactId, 'HUMAN', null, at, s.userId)).toMatch(
        /whatsapp_contacts_(human_mode_has_reason|mode_change_consistent)/,
      )
      expect(await outcomeOf(tx, SET_MODE, s.contactId, 'HUMAN', 'MANUAL', null, s.userId)).toMatch(
        /whatsapp_contacts_mode_change_consistent/,
      )
      expect(await outcomeOf(tx, SET_MODE, s.contactId, 'AGENT', 'MANUAL', null, s.userId)).toMatch(
        /whatsapp_contacts_mode_change_consistent/,
      )
      expect(await outcomeOf(tx, SET_MODE, s.contactId, 'AGENT', null, at, null)).toMatch(
        /whatsapp_contacts_mode_change_consistent/,
      )
    })
  })

  it('R31 y R20: la base admite HUMAN y AGENT con motivo y fecha, con usuario o sin el (el sistema)', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seed(tx)
      const at = '2026-10-30T10:00:00Z'
      expect(await outcomeOf(tx, SET_MODE, s.contactId, 'HUMAN', 'MANUAL', at, s.userId)).toBeNull()
      expect(await outcomeOf(tx, SET_MODE, s.contactId, 'HUMAN', 'LOW_CONFIDENCE', at, null)).toBeNull()
      expect(await outcomeOf(tx, SET_MODE, s.contactId, 'AGENT', 'INACTIVITY', at, null)).toBeNull()
      expect(await outcomeOf(tx, SET_MODE, s.contactId, 'AGENT', 'MANUAL', at, s.userId)).toBeNull()
    })
  })

  it('R20: el autor del cambio debe ser un usuario existente', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seed(tx)
      expect(
        await outcomeOf(tx, SET_MODE, s.contactId, 'HUMAN', 'MANUAL', '2026-10-30T10:00:00Z', randomUUID()),
      ).toMatch(/whatsapp_contacts_conversation_mode_changed_by_fkey/)
    })
  })

  it('R21: la base admite en HUMAN cada motivo de paso a humano, tambien reclamo, sentimiento negativo y medio no soportado', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seed(tx)
      const enums = await schemaSnapshot(tx)
      expect(enums.enums.find((e) => e.typname === 'whatsapp_conversation_mode_reason')?.labels).toEqual([
        ...HUMAN_REASONS,
        'INACTIVITY',
      ])
      for (const reason of HUMAN_REASONS) {
        expect(
          await outcomeOf(tx, SET_MODE, s.contactId, 'HUMAN', reason, '2026-10-30T10:00:00Z', null),
          reason,
        ).toBeNull()
      }
    })
  })

  it('R8 y R17: la tabla de configuracion tiene clave por empresa y ningun DEFAULT en los campos de negocio', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { settings } = await schemaSnapshot(tx)
      const conDefault = settings.columns.filter((c) => c.column_default !== null).map((c) => c.column_name)
      expect(conDefault).toEqual(['created_at'])
      expect(settings.columns.find((c) => c.column_name === 'confidence_threshold')).toMatchObject({
        udt_name: 'numeric',
        numeric_precision: 3,
        numeric_scale: 2,
        is_nullable: 'NO',
      })
      expect(settings.columns.find((c) => c.column_name === 'assistant_name')).toMatchObject({
        udt_name: 'text',
        is_nullable: 'YES',
      })
      expect(settings.constraints).toEqual(
        expect.arrayContaining([
          { conname: 'whatsapp_agent_settings_pkey', def: 'PRIMARY KEY (company_id)' },
          {
            conname: 'whatsapp_agent_settings_company_id_fkey',
            def: 'FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT',
          },
          {
            conname: 'whatsapp_agent_settings_updated_by_fkey',
            def: 'FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT',
          },
        ]),
      )
    })
  })

  it('R17: una sola fila de configuracion por empresa', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seed(tx)
      await tx.$executeRawUnsafe(INSERT_SETTINGS, ...settingsValues(s))
      expect(await settingsOutcome(tx, s, { enabled: true })).toMatch(/whatsapp_agent_settings_pkey|23505/)
      const count = await tx.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM "${SETTINGS}" WHERE "company_id" = $1::uuid`,
        s.companyId,
      )
      expect(count).toEqual([{ n: 1 }])
    })
  })

  it('la base rechaza un umbral fuera de [0, 1] y admite los bordes', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seed(tx)
      expect(await settingsOutcome(tx, s, { confidenceThreshold: '-0.01' })).toMatch(
        /whatsapp_agent_settings_threshold_range/,
      )
      expect(await settingsOutcome(tx, s, { confidenceThreshold: '1.01' })).toMatch(
        /whatsapp_agent_settings_threshold_range/,
      )
      expect(await settingsOutcome(tx, s, { confidenceThreshold: '0' })).toBeNull()
      expect(await settingsOutcome(tx, s, { confidenceThreshold: '1' })).toBeNull()
    })
  })

  it('la base rechaza limites y horas menores que 1 y admite 1', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seed(tx)
      for (const campo of ['dailyReplyLimit', 'contactHourlyReplyLimit', 'inactivityHours'] as const) {
        expect(await settingsOutcome(tx, s, { [campo]: 0 }), campo).toMatch(
          /whatsapp_agent_settings_limits_positive/,
        )
      }
      expect(
        await settingsOutcome(tx, s, { dailyReplyLimit: 1, contactHourlyReplyLimit: 1, inactivityHours: 1 }),
      ).toBeNull()
    })
  })

  it('la base rechaza mensajes vacios, solo con espacios o de mas de 4096 caracteres y admite 4096', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seed(tx)
      const rechazos: Partial<SettingsRow>[] = [
        { handoffMessage: '' },
        { handoffMessage: '   ' },
        { greetingMessage: '' },
        { greetingMessage: '      ' },
        { handoffMessage: 'a'.repeat(4097) },
        { greetingMessage: 'a'.repeat(4097) },
      ]
      for (const override of rechazos) {
        expect(await settingsOutcome(tx, s, override)).toMatch(/whatsapp_agent_settings_messages_not_blank/)
      }
      expect(
        await settingsOutcome(tx, s, { handoffMessage: 'a'.repeat(4096), greetingMessage: 'b'.repeat(4096) }),
      ).toBeNull()
    })
  })

  it('R34: la base rechaza un nombre del asistente vacio, con espacios en los extremos o de 61 caracteres y admite NULL y 60', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seed(tx)
      for (const assistantName of ['', '   ', ' Ana', 'Ana ', 'a'.repeat(61)]) {
        expect(await settingsOutcome(tx, s, { assistantName }), JSON.stringify(assistantName)).toMatch(
          /whatsapp_agent_settings_assistant_name_valid/,
        )
      }
      expect(await settingsOutcome(tx, s, { assistantName: null })).toBeNull()
      expect(await settingsOutcome(tx, s, { assistantName: 'a'.repeat(60) })).toBeNull()
      expect(await settingsOutcome(tx, s, { assistantName: 'Ana María' })).toBeNull()
    })
  })

  it('R32: la tabla de configuracion tiene RLS activada y forzada, sin policies', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { settings } = await schemaSnapshot(tx)
      expect(settings.rls).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }])
      expect(settings.policies).toEqual([])
    })
  })

  it('R33: AGENT es un origen admitido de mensaje, ademas de USER y SYSTEM', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seed(tx)
      const { enums } = await schemaSnapshot(tx)
      expect(enums.find((e) => e.typname === 'whatsapp_message_origin')?.labels).toEqual(['USER', 'SYSTEM', 'AGENT'])
      expect(await outcomeOf(tx, INSERT_MESSAGE, s.companyId, s.connectionId, s.contactId, 'hola', 'AGENT')).toBeNull()
    })
  })

  it('R33: aplicar la migracion no cambia el origen de ningun mensaje existente', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seed(tx)
      await applyStatements(tx, DOWN_STATEMENTS)
      for (const origin of ['USER', 'SYSTEM', null]) {
        await tx.$executeRawUnsafe(INSERT_MESSAGE, s.companyId, s.connectionId, s.contactId, `m-${origin}`, origin)
      }
      await applyStatements(tx, UP_STATEMENTS)

      const rows = await tx.$queryRawUnsafe<{ body: string; origin: string | null }[]>(
        `SELECT "body", "origin"::text AS "origin" FROM "whatsapp_messages" WHERE "contact_id" = $1::uuid ORDER BY "body" COLLATE "C"`,
        s.contactId,
      )
      expect(rows).toEqual([
        { body: 'm-SYSTEM', origin: 'SYSTEM' },
        { body: 'm-USER', origin: 'USER' },
        { body: 'm-null', origin: null },
      ])
    })
  })

  it('el DOWN quita tabla, columnas, restricciones, indice y tipos, y deja el origen sin AGENT', async () => {
    await inRolledBackTransaction(async (tx) => {
      const antes = await schemaSnapshot(tx)

      await applyStatements(tx, DOWN_STATEMENTS)

      const despues = await schemaSnapshot(tx)
      expect(despues.tables).toEqual(antes.tables.filter((t) => t !== SETTINGS))
      expect(despues.enums).toEqual([{ typname: 'whatsapp_message_origin', labels: ['USER', 'SYSTEM'] }])
      expect(despues.contacts.columns).toEqual(
        antes.contacts.columns.filter((c) => !(MODE_COLUMNS as readonly string[]).includes(c.column_name)),
      )
      expect(despues.contacts.constraints).toEqual(
        antes.contacts.constraints.filter((c) => !(MODE_CONSTRAINTS as readonly string[]).includes(c.conname)),
      )
      expect(despues.contacts.indexes).toEqual(antes.contacts.indexes.filter((i) => i.indexname !== MODE_INDEX))
      expect(despues.contacts.rls).toEqual(antes.contacts.rls)
      expect(despues.messages).toEqual(antes.messages)
    })
  })

  it('ida y vuelta: DOWN y UP dejan exactamente el mismo esquema', async () => {
    await inRolledBackTransaction(async (tx) => {
      const antes = await schemaSnapshot(tx)

      await applyStatements(tx, DOWN_STATEMENTS)
      await applyStatements(tx, UP_STATEMENTS)

      expect(await schemaSnapshot(tx)).toEqual(antes)
    })
  })

  it('el DOWN se para si algun mensaje tiene origen AGENT', async () => {
    await inRolledBackTransaction(async (tx) => {
      const s = await seed(tx)
      await tx.$executeRawUnsafe(INSERT_MESSAGE, s.companyId, s.connectionId, s.contactId, 'del agente', 'AGENT')

      await tx.$executeRawUnsafe('SAVEPOINT down_con_agent')
      let error: unknown = null
      try {
        await applyStatements(tx, DOWN_STATEMENTS)
      } catch (caught) {
        error = caught
      } finally {
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT down_con_agent')
      }
      expect(String(error instanceof Error ? error.message : error)).toMatch(/AGENT/)

      const rows = await tx.$queryRawUnsafe<{ origin: string }[]>(
        `SELECT "origin"::text AS "origin" FROM "whatsapp_messages" WHERE "contact_id" = $1::uuid`,
        s.contactId,
      )
      expect(rows).toEqual([{ origin: 'AGENT' }])
    })
  })
})
