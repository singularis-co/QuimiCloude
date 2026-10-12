# QC-260 — Diseño técnico

## Lo que ya existe

**Términos buscados.** Board (`feature_list.json`, todos los estados): `login`, `contraseña`,
`acceso`, `sesión`. Specs: `grep -ril` de `login`, `establecer-contrasena`, `CredentialInput`,
`PasswordField`, `LoginBackground`. Grafo (proyecto del worktree): `search_graph` sobre
`app/(public)/**` y la consulta «auth screen background molecules brand gradient public card»;
`trace_path` y `Grep` de los consumidores de `SubmitButton`, `PasswordField`,
`CREDENTIAL_RULE_LABELS`. `progress/features/QC-260.md` no existe todavía.

**Qué apareció y qué se hace con ello.**

| Hallazgo | Qué es | Decisión |
|---|---|---|
| QC-10, QC-30, QC-226 (done) | La pantalla de login, su primera piel y la de marca (vidrio oscuro, tres isotipos que flotan) | Es la pantalla que se rediseña. QC-226 R16–R22 quedan enmendados (§ 10) |
| QC-79 (done) | La página pública `/establecer-contrasena/[token]` y su Server Action | Se rediseña su presentación; acción, estados y garantías (R17, R18, R24 de QC-79) no se tocan |
| QC-21 (done) | `CredentialRequirements` y `CREDENTIAL_RULE_LABELS`, redacción marcada como provisional | Se reutilizan; la redacción gana tildes (R26) |
| QC-256 (done) | `PasswordField`, `Notice`, `ArrowLink`, `Spinner`, tallas de `Button`. Su § 3 deja expresamente para QC-260 «poner `PasswordField` en el login y en establecer contraseña» | Se reutilizan; `Notice` y `SubmitButton` se extienden (§ 3) |
| QC-259 (pending), QC-96 (spec_ready) | Recuperar contraseña: la ruta `/recuperar-contrasena` | No se solapan: esta ficha solo pinta el enlace (R13). QC-259 podrá reutilizar `AccessScreen` |
| `LoginBackground` (`app/(public)/login/components/login-background.tsx`) | Los tres isotipos de QC-226 | Lo absorbe `AccessScreen` y se borra |
| `CredentialInput` y la fachada `SubmitButton` de `app/(public)/establecer-contrasena/[token]/components/` | Campo con ojo propio de QC-79 y envoltorio del botón compartido | Se borran: los sustituyen `PasswordField` y `SubmitButton` compartido (D12, R29) |
| `--sidebar-panel-gradient` y `@keyframes screen-enter` en `app/globals.css` | El degradado de la barra lateral (= `--side` del tablero) y la entrada escalonada de QC-228 | Se reutilizan; no se declara ningún token nuevo |

**Filas de `components/shared/CATALOGO.md` consultadas** y paso de la regla de decisión
(`docs/perfil-agentes.md > Regla de decisión para componentes`):

| Pieza | Paso | Uso aquí |
|---|---|---|
| `Card` | 1, reutiliza | La tarjeta de las dos pantallas (la ficha del tablero lo nombra: `ui/card`) |
| `Input`, `Label` | 1, reutiliza | El campo «Usuario» del login (la ficha nombra `ui/input · ui/label`) |
| `PasswordField` | 1, reutiliza | Los tres campos de contraseña; con `requirements` en «Contraseña nueva» |
| `CredentialRequirements`, `CREDENTIAL_RULE_LABELS` | 1, reutiliza | La lista en vivo (a través de `PasswordField`) y el texto de cada regla del aviso |
| `FieldError` | 1, reutiliza | El «no coinciden», a través de la prop `error` de `PasswordField` |
| `BrandLogo` | 1, reutiliza | El isotipo (`variant="isotipo"`, `tone="auto"`) en las dos tarjetas |
| `ArrowLink` | 1, reutiliza | «Ir a iniciar sesión» (`direction="forward"`, `touch`) |
| `Toaster` | 1, reutiliza sin cambios | El aviso de credenciales incorrectas |
| `Notice` | 2, extiende | Aviso de requisitos incumplidos; gana `id` opcional (§ 3.2) |
| `SubmitButton` | 2, extiende | Gana el `Spinner` mientras envía (§ 3.3) |
| `AccessScreen` (nueva) | 3, compón | Fondo, moléculas y tarjeta, compuesta con `Card`; sube a `shared` porque la usan dos rutas (§ 3.1) |
| `TextField` | descartada | Ver § 9, A4 |
| `ErrorAlert` | sin decidir | Ver P3 |

