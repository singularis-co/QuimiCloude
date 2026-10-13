# QC-252 — Componentización de /asignacion · requirements.md

## Alcance

Las vistas de `/asignacion` («Por acondicionar», «Acondicionados», «Entregados», «Terminados»,
«Por empacar») y sus detalles de empaque y acondicionamiento duplican piezas que ya existen, o
que deberían existir una sola vez. Esta ficha las unifica **sin cambio de comportamiento**: mismas
direcciones, mismos textos, mismos `data-testid`, mismas clases y mismas aserciones E2E. Cualquier
diferencia del árbol que se acepte está enumerada en `design.md > 6` y tiene su requisito.

Los siete puntos de la ficha:

1. Constructores de `href`: fuera `conditioning-orders-href.ts`, `finishedOrdersHref`,
   `packingOrdersHref` y `BACK_HREF`; se usan `assignmentViewHref` y `assignedOrdersListHref`.
2. Vacíos y carga: los clones locales pasan a `EmptyState` y `TableSkeleton`.
3. Selector y lista de equipo construidos sobre `order-responsibles` (`groupResponsiblesByOrigin`).
4. Etiquetas de estado unificadas con el mapa compartido; la línea de reparto, con
   `OrderDistributionFull`.
5. `PackedOrderNotice` y `ConditionedOrderNotice` en una sola pieza; el diálogo de terminar sobre la
   confirmación compartida; `CountdownGatedButton` a `components/shared`.
6. La talla táctil escrita a mano pasa a la constante compartida.
7. Cada pieza que sube o se extiende tiene su fila en `components/shared/CATALOGO.md`.

### Lo que NO entra

- **Cambios visuales.** Adoptar `Notice`, `UrlTabs`, `ArrowLink`, `StatusBadge` o el anillo de
  progreso del botón con espera es de **QC-265** (rediseño del operario), que depende de esta.
- El diálogo de **Comenzar** acondicionamiento (`start-conditioning-dialog.tsx`) sigue siendo un
  `Dialog` con el selector dentro: solo cambia de dónde importa el botón con espera.
- `currentActor()` repetido en las secciones de servidor, los dos módulos de parseo de URL
  (`assignment-view-params.ts` y `assigned-orders-list-params.ts`) y `companyOrdersHref` (lleva el
  filtro de estado): no los nombra la ficha.
- Ver `## Decisiones cerradas (no reabrir) > P6` para los duplicados vistos que la ficha no nombra.

## Decisiones cerradas (no reabrir)

La ficha llegó sin `/afinar-feature`. Las decisiones del spec están en `design.md > 4`. Las seis
preguntas que pedían confirmación del humano se cerraron con la opción por defecto del spec al
aprobarlo (`progress/features/QC-252.md > Decisiones`); su texto es el de la pregunta original.

| # | Decisión | Quién y cuándo | Enmienda a | Cubierta por |
| --- | --- | --- | --- | --- |
| P1 | **`ConfirmActionDialog` ya no existe.** QC-232 lo borró y `ConfirmDialog` ocupa su lugar; `guard-formularios-y-acciones` impide que vuelva. Por defecto, el diálogo de terminar se basa en `ConfirmDialog` (R17). ¿Es lo que pedía la ficha? → Sí, opción por defecto. | humano, al aprobar el spec, 2026-10-12 | — | R17, R18 |
| P2 | **El mapa de estados ya es server-safe.** QC-256 dejó `ORDER_STATUS_LABELS` en `lib/shared/ui/order-status.ts`, sin `'use client'`, y `COMPANY_ORDER_STATUS_LABELS` ya es un alias suyo. Por defecto, ese es el destino (R11) y no se mueve nada más. ¿Confirmado? → Sí, opción por defecto. | humano, al aprobar el spec, 2026-10-12 | — | R11, R12 |
| P3 | **Qué del selector de equipo se construye sobre `order-responsibles`.** El agrupado (`groupResponsiblesByOrigin`) solo lo usa la lista de equipo; lo que el selector comparte con el panel de responsables es el filtro de personas por nombre. Por defecto se comparten el agrupado y el filtro (R8–R10), y el marcado del selector (fieldsets, pistas de grupo, campos ocultos, `data-testid`) no cambia. Unificar también el marcado cambia el árbol y los E2E de una de las dos pantallas y sería cambio visual (pase `/design`). ¿Basta con el agrupado y el filtro? → Sí, opción por defecto. | humano, al aprobar el spec, 2026-10-12 | — | R8, R9, R10 |
| P4 | **`Notice` no se adopta.** Cambiaría el aspecto de los avisos (icono, tokens, animación), y eso es de QC-265. Por defecto, la pieza única conserva el marcado de hoy (R15). ¿De acuerdo? → Sí, opción por defecto. | humano, al aprobar el spec, 2026-10-12 | — | R15 |
| P5 | **`CountdownGatedButton` sube a `components/shared` con una sola ruta consumidora.** Es una excepción declarada a «sube con la segunda ruta» (`design.md > 4 > D10`). La guardia del catálogo exige un tablero para toda pieza nueva de Compuestos: por defecto la fila cita `docs/diseno/canvas/Dominio.dc.html`, que ya dice «CountdownGatedButton (hoy en la ruta; sube a shared)» y dibuja el anillo que pondrá QC-265. ¿Vale ese tablero, o hace falta un pase `/design` propio? → Vale ese tablero, opción por defecto. | humano, al aprobar el spec, 2026-10-12 | — | R19, R23 |
| P6 | **Duplicados vistos que la ficha no nombra.** `AssignedOrderDeliveredNotice` tiene el mismo marcado que los dos avisos de R15; `AssignedOrdersError` y `AssignmentListError` son la misma pieza; el barrel reexporta el alias `MISSING_VALUE_MARK`, que solo usa `tests/unit/asignaciones-ui/assigned-orders-columns.test.tsx`. Por defecto **quedan fuera** y la guardia conserva una única exclusión estrecha para el alias (R22). ¿Entran en esta ficha? → Quedan fuera, opción por defecto; deuda en `progress/deudas.md`. | humano, al aprobar el spec, 2026-10-12 | — | R22 |

