# QC-290 — empaque-con-excedente · review

Revisado: rama `feature/QC-290-empaque-con-excedente` (HEAD `5da50893`), diff `origin/dev...HEAD`
(49 archivos), frente a `specs/QC-290-empaque-con-excedente/` (R1–R29), `CHECKPOINTS.md`,
`docs/checkpoints-proyecto.md` y `docs/perfil-agentes.md > reviewer`.
Grafo (MCP) no consultado: Grep/Read sobre el worktree.

## Verificación ejecutada por el reviewer

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | verde, sin salida |
| `pnpm run lint` | `✖ 10 problems (0 errors, 10 warnings)`, ninguno en archivos del diff |
| `pnpm exec vitest run` de los 14 unit tocados + R18 (`get-conditioning-order`, `conditioning-batch-data`) | `Test Files 14 passed (14)`, `Tests 619 passed (619)` |
| `pnpm exec vitest run guard` | `Test Files 84 passed (84)`, `Tests 1148 passed \| 21 skipped` |
| `.int` afectados (`order-packed-counts`, `finish-with-finished-goods`, `order-delivery`, `direct-delivery-repository`) con el `.env` del repo principal, base efímera de la plantilla | `Test Files 4 passed (4)`, `Tests 82 passed (82)` |
| Títulos del mapa T9 → `grep -F` en `tests/` y `e2e/` | los 32 títulos citados existen |
| `git merge-tree HEAD origin/dev` | 2 conflictos (ver menor m4) |

No se corrió `./init.sh` ni la suite completa ni el E2E (los corre CI).

## Checklist

### Reviewer (puntos 1–4)
- [x] **Trazabilidad**: R1–R29 tienen test concreto en `progress/impl_QC-290.md > T9`. Revisé el
  cuerpo de los de R6/R7 (`packing-count.test.ts`: P3, empate de contenido en los dos órdenes,
  unidades mezcladas, resto bajo un envase), R20/R22 (diálogo, aviso único, `role=status`, tono
  info, comparado con `packingSurplusByLine`) y R29 (E2E con BD: libres guardados, lotes 7 + 5,
  coste sobre 12, «Faltan 5», excedente sin pedido 2). Ninguno vacío.
  R25 y R18 se cubren con tests previos sin tocar (aceptable: el requisito es «sin cambios»).
  R28 sin test propio: `package.json`, `pnpm-lock.yaml` y `docs/dependencias.md` sin cambios.
- [x] **Tasks**: T0–T9 en `[x]`.
- [x] **Lo que ya existe**: `design.md` abre con la sección, rellena; el diff no re-crea nada
  (`compareDecimals` no existía; `maxPackagesForLine` se borra; `Notice` se reutiliza).
- [x] **Verificación ejecutable**: ver tabla.

