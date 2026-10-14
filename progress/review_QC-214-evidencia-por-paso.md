# QC-214 — evidencia-por-paso · review (F2.2)

Rango revisado: `c86bda37..HEAD` (`058db394`), 34 commits, 147 archivos.
Fuentes: `specs/QC-214-evidencia-por-paso/{requirements,design,tasks}.md`, tableros
`docs/diseno/canvas/{EvidenciaPaso,FormulaEvidencia}*.dc.html`, `progress/impl_QC-214.md`,
`CHECKPOINTS.md`, `docs/checkpoints-proyecto.md`, `docs/perfil-agentes.md > reviewer`.
Grafo MCP no usado: la revisión se hizo con Grep/Read y el diff.

## Verificación ejecutada por el reviewer

Restricción de memoria: sin `./init.sh`, suite completa ni E2E (los da `gate-completo` en CI).

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | sin errores |
| `pnpm exec eslint` sobre `lib/modules/{asignaciones,recetas}`, `lib/composition`, `components/shared/{step-evidence,step-reader}`, `components/ui/switch.tsx`, `app/(private)/asignacion`, `app/(private)/produccion/formulas`, `e2e/ejecucion-receta.spec.ts` | 0 problemas |
| `vitest run` 18 archivos de dominio (`step-evidence`, `register/remove/request-evidence`, `evidence-target`, `record-step-move-evidence`, `finish-assigned-order`, `finish-packing`, `step-evidence-actions`, `count-evidence-locking-orders`, `recipe-step-lock`, `update-recipe`, `get-recipe-step-lock`, `recipe-input`, `tests/unit/errores`) | `Test Files 18 passed`, `Tests 403 passed` |
| `vitest run` 13 archivos de UI y contratos (`step-evidence`, `upload-evidence`, `switch`, `order-execution-evidence`, `packing-order-evidence`, `recipe-form-evidence-lock`, `recipe-version-form-evidence`, `step-reader`, `recipe-steps-field`, `recipe-step-editor`, `asignaciones-facade`, `recetas/module-contract`, `recipe-route-contract`) | `Test Files 13 passed`, `Tests 249 passed` |
| `pnpm exec vitest run guard` | `Test Files 75 passed`, `Tests 1054 passed / 20 skipped` |
| `vitest run --project integration` de `step-evidence-constraints`, `step-evidence-repository` y `step-evidence-flag` | `Test Files 3 passed`, `Tests 36 passed` |

E2E (`e2e/ejecucion-receta.spec.ts`): no se volvió a correr; me fío de la salida de la bitácora (`8 passed`) y
lo confirma CI.

## Checklist

### Trazabilidad (R1–R39)
- [x] Cada `R<n>` mapea a un test concreto y no vacío (`progress/impl_QC-214.md > Mapa R<n> -> test (completo)`).
  Comprobé con muestras los casos dudosos: R7 (`update-recipe.test.ts:295`, solo cambia el switch y se rechaza
  sin `recetas.modificar`), R20/R24/R25 (`step-evidence.test.tsx:143,173,191,211`, con `capture="environment"`),
  R23 en Empaque (`packing-order-evidence.test.tsx:247,264`), R33 (`get-packing-order.test.ts:356,376`,
  TTL `15 * 60`, y si empaca otra persona no se firma nada), R38 (`step-evidence-repository.int.test.ts:331-344`,
  cancelar y dar de baja no borran), R35 de punta a punta en el E2E.
- [x] El mapa está en la bitácora.

### Tasks
- [x] T1–T21 en `[x]`.

### CHECKPOINTS.md
- [x] requirements EARS numerados; design con 6 alternativas descartadas; tasks completas.
- [x] `design.md` abre con `## Lo que ya existe` (búsqueda, filas del catálogo consultadas y paso de la regla).
  El diff no vuelve a crear nada de esa lista. El storage calca el patrón de `documentos` sin importarlo, y el
  design lo declara y lo justifica (adaptadores driven de otro módulo).
- [x] Hay assignee y la rama se publicó con candado (`progress/features/QC-214.md`).
- [x] Typecheck y lint sin errores (lint acotado a lo tocado).
- [ ] `gate-completo` en verde: **pendiente en CI**, por decisión del humano. Es condición del merge, no de esta review.
- [x] Flujo crítico: la feature no toca autenticación, inventario, importes ni webhooks. Aun así lleva un E2E de
  Playwright.
- [x] Sin dependencias nuevas: `package.json` no cambia, y `@base-ui/react` y `@supabase/storage-js` ya estaban aprobadas.
- [x] Sin secretos. `SUPABASE_EVIDENCE_BUCKET` y `EVIDENCE_E2E_DOUBLES` van vacías en `.env.example` y tienen su fila en
  `docs/architecture.md > Variables por entorno`.
