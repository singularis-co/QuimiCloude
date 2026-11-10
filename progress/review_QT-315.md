# review_QT-315 — planta-con-varias-recetas

## Vuelta 1 (F2.2, 2026-11-10)

- **Alcance:** diff `46951dec9..HEAD` (HEAD `da21fe51b`). `46951dec9` es el merge de QT-314 en la rama, así que el diff no arrastra QT-313 ni QT-314.
- **Grafo:** no se usó, porque este worktree no tiene proyecto indexado. Todo se revisó con Grep/Read/git.

### Verificación ejecutada por el reviewer

| Qué | Resultado |
|---|---|
| `pnpm run typecheck` | 0 errores |
| `pnpm run lint` | 0 errores y 11 avisos, todos en líneas que no son del diff. Los 2 de `list-execution-traces.test.ts:177/181` son de `2eef74e06`, de 2026-10-16 |
| Unit/UI, lote 1, 15 archivos (`recipe-of-order`, `recipe-routes`, `cancel-assigned-order`, `get-execution-trace`, `list-execution-traces`, `recipe-screens`, `recipe-header`, `recipe-rows`, `planta-varias-recetas`, `assignment-row-actions`, `recetas/scope`, `recetas/module-contract`, `assigned-orders-manufactured-notice`, `order-cancel-dialog`, `paridad/recorridos-paridad`) | 15/15 archivos, 320 tests en verde |
| Unit/UI, lote 2, 15 archivos (los de `getOrderEvidence` para R34, `get-execution-evidence`, `order-execution-actions`, `start-assigned-order`, `get-assigned-order-execution`, `get-packing-order`, `evidence-target`, `execution-trace-detail`, `execution-trace-table`, `recorrido-rediseno`, `pedidos/order-catalog`, `pedidos/cancel-order-line`, `recetas-ui/recipe-route-contract`) | 15/15 archivos, 455 tests en verde |
| Guardias afectadas, 13 archivos (`ambito-empresa-pedidos/inventario/recetas`, `arquitectura-modulos`, `asignacion-componentizada`, `catalogo-de-componentes/errores/anadidos`, `dependencias-aprobadas`, `empresa-en-esquema`, `identificador-de-request`, `pedidos-rediseno`, `primitivas-ui-usan-el-cn-del-repo`) | 13/13 archivos, 400 tests en verde |
| `.int` afectados, 7 archivos (`order-line-outlines`, `cancel-line-from-execution`, `order-lines-execution`, `step-evidence-repository`, `conditioning-team-repository`, `execution-log-read`, `finished-batch-labels`), con base real | 7/7 archivos, 84 tests en verde |
| E2E | No corrido, por la restricción del leader. La salida local de T12/T13 (chromium y webkit) está en la bitácora |

### Checklist

**`CHECKPOINTS.md`**
- [x] `requirements.md` en EARS, R1–R34.
- [x] `design.md` con alternativas descartadas (§ 8, de A a D).
- [x] `tasks.md`: 128 `[x]` y ninguna casilla abierta.
- [x] `design.md` abre con `## Lo que ya existe` y la lista no está vacía. El diff no re-crea nada de esa lista:
  - `OrderProgress` se mueve con `R095` a `components/shared`; no se duplica;
  - `cancelLockedLine` se reutiliza dentro de `cancelLineInsideTransaction`, y `cancelOrderLine` pasa a usarla;
  - `orderProgress` se reutiliza en el adaptador;
  - `only-order-line.ts` se borra.
