# review QC-244 — menu-clientes-desplegable

Reviewer, 2026-10-19. Vuelta 1, completa. Diff `origin/dev...HEAD` (`d211efba`, `b1e40c42`,
`528321f5`; `c334e21d` es merge de `dev`). Grafo no consultado: el diff es pequeño y se leyó entero
con Grep/Read.

## Verificación ejecutada por el reviewer

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | exit 0, `0 errors, 10 warnings`; ningún aviso en archivos del diff |
| `vitest run` (ui + node) sobre los 7 tests del diff + `clientes-convenciones`, `customers-route-contract`, `clientes-page`, `qc75-convenciones` | 11 files, 205 passed / 6 skipped, 0 rojos |
| `vitest run` sobre `app-sidebar`, `sidebar-*`, `private-nav-integraciones`, `menu-recortado`, `private-layout-menu`, `integration-routes` | 11 files, 130 passed, 0 rojos |
| `pnpm exec vitest run guard` | 1.ª corrida: 1 rojo (no identificado, con otra carga en paralelo); 2.ª y 3.ª: 81/81 files, 1106 passed / 20 skipped |
| Playwright | **No corrido** (por instrucción: falta `.env` en el worktree) |

## Checklist

### Trazabilidad (R1–R15)

- [x] R1: `private-nav-clientes.test.ts` (3 casos R1: forma, posición tras Proveedores y último de
  Directorio, ningún link de nivel superior a `CUSTOMERS_ROUTE`); `nav-iconos.test.ts` (tabla con `square-user`).
- [x] R2: `private-nav-clientes.test.ts` (`toEqual` exacto de los dos hijos, sin icono ni sección; unicidad en el aplanado); `nav-iconos.test.ts` (`SIN_ICONO` y forma R3).
- [x] R3: `private-nav-clientes.test.ts` (`it.each` por hijo; lee `requirePagePermission` de la `page.tsx` derivada del `href` y exige `[permission]`); `contactos-page.test.tsx` (corte único y primera sentencia).
- [x] R4: unit con permisos del Administrador del seed; E2E caso Administrador (pendiente de correr).
- [x] R5: unit `it.each` sobre roles del seed sin el permiso, con ancla anti-vacuidad y `JSON.stringify` sin etiquetas, rutas ni testIds; E2E R42 ampliado (pendiente de correr).
- [~] R6: **solo E2E** (`clientes.spec.ts`, caso Administrador: `aria-expanded`, hijos visibles, navegación a cada hijo). Test real y no vacío, pero **sin salida todavía**. Ver «Pendiente de verificación».
- [x] R7: `contactos-page.test.tsx` (texto anclado al literal, un único `h1`, sin `a/button/form/input/select/textarea`, sin `params`/`searchParams`, imports exactos, sin comentarios).
- [x] R8: `contactos-page.test.tsx` (`notFound` y nada pintado); E2E 404 + `private-not-found` + palabras prohibidas (pendiente de correr).
- [x] R9: `contactos-page.test.tsx` (`redirect(LOGIN_ROUTE_SESSION_ENDED)`); `customer-contacts-route-contract.test.ts` (`decideRouteAccess` con los prefijos reales).
- [x] R10: `customer-contacts-route-contract.test.ts` (valor, derivada de `CUSTOMERS_ROUTE`, barrido de `lib/ app/ components/` con caso de sensibilidad, `PRIVATE_ROUTE_PREFIXES` sin fila); `guard-rutas-privadas-cubiertas` verde.
- [x] R11: `contactos-page.test.tsx` (h1 y metadata por constante; ni la página ni sus textos escriben «Contactos»).
- [x] R12: «R3, R12, R14» sobre `nav-clientes-lista` contra `app/(private)/clientes/page.tsx`; `clientes-page.test.tsx` verde; `app/(private)/clientes/**` fuera del diff.
- [x] R13: `private-nav-clientes.test.ts` (aterrizaje por rol con grupo / sin grupo / con el enlace de antes; orden exacto de los 13 testIds de nivel superior; orden de secciones); `orden-secciones.test.ts`.
- [x] R14: las cuatro guardias verdes, sin excepción nueva (`/clientes/contactos` entra como **entrada** de `RUTAS_ESPERADAS_HOY`).
- [x] R15: el diff no toca `lib/modules/**`, `lib/composition/**`, `db/**`, `middleware.ts`, `components/**` ni `package.json` (verificado con `git diff --stat`); `qc75-convenciones` verde (catálogo exacto de permisos).

