# Review QT-313 — pedido-con-varias-recetas-backend (F2.2, vuelta 1)

- Rama: `feature/QT-313-pedido-con-varias-recetas-backend`, HEAD `d426eee16`, árbol limpio.
- Base del diff: `origin/dev` (rama de integración, `arnes.config.json`), merge-base `ec9fa49e2`, 29 commits.
  (El leader pidió comparar contra `master`, pero el merge-base con `master` arrastra 5.706 commits de `dev`. El diff
  real de la feature es contra `dev`.)
- El veredicto va aquí, en `progress/review_QT-313.md`, porque eso dice `AGENTS.md` F2.2 y no `specs/.../review.md`.
- Grafo: no se usó. La exploración se hizo con Grep/Read y git.

## Verificación ejecutada por el reviewer (salida real)

| Qué | Resultado |
|---|---|
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | `0 errors, 11 warnings` (todos previos, en tests) |
| `pnpm exec vitest run guard --maxWorkers=1 --testTimeout=120000` | `Test Files 87 passed (87)`, `Tests 1333 passed \| 22 skipped` |
| Unit citados en la trazabilidad + control QC-215 (12 archivos: `update-order-lines`, `update-order`, `orders-header-only`, `order-totals`, `order-line-diff`, `cancel-order-line`, `create-order-lines`, `order-input-lines`, `asignaciones/order-state`, `pedidos-ui/order-row-actions`, `whatsapp-chat-context`, `order-classification`) | `12 passed`, `452 passed` |
| `.int`, primer lote: `order-lines-blocked-retry`, `orders-drop-line-columns-migration`, `company-scope-queries`, `order-lines-flow` | `4 passed`, `34 passed` |
| `.int`, segundo lote: `order-lines-execution`, `order-lines-use-cases`, `order-lines-state`, `order-lines-repository`, `list-query-orders` | `5 passed`, `75 passed` |
| Nombres de test de la tabla T18 (script: 77 nombres únicos buscados en `tests/` y `e2e/`) | 76 encontrados literalmente; el único que no aparece es «QT-313 R37, R39: …», que está abreviado y es el mismo test completo de la fila R39 |
| `it.skip` / `.todo` / `.only` añadidos por el diff | ninguno |

No se corrió nada más: ni la suite completa, ni el E2E, ni el `related` de UI completo (lo corre CI).

## Checklist

### Proceso (`.claude/agents/reviewer.md`)
- [x] **1. Trazabilidad.** R1–R56 (incluidos R48–R56) tienen al menos un test real con `R<n>` en el nombre, y cada
  uno comprueba de verdad lo que dice su requisito. El mapa está en `progress/impl_QT-313.md > T18`.
- [x] **2. Tasks.** Las 24 de `tasks.md` están marcadas `[x]`; no queda ningún `[ ]`.
- [ ] **3. Checkpoints.** Fallan dos puntos: los comentarios (hallazgo B1) y la salida literal del E2E (m6). El
  resto, abajo.
- [x] **4. Verificación ejecutable.** Ver la tabla de arriba.
- [ ] **5–11. Reglas del proyecto.** Falla el 9, los comentarios (B1).

### CHECKPOINTS.md
- [x] `requirements.md` con requisitos EARS numerados.
- [x] `design.md` con alternativas descartadas (§ 10).
- [x] `design.md` abre con `## Lo que ya existe`, y el diff no re-crea nada de esa lista: reutiliza
  `OrderPresentationLine`, `MaterialReservations`, `order-transitions` y `resolve-ingredients-cost`.
- [x] Todas las tasks en `[x]`.
- [x] Assignee (Camilo) y rama publicada con candado (`progress/features/QT-313.md`).
- [x] Cada `R<n>` mapea a un test, y el mapa está en `progress/impl_QT-313.md`.
- [x] Typecheck y lint en verde.
- [ ] `gate-completo` en CI: no aplica todavía, porque aún no hay PR.
- [~] El flujo crítico (movimientos de inventario) tiene E2E: `e2e/pedido-con-varias-recetas.spec.ts`. Pero la bitácora
  da «en verde» sin pegar la salida local literal (m6). WebKit queda para CI.
- [x] Sin dependencias nuevas: el diff no toca `package.json`.
- [x] Sin secretos ni valores de entorno hardcodeados. No hay webhooks.
- [ ] `./init.sh` del worktree: lo corre el leader.
- [ ] `progress/features/QT-313.md > Cierre`: está vacío, y es tarea del leader al cerrar.

### docs/checkpoints-proyecto.md
- [x] Tabla nueva `order_lines` con `company_id`, FK compuesta con la empresa del pedido (R2), RLS `ENABLE` + `FORCE`
  (migración `20261103120000_order_lines`, línea 172), y el test «R2: order_lines tiene RLS activada y forzada».
