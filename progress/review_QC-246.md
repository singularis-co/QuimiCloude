# review QC-246 — contactos-con-chat

Alcance: solo el diff propio, `git diff origin/feature/QC-245-contactos-whatsapp-backend...HEAD`
(rama apilada sobre QC-245 por decisión del humano). El backend de QC-245 no se revisa.
El rojo de `./init.sh` por `feature_list.json` (ids 290–298, en vuelo sin assignee, cupo backend)
es ajeno y no cuenta. MCP del grafo: no usado; la exploración se hizo con Grep/Read.

## Verificación ejecutada por el reviewer (2026-10-24)

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | `tsc --noEmit`, exit 0 |
| `pnpm run lint` | `✖ 10 problems (0 errors, 10 warnings)`, ninguno en archivos del diff |
| `pnpm exec vitest related --run <.ts/.tsx del diff, sin e2e>` | `Test Files 178 passed (178)` · `Tests 2867 passed \| 22 skipped` |
| `pnpm exec vitest run guard` | `Test Files 87 passed (87)` · `Tests 1324 passed \| 22 skipped` |
| E2E `e2e/contactos-chat.spec.ts` | no corrido (sin base migrada); revisado por lectura |

## Checklist

### Especificación
- [x] `requirements.md` con R1–R54 en EARS y D1–D18.
- [x] `design.md` con alternativas descartadas (12) y su porqué.
- [ ] `tasks.md` todas `[x]`: **T19 sigue `[ ]`** (B1).
- [x] `design.md` abre con `## Lo que ya existe`, con contenido; el diff no re-crea nada de lo
      listado (WaBubble y constantes suben con reexportación; polling y `EntityImage` se copian
      como patrón con alternativa descartada 3 y 9).

### Equipo
- [x] Assignee (Christian Quevedo) y rama `feature/QC-246-contactos-con-chat`.

### Trazabilidad
- [x] `progress/impl_QC-246.md > Tanda 5` trae el mapa consolidado R1–R54.
- [x] Cada R1–R54 aparece en al menos un caso con su id en el nombre (conteo por grep sobre
      `tests/unit/{contactos-ui,clientes-ui,shared-ui,integraciones-ui}` y el E2E).
      Revisados a fondo R1, R4, R16, R26, R27, R28, R32, R37, R40–R44, R46, R47, R48, R54: tienen
      aserciones reales, no tests vacíos.
- [ ] **R7** no tiene ningún test que verifique lo que dice (B2).

### Calidad de código
- [x] typecheck y lint sin errores.
- [ ] `gate-completo` en CI: pendiente del PR (no evaluable aquí).
- [ ] Flujo crítico con E2E y salida local en `impl`: la feature toca **permisos** (corte por
      `whatsapp.consultar`, menú, «Abrir chat») y **webhooks** (entrante y `status` en pantalla);
      el E2E existe pero nunca se ha ejecutado (B1).
- [x] Sin dependencias nuevas (`package.json` no cambia; design §10).

### Seguridad / configuración
- [x] Sin secretos; el `APP_SECRET` del E2E es efímero de la prueba.
- [x] Sin webhooks nuevos (son de QC-245).
- [x] Nada de entorno hardcodeado; la URL de medios llega en `attachment.mediaUrl`
      (frontera R48 con test que barre la ruta).

### `docs/checkpoints-proyecto.md`
- [x] Typecheck / lint.
- [x] E2E de Playwright (escrito).
- [x] Multiplataforma: `100dvh` (`page.tsx:102`), sin `100vh`; `safe-area-inset-bottom` en la caja;
      `Button touch` / `touchTarget` en volver, enviar, cerrar visor, flecha, «Abrir chat»; burbujas
      de plantilla `min-h-11` en móvil con área ampliada en `md`; `hover:` siempre con `active:` o
      acción por clic; inputs vía `Textarea`/`Input`/`SharedSelectControl` (16 px) y el buscador
      `h-11` en móvil; burbujas `max-w-[80%]`/`62%` con `overflow-wrap:anywhere`.
- [x] Catálogo: filas nuevas de `WaBubble` (`WaBurbuja.dc.html`) y de las constantes (`sin UI`).
- [x] Pase `/design`: siete tableros en `docs/diseno/canvas/Contactos*.dc.html`, citados en
      `design.md > Referencia de diseño` (D10). Componentes de la ruta: paso 4 declarado.
      `CustomerChatLink`: paso 3, tablero `ContactosVacios`.
- [x] Datos/RLS/migraciones/módulos hexagonales: no aplica (100 % frontend; sin cambios en
      `lib/modules/**`, `db/**`, `lib/composition/**`).
