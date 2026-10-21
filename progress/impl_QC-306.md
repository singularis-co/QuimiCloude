# QC-306 — pdf-status-panel: bitácora de implementación

Implementer, 2026-10-21. Worktree `.worktrees/QC-306-pdf-status-panel`, rama
`feature/QC-306-pdf-status-panel`. MCP del grafo no usado: Grep y Read.

## Estado

| Tarea | Estado | Commit |
|---|---|---|
| T0 | Cerrada antes (pase de diseño) | — |
| T1 | Hecha | `cc16dcee` |
| T2 | Hecha | `47305d84` |
| T3, T4 | Hechas | `75531528` |
| T5 | Hecha **sin código nuevo**: `identity.getSessionContext()` ya existe | `75531528` |
| T6 | Hecha | `75531528` |
| T7, T8 | **PARADAS**: choque de R25 con tests congelados (ver Bloqueo) | — |
| T9 | Hecha | `7a074b6d` |
| T10 | Hecha **salvo R41** (contador y resumen en la cabecera del panel) | `75531528` |
| T11, T12 | Hechas | `75531528` |
| T13, T14 | Hechas (la fila del catálogo no menciona el almacén de sondeo ni el resumen) | `e4f42656` |
| T15 | Esta bitácora; `./init.sh` lo corre el leader | — |

## Bloqueo: T8 (R24, R25) y, por arrastre, R41 en el panel

El almacén de sondeo por `batchId` (design 2.4) guarda en memoria del módulo las fotos finales para
no volver a consultar (R25). Rompe 7 casos que el diseño exige no tocar, porque reutilizan
`'batch-1'` en todos los casos sin reiniciar el módulo:
- `tests/unit/documentos-ui/use-batch-status.test.tsx`: 5 casos (R8, R10, R23 de QC-160). Cuatro
  esperan `toHaveBeenCalledTimes(1)` y reciben 0; uno espera `queued` y recibe `done`, la foto en
  memoria del caso anterior.
- `tests/unit/documentos-ui/document-upload-errors.test.tsx`: los 2 casos R23. Nunca consultan y
  agotan los 5 s.

Desde producción no se distingue «otro caso de test» de «navegar y volver», que es justo lo que R25
pide recordar. Opciones (cambian el spec o los tests congelados, decide el humano):
1. Exportar `resetBatchStatusStore()` para tests y llamarlo en `beforeEach` de esos dos archivos.
2. Usar un `batchId` distinto por caso en esos dos archivos.
3. Memoria de R25 solo para el panel: `useBatchStatus(batchId, { recordarFinal: true })`. Cambia la
   firma de entrada y design 2.4.
4. Que la ventana olvide la entrada al encolar una tanda nueva. Solo arregla `document-upload-errors`.

El trabajo a medias está apartado, fuera del repo, en
`C:/Users/Cristian/AppData/Local/Temp/claude/C--Users-Cristian-Documents-trabajo-arc-labs/a7a9d6a8-67d9-4d9d-8dc1-ee2e5670d81a/scratchpad/t8/`
(`batch-status-store.ts`, `batch-status-store.test.tsx`, `use-batch-status.patch`). Con ese código,
`batch-status-store.test.tsx` estaba en verde.

R41 en el panel (contador y resumen, T10) espera a T8: el resumen sale de las fotos del almacén.
`batchesSummary` ya está hecha y probada en `labels.ts`.

## Archivos tocados (952785c5..e4f42656)

Producción:
- `components/shared/document-upload/batch-memory.ts`: ámbito, lectura robusta, `storage`,
  leer-fusionar-escribir, borra la clave global antigua.
- `components/shared/document-upload/use-remembered-batches.ts`: `(scope, strategy)`.
- `components/shared/document-upload/document-upload.tsx`, `document-upload-dialog.tsx`:
  `registryScope?`; sin ella no se registra. Formato.
- `components/shared/document-upload/document-batch-panel.tsx`: `registryScope` obligatoria,
  rótulos, `aria-labelledby`, `aria-label` en Descartar y Reanudar, `Collapsible` abierto, solo
  lectura con `READ_ONLY_NOTICE`, sin `return null` por `disabled`.
- `components/shared/document-upload/labels.ts`: `attemptLabel` acotado, `batchLabel`,
  `discardBatchLabel`, `resumeBatchLabel`, `batchesSummary`, `READ_ONLY_NOTICE`; fuera
  `PANEL_BATCH_LABEL`.
