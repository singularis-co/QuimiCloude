# review QC-299 — pasos-de-acondicionamiento · vuelta 1

Diff revisado: `82066774..HEAD` (9 commits, 146 archivos). Worktree
`.worktrees/QC-299-pasos-de-acondicionamiento`. Grafo de código: no usado; todo con Grep/Read y git
(el design ya anota que el MCP no tiene indexado este worktree).

## Veredicto: RECHAZADO

2 hallazgos mayores (BLOQUEANTES) y 5 menores. El código de la feature está bien y su
trazabilidad es completa. Rechazo porque el diff deja **dos rojos nuevos** en la suite que corre
`gate-completo` en CI. Ninguno está en `tests/baseline-rojos.json`, y los dos los causa esta rama.
Arreglarlos es añadir unas entradas a dos listas cerradas; ver M1 y M2.

## Verificación ejecutada por el reviewer

| Qué | Resultado |
|---|---|
| `pnpm run typecheck` | 0 errores |
| `pnpm run lint` | 0 errores, 10 warnings, todas anteriores a esta rama |
| `pnpm exec vitest run guard` | 80 archivos, 1096 verdes, 20 skipped |
| Los 79 tests unit/ui que añade o modifica el diff | 78/79 archivos verdes, 1945/1946 tests: rojo `recipe-route-contract` (M1) |
| Los 43 tests que comparan contra `origin/dev...HEAD` y los 37 que recorren `e2e/` o `app/` | 2 rojos: M1 y M2 |
| Integración en base efímera (`qct_qc299_*`, copia de `qct_tpl_c94dd731b081`, borrada al terminar): `recipe-conditioning-steps-migration`, `recetas/conditioning-steps`, `conditioning-steps-progress`, `conditioning-execution-log`, `finish-conditioning-batch-data`, `recipe-versions-repository` | 6 archivos, 57/57 |
| E2E | No lo corrí: lo corre CI. La salida local del implementer está en `impl_QC-299.md` (chromium y webkit verdes) |

No cuento contra la feature los rojos ajenos que dio el leader: `tests/unit/marca/tablas-marca.test.tsx`
y `tests/integration/proveedores/catalog-line.int.test.ts`.

## Hallazgos

### Mayores (BLOQUEANTES)

- **M1 — BLOQUEANTE. `tests/unit/recetas-ui/recipe-route-contract.test.ts > «la feature no toca lib/modules/recetas ni db/»` sale rojo.**
  - Como el diff toca `app/(private)/produccion/formulas/`, el test exige que todo archivo de
    `lib/modules/recetas/` y de `db/` del diff esté en `RECETAS_PERMITIDAS` / `DB_PERMITIDAS`.
  - El primer archivo que falla es `lib/modules/recetas/domain/recipe-conditioning-steps-reader.ts`.
    Detrás vendrá el siguiente `expect`, con las 4 migraciones de `db/migrations/2026102112000{0,1}_*`.
    `db/schema.prisma` ya está permitido.
  - Las fichas anteriores lo resolvieron así: QC-211 (`PASOS_DE_ENVASADO_QC211` / `MIGRACION_QC211`)
    y QC-214. El implementer editó este archivo en la tanda 4, pero solo en el bloque del asistente.
  - **Falta:** añadir `PASOS_DE_ACONDICIONAMIENTO_QC299` a `RECETAS_PERMITIDAS` y
    `MIGRACION_QC299` a `DB_PERMITIDAS`, cada una con la lista nombrada de archivos y su porqué.
  - No apareció antes porque el test solo muerde con los cambios ya commiteados
    (`progress/deudas.md:69`).
- **M2 — BLOQUEANTE. `tests/unit/shared/data-table-alcance.test.ts > «la lista de specs E2E que referencian data-table es cerrada, y son estos cuarenta y nueve»` sale rojo.**
  - El E2E nuevo `e2e/pasos-de-acondicionamiento.spec.ts` usa `data-table-cell-orderNumber` y
    `data-table-row-` (líneas 162–163), así que la lista pasa a tener 50 entradas.
  - `vitest related` no lo selecciona, pero la suite completa de CI sí.
  - **Falta:** añadir el spec a la lista cerrada del test y actualizar la cuenta y el título, como
    hicieron las fichas anteriores (`pasos-de-envasado.spec.ts` y `operario-rediseno.spec.ts` ya
    están en ella).

