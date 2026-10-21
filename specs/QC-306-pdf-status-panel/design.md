# QC-306 — pdf-status-panel: diseño técnico

> Spec a posteriori: cada sección separa el **estado actual** (lo que está en `dev`,
> `683a7e2e..97070fad`) del **cambio** que pide esta ficha. Los requisitos están en
> `requirements.md`:
> - R1–R17 se conservan; R18 está retirado.
> - R19–R39 son correcciones; R28 está retirado.
>
> Las decisiones P1–P8 se cerraron el 2026-10-21 y están en `requirements.md > Decisiones cerradas`.

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
| `QC-280` `boton-pdf-sin-proveedor-ia` | `disabled` cuando falta proveedor de IA | Origen del caso de R35. |
| `components/shared/step-reader/step-reader.tsx` | Solo menciona `localStorage` para decir que **no** lo usa | Nada que reutilizar. |
| Ningún otro uso de `useSyncExternalStore` ni de un listener de `storage` en `app/`, `components/` o `hooks/` | — | No hay otra pieza que ya resuelva el registro o la sincronía. |

**Ninguna otra pieza resuelve lo mismo.** No hay motivo de bloqueo por duplicado.

### Catálogo consultado (`components/shared/CATALOGO.md`)

| Fila | Uso aquí | Paso de la regla de decisión |
|---|---|---|
| `DocumentBatchPanel`, `DocumentUpload`, `DocumentUploadDialog`, `DocumentUploadRow` (línea 69) | `DocumentUploadRow` se **extiende** con `scope` y `maxAttempts` opcionales, y los usos actuales no cambian | 2 (extender) |
| `Button`, `StatusBadge`, `ArrowLink`, `touchTarget` | Se reutilizan dentro del panel | 1 (reutilizar) |
| `Collapsible` (`components/ui/collapsible.tsx`, citado en el catálogo) | El pliegue del panel (R39) | 1 (reutilizar) |
| `DocumentBatchPanel` | Pieza **nueva** que compone las anteriores | 3 (componer) |

**Excepción declarada.** `DocumentBatchPanel` vive en `components/shared/document-upload/` con un
solo consumidor, la pantalla de fórmulas.
- Motivo: comparte con la pieza su estado interno: `batch-memory`, `use-batch-status` y las filas.
- Moverlo a `app/(private)/produccion/formulas/components/` obligaría a exportar ese estado interno
  desde el barrel.
- Consumidores identificados: `app/(private)/produccion/formulas/page.tsx`, a través de su
  envoltorio de cliente.

### Pase de diseño: FALTA (bloqueante; decisión P6)

El panel es un componente **nuevo** (paso 3), así que necesita un pase `/design` aprobado
(`docs/perfil-agentes.md > Pase de diseño para componentes nuevos`).
- Hoy **no existe** ningún tablero del panel en `docs/diseno/canvas/`.
- La fila del catálogo cita `Formulas.dc.html` y `ModalesProduccion.dc.html`, pero en ellos no sale
  el panel (hallazgo 2).
- Decisión P6: el pase va **antes de aprobar el spec**, y T0 sigue siendo bloqueante.

**Cita del tablero: pendiente.** Se escribirá aquí cuando el tablero aprobado exista en
`docs/diseno/canvas/`. Nombres previstos:
- `PanelTandas.dc.html`
- `PanelTandasTablet.dc.html`
- `PanelTandasMovil.dc.html`

El tablero tiene que dibujar lo ya decidido:
- la ubicación (P1);
- la solo lectura con la subida deshabilitada (P2);
- los rótulos (P7);
- los estados: en curso, error, listo, desaparecida, error de consulta y plegado.

Le toca fijar dos cosas:
- el estado de partida, plegado o desplegado (R39);
- el formato de la «fecha corta» (R33).

**Sin esa referencia no se implementa ninguna tarea visual.**

## 1. Modelo de datos

- **Sin tablas nuevas, sin cambios de RLS y sin migraciones.**
- `DocumentFile.attempts Int @default(0)` y `DocumentFile.originalName String?` ya existían.
- `readBatch` sigue filtrando por `companyId` en sus dos consultas. La autorización vive en el caso
  de uso: `requirePermission` en `get-batch-status.ts`.

### Almacenamiento en el navegador