## Requisitos (EARS)

### Direcciones (punto 1)

- **R1.** CUANDO una lista de «Por acondicionar», «Acondicionados», «Entregados», «Terminados» o
  «Por empacar» pagina, cambia el tamaño de página o enlaza a su primera página, el sistema DEBE
  producir la misma dirección que hoy, `/asignacion?page=<p>&pageSize=<n>&vista=<vista>`, carácter a
  carácter.
- **R2.** CUANDO la pantalla de empaque pinta «Volver a «Por empacar»», el enlace DEBE apuntar a
  `/asignacion?vista=por_empacar`, la misma dirección que hoy.
- **R3.** El código de producción NO DEBE contener `conditioning-orders-href.ts`, `finishedOrdersHref`,
  `packingOrdersHref`, `BACK_HREF`, `conditioningOrdersHref`, `conditionedOrdersHref`,
  `deliveredConditionedOrdersHref` ni el tipo `ConditioningListView`.

### Vacíos y carga (punto 2)

- **R4.** MIENTRAS una lista de `/asignacion` no tiene pedidos que mostrar, el sistema DEBE pintar su
  vacío con `EmptyState` y conservar el mensaje, el `data-testid` del mensaje, el del enlace «Volver a
  la primera página», su `href` y sus clases.
- **R5.** MIENTRAS «Por empacar» está vacía, el contenedor de su vacío DEBE llevar
  `data-testid="packing-orders-empty"`, como el de las otras listas. Es la única diferencia de árbol
  aceptada en los vacíos.
- **R6.** MIENTRAS carga «Por acondicionar», «Acondicionados» o «Entregados», el sistema DEBE pintar
  `TableSkeleton` con el mismo número de columnas y filas, el mismo texto para lectores de pantalla y
  los mismos `data-testid` que hoy, sin el atributo `data-list`.
- **R7.** Los vacíos y esqueletos de `/asignacion` NO DEBEN pintar por su cuenta tabla, celdas
  pulsantes ni enlace de primera página: DEBEN delegar en `EmptyState` y `TableSkeleton`.

### Equipo (punto 3)

- **R8.** CUANDO el detalle de acondicionamiento muestra el equipo, el sistema DEBE agruparlo con la
  misma función que agrupa los responsables del panel de `/pedidos`, y conservar el orden de los
  grupos (primero «Personas sueltas», después cada grupo por su primera aparición), sus nombres, el
  orden de las personas y los `data-testid`.
- **R9.** El agrupado por origen DEBE tener una sola definición, importable desde un componente de
  servidor y desde uno de cliente, y el barrel de `/pedidos` DEBE seguir exportando
  `groupResponsiblesByOrigin`.
