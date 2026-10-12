# QC-252 — Componentización de /asignacion · review

## Vuelta 1 (completa, origin/dev..9223d3fc)

Revisado contra `specs/QC-252-componentizacion-asignacion/{requirements,design,tasks}.md`,
`progress/impl_QC-252-componentizacion-asignacion.md`, `docs/architecture.md`, `docs/conventions.md`,
`docs/perfil-agentes.md > reviewer`, `CHECKPOINTS.md` y `docs/checkpoints-proyecto.md`.
El grafo no hizo falta: el diff es acotado y lo leí entero con git/Grep.

### Verificación ejecutable (corrida por el reviewer en el worktree)

| Comando | Resultado |
| --- | --- |
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | exit 0; 0 errores y 7 warnings, todos en archivos que esta ficha no toca (`confirm-catalog-import.test.ts`, `order-service.test.ts`) |
| `vitest run tests/guards tests/unit/paridad tests/unit/asignaciones-ui tests/unit/shared-ui tests/unit/shared` + `order-responsibles` + `order-route-contract` | 190 archivos, 2523 pasan y 14 se saltan; ningún rojo y ningún snapshot obsoleto ni escrito |
| `vitest related --run` sobre los 30 archivos de producción tocados | 215 archivos, 3460 pasan y 1 se salta |
| `git diff f06556ab HEAD -- …acondicionamiento-paridad.test.tsx.snap` | vacío: el snapshot congelado en T0a no cambió |
| `git diff origin/dev...HEAD -- e2e/` | solo líneas `import` en `datos-de-lote-en-acondicionamiento.spec.ts` |

No corrí `.int`: el diff no toca `lib/modules/`, ni la base de datos, ni las acciones.

### Checklist

**Especificación y tasks**
- [x] requirements EARS R1–R25; design con alternativas descartadas (A1–A7); tasks 122/122 `[x]`.
- [x] `design.md > ## Lo que ya existe` está presente y completa. El diff no vuelve a crear nada de esa
      lista: reutiliza `AssignmentListEmpty`/`AssignmentListSkeleton`/`MissingValue`, `ORDER_STATUS_LABELS`,
      `ErrorAlert`, `touchTarget` y `ConfirmDialog`.
- [x] P1–P6 están en `requirements.md > Decisiones cerradas`.

**Paridad (R24/R25)**
- [x] T0a (`f06556ab`) solo toca la paridad y su `.snap`, y va antes del primer commit de producción
      (`1ed35a59`). Después, el `.snap` de acondicionamiento no cambió. El test solo cambió los import
      y el render de los avisos a `OrderOutcomeNotice`.
- [x] Las diferencias de snapshot son solo `data-testid="packing-orders-empty"` en el contenedor del vacío
      de «Por empacar»: 3 en `asignacion-listas-paridad` y 2 en `asignacion-paridad`. Todas son la
      diferencia de R5 aceptada en § 6 (ver m1).
- [x] E2E: solo cambian los import, sin tocar aserciones (R25). La bitácora recoge la salida local de
      Playwright: 39 pasan; 1 fallo en webkit pasó al reintentarlo.

**Trazabilidad (R → test, comprobado abriendo el test)**
- [x] R1/R2/R3: `assignment-hrefs.test.ts`, con las cadenas escritas a mano. R3 también en `guard-asignacion-componentizada`.
- [x] R4/R6: paridad nueva (vacío, página posterior y esqueleto de las tres vistas). R6 también en `asignacion-page.test.tsx`, por el texto para lectores de pantalla.
- [x] R5: `.snap` de las dos paridades de listas.
- [x] R7/R16/R19: `guard-asignacion-componentizada.test.ts`, que analiza con el compilador de TypeScript e incluye muestras que deben morder.
- [x] R8/R10: `responsible-groups.test.ts` y la paridad de la lista de equipo y del selector.
- [x] R9: `expectTypeOf` en los dos sentidos y el barrel de `/pedidos`. R9 también en `order-route-contract.test.ts`.
- [x] R11/R12: casos nuevos en `conditioning-order-screen.test.tsx` y `packing-order-screen.test.tsx` (PENDIENTE y CANCELADO).
- [x] R13: `order-distribution-line-text.test.ts` y la paridad de empaque.
- [x] R14: paridad de las listas pobladas, con `recipeName: null` y `conditionedByName: null`.
- [x] R15: tests de los avisos y su paridad.
- [x] R17: `finish-conditioning-dialog.test.tsx` (la cuenta vuelve a empezar al reabrir; solo envía `orderId`; error con `role="alert"`) y paridad del diálogo antes y después de la espera, y con error.
- [x] R18: `confirm-dialog-extension.test.tsx` y `confirmaciones-paridad`, con el snapshot sin cambios.
- [x] R20: paridad del error de candidatos, el catalogado y el inesperado.
- [x] R21/R22: `guard-piezas-base`. Los archivos pasan a `D11_SIN_HALLAZGOS` y el caso nuevo de R22 comprueba que las exclusiones de `/asignacion` son estrechas y que la regla muerde. En la ruta no queda ningún par `min-h-11 min-w-11` escrito a mano; lo comprobé con grep.
- [x] R23: `guard-catalogo-de-componentes` en verde. Filas nuevas de `CountdownGatedButton` (`Dominio.dc.html`, que lo nombra) y `groupResponsiblesByOrigin`/`filterByDisplayName`; `contentClassName` y `confirmSlot` añadidos a `ConfirmDialog`; `orderDistributionLineText` añadido a `OrderDistributionLabel`.
- [x] El mapa `R<n> → test` está en la bitácora.

