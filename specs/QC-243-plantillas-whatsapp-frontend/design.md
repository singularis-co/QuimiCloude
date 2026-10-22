# QC-243 — plantillas-whatsapp-frontend · design.md

## Lo que ya existe

Buscado en el board (`feature_list.json`, todos los estados), en `specs/` y en el grafo
(`search_graph` del proyecto del worktree) con `plantilla`, `whatsapp`, `variable`, `vista previa`,
`burbuja`, `slug`/`clave desde la etiqueta`.

| Apareció | Qué es | Qué se hace |
|---|---|---|
| QC-242 `plantillas-whatsapp-backend` (`done`) | Los Server Actions, el validador del borrador con claves, el validador de la variable propia, `TEMPLATE_LIMITS`, `WHATSAPP_TEMPLATE_LANGUAGES` y las vistas | Se consumen tal cual (D5). Nada se re-crea en el front: las reglas salen del barrel `@/lib/modules/integraciones` |
| QC-237 `conexion-whatsapp-por-empresa` | `whatsapp-integration-tabs.tsx` con «Plantillas» deshabilitada y «Disponible próximamente» | Se extiende: tres pestañas (R1–R3) |
| QC-248 `notificaciones-whatsapp-frontend` (`pending`) | Una pestaña más en la misma pantalla, con vista previa y selector por `{{n}}` | No se solapa en alcance. Comparte `whatsapp-integration-tabs.tsx` y podrá reutilizar `WaBubble` y el selector de hueco desde los componentes de la ruta (es la misma ruta, no hace falta subirlos a `shared`) |
| QC-245, QC-247 (backend, `pending`) | Envío con plantilla: resuelven constantes y propias | Frontera: esta ficha solo define las tres constantes de ejemplo (G6) |
| Doble `canned` del cliente de Graph (`whatsapp-graph-client-canned.ts`) | Guarda en memoria lo creado, lista y borra | Lo usa el E2E (R61), como previó QC-242 §6 |
| `usernameFromNames` (`components/shared/username-from-names.ts`) | Arma un usuario desde nombres | No sirve para la clave (otras reglas: `_`, 40 caracteres, primera letra); la clave tiene su función propia en la ruta (§6.4) |
| `formatRelativeTime`/`formatClock` (`app/(private)/components/notifications/relative-time.ts`) | Fecha en la zona del navegador | Es de otra ruta; se copia solo la forma (`Intl.DateTimeFormat('es', …)`), no se importa (§6.6) |

Nada más: no hay burbuja de chat, ni selector de diccionario, ni otra pantalla de plantillas.

### Componentes: filas del catálogo consultadas y paso de la regla de decisión

Consultadas en `components/shared/CATALOGO.md`: `Tabs`, `DataTable`, `RowActionsMenu`, `StatusBadge`,
`Switch`, `Tooltip`, `Notice`, `EmptyState`, `TableSkeleton`, `ErrorState`, `ErrorAlert`, `Sheet`,
`FormSheet`, `ConfirmDialog`, `DeleteConfirmDialog`, `Select`, `SharedSelect`, `DropdownMenu`,
`Popover`, `TextField`, `Textarea`, `Input`, `FieldError`, `Spinner`, `Toaster` (`sonner`),
`useEntitySheet`, `useIsMobile`, `EMPTY_MARK`, `touchTarget`.

| Pieza de esta ficha | Paso | Con qué |
|---|---|---|
| Pestañas «Conexión \| Plantillas \| Variables» | 2 · extiende `WhatsappIntegrationTabs` (ruta) | `Tabs` |
| Barra de sincronización | 3 · compone | `Card`, `Button`, `Spinner`, `StatusBadge` |
| Listado de plantillas | 1 · reutiliza `DataTable` con `card`, `searchable`, `toolbarActions` (chips), `actionsColumn({ menu })` | `DataTable`, `RowActionsMenu`, `TableSkeleton`, `EmptyState` |
| Estado en Meta y «!» con el motivo | 3 · compone | `StatusBadge`, `Tooltip`, `Button` |
| Uso en el sistema | 3 · compone | `Switch`, `StatusBadge`, `Button` (`link`) |
| Aviso «sin relacionar» | 1 · reutiliza | `Notice` (`tone="info"`) |
| Alta (`PlantillaAlta`) | 4 · crea en la ruta | `Sheet`, `TextField`, `Textarea`, `Select`, `DropdownMenu`, `Tabs`, `ErrorAlert`, `ConfirmDialog` |
| Burbuja de vista previa (tablero `WaBurbuja`; componente `WaBubble`) | 4 · crea en la ruta | ninguna: pieza visual nueva |
| Relacionar variables | 3 · compone | `Sheet`, `Select`, `ConfirmDialog`, `WaBubble` |
| Pestaña Variables y panel de variable | 3 · compone | `DataTable`, `FormSheet`, `TextField`, `Textarea`, `ConfirmDialog`, `DeleteConfirmDialog` |

