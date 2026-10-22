# Fix E2E del PR #294 (dev -> prod)

- Rama: `fix/e2e-prod-294` (desde `origin/dev` a6314c1e). Sin push ni PR (lo hace el leader).
- Evidencia: run 39807734814, jobs 119925599099 (chromium) y 119925598710 (webkit); 15 rojos
  deterministas en chromium (3/3 reintentos), 14 en webkit + 3 flaky webkit.
- Modo: **sin SDD** (decision humana): no se tocan specs; se leen solo para decidir codigo vs test.
- Resultado global: **un solo bug de codigo** (grupo 5, indicador del sidebar). El resto son E2E
  que se quedaron atras de cambios de producto intencionales mergeados a `dev` sin correr el E2E
  (el E2E solo corre en el PR a `prod`).
- Commits: 26251fea (g1), 338264e8 (g2-g3), bcf05673 (g4 + R47 de g2), b19f9c62 (g5), 3fdc2473 (g6).

## Verificacion: lo que se corrio y lo que NO

- **E2E local: NO se pudo correr.** El disco `C:` esta lleno (476G/476G, 80-160 MB libres).
  `next dev` del webServer de Playwright murio al compilar el middleware:
  `TurbopackInternalError: failed to write ... Espacio en disco insuficiente. (os error 112)`.
  Se monto la base (`pnpm run db:test template` -> `qct_tpl_37cac790cc7c`, copia `qc_e2e_fix294`)
  y se borro despues para liberar espacio. Mas tarde el disco subio a 3,2 GB libres, pero el
  **Postgres local (servicio `postgresql-x64-16`) quedo en «modo de recuperacion»** (20 intentos en
  5 min, probablemente por el disco lleno); es el servidor del humano y no se reinicio.
  **Ningun arreglo esta probado en navegador**: la prueba es el job `e2e` del PR.
- Typecheck: `pnpm run typecheck` (tsc --noEmit) en verde, con `next typegen` previo (sin el falla
  `app/layout.tsx(45,56) LayoutProps`, ajeno: faltaba `.next/types` en el worktree; CI corre typegen).
- Lint: `pnpm exec eslint e2e/ components/private/sidebar-active-indicator.tsx
  tests/unit/sidebar-active-indicator.test.tsx` -> «ESLint: No issues found», exit 0.
- Vitest related (solo g5 toca codigo): 22 archivos, 376 tests en verde.

## Grupo 1 - coste unitario del lote (envases-reales-empaque :460, :551, :675)

