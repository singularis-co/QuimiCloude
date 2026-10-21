# QC-306 — pdf-status-panel: tareas

Leyenda:
- `[P]`: se puede hacer en paralelo con las demás `[P]` del mismo bloque.
- «Dep.»: las tareas que tienen que estar hechas antes.

Los tests van primero donde aplica: cada tarea de código tiene antes su tarea de test, que tiene que
estar en rojo.

Verificación de cada tanda: `pnpm run typecheck`, `pnpm run lint` y
`pnpm exec vitest related --run <archivos>` (`docs/perfil-agentes.md > Todos los agentes`).

Las decisiones P1–P8 están cerradas (2026-10-21). R18 y R28 están retirados.

## Bloque 0: puerta humana (bloqueante, P6)

### T0 — Pase `/design` del panel, antes de aprobar el spec (CERRADA, 2026-10-21)

- [x] Hacer el tablero en escritorio, tablet y teléfono, más una hoja de estados.
- [x] El humano lo aprueba (2026-10-21).
- [x] Copiar a `docs/diseno/canvas/`: `PanelTandas.dc.html`, `PanelTandasEstados.dc.html`,
  `PanelTandasTablet.dc.html` y `PanelTandasMovil.dc.html`, registrados en `canvas.json`.
- [x] Citarlos en `design.md`, en la sección «Pase de diseño».
- [x] Pasar a requisitos lo que fijó el tablero: R33, R35, R39, R40 y R41.

**Hecho:** los cuatro tableros están en la rama y `design.md` los cita.

## Bloque 1: trazabilidad de lo que ya existe (Dep.: ninguna)

### T1 [P] — Renombrar los tests del backend

- [x] Renombrar los casos de `document-batch-repository-prisma.test.ts`, `get-batch-status.test.ts`
  y `batch-status.test.ts` a R1–R4 de este spec.
- [x] No tocar ninguna aserción.

**Hecho cuando:** los tests están en verde y cada uno de R1–R4 aparece en al menos un caso.

### T2 [P] — Renombrar los tests del panel y del envoltorio

- [x] Renombrar los casos de `document-batch-panel.test.tsx` y `formula-pdf-upload.test.tsx` a
  R5–R14 y R16.
- [x] Retirar el caso «con la subida deshabilitada el panel tampoco se pinta»: lo sustituye la R35.

**Hecho cuando:** los tests están en verde y cada uno de esos `R<n>` aparece en al menos un caso.

## Bloque 2: registro robusto, con ámbito y entre pestañas (Dep.: ninguna)

### T3 — Tests del registro (en rojo)

- [x] Crear `tests/unit/documentos-ui/batch-memory.test.ts` con `vi.resetModules()` y casos para:
  - lo precargado sobrevive a la recarga (R19);
  - JSON corrupto y un valor que no es lista (R20);
  - forma antigua (R21);
  - `setItem` que lanza (R22);
  - `getItem` que lanza (R23);
  - la clave `…:<userId>:<companyId>` aísla ámbitos y el valor solo tiene las tres claves (R26,
    R27);
  - la clave global antigua se borra (R29);
  - `StorageEvent` (R30);
  - leer, fusionar y escribir con otra pestaña (R31).

**Hecho cuando:** los casos fallan por la razón esperada, no por un error de importación.

### T4 — Implementar el registro (Dep.: T3)

- [x] Reescribir `batch-memory.ts` según la sección 2.3 del diseño:
  - ámbito como primer argumento;
  - clave `document-upload-remembered-batches:<userId>:<companyId>`;
  - hidratación por ámbito;
  - listener de `storage` mientras haya oyentes;
  - leer, fusionar y escribir;
  - borrado de la clave global antigua.
- [x] Ajustar `use-remembered-batches.ts` a `(scope, strategy)` con la foto cacheada por ámbito.

**Hecho cuando:** T3 está en verde, la guardia R15 de `document-upload-convenciones.test.ts` sigue en
verde y no hay `.subscribe(` en la carpeta.

### T5 [P] — Leer `userId` y `companyId` en el servidor

- [x] Localizar el acceso al `SessionContext` que ya existe.
- [x] Si `page.tsx` no puede leer `companyId` sin ampliar `SessionUser`, añadir una lectura en el
  módulo `documentos` que devuelva solo `{ userId, companyId }`.
  - **Resuelto sin código nuevo:** `page.tsx` ya importa `identity` de `@/lib/composition`, y
    `identity.getSessionContext()` devuelve `{ userId, companyId, roleName }` sin tocar `SessionUser`.
  - Escribir antes su test: `tests/unit/documentos/remembered-batches-scope.test.ts`.

**Hecho cuando:**
- `page.tsx` tiene los dos identificadores sin tocar `SessionUser`;
- la guardia de arquitectura de módulos sigue en verde.

### T6 — Conectar el ámbito (Dep.: T4, T5)

