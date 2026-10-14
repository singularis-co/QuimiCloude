# QC-283 — acondicionamiento-en-el-recorrido · requirements.md

> **Zona** `fullstack` · **Complejidad** `high` · **depends_on** QC-82, QC-167, QC-215, QC-216,
> QC-217, QC-218, QC-219 · **Rama** `feature/QC-283-acondicionamiento-en-el-recorrido`
>
> ## Alcance
>
> El recorrido de ejecución del dashboard (QC-167) muestra también lo que pasa en el
> acondicionamiento. Hoy el registro de ejecución (QC-82, `OrderExecutionAction` en
> `db/schema.prisma`) solo conoce acciones de producción (`START`…`FINISH`) y de empaque
> (`PACK_START`, `PACK_FINISH`); ninguna acción del acondicionamiento (QC-215, QC-217, QC-218,
> QC-219) se registra.
>
> ## Lo que NO entra
>
> - Purgar el registro → **QC-124**.
> - Exportar o mostrar gráficos (fuera ya en QC-167).
>
> _Acotada con `/afinar-feature` (issue de Jira, 2026-10-14). El Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano antes del spec: no se reabren._

## Estado del spec

**BLOQUEADO: falta el pase `/design` del recorrido con acondicionamiento** (2026-10-14,
spec_author). La feature cambia la UI visible de piezas existentes del dashboard, y
`docs/diseno/canvas/` no tiene ningún tablero que cubra esos cambios. `Recorrido*.dc.html` y
`Dashboard*.dc.html` solo nombran «Por acondicionar» como estado. Esto choca con
`docs/perfil-agentes.md > Pase de diseño para componentes nuevos` y `> spec_author`. Los cambios
de UI que pide la feature son:

- `ExecutionTimeline` (`app/(private)/dashboard/recorrido/[id]/components/execution-timeline.tsx`)
  necesita tres anotaciones nuevas:
  - Comenzar, con el supervisor y el equipo;
  - cada guardado de datos de lote, con el lote, la presentación y el vencimiento de cada línea;
  - Terminar.
- `ExecutionTraceDetail` y la lista del dashboard (`execution-trace-columns.tsx`) pasan de una
  duración a tres: producción, empaque y acondicionamiento.

Por eso `## Requisitos (EARS)`, el resto de `design.md` y `tasks.md` todavía no se escriben. Se
escribirán cuando el tablero aprobado esté en `docs/diseno/canvas/`.

**Actualización 2026-10-14 (spec_author, a petición del humano).** Los **contratos** ya están
cerrados en `design.md > Contratos`, para que backend_dev y frontend_dev puedan trabajar en
paralelo cuando se apruebe el tablero. Los contratos son:

- el esquema;
- los servicios backend, con la firma de antes y la de después;
- los tipos de lectura hacia el front;
- dónde vive cada tipo y los fixtures.

Siguen **pendientes de P0**:

- los requisitos `R<n>`;
- el resto de `design.md` (UI, catálogo, plan de tests);
- `tasks.md`.

## Requisitos (EARS)

