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
| QC-245: contrato de la pantalla | tarjeta de QC-245/QC-246 y `.worktrees/QC-245-…/specs/QC-245-contactos-whatsapp-backend/design.md > Contrato para la pantalla (QC-246)` | Se **consume** tal cual (sección 3). Aún no está en `dev`: la ficha arranca F2 cuando QC-245 mergee. |
| QC-240: `sendWhatsappMessageAction`, `retryWhatsappMessageAction` | `lib/modules/integraciones/adapters/driving/whatsapp-message-actions` | Se **consumen**. |
| QC-239: «Botones de vincular, desvincular y bloquear en el chat: QC-246» | descripción de QC-239 > Lo que NO entra | **No** está en el alcance de QC-246: va a **QT-299** (chat-vincular-bloquear-contacto, depende de QC-246) (`requirements.md > D12`). |
| QC-243: `WaBubble` (vista previa de plantilla con su marco «Vista previa») | `app/(private)/integraciones/whatsapp/components/wa-bubble.tsx`, tablero `docs/diseno/canvas/WaBurbuja.dc.html` | Se **reutiliza** en la vista previa del diálogo «Enviar plantilla» (R31). Al necesitarla una segunda ruta **sube** a `components/shared/wa-bubble.tsx` con su fila (sección 6). No sirve para las burbujas del chat: es un marco de vista previa (`min-h-80`, título, fondo), sin estado, autor ni tipos. |
| QC-243: `SYSTEM_CONSTANTS`, `constantLabelsForBackend()` | `app/(private)/integraciones/whatsapp/components/whatsapp-system-constants.ts` | Se **reutiliza** para saber las constantes (`cliente.nombre`, `pedido.numero`, `empresa.nombre`) y sus etiquetas (`constantLabels`). Un archivo `'use client'` no puede importar de otra ruta (`docs/architecture.md`, tabla de dependencias): **sube** a `lib/shared/ui/whatsapp-system-constants.ts` (sección 6). |
| QC-137: `createPollingFeed`, `browserVisibility`, `browserTimers` (campana) | `app/(private)/components/notifications/notification-feed.ts` | Se **copia el patrón** (siguiente turno al terminar la consulta, pausa con la pestaña oculta, puertos inyectables), no el código: está atado a los tipos de notificaciones. Alternativa descartada 3. |
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
| Estado del pedido | `ORDER_STATUS_LABELS` | 1 [ABIERTO A3: según lo que traiga el estado] |
| Presentación × cantidad | `orderDistributionLineText` | 1 [ABIERTO A3: según la forma de la línea] |
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

1. `/clientes/contactos` exige `whatsapp.consultar` y pinta la pantalla de dos columnas (R1–R47).
2. El hijo «Contactos» del menú declara `whatsapp.consultar` (R2).
3. La lista de Clientes gana «Abrir chat» / «Sin teléfono válido» (R45).
4. `WaBubble` sube a `components/shared/` y `whatsapp-system-constants` a `lib/shared/ui/`, cada uno
   con su fila del catálogo; sus archivos viejos quedan como reexportación (alternativa descartada 4).
5. Ningún cambio en `lib/modules/**`, `db/**` ni `lib/composition/**` (R48).

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

## 3. Contrato consumido (QC-245 + QC-240)

Tipos exactos en `specs/QC-245-contactos-whatsapp-backend/design.md > Contrato para la pantalla`;
aquí solo cómo se usa cada acción. Todas se importan por su ruta exacta; los DTO, de
`@/lib/modules/integraciones`.

| Acción | Cuándo | Con qué | Requisitos |
|---|---|---|---|
| `listWhatsappConversationsAction` | Servidor, primera página. Cliente: búsqueda, página siguiente, consulta periódica (página 1). | `{ search, page, pageSize: 25 }` (`blocked` sin mandar = `'all'`) | R3, R8–R13, R42 |
| `getWhatsappChatAction` | Servidor si hay selección en la URL. Cliente: abrir otra conversación, anteriores (`before = nextCursor`), consulta periódica (sin `before`, se une por `id`). | `{ target: { contactId } \| { customerId }, before?, pageSize: 30 }` | R15–R26, R46 |
| `markWhatsappChatReadAction` | Tras abrir un chat con `contact` y tras una consulta que trae entrantes nuevos con la pestaña visible. | `{ contactId, upToMessageId: <último mostrado> }` | R27, R28 |
| `listSendableWhatsappTemplatesAction` | Servidor, una vez por carga de página (las plantillas son de la empresa, no del chat). | — | R31, R33 |
| `sendWhatsappMessageAction` | Enviar texto o plantilla. | Texto: `{ kind: 'text', recipient, text }`. Plantilla: `{ kind: 'template', recipient, templateId, constants, constantLabels }` | R29, R32, R36, R37, R40 |
| `retryWhatsappMessageAction` | «Reintentar». | `{ messageId }`; en plantilla, además `constants` y `constantLabels` del pedido elegido **ahora** | R41 |

