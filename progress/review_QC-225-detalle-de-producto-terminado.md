# QC-225 — detalle-de-producto-terminado · revisión F2.2

- Rama `feature/QC-225-detalle-de-producto-terminado`, head `b5e1e168`; diff contra
  `git merge-base HEAD origin/dev` = `3e5cb2cb` (78 archivos). La rama no se sincronizó.
- Revisado contra: `specs/QC-225-detalle-de-producto-terminado/{requirements,design,tasks}.md`,
  `progress/impl_QC-225-detalle-de-producto-terminado.md` (tandas 1–3), `docs/perfil-agentes.md`
  (`Todos los agentes`, `reviewer` 5–11, `frontend_dev` 13), `docs/conventions.md > Comentarios`,
  `docs/checkpoints-proyecto.md`, `CHECKPOINTS.md`, `components/shared/CATALOGO.md` y `docs/diseno/README.md`.
- Grafo de código: no lo usé. Exploré con Grep/Read y git.
- La máquina va corta de memoria. Por eso no corrí `./init.sh`, la suite completa, el E2E ni los `.int`
  (necesitan una base efímera). De los `.int` y del E2E solo tengo la salida de la bitácora.

## Verificación ejecutada por el reviewer

| Comando | Resultado |
|---|---|
| `NODE_OPTIONS=--max-old-space-size=4096 pnpm run typecheck` | limpio |
| `pnpm exec eslint` sobre los `.ts/.tsx` añadidos o modificados del diff | limpio (exit 0) |
| `pnpm exec vitest run guard` | 75 archivos, 1050 verdes, 20 saltados |
| `vitest run tests/unit/inventario tests/unit/inventario-ui` | **1 rojo** / 113 verdes: `inventario/schema/inventory-movements-migration.test.ts:444` |
| `vitest run tests/unit/pedidos tests/unit/pedidos-ui tests/unit/paridad/pedidos-paridad.test.tsx tests/unit/clientes/scope.test.ts tests/unit/shared/data-table-alcance.test.ts tests/unit/identity/session-once-per-request-actions.test.ts tests/unit/recetas-ui/recipe-route-contract.test.ts tests/unit/composition` | **1 rojo** / 139 verdes: `pedidos/order-delivery-append-only.test.ts:81` |
| `tests/baseline-rojos.json` | ninguno de los dos rojos está listado; los dos los causa el diff |
| grep de `QC-`/`R<n>`/`D<n>`/`design.md`/«decisión cerrada» en líneas `+` de `app/ lib/ components/ db/` | 0 |
| bloques de comentario de más de 5 líneas en líneas `+` de producción | 0 |

## Checklist

### CHECKPOINTS.md
- [x] `requirements.md` con requisitos EARS R1–R36.
- [x] `design.md` con alternativas descartadas (§9: A1–A10).
- [x] `tasks.md`: todas las tasks en `[x]` (T0, B1–B3, F1–F4, TC, TI, TZ).
- [x] `design.md` abre con `## Lo que ya existe`, que no está vacía. El diff no re-crea nada de esa lista:
  usa `OrderNumberDirectory`, `wholePackagesIn`, `findRefsIncludingDeleted`, `DataTable`, `EntityImage`
  y `movementReasonLabel`, y no toca `createGetProduct`/`createListProductBatches`/`list-order-deliveries`.
- [x] Assignee y rama publicada (`progress/features/QC-225.md`).
- [x] Cada `R<n>` mapea a un test concreto (mapa de TZ). Revisé los casos por nombre en los archivos del
  diff; R14 se comprueba de verdad con un pedido borrado en el `.int`. R32 queda cubierto por las guardias
  existentes, como prevé `design.md > 10`.
- [x] `progress/impl_<key>.md` contiene el mapa `R<n> → test`.
- [x] Typecheck y lint en verde.
- [ ] **`gate-completo` en verde: no lo estará.** Dos censos unitarios fuera del baseline salen rojos
  (M1, M2).
- [x] Flujo crítico (permisos y movimientos de inventario) con E2E de Playwright. La salida local en
  Chromium y WebKit está en la bitácora.
- [x] Sin dependencias nuevas: `package.json` y `pnpm-lock.yaml` sin diff.
- [x] Sin secretos ni configuración hardcodeada. Sin webhooks.
- [ ] `./init.sh` en verde: no lo corrió nadie, por la memoria. Con M1 y M2 tampoco saldría verde en
  `vitest related`, salvo que no los relacione (son barridos de disco).
- [ ] Revisión OK: no (este documento).