- [x] Permisos: la página corta en servidor con `requirePagePermission('whatsapp.consultar')` como
      primera sentencia; `canSend`/`canOpenIntegrations` solo ocultan; los datos llegan por props
      y por Server Actions.

### Reglas del proyecto (`docs/perfil-agentes.md > reviewer`, 5–11)
- [x] 5 Calidad y seguridad: capas separadas; ruta sin `@/lib/composition` (test de frontera).
- [x] 6 Multiplataforma: ver arriba.
- [x] 7 Dependencias: ninguna.
- [x] 8 Aislamiento por empresa: no hay modelos ni consultas nuevas.
- [x] 9 Comentarios: ninguna línea añadida en producción cita `QC-`, `R<n>`, `design.md` ni
      «decisión cerrada» (revisadas las 161 líneas de comentario añadidas).
- [x] 10 Duplicados: el catálogo no tiene piezas de chat; `design.md` justifica el paso 4 y por qué
      `WaBubble` y `EntityImage` no bastan.
- [x] 11 Diseño: referencia en `design.md` y en las filas del catálogo.

## Hallazgos

### B1 — BLOQUEANTE · T19 sin cerrar: el E2E de un flujo crítico nunca se ha ejecutado
- `specs/QC-246-contactos-con-chat/tasks.md:137` — T19 `[ ]`; `CHECKPOINTS.md` exige todas `[x]` y,
  para un flujo crítico (permisos, webhooks), la salida del E2E en `progress/impl_QC-246.md`. La
  bitácora solo trae `--list` (8 tests), no una corrida.
- Además, `e2e/clientes.spec.ts` y `e2e/movimiento.spec.ts` se tocaron (placeholder retirado) y
  tampoco se corrieron.
- La bitácora da por hecho que «se correrá en CI», pero `.github/workflows/gate.yml:304-307` solo
  lanza `e2e-navegador` con `workflow_dispatch` o en el PR a `prod`: el PR a `dev` **no** lo corre.
- Para cumplirlo: correr `contactos-chat`, `clientes` y `movimiento` contra una base con las
  migraciones de QC-245 (base propia o `gh workflow run gate.yml --ref feature/QC-246-contactos-con-chat`),
  pegar la salida en `progress/impl_QC-246.md` y marcar T19.

### B2 — BLOQUEANTE · R7 no tiene un test que lo verifique
- R7 pide: a **360 px**, ningún estado (lista, chat **con cada tipo de mensaje**, burbujas de
  plantillas, detalle del pedido, diálogo de plantilla, visor de imagen) produce scroll horizontal.
- El único test es `e2e/contactos-chat.spec.ts:104` y `:579`: viewport **390 × 844** (ningún doc del
  repo fija 390; R7 dice 360) y solo mide la lista y un chat con un texto entrante. Ni burbujas de
  plantillas, ni detalle del pedido, ni diálogo, ni visor, ni imagen/ubicación/sticker. El propio
  implementer lo reconoce como hueco (`impl_QC-246.md:549-550`).
- Para cumplirlo: el caso de teléfono a 360 px y medir, además, al menos el chat vacío con burbujas
  de plantillas y el detalle del pedido desplegado (cliente con pedido y una plantilla aprobada en el
  fixture), el diálogo «Enviar plantilla» (ventana cerrada) y el visor (un entrante `image` por el
  webhook con el doble de medios); o bajar el alcance de R7 con decisión del humano escrita en
  `requirements.md`.

### m1 — menor · La caja no pasa sola a «ventana cerrada» al llegar `closesAt` (R16 → R30)
- `app/(private)/clientes/contactos/components/chat-composer.tsx:133` decide el modo con
  `chatWindow.open` del servidor; solo `chat-window-badge.tsx` lleva reloj. Al llegar `closesAt` la
  insignia dice «Ventana cerrada» pero la caja sigue habilitada hasta la siguiente consulta periódica
  (≤ ~8 s, y nunca con la pestaña oculta). El test de R16 (`chat-header.test.tsx:100`) solo mira la
  insignia. El back rechazaría el envío, así que no es un fallo de datos.

### m2 — menor · Un saliente recién enviado se pinta sin autor (R18)
- `chat-composer.tsx:71` y `:86` ponen `author: { kind: 'user', name: null }`; `chat-message.tsx`
  no pinta autor con `name: null`. El nombre aparece cuando la consulta periódica reemplaza el
  mensaje por id. Ventana de ~8 s sin autor.

### m3 — menor · `design.md` desalineado con el reintento de plantilla aprobado
- `design.md:121` y `:303-305` siguen diciendo `systemConstantsFor(template, values)`; el código
  (`chat-panel.tsx:78-84`) manda todas las constantes del sistema con valor, desvío aprobado por el
  humano tras la tanda 3 (`progress/features/QC-246.md > Decisiones`). Falta reflejarlo en el spec.

