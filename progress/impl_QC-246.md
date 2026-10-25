# impl QC-246 — contactos-con-chat

## Tanda 1 (2026-10-23) — T1, T2, T21

Las tres no dependen de QC-245. Sin delegación: los cambios venían de un intento anterior sin
commitear; el implementer los revisó contra el «Hecho» de cada task y contra `design.md > 6.1` y no
hizo falta corregir nada.

### Archivos
- Nuevo `components/shared/wa-bubble.tsx` (T1): copia byte a byte del original.
- `app/(private)/integraciones/whatsapp/components/wa-bubble.tsx` (T1): `export * from '@/components/shared/wa-bubble';`.
- Nuevo `lib/shared/ui/whatsapp-system-constants.ts` (T2 + T21): el original, más las cuatro constantes de 6.1 al final.
- `app/(private)/integraciones/whatsapp/components/whatsapp-system-constants.ts` (T2): `export * from '@/lib/shared/ui/whatsapp-system-constants';`.
- `components/shared/CATALOGO.md`: filas de `WaBubble` (`docs/diseno/canvas/WaBurbuja.dc.html`) y de las constantes (`sin UI`).
- Nuevo `tests/unit/shared-ui/whatsapp-system-constants.test.ts` (R50, R51).
- Ampliados (sin relajar ninguna aserción; los `toHaveLength(3|4)` pasan a `7|8` y las listas exactas suman las cuatro):
  `tests/unit/integraciones-ui/whatsapp-template-rules.test.ts`, `whatsapp-variables-panel.test.tsx`,
  `whatsapp-template-relate-sheet.test.tsx`, `whatsapp-template-form-sheet.test.tsx`.
- Sin cambios: importadores de QC-243, `tests/unit/integraciones-ui/wa-bubble.test.tsx`, `e2e/integraciones-whatsapp-plantillas.spec.ts`.

### Mapa R → test
| R | Test |
|---|---|
| R50 | `tests/unit/shared-ui/whatsapp-system-constants.test.ts` › «R50: son siete, en orden…», «R50: las tres actuales siguen intactas…», «R50: claves visibles y del backend sin repetir»; `whatsapp-template-rules.test.ts` › «R48 R50: son exactamente siete…» |
| R51 | `tests/unit/shared-ui/whatsapp-system-constants.test.ts` (casos R51: clave suelta, texto con marcas en los dos sentidos, `constantLabelsForBackend` con las siete); `whatsapp-template-rules.test.ts` › «P1 R51: las siete claves van al backend…», «P1 R51: las etiquetas de las siete constantes…» |
| R52 | `whatsapp-variables-panel.test.tsx` › «R48 R52: la tabla de constantes trae exactamente las siete…»; `whatsapp-template-rules.test.ts` › «R52: el diccionario trae las siete constantes en orden…»; `whatsapp-template-relate-sheet.test.tsx` › «R42 R52: el selector agrupa…», «R52: relacionar un hueco con «Estado del pedido»… guarda pedido.estado»; `whatsapp-template-form-sheet.test.tsx` › «R27 R52: «Insertar variable»…», «R52: insertar «Detalle del pedido»… pedido.detalle con su etiqueta» |
| R53 | `whatsapp-template-rules.test.ts` › «R53: una variable propia con la clave de una de las cuatro del pedido da el aviso de clave ocupada» |

### Salida real
- `pnpm run typecheck`: `tsc --noEmit`, sin errores.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, todos en archivos ajenos a la tanda.
- `pnpm exec vitest related --run <los 9 archivos tocados>`: `Test Files 15 passed (15)` · `Tests 246 passed (246)`.
- `pnpm exec vitest run guard`: `Test Files 87 passed (87)` · `Tests 1303 passed | 22 skipped (1325)`.
- `./init.sh`: ver la línea de la tanda en `progress/features/QC-246.md`.
- E2E: no procede (la tanda no toca el flujo; el spec de plantillas no cambia).

## Tanda Bloque 1 — T3, T4, T5, T6, T7 (frontend_dev, lógica pura sin UI)

### Archivos
- Nuevos en `app/(private)/clientes/contactos/components/`: `chat-view.ts` (T3), `template-values.ts` (T4),
  `chat-timeline.ts` y `conversation-list-state.ts` (T5), `chat-time-format.ts` (T6), `contacts-poller.ts` (T7).
- `contact-texts.ts`: textos nuevos (`CHAT_MEDIA_LABELS`, `MISSING_VALUE_TEXT`, `CHAT_TIME_TEXT`, `CHAT_WINDOW_TEXT`).
- Tests nuevos en `tests/unit/contactos-ui/`: `chat-view.test.ts`, `template-values.test.ts`, `chat-timeline.test.ts`,
  `conversation-list-state.test.ts`, `chat-time-format.test.ts`, `contacts-poller.test.ts`.
- `index.ts` no cambia: sin componentes nuevos que reexportar (lo cablea T15).

### Mapa R → test (parcial, de esta tanda)
| R | Test |
|---|---|
| R10 | `chat-time-format.test.ts` › «R10: de hoy sale HH:mm…», «R10: de ayer sale «Ayer»…», «R10: de los últimos siete días…», «R10: de hace siete días o más sale dd/MM» |
| R13 | `conversation-list-state.test.ts` › «R13: con más páginas pide la siguiente…», «R13: añade la página siguiente al final sin repetir…» |
| R15 | `chat-time-format.test.ts` › «R15: abierta con horas…», «R15: abierta con menos de una hora…», «R15: cerrada, o abierta con closesAt ya pasado…» |
| R17 | `chat-time-format.test.ts` › «R17: la hora del mensaje es HH:mm», «R17: el separador dice «Hoy», «Ayer» o dd/MM/yyyy»; `chat-timeline.test.ts` › «R17: ordena…», «R17: con el mismo instante…», «R17: pone un separador…», «R17: sin mensajes…» |
| R18 | `chat-view.test.ts` › «R18: el autor de un saliente es el usuario que lo envió o el sistema» |
| R19 | `chat-view.test.ts` › «R19: traduce cada estado de un saliente…» |
| R20 | `chat-view.test.ts` › «R20: texto, plantilla, botón e interactivo…», «R20: audio, video y documento…», «R20: una ubicación…» |
| R21, R22 | `chat-view.test.ts` › «R21/R22: la imagen y el sticker toman src de attachment.mediaUrl…», «R21/R22: audio, video y documento nunca dan una fuente…» |
| R24 | `chat-view.test.ts` › «R24: la reacción no sale como mensaje…», «R24: … messageId null…», «R24: si el objetivo no está cargado…», «R24: con varias reacciones gana la más reciente…» |
| R25 | `chat-timeline.test.ts` › «R25: antepone los anteriores sin duplicar…» |
| R28 | `contacts-poller.test.ts` › «R28: avisa cuando el chat abierto trae entrantes…», «R28: si la pestaña se ocultó…» |
| R35 | `template-values.test.ts` › «R35: reemplaza cada clave…», «R35: una clave ausente y un valor null…», «R35: pedido.total null…», «R35: el texto de la caja…» |
| R36 | `template-values.test.ts` › «R36: missing lleva las etiquetas del catálogo…», «R36: una propia que falta…», «R36: con 1, 2 y 3 faltantes…» |
| R37 | `template-values.test.ts` › «R37/R41: manda solo las constantes…», «R37: no manda constantes que la plantilla no usa…» |
| R38 | `chat-view.test.ts` › «R38: sin pedidos abiertos…», «R38: con dos pedidos…», «R38/R39: values pasa sin tocar»; `template-values.test.ts` › «R38: otros values dan otro texto resuelto» |
| R39 | `chat-view.test.ts` › «R39: un pedido sale con número, estado…», «R39: el total null…», «R39: una presentación sin nombre…» |
| R41 | `chat-view.test.ts` › «R41: solo un saliente fallido de origen usuario es reintentable»; `template-values.test.ts` › «R37/R41: …» |
| R42 | `contacts-poller.test.ts` › «R42: el primer turno espera 8 s…», «R42: con chat abierto…», «R42: el siguiente turno se programa 8 s después del fin…»; `chat-timeline.test.ts` › «R42: unir la página nueva del poller…»; `conversation-list-state.test.ts` › «R42: la página 1 del poller va arriba…», «R42: si el poller trae más páginas…» |
| R43 | `contacts-poller.test.ts` › «R43: con la pestaña oculta no consulta…», «R43: arrancando con la pestaña oculta…» |
| R44 | `contacts-poller.test.ts` › «R44: un error deja esa parte en null…», «R44: unauthorized en la lista o en el chat…» |
| R54 | `contacts-poller.test.ts` › «R54: el turno solo pide la lista y el chat, nunca el contexto…»; `chat-view.test.ts` › «R54: distingue el chat por contacto…» |

