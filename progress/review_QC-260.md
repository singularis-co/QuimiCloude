# Review QC-260 — Rediseño de acceso: login y establecer contraseña

Vuelta 1 (completa). Rama `feature/QC-260-rediseno-acceso`, HEAD `709872a1`, base `origin/dev`.
Grafo no usado: el diff es pequeño y de UI; bastó Grep/Read y el diff.

## Verificación ejecutable (corrida por el reviewer, 2026-10-12)

- `pnpm run typecheck` → exit 0.
- `pnpm run lint` → `0 errors, 7 warnings` (preexistentes, fuera del diff).
- `pnpm exec vitest related --run <archivos .ts/.tsx/.css del diff>` → `Test Files 25 passed · Tests 412 passed`.
- `pnpm exec vitest run guard` → `Test Files 72 passed · Tests 985 passed | 18 skipped`.
- Tests nuevos y enmendados en explícito (`tests/unit/acceso`, guardia QC-260, `login-form`,
  `login-skin`, `set-credential-form`, `paridad`, `brand`, `login-page-marca`, `scope`, `theme`,
  `shared-ui`, `credential-requirements`, `login-form-uncontrolled-warning`) →
  `Test Files 84 passed · Tests 1198 passed`. La guardia `guard-qc260-limites-de-la-ficha` corre
  (no hace skip) en esta rama: 8/8 verdes.
- E2E: no repetidos (los corre el CI). `progress/impl_QC-260.md > Desbloqueo` trae la salida local
  de los seis specs tocados, chromium + webkit: `74 passed (2.6m)`.

## Checklist

### Especificación
- [x] `requirements.md` con R1–R29 en EARS; C1–C8 y P1–P3 cerradas.
- [x] `design.md` con alternativas descartadas (A1–A6).
- [x] `tasks.md`: T1–T10 marcadas `[x]`.
- [x] `design.md` abre con `## Lo que ya existe`; el diff no re-crea nada de esa lista
      (`LoginBackground`, `CredentialInput` y la fachada `SubmitButton` se borran como se decidió;
      `PasswordField`, `Notice`, `SubmitButton`, `Card`, `BrandLogo`, `ArrowLink`, `screen-enter`,
      `--sidebar-panel-gradient` se reutilizan o extienden).

### Equipo
- [x] Feature tomada con commit de candado (`1544e02f`); assignee lo valida `init.sh`.

### Trazabilidad
- [x] Mapa `R<n> -> test` en `progress/impl_QC-260.md`.
- [x] Cada R tiene test real con aserciones sobre el comportamiento:
  - R1, R2, R5, R6 → `tests/unit/acceso/access-screen.test.tsx` (13 casos); R6 además E2E con tema
    guardado contrario al del sistema.
  - R3, R4, R7, R8 → `e2e/acceso-rediseno.spec.ts` (estilo computado, `getAnimations()`, cajas a
    390/820/1440; R8 incluye ojos, envío, enlace de recuperación y «Ir a iniciar sesión»).
  - R9–R13 → `tests/unit/acceso/login-rediseno.test.tsx`; R10 también E2E; R11 también
    `tests/unit/login-form.test.tsx` y `e2e/login.spec.ts`.
  - R14–R22 → `tests/unit/acceso/establecer-contrasena-rediseno.test.tsx`; R20 también E2E.
  - R23, R24 → `tests/unit/identity-ui/set-credential-form.test.tsx` (casos `error`, referrer,
    secreto oculto, sin datos de la persona) y `e2e/establecer-contrasena.spec.ts`.
  - R25, R26 → `tests/unit/acceso/textos-acceso.test.tsx`.
  - R27, R29 → `tests/guards/guard-qc260-limites-de-la-ficha.test.ts` (con casos sintéticos en rojo).
  - R28 → `tests/guards/guard-catalogo-de-componentes.test.ts`.

### Calidad de código
- [x] Typecheck y lint verdes.
- [ ] `gate-completo` en CI: pendiente del PR (no aplica todavía).
- [x] Flujo crítico (autenticación): E2E de Playwright y su salida local (74/74) en la bitácora.
- [x] Sin dependencias nuevas (`package.json` no está en el diff).

### Seguridad y configuración
- [x] Sin secretos ni valores de entorno hardcodeados.
- [x] Sin webhooks.
- [x] Sin cambios de backend/auth: `git diff origin/dev...HEAD -- lib db middleware.ts package.json`
      vacío (R27, C5). Las actions se importan igual que antes.

