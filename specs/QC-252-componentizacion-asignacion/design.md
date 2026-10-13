# QC-252 — componentizacion-asignacion · design.md

## Lo que ya existe

**Términos buscados.** En el board (`feature_list.json`, todos los estados): «asignacion»,
«componentización», «CountdownGated», «order-responsibles», «Notice», «href». En `specs/` y
`progress/`: `QC-252`, `CountdownGatedButton`, `OrderDistributionFull`, `ConfirmActionDialog`,
`groupResponsiblesByOrigin`. En el código (grafo `codebase-memory-mcp` del worktree, que respondió,
y Grep): los siete puntos de la ficha por su nombre, `min-h-11`, `data-list`, `MISSING_VALUE_MARK`.

| Qué apareció | Dónde | Qué se hace |
| --- | --- | --- |
| QC-251 (`done`) deja el catálogo y nombra a QC-252 dueña de los duplicados de `/asignacion` | `specs/QC-251-catalogo-de-componentes/requirements.md` | Es esta ficha |
| QC-256 (`done`) ya llevó el mapa de estados a `lib/shared/ui/order-status.ts` (server-safe) y `COMPANY_ORDER_STATUS_LABELS` ya es alias suyo | `lib/shared/ui/order-status.ts`, `asignacion/components/company-orders-columns.tsx` | Parte del punto 4 ya está hecha. Se reutiliza el mapa; solo quedan los `statusLabel` locales (D6, P2) |
| QC-256 deja la adopción visual de `UrlTabs`, `ArrowLink`, `Notice` y `StatusBadge` en `/asignacion` a QC-265 | `specs/QC-256-piezas-compartidas-rediseno/design.md > Lo que ya existe` | No se adoptan aquí (D8, P4) |
| QC-232 (`done`) borró `ConfirmActionDialog`; su sitio es `ConfirmDialog`. `guard-formularios-y-acciones` impide que vuelva | `tests/guards/guard-formularios-y-acciones.test.ts` (regla `confirm-action-dialog`), `progress/deudas.md > D50` | La ficha choca con lo construido: el diálogo de terminar se basa en `ConfirmDialog` (D9, P1) |
| QC-232 dejó `AssignmentListEmpty`, `AssignmentListSkeleton` y `MissingValue` en la ruta, ya sobre `EmptyState`/`TableSkeleton`, para cuatro de las listas | `asignacion/components/assignment-list-parts.tsx` | Se reutilizan para las del acondicionador y para «Por empacar» (D2) |
| Deudas abiertas que son exactamente esta ficha | `progress/deudas.md > D42, D43, D47` | Se cierran (§ 10) |
| QC-265 (`pending`) rediseña el operario y depende de esta | `feature_list.json` | Lo visual queda para ella |
| `groupResponsiblesByOrigin` vive en un módulo `'use client'` de `/pedidos` | `app/(private)/pedidos/components/order-responsibles.tsx` | Sube a `lib/shared/ui/` (D5): la lista de equipo es de servidor |
| `orderDistributionFullText`, `OrderDistributionLabel` y la pantalla de empaque escriben cada uno la línea «N × envase» | `asignacion/components/order-distribution-full.tsx`, `components/shared/order-distribution-label.tsx`, `asignacion/empaque/[id]/components/packing-order-screen.tsx` | Una sola función de línea (D7) |
| Paridad de árbol accesible de las listas de asignación (QC-231/QC-232) | `tests/unit/paridad/asignacion-paridad.test.tsx`, `asignacion-listas-paridad.test.tsx`, `arbol-accesible.ts` | Se reutiliza el mismo mecanismo para congelar lo que falta (D14) |

**Filas de `components/shared/CATALOGO.md` consultadas y paso de la regla de decisión**
(`docs/perfil-agentes.md > Regla de decisión para componentes`):