Ninguna pieza sube a `components/shared`: todas las usa una sola ruta.

## 1. Tableros aprobados (pase `/design`, aprobado por el humano el 2026-10-22)

- `docs/diseno/canvas/PlantillasWhatsapp.dc.html` — pantalla, pestañas, listado, estados (datos,
  vacío, cargando, sin conexión), relación, variable, diálogos y textos literales.
- `docs/diseno/canvas/PlantillasWhatsappVariables.dc.html` — pestaña Variables.
- `docs/diseno/canvas/PlantillasWhatsappTablet.dc.html` — tablet 820 × 1180.
- `docs/diseno/canvas/PlantillasWhatsappMovil.dc.html` — teléfono 390 × 844 y **ficha por plataforma**
  (reutiliza, nuevo, librerías, animación, decidido, por confirmar).
- `docs/diseno/canvas/ModalesPlantillasWhatsapp.dc.html` — todos los paneles y diálogos abiertos.
- `docs/diseno/canvas/PlantillaAlta.dc.html` — el alta (nueva y duplicar, error, confirmación).
- `docs/diseno/canvas/WaBurbuja.dc.html` — la burbuja de vista previa (pieza nueva).

Lo que el tablero tiene y este spec **no** implementa, con su porqué: el tipo de sincronización
(P4); «[MOTIVO DEL RECHAZO QUE DA META]» y «[ERROR TRADUCIDO POR EL BACKEND]» son datos del backend;
«[NOMBRE DE TU EMPRESA]» (P7); el selector del tablero («no es parte de la app»); el alta abre por
defecto en «Plantillas» en el prototipo, pero ninguna decisión cambia la pestaña inicial de QC-237, que
sigue en «Conexión» (R1).

## 2. Modelo de datos

**Ninguno.** Sin tablas, RLS ni migraciones: D5 y R62. Todo lo que la pantalla guarda lo guardan las
acciones de QC-242, que ya aplican el permiso `integraciones.modificar` y el ámbito de empresa.

## 3. Rutas y carga

Una sola ruta, `app/(private)/integraciones/whatsapp/page.tsx` (Server Component), que ya exige
`integraciones.modificar`. Carga en el servidor, en paralelo:

| Dato | Acción | Cuándo |
|---|---|---|
| Conexión | `getWhatsappConnectionAction()` (ya está) | siempre |
| Plantillas | `listWhatsappTemplatesAction()` | solo con conexión (sin ella, R2) |
| Diccionario | `listWhatsappDictionaryAction()` | siempre (G2) |

y pasa los resultados por props a `WhatsappIntegrationTabs`, que pinta las tres pestañas. Cada
pestaña recibe su `ErrorState` o sus datos; un error en una no tumba las otras (R6, con `ErrorState`
del catálogo y `retry` por `router.refresh()`).

**Refresco (R5, D4).** Al activar «Plantillas» o «Variables», `onValueChange` de `Tabs` llama a
`router.refresh()`: el Server Component vuelve a pedir los datos y React conserva el estado del
cliente (pestaña, filtros). Las acciones de escritura ya hacen `revalidatePath`; tras cada una la UI
llama a `router.refresh()` (patrón de `useEntitySheet`).

No hay fetch desde el cliente ni librería de datos (`docs/perfil-agentes.md > frontend_dev`).

## 4. Contratos que se consumen (QC-242, sin cambios)

Todos responden `{ status: 'success', data } | ErrorState` y se importan por su ruta exacta
(`@/lib/modules/integraciones/adapters/driving/...`).

