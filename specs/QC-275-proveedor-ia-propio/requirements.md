# QC-275 — Proveedor IA propio de la empresa

> **Zona** fullstack · **Complejidad** high · **depends_on** QC-234 (hecha) · **Rama** `feature/QC-275-proveedor-ia-propio`
>
> **Alcance.** En Integraciones > Proveedor IA (`/integraciones/proveedor-ia`, hoy placeholder de
> QC-222) el Administrador elige **un** proveedor de IA, pega su API key, la prueba y la guarda
> cifrada (`SecretCipher` de QC-234). Desde entonces la lectura de fórmula desde PDF (QC-159) y de
> catálogo desde PDF (QC-158) de esa empresa usan **su** key, con el modelo que el seed fija para
> cada uso. Catálogo de proveedores por seed: Claude (Anthropic), Gemini (Google), OpenAI y
> OpenRouter, con un modelo de receta y otro de catálogo cada uno. Sin proveedor, la lectura de PDF
> se bloquea con un aviso que lleva a Integraciones.
>
> **Lo que NO entra.** Varios proveedores como respaldo encadenado (QC-276). Elegir modelo a mano.
> Medir o limitar el consumo. Rotación de la clave de cifrado (QC-250).
>
> Sembrado por `/afinar-feature` el 2026-10-13. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

> Escritos por `spec_author` el 2026-10-13 (F1.2). Entre corchetes, la fila de la tabla de
> decisiones que cubre cada uno, citada por su **orden** en la tabla (no se renumera la tabla):
> **D1** corte inmediato · **D2** Administrador con `integraciones.modificar` · **D3** SDK de OpenAI ·
> **D4** uno por empresa · **D5** proveedores del seed · **D6** cambiar y quitar · **D7** probar la
> key · **D8** fallo en uso · **D9** key nunca devuelta y cifrada · **D10** diseño y logos ·
> **D11** identificadores de DB en inglés. **[A]** = sale del bloque de Alcance.
>
> Vocabulario:
>
> - «la conexión» = la fila de `ai_provider_connections` de la empresa (como mucho una, D4).
> - «el catálogo» = las filas de `ai_providers`: proveedor, nombre y los dos modelos (D5).
> - «el actor» = el usuario de la sesión, con su empresa y su conjunto de permisos.
> - «uso receta» = la lectura de fórmula desde PDF (estrategia `formula`); «uso catálogo» = la
>   lectura de catálogo desde PDF (estrategia `catalogo`), incluida la petición de coordenadas del
>   recorte de imágenes.
> - «la prueba» = la llamada mínima al proveedor de `design.md > 7.2`, con una key y los dos modelos
>   del proveedor en el catálogo.
> - «fallo de cuenta» = el proveedor rechaza la key (HTTP 401 o 403, o el equivalente propio del
>   proveedor que fija `design.md > 7.3`) o responde sin cuota o saldo (HTTP 429, o el equivalente
>   propio). Cualquier otro fallo (plazo, red, 5xx, 404 de modelo durante una lectura, respuesta sin
>   texto, PDF ilegible) **no** es fallo de cuenta.
> - «el mensaje del proveedor» = el texto que compone el sistema según el tipo de fallo
>   (`design.md > 4.4`); nunca el texto libre que devuelve el proveedor.

### Autorización y ámbito

**R1.** CUANDO un actor sin `integraciones.modificar` (o sin sesión, o sin empresa) invoca
cualquier operación de la conexión (consultar, probar, guardar, desconectar), el sistema DEBE
rechazarla con el error `unauthorized` antes de validar la entrada, sin leer ni escribir
`ai_provider_connections` y sin llamar a ningún proveedor. [D2]

**R2.** El sistema DEBE resolver la empresa de toda operación sobre la conexión desde la sesión del
actor —o, en el procesamiento en cola, desde la fila del archivo reclamado—, nunca desde la
entrada, y toda lectura o escritura de `ai_provider_connections` DEBE filtrar por esa empresa. [D2, D4]

**R3.** CUANDO un usuario sin `integraciones.modificar` pide `/integraciones/proveedor-ia`, el
sistema DEBE responder 404 sin entrada en el menú, como hoy (QC-222). [D2]

### Modelo de datos y catálogo