| Pieza | Filas consultadas | Paso | Por qué no bastaba el anterior |
| --- | --- | --- | --- |
| Vacíos de las listas | `EmptyState` | 1 · reutiliza | Vía `AssignmentListEmpty` de la ruta |
| Esqueletos de las listas | `TableSkeleton`, `Skeleton`, `Table` | 1 · reutiliza | Vía `AssignmentListSkeleton` de la ruta |
| Mapa de estados | `ORDER_STATUS_LABELS` | 1 · reutiliza | — |
| Talla táctil | `touchTarget`, `Button`, `buttonVariants` | 1 · reutiliza | — |
| Error de candidatos | `ErrorAlert`, `UnexpectedErrorNotice` | 1 · reutiliza | — |
| Línea de reparto | `OrderDistributionLabel` | 2 · extiende | Exporta su función de línea; la pieza pinta igual |
| Diálogo de terminar | `ConfirmDialog`, `AlertDialog`, `Dialog` | 2 · extiende | Le faltan un control de confirmar propio y la clase del contenido (D9) |
| `CountdownGatedButton` | `CountdownTimer`, `Button`, `StepReader`, `SubmitButton` | sube (pieza existente) | No es nueva: se mueve sin cambiar su aspecto. Ninguna fila cubre «botón bloqueado por una cuenta atrás» (D10, P5) |
| Agrupado por origen y filtro por nombre | `ResponsibleAvatars`, `getInitials`, `avatarTone` | sube (lógica existente) | Ninguna fila agrupa ni filtra personas; se mueve la función que ya existe (D5) |
| Aviso de resultado (`OrderOutcomeNotice`) | `Notice`, `Alert`, `UnexpectedErrorNotice` | 4 · crea en la ruta | `Notice` cambia el aspecto (P4). Es la fusión de dos piezas de la ruta con el marcado de hoy: subcomponente interno sin UI visible nueva, exento del pase `/design` (`docs/perfil-agentes.md > Pase de diseño`) |

## 1. Principio: primero se congela y después se mueve

Nada de esta ficha cambia lo que ve o hace una persona. La prueba es la paridad de árbol
accesible (`tests/unit/paridad/arbol-accesible.ts`: roles, nombres, `aria-*`, `data-testid`,
`href`, `type`, `disabled`, `data-code`, `data-missing` y el conjunto ordenado de clases):

1. **Tanda 0**, sobre el código sin tocar: un archivo de paridad nuevo congela lo que las paridades
   de hoy no cubren (D14). Se commitea con sus snapshots **antes** de cualquier refactor.
2. Las tandas siguientes refactorizan. Un snapshot que cambia y no está en § 6 es un fallo de la
   tanda, no un snapshot que se actualiza.

## 2. Modelo de datos

No aplica: sin tablas, sin RLS, sin migraciones, sin cambios en `lib/modules/`. Ningún contrato de
módulo cambia.

## 3. Rutas y direcciones

Ninguna ruta nueva y ninguna dirección distinta. Equivalencia exacta (R1, R2):

| Hoy | Después | Salida |
| --- | --- | --- |
| `conditioningOrdersHref(p)` | `assignedOrdersListHref(p, 'por_acondicionar')` | `/asignacion?page=<p>&pageSize=<n>&vista=por_acondicionar` |
| `conditionedOrdersHref(p)` | `assignedOrdersListHref(p, 'acondicionados')` | `…&vista=acondicionados` |
| `deliveredConditionedOrdersHref(p)` | `assignedOrdersListHref(p, 'acondicionados_entregados')` | `…&vista=acondicionados_entregados` |
| `finishedOrdersHref(p)` | `assignedOrdersListHref(p, 'terminados')` | `…&vista=terminados` |
| `packingOrdersHref(page, size)` | `assignedOrdersListHref({ ...params, page }, 'por_empacar')` | `…&vista=por_empacar` |
| `BACK_HREF` | `assignmentViewHref('por_empacar')` | `/asignacion?vista=por_empacar` |

