# QT-291 — seleccion-de-modelo-por-tarea · review (F2.2)

Reviewer, 2026-10-22. Diff `origin/dev...HEAD` (rama `feature/QT-291-seleccion-de-modelo-por-tarea`, HEAD `41e103b5`).
El MCP del grafo no se usó: revisión con Grep/Read y git diff.

## Verificación ejecutada por el reviewer

| Qué | Resultado |
|---|---|
| `pnpm run typecheck` | 0 errores |
| `pnpm run lint` | 0 errores, 10 warnings en archivos que el diff no toca |
| `pnpm exec vitest run guard` | 87 archivos, 1276 pass, 22 skipped, 0 fail |
| Unit afectados (`tests/unit/integraciones/ai-provider/`, `integraciones-ui/`, `ai-reader-*`, `run-document-job-ai-provider`, `ai-provider-wiring`, `module-shape`, `ai-model-literals`) | 29 archivos: **28 pass, 1 FAIL** (`module-shape.test.ts`, ver B1) |
| Consumidores de `SharedSelectControl` (`shared-select`, `campos`, `campos-paridad`, `packing-finish-dialog`) | 4 archivos, 113 pass |
| `.int` afectados (`ai-models-migration`, `ai-provider-connection-prisma`, `ai-provider-migration`) | 3 archivos, 45 pass |

`tests/unit/integraciones/module-shape.test.ts` **no** está en `tests/baseline-rojos.json`: es un rojo nuevo.

## Checklist

### CHECKPOINTS.md
- [x] `requirements.md` con R1–R34 en EARS.
- [x] `design.md` con alternativas descartadas (§16).
- [x] `tasks.md`: 15 tasks, todas `[x]`.
- [x] `design.md` abre con `## Lo que ya existe`, la tabla no está vacía y el diff no re-crea nada de esa lista: amplía QC-275, `AiProviderCatalog`, `SharedSelectControl`; `AiModelSelect` es paso 3 y compone piezas ya catalogadas.
- [x] Assignee y rama: los da por buenos el leader (no es verificable desde el diff).
- [x] Trazabilidad: cada R1–R34 tiene un test real (ver abajo). Mapa en `progress/impl_QT-291.md > T14`.
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` en verde: **lo romperá B1** (rojo nuevo, fuera del baseline).
- [x] Flujo crítico: no toca ninguno (`docs/checkpoints-proyecto.md > Flujos criticos`). Aun así hay E2E (E7), con su salida en la bitácora.
- [x] Dependencias: `package.json` no cambia.
- [x] Secretos: ningún secreto en el código. Webhooks: no hay ninguno.
- [x] Configuración: nada que cambie entre entornos quedó en el código; los ids de modelo están solo en la migración y en los tests (R6).

### docs/checkpoints-proyecto.md
- [x] Typecheck y lint.
- [x] Multiplataforma: letra de 16 px en el disparador y en las opciones, objetivos de 44 px (escritorio) y 48 px (teléfono), hoja inferior a ≤ 640 px con `85dvh` y `safe-area-inset-bottom`, nada que dependa solo de `:hover`, flecha con `motion-reduce`.
- [x] `CATALOGO.md`: la fila `SharedSelect` anota las cinco props nuevas (ver m3).
- [x] Pase `/design`: los tableros `ProveedorIAModelos*.dc.html` están citados en `design.md` y versionados en `docs/diseno/canvas/`.
- [x] Columna de empresa: `ai_models` está exenta (catálogo global) en `EXENTAS`, en el caso R7 de la guardia (pasan a ser doce) y en `docs/architecture.md > Dominio` n.º 1. Las consultas de la conexión siguen yendo por `scope`; R9 y R11 prueban que el acceso cruzado no escribe en otra empresa.
- [x] Permiso en `domain/`: `selectAiModel` llama a `requirePermission` antes de parsear la entrada. Los tests R8 cubren sin permiso, sin sesión, sin empresa y que el rechazo llega antes de validar.
- [x] RLS: `ai_models` tiene `ENABLE` y `FORCE`; el `.int` lo verifica, incluido un test de sensibilidad sin el `FORCE`.
- [x] Acceso a datos solo por Prisma en adaptadores driven (`catalog/`, `persistence/`).
- [x] Migración versionada con `down.sql`: el inverso es exacto, restaura `recipe_model` y `catalog_model` con los valores literales de `20261013150000_ai_providers` (comprobado), `NOT NULL` y el `CHECK`. El `.int` prueba bajar y subir de nuevo.
- [x] Hexagonal: `domain/` solo importa `domain/`, `ports/` y `zod`; los lectores de `documentos` importan el contrato `@/lib/modules/integraciones`; el adaptador driving no instancia driven; `AiModel` lleva `/// @module integraciones`.
- [x] La lógica vive en `domain/select-ai-model.ts`, no en la Server Action.
- [x] Permisos y página: sin cambios de rutas. Las mutaciones van por Server Action.

