# QC-307 — precio-de-venta-del-pedido · review

## Vuelta 1 (diff completo `2b6eb3bba..51b0db6d7`)

Fecha: 2026-10-28. Base: merge-base con `origin/dev` (`2b6eb3bba`). La rama va ~193 commits por
detrás de `origin/dev` y no se ha sincronizado. No he visto ningún rojo que venga de eso.

### Qué corrí

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores y 10 warnings, todos en archivos preexistentes ajenos al cambio
  (`order-service.test.ts:16-17` ya estaban).
- `pnpm exec vitest run` sobre 22 archivos de unidad y UI que toca la feature: `order-input`,
  `order-view`, `orders-sale-price-migration`, `create-order`, `update-order`, `order-edit-change`,
  `get-order`, `list-orders`, `set-order-customer`, `update-order-presentation-lines`,
  `list-assigned-orders`, `get-assigned-order-execution`, `order-service`, `company-scope`,
  `order-columns`, `order-cards`, `order-form-sale-price`, `pedidos-viewport`,
  `order-list-skeleton`, `formularios-paridad`, `pedidos-paridad` y `order-form`.
  Resultado: `22 passed`, `821 passed`.
- `pnpm exec vitest run tests/integration/pedidos/order-sale-price.int.test.ts`: `11 passed`.
- `pnpm exec vitest run guard`: `87 passed`, `1276 passed | 22 skipped`.
- Lo que no corrí: `./init.sh`, la suite completa, `vitest related` (por encargo) ni el E2E. El
  E2E lo leí; su salida local (2 passed) está en `impl_QC-307.md > Tanda 3`.

### Checklist

**Especificación**
- [x] `requirements.md`: R1–R23 en EARS.
- [x] `design.md`: 8 alternativas descartadas con su porqué.
- [x] `design.md` abre con `## Lo que ya existe`, con búsqueda, hallazgos y catálogo de UI. El
  diff no re-crea nada de esa lista: reutiliza `CostCell` (renombrada `AmountCell`), `OrderField`,
  `withCardFieldLabel`, `formatMoneyDisplay` y `exactDecimalTitle`.
- [~] `tasks.md`: T1–T9 están en `[x]`; T10 sigue `[ ]`. Faltan `./init.sh` y completar el mapa
  (m1). Hay precedente (QC-306) de que esto lo cierra el leader, así que no lo cuento como
  bloqueante.

**Equipo**
- [x] Assignee (Christian Quevedo) y rama `feature/QC-307-precio-de-venta-del-pedido`.
- [x] El choque con QC-263/QC-264 fue aceptado por el humano (`progress/features/QC-307.md`).

**Trazabilidad**
- [x] Cada R1–R23 tiene al menos un test con aserción real. Tabla abajo.
- [~] `impl_QC-307.md` trae el mapa de las tandas 2 y 3, pero le faltan R1, R3, R4, R5, R8 y R14
  (m1).

**Calidad de código**
- [x] Typecheck y lint en verde, sin errores.
- [ ] `gate-completo`: pendiente del PR.
- [x] Flujo crítico (importes): hay E2E de Playwright `e2e/pedido-precio-de-venta.spec.ts`, con
  su salida local en impl.
- [x] Sin dependencias nuevas: `package.json` no cambia y no entra `decimal.js`.
- [x] Multiplataforma: el campo es `OrderField` (el mismo control que la cantidad). No hay `100vh`,
  `:hover` ni tamaños nuevos.
- [x] Catálogo: no hay pieza nueva, subida ni borrada en `components/shared`, `ui` ni `hooks`.
  `AmountCell` es interna de la ruta.
- [x] Pase `/design`: P1 la cerró el humano el 2026-10-28 sin tablero, por la excepción de
  composición. No la reabro.

**Seguridad, configuración, datos**
- [x] No hay secretos, webhooks ni valores de entorno hardcodeados.
- [x] No hay tabla nueva: es una columna en `orders`, que ya tiene RLS y `company_id`.
  `insertAliveOrder` y `updateAliveOrder` mantienen el filtro de empresa.
- [x] El permiso se valida en `domain/`: `requirePermission` va antes del `parse` en
  `create-order` y `update-order`, con test (R15, y R37 de `update-order.test.ts`).
- [x] La migración es versionada y tiene `down.sql`. El test estático cubre las dos; la plantilla
  de test-db la aplica.
- [x] Acceso a datos solo por el adaptador Prisma.

**Módulos hexagonales y permisos**
- [x] `domain/` no importa framework. `AssignedOrderSummary` no cambia (R17).
- [x] La lógica vive en `domain/` (esquema y `isCustomerOnlyEdit`). La action solo lee el
  `FormData`.