`assignedOrdersListHref` escribe `page`, `pageSize` y después `vista`, el mismo orden que el
`listHref` de `conditioning-orders-href.ts` y que los otros dos constructores: la cadena es
idéntica. Recibe `DataTableParams` completos; los llamadores ya los tienen (`{ ...params, page }` y el
`next` de `onParamsChange`). `ConditionedOrdersTable` cambia su mapa de constructores por
`(p) => assignedOrdersListHref(p, view)`; su prop `view` pasa a tiparse con `AssignmentViewKind`
acotado a sus dos vistas (`Extract<…>`), y `ConditioningListView` desaparece.

*Enmienda (review vuelta 1, M1):* `PackingOrderScreen` es de cliente y el barrel de
`asignacion/components` arrastra secciones de servidor. Por eso `empaque/[id]/page.tsx` (servidor)
importa `assignmentViewHref` por el barrel y pasa `backHref` a la pantalla como prop. La pantalla no
importa nada de `asignacion/components` y la dirección es la misma.

## 4. Decisiones

**D1 — Direcciones (punto 1, R1–R3).** Tabla de § 3. Se borra
`asignacion/components/conditioning-orders-href.ts` y sus exportaciones del barrel.

**D2 — Vacíos y esqueletos (punto 2, R4–R7).** Mismo patrón que dejó QC-232 para las otras listas:

- `ConditioningOrdersEmpty` se conserva con su firma (`list`, `firstPageHref`) y sus textos
  exportados, pero delega en `AssignmentListEmpty` con `testIdPrefix="conditioning-orders"`. Gana la
  entrada `acondicionados_entregados` en `CONDITIONING_ORDERS_EMPTY_TEXTS` con el texto de hoy
  (`DELIVERED_CONDITIONED_ORDERS_EMPTY_TEXT`, que se conserva como alias exportado), y
  `DeliveredConditionedOrdersListSection` deja de componer su `EmptyState` en línea.
- `ConditioningOrdersSkeleton` se conserva con su firma (`rows`, `list`; lo usa `page.tsx` como
  `fallback` y `asignacion-page.test.tsx` lo busca por tipo) y delega en `AssignmentListSkeleton`
  con `testId="conditioning-orders-skeleton"` y `rowTestId="conditioning-order-row-skeleton"`.
  Pierde `data-list` (§ 6).
- «Por empacar» pinta su vacío con `AssignmentListEmpty` y `testIdPrefix="packing-orders"`: el
  mensaje, el enlace y sus `data-testid` son los de hoy y el contenedor gana
  `packing-orders-empty` (§ 6). Cierra D47.
- *Enmienda (review vuelta 1, m4):* `CONDITIONING_ORDERS_PAGE_PAST_END_TEXT` y
  `CONDITIONING_ORDERS_FIRST_PAGE_TEXT` se borran: tras delegar, el texto sale de
  `assignment-list-parts.tsx` y esas constantes ya no gobernaban lo que se pinta.

**D3 — Paridad de vacíos.** Las clases del contenedor de hoy (`flex flex-col items-center gap-3
rounded-lg border border-dashed p-8 text-center`) son el `DEFAULT_CLASS_NAME` de `EmptyState`, y
`buttonVariants({ variant: 'outline' })` + el par táctil da el mismo conjunto de clases que
`buttonVariants({ variant: 'outline', touch: true })`. Los snapshots de vacío de acondicionamiento
no cambian.

**D4 — `data-list` se va.** Solo lo lee `asignacion-page.test.tsx:536`, y esa misma prueba ya
distingue la lista por el texto para lectores («Cargando pedidos entregados…» y no «…terminados…»).
La aserción del atributo se retira; las del texto se quedan.

**D5 — Agrupado y filtro de personas (punto 3, R8–R10).** Módulo nuevo `lib/shared/ui/responsible-groups.ts`,
sin `'use client'` y sin importar dominio (la regla de `lib/shared`):