- `components/shared/document-upload/index.ts`: export de `PANEL_READ_ONLY_NOTICE_TESTID`, fuera
  `PANEL_BATCH_LABEL`, salto final.
- `components/shared/document-upload/document-upload-row.tsx`, `use-batch-status.ts`: solo formato
  (salto final, líneas ≤ 100; `use-batch-status.ts` solo imports partidos).
- `components/shared/CATALOGO.md`: fila de la pieza (R38).
- `app/(private)/produccion/formulas/page.tsx`: `getSessionContext()` con `canUpload`,
  `registryScope`, `FormulaBatchPanel` debajo de la cabecera con `disabled={!readiness.configured}`.
- `app/(private)/produccion/formulas/components/formula-pdf-upload.tsx`: se parte en
  `FormulaPdfUpload` (ventana) y `FormulaBatchPanel` (panel).
- `app/(private)/produccion/formulas/components/index.ts`: exporta `FormulaBatchPanel`.

Tests:
- Nuevos: `tests/unit/documentos-ui/batch-memory.test.ts`, `tests/unit/documentos-ui/labels.test.ts`.
- Modificados: `tests/unit/documentos-ui/document-batch-panel.test.tsx`, `formula-pdf-upload.test.tsx`,
  `formulas-upload.test.tsx`, `document-upload-convenciones.test.ts`,
  `tests/unit/documentos/batch-status.test.ts`, `document-batch-repository-prisma.test.ts`,
  `get-batch-status.test.ts`.
- Fuera de la lista de `tasks.md`: `tests/unit/recetas-ui/recipe-page.test.tsx` y
  `tests/unit/paridad/recetas-paridad.test.tsx`. Solo añaden `getSessionContext: vi.fn(async () =>
  null)` a su doble de `identity`; sin eso, 54 casos fallaban con `getSessionContext is not a
  function`.

No hay dependencias nuevas, migraciones ni cambios en `docs/` o `eslint.config.mjs`.

## Decisiones de implementación que conviene revisar

- `CollapsibleContent keepMounted`: con el panel plegado, cada tanda sigue sondeando.
- El título del panel es `<h2>` con el botón de pliegue (`aria-expanded`); cada tanda es `<h3>`. El
  tablero usa `h2` para las tandas.
- La píldora de estado por tanda del tablero no se pintó: no está en el spec ni en `labels.ts`.
- `now = useState(Date.now)` (ESLint `react-hooks/purity`): «hoy/ayer» queda fijado al montar.
- Sin contexto de sesión (`getSessionContext()` da `null`), la ventana no registra y el panel no se
  monta.
- `batchesSummary`: una tanda sin foto todavía cuenta como «en curso».

## Mapa R → test