### Desvíos y decisiones
- `WhatsappConversationPage` y `WhatsappChatWindow` no salen del barrel `@/lib/modules/integraciones`: se usan
  `WhatsappConversationList['page']` y `WhatsappChat['window']` (sin tocar `lib/modules/**`).
- Poller: el primer turno espera el intervalo (la página ya trae lista y chat del servidor), a diferencia de la campana.
- Poller: R28 se «avisa» con `tick.chat.hasNewInbound`; marcar leído lo hace la pantalla (T14). Los ids conocidos los da
  `currentQuery().chat.knownMessageIds`.
- Cuenta atrás de la ventana redondea los minutos hacia arriba (nunca «0 min» con la ventana abierta).
- `ChatTarget` y `targetKey` viven en `chat-view.ts` (para descartar respuestas de otro chat en T14).

### Salida real
- `pnpm run typecheck`: `tsc --noEmit`, sin errores.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, todos en archivos ajenos a la tanda.
- `pnpm exec vitest related --run <7 archivos de la ruta>`: `Test Files 7 passed (7)` · `Tests 68 passed (68)`.
- `pnpm exec vitest run guard`: `Test Files 87 passed (87)` · `Tests 1324 passed | 22 skipped (1346)`.

Veredicto: T3–T7 hechas con su «Hecho»; typecheck, lint y tests relacionados en verde.

## Tanda 3 — Bloque 2 (T8–T12, frontend_dev, un encargo por task)

### T8 — burbujas del chat

#### Archivos
- Creados (`app/(private)/clientes/contactos/components/`): `chat-message.tsx`, `chat-message-status.tsx`,
  `chat-location-card.tsx`, `chat-media-image.tsx`, `chat-image-viewer.tsx`. Paso 4 de la regla de
  decisión, sin fila en el catálogo; reutilizan `Dialog`, `Button` (`touch`) y el patrón de `EntityImage`.
- Modificado: `contact-texts.ts` (`CHAT_MESSAGE_TEXT`, `CHAT_DELIVERY_LABELS`, `CHAT_IMAGE_TEXT`,
  `CHAT_LOCATION_TEXT`, testids `chat-message` y `chat-image-viewer`).
- Test nuevo: `tests/unit/contactos-ui/chat-message.test.tsx` (31 casos). `index.ts` sin tocar (T15).

#### Mapa R<n> → test (`chat-message.test.tsx`)
| R | Casos |
|---|---|
| R18 | «nombre de quien lo envió», «Sistema», «un entrante no muestra autor» |
| R19 | 4 × «… icono y nombre accesible» (Enviando/Enviado/Entregado/Leído), «fallido en tono de error con No se pudo enviar», «hora HH:mm» |
| R20 | «texto», 3 × «[Audio]/[Video]/[Documento] con caption», «Mensaje no soportado» |
| R21 | «abre el visor con cliente y hora», «Cerrar imagen cierra», «Escape cierra», «sin src [Imagen] y no abre», «alt sin caption», «no carga: Imagen no disponible en miniatura y visor», «falla dentro del visor» |
| R22 | «128 px sin burbuja con hora debajo», «[Sticker] del mismo tamaño», «Imagen no disponible del mismo tamaño» |
| R23 | «pestaña nueva con coordenadas y rel», «sin lugar ni dirección» |
| R24 | «nombre accesible Reacción del cliente», «sin reacción» |
| R41 | «retryable + canSend llama al callback con su id», «sin canSend no hay botón», «no reintentable no hay botón» |

#### Decisiones y huecos del spec
- Enlace del mapa: default de P5 (`https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`), recuadro con icono, sin imagen de mapa.
- Fallido sin `errorReason`: «No se pudo enviar» sin «: <motivo>» (el spec no lo dice).
- Saliente de usuario con `name: null`: no se pinta autor (el spec no lo dice).
- Visor: la hora es `HH:mm` (R21 dice «la hora»; el tablero pinta «Hoy 10:40», el día no se añade).
- «Ubicación» (cabecera de la tarjeta) y «Abrir imagen» (nombre del botón de la miniatura) salen del tablero, no de requirements.
- El enlace de ubicación no lleva el `aria-label` del tablero («Abrir ubicación en el mapa»): su nombre accesible contiene el texto visible «Abrir en el mapa».
- El fallo de carga de imagen se guarda por mensaje y `src`, compartido entre miniatura y visor; con la miniatura fallida el visor sigue abriendo y muestra «Imagen no disponible».

#### Salida real (T8 sola)
- `pnpm run typecheck`: `tsc --noEmit`, sin errores.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, ninguno en archivos de la tanda.
- `pnpm exec vitest related --run <6 archivos de la ruta + test>`: `Test Files 7 passed (7)` · `Tests 95 passed (95)`.
- `pnpm exec vitest run tests/unit/contactos-ui/chat-message.test.tsx`: `Tests 31 passed (31)`.

### T9 — historial y centinela
- Nuevos: `chat-message-list.tsx` (`ChatMessageList`, `CHAT_BOTTOM_THRESHOLD_PX = 48`), `use-end-sentinel.ts`
  (`useEndSentinel({ onVisible, enabled, rootMargin })` → callback ref; sin `IntersectionObserver` no hace nada).
  `contact-texts.ts`: `CHAT_HISTORY_TEXT.loadingOlder` y testids. Test: `tests/unit/contactos-ui/chat-message-list.test.tsx` (17).

| R | Casos (`chat-message-list.test.tsx`) |
|---|---|
| R17 | orden antiguo → reciente con separadores «dd/MM/yyyy», «Ayer», «Hoy»; entrantes a la izquierda, salientes a la derecha |
| R25 | con `nextCursor` pide al verse el centinela; sin verse no pide; sin cursor no hay centinela; «Cargando mensajes anteriores…» sin repetir la petición; conserva la posición al anteponer; pide `cur-2` con el cursor nuevo |
| R26 | al abrir queda al final; mensaje nuevo estando al final desplaza; a 40 px cuenta como al final; leyendo arriba no desplaza |
| R13, R25 | hook: avisa al verse, deshabilitado no observa, se desconecta, sin `IntersectionObserver` no falla |

Decisiones: la distancia al fondo se guarda en cada scroll/render y se restaura en `useLayoutEffect` al cambiar el primer
id; el scroll al final solo al montar (el panel se monta con `key` por cliente). El historial no lleva `role="log"`: el spec
no da texto para su nombre accesible.

### T10 — cabecera, ventana y detalle del pedido
- Nuevos: `chat-window-badge.tsx`, `chat-header.tsx`, `chat-order-detail.tsx`. `contact-texts.ts`: `CHAT_HEADER_TEXT`,
  `CHAT_ORDER_DETAIL_TEXT` y testids. Test: `tests/unit/contactos-ui/chat-header.test.tsx` (20). Reutiliza
  `SharedSelectControl`, `Collapsible`, `Button` (`touch`), `ErrorAlert`, `StatusBadge`, `Avatar`; sin filas nuevas de catálogo.

| R | Casos (`chat-header.test.tsx`) |
|---|---|
| R15 | nombre y teléfono; «… 21 h 18 min»; «… 42 min»; «Ventana cerrada» |
| R16 | con reloj falso recalcula cada minuto y pasa sola a «Ventana cerrada» al llegar `closesAt` |
| R38 | sin pedidos ni selector ni flecha; con uno flecha sin selector; con dos, opciones por número y `selectedOrderId`; elegir llama `onSelectOrder`; deshabilitado y `aria-busy` mientras carga |
| R39 | flecha con `aria-expanded`/`aria-controls`; número, estado, producto, filas por línea; detalle del pedido elegido; total `null` oculto y con valor visible; ninguna fecha de entrega |
| R6 | «Volver a conversaciones» llama `onBack` |
| R54 | el `message` del error junto al selector (`role="alert"`, `aria-describedby`); el pedido anterior se conserva |

