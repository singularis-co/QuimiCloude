# QC-284 — lote-por-presentacion · review (vuelta 1)

> Rama `feature/QC-284-lote-por-presentacion` contra `origin/dev` (sin commits nuevos en dev al
> revisar; `git log HEAD..origin/dev` vacío). 10 commits, 56 archivos. Grafo no usado: revisión
> por Grep/Read y `git diff`.

## Verificación ejecutada por el reviewer

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | 0 errores, 7 warnings (archivos no tocados) |
| `pnpm exec vitest run guard` | 76 archivos, 1066 pass, 20 skipped |
| `pnpm exec vitest run` sobre los 25 tests del diff + `tests/integration/scripts/seed-demo.int.test.ts` + `tests/integration/proveedores/catalog-line.int.test.ts` | 27 archivos: 26 verdes, 549 pass; **1 rojo**: `catalog-line.int.test.ts > R32` (ver punto 1, ajeno) |
| `SHOW lc_messages` en el Postgres local de `.env` | `Spanish_Colombia.1252`, PostgreSQL 16.1 |
| E2E | No corrido (lo corre CI; necesita base con la migración). Evidencia del implementer: 2 passed (Chromium, WebKit) en base aislada `qc284_e2e` |
| `./init.sh` | No corrido: el validador de features aborta por cupo fullstack, conocido y aceptado por el humano (no es hallazgo) |

## Checklist

### Reviewer (puntos 1–4)
- [x] **Trazabilidad**: R1–R32 tienen test real (tabla abajo). Ninguno vacío.
- [x] **Tasks**: T1–T14 marcadas `[x]` (0 `[ ]` en `tasks.md`).
- [x] **Checkpoints** (abajo).
- [x] **Verificación ejecutable** (arriba).

### CHECKPOINTS.md
- [x] requirements.md con EARS R1–R32.
- [x] design.md con alternativas descartadas (§ 8, seis).
- [x] tasks.md todas `[x]`.
- [x] design.md abre con `## Lo que ya existe`, no vacía, con búsqueda; el diff no re-crea nada de la lista: reutiliza `isDuplicateBatchLot`, `BatchDuplicateLotError`, `resolveLot`, `Notice`, `Input`, `Label`, `Button`, `ErrorAlert`, `missingBatchDataLines`, `finish-conditioning.ts` (sin tocar).
- [x] Mapa `R<n> -> test` en `progress/impl_QC-284.md`.
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` en CI: pendiente del PR (no evaluable aquí).
- [x] Flujo crítico (movimientos de inventario / lotes): E2E Playwright `e2e/datos-de-lote-en-acondicionamiento.spec.ts`, salida local en la bitácora.
- [x] Sin dependencias nuevas: `package.json` y `pnpm-lock.yaml` sin diff.
- [x] Sin secretos ni configuración hardcodeada; sin webhooks.
- [ ] `./init.sh` verde: rojo solo por cupo (aceptado por el humano). Typecheck, lint, guardias y tests del diff verdes a mano.

### docs/checkpoints-proyecto.md
- [x] Multiplataforma: un `Input` por campo con `min-h-11 text-base`, `type="date"` nativo, una columna en móvil y tres desde `md:`; sin `100vh` ni `:hover` como única vía.
- [x] Sin pieza nueva en `components/ui|shared`, `lib/shared/ui`, `hooks`: CATALOGO sin cambio necesario.
- [x] Diseño: cambio visual de un componente de ruta que solo compone piezas catalogadas; `design.md` declara la excepción y cita `Acondicionamiento.dc.html` (ya pinta un solo juego) y `Avisos.dc.html` para el `Notice`.
- [x] Sin tabla nueva. Las lecturas nuevas (choque previo, lotes bloqueados, `findBatchesByLots`) filtran por `company_id`; rechazo cruzado probado (`finished-batch-labels.int` R21/R23 «otra empresa», `product-batch-lot-per-presentation.int` R4).
- [x] Permiso en el caso de uso (`requirePermission` primera línea, test R24 `unauthorized` sin puertos).
- [x] RLS de `product_batches` intacta (ENABLE+FORCE; el `down` la restaura).
- [x] Migración versionada con `down.sql`; `db:rollback` probado por el implementer y por el `.int` de R29.
- [x] Hexagonal: `domain/` sin framework ni Prisma; `asignaciones` importa `@/lib/modules/inventario` por barrel; acción `driving` sin instanciar `driven`; lógica (`batchDataForm`, orden de comprobaciones) en `domain/`.
- [x] Server Action como mutación; datos por props.

### perfil-agentes.md > reviewer (5–11)
- [x] 5 Calidad y seguridad: sin hardcode de contexto; capas separadas.
- [x] 6 Multiplataforma: ver arriba.
- [x] 7 Dependencias: sin cambios.
- [x] 8 Aislamiento: sin modelo nuevo; consultas por empresa con test cruzado.
- [x] 9 Comentarios: ninguna línea añadida en `app/ lib/ db/ scripts/` cita `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada» (grep sobre el diff). Los comentarios nuevos explican el porqué.
- [x] 10 Duplicados: sin componente nuevo.
- [x] 11 Diseño: ver arriba.

