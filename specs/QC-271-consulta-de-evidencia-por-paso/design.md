# QC-271 — consulta-de-evidencia-por-paso · design.md

> Zona fullstack · Complejidad medium · Requisitos en `requirements.md` (R1–R30; P1 y P2 nuevas, no
> bloquean). La feature solo lee. No crea tablas, columnas, enums, migraciones, permisos ni
> dependencias (R30). Se apoya en la tabla, el bucket y la pieza de UI de QC-214, en el recorrido de
> QC-167 y en la ficha de QC-225.
>
> **Tableros aprobados (pase `/design`, 2026-10-14).** Este diseño se implementa contra ellos:
> - `docs/diseno/canvas/RecorridoEvidencia.dc.html`, `docs/diseno/canvas/RecorridoEvidenciaTablet.dc.html`,
>   `docs/diseno/canvas/RecorridoEvidenciaMovil.dc.html`;
> - `docs/diseno/canvas/ProductoTerminadoEvidencia.dc.html`,
>   `docs/diseno/canvas/ProductoTerminadoEvidenciaTablet.dc.html`,
>   `docs/diseno/canvas/ProductoTerminadoEvidenciaMovil.dc.html`.
>
> Canvas vivo: https://claude.ai/artifact/9idfocrGmuPeDeGWbRJaUZ.
>
> **Grafo de código:** no usé el MCP `codebase-memory-mcp` en esta tanda. Exploré con Grep/Read y
> verifiqué a mano las rutas citadas.

## Lo que ya existe

Busqué `evidencia`, `evidence`, `foto` y `consulta` en tres sitios:
- **`feature_list.json`**: solo QC-214 (`evidencia-por-paso`, sube las fotos) y esta ficha.
- **`specs/`**: QC-214 deja la lectura fuera de la ejecución para «aparte». QC-167 y QC-225 no
  pintan fotos.
- **Código**: ninguna pantalla lee hoy fotos de un pedido terminado.

Lo que reutilizo:

**Datos y lectura (QC-214)**
- Tabla `order_step_evidence` (`db/schema.prisma:1118`). Tiene `company_id`, `order_id`, `phase`,
  `step_position` y `slot`, y ya lleva el índice `(company_id, order_id)`, así que no hace falta
  migración.
- Puerto `StepEvidenceRepository` (`lib/modules/asignaciones/ports/step-evidence-repository.ts`). Se
  reutiliza `listByOrder(companyId, orderId, phase)` tal cual. No hay método de conteo por varios
  pedidos: `listOrderIdsWithEvidence` solo dice sí o no.
- `evidence-photos.ts`:
  - `toStepEvidenceViews` agrupa por paso y ordena por `slot`.
  - **`readStepEvidence` NO sirve tal cual.** Devuelve `[]` si ningún paso de la lista **actual**
    pide evidencia (línea 112), y R7 pide justo lo contrario: todas las fotos guardadas.
- Puerto `EvidenceStorage` (`ports/evidence-storage.ts`). Firma de una en una
  (`createSignedReadUrl`), con `EVIDENCE_READ_LINK_TTL_SECONDS = 15 * 60`
  (`domain/step-evidence.ts:17`).
- `requirePermission` y los predicados `can…` de `domain/actor.ts`.

**Recorrido (QC-167)**
- `createGetExecutionTrace` (`domain/get-execution-trace.ts`) exige `dashboard.consultar` y no
  cambia.
- `ExecutionTraceDetailStep` lleva `stepPosition: number | null`. El empaque anota sin posición
  (`domain/execution-entry.ts:25`).

**Ficha (QC-225)**
- `createListFinishedProductBatches` resuelve `orderId` por lote y hoy lo **descarta** al devolver
  la fila (`list-finished-product-batches.ts:54`).

**Filas de `components/shared/CATALOGO.md` consultadas y paso de la regla de decisión**