| R | Test (archivo › caso) |
|---|---|
| R1 | `tests/unit/documentos/batch-status.test.ts` › «R1, R4 — DocumentFileStatusEntry lleva exactamente las claves previstas»; `document-batch-repository-prisma.test.ts` › «R1 — pide attempts y originalName ademas de las columnas del estado» |
| R2 | `get-batch-status.test.ts` › «R2 — maxAttempts es la primera entrega mas los reintentos del config, no un literal», «R2 — maxAttempts sigue al config: cambia con el tope y no existe si no hay tanda» |
| R3 | `get-batch-status.test.ts` › «R3, QC-111 R18 — sin permiso rechaza…», «R3, QC-111 R18 — una tanda de OTRA empresa da EXACTAMENTE el mismo rechazo que una inexistente»; `document-batch-repository-prisma.test.ts` › «R3, QC-111 R18 — sin fila de tanda visible en la empresa, devuelve null sin leer los archivos» |
| R4 | `batch-status.test.ts` › «R2, R4 — ReadBatch y BatchStatus llevan exactamente las claves previstas», «R4 — la regla MUERDE: una clave de mas o de menos da lista distinta» |
| R5 | `document-batch-panel.test.tsx` › «R5 — al encolar con exito, la tanda queda en el registro con su estrategia», «R5 — un encolado que falla no deja ninguna tanda en el registro»; `formula-pdf-upload.test.tsx` › «R5 — encola con la estrategia "formula"» |
| R6 | `document-batch-panel.test.tsx` › «R6 — pasado el tope, se descartan las tandas mas viejas» |
| R7 | `document-batch-panel.test.tsx` › «R7 — el panel solo sondea las tandas de su estrategia» |
| R8 | `document-batch-panel.test.tsx` › «R8, R16 — con la tanda en curso muestra nombre, estado e intento N de M» |
| R9 | `document-batch-panel.test.tsx` › «R9 — un archivo terminado en error muestra el mensaje del catalogo y su motivo, y la tanda sigue visible» |
| R10 | `document-batch-panel.test.tsx` › «R10 — un archivo listo ofrece el enlace a su revision»; `formula-pdf-upload.test.tsx` › «R10, R16 — FormulaBatchPanel pinta el panel con la ruta de revision de formulas» |
| R11 | `document-batch-panel.test.tsx` › «R11 — una tanda terminada se puede descartar del registro» |
| R12 | `document-batch-panel.test.tsx` › «R12 — una tanda que ya no existe se muestra como desconocida y se puede descartar» |
| R13 | `document-batch-panel.test.tsx` › «R13 — un error de consulta se muestra y Reanudar vuelve a sondear» |
| R14 | `document-batch-panel.test.tsx` › «R14 — sin tandas recordadas el panel no se pinta» |
| R15 | `document-batch-panel.test.tsx` › «R15 — renderToString da una salida vacia y al hidratar no hay aviso de hidratacion» |
| R16 | `document-batch-panel.test.tsx` › «R5, R16 — la tanda recordada sobrevive al desmontaje…», «R8, R16 — …»; `formula-pdf-upload.test.tsx` › «R10, R16 — en "listo" la fila de la ventana ofrece el enlace a formulaImportRoute(id)» |
| R17 | `formula-pdf-upload.test.tsx` › «R17 — FormulaPdfUpload solo monta la ventana: el panel no va en las acciones», «R17 — FormulaBatchPanel muestra solo las tandas de formula, con su ruta de revision»; `formulas-upload.test.tsx` › «R17 — el panel va a todo el ancho debajo de la cabecera, fuera de sus acciones» |
| R18 | **Retirado (P2)**: sin test |
| R19 | `batch-memory.test.ts` › «R19 muestra tras la recarga las tandas guardadas antes para el mismo ámbito», «R19 lo registrado antes de recargar sigue ahí después de recargar» |
| R20 | `batch-memory.test.ts` › «R20 arranca vacío y sin lanzar con un JSON corrupto», «R20 arranca vacío y sin lanzar con un valor que no es una lista» |
| R21 | `batch-memory.test.ts` › «R21 conserva solo las entradas válidas de una forma antigua o inválida» |
| R22 | `batch-memory.test.ts` › «R22 conserva el registro en memoria sin lanzar si se rechaza la escritura» |
| R23 | `batch-memory.test.ts` › «R23 arranca vacío y sin lanzar si el navegador rechaza la lectura» |
| R24 | **PENDIENTE (T8 parada)**: sin test en la rama |
| R25 | **PENDIENTE (T8 parada)**: sin test en la rama |
| R26 | `batch-memory.test.ts` › «R26 lo registrado en u1:c1 no aparece en u1:c2 ni en u2:c1»; `formulas-upload.test.tsx` › «R26 — la tanda encolada queda en el registro del ambito usuario:empresa de la sesion» |
| R27 | `batch-memory.test.ts` › «R27 guarda en la clave con userId y companyId en claro y solo las tres claves» |
| R28 | **Retirado (P4)**: sin test |
| R29 | `batch-memory.test.ts` › «R29 borra la clave global antigua y no muestra sus tandas» |
| R30 | `batch-memory.test.ts` › «R30 el evento storage de la clave del ámbito avisa y actualiza el registro», «R30 ignora el evento storage de la clave de otro ámbito», «R30 un único listener de storage mientras haya oyentes, quitado con el último» |
| R31 | `batch-memory.test.ts` › «R31 registrar y descartar conserva lo que otra pestaña escribió tras hidratar» |
| R32 | `labels.test.ts` › «R32 — con 0 intentos consumidos dice «Intento 1 de 4»», «R32 — con 2 …», «R32 — si los intentos superan el tope, N se queda en el tope: «Intento 4 de 4»» |
| R33 | `labels.test.ts` › «R33 — una tanda registrada hoy dice «Tanda de hoy, 14:32»», «… ayer …», «R33 — «ayer» es el día civil anterior aunque cambie el año», «… fecha corta sin año», «… con el año», «R33 — con el número de archivos conocido, el rótulo lo añade», «R33 — sin el número de archivos, el rótulo no lo menciona» |
| R34 | `labels.test.ts` › «R34 — «Descartar» nombra su tanda: «Descartar la tanda de hoy, 14:32»», «R34 — «Descartar» usa el día del rótulo también para ayer y la fecha corta»; `document-batch-panel.test.tsx` › «R34 — cada Descartar tiene nombre unico y cada tanda se nombra por su rotulo», «R34 — Descartar por su nombre quita solo esa tanda» |
| R35 | `labels.test.ts` › «R35 — el aviso con la subida deshabilitada tiene el texto exacto»; `formula-pdf-upload.test.tsx` › «R35 — con la subida deshabilitada el panel queda en solo lectura, con su aviso» |
| R36, R37 | `document-upload-convenciones.test.ts` › «R36, R37 — cada archivo termina con salto de línea final y ninguna línea pasa de 100 columnas» |
| R38 | `document-upload-convenciones.test.ts` › «R38 — la fila de DocumentBatchPanel cita en Diseño el tablero del panel y no declara la sincronía entre pestañas como no cubierta» |
| R39 | `document-batch-panel.test.tsx` › «R39 — arranca desplegado; plegar oculta la lista y deja titulo y control», «R39 — desplegar de nuevo vuelve a mostrar la lista» |
| R40 | `labels.test.ts` › «R40 — «Reanudar» nombra su tanda: «Reanudar la tanda de hoy, 10:47»»; `document-batch-panel.test.tsx` › «R40 — con dos tandas en error de consulta, cada Reanudar tiene un nombre unico» |
| R41 | **PARCIAL**: `labels.test.ts` › 9 casos «R41 — …» de `batchesSummary` («1 en curso», «Todas terminadas», «1 con errores», «1 en curso · 1 con errores», doble cuenta, desconocida sola). **Falta** el caso del panel (contador y resumen visibles con el panel plegado), que espera a T8. |