### Menores

- **m1 — Singular «1 foto de evidencia» (desvío por confirmar): menor.** R35 dice «cuántas fotos de
  evidencia tiene ese paso» y no fija la forma. El tablero solo trae un ejemplo en plural
  («2 fotos de evidencia»). El singular es la concordancia correcta y no contradice ningún
  requisito. Basta con que el humano lo confirme. No hace falta cambiar el spec.
- **m2 — El tooltip no responde a la pulsación larga en pantallas táctiles (desvío por confirmar): menor, pero se aparta de un tablero aprobado.**
  - Lo que pide `FormulaAcondicionamientoMovil.dc.html`: «el tooltip abre al mantener pulsado el
    switch», también «en táctil, al mantener pulsado».
  - Por qué no es bloqueante:
    - R10 y la decisión cerrada del 2026-10-19 solo exigen ratón y foco, y se cumplen
      (`recipe-step-editor.test.tsx`).
    - En táctil el significado no depende solo del hover. Al encender el switch aparece debajo su
      línea de ayuda («Al ejecutar, este paso pide…» / «…elegir uno o más responsables…»). La ayuda
      de la sección nombra «Asignación requerida». El nombre accesible lleva el texto completo.
      Por eso no entra en la regla de multiplataforma «`:hover` nunca es la única forma de
      descubrir algo».
  - Matiz: la justificación de `design.md > 5.4` («en táctil nada queda escondido») solo vale
    para lectores de pantalla. En iOS Safari, tocar un botón no le da el foco, así que una persona
    que ve la pantalla no puede leer el tooltip **antes** de encender el switch.
  - Decide el humano: aceptar el desvío o pedir la pulsación larga (Base UI no la trae, así que
    habría que escribirla a mano).
- **m3 — Los motivos de bloqueo van en el pie de la pantalla (desvío por confirmar): menor.**
  - El tablero `AcondicionamientoPasos.dc.html` pinta «Sube al menos una foto…» y «Elige al menos
    un responsable…» (`.pp-err`, `role="alert"`) debajo del bloque de fotos o de responsables.
  - La implementación los pasa por `stepBlockReason` de `StepReader`, que los pinta en el pie. Esto
    cumple R20, que pide decir el motivo «como lo dice la ejecución del operador». También deja
    `StepReader` sin cambios, como pide `design.md > 8` por QC-291.
  - Los textos son los exactos de R21 y R22, y los tests los fijan. Solo cambia dónde aparecen.
- **m4 — Comentarios sin reajustar.** Al editarlos, quedaron sin partir dos líneas de comentario
  que pasan del ancho del archivo:
  - el bloque de cabecera de `lib/modules/asignaciones/domain/finish-conditioning.ts`, línea 4,
    de unos 165 caracteres;
  - `lib/modules/asignaciones/domain/evidence-target.ts`, línea 6.
  Es estilo: el lint pasa.
- **m5 — Desvío de `design.md > 5.2` sin anotar en el design.** `page.tsx` no cambia: el
  `stepsPending` y el ocultar «Terminar» viven en `conditioning-order-screen.tsx`, que pasa a
  `'use client'`. Además la prop `optionalHelp` pasa a llamarse `optionalDescription`. Los dos
  están en la bitácora del implementer y el comportamiento queda cubierto por tests (R25). No
  rompen nada, pero el design ya no describe el código.

### Desvíos ya aceptados por el leader

No los reabro: el índice único sin `::text` (42P17) y las etiquetas de T18 adelantadas. También
apliqué, sin reabrirlas, las decisiones del humano: los defaults de P1–P6 y los responsables
huérfanos.

## Checklist

### Puntos 1–4 del agente

- [x] **Trazabilidad:** cada R1–R39 tiene al menos un caso con su `R<n>` en el nombre y una
  aserción real. Tabla abajo.
- [x] **Tasks:** T1–T20 marcadas `[x]`. Advertencia: T20 dice «`./init.sh` verde», y lo corre el
  leader.