```ts
export type ResponsibleOrigin =
  | { readonly kind: 'direct' }
  | { readonly kind: 'workGroup'; readonly workGroupId: string; readonly workGroupName: string };

export type ResponsibleGroup<T extends { readonly origin: ResponsibleOrigin }> =
  | { readonly kind: 'direct'; readonly responsibles: readonly T[] }
  | {
      readonly kind: 'workGroup';
      readonly workGroupId: string;
      readonly workGroupName: string;
      readonly responsibles: readonly T[];
    };

export function groupResponsiblesByOrigin<T extends { readonly origin: ResponsibleOrigin }>(
  items: readonly T[],
): readonly ResponsibleGroup<T>[];

export function filterByDisplayName<T extends { readonly displayName: string }>(
  items: readonly T[],
  search: string,
): readonly T[];
```

- El cuerpo de `groupResponsiblesByOrigin` es el de `order-responsibles.tsx`, sin cambios. El
  `groupTeamByOrigin` de `conditioning-team-list.tsx` da el mismo resultado (el orden de inserción del
  `Map` es el de la primera aparición), así que se borra y la lista de equipo usa el compartido.
- `filterByDisplayName`: búsqueda recortada y en minúsculas de configuración regional; vacía devuelve
  la lista entera. Es la lógica idéntica de `OrderResponsibles` y de `ConditioningTeamPicker`.
- `order-responsibles.tsx` importa las dos funciones y conserva sus exports: reexporta
  `groupResponsiblesByOrigin` y declara `type ResponsibleGroup = SharedResponsibleGroup<OrderResponsible>`,
  así el barrel de `/pedidos`, `order-route-contract.test.ts` y `order-responsibles.test.tsx` no
  cambian.
- Un test de tipos afirma que `AssignmentOrigin` y el `origin` de `ConditioningTeamMemberView` son
  asignables a `ResponsibleOrigin` y al revés, como hace el test del mapa de estados con sus claves.
- El marcado del selector no cambia (P3).

**D6 — Etiquetas de estado (punto 4, R11, R12).** `conditioning-order-screen.tsx` y
`packing-order-screen.tsx` borran su `statusLabel` y pintan `ORDER_STATUS_LABELS[order.status]`
(`OrderStatus` de pedidos y `OrderStatusKey` ya están igualados por el test de tipos del mapa). Para
los estados que cada pantalla puede recibir el texto es el mismo: «Por acondicionar», «En
acondicionamiento», «Terminado», «Entregado»; «Por empacar», «En empaque». Para un estado imposible
hoy se pintaba el código crudo y después su etiqueta (§ 6). `conditioning-orders-columns.tsx` pasa a
importar `ORDER_STATUS_LABELS` directamente en vez del alias de un módulo de cliente.

**D7 — Línea de reparto (punto 4, R13).** `components/shared/order-distribution-label.tsx` exporta
`orderDistributionLineText(line: OrderDistributionLabelLine): string`, la `lineText` que ya tiene.
`orderDistributionFullText` la usa para cada línea y pierde su `MISSING_NAME_MARK`; la pantalla de
empaque borra `distributionLineText` y la usa en cada `<li>`. `OrderDistributionFull` **se queda en
la ruta**: solo la usa `/asignacion` (`docs/architecture.md > Regla: sin sobre-ingenieria`), lo que
responde a la deuda D42.

**D8 — Aviso de resultado (punto 5, R15, R16).** `asignacion/components/order-outcome-notice.tsx`:

```ts
export type OrderOutcomeKind = 'packed' | 'conditioned';
export function OrderOutcomeNotice(props: { readonly kind: OrderOutcomeKind; readonly orderNumber: string }): JSX.Element;
```

Pinta el `<p role="status">` de hoy con las clases de hoy; `kind` decide el `data-testid`
(`packed-order-notice` / `conditioned-order-notice`) y el texto. El mismo archivo exporta
`PACKED_ORDER_NOTICE_TESTID`, `packedOrderNoticeText`, `CONDITIONED_ORDER_NOTICE_TESTID` y
`conditionedOrderNoticeText`, que siguen saliendo del barrel. Se borran `packed-order-notice.tsx` y
`conditioned-order-notice.tsx`; `page.tsx` pinta `<OrderOutcomeNotice kind=… />`.

