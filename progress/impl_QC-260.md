# QC-260 — Bitácora de implementación

Rama `feature/QC-260-rediseno-acceso`, worktree `.worktrees/QC-260-rediseno-acceso`.

## Paso 0 — decisiones del humano

P1–P3 pasan de «Preguntas abiertas» a «Decisiones cerradas (no reabrir)» en `requirements.md`
(humano, al aprobar el spec, 2026-10-12). Enmienda de QC-226 R17: `docs/specs.md` no regula cómo
anotar enmiendas en un spec cerrado, así que no se toca `specs/QC-226-*`; la enmienda queda
documentada en `design.md > 10` de esta ficha y en las notas `ENMIENDA QC-260` de los tests.

## T1 — Barrido de tests afectados

Grep sobre `tests/` y `e2e/` (2026-10-12) por los nombres, selectores y textos que cambia la ficha.

### Se enmiendan (cambia la aserción, con nota `ENMIENDA QC-260`)

| Archivo | Caso | Motivo |
|---|---|---|
| `tests/unit/login-skin.test.tsx` | Bloque «Pantalla de login», `data-login`, vidrio, `login-molecule-float`, `login-card-enter`/`fade`, tres moléculas | QC-226 R17–R22 enmendados (design § 10): bloque «Pantallas de acceso», `data-access`, cinco moléculas que giran |
| `tests/unit/identity/login-page-marca.test.tsx` | `data-login="screen"` (l. 43); `h1` con logo vertical | R1, R9 (`data-access`, isotipo + marca escrita) |
| `tests/unit/theme/color-tokens.test.ts` | l. 327–335: animaciones `login-*` del bloque de login | design § 4 |
| `tests/unit/theme/motion-tokens.test.ts` | l. 128–129: reducido sobre `[data-login=…]` | design § 4 |
| `tests/guards/guard-movimiento.test.ts` | delimitadores «Pantalla de login — INICIO/FIN» (l. 6, 240) | design § 4 / § 10 (QC-228) |
| `tests/unit/identity-ui/set-credential-form.test.tsx` | `set-credential-mismatch` → `set-credential-confirmation-error`; `aria-describedby` por inclusión; casos de `CredentialInput` local | design § 3.4 / § 10 |
| `tests/unit/paridad/__snapshots__/login-paridad.test.tsx.snap` | árbol accesible del login (ojo, spinner, h1) | se regenera en su propio commit con control de diff |
| `tests/unit/shared-ui/submit-button.test.tsx` | caso nuevo: `Spinner` mientras envía | R12, R21 (T4) |
| `tests/unit/shared-ui/notice.test.tsx` | caso nuevo: `id` opcional | R18 (T2) |
| **`tests/unit/identity/credencial/scope.test.ts`** (no estaba en el spec) | `SUPERFICIE_PUBLICA` (l. 131–138) nombra `credential-input.tsx` y `submit-button.tsx` de la ruta, y el ancla de l. 461 exige que existan | design § 6 los borra: se quitan de la lista con nota. Se añade a `## Archivos esperados` |

### Deben quedar verdes sin editar aserciones

| Archivo | Por qué se mira |
|---|---|
| `tests/unit/login-form.test.tsx` | contrato del login (R11); testids y comportamiento iguales |
| `tests/ui/login-form-uncontrolled-warning.test.tsx` | remontaje del `username` |
| `tests/unit/paridad/login-paridad.test.tsx` | solo cambia el `.snap` |
| `tests/unit/credential-requirements.test.tsx`, `tests/unit/credential-help-contract.test.ts` | leen `CREDENTIAL_RULE_LABELS` por constante, no por literal |
| `tests/unit/shared-ui/password-field.test.tsx`, `password-field-requisitos.test.tsx` | `PasswordField` sin cambios (usan su propia etiqueta «Contrasena nueva» de prueba) |
| `tests/unit/shared-ui/catalogo-qc256.test.ts`, `tests/guards/guard-catalogo-de-componentes.test.ts` | filas de `Notice`, `SubmitButton`, `AccessScreen` |
| `tests/unit/brand/brand-logo.test.tsx` | renderiza `LoginPage` |
| `tests/guards/guard-piezas-base.test.ts` | carpeta `establecer-contrasena` excluida por ruta; `SUBMIT_BUTTON_D12` es un literal de caso sintético (no exige que el archivo exista) |
| `tests/guards/guard-formularios-y-acciones.test.ts` | `useFormStatus` solo en `components/shared/submit-button.tsx` |
| `tests/guards/guard-arquitectura-modulos.test.ts`, `tests/guards/guard-identificador-de-request.test.ts` | citan `login-form.tsx` (imports) |