**Pase `/design`.** Todos los tableros están aprobados (D14) y versionados:
`docs/diseno/canvas/Login.dc.html`, `docs/diseno/canvas/LoginTablet.dc.html`,
`docs/diseno/canvas/LoginMovil.dc.html` (ficha), `docs/diseno/canvas/EstablecerContrasena.dc.html`,
`docs/diseno/canvas/EstablecerContrasenaTablet.dc.html`,
`docs/diseno/canvas/EstablecerContrasenaMovil.dc.html` (ficha), y para las piezas
`docs/diseno/canvas/Botones.dc.html` (botón enviando con spinner), `docs/diseno/canvas/Campos.dc.html`
(`PasswordField`) y `docs/diseno/canvas/Avisos.dc.html` (`Notice`). `AccessScreen` cita
`Login.dc.html` en su fila.

## 1. Modelo de datos

Ninguno. Sin tablas, sin RLS, sin migraciones, sin variables de entorno.

## 2. Rutas

Las mismas dos, sin rutas nuevas: `app/(public)/login/page.tsx` y
`app/(public)/establecer-contrasena/[token]/page.tsx`. Siguen siendo Server Components; los
formularios siguen siendo `'use client'` con `useActionState` sobre las mismas actions, importadas
por su ruta exacta. `app/(public)/layout.tsx` no cambia (sigue montando el `Toaster`).

## 3. Contratos de las piezas

### 3.1 `AccessScreen` — `components/shared/access-screen.tsx` (nueva, paso 3)

```ts
export type AccessScreenProps = {
  readonly children: ReactNode;        // contenido de la tarjeta
  readonly width?: 'default' | 'wide'; // 400 px (login) | 440 px (establecer)
  readonly labelledBy?: string;        // id del h1, para la tarjeta
  readonly testId?: string;            // data-testid del <main>
};
```

Pinta:

```
<main data-access="screen" data-testid={testId} class="min-h-dvh …">   ← único main (R1)
  <div data-access="molecules" aria-hidden="true">                    ← R2
    <svg data-access="molecule" data-access-index="1..5" …/>
  </div>
  <Card data-access="card" data-width={width} aria-labelledby={labelledBy}>   ← R5, R9, R14
    {children}
  </Card>
</main>
```

- **Fondo:** `var(--sidebar-panel-gradient)`, que ya tiene valor en claro y en oscuro (R1, R6). Sin
  clase `dark` en el `main`: los tokens son los del tema de la app (R6, P1).
- **Moléculas:** las cinco del tablero `Login` (tamaños 140/96/170/80/60 px, posiciones y trazos
  del tablero, `currentColor` blanco al 13 %), girando con `rotate` en 70/55/90/48/40 s, lineal,
  alternando el sentido (R3). *Desviación declarada:* `EstablecerContrasena.dc.html` dibuja cuatro
  moléculas en otras posiciones; se usa el mismo juego en las dos pantallas para que la pieza no
  tenga un parámetro de decoración.
- **Tarjeta:** `Card` con 400 / 440 px de ancho máximo, `width: 100%`, radio 18 px, sombra
  `--shadow-dlg` del tablero (valor de `qc.css`, se declara en el bloque CSS de § 4), relleno
  `32px 28px 20px` (login) / `28px 28px 24px` (establecer). En teléfono, 16 px de margen lateral
  (padding del `main`: `40px 16px`) (R7).
- **Entrada escalonada:** los hijos directos de la tarjeta usan `@keyframes screen-enter` (ya
  existe, QC-228) con retardos 0/40/80/120/160/200 ms del tablero; con movimiento reducido el
  bloque global de QC-228 corta el desplazamiento (R4, R5). Al pasar al éxito, la tarjeta se monta
  de nuevo (`key`) y la entrada se repite (R5).
- **Sin estado, sin `'use client'`**: es un Server Component que se puede pintar desde `page.tsx` y
  desde el formulario cliente.

### 3.2 `Notice` — prop opcional `id` (paso 2)

`readonly id?: string` se pasa al `Alert` raíz. Hace falta para que «Contraseña nueva» lo cite en su
`aria-describedby` (R18). Los consumidores actuales no cambian.

### 3.3 `SubmitButton` — indicador de carga (paso 2, cambio visual)

