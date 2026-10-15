# impl QC-285 — secciones-del-sidebar (frontend_dev)

## Archivos
Modificados:
- `lib/shared/navigation/private-nav.ts`: secciones `NAV_SECTION_TRACKING` (Seguimiento),
  `NAV_SECTION_PRODUCTION` (Producción), `NAV_SECTION_DIRECTORY` (Directorio); borrada
  `NAV_SECTION_CHAIN`; array reordenado; Fórmulas pasa de hijo del grupo `nav-produccion` a enlace
  directo de «Producción» (testId `nav-produccion-recetas` e icono `flask-conical` conservados);
  comentarios obsoletos reescritos.
- `e2e/permisos.spec.ts` (sin correr): fuera `nav-produccion` de los ocultos.
- `tests/unit/app-sidebar.test.tsx`, `tests/unit/clientes-ui/private-nav-clientes.test.ts`,
  `tests/unit/configuracion-ui/private-nav-configuracion.test.ts`,
  `tests/unit/configuracion-ui/private-nav-unidades.test.ts`,
  `tests/unit/configuracion-ui/private-nav-usuarios.test.ts`,
  `tests/unit/e2e-helpers/landing.test.ts`, `tests/unit/identity/login-action.test.ts`,
  `tests/unit/integraciones-ui/private-nav-integraciones.test.ts`,
  `tests/unit/navegacion/menu-empacador.test.ts`, `tests/unit/navegacion/private-layout-menu.test.tsx`,
  `tests/unit/proveedores/supplier-route-contract.test.ts`, `tests/unit/shell/nav-iconos.test.ts`.

Creados:
- `tests/unit/navegacion/orden-secciones.test.ts`
- `tests/unit/navegacion/orden-secciones-dom.test.tsx`

## Criterio -> test
- Orden de secciones y entradas: `orden-secciones.test.ts` > «con todos los permisos: Seguimiento,
  Operación, Producción, Directorio y Configuración, cada una con sus entradas en orden»;
  `orden-secciones-dom.test.tsx` > «con todos los permisos se dibujan las cinco secciones en orden»;
  `app-sidebar.test.tsx` > «renderiza una entrada por cada item de PRIVATE_NAV_ITEMS y en su orden».
- Secciones vacías ocultas: `orden-secciones.test.ts` > «con los permisos del Operador solo queda
  Operación, sin encabezados de las demas» y «ninguna seccion de ningun rol del seed queda vacia»;
  `orden-secciones-dom.test.tsx` > «con los permisos del Operador solo se dibuja el encabezado de Operación».
- Destino tras el login por rol: `orden-secciones.test.ts` > «%s aterriza en su ruta»
  (Administrador `/dashboard`, Operador `/inventario`, Empacador y Acondicionamiento `/asignacion`),
  «Maestro no ve ningun enlace del menu…» (null -> respaldo), «con todos los permisos aterriza en
  el dashboard», «la tabla cubre todos los roles del seed».
- Tests de aterrizaje ajustados: `menu-empacador.test.ts` (Operador -> `INVENTORY_ROUTE`),
  `login-action.test.ts` (todos los permisos -> `DASHBOARD_ROUTE`), `landing.test.ts` (Operador
  -> `INVENTORY_ROUTE`).

## Salida de verificacion
- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errors, 7 warnings (no-unused-vars en `confirm-catalog-import.test.ts` y
  `order-service.test.ts`, ajenos).
- `pnpm exec vitest run` (75 archivos que tocan la navegacion + 2 nuevos): Test Files 77 passed
  (77); Tests 1249 passed | 48 skipped (1297).
- `./init.sh` (rapido): Test Files 115 passed (115); Tests 1623 passed | 37 skipped; `== init OK ==`.

## Veredicto
Menu reordenado en cinco secciones, «Cadena» eliminada, aterrizaje derivado del orden y fijado por tests; gate rapido en verde.

## Vuelta 2 (review 1)

### B1: E2E que esperaban al Operador en `/asignacion`
- `e2e/permisos.spec.ts`: ahora comprueba el aterrizaje nuevo (`waitForURL` a `INVENTORY_ROUTE` +
  `inventario-title`). Cambian el título del test («aterriza en inventario»), la cabecera que
  explicaba por qué aterrizaba en `/asignacion` y el import (`ASSIGNED_ORDERS_ROUTE` pasa a `INVENTORY_ROUTE`).
- Tras el `loginAndLand` del Operador va `await page.goto(ASSIGNED_ORDERS_ROUTE);`, el patrón de
  `operario-rediseno:625` y `pedidos-asignados:757`, en los 11 sitios del review:
  `ejecucion-receta:692`, `empaque:590`, `operario-rediseno:834` y `:1117`, `pasos-de-envasado:541`,
  `pedido-bloqueado:461` (más el import de `ASSIGNED_ORDERS_ROUTE`), `pedidos-asignados:348`,
  `pedidos-terminados:466`, `producto-terminado:659`, `registro-ejecucion:121`, `reserva-de-material:703`.