| | Estado actual | Cambio |
|---|---|---|
| Clave | `document-upload-remembered-batches`, global del navegador | `document-upload-remembered-batches:<userId>:<companyId>`, en claro (P3; R26, R27) |
| Valor | `Array<{ batchId, strategy, rememberedAt }>` | Igual. No se guarda nada más: ni nombres, ni motivos, ni la foto final (R27, P5). |
| Clave global antigua | Se lee | Se **borra** al hidratar, sin leer sus tandas (R29) |
| Limpieza al cerrar sesión | No hay | **No se añade** (P4). La clave por usuario y empresa ya aísla los registros. |

## 2. Contratos

### 2.1 Backend (sin cambios en la consulta)

Se conserva tal cual:
- `DocumentFileStatusEntry` añade `attempts: number` y `name: string`.
- `ReadBatch` es lo que devuelve el puerto `readBatch`.
- `BatchStatus = ReadBatch & { maxAttempts: number }`.
- `maxAttempts = config.maxRetries() + 1` (R1–R4).

**La cota de R32 NO va en el backend.** El valor de `maxAttempts` sigue siendo el de la
configuración, y tocarlo sería tocar la política de reintentos, que está fuera de alcance.

### 2.2 Ámbito del registro (P3: en claro)

- `page.tsx` de fórmulas obtiene, en el servidor y solo cuando `canUpload`, el `userId` y el
  `companyId` de la sesión.
  - `SessionUser` (la forma que recibe la UI) no tiene `companyId`; `SessionContext` sí.
  - El implementer usa el acceso al contexto de sesión que ya existe en `identity`. Si hace falta,
    añade una función de lectura en el módulo `documentos` que devuelva solo esos dos campos, sin
    ampliar el `SessionUser` congelado.
- `registryScope = "<userId>:<companyId>"` se pasa como prop `string` a `FormulaPdfUpload`. De ahí
  llega a `DocumentUploadDialog` (y a `DocumentUpload`) y a `DocumentBatchPanel`.
- **Efecto aceptado (P3).** `companyId` llega al cliente y al almacenamiento del navegador por
  primera vez. Hoy ninguna pantalla lo muestra (`session-context.ts`).
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
| API | `rememberedBatches()`, `rememberBatch(id, strategy)`, `forgetBatch(id)`, `onRememberedBatchesChange(fn)` | Las mismas, con `scope` como primer argumento. No hay borrado masivo (P4). |

- La suscripción añade un único `window.addEventListener('storage', …)` mientras haya oyentes, y lo
  quita con el último.
- El evento se filtra por la clave exacta del ámbito.
- **Nada de `.subscribe(`, ni `channel(`, ni `EventSource`.** La guardia R15 de
  `document-upload-convenciones.test.ts` prohíbe esos patrones en la carpeta de la pieza.
- `useRememberedBatches(scope, strategy)` mantiene la foto de servidor vacía (R15).
- **La foto de cliente se cachea por ámbito.** Una referencia estable que solo cambia al mutar
  evita el bucle de renders.

### 2.4 Sondeo compartido: `batch-status-store.ts` (nuevo, interno)

| | Estado actual | Cambio |
|---|---|---|
| Quién sondea | Cada `useBatchStatus(batchId)` arma su propio temporizador. Con la ventana y el panel montados, la misma tanda se consulta dos veces cada 2 s (hallazgo 4). | Un almacén de módulo **por `batchId`**: un solo bucle de consulta por tanda, sea cual sea el número de suscriptores (R24) |
| Fin del sondeo | Al terminar, con error o si la tanda desaparece | Igual, y además se para cuando se va el último suscriptor |
| Remontar dentro de la misma carga | Vuelve a consultar | Si la última foto fue terminada o desaparecida, se sirve de memoria y **no se consulta** (R25) |
| Tras recargar | Consulta y sondea | Una consulta por tanda: si está terminada, se para ahí (R25, P5) |
| `resume` | Limpia el error y vuelve a armar | Igual, sobre la entrada compartida |

- El contrato público `UseBatchStatusResult` (`status`, `error`, `missing`, `resume`) **no cambia**.
  Los consumidores y `use-batch-status.test.tsx` siguen igual.
- La memoria de fotos finales vive en el módulo: dura lo que dura la carga de la aplicación y no se
  persiste.
