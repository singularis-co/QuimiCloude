# QC-246 — contactos-con-chat · design.md

Zona `frontend`: ninguna Server Action, tabla, RLS ni migración nueva. Todo lo de datos lo entrega
QC-245 (y QC-240 para enviar y reintentar).

## Lo que ya existe

Buscado en el board (`feature_list.json`, todos los estados) por «chat», «conversación»,
«contactos», «whatsapp», «mensaje»; en `specs/` por `contactos`, `WhatsappChat`,
`getWhatsappChatAction`; en el código por `visibilitychange`, `IntersectionObserver`,
`whatsapp-conversation-actions`, `wa-bubble`, `whatsapp-system-constants`, `CUSTOMER_CONTACTS`.
El grafo **no tiene indexado** este worktree (`list_projects` no lo lista): la búsqueda de código se
hizo con Grep/Read.

| Qué apareció | Dónde | Qué se hace |
|---|---|---|
| QC-244: placeholder de Contactos | `app/(private)/clientes/contactos/page.tsx`, `components/contact-texts.ts`, `CUSTOMER_CONTACTS_ROUTE`, `CUSTOMER_CONTACTS_LABEL`, hijo `nav-clientes-contactos` en `lib/shared/navigation/private-nav.ts` | Se **reutilizan** ruta, etiqueta y testids; la página cambia de permiso (`clientes.consultar` → `whatsapp.consultar`) y de contenido. |
| QC-245: contrato de la pantalla, **versión 2** (Enmienda 1, 2026-10-23) | tarjeta de QC-246 (bloque `contrato-QC-245`) y `.worktrees/QC-245-…/specs/QC-245-contactos-whatsapp-backend/design.md > Contrato para la pantalla (QC-246)` | Se **consume** tal cual (sección 3), incluidos `getWhatsappChatContextAction`, `attachment.mediaUrl` y las reacciones por id interno. Aún no está en `dev`: la ficha arranca F2 cuando QC-245 mergee. |
| QC-240: `sendWhatsappMessageAction`, `retryWhatsappMessageAction` | `lib/modules/integraciones/adapters/driving/whatsapp-message-actions` | Se **consumen**. |
| QC-239: «Botones de vincular, desvincular y bloquear en el chat: QC-246» | descripción de QC-239 > Lo que NO entra | **No** está en el alcance de QC-246: va a **QT-299** (chat-vincular-bloquear-contacto, depende de QC-246) (`requirements.md > D12`). |
| QC-243: `WaBubble` (vista previa de plantilla con su marco «Vista previa») | `app/(private)/integraciones/whatsapp/components/wa-bubble.tsx`, tablero `docs/diseno/canvas/WaBurbuja.dc.html` | Se **reutiliza** en la vista previa del diálogo «Enviar plantilla» (R31). Al necesitarla una segunda ruta **sube** a `components/shared/wa-bubble.tsx` con su fila (sección 6). No sirve para las burbujas del chat: es un marco de vista previa (`min-h-80`, título, fondo), sin estado, autor ni tipos. |
| QC-243: `SYSTEM_CONSTANTS`, `constantLabelsForBackend()` | `app/(private)/integraciones/whatsapp/components/whatsapp-system-constants.ts` (importadores: `whatsapp-variables-panel.tsx`, `whatsapp-variable-rules.ts`, `whatsapp-template-rules.ts`, `whatsapp-template-form-sheet.tsx`, `whatsapp-template-relate-sheet.tsx`, `whatsapp-template-table.tsx`) | Se **reutiliza** para las constantes y sus etiquetas (`constantLabels`) y se **extiende** con las cuatro `pedido.*` nuevas (D14, sección 6.1). Un archivo `'use client'` no puede importar de otra ruta (`docs/architecture.md`, tabla de dependencias): **sube** a `lib/shared/ui/whatsapp-system-constants.ts` (sección 6). Todo lo demás de QC-243 (panel, diccionario, validación de claves propias) sale de `SYSTEM_CONSTANTS`, así que aprende las nuevas sin cambios de código. |
| QC-137: `createPollingFeed`, `browserVisibility`, `browserTimers` (campana) | `app/(private)/components/notifications/notification-feed.ts` | Se **copia el patrón** (siguiente turno al terminar la consulta, pausa con la pestaña oculta, puertos inyectables), no el código: está atado a los tipos de notificaciones. Alternativa descartada 3. |
| `EntityImage` (miniatura con `<img>`, `onError` → marcador, zoom en `Dialog`) | `components/shared/entity-image.tsx` | Se **copia el patrón** (`<img>` con `eslint-disable` razonado, estado de fallo, `loading="lazy"`) en `chat-media-image.tsx`, no la pieza: alternativa descartada 9. |
| Lista de Clientes y su celda de acciones | `app/(private)/clientes/page.tsx`, `components/customer-columns.tsx`, `customer-table.tsx`, `customer-list-section.tsx`, `customer-row-actions.tsx` | Se **extiende** con «Abrir chat» (R45). |
| Polling, scroll infinito o chat en otra pantalla | — | Buscado `IntersectionObserver`, `chat`: nada. |

**Catálogo consultado** (`components/shared/CATALOGO.md`) y paso de la regla de decisión:

| Necesidad | Pieza | Paso |
|---|---|---|
| Iniciales y color del cliente | `Avatar` (`tone`), `getInitials`, `avatarTone` | 1 · reutiliza |
| Buscador | `Input` | 1 |
| Estados vacíos (sin conexión, sin conversaciones, sin búsqueda, sin selección) | `EmptyState` (`icon`, `heading`, `clearSearch`, `children` para el enlace) | 1 |
| Errores de carga y de envío | `ErrorState` (con `retry`), `ErrorAlert` | 1 |
| Aviso de ventana cerrada | `Notice` (`tone="warning"`) | 1 |
| Insignia de ventana | `Badge` (`success` / `neutral`) | 1 |
| Selector «Pedido» y selector de plantilla | `SharedSelectControl` (talla táctil, 16 px) | 1 |
| Despliegue del detalle del pedido | `Collapsible` | 1 |
| Diálogo «Enviar plantilla» y visor de imagen | `Dialog` (`DialogContent` con `showCloseButton={false}` y cierre propio de 44 px) | 1 |
| Vista previa de la plantilla | `WaBubble` | 1 (sube a shared) |
| Caja de texto | `Textarea` (16 px en móvil) | 1 |
| Botones, burbujas de plantilla, «Reintentar», «Volver» | `Button` (`touch`), `touchTarget` | 1 |
| Indicador «Cargando…» | `Spinner` | 1 |
| Estado del pedido en el detalle | `ORDER_STATUS_LABELS` (`lib/shared/ui/order-status.ts`; cubre los ocho estados abiertos de `WhatsappCustomerOrder.status`) | 1 |
| Presentación × cantidad | `orderDistributionLineText({ presentationName, packages: ordered })` → «10 × Bidón 20 L» (sin nombre: «10 × —») | 1 |
| Recuadro de un valor que falta en el detalle | `EMPTY_MARK` | 1 |
| Enlace «Abrir chat» con forma de botón | `buttonVariants` | 1 |
| Burbuja de mensaje (entrante / saliente / fallida, autor, hora, estado), reacción pegada, tarjeta de ubicación, recuadro de imagen / sticker, separador de día, burbujas de plantillas, pantalla de dos columnas | — | **4 · crear en la ruta**: no hay ninguna pieza de chat en el catálogo, y `WaBubble` es un marco de vista previa (ver arriba). Todas viven en `app/(private)/clientes/contactos/components/` (una sola ruta las usa). |

## Referencia de diseño

Pase `/design` del 2026-10-23, canvas https://claude.ai/artifact/CyD47oYVAwQhjVWTDtQLFX
(`progress/features/QC-246.md > Decisiones`). Los siete tableros **ya están copiados** en
`docs/diseno/canvas/` (`requirements.md > D10`; paso 4 de `docs/diseno/README.md > Flujo /design`).
Se renombraron con el prefijo de la pantalla porque el `Main` del canvas choca con el
`docs/diseno/canvas/Main.dc.html` que ya existe:

| Tablero del canvas | Copia en `docs/diseno/canvas/` | Qué fija |
|---|---|---|
| Main | `Contactos.dc.html` | Escritorio, ventana abierta: lista, cabecera, todos los tipos de mensaje, estados, fallido con «Reintentar», visor de imagen. |
| Plantilla | `ContactosVentanaCerrada.dc.html` | Ventana cerrada: aviso, caja deshabilitada, diálogo «Enviar plantilla» con selector de pedido y vista previa. |
| NuevoChat | `ContactosNuevoChat.dc.html` | Chat sin mensajes: burbujas de plantillas, selector «Pedido», flecha y detalle del pedido. |
| Vacios | `ContactosVacios.dc.html` | «WhatsApp no está conectado», «Aún no hay conversaciones», «Abrir chat» desde Clientes. |
| MovilLista | `ContactosMovil.dc.html` | Teléfono: lista. |
| MovilChat | `ContactosChatMovil.dc.html` | Teléfono: chat, banda de ventana bajo la cabecera, visor con flecha de volver. |
| MovilNuevoChat | `ContactosNuevoChatMovil.dc.html` | Teléfono: chat sin mensajes con burbujas que bajan de línea. |

Faltan los tableros de tablet y la ficha por plataforma de los `…Movil` (`requirements.md > P11`).
En tablet (768–1023 px) se usa la disposición de escritorio con la lista a 320 px.

Los datos de los tableros son ficticios (nombres, «[motivo devuelto por WhatsApp]», «$ 412,50»…).

## 1. Qué cambia (resumen)

1. `/clientes/contactos` exige `whatsapp.consultar` y pinta la pantalla de dos columnas (R1–R47,
   R49, R54).
2. El hijo «Contactos» del menú declara `whatsapp.consultar` (R2).
3. La lista de Clientes gana «Abrir chat» / «Sin teléfono válido» (R45).
4. `WaBubble` sube a `components/shared/` y `whatsapp-system-constants` a `lib/shared/ui/`, cada uno
   con su fila del catálogo; sus archivos viejos quedan como reexportación (alternativa descartada 4).
5. El catálogo de constantes aprende `pedido.estado`, `pedido.fecha_solicitud`, `pedido.total` y
   `pedido.detalle` (R50–R53, sección 6.1).
6. Ningún cambio en `lib/modules/**`, `db/**` ni `lib/composition/**` (R48).

## 2. Modelo de datos

**No hay.** Sin tablas, sin RLS, sin migraciones: los datos los leen y escriben las Server Actions
de QC-245 y QC-240, que validan permiso y empresa en el caso de uso. El aislamiento por empresa y
los permisos de lectura (`whatsapp.consultar`) y envío (`whatsapp.enviar`) son de esas acciones; la
pantalla solo **oculta** lo que la sesión no puede hacer (R2, R3, R45, R47) y corta la página con
`requirePagePermission` (R1).

Estado de la pantalla, todo en el cliente salvo la selección, que vive en la URL:

