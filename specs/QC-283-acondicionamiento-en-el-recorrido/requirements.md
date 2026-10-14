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

**Completo, pendiente de aprobación humana (`spec_ready`)** — spec_author, 2026-10-14.

- El pase `/design` (P0) lo aprobó el humano el 2026-10-14. Tableros en `docs/diseno/canvas/`:
  `RecorridoAcondicionamiento.dc.html` (+ `Tablet`, `Movil`) y `DashboardAcondicionamiento.dc.html`
  (+ `Tablet`, `Movil`). Los cita `design.md > UI`.
- Los «Por confirmar» de los tableros quedan cerrados con sus valores por defecto (fila «¿Valores
  por defecto del tablero?»).
- Queda **una** pregunta abierta **no bloqueante** (P11), con un valor por defecto que el spec ya
  aplica.

**Vocabulario.** «Anotación» es una fila del registro de ejecución. «Comenzar», «guardado de
datos de lote» y «Terminar» son las tres acciones de acondicionamiento. «Supervisor» es quien anota
Comenzar (ver `design.md > Lo que ya existe`). «Foto» es lo guardado en un guardado de datos de
lote tal como era en ese instante. «Fase» es producción, empaque o acondicionamiento. Un pedido está
«vivo» si no está dado de baja ni en un estado final (`ENTREGADO`, `CANCELADO`).

## Requisitos (EARS)

### Registrar el acondicionamiento

**R1.** CUANDO alguien comienza el acondicionamiento de un pedido con éxito, el sistema DEBE anotar
en el registro de ejecución una anotación «Comenzar acondicionamiento» con el pedido, la empresa,
quien comenzó (el supervisor) y el instante. La anotación, el cambio de estado del pedido y el
equipo de trabajo DEBEN guardarse en una sola operación: se guardan los tres o ninguno.
`[DC ¿Qué se registra?] [DC Heredado]`

**R2.** SI quien ya tiene el acondicionamiento del pedido vuelve a comenzarlo, ENTONCES el sistema
NO DEBE añadir otra anotación de Comenzar. `[DC ¿Qué se registra?]`

**R3.** CUANDO se guardan los datos de lote de un pedido con éxito, el sistema DEBE anotar un
«guardado de datos de lote» con quien guardó, el instante y la foto. La foto tiene una línea por
cada línea enviada, en el orden enviado, con:

- el lote tal como se guardó;
- el **nombre** de la presentación en ese instante, sin envase ni unidades, o vacío si el catálogo
  no la devolvió;
- la fecha de vencimiento;
- el día de producción.

El guardado y su anotación DEBEN guardarse en una sola operación.
`[DC ¿Qué se registra?] [DC ¿Qué muestra cada guardado?] [DC ¿Dónde se guarda la foto?]
[DC ¿Día de producción en la foto?] [DC P5] [DC P4]`

**R4.** SI el guardado de datos de lote se rechaza (lote que no es del pedido, lote repetido, datos
inválidos, falta de permiso o estado que no lo admite), ENTONCES el sistema NO DEBE anotar nada y
DEBE devolver el mismo error que devuelve hoy. SI la anotación no se puede guardar, ENTONCES el
sistema NO DEBE guardar los datos de lote. `[DC ¿Qué se registra?] [DC P4]`

**R5.** CUANDO se corrigen los datos de lote de un pedido ya guardados, el sistema DEBE añadir otra
anotación de guardado con su propia foto y NO DEBE cambiar la foto de ninguna anotación anterior.
`[DC ¿Foto del momento?]`

**R6.** CUANDO alguien termina el acondicionamiento de un pedido con éxito, el sistema DEBE anotar
«Terminar acondicionamiento» con quien terminó y el instante, en la misma operación que el cambio de
estado. SI Terminar se rechaza, ENTONCES el sistema NO DEBE anotar nada y DEBE devolver el mismo
error que hoy. SI la anotación no se puede guardar, ENTONCES el pedido NO DEBE cambiar de estado.
`[DC ¿Qué se registra?]`

**R7.** La base de datos DEBE rechazar:

- una anotación de acondicionamiento con posición de paso o con motivo;
- una anotación de guardado de datos de lote sin foto, o con una foto sin líneas;
- una foto en cualquier anotación que no sea un guardado de datos de lote.

`[DC ¿Dónde se guarda la foto?]`

**R8.** El sistema NO DEBE editar ni borrar ninguna anotación del registro, tampoco las de
acondicionamiento ni su foto. `[DC Heredado]`

**R9.** El sistema NO DEBE crear anotaciones de acondicionamiento para lo ocurrido antes de esta
feature: ninguna migración rellena anotaciones. `[DC ¿Pedidos ya acondicionados?]`

**R10.** El sistema NO DEBE mostrar en la lista, en el detalle ni en el filtro por persona ninguna
anotación, foto, miembro de equipo ni persona de otra empresa. `[DC Heredado]`

**R11.** SI quien consulta la lista o el detalle del recorrido no tiene `dashboard.consultar`,
ENTONCES el sistema DEBE rechazarlo como hoy, sin leer el registro ni el equipo. No hay permiso
nuevo. `[DC Heredado]`

### Detalle del recorrido: las tres anotaciones nuevas

**R12.** El detalle del recorrido DEBE mostrar las anotaciones de acondicionamiento en orden
cronológico junto a las de producción y empaque. Cada una DEBE llevar su instante y su nombre:

| Anotación | Nombre | Tono | Icono |
|---|---|---|---|
| Comenzar | «Comenzar acondicionamiento» | azul (`progress`) | portapapeles con lista |
| Guardado | «Guardado de datos de lote» | neutro | flecha a bandeja |
| Terminar | «Terminar acondicionamiento» | verde (`success`) | portapapeles con check |

`[DC ¿Qué se registra?] [DC ¿Valores por defecto del tablero?]`

**R13.** La anotación de Comenzar DEBE mostrar al supervisor y «Equipo de trabajo · N», con cada
miembro en el orden en que se compuso el equipo. Por cada miembro DEBE mostrar su nombre **actual**
y, si entró por un grupo de trabajo, el nombre del grupo **tal como era al comenzar**.
`[DC ¿Qué se registra?] [DC P9]`

**R14.** SI el acondicionamiento se comenzó sin equipo, ENTONCES la anotación de Comenzar DEBE
mostrar «Equipo de trabajo · 0» y «Se comenzó sin equipo de trabajo.». `[DC ¿Qué se registra?]`

**R15.** La anotación de guardado DEBE mostrar quién guardó, «1 presentación» o «N
presentaciones», y por cada línea de la foto: lote, presentación, vencimiento y día de producción,
con las fechas en `dd/mm/aaaa`. DEBE mostrar además el aviso «Datos tal como se guardaron en ese
momento». `[DC ¿Qué muestra cada guardado?] [DC ¿Foto del momento?] [DC ¿Día de producción en la
foto?] [DC ¿Valores por defecto del tablero?]`

**R16.** SI una línea de la foto no tiene nombre de presentación, ENTONCES el detalle DEBE mostrar
«—» con el nombre accesible «Sin dato». `[DC ¿Qué muestra cada guardado?]`

**R17.** La anotación de Terminar DEBE mostrar solo quién terminó.
`[DC ¿Valores por defecto del tablero?]`

**R18.** DONDE el contenedor del recorrido mida 760 px o menos, el detalle DEBE mostrar cada línea
del guardado como tarjeta: lote y presentación arriba, «Vence» y «Producido» abajo, con los mismos
datos que la tabla. `[DC ¿Qué muestra cada guardado?]`

### Duraciones

**R19.** El sistema DEBE calcular **tres** duraciones separadas por pedido, una por fase, cada una
desde la anotación que abre la fase hasta la que la cierra:

| Fase | La abre | La cierra |
|---|---|---|
| producción | arrancar | finalizar, o cancelar mientras está en curso |
| empaque | comenzar empaque | terminar empaque, o cancelar mientras está en curso |
| acondicionamiento | Comenzar acondicionamiento | Terminar acondicionamiento |