**R4.** El sistema DEBE tener en `ai_providers` exactamente cuatro proveedores —Claude (Anthropic),
Gemini (Google), OpenAI y OpenRouter—, cada uno con un nombre visible, un modelo de receta y un
modelo de catálogo no vacíos, sembrados por una migración con su `down.sql`. [D5, D11]

**R5.** El sistema DEBE guardar la conexión en `ai_provider_connections` con `company_id`
obligatorio, como mucho una fila por empresa (índice único sobre `company_id`), referencia
obligatoria a un proveedor de `ai_providers`, RLS activada y forzada en las dos tablas, columnas
con nombre en inglés y una migración con su `down.sql` que la revierte. [D4, D5, D11]

**R6.** CUANDO una lectura usa la conexión, el sistema DEBE tomar los modelos del catálogo en ese
momento (no una copia guardada en la conexión), de modo que cambiar un modelo del catálogo afecta
a la siguiente lectura de todas las empresas con ese proveedor. [D5]

### La key

**R7.** CUANDO se guarda una key, el sistema DEBE persistir solo su valor cifrado con el cifrador
de QC-234 y el contexto `{ companyId: <empresa>, recordId: <id de la conexión>, field: 'api_key' }`;
ninguna key en claro DEBE llegar a la base. [D9]

**R8.** El sistema NO DEBE incluir la key ni su valor cifrado en ninguna respuesta de Server Action,
ninguna prop de componente, ningún HTML renderizado ni ninguna línea de log; el campo de la key
DEBE llegar vacío a la pantalla al cargarla y tras cualquier respuesta. [D9]

**R9.** SI la key guardada no se puede descifrar al probar la conexión guardada o al leer un PDF,
ENTONCES el sistema NO DEBE llamar al proveedor, DEBE dejar la conexión en `ERROR` con el último
error «No se pudo leer la key guardada. Vuelve a escribirla.» y DEBE responder
`integration_secret_unreadable` (al probar) o terminar el archivo con `ai_provider_error` (al
leer). [D8, D9]

### La prueba

**R10.** CUANDO se ejecuta la prueba, el sistema DEBE consultar al proveedor, con la key dada, la
existencia de cada uno de sus dos modelos sin generar texto (con OpenRouter: la consulta de la
propia key y la presencia de los dos modelos), sin reintentos y con un plazo de 10 s para la prueba
entera. [D7]

**R11.** SI la prueba falla, ENTONCES el sistema DEBE devolver el mensaje del proveedor que
corresponde al tipo de fallo —key rechazada, sin cuota o saldo, modelo no disponible, sin
respuesta, error inesperado— con los textos de `design.md > 4.4`, todos empezando por «Error con
tu proveedor:», sin la key ni texto libre del proveedor. [D7, D9]

**R12.** CUANDO la prueba es buena, el sistema DEBE devolver cuánto tardó, para mostrar «Conexión
correcta · respondió en X s» con un decimal. [D7, D10]

### Probar

**R13.** CUANDO el Administrador pulsa «Probar conexión» con un proveedor elegido y una key escrita,
el sistema DEBE ejecutar la prueba con esa key y NO DEBE escribir nada en la base. [D7]

**R14.** CUANDO el Administrador pulsa «Probar conexión» sobre la conexión guardada, el sistema
DEBE ejecutar la prueba con la key guardada; SI es buena, ENTONCES DEBE dejar `status = ACTIVE`,
`lastCheckedAt` = el instante de la prueba y `lastError` vacío; SI falla, ENTONCES DEBE dejar
`status = ERROR`, `lastError` = el mensaje del proveedor y `lastErrorAt` = el instante de la
prueba. [D7, D8]

### Guardar

**R15.** CUANDO el Administrador pulsa «Guardar y conectar» con un proveedor del catálogo y una key
válida, el sistema DEBE ejecutar la prueba con esa key antes de persistir nada. [D7]

**R16.** SI la prueba falla al guardar, ENTONCES el sistema NO DEBE crear ni modificar ninguna fila
(una conexión existente conserva su proveedor, su key, su estado y sus fechas) y DEBE devolver el
mensaje del proveedor para mostrarlo bajo el campo de la key. [D6, D7]