| Acción | Entrada | `data` | R |
|---|---|---|---|
| `listWhatsappTemplatesAction` | `{ onlyApproved? }` (no se usa) | `{ templates: WhatsappTemplateView[], templatesSyncedAt }` | R3, R7, R10 |
| `syncWhatsappTemplatesAction` | — | `{ imported, updated, deleted, skipped, syncedAt }` | R8 |
| `createWhatsappTemplateAction` | `WhatsappTemplateKeyedDraft`: `{ name, language, category, header: null, body: { text }, footer, buttons: [], constantLabels }` | `WhatsappTemplateView` | R34 |
| `deleteWhatsappTemplateAction` | `id` | `{ id }` | R41 |
| `relateWhatsappTemplateVariablesAction` | `{ templateId, bindings: [{ slot, key }] }` | `WhatsappTemplateView` | R46 |
| `setWhatsappTemplateEnabledAction` | `{ templateId, enabled }` | `WhatsappTemplateView` | R16 |
| `listWhatsappDictionaryAction` | — | `{ id, key, label, value, usedBy }[]` | R49 |
| `createWhatsappVariableKeyAction` | `{ key, label, value }` | entrada | R54 |
| `updateWhatsappVariableKeyAction` | `id`, `{ key, label, value }` (la clave guardada) | entrada | R55 |
| `deleteWhatsappVariableKeyAction` | `id` | `{ id }` | R59 |

Del barrel `@/lib/modules/integraciones` (puro, importable desde el cliente): `validateKeyedTemplateDraft`,
`validateWhatsappVariableKeyInput`, `TEMPLATE_LIMITS`, `WHATSAPP_TEMPLATE_LANGUAGES`,
`WHATSAPP_VARIABLE_KEY_LIMITS` y los tipos.

`skipped` del resumen no se pinta: el tablero no lo trae.

## 5. Claves de las constantes (G14 y P1)

`whatsapp-system-constants.ts` (ruta) es la única fuente de las tres constantes:

```ts
type SystemConstant = {
  displayKey: string;   // lo que ve y escribe el usuario: nombre_del_cliente
  backendKey: string;   // lo que recibe el backend (P1): cliente.nombre
  label: string; description: string; example: string;
};
```

| `displayKey` | `backendKey` (P1, default) | Etiqueta | Descripción | Ejemplo |
|---|---|---|---|---|
| `nombre_del_cliente` | `cliente.nombre` | Nombre del cliente | Nombres y apellidos del cliente que recibe el mensaje. | Laura Gómez |
| `numero_de_pedido` | `pedido.numero` | Número de pedido | Número del pedido del que trata el mensaje. | PED-00128 |
| `nombre_de_la_empresa` | `empresa.nombre` | Nombre de la empresa | El nombre de tu empresa en QuimiCloude. | `EMPTY_MARK` (P7) |

**Traducción (default de P1).** Dos funciones puras, el único sitio que conoce las dos formas:

- `toBackendText(text)`: cada `{{displayKey}}` de constante → `{{backendKey}}`. Se aplica al borrador
  antes de `validateKeyedTemplateDraft` y de `createWhatsappTemplateAction`, y a cada `key` de
  `bindings` antes de relacionar. `constantLabels` se arma con `backendKey → label`.
- `toDisplayText(text)` y `displayKeyOf(key)`: lo contrario, para el `content` y los `variables[].key`
  que devuelve una vista. Una clave con punto que no está en la tabla se muestra tal cual, con la
  clave como etiqueta.

Si el humano elige la otra salida de P1 (enmienda de backend), estas dos funciones pasan a ser la
identidad y `backendKey` desaparece; nada más cambia en la pantalla.

Una propia con la `displayKey` de una constante no se puede crear desde la pantalla (R52). Si existe
una creada por otra vía, se lista como propia y en los menús aparecen las dos con la misma clave; no se
resuelve aquí (no hay forma de crearla desde la app).

## 6. Reglas de pantalla (funciones puras de la ruta, con test propio)

### 6.1 Diccionario de pantalla

`dictionaryOf(own)`: constantes (§5) y propias, cada una `{ key (display), label, preview, kind }`, con
`preview` = etiqueta para una constante y valor para una propia (G7). Lo usan el menú de insertar, el
selector de hueco, «Variables en el mensaje» y las dos vistas previas.

### 6.2 Relacionable, sin relacionar y huecos

- `isMappable(view)`: `content !== null` y todas las marcas `{{…}}` de header, body y URL son `{{n}}` o
  la clave de un elemento de `view.variables` con `key` (R15). Esto cubre las variables con nombre
  (QC-242 R95: `content` llega, pero sin huecos).