`[DC ¿Duración?] [DC ¿Cuántas duraciones?]`

**R20.** MIENTRAS el pedido esté vivo, en el estado de una fase (`EN_CURSO`, `EN_EMPAQUE` o
`EN_ACONDICIONAMIENTO`) y sin la anotación que la cierra, el sistema DEBE medir esa fase hasta el
instante de la consulta y marcarla «En curso». `[DC ¿Cuántas duraciones?]`

**R21.** SI una fase está abierta pero sin cierre anotado y el pedido ya no está en su estado (o
está dado de baja), ENTONCES el sistema DEBE medirla hasta la última anotación de esa fase y
marcarla «Sin cierre anotado». `[DC ¿Cuántas duraciones?]`

**R22.** SI no hay anotación que abra una fase, ENTONCES el sistema NO DEBE dar duración para esa
fase. En concreto, un pedido sin Comenzar anotado NO DEBE tener duración de acondicionamiento,
aunque tenga guardados de datos de lote. `[DC ¿Pedidos sin Comenzar anotado?]
[DC ¿Pedidos ya acondicionados?]`

**R23.** La duración de producción DEBE descontar las pausas. Una pausa es el tramo que va desde la
anotación inmediatamente anterior a un «retomar» hasta ese «retomar», dentro de la fase de
producción. El tiempo en `BLOQUEADO` NO DEBE descontarse. `[DC P10] [DC P6a, enmendada por P10]`

**R24.** CUANDO se cancela un pedido, el sistema DEBE cerrar en el instante del cancelar **solo** la
fase que estaba en curso. Las demás fases DEBEN quedarse como estaban. `[DC P6b]`

**R25.** El detalle del recorrido DEBE mostrar, junto al estado y las vueltas atrás, una tarjeta por
fase que tenga duración, con las etiquetas «Duración de producción», «Duración de empaque» y
«Duración de acondicionamiento»:

- la cifra va sin sufijo;
- una fase «En curso» (R20) DEBE llevar la insignia «En curso»;
- una fase «Sin cierre anotado» (R21) DEBE llevar la insignia «Sin cierre anotado»;
- una fase sin duración (R22) NO DEBE pintarse.

`[DC ¿Cuántas duraciones?] [DC ¿Duración en la lista y en el detalle?] [DC ¿Valores por defecto
del tablero?]`

**R26.** Cada fila de la lista del dashboard DEBE mostrar **una sola** duración: la suma de las
duraciones de las fases que tiene el pedido (R19–R24). Esa suma:

- no cuenta las esperas entre fases;
- cuenta 0 por cada fase sin duración;
- se muestra en minutos enteros, sin segundos (truncando);
- lleva el sufijo « (en curso)» si alguna fase está «En curso»;
- si no hay ninguna «En curso», lleva « (sin cierre anotado)» si alguna fase está «Sin cierre
  anotado».

`[DC ¿Duración en la lista y en el detalle?]`

**R27.** La lista DEBE entregar por pedido ese total como su única duración, sin el desglose por
fase. El desglose solo está en el detalle. `[DC ¿Duración en la lista y en el detalle?]`

**R28.** MIENTRAS un pedido esté vivo, la fila y el detalle DEBEN llevar la marca «En curso» junto al
pedido, sea cual sea el estado de sus duraciones. Un pedido dado de baja NO DEBE llevarla.
`[DC ¿Valores por defecto del tablero?]`

### Personas y filtro por persona

**R29.** La fila de la lista DEBE mostrar como personas primero a quienes firman anotaciones del
pedido, y después al equipo del Comenzar anotado en el orden en que se compuso, sin repetir a nadie,
con sus nombres actuales. El tooltip NO DEBE distinguir al equipo de los firmantes.
`[DC P8] [DC P9] [DC ¿Valores por defecto del tablero?]`

**R30.** CUANDO se filtra la lista por una persona, el sistema DEBE devolver los pedidos en los que
esa persona firmó alguna anotación y también aquellos en los que formó parte del equipo de un
Comenzar anotado. Con rango de fechas, para el equipo DEBE contar el instante de ese Comenzar.
`[DC ¿Filtro por persona (QC-167)?] [DC P7]`