**R17.** SI la prueba es buena al guardar, ENTONCES el sistema DEBE crear la conexión si la empresa
no tenía, o reemplazar el proveedor y la key de la que tenía, y dejarla con `status = ACTIVE`,
`lastCheckedAt` y `keyUpdatedAt` = el instante de la prueba, `lastError` y `lastErrorAt` vacíos. [D4, D6, D7]

**R18.** SI la entrada es inválida (proveedor fuera del catálogo; key vacía tras recortar o de más de
1024 caracteres), ENTONCES el sistema DEBE rechazar con `invalid_input` sin llamar al proveedor. [D5, D7]

**R19.** CUANDO dos guardados de la misma empresa concurren, el sistema DEBE terminar con una sola
conexión, y su key cifrada DEBE descifrarse con el contexto de su propio id. [D4, D9]

### Desconectar

**R20.** CUANDO el Administrador confirma «Desconectar», el sistema DEBE borrar físicamente la fila
de la conexión, key cifrada incluida, sin llamar al proveedor; si la empresa ya no tenía conexión,
DEBE responder sin error y sin cambiar nada. [D6]

### La lectura de PDF con la key de la empresa

**R21.** CUANDO se procesa un PDF con la estrategia `formula`, el sistema DEBE leerlo con el
proveedor y la key de la conexión de la empresa dueña del archivo y con el modelo de receta del
catálogo; CUANDO la estrategia es `catalogo`, con el modelo de catálogo, también para la petición de
coordenadas del recorte. [A, D5]

**R22.** El sistema NO DEBE leer `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GEMINI_API_KEY` ni
`GEMINI_MODEL` en ningún camino de código, ni leer un PDF con una key que no sea la de la conexión
de la empresa dueña del archivo. [D1, D8]

**R23.** MIENTRAS la empresa no tiene conexión, el sistema DEBE rechazar la emisión de enlaces de
subida de PDF con el error `ai_provider_missing`, después de comprobar el permiso de subida y antes
de firmar ningún enlace. [A, D1]

**R24.** SI al procesar un archivo la empresa ya no tiene conexión, ENTONCES el sistema DEBE
terminar el archivo en error con `ai_provider_missing`, sin reintento de la cola y sin llamar a
ningún proveedor. [D1]

**R25.** SI durante la lectura de un archivo el proveedor responde con un fallo de cuenta, ENTONCES
el sistema DEBE terminar el archivo en error con `ai_provider_error`, sin reintento de la cola, y
DEBE dejar la conexión en `ERROR` con `lastError` = «La última lectura falló: » seguido del motivo
compuesto con el nombre del proveedor, el tipo de fallo y el código HTTP, y `lastErrorAt` = el
instante del fallo. [D8]

**R26.** SI la lectura de un archivo falla por cualquier causa que no es fallo de cuenta ni key
ilegible, ENTONCES el sistema NO DEBE cambiar el estado, `lastError` ni `lastErrorAt` de la conexión,
y el archivo DEBE terminar con el código y la clasificación (reintentable o definitivo) de hoy. [D8]

**R27.** CUANDO la lectura de un archivo termina bien y la conexión estaba en `ERROR`, el sistema
DEBE dejarla en `ACTIVE` y vaciar `lastError` y `lastErrorAt`. [D8, D10]

**R28.** MIENTRAS la conexión está en `ERROR`, el sistema DEBE seguir admitiendo la subida de PDF,
y su lectura DEBE intentarse con la key guardada. [D8, D10]

**R29.** El sistema DEBE leer con OpenAI y con OpenRouter a través del SDK oficial de OpenAI, con la
URL base de OpenRouter en este último; un solo archivo del repositorio DEBE importar esa
librería. [D3]

### Pantalla Integraciones > Proveedor IA

**R30.** MIENTRAS la empresa no tiene conexión, la pantalla DEBE mostrar la tarjeta «Conecta tu
proveedor» con el estado «Sin configurar»; los cuatro proveedores del catálogo como un grupo de
opciones excluyentes, cada uno con su logo, su nombre y su subtítulo; el campo «API key de
<proveedor>» oculto con botón para mostrarlo; la ayuda con el enlace a la consola del proveedor y
los dos modelos del elegido; y los botones «Probar conexión» y «Guardar y conectar», deshabilitados
mientras la key está vacía. [D10]