### Verificación final
- [x] `./init.sh` rápido verde (según el leader; mis comandos del mismo alcance, verdes).
- [ ] `progress/features/QC-260.md > Cierre` vacío: lo completa el leader al abrir el PR (no es hallazgo).
- [ ] Worktree sin desmontar: corresponde al cierre.

### docs/checkpoints-proyecto.md
- [x] E2E del flujo crítico en Playwright.
- [x] Multiplataforma: `min-h-dvh` (sin `100vh`), campos de 44 px y 16 px (`h-11 text-base
      md:text-base`, `PasswordField`), objetivos táctiles de 44 px (`touch` en enlace de
      recuperación, `ArrowLink`, `SubmitButton`), ojo como botón con `aria-pressed`, ninguna
      activación solo por `:hover`, movimiento reducido. Verificado en webkit.
- [x] `CATALOGO.md`: filas nuevas/al día de `AccessScreen` (nueva, `Base de` `Card`, tablero
      `Login.dc.html`), `Notice` (`id`), `SubmitButton` (`Spinner`, tablero `Botones.dc.html`).
- [x] Pase `/design`: tableros citados en `design.md` y presentes en `docs/diseno/canvas/`
      (`Login*`, `EstablecerContrasena*`, `Botones`, `Campos`, `Avisos`).
- [x] Datos/Supabase, módulos hexagonales, permisos: no aplican (sin `lib/`, `db/`, actions nuevas).

### Reglas del proyecto (`docs/perfil-agentes.md > reviewer`)
- [x] 5. Calidad y seguridad: capas intactas; secreto solo en campo oculto; `referrer` conservado.
- [x] 6. Multiplataforma: ver arriba.
- [x] 7. Dependencias: ninguna.
- [x] 8. Aislamiento por empresa: no aplica.
- [x] 9. Comentarios: ninguna línea añadida en `app/` o `components/` cita `QC-<n>`, `R<n>`,
      `design.md` ni «decisión cerrada» (grep del diff vacío).
- [x] 10. Duplicados: `AccessScreen` declara paso 3 (compón) y por qué no bastaban las anteriores;
      absorbe y borra `LoginBackground`; sube a `shared` con dos rutas consumidoras.
- [x] 11. Diseño: toda pieza nueva o con cambio visual cita tablero en `design.md` y en su fila.

### Enmiendas de tests
- [x] Cada enmienda lleva nota `ENMIENDA QC-260` y conserva la intención: `login-form` (C8, solo
      `type=submit` = 1), `brand-logo` (fila QC-226 R26 en § 10), `set-credential-form` (§ 3.4),
      `login-skin` unit y E2E, `color-tokens`, `motion-tokens`, `guard-movimiento` (QC-226/QC-228
      en § 10), snapshot de paridad regenerado en commit propio (`c9d2e746`) con control de diff.
- [x] `guard-identificador-de-request`: alta del spec nuevo en `E2E_ESPERADOS` con el patrón previo.

## Hallazgos

- **m1 (menor).** `tests/unit/identity/credencial/scope.test.ts` se enmienda (salen
  `credential-input.tsx` y `submit-button.tsx` de `SUPERFICIE_PUBLICA`) con nota `ENMIENDA QC-260`
  y está en la bitácora, pero no tiene fila en `design.md > 10. Enmiendas a specs cerrados`
  (QC-79). Es consecuencia directa de § 6 (borrar esos archivos), así que no cambia la intención;
  conviene añadir la fila para que § 10 sea la lista completa.
- **m2 (menor).** `design.md > Lo que ya existe`, tabla de piezas: la fila `ErrorAlert | sin
  decidir | Ver P3` quedó desfasada; P3 se cerró (se conserva el error de hoy en la tarjeta) y el
  código no usa `ErrorAlert`. Debería decir «descartada, ver P3».
- **m3 (menor, informativo).** `design.md > 3.1` dice que al pasar al éxito «la tarjeta se monta de
  nuevo (`key`)»; la implementación remonta los bloques con `key` por rama, no la tarjeta (la pinta
  la página de servidor). Está declarado como desviación en la bitácora y R5/R22 lo cubren
  (bloques hijos directos de la tarjeta), pero el `design.md` no se actualizó.

Ningún hallazgo bloqueante.

## Veredicto

**OK** — 0 bloqueantes, 3 menores (m1, m2, m3), que pueden resolverse en el mismo PR sin otra vuelta
de review o quedar como nota.
