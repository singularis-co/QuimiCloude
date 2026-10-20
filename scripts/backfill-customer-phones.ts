/**
 * db:backfill:customer-phones — interpreta el telefono de texto libre de los clientes que todavia
 * no tienen `phone_e164` ni `phone_issue`. Corre en el build justo despues de
 * `prisma migrate deploy` (`scripts/build.mjs`). Idempotente: una segunda corrida no encuentra
 * filas pendientes.
 *
 * Cascara fina, como `scripts/seed.ts`: carga el entorno, pide el caso de uso a la composicion,
 * imprime una linea de resumen y traduce exito/fallo a codigo de salida. Si falla, el build falla.
 * Prisma y la composicion se cargan con `import()` DESPUES de `loadDotEnv()`.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

function loadDotEnv(): void {
  if (!existsSync(join(process.cwd(), '.env'))) return
  process.loadEnvFile()
}

async function main(): Promise<void> {
  loadDotEnv()

  const { prisma } = await import('../lib/shared/db/prisma')
  try {
    const { clientes } = await import('../lib/composition')
    const summary = await clientes.backfillLegacyPhones()
    console.log(
      `[backfill-telefonos] empresas: ${summary.companies} - convertidos: ${summary.converted} - sin formato valido: ${summary.invalid} - duplicados: ${summary.duplicate}`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  console.error(`[backfill-telefonos] fallo — ${detail}`)
  process.exit(1)
})