**D9 — Diálogo de terminar (punto 5, R17, R18).** `FinishConditioningDialog` pasa a `ConfirmDialog`:

- `submit: { kind: 'action', action: formAction, hidden: [{ name: 'orderId', value: orderId, controlled: true }], formClassName: 'flex flex-col gap-4' }`;
- `layout: 'form-wraps-all'` (cabecera, campo oculto, error y pie dentro del `<form>`, el orden de hoy);
- `error`, `errorStyle: 'region'` (misma clase y `data-code`), `testIds` con los de hoy
  (`dialog`, `form`, `dismiss`, `error`), `dismissDisabled: isPending`;
- el `useActionState` y el `key` de cada apertura se quedan donde están (`ConfirmDialog` no guarda
  estado de la operación).

Dos extensiones de `ConfirmDialog`, opcionales y sin efecto si no se pasan (R18):

| Prop | Dónde | Para qué |
| --- | --- | --- |
| `contentClassName?: string` | `ConfirmDialogFrame` / `ConfirmDialog` | Conserva `max-h-[100dvh] overflow-y-auto` en el contenido |
| `confirmSlot?: ReactNode` | `ConfirmDialogBody` / `ConfirmDialog` | Sustituye al botón de confirmar del pie; quien lo pasa decide su `type`, `disabled` y `data-testid`. Aquí, `<CountdownGatedButton>` |

Se anotan en la fila de `ConfirmDialog` del catálogo. Lo que la paridad tiene que confirmar es que
«Cancelar» queda con el mismo `type` que hoy (hoy lo pone explícito); si `AlertDialogCancel` sin
`type` no da el mismo árbol, el diálogo lo pasa y no se acepta diferencia.

*Desviación en la implementación (review vuelta 1, m2).* El diálogo se compone con
`ConfirmDialogFrame` + `ConfirmDialogBody` —las piezas de la misma fila del catálogo— y no con
`ConfirmDialog` entero. Motivo: no mover el `useActionState` de sitio. Hoy vive en
`FinishConditioningForm`, dentro del contenido del diálogo; `ConfirmDialog` recibe `error` y el estado
de envío como props, así que el `useActionState` tendría que subir a `FinishConditioningDialog`, por
encima del marco. El reinicio por apertura no depende de esto (lo da el `key={opening}` de
`conditioning-actions.tsx`). El árbol es el mismo (paridad del diálogo idéntica). Con `confirmSlot`,
`testIds.confirm` no se pide (m3).

**D10 — `CountdownGatedButton` a `components/shared/countdown-gated-button.tsx` (punto 5, R19).**
Excepción declarada a «sube con la segunda ruta»: la pide la ficha y su tablero aprobado ya lo anuncia
(`docs/diseno/canvas/Dominio.dc.html`: «CountdownGatedButton (hoy en la ruta; sube a shared)»).
Consumidores identificados: `start-conditioning-dialog.tsx` y `finish-conditioning-dialog.tsx` (esta
ficha) y la pantalla de acondicionamiento de QC-265, que le pone el anillo.

```ts
export const COUNTDOWN_GATED_BUTTON_TESTID = 'countdown-gated-button';
export type CountdownGatedButtonProps = {
  readonly label: string;
  readonly seconds: number;
  readonly disabled?: boolean;
  readonly className?: string;
};
```

La espera deja de ser una constante de la pieza: `CONDITIONING_WAIT_SECONDS = 5` se queda en la ruta,
en `acondicionamiento/[id]/components/conditioning-wait.ts`, y sale de su barrel. Se borra la copia
de la ruta; el barrel de la ruta deja de exportar `CountdownGatedButton`,
`COUNTDOWN_GATED_BUTTON_TESTID` y `CountdownGatedButtonProps` (se importan de `components/shared`).
Fila nueva en Compuestos con `Diseño` = `docs/diseno/canvas/Dominio.dc.html` (P5) y `Alcance` que
dice que el anillo del tablero todavía no está.