Mientras `pending`, pinta `<Spinner size="sm" />` (ya oculto a lectores) delante del texto
pendiente (R12, R21). Firma sin cambios. Sus únicos consumidores son las dos pantallas de esta
ficha (comprobado por `Grep` de `@/components/shared/submit-button`), así que no se añade prop para
activarlo: el tablero `Botones` lo pide para todo envío. La fila del catálogo pasa de
`previo al rediseño` a `docs/diseno/canvas/Botones.dc.html` y gana `Spinner` en `Base de`.

### 3.4 `PasswordField` — sin cambios

Se usa tal cual:

| Pantalla | Props |
|---|---|
| Login | `name="password"`, `id="password"`, `label="Contraseña"`, `autoComplete="current-password"`, `error={passwordError}`, `testId="login-password"` |
| Establecer, nueva | `name="credential"`, `id="credential"`, `autoComplete="new-password"`, `texts={{ show, hide }}`, `describedBy={invalid ? 'set-credential-feedback' : undefined}`, `testId="set-credential-credential"`, `requirements={{}}` |
| Establecer, repetir | `name="credentialConfirmation"`, `id="credential-confirmation"`, `autoComplete="new-password"`, `texts`, `error={mismatch ? labels.mismatch : undefined}`, `testId="set-credential-confirmation"` |

Consecuencias que se aceptan:

- En el login, `PasswordField` compone el id del error como `${id}-error` = `password-error`, el
  mismo `PASSWORD_ERROR_ID` de hoy, y el testid `login-password-error` (R11). El error gana
  `role="alert"` (`FieldError` lo pone por defecto); antes no lo tenía.
- El «no coinciden» pasa de `data-testid="set-credential-mismatch"` a
  `set-credential-confirmation-error` (lo compone `PasswordField`). Enmienda de test en § 10.
- Con `requirements`, `aria-describedby` de «Contraseña nueva» es la unión del aviso y de la lista
  (`set-credential-feedback credential-requirements`). El test de QC-79 que lo comparaba entero
  pasa a comprobar que lo contiene (§ 10).
- `breachedState` no se pasa: la séptima queda `unknown` = «pendiente» (R17). El veredicto del
  servidor sobre ella sale en el aviso de R18.

## 4. CSS — `app/globals.css`

El bloque delimitado «Pantalla de login — INICIO/FIN» pasa a «Pantallas de acceso — INICIO/FIN»
y sus selectores de `[data-login=…]` a `[data-access=…]`. Es la única zona del CSS donde la guardia
de movimiento deja pasar un bucle `infinite` (el giro de las moléculas), y ahora la usan dos
pantallas. Se quitan del bloque: `--login-screen-background`, el vidrio (`--login-card-glass`,
`backdrop-filter`, `@supports`, `prefers-reduced-transparency`), `login-card-enter`,
`login-card-fade` y `login-molecule-float`. Entran: `@keyframes access-molecule-spin`
(`rotate(360deg)`), las posiciones de las cinco moléculas, la tarjeta (ancho, radio, relleno,
sombra), la entrada escalonada y la regla de movimiento reducido que para las moléculas (R4).

Los 44 px de campos y botones ya los dan `PasswordField`, `SubmitButton` (`touch`) y el campo
«Usuario» con `h-11 text-base md:text-base`; el bloque ya no necesita forzar `min-height`.

## 5. Login — `app/(public)/login/`

- `page.tsx`: `pantallaDeLogin(next)` devuelve
  `<AccessScreen width="default" labelledBy="login-heading">` con: `h1#login-heading` (isotipo
  `BrandLogo variant="isotipo" tone="auto" height={56} alt=""` + la marca escrita
  «Quimi» + «Cloude» en `--primary` y peso 600; el nombre accesible es el texto, `BRAND_LABEL`), el
  `LoginForm` y el pie con el enlace (`min-h-11`, borde superior) (R9, R13). El resto de la página
  (destino de vuelta, `searchParams`) no cambia.
- Precarga del logo («Por confirmar» de la ficha `LoginMovil`): `BrandLogo` con `tone="auto"`
  pinta dos imágenes y no admite `preload`. Se deja sin precarga: qué elemento es el LCP con el
  `h1` de texto no está medido, y extender `BrandLogo` sin esa medida sería adivinar.