`recipient` = `{ contactId }` si el chat tiene `contact`; si no, `{ customerId }`. Tras enviar a un
`customerId`, el chat se vuelve a pedir por `{ customerId }` y pasa a su `contact.id` (R37; QC-245
§A: «el chat siguiente se pide ya por `contactId`»).

Respuestas que la pantalla distingue:

- `status: 'success'` con `data.status === 'FAILED'` → saliente fallido con `errorReason` (R19).
- `status: 'missing_values'` → se muestra `message`, no se añade saliente (R36).
- `status: 'error'` → `ErrorAlert`; `code: 'unauthorized'` en la consulta periódica la para (R44).
- `connectionStatus: null` → estado «WhatsApp no está conectado» (R3).

## 4. Tipos locales de la pantalla (y el punto de entrada de la ampliación)

La pantalla **no** pinta los DTO directamente: los pasa por adaptadores puros de la ruta a tipos
propios. Así la ampliación de QC-245 (A1–A5 de `requirements.md`) entra cambiando solo el adaptador,
sin tocar componentes ni inventar hoy nombres de campos del backend.

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
    | { kind: 'image'; src: string | null; caption: string | null }        // src: A1
    | { kind: 'sticker'; src: string | null }                               // src: A1
    | { kind: 'location'; latitude: number; longitude: number; name: string | null; address: string | null }
    | { kind: 'label'; label: '[Audio]' | '[Video]' | '[Documento]'; caption: string | null }
    | { kind: 'unsupported' };
  reaction: { emoji: string } | null;           // la reacción ya pegada a este mensaje (A2)
};

type ChatOrderView = {                          // A3: hoy no hay fuente → lista vacía
  id: string;
  number: string;
  statusLabel: string | null;
  deliveryDate: string | null;
  totalLabel: string | null;                    // P2 / QC-307
  lines: readonly { product: string; ordered: string; delivered: string; missing: string }[];
};