## Trazabilidad R<n> -> test (verificada)

| R | Test principal (además de los de la bitácora) |
|---|---|
| R1, R2 | `product-batch-lot-per-presentation.int` «R1, R6» y «R2, R6» (P2002 real en cada índice); `product-batch-lot.int` «QC-284 R1» (23505 por SQL crudo); migración `.int` «R1, R2, R3, R4» |
| R3, R4 | `product-batch-lot-per-presentation.int` «R3» (los cuatro casos del requisito) y «R4» |
| R5 | idem «R5: con 7 … el siguiente es 51» |
| R6 | idem «R6» carrera tecleada (dos índices) y reintento del generado |
| R7 | idem «R7» ×2; `product-batch-lot.int` «QC-284 R7»; unit `product-batch-lot-retry` |
| R8 | `catalogo.test.ts` «QC-284 R8» (texto exacto, código igual) |
| R9–R11 | unit `plan-`/`confirm-inventory-import`; `.int` `inventory-import-confirm` (incl. carrera R11) y `inventory-import-repository` |
| R12 | `.int` `adjust-by-count` y `finished-goods-return` «QC-284 R12» |
| R13 | `conditioning-batch-data-form.test.tsx` «R13» ×3; `conditioning-order-screen.test.tsx` en los tres estados |
| R14, R15 | `conditioning-batch-data.test.ts` (`batchDataForm`); componente; pantalla; `.int` «QC-284 R15, R16, R27» en TERMINADO y ENTREGADO |
| R16 | `get-conditioning-order.test.ts` «QC-284 R16»; `.int` R15/R16/R27 compara lotes antes/después de abrir |
| R17, R23 | componente «R17»; `.int` «QC-284 R17, R23»; `finished-batch-labels.int` «R23» |
| R18 | `finished-batch-labels.int` «R18» (stock, coste, compra, presentación, producto, contenido, asientos, otro pedido) |
| R19, R20, R24 | unit `save-conditioning-batch-data.test.ts` (18 entradas inválidas incl. `lines`/`batchId`; fechas; orden permiso→entrada→pedido→fechas→escritura) |
| R21, R22 | `finished-batch-labels.int` «R21» ×3 y «R22» ×2 contra base real; unit de traducción |
| R25 | componente «R25» (3 códigos + otro código); acción «R25»; E2E `saveAndExpectRejection` |
| R26 | `.int` «QC-284 R18, R26» y «QC-284 R26»; E2E |
| R27 | `.int` «QC-284 R15, R16, R27» (estado, `finishedAt`, equipo intactos) |
| R28 | unit de migración (orden y solo DDL) y `.int` «R28» sentencia a sentencia |
| R29 | `.int` «R29» aborto con mensaje y vuelta limpia; unit del `down` |
| R30 | E2E reescrito (detalle abajo) |
| R31 | guardias verdes; sin diff en `package.json`/lock; R1–R29 cubiertos |
| R32 | Negativo de alcance: `.int` R23 (no crea lotes), R26 (la línea sin lote sigue sin lote), R18 (no toca asientos ni otros lotes); el diff no toca reserva, consumo ni ejecución |

## Puntos que pidió juzgar el leader

### 1. `catalog-line.int.test.ts > R32` rojo — AJENO, de entorno, no es de QC-284
- El test lee `error.meta.constraint` del `P2003` y lo compara con `toMatch`. Su propio comentario
  (D33, 2026-10-07) dice que el conector solo rellena `constraint` con un Postgres en inglés
  (`lc_messages = en_US.utf8`, el de Docker y el `postgres:17` de CI). Con uno en español entrega
  `constraint: null`, y `toMatch(null)` da justo `expects to receive a string, but got object`.
