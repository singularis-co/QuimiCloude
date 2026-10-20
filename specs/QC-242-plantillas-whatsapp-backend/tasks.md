# QC-242 — plantillas-whatsapp-backend · tasks.md

> Orden por dependencias. `[P]` = puede ir en paralelo con las otras `[P]` de su bloque una vez
> cumplidas sus dependencias. Cada task cierra con `pnpm run typecheck`, `pnpm run lint` y
> `pnpm exec vitest related --run <archivos tocados>` en verde, y un commit `feat(QC-242): …` /
> `test(QC-242): …`. Nada de comentarios con `QC-<n>`, `R<n>` ni `design.md` en producción; en
> tests, `R<n>` va en el nombre del caso.
>
> **Antes de T3** (bloqueante): contrastar con la documentación vigente de la Cloud API de WhatsApp
> los datos marcados **[POR CONFIRMAR]** —límites de §3.3, idiomas de §3.2, peticiones y respuestas de
> §6, códigos de §4.9 y forma de los webhooks de §7.1— y anotar en `progress/impl_QC-242.md` la
> versión consultada y cada diferencia. Si una cambia un requisito, se para y se pregunta.

## Bloque A — Base

- [x] **T1 — Esquema y migración** (R1, R2, R50). Depende de: —
  - `db/schema.prisma`: enums `WhatsappTemplateCategory` y `WhatsappTemplateStatus`, modelo
    `WhatsappTemplate` con `/// @module integraciones`, y `templatesSyncedAt` en `WhatsappConnection`
    (§2.1).
  - `db/migrations/20261020120000_whatsapp_templates/migration.sql` y `down.sql` a mano, en el orden
    de §2.2.
  - **Hecho:** la migración se aplica sobre la base de test; `down.sql` la revierte y se vuelve a
    aplicar; `prisma validate` y `generate` en verde; `guard-empresa-en-esquema` y `guard-rls-force`
    en verde.

- [x] **T2 [P] — Códigos de error** (R51). Depende de: —
  - `lib/modules/errores/domain/error-codes.ts` y `error-catalog.ts`: los 6 códigos de §12.
  - `lib/modules/integraciones/domain/errors.ts`: las 6 clases.
  - `tests/unit/errores/catalogo.test.ts`: cuenta + 6.
  - **Hecho:** catálogo y su test verdes; typecheck verde por los `satisfies`.

## Bloque B — Dominio puro (tras T2)

- [x] **T3 — Tipos, idiomas y validador** (R4, R6–R13). Depende de: T2 y el contraste previo
  - `domain/whatsapp-template.ts`, `domain/whatsapp-template-languages.ts`,
    `domain/whatsapp-template-draft.ts` (§3.1–3.3).
  - `tests/unit/integraciones/whatsapp/templates/whatsapp-template-draft.test.ts`.
  - **Hecho:** un caso por fila de §3.3 en el límite y en el límite + 1; el archivo del validador solo
    importa `zod` y `domain/`.

- [x] **T4 [P] — Componentes y plantilla de Meta** (R4, R26, R46). Depende de: T3
  - `domain/whatsapp-template-components.ts`, `domain/whatsapp-template-meta.ts` (§3.4, §3.5).
  - Tests `whatsapp-template-components.test.ts` y `whatsapp-template-meta.test.ts`.
  - **Hecho:** ida y vuelta borrador ⇄ componentes; `contentOf` ⇒ `null` con componentes de otra fase;
    `IN_APPEAL` ⇒ `OTHER` con su valor.

- [x] **T5 [P] — Plan de sincronización** (R23–R25). Depende de: T3
  - `domain/template-sync-plan.ts` (§4.3) y `template-sync-plan.test.ts`.
  - **Hecho:** tabla de casos de §4.3 verde.