## Salida de los comandos (HEAD `e4f42656`)

Los 23 archivos `.ts`/`.tsx` del diff `952785c5..HEAD`:

```
$ pnpm run typecheck
> tsc --noEmit
(sin errores, exit 0)

$ pnpm exec eslint <23 archivos>
(sin salida, exit 0)

$ pnpm exec vitest related --run <archivos de producción>
 Test Files  66 passed (66)
      Tests  1081 passed | 1 skipped (1082)

$ pnpm exec vitest run <archivos de test del diff>
 Test Files  11 passed (11)
      Tests  185 passed (185)

$ pnpm exec vitest run tests/guards/guard-catalogo-de-componentes.test.ts \
    tests/unit/documentos-ui/document-upload-convenciones.test.ts
 Test Files  2 passed (2)
      Tests  74 passed (74)

$ pnpm exec vitest run guard
 Test Files  85 passed (85)
      Tests  1253 passed | 22 skipped (1275)

$ grep -rn "\.subscribe(" components/shared/document-upload | wc -l
0
```

Rojos previos, de los subagentes:
- T3 `batch-memory.test.ts` en rojo antes de T4. La salida se perdió con el corte de la sesión
  anterior.
- T6: `Tests 2 failed | 25 passed (27)`. T10: `Tests 5 failed | 13 passed (18)`. T11:
  `Tests 4 failed | 14 passed (18)`.
- T13/T14: `Tests 2 failed | 13 passed (15)`. R36/R37: falta el salto final en
  `document-upload-row.tsx`. R38: la fila cita `Formulas.dc.html`.
- Typecheck antes de cerrar T4: 16 errores TS2554 en el panel y su test.
- Con T8 a medias: `use-batch-status.test.tsx` 5 rojos y `document-upload-errors.test.tsx` 2 rojos.
  Por eso se apartó.

Aviso: en una pasada con la máquina cargada, «R19 muestra tras la recarga…» agotó su tiempo
(20030 ms). En las siguientes pasadas salió verde. Parece intermitente.

No se corrió `./init.sh` ni la suite completa (lo corre el leader). No hay E2E: la feature no tiene
specs E2E propios.