| Parámetro | Significado |
|---|---|
| `?cliente=<customerId>` | Abrir el chat de ese cliente (R46). Lo escribe «Abrir chat». |
| `?contacto=<contactId>` | Conversación seleccionada (R14). Lo escribe la lista. |

Con los dos, gana `contacto`. Cambiar de conversación usa `window.history.pushState` (Next lo
sincroniza con `useSearchParams`), así que no hay viaje al servidor y «Atrás» del navegador vuelve a
la lista en teléfono (R6). La búsqueda no va a la URL: es estado del componente.

## 3. Contrato consumido (QC-245 v2 + QC-240)

Tipos exactos en `specs/QC-245-contactos-whatsapp-backend/design.md > Contrato para la pantalla`
(**versión 2**, Enmienda 1); aquí solo cómo se usa cada acción. Todas se importan por su ruta exacta;
los DTO (`WhatsappChat`, `WhatsappChatMessage`, `WhatsappChatAttachment`, `WhatsappChatContext`,
`WhatsappCustomerOrder`, `WhatsappSendableTemplate`…), de `@/lib/modules/integraciones`.

| Acción | Cuándo | Con qué | Requisitos |
|---|---|---|---|
| `listWhatsappConversationsAction` | Servidor, primera página. Cliente: búsqueda, página siguiente, consulta periódica (página 1). | `{ search, page, pageSize: 25 }` (`blocked` sin mandar = `'all'`) | R3, R8–R13, R42 |
| `getWhatsappChatAction` | Servidor si hay selección en la URL. Cliente: abrir otra conversación, anteriores (`before = nextCursor`), consulta periódica (sin `before`, se une por `id`). | `{ target: { contactId } \| { customerId }, before?, pageSize: 30 }` | R15–R26, R46 |
| `markWhatsappChatReadAction` | Tras abrir un chat con `contact` y tras una consulta que trae entrantes nuevos con la pestaña visible. | `{ contactId, upToMessageId: <último mostrado> }` | R27, R28 |
| `listSendableWhatsappTemplatesAction` | Servidor, una vez por carga de página (las plantillas son de la empresa, no del chat). | — | R31, R33 |
| `getWhatsappChatContextAction` | Servidor si hay selección en la URL; cliente al abrir otra conversación y al cambiar el selector «Pedido». **Nunca** en la consulta periódica. | `{ target }` al abrir; `{ target, orderId }` al cambiar de pedido. `target` = el mismo del chat (`{ contactId }` o `{ customerId }`) | R35, R38, R39, R54 |
| `GET /api/integraciones/whatsapp/media/<messageId>` | No se llama a mano: `attachment.mediaUrl` va tal cual como `src` del `<img>` de la miniatura, del sticker y del visor. | — | R21, R22 |
| `sendWhatsappMessageAction` | Enviar texto o plantilla. | Texto: `{ kind: 'text', recipient, text }`. Plantilla: `{ kind: 'template', recipient, templateId, constants, constantLabels }`, con `constants` sacado de `context.values` (sección 4) | R29, R32, R36, R37, R40 |
| `retryWhatsappMessageAction` | «Reintentar». | `{ messageId }`; en plantilla, además `constants` y `constantLabels` de los `values` del pedido elegido **ahora** | R41 |

`recipient` = `{ contactId }` si el chat tiene `contact`; si no, `{ customerId }`. Tras enviar a un
`customerId`, el chat se vuelve a pedir por `{ customerId }` y pasa a su `contact.id` (R37; QC-245
§A: «el chat siguiente se pide ya por `contactId`»).

Respuestas que la pantalla distingue:

- `status: 'success'` con `data.status === 'FAILED'` → saliente fallido con `errorReason` (R19).
- `status: 'missing_values'` → se muestra `message`, no se añade saliente (R36).
- `status: 'error'` → `ErrorAlert`; `code: 'unauthorized'` en la consulta periódica la para (R44).
- Contexto: error en la carga inicial → `ErrorState` con «Reintentar» en la zona del pedido (R4);
  error al cambiar de pedido (`order_not_found` u otro) → `ErrorAlert` junto al selector y se
  conserva el contexto anterior (R54).
- `connectionStatus: null` → estado «WhatsApp no está conectado» (R3). La página lo decide con el
  listado; el contexto por cliente sin conexión llega vacío sin error y no se usa.
- `<img>` con evento `error` (502 de la ruta, red) → recuadro «Imagen no disponible» (R21, R22).

## 4. Tipos locales de la pantalla

La pantalla **no** pinta los DTO directamente: los pasa por adaptadores puros de la ruta a tipos
propios. Con el contrato v2 ya no hay defaults provisionales (A1–A5 cerradas, D13); los adaptadores
siguen siendo el único punto que conoce la forma del backend, así que un cambio futuro del contrato
(p. ej. `total` con valor cuando entre QC-307) toca solo esta capa.

