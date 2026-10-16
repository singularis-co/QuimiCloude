// QC-223 2026-10-08 (TC) — Una entrega registrada no se modifica ni se borra desde la aplicacion.
//
// Barrido de `lib/` y `app/`: ningun `update`/`delete`/`upsert` de Prisma sobre `orderDelivery`,
// `orderDeliveryLine` ni el asiento (`inventoryMovement`), ningun `UPDATE`/`DELETE` crudo sobre sus
// tablas, y ningun caso de uso ni Server Action cuyo nombre ofrezca editar, anular o borrar una
// entrega. Las migraciones (`db/`) quedan fuera: su `down.sql` borra las tablas a proposito.
//
// 2026-10-13 (TC) — La anulacion de una entrega es un registro nuevo que solo inserta. El
// barrido admite exactamente dos nombres `void…Deliver`: el caso de uso `createVoidDelivery` y la
// Server Action `voidDeliveryAction`; cualquier otro nombre que ofrezca anular una entrega sigue en
// rojo. Ademas, ningun camino modifica ni borra una anulacion ni sus lineas: `PRISMA_MUTANTE` y
// `SQL_MUTANTE` cubren `orderDeliveryVoid`/`orderDeliveryVoidLine` y sus tablas
// `order_delivery_voids`/`order_delivery_void_lines`. Las aserciones previas se conservan.
//
// QC-282 2026-10-15 (TC) — Verificado sin cambio: el `UPDATE "order_delivery_lines"` que copia el
// cliente de la entrega a sus lineas vive en la migracion `order_delivery_lines_customer`, bajo
// `db/migrations`, que este barrido no recorre (`CARPETAS` es `lib` y `app`).

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const RAIZ = join(__dirname, '..', '..', '..')
const CARPETAS = ['lib', 'app'] as const

function soloCodigo(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((linea) => linea.replace(/\/\/.*$/, ''))
    .join('\n')
}

function fuentes(dir: string): string[] {
  const salida: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name)
    if (entrada.isDirectory()) {
      if (entrada.name === 'node_modules' || entrada.name.startsWith('.')) continue
      salida.push(...fuentes(ruta))
    } else if (/\.(ts|tsx)$/.test(entrada.name)) {
      salida.push(ruta)
    }
  }
  return salida
}

const PRISMA_MUTANTE = /\b(orderDelivery|orderDeliveryLine|orderDeliveryVoid|orderDeliveryVoidLine|inventoryMovement)\s*\.\s*(update|updateMany|delete|deleteMany|upsert)\b/g
const SQL_MUTANTE = /\b(UPDATE\s+(?:ONLY\s+)?|DELETE\s+FROM\s+(?:ONLY\s+)?)(?:"?public"?\.)?"?(order_deliveries|order_delivery_lines|order_delivery_voids|order_delivery_void_lines)\b/gi
const NOMBRE_MUTANTE = /\bexport\s+(?:async\s+)?(?:function|const)\s+(\w*(?:update|edit|delete|remove|cancel|annul|void|revert|undo)\w*Deliver\w*)/gi

/**
 * Los unicos nombres `void…Deliver` admitidos: el caso de uso y la Server Action que anulan una
 * entrega insertando la anulacion, sus lineas y el asiento que compensa. Ninguno modifica ni borra.
 */
const NOMBRES_ADMITIDOS: ReadonlySet<string> = new Set(['createVoidDelivery', 'voidDeliveryAction'])

/** Cada infraccion como `<archivo>: <texto>`, para que el rojo diga donde mirar. */
function infracciones(nombre: string, fuente: string): string[] {
  const codigo = soloCodigo(fuente)
  const salida: string[] = []
  for (const patron of [PRISMA_MUTANTE, SQL_MUTANTE, NOMBRE_MUTANTE]) {
    for (const m of codigo.matchAll(patron)) {
      if (patron === NOMBRE_MUTANTE && NOMBRES_ADMITIDOS.has(m[1] ?? '')) continue
      salida.push(`${nombre}: ${m[0].trim()}`)
    }
  }
  return salida
}

