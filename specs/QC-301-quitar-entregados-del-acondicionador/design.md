# QC-301 — quitar-entregados-del-acondicionador · design.md

## Lo que ya existe

- No hay otra feature ni spec que quite esta vista. QC-301 es la única que toca la vista; la añadieron
  QC-219 R20 y R21 (`specs/QC-219-datos-de-lote-en-acondicionamiento/requirements.md`).
- La vista entera viene de QC-219 D13. La ubicaron con grep (el grafo no se consultó).
  - Dominio:
    - `AssignmentViewKind` y `resolveAssignmentViews` en `lib/modules/asignaciones/domain/assignment-views.ts`;
    - el caso de uso `lib/modules/asignaciones/domain/list-delivered-conditioned-orders.ts`.
  - El caso de uso se exporta en `lib/modules/asignaciones/index.ts` y se cablea en
    `lib/composition/index.ts` (`listDeliveredConditionedOrders`).
  - UI:
    - la sección `delivered-conditioned-orders-list-section.tsx`, exportada en `components/index.ts`;
    - una entrada `acondicionados_entregados` en `assignment-view-tabs.tsx` (rótulo y testid);
    - una entrada en `assignment-view-tabs-section.tsx` (lector del contador);
    - una entrada en `conditioning-orders-empty.tsx` y otra en `conditioning-orders-skeleton.tsx`;
    - el tipo de la prop `view` de `conditioned-orders-table.tsx`;
    - la rama de `page.tsx`;
    - `backLink` de `conditioning-order-screen.tsx` (`backToDelivered`).
- **Puerto y adaptador: no se borra nada.** El caso de uso llama a
  `OrderCatalog.listAliveSummariesInCompany(..., ['ENTREGADO'], ..., { conditionedBy })`.
  - Ni ese método ni el filtro `conditionedBy` son exclusivos de este caso de uso:
    `list-conditioned-orders.ts:47` los usa para «Acondicionados».
  - Grep de `conditionedBy:` en `lib/`: solo esos dos casos de uso y el adaptador Prisma.
  - Por D2, el puerto y el adaptador se quedan; solo cae el caso de uso.
- `resolveAssignmentView` ya hace caer una vista no permitida a `allowed[0]`. Por eso R3 no pide
  código nuevo: basta con que la vista salga de la lista.
- `deliveredConditionedOrdersHref` ya no existe en producción. Solo sale en las listas de nombres
  prohibidos de `tests/guards/guard-asignacion-componentizada.test.ts` y
  `tests/unit/asignaciones-ui/assignment-hrefs.test.ts`, y ahí se queda.
- `components/shared/CATALOGO.md`: no tiene filas de estas piezas, que son locales de
  `app/(private)/asignacion/components/`. No se crea ningún componente; solo se borra uno. No hace
  falta tablero `/design`: no hay componente nuevo ni cambio visual nuevo, solo cae una pestaña.

## 1. Modelo de datos

- Sin cambios.
- Sin tablas, RLS ni migraciones: el filtro por `conditionedBy` y el estado `ENTREGADO` siguen como
  están. (R7)

## 2. Cambios

| Pieza | Cambio | R |
|---|---|---|
| `assignment-views.ts` | Sale `'acondicionados_entregados'` de `AssignmentViewKind` y del `push`; el comentario JSDoc se ajusta. | R1, R3, R7 |
| `list-delivered-conditioned-orders.ts` | Se borra. | R6 |
| `asignaciones/index.ts`, `composition/index.ts` | Salen la exportación y el cableado de `listDeliveredConditionedOrders`. | R6 |
| `delivered-conditioned-orders-list-section.tsx` | Se borra, con su exportación en `components/index.ts`. | R2, R5 |
| `assignment-view-tabs.tsx`, `assignment-view-tabs-section.tsx`, `conditioning-orders-empty.tsx`, `conditioning-orders-skeleton.tsx` | Sale la clave `acondicionados_entregados`. Son `Record` por vista, así que el typecheck obliga. | R2 |
| `conditioned-orders-table.tsx` | La prop `view` queda en `Extract<AssignmentViewKind, 'acondicionados'>`. Si ese tipo queda constante, se puede quitar la prop y usar `'acondicionados'` directo; lo decide el implementer. | R2 |
| `page.tsx` | Sale la rama `vista === 'acondicionados_entregados'` y su import. | R2, R3 |
| `conditioning-order-screen.tsx` | `backLink`: `ENTREGADO` usa la misma vuelta que `TERMINADO` (`acondicionados`, «Volver a «Acondicionados»»). Sale `backToDelivered`. | R4 |

