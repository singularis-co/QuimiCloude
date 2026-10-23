# QC-243 — plantillas-whatsapp-frontend · tasks.md

Orden: T1–T3 en paralelo; luego T4; luego T5–T12 según sus dependencias; T13 y T14 al final.
`[P]` = puede ir en paralelo con las otras `[P]` de su tanda. Cada task cierra con typecheck, lint y
`pnpm exec vitest related --run <sus archivos>` en verde (`docs/perfil-agentes.md > Todos los
agentes`), y un commit `feat(QC-243): …`.

Las preguntas abiertas se implementan con su **default** (`requirements.md > Preguntas abiertas`)
salvo que el humano decida otra cosa al aprobar el spec. P2 deja sin descripción las variables propias
hasta que el backend la guarde (R58).

## Tanda 1 — reglas puras y burbuja

- [x] **T1 [P] Constantes y reglas de plantilla.** `whatsapp-system-constants.ts` (§5) y
  `whatsapp-template-rules.ts` (§6.1–6.3, 6.5–6.8): diccionario de pantalla, `toBackendText` /
  `toDisplayText` / `displayKeyOf`, `isMappable`, sin relacionar, marcas de hueco, texto numerado,
  contador, tonos y textos de estado y categoría, `formatSyncDateTime`, `LANGUAGE_OPTIONS`,
  `draftFromView`.
  **Hecho:** `whatsapp-template-rules.test.ts` con un caso por regla, nombrados con su R: R11, R15
  (contenido vacío, variable con nombre, `{{n}}`, clave relacionada), R24 (solo `es`, `es_*`, `en`,
  `en_US`, `en_GB`), R26 (`{{nombre_del_cliente}}` cuenta 5), R40 (sufijo `_v2`, huecos sin relacionar
  como `{{n}}`, sin header ni botones, `AUTHENTICATION` → `UTILITY`), R48 (las tres constantes con sus
  textos), P1 (ida y vuelta de las tres claves; clave con punto desconocida intacta), R7 (`null` → marca
  de vacío; fecha con zona fija).
- [x] **T2 [P] Reglas de variable propia.** `whatsapp-variable-rules.ts` (§6.4, 6.9).
  **Hecho:** `whatsapp-variable-rules.test.ts`: R51 (tildes, ñ, mayúsculas, signos, dígitos al
  principio, `_` al final, 40 caracteres, siempre casa con `WHATSAPP_VARIABLE_KEY_PATTERN`), R52 (vacía,
  repetida con una propia, igual a una constante), R57 (espacios al borde, dobles, dígitos → no
  dígitos; sin aviso si nada de eso).
- [x] **T3 [P] `WaBubble`.** `wa-bubble.tsx` según `WaBurbuja.dc.html`: encabezado en negrita,
  cuerpo con variables resaltadas, pie gris, hora, botones debajo, tema oscuro, nombre accesible con el
  texto, fundido de 240 ms y `motion-reduce`.
  **Hecho:** `wa-bubble.test.tsx`: R32 (propia → valor, constante → etiqueta, desconocida → `[clave]`,
  vacío → «Escribe el mensaje para verlo aquí.»), R44 («[n sin relacionar]»), R39 (clase de animación y
  su variante `motion-reduce`).

## Tanda 2 — pestañas y carga (depende de T1)

- [x] **T4 Pestañas y página.** `whatsapp-integration-tabs.tsx` con «Conexión | Plantillas |
  Variables», `aria-describedby` y texto de R2, `router.refresh()` al activar Plantillas o Variables;
  `page.tsx` carga plantillas (con conexión) y diccionario en paralelo y los pasa por props; error por
  pestaña con `ErrorState`.
  **Hecho:** `whatsapp-page.test.tsx` actualizado: R1 (orden y pestaña inicial), R2 (sin conexión:
  Plantillas deshabilitada con su texto, Variables habilitada), R3, R4 (el contenido de Conexión no
  cambia: sus casos actuales siguen verdes), R5 (refresco al activar cada pestaña, no al activar
  Conexión), R6 (error en una pestaña, las otras siguen).

## Tanda 3 — pantalla (dependencias en cada task)