**D11 — Talla táctil (punto 6, R21).**

| Archivo | Hoy | Después |
| --- | --- | --- |
| `assignment-view-tabs.tsx` | `TOUCH_TARGET = 'h-auto min-h-11 min-w-11 px-4 text-base'` | `cn(touchTarget, 'h-auto px-4 text-base')` |
| `conditioning-orders-columns.tsx` | `CONDITIONING_ORDER_LINK_CLASS` con el par | `cn(touchTarget, 'flex items-center underline-offset-4 hover:underline focus-visible:underline')` |
| `conditioning-order-screen.tsx` | `TOUCH_TARGET = 'min-h-11 min-w-11'` | `touchTarget` |
| `conditioning-orders-empty.tsx` | par literal en el enlace | desaparece con D2 |

El conjunto de clases es el mismo; la paridad compara clases ordenadas, así que el orden no cuenta.

**D12 — Lo que la guardia obliga a limpiar en los mismos archivos (R14, R20, R22).** Al retirar las
exclusiones D11/D7 de `/asignacion` la guardia vuelve a mirar esos archivos, y hoy darían:

- `conditioning-orders-columns.tsx`: `MISSING_VALUE_MARK = '—'` y su `MissingValue` local. Pasa a
  `MissingValue` de `assignment-list-parts.tsx` con `testIdPrefix="conditioning-order"`
  (`conditioning-order-missing-<campo>`, el mismo `aria-label` y `EMPTY_MARK`).
- `conditioning-order-screen.tsx`: compara con `UNEXPECTED_ERROR_CODE` para pintar el error de
  candidatos. Pasa a `ErrorAlert` con `className` de hoy, `testId`, `withDataCode`; da el mismo
  árbol (contenedor `div role="alert"`, `<p>` con el mensaje o `UnexpectedErrorNotice`).
- `order-distribution-full.tsx`: `MISSING_NAME_MARK = '—'`. Desaparece con D7.

**D13 — Enmiendas de guardias.** `tests/guards/guard-piezas-base.test.ts`:

- Los cinco archivos de `/asignacion` de `ARCHIVOS_D11` pasan a `D11_SIN_HALLAZGOS` (la guardia ya
  afirma ahí que `analizar` no da nada en ellos), salvo el barrel, que se queda con una exclusión
  estrecha `{ archivo: barrel, reglas: ['simbolo-borrado'], simbolo: 'MISSING_VALUE_MARK' }` (P6).
  `ARCHIVOS_D11` no cambia: R33 de QC-231 lo usa para su rama.
- `VACIOS_Y_ESQUELETOS_D7_PENDIENTES` queda vacía y su exclusión desaparece.
- Los motivos que citaban QC-232 → QC-217 para estos archivos se borran.

`tests/guards/guard-formularios-y-acciones.test.ts` no se enmienda: ningún archivo de
`NO_SE_TOCAN_R30` se borra y sus casos de diff solo corren en la rama de QC-232. Guardia nueva
`tests/guards/guard-asignacion-componentizada.test.ts` (TypeScript, no regex, como las demás) para
R3, R7, R9, R16 y R19: los símbolos y archivos borrados no vuelven, ningún vacío/esqueleto de la ruta
importa `Table`, `Skeleton` ni `next/link`, y solo hay una definición de los dos helpers de D5.

**D14 — Paridad nueva.** `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx` congela
en la tanda 0, con `arbolAccesible` y los mocks de `asignacion-listas-paridad.test.tsx`:

- vacío (primera página y página posterior) y esqueleto de «Por acondicionar», «Acondicionados» y
  «Entregados»;
- los dos avisos de resultado;
- el detalle de acondicionamiento en sus estados (con y sin equipo, con error de candidatos
  catalogado e inesperado, con datos de lote incompletos);
