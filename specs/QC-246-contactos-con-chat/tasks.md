# QC-246 — contactos-con-chat · tasks.md

Zona `frontend`. Sin Server Actions, base de datos ni migraciones. Ninguna dependencia nueva.
Verificación de cada tanda: `pnpm run typecheck`, `pnpm run lint`,
`pnpm exec vitest related --run <archivos>` y `pnpm exec vitest run guard`. E2E:
`pnpm exec playwright test e2e/contactos-chat.spec.ts`.

**Bloqueo de arranque:** F2 no empieza hasta que QC-245 esté en `dev` **con la Enmienda 1**
(contrato v2: `getWhatsappChatContextAction`, `attachment.mediaUrl`, reacciones por id interno) y el
permiso `whatsapp.consultar` (T0 ya está hecha). Excepción: T1, T2 y T21 no dependen de QC-245 y
pueden hacerse antes. `[P]` = paralelizable con las demás `[P]` de su bloque.

## Bloque 0 — Diseño y base

- [x] **T0** — Copiar los siete tableros aprobados del canvas a `docs/diseno/canvas/` con los nombres
  de `design.md > Referencia de diseño`. **Hecha por el leader (2026-10-23, `requirements.md > D10`).**
  El implementer no los toca.
- [x] **T1** `[P]` — Subir `WaBubble` a `components/shared/wa-bubble.tsx`; el archivo viejo
  queda como `export * from '@/components/shared/wa-bubble'`. Fila nueva en `CATALOGO.md` con
  `Diseño` = `docs/diseno/canvas/WaBurbuja.dc.html`.
  *Hecho:* `tests/unit/integraciones-ui/wa-bubble.test.tsx` y los de plantillas siguen verdes sin
  cambiar; `guard-catalogo-de-componentes` verde.
- [x] **T2** `[P]` — Subir `whatsapp-system-constants.ts` a `lib/shared/ui/`; el viejo reexporta.
  Fila en `CATALOGO.md` (`sin UI`). Solo el movimiento: la lista no cambia aquí.
  *Hecho:* tests de QC-243 verdes sin cambios; ningún importador de QC-243 cambia su import;
  guardias verdes.
- [x] **T21** (dep. T2) — Las cuatro constantes nuevas al final de `SYSTEM_CONSTANTS` en
  `lib/shared/ui/whatsapp-system-constants.ts`, con los textos de `design.md > 6.1` (default de P12).
  Ampliar —nunca relajar— los tests de QC-243 que enumeran la lista. Sin cambios en ningún archivo de
  `app/(private)/integraciones/whatsapp/components/` salvo la reexportación de T2.
  *Hecho:* `tests/unit/shared-ui/whatsapp-system-constants.test.ts` (nuevo) cubre R50 (las siete en
  orden; las tres actuales intactas) y R51 (clave suelta y texto en los dos sentidos;
  `constantLabelsForBackend` con las siete); `whatsapp-variables-panel.test.tsx` y
  `whatsapp-template-relate-sheet.test.tsx` ampliados cubren R52 (panel y diccionario con las
  siete; al relacionar se guarda `pedido.estado`); `whatsapp-template-rules.test.ts` ampliado cubre
  R50/R51 desde el lado de QC-243 y R53 (clave propia `estado_del_pedido` → aviso de clave ocupada);
  `whatsapp-template-form-sheet.test.tsx` ampliado (inserción de `detalle_del_pedido` y su etiqueta
  al guardar). `e2e/integraciones-whatsapp-plantillas.spec.ts` sigue verde sin cambios.

## Bloque 1 — Lógica pura (sin UI)

- [x] **T3** `[P]` — `chat-view.ts`: tipos locales; `toChatMessages` (tipos, estados, autor,
  `retryable`, `src` = `attachment.mediaUrl`, reacciones por `attachment.messageId`) y `toChatContext`
  (pedidos con `ORDER_STATUS_LABELS` y `orderDistributionLineText`, `total` tal cual, `values` sin
  tocar).
  *Hecho:* tests de R19, R20, R21/R22 (`src` desde `mediaUrl`; `null` en audio/video/documento),
  R24 (con objetivo; `messageId: null` no pinta; objetivo que llega después con anteriores; emoji
  nulo; la más reciente gana), R41 (`retryable`), R38/R39 (`toChatContext` con 0, 1 y 2 pedidos,
  orden recibido, total `null` → `totalLabel: null`, presentación sin nombre → «N × —», sin fecha de
  entrega).
