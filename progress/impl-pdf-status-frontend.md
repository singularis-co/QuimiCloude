# impl — pdf-status-panel (mitad frontend)

Memoria de tandas en el cliente y panel persistente fuera de la ventana de subida: al cerrar el
modal y al navegar dentro de la app, la tanda sigue visible con su intento en curso y su resultado.

El backend (attempts, name, maxAttempts) ya estaba en el arbol sin confirmar: se confirmo tal cual
en su propio commit (683a7e2e) antes de tocar el frontend; no se le anadio ni quito nada.

## Archivos tocados

Produccion (pieza compartida `components/shared/document-upload/`):

- `batch-memory.ts` — NUEVO: registro de batchIds con su estrategia. `localStorage` (clave
  `document-upload-remembered-batches`) + copia en memoria + suscripcion con `Set`; sanitiza lo
  leido con `pdfStrategySchema` (nunca literales) y recorta a `MAX_REMEMBERED_BATCHES` (20).
- `use-remembered-batches.ts` — NUEVO: `useRememberedBatches(strategy)` sobre
  `useSyncExternalStore`; foto de servidor vacia y filtrado por estrategia con `useMemo`
  (el snapshot debe ser estable en referencia).
- `document-batch-panel.tsx` — NUEVO: `DocumentBatchPanel` y los testids `document-upload-panel*`;
  por tanda un bloque con «Descartar», aviso de tanda desaparecida, error de consulta con
  «Reanudar» y las filas reutilizadas.
- `document-upload-row.tsx` — testids con `scope` (por defecto el de siempre, `document-upload-*`;
  el panel pasa `document-upload-panel-row-*`), `phase` opcional (el panel no tiene fase de
  navegador), `maxAttempts` opcional que anade «Intento N de M» (`rowAttemptTestId`).
- `document-upload.tsx` — `rememberBatch(batchId, strategy)` en cuanto `enqueueBatchAction`
  responde con exito. Nada mas.
- `labels.ts` — `attemptLabel`, `PANEL_TITLE`, `PANEL_BATCH_LABEL`, `DISCARD_BATCH_LABEL`.
- `index.ts` — exporta lo nuevo de la pieza.
- `components/shared/CATALOGO.md` — la fila del barrel gana `DocumentBatchPanel` y describe
  memoria, panel, `scope`/`maxAttempts` y los textos nuevos (mismo commit, como pide el catalogo).

Wiring:

- `app/(private)/produccion/formulas/components/formula-pdf-upload.tsx` — renderiza la ventana Y
  el panel con `strategy="formula"` y `formulaImportRoute`; `disabled` pasa tal cual.

Tests:

- `tests/unit/documentos-ui/document-batch-panel.test.tsx` — NUEVO (14 casos). Reset del registro
  entre casos por la API publica (`forgetBatch` de cada `rememberedBatches()`), sin backdoor de
  test.

## Decisiones

**Donde vive la memoria y por que.** En `batch-memory.ts`, dentro de la pieza de subida, y no en
`lib/modules/` ni en `hooks/`: es estado de presentacion del navegador (que tandas encolo ESTE
cliente), no un caso de uso del dominio; el batchId ya viajo al servidor y su estado se consulta
con la accion de siempre. La clave de `localStorage` es estable y esta exportada
(`REMEMBERED_BATCHES_STORAGE_KEY`) para que nada la reescriba a mano.

**Hidratacion sin mismatch.** El panel se pinta solo con la foto de servidor vacia y a partir del
montaje manda la suscripcion: no hay texto que difiera entre servidor y cliente.

**Filtrado por estrategia.** El registro es unico para las dos estrategias, pero el panel solo
muestra las de su `strategy`: una tanda de catalogo con un enlace de revision de formulas seria un
enlace mentiroso. La escritura recuerda la estrategia para que cada vista filtre la suya.

**`scope` en las filas, no testids duplicados.** Con la ventana abierta y el panel montado a la
vez, el mismo archivo pinta dos filas: los `data-testid` heredados (`document-upload-row-*`)
siguen siendo de la ventana y el panel usa `document-upload-panel-row-*`. Los E2E existentes no
colisionan (los prefijos del panel no casan con los selectores que usan).

