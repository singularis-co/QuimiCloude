# review QC-203 — agrupar-insumos-por-familia-de-unidad

Revisión de `git diff origin/dev...HEAD` (HEAD `14b9bb41`) · 2026-10-23 · reviewer.

## Verificación ejecutada (no solo la bitácora)

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores y 7 warnings, todos en archivos que el diff no toca.
- `pnpm exec vitest run` sobre los 21 archivos unitarios del diff, más el filtro `guard`: 97 archivos,
  1483 verdes y 20 saltados. Los saltados son preexistentes y vienen de las guardias.
- `vitest --project integration` contra Postgres sobre `supply-homonyms`, `create-raw-material`,
  `product-unit-without-presentation`, `inventory-import-repository` y `formula-import`: 5 archivos,
  38 verdes.
- No corrí el E2E ni `./init.sh` (los corre el CI). La salida local del E2E está en `impl_ > Tanda 6`.
- MCP del grafo: no lo usé. Exploré con Grep/Read y con el diff.

## Checklist

### Especificación
- [x] `requirements.md` tiene R1..R30 en EARS.
- [x] `design.md` tiene 6 alternativas descartadas y su porqué (§10).
- [x] `tasks.md`: T1..T15, todas `[x]`.
- [x] `design.md` abre con `## Lo que ya existe` y la búsqueda está hecha. El diff no re-crea nada
  de esa lista:
  - publica `effectiveBaseId` como `unitFamilyId` en vez de duplicarla;
  - reutiliza `convertQuantity`, `deriveUnitCost`, `suggestUnitId`, `addOrCreate` y `addBatchToAlive`;
  - retira `findAliveIdByNameInUnit` sin dejar código muerto.

### Trazabilidad
- [x] El mapa R1..R30 → test está en `progress/impl_… > Tanda 6`.
- [x] Busqué en su archivo cada test nombrado en el mapa y todos existen. Ninguno lleva
  `.skip`/`.only`/`.todo`.
- [x] Leí los cuerpos de los casos de R4–R11 y R29 (`create-product-familia`), R24–R28
  (`confirm-formula-import-unidad`) y R30 (E2E, que afirma en el listado y en Postgres). Afirman lo
  que dice su nombre, sin cuerpos vacíos.

### Calidad de código
- [x] Typecheck y lint en verde.
- [ ] `gate-completo` en CI: pendiente de PR. No es de esta revisión.
- [x] El flujo crítico «movimientos de inventario» tiene su E2E de Playwright, con la salida local en
  `impl_`.
- [x] No hay dependencias nuevas: el diff no toca `package.json` ni `pnpm-lock.yaml`.

### Seguridad y configuración
- [x] No hay secretos ni valores de entorno hardcodeados.
- [x] No hay webhooks.

### Datos y seguridad
- [x] No hay migración ni modelos nuevos. `db/` no cambia.
- [x] `findAliveSupplyHomonyms` filtra por `productCompanyScope(scope)` y la empresa sale del actor.
  El rechazo cruzado lo prueban `supply-homonyms.int > R12` y `find-supply-homonyms > R12`.
- [x] `createRawMaterial` y `confirmFormulaImport` validan la unidad con `findRefs(…, actor.companyId)`.
  El caso de la unidad de otra empresa tiene su test (R24).
- [x] Los permisos se comprueban en `domain/` antes de cualquier consulta, con test: R11 (alta y
  consulta de homónimos) y R28.
- [x] El acceso a datos va solo por el adaptador Prisma `driven`.

### Módulos hexagonales
- [x] `supply-family.ts` y `find-supply-homonyms.ts` son puros. De `unidades` se importa solo el
  barrel.
- [x] `documentos` no llama a `findAliveSupplyHomonyms`: resuelve con su contrato
  (`productNames.findAliveByNormalizedNames`).
- [x] El hook de la ruta importa `findSupplyHomonymsAction` del adaptador `driving`. El barrel no
  reexporta nada `'use server'`.
- [x] La lógica vive en `domain/`; la action solo delega.