### E2E

| Archivo | Qué |
|---|---|
| `e2e/login-skin.spec.ts` | **se rompe por diseño** (l. 142–211: `data-login="molecule"`, `login-molecule-float`, `login-card-enter`, `login-card-fade`): se enmienda en T10 |
| `e2e/login.spec.ts`, `e2e/session.spec.ts`, `e2e/theme.spec.ts`, `e2e/establecer-contrasena.spec.ts`, `e2e/helpers/landing.ts` y los ~15 specs que entran por `login-username`/`login-password`/`login-submit` | testids sin cambios; verdes sin editar |

**Textos con tildes en E2E:** confirmado, ninguna aserción E2E ni unit usa las formas sin tilde de
los textos de las dos pantallas como literal: los tests las leen por `SET_CREDENTIAL_LABELS`,
`CREDENTIAL_RULE_LABELS` o `data-testid`. Las apariciones de `contrasena`/`sesion` en `tests/` son
comentarios, nombres de caso o mensajes de guardias.

## T3 — Riesgo 1 medido (frontend_dev, 2026-10-12)

Formulario de prueba: `useActionState` + `<form action>` + `PasswordField name="credential"
requirements={{}}`, action que rechaza. Se teclea `Abcdefg1#`, se envía, se espera al rechazo.

**Resultado (jsdom, React 19): NO se desincroniza.** Tras el rechazo el input conserva
`"Abcdefg1#"` y la lista dice las seis `met` + `breached: unknown`, lo mismo que la lista sin
estado para ese valor. El campo es controlado y React restaura su valor tras el reinicio del
`<form>`. Caso de R20 en verde; T7 no necesita el `key` por intento por este motivo. Límite: medido
en jsdom; si el navegador se comporta distinto, lo cubre `e2e/acceso-rediseno.spec.ts`
(`design.md > 11`, fila R20).

## Archivos creados / modificados (consolidado, frontend_dev en todas las tareas)

- **Piezas compartidas:** `components/shared/access-screen.tsx` (nuevo, T5), `notice.tsx` (`id`, T2),
  `submit-button.tsx` (`Spinner`, T4), `credential-rule-labels.ts` (tildes, T8), `CATALOGO.md`
  (filas `Notice`, `SubmitButton`, `AccessScreen`).
- **CSS:** `app/globals.css` (bloque «Pantallas de acceso — INICIO/FIN», T5).
- **Login (T6):** `app/(public)/login/page.tsx`, `components/login-form.tsx`, `components/index.ts`;
  borrado `components/login-background.tsx`.
- **Establecer contraseña (T7):** `app/(public)/establecer-contrasena/[token]/page.tsx`,
  `components/set-credential-form.tsx`, `components/set-credential-labels.ts`, `components/index.ts`;
  borrados `components/credential-input.tsx` y `components/submit-button.tsx`.
- **Tests nuevos:** `tests/unit/acceso/{access-screen,login-rediseno,establecer-contrasena-rediseno,textos-acceso}.test.tsx`,
  `tests/guards/guard-qc260-limites-de-la-ficha.test.ts`, `e2e/acceso-rediseno.spec.ts`.