### docs/checkpoints-proyecto.md
- [x] Multiplataforma:
  - enlaces nuevos con `touchTarget`;
  - «+N» con `Button … touch`;
  - `hover:underline` es solo decoración; el foco tiene anillo y la activación es por clic, tacto o teclado;
  - sin `100vh` ni inputs nuevos.
- [x] Catálogo: no se crea, sube ni extiende ninguna pieza de `components/ui`, `components/shared`,
  `lib/shared/ui` ni `hooks`.
- [ ] **Pase `/design`: falta (M3).**
- [x] Sin tablas nuevas. El permiso se valida en `domain/` (primera sentencia de las seis factorías) y
  tiene test (R2/R3). Ámbito de empresa con los envoltorios de `company-scope` y rechazo cruzado
  en los `.int` (R25).
- [x] Hexagonal:
  - `domain/` y `ports/` sin framework;
  - `inventario` llega a `pedidos` solo por el hueco `FinishedDeliveryDirectory`, que cablea `composition`;
  - el adaptador de `pedidos` lee solo tablas de `pedidos`;
  - el driving no instancia el driven;
  - ningún `'use server'` sale reexportado.
- [x] Permisos en la página por `requirePagePermission` como primera línea. Los componentes reciben
  datos por props o por actions de lectura.

### Puntos 5–11 de `perfil-agentes.md > reviewer`
- [x] 5 Calidad y seguridad: solo lectura, sin RLS nueva y sin hardcode de empresa (sale de la sesión).
- [x] 6 Multiplataforma: ver arriba.
- [x] 7 Dependencias: ninguna.
- [x] 8 Aislamiento por empresa: cada consulta nueva está acotada y tiene test de acceso cruzado.
- [x] 9 Comentarios de producción: 0 citas. En tests hay citas nuevas (m1).
- [~] 10 Duplicados: `OrderProducedPresentations` repite la forma de `OrderDistributionLabel`.
  `design.md §6.4` dice por qué no la extiende, pero no nombra el paso de la regla (m4).
- [ ] **11 Diseño: falta (M3).**

## Hallazgos

### MAYOR

**M1 — Censo `inventory_movements` solo admite altas, en rojo.**
- Dónde: `tests/unit/inventario/schema/inventory-movements-migration.test.ts:444`. Espera
  `['create','findMany']` y recibe `['count','create','findMany']`.
- Causa: el adaptador nuevo llama a `prisma.inventoryMovement.count` en
  `lib/modules/inventario/adapters/driven/persistence/finished-product-detail-prisma.ts:190`, `:231` y `:274`.
- `count` es de lectura y es legítimo para paginar (R23). El censo es cerrado y hay que enmendarlo:
  - añadir `count` con una nota fechada, conservando la intención (ninguna operación que modifique);
  - sumar el archivo a `tasks.md > Archivos esperados` y a la tabla de `design.md > 7`, que no lo prevé.

  Alternativa: si se prefiere no tocar el censo, contar de otra forma.
- La bitácora no lo detectó: `vitest related` no relaciona este barrido de disco.

**M2 — Censo «la entrega es solo de inserción», en rojo.**
- Dónde: `tests/unit/pedidos/order-delivery-append-only.test.ts:81`.
- Causa: `NOMBRE_MUTANTE` (insensible a mayúsculas: `…void…Deliver…`) casa con
  `export const VOIDED_DELIVERY_LABEL` de
  `app/(private)/inventario/producto-terminado/[id]/components/finished-product-deliveries-table.tsx:24`,
  que el barrel reexporta en `components/index.ts:17`.
- Es un falso positivo, pero rompe el gate.
- Arreglo más barato, sin aflojar el censo: renombrar la constante a un nombre que no ponga
  `void`/`annul`/`cancel`… delante de `Deliver`, por ejemplo `DELIVERY_VOIDED_LABEL`.
- La bitácora de la tanda 1 lo da en verde, pero se corrió antes de F2, que es la tanda que creó la
  constante.

**M3 — Componentes nuevos con UI visible nueva sin pase `/design`; `design.md` no cita ningún tablero.**

La regla («Pase de diseño para componentes nuevos», regla dura del 2026-10-10, reviewer 11,
`checkpoints-proyecto > Calidad de código`) ya regía cuando se escribió el spec (`5c401a3f`,
2026-10-13). `grep` de `canvas`/`.dc.html`/`/design` en `specs/QC-225-*/` da 0 resultados, y en
`docs/diseno/canvas/` no hay ningún tablero de esta ficha.

