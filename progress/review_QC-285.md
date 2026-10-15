# review QC-285 — secciones-del-sidebar (vuelta 1)

Rama `feature/QC-285-secciones-del-sidebar` frente a `origin/dev` (commits c1aa2421..8db6a616).
Sin SDD: el spec es el issue + `progress/features/QC-285.md > Decisiones` + los 5 criterios del leader.

## Veredicto: RECHAZADO

1 hallazgo BLOQUEANTE, 3 menores.

## Verificación ejecutada por el reviewer
- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores, 7 warnings ajenos.
- `vitest run tests/guards` + los 14 tests tocados por el diff: 82 archivos, 1144 passed / 14 skipped.
- `vitest related --run lib/shared/navigation/private-nav.ts`: 130 archivos, 2017 passed / 22 skipped.
- E2E: no lo corrí (lo corre el CI). Lo leí: ver el hallazgo B1.

## Mapa criterio → test
| # | Criterio | Test | Estado |
|---|---|---|---|
| 1 | Orden exacto de las cinco secciones y sus entradas; «Cadena» desaparece | `tests/unit/navegacion/orden-secciones.test.ts` > «con todos los permisos: Seguimiento, Operación, Producción, Directorio y Configuración…» (`toEqual` exacto sobre las secciones y los items); `orden-secciones-dom.test.tsx` > «con todos los permisos se dibujan las cinco secciones en orden»; `app-sidebar.test.tsx` (lista del DOM a mano y centinela de 11 entradas) | OK |
| 2 | Rutas y permisos sin cambios | `tests/unit/shell/nav-iconos.test.ts` > «R3: etiqueta, ruta, testId, permiso, sección y orden…» (tabla a mano). La comparé con `origin/dev` y href y permission coinciden en las 14 entradas; solo cambian `section` y el orden. Fórmulas conserva `/produccion/formulas` + `recetas.consultar` | OK |
| 3 | Sección sin entradas visibles → sin encabezado | `orden-secciones.test.ts` > «con los permisos del Operador solo queda Operación…» y «ninguna seccion de ningun rol del seed queda vacia»; `orden-secciones-dom.test.tsx` > «…solo se dibuja el encabezado de Operación» (DOM, `private-nav-section`) | OK |
| 4 | Aterrizaje = primer enlace visible | `orden-secciones.test.ts` > «%s aterriza en su ruta» (Admin `/dashboard`, Operador `/inventario`, Empacador y Acondicionamiento `/asignacion`), «Maestro… null», «con todos los permisos aterriza en el dashboard», «la tabla cubre todos los roles del seed». Respecto a dev, Admin/Empacador/Acond./Maestro no cambian (lo comprobé con el orden y el seed de dev) | OK en unit; **E2E roto, ver B1** |
| 5 | Tests y guardias sin relajar los asserts | login-action, menu-empacador, landing.test, nav-iconos, private-layout-menu, private-nav-*: solo se mueve el valor esperado. Las listas siguen siendo exactas (`toEqual`, `toHaveLength`). El caso R11 de login-action («entra en el grupo… hijo») pasa a usar el grupo Integraciones y sigue probando lo mismo. Los asserts del grupo `nav-produccion` se borran porque el grupo ya no existe, y la nueva suite los sustituye | OK en unit; **`e2e/permisos.spec.ts` incompleto, ver B1** |

## Hallazgos

### B1 — BLOQUEANTE: los E2E siguen esperando que el Operador aterrice en `/asignacion`
Con el orden nuevo, el Operador del seed aterriza en `/inventario` (decisión «opción 2»). Pero
11 specs E2E crean un usuario con `ROLE_OPERADOR` real, hacen login y esperan **sin `goto`** estar
en `/asignacion`:
- `e2e/permisos.spec.ts:214-215`: `waitForURL(pathname === ASSIGNED_ORDERS_ROUTE)` + `asignacion-title`.
  El título del test (`:200`, «aterriza en asignacion») y el comentario de `:212` también quedan
  falsos. Es justo el archivo que el implementer tocó, y solo para quitar `nav-produccion`.
- `loginAndLand(page, operatorUser|actorUser)` seguido de `expect(asignacion-title).toBeVisible()`:
  - `e2e/ejecucion-receta.spec.ts:692-693`
  - `e2e/empaque.spec.ts:590-591`
  - `e2e/operario-rediseno.spec.ts:834-835` y `:1117-1118`
  - `e2e/pasos-de-envasado.spec.ts:541-542`
  - `e2e/pedido-bloqueado.spec.ts:461-462`
  - `e2e/pedidos-asignados.spec.ts:348-349` (`actorUser`, rol Operador, `:240`)
  - `e2e/pedidos-terminados.spec.ts:466-467`
  - `e2e/producto-terminado.spec.ts:659-660`
  - `e2e/registro-ejecucion.spec.ts:121-122`
  - `e2e/reserva-de-material.spec.ts:703-704`