- Se sigue el mismo criterio que hoy: el siguiente temporizador se arma cuando responde la consulta
  anterior, así que nunca hay dos consultas en vuelo para la misma tanda.

### 2.5 Panel y filas

| | Estado actual | Cambio |
|---|---|---|
| Ubicación | Dentro de `PageHeader > actions`, con `basis-full` | Una sección a todo el ancho **debajo** de `PageHeader`, en `page.tsx` (P1, R17). `FormulaPdfUpload` se parte: la ventana sigue en `actions` y el panel se monta aparte, con la misma `registryScope`. |
| Pliegue | No hay | `Collapsible`: el título queda siempre visible, con un control para plegar y desplegar (R39). El estado de partida lo fija el tablero. |
| Visibilidad | Sin tandas no se pinta | Igual (R14) |
| Rótulo por tanda | «Tanda», igual para todas (`PANEL_BATCH_LABEL`) | `batchLabel(rememberedAt, fileCount, now)` da «Tanda de hoy, 14:32», «Tanda de ayer, 14:32» o «Tanda del <fecha corta>, 14:32», y añade « · 3 archivos» cuando hay estado (R33, P7) |
| Nombre accesible del bloque | Ninguno | El `<li>` lleva `aria-labelledby` al rótulo (R34) |
| «Descartar» | Mismo nombre en todos | `aria-label={discardBatchLabel(rememberedAt, now)}`, que da «Descartar la tanda de hoy, 14:32» (R34) |
| «Intento N de M» | `Math.max(1, attempts)`, sin cota superior | `Math.min(Math.max(1, attempts), maxAttempts)` (R32) |
| `disabled` | `return null` | **Solo lectura** (P2, R35): se pinta con estado, «Revisar» y «Descartar», sin ninguna acción de subida |

- `batchLabel` y `discardBatchLabel` reciben `now` para que el test sea determinista.
  - «Hoy» y «ayer» se calculan por día civil **local**.
  - La hora se formatea con `Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' })`.
- **Sin desajuste de hidratación.** El servidor no pinta nada del panel (R15), así que la hora local
  solo se calcula en el cliente.

### 2.6 Formato (R36–R38)

- Los 12 archivos que perdieron el salto de línea final lo recuperan (lista en el hallazgo 10).
  `.gitattributes` ya fija `eol=lf`.
- Ninguna línea de más de 100 columnas en los archivos de producción que toca esta feature (P8).
  - El límite lo comprueba un caso del test de convenciones, limitado a esa lista de archivos.
  - No se tocan los documentos ni ESLint.
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
3. **`BroadcastChannel` para la sincronía entre pestañas.** Descartada: el evento `storage` ya avisa
   a las demás pestañas del mismo origen cuando cambia la clave, y no añade un segundo canal que
   mantener coherente con el almacenamiento.
4. **Guardar la foto final de la tanda en `localStorage`**, para no reconsultar tras recargar.
   Rechazada en P5: dejaría nombres de archivo y motivos de error en el navegador (R27), a cambio de
   ahorrar una consulta por tanda y recarga.
5. **Un resumen opaco (SHA-256 de `userId:companyId`) como clave del ámbito**, para no exponer
   `companyId` al cliente. Rechazada por el humano en P3: la clave usa los identificadores en claro.
6. **Borrar los registros al cerrar sesión.** Rechazada en P4: la clave por usuario y empresa ya los
   aísla, y un cierre que no pasa por el botón (por caducidad) no se vería de todos modos.
7. **Llevar el registro al servidor** (las «tandas recientes del usuario», consultadas por autor).
   - Descartada por alcance. Exige un caso de uso nuevo y un filtro por autor que hoy no existe, y
     cambia la autorización: el ticket solo pide corregir los hallazgos 3 a 10.
8. **Una hoja lateral con contador en la cabecera** como ubicación del panel. Rechazada en P1 en
   favor de la sección plegable debajo de la cabecera.

## 4. Integraciones

Ninguna nueva. La consulta sigue siendo `getBatchStatusAction`. No hay ningún servicio externo ni
ninguna librería nueva.

## 5. Plan de pruebas (R → test)

