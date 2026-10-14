# QC-271 — consulta-de-evidencia-por-paso · tasks.md

> **Orden:**
> 1. T0: contrato, en secuencia.
> 2. Bloques B (backend) y F (frontend). B y F van en paralelo entre sí donde se marca `[P]`.
> 3. TC: barrido de censos.
> 4. TI: E2E.
> 5. TZ: cierre.
>
> **Reglas para todas las tasks:**
> - Ningún comentario de producción cita la ficha, un `R<n>` ni el spec. En los tests, el `R<n>` va
>   en el nombre del caso.
> - Cada tanda cierra con `pnpm run typecheck`, `pnpm run lint`,
>   `pnpm exec vitest related --run <archivos tocados>` y `pnpm exec vitest run guard`. Nada de
>   `pnpm test`.
> - No se crean migraciones, tablas, permisos ni dependencias (R30). Si una task parece necesitarlos,
>   para y avisa al leader.
> - Si el humano responde P1 o P2 con algo distinto de la propuesta, para y avisa: cambian R4, R14 y
>   R17.

## [x] T0 — Contrato publicado (secuencial; lo hace `backend_dev`)

Archivos:
- `lib/modules/asignaciones/domain/order-evidence.ts` (nuevo), con los tipos de `design.md > 2.1`
  y `groupEvidenceRows` **real** (pura).
- `lib/modules/asignaciones/domain/read-order-evidence.ts` (nuevo): firma de `design.md > 2.2` y
  cuerpo stub que lanza `OrderNotFoundError`.
- `lib/modules/asignaciones/domain/get-execution-evidence.ts`, `get-order-evidence.ts` y
  `count-order-evidence.ts` (nuevos): firma y `…Deps`, el permiso como primera sentencia y cuerpo
  stub.
- `lib/modules/asignaciones/domain/actor.ts`: `canConsultOrderEvidence`, real.
- Los dos puertos de `design.md > 2.3`, con sus métodos nuevos:
  - `lib/modules/asignaciones/ports/evidence-storage.ts` gana `createSignedReadUrls`;
  - `lib/modules/asignaciones/ports/step-evidence-repository.ts` gana `countByOrders`.
- `lib/modules/asignaciones/index.ts`: exporta lo de `design.md > 2.4`.
- `lib/modules/asignaciones/adapters/driving/execution-trace-actions.ts`: añade
  `getExecutionEvidenceAction`.
- `lib/modules/asignaciones/adapters/driving/order-evidence-actions.ts` (nuevo):
  `getOrderEvidenceAction` y `countOrderEvidenceAction`.
- `lib/composition/index.ts`:
  - `evidenceStorage.createSignedReadUrls`;
  - las tres claves nuevas al final de la fachada `asignaciones`.
- Stubs de los dos adaptadores reales, que lanzan `not implemented`:
  - `lib/modules/asignaciones/adapters/driven/persistence/step-evidence-prisma.ts`
    (`countByOrders`);
  - `lib/modules/asignaciones/adapters/driven/storage/evidence-storage-supabase.ts`
    (`createSignedReadUrls`).
- `lib/modules/asignaciones/adapters/driven/storage/evidence-storage-memory.ts`:
  `createSignedReadUrls` **real**, como `map` de su `createSignedReadUrl`.
- `tests/unit/asignaciones/evidence-doubles.ts`: los dos métodos nuevos en los dobles. Lo mismo en
  cualquier otro doble que señale `typecheck`.
- `lib/modules/inventario/domain/finished-product-detail.ts` y
  `lib/modules/inventario/domain/list-finished-product-batches.ts`: `orderId` en la fila
  (`design.md > 2.5`).
- `tests/fixtures/finished-product-detail.ts`: `orderId` en las filas de lote.
- `tests/fixtures/order-evidence.ts` (nuevo): un `OrderEvidence` con
  - fabricación en los pasos 1 (2 fotos), 2 (3) y 4 (1);
  - envasado en el paso 1 (2);
  - una variante con `photos: null`.
- `tests/unit/composition/asignaciones-facade.test.ts`: las tres claves nuevas, con nota fechada.
- `tests/unit/asignaciones/order-evidence.test.ts` (nuevo): `groupEvidenceRows` agrupa, ordena
  por paso y por slot, y conserva pasos con hueco (R8).