- [x] **T5 Barra de sincronización** (T4). `whatsapp-templates-panel.tsx` (esqueleto del panel) y
  `whatsapp-template-sync-bar.tsx`.
  **Hecho:** `whatsapp-templates-panel.test.tsx`: R7, R8 (botón deshabilitado y «Sincronizando…»,
  esqueleto, aviso, hora nueva y las tres etiquetas), R9 (error: listado y hora sin cambios).
- [x] **T6 Listado** (T1, T5). `whatsapp-template-table.tsx`, `whatsapp-template-status.tsx`,
  `whatsapp-template-usage.tsx`: `DataTable` con `card`, búsqueda, chips en `toolbarActions`, aviso de
  sin relacionar, vacío y sin coincidencias, menú de acciones.
  **Hecho:** casos en `whatsapp-templates-panel.test.tsx`: R10, R11, R12 (tarjeta con «Acciones»), R13
  (nombre accesible del «!» y motivo como texto en la tarjeta), R14, R17 (singular y plural), R18 (cada
  chip, búsqueda sin mayúsculas, ninguna llamada al servidor), R19, R20 («Relacionar variables» ausente
  en una no relacionable).
- [x] **T7 Interruptor y eliminar plantilla** (T6). Interruptor con `setWhatsappTemplateEnabledAction`;
  `whatsapp-template-delete-dialog.tsx`.
  **Hecho:** R16 (llamada, aviso, y vuelta atrás con error), R41 (textos, llamada, aviso, fila fuera;
  con error, mensaje en el diálogo y fila presente).
- [ ] **T8 Alta** (T1, T3, T6). `whatsapp-template-form-sheet.tsx` y
  `whatsapp-template-variable-menu.tsx`: campos, idioma, categoría con descripción, contadores, insertar
  en el cursor, «Variables en el mensaje», clave desconocida, validación del dominio, vista previa,
  diálogo «Enviar para autorización», envío, éxito y error, pestañas en teléfono.
  **Hecho:** `whatsapp-template-form-sheet.test.tsx`: R21 (sin encabezado ni botones), R22, R23, R24,
  R25, R26, R27 (inserta en el cursor y al final sin cursor), R29, R30 (`{{1}}` y clave inventada), R31
  (un problema del dominio sale en su campo; botón deshabilitado), R33, R34 (forma exacta del borrador:
  `header: null`, `buttons: []`, claves con punto de P1 y `constantLabels`), R35, R36 (borrador intacto
  y «No se pudo enviar la plantilla»), R38.
- [ ] **T9 Duplicar** (T8). Acción «Duplicar» que abre el alta con `draftFromView` y el `Notice` de P6.
  **Hecho:** casos en `whatsapp-template-form-sheet.test.tsx`: R40 (título «Duplicar plantilla»,
  nombre con `_v2`, mensaje con claves de pantalla, aviso al perder encabezado o botones).
- [ ] **T10 Relacionar variables** (T1, T3, T6). `whatsapp-template-relate-sheet.tsx`.
  **Hecho:** `whatsapp-template-relate-sheet.test.tsx`: R42 (grupos, claves, relación actual
  preseleccionada, marcas de encabezado y botón), R43, R44, R45 (resumen y «Volver a revisar»), R46
  (pares hueco → clave con la clave con punto de P1 para las constantes; éxito y error).
- [x] **T11 Pestaña Variables** (T1, T4). `whatsapp-variables-panel.tsx`: texto de entrada,
  constantes en tabla, propias con editar y eliminar, vacío, diálogo de eliminar.
  **Hecho:** `whatsapp-variables-panel.test.tsx`: R47, R48 (las tres constantes, sin acciones), R49
  (columnas sin Descripción mientras P2 siga abierta; vacío), R59 (sin uso: textos, llamada y aviso; en
  uso: texto y «Eliminar» deshabilitado).
- [ ] **T12 Panel de variable** (T2, T11; y T8 para R28). `whatsapp-variable-form-sheet.tsx` con el
  diálogo «Revisa el cambio»; enganche desde «Nueva variable propia» del alta.
  **Hecho:** `whatsapp-variable-form-sheet.test.tsx`: R50, R51 (la clave sigue a la etiqueta y es de
  solo lectura), R52, R53, R54, R55 (siempre se envía la clave guardada), R56 (con uso y valor nuevo:
  diálogo; sin uso o sin cambio: sin diálogo), R57, R58 (sin descripción en la petición ni en la
  tabla); y en `whatsapp-template-form-sheet.test.tsx`, R28 (el borrador sigue y la variable nueva está
  en el menú).

