# review_QT-316 — evidencias-del-lote-por-receta

## Vuelta 1 (F2.2, diff `4a480b944..1d984bcdf`)

Grafo: no usado. Este worktree no tiene índice en el MCP, igual que en el design. Todo lo revisé con Grep/Read/git.

### Verificación ejecutada por el reviewer

| Qué | Resultado |
|---|---|
| `tsc --noEmit` | 0 errores |
| `eslint` sobre los `.ts/.tsx` añadidos o modificados del diff | 0 errores, 0 avisos |
| Unit (12 archivos: `count-line-evidence`, `get-line-evidence`, `read-order-evidence`, `order-evidence-actions`, `get-execution-evidence`, `asignaciones-facade`, `session-once-per-request-actions`, `finished-product-route-contract`, `batch-evidence-dialog`, `finished-product-batches-evidence`, `finished-product-tables`, `list-finished-product-batches`), `--maxWorkers=1` | 359/359 |
| Integración (`step-evidence-repository.int`, `finished-product-detail.int`), con `DATABASE_URL` del checkout principal cargada solo en el shell | 39/39 |
| Guardias y censos (`guard-identificador-de-request`, `guard-dependencias-aprobadas`, `guard-dobles-e2e`, `guard-lote-sin-join`, `guard-permisos-sembrados`, `recetas/scope`, `recetas/module-contract`) | 71/71 |
| E2E | no lo corrí (el encargo lo prohíbe). Me baso en la bitácora: 3/3 en chromium y webkit |

### Checklist

- [x] `requirements.md` con R1–R21 en EARS; `design.md` con alternativas descartadas (§ 7).
- [x] `design.md` abre con `## Lo que ya existe`, que no está vacía. El diff no re-crea nada de esa lista: reutiliza `readOrderEvidenceByLine`, `readRecipeOutlines`, `StepEvidence`, `Dialog` y `EMPTY_MARK`.
- [x] Tasks T1–T9 marcadas `[x]`. La casilla de «Cierre / Gate» sigue abierta: ver menor m1.
- [x] `progress/impl_QT-316.md` trae el mapa R→test, por tanda y consolidado.
- [ ] **Cada R con un test que la prueba de verdad.** R14 y R15 no se cumplen en todos los casos que nombra el requisito (B1, B2).
- [x] Typecheck y lint en verde.
- [x] Sin dependencias: `package.json` intacto. Sin cambios en `db/schema.prisma`, `db/migrations/` ni permisos (R18).
- [x] Aislamiento por empresa. `countByLines` filtra por `companyId`. `getLineEvidence` pasa por `listSummariesByIdsIncludingDeleted(companyId…)` y por `readRecipeOutlines(companyId)`. Tests de acceso cruzado: unit R14/R15 e integración «fila de otra empresa no cuenta».
- [x] El permiso se valida en el caso de uso (`requirePermission` va antes del parseo), con tests que no llaman a ningún puerto (R13).
- [x] Comentarios: en las líneas de producción que añade el diff no hay ninguna cita a `QC-`/`QT-`/`R<n>`/`design.md`/«decisión cerrada». Lo comprobé con grep sobre `app/`, `lib/` y `components/`.
- [x] Multiplataforma. El título usa `break-words [overflow-wrap:anywhere]`. `BATCH_EVIDENCE_DIALOG_CLASS` no cambia (`h-dvh`). Sin `100vh` ni `:hover` y sin targets nuevos.
- [x] Sin componente nuevo. Hay cambio visual (título con receta y grupo «Acondicionamiento») y el diseño lo cita: `EvidenciaLoteVariasRecetas*.dc.html`.
- [x] Capas. `asignaciones` no importa `inventario`; la ruta no importa `recetas`; las actions no deciden nada.

### Puntos que pidió el leader