**Hecho cuando:**
- `typecheck` y `order-evidence.test.ts` están en verde;
- `pnpm exec vitest run guard` está en verde;
- `frontend_dev` puede importar las actions, los tipos y las fixtures.

## Bloque B — backend (`backend_dev`)

### [x] B1 [P] — Adaptadores driven (depende de T0)

- `step-evidence-prisma.ts`: `countByOrders` con `groupBy` filtrado por `companyId`. Con la lista
  vacía no consulta.
- `evidence-storage-supabase.ts`: `createSignedReadUrls` sobre `createSignedUrls`.
  - Antes de escribirlo, confirma la firma con context7 (`@supabase/storage-js`).
  - Lanza si hay error global o en cualquier elemento.
  - Devuelve en el orden de `paths`.
- `tests/integration/asignaciones/step-evidence-repository.int.test.ts` (ampliado). Casos de
  `countByOrders`:
  - cuenta las dos fases;
  - no cuenta filas de otra empresa (R6, R29);
  - un pedido sin fotos no sale;
  - con la lista vacía devuelve un `Map` vacío.
- `tests/unit/asignaciones/evidence-storage-supabase.test.ts`, el existente o uno nuevo si no hay
  (verificar): `createSignedReadUrls` respeta el orden y lanza ante el error de un elemento.
- `tests/unit/asignaciones/evidence-storage-memory.test.ts` (ampliado): `createSignedReadUrls`.

**Hecho cuando:** los tres tests están en verde y `guard-dobles-e2e` está en verde.

### [x] B2 [P] — Casos de uso y actions (depende de T0; trabaja con dobles de puerto)

- `read-order-evidence.ts` (cuerpo real, `design.md > 2.2`).
- `get-execution-evidence.ts`, `get-order-evidence.ts` y `count-order-evidence.ts` (cuerpos reales,
  `design.md > 2.4`).
- `order-evidence-actions.ts` y `execution-trace-actions.ts`: escriben `signingFailure` en el log con
  `observabilidad` y devuelven `evidence`.
- Tests nuevos:
  - `tests/unit/asignaciones/read-order-evidence.test.ts`:
    - R7: paso que hoy no pide evidencia y paso que ya no existe;
    - R8;
    - R9: pedido `CANCELADO` y dado de baja;
    - R10: sin filas no se firma; sin `path`; TTL de 900;
    - R11: la firma lanza.
  - `tests/unit/asignaciones/get-execution-evidence.test.ts`:
    - R1;
    - R3: Administrador sin `dashboard.consultar` y rol cualquiera con él;
    - R5: malformado, inexistente y de otra empresa;
    - R29: empresa A pide un pedido de B, `order_not_found` y `createSignedReadUrls` sin llamar.
  - `tests/unit/asignaciones/get-order-evidence.test.ts`: R2 (con `inventario.consultar` y sin
    `pedidos.consultar`), R3, R5 y R29.
  - `tests/unit/asignaciones/count-order-evidence.test.ts`:
    - R2, R3;
    - R6: 26 ids, un id no uuid, duplicados, lista vacía sin llamar al puerto;
    - solo salen pedidos con fotos.
  - `tests/unit/asignaciones/order-evidence-actions.test.ts`: traduce `unauthorized`, `invalid_input`
    y `order_not_found` por `code`, y escribe `signingFailure` en el log.
  - `tests/unit/asignaciones/execution-trace-actions.test.ts` (ampliado): `getExecutionEvidenceAction`.
- `tests/unit/asignaciones/actor.test.ts`, el existente o uno nuevo (verificar):
  `canConsultOrderEvidence` no lanza y falla cerrado.
- `tests/unit/inventario/list-finished-product-batches.test.ts` (ampliado): devuelve `orderId`, o
  `null` en un lote sin pedido.
- `tests/unit/identity/session-once-per-request-actions.test.ts`: + fila de
  `order-evidence-actions.ts`.

**Hecho cuando:** todos los tests nombrados están en verde y `guard-autorizacion-por-permiso` está
en verde.

## Bloque F — frontend (`frontend_dev`)

### [x] F0 [P] — Extensión de `StepEvidence` y piezas compartidas (depende de T0; en paralelo con B1/B2)

- `components/shared/step-evidence/step-evidence.tsx`:
  - props `consult`, `heading` y `onReload`;
  - tile `loading`;
  - esqueleto hasta `onLoad`;
  - «Vista vencida» con `onError`;
  - textos nuevos en `STEP_EVIDENCE_TEXTS` (`design.md > 6.1`).
