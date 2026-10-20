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