- **Pregunta 1 del leader, `OrderProducedPresentations` (`app/(private)/pedidos/components/order-produced-presentations.tsx`): la excepción NO la cubre.**
  - Compone piezas catalogadas, pero introduce UI visible nueva:
    - enlaces con estilo propio dentro de la celda;
    - un «+N» que deja de ser texto y pasa a ser un botón;
    - un `Popover` con la lista entera de presentaciones.
  - La fila de `OrderDistributionLabel` en `CATALOGO.md:73` dice explícitamente «No cubre: la lista
    desplegada».
  - Además cambia lo visual de la columna «Presentación» de /pedidos, que tiene tablero
    (`Pedidos*.dc.html`).
- **Más amplio que la pregunta: la ficha entera.** La ruta `app/(private)/inventario/producto-terminado/[id]/` es una pantalla
  nueva: cabecera, siete pestañas, General, Stock, cinco tablas, total entregado y marca «Anulada».
  - La excepción es para un *subcomponente interno* que *no introduce UI visible nueva*. Una pantalla
    nueva no lo es, aunque cada pieza (`PageShell`, `PageHeader`, `UrlTabs`, `DataTable`, `EmptyState`,
    `ErrorState`, `StatusBadge`, `EntityImage`) esté catalogada.
  - Hay precedente de pantallas de detalle con tablero (`ProveedorDetalle{,Movil,Tablet}.dc.html`).
- **Qué falta.** Lo decide el humano, por el leader. Cualquiera de las dos vías:
  - **(a)** Pase `/design` (escritorio, tablet y teléfono) de la ficha y de la celda de /pedidos. Después:
    aprobación del humano, copia a `docs/diseno/canvas/`, cita en `design.md §6` y ajuste del código a lo aprobado.
  - **(b)** Una excepción expresa del humano, fechada en `design.md`, que diga qué tablero existente rige
    (por ejemplo `ProveedorDetalle*` y `Pedidos*`) y por qué basta.

  Sin una de las dos, la regla dice «sin esa referencia no se implementa».
- Es un fallo aguas arriba: el spec se aprobó sin el tablero. Lo anoto como MAYOR porque la regla lo
  define así, no porque el implementer se lo saltara.

### menor

- **m1 — Citas de ficha en comentarios de test nuevos.** `docs/conventions.md > Comentarios` aplica a
  los tests la misma regla, y estas líneas son nuevas, no preexistentes. Se resuelve quitando la clave;
  la fecha y la descripción ya bastan:
  - `tests/guards/guard-pantallas-exigen-permiso.test.ts:262`: `// TENSADA el 2026-10-13 (QC-225)`;
  - `tests/unit/inventario/product-route-contract.test.ts:111`: `// 2026-10-13 (QC-225)`.

  «Nunca se imita el estilo de alrededor», así que el precedente del archivo no las salva.
  `tests/integration/aislamiento.json:626,631` (`"motivo": "QC-225 B1…"`, `"QC-225 B2…"`) no es un
  comentario: es dato de un registro que ya usa la clave en decenas de entradas. **No es hallazgo.**
- **m2 — Rutas abreviadas en `tasks.md:337-338`.** `batch-history.tsx`, `adjust-batch-dialog.tsx` e `index.ts`
  van sin carpeta. `perfil-agentes > Todos los agentes` exige la forma completa.
  `scripts/archivos-en-vuelo.mjs` (`RUTA_EN_SECCION`) las lee como archivos de la raíz, y
  `index.ts` así es ambiguo. Hay que escribir las tres rutas completas.
- **m3 — `design.md` desactualizado respecto de lo implementado:**
  - `:3` dice «P1 abierta» (está cerrada);
  - `:80` y `:550` sitúan `movementReasonLabel` en `batch-history.tsx`;
  - `:526` describe `finished-product-tabs.tsx` como un `Tabs` cliente (se usó `UrlTabs`, ver abajo);
  - la tabla de `§7` no incluye `inventario/scope`, `recipe-route-contract`, `clientes/scope` ni
    `data-table-alcance`, ni los dos censos de M1 y M2.
- **m4 — Regla de decisión sin el paso nombrado.** `design.md §6.4` no dice qué paso de la regla aplica a
  `OrderProducedPresentations`. Es el 3, componer, pero no lo nombra. Tampoco dice por qué no basta el 2:
  extender `OrderDistributionLabel` con una prop opcional. «No tocar el componente que usa /asignacion»
  es justo lo que el paso 2 permite si los consumidores no cambian. Se corrige junto con M3.
- **m5 — `take: 1` sin `orderBy` en el origen del lote**
  (`finished-product-detail-prisma.ts:136-140`). El índice único existente es
  `inventory_movements_one_production_per_line`: por línea, no por lote. Que un lote tenga un solo
  asiento `production` es un invariante de la escritura (QC-150), no una restricción de la base. Barato
  y determinista: `orderBy: { createdAt: 'asc' }`. No bloquea.

