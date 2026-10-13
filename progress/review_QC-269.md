# QC-269 — Revisión (vuelta 1)

Diff revisado: `origin/dev...HEAD` (rama `feature/QC-269-layout-operario`, HEAD `77798474`).
MCP del grafo no usado: el diff es de clases y un `data-testid`; impacto medido con Read/Grep.

## Verificación ejecutable (corrida por el reviewer)

- `pnpm run typecheck`: exit 0.
- `pnpm exec eslint "app/(private)/asignacion" tests/unit/asignaciones-ui e2e/operario-rediseno.spec.ts`: sin problemas.
- `pnpm exec vitest related --run` sobre los 7 archivos de producción: 47 archivos, 725 tests, verde.
- `pnpm exec vitest run guard tests/unit/recetas-ui/recipe-route-contract.test.ts`: 75 archivos, 1045 pasados / 20 saltados, verde.
- No repetido: `./init.sh --completo` (lo corre el leader) ni el E2E (lo corre el CI; la bitácora trae la salida local en Chromium y WebKit, 20/20).

## Checklist

### CHECKPOINTS.md
- [x] `requirements.md` con R1–R10 en EARS.
- [x] `design.md` con alternativas descartadas (§ 2.2, § 3.2, § 6 A/B/C).
- [ ] **Todas las tasks `[x]`**: faltan T3b y T3c (ver H2).
- [x] `design.md` abre con `## Lo que ya existe`; el diff no re-crea nada de esa lista (`StepReader` y `DataTable` sin tocar; `git diff --stat` no muestra `components/shared/`).
- [x] Assignee y rama por candado (`progress/features/QC-269.md`).
- [x] Cada R mapea a test concreto (tabla abajo); mapa en `progress/impl_QC-269.md`.
- [x] Typecheck y lint verdes.
- [ ] `gate-completo` en CI: pendiente (PR no abierto).
- [x] Flujo crítico: no toca ninguno (solo maquetación); igualmente hay E2E de Playwright.
- [x] Sin dependencias nuevas (`package.json` no cambia).
- [x] Sin secretos ni configuración hardcodeada.
- [ ] Cierre de `progress/features/QC-269.md`: pendiente (fase del leader).

### docs/checkpoints-proyecto.md
- [x] E2E de Playwright.
- [x] Multiplataforma: sin `100vh`, sin `:hover` como única vía, objetivos táctiles sin cambio, `env(safe-area-inset-bottom)` respetado.
- [x] Catálogo: `Card` se reutiliza con `className` (paso 1); `OrderExecutionToolsPanel` es pieza de ruta, gana prop opcional (paso 2), no requiere fila.
- [x] Pase `/design`: no hay componente nuevo; el design.md cita los tableros aprobados de QC-265 y justifica la fila en dos líneas por P2 (aprobado por defecto).
- [x] Datos, permisos, hexagonal, migraciones: no aplica (sin cambios de datos ni de capas).

### docs/perfil-agentes.md > reviewer
- [x] 5. Calidad y seguridad: n/a.
- [x] 6. Multiplataforma: ok.
- [x] 7. Dependencias: ninguna.
- [x] 8. Aislamiento por empresa: no toca esquema ni consultas (el fixture E2E siembra por `companyId`).
- [ ] **9. Comentarios**: un comentario nuevo de producción cita `QC-269 R9, R10` (H1).
- [x] 10. Duplicados: ninguno.
- [x] 11. Diseño: ok (ver arriba).

## Trazabilidad R → test (verificada leyendo cada test)

| R | Test | Juicio |
|---|---|---|
| R1, R2 | E2E `R1, R2, R3 — «Entrar» alineado…` (bordes derechos a 1440, ±1 px); unit `assigned-order-enter-trigger.test.tsx` `R1, R2, R3 (QC-269)` | Real. La bitácora prueba que muerde (111,56 px con el código viejo). |
| R3 | mismo E2E a 390 (bordes izquierdos en tarjetas) | Real. |
| R4 | E2E `R4, R6, R9, R10 — panel…` (última línea y borde del panel ≤ borde superior del pie, a 1440 y 390); unit `order-execution-screen.test.tsx` (Card con la constante + igualdad de `calc`) | Real; muerde (843,5 > 790). |
| R5 | E2E `R5 — paso largo` | Real como guarda de regresión; pasa también con el código viejo, como anticipa el design (lo cubre la reserva interna de `StepReader`, que no cambia). |
| R6 | E2E `R4, R6…` (`scrollHeight === clientHeight`, `overflow-y` no `auto/scroll`, pie pegado al borde inferior) | Real. |
| R7 | unit `packing-order-screen.test.tsx` (Card con la constante con pasos) + igualdad de `calc` en `order-execution-screen.test.tsx` | Real, unit por P3 (aprobado). |
| R8 | unit `operator-screen-frame.test.tsx` (prefijo `@min-[1101px]:`) + `packing-order-screen.test.tsx` (sin pasos no la lleva) | Real según el spec. |
| R9 | E2E (cajas del nombre, y del texto vía `Range`, no cortan a porcentaje ni cantidad, 24 filas × 2 anchos); unit `order-execution-lines.test.tsx` | Real; muerde. |
| R10 | E2E (ancho del nombre ≥ min(192, fila) − 1); unit (grupo de cifras hermano del nombre, orden de lectura) | Real; ver H4 (menor). |

