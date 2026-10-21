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

### T0 — Pase `/design` del panel, antes de aprobar el spec

- [ ] Hacer el tablero del panel en escritorio, tablet y teléfono, con todos sus estados:
  - en curso, error, listo, desaparecida, error de consulta, plegado y solo lectura.
- [ ] El tablero tiene que mostrar lo ya decidido:
  - la sección a todo el ancho debajo de la cabecera (P1);
  - la solo lectura (P2);
  - los rótulos de hoy, ayer y fecha corta (P7).
- [ ] El tablero fija el estado de partida, plegado o desplegado (R39), y el formato de la fecha
  corta (R33).
- [ ] El humano lo aprueba.
- [ ] Copiar los tableros a `docs/diseno/canvas/PanelTandas*.dc.html`.
- [ ] Citarlos en `design.md`, en la sección «Pase de diseño».

**Hecho cuando:** los tres tableros están en la rama y `design.md` los cita. Solo entonces se pide
la aprobación del spec.

## Bloque 1: trazabilidad de lo que ya existe (Dep.: ninguna)

### T1 [P] — Renombrar los tests del backend

- [ ] Renombrar los casos de `document-batch-repository-prisma.test.ts`, `get-batch-status.test.ts`
  y `batch-status.test.ts` a R1–R4 de este spec.
- [ ] No tocar ninguna aserción.

**Hecho cuando:** los tests están en verde y cada uno de R1–R4 aparece en al menos un caso.

### T2 [P] — Renombrar los tests del panel y del envoltorio

- [ ] Renombrar los casos de `document-batch-panel.test.tsx` y `formula-pdf-upload.test.tsx` a
  R5–R14 y R16.
- [ ] Retirar el caso «con la subida deshabilitada el panel tampoco se pinta»: lo sustituye la R35.

**Hecho cuando:** los tests están en verde y cada uno de esos `R<n>` aparece en al menos un caso.

## Bloque 2: registro robusto, con ámbito y entre pestañas (Dep.: ninguna)

### T3 — Tests del registro (en rojo)

- [ ] Crear `tests/unit/documentos-ui/batch-memory.test.ts` con `vi.resetModules()` y casos para:
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

- [ ] Reescribir `batch-memory.ts` según la sección 2.3 del diseño:
  - ámbito como primer argumento;
  - clave `document-upload-remembered-batches:<userId>:<companyId>`;
  - hidratación por ámbito;
  - listener de `storage` mientras haya oyentes;
  - leer, fusionar y escribir;
  - borrado de la clave global antigua.
- [ ] Ajustar `use-remembered-batches.ts` a `(scope, strategy)` con la foto cacheada por ámbito.

**Hecho cuando:** T3 está en verde, la guardia R15 de `document-upload-convenciones.test.ts` sigue en
verde y no hay `.subscribe(` en la carpeta.

### T5 [P] — Leer `userId` y `companyId` en el servidor

- [ ] Localizar el acceso al `SessionContext` que ya existe.
- [ ] Si `page.tsx` no puede leer `companyId` sin ampliar `SessionUser`, añadir una lectura en el
  módulo `documentos` que devuelva solo `{ userId, companyId }`.
  - Escribir antes su test: `tests/unit/documentos/remembered-batches-scope.test.ts`.

**Hecho cuando:**
- `page.tsx` tiene los dos identificadores sin tocar `SessionUser`;
- la guardia de arquitectura de módulos sigue en verde.

### T6 — Conectar el ámbito (Dep.: T4, T5)

- [ ] `page.tsx` construye `registryScope = "<userId>:<companyId>"` y lo pasa a la ventana y al
  panel.
- [ ] `registryScope` es opcional en la ventana: sin ella, no se registra nada.
- [ ] Actualizar los tests existentes del panel y del envoltorio para que pasen el ámbito.

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

**Hecho cuando:**
- T7 está en verde;
- `use-batch-status.test.tsx` y `document-upload-*.test.tsx` siguen en verde sin tocarlos.

## Bloque 4: textos, accesibilidad, ubicación y solo lectura (Dep.: T0)

### T9 [P] — Tope de «Intento N de M» y rótulos

