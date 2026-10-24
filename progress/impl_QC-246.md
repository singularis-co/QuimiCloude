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
