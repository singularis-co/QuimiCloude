# QT-304 — tool-calling-con-ai-sdk · requirements.md

> Zona: `backend` · Complejidad: `high` · depends_on: — · Rama: `feature/QT-304-tool-calling-con-ai-sdk`
>
> **Alcance.** La capa de IA conversacional que usarán el enrutador (QT-306) y el agente (QT-307),
> con la key de IA propia de cada empresa (`AiProviderConnection`):
> - un puerto nuevo de «modelo conversacional»: generar texto con herramientas (tool calling) y
>   generar una salida estructurada validada con zod, implementado con el AI SDK de Vercel para los
>   cuatro proveedores del catálogo (Anthropic, Google, OpenAI y OpenRouter);
> - los casos de uso que resuelven proveedor y key desde la conexión de la empresa, y el modelo desde
>   el par de plataforma de su proveedor, y llaman a ese puerto sin que la key salga de ellos;
> - en el catálogo de modelos (`AiModel`), qué modelos admiten herramientas y cuáles son económicos
>   (migración + valores sembrados);
> - *(cambiado el 2026-10-31, D6)* los **pares de modelos de plataforma**: por proveedor, un par
>   principal + respaldo para el agente y otro para el enrutador, que elige el Maestro; sembrados por
>   migración, con casos de uso para leerlos y guardarlos y dos permisos de plataforma nuevos;
> - el reintento único con el modelo de respaldo cuando el principal no está disponible (D9);
> - la clasificación de los fallos del proveedor con el mismo tipo y la misma tabla que ya usan la
>   lectura de PDF y `reportAiProviderOutcome`.
>
> **Lo que NO entra.**
> - Las herramientas concretas (pedidos, catálogo, datos de la empresa, pasar a humano): QT-305.
> - El enrutador (reglas fijas, clasificador, tabla de rutas): QT-306. Aquí solo el par que usará.
> - El orquestador (cola, filtros, límites, envío, registro por turno) y **quién marca la conexión**
>   cuando una respuesta del agente falla: QT-307 (D11).
> - Toda pantalla, incluida la del Maestro para elegir los pares: QT-311 (D7).
> - Embeddings y base de conocimiento en PDF: QT-310.
> - La lectura de PDF de `documentos` sigue con los SDK actuales y con el `model` de su conexión (D4).
> - Elegir modelo por empresa para la conversación: la empresa solo aporta su key (D6).

## Decisiones cerradas (no reabrir)

D1–D3: decisiones del humano del 2026-10-29 (`progress/features/QT-304.md > Decisiones`).
D4–D12: respuestas del humano a P1–P7 en F1.4, el 2026-10-31.