### Multiplataforma
- [x] El selector «Unidad» de la fórmula lleva `touchTarget` y `text-base`.
- [x] En teléfono la rejilla es de una columna.
- [x] No hay `100vh`, ni activación solo por `:hover`, ni inputs de menos de 16 px.

### Componentes
- [x] Regla de decisión aplicada y declarada en `design.md`:
  - `Notice`: paso 1;
  - `PresentationUnitSelect` con `hint`: paso 2, y sus usos actuales no cambian (test «sin `hint` el
    árbol no cambia»);
  - `supply-conversion-notice` y `use-supply-homonyms`: paso 3, internos de la ruta.
- [x] La fila de `PresentationUnitSelect` en `CATALOGO.md` anota `hint`.
- [ ] **Celda `Diseño` de esa fila: ver hallazgo 2.**

### Comentarios (regla 9)
- [ ] **Ver hallazgo 1.**

## Hallazgos

1. **BLOQUEANTE (regla 9, `docs/conventions.md > Comentarios`).** Hay comentarios nuevos en
   código de producción que citan `QC-<n>`, `R<n>` o `design.md`:
   - `app/(private)/produccion/formulas/importar/[documentoId]/components/formula-import-review.tsx`,
     líneas 52, 73, 86, 237 y 284. Citan `QC-203 R21, R22`, `R23` y `QC-203 R23`.
   - `…/[documentoId]/components/formula-import-summary.tsx:35`: `QC-203 R27`.
   - `…/[documentoId]/components/formula-ingredient-row.tsx`:
     - línea 33: `QC-203 R23`;
     - línea 36: `QC-203 R21, R22; textos en design.md > 6`;
     - línea 64: `QC-203 R23`.
   - `lib/modules/inventario/domain/supply-family.ts`:
     - línea 38: `QC-38 R15, R16`;
     - línea 40: `QC-76`.

   Para cumplirla, cada comentario debe quedarse con el porqué y perder la cita a la ficha, al
   requisito o al design. Las líneas del diff en `tests/` no cuentan.

2. **BLOQUEANTE (regla 11, `docs/checkpoints-proyecto.md > Calidad de codigo`, último punto).**
   - `PresentationUnitSelect` cambia visualmente: pinta una ayuda visible nueva bajo el campo, la
     prop `hint`.
   - `design.md` cita los tableros que la piden: `AltaConversion*.dc.html` e
     `ImportarFormulaUnidad*.dc.html`.
   - Pero su fila en `components/shared/CATALOGO.md:82` sigue con `Diseño = previo al rediseño`.

   Falta citar ahí el tablero aprobado, por ejemplo `docs/diseno/canvas/AltaConversion.dc.html`.

3. **menor.** En `lib/modules/inventario/domain/plan-inventory-import.ts`, dentro de
   `resolveSupplyIdentity`, el `SupplyHomonym` se arma con `name: product.nameNormalized`, no con
   el nombre real. Hoy no se lee, porque el plan solo usa `id`, `unitId` y `type`. Pero el tipo
   promete el nombre visible, y alguien podría pintarlo más adelante.

4. **menor.** Con solo costo total, el formulario no comprueba en el navegador el derivado sobre la
   existencia convertida (R7). El servidor lo rechaza con `invalid_input`, sin campo. Es coherente
   con la limitación de R7 aceptada en `progress/features/QC-203.md > Decisiones`. Lo anoto solo
   para que el leader sepa que el aviso previo no lo cubre.

## Veredicto

**RECHAZADO**. La funcionalidad, la trazabilidad R1..R30, el aislamiento, los permisos y la
verificación ejecutable están bien. Los dos bloqueantes son de forma, se arreglan en pocas líneas y
no tocan la lógica:

1. Quitar las citas `QC-`/`R<n>`/`design.md` de los comentarios nuevos de producción (hallazgo 1).
2. Poner el tablero aprobado en la celda `Diseño` de `PresentationUnitSelect` en
   `CATALOGO.md` (hallazgo 2).

Para la vuelta 2 basta el diff acotado a esas dos correcciones, más typecheck, lint y
`vitest run guard`.