- [x] `page.tsx` construye `registryScope = "<userId>:<companyId>"` y lo pasa a la ventana y al
  panel.
- [x] `registryScope` es opcional en la ventana: sin ella, no se registra nada.
- [x] Actualizar los tests existentes del panel y del envoltorio para que pasen el ámbito.

**Hecho cuando:**
- `document-batch-panel.test.tsx`, `formula-pdf-upload.test.tsx` y `formulas-upload.test.tsx`
  están en verde;
- la suite `document-upload-*.test.tsx` de la ventana sigue en verde sin tocarla.

## Bloque 3: una sola consulta por tanda (Dep.: ninguna; puede ir en paralelo con el bloque 2)

### T7 [P] — Tests del almacén de sondeo (en rojo)

- [ ] Crear `tests/unit/documentos-ui/batch-status-store.test.tsx` con casos para:
  - dos consumidores de la misma tanda dan una sola llamada por intervalo y nunca dos en vuelo
    (R24);
  - remontar una tanda terminada o desaparecida no hace ninguna llamada (R25);
  - tras `vi.resetModules()`, una tanda terminada da exactamente una llamada y no se vuelve a armar
    el temporizador (R25);
  - `resume` sobre la entrada compartida vuelve a consultar.

**Hecho cuando:** los casos fallan contra el `useBatchStatus` actual.

### T8 — Implementar el almacén (Dep.: T7)

- [ ] Crear `batch-status-store.ts` (sección 2.4 del diseño).
- [ ] Hacer que `useBatchStatus` se apoye en él sin cambiar `UseBatchStatusResult`.
- [ ] No persistir ninguna foto (P5).
  - **PARADA (2026-10-21):** la memoria de módulo de R25 rompe 7 casos de
    `use-batch-status.test.tsx` y `document-upload-errors.test.tsx`, que reutilizan `batch-1` sin
    reiniciar el módulo. Espera decisión humana.

**Hecho cuando:**
- T7 está en verde;
- `use-batch-status.test.tsx` y `document-upload-*.test.tsx` siguen en verde sin tocarlos.

## Bloque 4: textos, accesibilidad, ubicación y solo lectura (Dep.: T0)

### T9 [P] — Tope de «Intento N de M» y rótulos

- [x] Escribir primero `tests/unit/documentos-ui/labels.test.ts` con estos casos:
  - R32: los valores 0→1, 2→2 y 5→4 sobre un tope de 4;
  - R33: con un `now` fijo, «Tanda de hoy, 14:32», «Tanda de ayer, 14:32», «Tanda del 15/10, 09:12»
    (sin año en el año actual y con él en otro año) y « · 3 archivos»;
  - R34: «Descartar la tanda de hoy, 14:32»;
  - R40: «Reanudar la tanda de hoy, 10:47»;
  - R41: «1 en curso», «Todas terminadas», «1 con errores» y «1 en curso · 1 con errores»; una
    tanda en curso con un archivo en error cuenta en las dos partes; una tanda desconocida sola da
    «Todas terminadas»;
  - R35: el texto exacto del aviso de solo lectura.
- [x] Acotar `attemptLabel`.
- [x] Añadir a `labels.ts` `batchLabel`, `discardBatchLabel`, `resumeBatchLabel`, `batchesSummary` y
  `READ_ONLY_NOTICE`.

**Hecho cuando:** el test está en verde.

### T10 — Panel accesible y plegable (Dep.: T0, T6, T9)

- [ ] Escribir primero en `document-batch-panel.test.tsx` estos casos:
  - R34: un nombre accesible único por «Descartar» y por bloque;
  - R40: un nombre accesible único por «Reanudar»;
  - R39: arranca desplegado; plegar oculta la lista y deja el título y el control; desplegar la
    muestra;
  - R41: el contador coincide con las tandas visibles, y el resumen sigue visible con el panel
    plegado.
  - **Hecho salvo R41** (contador y resumen de la cabecera): espera la decisión sobre T8.
- [ ] En `document-batch-panel.tsx`:
  - `aria-labelledby` en cada bloque;
  - `aria-label` en «Descartar» y en «Reanudar»;
  - `Collapsible` abierto de partida;
  - cabecera con contador y resumen;
  - quitar `PANEL_BATCH_LABEL` si queda sin uso.

**Hecho cuando:** los casos están en verde y la pantalla coincide con el tablero.

### T11 — Ubicación y solo lectura (Dep.: T0, T6, T10)

- [x] Escribir primero estos casos:
  - R17 en `formulas-upload.test.tsx` y `formula-pdf-upload.test.tsx`: el panel queda fuera de
    `actions`, debajo de la cabecera;
  - R35 en `formula-pdf-upload.test.tsx`: con `disabled`, el panel muestra el estado, «Revisar»,
    «Descartar» y el aviso con el texto exacto, sin acción de subida.
- [x] Partir `formula-pdf-upload.tsx`: la ventana sigue en `actions` y el panel va en una sección a
  todo el ancho que monta `page.tsx`.