- Sin relacionar = `isMappable && mappingStatus === 'UNMAPPED'` (R14, R17, R18).
- Marca de cada hueco en el panel: `body.n` → `{{n}}`; `header` → «Encabezado {{1}}»; `button.i` →
  «Botón i+1 {{1}}» (el tablero solo dibuja el body; el encabezado y el botón son propuesta del spec
  para no repetir `{{1}}`).
- «Texto de la plantilla» (R42): el `content` con los huecos como `{{n}}` (la vista trae `{{clave}}` en
  los relacionados; se vuelve a numerar con `variables[].position`).

### 6.3 Contador (R26)

El contador mide el texto que recibe Meta: `toBackendText`, luego cada `{{clave}}` distinta → `{{n}}`
(la misma regla que QC-242 R67), y cuenta puntos de código (`[...text].length`, como
`TEMPLATE_LIMITS`). Se descarta contar el texto con claves: `{{nombre_del_cliente}}` suma 22 caracteres
donde Meta recibe 5 y bloquearía mensajes válidos.

### 6.4 Clave desde la etiqueta (R51)

```ts
label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '_').replace(/^[^a-z]+/, '').replace(/_+$/, '')
  .slice(0, WHATSAPP_VARIABLE_KEY_LIMITS.keyMaxLength).replace(/_+$/, '');
```

«Número de cuenta» → `numero_de_cuenta`; «2º horario» → `horario`; «ñandú» → `nandu`; «123» → vacío
(R52). El resultado siempre casa con `WHATSAPP_VARIABLE_KEY_PATTERN` o es vacío. Mensajes del campo
Clave (propuesta del spec; el tablero no los trae): vacío «La etiqueta tiene que tener al menos una
letra.»; repetida «Ya hay una variable con la clave <clave>.».

### 6.5 Tonos y textos de estado (R11, R14)

| Valor | Texto | Tono de `StatusBadge` |
|---|---|---|
| `APPROVED` | Aprobada | `success` |
| `PENDING` | Pendiente | `waiting` |
| `REJECTED` | Rechazada | `danger` |
| `PAUSED` | Pausada | `progress` |
| `DISABLED` | Deshabilitada | `neutral` |
| `OTHER` | Otro · `statusRaw` | `muted` |
| sin relacionar | Sin relacionar | `waiting` |
| no relacionable | No compatible | `muted` |

Categoría: `UTILITY` Utilidad, `MARKETING` Marketing, `AUTHENTICATION` Autenticación.

### 6.6 Fechas (R7, R10)

`formatSyncDateTime(iso, timeZone?)` → `DD/MM/AAAA HH:MM` con `Intl.DateTimeFormat('es', …, hourCycle:
'h23')`; `null` → `EMPTY_MARK`. Se pinta en un componente de cliente después de montar (la zona es la
del dispositivo; el servidor no la conoce): antes de montar se muestra la marca de vacío, para no tener
desajuste de hidratación. El test pasa `timeZone` fijo.

### 6.7 Idiomas (R24)

`LANGUAGE_OPTIONS` = `es` + los `es_*` de `WHATSAPP_TEMPLATE_LANGUAGES` (hoy AR, CL, CO, CR, DO, EC,
HN, MX, PA, PE, ES, UY) y `en`, `en_US`, `en_GB` (los del tablero). Nombre: «Español», «Español ·
<país>», «Inglés», «Inglés · Estados Unidos», «Inglés · Reino Unido»; el país sale de
`listCountryOptions` (`components/shared/country-options.ts`, nombres en español), sin lista nueva.
Un `es_*` que el dominio quite deja de ofrecerse solo.

### 6.8 Duplicar (R40, P6)

`draftFromView(view)`: `name + '_v2'`, `language`, `category` si es `UTILITY`/`MARKETING` (si no,
`UTILITY`), `body.text` y `footer` con `toDisplayText` y los huecos sin relacionar como `{{n}}`; sin
header ni botones. Si la original los tenía, `hadDroppedParts = true` y el alta muestra el `Notice`
de P6. Con `content === null`, mensaje y pie vacíos.

### 6.9 Aviso de formato (R57)

`valueFormatWarning(before, after)`: `after !== after.trim()` o `/\s{2,}/.test(after)` o
(`/^\d+$/.test(before)` y no `/^\d+$/.test(after.trim())`). Es la regla del tablero, tal cual.

## 7. Componentes de la ruta

Todos en `app/(private)/integraciones/whatsapp/components/` con `'use client'` donde haga falta y
exportados desde `index.ts` solo los que usa `page.tsx`. Cada uno exporta sus textos en un objeto
`*_TEXTS` y sus `data-testid` como constantes, como hace `whatsapp-integration-tabs.tsx`.

