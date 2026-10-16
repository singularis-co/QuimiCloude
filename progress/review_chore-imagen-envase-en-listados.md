# review — chore-imagen-envase-en-listados

Rango revisado: `c8c1b9ce..HEAD` (b0c9ada7) sobre `origin/dev`.
Cambio menor autorizado por el humano sin SDD completo: no hay `requirements.md` ni `tasks.md`; la
trazabilidad es por punto del `design.md` (incluida «Decisión del humano (2026-10-15)»).
MCP del grafo: no usado; la exploración se hizo con Grep/Read y git diff.

## Verificación ejecutada por el reviewer (salida real)

- `pnpm exec vitest run` sobre los 10 archivos de test tocados (unit + UI + 2 paridad):
  **Test Files 10 passed (10), Tests 327 passed (327)**.
- `pnpm exec vitest run tests/integration/inventario/qc195-packaging-catalog.int.test.ts`:
  **8 passed (8)** (base efímera de test-db).
- `pnpm run typecheck`: sin errores.
- `pnpm exec eslint` sobre los archivos de producción tocados y el test nuevo: sin salida (0 errores, 0 avisos).
- `pnpm exec vitest run guard`: **Test Files 76 passed, Tests 1069 passed | 20 skipped**.
- No corrido (por instrucción): `./init.sh`, suite completa, E2E.

## Checklist

### Trazabilidad (punto del design -> test)
- [x] `PackagingRef.imageUrl` compuesta con almacenamiento, `null` sin ruta y sin almacenamiento,
      `select` con `imagePath`, sin ids no consulta, `findCostingBatches` intacto ->
      `tests/unit/inventario/packaging-catalog-image.test.ts` y
      `tests/integration/inventario/qc195-packaging-catalog.int.test.ts` (2 casos nuevos contra BD real).
- [x] Resumen de `pedidos` con `packagingImageUrl` y **una** llamada a `findRefs` por página ->
      `tests/unit/pedidos/order-catalog.test.ts:709`.
- [x] `toDistributionLines` copia `packagingImageUrl` (incluido `null`) ->
      `tests/unit/asignaciones/order-distribution-view.test.ts:75`.
- [x] `PackingFinishLineView.packaging.imageUrl`: ref -> línea -> `null` ->
      `tests/unit/asignaciones/get-packing-order.test.ts:536` y `:552`.
- [x] Vista 1 (Reparto del empacador): imagen, `alt`, marcador, texto intacto, línea antigua ->
      `tests/unit/asignaciones-ui/packing-order-screen.test.tsx:126`, `:157`.
- [x] Vista 2 (diálogo Terminar): miniatura en vez de `PackageIcon`, rejilla 80 px, marcador en
      envase sin imagen y en línea antigua (zoom deshabilitado), P3 zoom anidado sin cerrar el
      diálogo -> `tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx:714-760`.
- [x] Vista 3 (acondicionamiento): bloque propio bajo la cantidad, imagen y marcador ->
      `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx:85`.
- [x] P1 (columna «Envases» sigue siendo texto) ->
      `tests/unit/asignaciones-ui/conditioning-orders-columns.test.tsx:92`.
- [x] P2 (marcador `inv_not_found.png`): cubierto en las tres vistas (`MISSING_IMAGE_SRC`, `data-missing`).
- [x] Ningún test vacío: todos afirman sobre valores concretos.

### Decisiones del humano
- [x] P1: `conditioning-orders-columns.tsx` no está en el diff; `OrderDistributionFull` sin `withImages`
      renderiza el mismo `<span>` (snapshot y test lo fijan).
- [x] P4: `imageUrl?` / `packagingImageUrl?` **opcionales** en `PackagingRef`
      (`packaging-catalog.ts:16`), `AssignedOrderPresentationLine` (`order-catalog.ts:268`),
      `OrderDistributionLineView` (`order-distribution-view.ts:21`) y
      `PackingFinishLineView.packaging` (`packing-order-view.ts:60`). No se retocaron los fixtures masivos.
- [x] P5: `components/shared/order-distribution-label.tsx` y `assignment-list-parts.tsx`
      (`presentationColumn`) fuera del diff.
- [x] P6: `order-view.ts` y `toOrderView` no se tocan; `findPackagingNames` sigue devolviendo
      `Map<id, name>` (ahora envuelve `findPackagingInfo`), así que `get-order` y `list-orders` no cambian.
- [x] P3: zoom activo en el diálogo; test de foco/Escape en jsdom.
- [x] P7: tableros `docs/diseno/canvas/*.dc.html` actualizados en `c8c1b9ce`.

### Arquitectura de módulos
- [x] Sin acceso Prisma cruzado: `imagePath` se lee en el adaptador de `inventario` (`Product` es suyo),
      con el mismo `productCompanyScope` que ya aplicaba `findAlivePackaging`.
- [x] La URL se compone dentro de `inventario` (`createFindPackagingRefs`), con el puerto
      `ProductImageStorage` del propio módulo; `pedidos`/`asignaciones` solo ven `imageUrl`.
- [x] Composición: `lib/composition/index.ts:1226` cablea `createFindPackagingRefs(productImageStorage)`;
      `productImageStorage` está declarado antes (línea 1079).
