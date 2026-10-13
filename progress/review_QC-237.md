# QC-237 — conexion-whatsapp-por-empresa · review (F2.2)

Rama `feature/QC-237-conexion-whatsapp-por-empresa`, diff `origin/dev...HEAD` (dfa69928..ba0184e0).
Revisor: reviewer, 2026-10-09. MCP del grafo no usado: revisión con Grep/Read y ejecución.

## Verificación ejecutada por el reviewer (salida real)
```
pnpm run typecheck   -> tsc --noEmit, sin errores
pnpm run lint        -> 7 problems (0 errors, 7 warnings), todos en tests/unit/documentos y tests/unit/pedidos (ajenos)
pnpm exec vitest run tests/unit/integraciones tests/unit/integraciones-ui tests/unit/composition \
  tests/unit/errores tests/unit/identity/session-once-per-request-actions.test.ts \
  tests/unit/recetas-ui/recipe-route-contract.test.ts
                     -> Test Files 34 passed (34) · Tests 689 passed | 1 skipped
pnpm exec vitest run guard
                     -> Test Files 63 passed (63) · Tests 860 passed | 15 skipped
pnpm exec vitest run tests/integration/integraciones   (base desechable copiada de plantilla migrada)
                     -> Test Files 2 passed (2) · Tests 25 passed
```
No corridos (restricción de memoria del equipo): `./init.sh`, Playwright. `catalog-line.int.test.ts` R32 no se
reprodujo: es heredado (también rojo en `dev`, depende del `lc_messages` del Postgres local, D33) y CI lo pasa;
no es hallazgo de esta rama.

## Checklist

### Especificación
- [x] `requirements.md` con R1–R43 en EARS.
- [x] `design.md` con alternativas descartadas (§14).
- [ ] **Todas las tasks `[x]`**: T1–T11 sí; **T12 y T13 sin marcar** (ver B1).
- [x] `design.md` abre con `## Lo que ya existe`, con búsqueda real; el diff no re-crea nada de esa lista
      (reutiliza `secretCipher`/`secretDigest`, permiso, ruta, menú, `APP_BASE_URL`, primitivas shadcn y
      `ConfirmActionDialog` existente).

### Equipo
- [x] Assignee en Jira y rama publicada con `wt.sh new` (`progress/features/QC-237.md`). Choque con QC-224
      con excepción humana; se resuelve en F2.3.

### Trazabilidad
- [x] R1–R42: cada uno aparece en el título de al menos un test con aserciones reales (conteo por título:
      mínimo 1 en R27 y R32, ambos con aserción concreta). Revisados a mano R13 (probar/habilitar/editar),
      R3, R33.
- [~] R43: «comprobado a mano», sin test citado (ver m1). Verificado por el reviewer: el diff no toca
      `package.json`, `pnpm-lock.yaml`, `lib/modules/identity`, seed ni `lib/shared/navigation/private-nav.ts`.
- [x] Mapa `R<n> -> test` en `progress/impl_QC-237.md`.

### Calidad de código
- [x] Typecheck sin errores. [x] Lint sin errores.
- [ ] `gate-completo` en CI: no hay PR todavía (F2.3).
- [ ] **E2E del flujo crítico**: `e2e/integraciones-whatsapp.spec.ts` escrito, **NO ejecutado** (ver B1). Su
      salida no está en `impl_QC-237.md`; lo que hay es el fallo por tabla inexistente.
- [x] Sin dependencias nuevas.
- [x] UI multiplataforma: inputs `text-base` (16 px), `min-h-11`, botones con `touch`, pestañas `min-h-11`,
      sin `100vh`, sin `:hover` como única vía, portapapeles con salida por `Input readOnly`.

### Seguridad y configuración
- [x] Sin secretos en el código. La clave del E2E se genera en `playwright.config.ts` con `randomBytes`.
- [x] Webhooks: esta ficha solo construye la URL; no añade ruta `app/api` (recepción, firma e idempotencia
      son de QC-238). No aplica.