- `login-form.tsx`: «Contraseña» pasa a `PasswordField` (R10). «Usuario» sigue con `Input` +
  `Label` no controlado con su `key` de remontaje y su `defaultValue` (R11), con
  `h-11 text-base md:text-base`. `SubmitButton` sigue con `className="w-full"`. El efecto del
  aviso emergente no cambia.
- `login-background.tsx` se borra y sale del barrel `components/index.ts`.

## 6. Establecer contraseña — `app/(public)/establecer-contrasena/[token]/`

- `page.tsx`: `<AccessScreen width="wide" labelledBy=… testId="set-credential-screen">` con el
  `<meta name="referrer">` y `<SetCredentialForm secret={token} />`. La cabecera (isotipo de 40 px
  con `alt={BRAND_LABEL}`, `h1`, introducción) la pinta el formulario, porque el éxito la sustituye
  (R14, R22).
- `set-credential-form.tsx`:
  - formulario: cabecera, `PasswordField` nueva con `requirements` (R16, R17), `PasswordField`
    repetir (R15, R19), `Notice tone="danger" id="set-credential-feedback"
    title={unmetIntro} testId=…` con la lista `set-credential-unmet` cuando
    `invalid_credential` (R18), el error de catálogo de hoy (R23) y `SubmitButton`.
  - éxito: icono `CircleCheck` en el recuadro de éxito del tablero (`dlg-ic success`: 44 px, radio
    12, `--success-subtle` / `--success-text`), `h1` «Contraseña establecida», texto y
    `ArrowLink direction="forward" touch href={LOGIN_ROUTE} className="w-full"
    testId="set-credential-login-link"` (R22).
  - `R20`: ver § 8, riesgo 1.
- `set-credential-labels.ts`: los textos de R25 con tildes.
- `credential-input.tsx` y `submit-button.tsx` se borran y salen del barrel.

## 7. Textos — `components/shared/credential-rule-labels.ts`

La redacción de R26 con tildes. El propio archivo la declara provisional y dice que cambiarla «es
un cambio de una línea en este archivo». Los números siguen interpolados de
`CREDENTIAL_MIN_LENGTH` / `CREDENTIAL_MAX_LENGTH` (el contrato de QC-21 prohíbe literales
numéricos en ese archivo, en `credential-requirements.tsx` y en `password-field.tsx`).

## 8. Riesgos

1. **Campo controlado y reinicio del formulario (R20).** Con `requirements`, `PasswordField` lleva
   la contraseña en un `useState`. React 19 reinicia el `<form>` al terminar la Server Action: si
   el DOM se vacía y el estado no, la lista diría «cumplido» sobre un campo vacío. No está medido en
   este repo. Se prueba primero (T3) con un test que dispara un rechazo y compara el valor visible
   con la lista. Si se desincroniza, la corrección vive en el formulario de la ruta (remontar el
   campo con `key` por intento, como el `username` del login), no en `PasswordField`.
2. **Tests de specs cerrados.** Las aserciones de QC-226 sobre el login (tokens oscuros, tres
   isotipos que flotan, `login-card-enter`) dejan de valer por diseño; se enmiendan con nota, no se
   borran sin más (§ 10).
3. **`app/globals.css` es un archivo caliente.** Otra ficha en vuelo puede tocarlo; lo detecta
   `scripts/archivos-en-vuelo.mjs` por la lista de `tasks.md`.

## 9. Alternativas descartadas

- **A1. Pintar el fondo en `app/(public)/layout.tsx`.** Ahorra la pieza compartida, pero impone el
  fondo a toda ruta pública presente y futura, sin opción a no tenerlo, y la tarjeta, su ancho y su
  entrada seguirían repetidos en cada página. Una pieza que se elige es más honesta que un layout
  que se impone.
- **A2. Dejar `LoginBackground` en la ruta del login y copiarlo en establecer contraseña.** Dos
  copias del mismo fondo que divergen; incumple la regla de subir a `shared` en la segunda ruta.
- **A3. Validar la contraseña en el navegador antes de enviar, como el prototipo del tablero.** Es
  lógica nueva (bloquear el envío según las reglas locales) y la ficha es solo presentación. El
  servidor ya devuelve las reglas incumplidas y el aviso de R18 las pinta igual que el tablero; lo
  único que cambia es un viaje al servidor.
- **A4. `TextField` para «Usuario».** Es la pieza de campo de 44 px, pero cambia el id del error
  (`username-error`) y el mecanismo de remontaje que el contrato de QC-10 fija (R11), y la ficha
  del tablero nombra `ui/input · ui/label`.
