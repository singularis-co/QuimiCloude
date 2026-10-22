# Review QC-275 — Proveedor IA propio de la empresa

## Vuelta 1 (origin/dev...HEAD, HEAD = bd93993d)

Leído: `specs/QC-275-proveedor-ia-propio/{requirements,design,tasks}.md`, `progress/impl_QC-275.md`,
`CHECKPOINTS.md`, `docs/checkpoints-proyecto.md`, `docs/perfil-agentes.md > reviewer` y `> Todos los agentes`.
Grafo MCP no consultado: la revisión se hizo con Grep/Read y `git diff`.

### Verificación ejecutada (por el reviewer)

- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 7 warnings previos (`order-service.test.ts`, `confirm-catalog-import.test.ts`).
- `pnpm exec vitest run guard`: 75 archivos, 1055 verdes, 20 omitidos, 0 rojos.
- Unit de la ficha (`tests/unit/integraciones/ai-provider`, `integraciones-ui`, `documentos-ui`,
  `ai-provider-wiring`, `run-document-job-ai-provider`, `issue-upload-links-ai-provider`,
  `ai-model-literals`, `openai-sdk-isolation`, los tres adaptadores de IA, `ai-provider-required-notice`
  y `module-shape`): 43 archivos, 557 verdes, 1 omitido, 0 rojos.
- `.int`: `ai-provider-connection-prisma` y `ai-provider-migration`: 2 archivos, 23/23 verdes en base efímera.
- `canvas.json` y `aislamiento.json` tras el merge: JSON válido. `origin/dev` es ancestro de HEAD.

### Checklist

- [x] Trazabilidad: R1–R44 mapeados en `progress/impl_QC-275.md > Cierre`. Los tests existen y
  afirman lo que dicen (revisados R1, R2, R5, R7, R8, R19, R20, R23–R28 y R41).
  R35 pendiente de los logos por decisión del humano: cubierto hoy por el `aria-label` del monograma.
- [ ] Tasks: T0–T15 en `[x]`; **T16 y T17 siguen en `[ ]`** (menor 1).
- [x] `design.md > ## Lo que ya existe`: presente y completa. El diff reutiliza `SecretCipher`,
  el actor, el ámbito, `Notice`, `PasswordField`, `Card`, `ConfirmDialog` y `ErrorState`, y no re-crea
  nada de esa lista.
- [x] Typecheck, lint y guardias en verde.
- [x] Dependencias: `openai` es la única nueva. Tiene fila en `docs/dependencias.md` con los cuatro
  checks y la aprobación D3/F1.4, citada en `design.md > 18.1`.
- [x] Sin secretos ni modelos hardcodeados en `lib/`: los modelos salen de la siembra de la migración
  y `ai-model-literals.test.ts` lo vigila.
- [x] Migración versionada con `down.sql`, como la última de la carpeta, sin choque con `dev`.
- [x] RLS: las dos tablas tienen la RLS activada y forzada; el `.int` lo comprueba sobre `pg_class`.
- [x] Aislamiento por empresa: `ai_provider_connections.company_id NOT NULL` con índice único; `ai_providers`
  está en la lista de tablas exentas (`docs/architecture.md`, guardia actualizada). Todas las consultas del
  adaptador filtran por `companyScopeColumns(scope)`, y el `.int` «R2 — la empresa B no lee, no actualiza ni
  borra la conexión de A» prueba que se rechaza el acceso cruzado.
- [x] Autorización en el dominio: `requirePermission` es la primera línea de los cinco casos de uso de
  actor (antes de validar la entrada); la empresa sale de `scopeOf(actor)`, y en la cola, de `claimed.companyId`.
  Las Server Actions no deciden nada.
- [x] Comentarios: ninguna línea añadida en producción cita `QC-<n>`, `R<n>`, `design.md` ni
  «decisión cerrada».
- [x] Multiplataforma: campo de 16 px y 44 px, ojo de 44×44, botones `touch`, sin `hover:` como única
  vía y apilado por contenedor ≤ 760 px (los tests de la tarjeta y del formulario lo afirman).
- [x] Diseño: los tableros `ProveedorIA*.dc.html` están citados en `design.md`; `AiProviderRequiredNotice`
  tiene su fila en `CATALOGO.md` con su diseño, y `PasswordField` anota el punto de extensión nuevo.

### Foco de seguridad