- la lista de equipo y el selector (sin selección, con búsqueda, grupo que no aporta nadie);
- el diálogo de terminar abierto, antes y después de la espera, y con error;
- la pantalla de empaque en sus tres desenlaces (Comenzar, Terminar, empaca otra persona) y con
  reparto vacío.

Las listas pobladas de las tres vistas del acondicionador ya las cubren sus tests de sección; si la
paridad de hoy no las congela, entran también.

## 5. Contratos que cambian

| Símbolo | Antes | Después |
| --- | --- | --- |
| `groupResponsiblesByOrigin` | en `pedidos/components/order-responsibles.tsx` (cliente), tipado a `OrderResponsible` | en `lib/shared/ui/responsible-groups.ts`, genérico; `/pedidos` lo reexporta |
| `filterByDisplayName` | — (lógica en línea en dos sitios) | `lib/shared/ui/responsible-groups.ts` |
| `orderDistributionLineText` | interna de `order-distribution-label.tsx` | exportada |
| `ConfirmDialog` | — | `contentClassName?`, `confirmSlot?` |
| `CountdownGatedButton` | ruta, espera fija de 5 s | `components/shared`, `seconds` obligatorio |
| `OrderOutcomeNotice` | `PackedOrderNotice`, `ConditionedOrderNotice` | una pieza con `kind` |
| `ConditioningOrdersEmpty` | pinta su `div` | delega; `list` admite `acondicionados_entregados` |
| `ConditioningOrdersSkeleton` | pinta su tabla con `data-list` | delega; sin `data-list` |

## 6. Diferencias de árbol aceptadas (R24)

Las únicas. Cualquier otra diferencia en un snapshot de paridad es un fallo:

| Dónde | Diferencia | Por qué se acepta | Requisito |
| --- | --- | --- | --- |
| Vacío de «Por empacar» (3 snapshots en `asignacion-listas-paridad`, 2 en `asignacion-paridad`: primera página y página posterior) | el contenedor gana `data-testid="packing-orders-empty"` | Es un gancho de test sin efecto para nadie; lo llevan las otras cuatro listas y hacer opcional el `testId` de `EmptyState` solo para esta empeoraría la pieza (A2) | R5 |
| Esqueletos del acondicionador | sin `data-list` | `arbolAccesible` no lo captura; solo lo leía una aserción unitaria (D4) | R6 |
| Estado del detalle con un estado imposible | etiqueta en vez del código crudo | No se alcanza con los datos que devuelven `getConditioningOrder` y `getPackingOrder` | R12 |

Ningún E2E cambia una aserción (R25). El único E2E que se toca es
`e2e/datos-de-lote-en-acondicionamiento.spec.ts`, y solo en sus `import`: `CONDITIONING_WAIT_SECONDS`
(`conditioning-wait.ts`), `COUNTDOWN_GATED_BUTTON_TESTID` (`components/shared/countdown-gated-button`)
y el aviso (`order-outcome-notice`).

## 7. Tests que se tocan sin cambiar lo que afirman

| Test | Cambio |
| --- | --- |
| `tests/unit/asignaciones-ui/conditioning-orders-list-section.test.tsx` | importa `assignedOrdersListHref` en vez de los constructores borrados; mismas cadenas esperadas |
| `tests/unit/asignaciones-ui/delivered-conditioned-orders-list-section.test.tsx` | ídem |
| `tests/unit/asignaciones-ui/asignacion-page.test.tsx` | retira la aserción de `data-list` (D4); busca `OrderOutcomeNotice` donde buscaba los dos avisos, si lo hace |
| `tests/unit/asignaciones-ui/conditioned-order-notice.test.tsx`, `packed-order-notice.test.tsx` | renderizan `OrderOutcomeNotice` con su `kind`; `encontrarPorTipo` busca `OrderOutcomeNotice` y comprueba `kind` |
| `tests/unit/asignaciones-ui/countdown-gated-button.test.tsx` | se mueve a `tests/unit/shared/countdown-gated-button.test.tsx` e importa de `components/shared` pasando `seconds` |
| `tests/unit/asignaciones-ui/finish-conditioning-dialog.test.tsx`, `start-conditioning-dialog.test.tsx` | `COUNTDOWN_GATED_BUTTON_TESTID` desde `components/shared` |
| `tests/unit/paridad/__snapshots__/asignacion-listas-paridad.test.tsx.snap`, `asignacion-paridad.test.tsx.snap` | solo la diferencia de R5 |
| `tests/guards/guard-piezas-base.test.ts` | D13 |