### Focos que pidió el leader
- **Migración `ai_models`:** PK `(provider, model_id)`, `CHECK` contra id vacío, FK a `ai_providers` `RESTRICT`, índice único parcial `WHERE is_default` (un segundo predeterminado da `23505`), FK compuesta `(provider, model_id)` desde la conexión (`MATCH SIMPLE`), las veinte filas de §3 con los recomendados de E2, se borran `recipe_model` y `catalog_model`, RLS forzada al final. Correcta. **OK.**
- **Autorización:** `requirePermission` va primero (R8) y la escritura va por `scope`. **OK.**
- **Key en logs y errores:** `AiProviderFailure` solo lleva el tipo, el código y el modelo. `probeFailureMessage` no recibe la key. `selectAiModelAction` devuelve solo `{status:'saved'}` (R13). El log de R34 lleva solo `companyId`, y hay un test que prueba que el log no lleva `API_KEY`, `API_KEY_ENC`, `apiKey` ni `apiKeyEnc`. En R33 hay un test por cada tipo de fallo que comprueba que la respuesta no lleva la key. **OK.**
- **400 de OpenRouter:** `classifyOpenAiError(error, model, 'openrouter')` solo marca `model_unavailable` si `error.error.message === "<model> is not a valid model ID"`, comparando el texto entero y con el modelo en uso. Viene del dato de T0, verificado con key. Hay tests para otro 400, para el mismo 400 desde OpenAI, para un prefijo, un punto final o un 422. La sonda de OpenRouter no cambia (listado y `/key`). **OK.**
- **R12, de ERROR a ACTIVE:** `choicePatch` vuelve a `ACTIVE` y limpia el error solo si `lastError` es el aviso de modelo no disponible (`isModelUnavailableNotice`) o el de key o cuota (`isAccountFailureNotice`, con comparación exacta y el hueco del código HTTP). Con cualquier otro error no toca el estado. Hay un test por cada fila de la tabla de §4.2, más el caso «aviso de otro proveedor» y «ACTIVE solo escribe la elección». **OK.**
- **`SharedSelectControl`:** cinco props opcionales que solo se aplican si llegan; con ellas en `undefined` el árbol es el de antes. Los consumidores siguen en verde (113 pass). La fila de `CATALOGO.md` las anota. **OK**, con m2 y m3.

### Trazabilidad R → test (revisada contra los archivos, no solo contra la bitácora)
R1–R4, R7: `ai-models-migration.int.test.ts` (verde). R5: `ai-provider-wiring.test.ts` «QT-291 R5». R6: `ai-model-literals.test.ts` (QC-275 R43, que el spec mantiene vigente; barre `lib/` y su detector reconoce las cuatro familias). R8–R12, R32–R34: `select-ai-model.test.ts`. R13: `ai-provider-actions.test.ts`. R14 y R19: `save-ai-provider-connection` y `test-ai-provider-key`. R15: `ai-provider-card.test.tsx`. R16 y R17: `resolve-and-report` y `ai-provider-wiring`. R18–R22: `test-saved-ai-provider` y `ai-provider-failure`. R23–R25: `ai-reader-*` y `run-document-job-ai-provider`. R26–R31: `ai-model-select.test.tsx`, `ai-provider-card.test.tsx`, `ai-provider-form.test.tsx`, `ai-provider-page.test.tsx` y E2E. Todos los casos tienen aserciones sobre el comportamiento; no encontré ningún test vacío. **Ningún R sin test.**

## Hallazgos

### B1 — BLOQUEANTE: `module-shape.test.ts` en rojo (rojo nuevo, `gate-completo` fallará)
`tests/unit/integraciones/module-shape.test.ts` › «R19: fuera del modulo solo lo importan lib/composition/index.ts, documentos … y, por ruta exacta, la pantalla de WhatsApp y sus componentes…» falla:

```
+   "app/(private)/integraciones/proveedor-ia/components/ai-model-select.tsx",
```

`ai-model-select.tsx` (T9) importa `type AiModelOption` de `@/lib/modules/integraciones`, y la lista exacta de importadores del test no lo incluye. La bitácora da `module-shape` en verde en T6–T8, pero no se volvió a correr después de T9. No está en `tests/baseline-rojos.json`.
**Qué falta:** añadir `app/(private)/integraciones/proveedor-ia/components/ai-model-select.tsx` a la lista esperada del caso R19 de `module-shape.test.ts`, en el orden en que la devuelve `filesImportingTheModule()`, y volver a correr el archivo.

### B2 — BLOQUEANTE: comentario nuevo en producción que cita `R<n>` (perfil reviewer, regla 9)
`lib/modules/integraciones/adapters/driving/ai-provider-actions.ts`, dentro de `selectAiModelAction`, líneas añadidas por el diff:

```ts
// La conexión no pasa a Error al elegir (R34): sin este registro nadie fuera de la pantalla
// ...
// traducido: mirar la clase del error es cosa del traductor único (guardia R23).
```