- El Postgres local de este equipo es 16.1 con `lc_messages = Spanish_Colombia.1252`. Esa es la causa.
- El diff de QC-284 no toca `lib/modules/proveedores`, `tests/integration/proveedores` ni ninguna FK
  de `supplier_catalog_lines`. El cambio en `error-catalog.ts` es solo el texto de
  `batch_duplicate_lot`, y el test no lo lee.
- No hace falta compararlo con `origin/dev`: falla igual en cualquier rama sobre este Postgres. En CI
  (inglés) sale verde. **No es hallazgo.** Tampoco va al baseline, porque en CI no es rojo.

### 2. Seed de demo (T11) — coherente con el spec; no hace falta subirlo al humano
- El spec solo pide (T11, `design.md` tabla «Lo que ya existe») que el seed llame con la entrada
  nueva y guarde un único lote por pedido. Eso se cumple, y `seed-demo.int.test.ts` sale verde.
- Qué lote elige el seed es un detalle de los datos de demostración, no una regla de negocio. Sigue
  la convención que ya había: `DEMO-PT-<provisional>`, que es único en la empresa. El respaldo
  (reutilizar el lote escrito de la primera línea cuando todas tienen datos pero no coinciden)
  escribe en las demás líneas un código que ya es de un lote de otro producto. Por R21 eso no
  choca. Es idempotente: no reescribe con `shared` ni con `no_batches`.
- El comentario del código documenta la regla. No es invento de producto. Sin hallazgo.

### 3. Migración — SQL correcto y seguro
- **UP**: crea `…_product_presentation_lot_unique` (parcial, `presentation_id IS NOT NULL`) y
  `…_product_lot_unique` (parcial, `IS NULL`), y después hace `DROP INDEX` del viejo. Los nuevos son
  más débiles que (empresa, código), así que no pueden fallar por datos, y en ningún punto la tabla
  queda sin unicidad (R28). Es solo DDL. Ninguna FK ni `ON CONFLICT` depende de
  `product_batches_company_lot_unique` (lo he buscado). Ningún código usa `companyId_lot`.
- **DOWN**: `NO FORCE` → `DO $$` que cuenta `GROUP BY company_id, lot HAVING count(*) > 1` (es la
  misma condición que el índice que va a recrear) y hace `RAISE EXCEPTION` con cuántos códigos,
  cuántas filas, la consulta para localizarlos y «renombra esos lotes». Después crea primero el
  índice estricto, luego quita los dos parciales y al final `ENABLE` + `FORCE`. `db:rollback` lo
  corre en una sola transacción, así que el `RAISE` deshace también el `NO FORCE`: no queda nada a
  medias (R29). El `.int` de R29 lo prueba sobre una copia de la tabla.
- Prisma 6 devuelve columnas en `meta.target` para los dos índices parciales; el implementer lo
  midió con una mutación. `isDuplicateBatchLot` compara conjuntos exactos.
- Sin `CONCURRENTLY`, lo que bloquea escrituras mientras se construye. La tabla es pequeña y está
  justificado en `design.md > 1.2`. Aceptable.

### 4. E2E — cubre lo que pide el issue
- «El mismo lote en la misma presentación de otra producción se rechaza»: el paso 5 guarda
  `PREVIOUS_PRODUCTION_LOT`, un lote sembrado del **mismo producto y la misma presentación** que la
  línea 1 y sin asiento del pedido. Exige `batch_duplicate_lot` con el texto del catálogo en
  `role="alert"`, `aria-invalid` solo en «Lote», lo escrito conservado y los tres lotes intactos en
  la base.
- «Dos presentaciones de un pedido guardan el mismo lote y terminan»: el paso 6 guarda un código
  que ya es de un envase de la empresa y comprueba en la base que los dos lotes del pedido llevan la
  misma terna. Después «Terminar» se habilita, confirma, aterriza en «Por acondicionar» con el aviso
  y deja el pedido en `TERMINADO`. El paso 8 lo comprueba en `/inventario` como Administrador.
- También mantiene los rechazos de fechas de QC-219 R28 y el formulario único vacío con «Terminar»
  deshabilitado (R30 completo).

## Hallazgos

1. **menor** — `design.md > 2.3` paso 1 dice «los lotes de producción del pedido». La
   implementación, además, restringe a `presentation_id IS NOT NULL` y
   `order_presentation_line_id IS NOT NULL` para que coincida con `listOfOrder`. Es correcto y
   está justificado en `progress/impl_QC-284.md > Tanda 2 > Precision sobre design.md > 2.3`, pero
   el design no se actualizó. Se puede anotar en el design al cerrar; no bloquea.

Sin hallazgos bloqueantes.

## Veredicto

**OK**