1. **R14, firma con línea ajena.** Hallazgo B1 (bloqueante).
2. **Conteo, misma línea con dos pedidos.** Confirmado. Hallazgo B2 (bloqueante).
3. **Retiradas (P1, P4).** Están bien.
   - Grep sobre `app/ components/ lib/ tests/ e2e/ scripts/`: ningún resto de `getOrderEvidence`, `countOrderEvidence`, `readOrderEvidence` (sin `ByLine`), `countByOrders`, `OrderEvidenceCount`, `ORDER_EVIDENCE_COUNTS` ni de los `create*`.
   - Los casos de `read-order-evidence.test.ts` siguen todos, uno a uno, sobre `readOrderEvidenceByLine`: R5, R7×2, R8×2, R9×2 (`it.each`), R10×3, R11×3, R29, y QC-299 R21×2 y R32. `leerLinea` además exige que la única receta devuelta sea `LINEA`.
   - Solo cambió la aserción de «sin fotos»: de tres fases vacías a `recipes: []`. Es la forma de salida de la lectura por línea, y sigue comprobando que no se firma.
   - Los cuatro `describe` de `get-order-evidence.test.ts` (autorización, rol, not_found, empresa) y los cuatro de `count-order-evidence.test.ts` (autorización, rol, entrada, qué sale) tienen su equivalente en `get-line-evidence.test.ts` y `count-line-evidence.test.ts`.
   - El `describe` de integración de `countByOrders` pasa a `countByLines`. «Otra empresa» se conserva como `QT-316 R15, QC-271 R29`, y «fabricación y envasado» queda cubierto por R1 y R20.
4. **Listas cerradas.** No se aflojó ninguna.
   - `asignaciones-facade`: el censo sigue con `toEqual` exacto y 35 nombres. Se cambian dos por dos, y los dos casos de rechazo sin `pedidos.consultar` pasan a `getLineEvidence` y `countLineEvidence`.
   - `finished-product-route-contract`: `LECTURAS_DE_EVIDENCIA` sigue cerrada, con dos nombres.
   - `session-once-per-request-actions`: entra una fila por cada action exportada (una más que antes, porque el conteo antes no tenía fila).
5. **Caso QC-271 R19 sustituido.** Es legítimo. Afirmaba «mismo pedido ⇒ mismo total», lo contrario de lo que pide QT-316 R1 (decisión cerrada). Lo sustituye `QT-316 R1 — dos lotes del mismo pedido, cada uno con las fotos de su receta`, con un comentario fechado.
6. **Fixture 9→8.** Es correcto. `ORDER_EVIDENCE` tiene 2+3+1 de fabricación y 2 de envasado, o sea 8. Ahora el total se calcula de los grupos y no puede volver a descuadrar. El único test que usaba el literal pasó a la constante sin cambiar lo que comprueba.
7. **R20.** Está bien. El conteo cuenta las tres fases, tanto en el adaptador (int «QT-316 R20») como en el diálogo, que pinta las tres. Los dos tests unitarios de R20 comprueban que la suma de las secciones es igual al `photoCount` de la celda, con acondicionamiento y sin él. El E2E también lo comprueba.
8. **R8 y R9.** Están bien. El dominio devuelve `recipeName: null` en tres casos: una sola receta en el outline, receta no resuelta y línea fuera del outline. La UI solo mira `null`. Con `null`, el título y la descripción son los de hoy, y las fotos, el conteo y el grupo son los mismos. El único cambio es el grupo de R20, que R8 permite.
9. **Mapa R1–R21.** Todas las R tienen un test que las prueba, salvo dos huecos:
   - R14: la parte «ni firmar» con una línea ajena dentro de un pedido de la empresa (B1);
   - R15: la parte «no cuenta ni sale» cuando la petición trae la misma línea con dos pedidos (B2).

### Hallazgos

**B1 — BLOQUEANTE · R14 no se cumple: se firman lecturas antes de responder `order_not_found`.**
- **Qué pasa.** `get-line-evidence.ts` llama primero a `readOrderEvidenceByLine(deps, companyId, orderId)`, que firma todas las fotos del pedido (`signAll` → `createSignedReadUrls`). Solo después mira si la línea está en el resultado o en el outline.
- **Cuándo pasa.** La línea es de otro pedido, no existe o se quitó sin fotos, y el pedido (de la empresa) tiene fotos de otra receta. En ese caso se firman URLs y después se lanza `OrderNotFoundError`.
- **Qué dice R14.** «DEBE responder `order_not_found` sin devolver ninguna foto **ni firmar ninguna lectura**». La lista de R14 incluye expresamente «una línea de otro pedido… una línea inexistente».
- **Por qué el design no lo cubre.** Design § 6 (fila R14) acota el «sin firmar» a la entrada mal formada y al pedido ajeno, y § 3.3/§ 7 aceptan firmar las fotos de las otras recetas. Pero § 7.1 habla del caso válido (ahorrar la firma de las demás recetas de una línea propia), no del error. Ninguna decisión cerrada rebaja R14, y un design no puede rebajar un requisito EARS. El test `R14: pedido ajeno, linea de otro pedido…` solo comprueba el error, no que no se firme.
- **Qué falta (una de dos).**
  - (a) Código, la opción recomendada: no firmar cuando la línea no tiene fotos, sin rehacer la lectura.
    - Antes de `readOrderEvidenceByLine`, `countByLines(companyId, [{ orderId, lineId }])` (o `listByLine`, que ya existe en el puerto).
    - Con 0 fotos, el outline decide entre evidencia vacía y `OrderNotFoundError`, sin leer ni firmar.
    - Con más de 0, `readOrderEvidenceByLine` como ahora. R16 sigue en pie: se reutiliza, no se rehace.
    - Test: con un pedido de dos recetas con fotos, pedir la línea de otro pedido, una línea inexistente y una quitada sin fotos. Las tres dan `order_not_found` y `createSignedReadUrls` no se llama.
  - (b) Que el humano enmiende R14 para aceptar la firma en ese caso, con fila nueva en «Decisiones cerradas». Esto no lo decide el implementer.

