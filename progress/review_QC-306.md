# Review — QC-306 pdf-status-panel (F2.2)

Reviewer, 2026-10-21. Diff revisado: `origin/dev..58bc8dec` (lo nuevo va de `a90e4d1a` a HEAD;
`683a7e2e..97070fad` ya estaba en `dev` y se revisó en `progress/review-pdf-status-panel.md`).
El MCP del grafo no se usó: Grep y Read. El diff no toca `lib/` ni `db/`.

## Verificación ejecutada (por el reviewer, no copiada de la bitácora)

```
$ pnpm run typecheck                                    # tsc --noEmit, sin errores
$ pnpm exec eslint <todos los .ts/.tsx del diff>        # sin salida, exit 0
$ pnpm exec vitest run <los 13 tests del diff> tests/guards/guard-catalogo-de-componentes.test.ts
  Test Files  15 passed (15)   Tests  271 passed (271)
$ pnpm exec vitest related --run <archivos de producción de components/ y app/ del diff>
  Test Files  67 passed (67)   Tests  1094 passed | 1 skipped (1095)
$ pnpm exec vitest run guard
  Test Files  85 passed (85)   Tests  1253 passed | 22 skipped (1275)
$ pnpm exec vitest run tests/unit/documentos-ui/batch-memory.test.ts --reporter=verbose
  R19 muestra tras la recarga…  7093ms   (resto de casos: 200-500 ms)
```

- Ningún `.int` afectado: el diff no toca `lib/`, `db/` ni `tests/integration/`.
- Comprobación a mano: ninguna línea de más de 100 columnas y todos con salto de línea final en
  los `.ts`/`.tsx` de producción del diff. En las líneas añadidas de producción no hay ningún
  comentario que cite `QC-`, `R<n>`, `design.md` ni «decisión cerrada».
- No he corrido `./init.sh` ni la suite completa: los corren el leader y CI.

## Checklist

### Especificación (CHECKPOINTS)
- [x] `requirements.md` con R1–R41 en EARS; R18 y R28 retirados con su motivo.
- [x] `design.md` con 8 alternativas descartadas y su porqué.
- [x] `design.md` abre con `## Lo que ya existe`, con términos, hallazgos y catálogo consultado. El
      diff no re-crea nada de esa lista: reutiliza `Collapsible`, `Button`, `Badge`, `StatusBadge`
      y `ArrowLink`, y extiende la pieza.
- [~] `tasks.md`: T0–T14 en `[x]`. En T15 queda sin marcar «Pasar `./init.sh` en verde», que es
      del leader (`AGENTS.md > Quién corre qué`). Ver m1.

### Equipo
- [x] Assignee (Christian Quevedo) y rama `feature/QC-306-pdf-status-panel` (`a90e4d1a`).

### Trazabilidad
- [x] Cada R vigente mapea a al menos un caso con aserciones reales; lo he comprobado leyendo los
      casos, no solo los títulos. Detalle abajo.
- [x] `progress/impl_QC-306.md` lleva el mapa R → test (R24, R25 y R41 en «Tanda 2»).

### Calidad de código
- [x] Typecheck y lint en verde.
- [ ] `gate-completo` en CI: pendiente del PR.
- [x] Flujo crítico: no toca ninguno (autenticación, permisos, inventario, importes, webhooks). No
      hace falta E2E.
- [x] Sin dependencias nuevas: `package.json` no cambia.
- [x] Multiplataforma: botones con `touch` y `text-base`, sin `100vh` (solo el `100dvh` y el
      `100vw` que ya existían), sin `:hover` como única vía y `Collapsible` de Base UI ya catalogado.
- [x] Fila del catálogo al día; su celda `Diseño` cita `docs/diseno/canvas/PanelTandas.dc.html`.
- [x] Pase `/design` aprobado, copiado a `docs/diseno/canvas/PanelTandas*.dc.html`, registrado en
      `canvas.json` y citado en design.md.

### Seguridad, configuración y datos
- [x] Sin secretos ni valores de entorno en el código. `maxAttempts` sigue saliendo de la
      configuración.
- [x] Sin webhooks, tablas, RLS ni migraciones.
- [x] Aislamiento por empresa: no hay consulta nueva y `readBatch` no cambia. `companyId` llega al
      cliente por la decisión P3, que aceptó el humano.

