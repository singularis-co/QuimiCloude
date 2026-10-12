# QC-260 — Rediseño de acceso: login y establecer contraseña

## Alcance

Llevar `/login` y `/establecer-contrasena/[token]` al diseño aprobado del canvas (página 2 del
canvas: tableros `Login`, `LoginTablet`, `LoginMovil`, `EstablecerContrasena`,
`EstablecerContrasenaTablet` y `EstablecerContrasenaMovil`, copiados en `docs/diseno/canvas/`), en
escritorio (1440), tablet (820) y teléfono (390). Fuente de las decisiones: `progress/rediseno.md`
(D7, D8, D9, D12, D14).

Lo que entra:

- El fondo de marca con moléculas que giran, la tarjeta y su entrada escalonada, en las dos
  pantallas.
- El ojo de mostrar u ocultar en **todos** los campos de contraseña, también en el login (D12), con
  la pieza compartida `PasswordField`.
- Botones de envío táctiles de 44 px con indicador de carga mientras se envía (D7, tablero
  `Botones`).
- La lista de requisitos que se marca mientras se escribe, el aviso de requisitos incumplidos y el
  error de «no coinciden» con el diseño del tablero.
- El estado de éxito de establecer contraseña en la misma tarjeta.
- Los textos de las dos pantallas con su ortografía (D9): «contraseña», «sesión», «mayúscula»,
  «minúscula», «número», «símbolo», «máximo», «todavía», «repítela».

Lo que NO entra:

- Ningún cambio de backend ni de lógica de autenticación: ni `loginAction`, ni
  `setCredentialWithLinkAction`, ni sus estados, ni la política de contraseñas, ni el middleware,
  ni la base de datos.
- La ruta `/recuperar-contrasena` (QC-259, D8). El enlace «¿Olvidaste tu contraseña?» se queda y
  sigue apuntando a ella.
- Validar la contraseña en el navegador antes de enviar: el prototipo del tablero lo simula, pero
  aquí el veredicto sigue llegando del servidor (ver `design.md > 9`, A3).
- Una pantalla propia para el enlace caducado («Por confirmar» del tablero).
- Cambiar el aspecto del `Toaster` (sigue como está en el layout público).
- Controles que el tablero no tiene: «recordarme», ilustración lateral.

## Decisiones cerradas (no reabrir)

| # | Decisión | Fuente | Requisitos |
|---|---|---|---|
| C1 | El diseño de las dos pantallas es el de los seis tableros de acceso del canvas; lo demás del canvas queda aprobado | humano, 2026-10-10 (D14) | R1–R24 |
| C2 | Un único campo de contraseña con ojo, `PasswordField`, en todo lugar donde se escriba una contraseña, login incluido; `CredentialInput` desaparece | humano, 2026-10-10 (D12) | R10, R15, R29 |
| C3 | Botón táctil de 44 px | humano, 2026-10-10 (D7) | R8, R12, R21 |
| C4 | Textos con tildes y sin voseo | humano, 2026-10-10 (D9) | R25, R26 |
| C5 | Solo presentación: sin cambios de backend ni de lógica de autenticación; si el diseño exige lógica nueva, va a preguntas abiertas | leader, 2026-10-12 (encargo de la ficha) | R11, R24, R27 |
| C6 | «¿Olvidaste tu contraseña?» se queda: la ruta la construye QC-259 | humano, 2026-10-10 (D8) | R13 |
| C7 | Se reutiliza antes de crear (reutiliza, extiende, compón, crea) y toda pieza nueva o con cambio visual cita su tablero | humano, 2026-10-10 (regla dura) | R28, R29 |

## Requisitos (EARS)

### Las dos pantallas

**R1.** El sistema DEBE pintar `/login` y `/establecer-contrasena/[token]` con un único `main` que
ocupe al menos el alto de la ventana medido en `dvh` (nunca `100vh`), sobre el degradado de marca
de la barra lateral, con la tarjeta centrada en horizontal y en vertical.

**R2.** El sistema DEBE pintar detrás de la tarjeta moléculas decorativas ocultas a las tecnologías
de asistencia, sin nodos enfocables y sin captar el puntero.

**R3.** MIENTRAS el sistema operativo no pide movimiento reducido, el sistema DEBE girar cada
molécula en bucle con un ciclo de entre 40 s y 90 s.

**R4.** MIENTRAS el sistema operativo pide movimiento reducido, el sistema DEBE dejar las moléculas
visibles y quietas, y DEBE mostrar los bloques de la tarjeta sin desplazamiento.

**R5.** CUANDO se abre cualquiera de las dos pantallas, o CUANDO establecer contraseña pasa al
estado de éxito, el sistema DEBE hacer entrar los bloques de la tarjeta escalonados, de abajo
arriba y una sola vez.

