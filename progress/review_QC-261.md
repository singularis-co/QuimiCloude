# QC-261 — Review

## Vuelta 1 (origin/dev...e514583c)

Revisado contra `specs/QC-261-rediseno-dashboard/`, `progress/impl_QC-261.md`, `progress/features/QC-261.md`
(decisiones del 2026-10-12), `CHECKPOINTS.md`, `docs/checkpoints-proyecto.md`,
`docs/perfil-agentes.md > reviewer` y `components/shared/CATALOGO.md`.

### Verificación ejecutada por el reviewer

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | 0 errores, 7 avisos previos en archivos ajenos |
| `vitest run tests/ui/dashboard tests/unit/navegacion tests/unit/shared-ui/empty-state.test.tsx tests/unit/marca/tablas-marca.test.tsx tests/unit/paridad tests/unit/dashboard-page.test.tsx tests/unit/dashboard tests/unit/dashboard-route-contract.test.ts` | 42 archivos, 737 pasados, 3 omitidos |
| `vitest run guard` | 74 archivos, 1005 pasados, 19 omitidos |
| `playwright test e2e/dashboard-rediseno.spec.ts e2e/recorrido-ejecucion.spec.ts` | 20 pasados (chromium y webkit) |
| Snapshots de paridad ajenos (10 archivos) | 46 líneas = 23 pares; en todas cambia solo `md:text-sm` por `md:text-base` |

No hay `.int` afectados: el diff no toca `lib/` ni `db/`.

### Checklist

- [x] `requirements.md` en EARS, R1–R24 numerados.
- [x] `design.md` abre con `## Lo que ya existe` y tiene alternativas descartadas (A1–A6). El diff no vuelve a crear nada de lo listado: reutiliza `PageShell`, `PageHeader`, `StatusBadge`, `ArrowLink`, `actionsColumn({ menu })`, `card`, `ErrorState`, `Avatar` y `avatarTone`.
- [x] `tasks.md`: T1–T9 marcadas `[x]`.
- [x] El diff no sale de `## Archivos esperados`. Fuera de esa lista solo están `specs/` y `progress/`, que son del proceso.
- [ ] Trazabilidad: R1–R22 y R24 tienen tests que asertan de verdad lo que piden. **R23 no** (ver M2).
- [x] Mapa `R<n> -> test` en `progress/impl_QC-261.md`.
- [x] Typecheck y lint sin errores.
- [x] Sin dependencias nuevas; `package.json` sin cambios. R22 lo verifica una guardia.
- [x] Sin secretos ni configuración hardcodeada; sin webhooks, tablas, RLS ni migraciones.
- [x] Multiplataforma:
  - objetivos de 44 px (disparador, «Acciones», `ArrowLink touch`, casilla) e ítem del menú de 48 px;
  - buscador a 16 px en los tres anchos;
  - realce solo con `hover:`; sin `100vh`;
  - lo verifica el E2E en webkit.
- [x] Catálogo:
  - la fila de `EmptyState` lleva los puntos de extensión y `NoEncontrada.dc.html` en `Diseño`;
  - `DataTable` ya citaba `Tabla.dc.html`;
  - `ExecutionTimeline` es una pieza interna de la ruta (paso 4, justificado en `design.md`).
- [x] Permisos: `requirePagePermission` sigue en la primera línea, y el 404 se conserva (E2E de R18 en verde).
- [ ] Comentarios (punto 9): hay una cita de un `R<n>` en una línea añadida en producción (ver M1).
- [ ] `./init.sh` del worktree: no lo he corrido entero. Corrí sus piezas: typecheck, lint, tests relacionados y guardias.

### Desvíos decididos por el leader: comprobados

- (a) `FIELD_TEXT = 'text-base md:text-base'` está bien hecho. `input.tsx` queda intacto y los 10 snapshots cambian solo esa clase. El comentario que lo acompaña es el hallazgo M1.
- (b) `app/globals.css` sin tocar. La animación va en línea, con `motion-safe:animate-[screen-enter_var(--dur-slow)_var(--ease-enter)_both]` y el retardo en `style`. `guard-movimiento` está en verde, y el E2E comprueba el estilo computado: el retardo es índice × 40 ms, hay 1 iteración y, con movimiento reducido, `none`, `transform: none` y `opacity: 1`.
- (c) Los tonos `waiting`, `success` y `danger` usan `warning-*`, `success-*` y `destructive-*`. Los tonos `neutral` y `progress` usan `status-*`. Todos los tokens existen en `app/globals.css`.
- (d) `waitForAnimationsToSettle` espera solo a que no queden animaciones `running` antes de medir. El umbral de 48 px queda intacto y no se relaja ninguna aserción.

### Hallazgos

**Mayores (bloquean)**

- **M1 (BLOQUEANTE, punto 9 de `docs/perfil-agentes.md > reviewer`).** `components/shared/data-table/data-table-filters.tsx:37`: un comentario añadido en producción cita un requisito:
  `/** 16 px en TODOS los anchos: el primitivo baja a 14 px en \`md\`, y R20 no distingue por ancho. */`.
  Arreglo: dejar solo el motivo, sin `R20`. Por ejemplo: «16 px en todos los anchos: el primitivo baja a 14 px en `md` y los campos deben tener 16 px para que iOS no haga zoom.»
