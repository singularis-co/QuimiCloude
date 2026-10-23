# QT-291 — Selección de modelo IA por tarea

> **Zona** fullstack · **Complejidad** high · **depends_on** QC-275 (hecha) · **Rama** `feature/QT-291-seleccion-de-modelo-por-tarea`
>
> **Alcance.** En Integraciones › Proveedor IA (`/integraciones/proveedor-ia`) la empresa elige
> **un** modelo de su proveedor conectado, que se usa para las dos lecturas de PDF (fórmula y
> catálogo). La lista sale de un catálogo global de modelos que mantiene la plataforma y nace
> sembrado por migración; solo entran modelos que leen PDF **e** imágenes. La pantalla muestra solo
> los modelos del proveedor conectado. Si no elige, usa el modelo por defecto del catálogo. La
> lectura usa el modelo elegido, y «Probar conexión» lo verifica.
>
> **Lo que NO entra.** Pantalla para que la plataforma agregue o quite modelos del catálogo
> (QT-292). Un modelo distinto por tarea. Mostrar modelos de proveedores no conectados. Consultar
> el listado de modelos a la API de cada proveedor. Respaldo encadenado de proveedores (QC-276) o
> de modelo (QC-175). Medir o limitar consumo.
>
> Sembrado por `/afinar-feature` el 2026-10-22. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

> Escritos por `spec_author` el 2026-10-22 (F1.2). Entre corchetes, la fila de la tabla de
> decisiones que cubre cada uno, citada por su **orden** en la tabla (no se renumera la tabla):
> **D1** solo el proveedor conectado · **D2** catálogo global, sin consultar la API · **D3** solo
> modelos que leen PDF e imágenes · **D4** un solo modelo para las dos tareas, predeterminado sin
> elección · **D5** sembrado por migración (pantalla en QT-292) · **D6** cambiar de proveedor borra
> la elección · **D7** modelo desaparecido: falla y Error, sin vuelta al predeterminado · **D8**
> «Probar conexión» prueba el modelo en uso · **D9** diseño · **D10** `integraciones.modificar` ·
> **D11** identificadores de DB en inglés. **[A]** = sale del bloque de Alcance.
>
> **Enmienda F1.4 (2026-10-22).** Las filas «(F1.4)» de la tabla se citan como **E1** modelos
> sembrados · **E2** recomendado · **E3** se borran `recipe_model`/`catalog_model` · **E4** modelo no
> disponible al leer · **E5** textos de «Probar conexión» · **E6** ayuda sin conexión · **E7** E2E ·
> **E8** probar al elegir. Cambian R2, R3, R4, R9, R12, R15, R20, R23, R26, R27, R29, R30; se añaden
> R32–R34. E7 no es un comportamiento: lo cumple el E2E de R26, R27 y R29 (`design.md > 13`).
>
> Vocabulario (además del de `specs/QC-275-proveedor-ia-propio/requirements.md`, que sigue vigente
> salvo donde un requisito de aquí lo sustituye, citado como «sustituye QC-275 R<n>»):
>
> - «el catálogo de modelos» = las filas de la tabla global de modelos: proveedor, identificador del
>   modelo, si es el predeterminado de su proveedor y su orden.
> - «el predeterminado» = el modelo del catálogo marcado como predeterminado del proveedor de la
>   conexión, leído en el momento en que se usa. En la pantalla se rotula «Recomendado» (E2); en la
  base y en el código sigue siendo el predeterminado (`is_default`).
> - «la elección» = el modelo que la empresa eligió, guardado en su conexión; vacía si no eligió o
>   si eligió el predeterminado.
> - «el modelo en uso» = la elección si no está vacía; si lo está, el predeterminado.
> - «modelo no disponible» = el proveedor responde que el modelo no existe o que la cuenta no tiene
>   acceso (el tipo `model_unavailable` de `specs/QC-275-proveedor-ia-propio/design.md > 7.3`).
> - «el modelo marcado» = el modelo que la conexión tiene registrado como no disponible; vacío si
>   no hay ninguno.

### Catálogo de modelos

**R1.** El sistema DEBE tener un catálogo global de modelos, sin columna de empresa, en el que cada
fila pertenece a un proveedor de `ai_providers`, lleva un identificador de modelo no vacío y único
dentro de su proveedor y un orden; con RLS activada y forzada, columnas con nombre en inglés y una
migración con su `down.sql` que la revierte. [D2, D5, D11]