**R31.** MIENTRAS la empresa tiene conexión, la pantalla DEBE mostrar una tarjeta con el logo y el
nombre del proveedor, «Key guardada el <fecha> · cifrada», el estado «Conectado» (`ACTIVE`) o
«Error» (`ERROR`), el modelo de receta, el modelo de catálogo y la última prueba; y las acciones
«Desconectar», «Probar conexión» y «Cambiar key o proveedor». MIENTRAS está en `ERROR`, la tarjeta
DEBE mostrar además el aviso «Error con tu proveedor» con el `lastError`. [D6, D8, D10]

**R32.** CUANDO el Administrador pulsa «Cambiar key o proveedor», la pantalla DEBE mostrar el
formulario de R30 con el proveedor actual elegido y la key vacía; guardar aplica R15–R17. [D6]

**R33.** CUANDO el Administrador pulsa «Desconectar», la pantalla DEBE pedir confirmación con el
título «¿Desconectar <proveedor>?» y el texto «La key se borra y no se puede recuperar. Mientras no
conectes otro proveedor, nadie de tu empresa podrá leer fórmulas ni catálogos en PDF.»; cancelar NO
DEBE cambiar nada. [D6, D10]

**R34.** CUANDO una operación termina, la pantalla DEBE mostrar: prueba buena, «Conexión correcta ·
respondió en X s»; prueba fallida, el mensaje del proveedor (R11) junto al campo o en el aviso de la
tarjeta; guardado bueno, el aviso emergente «Proveedor IA conectado»; desconexión, «Proveedor IA
desconectado»; cualquier error del catálogo, su texto. [D10]

**R35.** La pantalla DEBE mostrar cada proveedor con su logo oficial en SVG y el nombre del
proveedor como texto alternativo. [D10]

**R36.** La pantalla DEBE cumplir la regla multiplataforma (`font-size` ≥ 16 px en el campo,
objetivos táctiles ≥ 44 × 44 px, nada que dependa solo de `:hover`) y la disposición de escritorio,
tablet y teléfono de los tableros aprobados. [D10]

### Aviso de bloqueo donde se sube un PDF

**R37.** MIENTRAS la empresa no tiene conexión, Fórmulas (`/produccion/formulas`) y el detalle de
proveedor (`/proveedores/<id>`) DEBEN mostrar, a quien puede subir PDF y en el lugar del botón
«Subir PDFs», el aviso «Para leer PDF, conecta el proveedor IA de tu empresa. La lectura usa tu
propia API key.»; con `integraciones.modificar`, con el enlace «Ir a Proveedor IA»; sin él, con el
texto «Pídele a un administrador que lo configure» y sin enlace. [A, D1, D10]

**R38.** El sistema NO DEBE mostrar ni el botón ni el aviso a quien no puede subir PDF, como hoy. [A]

**R39.** CUANDO un archivo de la tanda termina en error con `ai_provider_missing` o
`ai_provider_error`, la fila de la subida DEBE mostrar el texto del catálogo de ese código. [D1, D8]

### Dobles para E2E, configuración y dependencias

**R40.** DONDE la variable `INTEGRATIONS_E2E_DOUBLES` tiene valor, la composición DEBE cablear un
doble de la prueba que responde sin red (key que empieza por `E2E_INVALID`: key rechazada con 401;
cualquier otra: prueba buena); en su ausencia, la prueba real. [D7]

**R41.** DONDE la variable `DOCUMENTS_E2E_DOUBLES` tiene valor, la lectura DEBE seguir usando el
doble de guion sin descifrar la key, pero SOLO si la empresa tiene conexión; sin conexión, R23 y
R24 aplican igual. [D1]

**R42.** Importar `lib/composition` NO DEBE leer ninguna variable de entorno, consultar la base ni
llamar a un proveedor. [D1]

**R43.** Ningún archivo de `lib/` DEBE contener un identificador de modelo de IA escrito a mano: los
modelos salen solo del catálogo de la base. [D5]

**R44.** Esta ficha DEBE añadir a `package.json` exactamente una dependencia, `openai`, con su fila
en `docs/dependencias.md`, y NO DEBE añadir permisos nuevos ni entradas de menú. [D2, D3]

## Preguntas abiertas