```ts
// chat-view.ts — tipos de la ruta, no del backend
type ChatMessageView = {
  id: string;
  side: 'in' | 'out';
  at: string;                                   // ISO
  author: { kind: 'user'; name: string | null } | { kind: 'system' } | null;   // null en entrantes
  delivery: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | null;      // null en entrantes
  errorReason: string | null;
  retryable: boolean;                           // FAILED && origin USER
  content:
    | { kind: 'text'; text: string }
    | { kind: 'image'; src: string | null; caption: string | null }        // src = attachment.mediaUrl
    | { kind: 'sticker'; src: string | null }                               // src = attachment.mediaUrl
    | { kind: 'location'; latitude: number; longitude: number; name: string | null; address: string | null }
    | { kind: 'label'; label: '[Audio]' | '[Video]' | '[Documento]'; caption: string | null }
    | { kind: 'unsupported' };
  reaction: { emoji: string } | null;           // la reacción vigente pegada a este mensaje
};

type ChatOrderView = {
  id: string;
  number: string;
  statusLabel: string;                          // ORDER_STATUS_LABELS[status] (decisión E2)
  productName: string | null;
  totalLabel: string | null;                    // null → la fila no se pinta (D16)
  lines: readonly { key: string; ordered: string; delivered: number; pending: number }[];
};                                              // ordered = «10 × Bidón 20 L»; sin fecha de entrega (D15)

type ChatContextView = {
  orders: readonly ChatOrderView[];             // abiertos, el más reciente primero
  selectedOrderId: string | null;
  values: Readonly<Record<string, string | null>>;   // = context.values, sin tocar
};
```

Adaptadores (puros, con test cada uno):

- `toChatMessages(messages)` — de `WhatsappChatMessage[]` a `ChatMessageView[]`: traduce tipo y
  estado (R19, R20), toma `src` de `attachment.mediaUrl` en `IMAGE` y `STICKER` (R21, R22), aparta
  las `REACTION` y las pega al mensaje con `id === attachment.messageId` (R24): por objetivo gana la
  de `at` más reciente; `emoji: null` la quita; `messageId: null` o un objetivo que aún no está en
  la lista no pinta nada. Se aplica sobre **toda** la línea de tiempo unida (`chat-timeline.ts`), así
  que una reacción cuyo objetivo llega con «anteriores» aparece al cargarlo.
- `toChatContext(context)` — de `WhatsappChatContext` a `ChatContextView`: mapea `orders` (estado
  con `ORDER_STATUS_LABELS`, línea con `orderDistributionLineText({ presentationName, packages:
  ordered })`, `delivered`, `pending`; `total` tal cual) y deja `values` sin cambios (R38, R39).
- `resolveTemplate(template, values)` — reemplaza cada `{{clave}}` de `content.header.text`,
  `content.body.text` y `content.footer` con `values[clave]`; si no está o es `null`, sale
  `[falta <clave>]` (R35, D16). Devuelve `{ header, body, footer, text, missing: { key, label }[] }`;
  `label` sale de `SYSTEM_CONSTANTS` para las constantes (por eso hacen falta las cuatro nuevas,
  sección 6.1) y de `variables[].label` para las propias (si es `null`, la clave). `text` (lo que va
  en la caja, R33) = encabezado, cuerpo y pie no vacíos separados por una línea en blanco.
- `systemConstantsFor(template, values)` — las claves `kind: 'system'` de la plantilla con valor no
  nulo en `values`: es el `constants` del envío y del reintento. `constantLabels` =
  `constantLabelsForBackend()`. Las propias **no** se mandan: el back pone su valor guardado (contrato
  v2 §A).

Con `missing` no vacío el botón de envío de la plantilla queda deshabilitado y se muestra
«Falta el valor de A» / «Falta el valor de A, B y C» (mismo formato que el `missing_values` de
QC-245) (R36). Hasta QC-307 toda plantilla con `{{pedido.total}}` queda bloqueada, y sin pedidos
abiertos lo quedan todas las que usan `pedido.*`: es el comportamiento correcto (QC-245 la rechazaría
igual con `missing_values`).

**Decisiones de este spec sobre el contrato v2:**

- **E1 — `pedido.total` nulo en una plantilla → `[falta pedido.total]`, no «—».** El contrato v2
  dice que un `null` se pinta `[falta <clave>]`, y un «—» dentro del texto de una plantilla parecería
  un valor enviable; el envío además lo rechazaría. En el **detalle** del pedido, en cambio, la fila
  del total se oculta mientras sea `null` (D11 de QC-245: «la pantalla lo oculta si es nulo») (D16).
- **E2 — El estado del detalle usa `ORDER_STATUS_LABELS` (los nombres internos de Pedidos), no
  `values['pedido.estado']`.** El detalle lo lee el usuario de la empresa, que conoce «Por empacar» o
  «Bloqueado»; `pedido.estado` está en lenguaje del cliente (cuatro etiquetas, D15 de QC-245) y es lo
  que sale en la plantilla. Cada uno ve su lenguaje; ninguno se recalcula en el front.
- **E3 — Sin fecha de entrega.** `WhatsappCustomerOrder` no la trae y el detalle no la pinta (D15).
  Tampoco se pinta `requestedAt` en el detalle: no está en el alcance de la tarjeta; queda disponible
  en la plantilla como `pedido.fecha_solicitud`.
- **E4 — El contexto no entra en la consulta periódica** (contrato v2 §D): un pedido nuevo del
  cliente aparece al reabrir el chat. Es aceptable porque el selector solo cambia el texto de las
  plantillas.

## 5. Ruta y componentes

