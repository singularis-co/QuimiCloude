# QT-304 — tool-calling-con-ai-sdk · requirements.md

> Zona: `backend` · Complejidad: `high` · depends_on: — · Rama: `feature/QT-304-tool-calling-con-ai-sdk`
>
> **Alcance.** La capa de IA conversacional que usarán el enrutador (QT-306) y el agente (QT-307),
> con la key de IA propia de cada empresa (`AiProviderConnection`):
> - un puerto nuevo de «modelo conversacional»: generar texto con herramientas (tool calling) y
>   generar una salida estructurada validada con zod, implementado con el AI SDK de Vercel para los
>   cuatro proveedores del catálogo (Anthropic, Google, OpenAI y OpenRouter);
> - los casos de uso que resuelven proveedor, modelo y key desde la conexión de la empresa y llaman
>   a ese puerto sin que la key salga de ellos;
> - en el catálogo de modelos (`AiModel`), qué modelos admiten herramientas y cuáles son económicos
>   (migración + valores sembrados);
> - el modelo enrutador por empresa (`routerModel` en `AiProviderConnection`, nulo = sin elección),
>   que debe ser un modelo económico del mismo proveedor, y el caso de uso para elegirlo;
> - la clasificación de los fallos del proveedor con el mismo tipo y la misma tabla que ya usan la
>   lectura de PDF y `reportAiProviderOutcome`.
>
> **Lo que NO entra.**
> - Las herramientas concretas (pedidos, catálogo, datos de la empresa, pasar a humano): QT-305.
> - El enrutador (reglas fijas, clasificador, tabla de rutas): QT-306. Aquí solo el modelo que usará.
> - El orquestador (cola, filtros, límites, envío, registro por turno) y **quién marca la conexión**
>   cuando una respuesta del agente falla: QT-307.
> - Toda pantalla, incluida la de elegir el modelo enrutador: QT-308 o la ficha que el humano diga
>   (P4).
> - Embeddings y base de conocimiento en PDF: QT-310.
> - La lectura de PDF de `documentos` sigue con los SDK actuales (propuesta de P1).

## Decisiones cerradas (no reabrir)

Decisiones del humano del 2026-10-29 (`progress/features/QT-304.md > Decisiones`).

| # | Decisión | Cubierta por |
|---|---|---|
| D1 | El tool calling se hace con el AI SDK de Vercel (`ai` + `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`). Es dependencia nueva: cuatro checks de salud y fila en `docs/dependencias.md`; se aprueba con el spec (F1.4). | R31–R33, R37, R38 |
| D2 | El enrutador (QT-306) usa el modelo económico del mismo proveedor de la empresa (`routerModel`), con salida tipada validada con zod. | R5–R15, R28–R30 |
| D3 | Embeddings y PDF quedan fuera (QT-310, futuro). | R39 |

## Requisitos (EARS)

### Catálogo de modelos

- **R1** — El sistema DEBE registrar, para cada modelo del catálogo, si admite herramientas y si es
  económico, ambos con valor obligatorio (sí/no).
- **R2** — CUANDO se aplica la migración de esta ficha, el sistema DEBE dejar cada modelo sembrado
  con los valores de «admite herramientas» y «económico» de la tabla aprobada en
  `design.md > 3`, sin cambiar ningún otro dato del catálogo ni de las conexiones.
- **R3** — CUANDO se revierte esa migración, el sistema DEBE dejar el catálogo de modelos y las
  conexiones con exactamente las columnas y los datos previos a ella.
- **R4** — El catálogo que leen los casos de uso de `integraciones` DEBE exponer, por modelo, las dos
  marcas de R1.

### Modelo enrutador por empresa

- **R5** — El sistema DEBE guardar, por conexión de proveedor de IA, un modelo enrutador opcional;
  vacío significa «sin elección».
- **R6** — SI se intenta guardar como modelo enrutador un modelo que no está en el catálogo del
  proveedor de esa misma conexión, ENTONCES la base DEBE rechazar la escritura.
- **R7** — CUANDO un actor autorizado elige el modelo enrutador, el sistema DEBE aceptarlo solo si es
  un modelo económico del proveedor conectado; SI no lo es, ENTONCES DEBE rechazarlo con error de
  validación sin consultar al proveedor y sin escribir.
- **R8** — SI el actor que elige el modelo enrutador no tiene el permiso de `design.md > 5.2` (P3) o
  no tiene empresa, ENTONCES el sistema DEBE rechazarlo como no autorizado antes de validar la
  entrada y de tocar ningún puerto.
