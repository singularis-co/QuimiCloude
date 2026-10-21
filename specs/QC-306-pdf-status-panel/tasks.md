# QC-306 — pdf-status-panel: tareas

Leyenda:
- `[P]`: se puede hacer en paralelo con las demás `[P]` del mismo bloque.
- «Dep.»: las tareas que tienen que estar hechas antes.

Los tests van primero donde aplica: cada tarea de código tiene antes su tarea de test, que tiene que
estar en rojo.

Verificación de cada tanda: `pnpm run typecheck`, `pnpm run lint` y
`pnpm exec vitest related --run <archivos>` (`docs/perfil-agentes.md > Todos los agentes`).

## Bloque 0: puertas humanas (bloqueantes)

### T0 — Pase `/design` del panel

- [ ] Hacer el tablero del panel en escritorio, tablet y teléfono, con todos sus estados:
  - en curso, error, listo, desaparecida, error de consulta, vacío y subida deshabilitada.
- [ ] Resolver en el tablero la ubicación (P1), el comportamiento con la subida deshabilitada (P2) y
  el rótulo (P7).
- [ ] El humano lo aprueba.
- [ ] Copiar los tableros a `docs/diseno/canvas/PanelTandas*.dc.html`.
- [ ] Citarlos en `design.md`, en la sección «Pase de diseño».

**Hecho cuando:** los tres tableros están en la rama y `design.md` los cita.

### T0b — Respuestas a P2–P5 y P8

- [ ] Recoger las respuestas del humano a P2, P3, P4, P5 y P8.
- [ ] Ajustar R18, R27, R28, R35 y R37, y las secciones 2.2, 2.5 y 2.6 del diseño.

**Hecho cuando:** `## Preguntas abiertas` solo tiene preguntas respondidas o retiradas.

## Bloque 1: trazabilidad de lo que ya existe (Dep.: ninguna)

### T1 [P] — Renombrar los tests del backend

- [ ] Renombrar los casos de `document-batch-repository-prisma.test.ts`, `get-batch-status.test.ts`
  y `batch-status.test.ts` a R1–R4 de este spec.
- [ ] No tocar ninguna aserción.

**Hecho cuando:** los tests están en verde y cada uno de R1–R4 aparece en al menos un caso.

### T2 [P] — Renombrar los tests del panel y del envoltorio

- [ ] Renombrar los casos de `document-batch-panel.test.tsx` y `formula-pdf-upload.test.tsx` a
  R5–R14, R16 y R17.

**Hecho cuando:** los tests están en verde y cada uno de esos `R<n>` aparece en al menos un caso.

## Bloque 2: registro robusto, con ámbito y entre pestañas (Dep.: T0b para P3 y P4)

### T3 — Tests del registro (en rojo)

- [ ] Crear `tests/unit/documentos-ui/batch-memory.test.ts` con `vi.resetModules()` y casos para:
  - lo precargado sobrevive a la recarga (R19);
  - JSON corrupto y un valor que no es lista (R20);
  - forma antigua (R21);
  - `setItem` que lanza (R22);
  - `getItem` que lanza (R23);
  - el ámbito A no se ve desde el B y lo guardado solo tiene las tres claves (R26, R27);
  - la clave global antigua se borra (R29);
  - `StorageEvent` (R30);
  - leer, fusionar y escribir con otra pestaña (R31).

**Hecho cuando:** los casos fallan por la razón esperada, no por un error de importación.

### T4 — Implementar el registro (Dep.: T3)

- [ ] Reescribir `batch-memory.ts` según la sección 2.3 del diseño:
  - ámbito como primer argumento;
  - hidratación por ámbito;
  - listener de `storage` mientras haya oyentes;
  - leer, fusionar y escribir;
  - `forgetAllRememberedBatches()`;
  - borrado de la clave global antigua.
- [ ] Ajustar `use-remembered-batches.ts` a `(scope, strategy)` con la foto cacheada por ámbito.

**Hecho cuando:** T3 está en verde, la guardia R15 de `document-upload-convenciones.test.ts` sigue en
verde y no hay `.subscribe(` en la carpeta.

### T5 [P] — Ámbito en el servidor (Dep.: T0b para P3)

- [ ] Escribir primero `tests/unit/documentos/remembered-batches-scope.test.ts`:
  - el resultado es determinista;
  - cambia si cambia el usuario o la empresa;
  - no contiene los identificadores en claro.
- [ ] Implementar el helper del módulo `documentos` (sección 2.2 del diseño) con `node:crypto`.

**Hecho cuando:** el test está en verde y la guardia de arquitectura de módulos también.

### T6 — Conectar el ámbito (Dep.: T4, T5)

- [ ] `page.tsx` calcula el ámbito y se lo pasa a `FormulaPdfUpload`.
- [ ] `FormulaPdfUpload` lo pasa a `DocumentUploadDialog`, `DocumentUpload` y `DocumentBatchPanel`.
- [ ] `registryScope` es opcional en la ventana: sin ella, no se registra nada.
- [ ] Actualizar los tests existentes del panel y del envoltorio para que pasen el ámbito.

**Hecho cuando:**
- `document-batch-panel.test.tsx`, `formula-pdf-upload.test.tsx` y `formulas-upload.test.tsx`
  están en verde;
- la suite `document-upload-*.test.tsx` de la ventana sigue en verde sin tocarla.

### T7 — Limpiar al cerrar sesión (Dep.: T4, T0b para P4)

