# Review QC-257 — shell-rediseno

Rama `feature/QC-257-shell-rediseno` (HEAD `16ac21bd`) contra `origin/dev` (`63e8c128`, que es
también la merge-base). Revisado el 2026-10-10.

## Verificación ejecutada por el reviewer

- `./init.sh` (rápido) en el worktree: **verde** (`== init OK ==`). Typecheck y lint pasan.
  `vitest related` sobre 22 archivos del diff más las guardias: 109 archivos, 1531 tests pasan y
  35 se omiten. El único aviso es que no hay `.env`, y es ajeno al diff.
- Tests afectados que `related` puede no alcanzar: `logout-button`, `tests/unit/theme`,
  `tests/unit/shell`, `sidebar-carril`, `pedidos-viewport`, `private-nav-clientes`,
  `tests/unit/configuracion-ui` y `sidebar-active-indicator`. Resultado: 81 archivos y
  1145 tests pasan; ninguno en rojo. `pedidos-viewport` se corrió aparte: 20 de 20 pasan, sin
  avisos de React ni de act.
- `git diff origin/dev...HEAD -- package.json` está vacío (R20).
- Búsqueda de aserciones viejas sobre lo que cambia («Toggle Sidebar», `lang="en"`, `panel-left-*`,
  `'contact'`) en `tests/` y `e2e/`: no queda ninguna, salvo la nota de enmienda y una columna
  `contact` de proveedores, que no tiene que ver.
- Comentarios en las líneas añadidas a producción que citen `QC-`, `R<n>`, `design.md` o
  «decisión cerrada»: ninguno.
- El E2E no lo corrí: lo corre el CI. Tomo de la bitácora `100 passed` (chromium y webkit) y he
  leído el código de R6, R7, R17 y R19: mide de verdad y no tiene casos vacíos.

## Checklist

### CHECKPOINTS.md
- [x] `requirements.md` con R1–R21 en EARS.
- [x] `design.md` con alternativas descartadas (§10, de la A a la G).
- [x] `tasks.md`: las 29 tareas marcadas `[x]` y ninguna `[ ]`.
- [x] `design.md` abre con `## Lo que ya existe`, con búsqueda real. El diff no recrea nada de esa
      lista: reutiliza `NAV_ICONS`, `SidebarTrigger` con children, `Tooltip` y el cruce por CSS.
- [x] Assignee y candado: está el commit `chore(QC-257): feature tomada por ArqDev` y la fila de
      `progress/features/QC-257.md`.
- [x] Cada R<n> tiene un test concreto (mapa abajo). `impl_QC-257.md` contiene el mapa.
- [x] Typecheck y lint en verde.
- [ ] `gate-completo` en CI: está pendiente del PR. La bitácora anota `./init.sh --completo` verde
      tras el alta en la guardia.
- [x] No toca flujos críticos. No cambia la autenticación: el logout conserva el formulario, la
      Server Action y `useFormStatus`.
- [x] No añade dependencias.
- [x] Sin secretos ni configuración incrustada.
- [x] `./init.sh` verde en el worktree.
- [ ] `progress/features/QC-257.md > Cierre` y el desmontaje del worktree son posteriores al PR;
      los hace el leader.

### docs/checkpoints-proyecto.md
- [x] Typecheck y lint.
- [x] Multiplataforma:
  - los tres botones de la cabecera miden 44 × 44 (`size-11`);
  - el tooltip no es la única vía: el nombre accesible sigue ahí y en táctil el tooltip no abre;
  - no hay `100vh` y no hay inputs nuevos;
  - `rotate`, `scale` y `opacity` funcionan en WebKit, y el E2E pasa en webkit;
  - con movimiento reducido se cubre R19.
- [x] Catálogo: la fila `SidebarProvider`/`Sidebar` está al día. Su alcance dice que los textos
      están en español y su celda `Diseño` apunta a `docs/diseno/canvas/Sidebar.dc.html`. Ninguna
      otra pieza de `components/ui`, `components/shared`, `lib/shared/ui` ni `hooks` cambia.
      `ThemeToggle`, `LogoutButton` y `SidebarToggle` son de la ruta; `AppSidebar` es de
      `components/private`.
