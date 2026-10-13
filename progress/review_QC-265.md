# QC-265 — rediseno-operario · revisión

## Vuelta 1 (diff `origin/dev...HEAD`, cabeza `bb17bb9e`)

Reviewer, 2026-10-13. Spec aprobado con P1–P16 por defecto. Las decisiones del leader del
2026-10-12 (`packing-orders-table.tsx`, `assignment-row-actions.tsx`, migración de
`envases-del-pedido` y `pedido-en-varias-presentaciones`, altas en las listas cerradas) se dan por
buenas. Abajo se comprueba que están bien hechas.

### Verificación ejecutable (corrida por el reviewer)

| Comando | Resultado |
| --- | --- |
| `pnpm run typecheck` | 0 errores |
| `pnpm run lint` | 0 errores; 7 avisos ajenos al diff |
| `pnpm exec vitest related --run <app/ y components/ del diff>` + `operator-chrome-css`, `data-table-alcance`, `catalogo-qc256` | 99 archivos, 1550 tests en verde y 2 saltados |
| `pnpm exec vitest run guard` | 74 archivos, 1017 tests en verde y 20 saltados |
| `vitest run` de `paridad`, `marca`, `asignaciones-ui`, `shared`, `shared-ui` y `recetas-ui` | 163 archivos, 2313 tests en verde y 2 saltados |
| E2E | No los corrí. Los corre el CI en el PR a producción. Según la bitácora, los 11 specs pasan juntos: 78/78 en Chromium y WebKit |

No hay `.int` afectados: el diff no toca `lib/` ni `db/`.

### Checklist

**CHECKPOINTS.md**
- [x] `requirements.md` en EARS, de R1 a R45.
- [x] `design.md` con alternativas descartadas (A1–A6) y su porqué.
- [x] `tasks.md` con todas las tareas en `[x]`, de T0a a T8c.
- [x] `design.md` abre con `## Lo que ya existe`. El diff no vuelve a crear nada de esa lista: `CountdownRing` sube desde el `WaitRing` de `StepReader` y no se duplica, y `UrlTabs`, `Notice`, `StatusBadge`, `PriorityMark`, `ArrowLink`, `PageHeader`, `PageShell`, `RowActionsMenu` y `DataTable` se reutilizan.
- [x] Assignee y rama de `wt.sh` (ficha `progress/features/QC-265.md`).
- [x] Cada R tiene un test concreto. La bitácora trae el mapa R → test por tanda (ver Trazabilidad).
- [x] Typecheck y lint, en verde.
- [ ] `gate-completo` del CI: todavía no hay PR. La bitácora dice que `./init.sh --completo` da OK.
- [x] Flujo crítico (permisos): R1 y R5 tienen E2E de Playwright y su salida está en la bitácora.
- [x] Sin dependencias nuevas: `package.json` no cambia.
- [x] Sin secretos, webhooks ni configuración hardcodeada.
- [ ] `review_QC-265.md` con veredicto OK: este veredicto es CAMBIOS.
- [ ] Cierre y worktree: pendientes, son del leader.

**docs/checkpoints-proyecto.md**
- [x] El E2E es de Playwright.
- [x] Multiplataforma:
  - el alto usa `min-h-dvh`, no `100vh`;
  - nada se activa solo con `:hover`;
  - los objetivos táctiles miden 44 px o más (pie `xl` de 52 px, «Cerrar» `size-11`, menú `touchTarget`);
  - el diff no añade inputs con letra de menos de 16 px.
- [ ] Catálogo al día con cada pieza extendida o con cambio visual. **Falla en `StepReader`**: ver M2.
- [ ] Pase `/design` citado en la celda `Diseño`. **Falla en `StepReader`**: ver M2.
- [x] Datos y seguridad, módulos hexagonales y permisos:
  - no hay tablas, migraciones ni cambios en `lib/modules`;
  - `canViewTrace` es solo presentación: la ruta del recorrido sigue exigiendo `dashboard.consultar` en su página;
  - los contadores usan los casos de uso de lista, que ya validan el actor.