**Reglas del perfil (reviewer 5–11)**
- [x] 5 calidad y seguridad.
- [x] 6 multiplataforma.
- [x] 7 dependencias.
- [x] 8 empresa.
- [ ] **9 comentarios: falla (B1).**
- [x] 10 duplicados.
- [x] 11 diseño (P1 cerrada).

### Trazabilidad R → test

| R | Test |
|---|---|
| R1 | `tests/unit/pedidos/order-view.test.ts` «R1, R2: NewOrder, OrderRow y OrderView declaran salePrice…» y «…salePrice es obligatorio en el tipo» |
| R2 | `orders-sale-price-migration.test.ts` «R2, R18: la columna nace en orders…», «R2: campo opcional en ingles, decimal(14,4)…»; int «R2: el alta con '1250.5' se lee como '1250.5000'…» |
| R3 | `order-input.test.ts` «R3: una clave currency se descarta»; migración «R2: sin columna de moneda…», «R2: el modelo no declara moneda» |
| R4 | `order-input.test.ts` «R4: ausente…», «R4: ''…», «R4: '   '…» |
| R5 | `order-input.test.ts` «R5: '1250.5' se acepta como cadena…», «R5: '9999999999.9999'…» |
| R6 | `order-input.test.ts` «R6: '0' y '0.0000' se aceptan»; int «R6: el alta con '0' se lee como '0.0000'…»; `get-order.test.ts` «QC-307 R6…» |
| R7 | `order-input.test.ts` «R7: '-1' falla»; `create-order.test.ts` «QC-307 R7: un precio "-1" falla con invalid_input y no escribe» |
| R8 | `order-input.test.ts` «R8: '1,5'», «'1e3'», «'1.12345'», «'12345678901'», «'abc'» |
| R9 | migración «R9: el CHECK impide un precio negativo…»; int «R9: un UPDATE crudo a -1 sale con 23514…» |
| R10 | `update-order.test.ts` «QC-307 R10: la edicion sustituye el precio…»; int «R10: updateAliveOrder sustituye…» |
| R11 | `update-order.test.ts` `it.each` «QC-307 R11: en %s, cambiar el precio falla con invalid_transition…» |
| R12 | `update-order.test.ts` «QC-307 R12: cliente y precio cambiados a la vez…»; `order-edit-change.test.ts` (4 casos R12) |
| R13 | `update-order.test.ts` «QC-307 R13: solo el cliente cambiado…»; `set-order-customer.test.ts` y `update-order-presentation-lines.test.ts` «QC-307 R13…»; int (4 casos R13) |
| R14 | `order-input.test.ts` «R14: updateOrderDistributionSchema con salePrice falla por .strict()» |
| R15 | `create-order.test.ts` «QC-307 R15: sin pedidos.modificar falla con unauthorized antes de validar…»; para la edición, `update-order.test.ts:1747` «R37: sin pedidos.modificar…» |
| R16 | `get-order.test.ts` y `list-orders.test.ts` «QC-307 R16…» (con y sin permiso) |
| R17 | `list-assigned-orders.test.ts` y `get-assigned-order-execution.test.ts` «R24, R17 (QC-307)…»; `order-view.test.ts` «R17: AssignedOrderSummary… NO declara salePrice»; int «R17: los resumenes de OrderCatalog…» |
| R18 | migración «R18: ninguna sentencia rellena…», «R18: down.sql quita…»; int «R18: un INSERT crudo… deja la columna en NULL» |
| R19 | `order-columns.test.tsx` (8 casos «QC-307 R19…»); `order-cards.test.tsx` (2 casos) |
| R20 | `order-columns.test.tsx` «QC-307 R20: no declara sortable ni filter»; `list-orders.test.ts` «QC-307 R20: … se poda y se anota» |
| R21 | `order-form-sale-price.test.tsx` (6 casos «QC-307 R21…», incluido «'-1' senala el campo, no llama a la action y conserva lo escrito») |
| R22 | `e2e/pedido-precio-de-venta.spec.ts` «QC-307 R22 — registra un pedido con precio…» |
| R23 | `create-order.test.ts` «QC-307 R23: el coste estimado… es el mismo con precio que sin el»; `order-view.test.ts` «R23: OrderView no declara… margin ni profit» |

### Desvíos declarados en impl: los juzgo todos aceptables

- **Fixtures de `company-scope.test.ts` y `order-service.test.ts`** (`salePrice: null`, incluido
  en 3 `toEqual`): aceptable. Es la forma nueva del contrato, no un cambio de comportamiento.
  Los dos archivos están en `Archivos esperados > Fixtures`.