- [x] Quitar el `return null` por `disabled` en `document-batch-panel.tsx`.

**Hecho cuando:**
- los casos están en verde;
- la pantalla coincide con el tablero en escritorio, tablet y teléfono, con botones `touch` y
  `text-base`.

### T12 [P] — Hidratación (Dep.: T4)

- [x] Añadir a `document-batch-panel.test.tsx` el caso R15: `renderToString` da una salida vacía, y
  al hidratar no hay aviso.

**Hecho cuando:** el caso está en verde.

## Bloque 5: formato y catálogo (Dep.: bloques 2, 3 y 4)

### T13 — Formato

- [x] Escribir primero el caso R36/R37 en `document-upload-convenciones.test.ts`: salto de línea
  final y como mucho 100 columnas, **solo** en los archivos de producción de esta feature.
- [x] Restaurar el salto de línea final de los 12 archivos.
- [x] Partir las líneas de más de 100 columnas.
- [x] No tocar `docs/` ni `eslint.config.mjs`.

**Hecho cuando:** el caso está en verde y `git diff` no muestra «\ No newline at end of file».

### T14 — Fila del catálogo

- [x] Escribir primero el caso R38 en `document-upload-convenciones.test.ts`.
- [x] Actualizar la fila 69 de `CATALOGO.md`:
  - el punto que falta;
  - quitar «entre pestañas» de lo no cubierto;
  - el almacén de sondeo compartido;
  - `registryScope`;
  - la solo lectura, el pliegue y el resumen de la cabecera;
  - en la columna `Diseño`, citar `docs/diseno/canvas/PanelTandas.dc.html` en lugar de
    `Formulas.dc.html` y `ModalesProduccion.dc.html` para `DocumentBatchPanel`.

**Hecho cuando:** el caso R38 y `guard-catalogo-de-componentes.test.ts` están en verde.

## Bloque 6: cierre (Dep.: todo lo anterior)

### T15 — Informe y mapa de trazabilidad

- [ ] Escribir `progress/impl_QC-306.md` con el mapa R1–R41 → test, sin entradas
  vacías salvo R18 y R28, que están retirados.
- [ ] Pasar `./init.sh` en verde.

**Hecho cuando:** cada `R<n>` vigente apunta a un caso concreto, y `./init.sh` termina en verde.

## Archivos esperados

### Diseño
- `docs/diseno/canvas/PanelTandas.dc.html`
- `docs/diseno/canvas/PanelTandasEstados.dc.html`
- `docs/diseno/canvas/PanelTandasTablet.dc.html`
- `docs/diseno/canvas/PanelTandasMovil.dc.html`
- `docs/diseno/canvas/canvas.json`

### Pieza de subida
- `components/shared/document-upload/batch-memory.ts`
- `components/shared/document-upload/use-remembered-batches.ts`
- `components/shared/document-upload/use-batch-status.ts`
- `components/shared/document-upload/batch-status-store.ts`
- `components/shared/document-upload/document-batch-panel.tsx`
- `components/shared/document-upload/document-upload-row.tsx`
- `components/shared/document-upload/document-upload.tsx`
- `components/shared/document-upload/document-upload-dialog.tsx`
- `components/shared/document-upload/labels.ts`
- `components/shared/document-upload/index.ts`
- `components/shared/CATALOGO.md`

### Pantalla de fórmulas
- `app/(private)/produccion/formulas/components/formula-pdf-upload.tsx`
- `app/(private)/produccion/formulas/components/index.ts`
- `app/(private)/produccion/formulas/page.tsx`

### Módulo `documentos` (solo si T5 lo necesita)
- `lib/modules/documentos/adapters/driving/remembered-batches-scope.ts`
- `lib/modules/documentos/index.ts`

### Tests
- `tests/unit/documentos-ui/batch-memory.test.ts`
- `tests/unit/documentos-ui/batch-status-store.test.tsx`
- `tests/unit/documentos-ui/labels.test.ts`
- `tests/unit/documentos-ui/document-batch-panel.test.tsx`
- `tests/unit/documentos-ui/formula-pdf-upload.test.tsx`
- `tests/unit/documentos-ui/formulas-upload.test.tsx`
- `tests/unit/documentos-ui/document-upload-convenciones.test.ts`
- `tests/unit/documentos-ui/helpers.ts`
- `tests/unit/documentos/remembered-batches-scope.test.ts`
- `tests/unit/documentos/document-batch-repository-prisma.test.ts`
- `tests/unit/documentos/get-batch-status.test.ts`
- `tests/unit/documentos/batch-status.test.ts`

### Spec y progreso
- `specs/QC-306-pdf-status-panel/requirements.md`
- `specs/QC-306-pdf-status-panel/design.md`
- `specs/QC-306-pdf-status-panel/tasks.md`
- `progress/impl_QC-306.md`
