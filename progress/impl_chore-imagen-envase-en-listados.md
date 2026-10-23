# impl — chore-imagen-envase-en-listados

Cambio menor sin SDD completo. Fuente: `specs/chore-imagen-envase-en-listados/design.md` (P1–P7 aprobados 2026-10-15).
No hay `requirements.md`: el mapa de trazabilidad va por punto del design en lugar de por `R<n>`.

## Commits
- `ae1c86cd` feat(envases): imagen del envase en las referencias de empaque y acondicionamiento (backend)
- `d14f186b` feat(asignacion): miniatura del envase en reparto, diálogo Terminar y acondicionamiento (frontend)

## Archivos
Backend:
- `lib/modules/inventario/domain/packaging-catalog.ts`: `PackagingRef.imageUrl?`.
- `lib/modules/inventario/adapters/driven/persistence/packaging-catalog-prisma.ts`: `imagePath` en el select, `createFindPackagingRefs(images)`, `findPackagingRefs` con `imageUrl: null`.
- `lib/composition/index.ts`: `findRefs = createFindPackagingRefs(productImageStorage)`.
- `lib/modules/pedidos/domain/{order-catalog,get-order,list-order-summaries}.ts`: `packagingImageUrl?`; `findPackagingInfo` (`findPackagingNames` queda como wrapper, P6).
- `lib/modules/asignaciones/domain/{order-distribution-view,packing-order-view}.ts`.

Frontend:
- `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx` (Reparto).
- `app/(private)/asignacion/empaque/[id]/components/packing-finish-dialog.tsx` (80 px; `PackageIcon` fuera).
- `app/(private)/asignacion/components/order-distribution-full.tsx` (prop opcional `withImages`) e `index.ts`.
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen.tsx`.

## Mapa punto del design -> test
| Punto | Test |
|---|---|
| `imageUrl` compuesta, con y sin `imagePath` | `tests/unit/inventario/packaging-catalog-image.test.ts`, `tests/integration/inventario/qc195-packaging-catalog.int.test.ts` |
| Línea del resumen con `packagingImageUrl`, una llamada por página | `tests/unit/pedidos/order-catalog.test.ts` |
| `toDistributionLines` copia la URL | `tests/unit/asignaciones/order-distribution-view.test.ts` |
| `PackingFinishLineView.packaging.imageUrl` (ref → línea → null) | `tests/unit/asignaciones/get-packing-order.test.ts` |
| Vista 1 Reparto: imagen y marcador | `tests/unit/asignaciones-ui/packing-order-screen.test.tsx` |
| Vista 2 Terminar: imagen, marcador en línea antigua, zoom anidado (P3) | `tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx` |
| Vista 3 Acondicionamiento: imágenes y marcador | `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx` |
| P1: la columna «Envases» no cambia | `tests/unit/asignaciones-ui/conditioning-orders-columns.test.tsx` |
| Paridad visual | `tests/unit/paridad/__snapshots__/{asignacion-acondicionamiento,confirmaciones}-paridad.test.tsx.snap` |

## P3
El zoom sigue activo en «Terminar». El test abre la ampliación dentro del diálogo; Escape cierra solo la ampliación, `onOpenChange` no se llama y el diálogo sigue abierto. Probado en jsdom, todavía no en un navegador real.

## Snapshot `confirmaciones-paridad`
El cambio es intencional. Ese snapshot pinta el diálogo «¿Terminar el empaque?», y el diff solo cambia la rejilla de 40 px a 80 px y pone en lugar de `PackageIcon` el botón de `EntityImage` con el marcador (el fixture no trae imagen).

## Salida real
- `pnpm exec vitest run tests/unit/asignaciones-ui tests/unit/paridad`: Test Files 67 passed (67), Tests 1070 passed (1070).
- `pnpm run typecheck`: sin errores. `pnpm run lint`: 0 errors, 7 warnings, todas en archivos que este cambio no toca.
- Guardias (las corrió frontend_dev): 76 archivos, 1069 passed, 20 skipped.
- Backend (según backend_dev): asignaciones, pedidos, paridad y composition: 5759 passed, 0 failed.
- `./init.sh` (rápido), 1.ª corrida: entorno, typecheck y lint ✓. ✗ `test:rapido`: «test-db: falta DATABASE_URL», porque el worktree no tenía `.env`. Se copió el `.env` del repo principal (base local, ignorado por git), igual que en otros worktrees.
- `./init.sh`, 2.ª corrida: Claude Code la cortó por falta de memoria del sistema, sin veredicto. **Pendiente.**
- E2E (`e2e/envases-reales-empaque.spec.ts`, `e2e/acondicionamiento.spec.ts`): no se corrieron.