- **R9** — CUANDO un actor autorizado elige un modelo enrutador económico, el sistema DEBE consultar
  al proveedor con la key guardada y ese modelo antes de guardar; SI la consulta falla, ENTONCES NO
  DEBE guardar y DEBE devolver el mismo mensaje de fallo que «Probar conexión».
- **R10** — SI la empresa no tiene conexión de proveedor de IA al elegir el modelo enrutador,
  ENTONCES el sistema DEBE devolver «sin conexión» sin escribir nada.
- **R11** — CUANDO el modelo enrutador elegido es el económico predeterminado del proveedor
  (R14), el sistema DEBE guardarlo como «sin elección», de modo que un cambio posterior del catálogo
  alcance a esa empresa.
- **R12** — CUANDO se guarda una key de un proveedor distinto al de la conexión, el sistema DEBE
  dejar el modelo enrutador en «sin elección»; CUANDO se guarda una key del mismo proveedor, DEBE
  conservarlo.

### Resolución del modelo para una conversación

- **R13** — CUANDO se pide el modelo principal de una empresa, el sistema DEBE usar el modelo en uso
  de su conexión (el elegido o, sin elección, el predeterminado del catálogo).
- **R14** — CUANDO se pide el modelo económico de una empresa, el sistema DEBE usar su modelo
  enrutador; SI no hay elección o el elegido ya no está marcado como económico en el catálogo,
  ENTONCES DEBE usar el primer modelo económico de su proveedor en el orden del catálogo.
- **R15** — SI el proveedor de la empresa no tiene ningún modelo económico en el catálogo,
  ENTONCES pedir el modelo económico DEBE devolver «sin modelo económico» sin llamar al proveedor.
- **R16** — SI la empresa no tiene conexión, ENTONCES una generación DEBE devolver «sin conexión»;
  SI la key guardada no se puede descifrar, ENTONCES DEBE devolver «key ilegible»; en ambos casos
  sin llamar al proveedor.
- **R17** — SI se piden herramientas y el modelo resuelto no admite herramientas según el catálogo,
  ENTONCES la generación DEBE devolver «modelo sin herramientas» sin llamar al proveedor.
- **R18** — La key en claro NO DEBE aparecer en ningún resultado ni error que devuelvan los casos de
  uso de generación.

### Generación de texto con herramientas

- **R19** — CUANDO se genera texto con herramientas, el sistema DEBE ofrecer al modelo exactamente
  las herramientas recibidas, con su nombre, su descripción y su esquema de entrada, y DEBE devolver
  el texto final del modelo.
- **R20** — CUANDO el modelo llama a una herramienta ofrecida con una entrada que cumple su esquema,
  el sistema DEBE ejecutarla con la entrada ya validada y DEBE entregar su resultado al modelo para
  el paso siguiente.
- **R21** — SI el modelo llama a una herramienta con una entrada que no cumple su esquema,
  ENTONCES el sistema NO DEBE ejecutarla y la llamada DEBE constar como fallida en el resultado.
- **R22** — SI el modelo pide una herramienta que no se le ofreció, ENTONCES el sistema NO DEBE
  ejecutar nada por ella y la llamada DEBE constar como fallida en el resultado.
- **R23** — SI la ejecución de una herramienta lanza una excepción, ENTONCES el sistema DEBE entregar
  al modelo un resultado de error genérico que no contenga el mensaje ni la traza de la excepción, y
  la llamada DEBE constar como fallida en el resultado.
- **R24** — El sistema DEBE limitar el número de pasos de una generación al tope que pide quien
  llama, dentro del rango de `design.md > 4.2` (P5); SI se llega al tope sin un texto final,
  ENTONCES DEBE devolver «tope de pasos».
- **R25** — SI el texto final del modelo está vacío o solo tiene espacios, ENTONCES el sistema DEBE
  devolver «respuesta vacía».
- **R26** — CUANDO una generación con herramientas termina bien, el resultado DEBE incluir el texto,
  las llamadas a herramientas en orden (nombre y si fue bien), los tokens de entrada y de salida (o
  «desconocido» si el proveedor no los da) y el número de pasos.
- **R27** — SI la lista de herramientas trae dos con el mismo nombre o un nombre fuera del formato
  de `design.md > 4.2`, ENTONCES el sistema DEBE lanzar un error de programación sin llamar al
  proveedor.

### Salida estructurada

- **R28** — CUANDO se genera una salida estructurada con un esquema zod, el sistema DEBE devolver el
  valor que resulta de validar la respuesta del modelo con ese esquema.