**docs/perfil-agentes.md > reviewer**
- [x] 5. Calidad y seguridad: sin hallazgos.
- [x] 6. Multiplataforma: arriba.
- [x] 7. Dependencias: ninguna.
- [x] 8. Aislamiento por empresa: el diff no toca ni esquema ni consultas.
- [ ] 9. Comentarios: **tres comentarios nuevos citan `R<n>`** (M1).
- [x] 10. Duplicados:
  - `OperatorScreenFrame` es el paso 4 y `OrderExecutionToolsPanel` el paso 3; los dos están justificados en `design.md`;
  - `AssignmentRowActions` y `PackingOrdersTable` solo componen piezas del catálogo.
- [ ] 11. Diseño: `StepReader` cambia de aspecto y su fila sigue con «previo al rediseño» (M2).

**Archivos esperados.** El diff no sale de `tasks.md > ## Archivos esperados`; aparte, solo cambian
los tres archivos del propio spec. Los tres borrados (`assigned-order-*-notice.tsx` y
`assigned-orders-error.tsx`) están en la lista.

### Trazabilidad (muestreo)

Leí uno a uno los tests de R10, R11, R18–R21, R4, R9 y R15. Afirman lo que pide cada requisito; ninguno es un test vacío:
- R10 y R11 en `assignment-view-counts.test.ts`: `{ page: 1, pageSize: 1 }`, el `total` y el rechazo aislado;
- R18–R21 en `assignment-row-actions.test.tsx`: incluye «fila sin ítems no pinta el menú» y la tarjeta;
- R4, R9 y R15 en `e2e/operario-rediseno.spec.ts`: rejilla 2 → 1, contador por pestaña, «Cerrar» de 44 px sin recarga.

Del resto, la bitácora nombra un test por requisito. Contrasté con la suite los que están en los
directorios que corrí, y todos están en verde.

### Hallazgos

**M1 — mayor (perfil-agentes, punto 9).** Tres comentarios añadidos en producción citan requisitos:
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-batch-data-form.tsx:23`: «(R40 del rediseño del operario)»;
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen.tsx:151`: «una columna por debajo (R4)»;
- `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx:249`: «Con paso a paso (R30)».

Hay que reescribirlos sin `R<n>`, diciendo el porqué.

**M2 — mayor (perfil-agentes, punto 11; R44; checkpoints-proyecto, catálogo).** `StepReader` cambia
de aspecto en modo `ejecucion`:
- los botones pasan a `xl`, en rejilla de 1/3 y 2/3;
- el motivo del bloqueo va dentro del pie;
- la barra se fija al pie del viewport (`fixed inset-x-0 bottom-0`);
- la sección reserva 140 px de relleno.

Pero `components/shared/CATALOGO.md:86` solo añade `CountdownRing` a `Base de`. La celda `Diseño`
sigue en «previo al rediseño» y `Alcance` no dice que, en `ejecucion`, la pieza ocupa el pie de la
pantalla. Eso es un contrato nuevo que cualquier otro consumidor tiene que conocer. Hay que poner
`docs/diseno/canvas/Ejecucion.dc.html` (y el tablero de móvil o tablet que aplique) en `Diseño` y
actualizar `Alcance`.

**m1 — menor.** Los esqueletos pintan una columna menos que la tabla cuando esta lleva «Acciones».
Ocurre siempre en «Por empacar» y en las tres vistas del acondicionador, y en las demás con
`canViewTrace`. Archivos: `app/(private)/asignacion/components/*-skeleton.tsx`. En teléfono no
pasan a tarjeta, así que al llegar la lista hay un salto de maquetación (CLS). No rompe ningún R:
R21 habla de la lista, no de la carga. Se puede arreglar aquí, ampliando la lista de archivos con
decisión del leader, o anotarlo como deuda en `progress/deudas.md`. Hoy no está en ninguno de los
dos sitios.

**m2 — menor.** Queda código muerto de lo que antes mostraba el éxito:
- `CONDITIONING_BATCH_DATA_SUCCESS_TESTID` sigue exportado en `conditioning-batch-data-form.tsx:26` y en el barrel (`acondicionamiento/[id]/components/index.ts:78`);
- su comentario dice «hasta que la tanda 8 migre…», y la tanda 8 ya está hecha;
- `e2e/datos-de-lote-en-acondicionamiento.spec.ts:335` afirma `toHaveCount(0)` sobre un testid que ya no existe en ninguna parte, así que no mide nada.

