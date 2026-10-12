# QC-260 — Tareas

Orden: T1 antes que nada (fija qué tests se tocan). T2–T5 son piezas y pueden ir en paralelo.
T6–T7 dependen de ellas. T8–T10 cierran. Cada tanda termina con `pnpm run typecheck`,
`pnpm run lint`, `pnpm exec vitest related --run <archivos>` y `pnpm exec vitest run guard`.

- [x] **T1. Barrido de tests afectados (antes de tocar código).** Con `Grep` sobre `tests/` y
  `e2e/`, por los nombres y textos que cambia la ficha: `LoginForm`, `LoginBackground`,
  `data-login`, `login-card-enter`, `login-molecule-float`, `login-card-fade`,
  `--login-screen-background`, `Pantalla de login — INICIO`, `SetCredentialForm`,
  `SET_CREDENTIAL_LABELS`, `CredentialInput`, `credential-input`, `set-credential-mismatch`,
  `SubmitButton`, `CREDENTIAL_RULE_LABELS`, `Notice`, y las formas sin tilde `contrasena`,
  `sesion`, `todavia`, `repitela`, `maximo`, `mayuscula`, `minuscula`, `numero`, `simbolo` dentro
  de literales (no en comentarios). Anotar en `progress/impl_QC-260.md` cada archivo con el caso
  que cambia y por qué. Lista de partida (grep del spec, 2026-10-12):
  - Unit: `tests/unit/login-form.test.tsx`, `tests/unit/login-skin.test.tsx`,
    `tests/unit/identity/login-page-marca.test.tsx`, `tests/unit/paridad/login-paridad.test.tsx`
    (+ su `.snap`), `tests/ui/login-form-uncontrolled-warning.test.tsx`,
    `tests/unit/identity-ui/set-credential-form.test.tsx`,
    `tests/unit/credential-requirements.test.tsx`, `tests/unit/credential-help-contract.test.ts`,
    `tests/unit/shared-ui/password-field.test.tsx`,
    `tests/unit/shared-ui/password-field-requisitos.test.tsx`,
    `tests/unit/shared-ui/submit-button.test.tsx`, `tests/unit/shared-ui/notice.test.tsx`,
    `tests/unit/shared-ui/catalogo-qc256.test.ts`, `tests/unit/theme/color-tokens.test.ts`,
    `tests/unit/theme/motion-tokens.test.ts`, `tests/unit/brand/brand-logo.test.tsx`.
  - Guardias: `tests/guards/guard-movimiento.test.ts` (delimitadores del bloque exento),
    `tests/guards/guard-catalogo-de-componentes.test.ts`, `tests/guards/guard-piezas-base.test.ts`
    (carpeta `establecer-contrasena` y lista de locales borrados),
    `tests/guards/guard-formularios-y-acciones.test.ts` (`useFormStatus` solo en
    `SubmitButton`), `tests/guards/guard-arquitectura-modulos.test.ts` (imports del
    `login-form.tsx`), `tests/guards/guard-identificador-de-request.test.ts` (cita la ruta de
    `login-form.tsx` como muestra).
  - E2E: `e2e/login-skin.spec.ts` (**se rompe por diseño**: tres moléculas, `login-molecule-float`,
    `login-card-enter`, tokens oscuros forzados), `e2e/login.spec.ts`, `e2e/session.spec.ts`,
    `e2e/theme.spec.ts` (corre sobre `/login`), `e2e/establecer-contrasena.spec.ts`,
    `e2e/helpers/landing.ts` y todo spec que entra por `login-username` / `login-password` /
    `login-submit`.
  - **Textos con tildes en E2E:** el grep del spec no encontró ninguna aserción E2E sobre las formas
    sin tilde (solo comentarios); los E2E localizan por `data-testid` y por
    `GENERIC_CREDENTIALS_ERROR`, que ya lleva tilde. T1 lo confirma o lista las que aparezcan.
  *Hecho:* la lista está en `progress/impl_QC-260.md` con cada caso y su motivo; cualquier test que
  no esté en este spec y aparezca se añade a la lista y a `## Archivos esperados`.