**R6.** El sistema DEBE pintar las dos pantallas con los tokens del tema activo de la aplicación,
claro u oscuro, sin forzar el oscuro. *(Enmienda QC-226 R17; ver P1.)*

**R7.** CUANDO la ventana mide 390 px de ancho, el sistema NO DEBE provocar scroll horizontal y
DEBE dejar al menos 16 px entre la tarjeta y cada borde lateral; CUANDO mide 820 px o 1440 px, la
tarjeta DEBE quedar centrada en su ancho máximo.

**R8.** El sistema DEBE pintar cada campo de texto o contraseña de las dos pantallas con al menos
44 px de alto y 16 px de letra, y cada control accionable (botón de envío, ojo, enlace de
recuperación, enlace «Ir a iniciar sesión») con un objetivo de al menos 44 × 44 px, en las tres
anchuras de R7.

### Login

**R9.** El sistema DEBE pintar la tarjeta del login con un ancho máximo de 400 px y, en su
cabecera, un único `h1` que contenga el isotipo y la marca escrita y cuyo nombre accesible sea
`BRAND_LABEL`. *(Enmienda QC-226 R16: ya no es el logo vertical.)*

**R10.** El sistema DEBE ofrecer en el campo «Contraseña» del login un botón de mostrar u ocultar
con `aria-pressed`, `aria-controls` apuntando al campo y nombre accesible «Mostrar la contraseña»
u «Ocultar la contraseña» según el estado. CUANDO se pulsa, el sistema DEBE alternar el campo
entre oculto y visible sin enviar el formulario.

**R11.** El sistema DEBE conservar el contrato del formulario de login: campos `username`,
`password` y el oculto del destino de vuelta; los `data-testid` `login-form`, `login-username`,
`login-password`, `login-submit`, `login-next`, `login-username-error`, `login-password-error` y
`login-forgot-password`; los errores de campo enlazados con `aria-describedby` e `aria-invalid`;
el usuario conservado y la contraseña vacía tras un intento rechazado; y un único aviso emergente
con `GENERIC_CREDENTIALS_ERROR` por intento fallido.

**R12.** MIENTRAS el formulario de login se envía, el sistema DEBE pintar el botón con el texto
«Entrando…», un indicador de carga oculto a las tecnologías de asistencia, deshabilitado y con
`aria-busy`; el botón DEBE ocupar todo el ancho de la tarjeta.

**R13.** El sistema DEBE pintar «¿Olvidaste tu contraseña?» como enlace a `FORGOT_PASSWORD_ROUTE`,
fuera del `<form>`, al pie de la tarjeta y separado del formulario por un borde.

### Establecer contraseña

**R14.** El sistema DEBE pintar la tarjeta de establecer contraseña con un ancho máximo de 440 px,
el isotipo con nombre accesible `BRAND_LABEL`, un único `h1` «Establece tu contraseña» y el texto
de introducción.

**R15.** El sistema DEBE ofrecer en «Contraseña nueva» y en «Repite la contraseña» el mismo botón
de mostrar u ocultar de R10, cada uno controlando solo su campo, con `autocomplete="new-password"`
y los nombres `credential` y `credentialConfirmation` en el formulario.

**R16.** MIENTRAS se escribe en «Contraseña nueva», el sistema DEBE mostrar en un panel bajo el
campo los siete requisitos de la política, enlazados al campo por `aria-describedby`, y DEBE
marcar en cada pulsación cada uno de los seis comprobables en el navegador como cumplido o
pendiente, con color, icono y un texto para lectores de pantalla.

**R17.** El sistema DEBE mostrar el requisito «No debe figurar en una lista de credenciales
filtradas» como pendiente en la lista de R16, porque solo lo comprueba el servidor.

**R18.** CUANDO el servidor rechaza la contraseña por la política, el sistema DEBE mostrar un aviso
de peligro con el título «La contraseña todavía no cumple estos requisitos:» y la lista de cada
regla incumplida que devolvió el servidor, filtradas incluida, y el campo «Contraseña nueva» DEBE
referenciar ese aviso en su `aria-describedby`.

**R19.** CUANDO el servidor responde que las dos contraseñas no coinciden, el sistema DEBE mostrar
«Las dos contraseñas no coinciden.» bajo «Repite la contraseña» como error de ese campo
(`aria-invalid`, `aria-describedby`, `role="alert"`) y NO DEBE mostrar el aviso de R18.

**R20.** CUANDO el servidor rechaza el envío, el sistema DEBE mantener la lista de requisitos de
R16 de acuerdo con el contenido visible del campo «Contraseña nueva»: si el campo queda vacío, la
lista DEBE mostrar el estado de un campo vacío.

**R21.** MIENTRAS el formulario de establecer contraseña se envía, el sistema DEBE pintar el botón
con el texto «Guardando…», un indicador de carga oculto a las tecnologías de asistencia,
deshabilitado y con `aria-busy`; el botón DEBE ocupar todo el ancho de la tarjeta.