**CHECKPOINTS.md / checkpoints-proyecto.md**
- [x] Typecheck y lint sin errores. Sin dependencias nuevas (no toca `package.json`). Sin secretos, webhooks, tablas ni migraciones.
- [x] Multiplataforma: no hay cambio visual. Se conservan los 44 px de todos los controles tocados y `max-h-[100dvh]`.
- [x] Catálogo al día con cada pieza que sube o se extiende. `OrderOutcomeNotice` es interna de la ruta y no lleva fila; tampoco hace falta pase `/design`, porque no cambia el marcado.
- [x] `lib/shared/ui/responsible-groups.ts` es hoja: no importa nada.
- [ ] **Componentes de ruta por el barrel**: lo incumple M1.
- [x] Comentarios: ninguna línea añadida en producción cita `QC-`, `R<n>`, `design.md` ni «decisión cerrada».
- [x] Deudas: D42, D43 y D47 marcadas resueltas con fecha y ficha; D51 nueva con lo que P6 dejó fuera.
- [ ] Faltan `./init.sh` final, `gate-completo` en CI, `Cierre` y desmontar el worktree. No corresponden a esta vuelta: son del leader y del CI.

### Hallazgos

**M1 — BLOQUEANTE. Import por ruta profunda que se salta el barrel de la ruta.**
`app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx:24` importa
`assignmentViewHref` desde `'../../../components/assignment-view-params'`. `docs/architecture.md`
pone este caso en «Anti-patrones que el reviewer rechaza» («importados por ruta profunda
saltándose el barrel `index.ts` de la ruta»). La regla del barrel no prevé excepciones, y
`design.md` tampoco declara esta. Antes del diff la pantalla cumplía: usaba `ASSIGNED_ORDERS_ROUTE`
de `lib/shared/routes`. Es el único import así en `app/`.
El motivo es real: el barrel arrastra las secciones de servidor (`@/lib/composition`) a una pantalla de
cliente. Aun así, se puede resolver sin romper la regla. Opciones, de la que menos toca a la que más:
- **Recomendada:** que el servidor pase la dirección. `empaque/[id]/page.tsx` es de servidor, importa
  `assignmentViewHref` por el barrel `../../components` y se la pasa a `PackingOrderScreen` como prop,
  por ejemplo `backHref`. El árbol no cambia, R2 sigue cumpliéndose y desaparece el import profundo.
- O llevar `assignmentViewHref` a un módulo que el cliente pueda importar, como `lib/shared/routes`,
  con su fila en el catálogo si corresponde. Toca más archivos.
- O, si el humano prefiere mantener el import profundo, declarar la excepción en `design.md` con su
  porqué y abrir una deuda para separar un barrel de cliente. Es una excepción a una regla de
  arquitectura, así que la decide el humano, no el implementer.

**m1 — menor. Los recuentos de § 6 y § 7 del design están desfasados.**
§ 6 dice «1 en `asignacion-paridad`», pero son 2 (la primera página y una página posterior). Las dos son
la misma diferencia aceptada en R5, así que la paridad sigue bien; solo hay que corregir el número en el design.

**m2 — menor. R17 y D9 dicen «`ConfirmDialog`», pero el diálogo usa `ConfirmDialogFrame` + `ConfirmDialogBody`.**
Son piezas de la misma fila del catálogo, y esa fila documenta este uso, así que acepto la desviación:
título, descripción, «Cancelar», la espera y el error dan el mismo árbol. Pero el motivo que da la
bitácora no se sostiene. El `key` por apertura está en `<FinishConditioningDialog key={opening}>`
(`conditioning-actions.tsx:73`), así que `ConfirmDialog` con el `useActionState` un nivel más arriba
también habría reiniciado el estado en cada apertura. Hay que anotar la desviación en el design y dar el
motivo real: no mover `useActionState` de sitio.

**m3 — menor. `testIds.confirm` recibe un testid que nunca se pinta.**
`ConfirmDialogBody` exige `testIds.confirm` aunque llegue `confirmSlot`, y `finish-conditioning-dialog.tsx`
le pasa `COUNTDOWN_GATED_BUTTON_TESTID` solo para que compile. Habría que hacerlo opcional cuando hay
`confirmSlot`, o dejar escrito en la fila del catálogo que se ignora.

**m4 — menor. Textos exportados que ya no gobiernan lo que se pinta.**
`CONDITIONING_ORDERS_PAGE_PAST_END_TEXT` y `CONDITIONING_ORDERS_FIRST_PAGE_TEXT`
(`conditioning-orders-empty.tsx`) se exportan por el barrel, pero el texto real ahora sale de los
literales de `assignment-list-parts.tsx:18-19`. Si alguien edita la constante exportada, no cambia nada
en pantalla. D2 pedía conservarlos, así que no es un fallo de la tanda: va a deuda, junto a D51.

**m5 — menor. Un test de pieza compartida depende de una constante de ruta.**
`tests/unit/shared/countdown-gated-button.test.tsx` importa `CONDITIONING_WAIT_SECONDS` de
`app/(private)/asignacion/.../conditioning-wait` y afirma que vale 5. La pieza ya recibe `seconds`, así
que el test debería pasarle un literal propio. Además, sus títulos citan R9, R10 y R11 de otra ficha.

### Veredicto

**RECHAZADO.** Un bloqueante (M1) y cinco menores (m1–m5). El refactor está bien hecho:
la paridad congelada se mantiene, los E2E solo cambian sus import y la trazabilidad está completa. Para
cerrar M1 basta con sacar el import profundo de `packing-order-screen.tsx`; la opción recomendada es
pasar la dirección por prop desde `page.tsx`. Los menores se corrigen en el design, en el catálogo o como
deuda, a criterio del leader.