- [x] Nada que cambie entre entornos hardcodeado: versión de Graph y `APP_BASE_URL` por variable; la base
      `graph.facebook.com` es fija por diseño (§4.3).

### Datos y seguridad (Supabase)
- [x] `whatsapp_connections` con `company_id` obligatorio; toda consulta pasa por `company-scope.ts`;
      rechazo cruzado probado (unit R3 y `.int` «B no lee ni edita la de A»).
- [x] Permiso validado en `domain/` (`requirePermission` primera sentencia en los seis casos de uso) con
      test R1 (7 operaciones x 5 actores).
- [x] RLS `ENABLE` + `FORCE` (migración, líneas 59–60) y test en `.int`.
- [x] Acceso a datos solo por adaptador Prisma.
- [x] Migración con `down.sql`; ida/vuelta/ida probada en `whatsapp-connection-migration.int.test.ts`.

### Módulos hexagonales / permisos
- [x] `domain/` y `ports/` solo importan contratos de otros módulos (`@/lib/modules/identity`,
      `@/lib/modules/errores`) y `zod`. Guardias en verde.
- [x] Server Actions solo traducen; la lógica (estado tras prueba, D10, D11, saneado) vive en `domain/`.
- [x] `'use server'` no reexportado desde el barrel. `lib/shared/routes.ts` sigue siendo hoja.
- [x] Página valida permiso en servidor (`requirePagePermission`) antes de leer; componentes reciben props.
- [x] Mutaciones por Server Actions.

### Reglas propias del reviewer (perfil 5–9)
- [x] 5 Calidad y seguridad: RLS, sin secretos, capas separadas; token de Graph solo en cabecera.
- [x] 6 Multiplataforma: sin incumplimientos.
- [x] 7 Dependencias: `package.json` intacto.
- [x] 8 Aislamiento por empresa: cumple.
- [ ] **9 Comentarios: una cita de decisión en producción** (ver B2).

## Hallazgos

### BLOQUEANTE
- **B1. T12 y T13 sin cerrar: el E2E de WhatsApp no ha corrido.** `tasks.md` tiene T12 y T13 en `[ ]`, y
  `CHECKPOINTS.md` exige todas las tasks `[x]` y la salida local del E2E de un flujo crítico en
  `impl_QC-237.md`. `e2e/integraciones-whatsapp.spec.ts` (R11, R16, R22, R23, R29, R30, R35, R38, R41 en E2E)
  falló con «table does not exist» porque la base local compartida no tiene
  `20261009130000_whatsapp_connections`. Es un **hueco de evidencia, no un pase**. No pide cambio de código:
  pide el OK humano para aplicar la migración a la base local de E2E, correr
  `pnpm exec playwright test e2e/integraciones-whatsapp.spec.ts e2e/integraciones.spec.ts` (Chromium y
  WebKit), pegar la salida en `impl_QC-237.md`, marcar T12, y después `./init.sh` en verde para T13.
  La cobertura unitaria de esos R ya existe y está en verde, así que el riesgo es de integración UI/servidor.
- **B2. Comentario de producción que cita una decisión del spec.**
  `lib/modules/integraciones/domain/update-whatsapp-connection.ts`, línea añadida en 3b0b8059:
  ```ts
  // D10: una edición que falla no guarda nada, tampoco con un secreto ilegible.
  ```
  `D10` es una decisión cerrada de `requirements.md`; `docs/conventions.md > Comentarios` prohíbe citar
  fichas, requisitos, `design.md` o decisiones cerradas en producción. Arreglo: quitar el prefijo `D10:`
  (el porqué que queda sí vale) o borrar el comentario. Es el único caso en las 137 líneas de comentario
  añadidas en `app/`, `lib/` y `db/`.

### menor
- **m1. R43 sin test citado en el mapa.** Hay tests que lo hacen cumplir: `guard-dependencias-aprobadas`
  (dependencias), `tests/unit/integraciones-ui/private-nav-integraciones.test.ts` (fija 3 hijos en el menú
  de integraciones), `guard-permisos-sembrados` y `guard-doc-permisos` (permisos). Que el mapa los cite en
  vez de «comprobado a mano».