- [x] **T6 [P] — Fallos de Graph** (R19, R21, R43). Depende de: T2
  - `domain/graph-failure.ts`: `code` y `subcode` opcionales en `GraphFailure`.
  - `domain/template-graph-failure.ts` (§4.9) con su test dentro de `create-whatsapp-template.test.ts`
    (T10) o propio.
  - **Hecho:** cada fila de §4.9 da su error; el `diagnostic` tacha los secretos; los tests de
    `graph-failure` de QC-237 siguen verdes sin cambiar sus casos.

## Bloque C — Puertos y adaptadores (tras T1, T3, T6)

- [x] **T7 — Puertos** (R3). Depende de: T3, T5, T6
  - `ports/whatsapp-template-repository.ts` (§5.1); `ports/whatsapp-graph-client.ts` + 3 métodos
    (§5.3).
  - `domain/whatsapp-connection.ts` y `whatsapp-connection-prisma.ts`: `templatesSyncedAt` en el
    record y el select (la vista de la conexión no lo expone).
  - `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`: dobles del repositorio y de Graph.
  - **Hecho:** typecheck verde; los tests de QC-237/QC-238 que usan los dobles siguen verdes.

- [x] **T8 [P] — Graph real y doble** (R27). Depende de: T7
  - `adapters/driven/graph/whatsapp-graph-client-fetch.ts` y `whatsapp-graph-client-canned.ts` (§6).
  - Tests `whatsapp-graph-client-templates.test.ts` y `whatsapp-graph-client-canned-templates.test.ts`.
  - **Hecho:** URL, método, cabecera y cursor comprobados con `fetch` espiado; el token nunca en la
    URL; `5xx` ⇒ `unreachable`.

- [x] **T9 [P] — Persistencia** (R1–R3, R23–R25, R36, R37). Depende de: T1, T7
  - `adapters/driven/persistence/company-scope.ts` (+ `whatsappTemplateCompanyScope`) y
    `whatsapp-template-prisma.ts` (§5.2).
  - `tests/integration/integraciones/whatsapp-template-prisma.int.test.ts`,
    `whatsapp-template-migration.int.test.ts`; entradas en `tests/integration/aislamiento.json`.
  - `tests/guards/guard-ambito-empresa-integraciones.test.ts`: tercer puerto, quinta envoltura.
  - **Hecho:** casos de §14.1 para estos dos archivos verdes; la guardia de ámbito verde y con sus casos
    de sensibilidad.

## Bloque D — Casos de uso (tras el bloque C)

- [x] **T10 — Conexión utilizable, crear, eliminar, listar** (R5, R14–R21, R42–R46). Depende de: T7,
  T4, T6
  - `domain/template-connection.ts`, `create-whatsapp-template.ts`, `delete-whatsapp-template.ts`,
    `list-whatsapp-templates.ts` (§4.1, §4.4–4.6).
  - Tests `create-whatsapp-template.test.ts`, `delete-whatsapp-template.test.ts`,
    `list-whatsapp-templates.test.ts`.
  - **Hecho:** casos de §14.1; sin permiso, ningún puerto llamado.

- [x] **T11 — Sincronizar: núcleo, manual y reintento** (R22–R28, R38). Depende de: T5, T7, T10
  - `domain/sync-whatsapp-templates.ts` (§4.2) y `sync-whatsapp-templates.test.ts`.
  - **Hecho:** una página fallida ⇒ `applySync` no se llama; `createTemplate`/`deleteTemplate`
    nunca llamados; el reintento no lanza.

- [x] **T12 [P] — Importación al crear la conexión** (R29, R30). Depende de: T11
  - `domain/create-whatsapp-connection.ts` (§4.7);
    `adapters/driving/whatsapp-connection-actions.ts` (log).
  - Tests `create-whatsapp-connection.test.ts` y `whatsapp-connection-actions.test.ts` ampliados.
  - **Hecho:** con la lista de Graph fallando, la conexión se crea y queda una línea de log sin
    secretos; los casos de QC-237 siguen verdes.

- [x] **T13 [P] — El cron (dominio)** (R32, R33). Depende de: T11
  - `domain/sync-all-whatsapp-templates.ts` (§4.8) y `sync-all-whatsapp-templates.test.ts`.
  - **Hecho:** casos de §14.1; ninguna llamada a `findLive` con dos empresas.