- [x] **T4** `[P]` (dep. T21) — `template-values.ts`: `resolveTemplate`, `systemConstantsFor`, texto
  «Falta el valor de …».
  *Hecho:* tests de R35 (todas las claves con `values`; clave ausente y valor `null` →
  `[falta <clave>]`; `pedido.total` nulo → `[falta pedido.total]`; encabezado/cuerpo/pie), R36
  (`missing` con las etiquetas del catálogo, incluidas las cuatro nuevas, y texto con 1, 2 y 3
  faltantes), R37/R41 (`constants` sin las nulas ni las propias), R38 (otros `values` → otro texto).
- [x] **T5** `[P]` — `chat-timeline.ts` y `conversation-list-state.ts`: unir por id, ordenar, separar
  por día, anteponer anteriores sin duplicar, fusionar la página 1 del poller.
  *Hecho:* tests de R13 (sin repetidos), R17 (orden y separadores), R25 (anteriores), R42 (fusión sin
  duplicar, estado nuevo reemplaza al viejo).
- [x] **T6** `[P]` — `chat-time-format.ts`: hora de la lista, separador de día, cuenta atrás de la
  ventana.
  *Hecho:* tests con reloj fijo de R10, R15 (con y sin horas) y R17.
- [x] **T7** `[P]` — `contacts-poller.ts` con puertos de visibilidad y temporizador.
  *Hecho:* tests con puertos falsos de R42 (8 s tras el fin de la anterior), R43 (oculta no consulta,
  visible consulta ya), R44 (error sigue, `unauthorized` para), R28 (avisa de entrantes nuevos),
  R54 (el turno no pide el contexto).

## Bloque 2 — Componentes del chat (dep. T1, T3–T6)

- [x] **T8** `[P]` — `chat-message.tsx`, `chat-message-status.tsx`, `chat-location-card.tsx`,
  `chat-media-image.tsx`, `chat-image-viewer.tsx`.
  *Hecho:* tests de componente de R18, R19, R20, R21 (con `src`: abre y cierra con botón y Escape;
  sin `src`: «[Imagen]» y no abre; `error` en el `<img>`: «Imagen no disponible» en la miniatura y en
  el visor), R22 (sticker de 128 px; sin `src`: «[Sticker]»; `error`: «Imagen no disponible»), R23
  (enlace en pestaña nueva con las coordenadas), R24 (nombre accesible de la reacción), R41 (botón
  solo en `retryable` con `canSend`).
- [x] **T9** `[P]` — `chat-message-list.tsx` y `use-end-sentinel.ts`.
  *Hecho:* tests de R17 (separadores), R25 (pide con `nextCursor` al ver el centinela, «Cargando
  mensajes anteriores…»), R26 (al final al abrir; desplaza solo si estaba al final).
- [x] **T10** `[P]` — `chat-header.tsx`, `chat-window-badge.tsx`, `chat-order-detail.tsx`.
  *Hecho:* tests de R15, R16 (pasa a cerrada al llegar `closesAt` con reloj falso), R38 (selector solo
  con más de un pedido abierto, por número, con `selectedOrderId` elegido), R39 (flecha con
  `aria-expanded`/`aria-controls`; número, estado, producto, filas por línea; total oculto si es
  `null` y visible con valor; ninguna fecha de entrega), R6 (botón «Volver a conversaciones»), R54
  (error al cambiar de pedido junto al selector).
- [x] **T11** — `chat-composer.tsx`, `chat-template-chips.tsx`, `send-template-dialog.tsx` (dep. T4,
  T8).
  *Hecho:* tests de R29 (Enter, Shift+Enter, vacío, 4096), R30, R31 (sin campos de variables; pedido
  solo con más de uno abierto), R32, R33 (rellenar, `aria-pressed`, quitar), R34 (solo lectura), R36
  (envío deshabilitado con `[falta pedido.total]`), R37 (`recipient` por cliente, `constants` de
  `values`, recarga), R40, R47 (sin `whatsapp.enviar` no hay caja ni plantillas).
