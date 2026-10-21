# QC-306 — pdf-status-panel: diseño técnico

> Spec a posteriori: cada sección separa el **estado actual** (lo que está en `dev`,
> `683a7e2e..97070fad`) del **cambio** que pide esta ficha. Los requisitos están en
> `requirements.md`: R1–R18 se conservan y R19–R38 son correcciones.

## Lo que ya existe

**Términos buscados:**
- board (`feature_list.json`, por `name`): «tanda», «pdf», «documento», «subida»;
- `specs/`: «tandas recordadas», «panel de tandas», `localStorage`, `keepMounted`;
- código, con Grep: `localStorage`, `useSyncExternalStore`, `'storage'`, `logoutAction`.

**El MCP del grafo no se usó:** toda la exploración se hizo con Grep y Read.

**Qué apareció:**

| Hallazgo | Qué es | Relación con esta ficha |
|---|---|---|
| Commits `683a7e2e..97070fad` en `dev` | El backend (`attempts`, `name`, `maxAttempts`) y el panel (`batch-memory.ts`, `use-remembered-batches.ts`, `document-batch-panel.tsx`, cambios en `document-upload-row.tsx`, `document-upload.tsx`, `labels.ts`, `index.ts` y `formula-pdf-upload.tsx`) | **Es esta feature.** Se reutiliza y se corrige, no se rehace. |
| `QC-160` `boton-de-subida-de-pdf` (`specs/QC-160-boton-de-subida-de-pdf/`) | La pieza de subida: ventana con `keepMounted`, `useBatchStatus` y el sondeo cada 2 s | Base sobre la que se monta el panel. Su decisión de `keepMounted` se conserva (R16, R24). |
| `QC-111` `procesamiento-de-pdf-en-cola` | La cola, `attempts`, `maxRetries` y la caducidad | Fuera de alcance: no se toca (decisión cerrada). |
| `QC-280` `boton-pdf-sin-proveedor-ia` | `disabled` cuando falta proveedor de IA | Origen del caso de P2 y R35. |
| `components/shared/step-reader/step-reader.tsx` | Solo menciona `localStorage` para decir que **no** lo usa | Nada que reutilizar. |
| Ningún otro uso de `useSyncExternalStore` ni de un listener de `storage` en `app/`, `components/` o `hooks/` | — | No hay otra pieza que ya resuelva el registro o la sincronía. |

**Ninguna otra pieza resuelve lo mismo.** No hay motivo de bloqueo por duplicado.

### Catálogo consultado (`components/shared/CATALOGO.md`)

| Fila | Uso aquí | Paso de la regla de decisión |
|---|---|---|
| `DocumentBatchPanel`, `DocumentUpload`, `DocumentUploadDialog`, `DocumentUploadRow` (línea 69) | `DocumentUploadRow` se **extiende** con `scope` y `maxAttempts` opcionales, y los usos actuales no cambian | 2 (extender) |
| `Button`, `StatusBadge`, `ArrowLink`, `touchTarget` | Se reutilizan dentro del panel | 1 (reutilizar) |
| `DocumentBatchPanel` | Pieza **nueva** que compone las anteriores | 3 (componer) |

**Excepción declarada.** `DocumentBatchPanel` vive en `components/shared/document-upload/` con un
solo consumidor, la pantalla de fórmulas.
- Motivo: comparte con la pieza su estado interno: `batch-memory`, `use-batch-status` y las filas.
- Moverlo a `app/(private)/produccion/formulas/components/` obligaría a exportar ese estado interno
  desde el barrel.
- Consumidores identificados: `app/(private)/produccion/formulas/components/formula-pdf-upload.tsx`.

### Pase de diseño: FALTA (bloqueante)

El panel es un componente **nuevo** (paso 3), así que necesita un pase `/design` aprobado
(`docs/perfil-agentes.md > Pase de diseño para componentes nuevos`).
- Hoy **no existe** ningún tablero del panel en `docs/diseno/canvas/`.
- La fila del catálogo cita `Formulas.dc.html` y `ModalesProduccion.dc.html`, pero en ellos no sale
  el panel (hallazgo 2).

Tableros que se esperan, a nombrar en el pase:
- `docs/diseno/canvas/PanelTandas.dc.html`
- `docs/diseno/canvas/PanelTandasTablet.dc.html`
- `docs/diseno/canvas/PanelTandasMovil.dc.html`

El tablero tiene que resolver:
- la ubicación (P1);
- el estado con la subida deshabilitada (P2);
- el rótulo de cada tanda (P7);
- los estados: en curso, error, listo, desaparecida, error de consulta y vacío.

**Sin esa referencia no se implementa ninguna tarea visual.** Es la tarea T0 de `tasks.md`. Al
aprobarse, este documento se actualiza con la cita exacta del tablero.