| Pieza (fila) | Uso aquí | Paso |
|---|---|---|
| `StepEvidence`, `EvidenceMissingDialog`, `uploadEvidence` (fila 90; diseño `EvidenciaPaso*.dc.html`) | Cuadrícula, contador `n/3` y visor ampliado de cada grupo de paso | **2 — se extiende** con props opcionales (§6.1). Los usos de ejecución y empaque no cambian. |
| `Notice` (fila 76) | Aviso «No se pudieron cargar las fotos.» | **3 — se compone** con `Button` en `EvidenceReadError` (§6.1). `Notice` no cubre acciones dentro, pero `children` admite el botón. |
| `Skeleton` (fila 37) | Miniatura esqueleto (R22) | 1 — se reutiliza dentro de `StepEvidence` |
| `Dialog`, `DialogContent` (fila 28) | Diálogo «Evidencia · Lote · Pedido» | 1 — se reutiliza. A pantalla completa en teléfono con `className` (R18). |
| `Button` | «Reintentar», «Recargar», botón de la celda | 1 |
| `Card` (fila 25) | Tarjeta «Envasado» del recorrido | 1 |
| `DataTable` (fila 63) | Columna «Evidencia» de Lotes | 1 — una columna más, sin tocar la pieza |
| `EMPTY_MARK` (fila 112) | «—» en la celda | 1 |
| `touchTarget` (fila 120) | 44 px en «Reintentar» y «Recargar» | 1 |

**Componentes nuevos de ruta.** Los cuatro son paso 3, «componer»: solo componen piezas
catalogadas, y su UI visible está en los tableros aprobados.
- `TraceStepEvidence`, `TraceOtherStepsEvidence` y `TracePackingEvidence` en
  `app/(private)/dashboard/recorrido/[id]/components/`.
- `BatchEvidenceButton` y `BatchEvidenceDialog` en
  `app/(private)/inventario/producto-terminado/[id]/components/`.

`EvidenceStepList` sube a `components/shared/step-evidence/` desde el primer commit. **Excepción
declarada:** tiene dos consumidores identificados en esta misma feature, el recorrido (otros pasos y
envasado) y el diálogo de la ficha. Pasa lo mismo con `EvidenceReadError`.

## 1. Encaje en módulos

Todo vive en `asignaciones`, que es el dueño de `order_step_evidence` y del bucket. `inventario` no
aprende nada de fotos.

```
app/dashboard/recorrido/[id]  ──► execution-trace-actions.getExecutionEvidenceAction ──► asignaciones.getExecutionEvidence   (dashboard.consultar)
app/inventario/producto-terminado/[id]
   ├─ Lotes (server) ──► order-evidence-actions.countOrderEvidenceAction ─────────────► asignaciones.countOrderEvidence      (pedidos.consultar)
   └─ diálogo (client) ─► order-evidence-actions.getOrderEvidenceAction ──────────────► asignaciones.getOrderEvidence        (pedidos.consultar)
```

`inventario` solo cambia en una cosa: `FinishedProductBatchRow` deja de descartar `orderId` (§2.5).
Así la pantalla sabe qué pedido contar y abrir.

## 2. Contrato

### 2.1 Tipos y funciones puras: `asignaciones/domain/order-evidence.ts` (nuevo)

```ts
import type { EvidencePhase, StepEvidencePhotoView } from './step-evidence';

/** Un grupo de paso: las fotos guardadas de una fase con el mismo número de paso. */
export type OrderEvidenceGroup = {
  readonly stepPosition: number;          // el guardado, no la posición actual (R8)
  readonly photoCount: number;            // 1..3
  /** `null` si la firma falló (R11): la pantalla pinta el aviso con «Reintentar». */
  readonly photos: readonly StepEvidencePhotoView[] | null;
};

export type OrderEvidence = {
  readonly manufacturing: readonly OrderEvidenceGroup[];   // por stepPosition asc
  readonly packing: readonly OrderEvidenceGroup[];
};

export type OrderEvidenceCount = { readonly orderId: string; readonly photoCount: number };

/** Agrupa filas de UNA fase por número de paso, ordena por paso y por slot. Pura. */
export function groupEvidenceRows(rows: readonly StepEvidenceRow[]): readonly { stepPosition: number; rows: readonly StepEvidenceRow[] }[];
```

`StepEvidencePhotoView` (`{ id, slot, url }`) no cambia: no lleva `path`, así que R10 se cumple por
el tipo.

**Nombre del paso de envasado (P1).** El contrato no lleva `stepName`. Con el modelo de hoy un paso
no tiene nombre (`recipe-input.ts:179`), así que el rótulo es siempre «Paso N». Si el humano
responde P1 con una fuente para el nombre, se añade `stepName: string | null` a `OrderEvidenceGroup`
y una dependencia de `RecipePackingStepsReader`. Ese cambio es aditivo.