**R22.** CUANDO el servidor confirma la contraseña, el sistema DEBE sustituir el formulario, en la
misma tarjeta, por el estado de éxito: un icono de éxito oculto a las tecnologías de asistencia, un
`h1` «Contraseña establecida», el texto «Ya puedes entrar con ella.» y un **enlace** (no un botón)
«Ir a iniciar sesión» con flecha, a todo el ancho, hacia `LOGIN_ROUTE`; y NO DEBE abrir sesión.

**R23.** SI el servidor responde con un error de catálogo o inesperado, ENTONCES el sistema DEBE
mostrar dentro de la tarjeta su mensaje con `role="alert"` y, si es inesperado, la referencia del
fallo, con los `data-testid` `set-credential-error` y `set-credential-error-reference`. *(Forma
visual: P3.)*

**R24.** El sistema DEBE conservar en establecer contraseña las garantías de QC-79: ningún dato de
la persona antes, durante ni después; `<meta name="referrer" content="no-referrer">`; ningún
recurso de otro origen; el secreto solo en un campo oculto del formulario; y la página no valida
el enlace al pintarse. Los `data-testid` `set-credential-screen`, `set-credential-form`,
`set-credential-secret`, `set-credential-credential`, `set-credential-confirmation`,
`set-credential-submit`, `set-credential-unmet`, `set-credential-success` y
`set-credential-login-link` DEBEN seguir existiendo.

### Textos

**R25.** El sistema DEBE mostrar en las dos pantallas exactamente estos textos visibles y nombres
accesibles, con su ortografía:

| Dónde | Texto |
|---|---|
| Login, etiquetas | «Usuario», «Contraseña» |
| Login, botón | «Entrar» / «Entrando…» |
| Login, pie | «¿Olvidaste tu contraseña?» |
| Ojo, las dos pantallas | «Mostrar la contraseña» / «Ocultar la contraseña» |
| Establecer, cabecera | «Establece tu contraseña» · «Escribe la contraseña con la que vas a entrar y repítela para confirmarla.» |
| Establecer, etiquetas | «Contraseña nueva», «Repite la contraseña» |
| Establecer, botón | «Guardar contraseña» / «Guardando…» |
| Establecer, errores | «Las dos contraseñas no coinciden.» · «La contraseña todavía no cumple estos requisitos:» · «Referencia del fallo:» |
| Establecer, éxito | «Contraseña establecida» · «Ya puedes entrar con ella.» · «Ir a iniciar sesión» |

Ningún texto visible de las dos pantallas DEBE contener las formas sin tilde `contrasena`,
`sesion`, `todavia` ni `repitela`.

**R26.** El sistema DEBE nombrar los siete requisitos de la política así, en la lista de R16 y en el
aviso de R18: «Al menos 8 caracteres», «Como máximo 64 caracteres», «Al menos una letra
mayúscula», «Al menos una letra minúscula», «Al menos un número», «Al menos un símbolo que no sea
letra ni número», «No debe figurar en una lista de credenciales filtradas» (los números salen de
los límites del dominio, no se escriben a mano).

### Alcance y piezas

**R27.** El cambio de esta ficha NO DEBE modificar ningún archivo bajo `lib/`, `db/` ni
`middleware.ts`.

**R28.** Cada pieza compartida creada o extendida por esta ficha DEBE tener su fila al día en
`components/shared/CATALOGO.md`, con su tablero aprobado en la columna `Diseño`, y la guardia del
catálogo DEBE quedar en verde.

**R29.** El sistema NO DEBE contener otro campo de contraseña con ojo que `PasswordField`: ningún
archivo de `app/` DEBE pintar un `<input>` de tipo `password` ni un botón de mostrar u ocultar
propios.

## Preguntas abiertas

- **P1 — Tema del acceso.** El tablero tiene variante clara y oscura y su tarjeta sigue el tema;
  QC-226 R17 (humano, 2026-10-08) pintaba el login siempre con los tokens oscuros. Este spec sigue
  el tablero (R6), que es posterior y está aprobado por D14. ¿Se confirma que el acceso sigue el
  tema de la app?
- **P2 — Alto de los campos.** Los tableros piden campos de 48 px (`in-touch`); `PasswordField` y
  `TextField` miden 44 px por la decisión D12 de QC-256. El spec usa 44 px (R8 exige ≥ 44 px). ¿Se
  quieren 48 px en el acceso? Sería un cambio visual de `PasswordField` para todos sus usos.
- **P3 — Enlace caducado o error inesperado.** El tablero no diseña este estado («el token caducado
  no tiene pantalla propia»). El spec conserva el mensaje y la referencia de hoy dentro de la
  tarjeta (R23). ¿Se pinta con `Notice` de peligro o `ErrorAlert`, o se deja como está hasta una
  ficha propia?
