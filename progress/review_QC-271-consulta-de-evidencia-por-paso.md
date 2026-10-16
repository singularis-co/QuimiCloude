# Review QC-271 — consulta-de-evidencia-por-paso

Revisado el 2026-10-16. Rama `feature/QC-271-consulta-de-evidencia-por-paso` (HEAD `2ef216aa`). Diff
contra el merge-base con `origin/dev`, que es `977f9aeb`: 81 archivos.

Grafo de código: no usé el MCP. Exploré con Grep/Read y `git diff`.

## Verificación ejecutable (corrida por el reviewer)

- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores y 7 warnings. Los 7 están en archivos que no toca el diff.
- `vitest run` de los 26 tests unit/ui que toca el diff: 26 files, 464 passed, 2 skipped.
- `vitest run tests/guards`, junto con `vitest related` de `read-order-evidence.ts`, `step-evidence.tsx`,
  `list-finished-product-batches.ts` y `lib/composition/index.ts`: 68 files, 963 passed, 14 skipped.
  Ninguno en rojo.
- `vitest run tests/integration/asignaciones/step-evidence-repository.int.test.ts`: 20 passed. Ahí
  están `countByOrders` y el conteo entre empresas (R6 y R29).
- No corrí `./init.sh` ni el E2E (memoria; los corre CI). La bitácora del implementer da el E2E
  `consulta-de-evidencia.spec.ts` en verde: 4 passed, chromium y webkit.

## Checklist

### Trazabilidad (R1–R30)
- [x] Cada R tiene al menos un test concreto que existe y prueba lo que dice. Lo comprobé abriendo
  los nombres y el cuerpo de los casos:
  - R1, R2 y R3: `get-execution-evidence`, `get-order-evidence` y `count-order-evidence`. El permiso
    va antes de `zod` (una entrada malformada sin permiso da `unauthorized`) y no se toca ningún
    puerto. Un rol cualquiera con el permiso entra; un Administrador sin él, no.
  - R4: `finished-product-batches-evidence`, con 3 casos: sin permiso, sin sesión y con el conteo
    fallido. Más `actor.test.ts`, que prueba `canConsultOrderEvidence`.
  - R5: id malformado, pedido inexistente y pedido ajeno dan el mismo `order_not_found`, sin firmar
    nada.
  - R6: 25 ids pasan, 26 dan `invalid_input`, un id que no es uuid también, los duplicados cuentan una
    vez y la lista vacía no llama al repositorio. En integración, no se cuentan filas de otra empresa.
  - R7 a R11: `read-order-evidence` y `order-evidence`.
    - R7: salen las fotos de un paso que ya no existe o que ya no pide foto.
    - R8: orden por paso y por casilla.
    - R9: pedido CANCELADO y pedido dado de baja.
    - R10: una sola llamada de firma, TTL de 900 s y sin `path` en la respuesta.
    - R11: `photos: null` y `signingFailure`.
    - El adaptador Supabase empareja por ruta y lanza si falla un solo elemento.
  - R12 a R15 y R23 a R25 del recorrido: `trace-evidence-placement` y `execution-trace-evidence`.
  - R16 a R19: `finished-product-batches-evidence` y `batch-evidence-dialog`.
  - R20 a R22 y R24: `step-evidence.test.tsx`, ampliado, con los casos de imagen ya resuelta antes de
    la hidratación. También `evidence-step-list`.
  - R26: los dos contratos de ruta, cada uno con su caso de sensibilidad.
  - R27 y R28: `e2e/consulta-de-evidencia.spec.ts`. R28 comprueba además que el navegador no pide
    ninguna foto.
  - R29: unit en los tres casos de uso y en `readOrderEvidence`, más la integración.
  - R30: las guardias, la fachada y el diff, que no toca `package.json`, `db/` ni migraciones (lo
    comprobé con `git diff --name-only`).
- [x] El mapa R → test está en `progress/impl_QC-271-consulta-de-evidencia-por-paso.md > TZ`.

### Tasks
- [x] Todas las de `tasks.md` están en `[x]`: ninguna queda en `[ ]`.

### CHECKPOINTS.md
- [x] requirements (EARS numerado), design con alternativas descartadas (A1–A6) y tasks.
- [x] `design.md > ## Lo que ya existe` existe y no está vacía.
  - El diff no re-crea nada de esa lista. `readStepEvidence` no se reutiliza, y el design lo
    justifica (A1, por R7). `listByOrder`, `EVIDENCE_READ_LINK_TTL_SECONDS`, `requirePermission` y
    `listSummariesByIdsIncludingDeleted` sí se reutilizan.
- [x] Typecheck y lint en verde.
- [ ] `gate-completo` en CI: todavía no hay PR, así que queda pendiente. No es un hallazgo.
- [x] Flujo crítico de permisos cubierto con E2E (R27 y R28).
- [x] Sin dependencias nuevas, sin secretos y sin webhooks.
- [x] Nada hardcodeado que cambie entre entornos. El origen del doble E2E es un dominio reservado
  que solo se usa bajo `EVIDENCE_E2E_DOUBLES`.

### docs/checkpoints-proyecto.md
- [x] Multiplataforma:
  - las líneas añadidas no traen `100vh`/`h-screen` ni `hover:` como única vía de activación;
  - el diálogo usa `h-dvh` y `safe-area-inset`;
  - «Reintentar», «Recargar», «Cerrar» y el botón de la celda llevan `touch` (44 px);
  - no hay inputs nuevos.