### 2.2 Lectura compartida: `asignaciones/domain/read-order-evidence.ts` (nuevo)

```ts
export type ReadOrderEvidenceDeps = {
  readonly orders: OrderCatalog;               // de pedidos (barrel), ya cableado
  readonly evidence: StepEvidenceRepository;
  readonly storage: EvidenceStorage;
};

/** Lanza OrderNotFoundError si el pedido no es de la empresa (vivo o dado de baja). */
export async function readOrderEvidence(deps, companyId: string, orderId: string): Promise<OrderEvidence>;
```

Pasos:
1. Lee `deps.orders.listSummariesByIdsIncludingDeleted(companyId, [orderId], ORDER_STATUS_VALUES, 1, 1)`,
   con la misma llamada que `get-execution-trace.ts:49`. Si no vuelve el pedido, lanza
   `OrderNotFoundError` (R5). Los pedidos cancelados o dados de baja sí vuelven (R9).
2. Lee `deps.evidence.listByOrder(companyId, orderId, 'manufacturing')` y lo mismo con `'packing'`,
   en paralelo. **No se mira la fórmula** (R7).
3. Si no hay ninguna fila, devuelve `{ manufacturing: [], packing: [] }` sin firmar nada (R10).
4. Firma todas las rutas en **una** llamada: `deps.storage.createSignedReadUrls(paths, EVIDENCE_READ_LINK_TTL_SECONDS)`
   (§2.3).
   - Si lanza, devuelve los grupos con `photos: null` (R11). El diagnóstico no se traga: viaja en
     `OrderEvidenceUnavailable` (§2.4) para que la action lo escriba en el log.
5. Arma los grupos con `groupEvidenceRows` por fase.

### 2.3 Puertos: cambios aditivos

`ports/evidence-storage.ts`:
```ts
/** Misma longitud y orden que `paths`. Lanza si el proveedor falla en cualquiera. */
createSignedReadUrls(paths: readonly string[], expiresInSeconds: number): Promise<readonly string[]>;
```

`ports/step-evidence-repository.ts`:
```ts
/** Fotos de las dos fases por pedido, solo de esa empresa. Un pedido sin fotos o ajeno no sale. */
countByOrders(companyId: string, orderIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
```

### 2.4 Casos de uso (`asignaciones/domain/`)

| Archivo (nuevo) | Firma | Permiso (1.ª sentencia) | Entrada |
|---|---|---|---|
| `get-execution-evidence.ts` | `createGetExecutionEvidence(deps: ReadOrderEvidenceDeps) → (actor, input: unknown) => Promise<OrderEvidenceRead>` | `dashboard.consultar` (R1) | `{ orderId: uuid }`. Si no es uuid, lanza `OrderNotFoundError`, igual que `getExecutionTrace` (R5). |
| `get-order-evidence.ts` | `createGetOrderEvidence(deps: ReadOrderEvidenceDeps) → (actor, input: unknown) => Promise<OrderEvidenceRead>` | `pedidos.consultar` (R2) | ídem |
| `count-order-evidence.ts` | `createCountOrderEvidence(deps: { evidence }) → (actor, input: unknown) => Promise<readonly OrderEvidenceCount[]>` | `pedidos.consultar` (R2) | `{ orderIds: uuid[] }`, `max(25)`. Si no cumple, lanza `ValidationError` (R6). Quita duplicados. Con la lista vacía devuelve `[]` sin llamar al puerto. Solo devuelve pedidos con 1 foto o más. |

`OrderEvidenceRead = { evidence: OrderEvidence; signingFailure: string | null }`. La action escribe
`signingFailure` en el log con `observabilidad` y devuelve solo `evidence`.

Permiso antes que `zod` y antes de tocar ningún puerto, como en el resto del módulo. La
autorización va por permiso, nunca por rol (R3). Lo vigila `guard-autorizacion-por-permiso`.

`domain/actor.ts` gana `canConsultOrderEvidence(bearer): boolean`, con la constante privada
`'pedidos.consultar'` y el mismo patrón que `canExecuteAssignedOrders`. Así la ficha decide si pinta
la columna sin escribir el código del permiso en `app/`. Es presentación: el corte real son los dos
casos de uso.