### Módulos hexagonales y permisos
- [x] `page.tsx` usa `identity.getSessionContext()` de `@/lib/composition`, que ya existía. No amplía
      `SessionUser` y la guardia de arquitectura sigue en verde.
- [x] La página valida el permiso en el servidor (`requirePagePermission`, `canUploadDocuments`).

### Reglas del perfil (reviewer 5–11)
- [x] 5 calidad y seguridad · [x] 6 multiplataforma · [x] 7 dependencias · [x] 8 empresa
- [x] 9 comentarios (ninguno bloqueante; ver m6) · [x] 10 duplicados (design.md declara el paso 3
      y la excepción de ubicación, con su consumidor) · [x] 11 diseño

## Trazabilidad R → test (verificada)

| R | Caso que lo prueba de verdad |
|---|---|
| R1–R4 | `batch-status.test.ts`, `get-batch-status.test.ts`, `document-batch-repository-prisma.test.ts`: renombrados, sin cambios en las aserciones |
| R5–R14, R16 | `document-batch-panel.test.tsx` (con `registryScope`); R5 y R10 también en `formula-pdf-upload.test.tsx` |
| R15 | `document-batch-panel.test.tsx`: `renderToString` da `''`, y `hydrateRoot` termina sin `onRecoverableError` ni `console.error` |
| R17 | `formulas-upload.test.tsx`: el panel es hermano de `page-header` y va después, fuera de `page-header-actions`; `formula-pdf-upload.test.tsx`: la ventana sola no monta el panel |
| R19–R23, R26, R27, R29–R31 | `batch-memory.test.ts`, con `vi.resetModules()` y `localStorage` precargado, corrupto, de forma antigua, y con `getItem`/`setItem` que lanzan |
| R24, R25 | `batch-status-store.test.tsx`: cuenta llamadas con temporizadores falsos; remontar no hace ninguna llamada; tras `resetModules`, una llamada y `getTimerCount() === 0` |
| R32–R35, R40, R41 | `labels.test.ts` (textos exactos con un `now` fijo) y los casos del panel: nombres únicos por rol, solo lectura sin `input[type=file]`, contador y resumen también con el panel plegado |
| R36–R38 | `document-upload-convenciones.test.ts`, con un caso que demuestra que el detector salta con 101 columnas |
| R39 | `document-batch-panel.test.tsx`: `aria-expanded` y la visibilidad de la lista al plegar y desplegar |

## Hallazgos 3 a 10 de la revisión anterior

| # | Estado | Evidencia |
|---|---|---|
| 3 | **Cerrado** | `batch-memory.test.ts` recarga el módulo con `localStorage` precargado, corrupto, de forma antigua y con lectura o escritura que lanzan |
| 4 | **Cerrado** | `batch-status-store.ts`: un bucle por `batchId`, nunca dos consultas en vuelo; las tandas terminadas o desaparecidas no se reconsultan en la misma carga |
| 5 | **Cerrado** | La clave lleva `:<userId>:<companyId>`, y la global antigua se borra (R26, R27, R29) |
| 6 | **Cerrado** | Escucha el evento `storage` filtrado por clave y lee, fusiona y escribe (R30, R31) |
| 7 | **Cerrado** | `attemptLabel` acota con `Math.min(Math.max(1, a), M)` |
| 8 | **Cerrado** | Rótulo por tanda con fecha y hora, `aria-labelledby` en el `<li>` y `aria-label` único en «Descartar» y «Reanudar» |
| 9 | **Cerrado** | Decidido en P2 y R35: con `disabled`, solo lectura con su aviso |
| 10 | **Cerrado** | Salto de línea final, ≤ 100 columnas y el punto añadido en la fila del catálogo; lo prueba un caso del test de convenciones |

## Desviaciones del implementer que pidió evaluar el leader

1. **`resetBatchStatusStore()` en `document-batch-panel.test.tsx`, `formula-pdf-upload.test.tsx` y
   `formulas-upload.test.tsx` (`fe1a110b`): ACEPTABLE.**
   - Los tres archivos son de esta feature y no están congelados por el diseño. La fuga venía de
     reutilizar `'batch-1'` entre casos, y es justo lo que pide R25.
   - El diff solo añade el import y una línea en el `beforeEach` que ya existía: ningún `it`,
     título ni aserción cambia.
   - Falta registrarlo en el spec: design 2.4 y la decisión de `progress/features/QC-306.md` siguen
     diciendo «esos dos archivos». Ver m2.