- `components/shared/step-evidence/evidence-read-error.tsx` (nuevo).
- `components/shared/step-evidence/evidence-step-list.tsx` (nuevo).
- `components/shared/step-evidence/index.ts`: exporta las dos piezas nuevas.
- `components/shared/CATALOGO.md`:
  - fila de `StepEvidence` al día (puntos de extensión y celda Diseño con los seis tableros de
    QC-271);
  - piezas nuevas en la misma fila o en filas propias.
- Tests:
  - `tests/unit/shared-ui/step-evidence.test.tsx` (ampliado):
    - R20: modo consulta sin añadir, cambiar ni quitar; visor con «Foto n del paso N»;
    - R21: sin «Fijada al terminar», sin «Obligatoria…» y sin textos de ayuda; los casos actuales
      de ejecución y `readOnly` intactos;
    - R22: esqueleto hasta `onLoad` y tile `loading`;
    - R24: `onError` da «Vista vencida» y «Recargar» llama a `onReload`; sin `onReload` no hay
      botón.
  - `tests/unit/shared-ui/evidence-step-list.test.tsx` (nuevo):
    - R8: rótulo «Paso N» y orden;
    - R23: grupo con `photos: null` pinta el aviso y «Reintentar» llama a `onRetry`;
    - R25: lista vacía no pinta nada.

**Hecho cuando:** los dos tests están en verde, `step-evidence` sigue verde en los tests de
ejecución y empaque que ya lo usan, y la fila del catálogo está al día.

### [x] F1 [P] — Recorrido (depende de F0; trabaja contra la action mockeada y la fixture)

- `app/(private)/dashboard/recorrido/[id]/page.tsx`: `Promise.all` con
  `getExecutionEvidenceAction`; `notFound()` solo por el recorrido.
- `app/(private)/dashboard/recorrido/[id]/components/trace-evidence-placement.ts` (nuevo, puro).
- `app/(private)/dashboard/recorrido/[id]/components/trace-step-evidence.tsx`,
  `trace-other-steps-evidence.tsx` y `trace-packing-evidence.tsx` (nuevos, `'use client'`).
- `app/(private)/dashboard/recorrido/[id]/components/execution-timeline.tsx`,
  `execution-trace-detail.tsx` e `index.ts`.
- Tests:
  - `tests/ui/dashboard/trace-evidence-placement.test.ts` (nuevo):
    - R12: un paso repetido va a la última anotación;
    - R13: un paso sin anotación va a `others`;
    - ninguna foto de envasado se coloca en una anotación.
  - `tests/ui/dashboard/execution-trace-evidence.test.tsx` (nuevo):
    - R12–R14: fotos bajo la anotación, «Otros pasos con fotos», tarjeta «Envasado» con total y
      «Paso N»;
    - R15: lectura en error con anotaciones y stats iguales y un único aviso;
    - R25: sin fotos no hay bloque, tarjeta ni aviso;
    - R23, R24: «Reintentar» y «Recargar» llaman a `router.refresh`.
  - `tests/unit/dashboard-route-contract.test.ts` (ampliado), R26: sin `step-evidence-actions` ni
    `uploadEvidence`.
  - Dobles de `getExecutionEvidenceAction` en:
    - `tests/ui/dashboard/execution-trace-detail.test.tsx`;
    - `tests/unit/paridad/recorridos-paridad.test.tsx`;
    - `tests/unit/navegacion/pantallas-exigen-permiso.test.tsx`;
    - `tests/unit/dashboard-page.test.tsx`, si lo necesita (verificar).

**Hecho cuando:** los tests nombrados están en verde y se comprueba a mano en escritorio, tablet y
teléfono contra `RecorridoEvidencia*.dc.html`.

### [x] F2 [P] — Ficha, pestaña Lotes (depende de F0; trabaja contra las actions mockeadas)

- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-list-section.tsx`:
  `canConsultOrderEvidence` y `countOrderEvidenceAction` (`design.md > 6.3`).
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-batches-table.tsx`:
  la columna «Evidencia».
- `app/(private)/inventario/producto-terminado/[id]/components/batch-evidence-button.tsx` y
  `batch-evidence-dialog.tsx` (nuevos, `'use client'`).