Barrel `lib/modules/asignaciones/index.ts`:
- tipos de §2.1;
- `groupEvidenceRows`;
- las tres factorías con su `…Deps`;
- `canConsultOrderEvidence`.

### 2.5 `inventario`: `FinishedProductBatchRow.orderId`

- `domain/finished-product-detail.ts`: `FinishedProductBatchRow` gana `readonly orderId: string | null`.
- `domain/list-finished-product-batches.ts:54`: deja de quitar `orderId` y lo devuelve con la fila.

No es un dato sensible: es el identificador del pedido cuyo número ya sale en la misma fila. Los
llamadores de tipos que cambian son los fixtures (`tests/fixtures/finished-product-detail.ts`) y
los tests de la tabla.

### 2.6 Server Actions

- `asignaciones/adapters/driving/execution-trace-actions.ts`, archivo que ya existe: gana
  `getExecutionEvidenceAction(orderId: string): Promise<{ status: 'success'; data: OrderEvidence } | ErrorState>`.
- `asignaciones/adapters/driving/order-evidence-actions.ts`, archivo nuevo con `'use server'`:
  - `getOrderEvidenceAction(orderId)`, con el mismo resultado que la anterior;
  - `countOrderEvidenceAction(orderIds: readonly string[]): Promise<{ status: 'success'; data: readonly OrderEvidenceCount[] } | ErrorState>`.

En las dos: `currentActor()` igual que en `execution-trace-actions.ts`, `toErrorState` por `code`, y
ningún permiso. No se reexportan desde el barrel.

### 2.7 Códigos de error

Sin códigos nuevos: `unauthorized`, `invalid_input` y `order_not_found` ya están en el catálogo de
`asignaciones`.

## 3. Modelo de datos, RLS y migraciones

- **Tablas:** ninguna nueva y ninguna columna nueva. Se lee `order_step_evidence` (QC-214).
- **RLS:** ya está activada y forzada en `order_step_evidence` desde QC-214, y esta feature no la
  toca. Como en todo el repo, la frontera real es el permiso en el caso de uso (§2.4) más el filtro
  por `company_id` en cada consulta del adaptador. La RLS no filtra a Prisma
  (`docs/architecture.md > Acceso a datos y autorizacion`).
- **Migraciones:** ninguna. El conteo por `(company_id, order_id)` usa el índice
  `order_step_evidence_company_id_order_id_idx`, que ya existe.
- **Bucket:** solo firmas de lectura. No hay subidas ni borrados (R30).

## 4. Adaptadores driven

- `adapters/driven/persistence/step-evidence-prisma.ts`: añade `countByOrders`, con
  `groupBy({ by: ['orderId'], where: { companyId, orderId: { in } }, _count: { _all: true } })`. Con
  la lista vacía devuelve un `Map` vacío sin consultar.
- `adapters/driven/storage/evidence-storage-supabase.ts`: añade `createSignedReadUrls`, sobre
  `createSignedUrls(paths, expiresIn)` de `@supabase/storage-js`, que ya está en el repo. Lanza si
  hay `error` global o en cualquier elemento, y devuelve las URL en el orden de `paths`.
  `implementer` confirma la firma exacta del método con context7 antes de escribirlo.
- `adapters/driven/storage/evidence-storage-memory.ts` (doble de E2E): añade `createSignedReadUrls`
  como `map` de su `createSignedReadUrl`.
- `lib/composition/index.ts`:
  - `evidenceStorage` gana `createSignedReadUrls`;
  - la fachada `asignaciones` gana al final `getExecutionEvidence`, `getOrderEvidence` y
    `countOrderEvidence`, con `orders: orderCatalog`, `evidence: stepEvidenceRepository` y
    `storage: evidenceStorage`.
- Los dobles de test que implementan `EvidenceStorage` o `StepEvidenceRepository` ganan los métodos
  (`tests/unit/asignaciones/evidence-doubles.ts` y lo que marque `typecheck`).

## 5. Rutas

No hay rutas nuevas, y las dos que se tocan siguen exigiendo su permiso de página:
- `/dashboard/recorrido/[id]` con `dashboard.consultar`;
- `/inventario/producto-terminado/[id]` con `inventario.consultar`.

`guard-pantallas-exigen-permiso` no cambia.

## 6. UI