Decisiones: `aria-controls` solo con el detalle abierto (Base UI quita el panel cerrado del DOM); el producto va una vez por
pedido (`ChatOrderLineView` no trae producto por línea); estado del pedido en tono `info` (la vista no trae el código); el
tablero pinta fecha de entrega y no se pinta (R39).

### T11 — caja, burbujas de plantillas y diálogo
- Nuevos: `chat-composer.tsx` (`CHAT_TEXT_MAX_LENGTH = 4096`; llama `sendWhatsappMessageAction` de
  `@/lib/modules/integraciones/adapters/driving/whatsapp-message-actions`), `chat-template-chips.tsx`,
  `send-template-dialog.tsx`. `contact-texts.ts`: `CHAT_COMPOSER_TEXT`, `CHAT_TEMPLATE_CHIPS_TEXT`,
  `SEND_TEMPLATE_DIALOG_TEXT` y testids. Tests: `tests/unit/contactos-ui/chat-composer.test.tsx` y
  `tests/unit/contactos-ui/send-template-dialog.test.tsx` (31).

| R | Casos (`chat-composer.test.tsx`, `send-template-dialog.test.tsx`) |
|---|---|
| R29 | Enter envía; Shift+Enter salto sin enviar; IME no envía; vacío/espacios deshabilitado; 4097 deshabilitado con `aria-invalid`, 4096 sí |
| R30 | caja deshabilitada, aviso literal y «Enviar plantilla» |
| R31 | abre el diálogo; solo enviables; vista previa resuelta sin campos de variables; «Pedido» solo con más de uno y llama `onSelectOrder` |
| R32 | provisional `pending:<n>` «Enviando», caja vacía, reemplazo con `onSent` |
| R33 | una burbuja por plantilla con `flex-wrap`; elegir rellena con `aria-pressed=true`; pulsar otra vez quita |
| R34 | caja `readOnly`; vista previa no editable y sigue los `values` del pedido nuevo |
| R36 | `[falta pedido.total]` deshabilita el envío con «Falta el valor de Total del pedido»; `missing_values` muestra su `message` |
| R37 | por `customerId`: `constants` de `values` sin las propias, `constantLabels`, recarga; con `contactId` no recarga |
| R40 | error: se quita el provisional, el texto vuelve a la caja (o el diálogo sigue abierto) y sale el `message` |
| R47 | sin `canSend` no hay caja, burbujas, «Enviar plantilla» ni aviso |

Decisiones: el implementer quitó «El mensaje no puede pasar de 4096 caracteres.», que el subagente había inventado (no está
en requirements); con más de 4096 el botón queda deshabilitado y la caja `aria-invalid`. Textos sacados de los tableros:
«Enter envía · Shift+Enter hace un salto de línea», «Solo plantillas aprobadas por WhatsApp.», «Las variables se rellenan
solas.», «Elige una plantilla para empezar», «Plantillas aprobadas», «Cancelar», «Cerrar». Sin plantillas enviables,
«Enviar plantilla» queda deshabilitado; ventana abierta sin mensajes → burbujas. Abierto: un rechazo de red de la acción
no se captura (el contrato no da `ErrorState` para eso).

### T12 — panel del chat
- Nuevo `chat-panel.tsx` (`ChatPanel`; se reinicia con `key={chat.customer.id}`; une por id lo que trae la prop `chat`;
  carga anteriores con `pageSize: 30`; marca leído una vez por apertura y avisa con `onChatRead(contactId)`).
  `chat-composer.tsx`: solo `export` de `sentMessage`. `contact-texts.ts`: `CHAT_PANEL_TEXT` y testids.
  Test: `tests/unit/contactos-ui/chat-panel.test.tsx`.

| R | Casos (`chat-panel.test.tsx`) |
|---|---|
| R27 | marca con el último id mostrado (`upToMessageId`) y llama `onChatRead`; la reacción no cuenta; sin contacto no marca; una consulta nueva no vuelve a marcar; si falla no avisa |
| R33 | literales del vacío del chat; con mensajes no hay vacío |
| R4 | error del chat (catalogado e inesperado) con su `message` y «Reintentar» → `onRetryChat`; error del contexto → `onRetryContext` con el historial visible |
| R49 | con contacto vinculado, bloqueado y sin contacto: ningún botón ni enlace con «Vincular», «Desvincular» ni «Bloquear» |
| R25 | pide con `before` y muestra «Cargando mensajes anteriores…»; antepone sin duplicar; error con su `message` |
| R41 | reintenta con el `messageId`; el devuelto entra como nuevo y el fallido se queda; error tal cual; sin `canSend` no hay botón |
| R32 | el provisional entra en el historial y se reemplaza por el devuelto |

Huecos (abiertos, sin inventar): `WhatsappChat` sin contacto no trae teléfono (cabecera con `phone=''`; T14 lo resuelve o
falta en el contrato); sin título ni texto para el error y la carga del chat (`ErrorAlert` + «Reintentar» y un `Spinner` con
`aria-busy`); el error del contexto va como franja bajo la cabecera. **Desvío de design 5.4:** el reintento de plantilla manda
como `constants` todas las de sistema con valor en `values`, no `systemConstantsFor(template, values)`, porque la vista del
fallido no trae la plantilla (el backend solo usa las que pide la plantilla).

### Salida real de la tanda (implementer)
- `pnpm run typecheck`: `tsc --noEmit`, sin errores.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, ninguno en archivos de la tanda.
- `pnpm exec vitest related --run <22 archivos de la tanda>`: `Test Files 12 passed (12)` · `Tests 183 passed (183)`.
- `pnpm exec vitest run guard`: `Test Files 87 passed (87)` · `Tests 1324 passed | 22 skipped (1346)`.
- `./init.sh`: rojo solo por `feature_list.json` (ids 290–298 duplicados, en vuelo sin assignee QC-162/166/262/263/264,
  zona backend 4/3), ajeno a la tanda.
- E2E: no procede todavía (T19).

Veredicto: T8–T12 hechas con su «Hecho»; los cuatro comandos en verde.

## Tanda 4 (2026-10-24) — T13 (frontend_dev)

### Archivos
- Nuevo `app/(private)/clientes/contactos/components/conversation-list.tsx`: `useConversationList(initialPage)`
  (búsqueda con pausa `SEARCH_DEBOUNCE_MS`, página 1 al buscar, página siguiente, descarte de respuestas de una búsqueda
  anterior, `mergePolled(search, page)` para el poller, `markRead(contactId)` para R27) y `ConversationList` (buscador
  `maxLength=100`, filas, centinela con `useEndSentinel`, «Cargando más conversaciones…», vacíos, error + «Reintentar»).
- Nuevo `.../components/conversation-list-item.tsx`: `ConversationListItem` (botón con `aria-current`, `Avatar` con
  `getInitials`/`avatarTone`, hora con `formatListTime`, contador `role="img"` «N sin leer») y `conversationPreview`.
- Nuevo `.../components/contacts-empty-states.tsx`: `ContactsNotConnected`, `ConversationsEmpty`,
  `ConversationsSearchEmpty`, `ChatNoSelection` (sobre `EmptyState`).
- `.../components/contact-texts.ts`: `CONVERSATION_LIST_TEXT`, `CONVERSATION_PREVIEW_LABELS`, `CONTACTS_EMPTY_TEXT` y testids.
- Tests nuevos: `tests/unit/contactos-ui/conversation-list.test.tsx`, `tests/unit/contactos-ui/contacts-empty-states.test.tsx`.
- No tocados: `contacts-screen.tsx`, `page.tsx`, `index.ts` (T14/T15).