**B2 — BLOQUEANTE · R15: con la misma línea emparejada con dos pedidos, el conteo va al par equivocado.**
- **Adaptador.** `countByLines` en `step-evidence-prisma.ts` arma `orderOfLine = new Map(lineId → orderId)`. Con la misma `lineId` en dos pares gana el último pedido, y el resultado se indexa solo por `lineId`.
- **Caso de uso.** `count-line-evidence.ts` busca con `counts.get(line.lineId)`, sin mirar el pedido del par.
- **Qué sale mal** (L es una línea de A con n fotos):
  - entrada `[{B, L}, {A, L}]`: los dos pares salen con `photoCount = n`, también `(B, L)`. Viola «una línea de otro pedido NO DEBE contar ni salir en la respuesta»;
  - entrada `[{A, L}, {B, L}]`: el grupo `(A, L)` se descarta y el par legítimo pierde su conteo.
- **Por qué los tests no lo ven.** El doble de `evidence-doubles.ts` cuenta bien por par, pero también indexa por `lineId`, así que el caso de uso fallaría igual. No hay test con la línea repetida.
- **Alcance.** Es de la misma empresa y la pantalla no lo pide así, pero la server action acepta cualquier entrada.
- **Qué falta.**
  - Indexar el resultado por par: clave `orderId:lineId` en el puerto, en el adaptador, en los dobles y en el `get` del caso de uso. Otra opción: rechazar como `invalid_input` una petición que repita `lineId` con pedidos distintos.
  - Un test unitario y uno de integración con `[{otroPedido, L}, {A, L}]` y en el orden inverso. Solo `(A, L)` cuenta, y con su total.

**m1 — menor · la casilla «Cierre / Gate» de `tasks.md` sigue `[ ]`.** `./init.sh` cae por el «id duplicado» QC/QT, deuda ya registrada y ajena a la ficha. Hay que marcarla, o anotar el motivo, cuando se cierre.

**m2 — menor · R4 y la «sola lectura».** `countLineEvidence` hace hasta tres consultas por página: conteos, outlines y nombres. R4 se lee como «una sola lectura de conteos, sea cual sea el número de lotes», y el test lo comprueba así (una llamada a cada puerto). Lo anoto solo para que nadie lo lea como regresión.

### Veredicto

**RECHAZADO.** Hay dos bloqueantes: B1 (R14) y B2 (R15). Los dos vuelven al implementer (backend_dev). B1 también puede resolverse con una decisión del humano que enmiende R14. Lo demás, incluidas las retiradas P1/P4, las listas cerradas, R8/R9, R20 y el fixture, está bien.

## Vuelta 2 (acotada a f4e0fd45b..4180e676d)

Solo reviso B1, B2, m1 y lo que el diff `4180e676d` pueda haber roto.

### Verificación ejecutada

| Qué | Resultado |
|---|---|
| `tsc --noEmit` | 0 errores |
| `eslint` sobre los `.ts` del diff | 0 |
| Unit (`count-line-evidence`, `get-line-evidence`, `read-order-evidence`, `order-evidence-actions`, `get-execution-evidence`, `asignaciones-facade`, `finished-product-batches-evidence`, `record-step-move-evidence`, `register-evidence`), `--maxWorkers=1` | 194/194 |
| Integración `step-evidence-repository.int`, con `DATABASE_URL` cargada solo en el shell | 27/27 |

### B1 (R14, firma con línea ajena): resuelto