### 6.1 `components/shared/step-evidence/`: extensión y piezas compartidas

**`StepEvidence`: props opcionales nuevas.** Sin ellas, el árbol y los textos de hoy no cambian. Lo
comprueban los tests actuales de `step-evidence.test.tsx`, que siguen verdes.

| Prop | Efecto | R |
|---|---|---|
| `consult?: boolean` | Implica `readOnly`. Quita «Fijada al terminar», «Obligatoria…» y los dos textos de ayuda. Pinta sin `Card`, como `div role="group"` con `aria-label` «Evidencia de <fase>, paso N», como en los tableros (`.ev-ro`). | R20, R21 |
| `heading?: string` | Sustituye «Evidencia» en la cabecera, p. ej. «Paso 3». Por defecto, `STEP_EVIDENCE_TEXTS.heading`. | R8, R13, R14 |
| `onReload?: () => void` | Si una miniatura `ok` dispara `onError` en el `<img>`, la casilla pasa a «Vista vencida» con «Recargar» (44 px), que llama a `onReload`. Sin `onReload` no se pinta «Recargar». | R24 |

**Comportamiento nuevo en modo consulta.** Mientras el `<img>` de una casilla `ok` no dispara
`onLoad`, la casilla muestra `Skeleton` y un `sr-only` «Cargando fotos…» (R22).

**Tile nuevo** `{ id, status: 'loading' }`. Pinta la casilla esqueleto sin foto. Lo usa el diálogo
mientras la lectura está en vuelo (R22).

**Textos nuevos** en `STEP_EVIDENCE_TEXTS`:
- `stepHeading(n)`: «Paso N»;
- `loading`: «Cargando fotos…»;
- `expired`: «Vista vencida»;
- `reload`: «Recargar»;
- `reloadPhoto(n, step)`: «Recargar la foto n del paso N»;
- `readError`: «No se pudieron cargar las fotos.»;
- `retry`: «Reintentar».

El visor ampliado no cambia (R20): sin animación nueva y sin librería nueva.

**`EvidenceReadError`** (nuevo, `evidence-read-error.tsx`). Pinta `Notice tone="danger"` con
`readError` y un `Button` «Reintentar» (`touch`). Props: `onRetry` y `testId`.

**`EvidenceStepList`** (nuevo, `evidence-step-list.tsx`). Recibe `groups: readonly OrderEvidenceGroup[]`,
`phaseLabel`, `onRetry` y `onReload`. Pinta una fila por grupo:
- si `photos !== null`, un `StepEvidence consult heading="Paso N"`;
- si no, la cabecera «Paso N · n/3» y un `EvidenceReadError` (R23).

No pinta nada con `groups` vacío (R25).

### 6.2 Recorrido (`app/(private)/dashboard/recorrido/[id]/`)

**`page.tsx`**. Pide `getExecutionTraceAction(id)` y `getExecutionEvidenceAction(id)` con
`Promise.all`. Si el recorrido da `order_not_found`, responde `notFound()` como hoy, sin mirar las
fotos. Pasa `evidence: ExecutionEvidenceResult` a `ExecutionTraceDetail`. Si falla la lectura de
fotos, la página no cambia nada más (R15).

**`trace-evidence-placement.ts`** (nuevo, puro). Expone
`placeManufacturingEvidence(steps, groups) → { byStepId: ReadonlyMap<string, OrderEvidenceGroup>; others: readonly OrderEvidenceGroup[] }`:
- cada grupo de fabricación del paso N va a la **última** anotación con `stepPosition === N` (R12);
- los grupos sin ninguna anotación de su número van a `others` (R13).

El envasado no pasa por aquí (R14).

**`execution-timeline.tsx`**. `ExecutionTimeline` gana `evidence?: ExecutionEvidenceResult`. Cada
`TimelineStep` cuyo `id` esté en `byStepId` pinta `TraceStepEvidence` bajo su cuerpo. Al final del
`<ol>`, dentro de la tarjeta Anotaciones, va una de dos cosas:
- `TraceOtherStepsEvidence` si `others` no está vacío: título «Otros pasos con fotos» y la frase del
  tablero;
- un `EvidenceReadError` único si la lectura falló entera (R15).