- `app/(private)/inventario/producto-terminado/[id]/components/index.ts`.
- Tests:
  - `tests/unit/inventario-ui/finished-product-batches-evidence.test.tsx` (nuevo):
    - R4: sin permiso no hay columna ni llamada; un conteo que falla deja la tabla sin columna;
    - R16: botón con «1 foto»/«N fotos» y `aria-label`; «—» sin pedido y sin fotos;
    - R18: tabla sin `card`;
    - R19: dos lotes del mismo pedido muestran lo mismo.
  - `tests/unit/inventario-ui/batch-evidence-dialog.test.tsx` (nuevo):
    - R17: título, grupos «Fabricación» y «Envasado», grupo vacío ausente;
    - R18: clase de pantalla completa en teléfono;
    - R22: casillas `loading` mientras la action está en vuelo;
    - R23: error con «Reintentar» que vuelve a llamar;
    - R24: «Recargar» vuelve a llamar.
  - `tests/unit/inventario-ui/finished-product-tables.test.tsx`: sin regresión con la fila nueva.
  - `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts` (ampliado),
    R26.

**Hecho cuando:** los tests nombrados están en verde y se comprueba a mano en escritorio, tablet y
teléfono contra `ProductoTerminadoEvidencia*.dc.html`.

## [x] TC — Barrido de censos (depende de B1, B2, F0, F1 y F2)

- Repasa `design.md > 7` fila a fila y confirma cada «verificar»:
  - `module-contract` de `asignaciones`;
  - `guard-dobles-e2e`;
  - `guard-dependencias-aprobadas`;
  - migraciones esperadas sin cambio (R30).
- Comprueba que el diff no toca `db/` ni `package.json` (R30).
- Corre `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest related --run <todo el diff>` y
  `pnpm exec vitest run guard`.

**Hecho cuando:** todo lo anterior está en verde y `./init.sh` termina en verde.

## TI — E2E (depende de TC)

- `e2e/consulta-de-evidencia.spec.ts` (nuevo):
  - **Preparación.** Siembra un pedido con anotaciones y fotos guardadas, reutilizando los helpers
    de `e2e/recorrido-ejecucion.spec.ts` y `e2e/detalle-de-producto-terminado.spec.ts`. Las fotos
    se siembran como filas de `order_step_evidence`:
    - fabricación en un paso repetido;
    - envasado en el paso 1.

    El almacenamiento es el doble en memoria (`EVIDENCE_E2E_DOUBLES`), con `page.route` sobre su
    origen para servir la imagen, como en `e2e/ejecucion-receta.spec.ts`.
  - **R27, Administrador.**
    1. Abre `/dashboard/recorrido/<id>`.
    2. Comprueba las fotos de fabricación bajo la última anotación de su paso y la tarjeta
       «Envasado».
    3. Abre la ficha del producto terminado de ese pedido, pestaña Lotes, y comprueba el botón con
       el total.
    4. Abre el diálogo y comprueba los grupos «Fabricación» y «Envasado».
  - **R28, Operador.** Abre la misma ficha, pestaña Lotes, sin columna «Evidencia» y sin ninguna
    foto.
- `tests/guards/guard-identificador-de-request.test.ts`: + `consulta-de-evidencia.spec.ts` en
  `E2E_ESPERADOS`.
- Las listas de E2E que lo exijan (`design.md > 7`).

**Hecho cuando:** `pnpm exec playwright test e2e/consulta-de-evidencia.spec.ts` está en verde en
local y las guardias también.

## TZ — Cierre (depende de TI)

- `progress/impl_QC-271-consulta-de-evidencia-por-paso.md`:
  - el mapa `R<n> → test` completo, de R1 a R30 (`design.md > 10`);
  - la respuesta a P1 y P2 si llegó.
- `progress/features/QC-271.md`: estado y tandas.

**Hecho cuando:** cada R1–R30 tiene un test concreto, verde, y `./init.sh` termina en verde.

## Archivos esperados

