# Review QC-281 — Envases reales al terminar el empaque (F2.2)

- Rama `feature/QC-281-envases-reales-al-terminar-empaque`, HEAD `1a4f8008`, diff contra `origin/dev`.
- Leídos: spec (requirements R1–R33, design, tasks), `progress/features/QC-281.md` (Decisiones, Tandas,
  revisión visual humana OK en 94144850), `progress/impl_QC-281-…md`, `CHECKPOINTS.md`,
  `docs/checkpoints-proyecto.md`, `docs/perfil-agentes.md > reviewer`.
- Grafo MCP: no usado. Revisé con Grep/Read y git.

## Verificación ejecutada (por el reviewer)

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | verde (exit 0) |
| `pnpm run lint` | 0 errores, 7 warnings (preexistentes, ninguno en archivos del diff) |
| `pnpm exec vitest run guard` | 76/76 archivos, 1069 pasan, 20 omitidos |
| Unit/UI dirigidos (packing-count, order-packing, finish-packing, order-packing-actions, migración, deliver-order, get-order-delivery, get-packing-order, conditioning-batch-data, finish-conditioning, list-finished-product-distribution, packing-finish-dialog, packing-order-screen, finished-product-tables/tabs, `tests/unit/paridad`, route-contract) | 38 archivos, 892/892 |
| Integración (base local del repo principal): finish-with-finished-goods, settle-packaging, order-packed-counts, packed-lines-directory, execution-atomicity, order-packing | 6 archivos verdes (94 tests) |
| `tests/integration/proveedores/catalog-line.int.test.ts` | R32 rojo (ver hallazgo m6) |
| `./init.sh` | no corrido, por decisión del humano (lo cubre `gate-completo`) |
| E2E | no corrido. Me baso en la bitácora: `envases-reales-empaque` 3/3 en chromium y en webkit |

## Checklist

### Especificación
- [x] requirements.md con R1–R33 en EARS.
- [x] design.md con alternativas descartadas (§ 8, cinco).
- [~] Todas las tasks `[x]`: falta T9. El humano hizo la revisión visual y la dio por buena el 2026-10-15
  (94144850). El implementer la marca en F2.3. No bloquea.
- [x] `## Lo que ya existe` abre el design, y el diff no re-crea nada de esa tabla: reutiliza
  `sumInOrderUnit`/`validateDistribution`, `planReservation`/`netReservedByBatch`/`consumeBatchStock`,
  `MOVEMENT_REASONS`, el patrón de `FinishedDeliveryDirectory` y `DataTable`.

### Trazabilidad
- [x] Cada R1–R33 tiene al menos un test que lo afirma de verdad. Revisé el cuerpo de los de R13, R14,
  R15, R16, R18, R22, R30 y R32 en servidor y de R4, R11, R27, R28 y R33 en UI. R31 no se prueba con un
  test: el diff no toca `package.json` ni el lockfile.
- [x] El mapa `R<n> → test` consolidado está en `progress/impl_…md > Cierre (T13)`.

### Calidad de código
- [x] Typecheck y lint verdes.
- [ ] `gate-completo` en CI: pendiente, todavía no hay PR. Antes de abrirlo hay que integrar dev (ver m1).
- [x] Flujo crítico (movimientos de inventario, importes) cubierto por E2E Playwright
  (`e2e/envases-reales-empaque.spec.ts`), con su salida en la bitácora.
- [x] Sin dependencias nuevas.

### Seguridad y configuración
- [x] Sin secretos, sin webhooks y nada hardcodeado que cambie entre entornos.

### Datos y seguridad (Supabase)
- [x] No hay tabla nueva: son 3 columnas en `order_presentation_lines`, que ya tiene `company_id`, RLS y FORCE.
- [x] Permisos en el dominio con su test: `empaque.modificar` va antes de validar
  (`finish-packing.test.ts` «R14: sin `empaque.modificar`…»). `inventario.consultar` está en
  `list-finished-product-distribution`.
- [x] Acceso a datos solo por adaptadores driven de Prisma.
- [x] La migración es versionada, tiene `down.sql` y no hace backfill (R25). Su test de esquema compara los
  CHECK con `PACKING_DIFFERENCE_REASONS`, `PACKING_INCREASE_REASONS` y `PACKING_REASON_OTHER_MAX`, y que
  `down.sql` quite primero los CHECK y después las columnas. `db:rollback` no lo corrí (es una base local
  compartida): la bitácora de T1 lo da por limpio.

### Módulos hexagonales
- [x] `domain/` y `ports/` no importan framework ni adaptadores. `packing-count.ts` es puro e importa
  solo los barrels de `inventario` y `unidades`.
- [x] Entre módulos solo se importan contratos (barrels). `inventario` declara el hueco
  `FinishedDistributionDirectory`, `pedidos` lo implementa y `composition` lo cablea, sin ciclo.
- [x] Ningún driving instancia driven. `finishPackingInputFromFormData` solo hace `JSON.parse`, y el zod del
  caso de uso decide.