- [x] `CATALOGO.md`: la fila de `StepEvidence` está al día, con `consult`, `phaseLabel`, `heading`,
  `onReload`, `EvidenceGroupHeader`, `EvidenceReadError` y `EvidenceStepList`. Su celda `Diseño`
  cita los seis tableros de QC-271.
- [x] Pase `/design` aprobado y citado en `design.md`. Los componentes de ruta nuevos solo componen
  piezas catalogadas (paso 3), y el design lo dice.
- [x] Sin tablas nuevas: RLS no aplica. Toda consulta filtra por la empresa del actor:
  - `listSummariesByIdsIncludingDeleted(companyId, …)`;
  - `listByOrder(companyId, …)`;
  - `groupBy where { companyId, orderId in }`.

  El rechazo cruzado tiene test en unit y en integración.
- [x] Cada permiso se valida en `domain/`, en la primera sentencia, con su test.
  `canConsultOrderEvidence` es solo presentación, y el caso de uso vuelve a exigir el permiso.
- [x] Hexagonal:
  - `domain/` importa solo `zod` y el barrel de `pedidos`;
  - `order-evidence-actions.ts` (`'use server'`) no sale por el barrel;
  - el driving no instancia ningún driven: los pide a la composición.
- [x] Lógica en `domain/` (agrupar, firmar en lote, degradar en R11). Las actions solo resuelven el
  actor, traducen el error y escriben el log.

### Puntos del perfil (reviewer 5–11)
- [x] 5. Calidad y seguridad. Sobre la URL firmada:
  - el actor solo pone `orderId`;
  - las rutas salen de filas filtradas por `company_id`;
  - la ruta nunca llega al cliente (el tipo `StepEvidencePhotoView` no la lleva);
  - el TTL es de 900 s;
  - sin `pedidos.consultar` o `dashboard.consultar` no se firma nada.
- [x] 6. Multiplataforma: ver arriba.
- [x] 7. Dependencias: el diff no toca `package.json`.
- [x] 8. Aislamiento por empresa: ver arriba.
- [x] 9. Comentarios: ninguna línea añadida de producción cita `QC-<n>`, `R<n>`, `design.md` ni
  «decisión cerrada». Lo comprobé con grep sobre las líneas `+` de `app/`, `lib/` y `components/`.
- [x] 10. Duplicados: `StepEvidence` se extiende (paso 2) y `EvidenceStepList`/`EvidenceReadError` se
  componen (paso 3). El design declara las dos cosas y la excepción de subirlas a `shared`, que
  tienen dos consumidores.
- [x] 11. Diseño: las referencias están en el design y en la celda del catálogo.

### Puntos pedidos por el leader
- [x] **R21, ejecución y empaque sin cambios.** Sin `consult`:
  - el árbol, los textos y el contador (solo `ok`) siguen como hoy;
  - el `ref`, `onLoad` y `onError` de `<img>` quedan en `undefined`;
  - no aparece «Vista vencida».

  Lo cubren los casos «R21 — sin `consult`…» y los tests previos de `step-evidence.test.tsx`, que
  siguen verdes. No cambia ningún consumidor de ejecución ni de empaque.
- [x] **El doble E2E de storage solo se activa con `EVIDENCE_E2E_DOUBLES`.**
  - `evidenceStorageMemoryForE2E`, que firma la lectura de rutas bien formadas, solo lo importa
    `lib/composition/index.ts`, dentro de `selectedEvidenceStorage()`, que consulta
    `evidenceE2EDoublesEnabled()` en cada llamada.
  - `guard-dobles-e2e` vigila el módulo `evidence-storage-memory` entero, con sus dos exportaciones, y
    está en verde.
  - La instancia por defecto (`evidenceStorageMemory`) sigue negándose a firmar lo que no firmó. La
    E2E sigue negándose a descargar y a borrar. Las dos cosas tienen test.
- [x] **Sin dependencias nuevas.**
- [x] **Aislamiento por companyId de la URL firmada.** Ver el punto 5.

## Hallazgos

### BLOQUEANTES
Ninguno.

### Menores
1. **menor:** `specs/QC-271-consulta-de-evidencia-por-paso/requirements.md` tiene un bloque
   duplicado y corrupto entre las líneas 190 y 363. Contiene:
   - un encabezado roto, «## Decisiones cerradas (no reabrir)` por su»;
   - el glosario, R1–R30 y la tabla de cobertura, repetidos;
   - un segundo `## Preguntas abiertas` que presenta P1/P2 como abiertas, contra la línea 188 y la
     tabla de decisiones.

   El código no cambia. Conviene borrar ese bloque para que el spec tenga una sola versión de cada
   requisito.
2. **menor:** en `guard-dobles-e2e.test.ts`, la fila `EVIDENCE_E2E_DOUBLES` sigue citando solo
   `QC-214 design.md > 4.2` y tiene `ejemplo: 'evidenceStorageMemory'`. La guardia cubre la nueva
   `evidenceStorageMemoryForE2E` porque vigila el módulo, no el nombre. Aun así, su caso de
   sensibilidad no ejercita el nombre que de verdad elige la composición, y la fila no menciona que
   el doble ahora firma rutas sembradas desde otro proceso (decisión del leader del 2026-10-14). No
   deja ningún agujero, pero sí trazabilidad incompleta en la guardia.
3. **menor (pendiente, no defecto):** sigue abierta la comprobación visual humana contra
   `RecorridoEvidencia*.dc.html` y `ProductoTerminadoEvidencia*.dc.html`, en escritorio, tablet y
   teléfono, tal como recoge `progress/features/QC-271.md`. Hay que hacerla antes de pedir el merge.

## Veredicto

**OK**