- **Causa:** QC-305 (PR #289; d27c619d, calculo en 7ba162f5) reparte el **coste real** del pedido
  (suma de asientos `consumption` x coste del lote) entre los lotes de PT, no el estimado. El E2E
  sembraba el coste solo en `orders.ingredientsCost`, sin asientos de consumo del ingrediente, asi
  que el real era solo envases a 0,5: 5/6,5 = 0,7692; 1,5/3 = 0,5; 4/12 = 0,3333 (lo que vio CI).
- **Spec:** QC-305 R1, R2, R16 y la enmienda de QC-281 D20/R21 (f698c26e). El codigo cumple.
- **Decision:** actualizar test. Nuevo `seedIngredientConsumption` (producto + lote + `opening` y
  `consumption` del pedido) y `actualCostOf`. Asserts: real = 75 / 51,5 / 104; coste del lote =
  real / lo envasado real (6,5; 3; 12) y distinto del reparto sobre el plan; suma stock x coste ~ real.
  Se mantienen todos los R de QC-281 del titulo.
- **Commit:** 26251fea. **Estado:** arreglado (test), sin verificar en E2E.

## Grupo 2 - linea de reparto con volumen + duplicado en producto terminado

- `pedidos.spec.ts:443` (R29) y `pedido-en-varias-presentaciones.spec.ts:777` (R47):
  - **Causa:** 9a330ab2 (PR #259) anade a proposito el volumen a `orderDistributionLineText`
    («12 x Envase · 1 unidad»).
  - **Decision:** test. pedidos.spec usa la propia `orderDistributionLineText` con los datos
    sembrados; varias-presentaciones construye `«3 x envase · 1 l»` con `unit.symbol ?? unit.name`.
- `detalle-de-producto-terminado.spec.ts:483` (R31, R27, R26):
  - **Causa:** QC-263 T3 (c09844b7) pasa `card` a la tabla de PT; `DataTable` pinta tabla y
    tarjetas (ocultas por CSS en ancho), con los mismos testids: 2 elementos.
  - **Decision:** test. Se busca dentro de las filas `data-table-row-*`; el conteo sigue en 1.
- **Commits:** 338264e8 (pedidos, detalle), bcf05673 (varias-presentaciones :777).
  **Estado:** arreglado (test), sin verificar en E2E.

## Grupo 3 - columnas de Pedidos (pedidos-rediseno :515)

- **Causa:** 0f71d5af (quita Cantidad), 27fdd133 (Por entregar), a7528fb4 (Por entregar antes de
  Presentacion), 27f4da3f y QC-305 0284ea0c (Costo estimado / Costo real). Orden acordado en
  `tests/unit/pedidos-ui/order-columns.test.tsx`.
- **Decision:** test. `COLUMN_IDS` con las 14 de hoy; titulo «catorce columnas» + QC-305 R19.
  QC-262 R16 admite desborde dentro de la caja de la tabla (el test lo comprueba asi), por eso no
  queda abierto; pero la parte posterior a la linea 546 nunca corrio en CI.
- Nota: el texto de QC-262 R16 sigue diciendo «doce columnas» (spec sin tocar, sin SDD).
- **Commit:** 338264e8. **Estado:** arreglado (test), sin verificar en E2E.

## Grupo 4 - pantallas de operario, empacador y dashboard

- `pedido-en-varias-presentaciones.spec.ts:574` y `envases-del-pedido.spec.ts:498`
  (`step-reader-item-0-0` no aparece): d4ff52c6 (PR #248, fix/operario-comenzar-en-pantalla):
  Entrar ya no comienza; el paso a paso llega tras «Comenzar». Test: se pulsa Comenzar (nuevo
  helper `startOpenedAssignedOrder`); envases-del-pedido comprueba antes que sigue `PENDIENTE`.
- `pasos-de-envasado.spec.ts:435`:
  - «Terminar00:01»: cb39a83d / QC-265 24e1affb meten una cuenta regresiva `aria-hidden` en el
    boton. Test (R32): durante la espera, deshabilitado + motivo visible + nombre accesible
    «Terminar» + cuenta visible y `aria-hidden`; al habilitarse, sin cuenta y texto «Terminar».
  - «Comenzar» no encontrado (intento A): **causa no confirmada** (sin traza). Mitigacion:
    `enterAndStartAssignedOrder` repite el clic en Entrar hasta que cambia la ruta (toPass 120 s).
- `empaque.spec.ts:577` (R48): 9a330ab2 hace que «Terminados» del Empacador incluya lo que empaco
  aun sin terminar. Test: la fila debe aparecer (1) en su seccion Terminados.
- `recorrido-acondicionamiento.spec.ts:754` (R36): QC-277 (26051d1e, c5f828df) hace del dashboard
  un anadido por empresa; la empresa del test nacia sin ninguno (404). Test: `enableAllAddons`.
- **Commit:** bcf05673. **Estado:** arreglado (test), sin verificar en E2E.
- **Abierto (decision humana, no bloquea el verde):** QC-215 R31 dice que «Terminados» lista solo
  `TERMINADO`; 9a330ab2 lo cambio sin enmendar el spec. ¿Se enmienda R31?

## Grupo 5 - indicador del sidebar (movimiento :618, normal y reducido) - BUG DE CODIGO

- **Causa:** `measureWithin` en `components/private/sidebar-active-indicator.tsx` suma
  `offsetLeft/offsetTop` por la cadena de `offsetParent`, que cuentan desde el borde de relleno: el
  borde de cada padre se pierde. La lista del submenu lleva `border-l` + `translate-x-px` (que la
  hace `offsetParent` del `<li>`), y el indicador quedaba 1 px a la izquierda del boton; el E2E pide
  < 1 px.
- **Commits:** bug latente desde 69875d4e (QC-228, indicador deslizante); aflora con d211efba
  (QC-244, Clientes pasa a grupo con submenu) y b1e40c42 (E2E movido al subitem; QC-244 T10 dice
  «falta correrlo en local»).
- **Spec:** QC-228 R15 (misma posicion y tamano que el item activo); QC-244 design 7.2 mantiene la
  tolerancia < 1 px. El codigo viola el spec.
- **Decision:** arreglar codigo: se suma `clientLeft/clientTop` de cada `offsetParent` intermedio
  (no el del contenedor). E2E sin tocar. Test unitario nuevo en
  `tests/unit/sidebar-active-indicator.test.tsx` (falla sin el arreglo). Confirmado por el
  subagente con un DOM estatico en Chromium y WebKit de Playwright: boton 25 / indicador 24 antes,
  25 / 25 despues.
- **Verificacion:** `vitest run tests/unit/sidebar-active-indicator.test.tsx` 15/15;
  `vitest related --run components/private/sidebar-active-indicator.tsx` 22 archivos, 376 tests en verde.
- **Commit:** b19f9c62. **Estado:** arreglado (codigo), E2E sin correr.

## Grupo 6 - requisitos de contrasena tras rechazo (acceso-rediseno :319, R20)

- **Causa:** la lista no estaba vacia: mostraba las seis reglas y faltaba solo
  `{rule: 'breached', state: 'unknown'}`. c36a1395 (QC-273) quita a proposito «breached» de la
  lista en vivo (enmienda QC-21 R15 y QC-260 R16/R17); la nombra el aviso del servidor (QC-260 R18).
  QC-273 actualizo sus unitarios pero no este E2E (3ab68cd9).
- **Decision:** test. Se filtra `breached` del esperado; R20 se sigue comprobando entero (estado de
  cada regla = valor visible de «Contrasena nueva», en orden del catalogo).
- **Commit:** 3fdc2473. **Estado:** arreglado (test), sin verificar en E2E.

## Webkit: fallos propios de webkit

- `operario-rediseno.spec.ts:879` (R41): `Target crashed` de WebKit, flaky (paso en reintento).
  Sin cambio: no es un fallo determinista del codigo ni del test. **Abierto / vigilar.**
- `reserva-de-material.spec.ts:590` (R48): «Comenzar» no encontrado tras Entrar, flaky. Usa
  `enterAndStartAssignedOrder`, que ahora reintenta el clic en Entrar (bcf05673): misma mitigacion
  que pasos-de-envasado intento A.
- `pasos-de-envasado.spec.ts:435` en webkit: flaky por la misma razon + la cuenta regresiva (grupo 4).

## Riesgos a vigilar en el job e2e del PR

- Ningun arreglo se ha visto en verde: el disco lleno impidio el E2E local.
- pasos-de-envasado: hay tres comprobaciones mas dentro de la espera de 5 s del paso; dependen del tiempo.
- pedidos-rediseno: el tramo tras la linea 546 (desborde a 1440 px con 14 columnas) nunca corrio.