- **La key no se filtra en claro (R7, R8): OK.**
  - En la base solo entra `cipher.encrypt(...)`; el `.int` comprueba que la columna lleva `v<n>:` y no la key.
  - `AiProviderConnectionView` se copia campo a campo dos veces: en el dominio (`toAiProviderConnectionView`)
    y en el borde (`toConnectionState`). Ni `apiKeyEnc` ni `id` llegan a la acción, a las props ni al HTML.
  - Los estados de las acciones solo llevan `elapsedMs`, `message` (el texto compuesto del sistema) o el error del catálogo.
  - El `ValidationError` no incluye la entrada.
  - El `diagnostic` de `AiProviderError` solo lleva el proveedor y el código HTTP.
  - El campo se vuelve a montar vacío tras cada respuesta (`key={fieldGeneration}`) y nunca tiene `defaultValue`.
- **Contexto de cifrado: OK.**
  - `aiProviderKeyContext(id, scope)` = `{ companyId, recordId: <id de la fila>, field: 'api_key' }`.
  - `persistOnce` cifra con el id de la fila que de verdad queda: el existente, o uno nuevo antes del INSERT.
    En una carrera, la segunda vuelta vuelve a leer y a cifrar con el id ganador (R19, unit y `.int`).
- **Bloqueo de subida en el servidor (R23): OK.**
  - `issueUploadLinks` comprueba `aiProvider.isConfigured(actor.companyId)` después del permiso y antes del
    esquema y de firmar nada.
  - La readiness de la página es solo de presentación: ante un error devuelve «sin configurar» y el servidor
    vuelve a comprobar.
- **Corte D1: OK.**
  - No queda ningún camino a las keys de la plataforma: `ai-config-env.ts` está borrado, y `readWithAnthropic`
    y `readWithGenai` ya no se exportan.
  - `documentos.readPdfWithAi` y `documentos.processPdfByStrategy` salen de la fachada.
  - El único `aiReader` sale de `aiProviderGateway.readerFor` (la conexión de la empresa dueña del archivo,
    o el doble E2E, y en los dos casos solo si hay conexión).
  - En `lib/` y `app/` nadie lee `ANTHROPIC_*` ni `GEMINI_*`. Solo los nombra `scripts/entorno-de-preview.mjs`,
    para forzarlos vacíos, lo que es inocuo.

### Desviaciones de la bitácora

- **Prop `placeholder` en `PasswordField`: aceptada.** Es el paso 2 de la regla: prop opcional, los
  consumidores no cambian y la fila de `CATALOGO.md` anota el punto de extensión. El texto «Pega aquí tu API
  key» está en `design.md > 12.3`.
- **Icono `info` en el aviso de bloqueo: aceptado.** `design.md > 12.6` lo decide de forma explícita
  («se usa `Notice` tal cual… la diferencia de icono se acepta»).
- **3 textos fuera del spec: menor 2.**
  - «Ruta» es el `aria-label` de la miga, el mismo patrón que `Superficies.dc.html` (`[Ruta]`).
  - «No se pudo cargar el proveedor IA.» es el título del `ErrorState`.
  - El enlace a la consola usa la URL sin el protocolo.
  - Ninguno inventa comportamiento, pero D13 solo aprueba los textos de `design.md > 4.4`, `> 11` y `> 12.3`:
    falta que el humano los confirme.
- **`movimiento.spec.ts` siembra la conexión: aceptado.** `tasks.md` lo lista, y sin la fila el diálogo de
  subida de Fórmulas no se pinta (R37). La siembra borra la fila antes que los usuarios y la empresa, y también
  en la limpieza de huérfanos.
- **`components/shared/index.ts` no creado: aceptado.** No hay barril raíz y crearlo rompería la guardia del
  catálogo. Queda el spec desalineado: menor 3.
- **Merge `bd93993d`: correcto.** Los tres conflictos son de registro y se resolvieron conservando las dos ramas.
  Los JSON son válidos, las guardias están en verde y no hay migración de `dev` posterior a `20261013150000`.

### Hallazgos

1. **menor**: T16 y T17 siguen en `[ ]` en `tasks.md`, y `CHECKPOINTS.md` pide todas en `[x]`.
   - T17 tiene el mapa hecho: falta marcarla cuando `./init.sh` dé verde.
   - T16 depende del E2E en una base migrada (contexto acordado).
   - Hay que marcar las dos antes del merge.
2. **menor**: los tres textos de la pantalla que no recoge el spec (arriba) necesitan la confirmación del humano.
   Si se aprueban, hay que añadirlos a `design.md > 12.3`.
3. **menor**: `design.md > 1` y `tasks.md > Archivos esperados` todavía listan `components/shared/index.ts`,
   que no existe ni debe existir. También listan `public/brand/ai-providers/*.svg`, pendientes de R35.
   Hay que corregir el spec para que no parezcan faltantes.
4. **menor**: falta el «Cancelar» al cambiar la key o el proveedor (el tablero no lo trae). Se sale guardando o
   recargando. No incumple R32, pero es una fricción de UX que conviene llevar al humano.

### Veredicto

**OK.** No hay bloqueantes. Los menores 1–3 se cierran antes del merge.