### CHECKPOINTS.md
- [x] requirements EARS R1–R29; design con 5 alternativas descartadas (A1–A5); tasks todas `[x]`.
- [x] Assignee en Jira (`progress/features/QC-290.md`).
- [x] Mapa `R<n> → test` en `progress/impl_QC-290.md`.
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` en CI: pendiente del PR (fuera del alcance del reviewer).
- [x] Flujo crítico (movimientos de inventario, importes): E2E de Playwright ampliado.
- [x] Sin dependencias nuevas.
- [x] Sin secretos, sin webhooks, nada de configuración hardcodeado.
- [ ] `./init.sh` verde: por decisión del humano (2026-10-20) lo cubre CI; solo la tanda 1 lo
  corrió en local. Lo anoto, no lo bloqueo.

### docs/checkpoints-proyecto.md
- [x] UI multiplataforma: solo se añade un `Notice` (sin inputs, sin hover, sin `100vh`); el botón
  de cerrar no se usa.
- [x] Catálogo: no hay pieza nueva, subida, extendida ni borrada en `components/shared`/`ui`.
- [x] Cambio visual del diálogo con pase `/design` aprobado y citado en `design.md > UI` (tableros
  `EmpaqueTerminar*.dc.html`, estado `excedente`).
- [x] Sin tabla nueva: la columna va en `order_presentation_lines` (ya con `company_id`, RLS y
  FORCE). Las consultas tocadas siguen filtrando por `company_id`.
- [x] Permiso validado en el caso de uso (`finish-packing.ts`, sin cambios) con test (R27).
- [x] Acceso a datos solo por adaptadores Prisma `driven`.
- [x] Migración versionada con `down.sql` exacto; el implementer hizo up → down → up sobre una
  copia de la plantilla; test de esquema verde.
- [x] Hexagonal: `domain/` sin imports de framework ni BD; `app/` importa del barrel
  `@/lib/modules/pedidos`.

### Puntos 5–11 del perfil
- [x] 5 Calidad y seguridad: sin tabla nueva, sin hardcode, capas separadas.
- [x] 6 Multiplataforma: sin hallazgos.
- [x] 7 Dependencias: `package.json` intacto.
- [x] 8 Aislamiento por empresa: sin modelo nuevo; lecturas y `UPDATE` con `company_id`.
- [x] 9 Comentarios: ningún comentario añadido en `lib/`, `app/` ni `db/` cita `QC-`, `R<n>`,
  `design.md` ni «decisión cerrada» (grep sobre las líneas `+`).
- [x] 10 Duplicados: no hay componente nuevo.
- [x] 11 Diseño: referencia en `design.md`.

## Desviaciones declaradas, valoradas

1. **Migración `20261020160000_*` a mano.** Aceptada. `progress/deudas.md > D3` prohíbe
   `db:migrate:create` sobre la Postgres compartida («crear la carpeta a mano y `migrate deploy`»).
   El SQL coincide con `design.md §1.2`, el instante es posterior a la última de `dev`
   (`20261020120000_*`) y la plantilla confirma esquema al día con `schema.prisma`.
2. **`order-packing.ts` tocado en T3 y fixture de `list-execution-traces.test.ts`.** Aceptadas.
   `order-packing.ts` está en `tasks.md > Archivos esperados` (era de T4; T3 lo necesitaba para
   compilar). El fixture solo añade `packedSurplusPackages: 0` para compilar.
3. **`guard-identificador-de-request.test.ts` registra la migración.** Aceptada: la guardia exige
   registrar toda migración nueva. Choca con `dev` al integrar (m4).
4. **Orden de los libres en el aviso (orden del reparto, no por contenido).** Ver m1. R20 no fija
   el orden de la lista y R22 exige que coincidan los números, que coinciden (misma función que el
   servidor). Pero el tablero aprobado (`EmpaqueTerminar.dc.html`, estado `excedente`) arma la
   lista ordenada por contenido de mayor a menor (`.sort((a, b) => b.l.vol - a.l.vol)` y
   `free.push` en ese orden). Coinciden en el estado aprobado (Galón antes que Botella, que es
   también el orden del reparto), divergen si una línea de menor contenido va antes en el reparto.
   No incumple ningún R; es una diferencia de paridad con el tablero → menor.
5. **E2E 4/4 en chromium y webkit por separado; corrida conjunta caída en login.** Aceptada como
   menor (m3): los 4 rojos de chromium son el mismo `waitForURL` del login en
   `e2e/helpers/landing.ts` en arranque en frío, incluidos los 3 casos previos sin tocar; encaja con
   D4/D5 (saturación). La segunda corrida de chromium sola fue 4/4.

## Hallazgos

### BLOQUEANTES

Ninguno.

### menores

- **m1 — Paridad con el tablero en el orden de la lista de libres.** `packing-finish-dialog.tsx`
  (`describeLines`, `free = finish.lines.flatMap(...)`) lista en el orden del reparto; el tablero
  aprobado lo hace por contenido de mayor a menor, el mismo orden en que se reparten los libres
  (R7). Para alinearlo basta con ordenar `free` por el orden en que `packingSurplusByLine` asigna
  (o exponer ese orden) y un caso de test con la línea pequeña primero. También se puede aceptar
  tal cual: decide el humano.
- **m2 — Formato del excedente en el aviso.** El texto sale de `formatDecimalDisplay`, igual que el
  total del pie; en jsdom da «5.48 L» y el tablero muestra «5,48 L». Es el comportamiento ya
  existente del pie, no algo que traiga esta feature; queda anotado por paridad.
- **m3 — E2E sin corrida conjunta verde en local.** Ver desviación 5. Que CI (PR a producción) lo
  confirme.
- **m4 — La rama va 45 commits por detrás de `origin/dev` y choca al integrar.**
  `git merge-tree` da conflicto en `tests/unit/errores/catalogo.test.ts` (recuento de códigos:
  `dev` añadió códigos y esta rama retira uno) y en
  `tests/guards/guard-identificador-de-request.test.ts` (`MIGRACIONES_ESPERADAS`). Hay que
  actualizar con `dev` y recontar antes del PR; `progress/features/QC-290.md` ya lo preveía.
- **m5 — `tasks.md > T9 Hecho` pide `./init.sh` verde** y no se corrió en local por decisión del
  humano (CI lo cubre). Coherente con la decisión, pero `gate-completo` tiene que salir verde en
  el PR antes del merge.

## Veredicto

**OK**: ningún bloqueante. Los menores m1–m5 no impiden avanzar; m4 se resuelve al actualizar con
`dev` antes de abrir el PR.