**`TraceStepEvidence`, `TraceOtherStepsEvidence` y `TracePackingEvidence`** (nuevos, `'use client'`).
Componen `StepEvidence consult` y `EvidenceStepList`. `onRetry` y `onReload` llaman a
`router.refresh()`, que vuelve a pedir y a firmar. `TracePackingEvidence` es la tarjeta `Card`
«Envasado» con el contador total y `EvidenceStepList` de envasado. Se monta en
`execution-trace-detail.tsx` después de `ExecutionTimeline`, solo si hay grupos de envasado (R14).

Teléfono y tablet: la cuadrícula de 3 casillas cabe en la columna del cuerpo de la anotación
(`max-width: 372px` en el tablero). Sin desbordes nuevos. Los tableros `*Movil` y `*Tablet` son la
referencia.

### 6.3 Ficha (`app/(private)/inventario/producto-terminado/[id]/components/`)

**`finished-product-list-section.tsx`**, caso `lotes`:
1. `const canSeeEvidence = canConsultOrderEvidence(await identity.getSessionUser())`. Es
   presentación, con el patrón de `order-list-section.tsx:118`.
2. Si es `true` y la página tiene lotes con `orderId`, llama a
   `countOrderEvidenceAction(orderIds únicos)`:
   - si responde bien, pasa `evidenceCounts: ReadonlyMap<string, number>` a la tabla;
   - si responde error, pasa `undefined` (R4, P2).
3. Si es `false`, no llama a nada (R4).

**`finished-product-batches-table.tsx`**. `batchColumns` gana el parámetro `evidenceCounts`. Si no
es `undefined`, añade al final la columna `evidence`, con la etiqueta «Evidencia» (R16):
- con `orderId !== null` y conteo > 0: `BatchEvidenceButton` con el icono `Camera` y el texto
  «1 foto»/«N fotos» (`font-mono`), con `aria-label` «Ver evidencia del lote <lote>: N fotos»;
- en otro caso: `EMPTY_MARK`.

Sin `evidenceCounts`, la columna no existe (R4). La tabla sigue en `DataTable` sin `card`, con
desplazamiento horizontal (R18). El conteo es por pedido, así que dos lotes del mismo pedido
coinciden (R19).

**`BatchEvidenceDialog`** (nuevo, `'use client'`):
- **Estado:** `idle → loading → ready | error`. Al abrir llama a `getOrderEvidenceAction(orderId)`.
- **Título:** «Evidencia · Lote <lot> · Pedido <orderNumberText>» y la línea «Fotos tomadas durante
  la ejecución del pedido. Solo consulta.» (R17).
- **Cargando:** casillas `loading`, tantas como `min(photoCount, 3)` (R22).
- **Error:** `EvidenceReadError`, que vuelve a llamar a la action (R23).
- **Listo:** grupos «Fabricación» y «Envasado» como `section` con `h3` y contador, cada uno con su
  `EvidenceStepList`. Un grupo vacío no se pinta (R17, R25).
- **Recargar:** `onReload` vuelve a llamar a la action (R24).
- **Teléfono:** en el `DialogContent`, `className` a pantalla completa por debajo de 768 px (R18).

El visor ampliado de `StepEvidence` se abre encima del diálogo. Los dos son `Dialog` de Base UI
anidados, como en el tablero (`z-index` 43).

### 6.4 Solo consulta

Ningún archivo de las dos rutas importa:
- `step-evidence-actions.ts`;
- `uploadEvidence`;
- ninguna action de escritura (R26).

Lo vigilan los contratos de ruta (§7).

## 7. Censos, guardias y llamadores afectados