### Mapa R → test
| R | Casos |
|---|---|
| R3 | `contacts-empty-states.test.tsx` › «R3: con integraciones.modificar … enlace «Ir a Integraciones»», «R3: sin integraciones.modificar … sin el enlace» |
| R4 | `conversation-list.test.tsx` › «R4: si la búsqueda falla muestra el mensaje y «Reintentar» la repite» |
| R5 | `contacts-empty-states.test.tsx` › «R5: sin chat elegido muestra el estado neutro» (la disposición es T14) |
| R8 | `conversation-list.test.tsx` › «R8: pinta nombre, teléfono, vista previa, hora y contador «N sin leer» en el orden del servidor» |
| R9 | `conversation-list.test.tsx` › «R9: sin vista previa, un último mensaje %s muestra «%s»» (9 casos), «R9: con vista previa la muestra…» |
| R11 | `conversation-list.test.tsx` › «R11: tras la pausa al escribir pide la página 1…», «R11: una búsqueda nueva descarta la respuesta tardía…» |
| R12 | `conversation-list.test.tsx` › «R12: sin búsqueda y sin conversaciones…», «R12: con búsqueda sin resultados… limpiarla»; `contacts-empty-states.test.tsx` › dos casos R12 |
| R13 | `conversation-list.test.tsx` › «R13: al verse el centinela pide la página siguiente, muestra «Cargando más conversaciones…»…», «R13: sin más páginas…», «R13: la página siguiente usa la búsqueda vigente» |
| R14 | `conversation-list.test.tsx` › «R14: al pulsar una conversación avisa con ella y la seleccionada queda marcada» |
| R27 (parcial, lista) | `conversation-list.test.tsx` › «R27: marcar leída una conversación pone su contador a 0» |
| R42 (parcial, lista) | `conversation-list.test.tsx` › «R42: la página 1 de la consulta periódica se fusiona solo si es de la búsqueda vigente» |

Textos sin literal en requirements/tableros: botón del vacío de búsqueda «Limpiar la búsqueda» (el de las otras tablas del
repo; R12 solo dice «la opción de limpiarla»). Defaults P6 usados: «No hay conversaciones que coincidan con la búsqueda.» y
«Elige una conversación para verla aquí.». Etiqueta oculta del buscador «Buscar conversación» (tablero).

### Salida real
- `pnpm run typecheck`: `tsc --noEmit`, sin errores.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, ninguno en archivos de la tanda.
- `pnpm exec vitest related --run <4 archivos de components>`: `Test Files 14 passed (14)` · `Tests 210 passed (210)`.
- Mis dos archivos: `Test Files 2 passed (2)` · `Tests 27 passed (27)`.

Veredicto: T13 hecha con su «Hecho»; typecheck, lint y tests relacionados en verde.

### T14 + D4 (frontend_dev, 2026-10-24)

#### Archivos
- Nuevo `app/(private)/clientes/contactos/components/contacts-screen.tsx`: `ContactsScreen` (`'use client'`). Lista y
  chat lado a lado desde `md` (lista de 360 px, como el tablero) y uno u otro por debajo (`data-view`, `max-md:hidden`;
  sin `useIsMobile`). Selección en la URL: abrir desde la lista hace `pushState` (`?contacto=`), entre chats
  `replaceState`, «Volver a conversaciones» retrocede si la entrada es de la pantalla y si no la quita con
  `replaceState`; `popstate` sincroniza la selección. Carga chat (`{ target, pageSize: 30 }`) y contexto (`{ target }`)
  al abrir; cambio de pedido con `{ target, orderId }`; respuestas descartadas por `targetKey` y secuencia. Poller
  conectado (`createContactsPoller`, puertos inyectables `pollPorts`): fusiona la página 1 con la búsqueda con la que se
  pidió, une el chat abierto, vuelve a marcar leído con entrantes nuevos; nunca pide el contexto. `onChatRead` → `markRead`.
  Teléfono de la cabecera sin contacto (D2): conversación del mismo cliente en la lista o, si no, `requestedCustomer`.
- Nuevo `.../components/contacts-selection.ts`: `CONTACTS_SELECTION_PARAMS`, `selectionFromSearch`, `searchOfSelection`
  (sin `'use client'`: lo podrá usar `page.tsx` en T15).
- Nuevo `.../components/action-rejection.ts`: `unexpectedFromRejection()` (mismo patrón que los diálogos de Pedidos:
  `errorMessage(UNEXPECTED_ERROR_CODE)` + `newRequestId()`) y `settleAction`.
- `.../components/chat-composer.tsx` (D4): envío de texto y de plantilla con `settleAction`.
- `.../components/chat-panel.tsx` (D4 + D2): reintento y anteriores con `settleAction`; prop opcional `customerPhone`
  (cabecera cuando `chat.contact` es `null`).
- `.../components/contact-texts.ts`: `CONTACTS_SCREEN_TESTID`, `CONTACTS_CHAT_PANE_TESTID`.
- Tests: nuevo `tests/unit/contactos-ui/contacts-screen.test.tsx` (22 casos); un caso nuevo en `chat-composer.test.tsx`,
  `send-template-dialog.test.tsx` y `chat-panel.test.tsx`.
- No tocados: `page.tsx`, `index.ts` (T15).

#### Mapa R → test (`contacts-screen.test.tsx` salvo indicación)
| R | Casos |
|---|---|
| R5 | «R5: sin chat elegido, la lista y el estado neutro se ven juntos», «R5: con un chat elegido, la lista y el chat se ven juntos» |
| R6 | «R6: abrir una conversación pasa al chat y «Volver a conversaciones» vuelve a la lista», «R6: «Atrás» del navegador vuelve a la lista», «R6: entre chats se reemplaza la URL…», «R6: abierto desde la URL, «Volver a conversaciones» quita la selección…» |
| R14 | «R14: pide su chat, lo abre y la marca como la seleccionada», «R14: si la carga del chat falla muestra su `message` y «Reintentar» la repite» |
| R27 | «R27: al abrir una conversación con no leídos la marca leída y su contador queda en 0», «R27: si marcar leída falla, el contador se queda» |
| R28 | «R28: con entrantes nuevos en el chat abierto lo vuelve a marcar leído hasta el último» |
| R42 | «R42: trae la página 1 y el chat abierto, y añade la conversación y el mensaje nuevos sin duplicar», «R42: sin chat abierto solo pide la lista» |
| R46 (+ D2) | «R46: abre el chat vacío del cliente sin conversación, con la ventana cerrada y su teléfono», «R46: con conversación, el teléfono sale de la conversación del cliente en la lista», «R46: si el cliente no existe muestra «El cliente solicitado no existe.» junto a la lista» |
| R54 | «R54: al abrir una conversación pide su contexto una vez, solo con `{ target }`», «R54: al cambiar el pedido lo pide con `{ target, orderId }`…», «R54: la consulta periódica no pide el contexto», «R54: la respuesta tardía del contexto de otro chat se descarta», «R54: si el cambio de pedido falla muestra su `message` junto al selector y conserva el pedido», «R54: una red caída al abrir el contexto se pinta como error inesperado con «Reintentar»» |
| R40 (D4) | `chat-composer.test.tsx` › «R40: si la acción no responde (red caída) quita el provisional, devuelve el texto y pinta el error inesperado»; `send-template-dialog.test.tsx` › «R40: si la acción no responde (red caída) el diálogo sigue abierto…» |
| R41 (D4) | `chat-panel.test.tsx` › «R41: si la acción no responde (red caída) pinta el error inesperado y deja el fallido» |

#### Desvíos y huecos
- D2: `WhatsappChat` sin contacto no trae teléfono y la pantalla no tiene el del cliente si no tiene conversación. Se
  añade `requestedCustomer?: { id, phone }` a `ContactsScreen`; **T15 debe cargarlo** en `page.tsx` cuando hay
  `?cliente=` (p. ej. `getCustomerAction`). Sin él, la cabecera sigue con teléfono vacío en ese caso.
- D4: el mensaje genérico es el del catálogo, `errorMessage(UNEXPECTED_ERROR_CODE)` («Ocurrio un error inesperado.
  Intentalo de nuevo.») con su «Código para soporte». En la caja y en el diálogo no hay botón «Reintentar» (R40 no lo
  pide: el texto vuelve a la caja / el diálogo queda abierto y se reenvía con el mismo botón); el «Reintentar» está
  en las cargas (chat, contexto). Si el humano quiere un botón en la caja, falta su texto y su sitio en el tablero.
- La altura de la pantalla (`calc(100dvh - <cabecera>)`) la pone el contenedor de `page.tsx` (design 5.1, T15); la
  pantalla ocupa `h-full`.
- El estado «WhatsApp no está conectado» (R3) lo decide `page.tsx` (design 5.1 paso 5); la pantalla no lo pinta.
- `markWhatsappChatReadAction` en `chat-panel.tsx` sigue sin `catch` (no estaba en D4).
- Textos nuevos: ninguno.

#### Salida real
- `pnpm run typecheck`: `tsc --noEmit`, sin errores.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, ninguno en archivos de la ruta.
- `pnpm exec vitest related --run <6 archivos de components + 4 tests>`: `Test Files 15 passed (15)` · `Tests 235 passed (235)`.