La tarea T0b de `tasks.md` hace el censo con grep antes de tocar nada, para que ninguna guardia ni
test que nombre un archivo o símbolo borrado se quede roto (lección de QC-256).

## 8. Alternativas descartadas

- **A1 — Adoptar `Notice` en los avisos.** Cambia el elemento (`div` con icono), los tokens de color y
  añade la animación de entrada: es un cambio visual y es de QC-265. Aquí rompería R24.
- **A2 — Hacer opcional el `testId` de `EmptyState`** para que el vacío de «Por empacar» no cambie de
  árbol. Debilita una pieza compartida para un único consumidor, y deja una lista sin el gancho que
  tienen las otras cuatro. Se acepta la diferencia de R5.
- **A3 — Llevar `groupResponsiblesByOrigin` al dominio de `asignaciones`.** Agrupar para pintar no es
  una regla del dominio y el barrel del módulo acabaría exportando ayudas de presentación. Un
  genérico estructural en `lib/shared/ui/` no importa dominio, y el test de tipos ata su forma a la
  del módulo.
- **A4 — Pintar el reparto de empaque con `OrderDistributionFull`.** Cambiaría la lista de `<li>` por
  un `<span>` unido con « / » y rompería los E2E que leen `packing-order-presentation-line`. Se
  unifica la función de línea, no el marcado.
- **A5 — Un único selector de personas compartido** por el panel de responsables y el de equipo.
  Sus marcados, ids, `data-testid`, pistas por grupo y campos ocultos difieren y los leen E2E de las
  dos pantallas; unificarlos es un cambio visual con pase `/design` (P3).
- **A6 — Extender `TableSkeleton` con atributos `data-*`** para conservar `data-list`. Un punto de
  extensión cuyo único lector es una aserción unitaria que ya tiene otra forma de distinguir la lista.
- **A7 — Conservar `PackedOrderNotice` y `ConditionedOrderNotice` como preajustes** de la pieza
  única. Dejaría dos componentes con nombre propio, que es lo que la ficha pide quitar (R16).

## 9. Riesgos y coordinación

- **Archivos compartidos con otras fichas en vuelo:** `components/shared/CATALOGO.md` (cualquier ficha
  que suba o extienda una pieza; hoy QC-260 está en vuelo) y `app/(private)/pedidos/components/`
  (QC-224 en vuelo). `scripts/archivos-en-vuelo.mjs` lo comprueba con la sección `Archivos esperados`;
  el catálogo se toca insertando filas en su sitio, que es lo que lo hace fusionable (QC-251).
- **`'use client'` y servidor:** `ConditioningTeamList` es de servidor; importar el agrupado desde el
  módulo de cliente de `/pedidos` daría una referencia de cliente, no una función. Por eso D5 lo sube
  a un módulo sin directiva.
- **Paridad del diálogo:** el `type` de «Cancelar» (D9) es el punto a vigilar.

## 10. Deudas que cierra

- **D42** (`OrderDistributionFull` sin mover): se queda en la ruta por la regla de la segunda ruta;
  su marca local desaparece y la guardia deja de excluirlo.
- **D43** (acondicionamiento sin parametrizar): resuelta por D2, D11, D12 y D13.
- **D47** (vacío de empaque en línea): resuelta por D2.

`progress/deudas.md` las marca resueltas con la fecha y esta ficha.

## Dependencias de terceros

Ninguna nueva.