| # | Decisión | Cubierta por |
|---|---|---|
| D1 | El tool calling se hace con el AI SDK de Vercel (`ai` + `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`). Es dependencia nueva: cuatro checks de salud y fila en `docs/dependencias.md`; se aprueba con el spec (F1.4). | R41–R43, R47, R48 |
| D2 | ~~El enrutador usa el modelo económico del mismo proveedor de la empresa (`routerModel`)~~. **Sustituida por D6 el 2026-10-31.** Sigue en pie: el enrutador usa salida tipada validada con zod. | R38–R40 |
| D3 | Embeddings y PDF quedan fuera (QT-310, futuro). | R49 |
| D4 | (P1, 2026-10-31) La lectura de PDF de `documentos` **no** migra al AI SDK en esta ficha. | R49 |
| D5 | (P2, 2026-10-31, verificado por el humano en OpenRouter `/models`: los 15 modelos tienen `tools` y `structured_outputs`) `supports_tools` = sí en todos. `is_economic` = sí **solo** en `claude-haiku-5-5`, `gpt-6-luna`, `gpt-5.6-luna`, `gemini-3.5-flash-lite`, `gemini-3.7-flash`, `gemini-3.8-flash` y en OpenRouter `anthropic/claude-haiku-5.5`, `openai/gpt-6-luna`, `google/gemini-3.8-flash`. El resto no (incluidos `gemini-3.1-flash-lite` y `gpt-6-luna-pro`). Criterio: equilibrio calidad/precio. | R1, R2 |
| D6 | (P3, 2026-10-31) El modelo del agente y el del enrutador **no** los elige la empresa: los elige el Maestro a nivel plataforma, **por proveedor**, siempre como **par principal + respaldo**, dos pares por proveedor (agente y enrutador). La empresa solo aporta su key y se usa el par de su proveedor. Sin `router_model_id` por empresa ni `selectAiRouterModel`. Tabla de plataforma con FK a `ai_models` del mismo proveedor, principal ≠ respaldo, ambos con herramientas; el principal del enrutador solo económico. Lectura y guardado con permiso de plataforma del Maestro (`modelos_ia.consultar` / `modelos_ia.modificar`, patrón de QC-182). La lectura de PDF sigue con el `model` de `AiProviderConnection`. | R5–R22 |
| D7 | (P4, 2026-10-31) La pantalla del Maestro para los pares va en una tarjeta nueva, QT-311 (`pantalla-modelos-ia-del-maestro`). Aquí no hay Server Action ni UI. | R10, R14 (el contrato de lectura y guardado que usará QT-311) |
| D8 | (P5, 2026-10-31) Pares iniciales sembrados por migración, principal → respaldo: ANTHROPIC agente `claude-sonnet-5-5` → `claude-sonnet-5`, enrutador `claude-haiku-5-5` → `claude-sonnet-5-5`; OPENAI agente `gpt-6.1-sol` → `gpt-6-sol`, enrutador `gpt-6-luna` → `gpt-5.6-luna`; GOOGLE agente `gemini-4-argon` → `gemini-3.8-flash`, enrutador `gemini-3.8-flash` → `gemini-3.5-flash-lite`; OPENROUTER agente `anthropic/claude-sonnet-5.5` → `openai/gpt-6.1-sol`, enrutador `anthropic/claude-haiku-5.5` → `google/gemini-3.8-flash`. La regla «enrutador solo económicos» se aplica **solo al principal**: el humano eligió `claude-sonnet-5-5` como respaldo del enrutador de ANTHROPIC sabiendo que no es económico. | R8, R10, R11 |
| D9 | (P6, 2026-10-31) Se reintenta **una** vez con el respaldo solo si el principal falla por modelo inexistente/deprecado/no disponible, sobrecarga o plazo. Key rechazada y cuota **no** cambian de modelo. Un test por caso. | R23–R28 |
| D10 | (tope de pasos, 2026-10-31) Quien llama lo pasa obligatorio, entero entre 1 y 8. | R34 |
| D11 | (marcar la conexión, 2026-10-31) Si un fallo del agente marca la conexión lo decide y lo adapta QT-307; esta ficha no marca nada. | R45, R46 |
| D12 | (P7, 2026-10-31, T0 hecho por el leader con red) Versiones: `ai@7.0.159`, `@ai-sdk/anthropic@4.0.94`, `@ai-sdk/openai@4.0.106`, `@ai-sdk/google@4.0.109` (serie `ai@7` + `@ai-sdk/*@4`). Cuatro checks OK; peer `zod ^4.1.8` y `node >=22` compatibles. Riesgo ESM-only a confirmar en T4. | R48 |
| D13 | (P8, 2026-10-31) Si el principal ya ejecutó alguna herramienta, no se pasa al respaldo: se devuelve su fallo. Evita repetir herramientas con efecto. | R26 |
| D14 | (P9, 2026-10-31) «Sobrecarga» que pasa al respaldo = HTTP 503 y 529. 500, 502 y 504 no pasan al respaldo. | R23 (ver `design.md > 6`) |

## Requisitos (EARS)

> Renumerados el 2026-10-31 al cerrar P1–P7: los antiguos R5–R15 (modelo enrutador por empresa) los
> sustituyen R5–R28 (pares de plataforma, permisos y respaldo). No hay código ni tests previos.

### Catálogo de modelos

- **R1** — El sistema DEBE registrar, para cada modelo del catálogo, si admite herramientas y si es
  económico, ambos con valor obligatorio (sí/no).
- **R2** — CUANDO se aplica la migración de esta ficha, el sistema DEBE dejar cada modelo sembrado
  con los valores de «admite herramientas» y «económico» de la tabla de `design.md > 3.1` (D5), sin
  cambiar ningún otro dato del catálogo ni de las conexiones de las empresas.
- **R3** — CUANDO se revierte la migración de esquema de esta ficha, el sistema DEBE dejar el
  catálogo de modelos y las conexiones con exactamente las columnas y los datos previos a ella, y
  sin la tabla de pares.
- **R4** — El catálogo que leen los casos de uso de `integraciones` DEBE exponer, por modelo, las dos
  marcas de R1.

### Pares de modelos de plataforma

- **R5** — El sistema DEBE guardar, por cada proveedor y cada rol (agente, enrutador), como mucho un
  par de modelos con un principal y un respaldo, ambos obligatorios.
- **R6** — SI se intenta escribir en un par un modelo que no está en el catálogo del mismo proveedor
  del par, ENTONCES la base DEBE rechazar la escritura.
- **R7** — SI se intenta escribir un par cuyo principal y respaldo son el mismo modelo, ENTONCES la
  base DEBE rechazar la escritura.
