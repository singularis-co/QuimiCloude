# Review QC-264 — Rediseño de Fórmulas

## Vuelta 1 (diff 6fcbafe6..a940f221)

Revisor: reviewer (F2.2), 2026-10-19. HEAD `a940f221`: es `bb60ca3e` más un commit que solo toca
`progress/features/QC-264.md`.

### Verificación ejecutada (salidas reales)

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores y 10 avisos, todos en archivos fuera del diff (`step-evidence.tsx`,
  `list-execution-traces`, `confirm-catalog-import`, `order-service`).
- `pnpm exec vitest related --run <52 .ts/.tsx del diff>`: 117 archivos, 2055 ok y 3 skip, 0 rojos.
- `pnpm exec vitest run guard tests/unit/paridad tests/unit/proveedores/module-contract.test.ts`:
  105 archivos, 1535 ok y 20 skip, 0 rojos. Pasan los snapshots de paridad, entre ellos
  `acciones-por-fila`, que no cambió.
- `.int`: no aplica, porque el diff no toca `lib/` ni `db/`.
- E2E: no lo corrí (lo corre el CI). Para el punto 5 analicé el código, abajo.

### Checklist

**CHECKPOINTS.md**
- [x] requirements.md con R1–R51 en EARS.
- [x] design.md con alternativas descartadas (§ 8).
- [x] tasks.md: 190 `[x]` y ningún `[ ]`.
- [x] `## Lo que ya existe` abre el design y está completa. El diff no re-crea nada de esa lista:
  `FormFooterBar` es paso 4 justificado, y `recipe-version-tones.ts` es el mapa único que pide R44.
- [x] Assignee y rama publicada (progress/features/QC-264.md).
- [x] Trazabilidad: cada R1–R51 tiene un test concreto con aserciones reales. Comprobé los títulos y
  el cuerpo de `recipe-form-layout`, `recipe-form-preview`, `recipe-cards`, `recipe-steps-field`,
  `step-reader` (R22/R24/R26), `formulas-toasts` (R46, 7 éxitos y 6 errores),
  `guard-formulas-rediseno` (R44/R45, con prueba del detector) y `e2e/formulas-rediseno.spec.ts`
  (7 casos con R1, R2, R3, R5, R13, R15, R20, R22, R23, R27, R30 y R47).
- [x] El mapa R -> test está en `progress/impl_QC-264-rediseno-formulas.md`.
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` en CI: pendiente del PR (no es del reviewer).
- [x] Flujo crítico: la ficha es visual y no toca autenticación, permisos, inventario, importes ni
  webhooks. Las primeras líneas de las `page.tsx` (`requirePagePermission` / `requirePageAddon`)
  no cambian.
- [x] Dependencias: ninguna; `package.json` no se toca.
- [x] Sin secretos, sin webhooks y sin nada de configuración en el código.
- [x] `./init.sh` rápido: verde según la bitácora. Lo que yo corrí también pasa.

**docs/checkpoints-proyecto.md**
- [x] Los E2E son de Playwright.
- [x] Multiplataforma: `dvh` y no `vh`; `hover:` solo como estilo, nunca para activar; inputs con
  `text-base` (`FIELD_TEXT`); botones `touch` o `touchTarget`; `safe-area-inset-bottom` en los pies.
- [x] Catálogo: tienen su fila al día `StepReader`, `DocumentUpload*` y `cardFieldLabel` (subida
  por decisión humana, con dos rutas consumidoras y tableros en `Diseño`).
- [x] Pase de diseño: tableros citados en el design (tabla de piezas) y en la columna `Diseño`.
- [x] Datos, RLS, migraciones, módulos hexagonales: no aplican (sin cambios en `lib/` ni `db/`).
- [x] Permisos: las páginas siguen validando en servidor; las mutaciones siguen por Server Actions.

**Reglas del perfil del reviewer (5–11)**
- [x] 5 Calidad y seguridad: sin hallazgos.
- [x] 6 Multiplataforma: sin hallazgos.
- [x] 7 Dependencias: ninguna.
- [x] 8 Aislamiento por empresa: no aplica.
- [ ] 9 Comentarios: **falla**, M1.
- [x] 10 Duplicados: cada pieza nueva declara su paso de la regla.
- [x] 11 Diseño: cada pieza nueva o restilada tiene su tablero.

### Puntos que trajo el leader

1. **Snapshots regenerados.** Confirmado. `recetas-paridad` cambia también por el diálogo de subida
   (T1c), que `design.md > 6` no nombra para ese archivo; es la misma pieza aceptada en
   `catalogo-paridad` (P1). Los snapshots pasan. Ver m2.
2. **Snapshots de propagar, revisión y formulario no dados de alta.** Confirmado. Es decisión humana
   (Carlos Restrepo, 2026-10-19, en la bitácora y en progress/features). La cobertura la dan los
   tests nuevos que se citan.
3. **Desviaciones.** Confirmadas y aceptables:
   - En «Abrir»: `aria-hidden` en el texto visible y `sr-only` con el nombre completo. El nombre
     visible está contenido en el nombre accesible, así que cumple «label in name».
   - En el spec del menú: el renombre interno a `notify`, que no cambia la firma pública.
   - P9/P10: no son desviaciones, son los defectos del spec.
4. **`card-field-label` en shared.** Confirmado: decisión humana, con fila de catálogo y dos rutas
   que la consumen. El rótulo en mono contradice al tablero (`Formulas.dc.html:66`) y está en D63
   sin que conste una decisión humana sobre esa desviación. Ver m3.
5. **E2E rojo `e2e/pasos-de-envasado.spec.ts:435`.** Confirmado que **QC-264 no contribuye**:
   - El diff de `components/shared/step-reader/step-reader.tsx` solo actúa con `isPanel`, que vale
     `!isEjecucion && layout === 'panel'`.
   - En `ejecucion` no cambian `className`, `touch` ni `buttonCountdown`.
   - `buttonCountdown` lo trae `cb39a83d`, ancestro de `6fcbafe6` (comprobado con
     `git merge-base --is-ancestor`).
   - El rojo no aparece en `progress/deudas.md`. Ver m4.
6. **Choque con QC-203.** Confirmado. En `formula-import-review.tsx`, `formula-ingredient-row.tsx` y
   `formula-import-summary.tsx` el diff solo cambia marcado, clases, iconos, `ArrowLink`, `Card` y
   `FormFooterBar`. No se tocan el estado (`IngredientRowState`), `toDraftLine`/`toConfirmLine`,
   `buildConfirmReasons` ni los manejadores.

### Hallazgos

**Mayores (BLOQUEANTES)**

- **M1 — Comentario de producción que cita un requisito**
  (`app/(private)/produccion/formulas/components/recipe-step-editor.tsx:203`, añadido en
  `2dd05c45`):
  `// sin él las acciones se salían de la ventana (R20); así bajan a otra línea, a la derecha.`
  Incumple la regla 9 del perfil (`docs/conventions.md > Comentarios`). **Qué falta:** quitar
  `(R20)` del comentario. El motivo sin la cita basta.