- [x] Pase de diseño:
  - cada cambio visual tiene su tablero en `design.md > 1`;
  - comprobé que existen `Sidebar.dc.html`, `Superficies.dc.html`, `Pedidos.dc.html` y `qc.css`, y
    que contienen `.railbtn`, `rotate:180deg`, `.tb-btn` y `<span class="tip">`;
  - la flecha del botón móvil la respalda D17 (P9), aprobada por el humano.
- [x] Datos, seguridad, módulos hexagonales y permisos: no aplican. El diff no toca la base, los
      módulos ni los permisos. `lib/shared/navigation` solo gana literales e imports de
      `lucide-react`.

### docs/perfil-agentes.md > reviewer (5–11)
- [x] 5 Calidad y seguridad: no aplica a la base y las capas no se mezclan.
- [x] 6 Multiplataforma: ver arriba.
- [x] 7 Dependencias: no hay ninguna nueva.
- [x] 8 Aislamiento por empresa: no aplica.
- [x] 9 Comentarios: ninguno prohibido en las líneas añadidas (hay un hallazgo menor, el 3).
- [x] 10 Duplicados: no hay componentes nuevos. `design.md` dice que todo cae en los pasos 1 y 2
      y descarta `ShellTooltip` compartido (alternativa F).
- [x] 11 Diseño: ver arriba.

## Trazabilidad R → test

| R | Test que lo verifica (leído) |
|---|---|
| R1 | `tests/unit/shell/nav-iconos.test.ts`: no se repite ningún nombre ni ningún componente, y todo icono tiene su fila en `NAV_ICONS` (nivel superior e hijos) |
| R2 | `nav-iconos`: `it.each` de la tabla completa (testId → nombre → componente), los hijos sin icono y la tabla cubre todos los destinos |
| R3 | `nav-iconos`: fija la forma de cada destino (etiqueta, ruta, testId, permiso, sección y orden) |
| R4 | `control-barra` R4; `sidebar-carril` R39 enmendado; `e2e/marca-componentes` R39 |
| R5 | `control-barra` R5; `sidebar-carril` R39 del encabezado |
| R6 | `control-barra` R6 ×2, con el mismo nodo `svg` y las clases de token; E2E R6 ×2, que mide el `rotate` calculado y la duración |
| R7 | E2E R7: escucha `transitionrun` desde `document_start` y revisa `getAnimations` tras cargar |
| R8 | `control-barra` R8 ×2 |
| R9 | `control-barra` R9: orden, contorno y `size-11` |
| R10, R11, R12 | `cabecera-tooltips`: puntero, `unhover` y teclado; E2E con puntero y teclado, en escritorio y a 390 px, dentro de la ventana |
| R13 | `cabecera-tooltips` R13 ×3, con `logout-button.test.tsx` y `theme/*` en verde sin tocarlos |
| R14 | `idioma` R14 (RootLayout en servidor) y E2E R14 en el login y en una pantalla privada |
| R15, R16 | `idioma` R15 y R16 ×3 |
| R17 | `tema-sol-luna` R17 ×3; E2E R17 |
| R18 | `tema-sol-luna` R18: `renderToString` da lo mismo con preferencia clara y oscura. La regla de que el icono sale de `dark:` la cubre R17 |
| R19 | E2E R19, con `reducedMotion: 'reduce'` |
| R20 | `guard-dependencias-aprobadas` y `package.json` sin diff |
| R21 | Enmiendas de la lista cerrada y las dos autorizadas; suite local verde |

No falta ningún R.

## Puntos que pidió juzgar el leader

1. **Enmienda en `private-nav-clientes`.** Correcta y mínima: una aserción `'contact'` →
   `'square-user'` con su nota `ENMIENDA QC-257`. La respaldan D11/P3 y está en `design.md > 9`.
2. **Enmienda R45 en `pedidos-viewport`.** **Es estrecha.**
   - La excepción exige las dos condiciones a la vez: que el elemento sea `svg[aria-hidden="true"]`
     y que esté dentro de `button[aria-label=THEME_TOGGLE_LABEL]`.
   - Solo exime de `opacity-0`/`invisible`. El chequeo de `hover:` que revela no tiene excepción:
     corre antes del `continue`.
   - El caso de control nuevo demuestra tres cosas: la pantalla real pasa con un `svg.opacity-0`
     presente; un `span.opacity-0` cualquiera da rojo; y un `svg[aria-hidden].opacity-0` dentro de
     otro botón también da rojo.
   - Hay ruido de diff, que va en el hallazgo menor 1.