Veredicto: T14 hecha con su «Hecho» y D2/D4 aplicadas; typecheck, lint y tests relacionados en verde.

### T15 — página (frontend_dev, 2026-10-24)

#### Archivos
- `app/(private)/clientes/contactos/page.tsx` (reescrito): `requirePagePermission('whatsapp.consultar')` en la primera
  línea; `searchParams` después; `canSend` (`whatsapp.enviar`) y `canOpenIntegrations` (`integraciones.modificar`) con
  `assertPermission` sobre `currentPlatformActor()`; en un solo `Promise.all`: permisos, lista (página 1, 25),
  plantillas y, con selección, chat (30) y contexto `{ target }`; con `?cliente=` además `getCustomerAction` → 
  `requestedCustomer` (D2: `formatPhoneInternational(phoneE164)` si el teléfono es válido). `connectionStatus: null` →
  `ContactsNotConnected`; error de lista o plantillas → `ContactsLoadError`. `PageShell` mide `calc(100dvh - 3.5rem)`
  (la cabecera privada es `h-14`) y la pantalla ocupa el resto (`flex-1 min-h-0`).
- `.../components/contacts-load-error.tsx` (nuevo, `'use client'`): `ErrorAlert` + «Reintentar» (`router.refresh()`).
- `.../components/contact-texts.ts`: fuera el placeholder (`CUSTOMER_CONTACTS_EMPTY_*`); + `CONTACTS_LOAD_ERROR_TESTID`,
  `CONTACTS_LOAD_ERROR_RETRY_TESTID`.
- `.../components/index.ts`: barrel con lo que usa la página.
- `tests/unit/clientes-ui/contactos-page.test.tsx` (reescrito, 21 casos).
- `tests/guards/guard-pantallas-exigen-permiso.test.ts`: comentario de `/clientes/contactos` → `whatsapp.consultar`.
- `e2e/clientes.spec.ts`, `e2e/movimiento.spec.ts`: importan de `components/contact-texts` (el barrel ya arrastra
  componentes de cliente); el placeholder vacío pasa a «pantalla o sin conexión».

#### Mapa R → test (`contactos-page.test.tsx`)
| R | Casos |
|---|---|
| R1 | «R1: sin sesión redirige al login… y no pide ningún dato», «R1: con sesión sin whatsapp.consultar responde 404 y no pide ningún dato», «R1: exige whatsapp.consultar una sola vez y como primera sentencia…», «R1: con el permiso pinta un único h1…» |
| R3 | «R3: con connectionStatus null pinta solo el estado sin conexión y el enlace a Integraciones», «R3: sin integraciones.modificar no hay enlace «Ir a Integraciones»» |
| R4 | «R4: si la lista falla muestra su mensaje y «Reintentar» vuelve a pedir la página», «R4: si las plantillas fallan…» |
| R46 (+ D2) | «R46: con ?cliente= abre el chat vacío de ese cliente con el teléfono de su ficha», «R46: si el cliente no tiene teléfono válido…», «R46: si el cliente no existe muestra «El cliente solicitado no existe.» junto a la lista», «R46: con ?contacto= no pide la ficha del cliente» |
| R47 | «R47: sin whatsapp.enviar el chat abierto no tiene caja de texto», «R47: con whatsapp.enviar el chat abierto trae la caja» |
| R48 | «R48: la página no importa la composición ni construye la URL de un medio» (el barrido de toda la ruta es T17) |
| R54 | «R54: con selección pide el contexto una sola vez, con el mismo target que el chat», «R54: con ?contacto= el contexto se pide por contacto» |
| carga en paralelo | «pide todo en paralelo: ninguna carga espera a otra», «sin selección pide la página 1 y las plantillas…» |

#### Desvíos y huecos
- design 5.1 dice «`assertPermission` como `canModifyCustomers`», pero ese patrón importa `identity` de
  `@/lib/composition`, que R48 prohíbe en la ruta. Se usa `currentPlatformActor()` (adapters/driving de identity: solo
  el usuario de la sesión, `{ id, permissions }`) + `assertPermission` del barrel. Sin backend nuevo.
- `?cliente=` lee la ficha con `getCustomerAction`, que exige `clientes.consultar`: sin ese permiso (o si el cliente no
  existe) `requestedCustomer` es `null` y la cabecera queda sin teléfono; el «no existe» lo pinta el error del chat.
- R4 para lista y plantillas: `ContactsScreen` no acepta un error inicial, así que lo pinta la página
  (`ContactsLoadError`, compone `ErrorAlert` + `Button`; sin título porque no hay texto para él). Sin conexión gana
  sobre el error de plantillas.
- E2E tocado fuera de T15 solo para no dejar typecheck en rojo; el flujo nuevo es T19.
- Textos nuevos: ninguno («Reintentar» reutiliza `CHAT_PANEL_TEXT.retry`).

#### Salida real
- `pnpm run typecheck`: `tsc --noEmit`, sin errores.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, ninguno en archivos de la ruta.
- `pnpm exec vitest related --run <page.tsx, index.ts, contact-texts.ts, contacts-load-error.tsx, contactos-page.test.tsx>`:
  `Test Files 15 passed (15)` · `Tests 247 passed (247)`.
- `pnpm exec vitest run guard-pantallas-exigen-permiso`: `Test Files 1 passed (1)` · `Tests 9 passed (9)`.

Veredicto: T15 hecha con su «Hecho»; typecheck, lint, tests relacionados y guardia en verde.

### T16 + T17 — menú y frontera (frontend_dev, 2026-10-24)

#### Archivos
- `lib/shared/navigation/private-nav.ts` (M): una sola línea, el `permission` del hijo
  `nav-clientes-contactos` pasa de `clientes.consultar` a `whatsapp.consultar`. El comentario del
  grupo («el permiso de cada hijo es el que exige su pantalla») sigue siendo cierto y no se toca.
- `tests/unit/clientes-ui/private-nav-clientes.test.ts` (M; ya existía, venía de QC-244): los dos
  casos de QC-244 que fijaban `clientes.consultar` para los dos hijos ahora esperan
  `whatsapp.consultar` en Contactos; se añade el bloque `QC-246: el hijo «Contactos» exige
  whatsapp.consultar`.
- `tests/unit/shell/nav-iconos.test.ts` (M): la tabla congelada del menú (R3 de su feature) lleva
  el nuevo permiso de Contactos. Es consecuencia directa de T16.
- `tests/unit/contactos-ui/contactos-frontera.test.ts` (A): detector puro
  `findBoundaryViolations({ ruta, fuente }[])` que barre `app/(private)/clientes/contactos/**`.

#### Mapa R → test
| R | Test |
|---|---|
| R2 | `private-nav-clientes.test.ts` › `QC-246 R2: el hijo declara whatsapp.consultar, el mismo y unico que exige su page.tsx` · `QC-246 R2: con clientes.consultar y sin whatsapp.consultar se ve la lista y NO Contactos` · `QC-246 R2: con whatsapp.consultar el hijo aparece (Administrador del seed)` · `QC-246 R2: <rol>, sin whatsapp.consultar, no recibe el hijo Contactos` |
| R48 | `contactos-frontera.test.ts` › `el codigo real no tiene ninguna violacion` · `falla con un import simulado de @/lib/composition (%s)` · `falla con una ruta profunda que no es adapters/driving (%s)` · `falla con el literal de la ruta de medios en la ruta (%s)` · `falla si construye la URL con la constante de la ruta de medios` |

Las fuentes de prueba de R48 se fabrican en memoria y se pasan al detector; no se escribe nada en
`app/`. Dos anclas evitan que el caso real pase en vacío: el barrido encuentra `page.tsx` y más de
10 componentes, y la ruta real sí importa `adapters/driving` y usa `mediaUrl`.

#### Desvíos y huecos
- La task dice «crea» `private-nav-clientes.test.ts`, pero ya existía (QC-244). Se amplió en lugar
  de crear otro archivo con el mismo nombre.
- Se tocó `tests/unit/shell/nav-iconos.test.ts` (fuera de lo que pide la task), porque su tabla
  congelada se ponía roja con T16.
