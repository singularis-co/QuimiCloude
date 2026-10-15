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