```
app/(private)/clientes/contactos/
  page.tsx                         ← servidor: corte, permisos de presentación, carga inicial
  components/
    index.ts                       ← barrel (sin 'use client')
    contact-texts.ts               ← textos y testids de la pantalla
    contacts-screen.tsx            ← 'use client': dos columnas / una, selección en la URL, poller
    conversation-list.tsx          ← buscador, lista, centinela de «Cargando más…», vacíos
    conversation-list-item.tsx     ← avatar, nombre, teléfono, vista previa, hora, no leídos
    chat-panel.tsx                 ← cabecera + detalle + historial + caja; estados vacío / error
    chat-header.tsx                ← volver (teléfono), nombre, teléfono, ventana, pedido + flecha
    chat-window-badge.tsx          ← «Ventana abierta · se cierra en …» / «Ventana cerrada»
    chat-order-detail.tsx          ← Collapsible con el detalle del pedido elegido
    chat-message-list.tsx          ← historial, separadores de día, centinela de anteriores, scroll
    chat-message.tsx               ← burbuja por tipo, autor, hora, estado, fallido + Reintentar
    chat-message-status.tsx        ← iconos ✓ / ✓✓ / reloj con nombre accesible
    chat-location-card.tsx         ← tarjeta de ubicación con «Abrir en el mapa»
    chat-image-viewer.tsx          ← Dialog a pantalla completa; «Imagen no disponible» si falla la carga
    chat-media-image.tsx           ← <img src={mediaUrl}> con recuadro «[Imagen]»/«[Sticker]» o «Imagen no disponible»
    chat-composer.tsx              ← caja + enviar / aviso de ventana cerrada + «Enviar plantilla»
    chat-template-chips.tsx        ← burbujas de plantillas (aria-pressed), con flex-wrap
    send-template-dialog.tsx       ← Dialog con selectores y WaBubble
    contacts-empty-states.tsx      ← sin conexión, sin conversaciones, sin búsqueda, sin selección
    chat-view.ts                   ← tipos locales, toChatMessages, toChatContext (sección 4)
    template-values.ts             ← resolveTemplate, systemConstantsFor, texto «Falta el valor de …»
    chat-timeline.ts               ← unir por id, ordenar, agrupar por día, anteriores sin duplicar
    conversation-list-state.ts     ← unir páginas sin duplicar, fusionar la página 1 del poller
    chat-time-format.ts            ← hora de la lista (R10), separador de día (R17), cuenta atrás (R15)
    contacts-poller.ts             ← bucle de consulta con puertos de visibilidad y temporizador
    use-end-sentinel.ts            ← IntersectionObserver del final / inicio (R13, R25)
```

### 5.1 `page.tsx` (servidor)

1. `await requirePagePermission('whatsapp.consultar')` en la primera línea (R1).
2. `canSend` (`whatsapp.enviar`) y `canOpenIntegrations` (`integraciones.modificar`) con
   `assertPermission`, como `canModifyCustomers` en `app/(private)/clientes/page.tsx`: presentación,
   no autorización (R3, R47).
3. Resuelve `searchParams` (`cliente`, `contacto`) **después** del corte.
4. En paralelo: lista (página 1), plantillas enviables y, si hay selección, el chat y su contexto
   (`getWhatsappChatContextAction({ target })`, R54).
5. `connectionStatus === null` → solo el vacío «WhatsApp no está conectado» (R3).
6. Pasa todo por props a `ContactsScreen`. Usa `PageShell` + `PageHeader` como hoy; el contenedor de
   dos columnas mide `calc(100dvh - <cabecera>)` (nunca `100vh`).

### 5.2 Consulta periódica (`contacts-poller.ts`)

- `CONTACTS_POLL_INTERVAL_MS = 8_000` (R42). El siguiente turno se programa **al terminar** la
  consulta (no `setInterval`), como `createPollingFeed`: un servidor lento no acumula consultas.
- Cada turno: lista página 1 con la búsqueda vigente y, si hay chat abierto, el chat sin `before`.
  La lista fusiona por `contactId` (la de la página 1 gana; el resto de páginas cargadas se queda),
  el chat une por `id` (el estado nuevo de un saliente reemplaza al viejo).
- Puertos inyectables `VisibilityPort` y `TimerPort` (mismos nombres que la campana, tipos propios
  de la ruta) para probarlo con reloj falso. Pestaña oculta → no programa; `visibilitychange` a
  visible → consulta ya (R43). Error → mantiene lo último y sigue (R44); `unauthorized` → para.
- Entrantes nuevos en el chat abierto con la pestaña visible → `markWhatsappChatReadAction` (R28).

### 5.3 Historial y scroll

- `use-end-sentinel.ts` observa un elemento al final de la lista (R13) o al inicio del historial
  (R25) con `IntersectionObserver` (API del navegador, soportada en Safari/WebKit y Chrome Android;
  sin dependencia).
- Al añadir anteriores arriba se conserva la posición: se guarda `scrollHeight - scrollTop` antes y se
  restaura después del render (`useLayoutEffect`) (R25).
- «Al final» = a menos de 48 px del fondo; solo entonces un mensaje nuevo desplaza (R26).

### 5.4 Envío

- Texto: saliente provisional con id local `pending:<n>` y `delivery: 'sending'`; al volver la acción
  se reemplaza por `data` (R32) o se quita y el texto vuelve a la caja (R40). Enter sin Shift (y sin
  composición IME activa, `event.nativeEvent.isComposing`) envía (R29).
- Plantilla: mismo saliente provisional con `text` resuelto (R37). El diálogo y las burbujas comparten
  el mismo pedido elegido en la cabecera y los mismos `values` del contexto (R31, R38).
  `constants` = `systemConstantsFor(template, values)`; `constantLabels` = `constantLabelsForBackend()`.
- Reintento: el fallido se queda; el devuelto entra como mensaje nuevo (R41). En plantilla, con los
  `values` vigentes.
- Tras enviar a un `customerId` sin conversación, se recarga el chat por `{ customerId }` (R37); el
  contexto no cambia y no se vuelve a pedir.

### 5.4.1 Contexto y selector «Pedido» (R38, R39, R54)