- [x] No hay webhooks.
- [x] Nada que dependa del entorno está escrito en el código: el bucket sale de una variable y la elección del doble se
  lee en cada llamada.
- [ ] `./init.sh` rápido: la bitácora da 3 rojos. Dos quedaron arreglados en `8916f0ae` (los verifiqué: 31/31). El
  tercero es `catalog-line.int.test.ts` R32 (D33, del entorno, ajeno). No se volvió a correr entero por falta de
  memoria; lo cubre CI.

### docs/checkpoints-proyecto.md
- [x] Multiplataforma: casillas y botones de 44 × 44 px (`touch` y `touchTarget`); nada depende de `:hover`; el visor
  usa `80dvh`, no `100vh`; no hay inputs de texto nuevos. El `text-[13px]` del `Switch` es la etiqueta de un botón, no
  un input.
- [x] Filas del catálogo al día: `Switch` (nueva), `StepEvidence…` (nueva) y `StepReader` (con sus tres puntos de
  extensión), cada una con su tablero en `Diseño`.
- [x] Pase `/design` aprobado y citado: `requirements.md > Decisiones cerradas` (última fila), `design.md > 1` y las
  celdas del catálogo.
- [x] `order_step_evidence` lleva `company_id`, y toda consulta del adaptador filtra por él (`listByOrder`, `findById`,
  `insert`, `replace`, `delete`, `listOrderIdsWithEvidence`). El rechazo entre empresas tiene test
  (`evidence-target.test.ts`, `step-evidence-repository.int.test.ts`, `step-evidence-constraints.int.test.ts`).
- [x] Los permisos se validan en `domain/` con test: `requireEvidenceAccess` va antes de parsear y
  `resolveEvidenceTarget` (permiso de la fase, responsable o quien empaca, estado) antes de cualquier puerto.
  `getRecipeStepLock` exige `recetas.consultar` y `updateRecipe` exige `recetas.modificar`.
- [x] RLS `ENABLE` + `FORCE`, sin policies.
- [x] Al negocio solo se accede por el adaptador Prisma. El cliente de Supabase solo se usa para Storage (bytes), como
  en `documentos`.
- [x] Migración versionada con `down.sql` exacto. La bitácora da `db:migrate`, `db:rollback` y `db:migrate` en verde.
- [x] Hexagonal: `domain/` y `ports/` sin framework ni base de datos; `recetas` declara `RecipeStepLockReader` y
  `lib/composition` lo cablea, sin importar `asignaciones` (no hay ciclo). El `'use server'` de
  `step-evidence-actions.ts` no sale reexportado: se importa por su ruta exacta. Los adaptadores driving no instancian
  driven. La lógica vive en `domain/`; las actions solo resuelven el actor, llaman y traducen.
- [x] Mutaciones por Server Actions. La página pide `getRecipeStepLockAction` en el servidor y pasa el dato por props.

### Reglas del proyecto (perfil-agentes > reviewer, 5–11)
- [x] 5 Calidad y seguridad. La ruta del bucket la construye el servidor (`buildEvidencePath`); el registro valida
  el prefijo (`isEvidencePathOf`) y la base lo repite con un CHECK. El tipo se comprueba por contenido y el tope de 3
  está en la base (único por `slot` más CHECK 1..3).