- **Tests enmendados (`ENMIENDA QC-260`):** `tests/unit/login-skin.test.tsx`,
  `tests/unit/identity/login-page-marca.test.tsx`, `tests/unit/theme/color-tokens.test.ts`,
  `tests/unit/theme/motion-tokens.test.ts`, `tests/unit/brand/brand-logo.test.tsx` (O1),
  `tests/unit/identity-ui/set-credential-form.test.tsx`, `tests/unit/identity/credencial/scope.test.ts`,
  `tests/guards/guard-movimiento.test.ts`, `e2e/login-skin.spec.ts` (fuera los 4 casos de QC-226
  R17–R22; quedan los 3 de medidas); casos nuevos en `tests/unit/shared-ui/notice.test.tsx` y
  `submit-button.test.tsx`. Snapshot `tests/unit/paridad/__snapshots__/login-paridad.test.tsx.snap`
  regenerado en commit propio (`c9d2e746`).

### Control de diff del snapshot de paridad (T6)

+65/−40, solo lo esperado: `main` sin `dark`/`min-h-svh p-6`, con `min-h-dvh`; 5 moléculas en vez de 3;
tarjeta `region` con `aria-labelledby="login-heading"` (sin `CardHeader/Content/Footer`); `h1` con
isotipo claro y oscuro (`alt=""`) + «Quimi»«Cloude», nombre accesible `QuimiCloude`; «Usuario»
`h-11 md:text-base`; `PasswordField` con ojo («Mostrar la contraseña», `aria-pressed`,
`aria-controls="password"`); spinner `aria-hidden` + «Entrando…» al enviar; pie con `border-t` y
enlace `min-h-11`.

### Desviaciones declaradas por frontend_dev (para el reviewer)

- T5: tarjeta con `role="region"` cuando recibe `labelledBy`; `gap` 20/18 px de los tableros;
  movimiento reducido con `animation: none` en hijos de la tarjeta.
- T6: el formulario cuenta como un solo bloque de la entrada escalonada (h1, form, pie); enlace de
  recuperación con `buttonVariants({ variant: 'link', touch: true })`.
- T7: isotipo, cabecera y `form` son hermanos (hijos directos de la tarjeta) para que la entrada
  escalonada los anime; el paso a éxito remonta los bloques con `key` en cada rama, no la tarjeta
  (la pinta la página de servidor); `set-credential-success` está en el bloque del título y texto;
  testids nuevos `set-credential-brand`, `set-credential-success-icon`, `set-credential-feedback`;
  el relleno 36/28/28 del éxito del tablero no se aplica (la tarjeta es de `AccessScreen`).
- T8: el mensaje inesperado del catálogo («Ocurrio un error inesperado…») vive en `lib/` (R27 lo
  prohíbe tocar) y no lleva tildes; no es ninguna de las formas que R25 veta.
- T10: el éxito («Ir a iniciar sesión») se alcanza en E2E con el buzón de archivos y el caso de uso de
  `establecer-contrasena.spec.ts`, datos `qc260_e2e_*` que se borran; R20 se ejerce con contraseñas
  que no coinciden (no necesita base).

## Mapa R<n> -> test