- [x] **T12** — `chat-panel.tsx` (dep. T8–T11).
  *Hecho:* tests de R27 (marca leído al abrir con el último id), R33 (vacío del chat), R4 (error del
  chat y del contexto con «Reintentar»), R49 (ningún botón ni enlace con nombre que contenga
  «Vincular», «Desvincular» o «Bloquear», con contacto vinculado, bloqueado y sin contacto).

## Bloque 3 — Lista y pantalla

- [x] **T13** `[P]` (dep. T5, T6) — `conversation-list.tsx`, `conversation-list-item.tsx`,
  `contacts-empty-states.tsx`.
  *Hecho:* tests de R8, R9, R11 (búsqueda desde página 1 tras la pausa), R12 (dos vacíos), R13
  (centinela y «Cargando más conversaciones…»), R14, R3 (enlace solo con `integraciones.modificar`).
- [x] **T14** (dep. T7, T12, T13) — `contacts-screen.tsx`: dos columnas / una, selección en la URL
  (`?contacto=`, `?cliente=`), poller conectado, contador a 0 tras marcar leído, contexto del chat
  abierto (`design.md > 5.4.1`).
  *Hecho:* tests de R5, R6 (cambio de vista y «Atrás»), R14, R27 (contador a 0), R42 (integra lo
  nuevo), R46, R54 (contexto con `{ target }` al abrir, con `{ target, orderId }` al cambiar, nunca en
  el poller; respuesta tardía de otro chat descartada; error conserva el pedido anterior).
- [x] **T15** (dep. T14) — `page.tsx`, `contact-texts.ts`, `index.ts`: corte con
  `whatsapp.consultar`, `canSend`, `canOpenIntegrations`, carga inicial en paralelo (con el contexto
  si hay selección).
  *Hecho:* `tests/unit/clientes-ui/contactos-page.test.tsx` reescrito: R1 (login / 404 antes de
  pedir datos), R3, R46 (por cliente; «El cliente solicitado no existe.»), R54 (contexto en la carga
  inicial con selección). Comentario de `/clientes/contactos` en `guard-pantallas-exigen-permiso`
  actualizado al permiso nuevo; guardia verde.
- [x] **T16** `[P]` — Menú: el hijo `nav-clientes-contactos` declara `whatsapp.consultar`.
  Choque **aceptado** con QC-166 en `lib/shared/navigation/private-nav.ts` (`requirements.md > D9`):
  rebasar la rama sobre `dev` **antes** de tocar el archivo y cambiar **solo** la entrada de
  Contactos.
  *Hecho:* el diff de `private-nav.ts` se limita a la entrada de Contactos; `tests/unit/clientes-ui/private-nav-clientes.test.ts` cubre R2;
  `guard-nav-permisos-declarados` verde.
- [x] **T17** `[P]` — Test de frontera R48 sobre `app/(private)/clientes/contactos/**`.
  *Hecho:* falla con un import simulado de `@/lib/composition` y con un literal
  `/api/integraciones/whatsapp/media` en la ruta; pasa con el código real.

## Bloque 4 — Clientes

- [x] **T18** `[P]` — `customer-chat-link.tsx` + `canChat` en `page.tsx` →
  `customer-list-section.tsx` → `customer-table.tsx` → `customer-columns.tsx`; barrel.
  *Hecho:* `tests/unit/clientes-ui/customer-chat-link.test.tsx` cubre R45 (enlace con
  `?cliente=<id>`, «Sin teléfono válido», nada sin permiso); los tests de la lista de Clientes siguen
  verdes.

## Bloque 5 — E2E y cierre