**R2.** La migración DEBE sembrar en el catálogo de modelos exactamente los veinte modelos de
`design.md > 3`, cinco por cada proveedor de `ai_providers`, con el orden de cada proveedor del 1 al 5
según la calidad que fija esa tabla, y solo modelos que aceptan PDF e imágenes como entrada según la
fuente citada allí. [D3, D5, E1]

**R3.** El sistema DEBE tener exactamente un predeterminado por cada proveedor de `ai_providers`
—`claude-haiku-5-5` (Claude), `gemini-3.8-flash` (Gemini), `gpt-6-luna` (OpenAI) y
`anthropic/claude-haiku-5.5` (OpenRouter)—, y la base DEBE rechazar un segundo predeterminado del
mismo proveedor. [D4, E2]

**R4.** `ai_providers` NO DEBE guardar modelos por uso (receta, catálogo): tras la migración, el
modelo de un proveedor DEBE salir solo del catálogo de modelos. [D4, E3]

**R5.** El sistema NO DEBE llamar a ningún proveedor para listar sus modelos: las opciones salen solo
del catálogo de modelos. [D2]

**R6.** Ningún archivo de `lib/` DEBE contener un identificador de modelo de IA escrito a mano
(QC-275 R43 sigue vigente). [D2, D5]

### La elección

**R7.** La conexión DEBE guardar como mucho una elección, y la base DEBE rechazar una elección que no
sea un modelo del catálogo del **mismo** proveedor de la conexión. [D1, D4, D11]

**R8.** CUANDO un actor sin `integraciones.modificar` (o sin sesión, o sin empresa) elige un modelo,
el sistema DEBE rechazarlo con `unauthorized` antes de validar la entrada, sin leer ni escribir la
conexión. [D10]

**R9.** CUANDO un actor con `integraciones.modificar` elige un modelo del catálogo del proveedor
conectado de su empresa y la consulta de R32 sale bien, el sistema DEBE guardarlo como la elección;
SI el modelo elegido es el predeterminado, ENTONCES DEBE dejar la elección vacía. [D4, D10, E8]

**R10.** SI el modelo pedido no es del catálogo del proveedor conectado (de otro proveedor,
inexistente, vacío o el modelo marcado), ENTONCES el sistema DEBE rechazar con `invalid_input` sin
escribir nada. [D1, D3, D7]

**R11.** SI la empresa no tiene conexión cuando se elige un modelo, ENTONCES el sistema NO DEBE
escribir nada y DEBE responder «sin conexión» para que la pantalla se recargue. [D4]

**R12.** CUANDO se guarda una elección y la conexión tiene un modelo marcado, el sistema DEBE vaciar
el modelo marcado y, SI la conexión estaba en `ERROR` por ese modelo, ENTONCES DEBE dejarla en
`ACTIVE` con `lastError` y `lastErrorAt` vacíos. CUANDO se guarda una elección y la conexión está en
`ERROR` por key rechazada o sin cuota (el error lo dejó «Probar conexión» o una lectura), el sistema
DEBE, además de guardar la elección, dejarla en `ACTIVE` con `lastError` y `lastErrorAt` vacíos. SI
la conexión está en `ERROR` por otra causa (sin respuesta, error inesperado, key ilegible), ENTONCES
elegir un modelo NO DEBE cambiar su estado ni su error. [D7, E8, decisión «(F1.4) Conexión en Error
por key o cuota»]

**R13.** Ninguna respuesta de la elección DEBE incluir la key ni su valor cifrado (QC-275 R8). [D10]

**R32.** CUANDO un actor con `integraciones.modificar` elige un modelo que pasa R10 y R11, el sistema
DEBE, antes de escribir nada, consultar al proveedor conectado con la key guardada la existencia de
**solo** ese modelo sin generar texto, con la misma prueba de QC-275 R10 (sin reintentos, plazo de
10 s); también si el modelo elegido es el predeterminado. [D8, E8]

**R33.** SI la consulta de R32 falla —key rechazada, sin cuota o saldo, modelo no disponible, sin
respuesta o error inesperado (los tipos de `specs/QC-275-proveedor-ia-propio/design.md > 7.3`)—,
ENTONCES el sistema NO DEBE escribir nada en la conexión (ni la elección, ni el estado, ni
`lastError`, `lastErrorAt`, `lastCheckedAt` ni el modelo marcado) y DEBE devolver el mensaje de la
prueba de ese tipo (QC-275 R11; con modelo no disponible, el de R20). [D7, E8]

**R34.** SI la key guardada no se puede descifrar al elegir un modelo, ENTONCES el sistema NO DEBE
llamar al proveedor, NO DEBE guardar la elección y DEBE responder `integration_secret_unreadable`.
[E8]

### Cambiar de proveedor