- `contacts-screen.tsx` guarda el `ChatContextView` del chat abierto. Al abrir otra conversación lo
  pide con `{ target }`; al cambiar el selector, con `{ target, orderId }`. Mientras llega, el
  selector queda deshabilitado y la caja / vista previa conservan el texto anterior.
- Respuesta de un cambio de pedido que llega después de haber abierto otro chat → se descarta
  (se compara el `target`).
- Error al cambiar → `ErrorAlert` junto al selector, el `selectedOrderId` anterior se restaura (R54).
- `orders.length > 1` → selector; `≥ 1` → flecha y detalle (P10); `0` → ni selector ni flecha.

### 5.4.2 Imágenes y stickers (R21, R22)

- `chat-media-image.tsx` (en la ruta, paso 4): con `src === null` pinta el recuadro de su tipo; con
  `src`, un `<img>` (no `next/image`: la ruta es relativa, privada y con la sesión, sin optimizador)
  con `loading="lazy"`, el `eslint-disable-next-line @next/next/no-img-element` con su motivo (como
  `EntityImage`) y `alt` = caption o «Imagen enviada por el cliente» / «Sticker»; en `onError`
  cambia a «Imagen no disponible». El visor reutiliza la pieza a tamaño completo, así que una imagen
  caducada tampoco se ve allí.
- El estado de error es por mensaje y no se reintenta solo: el 502 de una imagen caducada es
  permanente (D9 de QC-245).

### 5.5 Clientes: «Abrir chat»

- `app/(private)/clientes/page.tsx` calcula `canChat` (`whatsapp.consultar`) con el mismo patrón
  que `canModifyCustomers` y lo baja a la tabla.
- `customer-chat-link.tsx` (nuevo, paso 3 · compone `buttonVariants` + icono): «Abrir chat» si
  `phoneE164 !== null && phoneIssue === null`, si no «Sin teléfono válido»; nada si `!canChat`. Se pinta
  en la celda de acciones, delante de `CustomerRowActions` (que no cambia), en tabla y en tarjetas.
  Href con `CUSTOMER_CONTACTS_ROUTE` y `URLSearchParams` (la guardia de la ruta prohíbe el literal).
  Tablero: `docs/diseno/canvas/ContactosVacios.dc.html`.

### 5.6 Multiplataforma (`docs/architecture.md > Componentes > Regla: multiplataforma`)

- Mobile-first; disposición por clases (`md:`), no por `useIsMobile`, para no pintar distinto en el
  servidor y en el cliente.
- Alto con `100dvh`; la caja de texto lleva `padding-bottom: env(safe-area-inset-bottom)` en teléfono.
- Targets de 44 × 44 px: volver, enviar, flecha del pedido, cerrar del visor, burbujas de plantilla
  (alto 44 px en teléfono, 32 px visibles desde `md` con área táctil completa), «Reintentar»,
  «Abrir chat». Nada se activa solo con `:hover`.
- `Textarea`, `Input` y `SharedSelectControl` ya dan 16 px en móvil.
- Burbujas con `max-width: 80%` en teléfono y `62%` en escritorio, `overflow-wrap: anywhere`;
  tarjeta de ubicación e imagen con `max-width: 100%` (R7).
- Sin excepciones de solo-escritorio.

## 6. Piezas que suben

| Pieza | De | A | Fila del catálogo |
|---|---|---|---|
| `WaBubble` | `app/(private)/integraciones/whatsapp/components/wa-bubble.tsx` | `components/shared/wa-bubble.tsx` | Nueva, `Diseño`: `docs/diseno/canvas/WaBurbuja.dc.html`. Consumidores: plantillas de Integraciones (QC-243) y diálogo «Enviar plantilla». Sin cambios de API. |
| `SYSTEM_CONSTANTS`, `constantLabelsForBackend`, `toBackendKey`, `displayKeyOf`, `toBackendText`, `toDisplayText`… | `app/(private)/integraciones/whatsapp/components/whatsapp-system-constants.ts` | `lib/shared/ui/whatsapp-system-constants.ts` | Nueva, `Diseño`: `sin UI`. |

Los archivos de origen quedan como `export * from '<nuevo>'` (una línea): los importadores de QC-243
no se tocan. `lib/shared/ui/**` es hoja: el archivo solo importa `EMPTY_MARK` de
`lib/shared/ui/empty-mark`.

### 6.1 Las cuatro constantes nuevas (D14; R50–R53)

Se añaden al final de `SYSTEM_CONSTANTS` en `lib/shared/ui/whatsapp-system-constants.ts` (ya
movido, T2). Las tres actuales no cambian ni de orden (R50). Default de P12:

| `displayKey` | `backendKey` | `label` | `description` | `example` |
|---|---|---|---|---|
| `estado_del_pedido` | `pedido.estado` | Estado del pedido | Estado del pedido como lo ve el cliente: recibido, en preparación, entregado o cancelado. | en preparación |
| `fecha_de_solicitud` | `pedido.fecha_solicitud` | Fecha de solicitud | Día en que se pidió el pedido (DD/MM/AAAA). | 23/10/2026 |
| `total_del_pedido` | `pedido.total` | Total del pedido | Importe total del pedido. Aún no disponible: el mensaje no se envía hasta que lo esté. | `EMPTY_MARK` |
| `detalle_del_pedido` | `pedido.detalle` | Detalle del pedido | Presentaciones pedidas, con lo entregado y lo que falta, en una línea. | 10 × Bidón 20 L (entregado 6, faltan 4) |

Los ejemplos salen del contrato v2 (§D, tabla de `values`). `total_del_pedido` usa `EMPTY_MARK`
como `nombre_de_la_empresa`, así que el diccionario de QC-243 (`dictionaryOf`) le pone la etiqueta
como vista previa, sin código nuevo.