- **M2 (BLOQUEANTE, trazabilidad, R23).** Dos problemas:
  - R23 exige que «toda pieza nueva … viva en la carpeta `components/` de su ruta, **exportada por su barrel**». `ExecutionTimeline` no está en `app/(private)/dashboard/recorrido/[id]/components/index.ts`.
  - El mapa atribuye R23 a `guard-catalogo-de-componentes` y a `guard-qc261-limites-de-la-ficha`. Ninguna de las dos lo comprueba: la segunda no tiene ningún caso R23 (solo R22, R7 y R18).

  `design.md > 3.3` dice «`ExecutionTimeline` es interno», lo que contradice R23. Hay que elegir una de dos salidas:
  - exportarla por el barrel y añadir un caso que lo verifique (que exista en la ruta y la reexporte el `index.ts`);
  - o que el leader enmiende R23 para que diga lo mismo que `design.md`, y entonces basta un caso que compruebe dónde vive.

**Menores**

- **m1.** `app/(private)/not-found.tsx:5-15`: la limpieza del docblock de QC-75 va mezclada con el cambio de código en el commit 801a926e (punto 9, menor). Además se pierde un motivo no obvio que no recoge ningún otro sitio: «nunca se llama a `notFound()` desde `app/(private)/layout.tsx`, porque el 404 saldría sin el armazón». Conviene conservar esa línea.
- **m2.** `app/(private)/dashboard/recorrido/[id]/components/execution-trace-detail.tsx:52-60, 90, 93`: vuelve a pintar «Dado de baja», «En curso» y la cifra de vueltas atrás con `StatusBadge` en línea, en vez de reutilizar `DeletedOrderMark` y `ActiveOrderMark`, que ya exporta el barrel del dashboard. La bitácora ya lo señala. Además, el «0» del detalle no lleva `font-mono` y el de la lista sí, así que divergen.

**Notas**

- **n1.** `design.md > 3.3` sigue diciendo que los colores salen de `--status-<tono>-*`. El desvío (c) está en la bitácora, pero no en el diseño. Basta una línea de enmienda.
- **n2.** El E2E solo corre en CI en el PR a producción (`docs/gate.md`). Aquí lo corrí yo: 20/20 en verde.
- **n3.** La tabla de cabecera de `progress/features/QC-261.md` sigue marcando `pending` en `estado`.

### Veredicto

**CAMBIOS.** M1 y M2 bloquean. Lo demás está en verde: R1–R22 y R24 tienen tests reales, los cuatro desvíos están bien hechos, typecheck, lint y guardias pasan, y los E2E también.

## Vuelta 2 (acotada a 89b94092..c662c92b)

Revisados solo los arreglos de la vuelta 1: fccee471 (M1, M2, m1, m2) y c662c92b (la ficha).

### Verificación ejecutada

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | 0 errores, los 7 avisos previos en archivos ajenos |
| `vitest run guard tests/ui/dashboard tests/unit/navegacion tests/unit/paridad/recorridos-paridad.test.tsx tests/unit/dashboard-route-contract.test.ts` | 90 archivos, 1238 pasados, 22 omitidos |
| Búsqueda de `QC-<n>`, `R<n>`, `design.md` o «decisión cerrada» en las líneas añadidas en `app/` y `components/` | ninguna |

### Hallazgos de la vuelta 1

- [x] **M1 resuelto.** `components/shared/data-table/data-table-filters.tsx:37`: el comentario ya no cita ningún requisito; ahora da el motivo (iOS hace zoom con menos de 16 px).
- [x] **M2 resuelto.**
  - `app/(private)/dashboard/recorrido/[id]/components/index.ts` reexporta `ExecutionTimeline` y `ExecutionTimelineProps`.
  - `tests/guards/guard-qc261-limites-de-la-ficha.test.ts` tiene ahora un `describe` de R23 que lee el barrel real, comprueba que existen la pieza y el `index.ts`, y analiza el AST.
  - El caso sintético da rojo con un barrel sin la reexportación, con la línea comentada, con un `import` sin reexportar, con un `export type` y con otro módulo de origen. Si se quita la línea real, el barrel cae en el primer de esos casos, así que el caso real se pondría rojo.
  - `design.md > 3.3` queda alineado: el barrel exporta `ExecutionTimeline`, y el texto de los tokens dice `warning-*`, `success-*` y `destructive-*`. Esto cierra también n1.
- [x] **m1 resuelto.** `app/(private)/not-found.tsx:12-13` recupera el aviso de que `notFound()` nunca se llama desde el layout privado, con su motivo.
- [x] **m2 resuelto.** `execution-trace-detail.tsx` reutiliza `DeletedOrderMark` y `ActiveOrderMark` con la misma condición: un pedido dado de baja nunca lleva «En curso». El «0» lleva ahora `font-mono`.
- [x] **n3 resuelto.** c662c92b deja la ficha en `in_progress`.

### Regresiones

Ninguna. El diff no toca nada fuera de lo que arregla, y los tests del detalle y del recorrido siguen en verde con las marcas reutilizadas.

### Veredicto

**OK.**