- **m2. Fila añadida en `session-once-per-request-actions.test.ts`** (desviación 10). Es correcta: el test
  pide la fila para todo archivo que llama a la sesión, y añadirla tensa en vez de relajar. El fallo está en
  `tasks.md` T9 y en `design.md > 6`, que decían que no hacía falta tocarlo. Aceptada; no pide cambio.
- **m3. `.env.example` con `INTEGRATIONS_E2E_DOUBLES=""`** (desviación 15). Es equivalente para dotenv y
  evita un falso positivo real del patrón `\s*` de `guard-dobles-e2e`, que cruza líneas. Aceptada. Pero la
  deuda del patrón (`[ \t]*`) no está en `progress/deudas.md`, ni como «M2 de QC-234» ni de otra forma.
  Hay que anotarla allí para que no dependa de un comentario en `.env.example`.
- **m4. Comentarios en tests que citan la ficha o un requisito**: `recipe-route-contract.test.ts`
  («Alta el 2026-10-09 (QC-237)…», 4 líneas) y `whatsapp-connection-prisma.int.test.ts` («…y R6 necesita…»).
  En tests, `R<n>` va en el nombre del caso, no en comentarios. Es menor fuera de producción.
- **m5. Comentario de historia en `lib/composition/index.ts`**: «Bloque nuevo al final, con sus imports.»
  Cuenta la historia del merge (choque con QC-224), no un porqué del código. Hay que quitarlo en F2.3,
  después de resolver el choque.
- **m6. Desviaciones estructurales 1–4, 7–9, 11 y 12**: revisadas y aceptadas. Son estas:
  - `requirePermission(actor)` con un solo argumento;
  - quinta clase de error;
  - `connection-secrets.ts` extra y ya fijado en `module-shape`;
  - tipos de fila y patch en el puerto;
  - un id sin forma de uuid da `not_found`;
  - unicidad reconocida por nombre o columnas;
  - altas mecánicas en `aislamiento.json` y `MIGRACIONES_ESPERADAS`;
  - fachada tensada a 9 miembros;
  - la variable en `playwright.config.ts` desde T8.

  Ninguna relaja un test ni rompe una regla. La 6 (sin App Secret nuevo no se puede tachar el guardado en
  el mensaje de Meta) es una limitación inherente a R11. Basta con dejarla anotada.
- **m7. Textos de UI que no da el spec** (desviación 14). Necesitan confirmación humana; no bloquean:
  - diálogo de deshabilitar: «¿Deshabilitar la conexión de WhatsApp?», «Dejarás de recibir mensajes de
    WhatsApp hasta que vuelvas a habilitarla.», «Cancelar» y «Deshabilitar»;
  - diálogo de regenerar: «¿Regenerar el verify token?», «El token actual dejará de funcionar y tendrás que
    pegar el nuevo en Meta.», «Cancelar» y «Regenerar»;
  - título de la guía: «Dónde sacar cada dato en Meta»;
  - etiquetas de la tarjeta: «Número», «Nombre verificado», «Estado» y «Última verificación». El spec da
    los contenidos, pero no el texto de las etiquetas;
  - «URL del webhook», «Verify token» y «Guardando…»;
  - nombres accesibles «Copiar la URL del webhook» y «Copiar el verify token»;
  - una prueba buena no muestra ningún mensaje de éxito. El spec tampoco lo pide, y conviene confirmarlo.

## Decisiones humanas respetadas (no se reabren)
Se respetan tal como están:
- migración `20261009130000`;
- D10 al editar: no se escribe nada y se relanza (test «R13, D10» lo afirma);
- `ERROR` + `lastError` solo al probar; habilitar sigue `DISABLED` (D11, test R13 de habilitar);
- allowlist del webhook en `recipe-route-contract` (ba0184e0);
- excepción de choque con QC-224.