- [ ] **T19** (dep. T15, T18) — `e2e/contactos-chat.spec.ts` con los dobles de Graph: webhook
  entrante → aparece en la lista y el chat sin recargar (R42) → responder (R32) → «Enviado» →
  status `delivered` por webhook → «Entregado» (R19); 404 sin `whatsapp.consultar` (R1); «Abrir chat»
  desde Clientes (R45, R46); a 390 × 844 lista ↔ chat (R6) y sin scroll horizontal (R7).
  *Hecho:* el spec pasa en local. **Estado (2026-10-24):** escrito y en verde estático (`--list` 8 tests); sin correr: la base local compartida no tiene las migraciones de QC-245. Se cierra con el job E2E de CI o una base migrada.
- [x] **T20** — Mapa `R<n> → test` en `progress/impl_QC-246.md` (R1–R54), `./init.sh` verde y
  `node scripts/archivos-en-vuelo.mjs --candidata QC-246` sin choques sin aceptar.
  *Hecho:* cada `R<n>` con su test; gate local verde.

## Trazabilidad prevista (requisitos nuevos o cambiados por el contrato v2)

| Requisito | Test |
|---|---|
| R21, R22 | `tests/unit/contactos-ui/chat-view.test.ts`, `tests/unit/contactos-ui/chat-message.test.tsx` (T3, T8) |
| R24 | `tests/unit/contactos-ui/chat-view.test.ts` (T3) |
| R35, R36 | `tests/unit/contactos-ui/template-values.test.ts`, `tests/unit/contactos-ui/chat-composer.test.tsx` (T4, T11) |
| R38, R39 | `tests/unit/contactos-ui/chat-view.test.ts`, `tests/unit/contactos-ui/chat-header.test.tsx` (T3, T10) |
| R49 | `tests/unit/contactos-ui/chat-panel.test.tsx` (T12) |
| R50, R51 | `tests/unit/shared-ui/whatsapp-system-constants.test.ts`, `tests/unit/integraciones-ui/whatsapp-template-rules.test.ts` (T21) |
| R52 | `tests/unit/integraciones-ui/whatsapp-variables-panel.test.tsx`, `tests/unit/integraciones-ui/whatsapp-template-relate-sheet.test.tsx`, `tests/unit/integraciones-ui/whatsapp-template-form-sheet.test.tsx` (T21) |
| R53 | `tests/unit/integraciones-ui/whatsapp-template-rules.test.ts` (T21) |
| R54 | `tests/unit/contactos-ui/contacts-screen.test.tsx`, `tests/unit/contactos-ui/contacts-poller.test.ts`, `tests/unit/contactos-ui/chat-header.test.tsx`, `tests/unit/clientes-ui/contactos-page.test.tsx` (T7, T10, T14, T15) |

## Archivos esperados