## 1. Modelo de datos

- **Sin tablas nuevas, sin cambios de RLS y sin migraciones.**
- `DocumentFile.attempts Int @default(0)` y `DocumentFile.originalName String?` ya existían.
- `readBatch` sigue filtrando por `companyId` en sus dos consultas. La autorización vive en el caso
  de uso: `requirePermission` en `get-batch-status.ts`.

### Almacenamiento en el navegador

| | Estado actual | Cambio |
|---|---|---|
| Clave | `document-upload-remembered-batches`, global del navegador | `document-upload-remembered-batches:<ámbito>`, donde `<ámbito>` es el identificador opaco de P3 (R26, R27) |
| Valor | `Array<{ batchId, strategy, rememberedAt }>` | Igual. No se guarda nada más (R27). |
| Clave global antigua | Se lee | Se **borra** al hidratar, sin leer sus tandas (R29) |
| Limpieza al cerrar sesión | No hay | Se borran las claves con el prefijo, según P4 (R28) |

## 2. Contratos

### 2.1 Backend (sin cambios)

Se conserva tal cual:
- `DocumentFileStatusEntry` añade `attempts: number` y `name: string`.
- `ReadBatch` es lo que devuelve el puerto `readBatch`.
- `BatchStatus = ReadBatch & { maxAttempts: number }`.
- `maxAttempts = config.maxRetries() + 1` (R1–R4).

**La cota de R32 NO va en el backend.** El valor de `maxAttempts` sigue siendo el de la
configuración, y tocarlo sería tocar la política de reintentos, que está fuera de alcance.

### 2.2 Ámbito del registro (depende de P3; se diseña con la opción A, la recomendada)

- Un helper de servidor del módulo `documentos`, `rememberedBatchesScope(context)`, deriva
  `sha256("<userId>:<companyId>")` en hexadecimal con `node:crypto`. El nombre y la ubicación los
  confirma el implementer contra el acceso real al `SessionContext`.
  - Es una función pura: entra el contexto de sesión y sale un `string`.
  - No consulta nada.
  - `node:crypto` es del runtime, así que no hay dependencia nueva.
- `page.tsx` de fórmulas lo calcula, una vez por request, solo cuando `canUpload`. Lo pasa como prop
  `registryScope: string` a `FormulaPdfUpload`.
- `FormulaPdfUpload` lo reenvía a `DocumentUploadDialog` (y de ahí a `DocumentUpload`) y a
  `DocumentBatchPanel`.
- La prop `registryScope` es **opcional** en `DocumentUploadDialog` y en `DocumentUpload`.
  - Sin ella, la subida **no registra** la tanda.
  - Es el caso del catálogo de proveedores, que hoy registra tandas de estrategia `catalogo` que
    ningún panel muestra. Deja de hacerlo, sin efecto visible.
- En `DocumentBatchPanel` la prop es **obligatoria**.

### 2.3 `batch-memory.ts`

| | Estado actual | Cambio |
|---|---|---|
| Hidratación | Una vez por proceso, en una variable de módulo | Perezosa y **por ámbito**. Se re-lee al recibir el evento `storage` de esa clave (R30). |
| Escritura | Sobrescribe la clave con la copia en memoria entera | **Leer, fusionar y escribir:** se re-lee la clave, se aplica solo la operación (alta o baja de un `batchId`) y se escribe (R31) |
| Errores de lectura | `try/catch` y arranque vacío | Igual (R20, R23), ahora con pruebas |
| Errores de escritura | `try/catch` y la memoria sigue | Igual (R22), ahora con pruebas |
| API | `rememberedBatches()`, `rememberBatch(id, strategy)`, `forgetBatch(id)`, `onRememberedBatchesChange(fn)` | Las mismas, con `scope` como primer argumento. Se añade `forgetAllRememberedBatches()` (R28). |

- La suscripción añade un único `window.addEventListener('storage', …)` mientras haya oyentes, y lo
  quita con el último.
- El evento se filtra por la clave exacta del ámbito.
- **Nada de `.subscribe(`, ni `channel(`, ni `EventSource`.** La guardia R15 de
  `document-upload-convenciones.test.ts` prohíbe esos patrones en la carpeta de la pieza: la
  función que se pasa a `useSyncExternalStore` se nombra sin llamar a `.subscribe(`.
- `useRememberedBatches(scope, strategy)` mantiene la foto de servidor vacía (R15).
- **La foto de cliente se cachea por ámbito.** Una referencia estable que solo cambia al mutar
  evita el bucle de renders.

### 2.4 Sondeo compartido: `batch-status-store.ts` (nuevo, interno)