- Rojo preexistente que no es de esta tanda: `tests/unit/recetas-ui/recipe-route-contract.test.ts`
  › «lib/shared/routes.ts no gana ninguna constante para el asistente y publica exactamente las de
  hoy». Falla porque `routes.ts` publica `WHATSAPP_MEDIA_ROUTE_BASE` y `whatsappMediaPath`, que
  llegaron con el commit de QC-245 `a7a9bad4`. `routes.ts` no tiene cambios en este worktree. Hay
  que actualizar esa lista en QC-245 o aquí, con decisión del leader.

#### Salida real
- `pnpm run typecheck` (`tsc --noEmit`): sin errores.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, todos en archivos ajenos. Con
  `pnpm exec eslint` sobre los 4 archivos tocados: `No issues found`.
- `pnpm exec vitest related --run lib/shared/navigation/private-nav.ts tests/unit/clientes-ui/private-nav-clientes.test.ts tests/unit/contactos-ui/contactos-frontera.test.ts`:
  `Test Files 2 failed | 145 passed (147)` · `Tests 2 failed | 2372 passed | 22 skipped (2396)`.
  Los 2 rojos eran `nav-iconos.test.ts`, ya corregido, y `recipe-route-contract.test.ts`, el
  preexistente de arriba.
- `pnpm exec vitest run tests/unit/shell/nav-iconos.test.ts tests/unit/contactos-ui/contactos-frontera.test.ts tests/unit/clientes-ui/private-nav-clientes.test.ts guard-nav-permisos-declarados`:
  `Tests 71 passed (71)`, en verde después de corregir.
- `git diff --stat -- lib/shared/navigation/private-nav.ts`:
  ```
  lib/shared/navigation/private-nav.ts | 2 +-
   1 file changed, 1 insertion(+), 1 deletion(-)
  ```

Veredicto: T16 y T17 cumplen su «Hecho». Queda en rojo `recipe-route-contract`, que viene de QC-245 y no de esta tanda.

### Salida real de la tanda 4 (implementer)
- `pnpm run typecheck`: `tsc --noEmit`, sin errores.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, ninguno en archivos de la tanda.
- `pnpm exec vitest related --run <archivos .ts/.tsx cambiados, sin e2e>`: `Test Files 1 failed | 161 passed (162)` ·
  `Tests 1 failed | 2608 passed | 22 skipped (2631)`. El rojo es
  `tests/unit/recetas-ui/recipe-route-contract.test.ts` (lista exacta de `lib/shared/routes.ts` sin
  `WHATSAPP_MEDIA_ROUTE_BASE`/`whatsappMediaPath`), ajeno: ni el test ni `routes.ts` cambian en esta tanda y QC-245 ya
  lo corrigió en `28d80a81`, posterior al merge de apilado `bc929f03`. Se va al volver a mergear QC-245.
- `pnpm exec vitest run guard`: `Test Files 87 passed (87)` · `Tests 1324 passed | 22 skipped (1346)`.
- `./init.sh`: rojo solo por `feature_list.json` (ids 290–298 duplicados, en vuelo sin assignee QC-162/166/262/263/264,
  zona backend 4/3), ajeno.
- E2E: no procede (T19); `e2e/clientes.spec.ts` y `e2e/movimiento.spec.ts` ajustados al quitar el placeholder viejo, sin correr.

Veredicto: T13–T17 hechas con su «Hecho»; D2 y D4 aplicadas.

## T18 — Clientes: «Abrir chat» (frontend_dev)

### Archivos
- Nuevo: `app/(private)/clientes/components/customer-chat-link.tsx` (compone `buttonVariants` + `MessageSquare`;
  href con `CUSTOMER_CONTACTS_ROUTE` + `URLSearchParams` y la clave `CONTACTS_SELECTION_PARAMS.customer`).
- Modificados: `app/(private)/clientes/page.tsx` (`canChatWithCustomers`, mismo patrón que `canModifyCustomers`),
  `components/customer-list-section.tsx`, `components/customer-table.tsx`, `components/customer-columns.tsx`
  (`canChat?` opcional, por defecto `false`; el chat va delante de `rowActions` en la celda de acciones),
  `components/index.ts` (barrel).
- Tests: nuevo `tests/unit/clientes-ui/customer-chat-link.test.tsx`; `tests/unit/clientes-ui/clientes-page.test.tsx`
  (bloque R45 de página); snapshot `tests/unit/paridad/__snapshots__/clientes-paridad.test.tsx.snap` actualizado
  (la sesión de paridad trae `whatsapp.consultar`: aparece «Abrir chat» en la fila; cambio esperado por R45).
- La lista de Clientes no usa tarjetas de `DataTable` (sin prop `card`): en teléfono pinta la misma celda de acciones,
  así que tabla y teléfono comparten el enlace.

### R45 → test
- `tests/unit/clientes-ui/customer-chat-link.test.tsx` (14 casos `R45 — ...`: href `?cliente=<id>`, nombre accesible,
  codificación, 44 px, orden en la celda, «Sin teléfono válido» ×4, nada sin permiso ×4, sin literal de ruta).
- `tests/unit/clientes-ui/clientes-page.test.tsx > R45 — canChat sale de assertPermission con whatsapp.consultar` (3 casos).

### Salida real
- `pnpm run typecheck`: `tsc --noEmit`, sin errores.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, ninguno en archivos de T18.
- `pnpm exec vitest related --run <6 archivos de app + 3 tests>`: `Test Files 23 passed (23)` · `Tests 472 passed (472)`
  (antes de actualizar el snapshot: 1 failed, `clientes-paridad > con filas`).
- `pnpm exec vitest run guard`: `Test Files 87 passed (87)` · `Tests 1324 passed | 22 skipped (1346)`.

Veredicto: T18 hecha con su «Hecho»; R45 cubierto.

## T19 — E2E `e2e/contactos-chat.spec.ts`

- Creado: `e2e/contactos-chat.spec.ts`. Modificado: `tests/guards/guard-identificador-de-request.test.ts`
  (alta de `contactos-chat.spec.ts` en la lista cerrada `E2E_ESPERADOS`, su punto de extensión; sin ella la
  guardia daba rojo «archivo nuevo en e2e/»).
- NO se ha corrido contra la base: la local compartida no tiene las migraciones de QC-245 (orden del leader).
  El «Hecho» de T19 («el spec pasa en local») queda PENDIENTE de una base migrada o del job E2E de CI.

### R → caso (nombre exacto, en `el chat de WhatsApp de Contactos`)
- R42, R32, R19 → `R42, R32, R19: el entrante firmado aparece en la lista y en el chat sin recargar, la respuesta pasa por «Enviando» y «Enviado» y el status delivered la deja «Entregado»`
- R1, R45 (sin permiso) → `R1, R45: sin `whatsapp.consultar` (empresa sin el añadido de integraciones) la ruta responde 404 y Clientes no ofrece «Abrir chat»`
- R45, R46 → `R45, R46: «Abrir chat» desde Clientes lleva a `?cliente=<id>` con el chat del cliente abierto, o vacio y con la ventana cerrada si no tiene conversacion`
- R6, R7 → `en el telefono > R6, R7: a 390 × 844 se ve la lista o el chat, se vuelve con «Volver a conversaciones» y con «Atrás», sin scroll horizontal`

### Salida real
- `pnpm run typecheck`: `tsc --noEmit`, exit 0 (incluye `e2e/`: `tsconfig.json` incluye `**/*.ts`).
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, ninguno en archivos de T19; `eslint` de los 2 archivos: sin problemas.
- `pnpm exec playwright test e2e/contactos-chat.spec.ts --list`: `Total: 8 tests in 1 file` (4 casos × chromium, webkit).
- `pnpm exec vitest run guard`: antes del alta en `E2E_ESPERADOS` `1 failed | 86 passed (87)`; después
  `Test Files 87 passed (87)` · `Tests 1324 passed | 22 skipped (1346)`.

Veredicto: T19 escrito y verificado estáticamente; falta correrlo contra una base con las migraciones de QC-245.

## Tanda 5 (2026-10-24) — T18, T19, T20 (implementer)

### Spec
- `design.md > 5.1`: `canSend`/`canOpenIntegrations` con `currentPlatformActor()` + `assertPermission`, no con
  `canModifyCustomers` (importa `@/lib/composition`, prohibido en la ruta por R48).
- `requirements.md > Decisiones cerradas`: D17 (error de red al enviar sin «Reintentar» junto a la caja; el texto
  vuelve y se reenvía con enviar) y D18 (teléfono de cabecera vía `getCustomerAction`; sin `clientes.consultar`
  o sin teléfono válido, sin teléfono).