## Veredicto
**CAMBIOS** (RECHAZADO). Bloquean dos cosas:
- **B1**, el E2E sin correr con T12/T13 abiertas. Es un hueco de entorno: el implementer no tiene código
  que cambiar, pero hace falta el OK humano sobre la base.
- **B2**, la cita `D10:` en un comentario de producción. Se arregla en una línea.

El código, la seguridad y el aislamiento por empresa están bien, y la verificación unitaria, de guardias y
de integración está en verde.

## Vuelta 2 (acotada a a1ed2b41..fecb9659)

### Checklist
- [x] **B2.** 54790b3f quita el prefijo `D10:` del comentario en `update-whatsapp-connection.ts`. El cambio es de una línea y no deja otra cita del spec en ese archivo.
- [x] **B1.** `progress/impl_QC-237.md > E2E` registra lo que hizo el leader con el OK del humano: aplicó solo `20261009130000_whatsapp_connections` a la base local y corrió `playwright test e2e/integraciones-whatsapp.spec.ts e2e/integraciones.spec.ts`, con `14 passed (2.4m)`. T12 queda `[x]` (22d1f3a1). Yo no corrí Playwright, porque el encargo lo excluye, así que la evidencia es la de la bitácora.
- [x] **m7.** El humano aprueba los textos de UI tal cual. Está en `progress/features/QC-237.md > Decisiones` y en impl.
- [x] **Deuda de la regex de `guard-dobles-e2e`.** Queda anotada en `progress/deudas.md` (3c4f6659), con el arreglo concreto.
- [x] **Sin regresiones.** El diff de la vuelta solo toca un comentario y archivos de `progress/`/`specs/`.
- [~] **Rojo del gate rápido: `tests/integration/proveedores/catalog-line.int.test.ts` R32.** Lo reproduje: 1 failed, 13 passed.
  - No es de esta feature. El diff de QC-237 no toca `proveedores` y el test no cambia en la rama.
  - Según D33, el test depende del `lc_messages` del Postgres. Con un Postgres en inglés (Docker y CI) Prisma da `meta.constraint`; la base local compartida no lo da.
  - No está en `tests/baseline-rojos.json`, porque D33 se dio por resuelta y se borró del baseline. Aun así, el CI está en verde.
  - **Juicio:** no bloquea T13. «`./init.sh` en verde» se cumple con todo verde menos un rojo de entorno, ajeno al diff, que el CI cubre. Con eso T13 se puede marcar.

### Hallazgos
- **menor M1.** T13 sigue `[ ]` en `tasks.md`. Hay que marcarla `[x]` antes del PR y anotar que el único rojo local es R32 de catalog-line (entorno, D33). No se reabre la review por esto.
- **menor M2.** `progress/deudas.md` tiene ahora **dos** `D35`: la de QC-167 (línea 131) y la nueva de la regex (línea 214). La nueva debería renumerarse al siguiente libre (D37), y también las referencias en este archivo y en `QC-237.md`.
- **menor M3.** D33 figura como «resuelta», pero el test sigue rojo con una base local en español. Conviene reabrirla como deuda de entorno: o el test no depende del idioma, o se documenta que la base local debe tener `lc_messages=en_US`. No es de QC-237.

### Veredicto
**OK.** B1 y B2 quedan resueltos y no hay bloqueantes. Los tres hallazgos son menores; M1 hay que hacerlo antes de abrir el PR.

## Vuelta 3 (acotada a c5361f20..729fe8ef)

Alcance: quitar `metaAppId`/`meta_app_id` (D17, humano, 2026-10-13). La migración `20261009130000` se
edita en sitio.

### Verificación ejecutada por el reviewer

- `pnpm typecheck`: limpio. El cliente Prisma generado ya no tiene `metaAppId`: si lo tuviera como
  requerido, el `create` del adaptador no compilaría.
- `eslint` sobre los 21 `.ts/.tsx` del diff: 0 errores.
- `vitest` unit (`integraciones/whatsapp`, `integraciones-ui`, `composition/integraciones-graph-doubles`):
  20 archivos, 252 passed.
