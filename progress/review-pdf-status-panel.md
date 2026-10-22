# Review — pdf-status-panel

Rango revisado: `git diff 683a7e2e~1 97070fad` (683a7e2e, d4932928, 4088d7d6, ea70fb46, 97070fad).
Ya está en `origin/dev` y en `origin/feature/pdf-status-panel`: se revisó **después** de integrarse.

## Verificación ejecutada (no solo la bitácora)

- `pnpm typecheck`: limpio.
- `pnpm exec eslint` sobre los archivos de producción y el test nuevo: sin hallazgos.
- `pnpm exec vitest run` con document-batch-panel.test.tsx, batch-status.test.ts,
  get-batch-status.test.ts, document-batch-repository-prisma.test.ts,
  document-upload-convenciones.test.ts y guard-catalogo-de-componentes.test.ts:
  6 archivos y 115 tests, todos en verde.
- Grep de comentarios prohibidos (`R<n>`, `QC-<n>`, `design.md`, «decisión cerrada») en las líneas
  de producción añadidas: ninguno.
- MCP del grafo: no se usó. Todo se hizo con Grep/Read.

## Checklist

### Especificación / proceso
- [ ] `specs/<feature>/requirements.md`: **no existe**.
- [ ] `specs/<feature>/design.md` con `## Lo que ya existe` y alternativa descartada: **no existe**.
- [ ] `specs/<feature>/tasks.md` con todo en `[x]`: **no existe**.
- [ ] Feature en el board, con assignee y candado: **no está** en `feature_list.json` y no hay
      `progress/features/<key>.md`.
- [ ] Trazabilidad `R<n>` -> test: los R<n> solo están en los `progress/impl-pdf-status-*.md` y no hay
      requirements.md contra el que contrastarlos. R5 y R6 del frontend no tienen un test propio:
      «el propio archivo» y «las guardias vigilan» no cuentan como tests.

### Calidad de código
- [x] Typecheck.
- [x] Lint.
- [x] Tests relacionados en verde.
- [ ] `gate-completo` en CI: no lo he comprobado; la rama ya estaba mergeada a dev.
- [x] Sin dependencias nuevas, porque `package.json` no se tocó.
- [x] Sin secretos ni hardcode de entorno: `maxAttempts` sale de `config.maxRetries()`, no de un literal.

### Datos y seguridad / aislamiento por empresa
- [x] Sin modelos ni migraciones nuevas: `attempts` y `originalName` ya existían.
- [x] `readBatch` sigue filtrando por `companyId` en sus dos consultas (`findFirst` y `findMany`).
      Los campos nuevos (`attempts`, `name`) solo salen de filas de la empresa del actor.
- [x] El permiso se sigue validando en el caso de uso (`requirePermission`, en get-batch-status.ts:34).
      Los tests previos de tanda ajena o inexistente con resultado null siguen en verde.
- [x] Mapeo Prisma correcto: el `select` exacto está probado, y `name` usa `originalName` o, si falta,
      el último segmento del path, sin dar nunca un nombre vacío.

### Módulos hexagonales
- [x] `domain/` y `ports/` sin imports nuevos de framework. El puerto devuelve `ReadBatch` y el caso
      de uso lo completa con `maxAttempts`.

### UI / multiplataforma / catálogo / diseño
- [x] Botones con `touch` y `text-base`. Sin `100vh`. Sin acciones que dependan solo de `:hover`.
- [x] Fila de `CATALOGO.md` actualizada en el mismo commit.
- [ ] Referencia de diseño del componente nuevo `DocumentBatchPanel`: no hay design.md. La celda
      `Diseño` reutiliza los canvas previos (`Formulas.dc.html`, `ModalesProduccion.dc.html`), y en
      ellos no aparece ningún panel de tandas ni «intento N de M».

### Correctness de batch-memory (lo pedido)
- [x] `localStorage` protegido con try/catch al leer (`getItem` + `JSON.parse`) y al escribir.
- [x] SSR: `typeof window` como guarda, y `getServerSnapshot` devuelve un `EMPTY` constante, así que
      no hay desajuste de hidratación.
- [x] `useSyncExternalStore`: `getSnapshot` devuelve `current`, una referencia estable que solo cambia
      al mutar el registro. El filtro va memoizado sobre `[all, strategy]`, así que no hay bucle de
      renders.
- [x] Tope: `slice(0, 20)` después de poner la tanda nueva primera, y deduplica por `batchId`.
- [x] Lo leído se sanitiza contra `pdfStrategySchema`.
- [ ] Sincronización entre pestañas: no hay listener de `storage` (ver hallazgo 6).
- [x] El sondeo para: `useBatchStatus` se detiene con todo terminado, con un error o con la tanda
      desaparecida, y limpia el timer al desmontar.
- [ ] Sondeo duplicado: ver hallazgo 4.

## Hallazgos

1. **BLOQUEANTE (SDD, CHECKPOINTS > Especificación y Trazabilidad):** no existen
   `specs/<feature>/{requirements,design,tasks}.md`. La feature no está en el board ni tiene
   `progress/features/<key>.md`. Los R<n> de los informes no se pueden contrastar con requisitos
   EARS, y R5 y R6 del frontend (progress/impl-pdf-status-frontend.md) no apuntan a ningún test.
   La feature entró a `dev` sin spec, sin review y sin candado.
   Para cerrarlo: ficha en Jira, spec retroactivo (requirements, design con `## Lo que ya existe`,
   tasks) y un mapa R<n> -> test sin entradas vacías.