Hay que borrar la constante, el reexport y esa línea del E2E. Si se quiere conservar el aviso, que
la comprobación sea «no hay `<p>` de éxito en la sección».

**n1 — nota (punto 1 del leader: pestañas duplicadas al cargar).** No es un defecto de la app.
Ocurre lo siguiente:
- mientras el `Suspense` de las pestañas está pendiente, React deja el respaldo visible;
- la versión resuelta llega en un `<div hidden id="S:…">` hasta que `$RC` las intercambia;
- ese contenedor tiene `hidden` (`display: none`), así que no está en el árbol accesible ni recibe el foco;
- la persona y el lector de pantalla solo ven una copia;
- el testid duplicado solo existe en el DOM durante el streaming, y solo choca con el modo estricto de Playwright.

`filter({ visible: true })` es el arreglo correcto, y es transitorio. Para que nadie vuelva a
tropezar, convendría ponerlo en un helper compartido de `e2e/`. No bloquea.

**n2 — nota (punto 3: regla `:has()`).** La regla no se filtra a otras pantallas:
- `data-operator-screen` lo pinta solo `OperatorScreenFrame`, y lo importan solo `order-execution-screen.tsx`, `packing-order-screen.tsx` y `conditioning-order-screen.tsx`;
- el 404 y los errores de esas rutas no montan el marco, así que conservan la barra (R5 tiene E2E);
- al navegar en el cliente hacia otra página, el atributo sale con la página y la regla deja de aplicarse;
- el `Sheet` móvil también lleva `data-slot="sidebar"`, y su disparador vive en la cabecera oculta.

Efecto de diseño, no defecto: la ejecución (sin `back`) no ofrece salida a la lista salvo el
«atrás» del navegador. Lo dice el tablero.

**n3 — nota (punto 4: piezas compartidas).**
- `Notice` pasa a `'use client'`. Sus props siguen siendo serializables, así que se sigue pudiendo usar desde el servidor. Sin `dismissible` el árbol no cambia. El otro consumidor (`set-credential-form.tsx:146`) no se ve afectado y sus tests siguen en verde. Al pulsar «Cerrar» el aviso se desmonta y el foco cae en `body`. Es mejorable para teclado, pero no lo pide ningún R.
- `CountdownGatedButton` solo lo usan los dos diálogos del acondicionamiento.
- `StepReader` en modo `lectura` (Fórmulas, `recipe-form.tsx:491`) sale igual: misma talla, mismas clases y sin `touch` en el primario, como antes.

**n4 — nota (punto 5: E2E estabilizados en `bb17bb9e`).** No ocultan un defecto nuevo:
- el bucle `toPass` para el clic antes de hidratar en WebKit ya estaba en `origin/dev`, en `e2e/registro-ejecucion.spec.ts:390-396`, para el botón «Cancelar pedido». Aquí solo se añade abrir el menú. `RowActionsMenu` no cambia en el diff y no pinta distinto en el servidor y en el cliente;
- `waitForScreenEnterToSettle` espera a que acabe la animación `screen-enter`. Esa animación aplica `transform` a un ancestro y, mientras dura (`--dur-slow`), el pie `fixed` se desplaza hasta 10 px con la página. Como el `@keyframes` solo tiene `from`, al terminar no queda ningún `transform`, así que no hay desvío permanente. Es un detalle visual transitorio, no un fallo.

**n5 — nota.** La correspondencia vista → caso de uso de `assignment-view-tabs-section.tsx` no
tiene test unitario: es una sección de servidor. El E2E de R9 la cubre solo para las tres vistas
del acondicionador. Un cruce entre, por ejemplo, `terminados` y `todos` no lo vería nadie.
Conviene un test pequeño con los lectores falsos.

### Veredicto vuelta 1: **CAMBIOS** (RECHAZADO)

Bloquean M1 (comentarios con `R<n>` en producción) y M2 (la fila `StepReader` del catálogo no
refleja su cambio visual ni su tablero). Los dos son cambios pequeños, sin conducta nueva. m1 y m2
se arreglan aquí o quedan anotados como deuda, a criterio del leader.