- Identificadores exactos de los dos modelos (receta, catálogo) de cada proveedor: los propone el
  spec, verificados contra la documentación vigente de cada proveedor, y los aprueba el humano en
  F1.4. No se inventan. **Estado tras F1.2:** propuesta y fuentes en `design.md > 3`; los ocho
  quedan `[POR VERIFICAR]` (el spec se escribió sin red; los de Claude salen de los tipos del SDK
  instalado, no de la documentación).
- QC-175 (respaldo de Gemini por variable de entorno) pierde sentido con el corte de D1: ¿se cancela
  absorbida por QC-276? Lo decide el humano al acotar QC-276; no bloquea esta ficha.
- **(spec_author, 2026-10-13) R27 y R28 interpretan el tablero, no una decisión escrita.** El aviso
  de error aprobado dice «Hasta que la reemplaces **o vuelva a responder**, no se pueden leer PDF».
  El spec lo lee así: con la conexión en `ERROR` se sigue intentando leer con la key guardada (R28)
  y una lectura buena la devuelve a `ACTIVE` (R27); el bloqueo duro es solo «sin conexión». La
  alternativa —que `ERROR` bloquee la subida igual que «sin conexión»— obliga a pasar por «Probar
  conexión» para desbloquear, y una cuota agotada que se recarga sola dejaría la empresa bloqueada
  hasta que alguien entre a Integraciones. Confirmar en F1.4.
- **(spec_author, 2026-10-13) Textos nuevos que el tablero no trae:** los mensajes del proveedor por
  tipo de fallo (`design.md > 4.4`), los textos de error del catálogo para `ai_provider_missing` y
  `ai_provider_error` (`design.md > 11`) y la línea «Última prueba» (`design.md > 12.3`). Se aprueban
  con el spec en F1.4.
- **(spec_author, 2026-10-13) Logos oficiales** `[POR CONFIRMAR]`: de dónde sale cada SVG y si su
  uso de marca lo permite en una pantalla de configuración (`design.md > 12.5`). Sin confirmar, la
  pantalla sale con el monograma del tablero (C, G, O, R) y R35 queda sin cumplir hasta que lleguen.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-13 | ¿Qué pasa con las empresas sin key propia al desplegar? | Corte inmediato: cada empresa usa su propia key. `ANTHROPIC_API_KEY` y `GEMINI_API_KEY` dejan de usarse para leer PDF de empresas. |
| 2026-10-13 | ¿Quién configura la key? | El Administrador, con `integraciones.modificar` (QC-221). Mismo criterio que QC-237 D1. |
| 2026-10-13 | ¿SDK de OpenAI o `fetch`? | SDK oficial de OpenAI, también para OpenRouter (API compatible). Dependencia nueva: los cuatro checks y la fila propuesta van en el design (regla 7). |
| 2026-10-13 | ¿Uno o varios proveedores? | Uno activo por empresa en esta ficha. Varios como respaldo encadenado van en QC-276. |
| 2026-10-13 | ¿Qué proveedores entran en el seed? | Claude (Anthropic), Gemini (Google), OpenAI y OpenRouter. Todos aceptan PDF o imágenes, que es lo que leen los dos usos. |
| 2026-10-13 | ¿Se puede cambiar o quitar? | Sí: cambiar key, cambiar proveedor (con prueba nueva) y desconectar con confirmación. Al desconectar el secreto se borra físicamente. |
| 2026-10-13 | ¿Se prueba la key? | Sí: «Probar conexión» hace una llamada mínima al proveedor, y la misma prueba corre antes de guardar. Con la key rechazada no se guarda nada (patrón QC-237 D6). |
| 2026-10-13 | ¿Qué pasa si la key falla en uso? | La lectura falla con «Error con tu proveedor» y la conexión queda en estado Error con su último error visible en Integraciones (patrón QC-237 D13). No se reintenta con la key de la plataforma. |
| 2026-10-13 | ¿Se devuelve la key al navegador? | Nunca (heredado de QC-237 D4). Cifrada con el `SecretContext` de QC-234 (QC-237 D8). |
| 2026-10-13 | ¿Diseño? | Tableros `docs/diseno/canvas/ProveedorIA.dc.html`, `ProveedorIATablet.dc.html` y `ProveedorIAMovil.dc.html`, aprobados por el humano. Con el logo oficial de cada proveedor (SVG del kit de marca). |
| — | Identificadores de DB | En inglés (heredado de QC-4). |