- **A5. Prop `spinner` opcional en `SubmitButton`.** Una prop sin ningún consumidor que la apague;
  sobre-ingeniería.
- **A6. Conservar los selectores `data-login` en las dos pantallas.** Menos churn en los tests,
  pero la pantalla de establecer contraseña quedaría marcada como «login»; el bloque se renombra y
  la guardia se enmienda una vez.

## 10. Enmiendas a specs cerrados

| Spec | Qué cambia | Por qué |
|---|---|---|
| QC-226 R16 | El `h1` lleva isotipo y marca escrita, no el logo vertical; el nombre accesible sigue siendo `BRAND_LABEL` | Tablero `Login` (D14) — R9 |
| QC-226 R17 | Tokens del tema activo, no forzados a oscuro; fondo `--sidebar-panel-gradient` | Tablero `Login` (D14) — R1, R6, P1 |
| QC-226 R18–R20 | Cinco moléculas que giran 40–90 s en lugar de tres isotipos que flotan 22–30 s; tarjeta opaca con `--shadow-dlg`, sin vidrio | Tablero `Login` — R2, R3 |
| QC-226 R21–R22, QC-228 | Entrada escalonada de los bloques en vez de la entrada única de la tarjeta; con movimiento reducido, quietas y sin desplazamiento | Ficha `LoginMovil > Animación` — R4, R5 |
| QC-228 (`guard-movimiento`) | Los delimitadores del bloque exento pasan a «Pantallas de acceso — INICIO/FIN» | § 4 |
| QC-30 | Se mantienen 400 px y radio 18 px; el relleno pasa a `32px 28px 20px` | Tablero `Login` |
| QC-79 (`set-credential-form.test.tsx`) | `set-credential-mismatch` → `set-credential-confirmation-error`; `aria-describedby` se comprueba por inclusión; desaparecen los casos de `CredentialInput` como pieza local | § 3.4 |
| QC-21 | Redacción de `CREDENTIAL_RULE_LABELS` con tildes | D9 — R26 |
| QC-10 (`login-paridad`) | El snapshot se regenera en su propio commit, con control de diff | § 5 |

## 11. Trazabilidad prevista

| R | Test |
|---|---|
| R1, R2, R5, R6, R9, R13, R14 | `tests/unit/acceso/access-screen.test.tsx`, `tests/unit/acceso/login-rediseno.test.tsx`, `tests/unit/acceso/establecer-contrasena-rediseno.test.tsx` |
| R3, R4, R6, R7, R8 | `e2e/acceso-rediseno.spec.ts` (chromium y webkit; estilo computado, sin capturas) |
| R10, R11, R12 | `tests/unit/acceso/login-rediseno.test.tsx`, `tests/unit/login-form.test.tsx` (sin editar aserciones de comportamiento), `e2e/login.spec.ts` |
| R15–R22 | `tests/unit/acceso/establecer-contrasena-rediseno.test.tsx`, `tests/unit/identity-ui/set-credential-form.test.tsx` |
| R20 | además `e2e/acceso-rediseno.spec.ts` si el riesgo 1 se reproduce solo en navegador |
| R23, R24 | `tests/unit/identity-ui/set-credential-form.test.tsx`, `e2e/establecer-contrasena.spec.ts` |
| R25, R26 | `tests/unit/acceso/textos-acceso.test.tsx` |
| R27 | `tests/guards/guard-qc260-limites-de-la-ficha.test.ts` (diff contra el merge-base; fuera de la rama, `skip` ruidoso, como `guard-piezas-base`) |
| R28 | `tests/guards/guard-catalogo-de-componentes.test.ts` |
| R29 | `tests/guards/guard-qc260-limites-de-la-ficha.test.ts` (censo de `app/`: ningún `type="password"` ni `aria-pressed` de ojo fuera de `PasswordField`) |

## 12. Multiplataforma

Sin excepciones. `min-h-dvh`, 16 px en campos, objetivos de 44 px, el ojo es un botón con
`aria-pressed` (nunca `:hover`), el giro se para con movimiento reducido. La flecha de `ArrowLink`
solo se mueve con `hover: hover`. Se verifica en webkit (`playwright.config.ts`).

## 13. Dependencias

Ninguna nueva. `lucide-react` y `@base-ui/react` ya están; las fichas del tablero lo confirman
(«ninguna nueva»).