2. **`getSessionContext` en el doble de `identity` de `recipe-page.test.tsx` y
   `recetas-paridad.test.tsx`: ACEPTABLE.**
   - Esos tests montan la página de fórmulas, que ahora llama a `identity.getSessionContext()`.
     Sin el doble fallan con «is not a function».
   - El doble devuelve `null`, así que el panel no se monta y lo que comprueban esos tests no
     cambia. design.md (Riesgos) ya lo preveía.
3. **R19 de `batch-memory.test.ts` puede ser inestable: SÍ, y la causa es conocida.** Ver m3.

## Hallazgos

**Ningún BLOQUEANTE.**

- **m1 — menor (tasks).** En T15 queda `[ ]` «Pasar `./init.sh` en verde». Es del leader
  (`AGENTS.md > Quién corre qué`) y está bien que el implementer no lo marcase. El leader debe
  marcarlo, con la salida, antes del PR.
- **m2 — menor (documentación de la excepción de R25).** La excepción del humano nombra dos archivos
  (design 2.4, tasks T8 y `progress/features/QC-306.md > Decisiones`). El código la aplica en cinco.
  Basta con añadir una línea en design 2.4 y en `features/QC-306.md` con los otros tres, que son
  tests propios de la ficha, y el motivo. No hace falta otra decisión humana: solo cambia la
  preparación de tests de esta ficha.
- **m3 — menor, pero conviene arreglarlo antes del PR (test con riesgo de timeout).**
  - **Síntoma.** «R19 muestra tras la recarga…» es el primer caso del archivo y tarda unos 7 s
    corrido solo, frente a 0,2–0,5 s del resto. Con la máquina cargada llegó a 20 030 ms, por
    encima del `testTimeout: 20_000`.
  - **Causa.** El primer `import()` tras `vi.resetModules()` transforma en frío, dentro del tiempo
    del caso, el barrel `@/lib/modules/documentos`, del que `batch-memory.ts` importa
    `pdfStrategySchema`.
  - **Riesgo.** Con los shards de CI cargados puede salir rojo de forma intermitente en
    `gate-completo`.
  - **Arreglo posible.** Calentar el import en un `beforeAll`, que cuenta contra `hookTimeout`, o
    importar el esquema desde una ruta más ligera.
  - **Lo que no es.** No es un fallo de la lógica: los 15 casos pasan.
- **m4 — menor (R30 se prueba en el módulo, no en el panel).**
  - El plan de pruebas (design 5) dice «un `StorageEvent` sintético actualiza el panel». El caso
    comprueba el oyente y `rememberedBatches`, pero no el DOM del panel.
  - La cadena hasta el panel es directa (`useSyncExternalStore` sobre `onRememberedBatchesChange`),
    así que el riesgo es bajo. Un caso de render cerraría el hueco.
- **m5 — menor (UX, decisión de implementación).**
  - `now` se fija al montar la tanda (`useState(Date.now)`): con la página abierta pasada la
    medianoche, «hoy» sigue diciendo «hoy» hasta remontar. Lo anota la bitácora.
  - La píldora de estado por tanda del tablero no se pintó. El spec no la pide y design.md dice que
    manda el spec, así que no es hallazgo de diseño. Conviene que el humano lo sepa al ver la
    pantalla.
- **m6 — menor (robustez heredada, no es regresión).**
  - **Qué pasa.** Si `getBatchStatusAction` rechaza (una excepción de red de la Server Action, no un
    `ErrorState`), `query()` deja la entrada sin error publicado y sin temporizador. El sondeo se
    para sin mostrar «Reanudar».
  - **Por qué no es regresión.** El `useBatchStatus` anterior hacía lo mismo, porque `consultar()`
    no tenía `catch`.
  - **Qué hacer.** No se corrige en esta ficha; queda para una del board si se quiere.

## Veredicto

**OK.** No hay bloqueantes. Se cumplen la trazabilidad R1–R41 (sin las retiradas R18 y R28), los
checkpoints del arnés y del proyecto y las reglas 5–11 del perfil. Los hallazgos 3 a 10 de la
revisión anterior están cerrados.

Antes de cerrar la feature quedan cosas que no le tocan al reviewer: el leader marca T15 con
`./init.sh` y `gate-completo` tiene que estar en verde en el PR. Recomiendo resolver m2 y m3 antes
de abrir el PR.