- [x] Assignee (Camilo) y rama de feature.
- [x] Cada R tiene al menos un test. Detalle en la tabla de abajo; R5 y R9 llevan notas.
- [x] Mapa R → test en `progress/impl_QT-315.md` (§ T14 — cierre).
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` en CI: pendiente. No hay PR, y no se abrirá hasta que #319 entre en `dev`.
- [x] Flujo crítico (movimiento de inventario) con E2E de Playwright: `e2e/planta-con-varias-recetas.spec.ts`, con salida local en la bitácora.
- [x] Sin dependencias nuevas: `package.json` y `pnpm-lock.yaml` sin cambios.
- [x] Sin secretos, sin webhooks y sin configuración hardcodeada.
- [ ] `./init.sh` en verde: rojo en local por el «id duplicado» QC/QT de `validate-features.mjs`. Es una deuda ya registrada en `progress/deudas.md` (2026-11-06) y no es de esta feature. Typecheck, lint, tests y guardias se verificaron aparte (tabla de arriba).
- [x] Este archivo existe; el veredicto está abajo.
- [ ] `progress/features/QT-315.md > Cierre`: vacío. Se rellena en F2.4, no bloquea la review.

**`docs/checkpoints-proyecto.md`**
- [x] Typecheck y lint en verde; E2E de Playwright.
- [x] Multiplataforma, sin excepción declarada:
  - no hay `100vh`/`h-screen` nuevos;
  - no hay `:hover` como única vía de activación;
  - «Ir a esta receta» usa `touch: true`, y «Entrar» va con `touchTarget` (R30, cubierto en `recipe-header`/`recipe-rows`);
  - no hay inputs nuevos con fuente menor de 16 px: los `text-xs` nuevos son rótulos, no inputs.
- [x] Catálogo: `OrderProgress` (subido) y `RecipesFirstMore` (nuevo) tienen su fila. La celda `Diseño` cita `PedidosVariasRecetas.dc.html` y `PlantaVariasRecetas.dc.html`, que existen. `guard-catalogo-de-componentes` en verde.
- [x] Pase `/design` aprobado (2026-11-09), con los tres tableros `PlantaVariasRecetas*` en `docs/diseno/canvas/` y citado en `design.md`.
- [x] Sin tablas nuevas: RLS y `FORCE` no aplican. No cambia nada en `db/` (R32).
- [x] Permisos en el caso de uso: `requirePermission` va primero en todos los casos de uso tocados, y hay tests R15 por caso de uso.
- [x] Acceso a datos solo por adaptadores driven (Prisma). No hay cliente de Supabase.
- [x] Hexagonal:
  - `domain/` importa de otros módulos solo su contrato (`@/lib/modules/pedidos`, `recetas`);
  - `outcome-query.ts` vive en driving;
  - `guard-arquitectura-modulos` en verde.
- [x] La lógica de negocio está en `domain/`: `recipe-of-order.ts`, `order-line-target.ts`, `cancel-assigned-order.ts` y `traceRecipes`. Las acciones solo componen la redirección.
- [x] Páginas protegidas con `requirePagePermission` en la primera línea. Los componentes reciben datos por props. Las mutaciones van por Server Actions.

**`docs/perfil-agentes.md > reviewer`, puntos 5–11**
- [x] 5. Calidad y seguridad: sin tablas nuevas, sin webhooks, sin hardcode de empresa (sale del actor) y con las capas separadas.
- [x] 6. Multiplataforma: ver arriba.
- [x] 7. Dependencias: ninguna.
- [x] 8. Aislamiento por empresa. Sin modelos nuevos.
  - `findAliveOrderLineSummary` filtra por `aliveLineScope(companyId)`.
  - `listOrderRecipeOutlinesByIdsIncludingDeleted` filtra por `orderCompanyScope({ companyId })`.
  - El rechazo cruzado está probado en `.int`: «otra empresa → null» en `order-line-outlines.int` y `cancel-line-from-execution.int`, además de los de equipo y fotos.
- [x] 9. Comentarios: en las líneas añadidas de `app/`, `lib/` y `components/` no aparece ningún `QC-n`, `QT-n`, `R<n>`, `design.md` ni «decisión cerrada». Comprobado con grep sobre el diff.
- [x] 10. Duplicados: `RecipeOfOrderLabel`, `RecipeHeader` y `ExecutionTraceRecipeSection` llevan su paso de la regla en la tabla de `design.md`. `OrderProgress` y `RecipesFirstMore` suben; no se duplican.
- [x] 11. Diseño: cada pieza nueva o cambiada cita los tableros aprobados.

### Trazabilidad R1–R34 (contrastada, no solo leída del mapa)

| R | Test que lo prueba (muestra) | Valoración |
|---|---|---|
| R1, R2 | `recipe-rows.test.tsx` (seis tablas, una fila por `lineId`) y `list-assigned-orders.test.ts` «R2: dos recetas … dos filas» | OK |
| R3 | `order-catalog.test.ts`, `order-line-outlines.int` (cancelada incluida, quitada fuera) y `recipe-rows`/`recipe-header` | OK |
| R4 | `recipe-rows.test.tsx` y `assigned-order-enter-trigger.test.tsx` (`?receta=<lineId>`) | OK |
| R5 | `assignment-row-actions.test.tsx` › `describe('R5 …')`: el menú de la fila de la 2.ª receta va a `executionTraceRoute(row.id)` | Débil, pero suficiente; ver hallazgo m1 |
| R6 | `recipe-screens.test.tsx` (las tres pantallas), los R11/R12 de las lecturas (`get-assigned-order-execution` «lee la nombrada y su contenido» con `OTRA_RECETA`) y los R13 de equipo, fotos y lotes | OK. El caso de UI «pasos de otra receta» es trivial; la garantía real está en los casos de uso |
| R7, R8 | `get-*-order` «R7, R8: trae su posicion…», `recipe-header.test.tsx` (`otherRecipeHref` por estado y permiso) y el E2E | OK |
| R9 | `order-execution-page`, `packing-order-page` y `conditioning-order-page` | OK, con la desviación de ejecución; ver m2 |
| R10 | `start-assigned-order`, `get-assigned-order-execution`, `finish-*`, `start-packing`, `get-packing-order`… con el pedido `PARCIAL` | OK |
| R11, R12 | un `describe('… la receta nombrada …')` por caso de uso y `order-lines-execution.int` (dos líneas `PENDIENTE`) | OK |
| R13 | `execution-log-read.int`, `step-evidence-repository.int` (tope por receta), `conditioning-team-repository.int`, `finished-batch-labels.int`, `conditioning-steps` y `get-conditioning-order` | OK |
| R14 | casos de uso («sin lineId → invalid_input sin tocar puertos»; «ajena → order_not_found») y `order-lines-execution.int` | OK |
| R15 | casos R15 por caso de uso; el permiso va antes de leer | OK |
| R16, R17 | `cancel-assigned-order.test.ts`, `cancel-order-line.test.ts`, `cancel-line-from-execution.int` (libera solo su material, la otra no cambia) y `order-lines-execution.int` | OK |
| R18 | `order-cancel-dialog.test.tsx` «R18: …nombra la receta y el pedido y avisa de que las demas siguen», FormData con `lineId` | OK |
| R19, R20 | `assigned-orders-manufactured-notice.test.tsx`, `recipe-routes.test.ts` («ningún parámetro dice entregado») y `order-execution-actions.test.ts` | OK |
| R21, R22 | `list-execution-traces.test.ts` (orden de alta, «+N más» con la cancelada y avance sin ella), `planta-varias-recetas.test.tsx` y el E2E | OK |
| R23 | `list-execution-traces.test.ts`: la fila con una receta abierta en `PARCIAL` da `kind: 'open'` y la suma; «con las dos cerradas la suma es cerrada» | OK. Los nombres «R23: todas las llamadas llevan la empresa» son de otra ficha y no cuentan |
| R24 | `order-catalog.test.ts`, `order-line-outlines.int`, `list-execution-traces` y `get-execution-trace` (outline de la baja) | OK |
| R25, R26 | `get-execution-trace.test.ts`, `planta-varias-recetas.test.tsx` (resumen y secciones; la receta sin anotaciones no tiene sección pero cuenta) y `get-execution-evidence` (fotos por línea) | OK |
| R27 | `list-execution-traces` (receta `EN_CURSO` con el pedido `PARCIAL` → abierta) y `get-execution-trace` | OK |
| R28 | `get-execution-trace.test.ts:848` y `planta-varias-recetas.test.tsx:399` | OK |
| R29 | casos «R29: con una sola receta, 1 de 1 y sin otras recetas», `recipe-header`, `recipe-rows`, avisos y los snapshots de paridad | OK; ver m3 |
| R30 | `recipe-header.test.tsx` y `recipe-rows.test.tsx` (tarjeta y 44 px) | OK |
| R31 | `recipe-screens.test.tsx` (ninguna pantalla ofrece entregar) y grep de `app/(private)/asignacion` | OK |
| R32 | reviewer: `git diff --stat` sobre `db/`, `package.json` y `pnpm-lock.yaml` vacío; catálogo de permisos sin cambios | OK |
| R33 | `e2e/planta-con-varias-recetas.spec.ts`: estados de las dos líneas tras cada paso; Dashboard con «+1 más», «1 de 2» y «2 de 2»; Recorrido con 2 secciones en orden. Los E2E de planta están adaptados | OK |
| R34 | `get-order-evidence`, `read-order-evidence` y `order-evidence-actions` sin tocar y en verde (lote 2). `readOrderEvidence` conserva firma y resultado; `readOrderEvidenceByLine` es aditiva | OK |

### Puntos pedidos por el leader

1. **Ampliación de guardias de listas cerradas.** Revisado el diff de las tres.
   - `module-contract.test.ts` › `PANTALLAS_AUTORIZADAS`: solo entran 3 literales. Se les sigue aplicando `consumesOnlyPublicContract`.
   - `scope.test.ts` › `PANTALLA_DE_EJECUCION`: entran los mismos 3 literales.
   - `scope.test.ts`, lista E2E: entran `planta-con-varias-recetas.spec.ts` y `helpers/recipe-route.ts`. Sigue siendo `toEqual` exacto.
   - `guard-identificador-de-request` › `E2E_ESPERADOS`: entra 1 entrada.

   Ningún criterio se afloja. La excepción es `COMPONENTES_PERMITIDOS`, que es una lista **nueva** (ver m4).
2. **`guard-ambito-empresa-pedidos`.** `findAliveLineSummary` entra en `METODOS_DELEGADOS_EN_DOMINIO` con la regex exacta de su cableado (`createFindAliveLineSummary({ summaries: orderSummaryReader, packaging: packagingCatalog })`), el mismo patrón que sus hermanos. El adaptador que toca la base filtra por `companyId`, y el barrido de la guardia lo sigue exigiendo. Correcto.
3. **Snapshots de `recorridos-paridad`.** Comparé el diff neto por texto de línea:
   - **lo que cambia:** el resumen gana «Avance» con `OrderProgress` («1 de 1 terminadas» o «0 de 1») y «Duración» total; «Vueltas atrás» deja de ser una tarjeta del resumen y pasa a la línea de la sección; aparece una `section` por receta con `h2` (nombre de la receta), estado, cantidad, reparto y duración; «Anotaciones» baja de `h2` a `h3`, y el `aria-labelledby` lleva el `lineId`;
   - **lo que no cambia:** las entradas de la línea de tiempo (acción, paso, persona, instante, «Hasta la siguiente») son las mismas.

   R25 pide el resumen y las secciones para todo pedido, y R29 exceptúa «la sección única del Recorrido». Es coherente; ver m3 sobre el «Avance» con una sola receta.
4. **T10 y T11.** Son coherentes con design § 4.4 y § 4.5:
   - duración y vueltas atrás por sección;
   - el total de la fila es `combineDurations` de las recetas: abierta si alguna lo está, y sin contar la espera entre recetas;
   - la columna «Avance» sale de `OrderProgress`;
   - las presentaciones van agrupadas por receta en orden de alta, sin sumar;
   - las fotos se agrupan por línea con `readOrderEvidenceByLine`.
5. **Ejecución con receta ajena.** Responde `OrderExecutionError`, igual que hoy con un pedido inexistente en esa página (en la base, `page.tsx:35` ya lo hacía), y no filtra datos. Sin `?receta`, o con un valor inválido o repetido, responde `notFound()`. Lo acepto como «responder como hoy», pero el paréntesis de R9 («página no encontrada») no encaja con esa pantalla (m2).
6. **R5.** Confirmado: `assignment-row-actions.tsx` solo ofrece «Entrar» y «Ver recorrido». Asignar, desasignar y quitar grupo viven en `/pedidos` (`order-responsibles.tsx`) y no se tocan. El test cubre lo único que hay en la fila (m1).
7. **`dashboard-rediseno`.** Solo se acota el selector a `dashboard-content`, sin cambiar lo que se comprueba. La duplicación no está registrada como deuda (m5).
8. **Mapa R1–R34.** Lo contrasté abriendo los casos (tabla de arriba). Hay casos con nombres «R23/R5/R14…» heredados de otras fichas que el mapa automático confunde: «R23: todas las llamadas llevan la empresa» es de otra ficha. Aun así, cada R de QT-315 tiene al menos un caso que la prueba de verdad.

### Hallazgos

**Bloqueantes:** ninguno.

**Menores:**
- **m1 (menor), R5 casi vacía en `/asignacion`.** Las filas no tienen acciones de responsables, así que R5 solo se puede probar en «Ver recorrido» (con `row.id`). Las reglas R35 y R55 de QT-313 no cambian y siguen cubiertas por sus tests (`unassign-responsible`, `remove-work-group-from-order`, `order-state`). Para el leader: valorar, con `/afinar-feature` o una nota en el spec, que R5 nombre las acciones que de verdad tiene la fila.
- **m2 (menor), redacción de R9.** «Como hoy ante un pedido inexistente (página no encontrada)»: en ejecución, «hoy» es `OrderExecutionError`, no 404. La implementación sigue «como hoy» y no muestra datos. Conviene que el humano confirme la lectura o que se corrija el paréntesis del spec.
- **m3 (menor), resumen del Recorrido con una sola receta.** El detalle de un pedido de una receta gana «Avance 1 de 1 terminadas», y «Vueltas atrás» pasa del resumen a la sección. Lo exige R25 y lo cubre la excepción de R29 si se lee «sección única» como «resumen + sección». Lo aceptó el leader. Se anota para que conste como cambio visible en los pedidos de una receta.
- **m4 (menor), `COMPONENTES_PERMITIDOS` en `scope.test.ts` no existía.** Es una lista cerrada nueva, con un literal exacto, sobre la comprobación de `components/`, que antes exigía `[]`. No afloja el criterio para nada más, pero no es «añadir una entrada a una lista existente». Que conste en la decisión del humano: la bitácora lo atribuye a «Ampliar la lista».
- **m5 (menor), deuda no registrada.** La `data-table` duplicada en el DOM del Dashboard, preexistente según la bitácora y probablemente por el streaming de Suspense, no está en `progress/deudas.md`. El selector acotado de `e2e/dashboard-rediseno.spec.ts` la esquiva. Hay que registrarla en F2.4.
- **m6 (menor, sin verificar), Dashboard y Recorrido no tratan igual una línea sin outline.**
  - `traceRecipes` (Dashboard) mide también las anotaciones de una línea que el outline no trae: la mide con el estado del pedido y la pone al final.
  - `getExecutionTrace` (Recorrido) solo pinta las secciones del outline.
  - Si una línea quitada pudiera tener anotaciones, su duración contaría en la fila del Dashboard y no se vería en el Recorrido. No he comprobado si el dominio permite quitar una línea con anotaciones; si no lo permite, no hay efecto.

### Veredicto

**OK.** Ningún bloqueante. Los menores m1–m6 no impiden pasar a F2.3. m5 se resuelve registrando la deuda al cerrar, y m1/m2 son de redacción del spec, para el humano.
