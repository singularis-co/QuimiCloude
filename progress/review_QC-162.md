# QC-162 — gestion-de-empresas · review

Revisado: rama `feature/QC-162-gestion-de-empresas`, diff `origin/dev...HEAD` (3515be5c), 71
archivos. Spec aprobado con P1–P6 por defecto + R45 (leader). MCP del grafo no usado: el
worktree de QC-162 se reviso con Grep/Read/git.

## Verificacion ejecutada por el reviewer (salida real)

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores, 7 warnings ajenos (`confirm-catalog-import`, `order-service`).
- `vitest run guard` + unitarios afectados (`tests/unit/identity/companies`, `company-actions`,
  `seed/*`, `set-company-country`, `credencial/scope`, `roles/maestro-rol`, `schema/*`,
  `errores/catalogo`, `module-contract` de pedidos y proveedores, `account-status-scope`,
  `credential-policy-contract`, `tests/unit/composition`): 123 archivos, 1957 pass, 23 skip, 0 fail.
- `.int` afectados (`company`, `company-country`, `order-company-stats`, `identity-seed`):
  4 archivos, 83/83 pass, base efimera creada y borrada.
- No se corrio `./init.sh --completo` (lo corre el leader).

## Checklist

### Especificacion / tasks
- [x] requirements.md EARS R1–R45.
- [x] design.md con `## Lo que ya existe` (tabla de busqueda; el diff no re-crea nada de la lista:
      reutiliza `PlatformActor`, `currentPlatformActor`, `createUserSchema`, `NO_CREDENTIAL_SENTINEL`,
      `issueForPendingUser`, `normalizeCompanyName`, `duplicateKeyOf`, contrato de listas).
- [x] design.md con 8 alternativas descartadas.
- [x] tasks.md: 29/29 `[x]`; todos los archivos del diff (fuera de specs/progress) estan en
      «Archivos esperados».

### Trazabilidad
- [x] Mapa R -> test en `progress/impl_QC-162-gestion-de-empresas.md` (R1–R45), contrastado con los
      nombres reales de los casos de `company.int.test.ts`, `create-company.test.ts`,
      `company-events-append-only.test.ts`, `seed-scope-env.test.ts`, etc.
- [ ] R40 extremo a extremo: ver hallazgo B1.

### Calidad / seguridad / datos
- [x] Typecheck y lint sin errores.
- [x] Sin dependencias nuevas (`package.json` intacto).
- [x] Sin secretos ni contexto hardcodeado.
- [x] Permiso en la primera linea de los ocho casos de uso (`requirePlatformPermission`), antes del
      `safeParse`, con test por caso (null, sin permisos, permiso equivocado, actor sin empresa).
- [x] `PlatformActor` solo en las operaciones de plataforma; ninguna accion con ambito de empresa
      se ablando (el diff no toca `Actor`, `getSessionContext` ni las acciones de usuarios;
      `user-admin-prisma.ts` solo gana un `export`). Las acciones nuevas toman el actor solo de
      `getSessionUser()`, sin `revalidatePath`, y no salen por el barrel.
- [x] Ninguna operacion toca otra empresa: todas las escrituras van por `id = companyId`; los
      conteos (`users`, `orders`) filtran por `company_id` y el `.int` prueba que no cuentan los de
      otra empresa; `issueForPendingUser` recibe ademas `companyId` (mas estricto que `create-user`).
- [x] Migracion con `down.sql` exacto en orden inverso; `company_events` con `ENABLE` + `FORCE`
      RLS al final; `company_id` en la tabla (guardia de empresa en esquema verde).
- [x] Indices unicos parciales: `companies_tax_id_unique` sobre vivas y no nulas; el nombre reutiliza
      `companies_name_unique`. `meta.target` medido y fijado en un caso `.int`.
- [x] Atomicidad del alta: empresa + Administrador + evento en una transaccion; los choques de
      nombre, identificacion, usuario y tipo de documento dejan cero empresas, usuarios y eventos
      (probado por el `.int` via SAVEPOINT; mutacion documentada en la bitacora). En produccion la
      ruta es `prisma.$transaction` (cliente raiz, `PrismaClient` sin `$extends`).
- [x] `companies_tax_id_pair` / `_normalized_format` (23514) **no son alcanzables desde la app**:
      `toCompanyWrite` siempre escribe `taxId` y `taxIdNormalized` juntos (o los dos nulos), rechaza
      la forma vacia, y `normalizeKey` solo emite `[a-z0-9]`. No es hallazgo.
- [x] Correo del primer Administrador: el enlace se emite tras el COMMIT; `failed` del correo y las
      emisiones `not_found`/`user_not_pending`/`issued` dejan el alta hecha y devuelven `failed`;
      `superseded` → `sent`; el secreto no sale del caso de uso (unitarios R15).
- [x] Seed por entorno: `VERCEL_ENV` recortado `=== 'production'` → `platform-only`; preview, local,
      CI y E2E siguen en `full` (`VERCEL_ENV` ausente). `credentials()` y `companies` no se tocan con
      `platform-only` (unitarios + `.int`). Pero ver B1.
- [x] Historial append-only: sin metodo de puerto para modificar/borrar; barrido de `lib/` con
      autocomprobacion.

### Modulos hexagonales
- [x] Dominio y puertos puros; `orders` se cuenta en `pedidos` y se ata en la composicion.
- [x] `countOpenOrdersInCompany` pasa por `orderCompanyScope` y lo ve `guard-ambito-empresa-pedidos`.