| R | Test |
|---|---|
| R1, R2, R5, R6 | `tests/unit/acceso/access-screen.test.tsx > R1/R2/R5/R6` |
| R3, R4, R6, R7, R8 | `e2e/acceso-rediseno.spec.ts > R3, R4, R6, R7 (390/820/1440), R8 (390/820/1440)` en las dos pantallas, chromium y webkit; R8 del enlace de éxito: `> estado de éxito > R8 — «Ir a iniciar sesión»` |
| R9, R10, R11, R12, R13 | `tests/unit/acceso/login-rediseno.test.tsx > R9…R13`; R10 además `e2e/acceso-rediseno.spec.ts > ojo del login > R10`; R11 además `tests/unit/login-form.test.tsx` y `e2e/login.spec.ts` |
| R14–R22 | `tests/unit/acceso/establecer-contrasena-rediseno.test.tsx > R14…R22` (R20: T3 + formulario real); `tests/unit/identity-ui/set-credential-form.test.tsx`; R20 además `e2e/acceso-rediseno.spec.ts > R20`; R12/R21 de la pieza: `tests/unit/shared-ui/submit-button.test.tsx`; R18 `id`: `tests/unit/shared-ui/notice.test.tsx` |
| R23, R24 | `tests/unit/identity-ui/set-credential-form.test.tsx`, `e2e/establecer-contrasena.spec.ts` |
| R25, R26 | `tests/unit/acceso/textos-acceso.test.tsx` |
| R27, R29 | `tests/guards/guard-qc260-limites-de-la-ficha.test.ts > R27 / R29` (8 casos, incl. sintéticos en rojo) |
| R28 | `tests/guards/guard-catalogo-de-componentes.test.ts` |

## Salida de los tests

- T3: `pnpm exec vitest run tests/unit/acceso/establecer-contrasena-rediseno.test.tsx` →
  `Test Files 1 passed (1)`, `Tests 1 passed (1)`. `pnpm run typecheck` → sin errores.
  `pnpm run lint` → `0 errors, 7 warnings` (preexistentes, ninguno en el archivo nuevo).
- T6/T7/T8/T9: cada frontend_dev corrió typecheck, lint, `vitest related` y guardias: verdes salvo
  B1.

### Cierre (implementer, 2026-10-12, tras T10)

- `pnpm run typecheck` → OK. `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)` (preexistentes
  en `confirm-catalog-import.test.ts` y `order-service.test.ts`).
- `pnpm exec vitest run guard` → `Test Files 72 passed (72)` · `Tests 985 passed | 18 skipped (1003)`.
- **Barrido (lección QC-256):** grep en `tests/` (sin integración, que no nombra nada tocado) de
  `shared/notice`, `submit-button`, `access-screen`, `credential-rule-labels`, `Notice`,
  `SubmitButton`, `AccessScreen`, `globals.css`, `CATALOGO.md`, `(public)/login`,
  `establecer-contrasena`, `login-form`, `SetCredentialForm`, `SET_CREDENTIAL_LABELS`,
  `data-access`, `PasswordField` → 44 archivos, corridos todos:
  ```
  × no introduce ningun cambio visual 87ms
  FAIL |ui| tests/unit/login-form.test.tsx > destino de vuelta (QC-9 R7, R8, R9) > no introduce ningun cambio visual
  Test Files  1 failed | 42 passed (43)
       Tests  1 failed | 725 passed | 7 skipped (733)
  ```
  El único rojo es B1.
- **E2E** (`pnpm exec playwright test e2e/acceso-rediseno.spec.ts e2e/login-skin.spec.ts e2e/login.spec.ts e2e/establecer-contrasena.spec.ts e2e/theme.spec.ts e2e/session.spec.ts`,
  chromium + webkit):
  ```
  20 failed
  54 passed (1.2m)
  ```
  Verdes: `acceso-rediseno` 20/21 por proyecto (R3, R4, R6, R7, R8 en las dos pantallas y las tres
  anchuras, R10, R20), `login-skin` 3/3, `theme` 4/4. Los 20 rojos (10 por proyecto) caen todos al
  sembrar datos con `PrismaClientInitializationError` (falta `DATABASE_URL`): `acceso-rediseno:413`
  (R8 «Ir a iniciar sesión»), `establecer-contrasena:182`, `login:366/387/432/459/486`,
  `session:248/296/359`. Ver B2.

## Bloqueos