**R14.** CUANDO se guarda la conexión con un proveedor distinto del que tenía, el sistema DEBE vaciar
la elección y el modelo marcado; CUANDO se guarda con el mismo proveedor (solo cambia la key), DEBE
conservar la elección. [D6]

**R15.** CUANDO el Administrador pulsa «Cambiar key o proveedor» y la elección no está vacía, la
pantalla DEBE pedir confirmación con el título «¿Cambiar de proveedor?» y el texto de
`design.md > 11` (que nombra el modelo recomendado del nuevo proveedor); «Continuar» abre el
formulario y «Cancelar» no cambia nada. SI la elección está vacía, ENTONCES DEBE abrir el formulario
sin confirmación. [D6, D9, E2]

### El modelo en uso

**R16.** CUANDO se procesa un PDF con la estrategia `formula` o `catalogo` (incluida la petición de
coordenadas del recorte), el sistema DEBE leerlo con el modelo en uso de la conexión de la empresa
dueña del archivo, el mismo para las dos estrategias. Sustituye QC-275 R21. [A, D4]

**R17.** MIENTRAS la elección está vacía, el sistema DEBE tomar el predeterminado del catálogo de
modelos en el momento de cada lectura y de cada prueba, de modo que cambiar el predeterminado afecta
a la siguiente lectura de toda empresa sin elección. Sustituye QC-275 R6. [D4, D5]

### La prueba

**R18.** CUANDO el Administrador pulsa «Probar conexión» sobre la conexión guardada, la prueba DEBE
consultar la key guardada y **solo** el modelo en uso. Sustituye, en lo que toca a los modelos,
QC-275 R10 y R14. [D8]

**R19.** CUANDO se prueba o se guarda una key escrita en el formulario, la prueba DEBE consultar el
modelo que quedará en uso al guardar: la elección actual si el proveedor escrito es el conectado y
la elección no está vacía; si no, el predeterminado del proveedor escrito. [D6, D8]

**R20.** SI una prueba (de la conexión guardada, de una key escrita o la de R32) falla porque el
modelo consultado no está disponible, ENTONCES el mensaje de la prueba DEBE ser «Error con tu
proveedor: el modelo <modelo> ya no está disponible.» (sustituye ese texto de QC-275 R11); CUANDO
«Probar conexión» (de la conexión guardada o de una key escrita) sale bien, la pantalla DEBE mostrar
«Conexión correcta · el modelo en uso responde», sin el tiempo de respuesta (sustituye el texto de
QC-275 R12). [D8, D9, E5]

**R21.** SI la prueba de la conexión guardada falla porque el modelo en uso no está disponible,
ENTONCES el sistema DEBE dejar la conexión en `ERROR`, con ese modelo como modelo marcado,
`lastErrorAt` = el instante de la prueba y `lastError` = el aviso de modelo no disponible de
`design.md > 4.4`. [D7, D8]

**R22.** CUANDO la prueba de la conexión guardada es buena, el sistema DEBE, además de lo de QC-275
R14, vaciar el modelo marcado. [D7, D8]

### El modelo desaparece al leer

**R23.** SI durante la lectura de un archivo el proveedor responde que el modelo en uso no está
disponible, ENTONCES el sistema DEBE terminar el archivo en error con `ai_provider_error`, sin
reintento de la cola; DEBE dejar la conexión en `ERROR` con ese modelo como modelo marcado,
`lastError` = el aviso de modelo no disponible de `design.md > 4.4` y `lastErrorAt` = el instante
del fallo; y NO DEBE repetir la lectura con el predeterminado ni con ningún otro modelo. Sustituye
QC-275 R26 para este fallo; aplica también si el modelo en uso es el predeterminado. [D7, E4]

**R24.** CUANDO la lectura de un archivo termina bien y la conexión estaba en `ERROR`, el sistema
DEBE, además de lo de QC-275 R27, vaciar el modelo marcado. [D7]

**R25.** MIENTRAS la conexión tiene un modelo marcado, el sistema DEBE seguir admitiendo la subida de
PDF y DEBE intentar su lectura con el modelo en uso, sin cambiarlo (QC-275 R28). [D7]

### Pantalla Integraciones › Proveedor IA

**R26.** MIENTRAS la empresa tiene conexión, la tarjeta DEBE mostrar la sección «Modelo» con el texto
«Se usa para leer fórmulas y catálogos en PDF. Solo aparecen modelos de <proveedor> que leen PDF e
imágenes.» y **un solo** selector «Modelo de <proveedor>» cuyas opciones son los modelos del catálogo
del proveedor conectado, en su orden, con «recomendado» junto al predeterminado y una marca en el
modelo en uso; NO DEBE mostrar modelos de otro proveedor ni las filas «Receta (fórmula desde PDF)» y
«Catálogo desde PDF», y NO DEBE rotular ningún modelo como «predeterminado». [D1, D3, D4, D9, E2]

