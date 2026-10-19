# impl QC-244 — menu-clientes-desplegable

Implementer, 2026-10-19. Worktree `.worktrees/QC-244-menu-clientes-desplegable`, rama
`feature/QC-244-menu-clientes-desplegable`. Todo es `[FRONT]`, hecho por `frontend_dev`. No hubo
`backend_dev`.

## Commits

- `c334e21d`: merge de `origin/dev` (T0). Solo trajo `e2e/maestro-modulos.spec.ts` y archivos del
  maestro; nada de §6.2 ni §6.3 y ninguna migración.
- `d211efba` feat(QC-244): el grupo Clientes con Contactos, su página cascarón, y los tests
  unitarios y de guardias (T1–T8).
- `b1e40c42` feat(QC-244): los E2E del grupo y del indicador en el submenú (T9–T10, escritos).

## T0: medición contra `dev` sincronizado

- **Cifras de §6.2: coinciden.**
  - `guard-nav-permisos-declarados`: ancla de 15.
  - `RUTAS_ESPERADAS_HOY`: 29.
  - `nav-iconos`: `SIN_ICONO` con los 3 hijos de Integraciones y la forma de R3 como se describe.
  - `orden-secciones`: Directorio = `[SUPPLIERS_ROUTE, CUSTOMERS_ROUTE]`.
- **Casos de §6.3: existen.**
  - `scope.test.ts` R26, con `PANTALLA_PERMITIDA` por ruta exacta.
  - `recipe-route-contract.test.ts`, el censo cerrado de exports.
- **Otros censos cerrados de `routes.ts` o `private-nav.ts`: ninguno.**
  - `integration-routes.test.ts` solo censa `/integraciones`.
  - `app-sidebar.test.tsx` usa `not.arrayContaining`.
- **Indicador del submenú (§7.2): confirmado.**
  - En `NavGroupInline` (`components/private/app-sidebar.tsx:300-316`), `<SidebarActiveIndicator variant="sub">` envuelve `<SidebarMenuSub>` (`data-slot="sidebar-menu-sub"`).
  - El `SidebarMenuSubButton` lleva `data-active` igual que el botón de primer nivel.
  - `e2e/movimiento.spec.ts` tenía la forma que describe §7.2.
- **Línea base, antes de tocar nada:** 21 archivos (los «siguen verdes» de §6.2 más los de §6.2, §6.3 e `integration-routes`). Test Files 21 passed (21), Tests 299 passed | 21 skipped.
- **Preparación del worktree:** `pnpm install --frozen-lockfile` (sin dependencias nuevas), `prisma generate` y `next typegen`.

## Archivos

**Producción**
- `lib/shared/routes.ts`: `CUSTOMER_CONTACTS_ROUTE = \`${CUSTOMERS_ROUTE}/contactos\``. `PRIVATE_ROUTE_PREFIXES` sin diff.
- `lib/shared/navigation/private-nav.ts`: el import, `CUSTOMER_CONTACTS_LABEL`, el `NavGroup` `nav-clientes` en la misma posición y su comentario.
- `app/(private)/clientes/contactos/page.tsx` (nuevo)
- `app/(private)/clientes/contactos/components/index.ts` (nuevo)
- `app/(private)/clientes/contactos/components/contact-texts.ts` (nuevo; el texto lleva punto final, P3)

**Tests**
- Nuevos: `tests/unit/clientes-ui/contactos-page.test.tsx` y `tests/unit/clientes-ui/customer-contacts-route-contract.test.ts`.
- Reescrito: `tests/unit/clientes-ui/private-nav-clientes.test.ts`.
- Tensados:
  - `tests/guards/guard-nav-permisos-declarados.test.ts`: 15 → 16.
  - `tests/guards/guard-pantallas-exigen-permiso.test.ts`: 29 → 30.
  - `tests/unit/shell/nav-iconos.test.ts`
  - `tests/unit/navegacion/orden-secciones.test.ts`
- Enmiendas de alcance:
  - `tests/unit/clientes/scope.test.ts`: ruta exacta y un caso de sensibilidad nuevo.
  - `tests/unit/recetas-ui/recipe-route-contract.test.ts`: alta en el censo.