### m4 — menor · `progress/features/QC-246.md > Decisiones` contradice D17
- La entrada «(4) error de red al enviar: mismo error genérico con «Reintentar»» choca con D17
  (sin «Reintentar» junto a la caja), que es lo implementado. Conviene corregir la bitácora.

### m5 — menor · `markWhatsappChatReadAction` sin `settleAction` en el panel
- `chat-panel.tsx:183`: una red caída al marcar leído deja una promesa rechazada sin capturar
  (la pantalla sí lo envuelve en `contacts-screen.tsx:216`). Sin efecto visible, pero incoherente con D4.

### m6 — menor · `tasks.md > Archivos esperados` incompleto
- Faltan archivos que el diff crea o toca: `action-rejection.ts`, `contacts-selection.ts`,
  `contacts-load-error.tsx`, `tests/unit/contactos-ui/chat-composer.test.tsx`,
  `contacts-empty-states.test.tsx`, `tests/unit/clientes-ui/clientes-page.test.tsx`,
  `tests/unit/shell/nav-iconos.test.ts`, `tests/guards/guard-identificador-de-request.test.ts`,
  `e2e/clientes.spec.ts`, `e2e/movimiento.spec.ts` y el snapshot de paridad de Clientes.
  `archivos-en-vuelo.mjs` usa esa lista para detectar choques.

## Juicio de los desvíos declarados
- `currentPlatformActor()` + `assertPermission` en `page.tsx` en lugar del patrón de
  `canModifyCustomers`: correcto (el otro importa `@/lib/composition`, prohibido por R48) y ya
  reflejado en `design.md > 5.1`. Solo presentación; la autorización sigue en cada Server Action.
- Teléfono de cabecera por `getCustomerAction` (D18) y error de red sin «Reintentar» en la caja
  (D17): cerrados por el humano y bien implementados.
- Reintento de plantilla con todas las constantes: aprobado y seguro (el back toma solo las de la
  plantilla, `whatsapp-template-message.ts:103`); falta el spec (m3).
- Ampliar `private-nav-clientes.test.ts` y `nav-iconos.test.ts` en vez de crear: correcto; no se
  relaja ninguna aserción.
- Alta de `contactos-chat.spec.ts` en `E2E_ESPERADOS`: es el punto de extensión de la guardia.
- E2E por lectura: el flujo (webhook firmado → lista → chat → «Enviando»/«Enviado» → `delivered` →
  «Entregado»; 404 sin el añadido; «Abrir chat» con y sin conversación; lista ↔ chat en teléfono)
  es coherente con el código, los testids existen en `contact-texts.ts` y la retención de la Server
  Action por `postData` es un truco razonable. No se puede dar por verde sin correrlo (B1).

## Veredicto

**RECHAZADO** (CAMBIOS): 2 bloqueantes (B1, B2), 6 menores.

## Segunda pasada (2026-10-25, `aacbf406..aaa8502b`)

Alcance: los commits `17e9e360`, `afde61bd`, `1276b897`, `aaa8502b` contra B1, B2 y m1–m6, más sus
regresiones. MCP del grafo: no usado (Grep/Read).

### Verificación ejecutada por el reviewer

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | `tsc --noEmit`, exit 0 |
| `pnpm run lint` | `✖ 10 problems (0 errors, 10 warnings)`, ninguno en archivos del diff |
| `pnpm exec vitest related --run <70 .ts/.tsx del diff, sin e2e>` | `Test Files 178 passed (178)` · `Tests 2871 passed \| 22 skipped` |
| `pnpm exec vitest run guard` | `Test Files 87 passed (87)` · `Tests 1324 passed \| 22 skipped` |
| CI run 40209402119 (`aaa8502b`, `workflow_dispatch`) | `estatico` y los 3 shards de vitest en verde; **`gate-completo` en ROJO**; `e2e (chromium)` y `e2e (webkit)` **en curso** al cerrar esta pasada |
| `pnpm exec vitest run` de los 3 archivos rojos de `gate-completo` | `Test Files 3 failed` · `Tests 5 failed` (reproducido en local, ver B3) |

### Estado de los hallazgos de la primera pasada

- **B1 — sigue abierto, condicionado al run 40209402119.** `tasks.md:137` T19 sigue `[ ]` y no hay
  salida de una corrida E2E verde en `impl_QC-246.md` (los runs 40152044453 y 40155450179 dieron 2 y
  1 rojos propios, ya corregidos en `1276b897` y `aaa8502b`). Se cierra cuando los jobs `e2e (chromium)`
  y `e2e (webkit)` del run 40209402119 terminen sin rojos de `contactos-chat`, `clientes` y
  `movimiento`, la salida se pegue en la bitácora y T19 pase a `[x]`. No se da por verde.