- **El arreglo.** `getLineEvidence` cuenta primero con `countByLines(companyId, [{ orderId, lineId }])`:
  - con 0 fotos no llama a `readOrderEvidenceByLine`, así que no lista ni firma; el outline decide entre evidencia vacía y `order_not_found`;
  - con más de 0 reutiliza `readOrderEvidenceByLine` como antes (R16 intacto).
- **R12 sigue igual.** Una línea quitada con fotos tiene conteo mayor que 0, se lee y sale.
- **Test nuevo.** El `it.each` cubre la línea de otro pedido, la inexistente y la quitada sin fotos. Las tres van contra un pedido de la empresa con fotos de otra receta. Comprueba que el error es `order_not_found`, que no se llama a `createSignedReadUrls`, `createSignedReadUrl` ni `listByOrder`, y que `countByLines` va con la empresa y la pareja.
- **Coste.** Una consulta más por apertura del diálogo. Es aceptable: no hay requisito de número de consultas en la lectura.

**Los dos tests de empresa ajustados: no se aflojaron.**

1. *«R14: el pedido de otra empresa no firma ninguna lectura».*
   - **Antes** comprobaba que la primera consulta, `listSummaries…`, iba con `OTRA_EMPRESA`.
   - **Ahora** esa consulta ya no ocurre: el conteo de la otra empresa da 0 y no se lee el pedido. Comprueba en su lugar que las dos consultas que sí ocurren, `countByLines` y `listRecipeOutlines…`, van con `OTRA_EMPRESA`.
   - Siguen las aserciones de que no se llama a `listByOrder` ni a `createSignedReadUrls`.
   - Comprueba lo mismo (la consulta va con la empresa del actor y no se firma) sobre el camino nuevo.
2. *«R14: lista las fotos y el pedido con la empresa del actor».*
   - Sale más fuerte que antes.
   - Antes solo leía `LINEA_SIN_FOTOS`, y el bucle sobre `listByOrder` no comprobaba nada.
   - Ahora lee también `LINEA` (con fotos). Comprueba la empresa en todas las llamadas a `countByLines` y `listByOrder`, en `listSummaries…` (la primera llamada) y en `listRecipeOutlines…`.

### B2 (R15, misma línea con dos pedidos): resuelto

- **Una sola clave para la pareja.** `lineEvidenceKey(orderId, lineId)` (en `domain/step-evidence.ts`) se usa en todos los sitios:
  - el puerto, documentado;
  - el adaptador: el `groupBy` sigue siendo una sola consulta, y filtra por las parejas pedidas, no por un mapa de línea a pedido;
  - el caso de uso, al quitar repetidos y al buscar el conteo;
  - el doble.
- **Tests de los dos órdenes, unit e integración:** solo cuenta `(A, L)` y con su total; `(B, L)` no sale.
- **Los tests de integración anteriores no se aflojaron.** Pasaron a la clave nueva con los mismos valores.
- **La forma de `LineEvidenceCount`, y con ella la pantalla, no cambia.**

### m1: cerrado

La casilla está marcada en `tasks.md`, con una nota del motivo: deuda QC/QT del validador y gate completo en CI. Me vale.

### Hallazgo nuevo

**B3 — BLOQUEANTE · un comentario de producción cita un requisito** (`docs/perfil-agentes.md > reviewer`, punto 9). El diff añade este comentario en `lib/modules/asignaciones/domain/get-line-evidence.ts`:

```ts
    // las otras recetas antes de responder order_not_found (R14).
```

En una línea de producción que el diff añade, citar `R<n>` es BLOQUEANTE. Hay que quitar `(R14)`. El motivo ya se entiende sin la cita: «si no, una línea ajena firmaría las fotos de las otras recetas antes de responder order_not_found». Fuera de esa línea, el diff no añade ninguna cita prohibida en `app/`, `lib/` ni `components/`.

### Veredicto vuelta 2

**RECHAZADO**, solo por B3. Es un cambio de una línea en un comentario; quitar `(R14)` basta. B1, B2 y m1 están resueltos, sin regresiones en lo que corrí. Con B3 corregido el veredicto será OK, salvo que el arreglo toque algo más.

## Cierre (leader, 2026-11-11)

El arreglo de B3 es `998ca0684`. El diff `4ca47dd75..998ca0684` en `lib/` cambia solo esa línea: se quita `(R14)` del comentario. En los comentarios añadidos de `lib/`, `app/` y `components/` no queda ninguna cita a `R<n>`, `QT-` ni `QC-`. Se cumple la condición de la vuelta 2 («queda OK salvo que el arreglo toque algo más»). **Veredicto final: OK.**