- [x] Las consultas nuevas filtran por empresa:
  - `aliveLinesWhere` acota la línea y el pedido;
  - el SQL crudo del orden por cantidad repite `company_id` en `orders` y en `order_lines`.
  Hay test de rechazo cruzado: `company-scope-queries.int` › «el orden por cantidad con una pagina corta tampoco cuela
  filas ajenas», y R43 en `order-lines-repository.int`.
- [x] Los permisos se validan en el dominio y tienen test (R30).
- [x] Las cinco migraciones nuevas tienen `down.sql`. R9 prueba la bajada de la última.
- [x] Capas: las guardias están en verde. No se usa el cliente de Supabase para datos de negocio. `lib/` sin carpetas
  nuevas en la raíz.
- [x] La lógica de negocio está en el dominio. El puente `order-actions.ts` solo traduce el `FormData` (+57/-17 líneas).
- [x] UI: solo literales de mapas existentes para `PARCIAL` (design § 7). No hay componentes nuevos, cambios visuales
  ni filas de catálogo, así que no hace falta pase `/design`.

### perfil-agentes > reviewer
- [x] 5 Calidad y seguridad. · [x] 6 Multiplataforma (sin cambio visual). · [x] 7 Dependencias (ninguna).
- [x] 8 Aislamiento por empresa. · [ ] **9 Comentarios: BLOQUEANTE** (B1). · [x] 10 Duplicados. · [x] 11 Diseño.

## Hallazgos

### B1 — BLOQUEANTE · Comentarios de producción con `R<n>` / `QT-`/`QC-` en líneas que añade el diff
La regla está en `docs/perfil-agentes.md > reviewer` punto 9 y en `> backend_dev > Comentarios` punto 1. Hay ocho
líneas añadidas o modificadas en cinco archivos:

- `lib/modules/asignaciones/domain/order-state.ts:12`: `… (QT-313 R55)`
- `lib/modules/asignaciones/domain/order-state.ts:86`: `// QT-313 R55: un PARCIAL no tiene fila propia…`
- `lib/modules/pedidos/adapters/driven/persistence/order-catalog-prisma.ts:59`: `/** QT-313 R55: solo las lineas ACTIVAS…`
- `lib/modules/pedidos/domain/order-catalog.ts:31`: `… admite responsables (R55). */`
- `lib/modules/pedidos/domain/update-order.ts:65`: `… sin cambiar sus datos (R56). */`
- `lib/modules/pedidos/domain/update-order.ts:95`: `… reintentan su reserva (R56): …`
- `lib/modules/pedidos/domain/update-order.ts:134`: `// … que reintenta su reserva (R56).`
- `lib/modules/pedidos/adapters/driven/persistence/order-prisma.ts:301`: `… el numberRange de QC-55 emite number.`
  La referencia ya existía en la línea vieja, pero el diff modifica esa línea.

**Qué falta:** quitar de esas líneas las referencias `QT-313`, `R55`, `R56` y `QC-55`, y dejar solo el porqué. Si
alguna se queda sin contenido, se borra entera. Es un cambio sin efecto en el código: commit aparte o junto con la
corrección, a elección del implementer.

### Puntos que pidió juzgar el leader

**1. Índices de terminados (T15) — `menor`, no bloqueante.**

`orders_company_finished_idx` y `orders_company_terminated_idx` se borran y no se rehacen en `order_lines`. Ahora los
listados de terminados (`listAliveOrderSummariesInCompany`, ordenaciones `finished_recent_first` y
`unfinished_then_recent`) leen `order_lines`.

No quedan sin índice:
- el filtro `company_id + status IN (…) + deleted_at IS NULL` lo cubre `order_lines_company_status_idx`;
- lo que se pierde es el top-N ordenado por índice: Postgres ordena en memoria todas las líneas TERMINADO/ENTREGADO de
  la empresa, y ese conjunto crece con el histórico;
- además, el desempate ya ordena por columnas de `orders` (`order_year`, `order_sequence`) vía join, así que un índice
  gemelo solo serviría como orden incremental, no como cobertura total.

El spec no lo exige:
- design § 1.2 manda rehacer los índices de `list_query_indexes`, y T15 lo hizo con la cantidad
  (`order_lines_quantity_idx`);
- los dos índices de terminados vienen de otras migraciones (`orders_finished_at`, `order_terminated_finished_index`).

Recomendación: anotarlo en `progress/deudas.md` o abrir ficha para
`order_lines (company_id, finished_at DESC NULLS LAST) WHERE deleted_at IS NULL AND status = 'ENTREGADO'`, y lo mismo
para `'TERMINADO'`, con un `EXPLAIN` sobre un volumen realista. No bloquea el merge.

**2. T14a, `only-order-line.ts` y `lineId` solo en `AssignedOrderSummary` — cumple el «Hecho».**