- **B2 — resuelto (pendiente solo de B1).** `e2e/contactos-chat.spec.ts`: viewport 360 × 844
  (`:118`); `expectNoHorizontalScroll` (`:509`) mide `documentElement` y los contenedores visibles;
  el caso «R7: a 360 px…» (`:800`) mide burbujas de plantillas, plantilla marcada, detalle del pedido,
  diálogo «Enviar plantilla», chat con imagen, sticker, ubicación, reacción y fallido con palabra larga,
  y el visor. El desborde real del diálogo que destapó el CI se arregló en el componente
  (`send-template-dialog.tsx`, `min-w-0` + truncado del disparador) con test estructural en
  `send-template-dialog.test.tsx > R7`. Primitivos de `components/ui` sin tocar.
- **m1 — resuelto.** `use-window-open.ts` (temporizador hasta `closesAt`, tope 2^31−1 ms) y
  `chat-composer.tsx` decide el modo con él; dos tests nuevos en `chat-composer.test.tsx` (paso a
  cerrada sin consulta y ventana > 24,8 días).
- **m2 — aceptado como menor por el humano** (sin `displayName` en backend). No cuenta.
- **m3 — resuelto.** `design.md` (tabla de acciones y §5.4) recoge el reintento con todas las constantes.
- **m4 — resuelto.** `progress/features/QC-246.md > Decisiones` alineado con D17.
- **m5 — resuelto.** `chat-panel.tsx:190` con `settleAction`; test `R27 · D4` sin rechazo sin capturar.
- **m6 — resuelto.** `tasks.md > Archivos esperados` completo.
- `e2e/clientes.spec.ts`: `enableAllAddons(companyId)` es correcto (Contactos exige `whatsapp.consultar`,
  del añadido `integraciones`); el caso sin añadido sigue cubierto en `contactos-chat.spec.ts`; la
  limpieza cae por cascada. No relaja asserts.

### Trazabilidad
- [x] R1–R54: cada uno con al menos un `it`/`test`/`step` con su id en los tests del diff (script).
- [x] R7 con test fiel (B2).

### Hallazgo nuevo

#### B3 — BLOQUEANTE · `gate-completo` en rojo por 3 archivos de test que rompe esta feature
`gate-completo` del run 40209402119 (y ya de 40152044453 y 40155450179) falla con «3 archivo(s) de test
en rojo que NO estan en el baseline». Ninguno está en `tests/baseline-rojos.json` y los 5 fallos nombran
archivos que crea o cambia QC-246 (no existen o no tienen ese contenido en
`origin/feature/QC-245-contactos-whatsapp-backend`). `vitest related` no los ve porque barren el árbol
por glob, no por import. Reproducido en local:

- `tests/unit/clientes/scope.test.ts > R28`: «spec E2E ajeno con marca de clientes: contactos-chat.spec.ts».
- `tests/unit/clientes-ui/clientes-convenciones.test.ts > R38`: «mencionan pedidos: chat-header.tsx,
  chat-image-viewer.tsx, chat-order-detail.tsx, chat-view.ts, contact-texts.ts, send-template-dialog.tsx».
- `tests/unit/clientes-ui/clientes-convenciones.test.ts > R40`: literal de copy en
  `contactos-page.test.tsx:316` (`queryByRole('textbox', { name: 'Mensaje' })`) y en
  `customer-chat-link.test.tsx` (`getByRole('link', { name: \`…\` })`).
- `tests/unit/integraciones/module-shape.test.ts > R19`: 53 importadores de `@/lib/modules/integraciones`
  frente a los 37 permitidos (los componentes nuevos de `clientes/contactos/`).
- `tests/unit/integraciones/module-shape.test.ts > R17`: `integraciones.modificar` en
  `app/(private)/clientes/contactos/page.tsx`, fuera de `isAllowedHolderOfTheCode`.

Para cumplirlo: o bien ajustar el código/tests propios (p. ej. localizar por constante en R40), o bien
ampliar esas guardias con la ruta **exacta** de la excepción y su motivo (lo que piden sus mensajes),
sin relajar las aserciones para el resto; y que `gate-completo` salga verde. Recuerda: nadie mergea con
`gate-completo` en rojo (`CLAUDE.md`, regla 5). La ampliación de la guardia de pedidos (R38 de Clientes)
choca de fondo con la decisión del spec de mostrar el pedido en el chat: si hace falta, que el leader la
eleve al humano.

### Veredicto (segunda pasada)

**RECHAZADO** (CAMBIOS): 1 bloqueante nuevo (B3, `gate-completo` rojo por guardias que rompe la feature)
y B1 condicionado al resultado de los jobs E2E del run 40209402119 (en curso). B2, m1, m3–m6 resueltos;
m2 aceptado por el humano.