- `docs/diseno/canvas/Contactos.dc.html`
- `docs/diseno/canvas/ContactosVentanaCerrada.dc.html`
- `docs/diseno/canvas/ContactosNuevoChat.dc.html`
- `docs/diseno/canvas/ContactosVacios.dc.html`
- `docs/diseno/canvas/ContactosMovil.dc.html`
- `docs/diseno/canvas/ContactosChatMovil.dc.html`
- `docs/diseno/canvas/ContactosNuevoChatMovil.dc.html`
- `components/shared/wa-bubble.tsx`
- `components/shared/CATALOGO.md`
- `lib/shared/ui/whatsapp-system-constants.ts`
- `app/(private)/integraciones/whatsapp/components/wa-bubble.tsx`
- `app/(private)/integraciones/whatsapp/components/whatsapp-system-constants.ts`
- `lib/shared/navigation/private-nav.ts`
- `app/(private)/clientes/contactos/page.tsx`
- `app/(private)/clientes/contactos/components/index.ts`
- `app/(private)/clientes/contactos/components/contact-texts.ts`
- `app/(private)/clientes/contactos/components/contacts-screen.tsx`
- `app/(private)/clientes/contactos/components/conversation-list.tsx`
- `app/(private)/clientes/contactos/components/conversation-list-item.tsx`
- `app/(private)/clientes/contactos/components/chat-panel.tsx`
- `app/(private)/clientes/contactos/components/chat-header.tsx`
- `app/(private)/clientes/contactos/components/chat-window-badge.tsx`
- `app/(private)/clientes/contactos/components/chat-order-detail.tsx`
- `app/(private)/clientes/contactos/components/chat-message-list.tsx`
- `app/(private)/clientes/contactos/components/chat-message.tsx`
- `app/(private)/clientes/contactos/components/chat-message-status.tsx`
- `app/(private)/clientes/contactos/components/chat-location-card.tsx`
- `app/(private)/clientes/contactos/components/chat-media-image.tsx`
- `app/(private)/clientes/contactos/components/chat-image-viewer.tsx`
- `app/(private)/clientes/contactos/components/chat-composer.tsx`
- `app/(private)/clientes/contactos/components/chat-template-chips.tsx`
- `app/(private)/clientes/contactos/components/send-template-dialog.tsx`
- `app/(private)/clientes/contactos/components/contacts-empty-states.tsx`
- `app/(private)/clientes/contactos/components/chat-view.ts`
- `app/(private)/clientes/contactos/components/template-values.ts`
- `app/(private)/clientes/contactos/components/chat-timeline.ts`
- `app/(private)/clientes/contactos/components/conversation-list-state.ts`
- `app/(private)/clientes/contactos/components/chat-time-format.ts`
- `app/(private)/clientes/contactos/components/contacts-poller.ts`
- `app/(private)/clientes/contactos/components/use-end-sentinel.ts`
- `app/(private)/clientes/contactos/components/use-window-open.ts`
- `app/(private)/clientes/contactos/components/action-rejection.ts`
- `app/(private)/clientes/contactos/components/contacts-selection.ts`
- `app/(private)/clientes/contactos/components/contacts-load-error.tsx`
- `app/(private)/clientes/page.tsx`
- `app/(private)/clientes/components/index.ts`
- `app/(private)/clientes/components/customer-chat-link.tsx`
- `app/(private)/clientes/components/customer-list-section.tsx`
- `app/(private)/clientes/components/customer-table.tsx`
- `app/(private)/clientes/components/customer-columns.tsx`
- `tests/unit/contactos-ui/chat-view.test.ts`
- `tests/unit/contactos-ui/template-values.test.ts`
- `tests/unit/contactos-ui/chat-timeline.test.ts`
- `tests/unit/contactos-ui/conversation-list-state.test.ts`
- `tests/unit/contactos-ui/chat-time-format.test.ts`
- `tests/unit/contactos-ui/contacts-poller.test.ts`
- `tests/unit/contactos-ui/chat-message.test.tsx`
- `tests/unit/contactos-ui/chat-message-list.test.tsx`
- `tests/unit/contactos-ui/chat-header.test.tsx`
- `tests/unit/contactos-ui/chat-composer.test.tsx`
- `tests/unit/contactos-ui/send-template-dialog.test.tsx`
- `tests/unit/contactos-ui/chat-panel.test.tsx`
- `tests/unit/contactos-ui/conversation-list.test.tsx`
- `tests/unit/contactos-ui/contacts-screen.test.tsx`
- `tests/unit/contactos-ui/contacts-empty-states.test.tsx`
- `tests/unit/contactos-ui/contactos-frontera.test.ts`
- `tests/unit/shared-ui/whatsapp-system-constants.test.ts`
- `tests/unit/integraciones-ui/whatsapp-template-rules.test.ts`
- `tests/unit/integraciones-ui/whatsapp-variables-panel.test.tsx`
- `tests/unit/integraciones-ui/whatsapp-template-relate-sheet.test.tsx`
- `tests/unit/integraciones-ui/whatsapp-template-form-sheet.test.tsx`
- `tests/unit/clientes-ui/contactos-page.test.tsx`
- `tests/unit/clientes-ui/private-nav-clientes.test.ts`
- `tests/unit/clientes-ui/customer-chat-link.test.tsx`
- `tests/unit/clientes-ui/clientes-page.test.tsx`
- `tests/unit/shell/nav-iconos.test.ts`
- `tests/unit/paridad/__snapshots__/clientes-paridad.test.tsx.snap`
- `tests/guards/guard-pantallas-exigen-permiso.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `e2e/contactos-chat.spec.ts`
- `e2e/clientes.spec.ts`
- `e2e/movimiento.spec.ts`