`loginAndLand` lleva bien al destino derivado (`/inventario`), pero entonces `asignacion-title` no
aparece y el caso se pone rojo por timeout. Esto rompe el E2E del PR a producción y afecta a flujos
críticos: permisos y movimientos de inventario (reserva de material, producto terminado). Además
falla `CHECKPOINTS.md` l.27: la feature toca el flujo crítico de permisos/aterrizaje y
`progress/impl_QC-285.md` no trae ninguna salida de E2E local.

**Qué falta:**
- En `permisos.spec.ts`, afirmar el aterrizaje nuevo (`INVENTORY_ROUTE` + un testId del título de
  inventario) y renombrar el test y su comentario.
- En el resto, después de `loginAndLand` navegar explícitamente a `ASSIGNED_ORDERS_ROUTE`, como ya
  hacen `operario-rediseno.spec.ts:625`, `:775` y `pedidos-asignados.spec.ts:757`. Ojo: esos
  comentarios dicen «nunca una ruta escrita a mano», pero eso se refiere al destino del login,
  no a la pantalla que se quiere ejercitar.
- Correr en local al menos `e2e/permisos.spec.ts` y uno de los flujos de asignación, y pegar la
  salida en la bitácora.

### m1 — menor: el icono `factory` queda sin usar
`lib/shared/navigation/private-nav.ts:165` (`| 'factory'` en `NavIconName`) y
`lib/shared/navigation/nav-icons.ts:48` (`factory: Factory`). Ya ninguna entrada lo usa (era el del
grupo `nav-produccion`) y `nav-iconos.test.ts` quitó su fila. Hay que borrarlo o justificar que se
queda.

### m2 — menor: «Producción» como enlace directo no figura en Decisiones
La decisión registrada dice «Producción (Fórmulas)», pero no dice si va como grupo o como enlace.
Pasar de grupo desplegable a enlace directo y retirar el testId `nav-produccion` es un cambio
visible de UI. Además contradice `specs/QC-13-guardia-de-sesion-en-navegacion/design.md:32,53` (spec
cerrado, histórico) y el canvas `docs/diseno/canvas/Sidebar.dc.html:55`, que sigue dibujando
«Cadena» > grupo Producción > Fórmulas. Busqué `nav-produccion` en app/, components/, lib/ y e2e/:
fuera de los tests tocados no rompe nada, y ningún E2E abre el grupo «Producción».
Recomendación: que el humano ratifique la decisión en `progress/features/QC-285.md > Decisiones`,
y abrir una ficha (o avisar) para el canvas.

### m3 — menor: `e2e/permisos.spec.ts` pasa de CRLF a LF
El diff marca 539 líneas por la normalización a LF (`.gitattributes` con `eol=lf`). En contenido
cambian 7 líneas. Es correcto, pero ensucia el blame y puede chocar en un merge con otra rama que
toque el archivo. Solo lo anoto.

## Checklist
- [x] Trazabilidad criterio → test (unit): los 5 criterios tienen un test real y no vacío.
- [ ] E2E coherente con el aterrizaje nuevo: **no** (B1).
- [x] Tasks: no aplica (sin SDD). La tanda está registrada en `progress/features/QC-285.md > Tandas`.
- [x] Lo que ya existe: no aplica design.md. El diff no re-crea nada: reutiliza `groupNavItemsBySection`, `firstVisibleNavHref` y los iconos existentes.
- [x] Typecheck y lint verdes, guardias y tests relacionados verdes (corridos por mí).
- [ ] CHECKPOINTS l.27, flujo crítico con E2E y su salida local: **no** (B1).
- [x] CHECKPOINTS seguridad, secretos y hardcode de entorno: sin cambios relevantes.
- [x] checkpoints-proyecto > Calidad: sin componentes nuevos ni cambios en `components/ui|shared` ni en el catálogo.
- [x] checkpoints-proyecto > Datos, Módulos y Permisos: no toca esquema, dominio ni capas. Los permisos de cada entrada no cambian.
- [x] Perfil 5 (calidad y seguridad): OK.
- [x] Perfil 6 (multiplataforma): solo cambian datos del menú. No hay CSS, hover ni targets nuevos.
- [x] Perfil 7 (dependencias): `package.json` intacto.
- [x] Perfil 8 (empresa): no aplica.
- [x] Perfil 9 (comentarios): los comentarios nuevos de `private-nav.ts` no citan `QC-<n>`, `R<n>` ni `design.md`. La limpieza de comentarios va mezclada con el cambio de código en f08edc0e, que es menor según la regla; no lo cuento aparte.
- [x] Perfil 10 (duplicados): no hay componente nuevo.
- [~] Perfil 11 (diseño): no hay componente nuevo. Quitar el desplegable de Producción es un cambio visual pequeño sin referencia de diseño, y el canvas queda desfasado: va en m2.
