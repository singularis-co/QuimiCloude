# Review QT-304 — tool-calling-con-ai-sdk

## Vuelta 1 (diff `origin/dev...74190f5f9`)

Revisado contra `specs/QT-304-tool-calling-con-ai-sdk/{requirements,design,tasks}.md`,
`progress/impl_QT-304.md`, `progress/features/QT-304.md > Decisiones`, `docs/perfil-agentes.md`,
`CHECKPOINTS.md` y `docs/checkpoints-proyecto.md`. MCP del grafo no usado (Grep/Read sobre el diff).

### Verificación ejecutada (en primer plano, en el worktree)

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | verde (exit 0) |
| `pnpm run lint` | 0 errores, 10 warnings, todos en archivos ajenos al diff |
| `pnpm exec vitest run guard` | 87 archivos, 1327 passed, 22 skipped |
| `vitest run tests/unit/integraciones tests/unit/composition tests/unit/identity tests/unit/documentos` + `qc75-convenciones` + `order-assignments-migration` | 388 archivos, 6913 passed, 65 skipped, 0 rojos |
| int: `ai-agent-model-pairs-migration`, `ai-model-pair-prisma`, `ai-agent-model-pairs-permissions-migration`, `ai-provider-connection-prisma`, `identity-seed`, `ai-models-migration`, `ai-provider-migration` | 7 archivos, 112 passed, 0 skipped (contra base real) |
| `./init.sh` | no corrido: se para en el paso 4 por `feature_list.json` de la raíz (QT-312, ajeno) |

### Checklist

- [x] requirements EARS R1–R49, design con `## Lo que ya existe` y alternativas descartadas (§9), tasks.
- [x] `## Lo que ya existe` presente y con contenido; el diff no re-crea nada de la lista. La tabla de
      clasificación se replica (no se importa el driven de `documentos`), justificado en design §6.
- [ ] Todas las tasks `[x]`: falta **T5.1** (ver menor m1).
- [x] Trazabilidad: cada R1–R49 tiene test con nombre `R<n>` (R48 por las guardias de dependencias, sin
      cambios, como fija design §10). Revisados a fondo R22, R26, R31–R33, R34, R36, R42, R43, R47, R49:
      los tests verifican de verdad (modelo simulado `MockLanguageModelV4`, puerto simulado, barrido real).
- [x] Migraciones up/down: `20261031120000_ai_agent_model_pairs` y `20261031120100_..._permissions`
      con `down.sql` inverso; los int de migración aplican up, down y re-up (R3, R17 incluida la segunda
      aplicación sin cambios).
- [x] RLS `ENABLE` + `FORCE` en `ai_agent_model_pairs`, sin policies (igual que `ai_models`).
- [x] Aislamiento por empresa: la tabla nueva es de plataforma y entra en `EXENTAS` (14 → 15) con
      `docs/architecture.md` actualizado; guardia verde.
- [x] Permisos validados en `domain/` antes de validar entrada y tocar puertos (R13), con tests de
      actor nulo, sin permiso y permiso de consulta insuficiente.
- [x] Aislamiento de `ai`/`@ai-sdk/*`: solo `adapters/driven/ai/ai-sdk-models.ts` y
      `conversational-model-ai-sdk.ts` los importan; `ai-sdk-isolation.test.ts` barre `lib/`, `app/`,
      `components/`, `scripts/` con igualdad exacta y tiene caso de sensibilidad. El puerto solo usa
      `zod` y tipos propios.
- [x] Dependencias: 4 filas `aprobada` (2026-10-31) en `docs/dependencias.md` con los cuatro checks;
      `package.json` con `^7.0.159`, `^4.0.94`, `^4.0.106`, `^4.0.109`; instaladas exactamente esas
      versiones; aprobación citada en design §8 y en Decisiones (F1.4). `DEPENDENCIAS_ESPERADAS` 45 → 49.
- [x] Listas escritas a mano: `module-shape.test.ts` (archivos del módulo, reexports, fachada, tipo del
      cableado, 11 modelos `@module integraciones`), `guard-empresa-en-esquema`, `guard-identificador-de-request`
      (migraciones y dependencias), `aislamiento.json`, seeds y convenciones: todas al día y verdes.