- [x] **T14 [P] — Webhook** (R36–R41). Depende de: T4, T9, T11
  - `domain/whatsapp-template-webhook.ts`, `whatsapp-webhook-payload.ts`,
    `receive-whatsapp-webhook.ts` (§7.1–7.3).
  - `whatsapp-webhook-payload.test.ts` (R14 de QC-238 con `account_update`) y
    `receive-whatsapp-webhook.test.ts` ampliados.
  - **Hecho:** casos de §14.2; los casos de QC-238 siguen verdes.

## Bloque E — Bordes y cableado (tras el bloque D)

- [x] **T15 — Composición y contrato** (R47). Depende de: T8–T14
  - `lib/composition/index.ts` (§10) y `lib/modules/integraciones/index.ts` (§11).
  - `tests/unit/integraciones/module-shape.test.ts` tensado (§14.2).
  - **Hecho:** `module-shape` y `guard-arquitectura-modulos` verdes.

- [x] **T16 [P] — Server Actions** (R5, R47, R48). Depende de: T15
  - `adapters/driving/whatsapp-template-actions.ts` (§9) y `whatsapp-template-actions.test.ts`.
  - **Hecho:** contrato y claves exactas de cada `data`; el test de una lectura de sesión por petición
    verde con la acción nueva.

- [x] **T17 [P] — Ruta del cron** (R31, R33–R35). Depende de: T15
  - `adapters/driving/whatsapp-template-cron-route.ts`,
    `app/api/cron/sincronizar-plantillas-whatsapp/route.ts`, `vercel.json` (§8).
  - Tests `whatsapp-template-cron-route.test.ts`; `tests/unit/pedidos/vercel-cron.test.ts` por
    `path`; `tests/guards/guard-rutas-fuera-de-sesion.test.ts` con la ruta nueva.
  - **Hecho:** tests y guardias verdes; `route-segment-config` acepta los literales.

- [x] **T18 [P] — Ruta del webhook con `after`** (R38, R40). Depende de: T15
  - `adapters/driving/whatsapp-webhook-route.ts` (§7.4) y `whatsapp-webhook-route.test.ts` ampliado.
  - **Hecho:** `after` una vez con `followUp`, ninguna sin él; el fallo de la resincronización no
    cambia el `200`; los casos de QC-238 siguen verdes.

- [x] **T19 [P] — Guía de la pestaña Conexión** (R49). Depende de: — ([P8] aprobada el 2026-10-20)
  - `app/(private)/integraciones/whatsapp/components/whatsapp-setup-guide.tsx` (§13) y
    `tests/unit/integraciones-ui/whatsapp-page.test.tsx`.
  - **Hecho:** el paso aparece con los tres nombres de campo.

## Bloque F — Recorrido y cierre

- [x] **T20 — Recorrido de integración** (criterios de aceptación de la ficha). Depende de: T16–T18
  - `tests/integration/integraciones/whatsapp-template-flow.int.test.ts` (§14.1), entrada en
    `aislamiento.json`.
  - **Hecho:** crear ⇒ `PENDING`; webhook `APPROVED`/`REJECTED`/categoría; id desconocido ⇒
    resincroniza; eliminar en un idioma no toca el otro.

- [x] **T21 — Cierre** (R52). Depende de: T1–T20
  - `pnpm exec vitest run guard`, `./init.sh` en verde; `package.json` y `.env.example` sin cambios.
  - `progress/impl_QC-242.md` con el mapa `R<n> → test` y las diferencias encontradas al contrastar
    con Meta.
  - **Hecho:** cada `R1…R52` mapeado a un test concreto.

# Enmienda 2026-10-20 — diccionario de variables (T22–T35, R53–R86)

