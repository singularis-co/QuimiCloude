# QC-165 — administradores-por-el-maestro · review (F2.2)

Rama `feature/QC-165-administradores-por-el-maestro`, diff `origin/dev...HEAD` (commits
`88cb339a`, `8f6bbd2f`, `97c22c30`, `5f260ec5`). Revisor: reviewer, 2026-10-16.
MCP del grafo: no usado (el worktree no está indexado, igual que anota el design); Grep/Read.

## Verificación ejecutada por el reviewer

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | 0 errores, 10 avisos en archivos ajenos al diff |
| `vitest run` de `tests/unit/identity/administradores`, `account-status-scope`, `credencial/`, `roles/maestro-rol`, `errores/catalogo`, `usuarios/errors`, `companies/`, `company-actions`, `composition/` | 46 archivos, 1013 pasan / 3 se saltan |
| `vitest run` de `session-once-per-request-actions` y `-render` | 102/102 |
| `vitest run guard` | 80 archivos, 1096 pasan / 20 se saltan |
| `vitest run --project integration` de `administrator.int.test.ts` y `administrator-concurrency.int.test.ts` | 2 archivos, 49/49 (base efímera, borrada al terminar) |

No corrí la suite completa ni el E2E (los corre el CI).

## Checklist — `CHECKPOINTS.md`

- [x] `requirements.md` con R1–R29 en EARS.
- [x] `design.md` con alternativas descartadas (§ 9.1–9.5) y su porqué.
- [x] `tasks.md`: T1–T11 marcadas `[x]` (0 sin marcar).
- [x] `design.md` abre con `## Lo que ya existe`, con contenido. El diff no re-crea nada de esa lista:
      `sendCredentialSetupLink` y el cuerpo del reenvío de QC-79 se **extraen** (`create-company.ts` e
      `issue-credential-setup-link.ts` pasan a importarlos y su comportamiento es el mismo, comparado
      línea a línea), `currentPlatformActor` se extrae a `platform-session.ts`, y se reutilizan
      `companyAdministratorSchema`, `atomically`, `duplicateKeyOf`, `throwDuplicate`,
      `selectCondition`/`insensitiveContainsCondition` y `changeRevokesSessions`/`floorToSecond`.
- [x] Assignee y candado: `progress/features/QC-165.md` con la toma por ArqDev (`19beb665`).
- [x] Trazabilidad: cada R1–R29 aparece en nombres de caso de U/I/C (recuento por grep, ninguno a
      cero), sin `skip`/`todo`/`only`. Revisé que los de R1/R2 (`describe.each` sobre las seis
      operaciones con dobles que lanzan si se les llama), R24 (dos `PrismaClient`, `commit`, varias
      corridas) y R26/R28 (enlace leído de la base) prueban de verdad.
