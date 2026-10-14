
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
