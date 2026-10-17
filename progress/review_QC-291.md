# QC-291 — pantalla-operario-rediseno · review (F2.2, vuelta 1, alcance completo)

Revisado: `feature/QC-291-pantalla-operario-rediseno` @ 1b77e1c6 contra `origin/dev` (merge-base
0f135128; la rama va 19 commits por detrás de `origin/dev` y el merge con dev es limpio).
Grafo: no consultado (worktree sin indexar, como ya anota `design.md`); exploración con Grep/Read/git.

## Verificación ejecutada (reviewer)

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, ninguno en archivos del diff.
- `pnpm exec vitest related --run <archivos .ts/.tsx/.css del diff, sin e2e>`:
  `Test Files 2 failed | 84 passed (86) · Tests 2 failed | 1579 passed (1581)`. Rojos:
  - `tests/unit/marca/tablas-marca.test.tsx` (product-columns, «Costo»): ajeno, ver A6.
  - `tests/unit/recetas-ui/formula-import-review.test.tsx`: timeout de 20 s con la máquina cargada; ajeno.
- `pnpm exec vitest run guard`: `Test Files 80 passed (80) · Tests 1096 passed | 20 skipped`.
- E2E: no corridos por el reviewer (los corre el CI). La atribución de A5 se verificó con git (abajo).

## Checklist

### CHECKPOINTS.md
- [x] requirements.md con R1–R34 EARS.
- [x] design.md con alternativas descartadas (§8, cinco).
- [ ] **tasks.md todas `[x]`: NO. T12 y T13 sin marcar** (hallazgo M2).
- [x] design.md abre con `## Lo que ya existe`; el diff no re-crea nada de la lista
      (`OrderExecutionToolsPanel` se sustituye y borra, como dice la tabla; la tarjeta se traslada).
- [x] Equipo: commit `64bc0545 chore(QC-291): feature tomada por usuario` (candado).
- [x] Cada R mapea a test (mapa en `progress/impl_QC-291.md`; todos los R aparecen en nombres de
      tests de `tests/unit/asignaciones-ui`, `step-reader.test.tsx` o `e2e/pantalla-operario-rediseno.spec.ts`;
      los unitarios relacionados están en verde). Comprobación del cuerpo de cada test: por muestreo,
      no exhaustiva.
- [x] `progress/impl_QC-291.md` contiene el mapa R → test.
- [x] typecheck / [x] lint sin errores.
- [ ] `gate-completo` en CI: pendiente (no hay PR todavía).
- [x] Flujo crítico: no toca auth/permisos/inventario/importes/webhooks (R32: sin `lib/`, `db/`, `package.json`).
- [x] Sin dependencias nuevas (`package.json` intacto).
- [x] Sin secretos ni hardcode de entorno.
- [ ] `./init.sh` en verde: pendiente (lo corre el leader).
- [ ] review OK: no (este documento).
- [ ] Cierre en `progress/features/QC-291.md` y desmontar worktree: pendiente (post-merge).

### docs/checkpoints-proyecto.md
- [x] typecheck, lint; E2E de Playwright.
- [x] Multiplataforma: `h-dvh` (no `100vh`), `env(safe-area-inset-*)`, sin `:hover` como única vía,
      objetivos ≥ 44 px (FAB 56 px, X 44 px), sin inputs nuevos < 16 px. WebKit de Playwright verde
      (16/16, según bitácora); iPhone físico sin verificar, declarado.
- [x] CATALOGO.md: filas `StepReader`/`StepProgress` y `StepDocumentView` actualizadas;
      `OperatorSidePanels` vive en la ruta (paso 3, sin fila: correcto, no está en `components/shared`).
- [x] Pase `/design`: tableros `OperarioPantalla*.dc.html` citados en design.md.
- [x] Datos/seguridad, módulos hexagonales, permisos: N/A (no hay diff en `lib/`, `db/`).

### docs/perfil-agentes.md > reviewer, puntos 5–11
- [x] 5 Calidad/seguridad: N/A backend; capas intactas.
- [x] 6 Multiplataforma: ver arriba.
- [x] 7 Dependencias: ninguna.
- [x] 8 Aislamiento por empresa: N/A.
- [ ] **9 Comentarios: FALLA** (hallazgo M1).
- [x] 10 Duplicados: `OperatorSidePanels` justifica el paso 3 y descarta `Sheet`/`Popover` (§8).
- [x] 11 Diseño: referencia presente.

## Hallazgos

### M1 — BLOQUEANTE. Comentarios que citan la ficha en código de producción
`app/globals.css:171` y `:248`, líneas añadidas por el diff:
```
/* Secciones de la pantalla del operario (QC-291 R20, R27). */
```
Regla 9: citar `QC-<n>`/`R<n>` en líneas nuevas de producción es bloqueante.
Arreglo mínimo: dejar `/* Secciones de la pantalla del operario. */` (o quitarlo).
(El resto del diff de `app/` y `components/` no cita fichas: comprobado con grep sobre las líneas `+`.)

