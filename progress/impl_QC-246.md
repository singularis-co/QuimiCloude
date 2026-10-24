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