- **B1 (T6) — `tests/unit/login-form.test.tsx > «no introduce ningun cambio visual»` (l. 444)
  en rojo.** Es un caso de QC-75 (campo oculto `next`) que exige
  `within(form).getAllByRole('button')).toHaveLength(1)`: los controles del formulario «siguen
  siendo los tres de QC-7». R10 (aprobado) añade el ojo de `PasswordField`, un `<button>` dentro
  del form, así que ahora hay 2. `tasks.md > T6` exige que ese archivo quede verde **sin editar
  aserciones de comportamiento**: el spec se contradice consigo mismo y `design.md > 10` no lista
  esta enmienda. No se edita. Opciones: (a) enmendar a 2 con nota `ENMIENDA QC-260`, (b) contar
  solo los `button[type=submit]` (sigue probando que el oculto no añade controles). Decide el
  leader/humano. T6 queda sin `[x]` hasta entonces; el resto de T6 está verde.
- **B2 (T10) — entorno E2E sin base.** El worktree no tiene `.env` (no se copió al montarlo) y
  Docker Desktop está apagado: el Postgres 17 de `localhost:5433` no responde. Los 10 casos por
  proyecto que siembran datos fallan en el seed, no en la UI; no se puede confirmar que
  `login`, `session` y `establecer-contrasena` pasan sin cambios. No se improvisa infraestructura:
  con `.env` y la base de la feature arriba (`docs/verification.md`), repetir el comando de T10.
  T10 queda sin `[x]`.
- **O1 (T6, informativo) — enmienda fuera de `design.md > 10`.** `tests/unit/brand/brand-logo.test.tsx`
  R26 (QC-226) exigía precargar el logo vertical del login; `design.md > 5` decide dejarlo sin
  precarga. frontend_dev lo enmendó con nota `ENMIENDA QC-260` y se añadió a `## Archivos
  esperados`, pero la fila no está en la tabla de enmiendas de `design.md > 10`: conviene añadirla.

## T2 y T4 (frontend_dev)

- Archivos: `components/shared/notice.tsx` (prop `id`), `components/shared/submit-button.tsx`
  (`Spinner size="sm"` delante del texto pendiente), `components/shared/CATALOGO.md` (filas de
  `Notice` y `SubmitButton`), `tests/unit/shared-ui/notice.test.tsx`,
  `tests/unit/shared-ui/submit-button.test.tsx`.
- Mapa: R18 (id citable) → `notice.test.tsx > QC-260 R18 — el id opcional va al contenedor…`;
  R12, R21 (indicador de la pieza) → `submit-button.test.tsx > QC-260 R12, R21 — mientras envía
  pinta el Spinner…` (los casos de pantalla van en T6/T7).
- `pnpm run typecheck` → verde (tras `pnpm exec next typegen`; sin él falla `LayoutProps` en
  `app/layout.tsx`, ajeno). `pnpm run lint` → 0 errors, 7 warnings preexistentes.
- `vitest related` → 119 passed, 1 failed: `login-paridad > R1 R2 — enviando`, snapshot con el
  único añadido `svg aria-hidden="true" … lucide-loader-circle size-4`. Esperado; se regenera en T6.
- Guardias catálogo + catalogo-qc256 + formularios-y-acciones → 85 passed, 3 skipped.
- Veredicto: T2 y T4 hechas; solo queda el snapshot de paridad para T6.

## T5 — `AccessScreen` y el bloque CSS de acceso (frontend_dev, 2026-10-12)

### Archivos

- `components/shared/access-screen.tsx` (nuevo, Server Component): `main data-access="screen"`
  con `min-h-dvh` y centrado flex; capa `data-access="molecules" aria-hidden="true"` con las cinco
  moléculas del tablero `Login` (`svg data-access="molecule" data-access-index="1..5"`,
  `focusable="false"`, `currentColor`); `Card data-access="card" data-width`.
- `components/shared/CATALOGO.md`: fila `AccessScreen` en Compuestos (`Base de` `Card`, `Diseño`
  `docs/diseno/canvas/Login.dc.html`).