- **R29** — SI la respuesta del modelo no es un objeto que cumpla el esquema, ENTONCES el sistema
  DEBE devolver «salida inválida», sin el texto que devolvió el modelo.
- **R30** — Una generación de salida estructurada NO DEBE ofrecer herramientas al modelo.

### Proveedores y llamadas

- **R31** — El sistema DEBE generar con los cuatro proveedores del catálogo (Anthropic, Google,
  OpenAI y OpenRouter), con la key y el modelo resueltos para la empresa; OpenRouter por su API
  compatible con OpenAI. Un proveedor del catálogo sin implementación NO DEBE compilar.
- **R32** — El sistema NO DEBE reintentar por su cuenta una llamada al proveedor que falló.
- **R33** — CUANDO una llamada supera el plazo que pide quien llama, el sistema DEBE abortarla y
  devolver un fallo `unreachable`.

### Clasificación de fallos

- **R34** — SI el proveedor responde con error, ENTONCES el sistema DEBE clasificarlo con la tabla
  por proveedor de `design.md > 6` (la misma que la lectura de PDF): key rechazada, cuota, modelo no
  disponible (con el id del modelo usado), sin respuesta o inesperado.
- **R35** — El fallo devuelto DEBE ser del mismo tipo que acepta `reportAiProviderOutcome` y NO DEBE
  llevar texto libre del proveedor ni la key.
- **R36** — Los casos de uso de generación NO DEBEN cambiar el estado de la conexión de la empresa.

### Aislamiento y dependencias

- **R37** — Solo los adaptadores de IA conversacional de `integraciones` (`design.md > 7`) DEBEN
  importar `ai` o `@ai-sdk/*`; el dominio, los puertos y el contrato del módulo NO DEBEN arrastrarlos.
- **R38** — Las cuatro dependencias nuevas DEBEN tener su fila `aprobada` en `docs/dependencias.md`,
  con los cuatro checks verificados, antes de figurar en `package.json`.
- **R39** — La lectura de PDF de `documentos` DEBE seguir usando sus adaptadores actuales, sin
  importar `ai` ni `@ai-sdk/*` (según la respuesta a P1).

## Preguntas abiertas

Cada una lleva la propuesta con la que está escrito el spec; el humano la cierra en F1.4.

- **P1 — ¿Migra la lectura de PDF de `documentos` al AI SDK?** Propuesta: **no en esta ficha.** La
  lectura funciona en producción con tres SDK aprobados, su clasificación de errores tiene tests
  propios (`classifyAnthropicError`, `classifyOpenAiError`, `classifyGenaiError`) y depende de
  detalles multimodales (PDF en base64, PNG por página, plazo) que el AI SDK expresa distinto;
  migrarla duplicaría el riesgo de esta ficha sin que QT-305…QT-307 lo necesiten. Si se quiere
  unificar, una ficha propia cuando el agente esté en producción. R39 está escrito con esta propuesta.
- **P2 — Valores sembrados de «admite herramientas» y «económico».** No están en `docs/` ni en el
  código. Propuesta en `design.md > 3`, a verificar en T0 contra
  `https://openrouter.ai/api/v1/models` (`supported_parameters`) y las APIs nativas.
- **P3 — Permiso para elegir el modelo enrutador.** Propuesta: `agente_ia.modificar` (solo lo usa
  el agente, y ese permiso ya llega quitado con el añadido apagado). Alternativa:
  `integraciones.modificar`, el mismo que elige el modelo principal.
- **P4 — ¿Dónde se elige el modelo enrutador en pantalla?** Esta ficha deja el caso de uso sin
  Server Action ni UI. Propuesta: la pantalla de configuración del agente (QT-308 o la que diga el
  humano), que añade la Server Action fina.
- **P5 — Tope de pasos de una generación con herramientas.** Propuesta: quien llama lo pasa
  obligatorio, entre 1 y 8. No hay dato del repo; 8 cubre «consultar pedido → detalle de entrega →
  responder» con margen.
- **P6 — ¿Un fallo del agente marca la conexión?** Esta ficha devuelve el fallo con el tipo que
  acepta `reportAiProviderOutcome` y no marca nada (R36). El texto que hoy escribe ese caso de uso
  dice «La última lectura falló» y habla de fórmulas y catálogos en PDF: si QT-307 lo llama tal cual,
  el aviso sería falso. Propuesta: lo decide y lo adapta QT-307.
- **P7 — Versión exacta de las cuatro dependencias.** No se pudo consultar npm al escribir el spec.
  Se fija en T0 (`design.md > 8`).