### Mapa consolidado R1–R54 → test (archivos en `tests/unit/contactos-ui/` salvo indicación; casos en las secciones de arriba)
| R | Test |
|---|---|
| R1 | `clientes-ui/contactos-page.test.tsx`; E2E `contactos-chat.spec.ts` › «R1, R45: …404…» |
| R2 | `clientes-ui/private-nav-clientes.test.ts` |
| R3 | `contacts-empty-states.test.tsx`, `clientes-ui/contactos-page.test.tsx` |
| R4 | `conversation-list.test.tsx`, `chat-panel.test.tsx`, `clientes-ui/contactos-page.test.tsx` |
| R5 | `contacts-screen.test.tsx`, `contacts-empty-states.test.tsx` |
| R6 | `contacts-screen.test.tsx`, `chat-header.test.tsx`; E2E › «R6, R7: a 360 × 844…» |
| R7 | solo E2E, a 360 px (sin unit: jsdom no maqueta, un `scrollWidth` en jsdom vale 0 y sería vacío): «R6, R7: a 360 × 844 …» (lista y chat de texto) y «R7: a 360 px no hay scroll horizontal con las burbujas de plantillas, el detalle del pedido, el dialogo «Enviar plantilla», cada tipo de mensaje y el visor de imagen» (imagen, sticker, ubicación, reacción, fallido). Mide `documentElement` y cada contenedor visible |
| R8, R9, R11, R12 | `conversation-list.test.tsx` (R12 también `contacts-empty-states.test.tsx`) |
| R10 | `chat-time-format.test.ts` |
| R13 | `conversation-list-state.test.ts`, `conversation-list.test.tsx`, `chat-message-list.test.tsx` |
| R14 | `conversation-list.test.tsx`, `contacts-screen.test.tsx` |
| R15, R16 | `chat-header.test.tsx` (R15 también `chat-time-format.test.ts`); R16 → R30 también `chat-composer.test.tsx` › «R16 · R30: al llegar `closesAt` la caja pasa sola a ventana cerrada…» y «…más de 24,8 días…» |
| R17 | `chat-time-format.test.ts`, `chat-timeline.test.ts`, `chat-message-list.test.tsx` |
| R18, R20, R21, R22, R24 | `chat-view.test.ts`, `chat-message.test.tsx` |
| R19 | `chat-view.test.ts`, `chat-message.test.tsx`; E2E › «R42, R32, R19: …» |
| R23 | `chat-message.test.tsx` |
| R25 | `chat-timeline.test.ts`, `chat-message-list.test.tsx`, `chat-panel.test.tsx` |
| R26 | `chat-message-list.test.tsx` |
| R27 | `chat-panel.test.tsx` (incl. «R27 · D4: si marcar leída rechaza, no deja promesa sin capturar ni pinta error»), `conversation-list.test.tsx`, `contacts-screen.test.tsx` |
| R28 | `contacts-poller.test.ts`, `contacts-screen.test.tsx` |
| R29, R30 | `chat-composer.test.tsx` |
| R31, R34 | `chat-composer.test.tsx`, `send-template-dialog.test.tsx` |
| R32 | `chat-composer.test.tsx`, `chat-panel.test.tsx`; E2E › «R42, R32, R19: …» |
| R33 | `chat-composer.test.tsx`, `chat-panel.test.tsx` |
| R35 | `template-values.test.ts` |
| R36, R37 | `template-values.test.ts`, `chat-composer.test.tsx` |
| R38, R39 | `chat-view.test.ts`, `chat-header.test.tsx` (R38 también `template-values.test.ts`) |
| R40 | `chat-composer.test.tsx`, `send-template-dialog.test.tsx` |
| R41 | `chat-view.test.ts`, `template-values.test.ts`, `chat-message.test.tsx`, `chat-panel.test.tsx` |
| R42 | `contacts-poller.test.ts`, `chat-timeline.test.ts`, `conversation-list-state.test.ts`, `conversation-list.test.tsx`, `contacts-screen.test.tsx`; E2E › «R42, R32, R19: …» |
| R43, R44 | `contacts-poller.test.ts` |
| R45 | `clientes-ui/customer-chat-link.test.tsx`, `clientes-ui/clientes-page.test.tsx`; E2E › «R1, R45», «R45, R46» |
| R46 | `contacts-screen.test.tsx`, `clientes-ui/contactos-page.test.tsx`; E2E › «R45, R46: …» |
| R47 | `chat-composer.test.tsx`, `clientes-ui/contactos-page.test.tsx` |
| R48 | `contactos-frontera.test.ts`, `clientes-ui/contactos-page.test.tsx` |
| R49 | `chat-panel.test.tsx` |
| R50, R51 | `shared-ui/whatsapp-system-constants.test.ts`, `integraciones-ui/whatsapp-template-rules.test.ts` |
| R52 | `integraciones-ui/whatsapp-variables-panel.test.tsx`, `…-template-relate-sheet.test.tsx`, `…-template-form-sheet.test.tsx`, `…-template-rules.test.ts` |
| R53 | `integraciones-ui/whatsapp-template-rules.test.ts` |
| R54 | `contacts-poller.test.ts`, `chat-view.test.ts`, `chat-header.test.tsx`, `contacts-screen.test.tsx`, `clientes-ui/contactos-page.test.tsx` |

Huecos: **R7** solo tiene el E2E (sin correr en local), y a 390 px, no a los 360 px que nombra R7; ni el diálogo de
plantilla ni el visor de imagen se miden. Ningún R sin test.

### Salida real (implementer)
- `pnpm run typecheck`: `tsc --noEmit`, exit 0.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)` (ninguno de la tanda).
- `pnpm exec vitest related --run <9 archivos .ts/.tsx cambiados, sin e2e>`: `Test Files 24 passed (24)` · `Tests 495 passed (495)`.
- `pnpm exec vitest run guard`: `Test Files 87 passed (87)` · `Tests 1324 passed | 22 skipped (1346)`.
- `./init.sh`: ROJO en el paso de `feature_list.json` (ids 290–298 duplicados, en vuelo sin assignee, zona backend 4/3): el mismo rojo ajeno de las tandas anteriores.
- `node scripts/archivos-en-vuelo.mjs --candidata QC-246`: único choque QC-166 en `lib/shared/navigation/private-nav.ts`, aceptado (D9).
- E2E NO corrido en local (`contactos-chat`, `clientes`, `movimiento`): la única base local es la compartida
  `localhost:5432/QuimiCloude` y `prisma migrate status` da historia divergente: le faltan las 4 migraciones de
  QC-245 (`20261023120000_whatsapp_send_permission`, `20261023130000_whatsapp_outbound_messages`,
  `20261024120000_whatsapp_read_permission`, `20261024130000_whatsapp_contacts_last_read`) y tiene 3 de otra rama que
  aquí no existen. Migrarla rompería a las otras sesiones; Docker no está levantado para una base propia. Quedan
  para el job E2E de CI. `playwright test e2e/contactos-chat.spec.ts --list`: `Total: 8 tests in 1 file`.

## Correcciones del review (2026-10-24, commit `aacbf406` → este)

### Hallazgos
- **B2 (R7):** `e2e/contactos-chat.spec.ts`: teléfono a 360 × 844; `expectNoHorizontalScroll` mide `documentElement` y los contenedores visibles (pantalla, lista, panel, cabecera, detalle del pedido, mensajes, vacío, caja, burbujas, diálogo, visor). Test hermano «R7: a 360 px …» con plantilla aprobada y pedido `PENDIENTE` sembrados, entrante de hace 25 h (ventana cerrada), imagen y sticker por el webhook (doble `downloadMedia`), ubicación, reacción y `status: failed`. Limpieza nueva `deleteOrderData`. Todos los estados caben en el E2E: no hizo falta test de componente. **Sin correr** (B1, CI): supuestos por confirmar en la primera corrida: el webhook acepta `timestamp` de hace 25 h, la consulta periódica trae la reacción y el `failed`, la vista previa del diálogo contiene el texto de la plantilla.
- **m1:** `use-window-open.ts` (nuevo, `setTimeout` hasta `closesAt`, con tope de 2^31−1 ms y reprogramación); `chat-composer.tsx` decide el modo con él.
- **m2 (R18): NO corregido, bloqueado.** El nombre del usuario actual no llega a la pantalla sin backend: `currentPlatformActor()` (`lib/modules/identity/adapters/driving/platform-session.ts`) devuelve `{ id, permissions }` sin `displayName`; la página no puede importar `@/lib/composition` (frontera R48) y en cliente no hay contexto con el usuario. Requiere que backend exponga `displayName` (o una función hermana); luego en front: `currentUserName` por `ContactsScreen` → `ChatPanel` → `ChatComposer`. Decisión del leader.
- **m3:** `design.md` (tabla de acciones, `retryWhatsappMessageAction`, y §5.4 «Reintento») recoge el desvío aprobado: todas las constantes del sistema con valor.
- **m4:** del leader (no tocado).
- **m5:** `chat-panel.tsx`: `markWhatsappChatReadAction` dentro de `settleAction`.
- **m6:** `tasks.md > Archivos esperados` completo contra `git diff --name-only origin/feature/QC-245-contactos-whatsapp-backend...HEAD` (+ `use-window-open.ts`); comprobado por script: ninguno falta.

### Salida real (implementer)

- `pnpm run typecheck`: `tsc --noEmit`, exit 0.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)` (ninguno en archivos tocados; `eslint e2e/contactos-chat.spec.ts`: sin problemas).
- `pnpm exec vitest related --run chat-composer.tsx chat-panel.tsx use-window-open.ts chat-composer.test.tsx chat-panel.test.tsx`: `Test Files 6 passed (6)` · `Tests 114 passed (114)`.
- `pnpm exec vitest run guard`: 1.ª corrida `1 failed | 86 passed` (`guard-asignacion-componentizada`, ajena al diff; sola pasa 22/22 en 38 s: flake de saturación); 2.ª corrida `Test Files 87 passed (87)` · `Tests 1324 passed | 22 skipped (1346)`.
- `pnpm exec playwright test e2e/contactos-chat.spec.ts --list`: `Total: 10 tests in 1 file` (incluye «R6, R7: a 360 × 844 …» y «R7: a 360 px …» en chromium y webkit). E2E sin correr: B1, en CI.