### M2 — BLOQUEANTE. T12 y T13 sin marcar
- T12 no cumple su «Hecho» («cada spec de la lista, en verde»): quedan rojos en
  `envases-del-pedido` y `acondicionamiento`, y cuatro de la lista «sin cambio previsto». Ninguno es
  de QC-291 (ver A5), pero el «Hecho» no se cumple y ninguno está en `tests/baseline-rojos.json`.
- T13 depende de `./init.sh`, que corre el leader.
Camino mínimo: el leader/humano decide sobre los rojos ajenos (anotarlos en `progress/deudas.md` con
una ficha de arreglo, o arreglar en esta rama los dos triviales de «falta pulsar Comenzar» con el
helper `enterAndStartAssignedOrder`), el implementer marca T12 con esa decisión citada, y T13 se
marca tras `./init.sh` en verde.

### M3 — BLOQUEANTE. A3: QC-269 R6 (y R4/R5) contradichos sin enmienda
`specs/QC-269-layout-operario/requirements.md` R6: «NO DEBE dar al panel … un desplazamiento propio
… todo el contenido del panel se alcanza con el desplazamiento de la página». R4/R5 hablan del «pie
fijo» y del desplazamiento de la página. QC-291 R1/R31 lo invierten (scroll interno; panel con scroll
propio a 834/390 px), y T12 **invirtió** la aserción R6 de `e2e/operario-rediseno.spec.ts:1190-1192`
(«el panel flotante hace scroll»). El «Hecho» de T12 dice que solo cambian las comprobaciones que
amparan D11 y D12, y `design.md > 1.1` no lista QC-269. Es un defecto real de esta feature, de
trazabilidad documental, no de código.
Arreglo mínimo: nota de enmienda fechada bajo R4, R5 y R6 de QC-269 (como las de QC-265/QC-195), una
fila de QC-269 en `design.md > 1.1`, y que el humano lo confirme (la enmienda se deriva de R1/R31,
ya aprobados).

### m1 — menor. A1: R17 leído distinto en empaque y acondicionamiento
- Empaque (`packing-order-screen.tsx:426`) pinta «Revisa antes de comenzar» siempre que no hay
  `canFinish`, también con `EN_EMPAQUE` a nombre de otro y con el texto «Al comenzar…».
- Acondicionamiento (`conditioning-order-screen.tsx:239`) solo en `POR_ACONDICIONAR`.
El empaque sigue la letra de R17; el acondicionamiento, el sentido. Ninguno incumple un test, pero es
una incoherencia real entre pantallas. En empaque, ver «Al comenzar…» junto a «Lo está empacando otra
persona» es confuso. Arreglo mínimo, si el humano lo acepta: en empaque condicionar la tarjeta a
`canStart` (`POR_EMPACAR`), y añadir una línea aclaratoria a R17 («solo cuando el actor puede
comenzar»). Decide el humano.

### (informativo, sin hallazgo) A2: R33 sin nombre es inalcanzable
`orders_conditioned_by_matches_status` (`db/migrations/20261007120000_order_conditioning_states/migration.sql:25`)
obliga a `conditioned_by IS NOT NULL` en `EN_ACONDICIONAMIENTO`, y la vista cae al id si no
encuentra el nombre (`lib/modules/asignaciones/domain/conditioning-order-view.ts:180`:
`names.get(...) ?? order.conditionedBy`). `conditionedByName === null` no puede darse en ese estado.
No es un defecto. Si se quiere blindar, basta con quitar `&& order.conditionedByName !== null` de
`conditioningBlockedReason` usando un texto ya aprobado. No hace falta.

### m2 — menor. A4: el panel pisa 2 px el pie a 390 px
El panel se ancla a `bottom-[calc(132px+safe-area)]` y el pie de fabricación mide 134 px a 390 px.
El panel va por encima (portal, z-index): el pie no tapa su contenido y R31 se cumple (lo verifica el
E2E con `elementFromPoint`). Es visual y menor. Arreglo mínimo: subir el ancla a ≥ 136 px (y el
`max-h` en proporción), o anclarla a la altura real del pie.

### (informativo) A6: `tablas-marca.test.tsx` rojo, ajeno
Viene de `b0eaa866`/`5496bd16` (inventario, columna Costo). Ya está arreglado en `origin/dev` por
`fb140780` + `6939047b` (cambia `esperadas` y `showCost`). QC-291 no toca `product-columns.tsx`.
Arreglo: mergear `origin/dev` en la rama (merge limpio). No es hallazgo de la feature.