describe('la entrega es solo de insercion (R32)', () => {
  it('R32: ningun camino de lib/ ni app/ modifica o borra una entrega, una linea de entrega ni su asiento', () => {
    const archivos = CARPETAS.flatMap((carpeta) => fuentes(join(RAIZ, carpeta)))
    expect(archivos.length, 'el barrido no encontro fuentes').toBeGreaterThan(100)
    expect(
      archivos.some((a) => a.endsWith(join('pedidos', 'adapters', 'driven', 'persistence', 'order-delivery-prisma.ts'))),
      'el adaptador de la entrega tiene que estar en el barrido',
    ).toBe(true)

    const encontradas = archivos.flatMap((archivo) =>
      infracciones(relative(RAIZ, archivo).replace(/\\/g, '/'), readFileSync(archivo, 'utf8')),
    )

    expect(encontradas).toEqual([])
  })

  it('R32: el barrido da rojo con un camino que modifica o borra (caso sintetico)', () => {
    const sintetico = [
      'await tx.orderDelivery.update({ where: { id }, data: { customerId } })',
      'await tx.orderDeliveryLine.deleteMany({ where: { orderDeliveryId: id } })',
      'await prisma.orderDelivery.upsert({ where: { id }, create: {}, update: {} })',
      'await tx.inventoryMovement.delete({ where: { id } })',
      'await tx.$executeRaw`UPDATE "order_deliveries" SET "customer_id" = ${c}`',
      'await tx.$executeRaw`DELETE FROM public.order_delivery_lines WHERE id = ${id}`',
      'export async function cancelOrderDeliveryAction(id: string) {}',
      'export const deleteDelivery = async () => {}',
    ].join('\n')

    expect(infracciones('sintetico.ts', sintetico)).toHaveLength(8)
  })

  it('R32: las lecturas, los INSERT y la prosa de un comentario no dan rojo', () => {
    const legitimo = [
      '// nunca se llama a orderDelivery.update ni a UPDATE order_deliveries',
      'await tx.orderDelivery.create({ data })',
      'await tx.orderDeliveryLine.createMany({ data: lines })',
      'await tx.orderDelivery.findFirst({ where: { deliveryKey } })',
      'await tx.$executeRaw`INSERT INTO "order_deliveries" ("id") VALUES (${id})`',
      'export async function deliverOrderAction() {}',
    ].join('\n')

    expect(infracciones('legitimo.ts', legitimo)).toEqual([])
  })
})

describe('la anulacion de una entrega es solo de insercion (R33)', () => {
  const archivos = CARPETAS.flatMap((carpeta) => fuentes(join(RAIZ, carpeta)))
  const relativa = (archivo: string): string => relative(RAIZ, archivo).replace(/\\/g, '/')

  it('R33: los dos nombres admitidos existen como export en lib/ y su archivo no modifica ni borra nada', () => {
    expect([...NOMBRES_ADMITIDOS].sort()).toEqual(['createVoidDelivery', 'voidDeliveryAction'])
    for (const nombre of NOMBRES_ADMITIDOS) {
      const exportacion = new RegExp(`\\bexport\\s+(?:async\\s+)?(?:function|const)\\s+${nombre}\\b`)
      const donde = archivos.filter((archivo) => exportacion.test(soloCodigo(readFileSync(archivo, 'utf8'))))
      expect(donde.map(relativa), `${nombre} se exporta una sola vez`).toHaveLength(1)
      const archivo = donde[0] as string
      expect(relativa(archivo).startsWith('lib/'), `${nombre} vive en lib/`).toBe(true)
      expect(infracciones(relativa(archivo), readFileSync(archivo, 'utf8'))).toEqual([])
    }
  })

  it('R33: el adaptador de la anulacion esta en el barrido y solo lee o inserta', () => {
    const adaptador = archivos.find((a) =>
      a.endsWith(join('pedidos', 'adapters', 'driven', 'persistence', 'order-delivery-void-prisma.ts')),
    )
    expect(adaptador, 'el adaptador de la anulacion tiene que estar en el barrido').toBeDefined()
    const codigo = soloCodigo(readFileSync(adaptador as string, 'utf8'))
    expect(codigo).toMatch(/\borderDeliveryVoid\s*\.\s*create\b/)
    expect(codigo).toMatch(/\borderDeliveryVoidLine\s*\.\s*createMany\b/)
    expect(infracciones('order-delivery-void-prisma.ts', codigo)).toEqual([])
  })

  it('R33: el barrido da rojo con un camino que modifica o borra una anulacion o con un tercer nombre void…Deliver (caso sintetico)', () => {
    const sintetico = [
      'await tx.orderDeliveryVoid.update({ where: { id }, data: { reason } })',
      'await tx.orderDeliveryVoidLine.deleteMany({ where: { orderDeliveryVoidId: id } })',
      'await prisma.orderDeliveryVoid.upsert({ where: { id }, create: {}, update: {} })',
      'await tx.$executeRaw`UPDATE "order_delivery_voids" SET "reason" = ${r}`',
      'await tx.$executeRaw`DELETE FROM public.order_delivery_void_lines WHERE id = ${id}`',
      'export async function voidOrderDeliveryAction(id: string) {}',
      'export const voidDeliveries = async () => {}',
    ].join('\n')

    expect(infracciones('sintetico.ts', sintetico)).toHaveLength(7)
  })

  it('R33: los dos nombres admitidos, las lecturas y los INSERT de la anulacion no dan rojo', () => {
    const legitimo = [
      'export function createVoidDelivery(deps: Deps) {}',
      'export async function voidDeliveryAction(input: unknown) {}',
      'await tx.orderDeliveryVoid.create({ data })',
      'await tx.orderDeliveryVoidLine.createMany({ data: lines })',
      'await tx.orderDeliveryVoid.findUnique({ where: { id } })',
      'await tx.$executeRaw`INSERT INTO "order_delivery_voids" ("id") VALUES (${id})`',
    ].join('\n')

    expect(infracciones('legitimo.ts', legitimo)).toEqual([])
  })
})
