# review QC-283 — acondicionamiento-en-el-recorrido

Reviewer, 2026-10-14. Diff `2ebf7634` (merge-base con `origin/dev`)..`3d8a2eac`, 71 archivos.
Grafo de código no usado: exploración con Grep/Read y el diff completo de `app/`, `lib/` y `db/`.

## Veredicto: RECHAZADO

Un solo bloqueante. Es mecánico y se arregla en un commit: la guardia
`guard-identificador-de-request` sale roja por el E2E nuevo. El resto de la feature está bien.

## Verificación ejecutada (salida real)

- `pnpm run typecheck`: `tsc --noEmit` sin errores.
- `pnpm run lint`: `✖ 7 problems (0 errors, 7 warnings)`. Los 7 avisos están en archivos que el
  diff no toca.
- `pnpm exec vitest run guard`: **`Test Files 1 failed | 75 passed (76)`, `Tests 1 failed | 1065 passed | 20 skipped`**.
  - Falla `tests/guards/guard-identificador-de-request.test.ts` › «no hay ningun archivo nuevo en
    e2e/ y existe el test que lo sustituye (R21)», con `AssertionError: expected [ Array(1) ] to deeply equal []`.
  - `tests/baseline-rojos.json` tiene `"archivos": {}`, así que es un rojo nuevo y no deuda heredada.
- `pnpm exec vitest run tests/unit/asignaciones/ tests/ui/dashboard/ tests/unit/dashboard/ tests/unit/paridad/recorridos-paridad.test.tsx`:
  `Test Files 70 passed (70)`, `Tests 1799 passed (1799)`.
- Los `.int` afectados, con `--project integration`: `Test Files 8 passed (8)`, `Tests 77 passed (77)`.
  Son `conditioning-execution-log`, `order-execution-entries-constraints`, `execution-log-read`,
  `conditioning-team-repository`, `finish-conditioning-batch-data`, `finished-orders`,
  `start-conditioning-team` y `inventario/finished-batch-labels`.
- No corrí el E2E. La bitácora da verde en chromium y webkit contra una base desechable.

## Checklist

### Reviewer 1–4
- [x] **Trazabilidad.** Busqué con grep el título de cada caso del mapa de T10, R1–R36, y existe
  en su archivo. Leí el contenido de R23, R24, R4 y de la redefinición de R1/R24 en
  `execution-log-repository.test.ts`, y verifican lo que dicen.
- [x] **Tasks.** T1–T10 están marcadas `[x]`. Pero T10 dice «Hecho cuando: `./init.sh` en verde»
  y no se corrió. Con la guardia roja no se cumpliría (ver B1).
- [ ] **Checkpoints:** ver abajo. Falla «`./init.sh` en verde».
- [x] **Verificación ejecutable.** Corrí todo lo de arriba sin fiarme de la bitácora, y así
  apareció el rojo de la guardia.

### CHECKPOINTS.md
- [x] Existen `requirements.md` (EARS, R1–R36), `design.md` con alternativas descartadas y
  `tasks.md` con todo `[x]`.
- [x] `design.md` abre con `## Lo que ya existe`, que no está vacía, y el diff no re-crea nada de
  esa lista.
  - `listByOrdersInCompany` es nuevo y está declarado NUEVO en C2.10.
  - `createFinishedBatchLabels` se extiende con un parámetro opcional (C2.5).
- [x] Assignee en Jira y rama publicada (`progress/features/QC-283.md`).
- [x] Cada R tiene su test, y el mapa está en `progress/impl_QC-283.md > T10`.
- [x] Typecheck y lint en verde.
- [ ] `gate-completo` en verde: todavía no hay PR. Con B1 saldría rojo.
- [x] Flujo crítico: el E2E de Playwright existe y su salida local está en la bitácora.
- [x] Sin dependencias nuevas: `package.json` y `pnpm-lock.yaml` no tienen diff (R35).
- [x] Ni secretos ni configuración hardcodeados. No hay webhooks.
- [ ] `./init.sh` (rápido) en verde: **no**, por la guardia (B1).
- [ ] Cierre en `progress/features/QC-283.md` y desmontar el worktree: es posterior al review, no
  aplica todavía.