- `app/globals.css`: «Pantalla de login — INICIO/FIN» → «Pantallas de acceso — INICIO/FIN». Fuera
  `--login-*`, vidrio, `@supports`, `prefers-reduced-transparency`, `login-card-enter`,
  `login-card-fade`, `login-molecule-float`, los 44 px forzados. Dentro: `--shadow-dlg` (valor de
  `qc.css`, acotado a `[data-access='screen']`), fondo `var(--sidebar-panel-gradient)`, padding
  `40px 16px`, cinco moléculas (70/55/90/48/40 s, lineal, sentido alterno), `@keyframes
  access-molecule-spin`, tarjeta 400/440 px, radio 18 px, relleno `32px 28px 20px` /
  `28px 28px 24px`, entrada escalonada con `screen-enter` (0/40/80/120/160/200 ms) y movimiento
  reducido (`animation: none` en moléculas e hijos de la tarjeta).
- `tests/guards/guard-movimiento.test.ts`: delimitadores y caso negativo a «Pantallas de acceso»,
  nota `ENMIENDA QC-260`.
- `tests/unit/acceso/access-screen.test.tsx` (nuevo).

### Desviaciones

- `gap` de la tarjeta 20 px (default) / 18 px (wide): no está en design § 3.1, sale de los tableros
  `Login` y `EstablecerContrasena`.
- Con `labelledBy`, la tarjeta lleva `role="region"`: un `div` sin rol no admite nombre accesible
  (ARIA 1.2 lo prohíbe en `generic`). Sin `labelledBy`, sin rol.
- El estado de éxito del tablero `EstablecerContrasena` usa relleno `36px 28px 28px` y centrado;
  el spec no lo recoge y no se implementa (T7 decide si lo pide).
- Movimiento reducido: `animation: none` en los hijos de la tarjeta (en vez de anular solo el
  retardo): aparecen en su sitio, sin desplazamiento ni fundido.

### Mapa R → test

| R | Test |
|---|---|
| R1 | `tests/unit/acceso/access-screen.test.tsx > R1: …` (5 casos) |
| R2 | `tests/unit/acceso/access-screen.test.tsx > R2: …` (4 casos) |
| R5 | `tests/unit/acceso/access-screen.test.tsx > R5: …` (2 casos) |
| R6 | `tests/unit/acceso/access-screen.test.tsx > R6: …` (2 casos) |

### Salida

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 7 problems (0 errors, 7 warnings)` (avisos preexistentes en
  `tests/unit/documentos/confirm-catalog-import.test.ts` y `tests/unit/pedidos/order-service.test.ts`).
- `pnpm exec vitest related --run <archivos de T5>`: `Test Files 5 passed (5) · Tests 68 passed (68)`.
- `pnpm exec vitest run guard`: `Test Files 71 passed (71) · Tests 977 passed | 18 skipped (995)`.
- Rojos esperados (los enmienda T6), `vitest run` de esos archivos: `Tests 28 failed | 85 passed`.
  - `tests/unit/login-skin.test.tsx`: 23 casos del «nivel 1 · contrato de texto del CSS» (R17–R23,
    R32 de QC-226 y las medidas de QC-30).
  - `tests/unit/theme/color-tokens.test.ts`: «R32 (ENMIENDA QC-228): el bloque del login conserva
    su movimiento…».
  - `tests/unit/theme/motion-tokens.test.ts`: R21 (0.01 ms; indicadores en bucle) y R22 (la regla
    global no cambia el nombre de ninguna animación): ya no excluyen el bloque renombrado.
  - `tests/unit/paridad/login-paridad.test.tsx`: «R1 R2 — enviando», por el `Spinner` de T4, no
    por T5.
  - `tests/unit/identity/login-page-marca.test.tsx`: verde (lee el `data-login` del JSX, que T5 no
    toca).

Veredicto: T5 hecha; unit, guardia de movimiento y guardia del catálogo en verde.