**R27.** MIENTRAS la elección está vacía, el selector DEBE mostrar el predeterminado con la insignia
«Recomendado» y la ayuda «Se usa el modelo recomendado de <proveedor>.»; MIENTRAS la elección
no está vacía y no es el modelo marcado, DEBE mostrarla con la ayuda «Elegido por tu empresa.». [D4, D9, E2]

**R28.** MIENTRAS el modelo en uso es el modelo marcado, el selector DEBE mostrarlo tachado con la
insignia «No disponible», marcado como inválido y con la ayuda «Este modelo ya no está disponible.
Elige otro para volver a leer PDF.», y ese modelo NO DEBE aparecer entre las opciones. [D7, D9]

**R29.** CUANDO el Administrador elige una opción, la pantalla DEBE enviarla sin otro botón y,
MIENTRAS se consulta el modelo (R32), DEBE mostrar el selector ocupado y no admitir otra elección; si
se guarda, DEBE mostrar el aviso emergente «Modelo guardado»; SI falla (R33, R34 o un error del
catálogo), ENTONCES DEBE mostrar bajo el selector el texto del error y volver a mostrar el valor
anterior. [D9, E8]

**R30.** MIENTRAS la empresa no tiene conexión, la ayuda del formulario DEBE ser «Después de conectar
podrás elegir el modelo.», sin nombrar ningún modelo (sustituye la mención de los dos modelos de
QC-275 R30). [D4, D9, E6]

**R31.** El selector DEBE cumplir la regla multiplataforma (letra ≥ 16 px, objetivos táctiles
≥ 44 × 44 px, nada que dependa solo de `:hover`) y la disposición de los tableros aprobados: a 640 px
o menos, disparador a todo el ancho con 48 px de alto y la lista en una hoja inferior. [D9]


## Preguntas abiertas