## Tanda 4 — E2E y cierre

- [ ] **T13 E2E** (T4–T12). `e2e/integraciones-whatsapp-plantillas.spec.ts` con el doble `canned`:
  crear desde la pantalla → «Pendiente»; `POST` firmado al webhook con `APPROVED` → volver a entrar en
  Plantillas → «Aprobada» (R61); crear una variable propia y usarla en el alta; en el proyecto móvil
  (WebKit, 390 px), abrir el alta a pantalla completa con sus pestañas (R38) y comprobar que el motivo
  de una rechazada se ve como texto en la tarjeta (R13, `design.md > 8`). Ajustar
  `e2e/integraciones-whatsapp.spec.ts` a la pestaña habilitada.
  **Hecho:** `pnpm exec playwright test e2e/integraciones-whatsapp-plantillas.spec.ts
  e2e/integraciones-whatsapp.spec.ts` en verde.
- [ ] **T14 Cierre** (T13). Prueba de R37 sobre los textos exportados de diálogos y paneles (ninguno
  contiene «Meta» ni «QuimiCloude»); revisión de R60 (44 px, 16 px, nada solo con puntero) en los
  componentes nuevos; R62: el diff no toca `lib/modules/`, `db/`, `lib/composition/` ni
  `package.json`; mapa `R<n> → test` completo en `progress/impl_QC-243.md`; `./init.sh` en verde.
  **Hecho:** los 62 requisitos con test o comprobación citada, y `./init.sh` verde.

## Archivos esperados

- `app/(private)/integraciones/whatsapp/page.tsx`
- `app/(private)/integraciones/whatsapp/components/index.ts`
- `app/(private)/integraciones/whatsapp/components/whatsapp-integration-tabs.tsx`
- `app/(private)/integraciones/whatsapp/components/whatsapp-templates-panel.tsx`
- `app/(private)/integraciones/whatsapp/components/whatsapp-template-sync-bar.tsx`
- `app/(private)/integraciones/whatsapp/components/whatsapp-template-table.tsx`
- `app/(private)/integraciones/whatsapp/components/whatsapp-template-status.tsx`
- `app/(private)/integraciones/whatsapp/components/whatsapp-template-usage.tsx`
- `app/(private)/integraciones/whatsapp/components/whatsapp-template-form-sheet.tsx`
- `app/(private)/integraciones/whatsapp/components/whatsapp-template-variable-menu.tsx`
- `app/(private)/integraciones/whatsapp/components/wa-bubble.tsx`
- `app/(private)/integraciones/whatsapp/components/whatsapp-template-relate-sheet.tsx`
- `app/(private)/integraciones/whatsapp/components/whatsapp-template-delete-dialog.tsx`
- `app/(private)/integraciones/whatsapp/components/whatsapp-variables-panel.tsx`
- `app/(private)/integraciones/whatsapp/components/whatsapp-variable-form-sheet.tsx`
- `app/(private)/integraciones/whatsapp/components/whatsapp-system-constants.ts`
- `app/(private)/integraciones/whatsapp/components/whatsapp-template-rules.ts`
- `app/(private)/integraciones/whatsapp/components/whatsapp-variable-rules.ts`
- `tests/unit/integraciones-ui/whatsapp-page.test.tsx`
- `tests/unit/integraciones-ui/whatsapp-template-rules.test.ts`
- `tests/unit/integraciones-ui/whatsapp-variable-rules.test.ts`
- `tests/unit/integraciones-ui/wa-bubble.test.tsx`
- `tests/unit/integraciones-ui/whatsapp-templates-panel.test.tsx`
- `tests/unit/integraciones-ui/whatsapp-template-form-sheet.test.tsx`
- `tests/unit/integraciones-ui/whatsapp-template-relate-sheet.test.tsx`
- `tests/unit/integraciones-ui/whatsapp-variables-panel.test.tsx`
- `tests/unit/integraciones-ui/whatsapp-variable-form-sheet.test.tsx`
- `e2e/integraciones-whatsapp-plantillas.spec.ts`
- `e2e/integraciones-whatsapp.spec.ts`
- `progress/impl_QC-243.md`