- [x] `progress/impl_<key>.md` trae el mapa `R<n> -> test` de los 29.
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` del CI: pendiente del PR (no lo verifica el reviewer).
- [~] Flujo crítico (permisos) con E2E: **diferido a QC-166 por decisión cerrada del 2026-09-24**;
      el rechazo por permiso y por rol distinto está cubierto en unitario e integración, como pide esa
      decisión. No es hallazgo.
- [x] Sin dependencias nuevas (`package.json` intacto).
- [x] Sin secretos ni configuración hardcodeada; el resultado del alta y del reenvío no tiene hueco
      para el secreto ni el correo.
- [x] Sin webhooks.
- [ ] `./init.sh` verde: según la bitácora, verde en T11; no lo repetí entero (corrí sus piezas
      relevantes arriba, verdes).
- [ ] Cierre de `progress/features/QC-165.md`, desmontaje del worktree: posteriores a esta revisión.

## Checklist — `docs/checkpoints-proyecto.md`

- [x] Typecheck y lint.
- [x] UI / multiplataforma / catálogo / pase `/design`: no aplica (backend puro, sin componentes).
- [x] Sin tabla nueva: ni columna de empresa, ni RLS, ni migración, ni `down.sql` que exigir.
      Las lecturas cruzan empresas a propósito (actor de plataforma, `users` es identidad; mismo caso
      que la lista de empresas de QC-162, `design.md > 2`). Un Administrador de empresa no llega: le
      falta `empresas.*`, y `authorization.test.ts` lo prueba con `usuarios.*`.
- [x] Cada permiso se valida en el caso de uso, como primera línea (`requirePlatformPermission`
      antes del `parse`), con su test.
- [x] Acceso a datos solo por el adaptador Prisma; ninguna consulta con el cliente de Supabase.
- [x] Hexagonal: `domain/` y `ports/` sin framework ni adaptadores; las acciones piden a
      `lib/composition`; `'use server'` no se reexporta por el barrel; el adaptador solo toca
      `user`, `role`, `company` (los tres `@module identity`). Guardias verdes.
- [x] La lógica de negocio está en `domain/` (traducción de resultados, distinción de errores);
      la regla del último Administrador está en el adaptador por necesidad de bloqueo, como en QC-66.
- [x] Mutaciones por Server Actions, sin `revalidatePath` (R3).

## Reglas del proyecto (`docs/perfil-agentes.md > reviewer`, 5–11)

- 5 Calidad y seguridad: [x]. 6 Multiplataforma: no aplica. 7 Dependencias: no aplica.
- 8 Aislamiento por empresa: [x] (ver arriba; sin modelo nuevo en `schema.prisma`).
- 9 Comentarios: [x]. Ninguna línea añadida en producción cita `QC-<n>`, `R<n>`, `design.md` ni
  «decisión cerrada» (grep sobre `git diff origin/dev...HEAD -- lib`, vacío). Las citas que siguen en
  la cabecera de `issue-credential-setup-link.ts` son preexistentes y el diff no las toca.
- 10 Duplicados / 11 Diseño: no aplica (sin componentes).

## Puntos que pidió revisar el implementer

1. **Ficha y baja responden `user_not_found` a una entrada que no pasa `administratorIdSchema`,
   incluida una clave de más; el reenvío responde `invalid_input` (R29).** Correcto contra el spec:
   R11/R25 piden `user_not_found` para «no es un identificador válido» y solo R29 (reenvío) pide
   `invalid_input` por clave extra; `design.md > 3.6` y `> 8` lo fijan así. Además, en la frontera la
   clave extra no es alcanzable para ficha y baja: `getAdministratorAction(id)` construye `{ id }` y
   `deleteAdministratorAction` solo lee `id` del formulario. `onlyMalformedId` distingue por
   `code === 'invalid_format'` en la ruta `id`, que es el código de zod 4.4 para un uuid mal formado;
   está probado (`email`, `companyId`, `to`, sin `id`, `id` no texto, no objeto → `invalid_input`;
   ids mal formados → `user_not_found`). No es hallazgo.
2. **Puente de prisma en `administrator.int.test.ts`.** Aceptable. `credential-setup-link-prisma.ts`
   solo usa `prisma.$transaction` (líneas 87 y 148), así que el puente basta, y cualquier otro uso
   futuro fallaría en ruidoso (el puente no tiene más métodos y lanza fuera de la transacción del
   test). El doble se comprueba en vigor, se retira con `doUnmock` tras importar la copia, y el caso
   «R26: el adaptador del enlace escribe dentro de la transaccion del test» demuestra que la escritura
   se ve en la `tx` y no desde el cliente global: el modo `transaccion` declarado en
   `aislamiento.json` es verdad. El SQL de producción del enlace corre tal cual. La única pérdida es
   que se ignoran las opciones de `$transaction` del adaptador (plazos), irrelevante dentro de un
   `SAVEPOINT`. Ver hallazgo menor 3.
3. **Tres guardias de lista cerrada ajustadas fuera de Archivos esperados.** No se aflojó el criterio:
   - `account-status-scope.test.ts`: tres rutas **exactas** más en `SITIOS_PERMITIDOS`, cada una
     justificada por R5/R8/R10/R14; comprobé que `administrator-view.ts` solo importa el tipo,
     `administrator-queryable.ts` solo lo declara ordenable y el adaptador solo lo enumera en el
     `select`, ordena por él y escribe `pending` al nacer.
   - `credencial/scope.test.ts`: la lista cerrada de R39 sigue por **igualdad**, ahora en dos saltos
     (`EMISORES_LEGITIMOS` = `create-user.ts` + `credential-setup-mail.ts`; `USUARIOS_DEL_ENVIO` = los
     cuatro casos de uso, todos detrás de su permiso). El detector `usaElEnvio` tiene casos de disparo
     y de no disparo (método homónimo del puerto, `-content`, comentario) y un ancla contra el
     renombrado. `credential-setup-mail.ts` entra en `DOMINIO`, así que el código extraído sigue bajo
     las reglas de no registrar el secreto. Es más estricto que antes, no menos.
   - `maestro-rol.test.ts`: seis rutas **exactas** en `RUTAS_ABIERTAS_EMPRESAS`; las acciones no
     nombran `empresas.*`, así que no se abrió ninguna más.

   Ver hallazgo menor 1.

## Hallazgos

1. **menor** — `tasks.md > Archivos esperados` no lista los tres archivos de guardia ajustados
   (`tests/unit/identity/account-status-scope.test.ts`, `tests/unit/identity/credencial/scope.test.ts`,
   `tests/unit/identity/roles/maestro-rol.test.ts`) ni `tests/unit/identity/administradores/administrator-doubles.ts`.
   El ajuste es correcto y está anotado en la bitácora; es un hueco del spec, no del código.
2. **menor** — `softDelete` en `administrator-prisma.ts` compara `aliveIds.includes(id)` entre el
   texto que devuelve Postgres (uuid en minúsculas) y el `id` de la entrada tal cual. zod 4 acepta un
   uuid en mayúsculas, el `findFirst` lo encuentra (la columna es `uuid`) y luego el `includes`
   falla: la baja de un Administrador gestionable pedida con su id en mayúsculas responde
   `user_not_found`, mientras que la ficha y la edición con ese mismo id funcionan. Hoy no se alcanza
   desde QC-166 (los ids salen de la lista, en minúsculas), pero conviene normalizar (`toLowerCase`
   o comparar en SQL) cuando se toque.
3. **menor** — El puente de `administrator.int.test.ts` depende de que el adaptador del enlace solo
   use `prisma.$transaction`. Si un cambio futuro le añade otro uso del cliente, el test falla con un
   `TypeError` poco explicativo en lugar de un mensaje propio. No bloquea: falla en ruidoso.
4. **menor** — `lib/composition/index.ts` añade un segundo bloque `import { … } from '@/lib/modules/identity'`
   en lugar de sumar las seis fábricas al que ya existe. El lint no lo marca. Es solo estilo.

Ningún hallazgo bloqueante.

## Veredicto

**OK**