## Decisiones que el leader pidió valorar

1. `OrderProducedPresentations` sin tablero: **no exento** (M3).
2. **Mover `movementReasonLabel` a `app/(private)/inventario/components/movement-reason-label.ts` (`64ce1a3a`): OK.**
   - Es una función pura, con el mismo nombre y la misma salida.
   - El barrel la reexporta, y `batch-history.tsx` y `adjust-batch-dialog.tsx` solo cambian el import.
   - El comentario explica un porqué real (sin `'use client'`).
   - Hay test de regresión (`finished-product-route-contract.test.ts`, dos casos R16, uno con fuentes
     fabricadas).
   - Es mejor que duplicar etiquetas. Los tres archivos están en «Archivos esperados», pero con la forma
     abreviada de m2.
3. **Exclusión por nombre en `tests/unit/inventario/scope.test.ts`: aceptable.**
   - Sigue el molde de las cinco exclusiones previas: excluye un archivo y no una carpeta.
   - Tiene doble defensa: el archivo existe y no lleva `ProductListSection`/`product-table`.
   - Afinar el barrido cambiaría un censo ajeno sin necesidad.
4. **§2.3 enmendado a página primero, luego resumen, detalles y números en paralelo, sin resumen con
   total 0: correcto.**
   - Con `total === 0` no hay asientos `delivery`, así que el total entregado es 0 sin consultar (R34).
   - Con `total > 0`, `summarizeDelivered` usa todos los lotes de `findAliveFinished` y no los de la
     página.
   - El texto enmendado de §2.3 ya no se contradice.
5. **Otras decisiones:**
   - `UrlTabs`: correcto. El catálogo dice que `Tabs` «no cubre sincronizar con la URL (ver `UrlTabs`)».
     Mejora el diseño; solo falta reflejarlo (m3).
   - Etiquetas de motivo resueltas en el servidor y bajadas como mapa: OK.
   - `data-testid` de fila en la primera celda: OK. `DataTable` ya pone `data-table-row-<id>` en el `tr`
     y no ofrece un test id de fila propio. No justifica extender la pieza.
   - Imagen en la cabecera y en General: OK. §6.2 pide «nombre e imagen» en la cabecera y R10 la pide
     en General.
   - Ayudantes en `finished-product-params.ts` y `finished-product-stock.tsx`: OK.
   - `take 1` sin `orderBy`: aceptado, con m5.
   - Suites de integración en modo `commit`: OK. El adaptador usa el cliente global; es el mismo
     motivo y el mismo molde que `whatsapp-connection-prisma`, y el `afterAll` borra por empresa.
   - Cantidades a 4 decimales: OK. Es lo que fija `design.md §4.1`, igual que `toBatchView`.
   - `EXPLAIN` como superusuario sin RLS: aceptable. `docs/checkpoints-proyecto` dice que Prisma se
     conecta como dueño y que las policies no filtran sus consultas, así que el plan sin predicados de
     política es el de producción. Además está declarado en la bitácora.
6. **Comentarios:** producción limpia. En tests hay dos citas nuevas de `QC-225` (m1).
   `aislamiento.json` no es comentario.
7. **Archivos:** todo archivo del diff está en «Archivos esperados», salvo `specs/` y `progress/`, que no
   cuentan. Los tres de /inventario figuran abreviados (m2). Los arreglos de M1 tocarán un archivo que
   aún no está en la lista. Si M2 se arregla por la vía del renombre, no toca archivos nuevos.

## Veredicto

**RECHAZADO (CHANGES_REQUIRED).**

Qué falta para pasar:
1. **M1:** el censo de `inventory-movements-migration.test.ts` en verde, con su enmienda fechada y el
   archivo en «Archivos esperados» y en `design.md §7`.
2. **M2:** `order-delivery-append-only.test.ts` en verde, renombrando `VOIDED_DELIVERY_LABEL` (o
   equivalente sin aflojar el censo).
3. **M3:** decisión del humano sobre el pase `/design` de la ficha y de la celda de /pedidos, vía (a) o
   (b), reflejada en `design.md`. El leader tiene que llevarla al humano; no lo resuelve el implementer.
4. Los menores m1–m4 se corrigen en la misma vuelta (son de texto). m5 es opcional.
5. Antes de volver: correr otra vez los barridos de disco de `tests/unit/inventario` y `tests/unit/pedidos`,
   que `vitest related` no relaciona.
