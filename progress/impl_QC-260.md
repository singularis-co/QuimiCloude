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

## Archivos creados / modificados

(se rellena por tarea)

## Mapa R<n> -> test

(se rellena al cerrar)

## Salida de los tests

(se rellena por tarea)

## Bloqueos

Ninguno.