- [x] Barrels aptos para el cliente: el diálogo `'use client'` importa `@/lib/modules/pedidos`, que no
  arrastra servidor. La tabla de Reparto se corrigió en 6f478b49, con su guardia de regresión en
  `finished-product-route-contract.test.ts`.
- [x] La lógica de negocio está en `domain/`.

### Permisos
- [x] Las páginas validan en el servidor, los componentes reciben por props y las mutaciones son Server Actions.

### Reglas del perfil (reviewer 5–11)
- [x] 5. Capas separadas y sin contexto hardcodeado.
- [x] 6. Multiplataforma: `h-dvh` y no `100vh`; botones `touch` de 44 px o más; inputs, select y textarea en
  `text-base`/`text-lg`; nada depende de `:hover`; pie con `safe-area-inset-bottom`.
- [x] 7. Sin dependencias.
- [x] 8. Aislamiento por empresa: `recordPackedCounts` filtra por línea, pedido y empresa;
  `settlePackagingForOrder` por `companyId`; el directorio filtra la línea y el pedido por empresa. Hay
  tests del cruce (`order-packed-counts` R29 ×3, `settle-packaging` R29 ×2, `packed-lines-directory` R29)
  y una entrada en `aislamiento.json`.
- [x] 9. Comentarios: ninguna línea añadida en producción cita `QC-`, `R<n>`, `design.md` ni «decisión
  cerrada». «Empacado antes de QC-281» es un texto de UI aprobado (R27), no un comentario.
- [ ] 10. Duplicados: falla por el subcomponente `Fold` (B1).
- [x] 11. Diseño: los tableros aprobados se citan en el design. El diálogo y la tabla son piezas de una
  sola ruta y no van al catálogo.

## Puntos que pidió el leader

- **Migración.** Está correcta. Los 4 CHECK son los del design § 1 y van sin backfill. `down.sql` deshace
  en orden inverso. Tiene el mismo timestamp que una migración de dev (m2).
- **Rollback con `packaging_stock_insufficient`.** Es correcto. `FinishPackingRejectedSignal` se lanza
  dentro de `unitOfWork.run`. Para entonces ya se escribieron el estado, `recordPackedCounts` y el
  consumo de lo apartado, y todo eso se deshace. El `catch` exterior traduce la señal al resultado. Lo
  prueba en Postgres `finish-with-finished-goods.int` «R18, R22: sin stock libre…», que compara con
  `toEqual` una foto completa: estado, líneas con `packedPackages` null, apartado, existencia, lotes y
  asientos de reserva y de inventario. Lo mismo vale para `packed_exceeds_quantity` e
  `invalid_packing_count`. En este caso no hay nada escrito, porque se rechaza antes de escribir.
- **Autorización.** `requirePermission('empaque.modificar')` va antes del zod y de cualquier puerto.
  `finishPackingAlive` sigue exigiendo `packed_by = actor` y `EN_EMPAQUE` en el UPDATE condicional
  (`not_packer` lleva a `OrderPackingTakenError`). La vista `finish` solo sale para quien tiene el pedido
  en `EN_EMPAQUE`. No hay permiso nuevo.
- **Expectativas cambiadas.** El test de QC-195 R25 (`finish-with-finished-goods.int`) y
  `execution-atomicity` «R18, R24» pasan de `insufficient_material`/`MaterialShortageError` a
  `packaging_stock_insufficient`/`PackagingStockInsufficientError`. Está justificado: con conteo, el envase
  se liquida por `settlePackagingForOrder`, y la falta de stock del envase es exactamente R18 (design §§ 2.2
  y 3). Las dos aserciones siguen probando que no cambia nada (estado, lote, apartado, asientos y
  anotación). `insufficient_material` sobrevive para el envase que también es ingrediente
  (`consumeForOrder`), con su test. El texto de QC-195 R25 queda superado sin ninguna nota (m4).
- **Snapshots regenerados.** Revisé los cuatro y todos son a propósito:
  - `asignacion-paridad` y `asignacion-listas-paridad`: solo cae la columna «Envases» (R12).
  - `asignacion-acondicionamiento-paridad`: cae «Envases:» y se añade el `input` oculto `lines`.
  - `confirmaciones-paridad`: el `alertdialog` pasa a `dialog` con el conteo. Lo anuncia el design § 10.
- **Etiqueta compartida «Conteo físico».** La pidió el humano el 2026-10-14. `movementReasonLabel` añade
  `ACCENTED_LABELS` y solo cambia `conteo_fisico`. Están actualizados sus tests (batch-history,
  adjust-batch-dialog, finished-product-tables) y `e2e/ajuste-de-inventario.spec.ts`. No queda
  «Conteo fisico» en `app`, `lib`, `components`, `tests` ni `e2e`.

## Hallazgos

### BLOQUEANTE