Proyecto `ui` de vitest, salvo que se diga otra cosa. Los nombres de los casos llevan el `R<n>` de
este spec. Los títulos actuales con la numeración informal de los informes se **renombran**. R18 y
R28 están retirados y no tienen test.

| R | Test |
|---|---|
| R1, R3 | `tests/unit/documentos/document-batch-repository-prisma.test.ts` y `tests/unit/documentos/get-batch-status.test.ts`: los casos existentes, renombrados |
| R2 | `tests/unit/documentos/get-batch-status.test.ts`: «maxAttempts sigue al config», renombrado |
| R4 | `tests/unit/documentos/batch-status.test.ts`: el congelado de claves, renombrado |
| R5–R14, R16 | `tests/unit/documentos-ui/document-batch-panel.test.tsx`: los casos existentes, renombrados y con `registryScope` |
| R15 | `document-batch-panel.test.tsx`: un caso nuevo con `renderToString` que da una salida vacía, y una hidratación sin aviso |
| R17 | `tests/unit/documentos-ui/formulas-upload.test.tsx` y `formula-pdf-upload.test.tsx`: el panel queda fuera del contenedor de `actions` de la cabecera, con la estrategia y la ruta de revisión de fórmulas |
| R19–R23, R29 | `tests/unit/documentos-ui/batch-memory.test.ts`, **nuevo**: `vi.resetModules()` con `localStorage` precargado, corrupto, con forma antigua, con `getItem` o `setItem` que lanzan, y con la clave global antigua |
| R24, R25 | `tests/unit/documentos-ui/batch-status-store.test.tsx`, **nuevo**: dos consumidores dan una sola llamada por intervalo; remontar una tanda terminada o desaparecida no da ninguna llamada nueva; tras `vi.resetModules()` (recarga), una tanda terminada da exactamente una llamada |
| R26, R27 | `batch-memory.test.ts`: lo registrado en `u1:c1` no aparece en `u1:c2` ni en `u2:c1`; la clave es `document-upload-remembered-batches:u1:c1`, y el valor guardado solo tiene `batchId`, `strategy` y `rememberedAt` |
| R30, R31 | `batch-memory.test.ts`: un `StorageEvent` sintético actualiza el panel; con una tanda X escrita «por otra pestaña» después de hidratar, `rememberBatch(Y)` deja X e Y, y `forgetBatch(Y)` deja X |
| R32 | `tests/unit/documentos-ui/labels.test.ts`, **nuevo**: `attemptLabel(0,4)` da «Intento 1 de 4», `(2,4)` da «2 de 4» y `(5,4)` da «4 de 4» |
| R33 | `labels.test.ts`: con un `now` fijo, «Tanda de hoy, 14:32», «Tanda de ayer, …», la fecha corta para el resto, y « · 3 archivos» solo con el recuento |
| R34 | `labels.test.ts` («Descartar la tanda de hoy, 14:32») y `document-batch-panel.test.tsx`: `getByRole('button', { name })` es único por tanda, y cada `listitem` tiene su nombre accesible |
| R35 | `formula-pdf-upload.test.tsx`: con `disabled` y tandas recordadas, el panel muestra el estado, «Revisar» y «Descartar», y no hay ningún control de subida dentro del panel |
| R36, R37 | `tests/unit/documentos-ui/document-upload-convenciones.test.ts`: un caso nuevo que lee los archivos de producción de la feature (salto de línea final y como mucho 100 columnas) |
| R38 | `document-upload-convenciones.test.ts`: la fila del catálogo cita un `.dc.html` existente que no es `Formulas` ni `ModalesProduccion`, y no contiene «entre pestañas» como no cubierto |
| R39 | `document-batch-panel.test.tsx`: plegar oculta la lista y deja el título y el control; desplegar la muestra |

## 6. Riesgos

- **El almacén compartido cambia la forma de `useBatchStatus` por dentro.** La suite de la ventana
  (`document-upload-*.test.tsx`) es la red de seguridad: tiene que seguir en verde sin tocarla.
- **Partir `FormulaPdfUpload` toca `page.tsx`.** `formulas-upload.test.tsx` y los tests de la página
  de fórmulas tienen que seguir en verde.
- **Obtener `companyId` en `page.tsx`** puede requerir una función de lectura nueva. No debe ampliar
  `SessionUser`, que está congelado desde QC-8.