Producción:
- `lib/modules/asignaciones/domain/order-evidence.ts`
- `lib/modules/asignaciones/domain/read-order-evidence.ts`
- `lib/modules/asignaciones/domain/get-execution-evidence.ts`
- `lib/modules/asignaciones/domain/get-order-evidence.ts`
- `lib/modules/asignaciones/domain/count-order-evidence.ts`
- `lib/modules/asignaciones/domain/actor.ts`
- `lib/modules/asignaciones/ports/evidence-storage.ts`
- `lib/modules/asignaciones/ports/step-evidence-repository.ts`
- `lib/modules/asignaciones/index.ts`
- `lib/modules/asignaciones/adapters/driving/execution-trace-actions.ts`
- `lib/modules/asignaciones/adapters/driving/order-evidence-actions.ts`
- `lib/modules/asignaciones/adapters/driven/persistence/step-evidence-prisma.ts`
- `lib/modules/asignaciones/adapters/driven/storage/evidence-storage-supabase.ts`
- `lib/modules/asignaciones/adapters/driven/storage/evidence-storage-memory.ts`
- `lib/modules/inventario/domain/finished-product-detail.ts`
- `lib/modules/inventario/domain/list-finished-product-batches.ts`
- `lib/composition/index.ts`
- `components/shared/step-evidence/step-evidence.tsx`
- `components/shared/step-evidence/evidence-read-error.tsx`
- `components/shared/step-evidence/evidence-step-list.tsx`
- `components/shared/step-evidence/index.ts`
- `components/shared/CATALOGO.md`
- `app/(private)/dashboard/recorrido/[id]/page.tsx`
- `app/(private)/dashboard/recorrido/[id]/components/execution-timeline.tsx`
- `app/(private)/dashboard/recorrido/[id]/components/execution-trace-detail.tsx`
- `app/(private)/dashboard/recorrido/[id]/components/trace-evidence-placement.ts`
- `app/(private)/dashboard/recorrido/[id]/components/trace-step-evidence.tsx`
- `app/(private)/dashboard/recorrido/[id]/components/trace-other-steps-evidence.tsx`
- `app/(private)/dashboard/recorrido/[id]/components/trace-packing-evidence.tsx`
- `app/(private)/dashboard/recorrido/[id]/components/index.ts`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-list-section.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-batches-table.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/batch-evidence-button.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/batch-evidence-dialog.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/index.ts`

Tests, fixtures y E2E:
- `tests/fixtures/order-evidence.ts`
- `tests/fixtures/finished-product-detail.ts`
- `tests/unit/asignaciones/evidence-doubles.ts`
- `tests/unit/asignaciones/order-evidence.test.ts`
- `tests/unit/asignaciones/read-order-evidence.test.ts`
- `tests/unit/asignaciones/get-execution-evidence.test.ts`
- `tests/unit/asignaciones/get-order-evidence.test.ts`
- `tests/unit/asignaciones/count-order-evidence.test.ts`
- `tests/unit/asignaciones/order-evidence-actions.test.ts`
- `tests/unit/asignaciones/execution-trace-actions.test.ts`
- `tests/unit/asignaciones/evidence-storage-memory.test.ts`
- `tests/unit/asignaciones/evidence-storage-supabase.test.ts`
- `tests/unit/asignaciones/actor.test.ts`
- `tests/unit/asignaciones/module-contract.test.ts`
- `tests/unit/composition/asignaciones-facade.test.ts`
- `tests/unit/identity/session-once-per-request-actions.test.ts`
- `tests/unit/inventario/list-finished-product-batches.test.ts`
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`
- `tests/unit/inventario-ui/finished-product-batches-evidence.test.tsx`
- `tests/unit/inventario-ui/batch-evidence-dialog.test.tsx`
- `tests/unit/inventario-ui/finished-product-tables.test.tsx`
- `tests/unit/shared-ui/step-evidence.test.tsx`
- `tests/unit/shared-ui/evidence-step-list.test.tsx`
- `tests/unit/dashboard-route-contract.test.ts`
- `tests/unit/dashboard-page.test.tsx`
- `tests/unit/paridad/recorridos-paridad.test.tsx`
- `tests/unit/navegacion/pantallas-exigen-permiso.test.tsx`
- `tests/ui/dashboard/execution-trace-detail.test.tsx`
- `tests/ui/dashboard/trace-evidence-placement.test.ts`
- `tests/ui/dashboard/execution-trace-evidence.test.tsx`
- `tests/integration/asignaciones/step-evidence-repository.int.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `e2e/consulta-de-evidencia.spec.ts`

Progreso:
- `progress/impl_QC-271-consulta-de-evidencia-por-paso.md`
- `progress/features/QC-271.md`