- **R8** — CUANDO se aplica la migración de esta ficha, el sistema DEBE dejar sembrados exactamente
  los ocho pares de `design.md > 3.2` (D8), sin autor.
- **R9** — MIENTRAS un modelo sea principal o respaldo de algún par, la base DEBE rechazar borrarlo
  del catálogo.
- **R10** — CUANDO un actor autorizado guarda un par, el sistema DEBE aceptarlo solo si los dos
  modelos están en el catálogo del proveedor del par, son distintos y ambos admiten herramientas, y,
  si el rol es enrutador, el principal es económico; SI no se cumple, ENTONCES DEBE rechazarlo con
  error de validación sin escribir.
- **R11** — CUANDO un actor autorizado guarda un par de enrutador, el sistema NO DEBE exigir que el
  respaldo sea económico (D8).
- **R12** — CUANDO un actor autorizado guarda un par válido, el sistema DEBE reemplazar el par de ese
  proveedor y ese rol, registrar quién lo guardó y cuándo, y dejar los demás pares sin cambios.
- **R13** — SI el actor que guarda un par no tiene `modelos_ia.modificar`, o el que los lee no tiene
  `modelos_ia.consultar`, ENTONCES el sistema DEBE rechazarlo como no autorizado antes de validar la
  entrada y de tocar ningún puerto. La operación NO DEBE exigir empresa al actor.
- **R14** — CUANDO un actor autorizado lee los pares, el sistema DEBE devolver, por cada proveedor
  del catálogo, su par de agente y su par de enrutador (o «sin par» si falta) y sus modelos con las
  dos marcas de R1.
- **R15** — Leer o guardar un par NO DEBE consultar a ningún proveedor ni leer la key de ninguna
  empresa.

### Permisos de plataforma

- **R16** — El catálogo de permisos DEBE incluir `modelos_ia.consultar` y `modelos_ia.modificar`; el
  rol Maestro DEBE recibir los dos, y ningún rol de empresa DEBE recibir ninguno.
- **R17** — CUANDO se aplica la migración de datos de esos permisos, el sistema DEBE crearlos y
  asignarlos solo al Maestro; CUANDO se aplica dos veces, la segunda NO DEBE cambiar nada; CUANDO se
  revierte, DEBE borrar exactamente esos dos códigos y sus asignaciones.

### Resolución del modelo para una conversación

- **R18** — CUANDO se genera para una empresa con un rol (agente o enrutador), el sistema DEBE usar
  el par de ese rol del proveedor de la conexión de la empresa y la key de esa conexión; el modelo
  elegido por la empresa en su conexión NO DEBE influir.
- **R19** — SI no existe par para el proveedor de la empresa y el rol pedido, ENTONCES una generación
  DEBE devolver «sin par de modelos» sin llamar al proveedor.
- **R20** — SI la empresa no tiene conexión, ENTONCES una generación DEBE devolver «sin conexión»;
  SI la key guardada no se puede descifrar, ENTONCES DEBE devolver «key ilegible»; en ambos casos
  sin llamar al proveedor.
- **R21** — SI se piden herramientas y el principal del par no admite herramientas según el
  catálogo, ENTONCES la generación DEBE devolver «modelo sin herramientas» sin llamar al proveedor.
- **R22** — La key en claro NO DEBE aparecer en ningún resultado ni error que devuelvan los casos de
  uso de generación.

### Modelo de respaldo

- **R23** — SI la llamada con el principal falla por modelo no disponible, por sobrecarga
  (`design.md > 6`, P9) o por falta de respuesta o plazo, ENTONCES el sistema DEBE repetir la misma
  generación una sola vez con el respaldo del mismo par.
- **R24** — SI la llamada con el principal falla por key rechazada, por cuota o por un error
  inesperado que no es sobrecarga, o termina con «tope de pasos», «respuesta vacía» o «salida
  inválida», ENTONCES el sistema NO DEBE llamar al respaldo.
- **R25** — SI la llamada con el respaldo también falla, ENTONCES el sistema DEBE devolver el fallo
  del respaldo sin un tercer intento.
- **R26** — SI con el principal se ejecutó al menos una herramienta antes del fallo, ENTONCES el
  sistema NO DEBE llamar al respaldo y DEBE devolver el fallo del principal (P8).
- **R27** — SI se piden herramientas y el respaldo no admite herramientas según el catálogo,
  ENTONCES el sistema NO DEBE llamar al respaldo y DEBE devolver el fallo del principal.
- **R28** — El resultado de una generación DEBE indicar con qué modelo se obtuvo y, si se usó el
  respaldo, el fallo del principal que lo provocó.

### Generación de texto con herramientas