**R31.** Las opciones del filtro por persona DEBEN ser solo las personas que firman alguna anotación,
lo que incluye al supervisor y a quien guarda datos de lote. Un miembro del equipo NO DEBE aparecer
como opción solo por serlo. `[DC ¿Opciones del filtro por persona?]`

**R32.** SI un pedido tiene equipo guardado pero no tiene Comenzar anotado, ENTONCES el sistema NO
DEBE mostrar ese equipo en la fila ni en el detalle, y NO DEBE encontrar el pedido al filtrar por un
miembro de ese equipo. `[DC ¿Pedidos ya acondicionados?]`

### Integridad, migraciones, dependencias y flujo completo

**R33.** SI una foto guardada no tiene la forma esperada, ENTONCES el detalle y la lista DEBEN
fallar con el error de carga de hoy, sin mostrar datos a medias. `[DC ¿Foto del momento?]`

**R34.** Cada migración de esta feature DEBE tener un `down.sql` que la revierta. SI hay anotaciones
de acondicionamiento, ENTONCES el `down.sql` de las acciones nuevas DEBE abortar sin cambiar nada.
`[DC Heredado]`

**R35.** El sistema NO DEBE añadir ninguna dependencia de terceros. `[DC ¿E2E? ¿Dependencias?]`

**R36.** Un test E2E DEBE recorrer el flujo completo:

1. comenzar con equipo;
2. guardar datos de lote y corregirlos;
3. terminar.

Con eso DEBE comprobar en el dashboard:

- las tres anotaciones nuevas, con la foto del primer guardado intacta tras la corrección;
- las tres duraciones en el detalle y el total en la fila;
- que el filtro por un miembro del equipo que no firma encuentra el pedido.

`[DC ¿E2E? ¿Dependencias?]`

### Cobertura de las decisiones