- Sin cambios en el contrato I/O de las rutas.
- `/asignacion?vista=…` sigue aceptando cualquier cadena y cae a la vista por defecto.

## 3. Tests

**Tests unitarios que se ajustan:**

| Test | Ajuste |
|---|---|
| `assignment-views.test.ts` | El bloque QC-219 R20 se reescribe a R1/R3 (la vista ya no se ofrece y cae a la de por defecto). |
| `acondicionamiento-authorization.test.ts` | Línea 346: el rol devuelve exactamente dos vistas. |
| `assignment-view-counts.test.ts` | Sin la clave de entregados. |
| `assignment-hrefs.test.ts` | El caso `vista: 'acondicionados_entregados'` pasa a `acondicionados`. |
| `assignment-view-tabs.test.tsx` | Dos pestañas; no se llama al lector de entregados. |
| `asignacion-page.test.tsx` | El bloque «la tercera vista» pasa a R2/R3: dos pestañas y caída a «Por acondicionar». |
| `conditioning-order-screen.test.tsx`, `conditioning-order-page.test.tsx` | El caso `ENTREGADO` espera la vuelta a «Acondicionados» (R4). |
| `asignaciones-facade.test.ts` | Sale `listDeliveredConditionedOrders` de la lista de la fachada, junto con su caso R26 (R6). |
| `acondicionamiento-rol.test.ts` | Sale la ruta del caso de uso borrado; la cuenta de rutas baja de doce a once (R6). |
| `asignacion-acondicionamiento-paridad.test.tsx` y su `.snap` | Salen la lista y el esqueleto de entregados; la instantánea del `ENTREGADO` cambia el texto de la vuelta. |

**Se borran** `list-delivered-conditioned-orders.test.ts` y
`delivered-conditioned-orders-list-section.test.tsx`: prueban código que deja de existir.

**E2E: sí, pero solo se ajustan los specs existentes. No hace falta uno nuevo.**

- `e2e/acondicionamiento.spec.ts` (paso 1): espera dos pestañas, no tres. El pedido E
  (`ENTREGADO` propio) ya se siembra; el paso 4 ya comprueba que no sale en «Acondicionados» (R5).
  Se añade un paso:
  - `?vista=acondicionados_entregados` aterriza en «Por acondicionar» (R3).
- `e2e/operario-rediseno.spec.ts`: sale `TAB_TESTIDS.entregados` y su fila de la tabla esperada.
- R4 no se cubre en el E2E: no hay hoy un paso que abra el detalle de un `ENTREGADO`, y el unitario
  de pantalla lo cubre.

## 4. Mapa R → test

| R | Test |
|---|---|
| R1 | `assignment-views.test.ts`, `acondicionamiento-authorization.test.ts` |
| R2 | `asignacion-page.test.tsx`, `assignment-view-tabs.test.tsx`, `assignment-view-counts.test.ts`, `e2e/acondicionamiento.spec.ts`, `e2e/operario-rediseno.spec.ts` |
| R3 | `assignment-views.test.ts`, `asignacion-page.test.tsx`, `e2e/acondicionamiento.spec.ts` |
| R4 | `conditioning-order-screen.test.tsx`, `conditioning-order-page.test.tsx` |
| R5 | `e2e/acondicionamiento.spec.ts` (paso 4), `list-conditioned-orders` (sin cambios) |
| R6 | `asignaciones-facade.test.ts`, `acondicionamiento-rol.test.ts` |
| R7 | `assignment-views.test.ts` (roles sin el permiso no cambian); guardias en verde, sin migración |
| R8 | gate (typecheck + guardia de dependencias) |

## 5. Alternativa descartada

**Ocultar solo la pestaña y dejar viva la vista, el caso de uso y la sección.** Así, por
dirección, `?vista=acondicionados_entregados` seguiría abriendo la lista. Se descarta por dos
razones:

- contradice D2 (los `ENTREGADO` desaparecen y la consulta se borra si nada más la usa) y D3 (la
  vista cae a la de por defecto);
- deja código muerto con su permiso en la guardia de QC-219 R26.

## 6. Dependencias

Ninguna nueva. (R8)

## 7. Enmienda a QC-219

- R20 queda derogado y R21 enmendado en su enlace de vuelta.
- Se anota con fecha bajo QC-219 R20 y R21 (tasks T5). La tabla de decisiones de QC-219 no se toca.