- [x] **`## Lo que ya existe`:** abre el design, está completa y el diff no re-crea nada de la
  lista.
  - Reutiliza `StepReader`, `useStepEvidence`, `EmptyState`, `Notice`, `Avatar` y `Button`.
  - Extiende `RecipeStepEditor` (`assignment`), `RecipeStepsField` (`showAssignmentSwitch`) y
    `ConditioningBatchDataForm` (`locked`), con props opcionales.
  - Compone el selector de responsables y los cuerpos del recorrido.
- [ ] **Verificación ejecutable:** typecheck, lint, guardias e integración en verde. Fallan dos
  tests de la suite completa: M1 y M2.

### CHECKPOINTS.md

- [x] Especificación: requirements EARS R1–R39; design con 7 alternativas descartadas;
  tasks todas `[x]`; `## Lo que ya existe` presente.
- [ ] Equipo: no verificable desde el worktree (assignee en Jira, `wt.sh new`). Le toca al leader.
- [x] Trazabilidad: el mapa `R<n> -> test` está en `progress/impl_QC-299.md`.
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` sin rojos nuevos: **no**, por M1 y M2.
- [x] Flujo crítico (permisos): hay E2E Playwright `e2e/pasos-de-acondicionamiento.spec.ts`, con su
  salida local en la bitácora.
- [x] Sin dependencias nuevas: `package.json` no aparece en el diff.
- [x] Sin secretos ni configuración hardcodeada. No hay webhooks.
- [ ] Verificación final: `./init.sh` y el gate en CI le tocan al leader. Esta revisión es
  RECHAZADO.

### docs/checkpoints-proyecto.md

- [x] Typecheck y lint. El E2E es de Playwright.
- [x] Multiplataforma (punto 6): no hay `100vh`.
  - Objetivos táctiles: responsables `min-h-12` (48 px); «Volver a los pasos» con `touch`.
  - Los switches siguen con el tamaño del `Switch` de hoy.
  - No se añade ningún input nuevo de menos de 16 px.
  - Nada depende solo del hover (ver m2).
- [x] Catálogo: no se crea ni se sube nada a `components/shared`, `components/ui`, `hooks` ni
  `lib/shared/ui`. Las piezas extendidas son de la ruta.
- [x] Pase `/design`: el design cita los 9 tableros aprobados y la pieza de cada uno. El
  formulario de versión se ampara en la excepción (P5, aprobada).
- [x] Empresa:
  - Sin tabla ni modelo nuevo. Las columnas nuevas heredan `company_id`, RLS y FORCE de `recipes`
    y `order_execution_entries`.
  - Cada lectura y escritura nueva filtra por `actor.companyId`.
  - Hay tests de acceso cruzado: `conditioning-steps.int` (R32), `conditioning-steps-progress.int`
    (casos 5–6), `evidence-target`, `count-evidence-locking-orders`, `read-order-evidence`,
    `record-conditioning-step`, `get-conditioning-order` y `finish-conditioning`.
- [x] Permisos en el caso de uso, con test:
  - `recordConditioningStep` y la fase `conditioning` de evidencia exigen
    `acondicionamiento.modificar` en la primera línea.
  - `getConditioningOrder` y `finishConditioning` siguen como estaban.
  - `recetas.modificar` se mantiene en alta y edición de la fórmula (R6).
- [x] Migraciones versionadas con `down.sql`.
  - El down de la 2 solo quita lo que añade.
  - El down de la 1 aborta si hay filas que usan los valores nuevos.
  - El ciclo up, rollback y up lo probó el implementer; el int de migración lo cubre (R1).
- [x] Hexagonal:
  - `domain/` no importa framework.
  - Entre módulos solo se importan barrels (`@/lib/modules/recetas`).
  - La Server Action solo traduce; la lógica está en `record-conditioning-step.ts`.
  - El cableado está en `lib/composition`.
  - La UI importa la acción por su archivo de adaptador `driving`, igual que las tres que ya
    había en la misma ruta.
- [x] Permisos de UI: la página valida en servidor y la pantalla recibe los datos por props.
  Las mutaciones van por Server Action.

### Reglas del proyecto (perfil-agentes > reviewer, puntos 5–11)

- [x] 5. Calidad y seguridad: sin tablas nuevas. Sin hardcode de contexto. Capas separadas.
- [x] 6. Multiplataforma: ver arriba. El desvío m2 es menor.
- [x] 7. Dependencias: ninguna.
- [x] 8. Aislamiento por empresa: ver arriba.
- [x] 9. Comentarios: ninguna línea añadida a producción cita `QC-<n>`, `R<n>`, `design.md` ni
  «decisión cerrada». Lo comprobé con `--ignore-cr-at-eol`, porque `recipe-step-editor.tsx`
  cambia de CRLF a LF y en bruto parecía reescrito entero. Ver m4.
- [x] 10. Duplicados: el design dice qué paso de la regla de decisión aplica a cada pieza.
- [x] 11. Diseño: cada pieza nueva o extendida tiene su tablero citado.

## Trazabilidad R<n> -> test

Rutas bajo `tests/` salvo el E2E. Comprobé que cada `R<n>` tiene casos con su etiqueta en el nombre,
añadidos por el diff; la cuenta va entre paréntesis. Abrí y leí los casos de R7, R17 y R39, y los
del caso de uso y la UI del panel.

| R | Tests |
|---|---|
| R1 (10) | `integration/recetas/recipe-conditioning-steps-migration.int.test.ts` (UP/DOWN); `unit/recetas/schema/recetas-schema.test.ts`; `unit/recetas/recipe-input.test.ts`; `unit/recetas/scope.test.ts` |
| R2 (2) | `unit/recetas/recipe-input.test.ts` |
| R3 (1) | `unit/recetas/recipe-input.test.ts` («50 + 50 + 50») |
| R4 (14) | `unit/recetas/recipe-input.test.ts`; `unit/recetas/conditioning-steps.test.ts`; `integration/recetas/conditioning-steps.int.test.ts` |
| R5 (4) | `unit/recetas/recipe-input.test.ts` |
| R6 (3) | `unit/recetas/conditioning-steps.test.ts` |
| R7 (3) | `unit/documentos/confirm-formula-import.test.ts` (crear deja `[]`, reemplazar conserva, entrada estricta) |
| R8 (8) | `unit/recetas-ui/recipe-form-conditioning-steps.test.tsx`; `unit/recetas-ui/recipe-steps-field.test.tsx` |
| R9 (6) | `unit/recetas-ui/recipe-steps-field.test.tsx`; `recipe-step-editor.test.tsx`; `recipe-form-conditioning-steps.test.tsx` |
| R10 (7) | `unit/recetas-ui/recipe-step-editor.test.tsx` (solo icono, tooltip con hover y con foco, línea de ayuda); `recipe-steps-field.test.tsx`; `recipe-form-conditioning-steps.test.tsx` |
| R11 (3) | `unit/recetas-ui/recipe-steps-field.test.tsx`; `recipe-form-conditioning-steps.test.tsx` |
| R12 (8) | `unit/recetas-ui/recipe-form-conditioning-steps.test.tsx`; `recipe-steps-field.test.tsx` |
| R13 (4) | `unit/recetas-ui/recipe-form-conditioning-steps.test.tsx` |
| R14 (3) | `unit/recetas/recipe-input.test.ts`; `unit/recetas/conditioning-steps.test.ts` |
| R15 (8) | `unit/recetas/conditioning-steps.test.ts`; `unit/recetas/recipe-conditioning-steps-reader.test.ts`; `integration/recetas/conditioning-steps.int.test.ts` |
| R16 (2) | `unit/recetas-ui/recipe-version-form.test.tsx` |
| R17 | `unit/asignaciones/get-conditioning-order.test.ts` («R17: en %s no entrega pasos ni avance, y no llama al lector…», `it.each` con 4 estados) |
| R18 (3) | `unit/asignaciones-ui/conditioning-steps-panel.test.tsx`; `conditioning-order-screen.test.tsx` |
| R19 (3) | `unit/asignaciones/get-conditioning-order.test.ts`; `finish-conditioning.test.ts`; `unit/asignaciones-ui/conditioning-order-screen.test.tsx` |
| R20 (2) | `unit/asignaciones-ui/conditioning-steps-panel.test.tsx` (temporizadores falsos) |
| R21 (20) | `unit/asignaciones/record-conditioning-step.test.ts`; `evidence-target.test.ts`; `read-order-evidence.test.ts`; `step-evidence.test.ts`; `unit/asignaciones-ui/conditioning-steps-panel.test.tsx` |
| R22 (11) | `unit/asignaciones/get-conditioning-order.test.ts`; `unit/asignaciones-ui/conditioning-steps-panel.test.tsx`; `conditioning-step-responsibles-picker.test.tsx` |
| R23 (9) | `unit/asignaciones/record-conditioning-step.test.ts` |
| R24 (6) | `unit/asignaciones-ui/conditioning-steps-panel.test.tsx` |
| R25 (12) | `unit/asignaciones/finish-conditioning.test.ts`; `unit/asignaciones-ui/conditioning-steps-panel.test.tsx`; `conditioning-order-screen.test.tsx`; `conditioning-batch-data-form.test.tsx` |
| R26 (8) | `unit/asignaciones-ui/conditioning-steps-panel.test.tsx`; `unit/asignaciones/get-conditioning-order.test.ts` |
| R27 (28) | `integration/recetas/recipe-conditioning-steps-migration.int.test.ts`; `unit/asignaciones/conditioning-steps.test.ts`; `execution-log-prisma.test.ts`; `record-conditioning-step.test.ts`; `integration/asignaciones/conditioning-steps-progress.int.test.ts` |
| R28 (22) | `unit/asignaciones/conditioning-steps.test.ts`; `execution-log-prisma.test.ts`; `record-conditioning-step.test.ts`; `get-conditioning-order.test.ts`; `integration/asignaciones/conditioning-steps-progress.int.test.ts` |
| R29 (2) | `unit/asignaciones/record-conditioning-step.test.ts` |
| R30 (5) | `unit/recetas/recipe-conditioning-steps-reader.test.ts`; `unit/asignaciones/get-conditioning-order.test.ts` |
| R31 (11) | `unit/asignaciones/record-conditioning-step.test.ts`; `get-conditioning-order.test.ts`; `finish-conditioning.test.ts`; `order-conditioning-actions.test.ts`; `unit/composition/asignaciones-facade.test.ts` |
| R32 (15) | `integration/recetas/conditioning-steps.int.test.ts`; `unit/asignaciones/{evidence-target,count-evidence-locking-orders,read-order-evidence,record-conditioning-step,get-conditioning-order,finish-conditioning}.test.ts`; `integration/asignaciones/conditioning-steps-progress.int.test.ts` |
| R33 (2) | `integration/recetas/conditioning-steps.int.test.ts` |
| R34 (10) | `unit/recetas/conditioning-steps.test.ts`; `unit/asignaciones/count-evidence-locking-orders.test.ts` |
| R35 (13) | `unit/asignaciones/get-execution-trace.test.ts`; `record-conditioning-step.test.ts`; `ui/dashboard/execution-trace-detail.test.tsx` |
| R36 (9) | `unit/asignaciones/get-execution-trace.test.ts`; `ui/dashboard/execution-trace-detail.test.tsx` |
| R37 (2) | `unit/asignaciones/get-execution-trace.test.ts`; `list-execution-traces.test.ts`; `unit/paridad/recorridos-paridad.test.tsx` |
| R38 (7) | `unit/asignaciones/execution-trace.test.ts` |
| R39 | `e2e/pasos-de-acondicionamiento.spec.ts` («R39: …», chromium y webkit). Cubre: alta con un paso con asignación; el operador y el empacador no ven pasos de acondicionamiento; responsable elegido; recarga con «Retomaste» en el paso 2; «Completar pasos»; datos de lote; «Terminar»; el recorrido muestra el responsable. |

## Qué tiene que hacer el implementer en la vuelta 2

1. M1: añadir las listas nombradas de QC-299 en `tests/unit/recetas-ui/recipe-route-contract.test.ts`:
   - `recipe-conditioning-steps-reader.ts`, más cualquier otro archivo de `lib/modules/recetas/`
     del diff que no esté ya permitido;
   - las 4 migraciones de `db/migrations/20261021120000_*` y `20261021120001_*`.
2. M2: dar de alta `e2e/pasos-de-acondicionamiento.spec.ts` en la lista cerrada de
   `tests/unit/shared/data-table-alcance.test.ts`, con la cuenta y el título a 50.
3. Con los cambios ya commiteados, correr los tests que comparan contra `origin/dev...HEAD` y los
   que recorren `e2e/`, y anotar la salida en la bitácora.
4. Opcional: m4 (reajustar los dos comentarios) y m5 (anotar los desvíos en el design).

## Vuelta 2 (acotada a f4d5281d..2a47d780)

Commits: `09730570` (arreglos de la vuelta 1), `62e137f8` (merge de `origin/dev`, 12 conflictos) y
`2a47d780` (pulsación larga, decisión del humano). A petición del leader, también reviso el
resultado del merge contra `origin/dev`. No rehago la trazabilidad completa.

### Veredicto vuelta 2: OK

0 hallazgos mayores y 3 menores.

### Verificación ejecutada por el reviewer

| Qué | Resultado |
|---|---|
| `pnpm exec prisma generate` | ok |
| `pnpm run typecheck` | 0 errores |
| `pnpm run lint` | 0 errores, 10 warnings anteriores |
| `pnpm exec vitest run guard` | 85 archivos, 1253 verdes, 22 skipped |
| 126 archivos: los tests que el diff con `origin/dev` añade o cambia, más todos los que comparan contra `origin/dev...HEAD` o recorren `e2e/`/`app/` | 126/126 archivos, 2576 verdes, 100 skipped. Incluye `recipe-route-contract` y `data-table-alcance` |
| Carpetas `recetas`, `recetas-ui`, `asignaciones`, `asignaciones-ui`, `dashboard` (unit/ui), `paridad`, `documentos`, `errores`, `composition` e `identity/roles` | 349 archivos, 6012 verdes. Un rojo: timeout de 20 s en `formula-import-review.test.tsx` («más de 500 caracteres»). Pasa 34/34 corrido solo; la vuelta 1 ya lo anotó lento también en HEAD. No es de la feature |
| Integración en base efímera (`qct_tpl_bdf56c3e8ff5`, plantilla nueva tras el merge): los 6 `.int` de la vuelta 1 | 6 archivos, 57/57 |

`vitest related` no sirve dentro del worktree: el `exclude` del config lleva `.worktrees/**`, así
que termina con «No test files found». Por eso lo sustituí por las carpetas de arriba.

### Hallazgos de la vuelta 1

- **M1, cerrado.** `PASOS_DE_ACONDICIONAMIENTO_QC299` lista los 12 archivos de
  `lib/modules/recetas/` del diff. `MIGRACION_QC299` lista el schema y las 4 migraciones. Las dos
  entran en `RECETAS_PERMITIDAS` y `DB_PERMITIDAS`. El test está verde.
- **M2, cerrado.** El spec entra ordenado en la lista cerrada. Tras el merge con dev, el centinela
  queda en «cincuenta y cinco» (54 de dev + este). El test está verde.
- **m4, cerrado.** Los dos comentarios están repartidos en líneas.
- **m5, cerrado.** El `design.md` anota `optionalDescription` y que `stepsPending` vive en la
  pantalla.
- **m2, cerrado por decisión del humano** (anotada en `requirements.md` y `design.md`).
  - `2a47d780` solo toca `IconSwitch`, dentro de `recipe-step-editor.tsx`. Pasa a controlar
    `open` del `Tooltip` y abre con 500 ms de pulsación por Pointer Events, y no con el ratón.
  - Descarta movimientos de más de 10 px y la cancelación del puntero.
  - Se traga el `click` que llega al soltar la pulsación larga, anula el menú contextual y la
    selección de texto, y se cierra al tocar fuera.
  - Lo cubren 10 tests nuevos «R10: pulsación larga».
  - **El Tooltip compartido no cambia:** `git diff origin/dev 2a47d780 -- components/ hooks/ lib/shared`
    sale vacío.
- **m1 y m3:** siguen pendientes de que el humano los confirme. Son menores y no bloquean.

### Merge 62e137f8

- **No se perdió nada de QC-299.**
  - Comparé, archivo por archivo, el conjunto de líneas que QC-299 cambiaba contra la base
    (`0f71d5af..09730570`) con las que cambia el merge contra `origin/dev`. En los 39 archivos que
    tocaban los dos lados coinciden en 30.
  - Los 9 restantes son adaptaciones legítimas:
    - `recipe-form.tsx`: el `Separator` pasa a `<Card>`.
    - `recipe-step-editor.tsx`: une los imports de iconos y el padding del rediseño.
    - `recipe-steps-field.tsx`: `evidenceOn || assignmentOn` en la estructura nueva.
    - Censos re-sumados sobre los de dev:
      - errores: 121 = 117 + 4;
      - fachada: 35 = 34 de QC-301 + `recordConditioningStep`;
      - rol de acondicionamiento: 13 = 11 + 2;
      - data-table: 55.
    - `recipe-steps-field.test.tsx`: el nombre accesible de dev pasa a «… de Pasos».
    - `canvas.json`: los tableros de QC-299 están ahí.
- **No se perdió nada de dev.**
  - `git diff origin/dev 2a47d780` solo añade en `db/` (las 6 líneas del schema y las 2 carpetas de
    migración, que siguen siendo las últimas).
  - En `error-codes.ts`, `aislamiento.json` y `guard-identificador-de-request` solo hay altas de
    QC-299.
  - En `lib/composition/index.ts` y el barrel de `asignaciones` se quita una sola línea: el
    re-export de `ConditioningBatchData` y `ConditioningBatchLineView`, que se reagrupa y sigue
    exportado (`index.ts:304-305`).
- **Formulario rediseñado por QC-264.**
  - «Acondicionamiento» es la quinta `<Card className={CARD_CLASS}>`, tras «Envasado» y antes del
    diálogo de propagar.
  - Lleva `title`, `optionalDescription`, `testIdPrefix`, `showEvidenceSwitch`,
    `showAssignmentSwitch` y `locked={stepsLocked}`, igual que las otras tarjetas.
- **Tests ajustados al rediseño, sin comprobaciones quitadas.**
  - `recipe-form-layout.test.tsx`: pasa de 4 tarjetas a 5. Conserva todas las aserciones y añade
    la de la quinta.
  - `formulas-toasts`, `recipe-form-preview` y `recipe-version-marks`: solo añaden
    `conditioningSteps: []` al fixture.
  - `recipe-form-conditioning-steps.test.tsx` (R8): cambia la comprobación del divisor por
    «tarjeta propia distinta de la de Envasado y posterior a ella». Es la misma garantía en la
    estructura nueva.
- **`listDeliveredConditionedOrders`.**
  - Ningún archivo de `app/`, `lib/` ni `e2e/` lo usa.
  - Solo aparece en dos tests de dev que afirman que ya no existe (`asignaciones-facade.test.ts:261`)
    o que no se llama.
  - Las 42 apariciones en `82066774..2a47d780` vienen del lado de dev del merge, no de QC-299.
- Ninguna línea de producción añadida en el rango cita `QC-<n>`, `R<n>` ni `design.md`. La única
  que aparece, en `order-columns.tsx`, viene de dev.

### Hallazgos nuevos (menores)

- **n1 — menor. El spec dice «divisor» y ahora es una tarjeta.**
  - `requirements.md:78` (R8, «separada por un divisor»), `design.md > 5.1`
    (`Separator`, `recipe-form-conditioning-separator`) y `tasks.md:93` siguen hablando del
    divisor.
  - Tras QC-264 es una tarjeta propia, y el test ya lo refleja.
  - Falta una enmienda de una línea en el spec, como las de m5.
- **n2 — menor. Comentario impreciso en `recipe-route-contract.test.ts`.** El comentario de
  `MIGRACION_QC299` habla de «tablas de acciones y de pasos de acondicionamiento» y de «modelos
  nuevos». En realidad son valores de enum y columnas, sin tabla ni modelo nuevo. Es un archivo de
  test.
- **n3 — menor. Línea de comentario de 132 caracteres.** La cabecera de `LONG_PRESS_MS` en
  `recipe-step-editor.tsx:302` no está repartida, como en m4. El lint pasa.