_Pendiente: depende del pase `/design` (ver «Estado del spec»)._

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-14 | ¿Qué se registra? | Comenzar acondicionamiento, con el supervisor (Administrador de acondicionamiento, QC-216) y el equipo de trabajo (QC-218); cada guardado de datos de lote (QC-219); y Terminar |
| 2026-10-14 | ¿Qué muestra cada guardado? | Todo lo guardado (lote, presentaciones y fecha de vencimiento) y quién lo guardó |
| 2026-10-14 | ¿Foto del momento? | Se muestra como era en ese instante, no como está hoy. Si luego se corrige el lote, el recorrido no cambia |
| 2026-10-14 | ¿Dónde se guarda la foto del momento? | **En el propio registro de ejecución** (`order_execution_entries` / `OrderExecutionAction`), sin tabla extra. Se descarta una tabla aparte enlazada |
| 2026-10-14 | ¿Pedidos ya acondicionados? | El registro empieza desde ahora: no se reconstruye nada hacia atrás (como QC-92) |
| 2026-10-14 | ¿Filtro por persona (QC-167)? | Encuentra los pedidos en los que la persona fue supervisor o formó parte del equipo |
| 2026-10-14 | ¿Duración? | El acondicionamiento tiene su propia duración, aparte de la de producción y empaque («como QC-167 separa el empaque»; la precisa la fila «¿Cuántas duraciones?») |
| 2026-10-14 | Heredado | `dashboard.consultar` sin permiso nuevo (QC-167); aislamiento por empresa; el registro solo se inserta, nunca se edita ni se borra (QC-82); identificadores en inglés |
| 2026-10-14 | ¿E2E? ¿Dependencias? | E2E sí. Sin dependencias nuevas |
| 2026-10-14 | ¿Cuántas duraciones? | **Tres cifras separadas:** producción, empaque y acondicionamiento. **Enmienda QC-167 D11 y R15**, que fijaban una sola duración para ejecución y empaque juntos. La frase «como QC-167 separa el empaque» de la fila «¿Duración?» no describía lo implementado; esta fila es la que manda |
| 2026-10-14 | ¿Día de producción en la foto? | Sí: cada guardado muestra también el día de producción, y se guarda en la foto del momento junto al lote, las presentaciones y el vencimiento |
| 2026-10-14 | ¿Pedidos sin Comenzar anotado (previos a la feature)? | No muestran duración de acondicionamiento |
| 2026-10-14 | ¿Opciones del filtro por persona? | Solo el supervisor entra como opción nueva del filtro. Los miembros del equipo no se listan aparte |
| 2026-10-14 | ¿Orden con QC-284? (P4) | QC-283 va primero. QC-284 se adapta después a las firmas nuevas (`design.md > C2.5, C2.7`) |
| 2026-10-14 | ¿Qué entra de la presentación en la foto? (P5) | Solo el nombre de la presentación, sin envase ni unidades |
| 2026-10-14 | ¿Cuenta el tiempo bloqueado en producción? (P6a) | No: el tiempo en `BLOQUEADO` se descuenta de la duración de producción. **Enmienda QC-167 D11 y R15** (duración de reloj con todo dentro) |
| 2026-10-14 | ¿A qué cifra cierra un cancel? (P6b) | Solo a la de la fase en curso. Las demás quedan como estaban |
| 2026-10-14 | ¿Filtro por persona del equipo con rango de fechas? (P7) | Cuenta la fecha del Comenzar |
| 2026-10-14 | ¿El equipo sale en las personas de la fila? (P8) | Sí: la fila del dashboard muestra al equipo entre las personas del pedido |
| 2026-10-14 | ¿Nombre de las personas como era o como es? (P9) | Los nombres actuales, como hoy. Solo el nombre del grupo queda como foto |

## Preguntas abiertas

- **P0 — bloqueante.** El pase `/design` debe cubrir lo siguiente:
  - las tres anotaciones nuevas del recorrido, con el detalle de equipo y de las líneas de lote;
  - las tres duraciones (producción, empaque y acondicionamiento) en el detalle y en la fila de la
    lista;
  - escritorio, tablet y teléfono.

  Lo aprueba el humano antes del spec.
- P1, P2 y P3 las cerró el humano el 2026-10-14: ahora son filas de `Decisiones cerradas`.
- P4 a P9 las cerró el humano el 2026-10-14: también son filas de `Decisiones cerradas`.
- **P10 — No hay tramos `BLOQUEADO` que descontar** (de la decisión P6a; `design.md > C3.3`).
  - El registro no anota cuándo un pedido entra o sale de `BLOQUEADO`. Lo cambian
    `create-order.ts`, `update-order-presentation-lines.ts` y `review-blocked-orders.ts`, y
    ninguno escribe en `order_execution_entries`.
  - La matriz de `order-transitions.ts` solo conecta `BLOQUEADO` con `PENDIENTE`, y
    `start-assigned-order.ts` rechaza Comenzar sobre un `BLOQUEADO`. Así que, desde que hay
    `start`, el pedido ya no puede bloquearse: con el código actual, el descuento es siempre 0.
  - El tiempo bloqueado previo a `start` ya queda fuera de la cifra.
  - ¿Basta con eso, y la regla queda escrita para cuando la matriz cambie? ¿O el humano se
    refería a otro tiempo, por ejemplo el de `PENDIENTE` + `BLOQUEADO` antes de empezar, o pausas
    entre `start` y `resume`?
  - Si hay que anotar entrada y salida de `BLOQUEADO`, son dos acciones nuevas en el registro que
    escribe `pedidos`. Eso amplía el alcance y hay que decidirlo.