- [x] 6 Multiplataforma: ver arriba.
- [x] 7 Dependencias: ninguna nueva.
- [x] 8 Aislamiento por empresa: ver arriba; la guardia `guard-empresa-en-esquema` está en verde.
- [x] 9 Comentarios: ninguna línea añadida en archivos de producción (`app`, `components`, `lib`, `db`, config) cita
  `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada» (búsqueda con grep sobre el diff).
- [x] 10 Duplicados: `StepEvidence` (paso 3, componer) y `Switch` (paso 4, porque no había interruptor); el design
  explica por qué `FileField`, `DocumentUpload` y `Checkbox` no bastaban.
- [x] 11 Diseño: las dos piezas nuevas y el cambio visual del editor tienen tablero citado.

### Registros compartidos (solo añadidos; hay excepción de cruce con QC-225/QC-235)
- [x] `lib/composition/index.ts`: +82 / −0. Imports al final de sus bloques, deps nuevas al final de cada caso de
  uso, operaciones nuevas al final de la fachada.
- [x] `lib/modules/errores/domain/error-codes.ts` (+15/−0) y `error-catalog.ts` (+13/−0): 5 códigos al final.
- [x] `db/schema.prisma`: +32 / −0, al final.
- [x] `components/shared/CATALOGO.md`: +3 / −1. La línea quitada es la fila de `StepReader`, que se reescribe para
  anotar sus puntos de extensión, como pide la regla de decisión (paso 2). Es la única forma válida de hacerlo. Puede
  chocar con QC-262 en F2.3.
- [x] `docs/architecture.md`: +2 / −0.

## Desvíos declarados: decisión del reviewer

1. **R24, solo lectura solo en la pieza.** ACEPTADO. R24 es un requisito opcional («DONDE…»). La pregunta abierta 5
   de `requirements.md`, aprobada con el spec, fija por defecto que ninguna pantalla lo monta en esta ficha y que lo
   monta QC-271; `design.md > Lo que ya existe` lo repite. La pieza lo implementa y su test lo verifica
   (`step-evidence.test.tsx:173`). Empaque no lo monta porque al terminar redirige a la lista. No es hallazgo.
2. **T17, comprimir antes de pedir el enlace firmado.** ACEPTADO. R17 y R18 se cumplen igual. El orden nuevo es mejor:
   un archivo inválido no gasta una firma ni llega al servidor, y el servidor sigue validando por contenido (R32).
   Solo queda desfasado el texto de `design.md > 7` (menor m1).
3. **T20, el E2E parte de un pedido en curso en el paso 2 y quita la foto desde una segunda pestaña.** ACEPTADO. El
   orden que pedía `tasks.md` no se puede reproducir con la UI: quitar la foto del paso 1 obliga a estar en él, y
   entonces «Siguiente» queda bloqueado (R15). El punto de partida es real: una fórmula que empezó a pedir evidencia
   en un paso ya pasado (R37). Con la segunda pestaña, el rechazo `evidence_required` de Finalizar (R35) se prueba en
   el servidor y no solo en la UI. Cubre R13, R15, R18, R22 y R35, más el texto de R23. Solo queda desfasado el texto
   de T20 en `tasks.md` (menor m2).

## Hallazgos

### Bloqueantes (mayores)

Ninguno.

### Menores

- **m1 (menor) — `design.md > 7` no cuenta el orden real de la subida.** Dice «1. enlace firmado → 2. comprimir»,
  y `components/shared/step-evidence/upload-evidence.ts > uploadEvidence` comprime primero. Hay que ajustar
  el § 7 (o anotarlo en Decisiones de `progress/features/QC-214.md`) al cerrar, para que QC-271 no lea un orden que
  no existe.
- **m2 (menor) — el texto de `tasks.md > T20` no coincide con el E2E.** Sigue diciendo «Siguiente bloqueado, …,
  quitar la foto volviendo atrás, “Falta evidencia” al finalizar…». El flujo real es: retomar en el paso 2,
  «Falta evidencia», paso 1, subir, avanzar, quitar desde otra pestaña, rechazo del servidor, volver a subir y
  finalizar. Bastaría una línea en el «Hecho».
- **m3 (menor) — «Cambiar» con la misma ruta deja una foto contada sin archivo.** En
  `lib/modules/asignaciones/domain/register-evidence.ts`, una petición hecha a mano con
  `replacesEvidenceId = X` y `path = X.path` pasa todas las validaciones (el archivo existe y es válido).
  `replace` borra la fila X e inserta otra con la misma ruta, y después
  `removeEvidenceSafely(deps.storage, replaced.path)` borra ese mismo archivo. Resultado: una fila que cuenta como
  evidencia y apunta a un archivo que ya no está. Solo lo provoca quien ejecuta el pedido, sobre su propio pedido y
  sin pasar por la UI, que siempre pide una ruta nueva. Arreglo sugerido: rechazar `path === replaced.path` con
  `ValidationError` antes de descargar.
- **m4 (menor) — registrar una ruta que ya está registrada da un error inesperado.** Si se registra una ruta ya
  registrada en otra fila del mismo pedido, el único `order_step_evidence_company_path_key` lanza un P2002.
  `insert` no lo reconoce como `slot` y lo relanza, así que la action devuelve el error genérico en vez de uno del
  dominio. Solo pasa con una petición hecha a mano. Se podría traducir a `ValidationError`.

### Notas (no son hallazgos)
- `getRecipeStepLock` recorre por páginas todos los pedidos `EN_CURSO`/`EN_EMPAQUE` de la empresa cada vez que se
  abre la edición de una fórmula. El design lo acepta (§ 5.6: es la cola de planta, que está acotada); conviene
  vigilarlo si la cola crece.
- Fuera del código, antes de producción: crear el bucket privado de evidencias en prod y preview (5 MB,
  JPEG/PNG/WebP) y poner `SUPABASE_EVIDENCE_BUCKET`. Ya está anotado en `progress/features/QC-214.md > Estado`.

## Veredicto

**OK** — 0 bloqueantes, 4 menores. Los tres desvíos declarados quedan aceptados. Para el merge sigue haciendo falta
`gate-completo` en verde en CI.