### Anclas tensadas, no aflojadas

- [x] `guard-nav-permisos-declarados`: `toHaveLength(16)` + `toEqual` de la lista ordenada exacta (sale `nav-clientes`, entran `nav-clientes-contactos` y `nav-clientes-lista`).
- [x] `guard-pantallas-exigen-permiso`: `RUTAS_ESPERADAS_HOY` 29 → 30 con `toEqual` exacto.
- [x] `nav-iconos`: `SIN_ICONO` suma los dos hijos (cada uno exige `destino` definido); la forma R3 sigue con `toEqual` exacto de las 18 filas, grupo incluido.
- [x] `orden-secciones`: `toEqual` exacto, Directorio = `[SUPPLIERS_ROUTE, 'nav-clientes']` (la clave de un grupo es su testId, igual que `nav-integraciones`).
- [x] `scope.test.ts` R26: admisión por **ruta exacta** (`PANTALLA_CONTACTOS_PERMITIDA`), sin carpeta; caso de sensibilidad nuevo que prueba que un literal en `contactos/components/` sí dispara.
- [x] `recipe-route-contract.test.ts`: alta de `CUSTOMER_CONTACTS_ROUTE` en el censo; la lista sigue cerrada.

### E2E (`e2e/clientes.spec.ts`, `e2e/movimiento.spec.ts`), revisión estática

- [x] `clientes.spec.ts`: caso nuevo del Administrador según §7.1 (incluye guardia de que el aterrizaje no es un hijo del grupo, `aria-expanded`, `waitForURL` por constante, 200 en `goto`). R42 ampliado con los tres `toHaveCount(0)` y el 404 de contactos con las mismas palabras prohibidas. Cabecera reescrita. Sin literales de ruta.
- [x] `movimiento.spec.ts`: `NAV_CUSTOMERS_TESTID = 'nav-clientes-lista'`; `indicatorFit` y `watchSlide` buscan la lista más cercana (`sidebar-menu-sub` o `sidebar-menu`); el deslizamiento pasa a ser entre hermanos de la sublista; la entrada de pantalla se mide en contactos (`PageHeader` + `EmptyState` son los dos hijos de `PageShell`, y `globals.css` anima `[data-screen-enter] > * > :nth-child(n)`); paso a Proveedores antes del modo icono. No se quitó ninguna aserción.
- [x] `marca-componentes.spec.ts` (`FIRST_GROUP`, ahora Clientes): sin cambios; entra en el aterrizaje del Administrador (`/dashboard`), así que el grupo no arranca activo. Coherente con el hallazgo 9 del design.
- [x] Los proyectos de Playwright son solo de escritorio (Chromium y WebKit): el sidebar está visible en los dos.

### CHECKPOINTS.md

- [x] requirements EARS numerados R1–R15.
- [x] design con alternativas descartadas (§10, ocho).
- [ ] tasks todas `[x]`: **T9, T10 y T11 siguen `[ ]`**, esperando el E2E local y `./init.sh`. Ver «Pendiente».
- [x] `## Lo que ya existe` presente, no vacía; el diff no re-crea nada de la lista (reutiliza `PageShell`/`PageHeader`/`EmptyState`, `NavGroupInline`/`NavGroupFloating`, `filterNavItemsByPermissions`, `firstVisibleNavHref`; no importa ni copia `IntegrationPlaceholder`).
- [ ] Equipo (assignee y `wt.sh new`): no verificable desde aquí; lo valida el candado del leader.
- [x] Mapa `R<n> -> test` en `progress/impl_QC-244-menu-clientes-desplegable.md`, con los nombres reales.
- [x] typecheck y lint sin errores.
- [ ] `gate-completo` en CI: lo corre CI en el PR.
- [ ] Flujo crítico (permisos) con E2E **y su salida local en la bitácora**: el E2E existe; falta la salida. Ver «Pendiente».
- [x] Sin dependencias nuevas.
- [x] Sin secretos ni configuración hardcodeada; no hay webhooks.
- [ ] `./init.sh` y cierre de la feature: del leader.