- [x] Seguridad de la key: se descifra en `resolveConversationModel` (interno, no exportado por el
      contrato), viaja solo al puerto; `classifyAiSdkError` devuelve forma cerrada sin cuerpo ni mensaje;
      `withFallback` no copia el `ModelTarget` al resultado; R22 probado sobre éxito, fallos, respaldo,
      sin par, sin herramientas y error de programación. `execute` que lanza devuelve `{ error: 'tool_failed' }`.
- [x] D13: `withFallback` no pasa al respaldo si alguna `toolCalls[i].executed`; el adaptador conserva
      las ejecutadas en el `failed` (test R26 del adaptador con 503 tras ejecutar). El SDK espera a que
      termine cada `execute` (`mapWithConcurrency`/`Promise.all`), así que no se pierde una en vuelo.
- [x] D14: `OVERLOAD_STATUSES = [503, 529]`; 500/502/504 no pasan (tests explícitos); `classifyAiSdkError`
      deja 503/529 como `unexpected` con código (tabla de §6 sin cambios, R45).
- [x] Capas: dominio sin framework/DB/shared; de `identity` solo el contrato (`requirePlatformPermission`
      exportado); composición única que ata puertos; adaptador de pares fuera de `persistence/`
      (desviación aceptada).
- [x] Comentarios: ninguna línea de producción añadida cita `QC-`/`QT-`/`R<n>`/`design.md`.
- [x] Multiplataforma, catálogo de componentes, diseño: no aplica (sin UI).
- [ ] `gate-completo` en CI: pendiente del PR (lo corre CI).

### Hallazgos

Ningún BLOQUEANTE.

- **m1 (menor)** — `specs/QT-304-tool-calling-con-ai-sdk/tasks.md:90`: T5.1 sigue `[ ]`. El mapa
  R1–R49 está hecho y `./init.sh` no puede correr por QT-312 (decisión aceptada: el gate lo hace
  `gate-completo`). Antes del merge: marcar T5.1 `[x]` con la nota de la sustitución, o dejarla hasta
  ver `gate-completo` verde, pero no mergear con la casilla abierta sin esa nota.
- **m2 (menor)** — `specs/QT-304-tool-calling-con-ai-sdk/design.md:54`: el diagrama de §1 sigue
  diciendo `adapters/driven/persistence/ai-model-pair-prisma.ts`; el archivo vive en
  `adapters/driven/catalog/` (desviación de T2 aceptada, pero el design no se enmendó como sí se hizo
  en §5.6 para T1).
- **m3 (menor)** — `lib/modules/integraciones/adapters/driven/ai/conversational-model-ai-sdk.ts:115-124`:
  el envoltorio de `execute` no reenvía el `abortSignal` del SDK y el plazo no corta una herramienta
  colgada: una generación puede superar `timeoutMs` mientras dure un `execute`. Hoy no hay
  herramientas (QT-305); anotarlo para QT-305/QT-307 (plazo propio por herramienta). Relacionado: el
  registro `executed` se anota al terminar `execute`, correcto solo porque el SDK espera siempre a la
  herramienta; anotarlo al empezar sería más robusto frente a un cambio del SDK.
- **m4 (menor)** — `conversational-model-ai-sdk.ts:160`: un último paso con texto **y** llamadas a
  herramientas al llegar al tope devuelve `step_limit` y descarta el texto. Conforme a la letra de R34
  solo si se lee «texto final» como paso sin llamadas; vale como decisión, pero no tiene test que la fije.
- **m5 (menor)** — `tests/unit/integraciones/module-shape.test.ts` (bloque `cableado?.typeOf`): fija el
  tipo de `aiModelPairs` pero no el de `conversationalModel` (`ConversationalModel`), que también se
  declara con tipo en `lib/composition/index.ts`.

### Veredicto

**OK** (APROBADO). Sin bloqueantes; m1 se resuelve antes de pedir el merge y `gate-completo` debe
quedar en verde en el PR.