- `vitest --project integration` (`whatsapp-connection-{migration,prisma}.int.test.ts`) en una base
  efímera creada desde la plantilla: 2 archivos, 25 passed. El `INSERT` sin `meta_app_id` entra, así
  que la plantilla refleja la migración editada.
- `grep -rni "meta_?app_?id|app id|meta-app-id"` en todo el repo (sin `node_modules`): solo quedan
  D17 en `progress/features/QC-237.md`, la bitácora y las notas fechadas del spec. No quedan restos
  en código, tests, e2e, seeds ni docs.
- `git ls-tree origin/dev` y `origin/master`: la migración `20261009130000` no está en ninguna de las
  dos. Editarla en sitio es legítimo.

### Checklist

- [x] **La eliminación está completa.** Cubre el dominio (record, view, `toWhatsappConnectionView`),
  el input zod (create/update), el alta, la edición, el puerto (fila nueva y patch), el adaptador
  Prisma (select, `toRecord`, insert, update), las Server Actions (`buildCreate/UpdateCandidate`), el
  formulario (campos, etiquetas, testids), la guía y el E2E.
- [x] **La migración, el schema y el adaptador son coherentes.** Se quita la línea en el SQL y en
  `schema.prisma` y el resto de columnas no cambia. Lo confirma el int test.
- [x] **No se debilita otro campo.**
  - En R24, «metaAppId vacío» se retira junto con su campo. «Campo ausente» pasa a `wabaId` y sigue
    probando lo mismo.
  - En el test de IDs libres se pierde el caso `' abc-1 '` (recorte de `metaAppId`). El recorte
    sigue cubierto por `phoneNumberId`, y `wabaId` nunca lo verificó, así que no hay regresión.
  - R27 sigue afirmando que no se llama a Graph, que no se descifra y que el patch no lleva
    `status`, con `displayName` y `wabaId`.
  - R36 envía y pinta los cinco campos con `toEqual` estricto, igual que antes.
  - En `connection-view`, la lista exacta de claves de la vista sigue con `toEqual`.
- [x] **R24, R25 y R27 siguen mapeados.** Están en `create-whatsapp-connection.test.ts` (R24) y en
  `update-whatsapp-connection.test.ts` (R25 y R27). Todos pasan y la tabla de trazabilidad de
  `impl_QC-237.md` se actualizó para R27.
- [x] **Las notas del spec son correctas.** `requirements.md` y `design.md` llevan la nota fechada
  2026-10-13. El texto de R24, R25 y R27, la D14, el resumen de la ficha, el modelo, los tipos, la
  tabla de acciones, las etiquetas y la guía quedan sin App ID. D17 está registrada en
  `progress/features/QC-237.md`.

### Hallazgos

- **menor M1. La base local compartida queda desalineada.**
  - El humano autorizó `db:migrate` en la base local compartida el 2026-10-09 (F2.2), así que esa
    base ya aplicó la versión vieja de `20261009130000`. Conserva `meta_app_id NOT NULL` y el
    checksum viejo en `_prisma_migrations`.
  - Con el código nuevo, un alta desde la app local fallará por `NOT NULL`, y `prisma migrate`
    marcará la migración como modificada.
  - CI y las bases efímeras no se ven afectados.
  - Requiere una decisión humana sobre cómo realinear esa base. El reviewer no la toca. Conviene
    anotarlo en `progress/features/QC-237.md` para que QC-224 y el resto del equipo lo sepan.
- **menor M2.** En `create-whatsapp-connection.test.ts:147` falta un espacio:
  `['phoneNumberId vacio',{ phoneNumberId: '\t' }]`. Es solo estilo. El lint pasa y Prettier no
  está en el gate (el archivo ya no cumplía Prettier antes de este commit).
- **menor M3, opcional.** Ningún int test afirma que `meta_app_id` ya no existe. El `INSERT` de la
  migración lo cubre de forma indirecta: con la columna `NOT NULL` fallaría. No hace falta añadir
  nada.

### Veredicto

**OK.** No hay bloqueantes. M1 es una tarea operativa para el humano o el leader, no del código.