### docs/checkpoints-proyecto.md
- [x] Typecheck y lint. El E2E es de Playwright.
- [x] Multiplataforma.
  - Las piezas nuevas no tienen controles interactivos ni inputs, y no usan `100vh`.
  - El único `:hover` es el realce que ya existía en `BODY_HOVER_CLASS`.
  - Las filas del equipo miden ≥ 40 px (`min-h-10`), como manda el design, y no se pueden pulsar.
- [x] Catálogo.
  - Las tres piezas nuevas son internas de la ruta y aplican el paso 3 (compón), declarado en
    `design.md > Front y catálogo`.
  - Ninguna toca `components/ui`, `components/shared`, `lib/shared/ui` ni `hooks`.
- [x] Pase `/design`: los seis tableros están en `docs/diseno/canvas/` y los cita `design.md > UI`.
- [x] Empresa.
  - No hay tabla nueva.
  - `listByOrdersInCompany` y las dos consultas nuevas del filtro filtran por `companyId`.
  - Hay test de rechazo cruzado: `execution-log-read.int` › «R10: el filtro por equipo no cruza
    empresas» y `conditioning-team-repository.int` › «R10: …filtra por empresa».
- [x] Permiso: no hay ninguno nuevo. Que `dashboard.consultar` se comprueba antes de leer el
  equipo lo prueba R11 en los dos casos de uso.
- [x] RLS: no hay tabla nueva, y `order_execution_entries` mantiene RLS forzada.
- [x] Acceso a datos solo por adaptadores Prisma.
- [x] Migraciones con `down.sql`.
  - El down de las acciones aborta con `RAISE EXCEPTION` si hay filas nuevas.
  - Tira y recrea los dos CHECK de QC-82 que nombran `action` (`reason_matches_action` y
    `packing_has_no_step`). Lo comprobé contra `20261006180000_order_execution_entries`: no hay
    ninguno más.
  - El down de `batch_lines` tira los tres CHECK y la columna.
  - Ninguna migración tiene `INSERT` ni `UPDATE` (R9).
- [x] Hexagonal.
  - `domain/` importa solo zod y contratos de otros módulos: `@/lib/modules/inventario` y `@/lib/modules/pedidos`.
  - Los dos modelos que se consultan son `@module asignaciones`.
  - No hay rutas profundas entre módulos.
  - El cableado está en `lib/composition`.
- [x] La lógica está en `domain/`: duraciones, foto y traducción de errores. Las Server Actions no
  cambian.
- [x] Permisos de página y Server Actions: sin cambios.