## Fix R7 · diálogo «Enviar plantilla» desborda a 360 px (rojo E2E en CI, e2e/contactos-chat.spec.ts:888)

- **Causa:** `DialogContent` es `grid` con pista `auto`; sus hijos no llevaban `min-w-0` y el `SelectTrigger` (`whitespace-nowrap`) aportaba como min-content el nombre entero de la plantilla (~558 px). `WaBubble` ya parte con `[overflow-wrap:anywhere]`.
- **Archivos:** `app/(private)/clientes/contactos/components/send-template-dialog.tsx` (`min-w-0` en cabecera, cuerpo, columnas, error y footer; `[overflow-wrap:anywhere]` en título, descripción, faltantes y error; `triggerClassName` con `min-w-0` + `*:data-[slot=select-value]:min-w-0 truncate` en ambos selectores; `optionClassName` que parte el texto de la opción). `tests/unit/contactos-ui/send-template-dialog.test.tsx` (nuevo `R7: …`). Primitivos de `components/ui` sin tocar.
- **R7 → test:** `send-template-dialog.test.tsx > R7: con un nombre de plantilla largo sin espacios, el cuerpo encoge y el selector trunca la etiqueta` (estructural; falla con el código anterior: verificado). Mide de verdad el E2E R7.
- **Salida:** `pnpm exec tsc --noEmit` sin errores; `eslint` sobre los 2 archivos sin avisos; `vitest run send-template-dialog.test.tsx`: 13 passed (13); `vitest related --run send-template-dialog.tsx`: 6 files, 115 passed (115). E2E sin correr (CI).
- **Veredicto:** desborde corregido en el componente; queda confirmar en la corrida E2E de CI.

## Fix E2E · `e2e/clientes.spec.ts:438` sin el hijo «Contactos» en el menú (rojo en CI)

- **Causa:** desde QC-246 el hijo «Contactos» exige `whatsapp.consultar` (D1, R1/R2), del añadido `integraciones`. La empresa efímera del `beforeAll` nacía sin añadidos y la sesión recortaba el permiso al Administrador.
- **Archivo:** `e2e/clientes.spec.ts`: `enableAllAddons(companyId)` (de `./helpers/addons`) tras crear la empresa; cabecera («LO QUE ESTE SPEC NO CREA») y comentarios del `beforeAll`/`afterAll` explican el motivo y remiten el caso sin añadido a `e2e/contactos-chat.spec.ts` («R1, R45…»); título del test con `QC-246 R2`.
- **Comprobado:** `CompanyAddonOverride.company` tiene `onDelete: Cascade` (`db/schema.prisma`), así que el `afterAll` borra la empresa igual. Aterrizaje: `homeHrefFor` toma el primer item visible; con más permisos solo puede salir uno igual o anterior, nunca `/clientes` ni `/clientes/contactos`. Operador sin permisos de añadidos (`SEED_ROLE_PERMISSIONS`): su test no cambia. No se relajó ningún assert.
- **Salida:** `pnpm exec tsc --noEmit` exit 0; `pnpm exec eslint e2e/clientes.spec.ts` exit 0, sin avisos; `pnpm exec playwright test e2e/clientes.spec.ts --list`: `Total: 6 tests in 1 file`. E2E sin correr (base local sin migraciones de QC-245).
- **Veredicto:** fixture corregida; queda confirmar en la corrida E2E de CI.

### Verificación del implementer (fix de los 2 rojos E2E de CI, run 40152044453)

- `pnpm run typecheck`: `tsc --noEmit`, exit 0.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)` (preexistentes; `eslint` sobre los 3 archivos tocados: `No issues found`).
- `pnpm exec vitest related --run send-template-dialog.tsx send-template-dialog.test.tsx`: `Test Files 6 passed (6)` · `Tests 115 passed (115)`.
- `pnpm exec vitest run guard`: `Test Files 87 passed (87)` · `Tests 1324 passed | 22 skipped (1346)`.
- E2E sin correr en local (base compartida sin las migraciones de QC-245): se confirma en CI.

## Fix E2E · `e2e/contactos-chat.spec.ts:800` «R7: a 360 px…» (run 40155450179, chromium y webkit)

- **Síntoma 1 (chromium, línea 933, `toContainText(longWord)`):** error del test. La palabra larga solo iba en `error_data.details` del status `failed`, pero la burbuja no pinta ese campo: el motivo sale del código de Meta (`131026` → «Meta no aceptó el mensaje…»). El texto del fallido era `Le enviamos la factura <6 chars>`, sin palabra larga. **Cambio:** `failedText = \`Le enviamos la factura ${longWord}\`` (el locator `messageBubble(... failedText)` y la fila de Prisma por `body` siguen coincidiendo); `details` queda corto. Se sigue midiendo que un fallido con palabra larga no desborde a 360 px.
- **Síntoma 2 (webkit, línea 901 `tap` sobre «Enviar», 30 s):** el log dice `element is not enabled` (el botón existe, visible, no tapado). «Enviar» se deshabilita con el borrador vacío (`canSendText`). El chat se abre con `page.goto(?cliente=)` y la cabecera llega del servidor antes de hidratar; el `fill` cayó antes de la hidratación y no llegó al estado de React, así que el botón quedó deshabilitado. No es un desborde ni un control tapado a 360 px: no hay bug de R7 en la pantalla. En R42 (`:592`) no pasa porque abre el chat con `openConversation`, que ya reintenta. **Cambio:** `sendAndWaitSent` repite `fill('')` + `fill(text)` dentro de `toPass` hasta que `sendButton` está habilitado y luego toca; mismo patrón que `tapUntilVisible`/`openConversation` del archivo.
- **Archivo:** `e2e/contactos-chat.spec.ts` (solo el paso «imagen, sticker, ubicación, reacción y fallido»). Componentes sin tocar.
- **Salida:** `pnpm run typecheck` exit 0; `pnpm exec eslint e2e/contactos-chat.spec.ts` sin avisos; `vitest related --run e2e/contactos-chat.spec.ts`: sin tests relacionados (e2e excluido de vitest); `pnpm exec vitest run guard`: `Test Files 87 passed (87)` · `Tests 1324 passed | 22 skipped (1346)`; `pnpm exec playwright test e2e/contactos-chat.spec.ts --list`: `Total: 10 tests in 1 file`. E2E sin correr en local (base sin migraciones de QC-245): se confirma en CI.