- **B1 — `Fold` re-implementa `Collapsible` sin justificarlo en el design (regla 10 del reviewer).**
  - **Dónde:** `app/(private)/asignacion/empaque/[id]/components/packing-finish-dialog.tsx:450-497`.
  - **Qué hace:** pliega y despliega una sección con un `open` controlado. Gestiona a mano el montaje y el
    desmontaje en `transitionend`, además de `inert` y `aria-hidden`.
  - **Por qué choca con el catálogo:** `components/shared/CATALOGO.md` tiene la fila `Collapsible` /
    `CollapsibleContent` (`components/ui/collapsible.tsx`, de Base UI): «Sección que se pliega y se
    despliega». La animación no la cubre, pero Base UI expone `data-starting-style`/`data-ending-style` y
    desmonta tras la animación, que es justo lo que `Fold` hace a mano.
  - **Qué no dice el design:** `design.md > Componentes` no lista `Collapsible` entre las filas consultadas.
    Tampoco dice qué paso de la regla de decisión se aplicó al pliegue ni por qué `Collapsible` no bastaba.
    El pliegue entró después del spec, por decisión del humano el 2026-10-14.
  - **Para cumplir, una de dos:**
    - (a) componer `Collapsible`/`CollapsibleContent` con la animación del tablero;
    - (b) añadir en `design.md > Componentes` la fila del pliegue: paso de la regla de decisión, por qué
      `Collapsible` no basta y tablero de referencia.

  La (b) es un cambio solo de documentación.

### menor

- **m1 — La rama va 52 commits por detrás de `origin/dev` y la integración tiene 3 conflictos.** Son
  `tests/guards/guard-identificador-de-request.test.ts`, `tests/integration/aislamiento.json` y
  `tests/unit/asignaciones/finish-conditioning.test.ts`. En dev entró QC-283 (acondicionamiento en el
  recorrido), que reescribe `conditioning-batch-data.ts` y `finish-conditioning.ts`, justo donde vive R23
  (una línea en 0 no bloquea). El código se mezcla sin conflicto, pero hay que volver a verificar R23 y
  R25 después de integrar. Es obligatorio antes del PR, y `gate-completo` corre sobre el resultado de la
  mezcla.
- **m2 — Timestamp de migración repetido.** `db/migrations/20261015120000_order_presentation_lines_packed_count`
  y `origin/dev:db/migrations/20261015120000_order_execution_conditioning_actions` llevan el mismo prefijo.
  Por nombre, la de dev se ordena antes («e» < «p»), así que se aplica en un orden coherente. Aun así,
  conviene renombrar la de QC-281 a un timestamp posterior a `20261015120100` al integrar dev. El test de
  esquema apunta a la ruta y habría que actualizarlo también.
- **m3 — El diálogo copia las etiquetas de motivo.** `PACKING_FINISH_DIALOG_TEXTS.reasons` duplica las
  etiquetas en vez de derivarlas de `movementReasonLabel`, que es la fuente que nombra el design
  (`## Lo que ya existe` y D7). Hoy coinciden, y el test de la línea 536 las fija como literal. Si cambia
  una etiqueta compartida, el diálogo no se entera. El implementer lo explica en la tanda 4. Se puede
  dejar como deuda: pasar la etiqueta a `lib/shared/ui` o recibirla por prop.
- **m4 — El texto de QC-195 R25 queda superado sin ninguna nota.**
  `specs/QC-195-envases-del-pedido-como-productos/requirements.md` R25 sigue diciendo
  `insufficient_material`. Bastaría una enmienda o una nota que remita a QC-281 R18.
- **m5 — El zod exige al menos una línea (`lines: z.array(...).min(1)`).** Un pedido `EN_EMPAQUE` sin
  ninguna línea de reparto ya no se puede terminar desde `asignaciones`, aunque `pedidos` sí lo admite
  (`order-packing.int` T14). Es lo que dice el design § 2.2, y Comenzar ya exige reparto (QC-170), así que
  solo afecta a datos heredados, si los hubiera. Lo dejo como observación.
- **m6 — `tests/integration/proveedores/catalog-line.int.test.ts` R32 no está en el baseline.**
  `tests/baseline-rojos.json > archivos` está vacío. En local falla («.toMatch() expects to receive a
  string, but got object»). El diff no toca `proveedores`. El arreglo de dev f2be3eb8 ya está en la rama,
  y su mensaje atribuye el rojo al idioma del servidor Postgres local. En CI (en_US) debería salir verde.
  Si sale rojo, no es de esta feature, pero no está listado en el baseline y el gate lo trataría como nuevo.
- **m7 — A la bitácora le faltan las secciones de T1–T6.** `progress/impl_…md` empieza en T10, aunque el
  mapa consolidado de T13 cubre todo. Es solo de forma.

## Veredicto

**RECHAZADO**: 1 bloqueante (B1) y 7 menores.

Lo que falta para OK: resolver B1. Basta la opción (b), que es solo documentación en `design.md`. El resto
de la feature está sólido: servidor, migración, rollback, autorización, aislamiento y trazabilidad R1–R33.
Antes del PR, además, hay que integrar `origin/dev` y volver a verificar R23 y R25 (m1, m2).