- E2E: `e2e/clientes.spec.ts` y `e2e/movimiento.spec.ts`.

**Spec y progreso**
- `specs/QC-244-menu-clientes-desplegable/tasks.md`
- `progress/features/QC-244.md`
- Esta bitácora.

Ningún archivo queda fuera de `tasks.md > Archivos esperados`. No se tocan:
- `components/**`, `lib/modules/**`, `lib/composition/**`, `db/**`;
- `middleware.ts` ni `package.json`.

## Mapa R<n> -> test

| R | Test (nombre real del caso) |
|---|---|
| R1 | `private-nav-clientes.test.ts`: «R1: hay un solo NavGroup con testId nav-clientes, con su etiqueta, icono y seccion», «R1: va justo detras del enlace de proveedores y es el ultimo de «Directorio»», «R1: ningun enlace de nivel superior apunta ya a CUSTOMERS_ROUTE»; `nav-iconos.test.ts`: «R2: nav-clientes se dibuja con square-user» |
| R2 | `private-nav-clientes.test.ts`: «R2: el grupo tiene exactamente dos hijos, en orden, sin icono ni seccion», «R2: cada destino y cada testId del grupo aparece una sola vez en el menu aplanado»; `nav-iconos.test.ts`: «R2: los hijos de grupo siguen sin icono», «R3: etiqueta, ruta, testId, permiso, sección y orden de cada destino» |
| R3 | `private-nav-clientes.test.ts`: «R3: el grupo tiene hijos que comparar», «R3, R12, R14: %s declara el mismo y unico codigo que exige la page.tsx de su destino» (para `nav-clientes-lista` y `nav-clientes-contactos`); `contactos-page.test.tsx`: «R3: exige clientes.consultar una sola vez y como primera sentencia»; `scope.test.ts`: «R3, R14 — el literal en app/(private)/clientes/contactos/components/ SI dispara: la admision es solo su page.tsx» |
| R4 | `private-nav-clientes.test.ts`: «R4: con los permisos del Administrador el menu filtrado tiene el grupo con sus dos hijos»; `e2e/clientes.spec.ts`: «el Administrador despliega «Clientes» en el menu, ve sus dos hijos y navega a Contactos y de vuelta a la lista (R4, R6, R7)» |
| R5 | `private-nav-clientes.test.ts`: «R5: ancla: el Administrador tiene el permiso y al menos un rol del seed no lo tiene», «R5: %s, sin el permiso, no recibe el grupo ni nada suyo en lo serializado» (Operador, Empacador, Maestro, Administrador de acondicionamiento); `e2e/clientes.spec.ts`: «una sesion valida sin `clientes.consultar` recibe 404 dentro del layout privado y no ve la tabla (R42, R5, R8)» |
| R6 | `e2e/clientes.spec.ts`: el caso del Administrador (R4, R6, R7) |
| R7 | `contactos-page.test.tsx`: «R7: el texto del estado vacio es el acordado», «R7, R11: con el permiso pinta un unico h1 con la etiqueta de Contactos y el estado vacio», «R7: no pinta enlace, boton, formulario ni campo», «R7: no declara params ni searchParams, no tiene comentarios y solo importa sus piezas»; `e2e/clientes.spec.ts`: el caso del Administrador |
| R8 | `contactos-page.test.tsx`: «R8: con sesion sin el permiso responde notFound y no pinta nada»; `e2e/clientes.spec.ts`: el caso R42 ampliado (404 en `CUSTOMER_CONTACTS_ROUTE`) |
| R9 | `contactos-page.test.tsx`: «R9: sin sesion redirige al login con la marca de sesion terminada»; `customer-contacts-route-contract.test.ts`: «R9: sin sesion, el borde redirige al login con los prefijos reales» |
| R10 | `customer-contacts-route-contract.test.ts`: «R10: la constante vale /clientes/contactos», «R10: routes.ts la construye desde CUSTOMERS_ROUTE, sin escribir la URL entera», «R10: ningun archivo de lib/, app/ ni components/ lleva la URL entera entre comillas», «R10: el barrido caza un literal en codigo e ignora uno en comentario», «R10: la page.tsx vive en la carpeta derivada de la constante», «R10: PRIVATE_ROUTE_PREFIXES no la contiene y CUSTOMERS_ROUTE sigue una sola vez»; `guard-rutas-privadas-cubiertas` |
| R11 | `contactos-page.test.tsx`: «R7, R11: …un unico h1…», «R11: la metadata sale de la etiqueta de Contactos y la marca», «R11: la pagina y sus textos no escriben la etiqueta de Contactos como literal» |
| R12 | `private-nav-clientes.test.ts`: «R3, R12, R14: nav-clientes-lista …»; `clientes-page.test.tsx` y `e2e/clientes.spec.ts` R41 sin cambios |
| R13 | `private-nav-clientes.test.ts`: «R13: %s aterriza igual con el grupo, sin el y con el enlace de antes» (5 roles del seed), «R13: el orden y los testId de los items de nivel superior son los de antes», «R13: el orden de las secciones es el de antes»; `orden-secciones.test.ts`; `e2e/movimiento.spec.ts`: «R13, R15, R19, R20, R21: indicador del item activo y entrada de pantalla ${mode}» |
| R14 | `guard-nav-permisos-declarados`: «ancla: el recorrido encuentra hoy los dieciseis enlaces reales del menu»; `guard-pantallas-exigen-permiso`: «el barrido encuentra exactamente las treinta pantallas privadas de hoy»; `guard-rutas-privadas-cubiertas`, `guard-nav-serializable`; «R3, R12, R14» de `private-nav-clientes.test.ts` |
| R15 | `qc75-convenciones.test.ts` (catálogo exacto de permisos); `guard-dependencias-aprobadas`; revisión del diff contra `tasks.md > Archivos esperados` |

