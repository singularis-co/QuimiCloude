# QC-203 — agrupar-insumos-por-familia-de-unidad · requirements.md

> **Zona** `fullstack` · **Complejidad** `high` · **depends_on** — ·
> **Rama** `feature/QC-203-agrupar-insumos-por-familia-de-unidad`
>
> ## Alcance
>
> Un insumo (`PRODUCT`) pasa a identificarse por **nombre + familia de unidad**, no por nombre +
> unidad. Si el alta manual llega en otra unidad de la misma familia que un homónimo vivo, no nace
> otro producto: la cantidad y el costo unitario se **convierten a la unidad del existente** y se le
> agrega un lote, con **aviso antes de guardar** («Ya existe Glicerina en l: 500 ml se guardarán
> como 0,5 l»). La **importación desde Excel** (QC-209) aplica la misma regla. La **importación de
> fórmula en PDF** (QC-159) deja de crear materias primas sin unidad: la unidad se sugiere desde lo
> leído en el PDF y, si no hay sugerencia, el revisor la elige. El producto conserva una sola
> unidad; recetas, pedidos y costeo no cambian.
>
> ## Lo que NO entra
>
> - **Fusionar homónimos que ya existen partidos** y dar unidad a materias primas ya creadas sin
>   unidad: se quedan como están; la regla solo aplica a lo nuevo. Decisión del humano, sin ficha.
> - **Unicidad en base** (dos altas a la vez, renombrar) → **QC-205**; su índice debe ser por
>   nombre + familia (comentado en el issue).
> - **Cruzar familias** (kg↔l necesita densidad). Fuera de alcance.
>
> _Sembrado por `/afinar-feature` el 2026-10-14. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`._

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

- **BLOQUEADO (spec_author, F1.2, 2026-10-14): falta el pase `/design`** de dos cambios visuales
  que el alcance exige (`docs/perfil-agentes.md > Pase de diseño para componentes nuevos` y
  `> spec_author`). Ninguno está en los tableros aprobados de `docs/diseno/canvas/`:
  1. **Aviso de conversión en el formulario de alta de producto**
     (`app/(private)/inventario/components/product-form.tsx`): «Ya existe Glicerina en l: 500 ml
     se guardarán como 0,5 l». Reutilizaría `Notice` (`components/shared/notice.tsx`, paso 1 de la
     regla de decisión), pero es UI visible nueva en el formulario: `ModalesInventario.dc.html`,
     `Inventario.dc.html` y sus variantes no la recogen (buscado «aviso», «ya existe», «convert»).
  2. **Selector de unidad de la materia prima nueva** en la revisión de fórmula
     (`app/(private)/produccion/formulas/importar/[documentoId]/components/formula-ingredient-row.tsx`,
     modo «Crear materia prima»), con su estado «sin sugerencia: elige una unidad».
     `ImportarFormula.dc.html` y `ImportarFormulaMovil.dc.html` solo pintan «Nombre de la materia
     prima».

  Qué hace falta: el tablero de esas dos piezas (escritorio, tablet y teléfono, con estados)
  aprobado por el humano y copiado a `docs/diseno/canvas/`. Con él, se relanza `spec_author`.
  Investigación ya hecha (no se repite): «Lo que ya existe» sin duplicados en board, specs ni
  código (QC-121, QC-199, QC-204, QC-205 relacionadas, ninguna lo resuelve); el criterio de familia
  `baseUnitId ?? id` está repetido sin helper exportado (`convert-quantity.ts:93`,
  `convert-with-approximation.ts:12`, `get-assigned-order-execution.ts:36`,
  `compatible-unit-ids.ts:16`, `unit-prisma.ts:228`); la confirmación del Excel ya pasa por
  `createProduct` (`confirm-inventory-import.ts:112`), pero la vista previa
  (`plan-inventory-import.ts:451-454`) necesita la existencia de cada homónimo, que
  `ImportProductRef` no trae hoy.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-05 | ¿Agrupar al leer o evitar que se partan en el alta? | Evitar en el alta. Agrupar al leer queda descartado (descripción del issue). |
| 2026-10-14 | ¿Qué es «misma familia»? | Misma base efectiva `baseUnitId ?? id` (heredado de QC-195). «u» y las unidades de empresa sin base son cada una su propia familia (QC-76). Se reutiliza la lógica existente, no se duplica. |
| 2026-10-14 | ¿Cómo se convierte? | `convertQuantity` del módulo `unidades`, exacta (heredado de QC-76). Entre familias distintas no se convierte ni se agrupa. |
| 2026-10-14 | Homónimos ya partidos en datos | Se quedan como están. Sin migración ni listado. Solo aplica a altas nuevas. |
| 2026-10-14 | Varios homónimos de la familia ya partidos: ¿a cuál va el alta? | Al de **más existencia**, comparada en una misma unidad; en empate, al más antiguo. |
| 2026-10-14 | La cantidad convertida no cabe en 4 decimales (0,25 ml → 0,00025 l) | **Se rechaza el alta con mensaje** que pide ingresarla en la unidad del producto. No se redondea. |
| 2026-10-14 | El costo unitario convertido no cabe en 4 decimales | Se rechaza igual que la cantidad. Si el alta trae costo total, el unitario se deriva sobre la cantidad ya convertida con la regla vigente (`deriveUnitCost`, QC-52). |
| 2026-10-14 | ¿El formulario avisa de la conversión? | Sí, **antes de guardar**, con cantidad origen y convertida. |
| 2026-10-14 | ¿Cubre la importación desde Excel (QC-209)? | Sí: agrupa por familia y convierte con estas mismas reglas. |
| 2026-10-14 | ¿Cubre la materia prima creada desde fórmula (QC-159)? | Sí. La materia prima nueva **nace con unidad**: se sugiere desde la unidad leída del PDF contra el catálogo (misma lógica que `suggestUnitId` de la importación de catálogo). Sin sugerencia, el revisor **debe elegirla**; sin unidad no se confirma. Con unidad, la búsqueda de homónimo (QC-159 R26) pasa a ser por nombre + familia. |
| 2026-10-14 | QC-205 (unicidad nombre + unidad) | Sigue aparte. Comentado en el issue que su índice debe ser por nombre + familia. |
| 2026-10-14 | Permiso | `inventario.modificar`, validado en el service (heredado de QC-121, QC-199, QC-49). Sin permisos nuevos. |
| 2026-10-14 | Precisión y borrado | `Decimal(14,4)`, nunca float (QC-14). Borrado lógico (QC-14, QC-121): solo cuenta el homónimo vivo. |
| 2026-10-14 | ¿E2E? | Sí, uno: alta «Glicerina 500 ml» sobre «Glicerina» en l → aviso, guarda, la existencia sube 0,5 l en el listado. |
