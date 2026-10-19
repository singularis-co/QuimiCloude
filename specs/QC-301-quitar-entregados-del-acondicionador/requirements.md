# QC-301 — quitar-entregados-del-acondicionador · requirements.md

> Spec corto: el humano pidió la vía rápida (2026-10-19).

## Alcance

El acondicionador deja de tener la pestaña «Entregados» en `/asignacion`, que es la vista
`acondicionados_entregados` de QC-219 R20. Conserva «Por acondicionar» y «Acondicionados».

Fuera de alcance:

- la pantalla del detalle de acondicionamiento de un `ENTREGADO` propio (QC-219 R21) sigue
  existiendo; solo cambia su enlace de vuelta;
- los permisos, los roles sembrados y las vistas de cualquier otro rol.

## Decisiones cerradas (no reabrir)

| # | Decisión (el humano, 2026-10-19) | Requisitos |
|---|---|---|
| D1 | «Volver» desde la pantalla de un pedido de acondicionamiento `ENTREGADO` lleva a «Acondicionados». | R4 |
| D2 | Los `ENTREGADO` desaparecen de las vistas del acondicionador. La consulta que alimenta la pestaña (`listDeliveredConditionedOrders`: caso de uso, puerto y adaptador) se borra si nada más la usa; se verifica con grep. | R1, R2, R5, R6 |
| D3 | `?vista=acondicionados_entregados` cae a la vista por defecto del rol, como cualquier vista que el rol no tiene. | R3 |
| D4 | Nada cambia para otros roles ni permisos. | R1, R7 |

## Requisitos (EARS)

**R1.** MIENTRAS el usuario tenga `acondicionamiento.modificar`, el sistema DEBE ofrecerle, por ese
permiso, solo las vistas `por_acondicionar` y `acondicionados`, en ese orden y en la misma posición
que hoy respecto a las demás vistas. Con los permisos del rol sembrado de acondicionamiento, las
vistas DEBEN ser exactamente `por_acondicionar` y `acondicionados`. [D2, D4]

**R2.** CUANDO el acondicionador entra a `/asignacion`, la página DEBE pintar exactamente dos
pestañas, «Por acondicionar» y «Acondicionados», cada una con su contador. NO DEBE pintar la pestaña
«Entregados» ni leer el número de pedidos entregados. [D2]

**R3.** SI cualquier usuario pide `/asignacion?vista=acondicionados_entregados`, ENTONCES la página
DEBE mostrar la vista por defecto de su rol, sin error y sin pestaña ni sección de entregados. Para
el acondicionador esa vista es «Por acondicionar». [D3]

**R4.** CUANDO el acondicionador abre la pantalla de acondicionamiento de un pedido `ENTREGADO` que
acondicionó él, la pantalla DEBE ofrecer el enlace «Volver a «Acondicionados»», que lleva a
`/asignacion?vista=acondicionados`. El resto de QC-219 R21 NO DEBE cambiar: la sección «Datos de
lote» sigue editable, no se ofrece «Acondicionar» ni «Terminar», y el `ENTREGADO` de otra persona
sigue dando 404. [D1]

**R5.** MIENTRAS un pedido esté `ENTREGADO`, NO DEBE aparecer en ninguna lista de `/asignacion` del
acondicionador. «Acondicionados» DEBE seguir listando solo los `TERMINADO` que acondicionó él. [D2]

**R6.** La fachada de asignaciones NO DEBE exponer un caso de uso que liste los `ENTREGADO`
acondicionados por el actor. El código `acondicionamiento.modificar` DEBE aparecer solo en las rutas
de producción que lo exigían antes de QC-219 R26, más el caso de uso de guardar los datos de lote.
[D2]

**R7.** MIENTRAS el usuario no tenga `acondicionamiento.modificar`, sus vistas de `/asignacion`
DEBEN ser las mismas que antes de esta feature. Los permisos y los roles sembrados NO DEBEN
cambiar, y la feature NO DEBE añadir migraciones. [D4]

**R8.** El sistema DEBE probar R1–R7 con tests unitarios y con los E2E existentes de
acondicionamiento ajustados. Esta feature NO DEBE añadir ninguna dependencia a `package.json`.

## Preguntas abiertas

Ninguna.
