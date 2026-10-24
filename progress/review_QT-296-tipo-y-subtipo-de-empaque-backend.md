# Review QT-296 — tipo-y-subtipo-de-empaque-backend (vuelta 1)

> Reviewer, 2026-10-24. Diff `origin/dev...HEAD` (punta `aa16438c`, merge-base `6aede160`).
> MCP del grafo no usado: revisión con Grep/Read y `git diff`.

## Fuera de hallazgo (aceptado por el humano o el leader)
- TP / R37 pendiente hasta que QC-131 esté `done`. La única task sin marcar es TP.
- `./init.sh` rojo en el validador de features por causas del board.
- `vitest related` sobre el diff completo sin terminar en local. La suite completa queda para `gate-completo`.
- El mensaje de `type_invalid` sigue diciendo «Envase», y «Valores disponibles» no lista subtipos. Las dos cosas pasan a QT-297.

## Verificación ejecutada por el reviewer
- `pnpm run typecheck`: exit 0.
- `eslint` sobre los `.ts/.tsx` añadidos o modificados del diff: 0 errores, 5 avisos (`_args` sin uso, preexistentes en su patrón).
- Unit, un solo proceso con `--maxWorkers=2`: `packaging-subtype`, `product-input`, `create-product`, `plan-inventory-import`, `catalog-line-input`, `imported-classification`, `proveedores/scope`, `classify-catalog-import`, `catalog-extraction`, `schema/qt296-packaging-subtype-migration` y `guard-tipos-de-producto`. Resultado: **11 archivos, 283/283 en verde**.
- Integración, con `.env` y una base efímera propia, en dos tandas secuenciales:
  - tanda 1: `qt296-packaging-subtype-migration` (aplica UP/DOWN/UP reales), `qt296-packaging-subtype-constraints`, `qt296-catalog-line-type`, `qt296-company-scope` y `catalog-import-upsert`. Resultado: **28/28**;
  - tanda 2: `qt296-distribution-rejects-caps`, `qt296-only-containers`, `qt296-packaging-subtype-product`, `catalog-line` e `inventory-import-confirm`. Resultado: **33 pasados y 1 omitido**. El omitido es el `skipIf(QC209_MEDIR_2000)` preexistente.
- `git merge-tree origin/dev HEAD`: **conflicto** en `tests/guards/guard-identificador-de-request.test.ts` (ver m1).

## Checklist

### CHECKPOINTS.md
- [x] requirements.md con EARS numerados (R1–R42).
- [x] design.md con alternativas descartadas (§10).
- [x] tasks.md: todas `[x]` salvo TP, aceptada.
- [x] `## Lo que ya existe` presente, con términos, resultado y tabla de reutilización. El diff no re-crea nada de la lista: `material` y `measurements` no se tocan (lo prueba un test sobre el texto de la migración) y `ProductType` no se duplica.
- [x] Equipo: rama `feature/QT-296-…` en su worktree. El tema del assignee lo acepta el humano (board).
- [x] Trazabilidad: cada R1..R42 tiene al menos un test con su id en el título, salvo R37, que es TP y está aceptado. Muestreé R2, R3, R10, R11, R13, R16, R19, R22, R28, R38, R39 y R40: los tests afirman de verdad (consultas reales, CHECK reales, filas escritas). R36 tiene detectores que muerden en positivo y en negativo.
- [x] `impl_<key>.md` contiene el mapa R → test (T10 y uno por task).
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo`: pendiente de CI. Además, la rama no mergea limpia contra `origin/dev` (m1).
- [x] Flujo crítico / E2E: la decisión cerrada «E2E: no en esta ficha» y R38 lo cubren. Las dos E2E del catálogo se corrieron en verde (T8).
- [x] Sin dependencias nuevas: `package.json` y el lock no están en el diff, y lo prueba un test de R36c.
- [x] Sin secretos ni configuración hardcodeada. No hay webhooks.
- [ ] Verificación final: `./init.sh` (aceptado), y el veredicto de esta review es RECHAZADO.

### docs/checkpoints-proyecto.md
- [x] Typecheck y lint.
- [x] UI: solo cambia un texto en `import-texts.ts`, una excepción aprobada por el humano (divergencia 13). No hay componentes, `/design` ni catálogo, y la regla multiplataforma no aplica.
- [x] No hay tablas nuevas, así que RLS y la columna de empresa no aplican. `products` y `supplier_catalog_lines` conservan RLS y FORCE, y la migración los restaura tras el relleno.
- [x] Las consultas tocadas conservan el ámbito de empresa: `productFilterWhere` dentro del `AND` de empresa, `findAlivePackaging` con `productCompanyScope`, `findAlivePackagingByName`, la identidad del Excel y las lecturas por identidad del catálogo. El rechazo cruzado lo prueba `qt296-company-scope.int` (R40, 4 casos).
- [x] Permisos: no hay permisos nuevos y los casos de uso siguen validando en `domain/` (R40).
- [x] Acceso a datos solo por adaptadores driven (Prisma), sin cliente de Supabase.
- [x] La migración tiene `down.sql`. El rollback lo prueban en real `qt296-packaging-subtype-migration.int` (UP → DOWN → UP) y el test de texto.
- [x] Módulos hexagonales: `proveedores` no importa `inventario`. Lo comprobé con grep y con `proveedores/scope.test.ts` en verde. `documentos` importa los dos barrels, y nada de ruta profunda entre módulos. `domain/` sigue puro (zod). La lógica vive en `domain/`; las actions solo leen el `FormData`.
- [x] `/// @module` sin cambios: los modelos son los existentes y solo ganan columnas.