**«Intento N de M».** `attemptLabel` pinta `max(1, attempts)`: con 0 reclamos la primera entrega
sigue en camino y «intento 1 de N» es lo unico honesto. La ventana no pasa `maxAttempts`, asi que
sus filas quedan exactamente como antes.

**Sondeo.** Ninguno nuevo: cada tanda del panel usa el `useBatchStatus` de siempre (para al
terminar; una sola consulta por tanda terminada al volver a la pantalla). Descartar saca la tanda
del registro y el bloque se desmonta solo.

**Permiso.** El panel no pregunta nada: hereda `disabled` del envoltorio, y la pagina ni monta
`FormulaPdfUpload` sin permiso, asi que no hay rama nueva de autorizacion.

## Mapa R<n> -> test (`tests/unit/documentos-ui/document-batch-panel.test.tsx`)

- R1 registro al encolar: «al encolar con exito, la tanda queda en el registro con su estrategia»,
  «un encolado que falla no deja ninguna tanda en el registro», «la tanda recordada sobrevive al
  desmontaje: el panel la encuentra despues», «el panel solo sondea las tandas de su estrategia»,
  «pasado el tope, se descartan las tandas mas viejas».
- R2 panel en curso/resultado: «con la tanda en curso muestra nombre, estado e intento N de M»
  (2 de 4 con reclamo; 1 de 4 sin reclamo), «un archivo terminado en error muestra el mensaje del
  catalogo y su motivo, y la tanda sigue visible», «un archivo listo ofrece el enlace a su
  revision».
- R3 ciclo de vida: «una tanda terminada se puede descartar del registro», «una tanda que ya no
  existe se muestra como desconocida y se puede descartar», «sin tandas recordadas el panel no se
  pinta», «un error de consulta se muestra y Reanudar vuelve a sondear».
- R4 wiring: «FormulaPdfUpload pinta el panel junto a la ventana, con la ruta de revision de
  formulas», «con la subida deshabilitada el panel tampoco se pinta».
- R5 etiquetas/testids: textos de `labels.ts` (`attemptLabel` -> «Intento 2 de 4»,
  `UNKNOWN_BATCH_LABEL`) y testids `document-upload-panel*` ejercitados en los casos de R2 y R3;
  las guardias de convenciones vigilan el patron del prefijo y que nada se escriba a mano.
- R6: el propio archivo; E2E no se anaden. Verificado ademas contra los selectores de
  `e2e/*.spec.ts` que ya usan `document-upload-row-*`: los del panel no casan con ninguno.

## Salida de los comandos

- `pnpm typecheck` — limpio, sin errores.
- `pnpm exec eslint <los 9 archivos tocados>` — sin hallazgos.
- `pnpm exec vitest related --run <los 8 de produccion + el de tests>` — «Test Files 64 passed
  (64)», «Tests 1033 passed | 1 skipped (1034)». Incluye los afectados del modal y de la pantalla
  de formulas; el skip es previo, no de esta feature.
- `pnpm exec vitest run --project ui tests/unit/documentos-ui/document-batch-panel.test.tsx` —
  «Test Files 1 passed (1)», «Tests 14 passed (14)».
- `pnpm exec vitest run --project node tests/unit/documentos-ui/document-upload-convenciones.test.ts
  tests/guards/guard-catalogo-de-componentes.test.ts tests/guards/guard-arquitectura-modulos.test.ts`
  — «Test Files 3 passed (3)», «Tests 133 passed (133)»: la fila del catalogo y las guardias que
  leen la carpeta de la pieza, en verde.

Nota de entorno: las herramientas de edicion siguen bloqueadas sobre `.worktrees/` (mismo motivo
que anoto el backend); los archivos se escribieron con PowerShell, UTF-8 sin BOM y finales LF,
verificados con lecturas y con `git diff`.

## Veredicto

Frontend listo: la tanda recordada sobrevive fuera de la ventana con su intento y su resultado,
se descarta por tanda y la vista de formulas la pinta junto al boton de subida; typecheck, lint,
related y guardias en verde.