Cita `R34` y `guardia R23`. Contradice `docs/conventions.md > Comentarios` y la regla transversal del propio `design.md`.
**Qué falta:** reescribir el comentario sin citar requisitos ni la guardia. Por ejemplo: «elegir no marca la conexión: sin este registro nadie fuera de la pantalla se entera» y «se decide por el estado traducido: mirar la clase del error es cosa del traductor único». Es la única cita de este tipo en las líneas de producción añadidas (busqué con grep en `lib/`, `app/`, `components/` y `db/`).

### m1 — menor: el log de R34 usa `console.error` en vez del logger del módulo
Existe `lib/shared/observability/logger.ts` (`forModule`, pino, `LogFields` solo de primitivas), y otras Server Actions ya lo usan (`product-actions.ts`, `notification-actions.ts`). `console.error` funciona y no filtra nada, pero se aparta del patrón. Además, el test espía `console` global. No bloquea: la decisión F2 solo pide «registrado en el log del servidor».

### m2 — menor: `design.md` dice «paso 1, reutiliza» para `SharedSelectControl`, pero se aplicó el paso 2
La tabla de componentes de `## Lo que ya existe` y §12.1 no se actualizaron tras T9, que **extendió** la pieza con cinco props (paso 2 de la regla de decisión). La bitácora (T9) lo explica y la fila del catálogo lo anota. Falta reflejarlo en `design.md`.

### m3 — menor: el tablero de la extensión va en «Puntos de extensión» y no en `Diseño`
La fila `SharedSelect` sigue con `previo al rediseño` en `Diseño` y cita `ProveedorIAModelos.dc.html` en «Puntos de extensión», porque la guardia solo admite un valor en esa celda. No lo cuento como bloqueante de la regla 11: sin las props nuevas el aspecto de los consumidores actuales no cambia, y el pase de diseño está citado. Conviene que el humano confirme si este es el sitio que quiere para la cita del tablero de una extensión.

## Veredicto

**RECHAZADO** — 2 bloqueantes (B1, B2), 3 menores (m1–m3).

Para pasar: arreglar B1 y B2 y volver a correr `tests/unit/integraciones/module-shape.test.ts`, `pnpm exec vitest run guard` y el lint de `ai-provider-actions.ts`. El resto de la feature (migración, autorización, que la key no se filtre, el 400 de OpenRouter, R12, la ampliación del select y la trazabilidad) está correcto. La vuelta 2 puede limitarse al diff de esos dos arreglos.

## Vuelta 2 (acotada a 1ef0ce5b)

El rango que dio el leader (`git diff 1fa45a06~1`) sale vacío, porque `1fa45a06~1` es el propio `1ef0ce5b` y el árbol de trabajo ya está en HEAD. Por eso reviso `git show 1ef0ce5b`. m3 queda como está, por indicación del leader.

| Hallazgo | Arreglo | Estado |
|---|---|---|
| B1 | `module-shape.test.ts` añade `app/(private)/integraciones/proveedor-ia/components/ai-model-select.tsx` a la lista R19, en el orden que devuelve `filesImportingTheModule()` | Cerrado: el archivo pasa en verde |
| B2 | Comentario de `selectAiModelAction` reescrito sin `R34` ni «guardia R23»; dice el motivo («elegir no marca la conexión…») | Cerrado |
| m1 | `log.error(...)` con `forModule('integraciones')` de `lib/shared/observability/logger` en vez de `console.error`. Pasa solo `companyId` (`LogFields` de primitivas). Importar `lib/shared` desde un adaptador driving está permitido | Cerrado |
| m2 | `design.md`: la fila `SharedSelectControl` pasa a «2, se amplía» con las cinco props, y §12.1 anota «Aplicado en T9 (paso 2)» | Cerrado |

**¿Se pierde cobertura al dejar de comprobar la línea `{ code, diagnostic }` del traductor? No.**
- Esa línea es del traductor común (`createErrorStateTranslator`), no de esta feature. Su contrato lo prueba `tests/unit/errores/to-error-state.test.ts › «R28, R29 — el diagnostico va al log y NUNCA al estado»`, que no depende de qué acción lo use.
- El test de R34 sigue probando lo que es suyo: una sola línea del evento en el logger del módulo, solo con `companyId`, y que ni esa línea ni **ninguna** llamada a `console` (incluida la del traductor, que se silencia pero se captura) llevan `API_KEY`, `API_KEY_ENC`, `apiKey` ni `apiKeyEnc`. Ese era el riesgo de seguridad, y sigue cubierto.
- Lo que deja de afirmar es que el traductor escribe exactamente una línea en `console` con ese diagnóstico. Es un detalle del traductor que ya fijan sus propios tests.

**Verificación ejecutada**
- `vitest run` de `ai-provider-actions.test.ts` y `module-shape.test.ts`: 2 archivos, 126 pass, 1 skip.
- `eslint` de los 3 archivos tocados: sin problemas.
- `vitest run guard`: 87 archivos, 1276 pass, 22 skipped.

Sin regresiones ni hallazgos nuevos en el diff.

**Veredicto vuelta 2: OK.** 0 bloqueantes, 1 menor abierto (m3, que se queda como está por indicación del leader).
