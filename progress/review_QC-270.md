# QC-270 — Revisión

Rama `feature/QC-270-cabecera-alineada`, diff `origin/dev...HEAD` (d191648e..e1fb0b25). `origin/dev`
va 2 commits por delante, los dos solo en `progress/features/QC-224.md`: no afectan.

## Verificación ejecutada por el reviewer

- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores (warnings `no-unused-vars` preexistentes en `confirm-catalog-import.test.ts`
  y `order-service.test.ts`, ajenos al diff). `eslint` de `components/shared/data-table` y del test
  tocado: sin incidencias.
- `pnpm exec vitest related --run` de los 3 archivos de producción y el test:
  `Test Files 234 passed (234) · Tests 3834 passed | 1 skipped`.
- `pnpm exec vitest run guard`: `Test Files 75 passed (75) · Tests 1047 passed | 20 skipped`.
- Sin `.int` afectados (cambio solo de presentación). `./init.sh --completo` lo corre el leader.
- Revisión mecánica propia de los `.snap` (script Python en el scratchpad sobre
  `git diff -U0 origin/dev...HEAD -- tests/unit/paridad`), independiente del `revisa-snaps.mjs`
  del implementer.

## Checklist

### CHECKPOINTS.md
- [x] requirements.md con R1–R8 en EARS.
- [x] design.md con 4 alternativas descartadas y su porqué.
- [x] tasks.md: T1–T5 marcadas `[x]`.
- [x] design.md abre con `## Lo que ya existe`, con contenido; el diff no re-crea nada: reutiliza
  `DataTableHeaderCell` y `data-table-column-style.ts`, y **elimina** la traducción duplicada
  `columnAlign` de `data-table.tsx` (va a menos duplicación).
- [x] Equipo: rama con commit `chore(QC-270): feature tomada por ArqDev` (candado).
- [x] Cada R<n> mapea a un test concreto (ver Trazabilidad).
- [x] `progress/impl_QC-270.md` lleva el mapa R<n> -> test.
- [x] typecheck y lint en verde.
- [ ] `gate-completo` en CI: pendiente del PR (no evaluable aquí).
- [x] Flujo crítico: no toca ninguno (autenticación, permisos, inventario, importes, webhooks).
- [x] Sin dependencias nuevas (no toca `package.json`).
- [x] Sin secretos, sin webhooks, sin configuración hardcodeada.
- [ ] `./init.sh` en verde: el implementer lo reporta en verde; `--completo` lo corre el leader.
- [ ] Cierre de `progress/features/QC-270.md` y desmontaje del worktree: posteriores a esta revisión.

### docs/checkpoints-proyecto.md
- [x] Calidad de código: typecheck y lint.
- [x] Multiplataforma: `justify-content`/`text-align` sin riesgo en WebKit/Chrome Android; no hay
  `100vh`, `:hover`, inputs ni librería nueva; `touchTarget` del botón de orden y del disparador
  sin cambio (design.md > 1.4).
- [x] Catálogo: no hay pieza nueva, ni prop, ni punto de extensión nuevo (`align` ya existía); la
  fila `DataTable` no necesita cambio. Su celda `Diseño` ya cita `docs/diseno/canvas/Tabla.dc.html`.
- [x] Pase de diseño: cambio visual de pieza existente con referencia en design.md
  (`Tabla.dc.html:40-41`, verificado: `th class="num"` con botón de orden dentro, y
  `qc.css:58 .num{text-align:right}`). Sin tablero de cabecera centrada: P2 aprobado por defecto.
- [x] Datos/seguridad, módulos hexagonales, permisos: no aplican (sin esquema, consultas, acciones ni
  rutas).

### Reglas del reviewer (perfil, 5–11)
- [x] 5 Calidad/seguridad: capas intactas; solo presentación.
- [x] 6 Multiplataforma: ver arriba.
- [x] 7 Dependencias: ninguna.
- [x] 8 Aislamiento por empresa: no aplica.
- [x] 9 Comentarios: los dos JSDoc nuevos de `data-table-column-style.ts` explican el porqué
  (unificar la traducción; `text-align` no mueve un `flex`) y no citan fichas, R<n>, design.md ni
  decisiones cerradas.
- [x] 10 Duplicados: no hay componente nuevo.
- [x] 11 Diseño: referencia presente en design.md y en la celda `Diseño` de la fila.

## Trazabilidad (verificada leyendo los tests)

Todos en `tests/unit/shared/data-table-header-menu.test.tsx`, montando `DataTable` real con columnas
`start`/`end`/`center` ordenables:

| R | Test | Verifica de verdad |
|---|---|---|
| R1 | «R1: una columna end…» + «R1, R7: end se traduce…» | `th` con `text-right`, contenedor con `justify-end` |
| R2 | «R2: una columna center…» + «R2, R7…» | `th` con `text-center`, contenedor con `justify-center` |
| R3 | «R3: una columna start…» + «R3, R7…» | ni `text-right`/`text-center` en `th` ni `justify-*` en el contenedor |
| R4 | «R4: …por clic…», «R4: …por teclado…» | `aria-sort` none -> ascending en `end` y `center` |
| R5 | «R5: el menu de una columna end o center…» | menú: ordenar desc (`aria-sort=descending`) y fijar (`data-pinned=left`) |
| R6 | «R6: en las tres alineaciones…» | `compareDocumentPosition`: botón de orden antes del disparador |
| R7 | «R7: las celdas del cuerpo conservan…» | `text-right`/`text-center`/nada en `data-table-cell-*` |
| R8 | commit 4b91158f + revisión mecánica | ver abajo |

## Foco 1 — Snapshots de paridad (R8)

- 4b91158f toca **solo** los 11 `.snap` de `tasks.md > Archivos esperados` (+47 −47); ningún otro
  archivo.
- Toda línea `-` tiene su `+` emparejada; fuera de `class="…"` las líneas son idénticas.
- Cambios: 11 `th data-table-head-*` ganan `text-center`; 36 `div` pasan de
  `flex gap-2 items-center min-w-0` a `… justify-end …` (25) o `… justify-center …` (11). Ninguna
  otra clase entra.
- La única clase que sale es `text-left`, en los 11 `th` que ganan `text-center` (y solo ahí).
- Coherencia en todos los `.snap` de paridad tras el cambio: cada `th data-table-head-*` con
  `text-right` lleva su `div` con `justify-end` (25/25), cada uno con `text-center` lleva
  `justify-center` (11/11) y ningún `start` gana `justify-*` (240). Los 16 `th` con `text-right` sin
  `justify-end` son de `formularios-paridad` y usan la primitiva `Table` a pelo, no `DataTable`:
  fuera del alcance y correctamente sin cambio.

Cumple R8.

## Foco 2 — Desviación de T4 (`text-left` -> `text-center`)

Correcta. `TableHead` (`components/ui/table.tsx:73`) trae `text-left` en su base y `cn` es
`twMerge(clsx(...))` (`lib/utils.ts:5`): `text-center` del `className` gana y elimina `text-left`.
Es exactamente lo que ya pasaba en `dev` con `text-right` en las columnas `end` (sus `th` ya no
llevaban `text-left`). Sin `text-left` + `text-center` juntos, que dejaría el resultado a merced del
orden de la hoja de estilos. No rompe nada: los 234 archivos relacionados pasan. Es una clase de
alineación de cabecera, dentro de lo que R8 permite; solo contradice la redacción literal de T4
(«no sale ninguna clase»), y está anotada en la bitácora.

## Foco 3 — Orden, menú y DOM (R4–R6)

El diff no toca `toggleHeaderSort`, `aria-sort`, `SortIcon`, el `DropdownMenu` ni el orden de los
hijos del `div` (botón/etiqueta y después `children`). Solo cambia `justify-content`. Los tests R4,
R5 y R6 lo cubren en `end` y `center` y pasan. El botón de orden no tiene `flex-1`/`w-full`, así que
`justify-*` sí agrupa el contenido.

## Foco 4 — Comentarios

Ver regla 9: sin citas a fichas ni requisitos.

## Impacto en otras tablas

`DataTableHeaderCell` solo lo usa `DataTable` (`data-table.tsx:318`). Todas las listas con columnas
`end`/`center` (incluidas las de `actionsColumn()`) cambian su cabecera, que es el alcance aprobado
(D2, P1 por defecto). Las celdas del cuerpo producen las mismas clases que antes (R7, y ningún
`.snap` cambia en celdas de cuerpo). `vitest related` (234 archivos) en verde.

## Hallazgos

- **menor** — R4 pide reflejar el orden «en `aria-sort` y en el icono»; el test solo comprueba
  `aria-sort`. El icono depende del mismo estado (`isActive`) y no se toca, así que el riesgo es
  bajo.
- **menor** — R5 habla de «fijar o soltar, filtrar, según lo que declare la columna»; el test cubre
  ordenar descendente y fijar, pero no soltar ni filtrar (las columnas del test no declaran filtro),
  ni compara las opciones con las de una columna `start`. El código del menú no cambia.
- **menor** — P3 (etiqueta recortada por el inicio en columnas `end`/`center` estrechas con
  `overflow-hidden`): no se revisó en navegador («sin observación que anotar»). Está fuera de alcance
  por P3, pero queda sin evidencia visual; conviene un vistazo antes de cerrar.
- **menor** — `tasks.md > T4` dice «no sale ninguna clase» y la implementación saca `text-left` en
  11 `th`. Desviación justificada y aceptada por el leader; si se quiere coherencia del spec, se
  puede anotar en tasks.md.

Ningún bloqueante.

## Veredicto

**OK**