| Decisión (fila de la tabla) | Requisitos |
|---|---|
| ¿Qué se registra? | R1, R2, R3, R4, R6, R12, R13, R14 |
| ¿Qué muestra cada guardado? | R3, R15, R16, R18 |
| ¿Foto del momento? | R5, R15, R33 |
| ¿Dónde se guarda la foto del momento? | R3, R7 |
| ¿Pedidos ya acondicionados? | R9, R22, R32 |
| ¿Filtro por persona (QC-167)? | R30 |
| ¿Duración? | R19 |
| Heredado | R1, R8, R10, R11, R34 (identificadores en inglés: `design.md > Contratos`, lo revisa el reviewer) |
| ¿E2E? ¿Dependencias? | R35, R36 |
| ¿Cuántas duraciones? | R19, R20, R21, R25 |
| ¿Día de producción en la foto? | R3, R15 |
| ¿Pedidos sin Comenzar anotado? | R22 |
| ¿Opciones del filtro por persona? | R31 |
| P4 — orden con QC-284 | R3, R4 (la firma que habilita la operación única: `design.md > C2.5`) |
| P5 — presentación en la foto | R3 |
| P6a — tiempo bloqueado (enmendada por P10) | R23 |
| P6b — cancel | R24 |
| P7 — filtro del equipo con fechas | R30 |
| P8 — equipo en la fila | R29 |
| P9 — nombres actuales | R13, R29 |
| P0 — pase `/design` | R12–R18, R25, R26 |
| ¿Duración en la lista y en el detalle? | R25, R26, R27 |
| P10 — pausas en producción | R23 |
| ¿Valores por defecto del tablero? | R12, R15, R17, R25, R28, R29 |

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
| 2026-10-14 | ¿Cuenta el tiempo bloqueado en producción? (P6a) | **Enmendada por P10 (misma fecha):** lo que se descuenta son las pausas, no `BLOQUEADO`. Texto original: «No: el tiempo en `BLOQUEADO` se descuenta de la duración de producción. **Enmienda QC-167 D11 y R15** (duración de reloj con todo dentro)» |
| 2026-10-14 | ¿A qué cifra cierra un cancel? (P6b) | Solo a la de la fase en curso. Las demás quedan como estaban |
| 2026-10-14 | ¿Filtro por persona del equipo con rango de fechas? (P7) | Cuenta la fecha del Comenzar |
| 2026-10-14 | ¿El equipo sale en las personas de la fila? (P8) | Sí: la fila del dashboard muestra al equipo entre las personas del pedido |
| 2026-10-14 | ¿Nombre de las personas como era o como es? (P9) | Los nombres actuales, como hoy. Solo el nombre del grupo queda como foto |
| 2026-10-14 | ¿Pase `/design`? (P0) | **Aprobado.** Tableros `RecorridoAcondicionamiento*` y `DashboardAcondicionamiento*` copiados a `docs/diseno/canvas/` |
| 2026-10-14 | ¿Duración en la lista y en el detalle? | **Lista: una sola duración total** = suma de las etapas (producción + empaque + acondicionamiento), sin las esperas entre etapas. Una etapa sin anotación que la abra suma 0. Redondeo a minutos. Con alguna etapa abierta lleva « (en curso)»; con alguna sin cierre, « (sin cierre anotado)». Ordenar por duración es ordenar por ese total. **Detalle:** las tres duraciones por etapa, con insignia «En curso» o «Sin cierre anotado»; una fase sin anotación que la abra no se pinta |
| 2026-10-14 | ¿Qué tiempo se descuenta de producción? (P10) | **Opción 2: las pausas**, es decir, los tramos entre una pausa y su `resume` anotados en el registro. No `BLOQUEADO`. Enmienda P6a |
| 2026-10-14 | ¿Valores por defecto del tablero («Por confirmar»)? | Se aceptan todos: fechas `dd/mm/aaaa` en pantalla (la foto guarda `AAAA-MM-DD`); etiquetas «Duración de producción / de empaque / de acondicionamiento»; insignia en el detalle y sufijo en la lista; Terminar solo muestra quién; iconos lucide `ClipboardList` / `Download` / `ClipboardCheck`; el tooltip de Personas no distingue al equipo de los firmantes |

## Preguntas abiertas

- P0 a P10 las cerró el humano el 2026-10-14: ahora son filas de `Decisiones cerradas`.
- **P11 — no bloqueante. «Ordenar por duración» no existe hoy en la lista.**
  - La lista se ordena siempre por número de pedido descendente (QC-167 D13/R4).
    `execution-trace-list-params.ts` fija `sort: null` y ninguna columna es `sortable`.
  - La decisión «Ordenar por duración es ordenar por ese total» no tiene hoy dónde aplicarse.
  - Añadir una columna ordenable sería ordenar en el servidor por un valor que se calcula en memoria
    a partir de las anotaciones. Eso cambia la paginación de QC-167 y amplía el alcance.
  - **Por defecto en este spec:** no se añade orden. La fila entrega el total como su única duración
    (R27), así que, si algún día se ordena por duración, se ordenará por ese total.
  - Si el humano quiere la columna ordenable en esta feature, es un cambio de alcance y se
    respecifica.
- **Interpretaciones del spec_author** (ninguna reabre una decisión; el humano las ve al aprobar):
  - **Inicio de una pausa (R23).** El registro no tiene acción «pausa»: solo anota `resume`. El único
    inicio de pausa que el registro conoce es la anotación inmediatamente anterior a cada `resume`.
    Consecuencia: si se perdió un avanzar o retroceder (QC-82 lo admite), la pausa medida empieza
    antes y descuenta de más (`design.md > Riesgos`).
  - **Sufijo del total con fases «En curso» y «Sin cierre anotado» a la vez (R26).** Gana « (en
    curso)»: el total es una sola `TraceDuration` con un solo `kind`.
  - **Marca «En curso» en la lista (R28).** El tablero la dibuja junto al estado. Se mantiene donde
    la dejó QC-261 P4 (junto al número). El tablero dice «Mismas columnas que hoy» y QC-283 no
    reabre QC-261.