### docs/checkpoints-proyecto.md

- [x] E2E de flujo crítico en Playwright.
- [x] Multiplataforma: no hay controles nuevos, ni `100vh`, ni `:hover` como única vía (§5.3).
- [x] Catálogo: no se crea, sube, extiende ni borra ninguna pieza de `components/ui`, `components/shared`, `lib/shared/ui` ni `hooks`.
- [x] Pase `/design`: no hay componente nuevo ni cambio visual de uno existente (página compuesta de piezas catalogadas; el grupo es un dato más para `NavGroupInline`).
- [x] Datos y seguridad: no hay tablas, consultas, migraciones ni permisos nuevos. El corte de página es `requirePagePermission` en el servidor.
- [x] Módulos hexagonales: `lib/shared/**` sigue siendo hoja (`routes.ts` y `private-nav.ts` no importan módulos). La página importa el adaptador `driving` `require-page-permission`, igual que el resto de páginas privadas.
- [x] Permisos: la página valida en servidor; sin `private/` nuevos; sin mutaciones.

### Reglas del proyecto (perfil-agentes > reviewer, 5–11)

- [x] 5. Calidad y seguridad: sin RLS ni webhooks en juego; capas separadas; sin hardcode de contexto.
- [x] 6. Multiplataforma: nada nuevo que revisar.
- [x] 7. Dependencias: `package.json` fuera del diff.
- [x] 8. Aislamiento por empresa: sin modelos ni consultas.
- [x] 9. Comentarios de producción añadidos o modificados (`routes.ts`, `private-nav.ts`): ninguno cita `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada». `page.tsx` y `contact-texts.ts` sin comentarios.
- [x] 10. Duplicados: ningún componente nuevo.
- [x] 11. Diseño: ningún componente nuevo ni cambio visual.

## Hallazgos

1. **menor**: en la primera corrida de `pnpm exec vitest run guard` salió 1 rojo que no reapareció
   en dos corridas más (81/81). No quedó capturado cuál era. Se corrió con carga en paralelo y la
   bitácora ya anota un timeout del mismo tipo en otro archivo. No apunta a esta ficha, pero si
   `gate-completo` saca un rojo en guardias, empezad por aquí.
2. **menor**: R6 solo lo cubre el E2E. Es lo correcto para un comportamiento de interacción, pero
   hasta que el E2E corra, R6 no tiene ninguna evidencia ejecutada (unit o e2e).

No hay hallazgos bloqueantes.

## Pendiente de verificación (no son hallazgos del código)

- **Correr en local** `pnpm exec playwright test e2e/clientes.spec.ts e2e/movimiento.spec.ts`
  (Chromium y WebKit; `movimiento` en sus dos modos). Hay que pegar la salida en
  `progress/impl_QC-244-menu-clientes-desplegable.md` y marcar T9 y T10. Bloqueado porque el
  worktree no tiene `.env`; lo está resolviendo el humano. Es condición de cierre:
  `CHECKPOINTS.md > Calidad de codigo > flujo critico` y `tasks todas [x]`.
- **T11**: `./init.sh` y `gate-completo` en el PR.
- Si el E2E sale rojo, se reabre la revisión, acotada a los cambios que haga falta.

## Veredicto

**OK**: no hay bloqueantes en el código ni en los tests. El cierre de la feature queda
condicionado a lo pendiente de arriba: E2E local en verde con su salida en la bitácora, T9–T11 en
`[x]` y `gate-completo` en verde.