- [x] **T2 [P]. `Notice` gana `id` opcional** (`design.md > 3.2`). Caso nuevo en
  `tests/unit/shared-ui/notice.test.tsx`; fila del catálogo actualizada (puntos de extensión).
  *Hecho:* test verde; consumidores sin cambios.

- [x] **T3 [P]. Riesgo 1: `PasswordField` controlado y reinicio del formulario** (`design.md > 8`).
  Test en `tests/unit/acceso/establecer-contrasena-rediseno.test.tsx` que monta un formulario con
  `useActionState` y una action que rechaza, escribe en el campo con `requirements`, envía y
  compara el valor visible con el estado de la lista. Si se desincroniza, la corrección va en el
  formulario de la ruta (T7), no en `PasswordField`. *Hecho:* resultado anotado en
  `progress/impl_QC-260.md` y caso de R20 escrito (rojo o verde, según lo medido).

- [x] **T4 [P]. `SubmitButton` con `Spinner` mientras envía** (`design.md > 3.3`). Caso en
  `tests/unit/shared-ui/submit-button.test.tsx`; fila del catálogo con
  `docs/diseno/canvas/Botones.dc.html` y `Spinner` en `Base de`. *Hecho:* test y guardia del
  catálogo verdes.

- [x] **T5 [P]. `AccessScreen` y el bloque CSS de acceso** (`design.md > 3.1, 4`).
  `components/shared/access-screen.tsx`, fila en el catálogo con
  `docs/diseno/canvas/Login.dc.html`; bloque «Pantallas de acceso — INICIO/FIN» en
  `app/globals.css`; enmienda de los delimitadores en `tests/guards/guard-movimiento.test.ts`.
  Tests en `tests/unit/acceso/access-screen.test.tsx` (R1, R2, R5, R6). *Hecho:* unit, guardia de
  movimiento y guardia del catálogo verdes.

- [x] **T6. Login** (depende de T4, T5; `design.md > 5`). `page.tsx`, `login-form.tsx`, barrel;
  borrar `login-background.tsx`. Tests en `tests/unit/acceso/login-rediseno.test.tsx` (R9–R13).
  Enmiendas: `tests/unit/login-skin.test.tsx`, `tests/unit/identity/login-page-marca.test.tsx`,
  `tests/unit/theme/color-tokens.test.ts`, `tests/unit/theme/motion-tokens.test.ts` con nota
  `ENMIENDA QC-260`. `tests/unit/login-form.test.tsx` y
  `tests/ui/login-form-uncontrolled-warning.test.tsx` en verde **sin editar aserciones de
  comportamiento**. Snapshot de `login-paridad` regenerado en su propio commit, con el control de
  diff anotado en `progress/impl_QC-260.md`. *Hecho:* todo lo anterior verde.

- [x] **T7. Establecer contraseña** (depende de T2, T3, T4, T5; `design.md > 6`). `page.tsx`,
  `set-credential-form.tsx`, `set-credential-labels.ts`, barrel; borrar `credential-input.tsx` y
  `submit-button.tsx` de la ruta. Tests en `tests/unit/acceso/establecer-contrasena-rediseno.test.tsx`
  (R14–R22). Enmienda de `tests/unit/identity-ui/set-credential-form.test.tsx` (`design.md > 10`).
  *Hecho:* unit verde; R23 y R24 siguen cubiertos por el test de QC-79.

- [x] **T8. Textos** (depende de T6, T7; `design.md > 7`). `credential-rule-labels.ts` con tildes;
  `tests/unit/acceso/textos-acceso.test.tsx` (R25, R26): tabla exacta de R25 y ninguna forma sin
  tilde en el texto pintado de las dos pantallas. `tests/unit/credential-help-contract.test.ts` y
  `tests/unit/credential-requirements.test.tsx` en verde. *Hecho:* tests verdes.