3. **Alta de `shell-rediseno.spec.ts` en `guard-identificador-de-request`.** Correcta.
   - `E2E_ESPERADOS` es una lista cerrada cuyo punto de extensión, por diseño, es nombrar cada spec
     uno a uno. Así lo hicieron QC-227 y QC-228, y el ancla no se relaja.
   - El spec nuevo no lee el identificador de petición ni `reference`: lo busqué con grep.
   - No es una «enmienda» de un caso, así que no hacía falta en `design.md > 9`. Aun así, el archivo
     no estaba en `tasks.md > Archivos esperados` (hallazgo menor 4).
4. **Tooltip de logout sobre el `<form>`.** Aceptable.
   - La desviación está documentada en `design.md > 5` y la aceptó el leader.
   - El botón sigue siendo `type="submit"`, con el mismo `aria-label`, `data-testid` y
     `useFormStatus`.
   - El formulario envuelve solo al botón, así que la zona del puntero es la misma.
   - El foco del botón llega al disparador porque el foco de React burbujea, y lo prueban el unit y
     el E2E por teclado.
   - R13 tiene test explícito: el botón queda deshabilitado mientras envía. Con el botón como
     disparador había una regresión real; la resuelve.
   - Coste: el `<form>` lleva atributos del disparador (`data-slot="tooltip-trigger"`,
     `data-popup-open`). No tiene rol ni `tabindex`, así que es inocuo.
5. **Riesgo en `e2e/marca-componentes.spec.ts`: es real, pero ya existía.**
   - `ensureSession` guarda `session` en un ámbito de módulo, y `beforeAll` no lo reinicia.
   - Con `fullyParallel: true`, un worker puede volver al archivo después de su `afterAll`, que
     borra el usuario y la empresa. Entonces reutilizaría el `storageState` de un usuario borrado y
     el layout lo mandaría a `/login?sesion=fin`.
   - Es el mismo patrón que el implementer corrigió en el spec nuevo con `session = null` en
     `beforeAll` y en `afterAll`.
   - Esta ficha no lo introduce: viene de QC-227. Pasó en la corrida local, y el E2E solo corre en
     el CI del PR a producción. Va como hallazgo menor 2.

## Hallazgos

1. **menor**: `tests/unit/pedidos-ui/pedidos-viewport.test.tsx` cambia de final de línea.
   - En `origin/dev` el blob estaba en CRLF, una anomalía frente a `.gitattributes`. La rama lo
     normaliza a LF.
   - Por eso el diff muestra 1507 líneas, cuando el cambio real son +69/−14
     (`--ignore-cr-at-eol`).
   - No es incorrecto: cumple `.gitattributes`. Pero ensucia el blame y puede dar un conflicto de
     archivo entero a cualquier rama en vuelo que toque ese test.
   - El leader debería tenerlo en cuenta al integrar.
2. **menor** (ya existía y no lo introduce el diff): en `e2e/marca-componentes.spec.ts`, `session`
   no se reinicia en `beforeAll`/`afterAll`, con el riesgo de `/login?sesion=fin` descrito en el
   punto 5.
   - El arreglo es de una línea, pero queda fuera de la lista cerrada de enmiendas de esta ficha.
   - El leader decide: o autoriza el arreglo aquí, o lo apunta en `progress/deudas.md` o en una
     ficha.
3. **menor**: la limpieza de comentarios va mezclada con el cambio de código en el mismo commit. En
   `theme-toggle.tsx`, `sidebar-toggle.tsx`, `app/(private)/layout.tsx`, `app-sidebar.tsx` y
   `private-nav.ts` se recortan docblocks largos y referencias a `R<n>` (punto 9: menor).
4. **menor**: `tests/guards/guard-identificador-de-request.test.ts` quedó fuera de
   `tasks.md > Archivos esperados`. La bitácora (T8) lo declara, así que la desviación está
   anotada, pero `tasks.md` no se actualizó.
5. **menor** (para integrar): `components/shared/CATALOGO.md` también lo toca QC-256, que va en
   paralelo. Son filas distintas y no debería haber conflicto semántico, pero el segundo en
   mergear tendrá que rebasar.

No hay hallazgos bloqueantes.

## Veredicto

**OK**