| Archivo | Qué | R |
|---|---|---|
| `whatsapp-integration-tabs.tsx` (cambia) | Tres pestañas, `aria-describedby` de R2, refresco al activar | R1–R6 |
| `whatsapp-templates-panel.tsx` | Estado de la pestaña: filtros, búsqueda, sheets y diálogos abiertos | R7–R20 |
| `whatsapp-template-sync-bar.tsx` | Barra de sincronización y resumen | R7–R9 |
| `whatsapp-template-table.tsx` | `DataTable` con columnas, tarjeta, chips y acciones | R10–R14, R18–R20 |
| `whatsapp-template-usage.tsx` | Interruptor / «Sin relacionar» / «No compatible» | R14, R16 |
| `whatsapp-template-status.tsx` | Estado en Meta y «!» con el motivo | R11, R13 |
| `whatsapp-template-form-sheet.tsx` | El alta (nueva y duplicar), su confirmación y su error | R21–R40 |
| `whatsapp-template-variable-menu.tsx` | «Insertar variable» | R27, R28 |
| `wa-bubble.tsx` | `WaBubble`: burbuja de chat (encabezado, cuerpo con variables resaltadas, pie, hora, botones) | R32, R39, R44 |
| `whatsapp-template-relate-sheet.tsx` | Relacionar variables y su confirmación | R42–R46 |
| `whatsapp-template-delete-dialog.tsx` | `DeleteConfirmDialog` con los textos de R41 | R41 |
| `whatsapp-variables-panel.tsx` | Pestaña Variables: constantes y propias | R47–R49, R59 |
| `whatsapp-variable-form-sheet.tsx` | Panel de variable (nueva y editar) y diálogo «Revisa el cambio» | R50–R58 |
| `whatsapp-system-constants.ts` | §5 | R48 |
| `whatsapp-template-rules.ts` | §6.1–6.3, 6.5–6.8 | varios |
| `whatsapp-variable-rules.ts` | §6.4, 6.9 | R51, R52, R57 |

**El alta** usa `Sheet` (no `FormSheet`): `FormSheet` envuelve un `<form>` con Server Action y su
`SaveButton` lee `useFormStatus`, pero aquí «Enviar a revisión» abre antes un diálogo y la acción
recibe un objeto anidado, no `FormData` (QC-242 lo fija así). Ancho `min(1040px, 100%)`; dos columnas
(formulario y burbuja de 340 px, pegajosa) por encima de 760 px de contenedor, una con pestañas
«Formulario | Vista previa» por debajo (R38). El panel de variable sí usa `FormSheet` con `canSave` y
una acción de cliente que llama a la Server Action con el objeto.

**Diálogos** («Enviar para autorización», «Revisa la relación», «Revisa el cambio»): `ConfirmDialog`
con `icon` (`info`, `info`, `warning`), `onConfirm`, `isPending` y `error` para R36/R41/R46. «Eliminar
la plantilla» y «Eliminar la variable»: `DeleteConfirmDialog` con `confirmDisabled` para la variable en
uso (R59).

**Avisos**: `toast` de `sonner` para los mensajes de éxito, y para el error del interruptor y de
sincronizar (R9, R16), con el `message` del `ErrorState`.

**Animaciones** (ficha del tablero): `WaBubble` anima cada variable y botón nuevo con un fundido de
240 ms y `translateY(4px)`, `motion-reduce:animate-none`; el icono de sincronizar gira con `Spinner`
mientras corre; la fila recién relacionada entra con el fundido del sistema; paneles y diálogos con
las transiciones de `Sheet` y `AlertDialog`.

## 8. Multiplataforma

- Objetivos de 44 px (`touchTarget`, `Button` con `touch`), inputs de 16 px (`TextField`, `Textarea`
  ya lo cumplen), chips con scroll horizontal en teléfono (R60).
- **Motivo del rechazo (R13).** El globo es `Tooltip` de Base UI, que abre con puntero y con foco; su
  apertura al tocar en iOS no está comprobada en el repo (fila del catálogo). Por eso el motivo nunca
  depende solo del globo: el botón «!» lleva el motivo en su nombre accesible, y en la tarjeta (todo
  contenedor de 760 px o menos: teléfono y tablet en vertical) el motivo se ve como texto. Queda una
  ventana: tablet en horizontal con la tabla y sin puntero. El E2E móvil de la tarea T13 lo comprueba
  en WebKit; si el globo no abre al tocar, el «!» abre un `Popover` en su lugar (mismo contenido).