Design § 5 dice literalmente que las Server Actions «pasan la línea única del pedido» hasta QT-315, y que
`AssignedOrderSummary` gana `lineId` («con un pedido de una línea, la fila es la de hoy más `lineId`»). Los tests del
«Hecho» existen y pasan: R31, R32, R35–R38, R19 y R45 en `order-lines-execution.int` (15+ casos, verde en mi corrida).
Los tests de CHECK de `orders` se retiraron en T15 junto con los propios CHECK, como manda T15.

- `menor` **m1:** R35 («quien es responsable … DEBE poder ejecutar cualquiera de sus líneas») queda corto desde
  `asignaciones`:
  - con dos líneas en el mismo estado, los casos de uso responden `invalid_input` (`onlyLineOf`);
  - el puerto `OrderCatalog` ya acepta `lineId`, pero los casos de uso de `asignaciones` no;
  - hoy no se puede dar el caso, porque hasta QT-314 no existen pedidos de varias líneas.

  QT-315 tiene que añadir `orderLineId` a la entrada de esos casos de uso y retirar `only-order-line.ts`. Conviene
  dejarlo escrito en la ficha QT-315 o en `progress/deudas.md`.

**3. T16b / R56, cambio de comportamiento al editar solo el cliente — correcto.**

Está dentro del spec. La decisión cerrada «Reintento de reserva al editar» (2026-11-06) dice «toda línea viva en
`BLOQUEADO` reintenta… Vale para una y varias recetas», y R56 lo hace requisito. Que el control QC-215 R38 en
`update-order.test.ts` deje de listar `BLOQUEADO` es la consecuencia directa, y el caso lo cubre R56 (d) en
`update-order-lines.test.ts`; el archivo pasa en mi corrida.

- `menor` **m2:** la bitácora dice que el caso «queda comentado», pero en realidad se quitó `BLOQUEADO` de la lista del
  `it.each` y se dejó un comentario. Basta con precisar el texto de la bitácora. El comentario es de test, no de
  producción, así que no aplica la regla 9.

**4. `OrderView` desde `lines[0]` y orden por cantidad en dos pasos — sin problema de aislamiento.**

- Aislamiento: el `where` de Prisma lleva `orderCompanyScope` como primer término del `AND`. El SQL crudo acota por
  `company_id` en `orders` y en la subconsulta de `order_lines`, y la relectura por `id IN (…)` usa ids que ya salieron
  de la consulta acotada. El rechazo cruzado está probado (`company-scope-queries.int`, verde).
- `menor` **m3:** `orderIdsByFirstLineQuantity` trae a memoria todos los ids que cumplen el `where`, sin límite, y los
  pasa como `ANY(uuid[])`. En una empresa con muchos pedidos crece linealmente. Se podría resolver con un solo SQL o con
  `IN (subconsulta)`. Es rendimiento, no corrección.
- `menor` **m4:** en un pedido de varias líneas, los campos planos de `OrderView` salen de `lines[0]`, aunque esa línea
  esté cancelada. Design § 7 lo limita a pedidos de una línea, y hasta QT-314 no se pueden crear de varias. QT-314 lo
  sustituye: conviene anotarlo en su ficha.

**5. Trazabilidad — OK.** Ver el checklist, punto 1.

### Otros
- `menor` **m5:** `insertAliveOrder` conserva un camino muerto que escribe reparto sin línea (desviación 1 de T14e).
  La base lo rechazaría. Conviene borrarlo en QT-314 o anotarlo como deuda.
- `menor` **m6:** CHECKPOINTS pide la salida local del E2E de flujo crítico en `progress/impl_QT-313.md`. T16 solo dice
  «en verde, según el informe del backend_dev», sin las líneas de resumen de Playwright. Hay que pegar la salida real de
  `pnpm exec playwright test e2e/pedido-con-varias-recetas.spec.ts` (chromium). WebKit queda para CI, como ya consta.
- `menor` **m7:** el timeout de `guard-asignacion-componentizada` (20 s) no es de esta feature; en mi corrida pasó con
  `--testTimeout=120000`. Ya está acordado anotarlo como deuda ajena en el cierre.

## Veredicto

**RECHAZADO**, por un único bloqueante, **B1** (comentarios con `R<n>`/`QT-313`/`QC-55` en ocho líneas añadidas o
modificadas de producción).

Lo funcional está bien: trazabilidad completa, tasks cerradas, typecheck, lint, guardias, los unit y los `.int`
revisados en verde, aislamiento por empresa correcto y R56 dentro del spec.

La vuelta 2 puede acotarse al rango de la corrección. Hay que comprobar que esas ocho líneas quedan sin referencias y
que no aparecen otras, y de paso cerrar m6 (la salida del E2E en la bitácora). Los menores m1–m5 y m7 no bloquean: se
anotan como deuda o en las fichas QT-314 y QT-315.