| | Estado actual | Cambio |
|---|---|---|
| Quién sondea | Cada `useBatchStatus(batchId)` arma su propio temporizador. Con la ventana y el panel montados, la misma tanda se consulta dos veces cada 2 s (hallazgo 4). | Un almacén de módulo **por `batchId`**: un solo bucle de consulta por tanda, sea cual sea el número de suscriptores (R24) |
| Fin del sondeo | Al terminar, con error o si la tanda desaparece | Igual, y además se para cuando se va el último suscriptor |
| Remontar | Vuelve a consultar | Si la última foto fue terminada o desaparecida, se sirve de memoria y **no se consulta** (R25) |
| `resume` | Limpia el error y vuelve a armar | Igual, sobre la entrada compartida |

- El contrato público `UseBatchStatusResult` (`status`, `error`, `missing`, `resume`) **no cambia**.
  Los consumidores y `use-batch-status.test.tsx` siguen igual.
- La memoria de fotos finales vive en el módulo, así que dura lo que dura la carga de la aplicación.
  `forgetAllRememberedBatches()` la vacía también (R28).
- Se sigue el mismo criterio que hoy: el siguiente temporizador se arma cuando responde la consulta
  anterior, así que nunca hay dos consultas en vuelo para la misma tanda.

### 2.5 Panel y filas

| | Estado actual | Cambio |
|---|---|---|
| Rótulo por tanda | «Tanda», igual para todas (`PANEL_BATCH_LABEL`) | `batchLabel(rememberedAt, fileCount)`: la fecha y la hora locales del registro y, cuando hay estado, el número de archivos (R33). El texto definitivo sale del pase (P7). |
| Nombre accesible del bloque | Ninguno | El `<li>` lleva `aria-labelledby` al rótulo (R34) |
| «Descartar» | Mismo nombre en todos | `aria-label={discardBatchLabel(rótulo)}` (R34). El texto visible lo fija el pase. |
| «Intento N de M» | `Math.max(1, attempts)`, sin cota superior | `Math.min(Math.max(1, attempts), maxAttempts)` (R32) |
| `disabled` | `return null` | Según P2. Con la opción B: se pinta en solo lectura, con «Revisar» y «Descartar» (R35) |
| Ubicación | Dentro de `PageHeader > actions`, con `basis-full` | Según P1 y el tablero. Con la opción A, `FormulaPdfUpload` se parte y el panel sale de `actions` para colocarse debajo de la cabecera, en `page.tsx`. |

- **Sin desajuste de hidratación.** La fecha se formatea en hora local solo en el cliente, y el
  servidor no pinta nada del panel (R15).
- El formato usa `Intl.DateTimeFormat('es', …)`, de la plataforma.

### 2.6 Cierre de sesión (R28)

- `app/(private)/components/logout-button.tsx`: el `<form action={logoutAction}>` gana un
  `onSubmit` que llama a `forgetAllRememberedBatches()` y **no** cancela el envío.
  - La acción y el envío real no cambian, así que el *progressive enhancement* sigue igual.
  - Hay que comprobar `guard-formularios-y-acciones.test.ts`, que ya lee este archivo.
- Un cierre de sesión que no pasa por el botón no se ve desde aquí: caducidad, «cerrar las otras
  sesiones». Lo cubre el ámbito de la clave (R26), por eso P3 recomienda la opción A.

### 2.7 Formato (R36–R38)

- Los 12 archivos que perdieron el salto de línea final lo recuperan (lista en el hallazgo 10).
  `.gitattributes` ya fija `eol=lf`.
- Se parten las líneas largas (`document-batch-panel.tsx:140` y `document-upload-row.tsx:26`)
  hasta el ancho que confirme P8.
- En la fila del catálogo:
  - se añade el punto que falta en «permite descartarla. No cubre»;
  - se quita «ni la sincronización del registro entre pestañas»;
  - la columna `Diseño` cita el tablero aprobado.

## 3. Alternativas descartadas

1. **Que el panel no muestre la tanda que sigue la ventana**, para no sondearla dos veces.
   Descartada: la ventana sigue montada y oculta al cerrarse (`keepMounted`). Con la ventana
   cerrada, la tanda en curso desaparecería del panel, que es justo cuando el panel hace falta. El
   almacén compartido (2.4) quita el doble sondeo sin esconder nada.
2. **SWR o `@tanstack/react-query` para deduplicar el sondeo.**
   - Descartada por la regla 7 de `CLAUDE.md`: entraría una dependencia sin aprobar.
   - Además, `document-upload-convenciones.test.ts` (R9 de QC-160) prohíbe expresamente las dos en
     el manifiesto.
   - Un almacén de unas 60 líneas sobre `useSyncExternalStore` basta.
3. **`BroadcastChannel` para la sincronía entre pestañas.** Descartada: el evento `storage` ya avisa
   a las demás pestañas del mismo origen cuando cambia la clave, y no añade un segundo canal que
   mantener coherente con el almacenamiento.
