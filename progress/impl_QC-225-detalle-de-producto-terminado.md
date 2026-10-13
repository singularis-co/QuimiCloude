# QC-225 — detalle-de-producto-terminado · bitácora del implementer

## Tanda 1 (2026-10-13): T0, B1, B2, B3

Las cuatro tareas están marcadas `[x]` en `tasks.md`. Todas las hizo `backend_dev`.

Commits:
- `2d751f59` T0: contrato publicado. También cierra P1 en `requirements.md`: sale de «Preguntas
  abiertas» y entra una fila fechada en «Decisiones cerradas».
- `8822bc4c` B3: cuerpos de los casos de uso.
- `d8e05b02` B1: adaptador Prisma de lectura de `inventario`.
- `033a86a2` B2: directorio de entregas de `pedidos`.

### Archivos

Creados:
- `lib/modules/inventario/domain/finished-product-detail.ts`
- `lib/modules/inventario/domain/get-finished-product.ts`
- `lib/modules/inventario/domain/list-finished-product-batches.ts`
- `lib/modules/inventario/domain/list-finished-product-movements.ts`
- `lib/modules/inventario/domain/list-finished-product-deliveries.ts`
- `lib/modules/inventario/domain/list-finished-product-costs.ts`
- `lib/modules/inventario/domain/list-produced-products.ts`
- `lib/modules/inventario/ports/finished-product-detail-repository.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-product-detail-prisma.ts`
- `lib/modules/inventario/adapters/driving/finished-product-actions.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-directory-prisma.ts`
- `tests/fixtures/finished-product-detail.ts`
- Tests unitarios en `tests/unit/inventario/`:
  - `finished-product-detail.test.ts`
  - `get-finished-product.test.ts`
  - `list-finished-product-batches.test.ts`
  - `list-finished-product-movements.test.ts`
  - `list-finished-product-deliveries.test.ts`
  - `list-finished-product-costs.test.ts`
  - `list-produced-products.test.ts`
  - `finished-product-actions.test.ts`
- `tests/integration/inventario/finished-product-detail.int.test.ts` (13 casos)
- `tests/integration/pedidos/order-delivery-directory.int.test.ts` (10 casos)

Modificados:
- `lib/modules/inventario/index.ts`
- `lib/composition/index.ts`: seis claves nuevas en la fachada `inventario`, el adaptador real y
  `finishedDeliveryDirectory` real.
- `lib/shared/routes.ts`: añade `finishedProductDetailRoute`.
- `tests/unit/inventario/schema/inventario-schema.test.ts`: el censo de factorías pasa de 18 a 24.
- `tests/unit/identity/session-once-per-request-actions.test.ts`: fila nueva. Entró en T0 y no en
  B3, porque el censo compara contra el disco.
- `tests/unit/pedidos/module-contract.test.ts`: `DUENOS_DEL_CLIENTE` gana el adaptador de B2. **No
  estaba en «Archivos esperados»**; se añadió allí con fecha.
- `tests/integration/aislamiento.json`: las dos suites nuevas, en modo `commit`, porque los
  adaptadores leen con el cliente global.

### Mapa R<n> → test (lo cubierto en esta tanda; el mapa completo se cierra en TZ)