## Salida de los tests

**Typecheck y lint**
- `pnpm run typecheck` → `tsc --noEmit`, exit 0. Se corrió tras T8 y otra vez tras T10.
- `pnpm run lint` → `✖ 10 problems (0 errors, 10 warnings)`, exit 0. Ninguno de los avisos es de archivos de esta ficha.
- `pnpm exec eslint e2e/clientes.spec.ts e2e/movimiento.spec.ts` → sin errores ni avisos.

**Guardias:** `pnpm exec vitest run guard` → `Test Files 81 passed (81)`, `Tests 1106 passed | 20 skipped`.

**`vitest related` sobre los 14 archivos tocados (`--project ui --project node`)**
- Resultado: `Test Files 1 failed | 451 passed (452)`, `Tests 1 failed | 7479 passed | 46 skipped`.
- El rojo es `tests/unit/recetas-ui/formula-import-review.test.tsx`, en el caso «una descripcion de mas de 500 caracteres se marca», con `Test timed out in 20000ms`.
  - Ocurrió con otra corrida en paralelo. Corrido solo: 34/34 en verde.
  - No importa nada de esta ficha.
- Cómo se lanzó y por qué:
  - **Sin el proyecto `integration`**, porque su `globalSetup` exige `DATABASE_URL`: «test-db: falta DATABASE_URL» en el primer intento. El worktree no tiene `.env` y, por indicación del leader, no se lee ni se copia.
  - **Con rutas absolutas**: con rutas relativas en Windows, `related` puede responder «No test files found».
- Archivos tocados más el barrido de §6.2, corridos directamente: 31 archivos, `461 passed | 23 skipped`, 0 rojos.

## E2E: pendiente en local

La ficha toca **permisos**, un flujo crítico (`docs/checkpoints-proyecto.md > Flujos criticos`).
Hay que correr:

    pnpm exec playwright test e2e/clientes.spec.ts e2e/movimiento.spec.ts

**No se han corrido.**
- El worktree no tiene `.env`.
- El leader indicó que no se leyera ni se copiara: se lo consulta al humano.
- Hasta que se corran en verde en Chromium y WebKit, T9 y T10 quedan `[ ]` en `tasks.md` («escrito; falta correrlo en local»).
- El reviewer no tiene salida E2E que mirar.

## Pendiente para el leader

- Los E2E en local (arriba).
- `./init.sh` y el gate (T11), que corre el leader.