- El menú de «Insertar variable» y el selector de hueco son `DropdownMenu` y `Select` de Base UI, ya
  usados en móvil en el repo.

## 9. Integraciones externas

Ninguna directa: Meta solo a través de las acciones de QC-242. El E2E usa el doble `canned` y, para
«simular la aprobación» (R61), envía al webhook de la conexión (`whatsappWebhookPath(connectionId)`)
un `POST` con `message_template_status_update` (`APPROVED`) y el `metaTemplateId` leído de la base,
firmado con el App Secret que el propio E2E escribió al crear la conexión.

## 10. Dependencias

Ninguna nueva (R62). `lucide-react`, `sonner` y Base UI ya están aprobadas.

## 11. Tests

| Nivel | Archivo | Cubre |
|---|---|---|
| Reglas puras | `tests/unit/integraciones-ui/whatsapp-template-rules.test.ts` | §5, §6.1–6.3, 6.5–6.8 |
| Reglas puras | `tests/unit/integraciones-ui/whatsapp-variable-rules.test.ts` | §6.4, 6.9 |
| Componentes (`ui`) | `whatsapp-page.test.tsx` (cambia), `whatsapp-templates-panel.test.tsx`, `whatsapp-template-form-sheet.test.tsx`, `whatsapp-template-relate-sheet.test.tsx`, `wa-bubble.test.tsx`, `whatsapp-variables-panel.test.tsx`, `whatsapp-variable-form-sheet.test.tsx` | R1–R60 con las acciones simuladas (`vi.mock` de su ruta exacta) |
| E2E | `e2e/integraciones-whatsapp-plantillas.spec.ts` (nuevo) | crear → «Pendiente» → aprobación por webhook → «Aprobada» (R61); relacionar y habilitar una importada; variable propia nueva; teléfono |
| E2E | `e2e/integraciones-whatsapp.spec.ts` (cambia) | La pestaña «Plantillas» ya no dice «Disponible próximamente» |

R37 se prueba recorriendo los textos exportados de diálogos y paneles. R62 lo comprueba el reviewer
sobre el diff.

## 12. Fronteras y archivos compartidos

| Archivo | Con quién | Cómo |
|---|---|---|
| `whatsapp-integration-tabs.tsx`, `page.tsx` | QC-248 (`pending`), que añade «Notificaciones» | Quien llegue segundo añade su pestaña a la lista; la estructura (lista de pestañas con su `disabled` y su panel) se deja preparada para eso |
| `e2e/integraciones-whatsapp.spec.ts` | QC-237 (`done`) | Solo cambia la aserción de la pestaña |

## 13. Alternativas descartadas

1. **Pedir los datos desde el cliente** (con SWR o `useEffect` sobre las acciones) para refrescar al
   cambiar de pestaña. No hay librería aprobada, y `router.refresh()` ya vuelve a pedir lo del Server
   Component conservando el estado del cliente. Se descarta.
2. **Filtro de estado con el filtro `select` de `DataTable`.** Es lo que da la pieza, pero el tablero
   aprobado pide una fila de chips visibles con «Sin relacionar» como uno más; un chip con desplegable
   esconde los estados detrás de un toque. Se usan `toolbarActions` con los chips y el filtrado en el
   cliente (la lista llega entera).
3. **Mostrar en pantalla las claves con punto** (`cliente.nombre`): quitaría la traducción de P1 sin
   tocar el backend, pero reabre G14, que el humano cerró. No se propone como default.
4. **`FormSheet` para el alta**: ver §7; su `<form>` con `useFormStatus` no encaja con la
   confirmación previa ni con el borrador anidado.
5. **Subir `WaBubble` a `components/shared` ya**, pensando en QC-248: esa ficha es la misma ruta, así
   que no hay segunda ruta que la pida (`docs/perfil-agentes.md > Regla de decisión`).
6. **Contar caracteres sobre el texto con claves** (como el prototipo): ver §6.3.
7. **Pestañas por URL (`UrlTabs`)**: daría enlace directo a «Variables», pero la pantalla de QC-237 usa
   `Tabs` con un proveedor (`WhatsappVerifyTokenProvider`) que se perdería al navegar. Nadie lo ha
   pedido.