- [x] Sin imports nuevos entre módulos ni rutas profundas en producción; `domain/` no importa nada nuevo.
- [x] `app/(private)/asignacion/components/index.ts` exporta `ORDER_DISTRIBUTION_FULL_LINE_TESTID`;
      los tests importan por el barrel.

### Snapshots de paridad
- [x] `confirmaciones-paridad.test.tsx.snap`: el único cambio es la fila del diálogo Terminar
      (rejilla 40->80 px, `PackageIcon` -> botón de `EntityImage` con marcador). Intencional y coherente con Vista 2.
- [x] `asignacion-acondicionamiento-paridad.test.tsx.snap`: cantidad `block`, desaparece el «·»,
      distribución pasa a `div` con `ul/li` + miniatura. Intencional (Vista 3). El contenedor
      del subtítulo es un `div`, así que el `div`/`ul` anidado es HTML válido.

### CHECKPOINTS.md
- [n/a] `requirements.md`, `tasks.md`, mapa `R<n>`: excepción autorizada por el humano.
- [x] `design.md` con alternativas descartadas y su porqué.
- [x] `design.md` abre con `## Lo que ya existe`; el diff reutiliza `EntityImage`, `ProductImageStorage`,
      `PackagingCatalog.findRefs` y extiende `OrderDistributionFull` con prop opcional; no re-crea nada.
- [x] Typecheck y lint sin errores (ver arriba).
- [ ] `gate-completo` en CI: pendiente (lo corre el PR).
- [n/a] Flujo crítico con E2E: cambio de presentación, no toca autenticación, permisos,
      movimientos de inventario, importes ni webhooks.
- [n/a] Dependencias: `package.json` no cambia.
- [x] Sin secretos ni configuración hardcodeada: la URL sale de `publicUrl` (entorno vía Supabase).
- [ ] `./init.sh` (rápido) en verde en el worktree: **pendiente** (la 2.ª corrida la cortó la memoria).
      Las piezas que cubre (typecheck, lint, tests relacionados, guardias) las corrí por separado en verde.

### docs/checkpoints-proyecto.md
- [x] Multiplataforma: el disparador del zoom mide 80x80 px (> 44 px), sin `:hover` como única vía,
      sin `100vh`, sin inputs nuevos.
- [x] CATALOGO: `EntityImage` se usa tal cual (no cambia); `OrderDistributionFull` es pieza de ruta,
      no de `components/shared`, así que no requiere fila.
- [x] Cambio visual con pase `/design` aprobado (P7) y tableros copiados.
- [x] Sin tablas, migraciones ni RLS nuevas; la consulta tocada mantiene el filtro por empresa
      (rechazo cruzado ya cubierto en `qc195-packaging-catalog.int.test.ts`).
- [x] Acceso a datos solo por adaptador `driven` Prisma; nada con el cliente de Supabase.
- [x] Módulos hexagonales: sin violaciones (guardias en verde).

### Reglas del proyecto (perfil-agentes > reviewer)
- [x] 5. Calidad/seguridad: capas separadas, sin hardcode de contexto.
- [x] 6. Multiplataforma: ver arriba.
- [n/a] 7. Dependencias.
- [x] 8. Aislamiento por empresa: la lectura de `imagePath` va por el mismo `where` con empresa.
- [x] 9. Comentarios: ninguna línea añadida en producción cita `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada».
- [x] 10. Duplicados: no hay componente nuevo.
- [x] 11. Diseño: cambio visual con referencia de tableros en `design.md` (P7).

## Hallazgos

1. **menor** — `lib/modules/pedidos/domain/list-order-summaries.ts` (función `withPackagingNames`,
   ~línea 18): el nombre se quedó corto; ahora añade nombre **e** imagen. Renombrar
   (p. ej. `withPackagingInfo`) cuando se vuelva a tocar.
2. **menor** — P3 (zoom anidado dentro del `Dialog` de Terminar) solo está probado en jsdom
   (`packing-finish-dialog.test.tsx:742`). Conviene un vistazo manual en navegador real (escritorio
   y móvil) antes de cerrar; si falla, la decisión del humano ya prevé quitar el zoom solo ahí.
3. **menor** — El design proponía correr `e2e/envases-reales-empaque.spec.ts` y
   `e2e/acondicionamiento.spec.ts`; no se corrieron. Leí sus aserciones: la que compara el texto
   exacto con « / » (`e2e/acondicionamiento.spec.ts:429`) es sobre la fila de la tabla, que no
   cambia (P1); la del detalle (`e2e/envases-reales-empaque.spec.ts:589`) usa `toContainText` de
   una sola línea, que sigue cuadrando. Riesgo bajo, pero no están ejecutados: los corre el CI en
   el PR a producción.
4. **menor** — `./init.sh` (rápido) sigue pendiente en el worktree; el `gate-completo` del CI lo cubre.
   No es bloqueante para esta revisión porque sus piezas se corrieron por separado en verde.

## Veredicto

**OK** — sin bloqueantes. Conviene revisar el menor 2 (zoom anidado en navegador real) antes del merge a producción.