### perfil-agentes > reviewer 5–11
- [x] 5. Calidad y seguridad: capas separadas; ni secretos ni contexto hardcodeados.
- [x] 6. Multiplataforma: ver arriba.
- [x] 7. Dependencias: no hay ninguna.
- [x] 8. Aislamiento por empresa: ver arriba.
- [x] 9. Comentarios de producción. Ninguna línea añadida en `app/`, `lib/` ni `db/` cita
  `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada» (comprobado con grep sobre el diff).
- [x] 10. Duplicados: las piezas nuevas no cubren ninguna fila del catálogo.
- [x] 11. Diseño: los tableros están citados en el `design.md`. Las piezas son internas y sin fila,
  como declara el design.

## Hallazgos

### B1 — BLOQUEANTE: la guardia `guard-identificador-de-request` sale roja por el E2E nuevo
- `e2e/recorrido-acondicionamiento.spec.ts` es un archivo nuevo en `e2e/`.
- La guardia tiene una lista cerrada de specs E2E admitidos, y darse de alta en ella es su punto
  de extensión. Ver en el mismo archivo las altas de `acondicionamiento.spec.ts`,
  `acondicionar-con-equipo.spec.ts`, etc.
- El diff añadió a la guardia las dos migraciones (`MIGRACIONES_ESPERADAS`) pero no el spec.
- El rojo no está en `tests/baseline-rojos.json`.
- Consecuencias: `./init.sh` rápido saldría rojo (corre todas las guardias), el check
  `gate-completo` también, y el «Hecho cuando» de T10 no se cumple.
- **Qué falta:** dar de alta `recorrido-acondicionamiento.spec.ts` en esa lista. La entrada lleva
  su motivo («lo que ejercita» y que no toca el identificador de petición ni `reference`), como
  las demás. Después, `pnpm exec vitest run guard` tiene que salir verde.

### Puntos que marcó el implementer

1. **`append` solo manda `batchLines` en `conditioning_batch_save`.** Correcto: C2.3 pide `null`
   en el resto, y omitir la columna la deja en NULL. El CHECK `batch_lines_matches_action` lo
   asegura, y lo cubre el int R7 «foto en cualquier anotación que no sea un guardado».
   Sin hallazgo.
2. **`cancel` en una fase sin cierre.** Es el literal de C3.3: solo `production` y `packing` se
   cierran con `cancel`. El caso de acondicionamiento no se da con el código actual:
   `cancel-assigned-order` es la única fuente de `cancel`, y `EN_EMPAQUE`/`POR_EMPACAR` ya dan
   `not_cancellable`. Lo cubre «R24: un cancel tras una anotación de acondicionamiento…».
   Sin hallazgo.
3. **Rejilla `auto-fit` en vez del corte ≤ 760 px de design.md** — **menor.**
   - El código sigue el tablero aprobado, y el razonamiento es correcto: con el sidebar, el
     contenedor de tablet queda por debajo de 760 y el corte daría 2 columnas en vez de 3+2.
   - Pero entre unos 520 y 760 px de contenedor salen 3–4 columnas, cuando `design.md > UI` dice
     2 para ≤ 760.
   - Ningún R depende de esto (R18 trata las líneas del guardado, no la rejilla).
   - Pido una línea en `design.md` o en `progress/features/QC-283.md > Decisiones` que deje el
     tablero como referencia, para que el próximo no lo «corrija».
4. **C2.5 entró en T4 y no en T5.** Era necesario para compilar el cableado de C2.4, y la firma es
   la del contrato. Sin hallazgo.
5. **Tres tests existentes cambiados.**
   - `execution-log-repository.test.ts` › R1/R24 de QC-82: pasa de 8 a 11 acciones y las claves
     ganan `batches`. Siguen comprobando lo mismo (igualdad exacta) y llevan nota fechada.
   - Las limpiezas de `start-conditioning-team.int` y `finish-conditioning-batch-data.int` borran
     antes las anotaciones por la FK RESTRICT. Es limpieza de fixture y no debilita nada.
   - Sin hallazgo.
6. **`batch_not_found` antes de la transacción.** Lo cubre el spec: C2.7 paso 1 lo exige con el
   mismo error, y R4 pide «el mismo error que hoy», que se mantiene
   (`ConditioningBatchNotFoundError(batchId)`). Dentro de la transacción, `writeFinishedBatchLabels`
   vuelve a comprobar con `FOR UPDATE`, así que la carrera queda cubierta. Sin hallazgo.
7. **`as` en `batchLabelsError`** — **menor.**
   - `ExecutionWriteOutcome` es `string | { kind: string }`, así que el `as` no lo verifica el
     compilador.
   - Hoy es correcto, porque solo este caso de uso lanza `ExecutionAbortedError` dentro de su
     `run` con ese tipo.
   - Lo mismo vale para los dos `presentationOf.get(...)!` de `composeSnapshot`, que son seguros
     tras el `find` de `missing`.
   - Se puede quitar el `as` con un tipo propio o un guard por `kind`. No bloquea.
8. **«Hasta la siguiente» en las anotaciones nuevas.** `design.md > UI > Línea de tiempo` dice
   «se mantiene», y el design gana al tablero. Sin hallazgo.
9. **`supervisor` y `savedBy` como `ReactNode`.** Es una decisión de implementación razonable:
   evita el import circular y `StepPerson` sigue en la línea de tiempo. Sin hallazgo.
10. **Fixture E2E: 1 suelta + 1 por grupo.**
    - R36 solo exige «comenzar con equipo» y que el filtro por un miembro que no firma encuentre
      el pedido, y las dos cosas se cumplen.
    - La redacción de T9 («dos personas, una por grupo») es ambigua.
    - **menor:** que lo confirme el humano al revisar el PR. No bloquea.

### Otros menores
- **M1.** `tests/` y `e2e/` tienen comentarios nuevos que citan `QC-283`, del tipo «Nota
  2026-10-14 (QC-283)» y el alta en `guard-identificador-de-request`.
  - `docs/conventions.md > Comentarios` aplica a los tests «la misma regla», salvo `R<n>` en el
    nombre del caso.
  - Lo atenúa que el `design.md` pide «nota fechada» y que es el patrón del archivo.
  - El punto 9 del perfil solo bloquea en producción, así que esto es menor.
- **M2.** El grafo de código no se usó en ninguna tanda (consta en la bitácora). Solo es
  informativo.