4. **Guardar la foto final de la tanda en `localStorage`**, para no reconsultar tras recargar.
   Descartada provisionalmente (P5): dejaría nombres de archivo y motivos de error en el navegador
   (contra R27), a cambio de ahorrar una consulta por tanda y recarga.
5. **Llevar el registro al servidor** (las «tandas recientes del usuario», consultadas por autor).
   - Descartada por alcance. Exige un caso de uso nuevo y un filtro por autor que hoy no existe, y
     cambia la autorización: el ticket solo pide corregir los hallazgos 3 a 10.
   - Si el registro en el navegador se queda corto, es una ficha propia.
6. **Pasar `userId` y `companyId` en claro al cliente** para construir la clave. Descartada en
   favor de P3-A: `companyId` no llega hoy a ninguna pantalla (`session-context.ts`), y no hace
   falta que llegue.

## 4. Integraciones

Ninguna nueva. La consulta sigue siendo `getBatchStatusAction`. No hay ningún servicio externo ni
ninguna librería nueva.

## 5. Plan de pruebas (R → test)

Proyecto `ui` de vitest, salvo que se diga otra cosa. Los nombres de los casos llevan el `R<n>` de
este spec. Los títulos actuales con la numeración informal de los informes se **renombran**.

| R | Test |
|---|---|
| R1, R3 | `tests/unit/documentos/document-batch-repository-prisma.test.ts` y `tests/unit/documentos/get-batch-status.test.ts`: los casos existentes, renombrados |
| R2 | `tests/unit/documentos/get-batch-status.test.ts`: «maxAttempts sigue al config», renombrado |
| R4 | `tests/unit/documentos/batch-status.test.ts`: el congelado de claves, renombrado |
| R5–R14, R16 | `tests/unit/documentos-ui/document-batch-panel.test.tsx`: los casos existentes, renombrados y con `registryScope` |
| R15 | `document-batch-panel.test.tsx`: un caso nuevo con `renderToString` que da una salida vacía, y una hidratación sin aviso |
| R17, R18/R35 | `tests/unit/documentos-ui/formula-pdf-upload.test.tsx` |
| R19–R23, R29 | `tests/unit/documentos-ui/batch-memory.test.ts`, **nuevo**: `vi.resetModules()` con `localStorage` precargado, corrupto, con forma antigua, con `getItem` o `setItem` que lanzan, y con la clave global antigua |
| R24, R25 | `tests/unit/documentos-ui/batch-status-store.test.tsx`, **nuevo**: dos consumidores dan una sola llamada por intervalo; desmontar y remontar una tanda terminada o desaparecida no da ninguna llamada nueva |
| R26, R27 | `batch-memory.test.ts`: lo registrado en el ámbito A no aparece en el B, y el valor guardado solo tiene `batchId`, `strategy` y `rememberedAt`. `tests/unit/documentos/remembered-batches-scope.test.ts`, **nuevo**: el ámbito es determinista, distinto por usuario y por empresa, y no contiene los identificadores en claro. |
| R28 | `tests/unit/logout-button.test.tsx`: al enviar, desaparecen las claves con el prefijo y la acción se sigue invocando |
| R30, R31 | `batch-memory.test.ts`: un `StorageEvent` sintético actualiza el panel; con una tanda X escrita «por otra pestaña» después de hidratar, `rememberBatch(Y)` deja X e Y, y `forgetBatch(Y)` deja X |
| R32 | `tests/unit/documentos-ui/labels.test.ts`, **nuevo**: `attemptLabel(0,4)` da «Intento 1 de 4», `(2,4)` da «2 de 4» y `(5,4)` da «4 de 4» |
| R33, R34 | `document-batch-panel.test.tsx`: dos tandas dan dos rótulos distintos, y `getByRole('button', { name })` es único por tanda |
| R36, R37 | `tests/unit/documentos-ui/document-upload-convenciones.test.ts`: un caso nuevo que lee las fuentes de la pieza y el envoltorio |
| R38 | `document-upload-convenciones.test.ts`: la fila del catálogo cita un `.dc.html` existente que no es `Formulas` ni `ModalesProduccion`, y no contiene «entre pestañas» como no cubierto |

## 6. Riesgos

- **El almacén compartido cambia la forma de `useBatchStatus` por dentro.** La suite de la ventana
  (`document-upload-*.test.tsx`) es la red de seguridad: tiene que seguir en verde sin tocarla.
- **El ámbito depende de P3.** Si se elige otra opción, cambia 2.2 y el test
  `remembered-batches-scope.test.ts`, no el resto.
- **La ubicación (P1) puede mover el panel fuera de `FormulaPdfUpload`.** Entonces `page.tsx` monta
  dos componentes de cliente y comparte `registryScope` entre los dos.