| Archivo | Qué censa | Cambio | Task |
|---|---|---|---|
| `tests/unit/composition/asignaciones-facade.test.ts` | claves de la fachada | + `getExecutionEvidence`, `getOrderEvidence`, `countOrderEvidence` | T0 |
| `tests/unit/asignaciones/module-contract.test.ts` | contrato del módulo (literal de permisos fuera del dominio, factorías) | verificar; enmendar con nota fechada si cuenta factorías | T0 |
| `tests/unit/identity/session-once-per-request-actions.test.ts` | una fila por archivo driving | + `order-evidence-actions.ts`; `execution-trace-actions.ts` ya está (verificar si censa funciones) | B2 |
| `tests/guards/guard-identificador-de-request.test.ts` | `E2E_ESPERADOS` | + `consulta-de-evidencia.spec.ts` | TI |
| `tests/guards/guard-dobles-e2e.test.ts` | dobles de E2E | verificar con el método nuevo del doble en memoria | B1 |
| `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`, `tests/unit/dashboard-route-contract.test.ts` | contratos de las dos rutas | + ninguna importación de `step-evidence-actions` ni de `uploadEvidence` (R26) | F1, F2 |
| `tests/unit/navegacion/pantallas-exigen-permiso.test.tsx`, `tests/unit/paridad/recorridos-paridad.test.tsx`, `tests/ui/dashboard/execution-trace-detail.test.tsx` | dobles de `execution-trace-actions` | + doble de `getExecutionEvidenceAction` | F1 |
| `tests/unit/inventario/scope.test.ts`, `tests/unit/shared/data-table-alcance.test.ts` | listas de E2E | + el E2E nuevo si lo exigen (verificar) | TI |
| `tests/fixtures/finished-product-detail.ts` | filas de lote | + `orderId` | T0 |
| `components/shared/CATALOGO.md` | fila de `StepEvidence` | puntos de extensión `consult`, `heading`, `onReload`, tile `loading`; + `EvidenceReadError`, `EvidenceStepList`; celda Diseño + los tableros de QC-271 | F0 |
| `tests/guards/guard-dependencias-aprobadas.test.ts`, migraciones esperadas | `package.json`, migraciones | sin cambio (R30) | TC |

## 8. Seguridad y rendimiento

- **Oráculo de existencia.** Si el id es malformado, no existe o es de otra empresa, la respuesta es
  `order_not_found`, igual en los tres casos (R5). El conteo no dice nada de un pedido ajeno: no
  sale en la respuesta (R6).
- **Firmas.**
  - Son de 15 minutos y solo sobre rutas leídas de filas filtradas por `company_id`. La ruta nunca
    sale al cliente.
  - El actor no elige ninguna ruta: entra solo `orderId`.
  - Sin `pedidos.consultar` no se firma nada (R2), y la columna ni siquiera se pide (R4).
- **N+1.**
  - Recorrido: una consulta de pedido, dos `listByOrder` y **una** llamada de firma en lote.
  - Lotes: un `groupBy` por página, con 25 ids como máximo.
  - Diálogo: igual que el recorrido.
  - Firmar de una en una sería hasta 50 pasos × 3 fotos × 2 fases = 300 llamadas al proveedor por
    página. Por eso existe `createSignedReadUrls`.

## 9. Alternativas descartadas

- **A1 — Reutilizar `readStepEvidence`.** Filtra por la lista actual de pasos que piden evidencia y
  devuelve `[]` si ninguno la pide. Una fórmula editada después escondería fotos, y la decisión
  [Fórmula editada] lo prohíbe. Cambiar su condición rompería la pantalla de ejecución, que sí debe
  callar si el paso no pide foto.
- **A2 — Meter las fotos en `getExecutionTrace`.** Un fallo del bucket tumbaría el recorrido
  entero, o habría que enmascararlo dentro. Además, el recorrido de QC-167 se lee en la lista del
  dashboard, donde no hacen falta fotos. Separada, la lectura falla sola (R15) y el recorrido no
  cambia.
- **A3 — Conteo dentro de `inventario` con un puerto hacia `asignaciones`.** `listFinishedProductBatches`
  traería el conteo y decidiría `pedidos.consultar` dentro. Así `inventario` conocería un permiso y
  un concepto (fotos de ejecución) que no son suyos, y un fallo del conteo tumbaría la pestaña Lotes
  entera, en contra de R4 y P2. Se prefiere exponer `orderId` y que la pantalla componga dos
  lecturas, cada una con su permiso en su módulo.
- **A4 — Esqueletos del recorrido con `Suspense` por anotación**, pasando una promesa con `use()`.
  Antes de leer no se sabe qué anotaciones tienen fotos, así que los esqueletos no tendrían sitio. La
  firma en lote es una llamada, y el «cargando» que el usuario percibe es la descarga de cada
  imagen. Eso lo cubre el esqueleto por casilla hasta `onLoad` (R22).
- **A5 — Derivar el nombre del paso de envasado del primer párrafo.** Sería inventar un dato que el
  modelo no tiene, y además con el texto de hoy, no con el del momento de la foto. Queda en P1.
