
## F2 — Ficha, pestaña Lotes (frontend_dev, 2026-10-14)

Archivos:
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-list-section.tsx` (conteo con `canConsultOrderEvidence` + `countOrderEvidenceAction`)
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-batches-table.tsx` (columna `evidence`, prop `evidenceCounts`)
- `app/(private)/inventario/producto-terminado/[id]/components/batch-evidence-button.tsx` (nuevo)
- `app/(private)/inventario/producto-terminado/[id]/components/batch-evidence-dialog.tsx` (nuevo)
- `app/(private)/inventario/producto-terminado/[id]/components/index.ts`
- `tests/unit/inventario-ui/finished-product-batches-evidence.test.tsx` (nuevo)
- `tests/unit/inventario-ui/batch-evidence-dialog.test.tsx` (nuevo)
- `tests/unit/inventario-ui/finished-product-tables.test.tsx` (dobles de `@/lib/composition` y de `order-evidence-actions`)
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts` (nota fechada: admite las dos lecturas de evidencia; + R26)

Mapa R → test (F2):
- R4 → `finished-product-batches-evidence.test.tsx`: «R4 — sin pedidos.consultar…», «R4 — sin sesion…», «R4 — si el conteo falla…»
- R16 → `finished-product-batches-evidence.test.tsx`: los cuatro casos «R16 — …»
- R17 → `batch-evidence-dialog.test.tsx`: «R17 — título…», «R17 — un grupo sin fotos…», «R17, R20 — solo consulta…»
- R18 → `finished-product-batches-evidence.test.tsx` «R18 — la tabla de Lotes sigue sin tarjetas…»; `batch-evidence-dialog.test.tsx` «R18 — en teléfono…»
- R19 → `finished-product-batches-evidence.test.tsx` «R19 — dos lotes del mismo pedido…»; `batch-evidence-dialog.test.tsx` «R19, R24 — cerrar y volver a abrir…»
- R22 → `batch-evidence-dialog.test.tsx`: dos casos «R22 — …»
- R23 → `batch-evidence-dialog.test.tsx`: tres casos «R23 — …»
- R24 → `batch-evidence-dialog.test.tsx`: «R24 — una miniatura vencida…», «R19, R24 — …»
- R26 → `finished-product-route-contract.test.ts`: «R26 — ningun archivo de la ruta sube, cambia ni quita fotos…» y su caso «muerde»

Salida real:
- `pnpm run typecheck` → sin errores
- `pnpm run lint` → 0 errores, 7 warnings preexistentes en archivos ajenos
- `pnpm exec vitest run` (7 archivos de la ficha: los 2 nuevos, tables, page, tabs, params, route-contract) → 7 files, 66 tests passed
- `pnpm exec vitest run` (clientes/scope, inventario/product-route-contract, inventario/scope, recetas-ui/recipe-route-contract, shared/data-table-alcance) → 5 files, 102 passed, 2 skipped
- `pnpm exec vitest run guard` → 76 files, 1064 passed, 20 skipped

Veredicto: F2 hecha; queda la comprobación visual en escritorio, tablet y teléfono contra `ProductoTerminadoEvidencia*.dc.html`.

## Arreglo tras F1 — grupo ilegible bajo la anotación (frontend_dev, 2026-10-14)

Archivos:
- `components/shared/step-evidence/index.ts` (exporta `EvidenceGroupHeader`)
- `components/shared/CATALOGO.md` (mención aditiva en la fila de `StepEvidence`: pieza y props `title`, `count`, `titleId`; la guardia del catálogo la exigía)
- `app/(private)/dashboard/recorrido/[id]/components/trace-step-evidence.tsx` (con `photos: null` pinta grupo `role="group"` «Evidencia de fabricación, paso N» + `EvidenceGroupHeader` «Evidencia» n/3 + `EvidenceReadError` → `router.refresh()`; ya no usa `EvidenceStepList`)
- `tests/ui/dashboard/execution-trace-evidence.test.tsx` (caso nuevo)

Mapa: R23 → `tests/ui/dashboard/execution-trace-evidence.test.tsx` > «R23 — el grupo ilegible bajo su anotacion se rotula «Evidencia», no «Paso N», con su contador y «Reintentar»»

Salida:
- `pnpm run typecheck` → sin errores
- `pnpm run lint` → 0 errores, 7 warnings (preexistentes, en confirm-catalog-import.test.ts y order-service.test.ts)
- `pnpm exec vitest run` (4 archivos: execution-trace-evidence, execution-trace-detail, step-evidence, evidence-step-list) → 4 files, 70 passed
- `pnpm exec vitest run guard` → 76 files, 1064 passed, 20 skipped

Veredicto: arreglo hecho; el grupo ilegible bajo la anotación dice «Evidencia» con su contador, como el tablero.

## TI (cierre) — arreglo de hidratación en `StepEvidence` y E2E (implementer + frontend_dev, 2026-10-16)

Causa del rojo de R27: el `onLoad` de la `<img>` se perdía en la hidratación (la imagen ya había cargado antes de enganchar el handler), y la cuadrícula se quedaba en `aria-busy`. El arreglo, aprobado por el humano y solo con `consult`, es un callback ref al montar:
- `complete && naturalWidth > 0` marca la imagen como cargada;
- `complete && naturalWidth === 0` la marca como error («Vista vencida»).

Sin `consult` no cambia nada (R21).

Archivos:
- `components/shared/step-evidence/step-evidence.tsx`
- `tests/unit/shared-ui/step-evidence.test.tsx`: casos nuevos «R22 — una miniatura ya cargada antes de enganchar el handler sale de cargando», «R22 — una miniatura ya fallida antes de enganchar el handler pasa a «Vista vencida»», «R22 — una miniatura aún sin terminar sigue en cargando» y «R21 — sin `consult`, una miniatura ya fallida no pasa a «Vista vencida»»

Salida real:
- `pnpm run typecheck` → sin errores
- `pnpm run lint` → 0 errores, 7 warnings ya existentes en archivos ajenos
- `pnpm exec vitest related --run` (step-evidence.tsx + su test) → 62 files, 959 passed. En una primera corrida, 1 timeout ajeno en un `beforeAll` por carga de la máquina; no se repitió.
- `pnpm exec vitest run guard` → 76 files, 1064 passed, 20 skipped
- `pnpm exec playwright test e2e/consulta-de-evidencia.spec.ts` → **4 passed (53.4s)**: R27 y R28 en chromium y webkit

## TZ — Mapa completo R → test (2026-10-16)

| R | Test |
|---|---|
| R1 | `tests/unit/asignaciones/get-execution-evidence.test.ts`, `execution-trace-actions.test.ts` |
| R2 | `tests/unit/asignaciones/get-order-evidence.test.ts`, `count-order-evidence.test.ts`, `order-evidence-actions.test.ts` |
| R3 | `get-execution-evidence.test.ts`, `get-order-evidence.test.ts`, `count-order-evidence.test.ts`, `tests/unit/asignaciones/actor.test.ts` |
| R4 | `tests/unit/inventario-ui/finished-product-batches-evidence.test.tsx` («R4 — …», tres casos) |
| R5 | `get-execution-evidence.test.ts`, `get-order-evidence.test.ts`, `read-order-evidence.test.ts` |
| R6 | `count-order-evidence.test.ts`, `tests/integration/asignaciones/step-evidence-repository.int.test.ts` |
| R7, R8 | `tests/unit/asignaciones/read-order-evidence.test.ts`, `order-evidence.test.ts`; R8 también `step-evidence-repository.int.test.ts` |
| R9 | `read-order-evidence.test.ts` |
| R10 | `read-order-evidence.test.ts`, `evidence-storage-supabase.test.ts`, `evidence-storage-memory.test.ts` |
| R11 | `read-order-evidence.test.ts`, `execution-trace-actions.test.ts`, `order-evidence-actions.test.ts` |
| R12, R13 | `tests/ui/dashboard/trace-evidence-placement.test.ts`, `execution-trace-evidence.test.tsx` |
| R14 | `tests/ui/dashboard/execution-trace-evidence.test.tsx`, `trace-evidence-placement.test.ts` |
| R15 | `execution-trace-evidence.test.tsx`, `execution-trace-detail.test.tsx` |
| R16 | `finished-product-batches-evidence.test.tsx` (cuatro casos) |
| R17 | `tests/unit/inventario-ui/batch-evidence-dialog.test.tsx` |
| R18 | `finished-product-batches-evidence.test.tsx`, `batch-evidence-dialog.test.tsx` |
| R19 | `finished-product-batches-evidence.test.tsx`, `batch-evidence-dialog.test.tsx` |
| R20 | `tests/unit/shared-ui/step-evidence.test.tsx`, `batch-evidence-dialog.test.tsx` |
| R21 | `step-evidence.test.tsx`: los casos de ejecución y empaque, más «R21 — sin `consult`…» |
| R22 | `step-evidence.test.tsx` (esqueleto hasta `onLoad`, casilla `loading`, los tres casos nuevos de imagen ya resuelta), `batch-evidence-dialog.test.tsx` |
| R23 | `tests/unit/shared-ui/evidence-step-list.test.tsx`, `batch-evidence-dialog.test.tsx`, `execution-trace-evidence.test.tsx` |
| R24 | `step-evidence.test.tsx` («Vista vencida» y `onReload`), `batch-evidence-dialog.test.tsx`, `execution-trace-evidence.test.tsx` |
| R25 | `step-evidence.test.tsx`, `evidence-step-list.test.tsx`, `execution-trace-evidence.test.tsx` |
| R26 | `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`, `tests/unit/dashboard-route-contract.test.ts` |
| R27 | `e2e/consulta-de-evidencia.spec.ts` «R27 - el Administrador ve las fotos…» (chromium y webkit, verde) |
| R28 | `e2e/consulta-de-evidencia.spec.ts` «R28 - el Operador abre la misma ficha…» (chromium y webkit, verde) |
| R29 | `get-order-evidence.test.ts`, `get-execution-evidence.test.ts`, `count-order-evidence.test.ts`, `step-evidence-repository.int.test.ts` |
| R30 | `vitest run guard` (dependencias aprobadas, autorización por permiso, dobles E2E), `asignaciones-facade.test.ts`, `finished-product-route-contract.test.ts`; el diff no toca `db/` ni `package.json` (comprobado con `git diff` contra `origin/dev`) |

P1 y P2: cerradas el 2026-10-14 (`requirements.md > Decisiones cerradas`).
- P1: el paso de envasado se rotula solo «Paso N».
- P2: si el conteo falla, Lotes se pinta sin la columna «Evidencia».

`./init.sh` no se corrió en local: se cae por memoria; el gate corre en CI con el PR. Tampoco se corrió aquí la suite de integración (`*.int.test.ts`); la corre CI.

Pendiente: la comprobación visual humana contra los tableros `RecorridoEvidencia*.dc.html` y `ProductoTerminadoEvidencia*.dc.html`, en escritorio, tablet y teléfono.

Veredicto: TI y TZ hechas; R1–R30 mapeados. Queda la revisión del reviewer.