- [ ] Escribir primero el caso R28 en `tests/unit/logout-button.test.tsx`: al enviar, se borran las
  claves con el prefijo y la acción se sigue invocando.
- [ ] Añadir `onSubmit` en `logout-button.tsx`, sin cancelar el envío.

**Hecho cuando:**
- `logout-button.test.tsx` está en verde;
- `guard-formularios-y-acciones.test.ts` sigue en verde.

## Bloque 3: una sola consulta por tanda (Dep.: ninguna; puede ir en paralelo con el bloque 2)

### T8 [P] — Tests del almacén de sondeo (en rojo)

- [ ] Crear `tests/unit/documentos-ui/batch-status-store.test.tsx` con casos para:
  - dos consumidores de la misma tanda dan una sola llamada por intervalo y nunca dos en vuelo
    (R24);
  - remontar una tanda terminada no hace ninguna llamada (R25);
  - remontar una tanda desaparecida no hace ninguna llamada (R25);
  - `resume` sobre la entrada compartida vuelve a consultar.

**Hecho cuando:** los casos fallan contra el `useBatchStatus` actual.

### T9 — Implementar el almacén (Dep.: T8)

- [ ] Crear `batch-status-store.ts` (sección 2.4 del diseño).
- [ ] Hacer que `useBatchStatus` se apoye en él sin cambiar `UseBatchStatusResult`.
- [ ] Que `forgetAllRememberedBatches()` vacíe sus fotos finales (R28). Dep.: T4.

**Hecho cuando:**
- T8 está en verde;
- `use-batch-status.test.tsx` y `document-upload-*.test.tsx` siguen en verde sin tocarlos.

## Bloque 4: textos, accesibilidad y estado deshabilitado (Dep.: T0)

### T10 [P] — Tope de «Intento N de M»

- [ ] Escribir primero `tests/unit/documentos-ui/labels.test.ts` (R32).
- [ ] Acotar `attemptLabel` en `labels.ts`.

**Hecho cuando:** el test está en verde con los valores 0→1, 2→2 y 5→4 sobre un tope de 4.

### T11 — Rótulos accesibles (Dep.: T0, T6)

- [ ] Escribir primero los casos R33 y R34 en `document-batch-panel.test.tsx`: dos tandas dan
  rótulos distintos, y `getByRole('button', { name })` es único.
- [ ] Añadir `batchLabel` y `discardBatchLabel` en `labels.ts`.
- [ ] Añadir `aria-labelledby` y `aria-label` en `document-batch-panel.tsx`.
- [ ] Quitar `PANEL_BATCH_LABEL` si queda sin uso.

**Hecho cuando:** los casos están en verde y el texto coincide con el tablero aprobado.

### T12 — Subida deshabilitada y ubicación (Dep.: T0, T0b para P2, T6)

- [ ] Escribir primero los casos R18/R35 en `formula-pdf-upload.test.tsx` según P2.
- [ ] Ajustar `document-batch-panel.tsx`, y `formula-pdf-upload.tsx` y `page.tsx` si P1 saca el
  panel de la cabecera.

**Hecho cuando:**
- los casos están en verde;
- la pantalla coincide con el tablero en escritorio, tablet y teléfono, con botones `touch` y
  `text-base`.

### T13 [P] — Hidratación (Dep.: T4)

- [ ] Añadir a `document-batch-panel.test.tsx` el caso R15: `renderToString` da una salida vacía, y
  al hidratar no hay aviso.

**Hecho cuando:** el caso está en verde.

## Bloque 5: formato y catálogo (Dep.: bloques 2, 3 y 4)

### T14 — Formato

- [ ] Escribir primero el caso R36/R37 en `document-upload-convenciones.test.ts`.
- [ ] Restaurar el salto de línea final de los 12 archivos.
- [ ] Partir las líneas largas hasta el ancho que confirme P8.

**Hecho cuando:** el caso está en verde y `git diff` no muestra «\ No newline at end of file».

### T15 — Fila del catálogo

- [ ] Escribir primero el caso R38 en `document-upload-convenciones.test.ts`.
- [ ] Actualizar la fila 69 de `CATALOGO.md`:
  - el punto que falta;
  - quitar «entre pestañas» de lo no cubierto;
  - el almacén de sondeo compartido;
  - `registryScope`;
  - la columna `Diseño` con los tableros de T0.

**Hecho cuando:** el caso R38 y `guard-catalogo-de-componentes.test.ts` están en verde.

## Bloque 6: cierre (Dep.: todo lo anterior)

### T16 — Informe y mapa de trazabilidad

- [ ] Escribir `progress/impl_QC-306-pdf-status-panel.md` con el mapa R1–R38 → test, sin entradas
  vacías.
- [ ] Pasar `./init.sh` en verde.

**Hecho cuando:** cada `R<n>` apunta a un caso concreto, y `./init.sh` termina en verde.

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

### Pantalla de fórmulas y cierre de sesión
- `app/(private)/produccion/formulas/components/formula-pdf-upload.tsx`
- `app/(private)/produccion/formulas/page.tsx`
- `app/(private)/components/logout-button.tsx`

### Módulo `documentos` (helper del ámbito, depende de P3)
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
- `tests/unit/logout-button.test.tsx`

### Spec y progreso
- `specs/QC-306-pdf-status-panel/requirements.md`
- `specs/QC-306-pdf-status-panel/design.md`
- `specs/QC-306-pdf-status-panel/tasks.md`
- `progress/impl_QC-306-pdf-status-panel.md`