type TemplateValues = Readonly<Record<string, string>>;   // clave con punto o propia → valor (A4)
```

Adaptadores (puros, con test cada uno):

- `toChatMessages(messages)` — de `WhatsappChatMessage[]` a `ChatMessageView[]`: traduce tipo y
  estado (R19, R20), aparta las `REACTION` y las pega a su objetivo (R24). Con el contrato publicado
  no hay forma de casar `attachment.messageId` (wamid) con `WhatsappChatMessage.id` (uuid), así que
  las reacciones quedan sin objetivo y **no se pintan** (default A2). `src` sale siempre `null`
  (default A1).
- `toChatOrders(source)` — hoy devuelve `[]` (default A3). Cuando QC-245 publique los pedidos del
  cliente, aquí se mapea y el selector y la flecha aparecen solos (R38, R39).
- `buildTemplateValues({ customerName, order, templates })` — default A4: `cliente.nombre` = nombre
  del cliente del chat; `pedido.numero` = `order?.number`; propias = `variables[].value` de la
  plantilla cuando no es `null`; `empresa.nombre` sin valor (el front no tiene hoy de dónde sacarlo:
  `SessionContext` trae `companyId`, no el nombre).
- `resolveTemplate(template, values)` — reemplaza cada `{{clave}}` de `content.header.text`,
  `content.body.text` y `content.footer`; lo que no está en `values` sale `[falta <clave>]` (R35).
  Devuelve `{ header, body, footer, text, missing: { key, label }[] }`; `label` sale de
  `SYSTEM_CONSTANTS` para las constantes y de `variables[].label` para las propias. `text` (lo que
  va en la caja, R33) = encabezado, cuerpo y pie no vacíos separados por una línea en blanco.
- `systemConstantsFor(template, values)` — las claves `kind: 'system'` de la plantilla con su valor:
  es el `constants` del envío (default A5). `constantLabels` = `constantLabelsForBackend()`.

Con `missing` no vacío el botón de envío de la plantilla queda deshabilitado y se muestra
«Falta el valor de A» / «Falta el valor de A, B y C» (mismo formato que el `missing_values` de
QC-245) (R36). Mientras A4 no llegue, toda plantilla con `{{empresa.nombre}}` o `{{pedido.numero}}`
queda bloqueada: es el comportamiento correcto (QC-245 la rechazaría igual) y lo resuelve la
ampliación.

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
    chat-image-viewer.tsx          ← Dialog a pantalla completa
    chat-composer.tsx              ← caja + enviar / aviso de ventana cerrada + «Enviar plantilla»
    chat-template-chips.tsx        ← burbujas de plantillas (aria-pressed), con flex-wrap
    send-template-dialog.tsx       ← Dialog con selectores y WaBubble
    contacts-empty-states.tsx      ← sin conexión, sin conversaciones, sin búsqueda, sin selección
    chat-view.ts                   ← tipos locales y adaptadores (sección 4)
    template-values.ts             ← buildTemplateValues, resolveTemplate, systemConstantsFor
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
4. En paralelo: lista (página 1), plantillas enviables y, si hay selección, el chat.
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
  el mismo pedido elegido en la cabecera (R31, R38).
- Reintento: el fallido se queda; el devuelto entra como mensaje nuevo (R41).

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
y sus tests no se tocan. `lib/shared/ui/**` es hoja: el archivo solo importa `EMPTY_MARK` de
`lib/shared/ui/empty-mark`.

## 7. Errores y textos

Textos de pantalla en `contact-texts.ts` (los literales de `requirements.md`). Los errores de las
acciones se pintan con su `message` (catálogo de QC-245 §C), nunca reescritos. Sin comentarios con
`QC-`/`R<n>` en producción.

## 8. Tests (resumen; el mapa `R<n> → test` lo escribe el implementer)

- Unit puros (`tests/unit/contactos-ui/*.test.ts`): `chat-view` (tipos, estados, reacciones con y sin
  objetivo), `template-values` (resolución, `[falta …]`, `missing`, constantes del envío),
  `chat-timeline`, `conversation-list-state`, `chat-time-format` (con reloj fijo), `contacts-poller`
  (puertos falsos: intervalo, pausa, reanudación, error, `unauthorized`).
- Componentes (`tests/unit/contactos-ui/*.test.tsx`, proyecto `ui`): cada componente con las acciones
  simuladas por `vi.mock` de su ruta exacta.
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

## 10. Dependencias de terceros

**Ninguna nueva.** `IntersectionObserver`, `visibilitychange` y `history.pushState` son APIs del
navegador; todo lo demás está en el catálogo. Si la respuesta a P5 pide un mapa estático, entra con
su fila en `docs/dependencias.md` y los cuatro checks antes de implementarlo.

## 11. Fronteras y choques previsibles

- **QC-245** (Camilo, en vuelo): la pantalla no compila sin sus acciones y sin el permiso
  `whatsapp.consultar` en el catálogo de permisos. F2 empieza cuando QC-245 esté en `dev`. Si al
  ampliarse cambia algún tipo del contrato publicado, se ajustan solo los adaptadores de la sección 4.
- **QC-243** (hecha): sus dos archivos pasan a ser reexportaciones (sección 6).
- **QC-302** (teléfonos del cliente): «teléfono válido» es el principal (`phoneE164`); si QC-302
  cambia `CustomerView`, se ajusta `customer-chat-link.tsx`.
- **QC-307** (precio de venta del pedido): el total del detalle depende de ella (P2).
- **QC-166** — choque **aceptado** por el humano en `lib/shared/navigation/private-nav.ts`
  (`requirements.md > D9`; lo marca `archivos-en-vuelo.mjs`). Antes de tocar el archivo se rebasa la
  rama sobre `dev`, y solo se cambia la entrada del hijo `nav-clientes-contactos` (su permiso); nada
  más del archivo (T16).
- Archivos compartidos con otras fichas: `lib/shared/navigation/private-nav.ts` (QC-166, arriba),
  `components/shared/CATALOGO.md`, `app/(private)/clientes/components/*`. Correr
  `node scripts/archivos-en-vuelo.mjs --candidata QC-246` con este `tasks.md`.