- **A6 — Una pieza nueva de consulta en vez de extender `StepEvidence`.** Duplicaría la cuadrícula,
  el contador y el visor. La regla de decisión pide extender con props opcionales cuando se puede
  sin romper a los consumidores, y aquí se puede.

## 10. Trazabilidad prevista (R → test)

| R | Test |
|---|---|
| R1 | `tests/unit/asignaciones/get-execution-evidence.test.ts`: sin `dashboard.consultar`, `unauthorized` antes de `zod` y sin llamar a ningún puerto |
| R2 | `tests/unit/asignaciones/get-order-evidence.test.ts` y `count-order-evidence.test.ts`: sin `pedidos.consultar` (con `inventario.consultar`), `unauthorized` y ningún puerto tocado |
| R3 | los tres anteriores: rol cualquiera con el permiso, aceptado; Administrador sin el permiso, rechazado |
| R4 | `tests/unit/inventario-ui/finished-product-batches-evidence.test.tsx`: sin permiso no hay columna ni llamada; con un conteo que falla no hay columna |
| R5 | `get-execution-evidence.test.ts`, `get-order-evidence.test.ts`: uuid malformado, inexistente o de otra empresa dan `order_not_found` sin firmar |
| R6 | `count-order-evidence.test.ts`: 26 ids o un id no uuid dan `invalid_input`; `tests/integration/asignaciones/step-evidence-repository.int.test.ts`: `countByOrders` no cuenta filas de otra empresa |
| R7, R8 | `tests/unit/asignaciones/read-order-evidence.test.ts`: fotos de un paso que hoy no pide evidencia y de un paso que ya no existe; orden por paso y por slot; `groupEvidenceRows` |
| R9 | `read-order-evidence.test.ts`: pedido `CANCELADO` y pedido dado de baja devuelven sus fotos |
| R10 | `read-order-evidence.test.ts`: sin filas no llama a `createSignedReadUrls`; la respuesta no lleva `path`; TTL 900 s |
| R11 | `read-order-evidence.test.ts`: la firma lanza, salen grupos con `photos: null`, `photoCount` y `signingFailure` |
| R12, R13 | `tests/ui/dashboard/trace-evidence-placement.test.ts`: paso repetido (última anotación), paso sin anotación en `others`, ninguna foto de envasado colocada |
| R14 | `tests/ui/dashboard/execution-trace-evidence.test.tsx`: tarjeta «Envasado» con total y «Paso N»; sin envasado no hay tarjeta |
| R15 | `execution-trace-evidence.test.tsx`: lectura en error, anotaciones y stats iguales y un único aviso |
| R16–R19 | `finished-product-batches-evidence.test.tsx` y `tests/unit/inventario-ui/batch-evidence-dialog.test.tsx` |
| R20–R25 | `tests/unit/shared-ui/step-evidence.test.tsx` (ampliado): `consult`, `heading`, esqueleto hasta `onLoad`, «Vista vencida» y `onReload`, tile `loading`, textos ausentes; los casos de ejecución actuales siguen verdes; `tests/unit/shared-ui/evidence-step-list.test.tsx` |
| R26 | `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts` y `tests/unit/dashboard-route-contract.test.ts` (ampliados): ningún archivo de las dos rutas importa `step-evidence-actions` ni `uploadEvidence` |
| R27, R28 | `e2e/consulta-de-evidencia.spec.ts` |
| R29 | `get-order-evidence.test.ts` y `get-execution-evidence.test.ts` (empresa A pide pedido de B) + `step-evidence-repository.int.test.ts` (`countByOrders` cruzado) |
| R30 | `guard-dependencias-aprobadas`, migraciones esperadas sin cambio, `guard-autorizacion-por-permiso`; revisión del diff (sin `db/`) |

## 11. Dependencias, integraciones y choques en vuelo

- **Dependencias npm:** ninguna nueva. `@supabase/storage-js` ya está en `package.json` y en uso en
  `evidence-storage-supabase.ts`.
- **Integraciones:** el bucket privado de QC-214, solo lectura.
- **Choques:** `archivos-en-vuelo.mjs` se repite en F2.0 con `## Archivos esperados` de `tasks.md`.
  Zonas calientes: `lib/composition/index.ts` y `components/shared/CATALOGO.md`.