- [ ] Escribir primero `tests/unit/documentos-ui/labels.test.ts` con estos casos:
  - R32: los valores 0→1, 2→2 y 5→4 sobre un tope de 4;
  - R33: con un `now` fijo, «Tanda de hoy, 14:32», «Tanda de ayer, 14:32», la fecha corta y
    « · 3 archivos»;
  - R34: «Descartar la tanda de hoy, 14:32».
- [ ] Acotar `attemptLabel`.
- [ ] Añadir `batchLabel` y `discardBatchLabel` en `labels.ts`.

**Hecho cuando:** el test está en verde y la fecha corta coincide con el tablero.

### T10 — Panel accesible y plegable (Dep.: T0, T6, T9)

- [ ] Escribir primero en `document-batch-panel.test.tsx` estos casos:
  - R34: un nombre accesible único por «Descartar» y por bloque;
  - R39: plegar oculta la lista y deja el título y el control; desplegar la muestra.
- [ ] En `document-batch-panel.tsx`:
  - `aria-labelledby` en cada bloque;
  - `aria-label` en «Descartar»;
  - `Collapsible` con el estado de partida del tablero;
  - quitar `PANEL_BATCH_LABEL` si queda sin uso.

**Hecho cuando:** los casos están en verde y la pantalla coincide con el tablero.

### T11 — Ubicación y solo lectura (Dep.: T0, T6, T10)

- [ ] Escribir primero estos casos:
  - R17 en `formulas-upload.test.tsx` y `formula-pdf-upload.test.tsx`: el panel queda fuera de
    `actions`, debajo de la cabecera;
  - R35 en `formula-pdf-upload.test.tsx`: con `disabled`, el panel muestra el estado, «Revisar» y
    «Descartar», sin acción de subida.
- [ ] Partir `formula-pdf-upload.tsx`: la ventana sigue en `actions` y el panel va en una sección a
  todo el ancho que monta `page.tsx`.
- [ ] Quitar el `return null` por `disabled` en `document-batch-panel.tsx`.

**Hecho cuando:**
- los casos están en verde;
- la pantalla coincide con el tablero en escritorio, tablet y teléfono, con botones `touch` y
  `text-base`.

### T12 [P] — Hidratación (Dep.: T4)

- [ ] Añadir a `document-batch-panel.test.tsx` el caso R15: `renderToString` da una salida vacía, y
  al hidratar no hay aviso.

**Hecho cuando:** el caso está en verde.

## Bloque 5: formato y catálogo (Dep.: bloques 2, 3 y 4)

### T13 — Formato

- [ ] Escribir primero el caso R36/R37 en `document-upload-convenciones.test.ts`: salto de línea
  final y como mucho 100 columnas, **solo** en los archivos de producción de esta feature.
- [ ] Restaurar el salto de línea final de los 12 archivos.
- [ ] Partir las líneas de más de 100 columnas.
- [ ] No tocar `docs/` ni `eslint.config.mjs`.

**Hecho cuando:** el caso está en verde y `git diff` no muestra «\ No newline at end of file».

### T14 — Fila del catálogo

- [ ] Escribir primero el caso R38 en `document-upload-convenciones.test.ts`.
- [ ] Actualizar la fila 69 de `CATALOGO.md`:
  - el punto que falta;
  - quitar «entre pestañas» de lo no cubierto;
  - el almacén de sondeo compartido;
  - `registryScope`;
  - la solo lectura y el pliegue;
  - la columna `Diseño` con los tableros de T0.

**Hecho cuando:** el caso R38 y `guard-catalogo-de-componentes.test.ts` están en verde.

## Bloque 6: cierre (Dep.: todo lo anterior)

### T15 — Informe y mapa de trazabilidad

- [ ] Escribir `progress/impl_QC-306-pdf-status-panel.md` con el mapa R1–R39 → test, sin entradas
  vacías salvo R18 y R28, que están retirados.
- [ ] Pasar `./init.sh` en verde.

**Hecho cuando:** cada `R<n>` vigente apunta a un caso concreto, y `./init.sh` termina en verde.

## Archivos esperados

### Diseño
- `docs/diseno/canvas/PanelTandas.dc.html`
- `docs/diseno/canvas/PanelTandasTablet.dc.html`
- `docs/diseno/canvas/PanelTandasMovil.dc.html`

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
- `progress/impl_QC-306-pdf-status-panel.md`