### Reglas de `docs/perfil-agentes.md > reviewer`
- [x] 5. Calidad y seguridad: capas separadas, sin hardcode de contexto.
- [x] 6. Multiplataforma: no aplica (solo un texto).
- [x] 7. Dependencias: ninguna.
- [x] 8. Aislamiento por empresa: sin modelo nuevo; consultas filtradas y con test de acceso cruzado.
- [x] 9. Comentarios: ninguna línea `+` de `lib/`, `app/` ni `db/` cita `QC-`/`QT-`, `R<n>`, `design.md`, «decisión cerrada», TODO o FIXME. Lo comprobé con grep sobre el diff.
- [x] 10–11. Duplicados y diseño: no hay componentes nuevos.

## Migración (revisión específica)
- **Orden correcto:** `NO FORCE` → tipos → columna → relleno `UPDATE … WHERE type='PACKAGING'` (vivos y de baja, sin tocar `updated_at`) → los dos CHECK de `products` → columnas y CHECK de `supplier_catalog_lines` → `ENABLE` + `FORCE`.
- **CHECK de R2:** `("type"='PACKAGING') = ("packaging_subtype" IS NOT NULL)`. Es correcto porque `type` es NOT NULL.
- **CHECK de R3:** correcto. No exige presentación al envase en la base, a propósito: hay envases antiguos sin ella.
- **CHECK de R24:** `IS NOT DISTINCT FROM` corrige un fallo real del diseño, que con `=` dejaba pasar un subtipo sin tipo (divergencia 1). Correcto.
- **R25:** no hay `DELETE` ni se re-crean `material` ni las medidas.
- **`down.sql`:** orden inverso (CHECK, columnas, tipos) dentro del mismo paréntesis de RLS. Sin huecos.
- **Timestamp `20261023150000`:** posterior a los dos de `origin/dev` del 2026-10-23, que no tocan estas tablas. Registrada en `MIGRACIONES_ESPERADAS`.

## Divergencias registradas (las 14 de T10)

| # | Veredicto |
|---|---|
| 1 | Aceptable y mejor que el diseño. `spec_author` enmienda §2.2. |
| 2 | Aceptable. |
| 3 | Aceptable: un commit conjunto T1+T2 por necesidad técnica. |
| 4 | Aceptable, con reserva menor (m2). |
| 5 | Aceptable: es consecuencia directa del diseño. |
| 6 | Aceptable: el filtro `CONTAINER` en `PackagingCatalog` es defensa en profundidad, y el CHECK de R3 hace indistinguibles los dos caminos con datos válidos. |
| 7 | Aceptable: el contrato es equivalente y está tipado. |
| 8 | Aceptable: `proveedores` no tiene lectura de línea por id; `create` y `replaceAlive` no devuelven vista. |
| 9 | Aceptable: con zod 4, `.shape` sobrevive a `superRefine`. Lo comprobaron typecheck y tests. |
| 10 | Aceptable: el `?? null` se aplica en los tres puntos de uso. |
| 11 | Aceptable. |
| 12 | Aceptable: la fila queda en error igualmente y no se escribe. |
| 13 | Aceptable: aprobada por el humano. |
| 14 | Aceptable: aprobada por el leader. |

**Falta en la lista:** la divergencia 3 de T2 («un envase legado sin presentación ya cuenta como homónimo… antes creaba otro producto»). Es un cambio de comportamiento visible y no llegó al resumen de T10. Ver B1.

## Hallazgos

### B1 — BLOQUEANTE: los envases antiguos sin presentación pasan a ser homónimos y rompen el alta y el Excel de envases que hoy funcionan (R9, R20, «como hoy»)

