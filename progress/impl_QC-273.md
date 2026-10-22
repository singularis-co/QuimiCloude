# QC-273 — implementación (frontend_dev)

Ficha sin SDD: enmienda a R15 de QC-21. La lista en vivo deja de mostrar «No debe figurar en una
lista de credenciales filtradas»; el servidor sigue rechazando la filtrada (no se toca `lib/`).

## Archivos modificados
- `components/shared/credential-requirements.tsx`: pinta `LIVE_CREDENTIAL_RULES` (catálogo sin
  `breached`); fuera el prop `breachedState` y el estado `unknown`; exporta `LiveCredentialRule`.
- `components/shared/password-field.tsx`: fuera `requirements.breachedState`; `labels` tipado con
  `LiveCredentialRule`.
- `app/(public)/establecer-contrasena/[token]/components/set-credential-form.tsx`: solo comentario.
- `components/shared/CATALOGO.md`: filas de `CredentialRequirements` y `PasswordField`.
- Tests: `tests/unit/credential-requirements.test.tsx`,
  `tests/unit/shared-ui/password-field-requisitos.test.tsx`,
  `tests/unit/acceso/textos-acceso.test.tsx`,
  `tests/unit/acceso/establecer-contrasena-rediseno.test.tsx`.

`CREDENTIAL_RULE_LABELS` conserva `breached`: lo usa el aviso del servidor del formulario.

## Mapa → test
- Lista sin filtradas → `credential-requirements.test.tsx > sin el requisito de filtradas (QC-273)`;
  `textos-acceso.test.tsx > QC-273 — la lista de requisitos no muestra el de credenciales filtradas`;
  `establecer-contrasena-rediseno.test.tsx > R17`.
- Error del servidor por filtrada sigue visible → `textos-acceso.test.tsx > QC-273 — si el servidor
  la rechaza por filtrada, el aviso lo dice`; `establecer-contrasena-rediseno.test.tsx > R18`;
  `identity-ui/set-credential-form.test.tsx > invalid_credential`.

## Comandos
- `pnpm typecheck`: verde (tras `pnpm install --frozen-lockfile`, `prisma generate`, `next typegen`
  en el worktree nuevo).
- `pnpm lint`: 0 errores, 7 warnings preexistentes ajenos.
- `pnpm exec vitest related --run <archivos>`: 18 files, 219 tests passed.
- Extra: catálogo, guardia de catálogo, set-credential-form y credential-help-contract: 4 files,
  98 tests passed.

Veredicto: hecho, verde.