### (informativo) A5: atribución de los rojos E2E, verificada
- `envases-del-pedido:492/:623` y `pedido-en-varias-presentaciones:575/:778` («falta Comenzar»):
  `d4ff52c6` (2026-10-15, en dev) cambió la página a `openAssignedOrderAction`, así que entrar ya no
  comienza. Solo actualizó `ejecucion-receta`, `pasos-de-envasado`, `registro-ejecucion`,
  `producto-terminado`, `reserva-de-material` y `pedidos-asignados`. En `origin/dev`,
  `envases-del-pedido.spec.ts:618` y `pedido-en-varias-presentaciones.spec.ts:320` hacen `goto` sin
  Comenzar. **Confirmado previo.**
- Sufijo de volumen (`acondicionamiento:430`, `envases-del-pedido:656`, `pedido-en-varias:702/:892`):
  `9a330ab2` (10-16) cambió `order-distribution-full.tsx` y `order-distribution-label.tsx`.
  `acondicionamiento.spec.ts` se tocó por última vez en dev en `3b3bca34` (10-14). La aserción de
  `:430` es de la lista «Por acondicionar», que QC-291 no toca. QC-291 no toca ningún archivo de
  reparto. **Confirmado previo.**
- `datos-de-lote:450` («vence en 365 días»): `08b69744` (10-15 11:01) en inventario; el spec se tocó
  por última vez en `60366b4d` (10-15 07:29). **Confirmado previo.**
- `empaque:701` (lista «Terminados» de `/asignacion`) y `recorrido-acondicionamiento:631`
  (`/dashboard` para el Administrador): ni la lista ni el dashboard están en el diff. **Previos por
  exclusión de diff.** Causa raíz: pendiente (no se corrió E2E en `origin/dev`).
- ¿QC-291 causa o empeora alguno? No hay evidencia. Los fallos están antes de los pasos de QC-291
  (envases, acondicionamiento) o en el último paso, fuera de las pantallas del operario (empaque,
  datos-de-lote, recorrido). El implementer verificó con parches temporales revertidos que detrás no
  hay fallos de QC-291. El reviewer no lo reprodujo: **pendiente** de que el E2E de CI lo confirme.

### m3 — menor. Props fuera del contrato de design.md §3.3/§1
- `useOperatorSidePanels({ columnTestId? })`: opcional y aditiva. La usan las tres pantallas para
  conservar testids que leen los E2E. Correcta, pero no está en el contrato de §3.3.
- `OrderExecutionTools`, `label?`: opcional. Además el id fijo `order-execution-tools-heading` pasa a
  `useId()` y el archivo pasa a `'use client'`. Ningún test, E2E ni código lee ese id (grep vacío), y
  sin `label`/`labelledBy` el render es igual. La tabla de `design.md` decía «1. Tal cual»: en
  realidad es un paso 2 (se extiende).
Las dos son razonables y no rompen a nadie. Arreglo mínimo: una línea en `design.md` (§3.3 y la
tabla de «Lo que ya existe»: `OrderExecutionTools` → paso 2).

### Edición del archivo compartido `tests/guards/guard-identificador-de-request.test.ts`
Es aditiva: una entrada al final de `E2E_ESPERADOS` (hunk en ~`:463`), su punto de extensión
declarado. QC-288 toca otros hunks del mismo archivo (`MIGRACIONES_ESPERADAS` ~`:696` y
`SUPERFICIES_QUE_APLANAN` ~`:889`). `git merge-tree` de las dos ramas lo **auto-mezcla sin
conflicto**. La guardia pasa (80/80). El comentario cita «QC-291 T11», pero es un archivo de test,
fuera de la regla 9. Sin hallazgo.

### m4 — menor. Choque con QC-288 en `docs/diseno/canvas/canvas.json`
`git merge-tree` entre las dos cabezas da conflicto de contenido en `canvas.json`: las dos fichas
añaden sus tableros. Los otros conflictos del merge-tree (pedidos, inventario) no son archivos de
QC-291: salen de la diferencia de base con dev. Arreglo: quien mergee segundo resuelve uniendo las
dos entradas. Detalle exacto del conflicto: pendiente.

## Recuento

- Bloqueantes: **3** (M1, M2, M3).
- Menores: **4** (m1, m2, m3, m4).
- Informativos sin hallazgo: A2, A5, A6 y la guardia compartida.

## Veredicto

**RECHAZADO.**

Vuelve al implementer para M1 y M3 (las dos son documentales o de una línea), y al leader/humano
para M2 (la decisión sobre los rojos E2E ajenos, T12 y T13, y `./init.sh`). Antes de la vuelta 2 se
recomienda mergear `origin/dev` en la rama, para que desaparezca el rojo de `tablas-marca`.