Ninguna. Las ocho de F1.4 y las tres de la enmienda están cerradas: son las filas «(F1.4)» de la
tabla.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-22 | ¿De qué proveedores se listan modelos? | Solo del proveedor conectado de la empresa. (Revisa la decisión anterior del mismo día, «los cuatro», al ver el tablero.) |
| 2026-10-22 | ¿De dónde sale la lista? | De un catálogo global que mantenemos nosotros. No se consulta la API del proveedor para listar. |
| 2026-10-22 | ¿Qué modelos entran en el catálogo? | Solo los que leen PDF e imágenes, sin agrupar. Verificado en código: fórmula manda el PDF (`MODE_BY_STRATEGY.formula = 'pdf'`) y catálogo manda páginas PNG, también para el recorte (`MODE_BY_STRATEGY.catalogo = 'images'`, `crop-catalog-images.ts`). |
| 2026-10-22 | ¿Granularidad? | Un solo modelo para las dos tareas (fórmula y catálogo). Sin elección, el predeterminado del catálogo. (Revisa «un modelo por tarea».) |
| 2026-10-22 | ¿Cómo entra un modelo nuevo? | Desde una pantalla de plataforma, en ficha aparte (QT-292). En esta ficha el catálogo nace sembrado por migración. |
| 2026-10-22 | ¿Qué pasa al cambiar de proveedor? | Se borra la elección: vuelve el predeterminado del nuevo proveedor. |
| 2026-10-22 | ¿Y si el modelo elegido desaparece del proveedor? | La lectura falla y la conexión queda en Error con su aviso hasta que elija otro (patrón QC-275). Sin vuelta automática al predeterminado. |
| 2026-10-22 | ¿«Probar conexión» verifica el modelo elegido? | Sí: prueba el modelo en uso (elegido o predeterminado). |
| 2026-10-22 | ¿Diseño? | Tableros `docs/diseno/canvas/ProveedorIAModelos.dc.html`, `ProveedorIAModelosTablet.dc.html` y `ProveedorIAModelosMovil.dc.html`, aprobados por el humano («aprobado», 2026-10-22). Un solo selector en la tarjeta «conectado» de QC-275; estados predeterminado, elegido y modelo retirado. |
| 2026-10-22 | ¿Quién elige el modelo? | `integraciones.modificar` (heredado de QC-275 D2). |
| 2026-10-22 | (F1.4) ¿Qué modelos se siembran? | 5 por proveedor, los mejores calidad/precio, ordenados por calidad (fuente: `https://openrouter.ai/api/v1/models`, 2026-10-22; todos con entrada `file`+`image`). Claude: `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-opus-5`, `claude-sonnet-5`, `claude-haiku-5-5`. Gemini: `gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`. OpenAI: `gpt-6.1-sol`, `gpt-6-sol`, `gpt-6-luna-pro`, `gpt-6-luna`, `gpt-5.6-luna`. OpenRouter: `anthropic/claude-sonnet-5.5`, `openai/gpt-6.1-sol`, `google/gemini-3.8-flash`, `anthropic/claude-haiku-5.5`, `openai/gpt-6-luna`. Fuera por precio: `claude-fable-5.1`, `gpt-6-astra`. Los ids nativos (Claude, Gemini, OpenAI) se confirman en T0 contra la API; si uno no existe con ese nombre, se para y se pregunta. |
| 2026-10-22 | (F1.4) ¿Cuál es el predeterminado? | Uno por proveedor, mostrado en la pantalla como «Recomendado» (no «Predeterminado»): el mejor calidad/precio, que es el de hoy para no cambiar el costo de nadie. Claude `claude-haiku-5-5`, Gemini `gemini-3.8-flash`, OpenAI `gpt-6-luna`, OpenRouter `anthropic/claude-haiku-5.5`. |
| 2026-10-22 | (F1.4) ¿Se borran `recipe_model` y `catalog_model` de `ai_providers`? | Sí, con `down.sql` que los restaura. |
| 2026-10-22 | (F1.4) Modelo no disponible al leer | El archivo falla sin reintento y la conexión pasa a Error (también si el modelo es el recomendado). Cambia QC-275. |
| 2026-10-22 | (F1.4) Textos de «Probar conexión» | Los del tablero nuevo: «Conexión correcta · el modelo en uso responde» y «Error con tu proveedor: el modelo <modelo> ya no está disponible.». |
| 2026-10-22 | (F1.4) Ayuda del formulario sin conexión | Sin nombrar modelo: «Después de conectar podrás elegir el modelo.». |
| 2026-10-22 | (F1.4) ¿E2E? | Sí, mínimo: se ajusta el E2E actual de Proveedor IA y se añade elegir modelo con Gemini. |
| 2026-10-22 | (F1.4) ¿Se prueba el modelo al elegirlo? | Sí: antes de guardar se consulta el modelo con la key guardada, sin generar texto. Si no responde, no se guarda y se avisa. (Revisa «se guarda al instante» del tablero.) |
| 2026-10-22 | (F1.4) Al elegir, si la prueba falla por key rechazada, cuota o key ilegible, ¿la conexión pasa a Error? | No: se avisa bajo el selector y no se escribe nada. |
| 2026-10-22 | (F1.4) Conexión en Error por key o cuota: si la prueba al elegir sale bien, ¿vuelve a Conectado? | Sí: queda `ACTIVE` con `lastError` y `lastErrorAt` vacíos, además de guardar la elección. (Cambia la propuesta de R12.) |
| 2026-10-22 | (F1.4) ¿Un id nativo sin confirmar por falta de key bloquea el merge? | No. Se implementa con los ids de la fuente; al cerrar, el leader lista los pendientes y el humano los acepta por escrito antes del PR. |
| 2026-10-22 | (F2) Código de error de `selectAiModelAction` cuando la prueba al elegir falla | `ai_provider_error` con el mensaje de la prueba, igual que «Probar conexión». |
| 2026-10-22 | (F2) La conexión se borra entre la consulta y la escritura al elegir | Responde «sin conexión», como R11. No se escribe nada. |
| 2026-10-22 | (F2) Key ilegible al elegir (R34) | La conexión no pasa a Error; se avisa bajo el selector y el error queda registrado en el log del servidor. |
| 2026-10-22 | (F2) Nombre de los tests nuevos en archivos compartidos con QC-275 | Prefijo «QT-291 R<n>». |
| 2026-10-22 | (F2) Ayuda «Después de conectar podrás elegir el modelo.» al abrir «Cambiar key o proveedor» | Se oculta cuando ya hay conexión: solo sale en el alta. |
| 2026-10-22 | (F2) Ids nativos sin confirmar: Anthropic `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-opus-5`, `claude-sonnet-5` (key 401); OpenAI `gpt-6.1-sol`, `gpt-6-sol`, `gpt-6-luna-pro`, `gpt-5.6-luna` (sin key) | Aceptados por escrito por el humano. No bloquean el PR. |
| — | Identificadores de DB | En inglés (heredado de QC-4). |