**Dónde:**
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts` (`findAlivePackagingByName`): ya no filtra `presentationId: { not: null }`.
- `lib/modules/inventario/domain/plan-inventory-import.ts` (`resolveIdentity`, rama `PACKAGING`): ya no exige `product.presentationId !== null`.

**Qué pasa.** QC-195 (design, alternativa A) dejó los envases anteriores como legado: `PACKAGING` sin presentación fija, que no cuentan como homónimos. Para usarlos en un reparto, el flujo documentado es «se da de alta de nuevo como envase». La migración de esta ficha los convierte en `CONTAINER` con `presentation_id NULL`, y las dos búsquedas de homónimo ahora los incluyen. Hay dos consecuencias:
1. **Alta nueva sobre un legado.** «Botella» legado sin presentación, y alguien da de alta «Botella» con presentación P. Hoy se crea el envase. Con esta rama da `action_not_allowed` en el alta manual y `presentation_mismatch` en el Excel. El camino de QC-195 para recuperar un envase legado queda cerrado.
2. **Legado y re-alta ya coexistiendo.** Es justo el caso que el código actual produce. La búsqueda devuelve el **más antiguo** (`orderBy createdAt asc` en el adaptador, y «el primero que devuelve la lectura» en el planificador), que es el legado con presentación `null`. Desde ese momento, **cada lote nuevo** del envase bueno, manual o por Excel, se rechaza, aunque existe un empaque vivo con el mismo nombre, el mismo subtipo y la misma presentación. R9 («con el mismo subtipo (y, si es envase, la misma presentación) … DEBE sumarle un lote al existente, como hoy») y R20 («Con el mismo subtipo, la fila DEBE sumar un lote, como hoy») se incumplen. Es una regresión sobre datos reales: `schema.prisma` documenta que esos legados existen.

**Origen.** `design.md > 4.1` y `> 4.5` mandan quitar la condición («con o sin presentación»), pero ninguna decisión cerrada del humano lo respalda, y contradice el «como hoy» de R9 y R20 y la decisión A de QC-195. Ningún test cubre los dos escenarios de arriba.

**Qué falta para cerrar:**
- **Decisión.** El leader la lleva al humano o a `spec_author` como enmienda de §4.1 y §4.5. La propuesta mínima: un `CONTAINER` con `presentation_id NULL` (legado) no cuenta como homónimo, como hoy, y tapa, medidor y otro sí cuentan aunque no tengan presentación.
- **Código.** El implementer aplica la regla en `findAlivePackagingByName` y en `resolveIdentity`, las dos con la misma regla.
- **Tests.** Uno por cada escenario, en el alta (`create-product.test.ts` y el `.int`) y en el Excel (`plan-inventory-import.test.ts`): legado solo + alta con presentación = se crea; legado y re-alta coexistiendo + alta o fila con la misma presentación = suma lote.

### m1 — menor: la rama no mergea limpia contra `origin/dev`
`tests/guards/guard-identificador-de-request.test.ts` choca en `MIGRACIONES_ESPERADAS`: `dev` ganó `20261023120000_whatsapp_send_permission` y `20261023130000_whatsapp_outbound_messages` en el mismo punto de la lista. Hay que rebasar o mergear `dev` y dejar las tres entradas en orden cronológico antes del PR. Si no, `gate-completo` no puede correr sobre el merge.

### m2 — menor: `ProductView.packagingSubtype` es opcional (divergencia 4)
`design.md > 7` lo publica como contrato para QT-297 (`ProductView.packagingSubtype`). Al ser `?:`, el tipo admite `undefined` además de `null`, y QT-297 tendrá que tratar los dos. Los adaptadores siempre lo rellenan (`toProductView`, `finished-stock-prisma`), así que el riesgo es solo de tipos. Basta con anotarlo en la enmienda del diseño como deuda: cerrarlo cuando se toquen los fixtures de UI en QT-297.

### m3 — menor: enmiendas de `design.md` pendientes
Las divergencias 1, 2, 7, 9, 10 y 12, más la que salga de B1, piden que `spec_author` enmiende §2.2, §2.3, §4.1, §4.5, §5.2, §6.3 y §6.4. Hoy solo están en la bitácora. Que no se pierdan al cerrar la ficha.

## Veredicto

**RECHAZADO** (changes required): 1 bloqueante (B1) y 3 menores (m1–m3).

El resto de la ficha está bien. La migración es correcta y reversible, los límites de módulo y el aislamiento por empresa se cumplen, la trazabilidad R1–R42 está completa (R37 pendiente de TP, aceptado) y los tests revisados pasan. La vuelta 2 puede acotarse al diff que resuelva B1, más el rebase de m1.
