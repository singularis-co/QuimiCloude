# QC-282 — entrega-a-varios-clientes · review (F2.2)

> Reviewer, 2026-10-15. Rama `feature/QC-282-entrega-a-varios-clientes` en `aad4d9cc`, diff contra
> `origin/dev` (22 commits, 90 archivos). Las decisiones del humano del 2026-10-15 (ficha) son
> vinculantes y no se reabren: P1 migrar, P2 tarjeta con subbloques, anulación sin nada marcado,
> tope por lote sumando clientes, R38/R40 de `scope.test.ts` afinados, imports de R20, texto del
> panel de QC-262 R20, E2E solo en CI.
> MCP del grafo: no consultado; revisión con Grep/Read y `git diff`.

## Veredicto: **APROBADO**

Ningún bloqueante. Un hallazgo **mayor** que es condición de merge (el E2E y los `.int` solo se
ven en verde en `gate-completo`) y cinco **menores**.

## Verificación ejecutada por el reviewer

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | 0 errores, 7 avisos (ajenos: `confirm-catalog-import.test.ts`, `order-service.test.ts`) |
| `vitest run` de los 24 unit/ui que toca el diff + `identity/permissions.test.ts` | 25 archivos, 600 passed, 0 failed |
| `vitest run` paridad (incluye snapshot de `Checkbox`) + `pedidos/module-contract` + `search-order-customer-options` (R10) | 24 archivos, 434 passed |
| `pnpm exec vitest run guard` | 76 archivos, 1066 passed, 20 skipped |
| `.int` y E2E | **no corridos** (restricción del leader: disco lleno, nunca contra QuimiCloude). Leídos, no ejecutados |
| `./init.sh` | no corrido: se corta por el cupo (excepción aceptada por el humano) |

## Checklist

### Especificación (CHECKPOINTS.md)
- [x] `requirements.md` con R1–R48 en EARS; preguntas abiertas: ninguna.
- [x] `design.md` con alternativas descartadas (§11, A1–A6).
- [x] `tasks.md`: las 12 tasks (T0, B1–B4, F1–F4, TC, TI, TZ) en `[x]`.
- [x] `design.md` abre con `## Lo que ya existe` (board, specs y código; catálogo consultado y paso
      de la regla de decisión por pieza). El diff no re-crea nada de esa lista: amplía
      `deliver-order`, `void-delivery`, `order-delivery.ts`, el sheet, la lista y el diálogo;
      `Checkbox` se extiende (paso 2) y las dos piezas nuevas son composiciones (paso 3) de ruta.

### Equipo
- [x] Assignee y rama publicada (ficha, Evaluación). Cupo excedido: excepción del humano.

### Trazabilidad
- [x] `progress/impl_QC-282.md` tiene el mapa R → test.
- [x] Cada R tiene un test concreto que lo comprueba (detalle abajo). Los R con test solo `.int`
      o E2E no los he podido ejecutar (ver M1).

### Calidad de código
- [x] Typecheck y lint sin errores (corridos).
- [ ] `gate-completo` en verde: pendiente del PR (M1).
- [~] Flujo crítico (movimiento de inventario) con E2E: `e2e/entrega-a-varios-clientes.spec.ts`
      existe y cubre los cuatro puntos de R47; **sin salida local en verde** por decisión del
      humano (corre en CI). Ver M1.
- [x] Sin dependencias nuevas: `package.json`, `pnpm-lock.yaml` y `docs/dependencias.md` sin diff
      (R48); `guard-dependencias-aprobadas` verde.

### Seguridad y configuración
- [x] Sin secretos ni valores de entorno hardcodeados en el diff.
- [x] Sin webhooks.

### checkpoints-proyecto.md
- [x] Multiplataforma: inputs `text-base` (16 px) y `min-h-11`; botones «Quitar» y «Añadir cliente»
      con `touch`; casillas del diálogo con `touchTarget` y filas `min-h-11`; sin `100vh` ni
      `:hover` como única vía. Implementer declara comprobación visual a 1440/820/390 px.
- [x] `CATALOGO.md`: fila de `Checkbox` actualizada (punto de extensión `indeterminate`, celda
      Diseño → `EntregaVariosClientes.dc.html`); `guard-catalogo-de-componentes` verde.
- [x] Pase `/design` aprobado y citado en `design.md` (tres tableros en `docs/diseno/canvas/`).
- [x] Aislamiento: no hay tabla nueva. La columna nueva `order_delivery_lines.customer_id` lleva FK
      compuesta con `company_id` (R30). `listDeliveryLinesByBatchIds` filtra por empresa en la
      línea y en la entrega, con rechazo cruzado probado (`order-delivery-directory.int.test.ts:571`,
      `:578`, `:584`).