- Casos extra que salieron al barrer `e2e/`:
  - `envases-del-pedido:615` y `pedido-en-varias-presentaciones:316`: `switchUser(page, operatorUser)`
    (que llama a `loginAndLand`) seguido de `asignacion-title`.
  - `operario-rediseno:885` (R41): `loginAndLand(operatorUser)` y luego busca la tarjeta del pedido
    en la lista, sin comprobar el título.
- Títulos y comentarios que quedaban falsos: `pedidos-terminados:463` («abre /asignacion en «Mis
  asignados»»), `pedidos-asignados:327` («abre asignacion»), y el comentario «Nunca una ruta escrita
  a mano…» de `ejecucion-receta` y `pedidos-asignados`.
- Barrido sin cambios necesarios: Empacador y Acondicionamiento siguen aterrizando en `/asignacion`
  (`acondicionamiento:405`, `acondicionar-con-equipo:413`, `pedidos-terminados:502`).
  `operario-rediseno:1182` y `:1290` abren la pantalla con `openScreen`. Ningún usuario con todos los
  permisos espera `/asignacion` tras el login.

### m1: icono `factory`
Borrado de `NavIconName` (`private-nav.ts`) y de `NAV_ICONS` (`nav-icons.ts`, junto con su import de
`Factory`). La fixture de `tests/unit/navegacion/nav-filtrado.test.ts` usa ahora `puzzle`. Ningún otro
test lo nombraba.

### m3: finales de línea
Bytes `\r` contados con `tr -cd '\r' | wc -c` (el `grep -c $'\r$'` de Git Bash no es fiable), en
`git show f08edc0e~1:<archivo>` y en el árbol, para todos los archivos de f08edc0e y de esta vuelta.
Solo `e2e/permisos.spec.ts` era CRLF (270 `\r`) y f08edc0e lo había pasado a LF. Vuelve a CRLF
(269 `\r` en 269 líneas) y queda en el índice como blob CRLF
(`git hash-object -w --no-filters` + `git update-index --cacheinfo`). Comprobado que un
`git add` posterior lo deja en CRLF, porque con `text=auto` git no normaliza un archivo que en el
índice ya tiene CRLF. Los demás eran LF y siguen en LF. `git diff f08edc0e~1 --stat`:
`e2e/permisos.spec.ts | 19`. Ningún archivo sale reescrito entero.

### Verificación
- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: `✖ 7 problems (0 errors, 7 warnings)`, ajenos (`confirm-catalog-import.test.ts`, `order-service.test.ts`).
- `pnpm exec vitest run` (navegación, iconos, sidebar, private-nav-*, landing): `Test Files 77 passed (77)`, `Tests 1194 passed | 36 skipped (1230)`.
- `pnpm exec vitest related --run nav-icons.ts private-nav.ts nav-filtrado.test.ts`: `Test Files 130 passed (130)`, `Tests 2017 passed | 22 skipped (2039)`.
- E2E en local: Docker `quimicloude-pg17` (5433). La base es `quimicloude_e2e_qc285`, copia de la plantilla
  `qct_tpl_7a4e460feb0b` (`pnpm run db:test template`: 91 migraciones y seed), igual que el job E2E de CI.
  Chromium y WebKit.
  - Corrida 1, `permisos` + `pedidos-asignados`: `Running 10 tests using 6 workers` / `10 passed (1.1m)`.
    `permisos` 2 ok, `pedidos-asignados` 8 ok.
  - Corrida 2, las otras 12 specs tocadas (incluye otra vez `pedidos-asignados`): `Running 86 tests using 6 workers` /
    `1 failed` / `85 passed (9.0m)`. Por spec: `ejecucion-receta` 7 ok y 1 x, `empaque` 2, `envases-del-pedido` 4,
    `operario-rediseno` 40, `pasos-de-envasado` 2, `pedido-bloqueado` 2, `pedido-en-varias-presentaciones` 4,
    `pedidos-asignados` 8, `pedidos-terminados` 8, `producto-terminado` 2, `registro-ejecucion` 4,
    `reserva-de-material` 2.
  - El rojo: `[webkit] ejecucion-receta.spec.ts:775` (R13 R15 R18 R22 R35), `page.waitForURL: Timeout 60000ms`
    en la l.878, tras finalizar el pedido. Ese caso no pasa por la lista: entra directo a
    `assignedOrderRoute(orderId)`. Repetido solo (`e2e/ejecucion-receta.spec.ts:775`): `2 passed (43.1s)`.
    Es un flake de saturación con 6 workers, ajeno al cambio.
- `./init.sh` (rápido): related `Test Files 130 passed (130)` / `Tests 2017 passed | 22 skipped`;
  siempre `Test Files 115 passed (115)` / `Tests 1623 passed | 37 skipped`; `== init OK ==`.
  Avisos amarillos ajenos: la base de desarrollo va 1 migración atrás y hay 6 worktrees.

### Veredicto (vuelta 2)
B1, m1 y m3 arreglados. Las 13 specs E2E tocadas pasan en local en Chromium y WebKit (un flake de WebKit ajeno, verde al repetirlo) y el gate rápido está en verde.