- [x] **T9. Límites de la ficha** (`design.md > 11`). `tests/guards/guard-qc260-limites-de-la-ficha.test.ts`:
  el diff contra el merge-base con `origin/dev` no toca `lib/`, `db/` ni `middleware.ts` (R27), y
  ningún archivo de `app/` pinta un `type="password"` ni un ojo propio (R29). Fuera de la rama
  `feature/QC-260-rediseno-acceso`, `skip` ruidoso, como `guard-piezas-base`. *Hecho:* verde en la
  rama; el caso sintético de cada regla da rojo.

- [ ] **T10. E2E** (depende de T6, T7). `e2e/acceso-rediseno.spec.ts` en chromium y webkit, a 390,
  820 y 1440 px, con estilo computado y sin capturas: R3, R4, R6, R7, R8 en las dos pantallas, el
  ojo del login (R10) y R20 si T3 lo pide. Enmienda de `e2e/login-skin.spec.ts`: quitar los casos
  que QC-226 R17–R22 fijaban y que este spec sustituye, con nota `ENMIENDA QC-260`.
  `e2e/login.spec.ts`, `e2e/session.spec.ts`, `e2e/theme.spec.ts` y
  `e2e/establecer-contrasena.spec.ts` en verde sin cambios. *Hecho:*
  `pnpm exec playwright test e2e/acceso-rediseno.spec.ts e2e/login-skin.spec.ts e2e/login.spec.ts e2e/establecer-contrasena.spec.ts e2e/theme.spec.ts`
  verde; mapa `R<n> -> test` completo en `progress/impl_QC-260.md`; `./init.sh` verde.

## Archivos esperados

- `app/(public)/login/page.tsx`
- `app/(public)/login/components/index.ts`
- `app/(public)/login/components/login-form.tsx`
- `app/(public)/login/components/login-background.tsx`
- `app/(public)/establecer-contrasena/[token]/page.tsx`
- `app/(public)/establecer-contrasena/[token]/components/index.ts`
- `app/(public)/establecer-contrasena/[token]/components/set-credential-form.tsx`
- `app/(public)/establecer-contrasena/[token]/components/set-credential-labels.ts`
- `app/(public)/establecer-contrasena/[token]/components/credential-input.tsx`
- `app/(public)/establecer-contrasena/[token]/components/submit-button.tsx`
- `app/globals.css`
- `components/shared/access-screen.tsx`
- `components/shared/notice.tsx`
- `components/shared/submit-button.tsx`
- `components/shared/credential-rule-labels.ts`
- `components/shared/CATALOGO.md`
- `tests/unit/acceso/access-screen.test.tsx`
- `tests/unit/acceso/login-rediseno.test.tsx`
- `tests/unit/acceso/establecer-contrasena-rediseno.test.tsx`
- `tests/unit/acceso/textos-acceso.test.tsx`
- `tests/unit/shared-ui/notice.test.tsx`
- `tests/unit/shared-ui/submit-button.test.tsx`
- `tests/unit/identity-ui/set-credential-form.test.tsx`
- `tests/unit/login-skin.test.tsx`
- `tests/unit/identity/login-page-marca.test.tsx`
- `tests/unit/theme/color-tokens.test.ts`
- `tests/unit/theme/motion-tokens.test.ts`
- `tests/unit/paridad/__snapshots__/login-paridad.test.tsx.snap`
- `tests/guards/guard-movimiento.test.ts`
- `tests/unit/identity/credencial/scope.test.ts`
- `tests/unit/brand/brand-logo.test.tsx`
- `tests/unit/login-form.test.tsx`
- `tests/guards/guard-qc260-limites-de-la-ficha.test.ts`
- `e2e/acceso-rediseno.spec.ts`
- `e2e/login-skin.spec.ts`
- `progress/impl_QC-260.md`