Todo lo que hace falta en QC-243 deriva de `SYSTEM_CONSTANTS` y por eso **no cambia de código**:
`BY_DISPLAY_KEY` / `BY_BACKEND_KEY` (traducción, R51), `constantLabelsForBackend` (R51),
`dictionaryOf` y `whatsapp-variables-panel.tsx` (R52), `isSystemDisplayKey` en
`whatsapp-variable-rules.ts` (R53), y `systemConstantOf` en `whatsapp-template-form-sheet.tsx`
(etiquetas al crear). Ningún import cambia.

Sí cambian los tests de QC-243 que **enumeran** la lista exacta (con `toEqual` o filas fijas): se
**amplían** con las cuatro nuevas, nunca se relajan (`tests/unit/integraciones-ui/whatsapp-template-rules.test.ts`,
`whatsapp-variables-panel.test.tsx`, `whatsapp-template-relate-sheet.test.tsx`,
`whatsapp-template-form-sheet.test.tsx`). El E2E `e2e/integraciones-whatsapp-plantillas.spec.ts`
usa `numero_de_pedido` y no enumera la lista: no cambia.

Riesgo (P13): una variable propia ya guardada con una de esas claves visibles quedaría duplicada en
el diccionario. En `lib/` de este worktree no aparece ninguna lista de claves con punto (búsqueda
de `cliente.nombre` y `pedido.numero`: sin resultados); el catálogo de las siete del back lo entrega
QC-245 (D13 de QC-245). Si al integrar el back rechazara alguna de las cuatro al guardar una
plantilla, es un defecto de QC-245, no algo que esta ficha resuelva.

## 7. Errores y textos

Textos de pantalla en `contact-texts.ts` (los literales de `requirements.md`). Los errores de las
acciones se pintan con su `message` (catálogo de QC-245 §C), nunca reescritos. Sin comentarios con
`QC-`/`R<n>` en producción.

## 8. Tests (resumen; el mapa `R<n> → test` lo escribe el implementer)

- Unit puros (`tests/unit/contactos-ui/*.test.ts`): `chat-view` (tipos, estados, `mediaUrl` → `src`,
  reacciones por `messageId` con objetivo, sin objetivo, `null` y objetivo que llega después;
  `toChatContext` con 0, 1 y 2 pedidos, total `null` y con valor, presentación sin nombre),
  `template-values` (resolución con `values`, `[falta …]` por clave ausente y por `null`, incluido
  `pedido.total`; `missing` con etiquetas de las cuatro constantes nuevas; constantes del envío sin
  las nulas ni las propias),
  `chat-timeline`, `conversation-list-state`, `chat-time-format` (con reloj fijo), `contacts-poller`
  (puertos falsos: intervalo, pausa, reanudación, error, `unauthorized`).
- Componentes (`tests/unit/contactos-ui/*.test.tsx`, proyecto `ui`): cada componente con las acciones
  simuladas por `vi.mock` de su ruta exacta. `chat-media-image` dispara `error` sobre el `<img>`
  (`fireEvent.error`) para «Imagen no disponible». `chat-panel` comprueba que no hay ningún control
  con nombre «Vincular», «Desvincular» ni «Bloquear» (R49). `contacts-screen` comprueba que el
  contexto se pide al abrir y al cambiar de pedido y no en los turnos del poller (R54).
- Constantes (R50–R53): `tests/unit/shared-ui/whatsapp-system-constants.test.ts` (nuevo: lista en
  orden, traducción en los dos sentidos de clave suelta y de texto, `constantLabelsForBackend`) y los
  cuatro tests de QC-243 ampliados (sección 6.1): panel y diccionario con las siete (R52), clave
  propia `estado_del_pedido` rechazada como ocupada (R53).
- Página (`tests/unit/clientes-ui/contactos-page.test.tsx`, se reescribe): corte con
  `whatsapp.consultar`, sin conexión, `?cliente=`.
- Menú (`tests/unit/clientes-ui/private-nav-clientes.test.ts`): permiso del hijo.
- Clientes (`tests/unit/clientes-ui/customer-chat-link.test.tsx`).
- Frontera (R48): test que barre `app/(private)/clientes/contactos/**` y falla si importa
  `@/lib/composition` o un módulo por ruta profunda que no sea `adapters/driving`.
- Guardias que se **tensan** (nunca se relajan): `guard-pantallas-exigen-permiso` (comentario de
  `/clientes/contactos`: ahora `whatsapp.consultar`) y `guard-catalogo-de-componentes` (dos filas).
- E2E `e2e/contactos-chat.spec.ts` con los dobles de Graph: webhook entrante → aparece en la lista y
  el chat sin recargar → responder → «Enviado» → status `delivered` por webhook → «Entregado»;
  más: 404 sin permiso, «Abrir chat» desde Clientes, teléfono 390 × 844 sin scroll horizontal.

## 9. Alternativas descartadas

1. **Componentes de chat en `components/shared/` desde el principio.** Solo los usa esta ruta; la
   regla es subir con la segunda ruta (`docs/perfil-agentes.md > Regla de decisión`). Se quedan en la
   ruta.
2. **Reutilizar `WaBubble` para las burbujas del chat.** Es un marco de vista previa (título
   «Vista previa», `min-h-80`, fondo propio) que pinta una sola burbuja entrante, sin autor, estado,
   fallido, reacción ni tipos. Extenderlo con todo eso cambiaría su visual en Integraciones. Se usa
   solo para la vista previa del diálogo, donde encaja tal cual.