2. **BLOQUEANTE (perfil reviewer n.º 11; checkpoints-proyecto > Calidad de código):**
   `DocumentBatchPanel` es un componente nuevo de `components/shared`
   (components/shared/document-upload/document-batch-panel.tsx:119). No tiene pase `/design` ni
   referencia en un design.md. La celda `Diseño` de su fila (components/shared/CATALOGO.md:69) cita
   canvas en los que no sale el panel. Además se monta dentro de `PageHeader > actions`
   (app/(private)/produccion/formulas/components/formula-pdf-upload.tsx:24-28 y page.tsx:45), una
   fila flex de botones con `@max-[760px]:*:flex-1`. Un panel de hasta 20 tandas con sus filas queda
   en la cabecera de la página, y nadie aprobó esa ubicación.

3. **menor (test que no prueba lo que dice):** «la tanda recordada sobrevive al desmontaje»
   (tests/unit/documentos-ui/document-batch-panel.test.tsx:132-143) solo ejercita la copia en memoria
   del módulo. La lectura desde `localStorage` (components/shared/document-upload/batch-memory.ts:45-55:
   `ensureHydrated`, `sanitize`, el catch de JSON corrupto) nunca se ejecuta en los tests, porque el
   módulo se hidrata una sola vez por proceso. Tampoco hay test de `setItem` lanzando (modo privado o
   cuota llena). Es justo lo que hace que la tanda sobreviva a una recarga. Falta un test con
   `vi.resetModules()` y `localStorage` precargado, uno con datos corruptos y otro con datos de forma
   antigua.

4. **menor (sondeo duplicado):** con la ventana montada (`keepMounted`) y el panel a la vez, la misma
   tanda se sondea dos veces cada 2 s. La sondean `DocumentUpload` (document-upload.tsx:63) y
   `PanelBatch` (document-batch-panel.tsx:50). Cada consulta hace un UPDATE de `expireStale`, la
   lectura del aviso, un intento de `notify` y dos SELECT. El informe dice «Sondeo: ninguno nuevo»
   (progress/impl-pdf-status-frontend.md), y eso no es exacto. Además, cada visita a /produccion/formulas
   lanza una consulta por cada tanda recordada de la estrategia, hasta 20
   (document-batch-panel.tsx:139-141), aunque ya hayan terminado.

5. **menor (registro no ligado al usuario ni a la empresa):** la clave es global del navegador
   (batch-memory.ts:8) y cerrar sesión no la limpia. Si otro usuario entra en el mismo navegador:
   - Si es de otra empresa, ve las tandas como «desconocidas». No se filtra ningún dato, porque el
     servidor devuelve null.
   - Si es de la misma empresa y tiene el permiso, ve las tandas de su compañero con nombres de
     archivo y motivos de error. Hoy el servidor ya lo permite porque no filtra por autor, pero el
     panel se lo muestra sin que lo busque.
   Conviene acotar la clave por usuario, o decidirlo en el spec.

6. **menor (entre pestañas):** se hidrata una sola vez y no hay listener del evento `storage`
   (batch-memory.ts:45-55 y 78-87). Una pestaña que llama a `rememberBatch` o a `forgetBatch` vuelve
   a escribir su copia en memoria entera y **borra** las tandas que haya registrado otra pestaña. El
   catálogo declara que no sincroniza entre pestañas, pero no avisa de esta pérdida.

7. **menor («intento N de M» puede pasarse del tope):** `maxAttempts` se calcula en cada consulta
   con el `maxRetries()` actual (lib/modules/documentos/domain/get-batch-status.ts:47). En cambio,
   QStash fijó los `retries` al publicar. Si la variable de entorno cambia entre la publicación y la
   consulta, o la cola entrega de más, la pantalla puede decir «Intento 5 de 4».
   `attemptLabel` (components/shared/document-upload/labels.ts:67) no acota por arriba.

8. **menor (UX y accesibilidad):** todas las tandas se rotulan igual, «Tanda» (labels.ts:72), y
   todos los botones de descarte se llaman igual, «Descartar» (document-batch-panel.tsx:58-67). Un
   lector de pantalla oye N botones idénticos sin saber de qué tanda es cada uno, y nada identifica
   la tanda: ni fecha (hay `rememberedAt`) ni número de archivos.

9. **menor:** con `disabled` (proveedor de IA sin configurar), el panel desaparece del todo
   (document-batch-panel.tsx:127), incluso con tandas que siguen en curso. Si es la decisión buscada,
   debe constar en el spec.

10. **menor (formato):** el diff quitó el salto de línea final de 12 archivos que antes lo tenían.
    Entre ellos están formula-pdf-upload.tsx, batch-memory.ts, document-batch-panel.tsx,
    document-upload-row.tsx, index.ts, labels.ts, use-remembered-batches.ts y batch-status.ts. Viene
    de escribir con PowerShell. También hay líneas de más de 100 columnas
    (document-batch-panel.tsx:140 y document-upload-row.tsx:26). Y en la fila del catálogo
    (CATALOGO.md:69) falta el punto en «permite descartarla No cubre».

No hay ninguna fuga entre empresas ni ningún fallo de autorización en la consulta de la tanda. El
mapeo de Prisma y los tests del backend (claves congeladas, select exacto, `maxAttempts` sacado de
la configuración) son correctos y prueban lo que dicen.

## Veredicto

**RECHAZADO** (cambios requeridos). Los dos bloqueantes son de proceso y de diseño (1 y 2), no de
correctness. En el código no he encontrado ningún bloqueante. Para el código, prioridad: 3
(test de hidratación), 4 (sondeo duplicado) y 5 (clave por usuario).