| R | Test |
|---|---|
| R2, R3 | `tests/unit/inventario/{get-finished-product,list-finished-product-*,list-produced-products}.test.ts`; `finished-product-actions.test.ts` |
| R4 | `list-finished-product-deliveries.test.ts`, `list-finished-product-costs.test.ts` |
| R5 | los unitarios de los casos de uso; `finished-product-detail.int.test.ts` (`findAliveFinished`) |
| R10 | `get-finished-product.test.ts` |
| R11, R12 | `finished-product-detail.test.ts` (`summarizeFinishedStock`), `get-finished-product.test.ts` |
| R13, R14 | `list-finished-product-batches.test.ts`, `finished-product-detail.int.test.ts` |
| R15–R18 | `list-finished-product-movements.test.ts`, `finished-product-detail.int.test.ts` |
| R19 | `list-finished-product-deliveries.test.ts`, `finished-product-detail.int.test.ts`, `order-delivery-directory.int.test.ts` |
| R20 | `list-finished-product-deliveries.test.ts` |
| R21, R22 | `finished-product-detail.test.ts` (`productionCostTotal`), `list-finished-product-costs.test.ts`, `finished-product-detail.int.test.ts` |
| R23 | los unitarios de los listados, `finished-product-detail.int.test.ts` |
| R25 | `finished-product-detail.int.test.ts`, `order-delivery-directory.int.test.ts`, `finished-product-actions.test.ts` |
| R27, R28 | `list-produced-products.test.ts`, `finished-product-detail.int.test.ts` |
| R33 | `list-finished-product-deliveries.test.ts`, `order-delivery-directory.int.test.ts` |
| R34 | `list-finished-product-deliveries.test.ts`, `order-delivery-directory.int.test.ts` |
| R35 | `list-finished-product-movements.test.ts`, `finished-product-detail.int.test.ts` |
| R36 | `list-finished-product-deliveries.test.ts` (backend; la UI va en F) |

Pendientes de F/TI: R1, R6–R9, R24, R26, R29–R31. La parte de UI de R33–R36 también queda para F.

### Salida de la verificación

Typecheck y lint:
- `pnpm run typecheck`: exit 0. Antes, T0 tuvo que correr `pnpm exec prisma generate`, porque el
  cliente del worktree no estaba al día con las tablas de QC-224.
- `pnpm exec eslint <archivos tocados>`: sin avisos.

Unitarios (los doce archivos de la tanda, en una sola corrida), con sus censos:
```
 Test Files  12 passed (12)
      Tests  229 passed (229)
```

Guardias, `pnpm exec vitest run guard`:
```
 Test Files  75 passed (75)
      Tests  1050 passed | 20 skipped (1070)
```

Integración, cada suite contra su copia efímera `qct_qc225_…`, sacada de la plantilla
`qct_tpl_7c42b3e164a6`. Al servidor se llegó vía `qc225_detalle_producto` en `localhost`; nunca se
usó `QuimiCloude`. Ningún `.env` escrito.
- `finished-product-detail.int.test.ts`: 13 passed.
- `order-delivery-directory.int.test.ts`: 10 passed.

Otros censos corridos y en verde, sin cambios:
- `inventario/{module-contract,qc81-alcance,qc91-alcance,qc121-alcance,qc171-alcance,authorization,company-scope,movement-reason,qc195-contrato-tipos}`
- `clientes/scope`
- `pedidos/{company-scope,order-delivery-append-only}`
- `tests/unit/composition`

### Decisiones a validar

- **Entregas (B3).** Design 2.3 pide un solo `Promise.all` con la página y `summarizeDelivered`, y
  también no llamar con `total === 0`. Las dos cosas no se pueden cumplir a la vez. Se lee primero
  la página y después, en paralelo, `summarizeDelivered`, `findDeliveryDetails` y los números de
  pedido. Los clientes van al final.
- **Orden de validación de los listados.** Permiso → uuid → `findAliveFinished` → esquema de
  página. Una página inválida sobre un producto inexistente responde `product_not_found`.
- **`listProducedProducts`.** Omite el par (pedido, presentación) que tiene más de un producto y
  junta los duplicados. Con más de 25 ids responde `invalid_input`.
- **Adaptador B1.**
  - Sus funciones se nombran distinto que los métodos del puerto; se mapean en `composition`.
  - `listProductionCosts` ordena por el `createdAt` del asiento `production`.
  - El origen de cada lote se lee con `take 1` sin `orderBy`; se apoya en que hay un asiento
    `production` por lote.
- **Formato (T0).**
  - `total` y `withoutPackage` salen con 4 decimales; los restos, sin ceros a la derecha.
  - Un lote con contenido 0 cuenta como «sin envase».
- **Nombres de tests sin R en `tasks.md`.**
  - «más de 25 ids» va como R27;
  - «lee la sesión una vez» va como R25.
- **Sin hacer.** No se corrió el `EXPLAIN` de `inventory_movements` (design §3).