**Menores**

- **m1 — Tildes en comentarios añadidos.**
  - `recipe-form.tsx`: «acompanan».
  - `step-reader.tsx`: «pagina» y «animacion».

  Es estilo y no tiene efecto.
- **m2 — `design.md > 6` sin actualizar.** La fila de `recetas-paridad` no nombra el diálogo de
  subida, y la de `acciones-por-fila` anuncia un cambio que no ocurrió (el snapshot sigue igual y
  pasa). Los dos hechos están anotados en la bitácora; conviene reflejarlos en § 6 para que la regla
  «toda diferencia no listada es un fallo» siga siendo verdad.
- **m3 — Rótulo de tarjeta en mono, contra el tablero** (`Formulas.dc.html:66`; nace en
  `DataTableCards`). Está como deuda en D63 (`progress/deudas.md:505-519`), pero no consta que el
  humano aceptara la desviación visual. Pedir esa aceptación explícita o asignar la deuda.
- **m4 — Rojo E2E ajeno sin registrar.** El rojo de `pasos-de-envasado.spec.ts:435` («Terminar00:01»,
  de `cb39a83d`) no figura en `progress/deudas.md` ni en el board. Es del leader o de QC-291, no de
  esta ficha, pero hoy solo consta en la bitácora de QC-264.

### Veredicto

**RECHAZADO** por un único bloqueante, M1: el comentario de producción
`recipe-step-editor.tsx:203` cita `R20`. El resto pasa: trazabilidad completa, tasks cerradas,
typecheck, lint, tests relacionados, guardias y paridad en verde. Basta un commit que quite la cita
para la vuelta 2.

## Vuelta 2 (acotada a 8cb8dcd6..4de481b4 + 62e3ce1a)

HEAD revisado: `4de481b4`. `62e3ce1a` es ancestro de HEAD.

### Hallazgos de la vuelta 1

- [x] **M1 — corregido** (`4de481b4`): en `recipe-step-editor.tsx:203` el comentario ya no cita
  «(R20)». Volví a pasar el filtro de la regla 9 sobre todo el diff `6fcbafe6..HEAD` en `app/` y
  `components/`, y no queda ningún comentario añadido que cite `QC-<n>`, `R<n>`, `design.md` ni
  «decisión cerrada».
- [x] **m1 — corregido** (`4de481b4`): «acompañan» (`recipe-form.tsx`), «página» y «animación»
  (`step-reader.tsx`).
- [x] **m2 — corregido** (`631e76a6`): `design.md > 6` cuadra con los snapshots reales.
  `recetas-paridad` incluye el diálogo de subida, `acciones-por-fila` queda «ninguno» y de
  `confirmaciones-paridad` sale propagar. La decisión humana sobre los tres snapshots que no se dan
  de alta queda citada.
- [x] **m3 — cerrado**: el humano aceptó el rótulo en mono como deuda D63
  (`progress/features/QC-264.md:61`).
- [x] **m4 — cerrado** (`62e3ce1a`): D76 (antes D71, renumerada en el merge de dev) en `progress/deudas.md`, con origen, qué falta y dueño
  candidato (QC-291).

### Regresiones

Ninguna. El cambio en producción se limita a 4 líneas de comentario y no altera ni código ni marcado.
No hay tests nuevos que pedir. El leader informa de que el gate local está verde. Typecheck, lint y
tests no los volví a correr: el diff no cambia nada que se pueda ejecutar.

### Veredicto vuelta 2

**OK.**