- **R10.** CUANDO quien acondiciona escribe en la búsqueda del selector de equipo, el sistema DEBE
  filtrar las personas con la misma función que filtra los candidatos del panel de responsables de
  `/pedidos` (sin distinguir mayúsculas y sin los espacios de los extremos), y el árbol del selector
  DEBE ser el de hoy.

### Etiquetas (punto 4)

- **R11.** CUANDO las pantallas de detalle de acondicionamiento y de empaque pintan el estado del
  pedido, el sistema DEBE tomar la etiqueta de `ORDER_STATUS_LABELS`, y el texto de cada estado que
  hoy pinta cada pantalla DEBE ser el mismo.
- **R12.** SI una de esas pantallas recibe un estado para el que hoy no tiene etiqueta propia,
  ENTONCES DEBE pintar la etiqueta del mapa en vez del código crudo del estado.
- **R13.** CUANDO se pinta una línea del reparto de un pedido en `/asignacion` («N × envase», con la
  presentación como respaldo y `—` si falta el nombre), el sistema DEBE componer el texto con la
  misma función que usa `OrderDistributionLabel`; la pantalla de empaque DEBE conservar una `<li>`
  por línea con su `data-testid`.
- **R14.** CUANDO una celda de «Por acondicionar» no tiene receta o persona que acondiciona, el
  sistema DEBE pintar la marca de vacío con la pieza compartida de la ruta, conservando su
  `aria-label`, su `data-testid` y el glifo de `EMPTY_MARK`.

### Avisos y diálogos (punto 5)

- **R15.** CUANDO `/asignacion` llega con `empacado` en «Por empacar» o con `acondicionado` en «Por
  acondicionar», el sistema DEBE pintar el aviso con una sola pieza parametrizada y conservar
  `role="status"`, el `data-testid`, el texto y las clases de hoy.
- **R16.** El código de producción NO DEBE definir los componentes `PackedOrderNotice` ni
  `ConditionedOrderNotice`.
- **R17.** CUANDO quien acondiciona abre «Terminar», el sistema DEBE pintar el diálogo con
  `ConfirmDialog` y conservar el título, la descripción, «Cancelar», el botón con espera de 5 s que
  vuelve a contar en cada apertura, el envío de solo `orderId`, el error dentro del diálogo con
  `role="alert"` y los `data-testid`.
- **R18.** CUANDO `ConfirmDialog` gana las extensiones que necesita R17, sus consumidores actuales
  DEBEN pintar el mismo árbol que hoy.
- **R19.** El botón con espera DEBE vivir en `components/shared/` con la misma conducta (deshabilitado
  hasta que acaba la cuenta, cuenta visible, `type="submit"`), y la ruta de acondicionamiento NO DEBE
  conservar una copia.
- **R20.** SI falla la carga de los candidatos del equipo, ENTONCES el detalle de acondicionamiento
  DEBE pintar el error con `ErrorAlert` y conservar `role="alert"`, `data-testid`, `data-code`, clases
  y texto, también para el error inesperado con su referencia.

### Talla táctil (punto 6)

- **R21.** Los controles de `/asignacion` que hoy escriben a mano el par `min-h-11 min-w-11` (pestañas
  de vista, enlace del número en «Por acondicionar», enlace de vuelta del detalle de
  acondicionamiento, enlace de primera página del vacío) DEBEN tomarlo de `touchTarget` o de
  `Button`/`buttonVariants` con `touch`, con el mismo conjunto de clases resultante.
- **R22.** `tests/guards/guard-piezas-base.test.ts` NO DEBE excluir ningún archivo de
  `app/(private)/asignacion/`, salvo la reexportación `MISSING_VALUE_MARK` del barrel de la ruta
  (`## Decisiones cerradas (no reabrir) > P6`).

### Catálogo (punto 7)

- **R23.** CUANDO una pieza sube a `components/shared/` o a `lib/shared/ui/`, o una pieza del catálogo
  gana un punto de extensión, `components/shared/CATALOGO.md` DEBE tener su fila o su columna
  `Puntos de extensión` al día en el mismo commit.

### Sin cambio de comportamiento

- **R24.** El árbol accesible de las listas, avisos, detalles y diálogos de `/asignacion` DEBE ser
  idéntico al congelado antes del refactor, salvo las diferencias que enumera `design.md > 6`.
- **R25.** Los E2E de `/asignacion` DEBEN pasar sin cambiar ninguna de sus aserciones; solo pueden
  cambiar las rutas de sus `import`.

## Preguntas abiertas

Ninguna: P1–P6 se cerraron al aprobar el spec (`## Decisiones cerradas (no reabrir)`).