- **R29** — CUANDO se genera texto con herramientas, el sistema DEBE ofrecer al modelo exactamente
  las herramientas recibidas, con su nombre, su descripción y su esquema de entrada, y DEBE devolver
  el texto final del modelo.
- **R30** — CUANDO el modelo llama a una herramienta ofrecida con una entrada que cumple su esquema,
  el sistema DEBE ejecutarla con la entrada ya validada y DEBE entregar su resultado al modelo para
  el paso siguiente.
- **R31** — SI el modelo llama a una herramienta con una entrada que no cumple su esquema,
  ENTONCES el sistema NO DEBE ejecutarla y la llamada DEBE constar como fallida en el resultado.
- **R32** — SI el modelo pide una herramienta que no se le ofreció, ENTONCES el sistema NO DEBE
  ejecutar nada por ella y la llamada DEBE constar como fallida en el resultado.
- **R33** — SI la ejecución de una herramienta lanza una excepción, ENTONCES el sistema DEBE entregar
  al modelo un resultado de error genérico que no contenga el mensaje ni la traza de la excepción, y
  la llamada DEBE constar como fallida en el resultado.
- **R34** — El sistema DEBE exigir a quien llama un tope de pasos entero entre 1 y 8 (D10) y DEBE
  limitar a él los pasos de una generación; SI se llega al tope sin un texto final, ENTONCES DEBE
  devolver «tope de pasos».
- **R35** — SI el texto final del modelo está vacío o solo tiene espacios, ENTONCES el sistema DEBE
  devolver «respuesta vacía».
- **R36** — CUANDO una generación con herramientas termina bien, el resultado DEBE incluir el texto,
  las llamadas a herramientas en orden (nombre y si fue bien), los tokens de entrada y de salida (o
  «desconocido» si el proveedor no los da) y el número de pasos.
- **R37** — SI la lista de herramientas trae dos con el mismo nombre o un nombre fuera del formato
  de `design.md > 4.2`, o el tope de pasos o el plazo están fuera de rango, ENTONCES el sistema DEBE
  lanzar un error de programación sin llamar al proveedor.

### Salida estructurada

- **R38** — CUANDO se genera una salida estructurada con un esquema zod, el sistema DEBE devolver el
  valor que resulta de validar la respuesta del modelo con ese esquema.
- **R39** — SI la respuesta del modelo no es un objeto que cumpla el esquema, ENTONCES el sistema
  DEBE devolver «salida inválida», sin el texto que devolvió el modelo.
- **R40** — Una generación de salida estructurada NO DEBE ofrecer herramientas al modelo.

### Proveedores y llamadas

- **R41** — El sistema DEBE generar con los cuatro proveedores del catálogo (Anthropic, Google,
  OpenAI y OpenRouter), con la key de la empresa y el modelo del par; OpenRouter por su API
  compatible con OpenAI. Un proveedor del catálogo sin implementación NO DEBE compilar.
- **R42** — El adaptador del proveedor NO DEBE reintentar por su cuenta una llamada que falló; el
  único intento adicional es el del respaldo (R23).
- **R43** — CUANDO una llamada a un modelo (principal o respaldo) supera el plazo que pide quien
  llama, el sistema DEBE abortarla y tratarla como fallo `unreachable`.

### Clasificación de fallos

- **R44** — SI el proveedor responde con error, ENTONCES el sistema DEBE clasificarlo con la tabla
  por proveedor de `design.md > 6` (la misma que la lectura de PDF): key rechazada, cuota, modelo no
  disponible (con el id del modelo usado), sin respuesta o inesperado (con su código HTTP).
- **R45** — El fallo devuelto DEBE ser del mismo tipo que acepta `reportAiProviderOutcome` y NO DEBE
  llevar texto libre del proveedor ni la key.
- **R46** — Los casos de uso de generación NO DEBEN cambiar el estado de la conexión de la empresa
  (D11).

### Aislamiento y dependencias

- **R47** — Solo los adaptadores de IA conversacional de `integraciones` (`design.md > 7`) DEBEN
  importar `ai` o `@ai-sdk/*`; el dominio, los puertos y el contrato del módulo NO DEBEN arrastrarlos.
- **R48** — Las cuatro dependencias nuevas DEBEN tener su fila `aprobada` en `docs/dependencias.md`,
  con los cuatro checks verificados, antes de figurar en `package.json`, con las versiones de D12.
- **R49** — La lectura de PDF de `documentos` DEBE seguir usando sus adaptadores actuales y el modelo
  de la conexión de la empresa, sin importar `ai` ni `@ai-sdk/*` (D4).

## Preguntas abiertas

Ninguna. P8 y P9 se cerraron el 2026-10-31 (D13, D14).