- **`ORDER_TABLE_CARD.meta` en `order-table.tsx`**: aceptable y necesario. Sin él, la tarjeta no
  pinta el precio y R19 no se cumple (`order-cards.test.tsx` lo prueba). Lo que falla es el
  `design.md > 6.2` («no hay archivo aparte que tocar»): ver m2.
- **`pedidos-viewport.test.tsx` de 14 a 15 columnas**: aceptable. Es consecuencia directa de la
  columna nueva, igual que `ORDER_SKELETON_COLUMN_COUNT`.
- **`E2E_ESPERADOS` y `MIGRACIONES_ESPERADAS` en `guard-identificador-de-request`**: aceptable.
  Es el mismo camino que QC-305 (su B1), y cada alta lleva su comentario sin cita.
- **`submitOrderWithLeftover` en el E2E**: aceptable. El alta sin reparto pide confirmar el
  sobrante (comportamiento existente), y `pedido-conversion-de-unidad.spec.ts` ya usa el mismo
  helper. El recorrido sigue cubriendo lo que pide la decisión 12.

### Hallazgos

- **B1 — BLOQUEANTE. Comentarios de producción que citan la ficha o un requisito.** La regla 9
  del perfil y `docs/conventions.md > Comentarios` («Sin excepciones») lo prohíben. La rama
  añade 19 líneas así:
  - `lib/modules/pedidos/adapters/driven/persistence/order-prisma.ts:134, :563`
  - `lib/modules/pedidos/adapters/driving/order-actions.ts:231`
  - `lib/modules/pedidos/domain/create-order.ts:181`
  - `lib/modules/pedidos/domain/get-order.ts:176`
  - `lib/modules/pedidos/domain/order-catalog.ts:288`
  - `lib/modules/pedidos/domain/order-edit-change.ts:20, :21, :45`
  - `lib/modules/pedidos/domain/order-input.ts:20, :50`
  - `lib/modules/pedidos/domain/order-view.ts:16, :23, :92, :114, :142, :163, :209`
  - `lib/modules/pedidos/domain/update-order.ts:212`

  Hay que quitar la cita (`QC-307`, `R<n>`) y dejar solo el porqué. Si el comentario se queda sin
  porqué, se borra entero; por ejemplo, `get-order.ts:176` y `create-order.ts:181` repiten el
  código.

  En tests rige la misma regla: `R<n>` va solo en el nombre del caso. La rama añade 22
  comentarios con cita en tests. Hay que limpiarlos en la misma vuelta:
  - `get-assigned-order-execution.test.ts:710`
  - `list-assigned-orders.test.ts:206`
  - `create-order.test.ts:1456-1457`
  - `get-order.test.ts:373`
  - `list-orders.test.ts:1129, :1131`
  - `order-edit-change.test.ts:180-181`
  - `order-input.test.ts:193, :230, :566`
  - `order-service.test.ts:222, :502`
  - `order-view.test.ts:148, :190, :193`
  - `set-order-customer.test.ts:437`
  - `update-order-presentation-lines.test.ts:866`
  - `update-order.test.ts:1991-1993`

  Precedente: QC-305 B2.

- **m1 — menor.** El mapa R → test de `progress/impl_QC-307.md` no incluye R1, R3, R4, R5, R8 ni
  R14. La tanda 1 no tiene sección en la bitácora. Los tests existen (tabla de arriba). Hay que
  completarlo al cerrar T10, y T10 sigue `[ ]` hasta que `./init.sh` salga verde.
- **m2 — menor.** `design.md > 6.2` dice que la tarjeta «no tiene archivo aparte que tocar», y
  `tasks.md > Archivos esperados` no lista `order-table.tsx`. El código es correcto; lo que está
  desfasado es el spec. Hay que anotar el desvío en `design.md` o dejarlo en el cierre.
- **m3 — menor.** Hay dos líneas de comentario largas, de más de 100 columnas:
  - `lib/modules/pedidos/domain/order-input.ts:20` (sale al quitar la cita de B1);
  - `app/(private)/pedidos/components/order-table.tsx:113`.
- **m4 — menor.** R15 en la edición se apoya en el test previo `update-order.test.ts:1747` (R37),
  que no lleva precio en la entrada. El caso de alta sí prueba «antes de validar con precio
  inválido». Basta con eso, pero un caso gemelo en la edición cerraría la simetría.

### Veredicto

**RECHAZADO.** Hay un bloqueante, B1: quitar las citas `QC-307`/`R<n>` de las 19 líneas de
comentario de producción y de las 22 de tests listadas. Si abulta, va en un commit
`chore(QC-307): limpia comentarios de …` que solo toque comentarios. De paso conviene cerrar m1
(mapa completo + T10) y m2. La vuelta 2 puede acotarse al diff de esa limpieza.