> T1–T21 están hechas y mergeadas (PR #281). Estas tasks van en la misma rama, con un segundo PR. Mismas
> reglas de cierre que arriba. Diseño en `design.md > 18`; decisiones E1–E16 en `requirements.md >
> Enmienda 2026-10-20`.
>
> [P10], [P11], [P13], [P14], [P16] y [P18] aprobadas por el humano el 2026-10-20. De [P11] siguen
> abiertos el dato de `nombre` y la forma de `pedido_numero`: no bloquean T24 (el catálogo solo declara
> de qué dato sale cada constante); los cierra la ficha que escribe el resolvedor.
>
> **Antes de T26**: contrastar con la documentación vigente de la Cloud API la forma en que `GET
> message_templates` devuelve los componentes (sobre todo `example`) frente a lo que se envía al crear
> ([P4] [POR CONFIRMAR]); anotarlo en `progress/impl_QC-242.md`. Si difieren en algo que
> `componentsChanged` (§18.5) no normaliza, se para y se pregunta: E6 quitaría la relación a todas las
> creadas.

## Bloque G — Base (enmienda)

- [ ] **T22 — Esquema y migración** (R53, R63, R80, R84, R86). Depende de: —
  - `db/schema.prisma`: enum `WhatsappTemplateMappingStatus`, modelos `WhatsappVariableKey` y
    `WhatsappTemplateVariable` con `/// @module integraciones`; `mappingStatus`, `enabled` y el único
    `(companyId, id)` en `WhatsappTemplate` (§18.2).
  - `db/migrations/20261020180000_whatsapp_variable_keys/migration.sql` y `down.sql` a mano, en el
    orden de §18.3, con el relleno del paso 6.
  - **Hecho:** la migración se aplica sobre la base de test; `down.sql` la revierte y se vuelve a
    aplicar; `prisma validate` y `generate` en verde; `guard-empresa-en-esquema` y `guard-rls-force`
    en verde.

- [ ] **T23 [P] — Códigos de error** (R85). Depende de: —
  - `error-codes.ts`, `error-catalog.ts`: los 5 códigos de §18.9; `domain/errors.ts`: las 5 clases.
  - `tests/unit/errores/catalogo.test.ts`: cuenta + 5.
  - **Hecho:** catálogo y su test verdes.

## Bloque H — Dominio puro (enmienda)

- [ ] **T24 — Constantes y variable propia** (R53–R55). Depende de: T23
  - `domain/whatsapp-system-variables.ts` y `domain/whatsapp-variable-key.ts` (§18.4).
  - `tests/unit/integraciones/whatsapp/templates/whatsapp-variable-key.test.ts`.
  - **Hecho:** casos de §18.10 en el límite y en el límite + 1; los dos archivos solo importan `zod` y
    `domain/`.

- [ ] **T25 — Huecos, estado del mapeo, traducción y borrador con claves** (R6, R64–R67, R81).
  Depende de: T24
  - `domain/whatsapp-template-variables.ts` (§18.5), `domain/whatsapp-template-keyed-draft.ts` (§18.6),
    `domain/whatsapp-template-draft.ts` (+ `unknown_key`).
  - Tests `whatsapp-template-variables.test.ts` y `whatsapp-template-keyed-draft.test.ts`.
  - **Hecho:** el ejemplo canónico de E16 (`Hola {{nombre}}` ⇄ `Hola {{1}}` con `body.1 = nombre` y la
    etiqueta como ejemplo) verde en los dos sentidos; los tests de T3 del validador `{{n}}` siguen
    verdes sin cambiar sus casos.

- [ ] **T26 [P] — Plan de sincronización** (R70–R72). Depende de: T25 y el contraste previo
  - `domain/template-sync-plan.ts` (§18.7, «Sincronización») y `template-sync-plan.test.ts` ampliado.
  - **Hecho:** tabla de §18.10 verde; un caso fija que lo creado (`toMetaComponents`) y lo que lista el
    doble `canned` para esa misma plantilla no cuentan como cambio; los casos de T5 siguen verdes.

## Bloque I — Puertos y adaptadores (enmienda)

- [ ] **T27 — Puertos y dobles** (R63). Depende de: T25, T26
  - `ports/whatsapp-variable-key-repository.ts` (nuevo) y `ports/whatsapp-template-repository.ts`
    (§18.8); `domain/whatsapp-template.ts` (record y vista).
  - `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`: doble de variables propias y métodos
    nuevos.
  - **Hecho:** typecheck verde; los tests de T7–T14 que usan los dobles siguen verdes.

- [ ] **T28 [P] — Persistencia de variables propias** (R53, R58–R60, R63). Depende de: T22, T27
  - `adapters/driven/persistence/whatsapp-variable-key-prisma.ts` (nuevo) y `company-scope.ts` (+ dos
    envolturas).
  - `tests/integration/integraciones/whatsapp-variable-key-prisma.int.test.ts`; entrada en
    `tests/integration/aislamiento.json`.
  - `tests/guards/guard-ambito-empresa-integraciones.test.ts`: cuarto puerto, envolturas nuevas.
  - **Hecho:** casos de §18.10 de ese archivo verdes; la guardia verde con sus casos de sensibilidad.

- [ ] **T29 [P] — Persistencia de plantillas ampliada** (R68–R73, R76, R80). Depende de: T22, T27
  - `adapters/driven/persistence/whatsapp-template-prisma.ts` (§18.8).
  - `tests/integration/integraciones/whatsapp-template-prisma.int.test.ts` ampliado y
    `whatsapp-variable-keys-migration.int.test.ts` (nuevo, R84, R86); entrada en `aislamiento.json`.
  - **Hecho:** casos de §18.10 verdes; los casos de T9 siguen verdes (incluida la traducción del único
    parcial medida en `03054b0d`).

## Bloque J — Casos de uso (enmienda)

- [ ] **T30 — Diccionario** (R55–R62). Depende de: T27
  - `domain/manage-whatsapp-variable-keys.ts` (§18.7) y `manage-whatsapp-variable-keys.test.ts`.
  - **Hecho:** sin permiso, ningún puerto llamado; una clave de constante ⇒ `taken` sin puerto.

- [ ] **T31 [P] — Crear con claves** (R14, R66–R69). Depende de: T27
  - `domain/create-whatsapp-template.ts` (§18.7, «Crear») y `create-whatsapp-template.test.ts`
    ampliado.
  - **Hecho:** casos de §18.10; los casos de T10 de crear se reescriben solo en su borrador (`{{n}}` ⇒
    `{{clave}}`), no en lo que comprueban.

- [ ] **T32 [P] — Relacionar, habilitar, deshabilitar** (R72, R74–R80). Depende de: T27
  - `domain/relate-whatsapp-template-variables.ts` (§18.7) y `relate-whatsapp-template-variables.test.ts`.
  - **Hecho:** casos de §18.10; ninguna llamada a Graph en ningún caso.

- [ ] **T33 [P] — Listar, consultar y vista** (R81, R82). Depende de: T27
  - `domain/list-whatsapp-templates.ts` (§18.7, «Listar») y `list-whatsapp-templates.test.ts` ampliado.
  - **Hecho:** claves exactas de la vista; los casos de T10 de listar siguen verdes salvo la lista
    exacta de claves de R46, que se amplía.

## Bloque K — Bordes y cierre (enmienda)

- [ ] **T34 — Composición, contrato y Server Actions** (R83). Depende de: T28–T33
  - `lib/composition/index.ts`, `lib/modules/integraciones/index.ts` (§18.9);
    `adapters/driving/whatsapp-variable-key-actions.ts` (nuevo) y `whatsapp-template-actions.ts`.
  - Tests `whatsapp-variable-key-actions.test.ts`, `whatsapp-template-actions.test.ts` ampliado,
    `tests/unit/integraciones/module-shape.test.ts` tensado (archivos, contrato, modelos de seis a ocho,
    R6 sobre el validador con claves).
  - **Hecho:** `module-shape`, `guard-arquitectura-modulos` y el test de una lectura de sesión por
    petición verdes con las acciones nuevas.

- [ ] **T35 — Recorrido y cierre** (criterios de E1–E16). Depende de: T34
  - `tests/integration/integraciones/whatsapp-template-flow.int.test.ts` ampliado con el recorrido de
    §18.10.
  - `pnpm exec vitest run guard`, `./init.sh` en verde; `package.json` y `.env.example` sin cambios
    (R52).
  - `progress/impl_QC-242.md`: mapa `R53…R86 → test`, el contraste de la forma del `GET` y lo que se
    resolvió de [P10]–[P18].
  - **Hecho:** cada `R53…R86` mapeado a un test concreto.

# Enmienda 2 — 2026-10-20 (tarde): las constantes las define el front (T36–T40, R87–R96)

> Decisiones F1–F4 en `requirements.md > Enmienda 2`; diseño en `design.md > 19`. T22–T25 están
> implementadas **sin commit** sobre la versión anterior: T36–T38 las corrigen encima, sin rehacerlas
> desde cero. Las propuestas [P19]–[P22] van con esta enmienda a aprobación; si el humano cambia
> alguna, cambia la task que la implementa.

- [ ] **T36 — Corregir T22** (R88, R84). Depende de: —
  - Migración `20261020180000_whatsapp_variable_keys`: `CHECK whatsapp_template_variables_system_key_format`
    a la forma de constante de §19.2 (la migración no se ha aplicado fuera del worktree: se edita, no se
    añade otra). `down.sql` no cambia. Comentario del modelo en `db/schema.prisma`.
  - `tests/integration/integraciones/whatsapp-template-migration.int.test.ts`: sus dos casos de índices
    y `CHECK` exactos de `whatsapp_templates` ganan `whatsapp_templates_company_id_id_key` y
    `whatsapp_templates_enabled_requires_mapped` (§19.1).
  - **Hecho:** la migración se aplica, se revierte y se vuelve a aplicar; los dos casos verdes.

- [ ] **T37 — Corregir T24** (R87–R90). Depende de: T36
  - Borrar `domain/whatsapp-system-variables.ts` y su export; `domain/whatsapp-variable-key.ts` con
    `WHATSAPP_CONSTANT_KEY_PATTERN` y la vista sin rama `system` (§19.2, §19.5).
  - `whatsapp-variable-key.test.ts`: fuera los casos del catálogo; casos de R88 (dos segmentos, tres
    segmentos, segmento de 41, punto en una propia).
  - **Hecho:** ningún archivo importa el catálogo; los 5 códigos de T23 sin cambio.

- [ ] **T38 — Corregir T25** (R91, R92, R95). Depende de: T37
  - `domain/whatsapp-template-keyed-draft.ts` (§19.3, §19.4) y `domain/whatsapp-template-variables.ts`
    (`variableSlotsOf` con marcas no numéricas ⇒ `null`).
  - Tests `whatsapp-template-keyed-draft.test.ts` (ejemplo corregido de `Hola {{cliente.nombre}}`;
    propia desconocida ⇒ `unknown_key`; constante sin etiqueta ⇒ `example_missing`) y
    `whatsapp-template-variables.test.ts` (`{{first_name}}` ⇒ no relacionable).
  - **Hecho:** casos verdes; T3 sigue verde sin cambiar sus casos.

- [ ] **T39 [P] — `contentOf` con el ejemplo de URL como texto** (R96). Depende de: —
  - `domain/whatsapp-template-components.ts` (§19.5) y `whatsapp-template-components.test.ts`.
  - **Hecho:** los dos formatos dan el mismo contenido; la ida y vuelta de T4 sigue verde.

- [ ] **T40 — Cierre de la enmienda 2** (R87–R96). Depende de: T36–T39 y T26–T35
  - `progress/impl_QC-242.md`: mapa `R87…R96 → test`.
  - **Hecho:** cada `R87…R96` mapeado a un test concreto.

**Cambios en las tasks pendientes T26–T35** (se hacen con la versión de §19):

- **T26**: sin cambio de alcance; el contraste con Meta ya salió sin bloqueo. El caso «lo creado y lo
  listado no cuentan como cambio» se escribe después de T39.
- **T27**: el puerto de variables propias pierde `countSystemKeyUsage`.
- **T28**: el `CHECK` de §19.2 en el `.int` (constante con un segmento ⇒ rechazo).
- **T30**: listar solo propias (R90); crear y modificar ya no miran ningún catálogo (R89).
- **T31**: la acción de crear pasa `constantLabels` ([P20]).
- **T32**: clasificar con §19.3 (R93).
- **T33**: la vista con `label: null` para constantes (R94).
- **T34**: el contrato pierde `WHATSAPP_SYSTEM_VARIABLES` y `SystemVariable`, gana
  `WHATSAPP_CONSTANT_KEY_PATTERN`.
- **T35**: el recorrido usa `Hola {{cliente.nombre}}` con su etiqueta en `constantLabels`.

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261020120000_whatsapp_templates/migration.sql`
- `db/migrations/20261020120000_whatsapp_templates/down.sql`
- `vercel.json`
- `app/api/cron/sincronizar-plantillas-whatsapp/route.ts`
- `app/(private)/integraciones/whatsapp/components/whatsapp-setup-guide.tsx`
- `lib/composition/index.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/errores/domain/error-catalog.ts`
- `lib/modules/integraciones/index.ts`
- `lib/modules/integraciones/domain/errors.ts`
- `lib/modules/integraciones/domain/graph-failure.ts`
- `lib/modules/integraciones/domain/whatsapp-connection.ts`
- `lib/modules/integraciones/domain/whatsapp-template.ts`
- `lib/modules/integraciones/domain/whatsapp-template-languages.ts`
- `lib/modules/integraciones/domain/whatsapp-template-draft.ts`
- `lib/modules/integraciones/domain/whatsapp-template-components.ts`
- `lib/modules/integraciones/domain/whatsapp-template-meta.ts`
- `lib/modules/integraciones/domain/template-graph-failure.ts`
- `lib/modules/integraciones/domain/template-sync-plan.ts`
- `lib/modules/integraciones/domain/template-connection.ts`
- `lib/modules/integraciones/domain/sync-whatsapp-templates.ts`
- `lib/modules/integraciones/domain/sync-all-whatsapp-templates.ts`
- `lib/modules/integraciones/domain/list-whatsapp-templates.ts`
- `lib/modules/integraciones/domain/create-whatsapp-template.ts`
- `lib/modules/integraciones/domain/delete-whatsapp-template.ts`
- `lib/modules/integraciones/domain/whatsapp-template-webhook.ts`
- `lib/modules/integraciones/domain/whatsapp-webhook-payload.ts`
- `lib/modules/integraciones/domain/receive-whatsapp-webhook.ts`
- `lib/modules/integraciones/domain/create-whatsapp-connection.ts`
- `lib/modules/integraciones/ports/whatsapp-graph-client.ts`
- `lib/modules/integraciones/ports/whatsapp-template-repository.ts`
- `lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-fetch.ts`
- `lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-canned.ts`
- `lib/modules/integraciones/adapters/driven/persistence/company-scope.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-template-prisma.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-connection-prisma.ts`
- `lib/modules/integraciones/adapters/driving/whatsapp-template-actions.ts`
- `lib/modules/integraciones/adapters/driving/whatsapp-template-cron-route.ts`
- `lib/modules/integraciones/adapters/driving/whatsapp-webhook-route.ts`
- `lib/modules/integraciones/adapters/driving/whatsapp-connection-actions.ts`
- `tests/unit/errores/catalogo.test.ts`
- `tests/unit/pedidos/vercel-cron.test.ts`
- `tests/unit/integraciones/module-shape.test.ts`
- `tests/unit/integraciones-ui/whatsapp-page.test.tsx`
- `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-webhook-payload.test.ts`
- `tests/unit/integraciones/whatsapp/receive-whatsapp-webhook.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-webhook-route.test.ts`
- `tests/unit/integraciones/whatsapp/create-whatsapp-connection.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-connection-actions.test.ts`
- `tests/unit/integraciones/whatsapp/templates/whatsapp-template-draft.test.ts`
- `tests/unit/integraciones/whatsapp/templates/whatsapp-template-components.test.ts`
- `tests/unit/integraciones/whatsapp/templates/whatsapp-template-meta.test.ts`
- `tests/unit/integraciones/whatsapp/templates/template-sync-plan.test.ts`
- `tests/unit/integraciones/whatsapp/templates/sync-whatsapp-templates.test.ts`
- `tests/unit/integraciones/whatsapp/templates/sync-all-whatsapp-templates.test.ts`
- `tests/unit/integraciones/whatsapp/templates/create-whatsapp-template.test.ts`
- `tests/unit/integraciones/whatsapp/templates/delete-whatsapp-template.test.ts`
- `tests/unit/integraciones/whatsapp/templates/list-whatsapp-templates.test.ts`
- `tests/unit/integraciones/whatsapp/templates/whatsapp-template-actions.test.ts`
- `tests/unit/integraciones/whatsapp/templates/whatsapp-template-cron-route.test.ts`
- `tests/unit/integraciones/whatsapp/templates/whatsapp-graph-client-templates.test.ts`
- `tests/unit/integraciones/whatsapp/templates/whatsapp-graph-client-canned-templates.test.ts`
- `tests/integration/integraciones/whatsapp-template-prisma.int.test.ts`
- `tests/integration/integraciones/whatsapp-template-migration.int.test.ts`
- `tests/integration/integraciones/whatsapp-template-flow.int.test.ts`
- `tests/integration/aislamiento.json`
- `tests/guards/guard-ambito-empresa-integraciones.test.ts`
- `tests/guards/guard-rutas-fuera-de-sesion.test.ts`
- `progress/impl_QC-242.md`

Enmienda 2026-10-20 (T22–T35); las que ya están arriba se repiten solo si son nuevas:

- `db/migrations/20261020180000_whatsapp_variable_keys/migration.sql`
- `db/migrations/20261020180000_whatsapp_variable_keys/down.sql`
- `lib/modules/integraciones/domain/whatsapp-system-variables.ts`
- `lib/modules/integraciones/domain/whatsapp-variable-key.ts`
- `lib/modules/integraciones/domain/whatsapp-template-variables.ts`
- `lib/modules/integraciones/domain/whatsapp-template-keyed-draft.ts`
- `lib/modules/integraciones/domain/manage-whatsapp-variable-keys.ts`
- `lib/modules/integraciones/domain/relate-whatsapp-template-variables.ts`
- `lib/modules/integraciones/ports/whatsapp-variable-key-repository.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-variable-key-prisma.ts`
- `lib/modules/integraciones/adapters/driving/whatsapp-variable-key-actions.ts`
- `tests/unit/integraciones/whatsapp/templates/whatsapp-variable-key.test.ts`
- `tests/unit/integraciones/whatsapp/templates/whatsapp-template-variables.test.ts`
- `tests/unit/integraciones/whatsapp/templates/whatsapp-template-keyed-draft.test.ts`
- `tests/unit/integraciones/whatsapp/templates/manage-whatsapp-variable-keys.test.ts`
- `tests/unit/integraciones/whatsapp/templates/relate-whatsapp-template-variables.test.ts`
- `tests/unit/integraciones/whatsapp/templates/whatsapp-variable-key-actions.test.ts`
- `tests/integration/integraciones/whatsapp-variable-key-prisma.int.test.ts`
- `tests/integration/integraciones/whatsapp-variable-keys-migration.int.test.ts`

Enmienda 2 (T36–T40): no añade rutas nuevas. Toca, entre las ya listadas,
`lib/modules/integraciones/domain/whatsapp-template-components.ts`,
`tests/unit/integraciones/whatsapp/templates/whatsapp-template-components.test.ts`,
`tests/integration/integraciones/whatsapp-template-migration.int.test.ts` y borra
`lib/modules/integraciones/domain/whatsapp-system-variables.ts`.