## Juicio de las 4 desviaciones de la bitácora

1. **Igualdad del `calc` movida a `order-execution-screen.test.tsx`: ACEPTADA.** Comprobado en
   `tests/unit/recetas-ui/recipe-route-contract.test.ts:1293-1300,1435-1452`: `TESTS_QUE_LO_NOMBRAN`
   es lista cerrada y `order-execution-screen.test.tsx` ya está; el test pinta el `StepReader` real en
   `mode="ejecucion"` y compara el `pb-[calc(…)]` del `<section>` con el `mb-[calc(…)]` de la
   constante. Cumple el objetivo de § 4.2 sin tocar el guardia. Deja un comentario de producción
   desactualizado (H3).
2. **R6 medido como «sin scroll propio»: ACEPTADA.** `components/ui/card.tsx:15` lleva
   `overflow-hidden`, así que `overflow-y: visible` del design no podía cumplirse nunca.
   `scrollHeight === clientHeight` más «no es `auto`/`scroll`» prueba exactamente lo que R6 pide
   (sin desplazamiento propio, nada recortado).
3. **Desplazar y medir en una sola `evaluate` con `toPass` de 30 s: ACEPTADA.** Todas las
   condiciones (página al final, pie pegado, elementos sobre el pie) se exigen en la misma pasada,
   así que el reintento no debilita la aserción: solo espera a que la hidratación deje de mover la
   página. Presupuesto: dentro del `actionTimeout` y del job de 60 min.
4. **Literal `'order-execution-line-name'` en el E2E: ACEPTADA.** Coherente con el resto de
   `TESTIDS` del spec (todos literales) y el unit fija `ORDER_EXECUTION_LINE_NAME_TESTID ===
   'order-execution-line-name'`, así que la deriva la detecta Vitest. Nota menor en H5 sobre el
   comentario que lo justifica.

## Hallazgos

### H1 — BLOQUEANTE: comentario de producción que cita ficha y requisitos
`app/(private)/asignacion/[id]/components/order-execution-lines.tsx` (línea añadida en el diff):

```tsx
{/* Base de 12 rem: el nombre manda y, si no cabe con las cifras, las cifras bajan enteras
    a la linea siguiente (QC-269 R9, R10). */}
```

`docs/conventions.md > Comentarios`: «Nunca se cita una ficha ni un requisito en un comentario de
producción … Sin excepciones». `docs/perfil-agentes.md > reviewer` punto 9: BLOQUEANTE. Falta:
quitar `(QC-269 R9, R10)` (el porqué puede quedarse).

### H2 — BLOQUEANTE (de cierre, lo resuelve el leader): T3b y T3c sin marcar
`tasks.md` tiene T3b y T3c en `[ ]`. El leader indica que P1 ya tiene ficha (QC-270), pero el
*Hecho* de T3b exige la key citada en `progress/features/QC-269.md`, y ahí no aparece `QC-270`
(grep en `progress/` y `specs/` sin resultados). T3c depende del `./init.sh --completo` en curso.
Falta: citar QC-270 en `progress/features/QC-269.md > Decisiones` o `Cierre`, marcar T3b `[x]`, y
T3c `[x]` cuando el gate completo termine en verde. No hace falta otra vuelta del implementer.

### H3 — menor: comentario de producción con la referencia equivocada
`app/(private)/asignacion/components/operator-screen-frame.tsx`, JSDoc de
`STEP_READER_SIDE_COLUMN_RESERVE`: «lo vigila operator-screen-frame.test». Tras la desviación 1
la igualdad la vigila `order-execution-screen.test.tsx`. Un comentario con un motivo equivocado va
contra `docs/conventions.md > Comentarios`. Conviene corregirlo en el mismo cambio que H1.

### H4 — menor: R10 no comprueba «todo el ancho de la fila» cuando las cifras bajan
El E2E exige nombre ≥ min(192, fila) − 1, que es lo que fija `design.md § 7`, pero R10 dice
además que el nombre ocupa todo el ancho cuando las cifras pasan a la línea siguiente. Con la
regla `flex-[1_1_12rem]` se cumple (el nombre crece), pero ningún test lo afirma. No bloquea
porque el test sigue el diseño aprobado.

### H5 — menor: motivo del literal en el E2E distinto en código y bitácora
`e2e/operario-rediseno.spec.ts` dice «Literal y no la constante … el archivo es de cliente»; la
bitácora da como motivo la prueba de mordida. Ninguno está verificado como imposibilidad; basta con
un motivo, el verdadero.

## Veredicto

**RECHAZADO (CAMBIOS)** por H1 (implementer: una línea de comentario; aprovechar para H3) y H2
(leader: citar QC-270, marcar T3b/T3c). El resto del trabajo está bien: los tres arreglos siguen
el diseño, los tests muerden y las cuatro desviaciones están justificadas.