3. **Generalizar `createPollingFeed` de la campana y usarlo aquí.** Ahorra unas 40 líneas, pero
   obliga a cambiar los tipos y los tests de QC-137 (hecha) y su archivo vive en
   `app/(private)/components/`, que esta ruta no debe importar. Se copia el patrón; si aparece una
   tercera consulta periódica, se extrae a `lib/shared/ui/` con su fila.
4. **Mover `WaBubble` y las constantes actualizando todos sus importadores.** Toca seis archivos de la
   ruta de Integraciones, cinco tests y un E2E de QC-243, con riesgo de choque con fichas en vuelo sobre plantillas (p. ej. QT-293).
   La reexportación de una línea deja los importadores intactos; su limpieza puede ir en una ficha
   aparte.
5. **«Abrir chat» como ítem del menú de tres puntos (`RowActionsMenu` admite `href`).** Sería el paso
   1 puro, pero el tablero aprobado (`Vacios`) lo dibuja como enlace visible con «Sin teléfono
   válido» en las filas sin teléfono, que dentro de un menú no se vería; y el menú hoy no se pinta sin
   `clientes.modificar`.
6. **Librería de datos de cliente (SWR / TanStack Query) para la consulta periódica.** No está
   aprobada (`docs/perfil-agentes.md > frontend_dev > Datos`); el bucle propio con dos puertos cabe en
   un archivo y se prueba con reloj falso.
7. **Librería de lista virtual (p. ej. `react-virtuoso`) para el historial.** Con páginas de 30
   mensajes y de 25 conversaciones no hace falta; `IntersectionObserver` es nativo.
8. **Mapa estático en la tarjeta de ubicación.** Necesita proveedor, key y dependencia; queda en
   `requirements.md > P5`.
9. **Reutilizar `EntityImage` para imágenes y stickers del chat.** Al fallar pinta un marcador
   gráfico fijo (`/inv_not_found.png`) sin el texto «Imagen no disponible» que pide el contrato, su
   miniatura es cuadrada de 80 px (las del chat conservan proporción; el sticker mide 128 px y va sin
   burbuja) y su zoom no lleva caption, cliente ni hora. Cambiarla afectaría a todas las tablas que la
   usan. Se copia el patrón.
10. **Calcular en el front los valores `pedido.*` a partir de `orders`** (estado en lenguaje del
    cliente, fecha `DD/MM/AAAA`, detalle en una línea). Duplicaría el mapa único de estados del
    cliente (D15 de QC-245) y el formato de R60–R62 de QC-245, y la vista previa podría diferir de lo
    que el back manda a Meta. Se usa `context.values` tal cual y se vuelve a pedir el contexto al
    cambiar de pedido.
11. **Pintar `pedido.total` nulo como «—» en la plantilla.** Ver E1 (sección 4): se enviaría un
    texto engañoso y el back lo rechaza igual con `missing_values`.
12. **Catálogo propio de constantes para el chat**, separado del de QC-243. Dos listas de la misma
    verdad divergirían, y el front de plantillas seguiría sin poder usar las cuatro nuevas (D14).

## 10. Dependencias de terceros

**Ninguna nueva.** `IntersectionObserver`, `visibilitychange` y `history.pushState` son APIs del
navegador; todo lo demás está en el catálogo. Si la respuesta a P5 pide un mapa estático, entra con
su fila en `docs/dependencias.md` y los cuatro checks antes de implementarlo.

## 11. Fronteras y choques previsibles

- **QC-245** (Camilo, en vuelo): la pantalla no compila sin sus acciones y sin el permiso
  `whatsapp.consultar` en el catálogo de permisos. F2 empieza cuando QC-245 esté en `dev` con la
  Enmienda 1 (contrato v2). Si se publica una v3, se ajustan solo los adaptadores de la sección 4.
- **QC-243** (hecha): sus dos archivos pasan a ser reexportaciones (sección 6) y su catálogo de
  constantes gana cuatro filas (sección 6.1); se amplían cuatro de sus tests.
- **QT-293** u otra ficha en vuelo sobre plantillas: puede chocar en
  `whatsapp-system-constants.ts` y en los tests de QC-243 ampliados; lo dirá
  `archivos-en-vuelo.mjs`.
- **QT-299** (vincular, desvincular y bloquear en el chat, depende de esta): R49 fija que aquí no
  hay esas acciones; QT-299 reemplazará R49 y su test en su propio spec.
- **QC-302** (teléfonos del cliente): «teléfono válido» es el principal (`phoneE164`); si QC-302
  cambia `CustomerView`, se ajusta `customer-chat-link.tsx`.
- **QC-307** (precio de venta del pedido): hasta que entre, `total` y `pedido.total` llegan `null`
  (D16). Cuando lleguen con valor, el detalle muestra la fila y las plantillas se desbloquean sin
  cambios aquí (el adaptador ya pasa `total` tal cual).
- **QC-166** — choque **aceptado** por el humano en `lib/shared/navigation/private-nav.ts`
  (`requirements.md > D9`; lo marca `archivos-en-vuelo.mjs`). Antes de tocar el archivo se rebasa la
  rama sobre `dev`, y solo se cambia la entrada del hijo `nav-clientes-contactos` (su permiso); nada
  más del archivo (T16).
- Archivos compartidos con otras fichas: `lib/shared/navigation/private-nav.ts` (QC-166, arriba),
  `components/shared/CATALOGO.md`, `app/(private)/clientes/components/*`. Correr
  `node scripts/archivos-en-vuelo.mjs --candidata QC-246` con este `tasks.md`.