- [x] Permisos en `domain/`: R2 y R3 antes de validar, con tests de puertos sin llamar.
- [x] RLS: las dos tablas siguen con `ENABLE` + `FORCE` tras UP y DOWN (lo afirma el `.int` de la
      migración, `rlsForced: [true, true]`).
- [x] Acceso a datos solo por adaptadores `driven` Prisma.
- [x] Migración con `down.sql`.
- [x] Hexagonal: `domain/` no importa framework; `pedidos` lee clientes por su barrel
      (`requireAliveCustomer` → `CustomerCatalog`); composición actualizada.
- [x] Comentarios: ninguna línea añadida en producción (`app`, `lib`, `components`, `db`) cita
      `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada».

## Foco pedido por el leader

### 1. Trazabilidad (R → test, comprobado por nombre de caso y lectura)

| R | Test que lo comprueba |
|---|---|
| R1 | `identity/permissions.test.ts` (sin diff, verde) + `guard-permisos-sembrados` |
| R2 | `deliver-order.test.ts` «QC-282 R2: sin entregas.modificar…» |
| R3 | `void-delivery.test.ts` «R3: sin entregas.anular, la forma nueva y la vieja…» |
| R4, R5 | `order-delivery-sheet.test.tsx` «R4: sin borrador…», `:289` «R5: …cliente vacío» (it.each) |
| R6, R7 | sheet «R6: el bloque lista…», «R7: ni la fecha de vencimiento ni la de entrada…» |
| R8, R9 | sheet «R8…», «R9…» ×2; `order-delivery-draft.test.ts` «R8…», «R9…» |
| R10 | sheet «R10: …purpose=deliver»; `search-order-customer-options.test.ts:130` (verde) |
| R11, R12 | `order-delivery-summary.test.tsx` ×3; sheet «R11…» ×2, «R12: …no envía» |
| R13–R15 | `order-delivery.test.ts` (`packagesLeftInBatch`); sheet «R13», «R14» ×2, «R15» (afirma «Solo hay 4» y `toBeDisabled`) |
| R16–R18 | `order-delivery.test.ts` (`checkDeliveryBlocks`, orden de error); sheet «R16» ×2, «R17», «R18» |
| R19 | sheet «R19: envía una sola entrega con la clave del borrador y cada bloque…» |
| R20 | `order-delivery.test.ts` «QC-282 R20: $ruta importa $nombres de $desde» + caso sintético del detector |
| R21–R29 | `deliver-order.test.ts` (bloque QC-282); `order-delivery.int.test.ts:423–636`; `order-delivery-concurrency.int.test.ts:200`; R24/R26 también en `finished-goods-dispatch-prisma.test.ts`, `finished-goods-dispatch.int`, `ledger-cuadre.int` |
| R30 | `order-delivery-constraints.int.test.ts:478`, `:516`, `:562`; unit del SQL |
| R31, R32 | `order-delivery-lines-customer-migration.int.test.ts:427–558` (5 casos) + unit del SQL |
| R33–R35 | `list-order-deliveries.test.ts`; `order-delivery-list.test.tsx`; `order-delivery-void-repository.int` |
| R36–R38 | `delivery-void-dialog.test.tsx` «R36» ×2, «R37» ×2, «R38» ×2; `checkbox-indeterminate.test.tsx` |
| R39–R41 | `void-delivery.test.ts`; `order-delivery-void.int.test.ts:569`, `:603`, `:634` |
| R42 | `order-delivery-void.int.test.ts:664`; `finished-goods-return-prisma.test.ts`; `finished-goods-return.int`; `ledger-cuadre.int` |
| R43, R44 | `list-finished-product-deliveries.test.ts`; `finished-product-tables.test.tsx`; `order-delivery-directory.int:451–513` |
| R45, R46 | `order-delivery-draft.test.ts` (v2, v1, ajuste); sheet «R45» ×3, «R46» ×3 (incluye «no muestra el aviso» por exceso) |
| R47 | `e2e/entrega-a-varios-clientes.spec.ts:588` (escrito, no ejecutado en verde) |
| R48 | sin diff en dependencias; `guard-dependencias-aprobadas` |

Ningún R sin test.

### 2. Migración `db/migrations/20261015130000_order_delivery_lines_customer/`

- **Corrección de datos (UP).** Aborta antes de tocar nada si hay entregas sin líneas
  (`migration.sql:14-27`). El `UPDATE` cruza la línea con su entrega por `id` **y** `company_id`
  (`:30-33`). El `SET NOT NULL` (`:34`) garantiza que ninguna línea queda sin cliente: si alguna no
  cruzara, la migración falla entera. FK compuesta `(company_id, customer_id)` → `customers`
  (`:36-37`), índice, unicidad nueva `(delivery_id, customer_id, batch_id)` y, al final, se quita la
  columna de la entrega. Correcto, y coincide con design §1.1.
- **DOWN aborta con más de un cliente.** `down.sql:19-35` cuenta las entregas con
  `count(DISTINCT customer_id) > 1` y lanza `RAISE EXCEPTION` antes de cualquier DDL. También aborta
  si hay entregas sin líneas (`:37-41`). El relleno usa `DISTINCT (delivery_id, company_id,
  customer_id)`, que con la comprobación previa da una fila por entrega. Repone los nombres de
  QC-223. `db:rollback` lo aplica en una transacción (`scripts/db-rollback.ts:113`).
- **RLS.** `NO FORCE` al principio y `FORCE` al final de UP y DOWN, para que el dueño vea las filas
  en el `UPDATE`. Es el mismo patrón que las migraciones de datos anteriores (p. ej.
  `20260915120000_orders_company_scope`). `ENABLE` no se toca. Si la migración aborta, la
  transacción deshace también el `NO FORCE`. El `.int` afirma `relforcerowsecurity = true` en las
  dos tablas tras UP, tras DOWN y tras el ciclo DOWN→UP.
- **Tests.** Los cinco casos del `.int` corren sobre una copia fiel de las siete tablas en un
  esquema desechable, con un `expect(catalog)` contra `public`: up con anulaciones y otra empresa,
  up abortado, down + re-up idéntico, down abortado con dos clientes y down abortado sin líneas.
  Comprueban mensaje, forma y *snapshot* intacto. Están bien planteados; no los he ejecutado (M1).

### 3. Detectores R38 y R40 de `tests/unit/clientes/scope.test.ts`

- **R40** (pedidos no nombra la tabla `customers`). Cambia de la palabra `\bcustomers\b` a su
  **uso como tabla**: un literal entre comillas que no es acceso indexado (`:578`) o el nombre tras
  `FROM|JOIN|INTO|UPDATE|TABLE|REFERENCES` (`:579`). Conserva `prisma.customer` y el import
  profundo. Los usos reales (SQL con y sin comillas, con esquema, `'customers'`, modelo Prisma e
  import profundo) siguen en rojo, con casos sintéticos positivos y negativos (`:854-874`). No
  debilita lo que la guardia protege: el acoplamiento por la tabla o el modelo.
- **R38** (app/ no nombra clientes). Dos cambios:
  - la tabla se busca por uso (igual que R40);
  - el marcador `'Clientes'` (decisión P7, opción A) se sustituye por la constante de ruta, la
    etiqueta importada del sidebar, la entrada de menú con `href|route|path` y el enlace
    `<Link|a>Clientes</…>` (`:613-622`).

  `/clientes`, el permiso y cualquier import del módulo (`/clientes\b`) siguen detectándose, con 10
  casos sintéticos positivos. La guardia pierde cobertura solo donde la decisión lo pedía (la
  etiqueta visible); el residuo está en m3.
- El detector de E2E (R28) no cambia; solo se añade el spec nuevo a la lista cerrada, con nota.
- Las aserciones previas siguen intactas. `scope.test.ts` en verde (corrido).

### 4. Concurrencia y validación en servidor del tope por lote

- `dispatchFinishedGoods` (`product-prisma.ts:1331-1418`):
  - bloquea el producto (`FOR NO KEY UPDATE`);
  - **suma por lote** las asignaciones de todos los clientes (`:1344-1347`);
  - hace **un** decremento condicional `stock >= suma` por lote, que es atómico en Postgres;
  - si no alcanza, devuelve `insufficient`.

  La suma por lote evita el caso en que dos asignaciones del mismo lote pasen cada una el
  condicional y entre las dos dejen el stock negativo. Escribe un asiento por lote (los índices
  únicos del libro se conservan) y devuelve una línea por asignación, en el mismo orden, con la
  misma multiplicación exacta: la suma de las líneas cuadra con el asiento.
- `deliverOrder` (`deliver-order.ts`):
  - comprueba que inventario devuelva una línea por asignación; si no, lanza y deshace todo;
  - cualquier `insufficient` lanza `DeliveryBatchInsufficientError` dentro de `unitOfWork`, así que
    no queda nada de la entrega (R24, R29);
  - el tope por presentación usa `checkDelivery` sobre `flattenBlocks` con el pedido bloqueado
    (R23).
- Concurrencia: `order-delivery-concurrency.int.test.ts:200` cubre dos pedidos que reparten a la
  vez el mismo lote entre dos clientes. El orden de bloqueo pedido → producto → lote es el de
  QC-223.

### 5. UI frente a los tableros `EntregaVariosClientes*.dc.html`

Textos comprobados contra el tablero de escritorio:
- sheet: «Añadir cliente», «Quitar», «Por entregar», «Completa / Faltan N / Sobran N», «Solo hay N»;
- errores de bloque: «Elige el cliente.», «Este cliente ya está en la entrega.», «Este cliente no
  lleva envases…»;
- aviso de stock: «Entre todos los clientes se pasa de lo disponible en un lote. Baja los envases
  para poder entregar.»;
- columnas «Lote · Disponibles · Entrada», sin «Vence»;
- lista: «Fecha · Clientes · Envases · Entregó»;
- diálogo: «Anular todo lo de X»;
- tab Entregas: columna «Presentación».

La descripción del panel es la de QC-262 R20 y el tablero se corrigió para que coincida
(`1adaf5a9`). Estructura según design §7: bloques, resumen, diálogo con `fieldset` por cliente y
casilla de grupo con `indeterminate`. No he podido ver el render (sin navegador); el implementer
declara la comprobación visual en tres anchos.

## Hallazgos

### M1 — mayor (condición de merge) · `e2e/entrega-a-varios-clientes.spec.ts:588`, `tests/integration/**`
El E2E de R47 (flujo crítico: movimiento de inventario) **nunca se ha visto en verde**. La única
corrida local falló por entorno, sin evaluar ninguna aserción (impl, sección TI). Por decisión del
humano corre solo en `gate-completo`. Tampoco he podido ejecutar los `.int` que trazan R21–R32 y
R39–R44 (restricción de esta revisión); el implementer los declara en verde. Además, los specs
E2E de QC-223/224/225 se enmendaron (diálogo sin nada marcado, cliente en las líneas) sin corrida.
**No se mergea hasta que `gate-completo` esté en verde con este spec incluido**, y conviene copiar
su salida a `progress/impl_QC-282.md` (CHECKPOINTS > Calidad de código).

### m1 — menor · `lib/modules/pedidos/domain/deliver-order.ts:59`, `:66`
`customerId` se valida con `z.string()` y se deduplica por **texto**. El mismo uuid en mayúsculas
y en minúsculas pasa el `refine` y `checkDeliveryBlocks`. `isCustomerIdShape` acepta los dos y
Postgres los iguala.
- Con lotes distintos, la entrega se guarda con las líneas de «dos» bloques del mismo cliente, en
  lugar de responder `invalid_input` (R21, «el mismo cliente dos veces»).
- Con el mismo lote, choca con la unicidad `(delivery, customer, batch)` y responde un error
  inesperado.

El sheet manda siempre los ids en minúsculas del catálogo, así que solo lo provoca una llamada
directa a la action. Arreglo sugerido: normalizar (`toLowerCase`) antes de deduplicar, o validar
con `.uuid()` + transform.

### m2 — menor · `app/(private)/pedidos/components/order-delivery-sheet.tsx:138`, `:161-165`, `:180`
El sheet calcula con un `sumPackages` propio:
- `overBatchIds`, la suma por lote que deshabilita «Entregar» (R15);
- lo escrito por presentación del resumen (R11).

R20 pide que la suma por lote y el tope por presentación salgan de las mismas funciones puras que
usa el servidor. El envío sí lo decide `checkDelivery`, y los «Disponibles» y el tope del campo los
da `packagesLeftInBatch`. El riesgo de divergencia es bajo, pero la marca y el aviso no usan la
función compartida. Sugerencia: sacar de `checkDelivery`/`packagesLeftInBatch` (o de una función
pura nueva en `order-delivery.ts`) el «lo escrito supera lo disponible».

### m3 — menor (riesgo residual aceptado por P7) · `tests/unit/clientes/scope.test.ts:613-622`
Tras P7, R38 ya no caza un «Clientes» que apunte al módulo por una vía no prevista: un botón con
`router.push(ruta)` y texto «Clientes», un *breadcrumb* `{ title: 'Clientes', to }` o un
`<Link>` con hijos anidados (`<Link><span>Clientes</span></Link>`). La ruta `/clientes` y la
constante de ruta siguen cazándose, así que el hueco se reduce a navegar con una ruta calculada
fuera del archivo. Queda anotado; no pide cambio.

### m4 — menor (preexistente, no regresión) · `tests/unit/clientes/scope.test.ts:770-772`
R40 busca `prisma.customer` pero no `tx.customer` ni `db.customer` (cliente de transacción de
Prisma). Tampoco lo cazaba la versión anterior (`\bcustomers\b` no casa con el singular). Candidato
a afinar en una ficha propia de la guardia.

### m5 — menor · `progress/features/QC-282.md > Cierre`
La sección `Cierre` está vacía. Es de F3 y no bloquea esta revisión; se anota para que no se
olvide (CHECKPOINTS > Verificación final).

## Lo que no es hallazgo
- `./init.sh` cortado por el cupo: excepción aceptada por el humano.
- Que la columna «Presentación» del tab repita siempre el mismo nombre dentro de un producto: está
  observado en design §2.7 y D12 no se reabre.
- `deliver-order.ts` importa de `./order-delivery` y no del barrel: decisión del humano del
  2026-10-15 (design §12, R20).