### Reglas del proyecto (perfil-agentes > reviewer)
- [x] 5. Calidad y seguridad: RLS en la tabla nueva, capas separadas.
- [x] 6. Multiplataforma: no aplica (sin UI).
- [x] 7. Dependencias: ninguna.
- [x] 8. Aislamiento por empresa: `company_events.company_id`; consultas por empresa con test de no
      cruce.
- [x] 9. Comentarios: ninguna linea anadida en `lib/`, `scripts/`, `db/` cita `QC-`, `R<n>`,
      `design.md` ni «decision cerrada» (comprobado con grep sobre el diff).
- [x] 10–11. Componentes y diseno: no aplica.

### Enmiendas a tests cerrados
- [x] `catalogo` 88→92, `guard-identificador-de-request`, censos de relaciones de `User`,
      `EMISORES_LEGITIMOS` de `scope.test.ts`, `SITIOS_PERMITIDOS`, `DUENOS_DE_ORDERS`,
      `aislamiento.json`, `RUTAS_ABIERTAS_EMPRESAS` de `maestro-rol`: solo anaden, autorizados.
- [x] `identity-schema` R12: excluye `CompanyEvent` del chequeo de tabla intermedia (un filtro, no
      un append), autorizado expresamente por el leader en la Tanda A.
- [x] QC-235 (`set-company-country`, `company-country.int`, `company-actions`): los
      `toHaveBeenCalledWith` ganan `actorId`/`now` por el cambio de firma aprobado (P4); ninguna
      asercion de comportamiento se relaja. `identity-seed.int` gana `scope: 'full'` en un literal.

### Flujos criticos
- [x] «Permisos» es flujo critico con E2E, pero la decision heredada QC-161 D8 lo lleva a QC-166
      (primera ficha con pantalla). No es hallazgo de esta ficha.

## Hallazgos

### B1 — BLOQUEANTE: R40 depende de una linea sin test y con valor por defecto inseguro
`SeedInitialAccessDeps.scope` es **opcional** con defecto `'full'` (desviacion 1 de la Tanda D;
design 7 lo pedia obligatorio). La unica garantia de R40 en produccion es la linea
`scope: readSeedScopeFromEnv()` de `lib/composition/index.ts` (~l. 831). Si esa linea se borra o
un llamador nuevo la omite, typecheck y toda la suite siguen verdes y el seed de produccion vuelve a
sembrar QuimiCloud y su Administrador y a leer `SEED_ADMIN_*` (que la nueva fila de
`docs/architecture.md` declara «no se leen»). Los tests cubren las dos mitades por separado
(`readSeedScopeFromEnv` y `seedInitialAccess({ scope })`), pero ninguno el cableado: R40 no queda
verificado en el camino real, y el fallo es hacia el lado inseguro.
**Que falta (una de las dos):**
- hacer `scope` obligatorio, como dice el design (enmienda mecanica de los llamadores de test:
  anadir `scope: 'full'`, o pasarlo por el helper comun de deps); el typecheck pasa a proteger el
  cableado; o
- un test que fije el cableado de la composicion (p. ej. `identity.seedInitialAccess()` con
  `VERCEL_ENV=production` no llama a las credenciales del Administrador ni lee `companies`, con la
  composicion sobre dobles).
La primera opcion es la preferida: es lo aprobado y cierra la clase de error, no solo este caso.

### Menores
- m1 — R45 no esta en la tabla «Cobertura de las decisiones cerradas» de requirements.md (encaja en
  «¿Datos de la empresa?») ni en la tabla de design.md § 9; la cabecera del design sigue diciendo
  «R1–R44». Solo documental: R45 tiene sus tres tests.
- m2 — `createWithAdministrator` traduce cualquier `P2003` a `'invalid_document_type'`. La FK
  `company_events.actor_id` tambien puede dar `P2003` (actor borrado entre sesion y peticion): se
  reportaria como `invalid_input`. Improbable; el comentario «la unica clave ajena que la entrada
  puede romper» es cierto para la entrada pero no para el evento.
- m3 — En `atomically`, si `ROLLBACK TO SAVEPOINT` falla, su error tapa el original. Solo afecta a la
  ruta de transaccion ajena (tests); en produccion se usa `$transaction`.
- m4 — Los `.int` solo ejercitan la ruta SAVEPOINT de `atomically`; la ruta de produccion
  (`db.$transaction` con el cliente raiz) no la recorre ningun test. Es semantica estandar de
  Prisma; se anota por si se quiere un caso con el cliente raiz.
- m5 — Si `issueForPendingUser` **lanza** (error de base) tras el COMMIT, la accion devuelve error
  aunque la empresa y su Administrador ya existen; un reintento del Maestro daria
  `company_duplicate_name`. Es el mismo patron que `create-user` (QC-79) y el riesgo 1 del design
  (reenvio en QC-165) ya lo cubre; conviene recordarlo al acotar QC-165/QC-166.
- m6 — La bitacora de la Tanda B conserva la observacion «un nombre que normaliza a vacio pasa la
  validacion; ningun R lo prohibe», ya superada por R45. Solo historico.

## Veredicto

**RECHAZADO** (CAMBIOS): un bloqueante, B1. Todo lo demas —seguridad multiempresa, permisos,
migracion, RLS, atomicidad, correo, enmiendas, comentarios— pasa. Con B1 resuelto (preferente:
`scope` obligatorio) y el gate verde, la ficha queda en OK; m1–m6 no bloquean.
